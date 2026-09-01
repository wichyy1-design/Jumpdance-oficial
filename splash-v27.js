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
    setTimeout(()=>splash.remove(),520);
  };

  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  // Ritmo más cinematográfico: entrada, gesto/destello, marca y fundido.
  setTimeout(close,reduced?1100:2950);
})();
