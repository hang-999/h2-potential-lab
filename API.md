# Numerical API（v5；原理接口兼容 v4）

本文件前半部分描述原理观察的 `MLIP.compute`；固定种子模型不等于后半部分的真实训练模型。训练设置、物理单位和算法目标详见 [TRAINING.md](TRAINING.md)。

`MLIP.compute(state)` validates and returns a JSON-compatible immutable-by-convention snapshot. All arrays contain ordinary JS numbers. Coordinates are Å; teaching readouts are dimensionless unless explicitly marked eV. Defaults and presets are cloned before editing.

```
{
 version, atoms, center, params,
 geometry:{neighbors:[{index,id,element,r,unit:[3],cutoff}],angles:[{j,k,theta,cos}],edges:[{from,to,r,cutoff}],minDistance},
 acsf:{features:[{label,kind:'radial'|'angular',value,terms:[{indices:[...],value}]}],radial:[number],angular:[number],readout:{hidden:[number],contributions:[number],value}},
 soap:{coefficients:[{species,n,l,m,value}],power:[{label,speciesA,speciesB,n,n2,l,value}],norm,kernel,referencePower:[number],density:[{r,value}],radialBasis:[{r,values:[number]}],convention},
 moments:{s,v:[3],Q:[[3],[3],[3]],invariants:[{label,value}],terms:[{indices:[...],value}],readout},
 messages:{layers:[{round,nodes:[{index,s:[number],v:[[3],...]}],edges:[{from,to,r,filter:[number],message:[number],vectorMessage:[[3],...]}]}],readout:[number],total},
 vectors:{layers:[same as messages],vector:[3],scalar,readout:[number],total},
 harmonics:{direction:[3],groups:[{l,values:[number]}]},
 tensor:{u:[3],v:[3],scalar,axial:[3],symmetric:[[3],[3],[3]],reconstructionError},
 mace:{order,features:[{label,value}],terms:[{indices:[...],value}],readout},
 energy:{value,forces:[[3],...],units:'eV',formula},
 diagnostics:{rotation:{acsf,soap,moments,momentReadout,messageScalar,scalar,vector,tensor,tensorProduct,harmonics,maceReadout,energy,forces},translation:{acsf,soap,energy},permutation:{acsf,soap,energy},reflection:{scalar,vector,tensor,axial,energy,forces}},
 transformed:{atoms,vector:[3],expectedVector:[3],Q:[[3],[3],[3]],expectedQ:[[3],[3],[3]],energy,forces:[[3],...],vectorLayers:[same as vectors.layers],messageLayers:[same as messages.layers],harmonics:{direction,groups},expectedHarmonics:[{l,values}],tensor:{same as tensor},expectedTensor:[[3],[3],[3]]}, warnings:[string]
}
```

`soap.kernel` compares current environment with `state.referenceAtoms` / `referenceCenter` when supplied, otherwise the fixed tetrahedral reference, using the same species/radial basis settings, normalized dot product raised to 2. `soap.referenceAtoms` and `referenceCenter` identify the actual comparison environment. This is a finite-basis Gaussian neighbor-density projection with radial quadrature, not a full GAP predictor. A full species cross-power tensor is retained (including symmetric pairs), avoiding hidden multiplicity weights in the normalized kernel. Power convention is `π sqrt(8/(2l+1)) sum_m c_A c_B`.

`MLIP.presets` keys environment/water/tetrahedron/chain; values arrays of `{id,element,pos}`. `MLIP.defaults` is params. `MLIP.validate(state)` returns a normalized deep clone or throws Error with `.field`. `MLIP.transformAtoms(atoms, transform)` supports axis x/y/z, angle in degrees and reflection across x. `MLIP.math` exposes vector/matrix helpers and realSH. Individual exported functions geometry/acsf/soap/moments/messagePassing/harmonics/tensorProduct/correlations/energyForces allow independent numerical tests. `compute` returns all chapters for one configuration; `stage` is deliberately ignored by numerical computation.

`acsf.readout.model` exposes `{seed:42,inputWeights,biases,outputWeights}` for the selected element's actual four-unit toy MLP. `messages.model` and `vectors.model` expose `{seed:42,embedding,filterCoefficients,readoutCoefficients,weights}`. All fixed initialized coefficients use Mulberry32(42); the four editable multipliers are not training results.

Use `diagnostics.rotation.messageScalar` for the scalar-only message model (the existing `scalar` is the vector model's invariant readout). `tensorProduct` checks the displayed tensor product, while `tensor` checks the moment Q. `harmonics` compares complete direct-evaluated `Y(Ru)` groups against `D(R)Y(u)` computed through a Cartesian representation using `math.rotateSH`; it is not only a norm check. `transformed.vectorLayers` is provided for selected-node/current-round visualization, avoiding mixing a current-stage left panel with a final-stage right panel.

## v5 训练数据与模型接口

三个训练模块均支持浏览器全局对象和 Node CommonJS；浏览器通过内嵌 Worker 顺序加载，不使用网络 import。

`MLIPTrainingData.validate(cfg)` 校验并选取公开配置字段；`generate(cfg)` 返回 `{id,case,rows,normalization:{mu,sigma}}`，每行含 `{id,groupId,atoms,reference,split}`。`reference(atoms,case)` 返回解析 `{value,forces,units,forceUnits}`；`scanSpec(case,axis)` 与 `scanAtoms(case,axis,value)` 定义固定其他自由度的扫描。

`MLIPModels.createModel(cfg)` 用于六种参数模型；SOAP 核单独由训练引擎处理。返回：

```js
{
  parameters, // 可原地更新的 Float64Array；顺序与 names/groups 相同
  names, groups, config,
  prepare(atoms),                 // 缓存几何和固定表示
  fitNormalization(preparedTrain), // 只传训练构型，适用于 ACSF/线性基
  forward(prepared, {trace, gradient}), // {value, gradient?, trace?}
  setParameters(array),
  describe(),                    // 真实参数组、公式、表示路径及范围说明
  basis(prepared)                // 线性模型含常数列的归一化基
}
```

`value` 为归一化结构能量，`gradient` 为该标量对全部参数的导数，不是已经乘入损失项的批次梯度。`trace` 的原子贡献、逐层节点/边、特征与路径来自这次真实前向；不含伪造的训练轨迹。

## v5 训练引擎与事务

`await MLIPTraining.createEngine(cfg, hooks)` 创建引擎。hooks 可包含 `yieldControl()`、`cancelled()` 和 `onProgress({value,message})`。配置默认值与范围见 TRAINING.md。

主要方法：

| 方法 | 行为 |
| --- | --- |
| `await stepOnce()` | 更新一次，保留尾批次；已准备讲解时拒绝直接更新 |
| `await prepareStep()` | 计算候选更新并恢复原状态；返回冻结讲解记录 |
| `commitStep(token)` | 只允许匹配、未提交的 token 应用一次 |
| `cancelStep()` | 丢弃候选，不修改模型／优化器／计数 |
| `save()` / `restore(state)` | 保存恢复参数、优化器、随机流、批次、计数和历史 |
| `await snapshot()` | 当前同一 Step 的完整图表、误差与解释数据 |
| `probe({axis,value})` | 修改扫描探针，清除数据样本选择，不训练 |
| `select({sampleId,paramIndex,atomIndex})` | 选择数据、参数页或原子，不训练 |
| `await force()` | 当前构型的解析参考力和数值预测力 |
| `directSolution()` | SOAP／线性基的只读参考解与实际误差 |
| `csv()` | 当前模型对整个数据集的 CSV |

`prepareStep()` 记录包含 `token,targetStep,batchIds,samples,afterSamples,update,beforeMetrics,afterMetrics,beforeSlice,afterSlice,normalization,method`。samples 与 afterSamples 对应相同构型的更新前后真实前向；SOAP 明细最多8个，batchIds 和目标仍为全部训练数据。

update 中包含旧／新参数、真实批次梯度、Δ参数、学习率、批次物理 MSE，以及优化器一阶/二阶矩。SOAP 另有共轭方向、步长、β、系统残差、更新前后 q 目标，并显式标注其梯度类型。

snapshot 的关键字段：

```js
{
  cfg, datasetId, step, completedEpochs, currentEpoch, stepsPerEpoch,
  parameterCount, finished, normalization, baseline, initial,
  latest: {step,train:{mse,rmse,mae},validation:{mse,rmse,mae}},
  history, lastBatch,
  data: [{id,groupId,atoms,reference,split,prediction}],
  probe: {atoms,axis,value,sampleId,reference,prediction,modelTrace,selectedAtom},
  slice: {axis,label,min,max,value,points:[{x,reference,prediction}]},
  parameterOffset, selectedParameter,
  parameters: [{index,name,group,value,before,after,gradient,delta,m,v}],
  modelTrace, modelDescription, update, force
}
```

parameters 只发送所选参数所在的256项页；`parameterOffset` 标识该页起点，index 始终是全局参数索引。指标单位为 eV/eV²；神经批次梯度基于归一化 MSE。完整历史会均匀抽样显示，但每条记录均为真实评估点。

## Worker 消息与界面版本

请求带 `{type,session,version,...payload}`，session 为方法名，version 在重新初始化时递增。Worker 串行处理所有参数变更，同一时刻只运行一个连续训练会话。

- `init` 携带 cfg；`play,pause,step,prepare,cancel,snapshot,force,direct,export` 无附加必填数据。
- `commit` 携带 token；`speed` 携带每秒更新上限 value。
- `probe` 携带 axis/value，`select` 携带 sampleId/paramIndex/atomIndex；两者使用 `viewRequestId` 标识最新视图意图，待处理同类请求合并。
- 返回类型包括 `progress,ready,snapshot,prepared,committed,direct,export,error`。快照外层重复 session/version，快照内部携带 `running` 与 `viewRequestId`。界面不得用过期配置或过期探针快照覆盖当前状态。
- 普通连续训练最多每500ms发布完整快照；暂停、单步、讲解提交和完成立即发布。动画只读快照，不调用训练更新。

配置文件为 `{schema:'mlip-training-config',version:1,cfg}`。它只保存设置；原理 `mlip-methods-config` 与 H₂ 格式仍独立处理。`#/方法?mode=train` 打开训练模式，原有 hash 路由保持有效。三维视图接口见 [SCENE.md](SCENE.md)。
