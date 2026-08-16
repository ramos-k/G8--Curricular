const AREAS = {
  produccion:  {name:'Producción', color:'produccion',
    folders:[
      {id:'pautas', name:'Pautas'},
      {id:'guion', name:'Guion'},
      {id:'catering', name:'Catering'},
      {id:'equipos', name:'Equipos'},
      {id:'cronograma', name:'Cronograma de trabajo'},
      {id:'scouting', name:'Scouting'},
      {id:'formularios', name:'Formularios'},
      {id:'finanzas', name:'Finanzas'},
      {id:'general', name:'General'},
    ]},
  arte: {name:'Arte', color:'arte',
    folders:[
      {id:'pautas', name:'Pautas'},
      {id:'desglose', name:'Desglose'},
      {id:'finanzas', name:'Finanzas'},
      {id:'cronograma', name:'Cronograma de trabajo'},
      {id:'referencias', name:'Referencias'},
      {id:'pedidos', name:'Pedidos'},
      {id:'scouting', name:'Scouting'},
    ]},
  foto: {name:'Fotografía', color:'foto',
    folders:[
      {id:'pautas', name:'Pautas'},
      {id:'equipamiento', name:'Equipamiento', type:'link'},
      {id:'propuestas', name:'Propuestas'},
      {id:'scouting', name:'Scouting'},
      {id:'cronograma', name:'Cronograma de trabajo'},
      {id:'planilla', name:'Planilla'},
    ]},
  sonido: {name:'Sonido', color:'sonido',
    folders:[
      {id:'pautas', name:'Pautas'},
      {id:'equipamiento', name:'Equipamiento', type:'link'},
      {id:'propuestas', name:'Propuestas'},
      {id:'scouting', name:'Scouting'},
      {id:'cronograma', name:'Cronograma de trabajo'},
      {id:'planilla', name:'Planilla'},
    ]},
  guion: {name:'Guion', color:'guion',
    folders:[
      {id:'pautas', name:'Pautas'},
      {id:'cronograma', name:'Cronograma de trabajo'},
      {id:'guion', name:'Guion'},
      {id:'documentos', name:'Documentos'},
    ]},
  montaje: {name:'Montaje', color:'montaje',
    folders:[
      {id:'pautas', name:'Pautas'},
      {id:'planilla', name:'Planilla'},
      {id:'referencias', name:'Referencias'},
      {id:'bajada', name:'Bajada'},
      {id:'cronograma', name:'Cronograma de trabajo'},
    ]},
  realizacion: {name:'Realización', color:'realizacion',
    folders:[
      {id:'pautas', name:'Pautas'},
      {id:'plan_rodaje', name:'Plan de rodaje'},
      {id:'guion_tecnico', name:'Guion técnico'},
      {id:'cronograma', name:'Cronograma de trabajo'},
      {id:'call_sheet', name:'Call sheet'},
      {id:'storyboard', name:'Storyboard'},
      {id:'guion', name:'Guion'},
      {id:'scouting', name:'Scouting'},
    ]},
};

const CARPETA = {name:'Carpeta', color:'carpeta',
  folders:[
    {id:'entregaA', name:'Entrega A'},
    {id:'entregaB', name:'Entrega B'},
    {id:'entregaC', name:'Entrega C'},
  ]};

const FIRESTORE_MAX_BYTES = 780 * 1024; // ~780KB de archivo original (techo real: Firestore permite ~1MB por documento)

function folderKey(area, folder){ return area+'__'+folder; }

async function getFiles(areaId, folderId){
  const key = folderKey(areaId, folderId);
  const snap = await db.collection('files').where('folderKey','==',key).orderBy('createdAt','asc').get();
  return snap.docs.map(d=>({id:d.id, ...d.data()}));
}
async function getFileContent(id){
  const doc = await db.collection('fileContents').doc(id).get();
  return doc.exists ? doc.data().dataUrl : null;
}
async function addFileDoc(areaId, folderId, data){
  const { dataUrl, ...meta } = data;
  const ref = await db.collection('files').add({
    folderKey: folderKey(areaId, folderId), areaId, folderId,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...meta
  });
  if(dataUrl){ await db.collection('fileContents').doc(ref.id).set({dataUrl}); }
}
async function renameFileDoc(id, name){ await db.collection('files').doc(id).update({name}); }
async function deleteFileDoc(id){
  await db.collection('files').doc(id).delete();
  try{ await db.collection('fileContents').doc(id).delete(); }catch(e){ }
}

/*Google Drive*/
function driveEmbedUrl(url){
  if(!url) return null;
  let m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if(m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  m = url.match(/drive\.google\.com\/.*[?&]id=([a-zA-Z0-9_-]+)/);
  if(m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return null;
}


async function getLink(areaId, folderId){
  const key = folderKey(areaId, folderId);
  const doc = await db.collection('links').doc(key).get();
  return doc.exists ? (doc.data().url || '') : '';
}
async function setLink(areaId, folderId, url){
  const key = folderKey(areaId, folderId);
  await db.collection('links').doc(key).set({url});
}

async function getCalendarEvents(){
  const snap = await db.collection('calendarEvents').orderBy('createdAt','asc').get();
  const map = {};
  snap.docs.forEach(d=>{
    const data = d.data();
    if(!map[data.date]) map[data.date] = [];
    map[data.date].push({id:d.id, text:data.text});
  });
  return map;
}
async function addCalendarEvent(date, text){
  await db.collection('calendarEvents').add({date, text, createdAt: firebase.firestore.FieldValue.serverTimestamp()});
}
async function deleteCalendarEvent(id){ await db.collection('calendarEvents').doc(id).delete(); }

function go(hash){ location.hash = hash; }
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

function parseHash(){ return location.hash.replace(/^#\/?/,'').split('/').filter(Boolean); }

function render(){
  if(typeof db === 'undefined'){ renderSetupError(); return; }

  const parts = parseHash();
  const app = document.getElementById('app');
  window.scrollTo(0,0);
  document.body.classList.toggle('is-home', parts.length===0);

  if(parts.length===0){ app.innerHTML = renderIndex(); attachIndexEvents(); return; }

  if(parts[0]==='calendario'){ loadCalendarPage(); return; }

  if(parts[0]==='carpeta'){
    if(parts[1]){ loadFolderDetail('carpeta', parts[1], CARPETA); }
    else { app.innerHTML = renderTopbar([{label:'Carpeta'}]) + renderFoldersGrid(CARPETA,'carpeta'); attachFoldersGridEvents('carpeta'); }
    return;
  }

  if(AREAS[parts[0]]){
    const area = AREAS[parts[0]];
    if(parts[1]){
      const fdef = area.folders.find(f=>f.id===parts[1]);
      if(fdef && fdef.type==='link'){ loadLinkFolder(parts[0], fdef, area); }
      else { loadFolderDetail(parts[0], parts[1], area); }
    } else {
      app.innerHTML = renderTopbar([{label:area.name}]) + renderFoldersGrid(area, parts[0]);
      attachFoldersGridEvents(parts[0]);
    }
    return;
  }

  app.innerHTML = renderIndex(); attachIndexEvents();
}
function folderLabel(areaDef, id){ const f = areaDef.folders.find(x=>x.id===id); return f?f.name:id; }

function renderSetupError(){
  document.getElementById('app').innerHTML = `
    <div class="panel" style="max-width:520px;margin:60px auto;">
      <h3>Falta conectar Firebase</h3>
      <div style="font-size:13.5px;line-height:1.7;color:var(--ink-soft);">
        .. <code>firebase-config.js</code> error básicamente <code>script.js</code>. Revisa el
        <code>&lt;head&gt;</code> de <code>index.html baby</code>.
      </div>
    </div>`;
}


function renderTopbar(crumbs){
  let html = `<div class="topbar"><div class="crumb"><button class="home-btn" onclick="go('')">🏠</button>`;
  html += `<button onclick="go('')">Inicio</button>`;
  crumbs.forEach(c=>{
    html += `<span class="sep">/</span>`;
    html += c.hash ? `<button onclick="go('${c.hash}')">${c.label}</button>` : `<span class="current">${c.label}</span>`;
  });
  html += `</div></div>`;
  return html;
}

function renderIndex(){
  const items = [
    {id:'calendario',name:'Calendario',color:'calendario'},
    {id:'carpeta',name:'Carpeta',color:'carpeta'},
    {id:'guion', name:AREAS.guion.name, color:AREAS.guion.color},
    {id:'realizacion', name:AREAS.realizacion.name, color:AREAS.realizacion.color},
    {id:'produccion', name:AREAS.produccion.name, color:AREAS.produccion.color},
    {id:'arte', name:AREAS.arte.name, color:AREAS.arte.color},
    {id:'foto', name:AREAS.foto.name, color:AREAS.foto.color},
    {id:'sonido', name:AREAS.sonido.name, color:AREAS.sonido.color},
    {id:'montaje', name:AREAS.montaje.name, color:AREAS.montaje.color},
  ];
  return `
  <div class="index-page">
    <div class="hero">
      <h1>Curricular</h1>
      <div class="sub">Grupo 8</div>
    </div>
    <div class="pills">
      ${items.map((it,i)=>`
        <button class="pill" data-hash="${it.id}" style="background:var(--c-${it.color});">
          <span>${it.name}</span>
        </button>`).join('')}
    </div>
  </div>`;
}
function attachIndexEvents(){
  document.querySelectorAll('.pill').forEach(btn=> btn.addEventListener('click', ()=> go(btn.dataset.hash)));
}

function renderFoldersGrid(areaDef, areaId){
  return `
  <div class="section-title">${areaDef.name}</div>
  <div class="section-sub">Dale click a la carpeta que necesites visualizar. :)</div>
  <div class="folder-grid">
    ${areaDef.folders.map(f=>`
      <div class="folder-card" data-folder="${f.id}">
        <div class="folder-icon">
          <div class="folder-tab" style="background:var(--c-${areaDef.color}-b);"></div>
          <div class="folder-body" style="background:var(--c-${areaDef.color});border-color:var(--c-${areaDef.color}-b);">${f.name.charAt(0).toUpperCase()}</div>
        </div>
        <div class="folder-name">${f.name}</div>
      </div>`).join('')}
  </div>`;
}
function attachFoldersGridEvents(areaId){
  document.querySelectorAll('.folder-card').forEach(card=>{
    card.addEventListener('click', ()=> go(areaId+'/'+card.dataset.folder));
  });
}

async function loadLinkFolder(areaId, fdef, area){
  const app = document.getElementById('app');
  app.innerHTML = renderTopbar([{label:area.name,hash:areaId},{label:fdef.name}]) + `
    <div class="section-title">${fdef.name}</div>
    <div class="section-sub">Link para archivo de Drive, etc</div>
    <div class="panel link-card" id="link-panel"><div class="loading">Cargando…</div></div>`;
  const url = await getLink(areaId, fdef.id);
  renderLinkPanel(areaId, fdef, url);
}
function renderLinkPanel(areaId, fdef, url){
  const panel = document.getElementById('link-panel');
  panel.innerHTML = `
    <div>
      <div style="font-weight:700;margin-bottom:6px;">${url ? 'Documento configurado' : 'Todavía no configuraste el link'}</div>
      <div class="link-url">${url ? url : 'Agregá el link a tu documento de equipamiento.'}</div>
    </div>
    <div style="display:flex;gap:8px;">
      ${url ? `<button class="btn ghost" id="open-link">Abrir ↗</button>` : ''}
      <button class="btn" id="edit-link">${url?'Editar link':'Agregar link'}</button>
    </div>`;
  const openBtn = document.getElementById('open-link');
  if(openBtn) openBtn.addEventListener('click', ()=> window.open(url,'_blank'));
  document.getElementById('edit-link').addEventListener('click', ()=>{
    openModal(`
      <h4>Link de ${fdef.name}</h4>
      <div class="field"><label>URL del documento</label>
        <input type="url" id="link-input" placeholder="https://..." value="${url||''}">
      </div>
      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn" id="save-link">Guardar</button>
      </div>`);
    document.getElementById('save-link').addEventListener('click', async ()=>{
      const newUrl = document.getElementById('link-input').value.trim();
      const saveBtn = document.getElementById('save-link');
      saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
      try{ await setLink(areaId, fdef.id, newUrl); closeModal(); renderLinkPanel(areaId, fdef, newUrl); }
      catch(e){ alert('No se pudo guardar el link. Revisá tu conexión o avísale a tu produ'); console.error(e); }
    });
  });
}

async function loadFolderDetail(areaId, folderId, areaDef){
  const app = document.getElementById('app');
  const fdef = areaDef.folders.find(f=>f.id===folderId);
  app.innerHTML = renderTopbar([{label:areaDef.name,hash:areaId},{label:fdef?fdef.name:folderId}]) + `
    <div class="section-title">${fdef?fdef.name:folderId}</div>
    <div class="section-sub">Aquí podrás sumar todos los documentos que correspondan al curricular. :)</div>
    <div class="panel">
      <h3>Archivos <button class="btn sm" id="add-file">+ Subir</button></h3>
      <div class="files-grid" id="files-grid"><div class="loading">Cargando…</div></div>
    </div>`;
  document.getElementById('add-file').addEventListener('click', ()=> openAddFileModal(areaId, folderId, ()=>refreshFilesGrid(areaId, folderId)));
  await refreshFilesGrid(areaId, folderId);
}

async function refreshFilesGrid(areaId, folderId){
  const grid = document.getElementById('files-grid');
  let files;
  try{ files = await getFiles(areaId, folderId); }
  catch(e){ grid.innerHTML = `<div class="empty">No se pudo cargar </div>`; console.error(e); return; }
  grid.innerHTML = files.length ? files.map(fileCardHtml).join('') : `<div class="empty">Todavía no se subió nada acá.</div>`;
  attachFileCardEvents(files, areaId, folderId);
}

function fileCardHtml(f){
  let thumb;
  if(f.kind==='image') thumb = `IMG`;
  else if(f.kind==='link') thumb = `LINK`;
  else thumb = `FILE`;
  return `<div class="file-card" data-id="${f.id}">
    <div class="file-thumb">${thumb}</div>
    <div class="file-name">${escapeHtml(f.name)}</div>
    <div class="file-actions">
      <button class="open-file">Abrir</button>
      <button class="rename-file">✎</button>
      <button class="del-file">🗑</button>
    </div>
  </div>`;
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

function attachFileCardEvents(files, areaId, folderId){
  document.querySelectorAll('.file-card').forEach(card=>{
    const f = files.find(x=>x.id===card.dataset.id);
    card.querySelector('.open-file').addEventListener('click', ()=> showFilePreview(f));
    card.querySelector('.rename-file').addEventListener('click', ()=>{
      openModal(`
        <h4>Renombrar archivo</h4>
        <div class="field"><label>Nombre a mostrar</label>
          <input type="text" id="rename-input" value="${escapeHtml(f.name)}">
        </div>
        <div class="modal-actions">
          <button class="btn ghost" onclick="closeModal()">Cancelar</button>
          <button class="btn" id="save-rename">Guardar</button>
        </div>`);
      document.getElementById('save-rename').addEventListener('click', async ()=>{
        const newName = document.getElementById('rename-input').value.trim() || f.name;
        try{ await renameFileDoc(f.id, newName); closeModal(); await refreshFilesGrid(areaId, folderId); }
        catch(e){ alert('No se pudo renombrar.'); console.error(e); }
      });
    });
    card.querySelector('.del-file').addEventListener('click', async ()=>{
      if(!confirm(`¿Borrar "${f.name}" para todo el grupo?`)) return;
      try{ await deleteFileDoc(f.id); await refreshFilesGrid(areaId, folderId); }
      catch(e){ alert('No se pudo borrar.'); console.error(e); }
    });
  });
}

async function showFilePreview(f){
  if(f.kind==='link'){
    const embed = driveEmbedUrl(f.url);
    const inner = embed
      ? `<iframe class="preview-frame" src="${embed}" allow="autoplay"></iframe>`
      : `<div class="preview-empty">Este link no se puede mostrar. <br>Se abre en una pestaña nueva.</div>`;
    openModal(`
      <h4>${escapeHtml(f.name)}</h4>
      ${inner}
      <div class="modal-actions">
        <a class="download-link" href="${f.url}" target="_blank" rel="noopener">↗ Abrir en pestaña nueva</a>
        <button class="btn" onclick="closeModal()">Cerrar</button>
      </div>`, {wide:true});
    return;
  }

  openModal(`<h4>${escapeHtml(f.name)}</h4><div class="loading">Cargando vista previa…</div>`, {wide:true});
  let dataUrl;
  try{ dataUrl = await getFileContent(f.id); }
  catch(e){
    document.getElementById('modal-root').querySelector('.loading').outerHTML = `<div class="preview-empty">No se pudo cargar la vista previa.</div>`;
    console.error(e); return;
  }
  let inner;
  if(f.kind==='image'){ inner = `<img class="preview-img" src="${dataUrl}">`; }
  else if(dataUrl && dataUrl.startsWith('data:application/pdf')){ inner = `<iframe class="preview-frame" src="${dataUrl}"></iframe>`; }
  else { inner = `<div class="preview-empty">No hay vista previa disponible para este tipo de archivo.<br>Puedes descargarlo con el botón de abajo.</div>`; }
  const filename = escapeHtml(f.originalName || f.name);
  openModal(`
    <h4>${escapeHtml(f.name)}</h4>
    ${inner}
    <div class="modal-actions">
      <a class="download-link" href="${dataUrl}" download="${filename}">⬇ Descargar</a>
      <button class="btn" onclick="closeModal()">Cerrar</button>
    </div>`, {wide:true});
}

function openAddFileModal(areaId, folderId, onDone){
  openModal(`
    <h4>Agregar archivo</h4>
    <div class="tabbar">
      <button class="tab-btn active" data-tab="upload">Subir archivo</button>
      <button class="tab-btn" data-tab="link">Pegar link</button>
    </div>
    <div class="field"><label>Nombre para mostrar</label>
      <input type="text" id="file-name" placeholder="Ej: Guion técnico v2">
    </div>
    <div id="tab-upload" class="field">
      <label>Máx. ~780KB, si el archivo fuera muy pesado puedes usar "Pegar link" y subirlo a la carpeta que les compartí.</label>
      <input type="file" id="file-input">
    </div>
    <div id="tab-link" class="field" style="display:none;"><label>URL</label><input type="url" id="file-url" placeholder="https://drive.google.com/..."></div>
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn" id="save-file">Guardar</button>
    </div>`);

  let mode = 'upload';
  document.querySelectorAll('.tab-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); mode = b.dataset.tab;
      document.getElementById('tab-upload').style.display = mode==='upload'?'block':'none';
      document.getElementById('tab-link').style.display = mode==='link'?'block':'none';
    });
  });

  document.getElementById('save-file').addEventListener('click', async ()=>{
    const nameInput = document.getElementById('file-name').value.trim();
    const saveBtn = document.getElementById('save-file');
    if(mode==='link'){
      const url = document.getElementById('file-url').value.trim();
      if(!url) return;
      saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
      try{ await addFileDoc(areaId, folderId, {name: nameInput || url, kind:'link', url}); closeModal(); onDone(); }
      catch(e){ alert('No se pudo guardar el link.'); console.error(e); saveBtn.disabled=false; saveBtn.textContent='Guardar'; }
      return;
    }
    const fi = document.getElementById('file-input');
    const file = fi.files[0];
    if(!file) return;
    if(file.size > FIRESTORE_MAX_BYTES){
      alert(`Ese archivo pesa ${(file.size/1024/1024).toFixed(2)}MB. El límite es ~780KB.\n\nUsa "Pegar Link", please`);
      return;
    }
    saveBtn.disabled = true; saveBtn.textContent = 'Subiendo…';
    const reader = new FileReader();
    reader.onload = async ()=>{
      const isImg = file.type.startsWith('image/');
      try{
        await addFileDoc(areaId, folderId, {name: nameInput || file.name, originalName:file.name, kind: isImg?'image':'file', dataUrl: reader.result});
        closeModal(); onDone();
      }catch(e){
        alert('No se pudo subir el archivo. Revisa tu conexión.');
        console.error(e); saveBtn.disabled=false; saveBtn.textContent='Guardar';
      }
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Modal helpers ---------- */
function openModal(innerHtml, opts){
  opts = opts || {};
  const cls = opts.wide ? 'modal wide' : 'modal';
  document.getElementById('modal-root').innerHTML = `<div class="overlay" id="overlay"><div class="${cls}">${innerHtml}</div></div>`;
  document.getElementById('overlay').addEventListener('click', e=>{ if(e.target.id==='overlay') closeModal(); });
}
function closeModal(){ document.getElementById('modal-root').innerHTML = ''; }

let calCursor = new Date();
let calEventsCache = {};
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DOWS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

async function loadCalendarPage(){
  const app = document.getElementById('app');
  app.innerHTML = renderTopbar([{label:'Calendario'}]) + `<div class="section-title">Calendario</div><div class="section-sub">Fechas de rodaje, entregas y postproducción.</div><div class="loading">Cargando…</div>`;
  try{ calEventsCache = await getCalendarEvents(); }
  catch(e){ document.getElementById('app').innerHTML += `<div class="empty">No se pudo cargar el calendario.</div>`; console.error(e); return; }
  renderCalendarView();
}

function renderCalendarView(){
  const app = document.getElementById('app');
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  const first = new Date(y,m,1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const today = new Date();
  let cells = '';
  for(let i=0;i<startDow;i++) cells += `<div class="cal-cell empty-cell"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const dateKey = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const notes = calEventsCache[dateKey] || [];
    const isToday = today.getFullYear()===y && today.getMonth()===m && today.getDate()===d;
    cells += `<div class="cal-cell ${isToday?'today':''}">
      <div class="cal-daynum">${d}</div>
      ${notes.map(n=>`<div class="cal-note" data-date="${dateKey}" data-id="${n.id}">${escapeHtml(n.text)}<button class="del">✕</button></div>`).join('')}
    </div>`;
  }
  app.innerHTML = renderTopbar([{label:'Calendario'}]) + `
  <div class="section-title">Calendario</div>
  <div class="section-sub">Fechas de rodaje, entregas y postproducción.</div>
  <div class="cal-head">
    <div class="cal-nav">
      <button id="cal-prev">‹</button>
      <div class="cal-month">${MONTHS[m]} ${y}</div>
      <button id="cal-next">›</button>
    </div>
    <button class="btn" id="cal-add">+ Añadir</button>
  </div>
  <div class="cal-grid">
    ${DOWS.map(d=>`<div class="cal-dow">${d}</div>`).join('')}
    ${cells}
  </div>`;
  attachCalendarEvents();
}

function attachCalendarEvents(){
  document.getElementById('cal-prev').addEventListener('click', ()=>{ calCursor.setMonth(calCursor.getMonth()-1); renderCalendarView(); });
  document.getElementById('cal-next').addEventListener('click', ()=>{ calCursor.setMonth(calCursor.getMonth()+1); renderCalendarView(); });
  document.getElementById('cal-add').addEventListener('click', ()=>{
    openModal(`
      <h4>Añadir al calendario</h4>
      <div class="field"><label>Fecha</label><input type="date" id="cal-date"></div>
      <div class="field"><label>Texto</label><input type="text" id="cal-text" placeholder="Ej: Rodaje"></div>
      <div class="modal-actions">
        <button class="btn ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn" id="cal-save">Guardar</button>
      </div>`);
    document.getElementById('cal-save').addEventListener('click', async ()=>{
      const date = document.getElementById('cal-date').value;
      const text = document.getElementById('cal-text').value.trim();
      if(!date || !text) return;
      const saveBtn = document.getElementById('cal-save');
      saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
      try{
        await addCalendarEvent(date, text);
        calEventsCache = await getCalendarEvents();
        closeModal(); renderCalendarView();
      }catch(e){ alert('No se pudo guardar.'); console.error(e); saveBtn.disabled=false; saveBtn.textContent='Guardar'; }
    });
  });
  document.querySelectorAll('.cal-note .del').forEach(x=>{
    x.addEventListener('click', async (e)=>{
      e.stopPropagation();
      const note = x.closest('.cal-note');
      const id = note.dataset.id;
      try{ await deleteCalendarEvent(id); calEventsCache = await getCalendarEvents(); renderCalendarView(); }
      catch(err){ alert('No se pudo borrar.'); console.error(err); }
    });
  });
}
