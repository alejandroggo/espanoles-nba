// ══════════════════════════════════════════════
// TEMA
// ══════════════════════════════════════════════
function initTheme() {
  const stored = localStorage.getItem('ag-theme') || 'auto';
  renderTheme(stored);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem('ag-theme') || 'auto') === 'auto') renderTheme('auto');
  });
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
async function loadData() {
  const res = await fetch('data.json');
  if (!res.ok) throw new Error('No se pudo cargar data.json');
  const data = await res.json();
  setLastUpdate(data.actualizado);
  return data;
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
      <td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : '<span class="player-thumb player-thumb--empty"></span>'}</a></td>
      <td class="td-nombre">${plLink(j.nombre, j.nombre)}</td>
      <td class="td-num td-pick">#${j.draft_pick}</td>
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
  { key: 'sueldo_pj',        label: '$/PJ',      sortable: true,  cls: 'td-num' },
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

  document.getElementById('sal-body').innerHTML = rows.map((j, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : '<span class="player-thumb player-thumb--empty"></span>'}</a></td>
      <td class="td-nombre">${plLink(j.nombre, j.nombre)}</td>
      <td class="td-num td-dinero">${fmtDinero(j.ganancias)}</td>
      <td class="td-num td-muted">${fmtDinero(j.ganancias_ganado)}</td>
      <td class="td-num td-muted">${fmtDinero(j.ganancias_futuro)}</td>
      <td class="td-num">${fmtDinero(j.sueldo_pj)}</td>
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

  document.getElementById('sl-search').addEventListener('input', e => { slSearch = e.target.value.trim().toLowerCase(); renderSlTable(); });
  document.getElementById('sl-year').addEventListener('change', e => { slYear = e.target.value; renderSlTable(); });

  renderSlTable();
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
  const bp = document.getElementById('sl-group-player');
  const by = document.getElementById('sl-group-year');
  bp.classList.toggle('active', slGroup === 'player');
  bp.setAttribute('aria-pressed', String(slGroup === 'player'));
  by.classList.toggle('active', slGroup === 'year');
  by.setAttribute('aria-pressed', String(slGroup === 'year'));
  // orden por defecto de cada modo
  slSortCol = slGroup ? 'count' : 'year';
  slSortAsc = false;
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
    g.jugadores.push(s.jugador);
  });

  let rows = Object.values(map).map(g => ({
    year: g.year,
    count: g.jugadores.length,
    jugadores: [...new Set(g.jugadores)],
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
      <td>${g.jugadores.map(j => plLink(j, j)).join(', ')}</td>
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
let prSortCol = 'year';
let prSortAsc = false;
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
  prSortCol = prGroup ? 'count' : 'year';
  prSortAsc = false;
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
    if (prSortCol === 'tipo') return prSortAsc ? a.tipo.localeCompare(b.tipo) : b.tipo.localeCompare(a.tipo);
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
  'min_total', 'pts_total', 'rbd_total', 'ast_total', 'stl_total', 'blk_total', 'tres_total', 'tov_total',
];

const RK_COLS_PG = [
  { key: 'rank',      label: '#',   sortable: false, cls: 'td-rank' },
  { key: 'foto',      label: '',    sortable: false },
  { key: 'nombre',    label: 'Jugador', sortable: true },
  { key: 'partidos',  label: 'PJ',  sortable: true, cls: 'td-num', fmt: fmtEnt },
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
  { key: 'nombre',      label: 'Jugador', sortable: true },
  { key: 'partidos',         label: 'PJ',   sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'partidos_titular', label: 'GS',   sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'pct_gs',           label: '%GS',  sortable: true, cls: 'td-num', fmt: fmtPct },
  { key: 'min_total',   label: 'MIN',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'pts_total',   label: 'PTS',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'rbd_total',   label: 'REB',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'ast_total',   label: 'AST',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'stl_total',   label: 'ROB',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'blk_total',   label: 'TAP',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'tres_total',  label: '3PM',  sortable: true, cls: 'td-num', fmt: fmtEnt },
  { key: 'tov_total',   label: 'PÉRD', sortable: true, cls: 'td-num', fmt: fmtEnt },
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

function setRkMode(mode) {
  if (rkMode === mode) return;
  rkMode = mode;
  document.getElementById('rk-mode-pg').classList.toggle('active', mode === 'pg');
  document.getElementById('rk-mode-pg').setAttribute('aria-pressed', String(mode === 'pg'));
  document.getElementById('rk-mode-tot').classList.toggle('active', mode === 'tot');
  document.getElementById('rk-mode-tot').setAttribute('aria-pressed', String(mode === 'tot'));
  rkSortCol = mode === 'pg' ? 'pts_g' : 'pts_total';
  rkSortAsc = false;
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
        if (c.key === 'foto') return `<td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : '<span class="player-thumb player-thumb--empty"></span>'}</a></td>`;
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

function drNorm(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

function drPhoto(jugador) {
  const j = drMeta[drNorm(jugador)];
  const src = j && (j.foto_url || (j.bref_id ? `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg` : ''));
  return `<span class="dp-photo">${src ? `<img src="${src}" onerror="this.remove()" alt="">` : ''}</span>`;
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
    html += `<button class="jersey ${jerseyClass(c)}" role="listitem" onclick="showDorsal(${n})"
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

function showDorsal(n) {
  const btns = document.querySelectorAll('.jersey');
  btns.forEach(b => b.classList.remove('sel'));
  const panel = document.getElementById('dr-detail');

  if (n === null || n === undefined) {
    panel.innerHTML = `<p class="dorsal-hint">Elige un dorsal para ver qué españoles lo han llevado.</p>`;
    return;
  }
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

const TR_COLS = [
  { key: 'rank',    label: '#',        sortable: false, cls: 'td-rank' },
  { key: 'fecha',   label: 'Fecha',    sortable: true,  cls: 'td-center' },
  { key: 'jugador', label: 'Jugador',  sortable: true },
  { key: 'tipo',    label: 'Tipo',     sortable: true },
  { key: 'equipo1', label: 'Equipo',   sortable: true,  cls: 'td-center' },
  { key: 'equipo2', label: 'Equipo 2', sortable: true,  cls: 'td-center' },
  { key: 'otros',   label: 'Otros jugadores', sortable: false },
  { key: 'notas',   label: 'Notas',    sortable: false, cls: 'td-notas' },
];

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function trFechaDisplay(iso) {
  if (!iso) return '—';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${parseInt(m[3])} ${MESES[parseInt(m[2]) - 1]} ${m[1]}`;
}
function trYearOf(iso) { const m = String(iso || '').match(/^(\d{4})/); return m ? m[1] : ''; }

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
  trAll = (data.transacciones || []).filter(t => t.tipo);

  document.getElementById('hero-sub').textContent =
    trAll.length ? `${trAll.length} movimientos de mercado` : 'Aún no hay datos de transacciones';

  renderTrKpis();
  buildTrFilters();
  document.getElementById('tr-search').addEventListener('input', e => { trSearch = e.target.value.trim().toLowerCase(); renderTrTable(); });
  document.getElementById('tr-tipo').addEventListener('change', e => { trTipo = e.target.value; renderTrTable(); });
  document.getElementById('tr-year').addEventListener('change', e => { trYear = e.target.value; renderTrTable(); });
  renderTrTable();
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

  rows.sort((a, b) => {
    const va = String(a[trSortCol] || ''), vb = String(b[trSortCol] || '');
    return trSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
  });

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
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-center td-muted">${trFechaDisplay(t.fecha)}</td>
      <td class="td-nombre">${plLink(t.jugador, t.jugador)}</td>
      <td><span class="tr-tipo ${trTipoClass(t.tipo)}">${t.tipo}</span></td>
      <td class="td-center">${t.equipo1 || '—'}</td>
      <td class="td-center">${t.equipo2 || '—'}</td>
      <td class="td-muted">${t.otros || '—'}</td>
      <td class="td-muted td-notas">${t.notas || '—'}</td>
    </tr>`).join('') || `<tr><td colspan="${TR_COLS.length}" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function sortTr(col) {
  if (trSortCol === col) trSortAsc = !trSortAsc;
  else { trSortCol = col; trSortAsc = (col === 'jugador' || col === 'tipo'); }
  renderTrTable();
}

// ══════════════════════════════════════════════
// FICHA DE JUGADOR
// ══════════════════════════════════════════════
function jugadorHref(id) { return `jugador.html?id=${encodeURIComponent(id)}`; }

function jugPhoto(j, cls) {
  const src = j.foto_url || (j.bref_id ? `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg` : '');
  return `<span class="jug-photo ${cls || ''}">${src ? `<img src="${src}" onerror="this.remove()" alt="${j.nombre}">` : ''}</span>`;
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
  if (j.posicion) pills.push(j.posicion);
  if (j.nacimiento_fecha || j.nacimiento) pills.push('Nac. ' + (j.nacimiento_fecha || j.nacimiento));
  pills.push(j.draft ? `Draft ${j.draft_anio || ''} · #${j.draft_pick || '?'} ${j.draft_equipo || ''}`.trim() : 'No drafteado');
  if (j.primer_partido && j.primer_partido.fecha) pills.push('Debut ' + j.primer_partido.fecha);
  if (j.temporadas) pills.push(`${j.temporadas} temporadas`);
  if (j.equipos_nba) pills.push(j.equipos_nba);
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
    statBox('PJ', fmtEnt(j.partidos)), statBox('MIN', fmtDec1(j.min_g)), statBox('PTS', fmtDec1(j.pts_g)),
    statBox('REB', fmtDec1(j.rbd_g)), statBox('AST', fmtDec1(j.ast_g)), statBox('ROB', fmtDec1(j.stl_g)),
    statBox('TAP', fmtDec1(j.blk_g)), statBox('FG%', fmtPct(j.fg_pct)), statBox('3P%', fmtPct(j.tres_pct)), statBox('FT%', fmtPct(j.ft_pct)),
  ].join('');
  const tot = [
    statBox('PTS', fmtEnt(j.pts_total)), statBox('REB', fmtEnt(j.rbd_total)), statBox('AST', fmtEnt(j.ast_total)),
    statBox('ROB', fmtEnt(j.stl_total)), statBox('TAP', fmtEnt(j.blk_total)), statBox('3PM', fmtEnt(j.tres_total)),
    statBox('MIN', fmtEnt(j.min_total)), statBox('PÉRD', fmtEnt(j.tov_total)),
  ].join('');
  return jugSection('Estadísticas de carrera',
    `<h3 class="jug-subh">Por partido</h3><div class="stat-grid">${pg}</div>
     <h3 class="jug-subh">Totales</h3><div class="stat-grid">${tot}</div>`);
}

function jugTemporadas(j) {
  const s = (j.temporadas_data || []).filter(x => x.year);
  if (!s.length) return '';
  const rows = [...s].sort((a, b) => (a.year || 0) - (b.year || 0)).map(t => `<tr>
    <td class="td-center">${drSeason(t.year)}</td><td class="td-center">${t.team || '—'}</td>
    <td class="td-num">${fmtEnt(t.g)}</td><td class="td-num">${fmtDec1(t.min_g)}</td><td class="td-num">${fmtDec1(t.pts_g)}</td>
    <td class="td-num">${fmtDec1(t.rbd_g)}</td><td class="td-num">${fmtDec1(t.ast_g)}</td><td class="td-num">${fmtDec1(t.stl_g)}</td>
    <td class="td-num">${fmtDec1(t.blk_g)}</td><td class="td-num">${fmtPct(t.fg_pct)}</td><td class="td-num">${fmtPct(t.tres_pct)}</td><td class="td-num">${fmtPct(t.ft_pct)}</td>
  </tr>`).join('');
  return jugSection('Temporada a temporada',
    `<div class="tabla-scroll"><table><thead><tr>
      <th class="td-center">Año</th><th class="td-center">Equipo</th><th class="td-num">PJ</th><th class="td-num">MIN</th><th class="td-num">PTS</th>
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
    `<div class="tabla-scroll"><table><thead><tr><th class="td-center">Año</th><th class="td-center">Equipo</th><th class="td-num">PJ</th></tr></thead><tbody>${rows}</tbody></table></div>`);
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
  return jugSection('Salario', `<div class="stat-grid">${parts.join('')}</div>`);
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
