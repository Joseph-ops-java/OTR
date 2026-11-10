/* Edit Bay — audio finishing: J/L split edits, equal-power crossfades (under video transitions and overlapping audio clips),
   per-track EQ + compressor (playback and export), audio scrubbing, and a live K-weighted loudness meter. */

/* ---------- when a clip's sound is heard ---------- */
/* J/L leads and tails can only use media that exists before the in point / after the out point (the handles) */
function leadOf(c){if(!(c.lead>0)||c.reverse||c.ramp)return 0;return Math.min(c.lead,c.in/(c.speed||1))}
function tailOf(c){if(!(c.tail>0)||c.reverse||c.ramp)return 0;const m=mediaOf(c.mediaId);return Math.min(c.tail,Math.max(0,((m&&m.dur)||c.out)-c.out)/(c.speed||1))}
function audWin(c){if(c.track!=="V1")return[c.start,cend(c)];const p=v1Prev(c),n=v1Next(c);
  const L=leadOf(c),T=tailOf(c),pT=p?tailOf(p):0,nL=n?leadOf(n):0;let a0=L>0?c.start-L:(pT>0?Math.min(cend(c),cend(p)+pT):c.start),a1=T>0?cend(c)+T:(nL>0?Math.max(c.start,n.start-nL):cend(c));
  const hi=trHalf(c),ho=n?trHalf(n):0;if(hi>0&&!(L>0))a0=Math.min(a0,c.start-hi);if(ho>0&&!(T>0))a1=Math.max(a1,cend(c)+ho);return[a0,a1]}
function xfShape(u){return Math.sin(clamp(u,0,1)*Math.PI/2)} // equal power
function audGate(c,t){const[a0,a1]=audWin(c);if(t<a0||t>=a1)return 0;let g=1;
  if(c.track==="V1"){const hi=trHalf(c),n=v1Next(c),ho=n?trHalf(n):0;if(hi>0&&!(leadOf(c)>0)&&t<c.start+hi)g*=xfShape((t-(c.start-hi))/(2*hi));if(ho>0&&!(tailOf(c)>0)&&t>cend(c)-ho)g*=xfShape((cend(c)+ho-t)/(2*ho))}
  else{if(c.xf>0&&t<c.start+c.xf)g*=xfShape((t-c.start)/c.xf);const nx=E.tl.clips.find(x=>x!==c&&x.track===c.track&&x.xf>0&&x.start<cend(c)&&x.start>=c.start);if(nx&&t>=nx.start)g*=xfShape((cend(c)-t)/Math.max(.001,cend(c)-nx.start))}
  return g}

/* ---------- track processing: bus = gain -> low shelf -> mid peak -> high shelf -> compressor -> meter ---------- */
function buildBus(ac,tr,dest){const t=trk(tr),g=ac.createGain(),lo=ac.createBiquadFilter(),mi=ac.createBiquadFilter(),hi=ac.createBiquadFilter(),cp=ac.createDynamicsCompressor();
  lo.type="lowshelf";lo.frequency.value=120;mi.type="peaking";mi.frequency.value=1600;mi.Q.value=.9;hi.type="highshelf";hi.frequency.value=8000;
  g.connect(lo);lo.connect(mi);mi.connect(hi);hi.connect(cp);cp.connect(dest);const b={g,lo,mi,hi,cp};setBus(b,tr);return b}
function setBus(b,tr){const t=trk(tr),eq=t.eq||{};b.g.gain.value=busGain(tr);b.lo.gain.value=eq.l||0;b.mi.gain.value=eq.m||0;b.hi.gain.value=eq.h||0;
  const on=!!t.comp;b.cp.threshold.value=on?-20:0;b.cp.ratio.value=on?3.5:1;b.cp.knee.value=on?8:0;b.cp.attack.value=.008;b.cp.release.value=.18}
let KAN=null;
ensureAudio=function(){if(AC){if(AC.state==="suspended")AC.resume().catch(()=>{});return}
  try{AC=new(window.AudioContext||window.webkitAudioContext)();MIX=AC.createGain();MASTER_AN=AC.createAnalyser();MASTER_AN.fftSize=1024;MIX.connect(MASTER_AN);MASTER_AN.connect(AC.destination);
    XDEST=AC.createMediaStreamDestination?AC.createMediaStreamDestination():null;if(XDEST)MIX.connect(XDEST);
    const k1=AC.createBiquadFilter(),k2=AC.createBiquadFilter();k1.type="highshelf";k1.frequency.value=1681;k1.gain.value=4;k2.type="highpass";k2.frequency.value=38;k2.Q.value=.5;KAN=AC.createAnalyser();KAN.fftSize=32768;MIX.connect(k1);k1.connect(k2);k2.connect(KAN);
    TRACKS.forEach(tr=>{const an=AC.createAnalyser();an.fftSize=1024;an.connect(MIX);const b=buildBus(AC,tr,an);b.an=an;BUS[tr]=b});recs.forEach(attachAudio);applyBuses()}catch(e){AC=null}};
applyBuses=function(){if(!AC)return;TRACKS.forEach(tr=>{if(BUS[tr])setBus(BUS[tr],tr)});if(MIX)MIX.gain.value=E.tl&&E.tl.master!=null?E.tl.master:1};
const KBUF=new Float32Array(32768);
function momentaryLUFS(){if(!KAN||!E.playing)return null;KAN.getFloatTimeDomainData(KBUF);const n=Math.min(KBUF.length,Math.round(AC.sampleRate*.4));let s=0;for(let i=KBUF.length-n;i<KBUF.length;i++)s+=KBUF[i]*KBUF[i];
  const ms=s/n*2;return ms>0?-.691+10*Math.log10(ms):-Infinity}

/* ---------- audio scrubbing ---------- */
E.ascrub=true;let scrubLast=0;
async function scrubAt(t){if(!E.ascrub||E.playing||!E.tl)return;const now=performance.now();if(now-scrubLast<70)return;scrubLast=now;ensureAudio();if(!AC)return;
  for(const c of E.tl.clips){if(c.off||!trackOn(c.track)||!(c.type==="audio"||(c.type==="video"&&!c.freeze)))continue;const g0=audGate(c,t)*kv(c,"vol",t);if(g0<=0)continue;const m=mediaOf(c.mediaId);if(!m)continue;
    let buf;try{buf=await decodeHQ(m)}catch(e){continue}const s=AC.createBufferSource();s.buffer=c.reverse?reversed(buf):buf;const g=AC.createGain();g.gain.setValueAtTime(0,AC.currentTime);g.gain.linearRampToValueAtTime(g0,AC.currentTime+.008);g.gain.linearRampToValueAtTime(0,AC.currentTime+.075);
    s.connect(g);g.connect((BUS[c.track]||{}).g||MIX);const st=srcTime(c,t);s.start(0,c.reverse?Math.max(0,buf.duration-st):st,.08)}}

/* ---------- mixer additions: EQ, compressor, loudness ---------- */
const _mixerPane=mixerPane;mixerPane=function(body){_mixerPane(body);
  body.querySelectorAll(".strip2").forEach(st=>{const nm=st.querySelector(".nm").textContent;if(nm==="MAIN"){st.insertAdjacentHTML("beforeend",`<span class="db" id="lufsM" title="Momentary loudness (K-weighted, 400 ms)">— LUFS</span>`);return}
    const t=trk(nm),eq=t.eq||{};st.insertAdjacentHTML("beforeend",`<div class="eqk">${[["l","Low"],["m","Mid"],["h","High"]].map(([k,l])=>`<label title="${l} EQ (dB)"><span>${l[0]}</span><input type="range" min="-12" max="12" step=".5" value="${eq[k]||0}" data-eq="${nm}:${k}" aria-label="${nm} ${l} EQ"></label>`).join("")}</div><button class="btn sm ${t.comp?"blue":""}" data-comp="${nm}" title="Compressor: evens out levels (−20 dB threshold, 3.5:1)">Comp</button>`)});
  const f=body.querySelector(".mixfoot");if(f)f.insertAdjacentHTML("afterbegin",`<button class="btn sm" data-measure="1" title="Measure the whole timeline's loudness (ITU-R BS.1770)">Measure loudness</button><span class="mono" id="lufsI" style="font-size:11px;color:var(--muted)">${E.lufsI||""}</span>`)};
document.addEventListener("input",e=>{const el=e.target;if(!el.dataset||!el.dataset.eq)return;const[tr,k]=el.dataset.eq.split(":");if(!E.eqUndo){pushUndo();E.eqUndo=true}E.tl.tracks[tr]=E.tl.tracks[tr]||{};const t=E.tl.tracks[tr];t.eq=Object.assign({},t.eq,{[k]:+el.value});applyBuses();clearTimeout(E.eqT);E.eqT=setTimeout(()=>{E.eqUndo=false;commit()},400)});
document.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.comp){const tr=b.dataset.comp;edit(tl=>{tl.tracks[tr]=tl.tracks[tr]||{};tl.tracks[tr].comp=!tl.tracks[tr].comp});applyBuses();mixerPane($("#bbody"));meterLoop()}
  else if(b.dataset.measure){b.disabled=true;b.textContent="Measuring…";try{const r=await measureTimeline();E.lufsI=r&&isFinite(r.I)?`Integrated ${r.I.toFixed(1)} LUFS · short-term max ${r.stMax.toFixed(1)} · peak ${r.peak.toFixed(1)} dB`:"No sound on the timeline";}catch(x){E.lufsI="Couldn’t measure"}
    const o=$("#lufsI");if(o)o.textContent=E.lufsI;b.disabled=false;b.textContent="Measure loudness"}
  else if(b.id==="ascrubBtn"){E.ascrub=!E.ascrub;b.classList.toggle("on",E.ascrub)}});
setInterval(()=>{const o=$("#lufsM");if(!o)return;const v=momentaryLUFS();o.textContent=v==null||!isFinite(v)?"— LUFS":v.toFixed(1)+" LUFS"},250);
