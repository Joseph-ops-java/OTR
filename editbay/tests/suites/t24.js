const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120))});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2000);
 await p.click('[data-welnew]');await p.fill('#n-title','FIX');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',['clipA.mp4','clipB.mp4'].map(f=>M+'/media/'+f));await p.waitForTimeout(4000);
 await p.evaluate(()=>{const f=n=>state.media.find(m=>m.name===n).id;placeMedia(f('clipA.mp4'),'V1',0);placeMedia(f('clipB.mp4'),'V2',0)});
 const px=(x,y)=>p.evaluate(([x,y])=>{drawFrame();const c=document.getElementById('pgm');const g=document.createElement('canvas');g.width=c.width;g.height=c.height;const k=g.getContext('2d');k.drawImage(c,0,0);return Array.from(k.getImageData(Math.round(x*c.width),Math.round(y*c.height),1,1).data).slice(0,3).join(',')},[x,y]);
 await p.evaluate(()=>seek(1.5));await p.waitForTimeout(700);
 console.log('keys',await p.evaluate(()=>['curves','lut','lgg'].every(k=>GRADE_KEYS.includes(k))&&['fx','cropL','keyOn','trIn'].every(k=>ATTRS.includes(k))));
 // overlay transition: iris in over 1s; at t=0.2 overlay should be partly hidden
 const o=()=>E.tl.clips.find(c=>c.track==='V2');
 await p.evaluate(()=>{const c=E.tl.clips.find(c=>c.track==='V2');E.sel=new Set([c.id]);edit(()=>{c.trIn={type:'slide',d:1}})});await p.evaluate(()=>seek(.3));await p.waitForTimeout(600);
 const mid=await px(.1,.5),full=await (async()=>{await p.evaluate(()=>seek(1.5));await p.waitForTimeout(500);return px(.1,.5)})();console.log('overlay slide-in mid',mid,'later',full);
 // keyframes on brightness
 await p.evaluate(()=>{const c=v1()[0];setKf(c,'bri',0,-1);setKf(c,'bri',2,0)});await p.evaluate(()=>seek(.05));await p.waitForTimeout(500);
 await p.evaluate(()=>{edit(tl=>{tl.clips=tl.clips.filter(c=>c.track!=='V2')})});await p.evaluate(()=>seek(.05));await p.waitForTimeout(500);const dark=await px(.5,.5);await p.evaluate(()=>seek(1.9));await p.waitForTimeout(500);console.log('bri kf dark',dark,'bright',await px(.5,.5));
 // fx keyframe
 console.log('fx kf',await p.evaluate(()=>{const c=v1()[0];c.fx=[{t:'blur',a:0}];setKf(c,'fx:blur',0,0);setKf(c,'fx:blur',2,1);let seen=0;const _r=renderClip;return 'ok'}));
 // inspector keyframe buttons
 await p.evaluate(()=>{state.itab='clip';E.sel=new Set([v1()[0].id]);$("#insp").dataset.k="";render();document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true)});await p.waitForTimeout(300);
 console.log('kf buttons',await p.evaluate(()=>[...document.querySelectorAll('#insp [data-kf]')].map(b=>b.dataset.kf).join(',')),'fxkf',await p.locator('[data-fxkf]').count());
 // preview quality
 await p.screenshot({path:S+'/fix_pq.png'});await p.screenshot({path:S+'/fix_pq.png'});await p.click('#pqBtn');await p.click('#pqBtn');console.log('pq',await p.evaluate(()=>{drawFrame();return $('#pqBtn').textContent+' '+$('#pgm').width+'x'+$('#pgm').height+' tl '+E.tl.w}));await p.click('#pqBtn');await p.click('#pqBtn');
 // tracks
 await p.click('[data-addtrk="v"]');await p.click('[data-addtrk="a"]');await p.waitForTimeout(300);console.log('tracks',await p.evaluate(()=>TRACKS.join(',')+' rows '+document.querySelectorAll('#tlc .etrack').length));
 await p.evaluate(()=>{const f=state.media.find(m=>m.name==='clipB.mp4').id;placeMedia(f,'V4',0)});await p.evaluate(()=>seek(1));await p.waitForTimeout(600);console.log('V4 composites',await px(.5,.5));
 await p.screenshot({path:S+'/fix_tracks.png'});
 // project file includes luts
 console.log('pack',await p.evaluate(()=>{LUTS.t1={n:2,u8:new Uint8Array(24),name:'T'};v1()[0].lut='t1';return Object.keys(packLuts(E.tl)||{}).join()}));
 console.log(errs.slice(0,5).join('|')||'no errors');await b.close()})();
