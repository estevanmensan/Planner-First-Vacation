{
const MONTH = 11, YEAR = 2026; // dezembro (0-index)
const BUCKET = 'fotos';
const WD = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WD_PT = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const T = (h,t,l)=>({h,t,l});
const treino = T('18h','treino','life'), cam = T('19h','caminhada','');
const DAYS = {
  1:[treino,cam], 2:[treino,cam],
  3:[T('14h','ficar juntos',"Ana's House"),treino],
  4:'X', 5:[T('14h','Requeijão',"Tete's House")],
  6:[T('19h','Raffus','Raffus-RGT')], 7:[treino,cam], 8:'X',
  9:[T('15h','treino','life')], 10:[treino,cam],
  11:[T('19h30','bingo','Salão Paroquial')], 12:[T('19h30','bingo','Salão Paroquial')],
  13:'?', 14:[treino,cam], 15:'X', 16:[T('15h','treino','life')],
  17:[T('15h','treino','Panobianco')], 18:[treino],
  19:[T('15h','treino','ProForma'),T('17h','Mequi','Mequi')],
  20:[T('14h','Dia com AMOR',"Tete's House")],
  21:[treino,cam], 22:[treino,cam], 23:[treino,cam],
  29:[T('19h30','Date','A definir')], 31:'?'
};

const $ = id=>document.getElementById(id);
const esc = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let photos = {};      // dia -> [{id, caminho, url}]
let user = null;
let openDay = null, lbList = [], lbIdx = 0;
let custom = {};                       // dia -> {tipo, eventos} salvo no Supabase
let editing = false, draft = [], draftTipo = 'eventos';

// Programação do dia: a versão editada (se houver) tem prioridade sobre a original
function dayData(n){
  const c = custom[n];
  if(!c) return DAYS[n];
  if(c.tipo === 'X' || c.tipo === '?') return c.tipo;
  return c.eventos.length ? c.eventos : undefined;
}

function setStatus(txt, cls){ $('statusTxt').textContent = txt; $('status').className = 'status ' + (cls||''); }

/* ---------- Supabase ---------- */
const cfg = window.PLANNER_CONFIG || {};
const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('SEU-PROJETO') && cfg.SUPABASE_KEY && !cfg.SUPABASE_KEY.includes('COLE-AQUI');
const sb = (configured && window.supabase) ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY) : null;

async function shrink(file){
  try{
    const bmp = await createImageBitmap(file);
    const max = 1800, k = Math.min(1, max/Math.max(bmp.width,bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width*k); c.height = Math.round(bmp.height*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b||file),'image/jpeg',.85));
  }catch(e){ return file; }
}

async function loadPhotos(){
  if(!sb || !user){ photos = {}; render(); return; }
  setStatus('Carregando fotos…');
  const { data, error } = await sb.from('fotos').select('id,dia,caminho,criado_em').order('criado_em');
  if(error){ setStatus('Não consegui carregar as fotos: ' + error.message, 'warn'); return; }
  const out = {};
  if(data.length){
    // Links temporários (1 dia) porque o bucket é privado
    const { data: signed, error: e2 } = await sb.storage.from(BUCKET).createSignedUrls(data.map(r=>r.caminho), 60*60*24);
    if(e2){ setStatus('Erro ao gerar links das fotos: ' + e2.message, 'warn'); return; }
    const urlOf = {}; signed.forEach(s=>{ if(s.signedUrl) urlOf[s.path] = s.signedUrl; });
    data.forEach(r=>{ if(urlOf[r.caminho]) (out[r.dia] ||= []).push({id:r.id, caminho:r.caminho, url:urlOf[r.caminho]}); });
  }
  photos = out;
  setStatus('Fotos salvas online — aparecem em qualquer aparelho', 'ok');
  render(); if(openDay) renderGallery();
}

async function addPhoto(dia, file){
  const blob = await shrink(file);
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop() || 'jpg').toLowerCase();
  const caminho = `dia-${dia}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(caminho, blob, { contentType: blob.type || 'image/jpeg' });
  if(up.error) throw up.error;
  const ins = await sb.from('fotos').insert({ dia, caminho });
  if(ins.error){ await sb.storage.from(BUCKET).remove([caminho]); throw ins.error; }
}

async function removePhoto(p){
  const st = await sb.storage.from(BUCKET).remove([p.caminho]);
  if(st.error) throw st.error;
  const del = await sb.from('fotos').delete().eq('id', p.id);
  if(del.error) throw del.error;
}

/* ---------- Login ---------- */
function showAuth(){
  $('loginForm').hidden = !!user || !sb;
  $('userBar').hidden = !user;
  if(user) $('userTxt').textContent = 'Conectado como ' + user.email;
}

$('loginForm').addEventListener('submit', async e=>{
  e.preventDefault();
  $('entrar').disabled = true; $('loginMsg').textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('senha').value });
  $('entrar').disabled = false;
  $('loginMsg').textContent = error ? 'Não deu certo: confira o e-mail e a senha.' : 'Entre para ver e adicionar as fotos de cada dia.';
});
$('sair').onclick = ()=>sb.auth.signOut();

/* ---------- Leque de fotos ---------- */
// 1 foto: centralizada com respiro. 2+ fotos: até 4 cartas abertas em leque sobre o rosa do planner.
function fan(ph){
  if(ph.length === 1) return `<span class="fan single"><img src="${esc(ph[0].url)}" alt="" loading="lazy"></span>`;
  const shown = ph.slice(-4);                 // as 4 mais recentes
  const n = shown.length, abertura = {2:16, 3:26, 4:34}[n];
  const cards = shown.map((p,i)=>{
    const r = -abertura/2 + i*abertura/(n-1);
    return `<img class="card" src="${esc(p.url)}" alt="" loading="lazy" style="--r:${r.toFixed(1)}deg;--i:${i}">`;
  }).join('');
  return `<span class="fan multi">${cards}</span>`;
}

/* ---------- Calendário ---------- */
function render(){
  const first = new Date(YEAR,MONTH,1).getDay();
  const total = new Date(YEAR,MONTH+1,0).getDate();
  const now = new Date(); const todayN = (now.getFullYear()===YEAR && now.getMonth()===MONTH) ? now.getDate() : 0;
  let h = WD.map(w=>`<div class="wd">${w}</div>`).join('');
  const cells = Math.ceil((first+total)/7)*7;
  for(let i=0;i<cells;i++){
    const n = i-first+1;
    if(n<1||n>total){ h += `<div class="day blank" aria-hidden="true"></div>`; continue; }
    const d = dayData(n), ph = photos[n]||[];
    let inner = '';
    if(ph.length){
      // Dia com fotos: as fotos ocupam o quadro e a programação vira uma legenda curta
      const cap = Array.isArray(d) ? d.map(e=>`${esc(e.h)} ${esc(e.t)}`).join(' · ') : '';
      inner = fan(ph) + (cap ? `<span class="cap">${cap}</span>` : '') + `<span class="count">${ph.length} foto${ph.length>1?'s':''}</span>`;
    }
    else if(d==='X'||d==='?') inner = `<span class="mark">${d}</span>`;
    else if(d) inner = d.map(e=>`<span class="ev">${esc(e.h)} – ${esc(e.t)}${e.l?`<small>Local: ${esc(e.l)}</small>`:''}</span>`).join('');
    const wd = new Date(YEAR,MONTH,n).getDay();
    h += `<button class="day${n===todayN?' today':''}${ph.length?' has-ph':''}" data-d="${n}" aria-label="${n} de dezembro, ${WD_PT[wd]}${ph.length?`, ${ph.length} foto${ph.length>1?'s':''}`:''}">
      <span class="num">${n}</span><span class="dname">${WD_PT[wd].slice(0,3)}</span>${inner}
      <svg class="add" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8.5 6l1.5-2h4l1.5 2"/></svg></button>`;
  }
  $('cal').innerHTML = h;
}

/* ---------- Modal do dia ---------- */
function openModal(n){
  openDay = n; editing = false;
  $('confirmBox').innerHTML = '';
  renderAgenda();
  renderGallery();
  $('dlg').showModal();
}

/* ---------- Programação do dia (ver e editar) ---------- */
function renderAgenda(){
  const n = openDay, wd = new Date(YEAR,MONTH,n).getDay(), d = dayData(n);
  $('dTitle').textContent = `${n} de dezembro`;
  $('dSub').textContent = WD_PT[wd] + (d==='X' ? ' · dia livre' : d==='?' ? ' · a definir' : '');
  if(editing) return renderEditor();
  const lista = Array.isArray(d) && d.length
    ? `<ul class="agenda">${d.map(e=>`<li><b>${esc(e.h)}</b><span>${esc(e.t)}${e.l?`<small>Local: ${esc(e.l)}</small>`:''}</span></li>`).join('')}</ul>`
    : `<p class="empty" style="text-align:left;padding:0 0 10px">${d==='X'?'Dia livre.':d==='?'?'Programação a definir.':'Nada programado.'}</p>`;
  $('agendaBox').innerHTML = lista + (user && sb ? `<button class="btn ghost small" type="button" id="editBtn">Editar programação</button>` : '');
  if($('editBtn')) $('editBtn').onclick = ()=>{ editing = true; draft = Array.isArray(d) ? d.map(e=>({...e})) : []; draftTipo = (d==='X'||d==='?') ? d : 'eventos'; renderAgenda(); };
}

function renderEditor(){
  const n = openDay;
  const linhas = draft.map((e,i)=>`
    <div class="erow">
      <input aria-label="Horário" placeholder="18h" maxlength="10" value="${esc(e.h)}" data-i="${i}" data-k="h">
      <input aria-label="Atividade" placeholder="Atividade" maxlength="60" value="${esc(e.t)}" data-i="${i}" data-k="t">
      <input aria-label="Local" placeholder="Local (opcional)" maxlength="60" value="${esc(e.l)}" data-i="${i}" data-k="l">
      <button type="button" class="x" data-rm="${i}" aria-label="Remover horário">×</button>
    </div>`).join('');
  $('agendaBox').innerHTML = `
    <div class="editor">
      <label class="tipo">Este dia é
        <select id="tipoSel">
          <option value="eventos"${draftTipo==='eventos'?' selected':''}>Com programação</option>
          <option value="X"${draftTipo==='X'?' selected':''}>Dia livre (X)</option>
          <option value="?"${draftTipo==='?'?' selected':''}>A definir (?)</option>
        </select>
      </label>
      <div id="linhas"${draftTipo!=='eventos'?' hidden':''}>${linhas}
        <button type="button" class="btn ghost small" id="addLinha">+ Adicionar horário</button>
      </div>
      <div class="eact">
        <button type="button" class="btn" id="salvar">Salvar</button>
        <button type="button" class="btn ghost" id="cancelar">Cancelar</button>
        ${custom[n] ? `<button type="button" class="btn ghost" id="restaurar">Voltar ao original</button>` : ''}
      </div>
      <p class="msg" id="editMsg"></p>
    </div>`;
  $('agendaBox').querySelectorAll('input[data-i]').forEach(inp=>inp.oninput = ()=>{ draft[+inp.dataset.i][inp.dataset.k] = inp.value; });
  $('agendaBox').querySelectorAll('[data-rm]').forEach(b=>b.onclick = ()=>{ draft.splice(+b.dataset.rm,1); renderEditor(); });
  $('addLinha').onclick = ()=>{ draft.push({h:'',t:'',l:''}); renderEditor(); const ins = $('agendaBox').querySelectorAll('input[data-k="h"]'); ins[ins.length-1].focus(); };
  $('tipoSel').onchange = e=>{ draftTipo = e.target.value; $('linhas').hidden = draftTipo!=='eventos'; };
  $('cancelar').onclick = ()=>{ editing = false; renderAgenda(); };
  $('salvar').onclick = salvarDia;
  if($('restaurar')) $('restaurar').onclick = async ()=>{
    const { error } = await sb.from('programacao').delete().eq('dia', n);
    if(error) return $('editMsg').textContent = 'Não consegui restaurar: ' + error.message;
    delete custom[n]; editing = false; renderAgenda(); render();
  };
}

async function salvarDia(){
  const n = openDay;
  const eventos = draftTipo==='eventos'
    ? draft.map(e=>({h:(e.h||'').trim(), t:(e.t||'').trim(), l:(e.l||'').trim()})).filter(e=>e.h||e.t)
    : [];
  $('salvar').disabled = true; $('editMsg').textContent = 'Salvando…';
  const { error } = await sb.from('programacao').upsert({ dia:n, tipo:draftTipo, eventos, atualizado_em:new Date().toISOString() });
  if($('salvar')) $('salvar').disabled = false;
  if(error){ $('editMsg').textContent = 'Não consegui salvar: ' + error.message; return; }
  custom[n] = { tipo:draftTipo, eventos };
  editing = false; renderAgenda(); render();
}

async function loadProgramacao(){
  if(!sb) return;
  const { data, error } = await sb.from('programacao').select('dia,tipo,eventos');
  if(error){ console.warn('programacao:', error.message); return; }
  custom = {};
  data.forEach(r=>{ custom[r.dia] = { tipo:r.tipo, eventos:Array.isArray(r.eventos) ? r.eventos : [] }; });
  render(); if(openDay && !editing) renderAgenda();
}

function renderGallery(){
  const list = photos[openDay]||[];
  $('drop').style.display = user ? '' : 'none';
  if(!user){ $('gal').innerHTML = `<p class="empty" style="grid-column:1/-1">Entre com sua conta para ver e adicionar fotos.</p>`; return; }
  $('gal').innerHTML = list.length
    ? list.map((p,i)=>`<div class="ph"><img src="${esc(p.url)}" alt="Foto ${i+1} do dia ${openDay}" data-i="${i}"><button data-del="${i}" aria-label="Apagar foto ${i+1}">×</button></div>`).join('')
    : `<p class="empty" style="grid-column:1/-1">Nenhuma foto neste dia ainda.</p>`;
}

async function addFiles(files){
  const imgs = [...files].filter(f=>f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(f.name));
  if(!imgs.length || !user) return;
  const b = $('pick'), dia = openDay; b.disabled = true;
  let ok = 0, fail = 0;
  for(const f of imgs){
    $('dropHint').textContent = `Enviando ${ok+fail+1} de ${imgs.length}…`;
    try{ await addPhoto(dia, f); ok++; }catch(e){ fail++; console.warn(e); }
  }
  b.disabled = false;
  $('dropHint').textContent = fail ? `${ok} enviada(s), ${fail} não puderam ser salvas.` : 'ou arraste as imagens para cá';
  await loadPhotos();
}

function askDelete(i){
  const p = (photos[openDay]||[])[i]; if(!p) return;
  $('confirmBox').innerHTML = `<div class="confirm"><span>Apagar esta foto para sempre?</span><button class="btn" id="yesDel">Apagar</button><button class="btn ghost" id="noDel">Cancelar</button></div>`;
  $('yesDel').onclick = async ()=>{ $('confirmBox').innerHTML=''; try{ await removePhoto(p); }catch(e){ setStatus('Não foi possível apagar: ' + e.message,'warn'); } await loadPhotos(); };
  $('noDel').onclick = ()=>{ $('confirmBox').innerHTML=''; };
}

function showLb(i){ lbList = photos[openDay]||[]; lbIdx = i; $('lbImg').src = lbList[i].url; if(!$('lb').open) $('lb').showModal(); }
function stepLb(k){ if(!lbList.length) return; lbIdx = (lbIdx+k+lbList.length)%lbList.length; $('lbImg').src = lbList[lbIdx].url; }

/* ---------- Eventos ---------- */
$('cal').addEventListener('click', e=>{ const b = e.target.closest('.day[data-d]'); if(b) openModal(+b.dataset.d); });
$('close').onclick = ()=>$('dlg').close();
$('dlg').addEventListener('close', ()=>{ openDay = null; });
$('dlg').addEventListener('click', e=>{ if(e.target===$('dlg')) $('dlg').close(); });
$('pick').onclick = ()=>$('file').click();
$('file').onchange = e=>{ addFiles(e.target.files); e.target.value=''; };
const drop = $('drop');
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop', e=>addFiles(e.dataTransfer.files));
$('gal').addEventListener('click', e=>{
  const del = e.target.closest('[data-del]'); if(del) return askDelete(+del.dataset.del);
  const im = e.target.closest('img[data-i]'); if(im) showLb(+im.dataset.i);
});
$('lbClose').onclick = ()=>$('lb').close();
$('lbPrev').onclick = ()=>stepLb(-1);
$('lbNext').onclick = ()=>stepLb(1);
$('lb').addEventListener('keydown', e=>{ if(e.key==='ArrowLeft') stepLb(-1); if(e.key==='ArrowRight') stepLb(1); });
// Ao voltar para a aba, busca fotos novas enviadas de outro aparelho
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) return; loadProgramacao(); if(user) loadPhotos(); });

/* ---------- Início ---------- */
render();
if(!sb){
  setStatus(configured ? 'Não consegui carregar a biblioteca do Supabase.' : 'Falta configurar o Supabase no arquivo config.js.', 'warn');
}else{
  loadProgramacao();
  sb.auth.onAuthStateChange((_ev, session)=>{
    const novo = session ? session.user : null;
    const mudou = (novo && novo.id) !== (user && user.id);
    user = novo; showAuth(); if(openDay && !editing) renderAgenda();
    if(!user){ photos = {}; render(); setStatus('Entre para ver as fotos.'); }
    else if(mudou) setTimeout(loadPhotos, 0);
  });
}
}
