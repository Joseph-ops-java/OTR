/* Edit Bay — offline renderer. Frame-accurate export with WebCodecs (H.264 + AAC/Opus in MP4), an offline 48 kHz audio mix,
   ITU-R BS.1770 loudness measurement, normalisation with a look-ahead peak limiter, and fast transcodes for proxies.
   Falls back to the real-time recorder in browsers without WebCodecs. */
const FAST_OK=typeof VideoEncoder!=="undefined"&&typeof VideoFrame!=="undefined"&&typeof Mp4Muxer!=="undefined";
const SR=48000;const HQ={};
const even=n=>Math.max(2,Math.round(n/2)*2);
async function decodeHQ(m){if(HQ[m.id])return HQ[m.id];const p=(async()=>{const buf=await(await fetch(blobUrl(m))).arrayBuffer();const oc=new OfflineAudioContext(2,1,SR);
  return await new Promise((res,rej)=>{const q=oc.decodeAudioData(buf,res,rej);if(q&&q.then)q.then(res,rej)})})();HQ[m.id]=p;p.catch(()=>{delete HQ[m.id]});return p}
function seekEl(el,t){return new Promise(res=>{if(Math.abs(el.currentTime-t)<1e-4&&el.readyState>=2)return res();let done=false;const fin=()=>{if(done)return;done=true;el.removeEventListener("seeked",fin);res()};el.addEventListener("seeked",fin);el.currentTime=t;setTimeout(fin,4000)})}
function readyEl(el){return new Promise(res=>{if(el.readyState>=2)return res();const ok=()=>res();el.addEventListener("loadeddata",ok,{once:true});el.addEventListener("error",ok,{once:true});setTimeout(ok,8000)})}

/* put every visible source on the exact frame for timeline time t */
async function prepFrame(t){E.t=t;E.skimT=null;const tl=E.tl;const waits=[];E.fo=E.fo||new Map();E.fo.clear();
  for(const c of tl.clips){if(c.off||!trackOn(c.track))continue;const[w0,w1]=winOf(c);if(t<w0||t>=w1)continue;
    if(c.type==="video"){waits.push((async()=>{const fr=await frameFor(c,t);if(fr){const d=await demux(mediaOf(c.mediaId)).catch(()=>null);E.fo.set(c.id,{frame:fr,rot:d?d.rot:0});return}
      const r=getRec(c);if(!r)return;const el=r.el;if(!el.paused)el.pause();await readyEl(el);await seekEl(el,srcTime(c,t)+.0005)})())}
    else if(c.type==="image"){const m=mediaOf(c.mediaId);if(m){const i=imgFor(m);if(!i.complete)waits.push(i.decode().catch(()=>{}))}}}
  await Promise.all(waits)}

/* ---------- offline audio mix ---------- */
async function renderMix(a,b,onp){const len=Math.ceil((b-a)*SR);if(len<=0)return null;const tl=E.tl;const oc=new OfflineAudioContext(2,len,SR);
  const master=oc.createGain();master.gain.value=tl.master!=null?tl.master:1;master.connect(oc.destination);
  const bus={};TRACKS.forEach(tr=>{bus[tr]=buildBus(oc,tr,master).g});
  const clips=tl.clips.filter(c=>!c.off&&trackOn(c.track)&&(c.type==="audio"||(c.type==="video"&&!c.freeze&&((c.vol==null?1:c.vol)>0||(c.kf&&c.kf.vol))))&&audWin(c)[1]>a&&audWin(c)[0]<b);
  let n=0,any=false;
  for(const c of clips){const m=mediaOf(c.mediaId);if(!m)continue;let buf;try{buf=await decodeHQ(m)}catch(e){continue}if(onp)onp(++n/clips.length);
    const sp=c.speed||1,aw=audWin(c),t0=Math.max(aw[0],a),t1=Math.min(aw[1],b);if(t1<=t0)continue;
    const g=oc.createGain(),pan=oc.createStereoPanner();pan.pan.value=clamp(c.pan||0,-1,1);g.connect(pan);pan.connect(bus[c.track]||master);
    const step=1/100;for(let t=t0;t<=t1+step;t+=step){const tt=Math.min(t,t1);const v=Math.max(0,kv(c,"vol",tt)*fadeAt(c,tt)*audGate(c,Math.min(tt,t1-1e-6)));if(t===t0)g.gain.setValueAtTime(v,tt-a);else g.gain.linearRampToValueAtTime(v,tt-a)}
    if(c.reverse){const r=reversed(buf);const s=oc.createBufferSource();s.buffer=r;s.playbackRate.value=sp;s.connect(g);const srcEnd=c.out,srcAtT0=c.out-(t0-c.start)*sp;s.start(t0-a,Math.max(0,buf.duration-srcAtT0),(t1-t0)*sp);any=true;continue}
    if(c.ramp&&c.ramp.length){/* speed ramp: render segment by segment at each ramp speed */let t=t0;while(t<t1-1e-4){const seg=Math.min(t1,t+.1);const s=oc.createBufferSource();s.buffer=buf;const rs=rampSpeed(c,t);s.playbackRate.value=rs;s.connect(g);s.start(t-a,Math.max(0,srcTime(c,t)),(seg-t)*rs);t=seg}any=true;continue}
    const s=oc.createBufferSource();s.buffer=buf;s.playbackRate.value=sp;s.connect(g);const so=c.in+(t0-c.start)*sp;s.start(t0-a+Math.max(0,-so)/sp,Math.max(0,so),(t1-t0)*sp-Math.max(0,-so));any=true}
  if(!any)return null;return await oc.startRendering()}
const REV=new WeakMap();function reversed(buf){if(REV.has(buf))return REV.get(buf);const r=new AudioBuffer({length:buf.length,numberOfChannels:buf.numberOfChannels,sampleRate:buf.sampleRate});
  for(let ch=0;ch<buf.numberOfChannels;ch++){const s=buf.getChannelData(ch),d=r.getChannelData(ch);for(let i=0,n=s.length;i<n;i++)d[i]=s[n-1-i]}REV.set(buf,r);return r}

/* ---------- loudness (ITU-R BS.1770-4 / EBU R128) ---------- */
function biquad(x,b,a){const y=new Float32Array(x.length);let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<x.length;i++){const v=b[0]*x[i]+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2;x2=x1;x1=x[i];y2=y1;y1=v;y[i]=v}return y}
function kweight(x){return biquad(biquad(x,[1.53512485958697,-2.69169618940638,1.19839281085285],[1,-1.69065929318241,.73248077421585]),[1,-2,1],[1,-1.99004745483398,.99007225036621])}
function loudness(buf){if(!buf)return null;const chs=[];for(let c=0;c<Math.min(2,buf.numberOfChannels);c++)chs.push(kweight(buf.getChannelData(c)));const sr=buf.sampleRate,blk=Math.round(.4*sr),hop=Math.round(.1*sr);
  const z=[];for(let s=0;s+blk<=chs[0].length;s+=hop){let t=0;for(const x of chs){let q=0;for(let i=s;i<s+blk;i++)q+=x[i]*x[i];t+=q/blk}z.push(t)}
  const L=v=>-.691+10*Math.log10(v);let peak=0;for(let c=0;c<buf.numberOfChannels;c++){const d=buf.getChannelData(c);for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);if(v>peak)peak=v}}
  const st=[];for(let i=0;i+29<z.length;i+=1){let t=0;for(let k=i;k<i+30;k++)t+=z[k];st.push(L(t/30))}
  const abs=z.filter(v=>L(v)>-70);if(!abs.length)return{I:-Infinity,peak:20*Math.log10(peak||1e-9),stMax:-Infinity};
  const rel=L(abs.reduce((s,v)=>s+v,0)/abs.length)-10;const g=abs.filter(v=>L(v)>rel);
  return{I:L(g.reduce((s,v)=>s+v,0)/g.length),peak:20*Math.log10(peak||1e-9),stMax:st.length?Math.max(...st):L(Math.max(...z))}}
/* normalise to a target with a 5 ms look-ahead peak limiter (sample peak) */
function normalise(buf,target,ceilDb){const m=loudness(buf);if(!m||!isFinite(m.I))return{before:m,after:m,gain:0};const gDb=target-m.I,g=Math.pow(10,gDb/20),ceil=Math.pow(10,ceilDb/20);
  const n=buf.length,chs=[...Array(buf.numberOfChannels)].map((_,c)=>buf.getChannelData(c));const need=new Float32Array(n);
  for(let i=0;i<n;i++){let p=0;for(const d of chs){const v=Math.abs(d[i]*g);if(v>p)p=v}need[i]=p>ceil?ceil/p:1}
  const la=Math.round(.005*buf.sampleRate),rel=Math.exp(-1/(.08*buf.sampleRate));const red=new Float32Array(n);const dq=[];
  for(let i=0;i<n+la;i++){if(i<n){while(dq.length&&need[dq[dq.length-1]]>=need[i])dq.pop();dq.push(i)}const j=i-la;if(j<0)continue;while(dq.length&&dq[0]<j-la)dq.shift();red[j]=dq.length?need[dq[0]]:1}
  let env=1;for(let i=0;i<n;i++){const t=red[i];env=t<env?t:t+(env-t)*rel;const k=g*Math.min(env,t<env?t:env);for(const d of chs)d[i]=clamp(d[i]*k,-ceil,ceil)}
  return{before:m,after:loudness(buf),gain:gDb}}
async function measureTimeline(){if(!E.tl)return null;const b=await renderMix(0,tlDur());return b?loudness(b):null}

/* ---------- encoders ---------- */
/* label the stream Rec.709 so players decode the colours the way the canvas showed them */
const REC709={primaries:"bt709",transfer:"bt709",matrix:"bt709",fullRange:false};
function tagColour(m){if(m&&m.decoderConfig)m.decoderConfig.colorSpace=REC709;return m}
/* our own RGB -> Y'CbCr 4:2:0 (Rec.709, studio range), so every browser's encoder gets identical, correctly labelled input */
let YUV=null;
function frameFromCanvas(cv,ts,dur){const W=cv.width,H=cv.height,px=new Uint32Array(cv.getContext("2d").getImageData(0,0,W,H).data.buffer),cw=W>>1,ch=H>>1;
  if(!YUV||YUV.length!==W*H+2*cw*ch)YUV=new Uint8Array(W*H+2*cw*ch);const Y=YUV,uo=W*H,vo=uo+cw*ch;
  for(let i=0,n=W*H;i<n;i++){const v=px[i];Y[i]=(47*(v&255)+157*((v>>8)&255)+16*((v>>16)&255)+4224)>>8}
  for(let y=0;y<ch;y++){let i0=2*y*W,i1=i0+W,o=y*cw;for(let x=0;x<cw;x++,i0+=2,i1+=2,o++){const a=px[i0],b=px[i0+1],c=px[i1],d=px[i1+1];
    const r=(a&255)+(b&255)+(c&255)+(d&255),g=((a>>8)&255)+((b>>8)&255)+((c>>8)&255)+((d>>8)&255),bl=((a>>16)&255)+((b>>16)&255)+((c>>16)&255)+((d>>16)&255);
    Y[uo+o]=(-26*r-87*g+113*bl+131072+512)>>10;Y[vo+o]=(113*r-102*g-11*bl+131072+512)>>10}}
  return new VideoFrame(Y,{format:"I420",codedWidth:W,codedHeight:H,timestamp:ts,duration:dur,colorSpace:REC709})}
async function pickVideoCodec(w,h,fps,br){const big=w*h>2100000;const list=big?["avc1.640033","avc1.4d0033","avc1.42e033"]:["avc1.640028","avc1.4d0028","avc1.42e028","avc1.42e01f"];
  for(const codec of list){try{const r=await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate:br,framerate:fps});if(r.supported)return codec}catch(e){}}return null}
async function pickAudioCodec(){if(typeof AudioEncoder==="undefined")return null;for(const[codec,mux]of[["mp4a.40.2","aac"],["opus","opus"]]){try{const r=await AudioEncoder.isConfigSupported({codec,sampleRate:SR,numberOfChannels:2,bitrate:192000});if(r.supported)return{codec,mux}}catch(e){}}return null}
async function encodeAudio(buf,ac,muxer,onp){const ae=new AudioEncoder({output:(c,m)=>muxer.addAudioChunk(c,m),error:e=>{throw e}});ae.configure({codec:ac.codec,sampleRate:SR,numberOfChannels:2,bitrate:192000});
  const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L,N=4800;
  for(let o=0;o<buf.length;o+=N){const n=Math.min(N,buf.length-o);const d=new Float32Array(n*2);d.set(L.subarray(o,o+n),0);d.set(R.subarray(o,o+n),n);
    const ad=new AudioData({format:"f32-planar",sampleRate:SR,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(o/SR*1e6),data:d});ae.encode(ad);ad.close();
    if(ae.encodeQueueSize>20)await new Promise(r=>setTimeout(r,0));if(onp&&o%(N*50)===0)onp(o/buf.length)}
  await ae.flush();ae.close()}

/* ---------- the export ---------- */
async function fastExport(x){const tl=E.tl,fps=tl.fps||30,sc=x.scale||1,W=even(tl.w*sc),H=even(tl.h*sc);const T0=performance.now();
  const useR=x.range&&E.rin!=null&&E.rout!=null&&E.rout>E.rin;const a=useR?E.rin:0,b=useR?E.rout:tlDur();const N=Math.max(1,Math.round((b-a)*fps));
  x.start=a;x.end=b;x.w=W;x.h=H;x.phase="running";x.pct=0;x.stage="Mixing audio";$("#modal").dataset.k="";edModal();pause();E.compare=false;E.rendering=true;
  const keepT=E.t;let err=null;
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const br={max:25e6,hi:12e6,std:6e6,sm:3e6}[x.q||"std"]*Math.max(.35,sc*sc>.99?1:Math.sqrt(sc));
    const vc=await pickVideoCodec(W,H,fps,br);if(!vc)throw new Error("This browser can’t encode H.264 at "+W+"×"+H+".");
    let mix=await renderMix(a,b,f=>{x.pct=f*5;edModal()});if(x.cancel)throw new Error("cancel");
    x.loud=null;if(mix&&x.lufs!=="off"){x.stage="Measuring loudness";edModal();await new Promise(r=>setTimeout(r,0));x.loud=normalise(mix,+x.lufs,-1)}else if(mix)x.loud={before:loudness(mix),after:null};
    const ac=mix?await pickAudioCodec():null;
    const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:"avc",width:W,height:H,frameRate:fps},audio:ac?{codec:ac.mux,numberOfChannels:2,sampleRate:SR}:undefined,fastStart:"in-memory",firstTimestampBehavior:"offset"});
    const ve=new VideoEncoder({output:(c,m)=>muxer.addVideoChunk(c,tagColour(m)),error:e=>{err=e}});ve.configure({codec:vc,width:W,height:H,bitrate:br,framerate:fps,latencyMode:"quality",bitrateMode:"variable"});
    const full=document.createElement("canvas");full.width=tl.w;full.height=tl.h;let out=full,ox=null;if(sc<1){out=document.createElement("canvas");out.width=W;out.height=H;ox=out.getContext("2d");ox.imageSmoothingQuality="high"}
    x.stage="Rendering frames";
    for(let i=0;i<N;i++){if(x.cancel)throw new Error("cancel");if(err)throw err;const t=a+i/fps;await prepFrame(t);drawFrame(full);if(ox)ox.drawImage(full,0,0,W,H);
      const fr=frameFromCanvas(out,Math.round(i*1e6/fps),Math.round(1e6/fps));ve.encode(fr,{keyFrame:i%Math.round(fps*2)===0});fr.close();
      while(ve.encodeQueueSize>6)await new Promise(r=>setTimeout(r,1));if(i%6===0){x.pct=5+i/N*90;x.tc=t;edModal()}}
    await ve.flush();ve.close();if(err)throw err;
    if(mix&&ac){x.stage="Encoding audio";edModal();await encodeAudio(mix,ac,muxer,f=>{x.pct=95+f*4;edModal()})}
    muxer.finalize();const blob=new Blob([muxer.target.buffer],{type:"video/mp4"});
    x.blob=blob;x.url=URL.createObjectURL(blob);x.ext="mp4";x.codec="H.264"+(ac?" + "+(ac.mux==="aac"?"AAC":"Opus"):"");x.secs=(performance.now()-T0)/1000;x.realtime=(b-a)/x.secs;x.phase="done"}
  catch(e){if(e&&e.message==="cancel"){E.x=null;state.modal=null}else{x.phase="error";x.err=(e&&e.message)||"The render stopped."}}
  finally{E.rendering=false;closeFrameSources();E.fo=null;E.t=keepT;sync();requestDraw();$("#modal").dataset.k="";if(state.modal)edModal();else render()}}

/* ---------- fast transcode: proxies and constant-frame-rate conforms ---------- */
async function transcode(m,{maxEdge=1280,bitrate=3e6,fps=30,onp}={}){if(!FAST_OK)return null;let d=null;try{d=await demux(m)}catch(e){d=null}
  let v=null,dur=m.dur||1,vw=m.w||1280,vh=m.h||720,rot=0;if(d){rot=d.rot;vw=d.w;vh=d.h;dur=Math.max(...d.samples.map(x=>x.cts+x.dur))}else{v=document.createElement("video");v.muted=true;v.preload="auto";v.playsInline=true;v.crossOrigin="anonymous";v.src=blobUrl(m);await loadMeta(v);await readyEl(v);dur=v.duration||dur;vw=v.videoWidth||vw;vh=v.videoHeight||vh}
  const ow=rot%180?vh:vw,oh=rot%180?vw:vh,sc=Math.min(1,maxEdge/Math.max(ow,oh)),W=even(ow*sc),H=even(oh*sc);
  const vc=await pickVideoCodec(W,H,fps,bitrate);if(!vc)return null;let ac=null,buf=null;try{buf=await decodeHQ(m);ac=await pickAudioCodec()}catch(e){buf=null}
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:"avc",width:W,height:H,frameRate:fps},audio:buf&&ac?{codec:ac.mux,numberOfChannels:2,sampleRate:SR}:undefined,fastStart:"in-memory",firstTimestampBehavior:"offset"});
  let err=null;const ve=new VideoEncoder({output:(c,mm)=>muxer.addVideoChunk(c,tagColour(mm)),error:e=>{err=e}});ve.configure({codec:vc,width:W,height:H,bitrate,framerate:fps});
  const cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");const N=Math.max(1,Math.floor(dur*fps));const fs=d?new FrameSource(d):null;
  try{for(let i=0;i<N;i++){if(err)throw err;let src=null,sw=vw,sh=vh;if(fs){src=await fs.frameAt(i/fps);if(src){sw=src.displayWidth;sh=src.displayHeight}}else{await seekEl(v,i/fps+.0005);src=v}
    if(src){x.save();x.translate(W/2,H/2);x.rotate(rot*Math.PI/180);const s2=rot%180?Math.max(W/sh,H/sw):Math.max(W/sw,H/sh);x.drawImage(src,-sw*s2/2,-sh*s2/2,sw*s2,sh*s2);x.restore()}
    const f=frameFromCanvas(cv,Math.round(i*1e6/fps),Math.round(1e6/fps));ve.encode(f,{keyFrame:i%(fps*2)===0});f.close();
    while(ve.encodeQueueSize>6)await new Promise(r=>setTimeout(r,1));if(onp&&i%10===0)onp(i/N*.9)}}finally{if(fs)fs.close()}
  await ve.flush();ve.close();if(buf&&ac){const b2=new AudioBuffer({length:Math.min(buf.length,Math.ceil(dur*SR)),numberOfChannels:2,sampleRate:SR});for(let c=0;c<2;c++)b2.copyToChannel(buf.getChannelData(Math.min(c,buf.numberOfChannels-1)).subarray(0,b2.length),c);await encodeAudio(b2,ac,muxer)}
  muxer.finalize();if(v){v.removeAttribute("src");v.load()}return new Blob([muxer.target.buffer],{type:"video/mp4"})}
/* playback proxies: a light constant-frame-rate copy kept on this device, used only for playback (exports use the original) */
async function optimizeMedia(m){if(!m||m.kind!=="video")return;const job={id:"op-"+m.id,name:m.name+" · optimizing",proxy:true,pct:0};E.uploads.push(job);renderMediaBrowser();
  try{const fps=Math.min(30,Math.round(E.tl&&E.tl.fps||30));const blob=await transcode(m,{maxEdge:960,bitrate:2.5e6,fps,onp:f=>{job.pct=f;renderMediaBrowser()}});if(!blob)throw new Error("This browser can’t make playback proxies.");
    const lid=await LBLOB.put(blob);m.pxLocalId=lid;if(db)await db.doc("media/"+m.id).update({pxLocalId:lid}).catch(()=>{});E.useProxy=true;recs.forEach((r,id)=>{if(r.c&&r.c.mediaId===m.id)dropRec(id)});requestDraw();
    toast("OPTIMIZED",m.name+" now plays from a light "+fmtBytes(blob.size)+" proxy. Exports still use the original.")}
  catch(e){toast("COULDN’T OPTIMIZE",(e&&e.message)||"Try again.")}finally{E.uploads=E.uploads.filter(u=>u!==job);renderMediaBrowser()}}
/* hook the export dialog: fast path when available, real-time recorder otherwise */
const _runExport=runExport;runExport=async function(){const x=E.x;if(!x)return;if(FAST_OK&&x.engine!=="rt")return fastExport(x);return _runExport()};
const _cancelExport=cancelExport;cancelExport=function(){const x=E.x;if(x&&x.phase==="running"&&E.rendering){x.cancel=true;return}_cancelExport()};
