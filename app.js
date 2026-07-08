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

// ══════════════════════════════════════════════
// PÁGINA DRAFT
// ══════════════════════════════════════════════
let draftRows = [];
let draftSortCol = 'draft_anio';
let draftSortAsc = true;

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

  draftRows = jugadores.filter(j => j.draft);
  const undrafted = jugadores.filter(j => !j.draft);

  document.getElementById('hero-sub').textContent =
    `${draftRows.length} elegidos · ${undrafted.length} undrafted · ${jugadores.length} jugadores en total`;

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
  const rows = [...draftRows].sort((a, b) => {
    const va = a[draftSortCol], vb = b[draftSortCol];
    if (typeof va === 'string') return draftSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return draftSortAsc ? va - vb : vb - va;
  });

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
      <td class="td-foto">${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : '<span class="player-thumb player-thumb--empty"></span>'}</td>
      <td class="td-nombre">${j.nombre}</td>
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
    <div class="undrafted-card">
      <div class="undrafted-nombre">${j.nombre}</div>
      <div class="undrafted-meta">${j.posicion || ''}${debutAnio ? ` · Debut ${debutAnio}` : ''}</div>
    </div>`;
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

  // Debutados en la NBA o con contrato firmado (los tres rookies)
  salRows = jugadores.filter(j => (j.partidos || 0) > 0 || ROOKIES_CONTRATO.includes(j.nombre));

  // % = cuota de cada jugador sobre el total ganado por todos los españoles
  const granTotal = salRows.reduce((s, j) => s + (j.ganancias || 0), 0);
  salRows.forEach(j => { j.pct = granTotal ? j.ganancias / granTotal * 100 : null; });

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
    if (['ganancias', 'ganancias_ganado', 'ganancias_futuro', 'pct'].includes(salSortCol)) {
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
      <td class="td-foto">${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : '<span class="player-thumb player-thumb--empty"></span>'}</td>
      <td class="td-nombre">${j.nombre}</td>
      <td class="td-num td-dinero">${fmtDinero(j.ganancias)}</td>
      <td class="td-num td-muted">${fmtDinero(j.ganancias_ganado)}</td>
      <td class="td-num td-muted">${fmtDinero(j.ganancias_futuro)}</td>
      <td class="td-num">${renderPct(j.pct, maxPct ? (j.pct || 0) / maxPct * 100 : 0)}</td>
      <td class="td-muted">${j.equipos_nba || '—'}</td>
    </tr>`).join('');

  // Pie: totales
  const tTotal   = salRows.reduce((s, j) => s + (j.ganancias || 0), 0);
  const tCobrado = salRows.reduce((s, j) => s + (j.ganancias_ganado || 0), 0);
  const tFuturo  = salRows.reduce((s, j) => s + (j.ganancias_futuro || 0), 0);

  document.getElementById('sal-foot').innerHTML = `
    <tr class="sal-total">
      <td></td><td></td>
      <td class="td-nombre">TOTAL (${salRows.length})</td>
      <td class="td-num td-dinero">${fmtDinero(tTotal)}</td>
      <td class="td-num">${fmtDinero(tCobrado)}</td>
      <td class="td-num">${fmtDinero(tFuturo)}</td>
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
let slGrouped = false;

const SL_COLS = [
  { key: 'rank',    label: '#',       sortable: false, cls: 'td-rank' },
  { key: 'jugador', label: 'Jugador', sortable: true },
  { key: 'year',    label: 'Año',     sortable: true,  cls: 'td-num' },
  { key: 'equipo',  label: 'Equipo',  sortable: true,  cls: 'td-center' },
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

function toggleSlGroup() {
  slGrouped = !slGrouped;
  const btn = document.getElementById('sl-group');
  btn.classList.toggle('active', slGrouped);
  btn.setAttribute('aria-pressed', String(slGrouped));
  // reajustar orden por defecto de cada modo
  slSortCol = slGrouped ? 'count' : 'year';
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

  return slGrouped ? renderSlGrouped(filtered) : renderSlFlat(filtered);
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
      <td class="td-nombre">${s.jugador}</td>
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
      <td class="td-nombre">${g.jugador}</td>
      <td class="td-num">${g.count}</td>
      <td class="td-num">${g.years.join(', ') || '—'}</td>
      <td class="td-center">${g.equipos.join(', ') || '—'}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
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
let prGrouped = false;

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

async function initPremiosPage() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

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

function togglePrGroup() {
  prGrouped = !prGrouped;
  const btn = document.getElementById('pr-group');
  btn.classList.toggle('active', prGrouped);
  btn.setAttribute('aria-pressed', String(prGrouped));
  prSortCol = prGrouped ? 'count' : 'year';
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
  return prGrouped ? renderPrGrouped(filtered) : renderPrFlat(filtered);
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
      <td class="td-nombre">${p.jugador}</td>
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
      .map(([t, n]) => n > 1 ? `${t} ×${n}` : t).join(' · '),
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
      <td class="td-nombre">${g.jugador}</td>
      <td class="td-num">${g.count}</td>
      <td class="td-muted">${g.desglose}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
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
  { key: 'partidos',    label: 'PJ',   sortable: true, cls: 'td-num', fmt: fmtEnt },
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
        if (c.key === 'foto') return `<td class="td-foto">${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : '<span class="player-thumb player-thumb--empty"></span>'}</td>`;
        if (c.key === 'nombre') return `<td class="td-nombre">${j.nombre}</td>`;
        const val = c.fmt ? c.fmt(j[c.key]) : (j[c.key] ?? '—');
        const hl = rkSortCol === c.key ? ' td-hl' : '';
        return `<td class="${c.cls || ''}${hl}">${val}</td>`;
      }).join('')}
    </tr>`).join('') || `<tr><td colspan="${cols.length}" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function sortRk(col) {
  if (rkSortCol === col) rkSortAsc = !rkSortAsc;
  else { rkSortCol = col; rkSortAsc = (col === 'nombre'); }
  renderRkTable();
}
