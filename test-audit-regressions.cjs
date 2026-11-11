const assert=require('node:assert/strict'),M=require('./operators.js'),E=require('./training-engine.js'),D=require('./training-data.js');
(async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const source=fs.readFileSync(path.join(__dirname,'h2/network-panel.js'),'utf8');
 const dependencies=fs.readdirSync(path.join(__dirname,'h2')).filter(x=>x.endsWith('.js')).map(x=>fs.readFileSync(path.join(__dirname,'h2',x),'utf8')).join('\n');
 const activation=dependencies.match(/function h2Activation[^\n]+/)[0],derivative=dependencies.match(/function h2Derivative[^\n]+/)[0];
 const host={clientWidth:310,replaceChildren(x){this.svg=x;}};
 const context={$:()=>host,H2UI:{blue:'blue',green:'green',orange:'orange'},h2Svg:(tag,attrs,parent)=>{const node={tag,attrs,children:[]};parent?.children.push(node);return node;}};
 vm.createContext(context);vm.runInContext(activation+'\n'+derivative+'\n'+source.slice(source.indexOf('function activationPlot('),source.indexOf('function math('))+"\nactivationPlot('relu',0.4,0.4);",context);
 const curve=host.svg.children.find(x=>x.tag==='path'&&x.attrs.stroke==='blue');
 const coords=[...curve.attrs.d.matchAll(/[ML]([^,]+),([^ML]+)/g)].map(x=>[+x[1],+x[2]]);
 assert.ok(Math.abs(coords.at(-1)[1]-coords.at(-2)[1])>.1,'ReLU plot must not have a false saturation plateau');
 const p={...M.defaults,cutoff:3,rounds:1};
 const atoms=r=>[{id:0,element:'C',pos:[0,0,0]},{id:1,element:'H',pos:[1,0,0]},{id:2,element:'O',pos:[0,r,0]}];
 for(const angleMessages of [false,true]){
  const diff=h=>Math.abs(M.messagePassing(atoms(3-h),{...p,angleMessages}).total-M.messagePassing(atoms(3+h),{...p,angleMessages}).total);
  assert.ok(diff(1e-6)<1e-9,'message cutoff continuity');
 }
 assert.deepEqual(M.soapNormalize([0,0]),[0,0]);
 const e=await E.createEngine({method:'soap',case:'A',n:40,cutoff:1.2});await e.stepOnce();
 const a=e.predict(D.geometryA(1.199,1,104.5)),b=e.predict(D.geometryA(1.1999,1,104.5));
 assert.ok(Math.abs(a-b)<.01,'SOAP regression: artificial threshold jump');
 const delta=h=>Math.abs(e.predict(D.geometryA(1.2-h,1,104.5))-e.predict(D.geometryA(1.2+h,1,104.5)));
 assert.ok(delta(1e-6)<1e-5,'SOAP cutoff continuity');
 const empty=M.compute({atoms:atoms(4).map((a,i)=>({...a,pos:[i*6,0,0]})),center:0,selected:1,params:p,transform:{axis:'z',angle:60,reflection:false},stage:2,version:1});
 assert.equal(empty.tensor.available,false);assert.deepEqual(empty.tensor.u,[0,0,0]);assert.deepEqual(empty.tensor.axial,[0,0,0]);
 console.log({auditRegressions:'PASS',soapBefore:a,soapAfter:b,cutoffDelta:delta(1e-6)});
})().catch(e=>{console.error(e);process.exitCode=1});
