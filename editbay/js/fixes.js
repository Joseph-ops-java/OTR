/* Edit Bay — fixes and gap-fillers: full grade copy/paste, complete Paste Attributes, LUTs inside project files,
   preview quality (Auto/Full/Half/Quarter), keyframes for colour/crop/frame/effects, overlay in/out transitions, and extra tracks. */

/* ---------- 1–2. copy/paste carry everything ---------- */
GRADE_KEYS.push("curves","lut","lutMix","lgg");
ATTRS.push("curves","lut","lutMix","lgg","fx","cropL","cropR","cropT","cropB","bdr","bdw","shd","bdc","flipH","flipV","keyOn","keyColor","keySim","keySmooth","keySpill","blend","ramp","rampName","reverse","trIn","trOut");

/* ---------- 3. LUTs travel inside .editbay files ---------- */
function packLuts(tl){const used=[...new Set(((tl&&tl.clips)||[]).map(c=>c.lut).filter(Boolean))].filter(id=>LUTS[id]);return used.length?Object.fromEntries(used.map(id=>[id,{name:LUTS[id].name,n:LUTS[id].n,data:b64(LUTS[id].u8)}])):undefined}
$("#projIn").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.slice(0).text());if(d&&d.luts)for(const[id,L]of Object.entries(d.luts)){if(!LUTS[id])LUTS[id]={n:L.n,u8:unb64(L.data),name:L.name};if(db)db.collection("luts").doc(id).set(L).catch(()=>{})}requestDraw()}catch(x){}},true);

/* ---------- 4. preview quality ---------- */
let PQ="auto";try{PQ=localStorage.getItem("editbay.pq")||"auto"}catch(e){}let pqSlow=0;
function pqScale(){if(PQ==="full")return 1;if(PQ==="half")return .5;if(PQ==="quarter")return .25;return E.playing&&pqSlow>28?.5:1}
const _drawFrame=drawFrame;drawFrame=function(target){if(target||E.rendering||!E.tl)return _drawFrame(target);const q=pqScale();const t0=performance.now();
  if(q>=1){_drawFrame();if(E.playing)pqSlow=pqSlow*.85+(performance.now()-t0)*.15;return}const tl=E.tl,w=tl.w,h=tl.h;tl.w=Math.max(2,Math.round(w*q/2)*2);tl.h=Math.max(2,Math.round(h*q/2)*2);try{_drawFrame()}finally{tl.w=w;tl.h=h}};
const PQL={auto:"Auto",full:"Full",half:"½",quarter:"¼"};
const _edViewerQ=edViewer;edViewer=function(){_edViewerQ();if(!$("#pqBtn")){const g=$("#transport .grow");if(g)g.insertAdjacentHTML("afterend",`<button class="ib pq" id="pqBtn" title="Preview quality: lower it if playback stutters (exports are always full quality)" aria-label="Preview quality">${PQL[PQ]}</button>`)}};
document.addEventListener("click",e=>{const b=e.target.closest("#pqBtn");if(!b)return;const order=["auto","full","half","quarter"];PQ=order[(order.indexOf(PQ)+1)%4];try{localStorage.setItem("editbay.pq",PQ)}catch(x){}b.textContent=PQL[PQ];pqSlow=0;requestDraw();toast("PREVIEW QUALITY",PQ==="auto"?"Auto: drops to half while playing if your computer can’t keep up.":PQL[PQ]+" resolution while editing. Exports are always full quality.")});

/* ---------- 5. keyframes for colour, crop, frame and effect strength ---------- */
const KF_EVAL=["bri","con","sat","temp","tint","hue","fade","vig","grain","cropL","cropR","cropT","cropB","bdr","shd","keySim"];
KF_PROPS.push(...KF_EVAL);
const _rcK=renderClip;renderClip=function(ctx,c,t){if(!c.kf)return _rcK(ctx,c,t);let ev=null;
  for(const k of Object.keys(c.kf)){if(!c.kf[k]||!c.kf[k].length)continue;if(KF_EVAL.includes(k)){ev=ev||Object.assign({},c);ev[k]=kv(c,k,t)}
    else if(k.startsWith("fx:")&&c.fx){ev=ev||Object.assign({},c);if(ev.fx===c.fx)ev.fx=c.fx.map(f=>Object.assign({},f));const f=ev.fx.find(x=>"fx:"+x.t===k);if(f)f.a=kv(c,k,t)}}
  return _rcK(ctx,ev||c,t)};
function addKfButtons(box){if(!box)return;const c=selClips()[0];if(!c)return;box.querySelectorAll(".cprop").forEach(r=>{const inp=r.querySelector("input[type=range][data-cp]");if(!inp||r.querySelector(".kfnav"))return;const k=inp.dataset.cp;if(!KF_EVAL.includes(k))return;
    const last=r.lastElementChild;const html=`<span class="kfnav"><button class="kfa" data-kfnav="${k}:-1" title="Previous keyframe">‹</button><button class="kfb ${kfAt(c,k,E.t)>=0?"on":c.kf&&c.kf[k]&&c.kf[k].length?"has":""}" data-kf="${k}" title="Add or remove a keyframe at the playhead">◆</button><button class="kfa" data-kfnav="${k}:1" title="Next keyframe">›</button></span>`;
    if(last&&last.tagName==="SPAN"&&!last.textContent.trim())last.outerHTML=html;else r.insertAdjacentHTML("beforeend",html)});
  box.querySelectorAll(".fxrow").forEach((r,i)=>{if(r.querySelector("[data-fxkf]")||!c.fx||!c.fx[i])return;const key="fx:"+c.fx[i].t;const on=kfAt(c,key,E.t)>=0,has=c.kf&&c.kf[key]&&c.kf[key].length;r.querySelector(".x").insertAdjacentHTML("beforebegin",`<button class="kfb fxk ${on?"on":has?"has":""}" data-fxkf="${i}" title="Keyframe this effect’s strength at the playhead">◆</button>`)})}
const _eciK=edClipInspector;edClipInspector=function(box){_eciK(box);addKfButtons(box)};
const _rcpK=renderColorPage;renderColorPage=function(soft){_rcpK(soft);addKfButtons($("#insp"))};
document.addEventListener("click",e=>{const b=e.target.closest("[data-fxkf]");if(!b)return;const c=selClips()[0];if(!c||!c.fx)return;const f=c.fx[+b.dataset.fxkf];if(!f)return;const key="fx:"+f.t;
  if(E.t<c.start-1e-6||E.t>cend(c)+1e-6){toast("KEYFRAME","Move the playhead inside the clip first.");return}
  edit(()=>{const i=kfAt(c,key,E.t);if(i>=0){f.a=kv(c,key,E.t);c.kf[key].splice(i,1);if(!c.kf[key].length)delete c.kf[key]}else{c.kf=c.kf||{};const v=c.kf[key]&&c.kf[key].length?kv(c,key,E.t):(f.a==null?.5:f.a);setKf(c,key,E.t,v)}});$("#insp").dataset.k="";renderInsp()});
document.addEventListener("input",e=>{const el=e.target;if(!el.dataset||el.dataset.fxa==null)return;const c=selClips()[0];if(!c||!c.fx)return;const f=c.fx[+el.dataset.fxa];const key=f&&"fx:"+f.t;if(key&&c.kf&&c.kf[key]&&c.kf[key].length)setKf(c,key,E.t,+el.value)});

/* ---------- 6. overlays and titles animate in and out with any transition ---------- */
let EMPTY=null;function emptyLayer(){const W=E.tl.w,H=E.tl.h;if(!EMPTY)EMPTY=document.createElement("canvas");if(EMPTY.width!==W||EMPTY.height!==H){EMPTY.width=W;EMPTY.height=H}return EMPTY}
const OVT=t=>t==="black"||t==="white"?"dissolve":t;
function overlayDraw(ctx,lc,c,t){const ti=c.trIn,to=c.trOut,d=cdur(c);
  if(ti&&ti.type&&!E.noGrade&&t<c.start+Math.min(ti.d||.5,d/2)){const dd=Math.min(ti.d||.5,d/2);transition(ctx,OVT(ti.type),emptyLayer(),lc,clamp((t-c.start)/dd,0,1));return}
  if(to&&to.type&&!E.noGrade&&t>cend(c)-Math.min(to.d||.5,d/2)){const dd=Math.min(to.d||.5,d/2);transition(ctx,OVT(to.type),lc,emptyLayer(),clamp((t-(cend(c)-dd))/dd,0,1));return}
  ctx.drawImage(lc,0,0)}
const _eciO=edClipInspector;edClipInspector=function(box){_eciO(box);const c=selClips()[0];if(!c||c.track==="V1"||c.type==="audio"||box.querySelector("#otrsec"))return;
  const anchor=box.querySelector("#fxsec")||[...box.querySelectorAll(":scope > .grp")].find(g=>/^Fades/.test(g.textContent));if(!anchor)return;const opts=TRANS.filter(([k])=>k!=="black"&&k!=="white");
  const sel=(w,v)=>`<select id="otr-${w}" data-otr="${w}"><option value="">None</option>${opts.map(([k,l])=>`<option value="${k}" ${v===k?"selected":""}>${l}</option>`).join("")}</select>`;
  anchor.insertAdjacentHTML("beforebegin",`<div class="grp" id="otrsec"><span>Animate in &amp; out</span></div><div class="cprop wide"><label for="otr-in">In</label>${sel("in",c.trIn&&c.trIn.type)}</div>${c.trIn?row("In length","trInD",c.trIn.d||.5,.1,3,.05,"s"):""}<div class="cprop wide"><label for="otr-out">Out</label>${sel("out",c.trOut&&c.trOut.type)}</div>${c.trOut?row("Out length","trOutD",c.trOut.d||.5,.1,3,.05,"s"):""}`)};
document.addEventListener("change",e=>{const el=e.target;if(!el.dataset||!el.dataset.otr)return;const w=el.dataset.otr==="in"?"trIn":"trOut",v=el.value;edit(()=>selClips().filter(c=>c.track!=="V1").forEach(c=>{if(v)c[w]={type:v,d:(c[w]&&c[w].d)||.5};else delete c[w]}));$("#insp").dataset.k="";renderInsp()});
const _setPropO=setProp;setProp=function(c,k,v){if(k==="trInD"||k==="trOutD"){const w=k==="trInD"?"trIn":"trOut";if(c[w])c[w].d=v;return}return _setPropO(c,k,v)};

/* ---------- 7. add and remove tracks (up to 6 video and 6 audio) ---------- */
function rebuildTracks(){const tl=E.tl,v=3+((tl&&tl.extraV)||0),a=3+((tl&&tl.extraA)||0);TRACKS.length=0;for(let i=v;i>=1;i--)TRACKS.push("V"+i);for(let i=1;i<=a;i++)TRACKS.push("A"+i);VTRACKS.length=0;for(let i=1;i<=v;i++)VTRACKS.push("V"+i)}
const _sw=edSwitchProject;edSwitchProject=function(id,silent){_sw(id,true);rebuildTracks();if(!silent)render()};
const _ot=edOnTimelines;edOnTimelines=function(list){_ot(list);const before=TRACKS.length;rebuildTracks();if(TRACKS.length!==before)edTimeline()};
const _ab=applyBuses;applyBuses=function(){if(AC)TRACKS.forEach(tr=>{if(!BUS[tr]){const an=AC.createAnalyser();an.fftSize=1024;an.connect(MIX);const b=buildBus(AC,tr,an);b.an=an;BUS[tr]=b}});_ab()};
function addTrack(kind){if(!getTL())return;const k=kind==="v"?"extraV":"extraA";const n=(E.tl[k]||0);if(n>=3){toast("TRACKS","Up to 6 "+(kind==="v"?"video":"audio")+" tracks.");return}
  edit(tl=>{tl[k]=n+1;const name=(kind==="v"?"V":"A")+(4+n);tl.tracks[name]=tl.tracks[name]||{on:true}});rebuildTracks();applyBuses();edTimeline()}
function removeTrack(kind){const k=kind==="v"?"extraV":"extraA";const n=(E.tl&&E.tl[k])||0;if(!n)return;const name=(kind==="v"?"V":"A")+(3+n);if(E.tl.clips.some(c=>c.track===name)){toast("TRACKS",name+" still has clips. Move or delete them first.");return}
  edit(tl=>{tl[k]=n-1;delete tl.tracks[name]});rebuildTracks();edTimeline()}
const _edTL=edTimeline;edTimeline=function(){_edTL();const h=$("#tlhead");if(h&&cur()&&state.ttab==="edit"&&!h.querySelector(".trkadd")){const ev=(E.tl&&E.tl.extraV)||0,ea=(E.tl&&E.tl.extraA)||0;
  h.insertAdjacentHTML("beforeend",`<span class="trkadd"><button class="ib" data-addtrk="v" title="Add a video track">+ Video track</button>${ev?`<button class="ib" data-rmtrk="v" title="Remove the top video track (must be empty)">− Video</button>`:""}<button class="ib" data-addtrk="a" title="Add an audio track">+ Audio track</button>${ea?`<button class="ib" data-rmtrk="a" title="Remove the last audio track (must be empty)">− Audio</button>`:""}</span>`)}};
document.addEventListener("click",e=>{const b=e.target.closest("[data-addtrk],[data-rmtrk]");if(!b)return;b.dataset.addtrk?addTrack(b.dataset.addtrk):removeTrack(b.dataset.rmtrk)});
setTimeout(()=>{rebuildTracks()},0);
