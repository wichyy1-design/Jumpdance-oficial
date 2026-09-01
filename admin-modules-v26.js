(() => {
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

  const access=()=>window.JD_ADMIN_ACCESS||null;
  const allowed=key=>!!(access()?.is_owner||access()?.permissions?.[key]);
  const back=()=>'<button class="adminBack" type="button" onclick="showAdminDashboard()">← Panel</button>';

  function dashboardHtml(){
    const cards=MODULES.filter(([key])=>allowed(key)).map(([key,id,icon,title,desc])=>`
      <button class="adminModuleCard" type="button" onclick="openAdminModule('${id}')">
        <span class="adminModuleIcon">${icon}</span><b>${title}</b><small>${desc}</small><span class="adminModuleArrow">›</span>
      </button>`).join('');
    const notificationCard=allowed('registrations')?`
      <button class="adminModuleCard notifications" type="button" onclick="enableAdminNotifications()">
        <span class="adminModuleIcon">🔔</span><b>Notificaciones</b><small id="adminPushSummary">Activá avisos cuando llegue una música nueva</small><span class="adminModuleArrow">›</span>
      </button>`:'';
    const usersCard=access()?.is_owner?`
      <button class="adminModuleCard users" type="button" onclick="openAdminModule('aUsers')">
        <span class="adminModuleIcon">👥</span><b>Usuarios y permisos</b><small>Crear usuarios y decidir qué puede administrar cada uno</small><span class="adminModuleArrow">›</span>
      </button>`:'';
    return `<section id="adminDashboard" class="adminDashboard">
      <div class="adminDashboardHead"><div><h3>Panel de control</h3><p class="muted">Elegí qué querés administrar.</p></div></div>
      <div class="adminModuleGrid">${cards}${notificationCard}${usersCard}</div>
    </section>`;
  }

  function usersSection(){
    if(!access()?.is_owner)return '';
    const checks=MODULES.map(([key,,,title])=>`<label class="adminPermission"><input type="checkbox" name="perm_${key}" value="1"> ${title}</label>`).join('');
    return `<section id="aUsers" class="adminModulePanel">${back()}
      <div class="sectionTitle"><h2>👥 Usuarios y permisos</h2></div>
      <form id="adminUserCreateForm" class="card form">
        <div class="row">
          <div class="field"><label>Nombre</label><input name="display_name" required placeholder="Ej.: Melisa"></div>
          <div class="field"><label>Usuario</label><input name="username" minlength="3" maxlength="32" pattern="[A-Za-z0-9_.-]+" autocapitalize="none" spellcheck="false" required placeholder="Ej.: melisa"></div>
        </div>
        <div class="field"><label>Clave inicial</label><input name="password" type="password" minlength="8" required placeholder="Mínimo 8 caracteres"></div>
        <div><b>Habilitar módulos</b><div class="adminPermissionGrid">${checks}</div></div>
        <button class="btn" type="submit">CREAR USUARIO</button>
      </form>
      <div class="sectionTitle"><h3>Usuarios habilitados</h3></div>
      <div id="adminUsersList" class="list"><div class="card muted">Cargando usuarios...</div></div>
    </section>`;
  }

  async function eventSection(){
    if(!allowed('event'))return '';
    const s=await getEventSettings();
    const preview=s.cover_image?sb.storage.from('Photos').getPublicUrl(s.cover_image).data.publicUrl:'';
    return `<section id="aEvent" class="adminModulePanel">${back()}
      <div class="sectionTitle"><h2>🖼️ Portada y evento</h2></div>
      <form id="eventSettingsForm" class="card form">
        <div class="field"><label>Fecha del evento</label><input name="event_date" value="${esc(s.date)}" required></div>
        <div class="field"><label>Lugar del evento</label><input name="event_place" value="${esc(s.place)}" required></div>
        <div class="field"><label>Imagen de portada</label><input id="eventCoverImage" type="file" accept="image/*"><p class="muted">Podés elegir una imagen desde tu teléfono.</p></div>
        ${preview?`<div class="coverAdminPreview"><img src="${esc(preview)}" alt="Portada actual"></div>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="submit">GUARDAR PORTADA</button>${s.cover_image?'<button class="btn danger" type="button" onclick="removeEventCover()">QUITAR IMAGEN</button>':''}</div>
      </form>
    </section>`;
  }

  async function registrationsSection(){
    if(!allowed('registrations'))return '';
    const {data:ps,error}=await sb.from('participants').select('*').order('created_at',{ascending:false});
    if(error)return `<section id="aIns" class="adminModulePanel">${back()}<div class="card muted">No se pudieron cargar las inscripciones.</div></section>`;
    let h=`<section id="aIns" class="adminModulePanel">${back()}
      <div class="sectionTitle"><h2>🎵 Inscripciones y músicas</h2></div>
      <div class="card"><b>Total de inscripciones: ${(ps||[]).length}</b><div style="margin-top:6px"><b>Total de personas inscriptas: ${(ps||[]).reduce((sum,p)=>sum+(Number(p.participant_count)||1),0)}</b></div><div class="field" style="margin-top:10px"><input id="adminSearch" oninput="filterAdmin()" placeholder="Buscar participante, academia, categoría o disciplina"></div></div><div class="list">`;
    for(const p of ps||[]){
      const number=(p.id||'').slice(0,8).toUpperCase();
      const search=[p.name,p.academy,p.category,p.discipline,p.participant_count,p.contact,p.phone,p.email,number].filter(Boolean).join(' ').toLowerCase();
      h+=`<div class="card adminCard" data-q="${esc(search)}"><div class="item"><div class="avatar">${esc((p.name||'?')[0])}</div><div class="grow"><b style="font-size:20px">${esc(p.name||'Sin nombre')}</b><div class="muted">Inscripción: <b>${esc(number)}</b></div></div></div>
        <div style="margin-top:12px;line-height:1.8"><div><b>Categoría:</b> ${fmt(p.category)}</div><div><b>Disciplina:</b> ${fmt(p.discipline)}</div><div><b>Academia:</b> ${fmt(p.academy)}</div><div><b>Cantidad:</b> ${fmt(p.participant_count||1)}</div><div><b>Responsable:</b> ${fmt(p.contact)}</div><div><b>WhatsApp:</b> ${fmt(p.phone)}</div><div><b>Email:</b> ${fmt(p.email)}</div></div>`;
      const {data:files}=await sb.storage.from(cfg.musicBucket).list(p.id,{limit:20});
      for(const file of files||[]){
        if(!file?.name)continue;
        const {data:signed}=await sb.storage.from(cfg.musicBucket).createSignedUrl(`${p.id}/${file.name}`,600);
        if(signed?.signedUrl)h+=`<div class="fileRow"><b>🎵 ${esc(file.name)}</b><audio class="audio" controls src="${esc(signed.signedUrl)}"></audio><a class="btn secondary" style="display:inline-block;text-decoration:none;margin-top:8px" href="${esc(signed.signedUrl)}" download>Descargar música</a></div>`;
      }
      h+=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" onclick="editParticipant('${esc(p.id)}')">Editar</button><button class="btn danger" onclick="deleteParticipant('${esc(p.id)}','${esc(p.name||'')}')">Eliminar</button></div></div>`;
    }
    h+=`</div></section>`;
    return h;
  }

  function mediaSection(){
    if(!allowed('media'))return '';
    return `<section id="aMedia" class="adminModulePanel">${back()}
      <div class="sectionTitle"><h2>📸🎬 Fotos y videos</h2></div>
      <div class="card form"><div class="field"><label>Subir foto</label><input id="adminPhoto" type="file" accept="image/*"></div><button class="btn" type="button" onclick="uploadAdminMedia('Photos','adminPhoto')">PUBLICAR FOTO</button><div class="field"><label>Subir video</label><input id="adminVideo" type="file" accept="video/*"></div><button class="btn" type="button" onclick="uploadAdminMedia('Videos','adminVideo')">PUBLICAR VIDEO</button></div>
      <div class="sectionTitle"><h3>🗑️ Eliminar fotos</h3></div><div id="adminPhotosDeleteList" class="list"><div class="card muted">Cargando fotos...</div></div>
      <div class="sectionTitle"><h3>🗑️ Eliminar videos</h3></div><div id="adminVideosDeleteList" class="list"><div class="card muted">Cargando videos...</div></div>
    </section>`;
  }

  function sponsorsSection(){
    if(!allowed('sponsors'))return '';
    return `<section id="aSponsors" class="adminModulePanel">${back()}<div class="sectionTitle"><h2>⭐ Sponsors</h2></div><form id="sponsorFormMinimal" class="card form"><div class="field"><label>Nombre del sponsor *</label><input name="sponsor_name" required></div><div class="field"><label>URL de la imagen o logo</label><input name="sponsor_image" placeholder="https://..."></div><button class="btn">PUBLICAR SPONSOR</button></form><div class="sectionTitle"><h3>Sponsors cargados</h3></div><div id="adminSponsorsMinimal" class="list"></div></section>`;
  }

  function resultsSection(){
    if(!allowed('results'))return '';
    return `<section id="aResults" class="adminModulePanel">${back()}<div class="sectionTitle"><h2>🏆 Resultados por año</h2></div><form id="resultMultiYearForm" class="card form"><div class="row"><div class="field"><label>Año *</label><input name="result_year" type="number" min="2000" max="2100" required placeholder="Ej.: 2026"></div><div class="field"><label>Puesto *</label><input name="result_position" required placeholder="Ej.: 1° Puesto"></div></div><div class="field"><label>Participante / grupo *</label><input name="result_participant" required></div><div class="field"><label>Academia</label><input name="result_academy"></div><div class="row"><div class="field"><label>Categoría</label><input name="result_category"></div><div class="field"><label>Disciplina</label><input name="result_discipline"></div></div><div class="field"><label>Observación</label><textarea name="result_note" rows="3"></textarea></div><button class="btn">AGREGAR RESULTADO</button></form><div class="sectionTitle"><h3>Resultados cargados</h3></div><div id="adminResultsMultiYear" class="list"><div class="card muted">Cargando resultados...</div></div></section>`;
  }

  function newsSection(){
    if(!allowed('news'))return '';
    return `<section id="aNews" class="adminModulePanel">${back()}<div class="sectionTitle"><h2>📣 Novedades</h2></div><form id="newsForm" class="card form"><div class="field"><label>Título *</label><input name="news_title" required></div><div class="field"><label>Contenido *</label><textarea name="news_body" rows="5" required></textarea></div><button class="btn">PUBLICAR NOVEDAD</button></form><div class="sectionTitle"><h3>Novedades cargadas</h3></div><div id="adminNewsList" class="list"><div class="card muted">Cargando novedades...</div></div></section>`;
  }

  function postsSection(){
    if(!allowed('posts'))return '';
    return `<section id="aPosts" class="adminModulePanel">${back()}<div class="sectionTitle"><h2>📰 Publicaciones</h2></div><form id="postForm" class="card form"><div class="field"><label>Título</label><input name="title" required></div><div class="field"><label>Texto</label><textarea name="body" required></textarea></div><div class="field"><label>Imagen opcional</label><input id="postImage" type="file" accept="image/*"></div><button class="btn">PUBLICAR</button></form></section>`;
  }

  async function messagesSection(){
    if(!allowed('messages'))return '';
    const {data:msgs}=await sb.from('public_messages').select('*').order('created_at',{ascending:false}).limit(100);
    let h=`<section id="aMsgs" class="adminModulePanel">${back()}<div class="sectionTitle"><h2>💬 Mensajes públicos</h2></div><div class="list">`;
    for(const m of msgs||[])h+=`<div class="messageCard"><b>${esc(m.display_name)}</b><p>${esc(m.message)}</p><button class="btn danger" onclick="deleteMessage('${esc(m.id)}')">Eliminar mensaje</button></div>`;
    h+=(msgs?.length?'':'<div class="card muted">No hay mensajes.</div>')+`</div></section>`;
    return h;
  }

  window.adminPanel=async function adminPanelByPermission(){
    const profile=access();
    if(!profile)return '<div class="card muted">No se pudo cargar el acceso.</div>';
    const parts=[
      `<div class="adminbar"><div><h2>⚙️ Panel administrador</h2><p class="muted">${esc(profile.display_name||'Usuario')} · elegí una sección</p></div><button class="btn secondary" onclick="logout()">Cerrar sesión</button></div>`,
      dashboardHtml(),
      await eventSection(),
      await registrationsSection(),
      mediaSection(),
      sponsorsSection(),
      resultsSection(),
      newsSection(),
      postsSection(),
      await messagesSection(),
      usersSection()
    ];
    return parts.join('');
  };
})();
