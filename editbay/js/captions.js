/* Edit Bay — captions made in the browser. Whisper (via Transformers.js) turns a clip's speech into a word-level
   transcript on this device; nothing is uploaded. The transcript then drives text editing, filler removal and captions. */
const ASR={
  lib:"https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1",
  model:"onnx-community/whisper-base_timestamped",
  pipe:null,
  /* replaceable in tests; returns fn(Float32Array 16 kHz mono) -> {chunks:[{text,timestamp:[s,e]}]} */
  async load(onProgress){if(this.pipe)return this.pipe;const T=await import(this.lib);T.env.allowLocalModels=false;
    /* WebGPU with half-precision support: fp16 encoder + q4f16 decoder (~110 MB). Otherwise WASM with 8-bit weights (~77 MB). */
    let f16=false;try{const a=navigator.gpu&&await navigator.gpu.requestAdapter();f16=!!(a&&a.features.has("shader-f16"))}catch(e){}
    this.device=f16?"webgpu":"wasm";
    this.pipe=await T.pipeline("automatic-speech-recognition",this.model,{device:this.device,dtype:f16?{encoder_model:"fp16",decoder_model_merged:"q4f16"}:"q8",progress_callback:p=>{if(p&&p.status==="progress"&&onProgress)onProgress(p.file,p.progress)}});return this.pipe}
};
async function audio16k(m){let blob=null;if(m.localId&&typeof LBLOB!=="undefined"&&LBLOB.get){try{blob=await LBLOB.get(m.localId)}catch(e){}}
  if(!blob){const u=blobUrl(m);if(!u)throw new Error("The original file isn’t on this device.");blob=await (await fetch(u)).blob()}
  const buf=await blob.arrayBuffer();const tmp=new OfflineAudioContext(1,16000,16000);const dec=await tmp.decodeAudioData(buf);
  const oc=new OfflineAudioContext(1,Math.ceil(dec.duration*16000),16000);const s=oc.createBufferSource();s.buffer=dec;s.connect(oc.destination);s.start();return(await oc.startRendering()).getChannelData(0)}
let asrBusy=false,asrCancel=false;
async function transcribeMedia(m,opts){if(asrBusy){toast("CAPTIONS","Already transcribing. Wait for it to finish.");return null}asrBusy=true;asrCancel=false;opts=opts||{};
  const ui=sheet("sh-asr",`<h3>Making captions</h3><p id="asrMsg" style="font-size:12.5px;color:var(--muted);margin:0 0 8px">Getting the speech model ready. The first time, this downloads about 80–110 MB; after that it’s instant and works offline.</p><div class="sb"><i id="asrBar" style="width:2%"></i></div><p style="font-size:11.5px;color:var(--dim)">Runs on this device. ${esc(m.name)} is not uploaded.</p><div class="acts"><button class="btn" data-asrcancel="1">Cancel</button></div>`,"Making captions");
  const msg=t=>{const e=$("#asrMsg");if(e)e.textContent=t},bar=p=>{const e=$("#asrBar");if(e)e.style.width=Math.max(2,Math.min(100,p)).toFixed(0)+"%"};
  try{const files={};const pipe=await ASR.load((f,p)=>{files[f]=p||0;const v=Object.values(files);bar(v.reduce((a,b)=>a+b,0)/Math.max(1,v.length)*.6)});if(asrCancel)throw new Error("cancel");
    msg("Reading the sound from "+m.name+"…");bar(62);const pcm=await audio16k(m);if(asrCancel)throw new Error("cancel");
    msg("Listening… ("+Math.round(pcm.length/16000)+" s of audio. On a laptop this takes roughly a third of that.)");bar(70);
    const out=await pipe(pcm,{return_timestamps:"word",chunk_length_s:30,stride_length_s:5,language:opts.lang||null});if(asrCancel)throw new Error("cancel");
    const words=(out.chunks||[]).map(c=>({s:+(c.timestamp[0]||0),e:+(c.timestamp[1]==null?(c.timestamp[0]||0)+.3:c.timestamp[1]),t:String(c.text||"").trim()})).filter(w=>w.t&&w.e>=w.s);
    if(!words.length)throw new Error("No speech found in "+m.name+".");
    const tx={words,by:"whisper"};m.tx=tx;if(db)await db.doc("media/"+m.id).update({tx}).catch(()=>{});
    bar(100);closeSheet("sh-asr");track("transcribe");return tx}
  catch(e){closeSheet("sh-asr");if(e&&e.message==="cancel"){toast("CAPTIONS","Stopped.");return null}
    const net=/fetch|network|import|load|Failed to/i.test(String(e&&e.message));toast("CAPTIONS",net?"Couldn’t download the speech model. Check your connection and try again. (It downloads once, then works offline.)":String((e&&e.message)||"Transcription failed."));return null}
  finally{asrBusy=false}}
document.addEventListener("click",e=>{if(e.target.closest("[data-asrcancel]")){asrCancel=true;closeSheet("sh-asr")}});

/* words → caption lines: up to ~32 characters or 3 s each, breaking at pauses and sentence ends */
function captionCues(units,max){max=max||32;const cues=[];let cur0=null;for(const u of units){const gap=cur0?u.a-cur0.b:0;
    if(cur0&&(gap>.6||(cur0.t+" "+u.t).length>max+(/[.!?]$/.test(u.t)&&u.t.length<=8?8:0)||u.b-cur0.a>3||/[.!?]$/.test(cur0.t))){cues.push(cur0);cur0=null}
    if(!cur0)cur0={a:u.a,b:u.b,t:u.t};else{cur0.t+=" "+u.t;cur0.b=u.b}}if(cur0)cues.push(cur0);return cues}
/* line length follows the frame: short lines on vertical video so captions never run off the edge */
function placeCaptions(){const us=txUnits();if(!us.length)return 0;const a=E.tl.w/E.tl.h;const cues=captionCues(us,a<.8?18:a<1.2?24:34);
  edit(tl=>{tl.clips=tl.clips.filter(c=>!(c.track==="V3"&&c.type==="title"&&c.autoCap));cues.forEach(q=>{const c=newTitle(q.a);Object.assign(c,clone(TPRESETS.caption),{track:"V3",text:q.t,out:Math.max(.4,q.b-q.a+.12),name:"Caption",fadeIn:0,fadeOut:0,autoCap:true});tl.clips.push(c)})});return cues.length}
async function autoCaptions(){if(!getTL()||!E.tl.clips.length){toast("CAPTIONS","Put the clips with speech on the timeline first.");return}
  const ms=[...new Set(E.tl.clips.filter(c=>c.mediaId&&!c.off&&(c.track==="V1"||c.type==="audio")).map(c=>c.mediaId))].map(mediaOf).filter(m=>m&&m.kind!=="image");
  if(!ms.length){toast("CAPTIONS","No video or audio with sound on the storyline or audio tracks.");return}
  for(const m of ms)if(!m.tx){const r=await transcribeMedia(m);if(!r)return}
  const n=placeCaptions();toast("CAPTIONS",n?`${n} captions placed on V3. Edit any of them in the Inspector, or fix words in Browser › Timeline › Text.`:"No speech landed on the timeline.")}
document.addEventListener("click",e=>{const b=e.target.closest("[data-autocap]");if(b){e.preventDefault();autoCaptions()}
  const t=e.target.closest("[data-txauto]");if(t){e.preventDefault();const sel=selClips()[0];const m=mediaOf((sel&&sel.mediaId)||(projMedia().find(x=>x.kind!=="image")||{}).id);if(!m){toast("TRANSCRIPT","Import a clip with speech first.");return}
    transcribeMedia(m).then(tx=>{if(tx){toast("TRANSCRIPT",tx.words.length+" words from "+m.name+". Edit by deleting text, or make captions.");state.ixtab="text";state.btab="index";renderBrowser()}})}});

/* entry points: Captions button menu, Text tab, command search */
function capButtons(){const b=$("#srtBtn");if(b&&!$("#autoCapBtn"))b.insertAdjacentHTML("beforebegin",`<button class="btn" id="autoCapBtn" data-autocap="1" title="Listen to the speech on the timeline and place captions on V3 (runs on this device)">Auto captions</button>`);
  const tb=document.querySelector(".txbar");if(tb&&!tb.querySelector("[data-txauto]"))tb.insertAdjacentHTML("beforeend",`<button class="btn sm" data-txauto="1" title="Make a word-level transcript on this device">Transcribe</button>`);
  const em=document.querySelector("#ixbody .empty");if(em&&/No transcript yet/.test(em.textContent)&&!em.querySelector("[data-txauto]"))em.insertAdjacentHTML("beforeend",` <button class="btn sm purple" data-txauto="1">Transcribe here</button>`)}
const _rmbC=renderMediaBrowser;renderMediaBrowser=function(...a){const r=_rmbC.apply(this,a);capButtons();return r};
const _rtC=renderText;renderText=function(...a){const r=_rtC.apply(this,a);capButtons();return r};
if(typeof cmdList==="function"){const _cl=cmdList;cmdList=function(){const L=_cl();if(cur()){L.unshift({g:"Captions",l:"Auto captions from speech",f:autoCaptions});L.push({g:"Captions",l:"Transcribe selected clip",f:()=>{const b=document.createElement("button");b.dataset.txauto=1;b.hidden=true;document.body.appendChild(b);b.click();b.remove()}})}
  L.push({g:"Help",l:"Check this browser",f:sysCheck},{g:"Help",l:"Open sample project",f:makeSample},{g:"Help",l:"Usage counts",f:()=>{const b=document.createElement("button");b.dataset.usagetoggle=1;b.hidden=true;document.body.appendChild(b);b.click();b.remove()}});return L}}
