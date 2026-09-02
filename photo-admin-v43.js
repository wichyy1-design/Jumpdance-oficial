(() => {
  const DEFAULT_YEAR='2026';
  const baseOpenAdminModule=window.openAdminModule;

  const clean=v=>String(v??'').trim();
  const safeYear=v=>/^20\d{2}$/.test(clean(v))?clean(v):DEFAULT_YEAR;
  const canMedia=()=>!!(window.JD_ADMIN_ACCESS?.is_owner||window.JD_ADMIN_ACCESS?.permissions?.media);
  const photoIsReal=x=>!!(x?.name&&x.id&&x.metadata&&/\.(jpe?g|png|webp|gif|avif|heic)$/i.test(x.name)&&!String(x.name).startsWith('cover_')&&!String(x.name).startsWith('post_'));
  const basename=path=>String(path||'').split('/').pop()||'';

  async function loadOrderRows(){
    const {data,error}=await sb.from('photo_order').select('path,year,position');
    if(error){console.warn('No se pudo leer el orden de fotos',error);return []}
    return data||[];
  }

  async function listManagedPhotos(){
    const [{data:root,error},orderRows]=await Promise.all([
      sb.storage.from('Photos').list('',{limit:500,sortBy:{column:'created_at',order:'desc'}}),
      loadOrderRows()
    ]);
    if(error){console.error(error);return []}

    const orderMap=new Map(orderRows.map(r=>[r.path,{year:String(r.year),position:Number(r.position)}]));
    const out=[];
    for(const x of root||[]){
      if(photoIsReal(x)){
        const o=orderMap.get(x.name);
        out.push({path:x.name,name:x.name,year:DEFAULT_YEAR,position:Number.isFinite(o?.position)?o.position:null,createdAt:x.created_at||''});
      }
    }

    const folders=(root||[]).filter(x=>/^20\d{2}$/.test(String(x?.name||''))&&(!x.id||!x.metadata));
    for(const folder of folders){
      const {data,error:folderError}=await sb.storage.from('Photos').list(folder.name,{limit:500,sortBy:{column:'created_at',order:'desc'}});
      if(folderError)continue;
      for(const x of data||[]){
        if(!photoIsReal(x))continue;
        const path=`${folder.name}/${x.name}`;
        const o=orderMap.get(path);
        out.push({path,name:x.name,year:folder.name,position:Number.isFinite(o?.position)?o.position:null,createdAt:x.created_at||''});
      }
    }

    out.sort((a,b)=>{
      const yd=(Number(b.year)||0)-(Number(a.year)||0);if(yd)return yd;
      if(a.position!==null||b.position!==null){
        if(a.position===null)return 1;
        if(b.position===null)return -1;
        if(a.position!==b.position)return a.position-b.position;
      }
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    return out;
  }

  async function normalizeOrders(files){
    const grouped={};
    files.forEach(f=>(grouped[f.year]||(grouped[f.year]=[])).push(f));
    const rows=[];
    let needsWrite=false;
    Object.entries(grouped).forEach(([year,items])=>{
      items.forEach((item,index)=>{
        if(item.position!==index)needsWrite=true;
        item.position=index;
        rows.push({path:item.path,year,position:index,updated_at:new Date().toISOString()});
      });
    });
    if(needsWrite&&rows.length){
      const {error}=await sb.from('photo_order').upsert(rows,{onConflict:'path'});
      if(error)console.warn('No se pudo normalizar el orden de fotos',error);
    }
    return files;
  }

  async function saveGridOrder(grid,showToast=true){
    const year=grid?.dataset?.year;if(!year)return;
    const paths=[...grid.querySelectorAll('.jdPhotoManageCard[data-path]')].map(el=>el.dataset.path).filter(Boolean);
    const rows=paths.map((path,position)=>({path,year,position,updated_at:new Date().toISOString()}));
    if(!rows.length)return;
    const {error}=await sb.from('photo_order').upsert(rows,{onConflict:'path'});
    if(error){console.error(error);return toast('No se pudo guardar el orden')}
    if(showToast)toast('Orden de fotos guardado');
  }

  function yearOptions(selected){
    const years=[];
    for(let y=2030;y>=2015;y--)years.push(String(y));
    if(!years.includes(String(selected)))years.unshift(String(selected));
    return years.map(y=>`<option value="${y}" ${String(y)===String(selected)?'selected':''}>Jumpdance ${y}</option>`).join('');
  }

  function photoCard(item){
    const url=sb.storage.from('Photos').getPublicUrl(item.path).data.publicUrl;
    return `<article class="jdPhotoManageCard" data-path="${esc(item.path)}" data-year="${esc(item.year)}">
      <div class="jdPhotoManageTop"><button class="jdPhotoDragHandle" type="button" aria-label="Mantener apretado para mover">⋮⋮</button><span class="jdPhotoOrderNumber">#${Number(item.position)+1}</span></div>
      <img src="${esc(url)}" alt="Foto Jumpdance ${esc(item.year)}" loading="lazy">
      <div class="jdPhotoManageBody">
        <label>Año del evento</label>
        <select class="jdPhotoYearSelect">${yearOptions(item.year)}</select>
        <button class="btn secondary" type="button" onclick="jdMovePhotoYear(this)">CAMBIAR AÑO</button>
        <div class="jdPhotoOrderButtons"><button class="btn secondary" type="button" onclick="jdMovePhotoStep(this,-1)">↑ SUBIR</button><button class="btn secondary" type="button" onclick="jdMovePhotoStep(this,1)">↓ BAJAR</button></div>
        <button class="btn danger" type="button" onclick="jdDeleteManagedPhoto(this)">🗑️ ELIMINAR FOTO</button>
      </div>
    </article>`;
  }

  function updateOrderNumbers(grid){
    [...grid.querySelectorAll('.jdPhotoManageCard')].forEach((card,index)=>{
      const n=card.querySelector('.jdPhotoOrderNumber');if(n)n.textContent=`#${index+1}`;
    });
  }

  function loadSortable(){
    if(window.Sortable)return Promise.resolve(window.Sortable);
    return new Promise((resolve,reject)=>{
      let s=document.getElementById('jdSortableJs');
      if(s){
        s.addEventListener('load',()=>resolve(window.Sortable),{once:true});
        s.addEventListener('error',reject,{once:true});
        return;
      }
      s=document.createElement('script');
      s.id='jdSortableJs';
      s.src='https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js';
      s.onload=()=>resolve(window.Sortable);
      s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  async function enableDragging(){
    try{
      const Sortable=await loadSortable();
      document.querySelectorAll('.jdPhotoManageGrid').forEach(grid=>{
        if(grid.dataset.sortableReady==='1')return;
        grid.dataset.sortableReady='1';
        new Sortable(grid,{
          animation:180,
          handle:'.jdPhotoDragHandle',
          draggable:'.jdPhotoManageCard',
          ghostClass:'jdPhotoGhost',
          chosenClass:'jdPhotoChosen',
          delay:220,
          delayOnTouchOnly:true,
          touchStartThreshold:4,
          onEnd:async()=>{updateOrderNumbers(grid);await saveGridOrder(grid,true)}
        });
      });
    }catch(err){
      console.warn('Arrastrar fotos no disponible; quedan activos los botones subir/bajar.',err);
    }
  }

  window.loadAdminPhotos=async function loadAdminPhotosV43(){
    const el=document.getElementById('adminPhotosDeleteList');if(!el)return;
    if(!canMedia()){el.innerHTML='<div class="card muted">No tenés permiso para organizar fotos.</div>';return}
    el.innerHTML='<div class="card muted">Cargando fotos...</div>';
    let files=await listManagedPhotos();
    if(!files.length){el.innerHTML='<div class="card muted">No hay fotos para organizar.</div>';return}
    files=await normalizeOrders(files);
    const grouped={};files.forEach(f=>(grouped[f.year]||(grouped[f.year]=[])).push(f));
    const years=Object.keys(grouped).sort((a,b)=>(Number(b)||0)-(Number(a)||0));
    const title=[...document.querySelectorAll('#aMedia .sectionTitle h3')].find(h=>/eliminar fotos|organizar fotos/i.test(h.textContent||''));
    if(title)title.textContent='📸 Organizar fotos por año';
    el.innerHTML=`<div class="card jdPhotoManageIntro"><b>Organizá las fotos sin volver a subirlas.</b><p class="muted">Elegí el año correcto y tocá “Cambiar año”. Para acomodarlas, mantené apretado ⋮⋮ y arrastrá; también podés usar Subir/Bajar.</p></div>`+
      years.map(year=>`<section class="jdPhotoManageYear"><div class="jdPhotoManageYearHead"><h3>Jumpdance ${esc(year)}</h3><span>${grouped[year].length} ${grouped[year].length===1?'foto':'fotos'}</span></div><div class="jdPhotoManageGrid" data-year="${esc(year)}">${grouped[year].map(photoCard).join('')}</div></section>`).join('');
    await enableDragging();
  };

  window.jdMovePhotoStep=async function(button,direction){
    const card=button?.closest?.('.jdPhotoManageCard');const grid=card?.parentElement;if(!card||!grid)return;
    const cards=[...grid.querySelectorAll('.jdPhotoManageCard')];const index=cards.indexOf(card);const next=index+Number(direction||0);
    if(next<0||next>=cards.length)return;
    if(direction<0)grid.insertBefore(card,cards[next]);
    else grid.insertBefore(cards[next],card);
    updateOrderNumbers(grid);
    await saveGridOrder(grid,true);
  };

  window.jdMovePhotoYear=async function(button){
    const card=button?.closest?.('.jdPhotoManageCard');if(!card)return;
    const oldPath=card.dataset.path;const currentYear=card.dataset.year||DEFAULT_YEAR;
    const targetYear=safeYear(card.querySelector('.jdPhotoYearSelect')?.value);
    if(targetYear===currentYear&&oldPath.startsWith(`${targetYear}/`))return toast(`La foto ya está en Jumpdance ${targetYear}`);
    if(!confirm(`¿Mover esta foto de Jumpdance ${currentYear} a Jumpdance ${targetYear}?`))return;

    button.disabled=true;button.textContent='MOVIENDO...';
    const originalName=basename(oldPath);
    let newPath=`${targetYear}/${originalName}`;
    let {error}=await sb.storage.from('Photos').move(oldPath,newPath);
    if(error){
      newPath=`${targetYear}/${Date.now()}_${originalName}`;
      ({error}=await sb.storage.from('Photos').move(oldPath,newPath));
    }
    if(error){console.error(error);button.disabled=false;button.textContent='CAMBIAR AÑO';return toast('No se pudo cambiar el año de la foto')}

    const {data:targetOrder}=await sb.from('photo_order').select('position').eq('year',targetYear).order('position',{ascending:false}).limit(1);
    const lastPosition=Number(targetOrder?.[0]?.position);
    const nextPosition=(Number.isFinite(lastPosition)?lastPosition:-1)+1;
    await sb.from('photo_order').delete().eq('path',oldPath);
    const {error:orderError}=await sb.from('photo_order').upsert({path:newPath,year:targetYear,position:Math.max(0,nextPosition),updated_at:new Date().toISOString()},{onConflict:'path'});
    if(orderError)console.warn(orderError);

    toast(`Foto movida a Jumpdance ${targetYear}`);
    await window.loadAdminPhotos();
  };

  window.jdDeleteManagedPhoto=async function(button){
    const card=button?.closest?.('.jdPhotoManageCard');if(!card)return;
    const path=card.dataset.path;
    if(!confirm('¿Eliminar esta foto? Esta acción no se puede deshacer.'))return;
    button.disabled=true;button.textContent='ELIMINANDO...';
    const {error}=await sb.storage.from('Photos').remove([path]);
    if(error){console.error(error);button.disabled=false;button.textContent='🗑️ ELIMINAR FOTO';return toast('No se pudo eliminar la foto')}
    await sb.from('photo_order').delete().eq('path',path);
    toast('Foto eliminada');
    await window.loadAdminPhotos();
  };

  if(typeof baseOpenAdminModule==='function'){
    window.openAdminModule=function openAdminModuleV43(id){
      const result=baseOpenAdminModule.apply(this,arguments);
      if(id==='aMedia')setTimeout(()=>window.loadAdminPhotos?.(),0);
      return result;
    };
  }
})();
