import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

// Rendering is a view of the numerical snapshot. No model state is stored here.
const ATOMS = {
  H: {color:0xe9eff6, edge:'#7d8fa6', radius:.19},
  C: {color:0x415778, edge:'#334c6c', radius:.27},
  O: {color:0xe97965, edge:'#b94738', radius:.25},
};
const BLUE = 0x2878c8;
const TEAL = 0x167e7e;
const NS='http://www.w3.org/2000/svg';
let nextScene=0;

function styleOnce(){
  if(document.getElementById('mlip-scene-style'))return;
  const style=document.createElement('style');style.id='mlip-scene-style';
  style.textContent=`
  .mlip-scene{position:relative;isolation:isolate;min-width:0;min-height:0;overflow:hidden;background:radial-gradient(ellipse at 45% 35%,#fff 0,#f8fbfd 65%,#eef4f8 100%);border-radius:16px;color:#243c55;touch-action:none}
  .mlip-scene canvas,.mlip-scene .scene-fallback{position:absolute;inset:0;display:block;width:100%;height:100%;outline:none}
  .mlip-scene .scene-tools{position:absolute;z-index:4;left:12px;right:12px;top:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;pointer-events:none}
  .mlip-scene .scene-tools button{pointer-events:auto;min-height:31px;padding:5px 9px;border:1px solid #cfdde9;border-radius:8px;font-family:inherit;font-weight:500;font-size:12px;line-height:1.4;color:#3a526e;background:#fffffff2;box-shadow:0 2px 7px #15344e05;cursor:pointer}
  .mlip-scene .scene-tools button[aria-pressed=true]{color:#135f9c;border-color:#83b8e3;background:#edf6ff}
  .mlip-scene .scene-tools button:focus-visible,.mlip-scene .atom-label:focus-visible{outline:3px solid #79b2ed;outline-offset:2px}
  .mlip-scene .scene-tools .scene-reset{margin-left:auto}
  .mlip-scene .scene-footer{position:absolute;z-index:4;bottom:12px;left:14px;right:14px;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;pointer-events:none;font-size:11px;line-height:1.5;color:#647a91}
  .mlip-scene .scene-footer span{background:#ffffffcf;padding:3px 6px;border-radius:5px}
  .mlip-scene .scene-mode-note{max-width:78%}
  .mlip-scene .scene-axis-note{font:11px/1.5 ui-monospace,Consolas,monospace;white-space:nowrap}
  .mlip-scene .scene-labels{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}
  .mlip-scene .scene-leaders{position:absolute;inset:0;z-index:2;width:100%;height:100%;pointer-events:none;overflow:hidden}
  .mlip-scene .atom-label{position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:auto;border:1px solid #d8e3ed;border-radius:6px;padding:2px 6px;background:#ffffffed;box-shadow:0 1px 5px #284f6d0c;white-space:nowrap;font:600 11px/1.4 ui-sans-serif,'Microsoft YaHei',sans-serif;color:#465c76;cursor:pointer;min-height:0}
  .mlip-scene .atom-label.selected{background:#e9f4ff;border-color:#67a6d9;color:#155a93}
  .mlip-scene .atom-label.center{border-color:#71aaa4;color:#176c68}
  .mlip-scene .vector-label{position:absolute;left:0;top:0;transform:translate(-50%,-50%);padding:2px 5px;border:1px solid #dce8ec;border-radius:4px;color:#176f78;background:#fffffff5;font:11px/1.4 ui-monospace,Consolas,'Microsoft YaHei',sans-serif;white-space:nowrap;box-shadow:0 1px 4px #17415e08}
  .mlip-scene .scene-warning{position:absolute;z-index:4;left:12px;right:12px;top:55px;padding:5px 8px;border-radius:6px;background:#fff6e3db;color:#816322;font-size:11px;pointer-events:none}
  .mlip-scene .scene-density-key{position:absolute;z-index:3;right:14px;top:54px;padding:4px 6px;border-radius:5px;background:#ffffffe6;color:#187c85;font-size:10px;max-width:200px;pointer-events:none}
  .mlip-scene .scene-compass{position:absolute;z-index:3;right:12px;bottom:40px;width:58px;height:58px;pointer-events:none;filter:drop-shadow(0 1px 1px #fff)}
  @media(max-width:520px){.mlip-scene .scene-tools{gap:4px;left:8px;right:8px;top:8px}.mlip-scene .scene-tools button{font-size:11px;padding:4px 6px}.mlip-scene .scene-footer{left:8px;right:8px;bottom:8px;font-size:10px}.mlip-scene .scene-density-key{top:49px;font-size:9px}.mlip-scene .atom-label{font-size:10px}}
  `;document.head.appendChild(style);
}

function sphereHarmonic(l,m,x,y,z){
  if(l===0)return 1/Math.sqrt(4*Math.PI);
  if(l===1)return Math.sqrt(3/(4*Math.PI))*[y,z,x][m+1];
  return [Math.sqrt(15/(4*Math.PI))*x*y,Math.sqrt(15/(4*Math.PI))*y*z,Math.sqrt(5/(16*Math.PI))*(3*z*z-1),Math.sqrt(15/(4*Math.PI))*x*z,Math.sqrt(15/(16*Math.PI))*(x*x-y*y)][m+2];
}

function matrixFor(t){
  const axis=t?.axis==='x'?new THREE.Vector3(1,0,0):t?.axis==='y'?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
  const r=new THREE.Matrix4().makeRotationAxis(axis,(Number(t?.angle)||0)*Math.PI/180);
  if(t?.reflection)r.multiply(new THREE.Matrix4().makeScale(-1,1,1));
  return r;
}

function disposeGroup(group){
  group.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});
  group.clear();
}

function svgNode(tag,attrs={},text){
  const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));
  if(text!==undefined)n.textContent=text;return n;
}

export function createScene(host,callbacks={}){
  styleOnce();const id=++nextScene;
  host.classList.add('mlip-scene');host.setAttribute('role','group');host.setAttribute('aria-label','可交互原子环境：观察视角与输入坐标分别控制');
  const tools=document.createElement('div');tools.className='scene-tools';
  const orbitButton=document.createElement('button');orbitButton.type='button';orbitButton.textContent='观察视角';orbitButton.setAttribute('aria-pressed','true');orbitButton.title='拖动空白区域旋转相机，不改变输入坐标';
  const editButton=document.createElement('button');editButton.type='button';editButton.textContent='移动原子';editButton.setAttribute('aria-pressed','false');editButton.title='拖动原子在屏幕平面中移动，改变模型输入';
  if(typeof callbacks.onMove!=='function'){editButton.disabled=true;editButton.title='对照构型只读；请在左侧编辑输入原子';}
  const resetButton=document.createElement('button');resetButton.type='button';resetButton.textContent='复位视角';resetButton.className='scene-reset';
  tools.append(orbitButton,editButton,resetButton);host.appendChild(tools);
  const labels=document.createElement('div');labels.className='scene-labels';host.appendChild(labels);
  const leaders=svgNode('svg',{class:'scene-leaders','aria-hidden':'true'});host.appendChild(leaders);
  const caption=document.createElement('div');caption.className='scene-footer';
  const note=document.createElement('span');note.className='scene-mode-note';note.textContent='拖动旋转视角 · 滚轮缩放 · 点击原子查看';
  const axisNote=document.createElement('span');axisNote.className='scene-axis-note';axisNote.textContent='坐标 / Å';caption.append(note,axisNote);host.appendChild(caption);
  const densityKey=document.createElement('div');densityKey.className='scene-density-key';densityKey.hidden=true;host.appendChild(densityKey);
  const compass=svgNode('svg',{class:'scene-compass',viewBox:'0 0 58 58','aria-label':'固定输入坐标轴方向'});host.appendChild(compass);
  let renderer=null,scene=null,camera=null,controls=null,world=null,atomGroup=null,bondGroup=null,effectGroup=null,pulseGroup=null,cutoffGroup=null,harmonicGroup=null,ground=null;
  let fallback=null,warning=null,disposed=false,visible=true,edit=false,frame=0,width=1,height=1;
  let snapshot={atoms:[],center:0,selected:0,cutoff:3,vectors:[],vectorScale:1,highlight:[]},geometryKey='',phase=0,progress=0;
  let atomMeshes=[],edgeMeshes=[],atomLabels=[],vectorLabels=[],rings=[],edges=[],pulses=[],currentTransform=new THREE.Matrix4(),harmonicMarker=null,harmonicRay=null;
  let down=null,drag=null,viewYaw=.5,viewPitch=.35,viewScale=70;
  let cameraCallbacksReady=false,syncingCamera=false;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

  function setEdit(on){edit=!!on&&typeof callbacks.onMove==='function';orbitButton.setAttribute('aria-pressed',String(!edit));editButton.setAttribute('aria-pressed',String(edit));if(controls)controls.enabled=!edit;note.textContent=edit?'拖动原子改变坐标 · 精确值可在坐标编辑器输入':'拖动旋转视角 · 滚轮缩放 · 点击原子查看';if(renderer)renderer.domElement.style.cursor=edit?'crosshair':'grab';}
  orbitButton.onclick=()=>setEdit(false);editButton.onclick=()=>setEdit(true);resetButton.onclick=resetCamera;

  function setupWebGL(){
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.5));renderer.setClearColor(0xffffff,0);
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
      const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','三维原子环境，拖动旋转视角，按住 Shift 拖动原子改变坐标');host.prepend(canvas);
      scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.01,120);camera.position.set(4.4,3.2,5.6);
      controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=3;controls.maxDistance=28;controls.target.set(0,0,0);controls.enablePan=true;
      controls.addEventListener('change',()=>{schedule();notifyCamera();});controls.update();
      scene.add(new THREE.AmbientLight(0xffffff,1.1));const hemi=new THREE.HemisphereLight(0xffffff,0x8da0b8,2);scene.add(hemi);
      const key=new THREE.DirectionalLight(0xffffff,3.1);key.position.set(3,6,5);scene.add(key);const fill=new THREE.DirectionalLight(0xa8cff4,1);fill.position.set(-4,2,-3);scene.add(fill);
      world=new THREE.Group();world.matrixAutoUpdate=false;scene.add(world);
      cutoffGroup=new THREE.Group();bondGroup=new THREE.Group();atomGroup=new THREE.Group();effectGroup=new THREE.Group();pulseGroup=new THREE.Group();world.add(cutoffGroup,bondGroup,effectGroup,atomGroup,pulseGroup);
      // The harmonic basis is fixed in the coordinate frame; rotating the input
      // moves its sample direction, not this individual Y_lm basis function.
      harmonicGroup=new THREE.Group();scene.add(harmonicGroup);
      ground=new THREE.GridHelper(12,12,0xb9ccda,0xd5e1eb);ground.position.y=-2.5;ground.material.transparent=true;ground.material.opacity=.12;scene.add(ground);
      canvas.addEventListener('pointerdown',pointerDown,true);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('keydown',keyDown);
      canvas.addEventListener('webglcontextlost',contextLost,false);
      return true;
    }catch(error){renderer?.dispose();renderer?.domElement.remove();renderer=null;showFallback('当前环境未启用 WebGL，使用二维投影；数值计算不受影响。');return false;}
  }

  function contextLost(event){event.preventDefault();if(disposed)return;controls?.dispose();renderer?.domElement.remove();renderer=null;showFallback('图形上下文不可用，已切换二维投影；数值与选择仍可使用。');draw();}

  function showFallback(message){
    labels.hidden=true;leaders.hidden=true;
    if(!warning){warning=document.createElement('div');warning.className='scene-warning';host.appendChild(warning);}warning.textContent=message;
    if(fallback)return;
    fallback=svgNode('svg',{class:'scene-fallback',role:'img','aria-label':'原子环境二维投影，可点击原子；输入坐标可在编辑器中修改',tabindex:0});host.prepend(fallback);
    fallback.addEventListener('pointerdown',pointerDown,true);fallback.addEventListener('pointermove',pointerMove);fallback.addEventListener('pointerup',pointerUp);fallback.addEventListener('pointercancel',pointerUp);fallback.addEventListener('keydown',keyDown);
    fallback.addEventListener('wheel',e=>{e.preventDefault();viewScale=Math.max(22,Math.min(160,viewScale*Math.exp(-e.deltaY*.001)));schedule();notifyCamera();},{passive:false});
  }

  function measure(){if(disposed)return;const rect=host.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);if(renderer){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.5));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}viewScale=Math.min(width,height)/5.6;schedule();}
  function schedule(){if(disposed||!visible||frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
  function draw(){if(disposed||!visible||width<2||height<2)return;if(renderer){rings.forEach(r=>r.quaternion.copy(camera.quaternion));renderer.render(scene,camera);positionLabels();}else drawFallback();drawCompass();}

  function drawCompass(){
    compass.replaceChildren();
    const axes=[{v:[1,0,0],label:'x',color:'#bc6658'},{v:[0,1,0],label:'y',color:'#408777'},{v:[0,0,1],label:'z',color:'#5186b6'}];
    for(const a of axes){const p=new THREE.Vector3(...a.v);if(renderer)p.applyQuaternion(camera.quaternion.clone().invert());else p.applyAxisAngle(new THREE.Vector3(0,1,0),viewYaw).applyAxisAngle(new THREE.Vector3(1,0,0),viewPitch);const x=27+p.x*20,y=29-p.y*20;compass.append(svgNode('line',{x1:27,y1:29,x2:x,y2:y,stroke:a.color,'stroke-width':1.6}),svgNode('text',{x:27+p.x*25,y:32-p.y*25,'text-anchor':'middle','font-size':10,'font-weight':600,fill:a.color},a.label));}
    compass.appendChild(svgNode('circle',{cx:27,cy:29,r:2,fill:'#70869b'}));
  }

  function positionLabels(){
    const project=(position)=>position.clone().applyMatrix4(currentTransform).project(camera);
    const pixels=p=>({x:(p.x*.5+.5)*width,y:(-p.y*.5+.5)*height});
    const overlaps=(a,b,pad=3)=>a.x-a.w/2<b.x+b.w/2+pad&&a.x+a.w/2>b.x-b.w/2-pad&&a.y-a.h/2<b.y+b.h/2+pad&&a.y+a.h/2>b.y-b.h/2-pad;
    const top=Math.max(45,tools.offsetTop+tools.offsetHeight+7),bottom=Math.max(top+30,height-caption.offsetHeight-21),occupied=[];
    const glyphs=atomLabels.map(a=>{const p=pixels(project(a.position)),worldPosition=a.position.clone().applyMatrix4(currentTransform).applyMatrix4(camera.matrixWorldInverse),radius=(ATOMS[snapshot.atoms[a.index]?.element]||ATOMS.C).radius*height/(2*Math.tan(camera.fov*Math.PI/360)*Math.max(.5,-worldPosition.z));return{...p,w:radius*2+8,h:radius*2+8,index:a.index};});
    if(!densityKey.hidden){occupied.push({x:width-14-densityKey.offsetWidth/2,y:54+densityKey.offsetHeight/2,w:densityKey.offsetWidth,h:densityKey.offsetHeight});}
    // Reserve the compass; labels never cover the coordinate reference.
    occupied.push({x:width-41,y:height-69,w:62,h:62});
    leaders.setAttribute('viewBox',`0 0 ${width} ${height}`);leaders.replaceChildren();
    const items=[...atomLabels.map(a=>({...a,kind:'atom',priority:a.index===snapshot.selected?0:a.index===snapshot.center?1:3})),...vectorLabels.map(a=>({...a,kind:'vector',priority:2}))].sort((a,b)=>a.priority-b.priority||a.index-b.index);
    for(const item of items){
      const p=project(item.position),anchor=pixels(p),el=item.el;
      const suppress=item.kind==='vector'&&vectorLabels.length>2&&item.index!==snapshot.selected&&item.index!==snapshot.center;
      if(suppress||p.z>1||p.z< -1||anchor.x<0||anchor.x>width||anchor.y<top-20||anchor.y>height-20){el.hidden=true;continue;}
      el.hidden=false;const w=Math.min(el.offsetWidth,width-18),h=el.offsetHeight,ownGlyph=glyphs.find(g=>g.index===item.index),r=item.kind==='atom'?(ownGlyph?.w||20)/2:5;
      let best=null,bestScore=Infinity;
      const offsets=[];
      for(const gap of [7,24,45,68]){
        const dx=r+w/2+gap,dy=r+h/2+gap;
        offsets.push([0,-dy],[dx,-h/2-gap],[-dx,-h/2-gap],[dx,0],[-dx,0],[0,dy],[dx,h/2+gap],[-dx,h/2+gap]);
      }
      for(const [dx,dy] of offsets){
        const q={x:Math.max(w/2+8,Math.min(width-w/2-8,anchor.x+dx)),y:Math.max(top+h/2,Math.min(bottom-h/2,anchor.y+dy)),w,h};
        const clashes=occupied.filter(b=>overlaps(q,b)).length+glyphs.filter(b=>overlaps(q,b,1)).length;
        const score=clashes*10000+Math.hypot(q.x-anchor.x,q.y-anchor.y)+(item.kind==='vector'&&dy<0?-3:0);
        if(score<bestScore){bestScore=score;best=q;}
      }
      if(!best){el.hidden=true;continue;}occupied.push(best);el.style.left=`${best.x}px`;el.style.top=`${best.y}px`;
      const endX=Math.max(best.x-w/2,Math.min(best.x+w/2,anchor.x)),endY=Math.max(best.y-h/2,Math.min(best.y+h/2,anchor.y));
      if(Math.hypot(endX-anchor.x,endY-anchor.y)>8){leaders.appendChild(svgNode('line',{x1:anchor.x,y1:anchor.y,x2:endX,y2:endY,stroke:item.kind==='vector'?'#789fa6':'#95aabc','stroke-width':.85,'stroke-opacity':.8}));}
    }
  }

  function ray(event){const rect=(renderer?.domElement||fallback).getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster;}
  function hit(event){
    if(renderer){const objects=ray(event).intersectObjects(atomMeshes,false);if(objects.length)return{type:'atom',index:objects[0].object.userData.index,point:objects[0].point};const es=raycaster.intersectObjects(edgeMeshes,false);if(es.length)return{type:'edge',...es[0].object.userData};return null;}
    const atom=event.target.closest?.('[data-atom]');if(atom)return{type:'atom',index:+atom.dataset.atom};const edge=event.target.closest?.('[data-edge-from]');return edge?{type:'edge',from:+edge.dataset.edgeFrom,to:+edge.dataset.edgeTo}:null;
  }

  function pointerDown(e){
    if(e.button!==0)return;const target=hit(e);down={x:e.clientX,y:e.clientY,target};
    if(target?.type==='atom'&&(edit||e.shiftKey)&&typeof callbacks.onMove==='function'){
      e.preventDefault();e.stopImmediatePropagation();const index=target.index,pos=new THREE.Vector3(...snapshot.atoms[index].pos);callbacks.onSelect?.(index);
      const worldPos=pos.clone().applyMatrix4(currentTransform),normal=renderer?camera.getWorldDirection(new THREE.Vector3()):new THREE.Vector3(0,0,1);
      const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,worldPos);let grabOffset=new THREE.Vector3();
      if(renderer){const point=ray(e).ray.intersectPlane(plane,new THREE.Vector3());if(point)grabOffset=worldPos.clone().sub(point);}
      drag={index,start:pos,plane,grabOffset,x:e.clientX,y:e.clientY};if(controls)controls.enabled=false;(renderer?.domElement||fallback).setPointerCapture?.(e.pointerId);
    }else if(!renderer){(fallback).setPointerCapture?.(e.pointerId);}
  }
  function pointerMove(e){
    if(drag){
      let p;
      if(renderer){p=ray(e).ray.intersectPlane(drag.plane,new THREE.Vector3());if(!p)return;p.add(drag.grabOffset).applyMatrix4(currentTransform.clone().invert());}
      else{const delta=new THREE.Vector3((e.clientX-drag.x)/viewScale,-(e.clientY-drag.y)/viewScale,0);delta.applyAxisAngle(new THREE.Vector3(1,0,0),-viewPitch).applyAxisAngle(new THREE.Vector3(0,1,0),-viewYaw);p=drag.start.clone().add(delta.applyMatrix4(currentTransform.clone().invert()));}
      callbacks.onMove?.(drag.index,p.toArray().map(x=>Math.max(-6,Math.min(6,x))));return;
    }
    if(!renderer&&down&&!edit){viewYaw+=(e.clientX-down.x)*.008;viewPitch=Math.max(-1.5,Math.min(1.5,viewPitch+(e.clientY-down.y)*.008));down.x=e.clientX;down.y=e.clientY;down.moved=true;schedule();notifyCamera();}
  }
  function pointerUp(e){
    if(drag){drag=null;if(controls)controls.enabled=!edit;down=null;return;}
    if(down&&!down.moved&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const target=down.target;if(target?.type==='atom')callbacks.onSelect?.(target.index);else if(target?.type==='edge')callbacks.onEdge?.(target.from,target.to);}
    down=null;
  }
  function keyDown(e){
    if(e.key==='Escape'){drag=null;setEdit(false);return;}
    if(e.key.toLowerCase()==='r'){resetCamera();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const index=snapshot.selected??0;
    if(edit&&snapshot.atoms[index]){const pos=[...snapshot.atoms[index].pos],amount=e.shiftKey?.2:.05;pos[e.key==='ArrowLeft'||e.key==='ArrowRight'?0:1]+=(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1)*amount;callbacks.onMove?.(index,pos);}else{viewYaw+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);viewPitch+=(e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0);if(renderer){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),e.key==='ArrowLeft'?-.1:e.key==='ArrowRight'?.1:0);offset.applyAxisAngle(new THREE.Vector3(1,0,0),e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0);camera.position.copy(controls.target).add(offset);controls.update();}schedule();}
  }

  function atomLabel(atom,index){
    const el=document.createElement('button');el.type='button';el.className='atom-label'+(index===snapshot.selected?' selected':'')+(index===snapshot.center?' center':'');el.textContent=`${atom.element}${index+1}${index===snapshot.center?' · 中心':''}`;el.title=`${atom.element} 原子 ${index+1}：${atom.pos.map(x=>x.toFixed(3)).join(', ')} Å`;el.onclick=()=>callbacks.onSelect?.(index);labels.appendChild(el);
    atomLabels.push({el,index,position:new THREE.Vector3(...atom.pos),offset:-27});
  }

  function cylinderBetween(a,b,radius,color,opacity=1){
    const dir=b.clone().sub(a),len=dir.length();if(len<1e-8)return null;
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,len,10,1),new THREE.MeshStandardMaterial({color,roughness:.75,metalness:0,transparent:opacity<1,opacity,depthWrite:opacity>.5}));mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return mesh;
  }

  function rebuild(){
    if(!renderer)return;
    [cutoffGroup,bondGroup,atomGroup,effectGroup,pulseGroup,harmonicGroup].forEach(disposeGroup);atomMeshes=[];edgeMeshes=[];rings=[];pulses=[];labels.replaceChildren();atomLabels=[];vectorLabels=[];harmonicMarker=null;harmonicRay=null;
    world.matrix.copy(currentTransform);
    const center=snapshot.atoms[snapshot.center]?.pos||[0,0,0];
    const cut=new THREE.Mesh(new THREE.SphereGeometry(snapshot.cutoff,40,28),new THREE.MeshBasicMaterial({color:0x83b8d9,transparent:true,opacity:.02,side:THREE.DoubleSide,depthWrite:false}));cut.position.set(...center);cutoffGroup.add(cut);
    for(let plane=0;plane<3;plane++){const points=[];for(let k=0;k<96;k++){const a=k*2*Math.PI/96,x=snapshot.cutoff*Math.cos(a),y=snapshot.cutoff*Math.sin(a);points.push(new THREE.Vector3(...(plane===0?[x,y,0]:plane===1?[x,0,y]:[0,x,y])));}const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8eb5d1,transparent:true,opacity:.2,depthWrite:false}));outline.position.copy(cut.position);cutoffGroup.add(outline);}
    const highlighted=new Set(snapshot.highlight||[]);
    snapshot.atoms.forEach((atom,index)=>{
      const spec=ATOMS[atom.element]||ATOMS.C,selected=index===snapshot.selected,isCenter=index===snapshot.center;
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(spec.radius,28,20),new THREE.MeshStandardMaterial({color:spec.color,roughness:.26,metalness:.06,emissive:selected?0x113d60:0x000000,emissiveIntensity:.12}));mesh.position.set(...atom.pos);mesh.userData={index};atomGroup.add(mesh);
      const pick=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.28,spec.radius+.12),12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));pick.position.copy(mesh.position);pick.userData={index};atomMeshes.push(pick);atomGroup.add(pick);
      if(selected||isCenter||highlighted.has(index)){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(spec.radius+.085,.012,7,48),new THREE.MeshBasicMaterial({color:selected?BLUE:isCenter?TEAL:0x8a9aab,transparent:true,opacity:.85}));ring.position.copy(mesh.position);rings.push(ring);atomGroup.add(ring);
      }atomLabel(atom,index);
    });
    for(const edge of edges){
      const a=new THREE.Vector3(...snapshot.atoms[edge.from].pos),b=new THREE.Vector3(...snapshot.atoms[edge.to].pos),centerEdge=edge.from===snapshot.center||edge.to===snapshot.center;
      const active=highlighted.has(edge.from)&&highlighted.has(edge.to),mesh=cylinderBetween(a,b,centerEdge?.025:.015,active?BLUE:centerEdge?0x8aacc6:0xb6c5d3,active?.9:centerEdge?.65:.3);
      if(mesh){mesh.userData={from:edge.from,to:edge.to};edgeMeshes.push(mesh);bondGroup.add(mesh);}
      if(centerEdge){const pulse=new THREE.Mesh(new THREE.SphereGeometry(.055,12,8),new THREE.MeshBasicMaterial({color:BLUE,transparent:true,opacity:0}));pulseGroup.add(pulse);pulses.push({mesh:pulse,a:edge.from===snapshot.center?b:a,b:edge.from===snapshot.center?a:b});}
    }
    for(const item of snapshot.vectors||[]){
      const atom=snapshot.atoms[item.index];if(!atom||!Array.isArray(item.vector))continue;const v=new THREE.Vector3(...item.vector),length=v.length();if(!Number.isFinite(length)||length===0)continue;
      const displayLength=length*snapshot.vectorScale,origin=new THREE.Vector3(...atom.pos),shownLength=Math.min(2.5,displayLength),direction=v.clone().normalize();
      const arrow=new THREE.ArrowHelper(direction,origin,shownLength,item.color||0x14828b,Math.min(.17,shownLength*.25),Math.min(.095,shownLength*.18));effectGroup.add(arrow);
      const el=document.createElement('span');el.className='vector-label';el.textContent=(item.label||'v')+(snapshot.vectorScale!==1?` ×${Number(snapshot.vectorScale.toPrecision(3))}`:'')+(displayLength>2.5?' · 图示截断':'');el.style.color=new THREE.Color(item.color||0x14828b).getStyle();el.title=`真实向量 [${item.vector.map(x=>Number(x.toPrecision(5))).join(', ')}]；图示倍率 ${snapshot.vectorScale}`;labels.appendChild(el);const labelOffset=vectorLabels.filter(v=>v.index===item.index).length*16;vectorLabels.push({el,index:item.index,position:origin.clone().addScaledVector(direction,shownLength+.14),offset:labelOffset});
    }
    if(snapshot.harmonic)addHarmonic(snapshot.harmonic,center);
    if(snapshot.density)addDensity(snapshot.density);
    updatePulse();
  }

  function addHarmonic({l=1,m=0},center){
    l=Math.max(0,Math.min(2,Math.round(l)));m=Math.max(-l,Math.min(l,Math.round(m)));
    const geometry=new THREE.SphereGeometry(1,64,48),pos=geometry.attributes.position,colors=new Float32Array(pos.count*3);const positive=new THREE.Color(0x327eb9),negative=new THREE.Color(0xe98e57);
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),norm=Math.hypot(x,y,z),value=sphereHarmonic(l,m,x/norm,y/norm,z/norm),radius=Math.max(.012,Math.abs(value)*2.4);pos.setXYZ(i,x*radius,y*radius,z*radius);const c=value>=0?positive:negative;colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.65,side:THREE.DoubleSide,roughness:.55,depthWrite:false}));harmonicGroup.add(mesh);
    harmonicMarker=new THREE.Mesh(new THREE.SphereGeometry(.055,12,8),new THREE.MeshBasicMaterial({color:0x173c60}));harmonicGroup.add(harmonicMarker);
    harmonicRay=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,1)]),new THREE.LineDashedMaterial({color:0x52728e,dashSize:.06,gapSize:.045,transparent:true,opacity:.8}));harmonicGroup.add(harmonicRay);refreshHarmonicTransform();
  }

  function refreshHarmonicTransform(){
    if(!harmonicGroup||!snapshot.harmonic)return;
    const center=snapshot.atoms[snapshot.center]?.pos||[0,0,0];harmonicGroup.position.set(...center).applyMatrix4(currentTransform);
    let index=snapshot.selected;if(index===snapshot.center||!snapshot.atoms[index])index=snapshot.atoms.findIndex((a,i)=>i!==snapshot.center&&Math.hypot(...a.pos.map((v,k)=>v-center[k]))<snapshot.cutoff);
    const selected=snapshot.atoms[index];if(!harmonicMarker)return;harmonicMarker.visible=harmonicRay.visible=!!selected;if(!selected)return;
    const direction=new THREE.Vector3(...selected.pos).sub(new THREE.Vector3(...center)).transformDirection(currentTransform);
    const {l=1,m=0}=snapshot.harmonic,value=sphereHarmonic(l,m,direction.x,direction.y,direction.z),surface=direction.clone().multiplyScalar(Math.max(.025,Math.abs(value)*2.4));
    harmonicMarker.position.copy(surface);harmonicRay.geometry.attributes.position.setXYZ(1,direction.x*1.65,direction.y*1.65,direction.z*1.65);harmonicRay.geometry.attributes.position.needsUpdate=true;harmonicRay.computeLineDistances();
  }

  function addDensity({sigma=.35}){
    const s=Math.max(.05,Math.min(1,sigma));
    // Each shell is an exact isosurface of one Gaussian e^(-r²/(2σ²)).
    // The numerical SOAP engine separately sums and projects the full density.
    for(let index=0;index<snapshot.atoms.length;index++){
      if(index===snapshot.center)continue;const atom=snapshot.atoms[index];const d=new THREE.Vector3(...atom.pos).distanceTo(new THREE.Vector3(...snapshot.atoms[snapshot.center].pos));if(d>=snapshot.cutoff)continue;
      for(const [multiple,opacity]of [[2,.045],[1.35,.075],[.7,.12]]){const cloud=new THREE.Mesh(new THREE.SphereGeometry(s*multiple,24,16),new THREE.MeshBasicMaterial({color:atom.element==='O'?0xe7a98e:0x66b1c4,transparent:true,opacity,depthWrite:false,side:THREE.FrontSide}));cloud.position.set(...atom.pos);effectGroup.add(cloud);}
    }
  }

  function updatePulse(){
    const active=phase>0&&progress>0&&progress<1;
    pulses.forEach((p,i)=>{const t=(Math.max(0,Math.min(1,progress))+(i%3)*.065)%1;p.mesh.position.copy(p.a).lerp(p.b,t);p.mesh.material.opacity=active?.86:0;});
  }

  function projected(position,worldCoordinates=false){
    const p=new THREE.Vector3(...position);if(!worldCoordinates)p.applyMatrix4(currentTransform);p.applyAxisAngle(new THREE.Vector3(0,1,0),viewYaw).applyAxisAngle(new THREE.Vector3(1,0,0),viewPitch);
    return{x:width/2+p.x*viewScale,y:height/2-p.y*viewScale,z:p.z};
  }
  function drawFallback(){
    if(!fallback)return;fallback.setAttribute('viewBox',`0 0 ${width} ${height}`);fallback.replaceChildren();
    const defs=svgNode('defs');const gradient=svgNode('radialGradient',{id:`atomshine${id}`,cx:'35%',cy:'30%'});gradient.append(svgNode('stop',{offset:'0%','stop-color':'#fff','stop-opacity':'.9'}),svgNode('stop',{offset:'75%','stop-color':'#fff','stop-opacity':'0'}),svgNode('stop',{offset:'100%','stop-color':'#112e48','stop-opacity':'.2'}));defs.appendChild(gradient);fallback.appendChild(defs);
    const ps=snapshot.atoms.map(a=>projected(a.pos)),c=ps[snapshot.center]||{x:width/2,y:height/2};
    fallback.appendChild(svgNode('circle',{cx:c.x,cy:c.y,r:snapshot.cutoff*viewScale,fill:'#90bdd9','fill-opacity':'.035',stroke:'#9ebfd5','stroke-width':1,'stroke-dasharray':'4 6'}));
    for(const edge of edges){const a=ps[edge.from],b=ps[edge.to],central=edge.from===snapshot.center||edge.to===snapshot.center;fallback.appendChild(svgNode('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:central?'#8baac3':'#c5d2dc','stroke-width':central?3:1.5,'data-edge-from':edge.from,'data-edge-to':edge.to,tabindex:0,role:'button','aria-label':`连接 ${edge.from+1} 到 ${edge.to+1}`}));if(central&&phase>0&&progress>0&&progress<1){const start=edge.from===snapshot.center?b:a,end=edge.from===snapshot.center?a:b;fallback.appendChild(svgNode('circle',{cx:start.x+(end.x-start.x)*progress,cy:start.y+(end.y-start.y)*progress,r:4,fill:'#2878c8'}));}}
    if(snapshot.density)for(let i=0;i<ps.length;i++){if(i===snapshot.center)continue;fallback.appendChild(svgNode('circle',{cx:ps[i].x,cy:ps[i].y,r:2*snapshot.density.sigma*viewScale,fill:'#51a4bc','fill-opacity':'.09',stroke:'#6aafc5','stroke-opacity':'.15'}));}
    if(snapshot.harmonic){const l=snapshot.harmonic.l||0,m=snapshot.harmonic.m||0,worldCenter=new THREE.Vector3(...snapshot.atoms[snapshot.center].pos).applyMatrix4(currentTransform);for(let k=0;k<2;k++){const points=[];for(let n=0;n<=180;n++){const t=n*Math.PI*2/180,x=Math.cos(t),y=k?0:Math.sin(t),z=k?Math.sin(t):0,r=Math.abs(sphereHarmonic(l,m,x,y,z))*2.4;const q=projected([worldCenter.x+x*r,worldCenter.y+y*r,worldCenter.z+z*r],true);points.push(`${q.x},${q.y}`);}fallback.appendChild(svgNode('polyline',{points:points.join(' '),fill:'#3a85b9','fill-opacity':'.06',stroke:k?'#c7834d':'#3b8ab9','stroke-width':1.5}));}}
    const fallbackLabelCounts=new Map();
    for(const item of snapshot.vectors||[]){const atom=snapshot.atoms[item.index];if(!atom)continue;const v=new THREE.Vector3(...item.vector).multiplyScalar(snapshot.vectorScale),len=v.length();if(!len)continue;if(len>2.5)v.multiplyScalar(2.5/len);const color=new THREE.Color(item.color||0x14828b).getStyle(),offset=(fallbackLabelCounts.get(item.index)||0)*15;fallbackLabelCounts.set(item.index,(fallbackLabelCounts.get(item.index)||0)+1);const a=ps[item.index],b=projected(atom.pos.map((x,i)=>x+v.getComponent(i))),angle=Math.atan2(b.y-a.y,b.x-a.x),arrow=8;fallback.append(svgNode('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':2}),svgNode('path',{d:`M${b.x-arrow*Math.cos(angle-.45)},${b.y-arrow*Math.sin(angle-.45)} L${b.x},${b.y} L${b.x-arrow*Math.cos(angle+.45)},${b.y-arrow*Math.sin(angle+.45)}`,fill:'none',stroke:color,'stroke-width':2}),svgNode('text',{x:b.x+4,y:b.y-4+offset,fill:color,'font-size':11},(item.label||'v')+(snapshot.vectorScale!==1?` ×${Number(snapshot.vectorScale.toPrecision(3))}`:'')+(len>2.5?' · 截断':'')));}
    snapshot.atoms.map((a,index)=>({a,index,p:ps[index]})).sort((a,b)=>a.p.z-b.p.z).forEach(({a,index,p})=>{
      const spec=ATOMS[a.element]||ATOMS.C,r=Math.max(10,spec.radius*viewScale),selected=index===snapshot.selected,center=index===snapshot.center;
      const g=svgNode('g',{'data-atom':index,tabindex:0,role:'button','aria-label':`${a.element} 原子 ${index+1}`});g.style.cursor=edit?'move':'pointer';
      if(selected||center)g.appendChild(svgNode('circle',{cx:p.x,cy:p.y,r:r+5,fill:'none',stroke:selected?'#2878c8':'#167e7e','stroke-width':2}));
      g.append(svgNode('circle',{cx:p.x,cy:p.y,r,fill:`#${spec.color.toString(16).padStart(6,'0')}`,stroke:spec.edge,'stroke-width':1}),svgNode('circle',{cx:p.x,cy:p.y,r,fill:`url(#atomshine${id})`}),svgNode('text',{x:p.x,y:p.y-r-10,'text-anchor':'middle',fill:selected?'#15619d':'#455d73','font-size':12,'font-weight':600,'paint-order':'stroke',stroke:'#fff','stroke-width':4},`${a.element}${index+1}${center?' · 中心':''}`));
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();callbacks.onSelect?.(index);}});fallback.appendChild(g);
    });
  }

  function update(data){
    if(disposed)return;snapshot={...snapshot,...data};snapshot.atoms=snapshot.atoms||[];snapshot.cutoff=Math.max(.1,Number(snapshot.cutoff)||3);snapshot.vectorScale=Number.isFinite(snapshot.vectorScale)&&snapshot.vectorScale>0?snapshot.vectorScale:1;currentTransform=matrixFor(snapshot.transform);
    densityKey.hidden=!snapshot.density&&!snapshot.harmonic;densityKey.textContent=snapshot.density?'高斯等密度壳：0.7σ / 1.35σ / 2σ':snapshot.harmonic?`Y${snapshot.harmonic.l},${snapshot.harmonic.m} · 半径 ∝ |Y| · 蓝正 / 橙负`:'';
    edges=[];for(let i=0;i<snapshot.atoms.length;i++)for(let j=i+1;j<snapshot.atoms.length;j++){const distance=Math.hypot(...snapshot.atoms[i].pos.map((x,k)=>x-snapshot.atoms[j].pos[k]));if(distance<snapshot.cutoff&&distance>1e-8)edges.push({from:i,to:j,distance});}
    const key=JSON.stringify([snapshot.atoms,snapshot.center,snapshot.selected,snapshot.cutoff,snapshot.vectors,snapshot.vectorScale,snapshot.highlight,snapshot.harmonic,snapshot.density]);
    if(key!==geometryKey){geometryKey=key;rebuild();}else if(world){world.matrix.copy(currentTransform);refreshHarmonicTransform();}
    schedule();
  }
  function setPhase(stage,p=0){phase=stage;progress=Math.max(0,Math.min(1,p));if(renderer)updatePulse();schedule();}
  function setVisible(value){visible=!!value;if(visible){measure();schedule();}else if(frame){cancelAnimationFrame(frame);frame=0;}}
  function getCamera(){return{position:camera?.position.toArray(),target:controls?.target.toArray(),yaw:viewYaw,pitch:viewPitch,scale:viewScale};}
  function notifyCamera(){if(cameraCallbacksReady&&!syncingCamera)callbacks.onCamera?.(getCamera());}
  function setCamera(value){
    if(!value||disposed)return;syncingCamera=true;
    if(renderer&&Array.isArray(value.position)&&Array.isArray(value.target)&&value.position.length===3&&value.target.length===3&&[...value.position,...value.target].every(Number.isFinite)){camera.position.set(...value.position);controls.target.set(...value.target);controls.update();}
    if(Number.isFinite(value.yaw))viewYaw=value.yaw;if(Number.isFinite(value.pitch))viewPitch=value.pitch;if(Number.isFinite(value.scale))viewScale=value.scale;
    syncingCamera=false;schedule();
  }
  function resetCamera(){viewYaw=.5;viewPitch=.35;viewScale=Math.min(width,height)/5.6;if(camera){const center=snapshot.atoms[snapshot.center]?.pos||[0,0,0];controls.target.set(...center).applyMatrix4(currentTransform);camera.position.copy(controls.target).add(new THREE.Vector3(4.4,3.2,5.6));controls.update();}schedule();if(!renderer)notifyCamera();}
  function dispose(){disposed=true;if(frame)cancelAnimationFrame(frame);observer.disconnect();controls?.dispose();if(scene)disposeGroup(scene);renderer?.dispose();host.replaceChildren();host.classList.remove('mlip-scene');}

  setupWebGL();const observer=new ResizeObserver(measure);observer.observe(host);measure();cameraCallbacksReady=true;
  return{update,setPhase,setVisible,resetCamera,getCamera,setCamera,dispose,get isWebGL(){return!!renderer;}};
}
