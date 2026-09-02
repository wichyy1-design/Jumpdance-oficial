(() => {
  const SEEN_KEY='jd_news_seen_at_v49';
  const baseRender=window.render;
  const baseRenderAdminPosts=window.renderAdminPosts;

  function ensureStyles(){
    if(document.getElementById('jdNewsBellStyle'))return;
    const style=document.createElement('style');
    style.id='jdNewsBellStyle';
    style.textContent=`
      .jdNewsBell{position:relative;transition:transform .2s ease,background .2s ease,box-shadow .2s ease}
      .jdNewsBell.jdNewsUnread{background:linear-gradient(135deg,#f05aa6,#9b6bff)!important;box-shadow:0 0 0 3px rgba(240,90,166,.18),0 0 22px rgba(240,90,166,.62);animation:jdNewsBellPulse 1.8s ease-in-out infinite}
      .jdNewsDot{display:none;position:absolute;right:5px;top:5px;width:9px;height:9px;border-radius:50%;background:#fff;border:2px solid #f05aa6;box-shadow:0 0 8px rgba(255,255,255,.95)}
      .jdNewsBell.jdNewsUnread .jdNewsDot{display:block}
      @keyframes jdNewsBellPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
      .jdPublicityCard img{display:block;width:100%;max-height:520px;object-fit:contain;border-radius:14px;margin-bottom:14px}
      .jdNewsDate,.jdPublicityDate{margin-top:10px;font-size:13px}
    `;
    document.head.appendChild(style);
  }

  function bellElement(){
    const bell=document.getElementById('newsBellBtn')||document.querySelector('.topbar button[onclick*="route(\'news\')"]');
    if(!bell)return null;
    bell.classList.add('jdNewsBell');
    bell.setAttribute('aria-label','Novedades');
    if(!bell.querySelector('.jdNewsDot')){
      const dot=document.createElement('span');
      dot.className='jdNewsDot';
      dot.setAttribute('aria-hidden','true');
      bell.appendChild(dot);
    }
    return bell;
  }

  function seenAt(){
    try{return Number(localStorage.getItem(SEEN_KEY)||0)||0}catch{return 0}
  }

  function rememberSeen(value){
    const ms=Date.parse(value||'');
    if(!Number.isFinite(ms))return;
    try{localStorage.setItem(SEEN_KEY,String(ms))}catch{}
  }

  async function latestNewsCreatedAt(){
    const {data,error}=await sb.from('posts')
      .select('created_at')
      .eq('title',NEWS_TITLE)
      .eq('published',true)
      .order('created_at',{ascending:false})
      .limit(1);
    if(error){console.warn('No se pudo comprobar Novedades',error);return null}
    return data?.[0]?.created_at||null;
  }

  window.jdUpdateNewsBell=async function(){
    const bell=bellElement();if(!bell)return;
    const latest=await latestNewsCreatedAt();
    const latestMs=Date.parse(latest||'');
    const unread=Number.isFinite(latestMs)&&latestMs>seenAt();
    bell.classList.toggle('jdNewsUnread',unread);
    bell.title=unread?'Tenés una novedad nueva':'Novedades';
    bell.setAttribute('aria-label',unread?'Novedades nuevas sin leer':'Novedades');
  };

  function dateLabel(value){
    if(!value)return '';
    try{return new Date(value).toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}catch{return ''}
  }

  async function publicityPage(){
    const {data,error}=await sb.from('posts')
      .select('id,title,body,image_path,created_at,published')
      .eq('published',true)
      .order('created_at',{ascending:false});

    let h='<div class="sectionTitle"><h2>📢 Publicidad</h2></div>';
    if(error){console.error(error);return h+'<div class="card muted">No se pudo cargar la publicidad.</div>'}

    const rows=(data||[]).filter(p=>{
      const title=String(p.title||'');
      return title&&!title.startsWith('__JUMPDANCE_');
    });

    if(!rows.length)return h+'<div class="card muted">Todavía no hay publicidad publicada.</div>';

    for(const p of rows){
      const image=p.image_path?sb.storage.from('Photos').getPublicUrl(p.image_path).data.publicUrl:'';
      const date=dateLabel(p.created_at);
      h+=`<article class="card jdPublicityCard">
        ${image?`<img src="${esc(image)}" alt="${esc(p.title||'Publicidad')}" loading="lazy">`:''}
        <h3>${esc(p.title||'Publicidad')}</h3>
        ${p.body?`<p style="white-space:pre-wrap">${esc(p.body)}</p>`:''}
        ${date?`<div class="muted jdPublicityDate">${esc(date)}</div>`:''}
      </article>`;
    }
    return h;
  }

  async function newsPage(){
    const {data,error}=await sb.from('posts')
      .select('id,body,created_at')
      .eq('title',NEWS_TITLE)
      .eq('published',true)
      .order('created_at',{ascending:false});

    let h='<div class="sectionTitle"><h2>🔔 Novedades</h2></div>';
    if(error){console.error(error);return {html:h+'<div class="card muted">No se pudieron cargar las novedades.</div>',latest:null}}
    if(!data?.length)return {html:h+'<div class="card muted">Todavía no hay novedades publicadas.</div>',latest:null};

    for(const p of data){
      let title='Novedad';
      let body='';
      try{
        const parsed=JSON.parse(p.body||'{}');
        title=String(parsed.title||'Novedad');
        body=String(parsed.body||'');
      }catch{body=String(p.body||'')}
      const date=dateLabel(p.created_at);
      h+=`<article class="card">
        <h3>${esc(title)}</h3>
        ${body?`<p style="white-space:pre-wrap">${esc(body)}</p>`:''}
        ${date?`<div class="muted jdNewsDate">${esc(date)}</div>`:''}
      </article>`;
    }
    return {html:h,latest:data[0]?.created_at||null};
  }

  function updateBottomNav(routeName){
    document.querySelectorAll('.bottomNav [data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===routeName));
  }

  function decorateHomePublicity(){
    if((location.hash.slice(1)||'home')!=='home')return;
    const cards=[...document.querySelectorAll('#app .quickCard')];
    const card=cards.find(c=>(c.getAttribute('onclick')||'').includes("route('news')")||/NOVEDADES/i.test(c.querySelector('h3')?.textContent||''));
    if(!card)return;
    card.setAttribute('onclick',"route('ads')");
    const icon=card.querySelector('.ico');if(icon)icon.textContent='📢';
    const title=card.querySelector('h3');if(title)title.textContent='PUBLICIDAD';
    const desc=card.querySelector('p');if(desc)desc.textContent='Anuncios y publicidad de Jumpdance';
  }

  function replaceLabelText(label,from,to){
    for(const node of label.childNodes){
      if(node.nodeType===Node.TEXT_NODE&&node.nodeValue?.includes(from))node.nodeValue=node.nodeValue.replace(from,to);
    }
  }

  function decorateAdminPublicity(){
    if((location.hash.slice(1)||'')!=='admin')return;
    const card=document.querySelector('#adminDashboard .adminModuleCard[onclick*="aPosts"]');
    if(card){
      const title=card.querySelector('b');if(title)title.textContent='Publicidad';
      const desc=card.querySelector('small');if(desc)desc.textContent='Anuncios y publicidad con imagen';
      const icon=card.querySelector('.adminModuleIcon');if(icon)icon.textContent='📢';
    }

    const section=document.getElementById('aPosts');
    if(section){
      const heading=section.querySelector('.sectionTitle h2');if(heading)heading.textContent='📢 Publicidad';
      const button=section.querySelector('#postForm button.btn');if(button)button.textContent='PUBLICAR PUBLICIDAD';
      [...section.querySelectorAll('.sectionTitle h3')].forEach(h=>{
        if(/Publicaciones cargadas/i.test(h.textContent||''))h.textContent='Publicidad cargada';
      });
    }

    document.querySelectorAll('.adminPermission').forEach(label=>replaceLabelText(label,'Publicaciones','Publicidad'));
  }

  if(typeof baseRenderAdminPosts==='function'){
    window.renderAdminPosts=async function(){
      const result=await baseRenderAdminPosts.apply(this,arguments);
      decorateAdminPublicity();
      return result;
    };
  }

  window.render=async function renderV49(){
    const r=location.hash.slice(1)||'home';

    if(r==='ads'){
      app.innerHTML=await publicityPage();
      updateBottomNav('ads');
      await window.jdUpdateNewsBell?.();
      return;
    }

    if(r==='news'){
      const page=await newsPage();
      app.innerHTML=page.html;
      updateBottomNav('news');
      if(page.latest)rememberSeen(page.latest);
      await window.jdUpdateNewsBell?.();
      return;
    }

    const result=await baseRender?.apply(this,arguments);
    decorateHomePublicity();
    decorateAdminPublicity();
    await window.jdUpdateNewsBell?.();
    return result;
  };

  function rerenderSpecialRoute(){
    const r=location.hash.slice(1)||'home';
    if(r==='ads'||r==='news')setTimeout(()=>window.render?.(),0);
  }

  document.addEventListener('submit',e=>{
    if(e.target?.id==='newsForm')setTimeout(()=>window.jdUpdateNewsBell?.(),900);
  },true);

  window.addEventListener('hashchange',rerenderSpecialRoute);
  window.addEventListener('pageshow',()=>window.jdUpdateNewsBell?.());
  window.addEventListener('focus',()=>window.jdUpdateNewsBell?.());
  setInterval(()=>window.jdUpdateNewsBell?.(),60000);

  ensureStyles();
  bellElement();
  setTimeout(()=>{
    const r=location.hash.slice(1)||'home';
    if(r==='ads'||r==='news')window.render?.();
    else{
      decorateHomePublicity();
      decorateAdminPublicity();
      window.jdUpdateNewsBell?.();
    }
  },0);
})();
