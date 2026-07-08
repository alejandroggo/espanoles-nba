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
  { key: 'rank',      label: '#',         sortable: false, cls: 'td-rank' },
  { key: 'foto',      label: '',          sortable: false },
  { key: 'nombre',    label: 'Jugador',   sortable: true },
  { key: 'ganancias', label: 'Ganancias', sortable: true,  cls: 'td-num' },
  { key: 'equipos',   label: 'Equipos',   sortable: false },
  { key: 'partidos',  label: 'Partidos',  sortable: true,  cls: 'td-num' },
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

  document.getElementById('hero-sub').textContent =
    `${salRows.length} jugadores con contrato o carrera NBA · Ganancias brutas de carrera (USD)`;

  renderSalariosKpis();
  renderSalariosTable();
}

function renderSalariosKpis() {
  const total = salRows.reduce((s, j) => s + (j.ganancias || 0), 0);
  const top = [...salRows].sort((a, b) => (b.ganancias || 0) - (a.ganancias || 0))[0];
  const gasol = salRows
    .filter(j => j.nombre === 'Pau Gasol' || j.nombre === 'Marc Gasol')
    .reduce((s, j) => s + (j.ganancias || 0), 0);
  const pctGasol = total ? Math.round(gasol / total * 1000) / 10 : 0;

  document.getElementById('sal-kpis').innerHTML = `
    <div class="kpi">
      <div class="kpi-num">${fmtDinero(total)}</div>
      <div class="kpi-label">Total acumulado</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${fmtDinero(top.ganancias)}</div>
      <div class="kpi-label">Mejor pagado · ${top.nombre}</div>
    </div>
    <div class="kpi">
      <div class="kpi-num">${pctGasol}%</div>
      <div class="kpi-label">De la familia Gasol</div>
    </div>`;
}

function renderSalariosTable() {
  const rows = [...salRows].sort((a, b) => {
    let va = a[salSortCol], vb = b[salSortCol];
    if (salSortCol === 'ganancias' || salSortCol === 'partidos') { va = va || 0; vb = vb || 0; }
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

  document.getElementById('sal-body').innerHTML = rows.map((j, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-foto">${(j.foto_url || j.bref_id) ? `<img class="player-thumb" src="${j.foto_url || `https://www.basketball-reference.com/req/202106291/images/players/${j.bref_id}.jpg`}" onerror="this.style.visibility='hidden'" alt="">` : '<span class="player-thumb player-thumb--empty"></span>'}</td>
      <td class="td-nombre">${j.nombre}</td>
      <td class="td-num td-dinero">${fmtDinero(j.ganancias)}</td>
      <td class="td-muted">${j.equipos_nba || '—'}</td>
      <td class="td-num td-muted">${j.partidos || 0}</td>
    </tr>`).join('');
}

function sortSal(col) {
  if (salSortCol === col) salSortAsc = !salSortAsc;
  else { salSortCol = col; salSortAsc = (col === 'nombre' || col === 'equipos'); }
  renderSalariosTable();
}
