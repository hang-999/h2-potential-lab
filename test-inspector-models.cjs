'use strict';
// The inspector must explain the existing operators, not a second approximate model.
const assert=require('node:assert/strict'),F=require('./training-models.js'),M=require('./operators.js');
const methods=['acsf','moments','messages','vectors','harmonics','mace'];
const atoms=M.presets.environment;
const sum=xs=>xs.reduce((s,x)=>s+x,0);
const close=(a,b,label,tol=1e-9)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${label}: ${a} != ${b}`);
const closeArray=(a,b,label)=>{assert.equal(a.length,b.length,label+' length');a.forEach((x,i)=>close(x,b[i],label+' ['+i+']'));};
const detail=(x,id)=>{const found=x.details.find(d=>d.id===id);assert(found,'missing detail '+id);return found;};
const cases=[];
const baseline={acsf:.6182856589867938,moments:.011248066921970458,messages:.8995936104908668,vectors:-1.6216953809479455,harmonics:.4398636340341615,mace:.5760377602455726};

for(const method of methods){
 const model=F.createModel({method}),g=model.prepare(atoms),initial=model.parameters.slice(),catalog=model.describe().blocks;
 close(model.forward(g).value,baseline[method],method+' unchanged baseline');
 const indices=catalog.flatMap(b=>{assert(b.id&&b.title&&b.kind);assert.equal(b.shape.reduce((p,x)=>p*x,1),b.parameterIndices.length,b.id+' shape');return b.parameterIndices;});
 assert.equal(new Set(catalog.map(b=>b.id)).size,catalog.length,'stable unique block ids');
 assert.deepEqual(indices.slice().sort((a,b)=>a-b),Array.from({length:initial.length},(_,i)=>i),'every parameter appears in exactly one block');
 assert.deepEqual(catalog,F.createModel({method}).describe().blocks,'deterministic catalog');
 // The caller can edit a returned catalog without changing the model's directory.
 catalog[0].parameterIndices[0]=-1;assert.equal(model.describe().blocks[0].parameterIndices[0],0);
 const override=Float64Array.from(initial,(x,i)=>x+.013*Math.sin(i+1)),other=F.createModel({method});other.setParameters(override);
 const expected=other.forward(other.prepare(atoms),{gradient:true}),actual=model.forward(g,{parameters:override,trace:true,gradient:true});
 close(actual.value,expected.value,method+' override prediction');closeArray(actual.gradient,expected.gradient,method+' override gradients');
 assert.deepEqual(model.parameters,initial,method+' forward override mutated active parameters');
 const chosen=[...new Set(model.groups)].map(group=>model.groups.findIndex((v,i)=>v===group&&Math.abs(actual.gradient[i])>1e-9)).filter(i=>i>=0);
 chosen.push(initial.length-1);
 for(const paramIndex of chosen){
  const x=model.explain(g,{paramIndex,atomIndex:0,round:2,channel:1,featureIndex:8},{parameters:override});
  close(x.value,expected.value,method+' explained override output');
  close(x.parameter.derivative,actual.gradient[paramIndex],method+' selected derivative');
  close(sum(x.parameterUses.map(use=>use.derivative)),actual.gradient[paramIndex],method+' shared usage reconstruction');
  for(const use of x.parameterUses)close(use.derivative,use.localDerivative*use.adjoint,'local × adjoint');
  const eps=1e-6,plus=override.slice(),minus=override.slice();plus[paramIndex]+=eps;minus[paramIndex]-=eps;
  close(x.parameter.derivative,(model.forward(g,{parameters:plus}).value-model.forward(g,{parameters:minus}).value)/(2*eps),method+' parameter finite difference',2e-7);
  close(x.selectedValue,model.responseValue(actual.trace,x.selection),method+' response uses same semantic quantity');
  assert(!('tape' in x)&&!('gradient' in x),'do not send full Tape or full gradient array');
 }
 assert.deepEqual(model.parameters,initial,method+' explain mutated active parameters');
 assert.throws(()=>model.forward(g,{parameters:[0]}),/长度/);
 cases.push({method,parameters:initial.length,blocks:model.describe().blocks.length});
}

// ACSF angular pairs include both ordered terms. Inspect all feature banks after
// fitting normalization on training geometries, then reconstruct the MLP input.
{
 const m=F.createModel({method:'acsf',hidden:[3,2],radial:2}),geometries=[atoms,atoms.map((a,i)=>({...a,pos:a.pos.map(x=>x*(1+.02*i))})),atoms.map(a=>({...a,pos:a.pos.map(x=>x*.85)}))].map(a=>m.prepare(a));m.fitNormalization(geometries);const g=geometries[0];
 for(let atomIndex=0;atomIndex<atoms.length;atomIndex++)for(let featureIndex=0;featureIndex<g.features[atomIndex].length;featureIndex++){
  const x=m.explain(g,{atomIndex,featureIndex,layerIndex:0,neuronIndex:featureIndex}),d=detail(x,'descriptor');
  close(sum(d.rows.map(x=>x.value)),d.rawG,'ACSF neighbor/triple sum');close(d.rawG/2,d.rawValue,'ACSF G/2');close(d.rawValue,g.features[atomIndex][featureIndex],'ACSF exact bank');
  close((d.rawValue-d.mean)/d.scale,d.output,'ACSF training normalization');
  close(d.output,x.trace.layers[atomIndex].activations[0][featureIndex],'ACSF normalized input');close(d.output,x.selectedValue,'ACSF response input');
 }
 for(const layerIndex of [1,2,3]){const x=m.explain(g,{atomIndex:0,layerIndex,neuronIndex:0}),d=detail(x,'mlp');close(sum(d.rows.map(r=>r.product)),d.z,'MLP weighted sum');close(d.output,layerIndex===3?d.z:Math.tanh(d.z),'MLP activation');close(d.localDerivative,layerIndex===3?1:1-d.output**2,'MLP local derivative');}
}

// Moment features must preserve their radial/species/central atom order.
{
 const m=F.createModel({method:'moments',radial:1}),g=m.prepare(atoms),g2=m.prepare(atoms.map(a=>({...a,pos:a.pos.map(x=>x*1.05)})));m.fitNormalization([g,g2]);
 for(let featureIndex=0;featureIndex<g.features.length;featureIndex++){
  const x=m.explain(g,{featureIndex}),d=detail(x,'moments');
  close(sum(d.rows.map(r=>r.value)),g.features[featureIndex],'moment atom contraction sum');close(d.rawValue,g.features[featureIndex],'moment raw feature');
  close((d.rawValue-d.mean)/d.scale,d.output,'moment normalization');close(d.output,x.selectedValue,'moment response');
  const l=detail(x,'linear-readout');close(l.offset+sum(l.rows.map(r=>r.contribution)),x.value,'moment linear output');
  for(const row of d.rows)for(const side of [row.left,row.right]){close(sum(side.neighbors.map(e=>e.weight)),side.s,'raw moment S');for(let k=0;k<3;k++)close(sum(side.neighbors.map(e=>e.weight*e.u[k])),side.v[k],'raw moment v');for(let k=0;k<9;k++)close(sum(side.neighbors.map(e=>e.weight*e.Y[k])),side.Q[k],'raw moment Q');close(sum(side.Q.map(q=>q*q)),sum(side.Q5.map(q=>q*q)),'Q5 is orthonormal');}
 }
 const empty=m.prepare([{id:1,element:'C',pos:[0,0,0]},{id:2,element:'H',pos:[8,0,0]},{id:3,element:'O',pos:[0,8,0]}]);
 const fresh=F.createModel({method:'moments',radial:1}),x=fresh.explain(fresh.prepare(empty.atoms),{paramIndex:fresh.parameters.length-1});close(sum(x.parameterUses.map(r=>r.derivative)),1,'direct offset output derivative');
}

for(const method of ['messages','vectors','harmonics','mace']){
 const m=F.createModel({method,channels:2,rounds:2,radial:2,angleMessages:true}),g=m.prepare(atoms),params=m.parameters.slice();
 for(const round of [1,2]){
  const x=m.explain(g,{atomIndex:0,round,channel:1,edgeFrom:1,featureIndex:8}),a=detail(x,'aggregate'),paths=detail(x,'paths'),node=detail(x,'node-update'),radial=detail(x,'radial'),mix=detail(x,'mixing');
  close(sum(a.rows.map(r=>r.s)),a.output.s,'scalar aggregation');
  for(let k=0;k<3;k++)close(sum(a.rows.map(r=>r.v[k])),a.output.v[k],'vector aggregation');
  for(let k=0;k<9;k++)close(sum(a.rows.map(r=>r.Q[k])),a.output.Q[k],'tensor aggregation');
  for(const edge of a.rows){close(edge.s,.5*edge.raw.s,'scalar aggregation factor');closeArray(edge.v,edge.raw.v.map(x=>x*.5),'vector aggregation factor');closeArray(edge.Q,edge.raw.Q.map(x=>x*.5),'tensor aggregation factor');}
  for(const filter of radial.rows){close(sum(filter.products),filter.value,'radial basis sum');filter.parameterIndices.forEach((p,k)=>close(filter.products[k],params[p]*filter.basis[k],'radial term'));}
  close(sum(paths.rows.filter(r=>r.outputType==='scalar').map(r=>r.contribution)),paths.raw.s,'scalar path reconstruction');
  if(['vectors','harmonics','mace'].includes(method)){
   for(let k=0;k<3;k++)close(sum(paths.rows.filter(r=>r.outputType==='vector').map(r=>r.contribution[k])),paths.raw.v[k],'vector path reconstruction');
   for(let k=0;k<9;k++)close(sum(paths.rows.filter(r=>r.outputType==='tensor').map(r=>r.contribution[k])),paths.raw.Q[k],'tensor path reconstruction');
  }
  for(let l=0;l<=2;l++){const rows=mix.rows.filter(r=>r.representation===l),out=l===0?mix.output.s:l===1?mix.output.v:mix.output.Q;if(rows.length){if(l===0)close(sum(rows.map(r=>r.product)),out,'scalar channel mixing');else out.forEach((v,k)=>close(sum(rows.map(r=>r.product[k])),v,'geometric channel mixing'));}}
  close(sum(node.rows.map(r=>r.value)),node.z,'node weighted preactivation');close(Math.tanh(node.z),node.output,'node tanh');
  for(let k=0;k<3;k++)close(node.after.v[k],node.gate.value*(a.output.v[k]+.5*node.before.v[k]),'vector gate');
  if(method==='harmonics'||method==='mace')for(let k=0;k<9;k++)close(node.after.Q[k],node.gate.value*(a.output.Q[k]+.5*node.before.Q[k]),'tensor gate');
  close(sum(node.after.Q.map(q=>q*q)),sum(node.after.Q5.map(q=>q*q)),'updated Q5 norm');close(node.after.Q[0]+node.after.Q[4]+node.after.Q[8],0,'tensor is traceless');
  for(const component of ['scalar','vx','vy','vz','norm-v','q1','q2','q3','q4','q5','norm-Q']){const e=m.explain(g,{atomIndex:0,round,channel:1,component});close(e.selectedValue,m.responseValue(x.trace,e.selection),component+' response');}
 }
 const r=m.explain(g,{atomIndex:1,readout:true,layerIndex:2,neuronIndex:0}),l=detail(r,'mlp');close(r.selectedValue,r.trace.atomicContributions[1],'readout response = atomic output');close(sum(l.rows.map(row=>row.product)),l.output,'readout weighted sum');
 const readoutBlock=m.describe().blocks.find(b=>b.readout),back=m.explain(g,{atomIndex:1,round:2,channel:0,readout:false,blockId:readoutBlock.id});close(back.selectedValue,back.trace.layers.at(-1).nodes[1].s[0],'explicit exit from readout overrides old parameter block');
 assert.deepEqual(m.parameters,params,'detailed graph inspection is read-only');
}

// Every MACE contraction is a full ordered neighbor-density product, including
// repeated neighbors. Test lmax-degenerate models as well as nonzero tensors.
for(const lmax of [0,1,2])for(const correlation of [1,2,3]){
 const m=F.createModel({method:'mace',channels:1,rounds:2,radial:1,lmax,correlation}),g=m.prepare(atoms),first=m.explain(g,{round:2,atomIndex:0,channel:0}),rows=detail(first,'correlations').rows;
 for(const row of rows){const x=m.explain(g,{round:2,atomIndex:0,channel:0,featureIndex:row.featureIndex}),d=detail(x,'ordered-correlation'),edges=detail(x,'aggregate').rows;assert.equal(d.rows.length,edges.length**d.degree,'complete ordered neighbor tuples');close(d.output,row.value,'ordered expansion reconstructs contraction');if(d.degree>1)assert(d.rows.some(r=>r.repeated),'include repeated neighbors');}
}

for(const lmax of [0,1,2]){
 const m=F.createModel({method:'harmonics',channels:1,rounds:2,radial:1,lmax}),g=m.prepare(atoms);
 for(const round of [1,2]){const x=m.explain(g,{round,atomIndex:0,edgeFrom:1}),p=detail(x,'paths');for(const path of p.rows)assert(m.describe().blocks.some(b=>b.round===round&&b.path===path.path),'only actually allocated tensor paths');}
}
console.log(JSON.stringify({suite:'inspector-models',passed:true,cases}));
