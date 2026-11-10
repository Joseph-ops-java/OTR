/* Edit Bay — device storage. IndexedDB keeps full-size media on this device (no per-file cap beyond the browser's storage quota),
   and gives the editor a local database with the same calls as the cloud one, so it runs on its own when no account storage is available. */
const LURL={};               // localId -> object URL for media kept on this device
const IDB_OK=typeof indexedDB!=="undefined";
let idbP=null;
function idb(){if(!IDB_OK)return Promise.reject(new Error("no idb"));if(idbP)return idbP;
  idbP=new Promise((res,rej)=>{const r=indexedDB.open("editbay",1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("docs"))d.createObjectStore("docs");if(!d.objectStoreNames.contains("blobs"))d.createObjectStore("blobs")};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error("blocked"))});idbP.catch(()=>{idbP=null});return idbP}
function tx(store,mode,fn){return idb().then(d=>new Promise((res,rej)=>{const t=d.transaction(store,mode);const s=t.objectStore(store);let out;const q=fn(s);if(q)q.onsuccess=()=>{out=q.result};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)}))}

/* blobs */
const LBLOB={
  async init(){try{const keys=await tx("blobs","readonly",s=>s.getAllKeys());for(const k of keys||[]){if(LURL[k])continue;const b=await tx("blobs","readonly",s=>s.get(k));if(b)LURL[k]=URL.createObjectURL(b)}}catch(e){}
    try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(e){}},
  async put(blob){const id="l"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);await tx("blobs","readwrite",s=>s.put(blob,id));LURL[id]=URL.createObjectURL(blob);return id},
  async get(id){return tx("blobs","readonly",s=>s.get(id))},
  async del(id){try{await tx("blobs","readwrite",s=>s.delete(id))}catch(e){}if(LURL[id]){URL.revokeObjectURL(LURL[id]);delete LURL[id]}},
  async room(){try{const e=await navigator.storage.estimate();return{free:Math.max(0,(e.quota||0)-(e.usage||0)),used:e.usage||0,quota:e.quota||0}}catch(e){return null}}};

/* a small local database with the subset of the cloud db API the editor uses */
const LDB=(()=>{const mem=new Map();const subs=[];let ready=null;
  const load=()=>ready||(ready=(async()=>{try{const d=await idb();await new Promise((res,rej)=>{const t=d.transaction("docs","readonly");const s=t.objectStore("docs");const rq=s.openCursor();
      rq.onsuccess=()=>{const c=rq.result;if(c){mem.set(c.key,c.value);c.continue()}};t.oncomplete=res;t.onerror=()=>rej(t.error)})}catch(e){}})());
  const collOf=p=>p.slice(0,p.lastIndexOf("/"));
  const snap=(coll,o)=>{let docs=[...mem.entries()].filter(([p])=>collOf(p)===coll).map(([p,v])=>({id:p.slice(p.lastIndexOf("/")+1),exists:true,data:()=>JSON.parse(JSON.stringify(v)),metadata:{fromCache:false,hasPendingWrites:false}}));
    if(o.order){const[f,d]=o.order;docs.sort((a,b)=>{const x=a.data()[f],y=b.data()[f];return(String(x??"")).localeCompare(String(y??""))*(d==="desc"?-1:1)})}if(o.limit)docs=docs.slice(0,o.limit);
    return{docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}}};
  const notify=coll=>setTimeout(()=>subs.filter(s=>s.coll===coll).forEach(s=>{try{s.fn(snap(coll,s.o))}catch(e){}}),0);
  const persist=(p,v)=>tx("docs","readwrite",s=>v===undefined?s.delete(p):s.put(v,p)).catch(()=>{});
  const docRef=p=>({id:p.slice(p.lastIndexOf("/")+1),path:p,
    async get(){await load();const v=mem.get(p);return{id:this.id,exists:v!==undefined,data:()=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),metadata:{fromCache:false,hasPendingWrites:false}}},
    async set(d){await load();const v=JSON.parse(JSON.stringify(d));mem.set(p,v);await persist(p,v);notify(collOf(p))},
    async update(d){await load();const v=Object.assign({},mem.get(p)||{},JSON.parse(JSON.stringify(d)));mem.set(p,v);await persist(p,v);notify(collOf(p))},
    async delete(){await load();mem.delete(p);await persist(p);notify(collOf(p))},
    onSnapshot(fn){load().then(()=>fn(this.get?{id:this.id,exists:mem.has(p),data:()=>mem.get(p)}:null));return()=>{}},
    collection(c){return query(p+"/"+c,{})}});
  const query=(coll,o)=>({path:coll,orderBy:(f,d)=>query(coll,Object.assign({},o,{order:[f,d||"asc"]})),limit:n=>query(coll,Object.assign({},o,{limit:n})),where:()=>query(coll,o),
    doc:id=>docRef(coll+"/"+(id||("d"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)))),
    async add(d){const r=docRef(coll+"/d"+Date.now().toString(36)+Math.random().toString(36).slice(2,6));await r.set(d);return r},
    async get(){await load();return snap(coll,o)},
    onSnapshot(fn){const s={coll,o,fn};subs.push(s);load().then(()=>fn(snap(coll,o)));return()=>{const i=subs.indexOf(s);if(i>=0)subs.splice(i,1)}}});
  return{local:true,doc:docRef,collection:c=>query(c,{}),ready:load}})();

/* file saving outside claude.ai (a self-hosted copy): a normal browser download */
const LDOWN={local:true,async save({filename,data}){const b=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=filename||"download";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}};
const fmtBytes=n=>n>=1e9?(n/1e9).toFixed(n>=1e10?0:1)+" GB":n>=1e6?(n/1e6).toFixed(n>=1e8?0:1)+" MB":Math.max(1,Math.round(n/1e3))+" KB";
