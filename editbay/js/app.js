/* Edit Bay — shell: data, projects, Claude sync (activity/requests), inspector tabs, history view. Editor engine lives in editor.js. */
const STAGES=[["brief","Brief"],["assets","Ingest"],["voice","Rough cut"],["preview","Review"],["revisions","Revisions"],["finals","Final"],["delivered","Delivered"]];
const STAGE_COL={brief:"#6b7383",assets:"#8a7a5a",voice:"#c46f45",preview:"#f4c430",revisions:"#d9b63a",finals:"#8fb84a",delivered:"#4fbf6b"};
const WHO_COL={claude:"var(--claude)",joe:"var(--joe)",client:"var(--client)"};
const KINDS=["Social video","Commercial","Event recap","Music video","Short film","Documentary","Interview / podcast","Other"];
const CHECK_SPEC=["Brief approved","Footage and music licensed","Script / VO locked","Picture lock","Colour grade","Music ≥15 dB under dialogue","End card / call to action","Loudness −14 LUFS, peaks −1 dBTP","16:9 export","9:16 export","Client sign-off"];
const CHECK_GEN=["Footage in","Selects","Rough cut","Picture lock","Colour","Sound mix","Captions","Exports","Archive project"];
const REQ_LBL={open:["Waiting for Claude","open"],picked:["Claude on it","prog"],done:["Done","done"],needs:["Needs you","need"]};
const DAY=864e5,HR=36e5,STALE=20*6e4;

const state={projects:[],activity:[],requests:[],media:[],timelines:{},sel:null,filter:"all",mode:"loading",note:"",hl:null,confirmDel:false,
  itab:"info",ix:true,hppd:null,aspect:null,modal:null,bg:false,ver:null,btab:"media",ttab:"edit",ixtab:"clips",vmode:"timeline"};
let db=null,assets=null,downloads=null;

const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
function parseD(s){if(!s)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}const d=new Date(s);return isNaN(d)?null:d}
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const nowISO=()=>{const d=new Date();return ymd(d)+"T"+pad(d.getHours())+":"+pad(d.getMinutes())};
const nowSec=()=>{const d=new Date();return nowISO()+":"+pad(d.getSeconds())};
const dayStart=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const fmtD=d=>d.toLocaleDateString("en-IE",{day:"numeric",month:"short"});
const fmtDT=d=>fmtD(d)+" "+pad(d.getHours())+":"+pad(d.getMinutes());
const ago=s=>{const d=parseD(s);if(!d)return"";const m=Math.round((Date.now()-d)/6e4);if(m<1)return"just now";if(m<60)return m+"m ago";const h=Math.round(m/60);if(h<24)return h+"h ago";return Math.round(h/24)+"d ago"};
const sIdx=k=>Math.max(0,STAGES.findIndex(s=>s[0]===k));
const sLabel=k=>(STAGES.find(s=>s[0]===k)||STAGES[0])[1];
const uid=p=>p+"-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const cur=()=>state.projects.find(p=>p.id===state.sel)||null;
const pTitle=id=>(state.projects.find(p=>p.id===id)||{}).title||"";
const logOf=p=>(p.log||[]).slice().sort((a,b)=>String(a.at).localeCompare(String(b.at)));
const isStale=a=>a.status==="working"&&(Date.now()-(parseD(a.updatedAt)||0))>STALE;
const liveActs=()=>state.activity.filter(a=>a.status==="working"||a.status==="waiting");
const actFor=id=>state.activity.filter(a=>a.projectId===id&&(a.status==="working"||a.status==="waiting"));
const reqsFor=id=>state.requests.filter(r=>r.projectId===id).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
const blobUrl=r=>r?((r.localId&&LURL[r.localId])||(r.assetId?"/_blob/"+r.assetId:"")||r.url||""):"";
const rendersOf=p=>(p.renders||[]).slice().sort((a,b)=>String(b.at).localeCompare(String(a.at)));
const WHO=x=>x==="claude"?"CLAUDE":x==="client"?"CLIENT":"YOU";
const typing=el=>el&&el.matches&&el.matches("input:not([type=range]):not([type=checkbox]):not([type=color]),textarea,select,[contenteditable]");

function dueInfo(p){
  if(p.stage==="delivered")return{txt:"Delivered",col:"var(--done)"};
  const d=parseD(p.due);if(!d)return{txt:"No due date",col:"var(--muted)"};
  const n=Math.round((dayStart(d)-dayStart(new Date()))/DAY);
  if(n<0)return{txt:(-n)+"d overdue",col:"var(--todo)"};
  if(n===0)return{txt:"Due today",col:"var(--todo)"};
  return{txt:"Due in "+n+"d",col:n<=3?"var(--warn)":"var(--muted)"};
}
function sorted(){return state.projects.slice().sort((a,b)=>{const ad=a.stage==="delivered",bd=b.stage==="delivered";if(ad!==bd)return ad?1:-1;const x=parseD(a.due),y=parseD(b.due);if(x&&y)return x-y;if(x)return -1;if(y)return 1;return String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))})}
function tcode(sec,fps){fps=Math.round(parseFloat(fps)||30);if(sec==null||isNaN(sec))return"--:--:--:--";sec=Math.max(0,sec);let fr=Math.round(sec*fps);const f=fr%fps;let s=Math.floor(fr/fps);return pad(Math.floor(s/3600))+":"+pad(Math.floor(s/60)%60)+":"+pad(s%60)+":"+pad(f)}

/* ---------- persistence ---------- */
const queues={},timers={};
function saveErr(e){const c=e&&e.code;state.note=c==="invalid_argument"?"That change wasn’t saved: you may only have view access to this tracker.":c==="quota_exceeded"?"Storage is full. Delete old media, renders or projects to save new changes.":"A change didn’t save ("+(c||"error")+"). Try again in a moment.";renderNote()}
function persist(p){if(!db)return;const body=clone(p);delete body.id;
  queues[p.id]=(queues[p.id]||Promise.resolve()).then(()=>db.doc("projects/"+p.id).set(body)).catch(saveErr)}
function mutate(id,fn,{render:doRender=true,debounce=0}={}){const i=state.projects.findIndex(p=>p.id===id);if(i<0)return;
  const p=clone(state.projects[i]);fn(p);p.updatedAt=nowISO();state.projects[i]=p;if(doRender)render();
  clearTimeout(timers[id]);if(debounce)timers[id]=setTimeout(()=>{delete timers[id];persist(state.projects.find(q=>q.id===id))},debounce);else persist(p)}
function addLog(pid,entry){mutate(pid,q=>{(q.log=q.log||[]).push(Object.assign({id:uid("e"),at:nowISO(),who:"joe",type:"note",stage:q.stage},entry))},{render:false})}

function toast(head,body){const box=$("#toasts");const el=document.createElement("div");el.className="toast";el.setAttribute("role","status");el.innerHTML=`<b>${esc(head)}</b>${esc(body)}`;box.appendChild(el);while(box.children.length>2)box.firstChild.remove();setTimeout(()=>el.remove(),4500)}

/* ---------- render shell ---------- */
let rendering=false;
function render(){
  if(rendering)return;rendering=true;
  try{
  const a=document.activeElement,aid=a&&a.id,val=a&&("value" in a)?a.value:null,ss=a&&a.selectionStart!=null?a.selectionStart:null;
  const p=cur();$("#winName").textContent="Edit Bay — "+(p?p.title:"No project");
  renderNote();renderLive();renderBrowser();renderViewer();renderItabs();renderInsp();renderDash();renderTools();renderIndex();renderTimelineArea();renderBg();renderModal();
  $("#ixBtn").setAttribute("aria-pressed",state.ix);$("#tlrow").classList.toggle("noix",!state.ix);
  if(aid){const el=document.getElementById(aid);if(el&&el!==a){if(val!=null&&el.type!=="checkbox"&&el.tagName!=="SELECT"&&el.type!=="file")el.value=val;el.focus();try{if(ss!=null)el.setSelectionRange(ss,ss)}catch(e){}}}
  }finally{rendering=false}
}
function renderNote(){let n=state.note;if(typeof renderSaveChip==="function")renderSaveChip();$("#note").innerHTML=n?`<div class="note" role="status">${esc(n)} <button class="btn sm" id="noteX" style="margin-left:8px">OK</button></div>`:""}
function renderLive(){
  const live=liveActs(),w=live.filter(a=>a.status==="working"&&!isStale(a)),wait=live.filter(a=>a.status==="waiting");
  $("#livePulse").className="pulse"+(w.length?" on":wait.length?" wait":"");
  let txt="Claude idle";
  if(w.length){const a=w[0];txt="Claude: "+(a.step||a.title||"working")+(a.progress!=null?" · "+Math.round(a.progress*100)+"%":"")+(w.length>1?"  +"+(w.length-1):"")}
  else if(wait.length)txt="Claude is waiting on you: "+(wait[0].step||wait[0].title||"");
  else if(live.length)txt="Claude: no update for a while";
  $("#liveTxt").textContent=txt;
  const prog=w.length?w.reduce((s,a)=>s+(a.progress||0),0)/w.length:0;
  $("#ringArc").setAttribute("stroke-dasharray",(w.length?Math.max(.06,prog)*50.3:0)+" 50.3");
  $("#bgLbl").textContent=w.length?w.length+" running":wait.length?wait.length+" waiting":"Claude";
  $("#bgBtn").setAttribute("aria-pressed",state.bg);
}
const inFilter=(p,f=state.filter)=>f==="all"||(f==="active"?p.stage!=="delivered":f==="review"?(p.stage==="preview"||p.stage==="revisions"):f==="claude"?actFor(p.id).length>0||reqsFor(p.id).some(r=>r.status==="open"||r.status==="picked"):p.stage==="delivered");

function renderBrowser(){
  document.querySelectorAll("[data-btab]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.btab===state.btab));
  if(state.btab==="media"){renderMediaBrowser();return}
  $("#bacts").innerHTML=`<button class="btn blue" id="newBtn">+ New Project</button>`;
  let body=$("#bbody").querySelector(".browser");
  if(!body){$("#bbody").innerHTML=`<div class="browser"><nav class="libs" id="libs"></nav><div class="cards" id="cards"></div></div>`}
  renderLibs();renderCards();
}
function renderLibs(){
  const c=k=>state.projects.filter(p=>inFilter(p,k)).length;
  const b=(k,l)=>`<button class="ev" data-filter="${k}" aria-pressed="${state.filter===k}">${l}<span>${c(k)}</span></button>`;
  $("#libs").innerHTML=`<div class="lib">Library</div>${b("all","All Projects")}${b("active","In Edit")}${b("review","In Review")}${b("done","Delivered")}<div class="lib" style="margin-top:6px">Claude</div>${b("claude","With Claude")}`;
}
function renderCards(){
  const list=sorted().filter(p=>inFilter(p));
  if(state.mode==="loading"&&!state.projects.length){$("#cards").innerHTML=`<div class="empty">Loading projects…</div>`;return}
  if(!list.length){$("#cards").innerHTML=`<div class="empty">${state.projects.length?"No projects here.":"No projects yet. Click + New Project."}</div>`;return}
  $("#cards").innerHTML=list.map(p=>{const i=sIdx(p.stage),di=dueInfo(p),acts=actFor(p.id);const tl=state.timelines[p.id];const nc=tl&&tl.clips?tl.clips.length:0;
    const frames=STAGES.map(([k],j)=>`<i style="${j<=i?`background:${STAGE_COL[k]};opacity:${j===i?1:.55}`:""}"></i>`).join("");
    const badge=acts.length?`<span class="badge"><span class="pulse ${acts.some(a=>a.status==="working"&&!isStale(a))?"on":"wait"}" style="width:6px;height:6px"></span>CLAUDE</span>`:nc?`<span class="badge">${nc} clips</span>`:"";
    return`<button class="card" data-sel="${esc(p.id)}" aria-current="${p.id===state.sel}" title="${esc(p.title)} · ${esc(sLabel(p.stage))}">
      <span class="strip" aria-hidden="true">${frames}${badge}</span><span class="t">${esc(p.title||"Untitled")}</span>
      <span class="s"><span>${esc(sLabel(p.stage))}</span><span style="color:${di.col}">${esc(di.txt)}</span></span></button>`}).join("");
}

/* ---------- viewer: timeline (editor.js) or renders ---------- */
let rKey="";
function curRender(p){const rs=rendersOf(p);if(!rs.length)return null;return rs.find(r=>r.id===state.ver)||rs[0]}
function renderViewer(){
  const p=cur();
  if(!p){rKey="";edViewerKey="";$("#vName").textContent="Viewer";$("#vMeta").textContent="";$("#vArea").innerHTML=`<div class="empty">Select a project in the Browser.</div>`;$("#transport").innerHTML="";return}
  if(state.vmode==="timeline"){rKey="";edViewer();return}
  edViewerKey="";edPause();
  const r=curRender(p);
  const key=[p.id,r?r.id:""].join("|");
  $("#vName").innerHTML=`<b>${esc(p.title)}</b> <span style="color:var(--dim)">· Renders</span>`;
  $("#vMeta").textContent=r?[r.ver,r.aspect,r.fps?r.fps+"p":""].filter(Boolean).join(" · "):"";
  if(key===rKey){updRTransport();return}
  rKey=key;
  const asp=r&&(r.aspect==="9:16"||r.aspect==="4:5")?"v":"h";
  $("#vArea").innerHTML=r?`<div class="frame ${asp} vid"><video id="rvid" src="${esc(blobUrl(r))}" playsinline preload="metadata"></video></div>`:`<div class="empty" style="text-align:center">No renders yet.<br>Export from the timeline, or Claude adds its previews here.</div>`;
  const v=$("#rvid");if(v){["timeupdate","play","pause","loadedmetadata","ended"].forEach(ev=>v.addEventListener(ev,updRTransport));v.addEventListener("click",()=>{v.paused?v.play().catch(()=>{}):v.pause()});
    v.addEventListener("error",()=>{$("#vArea").innerHTML=`<div class="empty">This render couldn’t load (${esc(r.ver||"")}). The file may have been removed.</div>`})}
  const rs=rendersOf(p);
  const vsel=rs.length?`<select class="vsel" id="verSel" aria-label="Render version">${rs.map(x=>`<option value="${esc(x.id)}" ${r&&x.id===r.id?"selected":""}>${esc(x.ver||"render")} · ${esc(WHO(x.by).toLowerCase())}</option>`).join("")}</select>`:"";
  $("#transport").innerHTML=`${modeSeg()}<button class="tbtn play" id="rPlay" aria-label="Play">▶</button><span class="tc-s" id="rNow">00:00:00:00</span><div class="grow"><input type="range" id="rScrub" min="0" max="1000" value="0" aria-label="Scrub render"></div><span class="tc-s" id="rDur" style="color:var(--muted)">--:--:--:--</span>${vsel}`;
  updRTransport();
}
function modeSeg(){return`<span class="seg"><button data-vmode="timeline" aria-pressed="${state.vmode==="timeline"}">Timeline</button><button data-vmode="renders" aria-pressed="${state.vmode==="renders"}">Renders${(cur()&&(cur().renders||[]).length)?" ("+cur().renders.length+")":""}</button></span>`}
function rFps(){const p=cur();const r=p&&curRender(p);return(r&&r.fps)||(p&&p.fps)||30}
function updRTransport(){const v=$("#rvid");if(!v)return;const d=v.duration||0;
  const n=$("#rNow"),du=$("#rDur"),sc=$("#rScrub"),pb=$("#rPlay");
  if(n)n.textContent=tcode(v.currentTime,rFps());if(du)du.textContent=d?tcode(d,rFps()):"--:--:--:--";
  if(sc&&document.activeElement!==sc)sc.value=d?Math.round(v.currentTime/d*1000):0;
  if(pb){pb.textContent=v.paused?"▶":"❚❚"}}

/* ---------- inspector ---------- */
function renderItabs(){const p=cur();const open=p?reqsFor(p.id).filter(r=>r.status!=="done").length:0;const hasSel=edHasSelection();
  if(state.itab==="clip"&&!hasSel)state.itab="info";
  const t=(k,l,n)=>`<button data-itab="${k}" aria-pressed="${state.itab===k}">${l}${n?`<span class="n">${n}</span>`:""}</button>`;
  $("#itabs").innerHTML=(hasSel?t("clip","Clip"):"")+t("info","Project")+t("claude","Claude",open)}
function renderInsp(){
  const p=cur(),box=$("#insp");
  if(!p){box.innerHTML=`<div class="empty">Nothing selected.</div>`;box.dataset.k="";return}
  if(state.itab==="clip"){edClipInspector(box);return}
  const key=p.id+"|"+state.itab+"|"+state.confirmDel;
  if(box.dataset.k===key&&box.contains(document.activeElement)&&typing(document.activeElement)){
    if(state.itab==="claude"){const l=box.querySelector("#reqList");if(l)l.innerHTML=reqItems(p)}return}
  box.dataset.k=key;
  const head=`<div class="ihead"><b>${esc(p.title)}</b><span>${esc([p.kind,p.length].filter(Boolean).join(" · "))}${p.updatedAt?" · edited "+esc(fmtDT(parseD(p.updatedAt))):""}</span></div>`;
  if(state.itab==="check"){const done=(p.checklist||[]).filter(c=>c.done).length;
    box.innerHTML=head+`<div class="grp"><span>Delivery checklist</span><span class="mono">${done}/${(p.checklist||[]).length}</span></div>
    <ul class="chk">${(p.checklist||[]).map((c,i)=>`<li class="${c.done?"on":""}"><input type="checkbox" id="chk-${i}" data-chk="${i}" ${c.done?"checked":""}><label for="chk-${i}">${esc(c.t)}</label></li>`).join("")}</ul>
    <form class="chk-add" id="chkForm"><input id="chkNew" placeholder="Add a check" aria-label="New checklist item"><button class="btn" type="submit">Add</button></form>`;return}
  if(state.itab==="claude"){
    const acts=actFor(p.id),sel=edSelectionSummary();
    box.innerHTML=head+`${acts.length?`<div class="grp"><span>Running now</span></div>${acts.map(taskHTML).join("")}`:""}
      ${reqsFor(p.id).length?`<div class="grp"><span>Earlier requests</span><span class="mono">${reqsFor(p.id).length}</span></div><ul class="reqs" id="reqList">${reqItems(p)}</ul>`:""}
      ${p.chats&&p.chats.length?`<div class="grp"><span>Chats on this project</span></div><div style="padding:4px 12px;display:flex;flex-direction:column;gap:4px">${p.chats.map(c=>`<a href="${esc(c.url)}" target="_blank" rel="noopener" style="color:#9fb8ff;font-size:12px">${esc(c.title||c.url)}</a>`).join("")}</div>`:""}`;
    return}
  const fmts=["16:9","9:16","1:1","4:5"];
  const r=(lab,id,inner)=>`<div class="prow"><label for="${id}">${lab}</label>${inner}</div>`;
  const pipe=STAGES.map(([k,l],i)=>`<option value="${k}" ${k===p.stage?"selected":""}>${pad(i+1)} ${l}</option>`).join("");
  const ck=(p.checklist||[]),ckd=ck.filter(c=>c.done).length;
  box.innerHTML=head+`<div class="grp"><span>Project</span></div>
    ${r("Name","f-title",`<input id="f-title" data-f="title" value="${esc(p.title)}">`)}
    <div class="grp"><span>Timeline</span></div>${edSettingsRows()}
    <details class="pdet"><summary>Project details <small>client, stage, schedule, checklist ${ckd}/${ck.length}</small></summary>
    ${r("Client","f-client",`<input id="f-client" data-f="client" value="${esc(p.client)}">`)}
    ${r("Type","f-kind",`<select id="f-kind" data-f="kind">${KINDS.map(k=>`<option ${k===p.kind?"selected":""}>${k}</option>`).join("")}</select>`)}
    ${r("Stage","f-stage",`<select id="f-stage" data-f="stage">${pipe}</select>`)}
    <div class="grp"><span>Delivery format</span></div>
    <div class="prow"><label>Aspect</label><div class="fmts">${fmts.map(f=>`<label><input type="checkbox" data-fmt="${f}" ${(p.formats||[]).includes(f)?"checked":""}>${f}</label>`).join("")}</div></div>
    ${r("Frame rate","f-fps",`<select id="f-fps" data-f="fps">${["23.976","24","25","30","50","60"].map(v=>`<option ${String(p.fps)===v?"selected":""}>${v}</option>`).join("")}</select>`)}
    ${r("Length","f-length",`<input id="f-length" data-f="length" value="${esc(p.length)}" placeholder="~18 s + end card">`)}
    <div class="grp"><span>Schedule</span></div>
    ${r("Start","f-start",`<input type="date" id="f-start" data-f="start" value="${esc(p.start||"")}">`)}
    ${r("Due","f-due",`<input type="date" id="f-due" data-f="due" value="${esc(p.due||"")}">`)}
    <div class="grp"><span>Files &amp; notes</span></div>
    ${r("Folder","f-folder",`<input id="f-folder" data-f="folder" class="mono" style="font-size:11.5px" value="${esc(p.folder)}" placeholder="Project folder or link">`)}
    ${r("Notes","f-notes",`<textarea id="f-notes" data-f="notes">${esc(p.notes)}</textarea>`)}
    <div class="grp"><span>Checklist</span><span class="mono">${ckd}/${ck.length}</span></div><ul class="chk">${ck.map((c,i)=>`<li class="${c.done?"on":""}"><input type="checkbox" id="chk-${i}" data-chk="${i}" ${c.done?"checked":""}><label for="chk-${i}">${esc(c.t)}</label></li>`).join("")}</ul></details>
    <div class="danger">${state.confirmDel?`<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span style="font-size:12px">Delete this project, its timeline and log?</span><button class="btn red" id="delYes">Delete</button><button class="btn" id="delNo">Keep</button></div>`:`<button class="btn red" id="delAsk">Delete Project</button>`}</div>`;
}
function reqItems(p){const rs=reqsFor(p.id);if(!rs.length)return`<li><span class="tx" style="color:var(--muted)">No requests yet.</span></li>`;
  return rs.map(r=>{const[l,c]=REQ_LBL[r.status]||REQ_LBL.open;return`<li><div class="top2"><span class="pill ${c}">${l}</span><span class="mono" style="font-size:10.5px;color:var(--dim)">${esc(ago(r.updatedAt||r.createdAt))}</span></div>
    <div class="tx">${esc(r.text)}</div>${r.context&&r.context.label?`<div style="font:500 10.5px/1.3 var(--mono);color:var(--dim)">↳ ${esc(r.context.label)}</div>`:""}${r.response?`<div class="resp">${esc(r.response)}</div>`:""}
    <div class="acts">${r.status==="open"?`<button class="btn sm red" data-delreq="${esc(r.id)}">Cancel</button>`:r.status==="done"?`<button class="btn sm" data-delreq="${esc(r.id)}">Clear</button>`:""}</div></li>`}).join("")}
function taskHTML(a){
  const stale=isStale(a),st=a.status==="waiting"?"Waiting on you":a.status==="done"?"Done":a.status==="error"?"Stopped":stale?"No update for "+ago(a.updatedAt).replace(" ago",""):"Working";
  const pc=a.progress!=null?Math.round(a.progress*100):null;
  return`<div class="task"><div class="h"><div><b>${esc(a.title||a.step||"Claude task")}</b><span>${esc(pTitle(a.projectId)||"Edit Bay")}${a.chat?" · "+esc(a.chat):""}</span></div><span class="pill ${a.status==="waiting"?"open":a.status==="done"?"done":a.status==="error"||stale?"need":"prog"}">${esc(st)}</span></div>
    ${a.status==="working"||a.status==="waiting"?`<div class="bar"><i class="${pc==null&&a.status==="working"?"ind":""}" style="width:${pc==null?35:pc}%;${a.status==="waiting"?"background:var(--warn)":""}"></i></div>`:""}
    ${(a.steps||[]).length?`<ul class="steps">${a.steps.map(s=>`<li class="${esc(s.s)}"><span class="m">${s.s==="done"?"✓":s.s==="active"?"●":"○"}</span>${esc(s.t)}</li>`).join("")}</ul>`:a.step?`<div style="font-size:12px">${esc(a.step)}</div>`:""}
    <div class="meta"><span>${pc!=null?pc+"%":""}</span><span>${a.chatUrl?`<a href="${esc(a.chatUrl)}" target="_blank" rel="noopener" style="color:#9fb8ff">open chat</a> · `:""}updated ${esc(ago(a.updatedAt))}</span></div></div>`}
function renderBg(){
  if(!state.bg){$("#bgwin").innerHTML="";return}
  const live=liveActs().sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const recent=state.activity.filter(a=>!(a.status==="working"||a.status==="waiting")).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,6);
  $("#bgwin").innerHTML=`<div class="bgw" role="dialog" aria-label="Background Tasks"><div class="wt"><span style="flex:1">Background Tasks</span><button class="xbtn" id="bgClose" aria-label="Close">${ic("close")}</button></div>
    <div class="body">${live.length?live.map(taskHTML).join(""):`<div class="empty">Claude isn’t working on anything right now. Ask from the Inspector’s Claude tab, or use Auto Cut.</div>`}
    ${recent.length?`<div class="grp" style="padding-top:10px"><span>Recent</span></div>${recent.map(taskHTML).join("")}`:""}</div>
    <div class="foot">Live: Claude Assist, Auto Cut and any connected Claude session report their steps here.</div></div>`}

/* ---------- index (log tab here; clips/markers in editor.js) ---------- */
function renderIndex(){
  const tabs=[["clips","Clips"],["markers","Markers"],["log","Log"]];
  $("#ixtabs").innerHTML=tabs.map(([k,l])=>`<button data-ixtab="${k}" aria-pressed="${state.ixtab===k}">${l}</button>`).join("");
  const body=$("#ixbody"),p=cur();
  if(!p){body.innerHTML="";body.dataset.k="";return}
  if(state.ixtab!=="log"){edIndex(body);return}
  if(body.dataset.k!=="log|"+p.id){body.dataset.k="log|"+p.id;
    body.innerHTML=`<form class="ix-add" id="logForm"><select id="logWho" aria-label="Who"><option value="claude">Claude</option><option value="joe" selected>You</option><option value="client">Client</option></select>
      <span class="mono" style="font-size:11px;color:var(--muted);align-self:center" id="logStage"></span>
      <div class="full"><input id="logText" placeholder="Log a step… e.g. Preview v1 exported" autocomplete="off" aria-label="Log entry"><input id="logVer" placeholder="v1" aria-label="Version"><button class="btn blue" type="submit">Append</button></div></form><ul class="ixl" id="ixl"></ul>`}
  const log=logOf(p).reverse();$("#logStage").textContent="→ "+sLabel(p.stage);
  $("#ixl").innerHTML=log.length?log.map(e=>{const t=parseD(e.at);const c=e.type==="stage"?STAGE_COL[e.stage]:e.render?"#a48cf0":WHO_COL[e.who];
    return`<li class="${state.hl===e.id?"hl":""}" data-hl="${esc(e.id)}" ${e.render?`data-play="${esc(e.render)}"`:""} id="ix-${esc(e.id)}"><span class="dot" style="background:${c}"></span>
    <span><span class="w">${esc(WHO(e.who))} · ${t?esc(fmtDT(t)):""}${e.ver?" · "+esc(e.ver):""}${e.render?" · ▶":""}</span><span class="tx">${esc(e.text)}</span></span>
    <button class="x" data-dellog="${esc(e.id)}" aria-label="Delete entry">✕</button></li>`}).join(""):`<li style="cursor:default"><span></span><span class="tx" style="color:var(--muted)">No entries yet.</span><span></span></li>`;
}

/* ---------- timeline area: edit (editor.js) or project history ---------- */
function renderTimelineArea(){
  if(state.ttab==="edit"){edTimeline();return}
  renderHistory();
}
let tlRange=null;
function hFit(days){const w=($("#tlscroll").clientWidth||800)-4;return Math.max(30,Math.min(400,w/days))}
function rulerHTML(lo,days,ppd){let h="";const step=ppd<45?7:ppd<70?2:1;
  for(let i=0;i<days;i++){const d=new Date(lo.getTime()+i*DAY),x=i*ppd;
    if(d.getDay()===6)h+=`<div class="wk" style="left:${x}px;width:${ppd*2}px"></div>`;
    h+=`<div class="tk" style="left:${x}px">${i%step===0?`<em>${d.toLocaleDateString("en-IE",{weekday:"short"}).slice(0,3)} ${d.getDate()} ${d.toLocaleDateString("en-IE",{month:"short"})}</em>`:""}</div>`;
    if(ppd>=140)for(let q=1;q<4;q++)h+=`<div class="tk h" style="left:${x+q*ppd/4}px"></div>`;}
  return h}
function ttabsHTML(){return state.ttab==="history"?`<span class="ttabs"><button data-ttab="edit" aria-pressed="false">← Back to timeline</button><button aria-pressed="true">Project history</button></span>`:""}
function renderHistory(){
  const sc=$("#tlscroll"),c=$("#tlc"),now=new Date();c.className="tlc";
  const p=cur();if(!p){$("#tlhead").innerHTML=ttabsHTML();c.innerHTML="";c.style.width="";return}
  const log=logOf(p),acts=actFor(p.id);
  const pts=[now];[p.start,p.due].forEach(s=>{const d=parseD(s);if(d)pts.push(d)});log.forEach(e=>{const t=parseD(e.at);if(t)pts.push(t)});acts.forEach(a=>{const t=parseD(a.startedAt);if(t)pts.push(t)});
  const lo=new Date(dayStart(new Date(Math.min(...pts))).getTime()-DAY);let days=Math.round((dayStart(new Date(Math.max(...pts)))-lo)/DAY)+3;days=Math.max(days,8);
  const ppd=state.hppd||hFit(days);
  const W=Math.max(days*ppd,sc.clientWidth-2),X=t=>(t-lo)/DAY*ppd;tlRange={lo,ppd};
  const stg=log.filter(e=>e.type==="stage");let story="";
  stg.forEach((e,i)=>{const t0=parseD(e.at);let t1=i+1<stg.length?parseD(stg[i+1].at):now;const last=i===stg.length-1;
    if(e.stage==="delivered"&&last)t1=new Date(t0.getTime()+DAY*.5);
    const x=X(t0),w=Math.max(last?72:8,X(t1)-x-2);
    story+=`<button class="clip sto${last?" cur":""}${e.stage==="delivered"?" del":""}" data-hl="${esc(e.id)}" style="left:${x}px;width:${w}px" title="${esc(sLabel(e.stage))} · from ${esc(fmtDT(t0))}"><span class="fs" style="background-color:${STAGE_COL[e.stage]}55"></span><span class="nm">${esc(sLabel(e.stage))}</span></button>`});
  const lane=(who,label)=>{const items=log.filter(e=>e.who===who&&e.type!=="stage");const rows=[];let h="";
    const place=(x,w)=>{let r=0;while(rows[r]!=null&&x<rows[r]+3)r++;rows[r]=x+w;return r};
    if(who==="claude")acts.forEach(a=>{const t0=parseD(a.startedAt)||now;const x=X(t0),w=Math.max(90,X(now)-x);const r=place(x,w);const stale=isStale(a);
      h+=`<button class="clip cn ${a.status==="working"&&!stale?"working":"claude"}" data-bg="1" data-row="${r}" style="left:${x}px;width:${w}px" title="${esc((a.status==="waiting"?"Waiting on you: ":"Claude working: ")+(a.step||a.title||""))}"><span>${a.status==="waiting"?"⏸ ":"⟳ "}${esc(a.step||a.title||"")}${a.progress!=null?" · "+Math.round(a.progress*100)+"%":""}</span></button>`});
    items.forEach(e=>{const t=parseD(e.at);if(!t)return;const x=X(t),w=Math.max(70,Math.min(260,ppd*.9));const r=place(x,w);
      h+=`<button class="clip cn ${who}${e.render?" render":""}${state.hl===e.id?" hl":""}" data-hl="${esc(e.id)}" ${e.render?`data-play="${esc(e.render)}"`:""} data-row="${r}" style="left:${x}px;width:${w}px" title="${esc(fmtDT(t)+(e.ver?" · "+e.ver:"")+" · "+e.text)}"><span>${e.render?"▶ ":""}${e.ver?esc(e.ver)+" · ":""}${esc(e.text)}</span></button>`});
    return{h,n:Math.max(1,rows.length),label}};
  const L=[lane("claude","CLAUDE"),lane("joe","YOU")],C=lane("client","CLIENT");
  const laneDiv=(o,above)=>{const H=o.n*24+12;const h=o.h.replace(/data-row="(\d+)" style="/g,(m,r)=>`style="top:${above?H-26-r*24:6+r*24}px;`);
    return`<div class="lane" style="height:${H}px"><span class="lanetag">${o.label}</span>${h}</div>`};
  const due=parseD(p.due),dueX=due?X(new Date(due.getTime()+DAY)):null;
  c.style.width=W+"px";
  c.innerHTML=`<div class="ruler">${rulerHTML(lo,days,ppd)}${dueX!=null?`<div class="mkr" style="left:${dueX}px"><i></i><em>DUE</em></div>`:""}</div>
    ${Array.from({length:days},(_,i)=>`<div class="dayg" style="left:${i*ppd}px"></div>`).join("")}
    ${laneDiv(L[0],true)}${laneDiv(L[1],true)}<div class="lane story"><span class="lanetag" style="color:#ffffff66">STAGES</span>${story}</div>${laneDiv(C,false)}
    ${dueX!=null?`<div class="duel" style="left:${dueX}px"></div>`:""}
    <div class="playhead" style="left:${X(now)}px"><em>${esc(fmtD(now))} ${pad(now.getHours())}:${pad(now.getMinutes())}</em></div><div class="skim" id="skim"><em></em></div>`;
  const span=stg.length?((now-parseD(stg[0].at))/DAY):0;
  $("#tlhead").innerHTML=`<span style="display:flex;gap:10px;align-items:center">${ttabsHTML()}<span><b>${esc(p.title)}</b> · ${span?span.toFixed(1)+" days in edit":"not started"}</span></span>
    <span class="legend"><span><i style="background:var(--story)"></i>Stages</span><span><i style="background:var(--claude)"></i>Claude</span><span><i style="background:var(--joe)"></i>You</span><span><i style="background:var(--client)"></i>Client</span><span><i style="background:var(--todo)"></i>Due</span></span>`;
}

function renderModal(){
  if(!state.modal){$("#modal").innerHTML="";$("#modal").dataset.k="";return}
  if(state.modal==="new"){if($("#modal").dataset.k==="new")return;$("#modal").dataset.k="new";
  $("#modal").innerHTML=`<div class="ov" id="ov"><form class="dlg np" id="newForm" aria-label="New project"><h3>New project</h3>
    <div class="f"><label for="n-title">Name</label><input id="n-title" required placeholder="e.g. Summer launch teaser" autocomplete="off"></div>
    <div class="f"><label>Shape</label><div class="shapes" role="radiogroup" aria-label="Video shape">${[["1080x1920","Vertical","TikTok · Reels · Shorts",9,16],["1920x1080","Widescreen","YouTube · web",16,9],["1080x1080","Square","Feed posts",1,1],["1080x1350","Portrait","Instagram feed",4,5]].map(([v,n,d,w,h],i)=>`<label class="shape"><input type="radio" name="n-shape" value="${v}" ${i===0?"checked":""}><span class="sh" style="aspect-ratio:${w}/${h}"></span><b>${n}</b><small>${d}</small></label>`).join("")}</div></div>
    <details class="more"><summary>More options</summary><div class="two"><div class="f"><label for="n-fps">Frame rate</label><select id="n-fps"><option>24</option><option>25</option><option selected>30</option><option>60</option></select></div><div class="f"><label for="n-kind">Type</label><select id="n-kind">${KINDS.map(k=>`<option>${k}</option>`).join("")}</select></div></div>
      <div class="two"><div class="f"><label for="n-client">Client or brand</label><input id="n-client"></div><div class="f"><label for="n-due">Due</label><input type="date" id="n-due"></div></div><input type="hidden" id="n-start" value="${ymd(new Date())}"><select id="n-fmt" hidden><option value="1080x1920">v</option><option value="1920x1080">h</option><option value="1080x1080">s</option><option value="1080x1350">p</option></select></details>
    <div class="acts"><button type="button" class="btn" id="nCancel">Cancel</button><button class="btn blue" type="submit">Create project</button></div></form></div>`;
  setTimeout(()=>{const t=$("#n-title");if(t)t.focus()},0);return}
  if(state.modal==="keys")return;
  edModal();
}

/* ---------- actions ---------- */
function setStage(p,k,who){if(p.stage===k)return;mutate(p.id,q=>{q.stage=k;(q.log=q.log||[]).push({id:uid("e"),at:nowISO(),who:who||"joe",type:"stage",stage:k,text:"Moved to "+sLabel(k)})})}
function playRender(id){const p=cur();if(!p)return;state.ver=id;state.vmode="renders";rKey="";render();const v=$("#rvid");if(v){v.play().catch(()=>{})}}
async function sendReq(text,context){const p=cur();if(!p||!text)return;
  const r={projectId:p.id,text,status:"open",by:"joe",createdAt:nowISO(),updatedAt:nowISO()};if(context)r.context=context;const id=uid("r");
  state.requests.push(Object.assign({id},r));render();
  if(db){try{await db.collection("requests").doc(id).set(r)}catch(e){saveErr(e)}}}
async function delReq(id){state.requests=state.requests.filter(r=>r.id!==id);render();if(db){try{await db.doc("requests/"+id).delete()}catch(e){saveErr(e)}}}

/* ---------- shell events ---------- */
document.addEventListener("click",e=>{
  const t=e.target.closest("button,[data-hl],[data-open],[data-play],[data-sel],[data-cl],[data-mkseek]");if(!t)return;const p=cur();
  if(t.closest("#tlc")&&state.ttab==="edit"&&!t.dataset.bg)return; // edit timeline handles its own clicks
  if(t.id==="noteX"){state.note="";renderNote()}
  else if(t.id==="newBtn"){state.modal="new";render()}
  else if(t.id==="nCancel"){state.modal=null;render()}
  else if(t.id==="ixBtn"){state.ix=!state.ix;render()}
  else if(t.id==="bgBtn"||t.id==="liveBtn"||t.dataset.bg){state.bg=!state.bg||!!t.dataset.bg;renderBg();renderLive()}
  else if(t.id==="bgClose"){state.bg=false;renderBg();renderLive()}
  else if(t.id==="rPlay"){const v=$("#rvid");if(v)v.paused?v.play().catch(()=>{}):v.pause()}
  else if(t.dataset.btab){state.btab=t.dataset.btab;render()}
  else if(t.dataset.ttab){state.ttab=t.dataset.ttab;render()}
  else if(t.dataset.ixtab){state.ixtab=t.dataset.ixtab;render()}
  else if(t.dataset.vmode){state.vmode=t.dataset.vmode;render()}
  else if(t.dataset.itab){state.itab=t.dataset.itab;render()}
  else if(t.dataset.filter){state.filter=t.dataset.filter;render()}
  else if(t.dataset.sel){edSwitchProject(t.dataset.sel)}
  else if(t.dataset.open){edSwitchProject(t.dataset.open)}
  else if(t.dataset.copyreq){const r=state.requests.find(x=>x.id===t.dataset.copyreq);if(!r)return;
    const msg=`Edit Bay request ${r.id} for "${pTitle(r.projectId)}": ${r.text}${r.context&&r.context.label?"\nSelection: "+r.context.label:""}\n\nPick it up from Edit Bay (claude/edit-bay-tracker.md): edit the shared timeline, report progress there as you work, and mark the request done when finished.`;
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(msg).then(()=>toast("COPIED","Paste it into a new chat in this Project."),()=>{state.note="Couldn’t copy. Request id: "+r.id;renderNote()});
    else{state.note="Couldn’t copy. Request id: "+r.id;renderNote()}}
  else if(t.dataset.delreq){delReq(t.dataset.delreq)}
  else if(t.dataset.dellog){if(!p)return;const id=t.dataset.dellog;e.stopPropagation();
    mutate(p.id,q=>{const ev=(q.log||[]).find(x=>x.id===id);q.log=(q.log||[]).filter(x=>x.id!==id);if(ev&&ev.type==="stage"){const last=q.log.filter(x=>x.type==="stage").pop();q.stage=last?last.stage:"brief"}})}
  else if(t.dataset.play){if(t.dataset.hl)state.hl=t.dataset.hl;playRender(t.dataset.play)}
  else if(t.dataset.hl){state.hl=t.dataset.hl;render();const li=document.getElementById("ix-"+t.dataset.hl);if(li)li.scrollIntoView({block:"nearest"})}
  else if(t.id==="delAsk"){state.confirmDel=true;render()}
  else if(t.id==="delNo"){state.confirmDel=false;render()}
  else if(t.id==="delYes"){if(!p)return;state.projects=state.projects.filter(x=>x.id!==p.id);state.confirmDel=false;
    if(db){db.doc("projects/"+p.id).delete().catch(()=>{});db.doc("timelines/"+p.id).delete().catch(()=>{})}
    edSwitchProject((sorted()[0]||{}).id||null)}
  else edClick(t,e);
});
document.addEventListener("submit",e=>{e.preventDefault();const f=e.target;const p=cur();
  if(f.id==="logForm"){const txt=$("#logText").value.trim();if(!p||!txt)return;const who=$("#logWho").value,ver=$("#logVer").value.trim();$("#logText").value="";$("#logVer").value="";
    mutate(p.id,q=>{(q.log=q.log||[]).push({id:uid("e"),at:nowISO(),who,type:"note",stage:q.stage,text:txt,ver:ver||undefined})})}
  else if(f.id==="reqForm"){const t=$("#reqText").value.trim();if(!t)return;const useCtx=$("#reqCtx")&&$("#reqCtx").checked;$("#reqText").value="";sendReq(t,useCtx?edSelectionContext():null);toast("SENT TO CLAUDE","Open a chat in this Project and Claude will pick it up.")}
  else if(f.id==="chkForm"){const v=$("#chkNew").value.trim();if(!p||!v)return;$("#chkNew").value="";$("#insp").dataset.k="";mutate(p.id,q=>{(q.checklist=q.checklist||[]).push({t:v,done:false})})}
  else if(f.id==="newForm"){const title=$("#n-title").value.trim();if(!title)return;const sh=document.querySelector('input[name="n-shape"]:checked');if(sh)$("#n-fmt").value=sh.value;const kind=$("#n-kind").value,spec=kind==="Commercial";
    const[w,h]=$("#n-fmt").value.split("x").map(Number),fps=$("#n-fps").value;
    const fm=w>h?"16:9":w===h?"1:1":h/w>1.5?"9:16":"4:5";
    const np={id:uid("p"),title,client:$("#n-client").value.trim(),kind,stage:"brief",formats:spec?["16:9","9:16"]:[fm],fps,length:"",start:$("#n-start").value||ymd(new Date()),due:$("#n-due").value||"",folder:"",notes:"",
      checklist:(spec?CHECK_SPEC:CHECK_GEN).map(t=>({t,done:false})),renders:[],log:[{id:uid("e"),at:nowISO(),who:"joe",type:"stage",stage:"brief",text:"Project created"}],createdAt:nowISO(),updatedAt:nowISO()};
    state.projects.push(np);state.modal=null;if(!inFilter(np))state.filter="all";persist(np);
    edCreateTimeline(np.id,{w,h,fps:+fps});edSwitchProject(np.id);state.btab="media";render()}
  else edSubmit(f,e);
});
document.addEventListener("input",e=>{const el=e.target;
  if(el.id==="rScrub"){const v=$("#rvid");if(v&&v.duration){v.currentTime=el.value/1000*v.duration;updRTransport()}return}
  if(edInput(el))return;
  const p=cur();if(!p)return;
  if(el.dataset.f&&el.tagName!=="SELECT"&&el.type!=="date"){const k=el.dataset.f,v=el.value;mutate(p.id,q=>{q[k]=v},{render:false,debounce:700});
    clearTimeout(timers.__r);timers.__r=setTimeout(()=>{delete timers.__r;renderBrowser();$("#winName").textContent="Edit Bay — "+(cur()||{}).title},300)}});
document.addEventListener("change",e=>{const el=e.target;
  if(el.id==="verSel"){playRender(el.value);return}
  if(edChange(el))return;
  const p=cur();if(!p)return;
  if(el.dataset.f==="stage"){setStage(p,el.value)}
  else if(el.dataset.f&&(el.tagName==="SELECT"||el.type==="date")){const k=el.dataset.f,v=el.value;mutate(p.id,q=>{q[k]=v})}
  else if(el.dataset.fmt){const f=el.dataset.fmt,on=el.checked;mutate(p.id,q=>{q.formats=(q.formats||[]).filter(x=>x!==f);if(on)q.formats.push(f)})}
  else if(el.dataset.chk!=null){const i=+el.dataset.chk,on=el.checked;$("#insp").dataset.k="";mutate(p.id,q=>{if(q.checklist&&q.checklist[i])q.checklist[i].done=on})}
});
document.addEventListener("mousedown",e=>{if(e.target.id==="ov"&&!edBusy()){state.modal=null;render()}});
// history skimmer
$("#tlscroll").addEventListener("mousemove",e=>{if(state.ttab!=="history")return;const s=$("#skim");if(!s||!tlRange)return;const r=$("#tlc").getBoundingClientRect(),x=e.clientX-r.left;if(x<0)return;
  const t=new Date(tlRange.lo.getTime()+x/tlRange.ppd*DAY);s.style.display="block";s.style.left=x+"px";s.firstChild.textContent=fmtDT(t)});
setInterval(()=>{renderLive();renderBg();if(state.ttab==="history"&&!typing(document.activeElement))renderHistory()},60000);

/* ---------- live data + notifications ---------- */
function ensureSel(){if(!state.projects.find(p=>p.id===state.sel)){const s=sorted();edSwitchProject(s.length?s[0].id:null,true)}}
let firstAct=true,firstReq=true,firstProj=true;
function diffActivity(next){if(firstAct){firstAct=false;return}
  const prev=new Map(state.activity.map(a=>[a.id,a]));
  next.forEach(a=>{if(/in Edit Bay/.test(a.chat||""))return;const o=prev.get(a.id);const where=pTitle(a.projectId);
    if(!o){if(a.status==="working")toast("CLAUDE STARTED",(a.title||a.step||"A task")+(where?" · "+where:""));return}
    if(o.status!==a.status){if(a.status==="done")toast("CLAUDE FINISHED",(a.title||"Task")+(where?" · "+where:""));else if(a.status==="waiting")toast("CLAUDE NEEDS YOU",a.step||a.title||"");else if(a.status==="error")toast("CLAUDE STOPPED",a.step||a.title||"")}
    else if(o.step!==a.step&&a.status==="working"&&a.step)toast("CLAUDE",a.step)})}
function diffRequests(next){if(firstReq){firstReq=false;return}
  const prev=new Map(state.requests.map(r=>[r.id,r]));
  next.forEach(r=>{const o=prev.get(r.id);if(o&&o.status!==r.status){if(r.status==="picked")toast("CLAUDE PICKED UP",r.text);else if(r.status==="done")toast("REQUEST DONE",r.response||r.text);else if(r.status==="needs")toast("CLAUDE NEEDS YOU",r.response||r.text)}})}
function diffProjects(next){if(firstProj){firstProj=false;return}
  next.forEach(p=>{const o=state.projects.find(x=>x.id===p.id);if(!o)return;const before=new Set((o.renders||[]).map(r=>r.id));
    (p.renders||[]).forEach(r=>{if(!before.has(r.id)&&r.by!=="joe")toast("NEW RENDER",(r.ver||"render")+" · "+p.title)})})}
async function boot(){
  render();await LBLOB.init();
  const c=window.claude,hasC=!!(c&&typeof c.use==="function");
  if(hasC){try{db=await c.use("db")}catch(e){db=null}try{assets=await c.use("assets")}catch(e){assets=null}try{downloads=await c.use("downloads")}catch(e){downloads=null}}
  else downloads=LDOWN;
  if(db&&typeof scopeDb==="function"){try{db=await scopeDb(db)}catch(e){db=null}}
  state.cloud=!!db;if(!db){if(IDB_OK){db=LDB;state.mode="loading"}else{state.mode="local";render();return}}
  const timer=setTimeout(()=>{if(state.mode==="loading"){state.note="Can’t reach your saved projects yet. They’ll appear when the connection answers.";render()}},10000);
  db.collection("projects").onSnapshot(snap=>{
    if(!snap.metadata.fromCache){clearTimeout(timer);if(state.mode!=="live")state.note=""}
    state.mode="live";
    const incoming=snap.docs.map(d=>Object.assign({id:d.id},clone(d.data())));
    const merged=incoming.map(p=>{const loc=state.projects.find(x=>x.id===p.id);return loc&&timers[p.id]&&(loc.updatedAt||"")>=(p.updatedAt||"")?loc:p});
    // keep locally created projects whose first write hasn't echoed yet
    state.projects.forEach(p=>{if(!merged.find(x=>x.id===p.id)&&queues[p.id])merged.push(p)});
    diffProjects(merged);state.projects=merged;ensureSel();render();
  },err=>{clearTimeout(timer);state.mode="local";state.note="Your saved projects couldn’t load ("+(err&&err.code||"error")+"). Changes made now won’t be kept.";render()});
  if(!state.cloud)setTimeout(()=>{if(state.mode==="loading"){state.mode="live";render()}},1500);
  db.collection("activity").orderBy("updatedAt","desc").limit(40).onSnapshot(snap=>{
    const next=snap.docs.map(d=>Object.assign({id:d.id},clone(d.data())));diffActivity(next);state.activity=next;renderLive();renderBg();if(state.itab==="claude")renderInsp();if(state.btab==="projects")renderCards();if(state.ttab==="history")renderHistory();
  },()=>{});
  db.collection("requests").orderBy("createdAt","desc").limit(300).onSnapshot(snap=>{
    const next=snap.docs.map(d=>Object.assign({id:d.id},clone(d.data())));diffRequests(next);state.requests=next;renderItabs();if(state.itab==="claude")renderInsp();
  },()=>{});
  db.collection("media").onSnapshot(snap=>{edOnMedia(snap.docs.map(d=>Object.assign({id:d.id},clone(d.data()))))},()=>{});
  db.collection("timelines").onSnapshot(snap=>{edOnTimelines(snap.docs.map(d=>Object.assign({id:d.id},clone(d.data()))))},()=>{});
}
window.addEventListener("DOMContentLoaded",boot);
