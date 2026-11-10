const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1');sessionStorage.setItem('editbay.hostednote','1');localStorage.setItem('editbay.usageOptIn','no')}catch(e){}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*','content-type':'application/json'};let gem=null,orq=null;
 await p.route('https://generativelanguage.googleapis.com/**',async r=>{const q=r.request();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});const k=q.headers()['x-goog-api-key'];if(k==='bad')return r.fulfill({status:400,headers:cors,body:'{}'});
   if(q.url().includes('/models?'))return r.fulfill({status:200,headers:cors,body:JSON.stringify({models:[{name:'models/gemini-2.0-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.0-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.0-flash-image',supportedGenerationMethods:['generateContent']},{name:'models/gemini-3.0-flash-lite',supportedGenerationMethods:['generateContent']},{name:'models/text-embedding-004',supportedGenerationMethods:['embedContent']}]})});
   gem={url:q.url(),body:JSON.parse(q.postData())};return r.fulfill({status:200,headers:cors,body:JSON.stringify({candidates:[{content:{parts:[{text:'{"say":"Marker added.","ops":[{"op":"marker","t":2,"text":"gemini"}]}'}]}}]})})});
 await p.route('https://openrouter.ai/**',async r=>{const q=r.request();if(q.method()==='OPTIONS')return r.fulfill({status:204,headers:cors});
   if(q.url().endsWith('/models'))return r.fulfill({status:200,headers:cors,body:JSON.stringify({data:[{id:'paid/model'},{id:'meta-llama/llama-free:free'},{id:'qwen/qwen-free:free'}]})});
   orq={h:q.headers(),body:JSON.parse(q.postData())};return r.fulfill({status:200,headers:cors,body:JSON.stringify({choices:[{message:{content:'Sure! ```json\n{"say":"Done.","ops":[{"op":"marker","t":3,"text":"openrouter",}]}\n```'}}]})})});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(1800);
 await p.click('[data-welnew]');await p.fill('#n-title','Free cloud');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/clipA.mp4']);await p.waitForTimeout(2500);await p.evaluate(()=>placeMedia(state.media[0].id,'V1',0));
 // Gemini
 await p.evaluate(()=>openAISettings());await p.check('input[name="aip"][value="gemini"]');await p.waitForTimeout(100);await p.screenshot({path:S+'/ai_gem.png'});
 await p.fill('#aiKey','bad');await p.click('[data-ai="save"]');await p.waitForTimeout(800);console.log('bad gemini key:',await p.evaluate(()=>$('#ckeyMsg').textContent));
 await p.fill('#aiKey','AIzaGood');await p.click('[data-ai="save"]');await p.waitForTimeout(800);console.log('gemini saved',await p.evaluate(()=>JSON.stringify(aiConf())),'| chip',await p.waitForTimeout(2200)||await p.evaluate(()=>$('#liveTxt').textContent));
 await p.evaluate(()=>{state.itab='claude';$("#insp").dataset.k="";render()});await p.fill('#asText','add a marker');await p.click('#asGo');await p.waitForTimeout(2500);
 console.log('gemini call model',gem&&gem.url.split('/models/')[1].split(':')[0],'json mode',gem&&gem.body.generationConfig.responseMimeType,'| markers',await p.evaluate(()=>JSON.stringify((E.tl.markers||[]).map(m=>m.text))));
 // OpenRouter free
 await p.evaluate(()=>openAISettings());await p.check('input[name="aip"][value="openai"]');await p.waitForTimeout(100);await p.fill('#aiKey','sk-or-x');await p.click('[data-ai="models"]');await p.waitForTimeout(800);
 console.log('models msg',await p.evaluate(()=>$('#ckeyMsg').textContent),'| picked',await p.evaluate(()=>$('#aiModel').value));await p.screenshot({path:S+'/ai_or.png'});
 await p.click('[data-ai="save"]');await p.waitForTimeout(500);await p.evaluate(()=>{state.itab='claude';$("#insp").dataset.k="";render()});await p.fill('#asText','another marker');await p.click('#asGo');await p.waitForTimeout(2500);
 console.log('openrouter auth',orq&&orq.h.authorization,'model',orq&&orq.body.model,'| markers',await p.evaluate(()=>JSON.stringify((E.tl.markers||[]).map(m=>m.text))));
 console.log(errs.slice(0,4).join(' | ')||'no errors');await b.close()})();
