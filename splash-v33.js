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

  let closed=false;
  document.documentElement.classList.add('jdSplashActive');
  splash.classList.add('show');
  splash.setAttribute('aria-hidden','false');

  const close=()=>{
    if(closed)return;
    closed=true;
    splash.classList.add('hide');
    document.documentElement.classList.remove('jdSplashActive','jdBootSplash');
    setTimeout(()=>splash.remove(),460);
  };

  // Si el SVG no cargara, la marca sigue visible y la app nunca queda bloqueada.
  const girl=splash.querySelector('.jd33Girl');
  girl?.addEventListener('error',()=>girl.remove(),{once:true});

  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  setTimeout(close,reduced?1500:3350);
})();
