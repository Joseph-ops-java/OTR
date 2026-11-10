/* Edit Bay — choose the AI behind Create, the chat, Review and Smart Auto Cut on a hosted copy.
   Free options need no payment: a small open model running in this browser, Google Gemini with a free AI Studio key,
   or any OpenAI-compatible endpoint (OpenRouter free models, Groq, or Ollama / LM Studio on your own computer).
   Claude with your own key stays available. Every provider answers the same call: json(prompt,{images}) -> object. */
const AI_LS="editbay.ai";
function aiConf(){try{const c=JSON.parse(localStorage.getItem(AI_LS)||"null");if(c)return c}catch(e){}return myKey()?{p:"claude"}:{p:""}}
function aiSave(c){try{localStorage.setItem(AI_LS,JSON.stringify(c))}catch(e){}if(typeof sampleNS!=="undefined"){sampleNS=null;sampleCaps=null}}
function aiReady(){const c=aiConf();return CFG.claudeProxy||(c.p==="local")||(c.p==="gemini"&&c.key)||(c.p==="openai"&&c.base&&c.model)||(c.p==="claude"&&myKey())}
function aiLabel(){if(CFG.claudeProxy)return"Claude";const c=aiConf();return{local:"On-device AI",gemini:"Gemini",openai:c.name||"Free model",claude:"Claude"}[c.p]||"AI not set up"}
const SYS="You are the assistant editor inside Edit Bay, a video editor. Reply with a single JSON object only, exactly in the shape the request asks for. No prose, no code fences.";

/* JSON from small models is often almost right: strip fences, take the outer object, drop trailing commas */
function looseJson(text){let t=String(text||"").replace(/```(?:json)?/gi,"");const a=t.indexOf("{"),z=t.lastIndexOf("}");if(a<0||z<=a)throw new Error("The AI didn’t return an edit. Try rephrasing, or a simpler request.");t=t.slice(a,z+1);
  try{return JSON.parse(t)}catch(e){}try{return JSON.parse(t.replace(/,\s*([}\]])/g,"$1").replace(/[“”]/g,'"'))}catch(e){}throw new Error("The AI’s answer wasn’t valid. Try again, or a simpler request.")}

/* ---------- 1. on this device (Transformers.js + Qwen2.5 Instruct, Apache-2.0) ---------- */
const LOCAL={pipe:null,id:"",async load(onProgress){let f16=false;try{const a=navigator.gpu&&await navigator.gpu.requestAdapter();f16=!!(a&&a.features.has("shader-f16"))}catch(e){}
    /* GPU with half precision: the 1.5B model (~1.2 GB). Otherwise the 0.5B model on the processor (~490 MB). */
    const model=f16?"onnx-community/Qwen2.5-1.5B-Instruct":"onnx-community/Qwen2.5-0.5B-Instruct";if(this.pipe&&this.id===model)return this.pipe;
    const T=await import(ASR.lib);T.env.allowLocalModels=false;
    /* on the processor, run the model in a worker so the editor stays responsive while it thinks */
    if(!f16){try{T.env.backends.onnx.wasm.proxy=true}catch(e){}}
    this.pipe=await T.pipeline("text-generation",model,{device:f16?"webgpu":"wasm",dtype:f16?"q4f16":"q8",progress_callback:p=>{if(p&&p.status==="progress"&&onProgress)onProgress(p.file,p.progress)}});this.id=model;this.size=f16?"1.2 GB":"490 MB";return this.pipe}};
/* Small models can't follow the full instruction set, so editing requests get a short one with a worked example,
   a slim timeline (ids, tracks, times, names) and the model's reply is started with {"say":" so it has to answer in JSON. */
const LOCAL_RULES=`You edit a video timeline by replying with JSON: {"ops":[...],"say":"short sentence"}. Always include at least one operation when the request asks for a change.
Operations:
{"op":"marker","t":seconds,"text":"note"}
{"op":"add_title","text":"words","at":seconds,"dur":seconds,"style":"basic|bold|cinema|caption"}
{"op":"trim","id":"clip id","dur":seconds}
{"op":"delete","id":"clip id","ripple":true}
{"op":"move","id":"clip id","index":position}
{"op":"split","id":"clip id","at":seconds}
{"op":"transition","id":"clip id","type":"dissolve|black|whip|flash|zoom|slide","d":0.5}
{"op":"look","id":"clip id","look":"teal|noir|film|night|vivid|none"}
{"op":"effect","id":"clip id","type":"blur|glow|vhs|shake","amount":0.5}
{"op":"update","id":"clip id","set":{"speed":2,"vol":0.5,"scale":1.2,"text":"new words"}}
{"op":"cut_range","from":seconds,"to":seconds}
Only use clip ids from the timeline. Never invent names, dates or places.
Examples.
Request: add a marker at 3 seconds saying intro. Reply: {"ops":[{"op":"marker","t":3,"text":"intro"}],"say":"Added a marker at 3 s."}
Request: make clip c2 4 seconds long. Reply: {"ops":[{"op":"trim","id":"c2","dur":4}],"say":"Clip c2 is now 4 s."}`;
function localPrompt(prompt){const m=prompt.match(/TIMELINE \(JSON\):\n(\{[^\n]*\})/);if(!m)return null;let tl;try{tl=JSON.parse(m[1])}catch(e){return null}
  const task=prompt.slice(prompt.lastIndexOf("\n\n")+2).trim();
  const slim={duration:tl.duration,playhead:tl.playhead,selected:tl.selected,clips:(tl.clips||[]).slice(0,40).map(c=>{const o={id:c.id,track:c.track,start:c.start,dur:c.dur};if(c.name)o.name=c.name;if(c.text)o.text=c.text;return o})};
  return LOCAL_RULES+"\n\nTIMELINE: "+JSON.stringify(slim)+"\n\nRequest: "+task.replace(/^REQUEST:\s*/i,"")}
/* Offline command reader: turns common plain-English requests into edits instantly, with no model and no network.
   Small in-browser models proved unreliable at this (they pick the wrong operation), so this handles the everyday
   requests exactly, and the model is only tried for anything else on computers with a capable graphics card. */
const ORD={first:0,"1st":0,one:0,second:1,"2nd":1,two:1,third:2,"3rd":2,three:2,fourth:3,"4th":3,four:3,fifth:4,"5th":4,five:4};
function clipRef(t){const vs=v1();if(!vs.length)return null;if(/\b(last|final)\b/.test(t))return vs[vs.length-1];if(/\b(this|selected|current)\b/.test(t)){const s=selClips()[0];if(s)return s}
  const m=t.match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|one|two|three|four|five)\b(?=[^.]*\b(clip|shot)\b)/)||t.match(/\b(?:clip|shot)\s*(\d+)\b/);if(!m)return selClips()[0]||null;
  const n=/^\d+$/.test(m[1])?(+m[1]-1):ORD[m[1]];return vs[n]||null}
const NUM="(\\d+(?:\\.\\d+)?)";const secs=t=>{const m=t.match(new RegExp(NUM+"\\s*(?:s\\b|sec|second)"));return m?+m[1]:null};
function quoted(t){const m=t.match(/["“'‘]([^"”'’]+)["”'’]/);return m?m[1]:null}
function quickOps(req){const raw=String(req||"").trim();const t=raw.toLowerCase();if(!E.tl)return null;const ops=[];let say="";
  const at=()=>{if(/\b(start|beginning|open)/.test(t))return 0;if(/\b(end|close)\b/.test(t))return Math.max(0,tlDur()-3);const m=t.match(new RegExp("\\bat\\s+"+NUM));return m?+m[1]:E.t};
  if(/\bmarker\b/.test(t)){const m=t.match(new RegExp("(?:at|@)\\s*"+NUM));const tt=m?+m[1]:E.t;const txt=quoted(raw)||(raw.match(/(?:text|saying|says|called|named|labell?ed|note)\s+(.+?)\.?$/i)||[])[1]||"";ops.push({op:"marker",t:tt,text:txt});say=`Added a marker at ${tt}s.`}
  else if(/\b(title|text|caption|headline)\b/.test(t)&&/\b(add|put|show|write|place)\b/.test(t)){let txt=quoted(raw)||(raw.match(/(?:says|saying|reading|reads|with the text|that reads)\s+(.+?)(?:\s+(?:at|on|for)\s+(?:the\s+)?(?:start|beginning|end|\d).*)?\.?$/i)||[])[1];if(!txt)return null;
    const st=/\bcaption/.test(t)?"caption":/\b(big|bold|huge)\b/.test(t)?"bold":/\bcinema|cinematic|movie\b/.test(t)?"cinema":"basic";const d=secs(t.replace(/\bat\s+\d+(\.\d+)?\s*s\w*/,""))||3;const a=at();ops.push({op:"add_title",text:txt,at:a,dur:d,style:st});say=`Added the title “${txt}” at ${a.toFixed(1)}s.`}
  else if(/\b(dissolve|crossfade|cross-fade|fade|whip|flash|zoom|slide|dip to black|wipe|glitch)\b/.test(t)&&/\b(between|transition|cuts?|clips|all)\b/.test(t)){const ty=/whip/.test(t)?"whip":/flash/.test(t)?"flash":/zoom/.test(t)?"zoom":/slide/.test(t)?"slide":/black/.test(t)?"black":/wipe/.test(t)?"wipe":/glitch/.test(t)?"glitch":"dissolve";
    const vs=v1();const c=/\b(all|every|each|between (the )?(two|clips))\b/.test(t)||vs.length===2?null:clipRef(t);const tgt=c?[c]:vs.slice(1);tgt.forEach(x=>ops.push({op:"transition",id:x.id,type:ty,d:secs(t)||.5}));say=`Added ${ty} transitions to ${tgt.length} cut${tgt.length>1?"s":""}.`}
  else if(/\b(trim|make|set|shorten|cut)\b/.test(t)&&/\b(clip|shot)\b/.test(t)&&secs(t)!=null&&!/\bat\b/.test(t)){const c=clipRef(t);if(!c)return null;const d=secs(t);ops.push({op:"trim",id:c.id,dur:d});say=`Clip “${c.name||"clip"}” is now ${d}s long.`}
  else if(/\b(delete|remove)\b/.test(t)&&/\b(clip|shot)\b/.test(t)){const c=clipRef(t);if(!c)return null;ops.push({op:"delete",id:c.id,ripple:true});say=`Removed “${c.name||"the clip"}”.`}
  else if(/\b(slow ?mo(tion)?|slow (it )?down|speed (it )?up|faster|\d+(\.\d+)?x)\b/.test(t)){const c=clipRef(t)||v1()[0];if(!c)return null;const m=t.match(/(\d+(?:\.\d+)?)\s*x\b/);const sp=m?+m[1]:/slow/.test(t)?.5:2;ops.push({op:"update",id:c.id,set:{speed:sp}});say=`Set “${c.name||"the clip"}” to ${sp}× speed.`}
  else if(/\b(teal|noir|black and white|b&w|film|night|bleach|matte|vivid|warm|red|no look|remove the look)\b/.test(t)&&/\b(look|grade|make|give|apply|colou?r)\b/.test(t)){const lk=/no look|remove the look/.test(t)?"none":/teal/.test(t)?"teal":/noir|black and white|b&w/.test(t)?"noir":/night/.test(t)?"night":/bleach/.test(t)?"bleach":/matte/.test(t)?"matte":/vivid/.test(t)?"vivid":/red/.test(t)?"red":"film";
    const vs=/\b(this|selected|clip|shot)\b/.test(t)&&clipRef(t)?[clipRef(t)]:v1();vs.forEach(c=>ops.push({op:"look",id:c.id,look:lk}));say=`Applied the ${lk} look to ${vs.length} clip${vs.length>1?"s":""}.`}
  else if(/\b(letterbox|cinematic bars|black bars|widescreen bars|cinemascope)\b/.test(t)){const off=/\b(remove|no|off|without)\b/.test(t);ops.push({op:"timeline",set:{bars:off?0:2.39}});say=off?"Removed the letterbox.":"Added 2.39:1 letterbox bars."}
  else if(/\b(mute|silence)\b/.test(t)){const c=clipRef(t);if(!c)return null;ops.push({op:"update",id:c.id,set:{vol:0}});say=`Muted “${c.name||"the clip"}”.`}
  return ops.length?{say,ops}:null}
const QUICK_HELP="On-device mode understands requests like: “add a marker at 3 seconds called hook”, “add a title that says DARK OUT at the start”, “make the second clip 2 seconds long”, “put a dissolve between the clips”, “give it a noir look”, “slow motion on the first clip”, “add letterbox bars”, “delete the last clip”. For anything bigger (Create, Review, rewriting a cut), choose Google Gemini’s free key in Help › AI Settings.";
async function localJson(prompt){const m=prompt.match(/\nRequest:\s*([\s\S]+)$/);const req=m?m[1].trim():null;
  if(req){const q=quickOps(req);if(q)return q}
  let gpu=false;try{const a=navigator.gpu&&await navigator.gpu.requestAdapter();gpu=!!(a&&a.features.has("shader-f16"))}catch(e){}
  if(!req||!gpu)throw new Error(req?QUICK_HELP:"Create, Review and Smart Auto Cut need a smarter model than this computer can run. Choose Google Gemini’s free key (or another free model) in Help › AI Settings.");
  const files={};if(!LOCAL.pipe)sheet("sh-aiload",`<h3>Getting the on-device AI ready</h3><p style="font-size:12.5px;color:var(--muted);margin:0 0 8px">Downloading a free open model (Qwen2.5, Apache 2.0, about 1.2 GB) for requests the quick reader doesn’t cover. This happens once.</p><div class="sb"><i id="aiLoadBar" style="width:2%"></i></div><div class="acts"><button class="btn" data-shclose="1">Hide</button></div>`,"Getting the AI ready");
  const pipe=await LOCAL.load((f,p)=>{files[f]=p||0;const v=Object.values(files);const b=$("#aiLoadBar");if(b)b.style.width=Math.max(2,v.reduce((a,c)=>a+c,0)/Math.max(1,v.length)).toFixed(0)+"%"});closeSheet("sh-aiload");
  const edit=localPrompt(prompt);const lead='{"ops":[{"op":"';
  const chat=pipe.tokenizer.apply_chat_template([{role:"system",content:SYS},{role:"user",content:edit||prompt}],{tokenize:false,add_generation_prompt:true});
  const out=await pipe(chat+lead,{max_new_tokens:400,do_sample:false,return_full_text:false});const text=lead+((out&&out[0]&&out[0].generated_text)||"");LOCAL.last=text;
  const r=looseJson(text);if(!Array.isArray(r.ops)||!r.ops.length)throw new Error(QUICK_HELP);return r}

/* ---------- 2. Google Gemini (free key from aistudio.google.com) ---------- */
const GEM="https://generativelanguage.googleapis.com/v1beta";
async function geminiModels(key){const r=await fetch(GEM+"/models?pageSize=200",{headers:{"x-goog-api-key":key}});if(r.status===400||r.status===403)throw Object.assign(new Error("Google rejected that key."),{bad:true});if(!r.ok)throw new Error("Google answered "+r.status+".");
  const ms=((await r.json()).models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")).map(m=>m.name.replace(/^models\//,""));
  /* prefer the newest general "flash" model: free-tier friendly and fast; avoid image, audio, TTS and experimental variants */
  const ok=ms.filter(n=>/flash/.test(n)&&!/image|audio|tts|live|exp|preview|thinking|8b/.test(n));const ver=n=>parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/)||[0,0])[1]);
  ok.sort((a,b)=>ver(b)-ver(a)||(/lite/.test(a)?1:0)-(/lite/.test(b)?1:0));return ok[0]||ms.find(n=>/gemini/.test(n))||""}
async function geminiJson(prompt,o,c){const images=c.noImages?[]:await imagesOf(o);
  const r=await fetch(`${GEM}/models/${encodeURIComponent(c.model)}:generateContent`,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":c.key},
    body:JSON.stringify({systemInstruction:{parts:[{text:SYS}]},contents:[{role:"user",parts:[...images.map(i=>({inline_data:{mime_type:i.media_type,data:i.data}})),{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:.4}})});
  if(r.status===429)throw new Error("Gemini’s free limit is used up for now. Wait a minute, or try again tomorrow.");if(r.status===400||r.status===403)throw new Error("Gemini rejected the request ("+r.status+"). Check the key in Help › AI Settings.");if(!r.ok)throw new Error("Gemini error "+r.status+". Try again.");
  const d=await r.json();const cand=(d.candidates||[])[0];if(!cand)throw new Error("Gemini declined this request.");return looseJson(((cand.content||{}).parts||[]).map(p=>p.text||"").join(""))}

/* ---------- 3. OpenAI-compatible: OpenRouter free models, Groq, Ollama, LM Studio ---------- */
const OAI_PRESETS={openrouter:{name:"OpenRouter",base:"https://openrouter.ai/api/v1",keyUrl:"https://openrouter.ai/keys",note:"Free models end in “:free”. No card needed."},groq:{name:"Groq",base:"https://api.groq.com/openai/v1",keyUrl:"https://console.groq.com/keys",note:"Free tier with daily limits."},ollama:{name:"Ollama",base:"http://localhost:11434/v1",keyUrl:"https://ollama.com/download",note:"Runs on your own computer. Start it with OLLAMA_ORIGINS=* so this page can reach it."},lmstudio:{name:"LM Studio",base:"http://localhost:1234/v1",keyUrl:"https://lmstudio.ai",note:"Runs on your own computer. Turn on the local server and CORS."}};
async function oaiModels(base,key){const r=await fetch(base.replace(/\/$/,"")+"/models",{headers:key?{authorization:"Bearer "+key}:{}});if(r.status===401||r.status===403)throw Object.assign(new Error("That key was rejected."),{bad:true});if(!r.ok)throw new Error("The server answered "+r.status+".");
  const d=await r.json();const ids=(d.data||d.models||[]).map(m=>m.id||m.name).filter(Boolean);return ids}
async function oaiJson(prompt,o,c){const images=c.vision?await imagesOf(o):[];
  const content=images.length?[{type:"text",text:prompt},...images.map(i=>({type:"image_url",image_url:{url:`data:${i.media_type};base64,${i.data}`}}))]:prompt;
  const h={"content-type":"application/json"};if(c.key)h.authorization="Bearer "+c.key;if(/openrouter\.ai/.test(c.base)){h["HTTP-Referer"]=location.origin;h["X-Title"]="Edit Bay"}
  const r=await fetch(c.base.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:h,body:JSON.stringify({model:c.model,temperature:.3,messages:[{role:"system",content:SYS},{role:"user",content}]})});
  if(r.status===429)throw new Error("That free model is busy or its daily limit is used. Try again shortly, or pick another model in Help › AI Settings.");if(r.status===401||r.status===403)throw new Error("The key was rejected. Check it in Help › AI Settings.");if(!r.ok)throw new Error("AI server error "+r.status+".");
  const d=await r.json();return looseJson(((d.choices||[])[0]||{}).message?.content)}

/* ---------- the one entry point Edit Bay calls ---------- */
const AI_SAMPLE={limits:async()=>{const c=aiConf();const img=CFG.claudeProxy||c.p==="claude"||(c.p==="gemini"&&!c.noImages)||(c.p==="openai"&&c.vision);return img?{images:{maxCount:c.p==="openai"?4:8}}:{}},
  json:async(prompt,o)=>{const c=aiConf();track&&track("ai:"+(CFG.claudeProxy?"proxy":c.p));
    if(CFG.claudeProxy)return PROXY_SAMPLE.json(prompt,o);if(c.p==="claude")return KEY_SAMPLE.json(prompt,o);if(c.p==="gemini")return geminiJson(prompt,o,c);if(c.p==="openai")return oaiJson(prompt,o,c);if(c.p==="local")return localJson(prompt);
    throw new Error("Set up AI first in Help › AI Settings.")}};
function aiSample(){return aiReady()?AI_SAMPLE:null}

/* ---------- AI Settings ---------- */
function openAISettings(){const c=aiConf();const sel=c.p&&c.p!=="off"?c.p:"gemini";const preset=c.preset||"openrouter";const P=OAI_PRESETS;
  const opt=(v,t,d)=>`<label class="aiopt"><input type="radio" name="aip" value="${v}" ${sel===v?"checked":""}><span><b>${t}</b><small>${d}</small></span></label>`;
  sheet("sh-claude",`<h3>AI Settings</h3>
  <p style="font-size:12.5px;line-height:1.5;color:var(--muted);margin:0 0 10px">Create, the AI chat, Review and Smart Auto Cut need an AI model. Pick one. The first three cost nothing.</p>
  <div class="aiopts">${opt("gemini","Google Gemini · free key · recommended","Smart, fast, and it sees preview frames. Get a free key at aistudio.google.com (no card). Google receives your timeline description and frames.")}
  ${opt("openai","Other free models","OpenRouter’s free models, Groq, or Ollama / LM Studio running on your own computer.")}
  ${opt("local","On this device · free, private, instant","No account and no download. Understands everyday requests (“add a title that says…”, “make the second clip 2 seconds”, “dissolve between the clips”, “noir look”). Create and Review need one of the options above.")}
  ${opt("claude","Claude · your API key","Anthropic’s Claude. Best results. Billed to your key.")}</div>
  <div id="aiFields"></div><p id="ckeyMsg" style="font-size:12px;min-height:16px;margin:6px 0 0"></p>
  <div class="acts">${aiReady()&&!CFG.claudeProxy?`<button class="btn" data-ai="off">Turn off AI</button>`:""}<button class="btn" data-shclose="1">Cancel</button><button class="btn purple" data-ai="save">Save</button></div>`,"AI Settings");
  const fields=()=>{const v=(document.querySelector('input[name="aip"]:checked')||{}).value;const F=$("#aiFields");if(!F)return;
    if(v==="local")F.innerHTML=`<p class="aihint">Works offline. Nothing leaves this computer.</p>`;
    else if(v==="gemini")F.innerHTML=`<label class="aif">Gemini API key <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Get a free key</a></label><input id="aiKey" type="password" autocomplete="off" placeholder="${c.p==="gemini"&&c.key?"Saved. Paste a new key to replace it":"AIza…"}"><label class="aichk"><input type="checkbox" id="aiNoImg" ${c.noImages?"checked":""}> Don’t send preview frames (text only)</label>`;
    else if(v==="openai")F.innerHTML=`<label class="aif">Service</label><select id="aiPreset">${Object.entries(P).map(([k,x])=>`<option value="${k}" ${preset===k?"selected":""}>${x.name}</option>`).join("")}<option value="custom" ${preset==="custom"?"selected":""}>Other (OpenAI-compatible)</option></select>
      <p class="aihint" id="aiNote"></p><label class="aif">Server URL</label><input id="aiBase" value="${esc((c.p==="openai"&&c.base)||P[preset]?.base||"")}" spellcheck="false"><label class="aif">API key <span id="aiKeyLink"></span></label><input id="aiKey" type="password" autocomplete="off" placeholder="${c.p==="openai"&&c.key?"Saved. Paste a new key to replace it":"Not needed for Ollama or LM Studio"}">
      <label class="aif">Model</label><div style="display:flex;gap:6px"><input id="aiModel" list="aiModels" value="${esc(c.p==="openai"&&c.model||"")}" placeholder="Load the list, then pick one" spellcheck="false" style="flex:1"><button class="btn sm" data-ai="models">Load models</button></div><datalist id="aiModels"></datalist>
      <label class="aichk"><input type="checkbox" id="aiVision" ${c.p==="openai"&&c.vision?"checked":""}> This model can see images (send preview frames)</label>`;
    else F.innerHTML=`<label class="aif">Claude API key <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">Get a key</a></label><input id="aiKey" type="password" autocomplete="off" placeholder="${myKey()?"Saved. Paste a new key to replace it":"sk-ant-…"}">`;
    const ps=$("#aiPreset");if(ps){const upd=()=>{const x=P[ps.value];$("#aiNote").textContent=x?x.note:"Any server that speaks the OpenAI chat API.";$("#aiKeyLink").innerHTML=x&&x.keyUrl?`<a href="${x.keyUrl}" target="_blank" rel="noopener">${ps.value==="ollama"||ps.value==="lmstudio"?"Download":"Get a free key"}</a>`:"";if(x&&ps.dataset.touched)$("#aiBase").value=x.base};ps.addEventListener("change",()=>{ps.dataset.touched=1;upd()});upd()}};
  document.querySelectorAll('input[name="aip"]').forEach(r=>r.addEventListener("change",fields));fields()}
connectClaude=openAISettings;
const msgAI=t=>{const m=$("#ckeyMsg");if(m)m.textContent=t};
document.addEventListener("click",async e=>{const b=e.target.closest("[data-ai]");if(!b)return;e.preventDefault();const k=b.dataset.ai;const old=aiConf();
  if(k==="off"){aiSave({p:"off"});closeSheet("sh-claude");toast("AI","AI features are off. Everything else works.");return}
  if(k==="models"){const base=$("#aiBase").value.trim(),key=$("#aiKey").value.trim()||(old.p==="openai"?old.key:"");msgAI("Loading models…");
    try{let ids=await oaiModels(base,key);const free=ids.filter(i=>/:free$/.test(i));if(/openrouter/.test(base)&&free.length)ids=free;$("#aiModels").innerHTML=ids.slice(0,300).map(i=>`<option value="${esc(i)}">`).join("");if(!$("#aiModel").value&&ids[0])$("#aiModel").value=ids[0];msgAI(ids.length+" models"+(/openrouter/.test(base)&&free.length?" (free ones only)":"")+". Pick one, then Save.")}
    catch(err){msgAI(/Failed to fetch|NetworkError/i.test(String(err.message))?"Couldn’t reach that server. Is it running, and does it allow this page (CORS)?":err.message)}return}
  const p=(document.querySelector('input[name="aip"]:checked')||{}).value;b.disabled=true;
  try{if(p==="local"){aiSave({p:"local"});closeSheet("sh-claude");toast("AI","On-device mode is on. Try “add a title that says …” or “put a dissolve between the clips”.")}
    else if(p==="gemini"){const key=$("#aiKey").value.trim()||(old.p==="gemini"?old.key:"");if(!key)throw new Error("Paste your free Gemini API key first.");msgAI("Checking the key…");const model=await geminiModels(key);if(!model)throw new Error("No Gemini text model is available to this key.");
      aiSave({p:"gemini",key,model,noImages:$("#aiNoImg").checked});closeSheet("sh-claude");toast("AI","Gemini is ready ("+model+"). Try the AI tab in the Inspector, or Create.")}
    else if(p==="openai"){const preset=$("#aiPreset").value,base=$("#aiBase").value.trim(),key=$("#aiKey").value.trim()||(old.p==="openai"?old.key:""),model=$("#aiModel").value.trim();if(!base||!model)throw new Error("Fill in the server URL and pick a model.");
      aiSave({p:"openai",preset,name:(OAI_PRESETS[preset]||{}).name||"Custom",base,key,model,vision:$("#aiVision").checked});closeSheet("sh-claude");toast("AI",model+" via "+((OAI_PRESETS[preset]||{}).name||base)+" is ready.")}
    else if(p==="claude"){const v=$("#aiKey").value.trim();if(v){if(!/^sk-ant-/.test(v))throw new Error("That doesn’t look like a Claude API key (they start with sk-ant-).");msgAI("Checking the key…");const prev=myKey();localStorage.setItem(KEY_LS,v);
        try{const cl=await client();await cl.models.retrieve(CLAUDE_MODEL)}catch(err){prev?localStorage.setItem(KEY_LS,prev):localStorage.removeItem(KEY_LS);sdkClient=null;const A=await import(SDK_URL).then(m=>m.default).catch(()=>null);throw new Error(A&&err instanceof A.AuthenticationError?"Claude rejected that key.":"Couldn’t check the key: "+(err.message||"error"))}}
      else if(!myKey())throw new Error("Paste your Claude API key first.");aiSave({p:"claude"});closeSheet("sh-claude");toast("AI","Claude is connected.")}
    if(typeof track==="function")track("ai-setup:"+p)}
  catch(err){msgAI(err.message||"Couldn’t save.")}finally{b.disabled=false}});
