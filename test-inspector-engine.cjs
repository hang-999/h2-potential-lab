'use strict';
const assert=require('node:assert/strict'),E=require('./training-engine.js'),D=require('./training-data.js');
const close=(a,b,message)=>assert(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b)),message+': '+a+' vs '+b);
const fast={n:40,batch:7,epochs:2,channels:1,rounds:1,radial:1,hidden:[3],seed:42};
(async()=>{
 const results=[];
 for(const method of ['acsf','soap','moments','messages','vectors','harmonics','mace']){
  const e=await E.createEngine({...fast,method,case:['acsf','soap','moments'].includes(method)?'A':method==='mace'?'C':'B'},{yieldControl:()=>Promise.resolve()}),initial=e.save(),p=await e.snapshot();
  assert(p.modelCatalog.blocks.length,method+' static parameter blocks');
  if(p.modelCatalog.blocks.length>1){const first=p.modelCatalog.blocks[0],last=p.modelCatalog.blocks.at(-1),index=last.parameterIndices[0],pick=await e.explain({selection:{blockId:first.id,paramIndex:index}});assert.equal(pick.selection.paramIndex,index,'explicit parameter wins over stale block');assert.equal(pick.selection.blockId,last.id);}
  const rec=await e.prepareStep(),sampleId=rec.samples[0].id,paramIndex=method==='soap'?0:rec.update.gradients.findIndex((g,i)=>Math.abs(g)>1e-7&&e.model.groups[i]!=='readout');
  assert.equal(rec.beforePredictions.length,fast.n);assert.equal(rec.afterPredictions.length,fast.n);
  for(const q of rec.beforePredictions)close(q.prediction,p.data.find(x=>x.id===q.id).prediction,method+' all frozen before predictions');
  assert(paramIndex>=0,method+' active internal parameter');
  let calls=0;const rawForward=e.model?.forward;if(rawForward)e.model.forward=(...args)=>{calls++;return rawForward(...args);};
  const before=e.save(),inspection=await e.explain({token:rec.token,phase:3,selection:{sampleId,paramIndex,atomIndex:0,round:1,channel:0}});
  if(rawForward){assert(calls<=rec.batchIds.length+3,'explain must not reevaluate dataset or scan');e.model.forward=rawForward;}
  assert.deepEqual(e.save(),before,method+' explain mutated model');
  assert.equal(inspection.step,rec.targetStep-1);assert.equal(inspection.gradient.modelStep,inspection.step);
  close(inspection.prediction,rec.samples.find(x=>x.id===sampleId).prediction,method+' before prediction');
  close(inspection.gradient.batchGradient,rec.update.gradients[paramIndex],method+' batch gradient');
  if(method!=='soap'){
   close(inspection.gradient.sampleContributions.reduce((s,x)=>s+x.contribution,0),rec.update.gradients[paramIndex],method+' samples reconstruct gradient');
   close(inspection.gradient.sharedUses.reduce((s,x)=>s+x.contribution,0),inspection.gradient.sampleLossContribution,method+' parameter uses reconstruct selected sample gradient');
  }else{
   close(inspection.kernel.query.reduce((s,x)=>s+x.contributionEV,0)+e.normalization.mu,inspection.prediction,'SOAP contribution energy');
   close(inspection.kernel.environmentPairs.reduce((s,x)=>s+x.kernelContribution,0),inspection.kernel.query[paramIndex].kernel,'SOAP environment kernel');
   close(rec.update.cg.rrBefore/rec.update.cg.pAp,rec.update.cgAlpha,'CG step');
   close(rec.update.cg.rrAfter/rec.update.cg.rrBefore,rec.update.cgBeta,'CG beta');
   const cross=await e.explain({token:rec.token,phase:1,selection:{sampleId,paramIndex:0,kernelRowOffset:0,kernelColOffset:24}}),mat=cross.kernel.matrix;
   assert.equal(mat.rowOffset,0);assert.equal(mat.colOffset,24);assert.equal(mat.colIds.length,8);
   for(let j=0;j<mat.colIds.length;j++)close(mat.values[0][j],cross.kernel.query[24+j].kernel,'cross-page kernel cells');
  }
  e.commitStep(rec.token);const committedSnapshot=await e.snapshot(),committed=e.save(),after=await e.explain({token:rec.token,phase:4,selection:{sampleId,paramIndex}});
  for(const q of rec.afterPredictions)close(q.prediction,committedSnapshot.data.find(x=>x.id===q.id).prediction,method+' all frozen after predictions');
  const replay=await e.explain({token:rec.token,phase:1,selection:{sampleId,paramIndex}});close(replay.prediction,rec.beforePredictions.find(q=>q.id===sampleId).prediction,'replay reads original frozen prediction');
  assert.deepEqual(e.save(),committed,method+' committed replay mutated model');close(after.prediction,rec.afterSamples.find(x=>x.id===sampleId).prediction,method+' after prediction');
  for(const kind of ['translation','rotation','reflection','permutation']){const r=await e.symmetry({selection:{sampleId,paramIndex},kind});assert(r.residuals.energy<1e-9,method+' '+kind+' energy');for(const key of ['scalar','vector','tensor'])if(r.residuals[key]!=null)assert(r.residuals[key]<1e-9,method+' '+kind+' '+key);assert.deepEqual(e.save(),committed,'symmetry is read-only');}
  const cancel=await e.prepareStep();e.cancelStep();await assert.rejects(()=>e.explain({token:cancel.token,phase:1}),/失效/);
  await assert.rejects(()=>e.explain({selection:{sampleId,paramIndex},response:true},{cancelled:()=>true}),error=>error.cancelled===true);assert.deepEqual(e.save(),committed,'cancelled explanation is read-only');
  results.push({method,parameters:p.parameterCount,step:after.step});
 }
 const local=await E.createEngine({...fast,method:'messages',case:'B'},{yieldControl:()=>Promise.resolve()}),row=local.dataset.rows[4],original=D.clone(row.atoms);local.select({sampleId:row.id,atomIndex:2});local.probe({mode:'local',atomIndex:2});let p=await local.snapshot();assert.equal(p.slice.anchorId,row.id);assert.equal(p.slice.atomIndex,2);assert.deepEqual(p.slice.anchorAtoms,original);close(p.probe.value,p.slice.anchorValue,'local anchor marker');assert.deepEqual(p.probe.atoms,original,'local scan starts at chosen structure');
 local.probe({value:1.45});p=await local.snapshot();for(let i=0;i<original.length;i++)if(i!==2)assert.deepEqual(p.probe.atoms[i],original[i],'other coordinates fixed');assert.deepEqual(local.dataset.rows[4].atoms,original,'dataset immutable');assert.equal(p.slice.anchorId,row.id);
 const response=await local.explain({selection:{atomIndex:2,channel:0,round:1},response:true});assert.equal(response.response.points.length,61);assert(response.response.points.every(x=>Number.isFinite(x.value)));
 local.probe({mode:'baseline'});p=await local.snapshot();assert.equal(p.slice.mode,'baseline');
 const a=await E.createEngine({...fast,method:'acsf',case:'A'},{yieldControl:()=>Promise.resolve()}),arow=a.dataset.rows[0];a.select({sampleId:arow.id});a.probe({mode:'local',axis:'bond2',value:1.3});const aview=await a.snapshot();assert.deepEqual(aview.probe.atoms[1],arow.atoms[1]);close(Math.hypot(...aview.probe.atoms[2].pos),1.3,'second A bond');a.probe({axis:'angle',value:110});const angle=await a.snapshot();close(D.localScanSpec('A','angle',angle.probe.atoms).value,110,'anchored A angle');
 const first=(await local.snapshot()).batches.order;for(let i=0;i<5;i++)await local.stepOnce();p=await local.snapshot();assert.equal(p.batches.epoch,1);assert.equal(p.batches.groups.at(-1).ids.length,4);assert.equal(p.batches.cursor,32);assert(p.batches.groups.every(g=>g.status==='done'));const nextEpoch=await local.prepareStep(),preview=await local.snapshot();assert.equal(preview.batches.epoch,2);assert.equal(preview.batches.cursor,0);assert.deepEqual(preview.batches.groups[0].ids,nextEpoch.batchIds);assert.equal(preview.batches.groups[0].status,'prepared');assert.deepEqual(local.save().order,first,'preview does not shuffle committed state');local.cancelStep();assert.equal((await local.snapshot()).batches.epoch,1);await local.stepOnce();p=await local.snapshot();assert.equal(p.batches.epoch,2);assert.deepEqual(p.batches.order,preview.batches.order);assert.notDeepEqual(p.batches.order,first);assert.equal(p.batches.cursor,7);
 const fs=require('node:fs'),vm=require('node:vm'),sent=[],ctx=vm.createContext({MLIPTraining:E,setTimeout,clearTimeout,Date,Map,Number,Promise,postMessage:m=>sent.push(m)});vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'training-worker.js'),'utf8'),ctx);
 const send=m=>ctx.onmessage({data:{session:'acsf',version:1,...m}}),wait=async pred=>{const begin=Date.now();while(!pred()){if(Date.now()-begin>30000)throw Error('Inspector Worker timeout '+JSON.stringify(sent.at(-1)));await new Promise(r=>setTimeout(r,10));}};
 send({type:'init',cfg:{...fast,method:'acsf',case:'A'}});await wait(()=>sent.some(x=>x.type==='ready'));const snapshots=sent.filter(x=>x.snapshot).length;
 for(let i=1;i<=8;i++)send({type:'explain',explainRequestId:i,selection:{sampleId:1,atomIndex:0,paramIndex:i}});
 await wait(()=>sent.some(x=>x.type==='explained'&&x.explainRequestId===8));assert.equal(sent.filter(x=>x.snapshot).length,snapshots,'explain must not run full evaluation/snapshot');assert(!sent.some(x=>x.type==='explained'&&x.explainRequestId<8),'queued stale selections omitted');assert.equal(sent.findLast(x=>x.type==='explained').inspection.step,0);
 send({type:'symmetry',explainRequestId:9,kind:'rotation',selection:{sampleId:1}});await wait(()=>sent.some(x=>x.type==='symmetry'&&x.explainRequestId===9));assert.equal(sent.at(-1).result.step,0);
 send({type:'explain',version:0,explainRequestId:10});await new Promise(r=>setTimeout(r,30));assert(!sent.some(x=>x.explainRequestId===10),'wrong configuration version omitted');
 send({type:'explain',explainRequestId:31,selection:{sampleId:1,paramIndex:2}});send({type:'symmetry',explainRequestId:1,kind:'reflection',selection:{sampleId:1}});await wait(()=>sent.some(x=>x.type==='explained'&&x.explainRequestId===31)&&sent.some(x=>x.type==='symmetry'&&x.explainRequestId===1));
 send({type:'explain',explainRequestId:32,token:999,phase:1});await wait(()=>sent.some(x=>x.type==='error'&&x.explainRequestId===32));assert.equal(sent.at(-1).requestType,'explain');assert.equal(sent.at(-1).readonly,true);send({type:'snapshot'});await wait(()=>sent.at(-1)?.snapshot);assert.equal(sent.at(-1).snapshot.error,null,'read-only errors must not contaminate training state');
 console.log(JSON.stringify({suite:'training-inspector-engine',results,localScans:'PASS',gradientReconstruction:'PASS',symmetry:'PASS',readOnly:'PASS',batchOrder:'PASS',workerExplanation:'PASS'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
