const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1500,height:950},acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2000);
 await p.click('[data-welnew]');await p.fill('#n-title','Prompt');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',['clipA.mp4','clipB.mp4','dj.jpg','music.wav'].map(f=>M+'/media/'+f));await p.waitForTimeout(5000);
 // stand-in for Claude: returns a fixed plan
 await p.evaluate(()=>{sampleNS={json:async(prompt,o)=>{window.__prompt=prompt;window.__imgs=(o&&o.images||[]).length;return{title:"Dark Out teaser",say:"Empty room to packed floor, ending on the DJ.",look:"red",letterbox:2.39,
   script:[{text:"One night.",dur:1.5},{text:"One room.",dur:1.5},{text:"One sound.",dur:2},{text:"Dark Out.",dur:2}],
   scenes:[{n:0,in:1,dur:1.5,text:"",style:"bold",transition:"cut"},{n:1,in:0.5,dur:2,text:"DARK OUT",style:"neon",transition:"flash"},{n:2,in:0,dur:2.5,text:"16 MAY",style:"cinema",transition:"dissolve"},{n:0,in:3,dur:2,text:"",style:"bold",transition:"whip"}],
   endcard:{text:"DARK OUT",sub:"16.05.26 · The Hidden Attic"}}},limits:async()=>({})};sampleCaps={images:{maxCount:8}}});
 await p.click('#topCreate');await p.waitForTimeout(300);await p.fill('#dr-brief','Hype video for Dark Out, 16 May at The Hidden Attic.');await p.selectOption('#dr-len','15');
 await p.selectOption('#dr-music',{label:'music.wav'});await p.screenshot({path:S+'/shot_create_dlg.png'});await p.click('#drGo');
 for(let i=0;i<40;i++){await p.waitForTimeout(500);if(await p.evaluate(()=>!DR.busy))break}
 console.log('images sent',await p.evaluate(()=>window.__imgs),'prompt has facts',await p.evaluate(()=>/Hidden Attic/.test(window.__prompt)));
 console.log('built',await p.evaluate(()=>JSON.stringify({bars:E.tl.bars,v1:v1().map(c=>[c.name.slice(0,5),+c.start.toFixed(2),+cdur(c).toFixed(2),c.tr&&c.tr.type,c.look]),v2:E.tl.clips.filter(c=>c.track==='V2').map(c=>c.text),v3:E.tl.clips.filter(c=>c.track==='V3').length,a2:E.tl.clips.filter(c=>c.track==='A2').length})));
 await p.evaluate(()=>seek(4.2));await p.waitForTimeout(800);await p.screenshot({path:S+'/shot_created.png'});
 const [d]=await Promise.all([p.waitForEvent('download'),p.evaluate(()=>exportFCPXML())]);await d.saveAs(S+'/out.fcpxml');
 console.log(errs.join('|')||'no errors');await b.close()})();
