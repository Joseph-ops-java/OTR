const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1');sessionStorage.setItem('editbay.hostednote','1');localStorage.setItem('editbay.usageOptIn','no');localStorage.setItem('editbay.ai','{"p":"local"}')}catch(e){}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(1800);
 await p.click('[data-welnew]');await p.fill('#n-title','Quick');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/clipA.mp4',M+'/media/clipB.mp4',M+'/media/vfr.mp4']);await p.waitForTimeout(3500);await p.evaluate(()=>{state.media.forEach((m,i)=>placeMedia(m.id,'V1',100*i))});
 const asks=['Add a marker at 2 seconds with the text hook','add a title that says DARK OUT at the start','Put a "16 MAY" caption at 4s','make the second clip 2 seconds long','trim clip 3 to 1.5 seconds','put a dissolve between the clips','whip transition on the last clip','give it a noir look','slow motion on the first clip','play the last clip at 2x','add cinematic letterbox bars','delete the last clip','mute the first clip','make it more emotional'];
 for(const a of asks){const r=await p.evaluate(a=>{const q=quickOps(a);return q?q.say+'  '+JSON.stringify(q.ops.map(o=>o.op+(o.type?':'+o.type:'')+(o.look?':'+o.look:'')+(o.dur?':'+o.dur:'')+(o.text!=null?':'+o.text:'')+(o.set?':'+JSON.stringify(o.set):''))):'(not understood)'},a);console.log(a.padEnd(48),'=>',r)}
 // full chat flow
 await p.evaluate(()=>{state.itab='claude';$("#insp").dataset.k="";render()});await p.fill('#asText','add a title that says DARK OUT at the start');await p.click('#asGo');await p.waitForTimeout(1500);
 await p.fill('#asText','make it more emotional');await p.click('#asGo');await p.waitForTimeout(1500);
 console.log('\nchat',await p.evaluate(()=>turnsOf(cur().id).map(t=>t.who+': '+t.text.slice(0,120)+(t.changes?' ['+t.changes+']':'')).join('\n')));
 console.log('titles',await p.evaluate(()=>JSON.stringify(E.tl.clips.filter(c=>c.type==='title').map(c=>[c.text,c.start]))));
 console.log(errs.slice(0,4).join(' | ')||'no errors');await b.close()})();
