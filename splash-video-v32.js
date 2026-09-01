(()=>{
  const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
  const isAndroid=/Android/i.test(window.navigator.userAgent||'');
  const appLike=standalone||isAndroid;
  const splash=document.getElementById('jdSplash');

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
  let started=false;

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
    setTimeout(close,900);
  };

  try{
    const parts=window.JD_INTRO_PARTS||[];
    if(parts.length<3||!parts[0]||!parts[1]||!parts[2])throw new Error('Video incompleto');

    const b64=parts.join('');
    const raw=atob(b64);
    const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    objectUrl=URL.createObjectURL(new Blob([bytes],{type:'video/mp4'}));

    video.muted=true;
    video.defaultMuted=true;
    video.autoplay=true;
    video.playsInline=true;
    video.setAttribute('muted','');
    video.setAttribute('autoplay','');
    video.setAttribute('playsinline','');
    video.preload='auto';
    video.src=objectUrl;

    video.addEventListener('ended',close,{once:true});
    video.addEventListener('error',showFallback,{once:true});

    const start=()=>{
      if(started||closed)return;
      started=true;
      try{video.currentTime=0}catch{}
      const p=video.play();
      if(p?.catch){
        p.catch(()=>{
          started=false;
          setTimeout(()=>{
            if(closed)return;
            const retry=video.play();
            if(retry?.catch)retry.catch(showFallback);
          },120);
        });
      }
    };

    video.addEventListener('loadeddata',start,{once:true});
    video.addEventListener('canplay',start,{once:true});
    video.load();
    if(video.readyState>=2)requestAnimationFrame(start);

    // Nunca dejar la app bloqueada si el WebView/TWA demora o rechaza reproducción.
    setTimeout(close,4600);
  }catch(e){
    console.warn('No se pudo reproducir la intro de Jumpdance',e);
    showFallback();
  }
})();
