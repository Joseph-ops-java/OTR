/* Score & sound: generated music lands its drop on the reveal, sound design goes on A3, and both export. */
const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1');sessionStorage.setItem('editbay.hostednote','1');localStorage.setItem('editbay.usageOptIn','no')}catch(e){}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2000);
 await p.click('.welcome [data-sample]');await p.waitForFunction(()=>E.tl&&E.tl.clips.length>=5,null,{timeout:20000});await p.waitForTimeout(1200);
 console.log('score button',await p.locator('#scoreBtn').count());await p.click('#scoreBtn');await p.waitForTimeout(200);
 const t0=Date.now();await p.click('#scoreGo');await p.waitForFunction(()=>!document.querySelector('#sh-score'),null,{timeout:120000}).catch(()=>console.log('timeout'));
 console.log('took',((Date.now()-t0)/1000).toFixed(1)+'s','|',await p.evaluate(()=>$('#toasts').innerText.replace(/\n/g,' ')));
 console.log('audio clips',await p.evaluate(()=>JSON.stringify(E.tl.clips.filter(c=>c.type==='audio').map(c=>[c.track,c.name,+cdur(c).toFixed(2),c.vol]))));
 // check the music: louder after the drop than before it
 console.log('levels',await p.evaluate(async()=>{const c=E.tl.clips.find(c=>c.type==='audio'&&/Score/.test(c.name));const m=mediaOf(c.mediaId);const blob=await LBLOB.get(m.localId);const ac=new OfflineAudioContext(1,48000,48000);const buf=await ac.decodeAudioData(await blob.arrayBuffer());const d=buf.getChannelData(0),sr=buf.sampleRate;
   const plan=autoPlan('club');const rms=(a,b)=>{let s=0,n=0;for(let i=Math.floor(a*sr);i<Math.min(d.length,b*sr);i++){s+=d[i]*d[i];n++}return Math.sqrt(s/Math.max(1,n))};
   return 'drop '+plan.drop.toFixed(2)+'s · before '+rms(1,plan.drop-2.5).toFixed(3)+' · after '+rms(plan.drop+.2,plan.drop+3).toFixed(3)+' · len '+buf.duration.toFixed(2)}));
 await p.evaluate(()=>{openExport();E.x.lufs='-14'});await p.evaluate(()=>runExport());console.log('export',await p.evaluate(()=>E.x.phase+' '+(E.x.loud?('I='+E.x.loud.after.I.toFixed(1)+' LUFS'):'')));
 console.log(errs.slice(0,5).join(' | ')||'no errors');await b.close()})();
