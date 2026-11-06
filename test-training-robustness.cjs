'use strict';
const assert=require('node:assert/strict'),E=require('./training-engine.js'),D=require('./training-data.js'),M=require('./operators.js');
const hooks={yieldControl:async()=>{}},near=(a,b,tol=1e-12)=>assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
(async()=>{
 const started=Date.now(),optimizerResults=[];
 for(const optimizer of ['sgd','momentum','adam']){
  const e=await E.createEngine({method:'acsf',case:'A',hidden:[],n:40,epochs:2,optimizer,schedule:'constant',lr:.003},hooks);
  const initial=e.save();assert.equal(e.model.parameters.length,3*(33+1)+1,'zero hidden layers should be affine in ACSF');
  const sampleTrace=e.model.forward(e.prepared.get(e.train[0].id),{trace:true}).trace;
  assert(sampleTrace.layers.every(layer=>layer.activations.length===2));
  let selected=-1;
  for(let step=1;step<=2;step++){
   const old=e.save(),result=await e.stepOnce(),g=result.update.gradients,newState=e.save();
   if(selected<0)selected=g.findIndex(x=>Math.abs(x)>1e-6);assert(selected>=0);
   for(let i=0;i<g.length;i++){
    let expectedM=old.m[i],expectedV=old.v[i],direction=g[i];
    if(optimizer==='momentum'){expectedM=.9*old.m[i]+g[i];direction=expectedM;}
    if(optimizer==='adam'){expectedM=.9*old.m[i]+.1*g[i];expectedV=.999*old.v[i]+.001*g[i]*g[i];direction=expectedM/(1-.9**step)/(Math.sqrt(expectedV/(1-.999**step))+1e-8);}
    near(newState.m[i],expectedM);near(newState.v[i],expectedV);near(e.model.parameters[i],old.parameters[i]-.003*direction);
   }
   assert.equal(newState.step,step);assert.equal(newState.cursor,step*8);assert.equal(newState.completedEpochs,0);
  }
  assert(e.model.parameters[selected]!==initial.parameters[selected]);optimizerResults.push({optimizer,steps:2,parameter:e.model.names[selected],finite:true});
 }
 for(const field of ['angleMessages','radialOnly'])for(const value of ['false',0,null,{}])assert.throws(()=>E.validate({[field]:value}),e=>e.field===field,'non-boolean setting accepted');
 const maxStarted=Date.now(),max=await E.createEngine({method:'harmonics',case:'B',n:40,batch:2,epochs:1,channels:8,rounds:3,radial:4,lmax:2},hooks),baseline=max.save();
 let transaction=await max.prepareStep();assert.equal(transaction.targetStep,1);assert.deepEqual(max.save(),baseline,'prepare mutated committed model');
 const again=await max.prepareStep();assert.equal(again.token,transaction.token);assert.deepEqual(max.save(),baseline);
 max.cancelStep();assert.deepEqual(max.save(),baseline);assert.throws(()=>max.commitStep(transaction.token));
 await max.stepOnce();const ordinary=max.save();max.restore(baseline);
 transaction=await max.prepareStep();const copy=JSON.parse(JSON.stringify(transaction));assert.deepEqual(max.save(),baseline);max.commitStep(transaction.token);
 assert.deepEqual(max.save(),ordinary,'maximum model lesson update differs from ordinary step');assert(max.parameterValues().every(Number.isFinite));
 assert.throws(()=>max.commitStep(transaction.token));for(let i=0;i<4;i++)JSON.stringify(copy);assert.deepEqual(max.save(),ordinary,'trace replay changed model');
 const maximumModel={parameters:max.model.parameters.length,step:ordinary.step,elapsedMs:Date.now()-maxStarted};
 const forceEngine=await E.createEngine({method:'vectors',case:'B',n:40,channels:2,rounds:1,epochs:1},hooks);for(let i=0;i<3;i++)await forceEngine.stepOnce();
 forceEngine.probe({axis:'bond',value:1.14});const beforeForce=forceEngine.save(),f=await forceEngine.force();assert.deepEqual(forceEngine.save(),beforeForce,'force inspection changed training');
 const atoms=D.scanAtoms('B','bond',1.14),rotated=M.transformAtoms(atoms,{axis:'z',angle:60,reflection:false}),h=f.h;
 const rf=rotated.map(()=>[0,0,0]);for(let i=0;i<rotated.length;i++)for(let k=0;k<3;k++){const old=rotated[i].pos[k];rotated[i].pos[k]=old+h;const plus=forceEngine.predict(rotated);rotated[i].pos[k]=old-h;const minus=forceEngine.predict(rotated);rotated[i].pos[k]=old;rf[i][k]=(minus-plus)/(2*h);}
 const c=.5,s=Math.sqrt(3)/2,expected=f.prediction.map(v=>[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]]),forceRotationResidual=Math.max(...rf.flatMap((v,i)=>v.map((x,k)=>Math.abs(x-expected[i][k]))));
 assert(forceRotationResidual<1e-7,'finite-difference forces failed rotation covariance');assert(f.energyRotationResidual<1e-10);assert.deepEqual(forceEngine.save(),beforeForce);
 console.log(JSON.stringify({suite:'training-robustness',passed:true,optimizerResults,maximumModel,forceRotationResidual,elapsedMs:Date.now()-started}));
})().catch(e=>{console.error(e);process.exitCode=1;});
