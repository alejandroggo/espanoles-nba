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
