// Cache Storage is shared across the origin, including other Pages projects.
// Keep legacy caches available while users move old installed shortcuts.
const PREFIX='dayshape-shell:'+new URL(self.registration.scope).pathname+':';
const CACHE=PREFIX+'v8';
const FILES=['./','./index.html','./style.css','./theme-init.js','./app.js','./icon.svg','./manifest.webmanifest','./firebase-setup.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html')));return;}e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return response;}).catch(()=>caches.match(e.request)));});
