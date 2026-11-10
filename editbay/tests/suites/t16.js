const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(3600);await p.screenshot({path:S+'/shot_tour.png'});
 
 // privacy scoping
 console.log('scope',await p.evaluate(async()=>{const calls=[];const raw={collection:x=>{calls.push(x);return{}},doc:x=>{calls.push(x);return{}}};const save=window.claude;
   window.claude={use:async n=>n==="user"?{isOwner:async()=>false,id:async()=>"u_abc",can:async()=>true}:null};const d=await scopeDb(raw);d.collection("projects");d.doc("timelines/p1");
   window.claude={use:async n=>n==="user"?{isOwner:async()=>true,id:async()=>"u_own",can:async()=>true}:null};const o=await scopeDb(raw);
   window.claude={use:async n=>n==="user"?{isOwner:async()=>false,id:async()=>"u_v",can:async()=>false}:null};const v=await scopeDb(raw);window.claude=save;
   return JSON.stringify({tester:calls,ownerIsRaw:o===raw,viewOnly:v})}));
 await p.click('[data-welnew]');await p.fill('#n-title','Chat');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',['clipA.mp4','clipB.mp4'].map(f=>M+'/media/'+f));await p.waitForTimeout(3500);
 await p.evaluate(()=>{const f=n=>state.media.find(m=>m.name===n).id;placeMedia(f('clipA.mp4'),'V1',0);placeMedia(f('clipB.mp4'),'V1',100);addTitleAtPlayhead();
   sampleNS={json:async(prompt)=>{window.__p=prompt;return{say:"Trimmed the opening and added a dip to black.",ops:[{op:"trim",id:v1()[0].id,dur:3},{op:"transition",id:v1()[1].id,type:"black",d:.6}]}},limits:async()=>({})};sampleCaps={};state.itab='claude';render()});
 await p.fill('#asText','Tighten the opening');await p.keyboard.press('Enter');await p.waitForTimeout(1500);
 console.log('after chat',await p.evaluate(()=>JSON.stringify({dur:tlDur(),turns:turnsOf(cur().id).map(t=>t.who+':'+(t.changes||t.text).slice(0,40)),hasVer:!!turnsOf(cur().id)[1].ver})));
 await p.fill('#asText','now shorter');await p.keyboard.press('Enter');await p.waitForTimeout(1200);console.log('history sent',await p.evaluate(()=>/CONVERSATION SO FAR/.test(window.__p)&&/Tighten the opening/.test(window.__p)));
 await p.screenshot({path:S+'/shot_chat.png'});
 await p.click('[data-undoturn="1"]');await p.waitForTimeout(1200);console.log('after undo',await p.evaluate(()=>tlDur()));
 await p.evaluate(()=>{state.ixtab='scenes';state.btab='index';render()});await p.waitForTimeout(300);console.log('scenes',await p.evaluate(()=>document.querySelectorAll('.scene').length));
 await p.fill('.stx','NEW TITLE');await p.keyboard.press('Tab');console.log('title edited',await p.evaluate(()=>E.tl.clips.find(c=>c.type==='title').text));
 await p.screenshot({path:S+'/shot_scenes.png'});
 await p.click('#fbBtn');await p.waitForTimeout(200);await p.click('.rate label:nth-child(4)');await p.fill('#fbText','Export button was hard to find');await p.click('#fbForm button[type=submit]');await p.waitForTimeout(400);
 console.log('feedback local',await p.evaluate(()=>JSON.parse(localStorage.getItem('editbay.feedback')||'[]').length));
 await p.setViewportSize({width:1366,height:768});await p.evaluate(()=>{state.itab='claude';state.ixtab='scenes';state.btab='index';render()});await p.waitForTimeout(500);await p.screenshot({path:S+'/shot_1366.png'});
 console.log(errs.join('|')||'no errors');await b.close()})();
