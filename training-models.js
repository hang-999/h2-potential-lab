/* Trainable reduced MLIP models. Binary64 arithmetic; no pretrained weights.
 * ACSF: species-resolved G2 and four (lambda,zeta) G4 banks -> element MLP -> sum.
 * Moments: species-resolved fixed radial moments -> invariant polynomial basis.
 * Message models: learned embeddings, radial coefficients and channel mixing.
 * Vector/tensor components only mix linearly and are gated by invariant scalars.
 * The tensor model uses the Cartesian equivalents of all retained natural-parity
 * l<=2 Clebsch-Gordan paths. Each path may differ by a constant normalization from
 * an orthonormal CG convention; its learned scalar coefficient absorbs that
 * constant. No componentwise nonlinearity is applied to vectors or tensors.
 * MACE-inspired models learn neighbor density, then contract up to three density
 * factors. Nonlinear composition and message depth are independent controls;
 * the correlation setting is not a claim of exact final energy body order.
 */
(function(root,factory){const api=factory(root.MLIP||(typeof require==='function'?require('./operators.js'):null));if(typeof module==='object'&&module.exports)module.exports=api;root.MLIPModels=api;})(typeof globalThis==='object'?globalThis:this,function(M){
'use strict';
const species=['H','C','O'],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sum=a=>a.reduce((s,x)=>s+x,0),fc=(r,c)=>r<c?.5*(1+Math.cos(Math.PI*r/c)):0;
const rng=seed=>()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
const clone=x=>JSON.parse(JSON.stringify(x));
class Tape{
 constructor(parameters,grad){this.v=Array.from(parameters);this.grad=grad;this.a=grad?Array(parameters.length).fill(-1):null;this.b=grad?Array(parameters.length).fill(-1):null;this.da=grad?Array(parameters.length).fill(0):null;this.db=grad?Array(parameters.length).fill(0):null;this.zero=this.constant(0);this.one=this.constant(1);}
 node(v,a=-1,b=-1,da=0,db=0){const i=this.v.length;this.v.push(v);if(this.grad){this.a.push(a);this.b.push(b);this.da.push(da);this.db.push(db);}return i;}
 constant(x){return this.node(x);}
 add(a,b){return a===this.zero?b:b===this.zero?a:this.node(this.v[a]+this.v[b],a,b,1,1);}
 mul(a,b){return a===this.zero||b===this.zero?this.zero:a===this.one?b:b===this.one?a:this.node(this.v[a]*this.v[b],a,b,this.v[b],this.v[a]);}
 scale(a,x){return x===0||a===this.zero?this.zero:x===1?a:this.node(this.v[a]*x,a,-1,x);}
 tanh(a){const x=Math.tanh(this.v[a]);return this.node(x,a,-1,1-x*x);}
 sigmoid(a){const x=1/(1+Math.exp(-this.v[a]));return this.node(x,a,-1,x*(1-x));}
 sum(xs){let y=this.zero;for(const x of xs)y=this.add(y,x);return y;}
 dot(a,b){let y=this.zero;for(let i=0;i<a.length;i++)y=this.add(y,this.mul(a[i],b[i]));return y;}
 dotC(a,b){let y=this.zero;for(let i=0;i<a.length;i++)y=this.add(y,this.scale(a[i],b[i]));return y;}
 backward(output,count){const adj=new Float64Array(this.v.length);adj[output]=1;for(let i=this.v.length-1;i>=count;i--){const g=adj[i];if(g===0)continue;if(this.a[i]>=0)adj[this.a[i]]+=g*this.da[i];if(this.b[i]>=0)adj[this.b[i]]+=g*this.db[i];}return adj.slice(0,count);}
}
function geometric(atoms,cfg){
 const edges=[],incoming=atoms.map(()=>[]),n=cfg.radial;
 for(let to=0;to<atoms.length;to++)for(let from=0;from<atoms.length;from++)if(to!==from){const d=atoms[from].pos.map((x,k)=>x-atoms[to].pos[k]),r=Math.hypot(...d);if(r<1e-8)throw Error('原子重合，无法计算方向。');if(r>=cfg.cutoff)continue;const u=d.map(x=>x/r),Y=u.flatMap((x,i)=>u.map((y,j)=>x*y-(i===j?1/3:0)));const radial=Array.from({length:n},(_,k)=>fc(r,cfg.cutoff)*Math.exp(-2*(r-(.6+1.6*k/Math.max(1,n-1)))**2));const e={from,to,r,u,Y,radial,angular:0};edges.push(e);incoming[to].push(e);}
 // A fixed scale keeps the angle term continuous when a neighbor crosses rc.
 for(const es of incoming)for(const e of es)e.angular=.5*sum(es.filter(q=>q!==e).map(q=>fc(q.r,cfg.cutoff)*(dot(e.u,q.u)+1/3)**2));
 return {atoms:clone(atoms),species:atoms.map(a=>species.indexOf(a.element)),edges,incoming};
}
function acsfFeatures(atoms,cfg){return atoms.map((_,i)=>{
 const p={...M.defaults,cutoff:cfg.cutoff,radial:cfg.radial,rs:1.25,eta:4};
 const radial=M.acsf(atoms,i,p).radial;
 const angular=cfg.radialOnly?[]:[-1,1].flatMap(lambda=>[1,2].flatMap(zeta=>M.acsf(atoms,i,{...p,eta:.2,lambda,zeta}).angular));
 return radial.concat(angular).map(x=>x/2);
 });}
function fixedMoments(g,cfg){
 const feats=[],labels=[];const append=(x,name)=>{feats.push(x);labels.push(name);};
 for(let central=0;central<3;central++){
 const local=[];
 for(let i=0;i<g.atoms.length;i++)if(g.species[i]===central){const d=[];for(let k=0;k<cfg.radial;k++)for(let sp=0;sp<3;sp++){let s=0,v=[0,0,0],q=Array(9).fill(0);for(const e of g.incoming[i])if(g.species[e.from]===sp){const w=e.radial[k]/2;s+=w;v=v.map((x,j)=>x+w*e.u[j]);q=q.map((x,j)=>x+w*e.Y[j]);}d.push({s,v,q});}local.push(d);}
 for(let k=0;k<cfg.radial*3;k++){
  append(sum(local.map(x=>x[k].s)),`${species[central]} S${k+1}`);
  append(sum(local.map(x=>x[k].s**2)),`${species[central]} S${k+1}²`);
  append(sum(local.map(x=>x[k].s**3)),`${species[central]} S${k+1}³`);
  append(sum(local.map(x=>dot(x[k].v,x[k].v))),`${species[central]} v${k+1}·v${k+1}`);
  append(sum(local.map(x=>dot(x[k].q,x[k].q))),`${species[central]} Q${k+1}:Q${k+1}`);
 }
 for(let k=0;k<cfg.radial*3;k++)for(let l=k+1;l<cfg.radial*3;l++){
  append(sum(local.map(x=>x[k].s*x[l].s)),`${species[central]} S${k+1}S${l+1}`);
  append(sum(local.map(x=>dot(x[k].v,x[l].v))),`${species[central]} v${k+1}·v${l+1}`);
  append(sum(local.map(x=>dot(x[k].q,x[l].q))),`${species[central]} Q${k+1}:Q${l+1}`);
 }
 }
 return {features:feats,labels};
}
const tensorPaths=['0e×0e→0e','1o×1o→0e','2e×2e→0e','0e×1o→1o','1o×0e→1o','1o×2e→1o','2e×1o→1o','0e×2e→2e','1o×1o→2e','2e×0e→2e','2e×2e→2e'];
function createModel(input={}){
 const cfg={method:'acsf',hidden:[16,16],channels:4,rounds:2,radial:3,lmax:2,correlation:3,cutoff:3,angleMessages:false,seed:42,...input};
 if(!['acsf','moments','messages','vectors','harmonics','mace'].includes(cfg.method))throw Error('训练模型类型无效；SOAP 使用独立核求解器。');
 if(!Number.isInteger(cfg.channels)||cfg.channels<1||cfg.channels>8||!Number.isInteger(cfg.radial)||cfg.radial<1||cfg.radial>4||!Number.isInteger(cfg.rounds)||cfg.rounds<1||cfg.rounds>3||![0,1,2].includes(cfg.lmax)||![1,2,3].includes(cfg.correlation))throw Error('模型结构超出教学范围。');
 const random=rng((cfg.seed^0xa511e9b3)>>>0),values=[],names=[],groups=[];
 const addParam=(name,group,value)=>{const id=values.length;values.push(value);names.push(name);groups.push(group);return id;};
 const block=(name,group,n,scale=.2,zero=false)=>Array.from({length:n},(_,k)=>addParam(name+'.'+k,group,zero?0:(2*random()-1)*scale));
 const makeMLP=(name,dims)=>dims.slice(1).map((out,l)=>({input:dims[l],out,w:block(`${name}.L${l+1}.w`,l===dims.length-2?'readout':'hidden',out*dims[l],Math.sqrt(6/(dims[l]+out))),b:block(`${name}.L${l+1}.b`,l===dims.length-2?'readout':'hidden',out,0,true)}));
 const C=cfg.channels,R=cfg.radial,isVector=['vectors','harmonics','mace'].includes(cfg.method),isTensor=['harmonics','mace'].includes(cfg.method)&&cfg.lmax>=2,hasVector=cfg.method==='vectors'||(['harmonics','mace'].includes(cfg.method)&&cfg.lmax>=1);
 const activeTensorIndices=cfg.lmax===0?[0]:cfg.lmax===1?[0,1,3,4]:tensorPaths.map((_,i)=>i);
 const correlationIndices=[0,...(cfg.correlation>=2?[1,...(hasVector?[2]:[]),...(isTensor?[3]:[])]:[]),...(cfg.correlation>=3?[4,...(hasVector?[5]:[]),...(isTensor?[6,7,8]:[])]:[])];
 let mlps,linear,embedding,rounds,head,offset;
 if(cfg.method==='acsf'){
  const dim=R*3+(cfg.radialOnly?0:24);mlps=species.map(s=>makeMLP('ACSF.'+s,[dim,...cfg.hidden,1]));
 }else if(cfg.method==='moments'){
  const size=3*(R*3*5+(R*3)*(R*3-1)/2*3);linear=block('basis.coefficient','basis',size,.01);
 }else{
  embedding=species.map(s=>block('embedding.'+s,'embedding',C,.6));
  rounds=Array.from({length:cfg.rounds},(_,t)=>{
   const paths=cfg.method==='harmonics'?tensorPaths.length:cfg.method==='vectors'?5:1;
   const activePath=p=>cfg.method==='harmonics'?activeTensorIndices.includes(p)&&(t>0||[0,3,7].includes(p)):cfg.method==='vectors'?(t>0||[0,3].includes(p)):true;
   return {filter:Array.from({length:paths},(_,p)=>Array.from({length:C},(_,c)=>activePath(p)?block(`round${t+1}.filter.${p}.c${c+1}`,'radial',R,.5):[])),mix:Array.from({length:cfg.method==='mace'||t===0?1:isTensor?3:hasVector?2:1},(_,l)=>Array.from({length:C},(_,c)=>block(`round${t+1}.mix.l${l}.c${c+1}`,'mixing',C,.5))),bias:block(`round${t+1}.bias`,'mixing',C,.05),gate:block(`round${t+1}.gate`,'gate',hasVector?C:0,.3),couple:block(`round${t+1}.invariant-coupling`,'mixing',hasVector&&cfg.method!=='mace'?C:0,.3),angle:block(`round${t+1}.angle`,'radial',cfg.angleMessages?C:0,.3),correlations:Array.from({length:C},(_,c)=>block(`round${t+1}.correlation.c${c+1}`,'correlation',cfg.method==='mace'?correlationIndices.length:0,.4))};
  });
  const dim=C*(1+(hasVector?1:0)+(isTensor?1:0));head=makeMLP('atomic-readout',[dim,Math.max(8,C*2),1]);
 }
 offset=addParam('readout.global-offset','readout',0);
 const parameters=Float64Array.from(values);
 let featureNormalization=null,normalizationVersion=0;
 const statistics=rows=>{const dim=rows[0]?.length??0,mean=Array.from({length:dim},(_,k)=>sum(rows.map(x=>x[k]))/rows.length),scale=mean.map((m,k)=>{const s=Math.sqrt(sum(rows.map(x=>(x[k]-m)**2))/rows.length);return s>1e-5?s:1;});return {mean,scale};};
 function normalizedFeatures(g){if(!featureNormalization)return g.features;if(g.normalizedVersion===normalizationVersion)return g.normalizedFeatures;const norm=(x,s)=>x.map((v,k)=>(v-(s.mean[k]??0))/(s.scale[k]??1));g.normalizedFeatures=cfg.method==='acsf'?g.features.map((x,i)=>norm(x,featureNormalization[g.species[i]])):norm(g.features,featureNormalization);g.normalizedVersion=normalizationVersion;return g.normalizedFeatures;}
 function fitNormalization(preparedTrain){if(!['acsf','moments'].includes(cfg.method))return;if(!preparedTrain.length)throw Error('特征标准化需要训练数据。');featureNormalization=cfg.method==='acsf'?species.map((_,sp)=>statistics(preparedTrain.flatMap(g=>g.features.filter((x,i)=>g.species[i]===sp)))):statistics(preparedTrain.map(g=>g.features));normalizationVersion++;}
 const prepare=atoms=>{const g=geometric(atoms,cfg);if(cfg.method==='acsf')g.features=acsfFeatures(atoms,cfg);if(cfg.method==='moments')Object.assign(g,fixedMoments(g,cfg));return g;};
 function mlp(t,x,layers,trace){let a=x;const acts=trace?[x.map(i=>t.v[i])]:[],zs=[];for(let k=0;k<layers.length;k++){const l=layers[k],zvalues=[];a=Array.from({length:l.out},(_,j)=>{let z=l.b[j];for(let i=0;i<l.input;i++)z=t.add(z,t.mul(l.w[j*l.input+i],a[i]));if(trace)zvalues.push(t.v[z]);return k===layers.length-1?z:t.tanh(z);});if(trace){acts.push(a.map(i=>t.v[i]));zs.push(zvalues);}}return {a,activations:acts,zs};}
 const vectorZero=t=>Array(3).fill(t.zero),tensorZero=t=>Array(9).fill(t.zero);
 function valueNodes(t,nodes){return nodes.map((n,index)=>({index,s:n.s.map(x=>t.v[x]),v:n.v.map(v=>v.map(x=>t.v[x])),Q:n.q.map(q=>q.map(x=>t.v[x])),z:n.z?.map(x=>t.v[x]),gates:n.gates?.map(x=>t.v[x]),aggregate:n.aggregate?{s:n.aggregate.s.map(x=>t.v[x]),v:n.aggregate.v.map(v=>v.map(x=>t.v[x])),Q:n.aggregate.q.map(q=>q.map(x=>t.v[x]))}:null}));}
 function forward(g,options={}){
  const t=new Tape(parameters,!!options.gradient),trace={method:cfg.method,layers:[],atomicContributions:[],features:g.features||null,parameterGroups:[...new Set(groups)],paths:cfg.method==='harmonics'?activeTensorIndices.map(i=>tensorPaths[i]):[],note:'可训练的简化模型；非正式工业实现。'};
  let total=t.zero;
  if(cfg.method==='moments'){const x=normalizedFeatures(g);total=t.dotC(linear,x);if(options.trace){trace.features=x.map((value,i)=>({name:g.labels[i],value,rawValue:g.features[i],weight:parameters[linear[i]],contribution:value*parameters[linear[i]]}));trace.atomicContributions=[];trace.featureNormalization=featureNormalization;}}
  else if(cfg.method==='acsf'){
   const normalized=normalizedFeatures(g);for(let i=0;i<g.atoms.length;i++){const x=normalized[i].map(v=>t.constant(v)),o=mlp(t,x,mlps[g.species[i]],options.trace);total=t.add(total,o.a[0]);if(options.trace){trace.atomicContributions.push(t.v[o.a[0]]);trace.layers.push({atom:i,element:g.atoms[i].element,activations:o.activations,zs:o.zs});}}if(options.trace)trace.featureNormalization=featureNormalization;
  }else{
   let nodes=g.atoms.map((a,i)=>({s:embedding[g.species[i]],v:Array.from({length:C},()=>vectorZero(t)),q:Array.from({length:C},()=>tensorZero(t))}));
   if(options.trace)trace.layers.push({round:0,nodes:valueNodes(t,nodes)});
   for(let r=0;r<rounds.length;r++){
    const p=rounds[r],mixed=nodes.map(n=>({s:p.mix[0].map(w=>t.dot(w,n.s)),v:Array.from({length:C},(_,c)=>Array.from({length:3},(_,k)=>p.mix[1]?t.dot(p.mix[1][c],n.v.map(v=>v[k])):t.zero)),q:Array.from({length:C},(_,c)=>Array.from({length:9},(_,k)=>p.mix[2]?t.dot(p.mix[2][c],n.q.map(q=>q[k])):t.zero))}));
    const agg=nodes.map(()=>({s:Array(C).fill(t.zero),v:Array.from({length:C},()=>vectorZero(t)),q:Array.from({length:C},()=>tensorZero(t))})),edgeTrace=[];
    for(const e of g.edges){const from=mixed[e.from],a=agg[e.to],messages=[];
     for(let c=0;c<C;c++){
      const f=p.filter.map(row=>t.dotC(row[c],e.radial)),s=from.s[c],v=from.v[c],q=from.q[c];
      let ms=t.mul(f[0],s);if(cfg.angleMessages)ms=t.add(ms,t.scale(t.mul(p.angle[c],s),e.angular*fc(e.r,cfg.cutoff)));
      let mv=vectorZero(t),mq=tensorZero(t);
      if(cfg.method==='harmonics'){
       if(hasVector){ms=t.add(ms,t.mul(f[1],t.dotC(v,e.u)));mv=e.u.map((u,k)=>t.add(t.scale(t.mul(f[3],s),u),t.mul(f[4],v[k])));const Yv=Array.from({length:3},(_,k)=>t.dotC(v,e.Y.slice(k*3,k*3+3)));mv=mv.map((x,k)=>t.add(x,t.mul(f[5],Yv[k])));}
       if(isTensor){ms=t.add(ms,t.mul(f[2],t.dotC(q,e.Y)));const Qu=Array.from({length:3},(_,k)=>t.dotC(q.slice(k*3,k*3+3),e.u));mv=mv.map((x,k)=>t.add(x,t.mul(f[6],Qu[k])));const vu=t.dotC(v,e.u),qY=t.dotC(q,e.Y);mq=e.Y.map((Y,k)=>{const i=Math.floor(k/3),j=k%3;let z=t.add(t.scale(t.mul(f[7],s),Y),t.mul(f[9],q[k]));let stf=t.scale(t.add(t.scale(v[i],e.u[j]),t.scale(v[j],e.u[i])),.5);if(i===j)stf=t.add(stf,t.scale(vu,-1/3));z=t.add(z,t.mul(f[8],stf));let sym=t.add(t.scale(t.add(t.scale(Qu[i],e.u[j]),t.scale(Qu[j],e.u[i])),.5),t.scale(q[k],-1/3));if(i===j)sym=t.add(sym,t.scale(qY,-1/3));return t.add(z,t.mul(f[10],sym));});}
      }else if(cfg.method==='vectors'){
       ms=t.add(ms,t.mul(f[1],t.dotC(v,e.u)));mv=e.u.map((u,k)=>t.add(t.mul(f[2],v[k]),t.scale(t.mul(f[3],s),u)));const proj=t.dotC(v,e.u);mv=mv.map((x,k)=>t.add(x,t.scale(t.mul(f[4],proj),e.u[k])));
      }else if(cfg.method==='mace'){
       if(hasVector)mv=e.u.map(u=>t.scale(ms,u));if(isTensor)mq=e.Y.map(Y=>t.scale(ms,Y));
      }
      // Fixed normalization controls magnitude without fitting to validation data.
      a.s[c]=t.add(a.s[c],t.scale(ms,.5));a.v[c]=a.v[c].map((x,k)=>t.add(x,t.scale(mv[k],.5)));a.q[c]=a.q[c].map((x,k)=>t.add(x,t.scale(mq[k],.5)));messages.push(t.v[ms]);
     }
     if(options.trace)edgeTrace.push({from:e.from,to:e.to,r:e.r,message:messages});
    }
    nodes=nodes.map((old,i)=>{const a=agg[i],n={s:[],v:[],q:[],z:[],gates:[],aggregate:a};for(let c=0;c<C;c++){
     let inv=hasVector?t.dot(a.v[c],a.v[c]):t.zero;if(isTensor)inv=t.add(inv,t.dot(a.q[c],a.q[c]));let z=t.add(t.add(old.s[c],a.s[c]),p.bias[c]);
     if(cfg.method==='mace'){
      const s=a.s[c],v=a.v[c],q=a.q[c],vv=t.dot(v,v),qq=t.dot(q,q),s2=t.mul(s,s),features=[s];
      if(cfg.correlation>=2)features.push(s2,vv,qq);
      if(cfg.correlation>=3){const qv=Array.from({length:3},(_,k)=>t.dot(q.slice(k*3,k*3+3),v));let q3=t.zero;for(let j=0;j<3;j++)for(let k=0;k<3;k++)for(let l=0;l<3;l++)q3=t.add(q3,t.mul(t.mul(q[j*3+k],q[k*3+l]),q[l*3+j]));features.push(t.mul(s2,s),t.mul(s,vv),t.mul(s,qq),t.dot(v,qv),q3);}z=t.add(z,t.dot(p.correlations[c],correlationIndices.map(k=>features[k])));
     }else if(hasVector)z=t.add(z,t.mul(p.couple[c],inv));
     const s=t.tanh(z),gate=hasVector?t.sigmoid(t.add(s,p.gate[c])):t.one;n.s.push(s);n.z.push(z);n.gates.push(gate);n.v.push(a.v[c].map((x,k)=>hasVector?t.mul(gate,t.add(x,t.scale(old.v[c][k],.5))):t.zero));n.q.push(a.q[c].map((x,k)=>isTensor?t.mul(gate,t.add(x,t.scale(old.q[c][k],.5))):t.zero));
    }return n;});
    if(options.trace)trace.layers.push({round:r+1,nodes:valueNodes(t,nodes),edges:edgeTrace});
   }
   for(let i=0;i<nodes.length;i++){const n=nodes[i],x=[...n.s];if(hasVector)x.push(...n.v.map(v=>t.dot(v,v)));if(isTensor)x.push(...n.q.map(q=>t.dot(q,q)));const o=mlp(t,x,head,options.trace).a[0];total=t.add(total,o);if(options.trace)trace.atomicContributions.push(t.v[o]);}
  }
  total=t.add(total,offset);const result={value:t.v[total]};if(!Number.isFinite(result.value))throw Error('模型输出非有限。');if(options.gradient){result.gradient=t.backward(total,parameters.length);if(result.gradient.some(x=>!Number.isFinite(x)))throw Error('模型梯度非有限。');}if(options.trace){trace.offset=parameters[offset];trace.value=result.value;trace.operations=t.v.length;result.trace=trace;}return result;
 }
 return {parameters,names,groups,config:clone(cfg),prepare,forward,fitNormalization,basis:g=>cfg.method==='moments'?normalizedFeatures(g).concat(1):null,setParameters(array){if(array.length!==parameters.length||Array.from(array).some(x=>!Number.isFinite(x)))throw Error('模型参数长度或数值无效。');parameters.set(array);},describe(){return {method:cfg.method,name:{acsf:'ACSF 元素分支网络',moments:'矩不变量线性模型',messages:'标量消息网络',vectors:'PaiNN 思想：标量与向量',harmonics:'NequIP 思想：不可约张量消息',mace:'MACE 思想：可学习密度与高阶关联'}[cfg.method],formula:cfg.method==='moments'?'ŷ = b + Σₖ cₖ Bₖ(X)':'ŷ = b + Σᵢ εᵢ；E = μ + σ ŷ',parameterCount:parameters.length,groups:[...new Set(groups)].map(group=>({name:group,count:groups.filter(x=>x===group).length})),paths:cfg.method==='harmonics'?activeTensorIndices.map(i=>tensorPaths[i]):[],representation:cfg.method==='harmonics'?activeTensorIndices.includes(7)?'0e + 1o + 2e，Cartesian 不可约张量':hasVector?'0e + 1o':'0e':cfg.method==='vectors'?'标量 + 极向量':cfg.method==='mace'?'可学习邻居密度 + 1–3 阶收缩':'不变标量',note:'真实训练的简化教学模型；原子贡献是数学分解，不是独立物理可观测量；不等同于同名完整架构。'};}};
}
return {createModel,Tape,geometric,acsfFeatures,fixedMoments,tensorPaths};
});
