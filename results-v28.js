(()=>{
  const BOARD_TITLE='__JUMPDANCE_RESULTS_BOARD_V28__';
  const DEFAULT_YEAR='2026';
  const ADMIN_YEAR_KEY='jd_results_admin_year';
  let adminBoard=null;
  let dragState={timer:null,potential:null,active:null,hover:null,startX:0,startY:0};

  const uid=(p='id')=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const clean=v=>String(v??'').trim();
  const emptyEntry=()=>({name:'',academy:'',discipline:'',note:''});
  const entryHasData=e=>!!clean(e?.name);

  function defaultBoard(year=DEFAULT_YEAR){
    return {
      version:28,
      year:String(year||DEFAULT_YEAR),
      eventWinner:emptyEntry(),
      sections:[
        {id:'damas',type:'category',title:'Damas',slots:[
          {id:'damas_1',label:'1° puesto',entry:emptyEntry()},
          {id:'damas_2',label:'2° puesto',entry:emptyEntry()},
          {id:'damas_3',label:'3° puesto',entry:emptyEntry()}
        ]},
        {id:'kids',type:'category',title:'Kids',slots:[
          {id:'kids_1',label:'1° puesto',entry:emptyEntry()},
          {id:'kids_2',label:'2° puesto',entry:emptyEntry()},
          {id:'kids_3',label:'3° puesto',entry:emptyEntry()}
        ]},
        {id:'babys',type:'category',title:'Babys',slots:[
          {id:'babys_1',label:'1° puesto',entry:emptyEntry()},
          {id:'babys_2',label:'2° puesto',entry:emptyEntry()},
          {id:'babys_3',label:'3° puesto',entry:emptyEntry()}
        ]}
      ],
      mentions:[
        {id:'coreografia',label:'Mejor Coreografía',entry:emptyEntry()},
        {id:'vestimenta',label:'Mejor Vestimenta',entry:emptyEntry()},
        {id:'musicalizacion',label:'Mejor Musicalización',entry:emptyEntry()},
        {id:'tecnica',label:'Mejor Técnica',entry:emptyEntry()}
      ],
      updatedAt:new Date().toISOString()
    };
  }

  function normalizeEntry(e){
    return {name:clean(e?.name),academy:clean(e?.academy),discipline:clean(e?.discipline),note:clean(e?.note)};
  }

  function normalizeBoard(raw){
    const base=defaultBoard(raw?.year||DEFAULT_YEAR);
    const board={
      version:28,
      year:clean(raw?.year)||DEFAULT_YEAR,
      eventWinner:normalizeEntry(raw?.eventWinner),
      sections:Array.isArray(raw?.sections)?raw.sections:base.sections,
      mentions:Array.isArray(raw?.mentions)?raw.mentions:base.mentions,
      updatedAt:raw?.updatedAt||new Date().toISOString()
    };
    board.sections=board.sections.map((s,si)=>({
      id:clean(s?.id)||uid(`cat${si}`),
      type:'category',
      title:clean(s?.title)||`Categoría ${si+1}`,
      slots:(Array.isArray(s?.slots)&&s.slots.length?s.slots:[{label:'1° puesto',entry:emptyEntry()}]).map((slot,i)=>({
        id:clean(slot?.id)||uid(`slot${i}`),
        label:clean(slot?.label)||`${i+1}° puesto`,
        entry:normalizeEntry(slot?.entry)
      }))
    }));
    board.mentions=board.mentions.map((m,i)=>({
      id:clean(m?.id)||uid(`mention${i}`),
      label:clean(m?.label)||`Mención ${i+1}`,
      entry:normalizeEntry(m?.entry)
    }));
    return board;
  }

  function parseBoardRow(row){
    try{return normalizeBoard(JSON.parse(row?.body||'{}'))}catch{return null}
  }

  async function fetchBoardRows(){
    const {data,error}=await sb.from('posts')
      .select('id,body,created_at')
      .eq('title',BOARD_TITLE)
      .eq('published',true)
      .order('created_at',{ascending:false})
      .limit(150);
    if(error){console.error(error);return []}
    return data||[];
  }

  function latestBoardsFromRows(rows){
    const byYear=new Map();
    for(const row of rows){
      const board=parseBoardRow(row);
      if(board&&!byYear.has(board.year))byYear.set(board.year,board);
    }
    return [...byYear.values()].sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));
  }

  function positionIndex(position){
    const p=clean(position).toLowerCase();
    if(/(^|\D)1(\D|$)|1°|1er|primero/.test(p))return 0;
    if(/(^|\D)2(\D|$)|2°|2do|segundo/.test(p))return 1;
    if(/(^|\D)3(\D|$)|3°|3er|tercero/.test(p))return 2;
    return -1;
  }

  function fillFromLegacy(board,rows){
    const targetRows=(rows||[]).filter(r=>!r.year||String(r.year)===String(board.year));
    for(const r of targetRows){
      const entry=normalizeEntry({name:r.participant,academy:r.academy,discipline:r.discipline,note:r.note});
      if(!entry.name)continue;
      const haystack=[r.position,r.category,r.discipline,r.note].filter(Boolean).join(' ').toLowerCase();
      if(/ganador.*evento|campe[oó]n.*general|ganador.*general/.test(haystack)){
        if(!entryHasData(board.eventWinner))board.eventWinner=entry;
        continue;
      }
      const mention=board.mentions.find(m=>{
        const l=m.label.toLowerCase();
        if(l.includes('coreograf'))return haystack.includes('coreograf');
        if(l.includes('vestimenta'))return haystack.includes('vestimenta');
        if(l.includes('musical'))return haystack.includes('musical');
        if(l.includes('técnica')||l.includes('tecnica'))return haystack.includes('tecnic');
        return false;
      });
      if(mention){if(!entryHasData(mention.entry))mention.entry=entry;continue}

      let section=board.sections.find(s=>haystack.includes(s.title.toLowerCase()));
      if(!section&&r.category){
        const title=clean(r.category);
        section=board.sections.find(s=>s.title.toLowerCase()===title.toLowerCase());
        if(!section){
          section={id:uid('cat'),type:'category',title,slots:[]};
          board.sections.push(section);
        }
      }
      if(section){
        let idx=positionIndex(r.position);
        if(idx<0)idx=section.slots.length;
        while(section.slots.length<=idx){
          const n=section.slots.length+1;
          section.slots.push({id:uid('slot'),label:`${n}° puesto`,entry:emptyEntry()});
        }
        if(!entryHasData(section.slots[idx].entry))section.slots[idx].entry=entry;
      }
    }
    return board;
  }

  async function fallbackBoard(year){
    let board=defaultBoard(year);
    try{
      if(typeof getAllResults==='function')board=fillFromLegacy(board,await getAllResults());
    }catch(e){console.warn('No se pudieron migrar resultados anteriores',e)}
    return normalizeBoard(board);
  }

  async function getBoard(year=DEFAULT_YEAR){
    const rows=await fetchBoardRows();
    const boards=latestBoardsFromRows(rows);
    return boards.find(b=>String(b.year)===String(year))||await fallbackBoard(year);
  }

  async function getPublicBoards(){
    const rows=await fetchBoardRows();
    const boards=latestBoardsFromRows(rows);
    if(boards.length)return boards;
    let years=[DEFAULT_YEAR];
    try{
      if(typeof getAllResults==='function'){
        const legacy=await getAllResults();
        const ly=[...new Set((legacy||[]).map(r=>clean(r.year)).filter(Boolean))];
        if(ly.length)years=ly;
      }
    }catch{}
    const out=[];
    for(const y of years)out.push(await fallbackBoard(y));
    return out.sort((a,b)=>(Number(b.year)||0)-(Number(a.year)||0));
  }

  async function saveBoard(board){
    const {data:{session}}=await sb.auth.getSession();
    if(!session||session.user.id!==cfg.adminUserId){toast('Solo el administrador puede modificar resultados');return false}
    const normalized=normalizeBoard({...board,updatedAt:new Date().toISOString()});
    const {error}=await sb.from('posts').insert({
      title:BOARD_TITLE,
      body:JSON.stringify(normalized),
      image_path:null,
      published:true
    });
    if(error){console.error(error);toast('No se pudieron guardar los resultados');return false}
    adminBoard=normalized;
    return true;
  }

  function publicEntry(entry,emptyText='Por definir'){
    if(!entryHasData(entry))return `<div class="jrEmpty">${emptyText}</div>`;
    return `<div class="jrName">${esc(entry.name)}</div>
      ${entry.academy?`<div class="jrAcademy">${esc(entry.academy)}</div>`:''}
      ${entry.discipline?`<div class="jrDiscipline">${esc(entry.discipline)}</div>`:''}
      ${entry.note?`<div class="jrNote">${esc(entry.note)}</div>`:''}`;
  }

  function boardPublicHtml(board,hidden=false){
    let h=`<section class="jrYearPane" data-jr-year="${esc(board.year)}" style="${hidden?'display:none':''}">
      <div class="jrWinnerPublic">
        <div class="jrWinnerCrown">🏆</div>
        <div class="jrWinnerEyebrow">GANADOR DEL EVENTO</div>
        ${publicEntry(board.eventWinner,'Ganador por anunciar')}
      </div>`;

    h+=`<div class="jrCategoriesPublic">`;
    board.sections.forEach(section=>{
      h+=`<section class="jrCategoryPublic"><div class="jrCategoryTitle">${esc(section.title)}</div><div class="jrPodiumGrid">`;
      section.slots.forEach((slot,i)=>{
        const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'🏅';
        h+=`<article class="jrPodiumCard jrPlace${i+1}"><div class="jrMedal">${medal}</div><div class="jrPlaceLabel">${esc(slot.label)}</div>${publicEntry(slot.entry)}</article>`;
      });
      h+=`</div></section>`;
    });
    h+=`</div>`;

    if(board.mentions.length){
      h+=`<section class="jrMentionsPublic"><div class="jrSpecialHeading"><span>✨</span><h3>Menciones especiales</h3></div><div class="jrMentionGrid">`;
      board.mentions.forEach(m=>{
        h+=`<article class="jrMentionCard"><div class="jrMentionLabel">${esc(m.label)}</div>${publicEntry(m.entry)}</article>`;
      });
      h+=`</div></section>`;
    }
    return h+`</section>`;
  }

  window.results=async function resultsV28(){
    const boards=await getPublicBoards();
    if(!boards.length)return `<div class="sectionTitle"><h2>🏆 Resultados</h2></div><div class="card muted">Todavía no hay resultados.</div>`;
    let h=`<header class="jrResultsHeader"><div><span class="jrKicker">JUMPDANCE</span><h1>Resultados</h1></div><div class="jrHeaderCup">🏆</div></header>`;
    if(boards.length>1){
      h+=`<div class="jrYearTabs">${boards.map((b,i)=>`<button class="${i?'':'active'}" onclick="jdShowResultsYear('${esc(b.year)}',this)">${esc(b.year)}</button>`).join('')}</div>`;
    }
    boards.forEach((b,i)=>{h+=boardPublicHtml(b,i>0)});
    return h;
  };

  window.jdShowResultsYear=function(year,btn){
    document.querySelectorAll('.jrYearPane').forEach(el=>el.style.display=el.dataset.jrYear===String(year)?'block':'none');
    document.querySelectorAll('.jrYearTabs button').forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
  };

  function getSlotRef(board,key){
    if(key==='winner')return {get:()=>board.eventWinner,set:v=>board.eventWinner=normalizeEntry(v)};
    if(key.startsWith('cat:')){
      const [,sid,idxRaw]=key.split(':');
      const section=board.sections.find(s=>s.id===sid);const idx=Number(idxRaw);
      if(!section||!section.slots[idx])return null;
      return {get:()=>section.slots[idx].entry,set:v=>section.slots[idx].entry=normalizeEntry(v)};
    }
    if(key.startsWith('mention:')){
      const id=key.slice(8);const m=board.mentions.find(x=>x.id===id);if(!m)return null;
      return {get:()=>m.entry,set:v=>m.entry=normalizeEntry(v)};
    }
    return null;
  }

  async function rerenderAdmin(message=''){
    if(message)toast(message);
    await window.renderAdminResultsMultiYear();
  }

  function adminEntryHtml(key,label,entry,accent=''){
    return `<div class="jrAdminSlot ${accent}" data-jd-result-slot="${esc(key)}">
      <div class="jrGrip">⋮⋮</div>
      <div class="jrAdminSlotBody"><div class="jrAdminSlotLabel">${esc(label)}</div>
        ${entryHasData(entry)?`<div class="jrAdminName">${esc(entry.name)}</div><div class="jrAdminMeta">${esc([entry.academy,entry.discipline].filter(Boolean).join(' · '))}</div>`:`<div class="jrAdminEmpty">Sin asignar</div>`}
      </div>
      <div class="jrAdminActions"><button type="button" onclick="jdResultEditSlot('${esc(key)}')">✏️</button><button type="button" onclick="jdResultClearSlot('${esc(key)}')">✕</button></div>
    </div>`;
  }

  function adminBoardHtml(board,years){
    let h=`<div class="jrAdminWrap">
      <div class="jrAdminTop">
        <div><span class="jrKicker">EDITOR VISUAL</span><h2>🏆 Resultados ${esc(board.year)}</h2><p>Mantené apretado un ganador y arrastralo al cuadro que quieras.</p></div>
        <div class="jrAdminYearTools"><select onchange="jdResultSelectYear(this.value)">${years.map(y=>`<option ${String(y)===String(board.year)?'selected':''}>${esc(y)}</option>`).join('')}</select><button class="btn secondary" type="button" onclick="jdResultNewYear()">+ Año</button></div>
      </div>

      <section class="jrAdminWinner"><h3>Ganador del evento</h3>${adminEntryHtml('winner','Ganador general',board.eventWinner,'winner')}</section>

      <div class="jrAdminSectionHead"><h3>Categorías</h3><button class="btn" type="button" onclick="jdResultAddCategory()">+ AGREGAR CATEGORÍA</button></div>
      <div class="jrAdminCategories">`;

    board.sections.forEach((section,si)=>{
      h+=`<section class="jrAdminCategory">
        <div class="jrAdminCategoryHead"><h3>${esc(section.title)}</h3><div>
          <button type="button" onclick="jdResultMoveCategory('${esc(section.id)}',-1)" ${si===0?'disabled':''}>↑</button>
          <button type="button" onclick="jdResultMoveCategory('${esc(section.id)}',1)" ${si===board.sections.length-1?'disabled':''}>↓</button>
          <button type="button" onclick="jdResultRenameCategory('${esc(section.id)}')">✏️</button>
          <button type="button" onclick="jdResultDeleteCategory('${esc(section.id)}')">🗑️</button>
        </div></div>`;
      section.slots.forEach((slot,i)=>{h+=adminEntryHtml(`cat:${section.id}:${i}`,slot.label,slot.entry,i===0?'first':i===1?'second':i===2?'third':'')});
      h+=`<button class="jrAddPosition" type="button" onclick="jdResultAddPosition('${esc(section.id)}')">+ Agregar puesto</button></section>`;
    });
    h+=`</div>

      <div class="jrAdminSectionHead"><h3>Menciones especiales</h3><button class="btn" type="button" onclick="jdResultAddMention()">+ AGREGAR MENCIÓN</button></div>
      <div class="jrAdminMentions">`;
    board.mentions.forEach(m=>{
      h+=`<div class="jrAdminMentionWrap">${adminEntryHtml(`mention:${m.id}`,m.label,m.entry,'mention')}
        <div class="jrMentionTools"><button type="button" onclick="jdResultRenameMention('${esc(m.id)}')">Renombrar</button><button type="button" onclick="jdResultDeleteMention('${esc(m.id)}')">Eliminar</button></div></div>`;
    });
    h+=`</div><div class="jrAdminHint">💡 Mantené apretado sobre una tarjeta durante medio segundo. Cuando vibre, arrastrala y soltala sobre otro puesto para intercambiar los ganadores.</div></div>`;
    return h;
  }

  window.renderAdminResultsMultiYear=async function renderAdminResultsV28(){
    const host=document.getElementById('aResults');
    if(!host)return;
    const rows=await fetchBoardRows();
    const existing=latestBoardsFromRows(rows);
    const years=[...new Set([...(existing.map(b=>b.year)),DEFAULT_YEAR])].sort((a,b)=>(Number(b)||0)-(Number(a)||0));
    let selected=localStorage.getItem(ADMIN_YEAR_KEY)||years[0]||DEFAULT_YEAR;
    if(!years.includes(selected))years.unshift(selected);
    adminBoard=existing.find(b=>b.year===selected)||await fallbackBoard(selected);
    host.innerHTML=adminBoardHtml(adminBoard,years);
    bindSlotPresses();
  };

  window.jdResultSelectYear=async function(year){localStorage.setItem(ADMIN_YEAR_KEY,String(year));adminBoard=await getBoard(year);await window.renderAdminResultsMultiYear()};
  window.jdResultNewYear=async function(){
    const year=prompt('Año de resultados',String((Number(adminBoard?.year)||2026)+1));if(year===null)return;
    const y=clean(year);if(!/^\d{4}$/.test(y))return toast('Escribí un año de 4 cifras');
    adminBoard=defaultBoard(y);localStorage.setItem(ADMIN_YEAR_KEY,y);await saveBoard(adminBoard);await rerenderAdmin('Año creado');
  };

  window.jdResultEditSlot=async function(key){
    const ref=getSlotRef(adminBoard,key);if(!ref)return;
    const old=ref.get()||emptyEntry();
    const name=prompt('Ganador / grupo',old.name||'');if(name===null)return;
    const academy=prompt('Academia',old.academy||'');if(academy===null)return;
    const discipline=prompt('Disciplina',old.discipline||'');if(discipline===null)return;
    const note=prompt('Observación',old.note||'');if(note===null)return;
    ref.set({name,academy,discipline,note});
    if(await saveBoard(adminBoard))await rerenderAdmin('Resultado guardado');
  };

  window.jdResultClearSlot=async function(key){
    const ref=getSlotRef(adminBoard,key);if(!ref||!entryHasData(ref.get()))return;
    if(!confirm('¿Vaciar este cuadro?'))return;ref.set(emptyEntry());if(await saveBoard(adminBoard))await rerenderAdmin('Cuadro vaciado');
  };

  window.jdResultAddCategory=async function(){
    const title=prompt('Nombre de la nueva categoría','Nueva categoría');if(title===null||!clean(title))return;
    const countRaw=prompt('¿Cuántos puestos querés crear?','3');if(countRaw===null)return;
    const count=Math.max(1,Math.min(10,Number(countRaw)||3));
    adminBoard.sections.push({id:uid('cat'),type:'category',title:clean(title),slots:Array.from({length:count},(_,i)=>({id:uid('slot'),label:`${i+1}° puesto`,entry:emptyEntry()}))});
    if(await saveBoard(adminBoard))await rerenderAdmin('Categoría agregada');
  };

  window.jdResultRenameCategory=async function(id){const s=adminBoard.sections.find(x=>x.id===id);if(!s)return;const v=prompt('Nombre de la categoría',s.title);if(v===null||!clean(v))return;s.title=clean(v);if(await saveBoard(adminBoard))await rerenderAdmin('Categoría actualizada')};
  window.jdResultDeleteCategory=async function(id){const s=adminBoard.sections.find(x=>x.id===id);if(!s)return;if(!confirm(`¿Eliminar la categoría "${s.title}"?`))return;adminBoard.sections=adminBoard.sections.filter(x=>x.id!==id);if(await saveBoard(adminBoard))await rerenderAdmin('Categoría eliminada')};
  window.jdResultMoveCategory=async function(id,delta){const i=adminBoard.sections.findIndex(x=>x.id===id);const j=i+Number(delta);if(i<0||j<0||j>=adminBoard.sections.length)return;[adminBoard.sections[i],adminBoard.sections[j]]=[adminBoard.sections[j],adminBoard.sections[i]];if(await saveBoard(adminBoard))await rerenderAdmin()};
  window.jdResultAddPosition=async function(id){const s=adminBoard.sections.find(x=>x.id===id);if(!s)return;const label=prompt('Nombre del puesto',`${s.slots.length+1}° puesto`);if(label===null||!clean(label))return;s.slots.push({id:uid('slot'),label:clean(label),entry:emptyEntry()});if(await saveBoard(adminBoard))await rerenderAdmin('Puesto agregado')};

  window.jdResultAddMention=async function(){const label=prompt('Nombre de la nueva mención','Nueva mención especial');if(label===null||!clean(label))return;adminBoard.mentions.push({id:uid('mention'),label:clean(label),entry:emptyEntry()});if(await saveBoard(adminBoard))await rerenderAdmin('Mención agregada')};
  window.jdResultRenameMention=async function(id){const m=adminBoard.mentions.find(x=>x.id===id);if(!m)return;const v=prompt('Nombre de la mención',m.label);if(v===null||!clean(v))return;m.label=clean(v);if(await saveBoard(adminBoard))await rerenderAdmin('Mención actualizada')};
  window.jdResultDeleteMention=async function(id){const m=adminBoard.mentions.find(x=>x.id===id);if(!m)return;if(!confirm(`¿Eliminar "${m.label}"?`))return;adminBoard.mentions=adminBoard.mentions.filter(x=>x.id!==id);if(await saveBoard(adminBoard))await rerenderAdmin('Mención eliminada')};

  async function swapSlots(a,b){
    if(!adminBoard||a===b)return;
    const ra=getSlotRef(adminBoard,a),rb=getSlotRef(adminBoard,b);if(!ra||!rb)return;
    const va=clone(ra.get()||emptyEntry()),vb=clone(rb.get()||emptyEntry());ra.set(vb);rb.set(va);
    if(await saveBoard(adminBoard))await rerenderAdmin('Orden actualizado');
  }

  function clearDragVisuals(){
    clearTimeout(dragState.timer);dragState.timer=null;
    document.querySelectorAll('.jrDragging,.jrDropTarget').forEach(el=>el.classList.remove('jrDragging','jrDropTarget'));
    document.body.classList.remove('jrNoScroll');
  }

  function bindSlotPresses(){
    document.querySelectorAll('#aResults [data-jd-result-slot]').forEach(el=>{
      el.addEventListener('pointerdown',e=>{
        if(e.target.closest('button'))return;
        clearDragVisuals();
        dragState.potential=el;dragState.active=null;dragState.hover=null;dragState.startX=e.clientX;dragState.startY=e.clientY;
        dragState.timer=setTimeout(()=>{
          dragState.active=el;dragState.hover=el;el.classList.add('jrDragging');document.body.classList.add('jrNoScroll');
          try{navigator.vibrate?.(35)}catch{}
        },480);
      });
    });
  }

  document.addEventListener('pointermove',e=>{
    if(!dragState.potential)return;
    if(!dragState.active){
      if(Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY)>12){clearTimeout(dragState.timer);dragState.potential=null}
      return;
    }
    e.preventDefault();
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-jd-result-slot]');
    if(target!==dragState.hover){dragState.hover?.classList.remove('jrDropTarget');dragState.hover=target||null;dragState.hover?.classList.add('jrDropTarget')}
  },{passive:false});

  document.addEventListener('pointerup',async()=>{
    clearTimeout(dragState.timer);
    const active=dragState.active,hover=dragState.hover;
    const a=active?.dataset?.jdResultSlot,b=hover?.dataset?.jdResultSlot;
    dragState.potential=null;dragState.active=null;dragState.hover=null;clearDragVisuals();
    if(a&&b&&a!==b)await swapSlots(a,b);
  });
  document.addEventListener('pointercancel',()=>{dragState.potential=null;dragState.active=null;dragState.hover=null;clearDragVisuals()});
})();