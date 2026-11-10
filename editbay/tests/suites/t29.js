const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800}});const p=await ctx.newPage();await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1');sessionStorage.setItem('editbay.hostednote','1');localStorage.setItem('editbay.usageOptIn','yes')}catch(e){}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(1800);
 console.log('version',await p.evaluate(()=>APP_VERSION+' / '+BETA),'welcome extras',await p.locator('[data-sample]').count(),await p.locator('.welcome .legal a').count());
 await p.click('.welcome [data-sample]');await p.waitForFunction(()=>E.tl&&E.tl.clips.length>=5,null,{timeout:20000}).catch(()=>{});await p.waitForTimeout(800);
 console.log('sample',await p.evaluate(()=>cur().title+' | '+E.tl.clips.map(c=>c.track+':'+(c.text||c.name).split('\n')[0]).join(', ')+' | '+tlDur().toFixed(1)+'s'));
 await p.evaluate(()=>seek(4.5));await p.waitForTimeout(600);await p.screenshot({path:S+'/b2_sample.png'});
 await p.evaluate(()=>{openExport();E.x.lufs='off'});await p.evaluate(()=>runExport());console.log('sample export',await p.evaluate(()=>E.x.phase+' '+(E.x.blob?E.x.blob.size:'')));await p.evaluate(()=>{E.x=null;state.modal=null;render()});
 // match bar
 await p.evaluate(()=>{state.modal="new";render()});await p.fill('#n-title','Landscape test');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/vfr.mp4']);await p.waitForTimeout(2500);await p.evaluate(()=>placeMedia(state.media.find(m=>m.name==='vfr.mp4').id,'V1',0));await p.waitForTimeout(300);
 console.log('matchbar',await p.evaluate(()=>($('.matchbar')||{}).innerText));await p.click('[data-match]:not([data-match=""])');await p.waitForTimeout(300);console.log('after match',await p.evaluate(()=>E.tl.w+'x'+E.tl.h));
 // hevc message
 await p.setInputFiles('#fileIn',[M+'/media/hevc.mp4']);await p.waitForTimeout(2500);console.log('hevc',await p.evaluate(()=>$('#toasts').innerText.replace(/\n/g,' ').slice(0,140)));
 // keyframe easing
 console.log('easing',await p.evaluate(()=>{const c=v1()[0];c.kf={op:[[0,0],[2,1,'in']]};const a=kv(c,'op',c.start+1);c.kf.op[1][2]='out';const o=kv(c,'op',c.start+1);c.kf.op[1][2]='hold';const h=kv(c,'op',c.start+1);c.kf.op[1].length=2;const s=kv(c,'op',c.start+1);delete c.kf;return [a,o,h,s].map(x=>x.toFixed(3)).join(' ')}));
 await p.evaluate(()=>{const c=v1()[0];E.sel=new Set([c.id]);seek(c.start+.5);setKf(c,'op',c.start+.5,.5);state.itab='clip';$("#insp").dataset.k="";render();document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true)});await p.waitForTimeout(300);
 const kb=p.locator('#insp [data-kf="op"]').first();await kb.scrollIntoViewIfNeeded();await kb.click({button:'right'});await p.waitForTimeout(150);console.log('ease menu',await p.evaluate(()=>[...document.querySelectorAll('.ctx button')].map(b=>b.textContent.trim()).join(' | ')));
 await p.click('.ctx button:has-text("Ease out")');console.log('ease set',await p.evaluate(()=>JSON.stringify(v1()[0].kf.op)));
 // captions with a mocked speech model
 await p.evaluate(()=>{ASR.load=async()=>async(pcm)=>({chunks:[{text:' Welcome',timestamp:[0.2,0.6]},{text:' to',timestamp:[0.6,0.8]},{text:' Dark',timestamp:[0.8,1.1]},{text:' Out.',timestamp:[1.1,1.5]},{text:' Doors',timestamp:[2.4,2.8]},{text:' open',timestamp:[2.8,3.1]},{text:' at',timestamp:[3.1,3.3]},{text:' half',timestamp:[3.3,3.6]},{text:' ten.',timestamp:[3.6,4]}]})});
 await p.evaluate(()=>{state.btab='media';render()});await p.waitForTimeout(200);console.log('auto cap button',await p.locator('#autoCapBtn').count());
 await p.click('#autoCapBtn');await p.waitForTimeout(3500);console.log('captions',await p.evaluate(()=>E.tl.clips.filter(c=>c.autoCap).map(c=>c.start.toFixed(2)+' '+c.text).join(' | ')),'| words stored',await p.evaluate(()=>(state.media.find(m=>m.name==='vfr.mp4').tx||{words:[]}).words.length));
 // system check, usage
 await p.evaluate(()=>sysCheck());await p.waitForTimeout(1500);console.log('syscheck',await p.evaluate(()=>$('#sh-sys').innerText.replace(/\n/g,' ').slice(0,260)));await p.screenshot({path:S+'/b2_sys.png'});await p.keyboard.press('Escape');
 console.log('usage',await p.evaluate(()=>usageSummary()));
 // service worker + manifest
 console.log('sw',await p.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return !!r}),'manifest',await p.evaluate(async()=>(await (await fetch('manifest.webmanifest')).json()).name));
 for(const pg of ['privacy.html','terms.html']){const q=await ctx.newPage();await q.goto('http://localhost:8765/'+pg);console.log(pg,await q.title());await q.close()}
 console.log(errs.slice(0,6).join(' | ')||'no errors');await b.close()})();
