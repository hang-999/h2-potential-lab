'use strict';
const assert=require('node:assert/strict'),E=require('./training-engine.js'),M=require('./operators.js');
const cases={acsf:'A',soap:'A',moments:'A',messages:'B',vectors:'B',harmonics:'B',mace:'C'};
(async()=>{
 const results=[];
 for(const method of Object.keys(cases).filter(x=>!process.argv[2]||process.argv[2]===x)){
  const started=Date.now(),engine=await E.createEngine({method,case:cases[method]},{yieldControl:async()=>{}}),initial=engine.evaluate(),before=Array.from(engine.parameterValues());
  const baseline=Math.sqrt(engine.validation.reduce((s,x)=>s+(x.reference-engine.normalization.mu)**2,0)/engine.validation.length);
  let updates=0;while(!engine.finished()){await engine.stepOnce();updates++;assert(updates<=4800,method+' exceeded default update budget');}
  const end=engine.evaluate();assert(engine.parameterValues().every(Number.isFinite),method+' has nonfinite parameters');assert(end.validation.rmse<=baseline*.5,method+' did not improve validation RMSE by 50% over training-mean baseline');
  assert(Array.from(engine.parameterValues()).some((v,i)=>v!==before[i]),method+' parameters did not update');
  const sample=engine.validation[0].atoms,transformed=M.transformAtoms(sample,{axis:'y',angle:73,reflection:true}),symmetryResidual=Math.abs(engine.predict(sample)-engine.predict(transformed));assert(symmetryResidual<1e-9,method+' trained-model symmetry failed');
  let referencePredictionError=null;
  if(method==='soap'||method==='moments'){
   const direct=engine.directSolution();assert(Number.isFinite(direct.metrics.validation.rmse));
   if(method==='soap'){
    const saved=Array.from(engine.parameterValues()),pred=engine.validation.map(x=>engine.predict(x.atoms));engine.parameterValues().set(direct.parameters);referencePredictionError=Math.max(...engine.validation.map((x,i)=>Math.abs(engine.predict(x.atoms)-pred[i])));engine.parameterValues().set(saved);assert(referencePredictionError<1e-5,'SOAP CG prediction differs from direct Cholesky solution');
   }
  }
  const report={method,case:cases[method],samples:160,updates,baselineRMSE:baseline,initialRMSE:initial.validation.rmse,validationRMSE:end.validation.rmse,trainRMSE:end.train.rmse,improvement:1-end.validation.rmse/baseline,symmetryResidual,referencePredictionError,elapsedMs:Date.now()-started};results.push(report);console.log(JSON.stringify(report));
 }
 assert(results.length);console.log(JSON.stringify({suite:'default-training-convergence',passed:true,results}));
})().catch(e=>{console.error(e);process.exitCode=1;});
