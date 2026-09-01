(() => {
  const OWNER_ID=cfg.ownerUserId||cfg.adminUserId;
  cfg.ownerUserId=OWNER_ID;
  const VAPID_PUBLIC_KEY='BFbXK3PBmofbSKcjxwk0cZRHKA66NPKH5JeXt3ukIMiI71YA_eioHFvfiaHm4ihaMSBbsLbDVpBaUEUhI7nn5hY';
  const MODULES=[
    ['event','aEvent','🖼️','Portada y evento','Fecha, lugar e imagen principal'],
    ['registrations','aIns','🎵','Inscripciones y músicas','Participantes, datos y archivos de audio'],
    ['media','aMedia','📸','Fotos y videos','Contenido multimedia público'],
    ['sponsors','aSponsors','⭐','Sponsors','Marcas y acompañantes del evento'],
    ['results','aResults','🏆','Resultados','Ganadores y resultados por año'],
    ['news','aNews','📣','Novedades','Noticias y avisos públicos'],
    ['posts','aPosts','📰','Publicaciones','Publicaciones generales con imagen'],
    ['messages','aMsgs','💬','Mensajes','Moderación de mensajes públicos']
  ];

  let access=null;
  let activeModule=null;
  const legacyAdminPanel=window.adminPanel;
  const legacyRender=window.render;

  function allowed(key){return !!(access?.is_owner||access?.permissions?.[key]);}
  function permissionLabels(){return Object.fromEntries(MODULES.map(([k,,,,])=>[k,MODULES.find(x=>x[0]===k)?.[3]||k]));}
  const PERMISSION_LABELS=permissionLabels();

  async function loadAccess(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session)return null;
    const {data,error}=await sb.from('admin_users').select('user_id,display_name,active,is_owner,permissions').eq('user_id',session.user.id).maybeSingle();
    if(error){console.error(error);return null}
    if(!data?.active)return null;
    access=data;
    window.JD_ADMIN_ACCESS=data;
    cfg.adminUserId=session.user.id;
    return data;
  }

  window.admin=async function adminV26(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session)return adminLogin();
    const profile=await loadAccess();
    if(!profile){
      await sb.auth.signOut();
      cfg.adminUserId=OWNER_ID;
      return `<div class="card"><h2>Acceso no autorizado</h2><p class="muted">Tu usuario no está habilitado para administrar Jumpdance.</p></div>`;
    }
    return await window.adminPanel();
  };

  function dashboardHtml(){
    const cards=MODULES.filter(([key])=>allowed(key)).map(([key,id,icon,title,desc])=>`
      <button class="adminModuleCard" type="button" onclick="openAdminModule('${id}')">
        <span class="adminModuleIcon">${icon}</span><b>${title}</b><small>${desc}</small><span class="adminModuleArrow">›</span>
      </button>`).join('');
    const notificationCard=allowed('registrations')?`
      <button class="adminModuleCard notifications" type="button" onclick="enableAdminNotifications()">
        <span class="adminModuleIcon">🔔</span><b>Notificaciones</b><small id="adminPushSummary">Activá avisos cuando llegue una música nueva</small><span class="adminModuleArrow">›</span>
      </button>`:'';
    const usersCard=access?.is_owner?`
      <button class="adminModuleCard users" type="button" onclick="openAdminModule('aUsers')">
        <span class="adminModuleIcon">👥</span><b>Usuarios y permisos</b><small>Crear usuarios y decidir qué puede administrar cada uno</small><span class="adminModuleArrow">›</span>
      </button>`:'';
    return `<section id="adminDashboard" class="adminDashboard">
      <div class="adminDashboardHead"><div><h3>Panel de control</h3><p class="muted">Elegí qué querés administrar.</p></div></div>
      <div class="adminModuleGrid">${cards}${notificationCard}${usersCard}</div>
    </section>`;
  }

  function usersSectionHtml(){
    if(!access?.is_owner)return '';
    const checks=MODULES.map(([key,,,title])=>`<label class="adminPermission"><input type="checkbox" name="perm_${key}" value="1"> ${title}</label>`).join('');
    return `<section id="aUsers" class="adminModulePanel">
      <button class="adminBack" type="button" onclick="showAdminDashboard()">← Panel</button>
      <div class="sectionTitle"><h2>👥 Usuarios y permisos</h2></div>
      <form id="adminUserCreateForm" class="card form">
        <div class="row"><div class="field"><label>Nombre</label><input name="display_name" required placeholder="Ej.: Melisa"></div><div class="field"><label>Email</label><input name="email" type="email" required></div></div>
        <div class="field"><label>Contraseña inicial</label><input name="password" type="password" minlength="8" required placeholder="Mínimo 8 caracteres"></div>
        <div><b>Habilitar módulos</b><div class="adminPermissionGrid">${checks}</div></div>
        <button class="btn" type="submit">CREAR USUARIO</button>
      </form>
      <div class="sectionTitle"><h3>Usuarios habilitados</h3></div>
      <div id="adminUsersList" class="list"><div class="card muted">Cargando usuarios...</div></div>
    </section>`;
  }

  window.adminPanel=async function adminPanelV26(){
    let html=await legacyAdminPanel();
    html=html.replace(/<div class="adminTabs">[\s\S]*?<\/div>/,'');
    const firstSection=html.indexOf('<section id="aEvent">');
    if(firstSection>=0)html=html.slice(0,firstSection)+dashboardHtml()+html.slice(firstSection);
    for(const [,id] of MODULES){
      html=html.replace(`<section id="${id}">`,`<section id="${id}" class="adminModulePanel"><button class="adminBack" type="button" onclick="showAdminDashboard()">← Panel</button>`);
    }
    html+=usersSectionHtml();
    return html;
  };

  window.showAdminDashboard=function(){
    activeModule=null;
    document.querySelectorAll('.adminModulePanel').forEach(el=>el.classList.remove('active'));
    const d=document.getElementById('adminDashboard');if(d)d.style.display='block';
    window.scrollTo({top:0,behavior:'smooth'});
  };

  window.openAdminModule=function(id){
    const module=MODULES.find(x=>x[1]===id);
    if(module&&!allowed(module[0]))return toast('No tenés permiso para esta sección');
    if(id==='aUsers'&&!access?.is_owner)return toast('Solo el administrador principal puede gestionar usuarios');
    activeModule=id;
    document.querySelectorAll('.adminModulePanel').forEach(el=>el.classList.toggle('active',el.id===id));
    const d=document.getElementById('adminDashboard');if(d)d.style.display='none';
    window.scrollTo({top:0,behavior:'smooth'});
    if(id==='aUsers')renderAdminUsers();
  };

  async function adminFunction(action,payload={}){
    const {data,error}=await sb.functions.invoke('jd-admin-users',{body:{action,...payload}});
    if(error){console.error(error);throw new Error(error.message||'No se pudo completar la operación')}
    if(data?.error)throw new Error(data.error);
    return data;
  }

  window.renderAdminUsers=async function(){
    const el=document.getElementById('adminUsersList');if(!el||!access?.is_owner)return;
    el.innerHTML='<div class="card muted">Cargando usuarios...</div>';
    try{
      const data=await adminFunction('list');
      const users=data?.users||[];
      el.innerHTML=users.map(u=>{
        const isOwner=!!u.is_owner;
        const perms=MODULES.map(([key,,,title])=>`<label class="adminPermission"><input type="checkbox" data-perm="${key}" ${u.permissions?.[key]?'checked':''} ${isOwner?'disabled':''}> ${title}</label>`).join('');
        return `<div class="card adminUserCard" data-user-id="${esc(u.user_id)}">
          <div class="adminUserHeader"><div class="adminUserName"><b>${esc(u.display_name||'Usuario')}</b><small>${esc(u.email||'')}</small></div>${isOwner?'<span class="adminOwnerBadge">PROPIETARIO</span>':(u.active?'<span class="adminActiveBadge">ACTIVO</span>':'')}</div>
          ${isOwner?'<p class="muted">Acceso total. Este usuario principal no puede bloquearse ni eliminarse desde la app.</p>':`<label class="adminPermission"><input type="checkbox" data-active ${u.active?'checked':''}> Usuario habilitado</label><div class="adminPermissionGrid">${perms}</div><div class="adminUserActions"><button class="btn" type="button" onclick="saveAdminUser('${esc(u.user_id)}')">GUARDAR PERMISOS</button><button class="btn secondary" type="button" onclick="changeAdminUserPassword('${esc(u.user_id)}')">CAMBIAR CLAVE</button><button class="btn danger" type="button" onclick="deleteAdminUser('${esc(u.user_id)}','${esc(u.display_name||u.email||'usuario')}')">ELIMINAR</button></div>`}
        </div>`;
      }).join('')||'<div class="card muted">No hay usuarios.</div>';
    }catch(e){el.innerHTML=`<div class="card muted">${esc(e.message||'No se pudieron cargar los usuarios')}</div>`}
  };

  window.saveAdminUser=async function(userId){
    const card=document.querySelector(`.adminUserCard[data-user-id="${userId}"]`);if(!card)return;
    const permissions={};MODULES.forEach(([key])=>permissions[key]=!!card.querySelector(`[data-perm="${key}"]`)?.checked);
    const active=!!card.querySelector('[data-active]')?.checked;
    try{await adminFunction('update',{user_id:userId,active,permissions});toast('Permisos actualizados');await renderAdminUsers()}catch(e){toast(e.message||'No se pudo guardar')}
  };

  window.changeAdminUserPassword=async function(userId){
    const password=prompt('Nueva contraseña (mínimo 8 caracteres)');if(password===null)return;
    if(password.length<8)return toast('La contraseña debe tener al menos 8 caracteres');
    try{await adminFunction('password',{user_id:userId,password});toast('Contraseña actualizada')}catch(e){toast(e.message||'No se pudo cambiar la contraseña')}
  };

  window.deleteAdminUser=async function(userId,name){
    if(!confirm(`¿Eliminar el usuario "${name}"?`))return;
    try{await adminFunction('delete',{user_id:userId});toast('Usuario eliminado');await renderAdminUsers()}catch(e){toast(e.message||'No se pudo eliminar')}
  };

  async function createAdminUser(e){
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const permissions={};
    MODULES.forEach(([key])=>permissions[key]=f.get(`perm_${key}`)==='1');
    try{
      await adminFunction('create',{display_name:String(f.get('display_name')||'').trim(),email:String(f.get('email')||'').trim(),password:String(f.get('password')||''),permissions});
      form.reset();toast('Usuario creado');await renderAdminUsers();
    }catch(err){toast(err.message||'No se pudo crear el usuario')}
  }

  function urlBase64ToUint8Array(base64String){
    const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }

  window.enableAdminNotifications=async function(){
    if(!allowed('registrations'))return toast('Necesitás permiso de Inscripciones');
    if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window))return toast('Este dispositivo no admite notificaciones push');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')return toast('No se habilitaron las notificaciones');
    try{
      const registration=await navigator.serviceWorker.ready;
      let subscription=await registration.pushManager.getSubscription();
      if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
      const json=subscription.toJSON();const {data:{session}}=await sb.auth.getSession();
      if(!session)throw new Error('Sesión vencida');
      const {error}=await sb.from('push_subscriptions').upsert({endpoint:subscription.endpoint,user_id:session.user.id,p256dh:json.keys?.p256dh,auth:json.keys?.auth,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(error)throw error;
      toast('Notificaciones activadas');syncPushStatus();
    }catch(e){console.error(e);toast('No se pudieron activar las notificaciones')}
  };

  async function syncPushStatus(){
    const el=document.getElementById('adminPushSummary');if(!el)return;
    if(!('Notification'in window)||Notification.permission!=='granted'){el.textContent='Activá avisos cuando llegue una música nueva';return}
    try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();el.textContent=sub?'Notificaciones activadas en este dispositivo':'Tocá para activar avisos de nuevas músicas'}catch{}
  }

  window.publishPost=async function publishPostV26(e){
    e.preventDefault();const f=new FormData(e.target);let image_path=null;const file=document.getElementById('postImage')?.files?.[0];
    if(file){image_path=`post_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error:up}=await sb.storage.from('Photos').upload(image_path,file,{upsert:false,contentType:file.type});if(up)return toast('No se pudo subir la imagen')}
    const {error}=await sb.from('posts').insert({title:f.get('title'),body:f.get('body'),image_path,published:true});if(error)return toast('No se pudo publicar');toast('Publicación creada');render();
  };

  window.loadAdminPhotos=async function loadAdminPhotosV26(){
    const el=document.getElementById('adminPhotosDeleteList');if(!el)return;
    const {data,error}=await sb.storage.from('Photos').list('',{limit:100,sortBy:{column:'created_at',order:'desc'}});
    if(error){el.innerHTML='<div class="card muted">No se pudieron cargar las fotos.</div>';return}
    const files=(data||[]).filter(x=>x.name&&x.name!=='.emptyFolderPlaceholder'&&!x.name.startsWith('cover_')&&!x.name.startsWith('post_')&&/\.(png|jpe?g|webp|gif)$/i.test(x.name));
    if(!files.length){el.innerHTML='<div class="card muted">No hay fotos para eliminar.</div>';return}
    el.innerHTML=files.map(item=>{const url=sb.storage.from('Photos').getPublicUrl(item.name).data.publicUrl;const safeName=encodeURIComponent(item.name);return `<div class="card"><img src="${url}" alt="Foto" style="width:100%;border-radius:12px;display:block"><button class="btn danger" style="margin-top:10px;width:100%" onclick="deleteAdminPhoto(decodeURIComponent('${safeName}'))">🗑️ ELIMINAR FOTO</button></div>`}).join('');
  };

  window.submitRegistration=async function submitRegistrationV26(e){
    e.preventDefault();const f=new FormData(e.target),file=document.getElementById('musicFile').files[0];
    if(!file)return toast('Seleccioná la música');if(file.size>50*1024*1024)return toast('Máximo 50 MB');
    const id=crypto.randomUUID();const row={id,name:f.get('name'),category:f.get('category'),discipline:f.get('discipline'),academy:f.get('academy')||null,participant_count:Number(f.get('participant_count')||1),contact:f.get('contact'),phone:f.get('phone')||null,email:f.get('email')||null,status:'pending'};
    let {error}=await sb.from('participants').insert(row);if(error){console.error(error);return toast('No se pudieron guardar los datos')}
    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');({error}=await sb.storage.from(cfg.musicBucket).upload(`${id}/${Date.now()}_${safe}`,file,{upsert:false,contentType:file.type||'audio/mpeg'}));
    if(error){console.error(error);return toast('Datos guardados, pero falló la música')}
    e.target.style.display='none';document.getElementById('result').innerHTML=`<div class="success"><h3>✅ Inscripción enviada</h3><p>Número: <b>${id.slice(0,8).toUpperCase()}</b></p><p>La música fue cargada de forma privada.</p></div>`;
    sb.functions.invoke('jd-notify-registration',{body:{participant_id:id}}).catch(err=>console.warn('No se pudo enviar aviso push',err));
  };

  async function loginHandler(e){
    e.preventDefault();const f=new FormData(e.currentTarget);const {data,error}=await sb.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});
    if(error)return toast('Email o contraseña incorrectos');
    const {data:profile}=await sb.from('admin_users').select('active').eq('user_id',data.user.id).maybeSingle();
    if(!profile?.active){await sb.auth.signOut();return toast('Usuario no habilitado')}
    await loadAccess();render();
  }

  function setupAdmin(){
    const login=document.getElementById('loginForm');if(login){login.onsubmit=loginHandler;return}
    const form=document.getElementById('adminUserCreateForm');if(form)form.onsubmit=createAdminUser;
    if(activeModule)openAdminModule(activeModule);else showAdminDashboard();
    syncPushStatus();
  }

  window.render=async function renderV26(){
    await legacyRender();
    if((location.hash.slice(1)||'home')==='admin')setupAdmin();
  };

  window.render();
})();
