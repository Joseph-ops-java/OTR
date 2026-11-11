/* Edit Bay — voiceover from text. Kokoro (an open text-to-speech model, Apache-2.0) runs in the browser and speaks a
   script onto the timeline. The AI can write the script from facts already in the project. Nothing is uploaded.
   On claude.ai the model loads from the copy published with Edit Bay; elsewhere it downloads once from Hugging Face. */
const VOICES={af_heart:"Heart · warm, female (US)",af_bella:"Bella · bright, female (US)",am_michael:"Michael · deep, male (US)",bm_george:"George · calm, male (UK)"};
const TTS={model:null,tok:null,ph:null,T:null,voices:{},
  async load(onProgress){if(this.model)return;const T=this.T=await import(ASR.lib);T.env.allowLocalModels=false;const cb=p=>{if(p&&p.status==="progress"&&onProgress)onProgress(p.file,p.progress)};
    this.ph=(await import("https://cdn.jsdelivr.net/npm/phonemizer@1.2.1/+esm")).phonemize;
    const local=!HOSTED||BUNDLED;if(local){await bundledModels(T,onProgress);this.id="kokoro"}else this.id="onnx-community/Kokoro-82M-v1.0-ONNX";
    this.model=await T.StyleTextToSpeech2Model.from_pretrained(this.id,{dtype:"q8",device:"wasm",progress_callback:cb});this.tok=await T.AutoTokenizer.from_pretrained(this.id)},
  async voice(v){if(this.voices[v])return this.voices[v];const buf=BUNDLED?await (await BUNDLED.joined("kokoro/voices/"+v+".bin")).arrayBuffer():await (await fetch("https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/"+v+".bin")).arrayBuffer();return this.voices[v]=new Float32Array(buf)},
  /* replaceable in tests: text -> Float32Array at 24 kHz */
  async speak(text,v,speed,onProgress){await this.load(onProgress);const T=this.T,data=await this.voice(v);const lang=v[0]==="b"?"en":"en-us";
    /* speak sentence by sentence (the model takes about 500 sounds at a time), keeping the punctuation so it pauses */
    const parts=String(text).replace(/\s+/g," ").match(/[^.!?;:]+[.!?;:]*/g)||[];const out=[];let n=0;
    for(const part of parts){const m=part.trim().match(/^(.*?)([.!?;:,]*)$/);if(!m[1])continue;const ph=((await this.ph(m[1],lang)).join(" ")+(m[2]?m[2][0]:"")).replace(/ʲ/g,"j").replace(/r/g,"ɹ").replace(/x/g,"k").replace(/ɬ/g,"l").trim();
      const inp=this.tok(ph,{truncation:true});const k=inp.input_ids.dims.at(-1);const off=256*Math.min(Math.max(k-2,0),509);
      const r=await this.model({input_ids:inp.input_ids,style:new T.Tensor("float32",data.slice(off,off+256),[1,256]),speed:new T.Tensor("float32",[speed||1],[1])});
      out.push(new Float32Array(r.waveform.data));out.push(new Float32Array(Math.round(24000*(/[.!?]/.test(m[2])?.28:.12))));n++;if(onProgress)onProgress("speaking",n/parts.length*100)}
    const len=out.reduce((a,b)=>a+b.length,0),w=new Float32Array(len);let o=0;out.forEach(b=>{w.set(b,o);o+=b.length});return w}};
let ttsBusy=false;
async function makeVoiceover(text,o){o=o||{};text=String(text||"").trim();if(!text||!getTL())return null;if(ttsBusy){toast("VOICEOVER","Already speaking. Wait for it to finish.");return null}ttsBusy=true;
  const msg=t=>{const e=$("#voMsg");if(e)e.textContent=t};const files={};
  try{msg("Getting the voice ready (about 90 MB the first time)…");const pcm=await TTS.speak(text,VOICES[o.voice]?o.voice:"af_heart",clamp(+o.speed||1,.7,1.4),(f,p)=>{files[f]=p;if(f==="speaking")msg("Speaking… "+Math.round(p)+"%")});
    const ac=new OfflineAudioContext(1,pcm.length,24000);const buf=ac.createBuffer(1,pcm.length,24000);buf.getChannelData(0).set(pcm);
    const name=`Voiceover - ${text.slice(0,28).replace(/[^\w ]/g,"").trim()} (generated).wav`;const f=new File([wavBlob(buf)],name,{type:"audio/wav"});await importFiles([f]);
    const m=[...state.media].reverse().find(x=>x.name===name&&x.projectId===cur().id);if(!m)throw new Error("import");const at=o.at!=null&&isFinite(+o.at)?Math.max(0,+o.at):E.t;
    const busy=t=>E.tl.clips.some(c=>c.track===t&&c.start<at+pcm.length/24000&&cend(c)>at);const tr=TRACKS.filter(t=>t[0]==="A").find(t=>!busy(t))||"A1";
    let c=null;edit(tl=>{c=newClip(m,tr,at);Object.assign(c,{track:tr,start:at,by:"claude",gen:"vo",name});tl.clips.push(c);relink(c)});
    closeSheet("sh-vo");toast("VOICEOVER",`${(pcm.length/24000).toFixed(1)} s of voiceover on ${tr}. It’s a synthetic voice: say so where a platform asks. Re-record it yourself when you can.`);if(typeof track==="function")track("voiceover");return c}
  catch(e){const net=/fetch|import|load|Failed to/i.test(String(e&&e.message));msg(net?"Couldn’t load the voice model. Check your connection and try again.":"Couldn’t make the voiceover: "+(e.message||"error"));return null}finally{ttsBusy=false}}
async function writeVoScript(){const S=await getSample();if(!S||(HOSTED&&typeof aiConf==="function"&&aiConf().p==="local")){toast("VOICEOVER","Set up an AI first (Help › AI Settings), or type the script yourself.");return}
  const f=scoreFacts();const facts=[cur().title,...E.tl.clips.filter(c=>c.type==="title").map(c=>c.text)].filter(Boolean).map(t=>String(t).slice(0,100)).slice(0,30);const b=$("#voWrite");if(b)b.disabled=true;
  try{const r=await S.json(`Write a voiceover script for a ${f.D.toFixed(0)}-second video. Spoken pace is about 2.5 words a second, so at most ${Math.round(f.D*2.2)} words. Short, punchy sentences that tell a story: hook, build, pay-off.
Use ONLY facts from this list (names, dates, places). Never invent any: ${JSON.stringify(facts)}
Reply with ONLY JSON: {"script":"..."}`,{modelTier:"default"});if(r&&r.script&&$("#voText"))$("#voText").value=String(r.script).slice(0,1200)}catch(e){toast("VOICEOVER","The AI couldn’t write a script just now.")}finally{if(b)b.disabled=false}}
function openVoiceover(){if(!cur()){toast("VOICEOVER","Open a project first.");return}
  sheet("sh-vo",`<h3>Voiceover</h3><p style="font-size:12.5px;line-height:1.5;color:var(--muted);margin:0 0 10px">Type what to say, or let the AI write it from the facts on screen. Edit Bay speaks it with a synthetic voice, on this computer, and places it at the playhead. Use it as a guide track or a quick narration.</p>
  <label class="aif" for="voText">Script <button type="button" class="lnk" id="voWrite">Write it for me</button></label><textarea id="voText" rows="5" style="width:100%" placeholder="e.g. Dark Out. OTR’s debut event. The sixteenth of May, at The Hidden Attic."></textarea>
  <div class="two"><div><label class="aif" for="voVoice">Voice</label><select id="voVoice" style="width:100%">${Object.entries(VOICES).map(([k,l])=>`<option value="${k}">${l}</option>`).join("")}</select></div>
  <div><label class="aif" for="voSpeed">Speed</label><select id="voSpeed" style="width:100%"><option value=".85">Slower</option><option value="1" selected>Normal</option><option value="1.15">Faster</option></select></div></div>
  <p id="voMsg" style="font-size:12px;min-height:16px;margin:8px 0 0;color:var(--muted)"></p>
  <div class="acts"><button class="btn" data-shclose="1">Cancel</button><button class="btn purple" id="voGo">Speak it</button></div>`,"Voiceover")}
document.addEventListener("click",async e=>{if(e.target.closest("[data-voice]")){openVoiceover();return}if(e.target.closest("#voWrite")){writeVoScript();return}
  const g=e.target.closest("#voGo");if(!g)return;const t=$("#voText").value.trim();if(!t){$("#voText").focus();return}g.disabled=true;const c=await makeVoiceover(t,{voice:$("#voVoice").value,speed:+$("#voSpeed").value});if(!c&&$("#voGo"))$("#voGo").disabled=false});
const _rpV=renderPagebar;renderPagebar=function(...a){const r=_rpV.apply(this,a);const sb=$("#scoreBtn");if(sb&&!$("#voiceBtn"))sb.insertAdjacentHTML("afterend",`<button class="ai" id="voiceBtn" data-voice="1" title="Voiceover: type a script (or let the AI write it) and Edit Bay speaks it onto the timeline">${ic("audio")}Voice</button>`);return r};
if(typeof cmdList==="function"){const _clV=cmdList;cmdList=function(){const L=_clV();if(cur())L.unshift({g:"Audio",l:"Voiceover from text",f:openVoiceover});return L}}
/* chat: {"op":"voiceover","text":"...","at":seconds,"voice":"am_michael"} */
const _aoV=applyOps;applyOps=function(ops,alias){const rest=[],done=[],skipped=[];(ops||[]).forEach(o=>{if(!o||o.op!=="voiceover"){rest.push(o);return}if(!o.text){skipped.push("voiceover");return}
    setTimeout(()=>makeVoiceover(o.text,{at:o.at,voice:o.voice,speed:o.speed}),120);done.push("voiceover")});const r=_aoV(rest,alias);return{done:done.concat(r.done),skipped:skipped.concat(r.skipped)}};
setTimeout(()=>{try{renderPagebar()}catch(e){}},0);
