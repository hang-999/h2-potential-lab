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
  constructor(parameters,grad,inspect=false){this.v=Array.from(parameters);this.grad=grad;this.inspect=inspect;this.labels=new Map();this.a=grad?Array(parameters.length).fill(-1):null;this.b=grad?Array(parameters.length).fill(-1):null;this.da=grad?Array(parameters.length).fill(0):null;this.db=grad?Array(parameters.length).fill(0):null;this.zero=this.constant(0);this.one=this.constant(1);}
 node(v,a=-1,b=-1,da=0,db=0){const i=this.v.length;this.v.push(v);if(this.grad){this.a.push(a);this.b.push(b);this.da.push(da);this.db.push(db);}if(this.inspect&&this.selectedParam!==undefined&&(a===this.selectedParam||b===this.selectedParam))this.labels.set(i,{label:this.context?.operation||'参数运算',...this.context});return i;}
 constant(x){return this.node(x);}
 add(a,b){return a===this.zero?b:b===this.zero?a:this.node(this.v[a]+this.v[b],a,b,1,1);}
 mul(a,b){return a===this.zero||b===this.zero?this.zero:a===this.one?b:b===this.one?a:this.node(this.v[a]*this.v[b],a,b,this.v[b],this.v[a]);}
 scale(a,x){return x===0||a===this.zero?this.zero:x===1?a:this.node(this.v[a]*x,a,-1,x);}
 tanh(a){const x=Math.tanh(this.v[a]);return this.node(x,a,-1,1-x*x);}
 sigmoid(a){const x=1/(1+Math.exp(-this.v[a]));return this.node(x,a,-1,x*(1-x));}
 sum(xs){let y=this.zero;for(const x of xs)y=this.add(y,x);return y;}
 dot(a,b){let y=this.zero;for(let i=0;i<a.length;i++)y=this.add(y,this.mul(a[i],b[i]));return y;}
 dotC(a,b){let y=this.zero;for(let i=0;i<a.length;i++)y=this.add(y,this.scale(a[i],b[i]));return y;}
  mark(id,label,meta={}){if(this.inspect)this.labels.set(id,{...this.labels.get(id),label,...meta});return id;}
  backward(output,count){const adj=new Float64Array(this.v.length);adj[output]=1;for(let i=this.v.length-1;i>=count;i--){const g=adj[i];if(g===0)continue;if(this.a[i]>=0)adj[this.a[i]]+=g*this.da[i];if(this.b[i]>=0)adj[this.b[i]]+=g*this.db[i];}if(this.inspect)this.adjoint=adj;return adj.slice(0,count);}
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
// Five orthonormal Cartesian coordinates of a symmetric traceless tensor.
// These are not the ordering/normalization of the real spherical harmonics UI.
const qFive=q=>[(q[0]-q[4])/Math.SQRT2,(2*q[8]-q[0]-q[4])/Math.sqrt(6),Math.SQRT2*q[1],Math.SQRT2*q[2],Math.SQRT2*q[5]];
const matvec=(q,v)=>[0,1,2].map(i=>dot(q.slice(3*i,3*i+3),v));
function pathValues(method,s,v,q,e,f,active){
 const vu=dot(v,e.u),qY=dot(q,e.Y),Qu=matvec(q,e.u),Yv=matvec(e.Y,v),scalar=(path,value)=>({path,outputType:'scalar',contribution:value}),vector=(path,value)=>({path,outputType:'vector',contribution:value}),tensor=(path,value)=>({path,outputType:'tensor',contribution:value});
 if(method==='harmonics')return [scalar(0,f[0]*s),scalar(1,f[1]*vu),scalar(2,f[2]*qY),vector(3,e.u.map(u=>f[3]*s*u)),vector(4,v.map(x=>f[4]*x)),vector(5,Yv.map(x=>f[5]*x)),vector(6,Qu.map(x=>f[6]*x)),tensor(7,e.Y.map(x=>f[7]*s*x)),tensor(8,q.map((_,k)=>{const i=Math.floor(k/3),j=k%3;return f[8]*(.5*(v[i]*e.u[j]+v[j]*e.u[i])-(i===j?vu/3:0));})),tensor(9,q.map(x=>f[9]*x)),tensor(10,q.map((x,k)=>{const i=Math.floor(k/3),j=k%3;return f[10]*(.5*(Qu[i]*e.u[j]+Qu[j]*e.u[i])-x/3-(i===j?qY/3:0));}))].filter(x=>active.includes(x.path)).map(x=>({...x,label:tensorPaths[x.path]}));
 if(method==='vectors')return [scalar(0,f[0]*s),scalar(1,f[1]*vu),vector(2,v.map(x=>f[2]*x)),vector(3,e.u.map(u=>f[3]*s*u)),vector(4,e.u.map(u=>f[4]*vu*u))].filter(x=>active.includes(x.path)).map(x=>({...x,label:['s → s','v·u → s','v → v','s u → v','(v·u)u → v'][x.path]}));
 return [scalar(0,f[0]*s)];
}
const correlationNames=['S','S²','v·v','Q:Q','S³','S(v·v)','S(Q:Q)','vᵀQv','tr(Q³)'];
function orderedCorrelation(edges,index){
 const degree=[1,2,2,2,3,3,3,3,3][index],rows=[];
 const evaluate=terms=>{const [a,b,c]=terms;
  if(index===0)return a.s;if(index===1)return a.s*b.s;if(index===2)return dot(a.v,b.v);if(index===3)return dot(a.Q,b.Q);if(index===4)return a.s*b.s*c.s;if(index===5)return a.s*dot(b.v,c.v);if(index===6)return a.s*dot(b.Q,c.Q);if(index===7)return dot(a.v,matvec(b.Q,c.v));
  let total=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++)for(let k=0;k<3;k++)total+=a.Q[i*3+j]*b.Q[j*3+k]*c.Q[k*3+i];return total;
 };
 const visit=terms=>{if(terms.length===degree){rows.push({neighbors:terms.map(x=>x.from),repeated:new Set(terms.map(x=>x.from)).size<degree,value:evaluate(terms),featureIndex:index});return;}for(const e of edges)visit(terms.concat(e));};visit([]);
 return {id:'ordered-correlation',title:'有序邻居展开（含重复邻居）',kind:'correlation-expansion',formula:correlationNames[index],featureIndex:index,degree,rows,output:sum(rows.map(x=>x.value)),note:'对聚合密度乘积的代数展开；重复邻居不能删除，也不等同于互异原子体阶。'};
}
function createModel(input={}){
 const cfg={method:'acsf',hidden:[16,16],channels:4,rounds:2,radial:3,lmax:2,correlation:3,cutoff:3,angleMessages:false,seed:42,...input};
 if(!['acsf','moments','messages','vectors','harmonics','mace'].includes(cfg.method))throw Error('训练模型类型无效；SOAP 使用独立核求解器。');
 if(!Number.isInteger(cfg.channels)||cfg.channels<1||cfg.channels>8||!Number.isInteger(cfg.radial)||cfg.radial<1||cfg.radial>4||!Number.isInteger(cfg.rounds)||cfg.rounds<1||cfg.rounds>3||![0,1,2].includes(cfg.lmax)||![1,2,3].includes(cfg.correlation))throw Error('模型结构超出教学范围。');
  const random=rng((cfg.seed^0xa511e9b3)>>>0),values=[],names=[],groups=[],blocks=[];
 const addParam=(name,group,value)=>{const id=values.length;values.push(value);names.push(name);groups.push(group);return id;};
  const block=(name,group,n,scale=.2,zero=false,meta={})=>{const ids=Array.from({length:n},(_,k)=>addParam(name+'.'+k,group,zero?0:(2*random()-1)*scale));if(n)blocks.push({id:name,title:name,kind:'vector',group,shape:[n],...meta,parameterIndices:[...ids]});return ids;};
  const makeMLP=(name,dims,owner={})=>dims.slice(1).map((out,l)=>({input:dims[l],out,w:block(`${name}.L${l+1}.w`,l===dims.length-2?'readout':'hidden',out*dims[l],Math.sqrt(6/(dims[l]+out)),false,{...owner,title:`${name} · 层 ${l+1} 权重`,kind:'matrix',shape:[out,dims[l]],layerIndex:l+1}),b:block(`${name}.L${l+1}.b`,l===dims.length-2?'readout':'hidden',out,0,true,{...owner,title:`${name} · 层 ${l+1} 偏置`,layerIndex:l+1})}));
 const C=cfg.channels,R=cfg.radial,isVector=['vectors','harmonics','mace'].includes(cfg.method),isTensor=['harmonics','mace'].includes(cfg.method)&&cfg.lmax>=2,hasVector=cfg.method==='vectors'||(['harmonics','mace'].includes(cfg.method)&&cfg.lmax>=1);
 const activeTensorIndices=cfg.lmax===0?[0]:cfg.lmax===1?[0,1,3,4]:tensorPaths.map((_,i)=>i);
 const correlationIndices=[0,...(cfg.correlation>=2?[1,...(hasVector?[2]:[]),...(isTensor?[3]:[])]:[]),...(cfg.correlation>=3?[4,...(hasVector?[5]:[]),...(isTensor?[6,7,8]:[])]:[])];
 let mlps,linear,embedding,rounds,head,offset;
 if(cfg.method==='acsf'){
   const dim=R*3+(cfg.radialOnly?0:24);mlps=species.map(s=>makeMLP('ACSF.'+s,[dim,...cfg.hidden,1],{element:s}));
 }else if(cfg.method==='moments'){
   const size=3*(R*3*5+(R*3)*(R*3-1)/2*3);linear=block('basis.coefficient','basis',size,.01,false,{title:'标准化多体基系数',kind:'basis',shape:[1,size]});
 }else{
   embedding=species.map(s=>block('embedding.'+s,'embedding',C,.6,false,{title:s+' 元素嵌入',element:s,shape:[1,C],round:0}));
  rounds=Array.from({length:cfg.rounds},(_,t)=>{
   const paths=cfg.method==='harmonics'?tensorPaths.length:cfg.method==='vectors'?5:1;
   const activePath=p=>cfg.method==='harmonics'?activeTensorIndices.includes(p)&&(t>0||[0,3,7].includes(p)):cfg.method==='vectors'?(t>0||[0,3].includes(p)):true;
    return {filter:Array.from({length:paths},(_,p)=>Array.from({length:C},(_,c)=>activePath(p)?block(`round${t+1}.filter.${p}.c${c+1}`,'radial',R,.5,false,{title:`第 ${t+1} 轮 · 路径 ${p} · 通道 ${c+1} 径向系数`,round:t+1,path:p,channel:c,shape:[1,R]}):[])),mix:Array.from({length:cfg.method==='mace'||t===0?1:isTensor?3:hasVector?2:1},(_,l)=>Array.from({length:C},(_,c)=>block(`round${t+1}.mix.l${l}.c${c+1}`,'mixing',C,.5,false,{title:`第 ${t+1} 轮 · l=${l} · 输出通道 ${c+1} 混合`,round:t+1,representation:l,channel:c,shape:[1,C],kind:'matrix'}))),bias:block(`round${t+1}.bias`,'mixing',C,.05,false,{title:`第 ${t+1} 轮 · 标量偏置`,round:t+1}),gate:block(`round${t+1}.gate`,'gate',hasVector?C:0,.3,false,{title:`第 ${t+1} 轮 · 门控偏置`,round:t+1}),couple:block(`round${t+1}.invariant-coupling`,'mixing',hasVector&&cfg.method!=='mace'?C:0,.3,false,{title:`第 ${t+1} 轮 · 不变量耦合`,round:t+1}),angle:block(`round${t+1}.angle`,'radial',cfg.angleMessages?C:0,.3,false,{title:`第 ${t+1} 轮 · 角度系数`,round:t+1}),correlations:Array.from({length:C},(_,c)=>block(`round${t+1}.correlation.c${c+1}`,'correlation',cfg.method==='mace'?correlationIndices.length:0,.4,false,{title:`第 ${t+1} 轮 · 通道 ${c+1} 高阶收缩`,round:t+1,channel:c,featureIndices:[...correlationIndices],kind:'correlation',shape:[1,correlationIndices.length]}))};
  });
   const dim=C*(1+(hasVector?1:0)+(isTensor?1:0));head=makeMLP('atomic-readout',[dim,Math.max(8,C*2),1],{readout:true});
 }
 offset=addParam('readout.global-offset','readout',0);
  blocks.push({id:'readout.global-offset',title:'归一化总能量偏置',kind:'bias',group:'readout',shape:[1,1],parameterIndices:[offset]});
 const parameters=Float64Array.from(values);
 let featureNormalization=null,normalizationVersion=0;
 const statistics=rows=>{const dim=rows[0]?.length??0,mean=Array.from({length:dim},(_,k)=>sum(rows.map(x=>x[k]))/rows.length),scale=mean.map((m,k)=>{const s=Math.sqrt(sum(rows.map(x=>(x[k]-m)**2))/rows.length);return s>1e-5?s:1;});return {mean,scale};};
 function normalizedFeatures(g){if(!featureNormalization)return g.features;if(g.normalizedVersion===normalizationVersion)return g.normalizedFeatures;const norm=(x,s)=>x.map((v,k)=>(v-(s.mean[k]??0))/(s.scale[k]??1));g.normalizedFeatures=cfg.method==='acsf'?g.features.map((x,i)=>norm(x,featureNormalization[g.species[i]])):norm(g.features,featureNormalization);g.normalizedVersion=normalizationVersion;return g.normalizedFeatures;}
 function fitNormalization(preparedTrain){if(!['acsf','moments'].includes(cfg.method))return;if(!preparedTrain.length)throw Error('特征标准化需要训练数据。');featureNormalization=cfg.method==='acsf'?species.map((_,sp)=>statistics(preparedTrain.flatMap(g=>g.features.filter((x,i)=>g.species[i]===sp)))):statistics(preparedTrain.map(g=>g.features));normalizationVersion++;}
 const prepare=atoms=>{const g=geometric(atoms,cfg);if(cfg.method==='acsf')g.features=acsfFeatures(atoms,cfg);if(cfg.method==='moments')Object.assign(g,fixedMoments(g,cfg));return g;};
 function normalizeSelection(g,input={}){
  const b=blocks.find(x=>x.id===input.blockId),integer=(x,fallback,max)=>Number.isInteger(x)?Math.max(0,Math.min(max,x)):fallback;
  let atomIndex=integer(input.atomIndex,0,g.atoms.length-1);if(input.atomIndex===undefined&&b?.element&&g.atoms[atomIndex]?.element!==b.element){const found=g.atoms.findIndex(a=>a.element===b.element);if(found>=0)atomIndex=found;}
  const s={...input,atomIndex,round:integer(input.round,b?.round??cfg.rounds,cfg.rounds),channel:integer(input.channel,b?.channel??0,C-1),layerIndex:integer(input.layerIndex,b?.layerIndex??1,cfg.method==='acsf'?cfg.hidden.length+1:2),neuronIndex:integer(input.neuronIndex,0,10000),featureIndex:integer(input.featureIndex,0,cfg.method==='moments'?linear.length-1:cfg.method==='acsf'?g.features[atomIndex].length-1:8),paramIndex:integer(input.paramIndex,b?.parameterIndices?.[0]??0,parameters.length-1)};
  s.edgeFrom=integer(input.edgeFrom,g.incoming[atomIndex][0]?.from??atomIndex,g.atoms.length-1);s.representation=input.representation??b?.representation??0;s.readout=input.readout===undefined?!!b?.readout:input.readout===true;
  return s;
 }
 function acsfDetail(g,s){
  const i=s.atomIndex,k=s.featureIndex,p={...M.defaults,cutoff:cfg.cutoff,radial:cfg.radial,rs:1.25,eta:4};let f,bank=null;
  if(k<R*3)f=M.acsf(g.atoms,i,p).features[k];else{const offset=k-R*3,b=Math.floor(offset/6);bank={lambda:b<2?-1:1,zeta:b%2+1,eta:.2};f=M.acsf(g.atoms,i,{...p,...bank}).features[R*3+offset%6];}
  const stat=featureNormalization?.[g.species[i]],mean=stat?.mean[k]??0,scale=stat?.scale[k]??1,raw=f.value/2;
  const rows=f.terms.map((term,index)=>{const distances=term.indices.map(j=>Math.hypot(...g.atoms[j].pos.map((x,d)=>x-g.atoms[i].pos[d])));return {...term,index,atomIndex:i,featureIndex:k,neighbors:term.indices,distances,cutoffs:distances.map(r=>fc(r,cfg.cutoff)),scaledContribution:term.value/2};});
  return {id:'descriptor',title:f.label+' · 真实描述符输入',kind:'acsf',formula:f.kind==='radial'?'G₂ = Σⱼ exp[−η(rᵢⱼ−Rₛ)²] f꜀(rᵢⱼ)':'G₄ = 2^(1−ζ) Σⱼ≠ₖ (1+λ cos θ)ᶻ exp[−η(rᵢⱼ²+rᵢₖ²+rⱼₖ²)] f꜀(rᵢⱼ) f꜀(rᵢₖ) f꜀(rⱼₖ)',rows,atomIndex:i,featureIndex:k,rawG:f.value,divisor:2,rawValue:raw,mean,scale,output:(raw-mean)/scale,parameters:bank||{eta:f.eta,rs:f.rs},normalizationFormula:'x = (G / 2 − μtrain) / σtrain',note:f.kind==='angular'?'每个无序邻居对合并 (j,k)、(k,j) 两项，表中系数为 2^(2−ζ)。':'固定描述符，无可训练参数；均值和尺度仅来自训练集。'};
 }
 function momentDetail(g,s){
  const catalog=[];for(let central=0;central<3;central++){for(let k=0;k<R*3;k++)for(const kind of ['s','s2','s3','vv','qq'])catalog.push({central,k,l:k,kind});for(let k=0;k<R*3;k++)for(let l=k+1;l<R*3;l++)for(const kind of ['ss','vv','qq'])catalog.push({central,k,l,kind});}
  const index=s.featureIndex,meta=catalog[index],local=bank=>{const radial=Math.floor(bank/3),sp=bank%3,neighbors=g.incoming[s.atomIndex].filter(e=>g.species[e.from]===sp).map(e=>({from:e.from,to:e.to,radial,neighborElement:species[sp],weight:e.radial[radial]/2,r:e.r,u:e.u,Y:e.Y}));let scalar=0,v=[0,0,0],Q=Array(9).fill(0);for(const e of neighbors){scalar+=e.weight;v=v.map((x,k)=>x+e.weight*e.u[k]);Q=Q.map((x,k)=>x+e.weight*e.Y[k]);}return {bank,radial,neighborElement:species[sp],s:scalar,v,Q,Q5:qFive(Q),neighbors};};
  const bankAt=(atom,bank)=>{const save=s.atomIndex;s.atomIndex=atom;const v=local(bank);s.atomIndex=save;return v;},contract=(a,b)=>meta.kind==='s'?a.s:meta.kind==='s2'?a.s*a.s:meta.kind==='s3'?a.s**3:meta.kind==='ss'?a.s*b.s:meta.kind==='vv'?dot(a.v,b.v):dot(a.Q,b.Q);
  const rows=g.atoms.map((a,i)=>a.element===species[meta.central]?i:-1).filter(i=>i>=0).map(atomIndex=>{const a=bankAt(atomIndex,meta.k),b=meta.l===meta.k?a:bankAt(atomIndex,meta.l);return {atomIndex,featureIndex:index,left:a,right:b,value:contract(a,b)};});
  const raw=sum(rows.map(x=>x.value)),mean=featureNormalization?.mean[index]??0,scale=featureNormalization?.scale[index]??1;
  return {id:'moments',title:g.labels[index]+' · 矩与收缩',kind:'moments',formula:'S = Σ f/2；v = Σ(f/2)u；Q = Σ(f/2)(uuᵀ−I/3)',rows,featureIndex:index,centralElement:species[meta.central],contraction:meta.kind,rawValue:raw,mean,scale,output:(raw-mean)/scale,normalizationFormula:'B = (Braw − μtrain) / σtrain',paramIndex:linear[index],note:'表中各中心原子的收缩值相加后标准化；Q5 使用正交 Cartesian 坐标。'};
 }
  function mlp(t,x,layers,trace,context={}){let a=x;const acts=trace?[x.map(i=>t.v[i])]:[],zs=[];
   for(let k=0;k<layers.length;k++){const l=layers[k],zvalues=[],previous=a;
    a=Array.from({length:l.out},(_,j)=>{if(t.inspect)t.context={operation:context.readout?'原子读出神经元':'元素分支神经元',atomIndex:context.atomIndex,layerIndex:k+1,neuronIndex:j};const inspect=t.inspect&&context.atomIndex===t.selection.atomIndex&&k+1===t.selection.layerIndex&&j===Math.min(t.selection.neuronIndex,l.out-1),terms=[];let z=l.b[j];
     for(let i=0;i<l.input;i++){const paramIndex=l.w[j*l.input+i],product=t.mul(paramIndex,previous[i]);z=t.add(z,product);if(inspect){terms.push({inputIndex:i,input:t.v[previous[i]],weight:t.v[paramIndex],paramIndex,product:t.v[product],atomIndex:context.atomIndex});t.mark(product,`原子 ${context.atomIndex+1} · 层 ${k+1} · w${j+1},${i+1} a${i+1}`,{kind:'product',paramIndex});}}
     if(trace)zvalues.push(t.v[z]);const out=k===layers.length-1?z:t.tanh(z);
     if(inspect){t.mark(z,`原子 ${context.atomIndex+1} · 层 ${k+1} · z${j+1}`,{kind:'preactivation'});t.mark(out,`原子 ${context.atomIndex+1} · 层 ${k+1} · a${j+1}`,{kind:'activation',localDerivative:k===layers.length-1?1:1-t.v[out]**2});t.details.push({id:'mlp',title:context.readout?'原子读出网络':'元素分支神经元',kind:'mlp',formula:k===layers.length-1?'z = Σ wa + b；a = z':'z = Σ wa + b；a = tanh(z)',rows:terms.concat({inputIndex:'bias',weight:t.v[l.b[j]],paramIndex:l.b[j],product:t.v[l.b[j]],atomIndex:context.atomIndex}),inputs:previous.map(i=>t.v[i]),output:t.v[out],z:t.v[z],activation:t.v[out],localDerivative:k===layers.length-1?1:1-t.v[out]**2,layerIndex:k+1,neuronIndex:j});t.selectedValue=t.v[out];}
     return out;});if(trace){acts.push(a.map(i=>t.v[i]));zs.push(zvalues);}}
   return {a,activations:acts,zs};}
 const vectorZero=t=>Array(3).fill(t.zero),tensorZero=t=>Array(9).fill(t.zero);
 function valueNodes(t,nodes){return nodes.map((n,index)=>({index,s:n.s.map(x=>t.v[x]),v:n.v.map(v=>v.map(x=>t.v[x])),Q:n.q.map(q=>q.map(x=>t.v[x])),z:n.z?.map(x=>t.v[x]),gates:n.gates?.map(x=>t.v[x]),aggregate:n.aggregate?{s:n.aggregate.s.map(x=>t.v[x]),v:n.aggregate.v.map(v=>v.map(x=>t.v[x])),Q:n.aggregate.q.map(q=>q.map(x=>t.v[x]))}:null}));}
 function forward(g,options={}){
   const pv=options.parameters??parameters;if(pv.length!==parameters.length||Array.from(pv).some(x=>!Number.isFinite(x)))throw Error('只读参数长度或数值无效。');
   const t=new Tape(pv,!!options.gradient||!!options.inspection,!!options.inspection),trace={method:cfg.method,layers:[],readouts:[],atomicContributions:[],features:g.features||null,parameterGroups:[...new Set(groups)],paths:cfg.method==='harmonics'?activeTensorIndices.map(i=>tensorPaths[i]):[],note:'可训练的简化模型；非正式工业实现。'};
   t.selection=options.inspection;t.selectedParam=t.selection?.paramIndex;t.details=[];const selected=t.selection;
  let total=t.zero;
   if(cfg.method==='moments'){const x=normalizedFeatures(g);if(selected){for(let k=0;k<linear.length;k++){t.context={operation:'线性基函数贡献',featureIndex:k,paramIndex:linear[k]};const contribution=t.scale(linear[k],x[k]);total=t.add(total,contribution);if(k===selected.featureIndex)t.mark(contribution,'选中基函数乘系数',{kind:'basis-contribution',featureIndex:k,localDerivative:x[k]});}}else total=t.dotC(linear,x);if(options.trace){trace.features=x.map((value,i)=>({name:g.labels[i],featureIndex:i,paramIndex:linear[i],value,rawValue:g.features[i],weight:pv[linear[i]],contribution:value*pv[linear[i]]}));trace.atomicContributions=[];trace.featureNormalization=featureNormalization;}}
  else if(cfg.method==='acsf'){
    const normalized=normalizedFeatures(g);for(let i=0;i<g.atoms.length;i++){const x=normalized[i].map(v=>t.constant(v)),o=mlp(t,x,mlps[g.species[i]],options.trace,{atomIndex:i});total=t.add(total,o.a[0]);if(options.trace){trace.atomicContributions.push(t.v[o.a[0]]);trace.layers.push({atom:i,element:g.atoms[i].element,activations:o.activations,zs:o.zs});}}if(options.trace)trace.featureNormalization=featureNormalization;
  }else{
   let nodes=g.atoms.map((a,i)=>({s:embedding[g.species[i]],v:Array.from({length:C},()=>vectorZero(t)),q:Array.from({length:C},()=>tensorZero(t))}));
   if(options.trace)trace.layers.push({round:0,nodes:valueNodes(t,nodes)});
   for(let r=0;r<rounds.length;r++){
    const p=rounds[r],inspectRound=selected&&selected.round===r+1,incomingDetails=[],mixed=nodes.map((n,i)=>{if(selected)t.context={operation:'通道混合',atomIndex:i,round:r+1};return {s:p.mix[0].map(w=>t.dot(w,n.s)),v:Array.from({length:C},(_,c)=>Array.from({length:3},(_,k)=>p.mix[1]?t.dot(p.mix[1][c],n.v.map(v=>v[k])):t.zero)),q:Array.from({length:C},(_,c)=>Array.from({length:9},(_,k)=>p.mix[2]?t.dot(p.mix[2][c],n.q.map(q=>q[k])):t.zero))};});
    const agg=nodes.map(()=>({s:Array(C).fill(t.zero),v:Array.from({length:C},()=>vectorZero(t)),q:Array.from({length:C},()=>tensorZero(t))})),edgeTrace=[];
    for(const e of g.edges){const from=mixed[e.from],a=agg[e.to],messages=[];
     for(let c=0;c<C;c++){
      if(selected)t.context={operation:'边径向过滤与消息',from:e.from,to:e.to,atomIndex:e.to,round:r+1,channel:c};
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
      if(inspectRound&&e.to===selected.atomIndex&&c===selected.channel){
       const value=ids=>ids.map(id=>t.v[id]),raw={s:t.v[ms],v:value(mv),Q:value(mq)},scaled={s:raw.s*.5,v:raw.v.map(x=>x*.5),Q:raw.Q.map(x=>x*.5)},entry={from:e.from,to:e.to,atomIndex:e.to,round:r+1,channel:c,r:e.r,u:e.u,Y:e.Y,raw,normalization:.5,...scaled};incomingDetails.push(entry);
       if(e.from===selected.edgeFrom){
        t.mark(ms,'原始标量消息',{kind:'message',from:e.from,to:e.to,round:r+1,channel:c});mv.forEach((id,k)=>t.mark(id,`原始向量消息 [${k}]`,{kind:'message',component:k,representation:1}));mq.forEach((id,k)=>t.mark(id,`原始张量消息 [${k}]`,{kind:'message',component:k,representation:2}));
        const active=p.filter.map((row,k)=>row[c].length?k:-1).filter(k=>k>=0),filters=active.map(path=>({path,label:cfg.method==='harmonics'?tensorPaths[path]:`过滤器 ${path}`,parameterIndices:p.filter[path][c],coefficients:p.filter[path][c].map(id=>pv[id]),basis:e.radial,products:p.filter[path][c].map((id,k)=>pv[id]*e.radial[k]),value:t.v[f[path]],from:e.from,to:e.to,round:r+1,channel:c}));
        const paths=pathValues(cfg.method,t.v[s],value(v),value(q),e,value(f),active).map(row=>({...row,from:e.from,to:e.to,round:r+1,channel:c,parameterIndices:p.filter[row.path][c],selected:row.path===selected.pathIndex}));if(cfg.angleMessages)paths.push({path:'angle',label:'固定角度几何项',outputType:'scalar',parameterIndices:[p.angle[c]],contribution:pv[p.angle[c]]*t.v[s]*e.angular*fc(e.r,cfg.cutoff),from:e.from,to:e.to});
        if(cfg.method==='mace'){if(hasVector)paths.push({path:'density-vector',label:'标量密度 × u',outputType:'vector',contribution:raw.v,parameterIndices:[],from:e.from,to:e.to});if(isTensor)paths.push({path:'density-tensor',label:'标量密度 × (uuᵀ−I/3)',outputType:'tensor',contribution:raw.Q,parameterIndices:[],from:e.from,to:e.to});}
        t.details.push({id:'radial',title:'选中边的径向过滤器',kind:'radial',formula:'fₚ(r) = Σₙ θₚₙ Rₙ(r)',rows:filters,edge:{from:e.from,to:e.to,r:e.r,u:e.u},radialCenters:e.radial.map((_,k)=>.6+1.6*k/Math.max(1,R-1)),cutoff:fc(e.r,cfg.cutoff),output:filters[0]?.value??0});
        t.details.push({id:'paths',title:cfg.method==='harmonics'?'合法张量耦合路径':'边消息计算',kind:'paths',formula:'原始消息 = Σ 合法路径贡献；聚合消息 = 0.5 × 原始消息',rows:paths,mixed:{s:t.v[s],v:value(v),Q:value(q),Q5:qFive(value(q))},raw,scaled,output:raw.s,note:cfg.method==='mace'?'标量密度权重乘 u 与 uuᵀ−I/3 生成向量与张量密度。':'未分配、不可达或 lmax 排除的路径不列为有效路径。'});
        const source=nodes[e.from],mixRows=[];for(let l=0;l<p.mix.length;l++)for(let k=0;k<C;k++){const input=l===0?t.v[source.s[k]]:value(l===1?source.v[k]:source.q[k]),paramIndex=p.mix[l][c][k],weight=pv[paramIndex];mixRows.push({representation:l,inputChannel:k,channel:c,from:e.from,atomIndex:e.from,paramIndex,input,weight,product:Array.isArray(input)?input.map(x=>x*weight):input*weight});}
        t.details.push({id:'mixing',title:'发送原子的通道混合',kind:'mixing',formula:'h̃_c^(l) = Σ_d W_cd^(l) h_d^(l)',rows:mixRows,output:{s:t.v[s],v:value(v),Q:value(q)}});
       }
      }
      // Fixed normalization controls magnitude without fitting to validation data.
      a.s[c]=t.add(a.s[c],t.scale(ms,.5));a.v[c]=a.v[c].map((x,k)=>t.add(x,t.scale(mv[k],.5)));a.q[c]=a.q[c].map((x,k)=>t.add(x,t.scale(mq[k],.5)));messages.push(t.v[ms]);
     }
     if(options.trace)edgeTrace.push({from:e.from,to:e.to,r:e.r,message:messages});
    }
    nodes=nodes.map((old,i)=>{const a=agg[i],n={s:[],v:[],q:[],z:[],gates:[],aggregate:a};for(let c=0;c<C;c++){
     if(selected)t.context={operation:'节点更新与门控',atomIndex:i,round:r+1,channel:c};let correlationRows=null;
     let inv=hasVector?t.dot(a.v[c],a.v[c]):t.zero;if(isTensor)inv=t.add(inv,t.dot(a.q[c],a.q[c]));let z=t.add(t.add(old.s[c],a.s[c]),p.bias[c]);
     if(cfg.method==='mace'){
      const s=a.s[c],v=a.v[c],q=a.q[c],vv=t.dot(v,v),qq=t.dot(q,q),s2=t.mul(s,s),features=[s];
      if(cfg.correlation>=2)features.push(s2,vv,qq);
      if(cfg.correlation>=3){const qv=Array.from({length:3},(_,k)=>t.dot(q.slice(k*3,k*3+3),v));let q3=t.zero;for(let j=0;j<3;j++)for(let k=0;k<3;k++)for(let l=0;l<3;l++)q3=t.add(q3,t.mul(t.mul(q[j*3+k],q[k*3+l]),q[l*3+j]));features.push(t.mul(s2,s),t.mul(s,vv),t.mul(s,qq),t.dot(v,qv),q3);}z=t.add(z,t.dot(p.correlations[c],correlationIndices.map(k=>features[k])));
      if(inspectRound&&i===selected.atomIndex&&c===selected.channel)correlationRows=correlationIndices.map((featureIndex,j)=>({featureIndex,label:correlationNames[featureIndex],value:t.v[features[featureIndex]],paramIndex:p.correlations[c][j],weight:pv[p.correlations[c][j]],contribution:t.v[features[featureIndex]]*pv[p.correlations[c][j]],atomIndex:i,round:r+1,channel:c}));
     }else if(hasVector)z=t.add(z,t.mul(p.couple[c],inv));
     const s=t.tanh(z),gate=hasVector?t.sigmoid(t.add(s,p.gate[c])):t.one;n.s.push(s);n.z.push(z);n.gates.push(gate);n.v.push(a.v[c].map((x,k)=>hasVector?t.mul(gate,t.add(x,t.scale(old.v[c][k],.5))):t.zero));n.q.push(a.q[c].map((x,k)=>isTensor?t.mul(gate,t.add(x,t.scale(old.q[c][k],.5))):t.zero));
     if(inspectRound&&i===selected.atomIndex&&c===selected.channel){
      const value=ids=>ids.map(id=>t.v[id]),aggregate={s:t.v[a.s[c]],v:value(a.v[c]),Q:value(a.q[c])},rows=[{label:'旧标量',value:t.v[old.s[c]],atomIndex:i},{label:'聚合标量',value:aggregate.s,atomIndex:i},{label:'偏置',value:pv[p.bias[c]],paramIndex:p.bias[c]}];
      if(correlationRows)rows.push(...correlationRows.map(x=>({...x,value:x.contribution,contraction:x.value})));else if(hasVector)rows.push({label:'不变量耦合',value:pv[p.couple[c]]*t.v[inv],invariant:t.v[inv],weight:pv[p.couple[c]],paramIndex:p.couple[c]});
      t.mark(z,'选中节点 z',{kind:'preactivation',atomIndex:i,round:r+1,channel:c});t.mark(s,'选中节点 tanh(z)',{kind:'activation',atomIndex:i,round:r+1,channel:c,localDerivative:1-t.v[s]**2});t.mark(gate,'选中节点门控',{kind:'gate',localDerivative:hasVector?t.v[gate]*(1-t.v[gate]):0});
      t.details.push({id:'aggregate',title:'邻居消息聚合',kind:'aggregation',formula:'Aᵢ = Σⱼ 0.5 mⱼ→ᵢ',rows:incomingDetails,output:aggregate,atomIndex:i,round:r+1,channel:c});
      t.details.push({id:'node-update',title:hasVector?'标量更新与门控':'标量节点更新',kind:'update',formula:hasVector?'s′ = tanh(z)；g = sigmoid(s′ + b_g)；v′ = g(A_v + 0.5v)'+(isTensor?'；Q′ = g(A_Q + 0.5Q)':''):'s′ = tanh(z)；z 由下表各项相加',rows,z:t.v[z],output:t.v[s],activation:t.v[s],localDerivative:1-t.v[s]**2,gate:{enabled:hasVector,value:t.v[gate],preactivation:hasVector?t.v[s]+pv[p.gate[c]]:null,paramIndex:hasVector?p.gate[c]:null,localDerivative:hasVector?t.v[gate]*(1-t.v[gate]):0},before:{s:t.v[old.s[c]],v:value(old.v[c]),Q:value(old.q[c])},after:{s:t.v[s],v:value(n.v.at(-1)),Q:value(n.q.at(-1)),Q5:qFive(value(n.q.at(-1)))},atomIndex:i,round:r+1,channel:c});
      if(correlationRows){t.details.push({id:'correlations',title:'可学习高阶密度收缩',kind:'correlation',formula:'z = s旧 + A_s + b + Σν cν Bν(A)',rows:correlationRows,output:sum(correlationRows.map(x=>x.contribution))});const feature=correlationIndices.includes(selected.featureIndex)?selected.featureIndex:correlationIndices.at(-1);t.details.push(orderedCorrelation(incomingDetails,feature));}
     }
    }return n;});
    if(options.trace)trace.layers.push({round:r+1,nodes:valueNodes(t,nodes),edges:edgeTrace});
   }
    for(let i=0;i<nodes.length;i++){const n=nodes[i],x=[...n.s];if(hasVector)x.push(...n.v.map(v=>t.dot(v,v)));if(isTensor)x.push(...n.q.map(q=>t.dot(q,q)));const readout=mlp(t,x,head,options.trace,{atomIndex:i,readout:true}),o=readout.a[0];total=t.add(total,o);if(options.trace){trace.atomicContributions.push(t.v[o]);trace.readouts.push({atom:i,activations:readout.activations,zs:readout.zs});}}
  }
   if(selected)t.context={operation:'总能量偏置'};total=t.add(total,offset);const result={value:t.v[total]};if(!Number.isFinite(result.value))throw Error('模型输出非有限。');if(options.gradient||selected){result.gradient=t.backward(total,parameters.length);if(result.gradient.some(x=>!Number.isFinite(x)))throw Error('模型梯度非有限。');}if(options.trace){trace.offset=pv[offset];trace.value=result.value;trace.operations=t.v.length;result.trace=trace;}
   if(selected){result.details=t.details;result.selectedValue=t.selectedValue;result.dependencies=[...t.labels].map(([id,meta])=>({...meta,value:t.v[id],adjoint:t.adjoint?.[id]??null}));const uses=[];for(let i=parameters.length;i<t.v.length;i++)for(const [input,local]of [[t.a[i],t.da[i]],[t.b[i],t.db[i]]])if(input===selected.paramIndex)uses.push({...t.labels.get(i),paramIndex:input,operation:t.labels.get(i)?.label??`算子 ${i}`,value:t.v[i],localDerivative:local,adjoint:t.adjoint[i],derivative:local*t.adjoint[i]});if(total===selected.paramIndex)uses.push({paramIndex:total,operation:'参数直接作为输出',value:t.v[total],localDerivative:1,adjoint:1,derivative:1});result.parameterUses=uses;}
   return result;
 }
 function responseValue(trace,selection={}){
  const b=blocks.find(x=>x.id===selection.blockId),atom=selection.atomIndex??0,layer=selection.layerIndex??b?.layerIndex??1,neuron=selection.neuronIndex??0;
  if(cfg.method==='moments')return trace.features?.[selection.featureIndex??0]?.value??0;
  if(cfg.method==='acsf'||(selection.readout===undefined?b?.readout:selection.readout)){const record=(cfg.method==='acsf'?trace.layers:trace.readouts)?.find(x=>x.atom===atom),values=record?.activations?.[layer]??record?.activations?.at(-1);return values?.[Math.min(neuron,(values?.length??1)-1)]??0;}
  const node=trace.layers?.find(x=>x.round===(selection.round??b?.round??cfg.rounds))?.nodes?.[atom],channel=selection.channel??b?.channel??0;if(!node)return 0;
  const v=node.v[channel]??[0,0,0],q=node.Q[channel]??Array(9).fill(0),component=selection.component??(selection.representation===1||selection.representation==='vector'?'norm-v':selection.representation===2||selection.representation==='tensor'?'norm-Q':'scalar');
  if(component==='norm-v')return Math.hypot(...v);if(component==='norm-Q')return Math.hypot(...q);if(['vx','vy','vz'].includes(component))return v[['vx','vy','vz'].indexOf(component)];if(/^q[1-5]$/.test(component))return qFive(q)[Number(component[1])-1];return node.s[channel]??0;
 }
 function explain(g,input={},options={}){
  const selection=normalizeSelection(g,input),pv=options.parameters??parameters,result=forward(g,{parameters:pv,trace:true,gradient:true,inspection:selection}),details=result.details;
  if(cfg.method==='acsf')details.unshift(acsfDetail(g,selection));
  if(cfg.method==='moments'){const detail=momentDetail(g,selection);detail.weight=pv[linear[selection.featureIndex]];detail.contribution=detail.output*detail.weight;details.unshift(detail,{id:'linear-readout',title:'线性读出与所有基函数贡献',kind:'readout',formula:'ŷ = b + Σₖ cₖ Bₖ(X)',rows:result.trace.features,offset:pv[offset],output:result.value});}
  if(!['acsf','moments'].includes(cfg.method)){const i=selection.atomIndex;details.unshift({id:'embedding',title:g.atoms[i].element+' 元素嵌入',kind:'embedding',formula:'hᵢ⁽⁰⁾ = Embedding[elementᵢ]；vᵢ⁽⁰⁾ = Qᵢ⁽⁰⁾ = 0',rows:embedding[g.species[i]].map((paramIndex,channel)=>({atomIndex:i,element:g.atoms[i].element,channel,paramIndex,value:pv[paramIndex]})),output:pv[embedding[g.species[i]][selection.channel]]});}
  details.push({id:'energy-readout',title:'原子贡献与结构能量',kind:'readout',formula:cfg.method==='moments'?'ŷ = b + Σₖ cₖ Bₖ':'ŷ = b + Σᵢ εᵢ',rows:result.trace.atomicContributions.map((value,atomIndex)=>({atomIndex,element:g.atoms[atomIndex].element,value})),offset:pv[offset],output:result.value,note:'当前数值为归一化输出；乘训练能量尺度 σE 后得到 eV。原子贡献是数学分解。'});
  const primary=details.find(d=>d.id===selection.detailId)??details.find(d=>d.id===(cfg.method==='acsf'?(selection.layerIndex===0?'descriptor':'mlp'):cfg.method==='moments'?'moments':selection.readout?'mlp':'node-update'))??details[0];
  return {schema:'mlip-model-explanation',method:cfg.method,selection,value:result.value,selectedValue:responseValue(result.trace,selection),formula:primary.formula,inputs:primary.inputs??[],terms:primary.rows??[],outputs:{value:primary.output},details,trace:result.trace,parameter:{index:selection.paramIndex,name:names[selection.paramIndex],value:pv[selection.paramIndex],derivative:result.gradient[selection.paramIndex]},parameterUses:result.parameterUses,dependencies:result.dependencies,note:'局部导数及伴随量针对归一化模型输出 ŷ；批次损失梯度由引擎乘损失因子后对样本求和。'};
 }
 return {parameters,names,groups,config:clone(cfg),prepare,forward,explain,responseValue,fitNormalization,basis:g=>cfg.method==='moments'?normalizedFeatures(g).concat(1):null,setParameters(array){if(array.length!==parameters.length||Array.from(array).some(x=>!Number.isFinite(x)))throw Error('模型参数长度或数值无效。');parameters.set(array);},describe(){return {method:cfg.method,name:{acsf:'ACSF 元素分支网络',moments:'矩不变量线性模型',messages:'标量消息网络',vectors:'PaiNN 思想：标量与向量',harmonics:'NequIP 思想：不可约张量消息',mace:'MACE 思想：可学习密度与高阶关联'}[cfg.method],formula:cfg.method==='moments'?'ŷ = b + Σₖ cₖ Bₖ(X)':'ŷ = b + Σᵢ εᵢ；E = μ + σ ŷ',parameterCount:parameters.length,blocks:clone(blocks),groups:[...new Set(groups)].map(group=>({name:group,count:groups.filter(x=>x===group).length})),paths:cfg.method==='harmonics'?activeTensorIndices.map(i=>tensorPaths[i]):[],representation:cfg.method==='harmonics'?activeTensorIndices.includes(7)?'0e + 1o + 2e，Cartesian 不可约张量':hasVector?'0e + 1o':'0e':cfg.method==='vectors'?'标量 + 极向量':cfg.method==='mace'?'可学习邻居密度 + 1–3 阶收缩':'不变标量',note:'真实训练的简化教学模型；原子贡献是数学分解，不是独立物理可观测量；不等同于同名完整架构。'};}};
}
return {createModel,Tape,geometric,acsfFeatures,fixedMoments,tensorPaths};
});
