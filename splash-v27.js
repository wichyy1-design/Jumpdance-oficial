(() => {
  const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
  if(!standalone)return;

  const splash=document.getElementById('jdSplash');
  if(!splash)return;

  document.documentElement.classList.add('jdSplashActive');
  splash.classList.add('show');
  splash.setAttribute('aria-hidden','false');

  const close=()=>{
    splash.classList.add('hide');
    document.documentElement.classList.remove('jdSplashActive');
    setTimeout(()=>{
      splash.remove();
    },380);
  };

  const delay=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?850:1650;
  setTimeout(close,delay);
})();
