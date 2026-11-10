/* Edit Bay — UI/UX round 3: right-click menus, ⌘K command search, clear track controls, recent projects on the
   welcome screen, a no-project timeline state, export preset preselection and tidier panel headers. */

/* ---------- icons for track controls ---------- */
Object.assign(ICON_PATHS,{
  eye:'<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  eyeoff:'<path d="M2 2l12 12M6.4 4A6.6 6.6 0 0114.5 8a10 10 0 01-1.9 2.4M9.8 12.2A6.4 6.4 0 011.5 8a10 10 0 012.6-3"/>',
  lock:'<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/>',
  unlock:'<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 014.8-1"/>',
  spk:'<path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z"/><path d="M11 5.5a3.5 3.5 0 010 5M12.8 3.8a6 6 0 010 8.4"/>',
  spkoff:'<path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z"/><path d="M11 6l3.5 4M14.5 6L11 10"/>',
  search:'<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>'});
function trackIcons(){document.querySelectorAll("#tlc .thead").forEach(h=>{const t=h.closest(".etrack");if(!t||h.dataset.ic)return;h.dataset.ic=1;const au=t.dataset.track[0]==="A",off=t.classList.contains("off"),lk=t.classList.contains("lk");
  const tb=h.querySelector("[data-trk]");if(tb){tb.innerHTML=ic(au?(off?"spkoff":"spk"):(off?"eyeoff":"eye"));tb.setAttribute("aria-label",(off?"Turn on ":"Turn off ")+t.dataset.track);tb.title=(off?"Turn on ":"Turn off ")+t.dataset.track+(au?" (silences the track)":" (hides the track)")}
  const lb=h.querySelector("[data-tlock]");if(lb){lb.innerHTML=ic(lk?"lock":"unlock");lb.setAttribute("aria-label",(lk?"Unlock ":"Lock ")+t.dataset.track);lb.title=(lk?"Unlock ":"Lock ")+t.dataset.track+(lk?"":" so it can’t be edited")}
  const m=h.querySelector("[data-tmute]");if(m){m.setAttribute("aria-label","Mute "+t.dataset.track);m.title="Mute "+t.dataset.track+" in the mix"}const s=h.querySelector("[data-tsolo]");if(s){s.setAttribute("aria-label","Solo "+t.dataset.track);s.title="Solo "+t.dataset.track+": hear only this track"}})}

/* ---------- no-project timeline, track icons ---------- */
const _edTL3=edTimeline;edTimeline=function(){_edTL3();if(!cur()){const c=$("#tlc");if(c&&!c.querySelector(".tlnone"))c.innerHTML=`<div class="tlnone" style="width:${($("#tlscroll")||{}).clientWidth||600}px">Your timeline appears here once you open or start a project.</div>`;return}trackIcons()};

/* ---------- with no project open: recent projects in the Inspector, no project-only actions ---------- */
const _ri3=renderInsp;renderInsp=function(){_ri3();if(cur())return;const box=$("#insp");if(!box||box.querySelector(".recent"))return;const ps=[...state.projects].sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))).slice(0,8);
  box.innerHTML=ps.length?`<div class="recent"><b>Recent projects</b>${ps.map(p=>`<button data-sel="${esc(p.id)}"><span>${esc(p.title||"Untitled")}</span><small>${p.updatedAt?new Date(p.updatedAt).toLocaleDateString(undefined,{day:"numeric",month:"short"}):""}</small></button>`).join("")}</div>`:`<div class="recent"><p>No projects yet. Start one in the viewer, or press ⌘K to search every command.</p></div>`};
const _r3=render;render=function(){_r3();if(!cur()&&state.btab==="media"){const b=$("#bacts");if(b)b.innerHTML=""}};
/* ---------- export opens on the matching preset ---------- */
const _oe3=openExport;openExport=function(){_oe3();const x=E.x;if(!x||x.pre)return;const P=XPRE.find(p=>p[3].q===x.q&&p[3].lufs===x.lufs&&Math.abs(xScaleFor(p[3].short)-(x.scale||1))<1e-6);if(!P)return;x.pre=P[0];
  document.querySelectorAll("[data-xpre]").forEach(b=>{const on=b.dataset.xpre===P[0];b.classList.toggle("on",on);b.setAttribute("aria-checked",on)})};

/* ---------- shared popup menu ---------- */
let MENU=null;function closeMenu(){if(MENU){MENU.remove();MENU=null}}
function popMenu(x,y,items){closeMenu();const m=document.createElement("div");m.className="ctx";m.setAttribute("role","menu");
  m.innerHTML=items.map((it,i)=>it==="-"?"<hr>":`<button role="menuitem" data-ctx="${i}" ${it.off?"disabled":""}>${esc(it.l)}${it.k?`<kbd>${esc(it.k)}</kbd>`:""}</button>`).join("");document.body.appendChild(m);MENU=m;
  const r=m.getBoundingClientRect();m.style.left=Math.max(4,Math.min(x,innerWidth-r.width-4))+"px";m.style.top=Math.max(4,Math.min(y,innerHeight-r.height-4))+"px";
  m.addEventListener("click",e=>{const b=e.target.closest("[data-ctx]");if(!b||b.disabled)return;const it=items[+b.dataset.ctx];closeMenu();try{it.f()}catch(err){console.error(err)}});const f=m.querySelector("button:not([disabled])");if(f)f.focus()}
document.addEventListener("pointerdown",e=>{if(MENU&&!e.target.closest(".ctx"))closeMenu()},true);
document.addEventListener("keydown",e=>{if(!MENU)return;if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();closeMenu();return}
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();e.stopImmediatePropagation();const bs=[...MENU.querySelectorAll("button:not([disabled])")];const i=bs.indexOf(document.activeElement);const n=bs[(i+(e.key==="ArrowDown"?1:-1)+bs.length)%bs.length];if(n)n.focus()}},true);
window.addEventListener("blur",closeMenu);window.addEventListener("resize",closeMenu);

/* ---------- right-click on the timeline ---------- */
function askClaudeAbout(cs){state.itab="claude";$("#insp").dataset.k="";render();setTimeout(()=>{const t=$("#asText");if(t){t.focus();t.placeholder="Ask about "+(cs.length>1?cs.length+" clips":"“"+(cs[0].name||cs[0].text||"this clip")+"”")+"…"}},60)}
function clipMenu(e,c){if(!E.sel.has(c.id)){E.sel=new Set([c.id]);render()}const cs=selClips(),one=cs.length===1,vid=c.type==="video"&&!c.freeze,inside=E.t>c.start&&E.t<cend(c);
  popMenu(e.clientX,e.clientY,[
    {l:"Split at playhead",k:"B",off:!inside,f:()=>bladeAtPlayhead()},
    {l:"Copy",k:"⌘C",f:copySel},{l:"Paste attributes",k:"⌥⌘V",off:!E.clip||!E.clip.length,f:pasteAttrs},"-",
    {l:c.off?"Turn clip on":"Turn clip off",k:"V",f:()=>{const off=!cs.every(x=>x.off);edit(()=>cs.forEach(x=>{if(off)x.off=true;else delete x.off}))}},
    {l:c.reverse?"Play forwards":"Reverse",off:!(vid||c.type==="audio"),f:()=>{const r=!c.reverse;edit(()=>cs.filter(x=>x.mediaId).forEach(x=>{if(r)x.reverse=true;else delete x.reverse}))}},
    {l:"Freeze frame here",k:"⌥F",off:!vid||!inside,f:freezeAt},
    {l:"Detach audio",off:!vid,f:detachAudio},
    {l:"Open in Source viewer",k:"F",off:!c.mediaId,f:()=>{if(!inside)seek(c.start+.01);matchFrame()}},
    {l:"Add an effect…",off:c.type==="audio",f:()=>{state.btab="fx";render()}},"-",
    {l:"Ask Claude about "+(one?"this clip":cs.length+" clips")+"…",f:()=>askClaudeAbout(cs)},"-",
    {l:"Delete",k:"⌫",f:()=>deleteSel(true)},{l:"Delete, leave a gap",k:"⇧⌫",f:()=>deleteSel(false)}])}
document.addEventListener("contextmenu",e=>{const el=e.target.closest("#tlc [data-clip]");if(el&&E.tl){const c=E.tl.clips.find(x=>x.id===el.dataset.clip);if(!c)return;e.preventDefault();clipMenu(e,c);return}
  if(e.target.closest("#tlc")&&cur()){e.preventDefault();const t=typeof timeAt==="function"?timeAt(e.clientX):E.t;
    popMenu(e.clientX,e.clientY,[{l:"Move playhead here",f:()=>{pause();seek(t)}},{l:"Paste",k:"⌘V",off:!E.clip||!E.clip.length,f:()=>{seek(t);pasteClips()}},"-",{l:"Add title here",k:"T",f:()=>{seek(t);addTitleAtPlayhead()}},{l:"Add marker here",k:"M",f:()=>{seek(t);addMarker("")}},"-",{l:"Import media…",k:"⌘I",f:()=>fileAction("import")},{l:"Ask Claude to edit…",f:()=>askClaudeAbout([])}])}});

/* ---------- ⌘K command search ---------- */
function cmdList(){const has=!!cur(),sel=selClips().length;const L=[];const add=(g,l,f,k,off)=>{if(!off)L.push({g,l,f,k})};
  add("File","New project",()=>fileAction("new"),"⌥N");add("File","Import media",()=>fileAction("import"),"⌘I",!has);add("File","Create video from a prompt",()=>{const b=document.createElement("button");b.dataset.create=1;b.hidden=true;document.body.appendChild(b);b.click();b.remove()});
  add("File","Export video",()=>fileAction("export"),"⌘E",!has);add("File","Export still frame",()=>fileAction("frame"),"⌥⌘E",!has);add("File","Save version",()=>fileAction("version"),"⌘S",!has);add("File","Versions",()=>fileAction("versions"),"",!has);
  add("File","Import captions (.srt, .vtt)",()=>fileAction("captions"),"",!has);add("File","Save project file",()=>fileAction("saveproj"),"",!has);add("File","Open project file",()=>fileAction("openproj"));add("File","Export FCPXML",()=>fileAction("fcpxml"),"",!has);add("File","Export EDL",()=>fileAction("edl"),"",!has);
  add("File","Undo history",()=>fileAction("undohist"),"⌥⌘Z",!has);add("File","Duplicate project",()=>fileAction("dup"),"",!has);add("File","Storage and media",()=>fileAction("storage"));
  [["edit","Edit page","⌘1"],["color","Color page","⌘2"],["audio","Audio page","⌘3"],["deliver","Deliver page","⌘4"]].forEach(([k,l,s])=>add("Go to",l,()=>setPage(k),s,!has));
  add("Go to","Claude chat",()=>askClaudeAbout(selClips()),"",!has);add("Go to","Effects and transitions",()=>{state.btab="fx";render()},"",!has);
  add("Edit","Add title at playhead",addTitleAtPlayhead,"T",!has);add("Edit","Add marker",()=>addMarker(""),"M",!has);add("Edit","Split at playhead",bladeAtPlayhead,"",!has);add("Edit","Freeze frame",freezeAt,"⌥F",!has);
  add("Edit","Add default transition",addDefaultTransition,"⌘T",!sel);add("Edit","Delete selection",()=>deleteSel(true),"⌫",!sel);add("Edit","Select all",()=>{E.sel=new Set(E.tl.clips.map(c=>c.id));render()},"⌘A",!has);
  add("View","Zoom to fit",()=>{E.pps=null;edTimeline();renderTools()},"⇧Z",!has);add("View","Toggle snapping",()=>{E.snap=!E.snap;renderTools();edTimeline()},"N",!has);add("View","Keyboard shortcuts",()=>{state.modal="keys";showKeys()},"?");
  add("Tools","Auto Cut to music",()=>{const b=$("#autoBtn");if(b)b.click()},"",!has);
  if(sel&&typeof FX==="object")Object.entries(FX).forEach(([k,[l]])=>add("Effect","Add "+l,()=>addFx(k)));
  if(sel)TRANS.forEach(([k,l])=>add("Transition",l,()=>{const b=document.createElement("button");b.dataset.applytr=k;b.hidden=true;document.body.appendChild(b);b.click();b.remove()}));
  state.projects.filter(p=>!cur()||p.id!==cur().id).slice(0,30).forEach(p=>add("Open",p.title||"Untitled",()=>edSwitchProject(p.id)));return L}
function score(q,s){s=s.toLowerCase();if(!q)return 1;if(s.startsWith(q))return 3;if(s.includes(q))return 2;let i=0;for(const ch of s){if(ch===q[i])i++;if(i===q.length)return 1}return 0}
function openCmd(){closeMenu();if($("#cmdk"))return;const all=cmdList();const d=document.createElement("div");d.id="cmdk";d.className="ov";
  d.innerHTML=`<div class="cmdk" role="dialog" aria-label="Search commands"><div class="cq">${ic("search")}<input id="cmdq" placeholder="Search commands, effects, projects…" aria-label="Search commands" autocomplete="off"><kbd>esc</kbd></div><div class="cl" id="cmdl" role="listbox"></div></div>`;document.body.appendChild(d);
  let list=[],at=0;const draw=()=>{const q=$("#cmdq").value.trim().toLowerCase();list=all.map(c=>[c,Math.max(score(q,c.l),score(q,c.g+" "+c.l)*.9)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,40).map(x=>x[0]);at=Math.min(at,Math.max(0,list.length-1));
    $("#cmdl").innerHTML=list.length?list.map((c,i)=>`<button role="option" aria-selected="${i===at}" data-ci="${i}" class="${i===at?"on":""}"><small>${esc(c.g)}</small><span>${esc(c.l)}</span>${c.k?`<kbd>${esc(c.k)}</kbd>`:""}</button>`).join(""):`<div class="cnone">Nothing matches. Try “export”, “title” or “glow”.</div>`;const o=$("#cmdl .on");if(o)o.scrollIntoView({block:"nearest"})};
  const run=i=>{const c=list[i];d.remove();if(c)setTimeout(()=>{try{c.f()}catch(e){console.error(e)}},0)};
  $("#cmdq").addEventListener("input",()=>{at=0;draw()});d.addEventListener("click",e=>{const b=e.target.closest("[data-ci]");if(b)run(+b.dataset.ci);else if(e.target===d)d.remove()});
  $("#cmdq").addEventListener("keydown",e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();at=(at+(e.key==="ArrowDown"?1:-1)+list.length)%Math.max(1,list.length);draw()}else if(e.key==="Enter"){e.preventDefault();run(at)}else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();d.remove()}e.stopPropagation()});
  draw();$("#cmdq").focus()}
document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&(e.code==="KeyK")){e.preventDefault();e.stopImmediatePropagation();$("#cmdk")?$("#cmdk").remove():openCmd()}},true);
setTimeout(()=>{const a=$("#topActs");if(a&&!$("#cmdBtn"))a.insertAdjacentHTML("afterbegin",`<button class="tbtn2 cmdb" id="cmdBtn" title="Search every command (⌘K)" aria-label="Search commands">${ic("search")}<span>Search</span><kbd>⌘K</kbd></button>`);$("#cmdBtn")&&$("#cmdBtn").addEventListener("click",openCmd)},0);
