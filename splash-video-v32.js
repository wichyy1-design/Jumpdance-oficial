(()=>{
  const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
  const isAndroid=/Android/i.test(window.navigator.userAgent||'');
  const appLike=standalone||isAndroid;
  const splash=document.getElementById('jdSplash');

  // El wrapper Android no siempre reporta display-mode: standalone.
  // En Android mostramos igualmente la intro para que se vea dentro del APK.
  if(!appLike){
    document.documentElement.classList.remove('jdBootSplash');
    splash?.remove();
    return;
  }
  if(!splash){
    document.documentElement.classList.remove('jdBootSplash');
    return;
  }

  const video=document.getElementById('jdIntroVideo');
  const fallback=document.getElementById('jdIntroFallback');
  let objectUrl=null;
  let closed=false;

  document.documentElement.classList.add('jdSplashActive');
  splash.classList.add('show','jdVideoSplash');
  splash.setAttribute('aria-hidden','false');

  const close=()=>{
    if(closed)return;
    closed=true;
    splash.classList.add('hide');
    document.documentElement.classList.remove('jdSplashActive','jdBootSplash');
    setTimeout(()=>{
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      splash.remove();
    },420);
  };

  const showFallback=()=>{
    fallback?.classList.add('show');
    setTimeout(close,850);
  };

  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if(reduced){
    showFallback();
    return;
  }

  try{
    const parts=window.JD_INTRO_PARTS||[];
    if(parts.length<3||!parts[0]||!parts[1]||!parts[2])throw new Error('Video incompleto');
    const b64=parts.join('');
    const raw=atob(b64);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    objectUrl=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));

    video.muted=true;
    video.playsInline=true;
    video.src=objectUrl;
    video.addEventListener('ended',close,{once:true});
    video.addEventListener('error',showFallback,{once:true});

    const start=()=>{
      const p=video.play();
      if(p?.catch)p.catch(showFallback);
    };
    if(video.readyState>=2)start();
    else video.addEventListener('canplay',start,{once:true});

    // Seguridad: la intro nunca bloquea el acceso a la app.
    setTimeout(close,3800);
  }catch(e){
    console.warn('No se pudo reproducir la intro de video',e);
    showFallback();
  }
})();
