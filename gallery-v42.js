(() => {
  const LEGACY_YEAR='2026';
  const RESERVED_PREFIXES=['cover_','post_'];
  const state={allItems:[],items:[],index:0,startX:0,startY:0,lastTap:0,scale:1,pinchStartDistance:0,pinchStartScale:1};

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const distance=(a,b)=>Math.hypot((a?.clientX||0)-(b?.clientX||0),(a?.clientY||0)-(b?.clientY||0));

  function isRealMediaFile(x,type){
    if(!x?.name||x.name==='.emptyFolderPlaceholder')return false;
    if(!x.id||!x.metadata)return false;
    const mime=String(x.metadata?.mimetype||'').toLowerCase();
    if(type==='photo')return mime.startsWith('image/')||/\.(jpe?g|png|webp|gif|avif|heic)$/i.test(x.name);
    if(type==='video')return mime.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/i.test(x.name);
    return true;
  }

  function isGalleryPhoto(x){
    if(!isRealMediaFile(x,'photo'))return false;
    return !RESERVED_PREFIXES.some(prefix=>String(x.name).startsWith(prefix));
  }

  async function storageList(bucket,path=''){
    const {data,error}=await sb.storage.from(bucket).list(path,{limit:500,sortBy:{column:'created_at',order:'desc'}});
    if(error){console.error(error);return []}
    return data||[];
  }

  function itemFrom(bucket,path,name,year,type='photo',createdAt=''){
    const storagePath=path?`${path}/${name}`:name;
    return {
      name,
      path:storagePath,
      year:String(year||LEGACY_YEAR),
      type,
      createdAt:createdAt||'',
      url:sb.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
    };
  }

  async function listPhotosByYear(){
    const root=await storageList('Photos','');
    const items=[];

    for(const x of root){
      if(isGalleryPhoto(x))items.push(itemFrom('Photos','',x.name,LEGACY_YEAR,'photo',x.created_at));
    }

    const yearFolders=root.filter(x=>/^20\d{2}$/.test(String(x?.name||''))&&(!x.id||!x.metadata));
    for(const folder of yearFolders){
      const rows=await storageList('Photos',folder.name);
      for(const x of rows){
        if(isGalleryPhoto(x))items.push(itemFrom('Photos',folder.name,x.name,folder.name,'photo',x.created_at));
      }
    }

    items.sort((a,b)=>{
      const yearDiff=(Number(b.year)||0)-(Number(a.year)||0);
      if(yearDiff)return yearDiff;
      return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
    });
    return items;
  }

  async function listVideos(){
    const root=await storageList('Videos','');
    return root.filter(x=>isRealMediaFile(x,'video')).map(x=>itemFrom('Videos','',x.name,'','video',x.created_at));
  }

  function ensure(){
    let v=document.getElementById('photoViewer');
    if(v)return v;
    v=document.createElement('div');
    v.id='photoViewer';
    v.className='photoViewer hidden';
    v.innerHTML=`<div class="photoViewerBackdrop" onclick="JDGallery.close()"></div><div class="photoViewerPanel"><div class="photoViewerTopbar"><span id="photoViewerCounter"></span><div><button class="photoViewerAction" onclick="JDGallery.download(event)">⬇ Descargar</button><button class="photoViewerClose" onclick="JDGallery.close()">×</button></div></div><button class="photoViewerNav photoViewerPrev" onclick="JDGallery.prev()">‹</button><div class="photoViewerStage"><img id="photoViewerImage" class="photoViewerImage" alt=""></div><button class="photoViewerNav photoViewerNext" onclick="JDGallery.next()">›</button><div class="photoViewerHint">Deslizá para cambiar · Pellizcá o tocá dos veces para ampliar</div></div>`;
    document.body.appendChild(v);

    const img=v.querySelector('#photoViewerImage');
    img.addEventListener('error',()=>JDGallery.viewerError());
    img.addEventListener('dblclick',e=>{e.preventDefault();JDGallery.toggleZoom()});
    img.addEventListener('touchstart',e=>{
      if(e.touches?.length===2){
        state.pinchStartDistance=distance(e.touches[0],e.touches[1]);
        state.pinchStartScale=state.scale;
        return;
      }
      const t=e.changedTouches?.[0];
      if(t){state.startX=t.clientX;state.startY=t.clientY}
    },{passive:true});
    img.addEventListener('touchmove',e=>{
      if(e.touches?.length!==2||!state.pinchStartDistance)return;
      e.preventDefault();
      const d=distance(e.touches[0],e.touches[1]);
      state.scale=clamp(state.pinchStartScale*(d/state.pinchStartDistance),1,4);
      applyZoom();
    },{passive:false});
    img.addEventListener('touchend',e=>{
      if(e.touches?.length<2)state.pinchStartDistance=0;
      const t=e.changedTouches?.[0];
      if(!t)return;
      const dx=t.clientX-state.startX,dy=t.clientY-state.startY;
      const moved=Math.hypot(dx,dy);
      if(state.scale<=1.02&&Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.15){
        dx<0?JDGallery.next():JDGallery.prev();
        return;
      }
      if(moved<14){
        const now=Date.now();
        if(now-state.lastTap<300){JDGallery.toggleZoom();state.lastTap=0}else state.lastTap=now;
      }
    },{passive:true});
    return v;
  }

  function applyZoom(){
    const img=document.getElementById('photoViewerImage');
    if(!img)return;
    img.style.transform=`scale(${state.scale})`;
    img.classList.toggle('zoomed',state.scale>1.02);
    const navVisible=state.items.length>1&&state.scale<=1.02;
    const prev=document.querySelector('.photoViewerPrev');
    const next=document.querySelector('.photoViewerNext');
    if(prev)prev.hidden=!navVisible;
    if(next)next.hidden=!navVisible;
  }

  function resetZoom(){state.scale=1;state.pinchStartDistance=0;applyZoom()}

  function refresh(){
    const item=state.items[state.index];
    if(!item)return;
    const img=document.getElementById('photoViewerImage');
    const c=document.getElementById('photoViewerCounter');
    if(!img||!c)return;
    resetZoom();
    img.classList.remove('loaded');
    img.onload=()=>img.classList.add('loaded');
    img.src=item.url;
    c.textContent=`${state.index+1} / ${state.items.length} · ${item.year}`;
    applyZoom();
  }

  function updatePhotoBadge(){
    const badge=document.querySelector('.sectionBadge');
    if(badge)badge.textContent=`${state.allItems.length} ${state.allItems.length===1?'foto':'fotos'}`;
  }

  function enterFullscreen(v){
    try{const fn=v.requestFullscreen||v.webkitRequestFullscreen;if(fn){const p=fn.call(v);p?.catch?.(()=>{})}}catch{}
  }
  function leaveFullscreen(){
    try{
      if(document.fullscreenElement&&document.exitFullscreen){const p=document.exitFullscreen();p?.catch?.(()=>{})}
      else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)document.webkitExitFullscreen();
    }catch{}
  }

  window.JDGallery={
    setItems(items){state.allItems=items||[];state.items=state.allItems.slice()},
    open(i){
      if(!state.items.length)return;
      state.index=Math.max(0,Math.min(Number(i)||0,state.items.length-1));
      const v=ensure();
      v.classList.remove('hidden');
      document.body.classList.add('viewerOpen');
      refresh();
      enterFullscreen(v);
    },
    openUrl(url,year){
      const scoped=state.allItems.filter(x=>String(x.year)===String(year));
      state.items=scoped.length?scoped:state.allItems.slice();
      const i=state.items.findIndex(x=>x.url===url);
      if(i>=0)JDGallery.open(i);
    },
    close(){
      const v=document.getElementById('photoViewer');
      if(v)v.classList.add('hidden');
      document.body.classList.remove('viewerOpen');
      resetZoom();
      leaveFullscreen();
    },
    prev(){if(!state.items.length||state.scale>1.02)return;state.index=(state.index-1+state.items.length)%state.items.length;refresh()},
    next(){if(!state.items.length||state.scale>1.02)return;state.index=(state.index+1)%state.items.length;refresh()},
    toggleZoom(){state.scale=state.scale>1.02?1:2.5;applyZoom()},
    showYear(year,btn){
      document.querySelectorAll('.jdPhotoYearPane').forEach(el=>el.hidden=el.dataset.year!==String(year));
      document.querySelectorAll('.jdPhotoYearTabs button').forEach(el=>el.classList.toggle('active',el===btn));
    },
    viewerError(){
      if(!state.items.length)return;
      const bad=state.items[state.index];
      state.allItems=state.allItems.filter(x=>x.url!==bad?.url);
      state.items=state.items.filter(x=>x.url!==bad?.url);
      document.querySelectorAll('.galleryPhotoCard').forEach(card=>{if(card.dataset.url===bad?.url)card.remove()});
      updatePhotoBadge();
      if(!state.items.length){JDGallery.close();return}
      if(state.index>=state.items.length)state.index=0;
      refresh();
    },
    thumbnailLoaded(img){img?.closest?.('.galleryPhotoCard')?.classList?.remove('isLoading')},
    thumbnailError(img){
      const card=img?.closest?.('.galleryPhotoCard');
      const url=card?.dataset?.url;
      if(url){state.allItems=state.allItems.filter(x=>x.url!==url);state.items=state.items.filter(x=>x.url!==url)}
      card?.remove?.();
      updatePhotoBadge();
    },
    async download(e){
      e?.preventDefault?.();
      const item=state.items[state.index];
      if(!item)return;
      try{
        const r=await fetch(item.url);
        if(!r.ok)throw new Error('No se pudo descargar la foto');
        const b=await r.blob();
        const u=URL.createObjectURL(b);
        const a=document.createElement('a');
        a.href=u;
        a.download=item.name||'jumpdance-foto.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(u),1200);
        if(typeof toast==='function')toast('Foto descargada');
      }catch{
        window.open(item.url,'_blank','noopener,noreferrer');
        if(typeof toast==='function')toast('Abrimos la foto para descargar');
      }
    }
  };

  document.addEventListener('keydown',e=>{
    const v=document.getElementById('photoViewer');
    if(!v||v.classList.contains('hidden'))return;
    if(e.key==='Escape')JDGallery.close();
    if(e.key==='ArrowLeft')JDGallery.prev();
    if(e.key==='ArrowRight')JDGallery.next();
  });

  window.photos=async function(){
    const items=await listPhotosByYear();
    JDGallery.setItems(items);
    if(!items.length)return `<div class="sectionTitle"><h2>📸 Fotos</h2></div><div class="card muted">Todavía no hay contenido.</div>`;

    const grouped={};
    for(const item of items){(grouped[item.year]||(grouped[item.year]=[])).push(item)}
    const years=Object.keys(grouped).sort((a,b)=>(Number(b)||0)-(Number(a)||0));

    let h=`<div class="sectionTitle"><h2>📸 Fotos</h2><span class="sectionBadge">${items.length} ${items.length===1?'foto':'fotos'}</span></div>`;
    h+=`<div class="jdPhotoYearTabs">${years.map((year,i)=>`<button class="${i===0?'active':''}" onclick="JDGallery.showYear('${esc(year)}',this)">Jumpdance ${esc(year)}</button>`).join('')}</div>`;
    years.forEach((year,yi)=>{
      h+=`<section class="jdPhotoYearPane" data-year="${esc(year)}" ${yi?'hidden':''}><div class="jdPhotoYearTitle">Jumpdance ${esc(year)}</div><div class="mediaGrid photoGridV25">`;
      h+=grouped[year].map((x,i)=>`<button class="galleryPhotoCard isLoading" data-url="${esc(x.url)}" onclick="JDGallery.openUrl(this.dataset.url,'${esc(year)}')"><span class="galleryPhotoSkeleton" aria-hidden="true"></span><img loading="lazy" decoding="async" src="${esc(x.url)}" alt="Foto de Jumpdance ${esc(year)} ${i+1}" onload="JDGallery.thumbnailLoaded(this)" onerror="JDGallery.thumbnailError(this)"><span class="galleryPhotoZoom">⌕</span></button>`).join('');
      h+=`</div></section>`;
    });
    return h;
  };

  window.videos=async function(){
    const items=await listVideos();
    if(!items.length)return `<div class="sectionTitle"><h2>🎬 Videos</h2></div><div class="card muted">Todavía no hay contenido.</div>`;
    return `<div class="sectionTitle"><h2>🎬 Videos</h2><span class="sectionBadge">${items.length} ${items.length===1?'video':'videos'}</span></div><div class="videoGridV25">${items.map((x,i)=>`<article class="videoCardV25"><video controls playsinline preload="metadata" src="${esc(x.url)}"></video><div class="videoMetaV25"><span>Video ${i+1}</span><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Abrir</a></div></article>`).join('')}</div>`;
  };
})();
