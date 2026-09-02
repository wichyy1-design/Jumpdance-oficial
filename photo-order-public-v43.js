(() => {
  const basePhotos=window.photos;
  if(typeof basePhotos!=='function'||!window.JDGallery)return;

  const baseOpenUrl=window.JDGallery.openUrl.bind(window.JDGallery);

  function storagePathFromUrl(url){
    try{
      const pathname=new URL(url,location.href).pathname;
      const marker='/storage/v1/object/public/Photos/';
      const i=pathname.indexOf(marker);
      if(i<0)return '';
      return decodeURIComponent(pathname.slice(i+marker.length));
    }catch{return ''}
  }

  async function orderMap(){
    const {data,error}=await sb.from('photo_order').select('path,year,position');
    if(error){console.warn('No se pudo leer el orden público de fotos',error);return new Map()}
    return new Map((data||[]).map(r=>[String(r.path),{year:String(r.year),position:Number(r.position)}]));
  }

  window.photos=async function photosV43(){
    const html=await basePhotos.apply(this,arguments);
    if(!html||!html.includes('galleryPhotoCard'))return html;
    const map=await orderMap();
    if(!map.size)return html;

    const host=document.createElement('div');
    host.innerHTML=html;
    host.querySelectorAll('.jdPhotoYearPane').forEach(pane=>{
      const grid=pane.querySelector('.mediaGrid');
      if(!grid)return;
      const cards=[...grid.querySelectorAll('.galleryPhotoCard')];
      cards.forEach((card,index)=>card.dataset.jdOriginalOrder=String(index));
      cards.sort((a,b)=>{
        const ap=map.get(storagePathFromUrl(a.dataset.url||''))?.position;
        const bp=map.get(storagePathFromUrl(b.dataset.url||''))?.position;
        const aok=Number.isFinite(ap),bok=Number.isFinite(bp);
        if(aok&&bok&&ap!==bp)return ap-bp;
        if(aok&&!bok)return -1;
        if(!aok&&bok)return 1;
        return Number(a.dataset.jdOriginalOrder||0)-Number(b.dataset.jdOriginalOrder||0);
      });
      cards.forEach(card=>{delete card.dataset.jdOriginalOrder;grid.appendChild(card)});
    });
    return host.innerHTML;
  };

  window.JDGallery.openUrl=function openOrderedPhoto(url,year){
    const items=[];
    document.querySelectorAll('.jdPhotoYearPane').forEach(pane=>{
      const paneYear=pane.dataset.year||year||'2026';
      pane.querySelectorAll('.galleryPhotoCard[data-url]').forEach(card=>{
        const itemUrl=card.dataset.url;
        const path=storagePathFromUrl(itemUrl);
        items.push({url:itemUrl,year:paneYear,path,name:path.split('/').pop()||'jumpdance-foto.jpg',type:'photo'});
      });
    });
    if(items.length)window.JDGallery.setItems(items);
    return baseOpenUrl(url,year);
  };
})();
