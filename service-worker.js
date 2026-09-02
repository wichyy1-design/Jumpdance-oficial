const CACHE_NAME='jumpdance-v40-long-messages';
const APP_SHELL=[
  '/',
  '/index.html',
  '/styles.css',
  '/gallery-v25.css',
  '/mobile-fit-v25.css?v=25.3',
  '/admin-v26.css',
  '/splash-logo-v35.css?v=35',
  '/splash-logo-v35.js?v=35',
  '/home-redesign-v28.css?v=28',
  '/results-v28.css?v=28',
  '/app.js',
  '/gallery-v25.js',
  '/navigation-v25.js',
  '/admin-v26.js',
  '/username-auth-v26.js',
  '/admin-modules-v26.js',
  '/home-redesign-v28.js?v=28',
  '/results-v28.js?v=28',
  '/results-v28-years-fix.js?v=28.1',
  '/results-v28-delete-year.js?v=28.2',
  '/registration-submit-guard-v36.js?v=36',
  '/config.js',
  '/manifest.json',
  '/icons/icon-jumpdance.svg',
  '/icons/icon-jumpdance-maskable.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/jumpdance-home-reference.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
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

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;

  const url=new URL(req.url);
  if(url.hostname.includes('supabase.co'))return;
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    const network=caches.open(CACHE_NAME).then(cache=>
      fetch(req,{cache:'no-store'}).then(res=>{
        if(res.ok)cache.put('/index.html',res.clone());
        return res;
      }).catch(()=>null)
    );
    event.waitUntil(network);
    event.respondWith(caches.match('/index.html').then(cached=>cached||network).then(res=>res||Response.error()));
    return;
  }

  const network=caches.open(CACHE_NAME).then(cache=>
    fetch(req).then(res=>{
      if(res.ok)cache.put(req,res.clone());
      return res;
    }).catch(()=>null)
  );
  event.waitUntil(network);
  event.respondWith(caches.match(req).then(cached=>cached||network).then(res=>res||Response.error()));
});