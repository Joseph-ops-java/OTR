#!/usr/bin/env node
/* Edit Bay browser tests. Serves ../ (the app) on :8765, runs every suite in suites/ with Playwright Chromium,
   and fails if a suite crashes, logs page errors, or misses the result it is meant to produce.
   Usage: node tests/run.js [suite ...]      (fixtures: tests/make-fixtures.sh first) */
const http=require("http"),fs=require("fs"),path=require("path"),{spawn}=require("child_process");
const ROOT=path.resolve(__dirname,".."),OUT=path.join(__dirname,"out"),SUITES=path.join(__dirname,"suites");
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".webmanifest":"application/manifest+json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".cube":"text/plain",".mp4":"video/mp4"};
/* what each suite must print, beyond finishing without errors */
const EXPECT={
  "test":[/export/i],"t3":[/autocut/],"t10":[/export [\d.]+s done/,/optimize .* true/],"t11":[/measure Integrated/],"t12":[/summary has transcript/],
  "t13":[/gain wheel/,/film look/],"t14":[/built \{/],"t15":[/layout/],"t16":[/scenes \d/],"t17":[/unlabelled icon buttons 0/],"t20":[/backup \d/],
  "t22":[/tile applied iris/,/"done":\["effect","frame","transition"\]/],"t24":[/tracks V4,V3,V2,V1,A1,A2,A3,A4/,/pack t1/],"t25":[/ruler 0:00 0:01 0:02 0:03/,/cmdk glow/],
  "t27":[/proxy got prompt true/,/markers \["from proxy"\]/],"t29":[/sample export done/,/hevc .*HEVC/],"t31":[/bad key Claude rejected/,/applied \["hook"\]/],
  "t34":[/markers \["gemini","openrouter"\]/],"t36":[/policy true/,/blocked true/,/allowed true/,/export under policy done/],"t35":[/Added dissolve transitions to 2 cuts/,/Muted/]};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split("?")[0]);if(p.endsWith("/"))p+="index.html";const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end()}
  res.writeHead(200,{"content-type":TYPES[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res)});
const run=s=>new Promise(done=>{const t0=Date.now();let out="";const ch=spawn(process.execPath,[path.join(SUITES,s+".js"),OUT,__dirname],{cwd:__dirname});
  const kill=setTimeout(()=>ch.kill("SIGKILL"),10*60*1000);ch.stdout.on("data",d=>out+=d);ch.stderr.on("data",d=>out+=d);
  ch.on("close",code=>{clearTimeout(kill);const lines=out.trim().split("\n");const last=(lines[lines.length-1]||"").trim();const fails=[];
    if(code!==0)fails.push("exit code "+code);if(!/^(no errors|ERRORS none)$/.test(last))fails.push("last line: "+last.slice(0,200));
    if(/TimeoutError|PAGEERR|Uncaught/.test(out))fails.push("error in output");for(const re of EXPECT[s]||[])if(!re.test(out))fails.push("missing "+re);
    done({s,ok:!fails.length,fails,secs:((Date.now()-t0)/1000).toFixed(0),out})})});
(async()=>{fs.mkdirSync(OUT,{recursive:true});await new Promise(r=>server.listen(8765,r));
  const list=process.argv.slice(2).length?process.argv.slice(2):fs.readdirSync(SUITES).filter(f=>f.endsWith(".js")).map(f=>f.replace(/\.js$/,"")).sort();
  const results=[];for(const s of list){const r=await run(s);results.push(r);console.log(`${r.ok?"PASS":"FAIL"} ${s} (${r.secs}s)${r.ok?"":"\n  "+r.fails.join("\n  ")+"\n  --- output ---\n"+r.out.split("\n").slice(-25).map(l=>"  "+l).join("\n")}`)}
  server.close();const bad=results.filter(r=>!r.ok);console.log(`\n${results.length-bad.length}/${results.length} suites passed`);process.exit(bad.length?1:0)})();
