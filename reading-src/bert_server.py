"""Loopback-only adapter for the three inference routes used by the PAIR article.

The route shapes and inference semantics follow PAIR-code/ai-explorables
(Copyright 2021 Google LLC, Apache-2.0). This adapter loads local checkpoints
lazily and computes one or more masked positions on the CPU.
"""

import argparse
from functools import lru_cache
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path

import torch
from transformers import BertForMaskedLM, BertTokenizer

MASK = 103
VOCAB = 30522
ROUTES = {"embed", "embed_zari_cda", "embed_group_top"}


def create_server(bert_path, zari_path, port):
    @lru_cache(maxsize=2)
    def load(use_zari):
        path = zari_path if use_zari else bert_path
        tokenizer = BertTokenizer.from_pretrained(path, local_files_only=True)
        model = BertForMaskedLM.from_pretrained(path, local_files_only=True).eval()
        if model.config.vocab_size != VOCAB or tokenizer.mask_token_id != MASK:
            raise RuntimeError("Checkpoint vocabulary does not match the article")
        return model, tokenizer

    @torch.inference_mode()
    def predict(route, data):
        if route == "embed_group_top":
            tokens = data.get("tokens")
            if not isinstance(tokens, list) or not 3 <= len(tokens) <= 128:
                raise ValueError("Enter a sentence with 1–126 wordpieces.")
            if any(type(token) is not int or not 0 <= token < VOCAB for token in tokens):
                raise ValueError("Invalid WordPiece token.")
            model, _ = load(False)
            rows = []
            for start in range(0, len(tokens), 8):
                positions = torch.arange(start, min(start + 8, len(tokens)))
                batch_indices = torch.arange(len(positions))
                batch = torch.tensor(tokens).repeat(len(positions), 1)
                batch[batch_indices, positions] = MASK
                logits = model(input_ids=batch).logits[batch_indices, positions]
                probability = logits.softmax(dim=-1)
                values, indices = logits.topk(90)
                scores = probability.gather(1, indices)
                rows.extend([
                    [{"i": i, "v": v, "p": p} for i, v, p in zip(ii, vv, pp)]
                    for ii, vv, pp in zip(indices.tolist(), values.tolist(), scores.tolist())
                ])
            return rows

        sentence = data.get("sentence")
        if not isinstance(sentence, str) or sentence.count("[MASK]") != 1:
            raise ValueError("Enter a sentence with exactly one blank.")
        model, tokenizer = load(route == "embed_zari_cda")
        tokens = tokenizer.encode(sentence)
        if len(tokens) > model.config.max_position_embeddings:
            raise ValueError("The sentence is too long for this model.")
        position = tokens.index(MASK)
        return model(input_ids=torch.tensor([tokens])).logits[0, position].tolist()

    class Handler(BaseHTTPRequestHandler):
        def send_json(self, status, result):
            payload = json.dumps(result, allow_nan=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

        def do_POST(self):
            route = self.path.removeprefix("/")
            if route not in ROUTES:
                self.send_json(404, {"error": "Unknown route"})
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                if not 1 <= length <= 16384:
                    raise ValueError("Request length is invalid.")
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError("Expected a JSON object.")
                result = predict(route, data)
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            except Exception as exc:
                print(f"Inference failed on {route}: {exc}", flush=True)
                self.send_json(503, {"error": "The local checkpoint is unavailable."})
                return
            self.send_json(200, result)

    return HTTPServer(("127.0.0.1", port), Handler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bert", type=Path, required=True)
    parser.add_argument("--zari", type=Path, required=True)
    parser.add_argument("--port", type=int, default=5004)
    options = parser.parse_args()
    torch.set_num_threads(min(8, os.cpu_count() or 1))
    server = create_server(options.bert, options.zari, options.port)
    print(f"PAIR inference listening on 127.0.0.1:{options.port}", flush=True)
    server.serve_forever()
