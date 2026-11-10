/* Edit Bay — hosted mode. When the page runs outside claude.ai there is no window.claude, so storage falls back to
   this device (store.js). This file adds two things for hosted testers: Claude through an optional proxy you run,
   and feedback that reaches you as a prefilled GitHub issue. */
const CFG=window.EDITBAY_CONFIG||{};
const HOSTED=!window.claude;
if(HOSTED&&CFG.claudeProxy){
  const b64blob=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(b)});
  const SAMPLE={
    limits:async()=>({images:{maxCount:8}}),
    json:async(prompt,o)=>{const images=[];for(const b of ((o&&o.images)||[]).slice(0,8)){if(b instanceof Blob)images.push({media_type:b.type||"image/jpeg",data:await b64blob(b)})}
      const r=await fetch(CFG.claudeProxy,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt,images})});
      if(!r.ok)throw new Error("Claude proxy: HTTP "+r.status+(r.status===429?" (busy, try again shortly)":""));return r.json()}};
  window.claude={use:async n=>n==="sample"?SAMPLE:n==="downloads"?LDOWN:null};
}

/* feedback from hosted testers: open a prefilled GitHub issue (must happen inside the click, or browsers block the tab) */
document.addEventListener("submit",e=>{if(!HOSTED||!CFG.feedbackUrl||!e.target||e.target.id!=="fbForm")return;const t=document.getElementById("fbText");const text=t?t.value.trim():"";if(!text)return;
  const r=document.querySelector('input[name="fbr"]:checked'),k=document.getElementById("fbKind"),dg=document.getElementById("fbDiag");const kind=k?k.value:"",rate=r?["Broken","Rough","OK","Good","Great"][+r.value-1]:"";
  let d="";if(dg&&dg.checked&&typeof diag==="function"){try{d="\n\n<details><summary>Technical details</summary>\n\n```json\n"+JSON.stringify(diag(),null,1)+"\n```\n</details>"}catch(x){}}
  if(typeof usageOpt==="function"&&usageOpt()==="yes"&&usageSummary())d+="\n\n**Usage counts:** "+usageSummary();const title=("[Beta 2] "+(kind?kind+": ":"")+text.split("\n")[0]).slice(0,90);const body=(rate?"**Rating:** "+rate+"\n":"")+(kind?"**About:** "+kind+"\n":"")+"\n"+text+d;
  const u=CFG.feedbackUrl+(CFG.feedbackUrl.includes("?")?"&":"?")+"labels=beta-feedback&title="+encodeURIComponent(title)+"&body="+encodeURIComponent(body.slice(0,6000));window.open(u,"_blank","noopener")},true);

/* first visit to a hosted copy: say what this build is */
window.addEventListener("load",()=>{if(!HOSTED)return;let seen=false;try{seen=sessionStorage.getItem("editbay.hostednote")==="1";sessionStorage.setItem("editbay.hostednote","1")}catch(x){}
  if(!seen)setTimeout(()=>{if(typeof toast==="function")toast("TEST BUILD",CFG.claudeProxy?"Your projects and media stay in this browser. Claude features send a description of your timeline and small preview frames to the Claude API.":"Your projects and media stay in this browser. Claude features are off in this build; everything else works.")},2500)});

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
