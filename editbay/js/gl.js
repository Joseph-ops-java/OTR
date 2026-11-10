/* Edit Bay — GPU grading (WebGL). One shader does white balance (linear light), exposure, lift/gamma/gain wheels, contrast,
   saturation, hue, curves (master + RGB), 3D LUTs (.cube, trilinear), faded blacks, vignette, grain and sepia. 2D filters remain the fallback. */
const GLX={ok:null,cv:null,gl:null,prog:null,u:{},tex:null,curveTex:null,lutTex:null,lutKey:"",curveKey:""};const LUTS={};
const VS="attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
const FS=`precision highp float;varying vec2 v;uniform sampler2D T,C,L;uniform float lutN,lutMix,bri,con,sat,hue,fade,vig,grain,sepia,bw,seed,useCurve;uniform vec3 wb,lift,gam,gain;uniform vec2 res;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
vec3 lut(vec3 c){float n=lutN;vec3 s=clamp(c,0.,1.)*(n-1.);float b0=floor(s.b),b1=min(b0+1.,n-1.),f=s.b-b0;vec2 px=1./vec2(n*n,n);
 vec2 uv0=vec2((s.r+.5+b0*n),(s.g+.5))*px,uv1=vec2((s.r+.5+b1*n),(s.g+.5))*px;return mix(texture2D(L,uv0).rgb,texture2D(L,uv1).rgb,f);}
void main(){vec4 t=texture2D(T,v);if(t.a<=0.){gl_FragColor=vec4(0.);return;}vec3 c=t.rgb;
 c=pow(c,vec3(2.2));c*=wb*exp2(bri*2.);c=pow(max(c,0.),vec3(1./2.2));
 c=gain*(c+lift*(1.-c));c=pow(max(c,0.),1./max(gam,vec3(.05)));
 c=(c-.5)*(1.+con)+.5;float y=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(y),c,bw>.5?0.:max(0.,1.+sat));
 if(hue!=0.){float ca=cos(hue),sa=sin(hue);mat3 m=mat3(.299+.701*ca+.168*sa,.299-.299*ca-.328*sa,.299-.3*ca+1.25*sa,.587-.587*ca+.330*sa,.587+.413*ca+.035*sa,.587-.588*ca-1.05*sa,.114-.114*ca-.497*sa,.114-.114*ca+.292*sa,.114+.886*ca-.203*sa);c=m*c;}
 if(sepia>0.){vec3 s=vec3(dot(c,vec3(.393,.769,.189)),dot(c,vec3(.349,.686,.168)),dot(c,vec3(.272,.534,.131)));c=mix(c,s,sepia);}
 c=clamp(c,0.,1.);
 if(useCurve>.5){c=vec3(texture2D(C,vec2(c.r*255./256.+.5/256.,.5)).a,texture2D(C,vec2(c.g*255./256.+.5/256.,.5)).a,texture2D(C,vec2(c.b*255./256.+.5/256.,.5)).a);
  c=vec3(texture2D(C,vec2(c.r*255./256.+.5/256.,.5)).r,texture2D(C,vec2(c.g*255./256.+.5/256.,.5)).g,texture2D(C,vec2(c.b*255./256.+.5/256.,.5)).b);}
 if(lutN>1.)c=mix(c,lut(c),lutMix);
 c=c*(1.-fade*.3)+fade*.12;
 if(vig>0.){vec2 q=(v-.5)*vec2(res.x/res.y,1.);c*=1.-vig*smoothstep(.25,.95,length(q)*1.15);}
 if(grain>0.)c+=(h(v*res)-.5)*grain*.22;
 c=clamp(c,0.,1.);gl_FragColor=vec4(c*t.a,t.a);}`;
function glOK(){if(GLX.ok!==null)return GLX.ok;try{const cv=document.createElement("canvas");const gl=cv.getContext("webgl",{premultipliedAlpha:true,preserveDrawingBuffer:true});if(!gl)throw 0;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
  const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw 0;gl.useProgram(p);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(p,"p");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  "T C L lutN lutMix bri con sat hue fade vig grain sepia bw seed useCurve wb lift gam gain res".split(" ").forEach(n=>GLX.u[n]=gl.getUniformLocation(p,n));
  const mk=(unit)=>{const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t};
  GLX.tex=mk(0);GLX.curveTex=mk(1);GLX.lutTex=mk(2);gl.uniform1i(GLX.u.T,0);gl.uniform1i(GLX.u.C,1);gl.uniform1i(GLX.u.L,2);
  gl.activeTexture(gl.TEXTURE2);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
  Object.assign(GLX,{cv,gl,prog:p,ok:true})}catch(e){GLX.ok=false}return GLX.ok}

/* curves: points [[x,y],...] in 0..1, monotone cubic (Fritsch-Carlson) to a 256-entry table */
function curveTable(pts){pts=(pts&&pts.length>1?pts:[[0,0],[1,1]]).slice().sort((a,b)=>a[0]-b[0]);const n=pts.length,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),d=[],m=[];
  for(let i=0;i<n-1;i++)d.push((ys[i+1]-ys[i])/((xs[i+1]-xs[i])||1e-6));m[0]=d[0];m[n-1]=d[n-2];for(let i=1;i<n-1;i++)m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){if(d[i]===0){m[i]=m[i+1]=0;continue}const a=m[i]/d[i],b=m[i+1]/d[i],s=a*a+b*b;if(s>9){const t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i]}}
  const out=new Uint8Array(256);for(let k=0;k<256;k++){const x=k/255;let i=0;while(i<n-2&&x>xs[i+1])i++;if(x<=xs[0]){out[k]=clamp(ys[0],0,1)*255;continue}if(x>=xs[n-1]){out[k]=clamp(ys[n-1],0,1)*255;continue}
    const h=(xs[i+1]-xs[i])||1e-6,t=(x-xs[i])/h,t2=t*t,t3=t2*t;const y=(2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*m[i+1];out[k]=Math.round(clamp(y,0,1)*255)}return out}
const isIdent=p=>!p||p.length<2||(p.length===2&&p[0][0]===0&&p[0][1]===0&&p[1][0]===1&&p[1][1]===1);
function hasCurves(c){const k=c.curves;return!!k&&!(isIdent(k.m)&&isIdent(k.r)&&isIdent(k.g)&&isIdent(k.b))}
function wheel(v,s){/* pad (x,y) and master m -> rgb offset; x along blue-yellow, y along red-cyan */v=v||[0,0,0];const[x,y,m]=v;return[(1.402*y)*s+m*s,(-.344*x-.714*y)*s+m*s,(1.772*x)*s+m*s]}
function glGrade(layer,c,t){const{gl,u,cv}=GLX;const W=layer.width,H=layer.height;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}gl.viewport(0,0,W,H);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,GLX.tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,layer);
  const ck=hasCurves(c)?JSON.stringify(c.curves):"";if(ck!==GLX.curveKey){GLX.curveKey=ck;const k=c.curves||{},M=curveTable(k.m),R=curveTable(k.r),G=curveTable(k.g),B=curveTable(k.b);const d=new Uint8Array(256*4);for(let i=0;i<256;i++){d[i*4]=R[i];d[i*4+1]=G[i];d[i*4+2]=B[i];d[i*4+3]=M[i]}
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,GLX.curveTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,256,1,0,gl.RGBA,gl.UNSIGNED_BYTE,d)}
  const L=c.lut&&LUTS[c.lut];const lk=L?c.lut:"";if(lk!==GLX.lutKey){GLX.lutKey=lk;if(L){const n=L.n,d=new Uint8Array(n*n*n*4);for(let b=0;b<n;b++)for(let g=0;g<n;g++)for(let r=0;r<n;r++){const s=((b*n+g)*n+r)*3,o=((g*n*n)+(b*n+r))*4;d[o]=L.u8[s];d[o+1]=L.u8[s+1];d[o+2]=L.u8[s+2];d[o+3]=255}
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,GLX.lutTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,n*n,n,0,gl.RGBA,gl.UNSIGNED_BYTE,d)}}
  const temp=c.temp||0,tint=c.tint||0,lg=c.lgg||{};const lf=wheel(lg.lift,.12),gm=wheel(lg.gamma,.35),gn=wheel(lg.gain,.35);
  gl.uniform3f(u.wb,1+temp*.3+tint*.06,1-tint*.22,1-temp*.3+tint*.06);gl.uniform1f(u.bri,c.bri||0);gl.uniform1f(u.con,c.con||0);gl.uniform1f(u.sat,c.sat||0);gl.uniform1f(u.hue,(c.hue||0)*Math.PI/180);
  gl.uniform1f(u.fade,c.fade||0);gl.uniform1f(u.vig,c.vig||0);gl.uniform1f(u.grain,c.grain||0);gl.uniform1f(u.sepia,c.sepia||0);gl.uniform1f(u.bw,c.bw?1:0);gl.uniform1f(u.seed,(t||0)*7.13%97);
  gl.uniform3f(u.lift,lf[0],lf[1],lf[2]);gl.uniform3f(u.gam,1+gm[0],1+gm[1],1+gm[2]);gl.uniform3f(u.gain,1+gn[0],1+gn[1],1+gn[2]);gl.uniform1f(u.useCurve,ck?1:0);
  gl.uniform1f(u.lutN,L?L.n:0);gl.uniform1f(u.lutMix,c.lutMix==null?1:c.lutMix);gl.uniform2f(u.res,W,H);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  const x=layer.getContext("2d");x.save();x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter="none";x.globalCompositeOperation="copy";x.drawImage(cv,0,0);x.restore()}

/* .cube LUTs: parsed, resampled to at most 33³, stored in the database so every device and render has them */
function parseCube(txt){let n=0;const v=[];let dmin=[0,0,0],dmax=[1,1,1];txt.split(/\r?\n/).forEach(l=>{l=l.trim();if(!l||l[0]==="#")return;const p=l.split(/\s+/);if(p[0]==="LUT_3D_SIZE")n=+p[1];else if(p[0]==="DOMAIN_MIN")dmin=p.slice(1).map(Number);else if(p[0]==="DOMAIN_MAX")dmax=p.slice(1).map(Number);else if(/^[-\d.eE+]+$/.test(p[0])&&p.length>=3)v.push(+p[0],+p[1],+p[2])});
  if(!n||v.length<n*n*n*3)throw new Error("Not a 3D .cube LUT");const N=Math.min(n,33),u8=new Uint8Array(N*N*N*3);const at=(r,g,b,k)=>v[((b*n+g)*n+r)*3+k];
  for(let b=0;b<N;b++)for(let g=0;g<N;g++)for(let r=0;r<N;r++){const fr=r*(n-1)/(N-1),fg=g*(n-1)/(N-1),fb=b*(n-1)/(N-1),r0=Math.floor(fr),g0=Math.floor(fg),b0=Math.floor(fb),r1=Math.min(n-1,r0+1),g1=Math.min(n-1,g0+1),b1=Math.min(n-1,b0+1),dr=fr-r0,dg=fg-g0,db=fb-b0;
    for(let k=0;k<3;k++){const c00=at(r0,g0,b0,k)*(1-dr)+at(r1,g0,b0,k)*dr,c10=at(r0,g1,b0,k)*(1-dr)+at(r1,g1,b0,k)*dr,c01=at(r0,g0,b1,k)*(1-dr)+at(r1,g0,b1,k)*dr,c11=at(r0,g1,b1,k)*(1-dr)+at(r1,g1,b1,k)*dr;
      const val=(c00*(1-dg)+c10*dg)*(1-db)+(c01*(1-dg)+c11*dg)*db;u8[((b*N+g)*N+r)*3+k]=Math.round(clamp((val-dmin[k])/((dmax[k]-dmin[k])||1),0,1)*255)}}return{n:N,u8}}
const b64=u=>{let s="";for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let lutSub=null;function watchLuts(){if(lutSub||!db)return;lutSub=db.collection("luts").onSnapshot(s=>{s.docs.forEach(d=>{const x=d.data();if(!LUTS[d.id]&&x&&x.data)LUTS[d.id]={n:x.n,u8:unb64(x.data),name:x.name}});requestDraw();if(E.page==="color")renderColorPage(true)},()=>{})}
const lutIn=document.createElement("input");lutIn.type="file";lutIn.accept=".cube";lutIn.className="sr";document.body.appendChild(lutIn);
lutIn.addEventListener("change",async()=>{const f=lutIn.files&&lutIn.files[0];lutIn.value="";if(!f)return;try{const L=parseCube(await f.text());const id=uid("lut");L.name=f.name.replace(/\.cube$/i,"");LUTS[id]=L;
  if(db)await db.collection("luts").doc(id).set({name:L.name,n:L.n,data:b64(L.u8)}).catch(saveErr);edit(()=>selClips().filter(c=>c.type==="video"||c.type==="image").forEach(c=>{c.lut=id;c.lutMix=1}));toast("LUT LOADED",L.name+" ("+L.n+"³) applied to the selected clips.");$("#insp").dataset.k="";renderColorPage()}
  catch(e){toast("LUT",(e&&e.message)||"Couldn’t read that .cube file.")}});

/* hook the compositor: grade on the GPU when possible */
const _hasGrade=hasGrade;hasGrade=function(c){return _hasGrade(c)||(!E.noGrade&&(hasCurves(c)||!!(c.lut&&LUTS[c.lut])||!!c.lgg))};
window.addEventListener("DOMContentLoaded",()=>setTimeout(watchLuts,1600));

/* ---------- Color page: wheels, curves, LUT ---------- */
E.cch="m";
const _rcp=renderColorPage;renderColorPage=function(soft){_rcp(soft);const box=$("#insp");const c=selClips().find(x=>x.type==="video"||x.type==="image");if(!c)return;
  if(box.querySelector("#curv")){if(soft){drawCurves(c);placeWheels(c)}return}
  const prim=[...box.querySelectorAll(".grp")].find(g=>/Primaries/.test(g.textContent));if(!prim)return;const lg=c.lgg||{};
  prim.insertAdjacentHTML("beforebegin",`<div class="grp"><span>Color wheels · lift / gamma / gain</span><button class="reset" data-wreset="1">Reset</button></div>
    <div class="wheels">${["lift","gamma","gain"].map(k=>`<div class="wh"><div class="bal sm" data-wheel="${k}" title="${k[0].toUpperCase()+k.slice(1)}: drag to tint ${k==="lift"?"shadows":k==="gamma"?"midtones":"highlights"}"><i></i></div><input type="range" min="-1" max="1" step=".01" value="${(lg[k]||[0,0,0])[2]}" data-wm="${k}" aria-label="${k} master"><span>${k[0].toUpperCase()+k.slice(1)}</span></div>`).join("")}</div>
    <div class="grp"><span>Curves</span><span class="seg cseg">${[["m","RGB"],["r","R"],["g","G"],["b","B"]].map(([k,l])=>`<button data-cch="${k}" aria-pressed="${E.cch===k}">${l}</button>`).join("")}</span></div>
    <div class="curvw"><canvas id="curv" width="480" height="300" aria-label="Curves editor: click to add a point, drag to move, double-click to remove"></canvas><button class="reset" data-creset="1">Reset curve</button></div>
    <div class="grp"><span>LUT</span><button class="reset" data-lutimp="1">Import .cube…</button></div>
    <div class="cprop wide"><label for="cl-lut">Applied</label><select id="cl-lut" data-lutsel="1"><option value="">None</option>${Object.entries(LUTS).map(([id,L])=>`<option value="${id}" ${c.lut===id?"selected":""}>${esc(L.name||"LUT")} (${L.n}³)</option>`).join("")}</select></div>
    ${c.lut?row("LUT mix","lutMix",c.lutMix==null?1:c.lutMix,0,1,.01):""}`);
  drawCurves(c);placeWheels(c);bindCurves();bindWheels();if(!glOK())prim.insertAdjacentHTML("beforebegin",`<div style="padding:0 12px;font-size:11px;color:var(--warn)">This browser has no WebGL, so wheels, curves and LUTs are saved but only preview after export elsewhere.</div>`)};
function curPts(c){const k=(c.curves||{})[E.cch];return k&&k.length>1?k.map(p=>p.slice()):[[0,0],[1,1]]}
function drawCurves(c){const cv=$("#curv");if(!cv)return;const x=cv.getContext("2d"),W=cv.width,H=cv.height;x.clearRect(0,0,W,H);x.fillStyle="#0e0e10";x.fillRect(0,0,W,H);x.strokeStyle="#ffffff14";x.lineWidth=1;
  for(let i=1;i<4;i++){x.beginPath();x.moveTo(i*W/4,0);x.lineTo(i*W/4,H);x.moveTo(0,i*H/4);x.lineTo(W,i*H/4);x.stroke()}x.strokeStyle="#ffffff22";x.beginPath();x.moveTo(0,H);x.lineTo(W,0);x.stroke();
  const col={m:"#e6e6ea",r:"#ff5a5a",g:"#4fd47a",b:"#5a8cff"};["r","g","b","m"].forEach(ch=>{const pts=(c.curves||{})[ch];if(ch!==E.cch&&isIdent(pts))return;const tb=curveTable(pts);x.strokeStyle=col[ch]+(ch===E.cch?"":"55");x.lineWidth=ch===E.cch?2.5:1.5;x.beginPath();for(let i=0;i<256;i++){const px=i/255*W,py=H-tb[i]/255*H;i?x.lineTo(px,py):x.moveTo(px,py)}x.stroke()});
  curPts(c).forEach(([a,b])=>{x.fillStyle="#fff";x.beginPath();x.arc(a*W,H-b*H,6,0,7);x.fill();x.strokeStyle="#000";x.lineWidth=1.5;x.stroke()})}
function bindCurves(){const cv=$("#curv");if(!cv||cv.dataset.b)return;cv.dataset.b=1;let drag=-1,snap=null;
  const pos=e=>{const r=cv.getBoundingClientRect();return[clamp((e.clientX-r.left)/r.width,0,1),clamp(1-(e.clientY-r.top)/r.height,0,1)]};
  const setPts=pts=>{selClips().filter(x=>x.type==="video"||x.type==="image").forEach(x=>{x.curves=Object.assign({},x.curves,{[E.cch]:pts.map(p=>[+p[0].toFixed(4),+p[1].toFixed(4)])})});drawCurves(selClips()[0]);requestDraw()};
  cv.addEventListener("pointerdown",e=>{const c=selClips()[0];if(!c)return;const[x,y]=pos(e);const pts=curPts(c);const r=cv.getBoundingClientRect();let i=pts.findIndex(p=>Math.hypot((p[0]-x)*r.width,(p[1]-y)*r.height)<10);
    snap=JSON.stringify(E.tl);if(i<0){pts.push([x,y]);pts.sort((a,b)=>a[0]-b[0]);i=pts.findIndex(p=>p[0]===x&&p[1]===y);setPts(pts)}drag=i;cv.setPointerCapture(e.pointerId)});
  cv.addEventListener("pointermove",e=>{if(drag<0)return;const c=selClips()[0];const pts=curPts(c);let[x,y]=pos(e);if(drag===0)x=0;else if(drag===pts.length-1)x=1;else x=clamp(x,pts[drag-1][0]+.01,pts[drag+1][0]-.01);pts[drag]=[x,y];setPts(pts)});
  cv.addEventListener("pointerup",()=>{if(drag<0)return;drag=-1;pushUndo(snap);normalize();commit();edTimeline()});
  cv.addEventListener("dblclick",e=>{const c=selClips()[0];if(!c)return;const[x,y]=pos(e);const pts=curPts(c);const r=cv.getBoundingClientRect();const i=pts.findIndex(p=>Math.hypot((p[0]-x)*r.width,(p[1]-y)*r.height)<10);if(i>0&&i<pts.length-1){pushUndo();pts.splice(i,1);setPts(pts);normalize();commit()}})}
function placeWheels(c){const lg=c.lgg||{};document.querySelectorAll("[data-wheel]").forEach(w=>{const v=lg[w.dataset.wheel]||[0,0,0];const i=w.querySelector("i");i.style.left=(50+v[0]*42)+"%";i.style.top=(50-v[1]*42)+"%"})}
function bindWheels(){document.querySelectorAll("[data-wheel]").forEach(w=>{if(w.dataset.b)return;w.dataset.b=1;let snap=null;const k=w.dataset.wheel;
  const set=e=>{const r=w.getBoundingClientRect();let x=((e.clientX-r.left)/r.width-.5)/.42,y=-((e.clientY-r.top)/r.height-.5)/.42;const L=Math.hypot(x,y);if(L>1){x/=L;y/=L}
    selClips().filter(c=>c.type==="video"||c.type==="image").forEach(c=>{c.lgg=Object.assign({},c.lgg);const o=c.lgg[k]||[0,0,0];c.lgg[k]=[+x.toFixed(3),+y.toFixed(3),o[2]];delete c.look});placeWheels(selClips()[0]);requestDraw()};
  w.addEventListener("pointerdown",e=>{snap=JSON.stringify(E.tl);w.setPointerCapture(e.pointerId);set(e)});w.addEventListener("pointermove",e=>{if(snap)set(e)});w.addEventListener("pointerup",()=>{if(!snap)return;pushUndo(snap);snap=null;normalize();commit()})})}
document.addEventListener("input",e=>{const el=e.target;if(!el.dataset||!el.dataset.wm)return;const k=el.dataset.wm;if(!E.wmU){pushUndo();E.wmU=true}selClips().filter(c=>c.type==="video"||c.type==="image").forEach(c=>{c.lgg=Object.assign({},c.lgg);const o=c.lgg[k]||[0,0,0];c.lgg[k]=[o[0],o[1],+el.value]});requestDraw();clearTimeout(E.wmT);E.wmT=setTimeout(()=>{E.wmU=false;commit()},300)});
document.addEventListener("change",e=>{const el=e.target;if(el.dataset&&el.dataset.lutsel!=null){const v=el.value;edit(()=>selClips().filter(c=>c.type==="video"||c.type==="image").forEach(c=>{if(v){c.lut=v;if(c.lutMix==null)c.lutMix=1}else delete c.lut}));$("#insp").dataset.k="";renderColorPage()}});
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.cch){E.cch=b.dataset.cch;document.querySelectorAll("[data-cch]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.cch===E.cch));drawCurves(selClips()[0])}
  else if(b.dataset.creset){edit(()=>selClips().forEach(c=>{if(c.curves){c.curves=Object.assign({},c.curves);delete c.curves[E.cch]}}));drawCurves(selClips()[0])}
  else if(b.dataset.wreset){edit(()=>selClips().forEach(c=>{delete c.lgg}));$("#insp").dataset.k="";renderColorPage()}
  else if(b.dataset.lutimp)lutIn.click()});
