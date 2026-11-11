# 交互阅读馆

从实验室顶部进入「交互阅读馆」，选择中文或 English。两个版本共享同一套图表代码、示例数据及模型输入。英文保留作者正文。中文翻译正文、标题和图注，保留引用键、公式和图形；英文例句、词元、候选词及部分原图标签保留原样。

## 来源

- **A Gentle Introduction to Graph Neural Networks**，Benjamin Sanchez-Lengeling、Emily Reif、Adam Pearce、Alexander B. Wiltschko，Distill 2021，DOI 10.23915/distill.00033。原文规定正文及原创图示为 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，第三方素材以原文说明为准。原图表代码来自 Apache 2.0 仓库。 [原文](https://distill.pub/2021/gnn-intro/) · [源码](https://github.com/distillpub/post--gnn-intro)
- **What Have Language Models Learned?**，Adam Pearce，Google PAIR，VISxAI 2021。正文、图表代码与预置预测来自 Apache 2.0 源码项目。中文为本项目译本，复用图表与预置模型结果。 [原文](https://pair.withgoogle.com/explorables/fill-in-the-blank/) · [源码与许可](https://github.com/PAIR-code/ai-explorables)

图表所在目录保留上游许可证。文章增加了返回实验室与语言切换导航。Distill 使用原模板、原始图表组件和公开的预训练模型数据；PAIR 使用原词元、散点图、时间趋势与多图联动。PAIR 另有本地推理适配器和请求失败提示。

## 预览

在实验室目录执行 `npm ci`、`npm run build`、`npm run serve`，打开 `http://127.0.0.1:4185/#/reading`。阅读馆需将 `reading/` 和根目录 `index.html` 一起提供。实验室原有章节仍可双击单文件运行。

Distill 的 Vega 图表和公式依赖作者页面引用的库，分子实验台从作者的公开存储加载模型。PAIR 预置图表读取随项目提供的数据。作者的实时推理端点在 2026-11-10 的测试中返回了 HTTP 500；本地推理用于继续操作自定义例句。

## 使用原模型推理

1. 用 Python 3.11 建立独立环境，安装 CPU PyTorch 2.7.1、Transformers 4.57.6 和 safetensors 0.6.2。
2. 准备两个 Hugging Face 格式的目录，各含 `config.json`、`vocab.txt` 和权重。BERT 使用 [Google BERT Large Whole Word Masking](https://huggingface.co/google-bert/bert-large-uncased-whole-word-masking) 的 `model.safetensors`。Zari 使用 PAIR 作者发布的 [Zari-CDA PyTorch 权重](https://storage.googleapis.com/uncertainty-over-space/zari-bert-cda/pytorch_model.bin) 和 [PAIR 仓库内的配置、词表](https://github.com/PAIR-code/ai-explorables/tree/master/server-side/fill-in-the-blank/py/zari-bert-cda)。两份权重各约 1.35 GB。
3. 启动推理端口 `python reading-src/bert_server.py --bert <BERT目录> --zari <Zari目录>`。另一终端启动 `npm run serve -- --inference`，再从阅读馆打开 PAIR 文章。

本地模式只监听回环地址。对于未命中预置数据的输入，预览服务器把请求交给本地 CPU 推理。两种检查点按需加载。GitHub Pages 提供静态页面和缓存数据。

如果已有 `models/bert` 与 `models/zari`，可用 `python reading-src/bert_server.py --bert models/bert --zari models/zari` 直接启动。已核对的 BERT SHA256 为 `bb1bf5b4d26dd5febdfb61ad411d87f03a4fe0f8eb0bcf6fba10cc81ee2b3ea2`，Zari MD5 为 `0f82cc31296ab265ccb8aa0e26493204`。备用地理对照及 BERT／Zari 切换所需的 12 个 BERT 结果，由此原始检查点实际计算后缓存。

## 编辑和核验

Distill 中译正文位于 `gnn-zh.txt`，每行对应原文一个正文块。执行 `node build-reading.cjs --list-gnn` 可查看顺序；附录位于 `gnn-appendix-zh.html`。PAIR 中译正文位于 `pair-zh.html`。构建保留原图表挂载点和脚本，`node test-reading.cjs` 核验两种语言共享的资源、锚点、引文和图形位置。
