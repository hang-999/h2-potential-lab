'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('./operators.js'),ref=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/reference.json'),'utf8'));
const clone=M.clone,p=clone(M.defaults),atoms=clone(ref.atoms),state={atoms,center:0,selected:1,params:p,version:7};
const close=(a,b,tol=1e-9,label='value')=>assert.ok(M.math.error(a,b)<tol,`${label}: ${M.math.error(a,b)} >= ${tol}`);
const numbers=o=>typeof o==='number'?[o]:Array.isArray(o)?o.flatMap(numbers):o&&typeof o==='object'?Object.values(o).flatMap(numbers):[];
const snapshot=M.compute(state);
close(snapshot.acsf.features.map(f=>f.value),ref.acsf,1e-12,'ACSF independent ordered sum');
close(snapshot.soap.coefficients.map(f=>f.value),ref.soapCoefficients.map(f=>f.value),1e-5,'SOAP independent 3D integral');
close(snapshot.soap.power.map(f=>f.value),ref.soapPower,1e-5,'SOAP power');
close(snapshot.energy.value,ref.energy,1e-12,'reference energy');
close(snapshot.energy.forces,ref.forces,1e-8,'independent central difference forces');
close(M.harmonics(ref.harmonicDirection).groups.flatMap(g=>g.values),ref.harmonics,1e-12,'spherical harmonics');
const tp=M.tensorProduct(ref.tensor.u,ref.tensor.v);
for(const k of ['scalar','axial','symmetric'])close(tp[k],ref.tensor[k],1e-12,`tensor ${k}`);
assert.ok(tp.reconstructionError<1e-12);
assert.equal(snapshot.version,7);
assert.ok(ref.convergenceMaxPowerDifference<1e-9);

let maxSymmetry=0,maxGradient=0;
for(const name of Object.keys(M.presets)){
  for(const axis of ['x','y','z']){
    const st={...state,atoms:clone(M.presets[name]),params:{...p,angleMessages:true},transform:{axis,angle:37.4,reflection:axis==='y'}};
    const out=M.compute(st);const errors=numbers(out.diagnostics);maxSymmetry=Math.max(maxSymmetry,...errors);
    assert.ok(errors.every(e=>e<1e-9),`${name}/${axis}: symmetry failure`);
    const R=M.math.rotation(st.transform);
    for(let round=0;round<=p.rounds;round++)for(let i=0;i<st.atoms.length;i++){
      const n=out.vectors.layers[round].nodes[i],t=out.transformed.vectorLayers[round].nodes[i];
      close(n.s,t.s,1e-12,'current-round scalar');close(n.v.map(v=>M.math.mv(R,v)),t.v,1e-12,'current-round vector');
    }
    const ef=M.energyForces(st.atoms,p),h=1e-5;
    for(let i=0;i<st.atoms.length;i++)for(let k=0;k<3;k++){
      const a=clone(st.atoms),b=clone(st.atoms);a[i].pos[k]+=h;b[i].pos[k]-=h;
      const force=-(M.energyForces(a,p).value-M.energyForces(b,p).value)/(2*h);
      maxGradient=Math.max(maxGradient,Math.abs(force-ef.forces[i][k]));assert.ok(Math.abs(force-ef.forces[i][k])<1e-7);
    }
    close(ef.forces.reduce(M.math.add,[0,0,0]),[0,0,0],1e-12,'net force zero');
  }
}

// No angular information is available from center radii alone, but G4 responds.
const tri=[{id:0,element:'C',pos:[0,0,0]},{id:1,element:'H',pos:[1,0,0]},{id:2,element:'H',pos:[0,1,0]}];
const bend=clone(tri);bend[2].pos=[.5,Math.sqrt(.75),0];
const aa=M.acsf(tri,0,p),ab=M.acsf(bend,0,p);close(aa.radial,ab.radial,1e-12);assert.ok(M.math.error(aa.angular,ab.angular)>1e-4);

// Correlation terms are actual expansions, including repeated indices.
for(let order=1;order<=3;order++){
  const c=M.correlations(atoms,0,{...p,correlation:order});close(c.terms.reduce((s,t)=>s+t.value,0),c.features.at(-1).value,1e-12,`correlation ${order}`);
}
for(const channels of [1,4,8])for(const rounds of [1,2,3]){
  const model=M.messagePassing(atoms,{...p,channels,rounds,angleMessages:true},true);
  assert.equal(model.layers.length,rounds+1);assert.ok(model.layers.every(l=>l.nodes.length===atoms.length&&l.nodes.every(n=>n.s.length===channels&&n.v.length===channels)));
  assert.ok(numbers(model).every(Number.isFinite));assert.equal(model.model.seed,42);
}

// Narrow Gaussian + largest radial basis vs a higher quadrature resolution.
for(const sigma of [.1,.35,1])for(const radial of [1,4])for(const lmax of [0,2]){
  const pp={...p,sigma,radial,lmax,cutoff:5};
  const a=M.soap(atoms,0,pp),b=M.soap(atoms,0,pp,{quadrature:192});
  close(a.coefficients.map(x=>x.value),b.coefficients.map(x=>x.value),1e-7,`quadrature sigma${sigma}/radial${radial}/l${lmax}`);
  close(M.kernel(a,a),1,1e-12);
}
const pinned=M.compute({...state,referenceAtoms:atoms,referenceCenter:0});close(pinned.soap.kernel,1,1e-12,'pinned reference kernel');
const empty=M.compute({...state,params:{...p,cutoff:.5}});assert.equal(empty.geometry.neighbors.length,0);assert.equal(empty.soap.kernel,0);assert.ok(empty.warnings.length);assert.ok(numbers(empty).every(Number.isFinite));
// At the cutoff both value and first derivative vanish; no singular boundary force.
const atBoundary=clone(tri);atBoundary[1].pos=[3,0,0];const e1=M.energyForces(atBoundary,p);atBoundary[1].pos=[3+1e-7,0,0];const e2=M.energyForces(atBoundary,p);close(e1.value,e2.value,1e-7);close(e1.forces,e2.forces,1e-7);
assert.equal(M.math.fc(3,3),0);assert.equal(M.math.dfc(3,3),0);

for(const change of [{cutoff:0},{radial:5},{lmax:3},{channels:9},{rounds:4},{correlation:0},{sigma:0},{eta:NaN},{zeta:1.5},{lambda:0},{weights:[1,2,3]},{angleMessages:1}])assert.throws(()=>M.validate({...state,params:{...p,...change}}));
assert.throws(()=>M.validate({...state,center:99}));assert.throws(()=>M.validate({...state,atoms:atoms.slice(0,2)}));
const overlap=clone(atoms);overlap[1].pos=[.01,0,0];assert.throws(()=>M.validate({...state,atoms:overlap}));
const wrongElement=clone(atoms);wrongElement[1].element='He';assert.throws(()=>M.validate({...state,atoms:wrongElement}));
const wrongReference=clone(atoms);wrongReference[2].id=wrongReference[1].id;assert.throws(()=>M.validate({...state,referenceAtoms:wrongReference}));

// Stage/replay never affects numeric state; no random state is advanced.
assert.deepEqual(M.compute({...state,stage:0}),M.compute({...state,stage:4}));
assert.deepEqual(M.compute(state),snapshot);
const changed=M.compute({...state,params:{...p,weights:[.2,.1,-.3,.4]}});assert.notEqual(changed.messages.total,snapshot.messages.total);
assert.equal(changed.energy.value,snapshot.energy.value);
console.log(JSON.stringify({ok:true,maxSymmetryResidual:maxSymmetry,maxForceDifference:maxGradient,soapReferenceRelative:M.math.error(snapshot.soap.power.map(x=>x.value),ref.soapPower),soapFixtureQuadratureDifference:ref.convergenceMaxPowerDifference,reference:'NumPy direct 3D quadrature + analytic Gram Cholesky'},null,2));
