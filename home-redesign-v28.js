(()=>{
  let countdownTimer=null;
  let decorating=false;
  let publicityLoader=null;

  const MONTHS={
    ENERO:0,FEBRERO:1,MARZO:2,ABRIL:3,MAYO:4,JUNIO:5,
    JULIO:6,AGOSTO:7,SEPTIEMBRE:8,SETIEMBRE:8,OCTUBRE:9,NOVIEMBRE:10,DICIEMBRE:11
  };

  function ensurePublicityFeature(){
    if(window.jdUpdateNewsBell)return Promise.resolve();
    if(publicityLoader)return publicityLoader;
    publicityLoader=new Promise((resolve,reject)=>{
      let script=document.querySelector('script[src*="publicity-news-v49.js"]');
      if(script){
        if(window.jdUpdateNewsBell)return resolve();
        script.addEventListener('load',()=>resolve(),{once:true});
        script.addEventListener('error',reject,{once:true});
        return;
      }
      script=document.createElement('script');
      script.src='publicity-news-v49.js?v=50';
      script.async=true;
      script.onload=()=>resolve();
      script.onerror=reject;
      document.head.appendChild(script);
    });
    return publicityLoader;
  }

  function parseEventDate(label){
    const text=String(label||'').trim().toUpperCase();
    const m=text.match(/(\d{1,2})\s*(?:DE\s*)?([A-ZÁÉÍÓÚÑ]+)\s*(?:DE\s*)?(\d{4})/i);
    if(!m)return null;
    const month=MONTHS[m[2].normalize('NFD').replace(/[\u0300-\u036f]/g,'')];
    if(month===undefined)return null;
    const d=new Date(Number(m[3]),month,Number(m[1]),0,0,0,0);
    return Number.isNaN(d.getTime())?null:d;
  }

  function startCountdown(dateLabel){
    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
    const target=parseEventDate(dateLabel);
    const root=document.getElementById('homeCountdown');
    if(!root)return;

    if(!target){
      root.innerHTML='<div class="countdownDone">Próximamente Jumpdance ✨</div>';
      return;
    }

    const render=()=>{
      const now=new Date();
      let diff=target.getTime()-now.getTime();
      if(diff<=0){
        root.innerHTML='<div class="countdownDone">✨ HOY ES JUMPDANCE ✨</div>';
        if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
        return;
      }
      const days=Math.floor(diff/86400000); diff%=86400000;
      const hours=Math.floor(diff/3600000); diff%=3600000;
      const minutes=Math.floor(diff/60000); diff%=60000;
      const seconds=Math.floor(diff/1000);
      const values=[days,hours,minutes,seconds].map((v,i)=>i===0?String(v):String(v).padStart(2,'0'));
      root.innerHTML=`
        <div class="countdownTitle">Falta para el evento</div>
        <div class="countdownGrid">
          <div><span class="countdownValue">${values[0]}</span><span class="countdownLabel">Días</span></div>
          <div><span class="countdownValue">${values[1]}</span><span class="countdownLabel">Horas</span></div>
          <div><span class="countdownValue">${values[2]}</span><span class="countdownLabel">Minutos</span></div>
          <div><span class="countdownValue">${values[3]}</span><span class="countdownLabel">Segundos</span></div>
        </div>`;
    };
    render();
    countdownTimer=setInterval(render,1000);
  }

  async function openPublicity(){
    try{await ensurePublicityFeature()}catch(e){console.warn('No se pudo cargar Publicidad',e)}
    location.hash='ads';
    if(typeof window.render==='function')await window.render();
    window.scrollTo({top:0,left:0,behavior:'auto'});
  }

  function decoratePublicityCard(app){
    const cards=[...app.querySelectorAll('.quickCard')];
    const card=cards.find(c=>/NOVEDADES|PUBLICIDAD/i.test(c.querySelector('h3')?.textContent||''));
    if(!card)return;
    card.removeAttribute('onclick');
    card.onclick=openPublicity;
    const icon=card.querySelector('.ico');if(icon)icon.textContent='📢';
    const title=card.querySelector('h3');if(title)title.textContent='PUBLICIDAD';
    const desc=card.querySelector('p');if(desc)desc.textContent='Anuncios y publicidad de Jumpdance';
  }

  function decorateHome(){
    if(decorating)return;
    const app=document.getElementById('app');
    if(!app)return;
    const route=location.hash.slice(1)||'home';

    if(route!=='home'){
      app.classList.remove('homeV28');
      if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
      return;
    }

    const welcome=app.querySelector('.homeWelcome');
    const hero=app.querySelector('.editableHero');
    const grid=app.querySelector('.quickGrid');
    if(!welcome||!hero||!grid)return;

    decorating=true;
    try{
      app.classList.add('homeV28');
      decoratePublicityCard(app);

      const cta=hero.querySelector('.cta');
      if(cta)cta.textContent='Inscribirme';

      const header=app.querySelector('.sectionHeader');
      if(header){
        const kicker=header.querySelector('.kicker');
        const title=header.querySelector('h2');
        if(kicker)kicker.textContent='Accesos rápidos';
        if(title)title.textContent='Explorá Jumpdance';
      }

      const winner=app.querySelector('.winnerBanner');
      if(winner&&!app.querySelector('.homeCommunityCountdown')){
        const card=document.createElement('section');
        card.className='homeCommunityCountdown';
        card.innerHTML=`
          <div class="homeCommunityLead">
            <div><strong>💬 Comunidad Jumpdance</strong><small>Mensajes y novedades de nuestra comunidad</small></div>
            <button type="button" aria-label="Abrir comunidad">›</button>
          </div>
          <div id="homeCountdown"></div>`;
        const btn=card.querySelector('button');
        if(btn)btn.addEventListener('click',()=>window.route?window.route('messages'):(location.hash='messages'));
        winner.insertAdjacentElement('afterend',card);
      }

      const msgTitle=[...app.querySelectorAll('.sectionTitle')].find(x=>x.textContent.includes('Mensajes de la comunidad'));
      if(msgTitle)msgTitle.classList.add('homeMessagesTitle');

      const datePill=hero.querySelector('.infoPill:first-child');
      startCountdown(datePill?.textContent||'');
    }finally{
      decorating=false;
    }
  }

  const schedule=()=>{
    clearTimeout(schedule.t);
    schedule.t=setTimeout(decorateHome,40);
  };

  window.addEventListener('hashchange',()=>setTimeout(schedule,80));
  window.addEventListener('pageshow',schedule);
  window.addEventListener('load',()=>{
    schedule();
    setTimeout(()=>{if(!window.jdUpdateNewsBell)ensurePublicityFeature().catch(()=>{})},500);
  });

  const app=document.getElementById('app');
  if(app){
    new MutationObserver(schedule).observe(app,{childList:true,subtree:false});
  }
  schedule();
})();