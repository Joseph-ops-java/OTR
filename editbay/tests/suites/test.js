const { chromium } = require('playwright');
const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{
 const b=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:1600,height:1000}});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
 await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}});await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(1500);
 await p.click('[data-btab="projects"]');await p.click('#newBtn');await p.fill('#n-title','Dark Out Trailer');await p.click('#newForm button[type=submit]');
 await p.waitForTimeout(500);
 await p.setInputFiles('#fileIn',[M+'/media/clipA.mp4',M+'/media/clipB.mp4',M+'/media/dj.jpg',M+'/media/music.wav']);
 await p.waitForTimeout(6000);
 const ids=await p.evaluate(()=>state.media.map(m=>[m.id,m.kind,m.name]));console.log('media',JSON.stringify(ids));
 // append video A, B, image to V1, music to A2
 await p.evaluate(()=>{const ms=state.media;const f=n=>ms.find(m=>m.name===n).id;placeMedia(f('clipA.mp4'),'V1',100);placeMedia(f('clipB.mp4'),'V1',100);placeMedia(f('dj.jpg'),'V1',100);placeMedia(f('music.wav'),'A2',0)});
 await p.waitForTimeout(800);
 // transition on clip 2
 const r=await p.evaluate(()=>{const l=v1();E.sel=new Set([l[1].id]);state.itab='clip';render();return l.map(c=>[c.type,c.start.toFixed(2),cdur(c).toFixed(2)])});console.log('v1',JSON.stringify(r));
 await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.selectOption('#tr-type','push');await p.waitForTimeout(200);
 // look on clip 1
 await p.evaluate(()=>{const l=v1();E.sel=new Set([l[0].id]);render()});await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.selectOption('#cp-look','red');
 // keyframes: scale at 0 and 3s on clip 1
 await p.evaluate(()=>{seek(0.5)});await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.click('[data-kf="scale"]');await p.evaluate(()=>{seek(4)});await p.fill('#cpn-scale','1.6');await p.dispatchEvent('#cpn-scale','change');
 const kf=await p.evaluate(()=>JSON.stringify(v1()[0].kf));console.log('kf',kf);
 // freeze at 2s
 await p.evaluate(()=>{document.activeElement.blur();E.sel.clear();seek(2)});await p.keyboard.press('Alt+f');await p.waitForTimeout(300);
 console.log('after freeze',await p.evaluate(()=>JSON.stringify(v1().map(c=>[c.freeze?'FZ':c.type,+c.start.toFixed(2),+cdur(c).toFixed(2)]))));
 // title + captions
 await p.evaluate(()=>{seek(1);addTitleAtPlayhead()});await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.evaluate(()=>document.querySelectorAll('#insp details.isec').forEach(d=>d.open=true));await p.selectOption('#tp-pre','cinema');
 await p.evaluate(()=>{state.btab='media';render()});await (await p.evaluateHandle(()=>srtIn)).asElement().setInputFiles(M+'/media/caps.srt');await p.waitForTimeout(500);console.log('caps',await p.evaluate(()=>E.tl.clips.filter(c=>c.track==='V3').length));await p.waitForTimeout(400);
 // beats on music
 await p.evaluate(()=>{const c=E.tl.clips.find(c=>c.type==='audio');E.sel=new Set([c.id]);render();detectBeats(c)});await p.waitForTimeout(2500);
 console.log('beats',await p.evaluate(()=>E.tl.markers.filter(m=>m.kind==='beat').length));
 // play across the transition
 await p.evaluate(()=>{E.sel.clear();render();seek(5.2);play()});await p.waitForTimeout(1500);
 console.log('t after play',await p.evaluate(()=>E.t.toFixed(2)));
 await p.evaluate(()=>{pause();seek(6.05)});await p.waitForTimeout(800);
 await p.screenshot({path:S+'/shot_edit.png'});
 // check pixels differ (not black) mid transition
 console.log('pgm mean',await p.evaluate(()=>{const c=document.getElementById('pgm');const x=document.createElement('canvas');x.width=40;x.height=70;const g=x.getContext('2d');g.drawImage(c,0,0,40,70);const d=g.getImageData(0,0,40,70).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return (s/(d.length/4)/3).toFixed(1)}));
 // pages
 await p.evaluate(()=>{seek(1.2)});await p.keyboard.press('Control+2');await p.waitForTimeout(800);await p.screenshot({path:S+'/shot_color.png'});
 await p.keyboard.press('Control+3');await p.evaluate(()=>{seek(0);play()});await p.waitForTimeout(1200);await p.screenshot({path:S+'/shot_audio.png'});await p.evaluate(()=>pause());
 await p.click('[data-duck]');
 await p.keyboard.press('Control+4');await p.waitForTimeout(400);await p.screenshot({path:S+'/shot_deliver.png'});
 await p.keyboard.press('Control+1');
 // undo/redo, copy/paste, slip/roll programmatic
 await p.evaluate(()=>{undo();redo();const c=v1()[0];E.sel=new Set([c.id]);copySel();seek(tlDur());pasteClips()});
 // assist apply ops offline
 console.log('ops',await p.evaluate(()=>{pushUndo();const r=applyOps([{op:'add_title',text:'16.05.26',at:2,dur:2,style:'neon',as:'t1'},{op:'update',id:'t1',set:{yPos:30}},{op:'transition',id:v1()[2].id,type:'black',d:.8},{op:'marker',t:1,text:'hold longer'},{op:'split',id:v1()[0].id,at:1,as:'s'},{op:'look',id:'s',look:'noir'},{op:'bogus'}],{});normalize();commit();edRefresh();return JSON.stringify(r)}));
 // export range 1-3s
 await p.evaluate(()=>{seek(1);setRange('i');seek(3);setRange('o')});await p.keyboard.press('Control+e');await p.waitForTimeout(300);await p.click('#xGo');
 await p.waitForTimeout(4500);console.log('export',await p.evaluate(()=>E.x&&E.x.phase+' '+(E.x.blob?E.x.blob.size:0)+' '+E.x.ext));
 await p.screenshot({path:S+'/shot_export.png'});
 console.log('ERRORS',errs.length?errs.join('\n'):'none');
 await b.close();})();
