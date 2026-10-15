const CACHE_NAME="plantsos-pwa-v10-streamlined-layout-20261015";
const APP_SHELL=["/","/manifest.webmanifest","/icon-192.png","/icon-512.png","/cuhksz-igem-logo.png","/ble.css","/wifi.css","/phase1.css","/ble-results-v2.js","/phase1-results-v2.js","/assets/page-results-v2.js","/assets/bootstrap-results-v2.js","/assets/result-data-v2.js","/assets/result-ui-v2.js","/assets/results-v2.css"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(async cache=>{
    // One unavailable optional asset must not prevent the corrected worker from activating.
    await Promise.allSettled(APP_SHELL.map(async path=>{
      const response=await fetch(new Request(path,{cache:"reload"}));
      if(response.ok)await cache.put(path,response);
    }));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("plantsos-pwa-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  // Changed scripts keep the framework's existing filenames, so prefer fresh versions.
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==="navigate"){const shell=await caches.match("/");if(shell)return shell;}
    return Response.error();
  }));
});
