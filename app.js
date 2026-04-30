// ══════════════════════════════════════════════
// CONFIGURACIÓN
// ══════════════════════════════════════════════
const LOCAL_URL = './data.json';
const CDN_URL = 'https://cdn.jsdelivr.net/gh/alejandroggo/espanoles-nba@main/data.json';
const BASE_SHEET = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRcnveDICJslZxp9dr116TsvDjcoDdf7LOgIwjKinRd5FixvhRnc-mQ4XfKgXASkxaiI8z4BStm6yD/pub?single=true&output=csv&gid=';
const SHEET_URL             = BASE_SHEET + '705791197';  // game highs
const PREMIOS_SHEET_URL     = BASE_SHEET + '580852671';
const TRANS_SHEET_URL       = BASE_SHEET + '1484756964';
const SL_SHEET_URL          = BASE_SHEET + '161265150';
const TEMPORADAS_SHEET_URL  = BASE_SHEET + '107120245';
const TRAYECTORIA_SHEET_URL = BASE_SHEET + '1400531043';

const STAT_LABELS = {
  PTS: 'Puntos',  RBD: 'Rebotes',  AST: 'Asistencias',
  STL: 'Robos',   BLK: 'Tapones',  MIN: 'Minutos',
  FGM: 'Canastas de campo', FGA: 'Intentos de campo',
  '3PM': 'Triples', '3PA': 'Intentos de triple',
  FTM: 'Tiros libres', FTA: 'Intentos de tiro libre',
  TOV: 'Pérdidas', PF: 'Faltas'
};

// ══════════════════════════════════════════════
// MODOS DE VISTA
// ══════════════════════════════════════════════
const MODES = {
  per_game: {
    defaultSort: 'pts_g',
    chips: [
      {label:'PPG', col:'pts_g'}, {label:'RPG', col:'rbd_g'}, {label:'APG', col:'ast_g'},
      {label:'Partidos', col:'partidos'}, {label:'$', col:'ganancias'}, {label:'Seas', col:'temporadas'},
    ],
    head: [
      {label:'PJ', col:'partidos'}, {label:'PPG', col:'pts_g'}, {label:'RPG', col:'rbd_g'},
      {label:'APG', col:'ast_g'}, {label:'FG%', col:'fg_pct'}, {label:'3P%', col:'tres_pct'},
      {label:'FT%', col:'ft_pct'}, {label:'BPG', col:'blk_g'}, {label:'SPG', col:'stl_g'},
      {label:'SEAS', col:'temporadas'}, {label:'$', col:'ganancias'},
    ],
    cells: (j, sc) => `
      <td class="${sc==='partidos'?'highlight':''}">${fmt(j.partidos)}</td>
      <td class="${sc==='pts_g'?'highlight':''}">${fmtDec(j.pts_g)}</td>
      <td class="${sc==='rbd_g'?'highlight':''}">${fmtDec(j.rbd_g)}</td>
      <td class="${sc==='ast_g'?'highlight':''}">${fmtDec(j.ast_g)}</td>
      <td>${fmtPct(j.fg_pct)}</td><td>${fmtPct(j.tres_pct)}</td><td>${fmtPct(j.ft_pct)}</td>
      <td>${fmtDec(j.blk_g)}</td><td>${fmtDec(j.stl_g)}</td>
      <td class="${sc==='temporadas'?'highlight':''}">${fmt(j.temporadas)}</td>
      <td class="${sc==='ganancias'?'dorado':''}">${fmtMoney(j.ganancias)}</td>`,
  },
  totals: {
    defaultSort: 'pts_total',
    chips: [
      {label:'PTS', col:'pts_total'}, {label:'RBD', col:'rbd_total'}, {label:'AST', col:'ast_total'},
      {label:'Partidos', col:'partidos'}, {label:'$', col:'ganancias'},
    ],
    head: [
      {label:'PJ', col:'partidos'}, {label:'PTS', col:'pts_total'}, {label:'RBD', col:'rbd_total'},
      {label:'AST', col:'ast_total'}, {label:'STL', col:'stl_total'}, {label:'BLK', col:'blk_total'},
      {label:'3PM', col:'tres_total'}, {label:'MIN', col:'min_total'}, {label:'TOV', col:'tov_total'},
      {label:'$', col:'ganancias'},
    ],
    cells: (j, sc) => `
      <td class="${sc==='partidos'?'highlight':''}">${fmt(j.partidos)}</td>
      <td class="${sc==='pts_total'?'highlight':''}">${fmt(j.pts_total)}</td>
      <td class="${sc==='rbd_total'?'highlight':''}">${fmt(j.rbd_total)}</td>
      <td class="${sc==='ast_total'?'highlight':''}">${fmt(j.ast_total)}</td>
      <td>${fmt(j.stl_total)}</td><td>${fmt(j.blk_total)}</td>
      <td>${fmt(j.tres_total)}</td><td>${fmt(j.min_total)}</td><td>${fmt(j.tov_total)}</td>
      <td class="${sc==='ganancias'?'dorado':''}">${fmtMoney(j.ganancias)}</td>`,
  },
  playoffs_pg: {
    defaultSort: 'po_g',
    chips: [
      {label:'PPG', col:'po_pts_g'}, {label:'RPG', col:'po_rbd_g'}, {label:'APG', col:'po_ast_g'},
      {label:'PJ-PO', col:'po_g'},
    ],
    head: [
      {label:'PJ-PO', col:'po_g'}, {label:'PPG', col:'po_pts_g'}, {label:'RPG', col:'po_rbd_g'},
      {label:'APG', col:'po_ast_g'}, {label:'FG%', col:'po_fg_pct'}, {label:'SEAS-PO', col:'po_seasons'},
    ],
    cells: (j, sc) => `
      <td class="${sc==='po_g'?'highlight':''}">${fmt(j.po_g)}</td>
      <td class="${sc==='po_pts_g'?'highlight':''}">${fmtDec(j.po_pts_g)}</td>
      <td class="${sc==='po_rbd_g'?'highlight':''}">${fmtDec(j.po_rbd_g)}</td>
      <td class="${sc==='po_ast_g'?'highlight':''}">${fmtDec(j.po_ast_g)}</td>
      <td>${fmtPct(j.po_fg_pct)}</td><td>${fmt(j.po_seasons)}</td>`,
  },
  playoffs_totals: {
    defaultSort: 'po_g',
    chips: [
      {label:'PTS', col:'po_pts_total'}, {label:'RBD', col:'po_rbd_total'}, {label:'AST', col:'po_ast_total'},
      {label:'PJ-PO', col:'po_g'},
    ],
    head: [
      {label:'PJ-PO', col:'po_g'}, {label:'PTS', col:'po_pts_total'}, {label:'RBD', col:'po_rbd_total'},
      {label:'AST', col:'po_ast_total'}, {label:'FG%', col:'po_fg_pct'}, {label:'SEAS-PO', col:'po_seasons'},
    ],
    cells: (j, sc) => `
      <td class="${sc==='po_g'?'highlight':''}">${fmt(j.po_g)}</td>
      <td class="${sc==='po_pts_total'?'highlight':''}">${fmt(j.po_pts_total)}</td>
      <td class="${sc==='po_rbd_total'?'highlight':''}">${fmt(j.po_rbd_total)}</td>
      <td class="${sc==='po_ast_total'?'highlight':''}">${fmt(j.po_ast_total)}</td>
      <td>${fmtPct(j.po_fg_pct)}</td><td>${fmt(j.po_seasons)}</td>`,
  },
  season_highs: {
    defaultSort: 'sh_pts_g',
    chips: [
      {label:'PPG', col:'sh_pts_g'}, {label:'RPG', col:'sh_rbd_g'}, {label:'APG', col:'sh_ast_g'},
      {label:'MIN', col:'sh_min_g'},
    ],
    head: [
      {label:'PPG', col:'sh_pts_g'}, {label:'RPG', col:'sh_rbd_g'}, {label:'APG', col:'sh_ast_g'},
      {label:'FG%', col:'sh_fg_pct'}, {label:'3P%', col:'sh_tres_pct'}, {label:'FT%', col:'sh_ft_pct'},
      {label:'SPG', col:'sh_stl_g'}, {label:'BPG', col:'sh_blk_g'},
    ],
    cells: (j, sc) => `
      <td class="${sc==='sh_pts_g'?'highlight':''}">${fmtDec(j.sh_pts_g)}</td>
      <td class="${sc==='sh_rbd_g'?'highlight':''}">${fmtDec(j.sh_rbd_g)}</td>
      <td class="${sc==='sh_ast_g'?'highlight':''}">${fmtDec(j.sh_ast_g)}</td>
      <td>${fmtPct(j.sh_fg_pct)}</td><td>${fmtPct(j.sh_tres_pct)}</td><td>${fmtPct(j.sh_ft_pct)}</td>
      <td>${fmtDec(j.sh_stl_g)}</td><td>${fmtDec(j.sh_blk_g)}</td>`,
  },
  playoffs_sh: {
    defaultSort: 'po_sh_pts_g',
    chips: [
      {label:'PPG', col:'po_sh_pts_g'}, {label:'RPG', col:'po_sh_rbd_g'}, {label:'APG', col:'po_sh_ast_g'},
    ],
    head: [
      {label:'PPG', col:'po_sh_pts_g'}, {label:'RPG', col:'po_sh_rbd_g'}, {label:'APG', col:'po_sh_ast_g'},
      {label:'FG%', col:'po_sh_fg_pct'},
    ],
    cells: (j, sc) => `
      <td class="${sc==='po_sh_pts_g'?'highlight':''}">${fmtDec(j.po_sh_pts_g)}</td>
      <td class="${sc==='po_sh_rbd_g'?'highlight':''}">${fmtDec(j.po_sh_rbd_g)}</td>
      <td class="${sc==='po_sh_ast_g'?'highlight':''}">${fmtDec(j.po_sh_ast_g)}</td>
      <td>${fmtPct(j.po_sh_fg_pct)}</td>`,
  },
};

// ══════════════════════════════════════════════
// ESTADO
// ══════════════════════════════════════════════
let DATA = null;
let SL_ALL = null;
let viewMode = 'per_game';
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

  // fusionar desde sheets (fallos silenciosos)
  await fetchSheetData();

  hideLoader();
  renderHeroKpis();
  renderTabla();
  handleHash();
}

async function fetchSheetData() {
  await Promise.allSettled([
    fetch(PREMIOS_SHEET_URL).then(r => r.ok && r.text()).then(csv => csv && mergePremiosFromSheet(parsePremiosCsv(csv))).catch(()=>{}),
    fetch(TRANS_SHEET_URL).then(r => r.ok && r.text()).then(csv => csv && mergeTransaccionesFromSheet(parseSheetCsv(csv, {
      jugador: 'jugador|player',
      fecha:   '~^fecha$|~^date$',
      tipo:    '^transaccion$|^tipo$|^type$',
      de:      '^equipo$|^equipo 1$|^de$|origen|from',
      a:       '^equipo 2$|^a$|destino|to',
      detalle: 'otros|involucrados|detalle|descripcion',
    }))).catch(()=>{}),
    fetch(SL_SHEET_URL).then(r => r.ok && r.text()).then(csv => csv && mergeSummerLeagueFromSheet(parseSheetCsv(csv, {jugador:'jugador|player', year:'^ano$|^year$|^temporada$', equipo:'equipo|team'}))).catch(()=>{}),
    fetch(TEMPORADAS_SHEET_URL).then(r => r.ok && r.text()).then(csv => csv && mergeTemporadasFromSheet(parseSheetCsv(csv, {
      jugador:   'jugador|player',
      year:      '^year$|temporada|^ano$',
      team:      '^team$|^equipo$',
      age:       '^age$|^edad$',
      g:         '^g$|^pj$|^gp$',
      gs:        '^gs$',
      min_total: '^min$',
      min_g:     '^m/g$|^mpg$|^min/g$',
      pts_total: '^pts$',
      pts_g:     '^pts/g$|^ppg$',
      rbd_total: '^rbd$|^reb$|^trb$',
      rbd_g:     '^rbd/g$|^rpg$|^reb/g$',
      ast_total: '^ast$',
      ast_g:     '^ast/g$|^apg$',
      stl_total: '^stl$',
      stl_g:     '^stl/g$|^spg$',
      blk_total: '^blk$|^tap$',
      blk_g:     '^blk/g$|^bpg$|^tap/g$',
      fg_pct:    '^fg%$|^tc%$',
      tres_pct:  '^3p%$|^t3%$',
      ft_pct:    '^ft%$|^tl%$',
      tov:       '^tov$|^to$',
    }))).catch(()=>{}),
    fetch(TRAYECTORIA_SHEET_URL).then(r => r.ok && r.text()).then(csv => csv && mergeTrayectoriaFromSheet(csv)).catch(()=>{}),
  ]);
}

async function recargarDatos() {
  const btn = document.getElementById('btn-recargar');
  if (btn) { btn.disabled = true; btn.textContent = 'Actualizando…'; }
  // reset sheet data on jugadores
  DATA.jugadores.forEach(j => {
    j.transacciones = []; j.temporadas_data = []; j.summer_league = [];
    j.cantera = null; j.pre_nba = null; j.post_nba = [];
  });
  SL_ALL = null;
  await fetchSheetData();
  renderTabla();
  // re-render vista activa si es una de las de sheet
  const activeView = document.querySelector('.view.active');
  if (activeView) {
    if (activeView.id === 'view-transacciones') renderTransacciones();
    if (activeView.id === 'view-summer-league') renderSummerLeague();
    if (activeView.id === 'view-premios') renderPremios();
    if (activeView.id === 'view-jugador') {
      const hash = location.hash.slice(1);
      const j = DATA.jugadores.find(x => x.id === hash);
      if (j) showJugador(j);
    }
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Recargar datos'; }
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
    if (hash === 'transacciones') { renderTransacciones(); showView('transacciones'); return; }
    if (hash === 'summer-league') { renderSummerLeague(); showView('summer-league'); return; }
    if (hash === 'premios') { renderPremios(); showView('premios'); return; }
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

function showTransacciones() {
  history.pushState('', '', location.pathname + '#transacciones');
  renderTransacciones();
  showView('transacciones');
}

function showSummerLeague() {
  history.pushState('', '', location.pathname + '#summer-league');
  renderSummerLeague();
  showView('summer-league');
}

function showPremios() {
  history.pushState('', '', location.pathname + '#premios');
  renderPremios();
  showView('premios');
}

const ORDEN_PREMIOS = ['ROY','MVP','DPOY','All NBA','All Star','All Rookie','All Defense','Rising Stars','POM','ROM'];

function renderPremios() {
  const all = [];
  DATA.jugadores.forEach(j => {
    (j.premios || []).forEach(p => all.push({ ...p, jugador: j.nombre, jugador_id: j.id }));
  });
  all.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    const ia = ORDEN_PREMIOS.indexOf(a.tipo), ib = ORDEN_PREMIOS.indexOf(b.tipo);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  // poblar filtros si es la primera vez
  const tipoEl = document.getElementById('premios-tipo-filter');
  const yearEl = document.getElementById('premios-year-filter');
  if (tipoEl && !tipoEl.dataset.built) {
    const tipos = [...new Set(all.map(p => p.tipo))].sort((a, b) => {
      const ia = ORDEN_PREMIOS.indexOf(a), ib = ORDEN_PREMIOS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    tipos.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; tipoEl.appendChild(o); });
    tipoEl.dataset.built = '1';
    tipoEl.onchange = renderPremios;
  }
  if (yearEl && !yearEl.dataset.built) {
    const years = [...new Set(all.map(p => p.year))].sort((a, b) => b - a);
    years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearEl.appendChild(o); });
    yearEl.dataset.built = '1';
    yearEl.onchange = renderPremios;
  }

  const tipo = tipoEl ? tipoEl.value : '';
  const year = yearEl ? yearEl.value : '';
  const rows = all.filter(p => (!tipo || p.tipo === tipo) && (!year || String(p.year) === year));

  const BIG = ['ROY','MVP','DPOY','All NBA'];
  const tbody = document.getElementById('premios-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">Sin premios</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(p => `
    <tr class="trans-row" onclick="location.hash='${p.jugador_id}'">
      <td>${p.year}</td>
      <td class="nombre">${p.jugador}</td>
      <td><span class="premio-badge${BIG.includes(p.tipo) ? ' premio-badge--big' : ''}">${p.tipo}</span></td>
      <td>${p.detalle || p.tipo}</td>
      <td>${p.team || '—'}</td>
    </tr>`).join('');
}

// ── PARSER GENÉRICO DE SHEETS ─────────────────
// fieldMap: { outKey: 'patron1|patron2|...' }  — busca en cabeceras por orden de preferencia
function parseSheetCsv(csv, fieldMap) {
  const normH = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const rows = csv.split('\n').map(line => {
    const cells = []; let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim()); return cells;
  }).filter(r => r.some(c => c));

  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].map(normH).some(c => c.includes('jugador') || c.includes('player'))) { hi = i; break; }
  }
  if (hi < 0) return null;

  const headers = rows[hi].map(normH);
  const colFor = patterns => {
    for (const pat of patterns.split('|')) {
      const raw = pat.trim();
      const last = raw.startsWith('~');
      const re = new RegExp(last ? raw.slice(1) : raw);
      let i = -1;
      if (last) { for (let k = headers.length - 1; k >= 0; k--) { if (re.test(headers[k])) { i = k; break; } } }
      else i = headers.findIndex(h => re.test(h));
      if (i >= 0) return i;
    }
    return -1;
  };

  const cols = {};
  for (const [key, pat] of Object.entries(fieldMap)) cols[key] = colFor(pat);

  const result = {};
  let lastNombre = '';
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const rawNombre = cols.jugador >= 0 ? r[cols.jugador] : '';
    const nombre = rawNombre || lastNombre;
    if (!nombre) continue;
    if (rawNombre) lastNombre = rawNombre;
    const entry = {};
    for (const [key, idx] of Object.entries(cols)) {
      if (key === 'jugador') continue;
      const raw = idx >= 0 ? r[idx] : null;
      entry[key] = (raw !== null && raw !== '') ? (isNaN(raw) ? raw : Number(raw)) : null;
    }
    if (!result[nombre]) result[nombre] = [];
    result[nombre].push(entry);
  }
  return result;
}

function mergeTransaccionesFromSheet(parsed) {
  if (!parsed) return;
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  DATA.jugadores.forEach(j => {
    const match = Object.keys(parsed).find(k => norm(k) === norm(j.nombre));
    if (match) j.transacciones = parsed[match].filter(t => t.tipo);
  });
}

function mergeSummerLeagueFromSheet(parsed) {
  if (!parsed) return;
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

  // guardar TODAS las entradas del sheet (incluye jugadores no en data.json)
  SL_ALL = [];
  for (const [nombre, entries] of Object.entries(parsed)) {
    const j = DATA.jugadores.find(x => norm(x.nombre) === norm(nombre));
    entries.filter(s => s.year || s.equipo).forEach(s => {
      SL_ALL.push({ ...s, jugador: nombre, jugador_id: j ? j.id : null });
    });
    if (j) j.summer_league = entries.filter(s => s.year || s.equipo);
  }
}

function mergeTemporadasFromSheet(parsed) {
  if (!parsed) return;
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  DATA.jugadores.forEach(j => {
    const match = Object.keys(parsed).find(k => norm(k) === norm(j.nombre));
    if (match) j.temporadas_data = parsed[match].filter(s => s.year);
  });
}

function mergeTrayectoriaFromSheet(csv) {
  const normH = s => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const norm  = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const rows  = csv.split('\n').map(line => {
    const cells = []; let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim()); return cells;
  }).filter(r => r.some(c => c));

  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].map(normH).some(c => c.includes('jugador') || c.includes('player'))) { hi = i; break; }
  }
  if (hi < 0) return;

  const headers = rows[hi].map(normH);
  const col = (...pats) => { for (const p of pats) { const i = headers.findIndex(h => h.includes(p)); if (i>=0) return i; } return -1; };

  const jugadorIdx  = col('jugador','player');
  const canteraIdx  = col('cantera','formacion','academy');
  const preNbaIdx   = col('pre','antes','before');
  // columnas post-NBA: "post", "despues/después", "after", o "equipo" que no sea la de pre-NBA
  const postIdxs = headers.reduce((acc, h, i) => {
    if (i === jugadorIdx || i === canteraIdx || i === preNbaIdx) return acc;
    if (h.includes('post') || h.includes('despues') || h.includes('after') || h.includes('equipo')) acc.push(i);
    return acc;
  }, []);

  rows.slice(hi + 1).forEach(r => {
    const nombre = jugadorIdx >= 0 ? r[jugadorIdx] : '';
    if (!nombre) return;
    const j = DATA.jugadores.find(x => norm(x.nombre) === norm(nombre));
    if (!j) return;
    if (canteraIdx >= 0 && r[canteraIdx]) j.cantera = r[canteraIdx];
    if (preNbaIdx  >= 0 && r[preNbaIdx])  j.pre_nba = r[preNbaIdx];
    // si hay una sola columna con varios equipos separados por coma/punto y coma, los expandimos
    const rawPost = postIdxs.flatMap(i => (r[i]||'').split(/[,;\/\n]+/).map(v => v.trim())).filter(Boolean);
    if (rawPost.length) j.post_nba = rawPost.map(equipo => ({ equipo }));
  });
}

function parsePremiosCsv(csv) {
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const rows = csv.split('\n').map(line => {
    const cells = []; let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim()); return cells;
  }).filter(r => r.some(c => c));

  // buscar fila de cabeceras (la que contenga "jugador" o "player")
  let hi = -1, cols = {};
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = rows[i].map(norm);
    const jIdx = r.findIndex(c => c.includes('jugador') || c.includes('player'));
    if (jIdx >= 0) {
      hi = i; cols.jugador = jIdx;
      cols.year   = r.findIndex(c => c.includes('ano') || c.includes('year') || c.includes('temporada'));
      cols.tipo   = r.findIndex(c => c.includes('tipo') || c.includes('premio') || c.includes('award'));
      cols.detalle= r.findIndex(c => c.includes('detalle') || c.includes('descripcion') || c.includes('detail'));
      cols.team   = r.findIndex(c => c.includes('equipo') || c.includes('team'));
      break;
    }
  }
  if (hi < 0) return null;

  const result = {};
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const nombre = cols.jugador >= 0 ? r[cols.jugador] : '';
    if (!nombre) continue;
    if (!result[nombre]) result[nombre] = [];
    result[nombre].push({
      tipo:   cols.tipo    >= 0 ? r[cols.tipo]                              : '',
      detalle:cols.detalle >= 0 ? r[cols.detalle]                           : '',
      year:   cols.year    >= 0 ? (isNaN(r[cols.year]) ? r[cols.year] : Number(r[cols.year])) : '',
      team:   cols.team    >= 0 ? r[cols.team]                              : '',
    });
  }
  return result;
}

function mergePremiosFromSheet(parsed) {
  if (!parsed) return;
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  DATA.jugadores.forEach(j => {
    const match = Object.keys(parsed).find(k => norm(k) === norm(j.nombre));
    if (match) j.premios = parsed[match].filter(p => p.tipo);
  });
}

function renderSummerLeague() {
  const all = SL_ALL
    ? [...SL_ALL]
    : DATA.jugadores.flatMap(j => (j.summer_league || []).map(s => ({ ...s, jugador: j.nombre, jugador_id: j.id })));
  all.sort((a, b) => (b.year||0) - (a.year||0) || a.jugador.localeCompare(b.jugador));

  // reconstruir filtro de año siempre (por si los datos del sheet llegan tarde)
  const years = [...new Set(all.map(s => s.year).filter(Boolean))].sort((a, b) => b - a);
  const filterEl = document.getElementById('sl-year-filter');
  if (filterEl) {
    const cur = filterEl.value;
    filterEl.innerHTML = '<option value="">Todos los años</option>';
    years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; filterEl.appendChild(o); });
    filterEl.value = cur;
    filterEl.onchange = renderSummerLeague;
  }

  const year   = filterEl ? filterEl.value : '';
  const searchEl = document.getElementById('sl-search');
  const search = searchEl ? searchEl.value.toLowerCase() : '';
  if (searchEl && !searchEl.dataset.built) { searchEl.oninput = renderSummerLeague; searchEl.dataset.built = '1'; }

  const rows = all.filter(s =>
    (!year   || String(s.year) === year) &&
    (!search || s.jugador.toLowerCase().includes(search))
  );

  const tbody = document.getElementById('sl-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-cell">Sin datos de Summer League</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(s => `
    <tr ${s.jugador_id ? `class="trans-row" onclick="location.hash='${s.jugador_id}'"` : ''}>
      <td>${s.year || '—'}</td>
      <td class="nombre">${s.jugador}</td>
      <td>${s.equipo || '—'}</td>
    </tr>`).join('');
}

function renderTransacciones() {
  const all = [];
  DATA.jugadores.forEach(j => {
    (j.transacciones || []).forEach(t => all.push({ ...t, jugador: j.nombre, jugador_id: j.id }));
  });
  all.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  // construir filtros la primera vez (o cuando haya datos nuevos)
  const tipoEl  = document.getElementById('trans-tipo-filter');
  const yearEl  = document.getElementById('trans-year-filter');
  const searchEl = document.getElementById('trans-search');

  if (tipoEl && !tipoEl.dataset.built && all.length) {
    [...new Set(all.map(t => t.tipo).filter(Boolean))].sort()
      .forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; tipoEl.appendChild(o); });
    tipoEl.dataset.built = '1'; tipoEl.onchange = renderTransacciones;
  }
  if (yearEl && !yearEl.dataset.built && all.length) {
    [...new Set(all.map(t => (t.fecha||'').match(/\d{4}/)?.[0]).filter(Boolean))].sort((a,b) => b-a)
      .forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearEl.appendChild(o); });
    yearEl.dataset.built = '1'; yearEl.onchange = renderTransacciones;
  }
  if (searchEl && !searchEl.dataset.built) { searchEl.oninput = renderTransacciones; searchEl.dataset.built = '1'; }

  const tipo   = tipoEl   ? tipoEl.value : '';
  const year   = yearEl   ? yearEl.value : '';
  const search = searchEl ? searchEl.value.toLowerCase() : '';

  const rows = all.filter(t =>
    (!tipo   || t.tipo === tipo) &&
    (!year   || ((t.fecha||'').match(/\d{4}/)?.[0]) === year) &&
    (!search || t.jugador.toLowerCase().includes(search))
  );

  const tbody = document.getElementById('trans-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">Sin transacciones registradas</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(t => `
    <tr class="trans-row" onclick="location.hash='${t.jugador_id}'">
      <td>${t.fecha || '—'}</td>
      <td class="nombre">${t.jugador}</td>
      <td><span class="trans-tipo trans-${(t.tipo||'').toLowerCase().replace(/\s+/g,'-')}">${t.tipo || '—'}</span></td>
      <td>${t.de || '—'}</td>
      <td>${t.a || '—'}</td>
      <td class="trans-detalle">${t.detalle || '—'}</td>
    </tr>`).join('');
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
function enrichSeasonHighs(jugadores) {
  jugadores.forEach(j => {
    const mx = (arr, fn) => { const vals = arr.map(fn).filter(v => v != null); return vals.length ? Math.max(...vals) : null; };
    const seas = (j.temporadas_data || []).filter(s => s.g > 0);
    j.sh_pts_g    = mx(seas, s => s.pts_g);
    j.sh_rbd_g    = mx(seas, s => s.rbd_g);
    j.sh_ast_g    = mx(seas, s => s.ast_g);
    j.sh_fg_pct   = mx(seas, s => s.fg_pct);
    j.sh_tres_pct = mx(seas, s => s.tres_pct);
    j.sh_ft_pct   = mx(seas, s => s.ft_pct);
    j.sh_stl_g    = mx(seas, s => s.stl_g);
    j.sh_blk_g    = mx(seas, s => s.blk_g);
    j.sh_min_g    = mx(seas, s => s.min_g);

    const po = (j.playoffs_temporadas || []).filter(s => s.g > 0);
    j.po_sh_pts_g  = mx(po, s => s.pts_g);
    j.po_sh_rbd_g  = mx(po, s => s.rbd_g);
    j.po_sh_ast_g  = mx(po, s => s.ast_g);
    j.po_sh_fg_pct = mx(po, s => s.fg_pct);
  });
}

function enrichPlayoffStats(jugadores) {
  jugadores.forEach(j => {
    const po = j.playoffs_temporadas || [];
    j.po_seasons = po.length;
    j.po_g = po.reduce((s, t) => s + (t.g || 0), 0);
    if (j.po_g > 0) {
      j.po_pts_g    = po.reduce((s, t) => s + (t.pts_g || 0) * (t.g || 0), 0) / j.po_g;
      j.po_rbd_g    = po.reduce((s, t) => s + (t.rbd_g || 0) * (t.g || 0), 0) / j.po_g;
      j.po_ast_g    = po.reduce((s, t) => s + (t.ast_g || 0) * (t.g || 0), 0) / j.po_g;
      j.po_fg_pct   = po.reduce((s, t) => s + (t.fg_pct || 0) * (t.g || 0), 0) / j.po_g;
      j.po_pts_total = Math.round(po.reduce((s, t) => s + (t.pts_g || 0) * (t.g || 0), 0));
      j.po_rbd_total = Math.round(po.reduce((s, t) => s + (t.rbd_g || 0) * (t.g || 0), 0));
      j.po_ast_total = Math.round(po.reduce((s, t) => s + (t.ast_g || 0) * (t.g || 0), 0));
    } else {
      j.po_pts_g = null; j.po_rbd_g = null; j.po_ast_g = null; j.po_fg_pct = null;
      j.po_pts_total = null; j.po_rbd_total = null; j.po_ast_total = null;
    }
  });
}

function setViewMode(mode) {
  viewMode = mode;
  sortCol = MODES[mode].defaultSort;
  sortAsc = false;
  document.querySelectorAll('.mode-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  renderTabla();
}

function renderTabla() {
  const mode = MODES[viewMode];
  let jugadores = [...DATA.jugadores];

  const PLAYOFF_MODES = ['playoffs_pg', 'playoffs_totals', 'playoffs_sh'];
  const isPlayoff = PLAYOFF_MODES.includes(viewMode);
  if (isPlayoff) enrichPlayoffStats(jugadores);
  if (['season_highs', 'playoffs_sh'].includes(viewMode)) enrichSeasonHighs(jugadores);
  if (isPlayoff) jugadores = jugadores.filter(j => j.po_g > 0);

  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    jugadores = jugadores.filter(j => j.nombre.toLowerCase().includes(q));
  }

  jugadores.sort((a, b) => {
    const va = a[sortCol] ?? (sortAsc ? Infinity : -Infinity);
    const vb = b[sortCol] ?? (sortAsc ? Infinity : -Infinity);
    if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortAsc ? va - vb : vb - va;
  });

  // thead dinámico
  document.getElementById('ranking-thead').innerHTML = `<tr>
    <th></th><th>Jugador</th><th></th>
    ${mode.head.map(h => `<th data-col="${h.col}" onclick="sortTable('${h.col}')" class="${sortCol===h.col?'sorted'+(sortAsc?' asc':''):''}">${h.label}</th>`).join('')}
  </tr>`;

  // chips dinámicos
  document.getElementById('sort-chips').innerHTML = mode.chips.map(c => {
    const active = sortCol === c.col;
    return `<button class="chip${active?' active':''}" data-col="${c.col}" data-label="${c.label}" onclick="setSortChip('${c.col}')">${c.label}${active?(sortAsc?' ↑':' ↓'):''}</button>`;
  }).join('');

  document.getElementById('results-count').textContent =
    jugadores.length + ' jugador' + (jugadores.length !== 1 ? 'es' : '');

  const colCount = 3 + mode.head.length;

  const emptyRow = (j, i) => `<td class="rank">${i+1}</td><td class="nombre">
        ${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.display='none'" alt="">` : ''}
        ${j.nombre}${j.posicion ? ` <span class="pos-badge">${j.posicion}</span>` : ''}
      </td>`;
  const renderRow = (j, i) => `
    <tr onclick="openJugador('${j.id}')" style="animation-delay:${i * 0.02}s">
      ${j.partidos > 0 ? `<td class="rank">${i + 1}</td>
      <td class="nombre">
        ${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.display='none'" alt="">` : ''}
        ${j.nombre}${j.posicion ? ` <span class="pos-badge">${j.posicion}</span>` : ''}
      </td>` : emptyRow(j, i)}
      <td class="draft-badge">
        ${j.draft ? `
          <div class="draft-info">
            <span class="badge badge-draft">${j.draft_anio || 'Draft'}</span>
            ${j.draft_pick ? `<span class="draft-pick-num">#${j.draft_pick}</span>` : ''}
            ${j.draft_fecha ? `<span class="debut-fecha">${j.draft_fecha}</span>` : ''}
          </div>
          ${j.primer_partido ? `<div class="debut-fecha debut-fecha--debut">${j.primer_partido.fecha}</div>` : ''}
        ` : `<span class="badge badge-undraft">Undrafted</span>`}
      </td>
      ${j.partidos > 0 ? mode.cells(j, sortCol) : mode.head.map(() => '<td>—</td>').join('')}
    </tr>`;

  const debuted     = jugadores.filter(j => (j.partidos || 0) > 0);
  const neverDebuted = jugadores.filter(j => (j.partidos || 0) === 0);

  let html = debuted.map(renderRow).join('');
  if (neverDebuted.length > 0) {
    html += `<tr class="separator-row"><td colspan="${colCount}">Sin debut en la NBA</td></tr>`;
    html += neverDebuted.map((j, i) => renderRow(j, debuted.length + i)).join('');
  }

  document.getElementById('ranking-body').innerHTML = html;
}

function sortTable(col) {
  if (sortCol === col) sortAsc = !sortAsc;
  else { sortCol = col; sortAsc = false; }
  renderTabla();
}

function setSortChip(col) {
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
  const transCount = (j.transacciones||[]).length;
  const slCount = (j.summer_league||[]).length;

  return `
    <div class="ficha-header">
      ${(j.foto_url || j.bref_id) ? `<img class="player-photo" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.display='none'" alt="${j.nombre}">` : ''}
      <div>
        <h2 class="ficha-nombre">
          ${j.nombre.split(' ').slice(0,1).join(' ')}<br>
          <em>${j.nombre.split(' ').slice(1).join(' ')}</em>
        </h2>
        <div class="ficha-meta">
          ${j.posicion ? `<span class="meta-pill meta-pill--pos">${j.posicion}</span>` : ''}
          ${j.draft
            ? `<span class="meta-pill">${j.draft_fecha || j.draft_anio || 'Draft'}</span><span class="meta-pill">#${j.draft_pick||'?'} · ${j.draft_equipo||''}</span>`
            : '<span class="meta-pill">Undrafted</span>'}
          ${j.nacimiento_fecha ? `<span class="meta-pill">Nac. ${j.nacimiento_fecha}</span>` : (j.nacimiento ? `<span class="meta-pill">Nacido en ${j.nacimiento}</span>` : '')}
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
      <button class="tab-btn" onclick="openTab(this,'tab-tray')">Trayectoria</button>
      <button class="tab-btn" onclick="openTab(this,'tab-trans')">Transacciones${transCount>0?` (${transCount})`:''}</button>
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
    <div id="tab-tray" class="tab-panel">
      ${buildTabTrayectoria(j)}
    </div>
    <div id="tab-trans" class="tab-panel">
      ${buildTabTransacciones(j)}
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

  const yearNum = s => parseInt((String(s.year||'')).match(/\d{4}/)?.[0] || '0');
  const sorted = [...seas].sort((a, b) => yearNum(a) - yearNum(b));

  const rowsPG = sorted.map(s => `<tr>
    <td>${s.year||'—'}</td><td>${s.team||'—'}</td><td>${fmt(s.age)}</td>
    <td>${fmt(s.g)}</td><td>${fmt(s.gs)}</td><td>${fmtDec(s.min_g)}</td>
    <td>${fmtDec(s.pts_g)}</td><td>${fmtDec(s.rbd_g)}</td><td>${fmtDec(s.ast_g)}</td>
    <td>${fmtDec(s.stl_g)}</td><td>${fmtDec(s.blk_g)}</td>
    <td>${fmtPct(s.fg_pct)}</td><td>${fmtPct(s.tres_pct)}</td><td>${fmtPct(s.ft_pct)}</td>
    <td>${fmt(s.tov)}</td>
  </tr>`).join('');

  const rowsTot = sorted.map(s => `<tr>
    <td>${s.year||'—'}</td><td>${s.team||'—'}</td><td>${fmt(s.age)}</td>
    <td>${fmt(s.g)}</td><td>${fmt(s.gs)}</td><td>${fmt(s.min_total)}</td>
    <td>${fmt(s.pts_total)}</td><td>${fmt(s.rbd_total)}</td><td>${fmt(s.ast_total)}</td>
    <td>${fmt(s.stl_total)}</td><td>${fmt(s.blk_total)}</td>
    <td>${fmtPct(s.fg_pct)}</td><td>${fmtPct(s.tres_pct)}</td><td>${fmtPct(s.ft_pct)}</td>
    <td>${fmt(s.tov)}</td>
  </tr>`).join('');

  return `
    <div class="tab-subtabs">
      <button class="tab-sub active" onclick="toggleTemporadas(this,'pg')">Por partido</button>
      <button class="tab-sub" onclick="toggleTemporadas(this,'tot')">Totales</button>
    </div>
    <div style="overflow-x:auto">
      <table class="tab-table" id="temps-pg">
        <thead><tr>
          <th>Temporada</th><th>Equipo</th><th>Edad</th><th>PJ</th><th>GS</th><th>MIN/G</th>
          <th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th>
          <th>FG%</th><th>3P%</th><th>FT%</th><th>TOV</th>
        </tr></thead>
        <tbody>${rowsPG}</tbody>
      </table>
      <table class="tab-table" id="temps-tot" style="display:none">
        <thead><tr>
          <th>Temporada</th><th>Equipo</th><th>Edad</th><th>PJ</th><th>GS</th><th>MIN</th>
          <th>PTS</th><th>RBD</th><th>AST</th><th>STL</th><th>BLK</th>
          <th>FG%</th><th>3P%</th><th>FT%</th><th>TOV</th>
        </tr></thead>
        <tbody>${rowsTot}</tbody>
      </table>
    </div>`;
}

function toggleTemporadas(btn, mode) {
  btn.closest('.tab-panel').querySelectorAll('.tab-sub').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('temps-pg').style.display  = mode === 'pg'  ? '' : 'none';
  document.getElementById('temps-tot').style.display = mode === 'tot' ? '' : 'none';
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

// ── TAB TRAYECTORIA ──────────────────────────
function buildTabTrayectoria(j) {
  const hasData = j.cantera || j.pre_nba || (j.post_nba && j.post_nba.length);
  if (!hasData) return '<p class="empty-msg">Sin datos de trayectoria</p>';

  const post = (j.post_nba || []).slice(0, 3);
  const tray = (label, val) => val
    ? `<div class="tray-col"><div class="tray-label">${label}</div><div class="tray-valor">${val}</div></div>`
    : `<div class="tray-col tray-col--empty"><div class="tray-label">${label}</div><div class="tray-valor">—</div></div>`;

  return `<div class="trayectoria-row">
    ${tray('Cantera', j.cantera)}
    ${tray('Pre-NBA', j.pre_nba)}
    ${tray('Post-NBA 1', post[0] ? (post[0].equipo || post[0]) : null)}
    ${tray('Post-NBA 2', post[1] ? (post[1].equipo || post[1]) : null)}
    ${tray('Post-NBA 3', post[2] ? (post[2].equipo || post[2]) : null)}
  </div>`;
}

// ── TAB TRANSACCIONES ────────────────────────
function buildTabTransacciones(j) {
  const trans = [...(j.transacciones || [])].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  if (!trans.length) return '<p class="empty-msg">Sin transacciones registradas</p>';

  return `<div style="overflow-x:auto">
    <table class="tab-table">
      <thead><tr>
        <th>Fecha</th><th>Tipo</th><th>Equipo</th><th>Equipo 2</th><th>Otros jugadores</th>
      </tr></thead>
      <tbody>
        ${trans.map(t => `
          <tr>
            <td>${t.fecha || '—'}</td>
            <td><span class="trans-tipo trans-${(t.tipo||'').toLowerCase().replace(/\s+/g,'-')}">${t.tipo || '—'}</span></td>
            <td>${t.de || '—'}</td>
            <td>${t.a || '—'}</td>
            <td class="trans-detalle">${t.detalle || '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
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
const FALLBACK_DATA = {"actualizado":"2026-04-25T00:00:00.000Z","jugadores":[{"id":"pau-gasol","nombre":"Pau Gasol","rank":1,"draft":true,"draft_anio":2001,"draft_pick":3,"draft_equipo":"ATL","nacimiento":1980,"temporadas":18,"partidos":1226,"partidos_titular":1150,"min_total":41001,"min_g":33.4,"pts_total":20894,"pts_g":17.0,"rbd_total":11305,"rbd_g":9.2,"ast_total":3925,"ast_g":3.2,"stl_total":606,"stl_g":0.5,"blk_total":1941,"blk_g":1.6,"tres_total":179,"tres_g":0.1,"tov_total":2638,"pf_total":2632,"fg_pct":0.507,"tres_pct":0.368,"ft_pct":0.753,"equipos_nba":"MEM, LAL, CHI, SAS","ganancias":220990766,"primer_partido":{"fecha":"1 nov 2001","equipo":"MEM","rival":"DET","min":"17:20","pts":4,"rbd":4,"ast":1},"premios":[{"tipo":"ROY","detalle":"Rookie of the Year","year":2002,"team":"MEM"},{"tipo":"ROM","detalle":"Rookie of the Month — Noviembre 2001","year":2002,"team":"MEM"},{"tipo":"ROM","detalle":"Rookie of the Month — Enero 2002","year":2002,"team":"MEM"},{"tipo":"ROM","detalle":"Rookie of the Month — Marzo 2002","year":2002,"team":"MEM"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2002,"team":"MEM"},{"tipo":"Rising Stars","detalle":"Novatos","year":2002,"team":"MEM"},{"tipo":"Rising Stars","detalle":"Sophomores","year":2003,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste","year":2006,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste","year":2009,"team":"LAL"},{"tipo":"POM","detalle":"Player of the Month — Febrero 2009","year":2009,"team":"LAL"},{"tipo":"All NBA","detalle":"All NBA 3rd Team","year":2009,"team":"LAL"},{"tipo":"All Star","detalle":"All Star Oeste + Shooting Challenge","year":2010,"team":"LAL"},{"tipo":"All NBA","detalle":"All NBA 3rd Team","year":2010,"team":"LAL"},{"tipo":"All Star","detalle":"All Star Oeste + Shooting Challenge","year":2011,"team":"LAL"},{"tipo":"All NBA","detalle":"All NBA 2nd Team","year":2011,"team":"LAL"},{"tipo":"All Star","detalle":"All Star Este (Titular)","year":2015,"team":"CHI"},{"tipo":"All NBA","detalle":"All NBA 2nd Team","year":2015,"team":"CHI"},{"tipo":"All Star","detalle":"All Star Este","year":2016,"team":"CHI"}],"records":[{"categoria":"Puntos","valor":46,"team":"CHI","rival":"MIL","fecha":"10 ene 2015"},{"categoria":"Puntos","valor":44,"team":"MEM","rival":"SEA","fecha":"28 mar 2006"},{"categoria":"Rebotes","valor":22,"team":"LAL","rival":"CHA","fecha":"29 mar 2010"},{"categoria":"Rebotes","valor":22,"team":"LAL","rival":"MIL","fecha":"16 dic 2009"},{"categoria":"Asistencias","valor":9,"team":"MEM","rival":"DAL","fecha":"7 feb 2007"},{"categoria":"Tapones","valor":9,"team":"CHI","rival":"DEN","fecha":"1 ene 2015"},{"categoria":"Minutos","valor":"56:13","team":"MEM","rival":"DET","fecha":"19 dic 2005"},{"categoria":"Pérdidas","valor":9,"team":"MEM","rival":"DAL","fecha":"7 feb 2007"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"gasolpa01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"27 jun 2001","posicion":"Pívot","nacimiento_fecha":"6 jul 1980"},{"id":"serge-ibaka","nombre":"Serge Ibaka","rank":2,"draft":true,"draft_anio":2008,"draft_pick":24,"draft_equipo":"SEA","nacimiento":1989,"temporadas":14,"partidos":919,"partidos_titular":697,"min_total":25126,"min_g":27.3,"pts_total":11028,"pts_g":12.0,"rbd_total":6513,"rbd_g":7.1,"ast_total":749,"ast_g":0.8,"stl_total":373,"stl_g":0.4,"blk_total":1759,"blk_g":1.9,"tres_total":614,"tres_g":0.7,"tov_total":1187,"pf_total":2480,"fg_pct":0.513,"tres_pct":0.359,"ft_pct":0.757,"equipos_nba":"OKC, ORL, TOR, LAC, MIL","ganancias":141250191,"primer_partido":{"fecha":"30 oct 2009","equipo":"OKC","rival":"DET","min":"2:53","pts":0,"rbd":1,"ast":0},"premios":[{"tipo":"Rising Stars","detalle":"Sophomores","year":2011,"team":"OKC"},{"tipo":"All Star","detalle":"Dunk Contest","year":2011,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 1st Team","year":2012,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 1st Team","year":2013,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 2nd Team","year":2014,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 1st Team","year":2015,"team":"OKC"},{"tipo":"All Defense","detalle":"All Defense 1st Team","year":2016,"team":"OKC"}],"records":[{"categoria":"Tapones","valor":11,"team":"OKC","rival":"DEN","fecha":"19 feb 2012"},{"categoria":"Tapones","valor":10,"team":"OKC","rival":"DAL","fecha":"1 feb 2012"},{"categoria":"Rebotes","valor":22,"team":"OKC","rival":"DAL","fecha":"19 feb 2015"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"ibakase01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"26 jun 2008","posicion":"Ala-Pívot","nacimiento_fecha":"18 sep 1989"},{"id":"jose-m-calderon","nombre":"José M. Calderón","rank":3,"draft":false,"draft_anio":null,"draft_pick":null,"draft_equipo":null,"nacimiento":1981,"temporadas":14,"partidos":895,"partidos_titular":591,"min_total":23643,"min_g":26.4,"pts_total":7921,"pts_g":8.9,"rbd_total":2148,"rbd_g":2.4,"ast_total":5148,"ast_g":5.8,"stl_total":716,"stl_g":0.8,"blk_total":71,"blk_g":0.1,"tres_total":920,"tres_g":1.0,"tov_total":1339,"pf_total":1476,"fg_pct":0.472,"tres_pct":0.407,"ft_pct":0.873,"equipos_nba":"TOR, DET, DAL, NYK, LAL, CLE, ATL","ganancias":84201469,"primer_partido":{"fecha":"2 nov 2005","equipo":"TOR","rival":"WAS","min":"16:43","pts":5,"rbd":1,"ast":3},"premios":[],"records":[{"categoria":"Asistencias","valor":19,"team":"TOR","rival":"CHI","fecha":"29 mar 2009"},{"categoria":"Asistencias","valor":19,"team":"TOR","rival":"MIN","fecha":"24 feb 2011"},{"categoria":"Minutos","valor":"53:55","team":"TOR","rival":"POR","fecha":"13 ene 2008"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"caldejo01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":null,"posicion":"Base","nacimiento_fecha":"28 sep 1981"},{"id":"marc-gasol","nombre":"Marc Gasol","rank":4,"draft":true,"draft_anio":2007,"draft_pick":48,"draft_equipo":"LAL","nacimiento":1985,"temporadas":14,"partidos":891,"partidos_titular":866,"min_total":28719,"min_g":32.2,"pts_total":12514,"pts_g":14.0,"rbd_total":6604,"rbd_g":7.4,"ast_total":2996,"ast_g":3.4,"stl_total":792,"stl_g":0.9,"blk_total":1254,"blk_g":1.4,"tres_total":431,"tres_g":0.5,"tov_total":1755,"pf_total":2551,"fg_pct":0.481,"tres_pct":0.36,"ft_pct":0.776,"equipos_nba":"MEM, TOR, LAL","ganancias":181665456,"primer_partido":{"fecha":"29 oct 2008","equipo":"MEM","rival":"HOU","min":"36:24","pts":12,"rbd":12,"ast":1},"premios":[{"tipo":"Rising Stars","detalle":"Novatos","year":2009,"team":"MEM"},{"tipo":"All Rookie","detalle":"All Rookie 2nd Team","year":2009,"team":"MEM"},{"tipo":"Rising Stars","detalle":"Sophomores","year":2010,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste","year":2012,"team":"MEM"},{"tipo":"DPOY","detalle":"Defensive Player of the Year","year":2013,"team":"MEM"},{"tipo":"All NBA","detalle":"All NBA 2nd Team","year":2013,"team":"MEM"},{"tipo":"All Defense","detalle":"All Defense 2nd Team","year":2013,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste (Titular)","year":2015,"team":"MEM"},{"tipo":"All NBA","detalle":"All NBA 1st Team","year":2015,"team":"MEM"},{"tipo":"All Star","detalle":"All Star Oeste","year":2017,"team":"MEM"}],"records":[{"categoria":"Puntos","valor":42,"team":"MEM","rival":"TOR","fecha":"25 ene 2017"},{"categoria":"Rebotes","valor":16,"team":"MEM","rival":"NOL","fecha":"1 dic 2015"},{"categoria":"Minutos","valor":"50:35","team":"MEM","rival":"MIA","fecha":"19 feb 2010"},{"categoria":"Tapones","valor":8,"team":"MEM","rival":"POR","fecha":"4 ene 2013"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"gasolma01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"28 jun 2007","posicion":"Pívot","nacimiento_fecha":"29 ene 1985"},{"id":"ricky-rubio","nombre":"Ricky Rubio","rank":5,"draft":true,"draft_anio":2009,"draft_pick":5,"draft_equipo":"MIN","nacimiento":1990,"temporadas":13,"partidos":698,"partidos_titular":603,"min_total":20694,"min_g":29.6,"pts_total":7570,"pts_g":10.9,"rbd_total":2830,"rbd_g":4.1,"ast_total":5160,"ast_g":7.4,"stl_total":1226,"stl_g":1.8,"blk_total":94,"blk_g":0.1,"tres_total":637,"tres_g":0.9,"tov_total":1768,"pf_total":1738,"fg_pct":0.388,"tres_pct":0.324,"ft_pct":0.843,"equipos_nba":"MIN, UTA, PHX, CLE","ganancias":131001894,"primer_partido":{"fecha":"26 dic 2011","equipo":"MIN","rival":"OKC","min":"26:18","pts":6,"rbd":5,"ast":6},"premios":[{"tipo":"ROM","detalle":"Rookie of the Month — Enero 2012","year":2012,"team":"MIN"},{"tipo":"Rising Stars","detalle":"Rookies","year":2012,"team":"MIN"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2012,"team":"MIN"},{"tipo":"Rising Stars","detalle":"Sophomores","year":2013,"team":"MIN"}],"records":[{"categoria":"Asistencias","valor":19,"team":"MIN","rival":"WAS","fecha":"13 mar 2017"},{"categoria":"Robos","valor":8,"team":"MIN","rival":"MIL","fecha":"3 abr 2013"},{"categoria":"Robos","valor":8,"team":"MIN","rival":"NYK","fecha":"16 dic 2015"},{"categoria":"Triples","valor":8,"team":"CLE","rival":"NYK","fecha":"7 nov 2021"},{"categoria":"Minutos","valor":"49:09","team":"MIN","rival":"DAL","fecha":"19 mar 2014"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"rubiori01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"25 jun 2009","posicion":"Base","nacimiento_fecha":"21 oct 1990"},{"id":"santi-aldama","nombre":"Santi Aldama","rank":6,"draft":true,"draft_anio":2021,"draft_pick":30,"draft_equipo":"UTA","nacimiento":2001,"temporadas":4,"partidos":278,"partidos_titular":82,"min_total":6518,"min_g":23.5,"pts_total":2895,"pts_g":10.4,"rbd_total":1513,"rbd_g":5.4,"ast_total":570,"ast_g":2.1,"stl_total":183,"stl_g":0.7,"blk_total":172,"blk_g":0.6,"tres_total":396,"tres_g":1.4,"tov_total":271,"pf_total":413,"fg_pct":0.463,"tres_pct":0.346,"ft_pct":0.686,"equipos_nba":"MEM","ganancias":62743371,"primer_partido":{"fecha":"27 oct 2021","equipo":"MEM","rival":"POR","min":"5:34","pts":7,"rbd":2,"ast":0},"premios":[],"records":[{"categoria":"Puntos","valor":37,"team":"MEM","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"aldamsa01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"29 jul 2021","posicion":"Ala-Pívot","nacimiento_fecha":"23 may 2001"},{"id":"nikola-mirotic","nombre":"Nikola Mirotic","rank":7,"draft":true,"draft_anio":2011,"draft_pick":23,"draft_equipo":"HOU","nacimiento":1991,"temporadas":5,"partidos":319,"partidos_titular":95,"min_total":7718,"min_g":24.2,"pts_total":3910,"pts_g":12.3,"rbd_total":1894,"rbd_g":5.9,"ast_total":407,"ast_g":1.3,"stl_total":240,"stl_g":0.8,"blk_total":228,"blk_g":0.7,"tres_total":614,"tres_g":1.9,"tov_total":381,"pf_total":666,"fg_pct":0.423,"tres_pct":0.359,"ft_pct":0.808,"equipos_nba":"CHI, NOL, MIL","ganancias":41631175,"primer_partido":{"fecha":"29 oct 2014","equipo":"CHI","rival":"NYK","min":"15:17","pts":5,"rbd":7,"ast":1},"premios":[{"tipo":"ROM","detalle":"Rookie of the Month — Diciembre 2014","year":2015,"team":"CHI"},{"tipo":"ROM","detalle":"Rookie of the Month — Marzo 2015","year":2015,"team":"CHI"},{"tipo":"Rising Stars","detalle":"Rookies","year":2015,"team":"CHI"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2015,"team":"CHI"},{"tipo":"Rising Stars","detalle":"Sophomores (lesionado)","year":2016,"team":"CHI"}],"records":[{"categoria":"Triples","valor":9,"team":"CHI","rival":"NYK","fecha":"23 mar 2016"},{"categoria":"Triples","valor":8,"team":"CHI","rival":"IND","fecha":"29 dic 2017"},{"categoria":"Puntos","valor":36,"team":"NOL","rival":"SAC","fecha":"19 oct 2018"},{"categoria":"Minutos","valor":"49:00","team":"NOL","rival":"BRK","fecha":"10 feb 2018"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"mirotni01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"23 jun 2011","posicion":"Ala-Pívot","nacimiento_fecha":"5 nov 1991"},{"id":"juancho-hernangomez","nombre":"Juancho Hernangómez","rank":8,"draft":true,"draft_anio":2016,"draft_pick":15,"draft_equipo":"DEN","nacimiento":1995,"temporadas":7,"partidos":339,"partidos_titular":76,"min_total":5269,"min_g":15.5,"pts_total":1711,"pts_g":5.1,"rbd_total":1131,"rbd_g":3.3,"ast_total":216,"ast_g":0.6,"stl_total":131,"stl_g":0.4,"blk_total":71,"blk_g":0.2,"tres_total":266,"tres_g":0.8,"tov_total":167,"pf_total":365,"fg_pct":0.428,"tres_pct":0.342,"ft_pct":0.676,"equipos_nba":"DEN, MIN, BOS, UTA, SAS, TOR","ganancias":24938681,"primer_partido":{"fecha":"26 oct 2016","equipo":"DEN","rival":"NOL","min":"0:39","pts":0,"rbd":0,"ast":0},"premios":[],"records":[{"categoria":"Puntos","valor":27,"team":"MIN","rival":"—","fecha":"Temporada burbuja 2020"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"hernaju01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"23 jun 2016","posicion":"Ala-Pívot","nacimiento_fecha":"28 sep 1995"},{"id":"rudy-fernandez","nombre":"Rudy Fernández","rank":9,"draft":true,"draft_anio":2007,"draft_pick":24,"draft_equipo":"PHX","nacimiento":1985,"temporadas":5,"partidos":249,"partidos_titular":10,"min_total":5965,"min_g":24.0,"pts_total":2254,"pts_g":9.1,"rbd_total":608,"rbd_g":2.4,"ast_total":554,"ast_g":2.2,"stl_total":249,"stl_g":1.0,"blk_total":40,"blk_g":0.2,"tres_total":413,"tres_g":1.7,"tov_total":286,"pf_total":369,"fg_pct":0.399,"tres_pct":0.36,"ft_pct":0.84,"equipos_nba":"POR, DEN","ganancias":5676523,"primer_partido":{"fecha":"28 oct 2008","equipo":"POR","rival":"LAL","min":"29:03","pts":16,"rbd":2,"ast":4},"premios":[{"tipo":"Rising Stars","detalle":"Novatos","year":2009,"team":"POR"},{"tipo":"All Rookie","detalle":"All Rookie 2nd Team","year":2009,"team":"POR"},{"tipo":"All Star","detalle":"Dunk Contest","year":2009,"team":"POR"}],"records":[{"categoria":"Puntos","valor":26,"team":"POR","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"fernaru01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"28 jun 2007","posicion":"Escolta","nacimiento_fecha":"4 abr 1985"},{"id":"sergio-rodriguez","nombre":"Sergio Rodríguez","rank":10,"draft":true,"draft_anio":2006,"draft_pick":27,"draft_equipo":"PHX","nacimiento":1986,"temporadas":5,"partidos":353,"partidos_titular":52,"min_total":5281,"min_g":15.0,"pts_total":1747,"pts_g":5.0,"rbd_total":525,"rbd_g":1.5,"ast_total":1183,"ast_g":3.4,"stl_total":212,"stl_g":0.6,"blk_total":13,"blk_g":0.0,"tres_total":202,"tres_g":0.6,"tov_total":481,"pf_total":441,"fg_pct":0.409,"tres_pct":0.337,"ft_pct":0.739,"equipos_nba":"POR, SAC, NYK, PHI","ganancias":11469835,"primer_partido":{"fecha":"3 nov 2006","equipo":"POR","rival":"GSW","min":"2:09","pts":2,"rbd":1,"ast":0},"premios":[],"records":[{"categoria":"Robos","valor":8,"team":"NYK","rival":"MIL","fecha":"22 feb 2010"},{"categoria":"Asistencias","valor":24,"team":"NYK","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"rodrise01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"28 jun 2006","posicion":"Base","nacimiento_fecha":"12 dic 1986"},{"id":"willy-hernangomez","nombre":"Willy Hernangómez","rank":11,"draft":true,"draft_anio":2015,"draft_pick":35,"draft_equipo":"PHI","nacimiento":1994,"temporadas":7,"partidos":344,"partidos_titular":48,"min_total":5149,"min_g":15.0,"pts_total":2524,"pts_g":7.3,"rbd_total":1982,"rbd_g":5.8,"ast_total":364,"ast_g":1.1,"stl_total":145,"stl_g":0.4,"blk_total":134,"blk_g":0.4,"tres_total":37,"tres_g":0.1,"tov_total":347,"pf_total":573,"fg_pct":0.533,"tres_pct":0.306,"ft_pct":0.713,"equipos_nba":"NYK, CHA, NOL","ganancias":12435586,"primer_partido":{"fecha":"26 oct 2016","equipo":"NYK","rival":"CLE","min":"9:26","pts":4,"rbd":1,"ast":0},"premios":[{"tipo":"ROM","detalle":"Rookie of the Month — Abril 2017","year":2017,"team":"NYK"},{"tipo":"Rising Stars","detalle":"Rookies","year":2017,"team":"NYK"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2017,"team":"NYK"}],"records":[{"categoria":"Puntos","valor":29,"team":"NOL","rival":"—","fecha":"Pendiente"},{"categoria":"Rebotes","valor":17,"team":"NOL","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"hernawi01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"25 jun 2015","posicion":"Pívot","nacimiento_fecha":"28 may 1994"},{"id":"alex-abrines","nombre":"Alex Abrines","rank":12,"draft":true,"draft_anio":2013,"draft_pick":32,"draft_equipo":"OKC","nacimiento":1993,"temporadas":3,"partidos":174,"partidos_titular":16,"min_total":2777,"min_g":16.0,"pts_total":924,"pts_g":5.3,"rbd_total":248,"rbd_g":1.4,"ast_total":88,"ast_g":0.5,"stl_total":92,"stl_g":0.5,"blk_total":22,"blk_g":0.1,"tres_total":219,"tres_g":1.3,"tov_total":72,"pf_total":291,"fg_pct":0.387,"tres_pct":0.368,"ft_pct":0.88,"equipos_nba":"OKC","ganancias":15294947,"primer_partido":{"fecha":"26 oct 2016","equipo":"OKC","rival":"PHI","min":"13:24","pts":3,"rbd":1,"ast":0},"premios":[{"tipo":"Rising Stars","detalle":"Rookies","year":2017,"team":"OKC"}],"records":[{"categoria":"Triples","valor":7,"team":"OKC","rival":"ATL","fecha":"30 nov 2018"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"abrinal01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"27 jun 2013","posicion":"Escolta","nacimiento_fecha":"1 ago 1993"},{"id":"raul-lopez","nombre":"Raül Lopez","rank":13,"draft":true,"draft_anio":2001,"draft_pick":24,"draft_equipo":"UTA","nacimiento":1980,"temporadas":2,"partidos":113,"partidos_titular":26,"min_total":2135,"min_g":18.9,"pts_total":733,"pts_g":6.5,"rbd_total":194,"rbd_g":1.7,"ast_total":428,"ast_g":3.8,"stl_total":84,"stl_g":0.7,"blk_total":5,"blk_g":0.0,"tres_total":45,"tres_g":0.4,"tov_total":221,"pf_total":278,"fg_pct":0.429,"tres_pct":0.346,"ft_pct":0.853,"equipos_nba":"UTA","ganancias":3941313,"primer_partido":{"fecha":"29 oct 2003","equipo":"UTA","rival":"POR","min":"6:17","pts":0,"rbd":1,"ast":3},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"lopezra01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"foto_url":"https://www.proballers.com/media/cache/resize_600_png/https---www.proballers.com/ul/player/2682-1-5cf97c30a9311.jpg","draft_fecha":"27 jun 2001","posicion":"Base","nacimiento_fecha":"13 abr 1980"},{"id":"usman-garuba","nombre":"Usman Garuba","rank":14,"draft":true,"draft_anio":2021,"draft_pick":23,"draft_equipo":"HOU","nacimiento":2002,"temporadas":3,"partidos":99,"partidos_titular":3,"min_total":1209,"min_g":12.2,"pts_total":225,"pts_g":2.3,"rbd_total":390,"rbd_g":3.9,"ast_total":81,"ast_g":0.8,"stl_total":54,"stl_g":0.5,"blk_total":40,"blk_g":0.4,"tres_total":29,"tres_g":0.3,"tov_total":53,"pf_total":163,"fg_pct":0.475,"tres_pct":0.367,"ft_pct":0.617,"equipos_nba":"HOU, GSW","ganancias":7424488,"primer_partido":{"fecha":"20 oct 2021","equipo":"HOU","rival":"MIN","min":"8:22","pts":4,"rbd":2,"ast":1},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"garubus01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"29 jul 2021","posicion":"Ala-Pívot","nacimiento_fecha":"29 oct 2002"},{"id":"juan-carlos-navarro","nombre":"Juan Carlos Navarro","rank":15,"draft":true,"draft_anio":2002,"draft_pick":40,"draft_equipo":"WAS","nacimiento":1980,"temporadas":1,"partidos":82,"partidos_titular":30,"min_total":2117,"min_g":25.8,"pts_total":896,"pts_g":10.9,"rbd_total":210,"rbd_g":2.6,"ast_total":177,"ast_g":2.2,"stl_total":48,"stl_g":0.6,"blk_total":1,"blk_g":0.0,"tres_total":156,"tres_g":1.9,"tov_total":134,"pf_total":94,"fg_pct":0.402,"tres_pct":0.361,"ft_pct":0.849,"equipos_nba":"MEM","ganancias":538090,"primer_partido":{"fecha":"31 oct 2007","equipo":"MEM","rival":"SAS","min":"16:51","pts":9,"rbd":0,"ast":2},"premios":[{"tipo":"Rising Stars","detalle":"Novatos","year":2008,"team":"MEM"},{"tipo":"All Rookie","detalle":"All Rookie 2nd Team","year":2008,"team":"MEM"}],"records":[{"categoria":"Triples","valor":8,"team":"MEM","rival":"NOL","fecha":"16 nov 2007"},{"categoria":"Minutos","valor":"46:32","team":"MEM","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"navarjua01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"foto_url":"https://www.proballers.com/media/cache/resize_600_png/https---www.proballers.com/ul/player/2595-1-5ccc7dce13641.jpg","draft_fecha":"26 jun 2002","posicion":"Escolta","nacimiento_fecha":"13 jun 1980"},{"id":"victor-claver","nombre":"Víctor Claver","rank":16,"draft":true,"draft_anio":2009,"draft_pick":22,"draft_equipo":"POR","nacimiento":1988,"temporadas":3,"partidos":80,"partidos_titular":16,"min_total":1072,"min_g":13.4,"pts_total":258,"pts_g":3.2,"rbd_total":178,"rbd_g":2.2,"ast_total":56,"ast_g":0.7,"stl_total":30,"stl_g":0.4,"blk_total":16,"blk_g":0.2,"tres_total":34,"tres_g":0.4,"tov_total":58,"pf_total":103,"fg_pct":0.398,"tres_pct":0.293,"ft_pct":0.585,"equipos_nba":"POR","ganancias":4000000,"primer_partido":{"fecha":"3 nov 2012","equipo":"POR","rival":"HOU","min":"3:33","pts":0,"rbd":1,"ast":0},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"clavevi01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"25 jun 2009","posicion":"Alero","nacimiento_fecha":"30 may 1988"},{"id":"jorge-garbajosa","nombre":"Jorge Garbajosa","rank":17,"draft":false,"draft_anio":null,"draft_pick":null,"draft_equipo":null,"nacimiento":1977,"temporadas":2,"partidos":74,"partidos_titular":60,"min_total":1983,"min_g":26.8,"pts_total":589,"pts_g":8.0,"rbd_total":345,"rbd_g":4.7,"ast_total":128,"ast_g":1.7,"stl_total":81,"stl_g":1.1,"blk_total":15,"blk_g":0.2,"tres_total":72,"tres_g":1.0,"tov_total":65,"pf_total":92,"fg_pct":0.415,"tres_pct":0.345,"ft_pct":0.731,"equipos_nba":"TOR","ganancias":12120000,"primer_partido":{"fecha":"1 nov 2006","equipo":"TOR","rival":"BRK","min":"20:33","pts":2,"rbd":5,"ast":2},"premios":[{"tipo":"ROM","detalle":"Rookie of the Month — Diciembre 2006","year":2007,"team":"TOR"},{"tipo":"Rising Stars","detalle":"Novatos","year":2007,"team":"TOR"},{"tipo":"All Rookie","detalle":"All Rookie 1st Team","year":2007,"team":"TOR"}],"records":[{"categoria":"Puntos","valor":22,"team":"TOR","rival":"—","fecha":"Pendiente"},{"categoria":"Minutos","valor":"43:22","team":"TOR","rival":"—","fecha":"Pendiente"}],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"garbajo01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"foto_url":"https://www.proballers.com/media/cache/resize_600_png/https---www.proballers.com/ul/player/1005-1-5ccc1e530f1a1.jpg","draft_fecha":null,"posicion":"Ala-Pívot","nacimiento_fecha":"24 may 1977"},{"id":"hugo-gonzalez","nombre":"Hugo González","rank":18,"draft":true,"draft_anio":2025,"draft_pick":28,"draft_equipo":"BOS","nacimiento":2005,"temporadas":1,"partidos":63,"partidos_titular":3,"min_total":970,"min_g":15.4,"pts_total":258,"pts_g":4.1,"rbd_total":218,"rbd_g":3.5,"ast_total":37,"ast_g":0.6,"stl_total":38,"stl_g":0.6,"blk_total":20,"blk_g":0.3,"tres_total":35,"tres_g":0.6,"tov_total":34,"pf_total":111,"fg_pct":0.473,"tres_pct":0.337,"ft_pct":0.5,"equipos_nba":"BOS","ganancias":14289145,"primer_partido":{"fecha":"24 oct 2025","equipo":"BOS","rival":"NYK","min":"—","pts":null,"rbd":null,"ast":null},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"gonzahu01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"25 jun 2025","posicion":"Alero","nacimiento_fecha":"5 sep 2005"},{"id":"fernando-martin","nombre":"Fernando Martín","rank":19,"draft":true,"draft_anio":1985,"draft_pick":38,"draft_equipo":"BRK","nacimiento":null,"temporadas":1,"partidos":24,"partidos_titular":0,"min_total":146,"min_g":6.1,"pts_total":22,"pts_g":0.9,"rbd_total":28,"rbd_g":1.2,"ast_total":9,"ast_g":0.4,"stl_total":7,"stl_g":0.3,"blk_total":1,"blk_g":0.0,"tres_total":0,"tres_g":0.0,"tov_total":20,"pf_total":24,"fg_pct":0.29,"tres_pct":null,"ft_pct":0.364,"equipos_nba":"POR","ganancias":145000,"primer_partido":{"fecha":"31 oct 1986","equipo":"POR","rival":"SEA","min":"2","pts":0,"rbd":0,"ast":0},"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":"martife01","cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"foto_url":"https://www.proballers.com/media/cache/resize_600_png/https---www.proballers.com/ul/player/60573-1-5ec77db91fc38.jpg","draft_fecha":"18 jun 1985","posicion":"Alero","nacimiento_fecha":"25 ene 1962"},{"id":"jose-a-montero","nombre":"José A. Montero","rank":20,"draft":true,"draft_anio":1987,"draft_pick":113,"draft_equipo":"ATL","nacimiento":null,"temporadas":0,"partidos":0,"partidos_titular":0,"min_total":0,"min_g":null,"pts_total":0,"pts_g":null,"rbd_total":0,"rbd_g":null,"ast_total":0,"ast_g":null,"stl_total":0,"stl_g":null,"blk_total":0,"blk_g":null,"tres_total":0,"tres_g":null,"tov_total":0,"pf_total":0,"fg_pct":null,"tres_pct":null,"ft_pct":null,"equipos_nba":"","ganancias":0,"primer_partido":null,"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":null,"cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"22 jun 1987","posicion":"Base","nacimiento_fecha":null},{"id":"roberto-duenas","nombre":"Roberto Dueñas","rank":21,"draft":true,"draft_anio":1997,"draft_pick":58,"draft_equipo":"CHI","nacimiento":null,"temporadas":0,"partidos":0,"partidos_titular":0,"min_total":0,"min_g":null,"pts_total":0,"pts_g":null,"rbd_total":0,"rbd_g":null,"ast_total":0,"ast_g":null,"stl_total":0,"stl_g":null,"blk_total":0,"blk_g":null,"tres_total":0,"tres_g":null,"tov_total":0,"pf_total":0,"fg_pct":null,"tres_pct":null,"ft_pct":null,"equipos_nba":"","ganancias":0,"primer_partido":null,"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":null,"cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"25 jun 1997","posicion":"Pívot","nacimiento_fecha":"9 ago 1974"},{"id":"albert-miralles","nombre":"Albert Miralles","rank":22,"draft":true,"draft_anio":2004,"draft_pick":40,"draft_equipo":"TOR","nacimiento":null,"temporadas":0,"partidos":0,"partidos_titular":0,"min_total":0,"min_g":null,"pts_total":0,"pts_g":null,"rbd_total":0,"rbd_g":null,"ast_total":0,"ast_g":null,"stl_total":0,"stl_g":null,"blk_total":0,"blk_g":null,"tres_total":0,"tres_g":null,"tov_total":0,"pf_total":0,"fg_pct":null,"tres_pct":null,"ft_pct":null,"equipos_nba":"","ganancias":0,"primer_partido":null,"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":null,"cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"24 jun 2004","posicion":"Ala-Pívot","nacimiento_fecha":"29 may 1982"},{"id":"fran-vazquez","nombre":"Fran Vázquez","rank":23,"draft":true,"draft_anio":2005,"draft_pick":11,"draft_equipo":"ORL","nacimiento":null,"temporadas":0,"partidos":0,"partidos_titular":0,"min_total":0,"min_g":null,"pts_total":0,"pts_g":null,"rbd_total":0,"rbd_g":null,"ast_total":0,"ast_g":null,"stl_total":0,"stl_g":null,"blk_total":0,"blk_g":null,"tres_total":0,"tres_g":null,"tov_total":0,"pf_total":0,"fg_pct":null,"tres_pct":null,"ft_pct":null,"equipos_nba":"","ganancias":0,"primer_partido":null,"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":null,"cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"28 jun 2005","posicion":"Pívot","nacimiento_fecha":"8 feb 1983"},{"id":"sergio-llull","nombre":"Sergio Llull","rank":24,"draft":true,"draft_anio":2009,"draft_pick":34,"draft_equipo":"HOU","nacimiento":null,"temporadas":0,"partidos":0,"partidos_titular":0,"min_total":0,"min_g":null,"pts_total":0,"pts_g":null,"rbd_total":0,"rbd_g":null,"ast_total":0,"ast_g":null,"stl_total":0,"stl_g":null,"blk_total":0,"blk_g":null,"tres_total":0,"tres_g":null,"tov_total":0,"pf_total":0,"fg_pct":null,"tres_pct":null,"ft_pct":null,"equipos_nba":"","ganancias":0,"primer_partido":null,"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":null,"cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"25 jun 2009","posicion":"Base","nacimiento_fecha":"15 nov 1987"},{"id":"dani-diez","nombre":"Dani Díez","rank":25,"draft":true,"draft_anio":2015,"draft_pick":54,"draft_equipo":"UTA","nacimiento":null,"temporadas":0,"partidos":0,"partidos_titular":0,"min_total":0,"min_g":null,"pts_total":0,"pts_g":null,"rbd_total":0,"rbd_g":null,"ast_total":0,"ast_g":null,"stl_total":0,"stl_g":null,"blk_total":0,"blk_g":null,"tres_total":0,"tres_g":null,"tov_total":0,"pf_total":0,"fg_pct":null,"tres_pct":null,"ft_pct":null,"equipos_nba":"","ganancias":0,"primer_partido":null,"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":null,"cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"25 jun 2015","posicion":"Escolta","nacimiento_fecha":"18 mar 1989"},{"id":"juan-nunez","nombre":"Juan Nuñez","rank":26,"draft":true,"draft_anio":2024,"draft_pick":36,"draft_equipo":"IND","nacimiento":null,"temporadas":0,"partidos":0,"partidos_titular":0,"min_total":0,"min_g":null,"pts_total":0,"pts_g":null,"rbd_total":0,"rbd_g":null,"ast_total":0,"ast_g":null,"stl_total":0,"stl_g":null,"blk_total":0,"blk_g":null,"tres_total":0,"tres_g":null,"tov_total":0,"pf_total":0,"fg_pct":null,"tres_pct":null,"ft_pct":null,"equipos_nba":"","ganancias":0,"primer_partido":null,"premios":[],"records":[],"temporadas_data":[],"playoffs_temporadas":[],"bref_id":null,"cantera":null,"pre_nba":null,"post_nba":[],"summer_league":[],"draft_fecha":"26 jun 2024","posicion":"Base","nacimiento_fecha":"7 ene 2005"}]};
