(() => {
  const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
  if(!standalone){
    document.documentElement.classList.remove('jdBootSplash');
    return;
  }

  const splash=document.getElementById('jdSplash');
  if(!splash){
    document.documentElement.classList.remove('jdBootSplash');
    return;
  }

  document.documentElement.classList.add('jdSplashActive');
  splash.classList.add('show');
  splash.setAttribute('aria-hidden','false');

  const close=()=>{
    splash.classList.add('hide');
    document.documentElement.classList.remove('jdSplashActive');
    document.documentElement.classList.remove('jdBootSplash');
    setTimeout(()=>splash.remove(),500);
  };

  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  // Entrada, saludo anime articulado, destello, marca, pausa y fundido.
  setTimeout(close,reduced?1250:3650);
})();
