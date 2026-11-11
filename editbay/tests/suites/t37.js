/* Captions on claude.ai: the speech model and runtime load from files published with the page, under a policy that
   blocks every other host (as claude.ai does). Claude's clean-up pass is mocked. */
const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}window.__asked=false;
   window.claude={use:async n=>n==='sample'?{limits:async()=>({}),json:async prompt=>{window.__asked=true;const m=prompt.match(/Captions: (\[.*\])/);const L=m?JSON.parse(m[1]):[];return{lines:L.map(t=>t.replace(/kidnapping|hiddenness/i,'hidden').replace(/narcout|dark-?out/i,'Dark Out'))}}}:null}});
 const CSP="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src 'self' blob:";
 await p.route('http://localhost:8765/index.html',async r=>{const res=await r.fetch();r.fulfill({response:res,headers:{...res.headers(),'content-security-policy':CSP}})});
 const errs=[],blocked=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{const t=m.text();if(/Content Security Policy|Refused/.test(t))blocked.push(t.slice(0,160));else if(m.type()==='error')errs.push(t.slice(0,160))});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2500);console.log('on claude.ai',await p.evaluate(()=>!HOSTED));
 await p.click('[data-welnew]');await p.fill('#n-title','Captions');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/speech.mp4']);await p.waitForTimeout(2500);await p.evaluate(()=>placeMedia(state.media.find(m=>m.name==='speech.mp4').id,'V1',0));const k=await p.$('[data-match=""]');if(k)await k.click();
 await p.evaluate(()=>{state.btab='media';render()});await p.click('#autoCapBtn');await p.waitForFunction(()=>!asrBusy,null,{timeout:600000,polling:1000});
 console.log('model built in',await p.evaluate(()=>!!ASR.bundled));
 console.log('first words',await p.evaluate(()=>{const w=state.media.find(m=>m.name==='speech.mp4').tx.words;return w.slice(0,3).map(x=>x.t+'@'+x.s.toFixed(1)).join(' ')+' · last at '+w[w.length-1].e.toFixed(1)+'s · '+w.length+' words'}));
 console.log('captions',await p.evaluate(()=>E.tl.clips.filter(c=>c.autoCap).length),'| cleaned by AI',await p.evaluate(()=>window.__asked));
 console.log('blocked',blocked.length);console.log(errs.slice(0,4).join(' | ')||'no errors');await b.close()})();
