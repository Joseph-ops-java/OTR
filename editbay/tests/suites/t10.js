const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2000);
 await p.click('[data-welnew]');await p.fill('#n-title','Rev');await p.check('input[name=n-shape][value=\"1920x1080\"]',{force:true});await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',[M+'/media/gop.mp4']);await p.waitForTimeout(4000);
 await p.evaluate(()=>{const id=state.media[0].id;placeMedia(id,'V1',0);placeMedia(id,'V1',100);edit(tl=>{const[a,b]=v1();a.in=3.5;a.out=6.5;a.reverse=true;b.in=10;b.out=14;b.ramp=RAMPS.hero[1];b.rampName='hero'})});
 console.log('durs',await p.evaluate(()=>JSON.stringify(v1().map(c=>+cdur(c).toFixed(3)))),'src@ramp mid',await p.evaluate(()=>{const c=v1()[1];return [srcTime(c,c.start).toFixed(3),srcTime(c,c.start+cdur(c)/2).toFixed(3),srcTime(c,cend(c)-1e-6).toFixed(3)].join(',')}));
 // split reversed clip and check continuity
 console.log('split rev',await p.evaluate(()=>{const a=v1()[0];const before=srcTime(a,1.5);pushUndo();const n=splitClip(a,1.5);normalize();return [before.toFixed(3),srcTime(v1()[1],1.5).toFixed(3),JSON.stringify(v1().slice(0,2).map(c=>[c.in,c.out,c.reverse]))].join(' ')}));
 await p.evaluate(()=>undo());
 await p.evaluate(()=>{openExport();E.x.lufs='off'});const t0=Date.now();await p.evaluate(()=>runExport());console.log('export',((Date.now()-t0)/1000).toFixed(1)+'s',await p.evaluate(()=>E.x.phase+' '+(E.x.err||'')));
 const buf=await p.evaluate(async()=>{const a=new Uint8Array(await E.x.blob.arrayBuffer());let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));return btoa(s)});require('fs').writeFileSync(S+'/rev.mp4',Buffer.from(buf,'base64'));
 await p.evaluate(()=>{state.btab='media';render()});const t1=Date.now();await p.evaluate(()=>optimizeMedia(state.media[0]));console.log('optimize',((Date.now()-t1)/1000).toFixed(1)+'s',await p.evaluate(()=>!!state.media[0].pxLocalId+' useProxy '+E.useProxy));
 console.log(errs.join('|')||'no errors');await b.close()})();
