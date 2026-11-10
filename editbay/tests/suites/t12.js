const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1500,height:950}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2000);
 await p.click('[data-welnew]');await p.fill('#n-title','Src');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/clipA.mp4',M+'/media/clipB.mp4',M+'/media/talk.mp4']);await p.waitForTimeout(4500);
 const st=()=>p.evaluate(()=>JSON.stringify(v1().map(c=>[c.name.slice(0,5),+c.start.toFixed(2),+c.in.toFixed(2),+c.out.toFixed(2)])));
 await p.evaluate(()=>placeMedia(state.media.find(m=>m.name==='clipA.mp4').id,'V1',0));
 // open clipB in source by double click, mark 1..3, overwrite at 2
 await p.dblclick('.mitem:has-text("clipB.mp4")');await p.waitForTimeout(800);
 await p.evaluate(()=>{const v=document.getElementById('srcv');v.currentTime=1});await p.waitForTimeout(300);await p.keyboard.press('i');await p.evaluate(()=>{document.getElementById('srcv').currentTime=3});await p.waitForTimeout(300);await p.keyboard.press('o');
 await p.evaluate(()=>{E.t=2});await p.keyboard.press('d');await p.waitForTimeout(300);console.log('overwrite',await st(),await p.evaluate(()=>tlDur()));
 await p.evaluate(()=>{E.t=1});await p.keyboard.press('w');await p.waitForTimeout(300);console.log('insert',await st(),await p.evaluate(()=>tlDur()));
 await p.screenshot({path:S+'/shot_source.png'});
 await p.evaluate(()=>{state.vmode='timeline';render();E.t=1.5});await p.keyboard.press('f');await p.waitForTimeout(500);console.log('match',await p.evaluate(()=>state.vmode+' '+E.src.t.toFixed(2)+' '+JSON.stringify(E.marks[E.src.mediaId])));
 // transcript
 await p.evaluate(()=>{state.vmode='timeline';edit(tl=>{tl.clips=[]});placeMedia(state.media.find(m=>m.name==='talk.mp4').id,'V1',0);E.sel=new Set([v1()[0].id]);state.ixtab='text';state.btab='index';render()});
 await p.click('[data-txadd]');await p.waitForTimeout(200);await (await p.evaluateHandle(()=>txIn)).asElement().setInputFiles(M+'/media/talk.json');await p.waitForTimeout(800);
 console.log('words',await p.evaluate(()=>txUnits().map(u=>u.t).join(' ')));
 await p.click('[data-txfill]');await p.waitForTimeout(300);console.log('after fillers',await st(),await p.evaluate(()=>tlDur().toFixed(2)),await p.evaluate(()=>txUnits().map(u=>u.t).join(' ')));
 await p.click('.tx:has-text("Goodbye")');await p.keyboard.press('Delete');await p.waitForTimeout(300);console.log('after cut',await p.evaluate(()=>tlDur().toFixed(2)),await p.evaluate(()=>txUnits().map(u=>u.t).join(' ')));
 await p.screenshot({path:S+'/shot_text.png'});
 console.log('summary has transcript',await p.evaluate(()=>tlSummary().transcript.length));
 console.log(errs.join('|')||'no errors');await b.close()})();
