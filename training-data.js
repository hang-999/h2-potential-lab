(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./operators.js'):root.MLIP);if(typeof module==='object'&&module.exports)module.exports=api;root.MLIPTrainingData=api;})(globalThis,function(M){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)), methods=['acsf','soap','moments','messages','vectors','harmonics','mace'];
const defaults={method:'acsf',case:'A',n:160,batch:8,epochs:300,seed:42,lr:.003,optimizer:'adam',schedule:'cosine',hidden:[16,16],channels:4,rounds:2,radial:3,lmax:2,correlation:3,cutoff:3,angleMessages:false,radialOnly:false,regularization:1e-6};
function validate(input={}){const c={...defaults,...input,hidden:[...(input.hidden??defaults.hidden)]};const fail=(k,t)=>{const e=new Error(t);e.field=k;throw e;};for(const[k,min,max,int]of[['n',40,240,true],['batch',1,32,true],['epochs',1,2000,true],['seed',0,4294967295,true],['lr',.0001,.1],['channels',1,8,true],['rounds',1,3,true],['radial',1,4,true],['lmax',0,2,true],['correlation',1,3,true],['cutoff',1,5],['regularization',1e-10,1]])if(typeof c[k]!=='number'||!Number.isFinite(c[k])||c[k]<min||c[k]>max||int&&!Number.isInteger(c[k]))fail(k,`${k} 必须在 ${min}–${max} 范围内${int?'且为整数':''}。`);if(!methods.includes(c.method))fail('method','未知训练方法。');if(!['A','B','C'].includes(c.case))fail('case','未知教学案例。');if(!['adam','sgd','momentum'].includes(c.optimizer))fail('optimizer','优化器无效。');if(!['constant','cosine'].includes(c.schedule))fail('schedule','学习率策略无效。');if(!Array.isArray(c.hidden)||c.hidden.length>4||c.hidden.some(n=>!Number.isInteger(n)||n<1||n>64))fail('hidden','隐藏层允许 0–4 层，每层 1–64 个神经元。');for(const k of ['angleMessages','radialOnly'])if(typeof c[k]!=='boolean')fail(k,k+' 必须为布尔值。');return Object.fromEntries(Object.keys(defaults).map(k=>[k,c[k]]));}
function rng(seed){let s=seed>>>0;return{next(){let t=s=(s+0x6D2B79F5)>>>0;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;},get:()=>s,set:x=>s=x>>>0};}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r.next()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const add=(a,b)=>a.map((x,i)=>x+b[i]),sub=(a,b)=>a.map((x,i)=>x-b[i]),scale=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),norm=a=>Math.hypot(...a),unit=a=>scale(a,1/norm(a));
const cutoff=r=>r<3?.5*(Math.cos(Math.PI*r/3)+1):0,dc=r=>r<3?-Math.PI/6*Math.sin(Math.PI*r/3):0;
const atom=(i,element,pos)=>({id:i+1,element,pos});
function geometryA(r1=1,r2=1,theta=104.5){const t=theta*Math.PI/180;return[atom(0,'O',[0,0,0]),atom(1,'H',[r1,0,0]),atom(2,'H',[r2*Math.cos(t),r2*Math.sin(t),0])];}
const tetra=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(unit);
function geometryB(){return[atom(0,'C',[0,0,0]),...tetra.map((u,i)=>atom(i+1,'H',scale(u,1.2)))];}
function reference(atoms,which='A'){
 const forces=atoms.map(()=>[0,0,0]);let value=0;
 const accumulate=(j,g)=>{forces[j]=sub(forces[j],g);forces[0]=add(forces[0],g);};
 const a=atoms.slice(1).map(x=>sub(x.pos,atoms[0].pos)),r=a.map(norm),u=a.map(unit),f=r.map(cutoff);
 if(which==='A'){
  for(let j=0;j<2;j++){const t=Math.exp(-2*(r[j]-1));value+=(1-t)**2;accumulate(j+1,scale(u[j],4*t*(1-t)));}
  const c=dot(u[0],u[1]),q=c-Math.cos(104.5*Math.PI/180);value+=f[0]*f[1]*q*q;
  accumulate(1,add(scale(u[0],dc(r[0])*f[1]*q*q),scale(sub(u[1],scale(u[0],c)),2*f[0]*f[1]*q/r[0])));
  accumulate(2,add(scale(u[1],dc(r[1])*f[0]*q*q),scale(sub(u[0],scale(u[1],c)),2*f[0]*f[1]*q/r[1])));
 }else{
  const base=M.energyForces(atoms,{cutoff:3});value=base.value;base.forces.forEach((x,i)=>forces[i]=x.slice());
  if(which==='C')for(let j=0;j<a.length;j++)for(let k=j+1;k<a.length;k++)for(let l=k+1;l<a.length;l++){
   const inds=[j,k,l],c01=dot(u[j],u[k]),c12=dot(u[k],u[l]),c20=dot(u[l],u[j]),cs=[c01,c12,c20],ff=f[j]*f[k]*f[l];value+=.5*ff*c01*c12*c20;
   for(let t=0;t<3;t++){const p=inds[t],b=inds[(t+1)%3],d=inds[(t+2)%3],cb=dot(u[p],u[b]),cd=dot(u[p],u[d]),bd=dot(u[b],u[d]);let g=scale(u[p],.5*dc(r[p])*f[b]*f[d]*cb*cd*bd);g=add(g,scale(add(scale(sub(u[b],scale(u[p],cb)),cd),scale(sub(u[d],scale(u[p],cd)),cb)),.5*ff*bd/r[p]));accumulate(p+1,g);}
  }
 }
 return{value,forces,units:'eV',forceUnits:'eV/Å'};
}
function generate(cfg){const c=validate(cfg),dr=rng(c.seed^0x85ebca6b),sr=rng(c.seed^0x27d4eb2d),n=c.n;let rows=[];
 // Independently stratify all scalar coordinates, then permute strata per dimension.
 const dimensions=c.case==='A'?3:16,vals=Array.from({length:dimensions},()=>shuffle(Array.from({length:n},(_,i)=>(i+dr.next())/n),dr));
 for(let i=0;i<n;i++){let atoms;if(c.case==='A')atoms=geometryA(.75+.6*vals[0][i],.75+.6*vals[1][i],70+75*vals[2][i]);else atoms=[atom(0,'C',[0,0,0]),...tetra.map((v,j)=>atom(j+1,'H',scale(unit(v.map((x,k)=>x+.5*(vals[4*j+k][i]-.5))),.9+.6*vals[4*j+3][i])))];rows.push({id:i+1,groupId:i+1,atoms,reference:reference(atoms,c.case).value});}
 const validation=new Set(shuffle(rows.map(x=>x.id),sr).slice(0,Math.round(n*.2)));rows.forEach(x=>x.split=validation.has(x.id)?'validation':'train');
 const train=rows.filter(x=>x.split==='train'),mu=train.reduce((s,x)=>s+x.reference,0)/train.length,sigma=Math.sqrt(train.reduce((s,x)=>s+(x.reference-mu)**2,0)/train.length);if(!(sigma>1e-10))throw new Error('参考能量方差过小。');
 return{rows,normalization:{mu,sigma},id:`${c.case}:n${n}:seed${c.seed}:generator1`,case:c.case};
}
function scanSpec(which,axis='angle'){return axis==='bond'?{axis,label:'第一条中心键长 / Å',min:which==='A'?.75:.9,max:which==='A'?1.35:1.5,value:which==='A'?1:1.2}:{axis:'angle',label:which==='A'?'H—O—H 夹角 / °':'第一邻居极角 / °',min:which==='A'?70:35,max:which==='A'?145:75,value:which==='A'?104.5:Math.acos(1/Math.sqrt(3))*180/Math.PI};}
function scanAtoms(which,axis,value){const s=scanSpec(which,axis),v=Math.max(s.min,Math.min(s.max,value));if(which==='A')return axis==='bond'?geometryA(v,1,104.5):geometryA(1,1,v);const a=geometryB();a[1].pos=axis==='bond'?scale(tetra[0],v):[1.2*Math.sin(v*Math.PI/180)/Math.sqrt(2),1.2*Math.sin(v*Math.PI/180)/Math.sqrt(2),1.2*Math.cos(v*Math.PI/180)];return a;}
return{defaults,methods,validate,rng,shuffle,clone,generate,reference,scanSpec,scanAtoms,geometryA,geometryB};
});
