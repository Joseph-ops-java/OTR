/* Edit Bay — hosted mode. When the page runs outside claude.ai there is no window.claude, so storage falls back to
   this device (store.js). This file adds two things for hosted testers: Claude through an optional proxy you run,
   and feedback that reaches you as a prefilled GitHub issue. */
const CFG=window.EDITBAY_CONFIG||{};
const HOSTED=!window.claude;

/* Security policy for hosted copies: scripts only from this site and jsDelivr (pinned libraries), and network requests
   only to the services Edit Bay talks to. If a script were ever injected, it couldn't load more code or send stored
   API keys anywhere else. Not applied on claude.ai, which manages the page itself. Extra hosts: config.js "connect". */
if(HOSTED){try{const extra=[CFG.claudeProxy,...(CFG.connect||[])].filter(Boolean).map(u=>{try{return new URL(u).origin}catch(e){return""}}).filter(Boolean).join(" ");
  const csp=["default-src 'self'","script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'","worker-src 'self' blob: https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com","font-src 'self' data: https://fonts.gstatic.com","img-src 'self' data: blob:","media-src 'self' data: blob:",
    "connect-src 'self' data: blob: https://cdn.jsdelivr.net https://huggingface.co https://*.huggingface.co https://*.hf.co https://api.anthropic.com https://generativelanguage.googleapis.com https://openrouter.ai https://api.groq.com https://*.workers.dev http://localhost:* http://127.0.0.1:* "+extra,
    "object-src 'none'","base-uri 'self'","form-action 'self'"].join("; ");
  const m=document.createElement("meta");m.httpEquiv="Content-Security-Policy";m.content=csp;document.head.appendChild(m)}catch(e){}}
/* Claude on a hosted copy, two ways:
   1. claudeProxy in config.js: your server holds the key (server/).
   2. Otherwise each tester connects their own Claude API key. It is kept only in this browser and sent only to
      api.anthropic.com, through the official Anthropic SDK; usage is billed to that tester's key. */
const KEY_LS="editbay.claudeKey",SDK_URL="https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";
const CLAUDE_MODEL=CFG.claudeModel||"claude-opus-5-5";
function myKey(){try{return localStorage.getItem(KEY_LS)||""}catch(e){return""}}
const b64blob=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(b)});
async function imagesOf(o){const out=[];for(const b of ((o&&o.images)||[]).slice(0,8)){if(b instanceof Blob)out.push({media_type:/^image\/(jpeg|png|webp|gif)$/.test(b.type)?b.type:"image/jpeg",data:await b64blob(b)})}return out}
function parseJsonReply(text){const a=text.indexOf("{"),z=text.lastIndexOf("}");if(a<0||z<=a)throw new Error("Claude didn’t return an edit. Try again.");return JSON.parse(text.slice(a,z+1))}
const PROXY_SAMPLE={limits:async()=>({images:{maxCount:8}}),
  json:async(prompt,o)=>{const images=await imagesOf(o);const r=await fetch(CFG.claudeProxy,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt,images})});
    if(!r.ok)throw new Error("Claude proxy: HTTP "+r.status+(r.status===429?" (busy, try again shortly)":""));return r.json()}};
let sdkClient=null,sdkKey="";
async function client(){const k=myKey();if(!k)throw new Error("Connect Claude first (Help › Connect Claude).");if(sdkClient&&sdkKey===k)return sdkClient;
  const mod=await import(SDK_URL);const Anthropic=mod.default||mod.Anthropic;sdkClient=new Anthropic({apiKey:k,dangerouslyAllowBrowser:true});sdkKey=k;return sdkClient}
const KEY_SAMPLE={limits:async()=>({images:{maxCount:8}}),
  json:async(prompt,o)=>{const c=await client();const images=await imagesOf(o);const A=(await import(SDK_URL)).default;
    try{const resp=await c.beta.messages.create({model:CLAUDE_MODEL,max_tokens:16000,output_config:{effort:CFG.claudeEffort||"medium"},betas:["server-side-fallback-2026-07-01"],fallbacks:"default",
        system:"You are the assistant editor inside Edit Bay, a video editor. Reply with a single JSON object only, exactly in the shape the request asks for.",
        messages:[{role:"user",content:[...images.map(i=>({type:"image",source:{type:"base64",media_type:i.media_type,data:i.data}})),{type:"text",text:prompt}]}]});
      if(resp.stop_reason==="refusal")throw new Error("Claude declined this request.");return parseJsonReply(resp.content.filter(b=>b.type==="text").map(b=>b.text).join(""))}
    catch(e){if(A&&e instanceof A.AuthenticationError)throw new Error("Claude rejected the API key. Check it in Help › Connect Claude.");
      if(A&&e instanceof A.PermissionDeniedError)throw new Error("This API key isn’t allowed to use "+CLAUDE_MODEL+".");
      if(A&&e instanceof A.RateLimitError)throw new Error("Claude is busy or your key hit its rate limit. Try again in a minute.");
      if(A&&e instanceof A.APIConnectionError)throw new Error("Couldn’t reach Claude. Check your connection.");
      if(A&&e instanceof A.APIError)throw new Error("Claude API error "+(e.status||"")+". Try again.");throw e}}};
if(HOSTED){window.claude={use:async n=>n==="sample"?(typeof aiSample==="function"?aiSample():CFG.claudeProxy?PROXY_SAMPLE:myKey()?KEY_SAMPLE:null):n==="downloads"?LDOWN:null}}

function connectClaude(){if(typeof sheet!=="function")return;const has=!!myKey();
  sheet("sh-claude",`<h3>Connect Claude</h3>
  <p style="font-size:12.5px;line-height:1.55;color:var(--muted);margin:0 0 10px">Claude’s features (Create, the Claude chat, Review and Smart Auto Cut) need a Claude API key on this site. Get one at <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener">platform.claude.com</a>. Requests are billed to that key.</p>
  <label for="ckey" style="font-size:12px;font-weight:600">Claude API key</label>
  <input id="ckey" type="password" autocomplete="off" spellcheck="false" placeholder="${has?"Saved. Paste a new key to replace it":"sk-ant-…"}" style="width:100%;margin:4px 0 8px">
  <p style="font-size:11.5px;line-height:1.5;color:var(--dim);margin:0 0 6px">The key stays in this browser and goes only to Anthropic. Don’t connect a key on a shared computer. Claude receives a description of your timeline and a few small preview frames, never your media files. See <a href="privacy.html" target="_blank" rel="noopener">Privacy</a>.</p>
  <p id="ckeyMsg" style="font-size:12px;min-height:16px;margin:0"></p>
  <div class="acts">${has?`<button class="btn" data-ckey="remove">Disconnect</button>`:""}<button class="btn" data-shclose="1">Cancel</button><button class="btn purple" data-ckey="save">${has?"Save and test":"Connect"}</button></div>`,"Connect Claude")}
document.addEventListener("click",async e=>{const b=e.target.closest("[data-ckey],[data-connectclaude]");if(!b)return;e.preventDefault();
  if(b.dataset.connectclaude!=null){connectClaude();return}
  const msg=t=>{const m=document.getElementById("ckeyMsg");if(m)m.textContent=t};
  if(b.dataset.ckey==="remove"){try{localStorage.removeItem(KEY_LS)}catch(x){}sdkClient=null;if(typeof closeSheet==="function")closeSheet("sh-claude");if(typeof toast==="function")toast("CLAUDE","Disconnected. The key was removed from this browser.");return}
  const v=(document.getElementById("ckey").value||"").trim();if(!v){msg(myKey()?"Nothing to change.":"Paste your API key first.");return}
  if(!/^sk-ant-/.test(v)){msg("That doesn’t look like a Claude API key (they start with sk-ant-).");return}
  b.disabled=true;msg("Checking the key…");const old=myKey();try{localStorage.setItem(KEY_LS,v)}catch(x){msg("This browser won’t store the key (private mode?).");b.disabled=false;return}
  try{const c=await client();await c.models.retrieve(CLAUDE_MODEL);if(typeof closeSheet==="function")closeSheet("sh-claude");if(typeof toast==="function")toast("CLAUDE CONNECTED","Claude is ready. Try the Claude tab in the Inspector, or Create.");if(typeof track==="function")track("claude-connected")}
  catch(err){const A=await import(SDK_URL).then(m=>m.default).catch(()=>null);try{old?localStorage.setItem(KEY_LS,old):localStorage.removeItem(KEY_LS)}catch(x){}sdkClient=null;
    msg(A&&err instanceof A.AuthenticationError?"Claude rejected that key. Check it and try again.":A&&err instanceof A.APIConnectionError?"Couldn’t reach Claude. Check your connection.":"Couldn’t check the key: "+(err&&err.message||"error"));b.disabled=false}});

/* feedback from hosted testers: open a prefilled GitHub issue (must happen inside the click, or browsers block the tab) */
document.addEventListener("submit",e=>{if(!HOSTED||!CFG.feedbackUrl||!e.target||e.target.id!=="fbForm")return;const t=document.getElementById("fbText");const text=t?t.value.trim():"";if(!text)return;
  const r=document.querySelector('input[name="fbr"]:checked'),k=document.getElementById("fbKind"),dg=document.getElementById("fbDiag");const kind=k?k.value:"",rate=r?["Broken","Rough","OK","Good","Great"][+r.value-1]:"";
  let d="";if(dg&&dg.checked&&typeof diag==="function"){try{d="\n\n<details><summary>Technical details</summary>\n\n```json\n"+JSON.stringify(diag(),null,1)+"\n```\n</details>"}catch(x){}}
  if(typeof usageOpt==="function"&&usageOpt()==="yes"&&usageSummary())d+="\n\n**Usage counts:** "+usageSummary();const title=("[Beta 2] "+(kind?kind+": ":"")+text.split("\n")[0]).slice(0,90);const body=(rate?"**Rating:** "+rate+"\n":"")+(kind?"**About:** "+kind+"\n":"")+"\n"+text+d;
  const u=CFG.feedbackUrl+(CFG.feedbackUrl.includes("?")?"&":"?")+"labels=beta-feedback&title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body.slice(0,6000));window.open(u,"_blank","noopener")},true);

/* first visit to a hosted copy: say what this build is */
window.addEventListener("load",()=>{if(!HOSTED)return;let seen=false;try{seen=sessionStorage.getItem("editbay.hostednote")==="1";sessionStorage.setItem("editbay.hostednote","1")}catch(x){}
  /* wait until the first-run tour is closed so the two don't stack */
  if(!seen)setTimeout(function note(){if(document.querySelector(".tour,#tour")){setTimeout(note,2000);return}if(typeof toast==="function")toast("TEST BUILD",CFG.claudeProxy?"Your projects and media stay in this browser. Claude features send a description of your timeline and small preview frames to the Claude API.":"Your projects and media stay in this browser. To edit with AI, pick a free AI in Help › AI Settings (Google Gemini’s free key is the easiest).")},2500)});

/* installable web app: offline shell, Install button, open files from the desktop */
if(HOSTED&&"serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"||location.hostname==="127.0.0.1")){
  window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{})});
  let deferred=null;
  const showInstall=()=>{const a=document.getElementById("topActs");if(!a||document.getElementById("installBtn"))return;a.insertAdjacentHTML("afterbegin",`<button class="tbtn2" id="installBtn" title="Install Edit Bay as an app on this computer">Install app</button>`)};
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;setTimeout(showInstall,0)});
  document.addEventListener("click",async e=>{if(!e.target.closest("#installBtn")||!deferred)return;deferred.prompt();const r=await deferred.userChoice.catch(()=>null);deferred=null;const b=document.getElementById("installBtn");if(b)b.remove();if(r&&r.outcome==="accepted"&&typeof track==="function")track("installed")});
  window.addEventListener("appinstalled",()=>{const b=document.getElementById("installBtn");if(b)b.remove();if(typeof toast==="function")toast("INSTALLED","Edit Bay is now an app on this computer. Open it from your apps or dock.")});
  if("launchQueue" in window)window.launchQueue.setConsumer(async p=>{if(!p.files||!p.files.length)return;const fs=[];for(const h of p.files){try{fs.push(await h.getFile())}catch(e){}}if(!fs.length)return;
    const wait=()=>new Promise(r=>{const t=setInterval(()=>{if(typeof state!=="undefined"&&state.mode!=="loading"&&typeof importFiles==="function"){clearInterval(t);r()}},200)});await wait();
    const proj=fs.find(f=>/\.editbay$/i.test(f.name));if(proj){const dt=new DataTransfer();dt.items.add(proj);const i=document.getElementById("projIn");i.files=dt.files;i.dispatchEvent(new Event("change"));return}
    if(!cur()){state.modal="new";render();toast("OPEN FILES","Name a project first, then the files will be imported.");const t=setInterval(()=>{if(cur()){clearInterval(t);importFiles(fs)}},300);return}importFiles(fs)});
}
