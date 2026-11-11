/* Numerical core shared verbatim by the offline Worker and Node verification. */
/** @typedef {{trainingTarget:'energy'|'energy-force',forceWeight:number,hiddenLayers:number[],activations:string[]}} H2TrainingConfig */
const H2Defaults = Object.freeze({hiddenLayers:[32,32],activations:['tanh','tanh'],initialization:'auto',seed:42,optimizer:'adam',lr:.01,schedule:'cosine',endFactor:.02,momentum:.9,beta1:.9,beta2:.999,n:80,batch:8,epochs:500,validationRatio:.2,split:'interval',sampling:'uniform',rMin:.3,rMax:3,trainingTarget:'energy',forceWeight:1});
function validateH2Config(input={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('配置必须是 JSON 对象。');
  if(!Array.isArray(input.hiddenLayers??H2Defaults.hiddenLayers)||!Array.isArray(input.activations??[]))throw new Error('网络层和激活函数必须为数组。');
  const hidden=input.hiddenLayers??H2Defaults.hiddenLayers;
  const c={...H2Defaults,...input,hiddenLayers:[...hidden],activations:[...(input.activations??hidden.map(()=> 'tanh'))]};
  const fail=(field,message)=>{const e=new Error(message);e.field=field;throw e;};
  const num=(key,min,max,integer=false)=>{if(typeof c[key]!=='number'||!Number.isFinite(c[key])||c[key]<min||c[key]>max||(integer&&!Number.isInteger(c[key])))fail(key,`${key} 必须为 ${min}–${max} 范围内的${integer?'整数':'数值'}。`);};
  if(!Array.isArray(input.hiddenLayers??H2Defaults.hiddenLayers)||c.hiddenLayers.length>4||c.hiddenLayers.some(n=>!Number.isInteger(n)||n<1||n>64))fail('hiddenLayers','隐藏层为 0–4 层，每层 1–64 个神经元。');
  if(c.activations.length!==c.hiddenLayers.length||c.activations.some(a=>!['tanh','relu','leaky','sigmoid','softplus'].includes(a)))fail('activations','请为每个隐藏层选择有效的激活函数。');
  if(!['energy','energy-force'].includes(c.trainingTarget))fail('trainingTarget','训练目标必须为仅能量或能量＋力。');
  num('forceWeight',0,10);
  if(c.trainingTarget==='energy-force'&&c.activations.some(a=>a==='relu'||a==='leaky'))fail('activations','联合训练请使用 tanh、sigmoid 或 Softplus；ReLU 系列可用于仅能量训练与力曲线观察。');
  const enums={initialization:['auto','xavier','he','zero'],optimizer:['adam','sgd','momentum'],schedule:['constant','cosine'],split:['interval','random'],sampling:['uniform','stratified','well']};
  for(const [k,choices]of Object.entries(enums))if(!choices.includes(c[k]))fail(k,`${k} 选项无效。`);
  num('seed',0,4294967295,true);num('n',20,400,true);if(c.n%5)fail('n','样本数须为 5 的倍数。');
  num('validationRatio',.1,.4);if(Math.abs(c.validationRatio/.05-Math.round(c.validationRatio/.05))>1e-8)fail('validationRatio','验证比例步长为 5%。');
  num('batch',1,c.n-Math.round(c.n*c.validationRatio),true);num('epochs',1,2000,true);num('lr',.0001,.1);num('endFactor',.01,1);num('momentum',0,.99);num('beta1',0,.99);num('beta2',.9,.9999);num('rMin',.3,3);num('rMax',.3,3);
  if(c.rMax-c.rMin<.2-1e-10)fail('rMax','采样区间宽度至少为 0.20 Å。');
  return Object.fromEntries(Object.keys(H2Defaults).map(k=>[k,c[k]]));
}
// The outer laboratory imports this script to reuse exactly the same config validator.
globalThis.H2Config=Object.freeze({defaults:H2Defaults,validate:validateH2Config});
function h2Sigmoid(z){return z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));}
function h2Activation(name,z) {if(name==='tanh')return Math.tanh(z);if(name==='relu')return Math.max(0,z);if(name==='leaky')return z>=0?z:.01*z;if(name==='softplus')return Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z)));return h2Sigmoid(z);}
function h2Derivative(name,z,a) {return name==='tanh'?1-a*a:name==='relu'?(z>0?1:0):name==='leaky'?(z>=0?1:.01):name==='softplus'?h2Sigmoid(z):a*(1-a);}
function h2SecondDerivative(name,z,a){if(name==='tanh')return -2*a*(1-a*a);if(name==='sigmoid')return a*(1-a)*(1-2*a);if(name==='softplus'){const s=h2Sigmoid(z);return s*(1-s);}return 0;}
function createEngine(options={}) {
  const cfg=validateH2Config(options),sizes=[1,...cfg.hiddenLayers,1],last=sizes.length-1,forceWeight=cfg.trainingTarget==='energy-force'?cfg.forceWeight:0;
  const randomStream=start=>{let state=start>>>0;return{next(){state+=0x6D2B79F5;state>>>=0;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;},get:()=>state,set:s=>{state=s>>>0;}};};
  // Independent streams: architecture never changes data, split or epoch order.
  const initRng=randomStream(cfg.seed),dataRng=randomStream((cfg.seed^0x85ebca6b)>>>0),shuffleRng=randomStream((cfg.seed^0xc2b2ae35)>>>0);
  const shuffle=(arr,rng=shuffleRng)=>{for(let i=arr.length-1;i>0;i--){const j=Math.floor(rng.next()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;};
  const morse=r=>4.748*(1-Math.exp(-1.944*(r-.7417)))**2-4.748;
  const morseForce=r=>{const q=Math.exp(-1.944*(r-.7417));return -2*4.748*1.944*q*(1-q);};
  const warning=cfg.sampling==='well'&&(Math.min(1.25,cfg.rMax)<=Math.max(.45,cfg.rMin))?'势阱区与采样区间无交集，本次退回等距采样。':'';
  let positions;
  if(cfg.sampling==='uniform'||warning)positions=Array.from({length:cfg.n},(_,i)=>cfg.rMin+(cfg.rMax-cfg.rMin)*i/(cfg.n-1));
  else {
    const interior=cfg.n-2,span=cfg.rMax-cfg.rMin;
    if(cfg.sampling==='stratified')positions=Array.from({length:interior},(_,i)=>cfg.rMin+span*(i+dataRng.next())/interior);
    else {const k=Math.round(interior*.6),lo=Math.max(.45,cfg.rMin),hi=Math.min(1.25,cfg.rMax);positions=[...Array.from({length:k},(_,i)=>lo+(hi-lo)*(i+dataRng.next())/k),...Array.from({length:interior-k},(_,i)=>cfg.rMin+span*(i+dataRng.next())/(interior-k))];}
    positions.push(cfg.rMin,cfg.rMax);positions.sort((a,b)=>a-b);
  }
  const valCount=Math.round(cfg.n*cfg.validationRatio),validationIds=new Set(cfg.split==='random'?shuffle(Array.from({length:cfg.n},(_,i)=>i+1),dataRng).slice(0,valCount):Array.from({length:cfg.n},(_,i)=>Math.floor((i+1)*valCount/cfg.n)>Math.floor(i*valCount/cfg.n)?i+1:null).filter(Boolean));
  const data=positions.map((r,i)=>({id:i+1,r,energy:morse(r),force:morseForce(r),split:validationIds.has(i+1)?'validation':'train'})),train=data.filter(p=>p.split==='train'),validation=data.filter(p=>p.split==='validation');
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length,xm=mean(train.map(p=>p.r)),ym=mean(train.map(p=>p.energy)),xs=Math.sqrt(mean(train.map(p=>(p.r-xm)**2))),ys=Math.sqrt(mean(train.map(p=>(p.energy-ym)**2)));
  if(!(xs>1e-12&&ys>1e-12))throw new Error('训练数据方差太小，无法可靠标准化。');
  const normalization={xm,xs,ym,ys};data.forEach(p=>{p.x=(p.r-xm)/xs;p.y=(p.energy-ym)/ys;});
  const layers=sizes.slice(1).map((out,l)=>{const input=sizes[l],activation=l<cfg.activations.length?cfg.activations[l]:'linear',he=cfg.initialization==='he'||(cfg.initialization==='auto'&&['relu','leaky'].includes(activation)),bound=he?Math.sqrt(6/input):Math.sqrt(6/(input+out));return{input,out,w:Float64Array.from({length:input*out},()=>cfg.initialization==='zero'?0:(initRng.next()*2-1)*bound),b:new Float64Array(out),gw:new Float64Array(input*out),gb:new Float64Array(out),mw:new Float64Array(input*out),vw:new Float64Array(input*out),mb:new Float64Array(out),vb:new Float64Array(out)};});
  const parameterCount=layers.reduce((s,l)=>s+l.w.length+l.b.length,0),connectionCount=layers.reduce((s,l)=>s+l.w.length,0);
  layers.forEach(l=>{l.gew=new Float64Array(l.w.length);l.geb=new Float64Array(l.b.length);l.gfw=new Float64Array(l.w.length);l.gfb=new Float64Array(l.b.length);});
  let order=shuffle(train.map(p=>p.id)),cursor=0,step=0,completedEpochs=0,lastBatch=[],lastBatchLoss=null,lastUpdate=null,lastGradientTraces=[],pendingStep=null,tokenCounter=0,history=[];
  function forward(x,trace=false,params=null){const a=[[x]],zs=[[x]];layers.forEach((l,index)=>{const w=params?params.weights[index]:l.w,b=params?params.biases[index]:l.b,z=new Float64Array(l.out),out=new Float64Array(l.out);for(let j=0;j<l.out;j++){let s=b[j];for(let i=0;i<l.input;i++)s+=w[j*l.input+i]*a[index][i];z[j]=s;out[j]=index===layers.length-1?s:h2Activation(cfg.activations[index],s);}a.push(out);if(trace)zs.push(z);});if(trace)a.zs=zs;return a;}
  const predict=(r,params=null)=>forward((r-xm)/xs,false,params)[last][0]*ys+ym;
  /** Propagate da/dx alongside the value. No finite differences enter training. */
  function forwardTangent(x,params=null){
    const a=forward(x,true,params),derivatives=[[1]],preactivationDerivatives=[[1]];
    layers.forEach((l,index)=>{
      const w=params?params.weights[index]:l.w,t=new Float64Array(l.out),d=new Float64Array(l.out);
      for(let j=0;j<l.out;j++){
        for(let i=0;i<l.input;i++)t[j]+=w[j*l.input+i]*derivatives[index][i];
        d[j]=index===layers.length-1?t[j]:h2Derivative(cfg.activations[index],a.zs[index+1][j],a[index+1][j])*t[j];
      }
      derivatives.push(d);preactivationDerivatives.push(t);
    });
    a.derivatives=derivatives;a.preactivationDerivatives=preactivationDerivatives;return a;
  }
  const predictForce=(r,params=null)=>-ys/xs*forwardTangent((r-xm)/xs,params).derivatives[last][0];
  const lossParts=(energyNormalized,forceNormalized)=>({energyNormalized,forceNormalized,total:energyNormalized+forceWeight*forceNormalized,energyMSE:energyNormalized*ys**2,forceMSE:forceNormalized*(ys/xs)**2});
  function batchLossParts(points,params=null){
    let energyNormalized=0,forceNormalized=0;
    for(const p of points){const a=forwardTangent(p.x,params),de=a[last][0]-p.y,df=-a.derivatives[last][0]-p.force*xs/ys;energyNormalized+=de*de/points.length;forceNormalized+=df*df/points.length;}
    return lossParts(energyNormalized,forceNormalized);
  }
  function gradients(points,trace=false){
    layers.forEach(l=>{for(const k of ['gw','gb','gew','geb','gfw','gfb'])l[k].fill(0);});
    lastGradientTraces=[];let energyLoss=0,forceLoss=0;
    for(const p of points){
      const a=forwardTangent(p.x),error=a[last][0]-p.y,forceTarget=p.force*xs/ys,forcePrediction=-a.derivatives[last][0],forceError=forcePrediction-forceTarget;
      const deltas=Array.from({length:sizes.length},()=>[]),forceDeltas=Array.from({length:sizes.length},()=>[]),forceTangentDeltas=Array.from({length:sizes.length},()=>[]);
      energyLoss+=error*error/points.length;forceLoss+=forceError*forceError/points.length;
      // Preserve the original energy gradient arithmetic and ordering.
      let delta=[2*error/points.length];
      for(let l=layers.length-1;l>=0;l--){
        const layer=layers[l];if(trace)deltas[l+1]=Array.from(delta);const next=new Float64Array(layer.input);
        for(let j=0;j<layer.out;j++){layer.geb[j]+=delta[j];for(let i=0;i<layer.input;i++){const k=j*layer.input+i;layer.gew[k]+=delta[j]*a[l][i];next[i]+=layer.w[k]*delta[j];}}
        if(l>0)for(let i=0;i<next.length;i++)next[i]*=h2Derivative(cfg.activations[l-1],a.zs[l][i],a[l][i]);delta=next;
      }
      // Reverse both a and da/dx. g_F is the unweighted force-MSE gradient.
      let adjA=[0],adjD=[-2*forceError/points.length];
      for(let l=layers.length-1;l>=0;l--){
        const layer=layers[l],nextA=new Float64Array(layer.input),nextD=new Float64Array(layer.input),dz=new Float64Array(layer.out),dt=new Float64Array(layer.out);
        for(let j=0;j<layer.out;j++){
          const linear=l===layers.length-1,d1=linear?1:h2Derivative(cfg.activations[l],a.zs[l+1][j],a[l+1][j]),d2=linear?0:h2SecondDerivative(cfg.activations[l],a.zs[l+1][j],a[l+1][j]);
          dz[j]=adjA[j]*d1+adjD[j]*d2*a.preactivationDerivatives[l+1][j];dt[j]=adjD[j]*d1;layer.gfb[j]+=dz[j];
          for(let i=0;i<layer.input;i++){const k=j*layer.input+i;layer.gfw[k]+=dz[j]*a[l][i]+dt[j]*a.derivatives[l][i];nextA[i]+=layer.w[k]*dz[j];nextD[i]+=layer.w[k]*dt[j];}
        }
        if(trace){forceDeltas[l+1]=Array.from(dz);forceTangentDeltas[l+1]=Array.from(dt);}adjA=nextA;adjD=nextD;
      }
      if(trace)lastGradientTraces.push({id:p.id,r:p.r,target:p.energy,normalizedTarget:p.y,prediction:a[last][0]*ys+ym,normalizedPrediction:a[last][0],referenceForce:p.force,predictionForce:forcePrediction*ys/xs,normalizedForceTarget:forceTarget,normalizedForcePrediction:forcePrediction,activations:a.map(v=>Array.from(v)),zs:a.zs.map(v=>Array.from(v)),derivatives:a.derivatives.map(v=>Array.from(v)),preactivationDerivatives:a.preactivationDerivatives.map(v=>Array.from(v)),deltas,forceDeltas,forceTangentDeltas,normalizedLoss:error**2,physicalLoss:error**2*ys**2,loss:lossParts(error**2,forceError**2)});
    }
    layers.forEach(l=>{for(let k=0;k<l.w.length;k++)l.gw[k]=forceWeight?l.gew[k]+forceWeight*l.gfw[k]:l.gew[k];for(let k=0;k<l.b.length;k++)l.gb[k]=forceWeight?l.geb[k]+forceWeight*l.gfb[k]:l.geb[k];});
    return energyLoss+forceWeight*forceLoss;
  }
  const batchLoss=points=>batchLossParts(points).total;
  const metrics=(points,params=null)=>{const loss=batchLossParts(points,params);return{mse:loss.energyMSE,rmse:Math.sqrt(loss.energyMSE),forceMse:loss.forceMSE,forceRmse:Math.sqrt(loss.forceMSE),totalLoss:loss.total};};
  const evaluate=()=>({step,train:metrics(train),validation:metrics(validation)}),initialMetrics=evaluate();history.push(initialMetrics);
  const record=()=>{if(history.at(-1).step!==step)history.push(evaluate());return history.at(-1);};
  const parameters=()=>({weights:layers.map(l=>Array.from(l.w)),biases:layers.map(l=>Array.from(l.b))});
  const moments=()=>layers.map(l=>({m:Array.from(l.mw),v:Array.from(l.vw),mb:Array.from(l.mb),vb:Array.from(l.vb)}));
  const finished=()=>completedEpochs>=cfg.epochs;
  const learningRate=s=>cfg.lr*(cfg.schedule==='constant'?1:cfg.endFactor+(1-cfg.endFactor)*(1+Math.cos(Math.PI*s/(Math.ceil(train.length/cfg.batch)*cfg.epochs)))/2);
  const stateKeys=['w','b','gw','gb','gew','geb','gfw','gfb','mw','vw','mb','vb'];
  const saveState=()=>({shuffleSeed:shuffleRng.get(),order:[...order],cursor,step,completedEpochs,lastBatch:[...lastBatch],lastBatchLoss,lastUpdate,lastGradientTraces,history:[...history],layers:layers.map(l=>Object.fromEntries(stateKeys.map(k=>[k,Array.from(l[k])])))});
  function restoreState(s){shuffleRng.set(s.shuffleSeed);order=[...s.order];cursor=s.cursor;step=s.step;completedEpochs=s.completedEpochs;lastBatch=[...s.lastBatch];lastBatchLoss=s.lastBatchLoss;lastUpdate=s.lastUpdate;lastGradientTraces=s.lastGradientTraces;history=[...s.history];layers.forEach((l,i)=>stateKeys.forEach(k=>l[k].set(s.layers[i][k])));}
  function trainStep(trace=false){
    if(pendingStep&&!trace)throw new Error('请先提交或取消当前讲解。');if(finished())return false;
    const backup=saveState();
    try{
      if(cursor>=order.length){order=shuffle([...order]);cursor=0;}
      const ids=order.slice(cursor,cursor+cfg.batch),points=ids.map(id=>data[id-1]),before=parameters(),oldMoments=moments(),loss=gradients(points,trace),beforeLoss=batchLossParts(points);
      if(!Number.isFinite(loss)||!Number.isFinite(beforeLoss.forceMSE))throw new Error('损失非有限，已保留最后有效模型，请降低学习率或调整设置。');
      const nextStep=step+1,lr=learningRate(nextStep);
      const update=(w,g,m,v)=>{for(let i=0;i<w.length;i++){
        let direction=g[i];
        if(cfg.optimizer==='adam'){m[i]=cfg.beta1*m[i]+(1-cfg.beta1)*g[i];v[i]=cfg.beta2*v[i]+(1-cfg.beta2)*g[i]**2;direction=(m[i]/(1-cfg.beta1**nextStep))/(Math.sqrt(v[i]/(1-cfg.beta2**nextStep))+1e-8);}
        else if(cfg.optimizer==='momentum'){m[i]=cfg.momentum*m[i]+g[i];direction=m[i];}
        w[i]-=lr*direction;if(!Number.isFinite(w[i])||!Number.isFinite(m[i])||!Number.isFinite(v[i]))throw new Error('参数非有限，已停止并保留最后有效模型。');
      }};
      layers.forEach(l=>{update(l.w,l.gw,l.mw,l.vw);update(l.b,l.gb,l.mb,l.vb);});
      step=nextStep;const afterLoss=batchLossParts(points);
      lastUpdate={step,optimizer:cfg.optimizer,learningRate:lr,forceWeight,before,after:parameters(),oldMoments,moments:moments(),gradients:layers.map(l=>Array.from(l.gw)),biasGradients:layers.map(l=>Array.from(l.gb)),gradientEnergy:{weights:layers.map(l=>Array.from(l.gew)),biases:layers.map(l=>Array.from(l.geb))},gradientForce:{weights:layers.map(l=>Array.from(l.gfw)),biases:layers.map(l=>Array.from(l.gfb))},deltaWeights:layers.map((l,j)=>Array.from(l.w,(v,i)=>v-before.weights[j][i])),deltaBiases:layers.map((l,j)=>Array.from(l.b,(v,i)=>v-before.biases[j][i])),batchBefore:beforeLoss.energyMSE,batchAfter:afterLoss.energyMSE,beforeLoss,afterLoss};
      if(Object.values(afterLoss).some(x=>!Number.isFinite(x)))throw new Error('更新后的批次损失非有限，已保留最后有效模型。');
      lastBatch=ids;lastBatchLoss=lastUpdate.batchBefore;cursor+=ids.length;if(cursor>=order.length)completedEpochs++;return true;
    }catch(e){restoreState(backup);throw e;}
  }
  const curve=params=>Array.from({length:601},(_,i)=>{const r=.3+2.7*i/600,a=forwardTangent((r-xm)/xs,params);return{r,energy:morse(r),force:morseForce(r),prediction:a[last][0]*ys+ym,predictedForce:-ys/xs*a.derivatives[last][0]};});
  function response(selection,params=null){if(selection?.type!=='node'||selection.layer<=0||selection.layer>=last)return null;const l=selection.layer,j=selection.k;if(j>=sizes[l])return null;return{layer:l,k:j,lastHidden:l===last-1,baseline:ym+ys*(params?params.biases[last-1][0]:layers[last-1].b[0]),points:Array.from({length:151},(_,i)=>{const r=.3+2.7*i/150,a=forward((r-xm)/xs,false,params)[l][j],w=l===last-1?(params?params.weights[last-1][j]:layers[last-1].w[j]):0;return{r,a,contribution:ys*w*a,prediction:predict(r,params)};})};}
  function network(r,selection=null,params=null){const a=forwardTangent((r-xm)/xs,params);return{step,sizes,activations:a.map(v=>Array.from(v)),zs:a.zs.map(v=>Array.from(v)),derivatives:a.derivatives.map(v=>Array.from(v)),preactivationDerivatives:a.preactivationDerivatives.map(v=>Array.from(v)),...(params??parameters()),r,normalization,update:lastUpdate,response:response(selection,params)};}
  /** One snapshot owns the energies, forces and gradients of one committed model Step. */
  function snapshot(probe=.7417,selection=null){const latest=record();return{cfg,sizes,parameterCount,connectionCount,warning,step,data:data.map(p=>({...p,prediction:predict(p.r),predictedForce:predictForce(p.r)})),order:[...order],cursor,completedEpochs,currentEpoch:Math.min(cfg.epochs,completedEpochs+(cursor>=order.length?0:1)),lastBatch:[...lastBatch],lastBatchLoss,finished:finished(),stepsPerEpoch:Math.ceil(train.length/cfg.batch),latest,initial:initialMetrics,history:history.filter((_,i)=>i%Math.max(1,Math.ceil(history.length/400))===0||i===history.length-1),curve:curve(),network:network(probe,selection),probe:{r:probe,reference:morse(probe),prediction:predict(probe),referenceForce:morseForce(probe),predictionForce:predictForce(probe)}};}
  /** Candidate transaction; physicalLoss stays energy MSE for v1 consumers. */
  function prepareStep(){if(pendingStep)return pendingStep.trace;if(finished())return null;const original=saveState(),beforeCurve=curve(),beforeMetrics=evaluate();try{trainStep(true);const trace={token:++tokenCounter,targetStep:step,batchIds:[...lastBatch],samples:lastGradientTraces,afterSamples:lastBatch.map(id=>{const p=data[id-1],a=forwardTangent(p.x);return{id,r:p.r,activations:a.map(v=>Array.from(v)),zs:a.zs.map(v=>Array.from(v)),derivatives:a.derivatives.map(v=>Array.from(v)),preactivationDerivatives:a.preactivationDerivatives.map(v=>Array.from(v)),prediction:a[last][0]*ys+ym,predictionForce:-a.derivatives[last][0]*ys/xs,referenceForce:p.force};}),update:lastUpdate,loss:lastUpdate.beforeLoss,afterLoss:lastUpdate.afterLoss,normalizedLoss:lastUpdate.beforeLoss.energyNormalized,physicalLoss:lastBatchLoss,normalization,sizes,beforeCurve,afterCurve:curve(),beforeMetrics,afterMetrics:evaluate()};const candidate=saveState();restoreState(original);pendingStep={candidate,trace,baseStep:step};return trace;}catch(e){restoreState(original);throw e;}}
  function commitStep(token){if(!pendingStep||pendingStep.trace.token!==token||pendingStep.baseStep!==step)throw new Error('讲解已过期或已提交。');const p=pendingStep;pendingStep=null;restoreState(p.candidate);return p.trace;}
  const cancelStep=()=>{pendingStep=null;};
  function lessonNetwork(lesson,selection){const phase=lesson.viewPhase??lesson.phase,trace=lesson.trace,p=trace.samples[lesson.sampleIndex],params=phase===4?trace.update.after:trace.update.before,n=network(p.r,selection,params);return{...n,step:phase===4?trace.targetStep:trace.targetStep-1,update:trace.update};}
  function checkGradient(selection){const original=saveState();try{const l=Math.max(0,Math.min(layers.length-1,selection.layer??0)),k=Math.max(0,Math.min(layers[l].w.length-1,selection.k??0)),points=(lastBatch.length?lastBatch:order.slice(0,cfg.batch)).map(id=>data[id-1]);gradients(points);const analytic=layers[l].gw[k],w=layers[l].w[k],h=1e-5;layers[l].w[k]=w+h;const plus=batchLoss(points);layers[l].w[k]=w-h;const minus=batchLoss(points);const numeric=(plus-minus)/(2*h);return{step,layer:l,k,analytic,numeric,absolute:Math.abs(analytic-numeric),relative:Math.abs(analytic-numeric)/Math.max(1e-6,Math.abs(analytic),Math.abs(numeric)),note:'ReLU 在 z=0 处不可微，邻近折点时数值差分可能不一致。'};}finally{restoreState(original);}}
  return{cfg,sizes,layers,data,train,validation,normalization,parameterCount,connectionCount,morse,morseForce,forward,forwardTangent,predict,predictForce,gradients,batchLoss,batchLossParts,metrics,trainStep,finished,learningRate,snapshot,network,response,prepareStep,commitStep,cancelStep,lessonNetwork,saveState,checkGradient};
}
