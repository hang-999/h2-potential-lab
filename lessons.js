// Original teaching text. Formulas are plain Unicode text, not executable markup.
// Each chapter uses the same live geometry; the stages reveal a computed snapshot.
export const lessons = [
  {
    id: 'symmetry', number: '01', title: '原子环境与对称性', short: '几何与对称性',
    kicker: 'GEOMETRY · THE SHARED LANGUAGE', badge: '真实几何算子',
    question: '旋转同一组原子，哪些数字应该不变，哪些箭头应该一起旋转？',
    intro: '先把相机转动与输入坐标旋转分开。模型读取相对位置与元素，能量不依赖整体位置或朝向；力则随构型变换。',
    experiment: '选择水分子预设，旋转输入 60°，再切换反射。对照左右两种计算次序及下方残差。',
    takeaway: '对称性约束的是变换规律，而不是让所有中间数字都保持不变。',
    controls: ['cutoff'],
    stages: [
      {title: '建立邻域', text: '选中中心原子 i。截断球内的相对向量决定局域环境，连线表示邻域关系，并非化学键判定。', formula: 'rᵢⱼ = xⱼ − xᵢ；N(i) = {j ≠ i : |rᵢⱼ| < r꜀}'},
      {title: '提取几何', text: '距离和夹角由相对向量计算。同元素原子交换编号只会重排求和项，不改变环境含义。', formula: 'rᵢⱼ = |rᵢⱼ|；cos θⱼᵢₖ = r̂ᵢⱼ · r̂ᵢₖ'},
      {title: '变换后重算', text: '对输入实施正交变换 R 和平移 t，重新计算同一算子。相机操作只改变观察方向，不参与这项检验。', formula: 'x′ᵢ = R xᵢ + t；E(X′) = E(X)'},
      {title: '核验输出', text: '比较先变换输入再计算与先计算输出再变换的结果。箭头分为潜在向量和教学能量产生的力。', formula: 'Fᵢ = −∂E/∂xᵢ；F(RX) = R F(X)'}
    ],
    caution: '不变能量模型同样可以通过坐标求导得到等变力。教学能量不是所示分子的量化势能面；潜在向量不是物理力。',
    refs: [
      {label: 'Kim 等：Figure 6，能量不变与力等变', url: 'https://doi.org/10.1021/acs.chemrev.5c00728'},
      {label: 'MolSSI：等变网络课程', url: 'https://molssi-ai.github.io/e3nn-course/book/intro.html'}
    ]
  },
  {
    id: 'acsf', number: '02', title: 'ACSF 与原子神经网络', short: 'ACSF · BPNN',
    kicker: 'HANDCRAFTED FEATURES · LEARNED READOUT', badge: '真实描述符＋教学网络',
    question: '保持中心距离不变，只改变夹角，径向特征能发现这次变化吗？',
    intro: '对称函数把大小不固定的邻域变成定长向量。径向项识别壳层，角向项补充邻居之间的几何关系，再由元素对应的网络读出。',
    experiment: '点击“只改变夹角”，对照 G₂ 与 G₄。点击一个条形，查看它由哪些邻居或三元组共同组成。',
    takeaway: '固定的是特征的数学形式；拟合时学习的是后续网络参数。',
    controls: ['cutoff', 'radial', 'eta', 'rs', 'zeta', 'lambda', 'weights'],
    stages: [
      {title: '平滑截断', text: '邻居靠近边界时贡献逐渐衰减，而不是从一个有限值突然消失。元素通道将不同邻居物种分开。', formula: 'f꜀(r) = ½[cos(πr/r꜀) + 1]，r < r꜀；其余为 0'},
      {title: '径向 G₂', text: '每个高斯窗口对邻居距离打分，再逐项求和。调节中心 Rₛ 和宽度参数 η，观察被强调的距离范围。', formula: 'G²ᵢ = Σⱼ exp[−η(rᵢⱼ − Rₛ)²] f꜀(rᵢⱼ)'},
      {title: '角向 G₄', text: '两个邻居组成一个三元组。数值采用有序求和；展开表将 j,k 与 k,j 合并为一行，保留两份贡献。', formula: 'G⁴ᵢ = 2¹⁻ζ Σⱼ Σₖ≠ⱼ (1 + λ cos θⱼᵢₖ)ζ exp[−η(rᵢⱼ²+rᵢₖ²+rⱼₖ²)] f꜀(rᵢⱼ)f꜀(rᵢₖ)f꜀(rⱼₖ)'},
      {title: '元素网络读出', text: '同一元素的原子共享读出网络。这里只执行固定种子的小型前向网络，显示隐藏激活与求和输出。', formula: 'Gᵢ → NNᶻⁱ(Gᵢ) → εᵢ；E模型 = Σᵢ εᵢ'}
    ],
    caution: 'G₄ 展开表合并对称邻居对，但数值保留完整有序求和。读出网络未经物理数据训练；εᵢ 是模型数学分解。ANI AEV 与本页 G₄ 形式也不完全相同。',
    refs: [
      {label: 'ACSF 原始论文（Behler，2011）', url: 'https://doi.org/10.1063/1.3553717'},
      {label: 'DScribe：ACSF 定义与参数', url: 'https://singroup.github.io/dscribe/latest/tutorials/descriptors/acsf.html'},
      {label: 'TorchANI：ANI 模型实现', url: 'https://github.com/aiqm/torchani'}
    ]
  },
  {
    id: 'soap', number: '03', title: 'SOAP：从邻居密度到相似度', short: 'SOAP · 核方法',
    kicker: 'DENSITY → BASIS → POWER SPECTRUM', badge: '真实截断 SOAP 算子',
    question: '原子云旋转后外形变了，怎样得到不随朝向变化的环境指纹？',
    intro: '先把邻居平滑为高斯密度，再投影到径向基和球谐基。对同一 l 的全部分量作内积，构成旋转不变的功率谱。',
    experiment: '先以四面体为参照，或点击“固定当前为对照”。再拖动一个邻居，观察当前环境与对照的功率谱和核相似度。',
    takeaway: 'SOAP 是一种环境表示；GAP 是可使用这类表示的回归框架，两者不是同一个名称。',
    controls: ['cutoff', 'radial', 'lmax', 'sigma'],
    stages: [
      {title: '邻居高斯密度', text: '每种元素建立独立的密度通道。σ 越大，单个原子的位置被平滑得越宽；绘图云团对应这些高斯项。', formula: 'ρᶻ(r) = Σⱼ:Zⱼ=Z f꜀(rᵢⱼ) exp[−|r − rᵢⱼ|²/(2σ²)]'},
      {title: '有限基展开', text: '实际积分得到 cₙₗₘ。径向基数量控制径向分辨率，lₘₐₓ 控制角向分辨率；两者作用不同。', formula: 'cᶻₙₗₘ = ∫ gₙ(r) Yₗₘ(r̂) ρᶻ(r) d³r'},
      {title: '功率谱收缩', text: '旋转会混合一个 l 内的 m 分量，但整组分量的内积保持不变。跨元素通道也形成相关项；本页保留完整对称条目。', formula: 'pᶻᶻ′ₙₙ′ₗ = π√[8/(2l+1)] Σₘ cᶻₙₗₘ cᶻ′ₙ′ₗₘ'},
      {title: '核相似度', text: '功率谱采用连续正则化归一化，再作内积，使用固定 ξ=2。空邻域平滑趋于零；非空相同环境的核接近1。默认参照是四面体，也可固定当前构型替换；两边使用相同参数重算。', formula: 'p̃ = p / √(‖p‖²+ε²)；Kε(A,B) = (p̃ᴬ·p̃ᴮ)²；ε=10⁻⁸'}
    ],
    caution: '本页使用明确限定的径向基、截断和归一化约定，不保证与 DScribe 默认参数逐项同值。核相似度不是已经训练完成的 GAP 能量预测。',
    refs: [
      {label: 'SOAP 原始论文（Bartók 等，2013）', url: 'https://doi.org/10.1103/PhysRevB.87.184115'},
      {label: 'DScribe：SOAP 密度、展开与核', url: 'https://singroup.github.io/dscribe/latest/tutorials/descriptors/soap.html'},
      {label: 'GAP 官方文档', url: 'https://libatoms.github.io/GAP/'}
    ]
  },
  {
    id: 'moments', number: '04', title: '多体基与线性读出', short: 'MTP · ACE 思想',
    kicker: 'SUM FIRST · COUPLE SECOND', badge: '真实低阶矩与收缩',
    question: '一个对参数线性的模型，为什么也能表达复杂的角度关系？',
    intro: '复杂性可以放进基函数，而不只放进回归器。邻居贡献先聚合为标量、向量和张量，再通过收缩形成不变量。',
    experiment: '展开 v·v 的求和表，选择一项 j、k。观察一对邻居的夹角如何进入一个最终标量。',
    takeaway: '线性读出 E = Σ cαBα 中，Bα 仍可对原子坐标高度非线性。',
    controls: ['cutoff', 'radial', 'weights'],
    stages: [
      {title: '单邻居基', text: '每条中心—邻居方向使用 fⱼ=f꜀(rⱼ)exp(−rⱼ²/2)。方向保留在向量和张量中，而不是立即被压成距离。', formula: 's = Σⱼ fⱼ；v = Σⱼ fⱼ r̂ⱼ；Q = Σⱼ fⱼ(r̂ⱼr̂ⱼᵀ − I/3)'},
      {title: '聚合为矩', text: '逐个邻居相加得到环境的低阶矩。旋转时，s 不变，v 旋转，Q 的两个指标同时变换。', formula: 's′ = s；v′ = Rv；Q′ = RQRᵀ'},
      {title: '收缩出不变量', text: '把指标配对求和。展开后出现 j、k 的双重求和，从而包含两个邻居之间的夹角信息。', formula: 'v·v = Σⱼₖ fⱼfₖ(r̂ⱼ·r̂ₖ)；Q:Q = tr(QᵀQ)'},
      {title: '线性组合', text: '四个读出系数分别作用于 s、v·v、tr(Q²)、tr(Q³)。改变系数会改变输出；旋转构型仍不改变每个不变量。', formula: 'E教学 = c₀s + c₁(v·v) + c₂tr(Q²) + c₃tr(Q³)'}
    ],
    caution: '本页演示低阶矩与收缩，不是完整 MTP 或 ACE 基库。相关阶数、涉及不同原子的最高体阶和非线性模型的有效体阶必须区分。',
    refs: [
      {label: 'MTP：Shapeev（2016）', url: 'https://doi.org/10.1137/15M1054183'},
      {label: 'ACE：Drautz（2019）', url: 'https://doi.org/10.1103/PhysRevB.99.014104'},
      {label: 'Kim 等：线性模型分支', url: 'https://doi.org/10.1021/acs.chemrev.5c00728'}
    ]
  },
  {
    id: 'messages', number: '05', title: '不变消息传递', short: 'SchNet · 角度消息',
    kicker: 'EDGES SEND · NODES AGGREGATE', badge: '教学模型／未经训练',
    question: '第二轮消息到来后，中心原子能接收到哪些更远处的信息？',
    intro: '节点保存标量特征，边根据相对几何生成消息。邻居求和消除编号顺序的影响，多轮交互逐步扩大图上的可达范围。',
    experiment: '使用原子链预设，选择一端，逐轮推进。再打开角度项，比较相同输入上消息数值的改变。',
    takeaway: '“可学习表示”仍有人工设计的距离基、截断和聚合规则；学习不等于取消这些结构。',
    controls: ['cutoff', 'radial', 'channels', 'rounds', 'angleMessages', 'weights'],
    stages: [
      {title: '初始化节点', text: '将元素类型映射到固定种子产生的小型标量向量。本演示可改权重，但没有用物理数据训练这些通道。', formula: 'hᵢ⁽⁰⁾ = embedding(Zᵢ)'},
      {title: '沿边构造消息', text: '距离基产生连续滤波，再与邻居特征组合。开启角度项后，消息还读取相邻边之间的夹角。', formula: 'mⱼ→ᵢ⁽ᵗ⁾ = φ(hⱼ⁽ᵗ⁾, rᵢⱼ [, cos θ])'},
      {title: '邻居求和', text: '查看每条边的贡献，然后按通道相加。同元素重编号只重排消息列表，不改变聚合结果。', formula: 'Mᵢ⁽ᵗ⁾ = Σⱼ∈N(i) mⱼ→ᵢ⁽ᵗ⁾'},
      {title: '更新并读出', text: '节点用聚合结果更新自身特征，再进入下一轮或标量读出。高亮区域是图上的可达范围，不代表任意远程作用已被解决。', formula: 'hᵢ⁽ᵗ⁺¹⁾ = update(hᵢ⁽ᵗ⁾, Mᵢ⁽ᵗ⁾)；E = Σᵢ readout(hᵢ⁽ᵀ⁾)'}
    ],
    caution: '这是受 SchNet／DimeNet 启发的小型算子，不是完整模型复现。“径向相同而角度不同”的反例只针对中心星形图的一轮径向聚合，不能推广为所有距离型 GNN 都无角度信息。',
    refs: [
      {label: 'SchNetPack 官方实现', url: 'https://github.com/atomistic-machine-learning/schnetpack'},
      {label: 'DimeNet 官方实现', url: 'https://github.com/gasteigerjo/dimenet'},
      {label: 'Distill：消息、聚合与感受野', url: 'https://distill.pub/2021/gnn-intro/'}
    ]
  },
  {
    id: 'vectors', number: '06', title: '让方向进入隐藏特征', short: 'PaiNN 思想',
    kicker: 'SCALAR + VECTOR · EQUIVARIANT BY DESIGN', badge: '教学模型／未经训练',
    question: '不用把每个方向都放进训练集，能否让内部箭头自动跟随旋转？',
    intro: '同时维护标量通道和向量通道。标量门控可以缩放向量，内积可以把方向关联变成标量；这些运算保持规定的变换规律。',
    experiment: '切换旋转轴并连续调整角度。比较左侧输出旋转后的参考箭头与右侧重新计算的箭头，检查差值。',
    takeaway: '等变性来自运算结构；训练改变可学习系数，并不负责学会坐标系变换法则。',
    controls: ['cutoff', 'radial', 'channels', 'rounds', 'weights'],
    stages: [
      {title: '分开特征类型', text: '一个标量通道是一组不随朝向改变的数；一个向量通道是一支具有三个坐标分量的箭头。', formula: 's′ᵢ = sᵢ；v′ᵢ = Rvᵢ'},
      {title: '沿方向传递', text: '从边方向生成向量消息，并与已有向量通道组合。所有混合系数都是旋转不变的标量。', formula: 'mᵥ,ⱼ→ᵢ = αᵢⱼ vⱼ + βᵢⱼ r̂ᵢⱼ'},
      {title: '门控与不变读出', text: '标量门控制方向特征的幅度；向量内积和范数进入标量分支。不要对向量的 x/y/z 分量分别施加普通 tanh。', formula: 'v新 = g(s) v；v·v = ‖v‖²；E = readout(s, ‖v‖²)'},
      {title: '交换计算次序', text: '对同一权重分别执行两条路径，直接测量等变残差。只旋转相机不会产生这项数值实验。', formula: 'εᵥ = ‖v(RX) − Rv(X)‖；εᴱ = |E(RX) − E(X)|'}
    ],
    caution: '箭头是隐藏向量特征，没有 eV/Å 单位。等变向量不自动是守恒力；物理力需要与能量梯度一致或有明确的输出定义。',
    refs: [
      {label: 'PaiNN 原始论文（ICML 2021）', url: 'https://proceedings.mlr.press/v139/schutt21a.html'},
      {label: 'SchNetPack：PaiNN 实现', url: 'https://github.com/atomistic-machine-learning/schnetpack'},
      {label: 'Kim 等：不变与等变 GNN', url: 'https://doi.org/10.1021/acs.chemrev.5c00728'}
    ]
  },
  {
    id: 'harmonics', number: '07', title: '球谐、表示类型与张量积', short: 'NequIP 思想',
    kicker: 'IRREPS · ROTATION MIXES COMPONENTS', badge: '真实球谐与张量算子',
    question: '一个方向怎样变成 1、3、5 个分量？旋转时为什么必须一起看整组分量？',
    intro: '球谐把边方向编码为不同阶的表示。l=0、1、2 分别包含 1、3、5 个分量；张量积在表示之间建立符合对称性的耦合。',
    experiment: '先选 l=1，再选 l=2；连续旋转输入，观察同一组分量相互混合，而组内范数保持不变。',
    takeaway: 'l 指定旋转表示，不是邻居数、消息轮数或势的体阶。',
    controls: ['cutoff', 'lmax'],
    stages: [
      {title: '方向到球谐', text: '从选中边的单位方向计算实球谐。瓣面的半径表示绝对值，颜色表示正负；它不是电子轨道密度。', formula: 'r̂ ↦ Y⁽ˡ⁾(r̂) = [Yₗ,₋ₗ, …, Yₗ,ₗ]'},
      {title: '整组一起变换', text: '旋转会混合同一 l 的 m 分量，而不会把 l=1 变为 l=2。单个分量一般不保持不变。', formula: 'Y⁽ˡ⁾(Rr̂) = D⁽ˡ⁾(R) Y⁽ˡ⁾(r̂)；dim = 2l + 1'},
      {title: '向量张量积', text: '两支极向量的乘积可分成标量、轴向量和对称无迹张量：分别对应内积、叉积和去迹对称积。', formula: '1ₒ ⊗ 1ₒ = 0ₑ ⊕ 1ₑ ⊕ 2ₑ'},
      {title: '检查奇偶性', text: '在反射下，极向量与轴向量的变换规律不同。叉积应额外乘 det(R)，不能把它当成普通位移向量。', formula: '(Ru) × (Rv) = det(R) R(u × v)'},
      {title: '耦合为消息', text: '径向标量系数对允许的耦合路径加权，再聚合为节点特征。NequIP 使用此类等变构件构建完整网络。', formula: 'mᵢ = Σⱼ W(rᵢⱼ) [hⱼ ⊗ Y(r̂ᵢⱼ)]；最终能量读出为 0ₑ'}
    ],
    caution: '本页只实现 l≤2 的核心算子，不加载完整 NequIP 模型。球谐基的符号和分量顺序依约定而定，测试与绘图使用同一套约定。',
    refs: [
      {label: 'e3nn：张量积与类型', url: 'https://docs.e3nn.org/en/latest/api/o3/o3_tp.html'},
      {label: 'MolSSI：球谐交互课程', url: 'https://molssi-ai.github.io/e3nn-course/notebooks/02b_spherical_harmonics.html'},
      {label: 'NequIP 官方实现', url: 'https://github.com/mir-group/nequip'}
    ]
  },
  {
    id: 'mace', number: '08', title: '高阶关联进入消息', short: 'MACE 思想',
    kicker: 'CORRELATION ORDER ≠ MESSAGE DEPTH', badge: '真实低阶关联／教学简化',
    question: '一条消息能否同时包含多个邻居的几何关系，而不只增加消息轮数？',
    intro: '先聚合邻居的基展开，再对聚合特征做乘积与耦合。展开这些乘积，会出现多个邻居索引的关联；这是连接 ACE 与高阶等变消息的关键。',
    experiment: '保持消息轮数不变，将关联阶数从 1 改为 2、3。逐项选中贡献，查看同时参与的邻居组合。',
    takeaway: '关联阶数决定一次构造里组合多少份邻居信息，消息轮数决定信息传播多少轮。',
    controls: ['cutoff', 'radial', 'lmax', 'channels', 'rounds', 'correlation', 'weights'],
    stages: [
      {title: '聚合邻居密度', text: '一般形式先求和得到 A。本页选取其低阶笛卡尔形式 s、v、Q 演示，再做真实乘积与收缩。', formula: 'Aᵢ,ₙₗₘ = Σⱼ fₙ(rᵢⱼ) Yₗₘ(r̂ᵢⱼ)；本页低阶实例：s、v、Q'},
      {title: '构造二次关联', text: '本页用 v·v 展示二次收缩，展开后包含 j=k 的自项。点击一项，可看到两份邻居信息如何共同进入结果。', formula: 'v·v = Σⱼₖ fⱼfₖ(r̂ⱼ·r̂ₖ)'},
      {title: '扩展到三次', text: '本页用 vᵀQv 展示三次收缩。三重求和中可有重复索引，因此不能把所有项都称为严格四体项。', formula: 'vᵀQv = Σⱼₖₗ fⱼfₖfₗ[(r̂ⱼ·r̂ₗ)(r̂ₗ·r̂ₖ) − (r̂ⱼ·r̂ₖ)/3]'},
      {title: '耦合与读出', text: '选择符合表示类型的收缩或耦合，再进入消息和标量读出。实际 MACE 包含更完整的基、通道混合与层间结构。', formula: 'B⁽ν⁾ = Couple(A ⊗ … ⊗ A)；m = Σν wν B⁽ν⁾'},
      {title: '独立比较两个尺度', text: '分别调节关联阶数 ν 和消息轮数 T，观察组合数与图上可达范围。两者不会自动解决截断外的任意长程作用。', formula: 'ν：一次关联的因子数；T：消息更新轮数；l：旋转表示阶数'}
    ],
    caution: '本页是低阶密度关联和张量收缩实验，不是完整 MACE 推理。MACE 的关联阶数可配置；原始密度自项、非线性和多层交互都会影响有效体阶。',
    refs: [
      {label: 'MACE 官方文档', url: 'https://mace-docs.readthedocs.io/en/latest/'},
      {label: 'MACE 官方实现', url: 'https://github.com/ACEsuit/mace'},
      {label: 'Kalita 等：Figure 2 方法主线', url: 'https://doi.org/10.1038/s43588-025-00930-6'}
    ]
  }
];

export const methodCards = [
  {name: 'GAP', family: '固定表示 · 核回归', chapter: 'soap', description: '用环境核度量相似度，再进行高斯过程回归。SOAP 是可选表示；本实验只计算描述符与核，不加载 GAP 模型。', url: 'https://github.com/libAtoms/GAP'},
  {name: 'ANI', family: '固定表示 · 原子神经网络', chapter: 'acsf', description: '原子环境向量 AEV 连接元素对应的神经网络。TorchANI 提供 ANI 系列实现；本页 G₄ 不是 ANI AEV 的逐项复刻。', url: 'https://github.com/aiqm/torchani'},
  {name: 'SNAP', family: '多体基 · 回归读出', chapter: 'moments', description: '用邻居密度的双谱描述环境。基本线性 SNAP 对双谱系数作加权和，亦有扩展形式；此处不将普通矩收缩称为 SNAP。', url: 'https://docs.lammps.org/stable/pair_snap.html'},
  {name: 'DeePMD', family: '可学习局域表示', chapter: 'messages', description: 'Deep Potential 的软件生态包含多种描述符和模型版本。应按具体架构理解其局域表示，不能只用一个“固定描述符”标签概括。', url: 'https://github.com/deepmodeling/deepmd-kit'},
  {name: 'HIP-NN', family: '可学习交互 · 层级读出', chapter: 'messages', description: '通过交互层形成原子特征，并组织层级能量读出。HIPPYNN 是其相关原子机器学习实现。', url: 'https://github.com/lanl/hippynn'},
  {name: 'GemNet', family: '方向几何 · 消息传递', chapter: 'messages', description: '利用方向与几何关系构造消息。这里用角度消息解释动机，完整架构、方向嵌入和输出设置以作者实现为准。', url: 'https://github.com/TUM-DAML/gemnet_pytorch'},
  {name: 'Allegro', family: '等变局域边表示', chapter: 'harmonics', description: '围绕局域边环境构造等变特征，强调严格局域计算。不能把其层数画成普通节点 GNN 的逐跳感受野扩张。', url: 'https://github.com/mir-group/allegro'}
];

export const resources = [
  {name: 'Distill · GNN Introduction', url: 'https://distill.pub/2021/gnn-intro/', use: '参考节点选择、聚合过程与感受野的交互组织；本网站图文原创。'},
  {name: 'MolSSI · e3nn Course', url: 'https://github.com/molssi-ai/e3nn-course', use: '参考表示类型、球谐、张量积及数值等变性检验。'},
  {name: 'Three.js', url: 'https://github.com/mrdoob/three.js', use: '实际使用的三维绘图库，随页面本地打包；MIT 许可。'},
  {name: 'D3', url: 'https://github.com/d3/d3', use: '参考清晰比例尺与联动图表；图表采用原生 SVG。'},
  {name: 'Motion', url: 'https://github.com/motiondivision/motion', use: '参考界面过渡节奏；未引入 Motion+ 或其他付费示例。'},
  {name: 'Manim Community', url: 'https://github.com/ManimCommunity/manim', use: '参考公式与几何对象逐项对应的讲解方式；无需 Python 播放。'},
  {name: 'Remotion', url: 'https://github.com/remotion-dev/remotion', use: '参考可复现阶段与时间线；本版是可交互网站，无视频运行依赖。'}
];
