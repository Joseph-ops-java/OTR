/* claude.ai: the chat changes the music and restyles captions; every mood renders; caption style chips work. Claude is mocked. */
const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}window.__reply=null;window.__prompt='';
   window.claude={use:async n=>n==='sample'?{limits:async()=>({}),json:async prompt=>{window.__prompt=prompt;return window.__reply||{say:'ok',ops:[]}}}:null}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,160))});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2200);
 await p.click('.welcome [data-sample]');await p.waitForFunction(()=>E.tl&&E.tl.clips.length>=5,null,{timeout:20000});await p.waitForTimeout(1000);
 // every mood renders audio with sound in it
 console.log('moods',await p.evaluate(async()=>{const out=[];for(const k of Object.keys(MOODS)){const buf=await renderScore(cleanPlan(null,k));const d=buf.getChannelData(0);let s=0;for(let i=0;i<d.length;i+=7)s+=d[i]*d[i];out.push(k+':'+(Math.sqrt(s/(d.length/7))>.01?'ok':'SILENT'))}return out.join(' ')}));
 console.log('melody stable',await p.evaluate(()=>JSON.stringify(motif(42,'minor'))===JSON.stringify(motif(42,'minor'))&&JSON.stringify(motif(42,'minor'))!==JSON.stringify(motif(43,'minor'))));
 // first score from the dialog
 await p.click('#scoreBtn');await p.uncheck('#scoreAI');await p.click('#scoreGo');await p.waitForFunction(()=>!document.querySelector('#sh-score'),null,{timeout:60000});
 console.log('first',await p.evaluate(()=>E.tl.score.mood+' '+E.tl.score.bpm+' drop '+E.tl.score.drop));
 // chat: make it trap, move the drop, mute the lead
 const ask=async(text,reply)=>{await p.evaluate(r=>{window.__reply=r;state.itab='claude';$("#insp").dataset.k="";render()},reply);await p.fill('#asText',text);await p.click('#asGo');await p.waitForFunction(()=>!assistBusy,null,{timeout:30000});await p.waitForTimeout(2500)};
 await ask('make the music trap and land the drop at 4 seconds, no melody',{say:'Switched to trap, dropping at 4 s.',ops:[{op:'score',mood:'trap',drop:4,mute:['lead']}]});
 console.log('prompt had score',await p.evaluate(()=>/"score":\{"mood":"club"/.test(window.__prompt)));
 console.log('after chat',await p.evaluate(()=>{const s=E.tl.score;return s.mood+' '+s.bpm+' drop '+s.drop+' mute '+(s.mute||[]).join()+' · score clips '+E.tl.clips.filter(c=>c.gen==='score').length+' · score media '+state.media.filter(m=>/^Score - /.test(m.name)).length+' · '+E.tl.clips.find(c=>c.gen==='score').name}));
 // captions: place two, style from the Inspector, then from chat
 await p.evaluate(()=>{edit(tl=>{[[0.5,'Welcome to Dark Out'],[3,'Doors at half ten']].forEach(([t,x])=>{const c=newTitle(t);Object.assign(c,clone(TPRESETS.caption),{track:'V3',text:x,out:2,name:'Caption',autoCap:true});tl.clips.push(c)})});const c=E.tl.clips.find(c=>c.autoCap);E.sel=new Set([c.id]);state.itab='clip';$("#insp").dataset.k="";render()});await p.waitForTimeout(300);
 console.log('chips',await p.locator('[data-capstyle]').count());await p.click('[data-capstyle="pop"]');
 console.log('pop',await p.evaluate(()=>E.tl.clips.filter(c=>c.autoCap).map(c=>c.font+'/'+c.upper+'/'+c.hl+'/'+c.text).join(' | ')));
 await ask('make the captions neon with a red highlight lower down',{say:'Neon captions.',ops:[{op:'captions',style:'neon',hl:'#ff0000',yPos:85}]});
 console.log('chat style',await p.evaluate(()=>E.tl.clips.filter(c=>c.autoCap).map(c=>c.font+'/'+c.glow+'/'+c.hl+'/'+c.yPos).join(' | ')));
 await ask('remove the music',{say:'Removed.',ops:[{op:'score',remove:true}]});console.log('removed',await p.evaluate(()=>E.tl.clips.filter(c=>c.gen==='score').length+' '+(E.tl.score===undefined)));
 console.log(errs.slice(0,5).join(' | ')||'no errors');await b.close()})();
