(() => {
  const VALID_ROUTES=new Set(['home','register','photos','videos','news','results','sponsors','participants','messages','admin']);
  const isStandalone=window.matchMedia?.('(display-mode: standalone)')?.matches||window.navigator.standalone===true;
  const currentRoute=()=>{
    const r=location.hash.slice(1)||'home';
    return VALID_ROUTES.has(r)?r:'home';
  };

  const initial=currentRoute();
  if(isStandalone){
    history.replaceState({jd:true,guard:true,route:'home'},'', '#home');
    history.pushState({jd:true,route:initial},'', `#${initial}`);
  }else{
    history.replaceState({jd:true,route:initial},'',`#${initial}`);
  }

  window.route=function(r){
    const next=VALID_ROUTES.has(r)?r:'home';

    if(history.state?.overlay==='drawer'){
      history.replaceState({jd:true,route:currentRoute()},'',location.href);
    }

    if(currentRoute()===next){
      if(typeof render==='function')render();
      return;
    }

    history.pushState({jd:true,route:next},'',`#${next}`);
    if(typeof render==='function')render();
  };

  const originalCloseDrawer=window.closeDrawer;
  const drawer=document.getElementById('drawer');
  const menuBtn=document.getElementById('menuBtn');

  if(menuBtn){
    menuBtn.addEventListener('click',()=>{
      if(history.state?.overlay==='drawer')return;
      history.pushState({jd:true,route:currentRoute(),overlay:'drawer'},'',location.href);
    });
  }

  if(typeof originalCloseDrawer==='function'){
    window.closeDrawer=function(){
      originalCloseDrawer();
      if(history.state?.overlay==='drawer')history.back();
    };
  }

  let galleryOriginalClose=null;
  if(window.JDGallery){
    const galleryOriginalOpen=window.JDGallery.open.bind(window.JDGallery);
    galleryOriginalClose=window.JDGallery.close.bind(window.JDGallery);

    window.JDGallery.open=function(index){
      galleryOriginalOpen(index);
      if(history.state?.overlay!=='photo'){
        history.pushState({jd:true,route:currentRoute(),overlay:'photo'},'',location.href);
      }
    };

    window.JDGallery.close=function(){
      galleryOriginalClose();
      if(history.state?.overlay==='photo')history.back();
    };
  }

  window.addEventListener('popstate',event=>{
    const photoViewer=document.getElementById('photoViewer');
    if(photoViewer&&!photoViewer.classList.contains('hidden')){
      if(galleryOriginalClose)galleryOriginalClose();
      return;
    }

    if(drawer&&!drawer.classList.contains('hidden')){
      if(typeof originalCloseDrawer==='function')originalCloseDrawer();
      return;
    }

    if(isStandalone&&event.state?.guard){
      history.pushState({jd:true,route:'home'},'', '#home');
      if(typeof render==='function')render();
    }
  });
})();
