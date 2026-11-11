// All model mutations are serialized. Message handlers only change scheduling flags.
const trainingSessions=new Map(),trainingQueue=[];
let trainingBusy=false,trainingTimer=null;
const trainingTick=()=>new Promise(resolve=>setTimeout(resolve,0));
function trainingSend(s,type,extra={}){if(trainingSessions.get(s.id)!==s)return;postMessage({type,session:s.id,version:s.version,...extra});}
async function trainingPublish(s,type='snapshot',extra={}){if(!s.engine)return;const applied=s.appliedView||0,snapshot=await s.engine.snapshot();snapshot.running=s.running;snapshot.viewRequestId=applied;snapshot.error=s.lastError||null;trainingSend(s,type,{snapshot,...extra});s.published=Date.now();}
function scheduleTraining(delay=0){if(trainingBusy||trainingTimer!==null)return;trainingTimer=setTimeout(()=>{trainingTimer=null;trainingPump();},delay);}
onmessage=({data:m})=>{
 if(m.type==='init'){
  const old=trainingSessions.get(m.session);if(old)old.running=false;
  const s={id:m.session,version:m.version,engine:null,running:false,speed:100,published:0};trainingSessions.set(s.id,s);trainingQueue.push({s,message:m});
 }else{
  const s=trainingSessions.get(m.session);if(!s||s.version!==m.version)return;
  if(m.type==='pause'){s.running=false;for(let i=trainingQueue.length-1;i>=0;i--)if(trainingQueue[i].s===s&&trainingQueue[i].message.type==='play')trainingQueue.splice(i,1);trainingQueue.unshift({s,message:m});}
  else if(m.type==='speed'){s.speed=Math.max(1,Math.min(100,Number(m.value)||1));}
  else{if(['prepare','step','commit','cancel','force','direct'].includes(m.type))s.running=false;if(['probe','select'].includes(m.type)){for(let i=trainingQueue.length-1;i>=0;i--)if(trainingQueue[i].s===s&&trainingQueue[i].message.type===m.type)trainingQueue.splice(i,1);}trainingQueue.push({s,message:m});}
 }
 scheduleTraining();
};
async function trainingPump(){if(trainingBusy)return;trainingBusy=true;let delay=0;try{
 const job=trainingQueue.shift();
 if(job){const{s,message:m}=job;if(trainingSessions.get(s.id)!==s)return;try{
   if(m.type==='init'){
    s.engine=await MLIPTraining.createEngine(m.cfg,{yieldControl:trainingTick,cancelled:()=>trainingSessions.get(s.id)!==s,onProgress:p=>trainingSend(s,'progress',{progress:p.value,message:p.message})});
    await trainingPublish(s,'ready');
   }else if(s.engine){
    if(m.type==='play'){for(const other of trainingSessions.values())if(other!==s)other.running=false;s.engine.cancelStep();s.lastError=null;s.running=!s.engine.finished();await trainingPublish(s);}
    else if(m.type==='pause'||m.type==='snapshot')await trainingPublish(s);
    else if(m.type==='step'){s.engine.cancelStep();await s.engine.stepOnce();s.lastError=null;await trainingPublish(s);}
    else if(m.type==='prepare'){const trace=await s.engine.prepareStep();await trainingPublish(s,'prepared',{trace,lessonRequest:m.lessonRequest});}
    else if(m.type==='commit'){const trace=s.engine.commitStep(m.token);await trainingPublish(s,'committed',{trace,lessonRequest:m.lessonRequest});}
    else if(m.type==='cancel'){s.engine.cancelStep();await trainingPublish(s);}
    else if(m.type==='probe'){s.engine.probe(m);s.appliedView=m.viewRequestId||0;await trainingPublish(s);}
    else if(m.type==='select'){s.engine.select(m);s.appliedView=m.viewRequestId||0;await trainingPublish(s);}
    else if(m.type==='force'){await s.engine.force();await trainingPublish(s);}
    else if(m.type==='direct'){trainingSend(s,'direct',{result:s.engine.directSolution()});}
    else if(m.type==='export')trainingSend(s,'export',{csv:s.engine.csv(),step:s.engine.save().step});
   }
  }catch(error){s.running=false;s.lastError=error.message;trainingSend(s,'error',{message:error.message,field:error.field});}
 }else{
  const s=[...trainingSessions.values()].find(x=>x.running&&x.engine);if(s){const start=Date.now();try{await s.engine.stepOnce();if(s.engine.finished())s.running=false;if(!s.running||Date.now()-s.published>=500)await trainingPublish(s);}catch(error){s.running=false;s.lastError=error.message;trainingSend(s,'error',{message:error.message});await trainingPublish(s);}delay=Math.max(0,1000/s.speed-(Date.now()-start));}
 }
}finally{trainingBusy=false;if(trainingQueue.length||[...trainingSessions.values()].some(x=>x.running&&x.engine))scheduleTraining(trainingQueue.length?0:delay);}}
