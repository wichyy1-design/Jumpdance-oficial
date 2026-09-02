(() => {
  const originalSubmitRegistration=window.submitRegistration;
  if(typeof originalSubmitRegistration!=='function')return;

  const MESSAGE_MAX_CHARS=3000;

  function installLongMessageStyles(){
    if(document.getElementById('jdLongMessageStyles'))return;
    const style=document.createElement('style');
    style.id='jdLongMessageStyles';
    style.textContent=`
      #msgForm textarea[name="message"]{
        min-height:190px;
        resize:vertical;
        line-height:1.5;
      }
      .messageCard p{
        white-space:pre-line;
        overflow-wrap:anywhere;
        line-height:1.55;
      }
      .jdMessageCounter{
        margin-top:6px;
        text-align:right;
        font-size:12px;
        color:#9f98aa;
        font-weight:700;
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceMessageForm(){
    installLongMessageStyles();
    const form=document.getElementById('msgForm');
    const textarea=form?.querySelector('textarea[name="message"]');
    if(!textarea)return;

    textarea.maxLength=MESSAGE_MAX_CHARS;
    textarea.setAttribute('maxlength',String(MESSAGE_MAX_CHARS));
    textarea.setAttribute('rows','8');
    textarea.placeholder='Dejá tu mensaje para Jumpdance... Podés escribir un mensaje más extenso.';

    let counter=form.querySelector('.jdMessageCounter');
    if(!counter){
      counter=document.createElement('div');
      counter.className='jdMessageCounter';
      textarea.insertAdjacentElement('afterend',counter);
    }

    const updateCounter=()=>{
      counter.textContent=`${textarea.value.length} / ${MESSAGE_MAX_CHARS} caracteres`;
    };
    if(textarea.dataset.jdLongMessage!=='1'){
      textarea.dataset.jdLongMessage='1';
      textarea.addEventListener('input',updateCounter);
    }
    updateCounter();
  }

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
  enhanceMessageForm();

  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=async function registrationGuardRender(...args){
      const result=await baseRender.apply(this,args);
      bindCurrentRegistrationForm();
      enhanceMessageForm();
      return result;
    };
  }
})();
