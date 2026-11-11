/* Versioned experiment settings. No trained model state is serialized. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MLIPShare=api;})(globalThis,function(){
 'use strict';
 const MAX_BYTES=8192;
 const CHAPTERS=['symmetry','acsf','soap','moments','messages','vectors','harmonics','mace','h2'];
 const clone=x=>JSON.parse(JSON.stringify(x));
 const fail=message=>{throw new Error(message);};
 function checkTree(value,depth=0){
  if(depth>20)fail('分享设置的嵌套层级过深。');
  if(typeof value==='number'&&!Number.isFinite(value))fail('分享设置含有非有限数值。');
  if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){
   if(['__proto__','prototype','constructor'].includes(key))fail('分享设置含有不支持的字段。');
   checkTree(child,depth+1);
  }
 }
 /** @returns {{schema:string,version:number,chapter:string,mode:string,config:object}} */
 function envelope(value){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('分享内容必须是实验设置对象。');
  checkTree(value);
  if(value.schema!=='mlip-experiment'||value.version!==1)fail('不支持的实验分享版本。');
  if(!CHAPTERS.includes(value.chapter)||!['principle','train'].includes(value.mode))fail('分享章节或模式无效。');
  if(value.chapter==='h2'&&value.mode!=='train')fail('H₂ 分享必须使用训练模式。');
  if(!value.config||typeof value.config!=='object'||Array.isArray(value.config))fail('分享缺少配置。');
  return{schema:'mlip-experiment',version:1,chapter:value.chapter,mode:value.mode,config:clone(value.config)};
 }
 /** Validate against the exact validators used by the three existing engines. */
 function validate(value,{methods,training,h2}){
  const out=envelope(value),c=out.config;
  if(out.chapter==='h2'){
   if(c.schema!=='h2-lab-config'||![1,2].includes(c.version)||!c.config)fail('H₂ 配置格式无效。');
   const input=c.version===1?{...c.config,trainingTarget:'energy',forceWeight:1}:c.config;
   out.config={schema:'h2-lab-config',version:2,config:h2(input)};
  }else if(out.mode==='train'){
   if(c.schema!=='mlip-training-config'||c.version!==1||!c.cfg)fail('训练配置格式无效。');
   const expected=out.chapter==='symmetry'?'vectors':out.chapter;
   if(c.cfg.method!==expected)fail('分享章节与训练模型不一致。');
   out.config={schema:'mlip-training-config',version:1,cfg:training(c.cfg)};
  }else{
   if(c.schema!=='mlip-methods-config'||c.version!==1||c.chapter!==out.chapter)fail('原理配置与分享章节不一致。');
   const clean=methods({...c,stage:0,version:0});
   out.config={schema:'mlip-methods-config',version:1,chapter:out.chapter};
   const atoms=a=>a.map(x=>({id:x.id,element:x.element,pos:[...x.pos]}));
   out.config.atoms=atoms(clean.atoms);out.config.center=clean.center;out.config.selected=clean.selected;
   out.config.params=Object.fromEntries(['cutoff','radial','lmax','channels','rounds','correlation','sigma','eta','rs','zeta','lambda','angleMessages','weights'].map(key=>[key,clone(clean.params[key])]));
   out.config.transform={axis:clean.transform.axis,angle:clean.transform.angle,reflection:clean.transform.reflection};
   out.config.referenceAtoms=atoms(clean.referenceAtoms||clean.atoms);out.config.referenceCenter=clean.referenceAtoms?clean.referenceCenter:clean.center;
  }
  return out;
 }
 function encode(value){
  const bytes=new TextEncoder().encode(JSON.stringify(envelope(value)));
  let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);
  const encoded=(typeof btoa==='function'?btoa(raw):Buffer.from(bytes).toString('base64')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(encoded.length>MAX_BYTES)fail('分享链接超过 8 KiB，请改用导出 JSON。');
  return encoded;
 }
 function decode(text){
  if(typeof text!=='string'||!text.length||text.length>MAX_BYTES||!/^[A-Za-z0-9_-]+$/.test(text)||text.length%4===1)fail('分享链接损坏或超过 8 KiB。');
  try{
   const base64=text.replace(/-/g,'+').replace(/_/g,'/');
   const raw=typeof atob==='function'?atob(base64):Buffer.from(base64,'base64').toString('binary');
   return envelope(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw,x=>x.charCodeAt(0)))));
  }catch(error){throw new Error('无法读取分享设置：'+error.message);}
 }
 function hash(value){const clean=envelope(value);return'#/'+clean.chapter+'?'+(clean.mode==='train'?'mode=train&':'')+'experiment='+encode(clean);}
 return{MAX_BYTES,CHAPTERS,envelope,validate,encode,decode,hash};
});
