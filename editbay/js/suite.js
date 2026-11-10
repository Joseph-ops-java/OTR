/* Edit Bay — product shell: File menu, project files (.editbay), versions, EDL + still export, storage manager with cloud proxies,
   relinking of offline media, save status, welcome screen and About. */
const APP_VERSION="Beta 1.0";
document.querySelectorAll("[data-ic]").forEach(el=>el.insertAdjacentHTML("afterbegin",ic(el.dataset.ic)));

/* ---------- save status ---------- */
function renderSaveChip(){const c=$("#saveChip");if(!c)return;const busy=!!E.saveT||Object.keys(timers).some(k=>k!=="__r"&&timers[k]);
  const where=state.cloud?"Saved to your account":IDB_OK?"Saved on this device":"Not saved: storage is off in this browser";
  c.className="savechip"+(busy?" busy":"")+(!state.cloud&&!IDB_OK?" warn":"");c.innerHTML=ic(state.cloud?"cloud":"device")+`<span>${busy?"Saving…":where}</span>`;
  c.title=state.cloud?"Projects sync to your account. Large media stays on this device.":"Projects and media are kept in this browser. Use File › Save Project File to back up or move a project."}
setInterval(renderSaveChip,800);

/* ---------- media status (used by the Browser) ---------- */
const hasSource=m=>!!blobUrl(m);
function mediaBadge(m){if(!hasSource(m))return`<span class="mb off">OFFLINE</span>`;if(m.localId&&!m.assetId&&state.cloud)return`<span class="mb dev">DEVICE</span>`;if(m.proxy)return`<span class="mb px">PROXY</span>`;return""}
function mediaActions(m){if(!hasSource(m))return` · <span class="lnk" data-relink="${esc(m.id)}">relink</span>`;
  let h="";if(m.kind==="video"&&typeof FAST_OK!=="undefined"&&FAST_OK&&!m.pxLocalId)h+=` · <span class="lnk" data-optimize="${esc(m.id)}" title="Make a light copy for smooth playback (exports still use the original)">optimize</span>`;
  if(m.localId&&!m.assetId&&assets&&!assets.local)h+=` · <span class="lnk" data-proxy="${esc(m.id)}">make cloud proxy</span>`;return h}

/* ---------- File menu ---------- */
const fm=$("#fileMenu"),fmb=$("#fileMenuBtn");
function menu(open){const ib=$("#inboxItem");if(ib)ib.hidden=!(typeof ISOWNER!=="undefined"&&ISOWNER&&RAWDB);const on=open==null?fm.hidden:open;fm.hidden=!on;fmb.setAttribute("aria-expanded",on);if(on){const r=fmb.getBoundingClientRect();fm.style.left=r.left+"px";fm.style.top=(r.bottom+4)+"px";const f=fm.querySelector("button");f&&f.focus()}}
fmb.addEventListener("click",e=>{e.stopPropagation();menu()});
document.addEventListener("click",e=>{if(!fm.hidden&&!e.target.closest("#fileMenu"))menu(false)},true);
fm.addEventListener("keydown",e=>{const b=[...fm.querySelectorAll("button")],i=b.indexOf(document.activeElement);if(e.key==="ArrowDown"){e.preventDefault();b[(i+1)%b.length].focus()}if(e.key==="ArrowUp"){e.preventDefault();b[(i-1+b.length)%b.length].focus()}if(e.key==="Escape"){menu(false);fmb.focus()}});
fm.addEventListener("click",e=>{const b=e.target.closest("[data-fm],[data-tourstart],[data-fb],[data-fblocal],[data-inbox]");if(!b)return;menu(false);fileAction(b.dataset.fm)});
$("#helpBtn").addEventListener("click",()=>{state.modal="keys";E.x=null;showKeys()});
function needProject(){if(cur())return true;toast("NO PROJECT","Create or open a project first.");return false}
function fileAction(k){if(!k)return;
  if(k==="new"){state.modal="new";render()}
  else if(k==="import"){if(needProject())$("#fileIn").click()}
  else if(k==="captions"){if(needProject())srtIn.click()}
  else if(k==="openproj")$("#projIn").click();
  else if(k==="version"){if(needProject())openSuite("ver")}
  else if(k==="versions"){if(needProject())openSuite("vers")}
  else if(k==="dup"){if(needProject())duplicateProject()}
  else if(k==="export"){if(needProject())openExport()}
  else if(k==="frame"){if(needProject())exportFrame()}
  else if(k==="edl"){if(needProject())exportEDL()}
  else if(k==="fcpxml"){if(needProject())exportFCPXML()}
  else if(k==="saveproj"){if(needProject())saveProjectFile()}
  else if(k==="create")openCreate();
  else if(k==="undohist"){if(needProject()){state.modal="hist";$("#modal").dataset.k="";render()}}
  else if(k==="history"){if(needProject()){state.ttab="history";render()}}
  else if(k==="storage")openSuite("storage");
  else if(k==="about")openSuite("about")}
function fname(s){return String(s||"Edit Bay").replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"_")||"edit"}
async function saveFile(name,data){const d=downloads||(window.claude?null:LDOWN);if(!d){toast("CAN’T SAVE FILES HERE","This view doesn’t allow saving files. Open Edit Bay on claude.ai while signed in.");return}
  try{await d.save({filename:name,data});toast("SAVED",name)}catch(e){if(!e||e.code!=="declined")toast("COULDN’T SAVE",(e&&e.message)||"Try again.")}}

/* ---------- still frame, EDL, project file ---------- */
function exportFrame(){if(!E.tl)return;pause();const c=document.createElement("canvas");E.compare=false;drawFrame(c);requestDraw();
  c.toBlob(b=>{if(b)saveFile(fname(cur().title)+"_"+tcs(E.t).replace(/:/g,"-")+".png",b)},"image/png")}
function exportEDL(){const tl=E.tl;if(!tl||!tl.clips.length){toast("EDL","The timeline is empty.");return}const fps=Math.round(tl.fps||30),T=s=>tcode(s,fps),REC=3600;let n=0,out=`TITLE: ${String(cur().title).toUpperCase().slice(0,60)}\nFCM: NON-DROP FRAME\n\n`;
  const ev=(trk,c)=>{const m=mediaOf(c.mediaId);n++;const reel=(m?m.name:"BL").replace(/\.[^.]+$/,"").replace(/[^A-Za-z0-9]/g,"").slice(0,8).toUpperCase()||"AX";const sp=c.speed||1;
    let line=`${String(n).padStart(3,"0")}  ${reel.padEnd(8)} ${trk.padEnd(5)} C        ${T(c.freeze?c.fz:c.in)} ${T(c.freeze?c.fz+cdur(c):c.in+cdur(c)*sp)} ${T(REC+c.start)} ${T(REC+cend(c))}\n`;
    if(sp!==1&&!c.freeze)line+=`M2   ${reel.padEnd(8)}       ${(fps*sp).toFixed(1).padStart(5)}                ${T(c.in)}\n`;line+=`* FROM CLIP NAME: ${m?m.name:c.name||"Clip"}\n`;if(c.tr&&c.tr.type)line+=`* TRANSITION IN: ${c.tr.type.toUpperCase()} ${(c.tr.d||.5).toFixed(2)} S\n`;return line+"\n"};
  v1().filter(c=>c.mediaId&&!c.off).forEach(c=>out+=ev("V",c));VTRACKS.filter(t=>t!=="V1").forEach(t=>tl.clips.filter(c=>c.track===t&&c.mediaId&&!c.off).sort((a,b)=>a.start-b.start).forEach(c=>out+=ev("V",c).replace("\n","\n* TRACK: "+t+"\n")));
  TRACKS.filter(t=>t[0]==="A").forEach((t,i)=>tl.clips.filter(c=>c.track===t&&!c.off).sort((a,b)=>a.start-b.start).forEach(c=>out+=ev(i?"A"+(i+1):"A",c)));
  saveFile(fname(cur().title)+".edl",new Blob([out],{type:"text/plain"}))}
function saveProjectFile(){const p=clone(cur());const tl=clone(E.tl||state.timelines[p.id]||null);const used=new Set((tl?tl.clips:[]).map(c=>c.mediaId).filter(Boolean));
  const media=projMedia().map(m=>{const o=clone(m);delete o.localId;delete o.url;delete o.local;o.used=used.has(m.id);return o});
  const data={app:"Edit Bay",format:1,version:APP_VERSION,savedAt:new Date().toISOString(),project:p,timeline:tl,media,luts:typeof packLuts==="function"?packLuts(tl):undefined};
  saveFile(fname(p.title)+".editbay",new Blob([JSON.stringify(data,null,1)],{type:"application/json"}))}
$("#projIn").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;let d;try{d=JSON.parse(await f.text())}catch(x){toast("CAN’T OPEN","That file isn’t an Edit Bay project.");return}
  if(!d||d.app!=="Edit Bay"||!d.project){toast("CAN’T OPEN","That file isn’t an Edit Bay project.");return}
  const pid=uid("p"),map={};const p=Object.assign(d.project,{id:pid,title:(d.project.title||"Project")+(state.projects.some(x=>x.title===d.project.title)?" (opened)":""),updatedAt:nowISO()});
  for(const m of d.media||[]){const nid=uid("m");map[m.id]=nid;const doc=Object.assign({},m,{projectId:pid});delete doc.id;delete doc.used;if(!(doc.assetId&&state.cloud))delete doc.assetId;state.media.push(Object.assign({id:nid},doc));if(db)await db.collection("media").doc(nid).set(doc).catch(saveErr)}
  const tl=d.timeline||newTL(defaultFormat(p));(tl.clips||[]).forEach(c=>{if(c.mediaId&&map[c.mediaId])c.mediaId=map[c.mediaId]});if(tl.mc)Object.values(tl.mc).forEach(mc=>mc.angles.forEach(a=>{if(map[a.mediaId])a.mediaId=map[a.mediaId]}));
  tl.rev=1;tl.updatedBy="joe";state.projects.push(p);persist(p);state.timelines[pid]=tl;if(db)db.doc("timelines/"+pid).set(clone(tl)).catch(saveErr);edSwitchProject(pid);
  const off=projMedia().filter(m=>!hasSource(m)).length;toast("PROJECT OPENED",p.title+(off?` · ${off} media file${off>1?"s are":" is"} offline. Import the originals (same file names) and they relink automatically.`:""))});
/* relink: importing a file with the same name as an offline clip reconnects it */
const _importFiles=importFiles;importFiles=async function(files){const before=new Set(state.media.map(m=>m.id));await _importFiles(files);
  const fresh=state.media.filter(m=>!before.has(m.id)&&m.projectId===E.pid);let n=0;
  fresh.forEach(m=>{const o=state.media.find(x=>x.projectId===E.pid&&before.has(x.id)&&!hasSource(x)&&x.name===m.name&&x.kind===m.kind);if(!o)return;n++;
    if(E.tl)edit(tl=>{tl.clips.forEach(c=>{if(c.mediaId===o.id)c.mediaId=m.id});if(tl.mc)Object.values(tl.mc).forEach(mc=>mc.angles.forEach(a=>{if(a.mediaId===o.id)a.mediaId=m.id}))});
    state.media=state.media.filter(x=>x.id!==o.id);if(db)db.doc("media/"+o.id).delete().catch(()=>{})});
  if(n){toast("RELINKED",n+" offline clip"+(n>1?"s":"")+" reconnected.");renderMediaBrowser();requestDraw()}};
document.addEventListener("click",e=>{const r=e.target.closest("[data-relink]");if(r){e.stopPropagation();$("#fileIn").click();return}
  const px=e.target.closest("[data-proxy]");if(px){e.stopPropagation();makeProxy(mediaOf(px.dataset.proxy))}
  const op=e.target.closest("[data-optimize]");if(op){e.stopPropagation();optimizeMedia(mediaOf(op.dataset.optimize))}},true);

/* ---------- duplicate + versions ---------- */
function duplicateProject(){const p=cur(),tl=clone(E.tl||state.timelines[p.id]);const pid=uid("p");const np=Object.assign(clone(p),{id:pid,title:p.title+" copy",createdAt:nowISO(),updatedAt:nowISO(),log:[{id:uid("e"),at:nowISO(),who:"joe",type:"stage",stage:p.stage,text:"Duplicated from "+p.title}]});
  const map={};projMedia().forEach(m=>{const nid=uid("m");map[m.id]=nid;const doc=Object.assign(clone(m),{projectId:pid});delete doc.id;state.media.push(Object.assign({id:nid},doc));if(db)db.collection("media").doc(nid).set(doc).catch(saveErr)});
  if(tl){tl.clips.forEach(c=>{if(map[c.mediaId])c.mediaId=map[c.mediaId]});if(tl.mc)Object.values(tl.mc).forEach(mc=>mc.angles.forEach(a=>{if(map[a.mediaId])a.mediaId=map[a.mediaId]}));tl.rev=1;state.timelines[pid]=tl;if(db)db.doc("timelines/"+pid).set(clone(tl)).catch(saveErr)}
  state.projects.push(np);persist(np);edSwitchProject(pid);toast("DUPLICATED",np.title)}
let VERS=[],versSub=null;
function watchVersions(){if(versSub||!db)return;versSub=db.collection("versions").onSnapshot(s=>{VERS=s.docs.map(d=>Object.assign({id:d.id},d.data()));if(state.modal==="vers"){$("#modal").dataset.k="";renderModal()}},()=>{})}
async function saveVersion(name){if(!E.tl||!db)return;const id=uid("v");const doc={projectId:E.pid,name:name||("Version "+(VERS.filter(v=>v.projectId===E.pid).length+1)),at:nowSec(),by:"joe",dur:+tlDur().toFixed(2),clips:E.tl.clips.length,tl:clone(E.tl)};
  try{await db.collection("versions").doc(id).set(doc);toast("VERSION SAVED",doc.name+" · restore it from File › Versions")}catch(e){saveErr(e)}}
function restoreVersion(id){const v=VERS.find(x=>x.id===id);if(!v||!v.tl)return;edit(tl=>{const keep={rev:tl.rev};Object.keys(tl).forEach(k=>delete tl[k]);Object.assign(tl,clone(v.tl),keep)});edViewerKey="";state.modal=null;render();toast("RESTORED",v.name+" · ⌘Z goes back")}

/* ---------- cloud proxies for large media ---------- */
async function makeProxy(m){if(!m||!m.localId)return;if(!assets||assets.local){toast("PROXY","Cloud proxies need Edit Bay open on claude.ai while signed in.");return}
  const src=LURL[m.localId];if(!src)return;const LIM=MAXMB*1048576*.9;const job={id:"px-"+m.id,name:m.name+" · proxy",proxy:true,pct:0};E.uploads.push(job);renderMediaBrowser();
  try{let blob;
    if(m.kind==="image"){const im=new Image();im.src=src;await im.decode();const sc=Math.min(1,3840/Math.max(im.naturalWidth,im.naturalHeight));const c=document.createElement("canvas");c.width=Math.round(im.naturalWidth*sc);c.height=Math.round(im.naturalHeight*sc);c.getContext("2d").drawImage(im,0,0,c.width,c.height);
      for(const q of[.9,.8,.65,.5]){blob=await new Promise(r=>c.toBlob(r,"image/jpeg",q));if(blob.size<LIM)break}}
    else if(m.kind==="video"&&typeof FAST_OK!=="undefined"&&FAST_OK){const dur=m.dur||1;const bits=LIM*8/dur;if(bits<300e3)throw new Error(`At ${Math.round(dur/60)} min this clip can’t fit a ${MAXMB} MB proxy. Split or trim it first.`);
      blob=await transcode(m,{maxEdge:1280,bitrate:Math.min(4e6,Math.max(250e3,bits-200e3)),fps:30,onp:f=>{job.pct=f;renderMediaBrowser()}})}
    else{const dur=m.dur||1;const bits=LIM*8/dur;if(bits<300e3)throw new Error(`At ${Math.round(dur/60)} min this clip can’t fit a ${MAXMB} MB proxy. Split or trim it first.`);
      const el=document.createElement(m.kind==="audio"?"audio":"video");el.src=src;el.crossOrigin="anonymous";el.playsInline=true;await loadMeta(el);
      const ac=new(window.AudioContext||window.webkitAudioContext)();const sn=ac.createMediaElementSource(el);const dst=ac.createMediaStreamDestination();sn.connect(dst);
      let stream,mime;if(m.kind==="video"){const sc=Math.min(1,1280/Math.max(el.videoWidth||1280,el.videoHeight||720));const c=document.createElement("canvas");c.width=Math.round((el.videoWidth||1280)*sc/2)*2;c.height=Math.round((el.videoHeight||720)*sc/2)*2;const x=c.getContext("2d");
        const draw=()=>{if(el.ended)return;x.drawImage(el,0,0,c.width,c.height);el.requestVideoFrameCallback?el.requestVideoFrameCallback(draw):requestAnimationFrame(draw)};draw();
        stream=c.captureStream(30);dst.stream.getAudioTracks().forEach(t=>stream.addTrack(t));mime=pickMime()}
      else{stream=dst.stream;mime=["audio/webm;codecs=opus","audio/mp4","audio/webm"].find(t=>{try{return MediaRecorder.isTypeSupported(t)}catch(e){return false}})}
      if(!mime)throw new Error("This browser can’t make proxies. Try Chrome or Edge.");
      const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.min(4e6,Math.max(250e3,bits-128e3)),audioBitsPerSecond:Math.min(128e3,bits*.2)});const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      const done=new Promise(r=>rec.onstop=r);rec.start(500);await ac.resume();await el.play();const tick=setInterval(()=>{job.pct=el.currentTime/dur;renderMediaBrowser()},700);
      await new Promise(r=>el.addEventListener("ended",r,{once:true}));clearInterval(tick);rec.stop();await done;ac.close();blob=new Blob(chunks,{type:mime.split(";")[0]})}
    if(blob.size>MAXMB*1048576)throw new Error("The proxy came out over "+MAXMB+" MB. Trim the clip and try again.");
    const a=await assets.upload(blob);const patch={assetId:a.id,proxy:true};delete m.deviceOnly;Object.assign(m,patch);if(db)await db.doc("media/"+m.id).update(Object.assign(patch,{deviceOnly:false}));
    toast("PROXY READY",m.name+" · "+fmtBytes(blob.size)+" in your account. This device keeps editing the original.")}
  catch(e){toast("PROXY FAILED",(e&&e.message)||"Try again.")}
  finally{E.uploads=E.uploads.filter(u=>u!==job);renderMediaBrowser()}}

/* ---------- dialogs ---------- */
function openSuite(k){pause();E.x=null;state.modal=k;$("#modal").dataset.k="";if(k==="vers"||k==="ver")watchVersions();render()}
async function suiteModal(k){const box=$("#modal");if(box.dataset.k===k)return;box.dataset.k=k;let h="";
  if(k==="ver")h=`<h3>Save Version</h3><div style="font-size:12px;color:var(--muted)">Keeps a copy of the timeline as it is now. You can restore it any time from File › Versions.</div><div class="f"><label for="verName">Name</label><input id="verName" placeholder="e.g. Client cut v2" autocomplete="off"></div><div class="acts"><button type="button" class="btn" data-sx="1">Cancel</button><button type="button" class="btn blue" id="vSave">Save version</button></div>`;
  else if(k==="vers"){const vs=VERS.filter(v=>v.projectId===E.pid).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    h=`<h3>Versions</h3>${vs.length?`<ul class="vlist">${vs.map(v=>`<li><span><b>${esc(v.name)}</b><small>${esc(fmtDT(parseD(v.at)))} · ${v.clips||0} clips · ${tcs(v.dur||0)}${v.by==="claude"?" · Claude":""}</small></span><span style="display:flex;gap:6px"><button class="btn sm" data-vrestore="${esc(v.id)}">Restore</button><button class="btn sm red" data-vdel="${esc(v.id)}">Delete</button></span></li>`).join("")}</ul>`:`<div style="font-size:12.5px;color:var(--muted)">No versions yet. Use File › Save Version (⌘S) before a big change.</div>`}<div class="acts"><button type="button" class="btn" data-sx="1">Close</button></div>`}
  else if(k==="storage"){const r=await LBLOB.room();const ms=projMedia();const sum=(f)=>ms.filter(f).reduce((s,m)=>s+(m.size||0),0);
    h=`<h3>Storage &amp; Media</h3>
    <div class="stbar">${r&&r.quota?`<div class="sb"><i style="width:${Math.min(100,r.used/r.quota*100).toFixed(1)}%"></i></div><div class="sm">${fmtBytes(r.used)} used on this device · ${fmtBytes(r.free)} free</div>`:`<div class="sm">This browser doesn’t report storage space.</div>`}</div>
    <div style="font-size:12px;color:var(--muted)">${state.cloud?`Projects sync to your account. Originals stay on this device at full size; files up to ${MAXMB} MB (or their proxies) also sync so Claude and your other devices can use them.`:`Everything is kept in this browser. Save a project file to back it up or move it to another computer.`}</div>
    ${ms.length?`<ul class="vlist">${ms.map(m=>`<li><span><b>${esc(m.name)}</b><small>${m.kind} · ${m.size?fmtBytes(m.size):"—"} · ${!hasSource(m)?"offline: import the original to relink":m.localId&&m.assetId?(m.proxy?"original on this device, proxy in your account":"on this device and in your account"):m.localId?"on this device only":"in your account"}</small></span><span style="display:flex;gap:6px">${mediaActions(m).includes("data-proxy")?`<button class="btn sm" data-proxy="${esc(m.id)}">Make proxy</button>`:""}</span></li>`).join("")}</ul>`:`<div style="font-size:12px;color:var(--dim)">No media in this project.</div>`}
    <div class="acts"><button type="button" class="btn" data-sx="1">Close</button></div>`}
  else if(k==="about")h=`<h3 style="display:flex;gap:8px;align-items:center">${ic("film")} Edit Bay <span class="mono" style="font-size:11px;color:var(--dim)">v${APP_VERSION}</span></h3>
    <div style="font-size:12.5px;line-height:1.55;display:flex;flex-direction:column;gap:8px">
    <p style="margin:0">A video editor that runs in your browser, with Claude as your assistant editor: Create from a prompt, a magnetic timeline with a Source viewer and three-point editing, multicam, transitions, keyframes, speed ramps, GPU colour with wheels, curves and LUTs, a mixer with EQ, compression and loudness metering, transcript editing, Auto Cut, and exports up to 4K.</p>
    <p style="margin:0"><b>Your media.</b> Footage stays in this browser unless you sync it. ${state.cloud?"Projects and small media sync to your claude.ai account.":"Nothing is uploaded while you work offline."}</p>
    <p style="margin:0"><b>AI features.</b> Claude Assist, Review and Smart Auto Cut send a description of your timeline and, for review and Auto Cut, small preview frames to Claude. Claude can make mistakes: check its edits before you deliver. Every AI edit can be undone with ⌘Z.</p>
    <p style="margin:0"><b>Exports</b> render frame by frame on your device to MP4 (H.264 with AAC, or Opus where the browser lacks AAC), labelled Rec.709, with loudness normalised to your target (−14, −16 or −23 LUFS) and peaks limited to −1 dB. Browsers without WebCodecs record in real time instead.</p>
    <p style="margin:0"><b>Interchange.</b> FCPXML for Final Cut Pro and DaVinci Resolve, EDL (CMX 3600), and .editbay project files.</p>
    <p style="margin:0;color:var(--dim)">Typefaces from Google Fonts under the SIL Open Font License. You are responsible for having the rights to the media and music you edit and publish.</p></div>
    <div class="acts"><button type="button" class="btn" id="aboutKeys">Keyboard shortcuts</button><button type="button" class="btn blue" data-sx="1">Done</button></div>`;
  box.innerHTML=`<div class="ov" id="ov"><div class="dlg au" role="dialog" aria-label="${esc(k)}">${h}</div></div>`;const n=$("#verName");if(n)n.focus()}
const SUITE_M=["ver","vers","storage","about"];
const _rm3=renderModal;renderModal=function(){if(SUITE_M.includes(state.modal)){suiteModal(state.modal);return}if(SUITE_M.includes($("#modal").dataset.k))$("#modal").dataset.k="";_rm3()};
document.addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;const d=t.dataset;
  if(d.sx){state.modal=null;$("#modal").dataset.k="";render()}
  else if(t.id==="vSave"){saveVersion($("#verName").value.trim());state.modal=null;$("#modal").dataset.k="";render()}
  else if(d.vrestore)restoreVersion(d.vrestore);
  else if(d.vdel){if(db)db.doc("versions/"+d.vdel).delete().catch(saveErr)}
  else if(t.id==="aboutKeys"){state.modal="keys";showKeys()}
  else if(d.welnew){state.modal="new";render()}else if(d.welopen)$("#projIn").click()});
document.addEventListener("keydown",e=>{if(e.target&&e.target.id==="verName"&&e.key==="Enter"){e.preventDefault();$("#vSave").click();return}
  const mod=e.metaKey||e.ctrlKey,code=e.code||"";if(state.modal&&code!=="KeyS")return;
  if(mod&&code==="KeyS"){e.preventDefault();if(cur())openSuite("ver");return}
  if(mod&&e.altKey&&code==="KeyZ"){e.preventDefault();e.stopImmediatePropagation();if(cur()){state.modal="hist";$("#modal").dataset.k="";render()}return}
  if(typing(e.target))return;
  if(mod&&e.altKey&&code==="KeyE"){e.preventDefault();e.stopImmediatePropagation();if(cur())exportFrame();return}
  if(mod&&code==="KeyI"){e.preventDefault();if(needProject())$("#fileIn").click();return}
  if(e.altKey&&!mod&&code==="KeyN"){e.preventDefault();state.modal="new";render()}},true);

/* ---------- welcome ---------- */
const _rv=renderViewer;renderViewer=function(){if(!cur()&&state.mode!=="loading"){$("#vName").textContent="Welcome";$("#vMeta").textContent="";$("#transport").innerHTML="";
    $("#vArea").innerHTML=`<div class="welcome">${ic("film","big")}<h2>Start editing</h2><p>Make a project, drop in footage of any size, and cut. Claude can edit alongside you: ask it in the Inspector, or let Auto Cut build a first cut to your music.</p><div class="wacts"><button class="btn blue" data-welnew="1">New project</button><button class="btn purple" data-create="1">Create from a prompt</button><button class="btn" data-welopen="1">Open project file…</button></div><small>Your media stays in this browser unless you choose to sync it.</small></div>`;return}
  _rv()};
window.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{watchVersions();renderSaveChip()},1500)});
/* never lose the last edit: flush the debounced timeline save when the page is hidden or closed */
function flushSaves(){if(E.saveT&&E.pid){clearTimeout(E.saveT);E.saveT=null;saveNow(E.pid)}Object.keys(timers).forEach(k=>{if(k==="__r")return;clearTimeout(timers[k]);delete timers[k];const p=state.projects.find(x=>x.id===k);if(p)persist(p)})}
window.addEventListener("pagehide",flushSaves);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushSaves()});
window.addEventListener("beforeunload",e=>{if(E.x&&E.x.phase==="running"||AU.busy||E.uploads.length){e.preventDefault();e.returnValue=""}flushSaves()});

/* ---------- FCPXML 1.9 (Final Cut Pro, DaVinci Resolve; Premiere via XtoCC) ---------- */
function exportFCPXML(){const tl=E.tl;if(!tl||!tl.clips.length){toast("FCPXML","The timeline is empty.");return}const fps=Math.round(tl.fps||30);
  const R=t=>`${Math.max(0,Math.round(t*fps))}/${fps}s`,X=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const used=[...new Set(tl.clips.filter(c=>c.mediaId&&!c.off).map(c=>c.mediaId))].map(mediaOf).filter(Boolean);const aid={};let rid=3;
  let res=`<format id="r1" name="FFVideoFormat${tl.h}p${fps}" frameDuration="1/${fps}s" width="${tl.w}" height="${tl.h}"/>\n<effect id="r2" name="Cross Dissolve" uid="FxPlug:4731E73A-8DAC-4113-9A30-AE85B1761265"/>\n<effect id="rT" name="Basic Title" uid=".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti"/>\n`;
  used.forEach(m=>{aid[m.id]="r"+(rid++);const d=m.kind==="image"?3600:(m.dur||1);res+=`<asset id="${aid[m.id]}" name="${X(m.name.replace(/\.[^.]+$/,""))}" start="0s" duration="${R(d)}" hasVideo="${m.kind!=="audio"?1:0}" hasAudio="${m.kind!=="image"?1:0}" format="r1" audioSources="1" audioChannels="2" audioRate="48000"><media-rep kind="original-media" src="file:///EditBayMedia/${encodeURIComponent(m.name)}"/></asset>\n`});
  const vol=c=>{const v=c.vol==null?1:c.vol;return v!==1&&v>0?`<adjust-volume amount="${(20*Math.log10(v)).toFixed(1)}dB"/>`:v===0?`<adjust-volume amount="-96dB"/>`:""};
  const xf=c=>{const s=c.scale||1;return s!==1||c.x||c.y||c.rot?`<adjust-transform position="${((c.x||0)*100).toFixed(2)} ${(-(c.y||0)*100).toFixed(2)}" scale="${s.toFixed(3)} ${s.toFixed(3)}" rotation="${-(c.rot||0)}"/>`:""};
  const note=c=>(c.ramp||c.reverse||(c.speed&&c.speed!==1)||c.freeze)?`<!-- Edit Bay: ${c.freeze?"freeze frame":c.reverse?"reverse":c.ramp?"speed ramp":"speed "+c.speed+"x"} is not carried over; re-apply it in the NLE -->`:"";
  const child=(c,host,hostIn,lane)=>{const off=hostIn+(c.start-host.start);if(c.type==="title"){const txt=X(String(c.text||"Title"));return`<title ref="rT" lane="${lane}" offset="${R(off)}" name="${X(txt.split("\n")[0])}" start="0s" duration="${R(cdur(c))}"><text><text-style ref="ts-${c.id}">${txt}</text-style></text><text-style-def id="ts-${c.id}"><text-style font="${X(c.font||"Helvetica")}" fontSize="${Math.round((c.size||8)/100*tl.h)}" fontColor="1 1 1 1" alignment="${c.align||"center"}"/></text-style-def></title>`}
    const m=mediaOf(c.mediaId);if(!m)return"";return`<asset-clip ref="${aid[m.id]}" lane="${lane}" offset="${R(off)}" name="${X(c.name||m.name)}" start="${R(c.freeze?(c.fz||0):Math.min(c.in,c.out))}" duration="${R(cdur(c))}"${m.kind==="audio"?' audioRole="dialogue"':""}>${note(c)}${xf(c)}${vol(c)}</asset-clip>`};
  const laneOf={V2:1,V3:2,A1:-1,A2:-2,A3:-3};const others=tl.clips.filter(c=>c.track!=="V1"&&!c.off);const spineClips=v1().filter(c=>!c.off);
  let spine="";let t=0;const hostFor=c=>spineClips.find(h=>c.start>=h.start-1e-6&&c.start<cend(h))||null;const placed=new Set();
  spineClips.forEach((h,i)=>{if(h.tr&&h.tr.type&&i>0){const d=Math.min(h.tr.d||.5,cdur(h),cdur(spineClips[i-1]));spine+=`<transition name="Cross Dissolve" offset="${R(h.start-d/2)}" duration="${R(d)}"><filter-video ref="r2" name="Cross Dissolve"/></transition>\n`}
    const m=mediaOf(h.mediaId),hin=h.type==="gap"||!m?0:(h.freeze?(h.fz||0):Math.min(h.in,h.out));
    const kids=others.filter(c=>!placed.has(c.id)&&hostFor(c)===h).map(c=>{placed.add(c.id);return child(c,h,hin,laneOf[c.track]||1)}).join("");
    const mk=(tl.markers||[]).filter(k=>k.kind!=="beat"&&k.t>=h.start&&k.t<cend(h)).map(k=>`<marker start="${R(hin+k.t-h.start)}" duration="1/${fps}s" value="${X(k.text||"Marker")}"/>`).join("");
    if(h.type==="gap"||!m||h.type==="title")spine+=`<gap name="Gap" offset="${R(h.start)}" start="0s" duration="${R(cdur(h))}">${kids}${mk}</gap>\n`;
    else spine+=`<${m.kind==="image"?"video":"asset-clip"} ref="${aid[m.id]}" offset="${R(h.start)}" name="${X(h.name||m.name)}" start="${R(hin)}" duration="${R(cdur(h))}">${note(h)}${xf(h)}${vol(h)}${mk}${kids}</${m.kind==="image"?"video":"asset-clip"}>\n`});
  const rest=others.filter(c=>!placed.has(c.id));if(rest.length){const s=Math.min(...rest.map(c=>c.start)),e=Math.max(...rest.map(cend)),g={start:s};spine+=`<gap name="Gap" offset="${R(Math.max(s,tlDurV1()))}" start="0s" duration="${R(e-Math.max(s,tlDurV1()))}">${rest.map(c=>child(c,{start:Math.max(s,tlDurV1())},0,laneOf[c.track]||1)).join("")}</gap>\n`}
  const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.9">\n<resources>\n${res}</resources>\n<library>\n<event name="Edit Bay">\n<project name="${X(cur().title)}">\n<sequence format="r1" duration="${R(tlDur())}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">\n<spine>\n${spine}</spine>\n</sequence>\n</project>\n</event>\n</library>\n</fcpxml>\n`;
  saveFile(fname(cur().title)+".fcpxml",new Blob([xml],{type:"application/xml"}));toast("FCPXML","Media is referenced by file name: relink to your originals when the NLE asks.")}
function tlDurV1(){const l=v1();return l.length?cend(l[l.length-1]):0}
