(()=>{
  const BOARD_TITLE='__JUMPDANCE_RESULTS_BOARD_V28__';
  const DEFAULT_YEAR='2026';
  let migrationPromise=null;

  const clean=v=>String(v??'').trim();
  const emptyEntry=()=>({name:'',academy:'',discipline:'',note:''});
  const hasEntry=e=>!!clean(e?.name);
  const uid=(p='id')=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const normalizeEntry=e=>({name:clean(e?.name),academy:clean(e?.academy),discipline:clean(e?.discipline),note:clean(e?.note)});

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

  function normalizeBoard(raw,year){
    const base=defaultBoard(year||raw?.year||DEFAULT_YEAR);
    return {
      version:28,
      year:clean(raw?.year)||String(year||DEFAULT_YEAR),
      eventWinner:normalizeEntry(raw?.eventWinner),
      sections:(Array.isArray(raw?.sections)?raw.sections:base.sections).map((s,si)=>({
        id:clean(s?.id)||uid(`cat${si}`),
        type:'category',
        title:clean(s?.title)||`Categoría ${si+1}`,
        slots:(Array.isArray(s?.slots)&&s.slots.length?s.slots:[{label:'1° puesto',entry:emptyEntry()}]).map((slot,i)=>({
          id:clean(slot?.id)||uid(`slot${i}`),
          label:clean(slot?.label)||`${i+1}° puesto`,
          entry:normalizeEntry(slot?.entry)
        }))
      })),
      mentions:(Array.isArray(raw?.mentions)?raw.mentions:base.mentions).map((m,i)=>({
        id:clean(m?.id)||uid(`mention${i}`),
        label:clean(m?.label)||`Mención ${i+1}`,
        entry:normalizeEntry(m?.entry)
      })),
      updatedAt:raw?.updatedAt||new Date().toISOString()
    };
  }

  function positionIndex(position){
    const p=clean(position).toLowerCase();
    if(/(^|\D)1(\D|$)|1°|1er|primero/.test(p))return 0;
    if(/(^|\D)2(\D|$)|2°|2do|segundo/.test(p))return 1;
    if(/(^|\D)3(\D|$)|3°|3er|tercero/.test(p))return 2;
    return -1;
  }

  function mergeLegacy(board,rows){
    const year=String(board.year);
    const target=(rows||[]).filter(r=>String(r.year||'')===year);
    for(const r of target){
      const entry=normalizeEntry({name:r.participant,academy:r.academy,discipline:r.discipline,note:r.note});
      if(!entry.name)continue;
      const haystack=[r.position,r.category,r.discipline,r.note].filter(Boolean).join(' ').toLowerCase();

      if(/ganador.*evento|campe[oó]n.*general|ganador.*general/.test(haystack)){
        if(!hasEntry(board.eventWinner))board.eventWinner=entry;
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
      if(mention){if(!hasEntry(mention.entry))mention.entry=entry;continue}

      let section=board.sections.find(s=>haystack.includes(s.title.toLowerCase()));
      if(!section&&r.category){
        const title=clean(r.category);
        section=board.sections.find(s=>s.title.toLowerCase()===title.toLowerCase());
        if(!section){
          section={id:uid('cat'),type:'category',title,slots:[]};
          board.sections.push(section);
        }
      }
      if(!section)continue;

      let idx=positionIndex(r.position);
      if(idx<0)idx=section.slots.length;
      while(section.slots.length<=idx){
        const n=section.slots.length+1;
        section.slots.push({id:uid('slot'),label:`${n}° puesto`,entry:emptyEntry()});
      }
      if(!hasEntry(section.slots[idx].entry))section.slots[idx].entry=entry;
    }
    board.updatedAt=new Date().toISOString();
    return board;
  }

  function stableData(board){
    return JSON.stringify({eventWinner:board.eventWinner,sections:board.sections,mentions:board.mentions});
  }

  async function migrateLegacyYears(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session||session.user.id!==cfg.adminUserId||typeof getAllResults!=='function')return;

    const legacy=await getAllResults();
    const years=[...new Set((legacy||[]).map(r=>clean(r.year)).filter(Boolean))];
    if(!years.length)return;

    const {data:rows,error}=await sb.from('posts')
      .select('id,body,created_at')
      .eq('title',BOARD_TITLE)
      .eq('published',true)
      .order('created_at',{ascending:false})
      .limit(500);
    if(error){console.error(error);return}

    const latest=new Map();
    for(const row of rows||[]){
      try{
        const parsed=JSON.parse(row.body||'{}');
        const y=clean(parsed.year);
        if(y&&!latest.has(y))latest.set(y,normalizeBoard(parsed,y));
      }catch{}
    }

    for(const year of years){
      const existing=latest.get(year);
      const board=normalizeBoard(existing||defaultBoard(year),year);
      const before=stableData(board);
      mergeLegacy(board,legacy);
      const after=stableData(board);
      if(existing&&before===after)continue;

      const {error:insErr}=await sb.from('posts').insert({
        title:BOARD_TITLE,
        body:JSON.stringify(board),
        image_path:null,
        published:true
      });
      if(insErr)console.error('No se pudo migrar el año '+year,insErr);
    }
  }

  function ensureMigration(){
    if(!migrationPromise)migrationPromise=migrateLegacyYears().catch(e=>console.error('Error migrando años de resultados',e));
    return migrationPromise;
  }

  const original=window.renderAdminResultsMultiYear;
  if(typeof original==='function'){
    window.renderAdminResultsMultiYear=async function(){
      await ensureMigration();
      return original.apply(this,arguments);
    };
  }

  window.jdEnsureLegacyResultYears=ensureMigration;
})();