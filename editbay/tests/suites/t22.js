const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120))});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2000);
 await p.click('[data-welnew]');await p.fill('#n-title','FX');await p.click('#newForm button[type=submit]');await p.waitForTimeout(300);
 await p.setInputFiles('#fileIn',['clipA.mp4','clipB.mp4','green.mp4'].map(f=>M+'/media/'+f));await p.waitForTimeout(4500);
 await p.evaluate(()=>{const f=n=>state.media.find(m=>m.name===n).id;placeMedia(f('clipA.mp4'),'V1',0);placeMedia(f('clipB.mp4'),'V1',100);placeMedia(f('green.mp4'),'V2',0)});
 const px=(x,y)=>p.evaluate(([x,y])=>{drawFrame();const c=document.getElementById('pgm');const g=document.createElement('canvas');g.width=c.width;g.height=c.height;const k=g.getContext('2d');k.drawImage(c,0,0);return Array.from(k.getImageData(x,y,1,1).data).slice(0,3).join(',')},[x,y]);
 await p.evaluate(()=>seek(1));await p.waitForTimeout(700);
 console.log('green bg before key',await px(100,300),'box',await px(450,900));
 await p.evaluate(()=>{const g=E.tl.clips.find(c=>c.track==='V2');E.sel=new Set([g.id]);edit(()=>{g.keyOn=true;g.keyColor='#00d040'})});await p.waitForTimeout(300);
 console.log('after key bg (should be clipA bars)',await px(100,300),'box stays red',await px(450,900));
 // pick from viewer
 await p.evaluate(()=>{const g=E.tl.clips.find(c=>c.track==='V2');edit(()=>{g.keyOn=false});state.itab='clip';render()});await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.click('[data-keypick]');
 const bb=await p.locator('#pgm').boundingBox();await p.mouse.click(bb.x+bb.width*.08,bb.y+bb.height*.15);await p.waitForTimeout(300);console.log('picked',await p.evaluate(()=>{const g=E.tl.clips.find(c=>c.track==='V2');return g.keyOn+' '+g.keyColor}));
 // blend + crop
 await p.evaluate(()=>{const g=E.tl.clips.find(c=>c.track==='V2');edit(()=>{g.keyOn=false;g.blend='multiply'})});console.log('multiply bg',await px(100,300));
 await p.evaluate(()=>{const g=E.tl.clips.find(c=>c.track==='V2');edit(()=>{g.blend='source-over';g.cropL=.5})});console.log('crop left half shows V1',await px(100,300),'right still green',await px(900,300));
 await p.evaluate(()=>{edit(tl=>{tl.clips=tl.clips.filter(c=>c.track!=='V2')})});
 // every effect changes pixels
 const base=await p.evaluate(()=>{seek(1.5);return 0});await p.waitForTimeout(500);
 console.log('effects',await p.evaluate(async()=>{const c=v1()[0];const out=[];const snap=()=>{drawFrame();const g=document.getElementById('pgm');const x=document.createElement('canvas');x.width=64;x.height=114;x.getContext('2d').drawImage(g,0,0,64,114);return x.getContext('2d').getImageData(0,0,64,114).data};
   const b0=snap();for(const k of Object.keys(FX)){c.fx=[{t:k,a:.8}];if(k==='pulse'){E.tl.markers=[{id:'b',t:1.45,kind:'beat'}]}const d=snap();let diff=0;for(let i=0;i<d.length;i+=4)diff+=Math.abs(d[i]-b0[i])+Math.abs(d[i+1]-b0[i+1]);out.push(k+':'+(diff/(d.length/4)).toFixed(1))}c.fx=[];return out.join(' ')}));
 // every transition renders mid-way
 console.log('transitions',await p.evaluate(async()=>{const c=v1()[1];const out=[];for(const[k]of TRANS){c.tr={type:k,d:1};normalize();E.t=c.start;sync();await new Promise(r=>setTimeout(r,120));try{drawFrame();out.push(k)}catch(e){out.push(k+'!ERR')}}return out.length+' ok: '+out.filter(x=>x.includes('ERR')).join(',')}));
 await p.evaluate(()=>{state.btab='fx';E.sel=new Set([v1()[1].id]);render()});await p.waitForTimeout(300);await p.screenshot({path:S+'/fx_browser.png'});
 await p.click('[data-applytr="iris"]');console.log('tile applied',await p.evaluate(()=>v1()[1].tr.type));await p.click('[data-applyfx="vhs"]');console.log('fx applied',await p.evaluate(()=>JSON.stringify(v1()[1].fx)));
 console.log('claude op',await p.evaluate(()=>{pushUndo();const r=applyOps([{op:'effect',id:v1()[0].id,type:'glow',amount:.6},{op:'frame',id:v1()[0].id,set:{bdr:.3,shd:.5}},{op:'transition',id:v1()[1].id,type:'doors',d:.8}],{});normalize();commit();return JSON.stringify(r)+' '+v1()[1].tr.type}));
 await p.evaluate(()=>{state.itab='clip';E.sel=new Set([v1()[0].id]);render();document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true)});await p.waitForTimeout(300);await p.screenshot({path:S+'/fx_insp.png'});
 console.log(errs.slice(0,4).join('|')||'no errors');await b.close()})();
