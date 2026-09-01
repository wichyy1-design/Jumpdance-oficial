const CACHE_NAME='jumpdance-v26-1-username-login';
const APP_SHELL=[
  '/',
  '/index.html',
  '/styles.css',
  '/gallery-v25.css',
  '/mobile-fit-v25.css',
  '/admin-v26.css',
  '/app.js',
  '/gallery-v25.js',
  '/navigation-v25.js',
  '/admin-v26.js',
  '/username-auth-v26.js',
  '/config.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  '/jumpdance-home-reference.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('push', event => {
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

self.addEventListener('notificationclick', event => {
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

self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.hostname.includes('supabase.co'))return;

  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      const copy=res.clone();
      caches.open(CACHE_NAME).then(c=>c.put('/index.html',copy));
      return res;
    }).catch(()=>caches.match('/index.html')));
    return;
  }

  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(url.origin===self.location.origin&&res.ok){
      const copy=res.clone();
      caches.open(CACHE_NAME).then(c=>c.put(req,copy));
    }
    return res;
  })));
});
