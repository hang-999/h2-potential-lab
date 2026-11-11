const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('./sharing.js'),M=require('./operators.js'),T=require('./training-data.js');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/h2/engine.js','utf8'),context);
const validators={methods:M.validate,training:T.validate,h2:context.H2Config.validate};
const base={schema:'mlip-experiment',version:1,chapter:'acsf',mode:'principle',config:{schema:'mlip-methods-config',version:1,chapter:'acsf',atoms:M.presets.water,center:0,selected:1,params:M.defaults,transform:{axis:'z',angle:60,reflection:false},referenceAtoms:M.presets.tetrahedron,referenceCenter:0}};
for(const chapter of S.CHAPTERS){
 const modes=chapter==='h2'?['train']:['principle','train'];
 for(const mode of modes){
  const config=chapter==='h2'?{schema:'h2-lab-config',version:2,config:{trainingTarget:'energy-force'}}:mode==='principle'?{...base.config,chapter}:{schema:'mlip-training-config',version:1,cfg:{method:chapter==='symmetry'?'vectors':chapter}};
  const clean=S.validate({...base,chapter,mode,config},validators),encoded=S.encode(clean),decoded=S.validate(S.decode(encoded),validators);
  assert.deepEqual(decoded,clean);assert.equal(S.hash(clean).split('experiment=')[1],encoded);
  assert(!JSON.stringify(clean).includes('modelParameters'));
 }
}
const v1=S.validate({schema:'mlip-experiment',version:1,chapter:'h2',mode:'train',config:{schema:'h2-lab-config',version:1,config:{trainingTarget:'energy-force',forceWeight:9}}},validators);
assert.equal(v1.config.version,2);assert.equal(v1.config.config.trainingTarget,'energy');assert.equal(v1.config.config.forceWeight,1);
const h2=JSON.parse(JSON.stringify(v1));h2.config.config.activations=['relu','tanh'];h2.config.config.trainingTarget='energy-force';assert.throws(()=>S.validate(h2,validators));
const train={schema:'mlip-experiment',version:1,chapter:'acsf',mode:'train',config:{schema:'mlip-training-config',version:1,cfg:{method:'acsf',n:160,modelParameters:[9],step:900}}};
const applied=S.validate(train,validators);assert(!('modelParameters'in applied.config.cfg));assert(!('step'in applied.config.cfg));assert.deepEqual(T.generate(applied.config.cfg),T.generate(S.validate(S.decode(S.encode(applied)),validators).config.cfg));
for(const bad of [{...base,version:99},{...base,chapter:'missing'},{...base,mode:'other'},{...base,config:{...base.config,chapter:'soap'}},{...train,chapter:'soap'},{...base,config:{...base.config,atoms:[{id:1,element:'H',pos:[NaN,0,0]}]}}])assert.throws(()=>S.validate(bad,validators));
assert.throws(()=>S.decode('%%%'));assert.throws(()=>S.decode('A'));assert.throws(()=>S.decode('a'.repeat(S.MAX_BYTES+1)));
assert.throws(()=>S.decode(S.encode({...base,config:{note:'x'.repeat(10000)}})));
assert.throws(()=>S.envelope(JSON.parse('{"schema":"mlip-experiment","version":1,"chapter":"acsf","mode":"principle","config":{"__proto__":{}}}')));
const extra=S.envelope({...base,step:20,weights:[1],running:true});assert(!('step'in extra)&&!('weights'in extra)&&!('running'in extra));
console.log('Sharing passed: all chapter/mode round trips, engine validation, v1 migration, deterministic datasets, unsafe/oversized rejection, no training state.');
