// Exercise the actual controller's pure view and request-scheduling functions.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/training-ui.js','utf8');
const functions=['displaySnapshot','selection','requestInspection'].map(name=>source.split(/\r?\n/).find(line=>line.startsWith(' function '+name+'('))).join('\n');
const callbacks=new Map(),sent=[];let nextTimer=0;
const sessionState={version:1,snapshot:{step:8,datasetId:'dataset',data:[{id:1,split:'train',reference:1,prediction:10},{id:2,split:'validation',reference:2,prediction:20}],latest:{value:'after'},slice:{value:'after'}},sampleId:1,atomIndex:0,paramIndex:2,selection:{round:2,channel:1},trace:{token:9,targetStep:8,batchIds:[1],beforePredictions:[{id:1,prediction:3},{id:2,prediction:4}],afterPredictions:[{id:1,prediction:10},{id:2,prediction:20}],beforeMetrics:{value:'before'},afterMetrics:{value:'after'},beforeSlice:{value:'before'},afterSlice:{value:'after'}},phase:1,committed:true};
const sandbox={session:()=>sessionState,active:'soap',shown:true,inspectionTimer:0,renderInspector(){},worker:{postMessage:m=>sent.push(m)},setTimeout:fn=>{callbacks.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>callbacks.delete(id)};
vm.createContext(sandbox);vm.runInContext(functions+'\nthis.api={displaySnapshot,selection,requestInspection};',sandbox);
const before=JSON.stringify(sessionState.snapshot),d=sandbox.api.displaySnapshot();assert.equal(d.step,7);assert.equal(d.data[1].prediction,4,'validation replay must use frozen before prediction too');assert.equal(d.latest.value,'before');assert.equal(d.slice.value,'before');
sessionState.phase=4;const after=sandbox.api.displaySnapshot();assert.equal(after.step,8);assert.equal(after.data[1].prediction,20);assert.equal(JSON.stringify(sessionState.snapshot),before,'read-only display mutated active snapshot');
sessionState.trace=null;assert.equal(sandbox.api.displaySnapshot(),sessionState.snapshot);
sandbox.api.requestInspection({kernelRowOffset:16,kernelColOffset:32});const first=sessionState.inspectRequest;
sessionState.sampleId=2;sandbox.api.requestInspection({response:true});assert.equal(sessionState.inspectRequest,first+1,'new selection must invalidate replies before its delayed send');assert.equal(callbacks.size,1);
for(const callback of callbacks.values())callback();assert.equal(sent.length,1);assert.equal(sent[0].selection.sampleId,2);assert.equal(sent[0].selection.kernelRowOffset,16);assert.equal(sent[0].selection.kernelColOffset,32);assert.equal(sent[0].explainRequestId,first+1);assert.equal(sent[0].response,true);assert.equal(sent[0].type,'explain');
console.log('Training workspace: full-data frozen replay, immutable display, latest-selection scheduling and kernel pagination passed.');
