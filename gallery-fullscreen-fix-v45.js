(() => {
  // El visor ya ocupa toda la pantalla mediante CSS. Evitamos solicitar el modo
  // Fullscreen nativo del navegador para que Android no muestre el aviso
  // "Para salir de la pantalla completa..." al abrir cada foto.
  const proto=window.Element?.prototype;
  if(!proto)return;

  const nativeRequest=proto.requestFullscreen;
  if(typeof nativeRequest==='function'&&!nativeRequest.__jdPhotoViewerWrapped){
    const wrapped=function(...args){
      if(this?.id==='photoViewer')return Promise.resolve();
      return nativeRequest.apply(this,args);
    };
    wrapped.__jdPhotoViewerWrapped=true;
    wrapped.__jdNative=nativeRequest;
    try{proto.requestFullscreen=wrapped}catch{}
  }

  const nativeWebkit=proto.webkitRequestFullscreen;
  if(typeof nativeWebkit==='function'&&!nativeWebkit.__jdPhotoViewerWrapped){
    const wrappedWebkit=function(...args){
      if(this?.id==='photoViewer')return Promise.resolve();
      return nativeWebkit.apply(this,args);
    };
    wrappedWebkit.__jdPhotoViewerWrapped=true;
    wrappedWebkit.__jdNative=nativeWebkit;
    try{proto.webkitRequestFullscreen=wrappedWebkit}catch{}
  }
})();
