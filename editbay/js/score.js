/* Edit Bay — generated score and sound design. The AI (or Edit Bay itself) plans a short piece of music from the edit:
   tempo, key, chords, and where the drop lands (on the reveal). The browser's audio engine synthesises it offline,
   and sound effects are placed on the edit's own transitions and titles. Everything is original, made on this device,
   and arrives as ordinary audio clips (A2 music, A3 sound design) that the mixer and export already handle.
   Real over invented: the music is a temporary bed until the real mix is dropped in. */
const MOODS={
  club:{name:"Dark club",bpm:124,scale:"minor",prog:[0,5,2,6],kit:"club"},
  hype:{name:"Hype",bpm:128,scale:"minor",prog:[0,6,5,6],kit:"club"},
  cinematic:{name:"Cinematic",bpm:84,scale:"minor",prog:[0,5,3,4],kit:"cine"},
  chill:{name:"Chill",bpm:92,scale:"major",prog:[0,5,3,4],kit:"chill"},
  emotional:{name:"Emotional",bpm:72,scale:"major",prog:[0,4,5,3],kit:"cine"}};
const SCALES={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11]};
const KEYS={C:48,"C#":49,Db:49,D:50,"D#":51,Eb:51,E:52,F:53,"F#":54,Gb:54,G:55,"G#":56,Ab:56,A:45,"A#":46,Bb:46,B:47};
const hz=m=>440*Math.pow(2,(m-69)/12);

/* ---------- planning ---------- */
function scoreFacts(){const tl=E.tl,D=Math.min(300,tlDur());const cuts=v1().slice(1).map(c=>+c.start.toFixed(2));
  const titles=tl.clips.filter(c=>c.type==="title"&&!c.autoCap&&c.track!=="V3").map(c=>({t:+c.start.toFixed(2),text:String(c.text||"").slice(0,40)}));return{D,cuts,titles}}
function autoPlan(moodKey){const m=MOODS[moodKey]||MOODS.club,{D,titles}=scoreFacts();
  /* the drop lands on the first title after the opening fifth, else 40% in: set up, then pay off */
  const t=titles.find(x=>x.t>=D*.2&&x.t<=D*.8);const drop=t?t.t:Math.max(2,D*.4);
  return{mood:moodKey,bpm:m.bpm,key:"A",scale:m.scale,chords:m.prog.slice(),drop,sections:[{from:0,to:drop,energy:1},{from:drop,to:Math.max(drop+1,D-2),energy:3},{from:Math.max(drop+1,D-2),to:D,energy:1}],say:`${m.name} bed at ${m.bpm} BPM, dropping at ${drop.toFixed(1)} s.`}}
async function aiPlan(moodKey){const S=await getSample();if(!S||(HOSTED&&typeof aiConf==="function"&&aiConf().p==="local"))return null;const f=scoreFacts();
  const prompt=`You are scoring a short video edit. Plan original background music that follows the story: set up, build, then pay off on the reveal.
Edit: ${f.D.toFixed(1)} s long. Cuts at ${JSON.stringify(f.cuts.slice(0,80))}. On-screen titles: ${JSON.stringify(f.titles.slice(0,20))}. Project: ${JSON.stringify(cur()?cur().title:"")}.
Mood requested: ${moodKey==="auto"?"choose the best fit from club, hype, cinematic, chill, emotional":moodKey}.
Reply with ONLY JSON: {"mood":"club|hype|cinematic|chill|emotional","bpm":60-140,"key":"A","scale":"minor|major","chords":[4 scale degrees 0-6],"drop":seconds (the moment the music lands, usually the biggest reveal),"sections":[{"from":s,"to":s,"energy":0-3}],"say":"one sentence on the musical idea"}`;
  try{const r=await S.json(prompt,{modelTier:"default"});return r&&typeof r==="object"?r:null}catch(e){return null}}
function cleanPlan(p,moodKey){const base=autoPlan(MOODS[p&&p.mood]?p.mood:(MOODS[moodKey]?moodKey:"club"));if(!p)return base;const D=scoreFacts().D;
  const out=Object.assign({},base);out.bpm=clamp(Math.round(+p.bpm||base.bpm),60,140);out.key=KEYS[p.key]!=null?p.key:base.key;out.scale=SCALES[p.scale]?p.scale:base.scale;
  if(Array.isArray(p.chords)&&p.chords.length>=2)out.chords=p.chords.slice(0,8).map(x=>clamp(Math.round(+x)||0,0,6));
  if(isFinite(+p.drop))out.drop=clamp(+p.drop,1,Math.max(1,D-1));
  if(Array.isArray(p.sections)&&p.sections.length)out.sections=p.sections.map(s=>({from:clamp(+s.from||0,0,D),to:clamp(+s.to||D,0,D),energy:clamp(Math.round(+s.energy||0),0,3)})).filter(s=>s.to>s.from);
  if(!out.sections.length)out.sections=base.sections;if(p.say)out.say=String(p.say).slice(0,160);return out}

/* ---------- synthesis ---------- */
function noiseBuf(ac){const b=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
function reverbIR(ac,sec){const n=Math.round(ac.sampleRate*sec),b=ac.createBuffer(2,n,ac.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3)}return b}
function env(g,t,a,peak,hold,rel){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.setValueAtTime(peak,t+a+hold);g.gain.exponentialRampToValueAtTime(.0001,t+a+hold+rel)}
function noiseHit(ac,NB,dest,t,type,freq,q,peak,dur){const s=ac.createBufferSource();s.buffer=NB;const f=ac.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;const g=ac.createGain();env(g,t,.002,peak,0,dur);s.connect(f).connect(g).connect(dest);s.start(t,Math.random());s.stop(t+dur+.05)}
function tone(ac,dest,t,type,f0,f1,peak,dur,a){const o=ac.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dur*.6);const g=ac.createGain();env(g,t,a||.003,peak,0,dur);o.connect(g).connect(dest);o.start(t);o.stop(t+(a||.003)+dur+.05)}
function riser(ac,NB,dest,t0,t1,peak){const s=ac.createBufferSource();s.buffer=NB;s.loop=true;const f=ac.createBiquadFilter();f.type="bandpass";f.Q.value=2.5;f.frequency.setValueAtTime(300,t0);f.frequency.exponentialRampToValueAtTime(7000,t1);
  const g=ac.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(peak,t1-.02);g.gain.linearRampToValueAtTime(0,t1+.01);s.connect(f).connect(g).connect(dest);s.start(t0);s.stop(t1+.05)}
function impact(ac,NB,dest,t,peak){tone(ac,dest,t,"sine",90,32,peak,1.4);noiseHit(ac,NB,dest,t,"lowpass",900,.7,peak*.5,.6)}

async function renderScore(plan){const D=scoreFacts().D,SR=48000;const ac=new OfflineAudioContext(2,Math.ceil((D+.5)*SR),SR);const NB=noiseBuf(ac),mood=MOODS[plan.mood]||MOODS.club;
  const master=ac.createGain();master.gain.value=.8;const comp=ac.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=3;master.connect(comp).connect(ac.destination);
  const rev=ac.createConvolver();rev.buffer=reverbIR(ac,mood.kit==="cine"?3.2:1.8);const revG=ac.createGain();revG.gain.value=mood.kit==="cine"?.45:.25;rev.connect(revG).connect(master);
  const padBus=ac.createGain();padBus.connect(master);padBus.connect(rev);const drums=ac.createGain();drums.gain.value=.9;drums.connect(master);
  /* fade in over 1 s, out over the last 2 s */
  master.gain.setValueAtTime(0,0);master.gain.linearRampToValueAtTime(.8,1);master.gain.setValueAtTime(.8,Math.max(1.1,D-2));master.gain.linearRampToValueAtTime(0,D);
  const scale=SCALES[plan.scale],root=KEYS[plan.key]??45,beat=60/plan.bpm,bar=beat*4;
  const note=(deg,oct)=>root+12*(oct||0)+scale[((deg%7)+7)%7]+12*Math.floor(deg/7);
  const energyAt=t=>{let e=1;for(const s of plan.sections)if(t>=s.from&&t<s.to)e=s.energy;return e};
  /* anchor the bar grid so a downbeat lands exactly on the drop */
  const t0=plan.drop-Math.ceil(plan.drop/bar)*bar;let i=0;
  for(let tb=t0;tb<D;tb+=bar,i++){const deg=plan.chords[((i%plan.chords.length)+plan.chords.length)%plan.chords.length];const e=energyAt(Math.max(0,tb+.01));const cn=[note(deg),note(deg+2),note(deg+4)];
    /* pad: detuned saws through a filter that opens with the energy */
    if(tb+bar>0){const lp=ac.createBiquadFilter();lp.type="lowpass";lp.frequency.value=500+e*650;lp.Q.value=.7;const g=ac.createGain();const st=Math.max(0,tb);env(g,st,.35,[.035,.045,.06,.075][e],Math.max(.05,bar-.6),.7);lp.connect(g).connect(padBus);
      cn.forEach(m=>[-7,7].forEach(c=>{const o=ac.createOscillator();o.type=mood.kit==="chill"?"triangle":"sawtooth";o.frequency.value=hz(m+12);o.detune.value=c;o.connect(lp);o.start(st);o.stop(st+bar+.8)}))}
    for(let k=0;k<4;k++){const tt=tb+k*beat;if(tt<0||tt>=D)continue;const ee=energyAt(tt);
      if(mood.kit==="cine"){if(ee>=2&&k===0)tone(ac,drums,tt,"sine",70,40,.9,.9);if(ee>=1)tone(ac,padBus,tt+beat*.5*(k%2),"triangle",hz(cn[(k+i)%3]+24),0,.08,beat*.9,.004)}
      else{
        if(ee>=2){tone(ac,drums,tt,"sine",150,45,1,.32);/* duck the pad on each kick */padBus.gain.setValueAtTime(.45,tt);padBus.gain.linearRampToValueAtTime(1,tt+beat*.6)}
        if(ee>=2&&(k===1||k===3)){noiseHit(ac,NB,drums,tt,"bandpass",1800,.8,.45,.18);tone(ac,drums,tt,"triangle",190,140,.25,.08)}
        if(ee>=1)noiseHit(ac,NB,drums,tt+beat/2,"highpass",8000,.7,ee>=2?.16:.06,.05);
        if(ee>=2)for(let h=0;h<2;h++){const tn=tt+h*beat/2;const o=ac.createOscillator();o.type="sawtooth";o.frequency.value=hz(note(deg,-1));const f=ac.createBiquadFilter();f.type="lowpass";f.frequency.value=320;const g=ac.createGain();env(g,tn,.005,.22,beat*.25,beat*.2);o.connect(f).connect(g).connect(master);o.start(tn);o.stop(tn+beat*.6)}
        if(ee>=3)for(let s=0;s<4;s++){const tn=tt+s*beat/4;const o=ac.createOscillator();o.type="square";o.frequency.value=hz(cn[(s+k)%3]+24);const f=ac.createBiquadFilter();f.type="lowpass";f.frequency.value=2400;const g=ac.createGain();env(g,tn,.002,.035,0,beat*.2);o.connect(f).connect(g).connect(padBus);o.start(tn);o.stop(tn+beat*.3)}}}}
  /* the build into the drop, and the drop itself */
  if(plan.drop>bar*.5){riser(ac,NB,master,Math.max(0,plan.drop-bar*2),plan.drop,.35);impact(ac,NB,master,plan.drop,.8)}
  return ac.startRendering()}

async function renderSoundDesign(){const D=scoreFacts().D,SR=48000;const ac=new OfflineAudioContext(2,Math.ceil((D+1)*SR),SR);const NB=noiseBuf(ac);const out=ac.createGain();out.gain.value=.9;out.connect(ac.destination);let n=0;
  /* a whoosh across every transition; an impact on the hard-hitting ones */
  v1().forEach((c,i)=>{if(!i||!c.tr||!c.tr.type)return;const d=Math.max(.3,Math.min(1.2,(c.tr.d||.5)*1.4)),mid=c.start,t0=Math.max(0,mid-d/2);
    const s=ac.createBufferSource();s.buffer=NB;s.loop=true;const f=ac.createBiquadFilter();f.type="bandpass";f.Q.value=1.4;f.frequency.setValueAtTime(350,t0);f.frequency.exponentialRampToValueAtTime(3200,mid);f.frequency.exponentialRampToValueAtTime(400,t0+d);
    const p=ac.createStereoPanner();p.pan.setValueAtTime(-.7,t0);p.pan.linearRampToValueAtTime(.7,t0+d);const g=ac.createGain();g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.5,mid);g.gain.exponentialRampToValueAtTime(.0001,t0+d);
    s.connect(f).connect(p).connect(g).connect(out);s.start(t0);s.stop(t0+d+.05);n++;if(/flash|whip|glitch|zoom|burn/.test(c.tr.type)){impact(ac,NB,out,mid,.5);n++}});
  /* a short rise into each title that animates in, landing on a soft hit */
  E.tl.clips.filter(c=>c.type==="title"&&!c.autoCap&&c.track!=="V3"&&c.start>.6&&(c.anim||"none")!=="none").forEach(c=>{riser(ac,NB,out,c.start-.8,c.start,.22);tone(ac,out,c.start,"sine",120,60,.35,.5);n++});
  if(!n)return null;return ac.startRendering()}

function wavBlob(buf){const ch=buf.numberOfChannels,len=buf.length,SR=buf.sampleRate,bytes=44+len*ch*2,ab=new ArrayBuffer(bytes),v=new DataView(ab);const W=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  W(0,"RIFF");v.setUint32(4,bytes-8,true);W(8,"WAVE");W(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);v.setUint32(24,SR,true);v.setUint32(28,SR*ch*2,true);v.setUint16(32,ch*2,true);v.setUint16(34,16,true);W(36,"data");v.setUint32(40,len*ch*2,true);
  const data=[...Array(ch)].map((_,c)=>buf.getChannelData(c));let o=44;for(let i=0;i<len;i++)for(let c=0;c<ch;c++){const x=Math.max(-1,Math.min(1,data[c][i]));v.setInt16(o,x<0?x*32768:x*32767,true);o+=2}return new Blob([ab],{type:"audio/wav"})}
function freeAudioTrack(pref,D){const ats=TRACKS.filter(t=>t[0]==="A");const busy=t=>E.tl.clips.some(c=>c.track===t&&c.start<D&&cend(c)>0);return[pref,...ats].find(t=>ats.includes(t)&&!busy(t))||null}
async function placeGenerated(buf,name,pref,vol){const D=scoreFacts().D;const f=new File([wavBlob(buf)],name,{type:"audio/wav"});await importFiles([f]);const m=[...state.media].reverse().find(x=>x.name===name&&x.projectId===cur().id);if(!m)throw new Error("import");
  let tr=freeAudioTrack(pref,D);if(!tr&&typeof addTrack==="function"){addTrack("a");tr=freeAudioTrack(pref,D)}if(!tr)tr=pref;
  placeMedia(m.id,tr,0);const c=[...E.tl.clips].reverse().find(x=>x.mediaId===m.id);if(c)edit(()=>{c.track=tr;c.start=0;c.vol=vol;c.out=Math.min(c.out,D);c.by="claude";c.name=name});return tr}

async function makeScore(o){if(!getTL()||!E.tl.clips.length){toast("SCORE","Put some clips on the timeline first, so the music has an edit to follow.");return}
  const msg=t=>{const e=$("#scoreMsg");if(e)e.textContent=t};const go=$("#scoreGo");if(go)go.disabled=true;
  try{let plan=null,byAI=false;if(o.music){if(o.ai){msg("Asking the AI to plan the music…");const p=await aiPlan(o.mood);if(p){plan=cleanPlan(p,o.mood);byAI=true}}if(!plan)plan=cleanPlan(null,o.mood==="auto"?"club":o.mood)}
    const done=[];
    if(o.music){msg(`Playing it through: ${MOODS[plan.mood].name}, ${plan.bpm} BPM, ${plan.key} ${plan.scale}…`);const buf=await renderScore(plan);
      const tr=await placeGenerated(buf,`Score - ${MOODS[plan.mood].name} ${plan.bpm} BPM (generated).wav`,"A2",.55);done.push(`music on ${tr} (${plan.say||""})`)}
    if(o.sfx){msg("Placing sound effects on the transitions and titles…");const sb=await renderSoundDesign();if(sb){const tr=await placeGenerated(sb,"Sound design (generated).wav","A3",.8);done.push("sound design on "+tr)}else done.push("no transitions or animated titles to put sound on")}
    closeSheet("sh-score");toast("SCORE",(byAI?"AI-planned ":"")+done.join("; ")+". It's original and yours to use. Swap in your real mix when you have it.");if(typeof track==="function")track("score:"+(o.music?plan.mood:"sfx"))}
  catch(e){msg("Couldn’t make the score: "+(e.message||"error"));if(go)go.disabled=false}}

function openScore(){if(!cur()){toast("SCORE","Open a project first.");return}const hasAI=!(HOSTED&&(typeof aiReady!=="function"||!aiReady()||aiConf().p==="local"));
  sheet("sh-score",`<h3>Score &amp; sound</h3><p style="font-size:12.5px;line-height:1.5;color:var(--muted);margin:0 0 10px">Edit Bay writes original background music that follows your cut and drops on the reveal, and puts sound effects on your transitions and titles. It's made on this computer and free to use. Treat it as a temporary bed until you have the real track.</p>
  <label class="aif" for="scoreMood">Mood</label><select id="scoreMood"><option value="auto">Match the edit</option>${Object.entries(MOODS).map(([k,m])=>`<option value="${k}">${m.name} · ${m.bpm} BPM</option>`).join("")}</select>
  <label class="aichk"><input type="checkbox" id="scoreMusic" checked> Background music (A2)</label>
  <label class="aichk"><input type="checkbox" id="scoreSfx" checked> Sound design: whooshes, risers, impacts (A3)</label>
  <label class="aichk"><input type="checkbox" id="scoreAI" ${hasAI?"checked":"disabled"}> Let the AI plan it from the edit${hasAI?"":" (set up an AI in Help › AI Settings)"}</label>
  <p id="scoreMsg" style="font-size:12px;min-height:16px;margin:8px 0 0;color:var(--muted)"></p>
  <div class="acts"><button class="btn" data-shclose="1">Cancel</button><button class="btn purple" id="scoreGo">Make it</button></div>`,"Score and sound")}
document.addEventListener("click",e=>{if(e.target.closest("#scoreGo")){makeScore({mood:$("#scoreMood").value,music:$("#scoreMusic").checked,sfx:$("#scoreSfx").checked,ai:$("#scoreAI").checked});return}
  if(e.target.closest("[data-score]"))openScore()});
/* entry points: the tools row (beside Auto Cut), the Audio page, command search */
const _rpS=renderPagebar;renderPagebar=function(...a){const r=_rpS.apply(this,a);const ab=$("#autoBtn");if(ab&&!$("#scoreBtn"))ab.insertAdjacentHTML("afterend",`<button class="ai" id="scoreBtn" data-score="1" title="Score & sound: original music that follows your cut, plus sound effects on transitions and titles">${ic("audio")}Score</button>`);return r};
if(typeof cmdList==="function"){const _clS=cmdList;cmdList=function(){const L=_clS();if(cur())L.unshift({g:"Audio",l:"Score & sound: generate music and sound effects",f:openScore});return L}}
setTimeout(()=>{try{renderPagebar()}catch(e){}},0);
