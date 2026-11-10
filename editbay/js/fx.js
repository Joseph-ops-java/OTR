/* Edit Bay — effects and transitions. More transitions; a stackable effects list per clip (c.fx=[{t,a}]);
   crop, flip, border/rounded corners/shadow for picture-in-picture; blend modes; a GPU chroma key; an Effects tab in the Browser. */

/* ---------- transitions ---------- */
TRANS.push(["iris","Iris"],["clock","Clock Wipe"],["blurx","Blur Dissolve"],["spin","Spin"],["glitch","Glitch"],["burn","Film Burn"],["pushup","Push Up"],["pushdown","Push Down"],["doors","Doors"],["blinds","Blinds"],["zoomout","Zoom Out"]);
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const _transition=transition;transition=function(ctx,type,A,B,p){const W=E.tl.w,H=E.tl.h,e=ease(p);ctx.save();
  switch(type){
    case"iris":{ctx.drawImage(A,0,0);ctx.beginPath();ctx.arc(W/2,H/2,e*Math.hypot(W,H)/2,0,7);ctx.clip();ctx.drawImage(B,0,0);break}
    case"clock":{ctx.drawImage(A,0,0);ctx.beginPath();ctx.moveTo(W/2,H/2);ctx.arc(W/2,H/2,Math.hypot(W,H),-Math.PI/2,-Math.PI/2+e*Math.PI*2);ctx.closePath();ctx.clip();ctx.drawImage(B,0,0);break}
    case"blurx":{const bl=Math.sin(p*Math.PI)*24;if(FILTER_OK)ctx.filter=`blur(${bl}px)`;ctx.drawImage(A,0,0);ctx.globalAlpha=e;ctx.drawImage(B,0,0);break}
    case"spin":{const out=p<.5;const k=out?ease(p*2):1-ease(p*2-1);ctx.translate(W/2,H/2);ctx.rotate((out?1:-1)*k*Math.PI*.6);const s=1+k*.6;ctx.scale(s,s);if(FILTER_OK)ctx.filter=`blur(${k*12}px)`;ctx.drawImage(out?A:B,-W/2,-H/2);break}
    case"glitch":{const S=p<.5?A:B,amt=Math.sin(p*Math.PI);ctx.drawImage(S,0,0);const n=14,f=Math.floor(p*30);for(let i=0;i<n;i++){if(hash(f*31+i)>amt*.9)continue;const y=hash(f*7+i)*H,h=H*(.01+hash(i+f)*.06),dx=(hash(f+i*3)-.5)*W*.25*amt;ctx.drawImage(hash(i+f*5)>.5?A:B,0,y,W,h,dx,y,W,h)}
      ctx.globalCompositeOperation="lighter";ctx.globalAlpha=.25*amt;ctx.fillStyle=hash(f)>.5?"#f0f":"#0ff";ctx.fillRect(0,H*hash(f*13),W,H*.03);break}
    case"burn":{ctx.drawImage(p<.5?A:B,0,0);const k=Math.sin(p*Math.PI);ctx.globalCompositeOperation="screen";const g=ctx.createRadialGradient(W*(.2+.6*p),H*.4,0,W*(.2+.6*p),H*.4,Math.max(W,H)*.9);g.addColorStop(0,`rgba(255,240,200,${k})`);g.addColorStop(.35,`rgba(255,140,40,${k*.9})`);g.addColorStop(1,"rgba(120,20,0,0)");ctx.fillStyle=g;ctx.fillRect(0,0,W,H);break}
    case"pushup":{ctx.drawImage(A,0,-e*H);ctx.drawImage(B,0,(1-e)*H);break}
    case"pushdown":{ctx.drawImage(A,0,e*H);ctx.drawImage(B,0,-(1-e)*H);break}
    case"doors":{ctx.drawImage(B,0,0);ctx.drawImage(A,0,0,W/2,H,-e*W/2,0,W/2,H);ctx.drawImage(A,W/2,0,W/2,H,W/2+e*W/2,0,W/2,H);break}
    case"blinds":{ctx.drawImage(A,0,0);const n=10,h=H/n;ctx.beginPath();for(let i=0;i<n;i++)ctx.rect(0,i*h,W,h*e);ctx.clip();ctx.drawImage(B,0,0);break}
    case"zoomout":{const sa=1-e*.5;ctx.save();ctx.translate(W/2,H/2);ctx.scale(sa,sa);ctx.globalAlpha=1-e;ctx.drawImage(A,-W/2,-H/2);ctx.restore();ctx.globalAlpha=e;ctx.translate(W/2,H/2);const sb=1.2-.2*e;ctx.scale(sb,sb);ctx.drawImage(B,-W/2,-H/2);break}
    default:ctx.restore();return _transition(ctx,type,A,B,p)}
  ctx.restore()};

/* ---------- placement: crop, flip, rounded corners, border, shadow ---------- */
place=function(ctx,src,vw,vh,c,t){const W=E.tl.w,H=E.tl.h;let s=(c.fit==="fill"?Math.max(W/vw,H/vh):Math.min(W/vw,H/vh))*kv(c,"scale",t);if(c.kb&&t!=null){const k=clamp((t-c.start)/cdur(c),0,1);s*=1+.12*k}
  const dw=vw*s,dh=vh*s,cx=W/2+kv(c,"x",t)*W,cy=H/2+kv(c,"y",t)*H,rot=kv(c,"rot",t);ctx.translate(cx,cy);if(rot)ctx.rotate(rot*Math.PI/180);if(c.flipH||c.flipV)ctx.scale(c.flipH?-1:1,c.flipV?-1:1);
  const L=clamp(c.cropL||0,0,.48),R=clamp(c.cropR||0,0,.48),T=clamp(c.cropT||0,0,.48),Bm=clamp(c.cropB||0,0,.48);const x0=-dw/2+L*dw,y0=-dh/2+T*dh,w=dw*(1-L-R),h=dh*(1-T-Bm);
  const rad=(c.bdr||0)*Math.min(w,h)*.5,bw=(c.bdw||0)*H;
  if(c.shd>0){ctx.save();ctx.shadowColor=`rgba(0,0,0,${.35+c.shd*.4})`;ctx.shadowBlur=c.shd*H*.06;ctx.shadowOffsetY=c.shd*H*.015;ctx.fillStyle="#000";ctx.beginPath();ctx.roundRect?ctx.roundRect(x0,y0,w,h,rad):ctx.rect(x0,y0,w,h);ctx.fill();ctx.restore()}
  ctx.save();if(rad>0||L||R||T||Bm){ctx.beginPath();ctx.roundRect&&rad>0?ctx.roundRect(x0,y0,w,h,rad):ctx.rect(x0,y0,w,h);ctx.clip()}ctx.drawImage(src,-dw/2,-dh/2,dw,dh);ctx.restore();
  if(bw>0){ctx.lineWidth=bw;ctx.strokeStyle=c.bdc||"#ffffff";ctx.beginPath();ctx.roundRect&&rad>0?ctx.roundRect(x0+bw/2,y0+bw/2,w-bw,h-bw,Math.max(0,rad-bw/2)):ctx.rect(x0+bw/2,y0+bw/2,w-bw,h-bw);ctx.stroke()}};

/* ---------- chroma key (WebGL) ---------- */
const KEYG={ok:null};
function keyOK(){if(KEYG.ok!==null)return KEYG.ok;try{const cv=document.createElement("canvas");const gl=cv.getContext("webgl",{premultipliedAlpha:true});if(!gl)throw 0;
  const FSK=`precision mediump float;varying vec2 v;uniform sampler2D T;uniform vec3 key;uniform float sim,smo,spill;
    vec2 cc(vec3 c){return vec2(dot(c,vec3(-.169,-.331,.5)),dot(c,vec3(.5,-.419,-.081)));}
    void main(){vec4 t=texture2D(T,v);if(t.a<=0.){gl_FragColor=vec4(0.);return;}float d=distance(cc(t.rgb),cc(key));float a=smoothstep(sim,sim+smo+.001,d);
      vec3 c=t.rgb;float y=dot(c,vec3(.2126,.7152,.0722));if(spill>0.){float s=1.-smoothstep(sim,sim+smo+.25,d);c=mix(c,vec3(y),s*spill);} float o=t.a*a;gl_FragColor=vec4(c*o,o);}`;
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw 0;return o};const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,FSK));gl.linkProgram(p);gl.useProgram(p);
  const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const l=gl.getAttribLocation(p,"p");gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,2,gl.FLOAT,false,0,0);
  const tx=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tx);[gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,k,gl.LINEAR));[gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE));
  Object.assign(KEYG,{ok:true,cv,gl,u:{key:gl.getUniformLocation(p,"key"),sim:gl.getUniformLocation(p,"sim"),smo:gl.getUniformLocation(p,"smo"),spill:gl.getUniformLocation(p,"spill")}})}catch(e){KEYG.ok=false}return KEYG.ok}
function hexRGB(h){const n=parseInt(String(h||"#00ff00").slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}
function chromaKey(layer,c){if(!keyOK())return;const{gl,cv,u}=KEYG;if(cv.width!==layer.width||cv.height!==layer.height){cv.width=layer.width;cv.height=layer.height}gl.viewport(0,0,cv.width,cv.height);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,layer);const k=hexRGB(c.keyColor||"#00ff00");gl.uniform3f(u.key,k[0],k[1],k[2]);gl.uniform1f(u.sim,.04+(c.keySim==null?.35:c.keySim)*.25);gl.uniform1f(u.smo,(c.keySmooth==null?.3:c.keySmooth)*.15);gl.uniform1f(u.spill,c.keySpill==null?.5:c.keySpill);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);const x=layer.getContext("2d");x.save();x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.filter="none";x.globalCompositeOperation="copy";x.drawImage(cv,0,0);x.restore()}

/* ---------- stackable effects ---------- */
const FX={blur:["Blur","Soften the picture"],glow:["Glow","Bloom on the highlights"],rgb:["RGB split","Chromatic aberration"],pixel:["Pixelate","Mosaic blocks"],vhs:["VHS","Tape glitch, scanlines"],shake:["Camera shake","Handheld jitter"],pulse:["Beat pulse","Zoom bumps on beat markers"],leak:["Light leak","Warm film flare"],mirror:["Mirror","Left half mirrored"],invert:["Invert","Negative image"]};
const TMP=[];function tmp(i,W,H){let c=TMP[i];if(!c){c=document.createElement("canvas");TMP[i]=c}if(c.width!==W||c.height!==H){c.width=W;c.height=H}const x=c.getContext("2d");x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation="source-over";x.filter="none";x.imageSmoothingEnabled=true;x.clearRect(0,0,W,H);return[c,x]}
function applyFx(layer,c,t){const x=layer.getContext("2d"),W=layer.width,H=layer.height,fr=Math.floor((t||0)*fpsOf());
  const copy=()=>{const[k,kx]=tmp(0,W,H);kx.drawImage(layer,0,0);return k};const redraw=(fn)=>{const k=copy();x.save();x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation="copy";fn(k);x.restore()};
  for(const f of c.fx||[]){const a=clamp(f.a==null?.5:f.a,0,1);if(a<=0)continue;
    if(f.t==="blur"&&FILTER_OK)redraw(k=>{x.filter=`blur(${a*H*.02}px)`;x.drawImage(k,0,0)});
    else if(f.t==="invert"&&FILTER_OK)redraw(k=>{x.filter=`invert(${a})`;x.drawImage(k,0,0)});
    else if(f.t==="glow"&&FILTER_OK){const[g,gx]=tmp(1,W,H);gx.filter=`blur(${H*.02}px) brightness(1.4)`;gx.drawImage(layer,0,0);x.save();x.globalCompositeOperation="screen";x.globalAlpha=a*.9;x.drawImage(g,0,0);x.restore()}
    else if(f.t==="rgb"||f.t==="vhs"){const off=(f.t==="vhs"?.006:.012)*a*W*(f.t==="vhs"?1+hash(fr)*.6:1);const k=copy();const parts=[["#f00",-off],["#0f0",0],["#00f",off]];x.save();x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation="copy";x.fillStyle="rgba(0,0,0,0)";x.fillRect(0,0,W,H);x.restore();
      parts.forEach(([col,dx],i)=>{const[ch,chx]=tmp(2+i,W,H);chx.drawImage(k,0,0);chx.globalCompositeOperation="multiply";chx.fillStyle=col;chx.fillRect(0,0,W,H);chx.globalCompositeOperation="destination-in";chx.drawImage(k,0,0);x.save();x.globalCompositeOperation="lighter";x.drawImage(ch,dx,0);x.restore()});
      if(f.t==="vhs"){const k2=copy();for(let i=0;i<6;i++){if(hash(fr*3+i)>.5)continue;const y=hash(fr+i*9)*H,h=H*(.004+hash(i*fr)*.02),dx=(hash(fr*7+i)-.5)*W*.05*a;x.drawImage(k2,0,y,W,h,dx,y,W,h)}
        x.save();x.globalCompositeOperation="source-atop";x.globalAlpha=.18*a;x.fillStyle="#000";for(let y=0;y<H;y+=4)x.fillRect(0,y,W,1.5);x.restore()}}
    else if(f.t==="pixel"){const bs=Math.max(2,Math.round(a*H*.04));const[s2,sx]=tmp(1,Math.max(1,Math.round(W/bs)),Math.max(1,Math.round(H/bs)));sx.drawImage(layer,0,0,s2.width,s2.height);redraw(()=>{x.imageSmoothingEnabled=false;x.drawImage(s2,0,0,W,H)})}
    else if(f.t==="shake"){const dx=(hash(fr*1.7)-.5)*a*W*.04,dy=(hash(fr*2.3+5)-.5)*a*H*.04,r=(hash(fr*.9+2)-.5)*a*.02;redraw(k=>{x.translate(W/2+dx,H/2+dy);x.rotate(r);x.scale(1+a*.05,1+a*.05);x.drawImage(k,-W/2,-H/2)})}
    else if(f.t==="pulse"){const bs=(E.tl.markers||[]).filter(m=>m.kind==="beat"&&m.t<=t).map(m=>m.t);const last=bs.length?Math.max(...bs):-9;const k0=Math.exp(-(t-last)*9);if(k0>.01){const s=1+a*.12*k0;redraw(k=>{x.translate(W/2,H/2);x.scale(s,s);x.drawImage(k,-W/2,-H/2)})}}
    else if(f.t==="leak"){const k=copy();x.save();const ph=(t||0)*.35;const gx=W*(.5+.45*Math.sin(ph)),gy=H*(.3+.25*Math.cos(ph*1.3));const g=x.createRadialGradient(gx,gy,0,gx,gy,Math.max(W,H)*.7);g.addColorStop(0,`rgba(255,200,120,${.55*a})`);g.addColorStop(.4,`rgba(255,90,40,${.3*a})`);g.addColorStop(1,"rgba(255,40,0,0)");x.globalCompositeOperation="screen";x.fillStyle=g;x.fillRect(0,0,W,H);
      x.globalCompositeOperation="destination-in";x.drawImage(k,0,0);x.restore()}
    else if(f.t==="mirror"){x.save();x.setTransform(-1,0,0,1,W,0);x.drawImage(layer,0,0,W/2,H,0,0,W/2,H);x.restore()}}}
const _renderClipFx=renderClip;renderClip=function(ctx,c,t){_renderClipFx(ctx,c,t);if(c.type==="gap")return;if(c.keyOn&&!E.noGrade)chromaKey(ctx.canvas,c);if(c.fx&&c.fx.length&&!E.noGrade)applyFx(ctx.canvas,c,t)};
/* hasGrade must not hide keyed/effected clips from the GL path checks */

/* ---------- inspector: effects, crop & frame, keying, blend ---------- */
const BLENDS=[["source-over","Normal"],["screen","Screen"],["multiply","Multiply"],["overlay","Overlay"],["lighter","Add"],["soft-light","Soft light"],["darken","Darken"],["lighten","Lighten"],["difference","Difference"]];
const _eciFx=edClipInspector;edClipInspector=function(box){_eciFx(box);const c=selClips()[0];if(!c||c.type==="audio"||c.type==="gap"||box.querySelector("#fxsec"))return;
  const anchor=[...box.querySelectorAll(":scope > .grp")].find(g=>/^Fades/.test(g.textContent))||box.querySelector(":scope > div[style*='padding:12px']");if(!anchor)return;const vis=c.type!=="title";
  const fx=c.fx||[];const html=`<div class="grp" id="fxsec"><span>Effects${fx.length?" · "+fx.length:""}</span></div>
    ${fx.map((f,i)=>`<div class="cprop fxrow"><label for="fx-${i}">${esc((FX[f.t]||[f.t])[0])}</label><input type="range" id="fx-${i}" data-fxa="${i}" min="0" max="1" step=".01" value="${f.a==null?.5:f.a}"><span class="ro">${Math.round((f.a==null?.5:f.a)*100)}%</span><button class="x" data-fxdel="${i}" aria-label="Remove ${esc((FX[f.t]||[f.t])[0])}">✕</button></div>`).join("")}
    <div class="cprop wide"><label for="fx-add">Add</label><select id="fx-add" data-fxadd="1"><option value="">Add an effect…</option>${Object.entries(FX).map(([k,[l,d]])=>`<option value="${k}">${l} · ${d}</option>`).join("")}</select></div>
    ${c.track!=="V1"?`<div class="cprop wide"><label for="cp-blend">Blend</label><select id="cp-blend" data-cp="blend">${BLENDS.map(([v,l])=>`<option value="${v}" ${(c.blend||"source-over")===v?"selected":""}>${l}</option>`).join("")}</select></div>`:""}
    ${vis?`<div class="grp"><span>Crop &amp; frame</span><button class="reset" data-cropreset="1">Reset</button></div>
    ${row("Crop left","cropL",c.cropL||0,0,.48,.005)}${row("Crop right","cropR",c.cropR||0,0,.48,.005)}${row("Crop top","cropT",c.cropT||0,0,.48,.005)}${row("Crop bottom","cropB",c.cropB||0,0,.48,.005)}
    ${row("Corners","bdr",c.bdr||0,0,1,.01)}${row("Border","bdw",c.bdw||0,0,.03,.001)}${row("Shadow","shd",c.shd||0,0,1,.01)}
    <div class="cprop wide"><label>Frame</label><span class="chips"><label><input type="color" id="cp-bdc" data-cp="bdc" value="${esc(c.bdc||"#ffffff")}" style="width:34px;height:20px;padding:0"> Border colour</label><label><input type="checkbox" id="cp-flipH" data-cp="flipH" ${c.flipH?"checked":""}> Flip ↔</label><label><input type="checkbox" id="cp-flipV" data-cp="flipV" ${c.flipV?"checked":""}> Flip ↕</label></span></div>
    <div class="grp"><span>Green screen</span></div>
    <div class="cprop wide"><label>Key</label><span class="chips"><label><input type="checkbox" id="cp-keyOn" data-cp="keyOn" ${c.keyOn?"checked":""}> Remove a colour</label><label><input type="color" id="cp-keyColor" data-cp="keyColor" value="${esc(c.keyColor||"#00ff00")}" style="width:34px;height:20px;padding:0"> Key colour</label><button type="button" class="btn sm" data-keypick="1" title="Click the colour to remove in the Viewer">Pick from Viewer</button></span></div>
    ${c.keyOn?row("Tolerance","keySim",c.keySim==null?.35:c.keySim,0,1,.01)+row("Softness","keySmooth",c.keySmooth==null?.3:c.keySmooth,0,1,.01)+row("Spill","keySpill",c.keySpill==null?.5:c.keySpill,0,1,.01):""}`:""}`;
  anchor.insertAdjacentHTML("beforebegin",html)};
document.addEventListener("input",e=>{const el=e.target;if(!el.dataset||el.dataset.fxa==null)return;const c=selClips()[0];if(!c||!c.fx)return;const i=+el.dataset.fxa;if(!E.fxU){pushUndo();E.fxU=true}c.fx[i].a=+el.value;const r=el.parentNode.querySelector(".ro");if(r)r.textContent=Math.round(el.value*100)+"%";requestDraw();clearTimeout(E.fxT);E.fxT=setTimeout(()=>{E.fxU=false;commit();edTimeline()},300)});
document.addEventListener("change",e=>{const el=e.target;if(!el.dataset)return;if(el.dataset.fxadd!=null&&el.value){addFx(el.value);}
  if(el.dataset.cp==="keyOn"||el.dataset.cp==="blend"){setTimeout(()=>{$("#insp").dataset.k="";renderInsp()},0)}});
function addFx(t,ids){const cs=ids?ids.map(clipById).filter(Boolean):selClips().filter(c=>c.type!=="audio"&&c.type!=="gap");if(!cs.length){toast("EFFECTS","Select a picture or title clip first.");return}
  edit(()=>cs.forEach(c=>{c.fx=(c.fx||[]).filter(f=>f.t!==t);c.fx.push({t,a:.5})}));$("#insp").dataset.k="";renderInsp();toast("EFFECT",(FX[t]||[t])[0]+" added to "+cs.length+" clip"+(cs.length>1?"s":""))}
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.fxdel!=null){const c=selClips()[0];if(!c||!c.fx)return;const i=+b.dataset.fxdel;edit(()=>{c.fx.splice(i,1)});$("#insp").dataset.k="";renderInsp()}
  else if(b.dataset.cropreset){edit(()=>selClips().forEach(c=>["cropL","cropR","cropT","cropB","bdr","bdw","shd","flipH","flipV"].forEach(k=>delete c[k])));$("#insp").dataset.k="";renderInsp()}
  else if(b.dataset.keypick){E.keyPick=true;toast("PICK A COLOUR","Click the colour to remove in the Viewer.");document.body.classList.add("picking")}});
document.addEventListener("click",e=>{if(!E.keyPick)return;const cv=e.target.closest("#pgm");if(!cv)return;e.stopImmediatePropagation();E.keyPick=false;document.body.classList.remove("picking");
  const r=cv.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*cv.width),y=Math.floor((e.clientY-r.top)/r.height*cv.height);const c=selClips()[0];if(!c)return;
  const prev=c.keyOn;c.keyOn=false;E.noGrade=true;drawFrame();E.noGrade=false;c.keyOn=prev;const d=cv.getContext("2d").getImageData(x,y,1,1).data;const hex="#"+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,"0")).join("");
  edit(()=>{c.keyOn=true;c.keyColor=hex});$("#insp").dataset.k="";renderInsp();toast("KEY COLOUR",hex+" will be removed. Adjust Tolerance and Softness to clean the edge.")},true);

/* ---------- Browser: Effects tab ---------- */
(function(){const t=$("#btabs");if(t&&!t.querySelector('[data-btab="fx"]'))t.insertAdjacentHTML("beforeend",`<button data-btab="fx" aria-pressed="false">Effects</button>`)})();
const _rbFx=renderBrowser;renderBrowser=function(){if(E.page==="edit"&&!E.angleView&&state.btab==="fx"){const ix=$("aside.index"),bb=$("#bbody");if(ix)ix.style.display="none";if(bb)bb.style.display="flex";document.querySelectorAll("[data-btab]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.btab==="fx"));renderFxBrowser();return}_rbFx()};
function renderFxBrowser(){$("#bacts").innerHTML="";const sel=selClips();const v1sel=sel.find(c=>c.track==="V1"&&v1Prev(c));
  $("#bbody").innerHTML=`<div class="fxb"><div class="fxh">Transitions <small>${v1sel?"apply to the cut before the selected clip":"select a storyline clip to apply"}</small></div>
    <div class="fxg">${TRANS.map(([k,l])=>`<button class="fxt tr-${k}" data-applytr="${k}" title="${esc(l)}"><span class="fxp"></span>${esc(l)}</button>`).join("")}</div>
    <div class="fxh">Effects <small>${sel.length?"apply to the selected clip"+(sel.length>1?"s":""):"select clips to apply"}</small></div>
    <div class="fxg">${Object.entries(FX).map(([k,[l,d]])=>`<button class="fxt ef-${k}" data-applyfx="${k}" title="${esc(d)}"><span class="fxp"></span>${esc(l)}</button>`).join("")}</div>
    <div class="fxh">Looks</div><div class="fxg">${Object.entries(LOOKS).filter(([k])=>k!=="none").map(([k,L])=>`<button class="fxt" data-fxlook="${k}"><span class="fxp" style="background:${lookSwatch(L)}"></span>${esc(L[0])}</button>`).join("")}</div></div>`}
document.addEventListener("click",e=>{const lk=e.target.closest("[data-fxlook]");if(lk){const k=lk.dataset.fxlook,L=LOOKS[k];const cs=selClips().filter(c=>c.type==="video"||c.type==="image");if(!cs.length){toast("LOOKS","Select a video or image clip first.");return}edit(()=>cs.forEach(c=>{Object.assign(c,clone(L[1]));c.look=k}));toast("LOOK",L[0]+" on "+cs.length+" clip"+(cs.length>1?"s":""));return}
  const b=e.target.closest("[data-applytr],[data-applyfx]");if(!b)return;
  if(b.dataset.applyfx){addFx(b.dataset.applyfx);return}const k=b.dataset.applytr;const cs=selClips().filter(c=>c.track==="V1"&&v1Prev(c));
  const tgt=cs.length?cs:[v1().find(c=>c.start>E.t-1e-6&&v1Prev(c))||v1().filter(c=>v1Prev(c)).pop()].filter(Boolean);if(!tgt.length){toast("TRANSITIONS","Put two clips on the storyline first.");return}
  edit(()=>tgt.forEach(c=>{c.tr={type:k,d:(c.tr&&c.tr.d)||.6}}));toast("TRANSITION",(TRANS.find(x=>x[0]===k)||[0,k])[1]+" on "+tgt.length+" cut"+(tgt.length>1?"s":""))},true);
const _selRender=edRefresh;edRefresh=function(){_selRender();if(state.btab==="fx"&&E.page==="edit")renderFxBrowser()};

/* ---------- Claude can use effects too ---------- */
const _applyOpsFx=applyOps;applyOps=function(ops,alias){const rest=[],done=[],skipped=[];(ops||[]).forEach(o=>{if(o&&o.op==="effect"){const c=clipById(alias[o.id]||o.id);if(c&&(FX[o.type]||o.type==="key")){if(o.type==="key"){c.keyOn=true;if(o.color)c.keyColor=o.color}else{c.fx=(c.fx||[]).filter(f=>f.t!==o.type);if(o.amount!==0)c.fx.push({t:o.type,a:clamp(+o.amount||.5,0,1)})}done.push("effect")}else skipped.push("effect")}
  else if(o&&o.op==="frame"){const c=clipById(alias[o.id]||o.id);if(c){["cropL","cropR","cropT","cropB","bdr","bdw","shd","bdc","flipH","flipV","blend"].forEach(k=>{if(o.set&&o.set[k]!==undefined)c[k]=o.set[k]});done.push("frame")}else skipped.push("frame")}else rest.push(o)});
  const r=_applyOpsFx(rest,alias);return{done:done.concat(r.done),skipped:skipped.concat(r.skipped)}};
