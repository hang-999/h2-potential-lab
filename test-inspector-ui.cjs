const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/training-inspector.js','utf8').replace(/export function /g,'function ');
const sandbox={};vm.createContext(sandbox);vm.runInContext(source+'\nthis.api={inspectorPhasePolicy,createInspectorViewState,renderInspectorContent,inspectorResponseSVG};',sandbox);const {api}=sandbox;
const clone=x=>JSON.parse(JSON.stringify(x));
const block={id:'H.L1.w',title:'H 层 1 权重',element:'H',kind:'matrix',shape:[1,1],layerIndex:1,parameterIndices:[0]};
const trace={layers:[{atom:0,element:'H',activations:[[.3],[.4],[.5]],zs:[[.42],[.5]]}],atomicContributions:[.5],offset:.1};
const snapshot={datasetId:'fixed-dataset',step:7,cfg:{method:'acsf',channels:2},parameterCount:1,normalization:{mu:1,sigma:2},probe:{atoms:[{element:'H',pos:[0,0,0]}],reference:1,prediction:2,modelTrace:trace},modelCatalog:{blocks:[block]}};
const inspection={datasetId:snapshot.datasetId,method:'acsf',step:7,token:11,selection:{atomIndex:0,paramIndex:0,layerIndex:1,neuronIndex:0},catalog:{blocks:[block]},block:{...block,parameters:[{index:0,name:'shared H weight',value:.25,before:.25,after:99,gradient:88,delta:77,m:66,v:55,updateStep:8}]},modelExplain:{trace,selectedValue:.4,details:[{id:'test-detail',title:'ACTUAL_DETAIL',formula:'z = wa + b',rows:[{value:.25,gradient:88,derivative:334,adjoint:335,candidateParameter:99}]}]},gradient:{kind:'frozen gradient',paramIndex:0,outputDerivative:2,sampleLossContribution:88,batchGradient:88,sampleContributions:[{id:1,derivative:2,contribution:88}]},optimizer:{optimizer:'adam',learningRate:.003,moments:{m:[66],v:[55]}}};
const lecture={token:11,targetStep:8,samples:[{id:1,atoms:snapshot.probe.atoms,trace}],afterSamples:[{id:1,atoms:snapshot.probe.atoms,trace}]};
const context={snapshot,inspection,trace:lecture,phase:1,committed:false,selection:inspection.selection};
const render=c=>api.renderInspectorContent(c,api.createInspectorViewState());
for(const phase of [1,2]){const html=render({...context,phase});assert(!html.includes('88.00000'),'candidate gradient leaked before phase 3');assert(!html.includes('99.00000'),'candidate parameter leaked before commit');assert(!html.includes('334.00000'),'derivative row leaked before backward stage');assert(!html.includes('66.00000'),'candidate optimizer moment leaked');assert(html.includes('ACTUAL_DETAIL'));}
const third=render({...context,phase:3});assert(third.includes('88.00000'));assert(third.includes('334.00000'));assert(!third.includes('99.00000'));assert(!third.includes('66.00000'));
const notCommitted=render({...context,phase:4});assert(!notCommitted.includes('99.00000'));
const after=clone(inspection);after.step=8;after.block.parameters[0].value=99;
const fourth=render({...context,inspection:after,phase:4,committed:true});assert(fourth.includes('99.00000'));assert(fourth.includes('88.00000'));assert(fourth.includes('66.00000'));
const stale=render({...context,selection:{...context.selection,paramIndex:1}});assert(!stale.includes('ACTUAL_DETAIL'),'stale selected-object record must not be shown');
const staleStep=render({...context,snapshot:{...snapshot,step:9},trace:null,phase:0});assert(!staleStep.includes('ACTUAL_DETAIL'),'stale model Step record must not be shown');
const staleSample=render({...context,selection:{...context.selection,sampleId:99}});assert(!staleSample.includes('ACTUAL_DETAIL'),'same-Step response for another configuration must not be shown');
const injected=clone(context);injected.inspection.modelExplain.details[0].title='<img src=x onerror=alert(1)>';const safe=render(injected);assert(!safe.includes('<img src=x'));assert(safe.includes('&lt;img'));

const soap={...clone(context),snapshot:{...snapshot,cfg:{method:'soap'}},inspection:{...clone(inspection),method:'soap',modelExplain:{details:[],trace:{}},optimizer:{optimizer:'conjugate-gradient',cgAlpha:.2,cgBeta:.3,cg:{rBefore:[1],pBefore:[2],Ap:[3],rAfter:[96],pAfter:[97],rrBefore:1,pAp:6},objectiveBefore:12,objectiveAfter:98,residualNorm:96},kernel:{scale:2,query:[],powers:[],environmentPairs:[]}}};
const soapThird=render({...soap,phase:3});assert(soapThird.includes('pᵀAp'));assert(!soapThird.includes('96.00000'));assert(!soapThird.includes('98.00000'));
soap.inspection.step=8;const soapFourth=render({...soap,phase:4,committed:true});assert(soapFourth.includes('96.00000'));assert(soapFourth.includes('98.00000'));

const features=Array.from({length:70},(_,i)=>({name:'B'+i,featureIndex:i,value:i,weight:.2,contribution:i*.2})),basis={snapshot:{...snapshot,cfg:{method:'moments'},probe:{...snapshot.probe,modelTrace:{features}}},phase:0,selection:{featureIndex:65}};
const view=api.createInspectorViewState();view.featurePage=4;const complete=api.renderInspectorContent(basis,view);assert(complete.includes('B69'));assert(complete.includes('/ 70 项'));
assert(api.inspectorResponseSVG([{x:0,value:2},{x:1,value:2}],{label:'constant'}).includes('<path'));assert(!api.inspectorResponseSVG([{x:0,value:2},{x:1,value:2}],{label:'constant'}).includes('NaN'));
assert(!api.inspectorPhasePolicy({trace:lecture,phase:4,committed:false}).showAfter);
console.log('Inspector UI: phase disclosure, CG semantics, identity isolation, escaping, full pagination and constant response charts passed.');

// Use the actual semantic records so fixture tests cannot conceal schema drift.
(async()=>{
 const Engine=require('./training-engine.js');
 for(const method of ['acsf','soap','moments','messages','vectors','harmonics','mace']){
  const engine=await Engine.createEngine({method,n:40,batch:4,hidden:[3],channels:2,rounds:2,radial:2,lmax:2,correlation:3},{yieldControl:()=>Promise.resolve()});
  const snapshot=await engine.snapshot(),inspection=await engine.explain({selection:{atomIndex:0,round:1,channel:0,featureIndex:1,paramIndex:0,layerIndex:1,neuronIndex:0}}),ctx={snapshot,inspection,selection:inspection.selection,phase:0};
  const view=api.createInspectorViewState(),html=api.renderInspectorContent(ctx,view);
  assert(inspection.modelExplain.details.length>0,method+' missing semantic details');
  assert(html.includes(inspection.modelExplain.details[0].title.replace(/&/g,'&amp;')),method+' detail not rendered');
  assert(!html.includes('NaN'),method+' generated invalid graphic coordinates');
  assert(html.includes('data-ins-select-key="blockId"'),method+' has no parameter catalog');
  for(const detail of inspection.modelExplain.details){view.detailId=detail.id;const html=api.renderInspectorContent(ctx,view);assert(html.includes(detail.title.replace(/&/g,'&amp;')));assert(!html.includes('NaN'),method+'/'+detail.id);}
  if(['messages','vectors','harmonics','mace'].includes(method)){
   const node=inspection.modelExplain.trace.layers.find(l=>l.round===1).nodes[0];
   assert(html.includes(node.aggregate.s[0].toFixed(4)),method+' actual aggregate missing');
   assert(html.includes('Σ 0.5 × m'),method+' aggregate scale missing');
   const readout=await engine.explain({selection:{...inspection.selection,readout:true,layerIndex:2,neuronIndex:0}});
   view.detailId='mlp';const linear=api.renderInspectorContent({...ctx,inspection:readout,selection:readout.selection},view);
   assert(!linear.includes('局部非线性与斜率'),method+' linear readout incorrectly shown as tanh');
  }
  if(method==='acsf'){view.detailId='descriptor';assert(api.renderInspectorContent(ctx,view).includes('固定预缩放'));view.detailId='mlp';assert(api.renderInspectorContent(ctx,view).includes('局部非线性与斜率'));}
  if(method==='soap')assert(html.includes('kernel-matrix-row-next')&&html.includes('kernel-matrix-col-next'));
  assert.equal(engine.save().step,0,'inspection must not train');
  console.log('Actual inspector records: '+method+' passed');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
