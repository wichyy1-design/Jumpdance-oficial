const CACHE_NAME='jumpdance-v45-gallery-no-native-fullscreen';
const APP_SHELL=[
  '/',
  '/index.html',
  '/styles.css',
  '/gallery-v25.css?v=42',
  '/enhancements-v42.css?v=42',
  '/photo-admin-v43.css?v=43',
  '/photo-batch-upload-v44.css?v=44',
  '/mobile-fit-v25.css?v=25.3',
  '/admin-v26.css',
  '/splash-logo-v35.css?v=35',
  '/splash-logo-v35.js?v=35',
  '/home-redesign-v28.css?v=28',
  '/results-v28.css?v=28',
  '/app.js',
  '/gallery-v42.js?v=42',
  '/gallery-fullscreen-fix-v45.js?v=45',
  '/navigation-v25.js?v=42',
  '/admin-v26.js',
  '/username-auth-v26.js',
  '/admin-modules-v26.js',
  '/home-redesign-v28.js?v=28',
  '/results-v28.js?v=28',
  '/results-v28-years-fix.js?v=28.1',
  '/results-v28-delete-year.js?v=28.2',
  '/registration-submit-guard-v36.js?v=36',
  '/coreo-number-v37.js?v=37',
  '/enhancements-v42.js?v=42',
  '/photo-order-public-v43.js?v=43',
  '/photo-admin-v43.js?v=43',
  '/photo-batch-upload-v44.js?v=44',
  '/config.js',
  '/manifest.json?v=45',
  '/icons/icon-jumpdance.svg',
  '/icons/icon-jumpdance-maskable.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/jumpdance-home-reference.png'
];

const OFFLINE_FALLBACK=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#080711"><title>Jumpdance 2026</title><style>html,body{margin:0;min-height:100%;background:#080711;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}body{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}.box{max-width:420px;text-align:center}.logo{font-size:30px;font-weight:900;letter-spacing:2px}.logo span{color:#f05aa6}p{color:#c7bfd2;line-height:1.5}.dot{display:inline-block;animation:pulse 1.2s infinite}@keyframes pulse{50%{opacity:.25}}button{margin-top:12px;border:0;border-radius:14px;padding:13px 18px;font-weight:800;background:#f05aa6;color:#fff}</style></head><body><div class="box"><div class="logo">JUMP<span>DANCE</span></div><h2>Reconectando<span class="dot">…</span></h2><p>No pudimos cargar los datos en este momento. La app volverá a intentar automáticamente cuando regrese la conexión.</p><button onclick="location.reload()">VOLVER A INTENTAR</button></div><script>addEventListener('online',()=>location.reload());setInterval(()=>{if(navigator.onLine)location.reload()},5000)</script></body></html>`;

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(async path=>{
      try{
        const res=await fetch(path,{cache:'reload'});
        if(res.ok)await cache.put(path,res.clone());
      }catch{}
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('push',event=>{
  let data={title:'Jumpdance',body:'Tenés una nueva notificación.',url:'/#admin',tag:'jumpdance'};
  try{data={...data,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,
    icon:'/icons/icon-192.png',
    badge:'/icons/icon-192.png',
    tag:data.tag||'jumpdance',
    renotify:true,
    data:{url:data.url||'/#admin'}
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=event.notification.data?.url||'/#admin';
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){
      if(new URL(client.url).origin===self.location.origin){
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});

async function fetchWithTimeout(req,ms=6500){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try{return await fetch(req,{cache:'no-store',signal:controller.signal})}
  finally{clearTimeout(timer)}
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;

  const url=new URL(req.url);
  if(url.hostname.includes('supabase.co'))return;
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      try{
        const res=await fetchWithTimeout(req);
        if(res&&res.ok){
          event.waitUntil(cache.put('/index.html',res.clone()));
          return res;
        }
      }catch{}

      const cached=await cache.match('/index.html')||await caches.match('/index.html');
      if(cached)return cached;

      return new Response(OFFLINE_FALLBACK,{
        status:200,
        headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}
      });
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached){
      event.waitUntil((async()=>{
        try{
          const fresh=await fetch(req);
          if(fresh.ok)(await caches.open(CACHE_NAME)).put(req,fresh.clone());
        }catch{}
      })());
      return cached;
    }

    try{
      const fresh=await fetch(req);
      if(fresh.ok)event.waitUntil((async()=>{(await caches.open(CACHE_NAME)).put(req,fresh.clone())})());
      return fresh;
    }catch{
      return new Response('',{status:504,statusText:'Offline'});
    }
  })());
});