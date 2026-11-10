/* Edit Bay — beta readiness: private per-person storage, feedback + crash reports, an owner inbox, first-run tour, browser checks. */
const BETA="Beta 2";let RAWDB=null,ME=null,ISOWNER=false;
/* Each tester gets a private space (data/users/<id>/ws/...) nobody else can read; the owner keeps the shared root.
   People who can't write the artifact's data (view-only links, signed out) work on their own device. */
async function scopeDb(raw){RAWDB=raw;let u=null;try{u=await window.claude.use("user")}catch(e){}
  try{ISOWNER=u?await u.isOwner():false}catch(e){}let id=null;try{id=u?await u.id():null}catch(e){}ME=id;if(ISOWNER)return raw;const can=u&&u.can?await u.can("data.write").catch(()=>null):null;
  if(!id||can===false){state.deviceOnly=true;return null}const base=`data/users/${id}/ws`;
  return{scoped:true,collection:p=>raw.collection(base+"/"+p),doc:p=>raw.doc(base+"/"+p)}}

/* ---------- feedback + crash reports ---------- */
const FB_LOCAL="editbay.feedback";
function diag(){const tl=E.tl;return{version:BETA,ua:navigator.userAgent.slice(0,160),screen:`${innerWidth}×${innerHeight}@${devicePixelRatio}`,fast:typeof FAST_OK!=="undefined"&&FAST_OK,gl:typeof glOK==="function"&&glOK(),
  storage:state.cloud?"account":"device",page:E.page,clips:tl?tl.clips.length:0,dur:tl?+tlDur().toFixed(1):0,format:tl?`${tl.w}x${tl.h}@${tl.fps}`:""}}
async function sendFeedback(doc){const d=Object.assign({at:new Date().toISOString(),by:ME||"",owner:ISOWNER},doc);
  /* each person appends to their own feedback/<id> entry; only the owner and editors can read them all */
  if(RAWDB&&ME){try{const ref=RAWDB.doc("feedback/"+ME);const cur0=await ref.get();const prev=(cur0.exists&&cur0.data())||{};const items=(prev.items||[]).concat([d]).slice(-100);await ref.set(Object.assign({},prev,{items,updatedAt:d.at}));return"sent"}catch(e){}}
  try{const a=JSON.parse(localStorage.getItem(FB_LOCAL)||"[]");a.push(d);localStorage.setItem(FB_LOCAL,JSON.stringify(a.slice(-50)))}catch(e){}return"local"}
let errCount=0,lastErr="";
function reportError(msg,stack){msg=String(msg||"Unknown error").slice(0,300);if(msg===lastErr||errCount>8)return;lastErr=msg;errCount++;
  if(/ResizeObserver|Script error\.?$/i.test(msg))return;toast("SOMETHING WENT WRONG","Edit Bay hit a problem and sent a report. Your work is saved; if something looks off, undo (⌘Z) or reload.");
  sendFeedback({type:"error",message:msg,stack:String(stack||"").slice(0,1200),diag:diag()})}
window.addEventListener("error",e=>reportError(e.message,e.error&&e.error.stack));
window.addEventListener("unhandledrejection",e=>{const r=e.reason;if(r&&(r.code==="declined"||r.code==="not_granted"||r.name==="AbortError"))return;reportError(r&&r.message||String(r),r&&r.stack)});
function fbModal(){const box=$("#modal");if(box.dataset.k==="fb")return;box.dataset.k="fb";
  box.innerHTML=`<div class="ov" id="ov"><form class="dlg au" id="fbForm" aria-label="Send feedback"><h3>Send feedback</h3><div style="font-size:12px;color:var(--muted);margin-top:-4px">Thanks for testing Edit Bay. Tell us what worked, what didn’t, and what you expected.</div>
    <div class="f"><label>How was it?</label><div class="rate" role="radiogroup" aria-label="Rating">${[1,2,3,4,5].map(n=>`<label><input type="radio" name="fbr" value="${n}"><span>${["Broken","Rough","OK","Good","Great"][n-1]}</span></label>`).join("")}</div></div>
    <div class="f"><label for="fbKind">About</label><select id="fbKind"><option>Something broke</option><option>Confusing</option><option>Idea</option><option>Claude’s edits</option><option>Exports</option><option>Other</option></select></div>
    <div class="f"><label for="fbText">What happened?</label><textarea id="fbText" rows="5" required placeholder="What were you trying to do, and what did you see?"></textarea></div>
    <label style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--muted)"><input type="checkbox" id="fbDiag" checked style="width:auto"> Include technical details (browser, screen, timeline length; never your media)</label>
    <div class="acts"><button type="button" class="btn" data-sx="1">Cancel</button><button type="submit" class="btn blue">Send</button></div></form></div>`;setTimeout(()=>{const t=$("#fbText");t&&t.focus()},0)}
async function inboxModal(){const box=$("#modal");box.dataset.k="inbox";box.innerHTML=`<div class="ov" id="ov"><div class="dlg au" role="dialog" aria-label="Feedback inbox"><h3>Feedback inbox</h3><div id="inboxBody" style="font-size:12px;color:var(--muted)">Loading…</div><div class="acts"><button type="button" class="btn" data-sx="1">Close</button></div></div></div>`;
  let items=[],usage={},people=0;try{const s=await RAWDB.collection("feedback").get();s.docs.forEach(d=>{const u=(d.data()||{}).usage;if(u&&u.c){people++;Object.entries(u.c).forEach(([k,v])=>usage[k]=(usage[k]||0)+v)}});s.docs.forEach(d=>((d.data()||{}).items||[]).forEach(x=>items.push(Object.assign({who:d.id},x))));items.sort((a,b)=>String(b.at).localeCompare(String(a.at)))}catch(e){}
  const b=$("#inboxBody");if(!b)return;if(!items.length){b.textContent="No feedback yet.";return}
  const err=items.filter(x=>x.type==="error").length;b.innerHTML=`<div style="margin-bottom:8px">${items.length} reports · ${err} crash report${err===1?"":"s"}</div>${people?`<details style="margin-bottom:8px"><summary>Usage counts from ${people} tester${people>1?"s":""}</summary><div class="mono" style="font-size:11px;line-height:1.6">${esc(Object.entries(usage).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+" "+v).join(" · "))}</div></details>`:""}<ul class="vlist">${items.map(x=>`<li style="align-items:flex-start"><span><b>${x.type==="error"?"Crash: ":""}${esc(x.kind||"")}${x.rating?" · "+["Broken","Rough","OK","Good","Great"][x.rating-1]:""}</b><small>${esc(new Date(x.at).toLocaleString())}${x.diag?" · "+esc(x.diag.ua.split(" ").slice(-2).join(" "))+" · "+esc(x.diag.storage):""}</small><div style="font-size:12px;color:var(--text);margin-top:3px;white-space:pre-wrap">${esc(x.text||x.message||"")}</div></span></li>`).join("")}</ul>`}
const _rm5=renderModal;renderModal=function(){if(state.modal==="fb"){fbModal();return}if(state.modal==="inbox"){if($("#modal").dataset.k!=="inbox")inboxModal();return}if(["fb","inbox"].includes($("#modal").dataset.k))$("#modal").dataset.k="";_rm5()};
document.addEventListener("submit",async e=>{if(e.target.id!=="fbForm")return;e.preventDefault();e.stopImmediatePropagation();const r=document.querySelector('input[name="fbr"]:checked');const text=$("#fbText").value.trim();if(!text){$("#fbText").focus();return}
  const res=await sendFeedback({type:"feedback",rating:r?+r.value:null,kind:$("#fbKind").value,text,diag:$("#fbDiag").checked?diag():null});state.modal=null;$("#modal").dataset.k="";render();
  toast("THANK YOU",res==="sent"?"Your feedback was sent.":HOSTED&&CFG.feedbackUrl?"Finish sending it in the GitHub tab that just opened. A copy is also saved on this device.":"Saved on this device. Your access doesn’t allow sending from here, so copy it from Help › Feedback saved on this device.")},true);

/* ---------- first-run tour ---------- */
const TOUR=[["#bbody","Bring in your footage","Drop video, audio and photos here, any size. Double-click a clip to open it in the Source viewer and mark In and Out."],
  ["#vArea","Watch your cut","The Viewer plays the timeline. Space plays, J/K/L shuttles, and the tabs switch between Source, Timeline and Renders."],
  ["#tlscroll","Edit on the timeline","Drag to move, drag edges to trim, B for the blade. Everything can be undone with ⌘Z."],
  ["#createBtn","Let Claude help","Create builds a first cut from a prompt using your clips. Then ask Claude for changes in the Inspector’s Claude tab."],
  ["#fbBtn","Tell us what you think","You’re testing an early version. Send feedback any time, and crashes are reported automatically."]];
let tourI=-1;function tour(i){tourI=i;const ov=$("#tour")||document.body.appendChild(Object.assign(document.createElement("div"),{id:"tour"}));if(i<0||i>=TOUR.length){ov.remove();try{localStorage.setItem("editbay.toured","1")}catch(e){}return}
  const[sel,h,p]=TOUR[i],el=$(sel);const r=el?el.getBoundingClientRect():{left:innerWidth/2-100,top:innerHeight/2-50,width:200,height:100,right:innerWidth/2+100,bottom:innerHeight/2+50};
  const below=r.bottom+180<innerHeight,left=clamp(r.left,12,innerWidth-332);
  ov.innerHTML=`<div class="tspot" style="left:${r.left-4}px;top:${r.top-4}px;width:${r.width+8}px;height:${r.height+8}px"></div><div class="tcard" role="dialog" aria-label="Tour" style="left:${left}px;top:${below?r.bottom+12:Math.max(12,r.top-172)}px"><small>${i+1} of ${TOUR.length}</small><b>${h}</b><p>${p}</p><div class="tacts"><button class="btn" data-tour="x">Skip</button><button class="btn blue" data-tour="n">${i===TOUR.length-1?"Done":"Next"}</button></div></div>`}
document.addEventListener("click",e=>{const b=e.target.closest("[data-tour]");if(b){tour(b.dataset.tour==="n"?tourI+1:-1);return}
  const t=e.target.closest("button");if(!t)return;if(t.id==="fbBtn"||t.dataset.fb){pause();state.modal="fb";$("#modal").dataset.k="";render()}else if(t.dataset.inbox){state.modal="inbox";$("#modal").dataset.k="";render()}else if(t.dataset.tourstart)tour(0)
  else if(t.dataset.fblocal){let a=[];try{a=JSON.parse(localStorage.getItem(FB_LOCAL)||"[]")}catch(x){}const txt=a.map(x=>`[${x.at}] ${x.type}${x.kind?" · "+x.kind:""}${x.rating?" · "+x.rating+"/5":""}\n${x.text||x.message||""}`).join("\n\n");
    if(!txt){toast("FEEDBACK","Nothing saved on this device.");return}navigator.clipboard&&navigator.clipboard.writeText(txt).then(()=>toast("COPIED",a.length+" items copied. Paste them into an email or message to the Edit Bay team."),()=>toast("FEEDBACK","Couldn’t copy. Try again."))}});
document.addEventListener("keydown",e=>{if(tourI>=0&&$("#tour")&&e.key==="Escape")tour(-1)});

/* ---------- notices: browser support, small screens ---------- */
function notices(){const n=[];if(typeof FAST_OK!=="undefined"&&!FAST_OK)n.push("This browser can’t do fast exports. Use Chrome or Edge for frame-accurate MP4 export.");if(!IDB_OK)n.push("This browser is blocking storage, so work won’t be kept. Turn off private browsing or allow site data.");
  if(innerWidth<700)n.push("Edit Bay works best on a tablet, laptop or desktop. On a phone you can review, but editing is cramped.");if(state.deviceOnly)n.push("Your work is saved privately on this device. Use File › Save Project File to back it up.");return n}
window.addEventListener("DOMContentLoaded",()=>{setTimeout(()=>{const n=notices();if(n.length){state.note=n.join(" ");renderNote();setTimeout(()=>{if(state.note===n.join(" ")){state.note="";renderNote()}},12000)}
  let seen=false;try{seen=localStorage.getItem("editbay.toured")==="1"}catch(e){}if(!seen&&innerWidth>=900)setTimeout(()=>{if(!state.modal)tour(0)},600)},2400)});
