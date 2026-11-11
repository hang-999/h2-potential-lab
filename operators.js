/* MLIP Lab: deterministic, reduced teaching operators. No pretrained physical model. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MLIP = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const PI = Math.PI, SPECIES = ['H', 'C', 'O'], Z = {H: 1, C: 6, O: 8};
  function seededRandom(seed){return ()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  const random=seededRandom(42),initialEmbedding=Object.fromEntries(SPECIES.map(sp=>[sp,Array.from({length:8},()=>2*random()-1)]));
  const filterCoefficients=Array.from({length:8},()=>.4*random()-.2),readoutCoefficients=Array.from({length:8},()=>.2*random()-.1);
  const acsfCoefficients=Object.fromEntries(SPECIES.map(sp=>[sp,Array.from({length:4},()=>Array.from({length:18},()=>2*random()-1))]));
  const defaults = Object.freeze({cutoff: 3, radial: 3, lmax: 2, channels: 4, rounds: 2,
    correlation: 2, sigma: .35, eta: 1, rs: 1, zeta: 2, lambda: 1,
    angleMessages: false, weights: [.7, -.4, .25, .15]});
  const atom = (id, element, pos) => ({id, element, pos});
  const presets = {
    environment: [atom(0,'C',[0,0,0]),atom(1,'H',[1.15,.2,.15]),atom(2,'H',[-.55,1.1,.3]),atom(3,'O',[-.7,-.55,.95]),atom(4,'H',[.25,-.6,-1.15])],
    water: [atom(0,'O',[0,0,0]),atom(1,'H',[.9572,0,0]),atom(2,'H',[-.2399872,.926627,0])],
    tetrahedron: [atom(0,'C',[0,0,0]),...[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map((p,i)=>atom(i+1,'H',p.map(x=>x*1.1/Math.sqrt(3))))],
    chain: Array.from({length:6},(_,i)=>atom(i,i%3===0?'O':i%2?'H':'C',[(i-2)*1.1,.12*Math.sin(i),0]))
  };
  const clone = x => JSON.parse(JSON.stringify(x));
  const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]), scale=(a,s)=>a.map(x=>x*s);
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0), norm=a=>Math.sqrt(dot(a,a));
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const zero=()=>[0,0,0], zeros=()=>[zero(),zero(),zero()];
  const outer=(a,b)=>a.map(x=>b.map(y=>x*y));
  const transpose=A=>A[0].map((_,j)=>A.map(r=>r[j]));
  const mm=(A,B)=>A.map(r=>transpose(B).map(c=>dot(r,c)));
  const mv=(A,v)=>A.map(r=>dot(r,v));
  const trace=A=>A.reduce((s,r,i)=>s+r[i],0);
  const flat=x=>Array.isArray(x)?x.flat(Infinity):[x];
  const error=(a,b)=>{const x=flat(a),y=flat(b);return Math.sqrt(x.reduce((s,v,i)=>s+(v-y[i])**2,0))/Math.max(1,Math.sqrt(dot(x,x)),Math.sqrt(dot(y,y)));};
  const fc=(r,rc)=>r<rc?.5*(Math.cos(PI*r/rc)+1):0;
  const dfc=(r,rc)=>r<rc?-.5*PI/rc*Math.sin(PI*r/rc):0;
  function bad(field,message){const e=new Error(message);e.field=field;throw e;}
  function validate(input) {
    if(!input || typeof input!=='object') bad('config','设置必须是对象。');
    const s=clone(input),p={...defaults,...s.params};
    const bounded=(key,lo,hi,integer=false)=>{
      const v=p[key];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi||(integer&&!Number.isInteger(v))) bad(key,`${key} 必须在 ${lo}–${hi} 范围内${integer?'且为整数':''}。`);
    };
    bounded('cutoff',.5,5);bounded('radial',1,4,true);bounded('lmax',0,2,true);bounded('channels',1,8,true);bounded('rounds',1,3,true);bounded('correlation',1,3,true);
    bounded('sigma',.1,1);bounded('eta',.1,5);bounded('rs',0,5);bounded('zeta',1,8,true);
    if(![-1,1].includes(p.lambda))bad('lambda','λ 只能为 −1 或 +1。');
    if(typeof p.angleMessages!=='boolean')bad('angleMessages','角度消息开关必须为布尔值。');
    if(!Array.isArray(p.weights)||p.weights.length!==4||p.weights.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>5))bad('weights','需要 4 个 −5 到 5 的权重。');
    if(!Array.isArray(s.atoms)||s.atoms.length<3||s.atoms.length>8)bad('atoms','请保留 3–8 个原子。');
    for(const a of s.atoms){if(!SPECIES.includes(a.element))bad('atoms','元素仅支持 H、C、O。');if(!Array.isArray(a.pos)||a.pos.length!==3||a.pos.some(x=>typeof x!=='number'||!Number.isFinite(x)||Math.abs(x)>30))bad('atoms','坐标须为 −30 到 30 Å 的有限数。');}
    if(new Set(s.atoms.map(a=>a.id)).size!==s.atoms.length)bad('atoms','原子 ID 不能重复。');
    for(let i=0;i<s.atoms.length;i++)for(let j=0;j<i;j++)if(norm(sub(s.atoms[i].pos,s.atoms[j].pos))<.15)bad('atoms','原子间距不能小于 0.15 Å。');
    s.center=s.center??0;s.selected=s.selected??Math.min(1,s.atoms.length-1);
    for(const key of ['center','selected'])if(!Number.isInteger(s[key])||s[key]<0||s[key]>=s.atoms.length)bad(key,'选中原子索引无效。');
    const t={axis:'z',angle:60,reflection:false,...s.transform};
    if(!['x','y','z'].includes(t.axis)||typeof t.angle!=='number'||!Number.isFinite(t.angle)||Math.abs(t.angle)>360||typeof t.reflection!=='boolean')bad('transform','旋转轴、角度或反射设置无效。');
    s.params=p;s.transform=t;s.version=Number.isInteger(s.version)?s.version:0;
    if(s.referenceAtoms){const ref=validate({atoms:s.referenceAtoms,center:s.referenceCenter??0,selected:s.referenceCenter??0,params:p});s.referenceAtoms=ref.atoms;s.referenceCenter=ref.center;}
    return s;
  }
  function rotation(t={}){
    const a=(t.angle||0)*PI/180,c=Math.cos(a),s=Math.sin(a);let R;
    if(t.axis==='x')R=[[1,0,0],[0,c,-s],[0,s,c]];
    else if(t.axis==='y')R=[[c,0,s],[0,1,0],[-s,0,c]];
    else R=[[c,-s,0],[s,c,0],[0,0,1]];
    if(t.reflection)R=R.map(row=>row.map((v,j)=>j===0?-v:v));return R;
  }
  function transformAtoms(atoms,t){const R=rotation(t);return atoms.map(a=>({...a,pos:mv(R,a.pos)}));}
  function geometry(atoms,center,p){
    const rc=p.cutoff,neighbors=[];let minDistance=Infinity;const edges=[];
    for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
      const r=norm(sub(atoms[j].pos,atoms[i].pos));minDistance=Math.min(r,minDistance);
      if(r<rc){edges.push({from:i,to:j,r,cutoff:fc(r,rc)});edges.push({from:j,to:i,r,cutoff:fc(r,rc)});}
    }
    for(let j=0;j<atoms.length;j++)if(j!==center){const v=sub(atoms[j].pos,atoms[center].pos),r=norm(v);if(r<rc)neighbors.push({index:j,id:atoms[j].id,element:atoms[j].element,r,unit:scale(v,1/r),cutoff:fc(r,rc)});}
    const angles=[];for(let j=0;j<neighbors.length;j++)for(let k=j+1;k<neighbors.length;k++){
      const a=neighbors[j],b=neighbors[k],cos=Math.max(-1,Math.min(1,dot(a.unit,b.unit)));angles.push({j:a.index,k:b.index,cos,theta:Math.acos(cos)*180/PI});
    }return {neighbors,angles,edges,minDistance};
  }
  function acsf(atoms,center,p){
    const geo=geometry(atoms,center,p),features=[];
    for(const species of SPECIES)for(let n=0;n<p.radial;n++){
      const rs=Math.max(0,Math.min(p.cutoff,p.rs+(n-(p.radial-1)/2)*.45));
      const terms=geo.neighbors.filter(j=>j.element===species).map(j=>({indices:[j.index],value:Math.exp(-p.eta*(j.r-rs)**2)*j.cutoff}));
      features.push({label:`G₂ ${species} · ${n+1}`,kind:'radial',species,n,eta:p.eta,rs,value:terms.reduce((s,t)=>s+t.value,0),terms});
    }
    for(let a=0;a<SPECIES.length;a++)for(let b=a;b<SPECIES.length;b++){
      const terms=[];for(let j=0;j<geo.neighbors.length;j++)for(let k=j+1;k<geo.neighbors.length;k++){
        const u=geo.neighbors[j],v=geo.neighbors[k];if([u.element,v.element].sort().join(',')!==[SPECIES[a],SPECIES[b]].sort().join(','))continue;
        const rjk=norm(sub(atoms[u.index].pos,atoms[v.index].pos)),cos=Math.max(-1,Math.min(1,dot(u.unit,v.unit)));
        // The stored unordered pair includes both (j,k) and (k,j) of Behler's ordered sum.
        const value=2**(2-p.zeta)*(1+p.lambda*cos)**p.zeta*Math.exp(-p.eta*(u.r*u.r+v.r*v.r+rjk*rjk))*u.cutoff*v.cutoff*fc(rjk,p.cutoff);
        terms.push({indices:[u.index,v.index],value,cos,rjk});
      }features.push({label:`G₄ ${SPECIES[a]}–${SPECIES[b]}`,kind:'angular',species:[SPECIES[a],SPECIES[b]],value:terms.reduce((s,t)=>s+t.value,0),terms});
    }
    const w=p.weights,inputWeights=acsfCoefficients[atoms[center].element].map(row=>row.slice(0,features.length).map(x=>x*w[0])),biases=Array.from({length:4},(_,k)=>w[1]*(k-1.5));
    const hidden=Array.from({length:4},(_,k)=>Math.tanh(features.reduce((v,f,j)=>v+f.value*inputWeights[k][j],biases[k])));
    const contributions=hidden.map((a,k)=>a*w[k]);
    return {features,radial:features.filter(f=>f.kind==='radial').map(f=>f.value),angular:features.filter(f=>f.kind==='angular').map(f=>f.value),readout:{hidden,contributions,value:contributions.reduce((a,b)=>a+b,0),model:{seed:42,inputWeights,biases,outputWeights:w.slice()}}};
  }
  function realSH(direction,l){
    const length=norm(direction);const [x,y,z]=length?scale(direction,1/length):[0,0,1];
    if(l===0)return [1/Math.sqrt(4*PI)];
    if(l===1)return [y,z,x].map(v=>v*Math.sqrt(3/(4*PI)));
    if(l===2)return [Math.sqrt(15/(4*PI))*x*y,Math.sqrt(15/(4*PI))*y*z,Math.sqrt(5/(16*PI))*(3*z*z-1),Math.sqrt(15/(4*PI))*x*z,Math.sqrt(15/(16*PI))*(x*x-y*y)];
    throw new Error('仅支持 l = 0, 1, 2。');
  }
  function harmonics(direction,lmax=2){return {direction:norm(direction)?scale(direction,1/norm(direction)):[0,0,1],groups:Array.from({length:lmax+1},(_,l)=>({l,values:realSH(direction,l)}))};}
  // Same irreducible representation in a Cartesian basis; independent of evaluating Y(Ru).
  function rotateSH(R,l,values){
    if(l===0)return values.slice();
    if(l===1){const v=mv(R,[values[2],values[0],values[1]]);return[v[1],v[2],v[0]];}
    if(l===2){
      const a=Math.sqrt(15/(4*PI)),b=Math.sqrt(5/(16*PI)),c=Math.sqrt(15/(16*PI));
      const qzz=values[2]/(3*b),diff=values[4]/c;
      const Q=[[(-qzz+diff)/2,values[0]/a,values[3]/a],[values[0]/a,(-qzz-diff)/2,values[1]/a],[values[3]/a,values[1]/a,qzz]];
      const T=mm(mm(R,Q),transpose(R));return[a*T[0][1],a*T[1][2],3*b*T[2][2],a*T[0][2],c*(T[0][0]-T[1][1])];
    }throw new Error('仅支持 l = 0, 1, 2。');
  }
  const quadratureCache=new Map(),basisCache=new Map();
  function gaussLegendre(n){
    if(quadratureCache.has(n))return quadratureCache.get(n);const x=new Array(n),w=new Array(n);
    for(let i=0;i<Math.ceil(n/2);i++){
      let z=Math.cos(PI*(i+.75)/(n+.5)),pp=0;
      for(let it=0;it<30;it++){let p0=1,p1=z;for(let j=2;j<=n;j++){const pn=((2*j-1)*z*p1-(j-1)*p0)/j;p0=p1;p1=pn;}pp=n*(z*p1-p0)/(z*z-1);const dz=p1/pp;z-=dz;if(Math.abs(dz)<1e-15)break;}
      x[i]=-z;x[n-1-i]=z;w[i]=w[n-1-i]=2/((1-z*z)*pp*pp);
    }const out={x,w};quadratureCache.set(n,out);return out;
  }
  function basis(p,count=96){
    const key=[p.cutoff,p.radial,count].join('/');if(basisCache.has(key))return basisCache.get(key);
    const q=gaussLegendre(count),r=q.x.map(x=>(x+1)*p.cutoff/2),weights=q.w.map((w,i)=>w*p.cutoff/2*r[i]**2);
    const values=[],coefs=[];
    for(let n=0;n<p.radial;n++){
      let c=Array(p.radial).fill(0);c[n]=1;let v=r.map(x=>(1-x/p.cutoff)**(n+3));
      for(let k=0;k<n;k++){const projection=v.reduce((s,x,i)=>s+x*values[k][i]*weights[i],0);v=v.map((x,i)=>x-projection*values[k][i]);c=c.map((x,i)=>x-projection*coefs[k][i]);}
      const length=Math.sqrt(v.reduce((s,x,i)=>s+x*x*weights[i],0));v=v.map(x=>x/length);c=c.map(x=>x/length);values.push(v);coefs.push(c);
    }
    const result={r,weights,values,coefs};basisCache.set(key,result);if(basisCache.size>30)basisCache.delete(basisCache.keys().next().value);return result;
  }
  // exp(-x) * modified spherical Bessel i_l(x), avoiding overflow at narrow sigma.
  function scaledBessel(x,l){
    if(x<.08){let term=x**l/([1,3,15][l]),sum=term;for(let k=1;k<12;k++){term*=x*x/(2*k*(2*l+2*k+1));sum+=term;}return Math.exp(-x)*sum;}
    const e=Math.exp(-2*x);if(l===0)return -Math.expm1(-2*x)/(2*x);
    if(l===1)return ((x-1)+(x+1)*e)/(2*x*x);
    return ((x*x-3*x+3)-(x*x+3*x+3)*e)/(2*x*x*x);
  }
  function soap(atoms,center,p,options={}){
    const b=basis(p,options.quadrature||96),geo=geometry(atoms,center,p),C={};
    for(const species of SPECIES)for(let n=0;n<p.radial;n++)for(let l=0;l<=p.lmax;l++)C[`${species}/${n}/${l}`]=Array(2*l+1).fill(0);
    for(const j of geo.neighbors){
      for(let l=0;l<=p.lmax;l++){
        const sh=realSH(j.unit,l),radial=Array(p.radial).fill(0);
        for(let k=0;k<b.r.length;k++){
          const r=b.r[k],x=r*j.r/(p.sigma*p.sigma);
          const common=4*PI*b.weights[k]*Math.exp(-((r-j.r)**2)/(2*p.sigma*p.sigma))*scaledBessel(x,l)*j.cutoff;
          for(let n=0;n<p.radial;n++)radial[n]+=common*b.values[n][k];
        }
        for(let n=0;n<p.radial;n++){const v=C[`${j.element}/${n}/${l}`];for(let m=0;m<v.length;m++)v[m]+=radial[n]*sh[m];}
      }
    }
    const coefficients=[],power=[];
    for(const species of SPECIES)for(let n=0;n<p.radial;n++)for(let l=0;l<=p.lmax;l++)C[`${species}/${n}/${l}`].forEach((value,k)=>coefficients.push({species,n,l,m:k-l,value}));
    for(const speciesA of SPECIES)for(const speciesB of SPECIES)for(let n=0;n<p.radial;n++)for(let n2=0;n2<p.radial;n2++)for(let l=0;l<=p.lmax;l++){
      const value=PI*Math.sqrt(8/(2*l+1))*dot(C[`${speciesA}/${n}/${l}`],C[`${speciesB}/${n2}/${l}`]);
      power.push({label:`${speciesA}${speciesB} · ${n+1},${n2+1} · l${l}`,speciesA,speciesB,n,n2,l,value});
    }
    const length=norm(power.map(x=>x.value)),density=[],radialBasis=[];
    if(!options.compact)for(let k=0;k<=60;k++){
      const r=p.cutoff*k/60;
      // Angular-average density: coefficient l=0 divided by sqrt(4π).
      let value=0;for(const j of geo.neighbors){const x=r*j.r/(p.sigma*p.sigma);value+=j.cutoff*Math.exp(-((r-j.r)**2)/(2*p.sigma*p.sigma))*scaledBessel(x,0);}
      density.push({r,value});radialBasis.push({r,values:b.coefs.map(c=>c.reduce((s,v,n)=>s+v*(1-r/p.cutoff)**(n+3),0))});
    }
    return {coefficients,power,norm:length,density,radialBasis,convention:'实球谐 ∫Y²dΩ=1；正交多项式径向基；积分域 0≤r≤r_cut；ρ=Σ f_cut(r_j) exp(−|r−r_j|²/2σ²)，不含中心；p=π√[8/(2l+1)]Σₘcₙₗₘcₙ′ₗₘ；保留完整物种交叉功率谱。'};
  }
  const SOAP_NORM_EPS=1e-8;
  function soapNormalize(p){const d=Math.hypot(norm(p),SOAP_NORM_EPS);return p.map(x=>x/d);}
  function kernel(a,b){const x=a.power?a.power.map(p=>p.value):a,y=b.power?b.power.map(p=>p.value):b;return Math.max(0,Math.min(1,dot(soapNormalize(x),soapNormalize(y))))**2;}
  function moments(atoms,center,p){
    const neighbors=geometry(atoms,center,p).neighbors.map(j=>({...j,w:j.cutoff*Math.exp(-j.r*j.r/2)}));
    let s=0,v=zero(),Q=zeros();for(const j of neighbors){s+=j.w;v=add(v,scale(j.unit,j.w));for(let a=0;a<3;a++)for(let b=0;b<3;b++)Q[a][b]+=j.w*(j.unit[a]*j.unit[b]-(a===b?1/3:0));}
    const invariants=[{label:'s',value:s},{label:'v·v',value:dot(v,v)},{label:'tr(Q²)',value:trace(mm(Q,Q))},{label:'tr(Q³)',value:trace(mm(mm(Q,Q),Q))}];
    const terms=[];for(const j of neighbors)for(const k of neighbors)terms.push({indices:[j.index,k.index],value:j.w*k.w*dot(j.unit,k.unit)});
    return {s,v,Q,invariants,terms,readout:invariants.reduce((s,f,i)=>s+p.weights[i]*f.value,0)};
  }
  function messagePassing(atoms,p,equivariant=false){
    const C=p.channels,w=p.weights;
    let nodes=atoms.map((a,index)=>({index,s:initialEmbedding[a.element].slice(0,C),v:Array.from({length:C},zero)}));
    const layers=[{round:0,nodes:clone(nodes),edges:[]}];
    for(let round=1;round<=p.rounds;round++){
      const edges=[],next=[];
      for(let i=0;i<atoms.length;i++){
        const geo=geometry(atoms,i,p),S=Array(C).fill(0),V=Array.from({length:C},zero),den=Math.sqrt(4);
        for(const j of geo.neighbors){
          let angular=0;if(p.angleMessages&&geo.neighbors.length>1)for(const k of geo.neighbors)if(k.index!==j.index)angular+=dot(j.unit,k.unit)*k.cutoff/4;
          const filter=[],message=[],vectorMessage=[];
          for(let c=0;c<C;c++){
            const f=j.cutoff*Math.exp(-.7*(j.r-(c+1)*p.cutoff/(C+1))**2)*(w[0]+filterCoefficients[c])*(1+w[1]*angular);
            const m=f*(w[1]*nodes[j.index].s[c]+.2*nodes[j.index].s[(c+1)%C]+(equivariant?w[2]*dot(nodes[j.index].v[c],j.unit):0));
            const vm=equivariant?scale(add(scale(nodes[j.index].v[c],w[2]),scale(j.unit,w[3]*nodes[j.index].s[c])),f):zero();
            filter.push(f);message.push(m);vectorMessage.push(vm);S[c]+=m;V[c]=add(V[c],vm);
          }edges.push({from:j.index,to:i,r:j.r,filter,message,vectorMessage});
        }
        const s=S.map((v,c)=>Math.tanh(nodes[i].s[c]+v/den));
        const v=V.map((v,c)=>equivariant?scale(add(nodes[i].v[c],scale(v,1/den)),1/(1+Math.exp(-s[c]))):zero());next.push({index:i,s,v});
      }
      nodes=next;layers.push({round,nodes:clone(nodes),edges});
    }
    const readout=nodes.map(n=>n.s.reduce((s,a,c)=>s+(w[2]+readoutCoefficients[c])*a+(equivariant?w[3]*dot(n.v[c],n.v[c]):0),0)/C);
    return {layers,readout,total:readout.reduce((a,b)=>a+b,0),model:{seed:42,embedding:clone(initialEmbedding),filterCoefficients:filterCoefficients.slice(0,C),readoutCoefficients:readoutCoefficients.slice(0,C),weights:w.slice()}};
  }
  function tensorProduct(u,v){
    const scalar=dot(u,v),axial=cross(u,v),A=outer(u,v),B=outer(v,u),symmetric=A.map((row,i)=>row.map((x,j)=>(x+B[i][j])/2-(i===j?scalar/3:0)));
    const reconstructed=symmetric.map((row,i)=>row.map((x,j)=>x+(i===j?scalar/3:0)+(A[i][j]-B[i][j])/2));
    return {u:u.slice(),v:v.slice(),scalar,axial,symmetric,reconstructionError:error(reconstructed,A)};
  }
  function correlations(atoms,center,p){
    const m=moments(atoms,center,p),neighbors=geometry(atoms,center,p).neighbors.map(j=>({...j,w:j.cutoff*Math.exp(-j.r*j.r/2)}));
    const all=[{label:'ν=1 · s',value:m.s},{label:'ν=2 · v·v',value:dot(m.v,m.v)},{label:'ν=3 · vᵀQv',value:dot(m.v,mv(m.Q,m.v))}],features=all.slice(0,p.correlation),terms=[];
    if(p.correlation===1)for(const j of neighbors)terms.push({indices:[j.index],value:j.w});
    if(p.correlation===2)terms.push(...m.terms);
    if(p.correlation===3)for(const j of neighbors)for(const k of neighbors)for(const l of neighbors)terms.push({indices:[j.index,k.index,l.index],value:j.w*k.w*l.w*(dot(j.unit,l.unit)*dot(l.unit,k.unit)-dot(j.unit,k.unit)/3)});
    return {order:p.correlation,features,terms,readout:features.reduce((s,f,i)=>s+p.weights[i]*f.value,0)};
  }
  function energyForces(atoms,p){
    let value=0;const forces=atoms.map(zero),rc=p.cutoff,k=.6,beta=.12,r0=1.2,c0=-1/3;
    for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
      const d=sub(atoms[j].pos,atoms[i].pos),r=norm(d),f=fc(r,rc),q=r-r0;
      value+=.5*k*f*q*q;const g=scale(d,(.5*k*dfc(r,rc)*q*q+k*f*q)/r);forces[i]=add(forces[i],g);forces[j]=sub(forces[j],g);
    }
    for(let i=0;i<atoms.length;i++){
      const ns=geometry(atoms,i,p).neighbors;
      for(let j=0;j<ns.length;j++)for(let k2=j+1;k2<ns.length;k2++){
        const a=ns[j],b=ns[k2],c=dot(a.unit,b.unit),q=c-c0;value+=beta*a.cutoff*b.cutoff*q*q;
        const da=add(scale(a.unit,beta*dfc(a.r,rc)*b.cutoff*q*q),scale(sub(b.unit,scale(a.unit,c)),2*beta*a.cutoff*b.cutoff*q/a.r));
        const db=add(scale(b.unit,beta*dfc(b.r,rc)*a.cutoff*q*q),scale(sub(a.unit,scale(b.unit,c)),2*beta*a.cutoff*b.cutoff*q/b.r));
        forces[i]=add(forces[i],add(da,db));forces[a.index]=sub(forces[a.index],da);forces[b.index]=sub(forces[b.index],db);
      }
    }
    return {value,forces,units:'eV',formula:'E = 0.3 Σᵢ<ⱼ f_c(rᵢⱼ)(rᵢⱼ−1.2)² + 0.12 ΣᵢΣⱼ<ₖ f_c(rᵢⱼ)f_c(rᵢₖ)(cosθⱼᵢₖ+1/3)²；教学构造势，F=−∇E，非真实分子势。'};
  }
  function compute(input){
    const s=validate(input),{atoms,center,params:p}=s;
    const geo=geometry(atoms,center,p),a=acsf(atoms,center,p),so=soap(atoms,center,p),mo=moments(atoms,center,p),msg=messagePassing(atoms,p),vec=messagePassing(atoms,p,true),ef=energyForces(atoms,p);
    const last=vec.layers[vec.layers.length-1].nodes[center];vec.vector=last.v[0];vec.scalar=last.s[0];
    const referenceAtoms=s.referenceAtoms||presets.tetrahedron,referenceCenter=s.referenceCenter??0;
    const reference=soap(referenceAtoms,referenceCenter,p,{compact:true});so.kernel=kernel(so,reference);so.referencePower=reference.power.map(f=>f.value);so.referenceAtoms=clone(referenceAtoms);so.referenceCenter=referenceCenter;
    const dir=s.selected!==center?sub(atoms[s.selected].pos,atoms[center].pos):geo.neighbors[0]?.unit||[0,0,1];
    const u=geo.neighbors[0]?.unit||zero(),v=geo.neighbors[1]?.unit||zero(),tp=tensorProduct(u,v);tp.available=geo.neighbors.length>=2;
    const t=s.transform,R=rotation(t),ta=transformAtoms(atoms,t),tmo=moments(ta,center,p),tv=messagePassing(ta,p,true),tm=messagePassing(ta,p,false),te=energyForces(ta,p),taAc=acsf(ta,center,p),taSo=soap(ta,center,p,{compact:true});
    const tVector=tv.layers[tv.layers.length-1].nodes[center].v[0],expectedVector=mv(R,vec.vector),expectedQ=mm(mm(R,mo.Q),transpose(R));
    const hs=harmonics(dir,p.lmax),ths=harmonics(mv(R,dir),p.lmax),expectedHarmonics=hs.groups.map(g=>({l:g.l,values:rotateSH(R,g.l,g.values)}));
    const ttp=tensorProduct(mv(R,u),mv(R,v)),expectedTP=mm(mm(R,tp.symmetric),transpose(R));
    const corr=correlations(atoms,center,p),tcorr=correlations(ta,center,p);
    const rot={acsf:error(a.features.map(x=>x.value),taAc.features.map(x=>x.value)),soap:error(so.power.map(x=>x.value),taSo.power.map(x=>x.value)),moments:error(mo.invariants.map(x=>x.value),tmo.invariants.map(x=>x.value)),momentReadout:error(mo.readout,tmo.readout),messageScalar:error(msg.total,tm.total),scalar:error(vec.total,tv.total),vector:error(tVector,expectedVector),tensor:error(tmo.Q,expectedQ),tensorProduct:error(ttp.symmetric,expectedTP),harmonics:error(ths.groups.flatMap(g=>g.values),expectedHarmonics.flatMap(g=>g.values)),maceReadout:error(corr.readout,tcorr.readout),energy:error(ef.value,te.value),forces:error(te.forces,ef.forces.map(f=>mv(R,f)))};
    const shifted=atoms.map(a=>({...a,pos:add(a.pos,[1.3,-.7,.4])})),shiftAc=acsf(shifted,center,p),shiftSo=soap(shifted,center,p,{compact:true});
    const order=atoms.map((_,i)=>i).reverse(),permuted=order.map(i=>atoms[i]),pc=order.indexOf(center),permAc=acsf(permuted,pc,p),permSo=soap(permuted,pc,p,{compact:true});
    const RF=rotation({axis:'z',angle:0,reflection:true}),ra=transformAtoms(atoms,{axis:'z',angle:0,reflection:true}),rv=messagePassing(ra,p,true),rm=moments(ra,center,p),re=energyForces(ra,p),rt=tensorProduct(mv(RF,u),mv(RF,v));
    const warnings=[];if(!geo.neighbors.length)warnings.push('截断范围内没有邻居；环境特征为零，归一化 SOAP 核约定为 0。');
    const out={version:s.version,atoms:clone(atoms),center,params:clone(p),geometry:geo,acsf:a,soap:so,moments:mo,messages:msg,vectors:vec,harmonics:hs,tensor:tp,mace:corr,energy:ef,
      diagnostics:{rotation:rot,translation:{acsf:error(a.features.map(x=>x.value),shiftAc.features.map(x=>x.value)),soap:error(so.power.map(x=>x.value),shiftSo.power.map(x=>x.value)),energy:error(ef.value,energyForces(shifted,p).value)},permutation:{acsf:error(a.features.map(x=>x.value),permAc.features.map(x=>x.value)),soap:error(so.power.map(x=>x.value),permSo.power.map(x=>x.value)),energy:error(ef.value,energyForces(permuted,p).value)},reflection:{scalar:error(vec.total,rv.total),vector:error(rv.layers[rv.layers.length-1].nodes[center].v[0],mv(RF,vec.vector)),tensor:error(rm.Q,mm(mm(RF,mo.Q),transpose(RF))),axial:error(rt.axial,scale(mv(RF,tp.axial),-1)),energy:error(ef.value,re.value),forces:error(re.forces,ef.forces.map(f=>mv(RF,f)))}} ,
      transformed:{atoms:ta,vector:tVector,expectedVector,Q:tmo.Q,expectedQ,energy:te.value,forces:te.forces,vectorLayers:tv.layers,messageLayers:tm.layers,harmonics:ths,expectedHarmonics,tensor:ttp,expectedTensor:expectedTP},warnings};
    if(flatNumbers(out).some(x=>!Number.isFinite(x)))throw new Error('计算产生非有限数，请检查构型及参数。');return out;
  }
  function flatNumbers(x){if(typeof x==='number')return[x];if(Array.isArray(x))return x.flatMap(flatNumbers);if(x&&typeof x==='object')return Object.values(x).flatMap(flatNumbers);return[];}
  return {defaults,presets,validate,compute,transformAtoms,geometry,acsf,soap,soapNormalize,kernel,moments,messagePassing,harmonics,tensorProduct,correlations,energyForces,
    math:{add,sub,scale,dot,norm,cross,outer,transpose,mm,mv,trace,error,rotation,realSH,rotateSH,fc,dfc,gaussLegendre,scaledBessel},clone};
});
