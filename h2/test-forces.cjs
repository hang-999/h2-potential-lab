/* Independent finite-difference and transaction checks for analytic energy/force training. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/engine.js','utf8'),ctx);
const make=c=>ctx.createEngine(c),close=(a,b,atol=2e-7,rtol=2e-5)=>assert(Math.abs(a-b)<=atol+rtol*Math.max(Math.abs(a),Math.abs(b)),`${a} ≠ ${b}`);
const reference=make({hiddenLayers:[]});
close(reference.morseForce(.7417),0,1e-12,0);
assert(reference.morseForce(.5)>0&&reference.morseForce(1)<0);
close(reference.morseForce(20),0,1e-12,0);
for(const r of [.3,.55,.7417,1.1,2,3])for(const h of [1e-4,1e-5,1e-6])close(reference.morseForce(r),-(reference.morse(r+h)-reference.morse(r-h))/(2*h),2e-6,2e-6);
for(const z of [-1000,-100,-1,0,1,100,1000]){
 const a=ctx.h2Activation('softplus',z),d=ctx.h2Derivative('softplus',z,a),dd=ctx.h2SecondDerivative('softplus',z,a);
 assert(Number.isFinite(a)&&Number.isFinite(d)&&Number.isFinite(dd));assert(d>=0&&d<=1&&dd>=0&&dd<=.25);
}
close(ctx.h2Activation('softplus',0),Math.log(2),1e-15,0);
assert.equal(ctx.H2Config.validate({}).trainingTarget,'energy');
assert.equal(ctx.H2Config.validate({}).forceWeight,1);
for(const config of [{trainingTarget:'unknown'},{forceWeight:-1},{forceWeight:11},{forceWeight:NaN},{trainingTarget:'energy-force',hiddenLayers:[1],activations:['relu']},{trainingTarget:'energy-force',hiddenLayers:[1],activations:['leaky']}])assert.throws(()=>make(config));

// Input derivative check, including the physical sigma_E/sigma_r chain rule.
for(const activation of ['tanh','sigmoid','softplus','relu','leaky']){
 const e=make({hiddenLayers:[3,2],activations:[activation,activation]});e.layers.forEach(l=>l.b.fill(.137));
 for(const r of [.42,.78,1.47,2.8])for(const h of [1e-4,1e-5])close(e.predictForce(r),-(e.predict(r+h)-e.predict(r-h))/(2*h),1e-6,1e-5);
 const n=e.network(.9),s=e.normalization;close(e.predictForce(.9),-s.ys/s.xs*n.derivatives.at(-1)[0],1e-12,0);
}

let parameterChecks=0,maxNormalizedError=0;
const structures=[[],[1],[3,2],[2,3,2]],smooth=['tanh','sigmoid','softplus'];
for(const hiddenLayers of structures)for(const family of [...smooth,'mixed'])for(const forceWeight of [0,.3,1,10]){
 const activations=hiddenLayers.map((_,i)=>family==='mixed'?smooth[i%smooth.length]:family);
 const e=make({hiddenLayers,activations,trainingTarget:'energy-force',forceWeight,n:20}),batch=e.train.slice(1,5);
 e.gradients(batch);
 for(const layer of e.layers)for(const key of ['w','b'])for(let k=0;k<layer[key].length;k++){
  const v=layer[key][k],analytic=layer[key==='w'?'gw':'gb'][k],h=1e-5;
  layer[key][k]=v+h;const plus=e.batchLoss(batch);layer[key][k]=v-h;const minus=e.batchLoss(batch);layer[key][k]=v;
  const numeric=(plus-minus)/(2*h),scale=2e-7+2e-5*Math.max(Math.abs(analytic),Math.abs(numeric));
  maxNormalizedError=Math.max(maxNormalizedError,Math.abs(analytic-numeric)/scale);close(analytic,numeric);parameterChecks++;
  close(analytic,layer[key==='w'?'gew':'geb'][k]+forceWeight*layer[key==='w'?'gfw':'gfb'][k],1e-12,1e-12);
 }
}

// Force loss does not constrain an additive output-energy constant.
const linear=make({hiddenLayers:[],trainingTarget:'energy-force'});linear.gradients(linear.train);
close(linear.layers[0].gfb[0],0,1e-15,0);assert.notEqual(linear.layers[0].gfw[0],0);

for(const optimizer of ['adam','sgd','momentum'])for(const hiddenLayers of structures){
 const cfg={hiddenLayers,activations:hiddenLayers.map((_,i)=>smooth[i%smooth.length]),trainingTarget:'energy-force',forceWeight:.7,optimizer,n:20,batch:3,lr:.003};
 const direct=make(cfg),lesson=make(cfg);
 for(let i=0;i<3;i++){
  const unchanged=JSON.stringify(lesson.saveState()),discard=lesson.prepareStep();assert.equal(JSON.stringify(lesson.saveState()),unchanged);
  lesson.cancelStep();assert.equal(JSON.stringify(lesson.saveState()),unchanged);assert.throws(()=>lesson.commitStep(discard.token));
  const trace=lesson.prepareStep();assert.equal(lesson.prepareStep().token,trace.token);
  for(let l=0;l<lesson.layers.length;l++)for(let k=0;k<lesson.layers[l].w.length;k++){
   const j=Math.floor(k/lesson.sizes[l]),input=k%lesson.sizes[l];
   const energyTerm=trace.samples.reduce((sum,p)=>sum+p.activations[l][input]*p.deltas[l+1][j],0);
   const forceTerm=trace.samples.reduce((sum,p)=>sum+p.activations[l][input]*p.forceDeltas[l+1][j]+p.derivatives[l][input]*p.forceTangentDeltas[l+1][j],0);
   close(energyTerm,trace.update.gradientEnergy.weights[l][k],1e-11,1e-11);close(forceTerm,trace.update.gradientForce.weights[l][k],1e-11,1e-11);
   close(energyTerm+.7*forceTerm,trace.update.gradients[l][k],1e-11,1e-11);
  }
  close(trace.loss.total,trace.loss.energyNormalized+.7*trace.loss.forceNormalized,1e-12,0);
  close(trace.physicalLoss,trace.loss.energyMSE,1e-12,0);
  direct.trainStep(true);lesson.commitStep(trace.token);assert.equal(JSON.stringify(direct.saveState()),JSON.stringify(lesson.saveState()));assert.throws(()=>lesson.commitStep(trace.token));
  const saved=JSON.stringify(lesson.saveState());lesson.network(.7);lesson.predictForce(1);lesson.lessonNetwork({trace,phase:4,sampleIndex:0});assert.equal(JSON.stringify(lesson.saveState()),saved);
 }
}

const energyData=make({}),forceData=make({trainingTarget:'energy-force'});assert.equal(JSON.stringify(energyData.data),JSON.stringify(forceData.data));assert.equal(JSON.stringify(energyData.normalization),JSON.stringify(forceData.normalization));
const rollback=make({hiddenLayers:[2],trainingTarget:'energy-force',optimizer:'sgd'});rollback.cfg.lr=Number.MAX_VALUE;const saved=JSON.stringify(rollback.saveState());assert.throws(()=>rollback.trainStep());assert.equal(JSON.stringify(rollback.saveState()),saved);
const large=make({hiddenLayers:[64,64,64,64],trainingTarget:'energy-force',n:20,batch:1});large.trainStep();assert(Number.isFinite(large.metrics(large.validation).forceRmse));

// Full default runs report outcomes rather than assuming joint training must win.
const results={};
for(const trainingTarget of ['energy','energy-force']){
 const e=make({trainingTarget}),initial=e.metrics(e.validation);while(e.trainStep()){}const final=e.metrics(e.validation);
 assert(final.rmse<initial.rmse*.2,`${trainingTarget}: energy convergence`);
 assert(final.forceRmse<initial.forceRmse*.2,`${trainingTarget}: force convergence`);
 const snap=e.snapshot();assert.equal(snap.step,4000);assert(snap.curve.every(p=>Number.isFinite(p.predictedForce)));assert(snap.data.every(p=>Number.isFinite(p.force)&&Number.isFinite(p.predictedForce)));
 results[trainingTarget]={initial,final,energyImprovement:1-final.rmse/initial.rmse,forceImprovement:1-final.forceRmse/initial.forceRmse};
}
console.log(JSON.stringify({parameterChecks,maxNormalizedError,analyticForces:'PASS',mixedParameterDerivatives:'PASS',transactions:'PASS',results},null,2));
