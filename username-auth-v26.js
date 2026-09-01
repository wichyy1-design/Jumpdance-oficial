(() => {
  const MODULE_KEYS=['event','registrations','media','sponsors','results','news','posts','messages'];
  const MODULE_TITLES={event:'Portada y evento',registrations:'Inscripciones y músicas',media:'Fotos y videos',sponsors:'Sponsors',results:'Resultados',news:'Novedades',posts:'Publicaciones',messages:'Mensajes'};

  window.adminLogin=function usernameAdminLogin(){
    return `<div class="login card"><h2>🔐 Administrador</h2><form id="loginForm" class="form">
      <div class="field"><label>Usuario</label><input name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div>
      <div class="field"><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn">INICIAR SESIÓN</button>
    </form></div>`;
  };

  const baseAdminPanel=window.adminPanel;
  window.adminPanel=async function usernameAdminPanel(){
    let html=await baseAdminPanel();
    html=html.replace(
      '<div class="row"><div class="field"><label>Nombre</label><input name="display_name" required placeholder="Ej.: Melisa"></div><div class="field"><label>Email</label><input name="email" type="email" required></div></div>',
      '<div class="row"><div class="field"><label>Nombre</label><input name="display_name" required placeholder="Ej.: Melisa"></div><div class="field"><label>Usuario</label><input name="username" minlength="3" maxlength="32" pattern="[A-Za-z0-9_.-]+" autocapitalize="none" spellcheck="false" required placeholder="Ej.: melisa"></div></div>'
    );
    return html;
  };

  async function invokeAdminUsers(action,payload={}){
    const {data,error}=await sb.functions.invoke('jd-admin-users',{body:{action,...payload}});
    if(error){console.error(error);throw new Error(error.message||'No se pudo completar la operación')}
    if(data?.error)throw new Error(data.error);
    return data;
  }

  async function usernameLoginHandler(e){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const username=String(f.get('username')||'').trim().toLowerCase();
    const password=String(f.get('password')||'');
    if(!username||!password)return toast('Completá usuario y contraseña');
    try{
      const {data,error}=await sb.functions.invoke('jd-login',{body:{username,password}});
      if(error||data?.error||!data?.access_token||!data?.refresh_token)return toast('Usuario o contraseña incorrectos');
      const {error:setErr}=await sb.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
      if(setErr)throw setErr;
      toast('Sesión iniciada');
      await window.render();
    }catch(err){
      console.error(err);
      toast('Usuario o contraseña incorrectos');
    }
  }

  async function usernameCreateUser(e){
    e.preventDefault();
    const form=e.currentTarget;
    const f=new FormData(form);
    const permissions={};
    MODULE_KEYS.forEach(key=>permissions[key]=f.get(`perm_${key}`)==='1');
    const username=String(f.get('username')||'').trim().toLowerCase();
    if(!/^[a-z0-9_.-]{3,32}$/.test(username))return toast('Usuario inválido');
    try{
      await invokeAdminUsers('create',{
        display_name:String(f.get('display_name')||'').trim(),
        username,
        password:String(f.get('password')||''),
        permissions
      });
      form.reset();
      toast('Usuario creado');
      await window.renderAdminUsers();
    }catch(err){toast(err.message||'No se pudo crear el usuario')}
  }

  window.renderAdminUsers=async function usernameRenderAdminUsers(){
    const el=document.getElementById('adminUsersList');
    if(!el||!window.JD_ADMIN_ACCESS?.is_owner)return;
    el.innerHTML='<div class="card muted">Cargando usuarios...</div>';
    try{
      const data=await invokeAdminUsers('list');
      const users=data?.users||[];
      el.innerHTML=users.map(u=>{
        const isOwner=!!u.is_owner;
        const perms=MODULE_KEYS.map(key=>`<label class="adminPermission"><input type="checkbox" data-perm="${key}" ${u.permissions?.[key]?'checked':''} ${isOwner?'disabled':''}> ${MODULE_TITLES[key]}</label>`).join('');
        return `<div class="card adminUserCard" data-user-id="${esc(u.user_id)}">
          <div class="adminUserHeader">
            <div class="adminUserName"><b>${esc(u.display_name||'Usuario')}</b><small>Usuario: <b>${esc(u.username||'sin usuario')}</b></small></div>
            ${isOwner?'<span class="adminOwnerBadge">PROPIETARIO</span>':(u.active?'<span class="adminActiveBadge">ACTIVO</span>':'')}
          </div>
          ${isOwner?'<p class="muted">Acceso total. El administrador principal no puede bloquearse ni eliminarse desde la app.</p>':`<label class="adminPermission"><input type="checkbox" data-active ${u.active?'checked':''}> Usuario habilitado</label><div class="adminPermissionGrid">${perms}</div><div class="adminUserActions"><button class="btn" type="button" onclick="saveAdminUser('${esc(u.user_id)}')">GUARDAR PERMISOS</button><button class="btn secondary" type="button" onclick="changeAdminUserPassword('${esc(u.user_id)}')">CAMBIAR CLAVE</button><button class="btn danger" type="button" onclick="deleteAdminUser('${esc(u.user_id)}','${esc(u.display_name||u.username||'usuario')}')">ELIMINAR</button></div>`}
        </div>`;
      }).join('')||'<div class="card muted">No hay usuarios.</div>';
    }catch(err){el.innerHTML=`<div class="card muted">${esc(err.message||'No se pudieron cargar los usuarios')}</div>`}
  };

  const baseRender=window.render;
  window.render=async function usernameRender(){
    await baseRender();
    if((location.hash.slice(1)||'home')!=='admin')return;
    const login=document.getElementById('loginForm');
    if(login)login.onsubmit=usernameLoginHandler;
    const create=document.getElementById('adminUserCreateForm');
    if(create)create.onsubmit=usernameCreateUser;
  };

  window.render();
})();
