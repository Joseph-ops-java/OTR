/* Edit Bay — UX layer: one place for navigation (the Index lives in the Browser), primary actions in the title bar,
   collapsible Inspector sections, empty states, media search/size/list, export presets with size estimates,
   labels for icon-only buttons, and "Show changes" on Claude's replies. */
const UXK="editbay.ux";let UX={sec:{},msz:128,mlist:false};try{Object.assign(UX,JSON.parse(localStorage.getItem(UXK)||"{}"))}catch(e){}
const saveUX=()=>{try{localStorage.setItem(UXK,JSON.stringify(UX))}catch(e){}};E.mq="";

/* ---------- 1. Index moves into the Browser as the "Timeline" tab ---------- */
(function(){const ix=$("aside.index"),bp=$(".browser-p");if(!ix||!bp)return;bp.appendChild(ix);ix.classList.add("inbrowser");state.ix=false;
  const t=$("#btabs");if(t&&!t.querySelector('[data-btab="index"]'))t.querySelector('[data-btab="media"]').insertAdjacentHTML("afterend",`<button data-btab="index" aria-pressed="false">Timeline</button>`);
  const ib=$("#ixBtn");if(ib)ib.hidden=true})();
const _rbU=renderBrowser;renderBrowser=function(){const ix=$("aside.index"),bb=$("#bbody");const on=E.page==="edit"&&!E.angleView&&state.btab==="index";
  if(ix)ix.style.display=on?"flex":"none";if(bb)bb.style.display=on?"none":"flex";document.querySelectorAll("[data-btab]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.btab===state.btab));
  if(on){$("#bacts").innerHTML="";renderIndex();return}_rbU()};
const _render=render;render=function(){_render();$("#tlrow").classList.add("noix");renderTop()};

/* ---------- 2. primary actions in the title bar ---------- */
(function(){const tr=$(".tright");if(!tr||$("#topActs"))return;tr.insertAdjacentHTML("afterbegin",`<span class="topacts" id="topActs"><button class="tbtn2" id="topImport">${ic("export","flip")}Import</button><button class="tbtn2 ai" id="topCreate">${ic("auto")}Create</button><button class="tbtn2 pri" id="topExport">${ic("export")}Export</button></span>`);
  const pc=$("#createBtn");if(pc)pc.remove()})();
function renderTop(){const has=!!cur(),empty=!E.tl||!E.tl.clips.length;const c=$("#topCreate"),x=$("#topExport"),i=$("#topImport");if(!c)return;
  c.classList.toggle("cta",has&&empty&&projMedia().length>0);x.disabled=!has||empty;i.disabled=false;x.title=empty?"Add clips to the timeline to export":"Export (⌘E)";i.title=has?"Import media (⌘I)":"Start a project and import media"}
const _rpb=renderPagebar;renderPagebar=function(){_rpb();const pc=$("#createBtn");if(pc)pc.remove()};

/* ---------- 4. collapsible Inspector sections, remembered ---------- */
const OPEN_DEF=new Set(["Text","Transition in","Timing","Audio","Transform","Multicam"]);
function sectionize(box){if(!box||box.querySelector(".isec"))return;const kids=[...box.children];let cur0=null;
  kids.forEach(el=>{if(el.classList.contains("grp")){const name=(el.querySelector("span")||el).textContent.split("·")[0].trim();const d=document.createElement("details");d.className="isec";const key=name.replace(/[^a-z]/gi,"");
      d.open=UX.sec[key]!=null?UX.sec[key]:OPEN_DEF.has(name)||[...OPEN_DEF].some(n=>name.startsWith(n));d.dataset.key=key;const s=document.createElement("summary");s.appendChild(el);d.appendChild(s);box.insertBefore(d,null);cur0=d}
    else if(cur0&&!el.classList.contains("ihead")&&!el.matches("div[style*='padding:12px']"))cur0.appendChild(el);else box.appendChild(el)})}
document.addEventListener("toggle",e=>{const d=e.target;if(d.classList&&d.classList.contains("isec")){UX.sec[d.dataset.key]=d.open;saveUX()}},true);
const _eciU=edClipInspector;edClipInspector=function(box){_eciU(box);sectionize(box)};

/* ---------- 7 + 9. media browser: empty state, search, size, list ---------- */
const _rmbU=renderMediaBrowser;renderMediaBrowser=function(){_rmbU();if(E.page!=="edit"||E.angleView||state.btab!=="media")return;const bb=$("#bbody"),g=$("#mgrid");if(!g||!cur())return;
  const n=projMedia().length;
  if(!n&&!E.uploads.length){g.classList.add("emptyg");g.innerHTML=`<div class="dropz"><span class="dzi">${ic("film","big")}</span><b>Drop your clips here</b><span>Video, audio and photos, any size. They stay on this device.</span><span class="eacts"><button class="btn blue" data-uximport="1">Import media</button></span><small>No footage yet? Create works best with a few clips of your own.</small></div>`;const t=bb.querySelector(".mtools");if(t)t.remove();return}
  g.classList.remove("emptyg");if(!bb.querySelector(".mtools"))g.insertAdjacentHTML("beforebegin",`<div class="mtools"><input id="mq" type="search" placeholder="Search media" aria-label="Search media" value="${esc(E.mq)}"><input id="msz" type="range" min="96" max="220" step="4" value="${UX.msz}" aria-label="Thumbnail size" title="Thumbnail size"><button class="ib ${UX.mlist?"on":""}" id="mlist" title="List view" aria-label="List view" aria-pressed="${UX.mlist}">${ic("index")}</button></div>`);
  g.style.setProperty("--msz",UX.msz+"px");g.classList.toggle("list",!!UX.mlist);applyMq()};
function applyMq(){const q=E.mq.trim().toLowerCase();document.querySelectorAll("#mgrid .mitem").forEach(m=>{const nm=(m.querySelector(".nm")||{}).textContent||"";m.hidden=!!q&&m.dataset.media!=="__title"&&!nm.toLowerCase().includes(q);if(m.dataset.media==="__title")m.hidden=!!q})}
document.addEventListener("input",e=>{if(e.target.id==="mq"){E.mq=e.target.value;applyMq()}else if(e.target.id==="msz"){UX.msz=+e.target.value;const g=$("#mgrid");if(g)g.style.setProperty("--msz",UX.msz+"px");saveUX()}});

/* ---------- 10. export presets + size estimate ---------- */
const XPRE=[["social","Social","1080p · 6 Mbps · −14 LUFS",{q:"std",short:1080,lufs:"-14"}],["hq","High quality","Full size · 12 Mbps",{q:"hi",short:0,lufs:"-14"}],["master","Master","Full size · 25 Mbps · −14 LUFS",{q:"max",short:0,lufs:"-14"}],["preview","Quick preview","540p · 3 Mbps",{q:"sm",short:540,lufs:"off"}]];
function xScaleFor(short){const tl=E.tl;if(!short)return 1;const s=Math.min(tl.w,tl.h);return short>=s?1:short/s}
function updEst(){const x=E.x,o=$("#xest");if(!x||!o||!E.tl)return;const useR=x.range&&E.rin!=null&&E.rout>E.rin;const d=useR?E.rout-E.rin:tlDur();const sc=x.scale||1;const br={max:25e6,hi:12e6,std:6e6,sm:3e6}[x.q||"std"]*Math.max(.35,sc>.99?1:Math.sqrt(sc));
  o.textContent=`About ${fmtBytes((br+192e3)*d/8)} · ${Math.round(E.tl.w*sc/2)*2}×${Math.round(E.tl.h*sc/2)*2} · ${tcs(d)}`}
const _edModalU=edModal;edModal=function(){_edModalU();const x=E.x;if(!x||x.phase!=="setup")return;const dlg=$("#modal .dlg");if(!dlg||dlg.querySelector(".xpre"))return updEst();
  const h=dlg.querySelector("h3");h.insertAdjacentHTML("afterend",`<div class="xpre" role="radiogroup" aria-label="Export preset">${XPRE.map(([k,n,d])=>`<button type="button" class="xp${x.pre===k?" on":""}" data-xpre="${k}" role="radio" aria-checked="${x.pre===k}"><b>${n}</b><small>${d}</small></button>`).join("")}</div><div class="mono" id="xest" style="font-size:11.5px;color:var(--muted)"></div>`);updEst()};
document.addEventListener("click",e=>{const b=e.target.closest("[data-xpre]");if(!b||!E.x)return;const P=XPRE.find(p=>p[0]===b.dataset.xpre)[3];Object.assign(E.x,{pre:b.dataset.xpre,q:P.q,lufs:P.lufs,scale:xScaleFor(P.short)});
  const set=(id,v)=>{const el=$(id);if(el&&[...el.options].some(o=>o.value==String(v)))el.value=String(v)};set("#xq",P.q);set("#xlufs",P.lufs);set("#xres",E.x.scale);
  document.querySelectorAll("[data-xpre]").forEach(x=>{const on=x===b;x.classList.toggle("on",on);x.setAttribute("aria-checked",on)});updEst()});
document.addEventListener("change",e=>{if(["xq","xres","xrange"].includes(e.target.id)){if(E.x)E.x.pre=null;document.querySelectorAll("[data-xpre]").forEach(x=>{x.classList.remove("on");x.setAttribute("aria-checked","false")});setTimeout(updEst,0)}});

/* ---------- 11. every icon-only button gets an accessible name ---------- */
let a11yT=0;new MutationObserver(()=>{clearTimeout(a11yT);a11yT=setTimeout(()=>{document.querySelectorAll("button:not([aria-label])").forEach(b=>{if(!b.textContent.trim()&&b.title)b.setAttribute("aria-label",b.title.replace(/\s*\(.+?\)\s*$/,""))})},120)}).observe(document.body,{childList:true,subtree:true});

/* ---------- 12. "Show changes" on Claude's replies ---------- */
const _thU=turnHTML;turnHTML=function(t,i,T){let h=_thU(t,i,T);if(t.who==="claude"&&t.changed&&t.changed.length)h=h.replace('<div class="tacts">',`<div class="tacts"><button class="btn sm" data-showchg="${i}" title="Select and highlight what changed">Show changes</button>`);return h};
document.addEventListener("click",e=>{const b=e.target.closest("[data-showchg]");if(!b||!cur())return;const t=turnsOf(cur().id)[+b.dataset.showchg];const ids=(t&&t.changed||[]).filter(id=>clipById(id));
  if(!ids.length){toast("CHANGES","Those clips have changed since.");return}E.sel=new Set(ids);E.flash=new Set(ids);setTimeout(()=>E.flash.clear(),2600);const first=ids.map(clipById).sort((a,b)=>a.start-b.start)[0];pause();seek(first.start);edTimeline();
  const sc=$("#tlscroll"),el=document.querySelector(`.eclip[data-clip="${CSS.escape(first.id)}"]`);if(sc&&el)sc.scrollLeft=Math.max(0,el.offsetLeft-LEFT-40)});

/* ---------- shared clicks ---------- */
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.uximport||b.id==="topImport"){if(cur())$("#fileIn").click();else{state.modal="new";render()}}
  else if(b.id==="topCreate")openCreate();else if(b.id==="topExport")openExport();
  else if(b.id==="mlist"){UX.mlist=!UX.mlist;saveUX();b.classList.toggle("on",UX.mlist);b.setAttribute("aria-pressed",UX.mlist);const g=$("#mgrid");if(g)g.classList.toggle("list",UX.mlist)}
  else if(b.dataset.fm==="history"){state.ttab="history";render()}});
document.addEventListener("click",e=>{if(e.target.closest("summary button,summary select,summary input"))e.preventDefault()},true);
