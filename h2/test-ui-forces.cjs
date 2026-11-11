// Execute the actual settings controller and CSV receive handler with a small DOM.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
class Element {
 constructor(id='',tag='DIV'){this.id=id;this.tagName=tag;this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.className='';this.events={};this._value='';this._html='';this.options=[];}
 get value(){return this._value;}set value(v){this._value=String(v);}
 get valueAsNumber(){return Number(this.value);}
 set innerHTML(value){this._html=value;if(this.className==='layer-row'){const width=new Element('width-'+(/data-width="(\d+)"/.exec(value)?.[1]??0),'INPUT');width.value=/value="([^"]+)"/.exec(value)?.[1]??'';width.dataset.width=/data-width="(\d+)"/.exec(value)?.[1];const activation=new Element('','SELECT');activation.dataset.activation=/data-activation="(\d+)"/.exec(value)?.[1];this.children=[width,activation];}}
 get innerHTML(){return this._html;}
 append(element){this.children.push(element);element.parentElement=this;}
 replaceChildren(...elements){this.children=elements;}
 querySelector(selector){return this.children.find(x=>x.tagName===selector.toUpperCase());}
 addEventListener(type,fn){this.events[type]=fn;}
 focus(){}scrollIntoView(){}click(){this.onclick?.();}
}
const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
const ratios=element('validationRatio');ratios.tagName='SELECT';ratios.options=[.1,.15,.2,.25,.3,.35,.4].map(value=>({value:String(value)}));
const document={getElementById:element,createElement:tag=>new Element('',tag.toUpperCase()),querySelectorAll:selector=>element('layer-editors').children.flatMap(x=>x.children).filter(x=>selector==='[data-width]'?x.dataset.width!==undefined:selector==='[data-activation]'?x.dataset.activation!==undefined:false)};
const dirty=[],applied=[],events=[];
const context=vm.createContext({document,window:{dispatchEvent:e=>events.push(e.type)},Event:class{constructor(type){this.type=type;}},requestAnimationFrame:f=>f(),h2Download(){}});
vm.runInContext(read('engine.js')+'\n'+read('settings.js'),context);
const controller=context.createSettings(value=>dirty.push(value),cfg=>applied.push(copy(cfg)));
const initial=copy(controller.current());

// Deliberately include newer force keys in v1: migration must still be energy-only.
const legacy={schema:'h2-lab-config',version:1,config:{...initial,hiddenLayers:[3],activations:['relu'],seed:17,trainingTarget:'energy-force',forceWeight:8}};
controller.importEnvelope(legacy);
assert.equal(controller.read().trainingTarget,'energy');
assert.equal(controller.read().forceWeight,1);
assert.deepEqual(copy(controller.read().activations),['relu']);
assert.deepEqual(copy(controller.current()),initial,'import must not apply or replace the live configuration');
assert.equal(applied.length,0,'import must not initialize training');
assert.equal(dirty.at(-1),true);
assert.equal(element('dirty-note').hidden,false);
assert.equal(element('forceWeight').disabled,true);
assert.equal(controller.exportEnvelope().version,2);
assert.deepEqual(copy(controller.exportEnvelope().config),initial,'export contains only committed settings');
element('apply').click();
assert.equal(applied.length,1);
assert.equal(applied[0].trainingTarget,'energy');
assert.equal(applied[0].seed,17);
assert.equal(element('dirty-note').hidden,true);

const joint={schema:'h2-lab-config',version:2,config:{...initial,hiddenLayers:[2,3],activations:['tanh','softplus'],trainingTarget:'energy-force',forceWeight:.7}};
controller.importEnvelope(joint);
assert.equal(controller.read().trainingTarget,'energy-force');
assert.equal(element('forceWeight').disabled,false);
assert.equal(applied.length,1,'v2 import is also pending');
const pending=copy(controller.read()),current=copy(controller.current()),dirtyCount=dirty.length;
assert.throws(()=>controller.importEnvelope({...joint,version:3}));
assert.throws(()=>controller.importEnvelope({...joint,config:{...joint.config,activations:['relu','tanh']}}));
assert.deepEqual(copy(controller.read()),pending,'invalid import must retain the existing draft');
assert.deepEqual(copy(controller.current()),current,'invalid import must retain the committed configuration');
assert.equal(dirty.length,dirtyCount,'validation must occur before dirty/pause callbacks');
element('undo').click();
assert.deepEqual(copy(controller.read()),current);

// Exercise the real receive-handler with a displayed Step behind the exported Step.
const source=read('app.js'),start=source.indexOf('worker.onmessage=({data:m})=>{'),end=source.indexOf("\n  post('init'",start);
assert(start>=0&&end>start,'CSV handler extraction marker changed');
const downloads=[],worker={},messages=vm.createContext({worker,version:9,state:{step:11},h2Download:(name,content,type)=>downloads.push({name,content,type}),panel:{gradient(){}},requestAnimationFrame(){throw new Error('CSV must not repaint or train');},updateButtons(){},lastError:''});
vm.runInContext(source.slice(start,end),messages);
const row={r:.8,energy:-4.5,split:'validation',prediction:-4.4,force:-1.2,predictedForce:-1.1};
worker.onmessage({data:{type:'csv',version:9,step:12,rows:[row]}});
assert.equal(downloads.length,1);
assert.equal(downloads[0].name,'h2-potential-fit-step-12.csv');
const lines=downloads[0].content.trim().split('\r\n'),values=lines[1].split(',');
assert.equal(values.length,9);
assert.equal(values[8],'12','use the export snapshot Step, not displayed Step 11');
assert.equal(Number(values[5]),row.force);assert.equal(Number(values[6]),row.predictedForce);
assert(Math.abs(Number(values[7])-(row.predictedForce-row.force))<1e-12);
assert(lines[0].endsWith('residual_force_eV_per_A,model_step'));
worker.onmessage({data:{type:'csv',version:8,step:999,rows:[row]}});
assert.equal(downloads.length,1,'stale configuration exports must be ignored');
console.log('H2 UI contracts passed: v1 migration, v2 pending/apply/undo, invalid imports, committed exports, CSV force units and actual snapshot Step.');
