// ══════════════════════════════════════════════
// TEMA
// ══════════════════════════════════════════════
function initTheme() {
  const stored = localStorage.getItem('ag-theme') || 'auto';
  renderTheme(stored);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('ag-theme') || 'auto') === 'auto') renderTheme('auto');
  });
  buildNav();
  showLoadBar();
}

// ── NAVEGACIÓN GLOBAL ─────────────────────────
const NAV_LINKS = [
  ['Inicio', 'index.html'], ['Jugadores', 'jugadores.html'], ['Draft', 'draft.html'],
  ['Debut', 'debut.html'], ['Carrera', 'ranking.html'], ['Career Highs', 'career-highs.html'],
  ['Transacciones', 'transacciones.html'], ['Premios', 'premios.html'], ['Salarios', 'salarios.html'],
  ['Summer League', 'summer-league.html'], ['Dorsales', 'dorsales.html'],
  ['Línea temporal', 'linea-temporal.html'], ['Temporadas', 'temporadas.html'], ['Comparador', 'comparador.html'], ['Test', 'test.html'],
];
function buildNav() {
  const right = document.querySelector('.header-right');
  if (!right || document.getElementById('nav-menu')) return;
  const here = (location.pathname.split('/').pop() || 'index.html');
  const items = NAV_LINKS.map(([label, href]) =>
    `<a href="${href}" class="nav-item${href === here ? ' current' : ''}">${label}</a>`).join('');
  const wrap = document.createElement('div');
  wrap.className = 'nav-menu';
  wrap.id = 'nav-menu';
  wrap.innerHTML = `
    <button class="nav-toggle" id="nav-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Menú de secciones" onclick="toggleNav(event)">Secciones ▾</button>
    <div class="nav-dropdown" id="nav-dropdown" hidden>${items}</div>`;
  right.insertBefore(wrap, right.firstChild);
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) closeNav();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
}
function toggleNav(e) {
  e && e.stopPropagation();
  const dd = document.getElementById('nav-dropdown'), btn = document.getElementById('nav-toggle');
  const open = dd.hasAttribute('hidden');
  if (open) { dd.removeAttribute('hidden'); btn.setAttribute('aria-expanded', 'true'); }
  else closeNav();
}
function closeNav() {
  const dd = document.getElementById('nav-dropdown'), btn = document.getElementById('nav-toggle');
  if (dd) dd.setAttribute('hidden', '');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// ── BARRA DE CARGA ────────────────────────────
function showLoadBar() {
  if (document.getElementById('load-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'load-bar'; bar.id = 'load-bar';
  document.body.appendChild(bar);
}
function hideLoadBar() {
  const bar = document.getElementById('load-bar');
  if (bar) { bar.classList.add('done'); setTimeout(() => bar.remove(), 400); }
}

function renderTheme(pref) {
  const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const iSun  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-7.5-1.5 1.5m-9 9-1.5 1.5m0-12 1.5 1.5m9 9 1.5 1.5"/></svg>`;
  const iMoon = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const iAuto = `<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>`;
  const labels = { auto: `${iAuto} Auto`, light: `${iSun} Claro`, dark: `${iMoon} Oscuro` };
  const names  = { auto: 'Auto', light: 'Claro', dark: 'Oscuro' };
  btn.innerHTML = labels[pref] || labels.auto;
  btn.setAttribute('aria-label', 'Tema: ' + (names[pref] || names.auto) + '. Pulsa para cambiar');
  btn.dataset.themePref = pref;
}

function cycleTheme() {
  const cur = document.getElementById('theme-toggle')?.dataset.themePref || 'auto';
  const next = { auto: 'dark', dark: 'light', light: 'auto' }[cur] || 'auto';
  localStorage.setItem('ag-theme', next);
  renderTheme(next);
}

// ══════════════════════════════════════════════
// DATOS COMPARTIDOS
// ══════════════════════════════════════════════
// Fotos manuales para jugadores sin bref_id NBA (headshot de bref internacional), por nombre normalizado
const BREF_HEADSHOTS = 'https://www.basketball-reference.com/req/202605210/images/headshots';
const FOTO_OVERRIDES = {
  'sergio llull': `${BREF_HEADSHOTS}/sergio-llull-1.jpg`,
  'fran vazquez': `${BREF_HEADSHOTS}/fran-vazquez-1.jpg`,
  'dani diez':    `${BREF_HEADSHOTS}/daniel-diez-1.jpg`,
};

async function loadData() {
  // Caché de sesión: solo se descarga data.json una vez por pestaña (navegación entre secciones instantánea)
  let data = null;
  try { const c = sessionStorage.getItem('ag-data'); if (c) data = JSON.parse(c); } catch (e) {}
  if (!data) {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('No se pudo cargar data.json');
    data = await res.json();
    try { sessionStorage.setItem('ag-data', JSON.stringify(data)); } catch (e) {}
  }
  (data.jugadores || []).forEach(j => {
    const ov = FOTO_OVERRIDES[drNorm(j.nombre)];
    if (ov) j.foto_url = ov;
  });
  setLastUpdate(data.actualizado);
  hideLoadBar();
  return data;
}

// ── AVATAR CON INICIALES (jugadores sin foto) ─────
function iniciales(nombre) {
  const p = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function avatarColor(nombre) {
  let h = 0; const s = String(nombre || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 50%, 40%)`;
}
function avatarHtml(nombre, cls) {
  return `<span class="${cls} avatar" style="background:${avatarColor(nombre)}" aria-hidden="true">${iniciales(nombre)}</span>`;
}

function setLastUpdate(iso) {
  if (!iso) return;
  const d = new Date(iso);
  if (isNaN(d)) return;
  const timeEl = document.getElementById('ag-last-update');
  if (timeEl) {
    timeEl.setAttribute('datetime', d.toISOString());
    timeEl.textContent = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

// Guarda un parámetro en la URL sin recargar (deep-linking de modos/filtros)
function updateUrlParam(key, value) {
  const url = new URL(location.href);
  if (value == null || value === '') url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  history.replaceState(null, '', url);
}

// Enlaces a la ficha del jugador (nombre → id)
let PLAYER_IDS = {};
function buildPlayerIds(jugadores) {
  PLAYER_IDS = {};
  (jugadores || []).forEach(j => { PLAYER_IDS[drNorm(j.nombre)] = j.id; });
}
// Envuelve `inner` (o el nombre) en un enlace a la ficha si el jugador existe
function plLink(name, inner) {
  const id = PLAYER_IDS[drNorm(name)];
  const content = inner == null ? name : inner;
  return id ? `<a class="pl-link" href="${jugadorHref(id)}">${content}</a>` : content;
}

// ══════════════════════════════════════════════
// HOME · subtítulo dinámico
// ══════════════════════════════════════════════
async function initHome() {
  const sub = document.getElementById('hero-sub');
  let data;
  try { data = await loadData(); }
  catch (e) { return; }   // se mantiene el subtítulo por defecto

  const J = data.jugadores || [];
  const conNBA = J.filter(j => (j.partidos || 0) > 0).length;
  const premios = J.reduce((s, j) => s + ((j.premios || []).length), 0);
  const totalSal = J.reduce((s, j) => s + (j.ganancias || 0), 0);

  const partes = [`${J.length} jugadores`];
  if (conNBA) partes.push(`${conNBA} con partidos NBA`);
  if (premios) partes.push(`${premios} premios`);
  if (totalSal) partes.push(`${fmtDinero(totalSal)} en salarios`);

  if (sub) sub.textContent = partes.join(' · ');
}

// ══════════════════════════════════════════════
// PÁGINA DRAFT
// ══════════════════════════════════════════════
let draftRows = [];
let draftSortCol = 'draft_anio';
let draftSortAsc = true;
let draftSearch = '';
let draftTeam = '';
let draftRound = '';

const DRAFT_COLS = [
  { key: 'rank',         label: '#',       sortable: false, cls: 'td-rank' },
  { key: 'foto',         label: '',        sortable: false },
  { key: 'nombre',       label: 'Jugador', sortable: true },
  { key: 'draft_pick',   label: 'Pick',    sortable: true,  cls: 'td-num' },
  { key: 'draft_equipo', label: 'Equipo',  sortable: true,  cls: 'td-num' },
  { key: 'draft_anio',   label: 'Año',     sortable: true,  cls: 'td-num' },
  { key: 'draft_fecha',  label: 'Fecha',   sortable: false, cls: 'td-num' },
  { key: 'notas',        label: 'Notas',   sortable: false, cls: 'td-notas' },
];

async function initDraftPage() {
  let jugadores;
  try {
    jugadores = (await loadData()).jugadores || [];
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

  buildPlayerIds(jugadores);
  draftRows = jugadores.filter(j => j.draft);
  const undrafted = jugadores.filter(j => !j.draft);

  document.getElementById('hero-sub').textContent =
    `${draftRows.length} elegidos · ${undrafted.length} undrafted · ${jugadores.length} jugadores en total`;

  // Filtro por franquicia
  const teams = [...new Set(draftRows.map(j => j.draft_equipo).filter(Boolean))].sort();
  document.getElementById('draft-team').innerHTML =
    '<option value="">Todas las franquicias</option>' + teams.map(t => `<option value="${t}">${t}</option>`).join('');
  document.getElementById('draft-search').addEventListener('input', e => { draftSearch = e.target.value.trim().toLowerCase(); renderDraftTable(); });
  document.getElementById('draft-team').addEventListener('change', e => { draftTeam = e.target.value; renderDraftTable(); });
  document.getElementById('draft-round').addEventListener('change', e => { draftRound = e.target.value; renderDraftTable(); });

  renderDraftKpis();
  renderDraftTable();
  renderUndrafted(undrafted);
}

function renderDraftKpis() {
  // Pick más alto (número más bajo)
  const best = [...draftRows].sort((a, b) => a.draft_pick - b.draft_pick)[0];

  // Año(s) con más elegidos
  const porAnio = {};
  draftRows.forEach(j => { porAnio[j.draft_anio] = (porAnio[j.draft_anio] || 0) + 1; });
  const maxCount = Math.max(...Object.values(porAnio));
  const topAnios = Object.keys(porAnio).filter(a => porAnio[a] === maxCount).sort();

  // Equipos distintos que han elegido a un español
  const equipos = new Set(draftRows.map(j => j.draft_equipo).filter(Boolean));

  document.getElementById('draft-kpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-num">${best.nombre} #${best.draft_pick}</div>
      <div class="kpi-label">Pick más alto</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${topAnios.join(' · ')}</div>
      <div class="kpi-label">Año con más elegidos (${maxCount})</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${equipos.size}</div>
      <div class="kpi-label">Equipos con un español</div>
    </div>`;
}

function renderDraftTable() {
  const rows = draftRows.filter(j => {
    if (draftTeam && j.draft_equipo !== draftTeam) return false;
    if (draftSearch && !j.nombre.toLowerCase().includes(draftSearch)) return false;
    const pick = j.draft_pick || 0;
    if (draftRound === 'lottery' && !(pick >= 1 && pick <= 14)) return false;
    if (draftRound === 'first' && !(pick >= 1 && pick <= 30)) return false;
    if (draftRound === 'second' && !(pick >= 31)) return false;
    return true;
  }).sort((a, b) => {
    const va = a[draftSortCol], vb = b[draftSortCol];
    if (typeof va === 'string') return draftSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return draftSortAsc ? va - vb : vb - va;
  });

  const countEl = document.getElementById('draft-count');
  if (countEl) countEl.textContent = `${rows.length} elegido${rows.length === 1 ? '' : 's'}`;

  const bestPick = Math.min(...draftRows.map(j => j.draft_pick || Infinity));

  document.getElementById('draft-thead').innerHTML = `<tr>
    ${DRAFT_COLS.map(c => {
      if (!c.sortable) return `<th scope="col" class="${c.cls || ''}">${c.label}</th>`;
      const active = draftSortCol === c.key;
      const ariaSort = active ? (draftSortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (draftSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortDraft('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('draft-body').innerHTML = rows.map((j, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.foto_url || j.bref_id) ? `<img loading="lazy" class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : avatarHtml(j.nombre, 'player-thumb')}</a></td>
      <td class="td-nombre">${plLink(j.nombre, j.nombre)}</td>
      <td class="td-num td-pick${j.draft_pick === bestPick ? ' td-leader' : ''}">#${j.draft_pick}</td>
      <td class="td-num">${j.draft_equipo || '—'}</td>
      <td class="td-num">${j.draft_anio}</td>
      <td class="td-num td-muted">${j.draft_fecha || '—'}</td>
      <td class="td-muted td-notas">${j.draft_notas || j.notas || '—'}</td>
    </tr>`).join('');
}

function sortDraft(col) {
  if (draftSortCol === col) draftSortAsc = !draftSortAsc;
  else { draftSortCol = col; draftSortAsc = true; }
  renderDraftTable();
}

function renderUndrafted(undrafted) {
  document.getElementById('undrafted-grid').innerHTML = undrafted.map(j => {
    const debutAnio = (j.primer_partido?.fecha || '').match(/\d{4}/)?.[0];
    return `
    <a class="undrafted-card pl-link" href="${jugadorHref(j.id)}">
      <div class="undrafted-nombre">${j.nombre}</div>
      <div class="undrafted-meta">${j.posicion || ''}${debutAnio ? ` · Debut ${debutAnio}` : ''}</div>
    </a>`;
  }).join('') || '<p class="td-muted">No hay jugadores undrafted.</p>';
}

// ══════════════════════════════════════════════
// PÁGINA SALARIOS
// ══════════════════════════════════════════════
let salRows = [];
let salSortCol = 'ganancias';
let salSortAsc = false;

const SAL_COLS = [
  { key: 'rank',             label: '#',         sortable: false, cls: 'td-rank' },
  { key: 'foto',             label: '',          sortable: false },
  { key: 'nombre',           label: 'Jugador',   sortable: true },
  { key: 'ganancias',        label: 'Total',     sortable: true,  cls: 'td-num' },
  { key: 'ganancias_ganado', label: 'Cobrado',   sortable: true,  cls: 'td-num' },
  { key: 'ganancias_futuro', label: 'Firmado',   sortable: true,  cls: 'td-num' },
  { key: 'sueldo_pj',        label: '$/PAR',     sortable: true,  cls: 'td-num' },
  { key: 'pct',              label: '% del total', sortable: true,  cls: 'td-num' },
  { key: 'equipos',          label: 'Equipos',   sortable: false },
];

const ROOKIES_CONTRATO = ['Sergio De Larrea', 'Baba Miller', 'Aday Mara'];

function fmtDinero(n) {
  if (!n) return '—';
  return '$' + Math.round(n).toLocaleString('es-ES');
}

async function initSalariosPage() {
  let jugadores;
  try {
    jugadores = (await loadData()).jugadores || [];
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

  buildPlayerIds(jugadores);
  // Debutados en la NBA o con contrato firmado (los tres rookies)
  salRows = jugadores.filter(j => (j.partidos || 0) > 0 || ROOKIES_CONTRATO.includes(j.nombre));

  // % = cuota de cada jugador sobre el total ganado por todos los españoles
  const granTotal = salRows.reduce((s, j) => s + (j.ganancias || 0), 0);
  salRows.forEach(j => {
    j.pct = granTotal ? j.ganancias / granTotal * 100 : null;
    j.sueldo_pj = (j.partidos || 0) > 0 ? (j.ganancias_ganado || 0) / j.partidos : null;
  });

  document.getElementById('hero-sub').textContent =
    `${salRows.length} jugadores con contrato o carrera NBA · Ganancias brutas de carrera (USD)`;

  renderSalariosKpis();
  renderSalariosTable();
}

function renderSalariosKpis() {
  const total = salRows.reduce((s, j) => s + (j.ganancias || 0), 0);
  const gasol = salRows
    .filter(j => j.nombre === 'Pau Gasol' || j.nombre === 'Marc Gasol')
    .reduce((s, j) => s + (j.ganancias || 0), 0);
  const pctGasol = total ? Math.round(gasol / total * 1000) / 10 : 0;

  // Cobrado por partido, agregado de todos los españoles
  const totCobrado  = salRows.reduce((s, j) => s + (j.ganancias_ganado || 0), 0);
  const totPartidos = salRows.reduce((s, j) => s + (j.partidos || 0), 0);
  const kpi2 = totPartidos
    ? `<div class="kpi">
         <div class="kpi-num">${fmtDinero(totCobrado / totPartidos)}</div>
         <div class="kpi-label">Cobrado por partido jugado</div>
       </div>`
    : '';

  document.getElementById('sal-kpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-num">${fmtDinero(total)}</div>
      <div class="kpi-label">Total acumulado</div>
    </div>
    ${kpi2}
    <div class="kpi">
      <div class="kpi-num">${pctGasol}%</div>
      <div class="kpi-label">De la familia Gasol</div>
    </div>`;
}

function renderSalariosTable() {
  const rows = [...salRows].sort((a, b) => {
    let va = a[salSortCol], vb = b[salSortCol];
    if (['ganancias', 'ganancias_ganado', 'ganancias_futuro', 'sueldo_pj', 'pct'].includes(salSortCol)) {
      va = va ?? -1; vb = vb ?? -1;
    }
    if (typeof va === 'string') return salSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return salSortAsc ? va - vb : vb - va;
  });

  document.getElementById('sal-thead').innerHTML = `<tr>
    ${SAL_COLS.map(c => {
      if (!c.sortable) return `<th scope="col" class="${c.cls || ''}">${c.label}</th>`;
      const active = salSortCol === c.key;
      const ariaSort = active ? (salSortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (salSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortSal('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  // barra escalada respecto a la mayor cuota (el líder llena la barra)
  const maxPct = Math.max(...salRows.map(j => j.pct || 0), 0);
  const maxGan = Math.max(...salRows.map(j => j.ganancias || 0), 0);
  const maxSpj = Math.max(...salRows.map(j => j.sueldo_pj || 0), 0);

  document.getElementById('sal-body').innerHTML = rows.map((j, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.foto_url || j.bref_id) ? `<img loading="lazy" class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : avatarHtml(j.nombre, 'player-thumb')}</a></td>
      <td class="td-nombre">${plLink(j.nombre, j.nombre)}</td>
      <td class="td-num td-dinero${maxGan && j.ganancias === maxGan ? ' td-leader' : ''}">${fmtDinero(j.ganancias)}</td>
      <td class="td-num td-muted">${fmtDinero(j.ganancias_ganado)}</td>
      <td class="td-num td-muted">${fmtDinero(j.ganancias_futuro)}</td>
      <td class="td-num${maxSpj && j.sueldo_pj === maxSpj ? ' td-leader' : ''}">${fmtDinero(j.sueldo_pj)}</td>
      <td class="td-num">${renderPct(j.pct, maxPct ? (j.pct || 0) / maxPct * 100 : 0)}</td>
      <td class="td-muted">${j.equipos_nba || '—'}</td>
    </tr>`).join('');

  // Pie: totales
  const tTotal    = salRows.reduce((s, j) => s + (j.ganancias || 0), 0);
  const tCobrado  = salRows.reduce((s, j) => s + (j.ganancias_ganado || 0), 0);
  const tFuturo   = salRows.reduce((s, j) => s + (j.ganancias_futuro || 0), 0);
  const tPartidos = salRows.reduce((s, j) => s + (j.partidos || 0), 0);

  document.getElementById('sal-foot').innerHTML = `
    <tr class="sal-total">
      <td></td><td></td>
      <td class="td-nombre">TOTAL (${salRows.length})</td>
      <td class="td-num td-dinero">${fmtDinero(tTotal)}</td>
      <td class="td-num">${fmtDinero(tCobrado)}</td>
      <td class="td-num">${fmtDinero(tFuturo)}</td>
      <td class="td-num">${fmtDinero(tPartidos ? tCobrado / tPartidos : 0)}</td>
      <td class="td-num">${renderPct(100, 100)}</td>
      <td></td>
    </tr>`;
}

function renderPct(pct, barWidth) {
  if (pct === null || pct === undefined) return '<span class="td-muted">—</span>';
  const w = barWidth === undefined ? pct : barWidth;
  return `<div class="pct-wrap">
    <span class="pct-val">${pct.toFixed(1)}%</span>
    <span class="pct-bar"><span class="pct-fill" style="width:${w}%"></span></span>
  </div>`;
}

function sortSal(col) {
  if (salSortCol === col) salSortAsc = !salSortAsc;
  else { salSortCol = col; salSortAsc = (col === 'nombre' || col === 'equipos'); }
  renderSalariosTable();
}

// ══════════════════════════════════════════════
// PÁGINA SUMMER LEAGUE
// ══════════════════════════════════════════════
let slAll = [];
let slSortCol = 'year';
let slSortAsc = false;
let slSearch = '';
let slYear = '';
let slGroup = '';   // '' | 'player' | 'year'

const SL_COLS = [
  { key: 'rank',    label: '#',       sortable: false, cls: 'td-rank' },
  { key: 'jugador', label: 'Jugador', sortable: true },
  { key: 'year',    label: 'Año',     sortable: true,  cls: 'td-num' },
  { key: 'equipo',  label: 'Equipo',  sortable: true,  cls: 'td-center' },
];

const SL_COLS_YEAR = [
  { key: 'rank',      label: '#',              sortable: false, cls: 'td-rank' },
  { key: 'year',      label: 'Año',            sortable: true,  cls: 'td-num' },
  { key: 'count',     label: 'Participaciones', sortable: true, cls: 'td-num' },
  { key: 'jugadores', label: 'Jugadores',      sortable: false },
];

const SL_COLS_GROUP = [
  { key: 'rank',    label: '#',              sortable: false, cls: 'td-rank' },
  { key: 'jugador', label: 'Jugador',        sortable: true },
  { key: 'count',   label: 'Participaciones', sortable: true, cls: 'td-num' },
  { key: 'years',   label: 'Años',           sortable: true,  cls: 'td-num' },
  { key: 'equipos', label: 'Equipos',        sortable: false, cls: 'td-center' },
];

async function initSummerPage() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

  // Lista propia (incluye jugadores no-NBA). Compat: si viniera por-jugador, se aplana.
  buildPlayerIds(data.jugadores);
  slAll = (data.summer_league || []).slice();
  if (!slAll.length) {
    slAll = (data.jugadores || []).flatMap(j =>
      (j.summer_league || []).map(s => ({ year: s.year, equipo: s.equipo || s.team, jugador: j.nombre })));
  }
  slAll = slAll.filter(s => s.jugador && (s.year || s.equipo));

  renderSlKpis();
  buildSlYearFilter();

  // Agrupación desde la URL (?grupo=player|year)
  const grupo = new URLSearchParams(location.search).get('grupo');
  if (grupo === 'player' || grupo === 'year') {
    slGroup = grupo;
    slSortCol = 'count';
    syncSlGroupButtons();
  }

  document.getElementById('sl-search').addEventListener('input', e => { slSearch = e.target.value.trim().toLowerCase(); renderSlTable(); });
  document.getElementById('sl-year').addEventListener('change', e => { slYear = e.target.value; renderSlTable(); });

  renderSlTable();
}

function syncSlGroupButtons() {
  const bp = document.getElementById('sl-group-player');
  const by = document.getElementById('sl-group-year');
  if (!bp || !by) return;
  bp.classList.toggle('active', slGroup === 'player');
  bp.setAttribute('aria-pressed', String(slGroup === 'player'));
  by.classList.toggle('active', slGroup === 'year');
  by.setAttribute('aria-pressed', String(slGroup === 'year'));
}

function renderSlKpis() {
  const participaciones = slAll.length;
  const jugadores = new Set(slAll.map(s => s.jugador)).size;
  const porAnio = {};
  slAll.forEach(s => { if (s.year) porAnio[s.year] = (porAnio[s.year] || 0) + 1; });
  const maxCount = Math.max(0, ...Object.values(porAnio));
  const topAnios = Object.keys(porAnio).filter(a => porAnio[a] === maxCount).sort();

  document.getElementById('sl-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-num">${participaciones}</div><div class="kpi-label">Participaciones</div></div>
    <div class="kpi"><div class="kpi-num">${jugadores}</div><div class="kpi-label">Jugadores distintos</div></div>
    <div class="kpi"><div class="kpi-num">${topAnios.join(' · ') || '—'}</div><div class="kpi-label">Año con más${maxCount ? ` (${maxCount})` : ''}</div></div>`;
}

function buildSlYearFilter() {
  const years = [...new Set(slAll.map(s => s.year).filter(Boolean))].sort((a, b) => b - a);
  document.getElementById('sl-year').innerHTML =
    '<option value="">Todos los años</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function setSlGroup(mode) {
  slGroup = (slGroup === mode) ? '' : mode;   // clic en el activo lo desactiva
  syncSlGroupButtons();
  // orden por defecto de cada modo
  slSortCol = slGroup ? 'count' : 'year';
  slSortAsc = false;
  updateUrlParam('grupo', slGroup);
  renderSlTable();
}

function renderSlTable() {
  const filtered = slAll.filter(s => {
    if (slYear && String(s.year) !== slYear) return false;
    if (slSearch) {
      const hay = `${s.jugador} ${s.equipo || ''}`.toLowerCase();
      if (!hay.includes(slSearch)) return false;
    }
    return true;
  });

  if (slGroup === 'player') return renderSlGrouped(filtered);
  if (slGroup === 'year') return renderSlGroupedYear(filtered);
  return renderSlFlat(filtered);
}

function renderSlHead(cols) {
  document.getElementById('sl-thead').innerHTML = `<tr>
    ${cols.map(c => {
      if (!c.sortable) return `<th scope="col" class="${c.cls || ''}">${c.label}</th>`;
      const active = slSortCol === c.key;
      const ariaSort = active ? (slSortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (slSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortSl('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;
}

function renderSlFlat(rows) {
  rows = [...rows].sort((a, b) => {
    let va = a[slSortCol], vb = b[slSortCol];
    if (slSortCol === 'year') { va = va || 0; vb = vb || 0; return slSortAsc ? va - vb : vb - va; }
    va = String(va || ''); vb = String(vb || '');
    return slSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  document.getElementById('sl-count').textContent =
    `${rows.length} participaci${rows.length === 1 ? 'ón' : 'ones'}`;

  renderSlHead(SL_COLS);
  document.getElementById('sl-body').innerHTML = rows.map((s, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-nombre">${plLink(s.jugador, s.jugador)}</td>
      <td class="td-num">${s.year || '—'}</td>
      <td class="td-center">${s.equipo || '—'}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function renderSlGrouped(entries) {
  const map = {};
  entries.forEach(s => {
    const g = map[s.jugador] || (map[s.jugador] = { jugador: s.jugador, years: [], equipos: [] });
    if (s.year) g.years.push(s.year);
    if (s.equipo) g.equipos.push(s.equipo);
  });

  let rows = Object.values(map).map(g => {
    const years = [...new Set(g.years)].sort((a, b) => a - b);
    return {
      jugador: g.jugador,
      count: g.years.length || g.equipos.length,
      years,
      maxYear: years.length ? years[years.length - 1] : 0,
      equipos: [...new Set(g.equipos)],
    };
  });

  rows.sort((a, b) => {
    if (slSortCol === 'jugador') return slSortAsc ? a.jugador.localeCompare(b.jugador) : b.jugador.localeCompare(a.jugador);
    if (slSortCol === 'equipos') return slSortAsc ? a.equipos.length - b.equipos.length : b.equipos.length - a.equipos.length;
    // count o years (por año más reciente)
    const va = slSortCol === 'years' ? a.maxYear : a.count;
    const vb = slSortCol === 'years' ? b.maxYear : b.count;
    return slSortAsc ? va - vb : (vb - va) || a.jugador.localeCompare(b.jugador);
  });

  document.getElementById('sl-count').textContent =
    `${rows.length} jugador${rows.length === 1 ? '' : 'es'}`;

  renderSlHead(SL_COLS_GROUP);
  document.getElementById('sl-body').innerHTML = rows.map((g, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-nombre">${plLink(g.jugador, g.jugador)}</td>
      <td class="td-num">${g.count}</td>
      <td class="td-num">${g.years.join(', ') || '—'}</td>
      <td class="td-center">${g.equipos.join(', ') || '—'}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function renderSlGroupedYear(entries) {
  const map = {};
  entries.forEach(s => {
    if (!s.year) return;
    const g = map[s.year] || (map[s.year] = { year: s.year, jugadores: [] });
    g.jugadores.push({ nombre: s.jugador, equipo: s.equipo });
  });

  let rows = Object.values(map).map(g => ({
    year: g.year,
    count: g.jugadores.length,
    jugadores: g.jugadores,
  }));

  rows.sort((a, b) => {
    if (slSortCol === 'count') return slSortAsc ? a.count - b.count : (b.count - a.count) || b.year - a.year;
    // por defecto y 'year'
    return slSortAsc ? a.year - b.year : b.year - a.year;
  });

  document.getElementById('sl-count').textContent = `${rows.length} año${rows.length === 1 ? '' : 's'}`;

  renderSlHead(SL_COLS_YEAR);
  document.getElementById('sl-body').innerHTML = rows.map((g, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-num">${g.year}</td>
      <td class="td-num">${g.count}</td>
      <td>${g.jugadores.map(j => `${plLink(j.nombre, j.nombre)}${j.equipo ? ` (${j.equipo})` : ''}`).join(', ')}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function sortSl(col) {
  if (slSortCol === col) slSortAsc = !slSortAsc;
  else { slSortCol = col; slSortAsc = (col === 'jugador'); }
  renderSlTable();
}

// ══════════════════════════════════════════════
// PÁGINA PREMIOS
// ══════════════════════════════════════════════
let prAll = [];
let prSortCol = 'tipo';   // por defecto ordenado por importancia del premio
let prSortAsc = true;
let prSearch = '';
let prTipo = '';
let prYear = '';
let prGroup = '';   // '' | 'player' | 'tipo'

const PR_COLS = [
  { key: 'rank',    label: '#',       sortable: false, cls: 'td-rank' },
  { key: 'jugador', label: 'Jugador', sortable: true },
  { key: 'year',    label: 'Año',     sortable: true,  cls: 'td-num' },
  { key: 'team',    label: 'Equipo',  sortable: true,  cls: 'td-center' },
  { key: 'tipo',    label: 'Premio',  sortable: true },
  { key: 'notas',   label: 'Notas',   sortable: false, cls: 'td-notas' },
];

const PR_COLS_GROUP = [
  { key: 'rank',    label: '#',       sortable: false, cls: 'td-rank' },
  { key: 'jugador', label: 'Jugador', sortable: true },
  { key: 'count',   label: 'Premios', sortable: true,  cls: 'td-num' },
  { key: 'desglose', label: 'Palmarés', sortable: false },
];

const PR_COLS_TIPO = [
  { key: 'rank',      label: '#',        sortable: false, cls: 'td-rank' },
  { key: 'tipo',      label: 'Premio',   sortable: true },
  { key: 'count',     label: 'Veces',    sortable: true,  cls: 'td-num' },
  { key: 'jugadores', label: 'Jugadores', sortable: false },
];

async function initPremiosPage() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

  buildPlayerIds(data.jugadores);
  prAll = (data.jugadores || []).flatMap(j =>
    (j.premios || []).map(p => ({
      tipo: p.tipo,
      year: p.year || null,
      team: p.team || '',
      // notas: campo propio, o detalle si aporta algo distinto del tipo
      notas: p.notas || (p.detalle && p.detalle !== p.tipo ? p.detalle : ''),
      jugador: j.nombre,
    }))).filter(p => p.tipo);

  const laureados = new Set(prAll.map(p => p.jugador)).size;
  document.getElementById('hero-sub').textContent =
    prAll.length ? `${prAll.length} reconocimientos individuales · ${laureados} jugadores premiados` : 'Aún no hay datos de premios';

  renderPrKpis();
  buildPrFilters();

  document.getElementById('pr-search').addEventListener('input', e => { prSearch = e.target.value.trim().toLowerCase(); renderPrTable(); });
  document.getElementById('pr-tipo').addEventListener('change', e => { prTipo = e.target.value; renderPrTable(); });
  document.getElementById('pr-year').addEventListener('change', e => { prYear = e.target.value; renderPrTable(); });

  renderPrTable();
}

function renderPrKpis() {
  const total = prAll.length;
  const porJug = {};
  prAll.forEach(p => { porJug[p.jugador] = (porJug[p.jugador] || 0) + 1; });
  const top = Object.entries(porJug).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
  const allStars = prAll.filter(p => /all[\s-]?star/i.test(p.tipo)).length;

  document.getElementById('pr-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-num">${total}</div><div class="kpi-label">Premios totales</div></div>
    <div class="kpi"><div class="kpi-num">${top[1]}</div><div class="kpi-label">Más laureado · ${top[0]}</div></div>
    <div class="kpi"><div class="kpi-num">${allStars}</div><div class="kpi-label">Selecciones All-Star</div></div>`;
}

function buildPrFilters() {
  const tipos = [...new Set(prAll.map(p => p.tipo))].sort();
  document.getElementById('pr-tipo').innerHTML =
    '<option value="">Todos los tipos</option>' + tipos.map(t => `<option value="${t}">${t}</option>`).join('');
  const years = [...new Set(prAll.map(p => p.year).filter(Boolean))].sort((a, b) => b - a);
  document.getElementById('pr-year').innerHTML =
    '<option value="">Todos los años</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function setPrGroup(mode) {
  prGroup = (prGroup === mode) ? '' : mode;
  const bp = document.getElementById('pr-group-player');
  const bt = document.getElementById('pr-group-tipo');
  bp.classList.toggle('active', prGroup === 'player');
  bp.setAttribute('aria-pressed', String(prGroup === 'player'));
  bt.classList.toggle('active', prGroup === 'tipo');
  bt.setAttribute('aria-pressed', String(prGroup === 'tipo'));
  prSortCol = prGroup ? 'count' : 'tipo';
  prSortAsc = !prGroup;   // sin agrupar: por importancia (asc); agrupado: por count (desc)
  renderPrTable();
}

function renderPrTable() {
  const filtered = prAll.filter(p => {
    if (prTipo && p.tipo !== prTipo) return false;
    if (prYear && String(p.year) !== prYear) return false;
    if (prSearch && !p.jugador.toLowerCase().includes(prSearch)) return false;
    return true;
  });
  if (prGroup === 'player') return renderPrGrouped(filtered);
  if (prGroup === 'tipo') return renderPrGroupedTipo(filtered);
  return renderPrFlat(filtered);
}

function renderPrHead(cols, sortCol, sortAsc) {
  document.getElementById('pr-thead').innerHTML = `<tr>
    ${cols.map(c => {
      if (!c.sortable) return `<th scope="col" class="${c.cls || ''}">${c.label}</th>`;
      const active = sortCol === c.key;
      const ariaSort = active ? (sortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (sortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortPr('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;
}

function renderPrFlat(rows) {
  rows = [...rows].sort((a, b) => {
    if (prSortCol === 'year') { const va = a.year || 0, vb = b.year || 0; return prSortAsc ? va - vb : vb - va; }
    if (prSortCol === 'tipo') {
      const pa = premioPrio(a.tipo), pb = premioPrio(b.tipo);
      if (pa !== pb) return prSortAsc ? pa - pb : pb - pa;
      return (b.year || 0) - (a.year || 0) || a.jugador.localeCompare(b.jugador);   // desempate: año ↓, jugador
    }
    const va = String(a[prSortCol] || ''), vb = String(b[prSortCol] || '');
    return prSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  document.getElementById('pr-count').textContent = `${rows.length} premio${rows.length === 1 ? '' : 's'}`;
  renderPrHead(PR_COLS, prSortCol, prSortAsc);
  document.getElementById('pr-body').innerHTML = rows.map((p, i) => `
    <tr class="${premioRowClass(p.tipo)}">
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-nombre">${plLink(p.jugador, p.jugador)}</td>
      <td class="td-num">${p.year || '—'}</td>
      <td class="td-center">${p.team || '—'}</td>
      <td>${p.tipo}</td>
      <td class="td-muted td-notas">${p.notas || '—'}</td>
    </tr>`).join('') || `<tr><td colspan="6" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function premioRowClass(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t === 'roy' || t === 'dpoy') return 'row-oro';
  if (t === 'all nba' || t === 'all defense') return 'row-verde';
  return '';
}

// Orden de importancia (menor índice = más importante, arriba). Concursos siempre al final.
// 'mvp' aquí = votos al MVP (no ganado), va en medio, no en cabeza
const PREMIO_ORDEN = ['dpoy', 'roy', 'all nba', 'all defense', 'all rookie', 'mvp', 'player of the month', 'rookie of the month', 'all star', 'rising stars'];
function premioPrio(tipo) {
  const t = drNorm(tipo).replace(/[^a-z0-9]+/g, ' ').trim();
  if (/concurso|triples?|mate|dunk|skill|habilidad/.test(t)) return 90;   // concursos: lo último
  for (let i = 0; i < PREMIO_ORDEN.length; i++) if (t.includes(PREMIO_ORDEN[i])) return i;
  return 50;   // desconocidos, en medio
}

function renderPrGrouped(entries) {
  const map = {};
  entries.forEach(p => {
    const g = map[p.jugador] || (map[p.jugador] = { jugador: p.jugador, count: 0, tipos: {} });
    g.count++;
    g.tipos[p.tipo] = (g.tipos[p.tipo] || 0) + 1;
  });

  let rows = Object.values(map).map(g => ({
    jugador: g.jugador,
    count: g.count,
    desglose: Object.entries(g.tipos).sort((a, b) => b[1] - a[1])
      .map(([t, n]) => n > 1 ? `${t} ×${n}` : t).join(', '),
  }));

  rows.sort((a, b) => {
    if (prSortCol === 'jugador') return prSortAsc ? a.jugador.localeCompare(b.jugador) : b.jugador.localeCompare(a.jugador);
    return prSortAsc ? a.count - b.count : (b.count - a.count) || a.jugador.localeCompare(b.jugador);
  });

  document.getElementById('pr-count').textContent = `${rows.length} jugador${rows.length === 1 ? '' : 'es'}`;
  renderPrHead(PR_COLS_GROUP, prSortCol, prSortAsc);
  document.getElementById('pr-body').innerHTML = rows.map((g, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-nombre">${plLink(g.jugador, g.jugador)}</td>
      <td class="td-num">${g.count}</td>
      <td>${g.desglose}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function renderPrGroupedTipo(entries) {
  const map = {};
  entries.forEach(p => {
    const g = map[p.tipo] || (map[p.tipo] = { tipo: p.tipo, count: 0, jugadores: {} });
    g.count++;
    g.jugadores[p.jugador] = (g.jugadores[p.jugador] || 0) + 1;
  });

  let rows = Object.values(map).map(g => ({
    tipo: g.tipo,
    count: g.count,
    jugadores: Object.entries(g.jugadores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  }));

  rows.sort((a, b) => {
    if (prSortCol === 'tipo') { const pa = premioPrio(a.tipo), pb = premioPrio(b.tipo); return prSortAsc ? pa - pb : pb - pa; }
    return prSortAsc ? a.count - b.count : (b.count - a.count) || a.tipo.localeCompare(b.tipo);
  });

  document.getElementById('pr-count').textContent = `${rows.length} tipo${rows.length === 1 ? '' : 's'} de premio`;
  renderPrHead(PR_COLS_TIPO, prSortCol, prSortAsc);
  document.getElementById('pr-body').innerHTML = rows.map((g, i) => {
    const jl = g.jugadores.map(([jug, n]) => `${plLink(jug, jug)}${n > 1 ? ` ×${n}` : ''}`).join(', ');
    return `<tr class="${premioRowClass(g.tipo)}">
      <td class="td-rank td-muted">${i + 1}</td>
      <td>${g.tipo}</td>
      <td class="td-num">${g.count}</td>
      <td>${jl}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="4" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function sortPr(col) {
  if (prSortCol === col) prSortAsc = !prSortAsc;
  else { prSortCol = col; prSortAsc = (col === 'jugador' || col === 'tipo' || col === 'team'); }
  renderPrTable();
}

// ══════════════════════════════════════════════
// PÁGINA RANKING
// ══════════════════════════════════════════════
let rkAll = [];
let rkMode = 'pg';          // 'pg' (por partido) | 'tot' (totales)
let rkSortCol = 'pts_g';
let rkSortAsc = false;
let rkSearch = '';
let rkRanks = {};           // { statKey: { playerId: posición } }

const RK_STAT_KEYS = [
  'partidos', 'partidos_titular', 'pct_gs', 'min_g', 'pts_g', 'rbd_g', 'ast_g', 'stl_g', 'blk_g', 'fg_pct', 'tres_pct', 'ft_pct',
  'min_total', 'pts_total', 'rbd_total', 'ast_total', 'stl_total', 'blk_total', 'tres_total', 'tov_total', 'td_total',
];

const RK_COLS_PG = [
  { key: 'rank',      label: '#',   sortable: false, cls: 'td-rank' },
  { key: 'foto',      label: '',    sortable: false },
  { key: 'nombre',    label: 'Jugador', sortable: true, cls: 'td-nombre' },
  { key: 'partidos',  label: 'GP',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'min_g',     label: 'MIN', sortable: true, cls: 'td-num', fmt: fmtDec1 },
  { key: 'pts_g',     label: 'PTS', sortable: true, cls: 'td-num', fmt: fmtDec1 },
  { key: 'rbd_g',     label: 'REB', sortable: true, cls: 'td-num', fmt: fmtDec1 },
  { key: 'ast_g',     label: 'AST', sortable: true, cls: 'td-num', fmt: fmtDec1 },
  { key: 'stl_g',     label: 'ROB', sortable: true, cls: 'td-num', fmt: fmtDec1 },
  { key: 'blk_g',     label: 'TAP', sortable: true, cls: 'td-num', fmt: fmtDec1 },
  { key: 'fg_pct',    label: 'FG%', sortable: true, cls: 'td-num', fmt: fmtPct },
  { key: 'tres_pct',  label: '3P%', sortable: true, cls: 'td-num', fmt: fmtPct },
  { key: 'ft_pct',    label: 'FT%', sortable: true, cls: 'td-num', fmt: fmtPct },
];

const RK_COLS_TOT = [
  { key: 'rank',        label: '#',    sortable: false, cls: 'td-rank' },
  { key: 'foto',        label: '',     sortable: false },
  { key: 'nombre',      label: 'Jugador', sortable: true, cls: 'td-nombre' },
  { key: 'partidos',         label: 'GP',   sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'partidos_titular', label: 'GS',   sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'pct_gs',           label: '%GS',  sortable: true, cls: 'td-num', fmt: fmtPct },
  { key: 'min_total',   label: 'MIN',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'pts_total',   label: 'PTS',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'rbd_total',   label: 'REB',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'ast_total',   label: 'AST',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'stl_total',   label: 'ROB',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'blk_total',   label: 'TAP',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'tres_total',  label: '3PM',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'tov_total',   label: 'TOV', sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'td_total',    label: 'TD',  sortable: true, cls: 'td-num', fmt: fmtEnt },
];

function fmtEnt(n)  { return (n || n === 0) ? Math.round(n).toLocaleString('es-ES') : '—'; }
function fmtDec1(n) { return (n || n === 0) ? n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'; }
function fmtPct(n)  { return (n || n === 0) ? (n * 100).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—'; }

async function initRankingPage() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

  rkAll = (data.jugadores || []).filter(j => (j.partidos || 0) > 0);
  rkAll.forEach(j => { j.pct_gs = j.partidos ? (j.partidos_titular || 0) / j.partidos : 0; });
  buildPlayerIds(data.jugadores);
  buildRkRanks();

  // Modo desde la URL (?modo=totales)
  const modo = new URLSearchParams(location.search).get('modo');
  if (modo === 'totales' || modo === 'tot') rkMode = 'tot';
  rkSortCol = rkMode === 'pg' ? 'pts_g' : 'pts_total';
  syncRkModeButtons();

  document.getElementById('hero-sub').textContent =
    `${rkAll.length} jugadores con partidos en la NBA · Estadísticas de carrera`;

  renderRkKpis();
  document.getElementById('rk-search').addEventListener('input', e => { rkSearch = e.target.value.trim().toLowerCase(); renderRkTable(); });
  renderRkTable();
}

function renderRkKpis() {
  const leader = (k) => [...rkAll].sort((a, b) => (b[k] || 0) - (a[k] || 0))[0] || {};
  const anot = leader('pts_total');
  const asist = leader('ast_total');

  document.getElementById('rk-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-num">${rkAll.length}</div><div class="kpi-label">Jugadores</div></div>
    <div class="kpi"><div class="kpi-num">${fmtEnt(anot.pts_total)}</div><div class="kpi-label">Máximo anotador · ${anot.nombre || '—'}</div></div>
    <div class="kpi"><div class="kpi-num">${fmtEnt(asist.ast_total)}</div><div class="kpi-label">Más asistencias · ${asist.nombre || '—'}</div></div>`;
}

function syncRkModeButtons() {
  const pg = document.getElementById('rk-mode-pg'), tot = document.getElementById('rk-mode-tot');
  if (!pg || !tot) return;
  pg.classList.toggle('active', rkMode === 'pg'); pg.setAttribute('aria-pressed', String(rkMode === 'pg'));
  tot.classList.toggle('active', rkMode === 'tot'); tot.setAttribute('aria-pressed', String(rkMode === 'tot'));
}

function setRkMode(mode) {
  if (rkMode === mode) return;
  rkMode = mode;
  syncRkModeButtons();
  rkSortCol = mode === 'pg' ? 'pts_g' : 'pts_total';
  rkSortAsc = false;
  updateUrlParam('modo', mode === 'tot' ? 'totales' : 'partido');
  renderRkTable();
}

function renderRkTable() {
  const cols = rkMode === 'pg' ? RK_COLS_PG : RK_COLS_TOT;

  let rows = rkAll.filter(j => !rkSearch || j.nombre.toLowerCase().includes(rkSearch));
  rows.sort((a, b) => {
    if (rkSortCol === 'nombre') return rkSortAsc ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre);
    const va = a[rkSortCol] || 0, vb = b[rkSortCol] || 0;
    return rkSortAsc ? va - vb : vb - va;
  });

  document.getElementById('rk-count').textContent = `${rows.length} jugador${rows.length === 1 ? '' : 'es'}`;

  document.getElementById('rk-thead').innerHTML = `<tr>
    ${cols.map(c => {
      if (!c.sortable) return `<th scope="col" class="${c.cls || ''}">${c.label}</th>`;
      const active = rkSortCol === c.key;
      const ariaSort = active ? (rkSortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (rkSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortRk('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('rk-body').innerHTML = rows.map((j, i) => `
    <tr>
      ${cols.map(c => {
        if (c.key === 'rank') return `<td class="td-rank td-muted">${i + 1}</td>`;
        if (c.key === 'foto') return `<td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.foto_url || j.bref_id) ? `<img loading="lazy" class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : avatarHtml(j.nombre, 'player-thumb')}</a></td>`;
        if (c.key === 'nombre') return `<td class="td-nombre">${plLink(j.nombre, j.nombre)}</td>`;
        const val = c.fmt ? c.fmt(j[c.key]) : (j[c.key] ?? '—');
        const hl = rkSortCol === c.key ? ' td-hl' : '';
        const rank = (c.fmt && rkRanks[c.key] && j[c.key] != null) ? rkRanks[c.key][j.id] : null;
        const rankTag = rank ? ` <span class="stat-rank">(${rank})</span>` : '';
        const lead = rank === 1 ? ' td-leader' : '';
        return `<td class="${c.cls || ''}${hl}${lead}">${val}${rankTag}</td>`;
      }).join('')}
    </tr>`).join('') || `<tr><td colspan="${cols.length}" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;

  renderRkFoot(rows, cols);
}

// Fila de totales (suma de todos), solo en modo Totales
function renderRkFoot(rows, cols) {
  const foot = document.getElementById('rk-foot');
  if (!foot) return;
  if (rkMode !== 'tot') { foot.innerHTML = ''; return; }

  const sum = k => rows.reduce((s, j) => s + (j[k] || 0), 0);
  const tp = sum('partidos'), tgs = sum('partidos_titular');

  const cells = cols.map(c => {
    if (c.key === 'nombre') return `<td class="td-nombre">TOTAL (${rows.length})</td>`;
    if (c.key === 'rank' || c.key === 'foto') return '<td></td>';
    if (c.key === 'pct_gs') return `<td class="${c.cls || ''}">${tp ? fmtPct(tgs / tp) : '—'}</td>`;
    return `<td class="${c.cls || ''}">${fmtEnt(sum(c.key))}</td>`;
  }).join('');

  foot.innerHTML = `<tr class="rk-total">${cells}</tr>`;
}

// Posición de cada jugador en cada estadística (sobre todos los que tienen partidos)
function buildRkRanks() {
  rkRanks = {};
  RK_STAT_KEYS.forEach(key => {
    const sorted = [...rkAll].filter(j => j[key] != null).sort((a, b) => (b[key] || 0) - (a[key] || 0));
    const map = {};
    let prevVal = null, prevRank = 0;
    sorted.forEach((j, i) => {
      const v = j[key] || 0;
      const rank = (v === prevVal) ? prevRank : i + 1;
      map[j.id] = rank;
      prevVal = v; prevRank = rank;
    });
    rkRanks[key] = map;
  });
}

function sortRk(col) {
  if (rkSortCol === col) rkSortAsc = !rkSortAsc;
  else { rkSortCol = col; rkSortAsc = (col === 'nombre'); }
  renderRkTable();
}

// ══════════════════════════════════════════════
// PÁGINA DORSALES
// ══════════════════════════════════════════════
let drByNum = {};
let drAll = [];
let drMeta = {};  // nombre normalizado → jugador (para la foto)
let drSel = null; // dorsal seleccionado (para poder deseleccionar)

function drNorm(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

function drPhoto(jugador) {
  const j = drMeta[drNorm(jugador)];
  const src = j && (j.foto_url || (j.bref_id ? `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg` : ''));
  if (src) return `<span class="dp-photo"><img loading="lazy" src="${src}" onerror="this.remove()" alt=""></span>`;
  return avatarHtml(jugador, 'dp-photo');
}

async function initDorsalesPage() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

  const dorsales = data.dorsales || [];
  drAll = dorsales;
  drMeta = {};
  (data.jugadores || []).forEach(j => { drMeta[drNorm(j.nombre)] = j; });
  buildPlayerIds(data.jugadores);
  drByNum = {};
  for (let n = 0; n <= 99; n++) drByNum[n] = [];
  dorsales.forEach(d => {
    const n = Number(d.numero);
    if (Number.isInteger(n) && n >= 0 && n <= 99) drByNum[n].push(d);
  });

  document.getElementById('hero-sub').textContent =
    dorsales.length
      ? `${dorsales.length} registros · 100 dorsales, del 0 al 99`
      : 'Aún no hay datos de dorsales';

  renderDrKpis();
  renderDrLegend();
  renderDrGrid();
  showDorsal(null);
  renderDrPorJugador();
}

// Nº de dorsales distintos por jugador (panel fijo bajo el drawer)
function renderDrPorJugador() {
  const el = document.getElementById('dr-por-jugador');
  if (!el) return;
  const porJug = {};
  drAll.forEach(d => { (porJug[d.jugador] = porJug[d.jugador] || new Set()).add(Number(d.numero)); });
  const rows = Object.entries(porJug)
    .map(([jug, set]) => ({ jug, n: set.size }))
    .sort((a, b) => b.n - a.n || a.jug.localeCompare(b.jug));
  if (!rows.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <h2 class="section-title">Dorsales por jugador</h2>
    <p class="section-sub">Cuántos números distintos ha vestido cada español.</p>
    <ul class="dr-pj-list">
      ${rows.map(r => `<li class="dr-pj-item"><span class="dr-pj-n">${r.n}</span><span>${r.jug}</span></li>`).join('')}
    </ul>`;
}

function drPlayers(entries) { return [...new Set(entries.map(e => e.jugador))]; }
function drCount(n) { return drPlayers(drByNum[n] || []).length; }

function jerseyClass(count) {
  if (!count) return 'j0';
  if (count === 1) return 'j1';
  if (count === 2) return 'j2';
  if (count === 3) return 'j3';
  return 'j4';
}

function renderDrKpis() {
  let usados = 0, sinUsar = 0, top = { n: null, c: 0 };
  for (let n = 0; n <= 99; n++) {
    const c = drCount(n);
    if (c > 0) usados++; else sinUsar++;
    if (c > top.c) top = { n, c };
  }
  document.getElementById('dr-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-num">${usados}<span class="kpi-sub">/100</span></div><div class="kpi-label">Dorsales usados</div></div>
    <div class="kpi"><div class="kpi-num">${top.n ?? '—'}</div><div class="kpi-label">Más llevado${top.c ? ` · ${top.c} jugadores` : ''}</div></div>
    <div class="kpi"><div class="kpi-num">${sinUsar}</div><div class="kpi-label">Sin estrenar</div></div>`;
}

function renderDrLegend() {
  document.getElementById('dr-legend').innerHTML = `
    <span class="leg-item"><span class="leg-chip j0"></span>Sin usar</span>
    <span class="leg-item"><span class="leg-chip j1"></span>1 jugador</span>
    <span class="leg-item"><span class="leg-chip j2"></span>2 jugadores</span>
    <span class="leg-item"><span class="leg-chip j3"></span>3 jugadores</span>
    <span class="leg-item"><span class="leg-chip j4"></span>4 o más</span>`;
}

function jerseySvg(n) {
  // Camiseta de baloncesto: cuerpo ancho, cuello redondo, sisas y vivos
  return `<svg class="jersey-svg" viewBox="0 0 100 110" aria-hidden="true">
    <path class="jersey-shape" d="M21 21 Q21 15 27 15 L37 15 C40 34 60 34 63 15 L73 15 Q79 15 79 21 Q76 30 70 34 Q76 38 79 45 L79 100 Q79 104 75 104 L25 104 Q21 104 21 100 L21 45 Q24 38 30 34 Q24 30 21 21 Z"/>
    <path class="jersey-trim" d="M37 17 C40 32 60 32 63 17 M64 16 L73 16 Q77 16 77 21 Q74 29 69 33 M36 16 L27 16 Q23 16 23 21 Q26 29 31 33"/>
    <text class="jersey-num" x="50" y="82" text-anchor="middle">${n}</text>
  </svg>`;
}

function renderDrGrid() {
  let html = '';
  for (let n = 0; n <= 99; n++) {
    const c = drCount(n);
    html += `<button class="jersey ${jerseyClass(c)}" role="listitem" onclick="toggleDorsal(${n})"
      aria-label="Dorsal ${n}, ${c} jugador${c === 1 ? '' : 'es'}">${jerseySvg(n)}</button>`;
  }
  document.getElementById('dr-grid').innerHTML = html;
}

// Año NBA → temporada (2024 = 2023-24)
function drSeason(y) {
  if (!y) return '';
  const yy = Number(y);
  return `${yy - 1}-${String(yy).slice(2)}`;
}
function drPeriodo(desde, hasta) {
  const d = drSeason(desde);
  if (hasta === null || hasta === undefined || hasta === '') return d ? `${d} → actual` : 'actual';
  const h = drSeason(hasta);
  return d === h ? d : `${d} → ${h}`;
}

// Un clic selecciona; otro clic sobre el mismo lo deselecciona
function toggleDorsal(n) { showDorsal(drSel === n ? null : n); }

function showDorsal(n) {
  const btns = document.querySelectorAll('.jersey');
  btns.forEach(b => b.classList.remove('sel'));
  const panel = document.getElementById('dr-detail');

  if (n === null || n === undefined) {
    drSel = null;
    panel.innerHTML = `<p class="dorsal-hint">Elige un dorsal para ver qué españoles lo han llevado.</p>`;
    return;
  }
  drSel = n;
  if (btns[n]) btns[n].classList.add('sel');

  const entries = drByNum[n] || [];
  const players = drPlayers(entries);

  if (!players.length) {
    panel.innerHTML = `
      <div class="dorsal-head"><span class="dorsal-big">${n}</span></div>
      <p class="dorsal-hint">Ningún español ha llevado el dorsal ${n} en la NBA.</p>`;
    return;
  }

  const byPlayer = {};
  entries.forEach(e => { (byPlayer[e.jugador] = byPlayer[e.jugador] || []).push(e); });

  const items = Object.entries(byPlayer).map(([jug, es]) => {
    const teamsHtml = es
      .sort((a, b) => (a.desde || 0) - (b.desde || 0))
      .map(e => `<span class="dp-team"><span class="dp-team-code">${e.team || '—'}</span><span class="dp-team-yrs">${drPeriodo(e.desde, e.hasta)}</span></span>`)
      .join('');

    // ¿Este jugador llevó OTRO dorsal en el mismo equipo?
    const teams = [...new Set(es.map(e => e.team).filter(Boolean))];
    const notas = [];
    teams.forEach(team => {
      const otros = [...new Set(
        drAll.filter(d => d.jugador === jug && d.team === team && Number(d.numero) !== n)
             .map(d => Number(d.numero))
      )].sort((a, b) => a - b);
      otros.forEach(num => notas.push(`También llevó el <b>#${num}</b> en ${team}`));
    });
    const notaHtml = notas.length ? `<span class="dp-nota">${notas.join('<br>')}</span>` : '';

    return `<li class="dorsal-player">
      ${plLink(jug, drPhoto(jug))}
      <div class="dp-info">
        <span class="dp-name">${plLink(jug, jug)}</span>
        <div class="dp-teams">${teamsHtml}</div>
        ${notaHtml}
      </div>
    </li>`;
  }).join('');

  panel.innerHTML = `
    <div class="dorsal-head">
      <span class="dorsal-big">${n}</span>
      <span class="dorsal-count">${players.length} jugador${players.length === 1 ? '' : 'es'}</span>
    </div>
    <ul class="dorsal-list">${items}</ul>`;

  if (window.matchMedia('(max-width: 900px)').matches) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ══════════════════════════════════════════════
// PÁGINA TRANSACCIONES
// ══════════════════════════════════════════════
let trAll = [];
let trSortCol = 'fecha';
let trSortAsc = false;
let trSearch = '';
let trTipo = '';
let trYear = '';
let trNatural = false;   // ordenar por fecha del año natural (ignora el año)

const TR_COLS = [
  { key: 'rank',    label: '#',        sortable: false, cls: 'td-rank' },
  { key: 'fecha',   label: 'Fecha',    sortable: true,  cls: 'td-center' },
  { key: 'jugador', label: 'Jugador',  sortable: true,  cls: 'td-nombre' },
  { key: 'tipo',    label: 'Tipo',     sortable: true },
  { key: 'equipo1', label: 'Equipo',   sortable: true,  cls: 'td-center' },
  { key: 'equipo2', label: 'Equipo 2', sortable: true,  cls: 'td-center' },
  { key: 'chevron', label: '',         sortable: false, cls: 'td-chevron' },
];

// Nombre completo de franquicia → código de 3 letras (incluye históricas)
const TEAM_ABBR = {
  'atlanta hawks': 'ATL', 'boston celtics': 'BOS', 'brooklyn nets': 'BKN', 'new jersey nets': 'NJN',
  'charlotte hornets': 'CHA', 'charlotte bobcats': 'CHA', 'chicago bulls': 'CHI', 'cleveland cavaliers': 'CLE',
  'dallas mavericks': 'DAL', 'denver nuggets': 'DEN', 'detroit pistons': 'DET', 'golden state warriors': 'GSW',
  'houston rockets': 'HOU', 'indiana pacers': 'IND', 'los angeles clippers': 'LAC', 'la clippers': 'LAC',
  'san diego clippers': 'SDC', 'los angeles lakers': 'LAL', 'la lakers': 'LAL', 'memphis grizzlies': 'MEM',
  'vancouver grizzlies': 'VAN', 'miami heat': 'MIA', 'milwaukee bucks': 'MIL', 'minnesota timberwolves': 'MIN',
  'new orleans pelicans': 'NOP', 'new orleans hornets': 'NOH', 'new orleans/oklahoma city hornets': 'NOK',
  'new york knicks': 'NYK', 'oklahoma city thunder': 'OKC', 'seattle supersonics': 'SEA', 'orlando magic': 'ORL',
  'philadelphia 76ers': 'PHI', 'phoenix suns': 'PHX', 'portland trail blazers': 'POR', 'sacramento kings': 'SAC',
  'kansas city kings': 'KCK', 'san antonio spurs': 'SAS', 'toronto raptors': 'TOR', 'utah jazz': 'UTA',
  'washington wizards': 'WAS', 'washington bullets': 'WSB',
};
function teamAbbr(name) {
  const s = String(name || '').trim();
  if (!s) return '—';
  if (s.length <= 4) return s.toUpperCase();          // ya es un código (MEM, POR…)
  return TEAM_ABBR[drNorm(s)] || s;                    // desconocido → nombre completo
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function trFechaDisplay(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${parseInt(m[3])} ${MESES[parseInt(m[2]) - 1]} ${m[1]}`;
}
function trYearOf(iso) { const m = String(iso || '').match(/^(\d{4})/); return m ? m[1] : ''; }

// ID estable de una transacción (no depende del orden del volcado)
function trMakeId(t) {
  const base = [t.fecha, t.jugador, t.tipo, t.equipo1]
    .map(x => drNorm(x)).join('-')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'tx';
}

function trTipoClass(t) {
  const s = (t || '').toLowerCase();
  if (s.includes('draft')) return 'tt-draft';
  if (s.includes('traspas')) return 'tt-trade';
  if (s.includes('firma') || s.includes('renov') || s.includes('agente libre')) return 'tt-sign';
  if (s.includes('cortad') || s.includes('waiver') || s.includes('renuncia')) return 'tt-waive';
  if (s.includes('rechaza') || s.includes('opción') || s.includes('opcion')) return 'tt-option';
  if (s.includes('retir')) return 'tt-retire';
  return 'tt-other';
}

async function initTransaccionesPage() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

  buildPlayerIds(data.jugadores);
  const seenIds = {};
  trAll = (data.transacciones || []).filter(t => t.tipo).map(t => {
    let id = trMakeId(t);
    if (seenIds[id] != null) { seenIds[id]++; id = `${id}-${seenIds[id]}`; }
    else seenIds[id] = 0;
    return { ...t, _id: id };
  });

  document.getElementById('hero-sub').textContent =
    trAll.length ? `${trAll.length} movimientos de mercado` : 'Aún no hay datos de transacciones';

  renderTrKpis();
  buildTrFilters();
  document.getElementById('tr-search').addEventListener('input', e => { trSearch = e.target.value.trim().toLowerCase(); renderTrTable(); });
  document.getElementById('tr-tipo').addEventListener('change', e => { trTipo = e.target.value; renderTrTable(); });
  document.getElementById('tr-year').addEventListener('change', e => { trYear = e.target.value; renderTrTable(); });
  renderTrTable();

  // Abrir el detalle si la URL trae ?tx=ID
  const tx = new URLSearchParams(location.search).get('tx');
  if (tx) openTrDrawer(tx);
}

function renderTrKpis() {
  const total = trAll.length;
  const porTipo = {}, porJug = {};
  trAll.forEach(t => { porTipo[t.tipo] = (porTipo[t.tipo] || 0) + 1; porJug[t.jugador] = (porJug[t.jugador] || 0) + 1; });
  const topTipo = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
  const topJug = Object.entries(porJug).sort((a, b) => b[1] - a[1])[0] || ['—', 0];

  document.getElementById('tr-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-num">${total}</div><div class="kpi-label">Movimientos</div></div>
    <div class="kpi"><div class="kpi-num">${topTipo[1]}</div><div class="kpi-label">Más común · ${topTipo[0]}</div></div>
    <div class="kpi"><div class="kpi-num">${topJug[1]}</div><div class="kpi-label">Más movido · ${topJug[0]}</div></div>`;
}

function buildTrFilters() {
  const tipos = [...new Set(trAll.map(t => t.tipo))].sort();
  document.getElementById('tr-tipo').innerHTML =
    '<option value="">Todos los tipos</option>' + tipos.map(t => `<option value="${t}">${t}</option>`).join('');
  const years = [...new Set(trAll.map(t => trYearOf(t.fecha)).filter(Boolean))].sort((a, b) => b - a);
  document.getElementById('tr-year').innerHTML =
    '<option value="">Todos los años</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function renderTrTable() {
  let rows = trAll.filter(t => {
    if (trTipo && t.tipo !== trTipo) return false;
    if (trYear && trYearOf(t.fecha) !== trYear) return false;
    if (trSearch && !t.jugador.toLowerCase().includes(trSearch)) return false;
    return true;
  });

  if (trNatural) {
    // De 1 de enero a 31 de diciembre, ignorando el año (desempate por año)
    const md = iso => String(iso || '').slice(5, 10);      // "MM-DD"
    rows.sort((a, b) => md(a.fecha).localeCompare(md(b.fecha)) || String(a.fecha).localeCompare(String(b.fecha)));
  } else {
    rows.sort((a, b) => {
      const va = String(a[trSortCol] || ''), vb = String(b[trSortCol] || '');
      return trSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  document.getElementById('tr-count').textContent = `${rows.length} movimiento${rows.length === 1 ? '' : 's'}`;

  document.getElementById('tr-thead').innerHTML = `<tr>
    ${TR_COLS.map(c => {
      if (!c.sortable) return `<th scope="col" class="${c.cls || ''}">${c.label}</th>`;
      const active = trSortCol === c.key;
      const ariaSort = active ? (trSortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (trSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortTr('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('tr-body').innerHTML = rows.map((t, i) => `
    <tr class="tr-row" tabindex="0" role="button" aria-label="Ver detalle de la transacción de ${t.jugador}"
        onclick="openTrDrawer('${t._id}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTrDrawer('${t._id}');}">
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-center td-muted">${trFechaDisplay(t.fecha)}</td>
      <td class="td-nombre" onclick="event.stopPropagation()">${plLink(t.jugador, t.jugador)}</td>
      <td><span class="tr-tipo ${trTipoClass(t.tipo)}">${t.tipo}</span></td>
      <td class="td-center">${t.equipo1 || '—'}</td>
      <td class="td-center">${t.equipo2 || '—'}</td>
      <td class="td-chevron" aria-hidden="true">›</td>
    </tr>`).join('') || `<tr><td colspan="${TR_COLS.length}" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function sortTr(col) {
  trNatural = false;                                        // volver al orden por columna
  const nb = document.getElementById('tr-natural');
  if (nb) { nb.classList.remove('active'); nb.setAttribute('aria-pressed', 'false'); }
  if (trSortCol === col) trSortAsc = !trSortAsc;
  else { trSortCol = col; trSortAsc = (col === 'jugador' || col === 'tipo'); }
  renderTrTable();
}

function toggleTrNatural() {
  trNatural = !trNatural;
  const nb = document.getElementById('tr-natural');
  nb.classList.toggle('active', trNatural);
  nb.setAttribute('aria-pressed', String(trNatural));
  renderTrTable();
}

// Nombre completo + código: "Los Angeles Lakers (LAL)"
function teamFull(name) {
  const s = String(name || '').trim();
  if (!s) return '—';
  const ab = teamAbbr(s);
  return (ab !== s && ab !== '—') ? `${s} <span class="drawer-code">${ab}</span>` : s;
}

function openTrDrawer(id) {
  const t = trAll.find(x => x._id === id);
  if (!t) return;
  const filas = [
    ['Jugador', plLink(t.jugador, t.jugador)],
    t.equipo1 ? ['Equipo', teamFull(t.equipo1)] : null,
    t.equipo2 ? ['Segundo equipo', teamFull(t.equipo2)] : null,
    t.otros ? ['Otros jugadores', t.otros] : null,
  ].filter(Boolean);

  document.getElementById('tr-drawer-content').innerHTML = `
    <span class="tr-tipo ${trTipoClass(t.tipo)} drawer-tag">${t.tipo}</span>
    <h2 class="drawer-title" id="tr-drawer-title">${t.jugador}</h2>
    <p class="drawer-sub">${trFechaDisplay(t.fecha)}</p>
    <dl class="drawer-dl">
      ${filas.map(([k, v]) => `<div class="drawer-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
    </dl>
    ${t.notas ? `<div class="drawer-notas"><h3>Notas</h3><p>${t.notas}</p></div>` : ''}`;

  document.getElementById('tr-overlay').hidden = false;
  const d = document.getElementById('tr-drawer');
  d.hidden = false;
  requestAnimationFrame(() => d.classList.add('open'));
  document.body.classList.add('drawer-lock');
  updateUrlParam('tx', id);
  document.addEventListener('keydown', trDrawerEsc);
}

function trDrawerEsc(e) { if (e.key === 'Escape') closeTrDrawer(); }

function closeTrDrawer() {
  const d = document.getElementById('tr-drawer');
  if (d) d.classList.remove('open');
  const ov = document.getElementById('tr-overlay');
  if (ov) ov.hidden = true;
  document.body.classList.remove('drawer-lock');
  updateUrlParam('tx', '');
  document.removeEventListener('keydown', trDrawerEsc);
  setTimeout(() => { if (d && !d.classList.contains('open')) d.hidden = true; }, 280);
}

// ══════════════════════════════════════════════
// FICHA DE JUGADOR
// ══════════════════════════════════════════════
function jugadorHref(id) { return `jugador.html?id=${encodeURIComponent(id)}`; }

function jugPhoto(j, cls) {
  const src = j.foto_url || (j.bref_id ? `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg` : '');
  if (src) return `<span class="jug-photo ${cls || ''}"><img loading="lazy" src="${src}" onerror="this.remove()" alt="${j.nombre}"></span>`;
  return avatarHtml(j.nombre, `jug-photo ${cls || ''}`);
}

function jugSection(title, body) {
  return `<section class="jug-section"><h2 class="section-title">${title}</h2>${body}</section>`;
}
function statBox(label, val) {
  return `<div class="stat-box"><div class="stat-box-val">${val}</div><div class="stat-box-lbl">${label}</div></div>`;
}

async function initJugadorPage() {
  const id = new URLSearchParams(location.search).get('id');
  const el = document.getElementById('jug-content');
  let data;
  try { data = await loadData(); }
  catch (e) { el.innerHTML = '<p class="td-muted" style="padding:2rem">Error al cargar los datos.</p>'; return; }

  const j = (data.jugadores || []).find(p => p.id === id);
  if (!j) { el.innerHTML = '<p class="td-muted" style="padding:2rem">Jugador no encontrado.</p>'; return; }
  document.title = `${j.nombre} · Españoles en la NBA`;

  const n = drNorm(j.nombre);
  const dorsales = (data.dorsales || []).filter(d => drNorm(d.jugador) === n);
  const sl = (data.summer_league || []).filter(s => drNorm(s.jugador) === n);
  const trans = (data.transacciones || []).filter(t => drNorm(t.jugador) === n);

  el.innerHTML = [
    jugHeader(j),
    jugStats(j),
    jugTemporadas(j),
    jugPlayoffs(j),
    jugPremios(j),
    jugRecords(j),
    jugSalario(j),
    jugDorsalesSec(dorsales),
    jugSummer(sl),
    jugTransSec(trans),
  ].filter(Boolean).join('');
}

function jugHeader(j) {
  const pills = [];
  const nac = j.nacimiento_fecha || j.nacimiento;
  if (nac) pills.push('Nacido: ' + nac);
  pills.push(j.draft ? `Draft ${j.draft_anio || ''} · #${j.draft_pick || '?'} ${j.draft_equipo || ''}`.trim() : 'No drafteado');
  if (j.primer_partido && j.primer_partido.fecha) pills.push('Debut: ' + j.primer_partido.fecha);
  if (j.equipos_nba) pills.push('Equipos: ' + j.equipos_nba);
  return `<header class="jug-header">
    ${jugPhoto(j, 'jug-photo--big')}
    <div class="jug-headinfo">
      <h1 class="jug-name">${j.nombre}</h1>
      <div class="jug-pills">${pills.map(p => `<span class="jug-pill">${p}</span>`).join('')}</div>
    </div>
  </header>`;
}

function jugStats(j) {
  if (!(j.partidos > 0)) return '';
  const pg = [
    statBox('GP', fmtEnt(j.partidos)), statBox('MIN', fmtDec1(j.min_g)), statBox('PTS', fmtDec1(j.pts_g)),
    statBox('REB', fmtDec1(j.rbd_g)), statBox('AST', fmtDec1(j.ast_g)), statBox('ROB', fmtDec1(j.stl_g)),
    statBox('TAP', fmtDec1(j.blk_g)), statBox('FG%', fmtPct(j.fg_pct)), statBox('3P%', fmtPct(j.tres_pct)), statBox('FT%', fmtPct(j.ft_pct)),
  ].join('');
  const tot = [
    statBox('GP', fmtEnt(j.partidos)),
    statBox('PTS', fmtEnt(j.pts_total)), statBox('REB', fmtEnt(j.rbd_total)), statBox('AST', fmtEnt(j.ast_total)),
    statBox('ROB', fmtEnt(j.stl_total)), statBox('TAP', fmtEnt(j.blk_total)), statBox('3PM', fmtEnt(j.tres_total)),
    statBox('MIN', fmtEnt(j.min_total)), statBox('TOV', fmtEnt(j.tov_total)),
  ].join('');
  return jugSection('Estadísticas de carrera',
    `<h3 class="jug-subh">Por partido</h3><div class="stat-grid">${pg}</div>
     <h3 class="jug-subh">Totales</h3><div class="stat-grid">${tot}</div>`);
}

function jugTemporadas(j) {
  const s = (j.temporadas_data || []).filter(x => x.year);
  if (!s.length) return '';
  const sorted = [...s].sort((a, b) => (a.year || 0) - (b.year || 0));
  // años con más de una fila → temporadas multi-equipo (TOT + reparto por equipo)
  const yearCount = {};
  sorted.forEach(t => { yearCount[t.year] = (yearCount[t.year] || 0) + 1; });
  const rows = sorted.map(t => {
    const isTot = String(t.team || '').toUpperCase() === 'TOT';
    const split = yearCount[t.year] > 1 && !isTot;   // reparto por equipo (no el total)
    const teamCell = split ? `<span class="season-split-mark">↳</span> ${t.team || '—'}` : (t.team || '—');
    return `<tr class="${split ? 'season-split' : (isTot ? 'season-tot' : '')}">
    <td class="td-center">${drSeason(t.year)}</td><td class="td-center">${teamCell}</td>
    <td class="td-num">${fmtEnt(t.g)}</td><td class="td-num">${fmtDec1(t.min_g)}</td><td class="td-num">${fmtDec1(t.pts_g)}</td>
    <td class="td-num">${fmtDec1(t.rbd_g)}</td><td class="td-num">${fmtDec1(t.ast_g)}</td><td class="td-num">${fmtDec1(t.stl_g)}</td>
    <td class="td-num">${fmtDec1(t.blk_g)}</td><td class="td-num">${fmtPct(t.fg_pct)}</td><td class="td-num">${fmtPct(t.tres_pct)}</td><td class="td-num">${fmtPct(t.ft_pct)}</td>
  </tr>`;
  }).join('');
  return jugSection('Temporada a temporada',
    `<div class="tabla-scroll"><table><thead><tr>
      <th class="td-center">Año</th><th class="td-center">Equipo</th><th class="td-num">GP</th><th class="td-num">MIN</th><th class="td-num">PTS</th>
      <th class="td-num">REB</th><th class="td-num">AST</th><th class="td-num">ROB</th><th class="td-num">TAP</th>
      <th class="td-num">FG%</th><th class="td-num">3P%</th><th class="td-num">FT%</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`);
}

function jugPlayoffs(j) {
  const p = (j.playoffs_temporadas || []).filter(x => x && (x.year || x.g));
  if (!p.length) return '';
  const rows = [...p].sort((a, b) => (a.year || 0) - (b.year || 0)).map(t =>
    `<tr><td class="td-center">${t.year ? drSeason(t.year) : '—'}</td><td class="td-center">${t.team || '—'}</td><td class="td-num">${fmtEnt(t.g)}</td></tr>`).join('');
  return jugSection('Playoffs',
    `<div class="tabla-scroll"><table><thead><tr><th class="td-center">Año</th><th class="td-center">Equipo</th><th class="td-num">GP</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

function jugPremios(j) {
  const p = j.premios || [];
  if (!p.length) return '';
  const items = [...p].sort((a, b) => (b.year || 0) - (a.year || 0)).map(a => {
    const hito = a.tipo === 'ROY' || a.tipo === 'DPOY';
    return `<li class="jug-award">
      <span class="jug-award-tipo${hito ? ' jug-award-hito' : ''}">${a.tipo}</span>
      <span class="td-muted">${[a.year, a.team, a.notas].filter(Boolean).join(' · ')}</span>
    </li>`;
  }).join('');
  return jugSection(`Premios (${p.length})`, `<ul class="jug-awards">${items}</ul>`);
}

function jugRecords(j) {
  const r = j.records || [];
  if (!r.length) return '';
  const items = r.map(x => `<li><b>${x.categoria}</b>: ${x.valor} <span class="td-muted">${[x.team, x.rival, x.fecha].filter(Boolean).join(' · ')}</span></li>`).join('');
  return jugSection('Récords personales', `<ul class="jug-list">${items}</ul>`);
}

function jugSalario(j) {
  if (!j.ganancias) return '';
  const parts = [statBox('Total', fmtDinero(j.ganancias))];
  if (j.ganancias_ganado) parts.push(statBox('Cobrado', fmtDinero(j.ganancias_ganado)));
  if (j.ganancias_futuro) parts.push(statBox('Firmado', fmtDinero(j.ganancias_futuro)));
  if (j.partidos > 0 && j.ganancias_ganado) parts.push(statBox('$/partido', fmtDinero(j.ganancias_ganado / j.partidos)));
  return jugSection('Salario', `<div class="stat-grid stat-grid--money">${parts.join('')}</div>`);
}

function jugDorsalesSec(dorsales) {
  if (!dorsales.length) return '';
  const byNum = {};
  dorsales.forEach(d => { (byNum[d.numero] = byNum[d.numero] || []).push(d); });
  const items = Object.keys(byNum).sort((a, b) => a - b).map(num => {
    const stints = byNum[num].sort((a, b) => (a.desde || 0) - (b.desde || 0))
      .map(d => `<span class="dp-team"><span class="dp-team-code">${d.team || '—'}</span><span class="dp-team-yrs">${drPeriodo(d.desde, d.hasta)}</span></span>`).join('');
    return `<li class="jug-dorsal"><span class="jug-dorsal-num">${num}</span><div class="dp-teams">${stints}</div></li>`;
  }).join('');
  return jugSection('Dorsales', `<ul class="jug-dorsals">${items}</ul>`);
}

function jugSummer(sl) {
  if (!sl.length) return '';
  const rows = [...sl].sort((a, b) => (b.year || 0) - (a.year || 0))
    .map(s => `<li><b>${s.year || '—'}</b> <span class="td-muted">${s.equipo || ''}</span></li>`).join('');
  return jugSection('Summer League', `<ul class="jug-list">${rows}</ul>`);
}

function jugTransSec(trans) {
  if (!trans.length) return '';
  const rows = [...trans].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).map(t => `<tr>
    <td class="td-center td-muted">${trFechaDisplay(t.fecha)}</td>
    <td><span class="tr-tipo ${trTipoClass(t.tipo)}">${t.tipo}</span></td>
    <td class="td-center">${t.equipo1 || '—'}</td><td class="td-center">${t.equipo2 || '—'}</td>
    <td class="td-muted">${t.otros || '—'}</td><td class="td-muted">${t.notas || '—'}</td>
  </tr>`).join('');
  return jugSection('Transacciones',
    `<div class="tabla-scroll"><table><thead><tr><th class="td-center">Fecha</th><th>Tipo</th><th class="td-center">Equipo</th><th class="td-center">Equipo 2</th><th>Otros</th><th>Notas</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

// ══════════════════════════════════════════════
// TEST / TRIVIA
// ══════════════════════════════════════════════
let quizData = null, quizCurrent = null, quizAnswered = false;
let quizScore = 0, quizTotal = 0, quizStreak = 0, quizBest = 0;

function qPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function qShuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }
function qSample(a, n) { return qShuffle(a).slice(0, n); }
function qMax(arr, key) { return arr.reduce((a, b) => (b[key] || 0) > (a[key] || 0) ? b : a); }
function qOptions(correct, pool, n = 3) {
  const seen = new Set([String(correct)]); const out = [];
  for (const x of qShuffle(pool)) { if (out.length >= n) break; if (!seen.has(String(x))) { seen.add(String(x)); out.push(x); } }
  return qShuffle([correct, ...out]);
}
function qFourPlayers(D) { return qSample(D.stat, 4).map(x => x.nombre); }

const QUIZ_GENS = [
  D => { // año de draft
    const pool = D.drafted; const years = [...new Set(pool.map(x => x.draft_anio))];
    if (pool.length < 4 || years.length < 4) return null;
    const j = qPick(pool);
    return { q: `¿En qué año fue elegido <b>${j.nombre}</b> en el draft?`, correct: j.draft_anio, options: qOptions(j.draft_anio, years) };
  },
  D => { // equipo del draft
    const pool = D.drafted.filter(x => x.draft_equipo); const teams = [...new Set(pool.map(x => x.draft_equipo))];
    if (pool.length < 4 || teams.length < 4) return null;
    const j = qPick(pool);
    return { q: `¿Qué equipo eligió a <b>${j.nombre}</b> en el draft?`, correct: j.draft_equipo, options: qOptions(j.draft_equipo, teams) };
  },
  D => { // pick del draft
    const pool = D.drafted.filter(x => x.draft_pick); const picks = [...new Set(pool.map(x => '#' + x.draft_pick))];
    if (pool.length < 4 || picks.length < 4) return null;
    const j = qPick(pool);
    return { q: `¿Con qué número fue elegido <b>${j.nombre}</b> (${j.draft_anio})?`, correct: '#' + j.draft_pick, options: qOptions('#' + j.draft_pick, picks) };
  },
  D => { // máximo anotador PPG entre 4
    if (D.stat.length < 4) return null; const four = qSample(D.stat, 4);
    return { q: '¿Cuál de estos jugadores promedió más <b>puntos por partido</b> en su carrera?', correct: qMax(four, 'pts_g').nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
  D => { // más puntos totales entre 4
    if (D.stat.length < 4) return null; const four = qSample(D.stat, 4);
    return { q: '¿Quién ha anotado más <b>puntos totales</b> en la NBA?', correct: qMax(four, 'pts_total').nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
  D => { // más rebotes totales
    if (D.stat.length < 4) return null; const four = qSample(D.stat, 4);
    return { q: '¿Quién ha capturado más <b>rebotes totales</b> en la NBA?', correct: qMax(four, 'rbd_total').nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
  D => { // más asistencias totales
    if (D.stat.length < 4) return null; const four = qSample(D.stat, 4);
    return { q: '¿Quién ha dado más <b>asistencias totales</b> en la NBA?', correct: qMax(four, 'ast_total').nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
  D => { // más partidos
    if (D.stat.length < 4) return null; const four = qSample(D.stat, 4);
    return { q: '¿Cuál de estos jugadores ha disputado más <b>partidos</b> en la NBA?', correct: qMax(four, 'partidos').nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
  D => { // mejor pagado
    const pool = D.J.filter(j => j.ganancias > 0); if (pool.length < 4) return null; const four = qSample(pool, 4);
    return { q: '¿Cuál de estos jugadores ha <b>ganado más dinero</b> en la NBA?', correct: qMax(four, 'ganancias').nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
  D => { // premio único (ROY, DPOY, MVP...)
    const unis = ['DPOY', 'ROY', 'MVP', 'All Defense'].filter(t => D.premios.some(p => p.tipo === t));
    if (!unis.length || D.J.length < 4) return null;
    const t = qPick(unis); const winner = qPick(D.premios.filter(p => p.tipo === t)).jugador;
    return { q: `¿Qué español ganó el premio <b>${t}</b>?`, correct: winner, options: qOptions(winner, D.J.map(j => j.nombre).filter(n => n !== winner)) };
  },
  D => { // dorsal en un equipo
    const pool = D.dorsales.filter(x => x.team); const nums = [...new Set(D.dorsales.map(x => String(x.numero)))];
    if (pool.length < 4 || nums.length < 4) return null;
    const d = qPick(pool);
    return { q: `¿Qué <b>dorsal</b> llevó ${d.jugador} en ${d.team}?`, correct: String(d.numero), options: qOptions(String(d.numero), nums) };
  },
  D => { // posición
    const pool = D.J.filter(j => j.posicion); const pos = [...new Set(pool.map(x => x.posicion))];
    if (pool.length < 4 || pos.length < 4) return null;
    const j = qPick(pool);
    return { q: `¿En qué <b>posición</b> jugaba ${j.nombre}?`, correct: j.posicion, options: qOptions(j.posicion, pos) };
  },
  D => { // cuál NO fue drafteado
    const und = D.J.filter(j => !j.draft && (j.partidos || 0) > 0); if (und.length < 1 || D.drafted.length < 3) return null;
    const u = qPick(und); const three = qSample(D.drafted, 3).map(x => x.nombre);
    return { q: '¿Cuál de estos jugadores <b>NO fue drafteado</b>?', correct: u.nombre, options: qShuffle([u.nombre, ...three]) };
  },
  D => { // equipo con el que jugó la Summer League
    const teams = [...new Set(D.sl.map(x => x.equipo))];
    if (D.sl.length < 4 || teams.length < 4) return null;
    const s = qPick(D.sl);
    return { q: `¿Con qué equipo disputó <b>${s.jugador}</b> la Summer League${s.year ? ` de ${s.year}` : ''}?`, correct: s.equipo, options: qOptions(s.equipo, teams) };
  },
];

async function initTestPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('quiz-q').textContent = 'Error al cargar los datos'; return; }
  const J = data.jugadores || [];
  quizData = {
    J,
    drafted: J.filter(j => j.draft && j.draft_anio),
    stat: J.filter(j => (j.partidos || 0) > 0),
    dorsales: (data.dorsales || []).filter(d => d.numero != null),
    premios: J.flatMap(j => (j.premios || []).map(p => ({ ...p, jugador: j.nombre }))),
    sl: (data.summer_league || []).filter(s => s.equipo && s.jugador),
  };
  quizNext();
}

function quizNext() {
  let q = null, tries = 0;
  while (!q && tries < 60) { q = qPick(QUIZ_GENS)(quizData); tries++; }
  if (!q) { document.getElementById('quiz-q').textContent = 'No hay datos suficientes para el test.'; return; }
  quizCurrent = q; quizAnswered = false;
  document.getElementById('quiz-next').hidden = true;
  const fb = document.getElementById('quiz-feedback'); fb.textContent = ''; fb.className = 'quiz-feedback';
  document.getElementById('quiz-q').innerHTML = q.q;
  document.getElementById('quiz-options').innerHTML =
    q.options.map((o, i) => `<button class="quiz-opt" onclick="quizAnswer(${i})">${o}</button>`).join('');
}

function quizAnswer(i) {
  if (quizAnswered) return;
  quizAnswered = true;
  const opts = [...document.querySelectorAll('.quiz-opt')];
  const chosen = quizCurrent.options[i];
  const correct = quizCurrent.correct;
  const ok = String(chosen) === String(correct);
  quizTotal++;
  if (ok) { quizScore++; quizStreak++; quizBest = Math.max(quizBest, quizStreak); } else { quizStreak = 0; }

  opts.forEach((b, k) => {
    b.disabled = true;
    if (String(quizCurrent.options[k]) === String(correct)) b.classList.add('quiz-ok');
    else if (k === i) b.classList.add('quiz-ko');
  });
  document.getElementById('quiz-score').textContent = `${quizScore} / ${quizTotal}`;
  document.getElementById('quiz-streak').textContent = quizStreak >= 2 ? `🔥 ${quizStreak}` : '';
  const fb = document.getElementById('quiz-feedback');
  fb.innerHTML = ok ? '¡Correcto!' : `Respuesta: <b>${correct}</b>`;
  fb.className = 'quiz-feedback ' + (ok ? 'fb-ok' : 'fb-ko');
  document.getElementById('quiz-next').hidden = false;
}


// ══════════════════════════════════════════════
// PÁGINA CAREER HIGHS
// ══════════════════════════════════════════════
let highsJ = [];
let highsMode = 'total';    // 'total' | 'pg' | 'game'
let highsSortCol = 'pts_g';
let highsSortAsc = false;
const HIGHS_MIN_G = 55;     // mínimo de partidos para "por partido en temporada"

// Columnas de estadística (key = campo de temporadas_data)
const HIGHS_TOTAL_STATS = [
  { key: 'pts_g', label: 'PTS', fmt: fmtEnt },
  { key: 'rbd_g', label: 'REB', fmt: fmtEnt },
  { key: 'ast_g', label: 'AST', fmt: fmtEnt },
  { key: 'stl_g', label: 'ROB', fmt: fmtEnt },
  { key: 'blk_g', label: 'TAP', fmt: fmtEnt },
  { key: 'min_g', label: 'MIN', fmt: fmtEnt },
  { key: 'fgm_g', label: 'FGM', fmt: fmtEnt },
  { key: 'tres_g', label: '3PM', fmt: fmtEnt },
  { key: 'ftm_g', label: 'FTM', fmt: fmtEnt },
  { key: 'tov_g', label: 'TOV', fmt: fmtEnt },
  { key: 'pf_g', label: 'PF', fmt: fmtEnt },
  { key: 'td', label: 'TD', fmt: fmtEnt },
];
const HIGHS_PG_STATS = [
  { key: 'pts_g', label: 'PTS', fmt: fmtDec1 },
  { key: 'rbd_g', label: 'REB', fmt: fmtDec1 },
  { key: 'ast_g', label: 'AST', fmt: fmtDec1 },
  { key: 'stl_g', label: 'ROB', fmt: fmtDec1 },
  { key: 'blk_g', label: 'TAP', fmt: fmtDec1 },
  { key: 'min_g', label: 'MIN', fmt: fmtDec1 },
  { key: 'fgm_g', label: 'FGM', fmt: fmtDec1 },
  { key: 'tres_g', label: '3PM', fmt: fmtDec1 },
  { key: 'tov_g', label: 'TOV', fmt: fmtDec1 },
  { key: 'pf_g', label: 'PF', fmt: fmtDec1 },
  { key: 'fg_pct', label: 'FG%', fmt: fmtPct },
  { key: 'tres_pct', label: '3P%', fmt: fmtPct },
  { key: 'ft_pct', label: 'FT%', fmt: fmtPct },
];
// "En un partido" (datos de GAME HIGHS, máximo de un solo partido)
const HIGHS_GAME_STATS = [
  { key: 'pts', label: 'PTS', fmt: fmtEnt },
  { key: 'rbd', label: 'REB', fmt: fmtEnt },
  { key: 'ast', label: 'AST', fmt: fmtEnt },
  { key: 'stl', label: 'ROB', fmt: fmtEnt },
  { key: 'blk', label: 'TAP', fmt: fmtEnt },
  { key: 'min', label: 'MIN', fmt: fmtEnt },
  { key: 'fgm', label: 'FGM', fmt: fmtEnt },
  { key: 'tres_m', label: '3PM', fmt: fmtEnt },
  { key: 'ftm', label: 'FTM', fmt: fmtEnt },
  { key: 'tov', label: 'TOV', fmt: fmtEnt },
  { key: 'pf', label: 'PF', fmt: fmtEnt },
];

async function initHighsPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  highsJ = data.jugadores || [];
  buildPlayerIds(highsJ);

  // Modo desde la URL (?modo=total|pg|game)
  const modo = new URLSearchParams(location.search).get('modo');
  if (['total', 'pg', 'game'].includes(modo)) highsMode = modo;
  if (highsMode === 'game') highsSortCol = 'pts';
  syncHighsButtons();

  renderHighs();
}

function syncHighsButtons() {
  ['total', 'pg', 'game'].forEach(x => {
    const btn = document.getElementById('hi-mode-' + x);
    if (!btn) return;
    btn.classList.toggle('active', x === highsMode);
    btn.setAttribute('aria-pressed', String(x === highsMode));
  });
}

function setHighsMode(m) {
  if (highsMode === m) return;
  highsMode = m;
  syncHighsButtons();
  highsSortCol = (m === 'game') ? 'pts' : 'pts_g'; highsSortAsc = false;
  updateUrlParam('modo', m);
  renderHighs();
}

// Mejor registro del jugador en una estadística según el modo
function playerBest(j, key) {
  let best = null;
  (j.temporadas_data || []).forEach(t => {
    const g = t.g || 0;
    let v;
    if (key === 'td') { v = t.td; if (v == null) return; }   // triples-dobles: conteo de la temporada (no ×G)
    else {
      const avg = t[key];
      if (avg == null) return;
      if (highsMode === 'total') { if (!g) return; v = avg * g; }
      else { if (g < HIGHS_MIN_G) return; v = avg; }   // 'pg'
    }
    if (best == null || v > best) best = v;
  });
  return best;
}

function sortHighs(col) {
  if (highsSortCol === col) highsSortAsc = !highsSortAsc;
  else { highsSortCol = col; highsSortAsc = (col === 'nombre'); }
  renderHighs();
}

function renderHighs() {
  const subs = {
    total: 'Máximo de cada jugador en una sola temporada (totales)',
    pg: `Máxima media de cada jugador en una temporada (mín. ${HIGHS_MIN_G} partidos)`,
    game: 'Máximo de cada jugador en un solo partido',
  };
  document.getElementById('hero-sub').textContent = subs[highsMode];

  const table = document.getElementById('highs-table');
  const empty = document.getElementById('highs-empty');

  const stats = highsMode === 'total' ? HIGHS_TOTAL_STATS
              : highsMode === 'pg' ? HIGHS_PG_STATS
              : HIGHS_GAME_STATS;
  const pool = highsMode === 'game'
    ? highsJ.filter(j => j.game_highs)
    : highsJ.filter(j => (j.temporadas_data || []).length);
  const valOf = highsMode === 'game'
    ? (j, key) => (j.game_highs ? (j.game_highs[key] ?? null) : null)
    : (j, key) => playerBest(j, key);

  if (!pool.length) {
    table.hidden = true; empty.hidden = false;
    empty.textContent = 'Aún no hay datos para este modo.';
    return;
  }
  table.hidden = false; empty.hidden = true;

  // el orden activo debe existir en las columnas del modo actual
  if (highsSortCol !== 'nombre' && !stats.some(s => s.key === highsSortCol)) highsSortCol = stats[0].key;

  const cols = [
    { key: 'rank', label: '#', cls: 'td-rank', sortable: false },
    { key: 'foto', label: '', sortable: false },
    { key: 'nombre', label: 'Jugador', sortable: true, cls: 'td-nombre' },
    ...stats.map(s => ({ ...s, cls: 'td-num', sortable: true })),
  ];

  // valores por jugador + máximo por columna (para resaltar el líder)
  const rows = pool.map(j => {
    const best = {};
    stats.forEach(s => { best[s.key] = valOf(j, s.key); });
    return { j, best };
  });
  const colMax = {};
  stats.forEach(s => { colMax[s.key] = Math.max(...rows.map(r => r.best[s.key] ?? -Infinity)); });

  rows.sort((a, b) => {
    if (highsSortCol === 'nombre') return highsSortAsc ? a.j.nombre.localeCompare(b.j.nombre) : b.j.nombre.localeCompare(a.j.nombre);
    const va = a.best[highsSortCol] ?? -1, vb = b.best[highsSortCol] ?? -1;
    return highsSortAsc ? va - vb : vb - va;
  });

  document.getElementById('highs-thead').innerHTML = `<tr>
    ${cols.map(c => {
      if (!c.sortable) return `<th scope="col" class="${c.cls || ''}">${c.label}</th>`;
      const active = highsSortCol === c.key;
      const ariaSort = active ? (highsSortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (highsSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortHighs('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('highs-body').innerHTML = rows.map((r, i) => {
    const j = r.j;
    const cells = cols.map(c => {
      if (c.key === 'rank') return `<td class="td-rank td-muted">${i + 1}</td>`;
      if (c.key === 'foto') return `<td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.foto_url || j.bref_id) ? `<img loading="lazy" class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : avatarHtml(j.nombre, 'player-thumb')}</a></td>`;
      if (c.key === 'nombre') return `<td class="td-nombre">${plLink(j.nombre, j.nombre)}</td>`;
      const v = r.best[c.key];
      const lead = (v != null && v === colMax[c.key] && colMax[c.key] > 0) ? ' td-leader' : '';
      const hl = highsSortCol === c.key ? ' td-hl' : '';
      return `<td class="td-num${hl}${lead}">${v != null ? c.fmt(v) : '—'}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
}

// ══════════════════════════════════════════════
// PÁGINA DEBUT
// ══════════════════════════════════════════════
let debutRows = [];
let debutSortCol = 'fecha';
let debutSortAsc = true;
let debutSearch = '';

const DEBUT_COLS = [
  { key: 'rank',      label: '#',       sortable: false, cls: 'td-rank' },
  { key: 'foto',      label: '',        sortable: false },
  { key: 'nombre',    label: 'Jugador', sortable: true, cls: 'td-nombre' },
  { key: 'fecha',     label: 'Fecha',   sortable: true, cls: 'td-center' },
  { key: 'edad',      label: 'Edad',    sortable: true, cls: 'td-num' },
  { key: 'equipo',    label: 'Equipo',  sortable: true, cls: 'td-center' },
  { key: 'rival',     label: 'Rival',   sortable: true, cls: 'td-center' },
  { key: 'resultado', label: 'Resultado', sortable: true, cls: 'td-center' },
  { key: 'min',       label: 'MIN',     sortable: true, cls: 'td-num' },
  { key: 'pts',       label: 'PTS',     sortable: true, cls: 'td-num' },
  { key: 'rbd',       label: 'REB',     sortable: true, cls: 'td-num' },
  { key: 'ast',       label: 'AST',     sortable: true, cls: 'td-num' },
  { key: 'stl',       label: 'ROB',     sortable: true, cls: 'td-num' },
  { key: 'blk',       label: 'TAP',     sortable: true, cls: 'td-num' },
  { key: 'tov',       label: 'TOV',     sortable: true, cls: 'td-num' },
  { key: 'pf',        label: 'PF',      sortable: true, cls: 'td-num' },
];

function debutDateKey(fecha) {
  const m = String(fecha || '').match(/(\d{1,2})\s+(\w+|\w{3})\s+(\d{4})/) || String(fecha || '').match(/(\d{1,2})\s+([a-zé]+)\s+(\d{4})/i);
  if (!m) return 0;
  const mes = MESES.indexOf(m[2].toLowerCase().slice(0, 3));
  return parseInt(m[3]) * 10000 + (mes + 1) * 100 + parseInt(m[1]);
}
function minToSec(v) {
  const m = String(v || '').match(/(\d+):(\d+)/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : (parseFloat(v) || 0);
}

async function initDebutPage() {
  let jugadores;
  try { jugadores = (await loadData()).jugadores || []; }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }

  buildPlayerIds(jugadores);
  debutRows = jugadores.filter(j => j.primer_partido && j.primer_partido.fecha).map(j => {
    const p = j.primer_partido;
    return {
      id: j.id, nombre: j.nombre, foto_url: j.foto_url, bref_id: j.bref_id,
      fecha: p.fecha, edad: p.edad ?? null,
      equipo: p.equipo || '', rival: p.rival || '', resultado: p.resultado || '',
      min: p.min || '', pts: p.pts, rbd: p.rbd, ast: p.ast, stl: p.stl ?? null, blk: p.blk ?? null,
      tov: p.tov ?? null, pf: p.pf ?? null,
      _key: debutDateKey(p.fecha), _min: minToSec(p.min),
    };
  });

  document.getElementById('hero-sub').textContent = `${debutRows.length} debuts en la NBA`;
  renderDebutKpis();
  document.getElementById('debut-search').addEventListener('input', e => { debutSearch = e.target.value.trim().toLowerCase(); renderDebutTable(); });
  renderDebutTable();
}

function renderDebutKpis() {
  const primero = [...debutRows].sort((a, b) => a._key - b._key)[0];
  const masPuntos = [...debutRows].sort((a, b) => (b.pts || 0) - (a.pts || 0))[0];
  document.getElementById('debut-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-num">${debutRows.length}</div><div class="kpi-label">Debutantes</div></div>
    <div class="kpi"><div class="kpi-num">${primero ? primero.fecha.match(/\d{4}/)[0] : '—'}</div><div class="kpi-label">Primer debut · ${primero ? primero.nombre : ''}</div></div>
    <div class="kpi"><div class="kpi-num">${masPuntos ? masPuntos.pts : '—'}</div><div class="kpi-label">Mejor debut (pts) · ${masPuntos ? masPuntos.nombre : ''}</div></div>`;
}

function sortDebut(col) {
  if (debutSortCol === col) debutSortAsc = !debutSortAsc;
  else { debutSortCol = col; debutSortAsc = (col === 'fecha' || col === 'nombre' || col === 'equipo' || col === 'rival'); }
  renderDebutTable();
}

function renderDebutTable() {
  let rows = debutRows.filter(r => !debutSearch || r.nombre.toLowerCase().includes(debutSearch));
  rows.sort((a, b) => {
    let va, vb;
    if (debutSortCol === 'fecha') { va = a._key; vb = b._key; }
    else if (debutSortCol === 'min') { va = a._min; vb = b._min; }
    else if (['pts', 'rbd', 'ast', 'stl', 'blk', 'tov', 'pf', 'edad'].includes(debutSortCol)) { va = a[debutSortCol] ?? -1; vb = b[debutSortCol] ?? -1; }
    else { va = String(a[debutSortCol] || ''); vb = String(b[debutSortCol] || ''); return debutSortAsc ? va.localeCompare(vb) : vb.localeCompare(va); }
    return debutSortAsc ? va - vb : vb - va;
  });

  document.getElementById('debut-count').textContent = `${rows.length} debut${rows.length === 1 ? '' : 's'}`;

  // Máximo por categoría (para resaltar al líder en dorado); solo si el máximo es > 0
  const DEBUT_STATS = ['pts', 'rbd', 'ast', 'stl', 'blk', 'tov', 'pf'];
  const dMax = {};
  DEBUT_STATS.forEach(k => { dMax[k] = Math.max(...debutRows.map(r => r[k] ?? -Infinity)); });
  const dMaxMin = Math.max(...debutRows.map(r => r._min ?? -Infinity));
  const gold = (k, v) => (v != null && dMax[k] > 0 && v === dMax[k]) ? ' td-leader' : '';

  document.getElementById('debut-thead').innerHTML = `<tr>
    ${DEBUT_COLS.map(c => {
      if (!c.sortable) return `<th scope="col" class="${c.cls || ''}">${c.label}</th>`;
      const active = debutSortCol === c.key;
      const ariaSort = active ? (debutSortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (debutSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortDebut('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('debut-body').innerHTML = rows.map((r, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-foto"><a class="pl-link" href="${jugadorHref(r.id)}">${(r.foto_url || r.bref_id) ? `<img loading="lazy" class="player-thumb" src="${r.foto_url || `https://www.basketball-reference.com/req/202605210/images/headshots/${r.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : avatarHtml(r.nombre, 'player-thumb')}</a></td>
      <td class="td-nombre">${plLink(r.nombre, r.nombre)}</td>
      <td class="td-center">${r.fecha}</td>
      <td class="td-num">${r.edad != null ? Math.floor(r.edad) : '—'}</td>
      <td class="td-center">${r.equipo || '—'}</td>
      <td class="td-center">${r.rival || '—'}</td>
      <td class="td-center">${debutResultado(r.resultado)}</td>
      <td class="td-num${(r._min > 0 && r._min === dMaxMin) ? ' td-leader' : ''}">${r.min || '—'}</td>
      <td class="td-num${gold('pts', r.pts)}">${r.pts ?? '—'}</td>
      <td class="td-num${gold('rbd', r.rbd)}">${r.rbd ?? '—'}</td>
      <td class="td-num${gold('ast', r.ast)}">${r.ast ?? '—'}</td>
      <td class="td-num${gold('stl', r.stl)}">${r.stl ?? '—'}</td>
      <td class="td-num${gold('blk', r.blk)}">${r.blk ?? '—'}</td>
      <td class="td-num${gold('tov', r.tov)}">${r.tov ?? '—'}</td>
      <td class="td-num${gold('pf', r.pf)}">${r.pf ?? '—'}</td>
    </tr>`).join('') || `<tr><td colspan="${DEBUT_COLS.length}" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function debutResultado(res) {
  if (res === '' || res == null) return '—';
  const s = String(res).trim().toLowerCase();
  // Columna W de la hoja: booleano de victoria (true = ganó, false = perdió)
  if (s === 'true'  || s === 'v' || s === 'victoria') return `<span class="tr-tipo tt-sign">V</span>`;
  if (s === 'false' || s === 'd' || s === 'derrota')  return `<span class="tr-tipo tt-waive">D</span>`;
  const raw = String(res).trim();
  if (/^[vw]/i.test(raw)) return `<span class="tr-tipo tt-sign">${raw}</span>`;   // victoria/win → verde
  if (/^[dl]/i.test(raw)) return `<span class="tr-tipo tt-waive">${raw}</span>`;  // derrota/loss → rojo
  return raw;
}

// ══════════════════════════════════════════════
// PÁGINA JUGADORES (directorio)
// ══════════════════════════════════════════════
let jugsAll = [];
let jugsSearch = '';

async function initJugadoresPage() {
  let jugadores;
  try { jugadores = (await loadData()).jugadores || []; }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }

  buildPlayerIds(jugadores);
  jugsAll = [...jugadores].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  document.getElementById('hero-sub').textContent = `${jugsAll.length} jugadores · pulsa para ver su ficha`;
  document.getElementById('jug-search').addEventListener('input', e => { jugsSearch = e.target.value.trim().toLowerCase(); renderJugs(); });
  renderJugs();
}

// Año de draft, o de debut si no fue drafteado (sin posición)
function jugMeta(j) {
  if (j.draft && j.draft_anio) return `Draft ${j.draft_anio}`;
  const m = String((j.primer_partido && j.primer_partido.fecha) || '').match(/(\d{4})/);
  if (m) return `Debut ${m[1]}`;
  const ys = (j.temporadas_data || []).map(t => t.year).filter(Boolean);
  if (ys.length) return `Debut ${Math.min(...ys) - 1}`;
  return '—';
}

function renderJugs() {
  const rows = jugsAll.filter(j => !jugsSearch || j.nombre.toLowerCase().includes(jugsSearch));
  document.getElementById('jug-count').textContent = `${rows.length} jugador${rows.length === 1 ? '' : 'es'}`;

  document.getElementById('jugs-grid').innerHTML = rows.map(j => {
    const src = j.foto_url || (j.bref_id ? `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg` : '');
    const meta = jugMeta(j);
    return `<a class="jug-card" href="${jugadorHref(j.id)}">
      ${src ? `<span class="jug-card-photo"><img loading="lazy" src="${src}" onerror="this.remove()" alt=""></span>` : avatarHtml(j.nombre, 'jug-card-photo')}
      <span class="jug-card-info">
        <span class="jug-card-name">${j.nombre}</span>
        <span class="jug-card-meta">${meta}</span>
      </span>
    </a>`;
  }).join('') || '<p class="td-muted" style="padding:2rem">Sin resultados.</p>';
}

// ══════════════════════════════════════════════
// PÁGINA LÍNEA TEMPORAL (trayectorias por equipo/temporada)
// ══════════════════════════════════════════════
const TEAM_INFO = {
  ATL: { name: 'Atlanta Hawks',          label: 'Atlanta',       color: '#c83a3a' },
  BOS: { name: 'Boston Celtics',         label: 'Boston',        color: '#1e5e3a' },
  BKN: { name: 'Brooklyn Nets',          label: 'Brooklyn',      color: '#1a1a1a' },
  CHA: { name: 'Charlotte Hornets',      label: 'Charlotte',     color: '#3a7a6a' },
  CHI: { name: 'Chicago Bulls',          label: 'Chicago',       color: '#b23a3a' },
  CLE: { name: 'Cleveland Cavaliers',    label: 'Cleveland',     color: '#6a1e3a' },
  DAL: { name: 'Dallas Mavericks',       label: 'Dallas',        color: '#14459c' },
  DEN: { name: 'Denver Nuggets',         label: 'Denver',        color: '#1f3a78' },
  DET: { name: 'Detroit Pistons',        label: 'Detroit',       color: '#1d4b94' },
  GSW: { name: 'Golden State Warriors',  label: 'Golden State',  color: '#1f4a9c' },
  HOU: { name: 'Houston Rockets',        label: 'Houston',       color: '#b23a3a' },
  IND: { name: 'Indiana Pacers',         label: 'Indiana',       color: '#1f3a78' },
  LAC: { name: 'Los Angeles Clippers',   label: 'LA Clippers',   color: '#d13b45' },
  LAL: { name: 'Los Angeles Lakers',     label: 'Los Angeles Lakers', color: '#e6b53c', text: '#1b1916' },
  MEM: { name: 'Memphis Grizzlies',      label: 'Memphis',       color: '#4a78b8' },
  MIA: { name: 'Miami Heat',             label: 'Miami',         color: '#8f2b2b' },
  MIL: { name: 'Milwaukee Bucks',        label: 'Milwaukee',     color: '#27624c' },
  MIN: { name: 'Minnesota Timberwolves', label: 'Minnesota',     color: '#1f4a78' },
  NOL: { name: 'New Orleans Pelicans',   label: 'New Orleans',   color: '#1f3a4a' },
  NOP: { name: 'New Orleans Pelicans',   label: 'New Orleans',   color: '#1f3a4a' },
  NYK: { name: 'New York Knicks',        label: 'New York',      color: '#f47b2e' },
  OKC: { name: 'Oklahoma City Thunder',  label: 'Oklahoma City', color: '#12a5d6' },
  ORL: { name: 'Orlando Magic',          label: 'Orlando',       color: '#0a2f5e' },
  PHI: { name: 'Philadelphia 76ers',     label: 'Philadelphia',  color: '#2e6fb8' },
  PHX: { name: 'Phoenix Suns',           label: 'Phoenix',       color: '#e68a1f' },
  POR: { name: 'Portland Trail Blazers', label: 'Portland',      color: '#8f2b2b' },
  SAC: { name: 'Sacramento Kings',       label: 'Sacramento',    color: '#5a3e8c' },
  SAS: { name: 'San Antonio Spurs',      label: 'San Antonio',   color: '#1a1a1a' },
  TOR: { name: 'Toronto Raptors',        label: 'Toronto',       color: '#c8353b' },
  UTA: { name: 'Utah Jazz',              label: 'Utah',          color: '#5b2e8e' },
  WAS: { name: 'Washington Wizards',     label: 'Washington',    color: '#1f3a78' },
};
function teamInfo(code) { return TEAM_INFO[code] || { name: code, label: code, color: '#6b7280' }; }

// año -> [equipos] (cronológico, sin TOT)
function seasonTeams(j) {
  const map = {};
  (j.temporadas_data || []).forEach(t => {
    const y = t.year, tm = (t.team || '').toUpperCase();
    if (!y || !tm || tm === 'TOT') return;
    (map[y] = map[y] || []).push(tm);
  });
  return map;
}
function tlDebutYear(j, first) {
  const m = String((j.primer_partido && j.primer_partido.fecha) || '').match(/(\d{4})/);
  if (m) return m[1];
  return first != null ? String(first - 1) : '';
}
function tlSeas(j, seasons) {
  return j.temporadas != null ? j.temporadas : Object.keys(seasons).length;
}
function tlFmtSeas(n) { return Number.isInteger(n) ? String(n) : n.toLocaleString('es-ES', { maximumFractionDigits: 1 }); }
function tlYY(y) { return `’${String(y).slice(-2)}`; }

// Temporadas previstas (jugadores aún sin debutar / próxima temporada), por nombre normalizado.
// Año = temporada NBA (fin): 2027 = 2026-27.
const TL_PROYECTADAS = {
  'sergio de larrea': [[2027, 'DAL']],
  'baba miller':      [[2027, 'LAC']],
  'aday mara':        [[2027, 'OKC']],
  'hugo gonzalez':    [[2027, 'BOS']],
  'santi aldama':     [[2027, 'DAL']],
};

// Estado especial por (jugador, año): 'cut' = cortado a media temporada · 'tw' = two-way · 'tw-cut' = two-way cortado
const TL_ESTADO = {
  'serge ibaka':          { 2023: 'cut' },
  'victor claver':        { 2015: 'cut' },
  'alex abrines':         { 2019: 'cut' },
  'juancho hernangomez':  { 2023: 'cut' },
  'ricky rubio':          { 2023: 'cut' },
  'usman garuba':         { 2024: 'tw' },
};

// Jugadores que no están en data.json (se añaden a mano a la línea temporal)
const TL_EXTRA = [
  { nombre: 'Eli Ndiaye', id: null, seasons: { 2026: ['ATL'] }, estado: { 2026: 'tw-cut' }, total: 0.5, debut: '2026' },
];

// Anillos NBA por (jugador, año) → equipo campeón
const TL_ANILLOS = {
  'pau gasol':   { 2009: 'LAL', 2010: 'LAL' },
  'marc gasol':  { 2019: 'TOR' },
  'serge ibaka': { 2019: 'TOR' },
};

// Corrección del orden cronológico de equipos en un año multi-equipo
const TL_ORDEN = {
  'nikola mirotic': { 2018: ['CHI', 'NOL'] },   // primero Chicago, luego New Orleans
};

// Cara del jugador (foto) con las iniciales de respaldo si no carga / no hay foto
function tlFace(p) {
  const j = p.j || {};
  const src = j.foto_url || (j.bref_id ? `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg` : '');
  return `<span class="tl-facewrap">${avatarHtml(j.nombre, 'tl-avatar')}${src ? `<img loading="lazy" class="tl-face" src="${src}" onerror="this.remove()" alt="">` : ''}</span>`;
}

// Celda de un año con estado especial (cortado / two-way). fc = clases de conexión (fl/fr)
function tlSpecialCell(tm, est, year, fc, idx) {
  const info = teamInfo(tm);
  const st = `background-color:${info.color};color:${info.text || '#fff'}`;
  const per = drSeason(year);
  fc = fc || '';
  const dc = `data-c0="${idx}" data-c1="${idx}"`;
  if (est === 'tw')
    return `<td class="tl-cell tl-tw${fc}" data-team="${tm}" ${dc} style="${st}" title="${info.name} · contrato two-way · ${per}"><span class="tl-lbl">${tm}</span></td>`;
  if (est === 'cut')
    return `<td class="tl-cell tl-split${fc}" ${dc} title="${info.name} · cortado a mitad de temporada · ${per}"><div class="tl-segrow"><span class="tl-seg" data-team="${tm}" style="${st}">${tm}</span><span class="tl-seg tl-cut-half">–</span></div></td>`;
  return `<td class="tl-cell tl-split${fc}" ${dc} title="${info.name} · two-way, cortado · ${per}"><div class="tl-segrow"><span class="tl-seg tl-tw" data-team="${tm}" style="${st}">${tm}</span><span class="tl-seg tl-cut-half">–</span></div></td>`;
}

// Resalta la columna de un año al pasar el ratón por su cabecera
function tlHighlightCol(idx) {
  tlClearCol();
  const t = document.getElementById('tl-table');
  if (!t) return;
  t.querySelectorAll(`.tl-year[data-idx="${idx}"]`).forEach(el => el.classList.add('tl-colhl'));
  t.querySelectorAll('#tl-body [data-c0], #tl-tfoot [data-c0]').forEach(td => {
    const a = +td.dataset.c0, b = +td.dataset.c1;
    if (idx >= a && idx <= b) td.classList.add('tl-colhl');
  });
}
function tlClearCol() {
  const t = document.getElementById('tl-table');
  if (t) t.querySelectorAll('.tl-colhl').forEach(el => el.classList.remove('tl-colhl'));
}

let tlPlayers = [];
let tlAxis = [];
let tlSortMode = 'debut';
let tlYearFrom = null;
let tlYearTo = null;

async function initLineaTemporalPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);

  tlPlayers = (data.jugadores || []).map(j => {
    const key = drNorm(j.nombre);
    const real = seasonTeams(j);
    const orden = TL_ORDEN[key] || {};
    Object.keys(orden).forEach(y => { if (real[y]) real[y] = orden[y]; });   // corrige orden de equipos
    const proj = TL_PROYECTADAS[key] || [];
    const seasons = { ...real };
    const projYears = new Set();
    proj.forEach(([y, tm]) => { if (!seasons[y]) seasons[y] = [tm]; projYears.add(y); });
    return { j, real, seasons, projYears, proj, estado: TL_ESTADO[key] || {}, rings: TL_ANILLOS[key] || {} };
  }).filter(p => Object.keys(p.seasons).length);

  tlPlayers.forEach(p => {
    const ys = Object.keys(p.seasons).map(Number);
    p.first = Math.min(...ys);
    const realCount = p.j.temporadas != null ? p.j.temporadas : Object.keys(p.real).length;
    // Temporada cortada a media = 0,5
    const cutCount = Object.keys(p.real).filter(y => p.estado[y] === 'cut' || p.estado[y] === 'tw-cut').length;
    const projNew = p.proj.filter(([y]) => !p.real[y]).length;
    p.total = realCount - 0.5 * cutCount + projNew;
  });

  // Jugadores fuera del data.json (Ndiaye, etc.)
  TL_EXTRA.forEach(e => {
    tlPlayers.push({
      j: { nombre: e.nombre, id: e.id, temporadas: null }, seasons: e.seasons, estado: e.estado || {},
      projYears: new Set(), proj: [], first: Math.min(...Object.keys(e.seasons).map(Number)),
      total: e.total, _debut: e.debut,
    });
  });

  const allYears = [...new Set(tlPlayers.flatMap(p => Object.keys(p.seasons).map(Number)))].sort((a, b) => a - b);
  const dataMax = allYears[allYears.length - 1];
  const years = [...allYears];
  for (let y = dataMax + 1; y <= dataMax + 1; y++) years.push(y);   // un año de margen
  tlAxis = [];
  for (let i = 0; i < years.length; i++) {
    if (i > 0 && years[i] - years[i - 1] > 1) tlAxis.push({ brk: [years[i - 1] + 1, years[i] - 1] });
    tlAxis.push(years[i]);
  }

  document.getElementById('hero-sub').textContent =
    `${tlPlayers.length} jugadores · desde ${allYears[0]} · en qué equipo estuvo cada uno, temporada a temporada`;

  // Filtro de años
  const yc = tlAxis.filter(c => typeof c === 'number');
  tlYearFrom = yc[0]; tlYearTo = yc[yc.length - 1];
  buildTlYearOptions(yc);

  // Resaltar por equipo al pasar el ratón sobre una barra
  const body = document.getElementById('tl-body');
  body.addEventListener('mouseover', e => { const el = e.target.closest('[data-team]'); tlFocusTeam(el ? el.getAttribute('data-team') : null); });
  body.addEventListener('mouseleave', () => tlFocusTeam(null));

  renderTimeline();
}

function setTlSort(mode) {
  tlSortMode = mode;
  ['debut', 'seas', 'alpha'].forEach(m => {
    const btn = document.getElementById('tl-sort-' + m);
    if (btn) { btn.classList.toggle('active', m === mode); btn.setAttribute('aria-pressed', String(m === mode)); }
  });
  renderTimeline();
}

function renderTimeline() {
  // Rango de años seleccionado
  const yearCols = tlAxis.filter(c => typeof c === 'number');
  const fromY = tlYearFrom != null ? tlYearFrom : yearCols[0];
  const toY = tlYearTo != null ? tlYearTo : yearCols[yearCols.length - 1];
  const years = yearCols.filter(y => y >= fromY && y <= toY);
  const yearSet = new Set(years);
  const axis = [];
  for (let k = 0; k < years.length; k++) {
    if (k > 0 && years[k] - years[k - 1] > 1) axis.push({ brk: [years[k - 1] + 1, years[k] - 1] });
    axis.push(years[k]);
  }

  let players = tlPlayers.filter(p => Object.keys(p.seasons).some(y => +y >= fromY && +y <= toY));
  if (tlSortMode === 'seas') players.sort((a, b) => b.total - a.total || a.first - b.first);
  else if (tlSortMode === 'alpha') players.sort((a, b) => a.j.nombre.localeCompare(b.j.nombre, 'es'));
  else players.sort((a, b) => a.first - b.first || a.j.nombre.localeCompare(b.j.nombre));

  const activeBy = {};
  players.forEach(p => years.forEach(y => { if (p.seasons[y]) activeBy[y] = (activeBy[y] || 0) + 1; }));

  // Cabecera
  const headCells = axis.map((c, idx) => (typeof c === 'object')
    ? `<th class="tl-break">${tlYY(c.brk[0])}–${tlYY(c.brk[1])}</th>`
    : `<th class="tl-year" data-idx="${idx}" onmouseenter="tlHighlightCol(${idx})" onmouseleave="tlClearCol()">${tlYY(c)}</th>`).join('');
  document.getElementById('tl-thead').innerHTML =
    `<tr><th class="tl-name-h" scope="col">Jugador</th><th class="tl-debut-h" scope="col">Debut</th>${headCells}<th class="tl-seas-h" scope="col">Total</th></tr>`;

  // Filas de jugadores
  document.getElementById('tl-body').innerHTML = players.map(p => {
    // Conectar bloques: un año engancha con el vecino si el equipo continúa (traspasos/cortes)
    const lTeam = y => { const t = p.seasons[y]; return t ? t[0] : null; };
    const rTeam = y => { const t = p.seasons[y]; return t ? t[t.length - 1] : null; };
    const connL = y => yearSet.has(y - 1) && !!p.seasons[y - 1] && rTeam(y - 1) === lTeam(y);
    const connR = y => yearSet.has(y + 1) && !!p.seasons[y + 1] && lTeam(y + 1) === rTeam(y);
    const flush = (l, r) => (l ? ' fl' : '') + (r ? ' fr' : '');

    const cells = [];
    let i = 0;
    while (i < axis.length) {
      const c = axis[i];
      if (typeof c === 'object') { cells.push(`<td class="tl-break" data-c0="${i}" data-c1="${i}"></td>`); i++; continue; }
      const teams = p.seasons[c];
      if (!teams || !teams.length) { cells.push(`<td class="tl-empty" data-c0="${i}" data-c1="${i}"></td>`); i++; continue; }
      if (teams.length > 1) {
        const segs = teams.map(tm => {
          const info = teamInfo(tm);
          return `<span class="tl-seg" data-team="${tm}" style="background-color:${info.color};color:${info.text || '#fff'}" title="${info.name} · ${drSeason(c)}${p.rings[c] === tm ? ' · campeón' : ''}">${tm}</span>`;
        }).join('');
        // El anillo se centra en el año (no en el segmento) para alinearlo con otros campeones del mismo año
        const ringHtml = p.rings[c] ? `<span class="tl-ring" style="left:50%">🏆</span>` : '';
        cells.push(`<td class="tl-cell tl-split${flush(connL(c), connR(c))}" data-c0="${i}" data-c1="${i}" title="${teams.map(t => teamInfo(t).name).join(' → ')} · ${drSeason(c)}"><div class="tl-segrow">${segs}</div>${ringHtml}</td>`);
        i++; continue;
      }
      const tm = teams[0];
      if (p.estado[c]) { cells.push(tlSpecialCell(tm, p.estado[c], c, flush(connL(c), connR(c)), i)); i++; continue; }
      let span = 1, j = i + 1;
      while (j < axis.length && typeof axis[j] !== 'object') {
        const ts = p.seasons[axis[j]];
        if (!ts || ts.length !== 1 || ts[0] !== tm || p.estado[axis[j]]) break;
        span++; j++;
      }
      const info = teamInfo(tm);
      const y0 = c, y1 = axis[i + span - 1];
      const ringOffs = [];
      for (let k = i; k < i + span; k++) if (p.rings[axis[k]] === tm) ringOffs.push(k - i);
      const ringHtml = ringOffs.map(off => `<span class="tl-ring" style="left:${((off + 0.5) / span * 100).toFixed(1)}%">🏆</span>`).join('');
      const label = span >= 4 ? info.label : tm;
      const per = y1 !== y0 ? `${drSeason(y0)}–${drSeason(y1)}` : drSeason(y0);
      cells.push(`<td class="tl-cell${flush(connL(y0), connR(y1))}" data-team="${tm}" data-c0="${i}" data-c1="${i + span - 1}" colspan="${span}" style="background-color:${info.color};color:${info.text || '#fff'}" title="${info.name} · ${per}${ringOffs.length ? ' · ' + ringOffs.length + '× campeón' : ''}"><span class="tl-lbl">${label}</span>${ringHtml}</td>`);
      i += span;
    }
    const nTeams = new Set(Object.values(p.seasons).flat()).size;
    return `<tr>
      <th scope="row" class="tl-name"><span class="tl-namewrap">${tlFace(p)}${p.j.id ? `<a class="pl-link tl-pname" href="${jugadorHref(p.j.id)}">${p.j.nombre}</a>` : `<span class="tl-pname">${p.j.nombre}</span>`}</span></th>
      <td class="tl-debut">${p._debut || tlDebutYear(p.j, p.first)}</td>
      ${cells.join('')}
      <td class="tl-seas">${tlFmtSeas(p.total)}<span class="tl-nteams">${nTeams} eq.</span></td>
    </tr>`;
  }).join('');

  // Fila de conteo (españoles activos por temporada)
  const footCells = axis.map((c, idx) => (typeof c === 'object')
    ? `<td class="tl-break" data-c0="${idx}" data-c1="${idx}"></td>`
    : `<td class="tl-count" data-c0="${idx}" data-c1="${idx}">${activeBy[c] || ''}</td>`).join('');
  const totalSeas = players.reduce((s, p) => s + p.total, 0);
  document.getElementById('tl-tfoot').innerHTML =
    `<tr><td class="tl-name-f">Españoles activos</td><td class="tl-debut"></td>${footCells}<td class="tl-seas tl-seas-total">${tlFmtSeas(totalSeas)}</td></tr>`;
}

// Resaltar todas las etapas de un equipo al pasar el ratón
let tlFocusLast = null;
function tlFocusTeam(code) {
  if (code === tlFocusLast) return;
  tlFocusLast = code;
  const t = document.getElementById('tl-table');
  if (!t) return;
  const els = t.querySelectorAll('[data-team]');
  if (!code) { t.classList.remove('tl-focusing'); els.forEach(el => el.classList.remove('tl-match')); return; }
  t.classList.add('tl-focusing');
  els.forEach(el => el.classList.toggle('tl-match', el.getAttribute('data-team') === code));
}

function buildTlYearOptions(years) {
  const from = document.getElementById('tl-from'), to = document.getElementById('tl-to');
  if (!from || !to) return;
  const opts = years.map(y => `<option value="${y}">${drSeason(y)}</option>`).join('');
  from.innerHTML = opts; to.innerHTML = opts;
  from.value = String(tlYearFrom); to.value = String(tlYearTo);
  from.onchange = () => { tlYearFrom = +from.value; if (tlYearFrom > tlYearTo) { tlYearTo = tlYearFrom; to.value = String(tlYearTo); } renderTimeline(); };
  to.onchange = () => { tlYearTo = +to.value; if (tlYearTo < tlYearFrom) { tlYearFrom = tlYearTo; from.value = String(tlYearFrom); } renderTimeline(); };
}

// ══════════════════════════════════════════════
// PÁGINA COMPARADOR
// ══════════════════════════════════════════════
let cmpAll = [];
// Modo de comparación: 'career' (toda la carrera), 'same' (una misma temporada
// para los dos) o 'diff' (rangos distintos para cada jugador).
let cmpMode = 'career';
let cmpSame = null;                                   // año elegido en modo 'same'
let cmpState = { a: { id: null, from: null, to: null }, b: { id: null, from: null, to: null } };
// Temporadas que ambos jugadores disputaron (para 'misma temporada')
function cmpCommon(A, B) {
  const sb = new Set(cmpSeasons(B));
  return cmpSeasons(A).filter(y => sb.has(y));
}

// Una fila por temporada (prefiere TOT en años con traspaso)
function cmpYearRows(j) {
  const by = {};
  (j.temporadas_data || []).forEach(t => {
    const y = t.year;
    if (!y) return;
    if (!(y in by) || t.team === 'TOT') by[y] = t;
  });
  return by;
}
function cmpSeasons(j) { return Object.keys(cmpYearRows(j)).map(Number).sort((a, b) => a - b); }

// Agrega estadísticas (por partido y totales) en un rango de temporadas [from, to].
// Rango completo → usa los totales oficiales del jugador (máxima precisión).
function cmpAgg(j, from, to) {
  const seasons = cmpSeasons(j);
  if (!seasons.length) return { partidos: 0, _n: 0, _from: null, _to: null, _full: true };
  const first = seasons[0], last = seasons[seasons.length - 1];
  const lo = from || first, hi = to || last;
  const full = lo <= first && hi >= last;
  if (full) {
    return {
      partidos: j.partidos, _n: seasons.length, _from: first, _to: last, _full: true,
      min_g: j.min_g, pts_g: j.pts_g, rbd_g: j.rbd_g, ast_g: j.ast_g, stl_g: j.stl_g, blk_g: j.blk_g, tres_g: j.tres_g,
      fg_pct: j.fg_pct, tres_pct: j.tres_pct, ft_pct: j.ft_pct,
      pts_total: j.pts_total, rbd_total: j.rbd_total, ast_total: j.ast_total, stl_total: j.stl_total,
      blk_total: j.blk_total, tres_total: j.tres_total, min_total: j.min_total,
      td_total: j.td_total, tov_total: j.tov_total, pf_total: j.pf_total,
    };
  }
  const yr = cmpYearRows(j);
  const rows = seasons.filter(y => y >= lo && y <= hi).map(y => yr[y]);
  const G = rows.reduce((s, t) => s + (t.g || 0), 0);
  const tot = k => rows.reduce((s, t) => s + (t[k] || 0) * (t.g || 0), 0);
  const per = k => G ? tot(k) / G : null;
  const madeAtt = (mk, pk) => {
    let m = 0, a = 0;
    rows.forEach(t => { const mm = (t[mk] || 0) * (t.g || 0); m += mm; const p = t[pk]; if (p) a += mm / p; });
    return [m, a];
  };
  const [fgm, fga] = madeAtt('fgm_g', 'fg_pct');
  const [t3m, t3a] = madeAtt('tres_g', 'tres_pct');
  const [ftm, fta] = madeAtt('ftm_g', 'ft_pct');
  return {
    partidos: G, _n: rows.length, _from: lo, _to: hi, _full: false,
    min_g: per('min_g'), pts_g: per('pts_g'), rbd_g: per('rbd_g'), ast_g: per('ast_g'),
    stl_g: per('stl_g'), blk_g: per('blk_g'), tres_g: per('tres_g'),
    fg_pct: fga ? fgm / fga : null, tres_pct: t3a ? t3m / t3a : null, ft_pct: fta ? ftm / fta : null,
    pts_total: tot('pts_g'), rbd_total: tot('rbd_g'), ast_total: tot('ast_g'), stl_total: tot('stl_g'),
    blk_total: tot('blk_g'), tres_total: tot('tres_g'), min_total: tot('min_g'),
    td_total: rows.reduce((s, t) => s + (t.td || 0), 0), tov_total: tot('tov_g'), pf_total: tot('pf_g'),
  };
}

function cmpNTeams(j) {
  const s = new Set((j.temporadas_data || []).map(t => (t.team || '').toUpperCase()).filter(t => t && t !== 'TOT'));
  if (s.size) return s.size;
  const n = (j.equipos_nba || '').split(/[,/]/).map(x => x.trim()).filter(Boolean).length;
  return n || null;
}
function cmpPremios(j, filter) {
  const p = j.premios || [];
  return (filter ? p.filter(filter).length : p.length) || null;
}
function cmpPoSeasons(j) { return (j.playoffs_temporadas || []).filter(t => t && (t.year || t.g)).length || null; }
function cmpPoGames(j) { return (j.playoffs_temporadas || []).reduce((s, t) => s + (t.g || 0), 0) || null; }

const CMP_SECTIONS = [
  { title: 'Trayectoria', rows: [
    { label: 'Temporadas',        get: j => cmpSeasons(j).length || j.temporadas || null, fmt: fmtEnt, dir: 'high' },
    { label: 'Partidos',          get: j => j.partidos ?? null, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Partidos titular',  get: j => j.partidos_titular ?? null, fmt: fmtEnt, dir: 'high', bar: true },
    { label: '% titular',         get: j => j.partidos ? (j.partidos_titular || 0) / j.partidos : null, fmt: fmtPct, dir: 'high', bar: true },
    { label: 'Equipos NBA',       get: j => cmpNTeams(j), fmt: fmtEnt, dir: 'high' },
    { label: 'Año de draft',      get: j => j.draft_anio || null, fmt: v => String(v), dir: 'neutral' },
    { label: 'Nº de draft',       get: j => j.draft ? (j.draft_pick || null) : 'undr', fmt: v => v === 'undr' ? 'No drafteado' : ('#' + v), dir: 'low' },
  ]},
  { title: 'Por partido', ranged: true, rows: [
    { label: 'Minutos',      get: j => j.min_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'Puntos',       get: j => j.pts_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'Rebotes',      get: j => j.rbd_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'Asistencias',  get: j => j.ast_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'Robos',        get: j => j.stl_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'Tapones',      get: j => j.blk_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'Triples',      get: j => j.tres_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'FG%',          get: j => j.fg_pct, fmt: fmtPct, dir: 'high', bar: true },
    { label: '3P%',          get: j => j.tres_pct, fmt: fmtPct, dir: 'high', bar: true },
    { label: 'FT%',          get: j => j.ft_pct, fmt: fmtPct, dir: 'high', bar: true },
  ]},
  { title: 'Totales', ranged: true, rows: [
    { label: 'Puntos',         get: j => j.pts_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Rebotes',        get: j => j.rbd_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Asistencias',    get: j => j.ast_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Robos',          get: j => j.stl_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Tapones',        get: j => j.blk_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Triples',        get: j => j.tres_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Minutos',        get: j => j.min_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Triples-dobles', get: j => j.td_total ?? null, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Pérdidas',       get: j => j.tov_total ?? null, fmt: fmtEnt, dir: 'low', bar: true },
    { label: 'Faltas',         get: j => j.pf_total ?? null, fmt: fmtEnt, dir: 'low', bar: true },
  ]},
  { title: 'Máximos en un partido', when: (a, b) => a.game_highs || b.game_highs, rows: [
    { label: 'Puntos',      get: j => j.game_highs && j.game_highs.pts, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Rebotes',     get: j => j.game_highs && j.game_highs.rbd, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Asistencias', get: j => j.game_highs && j.game_highs.ast, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Robos',       get: j => j.game_highs && j.game_highs.stl, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Tapones',     get: j => j.game_highs && j.game_highs.blk, fmt: fmtEnt, dir: 'high', bar: true },
  ]},
  { title: 'Premios', when: (a, b) => (a.premios || []).length || (b.premios || []).length, rows: [
    { label: 'Premios (total)', get: j => (j.premios || []).length || null, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'All-Star',        get: j => cmpPremios(j, p => /all[\s-]?star/i.test(p.tipo) && !/concurso/i.test(p.tipo)), fmt: fmtEnt, dir: 'high' },
    { label: 'All-NBA / Defense', get: j => cmpPremios(j, p => /all[\s-]?(nba|defense)/i.test(p.tipo)), fmt: fmtEnt, dir: 'high' },
  ]},
  { title: 'Dinero', when: (a, b) => a.ganancias || b.ganancias, rows: [
    { label: 'Ganancias', get: j => j.ganancias || null, fmt: fmtDinero, dir: 'high', bar: true },
    { label: '$ por partido', get: j => (j.ganancias_ganado && j.partidos) ? j.ganancias_ganado / j.partidos : ((j.ganancias && j.partidos) ? j.ganancias / j.partidos : null), fmt: fmtDinero, dir: 'high', bar: true },
  ]},
  { title: 'Playoffs', when: (a, b) => cmpPoSeasons(a) || cmpPoSeasons(b), rows: [
    { label: 'Temporadas de playoffs', get: j => cmpPoSeasons(j), fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Partidos de playoffs',   get: j => cmpPoGames(j), fmt: fmtEnt, dir: 'high', bar: true },
  ]},
];

function cmpRow(row, A, B) {
  const vA = row.get(A), vB = row.get(B);
  const nA = typeof vA === 'number' ? vA : null;
  const nB = typeof vB === 'number' ? vB : null;
  let winA = false, winB = false;
  if (row.dir !== 'neutral' && nA != null && nB != null && nA !== nB) {
    if (row.dir === 'low') { winA = nA < nB; winB = nB < nA; }
    else { winA = nA > nB; winB = nB > nA; }
  }
  const fA = vA == null ? '—' : row.fmt(vA);
  const fB = vB == null ? '—' : row.fmt(vB);
  let barA = '', barB = '';
  if (row.bar && nA != null && nB != null) {
    const mx = Math.max(Math.abs(nA), Math.abs(nB)) || 1;
    barA = `<div class="cmp-bar a"><span class="cmp-fill${winA ? ' win' : ''}" style="width:${Math.round(Math.abs(nA) / mx * 100)}%"></span></div>`;
    barB = `<div class="cmp-bar b"><span class="cmp-fill${winB ? ' win' : ''}" style="width:${Math.round(Math.abs(nB) / mx * 100)}%"></span></div>`;
  }
  return { winA, winB, html: `<div class="cmp-row">
    <div class="cmp-cell a"><div class="cmp-val a${winA ? ' win' : ''}">${fA}</div>${barA}</div>
    <div class="cmp-metric">${row.label}</div>
    <div class="cmp-cell b"><div class="cmp-val b${winB ? ' win' : ''}">${fB}</div>${barB}</div>
  </div>` };
}

function cmpCard(j, side) {
  const src = j.foto_url || (j.bref_id ? `${BREF_HEADSHOTS}/${j.bref_id}.jpg` : '');
  const foto = src ? `<span class="cmp-photo"><img loading="lazy" src="${src}" onerror="this.remove()" alt="${j.nombre}"></span>` : `<span class="cmp-photo">${avatarHtml(j.nombre, 'cmp-avatar')}</span>`;
  const draft = j.draft ? `Draft ${j.draft_anio || ''} · #${j.draft_pick || '?'}` : 'No drafteado';
  return `<div class="cmp-card cmp-${side}">
    ${foto}
    <a class="cmp-name" href="${jugadorHref(j.id)}">${j.nombre}</a>
    <span class="cmp-meta">${draft}</span>
    <span class="cmp-meta">${j.equipos_nba || ''}</span>
  </div>`;
}

// Selector de rango de temporadas por jugador (afecta a Por partido y Totales)
// Agrega según el modo activo
function cmpAggFor(side, j) {
  if (cmpMode === 'same') return cmpSame ? cmpAgg(j, cmpSame, cmpSame) : { partidos: 0, _n: 0, _from: null, _to: null, _full: false, _empty: true };
  if (cmpMode === 'diff') return cmpAgg(j, cmpState[side].from, cmpState[side].to);
  return cmpAgg(j, null, null);
}

// Barra de modos + control asociado (una temporada, o rangos por jugador)
function cmpModeBar(A, B) {
  const common = cmpCommon(A, B);
  const chip = (m, label, on) => `<button type="button" class="toggle-chip${cmpMode === m ? ' active' : ''}" aria-pressed="${cmpMode === m}"${on === false ? ' disabled' : ''} onclick="cmpSetMode('${m}')">${label}</button>`;
  let extra = '';
  if (cmpMode === 'same') {
    if (!common.length) {
      extra = `<p class="cmp-mode-note">No coinciden en ninguna temporada NBA. Prueba «Diferentes años».</p>`;
    } else {
      const opts = common.slice().reverse().map(y => `<option value="${y}"${y === cmpSame ? ' selected' : ''}>${drSeason(y)}</option>`).join('');
      extra = `<label class="sel-wrap cmp-mode-season"><span class="tl-range-lbl">Temporada</span><select class="sel" aria-label="Temporada" onchange="cmpSetSame(this.value)">${opts}</select></label>`;
    }
  } else if (cmpMode === 'diff') {
    extra = `<p class="cmp-mode-note">Elige el tramo de cada jugador bajo su foto.</p>`;
  }
  return `<div class="cmp-mode">
    <div class="mode-switch" role="group" aria-label="Qué comparar">
      ${chip('career', 'Toda la carrera')}
      ${chip('same', 'Misma temporada', common.length > 0)}
      ${chip('diff', 'Diferentes años')}
    </div>
    ${extra}
  </div>`;
}

// Selector Desde/Hasta bajo la foto (solo en modo 'diff')
function cmpRangeUI(side, j, agg) {
  if (cmpMode !== 'diff') {
    if (cmpMode === 'same' && cmpSame) return `<div class="cmp-range cmp-range--one">${drSeason(cmpSame)}</div>`;
    return '';
  }
  const seasons = cmpSeasons(j);
  if (!seasons.length) return '';
  if (seasons.length === 1) return `<div class="cmp-range cmp-range--one">${drSeason(seasons[0])}</div>`;
  const optFrom = seasons.map(y => `<option value="${y}"${y === agg._from ? ' selected' : ''}>${drSeason(y)}</option>`).join('');
  const optTo = seasons.map(y => `<option value="${y}"${y === agg._to ? ' selected' : ''}>${drSeason(y)}</option>`).join('');
  const lbl = agg._full ? 'Toda la carrera' : `${agg._n} temp. · ${fmtEnt(agg.partidos)} GP`;
  return `<div class="cmp-range">
    <div class="cmp-range-sel">
      <select class="sel cmp-rsel" aria-label="Desde" onchange="cmpSetRange('${side}','from',this.value)">${optFrom}</select>
      <span class="cmp-range-dash">–</span>
      <select class="sel cmp-rsel" aria-label="Hasta" onchange="cmpSetRange('${side}','to',this.value)">${optTo}</select>
    </div>
    <div class="cmp-range-lbl">${lbl}</div>
  </div>`;
}

function cmpRender(A, B) {
  const aggA = cmpAggFor('a', A), aggB = cmpAggFor('b', B);
  let scoreA = 0, scoreB = 0;
  const ranged = cmpMode !== 'career';
  const noteLbl = cmpMode === 'same' ? (cmpSame ? drSeason(cmpSame) : 'sin datos') : 'rango elegido';
  const sections = CMP_SECTIONS.filter(s => !s.when || s.when(A, B)).map(s => {
    const dA = s.ranged ? aggA : A, dB = s.ranged ? aggB : B;
    const rows = s.rows.map(r => cmpRow(r, dA, dB));
    rows.forEach(r => { if (r.winA) scoreA++; if (r.winB) scoreB++; });
    const note = (s.ranged && ranged) ? `<span class="cmp-sec-note">${noteLbl}</span>` : '';
    return `<details class="cmp-section" open><summary class="cmp-sec-title">${s.title}${note}</summary>${rows.map(r => r.html).join('')}</details>`;
  }).join('');

  const head = `<div class="cmp-head">
    <div class="cmp-side">${cmpCard(A, 'a')}${cmpRangeUI('a', A, aggA)}</div>
    <div class="cmp-scoreboard">
      <div class="cmp-score"><span class="cmp-sc a${scoreA > scoreB ? ' win' : ''}">${scoreA}</span><span class="cmp-sc-sep">–</span><span class="cmp-sc b${scoreB > scoreA ? ' win' : ''}">${scoreB}</span></div>
      <div class="cmp-sc-lbl">categorías ganadas</div>
    </div>
    <div class="cmp-side">${cmpCard(B, 'b')}${cmpRangeUI('b', B, aggB)}</div>
  </div>`;
  document.getElementById('cmp-out').innerHTML = cmpModeBar(A, B) + head + sections;
}

function cmpCur(side) {
  const sel = document.getElementById('cmp-' + side);
  return cmpAll.find(j => j.id === sel.value);
}
function cmpSyncUrl() {
  updateUrlParam('a', document.getElementById('cmp-a').value);
  updateUrlParam('b', document.getElementById('cmp-b').value);
  updateUrlParam('modo', cmpMode === 'career' ? '' : cmpMode);
  updateUrlParam('se', cmpMode === 'same' ? (cmpSame || '') : '');
  const diff = cmpMode === 'diff';
  updateUrlParam('af', diff ? (cmpState.a.from || '') : '');
  updateUrlParam('at', diff ? (cmpState.a.to || '') : '');
  updateUrlParam('bf', diff ? (cmpState.b.from || '') : '');
  updateUrlParam('bt', diff ? (cmpState.b.to || '') : '');
}

async function initComparadorPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  cmpAll = (data.jugadores || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  document.getElementById('hero-sub').textContent = `Compara cara a cara a dos de los ${cmpAll.length} españoles de la NBA`;

  const opts = cmpAll.map(j => `<option value="${j.id}">${j.nombre}</option>`).join('');
  const selA = document.getElementById('cmp-a'), selB = document.getElementById('cmp-b');
  selA.innerHTML = opts; selB.innerHTML = opts;

  const params = new URLSearchParams(location.search);
  const withStats = cmpAll.filter(j => (j.partidos || 0) > 0);
  const pick = (frag, i) => (withStats.find(j => new RegExp(frag, 'i').test(j.nombre)) || withStats[i] || cmpAll[i] || cmpAll[0]).id;
  const has = id => cmpAll.some(j => j.id === id);
  const defA = params.get('a'), defB = params.get('b');
  selA.value = has(defA) ? defA : pick('pau gasol', 0);
  selB.value = has(defB) ? defB : pick('marc gasol', 1);
  if (selA.value === selB.value) selB.value = (cmpAll.find(j => j.id !== selA.value) || cmpAll[0]).id;

  cmpState.a = { id: selA.value, from: null, to: null };
  cmpState.b = { id: selB.value, from: null, to: null };

  // Restaurar modo desde la URL
  const m = params.get('modo');
  if (m === 'same' || m === 'diff') cmpMode = m;
  if (cmpMode === 'diff') {
    cmpInitRange('a', params.get('af'), params.get('at'));
    cmpInitRange('b', params.get('bf'), params.get('bt'));
  } else if (cmpMode === 'same') {
    const common = cmpCommon(cmpCur('a'), cmpCur('b'));
    const se = Number(params.get('se'));
    cmpSame = common.includes(se) ? se : (common.length ? common[common.length - 1] : null);
    if (!common.length) cmpMode = 'career';
  }

  selA.onchange = cmpUpdate; selB.onchange = cmpUpdate;
  cmpRender(cmpCur('a'), cmpCur('b'));
  cmpSyncUrl();
}

// Valida y aplica un rango de la URL a un jugador
function cmpInitRange(side, from, to) {
  const j = cmpCur(side);
  const seasons = cmpSeasons(j);
  if (seasons.length < 2) return;
  const inRange = v => { const n = Number(v); return v && seasons.includes(n) ? n : null; };
  let f = inRange(from), t = inRange(to);
  if (f && t && f > t) { const tmp = f; f = t; t = tmp; }
  cmpState[side].from = f; cmpState[side].to = t;
}

// Al cambiar de jugador, revalida las selecciones del modo activo
function cmpUpdate() {
  const idA = document.getElementById('cmp-a').value, idB = document.getElementById('cmp-b').value;
  if (cmpState.a.id !== idA) cmpState.a = { id: idA, from: null, to: null };
  if (cmpState.b.id !== idB) cmpState.b = { id: idB, from: null, to: null };
  const A = cmpAll.find(j => j.id === idA), B = cmpAll.find(j => j.id === idB);
  if (!A || !B) return;
  if (cmpMode === 'same') {
    const common = cmpCommon(A, B);
    if (!common.length) { cmpMode = 'career'; cmpSame = null; }
    else if (!common.includes(cmpSame)) cmpSame = common[common.length - 1];
  }
  cmpRender(A, B); cmpSyncUrl();
}

function cmpSetMode(m) {
  cmpMode = m;
  if (m === 'same') {
    const common = cmpCommon(cmpCur('a'), cmpCur('b'));
    if (!common.includes(cmpSame)) cmpSame = common.length ? common[common.length - 1] : null;
  }
  cmpRender(cmpCur('a'), cmpCur('b'));
  cmpSyncUrl();
}
function cmpSetSame(value) {
  cmpSame = Number(value);
  cmpRender(cmpCur('a'), cmpCur('b'));
  cmpSyncUrl();
}

function cmpSetRange(side, which, value) {
  const v = Number(value);
  const st = cmpState[side];
  if (which === 'from') { st.from = v; if (st.to != null && st.to < v) st.to = v; }
  else { st.to = v; if (st.from != null && st.from > v) st.from = v; }
  cmpRender(cmpCur('a'), cmpCur('b'));
  cmpSyncUrl();
}

function cmpSwap() {
  const a = document.getElementById('cmp-a'), b = document.getElementById('cmp-b');
  const t = a.value; a.value = b.value; b.value = t;
  const tmp = cmpState.a; cmpState.a = cmpState.b; cmpState.b = tmp;
  cmpRender(cmpCur('a'), cmpCur('b'));
  cmpSyncUrl();
}

// ══════════════════════════════════════════════
// TEMPORADAS — todas las temporadas de todos los españoles (filtrable)
// ══════════════════════════════════════════════
let tmpRows = [], tmpMode = 'total';
let tmpSortCol = 'year', tmpSortAsc = false;
let tmpFilterTeam = '', tmpFilterYear = '', tmpSearch = '', tmpHidePartials = false;

// Estadísticas por partido; en 'total' se multiplican por los partidos (salvo
// TD, que ya es un conteo de temporada). Los porcentajes solo en 'por partido'.
const TMP_COLS = [
  { key: 'min_g', label: 'MIN' }, { key: 'pts_g', label: 'PTS' }, { key: 'rbd_g', label: 'REB' },
  { key: 'ast_g', label: 'AST' }, { key: 'stl_g', label: 'ROB' }, { key: 'blk_g', label: 'TAP' },
  { key: 'fgm_g', label: 'FGM' }, { key: 'tres_g', label: '3PM' }, { key: 'ftm_g', label: 'FTM' },
  { key: 'tov_g', label: 'TOV' }, { key: 'pf_g', label: 'PF' },
];
const TMP_TD = { key: 'td', label: 'TD' };
const TMP_PCT = [{ key: 'fg_pct', label: 'FG%' }, { key: 'tres_pct', label: '3P%' }, { key: 'ft_pct', label: 'FT%' }];

// Columnas de estadística según el modo, con función de valor y formato
function tmpStatCols() {
  const cols = TMP_COLS.map(c => ({
    key: c.key, label: c.label,
    val: r => tmpMode === 'total' ? ((r.t[c.key] != null && r.g) ? r.t[c.key] * r.g : null) : (r.t[c.key] != null ? r.t[c.key] : null),
    fmt: tmpMode === 'total' ? fmtEnt : fmtDec1,
  }));
  if (tmpMode === 'total') cols.push({ key: 'td', label: 'TD', val: r => r.t.td != null ? r.t.td : null, fmt: fmtEnt });
  else TMP_PCT.forEach(c => cols.push({ key: c.key, label: c.label, val: r => r.t[c.key] != null ? r.t[c.key] : null, fmt: fmtPct }));
  return cols;
}

// ¿El jugador fue cortado (waived) a mitad de esa temporada? (lista de la Línea temporal)
function tmpIsCut(nombre, year) {
  const e = TL_ESTADO[drNorm(nombre)];
  const v = e && e[year];
  return v === 'cut' || v === 'tw-cut';
}

// Aplana todas las temporadas. En un año con traspaso muestra la fila TOT
// (total de la temporada) y, debajo, cada tramo parcial por equipo. Marca la
// fila total, las parciales y las temporadas cortadas (waived → media).
function tmpBuild(jugadores) {
  const rows = [];
  (jugadores || []).forEach(j => {
    const foto = j.foto_url || (j.bref_id ? `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg` : '');
    const byYear = {};
    (j.temporadas_data || []).forEach(t => { if (t.year) (byYear[t.year] = byYear[t.year] || []).push(t); });
    Object.keys(byYear).forEach(y => {
      const arr = byYear[y];
      const tot = arr.find(t => String(t.team || '').toUpperCase() === 'TOT');
      const teams = arr.filter(t => String(t.team || '').toUpperCase() !== 'TOT').sort((a, b) => (b.g || 0) - (a.g || 0));
      const traded = !!tot, cut = tmpIsCut(j.nombre, +y);
      if (tot) rows.push({ id: j.id, jugador: j.nombre, foto, year: +y, team: teams.map(t => t.team).join(' / ') || 'TOT', teamCode: null, g: tot.g || 0, t: tot, kind: 'total', nEq: teams.length, seq: 0, cut: false });
      teams.forEach((t, i) => rows.push({ id: j.id, jugador: j.nombre, foto, year: +y, team: t.team || '—', teamCode: t.team || '', g: t.g || 0, t, kind: traded ? 'partial' : 'normal', nEq: teams.length, seq: i + 1, cut }));
    });
  });
  return rows;
}

function tmpSortVal(r, col) {
  if (col === 'jugador') return r.jugador;
  if (col === 'team') return r.team;
  if (col === 'year') return r.year;
  if (col === 'g') return r.g;
  const sc = tmpStatCols().find(c => c.key === col);
  return sc ? sc.val(r) : 0;
}

function renderTmpTable() {
  const stat = tmpStatCols();
  const cols = [
    { key: 'jugador', label: 'Jugador', cls: 'td-nombre', str: true },
    { key: 'year', label: 'Año', cls: 'td-center' },
    { key: 'team', label: 'Equipo', cls: 'td-center', str: true },
    { key: 'g', label: 'GP', cls: 'td-num' },
    ...stat.map(c => ({ key: c.key, label: c.label, cls: 'td-num' })),
  ];

  // Al filtrar por un equipo concreto, las filas TOT (sin equipo propio) se ocultan
  let rows = tmpRows.filter(r =>
    (!tmpSearch || r.jugador.toLowerCase().includes(tmpSearch)) &&
    (!tmpFilterTeam || r.teamCode === tmpFilterTeam) &&
    (!tmpFilterYear || r.year === +tmpFilterYear) &&
    !(tmpHidePartials && r.kind === 'partial'));

  const dir = tmpSortAsc ? 1 : -1;
  rows.sort((a, b) => {
    const va = tmpSortVal(a, tmpSortCol), vb = tmpSortVal(b, tmpSortCol);
    let cmp;
    if (typeof va === 'string' || typeof vb === 'string') cmp = String(va).localeCompare(String(vb), 'es');
    else cmp = (va == null ? -Infinity : va) - (vb == null ? -Infinity : vb);
    if (cmp !== 0) return cmp * dir;
    return (b.year - a.year) || a.jugador.localeCompare(b.jugador, 'es') || (a.seq - b.seq); // desempate: total antes que parciales
  });

  document.getElementById('tmp-count').textContent = `${rows.length} fila${rows.length === 1 ? '' : 's'}`;

  // Mejor valor de cada estadística entre las temporadas completas visibles
  // (se excluyen los tramos parciales para no comparar fragmentos con años enteros)
  const leaderRows = rows.filter(r => r.kind !== 'partial');
  const maxByKey = {};
  stat.forEach(c => {
    let mx = null;
    leaderRows.forEach(r => { const v = c.val(r); if (v != null && (mx == null || v > mx)) mx = v; });
    maxByKey[c.key] = mx;
  });

  document.getElementById('tmp-thead').innerHTML = `<tr>${cols.map(c => {
    const active = tmpSortCol === c.key;
    const ariaSort = active ? (tmpSortAsc ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (tmpSortAsc ? ' asc' : '') : ''}" aria-sort="${ariaSort}" onclick="sortTmp('${c.key}')">${c.label}</th>`;
  }).join('')}</tr>`;

  document.getElementById('tmp-tbody').innerHTML = rows.map(r => {
    const statCells = stat.map(c => {
      const v = c.val(r);
      const hl = tmpSortCol === c.key ? ' td-hl' : '';
      const lead = (r.kind !== 'partial' && v != null && maxByKey[c.key] > 0 && v === maxByKey[c.key]) ? ' td-leader' : '';
      return `<td class="td-num${hl}${lead}">${v == null ? '—' : c.fmt(v)}</td>`;
    }).join('');
    let teamCell = r.team, cls = '', title = '';
    if (r.kind === 'total') { teamCell = `<span class="tmp-total-lbl" title="Total de la temporada · ${r.team} (${r.nEq} equipos)">Total</span>`; cls = 'tmp-total'; }
    else if (r.kind === 'partial') { cls = 'tmp-partial'; title = `title="Temporada parcial: jugó en ${r.nEq} equipos ese año"`; }
    if (r.cut) { cls += ' tmp-cut'; title = `title="Cortado (waived) a mitad de temporada — cuenta como media"`; }
    const thumb = r.foto
      ? `<img loading="lazy" class="player-thumb" src="${r.foto}" onerror="this.style.visibility='hidden'" alt="">`
      : avatarHtml(r.jugador, 'player-thumb');
    return `<tr class="${cls.trim()}" ${title}>
      <td class="td-nombre"><span class="tmp-player">${thumb}${plLink(r.jugador, r.jugador)}</span></td>
      <td class="td-center">${drSeason(r.year)}</td>
      <td class="td-center">${teamCell}</td>
      <td class="td-num">${fmtEnt(r.g)}</td>
      ${statCells}
    </tr>`;
  }).join('') || `<tr><td colspan="${cols.length}" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function toggleTmpPartials() {
  tmpHidePartials = !tmpHidePartials;
  const btn = document.getElementById('tmp-hide');
  btn.classList.toggle('active', tmpHidePartials);
  btn.setAttribute('aria-pressed', String(tmpHidePartials));
  btn.textContent = tmpHidePartials ? 'Mostrar parciales' : 'Ocultar parciales';
  updateUrlParam('parciales', tmpHidePartials ? 'off' : '');
  renderTmpTable();
}

function sortTmp(col) {
  if (tmpSortCol === col) tmpSortAsc = !tmpSortAsc;
  else { tmpSortCol = col; tmpSortAsc = (col === 'jugador' || col === 'team'); }
  renderTmpTable();
}

function tmpSyncModeButtons() {
  ['total', 'pg'].forEach(x => {
    const btn = document.getElementById('tmp-mode-' + x);
    btn.classList.toggle('active', x === tmpMode);
    btn.setAttribute('aria-pressed', String(x === tmpMode));
  });
}

function setTmpMode(m) {
  if (tmpMode === m) return;
  tmpMode = m;
  tmpSyncModeButtons();
  // Si se ordenaba por una columna que ya no existe (TD ↔ %), vuelve a PTS
  if (!['jugador', 'year', 'team', 'g'].includes(tmpSortCol) && !tmpStatCols().some(c => c.key === tmpSortCol)) tmpSortCol = 'pts_g';
  updateUrlParam('modo', m === 'total' ? '' : m);
  renderTmpTable();
}

async function initTemporadasPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  tmpRows = tmpBuild(data.jugadores);

  const players = new Set(tmpRows.map(r => r.id));
  const seasons = new Set(tmpRows.map(r => r.id + ':' + r.year));  // una temporada-jugador (el traspaso cuenta como 1)
  const cutSeasons = new Set(tmpRows.filter(r => r.cut).map(r => r.id + ':' + r.year));  // cortes = media
  const efec = (seasons.size - 0.5 * cutSeasons.size).toLocaleString('es-ES');
  document.getElementById('hero-sub').textContent = `${efec} temporadas de ${players.size} españoles · los traspasos cuentan 1 y los cortes ½ (${cutSeasons.size})`;

  // Poblar filtros (equipos: solo códigos reales, no las filas TOT)
  const teams = [...new Set(tmpRows.filter(r => r.teamCode).map(r => r.teamCode))].sort();
  const years = [...new Set(tmpRows.map(r => r.year))].sort((a, b) => b - a);
  const teamSel = document.getElementById('tmp-team'), yearSel = document.getElementById('tmp-year');
  teamSel.innerHTML = `<option value="">Todos los equipos</option>` + teams.map(t => `<option value="${t}">${t}</option>`).join('');
  yearSel.innerHTML = `<option value="">Todas las temporadas</option>` + years.map(y => `<option value="${y}">${drSeason(y)}</option>`).join('');

  const params = new URLSearchParams(location.search);
  if (params.get('modo') === 'pg') { tmpMode = 'pg'; tmpSortCol = 'pts_g'; tmpSyncModeButtons(); }
  if (params.get('equipo') && teams.includes(params.get('equipo'))) { tmpFilterTeam = params.get('equipo'); teamSel.value = tmpFilterTeam; }
  if (params.get('anio') && years.includes(+params.get('anio'))) { tmpFilterYear = params.get('anio'); yearSel.value = tmpFilterYear; }
  if (params.get('parciales') === 'off') {
    tmpHidePartials = true;
    const hb = document.getElementById('tmp-hide');
    hb.classList.add('active'); hb.setAttribute('aria-pressed', 'true'); hb.textContent = 'Mostrar parciales';
  }

  document.getElementById('tmp-search').addEventListener('input', e => { tmpSearch = e.target.value.trim().toLowerCase(); renderTmpTable(); });
  teamSel.addEventListener('change', e => { tmpFilterTeam = e.target.value; updateUrlParam('equipo', tmpFilterTeam); renderTmpTable(); });
  yearSel.addEventListener('change', e => { tmpFilterYear = e.target.value; updateUrlParam('anio', tmpFilterYear); renderTmpTable(); });

  renderTmpTable();
}
