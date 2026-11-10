/* Edit Bay — scale and safety: the timeline redraws as you scroll (only visible clips are drawn), a visual undo history,
   rolling automatic backups, and rebindable single-key shortcuts. */

/* ---------- redraw the visible stretch while scrolling ---------- */
let vwRaf=0;$("#tlscroll").addEventListener("scroll",()=>{if(state.ttab!=="edit"||E.drag||!E._vw)return;const sc=$("#tlscroll"),P=E._vw[2]||1;const a=(sc.scrollLeft-LEFT)/P,b=(sc.scrollLeft+sc.clientWidth)/P;
  if(a<E._vw[0]+100/P&&E._vw[0]>0||b>E._vw[1]-100/P){cancelAnimationFrame(vwRaf);vwRaf=requestAnimationFrame(()=>edTimeline())}},{passive:true});
/* Show changes: scroll by time (the clip may not be drawn yet) */
document.addEventListener("click",e=>{const b=e.target.closest("[data-showchg]");if(!b)return;setTimeout(()=>{const c=[...E.sel].map(clipById).filter(Boolean).sort((x,y)=>x.start-y.start)[0];const sc=$("#tlscroll");if(c&&sc){sc.scrollLeft=Math.max(0,c.start*(E._pps||1)-40);edTimeline()}},0)});

/* ---------- undo history ---------- */
function describe(a,b){/* what changed from snapshot a to snapshot b */try{const A=JSON.parse(a),B=JSON.parse(b);if(B.updatedBy==="claude"&&B.note&&B.note!==A.note)return"Claude: "+B.note;
  const ma=new Map(A.clips.map(c=>[c.id,c])),mb=new Map(B.clips.map(c=>[c.id,c]));const add=B.clips.filter(c=>!ma.has(c.id)),del=A.clips.filter(c=>!mb.has(c.id));
  if(add.length&&del.length)return"Replaced "+del.length+" clip"+(del.length>1?"s":"");if(add.length===1&&del.length===0){const c=add[0];return c.freeze?"Freeze frame":(A.clips.some(x=>x.mediaId===c.mediaId&&x.track===c.track)&&add.length===1?"Split or added "+(c.name||c.type):"Added "+(c.type==="title"?"title":c.name||c.type))}
  if(add.length)return"Added "+add.length+" clips";if(del.length)return"Removed "+(del.length===1?(del[0].type==="title"?"title":del[0].name||"clip"):del.length+" clips");
  const ch=B.clips.filter(c=>JSON.stringify(c)!==JSON.stringify(ma.get(c.id)));if(!ch.length){if(JSON.stringify(A.markers)!==JSON.stringify(B.markers))return"Markers";if(JSON.stringify(A.tracks)!==JSON.stringify(B.tracks))return"Track settings";return"Timeline settings"}
  const o=ma.get(ch[0].id),n=ch[0],keys=Object.keys(Object.assign({},o,n)).filter(k=>JSON.stringify(o[k])!==JSON.stringify(n[k]));const nm=n.type==="title"?"title":(n.name||n.type);
  const has=(...k)=>keys.some(x=>k.includes(x));const label=has("start")&&!has("in","out")?"Moved":has("in","out")?"Trimmed":has("tr")?"Transition":has("kf")?"Keyframes":has("look","bri","con","sat","temp","tint","curves","lut","lgg","fade","vig","grain","hue","bw","sepia")?"Colour":has("vol","pan","lead","tail","xf")?"Audio":has("text","font","size","color","anim")?"Text":has("speed","ramp","reverse")?"Speed":has("scale","x","y","rot","op")?"Transform":"Changed";
  return label+" "+(ch.length>1?ch.length+" clips":nm)}catch(e){return"Edit"}}
function histModal(){const box=$("#modal");box.dataset.k="hist";const now=JSON.stringify(E.tl);const steps=E.undo.map((s,i)=>({i,label:describe(s,i+1<E.undo.length?E.undo[i+1]:now)})).reverse();
  box.innerHTML=`<div class="ov" id="ov"><div class="dlg au" role="dialog" aria-label="Undo history"><h3>Undo history</h3><div style="font-size:12px;color:var(--muted);margin-top:-4px">Click a step to go back to just before it. You can redo afterwards (⇧⌘Z).</div>
    ${steps.length?`<ul class="vlist hist"><li class="now"><span><b>Now</b><small>${E.tl?E.tl.clips.length+" clips · "+tcs(tlDur()):""}</small></span></li>${steps.map(s=>`<li><span><b>${esc(s.label)}</b></span><button class="btn sm" data-histgo="${s.i}">Go back</button></li>`).join("")}</ul>`:`<div style="font-size:12.5px;color:var(--muted)">Nothing to undo yet.</div>`}
    <div class="acts"><button type="button" class="btn" data-sx="1">Close</button></div></div></div>`}
const _rm6=renderModal;renderModal=function(){if(state.modal==="hist"){histModal();return}if(state.modal==="keys2"){keysModal();return}if(["hist","keys2"].includes($("#modal").dataset.k))$("#modal").dataset.k="";_rm6()};
document.addEventListener("click",e=>{const b=e.target.closest("[data-histgo]");if(!b)return;const n=E.undo.length-+b.dataset.histgo;for(let k=0;k<n;k++)undo();state.modal=null;$("#modal").dataset.k="";render();toast("WENT BACK",n+" step"+(n>1?"s":"")+" · ⇧⌘Z to redo")});

/* ---------- rolling automatic backups (every 3 minutes of editing, last 8 kept) ---------- */
const BK={last:{},busy:false};
const _commitB=commit;commit=function(){_commitB();const pid=E.pid;if(!pid||!db||BK.busy)return;const now=Date.now();if(!BK.last[pid]){BK.last[pid]=now;return}if(now-BK.last[pid]<180000)return;BK.last[pid]=now;backup(pid)};
async function backup(pid){if(!E.tl||!E.tl.clips.length)return;BK.busy=true;try{const id=uid("bk");const d=new Date();await db.collection("versions").doc(id).set({projectId:pid,name:"Auto-backup "+pad(d.getHours())+":"+pad(d.getMinutes()),at:nowSec(),by:"joe",auto:true,backup:true,dur:+tlDur().toFixed(2),clips:E.tl.clips.length,tl:clone(E.tl)});
  const mine=(typeof VERS!=="undefined"?VERS:[]).filter(v=>v.projectId===pid&&v.backup).sort((a,b)=>String(b.at).localeCompare(String(a.at)));for(const v of mine.slice(7))db.doc("versions/"+v.id).delete().catch(()=>{})}catch(e){}finally{BK.busy=false}}

/* ---------- rebindable shortcuts ---------- */
const KEYACTS=[["a","Select tool"],["b","Blade tool"],["y","Slip tool"],["r","Roll tool"],["t","Add title"],["m","Add marker"],["i","Mark In"],["o","Mark Out"],["e","Append"],["q","Connect"],["w","Insert"],["d","Overwrite (Source)"],["f","Match frame"],["v","Disable clip"],["n","Snapping"],["s","Skimming"],["j","Play backwards"],["k","Stop"],["l","Play forwards"]];
let KEYMAP={};try{KEYMAP=JSON.parse(localStorage.getItem("editbay.keys")||"{}")}catch(e){}/* KEYMAP[newKey]=originalKey */
const rev=()=>Object.fromEntries(Object.entries(KEYMAP).map(([k,v])=>[v,k]));
document.addEventListener("keydown",e=>{if(e.__eb||e.metaKey||e.ctrlKey||e.altKey||typing(e.target)||state.modal)return;const k=e.key.toLowerCase();
  const target=KEYMAP[k];const remapped=rev();
  if(target&&target!==k){e.preventDefault();e.stopImmediatePropagation();const ev=new KeyboardEvent("keydown",{key:e.shiftKey?target.toUpperCase():target,code:"Key"+target.toUpperCase(),shiftKey:e.shiftKey,bubbles:true,cancelable:true});ev.__eb=true;Object.defineProperty(ev,"__eb",{value:true});(document.activeElement||document).dispatchEvent(ev);return}
  if(remapped[k]&&!KEYMAP[k]){e.preventDefault();e.stopImmediatePropagation()}},true);
let capturing=null;
function keysModal(){const box=$("#modal");box.dataset.k="keys2";const r=rev();
  box.innerHTML=`<div class="ov" id="ov"><div class="dlg au" role="dialog" aria-label="Keyboard shortcuts"><h3>Keyboard shortcuts</h3><div style="font-size:12px;color:var(--muted);margin-top:-4px">Click a key to change it, then press the new key. ⌘ shortcuts stay as they are.</div>
    <div class="krows">${KEYACTS.map(([k,l])=>`<div class="krow"><span>${esc(l)}</span><button class="kbd kb${capturing===k?" cap":""}" data-rebind="${k}" aria-label="${esc(l)}: ${(r[k]||k).toUpperCase()}">${capturing===k?"Press a key…":(r[k]||k).toUpperCase()}</button></div>`).join("")}</div>
    <div class="acts"><button type="button" class="btn" data-keyreset="1">Reset to defaults</button><button type="button" class="btn blue" data-sx="1">Done</button></div></div></div>`}
document.addEventListener("click",e=>{const b=e.target.closest("[data-rebind],[data-keyreset],[data-keysopen]");if(!b)return;
  if(b.dataset.keysopen!=null){state.modal="keys2";$("#modal").dataset.k="";render();return}
  if(b.dataset.keyreset!=null){KEYMAP={};try{localStorage.removeItem("editbay.keys")}catch(x){}capturing=null;keysModal();toast("SHORTCUTS","Back to the defaults.");return}
  capturing=b.dataset.rebind;keysModal()});
document.addEventListener("keydown",e=>{if(!capturing||state.modal!=="keys2")return;e.preventDefault();e.stopImmediatePropagation();if(e.key==="Escape"){capturing=null;keysModal();return}
  const k=e.key.toLowerCase();if(!/^[a-z0-9]$/.test(k)){toast("SHORTCUTS","Use a letter or number key.");return}
  const r=rev();const owner=Object.entries(r).find(([o,kk])=>kk===k)?.[0]||(KEYACTS.some(a=>a[0]===k)&&!KEYMAP[k]&&!r[k]?k:null);
  Object.keys(KEYMAP).forEach(x=>{if(KEYMAP[x]===capturing)delete KEYMAP[x]});if(k!==capturing)KEYMAP[k]=capturing;
  if(owner&&owner!==capturing){const free=capturing;Object.keys(KEYMAP).forEach(x=>{if(KEYMAP[x]===owner)delete KEYMAP[x]});if(free!==owner)KEYMAP[free]=owner;toast("SHORTCUTS",`${k.toUpperCase()} was used by “${(KEYACTS.find(a=>a[0]===owner)||[0,owner])[1]}”; that moved to ${free.toUpperCase()}.`)}
  try{localStorage.setItem("editbay.keys",JSON.stringify(KEYMAP))}catch(x){}capturing=null;keysModal()},true);
