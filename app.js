const cfg=window.JD_CONFIG;
const sb=supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const app=document.getElementById('app');

function toast(t){const e=document.getElementById('toast');e.textContent=t;e.className='toastshow';setTimeout(()=>e.className='',2300)}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function route(r){location.hash=r;render()}
function closeDrawer(){document.getElementById('drawer').classList.add('hidden')}
document.getElementById('menuBtn').onclick=()=>document.getElementById('drawer').classList.remove('hidden');
window.addEventListener('hashchange',render);

function qcard(cls,ico,title,desc,r){return `<button class="quickCard ${cls}" onclick="route('${r}')"><span class="ico">${ico}</span><h3>${title}</h3><p>${desc}</p></button>`}

const EVENT_SETTINGS_TITLE='__JUMPDANCE_EVENT_SETTINGS__';
const DEFAULT_EVENT_SETTINGS={
  date:'20 DE SEPTIEMBRE 2026',
  place:'ESCUELA N°732 DEL BARRIO LAPRIDA',
  cover_image:null
};

async function getEventSettings(){
  try{
    const {data,error}=await sb.from('posts')
      .select('body,created_at')
      .eq('title',EVENT_SETTINGS_TITLE)
      .order('created_at',{ascending:false})
      .limit(1);
    if(error||!data?.length)return DEFAULT_EVENT_SETTINGS;
    const parsed=JSON.parse(data[0].body||'{}');
    return {
      date:parsed.date||DEFAULT_EVENT_SETTINGS.date,
      place:parsed.place||DEFAULT_EVENT_SETTINGS.place,
      cover_image:parsed.cover_image||null
    };
  }catch(e){
    console.warn('No se pudieron leer los datos del evento',e);
    return DEFAULT_EVENT_SETTINGS;
  }
}

async function saveEventSettings(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const current=await getEventSettings();
  let cover_image=current.cover_image||null;

  const file=document.getElementById('eventCoverImage')?.files?.[0];
  if(file){
    if(!file.type.startsWith('image/'))return toast('Elegí una imagen válida');
    if(file.size>12*1024*1024)return toast('La portada no puede superar 12 MB');
    const safe=`cover_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const {error:upErr}=await sb.storage.from('Photos').upload(safe,file,{upsert:false,contentType:file.type});
    if(upErr){console.error(upErr);return toast('No se pudo subir la portada')}
    cover_image=safe;
  }

  const payload={
    date:String(f.get('event_date')||'').trim(),
    place:String(f.get('event_place')||'').trim(),
    cover_image
  };
  if(!payload.date||!payload.place)return toast('Completá fecha y lugar');

  const {error}=await sb.from('posts').insert({
    title:EVENT_SETTINGS_TITLE,
    body:JSON.stringify(payload),
    image_path:null,
    published:true
  });
  if(error){console.error(error);return toast('No se pudieron guardar los datos')}
  toast('Portada actualizada');
  render();
}

async function removeEventCover(){
  if(!confirm('¿Quitar la imagen personalizada de la portada?'))return;
  const current=await getEventSettings();
  const payload={date:current.date,place:current.place,cover_image:null};
  const {error}=await sb.from('posts').insert({
    title:EVENT_SETTINGS_TITLE,
    body:JSON.stringify(payload),
    image_path:null,
    published:true
  });
  if(error)return toast('No se pudo quitar la portada');
  toast('Imagen de portada quitada');
  render();
}


const SPONSOR_TITLE='__JUMPDANCE_SPONSOR__';

async function addSponsorMinimal(e){
  e.preventDefault();
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId)return toast('Solo el administrador puede cargar sponsors');

  const f=new FormData(e.target);
  const name=String(f.get('sponsor_name')||'').trim();
  const image=String(f.get('sponsor_image')||'').trim();
  if(!name)return toast('Escribí el nombre del sponsor');

  const body=JSON.stringify({name,image});
  const {error}=await sb.from('posts').insert({
    title:SPONSOR_TITLE,
    body,
    image_path:null,
    published:true
  });
  if(error){console.error(error);return toast('No se pudo guardar el sponsor')}

  toast('Sponsor publicado');
  e.target.reset();
  render();
}

async function deleteSponsorMinimal(id){
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId)return toast('Solo el administrador puede eliminar sponsors');
  if(!confirm('¿Eliminar este sponsor?'))return;
  const {error}=await sb.from('posts').delete().eq('id',id);
  if(error){console.error(error);return toast('No se pudo eliminar el sponsor')}
  toast('Sponsor eliminado');
  render();
}


const RESULT_TITLE='__JUMPDANCE_RESULT__';

function parseResult(body){
  try{
    const o=JSON.parse(body||'{}');
    return {
      year:String(o.year||'').trim(),
      position:String(o.position||'').trim(),
      participant:String(o.participant||'').trim(),
      academy:String(o.academy||'').trim(),
      category:String(o.category||'').trim(),
      discipline:String(o.discipline||'').trim(),
      note:String(o.note||'').trim()
    };
  }catch{
    return {year:'',position:'',participant:'',academy:'',category:'',discipline:'',note:''};
  }
}

async function getAllResults(){
  const {data,error}=await sb.from('posts')
    .select('id,body,created_at')
    .eq('title',RESULT_TITLE)
    .eq('published',true)
    .order('created_at',{ascending:false});
  if(error){console.error(error);return []}
  return (data||[]).map(r=>({id:r.id,...parseResult(r.body)}));
}

async function addResultMultiYear(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const payload={
    year:String(f.get('result_year')||'').trim(),
    position:String(f.get('result_position')||'').trim(),
    participant:String(f.get('result_participant')||'').trim(),
    academy:String(f.get('result_academy')||'').trim(),
    category:String(f.get('result_category')||'').trim(),
    discipline:String(f.get('result_discipline')||'').trim(),
    note:String(f.get('result_note')||'').trim()
  };
  if(!payload.year||!payload.position||!payload.participant){
    return toast('Completá año, puesto y participante');
  }

  const {error}=await sb.from('posts').insert({
    title:RESULT_TITLE,
    body:JSON.stringify(payload),
    image_path:null,
    published:true
  });
  if(error){console.error(error);return toast('No se pudo guardar el resultado')}

  toast('Resultado agregado');
  const year=payload.year;
  e.target.reset();
  e.target.querySelector('[name="result_year"]').value=year;
  await renderAdminResultsMultiYear();
}

async function deleteResultMultiYear(id){
  if(!confirm('¿Eliminar este resultado?'))return;
  const {error}=await sb.from('posts').delete().eq('id',id).eq('title',RESULT_TITLE);
  if(error){console.error(error);return toast('No se pudo eliminar')}
  toast('Resultado eliminado');
  await renderAdminResultsMultiYear();
}

async function editResultMultiYear(id){
  const {data,error}=await sb.from('posts').select('id,body').eq('id',id).eq('title',RESULT_TITLE).single();
  if(error||!data)return toast('No se pudo cargar el resultado');
  const o=parseResult(data.body);

  const year=prompt('Año',o.year); if(year===null)return;
  const position=prompt('Puesto',o.position); if(position===null)return;
  const participant=prompt('Participante / grupo',o.participant); if(participant===null)return;
  const academy=prompt('Academia',o.academy); if(academy===null)return;
  const category=prompt('Categoría',o.category); if(category===null)return;
  const discipline=prompt('Disciplina',o.discipline); if(discipline===null)return;
  const note=prompt('Observación',o.note); if(note===null)return;

  const payload={year,position,participant,academy,category,discipline,note};
  const {error:upErr}=await sb.from('posts').update({body:JSON.stringify(payload)}).eq('id',id).eq('title',RESULT_TITLE);
  if(upErr){console.error(upErr);return toast('No se pudo editar')}
  toast('Resultado actualizado');
  await renderAdminResultsMultiYear();
}

async function renderAdminResultsMultiYear(){
  const el=document.getElementById('adminResultsMultiYear');
  if(!el)return;

  const rows=await getAllResults();
  if(!rows.length){
    el.innerHTML='<div class="card muted">Todavía no hay resultados cargados.</div>';
    return;
  }

  const grouped={};
  rows.forEach(r=>{
    const year=r.year||'Sin año';
    if(!grouped[year])grouped[year]=[];
    grouped[year].push(r);
  });

  const years=Object.keys(grouped).sort((a,b)=>(Number(b)||0)-(Number(a)||0));
  let h='';

  years.forEach(year=>{
    h+=`<div class="card">
      <h3 style="margin-bottom:12px">🏆 ${esc(year)}</h3>
      <div class="list">`;

    grouped[year].forEach(r=>{
      h+=`<div class="card">
        <div style="font-size:19px"><b>${esc(r.position)}</b> — ${esc(r.participant)}</div>
        ${r.academy?`<div class="muted">${esc(r.academy)}</div>`:''}
        ${r.category||r.discipline?`<div class="muted">${esc([r.category,r.discipline].filter(Boolean).join(' · '))}</div>`:''}
        ${r.note?`<div class="muted">${esc(r.note)}</div>`:''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn secondary" onclick="editResultMultiYear('${esc(r.id)}')">✏️ EDITAR</button>
          <button class="btn danger" onclick="deleteResultMultiYear('${esc(r.id)}')">🗑️ ELIMINAR</button>
        </div>
      </div>`;
    });

    h+=`</div></div>`;
  });

  el.innerHTML=h;
}

async function results(){
  const rows=await getAllResults();
  let h=`<div class="sectionTitle"><h2>🏆 Resultados</h2></div>`;

  if(!rows.length){
    return h+`<div class="card muted">Todavía no hay resultados publicados.</div>`;
  }

  const grouped={};
  rows.forEach(r=>{
    const year=r.year||'Sin año';
    if(!grouped[year])grouped[year]=[];
    grouped[year].push(r);
  });

  const years=Object.keys(grouped).sort((a,b)=>(Number(b)||0)-(Number(a)||0));

  h+=`<div class="resultYearTabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">`;
  years.forEach((year,i)=>{
    h+=`<button class="btn ${i?'secondary':''}" onclick="showResultYear('${esc(year)}',this)">${esc(year)}</button>`;
  });
  h+=`</div>`;

  years.forEach((year,i)=>{
    h+=`<section class="resultYearSection" data-year="${esc(year)}" style="${i?'display:none':''}">
      <div class="card"><h2>🏆 ${esc(year)}</h2></div>
      <div class="list">`;

    grouped[year].forEach(r=>{
      h+=`<div class="card">
        <div style="font-size:20px"><b>${esc(r.position)}</b> — ${esc(r.participant)}</div>
        ${r.academy?`<div class="muted">${esc(r.academy)}</div>`:''}
        ${r.category||r.discipline?`<div class="muted">${esc([r.category,r.discipline].filter(Boolean).join(' · '))}</div>`:''}
        ${r.note?`<div style="margin-top:8px">${esc(r.note)}</div>`:''}
      </div>`;
    });

    h+=`</div></section>`;
  });

  return h;
}

function showResultYear(year,btn){
  document.querySelectorAll('.resultYearSection').forEach(s=>{
    s.style.display=s.dataset.year===year?'block':'none';
  });
  document.querySelectorAll('.resultYearTabs .btn').forEach(b=>b.classList.add('secondary'));
  if(btn)btn.classList.remove('secondary');
}


const NEWS_TITLE='__JUMPDANCE_NEWS__';

async function addNewsAdmin(e){
  e.preventDefault();
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId)return toast('Solo el administrador puede publicar novedades');

  const f=new FormData(e.target);
  const title=String(f.get('news_title')||'').trim();
  const body=String(f.get('news_body')||'').trim();
  if(!title||!body)return toast('Completá título y contenido');

  const {error}=await sb.from('posts').insert({
    title:NEWS_TITLE,
    body:JSON.stringify({title,body}),
    image_path:null,
    published:true
  });
  if(error){console.error(error);return toast('No se pudo publicar la novedad')}

  toast('Novedad publicada');
  e.target.reset();
  await renderAdminNews();
}

async function deleteNewsAdmin(id){
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId)return toast('Solo el administrador puede eliminar novedades');
  if(!confirm('¿Eliminar esta novedad?'))return;

  const {error}=await sb.from('posts').delete().eq('id',id).eq('title',NEWS_TITLE);
  if(error){console.error(error);return toast('No se pudo eliminar')}
  toast('Novedad eliminada');
  await renderAdminNews();
}

async function editNewsAdmin(id){
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId)return toast('Solo el administrador puede editar novedades');

  const {data,error}=await sb.from('posts').select('id,body').eq('id',id).eq('title',NEWS_TITLE).single();
  if(error||!data)return toast('No se pudo cargar la novedad');

  let o={title:'',body:''};
  try{o={...o,...JSON.parse(data.body||'{}')}}catch{}

  const title=prompt('Título',o.title||''); if(title===null)return;
  const body=prompt('Contenido',o.body||''); if(body===null)return;

  const {error:upErr}=await sb.from('posts')
    .update({body:JSON.stringify({title,body})})
    .eq('id',id)
    .eq('title',NEWS_TITLE);

  if(upErr){console.error(upErr);return toast('No se pudo editar')}
  toast('Novedad actualizada');
  await renderAdminNews();
}

async function renderAdminNews(){
  const el=document.getElementById('adminNewsList');
  if(!el)return;

  const {data,error}=await sb.from('posts')
    .select('id,body,created_at')
    .eq('title',NEWS_TITLE)
    .order('created_at',{ascending:false});

  if(error){
    console.error(error);
    el.innerHTML='<div class="card muted">No se pudieron cargar las novedades.</div>';
    return;
  }

  if(!data?.length){
    el.innerHTML='<div class="card muted">Todavía no hay novedades cargadas.</div>';
    return;
  }

  el.innerHTML=data.map(n=>{
    let o={title:'Novedad',body:''};
    try{o={...o,...JSON.parse(n.body||'{}')}}catch{}
    return `<div class="card">
      <h3>${esc(o.title)}</h3>
      <p>${esc(o.body)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn secondary" onclick="editNewsAdmin('${esc(n.id)}')">✏️ EDITAR</button>
        <button class="btn danger" onclick="deleteNewsAdmin('${esc(n.id)}')">🗑️ ELIMINAR</button>
      </div>
    </div>`;
  }).join('');
}

async function home(){
  const eventSettings=await getEventSettings();
  const coverUrl=eventSettings.cover_image
    ? sb.storage.from('Photos').getPublicUrl(eventSettings.cover_image).data.publicUrl
    : 'jumpdance-home-reference.png';

  return `<section class="heroCard editableHero">
    <img class="editableHeroImg" src="${esc(coverUrl)}" alt="Portada Jumpdance">
    <div class="editableHeroInfo">
      <div class="infoPill">📅 ${esc(eventSettings.date)}</div>
      <div class="infoPill">📍 ${esc(eventSettings.place)}</div>
      <button class="cta" onclick="route('register')">INSCRIBIRME</button>
    </div>
  </section>
  <section class="quickGrid">
   ${qcard('pink','📝','INSCRIPCIONES','Formulario y carga privada de música','register')}
   ${qcard('purple','🎵','MÚSICAS','Solo visibles para administración','admin')}
   ${qcard('blue','👥','PARTICIPANTES','Información del evento','participants')}
   ${qcard('gold','🖼️','FOTOS','Galería de ediciones y del evento','photos')}
   ${qcard('blue','🎬','VIDEOS','Presentaciones, resúmenes y más','videos')}
   ${qcard('purple','📣','NOVEDADES','Noticias, información y publicidad','news')}
   ${qcard('pink','🏆','RESULTADOS','Premiaciones y resultados','results')}
   ${qcard('gold','⭐','SPONSORS','Agradecemos a nuestros sponsors','sponsors')}
  </section>
  <section class="winnerBanner"><div class="cup">🏆</div><div><strong>¿QUIÉN SERÁ EL GANADOR DE <span style="color:#ff43a8">JUMPDANCE</span> ESTE AÑO?</strong><div class="muted" style="margin-top:5px">Seguinos y enterate de todas las novedades.</div></div><div style="font-size:48px">💃</div></section>
  <div class="sectionTitle"><h2>💬 Mensajes de la comunidad</h2><button class="btn secondary" onclick="route('messages')">Ver / escribir</button></div>
  <div id="homeMessages" class="list"><div class="card muted">Cargando mensajes...</div></div>`;
}

function register(){return `<div class="sectionTitle"><h2>📝 Inscripción</h2></div>
<div class="warning"><b>La música queda privada.</b> Los demás concursantes no pueden verla ni escucharla.</div>
<form id="regForm" class="card form" style="margin-top:10px">
<div class="field"><label>Nombre del grupo / participante *</label><input name="name" required></div>
<div class="row"><div class="field"><label>Categoría *</label><input name="category" required placeholder="Ej.: Infantil, Juvenil, Mayores..."></div><div class="field"><label>Disciplina *</label><input name="discipline" required placeholder="Ej.: Hip Hop, Jazz, Danza libre..."></div></div>
<p class="muted" style="margin:0">Cada participante o academia puede escribir libremente su categoría y disciplina.</p>
<div class="row"><div class="field"><label>Academia / Escuela</label><input name="academy"></div><div class="field"><label>Cantidad de participantes *</label><input name="participant_count" type="number" min="1" step="1" required placeholder="Ej.: 8"></div></div>
<div class="field"><label>Responsable / contacto *</label><input name="contact" required></div>
<div class="row"><div class="field"><label>WhatsApp</label><input name="phone"></div><div class="field"><label>Email</label><input name="email" type="email"></div></div>
<label class="upload"><b>🎵 Música de la presentación *</b><p class="muted">MP3/WAV/M4A. Máximo recomendado: 50 MB.</p><input id="musicFile" type="file" accept="audio/*,.mp3,.wav,.m4a" required></label>
<button class="btn" type="submit">ENVIAR INSCRIPCIÓN</button></form><div id="result"></div>`}

async function submitRegistration(e){
 e.preventDefault();
 const f=new FormData(e.target),file=document.getElementById('musicFile').files[0];
 if(!file)return toast('Seleccioná la música');
 if(file.size>50*1024*1024)return toast('Máximo 50 MB');
 const id=crypto.randomUUID();
 const row={id,name:f.get('name'),category:f.get('category'),discipline:f.get('discipline'),academy:f.get('academy')||null,participant_count:Number(f.get('participant_count')||1),contact:f.get('contact'),phone:f.get('phone')||null,email:f.get('email')||null,status:'pending'};
 let {error}=await sb.from('participants').insert(row);
 if(error){console.error(error);return toast('No se pudieron guardar los datos')}
 const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
 ({error}=await sb.storage.from(cfg.musicBucket).upload(`${id}/${Date.now()}_${safe}`,file,{upsert:false,contentType:file.type||'audio/mpeg'}));
 if(error){console.error(error);return toast('Datos guardados, pero falló la música')}
 e.target.style.display='none';
 document.getElementById('result').innerHTML=`<div class="success"><h3>✅ Inscripción enviada</h3><p>Número: <b>${id.slice(0,8).toUpperCase()}</b></p><p>La música fue cargada de forma privada.</p></div>`;
}

async function loadPublicBucket(bucket,type){
 const {data,error}=await sb.storage.from(bucket).list('',{limit:100,sortBy:{column:'created_at',order:'desc'}});
 if(error)return `<div class="card muted">Todavía no hay contenido.</div>`;
 if(!data?.length)return `<div class="card muted">Todavía no hay contenido.</div>`;
 return data.filter(f=>f.name!=='.emptyFolderPlaceholder').map(f=>{
  const u=sb.storage.from(bucket).getPublicUrl(f.name).data.publicUrl;
  return type==='video'?`<video controls preload="metadata" src="${esc(u)}"></video>`:`<img loading="lazy" src="${esc(u)}" alt="">`;
 }).join('');
}
async function photos(){return `<div class="sectionTitle"><h2>📸 Fotos</h2></div><div class="mediaGrid">${await loadPublicBucket('Photos','photo')}</div>`}
async function videos(){return `<div class="sectionTitle"><h2>🎬 Videos</h2></div><div class="mediaGrid">${await loadPublicBucket('Videos','video')}</div>`}

async function news(){
  const {data,error}=await sb.from('posts')
    .select('body,created_at')
    .eq('title',NEWS_TITLE)
    .eq('published',true)
    .order('created_at',{ascending:false});

  let h=`<div class="sectionTitle"><h2>📣 Novedades</h2></div>`;

  if(error||!data?.length){
    return h+`<div class="card muted">Todavía no hay novedades publicadas.</div>`;
  }

  for(const n of data){
    let o={title:'Novedad',body:''};
    try{o={...o,...JSON.parse(n.body||'{}')}}catch{}
    h+=`<div class="card"><h3>${esc(o.title)}</h3><p>${esc(o.body)}</p></div>`;
  }
  return h;
}

async function sponsors(){
  const {data,error}=await sb.from('posts').select('*').eq('title',SPONSOR_TITLE).eq('published',true).order('created_at',{ascending:false});
  let h=`<div class="sectionTitle"><h2>⭐ Sponsors</h2></div><div class="mediaGrid">`;
  if(error||!data?.length)return h+`<div class="card muted">Todavía no hay sponsors publicados.</div></div>`;
  for(const s of data){
    let o={name:'Sponsor',image:''};
    try{o={...o,...JSON.parse(s.body||'{}')}}catch{}
    h+=`<div class="card" style="text-align:center">
      ${o.image?`<img src="${esc(o.image)}" alt="${esc(o.name)}" style="width:100%;max-height:240px;object-fit:contain;border-radius:12px;background:#fff">`:''}
      <h3>${esc(o.name)}</h3>
    </div>`;
  }
  return h+`</div>`;
}
function participants(){return `<div class="card"><h2>👥 Participantes</h2><p class="muted">La organización administra las planillas de participantes. Por privacidad, esta sección pública no muestra datos personales.</p></div>`}

async function messages(){
 const {data}=await sb.from('public_messages').select('*').order('created_at',{ascending:false}).limit(100);
 let h=`<div class="sectionTitle"><h2>💬 Mensajes públicos</h2></div>
 <form id="msgForm" class="card form"><div class="field"><label>Tu nombre *</label><input name="display_name" maxlength="60" required></div><div class="field"><label>Mensaje *</label><textarea name="message" maxlength="500" required placeholder="Dejá tu mensaje para Jumpdance..."></textarea></div><button class="btn">PUBLICAR MENSAJE</button></form>
 <div class="sectionTitle"><h3>Muro de mensajes</h3></div><div class="list">`;
 for(const m of data||[])h+=`<div class="messageCard"><b>${esc(m.display_name)}</b><p>${esc(m.message)}</p></div>`;
 return h+(data?.length?'':'<div class="card muted">Todavía no hay mensajes.</div>')+`</div>`;
}
async function submitMessage(e){
 e.preventDefault();const f=new FormData(e.target);
 const {error}=await sb.from('public_messages').insert({display_name:f.get('display_name'),message:f.get('message')});
 if(error){console.error(error);return toast('No se pudo publicar')}
 toast('Mensaje publicado');render();
}
async function loadHomeMessages(){
 const el=document.getElementById('homeMessages');if(!el)return;
 const {data}=await sb.from('public_messages').select('*').order('created_at',{ascending:false}).limit(3);
 el.innerHTML=(data?.length?data.map(m=>`<div class="messageCard"><b>${esc(m.display_name)}</b><p>${esc(m.message)}</p></div>`).join(''):'<div class="card muted">Todavía no hay mensajes. ¡Sé el primero!</div>');
}

function adminLogin(){return `<div class="login card"><h2>🔐 Administrador</h2><form id="loginForm" class="form"><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Contraseña</label><input name="password" type="password" required></div><button class="btn">INICIAR SESIÓN</button></form></div>`}
function fmt(v){return v?esc(v):'<span class="muted">—</span>'}
function filterAdmin(){const q=(document.getElementById('adminSearch')?.value||'').toLowerCase();document.querySelectorAll('.adminCard').forEach(c=>c.style.display=(c.dataset.q||'').includes(q)?'block':'none')}
async function editParticipant(id){
 const {data:p,error}=await sb.from('participants').select('*').eq('id',id).single();if(error||!p)return toast('No se pudo abrir la inscripción');
 const name=prompt('Nombre del grupo / participante',p.name||'');if(name===null)return;
 const category=prompt('Categoría',p.category||'');if(category===null)return;
 const discipline=prompt('Disciplina',p.discipline||'');if(discipline===null)return;
 const academy=prompt('Academia / Escuela',p.academy||'');if(academy===null)return;
 const participant_count=prompt('Cantidad de participantes',p.participant_count||1);if(participant_count===null)return;
 const participantCountNum=Math.max(1,parseInt(participant_count,10)||1);
 const contact=prompt('Responsable / contacto',p.contact||'');if(contact===null)return;
 const phone=prompt('WhatsApp',p.phone||'');if(phone===null)return;
 const email=prompt('Email',p.email||'');if(email===null)return;
 const {error:upErr}=await sb.from('participants').update({name,category,discipline,academy:academy||null,participant_count:participantCountNum,contact,phone:phone||null,email:email||null}).eq('id',id);
 if(upErr)return toast('No se pudo editar');toast('Inscripción actualizada');render();
}
async function deleteParticipant(id,name){
 if(!confirm(`¿Eliminar la inscripción de "${name}"? También se eliminará su música.`))return;
 const {data:files}=await sb.storage.from(cfg.musicBucket).list(id,{limit:100});
 if(files?.length){const paths=files.map(f=>`${id}/${f.name}`);const {error}=await sb.storage.from(cfg.musicBucket).remove(paths);if(error)return toast('No se pudo eliminar la música')}
 const {error}=await sb.from('participants').delete().eq('id',id);if(error)return toast('No se pudo eliminar');toast('Inscripción eliminada');render();
}
async function uploadAdminMedia(bucket,inputId){
 const input=document.getElementById(inputId),file=input?.files?.[0];if(!file)return toast('Elegí un archivo');
 const safe=`${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
 const {error}=await sb.storage.from(bucket).upload(safe,file,{upsert:false,contentType:file.type});
 if(error){console.error(error);return toast('No se pudo subir')}
 toast('Contenido publicado');render();
}

async function deleteAdminMedia(bucket,path){
  if(!confirm('¿Seguro que querés eliminar este archivo?'))return;
  const {error}=await sb.storage.from(bucket).remove([path]);
  if(error){console.error(error);return toast('No se pudo eliminar')}
  toast('Archivo eliminado');
  render();
}

async function publishPost(e){
 e.preventDefault();const f=new FormData(e.target);
 let image_path=null;const file=document.getElementById('postImage')?.files?.[0];
 if(file){image_path=`${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const {error:up}=await sb.storage.from('Photos').upload(image_path,file,{upsert:false,contentType:file.type});if(up)return toast('No se pudo subir la imagen')}
 const {error}=await sb.from('posts').insert({title:f.get('title'),body:f.get('body'),image_path,published:true});
 if(error)return toast('No se pudo publicar');toast('Publicación creada');render();
}
async function addSponsorMinimal(e){
  e.preventDefault();

  const f=new FormData(e.target);
  const name=String(f.get('sponsor_name')||'').trim();
  const file=f.get('sponsor_image');

  if(!name)return toast('Ingresá el nombre del sponsor');
  if(!file || !file.size)return toast('Elegí una imagen o logo');

  if(!file.type.startsWith('image/')){
    return toast('El archivo debe ser una imagen');
  }

  if(file.size>12*1024*1024){
    return toast('La imagen es demasiado grande');
  }

  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`sponsors/${Date.now()}_${safeName}`;

  const {error:uploadError}=await sb.storage
    .from('Photos')
    .upload(path,file);

  if(uploadError){
    console.error(uploadError);
    return toast('No se pudo subir la imagen');
  }

  const {data:publicData}=sb.storage
    .from('Photos')
    .getPublicUrl(path);

  const image=publicData.publicUrl;

  const {error}=await sb.from('posts').insert({
    title:SPONSOR_TITLE,
    body:JSON.stringify({name,image}),
    published:true
  });

  if(error){
    console.error(error);
    return toast('No se pudo publicar el sponsor');
  }

  toast('Sponsor publicado');
  e.target.reset();
  render();
}
async function deleteMessage(id){
 if(!confirm('¿Eliminar este mensaje público?'))return;
 const {error}=await sb.from('public_messages').delete().eq('id',id);if(error)return toast('No se pudo eliminar');toast('Mensaje eliminado');render();
}
async function adminPanel(){
 const eventSettings=await getEventSettings();
 const {data:ps,error}=await sb.from('participants').select('*').order('created_at',{ascending:false});
 if(error)return `<div class="card">Error al leer inscripciones.</div>`;
 const {data:msgs}=await sb.from('public_messages').select('*').order('created_at',{ascending:false}).limit(100);
 let h=`<div class="adminbar"><div><h2>⚙️ Panel administrador</h2><p class="muted">Inscripciones, fotos, videos, publicaciones y mensajes</p></div><button class="btn secondary" onclick="logout()">Cerrar sesión</button></div>
 <div class="adminTabs"><button class="btn secondary" onclick="document.getElementById('aEvent').scrollIntoView()">Portada</button><button class="btn secondary" onclick="document.getElementById('aIns').scrollIntoView()">Inscripciones</button><button class="btn secondary" onclick="document.getElementById('aMedia').scrollIntoView()">Multimedia</button><button class="btn secondary" onclick="document.getElementById('aSponsors').scrollIntoView()">Sponsors</button><button class="btn secondary" onclick="document.getElementById('aResults').scrollIntoView()">Resultados</button><button class="btn secondary" onclick="document.getElementById('aNews').scrollIntoView()">Novedades</button><button class="btn secondary" onclick="document.getElementById('aPosts').scrollIntoView()">Publicaciones</button><button class="btn secondary" onclick="document.getElementById('aMsgs').scrollIntoView()">Mensajes</button></div>
 <section id="aEvent">
 <div class="sectionTitle"><h2>🖼️ Datos de la portada</h2></div>
 <form id="eventSettingsForm" class="card form">
   <div class="field"><label>Fecha del evento</label><input name="event_date" value="${esc(eventSettings.date)}" required></div>
   <div class="field"><label>Lugar del evento</label><input name="event_place" value="${esc(eventSettings.place)}" required></div>
   <div class="field">
     <label>Imagen de portada</label>
     <input id="eventCoverImage" type="file" accept="image/*">
     <p class="muted">Podés elegir cualquier imagen desde tu teléfono.</p>
   </div>
   ${eventSettings.cover_image?`<div class="coverAdminPreview"><img src="${esc(sb.storage.from('Photos').getPublicUrl(eventSettings.cover_image).data.publicUrl)}" alt="Portada actual"></div>`:''}
   <div style="display:flex;gap:8px;flex-wrap:wrap">
     <button class="btn" type="submit">GUARDAR PORTADA</button>
     ${eventSettings.cover_image?`<button class="btn danger" type="button" onclick="removeEventCover()">QUITAR IMAGEN</button>`:''}
   </div>
 </form>
 </section>
 <section id="aIns"><div class="card"><b>Total de inscripciones: ${(ps||[]).length}</b><div style="margin-top:6px"><b>Total de personas inscriptas: ${(ps||[]).reduce((sum,p)=>sum+(Number(p.participant_count)||1),0)}</b></div><div class="field" style="margin-top:10px"><input id="adminSearch" oninput="filterAdmin()" placeholder="Buscar participante, academia, categoría o disciplina"></div></div><div class="list">`;
 for(const p of ps||[]){
  const number=(p.id||'').slice(0,8).toUpperCase();const search=[p.name,p.academy,p.category,p.discipline,p.participant_count,p.contact,p.phone,p.email,number].filter(Boolean).join(' ').toLowerCase();
  h+=`<div class="card adminCard" data-q="${esc(search)}"><div class="item"><div class="avatar">${esc((p.name||'?')[0])}</div><div class="grow"><b style="font-size:20px">${esc(p.name||'Sin nombre')}</b><div class="muted">Inscripción: <b>${esc(number)}</b></div></div></div>
  <div style="margin-top:12px;line-height:1.8"><div><b>Categoría:</b> ${fmt(p.category)}</div><div><b>Disciplina:</b> ${fmt(p.discipline)}</div><div><b>Academia:</b> ${fmt(p.academy)}</div><div><b>Cantidad de participantes:</b> ${fmt(p.participant_count||1)}</div><div><b>Responsable:</b> ${fmt(p.contact)}</div><div><b>WhatsApp:</b> ${fmt(p.phone)}</div><div><b>Email:</b> ${fmt(p.email)}</div></div>`;
  const {data:files}=await sb.storage.from(cfg.musicBucket).list(p.id,{limit:20});
  for(const file of files||[]){const {data:signed}=await sb.storage.from(cfg.musicBucket).createSignedUrl(`${p.id}/${file.name}`,600);if(signed?.signedUrl)h+=`<div class="fileRow"><b>🎵 ${esc(file.name)}</b><audio class="audio" controls src="${esc(signed.signedUrl)}"></audio><a class="btn secondary" style="display:inline-block;text-decoration:none;margin-top:8px" href="${esc(signed.signedUrl)}" download>Descargar música</a></div>`}
  h+=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" onclick="editParticipant('${esc(p.id)}')">Editar</button><button class="btn danger" onclick="deleteParticipant('${esc(p.id)}','${esc(p.name||'')}')">Eliminar</button></div></div>`;
 }
 h+=`</div></section>
 <section id="aMedia"><div class="sectionTitle"><h2>📸🎬 Multimedia</h2></div>
 <div class="card form"><div class="field"><label>Subir foto</label><input id="adminPhoto" type="file" accept="image/*"></div><button class="btn" onclick="uploadAdminMedia('Photos','adminPhoto')">PUBLICAR FOTO</button>
 <div class="field"><label>Subir video</label><input id="adminVideo" type="file" accept="video/*"></div><button class="btn" onclick="uploadAdminMedia('Videos','adminVideo')">PUBLICAR VIDEO</button></div>
 <div class="sectionTitle"><h3>🗑️ Eliminar fotos</h3></div>
 <div id="adminPhotosDeleteList" class="list"><div class="card muted">Cargando fotos...</div></div><div class="sectionTitle"><h3>🗑️ Eliminar videos</h3></div><div id="adminVideosDeleteList" class="list"><div class="card muted">Cargando videos...</div></div>
 </section>

 <section id="aSponsors">
  <div class="sectionTitle"><h2>⭐ Sponsors</h2></div>
  <form id="sponsorFormMinimal" class="card form">
    <div class="field"><label>Nombre del sponsor *</label><input name="sponsor_name" required></div>
    <div class="field"><label>Logo / imagen del sponsor</label><input id="sponsorImageFile" name="sponsor_image" type="file" accept="image/*"></div>
    <button class="btn">PUBLICAR SPONSOR</button>
  </form>
  <div class="sectionTitle"><h3>Sponsors cargados</h3></div>
  <div id="adminSponsorsMinimal" class="list"></div>
 </section>

 <section id="aResults">
  <div class="sectionTitle"><h2>🏆 Resultados por año</h2></div>
  <form id="resultMultiYearForm" class="card form">
    <div class="row">
      <div class="field">
        <label>Año *</label>
        <input name="result_year" type="number" min="2000" max="2100" required placeholder="Ej.: 2024">
      </div>
      <div class="field">
        <label>Puesto *</label>
        <input name="result_position" required placeholder="Ej.: 1° Puesto">
      </div>
    </div>

    <div class="field"><label>Participante / grupo *</label><input name="result_participant" required></div>
    <div class="field"><label>Academia</label><input name="result_academy"></div>

    <div class="row">
      <div class="field"><label>Categoría</label><input name="result_category"></div>
      <div class="field"><label>Disciplina</label><input name="result_discipline"></div>
    </div>

    <div class="field"><label>Observación</label><textarea name="result_note" rows="3"></textarea></div>
    <button class="btn">AGREGAR RESULTADO</button>
    <p class="muted">Podés cargar todos los resultados de un año y después cambiar el año para seguir con otro.</p>
  </form>

  <div class="sectionTitle"><h3>Resultados cargados</h3></div>
  <div id="adminResultsMultiYear" class="list"><div class="card muted">Cargando resultados...</div></div>
 </section>

 <section id="aNews">
  <div class="sectionTitle"><h2>📣 Novedades</h2></div>
  <form id="newsForm" class="card form">
    <div class="field"><label>Título *</label><input name="news_title" required placeholder="Ej.: Inscripciones abiertas"></div>
    <div class="field"><label>Contenido *</label><textarea name="news_body" rows="5" required placeholder="Escribí la novedad..."></textarea></div>
    <button class="btn">PUBLICAR NOVEDAD</button>
  </form>
  <div class="sectionTitle"><h3>Novedades cargadas</h3></div>
  <div id="adminNewsList" class="list"><div class="card muted">Cargando novedades...</div></div>
 </section>
 <section id="aPosts"><div class="sectionTitle"><h2>📢 Nueva publicación</h2></div><form id="postForm" class="card form"><div class="field"><label>Título</label><input name="title" required></div><div class="field"><label>Texto</label><textarea name="body" required></textarea></div><div class="field"><label>Imagen opcional</label><input id="postImage" type="file" accept="image/*"></div><button class="btn">PUBLICAR</button></form></section>
 <section id="aMsgs"><div class="sectionTitle"><h2>💬 Mensajes públicos</h2></div><div class="list">`;
 for(const m of msgs||[])h+=`<div class="messageCard"><b>${esc(m.display_name)}</b><p>${esc(m.message)}</p><button class="btn danger" onclick="deleteMessage('${esc(m.id)}')">Eliminar mensaje</button></div>`;
 h+=`</div></section>`;
 return h;
}
async function admin(){const {data:{session}}=await sb.auth.getSession();if(!session)return adminLogin();if(session.user.id!==cfg.adminUserId){await sb.auth.signOut();return `<div class="card">Acceso no autorizado.</div>`}return await adminPanel()}
async function logout(){await sb.auth.signOut();render()}

async function render(){
 const r=location.hash.slice(1)||'home';
 document.querySelectorAll('.bottomNav [data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===r));
 const routes={home,register,photos,videos,news,results,sponsors,participants,messages};
 if(r==='admin')app.innerHTML=await admin(); else app.innerHTML=await (routes[r]||home)();
 if(r==='register')document.getElementById('regForm').onsubmit=submitRegistration;
 if(r==='messages')document.getElementById('msgForm').onsubmit=submitMessage;
 if(r==='home')loadHomeMessages();
 if(r==='admin'){
  if(document.getElementById('loginForm'))document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {data,error}=await sb.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error)return toast('Email o contraseña incorrectos');if(data.user.id!==cfg.adminUserId){await sb.auth.signOut();return toast('Cuenta no autorizada')}render()};
  if(document.getElementById('postForm'))document.getElementById('postForm').onsubmit=publishPost;
  if(document.getElementById('newsForm'))document.getElementById('newsForm').onsubmit=addNewsAdmin;
  if(document.getElementById('adminNewsList'))renderAdminNews();
  if(document.getElementById('resultMultiYearForm'))document.getElementById('resultMultiYearForm').onsubmit=addResultMultiYear;
  if(document.getElementById('adminResultsMultiYear'))renderAdminResultsMultiYear();
  if(document.getElementById('sponsorFormMinimal'))document.getElementById('sponsorFormMinimal').onsubmit=addSponsorMinimal;
  if(document.getElementById('adminSponsorsMinimal'))renderAdminSponsorsMinimal();
  if(document.getElementById('eventSettingsForm'))document.getElementById('eventSettingsForm').onsubmit=saveEventSettings;
  if(document.getElementById('adminPhotosDeleteList'))loadAdminPhotos();
  if(document.getElementById('adminVideosDeleteList'))loadAdminVideos();
  if(document.getElementById('adminPhotosList'))renderAdminMediaList('Photos','adminPhotosList');
  if(document.getElementById('adminVideosList'))renderAdminMediaList('Videos','adminVideosList');
 }
}
render();

async function renderAdminMediaList(bucket,targetId){
  const el=document.getElementById(targetId);
  if(!el)return;
  const {data,error}=await sb.storage.from(bucket).list('',{limit:200,sortBy:{column:'created_at',order:'desc'}});
  if(error){console.error(error);el.innerHTML='<div class="card muted">No se pudo cargar.</div>';return}
  if(!data?.length){el.innerHTML='<div class="card muted">No hay archivos.</div>';return}
  el.innerHTML=data.filter(x=>x.name).map(item=>{
    const url=sb.storage.from(bucket).getPublicUrl(item.name).data.publicUrl;
    const isVideo=/\.(mp4|webm|mov|m4v)$/i.test(item.name);
    return `<div class="card">
      ${isVideo?`<video src="${url}" controls style="width:100%;border-radius:12px"></video>`:`<img src="${url}" alt="" style="width:100%;border-radius:12px">`}
      <button class="btn danger" style="margin-top:10px" onclick="deleteAdminMedia('${bucket}','${item.name}')">🗑️ ELIMINAR</button>
    </div>`;
  }).join('');
}


async function deleteAdminPhoto(path){
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId){
    return toast('Solo el administrador puede eliminar fotos');
  }
  if(!confirm('¿Seguro que querés eliminar esta foto?'))return;
  const {error}=await sb.storage.from('Photos').remove([path]);
  if(error){console.error(error);return toast('No se pudo eliminar la foto')}
  toast('Foto eliminada');
  await loadAdminPhotos();
}


async function loadAdminPhotos(){
  const el=document.getElementById('adminPhotosDeleteList');
  if(!el)return;

  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId){
    el.innerHTML='<div class="card muted">Solo el administrador puede administrar fotos.</div>';
    return;
  }

  const {data,error}=await sb.storage.from('Photos').list('',{
    limit:100,
    sortBy:{column:'created_at',order:'desc'}
  });

  if(error){
    console.error(error);
    el.innerHTML='<div class="card muted">No se pudieron cargar las fotos.</div>';
    return;
  }

  const files=(data||[]).filter(x=>
    x.name &&
    x.name!=='.emptyFolderPlaceholder' &&
    /\.(png|jpe?g|webp|gif)$/i.test(x.name)
  );

  if(!files.length){
    el.innerHTML='<div class="card muted">No hay fotos para eliminar.</div>';
    return;
  }

  el.innerHTML=files.map(item=>{
    const url=sb.storage.from('Photos').getPublicUrl(item.name).data.publicUrl;
    const safeName=encodeURIComponent(item.name);
    return `<div class="card">
      <img src="${url}" alt="Foto" style="width:100%;border-radius:12px;display:block">
      <button class="btn danger" style="margin-top:10px;width:100%" onclick="deleteAdminPhoto(decodeURIComponent('${safeName}'))">🗑️ ELIMINAR FOTO</button>
    </div>`;
  }).join('');
}


async function renderAdminSponsorsMinimal(){
  const el=document.getElementById('adminSponsorsMinimal');
  if(!el)return;
  const {data,error}=await sb.from('posts').select('*').eq('title',SPONSOR_TITLE).order('created_at',{ascending:false});
  if(error){el.innerHTML='<div class="card muted">No se pudieron cargar los sponsors.</div>';return}
  if(!data?.length){el.innerHTML='<div class="card muted">Todavía no hay sponsors cargados.</div>';return}
  el.innerHTML=data.map(s=>{
    let o={name:'Sponsor',image:''};try{o={...o,...JSON.parse(s.body||'{}')}}catch{}
    return `<div class="card">
      ${o.image?`<img src="${esc(o.image)}" alt="${esc(o.name)}" style="width:100%;max-height:220px;object-fit:contain;border-radius:12px;background:#fff">`:''}
      <h3>${esc(o.name)}</h3>
      <button class="btn danger" onclick="deleteSponsorMinimal('${esc(s.id)}')">🗑️ ELIMINAR SPONSOR</button>
    </div>`;
  }).join('');
}

async function deleteAdminVideo(path){
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId){
    return toast('Solo el administrador puede eliminar videos');
  }
  if(!confirm('¿Seguro que querés eliminar este video?'))return;
  const {error}=await sb.storage.from('Videos').remove([path]);
  if(error){
    console.error(error);
    return toast('No se pudo eliminar el video');
  }
  toast('Video eliminado');
  await loadAdminVideos();
}

async function loadAdminVideos(){
  const el=document.getElementById('adminVideosDeleteList');
  if(!el)return;

  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.id!==cfg.adminUserId){
    el.innerHTML='<div class="card muted">Solo el administrador puede administrar videos.</div>';
    return;
  }

  const {data,error}=await sb.storage.from('Videos').list('',{
    limit:100,
    sortBy:{column:'created_at',order:'desc'}
  });

  if(error){
    console.error(error);
    el.innerHTML='<div class="card muted">No se pudieron cargar los videos.</div>';
    return;
  }

  const files=(data||[]).filter(x=>
    x.name &&
    x.name!=='.emptyFolderPlaceholder' &&
    /\.(mp4|webm|mov|m4v)$/i.test(x.name)
  );

  if(!files.length){
    el.innerHTML='<div class="card muted">No hay videos para eliminar.</div>';
    return;
  }

  el.innerHTML=files.map(item=>{
    const url=sb.storage.from('Videos').getPublicUrl(item.name).data.publicUrl;
    const safeName=encodeURIComponent(item.name);
    return `<div class="card">
      <video src="${url}" controls playsinline style="width:100%;border-radius:12px;display:block"></video>
      <button class="btn danger" style="margin-top:10px;width:100%" onclick="deleteAdminVideo(decodeURIComponent('${safeName}'))">🗑️ ELIMINAR VIDEO</button>
    </div>`;
  }).join('');
}
