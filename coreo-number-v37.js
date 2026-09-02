(() => {
  const originalRegister=window.register;
  if(typeof originalRegister==='function'){
    window.register=function registerWithCoreoNumber(){
      const html=originalRegister.apply(this,arguments);
      const marker='<div class="row"><div class="field"><label>Categoría *';
      const coreoField='<div class="field"><label>Coreo N.º *</label><input name="coreo_number" type="number" min="1" step="1" inputmode="numeric" required placeholder="Ej.: 12"><p class="muted" style="margin:6px 0 0">Ingresá el número asignado a esta coreografía.</p></div>';
      return html.includes(marker)?html.replace(marker,coreoField+marker):html;
    };
  }

  window.submitRegistration=async function submitRegistrationWithCoreo(e){
    e?.preventDefault?.();
    const form=e?.currentTarget||e?.target||document.getElementById('regForm');
    if(!form)return;

    const f=new FormData(form);
    const file=document.getElementById('musicFile')?.files?.[0];
    const coreoNumber=Number.parseInt(String(f.get('coreo_number')||''),10);

    if(!Number.isInteger(coreoNumber)||coreoNumber<1)return toast('Ingresá un número de coreo válido');
    if(!file)return toast('Seleccioná la música');
    if(file.size>50*1024*1024)return toast('Máximo 50 MB');

    const id=crypto.randomUUID();
    const row={
      id,
      name:f.get('name'),
      coreo_number:coreoNumber,
      category:f.get('category'),
      discipline:f.get('discipline'),
      academy:f.get('academy')||null,
      participant_count:Number(f.get('participant_count')||1),
      contact:f.get('contact'),
      phone:f.get('phone')||null,
      email:f.get('email')||null,
      status:'pending'
    };

    let {error}=await sb.from('participants').insert(row);
    if(error){console.error(error);return toast('No se pudieron guardar los datos')}

    const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const storageName=`coreo_${coreoNumber}_${Date.now()}_${safe}`;
    ({error}=await sb.storage.from(cfg.musicBucket).upload(`${id}/${storageName}`,file,{upsert:false,contentType:file.type||'audio/mpeg'}));
    if(error){console.error(error);return toast('Datos guardados, pero falló la música')}

    form.style.display='none';
    const result=document.getElementById('result');
    if(result)result.innerHTML=`<div class="success"><h3>✅ Inscripción enviada</h3><p>Coreo N.º: <b>${coreoNumber}</b></p><p>Número de inscripción: <b>${id.slice(0,8).toUpperCase()}</b></p><p>La música fue cargada de forma privada.</p></div>`;
  };

  window.editParticipant=async function editParticipantWithCoreo(id){
    const {data:p,error}=await sb.from('participants').select('*').eq('id',id).single();
    if(error||!p)return toast('No se pudo abrir la inscripción');

    const coreoInput=prompt('Coreo N.º',p.coreo_number||'');
    if(coreoInput===null)return;
    const coreoNumber=Number.parseInt(String(coreoInput).trim(),10);
    if(!Number.isInteger(coreoNumber)||coreoNumber<1)return toast('Ingresá un número de coreo válido');

    const name=prompt('Nombre del grupo / participante',p.name||'');if(name===null)return;
    const category=prompt('Categoría',p.category||'');if(category===null)return;
    const discipline=prompt('Disciplina',p.discipline||'');if(discipline===null)return;
    const academy=prompt('Academia / Escuela',p.academy||'');if(academy===null)return;
    const participantCount=prompt('Cantidad de participantes',p.participant_count||1);if(participantCount===null)return;
    const participantCountNum=Math.max(1,parseInt(participantCount,10)||1);
    const contact=prompt('Responsable / contacto',p.contact||'');if(contact===null)return;
    const phone=prompt('WhatsApp',p.phone||'');if(phone===null)return;
    const email=prompt('Email',p.email||'');if(email===null)return;

    const {error:upErr}=await sb.from('participants').update({
      coreo_number:coreoNumber,
      name,
      category,
      discipline,
      academy:academy||null,
      participant_count:participantCountNum,
      contact,
      phone:phone||null,
      email:email||null
    }).eq('id',id);

    if(upErr){console.error(upErr);return toast('No se pudo editar')}
    toast('Inscripción actualizada');
    render();
  };

  function getCardParticipantId(card){
    const button=[...card.querySelectorAll('button')].find(b=>(b.getAttribute('onclick')||'').includes('editParticipant('));
    const match=(button?.getAttribute('onclick')||'').match(/editParticipant\('([^']+)'\)/);
    return match?.[1]||null;
  }

  function getExtension(fileName){
    const clean=String(fileName||'').trim().replace(/^🎵\s*/, '');
    const match=clean.match(/(\.[a-zA-Z0-9]{1,8})$/);
    return match?match[1].toLowerCase():'.mp3';
  }

  async function downloadAsCoreo(link,coreoNumber,fileName,event){
    event?.preventDefault?.();
    const targetName=`Coreo ${coreoNumber}${getExtension(fileName)}`;
    try{
      const response=await fetch(link.href);
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const blob=await response.blob();
      const objectUrl=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=objectUrl;
      a.download=targetName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
    }catch(err){
      console.error(err);
      link.setAttribute('download',targetName);
      window.open(link.href,'_blank','noopener');
      toast(`La música corresponde a Coreo ${coreoNumber}`);
    }
  }

  async function enhanceAdminCoreo(){
    if(location.hash!=='#admin')return;
    const cards=[...document.querySelectorAll('#aIns .adminCard')];
    if(!cards.length)return;

    const ids=cards.map(getCardParticipantId).filter(Boolean);
    if(!ids.length)return;

    const {data,error}=await sb.from('participants').select('id,coreo_number').in('id',ids);
    if(error){console.error(error);return;}
    const byId=new Map((data||[]).map(p=>[p.id,p.coreo_number]));

    for(const card of cards){
      const id=getCardParticipantId(card);
      const coreoNumber=byId.get(id);
      if(!coreoNumber)continue;

      if(card.dataset.jdCoreoEnhanced!=='1'){
        const info=card.querySelector('.grow .muted');
        if(info)info.insertAdjacentHTML('afterend',`<div class="muted jdCoreoNumber">Coreo N.º: <b>${esc(coreoNumber)}</b></div>`);
        card.dataset.q=`${card.dataset.q||''} coreo ${coreoNumber}`.toLowerCase();
        card.dataset.jdCoreoEnhanced='1';
      }

      for(const row of card.querySelectorAll('.fileRow')){
        const label=row.querySelector('b');
        const link=[...row.querySelectorAll('a')].find(a=>/descargar música/i.test(a.textContent||''));
        if(!link||link.dataset.jdCoreoDownload==='1')continue;
        const originalFile=label?.textContent||'';
        if(label)label.textContent=`🎵 Coreo ${coreoNumber} · ${originalFile.replace(/^🎵\s*/, '')}`;
        link.textContent=`Descargar Coreo ${coreoNumber}`;
        link.dataset.jdCoreoDownload='1';
        link.removeAttribute('download');
        link.addEventListener('click',event=>downloadAsCoreo(link,coreoNumber,originalFile,event));
      }
    }
  }

  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=async function coreoNumberRender(...args){
      const result=await baseRender.apply(this,args);
      await enhanceAdminCoreo();
      return result;
    };
  }
})();
