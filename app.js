/* ================================================================
   Meu Serviço — App de horas do Pioneiro Regular
   PWA offline, dados guardados localmente (localStorage).
   ================================================================ */
'use strict';

/* ---------- Constantes ---------- */
// Metas por tipo de pioneiro (regular ou auxiliar)
const GOALS = { regular:{ mes:50, ano:600 }, auxiliar:{ mes:30, ano:360 } };
function tipoPio(){ return (S.settings && S.settings.tipo==='auxiliar') ? 'auxiliar' : 'regular'; }
function metaMes(){ return GOALS[tipoPio()].mes; }   // horas por mês
function metaAno(){ return GOALS[tipoPio()].ano; }   // horas por ano de serviço
const STORE_KEY = 'ministerio.v1';

// Ícone do carrinho de publicações (expositor com rodinhas), desenhado em SVG
const ICON_CARRINHO = '<svg viewBox="0 0 24 24" width="1em" height="1em" style="vertical-align:-0.18em"><rect x="4.3" y="1.6" width="14.4" height="8.4" rx="1.7" fill="#3f8ed6"/><circle cx="8.1" cy="5.8" r="1.8" fill="#eaf3fb"/><rect x="11" y="4.2" width="5.7" height="1.4" rx="0.7" fill="#eaf3fb"/><rect x="11" y="6.5" width="4.2" height="1.3" rx="0.65" fill="#bfe0f7"/><rect x="5" y="10.3" width="13" height="3.5" rx="0.9" fill="#e8823c"/><rect x="5" y="14.2" width="13" height="3.5" rx="0.9" fill="#8e6fd1"/><rect x="6.4" y="17.6" width="1.7" height="2.4" rx="0.5" fill="#7a7f87"/><rect x="14.9" y="17.6" width="1.7" height="2.4" rx="0.5" fill="#7a7f87"/><circle cx="7.2" cy="20.4" r="1.8" fill="#3a2f36"/><circle cx="15.8" cy="20.4" r="1.8" fill="#3a2f36"/></svg>';

const MODALIDADES = [
  { id:'campo',       nome:'Campo',        emo:'🚪', cor:'var(--m-campo)' },
  { id:'revisita',    nome:'Revisita',     emo:'🔁', cor:'var(--m-revisita)' },
  { id:'estudo',      nome:'Estudo',       emo:'📖', cor:'var(--m-estudo)' },
  { id:'carta',       nome:'Carta',        emo:'✉️', cor:'var(--m-carta)' },
  { id:'carrinho',    nome:'Carrinho',     emo:'🛒', icon:ICON_CARRINHO, cor:'var(--m-carrinho)' },
  { id:'preparacao',  nome:'Preparação',   emo:'📝', cor:'var(--m-preparacao)' },
  { id:'deslocamento',nome:'Deslocamento', emo:'🚗', cor:'var(--m-deslocamento)' },
  { id:'informal',    nome:'Informal',     emo:'💬', cor:'var(--m-informal)' },
];
const modById = id => MODALIDADES.find(m=>m.id===id) || MODALIDADES[0];
// ícone visual (SVG quando houver, senão emoji). O emoji fica para textos puros (ex.: WhatsApp).
const ic = m => m.icon || m.emo;
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_LONG = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// Atividades espirituais padrão da rotina (a usuária pode adicionar/remover)
const ROTINA_PADRAO = [
  { id:'biblia',  nome:'Leitura da Bíblia',        emo:'📖', cor:'var(--m-estudo)',     freq:'diario' },
  { id:'examine', nome:'Leitura do Examine',        emo:'🗓️', cor:'var(--m-carta)',      freq:'diario' },
  { id:'quinta',  nome:'Preparação da reunião de meio de semana', emo:'📘', cor:'var(--m-revisita)', freq:'semanal', partes:2, prazo:'antes da reunião' },
  { id:'sabado',  nome:'Preparar reunião de fim de semana', emo:'📗', cor:'var(--m-campo)',    freq:'semanal', partes:1, prazo:'antes da reunião' },
  { id:'estudo',  nome:'Estudo pessoal',           emo:'✍️', cor:'var(--m-preparacao)', freq:'semanal', partes:1, temas:true },
];

/* ---------- Estado / armazenamento ---------- */
const defaultState = () => ({
  settings:{ onboardingDone:false, tipo:'regular', tema:'rose', focus:'ano', whatsapp:'', notifOn:false },
  sessions:[],   // {id,date:'YYYY-MM-DD',mod,minutes,note,contactId}
  planned:[],    // {id,date,mod,note}
  contacts:[],   // {id,type,name,address,phone,day,time,notes,history:[{date,note}]}
  historic:{},   // { 'YYYY-MM': minutos }  horas já feitas, lançadas manualmente
  abono:{},      // { 'YYYY-MM': minutos }  horas abonadas (creditadas por doença)
  sick:{},       // { 'YYYY-MM': 'observação' }  meses com observação de doença no relatório
  routine:{ tasks:[], prog:{}, temas:{} },  // rotina espiritual (atividades, progresso, temas de estudo)
  meta:{ lastReportMonth:'', lastNudge:'' }
});
let S = load();

function load(){
  try{ const raw = localStorage.getItem(STORE_KEY); if(raw) return Object.assign(defaultState(), JSON.parse(raw)); }
  catch(e){ console.warn('load falhou',e); }
  return defaultState();
}
function save(skipCloud){
  S.meta = S.meta || {};
  if(!skipCloud) S.meta.updatedAt = new Date().toISOString();
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(S)); }catch(e){}
  if(!skipCloud && window.schedulePush) window.schedulePush(S);  // sincroniza na nuvem (debounce)
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
function applyTheme(){
  try{
    const t = (S.settings && S.settings.tema==='azul') ? 'azul' : 'rose';
    document.documentElement.setAttribute('data-skin', t);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content', t==='azul' ? '#3f87bf' : '#c96a9e');
  }catch(e){}
}

/* ---------- Datas / ano de serviço ---------- */
const pad = n => String(n).padStart(2,'0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const parseISO = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
function fmtDataBR(iso){ const d=parseISO(iso); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }

// Ano de serviço: 1º de setembro a 31 de agosto.
function serviceYearBounds(ref=new Date()){
  const y = ref.getMonth() >= 8 ? ref.getFullYear() : ref.getFullYear()-1; // set(8)..dez -> começa neste ano
  return { start:new Date(y,8,1), end:new Date(y+1,7,31), label:`${y}/${y+1}` };
}
function daysBetween(a,b){ return Math.round((b-a)/86400000); }

/* ---------- Cálculos de horas ---------- */
const minToH = m => m/60;
const fmtH = m => { const h=Math.floor(m/60), mm=Math.round(m%60); return mm? `${h}h${pad(mm)}` : `${h}h`; };
const fmtHnum = m => (m/60).toFixed(1).replace('.',',');

function sessionsInRange(startISO,endISO){
  return S.sessions.filter(s => s.date>=startISO && s.date<=endISO);
}
function minutesInRange(startISO,endISO){
  return sessionsInRange(startISO,endISO).reduce((a,s)=>a+s.minutes,0);
}
// Horas históricas lançadas manualmente por mês (para quem começa no meio do ano de serviço).
function historicMin(monthKey){ return (S.historic && S.historic[monthKey]) || 0; }
function historicInRange(startISO,endISO){
  const a=startISO.slice(0,7), b=endISO.slice(0,7); let s=0;
  for(const k in (S.historic||{})){ if(k>=a && k<=b) s+=S.historic[k]; }
  return s;
}
// Horas abonadas (creditadas por doença) — contam para a meta como se tivessem sido feitas.
function abonoMin(monthKey){ return (S.abono && S.abono[monthKey]) || 0; }
function abonoInRange(startISO,endISO){
  const a=startISO.slice(0,7), b=endISO.slice(0,7); let s=0;
  for(const k in (S.abono||{})){ if(k>=a && k<=b) s+=S.abono[k]; }
  return s;
}
function isSick(monthKey){ return !!(S.sick && S.sick[monthKey]!=null); }
function currentMonthKey(d=new Date()){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
function monthBounds(d=new Date()){
  const s=new Date(d.getFullYear(),d.getMonth(),1);
  const e=new Date(d.getFullYear(),d.getMonth()+1,0);
  return {startISO:toISO(s), endISO:toISO(e), start:s, end:e};
}

// Painel do ano: total, projeção, se alcança a meta
function anoStats(ref=new Date()){
  const {start,end,label} = serviceYearBounds(ref);
  const startISO=toISO(start), endISO=toISO(end);
  const totalMin = minutesInRange(startISO,endISO) + historicInRange(startISO,endISO) + abonoInRange(startISO,endISO);
  const totalH = minToH(totalMin);
  const hoje = new Date(); const hojeC = hoje>end?end:(hoje<start?start:hoje);
  const diasDecorridos = Math.max(1, daysBetween(start,hojeC)+1);
  const diasTotais = daysBetween(start,end)+1;
  const diasRestantes = Math.max(0, daysBetween(hojeC,end));
  const ritmoDia = totalH/diasDecorridos;                 // h/dia atual
  const projecao = ritmoDia*diasTotais;                    // projeção fim do ano
  const restanteMeta = Math.max(0, metaAno()-totalH);
  const ritmoNecessario = diasRestantes>0 ? restanteMeta/diasRestantes : 0; // h/dia p/ fechar
  const noRitmo = projecao >= metaAno();
  return { label,startISO,endISO,totalMin,totalH,diasDecorridos,diasTotais,diasRestantes,
           ritmoDia,projecao,restanteMeta,ritmoNecessario,noRitmo,
           pct:Math.min(100, totalH/metaAno()*100) };
}
function mesStats(ref=new Date()){
  const {startISO,endISO,start,end}=monthBounds(ref);
  const totalMin=minutesInRange(startISO,endISO) + historicInRange(startISO,endISO) + abonoInRange(startISO,endISO);
  const totalH=minToH(totalMin);
  const hoje=new Date();
  const diaAtual = (hoje.getMonth()===ref.getMonth()&&hoje.getFullYear()===ref.getFullYear())?hoje.getDate():end.getDate();
  const diasNoMes=end.getDate();
  const restante=Math.max(0,metaMes()-totalH);
  const diasRest=Math.max(0,diasNoMes-diaAtual);
  return { totalH,totalMin,restante,diasRest,diasNoMes,pct:Math.min(100,totalH/metaMes()*100),
           mesNome:MESES_LONG[ref.getMonth()], ano:ref.getFullYear() };
}

/* ================================================================
   ROUTER
   ================================================================ */
let route = 'timer';
const app = () => document.getElementById('app');
function go(r){ route=r; render(); window.scrollTo(0,0); }

function chromeEl(){ let c=document.getElementById('chrome'); if(!c){ c=document.createElement('div'); c.id='chrome'; document.body.appendChild(c); } return c; }
function render(){
  applyTheme();
  if(!S.settings.onboardingDone){ renderOnboarding(); chromeEl().innerHTML=''; return; }
  const views = { timer:viewTimer, agenda:viewAgenda, rotina:viewRotina, ano:viewAno, contatos:viewContatos, stats:viewStats };
  const view = views[route] || viewTimer;
  app().innerHTML = topbar() + `<div class="screen">${view()}</div>`;
  chromeEl().innerHTML = nav() + fabFor();   // barra e botão + no nível da página (ficam fixos de verdade)
  const act=document.querySelector('.nav a.active'); if(act) try{ act.scrollIntoView({inline:'center',block:'nearest'}); }catch(e){}
  bindCommon();
  const bind = { timer:bindTimer, agenda:bindAgenda, rotina:bindRotina, ano:bindAno, contatos:bindContatos, stats:()=>{} }[route];
  bind && bind();
  checkBanners();
}

function topbar(){
  const titles={ timer:['Ministério do Reino','Registre seu tempo com alegria 💛'],
                 agenda:['Minha Agenda','Programe suas modalidades'],
                 rotina:['Minha Rotina','Constância nas coisas espirituais 🌱'],
                 ano:['Ano de Serviço','Rumo às '+metaAno()+' horas'],
                 contatos:['Estudos e Revisitas','Cuide de cada pessoa'],
                 stats:['Estatísticas','Equilíbrio no serviço'] };
  const [t,s]=titles[route]||titles.timer;
  return `<div class="topbar"><span class="crown">👑</span><h1>${t}</h1><div class="sub">${s}</div></div>`;
}
function nav(){
  const items=[['timer','⏱️','Início'],['agenda','📅','Agenda'],['rotina','📋','Rotina'],['ano','🎯','Ano'],['contatos','👥','Pessoas'],['stats','📊','Balanço']];
  return `<div class="nav">${items.map(([r,i,l])=>
    `<a data-go="${r}" class="${route===r?'active':''}"><span class="ico">${i}</span>${l}</a>`).join('')}</div>`;
}
function fabFor(){
  if(route==='timer') return `<button class="fab" data-act="addManual" title="Adicionar horas">＋</button>`;
  if(route==='contatos') return `<button class="fab" data-act="addContact">＋</button>`;
  if(route==='agenda') return `<button class="fab" data-act="planDay">＋</button>`;
  return '';
}
function bindCommon(){
  document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go));
  const fab=document.querySelector('.fab');
  if(fab) fab.onclick=()=>({addManual:sheetManual,addContact:()=>sheetContact(),planDay:()=>sheetPlan()})[fab.dataset.act]();
}

/* ================================================================
   TELA 1 — TIMER / INÍCIO
   ================================================================ */
let timer = { running:false, mod:'campo', start:0, elapsed:0, tick:null };
// Persiste o cronômetro para continuar contando mesmo se o app for fechado (baseado no relógio).
function saveTimerState(){ S.timerState={running:timer.running, mod:timer.mod, start:timer.start, elapsed:timer.elapsed}; save(); }
function hydrateTimer(){ const t=S.timerState; if(t){ timer.running=!!t.running; timer.mod=t.mod||'campo'; timer.start=t.start||0; timer.elapsed=t.elapsed||0; } }
function updateTimerNotification(){
  if(!('Notification' in window) || Notification.permission!=='granted' || !navigator.serviceWorker) return;
  navigator.serviceWorker.ready.then(reg=>{
    if(timer.running){
      const m=modById(timer.mod); const ini=new Date(timer.start - timer.elapsed);
      reg.showNotification('⏱️ Cronômetro em andamento', {
        body:`${m.nome} — contando desde ${pad(ini.getHours())}:${pad(ini.getMinutes())}. Toque para voltar e registrar.`,
        tag:'cronometro', requireInteraction:true, silent:true
      });
    } else { reg.getNotifications({tag:'cronometro'}).then(ns=>ns.forEach(n=>n.close())); }
  }).catch(()=>{});
}
function clearTimerNotification(){
  if(!navigator.serviceWorker) return;
  navigator.serviceWorker.ready.then(reg=>reg.getNotifications({tag:'cronometro'}).then(ns=>ns.forEach(n=>n.close()))).catch(()=>{});
}

function viewTimer(){
  const mes=mesStats(), ano=anoStats();
  const foco = S.settings.focus==='ano'
    ? {lbl:'Meta do ano', val:`${fmtHnum(ano.totalMin)} / ${metaAno()} h`, pct:ano.pct, ok:ano.noRitmo}
    : {lbl:`Meta de ${mes.mesNome}`, val:`${fmtHnum(mes.totalMin)} / ${metaMes()} h`, pct:mes.pct, ok:mes.pct>=100||mes.diasRest>0};
  const m=modById(timer.mod);
  return `
  <div class="card">
    <div class="timer-wrap" id="timerWrap">
      <div class="timer-ring"><div class="timer-inner">
        <div class="timer-time" id="tTime">00:00</div>
        <div class="timer-mod" id="tMod">${ic(m)} ${m.nome}</div>
      </div></div>
    </div>
    <div class="section-title" style="margin-top:16px">Escolha a modalidade</div>
    <div class="grid2" id="modGrid" style="grid-template-columns:repeat(3,1fr)">
      ${MODALIDADES.map(x=>`
        <button class="chip ${x.id===timer.mod?'active':''}" data-mod="${x.id}"
          style="${x.id===timer.mod?`background:${x.cor}`:''}">
          <span class="emo">${ic(x)}</span>${x.nome}</button>`).join('')}
    </div>
    <div style="margin-top:16px" class="grid2">
      <button class="btn ${timer.running?'ghost':''}" id="btnStart">${timer.running?'⏸ Pausar':'▶ Iniciar'}</button>
      <button class="btn gold" id="btnStop" ${timer.running||timer.elapsed?'':'disabled'}>✓ Registrar</button>
    </div>
    ${(timer.running||timer.elapsed)?`<button class="btn soft" id="btnReset" style="margin-top:10px">✕ Zerar cronômetro</button>`:''}
  </div>

  <div class="card">
    <div class="row between">
      <div><div class="small muted">${foco.lbl}</div><div style="font-size:19px;font-weight:800">${foco.val}</div></div>
      <div class="pill">${foco.ok?'😊 No ritmo':'💪 Vamos lá'}</div>
    </div>
    <div class="progress" style="margin-top:12px"><span style="width:${foco.pct}%"></span></div>
  </div>

  <div class="section-title">Hoje</div>
  ${sessionsHTMLdia(todayISO()) || `<div class="card flat empty"><span class="emo">🕊️</span>Nenhum registro hoje ainda.<br>Toque em <b>Iniciar</b> quando começar seu serviço.</div>`}
  `;
}

function sessionsHTMLdia(iso){
  const list=S.sessions.filter(s=>s.date===iso).sort((a,b)=>b.id.localeCompare(a.id));
  if(!list.length) return '';
  return `<div class="card">${list.map(s=>{const m=modById(s.mod);const c=s.contactId&&S.contacts.find(x=>x.id===s.contactId);
    return `<div class="list-item" data-del="${s.id}">
      <div class="avatar" style="background:${m.cor}">${ic(m)}</div>
      <div style="flex:1"><b>${m.nome}</b> · ${fmtH(s.minutes)}
        ${c?`<div class="small muted">com ${c.name}</div>`:''}
        ${s.note?`<div class="small muted">${esc(s.note)}</div>`:''}</div>
      <span class="muted small">✕</span>
    </div>`}).join('')}</div>`;
}

function bindTimer(){
  document.querySelectorAll('#modGrid .chip').forEach(c=>c.onclick=()=>{ timer.mod=c.dataset.mod; saveTimerState(); render(); });
  document.getElementById('btnStart').onclick=toggleTimer;
  document.getElementById('btnStop').onclick=stopTimerSave;
  const br=document.getElementById('btnReset'); if(br) br.onclick=resetTimer;
  document.querySelectorAll('[data-del]').forEach(el=>el.onclick=()=>{
    confirmSheet('Apagar este registro?','Apagar',()=>{ S.sessions=S.sessions.filter(x=>x.id!==el.dataset.del); save(); render(); });
  });
  if(timer.running) startTick();
  paintTimer();
}
function renderTimerHeader(){}
function toggleTimer(){
  if(timer.running){ timer.elapsed+=Date.now()-timer.start; timer.running=false; stopTick(); clearTimerNotification(); }
  else { timer.start=Date.now(); timer.running=true; }
  saveTimerState();
  render();  // re-renderiza para mostrar/ocultar o botão Zerar e o estado correto
}
function startTick(){ stopTick(); document.getElementById('timerWrap')?.classList.add('timer-run'); timer.tick=setInterval(paintTimer,1000); }
function stopTick(){ if(timer.tick){clearInterval(timer.tick);timer.tick=null;} }
function currentElapsedMs(){ return timer.elapsed + (timer.running?Date.now()-timer.start:0); }
function paintTimer(){
  const ms=currentElapsedMs(); const tot=Math.floor(ms/1000);
  const h=Math.floor(tot/3600),mn=Math.floor(tot%3600/60),sc=tot%60;
  const el=document.getElementById('tTime'); if(!el)return;
  el.textContent = h? `${h}:${pad(mn)}:${pad(sc)}` : `${pad(mn)}:${pad(sc)}`;
  const m=modById(timer.mod); const md=document.getElementById('tMod'); if(md) md.innerHTML=`${ic(m)} ${esc(m.nome)}`;
}
function stopTimerSave(){
  const ms=currentElapsedMs(); const minutes=Math.max(1,Math.round(ms/60000));
  stopTick(); timer.running=false; timer.elapsed=0; timer.start=0;
  saveTimerState(); clearTimerNotification();
  sheetConfirmSession(timer.mod, minutes);
}
function resetTimer(){
  const doIt=()=>{ stopTick(); timer.running=false; timer.elapsed=0; timer.start=0; saveTimerState(); clearTimerNotification(); render(); toast('Cronômetro zerado'); };
  if(currentElapsedMs()>=5000) confirmSheet('Zerar o cronômetro? O tempo atual será descartado.','Zerar',doIt);
  else doIt();
}

/* ================================================================
   ADICIONAR / EDITAR SESSÃO
   ================================================================ */
function sheetConfirmSession(mod,minutes){
  const contatos=S.contacts;
  let rows=[{mod:mod, min:minutes}];   // uma ou mais modalidades com seu tempo
  openSheet(`
    <h3>Registrar tempo</h3>
    <p class="muted small" style="margin:0 0 14px">Se fez mais de uma modalidade, separe o tempo de cada uma. 💛</p>
    <div id="rowsBox"></div>
    <button type="button" class="btn soft sm" id="addRow" style="width:auto;margin-bottom:6px">＋ Adicionar modalidade</button>
    <div id="allocInfo" class="small" style="margin:4px 2px 14px"></div>
    ${fieldDate('date','Data',todayISO())}
    <label class="field"><span class="flabel">Pessoa (opcional — vincula a revisita/estudo)</span>
      <select id="f-contact"><option value="">— nenhuma —</option>
      ${contatos.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
    <label class="field"><span class="flabel">Anotação (opcional)</span><textarea id="f-note" placeholder="Ex.: boa conversa sobre a Bíblia"></textarea></label>
    <button class="btn gold" id="saveSes">Salvar registro</button>
  `);
  const nextMod=()=>{ const used=rows.map(r=>r.mod); return (MODALIDADES.find(m=>!used.includes(m.id))||MODALIDADES[0]).id; };
  function readRows(){
    const box=document.getElementById('rowsBox'); if(!box) return;
    [...box.querySelectorAll('[data-row]')].forEach((el,i)=>{
      rows[i]={ mod:el.querySelector('.rmod').value,
        min:(+el.querySelector('.rh').value||0)*60+(+el.querySelector('.rm').value||0) };
    });
  }
  function updateAlloc(){
    const box=document.getElementById('rowsBox'); let sum=0;
    box.querySelectorAll('[data-row]').forEach(el=>{ sum+=(+el.querySelector('.rh').value||0)*60+(+el.querySelector('.rm').value||0); });
    const info=document.getElementById('allocInfo'); const diff=sum-minutes;
    info.innerHTML = `Somado: <b>${fmtH(sum)}</b> · Cronômetro: ${fmtH(minutes)}`
      + (rows.length<=1 ? '' : (diff===0 ? ' <span style="color:var(--ok)">✓ confere</span>'
          : ` <span style="color:var(--warn)">(${diff>0?'+':'−'}${fmtH(Math.abs(diff))})</span>`));
  }
  function renderRows(){
    const box=document.getElementById('rowsBox');
    box.innerHTML = rows.map((r,i)=>`
      <div class="row" data-row="${i}" style="gap:8px;align-items:flex-end;margin-bottom:10px">
        <label style="flex:1;margin:0"><span class="flabel">Modalidade</span>
          <select class="rmod">${MODALIDADES.map(m=>`<option value="${m.id}" ${m.id===r.mod?'selected':''}>${m.nome}</option>`).join('')}</select></label>
        <label style="width:62px;margin:0"><span class="flabel">Horas</span><input type="number" min="0" class="rh" value="${Math.floor(r.min/60)}"></label>
        <label style="width:62px;margin:0"><span class="flabel">Min</span><input type="number" min="0" max="59" class="rm" value="${r.min%60}"></label>
        ${rows.length>1?`<button type="button" class="btn soft sm rdel" data-i="${i}" style="width:auto;padding:12px 12px">✕</button>`:''}
      </div>`).join('');
    box.querySelectorAll('.rdel').forEach(b=>b.onclick=()=>{ readRows(); rows.splice(+b.dataset.i,1); renderRows(); });
    box.querySelectorAll('.rh,.rm').forEach(inp=>inp.oninput=updateAlloc);
    updateAlloc();
  }
  document.getElementById('addRow').onclick=()=>{ readRows();
    const used=rows.reduce((a,r)=>a+r.min,0); rows.push({mod:nextMod(), min:Math.max(0,minutes-used)}); renderRows(); };
  document.getElementById('saveSes').onclick=()=>{
    readRows();
    const valid=rows.filter(r=>r.min>0);
    if(!valid.length){ toast('Informe o tempo 🙂'); return; }
    const date=val('f-date'), note=val('f-note').trim(), contactId=val('f-contact')||null;
    valid.forEach(r=>{
      const attach=(contactId && (r.mod==='revisita'||r.mod==='estudo'))?contactId:null;
      S.sessions.push({ id:uid(), date, mod:r.mod, minutes:r.min, note, contactId:attach });
      if(attach){ const c=S.contacts.find(x=>x.id===attach);
        if(c){ c.history=c.history||[]; c.history.unshift({date,note:`${modById(r.mod).nome} · ${fmtH(r.min)}`}); } }
    });
    S.meta.lastNudge=''; save(); closeSheet();
    toast(valid.length>1?`${valid.length} modalidades registradas 🌸`:'Registrado! Continue assim 🌸'); render();
  };
  renderRows();
}
function sheetManual(){ sheetConfirmSession(timer.mod,60); }

let currentModSel='campo';
function fieldModSelect(mod){ currentModSel=mod;
  return `<label class="field"><span class="flabel">Modalidade</span>
    <div class="grid2" id="modSel" style="grid-template-columns:repeat(3,1fr)">
    ${MODALIDADES.map(x=>`<button type="button" class="chip ${x.id===mod?'active':''}" data-m="${x.id}"
      style="${x.id===mod?`background:${x.cor}`:''}"><span class="emo">${ic(x)}</span>${x.nome}</button>`).join('')}
    </div></label>`;
}
function bindModSelect(){
  document.querySelectorAll('#modSel .chip').forEach(c=>c.onclick=()=>{
    currentModSel=c.dataset.m;
    document.querySelectorAll('#modSel .chip').forEach(x=>{x.classList.remove('active');x.style.background='';});
    c.classList.add('active'); c.style.background=modById(currentModSel).cor;
  });
}

/* ================================================================
   TELA 2 — AGENDA / CALENDÁRIO
   ================================================================ */
let calRef = new Date();
function viewAgenda(){
  const y=calRef.getFullYear(), mth=calRef.getMonth();
  const first=new Date(y,mth,1), startDow=first.getDay();
  const days=new Date(y,mth+1,0).getDate();
  const cells=[];
  for(let i=0;i<startDow;i++) cells.push(null);
  for(let d=1;d<=days;d++) cells.push(d);
  const tISO=todayISO();
  const grid=cells.map(d=>{
    if(d===null) return `<div class="cal-cell other"></div>`;
    const iso=`${y}-${pad(mth+1)}-${pad(d)}`;
    const ses=S.sessions.filter(s=>s.date===iso);
    const plans=S.planned.filter(p=>p.date===iso);
    const dots=[...new Set([...ses.map(s=>s.mod),...plans.map(p=>p.mod)])].slice(0,3);
    return `<div class="cal-cell ${ses.length||plans.length?'has':''} ${iso===tISO?'today':''}" data-day="${iso}">
      ${d}
      <div class="cal-dots">${dots.map(m=>`<i style="background:${modById(m).cor}"></i>`).join('')}</div>
    </div>`;
  }).join('');
  const prox = S.planned.filter(p=>p.date>=tISO).sort((a,b)=>a.date.localeCompare(b.date)||String(a.time||'').localeCompare(String(b.time||''))).slice(0,4);
  // Resumo de horas do mês exibido: já feitas + programadas vs meta de 50h
  const mStartISO=`${y}-${pad(mth+1)}-01`, mEndISO=`${y}-${pad(mth+1)}-${pad(days)}`;
  const feitoMin = minutesInRange(mStartISO,mEndISO)+historicInRange(mStartISO,mEndISO)+abonoInRange(mStartISO,mEndISO);
  const progMin = S.planned.filter(p=>p.date>=mStartISO && p.date<=mEndISO).reduce((a,p)=>a+(p.plannedMin||0),0);
  const projMin = feitoMin+progMin; const metaMin=metaMes()*60;
  const projPct=Math.min(100, projMin/metaMin*100);
  const faltaMin=Math.max(0, metaMin-projMin);
  return `
  <div class="card">
    <div class="cal-head">
      <button class="btn soft sm" data-cal="-1">‹</button>
      <b>${MESES_LONG[mth]} ${y}</b>
      <button class="btn soft sm" data-cal="1">›</button>
    </div>
    <div class="cal-grid">${DOW.map(d=>`<div class="cal-dow">${d}</div>`).join('')}${grid}</div>
    <div class="small muted center" style="margin-top:12px">Toque num dia para programar ou registrar</div>
  </div>

  <div class="card">
    <div class="row between"><b>${MESES_LONG[mth]}: previsão da meta</b><span class="pill">${projPct.toFixed(0)}%</span></div>
    <div class="progress" style="margin-top:10px;display:flex">
      <span style="width:${Math.min(100,feitoMin/metaMin*100)}%;background:var(--grad-gold);border-radius:20px 0 0 20px"></span>
      <span style="width:${Math.min(100-Math.min(100,feitoMin/metaMin*100), progMin/metaMin*100)}%;background:var(--lav);border-radius:0 20px 20px 0"></span>
    </div>
    <div class="row between small" style="margin-top:8px">
      <span>✅ Já feito: <b>${fmtHnum(feitoMin)}h</b></span>
      <span>📅 Programado: <b>${fmtHnum(progMin)}h</b></span>
    </div>
    <div class="small muted" style="margin-top:8px">
      ${projMin>=metaMin
        ? `Com o que está programado, você alcança as ${metaMes()}h do mês! 🎉 (previsto ${fmtHnum(projMin)}h)`
        : `Feito + programado = <b>${fmtHnum(projMin)}h</b> de ${metaMes()}h. Ainda falta programar <b>${fmtHnum(faltaMin)}h</b> para bater a meta.`}
    </div>
  </div>

  <div class="section-title">Próximos compromissos</div>
  ${prox.length? `<div class="card">${prox.map(p=>{const m=modById(p.mod);
    const extras=[p.time?('🕐 '+p.time):'', p.plannedMin?('meta '+fmtH(p.plannedMin)):'', p.note].filter(Boolean).join(' · ');
    return `<div class="list-item" data-day="${p.date}">
      <div class="avatar" style="background:${m.cor}">${ic(m)}</div>
      <div style="flex:1"><b>${m.nome}</b><div class="small muted">${DOW[parseISO(p.date).getDay()]}, ${fmtDataBR(p.date)}${extras?' · '+esc(extras):''}</div></div>
    </div>`}).join('')}</div>`
    : `<div class="card flat empty"><span class="emo">🗓️</span>Nada programado.<br>Toque no <b>＋</b> para planejar um dia.</div>`}
  `;
}
function bindAgenda(){
  document.querySelectorAll('[data-cal]').forEach(b=>b.onclick=()=>{ calRef.setMonth(calRef.getMonth()+ +b.dataset.cal); render(); });
  document.querySelectorAll('[data-day]').forEach(el=>el.onclick=()=>sheetDay(el.dataset.day));
}
function sheetDay(iso){
  const ses=S.sessions.filter(s=>s.date===iso);
  const plans=S.planned.filter(p=>p.date===iso);
  openSheet(`
    <h3>${DOW[parseISO(iso).getDay()]}, ${fmtDataBR(iso)}</h3>
    <div class="section-title" style="margin-top:14px">Programado</div>
    ${plans.length? plans.map(p=>{const m=modById(p.mod);
        const sub=[p.time?('🕐 '+p.time):'', p.note].filter(Boolean);
        return `<div class="list-item">
        <div class="avatar" style="background:${m.cor}">${ic(m)}</div>
        <div style="flex:1"><b>${m.nome}</b>${p.plannedMin?` · <span class="muted">meta ${fmtH(p.plannedMin)}</span>`:''}
          ${sub.length?`<div class="small muted">${sub.map(esc).join(' · ')}</div>`:''}</div>
        <button class="btn soft sm" data-delplan="${p.id}">✕</button></div>`}).join('')
      : `<div class="muted small" style="padding:4px 2px">Nada programado neste dia.</div>`}
    <div class="section-title">Registrado</div>
    ${ses.length? ses.map(s=>{const m=modById(s.mod);return `<div class="list-item">
        <div class="avatar" style="background:${m.cor}">${ic(m)}</div>
        <div style="flex:1"><b>${m.nome}</b> · ${fmtH(s.minutes)}</div></div>`}).join('')
      : `<div class="muted small" style="padding:4px 2px">Nenhum tempo registrado.</div>`}
    <div class="grid2" style="margin-top:18px">
      <button class="btn ghost" data-actplan>📅 Programar</button>
      <button class="btn gold" data-actreg>⏱️ Registrar horas</button>
    </div>
  `);
  document.querySelector('[data-actplan]').onclick=()=>{ closeSheet(); sheetPlan(iso); };
  document.querySelector('[data-actreg]').onclick=()=>{ closeSheet();
    const p0=plans[0];
    sheetConfirmSession(p0?p0.mod:'campo', (p0&&p0.plannedMin)?p0.plannedMin:60);
    setTimeout(()=>{const f=document.getElementById('f-date');if(f)f.value=iso;},50); };
  document.querySelectorAll('[data-delplan]').forEach(b=>b.onclick=()=>{ S.planned=S.planned.filter(x=>x.id!==b.dataset.delplan); save(); closeSheet(); render(); });
}
function sheetPlan(iso){
  iso=iso||todayISO();
  openSheet(`
    <h3>Programar dia</h3>
    ${fieldModSelect('campo')}
    ${fieldDate('date','Data',iso)}
    <div class="field"><span class="flabel">Horas planejadas</span>
      <div class="grid2">
        ${fieldNum('phoras','Horas',2)}
        ${fieldNum('pmins','Minutos',0)}
      </div></div>
    ${fieldText('time','Horário (opcional)','','time')}
    <label class="field"><span class="flabel">Observação (opcional)</span><input id="f-note" placeholder="Ex.: com a irmã Ana"></label>
    <button class="btn gold" id="savePlan">Adicionar à agenda</button>
  `);
  bindModSelect();
  document.getElementById('savePlan').onclick=()=>{
    const plannedMin=(+val('f-phoras')||0)*60 + (+val('f-pmins')||0);
    S.planned.push({id:uid(),date:val('f-date'),mod:currentModSel,note:val('f-note').trim(),plannedMin,time:val('f-time')});
    save(); closeSheet(); toast('Programado! 📅'); render(); scheduleReminders();
  };
}

/* ================================================================
   TELA 3 — ANO DE SERVIÇO
   ================================================================ */
function viewAno(){
  const a=anoStats(), m=mesStats();
  const r=110, C=2*Math.PI*r, off=C*(1-a.pct/100);
  const falta = Math.max(0, metaAno()-a.projecao);
  const verdict = a.noRitmo
    ? {emo:'✅', bg:'#e6f6ee', fg:'#1d8a5f', title:'Sim, você vai alcançar a meta!', msg:`No seu ritmo atual, deve fechar o ano com <b>${a.projecao.toFixed(0)}h</b> (meta ${metaAno()}h). Continue firme! 🎉`}
    : {emo:'⚠️', bg:'#fdeceb', fg:'#c0392b', title:'Atenção: você não vai alcançar a meta no ritmo atual.', msg:`Assim você fecharia <b>${a.projecao.toFixed(0)}h</b> — faltariam <b>${falta.toFixed(0)}h</b>. Para alcançar, faça cerca de <b>${a.ritmoNecessario.toFixed(1).replace('.',',')}h por dia</b>.`};
  return `
  <div class="card center">
    <div class="small muted">Ano de serviço ${a.label}</div>
    <svg class="donut" viewBox="0 0 260 260" style="margin:8px auto">
      <circle cx="130" cy="130" r="${r}" fill="none" stroke="var(--bg-2)" stroke-width="22"/>
      <circle cx="130" cy="130" r="${r}" fill="none" stroke="url(#g)" stroke-width="22" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 130 130)"/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--rose)"/><stop offset="1" stop-color="var(--gold)"/></linearGradient></defs>
      <text x="130" y="122" text-anchor="middle" font-size="40" font-weight="800" fill="var(--text)">${a.totalH.toFixed(0)}</text>
      <text x="130" y="150" text-anchor="middle" font-size="15" fill="var(--muted)">de ${metaAno()} h</text>
    </svg>
    <div class="pill" style="margin-top:4px">${a.pct.toFixed(0)}% concluído</div>
  </div>

  <div class="banner" style="background:${verdict.bg};color:${verdict.fg}"><span class="emo">${verdict.emo}</span>
    <div class="txt"><b>${verdict.title}</b> ${verdict.msg}</div></div>

  <div class="grid2">
    <div class="card center"><div class="small muted">Faltam</div><div class="big-num">${a.restanteMeta.toFixed(0)}</div><div class="small muted">horas</div></div>
    <div class="card center"><div class="small muted">Dias restantes</div><div class="big-num">${a.diasRestantes}</div><div class="small muted">até 31/ago</div></div>
  </div>
  <div class="grid2">
    <div class="card center"><div class="small muted">Seu ritmo</div><div class="big-num" style="font-size:26px">${a.ritmoDia.toFixed(1).replace('.',',')}</div><div class="small muted">h/dia</div></div>
    <div class="card center"><div class="small muted">Ritmo p/ meta</div><div class="big-num" style="font-size:26px">${a.ritmoNecessario.toFixed(1).replace('.',',')}</div><div class="small muted">h/dia</div></div>
  </div>

  <div class="section-title">Este mês — ${m.mesNome}</div>
  <div class="card">
    <div class="row between"><b>${fmtHnum(m.totalMin)} de ${metaMes()} h</b><span class="pill">${m.pct.toFixed(0)}%</span></div>
    <div class="progress" style="margin-top:10px"><span style="width:${m.pct}%"></span></div>
    <div class="small muted" style="margin-top:8px">${m.restante>0?`Faltam ${m.restante.toFixed(1).replace('.',',')}h em ${m.diasRest} dia(s).`:'Meta do mês alcançada! 🌟'}</div>
  </div>

  <div class="section-title">Mês a mês <span class="muted small" style="font-weight:500;margin-left:auto">toque p/ lançar horas</span></div>
  <div class="card">${monthlyBreakdown(a)}</div>

  <div class="section-title">Evolução do ano 📈</div>
  <div class="card">${chartAno()}
    <div class="small muted center" style="margin-top:6px">Barras = horas de cada mês · linha pontilhada = meta de ${metaMes()}h</div>
  </div>
  `;
}
function chartAno(){
  const {start}=serviceYearBounds();
  const meta=metaMes();
  const rows=[];
  for(let i=0;i<12;i++){
    const d=new Date(start.getFullYear(),start.getMonth()+i,1);
    const key=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    const {startISO,endISO}=monthBounds(d);
    const h=minToH(minutesInRange(startISO,endISO)+historicMin(key)+abonoMin(key));
    rows.push({ mi:d.getMonth(), h, fut:d>new Date() });
  }
  const maxH=Math.max(meta, ...rows.map(r=>r.h), 1);
  const W=360,H=200,padL=22,padR=8,padT=16,padB=26;
  const plotW=W-padL-padR, plotH=H-padT-padB, slot=plotW/12;
  const yGoal=padT+plotH-(meta/maxH*plotH);
  const bars=rows.map((r,i)=>{
    const cx=padL+slot*i+slot/2, bw=slot*0.62;
    const bh=r.h/maxH*plotH, y=padT+plotH-bh;
    const col=r.h>=meta?'var(--ok)':(r.fut&&r.h===0?'#ece7ef':'var(--rose)');
    const vlabel=r.h>0?`<text x="${cx}" y="${y-3}" text-anchor="middle" font-size="7.5" fill="var(--muted)">${r.h.toFixed(0)}</text>`:'';
    return `<rect x="${cx-bw/2}" y="${y}" width="${bw}" height="${Math.max(0,bh)}" rx="2.5" fill="${col}"/>${vlabel}
      <text x="${cx}" y="${H-padB+12}" text-anchor="middle" font-size="7.5" fill="var(--muted)">${MESES[r.mi]}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
    <line x1="${padL}" y1="${yGoal}" x2="${W-padR}" y2="${yGoal}" stroke="var(--gold)" stroke-width="1.3" stroke-dasharray="4 3"/>
    <text x="${W-padR}" y="${Math.max(10,yGoal-3)}" text-anchor="end" font-size="8" fill="#c9a24e">meta ${meta}h</text>
    ${bars}
  </svg>`;
}
function monthlyBreakdown(a){
  const {start}=serviceYearBounds();
  let html='';
  for(let i=0;i<12;i++){
    const d=new Date(start.getFullYear(),start.getMonth()+i,1);
    const key=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    const {startISO,endISO}=monthBounds(d);
    const min=minutesInRange(startISO,endISO)+historicMin(key)+abonoMin(key); const h=minToH(min);
    const pct=Math.min(100,h/metaMes()*100);
    const fut = d>new Date();
    const sickMark = isSick(key)?' 🤒':'';
    html+=`<div class="barline" data-histmonth="${key}" style="cursor:pointer">
      <div class="lbl"><span>${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}${sickMark} <span class="muted" style="font-weight:400">✏️</span></span>
      <span class="${h>=metaMes()?'':'muted'}">${fut&&min===0?'—':fmtHnum(min)+'h'}</span></div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${h>=metaMes()?'var(--ok)':'var(--grad)'}"></div></div></div>`;
  }
  return html;
}

function bindAno(){
  document.querySelectorAll('[data-histmonth]').forEach(el=>el.onclick=()=>sheetHistoric(el.dataset.histmonth));
}
// Lançar/editar horas de um mês + doença/abono (útil para quem começa no meio do ano)
function sheetHistoric(monthKey){
  const [y,m]=monthKey.split('-').map(Number);
  const label=`${MESES_LONG[m-1]} de ${y}`;
  const d=new Date(y,m-1,1); const {startISO,endISO}=monthBounds(d);
  const logged=minutesInRange(startISO,endISO);   // só cronômetro
  const hist=historicMin(monthKey);
  const notaAtual=(S.sick && S.sick[monthKey]) || '';
  let sick=isSick(monthKey);
  let abonar=abonoMin(monthKey)>0;
  openSheet(`
    <h3>${label}</h3>
    <p class="muted small" style="margin:0 0 14px">Lance as horas já realizadas e, se ficou doente, abone o que faltou para as ${metaMes()}h.</p>
    ${logged?`<div class="card flat small" style="margin-bottom:14px">⏱️ Registrado pelo cronômetro: <b>${fmtH(logged)}</b></div>`:''}
    <div class="field"><span class="flabel">Horas já realizadas (lançamento manual)</span>
      <div class="grid2">${fieldNum('hh','Horas',Math.floor(hist/60))}${fieldNum('hm','Minutos',hist%60)}</div></div>
    <div class="divider"></div>
    <label class="row" style="gap:10px;cursor:pointer;margin-bottom:2px"><input type="checkbox" id="f-sick" style="width:auto;transform:scale(1.3)" ${sick?'checked':''}><span style="font-weight:600">🤒 Estive doente neste mês</span></label>
    <div id="sickBox"></div>
    <div class="card flat small" style="margin:14px 0">Total do mês ficará: <b id="histTotal">—</b></div>
    <button class="btn gold" id="saveHist">Salvar</button>
  `);
  const manualNow=()=>(+val('f-hh')||0)*60+(+val('f-hm')||0);
  const faltamNow=()=>Math.max(0, metaMes()*60 - (logged+manualNow()));
  const totalNow=()=>logged+manualNow()+((document.getElementById('f-sick').checked && abonar)?faltamNow():0);
  const updTotal=()=>{ const t=document.getElementById('histTotal'); if(t) t.textContent=fmtH(totalNow()); };
  const renderSick=()=>{
    const box=document.getElementById('sickBox'); if(!box) return;
    const on=document.getElementById('f-sick').checked;
    if(!on){ box.innerHTML=''; return; }
    const falta=faltamNow();
    box.innerHTML=`
      <label class="field" style="margin-top:12px"><span class="flabel">Observação para o relatório</span>
        <input id="f-sicknote" value="${esc(notaAtual||'Estive doente parte do mês')}"></label>
      ${falta>0
        ? `<div class="banner" style="background:var(--bg-2);color:var(--lav-deep)"><span class="emo">🩹</span>
             <div class="txt">Faltaram <b>${fmtH(falta)}</b> para as ${metaMes()}h. Deseja <b>abonar</b> essas horas? Elas contam como feitas e o relatório levará a observação.
               <div class="grid2" style="margin-top:10px">
                 <button type="button" class="btn ${abonar?'gold':'soft'} sm" id="btnAbSim">${abonar?'✓ Vou abonar':'Sim, abonar'}</button>
                 <button type="button" class="btn ${abonar?'soft':'ghost'} sm" id="btnAbNao">Não abonar</button>
               </div></div></div>`
        : `<div class="card flat small">Você já tem ${metaMes()}h neste mês — não há horas a abonar. A observação de doença entrará no relatório.</div>`}`;
    const bs=document.getElementById('btnAbSim'), bn=document.getElementById('btnAbNao');
    if(bs) bs.onclick=()=>{ abonar=true; renderSick(); updTotal(); };
    if(bn) bn.onclick=()=>{ abonar=false; renderSick(); updTotal(); };
  };
  document.getElementById('f-sick').onchange=()=>{ if(!document.getElementById('f-sick').checked) abonar=false; renderSick(); updTotal(); };
  ['f-hh','f-hm'].forEach(id=>{ const e=document.getElementById(id); if(e) e.oninput=()=>{ renderSick(); updTotal(); }; });
  renderSick(); updTotal();
  document.getElementById('saveHist').onclick=()=>{
    const manual=manualNow();
    S.historic=S.historic||{}; S.abono=S.abono||{}; S.sick=S.sick||{};
    if(manual>0) S.historic[monthKey]=manual; else delete S.historic[monthKey];
    if(document.getElementById('f-sick').checked){
      S.sick[monthKey]=(val('f-sicknote')||'Estive doente parte do mês').trim();
      if(abonar) S.abono[monthKey]=faltamNow(); else delete S.abono[monthKey];
    } else { delete S.sick[monthKey]; delete S.abono[monthKey]; }
    save(); closeSheet(); toast('Mês atualizado 🌸'); render();
  };
}

/* ================================================================
   TELA — ROTINA ESPIRITUAL
   ================================================================ */
function ensureRoutine(){
  if(!S.routine) S.routine={tasks:[],prog:{},temas:{}};
  if(!S.routine.prog) S.routine.prog={};
  if(!S.routine.temas) S.routine.temas={};
  let changed=false;
  if(!S.routine.tasks || !S.routine.tasks.length){ S.routine.tasks=ROTINA_PADRAO.map(t=>Object.assign({},t)); changed=true; }
  // sincroniza nomes/ícones/prazos das atividades padrão (mantém ids e progresso)
  ROTINA_PADRAO.forEach(def=>{ const t=S.routine.tasks.find(x=>x.id===def.id);
    if(t){ if(t.nome!==def.nome){t.nome=def.nome;changed=true;} if(t.emo!==def.emo){t.emo=def.emo;changed=true;}
      if(def.prazo && t.prazo!==def.prazo && !t.dia){t.prazo=def.prazo;changed=true;} } });
  if(changed) save();
}
function startOfWeek(d){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); const dow=(x.getDay()+6)%7; x.setDate(x.getDate()-dow); return x; } // segunda
function weekKeyOf(d){ return toISO(startOfWeek(d)); }
function weekDaysOf(d){ const s=startOfWeek(d); return Array.from({length:7},(_,i)=>{ const x=new Date(s); x.setDate(s.getDate()+i); return toISO(x); }); }
function rProg(id,key){ return (S.routine.prog[id+'|'+key])||0; }
function rSet(id,key,v){ if(v<=0) delete S.routine.prog[id+'|'+key]; else S.routine.prog[id+'|'+key]=v; save(); }
function monthDaysElapsed(ref){ const t=new Date(); return (t.getFullYear()===ref.getFullYear()&&t.getMonth()===ref.getMonth())? t.getDate() : new Date(ref.getFullYear(),ref.getMonth()+1,0).getDate(); }
function monthDoneDays(id,ref){ const y=ref.getFullYear(),m=ref.getMonth(),dim=new Date(y,m+1,0).getDate(); let c=0; for(let d=1;d<=dim;d++){ if(rProg(id,`${y}-${pad(m+1)}-${pad(d)}`)>=1) c++; } return c; }
function monthWeeks(ref){ const y=ref.getFullYear(),m=ref.getMonth(); const first=new Date(y,m,1),last=new Date(y,m+1,0); const t=new Date(); const cap=(t.getFullYear()===y&&t.getMonth()===m)?t:last; const seen={}, arr=[]; for(let d=new Date(first); d<=cap; d.setDate(d.getDate()+1)){ const k=weekKeyOf(d); if(!seen[k]){seen[k]=1;arr.push(k);} } return arr; }
function rBar(t,ratio,label){ const pct=Math.round(Math.min(1,ratio)*100);
  return `<div class="barline"><div class="lbl"><span>${t.emo} ${t.nome}</span><span class="muted">${label} · ${pct}%</span></div>
    <div class="track"><div class="fill" style="width:${pct}%;background:${t.cor}"></div></div></div>`; }

function viewRotina(){
  ensureRoutine();
  const ref=new Date(), wk=weekKeyOf(ref), days=weekDaysOf(ref);
  const tasks=S.routine.tasks, dl=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const ini=parseISO(days[0]), fim=parseISO(days[6]);
  const ctrl=tasks.map(t=>{
    const del=`<button class="btn soft sm" data-rtaskdel="${t.id}" style="width:auto;padding:8px 10px">🗑️</button>`;
    const av=`<div class="avatar" style="width:38px;height:38px;font-size:17px;background:${t.cor}">${t.emo}</div>`;
    if(t.freq==='diario'){
      const strip=days.map((day,i)=>{ const on=rProg(t.id,day)>=1, tod=day===todayISO();
        return `<button class="rdot ${on?'on':''} ${tod?'today':''}" data-rtoggle="${t.id}|${day}">${dl[i][0]}</button>`; }).join('');
      const dc=days.filter(d=>rProg(t.id,d)>=1).length;
      return `<div class="card">
        <div class="row between"><div class="row" style="gap:10px">${av}<div><b>${t.nome}</b><div class="small muted">Diária · ${dc}/7 nesta semana</div></div></div>${del}</div>
        <div class="rstrip" style="margin-top:12px">${strip}</div></div>`;
    }
    const parts=t.partes||1, done=rProg(t.id,wk);
    const sched = t.dia ? ` · 📅 ${DOW_full(t.dia)}${t.hora?' '+t.hora:''}` : (t.prazo?` · ⏰ ${t.prazo}`:'');
    const ctl = parts>1
      ? `<div class="row" style="gap:8px">${Array.from({length:parts},(_,i)=>`<button class="btn ${done>i?'gold':'soft'} sm" data-rpart="${t.id}|${wk}|${i+1}" style="flex:1">Parte ${i+1} ${done>i?'✓':''}</button>`).join('')}</div>`
      : `<button class="btn ${done>=1?'gold':'soft'} sm" data-rpart="${t.id}|${wk}|1" style="width:100%">${done>=1?'✓ Concluído esta semana':'Marcar como concluído'}</button>`;
    return `<div class="card">
      <div class="row between"><div class="row" style="gap:10px">${av}<div><b>${t.nome}</b><div class="small muted">Semanal${parts>1?' · '+parts+' partes':''}${sched}</div></div></div>${del}</div>
      <div style="margin-top:12px">${ctl}</div>
      <button class="btn soft sm" data-rsched="${t.id}" style="width:auto;margin-top:10px">📅 ${t.dia?'Alterar dia/horário':'Definir dia/horário'}</button></div>`;
  }).join('');

  const barsW=tasks.map(t=>{ if(t.freq==='diario'){ const dc=days.filter(d=>rProg(t.id,d)>=1).length; return rBar(t,dc/7,`${dc}/7 dias`); }
    const parts=t.partes||1, dn=Math.min(rProg(t.id,wk),parts); return rBar(t,dn/parts,`${dn}/${parts}`); }).join('');
  const barsM=tasks.map(t=>{ if(t.freq==='diario'){ const dc=monthDoneDays(t.id,ref), el=monthDaysElapsed(ref); return rBar(t,el?dc/el:0,`${dc}/${el} dias`); }
    const weeks=monthWeeks(ref), dn=weeks.filter(w=>rProg(t.id,w)>=(t.partes||1)).length; return rBar(t,weeks.length?dn/weeks.length:0,`${dn}/${weeks.length} sem.`); }).join('');
  const wR=tasks.map(t=> t.freq==='diario'? days.filter(d=>rProg(t.id,d)>=1).length/7 : Math.min(rProg(t.id,wk),(t.partes||1))/(t.partes||1));
  const wOverall=Math.round((wR.reduce((a,b)=>a+b,0)/(wR.length||1))*100);
  const mR=tasks.map(t=>{ if(t.freq==='diario'){ const el=monthDaysElapsed(ref); return el?monthDoneDays(t.id,ref)/el:0; } const weeks=monthWeeks(ref); return weeks.length? weeks.filter(w=>rProg(t.id,w)>=(t.partes||1)).length/weeks.length:0; });
  const mOverall=Math.round((mR.reduce((a,b)=>a+b,0)/(mR.length||1))*100);

  const mk=currentMonthKey(), temas=S.routine.temas[mk]||[];
  const temasCard=`<div class="card">
    <div class="small muted" style="margin-bottom:10px">Liste os temas que quer estudar este mês (estudo pessoal é 1x por semana — cerca de 4 temas).</div>
    ${temas.length? temas.map((t,i)=>`<div class="list-item"><button class="rcheck ${t.feito?'on':''}" data-tema="${i}">${t.feito?'✓':''}</button><div style="flex:1" class="${t.feito?'muted':''}">${esc(t.nome)}</div><button class="btn soft sm" data-temadel="${i}" style="width:auto;padding:6px 10px">✕</button></div>`).join('')
      : `<div class="muted small" style="padding:4px 2px">Nenhum tema ainda.</div>`}
    <div class="row" style="gap:8px;margin-top:12px"><input id="f-tema" placeholder="Ex.: Livro de Daniel"><button class="btn gold sm" id="addTema" style="width:auto">Adicionar</button></div>
  </div>`;

  return `
  <div class="card center" style="background:var(--grad);color:#fff">
    <div class="small" style="opacity:.9">Semana de ${pad(ini.getDate())}/${pad(ini.getMonth()+1)} a ${pad(fim.getDate())}/${pad(fim.getMonth()+1)}</div>
    <div class="big-num" style="color:#fff;margin-top:4px">${wOverall}%</div>
    <div class="small" style="opacity:.9">da rotina cumprida nesta semana</div>
  </div>
  <div class="section-title">Esta semana</div>
  ${ctrl}
  <button class="btn ghost" id="addTask" style="margin-bottom:6px">＋ Adicionar atividade</button>
  <div class="section-title">Progresso da semana</div>
  <div class="card">${barsW||'<div class="muted small">Sem atividades.</div>'}</div>
  <div class="section-title">Progresso do mês <span class="muted small" style="font-weight:500;margin-left:auto">${mOverall}%</span></div>
  <div class="card">${barsM||''}
    <div class="small muted" style="margin-top:8px">${mOverall>=80?'Você está mantendo bem a rotina este mês! 🌟':'Acompanhe aqui se precisa ajustar os dias para conseguir cumprir tudo até o fim do mês.'}</div>
  </div>
  <div class="section-title">📚 Temas de estudo — ${MESES_LONG[ref.getMonth()]}</div>
  ${temasCard}
  `;
}
function bindRotina(){
  document.querySelectorAll('[data-rtoggle]').forEach(b=>b.onclick=()=>{ const [id,day]=b.dataset.rtoggle.split('|'); rSet(id,day, rProg(id,day)>=1?0:1); render(); });
  document.querySelectorAll('[data-rpart]').forEach(b=>b.onclick=()=>{ const [id,w,n]=b.dataset.rpart.split('|'); const tg=+n; rSet(id,w, rProg(id,w)>=tg?tg-1:tg); render(); });
  document.querySelectorAll('[data-tema]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.tema, mk=currentMonthKey(); S.routine.temas[mk][i].feito=!S.routine.temas[mk][i].feito; save(); render(); });
  document.querySelectorAll('[data-temadel]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.temadel, mk=currentMonthKey(); S.routine.temas[mk].splice(i,1); save(); render(); });
  document.querySelectorAll('[data-rtaskdel]').forEach(b=>b.onclick=()=>{ const id=b.dataset.rtaskdel, t=S.routine.tasks.find(x=>x.id===id);
    confirmSheet(`Remover "${t?t.nome:''}" da rotina?`,'Remover',()=>{ S.routine.tasks=S.routine.tasks.filter(x=>x.id!==id); save(); render(); }); });
  document.querySelectorAll('[data-rsched]').forEach(b=>b.onclick=()=>sheetRoutineSchedule(b.dataset.rsched));
  const at=document.getElementById('addTema'); if(at) at.onclick=()=>{ const v=val('f-tema').trim(); if(!v)return; const mk=currentMonthKey(); (S.routine.temas[mk]=S.routine.temas[mk]||[]).push({nome:v,feito:false}); save(); render(); };
  const ad=document.getElementById('addTask'); if(ad) ad.onclick=sheetAddRoutine;
}
function sheetRoutineSchedule(id){
  const t=S.routine.tasks.find(x=>x.id===id); if(!t) return;
  openSheet(`<h3>Dia e horário</h3>
    <p class="muted small" style="margin:0 0 14px">${esc(t.nome)} — defina um dia e horário fixo.</p>
    <label class="field"><span class="flabel">Dia da semana</span>
      <select id="f-dia"><option value="">—</option>
      ${['seg','ter','qua','qui','sex','sab','dom'].map(d=>`<option value="${d}" ${t.dia===d?'selected':''}>${DOW_full(d)}</option>`).join('')}</select></label>
    ${fieldText('hora','Horário',t.hora||'','time')}
    <button class="btn gold" id="saveSched">Salvar</button>
    ${(t.dia||t.hora)?`<button class="btn soft" id="clrSched" style="margin-top:10px">Remover dia/horário</button>`:''}`);
  document.getElementById('saveSched').onclick=()=>{ t.dia=val('dia')||''; t.hora=val('hora')||''; if(t.dia) delete t.prazo; save(); closeSheet(); toast('Dia/horário salvo 🌸'); render(); };
  const c=document.getElementById('clrSched'); if(c) c.onclick=()=>{ delete t.dia; delete t.hora; save(); closeSheet(); render(); };
}
function sheetAddRoutine(){
  let freq='semanal';
  openSheet(`<h3>Nova atividade</h3>
    ${fieldText('rnome','Nome da atividade','')}
    <label class="field"><span class="flabel">Frequência</span>
      <div class="grid2" id="rfreq">
        <button type="button" class="chip" data-f="diario"><span class="emo">📅</span>Diária</button>
        <button type="button" class="chip active" data-f="semanal" style="background:var(--m-revisita)"><span class="emo">🗓️</span>Semanal</button>
      </div></label>
    <div class="field" id="rpartesWrap"><span class="flabel">Partes (para dividir uma preparação maior)</span>${fieldNum('rpartes','Partes',1)}</div>
    <button class="btn gold" id="saveTask">Adicionar à rotina</button>`);
  document.querySelectorAll('#rfreq .chip').forEach(b=>b.onclick=()=>{ freq=b.dataset.f;
    document.querySelectorAll('#rfreq .chip').forEach(x=>{x.classList.remove('active');x.style.background='';});
    b.classList.add('active'); b.style.background=freq==='diario'?'var(--m-estudo)':'var(--m-revisita)';
    document.getElementById('rpartesWrap').style.display=freq==='semanal'?'block':'none'; });
  document.getElementById('saveTask').onclick=()=>{
    const nome=val('rnome').trim(); if(!nome){ toast('Informe o nome 🙂'); return; }
    const partes=Math.max(1, +val('rpartes')||1);
    const cores=['var(--m-campo)','var(--m-revisita)','var(--m-estudo)','var(--m-carta)','var(--m-carrinho)','var(--m-preparacao)'];
    S.routine.tasks.push({ id:uid(), nome, emo:freq==='diario'?'🔆':'⭐', cor:cores[S.routine.tasks.length%cores.length], freq, partes: freq==='semanal'?partes:1 });
    save(); closeSheet(); toast('Atividade adicionada 🌱'); render();
  };
}

/* ================================================================
   TELA 4 — CONTATOS (revisitas e estudos)
   ================================================================ */
function viewContatos(){
  if(!S.contacts.length) return `<div class="card flat empty"><span class="emo">👥</span>
    Nenhuma pessoa cadastrada ainda.<br>Toque no <b>＋</b> para adicionar uma revisita ou estudo.</div>`;
  const grupos={estudo:[],revisita:[]};
  S.contacts.forEach(c=>(grupos[c.type]||grupos.revisita).push(c));
  const bloco=(tipo,titulo)=>{ const arr=grupos[tipo]; if(!arr.length) return '';
    return `<div class="section-title">${titulo} (${arr.length})</div><div class="card">
      ${arr.map(c=>`<div class="list-item" data-contact="${c.id}">
        <div class="avatar">${initials(c.name)}</div>
        <div style="flex:1"><b>${esc(c.name)}</b> <span class="tag ${c.type}">${c.type==='estudo'?'Estudo':'Revisita'}</span>
          <div class="small muted">${c.day?DOW_full(c.day)+(c.time?' · '+c.time:''):(c.phone||'sem telefone')}</div></div>
        <span class="muted">›</span></div>`).join('')}</div>`;
  };
  return bloco('estudo','📖 Estudos') + bloco('revisita','🔁 Revisitas');
}
function DOW_full(d){ const map={dom:'Domingo',seg:'Segunda',ter:'Terça',qua:'Quarta',qui:'Quinta',sex:'Sexta',sab:'Sábado'}; return map[d]||d; }
function bindContatos(){ document.querySelectorAll('[data-contact]').forEach(el=>el.onclick=()=>sheetContactDetail(el.dataset.contact)); }

function sheetContact(c){
  const isNew=!c; c=c||{type:'revisita',history:[]};
  openSheet(`
    <h3>${isNew?'Nova pessoa':'Editar'}</h3>
    <label class="field"><span class="flabel">Tipo</span>
      <div class="grid2" id="typeSel">
        <button type="button" class="chip ${c.type==='revisita'?'active':''}" data-t="revisita" style="${c.type==='revisita'?'background:var(--m-revisita)':''}"><span class="emo">🔁</span>Revisita</button>
        <button type="button" class="chip ${c.type==='estudo'?'active':''}" data-t="estudo" style="${c.type==='estudo'?'background:var(--m-estudo)':''}"><span class="emo">📖</span>Estudo</button>
      </div></label>
    ${fieldText('name','Nome',c.name)}
    ${fieldText('phone','Telefone',c.phone,'tel')}
    ${fieldText('address','Endereço',c.address)}
    <div class="grid2">
      <label class="field"><span class="flabel">Dia do estudo</span>
        <select id="f-day"><option value="">—</option>
        ${['dom','seg','ter','qua','qui','sex','sab'].map(d=>`<option value="${d}" ${c.day===d?'selected':''}>${DOW_full(d)}</option>`).join('')}</select></label>
      ${fieldText('time','Horário',c.time,'time')}
    </div>
    <label class="field"><span class="flabel">Anotações</span><textarea id="f-notes" placeholder="Assunto, publicação estudada, orações...">${esc(c.notes||'')}</textarea></label>
    <button class="btn gold" id="saveC">Salvar</button>
    ${!isNew?`<button class="btn danger" id="delC" style="margin-top:10px">Excluir pessoa</button>`:''}
  `);
  let type=c.type;
  document.querySelectorAll('#typeSel .chip').forEach(b=>b.onclick=()=>{ type=b.dataset.t;
    document.querySelectorAll('#typeSel .chip').forEach(x=>{x.classList.remove('active');x.style.background='';});
    b.classList.add('active'); b.style.background = type==='estudo'?'var(--m-estudo)':'var(--m-revisita)'; });
  document.getElementById('saveC').onclick=()=>{
    if(!val('f-name').trim()){ toast('Informe o nome 🙂'); return; }
    const nome=val('f-name').trim(), fone=val('f-phone').trim();
    const dup=findDuplicateContact(nome,fone,isNew?null:c.id);
    if(dup){ toast('Essa pessoa já está cadastrada 🙂'); closeSheet(); sheetContactDetail(dup.id); return; }
    const data={ type, name:nome, phone:fone, address:val('f-address').trim(),
      day:val('f-day'), time:val('f-time'), notes:val('f-notes').trim() };
    if(isNew){ S.contacts.push(Object.assign({id:uid(),history:[]},data)); }
    else { Object.assign(S.contacts.find(x=>x.id===c.id),data); }
    save(); closeSheet(); toast('Salvo! 🌸'); scheduleReminders(); render();
  };
  const del=document.getElementById('delC');
  if(del) del.onclick=()=>confirmSheet(`Excluir ${c.name}?`,'Excluir',()=>{ S.contacts=S.contacts.filter(x=>x.id!==c.id); save(); closeSheet(); render(); });
}
function sheetContactDetail(id){
  const c=S.contacts.find(x=>x.id===id); if(!c)return;
  const hist=(c.history||[]);
  openSheet(`
    <div class="row" style="gap:14px"><div class="avatar" style="width:56px;height:56px;font-size:22px">${initials(c.name)}</div>
      <div><h3 style="margin:0">${esc(c.name)}</h3><span class="tag ${c.type}">${c.type==='estudo'?'Estudo':'Revisita'}</span></div></div>
    <div class="card flat" style="margin-top:16px">
      ${c.phone?`<div class="list-item" data-call="${c.phone}"><span>📞</span><div style="flex:1">${esc(c.phone)}</div><span class="muted small">ligar</span></div>`:''}
      ${c.phone?`<div class="list-item" data-wa="${c.phone}"><span>💬</span><div style="flex:1">WhatsApp</div><span class="muted small">abrir</span></div>`:''}
      ${c.address?`<div class="list-item"><span>📍</span><div style="flex:1">${esc(c.address)}</div></div>`:''}
      ${c.day?`<div class="list-item"><span>🗓️</span><div style="flex:1">${DOW_full(c.day)}${c.time?' às '+c.time:''}</div></div>`:''}
    </div>
    ${c.notes?`<div class="section-title">Anotações</div><div class="card flat"><div class="small" style="white-space:pre-wrap">${esc(c.notes)}</div></div>`:''}
    <div class="section-title">Histórico de atividade</div>
    ${hist.length?`<div class="card flat">${hist.slice(0,20).map(h=>`<div class="list-item"><span>•</span><div style="flex:1"><div class="small"><b>${fmtDataBR(h.date)}</b></div><div class="small muted">${esc(h.note)}</div></div></div>`).join('')}</div>`
      :`<div class="muted small" style="padding:2px">Sem registros ainda. Ao registrar horas você pode vincular esta pessoa.</div>`}
    <div class="grid2" style="margin-top:16px">
      <button class="btn ghost" id="editC">✏️ Editar</button>
      <button class="btn gold" id="addHist">＋ Atividade</button>
    </div>
  `);
  document.getElementById('editC').onclick=()=>{ closeSheet(); sheetContact(c); };
  document.getElementById('addHist').onclick=()=>{ closeSheet(); sheetAddHistory(c.id); };
  document.querySelectorAll('[data-call]').forEach(el=>el.onclick=()=>location.href='tel:'+el.dataset.call.replace(/\D/g,''));
  document.querySelectorAll('[data-wa]').forEach(el=>el.onclick=()=>window.open('https://wa.me/'+waNumber(el.dataset.wa),'_blank'));
}
function sheetAddHistory(id){
  openSheet(`<h3>Registrar atividade</h3>
    ${fieldDate('date','Data',todayISO())}
    <label class="field"><span class="flabel">O que aconteceu</span><textarea id="f-note" placeholder="Ex.: estudamos o capítulo 3; boa participação"></textarea></label>
    <button class="btn gold" id="saveH">Salvar</button>`);
  document.getElementById('saveH').onclick=()=>{
    const c=S.contacts.find(x=>x.id===id); c.history=c.history||[];
    c.history.unshift({date:val('f-date'),note:val('f-note').trim()||'Visita realizada'});
    save(); closeSheet(); toast('Registrado 🌸'); render();
  };
}

/* ================================================================
   TELA 5 — ESTATÍSTICAS / BALANÇO
   ================================================================ */
function viewStats(){
  const a=anoStats();
  const porMod={}; MODALIDADES.forEach(m=>porMod[m.id]=0);
  sessionsInRange(a.startISO,a.endISO).forEach(s=>porMod[s.mod]=(porMod[s.mod]||0)+s.minutes);
  const total=Object.values(porMod).reduce((x,y)=>x+y,0);
  const ativos=MODALIDADES.filter(m=>porMod[m.id]>0).length;
  const arr=MODALIDADES.map(m=>({m,min:porMod[m.id],pct:total?porMod[m.id]/total*100:0})).sort((x,y)=>y.min-x.min);
  // índice de diversidade (0-100): quão distribuído entre as 6 modalidades
  const N=MODALIDADES.length;
  const diversidade = total? Math.round((1 - Math.sqrt(arr.reduce((a,x)=>a+Math.pow(x.pct/100 - 1/N,2),0)/(1-1/N)))*100):0;
  const maior=arr[0];
  let msg;
  if(!total) msg={emo:'🌱',t:'Comece a registrar para ver seu equilíbrio aqui.'};
  else if(diversidade>=70) msg={emo:'🌈',t:`Belo equilíbrio! Você atua bem em ${ativos} modalidades. Continue variando.`};
  else if(maior.pct>55) msg={emo:'⚖️',t:`Você está bastante concentrada em <b>${maior.m.nome}</b> (${maior.pct.toFixed(0)}%). Que tal experimentar outra modalidade esta semana?`};
  else msg={emo:'👍',t:`Boa variedade se formando. Tente incluir as modalidades menos usadas.`};

  const menos=arr.filter(x=>x.min===0).map(x=>x.m);
  return `
  <div class="card center">
    <div class="small muted">Diversidade no serviço</div>
    <div class="big-num" style="color:var(--lav-deep)">${diversidade}<span style="font-size:18px">/100</span></div>
    <div class="progress" style="margin-top:10px"><span style="width:${diversidade}%;background:var(--grad)"></span></div>
    <div class="small muted" style="margin-top:6px">${ativos} de ${MODALIDADES.length} modalidades ativas</div>
  </div>
  <div class="banner"><span class="emo">${msg.emo}</span><div class="txt">${msg.t}</div></div>
  <div class="section-title">Distribuição (ano ${a.label})</div>
  <div class="card">
    ${total? arr.map(x=>`<div class="barline">
        <div class="lbl"><span>${ic(x.m)} ${x.m.nome}</span><span class="muted">${x.min?fmtH(x.min):'—'} · ${x.pct.toFixed(0)}%</span></div>
        <div class="track"><div class="fill" style="width:${x.pct}%;background:${x.m.cor}"></div></div></div>`).join('')
      : `<div class="empty"><span class="emo">📊</span>Sem dados ainda.</div>`}
  </div>
  ${menos.length&&total?`<div class="banner"><span class="emo">💡</span><div class="txt">Você ainda não registrou: <b>${menos.map(m=>m.nome).join(', ')}</b>. Uma pequena participação já ajuda no equilíbrio!</div></div>`:''}
  `;
}

/* ================================================================
   NOTIFICAÇÕES E LEMBRETES
   ================================================================ */
async function askNotif(){
  if(!('Notification' in window)) return false;
  try{ const p=await Notification.requestPermission(); S.settings.notifOn=(p==='granted'); save(); return S.settings.notifOn; }
  catch(e){ return false; }
}
function notify(title,body,tag){
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  try{
    if(navigator.serviceWorker && navigator.serviceWorker.ready){
      navigator.serviceWorker.ready.then(reg=>reg.showNotification(title,{body,icon:'icon-180.png',badge:'icon-180.png',tag}));
    } else { new Notification(title,{body,icon:'icon-180.png',tag}); }
  }catch(e){ console.warn(e); }
}

// Verifica ao abrir o app e mostra banners internos + notificações
function checkBanners(){
  // rodar no máx 1x por render de rota principal
}
function runDailyChecks(){
  const hoje=new Date(), hojeISO=todayISO();
  // 1) Nenhum registro nos últimos 4 dias
  const ult = S.sessions.map(s=>s.date).sort().pop();
  const diasSem = ult? daysBetween(parseISO(ult),hoje) : 99;
  if(S.sessions.length && diasSem>=4 && S.meta.lastNudge!==hojeISO){
    notify('Sentimos sua falta 🌸', `Faz ${diasSem} dias sem registrar serviço. Que tal um pouquinho hoje? Jeová vê seu esforço!`, 'nudge');
    S.meta.lastNudge=hojeISO; save();
  }
  // 2) Meta em risco
  const a=anoStats(), m=mesStats();
  const risco = S.settings.focus==='ano' ? !a.noRitmo : (m.restante>0 && m.diasRest<=7 && m.pct<80);
  if(risco && S.sessions.length && S.meta.lastRisk!==hojeISO){
    const txt = S.settings.focus==='ano'
      ? `Para as ${metaAno()}h, mantenha ~${a.ritmoNecessario.toFixed(1).replace('.',',')}h/dia. Você consegue, não desista! 💪`
      : `Faltam ${m.restante.toFixed(1).replace('.',',')}h para as ${metaMes()}h do mês, em ${m.diasRest} dia(s). Vamos juntas! 💪`;
    notify('Rumo à sua meta 🎯', txt, 'risco');
    S.meta.lastRisk=hojeISO; save();
  }
  // 3) Dia 1º — relatório
  const mesKey=currentMonthKey();
  if(hoje.getDate()===1 && S.meta.lastReportMonth!==mesKey){
    notify('Dia do relatório 📤', 'Toque para enviar seu relatório de horas pelo WhatsApp.', 'relatorio');
  }
  // 4) Lembrete de revisita/estudo amanhã
  const amanha=new Date(hoje); amanha.setDate(hoje.getDate()+1); const amISO=toISO(amanha);
  const planAmanha=S.planned.filter(p=>p.date===amISO);
  const dowAm=['dom','seg','ter','qua','qui','sex','sab'][amanha.getDay()];
  const estudoAmanha=S.contacts.filter(c=>c.day===dowAm);
  if((planAmanha.length||estudoAmanha.length) && S.meta.lastRemind!==hojeISO){
    const nomes=[...estudoAmanha.map(c=>c.name),...planAmanha.map(p=>modById(p.mod).nome)].slice(0,3).join(', ');
    notify('Compromisso amanhã 🗓️', `Amanhã: ${nomes}. Prepare-se com carinho!`, 'lembrete');
    S.meta.lastRemind=hojeISO; save();
  }
}
// Agenda notificações com o app aberto (setTimeout) + registra p/ verificação
function scheduleReminders(){ /* verificação principal ocorre em runDailyChecks ao abrir */ }

/* ---------- Banner interno do relatório (dia 1º) ---------- */
function reportBannerHTML(){
  const mesKey=currentMonthKey();
  if(new Date().getDate()!==1 || S.meta.lastReportMonth===mesKey) return '';
  return `<div class="banner" id="repBanner"><span class="emo">📤</span>
    <div class="txt">Hoje é dia de relatório! Envie suas horas do mês passado pelo WhatsApp.
      <button class="btn gold sm" id="sendRep" style="margin-top:8px">Enviar relatório</button></div></div>`;
}

/* ================================================================
   RELATÓRIO WHATSAPP
   ================================================================ */
function buildReport(refDate){
  const {startISO,endISO,mesNome,ano} = (()=>{ const {startISO,endISO}=monthBounds(refDate);
    return {startISO,endISO,mesNome:MESES_LONG[refDate.getMonth()],ano:refDate.getFullYear()}; })();
  const mk=`${refDate.getFullYear()}-${pad(refDate.getMonth()+1)}`;
  const ses=sessionsInRange(startISO,endISO);
  const totalMin=ses.reduce((a,s)=>a+s.minutes,0) + historicMin(mk);
  const estudos=S.contacts.filter(c=>c.type==='estudo').length;
  let txt=`*Relatório de Serviço — Pioneiro ${tipoPio()==='auxiliar'?'Auxiliar':'Regular'}*\n${mesNome} de ${ano}\n\n`;
  txt+=`⏱️ *Total de horas: ${fmtH(totalMin)}*\n`;
  txt+=`📚 Estudos bíblicos: ${estudos}`;
  if(isSick(mk)){
    txt+=`\n\n📌 Observação: ${S.sick[mk]}`;
    if(abonoMin(mk)>0) txt+=` — solicitar crédito de ${fmtHnum(abonoMin(mk))}h.`;
  }
  return txt;
}
function sendReport(){
  const last=new Date(); last.setDate(0); // último dia do mês anterior
  const txt=buildReport(last);
  const num=waNumber(S.settings.whatsapp);
  S.meta.lastReportMonth=currentMonthKey(); save();
  const url = num? `https://wa.me/${num}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`;
  window.open(url,'_blank');
  render();
}
function previewReportSheet(){
  const ref=new Date();
  openSheet(`<h3>Relatório do mês</h3>
    <label class="field"><span class="flabel">Mês de referência</span>
      <select id="f-ref">
        <option value="0">${MESES_LONG[ref.getMonth()]} ${ref.getFullYear()} (atual)</option>
        <option value="1" selected>${MESES_LONG[(ref.getMonth()+11)%12]} (mês passado)</option>
      </select></label>
    <div class="card flat"><pre id="repPrev" style="white-space:pre-wrap;font-family:inherit;font-size:13px;margin:0"></pre></div>
    <button class="btn gold" id="doSend" style="margin-top:14px">📤 Abrir no WhatsApp</button>
    <div class="small muted center" style="margin-top:8px">O app abre o WhatsApp com tudo pronto. Você confere e toca em enviar.</div>`);
  const upd=()=>{ const off=+val('f-ref'); const d=new Date(); d.setMonth(d.getMonth()-off); if(off) d.setDate(1);
    const dd = off? (()=>{const x=new Date(); x.setDate(0); return x;})() : new Date();
    document.getElementById('repPrev').textContent=buildReport(dd); document.getElementById('doSend').dataset.off=off; };
  document.getElementById('f-ref').onchange=upd; upd();
  document.getElementById('doSend').onclick=()=>{ const off=+val('f-ref'); const dd= off?(()=>{const x=new Date();x.setDate(0);return x;})():new Date();
    const txt=buildReport(dd); const num=waNumber(S.settings.whatsapp);
    if(off) { S.meta.lastReportMonth=currentMonthKey(); save(); }
    window.open((num?`https://wa.me/${num}`:'https://wa.me/')+`?text=${encodeURIComponent(txt)}`,'_blank'); closeSheet(); render(); };
}

/* ================================================================
   ONBOARDING (primeiro acesso)
   ================================================================ */
let onbStep=0, onbData={tipo:'regular',focus:'ano',whatsapp:'',addContact:null};
function renderOnboarding(){
  const steps=[stepWelcome,stepTipo,stepFocus,stepWhats,stepContact];
  app().innerHTML=`<div class="onb">${steps[onbStep]()}<div class="dots">${steps.map((_,i)=>`<i class="${i<=onbStep?'on':''}"></i>`).join('')}</div></div>`;
  bindOnb();
}
function stepWelcome(){ return `<img class="logo-img" src="icon-192.png" alt="Ministério do Reino"><h2>Ministério do Reino</h2>
  <p class="lead">Um app feito com carinho para acompanhar seu serviço a Jeová, com fé e organização. 🌸</p>
  <div class="card flat"><div class="small" style="line-height:1.7">
    ⏱️ Cronômetro por modalidade<br>📅 Agenda e calendário<br>🎯 Metas de horas do serviço<br>👥 Estudos e revisitas<br>📊 Equilíbrio no serviço<br>📤 Relatório pelo WhatsApp</div></div>
  <button class="btn gold" data-onb="next" style="margin-top:20px">Começar ✨</button>`;
}
function stepTipo(){ return `<h2 style="margin-top:20px">Tipo de pioneiro</h2>
  <p class="lead">Qual é a sua modalidade? Isso define suas metas de horas.</p>
  <div class="grid2">
    <button class="chip ${onbData.tipo!=='auxiliar'?'active':''}" data-tipo="regular" style="${onbData.tipo!=='auxiliar'?'background:var(--m-revisita)':''};padding:22px 12px"><span class="emo">👑</span>Regular<br><small>50h/mês · 600h/ano</small></button>
    <button class="chip ${onbData.tipo==='auxiliar'?'active':''}" data-tipo="auxiliar" style="${onbData.tipo==='auxiliar'?'background:var(--m-campo)':''};padding:22px 12px"><span class="emo">🌱</span>Auxiliar<br><small>30h/mês · 360h/ano</small></button>
  </div>
  <div class="row" style="gap:10px;margin-top:20px"><button class="btn soft" data-onb="back">Voltar</button><button class="btn gold" data-onb="next">Continuar</button></div>`;
}
function stepFocus(){ return `<h2 style="margin-top:20px">Seu foco</h2>
  <p class="lead">Você prefere acompanhar a meta pelo <b>ano</b> ou por <b>mês</b>?</p>
  <div class="grid2">
    <button class="chip ${onbData.focus==='ano'?'active':''}" data-focus="ano" style="${onbData.focus==='ano'?'background:var(--m-revisita)':''};padding:22px 12px"><span class="emo">🎯</span>Meta do ano<br><small>${metaAno()} horas</small></button>
    <button class="chip ${onbData.focus==='mes'?'active':''}" data-focus="mes" style="${onbData.focus==='mes'?'background:var(--m-campo)':''};padding:22px 12px"><span class="emo">📆</span>Meta do mês<br><small>${metaMes()} horas</small></button>
  </div>
  <div class="row" style="gap:10px;margin-top:20px"><button class="btn soft" data-onb="back">Voltar</button><button class="btn gold" data-onb="next">Continuar</button></div>`;
}
function stepWhats(){ return `<h2 style="margin-top:20px">Relatório mensal</h2>
  <p class="lead">Todo dia 1º o app prepara seu relatório de horas. Qual WhatsApp vai recebê-lo? (Ex.: o do superintendente de serviço.)</p>
  <label class="field"><span class="flabel">Número do WhatsApp (com DDD)</span>
    <input id="f-whats" type="tel" placeholder="(11) 91234-5678" value="${onbData.whatsapp}"></label>
  <p class="small muted">Você pode deixar em branco e definir depois em Ajustes.</p>
  <div class="row" style="gap:10px;margin-top:16px"><button class="btn soft" data-onb="back">Voltar</button><button class="btn gold" data-onb="next">Continuar</button></div>`;
}
function stepContact(){ return `<h2 style="margin-top:20px">Primeira pessoa</h2>
  <p class="lead">Quer já cadastrar um estudo ou revisita? (Opcional — pode fazer depois.)</p>
  <label class="field"><span class="flabel">Tipo</span>
    <div class="grid2" id="typeSel">
      <button type="button" class="chip active" data-t="estudo" style="background:var(--m-estudo)"><span class="emo">📖</span>Estudo</button>
      <button type="button" class="chip" data-t="revisita"><span class="emo">🔁</span>Revisita</button>
    </div></label>
  ${fieldText('cname','Nome (opcional)','')}
  ${fieldText('cphone','Telefone','', 'tel')}
  <div class="row" style="gap:10px;margin-top:8px"><button class="btn soft" data-onb="back">Voltar</button><button class="btn gold" data-onb="finish">Concluir 🎉</button></div>`;
}
function bindOnb(){
  document.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>{ onbData.focus=b.dataset.focus; renderOnboarding(); });
  document.querySelectorAll('[data-tipo]').forEach(b=>b.onclick=()=>{ onbData.tipo=b.dataset.tipo; S.settings.tipo=b.dataset.tipo; save(); renderOnboarding(); });
  let ctype='estudo';
  document.querySelectorAll('#typeSel .chip').forEach(b=>b.onclick=()=>{ ctype=b.dataset.t;
    document.querySelectorAll('#typeSel .chip').forEach(x=>{x.classList.remove('active');x.style.background='';});
    b.classList.add('active'); b.style.background= ctype==='estudo'?'var(--m-estudo)':'var(--m-revisita)'; });
  document.querySelectorAll('[data-onb]').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.onb;
    if(a==='next'){
      if(document.getElementById('f-whats')){ onbData.whatsapp=val('f-whats'); }  // captura o WhatsApp se estiver nesse passo
      onbStep++; renderOnboarding();
    } else if(a==='back'){ onbStep--; renderOnboarding(); }
    else if(a==='finish'){
      onbData.whatsapp = onbData.whatsapp || (document.getElementById('f-whats')?document.getElementById('f-whats').value:'');
      S.settings.tipo=onbData.tipo; S.settings.focus=onbData.focus; S.settings.whatsapp=onbData.whatsapp; S.settings.onboardingDone=true;
      const cname=val('cname'); if(cname&&cname.trim() && !findDuplicateContact(cname.trim(),val('cphone').trim(),null)){ S.contacts.push({id:uid(),type:ctype,name:cname.trim(),phone:val('cphone').trim(),history:[]}); }
      save();
      route='timer'; render();                 // avança PRIMEIRO (não trava esperando permissão)
      setTimeout(()=>{ try{ askNotif(); }catch(e){} }, 400);  // pede notificação depois, sem bloquear
    }
  });
}

/* ================================================================
   AJUSTES
   ================================================================ */
function sheetSettings(){
  openSheet(`<h3>Ajustes ⚙️</h3>
    <label class="field"><span class="flabel">Tipo de pioneiro</span>
      <select id="s-tipo">
        <option value="regular" ${tipoPio()==='regular'?'selected':''}>Regular — 50h/mês · 600h/ano</option>
        <option value="auxiliar" ${tipoPio()==='auxiliar'?'selected':''}>Auxiliar — 30h/mês · 360h/ano</option>
      </select></label>
    <label class="field"><span class="flabel">Tema do app</span>
      <select id="s-tema">
        <option value="rose" ${(S.settings.tema||'rose')==='rose'?'selected':''}>Rosé (padrão) 🌸</option>
        <option value="azul" ${S.settings.tema==='azul'?'selected':''}>Azul bebê 🩵</option>
      </select></label>
    <label class="field"><span class="flabel">Foco da meta</span>
      <select id="s-focus"><option value="ano" ${S.settings.focus==='ano'?'selected':''}>Ano (${metaAno()}h)</option>
      <option value="mes" ${S.settings.focus==='mes'?'selected':''}>Mês (${metaMes()}h)</option></select></label>
    <label class="field"><span class="flabel">WhatsApp do relatório</span>
      <input id="s-whats" type="tel" value="${esc(S.settings.whatsapp||'')}" placeholder="(11) 91234-5678"></label>
    <button class="btn ${S.settings.notifOn?'soft':'ghost'}" id="s-notif">${S.settings.notifOn?'🔔 Notificações ativas':'🔕 Ativar notificações'}</button>
    <div class="divider"></div>
    <button class="btn gold" id="s-report">📤 Enviar relatório agora</button>
    <button class="btn soft" id="s-save" style="margin-top:10px">Salvar ajustes</button>
    <div class="divider"></div>
    <div class="small muted" style="margin:0 2px 10px">Backup de segurança — guarde o arquivo em local seguro (e-mail, nuvem).</div>
    <button class="btn soft" id="s-export">⬇️ Exportar meus dados (backup)</button>
    <button class="btn soft" id="s-import" style="margin-top:10px">⬆️ Restaurar backup</button>
    <input type="file" id="s-importfile" accept="application/json,.json" style="display:none">
    ${(window.cloudEnabled && window.cloudEnabled() && window.cloudLoggedIn && window.cloudLoggedIn())?`
      <div class="divider"></div>
      <div class="small muted" style="margin-bottom:8px">☁️ Conta: <b>${esc(window.cloudUserEmail())}</b> — dados sincronizados na nuvem.</div>
      <button class="btn soft" id="s-logout">Sair da conta</button>`:''}
    <div class="small muted center" style="margin-top:14px">Feito com 💛 para a obra de Jeová</div>`);
  { const lo=document.getElementById('s-logout'); if(lo) lo.onclick=()=>confirmSheet('Sair da conta? Seus dados ficam salvos na nuvem.','Sair',async()=>{ await window.cloudSignOut(); location.reload(); }); }
  document.getElementById('s-notif').onclick=async()=>{ await askNotif(); closeSheet(); toast(S.settings.notifOn?'Notificações ativadas 🔔':'Permissão não concedida'); };
  document.getElementById('s-report').onclick=()=>{ closeSheet(); previewReportSheet(); };
  document.getElementById('s-tema').onchange=(e)=>{ S.settings.tema=e.target.value; applyTheme(); };  // preview na hora
  document.getElementById('s-save').onclick=()=>{ S.settings.tipo=val('s-tipo'); S.settings.tema=val('s-tema'); S.settings.focus=val('s-focus'); S.settings.whatsapp=val('s-whats'); save(); closeSheet(); toast('Ajustes salvos 🌸'); render(); };
  document.getElementById('s-export').onclick=exportData;
  document.getElementById('s-import').onclick=()=>document.getElementById('s-importfile').click();
  document.getElementById('s-importfile').onchange=(e)=>{ const f=e.target.files&&e.target.files[0]; if(f) importData(f); };
}
function exportData(){
  const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`meu-servico-backup-${todayISO()}.json`; a.click(); URL.revokeObjectURL(url);
  toast('Backup baixado 💾');
}
function importData(file){
  const reader=new FileReader();
  reader.onload=()=>{
    let data; try{ data=JSON.parse(reader.result); }catch(e){ toast('Arquivo inválido 🙁'); return; }
    if(!data || typeof data!=='object' || !data.settings){ toast('Este arquivo não é um backup válido'); return; }
    confirmSheet('Restaurar este backup? Os dados atuais no aparelho serão substituídos.','Restaurar',()=>{
      S=Object.assign(defaultState(), data); save(); closeSheet(); toast('Dados restaurados 🌸'); route='timer'; render();
    });
  };
  reader.readAsText(file);
}

/* ================================================================
   UI helpers (sheet, campos, toast)
   ================================================================ */
function openSheet(html){ closeSheet();
  const o=document.createElement('div'); o.className='overlay'; o.id='sheet';
  o.innerHTML=`<div class="sheet"><div class="grabber"></div>${html}</div>`;
  o.onclick=e=>{ if(e.target===o) closeSheet(); };
  document.body.appendChild(o);
}
function closeSheet(){ const o=document.getElementById('sheet'); if(o) o.remove(); }
function confirmSheet(msg,okLabel,fn){
  openSheet(`<h3 style="margin-bottom:16px">${msg}</h3>
    <button class="btn danger" id="cy">${okLabel}</button>
    <button class="btn soft" id="cn" style="margin-top:10px">Cancelar</button>`);
  document.getElementById('cy').onclick=()=>{ closeSheet(); fn(); };
  document.getElementById('cn').onclick=closeSheet;
}
function fieldText(id,label,v='',type='text'){ return `<label class="field"><span class="flabel">${label}</span><input id="f-${id}" type="${type}" value="${esc(v||'')}"></label>`; }
function fieldNum(id,label,v){ return `<label class="field"><span class="flabel">${label}</span><input id="f-${id}" type="number" min="0" value="${v}"></label>`; }
function fieldDate(id,label,v){ return `<label class="field"><span class="flabel">${label}</span><input id="f-${id}" type="date" value="${v}"></label>`; }
const val=id=>{ const e=document.getElementById('f-'+id)||document.getElementById(id); return e?e.value:''; };
function toast(msg){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2200); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function initials(n){ return (n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
function waNumber(raw){ let d=String(raw||'').replace(/\D/g,''); if(!d) return ''; if(d.length<=11) d='55'+d; return d; }

// ----- Controle de estudantes/revisitas duplicados -----
// Mesma pessoa = mesmo nome (ignorando maiúsculas/acentos) + mesmo telefone normalizado.
function normName(n){ return String(n||'').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
function contactKey(name,phone){ return normName(name)+'|'+waNumber(phone); }
function findDuplicateContact(name,phone,exceptId){
  const k=contactKey(name,phone);
  return S.contacts.find(c=>c.id!==exceptId && contactKey(c.name,c.phone)===k);
}
function dedupeContacts(){
  const seen={}, out=[];
  for(const c of S.contacts){ const k=contactKey(c.name,c.phone);
    if(k in seen){ const t=out[seen[k]];
      t.history=[...(t.history||[]),...(c.history||[])];
      t.address=t.address||c.address; t.day=t.day||c.day; t.time=t.time||c.time; t.phone=t.phone||c.phone;
      t.notes=[t.notes,c.notes].filter(Boolean).join('\n').trim()||t.notes;
    } else { seen[k]=out.length; out.push(Object.assign({},c)); } }
  if(out.length!==S.contacts.length){ S.contacts=out; save(); return true; }
  return false;
}

/* ---------- Banner do relatório + botão ajustes na topbar ---------- */
const _render=render;
render=function(){ _render();
  // injeta banner de relatório no topo da tela (fora do onboarding)
  if(S.settings.onboardingDone){
    const scr=document.querySelector('.screen');
    const bh=reportBannerHTML();
    if(scr && bh){ scr.insertAdjacentHTML('afterbegin',bh);
      const b=document.getElementById('sendRep'); if(b) b.onclick=()=>previewReportSheet(); }
    // botão de ajustes na topbar
    const tb=document.querySelector('.topbar .crown');
    if(tb){ tb.style.cursor='pointer'; tb.title='Ajustes'; tb.onclick=sheetSettings; }
  }
};

/* ================================================================
   INICIALIZAÇÃO
   ================================================================ */
if('serviceWorker' in navigator){
  let hadController = !!navigator.serviceWorker.controller;
  // Quando uma versão nova assume o controle, recarrega sozinho (dados ficam salvos no aparelho).
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{ if(hadController) location.reload(); hadController=true; });
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').then(reg=>{ try{ reg.update(); }catch(e){} }).catch(()=>{});
  });
  // Ao reabrir/voltar o foco, procura atualização
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) navigator.serviceWorker.getRegistration().then(r=>{ r&&r.update(); }).catch(()=>{}); });
}
/* ================================================================
   LOGIN (Supabase) + SINCRONIZAÇÃO NA NUVEM
   ================================================================ */
let authMode='login';
function traduzErroAuth(m){
  m=(m||'').toLowerCase();
  if(m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if(m.includes('already registered')||m.includes('user already')) return 'Este e-mail já tem conta. Toque em "Já tem conta? Entrar".';
  if(m.includes('email not confirmed')) return 'Confirme seu e-mail (veja a caixa de entrada) antes de entrar.';
  if(m.includes('rate limit')) return 'Muitas tentativas. Aguarde um pouquinho.';
  if(m.includes('password')) return 'Senha inválida (mínimo 6 caracteres).';
  if(m.includes('cloud off')) return 'Nuvem ainda não configurada.';
  return 'Não foi possível. ('+m+')';
}
function renderAuth(){
  chromeEl().innerHTML='';
  const signup = authMode==='signup';
  app().innerHTML = `<div class="onb">
    <img class="logo-img" src="icon-192.png" alt="Ministério do Reino">
    <h2>Ministério do Reino</h2>
    <p class="lead">${signup?'Crie sua conta — seus dados ficam salvos na nuvem e sincronizados entre aparelhos. ☁️':'Entre para acessar seu serviço. 🌸'}</p>
    <label class="field"><span class="flabel">E-mail</span><input id="au-email" type="email" inputmode="email" autocapitalize="off" placeholder="voce@email.com"></label>
    <label class="field"><span class="flabel">Senha</span><input id="au-pass" type="password" placeholder="mínimo 6 caracteres"></label>
    <div id="au-msg" class="small" style="min-height:18px;margin:0 2px 8px"></div>
    <button class="btn gold" id="au-go">${signup?'Criar conta':'Entrar'}</button>
    <button class="btn soft" id="au-switch" style="margin-top:10px">${signup?'Já tem conta? Entrar':'Não tem conta? Criar conta'}</button>
    ${signup?'':`<button class="btn soft" id="au-forgot" style="margin-top:10px">Esqueci minha senha</button>`}
    <div class="dots" style="margin-top:22px"><i class="on"></i></div>
  </div>`;
  const msg=(t,ok)=>{ const e=document.getElementById('au-msg'); if(e){ e.style.color=ok?'var(--ok)':'var(--danger)'; e.textContent=t||''; } };
  document.getElementById('au-switch').onclick=()=>{ authMode=signup?'login':'signup'; renderAuth(); };
  const fg=document.getElementById('au-forgot');
  if(fg) fg.onclick=async()=>{ const email=(document.getElementById('au-email').value||'').trim();
    if(!email){ msg('Digite seu e-mail primeiro.'); return; }
    await window.cloudReset(email); msg('Se houver conta com esse e-mail, enviamos um link de recuperação.',true); };
  document.getElementById('au-go').onclick=async()=>{
    const email=(document.getElementById('au-email').value||'').trim();
    const pass=document.getElementById('au-pass').value||'';
    if(!email||!pass){ msg('Preencha e-mail e senha.'); return; }
    if(pass.length<6){ msg('A senha precisa ter ao menos 6 caracteres.'); return; }
    msg('Aguarde…',true);
    const { data, error } = await (signup?window.cloudSignUp:window.cloudSignIn)(email,pass);
    if(error){ msg(traduzErroAuth(error.message)); return; }
    if(signup && (!data || !data.session)){ msg('Conta criada! Confirme pelo e-mail e depois entre.',true); authMode='login'; setTimeout(renderAuth,1500); return; }
    // sucesso: o onCloudAuth cuida de carregar o app
  };
}
/* ---------- Inicialização ---------- */
function startApp(){
  dedupeContacts();   // limpa duplicados antigos
  hydrateTimer();     // restaura o cronômetro
  applyTheme(); render();
  setTimeout(runDailyChecks, 1200);
}
async function syncOnStart(){
  try{
    const res = await window.cloudPull();
    if(res.status==='ok' && res.row && res.row.data){
      const cd=res.row.data;
      const cloudUpd=(cd.meta&&cd.meta.updatedAt)||res.row.updated_at||'';
      const localUpd=(S.meta&&S.meta.updatedAt)||'';
      if(!localUpd || cloudUpd>=localUpd){ S=Object.assign(defaultState(), cd); save(true); }
      else { window.cloudPush(S); }
    } else if(res.status==='none'){
      window.cloudPush(S);   // primeira vez nesta conta -> cria a linha na nuvem
    }
  }catch(e){ console.warn('syncOnStart', e); }
}
let _booted=false;
function bootWith(session){
  if(session && session.user){
    window.setCloudUser(session.user);
    if(!_booted){ _booted=true; syncOnStart().then(startApp).catch(startApp); }
  } else {
    _booted=false; window.setCloudUser(null); renderAuth();
  }
}
(function bootstrap(){
  if(window.initCloud) window.initCloud();
  if(window.cloudEnabled && window.cloudEnabled()){
    window.onCloudAuth((event, session)=> bootWith(session));
    window.cloudGetSession().then(s=> bootWith(s));
  } else {
    startApp();   // nuvem não configurada -> funciona local (offline)
  }
})();
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(timer.running) updateTimerNotification();   // ao sair com o cronômetro rodando, mostra a notificação
  } else {
    clearTimerNotification(); runDailyChecks(); render();   // ao voltar: recalcula o tempo (não zerou) e limpa o aviso
  }
});
