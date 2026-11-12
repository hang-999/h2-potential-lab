/* Pure display summaries. These functions never alter training rows or weights. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MLIPDiagnostics=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 function rows(snapshot,split='validation'){return(snapshot?.data??[]).filter(q=>(split==='all'||q.split===split)&&Number.isFinite(q.reference)&&Number.isFinite(q.prediction));}
 function geometry(row){const atoms=row.atoms??[],center=atoms[0]?.pos;if(!center||atoms.length<2)return{bond:NaN,angle:NaN};const v=atoms[1].pos.map((x,k)=>x-center[k]),bond=Math.hypot(...v),w=atoms[2]?.pos.map((x,k)=>x-center[k]),nw=w?Math.hypot(...w):0;return{bond,angle:bond&&nw?Math.acos(Math.max(-1,Math.min(1,v.reduce((sum,x,k)=>sum+x*w[k],0)/(bond*nw))))*180/Math.PI:NaN};}
 function histogram(input,count=20){const values=input.map(q=>q.prediction-q.reference).filter(Number.isFinite);if(!values.length)return[];const extent=Math.max(1e-8,...values.map(Math.abs)),width=2*extent/count,bins=Array.from({length:count},(_,i)=>({min:-extent+i*width,max:-extent+(i+1)*width,train:0,validation:0,ids:[]}));input.forEach(q=>{const e=q.prediction-q.reference;if(!Number.isFinite(e))return;const b=bins[Math.min(count-1,Math.max(0,Math.floor((e+extent)/width)))];b[q.split==='train'?'train':'validation']++;b.ids.push(q.id);});return bins;}
 const sliceKey=s=>JSON.stringify({axis:s?.axis,mode:s?.mode??'baseline',anchorId:s?.anchorId??null,atomIndex:s?.atomIndex??null,anchorAtoms:s?.anchorAtoms??null,x:(s?.points??[]).map(p=>p.x)});
 function freeze(snapshot,name){return clone({name,method:snapshot.cfg.method,cfg:snapshot.cfg,datasetId:snapshot.datasetId,step:snapshot.step,completedEpochs:snapshot.completedEpochs,parameterCount:snapshot.parameterCount,latest:snapshot.latest,data:snapshot.data,slice:snapshot.slice,history:snapshot.history,sliceKey:sliceKey(snapshot.slice)});}
 function compatible(a,b){return a?.datasetId===b?.datasetId;}
 function worst(input,count=10){return[...input].sort((a,b)=>Math.abs(b.prediction-b.reference)-Math.abs(a.prediction-a.reference)||a.id-b.id).slice(0,count);}
 return{rows,geometry,histogram,sliceKey,freeze,compatible,worst};
});
