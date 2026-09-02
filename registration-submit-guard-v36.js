(() => {
  const originalSubmitRegistration=window.submitRegistration;
  if(typeof originalSubmitRegistration!=='function')return;

  async function guardedSubmitRegistration(e){
    e?.preventDefault?.();
    const form=e?.currentTarget||e?.target||document.getElementById('regForm');
    if(!form)return originalSubmitRegistration.call(this,e);

    if(form.dataset.submitting==='true'){
      toast('La inscripción ya se está enviando');
      return;
    }

    const file=document.getElementById('musicFile')?.files?.[0];
    // Deja que el manejador original muestre sus mensajes de validación.
    if(!file||file.size>50*1024*1024)return originalSubmitRegistration.call(this,e);

    const button=form.querySelector('button[type="submit"]');
    const originalText=button?.textContent||'ENVIAR INSCRIPCIÓN';

    form.dataset.submitting='true';
    form.setAttribute('aria-busy','true');
    if(button){
      button.disabled=true;
      button.setAttribute('aria-disabled','true');
      button.textContent='ENVIANDO...';
    }

    const unlock=()=>{
      delete form.dataset.submitting;
      form.removeAttribute('aria-busy');
      if(button){
        button.disabled=false;
        button.removeAttribute('aria-disabled');
        button.textContent=originalText;
      }
    };

    try{
      await originalSubmitRegistration.call(this,e);
      const success=form.style.display==='none'||!!document.getElementById('result')?.querySelector('.success');
      if(!success)unlock();
    }catch(err){
      console.error(err);
      unlock();
      toast('No se pudo enviar la inscripción. Intentá nuevamente.');
    }
  }

  window.submitRegistration=guardedSubmitRegistration;

  function bindCurrentRegistrationForm(){
    const form=document.getElementById('regForm');
    if(form&&form.onsubmit!==guardedSubmitRegistration)form.onsubmit=guardedSubmitRegistration;
  }

  bindCurrentRegistrationForm();

  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=async function registrationGuardRender(...args){
      const result=await baseRender.apply(this,args);
      bindCurrentRegistrationForm();
      return result;
    };
  }
})();
