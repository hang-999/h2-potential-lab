# MLIP 方法交互实验室 v4

[在线演示](https://hang-999.github.io/h2-potential-lab/) · [源码](https://github.com/hang-999/h2-potential-lab)

面向研究生方法课的交互网站：从原子几何、ACSF 和 SOAP，到消息传递、球谐、张量积及高阶关联。原有 H₂ 势能曲线真实训练实验室完整保留。

## 直接使用与分发

下载根目录 `index.html`，双击在桌面 Chrome / Edge 打开。该文件自包含全部脚本、样式、Three.js、教学内容、H₂ 页面及 Web Worker；不使用 CDN、不请求远程模型，不需要 Node.js、Python、账号或服务器。将该文件发送给别人即可离线演示。

GitHub Pages 提供静态托管；GitHub Actions 运行构建与测试。数值计算和 H₂ 训练由访问者浏览器的本地 CPU 执行，三维绘图通常由本地图形硬件加速。无 WebGL 时使用可操作的 SVG 二维投影。

## 章节

| 入口 | 内容 |
| --- | --- |
| `#/map` | 方法分支地图：表示方式与回归器分开理解 |
| `#/h2` | 原 H₂ v3.1 真实训练、四阶段更新、网络配置、CSV 与配置导出 |
| `#/symmetry` | 邻域、距离、夹角、平移、旋转、反射与同元素编号置换 |
| `#/acsf` | G₂ / G₄ 的真实贡献与元素对应的教学网络 |
| `#/soap` | 高斯邻居密度投影、实球谐、有限基功率谱与环境核 |
| `#/moments` | 低阶矩、内积、张量收缩与线性读出 |
| `#/messages` | 标量边消息、聚合、更新与逐轮感受野 |
| `#/vectors` | 标量＋向量消息、门控与等变性检查 |
| `#/harmonics` | l≤2 球谐、整组分量变换、张量积与奇偶性 |
| `#/mace` | 低阶密度关联、重复邻居索引与独立的消息轮数 |

每章可播放、暂停、逐阶段查看、拖动时间线与重播；回放只读取计算快照。点击“运行本章实验”载入可观察的操作。点击原子、边、条形或贡献表可联动高亮。旋转观察相机与旋转输入坐标是独立操作。

“固定当前为对照”保存构型，SOAP / ACSF / 矩章节可比较后续变化。双栏使用相同参数和箭头显示倍率，倍率只影响显示。新设置格式为 `mlip-methods-config` v1；原 `h2-lab-config` v1 在 H₂ 章节导入。离开 H₂ 会暂停训练，返回后模型与进度保留。

## 科学约定

- H₂ 章节进行真实训练，经验 Morse 数据、单位、归一化及优化器约定沿用 v3.1。
- 新章节的算子与残差真实计算；小型网络固定种子 42，可调系数影响实际输出，但未经量化数据训练。
- 新章节不是完整 BPNN、SchNet、DimeNet、PaiNN、NequIP 或 MACE 的替代实现；正式模型通过官方链接介绍。
- SOAP 使用明确给定的有限基、截断和密度约定，不声称逐分量等同于 DScribe 默认 GTO 配置。
- 潜在向量不是力，原子贡献不是唯一的物理能量分解。对称性章节的力来自明确教学标量势的解析负梯度。

详见 [SCIENCE.md](SCIENCE.md)、[NUMERICS.md](NUMERICS.md) 和 [REFERENCES.md](REFERENCES.md)。图形与教学文字原创，综述 PDF 不在分发包中。

## 编辑与构建

开发使用 Node.js 24 与 npm；浏览器运行成品不需要这些环境。

```sh
npm ci
npm test
npm run build
npm run serve
```

最后一个命令仅用于本机预览，地址为 `http://127.0.0.1:4184`。构建将锁定版本的 Three.js 打包进单文件，之后可断网分发。

- `operators.js`：双精度数值引擎、验证、种子模型与一致性诊断。
- `methods-worker.js`：计算请求合并、版本化快照及错误。
- `scene.js`：三维绘图、原子拖动、相机、标签避让及 SVG 降级。
- `lessons.js`：教学章节、方法卡片及来源。
- `app.js`、`page.html`、`ui.css`：状态、联动图表、导航、时间线与响应式布局。
- `h2/`：独立保留的 H₂ 源码，新增外层切换时的暂停消息。
- `fixtures/reference.json`：独立参考实现产生的固定数值。

`generate-reference.py` 仅供开发者重新生成独立 NumPy 积分参考，不是构建或运行依赖。普通构建直接使用已提交的参考数据。

## 测试与发布

`npm test` 包含新算子、UI 状态合同、Worker 以及原 H₂ 的三项测试。Actions 在 main 推送或 PR 上执行语法、测试与构建；main 全部成功后部署 Pages，产物仅包含生成网页。

旧版保留在 [v3.1 提交记录](https://github.com/hang-999/h2-potential-lab/tree/2597ffbc626e2b3c6dcf7a89e74bb39ee430e232)。本版验收范围见 [VALIDATION.md](VALIDATION.md)。
