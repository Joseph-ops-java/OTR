/* Edit Bay — pro layer. Pages after DaVinci Resolve (Edit · Color · Audio · Deliver), scopes, colour panel, mixer with meters,
   auto-duck, beat detection, SRT captions, safe zones, slip readout, and Claude Assist: Claude edits the timeline from inside the page. */
let sampleNS=null,sampleCaps=null,assistBusy=false;
E.asLog=[];E.scope="wave";E.grade=null;

/* ---------- pages ---------- */
const PAGES=[["edit","edit","Edit"],["color","color","Color"],["audio","audio","Audio"],["deliver","deliver","Deliver"]];
function renderPagebar(){const b=$("#pagebar");if(!b)return;b.innerHTML=PAGES.map(([k,i,l],n)=>`<button data-page="${k}" aria-pressed="${E.page===k}" title="${l} page (⌘${n+1})">${ic(i)}${l}</button>`).join("")+`<span class="ptools"><button class="ai" id="createBtn" title="Create a video from a prompt: Claude writes the script and builds the edit from your footage">${ic("film")}Create</button><button class="ai" id="autoBtn" title="Auto Cut: cut your clips to the music, with Claude choosing the story">${ic("auto")}Auto Cut</button><button id="mcBtn" title="New multicam clip from 2–4 camera angles">${ic("multicam")}Multicam</button><button id="angBtn" title="Show or hide the angle viewer">${ic("angles")}Angles</button><button id="silBtn" title="Remove pauses from clips with dialogue">${ic("pauses")}Pauses</button></span><span class="hint">Press ? for shortcuts</span>`}
function setPage(p){if(!PAGES.find(x=>x[0]===p))return;E.page=p;
  if(p==="color"&&E.tl&&!selClips().some(c=>c.type==="video"||c.type==="image")){const c=E.tl.clips.filter(c=>(c.type==="video"||c.type==="image")&&E.t>=c.start&&E.t<cend(c)).sort((a,b)=>a.track==="V1"?-1:1)[0]||E.tl.clips.find(c=>c.type==="video"||c.type==="image");if(c)E.sel=new Set([c.id])}
  if(p==="edit"&&state.itab==="color")state.itab="info";
  $("#bbody").innerHTML="";$("#insp").dataset.k="";render();renderPagebar();if(p==="audio")meterLoop();if(p==="color")scopeLoop()}

const _renderBrowser=renderBrowser;
renderBrowser=function(){const tabs=$("#btabs");if(tabs)tabs.hidden=E.page!=="edit";if(E.page==="edit")return _renderBrowser();renderPagePane()};
const _renderMediaBrowser=renderMediaBrowser;
renderMediaBrowser=function(){if(E.page!=="edit")return renderPagePane();_renderMediaBrowser();
  const b=$("#bacts");if(b&&!b.querySelector("#srtBtn"))b.insertAdjacentHTML("afterbegin",`<button class="btn" id="srtBtn" title="Import captions from an .srt or .vtt file onto V3">Captions</button>`)};
const _renderCards=renderCards;renderCards=function(){if(!$("#cards"))return;_renderCards()};
const _renderLibs=renderLibs;renderLibs=function(){if(!$("#libs"))return;_renderLibs()};
const _renderItabs=renderItabs;
renderItabs=function(){if(E.page==="color"){$("#itabs").innerHTML=`<button aria-pressed="true">Color</button>`;return}_renderItabs()};
const _renderInsp=renderInsp;
renderInsp=function(){const box=$("#insp");box.classList.toggle("chatmode",E.page!=="color"&&state.itab==="claude"&&!!cur());if(E.page==="color")return renderColorPage();_renderInsp();if(state.itab==="claude"&&cur())assistPanel()};
function renderPagePane(){const p=cur(),body=$("#bbody");if(!p){body.innerHTML=`<div class="empty">Pick a project first.</div>`;return}
  if(E.page==="color")return scopesPane(body);if(E.page==="audio")return mixerPane(body);if(E.page==="deliver")return deliverPane(body)}

/* ---------- scopes (Resolve-style) ---------- */
function scopesPane(body){$("#bacts").innerHTML=`<span class="seg">${[["wave","Waveform"],["parade","Parade"],["vec","Vectorscope"],["hist","Histogram"]].map(([k,l])=>`<button data-scope="${k}" aria-pressed="${E.scope===k}">${l}</button>`).join("")}</span>`;
  if(!body.querySelector("#scope"))body.innerHTML=`<div class="scopes"><canvas id="scope"></canvas><div class="sbar"><span id="scopeInfo">Live from the Viewer</span><span>0–100 IRE</span></div></div>`;drawScope()}
let scopeT=0;function scopeLoop(){clearInterval(scopeT);scopeT=setInterval(()=>{if(E.page!=="color"){clearInterval(scopeT);return}if(!document.hidden)drawScope()},140)}
const SMALL=document.createElement("canvas");
function drawScope(){const sc=$("#scope"),pg=$("#pgm");if(!sc||!pg||!E.tl)return;const W=sc.clientWidth|0,H=sc.clientHeight|0;if(W<20||H<20)return;if(sc.width!==W||sc.height!==H){sc.width=W;sc.height=H}
  const sw=160,sh=Math.max(8,Math.round(sw*pg.height/pg.width));SMALL.width=sw;SMALL.height=sh;const sx=SMALL.getContext("2d",{willReadFrequently:true});let d;
  try{sx.drawImage(pg,0,0,sw,sh);d=sx.getImageData(0,0,sw,sh).data}catch(e){const i=$("#scopeInfo");if(i)i.textContent="Scopes can’t read this media.";return}
  const x=sc.getContext("2d");x.fillStyle="#0b0b0c";x.fillRect(0,0,W,H);x.strokeStyle="#ffffff14";x.fillStyle="#ffffff40";x.font="10px "+getComputedStyle(document.body).getPropertyValue("--mono");x.lineWidth=1;
  const m=8;
  if(E.scope==="vec"){const R=Math.min(W,H)/2-m,cx=W/2,cy=H/2;x.beginPath();x.arc(cx,cy,R,0,7);x.stroke();x.beginPath();x.moveTo(cx-R,cy);x.lineTo(cx+R,cy);x.moveTo(cx,cy-R);x.lineTo(cx,cy+R);x.stroke();
    x.strokeStyle="#f4c43066";x.beginPath();x.moveTo(cx,cy);x.lineTo(cx+Math.cos(-2.15)*R,cy+Math.sin(-2.15)*R);x.stroke();x.fillText("skin",cx+Math.cos(-2.15)*R-26,cy+Math.sin(-2.15)*R);
    [["R",.5,-.081],["G",-.331,-.419],["B",-.169,.5],["Y",-.5,.081],["C",-.169,-.5],["M",.331,.419]].forEach(([l,cb,cr])=>{x.fillText(l,cx+cr*R*1.7-3,cy-cb*R*1.7+3)});
    x.fillStyle="rgba(140,255,170,.16)";for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];const cb=-.169*r-.331*g+.5*b,cr=.5*r-.419*g-.081*b;x.fillRect(cx+cr/128*R,cy-cb/128*R,1.5,1.5)}return}
  if(E.scope==="hist"){const bins=[new Uint32Array(64),new Uint32Array(64),new Uint32Array(64)];for(let i=0;i<d.length;i+=4){bins[0][d[i]>>2]++;bins[1][d[i+1]>>2]++;bins[2][d[i+2]>>2]++}
    const mx=Math.max(1,...bins.flatMap(b=>[...b]));x.globalCompositeOperation="lighter";["#ff4d4d","#3fd16b","#4d8dff"].forEach((col,k)=>{x.fillStyle=col+"aa";const bw=(W-2*m)/64;bins[k].forEach((v,i)=>{const h=Math.sqrt(v/mx)*(H-2*m);x.fillRect(m+i*bw,H-m-h,bw,h)})});x.globalCompositeOperation="source-over";return}
  [0,25,50,75,100].forEach(v=>{const y=m+(1-v/100)*(H-2*m);x.beginPath();x.moveTo(m,y);x.lineTo(W-m,y);x.stroke();x.fillText(String(v),2,y-2)});
  const parade=E.scope==="parade",cols=parade?3:1,cw=(W-2*m)/cols;x.globalCompositeOperation="lighter";
  for(let k=0;k<cols;k++){x.fillStyle=parade?["rgba(255,80,80,.18)","rgba(70,230,120,.18)","rgba(80,140,255,.18)"][k]:"rgba(150,255,180,.16)";
    for(let i=0;i<d.length;i+=4){const px=(i/4)%sw;const v=parade?d[i+k]:(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2]);x.fillRect(m+k*cw+px/sw*cw,m+(1-v/255)*(H-2*m),Math.max(1,cw/sw),1.2)}}
  x.globalCompositeOperation="source-over"}

/* ---------- colour page (inspector) ---------- */
const GRADE_KEYS=["bri","con","sat","hue","temp","tint","fade","vig","grain","sepia","bw","look"];
function lookSwatch(L){const p=L[1];const h=p.bw?"#777,#111":p.temp>0?"#e9a25a,#1f3b44":p.temp<0?"#5a8be9,#0d1424":p.sat>0?"#ff4d6d,#2d6cff":p.tint>0?"#e8000a,#120406":p.fade?"#b9b2a6,#3e3c3a":"#9a9aa0,#2a2a2e";return`linear-gradient(135deg,${h})`}
function renderColorPage(soft){const box=$("#insp");const c=selClips().find(x=>x.type==="video"||x.type==="image");
  if(!c){box.dataset.k="";box.innerHTML=`<div class="empty">Select a video or image clip on the timeline to grade it. The Color page grades the clip under the playhead when you open it.</div>`;return}
  const key="color|"+c.id;if(soft&&box.dataset.k===key){syncInspectorValues(c,box);placeDot(c);return}
  if(box.dataset.k===key&&box.contains(document.activeElement)&&document.activeElement.matches("input,select"))return;box.dataset.k=key;
  const tl=E.tl;
  box.innerHTML=`<div class="ihead"><b>${esc(c.name||"Clip")}</b><span>${c.track} · ${esc(tcs(c.start))} · ${c.look?esc(LOOKS[c.look]?LOOKS[c.look][0]:c.look):"no look"}</span></div>
  <div class="grp"><span>Looks</span><button class="reset" data-lookbtn="none">Reset grade</button></div>
  <div class="looks">${Object.entries(LOOKS).filter(([k])=>k!=="none").map(([k,L])=>`<button class="look" data-lookbtn="${k}" aria-pressed="${c.look===k}"><span class="sw" style="background:${lookSwatch(L)}"></span>${esc(L[0])}</button>`).join("")}</div>
  <div class="grp"><span>Balance · temperature / tint</span><button class="reset" data-balreset="1">Reset</button></div>
  <div class="balwrap"><div class="bal" id="bal" title="Drag to warm/cool (left–right) and tint magenta/green (up–down)"><i id="baldot"></i></div><div class="balread"><span>Temp <b id="balT">${(c.temp||0).toFixed(2)}</b></span><span>Tint <b id="balN">${(c.tint||0).toFixed(2)}</b></span><span style="color:var(--dim);font-family:var(--ui);font-size:11px;max-width:120px">Right warms, left cools. Up adds magenta, down adds green.</span></div></div>
  <div class="grp"><span>Primaries</span></div>
  ${row("Exposure","bri",c.bri||0,-1,1,.01)}${row("Contrast","con",c.con||0,-1,1,.01)}${row("Saturation","sat",c.sat||0,-1,1,.01)}${row("Hue","hue",c.hue||0,-180,180,1,"°")}${row("Lift (fade)","fade",c.fade||0,0,.6,.01)}
  <div class="grp"><span>Texture</span></div>${row("Vignette","vig",c.vig||0,0,1,.01)}${row("Film grain","grain",c.grain||0,0,1,.01)}${row("Sepia","sepia",c.sepia||0,0,1,.01)}
  <div class="cprop wide"><label>Mono</label><span class="chips"><label><input type="checkbox" id="cp-bw" data-cp="bw" ${c.bw?"checked":""}> Black &amp; white</label></span></div>
  <div class="grp"><span>Grade tools</span></div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;padding:4px 12px"><button class="btn sm" data-gcopy="1">Copy grade</button><button class="btn sm" data-gpaste="1" ${E.grade?"":"disabled"}>Paste grade</button><button class="btn sm" data-gall="1" title="Use this grade on every video and image clip">Match all clips</button><button class="btn sm" id="cmpBtn2" title="Before/after split (⇧C)">${E.compare?"Hide before/after":"Before/after"}</button></div>
  <div class="grp"><span>Timeline</span></div>
  <div class="prow"><label for="cl-bars">Letterbox</label><select id="cl-bars" data-bars="1">${[[0,"None"],[2.39,"2.39 : 1 Scope"],[2,"2.00 : 1 Univisium"],[1.85,"1.85 : 1 Flat"]].map(([v,l])=>`<option value="${v}" ${+(tl.bars||0)===v?"selected":""}>${l}</option>`).join("")}</select></div>
  <div style="padding:10px 12px;font-size:11px;color:var(--dim)">Grades preview live in the Viewer and export with the cut. Scopes read the Viewer as you change them.</div>`;
  placeDot(c);bindBal()}
function placeDot(c){const d=$("#baldot");if(!d)return;d.style.left=(50+(c.temp||0)*42)+"%";d.style.top=(50-(c.tint||0)*42)+"%";const a=$("#balT"),b=$("#balN");if(a)a.textContent=(c.temp||0).toFixed(2);if(b)b.textContent=(c.tint||0).toFixed(2)}
function bindBal(){const b=$("#bal");if(!b)return;let snap=null;
  const set=e=>{const r=b.getBoundingClientRect();let tx=((e.clientX-r.left)/r.width-.5)/.42,ty=-((e.clientY-r.top)/r.height-.5)/.42;const L=Math.hypot(tx,ty);if(L>1){tx/=L;ty/=L}
    selClips().filter(c=>c.type==="video"||c.type==="image").forEach(c=>{c.temp=+tx.toFixed(3);c.tint=+ty.toFixed(3);delete c.look});placeDot(selClips()[0]);requestDraw()};
  b.addEventListener("pointerdown",e=>{snap=JSON.stringify(E.tl);b.setPointerCapture(e.pointerId);set(e)});b.addEventListener("pointermove",e=>{if(snap)set(e)});
  b.addEventListener("pointerup",()=>{if(!snap)return;pushUndo(snap);snap=null;normalize();commit();edTimeline()})}

/* ---------- audio page: mixer, meters, ducking ---------- */
const lin2db=v=>v>0?20*Math.log10(v):-Infinity,db2lin=d=>d<=-60?0:Math.pow(10,d/20);
function mixerPane(body){$("#bacts").innerHTML=`<button class="btn" data-duck="1" title="Lower A2 music wherever A1 dialogue plays">Duck music under dialogue</button>`;
  const strips=TRACKS.filter(t=>t[0]==="A"||t==="V1"||t==="V2").map(tr=>{const t=trk(tr),g=t.gain==null?1:t.gain;return`<div class="strip2"><span class="nm">${tr}</span><div class="fz"><canvas data-meter="${tr}" width="12" height="160"></canvas><input type="range" min="-60" max="12" step=".5" value="${Math.max(-60,lin2db(g)).toFixed(1)}" data-mxg="${tr}" aria-label="${tr} level"></div><span class="db" id="mxdb-${tr}">${g>0?lin2db(g).toFixed(1):"−∞"} dB</span><span class="ms"><button data-mxm="${tr}" class="${t.mute?"m":""}" title="Mute">M</button><button data-mxs="${tr}" class="${t.solo?"s":""}" title="Solo">S</button></span></div>`}).join("");
  const mg=E.tl&&E.tl.master!=null?E.tl.master:1;
  body.innerHTML=`<div class="mixer"><div class="strips">${strips}<div class="strip2 mst"><span class="nm">MAIN</span><div class="fz"><canvas data-meter="MAIN" width="12" height="160"></canvas><input type="range" min="-60" max="12" step=".5" value="${Math.max(-60,lin2db(mg)).toFixed(1)}" data-mxg="MAIN" aria-label="Main level"></div><span class="db" id="mxdb-MAIN">${lin2db(mg).toFixed(1)} dB</span><span class="db" id="rms">RMS —</span></div></div>
    <div class="mixfoot"><small>${AC?"Meters show peak dBFS while the cut plays.":"Press play once to start the meters."} Aim for dialogue peaks around −6 dB and music 15 dB under it.</small><button class="btn sm" data-clrbeats="1">Clear beat markers</button></div></div>`}
let meterRaf=0;const peakHold={};
function meterLoop(){cancelAnimationFrame(meterRaf);const buf=new Float32Array(1024);
  const tick=()=>{if(E.page!=="audio")return;document.querySelectorAll("canvas[data-meter]").forEach(cv=>{const tr=cv.dataset.meter;const an=tr==="MAIN"?MASTER_AN:(BUS[tr]||{}).an;let pk=0,rms=0;
      if(an&&E.playing){an.getFloatTimeDomainData(buf);for(let i=0;i<buf.length;i++){const a=Math.abs(buf[i]);if(a>pk)pk=a;rms+=buf[i]*buf[i]}rms=Math.sqrt(rms/buf.length)}
      const db=lin2db(pk),h=cv.height,w=cv.width,f=x=>clamp((x+60)/66,0,1);const ph=peakHold[tr]=Math.max((peakHold[tr]||-60)-.6,db);
      const x=cv.getContext("2d");x.clearRect(0,0,w,h);const lv=f(db)*h;const g=x.createLinearGradient(0,h,0,0);g.addColorStop(0,"#3fd16b");g.addColorStop(.75,"#3fd16b");g.addColorStop(.86,"#e5d23a");g.addColorStop(.92,"#ff4d3d");x.fillStyle=g;x.fillRect(0,h-lv,w,lv);
      x.fillStyle="#fff";x.fillRect(0,h-f(ph)*h,w,1.5);x.fillStyle="#ffffff30";[-6,-12,-24,-48].forEach(d=>x.fillRect(0,h-f(d)*h,w,1));
      if(tr==="MAIN"){const r=$("#rms");if(r)r.textContent="RMS "+(rms>0?lin2db(rms).toFixed(1):"—")}});meterRaf=requestAnimationFrame(tick)};tick()}
function duckMusic(){if(!E.tl)return;const voice=E.tl.clips.filter(c=>c.track==="A1"&&!c.off).map(c=>[c.start,cend(c)]).sort((a,b)=>a[0]-b[0]);
  const music=E.tl.clips.filter(c=>c.track==="A2");if(!voice.length||!music.length){toast("DUCKING","Put dialogue on A1 and music on A2 first.");return}
  const iv=[];voice.forEach(v=>{const l=iv[iv.length-1];if(l&&v[0]-l[1]<.6)l[1]=Math.max(l[1],v[1]);else iv.push([...v])});
  edit(()=>music.forEach(m=>{const base=m.vol==null?1:m.vol,low=base*.25,r=.35,ks=[];const s=m.start,e=cend(m);
    iv.forEach(([a,b])=>{if(b<s||a>e)return;[[a-r,base],[a,low],[b,low],[b+r,base]].forEach(([t,v])=>{if(t>=s&&t<=e)ks.push([+(t-s).toFixed(3),v])})});
    if(!ks.length)return;ks.sort((x,y)=>x[0]-y[0]);m.kf=m.kf||{};m.kf.vol=ks}));toast("DUCKED","A2 dips 12 dB under each A1 line, with 0.35 s ramps. Fine-tune the keyframes in the Inspector.")}

/* ---------- deliver page ---------- */
const DPRESETS=[["1080x1920",30,"TikTok · Reels · Shorts","1080×1920 · 30p"],["1920x1080",25,"YouTube · Web","1920×1080 · 25p"],["1080x1350",30,"Instagram feed","1080×1350 · 30p"],["1080x1080",30,"Square","1080×1080 · 30p"],["3840x2160",25,"4K UHD","3840×2160 · 25p"],["1920x1080",24,"Cinema 24p","1920×1080 · 24p"]];
function deliverPane(body){const p=cur(),tl=E.tl||newTL(defaultFormat(p));$("#bacts").innerHTML=`<button class="btn blue" data-dexport="1">Export…</button>`;
  const rs=rendersOf(p);
  body.innerHTML=`<div class="deliver"><div class="grp" style="padding:0"><span>Format</span><span class="mono">${tl.w}×${tl.h} · ${tl.fps}p</span></div>
    <div class="dcards">${DPRESETS.map(([f,fps,n,s],i)=>{const[w,h]=f.split("x").map(Number);const sc=26/Math.max(w,h);return`<button class="dcard" data-dpre="${i}" aria-pressed="${tl.w===w&&tl.h===h&&tl.fps===fps}"><span class="ar" style="width:${Math.round(w*sc)}px;height:${Math.round(h*sc)}px"></span><span><b>${n}</b>${s}</span></button>`}).join("")}</div>
    <div class="dbig"><button class="btn blue" data-dexport="1">Export ${E.rin!=null&&E.rout!=null&&E.rout>E.rin?"(In–Out range available)":"the whole cut"}</button><span style="font-size:11.5px;color:var(--dim)">MP4 where the browser supports it. Real time: keep the tab visible.</span></div>
    <div class="grp" style="padding:0"><span>Renders</span><span class="mono">${rs.length}</span></div>
    ${rs.length?`<ul class="dlist">${rs.map(r=>`<li><span><b class="mono" style="font-weight:500">${esc(r.ver||"render")}</b> <span style="color:var(--muted)">${esc(WHO(r.by).toLowerCase())} · ${esc(r.note||"")}</span></span><button class="btn sm" data-play="${esc(r.id)}">Play</button></li>`).join("")}</ul>`:`<div style="font-size:12px;color:var(--dim)">No renders yet. Export and choose Add to Renders so Claude can watch it.</div>`}
    <div style="font-size:11px;color:var(--dim)">Changing format keeps every clip’s Fit/Fill setting, so check framing in the Viewer afterwards. ⌘Z undoes it.</div></div>`}

/* ---------- safe zones + slip readout ---------- */
function renderSafe(){const z=$("#safez");if(!z)return;z.classList.toggle("on",!!E.safe);if(!E.safe){z.innerHTML="";return}const v=E.tl&&E.tl.h>E.tl.w;
  z.innerHTML=`<div class="act"></div><div class="ttl"></div>${v?`<div class="ui" style="right:0;top:42%;width:14%;height:40%">LIKE<br>COMMENT<br>SHARE</div><div class="ui" style="left:0;right:16%;bottom:0;height:17%">CAPTION · ACCOUNT · AUDIO</div><div class="ui" style="left:0;right:0;top:0;height:8%">TABS · LIVE</div>`:""}`}
function showSlip(c){let o=$("#slipo");const b=$("#pgmBox");if(!b)return;if(!o){o=document.createElement("div");o.id="slipo";o.className="slipo";b.appendChild(o)}o.textContent=`SLIP  in ${tcs(c.in)}  ·  out ${tcs(c.out)}`}
function hideSlip(){const o=$("#slipo");if(o)o.remove()}

/* ---------- beats (CapCut-style auto beat) ---------- */
async function detectBeats(c){const m=mediaOf(c&&c.mediaId);if(!m){toast("BEATS","Select an audio or video clip.");return}toast("BEATS","Listening for the beat in "+(m.name||"this clip")+"…");
  try{const buf=await(await fetch(blobUrl(m))).arrayBuffer();const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;const oc=new OAC(1,2,22050);
    const ab=await new Promise((res,rej)=>{const p=oc.decodeAudioData(buf,res,rej);if(p&&p.then)p.then(res,rej)});const ch=ab.getChannelData(0),sr=ab.sampleRate,hop=Math.round(sr*.01);
    const env=[];for(let i=0;i+hop<ch.length;i+=hop){let s=0;for(let j=i;j<i+hop;j++)s+=ch[j]*ch[j];env.push(Math.log(1e-6+s/hop))}
    const flux=env.map((v,i)=>i?Math.max(0,v-env[i-1]):0);const W=50,beats=[];let last=-1;
    for(let i=1;i<flux.length-1;i++){let a=Math.max(0,i-W),b=Math.min(flux.length,i+W),mu=0,sd=0;for(let k=a;k<b;k++)mu+=flux[k];mu/=b-a;for(let k=a;k<b;k++)sd+=(flux[k]-mu)**2;sd=Math.sqrt(sd/(b-a));
      const t=i*hop/sr;if(flux[i]>mu+1.4*sd&&flux[i]>=flux[i-1]&&flux[i]>=flux[i+1]&&flux[i]>.5&&(last<0||t-last>.22)){beats.push(t);last=t}}
    const sp=c.speed||1,out=beats.filter(t=>t>=c.in&&t<=c.out).map(t=>+(c.start+(t-c.in)/sp).toFixed(3)).slice(0,300);
    if(!out.length){toast("BEATS","No clear beat found in this clip.");return}
    edit(tl=>{tl.markers=(tl.markers||[]).filter(mk=>!(mk.kind==="beat"&&mk.src===c.id));out.forEach(t=>tl.markers.push({id:uid("mk"),t,text:"Beat",by:"joe",kind:"beat",src:c.id}))});
    const iv=out.slice(1).map((t,i)=>t-out[i]).sort((a,b)=>a-b);const med=iv.length?iv[iv.length>>1]:0;
    toast("BEATS",out.length+" beat markers added"+(med?" · about "+Math.round(60/med)+" BPM":"")+". Snapping now locks cuts to them.")}
  catch(e){toast("BEATS","Couldn’t read the audio in this file.")}}

/* ---------- captions from .srt / .vtt ---------- */
const srtIn=document.createElement("input");srtIn.type="file";srtIn.accept=".srt,.vtt,text/vtt,application/x-subrip";srtIn.className="sr";document.body.appendChild(srtIn);
srtIn.addEventListener("change",async()=>{const f=srtIn.files&&srtIn.files[0];srtIn.value="";if(!f||!getTL())return;const txt=await f.text();
  const ts=s=>{const m=s.trim().replace(",",".").match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/);return m?(+(m[1]||0))*3600+(+m[2])*60+(+m[3]):null};
  const cues=[];txt.replace(/\r/g,"").split(/\n\n+/).forEach(b=>{const L=b.split("\n").filter(Boolean);const i=L.findIndex(l=>l.includes("-->"));if(i<0)return;const[a,z]=L[i].split("-->");const s=ts(a),e=ts(z.split(" ").filter(Boolean)[0]);const text=L.slice(i+1).join("\n").replace(/<[^>]+>/g,"").trim();if(s!=null&&e>s&&text)cues.push([s,e,text])});
  if(!cues.length){toast("CAPTIONS","No captions found in "+f.name+".");return}
  edit(tl=>cues.forEach(([s,e,text])=>{const c=newTitle(s);Object.assign(c,clone(TPRESETS.caption),{track:"V3",text,out:e-s,name:"Caption",fadeIn:0,fadeOut:0});tl.clips.push(c)}));
  toast("CAPTIONS",cues.length+" captions placed on V3 from "+f.name+".")});

/* ---------- Claude Assist: Claude edits the timeline from inside the page ---------- */
function assistPanel(){const box=$("#insp");if(!box||box.querySelector("#assist"))return;const head=box.querySelector(".ihead");if(!head)return;
  const sel=selClips().length;
  head.insertAdjacentHTML("afterend",`<form class="assist" id="assist"><label for="asText" style="font-size:11.5px;color:#cbb8ff;font-weight:600">Claude Assist · edits this timeline now</label>
    <textarea id="asText" placeholder="e.g. Cut to the beat markers, add a dip to black before the last clip, and put a lower-third with the venue at 0:03.">${esc(E.asDraft||"")}</textarea>
    <div class="sugs">${["Tighten the pacing","Cut on the beats","Make it feel cinematic","Add captions styling","Fix the colour so shots match"].map(s=>`<button type="button" data-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    <div class="row"><small style="color:var(--dim);font-size:11px">${sel?sel+" selected clip"+(sel>1?"s":"")+" go with the request.":"Select clips to focus Claude on them."} ⌘Z undoes anything.</small><span style="display:flex;gap:6px"><button type="button" class="btn" id="asReview" ${assistBusy?"disabled":""} title="Claude watches frames from the cut and leaves review markers">Review cut</button><button type="submit" class="btn purple" id="asGo" ${assistBusy?"disabled":""}>${assistBusy?"Working…":"Edit"}</button></span></div>
    ${E.asLog.length?`<ul class="alog">${E.asLog.slice(-8).map(l=>`<li class="${l.who}">${esc(l.text)}${l.ops?`<div class="ops">${esc(l.ops)}</div>`:""}</li>`).join("")}</ul>`:""}</form>`)}
function refreshAssist(){const a=$("#assist");if(a){E.asDraft=($("#asText")||{}).value||"";a.remove()}if(state.itab==="claude"&&E.page!=="color")assistPanel()}
function tlSummary(){const tl=E.tl,r3=v=>+(+v).toFixed(3);
  return{format:`${tl.w}x${tl.h}@${tl.fps}`,duration:r3(tlDur()),playhead:r3(E.t),range:E.rin!=null&&E.rout!=null?[r3(E.rin),r3(E.rout)]:null,letterbox:tl.bars||0,selected:[...E.sel],
    tracks:Object.fromEntries(TRACKS.map(t=>[t,trk(t)])),
    clips:tl.clips.slice().sort((a,b)=>TRACKS.indexOf(a.track)-TRACKS.indexOf(b.track)||a.start-b.start).slice(0,220).map(c=>{const o={id:c.id,track:c.track,type:c.freeze?"freeze":c.type,start:r3(c.start),dur:r3(cdur(c))};
      if(c.mediaId){o.media=c.mediaId;o.in=r3(c.in);o.out=r3(c.out)}if(c.name)o.name=c.name;if(c.text)o.text=c.text;["speed","vol","op","scale","x","y","rot","fadeIn","fadeOut","look","off","style","pan","bri","con","sat","temp","tint"].forEach(k=>{if(c[k]!=null&&c[k]!==0&&!(k==="speed"&&c[k]===1)&&!(k==="vol"&&c[k]===1)&&!(k==="op"&&c[k]===1)&&!(k==="scale"&&c[k]===1))o[k]=c[k]});
      if(c.tr)o.transitionIn=c.tr;if(c.kf)o.keyframes=Object.keys(c.kf);return o}),
    markers:(tl.markers||[]).filter(m=>m.kind!=="beat").map(m=>({t:r3(m.t),text:m.text,by:m.by})),beats:(tl.markers||[]).filter(m=>m.kind==="beat").map(m=>r3(m.t)).slice(0,200),
    transcript:typeof txUnits==="function"?txUnits().slice(0,700).map(u=>[r3(u.a),r3(u.b),u.t]):[],media:projMedia().slice(0,80).map(m=>({id:m.id,name:m.name,kind:m.kind,dur:r3(m.dur||0),w:m.w,h:m.h}))}}
const ASSIST_RULES=`You are the editor inside Edit Bay, a video editor. You change the timeline by returning operations. The person's editing rules: tell a story (beginning, middle, end), draw the metaphor literally, set up then pay off, every graphic must say something, real over invented (never make up names, dates, venues or facts that are not in the timeline or request), make it feel like a movie (pacing, grade, letterbox, sound), and hook the audience in the first seconds.
Timeline model: V1 is the magnetic storyline (no gaps; clips pack left to right; order is by start). V2 and V3 sit above V1 (overlays, titles; V3 is captions). A1–A3 are audio. Times are seconds. A clip shows from start for dur; in/out are source seconds.
Reply with ONLY JSON: {"say":"one or two plain sentences on what you changed and why","ops":[...]}. Use [] when nothing should change. Operations, applied in order:
{"op":"update","id":ID,"set":{...}} — fields: in,out,speed,vol,pan,op,scale,x,y,rot (x/y are -1..1 of frame),fit("fit"|"fill"),kb(bool),fadeIn,fadeOut,bri,con,sat,hue,temp,tint,fade,vig,grain,bw,sepia,off(bool),name; titles also text,font("Archivo"|"Anton"|"Bebas Neue"|"Barlow Condensed"|"Space Mono"|"Playfair Display"),weight,size(% of height),yPos(0-100),color,align,anim("none"|"rise"|"pop"|"slide"|"drop"|"blur"|"track"|"type"),animOut("fade"|"fall"|"blur"),upper,glow,stroke,box,hl(colour for karaoke word highlight),track2(letter spacing); start only for non-V1 clips.
{"op":"trim","id":ID,"dur":seconds} — set a clip's length from its start.
{"op":"split","id":ID,"at":timelineSeconds,"as":"name"} — the right half can be referenced later as "name".
{"op":"delete","id":ID,"ripple":true}
{"op":"move","id":ID,"track":"V2","start":s} or for V1 reordering {"op":"move","id":ID,"index":n}
{"op":"add_media","media":MEDIA_ID,"track":"V1|V2|V3|A1|A2|A3","at":s,"in":s,"out":s,"as":"name"}
{"op":"add_title","text":"...","at":s,"dur":s,"track":"V2","style":"basic|lower|bold|caption|cinema|neon|mono","set":{...},"as":"name"}
{"op":"transition","id":ID,"type":"dissolve|black|white|push|slide|wipe|zoom|whip|flash|iris|clock|blurx|spin|glitch|burn|pushup|pushdown|doors|blinds|zoomout|none","d":0.5}
{"op":"effect","id":ID,"type":"blur|glow|rgb|pixel|vhs|shake|pulse|leak|mirror|invert|key","amount":0..1,"color":"#00ff00 (key only)"} — amount 0 removes it.
{"op":"frame","id":ID,"set":{"cropL":0..0.48,"cropR","cropT","cropB","bdr":corner 0..1,"bdw":border 0..0.03,"shd":shadow 0..1,"bdc":"#fff","flipH":bool,"flipV":bool,"blend":"screen|multiply|overlay|lighter|soft-light"}} — picture-in-picture framing. — on a V1 clip, blends from the clip before it.
{"op":"look","id":ID,"look":"teal|noir|film|night|bleach|matte|vivid|red|none"}
{"op":"kf","id":ID,"prop":"scale|x|y|rot|op|vol","t":secondsFromClipStart,"v":value}
{"op":"marker","t":s,"text":"note"}
{"op":"timeline","set":{"bars":2.39|2|1.85|0,"bg":"#000000"}}
{"op":"track","track":"A2","set":{"gain":0.5,"mute":false,"solo":false}}
{"op":"cut_range","from":s,"to":s} — ripple-delete that stretch of the storyline (use the transcript's timeline times to cut by what people say).
Only reference ids and media ids that exist. Keep changes focused on the request.`;
async function getSample(){if(sampleNS)return sampleNS;try{sampleNS=window.claude&&window.claude.use?await window.claude.use("sample"):null}catch(e){sampleNS=null}
  if(sampleNS)sampleCaps=await sampleNS.limits().catch(()=>null);return sampleNS}
async function grabFrames(n){const tl=E.tl;if(!tl)return[];const a=E.rin!=null&&E.rout>E.rin?E.rin:0,b=E.rin!=null&&E.rout>E.rin?E.rout:tlDur();const keep=E.t;pause();
  const max=Math.min(n,(sampleCaps&&sampleCaps.images&&sampleCaps.images.maxCount)||n);const times=[...Array(max)].map((_,i)=>a+(b-a)*(i+.5)/max);
  const cv=document.createElement("canvas");const out=[];const sw=Math.round(640*Math.min(1,tl.w/tl.h)),sh=Math.round(sw*tl.h/tl.w);const small=document.createElement("canvas");small.width=sw;small.height=sh;
  for(const t of times){E.t=t;sync();const until=performance.now()+1500;await new Promise(r=>setTimeout(r,60));
    while(performance.now()<until){let ok=true;recs.forEach(r=>{if(!r.c)return;const[w0,w1]=winOf(r.c);if(t>=w0&&t<w1&&(r.el.seeking||r.el.readyState<2))ok=false});if(ok)break;await new Promise(r=>setTimeout(r,50))}
    drawFrame(cv);small.getContext("2d").drawImage(cv,0,0,sw,sh);const blob=await new Promise(r=>small.toBlob(r,"image/jpeg",.72));if(blob)out.push({t,blob})}
  E.t=keep;sync();requestDraw();return out}
function resolveId(id,alias){return alias[id]||id}
function applyOps(ops,alias){const tl=E.tl,done=[],skipped=[];const fix=v=>typeof v==="number"&&isFinite(v);
  for(const o of ops||[]){try{const id=resolveId(o.id,alias);const c=id?clipById(id):null;
    switch(o.op){
      case"update":{if(!c)throw 0;const s=o.set||{};Object.keys(s).forEach(k=>{if(["id","track","type","mediaId","kf","tr","by"].includes(k))return;if(k==="start"&&c.track==="V1")return;c[k]=s[k]});if(Object.keys(s).some(k=>GRADE_KEYS.includes(k))&&!s.look)delete c.look;done.push("update");break}
      case"trim":{if(!c||!fix(o.dur))throw 0;c.out=c.in+Math.max(FR(),o.dur)*(c.speed||1);if(!isStill(c)){const m=mediaOf(c.mediaId);if(m&&m.dur)c.out=Math.min(c.out,m.dur)}done.push("trim");break}
      case"split":{if(!c||!fix(o.at))throw 0;const n=splitClip(c,o.at);if(!n)throw 0;if(o.as)alias[o.as]=n.id;done.push("split");break}
      case"delete":{if(!c)throw 0;if(c.track==="V1"&&o.ripple===false){Object.assign(c,{type:"gap",mediaId:null,name:"Gap",in:0,out:cdur(c),speed:1});delete c.text;delete c.freeze}else tl.clips=tl.clips.filter(x=>x.id!==c.id);done.push("delete");break}
      case"move":{if(!c)throw 0;if(o.index!=null&&c.track==="V1"){const l=v1().filter(x=>x.id!==c.id);l.splice(clamp(o.index|0,0,l.length),0,c);repack(l)}else{if(o.track&&okTrack(c,o.track))c.track=o.track;if(fix(o.start)&&c.track!=="V1")c.start=Math.max(0,o.start);relink(c)}done.push("move");break}
      case"add_media":{const m=mediaOf(o.media);if(!m)throw 0;const tr=TRACKS.includes(o.track)?o.track:(m.kind==="audio"?"A1":"V1");const n=newClip(m,okTrack({type:m.kind},tr)?tr:(m.kind==="audio"?"A1":"V2"),fix(o.at)?o.at:tlDur());n.by="claude";
        if(fix(o.in))n.in=Math.max(0,o.in);if(fix(o.out)&&o.out>n.in)n.out=o.out;if(n.track==="V1"){const l=v1();const b=boundaryNear(fix(o.at)?o.at:tlDur());l.splice(b.i,0,n);tl.clips.push(n);repack(l)}else{tl.clips.push(n);relink(n)}if(o.as)alias[o.as]=n.id;done.push("add_media");break}
      case"add_title":{const n=newTitle(fix(o.at)?o.at:E.t);n.by="claude";n.text=String(o.text||"Title");if(o.style&&TPRESETS[o.style])Object.assign(n,clone(TPRESETS[o.style]));if(o.track&&VTRACKS.includes(o.track)&&o.track!=="V1")n.track=o.track;if(fix(o.dur))n.out=n.in+Math.max(.2,o.dur);Object.assign(n,o.set||{});tl.clips.push(n);relink(n);if(o.as)alias[o.as]=n.id;done.push("add_title");break}
      case"transition":{if(!c)throw 0;if(c.track!=="V1"){if(!o.type||o.type==="none"){delete c.trIn;delete c.trOut}else{const w=o.which==="out"?"trOut":"trIn";c[w]={type:o.type==="black"||o.type==="white"?"dissolve":o.type,d:clamp(fix(o.d)?o.d:.5,.1,3)}}done.push("transition");break}if(!o.type||o.type==="none")delete c.tr;else if(TRANS.find(x=>x[0]===o.type))c.tr={type:o.type,d:clamp(fix(o.d)?o.d:.5,.1,3)};else throw 0;done.push("transition");break}
      case"look":{if(!c||!LOOKS[o.look])throw 0;Object.assign(c,clone(LOOKS[o.look][1]));if(o.look==="none")delete c.look;else c.look=o.look;done.push("look");break}
      case"kf":{if(!c||!KF_PROPS.includes(o.prop)||!fix(o.t)||!fix(o.v))throw 0;setKf(c,o.prop,c.start+o.t,o.v);done.push("keyframe");break}
      case"marker":{if(!fix(o.t))throw 0;(tl.markers=tl.markers||[]).push({id:uid("mk"),t:clamp(o.t,0,tlDur()),text:String(o.text||""),by:"claude"});done.push("marker");break}
      case"timeline":{const s=o.set||{};if(fix(s.bars))tl.bars=s.bars;if(typeof s.bg==="string")tl.bg=s.bg;done.push("timeline");break}
      case"cut_range":{if(!fix(o.from)||!fix(o.to)||o.to<=o.from)throw 0;cutRangesRaw(tl,[[o.from,o.to]]);done.push("cut");break}
      case"track":{if(!TRACKS.includes(o.track))throw 0;tl.tracks[o.track]=Object.assign(tl.tracks[o.track]||{},o.set||{});done.push("track");break}
      default:throw 0}}catch(e){skipped.push(o&&o.op||"?")}}
  return{done,skipped}}
async function runAssist(review){if(assistBusy||!E.tl)return;const txtEl=$("#asText");const ask=(txtEl&&txtEl.value.trim())||"";if(!review&&!ask){if(txtEl)txtEl.focus();return}
  const S=await getSample();if(!S){E.asLog.push({who:"err",text:HOSTED?"Claude isn’t connected on this site yet. Connect it in Help › Connect Claude with your own Claude API key. Everything else works without it.":"Claude Assist isn’t available in this view. Open Edit Bay on claude.ai while signed in, or send the request to a chat below."});refreshAssist();return}
  assistBusy=true;E.asDraft="";E.asLog.push({who:"me",text:review?"Review the cut"+(ask?": "+ask:""):ask});refreshAssist();
  const p=cur(),actId=uid("act");const act={projectId:p.id,title:review?"Reviewing the cut":"Editing: "+ask.slice(0,60),step:review?"Watching frames":"Planning the edit",status:"working",progress:null,startedAt:nowISO(),updatedAt:nowSec(),chat:"Claude Assist in Edit Bay"};
  if(db)db.collection("activity").doc(actId).set(act).catch(()=>{});
  try{let images=[],frameNote="";
    if(review&&sampleCaps&&sampleCaps.images){const fr=await grabFrames(8);images=fr.map(f=>f.blob);frameNote="\nThe attached images are frames from the cut, in order, at these timeline seconds: "+fr.map(f=>f.t.toFixed(2)).join(", ")+"."}
    const task=review?`Review this cut like a picky film editor. Leave 3–8 "marker" ops at the exact seconds that need work, each with a short, specific note (what's wrong and the fix). Do not change clips unless the request below asks you to.${ask?"\nFocus: "+ask:""}`:`Request: ${ask}`;
    const prompt=`${ASSIST_RULES}\n\nTIMELINE (JSON):\n${JSON.stringify(tlSummary())}${frameNote}\n\n${task}`;
    const r=await S.json(prompt,images.length?{images,modelTier:"default"}:{modelTier:"default"});
    const ops=Array.isArray(r&&r.ops)?r.ops:[];let res={done:[],skipped:[]};
    if(ops.length){const before=new Map(E.tl.clips.map(c=>[c.id,JSON.stringify(c)]));pushUndo();E.by="claude";res=applyOps(ops,{});E.tl.note=String(r.say||"").slice(0,200);normalize();commit();E.by="joe";
      E.flash=new Set(E.tl.clips.filter(c=>before.get(c.id)!==JSON.stringify(c)).map(c=>c.id));setTimeout(()=>E.flash.clear(),2600);edRefresh();
      toast("CLAUDE EDITED THE TIMELINE",(r.say||"Changes applied")+" · ⌘Z to undo");addLog(p.id,{who:"claude",text:"Assist: "+(r.say||ops.length+" changes")})}
    const sum=res.done.length?res.done.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{}):null;
    E.asLog.push({who:"",text:String((r&&r.say)||"Done."),ops:sum?Object.entries(sum).map(([k,v])=>v+"× "+k).join(" · ")+(res.skipped.length?" · skipped "+res.skipped.length:""):(res.skipped.length?"skipped "+res.skipped.length+" changes it couldn’t apply":"")});
    if(db)db.collection("activity").doc(actId).set(Object.assign(act,{status:"done",step:String((r&&r.say)||"Done").slice(0,120),progress:1,updatedAt:nowSec()})).catch(()=>{})}
  catch(e){const c=e&&e.code;const msg=c==="not_granted"?"Claude Assist wasn’t allowed. You can allow it from this page’s Permissions menu.":c==="rate_limited"?"You’ve hit a usage limit. Try again in a little while.":c==="invalid_json"?"Claude’s answer couldn’t be read as edits. Try rephrasing the request more specifically.":"Claude couldn’t finish that ("+(c||"error")+"). Try again.";
    E.asLog.push({who:"err",text:msg});if(db)db.collection("activity").doc(actId).set(Object.assign(act,{status:"error",step:msg,updatedAt:nowSec()})).catch(()=>{})}
  finally{assistBusy=false;refreshAssist()}}

/* ---------- events ---------- */
document.addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;const d=t.dataset;
  if(d.page){setPage(d.page);return}
  if(t.id==="srtBtn"){srtIn.click();return}
  if(d.scope){E.scope=d.scope;scopesPane($("#bbody"));return}
  if(d.lookbtn){const k=d.lookbtn,L=LOOKS[k];edit(()=>selClips().filter(c=>c.type==="video"||c.type==="image").forEach(c=>{Object.assign(c,clone(L[1]));if(k==="none")delete c.look;else c.look=k}));$("#insp").dataset.k="";renderColorPage();return}
  if(d.balreset){edit(()=>selClips().forEach(c=>{c.temp=0;c.tint=0}));renderColorPage(true);return}
  if(d.gcopy){const c=selClips()[0];if(c){E.grade=Object.fromEntries(GRADE_KEYS.map(k=>[k,clone(c[k])]));toast("GRADE COPIED",c.name||"Clip");$("#insp").dataset.k="";renderColorPage()}return}
  if(d.gpaste&&E.grade){edit(()=>selClips().filter(c=>c.type==="video"||c.type==="image").forEach(c=>GRADE_KEYS.forEach(k=>{if(E.grade[k]==null)delete c[k];else c[k]=clone(E.grade[k])})));renderColorPage(true);return}
  if(d.gall){const c=selClips()[0];if(!c)return;const g=Object.fromEntries(GRADE_KEYS.map(k=>[k,c[k]]));edit(tl=>tl.clips.filter(x=>x.type==="video"||x.type==="image").forEach(x=>GRADE_KEYS.forEach(k=>{if(g[k]==null)delete x[k];else x[k]=g[k]})));toast("GRADE MATCHED","Every video and image clip now uses this grade.");return}
  if(t.id==="cmpBtn2"){E.compare=!E.compare;requestDraw();$("#insp").dataset.k="";renderColorPage();const b=$("#cmpBtn");if(b)b.classList.toggle("on",E.compare);return}
  if(d.mxm||d.mxs){const tr=d.mxm||d.mxs;edit(tl=>{tl.tracks[tr]=tl.tracks[tr]||{};if(d.mxm)tl.tracks[tr].mute=!tl.tracks[tr].mute;else tl.tracks[tr].solo=!tl.tracks[tr].solo});applyBuses();mixerPane($("#bbody"));meterLoop();return}
  if(d.duck){duckMusic();return}
  if(d.clrbeats){edit(tl=>{tl.markers=(tl.markers||[]).filter(m=>m.kind!=="beat")});toast("BEATS","Beat markers cleared.");return}
  if(d.beats){detectBeats(selClips()[0]);return}
  if(d.dexport){openExport();return}
  if(d.dpre!=null){const[f,fps]=DPRESETS[+d.dpre];const[w,h]=f.split("x").map(Number);edit(tl=>{tl.w=w;tl.h=h;tl.fps=fps});edViewerKey="";render();toast("FORMAT",w+"×"+h+" at "+fps+" fps. Check framing in the Viewer.");return}
  if(d.assist){state.itab="claude";if(E.page==="color")setPage("edit");else render();setTimeout(()=>{const a=$("#asText");if(a)a.focus()},0);return}
  if(d.sug){const a=$("#asText");if(a){a.value=d.sug;a.focus()}return}
  if(t.id==="asReview"){runAssist(true);return}
});
document.addEventListener("submit",e=>{if(e.target.id==="assist"){e.preventDefault();e.stopImmediatePropagation();runAssist(false)}},true);
document.addEventListener("input",e=>{const el=e.target;
  if(el.dataset&&el.dataset.mxg){const tr=el.dataset.mxg,v=db2lin(+el.value);if(!E.mxUndo){pushUndo();E.mxUndo=true}if(tr==="MAIN")E.tl.master=v;else{E.tl.tracks[tr]=E.tl.tracks[tr]||{};E.tl.tracks[tr].gain=v}
    applyBuses();const o=$("#mxdb-"+tr);if(o)o.textContent=(v>0?lin2db(v).toFixed(1):"−∞")+" dB";clearTimeout(E.mxT);E.mxT=setTimeout(()=>{E.mxUndo=false;commit()},400)}
  if(el.id==="asText")E.asDraft=el.value});
document.addEventListener("change",e=>{const el=e.target;if(el.dataset&&el.dataset.bars){edit(tl=>{tl.bars=+el.value});requestDraw()}});
document.addEventListener("keydown",e=>{if(e.target&&e.target.id==="asText"&&e.key==="Enter"&&(e.metaKey||e.ctrlKey)){e.preventDefault();runAssist(false)}});
window.addEventListener("DOMContentLoaded",()=>{renderPagebar();getSample()});
