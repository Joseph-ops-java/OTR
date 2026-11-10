/* Edit Bay — Source viewer and three-point editing (after Premiere's source monitor and FCP's browser ranges), match frame,
   and transcript-based editing (import .srt/.vtt/word JSON, cut by deleting text, remove filler words). */
E.marks={};E.src=null;E.srcDest={v:"V1",a:"A1"};

/* ---------- source viewer ---------- */
const _modeSeg=modeSeg;modeSeg=function(){return _modeSeg().replace('<button data-vmode="timeline"',`<button data-vmode="source" aria-pressed="${state.vmode==="source"}">Source</button><button data-vmode="timeline"`)};
function openSource(id,at){const m=mediaOf(id);if(!m)return;const t0=at!=null?at:((E.marks[id]||{}).in)||0;const old=srcEl();if(old&&old.dataset.m===id&&old.tagName!=="IMG"){old.pause();old.currentTime=t0}E.src={mediaId:id,t:t0};state.vmode="source";pause();renderViewer();E.src.t=t0;updSrc()}
const _rv2=renderViewer;renderViewer=function(){if(cur()&&state.vmode==="source")return renderSource();_rv2()};
function renderSource(){const p=cur(),s=E.src,m=s&&mediaOf(s.mediaId);
  if(!m){$("#vName").innerHTML=`<b>Source</b>`;$("#vMeta").textContent="";$("#vArea").innerHTML=`<div class="empty" style="text-align:center">Double-click a clip in the Browser to open it here,<br>mark In (I) and Out (O), then insert (W), overwrite (D), append (E) or connect (Q).</div>`;$("#transport").innerHTML=modeSeg();return}
  const mk=E.marks[m.id]||{},dur=m.kind==="image"?4:(m.dur||0),vis=m.kind!=="audio";
  $("#vName").innerHTML=`<b>${esc(m.name)}</b> <span style="color:var(--dim)">· Source</span>`;$("#vMeta").textContent=[m.w&&m.h?m.w+"×"+m.h:"",m.kind].filter(Boolean).join(" · ");
  if(!$("#srcv")||$("#srcv").dataset.m!==m.id){
    $("#vArea").innerHTML=m.kind==="image"?`<div class="srcbox"><img id="srcv" data-m="${esc(m.id)}" src="${esc(blobUrl(m))}" alt=""></div>`:`<div class="srcbox ${vis?"":"aud"}"><${m.kind==="audio"?"audio":"video"} id="srcv" data-m="${esc(m.id)}" src="${esc(playUrl(m))}" playsinline preload="auto"></${m.kind==="audio"?"audio":"video"}>${vis?"":`<div class="srcwave" style="background-image:url('${(TH[m.id]||{}).wave||""}')"></div>`}</div>`;
    const v=$("#srcv");if(v.tagName!=="IMG"){v.addEventListener("loadedmetadata",()=>{v.currentTime=s.t||0});v.addEventListener("timeupdate",updSrc);v.addEventListener("play",updSrc);v.addEventListener("pause",updSrc);v.addEventListener("click",()=>v.paused?v.play().catch(()=>{}):v.pause())}}
  const dv=m.kind==="audio"?"a":"v",opts=dv==="a"?["A1","A2","A3"]:["V1","V2","V3"];
  $("#transport").innerHTML=`${modeSeg()}<button class="tbtn play" id="sPlay" aria-label="Play">${ic("play")}</button><span class="tc-s" id="sNow">${tcs(s.t||0)}</span>
    <div class="grow srcbar" id="srcbar"><div class="rg" id="srcrg"></div><input type="range" id="sScrub" min="0" max="1000" value="0" aria-label="Scrub source"></div><span class="tc-s" style="color:var(--muted)">${tcs(dur)}</span>
    <button class="ib" data-smk="i" title="Mark In (I)">In</button><button class="ib" data-smk="o" title="Mark Out (O)">Out</button>
    <select class="vsel" id="srcDest" title="Destination track" aria-label="Destination track">${opts.map(o=>`<option ${E.srcDest[dv]===o?"selected":""}>${o}</option>`).join("")}</select>
    <span class="seg"><button data-sedit="insert" title="Insert at the playhead (W)">Insert</button><button data-sedit="overwrite" title="Overwrite at the playhead (D)">Overwrite</button><button data-sedit="append" title="Append to the end (E)">Append</button><button data-sedit="connect" title="Connect above or below the storyline (Q)">Connect</button></span>`;
  updSrc()}
function srcEl(){return $("#srcv")}
function updSrc(){const s=E.src;if(!s)return;const m=mediaOf(s.mediaId);if(!m)return;const v=srcEl(),dur=m.kind==="image"?4:(m.dur||1);if(v&&v.tagName!=="IMG")s.t=v.currentTime;const mk=E.marks[m.id]||{};
  const n=$("#sNow");if(n)n.textContent=tcs(s.t||0);const sc=$("#sScrub");if(sc&&document.activeElement!==sc)sc.value=Math.round((s.t||0)/dur*1000);
  const rg=$("#srcrg");if(rg){const a=mk.in!=null?mk.in:0,b=mk.out!=null?mk.out:dur;rg.style.left=(a/dur*100)+"%";rg.style.width=(Math.max(0,b-a)/dur*100)+"%";rg.hidden=mk.in==null&&mk.out==null}
  const pb=$("#sPlay");if(pb&&v&&v.tagName!=="IMG")pb.innerHTML=ic(v.paused?"play":"pause");
  const dz=$("#srcDur");if(dz)dz.textContent=mk.in!=null||mk.out!=null?tcs((mk.out!=null?mk.out:dur)-(mk.in||0)):""}
function markSrc(k){const s=E.src;if(!s)return;const m=mediaOf(s.mediaId),dur=m.kind==="image"?4:(m.dur||0);const mk=E.marks[m.id]=E.marks[m.id]||{};const t=clamp(s.t||0,0,dur);
  if(k==="i"){mk.in=t;if(mk.out!=null&&mk.out<=t)delete mk.out}else if(k==="o"){mk.out=t;if(mk.in!=null&&mk.in>=t)delete mk.in}else{delete mk.in;delete mk.out}updSrc()}
function srcRange(m){const mk=E.marks[m.id]||{},dur=m.kind==="image"?4:(m.dur||5);return[mk.in||0,mk.out!=null?mk.out:dur]}
/* clips made from the Browser respect the source In/Out */
const _newClip=newClip;newClip=function(m,track,start){const c=_newClip(m,track,start);if(m&&m.kind!=="image"&&E.marks[m.id]&&(E.marks[m.id].in!=null||E.marks[m.id].out!=null)){const[a,b]=srcRange(m);c.in=a;c.out=b}return c};
function clearRange(tl,tr,a,b,keep){/* remove everything on a track between a and b (splitting at the edges) */tl.clips.filter(c=>c.track===tr&&c!==keep&&c.start<b-1e-6&&cend(c)>a+1e-6).forEach(c=>{if(c.start<a-1e-6&&cend(c)>a+1e-6)splitClip(c,a)});
  tl.clips.filter(c=>c.track===tr&&c!==keep&&c.start<b-1e-6&&cend(c)>b+1e-6).forEach(c=>splitClip(c,b));tl.clips=tl.clips.filter(c=>!(c.track===tr&&c!==keep&&c.start>=a-1e-6&&cend(c)<=b+1e-6))}
function srcEdit(kind){const s=E.src;if(!s||!getTL())return;const m=mediaOf(s.mediaId);if(!m)return;const dv=m.kind==="audio"?"a":"v",tr=E.srcDest[dv],at=E.t;
  if(kind==="append"&&tr==="V1"){placeMedia(m.id,"V1",tlDur()+1e3);toast("APPENDED",m.name);return}
  edit(tl=>{const c=newClip(m,tr,at);const d=cdur(c);
    if(tr==="V1"){const under=v1().find(x=>at>x.start+1e-6&&at<cend(x)-1e-6);
      if(kind==="overwrite"){if(under)splitClip(under,at);const end=at+d;const l2=v1().find(x=>end>x.start+1e-6&&end<cend(x)-1e-6);if(l2)splitClip(l2,end);
        const gone=new Set(v1().filter(x=>x.start>=at-1e-6&&cend(x)<=end+1e-6).map(x=>x.id));tl.clips=tl.clips.filter(x=>!gone.has(x.id));}
      else if(under)splitClip(under,at);
      const l=v1();const b=boundaryNear(at);l.splice(b.i,0,c);tl.clips.push(c);repack(l)}
    else{if(kind==="append")c.start=Math.max(at,...tl.clips.filter(x=>x.track===tr).map(cend),0);if(kind==="overwrite"||kind==="insert"||kind==="append")clearRange(tl,tr,c.start,c.start+d);tl.clips.push(c);relink(c)}
    E.sel=new Set([c.id])});
  E.t=at+(kind==="connect"?0:0);toast(kind.toUpperCase(),`${m.name} → ${tr} at ${tcs(at)}`)}
function matchFrame(){if(!E.tl)return;const t=E.t;const c=selClips().find(x=>x.mediaId&&t>=x.start&&t<cend(x))||[...E.tl.clips].filter(x=>x.mediaId&&!x.off&&t>=x.start&&t<cend(x)).sort((a,b)=>TRACKS.indexOf(a.track)-TRACKS.indexOf(b.track))[0];
  if(!c){toast("MATCH FRAME","No clip under the playhead.");return}E.marks[c.mediaId]={in:Math.min(c.in,c.out),out:Math.max(c.in,c.out)};openSource(c.mediaId,srcTime(c,t))}
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.id==="sPlay"){const v=srcEl();if(v&&v.tagName!=="IMG")v.paused?v.play().catch(()=>{}):v.pause()}
  else if(b.dataset.smk)markSrc(b.dataset.smk);else if(b.dataset.sedit)srcEdit(b.dataset.sedit)});
document.addEventListener("input",e=>{if(e.target.id!=="sScrub")return;const s=E.src,m=s&&mediaOf(s.mediaId),v=srcEl();if(!m||!v||v.tagName==="IMG")return;v.currentTime=e.target.value/1000*(m.dur||0);updSrc()});
document.addEventListener("change",e=>{if(e.target.id==="srcDest"){const m=E.src&&mediaOf(E.src.mediaId);if(m)E.srcDest[m.kind==="audio"?"a":"v"]=e.target.value}});
/* source-viewer keys take over while the Source tab is showing */
document.addEventListener("keydown",e=>{if(typing(e.target)||state.modal||e.metaKey||e.ctrlKey)return;const k=e.key;
  if((k==="f"||k==="F")&&!e.altKey&&state.vmode!=="source"&&E.tl){e.preventDefault();e.stopImmediatePropagation();matchFrame();return}
  if(state.vmode!=="source"||!E.src)return;const v=srcEl(),media=v&&v.tagName!=="IMG",fps=fpsOf();let used=true;
  if(k===" "||k==="k"||k==="K"){if(media){if(k===" ")v.paused?v.play().catch(()=>{}):v.pause();else v.pause()}}
  else if(k==="l"||k==="L"){if(media){if(v.paused){v.playbackRate=1;v.play().catch(()=>{})}else v.playbackRate=Math.min(8,v.playbackRate*2)}}
  else if(k==="j"||k==="J"){if(media){v.pause();v.currentTime=Math.max(0,v.currentTime-1)}}
  else if(k==="ArrowLeft"||k==="ArrowRight"){if(media){v.pause();v.currentTime=Math.max(0,v.currentTime+(k==="ArrowRight"?1:-1)*(e.shiftKey?10:1)/fps)}}
  else if(k==="i"||k==="I")markSrc("i");else if(k==="o"||k==="O")markSrc("o");else if(e.altKey&&e.code==="KeyX")markSrc("x");
  else if(k==="w"||k==="W")srcEdit("insert");else if(k==="d"||k==="D")srcEdit("overwrite");else if(k==="e"||k==="E")srcEdit("append");else if(k==="q"||k==="Q")srcEdit("connect");
  else used=false;if(used){e.preventDefault();e.stopImmediatePropagation();setTimeout(updSrc,30)}},true);

/* ---------- transcripts and text-based editing ---------- */
const FILLERS=new Set(["um","umm","uh","uhh","er","erm","ah","hmm","mm","mhm"]);
function parseTranscript(txt,name){txt=txt.replace(/\r/g,"");if(/\.json$/i.test(name)||/^\s*[\[{]/.test(txt)){const j=JSON.parse(txt);const ws=(j.words||(j.segments||[]).flatMap(s=>s.words||[])||[]);
    if(ws.length){const ms=ws.some(w=>(w.end||0)>100000)||(j.audio_duration&&ws[ws.length-1].end>j.audio_duration*10);return{words:ws.map(w=>({s:(w.start??w.s)/(ms?1000:1),e:(w.end??w.e)/(ms?1000:1),t:String(w.text??w.word??"").trim()})).filter(w=>w.t)}}
    const segs=j.segments||j.utterances||[];if(segs.length)return{lines:segs.map(s=>({s:+s.start/(s.start>100000?1000:1),e:+s.end/(s.end>100000?1000:1),t:String(s.text).trim()}))}}
  const ts=x=>{const m=x.trim().replace(",",".").match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/);return m?(+(m[1]||0))*3600+(+m[2])*60+(+m[3]):null};const lines=[];
  txt.split(/\n\n+/).forEach(b=>{const L=b.split("\n").filter(Boolean);const i=L.findIndex(l=>l.includes("-->"));if(i<0)return;const[a,z]=L[i].split("-->");const s=ts(a),e=ts(z.split(" ").filter(Boolean)[0]);const t=L.slice(i+1).join(" ").replace(/<[^>]+>/g,"").trim();if(s!=null&&e>s&&t)lines.push({s,e,t})});return{lines}}
const txIn=document.createElement("input");txIn.type="file";txIn.accept=".srt,.vtt,.json";txIn.className="sr";document.body.appendChild(txIn);let txFor=null;
txIn.addEventListener("change",async()=>{const f=txIn.files&&txIn.files[0];txIn.value="";const m=mediaOf(txFor);if(!f||!m)return;try{const tx=parseTranscript(await f.text(),f.name);if(!(tx.words||tx.lines||[]).length)throw 0;
  m.tx=tx;if(db)await db.doc("media/"+m.id).update({tx}).catch(saveErr);toast("TRANSCRIPT",`${(tx.words||tx.lines).length} ${tx.words?"words":"lines"} attached to ${m.name}. Edit it in Browser › Timeline › Text.`);state.ixtab="text";state.btab="index";renderBrowser()}
  catch(e){toast("TRANSCRIPT","Couldn’t read that file. Use .srt, .vtt, or word-level JSON (Whisper, AssemblyAI, Deepgram).")}});
/* units on the timeline: transcript pieces mapped through every clip that uses the media */
function txUnits(){if(!E.tl)return[];const out=[];E.tl.clips.filter(c=>c.mediaId&&!c.off&&(c.track==="V1"||c.type==="audio")).forEach(c=>{const m=mediaOf(c.mediaId);if(!m||!m.tx)return;const sp=c.speed||1,lo=Math.min(c.in,c.out),hi=Math.max(c.in,c.out);
  (m.tx.words||m.tx.lines).forEach(u=>{if(u.e<=lo||u.s>=hi||c.reverse||c.ramp)return;const a=c.start+(Math.max(u.s,lo)-c.in)/sp,b=c.start+(Math.min(u.e,hi)-c.in)/sp;if(b-a>.02)out.push({a,b,t:u.t,c:c.id,word:!!m.tx.words,track:c.track})})});
  return out.sort((x,y)=>x.a-y.a)}
function cutRanges(ranges){if(!ranges.length||!E.tl)return 0;let total=0;edit(tl=>{total=cutRangesRaw(tl,ranges)});return total}
/* ripple-delete timeline ranges from the storyline (and anything connected inside them) */
function cutRangesRaw(tl,ranges){const rs=ranges.slice().sort((a,b)=>b[0]-a[0]);let total=0;{rs.forEach(([a,b])=>{if(b-a<1/fpsOf())return;const s1=v1().find(x=>a>x.start+1e-6&&a<cend(x)-1e-6);if(s1)splitClip(s1,a);const s2=v1().find(x=>b>x.start+1e-6&&b<cend(x)-1e-6);if(s2)splitClip(s2,b);
    const gone=new Set(v1().filter(x=>x.start>=a-1e-6&&cend(x)<=b+1e-6).map(x=>x.id));total+=b-a;tl.clips=tl.clips.filter(x=>!gone.has(x.id)&&!(x.link&&gone.has(x.link)&&x.start>=a-1e-6&&cend(x)<=b+1e-6));repack()})}return total}
E.txSel=new Set();E.txQ="";
function renderText(body){const units=txUnits();const key="text|"+E.pid;if(body.dataset.k!==key){body.dataset.k=key;
    body.innerHTML=`<div class="txbar"><input id="txQ" placeholder="Search the transcript" autocomplete="off" aria-label="Search transcript"><button class="btn sm" data-txcut="1" title="Cut the selected text from the timeline">Cut selected</button><button class="btn sm" data-txfill="1" title="Remove um, uh and similar (needs word timings)">Remove fillers</button><button class="btn sm" data-txadd="1" title="Attach a transcript to a clip in this project">Add transcript</button></div><div class="txlist" id="txlist"></div>`}
  const q=E.txQ.toLowerCase();const L=$("#txlist");if(!L)return;
  if(!units.length){L.innerHTML=`<div class="empty" style="font-size:12px">No transcript yet. Add one with <b>Add transcript</b> (.srt, .vtt, or word-level JSON from Whisper, AssemblyAI or Deepgram). Then select text and cut it, and Claude Assist can edit by what people say.</div>`;return}
  L.innerHTML=units.map((u,i)=>`<span class="tx${E.txSel.has(i)?" on":""}${q&&u.t.toLowerCase().includes(q)?" hit":""}${E.t>=u.a&&E.t<u.b?" now":""}${u.word?"":" line"}" data-txi="${i}" title="${tcs(u.a)}">${esc(u.t)}</span>`).join(" ")}
const _ri=renderIndex;renderIndex=function(){_ri();const t=$("#ixtabs");if(t&&!t.querySelector('[data-ixtab="text"]'))t.insertAdjacentHTML("beforeend",`<button data-ixtab="text" aria-pressed="${state.ixtab==="text"}">Text</button>`);
  if(state.ixtab==="text"&&cur()){t.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.ixtab==="text"));renderText($("#ixbody"))}};
const _edIndex=edIndex;edIndex=function(body){if(state.ixtab==="text")return renderText(body);_edIndex(body)};
document.addEventListener("click",e=>{const x=e.target.closest("[data-txi]");if(x){const i=+x.dataset.txi,u=txUnits()[i];if(!u)return;
    if(e.shiftKey&&E.txLast!=null){const[a,b]=[Math.min(E.txLast,i),Math.max(E.txLast,i)];for(let k=a;k<=b;k++)E.txSel.add(k)}else if(e.metaKey||e.ctrlKey){E.txSel.has(i)?E.txSel.delete(i):E.txSel.add(i)}else{E.txSel=new Set([i]);pause();seek(u.a)}
    E.txLast=i;renderText($("#ixbody"));return}
  const b=e.target.closest("button");if(!b)return;
  if(b.dataset.txcut){const u=txUnits();const rs=[...E.txSel].map(i=>u[i]).filter(Boolean).map(x=>[x.a,x.b]);E.txSel.clear();const s=cutRanges(merge(rs));if(s)toast("CUT FROM TEXT",s.toFixed(2)+" s removed. ⌘Z brings it back.");$("#ixbody").dataset.k="";renderIndex()}
  else if(b.dataset.txfill){const u=txUnits().filter(x=>x.word&&FILLERS.has(x.t.toLowerCase().replace(/[^a-z]/g,"")));if(!u.length){toast("FILLERS","No filler words found (this needs a word-level transcript).");return}const s=cutRanges(merge(u.map(x=>[x.a,x.b])));toast("FILLERS REMOVED",u.length+" filler words, "+s.toFixed(2)+" s.");$("#ixbody").dataset.k="";renderIndex()}
  else if(b.dataset.txadd){const ms=projMedia().filter(m=>m.kind!=="image");const sel=selClips()[0];txFor=(sel&&sel.mediaId)||(E.src&&E.src.mediaId)||(ms[0]&&ms[0].id);if(!txFor){toast("TRANSCRIPT","Import the clip first.");return}toast("TRANSCRIPT","Choose the transcript for "+mediaOf(txFor).name+". Select a clip first to attach it to a different one.");txIn.click()}});
document.addEventListener("input",e=>{if(e.target.id==="txQ"){E.txQ=e.target.value;renderText($("#ixbody"))}});
document.addEventListener("keydown",e=>{if(state.ixtab==="text"&&E.txSel.size&&(e.key==="Delete"||e.key==="Backspace")&&!typing(e.target)){e.preventDefault();e.stopImmediatePropagation();const b=document.querySelector("[data-txcut]");b&&b.click()}},true);
function merge(rs){rs=rs.slice().sort((a,b)=>a[0]-b[0]);const o=[];rs.forEach(r=>{const l=o[o.length-1];if(l&&r[0]<=l[1]+.02)l[1]=Math.max(l[1],r[1]);else o.push([...r])});return o}
/* the media browser: double-click opens the Source viewer; a transcript action on each clip */
/* the Browser re-renders on the first click, so detect a double-click from two quick clicks on the same clip */
let lastMedia={id:null,t:0};document.addEventListener("click",e=>{const m=e.target.closest&&e.target.closest("[data-media]");if(!m||e.target.closest("[data-delmedia],[data-proxy],[data-optimize],[data-relink]"))return;const id=m.dataset.media,now=performance.now();
  if(id!=="__title"&&lastMedia.id===id&&now-lastMedia.t<450){lastMedia={id:null,t:0};setTimeout(()=>openSource(id),0);return}lastMedia={id,t:now}},true);
document.addEventListener("dblclick",e=>{if(e.target.closest&&e.target.closest("[data-media]"))e.stopImmediatePropagation()},true);
setInterval(()=>{if(state.ixtab==="text"&&E.playing){const L=$("#txlist");if(!L)return;const u=txUnits();L.querySelectorAll(".tx").forEach((s,i)=>{const on=u[i]&&E.t>=u[i].a&&E.t<u[i].b;s.classList.toggle("now",on);if(on&&!s.dataset.sc){s.scrollIntoView({block:"nearest"})}})}},200);
