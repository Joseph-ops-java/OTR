/* Edit Bay — Beta 2: sample project, clearer errors for unsupported footage, matching the timeline to the first clip,
   keyframe easing, storage warnings, opt-in usage counts, a system check, privacy/terms links and tablet layout. */

/* ---------- small overlay helper (independent of #modal so it never fights other dialogs) ---------- */
function sheet(id,html,label){closeSheet(id);const d=document.createElement("div");d.className="ov";d.id=id;d.innerHTML=`<div class="dlg" role="dialog" aria-label="${esc(label)}">${html}</div>`;document.body.appendChild(d);
  d.addEventListener("click",e=>{if(e.target===d||e.target.closest("[data-shclose]"))closeSheet(id)});const f=d.querySelector("button,input,select");if(f)f.focus();return d}
function closeSheet(id){const d=document.getElementById(id);if(d)d.remove()}
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;const s=[...document.querySelectorAll("body > .ov[id^='sh-']")].pop();if(s){e.preventDefault();e.stopImmediatePropagation();s.remove()}},true);

/* ---------- 1. footage the browser can't open: say exactly why ---------- */
async function whyUnreadable(f){const generic=f.name+" (this browser can’t open it: try MP4/H.264, MOV, WebM, MP3, WAV, JPG or PNG)";
  try{const N=Math.min(f.size,2*1024*1024);const rd=async(a,b)=>{const u=new Uint8Array(await f.slice(a,b).arrayBuffer());let s="";for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return s};
    /* the codec box (stsd) sits in moov, which can be at the start or the end of the file */
    const s=(await rd(0,N))+(f.size>N?await rd(Math.max(N,f.size-N),f.size):"");
    if(/hvc1|hev1/.test(s))return f.name+" is HEVC (H.265) video, which iPhones record by default. This browser can’t decode it. Use Chrome or Edge on a Mac or Windows PC with hardware HEVC support, or Safari. On iPhone, Settings › Camera › Formats › Most Compatible records H.264 instead.";
    if(/apc[nhso4]|ap4[hx]/.test(s))return f.name+" is Apple ProRes, which browsers can’t decode. Export an H.264 or HEVC copy first.";
    if(/av01/.test(s)&&typeof VideoDecoder!=="undefined")return f.name+" is AV1 video, which this browser or device can’t decode. Try Chrome or Edge on a recent computer.";
    if(/^.{4}ftypqt/.test(s)||/\.mov$/i.test(f.name))return f.name+" is a QuickTime file with a codec this browser can’t play. H.264 .mov files work; ProRes and some camera codecs don’t.";
    if(/\.(mxf|r3d|braw|ari)$/i.test(f.name))return f.name+" is a camera raw or broadcast format that browsers can’t open. Export an H.264 copy first."}catch(e){}return generic}

/* ---------- 2. first clip on an empty timeline: offer to match its shape ---------- */
const _pm2=placeMedia;placeMedia=function(id,tr,t){const empty=!E.tl||!E.tl.clips.length;const r=_pm2(id,tr,t);try{const m=mediaOf(id);if(empty&&m&&m.kind==="video"&&m.w&&m.h&&E.tl&&E.tl.clips.length)offerMatch(m)}catch(e){}return r};
function shapeOf(w,h){const a=w/h;return a>1.2?"landscape":a<.85?"vertical":"square"}
function offerMatch(m){const tl=E.tl;if(shapeOf(m.w,m.h)===shapeOf(tl.w,tl.h))return;const box=$("#vArea");if(!box||box.querySelector(".matchbar"))return;
  const long=Math.max(m.w,m.h),s=long>1920?1920/long:1;const w=Math.round(m.w*s/2)*2,h=Math.round(m.h*s/2)*2;
  box.insertAdjacentHTML("afterbegin",`<div class="matchbar" role="status"><span>This clip is ${shapeOf(m.w,m.h)} (${m.w}×${m.h}). The timeline is ${shapeOf(tl.w,tl.h)} (${tl.w}×${tl.h}).</span><button class="btn sm blue" data-match="${w}x${h}">Match clip</button><button class="btn sm" data-match="">Keep ${shapeOf(tl.w,tl.h)}</button></div>`)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-match]");if(!b)return;const v=b.dataset.match;const bar=b.closest(".matchbar");if(bar)bar.remove();if(!v||!E.tl)return;const[w,h]=v.split("x").map(Number);
  edit(tl=>{tl.w=w;tl.h=h});E.pps=null;render();toast("TIMELINE",`Now ${w}×${h}. Change it any time in Inspector › Project.`)});

/* ---------- 3. try it with sample media (real OTR assets: Dark Out flyer, DJ Samszy photo, OTR logo) ---------- */
const SAMPLE=[["sample/dark-out-flyer.jpg","Dark Out flyer.jpg"],["sample/dj-samszy.jpg","DJ Samszy.jpg"],["sample/otr-logo.png","OTR logo.png"]];
async function makeSample(){if(E.sampleBusy)return;E.sampleBusy=true;try{
  state.modal="new";render();await new Promise(r=>setTimeout(r,50));$("#n-title").value="Dark Out teaser (sample)";const v=document.querySelector('input[name="n-shape"][value="1080x1920"]');if(v)v.checked=true;$("#newForm").requestSubmit();
  await new Promise(r=>setTimeout(r,250));if(!cur())throw new Error("no project");
  const files=[];for(const[u,n]of SAMPLE){const r=await fetch(u);if(!r.ok)throw new Error("missing "+u);const bl=await r.blob();files.push(new File([bl],n,{type:bl.type||(u.endsWith(".png")?"image/png":"image/jpeg")}))}
  await importFiles(files);const id=n=>(state.media.find(m=>m.name===n&&m.projectId===cur().id)||{}).id;const fl=id("Dark Out flyer.jpg"),dj=id("DJ Samszy.jpg"),lg=id("OTR logo.png");if(!fl||!dj||!lg)throw new Error("import");
  /* story: the DJ poster hooks, the flyer gives the details, the OTR logo signs off. The posters carry their own
     text, so titles only appear on the end card, where nothing else is written. */
  placeMedia(dj,"V1",0);placeMedia(fl,"V1",100);placeMedia(lg,"V1",200);
  edit(tl=>{const vs=tl.clips.filter(c=>c.track==="V1").sort((a,b)=>a.start-b.start);const D=[4,3.5,4];vs.forEach((c,i)=>{c.out=c.in+D[i];c.kb=i<2;if(i)c.tr={type:"dissolve",d:.6}});
    if(vs[2])vs[2].scale=.6;const endAt=vs[2]?vs[2].start:7;
    const T=(start,dur,text,preset,extra)=>{const c=newTitle(start);Object.assign(c,clone(TPRESETS[preset]||TPRESETS.basic),{text,out:dur,name:text.split("\n")[0]},extra||{});tl.clips.push(c)};
    T(endAt+.5,3.4,"16 MAY 2026\nTHE HIDDEN ATTIC","basic",{yPos:70,size:4});T(endAt+.8,3.1,"Presented by\nR.O.A.R & OTR","caption",{track:"V3",yPos:85,size:3.2})});
  normalize();commit();seek(0);E.pps=null;render();
  toast("SAMPLE PROJECT","An 11-second teaser built from the real Dark Out posters and OTR logo. Play it, change it, or ask Claude to recut it. Add your own music on A2.");track("sample")}
  catch(e){toast("SAMPLE PROJECT","Couldn’t load the sample media ("+(e.message||"error")+").")}finally{E.sampleBusy=false}}
document.addEventListener("click",e=>{if(e.target.closest("[data-sample]"))makeSample()});
const _rvS=renderViewer;renderViewer=function(){_rvS();const w=$("#vArea .welcome");if(!w||w.querySelector("[data-sample]"))return;const a=w.querySelector(".wacts");if(a)a.insertAdjacentHTML("beforeend",`<button class="btn" data-sample="1" title="Open a short teaser built from real Dark Out material">Try with sample media</button>`);
  const sm=w.querySelector("small");if(sm&&!w.querySelector(".legal"))sm.insertAdjacentHTML("afterend",`<div class="legal"><a href="testers.html" target="_blank" rel="noopener">Tester guide</a> · <a href="privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="terms.html" target="_blank" rel="noopener">Terms</a> · <button class="lnk" data-syscheck="1">Check this browser</button></div>`)};

/* ---------- 4. keyframe easing ---------- */
const EASE={smooth:"Smooth (ease in and out)",lin:"Linear",in:"Ease in (start slow)",out:"Ease out (end slow)",hold:"Hold (jump at the keyframe)"};
kv=function(c,k,t){const base=c[k]==null?(k==="scale"||k==="op"||k==="vol"?1:0):c[k];const ks=c.kf&&c.kf[k];if(!ks||!ks.length||t==null)return base;
  const r=t-c.start;if(r<=ks[0][0])return ks[0][1];const L=ks[ks.length-1];if(r>=L[0])return L[1];
  for(let i=1;i<ks.length;i++){const a=ks[i-1],b=ks[i];if(r<=b[0]){let u=(r-a[0])/Math.max(1e-6,b[0]-a[0]);const m=b[2]||"smooth";
      u=m==="lin"?u:m==="in"?u*u*u:m==="out"?1-Math.pow(1-u,3):m==="hold"?(u>=1?1:0):u*u*(3-2*u);return a[1]+(b[1]-a[1])*u}}return base};
document.addEventListener("contextmenu",e=>{const b=e.target.closest("[data-kf],[data-fxkf]");if(!b)return;const c=selClips()[0];if(!c)return;e.preventDefault();
  const key=b.dataset.kf||("fx:"+((c.fx||[])[+b.dataset.fxkf]||{}).t);const i=kfAt(c,key,E.t);if(i<0){toast("KEYFRAME EASING","Move the playhead onto a keyframe (◆) first, then right-click it.");return}
  const cur0=c.kf[key][i][2]||"smooth";popMenu(e.clientX,e.clientY,Object.entries(EASE).map(([m,l])=>({l:(m===cur0?"✓ ":"   ")+l,f:()=>{edit(()=>{const k=c.kf[key][i];if(m==="smooth")k.length=2;else k[2]=m});track("ease:"+m);toast("KEYFRAME EASING",l+" into this keyframe.")}})))},true);
const _aKB=edClipInspector;edClipInspector=function(box){_aKB(box);box.querySelectorAll("[data-kf],[data-fxkf]").forEach(b=>{if(!/easing/.test(b.title))b.title+=" · right-click for easing"})};

/* ---------- 5. storage: ask the browser to keep our data, warn before it fills ---------- */
let stWarned=0;async function storageCheck(silent){if(!navigator.storage||!navigator.storage.estimate)return null;let est;try{est=await navigator.storage.estimate()}catch(e){return null}const q=est.quota||0,u=est.usage||0;if(!q)return null;const f=u/q;
  let persisted=false;try{persisted=navigator.storage.persisted?await navigator.storage.persisted():false}catch(e){}
  if(!silent&&f>.95&&stWarned<2){stWarned=2;state.note=`Storage almost full: Edit Bay is using ${fmtBytes(u)} of the ${fmtBytes(q)} this browser allows. New imports may fail. Remove unused media in File › Storage & Media, or save a project file and start fresh.`;renderNote()}
  else if(!silent&&f>.8&&stWarned<1){stWarned=1;toast("STORAGE",`${Math.round(f*100)}% of this browser’s space for Edit Bay is used (${fmtBytes(u)} of ${fmtBytes(q)}). Free some in File › Storage & Media before importing large files.`)}
  return{u,q,f,persisted}}
async function askPersist(){try{if(navigator.storage&&navigator.storage.persist&&!(await navigator.storage.persisted()))await navigator.storage.persist()}catch(e){}}
const _if2=importFiles;importFiles=async function(files){const r=await _if2(files);askPersist();storageCheck();track("import",files&&files.length||1);return r};
window.addEventListener("load",()=>setTimeout(()=>storageCheck(),4000));

/* ---------- 6. opt-in usage counts (never media, file names or project content) ---------- */
const U_KEY="editbay.usage",U_OPT="editbay.usageOptIn";
function usageOpt(){try{return localStorage.getItem(U_OPT)||""}catch(e){return""}}
function usageGet(){try{return JSON.parse(localStorage.getItem(U_KEY)||"{}")}catch(e){return{}}}
let uDirty=false,uT=0;
function track(ev,n){if(usageOpt()!=="yes")return;const u=usageGet();u.c=u.c||{};u.c[ev]=(u.c[ev]||0)+(n||1);u.since=u.since||new Date().toISOString().slice(0,10);u.v=APP_VERSION;try{localStorage.setItem(U_KEY,JSON.stringify(u))}catch(e){}
  uDirty=true;clearTimeout(uT);uT=setTimeout(pushUsage,20000)}
async function pushUsage(){if(!uDirty||usageOpt()!=="yes"||!RAWDB||!ME)return;uDirty=false;try{const ref=RAWDB.doc("feedback/"+ME);const d=await ref.get();const cur0=(d.exists&&d.data())||{};await ref.set(Object.assign({},cur0,{usage:Object.assign(usageGet(),{browser:browserName()}),updatedAt:new Date().toISOString()}))}catch(e){}}
function usageSummary(){const u=usageGet();return Object.entries(u.c||{}).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+": "+v).join(", ")}
[["setPage","page"],["openExport","export-open"],["exportFrame","still"],["exportEDL","edl"],["exportFCPXML","fcpxml"],["saveProjectFile","project-file"],["bladeAtPlayhead","blade"],["addTitleAtPlayhead","title"],["addMarker","marker"],["freezeAt","freeze"],["detachAudio","detach-audio"],["matchFrame","match-frame"],["addFx","effect"],["addDefaultTransition","transition"],["deleteSel","delete"],["pasteAttrs","paste-attributes"],["addTrack","add-track"],["openCmd","command-search"],["duplicateProject","duplicate"]].forEach(([fn,ev])=>{
  if(typeof window[fn]!=="function")return;const o=window[fn];window[fn]=function(...a){try{track(ev==="page"?"page:"+a[0]:ev)}catch(e){}return o.apply(this,a)}});
const _runX=runExport;runExport=async function(...a){const r=await _runX.apply(this,a);try{track(E.x&&E.x.phase==="done"?"export-done":"export-failed")}catch(e){}return r};
document.addEventListener("submit",e=>{if(e.target&&e.target.id==="assistForm")track("claude-chat")},true);
function usagePrompt(){if(usageOpt()||!cur()||$("#usageAsk"))return;const d=document.createElement("div");d.id="usageAsk";d.className="usageask";d.setAttribute("role","dialog");d.setAttribute("aria-label","Share usage counts");
  d.innerHTML=`<b>Help shape Edit Bay?</b><p>Share anonymous counts of which tools you use and whether exports work. Never your media, file names or project content. You can change this in Help.</p><div><button class="btn blue sm" data-uopt="yes">Share counts</button><button class="btn sm" data-uopt="no">No thanks</button></div>`;document.body.appendChild(d)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-uopt]");if(!b)return;try{localStorage.setItem(U_OPT,b.dataset.uopt)}catch(x){}const a=$("#usageAsk");if(a)a.remove();if(b.dataset.uopt==="yes"){track("opt-in");toast("THANK YOU","Usage counts are on. Turn them off in Help › Usage counts.")}});
setTimeout(function ask(){if(cur()&&usageOpt()==="")usagePrompt();else if(usageOpt()==="")setTimeout(ask,15000)},90000);
const _sfb2=sendFeedback;sendFeedback=function(doc){if(usageOpt()==="yes"&&doc&&doc.type==="feedback")doc=Object.assign({},doc,{usage:usageSummary()});return _sfb2(doc)};

/* ---------- 7. system check: what this browser can do ---------- */
function browserName(){const u=navigator.userAgent;return /Edg\//.test(u)?"Edge":/OPR\//.test(u)?"Opera":/Firefox\//.test(u)?"Firefox":/Chrome\//.test(u)?"Chrome":/Safari\//.test(u)?"Safari":"Other"}
async function sysCheck(){const ok=async f=>{try{return!!(await f())}catch(e){return false}};const R=[];const add=(l,v,need,note)=>R.push({l,v,need,note});
  const vcfg=(codec,w,h)=>({codec,width:w,height:h,bitrate:8e6,framerate:30});
  add("Video export (H.264)",await ok(async()=>typeof VideoEncoder!=="undefined"&&(await VideoEncoder.isConfigSupported(vcfg("avc1.640028",1920,1080))).supported),true,"Needed for fast, frame-accurate export. Without it, Edit Bay records the timeline in real time instead.");
  add("4K export",await ok(async()=>typeof VideoEncoder!=="undefined"&&(await VideoEncoder.isConfigSupported(vcfg("avc1.640033",3840,2160))).supported),false,"");
  add("H.264 decoding",await ok(async()=>typeof VideoDecoder!=="undefined"&&(await VideoDecoder.isConfigSupported({codec:"avc1.640028"})).supported),true,"Used for frame-accurate preview and export.");
  add("HEVC (iPhone video)",await ok(async()=>typeof VideoDecoder!=="undefined"&&(await VideoDecoder.isConfigSupported({codec:"hvc1.1.6.L123.B0"})).supported),false,"Without it, iPhone videos recorded in “High Efficiency” won’t open.");
  const aac=await ok(async()=>typeof AudioEncoder!=="undefined"&&(await AudioEncoder.isConfigSupported({codec:"mp4a.40.2",sampleRate:48000,numberOfChannels:2,bitrate:192000})).supported);
  const opus=await ok(async()=>typeof AudioEncoder!=="undefined"&&(await AudioEncoder.isConfigSupported({codec:"opus",sampleRate:48000,numberOfChannels:2,bitrate:160000})).supported);
  add("Export audio",aac||opus,true,aac?"AAC":opus?"Opus (plays in modern players; some older TVs and editors want AAC)":"No audio encoder: exports would be silent.");
  add("GPU colour (WebGL 2)",!!document.createElement("canvas").getContext("webgl2"),false,"Without it, colour grading falls back to a slower, simpler path.");
  add("Device storage (IndexedDB)",typeof IDB_OK!=="undefined"&&IDB_OK,true,"Where your projects and media are kept.");
  const st=await storageCheck(true);add("Storage space",!!st&&st.q-st.u>2e9,false,st?`${fmtBytes(st.q-st.u)} free for Edit Bay · ${st.persisted?"protected from automatic clearing":"the browser may clear it if the disk gets full"}`:"Not reported.");
  add("In-browser captions (WebGPU)",!!navigator.gpu,false,navigator.gpu?"Fast speech-to-text on your graphics card.":"Captions still work, more slowly, on the processor.");
  const must=R.filter(r=>r.need&&!r.v);const verdict=must.length?"Some things Edit Bay needs are missing. Use the latest Chrome or Edge on a computer.":R.every(r=>r.v)?"Everything works in this browser.":"Edit Bay works here, with the limits below.";
  sheet("sh-sys",`<h3>Check this browser</h3><p style="font-size:12.5px;color:var(--muted);margin:0 0 8px">${esc(browserName())} · ${innerWidth}×${innerHeight} · ${esc(verdict)}</p><ul class="syslist">${R.map(r=>`<li class="${r.v?"y":r.need?"n":"w"}"><span>${r.v?"✓":r.need?"✕":"–"}</span><b>${esc(r.l)}</b>${r.note?`<small>${esc(r.note)}</small>`:""}</li>`).join("")}</ul><div class="acts"><button class="btn" data-shclose="1">Close</button></div>`,"Browser check");track("system-check")}
document.addEventListener("click",e=>{if(e.target.closest("[data-syscheck]")){e.preventDefault();sysCheck()}});

/* ---------- 8. Help additions: privacy, terms, usage counts, system check, sample ---------- */
(function(){const fm=$("#fileMenu");if(!fm||fm.querySelector("[data-syscheck]"))return;const about=fm.querySelector('[data-fm="about"]');
  about.insertAdjacentHTML("afterend",`<button role="menuitem" data-syscheck="1">Check This Browser…</button><button role="menuitem" data-sample="1">Open Sample Project</button><button role="menuitem" data-usagetoggle="1" id="usageItem">Usage Counts…</button><a role="menuitem" class="mlink" href="testers.html" target="_blank" rel="noopener">Tester Guide</a><a role="menuitem" class="mlink" href="privacy.html" target="_blank" rel="noopener">Privacy</a><a role="menuitem" class="mlink" href="terms.html" target="_blank" rel="noopener">Terms of Use</a>`)})();
document.addEventListener("click",e=>{if(!e.target.closest("[data-usagetoggle]"))return;const on=usageOpt()==="yes";
  sheet("sh-usage",`<h3>Usage counts</h3><p style="font-size:12.5px;line-height:1.55;color:var(--muted)">When on, Edit Bay counts which tools you use and whether exports succeed, and sends the totals with your feedback. It never sends media, file names, titles or anything you type.</p><p style="font-size:12px" class="mono">${esc(usageSummary()||"Nothing counted yet.")}</p><div class="acts"><button class="btn" data-shclose="1">Close</button><button class="btn ${on?"":"blue"}" data-uopt="${on?"no":"yes"}" data-shclose="1">${on?"Turn off":"Turn on"}</button></div>`,"Usage counts")});

/* ---------- 9. tablet: Media as a slide-out drawer in portrait ---------- */
(function(){const t=$(".tright");if(t&&!$("#drawerBtn"))t.insertAdjacentHTML("afterbegin",`<button class="tbtn2 drawerbtn" id="drawerBtn" aria-expanded="false" aria-controls="bbody" title="Show or hide the Media browser">Media</button>`)})();
document.addEventListener("click",e=>{const b=e.target.closest("#drawerBtn");if(b){const on=!$(".app").classList.contains("drawer");$(".app").classList.toggle("drawer",on);b.setAttribute("aria-expanded",on);return}
  if($(".app").classList.contains("drawer")&&!e.target.closest(".browser-p")&&!e.target.closest(".ctx,.ov")&&matchMedia("(max-width:1100px)").matches){$(".app").classList.remove("drawer");const d=$("#drawerBtn");if(d)d.setAttribute("aria-expanded","false")}});

/* ---------- 10. hosted copies: AI Settings (free on-device model, Gemini free key, OpenRouter/Groq/Ollama, or Claude) ---------- */
if(HOSTED&&!CFG.claudeProxy){
  const _gsH=getSample;getSample=async function(){const s=await _gsH();if(!s&&navigator.userActivation&&navigator.userActivation.isActive&&!$("#sh-claude"))openAISettings();return s};
  (function(){const fm=$("#fileMenu");const ab=fm&&fm.querySelector('[data-fm="about"]');if(ab&&!fm.querySelector("[data-connectclaude]"))ab.insertAdjacentHTML("beforebegin",`<button role="menuitem" data-connectclaude="1">AI Settings…</button>`)})();
  const _clH=cmdList;cmdList=function(){const L=_clH();L.push({g:"AI",l:"AI settings ("+aiLabel()+")",f:openAISettings});return L};
  setInterval(()=>{const t=$("#liveTxt");if(t&&/idle|not connected|not set up|^AI:/i.test(t.textContent))t.textContent=aiReady()?"AI: "+aiLabel():"AI not set up"},1500);
  document.addEventListener("click",e=>{if(e.target.closest("#liveBtn")&&!aiReady()){e.preventDefault();e.stopImmediatePropagation();openAISettings()}},true);
  /* the chat panel is rebuilt by assistPanel(), so the card goes in there */
  const _apH=assistPanel;assistPanel=function(){_apH();if(aiReady())return;const a=$("#assist");if(!a||a.querySelector(".ccard"))return;
    a.insertAdjacentHTML("afterbegin",`<div class="ccard"><b>Set up AI to edit by asking</b><p>Free options: Google Gemini with a free key (recommended), OpenRouter or Groq free models, or a small model that runs in this browser.</p><button class="btn purple sm" data-connectclaude="1">Choose an AI</button></div>`)};
}

/* hosted copies may run Gemini, a free model or the offline reader, so name the tab and panel "AI" there */
if(HOSTED&&!CFG.claudeProxy){
  const relabel=()=>{const tb=document.querySelector('#itabs [data-itab="claude"],#itabs button[data-t="claude"]')||[...document.querySelectorAll("#itabs button")].find(b=>b.textContent.trim()==="Claude");if(tb&&aiConf().p!=="claude")tb.textContent="AI";
    const a=$("#assist");if(a&&aiConf().p!=="claude"){a.setAttribute("aria-label","AI");const t=$("#asText");if(t&&/Claude/.test(t.placeholder))t.placeholder=t.placeholder.replace(/Claude/g,"the AI")}
    if(aiConf().p==="claude")return;
    /* swap the word in visible text only (never ids, data or user content such as clip names) */
    ["#assist .hello","#tlc .etl-empty","#bgLbl","#vArea .welcome"].forEach(sel=>document.querySelectorAll(sel).forEach(el=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))if(/\bClaude\b/.test(n.nodeValue)&&!n.parentElement.closest(".turn,.msg,.ccard"))n.nodeValue=n.nodeValue.replace(/Edit with Claude/g,"Edit with AI").replace(/Tell Claude/g,"Tell the AI").replace(/\bClaude\b/g,"AI")}))};
  const _rnL=render;render=function(){_rnL();relabel()};const _apL=assistPanel;assistPanel=function(){_apL();relabel()};
}

/* ---------- accessibility: every file picker gets a name screen readers can announce ---------- */
(function(){const names={".srt":"Import captions",".cube":"Import a LUT",".editbay":"Open a project file","video/*":"Import media"};
  const label=()=>document.querySelectorAll('input[type=file]:not([aria-label])').forEach(i=>{const a=i.accept||"";const k=Object.keys(names).find(x=>a.includes(x));i.setAttribute("aria-label",k?names[k]:(a.includes(".json")?"Import a transcript":"Choose a file"))});
  label();setTimeout(label,1000);new MutationObserver(label).observe(document.body,{childList:true})})();
