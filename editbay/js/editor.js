/* Edit Bay — editor engine: shared timeline model, canvas playback, magnetic timeline UI, media pool, clip inspector, export.
   The timeline lives in db at timelines/<projectId>; Claude edits the same document, so its changes land here live. */
const TRACKS=["V3","V2","V1","A1","A2","A3"];
const VTRACKS=["V1","V2","V3"];
const VIS=new Set(["video","image","title","gap"]);
const LEFT=76;            // px reserved for track headers
const MAXMB=20;
const FILTER_OK=typeof CanvasRenderingContext2D!=="undefined"&&"filter" in CanvasRenderingContext2D.prototype;
const FONTS=["Archivo","Anton","Bebas Neue","Barlow Condensed","Space Mono","Playfair Display","IBM Plex Mono","system-ui"];
const KF_PROPS=["scale","x","y","rot","op","vol"];
const TRANS=[["dissolve","Cross Dissolve"],["black","Dip to Black"],["white","Dip to White"],["push","Push"],["slide","Slide In"],["wipe","Wipe"],["zoom","Zoom Through"],["whip","Whip Pan"],["flash","Flash Cut"]];
let edViewerKey="";
const E={pid:null,tl:null,sel:new Set(),t:0,playing:false,rate:1,last:0,pps:null,tool:"select",snap:true,skim:true,undo:[],redo:[],
  saveT:null,drag:null,mediaSel:null,raf:0,skimT:null,flash:new Set(),pendingRemote:null,lastRemote:"",cpUndo:false,uploads:[],x:null,
  rin:null,rout:null,clip:null,safe:false,compare:false,noGrade:false,page:"edit",by:"joe"};

/* ---------- model helpers ---------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=(v,d)=>{const n=parseFloat(v);return isNaN(n)?d:n};
const fpsOf=()=>(E.tl&&E.tl.fps)||30;
const FR=()=>1/fpsOf();
/* speed ramps: c.ramp=[[u,speed],...] over the clip's normalised timeline position u (0..1) */
function rampAvg(r){let a=0;for(let i=1;i<r.length;i++)a+=(r[i][0]-r[i-1][0])*(r[i][1]+r[i-1][1])/2;return a||1}
function rampAt(r,u){for(let i=1;i<r.length;i++){const[u0,s0]=r[i-1],[u1,s1]=r[i];if(u<=u1)return s0+(s1-s0)*(u-u0)/((u1-u0)||1)}return r[r.length-1][1]}
function rampInt(r,u){let a=0;for(let i=1;i<r.length;i++){const[u0,s0]=r[i-1],[u1]=r[i];if(u<=u0)break;const ue=Math.min(u,u1);a+=(ue-u0)*(s0+rampAt(r,ue))/2;if(u<=u1)break}return a}
function subRamp(r,a,b){const pts=[[0,rampAt(r,a)]];r.forEach(([u,s])=>{if(u>a&&u<b)pts.push([(u-a)/(b-a),s])});pts.push([1,rampAt(r,b)]);return pts}
const cdur=c=>Math.max(FR(),c.ramp&&c.ramp.length>1?(c.out-c.in)/rampAvg(c.ramp):(c.out-c.in)/(c.speed||1));
function rampSpeed(c,t){if(!c.ramp)return c.speed||1;return rampAt(c.ramp,clamp((t-c.start)/cdur(c),0,1))}
const cend=c=>c.start+cdur(c);
const tlDur=()=>E.tl&&E.tl.clips.length?Math.max(...E.tl.clips.map(cend)):0;
const mediaOf=id=>state.media.find(m=>m.id===id);
const projMedia=()=>state.media.filter(m=>m.projectId===E.pid).sort((a,b)=>String(a.at||"").localeCompare(String(b.at||"")));
const clipById=id=>E.tl&&E.tl.clips.find(c=>c.id===id);
const trackOn=tr=>!E.tl||!E.tl.tracks||!E.tl.tracks[tr]||E.tl.tracks[tr].on!==false;
const trackLocked=tr=>!!(E.tl&&E.tl.tracks&&E.tl.tracks[tr]&&E.tl.tracks[tr].lock);
const isVisTrack=tr=>tr[0]==="V";
const okTrack=(c,tr)=>c.type==="audio"?!isVisTrack(tr):isVisTrack(tr);
const v1=()=>E.tl.clips.filter(c=>c.track==="V1").sort((a,b)=>a.start-b.start);
const tcs=s=>tcode(s,fpsOf());
const isStill=c=>c.type==="title"||c.type==="image"||c.type==="gap"||!!c.freeze;
/* keyframes: c.kf[prop]=[[t,v],...] with t relative to clip start (timeline seconds) */
function kv(c,k,t){const base=c[k]==null?(k==="scale"||k==="op"||k==="vol"?1:0):c[k];const ks=c.kf&&c.kf[k];if(!ks||!ks.length||t==null)return base;
  const r=t-c.start;if(r<=ks[0][0])return ks[0][1];const L=ks[ks.length-1];if(r>=L[0])return L[1];
  for(let i=1;i<ks.length;i++){const a=ks[i-1],b=ks[i];if(r<=b[0]){let u=(r-a[0])/Math.max(1e-6,b[0]-a[0]);if(b[2]!=="lin")u=u*u*(3-2*u);return a[1]+(b[1]-a[1])*u}}return base}
function kfAt(c,k,t){const ks=c.kf&&c.kf[k];if(!ks)return -1;const r=t-c.start;return ks.findIndex(x=>Math.abs(x[0]-r)<.5/fpsOf())}
function setKf(c,k,t,v){c.kf=c.kf||{};const ks=c.kf[k]=c.kf[k]||[];const r=+clamp(t-c.start,0,cdur(c)).toFixed(4);const i=kfAt(c,k,t);if(i>=0)ks[i][1]=v;else{ks.push([r,v]);ks.sort((a,b)=>a[0]-b[0])}}
/* the V1 neighbours of a storyline clip, and its incoming transition half-length */
function v1Prev(c){const l=v1();const i=l.findIndex(x=>x.id===c.id);return i>0?l[i-1]:null}
function v1Next(c){const l=v1();const i=l.findIndex(x=>x.id===c.id);return i>=0&&i<l.length-1?l[i+1]:null}
function trHalf(c){if(!c||c.track!=="V1"||!c.tr||!c.tr.type)return 0;const p=v1Prev(c);if(!p)return 0;return Math.min(c.tr.d||.5,cdur(c),cdur(p))/2}
function winOf(c){if(c.track!=="V1")return[c.start,cend(c)];const n=v1Next(c);const aw=typeof audWin==="function"?audWin(c):[c.start,cend(c)];return[Math.min(c.start-trHalf(c),aw[0]),Math.max(cend(c)+trHalf(n),aw[1])]}
function shortTC(s,step){s=Math.max(0,s);const m=Math.floor(s/60),sec=Math.floor(s%60),f=Math.round((s%1)*fpsOf());return step<1?`${m}:${pad(sec)}:${pad(f%fpsOf())}`:`${m}:${pad(sec)}`}

function newTL(o){return{v:1,w:o.w||1080,h:o.h||1920,fps:o.fps||30,bg:"#000000",bars:0,tracks:{V3:{on:true},V2:{on:true},V1:{on:true},A1:{on:true},A2:{on:true},A3:{on:true}},clips:[],markers:[],rev:0,updatedAt:nowSec(),updatedBy:"joe"}}
function defaultFormat(p){const f=(p&&p.formats)||[];const vert=f[0]==="9:16"||f[0]==="4:5"||(!f.includes("16:9")&&f.includes("9:16"));
  const sq=f[0]==="1:1";return{w:sq?1080:vert?1080:1920,h:sq?1080:vert?(f[0]==="4:5"?1350:1920):1080,fps:Math.round(parseFloat(p&&p.fps)||30)}}
function getTL(){if(!E.tl&&E.pid){E.tl=newTL(defaultFormat(cur()))}return E.tl}
function edCreateTimeline(pid,o){state.timelines[pid]=newTL(o);if(db){const b=clone(state.timelines[pid]);db.doc("timelines/"+pid).set(b).catch(saveErr)}}

function newClip(m,track,start){const dur=m.kind==="image"?4:(m.dur||5);
  return{id:uid("c"),track,type:m.kind,mediaId:m.id,name:m.name,start,in:0,out:dur,speed:1,vol:1,op:1,scale:1,x:0,y:0,rot:0,fit:"fit",fadeIn:0,fadeOut:0,bri:0,con:0,sat:0,by:"joe"}}
function newTitle(start){return{id:uid("c"),track:"V2",type:"title",name:"Title",start,in:0,out:3,speed:1,op:1,scale:1,x:0,y:0,rot:0,fadeIn:.25,fadeOut:.25,
  text:"Title",font:"Archivo",weight:900,italic:false,size:8,color:"#ffffff",align:"center",yPos:50,box:false,boxColor:"#000000",boxOp:.5,anim:"rise",shadow:true,by:"joe"}}

/* magnetic primary storyline: V1 is always packed; connected clips ride with the V1 clip they're linked to */
function repack(order){const list=order||v1();const deltas={};let t=0;
  list.forEach(c=>{const ns=+t.toFixed(5);deltas[c.id]=ns-c.start;c.start=ns;t+=cdur(c)});
  E.tl.clips.forEach(c=>{if(c.track!=="V1"&&c.link&&deltas[c.link]!=null)c.start=Math.max(0,+(c.start+deltas[c.link]).toFixed(5))})}
function relink(c){if(c.track==="V1"){delete c.link;return}const base=v1();const host=base.find(b=>c.start>=b.start-1e-6&&c.start<cend(b))||base.filter(b=>b.start<=c.start).pop();c.link=host?host.id:null}
function resolveTrack(tr,keepId){const list=E.tl.clips.filter(c=>c.track===tr).sort((a,b)=>(a.start-b.start)||(a.id===keepId?-1:b.id===keepId?1:0));
  for(let i=1;i<list.length;i++){const p=list[i-1],c=list[i],ov=c.type==="audio"&&c.xf>0?Math.min(c.xf,cdur(c)/2,cdur(p)/2):0;if(c.start<cend(p)-ov-1e-6)c.start=+(cend(p)-ov).toFixed(5)}}
function normalize(){if(!E.tl)return;const ids=new Set(E.tl.clips.map(c=>c.id));
  E.tl.clips.forEach(c=>{if(c.track!=="V1"&&c.link&&!ids.has(c.link))relink(c)});repack();
  TRACKS.filter(t=>t!=="V1").forEach(tr=>resolveTrack(tr));E.sel.forEach(id=>{if(!ids.has(id))E.sel.delete(id)})}

/* ---------- undo / commit / sync to Claude ---------- */
function pushUndo(snap){E.undo.push(snap||JSON.stringify(E.tl));if(E.undo.length>100)E.undo.shift();E.redo=[]}
function edit(fn,{undo=true}={}){if(!getTL())return;if(undo)pushUndo();fn(E.tl);normalize();commit();edRefresh()}
function commit(){const tl=E.tl;if(!tl||!E.pid)return;tl.rev=(tl.rev||0)+1;tl.updatedAt=nowSec();tl.updatedBy=E.by||"joe";E.ownRev=tl.rev;if(E.by!=="claude")delete tl.note;
  state.timelines[E.pid]=clone(tl);clearTimeout(E.saveT);const pid=E.pid;E.saveT=setTimeout(()=>{E.saveT=null;saveNow(pid)},500)}
function saveNow(pid){if(!db)return;const body=clone(state.timelines[pid]);if(!body)return;delete body.id;db.doc("timelines/"+pid).set(body).catch(saveErr)}
function undo(){if(!E.undo.length)return;E.redo.push(JSON.stringify(E.tl));E.tl=JSON.parse(E.undo.pop());normalize();commit();edRefresh()}
function redo(){if(!E.redo.length)return;E.undo.push(JSON.stringify(E.tl));E.tl=JSON.parse(E.redo.pop());normalize();commit();edRefresh()}
function edOnTimelines(list){
  list.forEach(doc=>{const id=doc.id;delete doc.id;const have=state.timelines[id];
    if(!have||(doc.rev||0)>(have.rev||0)||doc.updatedBy!=="joe")state.timelines[id]=doc;
    if(id!==E.pid)return;
    if(!E.tl){E.tl=clone(doc);edViewerKey="";render();return}
    const key=(doc.rev||0)+"|"+doc.updatedAt+"|"+doc.updatedBy;
    const mine=(doc.rev||0)<=(E.tl.rev||0)&&(doc.updatedBy==="joe"||(E.ownRev||0)>=(doc.rev||0));
    if(mine||key===E.lastRemote)return;
    if(JSON.stringify(stripMeta(doc))===JSON.stringify(stripMeta(E.tl))){E.lastRemote=key;return}
    if(E.drag){E.pendingRemote=doc;return}
    applyRemote(doc,key)});
  if(state.btab==="projects")renderCards();
}
const stripMeta=t=>{const o=clone(t);["rev","updatedAt","updatedBy","note","id"].forEach(k=>delete o[k]);return o};
function applyRemote(doc,key){
  E.lastRemote=key||((doc.rev||0)+"|"+doc.updatedAt+"|"+doc.updatedBy);
  const before=new Map(E.tl.clips.map(c=>[c.id,JSON.stringify(c)]));
  pushUndo();clearTimeout(E.saveT);E.saveT=null;
  E.tl=clone(doc);E.tl.rev=Math.max(E.tl.rev||0,(JSON.parse(E.undo[E.undo.length-1]).rev||0));
  const changed=E.tl.clips.filter(c=>before.get(c.id)!==JSON.stringify(c)).map(c=>c.id);const removed=[...before.keys()].filter(id=>!clipById(id)).length;
  E.flash=new Set(changed);setTimeout(()=>{E.flash.clear()},2600);
  normalize();
  if(doc.updatedBy!=="joe"){const who=doc.updatedBy==="claude"?"CLAUDE EDITED THE TIMELINE":"TIMELINE UPDATED";
    toast(who,(doc.note?doc.note+" · ":"")+(changed.length?changed.length+" clip"+(changed.length>1?"s":"")+" changed":"")+(removed?(changed.length?", ":"")+removed+" removed":"")+" · ⌘Z to undo")}
  edRefresh();
}
function edRefresh(){edGC();renderItabs();renderInsp();renderDash();renderTools();if(state.ixtab!=="log")renderIndex();if(state.ttab==="edit")edTimeline();edViewerEmpty();requestDraw();if(state.btab==="projects")renderCards()}

function edSwitchProject(id,silent){
  pause();clearEls();if(E.saveT){clearTimeout(E.saveT);E.saveT=null;if(E.pid)saveNow(E.pid)}
  state.sel=id;E.pid=id;E.tl=id&&state.timelines[id]?clone(state.timelines[id]):null;E.sel.clear();E.t=0;E.undo=[];E.redo=[];E.pps=null;E.mediaSel=null;E.lastRemote="";
  state.hl=null;state.confirmDel=false;state.ver=null;state.vmode="timeline";if(state.itab==="clip")state.itab="info";edViewerKey="";rKey="";
  if(!silent)render();
}

/* ---------- media: import, thumbnails, waveforms ---------- */
const TH={};const jobs=[];let jobBusy=false;
function edOnMedia(list){state.media=list.concat(state.media.filter(m=>m.local&&!list.find(x=>x.id===m.id)));list.forEach(m=>{if(m.projectId===E.pid)queueThumbs(m)});
  if(state.btab==="media")renderMediaBrowser();if(state.ttab==="edit")edTimeline();requestDraw()}
function queueThumbs(m){if(TH[m.id])return;TH[m.id]={busy:true};jobs.push(m);runJobs()}
async function runJobs(){if(jobBusy)return;jobBusy=true;
  while(jobs.length){const m=jobs.shift();const th=TH[m.id];
    try{if(m.kind==="video"){Object.assign(th,await makeStrip(m));th.wave=await makeWave(m).catch(()=>null)}
      else if(m.kind==="audio"){th.wave=await makeWave(m)}
      else if(m.kind==="image"){th.thumb=blobUrl(m)}}catch(e){th.err=true}
    th.busy=false;if(state.btab==="media")renderMediaBrowser();if(state.ttab==="edit")edTimeline()}
  jobBusy=false}
function seekTo(v,t){return new Promise(res=>{let done=false;const fin=()=>{if(done)return;done=true;v.removeEventListener("seeked",fin);res()};v.addEventListener("seeked",fin);v.currentTime=t;setTimeout(fin,2000)})}
function loadMeta(el){return new Promise(res=>{if(el.readyState>=1)return res(true);const ok=()=>res(true);el.addEventListener("loadedmetadata",ok,{once:true});el.addEventListener("error",()=>res(false),{once:true});setTimeout(()=>res(false),10000)})}
async function makeStrip(m){const v=document.createElement("video");v.muted=true;v.preload="auto";v.playsInline=true;v.src=blobUrl(m);
  if(!await loadMeta(v))throw new Error("meta");const dur=v.duration||m.dur||1,ar=(v.videoWidth||16)/(v.videoHeight||9);
  const n=clamp(Math.ceil(dur/1.2),4,28),fh=64,fw=Math.max(16,Math.round(fh*ar));
  const cv=document.createElement("canvas");cv.width=n*fw;cv.height=fh;const ctx=cv.getContext("2d");let thumb=null;
  for(let i=0;i<n;i++){await seekTo(v,Math.min(dur-.05,(i+.5)*dur/n));try{ctx.drawImage(v,i*fw,0,fw,fh)}catch(e){}
    if(i===Math.floor(n/2)){const tc=document.createElement("canvas");tc.width=240;tc.height=Math.round(240/ar);try{tc.getContext("2d").drawImage(v,0,0,tc.width,tc.height);thumb=tc.toDataURL("image/jpeg",.75)}catch(e){}}}
  v.removeAttribute("src");v.load();return{strip:cv.toDataURL("image/jpeg",.7),thumb,dur}}
async function makeWave(m){const buf=await(await fetch(blobUrl(m))).arrayBuffer();
  const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;const oc=new OAC(1,2,44100);
  const ab=await new Promise((res,rej)=>{const p=oc.decodeAudioData(buf,res,rej);if(p&&p.then)p.then(res,rej)});
  const ch=ab.getChannelData(0),N=Math.min(3000,Math.max(200,Math.ceil(ab.duration*50))),step=Math.floor(ch.length/N)||1;
  const cv=document.createElement("canvas");cv.width=N;cv.height=48;const ctx=cv.getContext("2d");ctx.fillStyle="#9be8b0";
  for(let i=0;i<N;i++){let mx=0;for(let j=i*step,e=Math.min(ch.length,j+step);j<e;j+=4){const a=Math.abs(ch[j]);if(a>mx)mx=a}const h=Math.max(1,Math.pow(mx,.7)*46);ctx.fillRect(i,24-h/2,1,h)}
  return cv.toDataURL("image/png")}
function probe(file,url){return new Promise(res=>{const k=file.type.split("/")[0];
  if(k==="image"){const i=new Image();i.onload=()=>res({kind:"image",w:i.naturalWidth,h:i.naturalHeight,dur:4});i.onerror=()=>res(null);i.src=url;return}
  const el=document.createElement(k==="audio"?"audio":"video");el.preload="metadata";el.src=url;
  el.onloadedmetadata=()=>res({kind:k==="audio"?"audio":"video",w:el.videoWidth||0,h:el.videoHeight||0,dur:el.duration||0});el.onerror=()=>res(null);setTimeout(()=>res(null),12000)})}
async function importFiles(files){
  const p=cur();if(!p){state.note="Pick or create a project first.";renderNote();return}
  const room=await LBLOB.room();
  for(const f of files){
    if(!/^(video|audio|image)\//.test(f.type)){toast("SKIPPED",f.name+" isn’t a video, audio or image file.");continue}
    if(room&&room.quota&&f.size>room.free*.92){state.note=`${f.name} is ${fmtBytes(f.size)}, but this browser has only ${fmtBytes(room.free)} free for Edit Bay. Free up disk space or import a smaller file.`;renderNote();continue}
    const tmp=URL.createObjectURL(f);const info=await probe(f,tmp);if(!info){toast("COULDN’T READ",f.name+" (the format may not be supported by this browser: try MP4/H.264, MOV, WebM, MP3, WAV, JPG or PNG)");continue}
    const mid=uid("m");const base={projectId:p.id,name:f.name,kind:info.kind,dur:+(info.dur||0).toFixed(3),w:info.w,h:info.h,size:f.size,by:"joe",at:nowSec()};
    E.uploads.push({id:mid,name:f.name,size:f.size});renderMediaBrowser();
    let localId=null,assetId=null,big=false;
    if(IDB_OK){try{localId=await LBLOB.put(f)}catch(e){localId=null}}
    if(assets&&!assets.local){if(f.size<=MAXMB*1048576){try{assetId=(await assets.upload(f)).id}catch(e){if(!localId){state.note="Import of "+f.name+" failed ("+((e&&e.code)||"error")+").";renderNote()}}}else big=true}
    E.uploads=E.uploads.filter(u=>u.id!==mid);
    if(!localId&&!assetId){const m=Object.assign({id:mid,url:tmp,local:true},base);state.media.push(m);queueThumbs(m);E.mediaSel=mid;renderMediaBrowser();continue}
    URL.revokeObjectURL(tmp);const doc=Object.assign({},base,localId?{localId}:{},assetId?{assetId}:{},big?{deviceOnly:true}:{});
    state.media.push(Object.assign({id:mid},doc));queueThumbs(state.media[state.media.length-1]);
    if(db){try{await db.collection("media").doc(mid).set(doc)}catch(e){saveErr(e)}}addLog(p.id,{text:"Imported "+f.name});
    if(big)toast("KEPT ON THIS DEVICE",`${f.name} (${fmtBytes(f.size)}) is stored in this browser at full quality. Select it and choose “Make cloud proxy” so Claude and your other devices can use it too.`);
    E.mediaSel=mid;renderMediaBrowser()}
}
function renderMediaBrowser(){
  $("#bacts").innerHTML=`<button class="btn" data-addtitle="1" title="Add a title at the playhead (T)">+ Title</button><button class="btn blue" id="impBtn" title="Import video, audio or images">Import Media</button>`;
  let g=$("#bbody").querySelector(".media");if(!g){$("#bbody").innerHTML=`<div class="media" id="mgrid"></div>`;g=$("#mgrid")}
  const p=cur();if(!p){g.innerHTML=`<div class="mhint">Pick a project in the Projects tab.</div>`;return}
  const list=projMedia();
  const items=list.map(m=>{const th=TH[m.id]||{};const sel=E.mediaSel===m.id;
    const bg=m.kind==="image"?`background-image:url('${esc(blobUrl(m))}')`:th.thumb?`background-image:url('${th.thumb}')`:m.kind==="audio"&&th.wave?`background-image:url('${th.wave}');background-size:100% 60%;background-repeat:no-repeat`:"";
    return`<button class="mitem" draggable="true" data-media="${esc(m.id)}" aria-selected="${sel}" title="${esc(m.name)} · select and press E to append, Q to connect, W to insert">
      <span class="th ${m.kind==="audio"?"aud":""}" style="${bg}"><span class="k">${m.kind==="video"?"VIDEO":m.kind==="audio"?"AUDIO":"IMAGE"}</span>${m.by==="claude"?`<span class="by">CLAUDE</span>`:""}${mediaBadge(m)}${m.kind!=="image"?`<span class="d">${esc(shortTC(m.dur||0,1))}</span>`:""}${th.busy?`<span class="busy">Reading…</span>`:""}</span>
      <span class="nm">${esc(m.name)}</span><span class="sub">${m.w&&m.h?m.w+"×"+m.h+" · ":""}${m.size?fmtBytes(m.size):""}${sel?`${mediaActions(m)} · <span data-delmedia="${esc(m.id)}" style="color:#ff8a80;cursor:pointer">remove</span>`:""}</span></button>`}).join("");
  const ups=E.uploads.map(u=>`<div class="mitem"><span class="th"><span class="busy">${u.proxy?"Making proxy… "+Math.round((u.pct||0)*100)+"%":"Importing…"}</span></span><span class="nm">${esc(u.name)}</span>${u.size?`<span class="sub">${fmtBytes(u.size)}</span>`:""}</div>`).join("");
  const title=`<button class="mitem" draggable="true" data-media="__title" aria-selected="${E.mediaSel==="__title"}" title="Basic title · drag to the timeline or press T"><span class="th ttl">Aa</span><span class="nm">Basic Title</span><span class="sub">Generator</span></button>`;
  g.innerHTML=title+ups+items+`<div class="mhint">Drop video, audio or images here, any size your disk can hold. Originals stay on this device${assets&&!assets.local?`; files up to ${MAXMB} MB also sync to your account`:""}. Select a clip and press <span class="kbd">E</span> append · <span class="kbd">Q</span> connect · <span class="kbd">W</span> insert, or drag it onto the timeline.</div>`;
}

/* ---------- playback engine ---------- */
/* audio graph: clip element → clip gain → pan → track bus (gain) → track meter → master → speakers + export tap */
const recs=new Map();const imgs={};let AC=null,MIX=null,XDEST=null,MASTER_AN=null;const BUS={};
function ensureAudio(){if(AC){if(AC.state==="suspended")AC.resume().catch(()=>{});return}
  try{AC=new(window.AudioContext||window.webkitAudioContext)();MIX=AC.createGain();MASTER_AN=AC.createAnalyser();MASTER_AN.fftSize=1024;MIX.connect(MASTER_AN);MASTER_AN.connect(AC.destination);
    XDEST=AC.createMediaStreamDestination?AC.createMediaStreamDestination():null;if(XDEST)MIX.connect(XDEST);
    TRACKS.forEach(tr=>{const g=AC.createGain(),an=AC.createAnalyser();an.fftSize=1024;g.connect(an);an.connect(MIX);BUS[tr]={g,an}});
    recs.forEach(attachAudio);applyBuses()}catch(e){AC=null}}
function trk(tr){return(E.tl&&E.tl.tracks&&E.tl.tracks[tr])||{}}
function busGain(tr){const t=trk(tr);if(t.on===false||t.mute)return 0;const solo=TRACKS.some(x=>trk(x).solo&&x[0]==="A");if(solo&&tr[0]==="A"&&!t.solo)return 0;return t.gain==null?1:t.gain}
function applyBuses(){if(!AC)return;TRACKS.forEach(tr=>{if(BUS[tr])BUS[tr].g.gain.value=busGain(tr)});if(MIX)MIX.gain.value=E.tl&&E.tl.master!=null?E.tl.master:1}
function attachAudio(r){if(r.src||!AC||!r.c)return;try{r.src=AC.createMediaElementSource(r.el);r.gain=AC.createGain();r.pan=AC.createStereoPanner?AC.createStereoPanner():null;
  r.src.connect(r.gain);(r.pan?(r.gain.connect(r.pan),r.pan):r.gain).connect((BUS[r.c.track]||{}).g||MIX);r.bus=r.c.track;r.el.volume=1}catch(e){}}
function rebus(r){if(!r.src||!r.c||r.bus===r.c.track)return;try{const out=r.pan||r.gain;out.disconnect();out.connect((BUS[r.c.track]||{}).g||MIX);r.bus=r.c.track}catch(e){}}
function getRec(c){const m=mediaOf(c.mediaId);if(!m)return null;const url=playUrl(m);let r=recs.get(c.id);if(r&&r.url===url){r.c=c;return r}if(r)dropRec(c.id);
  const el=document.createElement(c.type==="audio"?"audio":"video");el.preload="auto";el.playsInline=true;el.crossOrigin="anonymous";el.src=url;if(c.freeze)el.muted=true;
  el.addEventListener("seeked",requestDraw);el.addEventListener("loadeddata",requestDraw);r={el,url,c};if(AC)attachAudio(r);recs.set(c.id,r);return r}
function dropRec(id){const r=recs.get(id);if(!r)return;try{r.el.pause();r.el.removeAttribute("src");r.el.load();if(r.src)r.src.disconnect();if(r.gain)r.gain.disconnect();if(r.pan)r.pan.disconnect()}catch(e){}recs.delete(id)}
function clearEls(){[...recs.keys()].forEach(dropRec)}
function edGC(){if(!E.tl){clearEls();return}const ids=new Set(E.tl.clips.map(c=>c.id));[...recs.keys()].forEach(id=>{if(!ids.has(id))dropRec(id)});recs.forEach((r,id)=>{r.c=clipById(id);if(r.c)rebus(r)});applyBuses()}
function imgFor(m){let i=imgs[m.id];if(!i){i=new Image();i.crossOrigin="anonymous";i.onload=requestDraw;i.src=blobUrl(m);imgs[m.id]=i}return i}
function fadeAt(c,t){const d=cdur(c),l=clamp(t-c.start,0,d);let f=1;if(c.fadeIn>0)f=Math.min(f,l/c.fadeIn);if(c.fadeOut>0)f=Math.min(f,(d-l)/c.fadeOut);return clamp(f,0,1)}
const playUrl=m=>(E.useProxy&&m.pxLocalId&&LURL[m.pxLocalId])||blobUrl(m);
const viewT=()=>E.skimT!=null&&!E.playing?E.skimT:E.t;
function srcTime(c,t){if(c.freeze)return c.fz!=null?c.fz:c.in;const m=mediaOf(c.mediaId);const md=(m&&m.dur)||Infinity;
  let off=c.ramp&&c.ramp.length>1?cdur(c)*rampInt(c.ramp,clamp((t-c.start)/cdur(c),0,1))+Math.min(0,t-c.start)*rampAt(c.ramp,0)+Math.max(0,t-cend(c))*rampAt(c.ramp,1):(t-c.start)*(c.speed||1);
  return clamp(c.reverse?c.out-off:c.in+off,0,Math.max(0,md-.03))}
function sync(){const tl=E.tl;if(!tl)return;const t=viewT();
  for(const c of tl.clips){if(c.type!=="video"&&c.type!=="audio")continue;const r=getRec(c);if(!r)continue;const el=r.el;
    const[w0,w1]=winOf(c);const active=t>=w0&&t<w1&&trackOn(c.track)&&!c.off;const target=srcTime(c,t);
    if(active){const g=(c.freeze?0:kv(c,"vol",t))*fadeAt(c,t)*audGate(c,t);if(r.gain)r.gain.gain.value=g;else el.volume=clamp(g*busGain(c.track),0,1);if(r.pan)r.pan.pan.value=clamp(c.pan||0,-1,1);
      if(E.playing&&c.reverse&&!c.freeze){/* browsers can't play backwards: step frames */if(!el.paused)el.pause();if(Math.abs(el.currentTime-target)>.9/fpsOf()&&!el.seeking)el.currentTime=target}
      else if(E.playing&&!c.freeze){const rate=clamp(rampSpeed(c,t)*E.rate,.0625,16);if(Math.abs(el.playbackRate-rate)>.001)el.playbackRate=rate;
        if(el.paused){if(Math.abs(el.currentTime-target)>.04)el.currentTime=target;if(!el.ended){const pr=el.play();if(pr&&pr.catch)pr.catch(()=>{})}}
        else if(Math.abs(el.currentTime-target)>.3&&!el.seeking)el.currentTime=target}
      else{if(!el.paused)el.pause();if(Math.abs(el.currentTime-target)>.5/fpsOf()&&!el.seeking)el.currentTime=target}}
    else{if(!el.paused)el.pause();if(w0>t&&w0-t<2.5){const t0=srcTime(c,w0);if(Math.abs(el.currentTime-t0)>.05&&!el.seeking)el.currentTime=t0}}}}
function master(){if(!E.tl)return null;const t=E.t;let best=null;
  for(const c of E.tl.clips){if(c.type!=="video"||c.freeze||c.off||!trackOn(c.track)||t<c.start||t>=cend(c))continue;const r=recs.get(c.id);if(r&&(!best||c.track==="V1"))best=r}return best}

/* layers: each visual clip renders into a full-frame layer so grading only touches its own pixels */
const LAY=[];function layer(i){const W=E.tl.w,H=E.tl.h;let c=LAY[i];if(!c){c=document.createElement("canvas");LAY[i]=c}if(c.width!==W||c.height!==H){c.width=W;c.height=H}const x=c.getContext("2d");x.setTransform(1,0,0,1,0,0);x.globalAlpha=1;x.globalCompositeOperation="source-over";x.filter="none";x.clearRect(0,0,W,H);return[c,x]}
let NOISE=null;function noise(){if(NOISE)return NOISE;NOISE=document.createElement("canvas");NOISE.width=NOISE.height=256;const x=NOISE.getContext("2d"),d=x.createImageData(256,256);
  for(let i=0;i<d.data.length;i+=4){const v=Math.random()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255}x.putImageData(d,0,0);return NOISE}
function drawFrame(target){const cv=target||$("#pgm");if(!cv||!E.tl)return;const tl=E.tl,W=tl.w,H=tl.h;if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  const ctx=cv.getContext("2d");ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation="source-over";ctx.filter="none";ctx.fillStyle=tl.bg||"#000";ctx.fillRect(0,0,W,H);const t=viewT();
  compose(ctx,t);
  if(E.compare&&!target){ctx.save();ctx.beginPath();ctx.rect(0,0,W/2,H);ctx.clip();ctx.fillStyle=tl.bg||"#000";ctx.fillRect(0,0,W/2,H);E.noGrade=true;compose(ctx,t);E.noGrade=false;ctx.restore();
    ctx.fillStyle="#fff";ctx.fillRect(W/2-1,0,2,H);ctx.font=`600 ${Math.round(H*.018)}px system-ui`;ctx.fillStyle="#fffc";ctx.textAlign="left";ctx.fillText("BEFORE",W*.02,H*.03);ctx.textAlign="right";ctx.fillText("AFTER",W*.98,H*.03)}
  if(tl.bars>0){const ar=W/H;if(tl.bars>ar){const bh=(H-W/tl.bars)/2;ctx.fillStyle="#000";ctx.fillRect(0,0,W,bh);ctx.fillRect(0,H-bh,W,bh)}
    else{const vh=W*1/tl.bars;const bh=Math.max(0,(H-vh)/2);/* vertical canvas: bars frame a cinemascope window across the middle */ctx.fillStyle="#000";ctx.fillRect(0,0,W,bh);ctx.fillRect(0,H-bh,W,bh)}}}
function compose(ctx,t){const tl=E.tl;let li=0;
  VTRACKS.forEach(tr=>{if(!trackOn(tr))return;
    if(tr==="V1"){const l=v1();const tc=l.find(c=>{const h=trHalf(c);return h>0&&t>=c.start-h&&t<c.start+h});
      if(tc){const A=v1Prev(tc),h=trHalf(tc),p=clamp((t-(tc.start-h))/(2*h),0,1);const[la,xa]=layer(li++),[lb,xb]=layer(li++);if(!A.off)renderClip(xa,A,t);if(!tc.off)renderClip(xb,tc,t);transition(ctx,tc.tr.type,la,lb,p);return}
      const c=l.find(c=>t>=c.start&&t<cend(c));if(c&&!c.off){const[lc,xc]=layer(li++);renderClip(xc,c,t);ctx.drawImage(lc,0,0)}return}
    tl.clips.filter(c=>c.track===tr&&!c.off&&t>=c.start&&t<cend(c)).sort((a,b)=>a.start-b.start).forEach(c=>{const[lc,xc]=layer(li++%6);renderClip(xc,c,t);ctx.drawImage(lc,0,0)})})}
const ease=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
function transition(ctx,type,A,B,p){const W=E.tl.w,H=E.tl.h,e=ease(p);ctx.save();
  if(type==="black"||type==="white"){ctx.fillStyle=type==="black"?"#000":"#fff";ctx.fillRect(0,0,W,H);ctx.globalAlpha=p<.5?1-p*2:p*2-1;ctx.drawImage(p<.5?A:B,0,0)}
  else if(type==="push"){ctx.drawImage(A,-e*W,0);ctx.drawImage(B,(1-e)*W,0)}
  else if(type==="slide"){ctx.drawImage(A,0,0);ctx.drawImage(B,(1-e)*W,0)}
  else if(type==="wipe"){ctx.drawImage(A,0,0);ctx.beginPath();ctx.rect(0,0,e*W,H);ctx.clip();ctx.drawImage(B,0,0)}
  else if(type==="zoom"){const sa=1+e*.6,sb=1.4-.4*e;ctx.globalAlpha=1;ctx.save();ctx.translate(W/2,H/2);ctx.scale(sa,sa);ctx.drawImage(A,-W/2,-H/2);ctx.restore();
    ctx.globalAlpha=e;ctx.translate(W/2,H/2);ctx.scale(sb,sb);if(FILTER_OK)ctx.filter=`blur(${(1-e)*14}px)`;ctx.drawImage(B,-W/2,-H/2)}
  else if(type==="whip"){const bl=Math.sin(p*Math.PI)*40;if(FILTER_OK)ctx.filter=`blur(${bl}px)`;ctx.drawImage(A,-e*W,0);ctx.drawImage(B,(1-e)*W,0)}
  else if(type==="flash"){ctx.drawImage(p<.5?A:B,0,0);ctx.globalCompositeOperation="lighter";ctx.globalAlpha=Math.sin(p*Math.PI)*.95;ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H)}
  else{ctx.drawImage(A,0,0);ctx.globalAlpha=p;ctx.drawImage(B,0,0)}
  ctx.restore()}
function hasGrade(c){return!E.noGrade&&(c.bri||c.con||c.sat||c.hue||c.temp||c.tint||c.fade||c.vig||c.grain||c.bw||c.sepia)}
function renderClip(ctx,c,t){const alpha=kv(c,"op",t)*fadeAt(c,t);if(alpha<=0||c.type==="gap")return;
  const g=hasGrade(c);
  const draw=(x,mask)=>{x.save();if(!mask&&g&&FILTER_OK){const f=[];if(c.bri)f.push(`brightness(${1+c.bri})`);if(c.con)f.push(`contrast(${1+c.con})`);const s=c.bw?-1:(c.sat||0);if(s)f.push(`saturate(${Math.max(0,1+s)})`);if(c.hue)f.push(`hue-rotate(${c.hue}deg)`);if(c.sepia)f.push(`sepia(${c.sepia})`);if(f.length)x.filter=f.join(" ")}
    if(c.type==="video"){const fo=E.fo&&E.fo.get(c.id);if(fo&&fo.frame)placeRot(x,fo.frame,fo.frame.displayWidth,fo.frame.displayHeight,c,t,fo.rot);else{const r=recs.get(c.id);const el=r&&r.el;if(el&&el.readyState>=2&&el.videoWidth)place(x,el,el.videoWidth,el.videoHeight,c,t)}}
    else if(c.type==="image"){const m=mediaOf(c.mediaId);if(m){const i=imgFor(m);if(i.complete&&i.naturalWidth)place(x,i,i.naturalWidth,i.naturalHeight,c,t)}}
    else if(c.type==="title")drawTitle(x,c,t);x.restore()};
  const useGL=g&&c.type!=="title"&&typeof glOK==="function"&&glOK();
  draw(ctx,useGL);if(useGL)glGrade(ctx.canvas,c,t);
  else if(g&&c.type!=="title"){const W=E.tl.w,H=E.tl.h;ctx.save();
    const ov=(op,col)=>{ctx.globalCompositeOperation=op;ctx.fillStyle=col;ctx.fillRect(0,0,W,H)};
    if(c.temp)ov("soft-light",c.temp>0?`rgba(255,140,30,${Math.abs(c.temp)*.7})`:`rgba(30,120,255,${Math.abs(c.temp)*.7})`);
    if(c.tint)ov("soft-light",c.tint>0?`rgba(255,40,200,${Math.abs(c.tint)*.5})`:`rgba(40,255,90,${Math.abs(c.tint)*.5})`);
    if(c.fade)ov("screen",`rgba(60,60,64,${c.fade})`);
    if(c.grain){ctx.globalCompositeOperation="overlay";ctx.globalAlpha=c.grain*.55;const n=noise(),ox=Math.random()*256|0,oy=Math.random()*256|0;ctx.translate(-ox,-oy);ctx.fillStyle=ctx.createPattern(n,"repeat");ctx.fillRect(0,0,W+256,H+256);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1}
    if(c.vig){ctx.globalCompositeOperation="source-atop";const rg=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.25,W/2,H/2,Math.hypot(W,H)*.55);rg.addColorStop(0,"rgba(0,0,0,0)");rg.addColorStop(1,`rgba(0,0,0,${c.vig})`);ctx.fillStyle=rg;ctx.fillRect(0,0,W,H)}
    ctx.globalCompositeOperation="destination-in";draw(ctx,true);ctx.restore()}
  if(alpha<1){ctx.save();ctx.globalCompositeOperation="destination-in";ctx.fillStyle=`rgba(0,0,0,${alpha})`;ctx.fillRect(0,0,E.tl.w,E.tl.h);ctx.restore()}}
const drawClip=renderClip;
function place(ctx,src,vw,vh,c,t){const W=E.tl.w,H=E.tl.h;let s=(c.fit==="fill"?Math.max(W/vw,H/vh):Math.min(W/vw,H/vh))*kv(c,"scale",t);
  if(c.kb&&t!=null){const k=clamp((t-c.start)/cdur(c),0,1);s*=1+.12*k}
  const dw=vw*s,dh=vh*s,cx=W/2+kv(c,"x",t)*W,cy=H/2+kv(c,"y",t)*H,rot=kv(c,"rot",t);
  if(rot){ctx.translate(cx,cy);ctx.rotate(rot*Math.PI/180);ctx.drawImage(src,-dw/2,-dh/2,dw,dh)}else ctx.drawImage(src,cx-dw/2,cy-dh/2,dw,dh)}
function hexA(h,a){const n=parseInt(String(h||"#000").slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function drawTitle(ctx,c,t){const W=E.tl.w,H=E.tl.h,l=t-c.start,d=cdur(c);let size=(c.size||8)/100*H;const ez=x=>1-Math.pow(1-clamp(x,0,1),3);
  let dy=0,dx=0,sc=1,txt=String(c.text||""),blur=0,trk=c.track2||0,a=1;const an=c.anim||"none",out=c.animOut;
  if(an==="rise")dy=(1-ez(l/.5))*size*.6;else if(an==="pop")sc=.6+.4*ez(l/.35);else if(an==="type")txt=txt.slice(0,Math.floor(l/.045));
  else if(an==="slide")dx=-(1-ez(l/.5))*W*.25;else if(an==="blur"){blur=(1-ez(l/.6))*size*.4;a=ez(l/.4)}else if(an==="track")trk+=(1-ez(l/.9))*.5;else if(an==="drop")dy=-(1-ez(l/.45))*size*1.2;
  if(out&&d-l<.4){const k=1-clamp((d-l)/.4,0,1);if(out==="fall")dy+=k*k*size;if(out==="blur")blur+=k*size*.4;a*=1-k}
  ctx.globalAlpha*=a;
  ctx.font=`${c.italic?"italic ":""}${c.weight||800} ${size}px "${c.font||"Archivo"}", system-ui, sans-serif`;ctx.textBaseline="middle";if(c.upper)txt=txt.toUpperCase();
  if("letterSpacing" in ctx)ctx.letterSpacing=(trk*size).toFixed(1)+"px";if(blur&&FILTER_OK)ctx.filter=(ctx.filter&&ctx.filter!=="none"?ctx.filter+" ":"")+`blur(${blur}px)`;
  const al=c.align||"center";ctx.textAlign=al;const lines=txt.split("\n"),lh=size*(c.lh||1.12);
  const x=(al==="left"?W*.08:al==="right"?W*.92:W/2)+kv(c,"x",t)*W+dx,y0=(c.yPos==null?50:c.yPos)/100*H+kv(c,"y",t)*H-(lines.length-1)*lh/2+dy;
  const S=sc*kv(c,"scale",t),rot=kv(c,"rot",t);ctx.translate(x,y0);ctx.scale(S,S);if(rot)ctx.rotate(rot*Math.PI/180);ctx.translate(-x,-y0);
  if(c.box){const mw=Math.max(...lines.map(s=>ctx.measureText(s).width),1),pd=size*.35;const bx=al==="left"?x-pd:al==="right"?x-mw-pd:x-mw/2-pd;
    ctx.fillStyle=hexA(c.boxColor,c.boxOp==null?.5:c.boxOp);ctx.fillRect(bx,y0-lh/2-pd*.6,mw+pd*2,lh*lines.length+pd*1.2)}
  if(c.stroke){ctx.lineWidth=size*.08;ctx.strokeStyle=c.strokeColor||"#000";ctx.lineJoin="round";lines.forEach((s,i)=>ctx.strokeText(s,x,y0+i*lh))}
  if(c.glow){ctx.shadowColor=c.color||"#fff";ctx.shadowBlur=size*.5}else if(c.shadow!==false){ctx.shadowColor="rgba(0,0,0,.55)";ctx.shadowBlur=size*.22;ctx.shadowOffsetY=size*.04}
  ctx.fillStyle=c.color||"#fff";lines.forEach((s,i)=>ctx.fillText(s,x,y0+i*lh));
  if(c.hl&&lines.length){/* caption word highlight: sweep a highlight colour across the words over the clip */const words=txt.split(/\s+/);const k=Math.min(words.length-1,Math.floor(l/d*words.length));
    ctx.shadowColor="transparent";ctx.fillStyle=c.hl;const full=lines[0];const pre=words.slice(0,k).join(" ")+(k?" ":"");const w=ctx.measureText(full).width,px=ctx.measureText(pre).width;
    const x0=al==="left"?x:al==="right"?x-w:x-w/2;if(lines.length===1){ctx.textAlign="left";ctx.fillText(words[k],x0+px,y0)}}}
function requestDraw(){if(!E.raf)E.raf=requestAnimationFrame(loop)}
function loop(now){E.raf=0;if(E.rendering)return;
  if(E.playing){const dt=Math.min(.25,(now-E.last)/1000);E.last=now;const m=master();let used=false;
    if(m&&m.c&&!m.el.paused&&!m.el.seeking&&m.el.readyState>=3){const tt=m.c.start+(m.el.currentTime-m.c.in)/(m.c.speed||1);if(tt>=E.t-.08&&tt<=E.t+.3){E.t=tt;used=true}}
    if(!used)E.t+=dt*E.rate;
    const xr=E.x&&E.x.phase==="running";const d=xr&&E.x.end!=null?E.x.end:tlDur();if(E.t>=d){E.t=d;if(xr){finishExport()}pause();}}
    if(E.playing&&E.loop&&E.rin!=null&&E.rout!=null&&!(E.x&&E.x.phase==="running")&&E.t>=E.rout){E.t=E.rin;recs.forEach(r=>{if(r.c&&!r.c.freeze)r.el.currentTime=srcTime(r.c,E.t)})}
  sync();drawFrame();if(E.x&&E.x.xcx&&E.x.phase==="running")E.x.xcx.drawImage($("#pgm"),0,0,E.x.w,E.x.h);updPlayheadUI();if(E.playing)E.raf=requestAnimationFrame(loop)}
function play(){if(!E.tl||tlDur()<=0)return;ensureAudio();if(E.t>=tlDur()-FR())E.t=0;E.playing=true;E.skimT=null;E.last=performance.now();requestDraw();updPlayBtn()}
function pause(){E.playing=false;E.rate=1;recs.forEach(r=>{try{r.el.pause()}catch(e){}});requestDraw();updPlayBtn()}
const edPause=pause;
function togglePlay(){E.playing?pause():play()}
function seek(t){E.t=clamp(t,0,Math.max(0,tlDur()));if(E.playing){recs.forEach(r=>{if(r.c){const[w0,w1]=winOf(r.c);if(E.t>=w0&&E.t<w1)r.el.currentTime=srcTime(r.c,E.t)}})}requestDraw()}
function updPlayBtn(){const b=$("#pPlay");if(b){b.innerHTML=ic(E.playing?"pause":"play");b.setAttribute("aria-label",E.playing?"Pause":"Play")}}
function updPlayheadUI(){const x=LEFT+E.t*(E._pps||1);const ph=$("#eph");if(ph)ph.style.left=x+"px";
  const tc=tcs(E.t);const a=$("#pNow");if(a)a.textContent=tc;const d=$("#dashTc");if(d)d.textContent=tc;
  if(E.playing){const sc=$("#tlscroll");if(sc&&state.ttab==="edit"&&(x>sc.scrollLeft+sc.clientWidth-40||x<sc.scrollLeft+LEFT))sc.scrollLeft=x-LEFT-40}}

/* ---------- viewer (program monitor) ---------- */
function edViewer(){const p=cur();const tl=E.tl||newTL(defaultFormat(p));
  const key=[p.id,tl.w,tl.h,E.tl?1:0].join("|");
  $("#vName").innerHTML=`<b>${esc(p.title)}</b> <span style="color:var(--dim)">· Timeline</span>`;
  $("#vMeta").textContent=`${tl.w}×${tl.h} · ${tl.fps}p`;
  if(key!==edViewerKey){edViewerKey=key;
    $("#vArea").innerHTML=`<div class="pgm" id="pgmBox" style="aspect-ratio:${tl.w}/${tl.h};width:min(100cqw - 28px,(100cqh - 28px)*${tl.w}/${tl.h})"><canvas id="pgm" width="${tl.w}" height="${tl.h}"></canvas><div class="safez" id="safez"></div><div class="empty-pgm" id="pgmEmpty"></div></div>`;
    $("#transport").innerHTML=`${modeSeg()}<button class="tbtn" id="pStart" title="Go to start (Home)" aria-label="Go to start">${ic("start")}</button><button class="tbtn play" id="pPlay" title="Play/Pause (Space)" aria-label="Play">${ic("play")}</button><button class="tbtn" id="pEnd" title="Go to end (End)" aria-label="Go to end">${ic("end")}</button>
      <span class="tc-s" id="pNow">00:00:00:00</span><span class="tc-s" style="color:var(--dim)">/</span><span class="tc-s" id="pDur" style="color:var(--muted)">00:00:00:00</span><span class="grow"></span>
      <button class="ib ${E.loop?"on":""}" id="loopBtn" title="Loop the In–Out range (⌘L)" aria-label="Loop">${ic("loop")}</button><button class="ib ${E.safe?"on":""}" id="safeBtn" title="Safe zones: title/action safe and TikTok/Reels UI (')" aria-label="Safe zones">${ic("safe")}</button><button class="ib ${E.compare?"on":""}" id="cmpBtn" title="Before/after split for colour (⇧C)" aria-label="Before and after">${ic("compare")}</button><button class="ib" id="fsBtn" title="Full screen viewer (⇧⌘F)" aria-label="Full screen">${ic("full")}</button>
      <button class="ib ${E.ascrub?"on":""}" id="ascrubBtn" title="Audio scrubbing (⇧S): hear the sound while you skim or scrub" aria-label="Audio scrubbing">${ic("audio")}</button><button class="ib ${E.skim?"on":""}" id="skimBtn" title="Skimming (S): hover the timeline to preview" aria-label="Skimming">${ic("skim")}</button>`;
    const box=$("#pgmBox");box.addEventListener("dragover",e=>{e.preventDefault()});box.addEventListener("drop",e=>{e.preventDefault();const fs=[...(e.dataTransfer.files||[])];if(fs.length)importFiles(fs)});
    $("#pgm").addEventListener("click",()=>togglePlay())}
  else{const ms=$("#transport .seg");if(ms)ms.outerHTML=modeSeg()}
  const sb=$("#skimBtn");if(sb)sb.classList.toggle("on",E.skim);
  ["loopBtn:loop","safeBtn:safe","cmpBtn:compare"].forEach(x=>{const[id,k]=x.split(":");const b=$("#"+id);if(b)b.classList.toggle("on",!!E[k])});renderSafe();
  edViewerEmpty();updPlayBtn();requestDraw()}
function edViewerEmpty(){const e=$("#pgmEmpty");if(!e)return;const has=E.tl&&E.tl.clips.length;e.style.display=has?"none":"grid";
  if(!has)e.innerHTML=projMedia().length?"Your media is in the Browser.<br>Drag a clip to the timeline, or select it and press E.":"Import video, audio or images to start editing.<br>Drop files here or use Import Media.";
  const d=$("#pDur");if(d)d.textContent=tcs(tlDur())}

/* ---------- dashboard + toolbar ---------- */
function renderDash(){const p=cur();if(!p){$("#dash").innerHTML=`<span class="tc dim">--:--:--:--</span>`;return}const i=sIdx(p.stage);
  $("#dash").innerHTML=`<div><small>Stage</small><span class="mono stg" style="font-size:12px;font-weight:500">${pad(i+1)}/07 ${esc(sLabel(p.stage).toUpperCase())}</span></div>
    <span class="tc ${E.tl&&E.tl.clips.length?"":"dim"}" id="dashTc" title="Playhead">${tcs(E.t)}</span>
    <div><small>Duration</small><span class="mono" style="font-size:12px">${tcs(tlDur())}</span></div>`}
function ppsRange(){return[4,800]}
function pps2slider(p){const[a,b]=ppsRange();return Math.round(Math.log(p/a)/Math.log(b/a)*100)}
function slider2pps(v){const[a,b]=ppsRange();return a*Math.pow(b/a,v/100)}
function renderTools(){document.querySelectorAll("[data-tool]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tool===E.tool));
  $("#snapBtn").classList.toggle("on",E.snap);$("#undoBtn").disabled=!E.undo.length;$("#redoBtn").disabled=!E.redo.length;
  const ed=state.ttab==="edit";$("#zoom").value=ed?pps2slider(E.pps||fitPPS()):50;$("#exportBtn").disabled=!(E.tl&&E.tl.clips.length)}
function fitPPS(){const sc=$("#tlscroll");const w=(sc&&sc.clientWidth||900)-LEFT-40;return clamp(w/Math.max(tlDur()+1,8),4,800)}

/* ---------- edit timeline ---------- */
function edTimeline(){
  const c=$("#tlc"),sc=$("#tlscroll");c.className="tlc etl";
  const p=cur();if(!p){$("#tlhead").innerHTML=ttabsHTML();c.innerHTML="";return}
  if(E.drag&&E.drag.live)return; // keep the DOM steady mid-gesture
  const tl=E.tl,pps=E.pps||fitPPS();E.pps=E.pps||null;const PPS=pps;E._pps=PPS;
  const dur=tlDur(),W=Math.max(LEFT+(dur+12)*PPS,sc.clientWidth);c.style.width=W+"px";
  // ruler
  const steps=[.1,.2,.5,1,2,5,10,15,30,60,120,300,600];const maj=steps.find(s=>s*PPS>=84)||600;const minr=maj*PPS>=200?maj/10:maj/5;
  let rh="";const endT=(W-LEFT)/PPS;
  for(let s=0;s<=endT;s+=minr){const isMaj=Math.abs(s/maj-Math.round(s/maj))<1e-6;rh+=`<div class="et${isMaj?"":" mi"}" style="left:${LEFT+s*PPS}px">${isMaj?`<em>${shortTC(s,maj)}</em>`:""}</div>`}
  const mk=(tl?tl.markers||[]:[]).map(m=>`<button class="emk ${m.kind==="beat"?"beat":m.done?"done":m.by==="claude"?"claude":"joe"}" data-mk="${esc(m.id)}" style="left:${LEFT+m.t*PPS}px" title="${esc((m.by==="claude"?"Claude: ":"")+(m.text||"Marker")+" · "+tcs(m.t))}"><i></i></button>`).join("");
  const tr=TRACKS.map(t=>{const on=trackOn(t),k=trk(t),lk=!!k.lock,au=t[0]==="A";let cl=tl?tl.clips.filter(x=>x.track===t).map(clipHTML).join(""):"";
    if(tl&&t==="V1")cl+=v1().map(c=>{const h=trHalf(c);if(!h)return"";const nm=(TRANS.find(x=>x[0]===c.tr.type)||[0,"Transition"])[1];return`<div class="etr${E.sel.has(c.id)&&E.trSel?" sel":""}" data-tr="${esc(c.id)}" style="left:${LEFT+(c.start-h)*PPS}px;width:${Math.max(8,2*h*PPS)}px" title="${esc(nm)} · ${(2*h).toFixed(2)} s"><span>${esc(nm)}</span></div>`}).join("");
    return`<div class="etrack ${t}${on?"":" off"}${lk?" lk":""}" data-track="${t}"><div class="thead"><span class="tn">${t}</span><span class="tbs"><button data-trk="${t}" class="${on?"on":""}" title="${on?"Disable":"Enable"} ${t}">${au?(on?"♪":"×"):(on?"◉":"○")}</button><button data-tlock="${t}" class="${lk?"on":""}" title="${lk?"Unlock":"Lock"} ${t}">${lk?"⊠":"⊡"}</button>${au?`<button data-tmute="${t}" class="${k.mute?"on m":""}" title="Mute ${t}">M</button><button data-tsolo="${t}" class="${k.solo?"on s":""}" title="Solo ${t}">S</button>`:""}</span></div>${cl}</div>`}).join("");
  const rg=E.rin!=null&&E.rout!=null&&E.rout>E.rin?`<div class="erange" style="left:${LEFT+E.rin*PPS}px;width:${(E.rout-E.rin)*PPS}px"></div>`:"";
  c.innerHTML=`<div class="eruler" id="eruler">${rh}${mk}${rg}</div>${tr}${rg?rg.replace('class="erange"','class="erange body"'):""}
    <div class="eph" id="eph" style="left:${LEFT+E.t*PPS}px"></div><div class="eskim" id="eskim"></div><div class="snapln" id="snapln"></div><div class="bladeln" id="bladeln"></div><div class="edrop" id="edrop"></div>
    ${!tl||!tl.clips.length?`<div class="etl-empty">${projMedia().length?"Drag media here, or select a clip in the Browser and press E to append it to the storyline.":"Import media in the Browser, then drag it here."}</div>`:""}`;
  E.pps=E.pps?E.pps:null;
  $("#tlhead").innerHTML=`<span style="display:flex;gap:10px;align-items:center;min-width:0">${ttabsHTML()}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>${esc(p.title)}</b> · ${tl?tl.w+"×"+tl.h+" · "+tl.fps+"p · ":""}${tl?tl.clips.length:0} clips · ${tcs(dur)}${tl&&tl.updatedBy==="claude"?` · <span style="color:#cbb8ff">last edit by Claude ${esc(ago(tl.updatedAt))}</span>`:""}</span></span>
    <span class="legend"><span><i style="background:#3f62a8"></i>Video</span><span><i style="background:#6a4fb8"></i>Title</span><span><i style="background:#2f7a46"></i>Audio</span><span><i style="background:var(--claude)"></i>Claude</span><span class="mono" style="color:var(--dim)">${E.tool.toUpperCase()}${E.snap?" · SNAP":""}${E.rin!=null&&E.rout!=null?" · RANGE "+tcs(Math.max(0,E.rout-E.rin)):""}</span></span>`;
}
function clipHTML(c){const P=E._pps,x=LEFT+c.start*P,w=Math.max(4,cdur(c)*P-1);const m=mediaOf(c.mediaId);const th=m?TH[m.id]||{}:{};const sp=c.speed||1;
  const sel=E.sel.has(c.id),fl=E.flash.has(c.id);let bg="",inner="";
  if(c.type==="video"&&th.strip&&m)bg=`background-image:url('${th.strip}');background-size:${(m.dur||cdur(c))/sp*P}px calc(100% - 0px);background-position:${-(c.in/sp)*P}px 0;`;
  if(c.type==="image"&&m)bg=`background-image:url('${esc(blobUrl(m))}');background-size:auto 100%;background-repeat:repeat-x;`;
  if((c.type==="video"||c.type==="audio")&&th.wave&&m)inner+=`<div class="wf" style="background-image:url('${th.wave}');background-size:${(m.dur||cdur(c))/sp*P}px 100%;background-position:${-(c.in/sp)*P}px 0;${c.vol===0?"opacity:.25":""}"></div>`;
  const label=c.type==="title"?(String(c.text||"Title").split("\n")[0]):c.type==="gap"?"Gap":(c.name||(m&&m.name)||c.type);
  if(c.fadeIn>0)inner+=`<div class="fi" style="width:${c.fadeIn*P}px"></div>`;if(c.fadeOut>0)inner+=`<div class="fo" style="width:${c.fadeOut*P}px"></div>`;
  const fx=[c.lead>0?"J":"",c.tail>0?"L":"",c.reverse?"REV":"",c.rampName?c.rampName.toUpperCase():"",c.xf>0?"XF":"",c.mc?"CAM "+((c.angle||0)+1):"",c.freeze?"FREEZE":"",sp!==1?sp+"×":"",(c.look?c.look.toUpperCase():(c.bri||c.con||c.sat||c.temp||c.tint||c.fade||c.vig||c.grain||c.bw||c.hue)?"CLR":""),c.vol!=null&&c.vol!==1&&c.type!=="title"&&!c.freeze&&!c.mc?Math.round(20*Math.log10(Math.max(c.vol,.001)))+"dB":"",c.kb?"KB":"",c.pan?"PAN":""].filter(Boolean).join(" ");
  const kts=c.kf?[...new Set(Object.values(c.kf).flat().map(k=>+k[0].toFixed(3)))]:[];inner+=kts.map(r=>`<i class="kfd" style="left:${r*P-3}px"></i>`).join("");
  return`<div class="eclip ${c.type}${sel?" sel":""}${fl?" claude-new":""}${c.off?" dis":""}${E.tool!=="select"?" t-"+E.tool:""}" data-clip="${esc(c.id)}" style="left:${x}px;width:${w}px;${bg}" title="${esc(label)} · ${tcs(c.start)} → ${tcs(cend(c))} (${tcs(cdur(c))})">
    <div class="h l"></div><span class="lbl">${esc(label)}</span>${inner}${fx?`<span class="fx">${esc(fx)}</span>`:""}${c.by==="claude"?`<span class="bylbl">C</span>`:""}<div class="h r"></div></div>`}

/* pointer: scrub, select, move, trim, blade, skim */
const tlsc=$("#tlscroll");
function timeAt(clientX){const r=$("#tlc").getBoundingClientRect();return Math.max(0,(clientX-r.left-LEFT)/(E._pps||1))}
function trackAt(x,y){const el=document.elementFromPoint(x,y);const t=el&&el.closest(".etrack");return t?t.dataset.track:null}
function snapT(t,exclude){if(!E.snap||!E.tl)return{t,hit:null};const P=E._pps,pts=[0,E.t];
  E.tl.clips.forEach(c=>{if(exclude&&exclude.has(c.id))return;pts.push(c.start,cend(c))});(E.tl.markers||[]).forEach(m=>pts.push(m.t));
  let best=null,bd=8/P;pts.forEach(p=>{const d=Math.abs(p-t);if(d<bd){bd=d;best=p}});return best==null?{t,hit:null}:{t:best,hit:best}}
function showLine(id,t){const l=$("#"+id);if(!l)return;if(t==null){l.style.display="none";return}l.style.display="block";l.style.left=(LEFT+t*E._pps)+"px"}
tlsc.addEventListener("pointerdown",e=>{if(state.ttab!=="edit"||e.button!==0)return;const p=cur();if(!p)return;
  const mkb=e.target.closest(".emk");if(mkb){const m=(E.tl.markers||[]).find(x=>x.id===mkb.dataset.mk);if(m){pause();seek(m.t);state.ixtab="markers";renderIndex()}return}
  const th=e.target.closest(".thead button");if(th){const d=th.dataset,tr=d.trk||d.tlock||d.tmute||d.tsolo;edit(tl=>{tl.tracks[tr]=tl.tracks[tr]||{};const o=tl.tracks[tr];if(d.trk)o.on=!trackOn(tr);else if(d.tlock)o.lock=!o.lock;else if(d.tmute)o.mute=!o.mute;else o.solo=!o.solo});applyBuses();return}
  const tre=e.target.closest(".etr");if(tre){E.sel=new Set([tre.dataset.tr]);E.trSel=true;state.itab="clip";renderItabs();renderInsp();edTimeline();return}E.trSel=false;
  if(e.target.closest("#eruler")){pause();E.skimT=null;seek(timeAt(e.clientX));E.drag={mode:"scrub"};tlsc.setPointerCapture(e.pointerId);return}
  const ce=e.target.closest(".eclip");
  if(ce){const c=clipById(ce.dataset.clip);if(!c)return;
    if(E.tool==="blade"){if(trackLocked(c.track))return;const at=snapT(timeAt(e.clientX)).t;edit(()=>splitClip(c,at));return}
    if(e.shiftKey||e.metaKey){E.sel.has(c.id)?E.sel.delete(c.id):E.sel.add(c.id)}else if(!E.sel.has(c.id)){E.sel.clear();E.sel.add(c.id)}
    state.itab="clip";
    let mode=e.target.classList.contains("l")?"trimL":e.target.classList.contains("r")?"trimR":"move";
    if(trackLocked(c.track)){renderItabs();renderInsp();edTimeline();return}
    if(E.tool==="slip"&&!isStill(c)&&(c.type==="video"||c.type==="audio"))mode="slip";
    if(E.tool==="roll"&&c.track==="V1"){const r=ce.getBoundingClientRect();const left=e.clientX-r.left<r.width/2;const o=left?v1Prev(c):v1Next(c);if(o){E.drag={mode:"roll",id:left?o.id:c.id,id2:left?c.id:o.id,x0:e.clientX,origA:clone(left?o:c),origB:clone(left?c:o),snap:JSON.stringify(E.tl),moved:false,live:false};tlsc.setPointerCapture(e.pointerId);renderItabs();renderInsp();edTimeline();return}}
    E.drag={mode,id:c.id,x0:e.clientX,orig:clone(c),snap:JSON.stringify(E.tl),moved:false,live:false};
    tlsc.setPointerCapture(e.pointerId);renderItabs();renderInsp();edTimeline();return}
  if(e.target.closest(".etrack")||e.target.closest(".etl")){E.sel.clear();pause();E.skimT=null;seek(timeAt(e.clientX));E.drag={mode:"scrub"};tlsc.setPointerCapture(e.pointerId);renderItabs();renderInsp();edTimeline()}
});
tlsc.addEventListener("pointermove",e=>{if(state.ttab!=="edit")return;const d=E.drag;
  if(!d){if(E.tool==="blade"){showLine("bladeln",snapT(timeAt(e.clientX)).t)}
    if(E.skim&&!E.playing&&E.tl&&E.tl.clips.length&&e.target.closest(".etrack")){const t=timeAt(e.clientX);E.skimT=Math.min(t,tlDur());const s=$("#eskim");if(s){s.style.display="block";s.style.left=(LEFT+E.skimT*E._pps)+"px"}
      clearTimeout(E.skimTO);E.skimTO=setTimeout(requestDraw,30);if(typeof scrubAt==="function")scrubAt(E.skimT)}return}
  if(d.mode==="scrub"){seek(timeAt(e.clientX));if(typeof scrubAt==="function")scrubAt(E.t);return}
  const dx=e.clientX-d.x0;if(!d.moved&&Math.abs(dx)<3)return;if(!d.moved){d.moved=true;d.live=true}
  const c=clipById(d.id);if(!c)return;const dt=dx/E._pps,o=d.orig||d.origA,sp=o.speed||1,m=mediaOf(o.mediaId),mdur=m&&(m.kind==="video"||m.kind==="audio")&&!o.freeze?(m.dur||o.out):Infinity;const ex=new Set([c.id]);
  if(d.mode==="roll"){const A=clipById(d.id),B=clipById(d.id2);if(!A||!B)return;const a=d.origA,b=d.origB,sa=a.speed||1,sb=b.speed||1;const ma=mediaOf(a.mediaId);
    const maxA=isStill(a)?Infinity:((ma&&ma.dur)||a.out),minB=isStill(b)?-Infinity:0;let dt2=dx/E._pps;
    dt2=clamp(dt2,-(cdur(a)-FR()),cdur(b)-FR());dt2=Math.min(dt2,(maxA-a.out)/sa);dt2=Math.max(dt2,(minB-b.in)/sb);
    A.out=a.out+dt2*sa;if(isStill(b))B.out=b.out-dt2*sb;else B.in=b.in+dt2*sb;repack();E.t=cend(A);liveClip(A);liveClip(B);requestDraw();return}
  if(d.mode==="slip"){const md=(m&&m.dur)||o.out;const len=o.out-o.in;const ni=clamp(o.in-dt*sp,0,Math.max(0,md-len));c.in=ni;c.out=ni+len;E.t=c.start+cdur(c)/2;liveClip(c);requestDraw();showSlip(c);return}
  if(d.mode==="move"){const s=snapT(Math.max(0,o.start+dt),ex);const s2=snapT(Math.max(0,o.start+dt)+cdur(o),ex);
    let ns=s.hit!=null?s.t:(s2.hit!=null?s2.t-cdur(o):Math.max(0,o.start+dt));c.start=Math.max(0,ns);showLine("snapln",s.hit!=null?s.hit:s2.hit);
    const tr=trackAt(e.clientX,e.clientY);if(tr&&okTrack(c,tr))c.track=tr;
    if(c.track==="V1"){const idx=dropIndex(c);showLine("edrop",idx.t)}else showLine("edrop",null)}
  else if(d.mode==="trimR"){let no=clamp(o.out+dt*sp,o.in+FR()*sp,mdur);const s=snapT(o.start+(no-o.in)/sp,ex);if(s.hit!=null)no=clamp(o.in+(s.t-o.start)*sp,o.in+FR()*sp,mdur);c.out=no;showLine("snapln",s.hit);E.t=Math.max(c.start,cend(c)-FR())}
  else if(d.mode==="trimL"){const minIn=(o.type==="video"||o.type==="audio")&&!o.freeze?0:-Infinity;let ni=clamp(o.in+dt*sp,minIn,o.out-FR()*sp);
    if(c.track!=="V1"){let nst=o.start+(ni-o.in)/sp;const s=snapT(nst,ex);if(s.hit!=null){nst=s.t;ni=clamp(o.in+(nst-o.start)*sp,minIn,o.out-FR()*sp)}if(nst<0){ni-=nst*sp;nst=0}c.start=nst;showLine("snapln",s.hit)}
    if(isStill(o)){c.out=o.out-(ni-o.in);ni=o.in}c.in=ni;E.t=c.start}
  liveClip(c);requestDraw()});
function liveClip(c){const el=document.querySelector(`.eclip[data-clip="${CSS.escape(c.id)}"]`);if(!el)return;const P=E._pps;
  const lane=document.querySelector(`.etrack[data-track="${c.track}"]`);if(lane&&el.parentNode!==lane)lane.appendChild(el);
  el.style.left=(LEFT+c.start*P)+"px";el.style.width=Math.max(4,cdur(c)*P-1)+"px";const m=mediaOf(c.mediaId);
  if(m){const sp=c.speed||1;el.style.backgroundPosition=`${-(c.in/sp)*P}px 0`;const wf=el.querySelector(".wf");if(wf)wf.style.backgroundPosition=`${-(c.in/sp)*P}px 0`}
  const ph=$("#eph");if(ph)ph.style.left=(LEFT+E.t*P)+"px"}
function dropIndex(c){const others=v1().filter(x=>x.id!==c.id);const mid=c.start+cdur(c)/2;let i=others.findIndex(x=>x.start+cdur(x)/2>mid);if(i<0)i=others.length;
  let t=0;for(let k=0;k<i;k++)t+=cdur(others[k]);return{i,t,others}}
function endDrag(e){const d=E.drag;if(!d)return;E.drag=null;showLine("snapln",null);showLine("edrop",null);hideSlip();
  if(d.mode==="scrub"){if(E.pendingRemote){const r=E.pendingRemote;E.pendingRemote=null;applyRemote(r)}return}
  const c=clipById(d.id);
  if(d.moved&&c){pushUndo(d.snap);if(d.mode==="roll"||d.mode==="slip"){normalize();commit();edRefresh();return}
    if(d.mode==="move"){if(c.track==="V1"){const{i,others}=dropIndex(c);others.splice(i,0,c);delete c.link;repack(others)}
      else{relink(c);resolveTrack(c.track,c.id)}
      if(d.orig.track==="V1"&&c.track!=="V1"){/* lifted out of the storyline: its connected clips stay with the neighbour */E.tl.clips.forEach(x=>{if(x.link===c.id)relink(x)})}}
    normalize();commit()}
  if(E.pendingRemote){const r=E.pendingRemote;E.pendingRemote=null;applyRemote(r);return}
  edRefresh()}
tlsc.addEventListener("pointerup",endDrag);tlsc.addEventListener("pointercancel",endDrag);
tlsc.addEventListener("pointerleave",()=>{if(E.skimT!=null){E.skimT=null;const s=$("#eskim");if(s)s.style.display="none";requestDraw()}showLine("bladeln",null)});
tlsc.addEventListener("wheel",e=>{if(state.ttab!=="edit"||!(e.ctrlKey||e.metaKey))return;e.preventDefault();zoomBy(e.deltaY<0?1.15:1/1.15,e.clientX)},{passive:false});
// drag media from the browser (or files from the desktop) onto the timeline
tlsc.addEventListener("dragover",e=>{if(state.ttab!=="edit")return;e.preventDefault();const tr=trackAt(e.clientX,e.clientY);
  document.querySelectorAll(".etrack.dropok").forEach(x=>x.classList.remove("dropok"));if(tr){const el=document.querySelector(`.etrack[data-track="${tr}"]`);el&&el.classList.add("dropok")}
  let t=timeAt(e.clientX);if(tr==="V1"){const b=boundaryNear(t);t=b.t}showLine("edrop",t)});
tlsc.addEventListener("dragleave",e=>{if(!tlsc.contains(e.relatedTarget)){document.querySelectorAll(".etrack.dropok").forEach(x=>x.classList.remove("dropok"));showLine("edrop",null)}});
tlsc.addEventListener("drop",async e=>{if(state.ttab!=="edit")return;e.preventDefault();document.querySelectorAll(".etrack.dropok").forEach(x=>x.classList.remove("dropok"));showLine("edrop",null);
  const tr=trackAt(e.clientX,e.clientY)||"V1",t=timeAt(e.clientX);const id=e.dataTransfer.getData("text/edit-media");
  if(id){placeMedia(id,tr,t);return}
  const fs=[...(e.dataTransfer.files||[])];if(fs.length){const before=new Set(state.media.map(m=>m.id));await importFiles(fs);state.media.filter(m=>!before.has(m.id)&&m.projectId===E.pid).forEach(m=>placeMedia(m.id,"V1",tlDur()))}});
function boundaryNear(t){const l=v1();let best={i:l.length,t:l.length?cend(l[l.length-1]):0};let bd=Infinity;let acc=0;
  for(let i=0;i<=l.length;i++){const d=Math.abs(acc-t);if(d<bd){bd=d;best={i,t:acc}}if(i<l.length)acc+=cdur(l[i])}return best}
function placeMedia(id,tr,t){if(!getTL())return;
  if(id==="__title"){edit(tl=>{const c=newTitle(isVisTrack(tr)&&tr!=="V1"?t:t);c.track="V2";tl.clips.push(c);relink(c);E.sel=new Set([c.id])});state.itab="clip";render();return}
  const m=mediaOf(id);if(!m)return;
  edit(tl=>{let c;
    if(m.kind==="audio"){c=newClip(m,tr==="A2"?"A2":"A1",t);tl.clips.push(c);relink(c)}
    else if(tr==="V1"){c=newClip(m,"V1",0);const b=boundaryNear(t);const l=v1();l.splice(b.i,0,c);tl.clips.push(c);repack(l)}
    else{c=newClip(m,"V2",t);tl.clips.push(c);relink(c)}
    E.sel=new Set([c.id])});
  state.itab="clip";render()}

/* ---------- edit operations ---------- */
function splitClip(c,at){if(at-c.start<FR()||cend(c)-at<FR())return false;const mid=c.freeze||isStill(c)?c.in+(at-c.start):srcTime(c,at),u=(at-c.start)/cdur(c);
  const n=clone(c);n.id=uid("c");if(c.ramp){c.ramp=subRamp(c.ramp,0,u);n.ramp=subRamp(n.ramp,u,1)}
  if(c.reverse&&!isStill(c)){const o=c.out;c.in=mid;n.in=n.in;n.out=mid;n.start=at;c.out=o;c.fadeOut=0;n.fadeIn=0}else{c.out=mid;n.in=mid;n.start=at;}c.fadeOut=0;n.fadeIn=0;if(isStill(c)){n.out=c.out+(n.out-c.out);}if(n.kf){/* keyframes after the cut move to the new clip */const off=at-c.start;Object.keys(n.kf).forEach(k=>{n.kf[k]=n.kf[k].filter(x=>x[0]>=off).map(x=>[+(x[0]-off).toFixed(4),x[1],x[2]]);c.kf[k]=c.kf[k].filter(x=>x[0]<=off)})}delete n.tr;
  E.tl.clips.splice(E.tl.clips.indexOf(c)+1,0,n);E.tl.clips.forEach(x=>{if(x.link===c.id&&x.start>=at)x.link=n.id});return n}
function bladeAtPlayhead(){if(!E.tl)return;const at=E.t;const sel=E.tl.clips.filter(c=>E.sel.has(c.id)&&at>c.start&&at<cend(c));
  const targets=sel.length?sel:E.tl.clips.filter(c=>c.track==="V1"&&at>c.start&&at<cend(c));if(!targets.length){toast("BLADE","Nothing under the playhead to cut.");return}
  edit(()=>targets.forEach(c=>splitClip(c,at)))}
function deleteSel(ripple){if(!E.tl||!E.sel.size)return;const ids=new Set(E.sel);
  edit(tl=>{const out=new Set();tl.clips.forEach(c=>{if(!ids.has(c.id))return;
      if(c.track==="V1"&&!ripple){Object.assign(c,{type:"gap",mediaId:null,name:"Gap",in:0,out:cdur(c),speed:1});delete c.text}
      else{out.add(c.id);if(c.track==="V1")tl.clips.forEach(x=>{if(x.link===c.id&&!ids.has(x.id))out.add(x.id)})}});
    tl.clips=tl.clips.filter(c=>!out.has(c.id))});
  E.sel.clear();if(state.itab==="clip")state.itab="info";render()}
function addTitleAtPlayhead(){placeMedia("__title","V2",E.t)}
function addFromBrowser(mode){const id=E.mediaSel;if(!id){toast("NOTHING SELECTED","Select a clip in the Browser first.");return}if(!getTL())return;
  if(id==="__title"){addTitleAtPlayhead();return}const m=mediaOf(id);if(!m)return;
  if(mode==="append"){if(m.kind==="audio")placeMedia(id,"A1",E.t);else placeMedia(id,"V1",tlDur()+1e3)}
  else if(mode==="connect"){placeMedia(id,m.kind==="audio"?"A1":"V2",E.t)}
  else if(mode==="insert"){if(m.kind==="audio"){placeMedia(id,"A1",E.t);return}
    edit(tl=>{const under=v1().find(c=>E.t>c.start&&E.t<cend(c));if(under)splitClip(under,E.t);const c=newClip(m,"V1",0);const l=v1();const b=boundaryNear(E.t);l.splice(b.i,0,c);tl.clips.push(c);repack(l);E.sel=new Set([c.id])});state.itab="clip";render()}}
function addMarker(text){if(!getTL())return;edit(tl=>{(tl.markers=tl.markers||[]).push({id:uid("mk"),t:+E.t.toFixed(3),text:text||"",by:"joe"})},{undo:true});state.ixtab="markers";renderIndex()}
function freezeAt(){if(!E.tl)return;const at=E.t;let c=selClips().find(x=>x.type==="video"&&!x.freeze&&at>=x.start&&at<cend(x))||E.tl.clips.find(x=>x.track==="V1"&&x.type==="video"&&!x.freeze&&at>=x.start&&at<cend(x));
  if(!c){toast("FREEZE FRAME","Put the playhead over a video clip first.");return}
  edit(tl=>{const fz=+srcTime(c,at).toFixed(3);let n=null;if(at-c.start>=FR())n=splitClip(c,at);
    const f=clone(c);f.id=uid("c");f.freeze=true;f.fz=fz;f.in=0;f.out=2;f.speed=1;f.vol=0;f.fadeIn=0;f.fadeOut=0;delete f.tr;delete f.kf;f.name=(c.name||"Clip")+" · freeze";f.by=E.by;
    if(c.track==="V1"){const l=v1();const host=n||c;const i=l.findIndex(x=>x.id===host.id);l.splice(n?i:i,0,f);tl.clips.push(f);repack(l)}
    else{f.start=at;tl.clips.push(f);if(n)n.start=at+2;resolveTrack(c.track,f.id)}
    E.sel=new Set([f.id])});state.itab="clip";render()}
function detachAudio(){const c=selClips().find(x=>x.type==="video"&&!x.freeze);if(!c)return;
  edit(tl=>{const tr=["A1","A2","A3"].find(t=>!tl.clips.some(x=>x.track===t&&x.start<cend(c)&&cend(x)>c.start))||"A3";
    const a={id:uid("c"),track:tr,type:"audio",mediaId:c.mediaId,name:(c.name||"Clip")+" · audio",start:c.start,in:c.in,out:c.out,speed:c.speed||1,vol:c.vol==null?1:c.vol,pan:0,fadeIn:0,fadeOut:0,by:E.by};
    tl.clips.push(a);relink(a);c.vol=0;E.sel=new Set([a.id])});toast("AUDIO DETACHED","The sound is now its own clip on the audio tracks.")}
function toggleKf(k){const c=selClips()[0];if(!c)return;if(E.t<c.start-1e-6||E.t>cend(c)+1e-6){toast("KEYFRAME","Move the playhead inside the clip to add a keyframe.");return}
  edit(()=>{const i=kfAt(c,k,E.t);if(i>=0){c.kf[k].splice(i,1);if(!c.kf[k].length){c[k]=kv(c,k,E.t);delete c.kf[k]}}else{const v=kv(c,k,E.t);setKf(c,k,E.t,v)}});$("#insp").dataset.k="";renderInsp()}
function kfJump(k,dir){const c=selClips()[0];if(!c||!c.kf||!c.kf[k])return;const r=E.t-c.start;const ks=c.kf[k].map(x=>x[0]);const n=dir>0?ks.find(x=>x>r+1e-4):ks.filter(x=>x<r-1e-4).pop();if(n!=null){pause();seek(c.start+n);syncInspectorValues(c,$("#insp"))}}
function copySel(){const cs=selClips();if(!cs.length)return;const t0=Math.min(...cs.map(c=>c.start));E.clip=cs.map(c=>Object.assign(clone(c),{_off:c.start-t0}));toast("COPIED",cs.length+" clip"+(cs.length>1?"s":""))}
function pasteClips(){if(!E.clip||!E.clip.length||!getTL())return;const at=E.t;
  edit(tl=>{const ids=[];const v=E.clip.filter(c=>c.track==="V1").sort((a,b)=>a._off-b._off);
    if(v.length){const under=v1().find(c=>at>c.start&&at<cend(c));if(under)splitClip(under,at);const l=v1();const b=boundaryNear(at);v.forEach((c,i)=>{const n=clone(c);delete n._off;n.id=uid("c");n.by=E.by;delete n.link;l.splice(b.i+i,0,n);tl.clips.push(n);ids.push(n.id)});repack(l)}
    E.clip.filter(c=>c.track!=="V1").forEach(c=>{const n=clone(c);n.id=uid("c");n.by=E.by;n.start=at+n._off;delete n._off;tl.clips.push(n);relink(n);ids.push(n.id)});E.sel=new Set(ids)});render()}
const ATTRS=["op","scale","x","y","rot","fit","kb","bri","con","sat","hue","temp","tint","fade","vig","grain","bw","sepia","look","fadeIn","fadeOut","vol","pan","kf","speed"];
function pasteAttrs(){if(!E.clip||!E.clip.length)return;const src=E.clip[0];const cs=selClips();if(!cs.length)return;
  edit(()=>cs.forEach(c=>ATTRS.forEach(k=>{if(src[k]===undefined)delete c[k];else c[k]=clone(src[k])})));toast("ATTRIBUTES PASTED","Look, transform, audio and fades copied to "+cs.length+" clip"+(cs.length>1?"s":""))}
function addDefaultTransition(){const cs=selClips().filter(c=>c.track==="V1");const t=cs.length?cs:[v1().find(c=>Math.abs(c.start-E.t)<Math.max(.5,8/(E._pps||1)))||v1().find(c=>E.t>=c.start&&E.t<cend(c))].filter(Boolean);
  const ok=t.filter(c=>v1Prev(c));if(!ok.length){toast("TRANSITION","Select a storyline clip that follows another clip.");return}edit(()=>ok.forEach(c=>{c.tr={type:"dissolve",d:.5}}))}
function setRange(which){if(which==="i")E.rin=+E.t.toFixed(3);else if(which==="o")E.rout=+E.t.toFixed(3);else{E.rin=E.rout=null}
  if(E.rin!=null&&E.rout!=null&&E.rout<E.rin){const x=E.rin;E.rin=E.rout;E.rout=x}edTimeline()}
function jumpEdit(dir){if(!E.tl)return;const pts=[...new Set([0,...E.tl.clips.flatMap(c=>[c.start,cend(c)])])].sort((a,b)=>a-b);
  const t=E.t;const n=dir>0?pts.find(p=>p>t+1e-4):pts.filter(p=>p<t-1e-4).pop();if(n!=null){pause();seek(n)}}
function zoomBy(f,clientX){const sc=$("#tlscroll");const old=E._pps||fitPPS();const np=clamp(old*f,4,800);const anchorT=clientX!=null?timeAt(clientX):E.t;const ax=clientX!=null?clientX-sc.getBoundingClientRect().left:sc.clientWidth/2;
  E.pps=np;edTimeline();sc.scrollLeft=LEFT+anchorT*np-ax;renderTools()}

/* ---------- index: clips + markers ---------- */
function edIndex(body){const p=cur();const key=state.ixtab+"|"+p.id;
  if(state.ixtab==="markers"){if(body.dataset.k!==key){body.dataset.k=key;body.innerHTML=`<form class="mkform" id="mkForm"><input id="mkText" placeholder="Marker note at playhead (M)" autocomplete="off" aria-label="Marker note"><button class="btn blue" type="submit">Add</button></form><ul class="ixl" id="mkl"></ul>`}
    const ms=((E.tl&&E.tl.markers)||[]).filter(m=>m.kind!=="beat").sort((a,b)=>a.t-b.t);
    $("#mkl").innerHTML=ms.length?ms.map(m=>`<li data-mkseek="${esc(m.id)}"><span class="dot" style="background:${m.done?"var(--done)":m.by==="claude"?"var(--claude)":"var(--sel)"}"></span>
      <span><span class="w">${esc(WHO(m.by))} · ${esc(tcs(m.t))}</span><span class="tx" style="${m.done?"text-decoration:line-through;color:var(--dim)":""}">${esc(m.text||"Marker")}</span></span>
      <span style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-mkdone="${esc(m.id)}" ${m.done?"checked":""} title="Mark done" style="accent-color:var(--done)"><button class="x" data-delmk="${esc(m.id)}" aria-label="Delete marker">✕</button></span></li>`).join(""):`<li style="cursor:default"><span></span><span class="tx" style="color:var(--muted)">No markers. Press M to drop one at the playhead. Claude’s review notes land here too.</span><span></span></li>`;return}
  body.dataset.k=key;const cl=E.tl?E.tl.clips.slice().sort((a,b)=>TRACKS.indexOf(a.track)-TRACKS.indexOf(b.track)||a.start-b.start):[];
  const col={video:"#3f62a8",image:"#3f62a8",title:"#6a4fb8",audio:"#2f7a46",gap:"#555"};
  body.innerHTML=`<ul class="ixl">${cl.length?cl.map(c=>`<li class="${E.sel.has(c.id)?"hl":""}" data-cl="${esc(c.id)}"><span class="dot" style="background:${col[c.type]}"></span>
    <span><span class="w">${c.track} · ${esc(tcs(c.start))} · ${esc(tcs(cdur(c)))}${c.by==="claude"?" · CLAUDE":""}</span><span class="tx">${esc(c.type==="title"?String(c.text||"").split("\n")[0]:c.name||c.type)}</span></span><span></span></li>`).join(""):`<li style="cursor:default"><span></span><span class="tx" style="color:var(--muted)">No clips on the timeline yet.</span><span></span></li>`}</ul>`}

/* ---------- clip inspector ---------- */
function edHasSelection(){return E.sel.size>0&&!!E.tl}
function edSelectionSummary(){if(!E.sel.size||!E.tl)return"";const cs=E.tl.clips.filter(c=>E.sel.has(c.id));if(!cs.length)return"";
  const a=Math.min(...cs.map(c=>c.start)),b=Math.max(...cs.map(cend));return`${cs.length} clip${cs.length>1?"s":""} · ${tcs(a)}–${tcs(b)}`}
function edSelectionContext(){const cs=E.tl?E.tl.clips.filter(c=>E.sel.has(c.id)):[];if(!cs.length)return null;
  return{clipIds:cs.map(c=>c.id),start:Math.min(...cs.map(c=>c.start)),end:Math.max(...cs.map(cend)),playhead:+E.t.toFixed(3),label:edSelectionSummary()+" ("+cs.map(c=>c.type==="title"?"title":c.name||c.type).join(", ")+")"}}
function row(label,prop,val,min,max,step,unit,c){const kfable=c&&KF_PROPS.includes(prop);if(kfable)val=kv(c,prop,E.t);
  const kb=kfable?`<span class="kfnav"><button class="kfa" data-kfnav="${prop}:-1" title="Previous keyframe">‹</button><button class="kfb ${kfAt(c,prop,E.t)>=0?"on":c.kf&&c.kf[prop]&&c.kf[prop].length?"has":""}" data-kf="${prop}" title="Add or remove a keyframe at the playhead">◆</button><button class="kfa" data-kfnav="${prop}:1" title="Next keyframe">›</button></span>`:"<span></span>";
  return`<div class="cprop"><label for="cp-${prop}">${label}</label><input type="range" id="cp-${prop}" data-cp="${prop}" min="${min}" max="${max}" step="${step}" value="${val}"><input type="number" id="cpn-${prop}" data-cp="${prop}" min="${min}" max="${max}" step="${step}" value="${+(+val).toFixed(3)}" aria-label="${label}${unit?" ("+unit+")":""}">${kb}</div>`}
const TPRESETS={basic:{font:"Archivo",weight:900,size:8,yPos:50,box:false,shadow:true,glow:false,stroke:false,upper:false,anim:"rise",align:"center",color:"#ffffff",track2:0,hl:""},
  lower:{font:"Archivo",weight:700,size:3.6,yPos:80,align:"left",box:true,boxColor:"#000000",boxOp:.6,shadow:false,glow:false,stroke:false,anim:"slide",upper:false,track2:0,hl:""},
  bold:{font:"Anton",weight:400,size:13,yPos:50,align:"center",upper:true,shadow:true,glow:false,stroke:false,box:false,anim:"pop",track2:0,hl:""},
  caption:{font:"Archivo",weight:800,size:4.4,yPos:72,align:"center",upper:false,stroke:true,strokeColor:"#000000",shadow:false,glow:false,box:false,anim:"none",hl:"#f4c430",track2:0},
  cinema:{font:"Barlow Condensed",weight:600,size:5,yPos:50,align:"center",upper:true,track2:.35,shadow:false,glow:false,stroke:false,box:false,anim:"track",animOut:"fade",color:"#f2ede8",hl:""},
  neon:{font:"Bebas Neue",weight:400,size:12,yPos:50,align:"center",upper:true,glow:true,color:"#e8000a",shadow:false,stroke:false,box:false,anim:"blur",track2:.05,hl:""},
  mono:{font:"Space Mono",weight:700,size:3.4,yPos:90,align:"left",upper:true,track2:.12,shadow:false,glow:false,stroke:false,box:false,anim:"type",color:"#f2ede8",hl:""}};
const LOOKS={none:["None",{bri:0,con:0,sat:0,hue:0,temp:0,tint:0,fade:0,vig:0,grain:0,bw:false,sepia:0}],
  teal:["Teal & Orange",{con:.15,sat:.15,temp:.25,tint:-.08,hue:-6,vig:.25,fade:0,grain:.1,bw:false,bri:0,sepia:0}],
  noir:["Noir",{bw:true,con:.35,bri:-.05,vig:.55,grain:.35,fade:.05,temp:0,tint:0,hue:0,sat:0,sepia:0}],
  film:["Warm Film",{temp:.35,fade:.18,sat:-.1,con:.05,grain:.3,vig:.3,tint:.03,hue:0,bri:0,bw:false,sepia:.08}],
  night:["Cool Night",{temp:-.45,bri:-.12,con:.15,sat:-.1,vig:.45,fade:.05,grain:.15,tint:-.05,hue:0,bw:false,sepia:0}],
  bleach:["Bleach Bypass",{sat:-.55,con:.4,bri:.02,fade:0,vig:.3,grain:.2,temp:0,tint:0,hue:0,bw:false,sepia:0}],
  matte:["Faded Matte",{fade:.28,con:-.15,sat:-.18,temp:.08,grain:.15,vig:.1,tint:0,hue:0,bri:.02,bw:false,sepia:0}],
  vivid:["Vivid",{sat:.4,con:.12,bri:.02,vig:.1,temp:0,tint:0,hue:0,fade:0,grain:0,bw:false,sepia:0}],
  red:["Crimson Noir",{con:.3,sat:-.2,bri:-.08,temp:.1,tint:.12,vig:.6,grain:.3,fade:.04,hue:-8,bw:false,sepia:0}]};
function edClipInspector(box){const cs=E.tl?E.tl.clips.filter(c=>E.sel.has(c.id)):[];if(!cs.length){box.innerHTML=`<div class="empty">No clip selected.</div>`;box.dataset.k="";return}
  const c=cs[0],key="clip|"+cs.map(x=>x.id).join(",")+"|"+(E.trSel?1:0);
  if(box.dataset.k===key&&box.contains(document.activeElement)&&document.activeElement.matches("input,textarea,select")){syncInspectorValues(c,box);return}
  box.dataset.k=key;const m=mediaOf(c.mediaId);const vis=c.type!=="audio"&&c.type!=="gap",aud=(c.type==="video"&&!c.freeze)||c.type==="audio",media=c.type==="video"||c.type==="audio";
  const multi=cs.length>1?`<div class="grp" style="color:var(--warn)"><span>${cs.length} clips selected · changes apply to every ${esc(c.type)} clip</span></div>`:"";
  let h=`<div class="ihead"><b>${esc(c.type==="title"?"Title":c.name||(m&&m.name)||c.type)}</b><span>${c.freeze?"FREEZE FRAME":c.type.toUpperCase()} · ${c.track} · ${esc(tcs(c.start))} → ${esc(tcs(cend(c)))}${c.by==="claude"?" · added by Claude":""}</span></div>${multi}`;
  if(c.track==="V1"&&v1Prev(c)){const tt=(c.tr&&c.tr.type)||"";h+=`<div class="grp"><span>Transition in</span><button class="reset" data-trall="1" title="Use this transition on every cut in the storyline">Apply to all cuts</button></div>
    <div class="cprop wide"><label for="tr-type">Type</label><select id="tr-type" data-trt="1"><option value="">None (cut)</option>${TRANS.map(([v,l])=>`<option value="${v}" ${v===tt?"selected":""}>${l}</option>`).join("")}</select></div>
    ${tt?`<div class="cprop"><label for="tr-d">Duration</label><input type="range" id="tr-d" data-trd="1" min=".1" max="3" step=".05" value="${(c.tr&&c.tr.d)||.5}"><input type="number" id="trn-d" data-trd="1" min=".1" max="3" step=".05" value="${(c.tr&&c.tr.d)||.5}" aria-label="Transition duration (s)"><span></span></div>`:""}`}
  if(c.type==="title"){h+=`<div class="grp"><span>Text</span></div><div class="cprop wide"><label for="cp-text">Text</label><textarea id="cp-text" data-cp="text">${esc(c.text)}</textarea></div>
    <div class="cprop wide"><label for="tp-pre">Style</label><select id="tp-pre" data-tpreset="1"><option value="">Apply a style…</option><option value="basic">Basic</option><option value="lower">Lower third</option><option value="bold">Big & bold</option><option value="caption">Caption (word highlight)</option><option value="cinema">Cinematic</option><option value="neon">Neon</option><option value="mono">Typewriter slate</option></select></div>
    <div class="cprop wide"><label for="cp-font">Font</label><select id="cp-font" data-cp="font">${FONTS.map(f=>`<option ${f===c.font?"selected":""}>${f}</option>`).join("")}</select></div>
    <div class="cprop wide"><label for="cp-weight">Weight</label><select id="cp-weight" data-cp="weight">${[400,500,600,700,800,900].map(w=>`<option ${+c.weight===w?"selected":""}>${w}</option>`).join("")}</select></div>
    ${row("Size","size",c.size,1,30,.5,"% of height")}${row("Height","yPos",c.yPos==null?50:c.yPos,0,100,1,"%")}${row("Tracking","track2",c.track2||0,-.1,1,.01)}
    <div class="cprop wide"><label for="cp-color">Colour</label><input type="color" id="cp-color" data-cp="color" value="${esc(c.color||"#ffffff")}"></div>
    <div class="cprop wide"><label for="cp-align">Align</label><select id="cp-align" data-cp="align">${["left","center","right"].map(a=>`<option ${a===c.align?"selected":""}>${a}</option>`).join("")}</select></div>
    <div class="cprop wide"><label for="cp-anim">Animate in</label><select id="cp-anim" data-cp="anim">${[["none","None"],["rise","Rise"],["pop","Pop"],["slide","Slide"],["drop","Drop"],["blur","Blur in"],["track","Tracking in"],["type","Typewriter"]].map(([v,l])=>`<option value="${v}" ${v===(c.anim||"none")?"selected":""}>${l}</option>`).join("")}</select></div>
    <div class="cprop wide"><label for="cp-animOut">Animate out</label><select id="cp-animOut" data-cp="animOut">${[["","None"],["fade","Fade"],["fall","Fall"],["blur","Blur out"]].map(([v,l])=>`<option value="${v}" ${v===(c.animOut||"")?"selected":""}>${l}</option>`).join("")}</select></div>
    <div class="cprop wide"><label>Style</label><span class="chips"><label><input type="checkbox" id="cp-italic" data-cp="italic" ${c.italic?"checked":""}> Italic</label><label><input type="checkbox" id="cp-upper" data-cp="upper" ${c.upper?"checked":""}> Caps</label><label><input type="checkbox" id="cp-shadow" data-cp="shadow" ${c.shadow!==false?"checked":""}> Shadow</label><label><input type="checkbox" id="cp-glow" data-cp="glow" ${c.glow?"checked":""}> Glow</label><label><input type="checkbox" id="cp-stroke" data-cp="stroke" ${c.stroke?"checked":""}> Outline</label><label><input type="checkbox" id="cp-box" data-cp="box" ${c.box?"checked":""}> Box</label></span></div>
    ${c.box?`<div class="cprop wide"><label for="cp-boxColor">Box colour</label><input type="color" id="cp-boxColor" data-cp="boxColor" value="${esc(c.boxColor||"#000000")}"></div>${row("Box opacity","boxOp",c.boxOp==null?.5:c.boxOp,0,1,.05)}`:""}
    <div class="cprop wide"><label for="cp-hl">Word highlight</label><span style="display:flex;gap:8px;align-items:center"><input type="color" id="cp-hl" data-cp="hl" value="${esc(c.hl||"#f4c430")}" style="width:48px"><label style="text-align:left;font-size:12px"><input type="checkbox" id="cp-hlon" data-hlon="1" ${c.hl?"checked":""}> Karaoke sweep</label></span></div>`}
  if(isStill(c))h+=`<div class="grp"><span>Timing</span></div>${row("Duration","dur",+cdur(c).toFixed(2),.1,60,.1,"s")}`;
  if(media&&!c.freeze)h+=`<div class="grp"><span>Timing</span></div><div class="cprop"><label>Source</label><span class="ro">${esc(tcs(c.in))} → ${esc(tcs(c.out))}</span><span></span><span></span></div>
    <div class="cprop wide"><label for="cp-speed">Speed</label><select id="cp-speed" data-cp="speed">${[.1,.25,.5,.75,1,1.25,1.5,2,3,4,8].map(s=>`<option value="${s}" ${+c.speed===s?"selected":""}>${s===1?"Normal (100%)":Math.round(s*100)+"%"}</option>`).join("")}</select></div>
    <div class="cprop wide"><label for="cp-ramp">Speed curve</label><select id="cp-ramp" data-ramp="1">${Object.entries(RAMPS).map(([k,[l]])=>`<option value="${k}" ${(c.rampName||"none")===k?"selected":""}>${l}</option>`).join("")}</select></div>
    <div class="cprop wide"><label>Direction</label><span class="chips"><label><input type="checkbox" id="cp-reverse" data-cp="reverse" ${c.reverse?"checked":""}> Reverse</label></span></div>
    ${c.type==="video"?`<div class="cprop wide"><span></span><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-freeze="1" title="Hold the frame under the playhead for 2 s (⌥F)">Freeze frame</button><button class="btn sm" data-detach="1" title="Copy this clip's sound onto A1 and mute the video">Detach audio</button></span></div>`:""}`;
  if(aud)h+=`<div class="grp"><span>Audio</span><span class="mono" id="dbro">${kv(c,"vol",E.t)>0?(20*Math.log10(kv(c,"vol",E.t))).toFixed(1)+" dB":"−∞ dB"}</span></div>${row("Volume","vol",c.vol==null?1:c.vol,0,2,.01,"×",c)}${row("Pan","pan",c.pan||0,-1,1,.05,"L/R")}${c.track==="V1"&&c.type==="video"?row("J-cut lead","lead",c.lead||0,0,3,.05,"s")+row("L-cut tail","tail",c.tail||0,0,3,.05,"s"):""}${c.type==="audio"&&c.track!=="V1"?row("Crossfade","xf",c.xf||0,0,3,.05,"s"):""}
    <div class="cprop wide"><span></span><span style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-beats="1" title="Find the beats in this clip and drop markers you can snap cuts to">Detect beats</button></span></div>`;
  if(vis){h+=`<div class="grp"><span>Transform</span><button class="reset" data-cpreset="tf">Reset</button></div>${row("Scale","scale",c.scale||1,.1,4,.01,"×",c)}${row("Position X","x",c.x||0,-1,1,.01,"",c)}${row("Position Y","y",c.y||0,-1,1,.01,"",c)}${row("Rotation","rot",c.rot||0,-180,180,1,"°",c)}${row("Opacity","op",c.op==null?1:c.op,0,1,.01,"",c)}`;
    if(c.type==="video"||c.type==="image")h+=`<div class="cprop wide"><label for="cp-fit">Conform</label><select id="cp-fit" data-cp="fit"><option value="fit" ${c.fit!=="fill"?"selected":""}>Fit</option><option value="fill" ${c.fit==="fill"?"selected":""}>Fill</option></select></div>
      <div class="cprop wide"><label>Motion</label><span class="chips"><label><input type="checkbox" id="cp-kb" data-cp="kb" ${c.kb?"checked":""}> Slow push-in</label><label><input type="checkbox" id="cp-off" data-cp="off" ${c.off?"checked":""}> Disabled (V)</label></span></div>`}
  if(c.type==="video"||c.type==="image")h+=`<div class="grp"><span>Colour</span><button class="reset" data-page="color">Open Color page</button></div>${FILTER_OK?"":`<div class="cprop wide"><span></span><span style="font-size:11px;color:var(--warn)">This browser can’t preview colour changes; they’re saved and Claude applies them in renders.</span></div>`}
    <div class="cprop wide"><label for="cp-look">Look</label><select id="cp-look" data-look="1">${Object.entries(LOOKS).map(([k,[l]])=>`<option value="${k}" ${(c.look||"none")===k?"selected":""}>${l}</option>`).join("")}</select></div>
    ${row("Exposure","bri",c.bri||0,-1,1,.01)}${row("Contrast","con",c.con||0,-1,1,.01)}${row("Saturation","sat",c.sat||0,-1,1,.01)}${row("Temperature","temp",c.temp||0,-1,1,.01)}`;
  if(c.type!=="gap")h+=`<div class="grp"><span>Fades</span></div>${row("Fade in","fadeIn",c.fadeIn||0,0,5,.05,"s")}${row("Fade out","fadeOut",c.fadeOut||0,0,5,.05,"s")}`;
  h+=`<div style="display:flex;gap:6px;flex-wrap:wrap;padding:12px"><button class="btn purple" data-assist="1">Ask Claude to edit ${cs.length>1?"these":"this"}</button><button class="btn" data-cpsplit="1" title="Blade at playhead (⌘B)">Split at playhead</button><button class="btn red" data-cpdel="1">Delete</button></div>`;
  box.innerHTML=h}
function syncInspectorValues(c,box){box.querySelectorAll("[data-cp]").forEach(el=>{if(el===document.activeElement)return;const k=el.dataset.cp;let v=k==="dur"?+cdur(c).toFixed(2):KF_PROPS.includes(k)?kv(c,k,E.t):c[k];if(v==null)return;
  if(el.type==="checkbox")el.checked=!!v;else if(el.type!=="color"||typeof v==="string")el.value=el.type==="number"?+(+v).toFixed(3):v});
  box.querySelectorAll("[data-kf]").forEach(b=>{const k=b.dataset.kf;b.className="kfb "+(kfAt(c,k,E.t)>=0?"on":c.kf&&c.kf[k]&&c.kf[k].length?"has":"")})}
function setProp(c,k,v){if(k==="dur"){c.out=c.in+Math.max(FR(),v)*(c.speed||1);return}
  if(k==="speed"){c.speed=v;return}if(KF_PROPS.includes(k)&&c.kf&&c.kf[k]&&c.kf[k].length){setKf(c,k,E.t,v);return}c[k]=v;if(["bri","con","sat","temp","tint","fade","vig","grain","hue","bw","sepia"].includes(k))delete c.look}
const RAMPS={none:["Constant",null],montage:["Montage",[[0,1],[.3,3],[.5,.4],[.7,3],[1,1]]],hero:["Hero",[[0,1.5],[.35,1.5],[.45,.2],[.65,.2],[.75,1.5],[1,1.5]]],
  bullet:["Bullet",[[0,2],[.4,2],[.45,.15],[.75,.15],[.8,2],[1,2]]],flashin:["Flash in",[[0,4],[.4,1],[1,1]]],flashout:["Flash out",[[0,1],[.6,1],[1,4]]],jump:["Jump cut",[[0,1],[.45,1],[.5,6],[.55,1],[1,1]]],ease:["Ease in & out",[[0,.4],[.5,1.6],[1,.4]]]};
const selClips=()=>E.tl?E.tl.clips.filter(c=>E.sel.has(c.id)):[];
function edInput(el){
  if(el.id==="zoom"&&state.ttab==="edit"){const np=slider2pps(+el.value);const sc=$("#tlscroll");const at=(sc.scrollLeft+sc.clientWidth/2-LEFT)/(E._pps||1);E.pps=np;edTimeline();sc.scrollLeft=LEFT+at*np-sc.clientWidth/2;return true}
  if(el.id==="zoom"){state.hppd=30+ +el.value*3.7;renderHistory();return true}
  if(el.dataset.cp){const c=clipById([...E.sel][0]);if(!c)return true;const k=el.dataset.cp;
    if(!E.cpUndo){pushUndo();E.cpUndo=true}
    let v=el.type==="checkbox"?el.checked:(el.type==="range"||el.type==="number")?num(el.value,0):el.value;
    if(k==="weight"||k==="speed")v=+v;
    selClips().filter(x=>x.type===c.type).forEach(x=>setProp(x,k,v));if(k==="off")requestDraw();const twin=document.getElementById((el.type==="range"?"cpn-":"cp-")+k);if(twin&&twin!==el&&twin.type!=="checkbox")twin.value=el.type==="range"?+(+v).toFixed(3):v;
    if(k==="vol"){const d=$("#dbro");if(d)d.textContent=v>0?(20*Math.log10(v)).toFixed(1)+" dB":"−∞ dB"}
    if(k==="dur"||k==="speed")normalize();
    requestDraw();clearTimeout(E.cpT);E.cpT=setTimeout(()=>{normalize();commit();edTimeline();renderDash()},250);return true}
  if(el.dataset.trd!=null){const c=selClips()[0];if(!c||!c.tr)return true;if(!E.cpUndo){pushUndo();E.cpUndo=true}c.tr.d=clamp(num(el.value,.5),.1,3);const tw=document.getElementById(el.type==="range"?"trn-d":"tr-d");if(tw&&tw!==el)tw.value=c.tr.d;requestDraw();clearTimeout(E.cpT);E.cpT=setTimeout(()=>{normalize();commit();edTimeline()},250);return true}
  if(el.dataset.ts)return true;
  return false}
function edChange(el){
  if(el.id==="fileIn"){const fs=[...(el.files||[])];el.value="";importFiles(fs);return true}
  if(el.dataset.cp){const k=el.dataset.cp;if(!E.cpUndo)edInput(el);E.cpUndo=false;
    if(k==="xf"){selClips().filter(x=>x.type==="audio").forEach(x=>{const p=E.tl.clips.filter(y=>y.track===x.track&&y!==x&&y.start<x.start).sort((a,b)=>b.start-a.start)[0];if(p&&Math.abs(cend(p)-x.start)<Math.max(.05,x.xf+.05)||p&&x.start>cend(p)-x.xf)x.start=Math.max(p.start+.05,cend(p)-(x.xf||0))})}
    clearTimeout(E.cpT);normalize();commit();edTimeline();renderDash();if(k==="box"||k==="type"){$("#insp").dataset.k="";renderInsp()}if(typeof renderColorPage==="function"&&E.page==="color")renderColorPage(true);return true}
  if(el.dataset.ts){const k=el.dataset.ts;if(!getTL())return true;edit(tl=>{if(k==="fmt"){const[w,h]=el.value.split("x").map(Number);tl.w=w;tl.h=h}else if(k==="fps")tl.fps=+el.value;else if(k==="bg")tl.bg=el.value});edViewerKey="";render();return true}
  if(el.dataset.trt!=null){const c=selClips()[0];if(!c)return true;const v=el.value;edit(()=>{if(v)c.tr={type:v,d:(c.tr&&c.tr.d)||.5};else delete c.tr});$("#insp").dataset.k="";renderInsp();return true}
  if(el.dataset.trd!=null){const c=selClips()[0];if(!c||!c.tr)return true;const v=clamp(num(el.value,.5),.1,3);if(!E.cpUndo)pushUndo();E.cpUndo=false;c.tr.d=v;normalize();commit();edTimeline();requestDraw();return true}
  if(el.dataset.ramp!=null){const k=el.value,R=RAMPS[k];edit(()=>selClips().filter(c=>c.type==="video"||c.type==="audio").forEach(c=>{const keepDur=cdur(c);if(R&&R[1]){c.ramp=clone(R[1]);c.rampName=k;c.speed=1}else{delete c.ramp;delete c.rampName}}));$("#insp").dataset.k="";renderInsp();return true}
  if(el.dataset.look!=null){const k=el.value,L=LOOKS[k];if(!L)return true;edit(()=>selClips().filter(c=>c.type==="video"||c.type==="image").forEach(c=>{Object.assign(c,clone(L[1]));if(k==="none")delete c.look;else c.look=k}));$("#insp").dataset.k="";renderInsp();return true}
  if(el.dataset.tpreset!=null){const P=TPRESETS[el.value];if(!P)return true;edit(()=>selClips().filter(c=>c.type==="title").forEach(c=>{Object.assign(c,clone(P));if(!P.animOut)delete c.animOut}));$("#insp").dataset.k="";renderInsp();return true}
  if(el.dataset.hlon!=null){const on=el.checked;edit(()=>selClips().filter(c=>c.type==="title").forEach(c=>{c.hl=on?(c.hl||$("#cp-hl").value||"#f4c430"):""}));return true}
  if(el.dataset.mkdone){const id=el.dataset.mkdone,on=el.checked;edit(tl=>{const m=(tl.markers||[]).find(x=>x.id===id);if(m)m.done=on});renderIndex();return true}
  if(el.id==="xq"){if(E.x)E.x.q=el.value;return true}
  if(el.id==="xrange"){if(E.x)E.x.range=el.checked;return true}
  if(el.id==="xres"){if(E.x)E.x.scale=+el.value;return true}
  if(el.id==="xlufs"){if(E.x)E.x.lufs=el.value;return true}
  if(el.id==="xeng"){if(E.x){E.x.engine=el.checked?"rt":"fast";$("#modal").dataset.k="";edModal()}return true}
  return false}
function edSettingsRows(){const tl=E.tl||newTL(defaultFormat(cur()));const fm=tl.w+"x"+tl.h;
  const opts=[["1080x1920","Vertical 1080×1920"],["1920x1080","Horizontal 1920×1080"],["1080x1080","Square 1080×1080"],["1080x1350","Portrait 1080×1350"],["3840x2160","4K UHD 3840×2160"]];
  return`<div class="prow"><label for="ts-fmt">Format</label><select id="ts-fmt" data-ts="fmt">${opts.map(([v,l])=>`<option value="${v}" ${v===fm?"selected":""}>${l}</option>`).join("")}</select></div>
    <div class="prow"><label for="ts-fps">Timeline fps</label><select id="ts-fps" data-ts="fps">${[24,25,30,50,60].map(v=>`<option ${tl.fps===v?"selected":""}>${v}</option>`).join("")}</select></div>
    <div class="prow"><label for="ts-bg">Background</label><input type="color" id="ts-bg" data-ts="bg" value="${esc(tl.bg||"#000000")}" style="height:26px;padding:1px"></div>`}

/* ---------- export ---------- */
function pickMime(){const list=["video/mp4;codecs=avc1.640028,mp4a.40.2","video/mp4;codecs=avc1,mp4a","video/mp4","video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
  if(typeof MediaRecorder==="undefined")return null;return list.find(m=>{try{return MediaRecorder.isTypeSupported(m)}catch(e){return false}})||null}
function edBusy(){return E.x&&E.x.phase==="running"}
function openExport(){if(!E.tl||!E.tl.clips.length)return;pause();E.x={phase:"setup",q:"std",lufs:"-14",range:E.rin!=null&&E.rout!=null&&E.rout>E.rin};state.modal="export";$("#modal").dataset.k="";render()}
function edModal(){const x=E.x;if(!x){state.modal=null;$("#modal").innerHTML="";return}
  const k="x|"+x.phase;if($("#modal").dataset.k===k&&x.phase==="running"){const b=$("#xbar");if(b)b.style.width=(x.pct||0)+"%";const t=$("#xtc");if(t)t.textContent=(x.stage?x.stage+" · ":"")+tcs(x.tc!=null?x.tc:E.t)+" / "+tcs(x.end!=null?x.end:tlDur());return}
  $("#modal").dataset.k=k;const tl=E.tl,mime=pickMime(),ext=mime&&mime.includes("mp4")?"mp4":"webm";
  let h="";
  const fast=typeof FAST_OK!=="undefined"&&FAST_OK&&x.engine!=="rt";
  if(x.phase==="setup")h=`<h3>Export</h3><div style="font-size:12.5px;color:var(--muted)">${tl.w}×${tl.h} · ${tl.fps} fps · ${tcs(tlDur())} · ${fast?"MP4 (H.264)":ext.toUpperCase()}</div>
    ${mime||fast?`<div class="f"><label for="xq">Quality</label><select id="xq"><option value="hi">High (12 Mbps)</option><option value="std" selected>Standard (6 Mbps)</option><option value="sm">Small (3 Mbps, good for Edit Bay renders)</option><option value="max">Master (25 Mbps)</option></select></div>
    <div class="f"><label for="xres">Resolution</label><select id="xres">${[1,1080,720,540].filter(r=>r===1||r<Math.min(tl.w,tl.h)).map(r=>{const sc=r===1?1:r/Math.min(tl.w,tl.h);return`<option value="${sc}" ${(x.scale||1)===sc?"selected":""}>${r===1?"Full · ":""}${Math.round(tl.w*sc/2)*2}×${Math.round(tl.h*sc/2)*2}</option>`}).join("")}</select></div>
    ${E.rin!=null&&E.rout!=null&&E.rout>E.rin?`<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--text)"><input type="checkbox" id="xrange" ${x.range?"checked":""} style="width:auto"> Only the In–Out range (${tcs(E.rin)} → ${tcs(E.rout)})</label>`:""}<div class="f"><label for="xlufs">Loudness</label><select id="xlufs">${[["-14","−14 LUFS · YouTube, Spotify, socials"],["-16","−16 LUFS · podcasts, Apple"],["-23","−23 LUFS · EBU R128 broadcast"],["off","Off · keep the mix as it is"]].map(([v,l])=>`<option value="${v}" ${(x.lufs||"-14")===v?"selected":""}>${l}</option>`).join("")}</select></div>
    ${typeof FAST_OK!=="undefined"&&FAST_OK?`<div style="font-size:11.5px;color:var(--dim)">Frame-accurate render, usually faster than real time. You can switch tabs while it works. Peaks are limited to −1 dB.</div><label style="display:flex;gap:6px;align-items:center;font-size:11.5px;color:var(--dim)"><input type="checkbox" id="xeng" ${x.engine==="rt"?"checked":""} style="width:auto"> Use the real-time recorder instead</label>`:`<div style="font-size:11.5px;color:var(--dim)">This browser records the export in real time: keep this tab open and visible until it finishes.</div>`}`:`<div style="color:var(--warn);font-size:12.5px">This browser can’t record video. Use Chrome, Edge or Safari 14.1+, or ask Claude to render the timeline.</div>`}
    <div class="acts"><button type="button" class="btn" id="xClose">Cancel</button>${mime||fast?`<button type="button" class="btn blue" id="xGo">Export</button>`:`<button type="button" class="btn purple" id="xAsk">Ask Claude to render</button>`}</div>`;
  else if(x.phase==="running")h=`<h3>Exporting…</h3><div class="xprog"><i id="xbar" style="width:${x.pct||0}%"></i></div><div class="mono" id="xtc" style="font-size:12px;color:var(--muted)">${x.stage?esc(x.stage)+" · ":""}${tcs(x.tc!=null?x.tc:E.t)} / ${tcs(x.end!=null?x.end:tlDur())}</div><div class="acts"><button type="button" class="btn" id="xCancel">Cancel</button></div>`;
  else if(x.phase==="done")h=`<h3>Export finished</h3><video class="xprev" src="${x.url}" controls playsinline></video><div style="font-size:12px;color:var(--muted)">${fmtBytes(x.blob.size)} · ${x.ext.toUpperCase()}${x.codec?" ("+x.codec+")":""} · ${x.w}×${x.h}${x.secs?` · rendered in ${x.secs.toFixed(1)} s (${x.realtime.toFixed(1)}× real time)`:""}</div>
    ${x.loud&&x.loud.before?`<div class="mono" style="font-size:11.5px;color:var(--muted)">Loudness ${isFinite(x.loud.before.I)?x.loud.before.I.toFixed(1):"—"} LUFS${x.loud.after?` → ${x.loud.after.I.toFixed(1)} LUFS · peak ${x.loud.after.peak.toFixed(1)} dB`:` · peak ${x.loud.before.peak.toFixed(1)} dB`}</div>`:""}
    <div class="acts" style="flex-wrap:wrap">${downloads?`<button type="button" class="btn" id="xSave">Save to device</button>`:""}${assets||IDB_OK?`<button type="button" class="btn blue" id="xAdd">Add to Renders</button>`:""}<button type="button" class="btn" id="xClose">Close</button></div>
    ${x.blob.size>MAXMB*1048576&&assets&&!assets.local?`<div style="font-size:11.5px;color:var(--dim)">Over ${MAXMB} MB, so the render is kept on this device. Export at Small quality if Claude or other devices should see it.</div>`:""}`;
  else if(x.phase==="error")h=`<h3>Export failed</h3><div style="font-size:12.5px;color:var(--warn)">${esc(x.err||"Something went wrong.")}</div><div class="acts"><button type="button" class="btn" id="xClose">Close</button></div>`;
  $("#modal").innerHTML=`<div class="ov" id="ov"><div class="dlg" role="dialog" aria-label="Export">${h}</div></div>`}
async function runExport(){const x=E.x,mime=pickMime();if(!mime)return;ensureAudio();pause();E.compare=false;
  const cv=$("#pgm");if(!cv||!cv.captureStream){x.phase="error";x.err="This browser can’t capture the canvas.";edModal();return}
  const br={max:25e6,hi:12e6,std:6e6,sm:3e6}[x.q||"std"]*Math.max(.35,(x.scale||1));
  E.skimT=null;const useR=x.range&&E.rin!=null&&E.rout!=null&&E.rout>E.rin;x.start=useR?E.rin:0;x.end=useR?E.rout:tlDur();E.t=x.start;sync();drawFrame();await new Promise(r=>setTimeout(r,700));
  const sc=x.scale||1;x.w=Math.round(E.tl.w*sc/2)*2;x.h=Math.round(E.tl.h*sc/2)*2;let src=cv;if(sc<1){x.xc=document.createElement("canvas");x.xc.width=x.w;x.xc.height=x.h;x.xcx=x.xc.getContext("2d");x.xcx.drawImage(cv,0,0,x.w,x.h);src=x.xc}
  const stream=src.captureStream(E.tl.fps);if(XDEST)XDEST.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
  let rec;try{rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:br,audioBitsPerSecond:192000})}catch(e){x.phase="error";x.err="Recorder couldn’t start: "+e.message;edModal();return}
  const chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  rec.onstop=()=>{if(x.cancel){E.x=null;state.modal=null;render();return}const blob=new Blob(chunks,{type:mime.split(";")[0]});x.blob=blob;x.url=URL.createObjectURL(blob);x.ext=mime.includes("mp4")?"mp4":"webm";x.phase="done";$("#modal").dataset.k="";edModal()};
  x.rec=rec;x.phase="running";edModal();rec.start(250);E.rate=1;play();
  x.tick=setInterval(()=>{x.pct=Math.min(100,(E.t-x.start)/Math.max(.01,x.end-x.start)*100);edModal()},200)}
function finishExport(){const x=E.x;if(!x||!x.rec)return;clearInterval(x.tick);x.pct=100;setTimeout(()=>{try{x.rec.stop()}catch(e){}},180)}
function cancelExport(){const x=E.x;if(!x)return;x.cancel=true;clearInterval(x.tick);pause();try{x.rec&&x.rec.stop()}catch(e){E.x=null;state.modal=null;render()}}
async function saveExport(){const x=E.x,p=cur();if(!x||!downloads)return;const name=(p?p.title:"edit").replace(/[^\w\- ]+/g,"").trim().replace(/\s+/g,"_")+"_"+ymd(new Date())+"."+x.ext;
  try{await downloads.save({filename:name,data:x.blob});toast("SAVED",name)}catch(e){if(e&&e.code!=="declined")toast("COULDN’T SAVE",(e&&e.message)||"Try again.")}}
async function addExportToRenders(){const x=E.x,p=cur();if(!x||!p)return;const b=$("#xAdd");if(b){b.disabled=true;b.textContent="Saving…"}
  try{const cloud=assets&&!assets.local&&x.blob.size<=MAXMB*1048576;let a={id:null},lid=null;if(cloud)a=await assets.upload(new File([x.blob],"cut."+x.ext,{type:x.blob.type}));else lid=await LBLOB.put(x.blob);const n=(p.renders||[]).filter(r=>r.by==="joe").length+1;const rid=uid("rnd"),ver="cut-"+n;
    const tl=E.tl;mutate(p.id,q=>{(q.renders=q.renders||[]).push({id:rid,ver,...(a.id?{assetId:a.id}:{localId:lid}),aspect:tl.w>tl.h?"16:9":tl.w===tl.h?"1:1":"9:16",fps:tl.fps,dur:+tlDur().toFixed(2),by:"joe",at:nowISO(),note:"Exported from the timeline (rev "+tl.rev+")"});
      (q.log=q.log||[]).push({id:uid("e"),at:nowISO(),who:"joe",type:"note",stage:q.stage,text:"Exported "+ver+" from the timeline",ver,render:rid})});
    toast("ADDED TO RENDERS",ver+(a.id?" · Claude can see it now":" · kept on this device"));if(b)b.textContent="Added ✓"}
  catch(e){if(b){b.disabled=false;b.textContent="Add to Renders"}toast("UPLOAD FAILED",(e&&e.code)||"Try again.")}}

/* ---------- clicks / submits from the shell ---------- */
function edClick(t,e){
  if(t.dataset.tool){E.tool=t.dataset.tool;renderTools();edTimeline()}
  else if(t.id==="undoBtn")undo();else if(t.id==="redoBtn")redo();
  else if(t.id==="snapBtn"){E.snap=!E.snap;renderTools();edTimeline()}
  else if(t.id==="titleBtn"||t.dataset.addtitle)addTitleAtPlayhead();
  else if(t.id==="markBtn")addMarker("");
  else if(t.id==="fitBtn"){if(state.ttab==="edit"){E.pps=null;edTimeline();$("#tlscroll").scrollLeft=0;renderTools()}else{state.hppd=null;renderHistory()}}
  else if(t.id==="exportBtn")openExport();
  else if(t.id==="impBtn")$("#fileIn").click();
  else if(t.id==="pPlay")togglePlay();else if(t.id==="pStart"){pause();seek(0)}else if(t.id==="pEnd"){pause();seek(tlDur())}
  else if(t.id==="skimBtn"){E.skim=!E.skim;t.classList.toggle("on",E.skim)}
  else if(t.dataset.media!=null&&!e.target.dataset.delmedia){E.mediaSel=t.dataset.media;renderMediaBrowser()}
  else if(t.dataset.cl){const c=clipById(t.dataset.cl);if(c){E.sel=new Set([c.id]);pause();seek(c.start);state.itab="clip";render()}}
  else if(t.dataset.mkseek){const m=((E.tl&&E.tl.markers)||[]).find(x=>x.id===t.dataset.mkseek);if(m){pause();seek(m.t)}}
  else if(t.dataset.delmk){const id=t.dataset.delmk;edit(tl=>{tl.markers=(tl.markers||[]).filter(m=>m.id!==id)});renderIndex()}
  else if(t.dataset.cpdel)deleteSel(true);
  else if(t.dataset.kf)toggleKf(t.dataset.kf);
  else if(t.dataset.kfnav){const[k,d]=t.dataset.kfnav.split(":");kfJump(k,+d)}
  else if(t.dataset.freeze)freezeAt();
  else if(t.dataset.detach)detachAudio();
  else if(t.dataset.trall){const c=selClips()[0];if(c&&c.tr){edit(()=>v1().forEach((x,i)=>{if(i>0)x.tr=clone(c.tr)}));toast("TRANSITIONS","Every cut in the storyline now uses "+((TRANS.find(x=>x[0]===c.tr.type)||[])[1]||"this transition")+".")}}
  else if(t.id==="loopBtn"){E.loop=!E.loop;t.classList.toggle("on",E.loop)}
  else if(t.id==="safeBtn"){E.safe=!E.safe;t.classList.toggle("on",E.safe);renderSafe()}
  else if(t.id==="cmpBtn"){E.compare=!E.compare;t.classList.toggle("on",E.compare);requestDraw()}
  else if(t.id==="fsBtn"){const b=$("#pgmBox");if(b&&b.requestFullscreen)b.requestFullscreen().catch(()=>toast("FULL SCREEN","This view doesn’t allow full screen."))}
  else if(t.dataset.cpsplit)bladeAtPlayhead();
  else if(t.dataset.cpreset){const c=clipById([...E.sel][0]);if(!c)return;const k=t.dataset.cpreset;edit(()=>{if(k==="tf")Object.assign(c,{scale:1,x:0,y:0,rot:0,op:1,kb:false});else Object.assign(c,{bri:0,con:0,sat:0})});$("#insp").dataset.k="";renderInsp()}
  else if(t.dataset.askclip){state.itab="claude";render();const r=$("#reqText");if(r)r.focus()}
  else if(t.id==="xGo")runExport();else if(t.id==="xCancel")cancelExport();
  else if(t.id==="xClose"){if(E.x&&E.x.url)URL.revokeObjectURL(E.x.url);E.x=null;state.modal=null;render()}
  else if(t.id==="xSave")saveExport();else if(t.id==="xAdd")addExportToRenders();
  else if(t.id==="xAsk"){E.x=null;state.modal=null;state.itab="claude";render();const r=$("#reqText");if(r){r.value="Render the current timeline as a preview and add it to Renders.";r.focus()}}
}
document.addEventListener("click",e=>{const d=e.target.closest("[data-delmedia]");if(!d)return;e.stopPropagation();const id=d.dataset.delmedia;
  const used=E.tl&&E.tl.clips.some(c=>c.mediaId===id);if(used){toast("IN USE","Remove its clips from the timeline first.");return}
  const gone=mediaOf(id);state.media=state.media.filter(m=>m.id!==id);if(E.mediaSel===id)E.mediaSel=null;renderMediaBrowser();if(db)db.doc("media/"+id).delete().catch(saveErr);
  if(gone&&gone.localId)LBLOB.del(gone.localId);if(gone&&gone.assetId&&assets&&!assets.local&&!state.media.some(m=>m.assetId===gone.assetId))assets.delete(gone.assetId).catch(()=>{})},true);
function edSubmit(f){if(f.id==="mkForm"){const v=$("#mkText").value.trim();$("#mkText").value="";addMarker(v)}}
// media browser drag + double-click + drop zone
document.addEventListener("dragstart",e=>{const m=e.target.closest&&e.target.closest("[data-media]");if(!m)return;e.dataTransfer.setData("text/edit-media",m.dataset.media);e.dataTransfer.effectAllowed="copy";E.mediaSel=m.dataset.media});
document.addEventListener("dblclick",e=>{const m=e.target.closest&&e.target.closest("[data-media]");if(!m)return;E.mediaSel=m.dataset.media;addFromBrowser("append")});
$("#bbody").addEventListener("dragover",e=>{if(state.btab!=="media")return;if([...e.dataTransfer.types].includes("Files")){e.preventDefault();const g=$("#mgrid");g&&g.classList.add("drop")}});
$("#bbody").addEventListener("dragleave",()=>{const g=$("#mgrid");g&&g.classList.remove("drop")});
$("#bbody").addEventListener("drop",e=>{if(state.btab!=="media")return;e.preventDefault();const g=$("#mgrid");g&&g.classList.remove("drop");const fs=[...(e.dataTransfer.files||[])];if(fs.length)importFiles(fs)});

/* ---------- keyboard (Final Cut keys) ---------- */
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){if(state.modal&&!edBusy()){if(E.x&&E.x.url)URL.revokeObjectURL(E.x.url);E.x=null;state.modal=null;render();return}if(state.bg){state.bg=false;renderBg();renderLive();return}if(E.sel.size){E.sel.clear();render()}return}
  if(typing(e.target)||state.modal)return;
  const k=e.key,mod=e.metaKey||e.ctrlKey,rv=state.vmode==="renders"?$("#rvid"):null;
  if(mod&&k==="9"){e.preventDefault();state.bg=!state.bg;renderBg();renderLive();return}
  if(rv){if(k===" "){e.preventDefault();rv.paused?rv.play().catch(()=>{}):rv.pause()}else if(k==="ArrowLeft"||k==="ArrowRight"){e.preventDefault();rv.pause();rv.currentTime+= (k==="ArrowRight"?1:-1)/(parseFloat(rFps())||30)}return}
  if(!cur())return;
  if(mod&&(k==="z"||k==="Z")){e.preventDefault();e.shiftKey?redo():undo();return}
  if(mod&&(k==="b"||k==="B")){e.preventDefault();bladeAtPlayhead();return}
  if(mod&&(k==="e"||k==="E")){e.preventDefault();openExport();return}
  if(mod&&(k==="="||k==="+")){e.preventDefault();zoomBy(1.4);return}
  if(mod&&k==="-"){e.preventDefault();zoomBy(1/1.4);return}
  if(mod&&(k==="a"||k==="A")){e.preventDefault();if(E.tl){E.sel=new Set(E.tl.clips.map(c=>c.id));render()}return}
  const code=e.code||"";
  if(mod&&code==="KeyC"){e.preventDefault();copySel();return}
  if(mod&&code==="KeyX"){e.preventDefault();copySel();deleteSel(true);return}
  if(mod&&code==="KeyV"){e.preventDefault();e.altKey?pasteAttrs():pasteClips();return}
  if(mod&&code==="KeyT"){e.preventDefault();addDefaultTransition();return}
  if(mod&&code==="KeyL"){e.preventDefault();E.loop=!E.loop;const b=$("#loopBtn");if(b)b.classList.toggle("on",E.loop);return}
  if(mod&&e.shiftKey&&code==="KeyF"){e.preventDefault();const b=$("#pgmBox");if(b&&b.requestFullscreen)b.requestFullscreen().catch(()=>{});return}
  if(mod&&k>="1"&&k<="4"&&typeof setPage==="function"){e.preventDefault();setPage(["edit","color","audio","deliver"][+k-1]);return}
  if(mod)return;
  if(e.altKey&&code==="KeyF"){e.preventDefault();freezeAt();return}
  if(e.altKey&&code==="KeyX"){e.preventDefault();setRange("x");return}
  if(e.altKey)return;
  switch(k){
    case" ":e.preventDefault();togglePlay();break;
    case"k":case"K":pause();break;
    case"l":case"L":if(!E.playing){E.rate=1;play()}else E.rate=Math.min(8,E.rate*2);break;
    case"j":case"J":if(E.playing&&E.rate>1)E.rate/=2;else{pause();seek(E.t-1)}break;
    case"ArrowLeft":case"ArrowRight":e.preventDefault();pause();seek(E.t+(k==="ArrowRight"?1:-1)*(e.shiftKey?10:1)*FR());break;
    case"ArrowUp":e.preventDefault();jumpEdit(-1);break;case"ArrowDown":e.preventDefault();jumpEdit(1);break;
    case"Home":pause();seek(0);break;case"End":pause();seek(tlDur());break;
    case"a":case"A":E.tool="select";renderTools();edTimeline();break;
    case"b":case"B":E.tool="blade";renderTools();edTimeline();break;
    case"Delete":case"Backspace":e.preventDefault();deleteSel(!e.shiftKey);break;
    case"e":case"E":addFromBrowser("append");break;case"q":case"Q":addFromBrowser("connect");break;case"w":case"W":addFromBrowser("insert");break;
    case"t":case"T":addTitleAtPlayhead();break;
    case"m":case"M":addMarker("");break;
    case"i":case"I":setRange("i");break;case"o":case"O":setRange("o");break;
    case"y":case"Y":E.tool="slip";renderTools();edTimeline();break;
    case"r":case"R":E.tool="roll";renderTools();edTimeline();break;
    case"v":case"V":if(E.sel.size){const cs=selClips();const off=!cs.every(c=>c.off);edit(()=>cs.forEach(c=>{if(off)c.off=true;else delete c.off}))}break;
    case"'":E.safe=!E.safe;renderSafe();{const b=$("#safeBtn");if(b)b.classList.toggle("on",E.safe)}break;
    case"C":if(e.shiftKey){E.compare=!E.compare;const b=$("#cmpBtn");if(b)b.classList.toggle("on",E.compare);requestDraw()}break;
    case"n":case"N":E.snap=!E.snap;renderTools();edTimeline();break;
    case"S":if(e.shiftKey){E.ascrub=!E.ascrub;const ab=$("#ascrubBtn");if(ab)ab.classList.toggle("on",E.ascrub);break}
    case"s":E.skim=!E.skim;const sb=$("#skimBtn");if(sb)sb.classList.toggle("on",E.skim);break;
    case"Z":if(e.shiftKey){E.pps=null;edTimeline();renderTools()}break;
    case"?":state.modal="keys";E.x=null;showKeys();break;
  }
});
function showKeys(){$("#modal").dataset.k="keys";const K=[["Space","Play / pause"],["J K L","Reverse, stop, forward (press again = faster)"],["F","Match frame: open the clip in the Source viewer"],["W D E Q","Source viewer: insert, overwrite, append, connect"],["+n −n ↵","Nudge the playhead, or trim the selection, by n frames"],["⇧S","Audio scrubbing"],["← →","One frame (⇧ = 10)"],["↑ ↓","Previous / next edit"],["A / B","Select / Blade tool"],["⌘B","Blade at playhead"],["Delete","Ripple delete (⇧ = leave a gap)"],["E / Q / W","Append / Connect / Insert from Browser"],["T","Title at playhead"],["M","Marker at playhead"],["N / S","Snapping / Skimming"],["⌘Z / ⇧⌘Z","Undo / Redo"],["⌘= ⌘− ⇧Z","Zoom in / out / to fit"],["⌘E","Export"],["⌘9","Background Tasks (Claude)"],["Y / R","Slip / Roll tool"],["I / O / ⌥X","Mark In / Out / clear range"],["⌘L","Loop the range"],["⌥F","Freeze frame"],["⌘T","Add cross dissolve"],["⌘C ⌘X ⌘V","Copy, cut, paste at playhead"],["⌥⌘V","Paste attributes (look, transform, audio)"],["V","Disable / enable clip"],["'","Safe zones"],["⇧C","Before/after colour split"],["⌘1–4","Edit, Color, Audio, Deliver pages"],["⇧⌘F","Full screen viewer"],["1–4","Multicam: cut to that angle (⇧ = switch without cutting)"]];
  $("#modal").innerHTML=`<div class="ov" id="ov"><div class="dlg" role="dialog" aria-label="Keyboard shortcuts"><h3>Keyboard shortcuts</h3><div class="keys">${K.map(([a,b])=>`<span class="kbd">${a}</span><span>${b}</span>`).join("")}</div><div class="acts"><button class="btn" id="xClose">Close</button></div></div></div>`}
window.addEventListener("resize",()=>{clearTimeout(E.rz);E.rz=setTimeout(()=>{if(state.ttab==="edit"&&!E.pps)edTimeline()},150)});
