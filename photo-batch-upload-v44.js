(() => {
  const baseUploadAdminMedia=window.uploadAdminMedia;
  const baseRender=window.render;
  const DEFAULT_YEAR='2026';

  const clean=v=>String(v??'').trim();
  const safeYear=v=>/^20\d{2}$/.test(clean(v))?clean(v):DEFAULT_YEAR;

  function ensureBatchUi(){
    const input=document.getElementById('adminPhoto');
    if(!input)return;

    input.multiple=true;
    input.setAttribute('multiple','');
    input.setAttribute('accept','image/*');

    const field=input.closest('.field');
    const label=field?.querySelector('label');
    if(label)label.textContent='Subir una o varias fotos';

    let help=field?.querySelector('.jdBatchPhotoHelp');
    if(!help){
      help=document.createElement('p');
      help.className='muted jdBatchPhotoHelp';
      help.textContent='Podés seleccionar varias fotos de la galería del teléfono y publicarlas juntas en el año elegido.';
      input.insertAdjacentElement('afterend',help);
    }

    let selected=field?.querySelector('.jdBatchPhotoSelected');
    if(!selected){
      selected=document.createElement('div');
      selected.className='jdBatchPhotoSelected';
      input.insertAdjacentElement('afterend',selected);
    }

    const updateSelected=()=>{
      const count=input.files?.length||0;
      selected.textContent=count?`${count} ${count===1?'foto seleccionada':'fotos seleccionadas'}`:'Ninguna foto seleccionada';
      selected.classList.toggle('hasFiles',count>0);
    };

    if(input.dataset.jdBatchReady!=='1'){
      input.dataset.jdBatchReady='1';
      input.addEventListener('change',updateSelected);
    }
    updateSelected();

    const panel=input.closest('#aMedia')||document.getElementById('aMedia');
    const publishButton=[...(panel?.querySelectorAll('button')||[])].find(b=>(b.getAttribute('onclick')||'').includes("uploadAdminMedia('Photos','adminPhoto')"));
    if(publishButton){
      publishButton.textContent='📸 PUBLICAR FOTOS';
      publishButton.dataset.jdBatchPhotoButton='1';
    }

    let progress=panel?.querySelector('#jdBatchPhotoProgress');
    if(!progress&&publishButton){
      progress=document.createElement('div');
      progress.id='jdBatchPhotoProgress';
      progress.className='jdBatchPhotoProgress';
      publishButton.insertAdjacentElement('afterend',progress);
    }
  }

  async function nextOrderPosition(year){
    const {data,error}=await sb.from('photo_order')
      .select('position')
      .eq('year',year)
      .order('position',{ascending:false})
      .limit(1);
    if(error){console.warn(error);return 0}
    const last=Number(data?.[0]?.position);
    return Number.isFinite(last)?last+1:0;
  }

  window.uploadAdminMedia=async function uploadAdminMediaV44(bucket,inputId){
    if(bucket!=='Photos'||inputId!=='adminPhoto')return baseUploadAdminMedia?.apply(this,arguments);

    const input=document.getElementById(inputId);
    const files=[...(input?.files||[])];
    if(!files.length)return toast('Elegí una o varias fotos');

    const invalid=files.filter(file=>!String(file.type||'').startsWith('image/'));
    if(invalid.length)return toast('La selección contiene un archivo que no es una imagen');

    const year=safeYear(document.getElementById('adminPhotoYear')?.value||DEFAULT_YEAR);
    const panel=input.closest('#aMedia')||document.getElementById('aMedia');
    const button=panel?.querySelector('[data-jd-batch-photo-button="1"]')||[...(panel?.querySelectorAll('button')||[])].find(b=>(b.getAttribute('onclick')||'').includes("uploadAdminMedia('Photos','adminPhoto')"));
    const progress=panel?.querySelector('#jdBatchPhotoProgress');
    const originalText=button?.textContent||'📸 PUBLICAR FOTOS';

    if(button){button.disabled=true;button.textContent='PUBLICANDO...'}
    let position=await nextOrderPosition(year);
    let ok=0;
    let failed=0;

    for(let i=0;i<files.length;i++){
      const file=files[i];
      if(progress)progress.textContent=`Publicando ${i+1} de ${files.length}…`;
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_')||`foto_${i+1}.jpg`;
      const path=`${year}/${Date.now()}_${i}_${safe}`;
      const {error}=await sb.storage.from('Photos').upload(path,file,{upsert:false,contentType:file.type||'image/jpeg'});
      if(error){
        console.error('No se pudo publicar',file.name,error);
        failed++;
        continue;
      }

      ok++;
      const {error:orderError}=await sb.from('photo_order').upsert({
        path,
        year,
        position:position++,
        updated_at:new Date().toISOString()
      },{onConflict:'path'});
      if(orderError)console.warn('La foto se publicó, pero no se pudo registrar su orden',orderError);
    }

    input.value='';
    input.dispatchEvent(new Event('change'));
    if(button){button.disabled=false;button.textContent=originalText}

    if(progress){
      progress.textContent=failed?`${ok} publicadas · ${failed} no pudieron publicarse`:`✅ ${ok} ${ok===1?'foto publicada':'fotos publicadas'} en Jumpdance ${year}`;
      setTimeout(()=>{if(progress)progress.textContent=''},5000);
    }

    if(ok&&failed)toast(`${ok} fotos publicadas; ${failed} fallaron`);
    else if(ok)toast(`${ok} ${ok===1?'foto publicada':'fotos publicadas'} en Jumpdance ${year}`);
    else toast('No se pudo publicar ninguna foto');

    if(ok)await window.loadAdminPhotos?.();
  };

  window.render=async function renderV44(){
    const result=await baseRender?.apply(this,arguments);
    ensureBatchUi();
    return result;
  };

  ensureBatchUi();
})();