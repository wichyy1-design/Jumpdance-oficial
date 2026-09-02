(() => {
  const VERSION='42';
  const DEFAULT_PHOTO_YEAR='2026';
  const RECENT_REG_KEY='jd_recent_registrations_v42';
  const MSG_SEEN_KEY='jd_admin_messages_seen_v42';
  const guardedSubmit=window.submitRegistration;
  const baseRender=window.render;
  const baseUploadAdminMedia=window.uploadAdminMedia;
  const baseOpenAdminModule=window.openAdminModule;

  const clean=v=>String(v??'').trim();
  const safeYear=v=>/^20\d{2}$/.test(clean(v))?clean(v):DEFAULT_PHOTO_YEAR;
  const isOwnerOr=(key)=>!!(window.JD_ADMIN_ACCESS?.is_owner||window.JD_ADMIN_ACCESS?.permissions?.[key]);

  function saveRecentRegistration(entry){
    try{
      const rows=JSON.parse(localStorage.getItem(RECENT_REG_KEY)||'[]');
      const next=[entry,...(Array.isArray(rows)?rows:[]).filter(x=>x.code!==entry.code)].slice(0,8);
      localStorage.setItem(RECENT_REG_KEY,JSON.stringify(next));
    }catch{}
  }

  function getRecentRegistration(){
    try{return JSON.parse(localStorage.getItem(RECENT_REG_KEY)||'[]')?.[0]||null}catch{return null}
  }

  function registrationReceipt(data){
    const academy=clean(data.academy)||'Sin academia';
    const category=[clean(data.category),clean(data.discipline)].filter(Boolean).join(' · ')||'—';
    return `<div class="jdRegistrationReceipt">
      <h2>✅ Inscripción recibida</h2>
      <p class="jdReceiptLead">Tu inscripción quedó registrada correctamente. Guardá el número de inscripción para consultar el estado cuando quieras.</p>
      <div class="jdReceiptGrid">
        <div class="jdReceiptItem"><small>Coreo N.º</small><b>${esc(data.coreo)}</b></div>
        <div class="jdReceiptItem"><small>Participante / grupo</small><b>${esc(data.name||'—')}</b></div>
        <div class="jdReceiptItem"><small>Academia</small><b>${esc(academy)}</b></div>
        <div class="jdReceiptItem"><small>Categoría / disciplina</small><b>${esc(category)}</b></div>
        <div class="jdReceiptItem"><small>Archivo de música</small><b>${esc(data.fileName||'Música cargada')}</b></div>
      </div>
      <div class="jdReceiptStatus">
        <div>✅ Inscripción recibida</div>
        <div>✅ Música recibida</div>
      </div>
      <div class="jdReceiptCode"><small>Número de inscripción</small><br><b>${esc(data.code)}</b></div>
      <div class="jdReceiptActions"><button class="btn" type="button" onclick="route('admin')">VER ESTADO EN MI CUENTA</button><button class="btn secondary" type="button" onclick="route('program')">VER PROGRAMA</button></div>
    </div>`;
  }

  async function submitRegistrationV42(e){
    const form=e?.currentTarget||e?.target||document.getElementById('regForm');
    if(!form||typeof guardedSubmit!=='function')return guardedSubmit?.call?.(this,e);
    const f=new FormData(form);
    const snapshot={
      coreo:clean(f.get('coreo_number')),
      name:clean(f.get('name')),
      academy:clean(f.get('academy')),
      category:clean(f.get('category')),
      discipline:clean(f.get('discipline')),
      contact:clean(f.get('email'))||clean(f.get('phone')),
      fileName:document.getElementById('musicFile')?.files?.[0]?.name||''
    };

    await guardedSubmit.call(this,e);

    const result=document.getElementById('result');
    const success=form.style.display==='none'||!!result?.querySelector('.success');
    if(!success||!result)return;
    const raw=result.textContent||'';
    const code=(raw.match(/Número de inscripción:\s*([A-Z0-9]{8})/i)||[])[1]?.toUpperCase();
    if(!code)return;
    const data={...snapshot,code};
    saveRecentRegistration(data);
    result.innerHTML=registrationReceipt(data);
  }

  function participantAccountHtml(){
    const recent=getRecentRegistration();
    return `<section class="jdParticipantAccount">
      <div class="sectionTitle"><h2>🩰 Consultar mi inscripción</h2></div>
      <div class="card form">
        <p class="muted">Ingresá el número de inscripción y el WhatsApp o email que usaste al anotarte.</p>
        <form id="jdParticipantLookupForm">
          <div class="field"><label>Número de inscripción</label><input name="code" maxlength="8" value="${esc(recent?.code||'')}" placeholder="Ej.: A1B2C3D4" required autocapitalize="characters"></div>
          <div class="field"><label>WhatsApp o email</label><input name="contact" value="${esc(recent?.contact||'')}" placeholder="El mismo dato de la inscripción" required></div>
          <button class="btn" type="submit">VER MI ESTADO</button>
        </form>
        <div id="jdParticipantStatusResult" class="jdParticipantStatusResult"></div>
      </div>
    </section>`;
  }

  window.jdLookupRegistration=async function(e){
    e?.preventDefault?.();
    const form=e?.currentTarget||document.getElementById('jdParticipantLookupForm');
    const out=document.getElementById('jdParticipantStatusResult');
    if(!form||!out)return;
    const f=new FormData(form);
    const code=clean(f.get('code')).toUpperCase();
    const contact=clean(f.get('contact'));
    if(code.length!==8||!contact)return toast('Completá el número de inscripción y tu contacto');
    out.innerHTML='<div class="muted">Consultando...</div>';
    const {data,error}=await sb.rpc('jd_registration_status',{p_code:code,p_contact:contact});
    if(error){console.error(error);out.innerHTML='<div class="warning">No se pudo consultar en este momento.</div>';return}
    const r=Array.isArray(data)?data[0]:data;
    if(!r){out.innerHTML='<div class="warning">No encontramos una inscripción con esos datos. Revisá el número y el WhatsApp/email.</div>';return}
    const ready=String(r.registration_status||'').toLowerCase()==='ready';
    const program=!!r.program_published;
    out.innerHTML=`<div class="jdStatusHero">
      <h3>Coreo ${esc(r.coreo_number||'—')} · ${esc(r.participant_name||'Inscripción')}</h3>
      <div class="muted">${esc([r.academy,r.category,r.discipline].filter(Boolean).join(' · '))}</div>
      <div class="jdStatusRows">
        <div class="jdStatusRow"><span>Inscripción</span><span class="jdOk">✅ Recibida</span></div>
        <div class="jdStatusRow"><span>Música</span><span class="${r.music_received?'jdOk':'jdPending'}">${r.music_received?'✅ Recibida':'⏳ Pendiente'}</span></div>
        <div class="jdStatusRow"><span>Revisión</span><span class="${ready?'jdOk':'jdPending'}">${ready?'✅ Todo correcto':'⏳ Pendiente de revisión'}</span></div>
        <div class="jdStatusRow"><span>Orden de presentación</span><span class="${program?'jdOk':'jdPending'}">${program?`✅ Coreo N.º ${esc(r.coreo_number||'—')}`:'⏳ Pendiente'}</span></div>
      </div>
    </div>`;
  };

  function bindParticipantLookup(){
    const form=document.getElementById('jdParticipantLookupForm');
    if(form)form.onsubmit=window.jdLookupRegistration;
  }

  function injectParticipantAccount(){
    if((location.hash.slice(1)||'home')!=='admin')return;
    if(!document.getElementById('loginForm'))return;
    if(document.querySelector('.jdParticipantAccount'))return;
    const host=document.getElementById('loginForm')?.closest('.card')||document.getElementById('loginForm')?.parentElement;
    if(host)host.insertAdjacentHTML('afterend',participantAccountHtml());
    bindParticipantLookup();
  }

  window.program=async function(){
    const {data,error}=await sb.rpc('jd_public_program');
    if(error){console.error(error);return `<div class="sectionTitle"><h2>📋 Programa del evento</h2></div><div class="card muted">No se pudo cargar el programa.</div>`}
    const rows=Array.isArray(data)?data:[];
    let h=`<div class="jdProgramHeader"><div><div class="muted">JUMPDANCE</div><h1>📋 Programa del evento</h1></div></div>`;
    if(!rows.length)return h+`<div class="card jdProgramEmpty"><h3>Programa pendiente</h3><p class="muted">El orden de presentación todavía no fue publicado.</p></div>`;
    h+=`<div class="jdProgramList">`;
    for(const r of rows){
      h+=`<article class="jdProgramCard"><div class="jdProgramNumber">${esc(r.coreo_number)}</div><div><div class="jdProgramName">${esc(r.participant_name||'Coreografía')}</div><div class="jdProgramMeta">${esc([r.academy,r.category,r.discipline].filter(Boolean).join(' · '))}</div></div></article>`;
    }
    return h+'</div>';
  };

  function participantIdFromCard(card){
    const button=[...card.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes('editParticipant('));
    return ((button?.getAttribute('onclick')||'').match(/editParticipant\('([^']+)'\)/)||[])[1]||'';
  }

  window.jdSetParticipantReady=async function(id,ready){
    const {error}=await sb.from('participants').update({status:ready?'ready':'pending'}).eq('id',id);
    if(error){console.error(error);return toast('No se pudo cambiar el estado')}
    toast(ready?'Marcada como Todo correcto':'Marcada como pendiente');
    await window.render?.();
  };

  window.jdToggleParticipantProgram=async function(id,publish){
    const {error}=await sb.from('participants').update({program_published:!!publish}).eq('id',id);
    if(error){console.error(error);return toast('No se pudo actualizar el programa')}
    toast(publish?'Coreografía publicada en el programa':'Coreografía quitada del programa');
    await window.render?.();
  };

  async function enhanceRegistrationAdminCards(){
    if(!isOwnerOr('registrations'))return;
    const cards=[...document.querySelectorAll('#aIns .adminCard')];
    if(!cards.length)return;
    const ids=cards.map(participantIdFromCard).filter(Boolean);
    if(!ids.length)return;
    const {data,error}=await sb.from('participants').select('id,status,program_published,coreo_number').in('id',ids);
    if(error)return;
    const byId=new Map((data||[]).map(p=>[p.id,p]));
    for(const card of cards){
      const id=participantIdFromCard(card);const p=byId.get(id);if(!p)continue;
      card.querySelector('.jdParticipantAdminStatus')?.remove();
      const ready=String(p.status||'').toLowerCase()==='ready';
      const published=!!p.program_published;
      const box=document.createElement('div');
      box.className='jdParticipantAdminStatus';
      box.innerHTML=`<div style="margin-top:11px;display:flex;gap:7px;flex-wrap:wrap"><span class="jdTinyBadge ${ready?'ok':''}">${ready?'✅ Todo correcto':'⏳ Pendiente'}</span><span class="jdTinyBadge ${published?'live':''}">${published?'📋 En programa':'Programa oculto'}</span></div><div class="jdProgramAdminActions"><button class="btn secondary" type="button" onclick="jdSetParticipantReady('${esc(id)}',${ready?'false':'true'})">${ready?'MARCAR PENDIENTE':'✅ TODO CORRECTO'}</button><button class="btn secondary" type="button" onclick="jdToggleParticipantProgram('${esc(id)}',${published?'false':'true'})">${published?'QUITAR DEL PROGRAMA':'📋 PUBLICAR EN PROGRAMA'}</button></div>`;
      card.appendChild(box);
    }
  }

  async function renderProgramAdmin(){
    const el=document.getElementById('jdProgramAdminList');
    if(!el||!isOwnerOr('registrations'))return;
    el.innerHTML='<div class="card muted">Cargando programa...</div>';
    const {data,error}=await sb.from('participants').select('id,name,academy,category,discipline,coreo_number,status,program_published').order('coreo_number',{ascending:true,nullsFirst:false});
    if(error){el.innerHTML='<div class="card muted">No se pudo cargar el programa.</div>';return}
    const rows=data||[];
    if(!rows.length){el.innerHTML='<div class="card muted">Todavía no hay inscripciones.</div>';return}
    el.innerHTML=rows.map(p=>{
      const ready=String(p.status||'').toLowerCase()==='ready';
      const published=!!p.program_published;
      return `<article class="jdProgramAdminCard"><div class="jdProgramAdminTop"><div><div class="jdProgramAdminCoreo">Coreo ${esc(p.coreo_number||'—')} · ${esc(p.name||'Sin nombre')}</div><div class="muted">${esc([p.academy,p.category,p.discipline].filter(Boolean).join(' · '))}</div></div><div><span class="jdTinyBadge ${ready?'ok':''}">${ready?'✅ Correcto':'⏳ Pendiente'}</span></div></div><div class="jdProgramAdminActions"><button class="btn secondary" type="button" onclick="editParticipant('${esc(p.id)}')">EDITAR</button><button class="btn secondary" type="button" onclick="jdSetParticipantReady('${esc(p.id)}',${ready?'false':'true'})">${ready?'MARCAR PENDIENTE':'✅ TODO CORRECTO'}</button><button class="btn" type="button" onclick="jdToggleParticipantProgram('${esc(p.id)}',${published?'false':'true'})">${published?'QUITAR DEL PROGRAMA':'PUBLICAR EN PROGRAMA'}</button></div></article>`;
    }).join('');
  }

  window.jdOpenProgramAdmin=function(){
    if(!isOwnerOr('registrations'))return toast('Necesitás permiso de Inscripciones');
    if(typeof baseOpenAdminModule==='function')baseOpenAdminModule('aProgram');
    renderProgramAdmin();
  };

  function injectProgramAdmin(){
    if(!isOwnerOr('registrations'))return;
    const dashboard=document.getElementById('adminDashboard');
    const grid=dashboard?.querySelector('.adminModuleGrid');
    if(grid&&!document.getElementById('jdProgramModuleCard')){
      grid.insertAdjacentHTML('beforeend',`<button id="jdProgramModuleCard" class="adminModuleCard" type="button" onclick="jdOpenProgramAdmin()"><span class="adminModuleIcon">📋</span><b>Programa del evento</b><small>Orden por número de coreo y publicación pública</small><span class="adminModuleArrow">›</span></button>`);
    }
    if(!document.getElementById('aProgram')){
      const panel=document.createElement('section');
      panel.id='aProgram';panel.className='adminModulePanel';
      panel.innerHTML=`<button class="adminBack" type="button" onclick="showAdminDashboard()">← Panel</button><div class="sectionTitle"><h2>📋 Programa del evento</h2></div><div class="card muted">Las coreografías se ordenan por Coreo N.º. Publicá solamente las que ya querés mostrar al público.</div><div id="jdProgramAdminList" class="jdProgramAdminList"></div>`;
      document.getElementById('app')?.appendChild(panel);
    }
  }

  function photoIsReal(x){
    return !!(x?.name&&x.id&&x.metadata&&/\.(jpe?g|png|webp|gif|avif|heic)$/i.test(x.name)&&!String(x.name).startsWith('cover_')&&!String(x.name).startsWith('post_'));
  }

  async function listPhotosForAdmin(){
    const {data:root,error}=await sb.storage.from('Photos').list('',{limit:500,sortBy:{column:'created_at',order:'desc'}});
    if(error)return [];
    const out=(root||[]).filter(photoIsReal).map(x=>({path:x.name,name:x.name,year:DEFAULT_PHOTO_YEAR}));
    const folders=(root||[]).filter(x=>/^20\d{2}$/.test(String(x?.name||''))&&(!x.id||!x.metadata));
    for(const folder of folders){
      const {data}=await sb.storage.from('Photos').list(folder.name,{limit:500,sortBy:{column:'created_at',order:'desc'}});
      for(const x of data||[])if(photoIsReal(x))out.push({path:`${folder.name}/${x.name}`,name:x.name,year:folder.name});
    }
    return out.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));
  }

  window.loadAdminPhotos=async function loadAdminPhotosV42(){
    const el=document.getElementById('adminPhotosDeleteList');if(!el)return;
    const files=await listPhotosForAdmin();
    if(!files.length){el.innerHTML='<div class="card muted">No hay fotos para eliminar.</div>';return}
    el.innerHTML=files.map(item=>{const url=sb.storage.from('Photos').getPublicUrl(item.path).data.publicUrl;const safePath=encodeURIComponent(item.path);return `<div class="card"><div class="muted" style="margin-bottom:7px"><b>Jumpdance ${esc(item.year)}</b></div><img src="${esc(url)}" alt="Foto" style="width:100%;border-radius:12px;display:block"><button class="btn danger" style="margin-top:10px;width:100%" onclick="deleteAdminPhoto(decodeURIComponent('${safePath}'))">🗑️ ELIMINAR FOTO</button></div>`}).join('');
  };

  window.uploadAdminMedia=async function uploadAdminMediaV42(bucket,inputId){
    if(bucket!=='Photos'||inputId!=='adminPhoto')return baseUploadAdminMedia?.call?.(this,bucket,inputId);
    const input=document.getElementById(inputId),file=input?.files?.[0];
    if(!file)return toast('Elegí una foto');
    if(!file.type.startsWith('image/'))return toast('Elegí una imagen válida');
    const year=safeYear(document.getElementById('adminPhotoYear')?.value||DEFAULT_PHOTO_YEAR);
    const safe=`${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const path=`${year}/${safe}`;
    const {error}=await sb.storage.from('Photos').upload(path,file,{upsert:false,contentType:file.type});
    if(error){console.error(error);return toast('No se pudo publicar la foto')}
    input.value='';toast(`Foto publicada en Jumpdance ${year}`);await window.loadAdminPhotos();
  };

  function injectMediaYear(){
    const input=document.getElementById('adminPhoto');
    if(!input||document.getElementById('adminPhotoYear'))return;
    const field=input.closest('.field');
    field?.insertAdjacentHTML('beforebegin',`<div class="field jdMediaYearRow"><label>Año del evento</label><select id="adminPhotoYear"><option>2026</option><option>2025</option><option>2024</option><option>2023</option><option>2022</option></select><p class="muted">Las fotos quedan separadas automáticamente por año.</p></div>`);
  }

  async function enhanceAdminMetrics(){
    const dashboard=document.getElementById('adminDashboard');
    if(!dashboard||dashboard.querySelector('.jdAdminMetrics'))return;
    const head=dashboard.querySelector('.adminDashboardHead');
    if(!head)return;
    const metrics=document.createElement('div');metrics.className='jdAdminMetrics';metrics.innerHTML='<div class="jdMetric"><small>Resumen</small><strong>…</strong></div>';
    head.insertAdjacentElement('afterend',metrics);

    try{
      const [{data:participants},{data:musicRoot},{data:messages},photos]=await Promise.all([
        sb.from('participants').select('id,status,program_published'),
        sb.storage.from(cfg.musicBucket).list('',{limit:1000}),
        sb.from('public_messages').select('created_at').order('created_at',{ascending:false}).limit(200),
        listPhotosForAdmin()
      ]);
      const ps=participants||[];
      const folders=new Set((musicRoot||[]).filter(x=>x?.name&&(!x.id||!x.metadata)).map(x=>x.name));
      const musicCount=ps.filter(p=>folders.has(p.id)).length;
      const pendingMusic=Math.max(0,ps.length-musicCount);
      const seen=Number(localStorage.getItem(MSG_SEEN_KEY)||0);
      const newMessages=(messages||[]).filter(m=>new Date(m.created_at).getTime()>seen).length;
      metrics.innerHTML=`<div class="jdMetric"><small>Inscripciones</small><strong>${ps.length}</strong></div><div class="jdMetric"><small>Músicas recibidas</small><strong>${musicCount}</strong></div><div class="jdMetric warn"><small>Música pendiente</small><strong>${pendingMusic}</strong></div><div class="jdMetric"><small>Fotos</small><strong>${photos.length}</strong></div><div class="jdMetric new"><small>Mensajes nuevos</small><strong>${newMessages}</strong></div>`;
    }catch(err){console.error(err);metrics.innerHTML='<div class="jdMetric"><small>Resumen</small><strong>—</strong></div>'}
  }

  if(typeof baseOpenAdminModule==='function'){
    window.openAdminModule=function openAdminModuleV42(id){
      if(id==='aMsgs')localStorage.setItem(MSG_SEEN_KEY,String(Date.now()));
      return baseOpenAdminModule.apply(this,arguments);
    };
  }

  async function enhanceAdmin(){
    if((location.hash.slice(1)||'home')!=='admin')return;
    injectProgramAdmin();
    injectMediaYear();
    await Promise.allSettled([enhanceAdminMetrics(),enhanceRegistrationAdminCards()]);
  }

  function loadHtml2Canvas(){
    if(window.html2canvas)return Promise.resolve(window.html2canvas);
    return new Promise((resolve,reject)=>{
      let s=document.getElementById('jdHtml2Canvas');
      if(s){s.addEventListener('load',()=>resolve(window.html2canvas),{once:true});s.addEventListener('error',reject,{once:true});return}
      s=document.createElement('script');s.id='jdHtml2Canvas';s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';s.onload=()=>resolve(window.html2canvas);s.onerror=reject;document.head.appendChild(s);
    });
  }

  window.jdShareResults=async function(){
    const pane=[...document.querySelectorAll('.jrYearPane')].find(el=>el.style.display!=='none'&&!el.hidden)||document.querySelector('.jrYearPane');
    if(!pane)return toast('No hay resultados para compartir');
    const year=pane.dataset.jrYear||'Jumpdance';
    toast('Preparando imagen...');
    try{
      const html2canvas=await loadHtml2Canvas();
      const canvas=await html2canvas(pane,{backgroundColor:'#080711',scale:2,useCORS:true,logging:false});
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.96));
      if(!blob)throw new Error('No se pudo crear la imagen');
      const file=new File([blob],`Jumpdance-resultados-${year}.png`,{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        await navigator.share({title:`Resultados Jumpdance ${year}`,text:`Resultados Jumpdance ${year}`,files:[file]});
        return;
      }
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Imagen de resultados guardada');
    }catch(err){console.error(err);toast('No se pudo crear la imagen para compartir')}
  };

  function enhanceResultsShare(){
    if((location.hash.slice(1)||'home')!=='results')return;
    if(document.querySelector('.jdResultsShareBtn'))return;
    const header=document.querySelector('.jrResultsHeader');
    if(header)header.insertAdjacentHTML('afterend','<button class="btn secondary jdResultsShareBtn" type="button" onclick="jdShareResults()">📤 COMPARTIR RESULTADO COMO IMAGEN</button>');
  }

  function renderProgramRoute(){
    document.querySelectorAll('.bottomNav [data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route==='register'));
    return window.program().then(html=>{document.getElementById('app').innerHTML=html});
  }

  window.render=async function renderV42(){
    const r=location.hash.slice(1)||'home';
    if(r==='program'){
      await renderProgramRoute();
      window.scrollTo({top:0,left:0,behavior:'auto'});
      return;
    }
    const result=await baseRender.apply(this,arguments);
    const form=document.getElementById('regForm');
    if(form)form.onsubmit=submitRegistrationV42;
    injectParticipantAccount();
    bindParticipantLookup();
    await enhanceAdmin();
    enhanceResultsShare();
    return result;
  };

  if((location.hash.slice(1)||'home')==='program')setTimeout(()=>window.render?.(),0);
})();
