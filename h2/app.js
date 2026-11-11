(()=>{'use strict';
 const $=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
 if(document.body.classList.contains('embedded'))new ResizeObserver(()=>parent.postMessage({type:'mlip-h2-size',height:Math.ceil(document.body.getBoundingClientRect().height)},'*')).observe(document.body);
 let worker=null,version=0,state=null,pending=null,scheduled=false,dirty=false,lastError='',quantity='energy',residual=false,probeTimer=null,nextProbe=null,view='overview',inspector='summary',comparison=null,guideDismissed=false,gridKey='';
 const workerURL=URL.createObjectURL(new Blob([$('worker-source').textContent],{type:'text/javascript'}));
 const post=(type,extra={})=>worker?.postMessage({type,version,...extra});
 const panel=createNetworkPanel(post);
 const settings=createSettings(value=>{if(value&&!dirty)post('invalidateLesson');dirty=value;updateButtons();},config=>reset(config));
 const unit=()=>quantity==='force'?'eV/Å':'eV';
 const reference=p=>quantity==='force'?p.force:p.energy;
 const prediction=p=>quantity==='force'?p.predictedForce:p.prediction;
 const stateLabel=()=>lastError?'错误':dirty?'设置待应用':!state?'初始化中':state.lesson?'讲解中':state.finished?'完成':state.running?'训练中':state.step?'暂停':'待训练';

 function reset(config=settings.current()){
  version++;worker?.terminate();panel.reset();state=null;pending=null;lastError='';gridKey='';
  $('status').textContent='初始化中 · 本地训练引擎';updateButtons();
  worker=new Worker(workerURL);
  worker.onerror=e=>{lastError='本地计算线程无法运行：'+e.message;updateButtons();};
  worker.onmessage=({data:m})=>{
   if(m.version!==version)return;
   if(m.type==='error'){lastError=m.message;updateButtons();return;}
   if(m.type==='csv'){
    const step=m.step??state?.step??0;
    h2Download(`h2-potential-fit-step-${step}.csv`,'\uFEFFr_A,reference_eV,split,prediction_eV,residual_eV,reference_force_eV_per_A,prediction_force_eV_per_A,residual_force_eV_per_A,model_step\r\n'+m.rows.map(p=>[p.r,p.energy,p.split,p.prediction,p.prediction-p.energy,p.force,p.predictedForce,p.predictedForce-p.force,step].join(',')).join('\r\n'),'text/csv;charset=utf-8');return;
   }
   if(m.type==='gradientCheck'){panel.gradient(m.result);return;}
   pending=m;if(!scheduled){scheduled=true;requestAnimationFrame(paint);}
  };
  post('init',{config,speed:+$('speed').value,probe:+$('probe').value});
 }
 function updateButtons(){
  const ready=!!state;
  $('play').disabled=!ready||dirty||!!state?.lesson||state?.finished||!!lastError;
  $('step').disabled=!ready||dirty||!!state?.lesson||state?.running||state?.finished||!!lastError;
  $('csv').disabled=$('save-comparison').disabled=!ready;
  $('net-lesson').disabled=!ready||dirty||state?.finished&&!state?.lesson;
  $('gradient-check').disabled=!ready||dirty||!!state?.lesson;
  $('play').textContent=dirty?'待应用设置':state?.lesson?'讲解进行中':state?.finished?'训练已完成':state?.running?'暂停训练':state?.step?'继续训练':'开始训练';
  $('config-state').textContent=dirty?'参数尚未应用':'';
  const used=state?.network.update?.learningRate;
  $('status').textContent=`${stateLabel()}${lastError?' · '+lastError:state?' · 模型 Step '+state.step+' · '+(used?'最近实际 η '+used.toPrecision(3):'初始 η '+state.cfg.lr):''}`;
  $('first-guide').hidden=guideDismissed||!ready||!!state.step;
 }
 function paint(){scheduled=false;if(!pending)return;state=pending;pending=null;metrics();probe();drawVisible();updateButtons();}
 function drawVisible(){if(!state)return;if(view==='overview'){energy();history();}else if(view==='computation'){panel.render(state);setInspector(inspector);}else grid();}
 function setInspector(name){inspector=name;for(const b of document.querySelectorAll('[data-inspector]')){const active=b.dataset.inspector===name;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;const host=$(b.getAttribute('aria-controls'));host.hidden=!active;host.setAttribute('role','tabpanel');host.setAttribute('aria-labelledby',b.id);}}
 function switchView(name,focus=false){if(!['overview','computation','data'].includes(name))return;const changed=view!==name;view=name;document.querySelector('.lab-layout').dataset.view=name;for(const b of document.querySelectorAll('[data-view][role=tab]')){const active=b.dataset.view===name;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;$(b.getAttribute('aria-controls')).hidden=!active;}if(focus)$('tab-'+name).focus();requestAnimationFrame(()=>{drawVisible();updateButtons();if(changed)document.querySelector('.lab-layout').scrollIntoView({block:'start'});});}
 function openSettings(){switchView('overview');$('settings-drawer').open=true;requestAnimationFrame(()=>$('settings-drawer').scrollIntoView({block:'nearest'}));}
 document.querySelectorAll('[data-view][role=tab]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
 document.querySelectorAll('[data-inspector]').forEach(b=>b.onclick=()=>setInspector(b.dataset.inspector));
 for(const group of document.querySelectorAll('[role=tablist]'))group.addEventListener('keydown',e=>{const tabs=[...group.querySelectorAll('[role=tab]')],i=tabs.indexOf(document.activeElement);if(i<0||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].click();tabs[n].focus();});
 $('settings-toggle').onclick=openSettings;window.addEventListener('h2-open-settings',openSettings);
 const compact=matchMedia('(max-width:1000px)');$('settings-drawer').open=!compact.matches;compact.addEventListener('change',e=>{$('settings-drawer').open=!e.matches;});$('lr').setAttribute('list','rates');
 $('dismiss-guide').onclick=()=>{guideDismissed=true;$('first-guide').hidden=true;};

 function metrics(){
  const s=state,c=s.cfg,total=s.stepsPerEpoch*c.epochs;
  $('steps').textContent=s.step.toLocaleString();$('step-total').textContent=`${s.stepsPerEpoch} 步/轮 · 共 ${total.toLocaleString()} 步 · ${s.parameterCount.toLocaleString()} 参数`;
  $('epoch').textContent=`${s.completedEpochs} / ${c.epochs}`;$('epoch-current').textContent=s.finished?'训练轮次全部完成':s.cursor>=s.order.length?'本轮完成，下一步重新打乱':`第 ${s.currentEpoch} 轮 · 已处理 ${s.cursor}/${s.order.length} 样本`;
  $('train-rmse').textContent=h2fmt(s.latest.train.rmse)+' eV';$('train-mse').textContent='力 RMSE '+h2fmt(s.latest.train.forceRmse)+' eV/Å';
  $('val-rmse').textContent=h2fmt(s.latest.validation.rmse)+' eV';$('val-mse').textContent='力 RMSE '+h2fmt(s.latest.validation.forceRmse)+' eV/Å';
  const init={auto:'自动匹配',xavier:'Xavier 均匀',he:'He 均匀',zero:'全零'}[c.initialization];
  $('prediction-label').textContent=s.step?'当前模型 · Step '+s.step:'初始化模型 · '+init;
  $('model-note').innerHTML=`<b>已应用：${s.sizes.join(' → ')}</b><span>${c.activations.join(' / ')||'无隐藏层：线性基线'} · ${c.optimizer.toUpperCase()}</span><span>${c.trainingTarget==='energy-force'?'能量＋力 · λF='+c.forceWeight:'仅能量 · λF=0'}</span><span>种子 ${c.seed} · ${s.order.length} 训练 / ${s.data.length-s.order.length} 验证</span><span>本地 CPU · 仅训练集参与标准化</span>`;
  $('force-metrics').innerHTML=['train','validation'].map((key,i)=>{const m=s.latest[key];return `<section><h3>${i?'验证集':'训练集'}</h3><p>能量 RMSE <strong>${h2fmt(m.rmse)} eV</strong></p><p>力 RMSE <strong>${h2fmt(m.forceRmse)} eV/Å</strong></p><small>能量 MSE ${h2fmt(m.mse,6)} eV²<br>力 MSE ${h2fmt(m.forceMse,6)} (eV/Å)²</small></section>`;}).join('');
  renderComparisonNote();
 }
 const bounds=()=>$('range').value==='well'?[.45,1.25]:$('range').value==='tail'?[1.2,3]:[.3,3];
 function energy(){
  if(!state||view!=='overview')return;
  const curve=state.curve,refs=curve.map(reference).filter(Number.isFinite),lo=Math.min(...refs),hi=Math.max(...refs),pad=Math.max(.05,(hi-lo)*.12);
  const locked=$('plot-scale').value==='locked',domain=locked?(residual?(quantity==='force'?[-5,5]:[-1,1]):[lo-pad,hi+pad]):null;
  const series=[...(residual?[]:[{data:curve.map(p=>({r:p.r,v:reference(p)})),color:H2UI.ink,reference:true}])];
  if(comparison)series.push({data:comparison.curve.map(p=>({r:p.r,v:prediction(p)-(residual?reference(p):0)})),color:'#8056aa',dash:'7 4'});
  series.push({data:curve.map(p=>({r:p.r,v:prediction(p)-(residual?reference(p):0)})),color:H2UI.blue});
  const result=h2Plot($('energy-chart'),{height:$('energy-chart').clientHeight||360,bounds:bounds(),domain,coverage:[state.cfg.rMin,state.cfg.rMax],yLabel:`${residual?'残差':quantity==='force'?'Fᵣ':'E'} / ${unit()}`,series,dots:state.data.map(p=>({id:p.id,r:p.r,v:residual?prediction(p)-reference(p):reference(p),validation:p.split==='validation'})),probe:state.probe.r});
  $('energy-chart').setAttribute('aria-label',`${quantity==='force'?'力':'能量'}${residual?'残差':'参考与预测'}，模型 Step ${state.step}，可移动探针`);
  $('coverage-note').textContent=`灰色区域：样本采样区间之外。当前覆盖 ${h2fmt(state.cfg.rMin,2)}–${h2fmt(state.cfg.rMax,2)} Å。${result.clipped?' △ 预测超出锁定纵轴，边缘三角为提示；可切换自动范围。':''}${state.warning?' '+state.warning:''}`;
  $('energy-view').setAttribute('aria-pressed',quantity==='energy'&&!residual);$('force-view').setAttribute('aria-pressed',quantity==='force'&&!residual);
  $('residual-view').setAttribute('aria-pressed',residual);$('residual-view').textContent=(quantity==='force'?'力':'能量')+'残差';
 }
 function probe(){
  if(!state)return;const p=state.probe,ref=quantity==='force'?p.referenceForce:p.reference,pred=quantity==='force'?p.predictionForce:p.prediction;
  $('probe-r').textContent=h2fmt(p.r,4)+' Å';$('probe-ref').textContent=h2fmt(ref);$('probe-pred').textContent=h2fmt(pred);$('probe-error').textContent=h2fmt(pred-ref);
  $('probe-ref-label').textContent='参考 / '+unit();$('probe-pred-label').textContent='预测 / '+unit();$('probe-error-label').textContent='预测 − 参考 / '+unit();
  const dist=50+Math.min(125,(p.r-.3)/2.7*125),x1=140-dist/2,x2=140+dist/2,F=p.predictionForce,len=Number.isFinite(F)?Math.min(32,6+8*Math.log1p(Math.abs(F))):0,sgn=Math.sign(F),arrow=(x,d)=>Math.abs(F)>1e-8&&Number.isFinite(F)?`<line x1="${x}" y1="78" x2="${x+d*len}" y2="78" stroke="#d47522" stroke-width="2.5"/><path d="M${x+d*len-d*6},73 L${x+d*len},78 L${x+d*len-d*6},83" fill="none" stroke="#d47522" stroke-width="2.5"/>`:'';
  $('molecule').innerHTML=`<line x1="${x1}" y1="32" x2="${x2}" y2="32" stroke="#8faac2" stroke-width="3"/><circle cx="${x1}" cy="32" r="18" fill="#deedff" stroke="#2378df"/><circle cx="${x2}" cy="32" r="18" fill="#deedff" stroke="#2378df"/><text x="${x1}" y="37" text-anchor="middle" font-size="14">H₁</text><text x="${x2}" y="37" text-anchor="middle" font-size="14">H₂</text>${arrow(x1,-sgn)}${arrow(x2,sgn)}<text x="140" y="103" text-anchor="middle" font-size="12">预测力 ${F>1e-8?'排斥':F< -1e-8?'吸引':'接近零'} · 箭长压缩显示</text>`;
  $('force-note').textContent=`Fᵣ = −dE/dr，F₂ = Fᵣ r̂₁₂，F₁ = −F₂。预测 Fᵣ = ${h2fmt(F)} eV/Å。${state.cfg.activations.some(a=>['relu','leaky'].includes(a))?'直接输入键长的一维 ReLU 类网络可产生分段常力；折点处导数按程序约定显示。':'力由同一可微能量函数解析求导；加入力标签用于约束拟合。'}`;
 }
 function history(){
  const force=quantity==='force',key=force?'forceMse':'mse';
  h2Plot($('loss-chart'),{height:$('loss-chart').clientHeight||240,xStep:true,bounds:[0,Math.max(10,state.step)],yLabel:force?'MSE / (eV/Å)²':'MSE / eV²',series:[{data:state.history.map(p=>({r:p.step,v:p.train[key]})),color:H2UI.blue},{data:state.history.map(p=>({r:p.step,v:p.validation[key]})),color:H2UI.orange}]});
  $('history-note').textContent=`完整训练／验证集的${force?'力':'能量'} MSE，按真实评估点记录。蓝色为训练集，橙色为验证集。`;
  const region=check=>{const pts=state.curve.filter(check);return pts.length?h2fmt(Math.sqrt(pts.reduce((s,p)=>s+(prediction(p)-reference(p))**2,0)/pts.length))+' '+unit():'无此区间';},lo=state.cfg.rMin,hi=state.cfg.rMax;
  $('region-metrics').textContent=`完整参考网格上的${force?'力':'能量'} RMSE：覆盖区内 ${region(p=>p.r>=lo&&p.r<=hi)}；左侧外推 ${region(p=>p.r<lo)}；右侧外推 ${region(p=>p.r>hi)}。这些网格不参与训练，分区值不是验证集指标。`;
 }
 const dataIdentity=s=>JSON.stringify(s.data.map(p=>[p.r,p.split]));
 const modelIdentity=c=>JSON.stringify([c.hiddenLayers,c.activations,c.initialization,c.seed]);
 function renderComparisonNote(){
  $('comparison-legend').hidden=$('clear-comparison').hidden=!comparison;
  if(!comparison){$('comparison-note').textContent='保存后可重新初始化，以相同坐标比较两次实际结果。';return;}
  const sameData=dataIdentity(state)===comparison.dataId,sameModel=modelIdentity(state.cfg)===modelIdentity(comparison.cfg);
  $('comparison-note').textContent=`紫色虚线：${comparison.cfg.trainingTarget==='energy-force'?'能量＋力':'仅能量'}，Step ${comparison.step}；数据划分${sameData?'一致':'不同'}，模型结构与初始化${sameModel?'一致':'不同'}。对照验证 RMSE：能量 ${h2fmt(comparison.latest.validation.rmse)} eV，力 ${h2fmt(comparison.latest.validation.forceRmse)} eV/Å。仅保存当前页面内存中的只读结果。`;
 }
 $('save-comparison').onclick=()=>{if(!state)return;comparison=clone({curve:state.curve,cfg:state.cfg,step:state.step,latest:state.latest,dataId:dataIdentity(state)});renderComparisonNote();energy();};
 $('clear-comparison').onclick=()=>{comparison=null;renderComparisonNote();energy();};
 function grid(){const s=state,key=`${version}-${s.step}-${s.lesson?.trace.token??'live'}-${s.lesson?.phase??0}`;if(key===gridKey)return;gridKey=key;const batch=s.lesson?.trace.batchIds??s.lastBatch;$('batch-count').textContent=`${s.stepsPerEpoch} Steps/Epoch`;$('batch-description').textContent=s.lesson&&s.lesson.phase<4?`高亮准备提交的 ${batch.length} 个样本；尚未更新参数。`:s.step?`最近更新 ${s.lastBatch.length} 个样本 · 更新前能量 MSE ${h2fmt(s.lastBatchLoss)} eV²`:'每轮重新打乱训练样本，尾批次保留。';$('sample-grid').innerHTML=s.order.map((id,i)=>`<button class="sample${i<s.cursor?' done':''}${batch.includes(id)?' recent':''}" data-sample="${id}" style="background:hsl(${Math.floor(i/s.cfg.batch)*47%360},55%,45%)" title="样本 ${id} · 点击作为主图探针">${id}</button>`).join('');$('validation-points').innerHTML=s.data.filter(p=>p.split==='validation').map(p=>`<button data-sample="${p.id}" title="验证点 ${p.id} · 不参与更新">${p.id}</button>`).join('');}
 function requestProbe(r){$('probe').value=r;nextProbe=r;if(probeTimer)return;probeTimer=setTimeout(()=>{probeTimer=null;post('probe',{r:nextProbe});},45);}
 for(const id of ['sample-grid','validation-points'])$(id).onclick=e=>{const b=e.target.closest('[data-sample]');if(b&&state){requestProbe(state.data[+b.dataset.sample-1].r);switchView('overview');requestAnimationFrame(()=>$('energy-chart').scrollIntoView({block:'center'}));}};
 $('probe').oninput=()=>requestProbe(+$('probe').value);
 $('energy-chart').onpointermove=e=>{if(!state||e.pointerType==='touch'&&!e.buttons)return;const el=$('energy-chart'),rect=el.getBoundingClientRect(),[a,b]=bounds(),left=Number(el.dataset.left)||55,right=Number(el.dataset.right)||18,x=Math.max(0,Math.min(1,(e.clientX-rect.left-left)/(rect.width-left-right)));requestProbe(a+(b-a)*x);};
 $('energy-chart').onpointerdown=e=>$('energy-chart').setPointerCapture(e.pointerId);
 $('play').onclick=()=>post(state?.running?'pause':'play');$('step').onclick=()=>post('step');$('reset').onclick=()=>{settings.resetDirty();reset();};$('csv').onclick=()=>post('export');
 $('speed').onchange=()=>{let n=Math.round(+$('speed').value);n=Math.max(1,Math.min(100,Number.isFinite(n)?n:100));$('speed').value=n;post('speed',{speed:n});};
 $('range').onchange=energy;$('plot-scale').onchange=()=>{energy();if(view==='computation')panel.refresh();};
 for(const q of ['energy','force'])$(q+'-view').onclick=()=>{quantity=q;residual=false;energy();history();probe();};
 $('residual-view').onclick=()=>{residual=!residual;energy();};
 const guides={
  step:{text:'依次查看前向、平均损失、反向，最后提交。已完成阶段可回放，只有提交使 Step +1。',choices:[['默认 32×32 网络',{}]],targets:['net-lesson']},
  forces:{text:'先训练仅能量模型并保存对照，再以相同数据、网络和种子进行联合训练。分别比较能量和力，不预设哪次结果更好。',choices:[['仅能量',{trainingTarget:'energy'}],['能量＋力 · λF=1',{trainingTarget:'energy-force',forceWeight:1}]],targets:['trainingTarget','forceWeight']},
  coverage:{text:'保持完整 Morse 参考曲线，限制训练与验证样本覆盖。灰色区是外推区域；参考网格指标独立于验证集。tanh 常趋于常值，错误外推不一定表现为发散。',choices:[['完整 0.30–3.00 Å',{rMin:.3,rMax:3}],['平衡附近 0.60–1.20 Å',{rMin:.6,rMax:1.2}],['缺少短程 0.90–3.00 Å',{rMin:.9,rMax:3}]],targets:['rMin','rMax']},
  capacity:{text:'相同样本、种子和 Epoch 下比较容量。无隐藏层只能拟合直线；参数更多也不保证结果更好。同时比较 Step、参数量和验证误差。',choices:[['线性基线',{hiddenLayers:[],activations:[]}],['小型 4×4',{hiddenLayers:[4,4],activations:['tanh','tanh']}],['默认 32×32',{}]],targets:['depth','layer-editors']},
  batch:{text:'相同 Epoch 下不同 Batch 对应不同更新次数。观察拟合与实际耗时，不预设优胜者。',choices:[['Batch 1',{batch:1}],['Batch 8',{batch:8}],['Batch 64',{batch:64}]],targets:['batch']},
  activation:{text:'比较激活、导数和力曲线。直接输入键长的一维 ReLU 类网络可产生分段常力；tanh、sigmoid、Softplus 平滑。全零初始化用于观察对称性。',choices:[['tanh',{}],['Softplus',{activations:['softplus','softplus']}],['sigmoid',{activations:['sigmoid','sigmoid']}],['ReLU',{activations:['relu','relu']}],['全零初始化',{initialization:'zero'}]],targets:['layer-editors','initialization']}
 };
 function fillGuide(name,index=0){const g=guides[name];document.querySelectorAll('.experiment-target').forEach(e=>e.classList.remove('experiment-target'));document.querySelectorAll('[data-guide]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.guide===name));$('guide-detail').hidden=false;$('guide-detail').innerHTML=`<p>${g.text}</p><div class="guide-choices">${g.choices.map(([label],i)=>`<button data-guide-choice="${i}" aria-pressed="${i===index}">${label}</button>`).join('')}</div><p class="hint">设置尚未应用；请点击“应用并重新初始化”。</p>`;$('guide-detail').querySelectorAll('[data-guide-choice]').forEach(b=>b.onclick=()=>fillGuide(name,+b.dataset.guideChoice));settings.draft({...H2Defaults,...g.choices[index][1]});openSettings();g.targets.forEach(id=>{const el=$(id);el.classList.add('experiment-target');for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});if(name==='step')$('tab-computation').classList.add('experiment-target');}
 document.querySelectorAll('[data-guide]').forEach(b=>b.onclick=()=>fillGuide(b.dataset.guide));
 $('guide-clear').onclick=()=>{$('guide-detail').hidden=true;document.querySelectorAll('.experiment-target').forEach(e=>e.classList.remove('experiment-target'));document.querySelectorAll('[data-guide]').forEach(b=>b.setAttribute('aria-pressed',false));};
 let resizing=false;const dimensions=new WeakMap();
 const observer=new ResizeObserver(entries=>{let changed=false;for(const entry of entries){const el=entry.target,w=el.clientWidth,h=el.clientHeight;if(el.classList.contains('training-bar')){document.documentElement.style.setProperty('--bar-height',Math.ceil(el.getBoundingClientRect().height)+'px');continue;}if(w===0||h===0)continue;const size=el.id==='network'?String(w):w+','+h;if(dimensions.get(el)!==size){dimensions.set(el,size);changed=true;}}if(!changed||resizing)return;resizing=true;requestAnimationFrame(()=>{resizing=false;drawVisible();updateButtons();});});
 ['energy-chart','loss-chart','network'].forEach(id=>observer.observe($(id)));observer.observe(document.querySelector('.training-bar'));
 window.addEventListener('pagehide',()=>{worker?.terminate();URL.revokeObjectURL(workerURL);});
 /** Only the embedding parent may exchange versioned settings. Import is a draft. */
 window.addEventListener('message',event=>{
  if(event.source!==parent)return;const m=event.data;
  if(m?.type==='mlip-pause'){post('pause');return;}
  if(m?.channel!=='mlip-h2-bridge'||typeof m.requestId!=='string'||m.requestId.length>100)return;
  const reply=(type,extra={})=>parent.postMessage({channel:'mlip-h2-bridge',type,requestId:m.requestId,...extra},'*');
  try{
   if(m.type==='get-config')reply('config',{payload:settings.exportEnvelope()});
   else if(m.type==='validate-config')reply('validated',{payload:{schema:'h2-lab-config',version:2,config:settings.parseEnvelope(m.payload)}});
   else if(m.type==='stage-config'){settings.importEnvelope(m.payload);reply('staged');}
  }catch(e){reply('error',{message:e.message});}
 });
 reset();
 if(parent!==window)parent.postMessage({channel:'mlip-h2-bridge',type:'ready'},'*');
})();
