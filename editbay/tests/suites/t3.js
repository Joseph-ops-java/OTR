const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
 await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(1200);
 await p.click('[data-btab="projects"]');await p.click('#newBtn');await p.fill('#n-title','Multicam test');await p.check('input[name=n-shape][value=\"1920x1080\"]',{force:true});await p.click('#newForm button[type=submit]');
 await p.setInputFiles('#fileIn',['camA.mp4','camB.mp4','talk.mp4','clipA.mp4','clipB.mp4','dj.jpg','music.wav'].map(f=>M+'/media/'+f));await p.waitForTimeout(7000);
 // multicam
 await p.click('#mcBtn');await p.waitForTimeout(300);
 await p.evaluate(()=>document.querySelectorAll('input[name="mc-src"]').forEach(x=>{const m=mediaOf(x.value);x.checked=/^cam/.test(m.name)}));
 await p.click('#mcGo');await p.waitForTimeout(5000);
 console.log('mc',await p.evaluate(()=>JSON.stringify(Object.values(E.tl.mc)[0].angles.map(a=>[a.name,a.off]))));
 console.log('clips',await p.evaluate(()=>JSON.stringify(E.tl.clips.map(c=>[c.track,c.name,+c.start.toFixed(2),+c.in.toFixed(2),+c.out.toFixed(2)]))));
 // play and cut angles with keys
 await p.evaluate(()=>{seek(0);play()});await p.waitForTimeout(1500);await p.keyboard.press('2');await p.waitForTimeout(1500);await p.keyboard.press('1');await p.waitForTimeout(800);await p.evaluate(()=>pause());
 console.log('after switching',await p.evaluate(()=>JSON.stringify(v1().map(c=>[c.angle,+c.start.toFixed(2),+c.in.toFixed(2),+c.out.toFixed(2)]))));
 await p.evaluate(()=>seek(2.2));await p.waitForTimeout(900);await p.screenshot({path:S+'/shot_mc.png'});
 // pauses on a fresh project
 await p.evaluate(()=>{E.angleView=false;state.btab='projects';render()});await p.click('#newBtn');await p.fill('#n-title','Pauses');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.evaluate(()=>{state.media.forEach(m=>m.projectId=E.pid);const t=state.media.find(m=>m.name==='talk.mp4');placeMedia(t.id,'V1',0)});
 await p.click('#silBtn',{force:true});await p.waitForTimeout(200);await p.click('#slGo');await p.waitForTimeout(3000);
 console.log('pauses',await p.evaluate(()=>JSON.stringify(v1().map(c=>[+c.in.toFixed(2),+c.out.toFixed(2)]))),await p.evaluate(()=>tlDur().toFixed(2)));
 // auto cut quick
 await p.click('#autoBtn');await p.waitForTimeout(300);
 await p.evaluate(()=>{document.querySelectorAll('input[name="au-src"]').forEach(x=>{const m=mediaOf(x.value);x.checked=/clip|dj|cam/.test(m.name)});const mu=state.media.find(m=>m.name==='music.wav');document.querySelector('#au-music').value=mu.id;document.querySelector('input[name=au-mode][value=quick]').checked=true});
 await p.screenshot({path:S+'/shot_auto_dlg.png'});
 await p.click('#auGo');for(let i=0;i<40;i++){await p.waitForTimeout(1000);if(await p.evaluate(()=>!AU.busy))break}
 console.log('autocut',await p.evaluate(()=>JSON.stringify(v1().map(c=>[c.name.slice(0,6),+c.start.toFixed(2),+cdur(c).toFixed(2),+c.in.toFixed(1)]))),await p.evaluate(()=>tlDur().toFixed(2)),await p.evaluate(()=>E.tl.clips.filter(c=>c.track==='A2').length));
 await p.evaluate(()=>seek(3));await p.waitForTimeout(800);await p.screenshot({path:S+'/shot_auto.png'});
 console.log('ERRORS',errs.join('\n')||'none');await b.close()})();
