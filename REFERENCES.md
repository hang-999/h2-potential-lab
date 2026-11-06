# 文献、软件与设计来源

本项目的图形、文字和交互由本项目重新组织与绘制。未随网站分发用户提供的 PDF，也未复制其中的授权插图。下列项目中，仅 Three.js 作为新增浏览器运行库；其他项目用于概念核对、教学设计或延伸阅读。具体捆绑版本及许可证见分发文件中的第三方许可说明。

## 两篇综述

1. Kalita, Gokcan & Isayev. *Machine learning interatomic potentials at the centennial crossroads of quantum mechanics*. Nature Computational Science **5**, 1120–1132 (2025). [DOI](https://doi.org/10.1038/s43588-025-00930-6)。
   - PDF 第 2–3 页（刊页 1121–1122）：固定描述符、学习表示与等变 NNP。
   - PDF 第 4 页（刊页 1123），Figure 2：ANI/BP、HIP-NN、SchNet、NequIP、MACE 的计算管线。
   - PDF 第 6–8 页（刊页 1125–1127）：物理约束、可解释性与数据覆盖问题。
2. Kim, J., Cho, H., Jeon, H., Jung, J. & Han, S. *Reactive Machine Learning Interatomic Potentials for Chemistry and Materials Science*. Chemical Reviews **126**, 4467–4510 (2026). [DOI](https://doi.org/10.1021/acs.chemrev.5c00728)。
   - PDF 第 3 页（刊页 4469），Table 1：核、线性、神经网络和图网络方法分类。
   - PDF 第 6 页（刊页 4472），Figure 3：原子描述符与神经网络。
   - PDF 第 8 页（刊页 4474），Figure 4：消息传递及图上的感受野。
   - PDF 第 9 页（刊页 4475），Figure 6：能量不变性和向量的等变变换。
   - PDF 第 11–12 页（刊页 4477–4478）：成本与精度的任务相关权衡。

## 数学与方法定义

- Behler. Atom-centered symmetry functions for constructing high-dimensional neural network potentials. J. Chem. Phys. **134**, 074106 (2011). [DOI](https://doi.org/10.1063/1.3553717)；[DScribe ACSF 文档](https://singroup.github.io/dscribe/latest/tutorials/descriptors/acsf.html)。
- Bartók, Kondor & Csányi. On representing chemical environments. Phys. Rev. B **87**, 184115 (2013). [DOI](https://doi.org/10.1103/PhysRevB.87.184115)；[DScribe SOAP 文档](https://singroup.github.io/dscribe/latest/tutorials/descriptors/soap.html)。
- Shapeev. Moment Tensor Potentials: A Class of Systematically Improvable Interatomic Potentials. Multiscale Model. Simul. **14**, 1153–1173 (2016). [DOI](https://doi.org/10.1137/15M1054183)。
- Drautz. Atomic cluster expansion for accurate and transferable interatomic potentials. Phys. Rev. B **99**, 014104 (2019). [DOI](https://doi.org/10.1103/PhysRevB.99.014104)。
- Schütt, Unke & Gastegger. Equivariant Message Passing for the Prediction of Tensorial Properties and Molecular Spectra. ICML (2021). [论文](https://proceedings.mlr.press/v139/schutt21a.html)。
- [e3nn 张量积文档](https://docs.e3nn.org/en/latest/api/o3/o3_tp.html)：表示类型、张量积与允许的耦合路径。
- [MolSSI e3nn 课程](https://molssi-ai.github.io/e3nn-course/book/intro.html)：球谐、表示、等变卷积的教学与检验。

## 真实模型和软件入口

| 方法 | 官方项目或开发者文档 |
| --- | --- |
| GAP | [libAtoms/GAP](https://github.com/libAtoms/GAP)、[文档](https://libatoms.github.io/GAP/) |
| ANI | [aiqm/torchani](https://github.com/aiqm/torchani) |
| SNAP | [LAMMPS SNAP](https://docs.lammps.org/stable/pair_snap.html) |
| DeePMD | [deepmodeling/deepmd-kit](https://github.com/deepmodeling/deepmd-kit) |
| HIP-NN | [lanl/hippynn](https://github.com/lanl/hippynn) |
| SchNet / PaiNN | [SchNetPack](https://github.com/atomistic-machine-learning/schnetpack) |
| DimeNet | [gasteigerjo/dimenet](https://github.com/gasteigerjo/dimenet) |
| GemNet | [TUM-DAML/gemnet_pytorch](https://github.com/TUM-DAML/gemnet_pytorch) |
| NequIP | [mir-group/nequip](https://github.com/mir-group/nequip) |
| Allegro | [mir-group/allegro](https://github.com/mir-group/allegro) |
| MACE | [ACEsuit/mace](https://github.com/ACEsuit/mace)、[文档](https://mace-docs.readthedocs.io/en/latest/) |

这些外链用于查看完整科学模型，不会在网页运行时下载其代码或权重。它们不是本项目的性能测试对象。

## 交互与动画设计参考

| 来源 | 本项目采用的思路 | 使用边界 |
| --- | --- | --- |
| [Distill GNN Introduction](https://distill.pub/2021/gnn-intro/) / [源码](https://github.com/distillpub/post--gnn-intro) | 悬停对象、逐层感受野、计算与解释邻近 | 原创图文重绘；未直接复用 CC-BY 文章素材 |
| [MolSSI e3nn Course](https://github.com/molssi-ai/e3nn-course) | 球谐、张量积、等变性直接检验 | 参考数学与教学安排，非 Python 网页运行依赖 |
| [Three.js](https://github.com/mrdoob/three.js) | 原子环境、向量、曲面、镜头交互 | MIT；实际打包，保留许可 |
| [D3](https://github.com/d3/d3) | 数值图表的比例尺和联动 | 本版图表由原生 SVG 绘制，未打包 D3 |
| [Motion](https://github.com/motiondivision/motion) | 控件与对象之间的连续过渡 | 不采用商业 Motion+ 资源，不打包此库 |
| [Manim Community](https://github.com/ManimCommunity/manim) | 数学对象逐项出现与几何对应 | 只参考讲解方式，不生成或播放预渲染视频 |
| [Remotion](https://github.com/remotion-dev/remotion) | 状态可复现的阶段时间线 | 未打包；其专门许可不应被误称为 MIT |

链接核对日期：2026-11-06。方法页面可能更新；本项目的具体算子、数值约定与测试以随附源码和 `SCIENCE.md` 为准。
