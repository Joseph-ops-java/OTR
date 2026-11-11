/* Edit Bay — Claude as a conversation (after InVideo AI's command box): a per-project thread, follow-ups with context,
   a saved version before every AI edit with Undo / Try again on each reply, context-aware quick commands, and a Scenes view. */
E.chat={};E.chatLoaded={};
const turnsOf=pid=>E.chat[pid]=E.chat[pid]||[];
async function loadChat(pid){if(E.chatLoaded[pid]||!db)return;E.chatLoaded[pid]=true;try{const d=await db.doc("chats/"+pid).get();if(d.exists){const t=(d.data()||{}).turns;/* copy it: the database hands back read-only data, and the chat appends to this list */if(Array.isArray(t))E.chat[pid]=JSON.parse(JSON.stringify(t))}}catch(e){}refreshAssist()}
function saveChat(pid){if(!db)return;const t=turnsOf(pid).slice(-40);db.doc("chats/"+pid).set({turns:t}).catch(()=>{})}
async function aiCheckpoint(name){if(!E.tl||!db)return null;const id=uid("v");try{await db.collection("versions").doc(id).set({projectId:E.pid,name:String(name).slice(0,80),at:nowSec(),by:"claude",auto:true,dur:+tlDur().toFixed(2),clips:E.tl.clips.length,tl:clone(E.tl)});return id}catch(e){return null}}
function quickCmds(){const empty=!E.tl||!E.tl.clips.length;return empty?[["Create a video from my clips","create"],["Cut my clips to the music",""],["Make a 15 s teaser",""]]:
  [["Make it 15 seconds",""],["Stronger hook in the first 2 s",""],["Punchier captions",""],["More cinematic",""],["Faster pacing",""],["Swap the weakest shot",""],["Add an end card",""],["Review my cut","review"]]}
assistPanel=function(){const box=$("#insp");if(!box||box.querySelector("#assist"))return;const head=box.querySelector(".ihead");if(!head||!cur())return;const pid=cur().id;loadChat(pid);
  const T=turnsOf(pid),sel=selClips().length;
  head.insertAdjacentHTML("afterend",`<section class="chat" id="assist" aria-label="Claude">
    <div class="thread" id="thread">${T.length?T.map((t,i)=>turnHTML(t,i,T)).join(""):`<div class="hello"><span class="cmark">${ic("claude")}</span><b>Edit with Claude</b><p>Tell Claude what to change in plain words: “cut the slow bits”, “make the captions punchier”, “end on the DJ”. Every change is saved as a version, so you can undo or try again.</p></div>`}${assistBusy?`<div class="turn claude busy"><span class="cmark">${ic("claude")}</span><div class="bub"><span class="dots"><i></i><i></i><i></i></span> ${esc(E.chatStage||"Working on it…")}</div></div>`:""}</div>
    <div class="sugs">${quickCmds().map(([l,k])=>`<button type="button" data-sug="${esc(l)}" ${k?`data-sugk="${k}"`:""}>${esc(l)}</button>`).join("")}</div>
    <form class="composer" id="assistForm"><textarea id="asText" rows="2" placeholder="${sel?`Ask about the ${sel} selected clip${sel>1?"s":""}…`:"Ask Claude to change the edit…"}" aria-label="Message Claude">${esc(E.asDraft||"")}</textarea>
      <div class="crow"><small>${sel?sel+" clip"+(sel>1?"s":"")+" selected · sent with your message":"Enter to send · Shift+Enter for a new line"}</small><button type="submit" class="btn purple" id="asGo" ${assistBusy?"disabled":""}>${assistBusy?"Working…":"Send"}</button></div></form></section>`);
  const th=$("#thread");if(th)th.scrollTop=th.scrollHeight};
function turnHTML(t,i,T){if(t.who==="me")return`<div class="turn me"><div class="bub">${esc(t.text)}</div></div>`;
  if(t.who==="err")return`<div class="turn claude err"><span class="cmark">${ic("claude")}</span><div class="bub">${esc(t.text)}</div></div>`;
  const last=i===T.length-1;return`<div class="turn claude"><span class="cmark">${ic("claude")}</span><div class="bub">${esc(t.text)}${t.changes?`<div class="chg">${esc(t.changes)}</div>`:""}
    ${t.ver?`<div class="tacts"><button class="btn sm" data-undoturn="${i}" title="Restore the edit from before this change">Undo</button>${t.prompt?`<button class="btn sm" data-retry="${i}" title="Restore and ask again">Try again</button>`:""}</div>`:""}</div></div>`}
function refreshAssist(){const a=$("#assist");if(a){const t=$("#asText");E.asDraft=t?t.value:E.asDraft;a.remove()}if(state.itab==="claude"&&E.page!=="color")assistPanel()}
async function runAssist(review,again){if(assistBusy||!E.tl)return;const txtEl=$("#asText");const ask=again!=null?again:((txtEl&&txtEl.value.trim())||"");if(!review&&!ask){if(txtEl)txtEl.focus();return}
  const pid=cur().id,T=turnsOf(pid);const S=await getSample();if(!S){T.push({who:"err",text:HOSTED?"No AI is set up yet. Pick a free one in Help › AI Settings (Google Gemini with a free key works best).":"Claude isn’t available in this view. Open Edit Bay on claude.ai while signed in."});refreshAssist();return}
  assistBusy=true;E.asDraft="";if(txtEl)txtEl.value="";if(again==null)T.push({who:"me",text:review?"Review my cut"+(ask?": "+ask:""):ask});E.chatStage=review?"Watching your cut…":"Reading the timeline…";refreshAssist();
  const actId=uid("act"),act={projectId:pid,title:review?"Reviewing the cut":"Editing: "+ask.slice(0,60),step:E.chatStage,status:"working",progress:null,startedAt:nowISO(),updatedAt:nowSec(),chat:"Claude in Edit Bay"};if(db)db.collection("activity").doc(actId).set(act).catch(()=>{});
  try{let images=[],frameNote="";if(review&&sampleCaps&&sampleCaps.images){const fr=await grabFrames(8);images=fr.map(f=>f.blob);frameNote="\nThe attached images are frames from the cut, in order, at these timeline seconds: "+fr.map(f=>f.t.toFixed(2)).join(", ")+"."}
    const hist=T.filter(t=>t.who!=="err").slice(-9,-1).map(t=>(t.who==="me"?"Person: ":"You: ")+t.text+(t.changes?" ["+t.changes+"]":"")).join("\n");
    const task=review?`Review this cut like a picky film editor. Leave 3–8 "marker" ops at the exact seconds that need work, each with a short, specific note. Don't change clips unless asked. Review the sound too: use "audio" (levels, silences, and "issues") and leave a marker at each sound problem.${ask?"\nFocus: "+ask:""}`:`Request: ${ask}`;
    E.chatStage="Thinking about the edit…";refreshAssist();
    const prompt=`${ASSIST_RULES}\n\nTIMELINE (JSON):\n${JSON.stringify(tlSummary())}${frameNote}${hist?"\n\nCONVERSATION SO FAR (most recent last):\n"+hist:""}\n\n${task}`;
    /* cache:false so "Try again" and repeated requests really ask again instead of replaying the last answer */
    const r=await S.json(prompt,images.length?{images,modelTier:"default",cache:false}:{modelTier:"default",cache:false});const ops=Array.isArray(r&&r.ops)?r.ops:[];let res={done:[],skipped:[]},ver=null;
    if(ops.length){E.chatStage="Applying changes…";refreshAssist();ver=await aiCheckpoint("Before Claude: "+(review?"review":ask)).catch(()=>null);const before=new Map(E.tl.clips.map(c=>[c.id,JSON.stringify(c)]));pushUndo();E.by="claude";res=applyOps(ops,{});E.tl.note=String(r.say||"").slice(0,200);normalize();commit();E.by="joe";
      E.flash=new Set(E.tl.clips.filter(c=>before.get(c.id)!==JSON.stringify(c)).map(c=>c.id));setTimeout(()=>E.flash.clear(),2600);edRefresh();addLog(pid,{who:"claude",text:"Claude: "+(r.say||ops.length+" changes")})}
    const sum=res.done.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{});const changes=Object.entries(sum).map(([k,v])=>v+"× "+k).join(" · ")+(res.skipped.length?(res.done.length?" · ":"")+res.skipped.length+" skipped":"");
    T.push({who:"claude",text:String((r&&r.say)||(ops.length?"Done.":"No changes needed.")),changes,ver,prompt:review?null:ask,at:nowSec(),changed:[...(E.flash||[])].slice(0,60)});
    if(db)db.collection("activity").doc(actId).set(Object.assign(act,{status:"done",step:String((r&&r.say)||"Done").slice(0,120),progress:1,updatedAt:nowSec()})).catch(()=>{})}
  catch(e){const c=e&&e.code;try{console.error("Edit Bay chat error",c,e&&e.message,e)}catch(x){}T.push({who:"err",text:HOSTED&&!c&&e&&e.message?e.message:chatErrorText(c,e)});
    if(db)db.collection("activity").doc(actId).set(Object.assign(act,{status:"error",updatedAt:nowSec()})).catch(()=>{})}
  finally{assistBusy=false;E.chatStage="";saveChat(pid);refreshAssist()}}
document.addEventListener("submit",e=>{if(e.target.id==="assistForm"){e.preventDefault();e.stopImmediatePropagation();runAssist(false)}},true);
document.addEventListener("keydown",e=>{if(e.target&&e.target.id==="asText"&&e.key==="Enter"&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();runAssist(false)}},true);
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.sugk==="create"){e.stopImmediatePropagation();openCreate();return}if(b.dataset.sugk==="review"){e.stopImmediatePropagation();runAssist(true);return}
  if(b.dataset.undoturn!=null){const t=turnsOf(cur().id)[+b.dataset.undoturn];if(t&&t.ver){watchVersions();const go=()=>{if(VERS.find(v=>v.id===t.ver)){restoreVersion(t.ver);turnsOf(cur().id).push({who:"claude",text:"Undone: the edit is back to how it was before that change."});saveChat(cur().id);refreshAssist()}else toast("UNDO","That version isn’t available any more.")};VERS.find(v=>v.id===t.ver)?go():setTimeout(go,800)}}
  else if(b.dataset.retry!=null){const T=turnsOf(cur().id),t=T[+b.dataset.retry];if(!t||!t.ver)return;watchVersions();setTimeout(()=>{if(VERS.find(v=>v.id===t.ver))restoreVersion(t.ver);runAssist(false,t.prompt)},VERS.find(v=>v.id===t.ver)?0:800)}},true);
/* checkpoint before Create too, and log it in the thread */
const _runCreate=runCreate;runCreate=async function(o){const pid=cur()&&cur().id;const ver=E.tl&&E.tl.clips.length?await aiCheckpoint("Before Create"):null;await _runCreate(o);const p=cur();if(!p)return;const T=turnsOf(p.id);
  if(E.tl&&E.tl.note&&E.tl.updatedBy==="claude"){T.push({who:"me",text:"Create: "+o.brief.slice(0,200)});T.push({who:"claude",text:"Created: "+E.tl.note,changes:v1().length+" shots · "+tlDur().toFixed(1)+" s",ver:p.id===pid?ver:null,at:nowSec()});E.asLog=[];saveChat(p.id);refreshAssist()}};

/* ---------- Scenes (InVideo-style scene cards over the storyline) ---------- */
function scenesOf(){return E.tl?v1().map((c,i)=>{const over=E.tl.clips.filter(x=>x.type==="title"&&x.start<cend(c)-.05&&cend(x)>c.start+.05);return{c,i,titles:over.filter(x=>x.track==="V2"),caps:over.filter(x=>x.track==="V3")}}):[]}
function renderScenes(body){body.dataset.k="scenes|"+E.pid;const S=scenesOf();if(!S.length){body.innerHTML=`<div class="empty" style="font-size:12px">No scenes yet. Add clips to the storyline, or use Create to build a first cut.</div>`;return}
  const vm=projMedia().filter(m=>m.kind==="video"||m.kind==="image");
  body.innerHTML=`<div class="scenes">${S.map(({c,i,titles,caps})=>{const m=mediaOf(c.mediaId),th=m&&TH[m.id]||{};const bg=m&&m.kind==="image"?`background-image:url('${esc(blobUrl(m))}')`:th.thumb?`background-image:url('${th.thumb}')`:"";
    return`<article class="scene${E.sel.has(c.id)?" on":""}" data-scene="${esc(c.id)}"><div class="sth" style="${bg}" data-sseek="${esc(c.id)}"><span>${i+1}</span><em>${tcs(cdur(c)).slice(3)}</em></div>
    <div class="sbody">${titles.map(t=>`<input class="stx" data-stext="${esc(t.id)}" value="${esc(String(t.text||"").replace(/\n/g," / "))}" aria-label="On-screen text, scene ${i+1}">`).join("")}${caps.map(t=>`<input class="stx cap" data-stext="${esc(t.id)}" value="${esc(t.text||"")}" aria-label="Caption, scene ${i+1}">`).join("")}${!titles.length&&!caps.length?`<span class="snone">No text</span>`:""}
      <div class="sacts"><select data-sswap="${esc(c.id)}" aria-label="Swap media for scene ${i+1}"><option value="">Swap media…</option>${vm.filter(x=>x.id!==c.mediaId).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select><button class="btn sm" data-sask="${i}">Ask Claude</button></div></div></article>`}).join("")}</div>`}
const _ri2=renderIndex;renderIndex=function(){_ri2();const t=$("#ixtabs");if(t&&!t.querySelector('[data-ixtab="scenes"]'))t.insertAdjacentHTML("afterbegin",`<button data-ixtab="scenes" aria-pressed="${state.ixtab==="scenes"}">Scenes</button>`);
  if(state.ixtab==="scenes"&&cur()){t.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.ixtab==="scenes"));renderScenes($("#ixbody"))}};
const _edIndex2=edIndex;edIndex=function(body){if(state.ixtab==="scenes")return renderScenes(body);_edIndex2(body)};
document.addEventListener("click",e=>{const s=e.target.closest("[data-sseek]");if(s){const c=clipById(s.dataset.sseek);if(c){E.sel=new Set([c.id]);pause();seek(c.start+.01);state.itab="clip";render()}return}
  const a=e.target.closest("[data-sask]");if(a){const sc=scenesOf()[+a.dataset.sask];if(!sc)return;E.sel=new Set([sc.c.id]);state.itab="claude";E.asDraft=`Scene ${+a.dataset.sask+1} (${tcs(sc.c.start)}–${tcs(cend(sc.c))}): `;render();setTimeout(()=>{const t=$("#asText");if(t){t.focus();t.setSelectionRange(t.value.length,t.value.length)}},0)}});
document.addEventListener("change",e=>{const el=e.target;
  if(el.dataset&&el.dataset.stext){const c=clipById(el.dataset.stext);if(c){const v=el.value;edit(()=>{c.text=v.replace(/ \/ /g,"\n")})}}
  else if(el.dataset&&el.dataset.sswap){const c=clipById(el.dataset.sswap),m=mediaOf(el.value);if(c&&m){edit(()=>{const d=cdur(c);c.mediaId=m.id;c.name=m.name;c.type=m.kind;c.speed=1;delete c.ramp;delete c.reverse;delete c.freeze;
    if(m.kind==="image"){c.in=0;c.out=d;c.kb=true}else{const an=AU.vid[m.id];let s=0;if(an&&!an.still){let best=-1;for(let t=0;t+d<=an.dur;t+=Math.max(.25,an.step)){const sc=windowScore(an,t,d);if(sc>best){best=sc;s=t}}}c.in=s;c.out=Math.min((m.dur||d),s+d)}});toast("SWAPPED","Scene now uses "+m.name+".")}}});
document.addEventListener("click",e=>{const t=e.target.closest(".toast");if(t)t.remove()});

/* say what actually went wrong, and what to do about it */
function chatErrorText(c,e){const M={not_granted:"Claude wasn’t allowed to run here. Open this page’s Permissions menu, allow Claude, then try again.",rate_limited:"You’ve hit a Claude usage limit, or too many requests are running. Wait a little, then try again.",
  invalid_json:"Claude answered, but not in a form Edit Bay could turn into edits. Try again, or say it more specifically.",session_expired:"Your claude.ai sign-in has expired. Reload the page and sign in again.",
  sampling_disabled:"Claude isn’t available for this account or organization in artifacts.",not_declared:"This copy of Edit Bay isn’t set up to use Claude. Reload the page.",capability_disabled:"Claude can’t be used in this view. Open Edit Bay in a normal browser tab on claude.ai.",capability_removed:"This app version can’t run Claude requests from a page. Update the Claude app, or use a browser tab.",
  refused:"Claude declined this request. Rephrase it and try again.",empty_completion:"Claude returned nothing. Try a simpler request.",prompt_too_large:"This edit is too large to send in one go. Select fewer clips or shorten the timeline, then try again.",images_unavailable:"Claude can’t receive images in this view, so Review can’t watch the cut here.",image_rejected:"Claude couldn’t read the preview frames. Try again.",upstream_error:"Claude’s service had a hiccup. Try again in a moment.",cancelled:"Stopped."};
  if(c&&M[c])return M[c];const detail=String((e&&e.message)||e||"").slice(0,140);return"Something went wrong"+(c?" ("+c+")":"")+(detail?": "+detail:"")+". Try again, and if it keeps happening send this message through Feedback."}
