/* Regression: the chat must keep working after a reload, when its saved history comes back from the database read-only
   (as claude.ai returns it). Before the fix this threw "Cannot add property N, object is not extensible". */
const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}window.claude={use:async n=>n==='sample'?{limits:async()=>({}),json:async()=>({say:'Marker added.',ops:[{op:'marker',t:1,text:'m'}]})}:null}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const ask=async t=>{await p.evaluate(()=>{state.itab='claude';$("#insp").dataset.k="";render()});await p.waitForTimeout(400);await p.fill('#asText',t);await p.click('#asGo');await p.waitForFunction(()=>!assistBusy,null,{timeout:30000});await p.waitForTimeout(800)};
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2000);
 await p.click('[data-welnew]');await p.fill('#n-title','Chat reload');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/clipA.mp4']);await p.waitForTimeout(2500);await p.evaluate(()=>placeMedia(state.media[0].id,'V1',0));
 await ask('add a marker');console.log('before reload',await p.evaluate(()=>turnsOf(cur().id).length+' turns'));await p.waitForTimeout(1500);
 await p.reload();await p.waitForTimeout(2500);await p.evaluate(()=>{const pr=state.projects.find(x=>x.title==='Chat reload');edSwitchProject(pr.id)});await p.waitForTimeout(800);
 await ask('add another marker');
 console.log('after reload',await p.evaluate(()=>{const T=turnsOf(cur().id);return T.length+' turns · frozen history '+Object.isFrozen(T)+' · last '+T[T.length-1].who+' · markers '+(E.tl.markers||[]).length}));
 console.log(errs.slice(0,3).join(' | ')||'no errors');await b.close()})();
