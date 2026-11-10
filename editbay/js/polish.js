/* Edit Bay — editor ergonomics: reverse playback on J (J again = faster), typed frame nudges (+12 / -5 then Enter),
   and resizable panels (remembered per browser). */
/* ---------- J: play backwards ---------- */
E.rev=false;
function playRev(){if(!E.tl)return;if(E.playing&&E.rev){E.revRate=Math.min(8,(E.revRate||1)*2);return}pause();E.rev=true;E.revRate=1;E.playing=true;E.last=performance.now();recs.forEach(r=>{try{r.el.pause()}catch(e){}});requestDraw();updPlayBtn()}
const _pause=pause;pause=function(){E.rev=false;E.revRate=1;_pause()};
const _loop=loop;loop=function(now){if(E.rev&&E.playing&&!E.rendering){E.raf=0;const dt=Math.min(.25,(now-E.last)/1000);E.last=now;E.t=Math.max(0,E.t-dt*(E.revRate||1));
    const keep=E.playing;E.playing=false;sync();E.playing=keep;drawFrame();updPlayheadUI();if(E.t<=0){pause();return}E.raf=requestAnimationFrame(loop);return}return _loop(now)};
document.addEventListener("keydown",e=>{if(typing(e.target)||state.modal||e.metaKey||e.ctrlKey||e.altKey||state.vmode==="source")return;
  if(e.key==="j"||e.key==="J"){e.preventDefault();e.stopImmediatePropagation();playRev()}
  else if((e.key==="l"||e.key==="L"||e.key===" ")&&E.rev){e.preventDefault();e.stopImmediatePropagation();pause();if(e.key!==" ")play()}},true);

/* ---------- typed nudges: +n / -n frames, Enter to apply ---------- */
E.nudge="";
function showNudge(){const d=$("#dashTc");if(!d)return;if(E.nudge){d.textContent=E.nudge;d.classList.add("nudge")}else{d.classList.remove("nudge");d.textContent=tcs(E.t)}}
document.addEventListener("keydown",e=>{if(typing(e.target)||state.modal||e.metaKey||e.ctrlKey||!cur())return;const k=e.key;
  if(!E.nudge&&(k==="+"||k==="-"||k==="="&&e.shiftKey)){if(k==="-"&&!E.sel.size&&false)return;E.nudge=k==="-"?"-":"+";e.preventDefault();e.stopImmediatePropagation();showNudge();return}
  if(!E.nudge)return;e.preventDefault();e.stopImmediatePropagation();
  if(/^[0-9]$/.test(k)){E.nudge+=k;showNudge()}else if(k==="Backspace"){E.nudge=E.nudge.slice(0,-1);showNudge()}else if(k==="Escape"){E.nudge="";showNudge()}
  else if(k==="Enter"){const n=parseInt(E.nudge.slice(1)||"0",10)*(E.nudge[0]==="-"?-1:1);E.nudge="";showNudge();if(!n)return;const df=n/fpsOf();const cs=selClips();
    if(!cs.length){pause();seek(E.t+df);toast("NUDGE",(n>0?"+":"")+n+" frames");return}
    edit(()=>cs.forEach(c=>{if(c.track==="V1"){if(isStill(c))c.out=Math.max(c.in+FR(),c.out+df);else{const m=mediaOf(c.mediaId);c.out=clamp(c.out+df*(c.speed||1),c.in+FR(),(m&&m.dur)||c.out+df)}}else c.start=Math.max(0,c.start+df)}));
    toast("NUDGE",`${cs.length} clip${cs.length>1?"s":""} ${cs.some(c=>c.track==="V1")?"trimmed":"moved"} ${n>0?"+":""}${n} frames`)}},true);

/* ---------- resizable panels ---------- */
const LAY_KEY="editbay.layout";let LAYOUT={top:56,left:30,right:310};try{Object.assign(LAYOUT,JSON.parse(localStorage.getItem(LAY_KEY)||"{}"))}catch(e){}
function applyLayout(){const app=$(".app"),top=$(".top");if(window.innerWidth<=1100)return;app.style.gridTemplateRows=`36px minmax(0,${LAYOUT.top}fr) 42px minmax(0,${100-LAYOUT.top}fr) 32px`;top.style.gridTemplateColumns=`minmax(220px,${LAYOUT.left}%) minmax(0,1fr) ${LAYOUT.right}px`}
function saveLayout(){try{localStorage.setItem(LAY_KEY,JSON.stringify(LAYOUT))}catch(e){}}
(function(){const top=$(".top");["l","r"].forEach(s=>{const h=document.createElement("div");h.className="vsplit "+s;h.title="Drag to resize";h.setAttribute("aria-hidden","true");top.appendChild(h);
    h.addEventListener("pointerdown",e=>{h.setPointerCapture(e.pointerId);const r=top.getBoundingClientRect();const mv=ev=>{if(s==="l")LAYOUT.left=clamp((ev.clientX-r.left)/r.width*100,15,50);else LAYOUT.right=clamp(r.right-ev.clientX,240,560);applyLayout();placeSplits()};
      const up=()=>{h.removeEventListener("pointermove",mv);h.removeEventListener("pointerup",up);saveLayout();edViewerKey="";renderViewer();if(state.ttab==="edit")edTimeline()};h.addEventListener("pointermove",mv);h.addEventListener("pointerup",up)})});
  const t=$(".tools");const hs=document.createElement("div");hs.className="hsplit";hs.title="Drag to resize the timeline";hs.setAttribute("aria-hidden","true");t.appendChild(hs);
  hs.addEventListener("pointerdown",e=>{hs.setPointerCapture(e.pointerId);const app=$(".app").getBoundingClientRect();const mv=ev=>{LAYOUT.top=clamp((ev.clientY-app.top-36)/(app.height-36-42-32)*100,25,80);applyLayout()};
    const up=()=>{hs.removeEventListener("pointermove",mv);hs.removeEventListener("pointerup",up);saveLayout();edViewerKey="";renderViewer();if(state.ttab==="edit")edTimeline()};hs.addEventListener("pointermove",mv);hs.addEventListener("pointerup",up)});
  applyLayout();placeSplits();window.addEventListener("resize",()=>{applyLayout();placeSplits()})})();
function placeSplits(){const top=$(".top");if(!top)return;const ps=top.querySelectorAll(":scope > .pane");if(ps.length<3)return;const r=top.getBoundingClientRect();
  const l=top.querySelector(".vsplit.l"),rr=top.querySelector(".vsplit.r");if(l)l.style.left=(ps[0].getBoundingClientRect().right-r.left-3)+"px";if(rr)rr.style.left=(ps[2].getBoundingClientRect().left-r.left-3)+"px"}
