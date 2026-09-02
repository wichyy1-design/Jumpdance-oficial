(() => {
  async function newsWithPublications(){
    const {data,error}=await sb.from('posts')
      .select('id,title,body,image_path,created_at,published')
      .eq('published',true)
      .order('created_at',{ascending:false});

    let h=`<div class="sectionTitle"><h2>📣 Novedades</h2></div>`;

    if(error){
      console.error(error);
      return h+`<div class="card muted">No se pudieron cargar las novedades.</div>`;
    }

    const rows=(data||[]).filter(p=>{
      const title=String(p.title||'');
      return title===NEWS_TITLE || !title.startsWith('__JUMPDANCE_');
    });

    if(!rows.length){
      return h+`<div class="card muted">Todavía no hay novedades publicadas.</div>`;
    }

    for(const p of rows){
      const isNews=p.title===NEWS_TITLE;
      let title='Novedad';
      let body='';

      if(isNews){
        try{
          const parsed=JSON.parse(p.body||'{}');
          title=String(parsed.title||'Novedad');
          body=String(parsed.body||'');
        }catch{
          body=String(p.body||'');
        }
      }else{
        title=String(p.title||'Publicación');
        body=String(p.body||'');
      }

      let image='';
      if(!isNews && p.image_path){
        const publicUrl=sb.storage.from('Photos').getPublicUrl(p.image_path).data.publicUrl;
        image=`<img src="${esc(publicUrl)}" alt="${esc(title)}" loading="lazy" style="display:block;width:100%;max-height:520px;object-fit:contain;border-radius:14px;margin-bottom:14px">`;
      }

      let date='';
      if(p.created_at){
        try{
          date=new Date(p.created_at).toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
        }catch{}
      }

      h+=`<article class="card" style="overflow:hidden">
        ${image}
        <h3>${esc(title)}</h3>
        ${body?`<p style="white-space:pre-wrap">${esc(body)}</p>`:''}
        ${date?`<div class="muted" style="margin-top:10px;font-size:13px">${esc(date)}</div>`:''}
      </article>`;
    }

    return h;
  }

  window.news=newsWithPublications;
  try{news=newsWithPublications}catch{}

  if((location.hash.slice(1)||'home')==='news'){
    setTimeout(()=>window.render?.(),0);
  }
})();
