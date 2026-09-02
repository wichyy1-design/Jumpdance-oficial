(() => {
  const canManagePosts=()=>!!(window.JD_ADMIN_ACCESS?.is_owner||window.JD_ADMIN_ACCESS?.permissions?.posts);
  const baseOpenAdminModule=window.openAdminModule;
  const basePublishPost=window.publishPost;

  function isGeneralPost(row){
    const title=String(row?.title||'');
    return !!title && !title.startsWith('__JUMPDANCE_');
  }

  function postImageUrl(path){
    return path?sb.storage.from('Photos').getPublicUrl(path).data.publicUrl:'';
  }

  function formatPostDate(value){
    if(!value)return '';
    try{return new Date(value).toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'})}catch{return ''}
  }

  function ensurePostsList(){
    const section=document.getElementById('aPosts');
    if(!section)return null;
    let list=document.getElementById('adminPostsList');
    if(list)return list;
    const title=document.createElement('div');
    title.className='sectionTitle';
    title.innerHTML='<h3>Publicaciones cargadas</h3>';
    list=document.createElement('div');
    list.id='adminPostsList';
    list.className='list';
    list.innerHTML='<div class="card muted">Cargando publicaciones...</div>';
    section.appendChild(title);
    section.appendChild(list);
    return list;
  }

  window.renderAdminPosts=async function(){
    const el=ensurePostsList();
    if(!el||!canManagePosts())return;
    el.innerHTML='<div class="card muted">Cargando publicaciones...</div>';

    const {data,error}=await sb.from('posts')
      .select('id,title,body,image_path,created_at,published')
      .order('created_at',{ascending:false});

    if(error){
      console.error(error);
      el.innerHTML='<div class="card muted">No se pudieron cargar las publicaciones.</div>';
      return;
    }

    const rows=(data||[]).filter(isGeneralPost);
    if(!rows.length){
      el.innerHTML='<div class="card muted">Todavía no hay publicaciones cargadas.</div>';
      return;
    }

    el.innerHTML=rows.map(p=>{
      const image=p.image_path?postImageUrl(p.image_path):'';
      const date=formatPostDate(p.created_at);
      return `<article class="card jdAdminPostCard" data-post-id="${esc(p.id)}" data-image-path="${esc(p.image_path||'')}">
        ${image?`<img src="${esc(image)}" alt="${esc(p.title||'Publicación')}" style="display:block;width:100%;max-height:300px;object-fit:contain;border-radius:12px;margin-bottom:12px">`:''}
        <div class="jdAdminPostView">
          <h3>${esc(p.title||'Publicación')}</h3>
          <p style="white-space:pre-wrap">${esc(p.body||'')}</p>
          ${date?`<div class="muted" style="font-size:13px;margin-top:8px">${esc(date)}</div>`:''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <button class="btn secondary" type="button" onclick="editAdminPost('${esc(p.id)}')">✏️ EDITAR</button>
            <button class="btn danger" type="button" onclick="deleteAdminPost('${esc(p.id)}')">🗑️ ELIMINAR</button>
          </div>
        </div>
        <div class="jdAdminPostEdit" hidden>
          <div class="field"><label>Título</label><input data-edit-title value="${esc(p.title||'')}" required></div>
          <div class="field"><label>Texto</label><textarea data-edit-body rows="5" required>${esc(p.body||'')}</textarea></div>
          <div class="field"><label>Cambiar imagen (opcional)</label><input data-edit-image type="file" accept="image/*"><p class="muted">Si no elegís otra imagen, se conserva la actual.</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" type="button" onclick="saveAdminPost('${esc(p.id)}')">GUARDAR CAMBIOS</button>
            <button class="btn secondary" type="button" onclick="cancelEditAdminPost('${esc(p.id)}')">CANCELAR</button>
          </div>
        </div>
      </article>`;
    }).join('');
  };

  window.editAdminPost=function(id){
    if(!canManagePosts())return toast('No tenés permiso para editar publicaciones');
    const card=document.querySelector(`.jdAdminPostCard[data-post-id="${CSS.escape(String(id))}"]`);
    if(!card)return;
    card.querySelector('.jdAdminPostView')?.setAttribute('hidden','');
    card.querySelector('.jdAdminPostEdit')?.removeAttribute('hidden');
    card.querySelector('[data-edit-title]')?.focus();
  };

  window.cancelEditAdminPost=function(id){
    const card=document.querySelector(`.jdAdminPostCard[data-post-id="${CSS.escape(String(id))}"]`);
    if(!card)return;
    card.querySelector('.jdAdminPostEdit')?.setAttribute('hidden','');
    card.querySelector('.jdAdminPostView')?.removeAttribute('hidden');
  };

  window.saveAdminPost=async function(id){
    if(!canManagePosts())return toast('No tenés permiso para editar publicaciones');
    const card=document.querySelector(`.jdAdminPostCard[data-post-id="${CSS.escape(String(id))}"]`);
    if(!card)return;

    const title=String(card.querySelector('[data-edit-title]')?.value||'').trim();
    const body=String(card.querySelector('[data-edit-body]')?.value||'').trim();
    const file=card.querySelector('[data-edit-image]')?.files?.[0]||null;
    const oldImage=card.dataset.imagePath||null;
    if(!title||!body)return toast('Completá título y texto');

    let image_path=oldImage;
    if(file){
      if(!file.type.startsWith('image/'))return toast('Elegí una imagen válida');
      if(file.size>12*1024*1024)return toast('La imagen no puede superar 12 MB');
      image_path=`post_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const {error:uploadError}=await sb.storage.from('Photos').upload(image_path,file,{upsert:false,contentType:file.type});
      if(uploadError){console.error(uploadError);return toast('No se pudo subir la nueva imagen')}
    }

    const {error}=await sb.from('posts').update({title,body,image_path}).eq('id',id);
    if(error){
      console.error(error);
      if(file&&image_path)await sb.storage.from('Photos').remove([image_path]);
      return toast('No se pudo editar la publicación');
    }

    if(file&&oldImage&&oldImage!==image_path){
      const {error:removeError}=await sb.storage.from('Photos').remove([oldImage]);
      if(removeError)console.warn('No se pudo borrar la imagen anterior',removeError);
    }

    toast('Publicación actualizada');
    await renderAdminPosts();
  };

  window.deleteAdminPost=async function(id){
    if(!canManagePosts())return toast('No tenés permiso para eliminar publicaciones');
    if(!confirm('¿Eliminar esta publicación? También desaparecerá de Novedades.'))return;

    const {data,error:readError}=await sb.from('posts').select('id,title,image_path').eq('id',id).single();
    if(readError||!data){console.error(readError);return toast('No se pudo abrir la publicación')}
    if(!isGeneralPost(data))return toast('Esta publicación no se puede eliminar desde aquí');

    const {error}=await sb.from('posts').delete().eq('id',id);
    if(error){console.error(error);return toast('No se pudo eliminar la publicación')}

    if(data.image_path){
      const {error:removeError}=await sb.storage.from('Photos').remove([data.image_path]);
      if(removeError)console.warn('La publicación se eliminó, pero quedó la imagen en almacenamiento',removeError);
    }

    toast('Publicación eliminada');
    await renderAdminPosts();
  };

  window.openAdminModule=function(id){
    const result=baseOpenAdminModule?.apply(this,arguments);
    if(id==='aPosts')setTimeout(()=>window.renderAdminPosts?.(),0);
    return result;
  };

  if(typeof basePublishPost==='function'){
    window.publishPost=async function(e){
      await basePublishPost.call(this,e);
      if((location.hash.slice(1)||'')==='admin')setTimeout(()=>window.renderAdminPosts?.(),0);
    };
  }
})();
