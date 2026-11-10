/* Edit Bay — sequential frame decoding for renders. MP4/MOV are demuxed with mp4box.js and decoded in order with WebCodecs,
   so each frame costs one decode instead of a seek (seeking re-decodes from the last keyframe). Anything else falls back to seeking. */
const DEMUX={};
const DEC_OK=typeof VideoDecoder!=="undefined"&&typeof MP4Box!=="undefined";
function demux(m){if(DEMUX[m.id])return DEMUX[m.id];const p=(async()=>{const blob=await(await fetch(blobUrl(m))).blob();const f=MP4Box.createFile();let info=null,samples=[],trackId=null,done=false;
  const ready=new Promise((res,rej)=>{f.onError=e=>rej(new Error(String(e)));f.onReady=i=>{info=i;const vt=i.videoTracks&&i.videoTracks[0];if(!vt){rej(new Error("no video track"));return}trackId=vt.id;f.setExtractionOptions(vt.id,null,{nbSamples:Infinity});f.start();res()}});
  f.onSamples=(id,u,ss)=>{for(const s of ss)samples.push({cts:s.cts/s.timescale,dts:s.dts/s.timescale,dur:s.duration/s.timescale,key:s.is_sync,data:s.data})};
  const CH=8*1048576;let off=0;while(off<blob.size){const ab=await blob.slice(off,off+CH).arrayBuffer();ab.fileStart=off;f.appendBuffer(ab);off+=CH;if(!info&&off>=blob.size)break}f.flush();await ready;
  const vt=info.videoTracks[0];const trak=f.getTrackById(trackId);let desc=null;
  for(const e of trak.mdia.minf.stbl.stsd.entries){const box=e.avcC||e.hvcC||e.vpcC||e.av1C;if(box){const ds=new DataStream(undefined,0,DataStream.BIG_ENDIAN);box.write(ds);desc=new Uint8Array(ds.buffer,8);break}}
  const mx=vt.matrix||[];let rot=0;if(mx.length>=5){const a=mx[0]/65536,b=mx[1]/65536;rot=Math.round(Math.atan2(b,a)*180/Math.PI);rot=((rot%360)+360)%360}
  samples.sort((a,b)=>a.dts-b.dts);
  /* honour the edit list (B-frame encoders delay presentation; browsers skip that delay, so do we) */
  let shift=0;try{const el=trak.edts&&trak.edts.elst&&trak.edts.elst.entries;if(el&&el.length){const e=el.find(x=>x.media_time>=0);if(e)shift=e.media_time/trak.mdia.mdhd.timescale}}catch(e){}
  if(!shift&&samples.length){shift=Math.min(...samples.slice(0,16).map(x=>x.cts))}
  if(shift)samples.forEach(x=>{x.cts-=shift;x.dts-=shift});
  const cfg={codec:vt.codec.startsWith("avc")||vt.codec.startsWith("hvc")||vt.codec.startsWith("hev")?vt.codec:vt.codec,codedWidth:vt.video.width,codedHeight:vt.video.height,description:desc||undefined,optimizeForLatency:false};
  const sup=await VideoDecoder.isConfigSupported(cfg).catch(()=>({supported:false}));if(!sup.supported)throw new Error("decoder unsupported: "+vt.codec);
  return{cfg,samples,rot,w:vt.video.width,h:vt.video.height}})();DEMUX[m.id]=p;p.catch(()=>{delete DEMUX[m.id]});return p}

class FrameSource{
  constructor(d){this.d=d;this.q=[];this.next=0;this.cur=null;this.dec=null;this.err=null;this.fed=-1}
  open(){if(this.dec)try{this.dec.close()}catch(e){}this.q.forEach(f=>f.close());this.q=[];this.dec=new VideoDecoder({output:f=>this.q.push(f),error:e=>{this.err=e}});this.dec.configure(this.d.cfg)}
  keyBefore(t){const S=this.d.samples;let k=0;for(let i=0;i<S.length;i++){if(S[i].cts>t+1e-4&&S[i].dts>t+1e-4)break;if(S[i].key)k=i}return k}
  async frameAt(t){const S=this.d.samples;if(!S.length)return null;t=Math.max(S[0].cts,t);
    if(this.back&&this.back.length){const b=this.back;if(t>=b[0].timestamp/1e6-1e-4&&t<=b[b.length-1].timestamp/1e6+1e-4){while(b.length>1&&b[b.length-1].timestamp/1e6>t+1e-4)b.pop().close();return b[b.length-1]}
      if(t<b[0].timestamp/1e6)return this.fillBack(t);b.forEach(f=>f.close());this.back=null}
    if(this.cur&&this.cur.timestamp/1e6>t+1e-4)return this.fillBack(t);
    const have=this.cur&&this.cur.timestamp/1e6<=t+1e-4;const ahead=this.q.length?this.q[this.q.length-1].timestamp/1e6:this.cur?this.cur.timestamp/1e6:-1;
    if(!this.dec||(this.cur&&this.cur.timestamp/1e6>t+1e-4)||(t-Math.max(ahead,0)>2.5&&this.keyBefore(t)>this.next)){this.open();if(this.cur){this.cur.close();this.cur=null}this.next=this.keyBefore(t)}
    for(;;){if(this.err)throw this.err;
      while(this.q.length&&this.q[0].timestamp/1e6<=t+1e-4){if(this.cur)this.cur.close();this.cur=this.q.shift()}
      if(this.q.length||this.next>=S.length){if(this.next>=S.length&&!this.q.length&&this.dec.decodeQueueSize===0){await this.dec.flush().catch(()=>{});while(this.q.length&&this.q[0].timestamp/1e6<=t+1e-4){if(this.cur)this.cur.close();this.cur=this.q.shift()}}break}
      const n=Math.min(S.length,this.next+4);for(;this.next<n;this.next++){const s=S[this.next];this.dec.decode(new EncodedVideoChunk({type:s.key?"key":"delta",timestamp:Math.round(s.cts*1e6),duration:Math.round(s.dur*1e6),data:s.data}))}
      if(this.next>=S.length)await this.dec.flush().catch(()=>{});else await new Promise(r=>setTimeout(r,0));
      if(this.dec.decodeQueueSize>8)await new Promise(r=>setTimeout(r,2))}
    return this.cur}
  /* reverse playback: decode from the keyframe before t and keep the last second of frames, then walk back through them */
  async fillBack(t){if(this.back)this.back.forEach(f=>f.close());this.back=null;if(this.cur){this.cur.close();this.cur=null}this.open();const S=this.d.samples;this.next=this.keyBefore(t);const keep=t-1,list=[];let done=false;
    while(!done){if(this.err)throw this.err;while(this.q.length){const f=this.q.shift(),ts=f.timestamp/1e6;if(ts<=t+1e-4){if(ts>=keep-1e-4)list.push(f);else f.close()}else{f.close();done=true}}
      if(done)break;if(this.next>=S.length){await this.dec.flush().catch(()=>{});if(!this.q.length)break;continue}
      const n=Math.min(S.length,this.next+4);for(;this.next<n;this.next++){const s=S[this.next];this.dec.decode(new EncodedVideoChunk({type:s.key?"key":"delta",timestamp:Math.round(s.cts*1e6),duration:Math.round(s.dur*1e6),data:s.data}))}
      await new Promise(r=>setTimeout(r,0))}
    try{this.dec.close()}catch(e){}this.dec=null;this.q.forEach(f=>f.close());this.q=[];list.sort((a,b)=>a.timestamp-b.timestamp);this.back=list;return list[list.length-1]||null}
  close(){if(this.back){this.back.forEach(f=>f.close());this.back=null}try{this.dec&&this.dec.close()}catch(e){}this.q.forEach(f=>f.close());this.q=[];if(this.cur){this.cur.close();this.cur=null}}}

/* render-time frame overrides: clip id -> {frame, rot}. renderClip draws these instead of the <video> element. */
E.fo=null;const FSRC=new Map();
async function frameFor(c,t){if(!DEC_OK)return null;let fs=FSRC.get(c.id);if(fs===false)return null;
  if(!fs){const m=mediaOf(c.mediaId);try{const d=await demux(m);fs=new FrameSource(d);FSRC.set(c.id,fs)}catch(e){FSRC.set(c.id,false);return null}}
  try{return await fs.frameAt(srcTime(c,t))}catch(e){fs.close();FSRC.set(c.id,false);return null}}
function closeFrameSources(){FSRC.forEach(f=>f&&f.close());FSRC.clear()}
function placeRot(ctx,src,vw,vh,c,t,rot){if(!rot)return place(ctx,src,vw,vh,c,t);const W=E.tl.w,H=E.tl.h,sw=rot%180?vh:vw,sh=rot%180?vw:vh;
  let s=(c.fit==="fill"?Math.max(W/sw,H/sh):Math.min(W/sw,H/sh))*kv(c,"scale",t);if(c.kb&&t!=null)s*=1+.12*clamp((t-c.start)/cdur(c),0,1);
  const cx=W/2+kv(c,"x",t)*W,cy=H/2+kv(c,"y",t)*H;ctx.translate(cx,cy);ctx.rotate((kv(c,"rot",t)+rot)*Math.PI/180);ctx.drawImage(src,-vw*s/2,-vh*s/2,vw*s,vh*s)}
