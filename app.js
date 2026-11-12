import './operators.js';
import './sharing.js';
import './h2/engine.js';
import {createScene} from './scene.js';
import {lessons,methodCards,resources} from './lessons.js';
import {createTrainingLab} from './training-ui.js';

const M=globalThis.MLIP,$=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(n,d=4)=>Number.isFinite(n)?(Math.abs(n)>0&&Math.abs(n)<.0001?n.toExponential(2):n.toFixed(d)):'—';
const norm=v=>Math.hypot(...v), vec=v=>'['+v.map(x=>num(x,3)).join(', ')+']';
const currentSnapshot=()=>snapshot&&snapshot.version===state.version;
const isLesson=id=>lessons.some(x=>x.id===id),lesson=()=>lessons.find(x=>x.id===state.chapter)||lessons[0];
let state={chapter:'symmetry',atoms:clone(M.presets.environment),center:0,selected:1,params:clone(M.defaults),transform:{axis:'z',angle:60,reflection:false},stage:0,version:0,referenceAtoms:clone(M.presets.tetrahedron),referenceCenter:0};
let snapshot=null,reference=null,featureIndex=0,roundView=1,harmonicL=1,harmonicM=0,featurePage=0,referencePinned=false,playing=false,position=0,speed=1,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,sceneA=null,sceneB=null,route='map',h2Loaded=false,frame=0,lastTime=0,toastTimer=0,computeTimer=0,computeVersion=0;
let trainingLab=null,trainingMode=false;

const assets=JSON.parse($('embedded-assets').textContent),workerURL=URL.createObjectURL(new Blob([$('worker-source').textContent],{type:'text/javascript'})),worker=new Worker(workerURL);
const paramsInfo={
 cutoff:['截断半径 r꜀ / Å',.5,5,.1,'控制哪些邻居参与计算'],radial:['径向基数量 nₘₐₓ',1,4,1,'有限基展开的径向分辨率'],lmax:['球谐最高阶 lₘₐₓ',0,2,1,'0、1、2 阶分别有 1、3、5 个分量'],channels:['通道数量 C',1,8,1,'每个节点的标量／向量通道数'],rounds:['消息轮数 T',1,3,1,'独立于关联阶数与表示阶数'],correlation:['关联阶数 ν',1,3,1,'聚合特征相乘的因子数'],sigma:['密度宽度 σ / Å',.1,1,.05,'邻居高斯密度的标准差'],eta:['ACSF 衰减 η / Å⁻²',.1,5,.1,'越大越强调窄距离窗口'],rs:['径向窗口中心 Rₛ / Å',0,5,.1,'各窗口围绕该值排布'],zeta:['角向锐度 ζ',1,8,1,'越大越强调特定角度'],lambda:['角向方向 λ',-1,1,2,'+1 或 −1'],angleMessages:['加入角度消息',0,1,1,'用于比较距离过滤与角度关联']
};

function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
function showError(error){$('error').hidden=false;$('error').textContent=error.message||String(error);if(error.field)document.querySelector(`[data-param="${error.field}"]`)?.setAttribute('aria-invalid','true');}
function clearError(){$('error').hidden=true;document.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));}
function download(name,text,type='application/json'){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function updateState(change,{immediate=false,editor=false}={}){try{const next=M.validate({...state,...change});stop();state=next;clearError();if(editor)renderAtomEditor();requestCompute(immediate);return true;}catch(e){showError(e);return false;}}
function requestCompute(immediate=false){clearFormulaInspection();state.version=++computeVersion;$('snapshot-id').textContent='计算中 · '+state.version;clearTimeout(computeTimer);const send=()=>worker.postMessage({type:'compute',state:clone(state)});if(immediate)send();else computeTimer=setTimeout(send,30);}
worker.onmessage=({data:m})=>{if(m.version!==state.version)return;if(m.type==='error'){showError(m);return;}snapshot=Object.freeze(m.result);reference=m.reference||null;if(isLesson(route)&&!trainingMode)renderSnapshot();window.__mlipReady=true;};
worker.onerror=e=>showError(new Error('本地计算线程异常：'+e.message));

function makeMap(){
 const glyphs={symmetry:'⟳',acsf:'∿',soap:'◉',moments:'❖',messages:'☍',vectors:'↗',harmonics:'⊗',mace:'⛶'};
 $('chapter-nav').innerHTML=lessons.map(l=>`<a class="chapter-link" href="#/${l.id}" data-chapter="${l.id}" title="${esc(l.short)}" aria-label="${l.number} ${esc(l.short)}"><span class="chapter-glyph" aria-hidden="true">${glyphs[l.id]||'•'}</span><span>${l.number}</span><div><strong>${esc(l.short)}</strong><small>${esc(l.id.toUpperCase())}</small></div></a>`).join('');
 const card=l=>`<a href="#/${l.id}" class="map-card"><span class="chapter-glyph" aria-hidden="true">${glyphs[l.id]||'•'}</span><span>${l.number}</span><div><strong>${esc(l.short)}</strong><small>${esc(l.badge)}</small></div><b>→</b></a>`;
 $('fixed-cards').innerHTML=lessons.slice(1,4).map(card).join('');$('learned-cards').innerHTML=lessons.slice(4).map(card).join('');
 $('method-cards').innerHTML=methodCards.map(c=>`<article class="library-card"><span class="family">${esc(c.family)}</span><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><div><a href="#/${c.chapter}">相关实验 →</a>　<a href="${c.url}" target="_blank" rel="noopener">官方项目 ↗</a></div></article>`).join('');
 $('resource-list').innerHTML=resources.map(r=>`<div class="resource-row"><a href="${r.url}" target="_blank" rel="noopener">${esc(r.name)} ↗</a><p>${esc(r.use)}</p></div>`).join('');
}
function navigate(){const incoming=new URLSearchParams(location.hash.split('?')[1]||'').get('experiment');if(incoming){receiveShared(incoming);return;}clearFormulaInspection();const [requested='map',query='']=location.hash.replace(/^#\/?/,'').split('?');route=isLesson(requested)||['map','h2','reading'].includes(requested)?requested:'map';stop();trainingLab?.pause();trainingMode=isLesson(route)&&new URLSearchParams(query).get('mode')==='train';
 $('map-view').hidden=route!=='map';$('lab-view').hidden=!isLesson(route);$('h2-view').hidden=route!=='h2';
 $('reading-view').hidden=route!=='reading';if(route==='reading'){let note=$('reading-runtime-note');if(!note){note=document.createElement('p');note.id='reading-runtime-note';note.className='caution';$('reading-view').prepend(note);}note.textContent=location.protocol==='file:'?'阅读馆需启动本地预览服务（node serve.cjs）；部分原版图表需联网。实验室其他章节可离线使用。':'部分原版图表需联网；PAIR 优先使用预置结果，自定义输入需启动本地推理服务。';}
 document.querySelectorAll('[data-reading-link]').forEach(link=>{if(route==='reading')link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
 $('lab-view').hidden=!isLesson(route)||trainingMode;$('mode-controls').hidden=!isLesson(route);$('training-view').hidden=!trainingMode;document.body.classList.toggle('training-mode',trainingMode);document.body.classList.toggle('experiment-route',isLesson(route));$('mode-principle').classList.toggle('active',!trainingMode);$('mode-training').classList.toggle('active',trainingMode);
 document.querySelectorAll('[data-chapter]').forEach(a=>{a.classList.toggle('active',a.dataset.chapter===route);if(a.dataset.chapter===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.querySelector('.h2-link').classList.toggle('active',route==='h2');
 sceneA?.setVisible(isLesson(route)&&!trainingMode);sceneB?.setVisible(isLesson(route)&&!trainingMode&&$('compare').checked);
 if(!trainingMode)trainingLab?.hide();
 if(h2Loaded&&route!=='h2')$('h2-frame').contentWindow?.postMessage({type:'mlip-pause'},'*');
 if(route==='h2'){ensureH2();document.title='H₂ 真实训练 · MLIP 实验室';}
 else if(isLesson(route)){state.chapter=route;state.stage=0;position=0;featureIndex=0;featurePage=0;roundView=Math.min(roundView,state.params.rounds);if(trainingMode){if(!trainingLab)trainingLab=createTrainingLab($('training-view'),{createScene,onError:showError,onMethodChange:m=>location.hash='#/'+m+'?mode=train'});trainingLab.show(route);}else{$('compare').checked=route==='soap';renderLesson();ensureScenes();if(snapshot)renderSnapshot();requestCompute();}document.title=lesson().title+' · MLIP 实验室';}
 else document.title=route==='reading'?'交互阅读馆 · MLIP 实验室':'MLIP 方法交互实验室 · 从描述符到等变网络';
 $('share-experiment').disabled=!isLesson(route)&&route!=='h2';$('more-nav').open=matchMedia('(min-width:1200px)').matches;window.scrollTo({top:0,behavior:'instant'});
}
function ensureScenes(){if(sceneA)return;sceneA=createScene($('scene-a'),{onSelect:selectAtom,onMove:moveAtom,onEdge:selectEdge,onCamera:view=>sceneB?.setCamera(view)});sceneB=createScene($('scene-b'),{onSelect:i=>{if(!(state.chapter==='soap'||referencePinned&&['acsf','moments'].includes(state.chapter)))selectAtom(i);},onEdge:()=>{},onCamera:view=>sceneA?.setCamera(view)});}
function selectAtom(index){stop();state.selected=index;featureIndex=0;selectedEdge=null;highlight=[];requestCompute();renderAtomEditor();}
function selectEdge(from,to){state.selected=to===state.center?from:to;selectedEdge=[from,to];requestCompute();toast(`已选择消息 ${from+1} → ${to+1}`);}
let selectedEdge=null;
function moveAtom(index,pos){const atoms=clone(state.atoms);atoms[index].pos=pos.map(x=>+x.toFixed(5));updateState({atoms},{editor:true});}
function renderLesson(){harmonicL=Math.min(harmonicL,state.params.lmax);harmonicM=Math.max(-harmonicL,Math.min(harmonicL,harmonicM));const l=lesson();$('lesson-number').textContent=l.number;$('lesson-kicker').textContent=l.kicker;$('lesson-title').textContent=l.title;$('lesson-intro').textContent=l.intro;$('lesson-badge').textContent=l.badge;$('lesson-question').textContent=l.question;$('chapter-train-link').href='#/'+state.chapter+'?mode=train';$('lesson-caution').textContent=l.caution;$('lesson-refs').innerHTML=l.refs.map(r=>`<a href="${r.url}" target="_blank" rel="noopener">${esc(r.label)} ↗</a>`).join('');$('guided-action').title=l.experiment||'';
 $('stage-tabs').innerHTML=l.stages.map((s,i)=>`<button role="tab" data-stage="${i}" title="${esc(s.title)}" aria-selected="${i===0}">${i+1}</button>`).join('');$('stage-tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>setPosition(+b.dataset.stage));
 $('timeline').max=String(l.stages.length*1000-1);renderParameters();renderAtomEditor();renderStage();
}
function visibleControls(){let controls=lesson().controls.filter(c=>c!=='weights');if(['messages','vectors'].includes(state.chapter))controls=controls.filter(c=>c!=='radial');if(state.chapter==='mace')controls=controls.filter(c=>!['radial','lmax','channels'].includes(c));if(state.chapter==='moments')controls=controls.filter(c=>c!=='radial');if(state.chapter==='harmonics')controls=controls.filter(c=>c!=='weights');return controls;}
function renderParameters(){const list=visibleControls();$('parameter-fields').innerHTML=list.map(k=>{const [label,min,max,step,hint]=paramsInfo[k];return `<label class="parameter-field"><span>${label}</span>${k==='angleMessages'?`<select data-param="${k}"><option value="false">仅距离</option><option value="true">距离＋夹角</option></select>`:k==='lambda'?`<select data-param="${k}"><option value="1">+1</option><option value="-1">−1</option></select>`:`<input data-param="${k}" type="number" min="${min}" max="${max}" step="${step}" value="${state.params[k]}">`}<small>${hint}</small></label>`;}).join('');
 $('parameter-fields').querySelectorAll('[data-param]').forEach(el=>{el.value=String(state.params[el.dataset.param]);el.onchange=()=>{stop();const k=el.dataset.param,value=k==='angleMessages'?el.value==='true':Number(el.value);if(updateState({params:{...state.params,[k]:value}})){roundView=Math.min(roundView,state.params.rounds);harmonicL=Math.min(harmonicL,state.params.lmax);harmonicM=Math.max(-harmonicL,Math.min(harmonicL,harmonicM));featureIndex=0;featurePage=0;}};});
 $('weight-fields').innerHTML=state.params.weights.map((w,i)=>`<label class="parameter-field"><span>w${i} / 可调系数</span><input data-weight="${i}" aria-label="权重 w${i}" type="number" min="-5" max="5" step=".05" value="${w}" ${(state.chapter==='messages'&&i===3||state.chapter==='mace'&&i>=state.params.correlation)?'disabled title="本章当前不使用此系数"':''}></label>`).join('');$('weight-fields').querySelectorAll('input').forEach(el=>el.onchange=()=>{stop();const weights=state.params.weights.slice();weights[+el.dataset.weight]=+el.value;updateState({params:{...state.params,weights}});});
 document.querySelector('.weight-editor').hidden=!lesson().controls.includes('weights');$('weight-usage').textContent='ACSF：隐藏层缩放／偏置与读出；矩与关联：线性系数；消息模型：过滤、标量混合、向量耦合与读出。具体算式见各阶段。';
}
function renderAtomEditor(){const html=state.atoms.map((a,i)=>`<div class="atom-row ${i===state.selected?'selected':''}"><button data-atom-select="${i}" aria-label="选择原子 ${i+1}">${i+1}${i===state.center?'●':''}</button><select aria-label="原子 ${i+1} 元素" data-element="${i}">${['H','C','O'].map(e=>`<option ${a.element===e?'selected':''}>${e}</option>`).join('')}</select>${a.pos.map((x,k)=>`<label>${['x','y','z'][k]}<input type="number" step=".05" min="-30" max="30" value="${num(x,3)}" data-coordinate="${i},${k}" aria-label="原子 ${i+1} ${['x','y','z'][k]} 坐标"></label>`).join('')}</div>`).join('');$('atom-fields').innerHTML=html;
 $('atom-fields').querySelectorAll('[data-atom-select]').forEach(b=>b.onclick=()=>selectAtom(+b.dataset.atomSelect));$('atom-fields').querySelectorAll('[data-element]').forEach(el=>el.onchange=()=>{const atoms=clone(state.atoms);atoms[+el.dataset.element].element=el.value;updateState({atoms});});$('atom-fields').querySelectorAll('[data-coordinate]').forEach(el=>el.onchange=()=>{const[i,k]=el.dataset.coordinate.split(',').map(Number),atoms=clone(state.atoms);atoms[i].pos[k]=+el.value;updateState({atoms});});$('add-atom').disabled=state.atoms.length>=8;$('remove-atom').disabled=state.atoms.length<=3;
}
function renderSnapshot(){if(!currentSnapshot())return;$('snapshot-id').textContent='SNAPSHOT '+snapshot.version;$('geometry-summary').textContent=`${state.atoms.length} 原子 · ${snapshot.geometry.neighbors.length} 邻居`;
 $('rotation-angle').value=state.transform.angle;$('rotation-output').textContent=state.transform.angle+'°';$('rotation-axis').value=state.transform.axis;$('reflection').checked=state.transform.reflection;
 renderStage();renderFeatures();renderChecks();renderScenes();if(formulaPointer||formulaFocus)showFormulaInspection();renderModelWeights();if(snapshot.warnings?.length)$('check-note').textContent+=' '+snapshot.warnings.join(' ');
}
function currentRound(){return Math.min(state.params.rounds,Math.max(1,roundView));}
function currentLayer(vector=false){const a=vector?snapshot.vectors:snapshot.messages;return a.layers[state.stage===0?0:currentRound()];}
function messageFeatures(vector=false){
 const model=vector?snapshot.vectors:snapshot.messages,round=currentRound(),layer=model.layers[round],index=state.selected;
 if(state.stage===0)return model.layers[0].nodes[index].s.map((value,k)=>({label:`h⁰ ${k+1} / 原子${index+1}`,value}));
 const incoming=layer.edges.filter(e=>e.to===index);
 if(state.stage===1){const edge=selectedEdge?layer.edges.find(e=>e.from===selectedEdge[0]&&e.to===selectedEdge[1]):incoming[0];if(!edge)return[];return edge.message.map((value,k)=>({label:`m${edge.from+1}→${edge.to+1} c${k+1}`,value,indices:[edge.from,edge.to]})).concat(vector?edge.vectorMessage.map((v,k)=>({label:`|mᵥ| c${k+1}`,value:norm(v),vector:v,indices:[edge.from,edge.to]})):[]);}
 if(state.stage===2&&!vector)return Array.from({length:state.params.channels},(_,k)=>({label:`Σ m / 通道${k+1}`,value:incoming.reduce((v,e)=>v+e.message[k],0),indices:incoming.map(e=>e.from)}));
 const n=layer.nodes[index];return n.s.map((value,k)=>({label:`s${k+1} / 原子${index+1}`,value})).concat(vector?n.v.map((v,k)=>({label:`|v${k+1}|`,value:norm(v),vector:v})):[]);
}
function getFeatures(){if(!currentSnapshot())return[];const s=snapshot,c=state.chapter,st=state.stage;
 if(c==='symmetry')return s.geometry.neighbors.map(n=>({label:`${state.center+1}→${n.index+1} / Å`,value:n.r,indices:[state.center,n.index],compare:n.r}));
 if(c==='acsf'){if(st===3)return s.acsf.readout.hidden.map((v,i)=>({label:`a${i+1}`,value:v}));return s.acsf.features.filter(f=>st===1?f.kind==='radial':st===2?f.kind==='angular':true).map(f=>({...f,compare:referencePinned&&reference?reference.acsf.features.find(x=>x.label===f.label)?.value:undefined}));}
 if(c==='soap'){if(st<2)return s.soap.coefficients.filter(x=>x.l<=state.params.lmax).map(f=>({label:`${f.species} ${f.n},${f.l},${f.m}`,value:f.value}));return s.soap.power.map((f,i)=>({...f,compare:s.soap.referencePower[i]}));}
 if(c==='moments')return s.moments.invariants.map((f,i)=>({...f,compare:referencePinned&&reference?reference.moments.invariants[i]?.value:undefined}));
 if(c==='messages'||c==='vectors')return messageFeatures(c==='vectors');
 if(c==='harmonics'){if(st>=2&&!s.tensor.available)return [];if(st>=2)return [{label:'u·v / 0e',value:s.tensor.scalar},...s.tensor.axial.map((x,i)=>({label:`u×v ${['x','y','z'][i]} / 1e`,value:x})),...s.tensor.symmetric.flatMap((r,i)=>r.map((x,j)=>({label:`Q${i+1}${j+1} / 2e`,value:x})))];const transformed=s.transformed.harmonics.groups.find(g=>g.l===harmonicL).values;return (s.harmonics.groups.find(g=>g.l===harmonicL)?.values||[]).map((v,i)=>({label:`Y${harmonicL},${i-harmonicL}`,value:v,compare:transformed[i]}));}
 if(c==='mace')return s.mace.features;return[];
}
function rotationMatrix(t){const a=t.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);let r=t.axis==='x'?[[1,0,0],[0,c,-s],[0,s,c]]:t.axis==='y'?[[c,0,s],[0,1,0],[-s,0,c]]:[[c,-s,0],[s,c,0],[0,0,1]];return t.reflection?r.map(row=>row.map((v,j)=>j===0?-v:v)):r;}
function mv(A,v){return A.map(row=>row.reduce((s,x,i)=>s+x*v[i],0));}
function bars(items){const start=featurePage*12,visible=items.slice(start,start+12);if(!visible.length)return '<p class="small-note">当前没有邻居或特征。</p>';const max=Math.max(1e-8,...visible.flatMap(x=>[Math.abs(x.value),Math.abs(x.compare||0)])),W=Math.max(244,($('feature-chart').clientWidth||440)-28),left=W<400?102:160,right=75,limit=W<400?10:16,axis=left+(W-left-right)/2,span=(W-left-right)/2-7,row=34,H=visible.length*row+38;
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="真实特征值条形图"><line x1="${axis}" x2="${axis}" y1="6" y2="${H-24}" stroke="#c4d8e7"/>${visible.map((f,j)=>{const i=start+j,y=j*row+10,w=Math.abs(f.value)/max*span,cw=Math.abs(f.compare||0)/max*span;return `<g class="bar-hit" data-feature="${i}" role="button" tabindex="0" aria-label="${esc(f.label)} ${num(f.value)}"><title>${esc(f.label)} = ${num(f.value,6)}</title><rect x="0" y="${y-6}" width="${W}" height="${row}" fill="${i===featureIndex?'#edf5fc':'transparent'}" rx="3"/><text x="4" y="${y+8}" font-size="14" fill="#647f94">${esc(f.label.length>limit?f.label.slice(0,limit-1)+'…':f.label)}</text>${f.compare!==undefined?`<rect x="${f.compare>=0?axis:axis-cw}" y="${y+4}" width="${cw}" height="4" rx="1" fill="#8899a7" opacity=".75"/>`:''}<rect x="${f.value>=0?axis:axis-w}" y="${y-3}" width="${w}" height="${f.compare===undefined?12:6}" rx="2" fill="${f.value>=0?'#3e87bf':'#c27c52'}"/><text x="${W-3}" y="${y+7}" text-anchor="end" font-size="14" fill="#365d7b">${num(f.value,3)}</text></g>`;}).join('')}<text x="4" y="${H-7}" font-size="13" fill="#8ca1b2">−${num(max,2)}</text><text x="${axis}" y="${H-7}" text-anchor="middle" font-size="13" fill="#8ca1b2">0</text><text x="${W-3}" y="${H-7}" text-anchor="end" font-size="13" fill="#8ca1b2">+${num(max,2)}</text></svg>`;
}
function linePlot(lines,{xLabel='r / Å',yLabel='值',height=150}={}){const width=560,pad=35,points=lines.flatMap(l=>l.points);if(!points.length)return'';const xmin=Math.min(...points.map(p=>p[0])),xmax=Math.max(xmin+1e-6,...points.map(p=>p[0])),ymin=Math.min(0,...points.map(p=>p[1])),ymax=Math.max(ymin+1e-6,...points.map(p=>p[1]));const x=v=>pad+(v-xmin)/(xmax-xmin)*(width-pad-15),y=v=>height-27-(v-ymin)/(ymax-ymin)*(height-45);return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(yLabel)} 随 ${esc(xLabel)} 变化"><path d="M${pad} 14V${height-27}H${width-15}" stroke="#ccdce8" fill="none"/>${lines.map((l,i)=>`<path d="${l.points.map((p,j)=>(j?'L':'M')+x(p[0]).toFixed(2)+' '+y(p[1]).toFixed(2)).join('')}" stroke="${l.color||['#3b86c0','#d19461','#6eaaa0','#977ca7'][i%4]}" stroke-width="2" fill="none"/>`).join('')}<text x="${pad}" y="${height-7}" font-size="14" fill="#7d95a7">${num(xmin,1)}</text><text x="${width-15}" y="${height-7}" text-anchor="end" font-size="14" fill="#7d95a7">${num(xmax,1)} ${esc(xLabel)}</text><text x="4" y="14" font-size="13" fill="#7d95a7">${esc(yLabel)}</text></svg>`;}
function renderFeatures(){const items=getFeatures();featureIndex=Math.max(0,Math.min(featureIndex,items.length-1));featurePage=Math.max(0,Math.min(featurePage,Math.ceil(items.length/12)-1));const titles={symmetry:'距离是旋转不变量',acsf:state.stage===3?'元素网络的真实隐藏激活':'ACSF 环境指纹',soap:state.stage<2?'高斯密度的展开系数 cₙₗₘ':'SOAP 功率谱与参考环境',moments:'矩与不变收缩',messages:'节点的标量通道',vectors:'标量与向量通道',harmonics:state.stage<2?'整组球谐分量一起变换':'张量积的不可约分解',mace:'低阶密度关联'};$('feature-title').textContent=titles[state.chapter];$('feature-chart').innerHTML=bars(items);$('feature-chart').querySelectorAll('[data-feature]').forEach(el=>{const select=()=>{featureIndex=+el.dataset.feature;renderFeatures();renderTerms();renderScenes();};el.onclick=select;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};});
 const f=items[featureIndex];let detail=f?`${f.label} = ${num(f.value,6)}`:'空邻域：当前没有非零贡献。';if(f?.compare!==undefined)detail+=`；对照 = ${num(f.compare,6)}；差值 = ${num(f.value-f.compare,6)}`;if(f?.vector)detail+=`；分量 ${vec(f.vector)}`;if(state.chapter==='soap')detail+=`。当前核相似度 K = ${num(snapshot.soap.kernel,6)}（连续正则化归一化，ε=1e−8；空环境相似度趋于零）。`;if(state.chapter==='harmonics'&&state.stage<2)detail+='。实条为变换前，细灰条为变换后；单分量会变，本组平方和不变。';$('feature-detail').textContent=detail;
 let extra='<div class="feature-bar-legend">实条：当前（蓝正／橙负） · 细灰条：对照；颜色不表示传播方向</div>';if(items.length>12)extra+=`<div class="feature-tabs"><button id="feature-prev" ${featurePage===0?'disabled':''}>← 上组</button><span class="small-note">${featurePage*12+1}–${Math.min(items.length,(featurePage+1)*12)} / ${items.length} 个分量</span><button id="feature-next" ${(featurePage+1)*12>=items.length?'disabled':''}>下组 →</button></div>`;
 if(['messages','vectors','mace'].includes(state.chapter))extra+=`<div class="feature-tabs"><span class="small-note">观察消息轮次</span>${Array.from({length:state.params.rounds},(_,i)=>`<button data-round="${i+1}" class="${currentRound()===i+1?'active':''}">第 ${i+1} 轮</button>`).join('')}</div>`;
 if(state.chapter==='harmonics')extra+=`<div class="feature-tabs"><span class="small-note">球谐曲面</span>${Array.from({length:state.params.lmax+1},(_,i)=>`<button data-harmonic="${i}" class="${harmonicL===i?'active':''}">l = ${i}</button>`).join('')}<label>m <select id="harmonic-m">${Array.from({length:2*harmonicL+1},(_,i)=>`<option value="${i-harmonicL}" ${harmonicM===i-harmonicL?'selected':''}>${i-harmonicL}</option>`).join('')}</select></label></div>`;
 if(state.chapter==='soap'&&state.stage<2){extra+='<div class="feature-extra">'+linePlot(Array.from({length:state.params.radial},(_,n)=>({points:snapshot.soap.radialBasis.map(p=>[p.r,p.values[n]])})),{yLabel:'径向基 gₙ'})+'</div>';}
 if(state.chapter==='acsf'&&state.stage<3){const p=state.params;extra+='<div class="feature-extra">'+linePlot([{points:Array.from({length:101},(_,i)=>{const r=i*p.cutoff/100;return[r,Math.exp(-p.eta*(r-p.rs)**2)*.5*(Math.cos(Math.PI*r/p.cutoff)+1)];})}],{yLabel:'径向窗口'})+'</div>';}
 $('feature-extra').innerHTML=extra;$('feature-prev')?.addEventListener('click',()=>{featurePage--;renderFeatures();});$('feature-next')?.addEventListener('click',()=>{featurePage++;renderFeatures();});$('feature-extra').querySelectorAll('[data-round]').forEach(b=>b.onclick=()=>{roundView=+b.dataset.round;renderSnapshot();});$('feature-extra').querySelectorAll('[data-harmonic]').forEach(b=>b.onclick=()=>{harmonicL=+b.dataset.harmonic;harmonicM=0;renderStage();renderFeatures();renderScenes();});$('harmonic-m')?.addEventListener('change',e=>{harmonicM=+e.target.value;renderScenes();});
}
const formulaHints={
 cutoff:'截断半径或平滑截断函数；高亮截断球与当前邻域。',
 bond:'相对位置、距离或单位方向；高亮参与的原子。',
 angle:'三体夹角；高亮构成夹角的中心与邻居。',
 harmonic:'球谐分量；观察选中方向与当前基函数。',
 vector:'向量特征；高亮其对应原子。',
 message:'邻居消息或节点状态；高亮所选节点和相关邻居。'
};
let formulaPointer=null,formulaFocus=null;
function clearFormulaInspection(){
 formulaPointer=formulaFocus=null;
 sceneA?.inspect(null);sceneB?.inspect(null);
 if($('formula-hint'))$('formula-hint').hidden=true;
}
function renderFormula(text,key){
 const host=$('stage-formula');
 if(host.dataset.formulaKey===key)return;
 clearFormulaInspection();
 host.dataset.formulaKey=key;
 const pattern=/(?<cutoff>[fr]꜀|[frR]_c)|(?<bond>r̂[ᵢⱼₖ]{0,2}|r[ᵢⱼₖ]{1,2})|(?<angle>(?:cos\s*)?θ[ᵢⱼₖ]*)|(?<harmonic>Yₗₘ)|(?<message>mⱼ→ᵢ|[hM][ᵢⱼₖ])|(?<vector>v[′ᵢⱼₖ]*)(?![a-z])/gu;
 const content=[];
 let end=0;
 for(const match of text.matchAll(pattern)){
  content.push(esc(text.slice(end,match.index)));
  const kind=Object.keys(match.groups).find(k=>match.groups[k]!==undefined);
  const hint=esc(formulaHints[kind]);
  content.push(`<button type="button" class="math-sym" data-inspect="${kind}" title="${hint}" aria-label="${esc(match[0])}，${hint}">${esc(match[0])}</button>`);
  end=match.index+match[0].length;
 }
 content.push(esc(text.slice(end)));host.innerHTML=content.join('');
}
function showFormulaInspection(){
 const symbol=formulaPointer||formulaFocus,hint=$('formula-hint');
 if(!symbol||!currentSnapshot()||!isLesson(route)||trainingMode){sceneA?.inspect(null);sceneB?.inspect(null);hint.hidden=true;return;}
 const kind=symbol.dataset.inspect,{neighbors,angles}=snapshot.geometry;
 const center=state.center,selected=state.selected;
 const neighborIds=neighbors.map(n=>n.index),picked=neighborIds.includes(selected);
 let indices=[center];
 if(kind==='angle'){
  const relevant=picked?angles.filter(a=>a.j===selected||a.k===selected):angles;
  indices.push(...relevant.flatMap(a=>[a.j,a.k]));
 }else if(kind==='cutoff')indices.push(...neighborIds);
 else if(kind==='vector')indices=visibleVectors().map(v=>v.index);
 else if(kind==='harmonic')indices.push(selected);
 else if(kind==='message'&&selectedEdge)indices=selectedEdge;
 else indices.push(...(picked?[selected]:neighborIds));
 const inspection={kind,indices:[...new Set(indices)]};
 sceneA?.inspect(inspection);
 if(state.chapter!=='soap'&&!(referencePinned&&['acsf','moments'].includes(state.chapter)))sceneB?.inspect(inspection);
 hint.textContent=formulaHints[kind];hint.hidden=false;
}

function values(items){$('stage-values').innerHTML=items.map(([label,value])=>`<div class="value-item"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');}
function renderStage(){const l=lesson(),st=l.stages[state.stage];$('stage-title').textContent=st.title;$('stage-text').textContent=st.text;renderFormula(st.formula,`${l.id}:${state.stage}`);$('stage-counter').textContent=`${state.stage+1} / ${l.stages.length}`;$('timeline-label').textContent=`${state.stage+1}. ${st.title}`;$('stage-tabs').querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-selected',i===state.stage);b.tabIndex=i===state.stage?0:-1;});$('timeline').value=Math.round(position*1000);$('previous').disabled=position<=0;$('next').disabled=state.stage>=l.stages.length-1;
 if(!currentSnapshot())return;const s=snapshot,p=state.params,c=state.chapter;let v=[],text='';
 if(c==='symmetry'){v=[['邻居数',String(s.geometry.neighbors.length)],['夹角数',String(s.geometry.angles.length)],['教学能量 / eV',num(s.energy.value)],['选中原子 |F| / eV·Å⁻¹',num(norm(s.energy.forces[state.selected]))]];text=state.stage<2?'点击原子或边，查看邻居距离与角度。截断球边界使用余弦衰减。':s.energy.formula;}
 if(c==='acsf'){v=[['径向维数',String(s.acsf.radial.length)],['角向维数',String(s.acsf.angular.length)],['隐藏层',String(s.acsf.readout.hidden.length)+' 个 tanh'],['中心原子 εᵢ / 教学值',num(s.acsf.readout.value)]];text=state.stage===3?'中心元素 '+state.atoms[state.center].element+' 选择对应的固定种子网络；隐藏激活：'+s.acsf.readout.hidden.map(x=>num(x,3)).join('，'):'点选条形查看邻居贡献。G₄ 按标准有序双重求和计算，表格每个无序邻居对合并两个顺序。';}
 if(c==='soap'){v=[['展开系数数',String(s.soap.coefficients.length)],['功率谱维数',String(s.soap.power.length)],['描述符范数',num(s.soap.norm)],['核相似度 K',num(s.soap.kernel,6)]];text=s.soap.convention+'；右图是当前对照环境，固定对照按钮可替换它。所有对照使用相同基参数。';}
 if(c==='moments'){v=[['M₀ / s',num(s.moments.s)],['|v|',num(norm(s.moments.v))],['Tr Q',num(s.moments.Q.reduce((a,r,i)=>a+r[i],0),6)],['线性读出',num(s.moments.readout)]];text='v = '+vec(s.moments.v)+'。Q 是 3×3 对称无迹张量；读出对下列不变量的系数线性，对坐标并不线性。';}
 if(c==='messages'||c==='vectors'){const a=c==='vectors'?s.vectors:s.messages,layer=currentLayer(c==='vectors'),n=layer.nodes[state.selected],edges=layer.edges.filter(e=>e.to===state.selected);v=[['当前原子',`${state.selected+1} / ${state.atoms[state.selected].element}`],['消息轮次',String(layer.round)],['入边消息数',String(edges.length)],['全部 T 轮后总读出',num(a.total)]];text=state.stage===0?'嵌入由固定种子与元素种类确定；相同元素共享初始特征。':'所选原子的标量通道：'+n.s.map(x=>num(x,4)).join('，')+'。点击边查看距离滤波与逐通道消息；各入边求和后更新。';if(c==='vectors')text+=' 向量第 1 通道 = '+vec(n.v[0])+'，不是物理力。';}
 if(c==='harmonics'){const group=s.harmonics.groups.find(g=>g.l===harmonicL);v=[['选中方向',vec(s.harmonics.direction)],['整组平方和',num(group?.values.reduce((a,x)=>a+x*x,0)||0,6)],['u·v',num(s.tensor.scalar)],['重建残差',s.tensor.reconstructionError.toExponential(2)]];text=state.stage>=2&&!s.tensor.available?'需要至少两个截断范围内的有效邻居；当前不显示张量积方向。':state.stage<2?'球谐采用归一化实基；空间曲面始终在固定坐标基中显示，旋转输入通过分量变化体现。':'轴向量 u×v = '+vec(s.tensor.axial)+'。反射时额外乘 det(R)；对称去迹项有 5 个独立分量。';}
 if(c==='mace'){v=[['关联阶数 ν',String(p.correlation)],['展开项数（含重复）',String(s.mace.terms.length)],['独立消息轮数 T',String(p.rounds)],['关联读出',num(s.mace.readout)]];text='本页实际计算 s、v·v、vᵀQv 的低阶关联；右侧表格逐项求和重建当前 ν 的结果。消息轮数只改变图中感受野，独立于此局域关联值。';}
 if(c==='harmonics'&&state.stage>=2&&!s.tensor.available)v=[['有效邻居',String(s.geometry.neighbors.length)],['张量积','需要两个邻居']];values(v);$('stage-detail').textContent=text;renderTerms();
}
function renderTerms(){if(!currentSnapshot())return;const s=snapshot,c=state.chapter;let heads=[],rows=[],indices=[];const items=getFeatures(),f=items[featureIndex];
 if(c==='symmetry'){if(state.stage===1){heads=['邻居 j','邻居 k','θ / °','cos θ'];rows=s.geometry.angles.map(t=>[t.j+1,t.k+1,num(t.theta,2),num(t.cos)]);indices=s.geometry.angles.map(t=>[state.center,t.j,t.k]);}else{heads=['邻居','r / Å','f꜀'];rows=s.geometry.neighbors.map(t=>[`${t.index+1} ${t.element}`,num(t.r),num(t.cutoff)]);indices=s.geometry.neighbors.map(t=>[state.center,t.index]);}}
 else if(c==='acsf'){heads=state.stage===3?['隐藏节点','激活值','读出贡献']:['参与原子','贡献'];if(state.stage===3){rows=s.acsf.readout.hidden.map((v,i)=>[i+1,num(v),num(s.acsf.readout.contributions[i])]);}else{rows=(f?.terms||[]).map(t=>[t.indices.map(x=>x+1).join(' · '),num(t.value,7)]);indices=(f?.terms||[]).map(t=>[state.center,...t.indices]);}}
 else if(c==='soap'){if(state.stage>=2&&f){heads=['m','cᴀ','cʙ','π√(8/(2l+1)) cᴀcʙ'];const pref=Math.PI*Math.sqrt(8/(2*f.l+1));for(let m=-f.l;m<=f.l;m++){const a=s.soap.coefficients.find(x=>x.species===f.speciesA&&x.n===f.n&&x.l===f.l&&x.m===m)?.value||0,b=s.soap.coefficients.find(x=>x.species===f.speciesB&&x.n===f.n2&&x.l===f.l&&x.m===m)?.value||0;rows.push([m,num(a,6),num(b,6),num(pref*a*b,7)]);}}else{heads=['元素','n','l','m','cₙₗₘ'];rows=s.soap.coefficients.map(t=>[t.species,t.n,t.l,t.m,num(t.value,6)]);}} 
 else if(c==='moments'||c==='mace'){const terms=c==='moments'?s.moments.terms:s.mace.terms;heads=['邻居索引（可重复）','贡献'];rows=terms.map(t=>[t.indices.map(x=>x+1).join(' · '),num(t.value,7)]);indices=terms.map(t=>[state.center,...t.indices]);}
 else if(c==='messages'||c==='vectors'){const layer=currentLayer(c==='vectors');let edges=layer.edges.filter(e=>e.to===state.selected);if(selectedEdge){const found=layer.edges.find(e=>e.from===selectedEdge[0]&&e.to===selectedEdge[1]);if(found)edges=[found];}heads=['消息 j→i','通道','滤波','标量消息',...(c==='vectors'?['向量消息']:[])];for(const e of edges)for(let k=0;k<pChannels();k++){rows.push([`${e.from+1}→${e.to+1}`,k+1,num(e.filter[k]),num(e.message[k]),...(c==='vectors'?[vec(e.vectorMessage[k])]:[])]);indices.push([e.from,e.to]);}}
 else if(c==='harmonics'){heads=['Q 行','x','y','z'];rows=s.tensor.symmetric.map((r,i)=>[i+1,...r.map(x=>num(x,6))]);}
 $('terms-details').querySelector('summary').textContent=c==='moments'?'展开 v·v 的真实邻居双重求和':c==='soap'&&state.stage>=2?'展开选中功率谱的 Σₘ 收缩':'展开实际逐项计算';$('term-table').innerHTML=rows.length?`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr ${indices[i]?`data-indices="${indices[i].join(',')}" tabindex="0"`:''}>${r.map(x=>`<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p class="small-note">当前阶段无逐项输入；切到消息或读出阶段查看。</p>';
 $('term-table').querySelectorAll('[data-indices]').forEach(row=>{const action=()=>{highlight=row.dataset.indices.split(',').map(Number);$('term-table').querySelectorAll('tr').forEach(r=>r.classList.remove('selected'));row.classList.add('selected');renderScenes();};row.onclick=action;row.onkeydown=e=>{if(e.key==='Enter'){action();}};});
}
function pChannels(){return state.params.channels;}
let highlight=[];
function renderChecks(){if(!currentSnapshot())return;const d=snapshot.diagnostics,c=state.chapter;let rows=[['能量 E(TX) − E(X)',d.rotation.energy],['力 F(TX) − TF(X)',d.rotation.forces]];
 if(c==='acsf')rows=[['ACSF 旋转／反射',d.rotation.acsf],['ACSF 平移',d.translation.acsf],['ACSF 编号置换',d.permutation.acsf]];
 if(c==='soap')rows=[['功率谱旋转／反射',d.rotation.soap],['功率谱平移',d.translation.soap],['功率谱编号置换',d.permutation.soap]];
 if(c==='moments'||c==='mace')rows=[['矩不变量',d.rotation.moments],['Q(TX) − TQ(X)Tᵀ',d.rotation.tensor],[c==='mace'?'关联读出不变性':'矩线性读出不变性',c==='mace'?d.rotation.maceReadout:d.rotation.momentReadout]];
 if(c==='messages')rows=[['标量消息模型总读出',d.rotation.messageScalar],['参考能量（独立构造势）',d.rotation.energy]];if(c==='vectors')rows=[['全部 T 轮标量读出',d.rotation.scalar],['最终向量 v(TX) − Tv(X)',d.rotation.vector],['反射下的最终向量',d.reflection.vector]];
 if(c==='harmonics')rows=[['整组 Y(T r̂) − D(T)Y(r̂)',d.rotation.harmonics],['张量积的对称去迹项',d.rotation.tensorProduct],['反射下的轴向量',d.reflection.axial],['张量积分解重建',snapshot.tensor.reconstructionError]];
 $('diagnostics').innerHTML=rows.map(([label,value])=>`<div class="diagnostic-row"><span>${esc(label)}</span><code>${value.toExponential(2)}</code></div>`).join('');const worst=Math.max(...rows.map(r=>r[1]));$('check-status').textContent=worst<1e-9?'数值一致':'检查残差';$('check-status').classList.toggle('warn',worst>=1e-9);$('check-note').textContent='相对残差 = 差值范数 / max(1, 两侧范数)。实际双精度计算；显示小残差不代表模型拟合准确。';
}
function hopHighlight(){const set=new Set([state.selected]);for(let k=0;k<currentRound();k++){const old=new Set(set);for(const e of snapshot.geometry.edges)if(old.has(e.to))set.add(e.from);}return [...set];}
function renderModelWeights(){
 if(!currentSnapshot())return;let model=state.chapter==='acsf'?snapshot.acsf.readout.model:['messages','vectors'].includes(state.chapter)?snapshot[state.chapter].model:null;
 let el=document.getElementById('actual-model-weights');if(!el){el=document.createElement('details');el.id='actual-model-weights';el.className='actual-weights';document.querySelector('.weight-editor').append(el);}el.hidden=!model;if(model)el.innerHTML='<summary>查看当前实际矩阵与固定种子基系数</summary><p>展开数值由当前模型返回。上方可调系数参与缩放、混合或读出；固定基矩阵不在此编辑。</p><pre>'+esc(JSON.stringify(model,null,2))+'</pre>';
}
function visibleVectors(transformed=false){
 const c=state.chapter,s=snapshot,t=s.transformed;
 if(c==='symmetry'&&state.stage>=2)return (transformed?t.forces:s.energy.forces).map((vector,index)=>({index,vector,color:transformed?'#b87b50':'#648e9a',label:'F / eV·Å⁻¹'}));
 if(c==='vectors'){
  const layers=transformed?t.vectorLayers:s.vectors.layers,round=state.stage===0?0:currentRound(),layer=layers[round];
  if(state.stage===1){const incoming=layer.edges.filter(e=>e.to===state.selected),edge=selectedEdge?layer.edges.find(e=>e.from===selectedEdge[0]&&e.to===selectedEdge[1]):incoming[0];return edge?[{index:edge.to,vector:edge.vectorMessage[0],color:transformed?'#b87b50':'#27897c',label:'边消息 mᵥ,₁'}]:[];}
  const out=layer.nodes.map(n=>({index:n.index,vector:n.v[0],color:transformed?'#b87b50':'#27897c',label:'v₁ / 潜在特征'}));
  if(transformed&&state.stage>=3)out.push({index:state.selected,vector:mv(rotationMatrix(state.transform),s.vectors.layers[round].nodes[state.selected].v[0]),color:'#27897c',label:'参考 T v₁'});return out;
 }
 if(c==='moments'||c==='mace')return [{index:state.center,vector:transformed?mv(rotationMatrix(state.transform),s.moments.v):s.moments.v,color:transformed?'#b87b50':'#27897c',label:'v / 密度矩'}];
 if(c==='harmonics'&&state.stage>=2){if(!s.tensor.available)return [];const tp=transformed?t.tensor:s.tensor;return [{index:state.center,vector:tp.u,color:'#4385be',label:'u / 1o'},{index:state.center,vector:tp.v,color:'#b47c58',label:'v / 1o'},{index:state.center,vector:tp.axial,color:'#27897c',label:'u×v / 1e'}];}return [];
}
function renderScenes(){
 if(!sceneA||!currentSnapshot()||!isLesson(route)||trainingMode)return;
 const c=state.chapter,refView=c==='soap'||referencePinned&&['acsf','moments'].includes(c),force=c==='symmetry'&&state.stage>=2,vectors=visibleVectors(),actual=visibleVectors(true);
 const maxVector=Math.max(0,...vectors.concat(actual).map(v=>norm(v.vector))),vectorScale=maxVector>1e-12?Math.min(5000,1.1/maxVector):1;
 const harmonic=c==='harmonics'&&state.stage<2?{l:harmonicL,m:harmonicM}:null,density=c==='soap'&&state.stage===0?{sigma:state.params.sigma}:null;
 const selectedFeature=getFeatures()[featureIndex],featureHighlight=selectedFeature?.indices||selectedFeature?.terms?.flatMap(t=>t.indices)||[],hl=['messages','vectors','mace'].includes(c)?hopHighlight():highlight.length?highlight:featureHighlight;
 sceneA.update({atoms:state.atoms,center:state.center,selected:state.selected,cutoff:state.params.cutoff,vectors,vectorScale,highlight:hl,harmonic,density});
 if(refView){sceneB.update({atoms:state.referenceAtoms,center:state.referenceCenter,selected:Math.min(state.selected,state.referenceAtoms.length-1),cutoff:state.params.cutoff,vectors:[],highlight:[],harmonic:null,density});$('scene-b-label').textContent='固定对照环境';$('scene-b-meta').textContent=c==='soap'?'K = '+num(snapshot.soap.kernel,3):'已固定';}
 else{sceneB.update({atoms:snapshot.transformed.atoms,center:state.center,selected:state.selected,cutoff:state.params.cutoff,vectors:actual,vectorScale,highlight:hl,harmonic,density});$('scene-b-label').textContent=state.transform.reflection?'反射＋旋转后 TX':'旋转后的输入 TX';$('scene-b-meta').textContent=state.transform.angle+'°';}
 $('scene-a-meta').textContent='i = '+(state.center+1);$('vector-kind').textContent=vectors.length?(force?'教学力 / eV·Å⁻¹':'潜在向量／密度矩')+' · 显示 ×'+num(vectorScale,1):'本阶段无向量';
 $('scene-pair').classList.toggle('single',!$('compare').checked);$('scene-b-cell').hidden=!$('compare').checked;sceneB.setVisible($('compare').checked);layoutComparison();sceneA.setPhase(state.stage,position-state.stage);sceneB.setPhase(state.stage,position-state.stage);
}
function layoutComparison(){if(!$('scene-pair'))return;const compact=$('compare').checked&&$('scene-pair').getBoundingClientRect().width<720;$('scene-pair').classList.toggle('compare-tabs',compact);$('compare-tabs').hidden=!compact;}
function setPosition(p){stop();position=Math.max(0,Math.min(lesson().stages.length-.001,p));updateStagePosition();}
function updateStagePosition(){const next=Math.floor(position),changed=next!==state.stage;state.stage=next;renderStage();if(snapshot){if(changed){featureIndex=0;featurePage=0;highlight=[];renderFeatures();renderScenes();}sceneA?.setPhase(state.stage,position-state.stage);sceneB?.setPhase(state.stage,position-state.stage);}}
function stop(){playing=false;cancelAnimationFrame(frame);$('play').textContent='播放过程';}
function animate(t){if(!playing)return;const delta=lastTime?Math.min(.1,(t-lastTime)/1000):0;lastTime=t;position+=delta*speed/(reduced?3:2.4);if(position>=lesson().stages.length-.001){position=lesson().stages.length-.001;updateStagePosition();stop();return;}const previousStage=state.stage;state.stage=Math.floor(position);if(previousStage!==state.stage){featureIndex=0;featurePage=0;highlight=[];renderStage();renderFeatures();renderScenes();}else{$('timeline').value=Math.round(position*1000);if(!reduced){sceneA?.setPhase(state.stage,position-state.stage);sceneB?.setPhase(state.stage,position-state.stage);}}frame=requestAnimationFrame(animate);}
function play(){if(playing){stop();return;}if(position>=lesson().stages.length-.01)position=0;playing=true;lastTime=0;$('play').textContent='暂停';frame=requestAnimationFrame(animate);}

function guide(){stop();snapshot=null;state.version++;const c=state.chapter;highlight=[];selectedEdge=null;
 if(c==='symmetry'){state.atoms=clone(M.presets.water);state.center=0;state.selected=1;state.transform={axis:'z',angle:60,reflection:false};$('preset').value='water';setPosition(3);}
 if(c==='acsf'){pinReference(false);const atoms=clone(state.atoms),i=state.selected===state.center?(state.center+1)%atoms.length:state.selected,center=atoms[state.center].pos,v=atoms[i].pos.map((x,k)=>x-center[k]),a=.45;atoms[i].pos=[Math.cos(a)*v[0]-Math.sin(a)*v[1],Math.sin(a)*v[0]+Math.cos(a)*v[1],v[2]].map((x,k)=>x+center[k]);if(!updateState({atoms},{editor:true}))return;setPosition(2);toast('已保持中心距离，改变所选邻居方向。对照 G₂ 与 G₄。');}
 if(c==='soap'){state.referenceAtoms=clone(state.atoms);state.referenceCenter=state.center;state.atoms=M.transformAtoms(state.atoms,{axis:'y',angle:63,reflection:false});setPosition(3);toast('对照为旋转前环境，核相似度应接近 1。');}
 if(c==='moments'){setPosition(2);toast('点击逐项贡献，观察 v·v 中的邻居组合。');$('terms-details').open=true;}
 if(c==='messages'){state.atoms=clone(M.presets.chain);state.center=0;state.selected=0;state.params.cutoff=1.45;state.params.rounds=3;roundView=1;$('preset').value='chain';setPosition(2);toast('原子链仅相邻节点连通：切换 1、2、3 轮观察感受野。');}
 if(c==='vectors'){state.transform={axis:'y',angle:73,reflection:false};setPosition(3);toast('右图叠加实际重算与旋转参考，两支箭头应重合。');}
 if(c==='harmonics'){state.params.lmax=2;harmonicL=2;harmonicM=0;state.transform={axis:'z',angle:60,reflection:false};setPosition(1);toast('查看 5 个分量的变化，再切换反射检查轴向量。');}
 if(c==='mace'){state.params.correlation=3;setPosition(2);$('terms-details').open=true;toast('已展开三次关联；相同索引允许重复。');}
 renderParameters();renderAtomEditor();requestCompute(true);
}
function pinReference(notify=true){state.referenceAtoms=clone(state.atoms);state.referenceCenter=state.center;referencePinned=true;requestCompute();if(notify)toast('已固定当前构型为对照；后续参数会同时用于两边计算。');}

function initTheme(){let theme='light';try{if(localStorage.getItem('mlip-theme')==='dark')theme='dark';}catch{}setTheme(theme,false);}
function setTheme(theme,save=true){document.documentElement?.setAttribute('data-theme',theme);if(save){try{localStorage.setItem('mlip-theme',theme);}catch{}}const btn=$('toggle-theme');if(btn){btn.textContent=theme==='dark'?'☀️':'🌙';btn.title=theme==='dark'?'切换至浅色模式':'切换至深色模式';btn.setAttribute('aria-label',btn.title);btn.setAttribute('aria-pressed',String(theme==='dark'));}}
function toggleTheme(){const current=document.documentElement?.getAttribute('data-theme')==='dark'?'dark':'light';setTheme(current==='dark'?'light':'dark',true);}


// Sharing reuses engine validators, and loads configuration as a draft.
let pendingShare=null,sharedExport=null,lastIncoming='',h2Ready=false,bridgeCounter=0;
const bridgeRequests=new Map(),h2ReadyWaiters=[];
function ensureH2(){if(!h2Loaded){$('h2-frame').srcdoc=assets.h2.replace('<body>','<body class="embedded">');h2Loaded=true;}}
function shareValidators(){return{methods:M.validate,training:globalThis.MLIPTrainingData.validate,h2:globalThis.H2Config.validate};}
function pauseExperiments(){stop();trainingLab?.pause();if(h2Loaded)$('h2-frame').contentWindow?.postMessage({type:'mlip-pause'},'*');}
function principleConfig(){return{schema:'mlip-methods-config',version:1,chapter:state.chapter,atoms:clone(state.atoms),center:state.center,selected:state.selected,params:clone(state.params),transform:clone(state.transform),referenceAtoms:clone(state.referenceAtoms),referenceCenter:state.referenceCenter};}
async function h2Bridge(type,payload){
 ensureH2();
 if(!h2Ready)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{const i=h2ReadyWaiters.findIndex(w=>w.resolve===resolve);if(i>=0)h2ReadyWaiters.splice(i,1);reject(Error('H₂ 页面尚未就绪，请稍后重试。'));},10000);h2ReadyWaiters.push({resolve,reject,timer});});
 return new Promise((resolve,reject)=>{const requestId='share-'+(++bridgeCounter),timer=setTimeout(()=>{bridgeRequests.delete(requestId);reject(Error('H₂ 设置请求超时，请重试。'));},10000);bridgeRequests.set(requestId,{resolve,reject,timer});$('h2-frame').contentWindow.postMessage({channel:'mlip-h2-bridge',type,requestId,payload},'*');});
}
function showShareError(error){$('share-error').hidden=false;$('share-error').textContent=error.message||String(error);}
function shareSummary(p){const name=p.chapter==='h2'?'H₂':lessons.find(l=>l.id===p.chapter)?.short||p.chapter;const c=p.config.config||p.config.cfg;return name+' · '+(p.mode==='principle'?'原理构型，应用后重新计算。':p.chapter==='h2'?(c.trainingTarget==='energy-force'?'能量＋力':'仅能量')+' · '+c.n+' 个样本 · 种子 '+c.seed+'。载入后请点击“应用并重新初始化”。':'真实训练 · 案例 '+c.case+' · '+c.n+' 个构型 · 种子 '+c.seed+'。载入后请点击“应用并重新初始化”。');}
function stageShared(value){const clean=globalThis.MLIPShare.validate(value,shareValidators());pauseExperiments();pendingShare=Object.freeze(clean);$('share-error').hidden=true;$('share-pending').hidden=false;$('share-summary').textContent=shareSummary(clean);$('load-shared').textContent=clean.mode==='principle'?'应用原理构型':'载入待应用设置';return clean;}
function receiveShared(encoded){if(encoded===lastIncoming&&pendingShare)return;try{const value=globalThis.MLIPShare.decode(encoded);stageShared(value);lastIncoming=encoded;}catch(error){showShareError(error);}}
async function loadShared(){
 if(!pendingShare)return;const value=pendingShare;const clean=globalThis.MLIPShare.validate(value,shareValidators());$('load-shared').disabled=true;
 try{
  pauseExperiments();
  if(clean.mode==='principle'){
   state=M.validate({...state,...clean.config,stage:0,version:state.version});snapshot=null;position=0;referencePinned=true;
  }
  history.replaceState(null,'','#/'+clean.chapter+(clean.mode==='train'?'?mode=train':''));navigate();
  if(clean.chapter==='h2')await h2Bridge('stage-config',clean.config);
  else if(clean.mode==='train')trainingLab.stageImportedConfig(clean.config);
  else{renderLesson();renderAtomEditor();requestCompute(true);}
  pendingShare=null;lastIncoming='';$('share-pending').hidden=true;toast(clean.mode==='principle'?'原理设置已应用。':'设置已载入，等待应用并重新初始化。');
 }catch(error){showShareError(error);}finally{$('load-shared').disabled=false;}
}
async function openShare(){
 $('share-result').textContent='正在读取已应用的实验设置…';$('share-url').value='';$('copy-share').disabled=true;$('download-share').disabled=true;sharedExport=null;$('share-dialog').showModal();
 try{
  const config=route==='h2'?await h2Bridge('get-config'):trainingMode?trainingLab.getAppliedConfig():principleConfig();
  sharedExport=globalThis.MLIPShare.validate({schema:'mlip-experiment',version:1,chapter:route,mode:route==='h2'||trainingMode?'train':'principle',config},shareValidators());
  $('download-share').disabled=false;
  try{const hash=globalThis.MLIPShare.hash(sharedExport),base=location.protocol==='file:'?'https://hang-999.github.io/h2-potential-lab/':location.href.split('#')[0];$('share-url').value=base+hash;$('copy-share').disabled=false;$('share-result').textContent=location.protocol==='file:'?'链接打开在线网站；离线分发请导出实验 JSON。':'链接包含已应用设置。待应用编辑不包含在内。';}catch(error){$('share-result').textContent=error.message;}
 }catch(error){$('share-result').textContent=error.message;}
}
function bindSharing(){
 $('share-experiment').onclick=openShare;$('close-share').onclick=()=>$('share-dialog').close();$('share-dialog').onclick=e=>{if(e.target===$('share-dialog'))$('share-dialog').close();};
 $('copy-share').onclick=async()=>{try{await navigator.clipboard.writeText($('share-url').value);$('share-result').textContent='已复制实验链接。';}catch{$('share-url').focus();$('share-url').select();$('share-result').textContent='请使用 Ctrl+C（或长按）复制选中的链接。';}};
 $('download-share').onclick=()=>{if(sharedExport)download('mlip-experiment-v1.json',JSON.stringify(sharedExport,null,2));};
 $('share-file').onchange=async e=>{try{const file=e.target.files?.[0];if(!file)return;if(file.size>131072)throw Error('实验 JSON 应小于 128 KB。');stageShared(JSON.parse(await file.text()));$('share-dialog').close();}catch(error){$('share-result').textContent=error.message;}finally{e.target.value='';}};
 $('load-shared').onclick=loadShared;$('discard-shared').onclick=()=>{pendingShare=null;lastIncoming='';$('share-pending').hidden=true;history.replaceState(null,'','#/'+route+(trainingMode?'?mode=train':''));};
 window.addEventListener('message',e=>{if(e.source!==$('h2-frame').contentWindow||e.data?.channel!=='mlip-h2-bridge')return;const m=e.data;if(m.type==='ready'){h2Ready=true;for(const w of h2ReadyWaiters.splice(0)){clearTimeout(w.timer);w.resolve();}return;}const pending=bridgeRequests.get(m.requestId);if(!pending)return;bridgeRequests.delete(m.requestId);clearTimeout(pending.timer);if(m.type==='error')pending.reject(Error(m.message||'H₂ 配置无效。'));else if(['config','staged','validated'].includes(m.type))pending.resolve(m.payload);else pending.reject(Error('H₂ 返回了未知设置响应。'));});
}

function restoreSourcesFocus(){
 const menu=$('more-nav');
 const target=!matchMedia('(min-width:1200px)').matches&&!menu.open?menu.querySelector('summary'):$('open-sources');
 target.focus();
}
function bind(){bindSharing();const navWidth=matchMedia('(min-width:1200px)'),syncNav=()=>{$('more-nav').open=navWidth.matches;$('more-nav').querySelector('summary').hidden=navWidth.matches;};navWidth.addEventListener('change',syncNav);syncNav();const featureHost=document.querySelector('.feature-card');document.querySelector('.calculation-column').insertBefore(featureHost,document.querySelector('.check-card'));
 const themeBtn=$('toggle-theme');if(themeBtn)themeBtn.onclick=toggleTheme;initTheme();
 const formulaEl=$('stage-formula');
 const hint=document.createElement('p');hint.id='formula-hint';hint.className='formula-hint';hint.hidden=true;formulaEl.after(hint);
 const symbol=el=>el?.closest?.('.math-sym')||null;
 formulaEl.onpointerover=e=>{formulaPointer=symbol(e.target);showFormulaInspection();};
 formulaEl.onpointerout=e=>{formulaPointer=formulaEl.contains(e.relatedTarget)?symbol(e.relatedTarget):null;showFormulaInspection();};
 formulaEl.addEventListener('focusin',e=>{formulaFocus=symbol(e.target);showFormulaInspection();});
 formulaEl.addEventListener('focusout',e=>{formulaFocus=formulaEl.contains(e.relatedTarget)?symbol(e.relatedTarget):null;showFormulaInspection();});
 formulaEl.onkeydown=e=>{if(e.key==='Escape')clearFormulaInspection();};
 document.querySelector('.explanation-card>.card-heading').prepend(document.querySelector('.playback-buttons'));
 $('toggle-nav').onclick=()=>document.body.classList.toggle('nav-expanded');$('mode-principle').onclick=()=>location.hash='#/'+state.chapter;$('mode-training').onclick=()=>location.hash='#/'+state.chapter+'?mode=train';$('compare-a').onclick=()=>{$('scene-pair').classList.remove('show-reference');$('compare-a').setAttribute('aria-pressed','true');$('compare-b').setAttribute('aria-pressed','false');};$('compare-b').onclick=()=>{$('scene-pair').classList.add('show-reference');$('compare-a').setAttribute('aria-pressed','false');$('compare-b').setAttribute('aria-pressed','true');};if(typeof ResizeObserver!=='undefined'){new ResizeObserver(layoutComparison).observe($('scene-pair'));let chartWidth=0;new ResizeObserver(([entry])=>{const w=Math.round(entry.contentRect.width);if(w&&w!==chartWidth){chartWidth=w;if(snapshot&&isLesson(route)&&!trainingMode)renderFeatures();}}).observe($('feature-chart'));}
 window.addEventListener('hashchange',navigate);$('classroom').onclick=()=>{const on=document.body.classList.toggle('classroom');$('classroom').setAttribute('aria-pressed',on);requestAnimationFrame(()=>renderScenes());};$('open-sources').onclick=()=>$('source-dialog').showModal();$('close-sources').onclick=()=>$('source-dialog').close();$('source-dialog').addEventListener('click',e=>{if(e.target===$('source-dialog'))$('source-dialog').close();});$('source-dialog').addEventListener('close',restoreSourcesFocus);$('more-nav').addEventListener('keydown',e=>{if(e.key==='Escape'){$('more-nav').open=matchMedia('(min-width:1200px)').matches;$('more-nav').querySelector('summary').focus();}});document.addEventListener('click',e=>{if(!$('more-nav').contains(e.target))$('more-nav').open=matchMedia('(min-width:1200px)').matches;});
 $('show-settings').onclick=()=>{const hidden=!$('settings').hidden;$('settings').hidden=hidden;$('show-settings').setAttribute('aria-expanded',!hidden);};$('reset-params').onclick=()=>{stop();updateState({params:clone(M.defaults)});renderParameters();};
 $('preset').onchange=e=>{stop();const atoms=clone(M.presets[e.target.value]);selectedEdge=null;highlight=[];updateState({atoms,center:0,selected:1},{immediate:true,editor:true});highlight=[];sceneA?.resetCamera();sceneB?.resetCamera();};$('reset-geometry').onclick=()=>$('preset').dispatchEvent(new Event('change'));$('pin-reference').onclick=()=>pinReference();$('compare').onchange=renderScenes;
 $('rotation-angle').oninput=e=>{stop();updateState({transform:{...state.transform,angle:+e.target.value}});$('rotation-output').textContent=e.target.value+'°';};$('rotation-axis').onchange=e=>updateState({transform:{...state.transform,axis:e.target.value}});$('reflection').onchange=e=>updateState({transform:{...state.transform,reflection:e.target.checked}});
 $('translate').onclick=()=>{const atoms=clone(state.atoms).map(a=>({...a,pos:a.pos.map((x,k)=>x+[.35,-.2,.15][k])}));updateState({atoms},{editor:true});toast('整体平移 [+0.35, −0.20, +0.15] Å；相对几何不变。');};
 $('permute').onclick=()=>{const atoms=clone(state.atoms);let pair=null;for(let i=0;i<atoms.length&&!pair;i++)for(let j=i+1;j<atoms.length;j++)if(atoms[i].element===atoms[j].element){pair=[i,j];break;}if(!pair){toast('当前每种元素仅一个原子，没有同元素可交换。');return;}selectedEdge=null;highlight=[];const[i,j]=pair;[atoms[i],atoms[j]]=[atoms[j],atoms[i]];const remap=x=>x===i?j:x===j?i:x;updateState({atoms,center:remap(state.center),selected:remap(state.selected)},{editor:true});toast(`交换原子 ${i+1} 与 ${j+1} 的编号，保持物理构型。`);};
 $('add-atom').onclick=()=>{if(state.atoms.length>=8)return;const atoms=clone(state.atoms),max=Math.max(...atoms.map(a=>a.id)),t=atoms.length*2.399;atoms.push({id:max+1,element:'H',pos:[1.7*Math.cos(t),1.7*Math.sin(t),.5]});updateState({atoms,selected:atoms.length-1},{editor:true});};$('remove-atom').onclick=()=>{if(state.atoms.length<=3)return;const i=state.selected,atoms=state.atoms.filter((_,j)=>j!==i);updateState({atoms,selected:Math.min(i,atoms.length-1),center:state.center===i?0:state.center>i?state.center-1:state.center},{editor:true});};$('set-center').onclick=()=>updateState({center:state.selected},{editor:true});
 $('previous').onclick=()=>setPosition(Math.max(0,state.stage-1));$('next').onclick=()=>setPosition(state.stage+1);$('play').onclick=play;$('replay').onclick=()=>{setPosition(0);play();};$('timeline').oninput=e=>setPosition(+e.target.value/1000);$('animation-speed').onchange=e=>speed=+e.target.value;$('reduced-motion').checked=reduced;$('reduced-motion').onchange=e=>{reduced=e.target.checked;stop();sceneA?.setPhase(state.stage,0);sceneB?.setPhase(state.stage,0);};$('guided-action').onclick=guide;
 $('stage-tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();setPosition(e.key==='Home'?0:e.key==='End'?lesson().stages.length-1:state.stage+(e.key==='ArrowRight'?1:-1));$('stage-tabs').querySelector(`[data-stage="${state.stage}"]`).focus();};
 $('export-config').onclick=()=>download('mlip-methods-config.json',JSON.stringify({schema:'mlip-methods-config',version:1,chapter:state.chapter,atoms:state.atoms,center:state.center,selected:state.selected,params:state.params,transform:state.transform,referenceAtoms:state.referenceAtoms,referenceCenter:state.referenceCenter},null,2));$('import-config').onclick=()=>$('config-file').click();$('config-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const parsed=JSON.parse(await f.text());if(parsed.schema==='h2-lab-config')throw new Error('这是 H₂ 配置，请进入 H₂ 训练实验室使用其导入按钮。');if(parsed.schema!=='mlip-methods-config'||parsed.version!==1)throw new Error('不支持的设置格式或版本。');const clean=M.validate({...state,chapter:parsed.chapter,atoms:parsed.atoms,center:parsed.center,selected:parsed.selected,params:parsed.params,transform:parsed.transform,referenceAtoms:parsed.referenceAtoms,referenceCenter:parsed.referenceCenter,stage:0});if(!isLesson(clean.chapter))throw new Error('未知章节。');stop();clearError();snapshot=null;state=clean;position=0;referencePinned=true;location.hash='#/'+state.chapter;renderLesson();requestCompute(true);toast('设置已导入并重新计算；不包含训练权重或进度。');}catch(error){showError(error);}e.target.value='';};
 window.addEventListener('pagehide',()=>{worker.terminate();URL.revokeObjectURL(workerURL);sceneA?.dispose();sceneB?.dispose();});
}
window.addEventListener('message',e=>{const f=$('h2-frame');if(e.source===f.contentWindow&&e.data?.type==='mlip-h2-size'&&Number.isFinite(e.data.height))f.style.height=Math.max(400,Math.min(20000,e.data.height))+'px';});
makeMap();bind();navigate();requestCompute(true);
// Read-only diagnostics for reproducible QA, not an alternate application API.
Object.defineProperty(window,'__mlipDebug',{value:{state:()=>clone(state),snapshot:()=>clone(snapshot),training:()=>trainingLab?.debug(),status:()=>({route,trainingMode,playing,position,version:state.version,snapshotVersion:snapshot?.version,webgl:sceneA?.isWebGL})}});
