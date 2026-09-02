(() => {
  let activeTab='photos';
  let activeYear=null;

  const baseOpenAdminModule=window.openAdminModule;
  const baseLoadAdminPhotos=window.loadAdminPhotos;
  const baseLoadAdminVideos=window.loadAdminVideos;
  const baseUploadAdminMedia=window.uploadAdminMedia;

  const canMedia=()=>!!(window.JD_ADMIN_ACCESS?.is_owner||window.JD_ADMIN_ACCESS?.permissions?.media);

  function ensureStyles(){
    if(document.getElementById('jdAdminMediaTabsStyle'))return;
    const style=document.createElement('style');
    style.id='jdAdminMediaTabsStyle';
    style.textContent=`
      .jdMediaSwitch{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0 18px}
      .jdMediaSwitch button{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;border-radius:16px;padding:14px 10px;font-weight:800;font-size:16px}
      .jdMediaSwitch button.active{background:linear-gradient(135deg,rgba(240,90,166,.28),rgba(132,92,246,.22));border-color:rgba(240,90,166,.55);box-shadow:0 8px 24px rgba(0,0,0,.18)}
      .jdMediaAdminPanel[hidden]{display:none!important}
      .jdPhotoYearTabs{display:flex;gap:8px;overflow-x:auto;padding:4px 0 12px;margin:4px 0 8px;scrollbar-width:none}
      .jdPhotoYearTabs::-webkit-scrollbar{display:none}
      .jdPhotoYearTabs button{flex:0 0 auto;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:inherit;border-radius:999px;padding:10px 15px;font-weight:800}
      .jdPhotoYearTabs button.active{background:#f05aa6;color:#fff;border-color:#f05aa6}
      .jdMediaUploadCard{margin-bottom:16px}
      .jdMediaUploadCard .field:last-of-type{margin-bottom:10px}
      .jdMediaSelectedCount{margin-top:7px;font-size:13px;opacity:.76}
      .jdMediaSelectedCount.hasFiles{opacity:1;font-weight:700}
    `;
    document.head.appendChild(style);
  }

  function yearOptions(selected='2026'){
    const now=new Date().getFullYear();
    const max=Math.max(2030,now+2);
    const years=[];
    for(let y=max;y>=2015;y--)years.push(String(y));
    return years.map(y=>`<option value="${y}" ${y===String(selected)?'selected':''}>Jumpdance ${y}</option>`).join('');
  }

  function bindPhotoCount(){
    const input=document.getElementById('adminPhoto');
    const out=document.getElementById('jdMediaPhotoSelectedCount');
    if(!input||!out)return;
    const update=()=>{
      const n=input.files?.length||0;
      out.textContent=n?`${n} ${n===1?'foto seleccionada':'fotos seleccionadas'}`:'Ninguna foto seleccionada';
      out.classList.toggle('hasFiles',n>0);
    };
    input.addEventListener('change',update);
    update();
  }

  function renderMediaShell(){
    const section=document.getElementById('aMedia');
    if(!section||!canMedia())return false;
    if(section.dataset.jdMediaTabsReady==='1')return true;

    const preferredYear=activeYear||'2026';
    section.dataset.jdMediaTabsReady='1';
    section.innerHTML=`
      <button class="adminBack" type="button" onclick="showAdminDashboard()">← Panel</button>
      <div class="sectionTitle"><h2>📸🎬 Fotos y videos</h2></div>
      <div class="jdMediaSwitch" role="tablist" aria-label="Fotos o videos">
        <button id="jdMediaPhotosTab" type="button" onclick="jdAdminMediaTab('photos')">📸 Fotos</button>
        <button id="jdMediaVideosTab" type="button" onclick="jdAdminMediaTab('videos')">🎬 Videos</button>
      </div>

      <div id="jdMediaPhotosPanel" class="jdMediaAdminPanel">
        <div class="card form jdMediaUploadCard">
          <div class="field"><label>Año del evento</label><select id="adminPhotoYear">${yearOptions(preferredYear)}</select></div>
          <div class="field"><label>Subir una o varias fotos</label><input id="adminPhoto" type="file" accept="image/*" multiple><div id="jdMediaPhotoSelectedCount" class="jdMediaSelectedCount"></div></div>
          <button class="btn" type="button" data-jd-batch-photo-button="1" onclick="uploadAdminMedia('Photos','adminPhoto')">📸 PUBLICAR FOTOS</button>
          <div id="jdBatchPhotoProgress" class="jdBatchPhotoProgress"></div>
        </div>
        <div class="sectionTitle"><h3>📸 Organizar fotos</h3></div>
        <div id="adminPhotosDeleteList" class="list"><div class="card muted">Cargando fotos...</div></div>
      </div>

      <div id="jdMediaVideosPanel" class="jdMediaAdminPanel" hidden>
        <div class="card form jdMediaUploadCard">
          <div class="field"><label>Subir video</label><input id="adminVideo" type="file" accept="video/*"></div>
          <button class="btn" type="button" onclick="uploadAdminMedia('Videos','adminVideo')">🎬 PUBLICAR VIDEO</button>
        </div>
        <div class="sectionTitle"><h3>🎬 Videos publicados</h3></div>
        <div id="adminVideosDeleteList" class="list"><div class="card muted">Cargando videos...</div></div>
      </div>`;

    bindPhotoCount();
    return true;
  }

  function decoratePhotoYears(){
    const host=document.getElementById('adminPhotosDeleteList');
    if(!host)return;
    host.querySelector('.jdPhotoYearTabs')?.remove();
    const sections=[...host.querySelectorAll('.jdPhotoManageYear')];
    if(!sections.length)return;

    const years=sections.map(s=>s.querySelector('.jdPhotoManageGrid')?.dataset.year).filter(Boolean);
    if(!years.length)return;
    if(!activeYear||!years.includes(activeYear))activeYear=years[0];

    const tabs=document.createElement('div');
    tabs.className='jdPhotoYearTabs';
    tabs.innerHTML=years.map(year=>`<button type="button" data-year="${esc(year)}" onclick="jdShowAdminPhotoYear('${esc(year)}')">${esc(year)}</button>`).join('');

    const intro=host.querySelector('.jdPhotoManageIntro');
    if(intro)intro.insertAdjacentElement('afterend',tabs);else host.prepend(tabs);
    window.jdShowAdminPhotoYear(activeYear);
  }

  window.jdShowAdminPhotoYear=function(year){
    activeYear=String(year||'');
    const host=document.getElementById('adminPhotosDeleteList');
    if(!host)return;
    host.querySelectorAll('.jdPhotoYearTabs button').forEach(btn=>btn.classList.toggle('active',btn.dataset.year===activeYear));
    host.querySelectorAll('.jdPhotoManageYear').forEach(section=>{
      const y=section.querySelector('.jdPhotoManageGrid')?.dataset.year||'';
      section.hidden=y!==activeYear;
    });
  };

  window.jdAdminMediaTab=async function(tab){
    activeTab=tab==='videos'?'videos':'photos';
    if(!renderMediaShell())return;
    const photos=document.getElementById('jdMediaPhotosPanel');
    const videos=document.getElementById('jdMediaVideosPanel');
    if(photos)photos.hidden=activeTab!=='photos';
    if(videos)videos.hidden=activeTab!=='videos';
    document.getElementById('jdMediaPhotosTab')?.classList.toggle('active',activeTab==='photos');
    document.getElementById('jdMediaVideosTab')?.classList.toggle('active',activeTab==='videos');

    if(activeTab==='photos')await window.loadAdminPhotos?.();
    else await window.loadAdminVideos?.();
  };

  if(typeof baseLoadAdminPhotos==='function'){
    window.loadAdminPhotos=async function(){
      const result=await baseLoadAdminPhotos.apply(this,arguments);
      decoratePhotoYears();
      return result;
    };
  }

  if(typeof baseLoadAdminVideos==='function'){
    window.loadAdminVideos=async function(){
      return await baseLoadAdminVideos.apply(this,arguments);
    };
  }

  if(typeof baseUploadAdminMedia==='function'){
    window.uploadAdminMedia=async function(bucket,inputId){
      if(bucket==='Photos'&&inputId==='adminPhoto'){
        const y=document.getElementById('adminPhotoYear')?.value;
        if(y)activeYear=String(y);
      }
      const result=await baseUploadAdminMedia.apply(this,arguments);
      if(bucket==='Photos')decoratePhotoYears();
      return result;
    };
  }

  if(typeof baseOpenAdminModule==='function'){
    window.openAdminModule=function(id){
      const result=baseOpenAdminModule.apply(this,arguments);
      if(id==='aMedia'){
        renderMediaShell();
        window.jdAdminMediaTab(activeTab);
      }
      return result;
    };
  }

  ensureStyles();
  if((location.hash.slice(1)||'')==='admin'&&document.getElementById('aMedia')){
    renderMediaShell();
  }
})();
