const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(3200);console.log('notice',await p.evaluate(()=>$('#toasts').innerText.replace(/\n/g,' ')));
 await p.click('[data-welnew]');await p.fill('#n-title','Hosted');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/clipA.mp4']);await p.waitForTimeout(2500);await p.evaluate(()=>{placeMedia(state.media[0].id,'V1',0)});
 await p.evaluate(()=>{state.itab='claude';render()});await p.fill('#asText','make it shorter');await p.click('#asGo');await p.waitForTimeout(800);console.log('settings sheet',await p.locator('#sh-claude').count());await p.keyboard.press('Escape');console.log('no-ai msg',await p.evaluate(()=>[...document.querySelectorAll('#insp *')].map(e=>e.childElementCount?'':e.textContent).filter(t=>/connected on this site/.test(t))[0]));
 // export still downloads in hosted mode
 console.log('downloads ok',await p.evaluate(()=>downloads===LDOWN));
 // feedback opens a GitHub issue
 await p.click('#fbBtn');await p.waitForTimeout(200);await p.fill('#fbText','Export button hard to find');const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:5000}).catch(()=>null),p.click('#fbForm button[type=submit]')]);
 console.log('issue url',pop?decodeURIComponent(pop.url()).slice(0,140):'none');await p.waitForTimeout(300);console.log('toast',await p.evaluate(()=>$('#toasts').innerText.replace(/\n/g,' ').slice(-120)));if(pop)await pop.close();
 // with a proxy configured, Claude works through it
 const p2=await ctx.newPage();await p2.addInitScript(()=>{window.EDITBAY_CONFIG_OVERRIDE=1});
 await p2.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.EDITBAY_CONFIG={feedbackUrl:"",claudeProxy:"https://proxy.test/"}'}));
 let got=null;await p2.route('https://proxy.test/',async r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST'}});got=JSON.parse(r.request().postData());r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({say:'Added a marker.',ops:[{op:'marker',t:1,text:'from proxy'}]})})});
 await p2.goto('http://localhost:8765/index.html');await p2.waitForTimeout(2000);await p2.evaluate(()=>{const p=state.projects.find(x=>x.title==='Hosted');edSwitchProject(p.id)});await p2.waitForTimeout(800);
 await p2.evaluate(()=>{state.itab='claude';render()});await p2.fill('#asText','add a marker at 1s');await p2.click('#asGo');await p2.waitForTimeout(2500);
 console.log('proxy got prompt',!!(got&&got.prompt),'markers',await p2.evaluate(()=>JSON.stringify((E.tl.markers||[]).map(m=>m.text))));
 console.log(errs.join('|')||'no errors');await b.close()})();
