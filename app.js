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
  { key: 'draft_anio',   label: 'Año',      sortable: true,  mono: true },
  { key: 'draft_pick',   label: 'Pick',     sortable: true,  mono: true },
  { key: 'nombre',       label: 'Jugador',  sortable: true },
  { key: 'posicion',     label: 'Posición', sortable: false },
  { key: 'draft_equipo', label: 'Equipo',   sortable: true,  mono: true },
  { key: 'draft_fecha',  label: 'Fecha',    sortable: false, mono: true },
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
  const best = [...draftRows].sort((a, b) => a.draft_pick - b.draft_pick)[0];
  const last = [...draftRows].sort((a, b) => b.draft_anio - a.draft_anio)[0];
  const first = [...draftRows].sort((a, b) => a.draft_anio - b.draft_anio)[0];
  document.getElementById('draft-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-num">#${best.draft_pick}</div><div class="kpi-label">Mejor pick · ${best.nombre} (${best.draft_anio})</div></div>
    <div class="kpi"><div class="kpi-num">${first.draft_anio}</div><div class="kpi-label">Primero · ${first.nombre}</div></div>
    <div class="kpi"><div class="kpi-num">${last.draft_anio}</div><div class="kpi-label">Último · ${last.nombre}</div></div>`;
}

function renderDraftTable() {
  const rows = [...draftRows].sort((a, b) => {
    const va = a[draftSortCol], vb = b[draftSortCol];
    if (typeof va === 'string') return draftSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return draftSortAsc ? va - vb : vb - va;
  });

  document.getElementById('draft-thead').innerHTML = `<tr>
    ${DRAFT_COLS.map(c => {
      if (!c.sortable) return `<th scope="col">${c.label}</th>`;
      const active = draftSortCol === c.key;
      const ariaSort = active ? (draftSortAsc ? 'ascending' : 'descending') : 'none';
      return `<th scope="col" class="th-sortable ${active ? 'sorted' + (draftSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortDraft('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('draft-body').innerHTML = rows.map(j => `
    <tr>
      <td class="td-mono">${j.draft_anio}</td>
      <td class="td-mono td-pick">#${j.draft_pick}</td>
      <td class="td-nombre">${j.nombre}</td>
      <td class="td-muted">${j.posicion || '—'}</td>
      <td class="td-mono">${j.draft_equipo || '—'}</td>
      <td class="td-mono td-muted">${j.draft_fecha || '—'}</td>
    </tr>`).join('');
}

function sortDraft(col) {
  if (draftSortCol === col) draftSortAsc = !draftSortAsc;
  else { draftSortCol = col; draftSortAsc = true; }
  renderDraftTable();
}

function renderUndrafted(undrafted) {
  document.getElementById('undrafted-grid').innerHTML = undrafted.map(j => `
    <div class="undrafted-card">
      <div class="undrafted-nombre">${j.nombre}</div>
      <div class="undrafted-meta">${j.posicion || ''}${j.nacimiento ? ` · ${j.nacimiento}` : ''}</div>
    </div>`).join('') || '<p class="td-muted">No hay jugadores undrafted.</p>';
}
