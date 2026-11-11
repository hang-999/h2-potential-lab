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
  .mlip-scene{position:relative;isolation:isolate;min-width:0;min-height:0;overflow:hidden;background:var(--scene-bg,radial-gradient(ellipse at 45% 35%,#ffffff 0,#f4f8fb 65%,#e5edf4 100%));border-radius:16px;color:var(--scene-ink,#243c55);touch-action:none;box-shadow:inset 0 0 0 1px var(--scene-border,rgba(200,215,230,.55))}
  [data-theme="dark"] .mlip-scene{--scene-bg:radial-gradient(ellipse at 50% 38%,#121d28 0,#0a1118 65%,#05080c 100%);--scene-ink:#e2e8f0;--scene-border:rgba(255,255,255,.09)}
  .mlip-scene canvas,.mlip-scene .scene-fallback{position:absolute;inset:0;display:block;width:100%;height:100%;outline:none}
  .mlip-scene .scene-tools{position:absolute;z-index:4;left:12px;right:12px;top:12px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;pointer-events:none}
  .mlip-scene .scene-tools button,.mlip-scene .scene-tools select{pointer-events:auto;min-height:34px;padding:5px 9px;border:1px solid #cfdde9;border-radius:8px;font-family:inherit;font-weight:500;font-size:13px;line-height:1.4;color:#3a526e;background:#fffffff2;box-shadow:0 2px 8px rgba(18,50,78,.06);cursor:pointer;backdrop-filter:blur(10px);transition:all .15s ease}
  [data-theme="dark"] .mlip-scene .scene-tools button,[data-theme="dark"] .mlip-scene .scene-tools select{color:#cbd5e1;background:rgba(20,31,44,.85);border-color:#334458;box-shadow:0 2px 10px rgba(0,0,0,.35)}
  .mlip-scene .scene-tools button:hover,.mlip-scene .scene-tools select:hover{background:#f0f6fc;border-color:#83b8e3}
  [data-theme="dark"] .mlip-scene .scene-tools button:hover,[data-theme="dark"] .mlip-scene .scene-tools select:hover{background:#1e2e42;border-color:#4a6785}
  .mlip-scene .scene-tools button[aria-pressed=true]{color:#135f9c;border-color:#83b8e3;background:#edf6ff;font-weight:600}
  [data-theme="dark"] .mlip-scene .scene-tools button[aria-pressed=true]{color:#38bdf8;border-color:#0284c7;background:rgba(14,165,233,.18)}
  .mlip-scene .scene-tools button:focus-visible,.mlip-scene .atom-label:focus-visible{outline:3px solid #79b2ed;outline-offset:2px}
  .mlip-scene .scene-tools .scene-reset{margin-left:auto}
  .mlip-scene .scene-footer{position:absolute;z-index:4;bottom:9px;left:12px;right:12px;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;pointer-events:none;font-size:13px;line-height:1.5;color:#647a91}
  .mlip-scene .scene-footer span{background:#ffffffcf;padding:4px 8px;border-radius:6px;box-shadow:0 1px 4px rgba(18,50,78,.05);backdrop-filter:blur(8px)}
  [data-theme="dark"] .mlip-scene .scene-footer span{background:rgba(15,23,34,.8);color:#94a3b8;box-shadow:0 1px 6px rgba(0,0,0,.3)}
  .mlip-scene .scene-mode-note{max-width:78%}
  .mlip-scene .scene-axis-note{font:13px/1.5 ui-monospace,Consolas,monospace;white-space:nowrap}
  .mlip-scene .scene-labels{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}
  .mlip-scene .scene-leaders{position:absolute;inset:0;z-index:2;width:100%;height:100%;pointer-events:none;overflow:hidden}
  .mlip-scene .atom-label{position:absolute;left:0;top:0;transform:translate(-50%,-50%);pointer-events:auto;border:1px solid #d8e3ed;border-radius:6px;padding:2px 7px;background:#ffffffed;box-shadow:0 2px 8px rgba(30,60,90,.08);white-space:nowrap;font:600 14px/1.4 ui-sans-serif,'Microsoft YaHei',sans-serif;color:#465c76;cursor:pointer;min-height:0;backdrop-filter:blur(8px);transition:transform .12s ease,border-color .15s}
  [data-theme="dark"] .mlip-scene .atom-label{background:rgba(15,23,36,.9);border-color:#334458;color:#e2e8f0;box-shadow:0 2px 10px rgba(0,0,0,.4)}
  .mlip-scene .atom-label:hover{border-color:var(--blue);background:var(--panel-hover)}
  .mlip-scene .atom-label.selected{background:#e9f4ff;border-color:#38bdf8;color:var(--blue);box-shadow:0 0 0 2px rgba(56,189,248,.25)}
  [data-theme="dark"] .mlip-scene .atom-label.selected{background:rgba(14,165,233,.22);border-color:#38bdf8;color:#38bdf8;box-shadow:0 0 0 2px rgba(56,189,248,.35)}
  .mlip-scene .atom-label.center{border-color:#2dd4bf;color:#0f766e;box-shadow:0 0 0 2px rgba(45,212,191,.25)}
  [data-theme="dark"] .mlip-scene .atom-label.center{border-color:#2dd4bf;color:#2dd4bf;box-shadow:0 0 0 2px rgba(45,212,191,.35)}
  .mlip-scene .vector-label{position:absolute;left:0;top:0;transform:translate(-50%,-50%);padding:2px 6px;border:1px solid #dce8ec;border-radius:5px;color:#176f78;background:#fffffff5;font:14px/1.4 ui-monospace,Consolas,'Microsoft YaHei',sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(20,60,80,.08);backdrop-filter:blur(8px)}
  [data-theme="dark"] .mlip-scene .vector-label{background:rgba(15,23,36,.92);border-color:#334458;color:#38bdf8}
  .mlip-scene .scene-warning{position:absolute;z-index:4;left:12px;right:12px;top:55px;padding:6px 10px;border-radius:6px;background:#fff6e3eb;color:#816322;font-size:12px;pointer-events:none;backdrop-filter:blur(8px)}
  [data-theme="dark"] .mlip-scene .scene-warning{background:rgba(60,40,15,.85);color:#fde047;border:1px solid #78350f}
  .mlip-scene .scene-density-key{position:absolute;z-index:3;right:14px;top:54px;padding:4px 8px;border-radius:6px;background:#ffffffe6;color:#187c85;font-size:11px;max-width:220px;pointer-events:none;box-shadow:0 2px 6px rgba(0,0,0,.05);backdrop-filter:blur(8px)}
  [data-theme="dark"] .mlip-scene .scene-density-key{background:rgba(15,23,36,.85);color:#2dd4bf;box-shadow:0 2px 8px rgba(0,0,0,.3)}
  .mlip-scene .scene-compass{position:absolute;z-index:3;right:12px;bottom:40px;width:58px;height:58px;pointer-events:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.08))}
  .mlip-scene .scene-atom-picker{max-width:115px;margin-left:auto}
  .mlip-scene .scene-view-actions{display:contents}
  .mlip-scene[data-compact] .scene-view-actions{display:flex;flex:1 0 100%;flex-wrap:wrap;gap:6px;min-width:0}
  .mlip-scene .scene-tools>[hidden],.mlip-scene .scene-view-actions>[hidden]{display:none}
  @media(max-width:520px){.mlip-scene .scene-tools{gap:4px;left:8px;right:8px;top:8px}.mlip-scene .scene-tools button,.mlip-scene .scene-tools select{font-size:13px;padding:4px 6px}.mlip-scene .scene-footer{left:8px;right:8px;bottom:8px}.mlip-scene .scene-mode-note{max-width:75%;font-size:12px}.mlip-scene .scene-density-key{font-size:12px}.mlip-scene .scene-axis-note{font-size:12px}}
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
  if(!group)return;
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
  const resetButton=document.createElement('button');resetButton.type='button';resetButton.textContent='适配结构';resetButton.title='根据原子包围盒适配视角；截断球不影响结构大小';
  const cutoffButton=document.createElement('button');cutoffButton.type='button';cutoffButton.textContent='完整截断球';cutoffButton.title='调整缩放以显示完整截断球';
  const viewSelect=document.createElement('select');viewSelect.className='scene-view-select';viewSelect.setAttribute('aria-label','视角预设');viewSelect.title='切换相机观察方向';viewSelect.innerHTML='<option value="custom" hidden>自由视角</option><option value="iso">斜视</option><option value="top">俯视 XZ</option><option value="front">正视 XY</option><option value="side">侧视 YZ</option>';viewSelect.onchange=()=>{setPresetView(viewSelect.value);closeViewMenu();};
  const snapshotBtn=document.createElement('button');snapshotBtn.type='button';snapshotBtn.textContent='结构 PNG';snapshotBtn.title='导出结构 PNG，透明背景，不含截断球和界面标签';snapshotBtn.onclick=()=>{exportImage();closeViewMenu();};
  const viewMenu=document.createElement('button');viewMenu.type='button';viewMenu.textContent='视图';viewMenu.setAttribute('aria-expanded','false');viewMenu.setAttribute('aria-controls',`scene-view-${id}`);
  const viewActions=document.createElement('div');viewActions.id=`scene-view-${id}`;viewActions.className='scene-view-actions';viewActions.append(viewSelect,cutoffButton,snapshotBtn);
  const atomPicker=document.createElement('select');atomPicker.className='scene-atom-picker';atomPicker.setAttribute('aria-label','选择原子，包括图中省略标签的原子');atomPicker.title='所有原子均可从此列表选择';atomPicker.onchange=()=>callbacks.onSelect?.(Number(atomPicker.value));
  tools.append(orbitButton,editButton,viewMenu,viewActions);viewActions.prepend(resetButton,atomPicker);host.appendChild(tools);
  const labels=document.createElement('div');labels.className='scene-labels';host.appendChild(labels);
  const leaders=svgNode('svg',{class:'scene-leaders','aria-hidden':'true'});host.appendChild(leaders);
  const caption=document.createElement('div');caption.className='scene-footer';
  const note=document.createElement('span');note.className='scene-mode-note';note.textContent='拖动旋转视角 · 滚轮缩放 · 点击原子查看';
  const axisNote=document.createElement('span');axisNote.className='scene-axis-note';axisNote.textContent='坐标 / Å';caption.append(note,axisNote);host.appendChild(caption);
  const densityKey=document.createElement('div');densityKey.className='scene-density-key';densityKey.hidden=true;host.appendChild(densityKey);
  const compass=svgNode('svg',{class:'scene-compass',viewBox:'0 0 58 58','aria-label':'固定输入坐标轴方向'});host.appendChild(compass);
  let renderer=null,scene=null,camera=null,controls=null,world=null,atomGroup=null,bondGroup=null,effectGroup=null,pulseGroup=null,cutoffGroup=null,harmonicGroup=null,shadowGroup=null,ground=null;
  let fallback=null,warning=null,disposed=false,visible=true,edit=false,frame=0,width=1,height=1;
  let snapshot={atoms:[],center:0,selected:0,cutoff:3,vectors:[],vectorScale:1,highlight:[]},geometryKey='',phase=0,progress=0;
  let atomMeshes=[],edgeMeshes=[],atomLabels=[],vectorLabels=[],rings=[],edges=[],pulses=[],currentTransform=new THREE.Matrix4(),harmonicMarker=null,harmonicRay=null;
  const presets={iso:[-.665,.423],top:[0,Math.PI/2-.0001],front:[0,0],side:[-Math.PI/2,0]};
  let down=null,drag=null,viewYaw=presets.iso[0],viewPitch=presets.iso[1],viewScale=70,viewPreset='iso';
  let cameraCallbacksReady=false,syncingCamera=false,autoFit=true,fitMode='structure',fitAtomKey='',fallbackTarget=new THREE.Vector3();
  let compact=false,viewOpen=false,inspection=null;
  const labelPositions=new Map();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();

  function setEdit(on){edit=!!on&&typeof callbacks.onMove==='function';orbitButton.setAttribute('aria-pressed',String(!edit));editButton.setAttribute('aria-pressed',String(edit));if(controls)controls.enabled=!edit;note.textContent=edit?'拖动原子改变坐标 · 精确值可在坐标编辑器输入':'拖动旋转视角 · 滚轮缩放 · 点击原子查看';if(renderer)renderer.domElement.style.cursor=edit?'crosshair':'grab';}
  function syncViewMenu(){viewMenu.hidden=!compact;viewMenu.setAttribute('aria-expanded',String(compact&&viewOpen));viewActions.hidden=compact&&!viewOpen;}
  function closeViewMenu(){if(!viewOpen)return;viewOpen=false;syncViewMenu();measure();if(compact)viewMenu.focus();}
  viewMenu.onclick=()=>{viewOpen=!viewOpen;syncViewMenu();measure();};
  tools.addEventListener('keydown',event=>{if(event.key==='Escape'&&viewOpen){event.stopPropagation();closeViewMenu();}});
  orbitButton.onclick=()=>setEdit(false);editButton.onclick=()=>setEdit(true);resetButton.onclick=()=>{closeViewMenu();fit('structure');};cutoffButton.onclick=()=>{closeViewMenu();fit('cutoff');};

  function setupWebGL(){
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.5));renderer.setClearColor(0xffffff,0);
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
      const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','三维原子环境，拖动旋转视角，按住 Shift 拖动原子改变坐标');host.prepend(canvas);
      scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.01,120);camera.position.set(4.4,3.2,5.6);
      controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=.5;controls.maxDistance=80;controls.target.set(0,0,0);controls.enablePan=true;
      controls.addEventListener('start',()=>{autoFit=false;viewPreset='custom';viewSelect.value=viewPreset;});
      controls.addEventListener('change',()=>{if(!syncingCamera)syncProjectionPose();schedule();notifyCamera();});controls.update();
      scene.add(new THREE.AmbientLight(0xffffff,1.15));const hemi=new THREE.HemisphereLight(0xffffff,0x8da0b8,2.2);scene.add(hemi);
      const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(3,6,5);scene.add(key);const fill=new THREE.DirectionalLight(0xa8cff4,1.1);fill.position.set(-4,2,-3);scene.add(fill);
      const rim=new THREE.DirectionalLight(0x70b5ff,1.2);rim.position.set(0,-4,-5);scene.add(rim);
      world=new THREE.Group();world.matrixAutoUpdate=false;scene.add(world);
      shadowGroup=new THREE.Group();cutoffGroup=new THREE.Group();bondGroup=new THREE.Group();atomGroup=new THREE.Group();effectGroup=new THREE.Group();pulseGroup=new THREE.Group();world.add(shadowGroup,cutoffGroup,bondGroup,effectGroup,atomGroup,pulseGroup);
      // The harmonic basis is fixed in the coordinate frame; rotating the input
      // moves its sample direction, not this individual Y_lm basis function.
      harmonicGroup=new THREE.Group();scene.add(harmonicGroup);
      ground=new THREE.GridHelper(12,12,0xb9ccda,0xd5e1eb);ground.position.y=-2.5;ground.material.transparent=true;ground.material.opacity=.16;scene.add(ground);
      canvas.addEventListener('pointerdown',pointerDown,true);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('keydown',keyDown);
      canvas.addEventListener('webglcontextlost',contextLost,false);
      return true;
    }catch(error){renderer?.dispose();renderer?.domElement.remove();renderer=null;showFallback('当前环境未启用 WebGL，使用二维投影；数值计算不受影响。');return false;}
  }

  function contextLost(event){event.preventDefault();if(disposed)return;controls?.dispose();renderer?.domElement.remove();renderer=null;showFallback('图形上下文不可用，已切换二维投影；数值与选择仍可使用。');draw();}

  function showFallback(message){
    snapshotBtn.hidden=true;
    labels.hidden=false;leaders.hidden=false;
    if(!warning){warning=document.createElement('div');warning.className='scene-warning';host.appendChild(warning);}warning.textContent=message;
    if(fallback)return;
    fallback=svgNode('svg',{class:'scene-fallback',role:'img','aria-label':'原子环境二维投影，可点击原子；输入坐标可在编辑器中修改',tabindex:0});host.prepend(fallback);
    fallback.addEventListener('pointerdown',pointerDown,true);fallback.addEventListener('pointermove',pointerMove);fallback.addEventListener('pointerup',pointerUp);fallback.addEventListener('pointercancel',pointerUp);fallback.addEventListener('keydown',keyDown);
    fallback.addEventListener('wheel',e=>{e.preventDefault();autoFit=false;viewScale=Math.max(8,Math.min(400,viewScale*Math.exp(-e.deltaY*.001)));schedule();notifyCamera();},{passive:false});
  }

  function measure(){if(disposed)return;const rect=host.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);const narrow=width<700;if(narrow!==compact){compact=narrow;viewOpen=false;}host.toggleAttribute('data-compact',compact);syncViewMenu();if(renderer){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2.5));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}if(autoFit&&snapshot.atoms.length)fit(fitMode,false);schedule();}
  function schedule(){if(disposed||!visible||frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
  function draw(){if(disposed||!visible||width<2||height<2)return;if(renderer){rings.forEach(r=>{const parentQ=r.parent.getWorldQuaternion(new THREE.Quaternion());r.quaternion.copy(parentQ.invert().multiply(camera.quaternion));});cutoffGroup.children.forEach((item,i)=>{item.material.opacity=inspection?.kind==='cutoff'?(i?.62:.11):(i?.2:.02);});renderer.render(scene,camera);}else drawFallback();positionLabels();drawCompass();}

  function drawCompass(){
    compass.replaceChildren();
    const axes=[{v:[1,0,0],label:'x',color:'#bc6658'},{v:[0,1,0],label:'y',color:'#408777'},{v:[0,0,1],label:'z',color:'#5186b6'}];
    for(const a of axes){const p=new THREE.Vector3(...a.v);if(renderer)p.applyQuaternion(camera.quaternion.clone().invert());else p.applyAxisAngle(new THREE.Vector3(0,1,0),viewYaw).applyAxisAngle(new THREE.Vector3(1,0,0),viewPitch);const x=27+p.x*20,y=29-p.y*20;compass.append(svgNode('line',{x1:27,y1:29,x2:x,y2:y,stroke:a.color,'stroke-width':1.6}),svgNode('text',{x:27+p.x*25,y:32-p.y*25,'text-anchor':'middle','font-size':10,'font-weight':600,fill:a.color},a.label));}
    compass.appendChild(svgNode('circle',{cx:27,cy:29,r:2,fill:'#70869b'}));
  }

  function positionLabels(){
    const project=position=>renderer?position.clone().applyMatrix4(currentTransform).project(camera):projected(position.toArray());
    const pixels=p=>renderer?({x:(p.x*.5+.5)*width,y:(-p.y*.5+.5)*height}):p;
    const overlaps=(a,b,pad=3)=>a.x-a.w/2<b.x+b.w/2+pad&&a.x+a.w/2>b.x-b.w/2-pad&&a.y-a.h/2<b.y+b.h/2+pad&&a.y+a.h/2>b.y-b.h/2-pad;
    const top=Math.max(45,tools.offsetTop+tools.offsetHeight+7)+(warning?warning.offsetHeight+8:0),bottom=Math.max(top+30,height-caption.offsetHeight-21),occupied=[];
    const glyphs=atomLabels.map(a=>{const p=pixels(project(a.position)),spec=(ATOMS[snapshot.atoms[a.index]?.element]||ATOMS.C);let radius=Math.max(10,spec.radius*viewScale);if(renderer){const worldPosition=a.position.clone().applyMatrix4(currentTransform).applyMatrix4(camera.matrixWorldInverse);radius=spec.radius*height/(2*Math.tan(camera.fov*Math.PI/360)*Math.max(.5,-worldPosition.z));}return{...p,w:radius*2+12,h:radius*2+12,index:a.index};});
    if(!densityKey.hidden){densityKey.style.top=`${top}px`;occupied.push({x:width-14-densityKey.offsetWidth/2,y:top+densityKey.offsetHeight/2,w:densityKey.offsetWidth,h:densityKey.offsetHeight});}
    if(warning)warning.style.top=`${tools.offsetTop+tools.offsetHeight+5}px`;
    // Reserve the compass; labels never cover the coordinate reference.
    occupied.push({x:width-41,y:height-69,w:62,h:62});
    leaders.setAttribute('viewBox',`0 0 ${width} ${height}`);leaders.replaceChildren();
    if(inspection){
      const marks=glyphs.filter(g=>inspection.indices.includes(g.index));
      for(const mark of marks)leaders.appendChild(svgNode('circle',{cx:mark.x,cy:mark.y,r:mark.w/2+2,fill:'none',stroke:'var(--inspect)', 'stroke-width':2.5,'stroke-dasharray':'3 3','data-inspected-atom':mark.index}));
    }
    const items=[...atomLabels.map(a=>({...a,kind:'atom',priority:a.index===snapshot.selected?0:a.index===snapshot.center?1:3})),...vectorLabels.map(a=>({...a,kind:'vector',priority:2}))].sort((a,b)=>a.priority-b.priority||a.index-b.index);
    for(const item of items){
      const p=project(item.position),anchor=pixels(p),el=item.el;
      const suppress=item.kind==='vector'&&item.index!==snapshot.selected&&item.index!==snapshot.center;
      if(suppress||(renderer&&(p.z>1||p.z< -1))||anchor.x<0||anchor.x>width||anchor.y<0||anchor.y>height){el.hidden=true;continue;}
      el.hidden=false;const w=Math.min(el.offsetWidth,width-18),h=el.offsetHeight,ownGlyph=glyphs.find(g=>g.index===item.index),r=item.kind==='atom'?(ownGlyph?.w||20)/2:5;
      let best=null,bestScore=Infinity;
      const offsets=[],labelKey=`${item.kind}-${item.index}-${el.textContent}`,previous=labelPositions.get(labelKey);
      if(previous)offsets.push(previous);
      for(const gap of [7,24,45,68,95]){
        const dx=r+w/2+gap,dy=r+h/2+gap;
        offsets.push([0,-dy],[dx,-h/2-gap],[-dx,-h/2-gap],[dx,0],[-dx,0],[0,dy],[dx,h/2+gap],[-dx,h/2+gap]);
      }
      for(const [dx,dy] of offsets){
        const q={x:Math.max(w/2+8,Math.min(width-w/2-8,anchor.x+dx)),y:Math.max(top+h/2,Math.min(bottom-h/2,anchor.y+dy)),w,h};
        if(occupied.some(b=>overlaps(q,b))||glyphs.some(b=>overlaps(q,b,1)))continue;
        const score=Math.hypot(q.x-anchor.x,q.y-anchor.y)+(previous?Math.min(20,Math.hypot(dx-previous[0],dy-previous[1])*.2):0);
        if(score<bestScore){bestScore=score;best=q;}
      }
      if(!best){el.hidden=true;continue;}occupied.push(best);labelPositions.set(labelKey,[best.x-anchor.x,best.y-anchor.y]);el.style.left=`${best.x}px`;el.style.top=`${best.y}px`;
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
    if(e.button!==0)return;autoFit=false;const target=hit(e);down={x:e.clientX,y:e.clientY,target};
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
    if(!renderer&&down&&!edit){viewPreset='custom';viewSelect.value=viewPreset;viewYaw+=(e.clientX-down.x)*.008;viewPitch=Math.max(-1.57,Math.min(1.57,viewPitch+(e.clientY-down.y)*.008));down.x=e.clientX;down.y=e.clientY;down.moved=true;schedule();notifyCamera();}
  }
  function pointerUp(e){
    if(drag){drag=null;if(controls)controls.enabled=!edit;down=null;return;}
    if(down&&!down.moved&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const target=down.target;if(target?.type==='atom')callbacks.onSelect?.(target.index);else if(target?.type==='edge')callbacks.onEdge?.(target.from,target.to);}
    down=null;
  }
  function keyDown(e){
    const edge=e.target.closest?.('[data-edge-from]');if(edge&&(e.key==='Enter'||e.key===' ')){e.preventDefault();callbacks.onEdge?.(+edge.dataset.edgeFrom,+edge.dataset.edgeTo);return;}if(e.key==='Escape'){drag=null;setEdit(false);return;}
    if(e.key.toLowerCase()==='r'){resetCamera();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const index=snapshot.selected??0;
    if(edit&&snapshot.atoms[index]){const pos=[...snapshot.atoms[index].pos],amount=e.shiftKey?.2:.05;pos[e.key==='ArrowLeft'||e.key==='ArrowRight'?0:1]+=(e.key==='ArrowLeft'||e.key==='ArrowDown'?-1:1)*amount;callbacks.onMove?.(index,pos);}else{autoFit=false;viewPreset='custom';viewSelect.value=viewPreset;viewYaw+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);viewPitch=Math.max(-Math.PI/2+.0001,Math.min(Math.PI/2-.0001,viewPitch+(e.key==='ArrowUp'?.12:e.key==='ArrowDown'?-.12:0)));if(renderer){placeCamera(camera.position.distanceTo(controls.target)||6);controls.update();}else notifyCamera();schedule();}
  }

  function atomLabel(atom,index){
    const el=document.createElement('button');el.type='button';el.className='atom-label'+(index===snapshot.selected?' selected':'')+(index===snapshot.center?' center':'');el.textContent=atom.element+String(index+1).replace(/\d/g,n=>'₀₁₂₃₄₅₆₇₈₉'[Number(n)]);el.title=`${atom.element} 原子 ${index+1}${index===snapshot.center?' · 中心':''}：${atom.pos.map(x=>x.toFixed(3)).join(', ')} Å`;el.setAttribute('aria-label',el.title);el.onclick=()=>callbacks.onSelect?.(index);labels.appendChild(el);
    atomLabels.push({el,index,position:new THREE.Vector3(...atom.pos),offset:-27});
  }

  function cylinderBetween(a,b,radius,color,opacity=1){
    const dir=b.clone().sub(a),len=dir.length();if(len<1e-8)return null;
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,len,14,1),new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.08,transparent:opacity<1,opacity,depthWrite:opacity>.5}));mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());return mesh;
  }

  function splitBond(a,b,fromElem,toElem,radius,active,centerEdge){
    const dir=b.clone().sub(a),len=dir.length();if(len<1e-8)return[];
    const mid=a.clone().add(b).multiplyScalar(.5);
    const colA=active?BLUE:(centerEdge?0x2563eb:(ATOMS[fromElem]?.color||0x8aacc6));
    const colB=active?BLUE:(centerEdge?0x2563eb:(ATOMS[toElem]?.color||0x8aacc6));
    const op=active?.95:(centerEdge?.8:.6);
    const c1=cylinderBetween(a,mid,radius,colA,op);
    const c2=cylinderBetween(mid,b,radius,colB,op);
    return [c1,c2].filter(Boolean);
  }

  function create3DArrow(origin,direction,length,color){
    const group=new THREE.Group();
    const headLen=Math.min(.24,length*.28);
    const shaftLen=length-headLen;
    const shaftRad=Math.min(.036,length*.024);
    const headRad=Math.min(.08,length*.12);
    const mat=new THREE.MeshStandardMaterial({color,roughness:.22,metalness:.32,emissive:color,emissiveIntensity:.18});
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(shaftRad,shaftRad,shaftLen,12,1),mat);
    shaft.position.y=shaftLen/2;
    const head=new THREE.Mesh(new THREE.ConeGeometry(headRad,headLen,16),mat);
    head.position.y=shaftLen+headLen/2;
    group.add(shaft,head);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
    group.position.copy(origin);
    return group;
  }

  function rebuild(){
    if(!renderer)return;
    [shadowGroup,cutoffGroup,bondGroup,atomGroup,effectGroup,pulseGroup,harmonicGroup].forEach(disposeGroup);atomMeshes=[];edgeMeshes=[];rings=[];pulses=[];labels.replaceChildren();atomLabels=[];vectorLabels=[];harmonicMarker=null;harmonicRay=null;
    world.matrix.copy(currentTransform);
    const center=snapshot.atoms[snapshot.center]?.pos||[0,0,0];
    const cut=new THREE.Mesh(new THREE.SphereGeometry(snapshot.cutoff,40,28),new THREE.MeshBasicMaterial({color:0x83b8d9,transparent:true,opacity:.02,side:THREE.DoubleSide,depthWrite:false}));cut.position.set(...center);cutoffGroup.add(cut);
    for(let plane=0;plane<3;plane++){const points=[];for(let k=0;k<96;k++){const a=k*2*Math.PI/96,x=snapshot.cutoff*Math.cos(a),y=snapshot.cutoff*Math.sin(a);points.push(new THREE.Vector3(...(plane===0?[x,y,0]:plane===1?[x,0,y]:[0,x,y])));}const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x8eb5d1,transparent:true,opacity:.2,depthWrite:false}));outline.position.copy(cut.position);cutoffGroup.add(outline);}
    const highlighted=new Set(snapshot.highlight||[]);
    
    // Add soft contact shadows beneath atoms
    if(snapshot.atoms.length){
      const minY=Math.min(...snapshot.atoms.map(a=>a.pos[1]),0),shadowY=minY-.25;
      snapshot.atoms.forEach(atom=>{
        const spec=ATOMS[atom.element]||ATOMS.C,dist=Math.max(.1,atom.pos[1]-shadowY);
        const sRad=(spec.radius+.1)*Math.max(.8,Math.min(2,1+dist*.3));
        const sAlpha=Math.max(.03,.2/(1+dist*.8));
        const sm=new THREE.Mesh(new THREE.CircleGeometry(sRad,24),new THREE.MeshBasicMaterial({color:0x07111e,transparent:true,opacity:sAlpha,depthWrite:false}));
        sm.rotation.x=-Math.PI/2;sm.position.set(atom.pos[0],shadowY,atom.pos[2]);shadowGroup.add(sm);
      });
    }

    snapshot.atoms.forEach((atom,index)=>{
      const spec=ATOMS[atom.element]||ATOMS.C,selected=index===snapshot.selected,isCenter=index===snapshot.center;
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(spec.radius,32,24),new THREE.MeshStandardMaterial({
        color:spec.color,roughness:.18,metalness:.08,
        emissive:selected?0x1d4ed8:isCenter?0x0f766e:0x000000,
        emissiveIntensity:selected?.45:isCenter?.32:0
      }));mesh.position.set(...atom.pos);mesh.userData={index};atomGroup.add(mesh);
      const pick=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.28,spec.radius+.12),12,8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));pick.position.copy(mesh.position);pick.userData={index};atomMeshes.push(pick);atomGroup.add(pick);
      if(selected||isCenter||highlighted.has(index)){
        const ring=new THREE.Mesh(new THREE.TorusGeometry(spec.radius+.085,.013,8,48),new THREE.MeshBasicMaterial({color:selected?0x38bdf8:isCenter?0x2dd4bf:0x94a3b8,transparent:true,opacity:.9}));ring.position.copy(mesh.position);rings.push(ring);atomGroup.add(ring);
        const halo=new THREE.Mesh(new THREE.RingGeometry(spec.radius+.08,spec.radius+.18,36),new THREE.MeshBasicMaterial({color:selected?0x38bdf8:isCenter?0x2dd4bf:0x94a3b8,transparent:true,opacity:selected?.4:isCenter?.35:.15,side:THREE.DoubleSide,depthWrite:false}));halo.position.copy(mesh.position);rings.push(halo);atomGroup.add(halo);
      }atomLabel(atom,index);
    });
    for(const edge of edges){
      const a=new THREE.Vector3(...snapshot.atoms[edge.from].pos),b=new THREE.Vector3(...snapshot.atoms[edge.to].pos),centerEdge=edge.from===snapshot.center||edge.to===snapshot.center;
      const active=highlighted.has(edge.from)&&highlighted.has(edge.to);
      const elemA=snapshot.atoms[edge.from]?.element,elemB=snapshot.atoms[edge.to]?.element;
      const parts=splitBond(a,b,elemA,elemB,centerEdge?.028:.018,active,centerEdge);
      for(const mesh of parts){mesh.userData={from:edge.from,to:edge.to};edgeMeshes.push(mesh);bondGroup.add(mesh);}
      if(centerEdge){
        const pulse=new THREE.Mesh(new THREE.SphereGeometry(.055,14,10),new THREE.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:0}));
        const trail=new THREE.Mesh(new THREE.SphereGeometry(.038,10,8),new THREE.MeshBasicMaterial({color:0x0284c7,transparent:true,opacity:0}));
        pulseGroup.add(pulse,trail);pulses.push({mesh:pulse,trail,a:edge.from===snapshot.center?b:a,b:edge.from===snapshot.center?a:b});
      }
    }
    for(const item of snapshot.vectors||[]){
      const atom=snapshot.atoms[item.index];if(!atom||!Array.isArray(item.vector))continue;const v=new THREE.Vector3(...item.vector),length=v.length();if(!Number.isFinite(length)||length===0)continue;
      const displayLength=length*snapshot.vectorScale,origin=new THREE.Vector3(...atom.pos),shownLength=Math.min(2.5,displayLength),direction=v.clone().normalize();
      const arrowGroup=create3DArrow(origin,direction,shownLength,item.color||0x14828b);effectGroup.add(arrowGroup);
      if(item.index===snapshot.selected||item.index===snapshot.center){const el=document.createElement('span');el.className='vector-label';el.textContent=`v${vectorLabels.filter(v=>v.index===item.index).length+1}`;el.style.color=new THREE.Color(item.color||0x14828b).getStyle();el.title=`${item.label||'潜在向量'} [${item.vector.map(x=>Number(x.toPrecision(5))).join(', ')}]；图示倍率 ${snapshot.vectorScale}${displayLength>2.5?'；箭头已截断':''}`;labels.appendChild(el);vectorLabels.push({el,index:item.index,position:origin.clone().addScaledVector(direction,shownLength+.14)});}
    }
    if(snapshot.harmonic)addHarmonic(snapshot.harmonic,center);
    if(snapshot.density)addDensity(snapshot.density);
    updatePulse();
  }

  function addHarmonic({l=1,m=0},center){
    l=Math.max(0,Math.min(2,Math.round(l)));m=Math.max(-l,Math.min(l,Math.round(m)));
    const geometry=new THREE.SphereGeometry(1,64,48),pos=geometry.attributes.position,colors=new Float32Array(pos.count*3);const positive=new THREE.Color(0x2563eb),negative=new THREE.Color(0xf97316);
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),norm=Math.hypot(x,y,z),value=sphereHarmonic(l,m,x/norm,y/norm,z/norm),radius=Math.max(.012,Math.abs(value)*2.4);pos.setXYZ(i,x*radius,y*radius,z*radius);const c=value>=0?positive:negative;colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,opacity:.75,side:THREE.DoubleSide,roughness:.4,metalness:.12,depthWrite:false}));harmonicGroup.add(mesh);
    harmonicMarker=new THREE.Mesh(new THREE.SphereGeometry(.055,14,10),new THREE.MeshBasicMaterial({color:0x0f172a}));harmonicGroup.add(harmonicMarker);
    harmonicRay=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,1)]),new THREE.LineDashedMaterial({color:0x38bdf8,dashSize:.06,gapSize:.045,transparent:true,opacity:.85}));harmonicGroup.add(harmonicRay);refreshHarmonicTransform();
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
      const elemColor=atom.element==='O'?0xf87171:atom.element==='C'?0x60a5fa:0x34d399;
      for(const [multiple,opacity]of [[2.3,.035],[1.5,.065],[1.0,.11],[0.55,.18]]){
        const cloud=new THREE.Mesh(new THREE.SphereGeometry(s*multiple,26,18),new THREE.MeshBasicMaterial({color:elemColor,transparent:true,opacity,depthWrite:false,side:THREE.FrontSide}));
        cloud.position.set(...atom.pos);
        effectGroup.add(cloud);
      }
    }
  }

  function updatePulse(){
    const active=phase>0&&progress>0&&progress<1;
    const backward=snapshot.propagation==='backward';
    pulses.forEach((p,i)=>{
      const t=(Math.max(0,Math.min(1,progress))+(i%3)*.065)%1;
      p.mesh.position.copy(backward?p.b:p.a).lerp(backward?p.a:p.b,t);
      p.mesh.material.color.setHex(backward?0xf97316:0x38bdf8);
      p.mesh.material.opacity=active?.92:0;
      if(p.trail){
        const trailT=Math.max(0,t-0.08);
        p.trail.position.copy(backward?p.b:p.a).lerp(backward?p.a:p.b,trailT);
        p.trail.material.color.setHex(backward?0xfb923c:0x0284c7);
        p.trail.material.opacity=active?.48:0;
      }
    });
  }

  function projected(position,worldCoordinates=false){
    const p=new THREE.Vector3(...position);if(!worldCoordinates)p.applyMatrix4(currentTransform);p.sub(fallbackTarget).applyAxisAngle(new THREE.Vector3(0,1,0),viewYaw).applyAxisAngle(new THREE.Vector3(1,0,0),viewPitch);
    const top=tools.offsetTop+tools.offsetHeight+12+(warning?warning.offsetHeight+8:0),bottom=caption.offsetHeight+21;
    return{x:width/2+p.x*viewScale,y:(top+height-bottom)/2-p.y*viewScale,z:p.z};
  }
  function drawFallback(){
    if(!fallback)return;fallback.setAttribute('viewBox',`0 0 ${width} ${height}`);fallback.replaceChildren();
    const defs=svgNode('defs');const gradient=svgNode('radialGradient',{id:`atomshine${id}`,cx:'35%',cy:'30%'});gradient.append(svgNode('stop',{offset:'0%','stop-color':'#fff','stop-opacity':'.9'}),svgNode('stop',{offset:'75%','stop-color':'#fff','stop-opacity':'0'}),svgNode('stop',{offset:'100%','stop-color':'#112e48','stop-opacity':'.2'}));defs.appendChild(gradient);fallback.appendChild(defs);
    const ps=snapshot.atoms.map(a=>projected(a.pos)),c=ps[snapshot.center]||{x:width/2,y:height/2};
    const showCutoff=inspection?.kind==='cutoff';
    fallback.appendChild(svgNode('circle',{cx:c.x,cy:c.y,r:snapshot.cutoff*viewScale,fill:'#90bdd9','fill-opacity':showCutoff?.11:.035,stroke:showCutoff?'var(--inspect)':'var(--scene-line)','stroke-width':showCutoff?2:1,'stroke-dasharray':'4 6'}));
    for(const edge of edges){const a=ps[edge.from],b=ps[edge.to],central=edge.from===snapshot.center||edge.to===snapshot.center;fallback.appendChild(svgNode('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:central?'#8baac3':'#c5d2dc','stroke-width':central?3:1.5,'data-edge-from':edge.from,'data-edge-to':edge.to,tabindex:0,role:'button','aria-label':`连接 ${edge.from+1} 到 ${edge.to+1}`}));if(central&&phase>0&&progress>0&&progress<1){const backward=snapshot.propagation==='backward',inwardStart=edge.from===snapshot.center?b:a,inwardEnd=edge.from===snapshot.center?a:b,start=backward?inwardEnd:inwardStart,end=backward?inwardStart:inwardEnd;fallback.appendChild(svgNode('circle',{cx:start.x+(end.x-start.x)*progress,cy:start.y+(end.y-start.y)*progress,r:4,fill:backward?'#d47d39':'#2878c8'}));}}
    if(snapshot.density)for(let i=0;i<ps.length;i++){if(i===snapshot.center)continue;fallback.appendChild(svgNode('circle',{cx:ps[i].x,cy:ps[i].y,r:2*snapshot.density.sigma*viewScale,fill:'#51a4bc','fill-opacity':'.09',stroke:'#6aafc5','stroke-opacity':'.15'}));}
    if(snapshot.harmonic){const l=snapshot.harmonic.l||0,m=snapshot.harmonic.m||0,worldCenter=new THREE.Vector3(...snapshot.atoms[snapshot.center].pos).applyMatrix4(currentTransform);for(let k=0;k<2;k++){const points=[];let previous=null;for(let n=0;n<=180;n++){const t=n*Math.PI*2/180,x=Math.cos(t),y=k?0:Math.sin(t),z=k?Math.sin(t):0,r=Math.abs(sphereHarmonic(l,m,x,y,z))*2.4;const q=projected([worldCenter.x+x*r,worldCenter.y+y*r,worldCenter.z+z*r],true);points.push(`${q.x},${q.y}`);if(previous)fallback.appendChild(svgNode('line',{x1:previous.x,y1:previous.y,x2:q.x,y2:q.y,stroke:sphereHarmonic(l,m,x,y,z)>=0?'#2563eb':'#f97316','stroke-width':1.5}));previous=q;}fallback.appendChild(svgNode('polyline',{points:points.join(' '),fill:'#3a85b9','fill-opacity':'.06',stroke:'#3b8ab9','stroke-width':0}));}}
    const fallbackLabelCounts=new Map();
    for(const item of snapshot.vectors||[]){const atom=snapshot.atoms[item.index];if(!atom)continue;const v=new THREE.Vector3(...item.vector).multiplyScalar(snapshot.vectorScale),len=v.length();if(!len)continue;if(len>2.5)v.multiplyScalar(2.5/len);const color=new THREE.Color(item.color||0x14828b).getStyle(),offset=(fallbackLabelCounts.get(item.index)||0)*15;fallbackLabelCounts.set(item.index,(fallbackLabelCounts.get(item.index)||0)+1);const a=ps[item.index],b=projected(atom.pos.map((x,i)=>x+v.getComponent(i))),angle=Math.atan2(b.y-a.y,b.x-a.x),arrow=8;fallback.append(svgNode('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':2}),svgNode('path',{d:`M${b.x-arrow*Math.cos(angle-.45)},${b.y-arrow*Math.sin(angle-.45)} L${b.x},${b.y} L${b.x-arrow*Math.cos(angle+.45)},${b.y-arrow*Math.sin(angle+.45)}`,fill:'none',stroke:color,'stroke-width':2}));}
    snapshot.atoms.map((a,index)=>({a,index,p:ps[index]})).sort((a,b)=>a.p.z-b.p.z).forEach(({a,index,p})=>{
      const spec=ATOMS[a.element]||ATOMS.C,r=Math.max(10,spec.radius*viewScale),selected=index===snapshot.selected,center=index===snapshot.center;
      const g=svgNode('g',{'data-atom':index,tabindex:0,role:'button','aria-label':`${a.element} 原子 ${index+1}`});g.style.cursor=edit?'move':'pointer';
      if(selected||center)g.appendChild(svgNode('circle',{cx:p.x,cy:p.y,r:r+5,fill:'none',stroke:selected?'#2878c8':'#167e7e','stroke-width':2}));
      g.append(svgNode('circle',{cx:p.x,cy:p.y,r,fill:`#${spec.color.toString(16).padStart(6,'0')}`,stroke:spec.edge,'stroke-width':1}),svgNode('circle',{cx:p.x,cy:p.y,r,fill:`url(#atomshine${id})`}) );
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();callbacks.onSelect?.(index);}});fallback.appendChild(g);
    });
  }

  function update(data){
    if(disposed)return;snapshot={...snapshot,...data};snapshot.atoms=snapshot.atoms||[];snapshot.cutoff=Math.max(.1,Number(snapshot.cutoff)||3);snapshot.vectorScale=Number.isFinite(snapshot.vectorScale)&&snapshot.vectorScale>0?snapshot.vectorScale:1;currentTransform=matrixFor(snapshot.transform);
    densityKey.hidden=!snapshot.density&&!snapshot.harmonic;densityKey.textContent=snapshot.density?'高斯等密度壳：0.55σ / 1.0σ / 1.5σ / 2.3σ':snapshot.harmonic?`Y${snapshot.harmonic.l},${snapshot.harmonic.m} · 半径 ∝ |Y| · 蓝正 / 橙负`:'';
    edges=[];for(let i=0;i<snapshot.atoms.length;i++)for(let j=i+1;j<snapshot.atoms.length;j++){const distance=Math.hypot(...snapshot.atoms[i].pos.map((x,k)=>x-snapshot.atoms[j].pos[k]));if(distance<snapshot.cutoff&&distance>1e-8)edges.push({from:i,to:j,distance});}
    const key=JSON.stringify([snapshot.atoms,snapshot.center,snapshot.selected,snapshot.cutoff,snapshot.vectors,snapshot.vectorScale,snapshot.highlight,snapshot.harmonic,snapshot.density]);
    if(key!==geometryKey){geometryKey=key;rebuild();if(!renderer){labels.replaceChildren();atomLabels=[];vectorLabels=[];snapshot.atoms.forEach(atomLabel);}}else if(world){world.matrix.copy(currentTransform);refreshHarmonicTransform();}
    const atomKey=snapshot.atoms.map(a=>`${a.element}:${a.id}`).join('|');
    if(atomKey!==fitAtomKey){fitAtomKey=atomKey;atomPicker.replaceChildren(...snapshot.atoms.map((a,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`${a.element}${i+1}${i===snapshot.center?' · 中心':''}`;return option;}));autoFit=true;}
    atomPicker.value=String(snapshot.selected??0);
    if(autoFit)fit(fitMode,false);
    schedule();
  }
  function setPhase(stage,p=0){phase=stage;progress=Math.max(0,Math.min(1,p));if(renderer)updatePulse();schedule();}
  function setVisible(value){const next=!!value;if(next===visible)return;visible=next;if(visible){measure();schedule();}else if(frame){cancelAnimationFrame(frame);frame=0;}}
  function syncProjectionPose(){
    const offset=camera.position.clone().sub(controls.target),distance=offset.length();
    if(!distance)return;
    viewYaw=-Math.atan2(offset.x,offset.z);
    viewPitch=Math.asin(Math.max(-1,Math.min(1,offset.y/distance)));
    viewScale=height/(2*distance*Math.tan(camera.fov*Math.PI/360));
  }
  function getCamera(){return{position:renderer?camera.position.toArray():null,target:renderer?controls.target.toArray():null,up:camera?.up.toArray(),yaw:viewYaw,pitch:viewPitch,scale:viewScale,fallbackTarget:fallbackTarget.toArray(),autoFit,fitMode,preset:viewPreset};}
  function notifyCamera(){if(cameraCallbacksReady&&!syncingCamera)callbacks.onCamera?.(getCamera());}
  function setCamera(value){
    if(!value||disposed)return;syncingCamera=true;
    const isVector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
    if(renderer&&isVector(value.position)&&isVector(value.target)){camera.position.set(...value.position);controls.target.set(...value.target);if(isVector(value.up))camera.up.set(...value.up);controls.update();}
    if(Number.isFinite(value.yaw))viewYaw=value.yaw;if(Number.isFinite(value.pitch))viewPitch=value.pitch;if(Number.isFinite(value.scale))viewScale=value.scale;
    if(Array.isArray(value.fallbackTarget)&&value.fallbackTarget.length===3&&value.fallbackTarget.every(Number.isFinite))fallbackTarget.set(...value.fallbackTarget);
    if(typeof value.autoFit==='boolean')autoFit=value.autoFit;if(['structure','cutoff'].includes(value.fitMode))fitMode=value.fitMode;
    viewPreset=Object.hasOwn(presets,value.preset)?value.preset:'custom';viewSelect.value=viewPreset;
    if(renderer&&!isVector(value.position)){const distance=height/(2*viewScale*Math.tan(camera.fov*Math.PI/360));controls.target.copy(fallbackTarget);placeCamera(distance);controls.update();}
    syncingCamera=false;if(autoFit)fit(fitMode,false);schedule();
  }
  function fit(mode='structure',notify=true){
    if(!snapshot.atoms.length||width<2||height<2)return;
    fitMode=mode==='cutoff'?'cutoff':'structure';autoFit=true;
    const box=new THREE.Box3();
    if(fitMode==='cutoff'){
      const center=new THREE.Vector3(...(snapshot.atoms[snapshot.center]?.pos||[0,0,0])).applyMatrix4(currentTransform),extent=new THREE.Vector3().setScalar(snapshot.cutoff);
      box.set(center.clone().sub(extent),center.clone().add(extent));
    }else for(const a of snapshot.atoms){const p=new THREE.Vector3(...a.pos).applyMatrix4(currentTransform),r=new THREE.Vector3().setScalar((ATOMS[a.element]||ATOMS.C).radius+.08);box.expandByPoint(p.clone().sub(r));box.expandByPoint(p.clone().add(r));}
    const center=box.getCenter(new THREE.Vector3());
    // Fit the actual spheres, not the empty corners of an axis-aligned box.
    const extents=fitMode==='cutoff'?[{p:new THREE.Vector3(),r:snapshot.cutoff}]:snapshot.atoms.map(a=>({p:new THREE.Vector3(...a.pos).applyMatrix4(currentTransform).sub(center),r:(ATOMS[a.element]||ATOMS.C).radius+.025}));
    const top=tools.offsetTop+tools.offsetHeight+12+(warning?warning.offsetHeight+8:0),bottom=caption.offsetHeight+21,usableH=Math.max(80,height-top-bottom),usableW=Math.max(80,width-36);
    fallbackTarget.copy(center);
    if(renderer){
      const direction=camera.position.clone().sub(controls.target).normalize();if(!direction.lengthSq())direction.set(4.4,3.2,5.6).normalize();
      const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
      const hz=Math.max(...extents.map(({p,r})=>Math.abs(p.dot(direction))+r)),tan=Math.tan(camera.fov*Math.PI/360),coverage=fitMode==='cutoff'?.84:.92;
      const cx=width/2,cy=(top+height-bottom)/2,halfW=usableW*coverage/2,halfH=usableH*coverage/2;
      // Test the actual perspective projection. A global '+depth' bound made
      // planar molecules unnecessarily tiny when the camera was oblique.
      const setDistance=dist=>{const offset=(top-bottom)/height*dist*tan;controls.target.copy(center).addScaledVector(up,offset);camera.position.copy(controls.target).addScaledVector(direction,dist);camera.lookAt(controls.target);camera.updateMatrixWorld();};
      const fits=dist=>{setDistance(dist);return extents.every(({p,r})=>{const world=p.clone().add(center),eye=world.clone().applyMatrix4(camera.matrixWorldInverse),z=-eye.z;if(z<=r)return false;const screen=world.project(camera),x=(screen.x*.5+.5)*width,y=(-screen.y*.5+.5)*height,rr=r*height/(2*tan*Math.sqrt(z*z-r*r));return Math.abs(x-cx)+rr<=halfW&&Math.abs(y-cy)+rr<=halfH;});};
      let lo=Math.max(.2,hz+.1),hi=Math.max(3,lo*2);while(!fits(hi)&&hi<200)hi*=1.5;
      for(let i=0;i<22;i++){const mid=(lo+hi)/2;if(fits(mid))hi=mid;else lo=mid;}
      syncingCamera=true;setDistance(hi);controls.update();syncingCamera=false;syncProjectionPose();
    }else{
      const projectedExtents=extents.map(({p,r})=>({p:p.applyAxisAngle(new THREE.Vector3(0,1,0),viewYaw).applyAxisAngle(new THREE.Vector3(1,0,0),viewPitch),r}));
      const hx=Math.max(.2,...projectedExtents.map(({p,r})=>Math.abs(p.x)+r)),hy=Math.max(.2,...projectedExtents.map(({p,r})=>Math.abs(p.y)+r));
      const coverage=fitMode==='cutoff'?.84:.92;viewScale=Math.min(usableW*coverage/(2*hx),usableH*coverage/(2*hy));
    }
    resetButton.setAttribute('aria-pressed',String(fitMode==='structure'));cutoffButton.setAttribute('aria-pressed',String(fitMode==='cutoff'));
    schedule();if(notify)notifyCamera();
  }
  function placeCamera(distance){
    const c=Math.cos(viewPitch);
    const direction=new THREE.Vector3(-Math.sin(viewYaw)*c,Math.sin(viewPitch),Math.cos(viewYaw)*c);
    camera.up.set(0,1,0);
    camera.position.copy(controls.target).addScaledVector(direction,distance);
  }
  function setPresetView(mode='iso'){
    if(!Object.hasOwn(presets,mode))return;
    [viewYaw,viewPitch]=presets[mode];viewPreset=mode;viewSelect.value=mode;
    if(renderer){syncingCamera=true;placeCamera(camera.position.distanceTo(controls.target)||6);controls.update();syncingCamera=false;}
    fit(fitMode);
  }
  function exportImage(){
    try{
      if(!renderer||!visible||!snapshot.atoms.length||width<2||height<2)throw new Error('场景还未就绪');
      // The translucent cutoff sphere can cover the entire view after fitting
      // the structure, tinting pixels that should be completely transparent.
      const shownCutoff=cutoffGroup.visible;let url;
      try{cutoffGroup.visible=false;draw();url=renderer.domElement.toDataURL('image/png');}
      finally{cutoffGroup.visible=shownCutoff;schedule();}
      if(!url.startsWith('data:image/png;base64,'))throw new Error('浏览器未生成 PNG');
      const a=document.createElement('a');a.href=url;a.download=`MLIP-structure-${Date.now()}.png`;a.click();
    }catch(error){note.setAttribute('role','status');note.textContent='导出失败：'+error.message;}
  }
  function inspect(value){inspection=value;schedule();}
  function resetCamera(){fitMode='structure';setPresetView('iso');}
  function dispose(){disposed=true;if(frame)cancelAnimationFrame(frame);observer.disconnect();controls?.dispose();if(scene)disposeGroup(scene);renderer?.dispose();host.replaceChildren();host.classList.remove('mlip-scene');}

  setupWebGL();const observer=new ResizeObserver(measure);observer.observe(host);measure();cameraCallbacksReady=true;
  return{update,setPhase,setVisible,resetCamera,fit,getCamera,setCamera,dispose,inspect,getLabelState:()=>[...atomLabels,...vectorLabels].map(a=>({index:a.index,text:a.el.textContent,hidden:a.el.hidden,rect:a.el.getBoundingClientRect().toJSON()})),get isWebGL(){return!!renderer;}};
}
