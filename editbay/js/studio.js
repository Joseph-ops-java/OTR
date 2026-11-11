/* Edit Bay — studio helpers for the AI: a description of the sound (so the AI can edit by ear without hearing),
   sound checks for Review, ducking by actual speech, Finish my video, controls in the Score window, chat suggestions
   for the audio features, and find-and-replace across captions. */

/* ---------- 1. what the edit sounds like, in words and numbers ---------- */
const AUD={};
async function analyzeAudio(m){if(AUD[m.id])return AUD[m.id];const ab=await decodeAudio(m);const env=envelope(ab,20);/* dB every 50 ms */
  let peak=-90,sum=0,n=0;const ch=ab.getChannelData(0);for(let i=0;i<ch.length;i+=3){const a=Math.abs(ch[i]);if(a>peak)peak=a}peak=20*Math.log10(1e-6+peak);
  const sorted=Array.from(env).sort((a,b)=>a-b);const loud=sorted[Math.floor(sorted.length*.9)]||-60;const thr=Math.max(-50,loud-24);
  const seg=[];let st=null;for(let i=0;i<env.length;i++){const on=env[i]>thr;if(on){sum+=env[i];n++}if(on&&st==null)st=i/20;if(!on&&st!=null){seg.push([st,i/20]);st=null}}if(st!=null)seg.push([st,env.length/20]);
  /* join sounds less than 0.3 s apart, drop blips under 0.12 s */
  const sound=[];seg.forEach(s=>{const l=sound[sound.length-1];if(l&&s[0]-l[1]<.3)l[1]=s[1];else sound.push(s.slice())});
  return AUD[m.id]={dur:ab.duration,peak:+peak.toFixed(1),level:+(n?sum/n:-60).toFixed(1),sound:sound.filter(s=>s[1]-s[0]>=.12),ab}}
const r2=v=>+(+v).toFixed(2);
function clipGainDb(c){const g=(c.vol==null?1:c.vol)*busGain(c.track);return g>0?20*Math.log10(g):-90}
async function audioMap(){const tl=E.tl;if(!tl)return null;const clips=tl.clips.filter(c=>c.mediaId&&!c.off&&(c.type==="video"||c.type==="audio")&&!c.freeze&&clipGainDb(c)>-60);const out=[],musicBeats=[];
  const media=[...new Set(clips.map(c=>c.mediaId))].map(mediaOf).filter(m=>m&&m.kind!=="image"&&(m.dur||0)<=900).slice(0,12);
  await Promise.all(media.map(m=>analyzeAudio(m).catch(()=>null)));
  for(const c of clips){const a=AUD[c.mediaId];if(!a)continue;const sp=c.speed||1,lo=Math.min(c.in,c.out),hi=Math.max(c.in,c.out);const simple=!c.reverse&&!c.ramp;
    const sound=simple?a.sound.filter(s=>s[1]>lo&&s[0]<hi).map(s=>[r2(c.start+(Math.max(s[0],lo)-c.in)/sp),r2(c.start+(Math.min(s[1],hi)-c.in)/sp)]):[[r2(c.start),r2(cend(c))]];
    const music=c.gen==="score"||(c.type==="audio"&&c.track!=="A1"&&c.gen!=="vo"&&c.gen!=="sfx");
    out.push({id:c.id,track:c.track,role:c.gen==="vo"?"voiceover":c.gen==="sfx"?"effects":music?"music":"speech or live sound",level_db:r2(a.level+clipGainDb(c)),peak_db:r2(a.peak+clipGainDb(c)),sound:sound.slice(0,40)});
    if(music&&c.gen!=="score"&&simple&&musicBeats.length<160){try{beatTimes(a.ab).forEach(b=>{if(b>=lo&&b<hi&&musicBeats.length<160)musicBeats.push(r2(c.start+(b-c.in)/sp))})}catch(e){}}}
  const sc=tl.score;if(sc&&tl.clips.some(c=>c.gen==="score")){const beat=60/sc.bpm;for(let t=sc.drop%beat;t<tlDur()&&musicBeats.length<160;t+=beat)musicBeats.push(r2(t))}
  /* problems worth flagging */
  const issues=[],D=tlDur();const speech=out.filter(x=>x.role!=="music"&&x.role!=="effects"),music=out.filter(x=>x.role==="music");
  out.forEach(x=>{if(x.peak_db>-.5)issues.push({t:x.sound[0]?x.sound[0][0]:0,problem:`clip ${x.id} on ${x.track} peaks at ${x.peak_db} dB and may distort: lower its volume`})});
  music.forEach(mu=>speech.forEach(sp=>{if(mu.level_db>sp.level_db-6){const ov=sp.sound.find(s=>mu.sound.some(q=>q[0]<s[1]&&q[1]>s[0]));if(ov)issues.push({t:ov[0],problem:`music on ${mu.track} (${mu.level_db} dB) is as loud as the ${sp.role} on ${sp.track} (${sp.level_db} dB): duck the music or lower it`})}}));
  const all=out.flatMap(x=>x.sound).sort((a,b)=>a[0]-b[0]);let end=0;all.forEach(s=>{if(s[0]-end>1.5)issues.push({t:r2(end),problem:`silence from ${r2(end)} to ${s[0]} s: add room tone, music or a sound effect`});end=Math.max(end,s[1])});if(D-end>1.5&&out.length)issues.push({t:r2(end),problem:`silence from ${r2(end)} s to the end`});
  return E.audMap={clips:out,beats:[...new Set(musicBeats)].sort((a,b)=>a-b).slice(0,160),issues:issues.slice(0,12)}}
/* refresh it just before every AI request (bounded, so a huge file can't stall the chat) */
const _gsA=getSample;getSample=async function(){const s=await _gsA();if(s&&E.tl&&E.tl.clips.length)await Promise.race([audioMap().catch(()=>null),new Promise(r=>setTimeout(r,6000))]);return s};
const _tsA=tlSummary;tlSummary=function(){const o=_tsA();if(E.audMap&&E.tl&&E.audMap.clips.every(x=>E.tl.clips.some(c=>c.id===x.id)))o.audio=E.audMap;return o};

/* ---------- duck the music wherever someone is actually speaking ---------- */
function duckBySpeech(amount){const map=E.audMap;if(!map||!E.tl)return 0;const low=clamp(amount==null?.3:+amount,.05,.9);const talk=map.clips.filter(x=>x.role==="voiceover"||x.role==="speech or live sound").flatMap(x=>x.sound).sort((a,b)=>a[0]-b[0]);
  const iv=[];talk.forEach(s=>{const l=iv[iv.length-1];if(l&&s[0]-l[1]<.6)l[1]=Math.max(l[1],s[1]);else iv.push(s.slice())});if(!iv.length)return 0;
  const music=E.tl.clips.filter(c=>map.clips.some(x=>x.id===c.id&&x.role==="music"));if(!music.length)return 0;
  music.forEach(m=>{const base=m.vol==null?1:m.vol,r=.3,s=m.start,e=cend(m);if(m.kf)delete m.kf.vol;const here=iv.filter(v=>v[1]>s&&v[0]<e);if(!here.length)return;
    setKf(m,"vol",s,here[0][0]-r<=s?base*low:base);here.forEach(v=>{const a=Math.max(s,v[0]-r),b=Math.min(e,v[1]+r);if(a>s)setKf(m,"vol",a,base);setKf(m,"vol",Math.min(e,a+r),base*low);setKf(m,"vol",Math.max(s,b-r),base*low);if(b<e)setKf(m,"vol",b,base)})});return music.length}
const _aoD=applyOps;applyOps=function(ops,alias){const rest=[],done=[],skipped=[];(ops||[]).forEach(o=>{if(o&&o.op==="duck"){duckBySpeech(o.amount)?done.push("duck"):skipped.push("duck")}
    else if(o&&o.op==="replace_text"){replaceText(o.find,o.with,{titles:o.captions_only===false,word:o.whole_word!==false,raw:true})?done.push("replace_text"):skipped.push("replace_text")}else rest.push(o)});
  const r=_aoD(rest,alias);return{done:done.concat(r.done),skipped:skipped.concat(r.skipped)}};

/* ---------- 6. find and replace across captions ---------- */
function replaceText(find,rep,o){o=o||{};find=String(find||"");if(!find||!E.tl)return 0;const esc2=find.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const src=o.word?`(?<![\\p{L}\\p{N}])${esc2}(?![\\p{L}\\p{N}])`:esc2;const re=new RegExp(src,"giu"),has=new RegExp(src,"iu");
  const tg=E.tl.clips.filter(c=>c.type==="title"&&(isCaption(c)||o.titles)&&has.test(c.text||""));if(!tg.length||o.count)return tg.length;
  const go=()=>tg.forEach(c=>{c.text=c.text.replace(re,String(rep==null?"":rep))});o.raw?go():edit(go);return tg.length}
function openReplace(prefill){if(!cur())return;sheet("sh-rep",`<h3>Find and replace in captions</h3>
  <label class="aif" for="repFind">Find</label><input id="repFind" style="width:100%" value="${esc(prefill||"")}" placeholder="e.g. Sam's Zip" autocomplete="off">
  <label class="aif" for="repWith">Replace with</label><input id="repWith" style="width:100%" placeholder="e.g. Samszy" autocomplete="off">
  <label class="aichk"><input type="checkbox" id="repWord" checked> Whole words only</label><label class="aichk"><input type="checkbox" id="repTitles"> Also change titles, not just captions</label>
  <p id="repMsg" style="font-size:12px;min-height:16px;margin:8px 0 0;color:var(--muted)"></p>
  <div class="acts"><button class="btn" data-shclose="1">Close</button><button class="btn blue" id="repGo">Replace all</button></div>`,"Find and replace");
  const upd=()=>{const n=replaceText($("#repFind").value,"",{count:true,word:$("#repWord").checked,titles:$("#repTitles").checked});$("#repMsg").textContent=$("#repFind").value?(n?`Found in ${n} caption${n>1?"s":""}.`:"Not found."):""};
  ["repFind","repWord","repTitles"].forEach(id=>$("#"+id).addEventListener("input",upd));upd()}
document.addEventListener("click",e=>{if(e.target.closest("[data-openrep]")){const c=selClips()[0];const sel=String(getSelection()||"").trim();openReplace(sel&&sel.length<40?sel:"");return}
  if(e.target.closest("#repGo")){const n=replaceText($("#repFind").value,$("#repWith").value,{word:$("#repWord").checked,titles:$("#repTitles").checked});$("#repMsg").textContent=n?`Replaced in ${n} caption${n>1?"s":""}. Undo (⌘Z) reverses it.`:"Nothing to replace.";$("#insp").dataset.k="";renderInsp()}});
const _eciR=edClipInspector;edClipInspector=function(box){_eciR(box);const ch=box.querySelector(".capchips");if(ch&&!ch.querySelector("[data-openrep]"))ch.insertAdjacentHTML("beforeend",`<button type="button" data-openrep="1" title="Fix a word or name in every caption at once">Find &amp; replace…</button>`)};

/* ---------- 3. Finish my video ---------- */
function openFinish(){if(!cur()||!E.tl||!E.tl.clips.length){toast("FINISH","Put some clips on the timeline first.");return}const tl=E.tl;
  const hasCaps=tl.clips.some(isCaption),hasScore=tl.clips.some(c=>c.gen==="score"),hasSfx=tl.clips.some(c=>c.gen==="sfx"),hasLook=v1().some(c=>c.look||c.lut),talk=v1().some(c=>c.type==="video"&&(c.vol==null||c.vol>0));
  const row=(id,on,label,note)=>`<label class="aiopt"><input type="checkbox" id="${id}" ${on?"checked":""}><span><b>${label}</b><small>${note}</small></span></label>`;
  sheet("sh-fin",`<h3>Finish my video</h3><p style="font-size:12.5px;line-height:1.5;color:var(--muted);margin:0 0 10px">One pass over the whole edit. Each step is a normal edit you can undo or change afterwards.</p><div class="aiopts">
  ${row("finCaps",talk&&!hasCaps,"Captions",hasCaps?"Already there. Tick to redo them from the speech.":talk?"From the speech in your clips, cleaned up by the AI.":"No clips with sound on the storyline.")}
  ${row("finScore",!hasScore&&!tl.clips.some(c=>c.type==="audio"&&!c.gen),"Music",hasScore?"Already there. Tick to write a new score.":"Original music that follows the cut and drops on the reveal.")}
  ${row("finSfx",!hasSfx,"Sound design","Whooshes on transitions, risers into titles.")}
  ${row("finDuck",true,"Balance the sound","Lower the music wherever someone is speaking.")}
  ${row("finLook",!hasLook,"A consistent look",hasLook?"Your clips are already graded.":"The Warm Film look on every shot that has none.")}
  ${row("finExport",true,"Open Export when done","Social preset, loudness set to −14 LUFS.")}</div>
  <p id="finMsg" style="font-size:12px;min-height:16px;margin:8px 0 0;color:var(--muted)"></p><div class="acts"><button class="btn" data-shclose="1">Cancel</button><button class="btn purple" id="finGo">Finish it</button></div>`,"Finish my video")}
async function runFinish(o){const msg=t=>{const e=$("#finMsg");if(e)e.textContent=t};const done=[];const g=$("#finGo");if(g)g.disabled=true;
  try{if(typeof aiCheckpoint==="function")await aiCheckpoint("Before Finish my video").catch(()=>{});
    if(o.caps){msg("Captions: listening to the speech…");await autoCaptions();if(E.tl.clips.some(isCaption))done.push("captions")}
    if(o.score||o.sfx){msg("Music and sound design…");await makeScore({mood:"auto",music:!!o.score,sfx:!!o.sfx,ai:true,quiet:true});if(o.score)done.push("music");if(o.sfx)done.push("sound design")}
    if(o.duck){msg("Balancing the sound…");await audioMap().catch(()=>null);let n=0;edit(()=>{n=duckBySpeech(.3)});if(n)done.push("ducked music under speech")}
    if(o.look){const t=v1().filter(c=>!c.look&&!c.lut&&c.type!=="title");if(t.length&&LOOKS.film){edit(()=>t.forEach(c=>{Object.assign(c,clone(LOOKS.film[1]));c.look="film"}));done.push("Warm Film look")}}
    closeSheet("sh-fin");toast("FINISHED",done.length?"Added: "+done.join(", ")+". Play it through, then export.":"Nothing needed changing.");if(typeof track==="function")track("finish");
    if(o.exp){openExport();if(E.x){E.x.lufs="-14";const b=document.querySelector('[data-xpre="social"]');if(b)b.click()}}}
  catch(e){msg("Stopped: "+(e.message||"error")+". What was done so far is kept.");if(g)g.disabled=false}}
document.addEventListener("click",e=>{if(e.target.closest("[data-finish]")){openFinish();return}if(e.target.closest("#finGo"))runFinish({caps:$("#finCaps").checked,score:$("#finScore").checked,sfx:$("#finSfx").checked,duck:$("#finDuck").checked,look:$("#finLook").checked,exp:$("#finExport").checked})});
setTimeout(()=>{const x=$("#topExport");if(x&&!$("#topFinish"))x.insertAdjacentHTML("beforebegin",`<button class="tbtn2 ai" id="topFinish" data-finish="1" title="Finish my video: captions, music, sound design, a look and loudness in one pass">${ic("auto")}<span>Finish</span></button>`)},0);
if(typeof cmdList==="function"){const _clF=cmdList;cmdList=function(){const L=_clF();if(cur()){L.unshift({g:"AI",l:"Finish my video",f:openFinish});L.push({g:"Captions",l:"Find and replace in captions",f:()=>openReplace("")},{g:"Audio",l:"Duck music under speech",f:async()=>{await audioMap().catch(()=>null);let n=0;edit(()=>{n=duckBySpeech(.3)});toast("DUCKING",n?"Music now dips wherever someone speaks.":"Needs music and speech on the timeline.")}})}return L}}

/* ---------- 4. Score window: parts, brightness, new melody ---------- */
const _osS=openScore;openScore=function(){_osS();const d=$("#sh-score");if(!d||d.querySelector("#scoreMore"))return;const sc=E.tl&&E.tl.score;const mute=(sc&&sc.mute)||[];
  if(sc&&MOODS[sc.mood]){const sel=$("#scoreMood");sel.insertAdjacentHTML("afterbegin",`<option value="keep" selected>Keep current · ${MOODS[sc.mood].name} ${sc.bpm} BPM</option>`)}
  $("#scoreMsg").insertAdjacentHTML("beforebegin",`<details id="scoreMore" ${sc?"open":""}><summary style="font-size:12px;cursor:pointer;margin-top:8px">Instruments and tone</summary>
    <div class="capchips" style="padding:8px 0 4px" role="group" aria-label="Instruments">${PARTS.map(p=>`<label class="aichk" style="margin:0"><input type="checkbox" data-part="${p}" ${mute.includes(p)?"":"checked"}> ${p==="arp"?"Arpeggio":p==="lead"?"Melody":p[0].toUpperCase()+p.slice(1)}</label>`).join("")}</div>
    <label class="aif" for="scoreBright">Tone <span style="font-weight:400;color:var(--muted)">dark ↔ bright</span></label><input type="range" id="scoreBright" min="0" max="1" step=".05" value="${sc&&sc.bright!=null?sc.bright:.5}" style="width:100%">
    <label class="aichk"><input type="checkbox" id="scoreNewMel"> Write a new melody</label></details>`)};
document.addEventListener("click",e=>{if(!e.target.closest("#scoreGo"))return;const mood=$("#scoreMood").value;const mute=[...document.querySelectorAll("[data-part]")].filter(x=>!x.checked).map(x=>x.dataset.part);const bright=+$("#scoreBright").value;
  const tweak={mute,bright};if($("#scoreNewMel").checked)tweak.seed=Math.floor(Math.random()*1e6);E.scoreTweak=tweak;
  if(mood==="keep"){e.stopImmediatePropagation();const plan=Object.assign({},tweak);if(tweak.seed)plan.melody=null;makeScore({music:$("#scoreMusic").checked,sfx:$("#scoreSfx").checked,plan})}},true);
const _rsS=renderScore;renderScore=function(plan){const t=E.scoreTweak;if(t){E.scoreTweak=null;plan.mute=t.mute;plan.bright=t.bright;if(t.seed){plan.seed=t.seed;delete plan.melody}}return _rsS(plan)};

/* ---------- 5. chat suggestions for the sound features ---------- */
const _apQ=assistPanel;assistPanel=function(){_apQ();const s=document.querySelector("#assist .sugs");if(!s||s.dataset.snd||!E.tl||!E.tl.clips.length)return;s.dataset.snd=1;const tl=E.tl,extra=[];
  if(tl.clips.some(c=>c.gen==="score"))extra.push("Make the music darker","Move the drop to the logo","Try a different mood");else extra.push("Add music that fits");
  if(tl.clips.some(isCaption))extra.push("Neon captions","Bigger captions, higher up");else if(v1().some(c=>c.type==="video"))extra.push("Trim the silences");
  if(tl.clips.some(c=>c.gen==="score")&&v1().some(c=>c.type==="video"))extra.push("Duck the music under the talking");extra.push("Cut on the beat","Add a voiceover");
  s.insertAdjacentHTML("afterbegin",extra.map(x=>`<button type="button" data-sug="${esc(x)}">${esc(x)}</button>`).join(""))};
