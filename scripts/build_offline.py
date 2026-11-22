"""Generate a complete, versioned offline package; run after version_assets.py."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parent.parent/'dist'
# The data layers are inputs to scripts/build_runtime.cjs; the page loads soz-core.js
# and the details/ files instead, so the offline package leaves the layers out.
LAYERS={name+'.js' for name in ['data','lexicon','grammar','vocabulary','review','bilingual','expansion','nominal','additions','relations','references','growth','orthography-lexical','orthography-lexical-evidence','print-definitions','orthography','verification']}
files=sorted(p for p in root.rglob('*') if p.is_file() and p.name not in {'sw.js','offline-package.json','vercel.json'} and str(p.relative_to(root)) not in LAYERS)
version=hashlib.sha256(Path(__file__).read_bytes()+b''.join(str(p.relative_to(root)).encode()+p.read_bytes() for p in files)).hexdigest()[:16]
assets=[str(p.relative_to(root)) for p in files];meta={'version':version,'files':len(files),'bytes':sum(p.stat().st_size for p in files),'policy':'Offline availability requires a completed download on this device. Browser storage eviction can remove the package.'}
(root/'offline-package.json').write_text(json.dumps(meta,indent=2)+'\n')
hashes={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files+[root/'offline-package.json']}
worker=r'''/* Generated versioned offline package. No credentials are stored. */
let downloading=false;
const VERSION=__VERSION__,CACHE='soz-offline-'+VERSION,META='soz-offline-state',ASSETS=__ASSETS__,HASHES=__HASHES__,scope=new URL(self.registration.scope),url=file=>new URL(file,scope).href;
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
async function ready(cacheName){const state=await caches.open(META),entry=await state.match(url('__ready__'));if(!entry)return null;const r=await entry.json();if(!await caches.has(r.cache))return null;const saved=await caches.open(r.cache);if(!await saved.match(url('index.html')))return null;return cacheName?r.cache===cacheName:r;}
async function digest(response){const bytes=await response.clone().arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
async function download(port){if(downloading){port?.postMessage({error:'Yükləmə artıq davam edir.'});return;}const current=await ready();if(current?.cache===CACHE){port?.postMessage({ready:true});return;}downloading=true;
 const cache=await caches.open(CACHE),previous=current?await caches.open(current.cache):null;let completed=0;
 try{for(let i=0;i<ASSETS.length;i+=4){await Promise.all(ASSETS.slice(i,i+4).map(async file=>{let response=null,verified=false;if(previous){const saved=await previous.match(url(file));if(saved&&await digest(saved)===HASHES[file]){response=saved;verified=true;}}if(!response)response=await fetch(new Request(file==='index.html'?scope.href:url(file.endsWith('.html')?file.slice(0,-5):file),{credentials:'same-origin',cache:'reload'}));const expected=String(file).split('.').pop();if(!response.ok||response.redirected||response.type==='opaque'||expected==='js'&&!(response.headers.get('content-type')||'').match(/javascript|ecmascript/)||expected!=='html'&&(response.headers.get('content-type')||'').includes('text/html'))throw new Error('Fayl yüklənmədi: '+file);if(file==='index.html'){const text=await response.clone().text();if(!text.includes('id="map"')||!text.includes('id="conjugationPage"'))throw new Error('Səhifə təsdiqlənmədi.');}if(!verified&&await digest(response)!==HASHES[file])throw new Error('Məlumat versiyası dəyişdi. Yenidən cəhd edin.');await cache.put(url(file),response);completed++;port?.postMessage({progress:Math.round(completed/ASSETS.length*100)});}));}
  const index=await cache.match(url('index.html'));await cache.put(scope.href,index.clone());const state=await caches.open(META);await state.put(url('__ready__'),new Response(JSON.stringify({cache:CACHE,version:VERSION,hashes:HASHES})));port?.postMessage({ready:true});try{const keep=new Set([CACHE,META,current?.cache]);for(const name of await caches.keys())if(name.startsWith('soz-offline-')&&!keep.has(name))await caches.delete(name);}catch{}
 }catch(error){if(!current||current.cache!==CACHE)await caches.delete(CACHE);port?.postMessage({error:error.message});}finally{downloading=false;}
}
self.addEventListener('message',event=>{const port=event.ports[0];if(event.data?.type==='CACHE_APP')event.waitUntil(download(port));else if(event.data?.type==='STATUS')event.waitUntil(ready().then(r=>port?.postMessage({ready:!!r,version:r?.version,current:r?.version===VERSION})));});
// Prefer live HTML online. Offline packages remain immutable, coherent snapshots.
self.addEventListener('fetch',event=>{const request=event.request,parsed=new URL(request.url);if(request.method!=='GET'||parsed.origin!==scope.origin||!parsed.pathname.startsWith(scope.pathname))return;
 event.respondWith((async()=>{
  const state=await ready();if(!state)return fetch(request);
  const cache=await caches.open(state.cache),canonical=new URL(parsed);canonical.search='';canonical.hash='';const file=decodeURIComponent(canonical.pathname.slice(scope.pathname.length))||'index.html';
  if(request.mode==='navigate'){
   try{const live=await fetch(new Request(request,{cache:'no-store'}));if(live.ok)return live;}catch{}
   return await cache.match(canonical.href)||await cache.match(url(file+'.html'))||await cache.match(url('index.html'))||fetch(request);
  }
  const cached=await cache.match(canonical.href),version=parsed.searchParams.get('v');
  if(version&&cached){
   // A newer live page must never receive an older cached script with the same
   // filename. Legacy installed packages did not record their asset hashes.
   let hash=state.hashes?.[file];if(!hash){const bytes=await cached.clone().arrayBuffer();hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
   if(hash.startsWith(version))return cached;
   return fetch(request);
  }
  try{const live=await fetch(request);if(live.ok)return live;if(cached)return cached;return live;}catch(error){if(cached)return cached;throw error;}
 })());
});
'''.replace('__VERSION__',json.dumps(version)).replace('__ASSETS__',json.dumps(assets+['offline-package.json'])).replace('__HASHES__',json.dumps(hashes))
(root/'sw.js').write_text(worker)
print(json.dumps(meta))
