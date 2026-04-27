// ══════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════
const LOCAL_URL = './data.json';
const CDN_URL = 'https://cdn.jsdelivr.net/gh/alejandroggo/espanoles-nba@main/data.json';
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRcnveDICJslZxp9dr116TsvDjcoDdf7LOgIwjKinRd5FixvhRnc-mQ4XfKgXASkxaiI8z4BStm6yD/pub?gid=705791197&single=true&output=csv';

const STAT_LABELS = {
  PTS: 'Puntos',  RBD: 'Rebotes',  AST: 'Asistencias',
  STL: 'Robos',   BLK: 'Tapones',  MIN: 'Minutos',
  FGM: 'Canastas de campo', FGA: 'Intentos de campo',
  '3PM': 'Triples', '3PA': 'Intentos de triple',
  FTM: 'Tiros libres', FTA: 'Intentos de tiro libre',
  TOV: 'Pérdidas', PF: 'Faltas'
};

// ══════════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════════
let DATA = null;
let sortCol = 'pts_g';
let sortAsc = false;
let searchTerm = '';
let activeTab = {};

// ══════════════════════════════════════════════
// ARRANQUE
// ══════════════════════════════════════════════
async function init() {
  try {
    const res = await fetch(LOCAL_URL);
    if (!res.ok) throw new Error('local');
    DATA = await res.json();
  } catch(e) {
    try {
      const res = await fetch(CDN_URL);
      if (!res.ok) throw new Error('cdn');
      DATA = await res.json();
    } catch(e2) {
      DATA = FALLBACK_DATA;
    }
  }

  // fusionar game highs del sheet (fallo silencioso si no hay acceso)
  try {
    const res = await fetch(SHEET_URL);
    if (res.ok) {
      const csv = await res.text();
      mergeGameHighs(parseGameHighsCsv(csv));
    }
  } catch(e) {}

  hideLoader();
  renderHeroKpis();
  renderTabla();
  handleHash();
}

// ── GAME HIGHS DESDE GOOGLE SHEET ────────────
function parseGameHighsCsv(csv) {
  // separa líneas y celdas (respeta campos entrecomillados)
  const rows = csv.split('\n').map(line => {
    const cells = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });

  // fila 1 (índice 0) vacía/título, fila 2 (índice 1) cabeceras desde col C (índice 2)
  // C=JUGADOR, D=MIN, E=PTS, F=RBD, G=AST, H=STL, I=BLK, J=FGM, K=FGA,
  // L=3PM, M=3PA, N=FTM, O=FTA, P=TOV, Q=PF
  const COLS = ['MIN','PTS','RBD','AST','STL','BLK','FGM','FGA','3PM','3PA','FTM','FTA','TOV','PF'];

  const result = {};
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const nombre = row[2];
    if (!nombre) continue;
    const records = [];
    COLS.forEach((stat, idx) => {
      const raw = row[3 + idx];
      if (raw && raw !== '' && raw !== '—' && raw !== '-') {
        records.push({ categoria: STAT_LABELS[stat] || stat, valor: isNaN(raw) ? raw : Number(raw) });
      }
    });
    result[nombre] = records;
  }
  return result;
}

function mergeGameHighs(highs) {
  if (!highs) return;
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  DATA.jugadores.forEach(j => {
    const match = Object.keys(highs).find(k => norm(k) === norm(j.nombre));
    if (match) j.records = highs[match];
  });
}

function hideLoader() {
  const l = document.getElementById('loader');
  l.classList.add('hidden');
  setTimeout(() => l.style.display = 'none', 400);

  if (DATA.actualizado) {
    const d = new Date(DATA.actualizado);
    document.getElementById('last-update').textContent =
      'Actualizado: ' + d.toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'numeric'});
  }
}

// ══════════════════════════════════════════════
// ROUTING HASH
// ══════════════════════════════════════════════
window.addEventListener('hashchange', handleHash);

function handleHash() {
  const hash = location.hash.slice(1);
  if (hash && DATA) {
    const j = DATA.jugadores.find(x => x.id === hash);
    if (j) { showJugador(j); return; }
  }
  showView('ranking');
}

function goHome() {
  history.pushState('', '', location.pathname);
  showView('ranking');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

// ══════════════════════════════════════════════
// HERO KPIS
// ══════════════════════════════════════════════
function renderHeroKpis() {
  const j = DATA.jugadores;
  const totalGanancias = j.reduce((s,x) => s + (x.ganancias||0), 0);
  const totalPartidos = j.reduce((s,x) => s + (x.partidos||0), 0);

  document.getElementById('hero-sub').textContent =
    j.length + ' jugadores · desde Fernando Martín (1985)';

  document.getElementById('hero-kpis').innerHTML = `
    <div>
      <div class="kpi-num">${j.length}</div>
      <div class="kpi-label">Jugadores</div>
    </div>
    <div>
      <div class="kpi-num">${totalPartidos.toLocaleString('es-ES')}</div>
      <div class="kpi-label">Partidos totales</div>
    </div>
    <div>
      <div class="kpi-num">$${(totalGanancias/1e6).toFixed(0)}M</div>
      <div class="kpi-label">Ganados en la NBA</div>
    </div>
  `;
}

// ══════════════════════════════════════════════
// TABLA RANKING
// ══════════════════════════════════════════════
function renderTabla() {
  let jugadores = [...DATA.jugadores];

  // filtro búsqueda
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    jugadores = jugadores.filter(j => j.nombre.toLowerCase().includes(q));
  }

  // ordenar
  jugadores.sort((a,b) => {
    const va = a[sortCol] ?? (sortAsc ? Infinity : -Infinity);
    const vb = b[sortCol] ?? (sortAsc ? Infinity : -Infinity);
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  });

  // actualizar cabecera activa
  document.querySelectorAll('thead th').forEach(th => {
    th.classList.remove('sorted','asc');
    if (th.dataset.col === sortCol) {
      th.classList.add('sorted');
      if (sortAsc) th.classList.add('asc');
    }
  });

  // sincronizar chips: estado activo y flecha de dirección
  document.querySelectorAll('.chip[data-col]').forEach(c => {
    const isActive = c.dataset.col === sortCol;
    c.classList.toggle('active', isActive);
    const label = c.dataset.label || (c.dataset.label = c.textContent.trim());
    c.textContent = isActive ? label + (sortAsc ? ' ↑' : ' ↓') : label;
  });

  document.getElementById('results-count').textContent =
    jugadores.length + ' jugador' + (jugadores.length!==1?'es':'');

  const tbody = document.getElementById('ranking-body');
  tbody.innerHTML = jugadores.map((j, i) => `
    <tr onclick="openJugador('${j.id}')" style="animation-delay:${i*0.02}s">
      <td class="rank">${i+1}</td>
      <td class="nombre">${j.nombre}</td>
      <td class="draft-badge">
        ${j.draft
          ? `<span class="badge badge-draft">${j.draft_anio||'Draft'}</span>`
          : `<span class="badge badge-undraft">Undrafted</span>`}
      </td>
      <td class="${sortCol==='partidos'?'highlight':''}">${fmt(j.partidos)}</td>
      <td class="${sortCol==='pts_g'?'highlight':''}">${fmtDec(j.pts_g)}</td>
      <td class="${sortCol==='rbd_g'?'highlight':''}">${fmtDec(j.rbd_g)}</td>
      <td class="${sortCol==='ast_g'?'highlight':''}">${fmtDec(j.ast_g)}</td>
      <td>${fmtPct(j.fg_pct)}</td>
      <td>${fmtPct(j.tres_pct)}</td>
      <td>${fmtPct(j.ft_pct)}</td>
      <td>${fmtDec(j.blk_g)}</td>
      <td>${fmtDec(j.stl_g)}</td>
      <td class="${sortCol==='temporadas'?'highlight':''}">${fmt(j.temporadas)}</td>
      <td class="${sortCol==='ganancias'?'dorado':''}">${fmtMoney(j.ganancias)}</td>
    </tr>
  `).join('');
}

function sortTable(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = false; }
  renderTabla();
}

function setSortChip(el, col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = false; }
  renderTabla();
}

function filterTabla() {
  searchTerm = document.getElementById('search-input').value.trim();
  renderTabla();
}

function openJugador(id) {
  location.hash = id;
}

// ══════════════════════════════════════════════
// FICHA JUGADOR
// ══════════════════════════════════════════════
function showJugador(j) {
  showView('jugador');
  document.getElementById('ficha-content').innerHTML = buildFicha(j);
  // activar primera tab
  const firstTab = document.querySelector('.tab-btn');
  if (firstTab) firstTab.click();
}

function buildFicha(j) {
  const premiosCount = (j.premios||[]).length;
  const poSeasons = (j.playoffs_temporadas||[]).length;

  return `
    <div class="ficha-header">
      <div>
        <h2 class="ficha-nombre">
          ${j.nombre.split(' ').slice(0,1).join(' ')}<br>
          <em>${j.nombre.split(' ').slice(1).join(' ')}</em>
        </h2>
        <div class="ficha-meta">
          ${j.draft ? `<span class="meta-pill">Draft ${j.draft_anio} · Pick #${j.draft_pick||'?'} · ${j.draft_equipo||''}</span>` : '<span class="meta-pill">Undrafted</span>'}
          ${j.nacimiento ? `<span class="meta-pill">Nacido en ${j.nacimiento}</span>` : ''}
          <span class="meta-pill">${j.temporadas||0} temporadas</span>
        </div>
      </div>
      <div class="ficha-kpis">
        <div class="fkpi">
          <div class="fkpi-num">${fmtMoney(j.ganancias)}</div>
          <div class="fkpi-label">Ganancias NBA</div>
        </div>
        <div class="fkpi">
          <div class="fkpi-num">${j.partidos||0}</div>
          <div class="fkpi-label">Partidos</div>
        </div>
        <div class="fkpi">
          <div class="fkpi-num">${premiosCount}</div>
          <div class="fkpi-label">Premios</div>
        </div>
      </div>
    </div>

    <div class="stat-boxes">
      ${statBox(fmtDec(j.pts_g), 'PPG')}
      ${statBox(fmtDec(j.rbd_g), 'RPG')}
      ${statBox(fmtDec(j.ast_g), 'APG')}
      ${statBox(fmtDec(j.stl_g), 'SPG')}
      ${statBox(fmtDec(j.blk_g), 'BPG')}
      ${statBox(fmtPct(j.fg_pct), 'FG%')}
      ${statBox(fmtPct(j.tres_pct), '3P%')}
      ${statBox(fmtPct(j.ft_pct), 'FT%')}
    </div>

    <div class="tabs">
      <button class="tab-btn" onclick="openTab(this,'tab-carrera')">Carrera</button>
      <button class="tab-btn" onclick="openTab(this,'tab-temporadas')">Temporadas</button>
      <button class="tab-btn" onclick="openTab(this,'tab-playoffs')">Playoffs ${poSeasons>0?`(${poSeasons})`:''}</button>
      <button class="tab-btn" onclick="openTab(this,'tab-premios')">Premios ${premiosCount>0?`(${premiosCount})`:''}</button>
      <button class="tab-btn" onclick="openTab(this,'tab-records')">Récords</button>
    </div>

    <div id="tab-carrera" class="tab-panel">
      ${buildTabCarrera(j)}
    </div>
    <div id="tab-temporadas" class="tab-panel">
      ${buildTabTemporadas(j)}
    </div>
    <div id="tab-playoffs" class="tab-panel">
      ${buildTabPlayoffs(j)}
    </div>
    <div id="tab-premios" class="tab-panel">
      ${buildTabPremios(j)}
    </div>
    <div id="tab-records" class="tab-panel">
      ${buildTabRecords(j)}
    </div>
  `;
}

function statBox(val, label) {
  return `<div class="stat-box"><div class="stat-box-num">${val}</div><div class="stat-box-label">${label}</div></div>`;
}

function openTab(btn, tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// ── TAB CARRERA ──────────────────────────────
function buildTabCarrera(j) {
  return `
    <table class="tab-table">
      <thead><tr>
        <th>Stat</th><th>Total</th><th>Por partido</th>
      </tr></thead>
      <tbody>
        <tr><td>Puntos</td><td>${fmt(j.pts_total)}</td><td>${fmtDec(j.pts_g)}</td></tr>
        <tr><td>Rebotes</td><td>${fmt(j.rbd_total)}</td><td>${fmtDec(j.rbd_g)}</td></tr>
        <tr><td>Asistencias</td><td>${fmt(j.ast_total)}</td><td>${fmtDec(j.ast_g)}</td></tr>
        <tr><td>Robos</td><td>${fmt(j.stl_total)}</td><td>${fmtDec(j.stl_g)}</td></tr>
        <tr><td>Tapones</td><td>${fmt(j.blk_total)}</td><td>${fmtDec(j.blk_g)}</td></tr>
        <tr><td>Triples anotados</td><td>${fmt(j.tres_total)}</td><td>${fmtDec(j.tres_g)}</td></tr>
        <tr><td>FG%</td><td>—</td><td>${fmtPct(j.fg_pct)}</td></tr>
        <tr><td>3P%</td><td>—</td><td>${fmtPct(j.tres_pct)}</td></tr>
        <tr><td>FT%</td><td>—</td><td>${fmtPct(j.ft_pct)}</td></tr>
        <tr><td>Minutos</td><td>${fmt(j.min_total)}</td><td>${fmtDec(j.min_g)}</td></tr>
        <tr><td>Pérdidas</td><td>${fmt(j.tov_total)}</td><td>—</td></tr>
        <tr><td>Faltas</td><td>${fmt(j.pf_total)}</td><td>—</td></tr>
      </tbody>
      <tfoot>
        <tr><td>Partidos jugados (titular)</td><td>${fmt(j.partidos)}</td><td>${j.partidos_titular != null ? `(${fmt(j.partidos_titular)})` : '—'}</td></tr>
      </tfoot>
    </table>
    ${j.equipos_nba ? `<p style="margin-top:1rem;font-family:var(--mono);font-size:0.65rem;color:var(--texto-dim);">EQUIPOS: ${j.equipos_nba}</p>` : ''}
  `;
}

// ── TAB TEMPORADAS ───────────────────────────
function buildTabTemporadas(j) {
  const seas = j.temporadas_data;
  if (!seas || !seas.length) return '<p class="empty-msg">Sin datos de temporada</p>';

  return `
    <div style="overflow-x:auto">
    <table class="tab-table">
      <thead><tr>
        <th>Temporada</th><th>Equipo</th><th>PJ</th><th>MIN</th>
        <th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th>
        <th>FG%</th><th>3P%</th><th>FT%</th>
      </tr></thead>
      <tbody>
        ${seas.map(s => `
          <tr>
            <td>${s.year||'—'}</td>
            <td>${s.team||'—'}</td>
            <td>${fmt(s.g)}</td>
            <td>${fmtDec(s.min_g)}</td>
            <td>${fmtDec(s.pts_g)}</td>
            <td>${fmtDec(s.rbd_g)}</td>
            <td>${fmtDec(s.ast_g)}</td>
            <td>${fmtDec(s.stl_g)}</td>
            <td>${fmtDec(s.blk_g)}</td>
            <td>${fmtPct(s.fg_pct)}</td>
            <td>${fmtPct(s.tres_pct)}</td>
            <td>${fmtPct(s.ft_pct)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
}

// ── TAB PLAYOFFS ────────────────────────────
function buildTabPlayoffs(j) {
  const po = j.playoffs_temporadas;
  if (!po || !po.length) return '<p class="empty-msg">Sin apariciones en playoffs</p>';

  return `
    <div style="overflow-x:auto">
    <table class="tab-table">
      <thead><tr>
        <th>Temporada</th><th>Equipo</th><th>PJ</th>
        <th>PPG</th><th>RPG</th><th>APG</th><th>FG%</th>
      </tr></thead>
      <tbody>
        ${po.map(s => `
          <tr>
            <td>${s.year||'—'}</td>
            <td>${s.team||'—'}</td>
            <td>${fmt(s.g)}</td>
            <td>${fmtDec(s.pts_g)}</td>
            <td>${fmtDec(s.rbd_g)}</td>
            <td>${fmtDec(s.ast_g)}</td>
            <td>${fmtPct(s.fg_pct)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
}

// ── TAB PREMIOS ──────────────────────────────
function buildTabPremios(j) {
  const premios = j.premios;
  if (!premios || !premios.length) return '<p class="empty-msg">Sin premios individuales</p>';

  const ordenPremios = ['ROY','MVP','DPOY','All NBA','All Star','All Rookie','All Defense','Rising Stars','POM','ROM'];
  const sorted = [...premios].sort((a,b) => {
    const ia = ordenPremios.indexOf(a.tipo); const ib = ordenPremios.indexOf(b.tipo);
    return (ia<0?99:ia) - (ib<0?99:ib);
  });

  return `<div class="premios-grid">${sorted.map(p => `
    <div class="premio-card ${['ROY','MVP','DPOY','All NBA'].includes(p.tipo)?'premio-dorado':''}">
      <div class="premio-tipo">${p.tipo}</div>
      <div class="premio-nombre">${p.detalle||p.tipo}</div>
      <div class="premio-meta">${p.year} · ${p.team}</div>
    </div>
  `).join('')}</div>`;
}

// ── TAB RÉCORDS ──────────────────────────────
function buildTabRecords(j) {
  const recs = j.records;
  if (!recs || !recs.length) return '<p class="empty-msg">Sin récords registrados</p>';

  return `<div class="records-grid">${recs.map(r => `
    <div class="record-card">
      <div class="record-num">${r.valor}</div>
      <div class="record-info">
        <div class="record-cat">${r.categoria}</div>
        <div class="record-desc">${r.team||''} vs ${r.rival||'—'}</div>
        <div class="record-fecha">${r.fecha||''}</div>
      </div>
    </div>
  `).join('')}</div>`;
}

// ══════════════════════════════════════════════
// HELPERS FORMATO
// ══════════════════════════════════════════════
const fmt = v => (v===null||v===undefined||v==='') ? '—' : Number(v).toLocaleString('es-ES');
const fmtDec = v => (v===null||v===undefined||v==='') ? '—' : Number(v).toFixed(1);
const fmtPct = v => (v===null||v===undefined||v==='') ? '—' : (Number(v)*100).toFixed(1)+'%';
const fmtMoney = v => {
  if (!v) return '—';
  const n = Number(v);
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + n.toLocaleString('es-ES');
};

// ══════════════════════════════════════════════
// FALLBACK (copia completa para vista offline)
// ══════════════════════════════════════════════
const FALLBACK_DATA = {"actualizado":"2026-04-25T00:00:00.000Z","jugadores":[{"id":"pau-gasol","nombre":"Pau Gasol","rank":1,"draft":true,"draft_anio":2001,"draft_pick":3,"draft_equipo":"ATL","nacimiento":1980,"temporadas":18,"partidos":1226,"partidos_titular":1150,"min_total":41001,"min_g":33.4,"pts_total":20894,"pts_g":17.0,"rbd_total":11305,"rbd_g":9.2,"ast_total":3925,"ast_g":3.2,"stl_total":606,"stl_g":0.5,"blk_total":1941,"blk_g":1.6,"tres_total":179,"tres_g":0.1,"tov_total":2638,"pf_total":2632,"fg_pct":0.507,"tres_pct":0.368,"ft_pct":0.753,"equipos_nba":"MEM, LAL, CHI, SAS","ganancias":220990766,"primer_partido":{"fecha":"1 nov 2001","equipo":"MEM","rival":"DET","min":"17:20","pts":4,"rbd":4,"ast":1},"premios":[{"tipo":"ROY","detalle":"Rookie of the Year","year":2002,"team":"MEM"},{"tipo":"ROM","detalle":"Rookie of the Month — Noviembre 2001","year":2002,"team":"MEM"},{"tipo":"ROM","detalle":"Rookie of the Month — Enero 2002","year":2002,"team":"MEM"},{"tipo":"ROM","detalle":"Rookie of the Month — Marzo 2002","year":2002,"team":"MEM"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2002,"team":"MEM"},{"tipo":"Rising Stars","detalle":"Novatos","year":2002,"team":"MEM"},{"tipo":"Rising Stars","detalle":"Sophomores","year":2003,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste","year":2006,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste","year":2009,"team":"LAL"},{"tipo":"POM","detalle":"Player of the Month — Febrero 2009","year":2009,"team":"LAL"},{"tipo":"All NBA","detalle":"All NBA 3rd Team","year":2009,"team":"LAL"},{"tipo":"All Star","detalle":"All Star Oeste + Shooting Challenge","year":2010,"team":"LAL"},{"tipo":"All NBA","detalle":"All NBA 3rd Team","year":2010,"team":"LAL"},{"tipo":"All Star","detalle":"All Star Oeste + Shooting Challenge","year":2011,"team":"LAL"},{"tipo":"All NBA","detalle":"All NBA 2nd Team","year":2011,"team":"LAL"},{"tipo":"All Star","detalle":"All Star Este (Titular)","year":2015,"team":"CHI"},{"tipo":"All NBA","detalle":"All NBA 2nd Team","year":2015,"team":"CHI"},{"tipo":"All Star","detalle":"All Star Este","year":2016,"team":"CHI"}],"records":[{"categoria":"Puntos","valor":46,"team":"CHI","rival":"MIL","fecha":"10 ene 2015"},{"categoria":"Puntos","valor":44,"team":"MEM","rival":"SEA","fecha":"28 mar 2006"},{"categoria":"Rebotes","valor":22,"team":"LAL","rival":"CHA","fecha":"29 mar 2010"},{"categoria":"Rebotes","valor":22,"team":"LAL","rival":"MIL","fecha":"16 dic 2009"},{"categoria":"Asistencias","valor":9,"team":"MEM","rival":"DAL","fecha":"7 feb 2007"},{"categoria":"Tapones","valor":9,"team":"CHI","rival":"DEN","fecha":"1 ene 2015"},{"categoria":"Minutos","valor":"56:13","team":"MEM","rival":"DET","fecha":"19 dic 2005"},{"categoria":"Pérdidas","valor":9,"team":"MEM","rival":"DAL","fecha":"7 feb 2007"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"serge-ibaka","nombre":"Serge Ibaka","rank":2,"draft":true,"draft_anio":2008,"draft_pick":24,"draft_equipo":"SEA","nacimiento":1989,"temporadas":14,"partidos":919,"partidos_titular":697,"min_total":25126,"min_g":27.3,"pts_total":11028,"pts_g":12.0,"rbd_total":6513,"rbd_g":7.1,"ast_total":749,"ast_g":0.8,"stl_total":373,"stl_g":0.4,"blk_total":1759,"blk_g":1.9,"tres_total":614,"tres_g":0.7,"tov_total":1187,"pf_total":2480,"fg_pct":0.513,"tres_pct":0.359,"ft_pct":0.757,"equipos_nba":"OKC, ORL, TOR, LAC, MIL","ganancias":141250191,"primer_partido":{"fecha":"30 oct 2009","equipo":"OKC","rival":"DET","min":"2:53","pts":0,"rbd":1,"ast":0},"premios":[{"tipo":"Rising Stars","detalle":"Sophomores","year":2011,"team":"OKC"},{"tipo":"All Star","detalle":"Dunk Contest","year":2011,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 1st Team","year":2012,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 1st Team","year":2013,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 2nd Team","year":2014,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 1st Team","year":2015,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 1st Team","year":2016,"team":"OKC"}],"records":[{"categoria":"Tapones","valor":11,"team":"OKC","rival":"DEN","fecha":"19 feb 2012"},{"categoria":"Tapones","valor":10,"team":"OKC","rival":"DAL","fecha":"1 feb 2012"},{"categoria":"Rebotes","valor":22,"team":"OKC","rival":"DAL","fecha":"19 feb 2015"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"jose-m-calderon","nombre":"José M. Calderón","rank":3,"draft":false,"draft_anio":null,"draft_pick":null,"draft_equipo":null,"nacimiento":1981,"temporadas":14,"partidos":895,"partidos_titular":591,"min_total":23643,"min_g":26.4,"pts_total":7921,"pts_g":8.9,"rbd_total":2148,"rbd_g":2.4,"ast_total":5148,"ast_g":5.8,"stl_total":716,"stl_g":0.8,"blk_total":71,"blk_g":0.1,"tres_total":920,"tres_g":1.0,"tov_total":1339,"pf_total":1476,"fg_pct":0.472,"tres_pct":0.407,"ft_pct":0.873,"equipos_nba":"TOR, DET, DAL, NYK, LAL, CLE, ATL","ganancias":84201469,"primer_partido":{"fecha":"2 nov 2005","equipo":"TOR","rival":"WAS","min":"16:43","pts":5,"rbd":1,"ast":3},"premios":[],"records":[{"categoria":"Asistencias","valor":19,"team":"TOR","rival":"CHI","fecha":"29 mar 2009"},{"categoria":"Asistencias","valor":19,"team":"TOR","rival":"MIN","fecha":"24 feb 2011"},{"categoria":"Minutos","valor":"53:55","team":"TOR","rival":"POR","fecha":"13 ene 2008"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"marc-gasol","nombre":"Marc Gasol","rank":4,"draft":true,"draft_anio":2007,"draft_pick":48,"draft_equipo":"LAL","nacimiento":1985,"temporadas":14,"partidos":891,"partidos_titular":866,"min_total":28719,"min_g":32.2,"pts_total":12514,"pts_g":14.0,"rbd_total":6604,"rbd_g":7.4,"ast_total":2996,"ast_g":3.4,"stl_total":792,"stl_g":0.9,"blk_total":1254,"blk_g":1.4,"tres_total":431,"tres_g":0.5,"tov_total":1755,"pf_total":2551,"fg_pct":0.481,"tres_pct":0.36,"ft_pct":0.776,"equipos_nba":"MEM, TOR, LAL","ganancias":181665456,"primer_partido":{"fecha":"29 oct 2008","equipo":"MEM","rival":"HOU","min":"36:24","pts":12,"rbd":12,"ast":1},"premios":[{"tipo":"Rising Stars","detalle":"Novatos","year":2009,"team":"MEM"},{"tipo":"All Rookie","detalle":"All Rookie 2nd Team","year":2009,"team":"MEM"},{"tipo":"Rising Stars","detalle":"Sophomores","year":2010,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste","year":2012,"team":"MEM"},{"tipo":"DPOY","detalle":"Defensive Player of the Year","year":2013,"team":"MEM"},{"tipo":"All NBA","detalle":"All NBA 2nd Team","year":2013,"team":"MEM"},{"tipo":"All Defense","detalle":"All Defense 2nd Team","year":2013,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste (Titular)","year":2015,"team":"MEM"},{"tipo":"All NBA","detalle":"All NBA 1st Team","year":2015,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste","year":2017,"team":"MEM"}],"records":[{"categoria":"Puntos","valor":42,"team":"MEM","rival":"TOR","fecha":"25 ene 2017"},{"categoria":"Rebotes","valor":16,"team":"MEM","rival":"NOL","fecha":"1 dic 2015"},{"categoria":"Minutos","valor":"50:35","team":"MEM","rival":"MIA","fecha":"19 feb 2010"},{"categoria":"Tapones","valor":8,"team":"MEM","rival":"POR","fecha":"4 ene 2013"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"ricky-rubio","nombre":"Ricky Rubio","rank":5,"draft":true,"draft_anio":2009,"draft_pick":5,"draft_equipo":"MIN","nacimiento":1990,"temporadas":13,"partidos":698,"partidos_titular":603,"min_total":20694,"min_g":29.6,"pts_total":7570,"pts_g":10.9,"rbd_total":2830,"rbd_g":4.1,"ast_total":5160,"ast_g":7.4,"stl_total":1226,"stl_g":1.8,"blk_total":94,"blk_g":0.1,"tres_total":637,"tres_g":0.9,"tov_total":1768,"pf_total":1738,"fg_pct":0.388,"tres_pct":0.324,"ft_pct":0.843,"equipos_nba":"MIN, UTA, PHX, CLE","ganancias":131001894,"primer_partido":{"fecha":"26 dic 2011","equipo":"MIN","rival":"OKC","min":"26:18","pts":6,"rbd":5,"ast":6},"premios":[{"tipo":"ROM","detalle":"Rookie of the Month — Enero 2012","year":2012,"team":"MIN"},{"tipo":"Rising Stars","detalle":"Rookies","year":2012,"team":"MIN"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2012,"team":"MIN"},{"tipo":"Rising Stars","detalle":"Sophomores","year":2013,"team":"MIN"}],"records":[{"categoria":"Asistencias","valor":19,"team":"MIN","rival":"WAS","fecha":"13 mar 2017"},{"categoria":"Robos","valor":8,"team":"MIN","rival":"MIL","fecha":"3 abr 2013"},{"categoria":"Robos","valor":8,"team":"MIN","rival":"NYK","fecha":"16 dic 2015"},{"categoria":"Triples","valor":8,"team":"CLE","rival":"NYK","fecha":"7 nov 2021"},{"categoria":"Minutos","valor":"49:09","team":"MIN","rival":"DAL","fecha":"19 mar 2014"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"santi-aldama","nombre":"Santi Aldama","rank":6,"draft":true,"draft_anio":2021,"draft_pick":30,"draft_equipo":"UTA","nacimiento":2001,"temporadas":4,"partidos":278,"partidos_titular":82,"min_total":6518,"min_g":23.5,"pts_total":2895,"pts_g":10.4,"rbd_total":1513,"rbd_g":5.4,"ast_total":570,"ast_g":2.1,"stl_total":183,"stl_g":0.7,"blk_total":172,"blk_g":0.6,"tres_total":396,"tres_g":1.4,"tov_total":271,"pf_total":413,"fg_pct":0.463,"tres_pct":0.346,"ft_pct":0.686,"equipos_nba":"MEM","ganancias":62743371,"primer_partido":{"fecha":"27 oct 2021","equipo":"MEM","rival":"POR","min":"5:34","pts":7,"rbd":2,"ast":0},"premios":[],"records":[{"categoria":"Puntos","valor":37,"team":"MEM","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"nikola-mirotic","nombre":"Nikola Mirotic","rank":7,"draft":true,"draft_anio":2011,"draft_pick":23,"draft_equipo":"HOU","nacimiento":1991,"temporadas":5,"partidos":319,"partidos_titular":95,"min_total":7718,"min_g":24.2,"pts_total":3910,"pts_g":12.3,"rbd_total":1894,"rbd_g":5.9,"ast_total":407,"ast_g":1.3,"stl_total":240,"stl_g":0.8,"blk_total":228,"blk_g":0.7,"tres_total":614,"tres_g":1.9,"tov_total":381,"pf_total":666,"fg_pct":0.423,"tres_pct":0.359,"ft_pct":0.808,"equipos_nba":"CHI, NOL, MIL","ganancias":41631175,"primer_partido":{"fecha":"29 oct 2014","equipo":"CHI","rival":"NYK","min":"15:17","pts":5,"rbd":7,"ast":1},"premios":[{"tipo":"ROM","detalle":"Rookie of the Month — Diciembre 2014","year":2015,"team":"CHI"},{"tipo":"ROM","detalle":"Rookie of the Month — Marzo 2015","year":2015,"team":"CHI"},{"tipo":"Rising Stars","detalle":"Rookies","year":2015,"team":"CHI"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2015,"team":"CHI"},{"tipo":"Rising Stars","detalle":"Sophomores (lesionado)","year":2016,"team":"CHI"}],"records":[{"categoria":"Triples","valor":9,"team":"CHI","rival":"NYK","fecha":"23 mar 2016"},{"categoria":"Triples","valor":8,"team":"CHI","rival":"IND","fecha":"29 dic 2017"},{"categoria":"Puntos","valor":36,"team":"NOL","rival":"SAC","fecha":"19 oct 2018"},{"categoria":"Minutos","valor":"49:00","team":"NOL","rival":"BRK","fecha":"10 feb 2018"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"juancho-hernangomez","nombre":"Juancho Hernangómez","rank":8,"draft":true,"draft_anio":2016,"draft_pick":15,"draft_equipo":"DEN","nacimiento":1995,"temporadas":7,"partidos":339,"partidos_titular":76,"min_total":5269,"min_g":15.5,"pts_total":1711,"pts_g":5.1,"rbd_total":1131,"rbd_g":3.3,"ast_total":216,"ast_g":0.6,"stl_total":131,"stl_g":0.4,"blk_total":71,"blk_g":0.2,"tres_total":266,"tres_g":0.8,"tov_total":167,"pf_total":365,"fg_pct":0.428,"tres_pct":0.342,"ft_pct":0.676,"equipos_nba":"DEN, MIN, BOS, UTA, SAS, TOR","ganancias":24938681,"primer_partido":{"fecha":"26 oct 2016","equipo":"DEN","rival":"NOL","min":"0:39","pts":0,"rbd":0,"ast":0},"premios":[],"records":[{"categoria":"Puntos","valor":27,"team":"MIN","rival":"—","fecha":"Temporada burbuja 2020"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"rudy-fernandez","nombre":"Rudy Fernández","rank":9,"draft":true,"draft_anio":2007,"draft_pick":24,"draft_equipo":"PHX","nacimiento":1985,"temporadas":5,"partidos":249,"partidos_titular":10,"min_total":5965,"min_g":24.0,"pts_total":2254,"pts_g":9.1,"rbd_total":608,"rbd_g":2.4,"ast_total":554,"ast_g":2.2,"stl_total":249,"stl_g":1.0,"blk_total":40,"blk_g":0.2,"tres_total":413,"tres_g":1.7,"tov_total":286,"pf_total":369,"fg_pct":0.399,"tres_pct":0.36,"ft_pct":0.84,"equipos_nba":"POR, DEN","ganancias":5676523,"primer_partido":{"fecha":"28 oct 2008","equipo":"POR","rival":"LAL","min":"29:03","pts":16,"rbd":2,"ast":4},"premios":[{"tipo":"Rising Stars","detalle":"Novatos","year":2009,"team":"POR"},{"tipo":"All Rookie","detalle":"All Rookie 2nd Team","year":2009,"team":"POR"},{"tipo":"All Star","detalle":"Dunk Contest","year":2009,"team":"POR"}],"records":[{"categoria":"Puntos","valor":26,"team":"POR","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"sergio-rodriguez","nombre":"Sergio Rodríguez","rank":10,"draft":true,"draft_anio":2006,"draft_pick":27,"draft_equipo":"PHX","nacimiento":1986,"temporadas":5,"partidos":353,"partidos_titular":52,"min_total":5281,"min_g":15.0,"pts_total":1747,"pts_g":5.0,"rbd_total":525,"rbd_g":1.5,"ast_total":1183,"ast_g":3.4,"stl_total":212,"stl_g":0.6,"blk_total":13,"blk_g":0.0,"tres_total":202,"tres_g":0.6,"tov_total":481,"pf_total":441,"fg_pct":0.409,"tres_pct":0.337,"ft_pct":0.739,"equipos_nba":"POR, SAC, NYK, PHI","ganancias":11469835,"primer_partido":{"fecha":"3 nov 2006","equipo":"POR","rival":"GSW","min":"2:09","pts":2,"rbd":1,"ast":0},"premios":[],"records":[{"categoria":"Robos","valor":8,"team":"NYK","rival":"MIL","fecha":"22 feb 2010"},{"categoria":"Asistencias","valor":24,"team":"NYK","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"willy-hernangomez","nombre":"Willy Hernangómez","rank":11,"draft":true,"draft_anio":2015,"draft_pick":35,"draft_equipo":"PHI","nacimiento":1994,"temporadas":7,"partidos":344,"partidos_titular":48,"min_total":5149,"min_g":15.0,"pts_total":2524,"pts_g":7.3,"rbd_total":1982,"rbd_g":5.8,"ast_total":364,"ast_g":1.1,"stl_total":145,"stl_g":0.4,"blk_total":134,"blk_g":0.4,"tres_total":37,"tres_g":0.1,"tov_total":347,"pf_total":573,"fg_pct":0.533,"tres_pct":0.306,"ft_pct":0.713,"equipos_nba":"NYK, CHA, NOL","ganancias":12435586,"primer_partido":{"fecha":"26 oct 2016","equipo":"NYK","rival":"CLE","min":"9:26","pts":4,"rbd":1,"ast":0},"premios":[{"tipo":"ROM","detalle":"Rookie of the Month — Abril 2017","year":2017,"team":"NYK"},{"tipo":"Rising Stars","detalle":"Rookies","year":2017,"team":"NYK"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2017,"team":"NYK"}],"records":[{"categoria":"Puntos","valor":29,"team":"NOL","rival":"—","fecha":"Pendiente"},{"categoria":"Rebotes","valor":17,"team":"NOL","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"alex-abrines","nombre":"Alex Abrines","rank":12,"draft":true,"draft_anio":2013,"draft_pick":32,"draft_equipo":"OKC","nacimiento":1993,"temporadas":3,"partidos":174,"partidos_titular":16,"min_total":2777,"min_g":16.0,"pts_total":924,"pts_g":5.3,"rbd_total":248,"rbd_g":1.4,"ast_total":88,"ast_g":0.5,"stl_total":92,"stl_g":0.5,"blk_total":22,"blk_g":0.1,"tres_total":219,"tres_g":1.3,"tov_total":72,"pf_total":291,"fg_pct":0.387,"tres_pct":0.368,"ft_pct":0.88,"equipos_nba":"OKC","ganancias":15294947,"primer_partido":{"fecha":"26 oct 2016","equipo":"OKC","rival":"PHI","min":"13:24","pts":3,"rbd":1,"ast":0},"premios":[{"tipo":"Rising Stars","detalle":"Rookies","year":2017,"team":"OKC"}],"records":[{"categoria":"Triples","valor":7,"team":"OKC","rival":"ATL","fecha":"30 nov 2018"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"raul-lopez","nombre":"Raül Lopez","rank":13,"draft":true,"draft_anio":2001,"draft_pick":24,"draft_equipo":"UTA","nacimiento":1980,"temporadas":2,"partidos":113,"partidos_titular":26,"min_total":2135,"min_g":18.9,"pts_total":733,"pts_g":6.5,"rbd_total":194,"rbd_g":1.7,"ast_total":428,"ast_g":3.8,"stl_total":84,"stl_g":0.7,"blk_total":5,"blk_g":0.0,"tres_total":45,"tres_g":0.4,"tov_total":221,"pf_total":278,"fg_pct":0.429,"tres_pct":0.346,"ft_pct":0.853,"equipos_nba":"UTA","ganancias":3941313,"primer_partido":{"fecha":"29 oct 2003","equipo":"UTA","rival":"POR","min":"6:17","pts":0,"rbd":1,"ast":3},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"usman-garuba","nombre":"Usman Garuba","rank":14,"draft":true,"draft_anio":2021,"draft_pick":23,"draft_equipo":"HOU","nacimiento":2002,"temporadas":3,"partidos":99,"partidos_titular":3,"min_total":1209,"min_g":12.2,"pts_total":225,"pts_g":2.3,"rbd_total":390,"rbd_g":3.9,"ast_total":81,"ast_g":0.8,"stl_total":54,"stl_g":0.5,"blk_total":40,"blk_g":0.4,"tres_total":29,"tres_g":0.3,"tov_total":53,"pf_total":163,"fg_pct":0.475,"tres_pct":0.367,"ft_pct":0.617,"equipos_nba":"HOU, GSW","ganancias":7424488,"primer_partido":{"fecha":"20 oct 2021","equipo":"HOU","rival":"MIN","min":"8:22","pts":4,"rbd":2,"ast":1},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"juan-carlos-navarro","nombre":"Juan Carlos Navarro","rank":15,"draft":true,"draft_anio":2002,"draft_pick":40,"draft_equipo":"WAS","nacimiento":1980,"temporadas":1,"partidos":82,"partidos_titular":30,"min_total":2117,"min_g":25.8,"pts_total":896,"pts_g":10.9,"rbd_total":210,"rbd_g":2.6,"ast_total":177,"ast_g":2.2,"stl_total":48,"stl_g":0.6,"blk_total":1,"blk_g":0.0,"tres_total":156,"tres_g":1.9,"tov_total":134,"pf_total":94,"fg_pct":0.402,"tres_pct":0.361,"ft_pct":0.849,"equipos_nba":"MEM","ganancias":538090,"primer_partido":{"fecha":"31 oct 2007","equipo":"MEM","rival":"SAS","min":"16:51","pts":9,"rbd":0,"ast":2},"premios":[{"tipo":"Rising Stars","detalle":"Novatos","year":2008,"team":"MEM"},{"tipo":"All Rookie","detalle":"All Rookie 2nd Team","year":2008,"team":"MEM"}],"records":[{"categoria":"Triples","valor":8,"team":"MEM","rival":"NOL","fecha":"16 nov 2007"},{"categoria":"Minutos","valor":"46:32","team":"MEM","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"victor-claver","nombre":"Víctor Claver","rank":16,"draft":true,"draft_anio":2009,"draft_pick":22,"draft_equipo":"POR","nacimiento":1988,"temporadas":3,"partidos":80,"partidos_titular":16,"min_total":1072,"min_g":13.4,"pts_total":258,"pts_g":3.2,"rbd_total":178,"rbd_g":2.2,"ast_total":56,"ast_g":0.7,"stl_total":30,"stl_g":0.4,"blk_total":16,"blk_g":0.2,"tres_total":34,"tres_g":0.4,"tov_total":58,"pf_total":103,"fg_pct":0.398,"tres_pct":0.293,"ft_pct":0.585,"equipos_nba":"POR","ganancias":4000000,"primer_partido":{"fecha":"3 nov 2012","equipo":"POR","rival":"HOU","min":"3:33","pts":0,"rbd":1,"ast":0},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"jorge-garbajosa","nombre":"Jorge Garbajosa","rank":17,"draft":false,"draft_anio":null,"draft_pick":null,"draft_equipo":null,"nacimiento":1977,"temporadas":2,"partidos":74,"partidos_titular":60,"min_total":1983,"min_g":26.8,"pts_total":589,"pts_g":8.0,"rbd_total":345,"rbd_g":4.7,"ast_total":128,"ast_g":1.7,"stl_total":81,"stl_g":1.1,"blk_total":15,"blk_g":0.2,"tres_total":72,"tres_g":1.0,"tov_total":65,"pf_total":92,"fg_pct":0.415,"tres_pct":0.345,"ft_pct":0.731,"equipos_nba":"TOR","ganancias":12120000,"primer_partido":{"fecha":"1 nov 2006","equipo":"TOR","rival":"BRK","min":"20:33","pts":2,"rbd":5,"ast":2},"premios":[{"tipo":"ROM","detalle":"Rookie of the Month — Diciembre 2006","year":2007,"team":"TOR"},{"tipo":"Rising Stars","detalle":"Novatos","year":2007,"team":"TOR"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2007,"team":"TOR"}],"records":[{"categoria":"Puntos","valor":22,"team":"TOR","rival":"—","fecha":"Pendiente"},{"categoria":"Minutos","valor":"43:22","team":"TOR","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"hugo-gonzalez","nombre":"Hugo González","rank":18,"draft":true,"draft_anio":2025,"draft_pick":28,"draft_equipo":"BOS","nacimiento":2005,"temporadas":1,"partidos":63,"partidos_titular":3,"min_total":970,"min_g":15.4,"pts_total":258,"pts_g":4.1,"rbd_total":218,"rbd_g":3.5,"ast_total":37,"ast_g":0.6,"stl_total":38,"stl_g":0.6,"blk_total":20,"blk_g":0.3,"tres_total":35,"tres_g":0.6,"tov_total":34,"pf_total":111,"fg_pct":0.473,"tres_pct":0.337,"ft_pct":0.5,"equipos_nba":"BOS","ganancias":14289145,"primer_partido":{"fecha":"24 oct 2025","equipo":"BOS","rival":"NYK","min":"—","pts":null,"rbd":null,"ast":null},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[]},{"id":"fernando-martin","nombre":"Fernando Martín","rank":19,"draft":true,"draft_anio":1985,"draft_pick":38,"draft_equipo":"BRK","nacimiento":null,"temporadas":1,"partidos":24,"partidos_titular":0,"min_total":146,"min_g":6.1,"pts_total":22,"pts_g":0.9,"rbd_total":28,"rbd_g":1.2,"ast_total":9,"ast_g":0.4,"stl_total":7,"stl_g":0.3,"blk_total":1,"blk_g":0.0,"tres_total":0,"tres_g":0.0,"tov_total":20,"pf_total":24,"fg_pct":0.29,"tres_pct":null,"ft_pct":0.364,"equipos_nba":"POR","ganancias":145000,"primer_partido":{"fecha":"31 oct 1986","equipo":"POR","rival":"SEA","min":"2","pts":0,"rbd":0,"ast":0},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[]}]};
