const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const messages=[],timers=[];const ctx=vm.createContext({postMessage:m=>messages.push(m),setTimeout:fn=>timers.push(fn)});
vm.runInContext(fs.readFileSync(__dirname+'/operators.js','utf8')+'\n'+fs.readFileSync(__dirname+'/methods-worker.js','utf8'),ctx);
const M=ctx.MLIP,base={atoms:JSON.parse(JSON.stringify(M.presets.environment)),params:JSON.parse(JSON.stringify(M.defaults)),center:0,selected:1,chapter:'acsf',referenceAtoms:JSON.parse(JSON.stringify(M.presets.water)),referenceCenter:0,version:1};
ctx.onmessage({data:{type:'compute',state:base}});ctx.onmessage({data:{type:'compute',state:{...base,version:2}}});
assert.equal(timers.length,1,'pending requests coalesce');timers.shift()();assert.equal(messages.length,1);assert.equal(messages[0].version,2);assert(messages[0].reference.acsf);
const old=JSON.stringify(messages[0].result);ctx.onmessage({data:{type:'compute',state:{...base,version:3,params:{...base.params,cutoff:NaN}}}});timers.shift()();assert.equal(messages[1].type,'error');assert.equal(messages[1].version,3);assert.equal(JSON.stringify(messages[0].result),old,'bad input does not modify valid snapshot');
console.log('Worker contracts passed: coalescing, matching reference, versioned errors and immutable previous results.');
