const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const readingRoot = path.join(__dirname, 'reading');
const inference = process.argv.includes('--inference');
const inferenceRoutes = new Set(['embed', 'embed_zari_cda', 'embed_group_top']);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const inferenceRoute = pathname.slice('/reading/api/'.length);
  if (pathname.startsWith('/reading/api/') && inferenceRoutes.has(inferenceRoute)) {
    if (!inference || request.method !== 'POST') {
      response.writeHead(404).end();
      return;
    }
    const length = Number(request.headers['content-length']);
    if (!Number.isSafeInteger(length) || length < 1 || length > 16384) {
      response.writeHead(400).end();
      return;
    }
    const upstream = http.request({
      hostname: '127.0.0.1',
      port: 5004,
      path: '/' + inferenceRoute,
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Content-Length': length},
    }, result => {
      response.writeHead(result.statusCode, {'Content-Type': 'application/json'});
      result.pipe(response);
    });
    upstream.once('error', () => response.writeHead(503).end());
    response.once('close', () => { if (!response.writableEnded) upstream.destroy(); });
    request.pipe(upstream);
    return;
  }
  let file = path.join(__dirname, 'index.html');
  if (pathname.startsWith('/reading/')) {
    if (pathname.endsWith('/')) pathname += 'index.html';
    file = path.resolve(readingRoot, pathname.slice('/reading/'.length));
    if (!file.startsWith(readingRoot + path.sep)) {
      response.writeHead(404).end();
      return;
    }
  } else if (pathname !== '/' && pathname !== '/index.html') {
    response.writeHead(404).end();
    return;
  }
  const stream = fs.createReadStream(file);
  stream.once('error', () => response.writeHead(404).end());
  stream.once('open', () => {
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    stream.pipe(response);
  });
});
const port = Number(process.env.MLIP_PREVIEW_PORT || 4185);
server.listen(port, '127.0.0.1', () => console.log(`MLIP Lab: http://127.0.0.1:${port}`));
