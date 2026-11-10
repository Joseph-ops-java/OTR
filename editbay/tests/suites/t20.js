const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2000);
 await p.click('[data-welnew]');await p.fill('#n-title','Scale');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',['clipA.mp4','clipB.mp4'].map(f=>M+'/media/'+f));await p.waitForTimeout(3500);
 console.log('perf',await p.evaluate(()=>{const ms=state.media;pushUndo();for(let i=0;i<1500;i++){const c=newClip(ms[i%2],'V1',0);c.out=1+(i%3)*.5;E.tl.clips.push(c)}for(let i=0;i<500;i++){const t=newTitle(i*1.2);t.track=i%2?'V2':'V3';t.out=1;E.tl.clips.push(t)}
   normalize();commit();E.pps=60;let t=performance.now();edTimeline();const tl=performance.now()-t;t=performance.now();edit(tl=>{v1()[5].out-=.1});const ed=performance.now()-t;return JSON.stringify({clips:E.tl.clips.length,edTimeline:tl.toFixed(0),edit:ed.toFixed(0),dom:document.querySelectorAll('.eclip').length})}));
 await p.evaluate(()=>{const sc=document.getElementById('tlscroll');sc.scrollLeft=sc.scrollWidth/2});await p.waitForTimeout(400);
 console.log('after scroll: clips drawn near view',await p.evaluate(()=>{const sc=document.getElementById('tlscroll');const t=(sc.scrollLeft-LEFT)/E._pps;return [...document.querySelectorAll('.eclip')].some(el=>{const c=clipById(el.dataset.clip);return c&&c.start<=t+5&&cend(c)>=t})}));
 await p.evaluate(()=>{edit(tl=>{tl.clips=tl.clips.slice(0,4)});E.pps=null;edTimeline()});
 await p.evaluate(()=>{const c=v1()[0];edit(()=>{c.out-=.5});edit(()=>{c.look='film';Object.assign(c,LOOKS.film[1])});addTitleAtPlayhead();edit(()=>{v1()[1].start+=0})});
 await p.keyboard.press('Control+Alt+z');await p.waitForTimeout(300);console.log('history',await p.evaluate(()=>[...document.querySelectorAll('.hist li b')].slice(0,6).map(x=>x.textContent).join(' | ')));
 const before=await p.evaluate(()=>E.tl.clips.length);await p.click('.hist [data-histgo] >> nth=1');console.log('went back: clips',before,'->',await p.evaluate(()=>E.tl.clips.length));
 await p.evaluate(()=>{state.modal='keys2';render()});await p.click('[data-rebind="b"]');await p.keyboard.press('x');await p.click('[data-sx]');
 await p.evaluate(()=>document.activeElement.blur());await p.keyboard.press('x');console.log('x is blade',await p.evaluate(()=>E.tool));await p.keyboard.press('a');await p.keyboard.press('b');console.log('b now',await p.evaluate(()=>E.tool));
 console.log('backup',await p.evaluate(async()=>{BK.last[E.pid]=Date.now()-200000;edit(tl=>{v1()[0].out-=.1});await new Promise(r=>setTimeout(r,800));return VERS.filter(v=>v.backup).length}));
 console.log(errs.join('|')||'no errors');await b.close()})();
