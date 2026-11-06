let engine,running=false,timer=null,version=0,speed=100,probe=.7417,lesson=null,selection={type:'node',layer:3,k:0},lastSent=-Infinity;
function pause(){running=false;clearTimeout(timer);timer=null;}
function send(){const s=engine.snapshot(probe,lesson?null:selection);if(lesson)s.lessonNetwork=engine.lessonNetwork(lesson,selection);postMessage({type:'snapshot',version,running,lesson,selection,...s});lastSent=performance.now();}
function tick(){if(!running)return;const start=performance.now();try{engine.trainStep();if(engine.finished())pause();if(!running||performance.now()-lastSent>=(engine.connectionCount>2000?500:100))send();}catch(e){pause();send();postMessage({type:'error',version,message:e.message});return;}if(running)timer=setTimeout(tick,Math.max(0,1000/speed-(performance.now()-start)));}
onmessage=({data:m})=>{try{
 if(m.type==='init'){pause();version=m.version;engine=createEngine(m.config);lesson=null;probe=m.probe??.7417;speed=Math.min(100,Math.max(1,m.speed??100));selection={type:'node',layer:engine.sizes.length-1,k:0};send();return;}
 if(m.version!==version||!engine)return;
 if(m.type==='play'){if(!lesson&&!running&&!engine.finished()){running=true;tick();}}
 else if(m.type==='pause'){pause();send();}
 else if(m.type==='step'){if(!lesson){pause();engine.trainStep();send();}}
 else if(m.type==='invalidateLesson'){pause();engine.cancelStep();lesson=null;send();}
 else if(m.type==='prepareLesson'){pause();if(lesson&&lesson.phase<4){send();return;}const trace=engine.prepareStep();lesson=trace?{trace,phase:0,viewPhase:null,sampleIndex:0}:null;send();}
 else if(m.type==='nextLesson'){if(!lesson)return;if(lesson.viewPhase!==null&&lesson.viewPhase!==lesson.phase){lesson.viewPhase=null;send();return;}if(lesson.phase>=4)return;if(lesson.phase===3)engine.commitStep(lesson.trace.token);lesson.phase++;lesson.viewPhase=null;send();}
 else if(m.type==='viewLesson'){if(lesson&&Number.isInteger(m.phase)&&m.phase>=1&&m.phase<=lesson.phase){lesson.viewPhase=m.phase;send();}}
 else if(m.type==='cancelLesson'){pause();engine.cancelStep();lesson=null;send();}
 else if(m.type==='lessonSample'){if(lesson){lesson.sampleIndex=Math.min(lesson.trace.samples.length-1,Math.max(0,m.index|0));send();}}
 else if(m.type==='select'){const s=m.selection;if(s&&['node','edge'].includes(s.type)&&Number.isInteger(s.layer)&&Number.isInteger(s.k)){const bound=s.type==='node'?engine.sizes[s.layer]:engine.layers[s.layer]?.w.length;if(s.layer>=0&&s.k>=0&&s.k<bound)selection=s;}send();}
 else if(m.type==='probe'){probe=Math.max(.3,Math.min(3,Number(m.r)||.7417));send();}
 else if(m.type==='speed'){speed=Math.min(100,Math.max(1,Number(m.speed)||100));}
 else if(m.type==='gradientCheck'){pause();if(lesson){postMessage({type:'error',version,message:'请退出讲解后检查当前模型梯度。'});return;}postMessage({type:'gradientCheck',version,result:engine.checkGradient(selection.type==='edge'?selection:{layer:Math.max(0,selection.layer-1),k:0})});send();}
 else if(m.type==='export'){postMessage({type:'csv',version,rows:engine.snapshot(probe).data});}
}catch(e){pause();postMessage({type:'error',version,message:e.message,field:e.field});}};
