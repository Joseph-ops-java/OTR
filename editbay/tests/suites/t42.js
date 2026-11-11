/* claude.ai: voiceover from the built-in voice model, the sound description the AI reads, ducking by speech,
   find and replace in captions, Score window controls, chat suggestions, and Finish my video. Claude is mocked. */
const { chromium } = require('playwright');const S=process.argv[2];const M=process.argv[3]||S;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:800},serviceWorkers:'block'});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('editbay.toured','1')}catch(e){}window.__reply=null;window.__prompt='';
   window.claude={use:async n=>n==='sample'?{limits:async()=>({}),json:async prompt=>{window.__prompt=prompt;if(/voiceover script/.test(prompt))return{script:'Dark Out. The sixteenth of May.'};if(/Captions: \[/.test(prompt)){const m=prompt.match(/Captions: (\[.*\])/);return{lines:JSON.parse(m[1])}}if(/scoring a short video/.test(prompt))return null;return window.__reply||{say:'ok',ops:[]}}}:null}});
 const CSP="default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src 'self' blob:";
 await p.route('http://localhost:8765/index.html',async r=>{const res=await r.fetch();r.fulfill({response:res,headers:{...res.headers(),'content-security-policy':CSP}})});
 const errs=[],blocked=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{const t=m.text();if(/Content Security Policy|Refused/.test(t))blocked.push(t.slice(0,140));else if(m.type()==='error')errs.push(t.slice(0,160))});
 await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(2200);
 await p.click('.welcome [data-sample]');await p.waitForFunction(()=>E.tl&&E.tl.clips.length>=5,null,{timeout:20000});await p.waitForTimeout(1000);
 console.log('buttons',await p.locator('#voiceBtn').count(),await p.locator('#topFinish').count());
 // voiceover with the real built-in model, script written by the (mocked) AI
 await p.evaluate(()=>seek(0.5));await p.click('#voiceBtn');await p.click('#voWrite');await p.waitForFunction(()=>$('#voText').value.length>5,null,{timeout:10000});
 const t0=Date.now();await p.click('#voGo');await p.waitForFunction(()=>!document.querySelector('#sh-vo')||/Couldn/.test($('#voMsg').textContent),null,{timeout:400000,polling:1000});
 console.log('voiceover',await p.evaluate(()=>{const c=E.tl.clips.find(c=>c.gen==='vo');return c?c.track+' at '+c.start+' · '+(cdur(c)>1.5&&cdur(c)<8?'length ok':'length '+cdur(c)):'none: '+(($('#voMsg')||{}).textContent||'')}),'built in',await p.evaluate(()=>TTS.id));
 console.log('heard back',await p.evaluate(async()=>{const c=E.tl.clips.find(c=>c.gen==='vo');const tx=await transcribeMedia(mediaOf(c.mediaId));return tx?tx.words.map(w=>w.t).join(' ').toLowerCase():'nothing'}));
 // what the AI is told about the sound
 await p.evaluate(()=>{const f=state.media.find(m=>/DJ Samszy/.test(m.name));});
 await p.click('#scoreBtn');await p.click('#scoreGo');await p.waitForFunction(()=>!document.querySelector('#sh-score'),null,{timeout:60000});
 const ask=async(text,reply)=>{await p.evaluate(r=>{window.__reply=r;state.itab='claude';$("#insp").dataset.k="";render()},reply);await p.fill('#asText',text);await p.click('#asGo');await p.waitForFunction(()=>!assistBusy,null,{timeout:40000});await p.waitForTimeout(600)};
 console.log('chips',await p.evaluate(()=>{state.itab='claude';$("#insp").dataset.k="";render();return [...document.querySelectorAll('#assist .sugs [data-sug]')].slice(0,3).map(b=>b.textContent).join(' | ')}));
 await ask('duck the music under the talking',{say:'Ducked.',ops:[{op:'duck',amount:.25}]});
 console.log('audio in prompt',await p.evaluate(()=>{const m=window.__prompt.match(/TIMELINE \(JSON\):\n(\{.*\})/);const a=JSON.parse(m[1]).audio;return a?a.clips.map(c=>c.role+'@'+c.track).sort().join(',')+' · beats '+(a.beats.length>4)+' · vo sound '+JSON.stringify(a.clips.find(c=>c.role==='voiceover').sound.length>0):'MISSING'}));
 console.log('ducked',await p.evaluate(()=>{const c=E.tl.clips.find(c=>c.gen==='score');const k=c.kf&&c.kf.vol;return k?k.length+' keyframes · low '+Math.min(...k.map(x=>x[1])).toFixed(3)+' of '+c.vol:'none'}));
 // find and replace across captions
 await p.evaluate(()=>{edit(tl=>{[[0.5,"Sam's Zip plays tonight"],[3,"See Sam's Zip live"]].forEach(([t,x])=>{const c=newTitle(t);Object.assign(c,clone(TPRESETS.caption),{track:'V3',text:x,out:2,name:'Caption',autoCap:true});tl.clips.push(c)})});openReplace("Sam's Zip")});
 await p.fill('#repWith','Samszy');console.log('found',await p.evaluate(()=>$('#repMsg').textContent));await p.click('#repGo');
 console.log('replaced',await p.evaluate(()=>E.tl.clips.filter(c=>c.autoCap).map(c=>c.text).join(' | ')));await p.keyboard.press('Escape');
 // Score window: keep the plan, mute the drums, new melody
 await p.click('#scoreBtn');console.log('keep option',await p.evaluate(()=>$('#scoreMood').value));await p.uncheck('[data-part="drums"]');await p.check('#scoreNewMel');await p.click('#scoreGo');await p.waitForFunction(()=>!document.querySelector('#sh-score'),null,{timeout:60000});
 console.log('score now',await p.evaluate(()=>{const s=E.tl.score;return s.mood+' mute '+(s.mute||[]).join()+' · clips '+E.tl.clips.filter(c=>c.gen==='score').length}));
 // Finish my video (captions off here: covered by t37)
 await p.click('#topFinish');await p.uncheck('#finCaps');await p.check('#finScore');await p.check('#finLook');await p.click('#finGo');await p.waitForFunction(()=>!document.querySelector('#sh-fin'),null,{timeout:120000});await p.waitForTimeout(500);
 console.log('finish',await p.evaluate(()=>v1().filter(c=>c.look==='film').length+' graded · export open '+(state.modal==='export')+' · preset '+((E.x||{}).pre)+' · sfx '+E.tl.clips.filter(c=>c.gen==='sfx').length));
 console.log('blocked',blocked.length,blocked[0]||'');console.log(errs.slice(0,5).join(' | ')||'no errors');await b.close()})();
