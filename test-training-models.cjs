'use strict';
const assert=require('node:assert/strict'),M=require('./operators.js'),F=require('./training-models.js');
const methods=['acsf','moments','messages','vectors','harmonics','mace'];
const atoms=M.presets.environment,rotated=M.transformAtoms(atoms,{axis:'z',angle:51,reflection:true}),translated=atoms.map(a=>({...a,pos:a.pos.map((x,k)=>x+[1.7,-.4,.9][k])})),permuted=[atoms[0],atoms[2],atoms[1],atoms[3],atoms[4]];
let maxGradient=0,maxSymmetry=0;
for(const method of methods){
 const model=F.createModel({method}),g=model.prepare(atoms),r=model.forward(g,{trace:true,gradient:true});
 assert(Number.isFinite(r.value));assert.equal(r.gradient.length,model.parameters.length);assert.equal(model.names.length,model.parameters.length);
 for(const group of new Set(model.groups)){
  const candidates=model.groups.map((v,k)=>v===group&&Math.abs(r.gradient[k])>1e-8?k:-1).filter(k=>k>=0);
  assert(candidates.length,method+' has no active '+group+' gradient');
  for(const k of [candidates[0],candidates.at(-1)]){const old=model.parameters[k],h=1e-5;model.parameters[k]=old+h;const plus=model.forward(g).value;model.parameters[k]=old-h;const minus=model.forward(g).value;model.parameters[k]=old;const fd=(plus-minus)/(2*h),err=Math.abs(fd-r.gradient[k])/Math.max(1,Math.abs(fd),Math.abs(r.gradient[k]));maxGradient=Math.max(maxGradient,err);assert(err<2e-7,method+' '+model.names[k]+' gradient '+err);}
 }
 for(const transformed of [rotated,translated,permuted]){const x=model.forward(model.prepare(transformed)).value;maxSymmetry=Math.max(maxSymmetry,Math.abs(x-r.value));assert(Math.abs(x-r.value)<1e-10,method+' invariant output');}
 // A real gradient step changes internal parameters and remains invariant.
 const before=model.parameters.slice(),rate=.001;model.parameters.forEach((v,k)=>model.parameters[k]-=rate*r.gradient[k]);
 assert(model.parameters.some((v,k)=>model.groups[k]!=='readout'&&v!==before[k]));
 const a=model.forward(g).value,b=model.forward(model.prepare(rotated)).value;assert(Math.abs(a-b)<1e-10);
 if(['vectors','harmonics','mace'].includes(method)){
  const t0=model.forward(g,{trace:true}).trace.layers.at(-1),t1=model.forward(model.prepare(rotated),{trace:true}).trace.layers.at(-1);
  const angle=51*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),R=[[-c,-s,0],[-s,c,0],[0,0,1]];
  const mv=v=>R.map(row=>row.reduce((x,a,j)=>x+a*v[j],0));
  for(let i=0;i<atoms.length;i++)for(let k=0;k<4;k++){
   const expected=mv(t0.nodes[i].v[k]);assert(Math.hypot(...expected.map((x,j)=>x-t1.nodes[i].v[k][j]))<1e-10,method+' vector covariance');
   const q=t0.nodes[i].Q[k],rotq=Array.from({length:9},(_,ij)=>{const i0=Math.floor(ij/3),j0=ij%3;let x=0;for(let a0=0;a0<3;a0++)for(let b0=0;b0<3;b0++)x+=R[i0][a0]*q[a0*3+b0]*R[j0][b0];return x;});assert(Math.hypot(...rotq.map((x,j)=>x-t1.nodes[i].Q[k][j]))<1e-10,method+' tensor covariance');
  }
 }
 const again=F.createModel({method});assert.deepEqual(again.parameters,before,method+' deterministic initialization');
}
for(const method of ['harmonics','mace'])for(const lmax of [0,1,2])for(const correlation of [1,2,3]){const m=F.createModel({method,lmax,correlation,channels:1,radial:1,rounds:1}),x=m.forward(m.prepare(atoms),{gradient:true});assert(Number.isFinite(x.value));assert(!x.gradient.some(v=>!Number.isFinite(v)));}
for(const method of ['messages','vectors','harmonics','mace']){const m=F.createModel({method,channels:8,rounds:3,radial:4,angleMessages:true}),r=m.forward(m.prepare(atoms),{gradient:true});assert(Number.isFinite(r.value));assert(!r.gradient.some(v=>!Number.isFinite(v)));}
for(const method of methods){
 const m=F.createModel({method,angleMessages:true}),h=1e-5,at=r=>[{id:1,element:'C',pos:[0,0,0]},{id:2,element:'H',pos:[r,0,0]},{id:3,element:'O',pos:[0,2,0]}];
 const a=m.forward(m.prepare(at(3-h))).value,b=m.forward(m.prepare(at(3+h))).value;assert(Math.abs(a-b)<1e-7,method+' cutoff is discontinuous');
 const empty=[{id:1,element:'C',pos:[0,0,0]},{id:2,element:'H',pos:[8,0,0]},{id:3,element:'O',pos:[0,8,0]}];assert(Number.isFinite(m.forward(m.prepare(empty)).value));
}
for(const method of ['acsf','moments']){
 const m=F.createModel({method}),train=[m.prepare(atoms),m.prepare(atoms.map((a,i)=>({...a,pos:a.pos.map(x=>x*(1+i*.01))})))];m.fitNormalization(train);
 const a=m.forward(train[0],{gradient:true}),b=m.forward(m.prepare(rotated));assert(Math.abs(a.value-b.value)<1e-10);
 if(method==='moments'){const basis=m.basis(train[0]);assert.equal(basis.length,m.parameters.length);assert(Math.abs(basis.reduce((s,x,i)=>s+x*m.parameters[i],0)-a.value)<1e-12);assert(Math.max(...basis.map((x,i)=>Math.abs(x-a.gradient[i])))<1e-12);}
}
console.log(JSON.stringify({suite:'trainable-models',methods:methods.length,maxGradient,maxSymmetry,passed:true}));
