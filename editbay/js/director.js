/* Edit Bay — Create from prompt (after InVideo AI). Brief -> Claude watches the footage and writes a script + scene plan ->
   a finished, editable timeline: shots on the beat, transitions, a look, titles, karaoke captions from the script, music and an end card.
   Uses only the person's own media (real over invented). Then the Claude tab works like a command box for revisions. */
const DR={busy:false,prog:"",last:null};
function drModal(){const box=$("#modal");if(box.dataset.k==="create")return;box.dataset.k="create";const vm=projMedia().filter(m=>m.kind==="video"||m.kind==="image"),am=projMedia().filter(m=>m.kind==="audio"),o=DR.last||{};
  box.innerHTML=`<div class="ov" id="ov"><div class="dlg au create" role="dialog" aria-label="Create a video from a prompt"><h3>${ic("auto")} Create a video</h3>
  <div style="font-size:12px;color:var(--muted);margin-top:-4px">Describe the video. Claude watches your footage, writes the script and builds a full edit you can change afterwards. It uses only your clips and the facts you give it.</div>
  <div class="f"><label for="dr-brief">What’s the video?</label><textarea id="dr-brief" rows="4" placeholder="e.g. A 30-second hype video for our debut night, Dark Out, on 16 May at The Hidden Attic. Build from the empty room to a packed floor and end on the DJ. Tickets in bio.">${esc(o.brief||"")}</textarea></div>
  <div class="two"><div class="f"><label for="dr-plat">Platform</label><select id="dr-plat">${[["1080x1920","TikTok · Reels · Shorts (9:16)"],["1920x1080","YouTube (16:9)"],["1080x1350","Instagram feed (4:5)"],["1080x1080","Square (1:1)"]].map(([v,l])=>`<option value="${v}" ${(o.plat||"1080x1920")===v?"selected":""}>${l}</option>`).join("")}</select></div>
    <div class="f"><label for="dr-len">Length</label><select id="dr-len">${[15,30,45,60,90].map(v=>`<option value="${v}" ${(o.len||30)===v?"selected":""}>${v} s</option>`).join("")}</select></div></div>
  <div class="two"><div class="f"><label for="dr-tone">Tone</label><select id="dr-tone">${["Cinematic","Energetic","Documentary","Emotional","Minimal","Corporate"].map(v=>`<option ${(o.tone||"Cinematic")===v?"selected":""}>${v}</option>`).join("")}</select></div>
    <div class="f"><label for="dr-music">Music</label><select id="dr-music"><option value="">None</option>${am.map(m=>`<option value="${esc(m.id)}" ${o.music===m.id?"selected":""}>${esc(m.name)}</option>`).join("")}</select></div></div>
  <div class="f"><label>Footage</label>${vm.length?`<div class="aulist">${vm.map(m=>`<label><input type="checkbox" name="dr-src" value="${esc(m.id)}" ${!o.ids||o.ids.includes(m.id)?"checked":""}><span>${esc(m.name)}</span><em>${m.kind==="image"?"still":shortTC(m.dur||0,1)}</em></label>`).join("")}</div>`:`<div style="font-size:12px;color:var(--warn)">Import your clips first: Create uses your own footage, not stock.</div>`}</div>
  <div class="f"><label>Include</label><span class="chips"><label><input type="checkbox" id="dr-caps" ${o.caps!==false?"checked":""}> Captions from the script</label><label><input type="checkbox" id="dr-text" ${o.text!==false?"checked":""}> On-screen titles</label><label><input type="checkbox" id="dr-end" ${o.end!==false?"checked":""}> End card</label><label><input type="checkbox" id="dr-new" ${o.newp?"checked":""}> As a new project</label></span></div>
  <div class="auprog" id="drProg" hidden></div>
  <div class="acts"><button type="button" class="btn" id="drCancel">Cancel</button><button type="button" class="btn purple" id="drGo" ${vm.length?"":"disabled"}>Create video</button></div></div></div>`;setDrProg(DR.prog)}
function setDrProg(s){DR.prog=s;const p=$("#drProg");if(p){p.textContent=s;p.hidden=!s}const g=$("#drGo");if(g)g.disabled=!!s}
const _rm4=renderModal;renderModal=function(){if(state.modal==="create"){drModal();return}if($("#modal").dataset.k==="create")$("#modal").dataset.k="";_rm4()};
function openCreate(){if(!cur()){state.modal="new";render();toast("CREATE","Make a project and import your clips, then choose Create.");return}pause();E.x=null;state.modal="create";$("#modal").dataset.k="";render()}

async function runCreate(o){if(DR.busy)return;DR.busy=true;try{
  const S=await getSample();if(!S){setDrProg("");toast("CREATE",HOSTED?"Create needs Claude. Connect it in Help › Connect Claude with your own Claude API key. Auto Cut’s Quick mode works without it.":"Create needs Claude: open Edit Bay on claude.ai while signed in. Auto Cut’s Quick mode works without it.");return}
  const media=o.ids.map(mediaOf).filter(Boolean);const pool=[];for(let i=0;i<media.length;i++){setDrProg(`Watching ${media[i].name} (${i+1}/${media.length})…`);try{pool.push({m:media[i],an:await analyzeVideo(media[i])})}catch(e){}}
  if(!pool.length){toast("CREATE","Couldn’t read any of those clips.");return}
  let beats=null,music=o.music?mediaOf(o.music):null;if(music){setDrProg("Finding the beat…");try{beats=beatTimes(await decodeAudio(music))}catch(e){}}
  const imgs=[];if(sampleCaps&&sampleCaps.images){const max=Math.min(sampleCaps.images.maxCount||8,pool.length);for(let i=0;i<max;i++){const b=await contactSheet(pool[i].m,pool[i].an,i);if(b)imgs.push(b)}}
  const lib=pool.map(({m,an},i)=>({n:i,name:m.name,kind:m.kind,dur:+(an.dur||4).toFixed(2),mostAction:an.still?[]:an.score.map((s,k)=>[k*an.step,s]).sort((x,y)=>y[1]-x[1]).slice(0,5).map(x=>+x[0].toFixed(1))}));
  const[W,H]=o.plat.split("x").map(Number);setDrProg("Claude is writing the script and planning the scenes…");
  const prompt=`${ASSIST_RULES.split("Reply with ONLY")[0]}
You are directing a ${o.len}-second ${o.tone.toLowerCase()} video for ${W>H?"YouTube (16:9)":W===H?"a square feed":"vertical social (9:16)"} from the person's own footage. Brief:
"""${o.brief}"""
Footage library (n matches the "#n" label on each contact-sheet image; times printed on frames): ${JSON.stringify(lib)}
${beats?`Music beats (seconds): ${JSON.stringify(beats.filter(t=>t<=o.len+2).map(t=>+t.toFixed(2)).slice(0,160))}. Cut on beats.`:"No music: cut on the rhythm of the script."}
Write a short spoken-style script (it becomes the captions) and a scene plan. Open with a hook in the first 2 seconds, build, and end on the strongest image; set something up early and pay it off. On-screen text must only use facts stated in the brief (names, dates, places); never invent any. Total scene duration ≈ ${o.len} s. Prefer 1–3 s shots; vary wide and close.
Reply with ONLY JSON: {"title":"project title","say":"one sentence on the story","look":"teal|noir|film|night|bleach|matte|vivid|red|none","letterbox":0|2.39,
"script":[{"text":"caption line (≤ 8 words)","dur":seconds}],
"scenes":[{"n":libraryNumber,"in":secondsIntoClip,"dur":seconds,"text":"on-screen headline or empty","style":"bold|cinema|lower|neon|mono|basic","transition":"cut|dissolve|black|whip|flash|zoom|push"}],
"endcard":{"text":"short line from the brief","sub":"optional second line from the brief"}}`;
  const plan=await S.json(prompt,imgs.length?{images:imgs,modelTier:"default"}:{modelTier:"default"});if(!plan||!Array.isArray(plan.scenes)||!plan.scenes.length)throw Object.assign(new Error("plan"),{code:"invalid_json"});
  setDrProg("Building the timeline…");
  if(o.newp){const pid=uid("p");const np={id:pid,title:String(plan.title||"Created video").slice(0,80),client:"",kind:"Social video",stage:"voice",formats:[W>H?"16:9":W===H?"1:1":H/W>1.5?"9:16":"4:5"],fps:"30",length:o.len+" s",start:ymd(new Date()),due:"",folder:"",notes:o.brief,checklist:CHECK_GEN.map(t=>({t,done:false})),renders:[],log:[{id:uid("e"),at:nowISO(),who:"claude",type:"stage",stage:"voice",text:"Created from a prompt"}],createdAt:nowISO(),updatedAt:nowISO()};
    const map={};projMedia().forEach(m=>{const nid=uid("m");map[m.id]=nid;const doc=Object.assign(clone(m),{projectId:pid});delete doc.id;state.media.push(Object.assign({id:nid},doc));if(db)db.collection("media").doc(nid).set(doc).catch(saveErr)});
    pool.forEach(p=>{p.m=mediaOf(map[p.m.id])||p.m});if(music)music=mediaOf(map[music.id])||music;state.projects.push(np);persist(np);edCreateTimeline(pid,{w:W,h:H,fps:30});edSwitchProject(pid)}
  const snap=(t)=>{if(!beats||!beats.length)return t;let b=beats[0];for(const x of beats)if(Math.abs(x-t)<Math.abs(b-t))b=x;return Math.abs(b-t)<.35?b:t};
  E.by="claude";pushUndo();const tl=getTL();tl.w=W;tl.h=H;const oldV1=new Set(v1().map(c=>c.id));tl.clips=tl.clips.filter(c=>!oldV1.has(c.id)&&!(c.link&&oldV1.has(c.link)));
  const l=[];let t=0;plan.scenes.forEach((s,i)=>{const p=pool[clamp(s.n|0,0,pool.length-1)];let d=Math.max(.5,+s.dur||2);const end=snap(t+d);if(end-t>.4)d=end-t;
    const c=newClip(p.m,"V1",0);c.by="claude";c.fit="fill";c.vol=music?0:c.vol;if(p.m.kind==="image"){c.in=0;c.out=d;c.kb=true}else{const mx=Math.max(0,(p.an.dur||d)-d);c.in=clamp(+s.in||0,0,mx);c.out=c.in+Math.min(d,p.an.dur||d)}
    const tr=s.transition&&s.transition!=="cut"&&TRANS.find(x=>x[0]===s.transition);if(tr&&i>0)c.tr={type:s.transition,d:Math.min(.5,cdur(c)/2)};if(i===0)c.fadeIn=.2;
    if(plan.look&&LOOKS[plan.look]&&plan.look!=="none"){Object.assign(c,clone(LOOKS[plan.look][1]));c.look=plan.look}l.push(c);tl.clips.push(c);t+=cdur(c)});
  repack(l);let total=t;
  if(o.text)l.forEach((c,i)=>{const s=plan.scenes[i];if(!s||!s.text)return;const ti=newTitle(c.start);Object.assign(ti,clone(TPRESETS[s.style]||TPRESETS.bold),{text:String(s.text).slice(0,60),out:Math.max(.8,cdur(c)-.1),by:"claude",track:"V2"});tl.clips.push(ti);relink(ti)});
  if(o.caps&&Array.isArray(plan.script)){let ct=.15;plan.script.forEach(line=>{const d=Math.max(.6,+line.dur||1.5);if(ct>=total-.2)return;const cap=newTitle(ct);Object.assign(cap,clone(TPRESETS.caption),{track:"V3",text:String(line.text||"").slice(0,80),out:Math.min(d,total-ct),by:"claude",name:"Caption",fadeIn:0,fadeOut:0});tl.clips.push(cap);ct+=d})}
  if(o.end&&plan.endcard&&plan.endcard.text){const last=l[l.length-1];const ec=newTitle(Math.max(0,total-2.4));Object.assign(ec,clone(TPRESETS.cinema),{track:"V2",text:String(plan.endcard.text).slice(0,60)+(plan.endcard.sub?"\n"+String(plan.endcard.sub).slice(0,60):""),out:2.4,by:"claude",box:true,boxColor:"#000000",boxOp:.35});tl.clips.push(ec);relink(ec);if(last)last.fadeOut=.6}
  if(music){const mu=newClip(music,"A2",0);mu.out=Math.min(music.dur||total,total);mu.fadeOut=Math.min(1.5,total/6);mu.by="claude";tl.clips=tl.clips.filter(c=>c.mediaId!==music.id||c.track!=="A2");tl.clips.push(mu);relink(mu)}
  tl.bars=plan.letterbox>1?+plan.letterbox:0;tl.note=String(plan.say||"Created from your prompt").slice(0,200);normalize();commit();E.by="joe";E.t=0;edViewerKey="";
  E.flash=new Set(tl.clips.map(c=>c.id));setTimeout(()=>E.flash.clear(),2600);state.modal=null;state.itab="claude";render();
  E.asLog.push({who:"",text:"Created: "+(plan.say||"a first cut from your prompt")+" Ask for changes here, e.g. “make it shorter”, “punchier captions”, “swap the second shot”."});refreshAssist();
  toast("VIDEO CREATED",`${l.length} shots · ${total.toFixed(1)} s. ⌘Z undoes it. Ask Claude in the Inspector to revise.`);addLog(cur().id,{who:"claude",text:"Created from prompt: "+(plan.say||o.brief.slice(0,80))})}
  catch(e){const c=e&&e.code;toast("CREATE",c==="not_granted"?"Claude wasn’t allowed. You can allow it from this page’s Permissions menu.":c==="rate_limited"?"You’ve hit a usage limit. Try again later.":c==="invalid_json"?"Claude’s plan couldn’t be read. Try again or shorten the brief.":"Create didn’t finish ("+(c||(e&&e.message)||"error")+").")}
  finally{DR.busy=false;setDrProg("")}}
document.addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;
  if(t.id==="createBtn"||t.dataset.create)openCreate();
  else if(t.id==="drCancel"){if(DR.busy)return;state.modal=null;$("#modal").dataset.k="";render()}
  else if(t.id==="drGo"){const q=n=>[...document.querySelectorAll(`input[name="${n}"]`)];DR.last={brief:$("#dr-brief").value.trim(),plat:$("#dr-plat").value,len:+$("#dr-len").value,tone:$("#dr-tone").value,music:$("#dr-music").value,ids:q("dr-src").filter(x=>x.checked).map(x=>x.value),caps:$("#dr-caps").checked,text:$("#dr-text").checked,end:$("#dr-end").checked,newp:$("#dr-new").checked};
    if(!DR.last.brief){$("#dr-brief").focus();return}if(!DR.last.ids.length){toast("CREATE","Pick at least one clip.");return}runCreate(DR.last)}});
/* command-box suggestions in the Claude tab, InVideo style */
const _ap=assistPanel;assistPanel=function(){_ap();const s=document.querySelector("#assist .sugs");if(s&&!s.dataset.dr){s.dataset.dr=1;s.innerHTML=["Make it 15 seconds","Punchier captions","Stronger hook in the first 2 s","More cinematic","Swap the weakest shot","End on the best moment"].map(x=>`<button type="button" data-sug="${esc(x)}">${esc(x)}</button>`).join("")}};
