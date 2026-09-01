(()=>{
  const BOARD_TITLE='__JUMPDANCE_RESULTS_BOARD_V28__';
  const LEGACY_TITLE='__JUMPDANCE_RESULT__';
  const DELETED_TITLE='__JUMPDANCE_RESULTS_DELETED_YEAR_V28__';
  const ADMIN_YEAR_KEY='jd_results_admin_year';
  const clean=v=>String(v??'').trim();

  async function deletedRows(){
    const {data,error}=await sb.from('posts')
      .select('id,body,created_at')
      .eq('title',DELETED_TITLE)
      .eq('published',true)
      .order('created_at',{ascending:false});
    if(error){console.error(error);return []}
    return data||[];
  }

  async function deletedYears(){
    const rows=await deletedRows();
    const out=new Set();
    rows.forEach(r=>{try{const y=clean(JSON.parse(r.body||'{}').year);if(y)out.add(y)}catch{}});
    return out;
  }

  async function clearDeletedMarker(year){
    const rows=await deletedRows();
    const ids=rows.filter(r=>{try{return clean(JSON.parse(r.body||'{}').year)===String(year)}catch{return false}}).map(r=>r.id);
    if(ids.length){
      const {error}=await sb.from('posts').delete().in('id',ids);
      if(error)console.error(error);
    }
  }

  async function markDeleted(year){
    await clearDeletedMarker(year);
    const {error}=await sb.from('posts').insert({
      title:DELETED_TITLE,
      body:JSON.stringify({year:String(year),deletedAt:new Date().toISOString()}),
      image_path:null,
      published:true
    });
    if(error)throw error;
  }

  async function idsForBoardYear(year){
    const {data,error}=await sb.from('posts')
      .select('id,body')
      .eq('title',BOARD_TITLE);
    if(error)throw error;
    return (data||[]).filter(r=>{try{return clean(JSON.parse(r.body||'{}').year)===String(year)}catch{return false}}).map(r=>r.id);
  }

  async function idsForLegacyYear(year){
    const {data,error}=await sb.from('posts')
      .select('id,body')
      .eq('title',LEGACY_TITLE);
    if(error)throw error;
    return (data||[]).filter(r=>{try{return clean(JSON.parse(r.body||'{}').year)===String(year)}catch{return false}}).map(r=>r.id);
  }

  async function deleteIds(ids){
    if(!ids.length)return;
    for(let i=0;i<ids.length;i+=100){
      const {error}=await sb.from('posts').delete().in('id',ids.slice(i,i+100));
      if(error)throw error;
    }
  }

  async function availableYears(){
    const deleted=await deletedYears();
    const years=new Set();
    try{
      const {data:boards}=await sb.from('posts').select('body').eq('title',BOARD_TITLE).eq('published',true);
      (boards||[]).forEach(r=>{try{const y=clean(JSON.parse(r.body||'{}').year);if(y&&!deleted.has(y))years.add(y)}catch{}});
    }catch{}
    try{
      if(typeof getAllResults==='function'){
        const legacy=await getAllResults();
        (legacy||[]).forEach(r=>{const y=clean(r.year);if(y&&!deleted.has(y))years.add(y)});
      }
    }catch{}
    return [...years].sort((a,b)=>(Number(b)||0)-(Number(a)||0));
  }

  window.jdResultDeleteYear=async function(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session||session.user.id!==cfg.adminUserId)return toast('Solo el administrador puede eliminar años');

    const select=document.querySelector('#aResults .jrAdminYearTools select');
    const year=clean(select?.value||localStorage.getItem(ADMIN_YEAR_KEY));
    if(!year)return toast('No hay un año seleccionado');

    if(!confirm(`¿Eliminar COMPLETAMENTE los resultados del año ${year}?\n\nSe borrarán el cuadro visual y todos los resultados cargados de ese año.`))return;

    try{
      const [boardIds,legacyIds]=await Promise.all([idsForBoardYear(year),idsForLegacyYear(year)]);
      await deleteIds([...new Set([...boardIds,...legacyIds])]);
      await markDeleted(year);

      const years=await availableYears();
      if(years.length)localStorage.setItem(ADMIN_YEAR_KEY,years[0]);
      else localStorage.removeItem(ADMIN_YEAR_KEY);

      toast(`Año ${year} eliminado`);
      await window.renderAdminResultsMultiYear?.();
      if(location.hash==='#results')window.render?.();
    }catch(e){
      console.error(e);
      toast('No se pudo eliminar el año');
    }
  };

  function addDeleteButton(){
    const tools=document.querySelector('#aResults .jrAdminYearTools');
    if(!tools||tools.querySelector('.jrDeleteYearBtn'))return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn danger jrDeleteYearBtn';
    btn.textContent='🗑️ ELIMINAR AÑO';
    btn.onclick=()=>window.jdResultDeleteYear();
    tools.appendChild(btn);
  }

  async function filterDeletedYearsInAdmin(){
    const deleted=await deletedYears();
    const host=document.getElementById('aResults');
    const select=host?.querySelector('.jrAdminYearTools select');
    if(!host||!select)return;

    [...select.options].forEach(o=>{if(deleted.has(clean(o.value||o.textContent)))o.remove()});
    if(!select.options.length){
      host.innerHTML=`<div class="jrAdminWrap"><div class="jrAdminTop"><div><span class="jrKicker">EDITOR VISUAL</span><h2>🏆 Resultados</h2><p>No hay años cargados.</p></div><button class="btn" type="button" onclick="jdResultNewYear()">+ AGREGAR AÑO</button></div></div>`;
      return;
    }
    addDeleteButton();
  }

  const previousRender=window.renderAdminResultsMultiYear;
  if(typeof previousRender==='function'){
    window.renderAdminResultsMultiYear=async function(){
      const result=await previousRender.apply(this,arguments);
      await filterDeletedYearsInAdmin();
      return result;
    };
  }

  const previousNewYear=window.jdResultNewYear;
  if(typeof previousNewYear==='function'){
    window.jdResultNewYear=async function(){
      await previousNewYear.apply(this,arguments);
      const year=clean(localStorage.getItem(ADMIN_YEAR_KEY));
      if(year){
        await clearDeletedMarker(year);
        await window.renderAdminResultsMultiYear?.();
      }
    };
  }

  const previousResults=window.results;
  if(typeof previousResults==='function'){
    window.results=async function(){
      const html=await previousResults.apply(this,arguments);
      const deleted=await deletedYears();
      if(!deleted.size)return html;

      const wrap=document.createElement('div');
      wrap.innerHTML=html;
      wrap.querySelectorAll('.jrYearPane').forEach(p=>{if(deleted.has(clean(p.dataset.jrYear)))p.remove()});
      wrap.querySelectorAll('.jrYearTabs button').forEach(b=>{if(deleted.has(clean(b.textContent)))b.remove()});

      const panes=[...wrap.querySelectorAll('.jrYearPane')];
      if(!panes.length){
        return `<header class="jrResultsHeader"><div><span class="jrKicker">JUMPDANCE</span><h1>Resultados</h1></div><div class="jrHeaderCup">🏆</div></header><div class="card muted">Todavía no hay resultados publicados.</div>`;
      }
      panes.forEach((p,i)=>p.style.display=i===0?'block':'none');
      const tabs=[...wrap.querySelectorAll('.jrYearTabs button')];
      tabs.forEach((b,i)=>b.classList.toggle('active',i===0));
      if(tabs.length<=1)wrap.querySelector('.jrYearTabs')?.remove();
      return wrap.innerHTML;
    };
  }
})();