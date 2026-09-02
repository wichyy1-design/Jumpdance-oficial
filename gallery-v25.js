(() => {
  const state={items:[],index:0,startX:0,startY:0};

  function isRealMediaFile(x,type){
    if(!x?.name||x.name==='.emptyFolderPlaceholder')return false;
    // Supabase devuelve las carpetas (por ejemplo "sponsors") junto con los archivos.
    // Las carpetas no tienen id/metadata: no deben contarse ni abrirse como fotos.
    if(!x.id||!x.metadata)return false;
    const mime=String(x.metadata?.mimetype||'').toLowerCase();
    if(type==='photo')return mime.startsWith('image/')||/\.(jpe?g|png|webp|gif|avif|heic)$/i.test(x.name);
    if(type==='video')return mime.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/i.test(x.name);
    return true;
  }

  async function list(bucket,type){
    const {data,error}=await sb.storage.from(bucket).list('',{limit:200,sortBy:{column:'created_at',order:'desc'}});
    if(error){console.error(error);return []}
    return (data||[])
      .filter(x=>isRealMediaFile(x,type))
      .map(x=>({name:x.name,type,url:sb.storage.from(bucket).getPublicUrl(x.name).data.publicUrl}));
  }

  function ensure(){
    let v=document.getElementById('photoViewer');
    if(v)return v;
    v=document.createElement('div');
    v.id='photoViewer';
    v.className='photoViewer hidden';
    v.innerHTML=`<div class="photoViewerBackdrop" onclick="JDGallery.close()"></div><div class="photoViewerPanel"><div class="photoViewerTopbar"><span id="photoViewerCounter"></span><div><button class="photoViewerAction" onclick="JDGallery.download(event)">⬇ Descargar</button><button class="photoViewerClose" onclick="JDGallery.close()">×</button></div></div><button class="photoViewerNav photoViewerPrev" onclick="JDGallery.prev()">‹</button><div class="photoViewerStage"><img id="photoViewerImage" class="photoViewerImage" alt=""></div><button class="photoViewerNav photoViewerNext" onclick="JDGallery.next()">›</button><div class="photoViewerHint">Deslizá hacia los costados para cambiar de foto</div></div>`;
    document.body.appendChild(v);
    const img=v.querySelector('#photoViewerImage');
    img.addEventListener('touchstart',e=>{const t=e.changedTouches?.[0];if(t){state.startX=t.clientX;state.startY=t.clientY}},{passive:true});
    img.addEventListener('touchend',e=>{const t=e.changedTouches?.[0];if(!t)return;const dx=t.clientX-state.startX,dy=t.clientY-state.startY;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.15){dx<0?JDGallery.next():JDGallery.prev()}},{passive:true});
    img.addEventListener('error',()=>JDGallery.viewerError());
    return v;
  }

  function refresh(){
    const item=state.items[state.index];
    if(!item)return;
    const img=document.getElementById('photoViewerImage');
    const c=document.getElementById('photoViewerCounter');
    if(!img||!c)return;
    img.classList.remove('loaded');
    img.onload=()=>img.classList.add('loaded');
    img.src=item.url;
    c.textContent=`${state.index+1} / ${state.items.length}`;
    const many=state.items.length>1;
    const prev=document.querySelector('.photoViewerPrev');
    const next=document.querySelector('.photoViewerNext');
    if(prev)prev.hidden=!many;
    if(next)next.hidden=!many;
  }

  function updatePhotoBadge(){
    const badge=document.querySelector('.sectionBadge');
    if(badge)badge.textContent=`${state.items.length} ${state.items.length===1?'foto':'fotos'}`;
  }

  function enterFullscreen(v){
    try{
      const fn=v.requestFullscreen||v.webkitRequestFullscreen;
      if(fn){const p=fn.call(v);p?.catch?.(()=>{})}
    }catch{}
  }

  function leaveFullscreen(){
    try{
      if(document.fullscreenElement&&document.exitFullscreen){const p=document.exitFullscreen();p?.catch?.(()=>{})}
      else if(document.webkitFullscreenElement&&document.webkitExitFullscreen){document.webkitExitFullscreen()}
    }catch{}
  }

  window.JDGallery={
    setItems(items){state.items=items||[]},
    open(i){
      if(!state.items.length)return;
      state.index=Math.max(0,Math.min(Number(i)||0,state.items.length-1));
      const v=ensure();
      v.classList.remove('hidden');
      document.body.classList.add('viewerOpen');
      refresh();
      enterFullscreen(v);
    },
    close(){
      const v=document.getElementById('photoViewer');
      if(v)v.classList.add('hidden');
      document.body.classList.remove('viewerOpen');
      leaveFullscreen();
    },
    prev(){if(!state.items.length)return;state.index=(state.index-1+state.items.length)%state.items.length;refresh()},
    next(){if(!state.items.length)return;state.index=(state.index+1)%state.items.length;refresh()},
    viewerError(){
      if(!state.items.length)return;
      const bad=state.items[state.index];
      state.items.splice(state.index,1);
      document.querySelectorAll('.galleryPhotoCard').forEach(card=>{if(card.dataset.url===bad?.url)card.remove()});
      updatePhotoBadge();
      if(!state.items.length){JDGallery.close();return}
      if(state.index>=state.items.length)state.index=0;
      refresh();
    },
    thumbnailError(img){
      const card=img?.closest?.('.galleryPhotoCard');
      const url=card?.dataset?.url;
      if(url)state.items=state.items.filter(x=>x.url!==url);
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
        setTimeout(()=>URL.revokeObjectURL(u),1000);
      }catch{window.open(item.url,'_blank','noopener,noreferrer')}
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
    const items=await list('Photos','photo');
    JDGallery.setItems(items);
    if(!items.length)return `<div class="sectionTitle"><h2>📸 Fotos</h2></div><div class="card muted">Todavía no hay contenido.</div>`;
    return `<div class="sectionTitle"><h2>📸 Fotos</h2><span class="sectionBadge">${items.length} ${items.length===1?'foto':'fotos'}</span></div><div class="mediaGrid photoGridV25">${items.map((x,i)=>`<button class="galleryPhotoCard" data-url="${esc(x.url)}" onclick="JDGallery.open(${i})"><img loading="lazy" decoding="async" src="${esc(x.url)}" alt="Foto de Jumpdance ${i+1}" onerror="JDGallery.thumbnailError(this)"><span class="galleryPhotoZoom">⌕</span></button>`).join('')}</div>`;
  };

  window.videos=async function(){
    const items=await list('Videos','video');
    if(!items.length)return `<div class="sectionTitle"><h2>🎬 Videos</h2></div><div class="card muted">Todavía no hay contenido.</div>`;
    return `<div class="sectionTitle"><h2>🎬 Videos</h2><span class="sectionBadge">${items.length} ${items.length===1?'video':'videos'}</span></div><div class="videoGridV25">${items.map((x,i)=>`<article class="videoCardV25"><video controls playsinline preload="metadata" src="${esc(x.url)}"></video><div class="videoMetaV25"><span>Video ${i+1}</span><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Abrir</a></div></article>`).join('')}</div>`;
  };
})();
