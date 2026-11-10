/* Edit Bay — multicam (after Final Cut / Premiere) and AI Auto Cut (after CapCut).
   Multicam: tl.mc[id] = {name, angles:[{mediaId,off,name}], audio:k}. A multicam clip is a V1 video clip with c.mc=id, c.angle=k;
   its in/out are in that angle's source time, and multicam time = source time + angle.off, so switching angles shifts in/out by the offset difference.
   Auto Cut: on-device analysis (beats, motion, contrast, silence) builds candidate shots; Claude watches contact sheets and orders the story. */
const AU={dec:{},vid:{},busy:false,prog:"",opts:null};E.angleView=false;

/* ---------- analysis helpers ---------- */
async function decodeAudio(m){if(AU.dec[m.id])return AU.dec[m.id];const p=(async()=>{const buf=await(await fetch(blobUrl(m))).arrayBuffer();const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;const oc=new OAC(1,2,22050);
  return await new Promise((res,rej)=>{const q=oc.decodeAudioData(buf,res,rej);if(q&&q.then)q.then(res,rej)})})();AU.dec[m.id]=p;p.catch(()=>{delete AU.dec[m.id]});return p}
function envelope(ab,rate){const ch=ab.getChannelData(0),sr=ab.sampleRate,hop=Math.max(1,Math.round(sr/rate)),n=Math.floor(ch.length/hop),out=new Float32Array(n);
  for(let i=0;i<n;i++){let s=0;const o=i*hop;for(let j=0;j<hop;j+=2){const v=ch[o+j];s+=v*v}out[i]=10*Math.log10(1e-9+s/(hop/2))}return out}
function beatTimes(ab){const env=envelope(ab,100),flux=new Float32Array(env.length);for(let i=1;i<env.length;i++)flux[i]=Math.max(0,env[i]-env[i-1]);
  const W=50,out=[];let last=-1;for(let i=1;i<flux.length-1;i++){const a=Math.max(0,i-W),b=Math.min(flux.length,i+W);let mu=0,sd=0;for(let k=a;k<b;k++)mu+=flux[k];mu/=b-a;for(let k=a;k<b;k++)sd+=(flux[k]-mu)**2;sd=Math.sqrt(sd/(b-a));
    const t=i/100;if(flux[i]>mu+1.4*sd&&flux[i]>=flux[i-1]&&flux[i]>=flux[i+1]&&flux[i]>2&&(last<0||t-last>.22)){out.push(t);last=t}}return out}
async function analyzeVideo(m,onp){if(AU.vid[m.id])return AU.vid[m.id];if(m.kind==="image"){const r={still:true,dur:4,motion:[],score:[.45],step:4,thumbs:[{t:0,url:blobUrl(m)}]};AU.vid[m.id]=r;return r}
  const v=document.createElement("video");v.muted=true;v.preload="auto";v.playsInline=true;v.crossOrigin="anonymous";v.src=blobUrl(m);if(!await loadMeta(v))throw new Error("meta");
  const dur=v.duration||m.dur||1,step=Math.max(.4,dur/90),n=Math.max(2,Math.floor(dur/step)),gw=32,gh=Math.max(8,Math.round(32*(v.videoHeight||9)/(v.videoWidth||16)));
  const g=document.createElement("canvas");g.width=gw;g.height=gh;const gx=g.getContext("2d",{willReadFrequently:true});const tw=200,th=Math.round(tw*(v.videoHeight||9)/(v.videoWidth||16));
  const motion=[],con=[],thumbs=[];let prev=null;
  for(let i=0;i<n;i++){const t=Math.min(dur-.05,i*step+step/2);await seekTo(v,t);gx.drawImage(v,0,0,gw,gh);const d=gx.getImageData(0,0,gw,gh).data;const L=new Float32Array(gw*gh);let mu=0;
    for(let k=0;k<L.length;k++){L[k]=.2126*d[k*4]+.7152*d[k*4+1]+.0722*d[k*4+2];mu+=L[k]}mu/=L.length;let sd=0,df=0;for(let k=0;k<L.length;k++){sd+=(L[k]-mu)**2;if(prev)df+=Math.abs(L[k]-prev[k])}
    motion.push(prev?df/L.length:0);con.push(Math.sqrt(sd/L.length)*(mu<18?.3:1));prev=L;
    if(i%Math.max(1,Math.round(n/12))===0){const c=document.createElement("canvas");c.width=tw;c.height=th;c.getContext("2d").drawImage(v,0,0,tw,th);thumbs.push({t,cv:c})}
    if(onp&&i%6===0)onp(i/n)}
  if(motion.length>1)motion[0]=motion[1];v.removeAttribute("src");v.load();
  const mx=Math.max(1,...motion),cx=Math.max(1,...con);const score=motion.map((x,i)=>.65*Math.min(1,x/mx*1.15)+.35*con[i]/cx);
  const r={dur,step,motion,score,thumbs};AU.vid[m.id]=r;return r}
function windowScore(a,s,L){if(a.still)return a.score[0];const i0=Math.floor(s/a.step),i1=Math.max(i0+1,Math.ceil((s+L)/a.step));let t=0,n=0;for(let i=i0;i<i1&&i<a.score.length;i++){t+=a.score[i];n++}return n?t/n:0}
function contactSheet(m,a,idx){const th=a.thumbs.slice(0,12);if(!th.length)return null;const cols=4,tw=200,thh=a.still?Math.round(tw*(m.h||9)/(m.w||16)):th[0].cv.height,rows=Math.ceil(th.length/cols);
  const c=document.createElement("canvas");c.width=cols*tw;c.height=rows*thh+28;const x=c.getContext("2d");x.fillStyle="#111";x.fillRect(0,0,c.width,c.height);x.fillStyle="#fff";x.font="bold 16px system-ui";x.fillText(`#${idx} ${m.name} (${(a.dur||0).toFixed(1)} s)`,8,19);
  return new Promise(res=>{let left=th.length;const done=()=>{if(--left<=0)c.toBlob(res,"image/jpeg",.72)};
    th.forEach((f,i)=>{const px=(i%cols)*tw,py=28+Math.floor(i/cols)*thh;const lab=()=>{x.fillStyle="#000a";x.fillRect(px,py+thh-18,58,18);x.fillStyle="#fff";x.font="12px monospace";x.fillText(f.t.toFixed(1)+"s",px+4,py+thh-5)};
      if(f.cv){x.drawImage(f.cv,px,py,tw,thh);lab();done()}else{const im=new Image();im.onload=()=>{x.drawImage(im,px,py,tw,thh);done()};im.onerror=done;im.src=f.url}})})}

/* ---------- multicam ---------- */
const mcOf=c=>c&&c.mc&&E.tl&&E.tl.mc?E.tl.mc[c.mc]:null;
async function syncOffsets(ms){const R=50;const envs=[];for(const m of ms){try{const ab=await decodeAudio(m);const e=envelope(ab,R);const f=new Float32Array(Math.min(e.length,R*180));for(let i=1;i<f.length;i++)f[i]=Math.max(0,e[i]-e[i-1]);
    const g=new Float32Array(f.length);for(let i=0;i<f.length;i++){let t=0,w=0;for(let k=-3;k<=3;k++){const j=i+k;if(j>=0&&j<f.length){const q=4-Math.abs(k);t+=f[j]*q;w+=q}}g[i]=t/w}f.set(g);let mu=0;f.forEach(v=>mu+=v);mu/=f.length||1;let sd=0;f.forEach(v=>sd+=(v-mu)**2);sd=Math.sqrt(sd/(f.length||1))||1;for(let i=0;i<f.length;i++)f[i]=(f[i]-mu)/sd;envs.push(f)}catch(e){envs.push(null)}}
  const ref=envs[0];return ms.map((m,k)=>{if(!k||!ref||!envs[k])return{off:0,ok:k===0};const b=envs[k],maxLag=Math.min(R*60,Math.max(ref.length,b.length));let best=-Infinity,bl=0,second=-Infinity;
    for(let lag=-maxLag;lag<=maxLag;lag++){let s=0,n=0;const i0=Math.max(0,lag),i1=Math.min(ref.length,b.length+lag);for(let i=i0;i<i1;i+=1){s+=ref[i]*b[i-lag];n++}if(n<Math.max(R*3,.35*Math.min(ref.length,b.length)))continue;s/=Math.sqrt(n*Math.min(ref.length,b.length));if(s>best){second=best;best=s;bl=lag}else if(s>second)second=s}
    return{off:bl/R,ok:best>.12&&best>second*1.05}})}
async function createMulticam(ids,how,audioK,name){const ms=ids.map(mediaOf).filter(m=>m&&m.kind==="video");if(ms.length<2){toast("MULTICAM","Pick at least two video clips.");return}
  setProg("Syncing angles"+(how==="audio"?" by their sound…":"…"));let offs=ms.map(()=>({off:0,ok:true}));if(how==="audio")offs=await syncOffsets(ms);
  const weak=offs.filter((o,i)=>i&&!o.ok).length;const id=uid("mc");const angles=ms.map((m,k)=>({mediaId:m.id,off:+offs[k].off.toFixed(3),name:m.name.replace(/\.[^.]+$/,"")}));
  const st=Math.max(...angles.map((a,k)=>a.off)),en=Math.min(...angles.map((a,k)=>a.off+(ms[k].dur||0)));let a0=st,a1=en;if(a1-a0<2){a0=Math.min(...angles.map(a=>a.off));a1=Math.max(...angles.map((a,k)=>a.off+(ms[k].dur||0)))}
  const ak=clamp(audioK|0,0,ms.length-1);
  edit(tl=>{tl.mc=tl.mc||{};tl.mc[id]={name:name||"Multicam",angles,audio:ak};const at=tlDur();
    const c=newClip(ms[0],"V1",0);Object.assign(c,{mc:id,angle:0,name:(name||"Multicam")+" · "+angles[0].name,in:a0-angles[0].off,out:a1-angles[0].off,vol:0});const l=v1();l.push(c);tl.clips.push(c);repack(l);
    const au=newClip(ms[ak],"A1",c.start);Object.assign(au,{in:a0-angles[ak].off,out:a1-angles[ak].off,name:(name||"Multicam")+" · sound ("+angles[ak].name+")"});tl.clips.push(au);relink(au);resolveTrack("A1",au.id);
    E.sel=new Set([c.id]);E.t=c.start});
  setProg("");state.modal=null;E.angleView=true;render();
  toast("MULTICAM",angles.length+" angles"+(how==="audio"?(weak?" · "+weak+" couldn’t be matched by sound, so check them":" synced by sound"):" lined up by start")+". Press 1–"+angles.length+" while it plays to cut between them.")}
function mcClipAt(t){return E.tl&&E.tl.clips.find(c=>c.track==="V1"&&c.mc&&t>=c.start&&t<cend(c))}
function setAngle(c,k){const mc=mcOf(c);if(!mc||!mc.angles[k]||c.angle===k)return;const a=mc.angles[c.angle||0],b=mc.angles[k],d=a.off-b.off;c.in+=d;c.out+=d;c.angle=k;c.mediaId=b.mediaId;c.name=mc.name+" · "+b.name}
function switchAngle(k,cut){const c=selClips().find(x=>x.mc&&E.t>=x.start&&E.t<cend(x))||mcClipAt(E.t);if(!c){toast("MULTICAM","Put the playhead over a multicam clip.");return}
  const mc=mcOf(c);if(!mc||!mc.angles[k])return;if(c.angle===k&&cut!==false)return;
  edit(()=>{let tgt=c;if(cut!==false&&E.t-c.start>=FR()&&cend(c)-E.t>=FR()){const n=splitClip(c,E.t);if(n)tgt=n}setAngle(tgt,k);E.sel=new Set([tgt.id])});
  if(E.angleView)renderAngles()}

/* angle viewer (left pane on the Edit page) */
const AV={els:[],key:"",raf:0};
function renderAngles(){const body=$("#bbody"),c=mcClipAt(E.t)||selClips().find(x=>x.mc);const mc=mcOf(c)||(E.tl&&E.tl.mc&&Object.values(E.tl.mc)[0]);
  $("#bacts").innerHTML=`<button class="btn" data-angclose="1">Close angles</button>`;
  if(!mc){AV.key="";body.innerHTML=`<div class="empty">No multicam clip yet. Use Multicam in the toolbar to make one from 2–4 camera angles.</div>`;return}
  const key=mc.angles.map(a=>a.mediaId).join("|");const cur_=c?c.angle||0:-1;
  if(AV.key!==key){AV.key=key;AV.els.forEach(v=>{v.removeAttribute("src");v.load()});
    body.innerHTML=`<div class="angles" style="--n:${mc.angles.length>2?2:mc.angles.length}">${mc.angles.map((a,k)=>`<button class="ang" data-ang="${k}" title="Click: cut to ${esc(a.name)} at the playhead · ⇧click: switch the whole clip"><video muted playsinline preload="auto"></video><span class="al"><b>${k+1}</b> ${esc(a.name)}</span></button>`).join("")}</div><div class="anghint">Press <span class="kbd">1</span>–<span class="kbd">${mc.angles.length}</span> while playing to cut and switch. ⇧+number switches without cutting.</div>`;
    AV.els=[...body.querySelectorAll(".ang video")];AV.els.forEach((v,k)=>{v.crossOrigin="anonymous";const m=mediaOf(mc.angles[k].mediaId);if(m)v.src=blobUrl(m)})}
  body.querySelectorAll(".ang").forEach((b,k)=>b.classList.toggle("on",k===cur_));angleLoop()}
function angleLoop(){cancelAnimationFrame(AV.raf);const tick=()=>{if(!E.angleView||E.page!=="edit"||!AV.els.length)return;const c=mcClipAt(viewT());const mc=mcOf(c);
    if(mc){const mcT=srcTime(c,viewT())+mc.angles[c.angle||0].off;AV.els.forEach((v,k)=>{const a=mc.angles[k];if(!a)return;const tg=mcT-a.off;
      if(E.playing){if(v.paused&&tg>=0)v.play().catch(()=>{});if(Math.abs(v.currentTime-tg)>.3)v.currentTime=Math.max(0,tg)}else{if(!v.paused)v.pause();if(Math.abs(v.currentTime-tg)>.05&&!v.seeking)v.currentTime=Math.max(0,tg)}});
      document.querySelectorAll(".ang").forEach((b,k)=>b.classList.toggle("on",k===(c.angle||0)))}else AV.els.forEach(v=>{if(!v.paused)v.pause()});
    AV.raf=requestAnimationFrame(tick)};tick()}

/* ---------- remove silences (CapCut / Descript "remove pauses") ---------- */
async function removeSilences(o){const clips=(o.scope==="sel"?selClips():E.tl.clips).filter(c=>c.track==="V1"&&c.type==="video"&&!c.freeze&&!c.off);if(!clips.length){toast("PAUSES","No storyline video clips with sound to check.");return}
  const plan=new Map();let cuts=0,saved=0;
  for(const c of clips){const m=mediaOf(c.mediaId);setProg("Listening to "+(m?m.name:"clip")+"…");let ab;try{ab=await decodeAudio(m)}catch(e){continue}const R=100,env=envelope(ab,R);
    const s0=Math.floor(c.in*R),s1=Math.min(env.length,Math.ceil(c.out*R));const sil=[];let run=-1;
    for(let i=s0;i<=s1;i++){const q=i<s1&&env[i]<o.db;if(q&&run<0)run=i;if(!q&&run>=0){if((i-run)/R>=o.min)sil.push([run/R,i/R]);run=-1}}
    const keep=[];let a=c.in;sil.forEach(([x,y])=>{const xs=x+o.pad,ys=y-o.pad;if(ys-xs<.05)return;if(xs-a>.08)keep.push([a,xs]);cuts++;saved+=ys-xs;a=ys});if(c.out-a>.08)keep.push([a,c.out]);
    if(keep.length&&(keep.length>1||keep[0][0]!==c.in||keep[0][1]!==c.out))plan.set(c.id,keep)}
  setProg("");if(!plan.size){toast("PAUSES","No pauses longer than "+o.min+" s below "+o.db+" dB.");return}
  edit(tl=>{const order=[];v1().forEach(c=>{const k=plan.get(c.id);if(!k){order.push(c);return}const sp=c.speed||1;
      k.forEach(([i,j],n)=>{const p=n?Object.assign(clone(c),{id:uid("c"),fadeIn:0}):c;p.in=i;p.out=j;delete p.kf;if(n){delete p.tr;tl.clips.push(p)}if(n<k.length-1)p.fadeOut=0;order.push(p)})});
    repack(order);tl.clips.forEach(x=>{if(x.track!=="V1")relink(x)})});
  state.modal=null;render();toast("PAUSES REMOVED",cuts+" pause"+(cuts>1?"s":"")+" cut, "+saved.toFixed(1)+" s shorter. ⌘Z brings them back.")}

/* ---------- Auto Cut ---------- */
function slotsFor(o,beats,T){const sl=[];if(beats&&beats.length>3){const N=o.every;let prev=0;for(let i=N;i<beats.length;i+=N){const t=beats[i];if(t>T)break;if(t-prev>=.35){sl.push([prev,t]);prev=t}}if(T-prev>.35)sl.push([prev,T]);}
  else{const L=o.pace;for(let t=0;t<T-.2;t+=L)sl.push([t,Math.min(T,t+L)])}return sl}
function quickPick(slots,pool){const used=new Map(),out=[];let last=null;
  slots.forEach(([a,b],si)=>{const L=b-a;let best=null;pool.forEach(({m,an})=>{const segs=used.get(m.id)||[];if(an.still){const sc=an.score[0]-(segs.length*.25)-(last===m.id?.6:0);if(!best||sc>best.sc)best={m,in:0,sc};return}
      const span=Math.max(0,an.dur-L);for(let s=0;s<=span;s+=Math.max(.25,an.step)){if(segs.some(([x,y])=>s<y&&s+L>x))continue;let sc=windowScore(an,s,L)-(last===m.id?.35:0)+(si===0&&s<.6?-.1:0);if(!best||sc>best.sc)best={m,in:s,sc}}});
    if(!best){const p=pool[si%pool.length];best={m:p.m,in:0}}const seg=used.get(best.m.id)||[];seg.push([best.in,best.in+L]);used.set(best.m.id,seg);last=best.m.id;out.push({media:best.m.id,in:best.in})});return out}
async function claudePick(slots,pool,o){const S=await getSample();if(!S)return null;const caps=sampleCaps||{};let imgs=[];
  if(caps.images){const max=Math.min(caps.images.maxCount||8,pool.length);for(let i=0;i<max;i++){const b=await contactSheet(pool[i].m,pool[i].an,i);if(b)imgs.push(b)}}
  const lib=pool.map(({m,an},i)=>{const top=an.still?[]:an.score.map((s,k)=>[k*an.step,s]).sort((x,y)=>y[1]-x[1]).slice(0,5).map(x=>+x[0].toFixed(1));return{n:i,id:m.id,name:m.name,kind:m.kind,dur:+(an.dur||0).toFixed(2),mostAction:top}});
  const prompt=`${ASSIST_RULES.split("Reply with ONLY")[0]}
You are cutting a music-driven edit like CapCut AutoCut, but with a real story. There are ${slots.length} shots to fill, in order, with these lengths in seconds: ${JSON.stringify(slots.map(([a,b])=>+(b-a).toFixed(2)))}.
Footage library (n matches the "#n" label on each contact-sheet image; frame times are printed on the frames): ${JSON.stringify(lib)}
${o.brief?"The person's brief for this cut: "+o.brief:"No brief given: find the story in the footage."}
Pick a shot for every slot. Open with a hook, build, and end on the strongest image. Set something up early and pay it off at the end. Avoid repeating the same moment; vary wide and close shots; put the highest-energy moments where the slots are shortest.
Reply with ONLY JSON: {"say":"one or two sentences on the story you built","shots":[{"n":libraryNumber,"in":secondsIntoThatClip}, ...exactly ${slots.length} items]}`;
  const r=await S.json(prompt,imgs.length?{images:imgs,modelTier:"default"}:{modelTier:"default"});
  if(!r||!Array.isArray(r.shots))return null;const out=slots.map(([a,b],i)=>{const s=r.shots[i]||r.shots[i%r.shots.length]||{};const p=pool[clamp(s.n|0,0,pool.length-1)];const L=b-a;
    const mx=p.an.still?0:Math.max(0,p.an.dur-L);return{media:p.m.id,in:clamp(+s.in||0,0,mx)}});return{shots:out,say:String(r.say||"")}}
async function runAutoCut(o){if(AU.busy)return;AU.busy=true;try{
  const pool=[];const media=o.ids.map(mediaOf).filter(Boolean);if(!media.length){toast("AUTO CUT","Pick some clips to cut from.");return}
  for(let i=0;i<media.length;i++){setProg(`Watching ${media[i].name} (${i+1}/${media.length})…`);try{pool.push({m:media[i],an:await analyzeVideo(media[i],f=>setProg(`Watching ${media[i].name} (${i+1}/${media.length}) · ${Math.round(f*100)}%`))})}catch(e){}}
  if(!pool.length){toast("AUTO CUT","Couldn’t read any of those clips.");return}
  let beats=null,T=o.len,music=o.music?mediaOf(o.music):null;
  if(music){setProg("Finding the beat in "+music.name+"…");try{const ab=await decodeAudio(music);beats=beatTimes(ab);if(!T)T=ab.duration}catch(e){beats=null}}
  if(!T)T=Math.min(30,pool.reduce((s,p)=>s+(p.an.dur||4),0));
  const slots=slotsFor(o,beats,T);if(!slots.length){toast("AUTO CUT","That’s too short to cut.");return}
  let pick=null,say="";if(o.mode==="smart"){setProg("Claude is choosing the story…");try{const r=await claudePick(slots,pool,o);if(r){pick=r.shots;say=r.say}}catch(e){say="";toast("AUTO CUT",e&&e.code==="not_granted"?"Claude wasn’t allowed, so the quick on-device cut was used.":"Claude couldn’t pick shots this time, so the quick on-device cut was used.")}}
  if(!pick)pick=quickPick(slots,pool);
  const by=o.mode==="smart"&&say?"claude":"joe";E.by=by;
  edit(tl=>{if(music&&o.place==="replace")tl.clips=tl.clips.filter(c=>c.mediaId!==music.id);if(o.place==="replace"){const oldV1=new Set(v1().map(c=>c.id));tl.clips=tl.clips.filter(c=>!oldV1.has(c.id)&&!(c.link&&oldV1.has(c.link)&&c.track[0]==="A"));}
    const base=o.place==="replace"?0:tlDur();const l=o.place==="replace"?[]:v1();
    pick.forEach((p,i)=>{const m=mediaOf(p.media);const[a,b]=slots[i];const L=b-a;const c=newClip(m,"V1",0);c.in=p.in;if(m.kind==="image"){c.out=L;c.kb=!!o.kb}else c.out=p.in+L;c.vol=music?0:c.vol;c.fit="fill";c.by=by;
      if(o.trans&&i>0&&i%4===0)c.tr={type:"dissolve",d:Math.min(.4,L/2)};if(i===0)c.fadeIn=.25;if(i===pick.length-1)c.fadeOut=.6;l.push(c);tl.clips.push(c)});repack(l);
    if(music){const mu=newClip(music,"A2",base);mu.out=Math.min(music.dur||T,T);mu.fadeOut=Math.min(1.2,T/6);mu.by=by;tl.clips.push(mu);relink(mu);resolveTrack("A2",mu.id)}
    if(beats&&o.place==="replace"){tl.markers=(tl.markers||[]).filter(mk=>mk.kind!=="beat");beats.filter(t=>t<=T).slice(0,300).forEach(t=>tl.markers.push({id:uid("mk"),t:+t.toFixed(3),text:"Beat",by:"joe",kind:"beat"}))}
    if(say)tl.note=say.slice(0,200);E.sel=new Set()});E.by="joe";
  state.modal=null;E.t=o.place==="replace"?0:E.t;render();
  toast("AUTO CUT",`${slots.length} shots, ${T.toFixed(1)} s${beats?" on the beat":""}.${say?" "+say:""} ⌘Z undoes it.`);if(say&&cur())addLog(cur().id,{who:"claude",text:"Auto Cut: "+say})}
  finally{AU.busy=false;setProg("")}}

/* ---------- dialogs ---------- */
function setProg(s){AU.prog=s;const p=$("#auProg");if(p){p.textContent=s;p.hidden=!s}const g=$("#auGo");if(g)g.disabled=!!s}
const vidMedia=()=>projMedia().filter(m=>m.kind==="video");
function autoModal(kind){const box=$("#modal");if(box.dataset.k===kind)return;box.dataset.k=kind;const vm=projMedia().filter(m=>m.kind==="video"||m.kind==="image"),am=projMedia().filter(m=>m.kind==="audio");
  const list=(ms,checked,name)=>ms.length?`<div class="aulist">${ms.map(m=>`<label><input type="checkbox" name="${name}" value="${esc(m.id)}" ${checked(m)?"checked":""}><span>${esc(m.name)}</span><em>${m.kind==="image"?"still":shortTC(m.dur||0,1)}</em></label>`).join("")}</div>`:`<div style="font-size:12px;color:var(--warn)">Import some ${name==="au-src"?"video":"camera"} clips first.</div>`;
  let h="";
  if(kind==="auto"){const last=AU.opts||{};h=`<h3>Auto Cut</h3><div style="font-size:12px;color:var(--muted);margin-top:-4px">Cuts your clips to the music. Smart mode has Claude watch the footage and build the story; Quick picks the most energetic moments on your device.</div>
    <div class="f"><label>Clips to cut from</label>${list(vm,m=>!last.ids||last.ids.includes(m.id),"au-src")}</div>
    <div class="two"><div class="f"><label for="au-music">Music</label><select id="au-music"><option value="">No music (steady pace)</option>${am.map(m=>`<option value="${esc(m.id)}" ${last.music===m.id?"selected":""}>${esc(m.name)}</option>`).join("")}</select></div>
      <div class="f"><label for="au-len">Length</label><select id="au-len"><option value="0">Match the music</option>${[10,15,30,45,60].map(v=>`<option value="${v}" ${last.len===v?"selected":""}>${v} s</option>`).join("")}</select></div></div>
    <div class="two"><div class="f"><label for="au-every">Cut on</label><select id="au-every">${[[1,"Every beat"],[2,"Every 2 beats"],[4,"Every 4 beats (a bar)"],[8,"Every 8 beats"]].map(([v,l])=>`<option value="${v}" ${(last.every||2)===v?"selected":""}>${l}</option>`).join("")}</select></div>
      <div class="f"><label for="au-pace">Without music, cut every</label><select id="au-pace">${[.8,1.2,2,3].map(v=>`<option value="${v}" ${(last.pace||1.2)===v?"selected":""}>${v} s</option>`).join("")}</select></div></div>
    <div class="f"><label for="au-brief">Story (optional)</label><textarea id="au-brief" rows="2" placeholder="e.g. Start in the empty room, build to the packed floor, end on the DJ.">${esc(last.brief||"")}</textarea></div>
    <div class="f"><label>Mode</label><span class="chips"><label><input type="radio" name="au-mode" value="smart" ${last.mode!=="quick"?"checked":""}> Smart: Claude picks the story</label><label><input type="radio" name="au-mode" value="quick" ${last.mode==="quick"?"checked":""}> Quick: on-device</label></span></div>
    <div class="f"><label>Options</label><span class="chips"><label><input type="radio" name="au-place" value="replace" ${last.place!=="append"?"checked":""}> Replace the storyline</label><label><input type="radio" name="au-place" value="append" ${last.place==="append"?"checked":""}> Add to the end</label><label><input type="checkbox" id="au-trans" ${last.trans?"checked":""}> Dissolve every bar</label><label><input type="checkbox" id="au-kb" ${last.kb!==false?"checked":""}> Push in on stills</label></span></div>
    <div class="auprog" id="auProg" hidden></div>
    <div class="acts"><button type="button" class="btn" id="auCancel">Cancel</button><button type="button" class="btn purple" id="auGo">Create cut</button></div>`}
  else if(kind==="mc"){const v=vidMedia();h=`<h3>New Multicam Clip</h3><div style="font-size:12px;color:var(--muted);margin-top:-4px">Pick 2–4 camera angles of the same moment. Edit Bay lines them up and lets you cut between them live.</div>
    <div class="f"><label>Angles</label>${list(v,(m)=>v.indexOf(m)<4,"mc-src")}</div>
    <div class="two"><div class="f"><label for="mc-sync">Sync by</label><select id="mc-sync"><option value="audio">Sound (best when every camera recorded audio)</option><option value="start">Clip start</option></select></div><div class="f"><label for="mc-aud">Use sound from</label><select id="mc-aud">${v.slice(0,8).map((m,i)=>`<option value="${i}">Angle ${i+1}</option>`).join("")}</select></div></div>
    <div class="f"><label for="mc-name">Name</label><input id="mc-name" value="Multicam"></div>
    <div class="auprog" id="auProg" hidden></div>
    <div class="acts"><button type="button" class="btn" id="auCancel">Cancel</button><button type="button" class="btn blue" id="mcGo">Create multicam</button></div>`}
  else if(kind==="sil"){h=`<h3>Remove Pauses</h3><div style="font-size:12px;color:var(--muted);margin-top:-4px">Finds quiet gaps in storyline clips that have sound, cuts them out and closes the gaps.</div>
    <div class="cprop"><label for="sl-db">Quieter than</label><input type="range" id="sl-db" min="-60" max="-20" step="1" value="-38"><span class="ro" id="sl-dbv">−38 dB</span><span></span></div>
    <div class="cprop"><label for="sl-min">Pauses over</label><input type="range" id="sl-min" min=".2" max="2" step=".05" value=".45"><span class="ro" id="sl-minv">0.45 s</span><span></span></div>
    <div class="cprop"><label for="sl-pad">Keep padding</label><input type="range" id="sl-pad" min="0" max=".4" step=".01" value=".1"><span class="ro" id="sl-padv">0.10 s</span><span></span></div>
    <div class="f"><span class="chips"><label><input type="radio" name="sl-scope" value="all" checked> Whole storyline</label><label><input type="radio" name="sl-scope" value="sel" ${E.sel.size?"":"disabled"}> Selected clips</label></span></div>
    <div class="auprog" id="auProg" hidden></div>
    <div class="acts"><button type="button" class="btn" id="auCancel">Cancel</button><button type="button" class="btn blue" id="slGo">Remove pauses</button></div>`}
  box.innerHTML=`<div class="ov" id="ov"><div class="dlg au" role="dialog" aria-label="${kind==="auto"?"Auto Cut":kind==="mc"?"New multicam clip":"Remove pauses"}">${h}</div></div>`;setProg(AU.prog)}
const _renderModal=renderModal;renderModal=function(){if(["auto","mc","sil"].includes(state.modal)){autoModal(state.modal);return}if($("#modal").dataset.k&&["auto","mc","sil"].includes($("#modal").dataset.k))$("#modal").dataset.k="";_renderModal()};
function openAuto(kind){if(!cur()){toast("PICK A PROJECT","Open a project first.");return}if(!getTL())return;pause();E.x=null;state.modal=kind;$("#modal").dataset.k="";render()}

/* ---------- wiring ---------- */
const _rmb2=renderMediaBrowser;renderMediaBrowser=function(){if(E.page==="edit"&&E.angleView)return renderAngles();_rmb2()};
const _rb2=renderBrowser;renderBrowser=function(){if(E.page==="edit"&&E.angleView){const t=$("#btabs");if(t)t.hidden=true;return renderAngles()}AV.key="";_rb2()};
const _eci=edClipInspector;edClipInspector=function(box){_eci(box);const c=selClips()[0];const mc=mcOf(c);if(!mc||box.querySelector(".mcang"))return;const head=box.querySelector(".ihead");if(!head)return;
  head.insertAdjacentHTML("afterend",`<div class="grp"><span>Multicam · ${esc(mc.name)}</span><button class="reset" data-angopen="1">Angle viewer</button></div><div class="mcang">${mc.angles.map((a,k)=>`<button class="btn sm ${k===(c.angle||0)?"blue":""}" data-angset="${k}" title="Switch this clip to ${esc(a.name)}">${k+1} · ${esc(a.name)}</button>`).join("")}</div>`)};
document.addEventListener("click",e=>{const t=e.target.closest("button");if(!t)return;const d=t.dataset;
  if(t.id==="autoBtn")openAuto("auto");else if(t.id==="mcBtn")openAuto("mc");else if(t.id==="silBtn")openAuto("sil");
  else if(t.id==="auCancel"){if(AU.busy)return;state.modal=null;$("#modal").dataset.k="";render()}
  else if(t.id==="auGo"){const q=n=>[...document.querySelectorAll(`input[name="${n}"]`)];AU.opts={ids:q("au-src").filter(x=>x.checked).map(x=>x.value),music:$("#au-music").value,len:+$("#au-len").value,every:+$("#au-every").value,pace:+$("#au-pace").value,brief:$("#au-brief").value.trim(),
      mode:(q("au-mode").find(x=>x.checked)||{}).value||"smart",place:(q("au-place").find(x=>x.checked)||{}).value||"replace",trans:$("#au-trans").checked,kb:$("#au-kb").checked};runAutoCut(AU.opts)}
  else if(t.id==="mcGo"){const ids=[...document.querySelectorAll('input[name="mc-src"]')].filter(x=>x.checked).map(x=>x.value).slice(0,4);createMulticam(ids,$("#mc-sync").value,+$("#mc-aud").value,$("#mc-name").value.trim()).catch(()=>{setProg("");toast("MULTICAM","Couldn’t build the multicam clip.")})}
  else if(t.id==="slGo"){removeSilences({db:+$("#sl-db").value,min:+$("#sl-min").value,pad:+$("#sl-pad").value,scope:(document.querySelector('input[name="sl-scope"]:checked')||{}).value}).catch(()=>setProg(""))}
  else if(d.angclose){E.angleView=false;AV.els.forEach(v=>{v.removeAttribute("src");v.load()});AV.els=[];AV.key="";$("#bbody").innerHTML="";render()}
  else if(d.angopen||t.id==="angBtn"){E.angleView=!E.angleView||!!d.angopen;if(E.page!=="edit")setPage("edit");$("#bbody").innerHTML="";AV.key="";render()}
  else if(d.angset!=null){switchAngle(+d.angset,false);$("#insp").dataset.k="";renderInsp()}
  else{const a=e.target.closest(".ang");if(a)switchAngle(+a.dataset.ang,!e.shiftKey)}});
document.addEventListener("input",e=>{const el=e.target;const m={"sl-db":v=>"−"+Math.abs(v)+" dB","sl-min":v=>(+v).toFixed(2)+" s","sl-pad":v=>(+v).toFixed(2)+" s"}[el.id];if(m){const o=$("#"+el.id+"v");if(o)o.textContent=m(el.value)}});
document.addEventListener("keydown",e=>{if(typing(e.target)||state.modal||e.metaKey||e.ctrlKey||e.altKey)return;const code=e.code||"";const n=/^Digit([1-9])$/.exec(code);
  if(n&&E.tl&&E.tl.mc&&Object.keys(E.tl.mc).length&&cur()){e.preventDefault();switchAngle(+n[1]-1,!e.shiftKey)}});
