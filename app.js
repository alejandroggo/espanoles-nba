// ══════════════════════════════════════════════
// TEMA
// ══════════════════════════════════════════════
function initTheme() {
  let stored = 'auto';
  try { stored = localStorage.getItem('ag-theme') || 'auto'; } catch (e) { }
  renderTheme(stored);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    let cur = 'auto';
    try { cur = localStorage.getItem('ag-theme') || 'auto'; } catch (e) { }
    if (cur === 'auto') renderTheme('auto');
  });
  buildNav();
  buildHeaderSearch();
  buildShareButton();
  // buildChatWidget();   // Pregúntame oculto por ahora
  buildCookieBanner();
  agTableTopScroll();
  // Cabeceras ordenables operables por teclado (Enter/Espacio)
  document.addEventListener('keydown', e => {
    const th = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && th && th.classList && th.classList.contains('th-sortable')) {
      e.preventDefault(); th.click();
    }
  });
  showLoadBar();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
  }
}

// ── AVISO DE COOKIES + CONSENT MODE ───────────────
function agSetConsent(v) {
  try { localStorage.setItem('ag-consent', v); } catch (e) { }
  if (v === 'granted' && typeof gtag === 'function') gtag('consent', 'update', { analytics_storage: 'granted' });
  const el = document.getElementById('cookie-banner'); if (el) el.remove();
}
function buildCookieBanner() {
  if (document.getElementById('cookie-banner')) return;
  let c = null; try { c = localStorage.getItem('ag-consent'); } catch (e) { }
  if (c === 'granted' || c === 'denied') return;   // ya eligió
  const el = document.createElement('div');
  el.className = 'cookie-banner'; el.id = 'cookie-banner';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Aviso de cookies');
  el.innerHTML = `<p class="cookie-text">Uso cookies de <b>Google Analytics</b> para medir las visitas de forma anónima. ¿Las aceptas?</p>
    <div class="cookie-btns">
      <button type="button" class="cookie-btn cookie-btn--no" id="cookie-no">Rechazar</button>
      <button type="button" class="cookie-btn cookie-btn--yes" id="cookie-yes">Aceptar</button>
    </div>`;
  document.body.appendChild(el);
  document.getElementById('cookie-yes').addEventListener('click', () => agSetConsent('granted'));
  document.getElementById('cookie-no').addEventListener('click', () => agSetConsent('denied'));
}

// ── EVENTOS GA4 (fallan en silencio; respetan Consent Mode) ──
// Si el usuario no aceptó cookies, analytics_storage está 'denied' y GA4 no
// registra nada aunque llamemos a gtag: no hay fuga de datos. Y si gtag no
// está cargado (bloqueadores, offline), el try/catch evita cualquier error.
function track(evento, params) {
  try { if (typeof gtag === 'function') gtag('event', evento, params || {}); } catch (e) { }
}

// ── BOTÓN COMPARTIR (cabecera, todas las páginas) ──
function buildShareButton() {
  const right = document.querySelector('.header-right');
  if (!right || document.getElementById('share-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'share-btn';
  btn.className = 'theme-toggle';
  btn.setAttribute('aria-label', 'Compartir esta página');
  btn.textContent = 'Compartir';
  btn.onclick = sharePage;
  right.appendChild(btn);
}

// Barra de desplazamiento horizontal ARRIBA de cada tabla, sincronizada con su scroll.
// Útil en móvil, donde la barra nativa suele estar oculta y no se ve que la tabla se desplaza.
function agTableTopScroll() {
  document.querySelectorAll('.tabla-wrap').forEach(wrap => {
    if (wrap.dataset.topscroll) return;
    wrap.dataset.topscroll = '1';
    const bar = document.createElement('div'); bar.className = 'tbl-topscroll';
    const inner = document.createElement('div'); inner.className = 'tbl-topscroll-inner';
    bar.appendChild(inner); wrap.parentNode.insertBefore(bar, wrap);
    const sync = () => {
      const table = wrap.querySelector('table');
      const sw = table ? table.scrollWidth : 0;
      inner.style.width = sw + 'px';
      bar.style.display = (sw > wrap.clientWidth + 2) ? 'block' : 'none';
    };
    let lock = false;
    bar.addEventListener('scroll', () => { if (lock) return; lock = true; wrap.scrollLeft = bar.scrollLeft; lock = false; });
    wrap.addEventListener('scroll', () => { if (lock) return; lock = true; bar.scrollLeft = wrap.scrollLeft; lock = false; });
    try { new MutationObserver(sync).observe(wrap, { childList: true, subtree: true }); } catch (e) { }
    window.addEventListener('resize', sync);
    sync();
  });
}

function sharePage() {
  // Compartir siempre en X (el texto describe la página + enlace).
  track('compartir', { metodo: 'twitter', origen: 'cabecera', pagina: location.pathname });
  const texto = `${document.title} #EspañolesNBA (vía @alejandroggo)`;
  const xIntent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(texto + '\n\n' + location.href);
  window.open(xIntent, '_blank', 'noopener,noreferrer');
}

// ── BUSCADOR GLOBAL (cabecera, en todas las páginas) ──
let hsAll = null, hsList = [], hsIdx = -1;

function buildHeaderSearch() {
  const right = document.querySelector('.header-right');
  if (!right || document.getElementById('hsearch')) return;
  const wrap = document.createElement('div');
  wrap.className = 'hsearch';
  wrap.id = 'hsearch';
  wrap.innerHTML = `
    <button type="button" class="hsearch-toggle" id="hsearch-toggle" aria-label="Buscar jugador" aria-expanded="false">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
    </button>
    <input id="hsearch-input" class="hsearch-input" type="search" autocomplete="off" placeholder="Buscar jugador…"
      aria-label="Buscar jugador" role="combobox" aria-expanded="false" aria-controls="hsearch-panel">
    <div class="hsearch-panel" id="hsearch-panel" role="listbox" hidden></div>`;
  right.insertBefore(wrap, right.firstChild);
  const input = wrap.querySelector('#hsearch-input');
  const toggle = wrap.querySelector('#hsearch-toggle');
  input.addEventListener('focus', hsEnsureData);
  input.addEventListener('input', () => { hsIdx = -1; hsRender(input.value); });
  input.addEventListener('keydown', hsKey);
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    const open = !wrap.classList.contains('open');
    if (open) { wrap.classList.add('open'); toggle.setAttribute('aria-expanded', 'true'); hsEnsureData(); setTimeout(() => input.focus(), 30); }
    else { hsClose(); }
  });
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) hsClose(); });
}

async function hsEnsureData() {
  if (hsAll) return;
  try { const d = await loadData(); hsAll = d.jugadores || []; buildPlayerIds(hsAll); }
  catch (e) { hsAll = []; }
}

function hsMatches(q) {
  const nq = drNorm(q.trim());
  if (!nq) return [];
  return (hsAll || []).filter(j => drNorm(j.nombre).includes(nq)).slice(0, 8);
}

function hsRender(q) {
  const panel = document.getElementById('hsearch-panel'), input = document.getElementById('hsearch-input');
  hsList = hsMatches(q);
  if (!hsList.length) { panel.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
  panel.innerHTML = hsList.map((j, i) => {
    const thumb = (j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'hsearch-avatar');
    return `<a class="hsearch-item${i === hsIdx ? ' active' : ''}" role="option" href="${jugadorHref(j.id)}"><span class="hsearch-thumb">${thumb}</span>${j.nombre}</a>`;
  }).join('');
  panel.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function hsKey(e) {
  if (e.key === 'Escape') { hsClose(); e.target.blur(); return; }
  if (!hsList.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); hsIdx = Math.min(hsIdx + 1, hsList.length - 1); hsRender(e.target.value); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); hsIdx = Math.max(hsIdx - 1, 0); hsRender(e.target.value); }
  else if (e.key === 'Enter') { const j = hsList[hsIdx >= 0 ? hsIdx : 0]; if (j) location.href = jugadorHref(j.id); }
}

function hsClose() {
  const panel = document.getElementById('hsearch-panel'), input = document.getElementById('hsearch-input');
  if (panel) panel.hidden = true;
  if (input) input.setAttribute('aria-expanded', 'false');
  const wrap = document.getElementById('hsearch'), tg = document.getElementById('hsearch-toggle');
  if (wrap) wrap.classList.remove('open');
  if (tg) tg.setAttribute('aria-expanded', 'false');
}

// ── NAVEGACIÓN GLOBAL ─────────────────────────
const NAV_LINKS = [
  ['Inicio', 'index.html'], ['Jugadores', 'jugadores.html'], ['Draft', 'draft.html'],
  ['Debut', 'debut.html'], ['Carrera', 'ranking.html'], ['Temporadas', 'temporadas.html'],
  ['Career Highs', 'career-highs.html'], ['Marcas al alcance', 'marcas.html'], ['Transacciones', 'transacciones.html'], ['Premios', 'premios.html'],
  ['Salarios', 'salarios.html'], ['Dorsales', 'dorsales.html'], ['Summer League', 'summer-league.html'],
  ['Línea temporal', 'linea-temporal.html'], ['Por equipo', 'por-equipo.html'], ['Comparador', 'comparador.html'], ['Gráficos', 'graficos.html'],
  ['Efemérides', 'efemerides.html'], ['Quinteto ideal', 'quinteto.html'], ['Test', 'test.html'],
  // ['Pregúntame', 'preguntas.html'],   // oculto por ahora
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
  const labels = { auto: `${iAuto}<span class="tt-lbl">Auto</span>`, light: `${iSun}<span class="tt-lbl">Claro</span>`, dark: `${iMoon}<span class="tt-lbl">Oscuro</span>` };
  const names  = { auto: 'Auto', light: 'Claro', dark: 'Oscuro' };
  btn.innerHTML = labels[pref] || labels.auto;
  btn.setAttribute('aria-label', 'Tema: ' + (names[pref] || names.auto) + '. Pulsa para cambiar');
  btn.dataset.themePref = pref;
}

function cycleTheme() {
  const cur = document.getElementById('theme-toggle')?.dataset.themePref || 'auto';
  const next = { auto: 'dark', dark: 'light', light: 'auto' }[cur] || 'auto';
  try { localStorage.setItem('ag-theme', next); } catch (e) { }
  renderTheme(next);
}

// Escapa texto libre (notas, "otros"…) antes de inyectarlo con innerHTML.
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

// Corrección de acentuación/ortografía de nombres (la fuente los trae sin alguna
// tilde). Se aplica al cargar los datos para que toda la web muestre el nombre
// correcto. Clave = nombre tal cual viene en data.json; valor = nombre correcto.
const NAME_FIX = {
  'Alex Abrines': 'Álex Abrines',
  'Raül Lopez': 'Raül López',
  'Juan Nuñez': 'Juan Núñez',
  'Sergio De Larrea': 'Sergio de Larrea',
};

let AG_DATA_PROMISE = null;
async function loadData() {
  // Una sola descarga por carga de página (dedupe de llamadas concurrentes), pero
  // se revalida contra el servidor en cada recarga para que los datos nuevos del
  // bot (transacciones, efemérides…) aparezcan sin tener que cerrar la pestaña.
  if (!AG_DATA_PROMISE) {
    AG_DATA_PROMISE = fetch('data.json', { cache: 'no-cache' })
      .then(res => { if (!res.ok) throw new Error('No se pudo cargar data.json'); return res.json(); });
  }
  let data;
  try { data = await AG_DATA_PROMISE; }
  catch (e) { AG_DATA_PROMISE = null; throw e; }
  // Brooklyn: la fuente (Basketball Reference) usa "BRK"; unificamos al código oficial NBA "BKN"
  const fixTeam = c => (c === 'BRK' ? 'BKN' : c);
  (data.jugadores || []).forEach(j => {
    const ov = FOTO_OVERRIDES[drNorm(j.nombre)];
    if (ov) j.foto_url = ov;
    if (NAME_FIX[j.nombre]) j.nombre = NAME_FIX[j.nombre];
    if (j.draft_equipo) j.draft_equipo = fixTeam(j.draft_equipo);
    if (j.equipos_nba) j.equipos_nba = j.equipos_nba.replace(/\bBRK\b/g, 'BKN');
    (j.temporadas_data || []).forEach(t => { if (t.team) t.team = fixTeam(t.team); });
    const pp = j.primer_partido;
    if (pp) { if (pp.equipo) pp.equipo = fixTeam(pp.equipo); if (pp.rival) pp.rival = fixTeam(pp.rival); }
  });
  // Corrige el nombre también donde aparece como jugador/rival y el código de equipo
  ['transacciones', 'dorsales', 'summer_league', 'superaciones'].forEach(k => (data[k] || []).forEach(r => {
    if (r.jugador && NAME_FIX[r.jugador]) r.jugador = NAME_FIX[r.jugador];
    if (r.rival && NAME_FIX[r.rival]) r.rival = NAME_FIX[r.rival];
    if (r.equipo) r.equipo = fixTeam(r.equipo);
    if (r.team) r.team = fixTeam(r.team);
    if (r.equipo1) r.equipo1 = fixTeam(r.equipo1);
    if (r.equipo2) r.equipo2 = fixTeam(r.equipo2);
  }));
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

// ── FOTO DEL JUGADOR: local (img/players/<id>.jpg) con respaldo a foto_url/bref ──
function agFotoFb(j) { return j.foto_url || (j.bref_id ? `${BREF_HEADSHOTS}/${j.bref_id}.jpg` : ''); }
// Devuelve  src="…" [data-fb="…"]  con la foto local primero (id) y respaldo fb
function agFotoSrc2(id, fb) {
  const primary = id ? `img/players/${id}.jpg` : fb;
  return `src="${primary}"${(id && fb) ? ` data-fb="${fb}"` : ''}`;
}
function agFotoSrc(j) { return agFotoSrc2(j.id, agFotoFb(j)); }
// onerror: prueba el respaldo (bref) una vez; si también falla, oculta o elimina
function agImgFb(img) { const fb = img.getAttribute('data-fb'); if (fb && !img.dataset.fbt) { img.dataset.fbt = '1'; img.src = fb; return true; } return false; }
function agImgHide(img) { if (!agImgFb(img)) img.style.visibility = 'hidden'; }
function agImgRemove(img) { if (!agImgFb(img)) img.remove(); }

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
  const content = inner == null ? escapeHtml(name) : inner;
  return id ? `<a class="pl-link" href="${jugadorHref(id)}">${content}</a>` : content;
}

// Abrevia el nombre de pila a la inicial ("Willy Hernangómez" -> "W. Hernangómez"),
// manteniendo apellido final, partículas (de, del...) e iniciales ya existentes (M.).
const AG_PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'van', 'von', 'da', 'di', 'y']);
function abrevNombre(nombre) {
  const parts = String(nombre || '').trim().split(/\s+/);
  if (parts.length < 2) return nombre;
  const last = parts.length - 1;
  return parts.map((t, i) => {
    if (i === last) return t;                               // apellido final completo
    if (AG_PARTICULAS.has(t.toLowerCase())) return t;       // partícula
    if (t.endsWith('.')) return t;                          // ya es inicial (M., A.)
    return t.charAt(0).toUpperCase() + '.';                 // inicial
  }).join(' ');
}
// Nombre con versión completa (escritorio) y abreviada (móvil), conmutadas por CSS.
function nombreResp(nombre) {
  return `<span class="ag-nom-full">${nombre}</span><span class="ag-nom-abbr">${abrevNombre(nombre)}</span>`;
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

  // Widget "Un día como hoy": efeméride del día (o la próxima si hoy no hay)
  try {
    buildPlayerIds(J);
    const evs = efmBuild(data);
    const now = new Date();
    const tm = now.getMonth() + 1, td = now.getDate();
    let day = { m: tm, d: td }, list = evs.filter(e => e.m === tm && e.d === td), isToday = true;
    if (!list.length) {
      isToday = false;
      // Solo mostramos la próxima efeméride si cae dentro de la próxima semana (7 días).
      for (let i = 1; i <= 7 && !list.length; i++) {
        const dt = new Date(2000, tm - 1, td); dt.setDate(dt.getDate() + i);
        const mm = dt.getMonth() + 1, dd = dt.getDate();
        const l = evs.filter(e => e.m === mm && e.d === dd);
        if (l.length) { list = l; day = { m: mm, d: dd }; }
      }
    }
    renderHomeEfm(list, day, isToday);   // si sigue vacía, renderHomeEfm no muestra nada
  } catch (e) {}
  try { renderHomeWatch(data); } catch (e) {}
  try { renderHomeRecent(data); } catch (e) {}
}

function renderHomeEfm(list, day, isToday) {
  const el = document.getElementById('home-efm');
  if (!el || !list.length) return;
  const nowY = new Date().getFullYear();
  const items = [...list].sort((a, b) => b.year - a.year).slice(0, 3).map(e => {
    const tags = String(e.tag || '').split(/\s*[,/|]\s*/).map(s => s.trim()).filter(Boolean);
    const tagsHtml = (tags.length ? tags : ['Hito']).map(t => `<span class="tr-tipo ${efmTagClass(t)} efm-tag">${t}</span>`).join(' ');
    const ago = nowY - e.year;
    return `<li class="home-efm-item"><span class="home-efm-year">${e.year}<small>${ago > 0 ? `hace ${ago}` : 'este año'}</small></span><div class="home-efm-body"><span class="efm-tags">${tagsHtml}</span><span class="home-efm-txt">${e.html}</span></div></li>`;
  }).join('');
  const kicker = isToday ? 'Un día como hoy' : `Próxima efeméride · ${day.d} de ${MESES_LARGOS[day.m - 1]}`;
  el.innerHTML = `<div class="home-efm-head"><span class="home-efm-kicker">📅 ${kicker}</span><span class="home-efm-head-actions"><a class="home-efm-link" href="efemerides.html?m=${day.m}&d=${day.d}">Ver Efemérides →</a>${homeBoxMinBtn('home-efm')}</span></div><ul class="home-efm-list">${items}</ul>`;
  el.hidden = false;
  applyHomeBoxState('home-efm');
}

// ── MINIMIZAR CAJAS DE LA HOME (efemérides / marcas) ──
function homeBoxMinBtn(id) {
  return `<button type="button" class="home-box-min" aria-label="Minimizar" aria-expanded="true" onclick="toggleHomeBox('${id}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>`;
}
function toggleHomeBox(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const collapsed = el.classList.toggle('collapsed');
  const btn = el.querySelector('.home-box-min');
  if (btn) { btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true'); btn.setAttribute('aria-label', collapsed ? 'Expandir' : 'Minimizar'); }
  try { localStorage.setItem('ag-min-' + id, collapsed ? '1' : '0'); } catch (e) { }
}
function applyHomeBoxState(id) {
  const el = document.getElementById(id);
  if (!el) return;
  let c = false; try { c = localStorage.getItem('ag-min-' + id) === '1'; } catch (e) { }
  if (c) {
    el.classList.add('collapsed');
    const btn = el.querySelector('.home-box-min');
    if (btn) { btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Expandir'); }
  }
}

// ── MARCAS AL ALCANCE (record watch) ──────────────────
// Para los españoles en activo, calcula qué marcas tienen cerca: superar al
// siguiente español en una estadística acumulada o llegar a un número redondo.
// "Activo" = juega la temporada actual (año de fin de temporada más reciente).
function rwBuild(data) {
  const J = data.jugadores || [];
  const now = new Date();
  const endYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  const maxYear = j => (j.temporadas_data || []).reduce((m, r) => Math.max(m, r.year || 0), 0);
  const active = J.filter(j => maxYear(j) >= endYear);   // incluye rookies aún sin datos
  const STATS = [
    { tot: 'pts_total', pg: 'pts_g', label: 'puntos', step: 1000 },
    { tot: 'rbd_total', pg: 'rbd_g', label: 'rebotes', step: 500 },
    { tot: 'ast_total', pg: 'ast_g', label: 'asistencias', step: 250 },
    { tot: 'tres_total', pg: 'tres_g', label: 'triples', step: 100 },
    { tot: 'blk_total', pg: 'blk_g', label: 'tapones', step: 100 },
    { tot: 'stl_total', pg: 'stl_g', label: 'robos', step: 100 },
    { tot: 'partidos', pg: null, label: 'partidos', step: 100 },
  ];
  const MAXGAMES = 30;   // nada que esté a más de ~30 partidos
  // Rookies sin ritmo fiable (0 partidos): umbral por diferencia absoluta en cada estadística.
  const ROOKIE_ABS = { puntos: 50, rebotes: 25, asistencias: 25, triples: 10, robos: 10, tapones: 10, partidos: 30 };
  const out = [];
  active.forEach(j => {
    STATS.forEach(s => {
      const mine = j[s.tot] || 0;
      const perg = s.pg ? (j[s.pg] || 0) : 1;         // 'partidos' => 1 partido por partido
      // Sin partidos NBA no hay ritmo fiable en NINGUNA estadística (tampoco 'partidos'):
      // esos jugadores van como "Debutante" y por umbral absoluto.
      const hasRate = (j.partidos || 0) > 0 && perg > 0;
      const games = gap => hasRate ? Math.ceil(gap / perg) : Infinity;
      const abs = ROOKIE_ABS[s.label];
      const show = (gap, g) => hasRate ? (g <= MAXGAMES) : (abs != null && gap <= abs);
      // superar al siguiente español por encima
      let rival = null, rval = Infinity;
      J.forEach(x => { if (x !== j) { const v = x[s.tot] || 0; if (v > mine && v < rval) { rval = v; rival = x; } } });
      if (rival) {
        const gap = rval - mine, g = games(gap);
        if (show(gap, g)) {
          const rivalRank = J.filter(x => (x[s.tot] || 0) > rval).length + 1;   // posición que alcanzaría
          out.push({ j, type: 'pass', stat: s.label, gap, games: g, rival: rival.nombre, rivalId: rival.id, rivalRank });
        }
      }
      // siguiente número redondo
      const nr = (Math.floor(mine / s.step) + 1) * s.step, gapr = nr - mine, gr = games(gapr);
      if (gapr > 0 && show(gapr, gr)) out.push({ j, type: 'round', stat: s.label, gap: gapr, games: gr, milestone: nr });
    });
  });
  // Récord español de TOTAL en una sola temporada (solo temporadas completas, año < endYear)
  const seasonRec = {};
  STATS.forEach(s => { if (s.pg) seasonRec[s.label] = { val: 0, player: null, year: null }; });
  J.forEach(j => {
    const by = cmpYearRows(j);
    Object.entries(by).forEach(([yr, t]) => {
      const y = +yr; if (y >= endYear) return;                 // la temporada en curso no cuenta como récord
      const g = t.g || 0; if (!g) return;
      STATS.forEach(s => {
        if (!s.pg) return;
        const total = Math.round((t[s.pg] || 0) * g);
        if (total > seasonRec[s.label].val) seasonRec[s.label] = { val: total, player: j.nombre, year: y };
      });
    });
  });
  // Para cada activo, su temporada en curso contra ese récord
  active.forEach(j => {
    const cur = cmpYearRows(j)[endYear];
    if (!cur || !(cur.g > 0)) return;
    STATS.forEach(s => {
      if (!s.pg) return;
      const rec = seasonRec[s.label]; if (!rec.player) return;
      const mine = Math.round((cur[s.pg] || 0) * cur.g), rate = cur[s.pg] || 0;
      const gap = rec.val - mine;
      if (gap <= 0 || rate <= 0) return;
      const g = Math.ceil(gap / rate);
      if (g <= MAXGAMES) out.push({ j, type: 'season', stat: s.label, gap, games: g, recPlayer: rec.player, recYear: rec.year, recVal: rec.val });
    });
  });
  out.sort((a, b) => {
    const ga = isFinite(a.games) ? a.games : 1e9, gb = isFinite(b.games) ? b.games : 1e9;
    return ga - gb || a.gap - b.gap;
  });
  return out;
}

function renderHomeWatch(data) {
  const el = document.getElementById('home-watch');
  if (!el) return;
  // En portada: superar a otro español solo si es inminente (~3 partidos);
  // las cifras redondas (hitos) se anuncian con algo más de margen (~7 partidos).
  const all = rwBuild(data).filter(w => w.type === 'pass' ? w.games <= 3 : w.games <= 7);
  if (!all.length) return;
  // Variedad: máximo 3 marcas por jugador, hasta 6 en total.
  const perPlayer = {}, top = [];
  for (const w of all) {
    const k = w.j.id || w.j.nombre;
    perPlayer[k] = (perPlayer[k] || 0) + 1;
    if (perPlayer[k] <= 3) top.push(w);
    if (top.length >= 6) break;
  }
  const items = rwGroup(top).map(rwRowHtml).join('');
  el.innerHTML = `<div class="home-efm-head"><span class="home-efm-kicker">🎯 Marcas al alcance</span><span class="home-efm-head-actions"><a class="home-efm-link" href="marcas.html">Ver todas →</a>${homeBoxMinBtn('home-watch')}</span></div><ul class="home-efm-list home-watch-list">${items}</ul>`;
  el.hidden = false;
  applyHomeBoxState('home-watch');
}

// ── RECIÉN SUPERADAS (lo que ya ha pasado: lee data.superaciones, que escribe el bot) ──
function rsBuild(data) {
  const sup = data.superaciones || [];
  if (!sup.length) return [];
  const byName = {};
  (data.jugadores || []).forEach(j => { byName[drNorm(j.nombre)] = j; });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return sup.map(s => {
    const j = byName[drNorm(s.jugador)] || { nombre: s.jugador };
    const dt = new Date(String(s.fecha) + 'T00:00:00');
    const days = Math.round((today - dt) / 86400000);
    const rel = days <= 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days} días`;
    return { j, s, days, rel };
  }).filter(x => isFinite(x.days)).sort((a, b) => a.days - b.days);
}
function renderHomeRecent(data) {
  const el = document.getElementById('home-recent');
  if (!el) return;
  const all = rsBuild(data).filter(x => x.days <= 14).slice(0, 6);
  if (!all.length) return;
  const items = all.map(({ j, s, rel }) => {
    const img = (j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'hw-avatar');
    const face = j.id ? `<a class="hw-face" href="${jugadorHref(j.id)}" aria-label="${j.nombre}">${img}</a>` : img;
    const name = j.id ? `<a class="hw-name-link" href="${jugadorHref(j.id)}">${j.nombre}</a>` : j.nombre;
    const txt = s.tipo === 'hito'
      ? `Alcanzó los <b>${Number(s.hito).toLocaleString('es-ES')} ${s.campo}</b>`
      : s.tipo === 'record_temp'
      ? `Batió el <b>récord español de ${s.campo} en una temporada</b>${s.rival ? ` (antes ${s.rival}${s.record_ano ? ', ' + drSeason(s.record_ano) : ''})` : ''}`
      : `Superó a ${s.rival} en <b>${s.campo}</b>`;
    return `<li class="home-watch-item"><div class="hw-link"><span class="hw-thumb">${face}</span><span class="hw-body"><span class="hw-name">${name}</span><span class="hw-txt">${txt}</span></span><span class="hw-badge">${rel}</span></div></li>`;
  }).join('');
  el.innerHTML = `<div class="home-efm-head"><span class="home-efm-kicker">🔥 Recién superadas</span>${homeBoxMinBtn('home-recent')}</div><ul class="home-efm-list home-watch-list">${items}</ul>`;
  el.hidden = false;
  applyHomeBoxState('home-recent');
}

// HTML de una marca (compartido por la home y la página de marcas).
const RW_SING = { puntos: 'punto', rebotes: 'rebote', asistencias: 'asistencia', triples: 'triple', tapones: 'tapón', robos: 'robo', partidos: 'partido' };
// Agrupa marcas idénticas de varios jugadores (mismo objetivo) en una sola fila.
function rwGroup(ws) {
  const map = new Map(), order = [];
  ws.forEach(w => {
    const key = [w.type, w.stat, w.gap, w.type === 'pass' ? w.rival : (w.type === 'season' ? 'rec' : w.milestone), w.games].join('|');
    if (map.has(key)) map.get(key).players.push(w.j);
    else { map.set(key, { ...w, players: [w.j] }); order.push(key); }
  });
  return order.map(k => map.get(k));
}
function rwFace(p) {
  const img = (p.id || p.foto_url || p.bref_id)
    ? `<img loading="lazy" ${agFotoSrc(p)} onerror="agImgHide(this)" alt="">`
    : avatarHtml(p.nombre, 'hw-avatar');
  return p.id ? `<a class="hw-face" href="${jugadorHref(p.id)}" aria-label="${p.nombre}">${img}</a>` : `<span class="hw-face">${img}</span>`;
}
function rwNameLinks(players) {
  const a = players.map(p => p.id ? `<a class="hw-name-link" href="${jugadorHref(p.id)}">${p.nombre}</a>` : `<span>${p.nombre}</span>`);
  return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1];
}
function rwRowHtml(g) {
  const players = g.players || [g.j];
  const multi = players.length > 1;
  const faces = players.slice(0, 3).map(rwFace).join('');
  const sw = g.gap === 1 ? (RW_SING[g.stat] || g.stat) : g.stat;
  const rivalLink = g.rivalId ? `<a class="hw-rival" href="${jugadorHref(g.rivalId)}">${g.rival}</a>` : g.rival;
  const rivalHtml = g.type === 'pass'
    ? `${rivalLink}${g.rivalRank ? ` <span class="hw-rank">(sería ${g.rivalRank}º)</span>` : ''}`
    : '';
  const txt = g.type === 'pass'
    ? `A <b>${g.gap} ${sw}</b> de superar a ${rivalHtml}`
    : g.type === 'season'
    ? `A <b>${g.gap.toLocaleString('es-ES')} ${sw}</b> de batir el récord español en una temporada (${g.recPlayer}, ${drSeason(g.recYear)})`
    : `A <b>${g.gap} ${sw}</b> de los ${g.milestone.toLocaleString('es-ES')}`;
  const badge = isFinite(g.games) ? `~${g.games} ${g.games === 1 ? 'partido' : 'partidos'}` : 'Debutante';
  return `<li class="home-watch-item"><div class="hw-link"><span class="hw-thumb${multi ? ' hw-thumb-multi' : ''}">${faces}</span><span class="hw-body"><span class="hw-name">${rwNameLinks(players)}</span><span class="hw-txt">${txt}</span></span><span class="hw-badge">${badge}</span></div></li>`;
}

// ── PÁGINA "MARCAS AL ALCANCE" (listado completo con filtro) ──
let mkAll = [];
let mkFilter = 'all', mkPlayer = '';
async function initMarcasPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  mkAll = rwBuild(data);   // marcas alcanzables (≤30 partidos, o rookies por umbral)
  const nMarcas = rwGroup(mkAll).length;
  const jug = new Set(mkAll.map(w => w.j.id || w.j.nombre)).size;
  const sub = document.getElementById('hero-sub');
  if (sub) sub.textContent = nMarcas
    ? `${nMarcas} marcas a tiro de ${jug} ${jug === 1 ? 'español en activo' : 'españoles en activo'} esta temporada`
    : 'Ahora mismo no hay marcas al alcance. Vuelve cuando haya más partidos jugados.';
  document.querySelectorAll('#mk-filter .toggle-chip').forEach(b => {
    b.addEventListener('click', () => {
      mkFilter = b.dataset.f;
      document.querySelectorAll('#mk-filter .toggle-chip').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      renderMarcas();
    });
  });
  // Selector de jugador: solo los que tienen alguna marca al alcance
  const psel = document.getElementById('mk-player');
  if (psel) {
    const seen = new Map();
    mkAll.forEach(w => { const key = w.j.id || w.j.nombre; if (!seen.has(key)) seen.set(key, w.j.nombre); });
    const opts = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
    psel.innerHTML = '<option value="">Todos los jugadores</option>' + opts.map(([k, nombre]) => `<option value="${escapeHtml(k)}">${escapeHtml(nombre)}</option>`).join('');
    psel.addEventListener('change', e => { mkPlayer = e.target.value; renderMarcas(); });
  }
  renderMarcas();
}
function renderMarcas() {
  const list = document.getElementById('mk-list'), empty = document.getElementById('mk-empty'), count = document.getElementById('mk-count');
  let rows = mkFilter === 'all' ? mkAll : mkAll.filter(w => w.type === mkFilter);
  if (mkPlayer) rows = rows.filter(w => (w.j.id || w.j.nombre) === mkPlayer);
  const grouped = rwGroup(rows);
  list.innerHTML = grouped.map(rwRowHtml).join('');
  if (empty) empty.hidden = grouped.length > 0;
  if (count) count.textContent = `${grouped.length} ${grouped.length === 1 ? 'marca' : 'marcas'}`;
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
    '<option value="">Todos los equipos</option>' + teams.map(t => `<option value="${t}">${t}</option>`).join('');
  document.getElementById('draft-search').addEventListener('input', e => { draftSearch = e.target.value.trim().toLowerCase(); renderDraftTable(); });
  document.getElementById('draft-team').addEventListener('change', e => { draftTeam = e.target.value; renderDraftTable(); });
  document.getElementById('draft-round').addEventListener('change', e => { draftRound = e.target.value; renderDraftTable(); });

  renderDraftKpis();
  renderDraftTable();
  renderUndrafted(undrafted);
  renderOrigenes(draftRows, 'draft-origenes', `Los ${draftRows.length} españoles drafteados, por comunidad de nacimiento.`);
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
      return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (draftSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortDraft('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('draft-body').innerHTML = rows.map((j, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" class="player-thumb" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'player-thumb')}</a></td>
      <td class="td-nombre">${plLink(j.nombre, j.nombre)}</td>
      <td class="td-num td-pick${j.draft_pick === bestPick ? ' td-leader' : ''}">#${j.draft_pick}</td>
      <td class="td-num">${j.draft_equipo || '—'}</td>
      <td class="td-num">${j.draft_anio}</td>
      <td class="td-num td-muted">${j.draft_fecha || '—'}</td>
      <td class="td-muted td-notas">${escapeHtml(j.draft_notas || j.notas || '—')}</td>
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

const ROOKIES_CONTRATO = ['Sergio de Larrea', 'Baba Miller', 'Aday Mara'];

function fmtDinero(n) {
  if (!n) return '—';
  return '$' + Math.round(n).toLocaleString('es-ES');
}

let SAL_SPLITS = {};
let SAL_PE = null;
async function initSalariosPage() {
  let jugadores;
  try {
    jugadores = (await loadData()).jugadores || [];
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }
  // Desglose por equipo (data/salarios.json) para el dropdown y la tabla de franquicias
  try { SAL_PE = await fetch('data/salarios.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null); } catch (e) { SAL_PE = null; }
  SAL_SPLITS = {};
  if (SAL_PE && SAL_PE.jugadores) SAL_PE.jugadores.forEach(x => { SAL_SPLITS[drNorm(x.nombre)] = { splits: x.splits || {}, nota: x.nota || '' }; });

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
    `${salRows.length} jugadores con contrato o carrera NBA · Ganancias brutas (USD) · pulsa un jugador para ver su reparto por equipo`;

  renderSalariosKpis();
  renderSalariosTable();

  const sb = document.getElementById('sal-body');
  if (sb && !sb.dataset.expbound) {
    sb.dataset.expbound = '1';
    sb.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      const tr = e.target.closest('.sal-prow'); if (!tr) return;
      const exp = tr.nextElementSibling;
      if (!exp || !exp.classList.contains('sal-exp')) return;
      const open = tr.classList.toggle('open'); exp.hidden = !open;
    });
  }
  renderSalariosFranquicias();
}

function renderSalariosFranquicias() {
  if (!SAL_PE) return;
  const fr = (SAL_PE.franquicias || []).slice().sort((a, b) => b.pagado - a.pagado);
  const fmx = fr.length ? fr[0].pagado : 1, ftot = fr.reduce((s, f) => s + f.pagado, 0);
  const fsub = document.getElementById('se-fsub');
  if (fsub) fsub.innerHTML = 'Dinero realmente cobrado por españoles en cada franquicia · <b>' + seMoney(ftot) + '</b> en total, en ' + fr.length + ' equipos.';
  const fbody = document.getElementById('se-fbody');
  if (fbody) fbody.innerHTML = fr.map((f, i) => {
    const pls = f.jugadores || [];
    const names = pls.slice(0, 4).map(n => SE_DISP[n] || n).join(', ') + (pls.length > 4 ? '…' : '');
    return '<tr><td class="se-frk">' + (i + 1) + '</td>'
      + '<td><span class="se-fdot" style="background:' + (SE_COL[f.equipo] || '#b91c1c') + '"></span><span class="se-fcode">' + f.nombre + '</span></td>'
      + '<td class="se-fbar"><div class="se-ftrk"><div class="se-fbarf" style="width:' + (100 * f.pagado / fmx).toFixed(1) + '%;background:' + (SE_COL[f.equipo] || '#b91c1c') + '"></div></div></td>'
      + '<td class="se-famt">' + seMoney(f.pagado) + '</td>'
      + '<td class="se-fpct">' + (ftot ? (100 * f.pagado / ftot).toFixed(1) : '0') + '%</td>'
      + '<td class="se-fpls">' + names + '</td></tr>';
  }).join('');
  const nunca = (SAL_PE.nunca_jugaron || []).join(', ');
  const note = document.getElementById('se-note');
  if (note) note.innerHTML = '🚫 ' + (SAL_PE.nota_global || '') + (nunca ? ' Las que nunca han tenido un español en cancha: <b>' + nunca + '</b>.' : '');
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
      <div class="kpi-num">${fmtPctN(pctGasol)}</div>
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
      return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (salSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortSal('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  // barra escalada respecto a la mayor cuota (el líder llena la barra)
  const maxPct = Math.max(...salRows.map(j => j.pct || 0), 0);
  const maxGan = Math.max(...salRows.map(j => j.ganancias || 0), 0);
  const maxSpj = Math.max(...salRows.map(j => j.sueldo_pj || 0), 0);

  document.getElementById('sal-body').innerHTML = rows.map((j, i) => {
    const spl = SAL_SPLITS[drNorm(j.nombre)];
    const ents = spl ? Object.entries(spl.splits).sort((a, b) => b[1] - a[1]) : [];
    let exp;
    if (ents.length) {
      const mx = ents[0][1], tot = ents.reduce((s, [, v]) => s + v, 0);
      const bars = ents.map(([tm, v]) => `<div class="se-gpe-top"><div class="se-gpe-code">${tm}</div><div class="se-gpe-track"><div class="se-gpe-bar" style="width:${(100 * v / mx).toFixed(1)}%;background:${SE_COL[tm] || '#b91c1c'}"></div></div><div class="se-gpe-amt">${seMoney(v)} <span class="p">· ${tot ? (100 * v / tot).toFixed(1) : 0}%</span></div></div>`).join('');
      exp = `<tr class="sal-exp" hidden><td colspan="9"><div class="se-exp-inner"><div class="se-exp-title">💰 Lo que le pagó cada franquicia</div><div class="se-gpe">${bars}${spl.nota ? `<p class="se-hint">${spl.nota}</p>` : ''}</div></div></td></tr>`;
    } else {
      exp = `<tr class="sal-exp" hidden><td colspan="9"><div class="se-exp-inner"><p class="se-hint" style="margin-top:0">Sin desglose por franquicia disponible.</p></div></td></tr>`;
    }
    return `
    <tr class="sal-prow">
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" class="player-thumb" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'player-thumb')}</a></td>
      <td class="td-nombre">${plLink(j.nombre, j.nombre)}</td>
      <td class="td-num td-dinero${maxGan && j.ganancias === maxGan ? ' td-leader' : ''}">${fmtDinero(j.ganancias)}</td>
      <td class="td-num td-muted">${fmtDinero(j.ganancias_ganado)}</td>
      <td class="td-num td-muted">${fmtDinero(j.ganancias_futuro)}</td>
      <td class="td-num${maxSpj && j.sueldo_pj === maxSpj ? ' td-leader' : ''}">${fmtDinero(j.sueldo_pj)}</td>
      <td class="td-num">${renderPct(j.pct, maxPct ? (j.pct || 0) / maxPct * 100 : 0)}</td>
      <td class="td-muted td-equipos">${j.equipos_nba ? j.equipos_nba.replace(/\s*,\s*/g, ' · ') : '—'} <span class="sal-chev">▸</span></td>
    </tr>${exp}`;
  }).join('');

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
    <span class="pct-val">${fmtPctN(pct)}</span>
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

  // Por defecto, agrupado por jugador (cada español una fila con sus Summer Leagues).
  // ?grupo=year para agrupar por año, ?grupo=none para la lista plana.
  const grupo = new URLSearchParams(location.search).get('grupo');
  slGroup = grupo === 'year' ? 'year' : grupo === 'none' ? '' : 'player';
  slSortCol = slGroup ? 'count' : 'year';
  syncSlGroupButtons();

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
  document.getElementById('hero-sub').textContent =
    `${participaciones} participaciones de ${jugadores} españoles en la Summer League`;
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
      return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (slSortAsc ? ' asc' : '') : ''}"
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

  // Anillos NBA (no vienen en los premios del volcado): se añaden desde el mapa de campeones
  (data.jugadores || []).forEach(j => {
    const rings = TL_ANILLOS[drNorm(j.nombre)];
    if (rings) Object.keys(rings).forEach(y =>
      prAll.push({ tipo: 'Campeón NBA', year: +y, team: rings[y], notas: 'Anillo NBA', jugador: j.nombre }));
  });

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
    '<option value="">Todos los tipos</option>' + tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
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
      return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (sortAsc ? ' asc' : '') : ''}"
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
      <td class="td-center">${escapeHtml(p.team || '—')}</td>
      <td>${escapeHtml(p.tipo)}</td>
      <td class="td-muted td-notas">${escapeHtml(p.notas || '—')}</td>
    </tr>`).join('') || `<tr><td colspan="6" class="td-muted" style="padding:2rem;text-align:center">Sin resultados.</td></tr>`;
}

function premioRowClass(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('campe')) return 'row-oro';
  if (t === 'roy' || t === 'dpoy') return 'row-oro';
  if (t === 'all nba' || t === 'all defense') return 'row-verde';
  return '';
}

// Orden de importancia (menor índice = más importante, arriba). Concursos siempre al final.
// 'mvp' aquí = votos al MVP (no ganado), va en medio, no en cabeza
const PREMIO_ORDEN = ['campeon', 'dpoy', 'roy', 'all nba', 'all defense', 'all rookie', 'mvp', 'player of the month', 'rookie of the month', 'all star', 'rising stars'];
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
      <td>${escapeHtml(g.tipo)}</td>
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
let rkRegAll = [], rkPoAll = [];
let rkDim = 'reg';          // 'reg' (temporada regular) | 'po' (playoffs)
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
// Igual que fmtPct pero el valor ya viene en escala 0-100 (no 0-1). Usa coma decimal (es-ES).
function fmtPctN(n) { return (n || n === 0) ? Number(n).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '—'; }

async function initRankingPage() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    document.getElementById('hero-sub').textContent = 'Error al cargar los datos';
    return;
  }

  buildPlayerIds(data.jugadores);
  rkRegAll = (data.jugadores || []).filter(j => (j.partidos || 0) > 0);
  rkRegAll.forEach(j => { j.pct_gs = j.partidos ? (j.partidos_titular || 0) / j.partidos : 0; });
  // Ranking de playoffs: se deriva de playoffs_totales (mismas claves que las de carrera regular)
  rkPoAll = (data.jugadores || []).filter(j => j.playoffs_totales && (j.playoffs_totales.partidos || 0) > 0)
    .map(j => {
      const pt = j.playoffs_totales;
      return { id: j.id, nombre: j.nombre, foto_url: j.foto_url, bref_id: j.bref_id, ...pt,
        pct_gs: pt.partidos ? (pt.partidos_titular || 0) / pt.partidos : 0 };
    });

  const params = new URLSearchParams(location.search);
  if (params.get('tipo') === 'po' && rkPoAll.length) {
    rkDim = 'po';
    const dsel = document.getElementById('rk-dim'); if (dsel) dsel.value = 'po';
  }
  rkAll = rkDim === 'po' ? rkPoAll : rkRegAll;
  buildRkRanks();

  // Modo desde la URL (?modo=totales)
  const modo = params.get('modo');
  if (modo === 'totales' || modo === 'tot') rkMode = 'tot';
  rkSortCol = rkMode === 'pg' ? 'pts_g' : 'pts_total';
  syncRkModeButtons();

  rkUpdateHero();
  renderRkKpis();
  document.getElementById('rk-search').addEventListener('input', e => { rkSearch = e.target.value.trim().toLowerCase(); renderRkTable(); });
  const rkQ = new URLSearchParams(location.search).get('q');
  if (rkQ) { rkSearch = rkQ.trim().toLowerCase(); document.getElementById('rk-search').value = rkQ; }
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
  const s = document.getElementById('rk-mode'); if (s) s.value = rkMode;
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

function rkUpdateHero() {
  document.getElementById('hero-sub').textContent = rkDim === 'po'
    ? `${rkAll.length} españoles con partidos de playoffs · Totales y medias de playoffs`
    : `${rkAll.length} jugadores con partidos en la NBA · Estadísticas de carrera`;
}

function setRkDim(d) {
  if (rkDim === d) return;
  rkDim = d;
  rkAll = d === 'po' ? rkPoAll : rkRegAll;
  const dsel = document.getElementById('rk-dim'); if (dsel) dsel.value = d;
  updateUrlParam('tipo', d === 'po' ? 'po' : '');
  buildRkRanks();
  rkUpdateHero();
  renderRkKpis();
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
      return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (rkSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortRk('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('rk-body').innerHTML = rows.map((j, i) => `
    <tr>
      ${cols.map(c => {
        if (c.key === 'rank') return `<td class="td-rank td-muted">${i + 1}</td>`;
        if (c.key === 'foto') return `<td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" class="player-thumb" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'player-thumb')}</a></td>`;
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
  if (j && (j.id || j.foto_url || j.bref_id)) return `<span class="dp-photo"><img loading="lazy" ${agFotoSrc(j)} onerror="agImgRemove(this)" alt=""></span>`;
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
  drPjRows = rows;

  el.innerHTML = `
    <h2 class="section-title">Dorsales por jugador</h2>
    <p class="section-sub">Pulsa un jugador para ver sus dorsales marcados arriba.</p>
    <ul class="dr-pj-list">
      ${rows.map((r, i) => `<li class="dr-pj-item" data-i="${i}" onclick="drTogglePlayer(${i})"><span class="dr-pj-n">${r.n}</span><span>${r.jug}</span></li>`).join('')}
    </ul>`;
}
let drPjRows = [], drSelPlayer = null;
function drTogglePlayer(i) {
  const jug = drPjRows[i] && drPjRows[i].jug;
  if (!jug) return;
  const same = drSelPlayer === jug;
  document.querySelectorAll('.jersey.jersey-player').forEach(b => b.classList.remove('jersey-player'));
  document.querySelectorAll('.dr-pj-item.dr-pj-sel').forEach(li => li.classList.remove('dr-pj-sel'));
  if (same) { drSelPlayer = null; return; }
  drSelPlayer = jug;
  const btns = document.querySelectorAll('.jersey');
  drAll.forEach(d => { if (d.jugador === jug) { const n = Number(d.numero); if (btns[n]) btns[n].classList.add('jersey-player'); } });
  const li = document.querySelector(`.dr-pj-item[data-i="${i}"]`);
  if (li) { li.classList.add('dr-pj-sel'); }
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
    <div class="kpi"><div class="kpi-num">${top.n != null ? '#' + top.n : '—'}</div><div class="kpi-label">Más llevado${top.c ? ` · ${top.c} jugadores` : ''}</div></div>
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
  btns.forEach(b => b.classList.remove('jersey-sel'));
  const panel = document.getElementById('dr-detail');

  if (n === null || n === undefined) {
    drSel = null;
    panel.innerHTML = `<p class="dorsal-hint">Elige un dorsal para ver qué españoles lo han llevado.</p>`;
    return;
  }
  drSel = n;
  if (btns[n]) btns[n].classList.add('jersey-sel');

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
  { key: 'jugador', label: 'Jugador',  sortable: true,  cls: 'td-nombre' },
  { key: 'fecha',   label: 'Fecha',    sortable: true,  cls: 'td-center' },
  { key: 'tipo',    label: 'Tipo',     sortable: true },
  { key: 'equipo1', label: 'Equipo',   sortable: true,  cls: 'td-center' },
  { key: 'equipo2', label: 'Equipo 2', sortable: true,  cls: 'td-center' },
  { key: 'contrato', label: 'Contrato', sortable: false, cls: 'td-center' },
  { key: 'chevron', label: '',         sortable: false, cls: 'td-chevron' },
];

// El contrato solo aplica a firmas (agente libre, rookie, renovación/extensión).
// Usa el campo CONTRATO del sheet si existe; si no, cae a las notas (donde hoy va el importe).
function trEsFirma(t) { return /agente libre|firma contrato rookie|renovaci|extensi/i.test(t.tipo || ''); }
function trContrato(t) { return trEsFirma(t) ? String(t.contrato ?? t.CONTRATO ?? t.Contrato ?? t.notas ?? '').trim() : ''; }

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
// Celda de equipo: nombre completo (escritorio) + abreviatura (móvil, vía CSS)
function trTeamCell(name) {
  if (!name) return '—';
  return `<span class="team-full">${name}</span><span class="team-abbr">${teamAbbr(name)}</span>`;
}

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESES_LARGOS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
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
  const trQ = new URLSearchParams(location.search).get('q');
  if (trQ) { trSearch = trQ.trim().toLowerCase(); document.getElementById('tr-search').value = trQ; }
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
    <div class="kpi"><div class="kpi-num">${topTipo[1]}</div><div class="kpi-label">Más común · ${escapeHtml(topTipo[0])}</div></div>
    <div class="kpi"><div class="kpi-num">${topJug[1]}</div><div class="kpi-label">Más movido · ${escapeHtml(topJug[0])}</div></div>`;
}

function buildTrFilters() {
  const tipos = [...new Set(trAll.map(t => t.tipo))].sort();
  document.getElementById('tr-tipo').innerHTML =
    '<option value="">Todos los tipos</option>' + tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
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
      return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (trSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortTr('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('tr-body').innerHTML = rows.map((t, i) => `
    <tr class="tr-row" tabindex="0" role="button" aria-label="Ver detalle de la transacción de ${escapeHtml(t.jugador)}"
        onclick="openTrDrawer('${t._id}')"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTrDrawer('${t._id}');}">
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-nombre" onclick="event.stopPropagation()">${plLink(t.jugador, escapeHtml(t.jugador))}</td>
      <td class="td-center td-muted">${trFechaDisplay(t.fecha)}</td>
      <td><span class="tr-tipo ${trTipoClass(t.tipo)}">${escapeHtml(t.tipo)}</span></td>
      <td class="td-center">${trTeamCell(t.equipo1)}</td>
      <td class="td-center">${trTeamCell(t.equipo2)}</td>
      <td class="td-center td-muted">${escapeHtml(trContrato(t) || '—')}</td>
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
  // Campo CONTRATO (solo firmas). Cae a las notas si el sheet no exporta un campo propio.
  const contrato = trContrato(t);
  const filas = [
    ['Jugador', plLink(t.jugador, escapeHtml(t.jugador))],
    contrato ? ['Contrato', escapeHtml(contrato)] : null,
    t.equipo1 ? ['Equipo', teamFull(t.equipo1)] : null,
    t.equipo2 ? ['Segundo equipo', teamFull(t.equipo2)] : null,
    t.otros ? ['Otros jugadores', escapeHtml(t.otros)] : null,
  ].filter(Boolean);

  document.getElementById('tr-drawer-content').innerHTML = `
    <span class="tr-tipo ${trTipoClass(t.tipo)} drawer-tag">${escapeHtml(t.tipo)}</span>
    <h2 class="drawer-title" id="tr-drawer-title">${escapeHtml(t.jugador)}</h2>
    <p class="drawer-sub">${trFechaDisplay(t.fecha)}</p>
    <dl class="drawer-dl">
      ${filas.map(([k, v]) => `<div class="drawer-row"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}
    </dl>
    ${(t.notas && t.notas !== contrato) ? `<div class="drawer-notas"><h3>Notas</h3><p>${escapeHtml(t.notas)}</p></div>` : ''}`;

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
function jugadorHref(id) { return `jugador-${id}.html`; }

function jugPhoto(j, cls) {
  if (j.id || j.foto_url || j.bref_id) return `<span class="jug-photo ${cls || ''}"><img loading="lazy" ${agFotoSrc(j)} onerror="agImgRemove(this)" alt="${j.nombre}"></span>`;
  return avatarHtml(j.nombre, `jug-photo ${cls || ''}`);
}

function jugSection(title, body) {
  return `<section class="jug-section"><h2 class="section-title">${title}</h2>${body}</section>`;
}

// Enlaces cruzados: ver a este jugador en las demás secciones (con su fila ya filtrada/resaltada)
function jugCrossLinks(j, trans) {
  const enc = encodeURIComponent(j.nombre);
  const links = [];
  if ((j.partidos || 0) > 0) links.push(['Carrera', `ranking.html?q=${enc}`]);
  if ((j.temporadas_data || []).some(t => t.year)) {
    links.push(['Temporadas', `temporadas.html?q=${enc}`]);
    links.push(['Línea temporal', `linea-temporal.html?focus=${j.id}`]);
  }
  if ((trans || []).length) links.push(['Transacciones', `transacciones.html?q=${enc}`]);
  links.push(['Comparar', `comparador.html?a=${j.id}`]);
  const items = links.map(([l, h]) => `<a class="jug-xlink" href="${h}">${l}</a>`).join('');
  return `<nav class="jug-xlinks" aria-label="Ver en otras secciones"><span class="jug-xlinks-lbl">Ver también en</span>${items}</nav>`;
}
function statBox(label, val) {
  return `<div class="stat-box"><div class="stat-box-val">${val}</div><div class="stat-box-lbl">${label}</div></div>`;
}

let jugAll = [], jugEvents = [], jugCurrent = null;
async function initJugadorPage() {
  let id = new URLSearchParams(location.search).get('id');
  if (!id) { const m = location.pathname.match(/jugador-([^/]+?)\.html$/); if (m) id = decodeURIComponent(m[1]); }
  const el = document.getElementById('jug-content');
  let data;
  try { data = await loadData(); }
  catch (e) { el.innerHTML = '<p class="td-muted" style="padding:2rem">Error al cargar los datos.</p>'; return; }

  const j = (data.jugadores || []).find(p => p.id === id);
  if (!j) { el.innerHTML = '<p class="td-muted" style="padding:2rem">Jugador no encontrado.</p>'; return; }
  jugCurrent = j;
  document.title = `${j.nombre} · Españoles en la NBA`;

  buildPlayerIds(data.jugadores);
  jugAll = data.jugadores || [];
  jugEvents = efmBuild(data);

  const n = drNorm(j.nombre);
  const dorsales = (data.dorsales || []).filter(d => drNorm(d.jugador) === n);
  const sl = (data.summer_league || []).filter(s => drNorm(s.jugador) === n);
  const trans = (data.transacciones || []).filter(t => drNorm(t.jugador) === n);
  trans.forEach(t => { t._id = t._id || trMakeId(t); });
  trAll = trans;   // para que el drawer (openTrDrawer) encuentre la transacción

  el.innerHTML = [
    jugHeader(j),
    jugCrossLinks(j, trans),
    jugRankings(j),
    jugMarcas(j, data),
    jugStats(j),
    jugDebut(j),
    jugGameHighs(j),
    jugTemporadas(j),
    jugPlayoffs(j),
    jugPremios(j),
    jugRecords(j),
    jugSalario(j),
    jugDorsalesSec(dorsales),
    jugSummer(sl),
    jugEfemerides(j),
    jugTransSec(trans),
  ].filter(Boolean).join('');
}

// Datos biográficos (mantenidos a mano — corregir aquí). Clave: nombre normalizado (drNorm)
const BIO = {
  'pau gasol':            { altura: '2,16 m', peso: '109 kg', origen: 'Barcelona' },
  'marc gasol':           { altura: '2,11 m', peso: '116 kg', origen: 'Barcelona' },
  'nikola mirotic':       { altura: '2,08 m', peso: '101 kg', origen: 'Podgorica (Montenegro)' },
  'serge ibaka':          { altura: '2,08 m', peso: '107 kg', origen: 'Brazzaville (Rep. del Congo)' },
  'juan carlos navarro':  { altura: '1,93 m', peso: '80 kg',  origen: 'Sant Feliu de Llobregat (Barcelona)' },
  'ricky rubio':          { altura: '1,88 m', peso: '86 kg',  origen: 'El Masnou (Barcelona)' },
  'santi aldama':         { altura: '2,13 m', peso: '98 kg',  origen: 'Las Palmas de Gran Canaria' },
  'rudy fernandez':       { altura: '1,96 m', peso: '82 kg',  origen: 'Palma de Mallorca' },
  'jose m. calderon':     { altura: '1,91 m', peso: '91 kg',  origen: 'Villanueva de la Serena (Badajoz)' },
  'jorge garbajosa':      { altura: '2,06 m', peso: '104 kg', origen: 'Torrejón de Ardoz (Madrid)' },
  'willy hernangomez':    { altura: '2,11 m', peso: '113 kg', origen: 'Madrid' },
  'raul lopez':           { altura: '1,83 m', peso: '75 kg',  origen: 'Vic (Barcelona)' },
  'alex abrines':         { altura: '1,98 m', peso: '91 kg',  origen: 'Palma de Mallorca' },
  'juancho hernangomez':  { altura: '2,06 m', peso: '97 kg',  origen: 'Madrid' },
  'sergio rodriguez':     { altura: '1,91 m', peso: '80 kg',  origen: 'San Cristóbal de La Laguna (Tenerife)' },
  'hugo gonzalez':        { altura: '1,98 m', peso: '93 kg',  origen: 'Madrid' },
  'victor claver':        { altura: '2,06 m', peso: '102 kg', origen: 'Valencia' },
  'usman garuba':         { altura: '2,03 m', peso: '104 kg', origen: 'Azuqueca de Henares (Guadalajara)' },
  'fernando martin':      { altura: '2,05 m', peso: '104 kg', origen: 'Madrid' },
  'baba miller':          { altura: '2,11 m', peso: '98 kg',  origen: 'Palma de Mallorca' },
  'sergio de larrea':     { altura: '1,98 m', peso: '87 kg',  origen: 'Valladolid' },
  'aday mara':            { altura: '2,21 m', peso: '111 kg', origen: 'Zaragoza' },
  'jose a. montero':      { altura: '1,88 m',                 origen: 'Barcelona' },
  'roberto duenas':       { altura: '2,21 m', peso: '137 kg', origen: 'Madrid' },
  'albert miralles':      { altura: '2,08 m', peso: '105 kg', origen: 'Barcelona' },
  'fran vazquez':         { altura: '2,07 m', peso: '98 kg',  origen: 'Chantada (Lugo)' },
  'sergio llull':         { altura: '1,90 m', peso: '86 kg',  origen: 'Mahón (Menorca)' },
  'dani diez':            { altura: '2,02 m', peso: '96 kg',  origen: 'Madrid' },
  'juan nunez':           { altura: '1,93 m', peso: '91 kg',  origen: 'Madrid' },
};

function jugHeader(j) {
  const bio = BIO[drNorm(j.nombre)] || {};
  const nac = j.nacimiento_fecha || j.nacimiento;
  const fisico = [bio.altura, bio.peso].filter(Boolean).join(' · ');
  const draftVal = j.draft
    ? `${j.draft_anio || ''} · #${j.draft_pick || '?'}${j.draft_equipo ? ' · ' + j.draft_equipo : ''}`.trim()
    : 'No drafteado';
  const debut = (j.primer_partido && j.primer_partido.fecha) ? j.primer_partido.fecha : '';
  const equipos = j.equipos_nba ? j.equipos_nba.replace(/\s*,\s*/g, ' · ') : '';
  const fact = (label, val) => val ? `<div class="jug-fact"><dt>${label}</dt><dd>${escapeHtml(val)}</dd></div>` : '';
  const facts = [
    fact('Nacido', nac),
    fact('Físico', fisico),
    fact('Draft', draftVal),
    fact('Debut', debut),
    fact('Equipos', equipos),
  ].join('');
  const pin = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  const origin = bio.origen ? `<p class="jug-origin">${pin}<span>${escapeHtml(bio.origen)}</span></p>` : '';
  const bref = j.bref_id
    ? `<a class="jug-act-btn jug-act-ghost" href="https://www.basketball-reference.com/players/${j.bref_id[0]}/${j.bref_id}.html" target="_blank" rel="noopener noreferrer">Basketball Reference<span aria-hidden="true"> ↗</span></a>`
    : '';
  const shareBtn = `<button type="button" class="jug-act-btn jug-act-primary" onclick="jugShareCard()" aria-label="Compartir ficha en X"><span class="jug-act-ico"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></span> Compartir ficha</button>`;
  return `<header class="jug-hero">
    <h1 class="jug-name">${escapeHtml(j.nombre)}</h1>
    <span class="jug-hero-accent" aria-hidden="true"></span>
    <div class="jug-hero-body">
      ${jugPhoto(j, 'jug-photo--hero')}
      <div class="jug-hero-info">
        ${origin}
        <dl class="jug-facts">${facts}</dl>
        <div class="jug-actions">${shareBtn}${bref}</div>
      </div>
    </div>
  </header>`;
}

// Compartir la ficha en X: solo el enlace + texto, para que X muestre la tarjeta
// de acción (og:image) del jugador como preview (no adjuntamos imagen propia).
async function jugShareCard() {
  const j = jugCurrent; if (!j) return;
  track('compartir', { metodo: 'twitter', origen: 'ficha_jugador', jugador: j.nombre });
  const who = (typeof efmHandle === 'function' && efmHandle(j.nombre)) || j.nombre;
  const texto = `${who} en la NBA 🏀 #EspañolesNBA (vía @alejandroggo)`;
  const url = location.href;
  const xIntent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(texto + '\n\n' + url);
  // Siempre a X. No adjuntamos imagen, así que X muestra la tarjeta de acción del jugador.
  window.open(xIntent, '_blank', 'noopener,noreferrer');
}

function jugMarcas(j, data) {
  const marks = rwBuild(data).filter(w => (w.j.id || w.j.nombre) === (j.id || j.nombre));
  if (!marks.length) return '';
  const items = marks.map(w => {
    const sw = w.gap === 1 ? (RW_SING[w.stat] || w.stat) : w.stat;
    let txt;
    if (w.type === 'pass') {
      const rivalLink = w.rivalId ? `<a class="pl-link" href="${jugadorHref(w.rivalId)}">${w.rival}</a>` : w.rival;
      txt = `A <b>${w.gap} ${sw}</b> de superar a ${rivalLink}${w.rivalRank ? ` <span class="hw-rank">(sería ${w.rivalRank}º)</span>` : ''}`;
    } else if (w.type === 'season') {
      txt = `A <b>${w.gap.toLocaleString('es-ES')} ${sw}</b> de batir el récord español en una temporada (${w.recPlayer}, ${drSeason(w.recYear)})`;
    } else {
      txt = `A <b>${w.gap} ${sw}</b> de los ${w.milestone.toLocaleString('es-ES')}`;
    }
    const badge = isFinite(w.games) ? `~${w.games} ${w.games === 1 ? 'partido' : 'partidos'}` : 'Debutante';
    return `<li class="jugmk-item"><span class="jugmk-txt">${txt}</span><span class="hw-badge">${badge}</span></li>`;
  }).join('');
  return jugSection('Marcas al alcance', `<ul class="jugmk-list">${items}</ul>`);
}

function jugStats(j) {
  if (!(j.partidos > 0)) return '';
  const gp = j.partidos || 0;
  const perg = (total) => gp ? total / gp : null;
  const pg = [
    statBox('GP', fmtEnt(j.partidos)), statBox('MIN', fmtDec1(j.min_g)), statBox('PTS', fmtDec1(j.pts_g)),
    statBox('REB', fmtDec1(j.rbd_g)), statBox('AST', fmtDec1(j.ast_g)), statBox('ROB', fmtDec1(j.stl_g)),
    statBox('TAP', fmtDec1(j.blk_g)), statBox('3PM', fmtDec1(j.tres_g)),
    statBox('TOV', fmtDec1(perg(j.tov_total))), statBox('PF', fmtDec1(perg(j.pf_total))),
    statBox('FG%', fmtPct(j.fg_pct)), statBox('3P%', fmtPct(j.tres_pct)), statBox('FT%', fmtPct(j.ft_pct)),
  ].join('');
  const tot = [
    statBox('GP', fmtEnt(j.partidos)), statBox('MIN', fmtEnt(j.min_total)), statBox('PTS', fmtEnt(j.pts_total)),
    statBox('REB', fmtEnt(j.rbd_total)), statBox('AST', fmtEnt(j.ast_total)), statBox('ROB', fmtEnt(j.stl_total)),
    statBox('TAP', fmtEnt(j.blk_total)), statBox('3PM', fmtEnt(j.tres_total)),
    statBox('TOV', fmtEnt(j.tov_total)), statBox('PF', fmtEnt(j.pf_total)), statBox('TD', fmtEnt(j.td_total)),
  ].join('');
  return jugSection('Estadísticas de carrera',
    `<h3 class="jug-subh">Por partido</h3><div class="stat-grid">${pg}</div>
     <h3 class="jug-subh">Totales</h3><div class="stat-grid">${tot}</div>`);
}

// Máximos en un solo partido (career highs)
function jugGameHighs(j) {
  const g = j.game_highs;
  if (!g) return '';
  const boxes = [
    ['MIN', g.min], ['PTS', g.pts], ['REB', g.rbd], ['AST', g.ast], ['ROB', g.stl], ['TAP', g.blk],
    ['FGM', g.fgm], ['3PM', g.tres_m], ['FTM', g.ftm], ['TOV', g.tov], ['PF', g.pf],
  ].filter(([, v]) => v != null).map(([l, v]) => statBox(l, fmtEnt(v))).join('');
  if (!boxes) return '';
  return jugSection('Máximos en un partido', `<div class="stat-grid">${boxes}</div>`);
}

// Tarjeta del debut en la NBA (box score del primer partido)
function jugDebut(j) {
  const p = j.primer_partido;
  if (!p || !p.fecha) return '';
  const rl = String(p.resultado).toLowerCase();
  const resHtml = rl === 'true' ? '<span class="jug-debut-res win">Victoria</span>'
    : rl === 'false' ? '<span class="jug-debut-res loss">Derrota</span>' : '';
  const vs = `${teamInfo(p.equipo).name}${p.rival ? ` vs ${teamInfo(p.rival).name}` : ''}`;
  const boxes = [
    ['MIN', p.min], ['PTS', p.pts], ['REB', p.rbd], ['AST', p.ast], ['ROB', p.stl], ['TAP', p.blk],
    ['FG', (p.fgm != null && p.fga != null) ? `${p.fgm}/${p.fga}` : null],
    ['3P', (p.tres_m != null && p.tres_a != null) ? `${p.tres_m}/${p.tres_a}` : null],
    ['FT', (p.ftm != null && p.fta != null) ? `${p.ftm}/${p.fta}` : null],
    ['TOV', p.tov], ['PF', p.pf],
  ].filter(([, v]) => v != null && v !== '').map(([l, v]) => statBox(l, v)).join('');
  const vid = efmYtId(p.video);
  const videoBtn = vid ? `<button type="button" class="efm-video-btn jug-debut-video-btn" onclick="efmPlayVideo(this,'${vid}')"><span class="efm-video-ico">▶</span> Ver vídeo del debut</button>` : '';
  const meta = `<div class="jug-debut-meta"><b>${vs}</b>${resHtml}<span class="jug-debut-sub">${p.fecha}${p.edad != null ? ` · ${Math.floor(p.edad)} años` : ''}</span>${videoBtn}</div>`;
  return jugSection('Su debut en la NBA', `${meta}<div class="stat-grid">${boxes}</div>`);
}

// Puesto histórico del jugador entre los españoles que han debutado en la NBA.
// Fijas: puntos, rebotes y asistencias. Más las dos categorías donde mejor clasificado esté.
function jugRankings(j) {
  const pool = jugAll.filter(p => p.partidos > 0);
  if (!(j.partidos > 0) || !pool.length) return '';
  const N = pool.length;
  // Ranking de competición: nº de jugadores con valor estrictamente mayor + 1
  const rankIn = (subpool, key) => {
    const jv = j[key];
    if (jv == null) return null;
    if (!subpool.some(p => p.id === j.id)) return null;
    return subpool.filter(p => p[key] != null && p[key] > jv).length + 1;
  };
  const rankTot = key => (j[key] > 0 ? rankIn(pool, key) : null);
  // Los porcentajes solo se rankean con un mínimo de partidos (evita cifras engañosas con pocas muestras)
  const pctPool = pool.filter(p => p.partidos >= 20 && p.fg_pct != null);
  const rankPct = key => (j.partidos >= 20 && j[key] != null ? rankIn(pctPool, key) : null);
  const chip = (rank, label) => rank ? `<span class="jug-rank-chip${rank === 1 ? ' first' : rank <= 3 ? ' top' : ''}"><b>#${rank}</b> en ${label}</span>` : '';

  const fijas = [chip(rankTot('pts_total'), 'puntos'), chip(rankTot('rbd_total'), 'rebotes'), chip(rankTot('ast_total'), 'asistencias')];

  const cands = [
    { rank: rankTot('blk_total'), label: 'tapones' },
    { rank: rankTot('stl_total'), label: 'robos' },
    { rank: rankTot('tres_total'), label: 'triples' },
    { rank: rankPct('tres_pct'), label: '% de triple' },
    { rank: rankPct('fg_pct'), label: '% de tiro' },
    { rank: rankPct('ft_pct'), label: '% en tiros libres' },
  ];
  const extras = cands.map((c, i) => (c.rank ? { ...c, pri: i } : null)).filter(Boolean)
    .sort((a, b) => a.rank - b.rank || a.pri - b.pri).slice(0, 2)
    .map(c => chip(c.rank, c.label));

  const chips = [...fijas, ...extras].filter(Boolean).join('');
  if (!chips) return '';
  return jugSection('Entre los españoles',
    `<p class="jug-rank-note">Puesto histórico entre los ${N} españoles que han debutado en la NBA.</p>
     <div class="jug-ranks">${chips}</div>`);
}

// Efemérides del jugador (debut, draft, fichajes, hitos) enlazando a la página de Efemérides
function jugEfemerides(j) {
  // En la ficha ocultamos: transacciones (ya salen abajo), draft (en transacciones) y cumpleaños.
  const evs = jugEvents.filter(e => drNorm(e.player || '') === drNorm(j.nombre) && e.kind !== 'trans' && e.kind !== 'draft' && e.kind !== 'cumple');
  if (!evs.length) return '';
  evs.sort((a, b) => a.year - b.year || a.m - b.m || a.d - b.d);
  const items = evs.map(e => {
    const tags = String(e.tag || '').split(/\s*[,/|]\s*/).map(s => s.trim()).filter(Boolean);
    const tagsHtml = (tags.length ? tags : ['Hito']).map(t => `<span class="tr-tipo ${efmTagClass(t)} efm-tag">${t}</span>`).join(' ');
    // En su propia ficha quitamos el nombre del jugador (redundante) y ponemos la frase en mayúscula
    let txt = e.html.replace(/^<b>[\s\S]*?<\/b>\s*/, '');
    txt = txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : e.html;
    const vid = efmYtId(e.video);
    const videoBtn = vid ? `<button type="button" class="efm-video-btn jug-efm-video" onclick="efmPlayVideo(this,'${vid}')"><span class="efm-video-ico">▶</span> Ver vídeo</button>` : '';
    return `<li class="jug-efm-item">
      <a class="jug-efm-date" href="efemerides.html?m=${e.m}&d=${e.d}">${e.d} ${MESES[e.m - 1]} ${e.year}</a>
      <div class="jug-efm-body"><div class="jug-efm-top"><span class="efm-tags">${tagsHtml}</span>${videoBtn}</div><span class="jug-efm-txt">${txt}</span></div>
    </li>`;
  }).join('');
  return jugSection('Efemérides', `<ul class="jug-efm-list">${items}</ul>`);
}

let jugSeasonJ = null, jugSeasonMode = 'pg';
const JUG_SEASON_BASE = [['MIN', 'min_g'], ['PTS', 'pts_g'], ['REB', 'rbd_g'], ['AST', 'ast_g'], ['ROB', 'stl_g'], ['TAP', 'blk_g'], ['FGM', 'fgm_g'], ['3PM', 'tres_g'], ['FTM', 'ftm_g'], ['TOV', 'tov_g'], ['PF', 'pf_g']];

function jugSeasonTableHtml() { return seasonRowsHtml(jugSeasonJ.temporadas_data, jugSeasonMode); }

// Tabla temporada a temporada (reutilizable: temporada regular o playoffs)
function seasonRowsHtml(seasons, mode) {
  const sorted = (seasons || []).filter(x => x.year).sort((a, b) => (a.year || 0) - (b.year || 0));
  const yearCount = {};
  sorted.forEach(t => { yearCount[t.year] = (yearCount[t.year] || 0) + 1; });
  const head = `<th class="td-center">Año</th><th class="td-center">Equipo</th><th class="td-num">GP</th>`
    + JUG_SEASON_BASE.map(([l]) => `<th class="td-num">${l}</th>`).join('')
    + (mode === 'pg' ? `<th class="td-num">FG%</th><th class="td-num">3P%</th><th class="td-num">FT%</th>` : `<th class="td-num">TD</th>`);
  const rows = sorted.map(t => {
    const isTot = String(t.team || '').toUpperCase() === 'TOT';
    const split = yearCount[t.year] > 1 && !isTot;
    const teamCell = split ? `<span class="season-split-mark">↳</span> ${t.team || '—'}` : (t.team || '—');
    const cells = JUG_SEASON_BASE.map(([, k]) => mode === 'pg'
      ? `<td class="td-num">${fmtDec1(t[k])}</td>`
      : `<td class="td-num">${(t[k] != null && t.g) ? fmtEnt(t[k] * t.g) : '—'}</td>`).join('');
    const extra = mode === 'pg'
      ? `<td class="td-num">${fmtPct(t.fg_pct)}</td><td class="td-num">${fmtPct(t.tres_pct)}</td><td class="td-num">${fmtPct(t.ft_pct)}</td>`
      : `<td class="td-num">${t.td != null ? fmtEnt(t.td) : '—'}</td>`;
    return `<tr class="${split ? 'season-split' : (isTot ? 'season-tot' : '')}">
      <td class="td-center">${drSeason(t.year)}</td><td class="td-center">${teamCell}</td><td class="td-num">${fmtEnt(t.g)}</td>${cells}${extra}
    </tr>`;
  }).join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderJugSeasons() {
  const el = document.getElementById('jug-seasons-table');
  if (el) el.innerHTML = jugSeasonTableHtml();
}

function setJugSeasonMode(m) {
  jugSeasonMode = m;
  ['pg', 'tot'].forEach(x => {
    const btn = document.getElementById('jug-seas-' + x);
    if (btn) { btn.classList.toggle('active', x === m); btn.setAttribute('aria-pressed', String(x === m)); }
  });
  renderJugSeasons();
}

function jugTemporadas(j) {
  const s = (j.temporadas_data || []).filter(x => x.year);
  if (!s.length) return '';
  jugSeasonJ = j; jugSeasonMode = 'pg';
  return jugSection('Temporada a temporada',
    `<div class="mode-switch jug-seas-switch" role="group" aria-label="Por partido o totales">
       <button type="button" id="jug-seas-pg" class="toggle-chip active" aria-pressed="true" onclick="setJugSeasonMode('pg')">Por partido</button>
       <button type="button" id="jug-seas-tot" class="toggle-chip" aria-pressed="false" onclick="setJugSeasonMode('tot')">Totales</button>
     </div>
     <div class="tabla-scroll" id="jug-seasons-table">${jugSeasonTableHtml()}</div>`);
}

let jugPoJ = null, jugPoMode = 'pg';
function jugPoSeasonTableHtml() { return seasonRowsHtml((jugPoJ.playoffs_temporadas || []), jugPoMode); }
function renderJugPo() { const el = document.getElementById('jug-po-table'); if (el) el.innerHTML = jugPoSeasonTableHtml(); }
function setJugPoMode(m) {
  jugPoMode = m;
  ['pg', 'tot'].forEach(x => {
    const btn = document.getElementById('jug-po-' + x);
    if (btn) { btn.classList.toggle('active', x === m); btn.setAttribute('aria-pressed', String(x === m)); }
  });
  renderJugPo();
}

function jugPlayoffs(j) {
  const pt = j.playoffs_totales;
  const seasons = (j.playoffs_temporadas || []).filter(x => x && (x.year || x.g));
  if (!(pt && pt.partidos > 0) && !seasons.length) return '';
  let html = '';

  // Estadísticas de carrera en playoffs (por partido + totales), igual que la sección regular
  if (pt && pt.partidos > 0) {
    const gp = pt.partidos || 0;
    const perg = (total) => gp ? total / gp : null;
    const pg = [
      statBox('GP', fmtEnt(pt.partidos)), statBox('MIN', fmtDec1(pt.min_g)), statBox('PTS', fmtDec1(pt.pts_g)),
      statBox('REB', fmtDec1(pt.rbd_g)), statBox('AST', fmtDec1(pt.ast_g)), statBox('ROB', fmtDec1(pt.stl_g)),
      statBox('TAP', fmtDec1(pt.blk_g)), statBox('3PM', fmtDec1(pt.tres_g)),
      statBox('TOV', fmtDec1(perg(pt.tov_total))), statBox('PF', fmtDec1(perg(pt.pf_total))),
      statBox('FG%', fmtPct(pt.fg_pct)), statBox('3P%', fmtPct(pt.tres_pct)), statBox('FT%', fmtPct(pt.ft_pct)),
    ].join('');
    const tot = [
      statBox('GP', fmtEnt(pt.partidos)), statBox('MIN', fmtEnt(pt.min_total)), statBox('PTS', fmtEnt(pt.pts_total)),
      statBox('REB', fmtEnt(pt.rbd_total)), statBox('AST', fmtEnt(pt.ast_total)), statBox('ROB', fmtEnt(pt.stl_total)),
      statBox('TAP', fmtEnt(pt.blk_total)), statBox('3PM', fmtEnt(pt.tres_total)),
      statBox('TOV', fmtEnt(pt.tov_total)), statBox('PF', fmtEnt(pt.pf_total)), statBox('TD', fmtEnt(pt.td_total)),
    ].join('');
    html += `<h3 class="jug-subh">Por partido</h3><div class="stat-grid">${pg}</div>
             <h3 class="jug-subh">Totales</h3><div class="stat-grid">${tot}</div>`;
  }

  // Playoffs temporada a temporada, con toggle Por partido / Totales
  if (seasons.length) {
    jugPoJ = j; jugPoMode = 'pg';
    html += `<h3 class="jug-subh">Temporada a temporada</h3>
      <div class="mode-switch jug-seas-switch" role="group" aria-label="Por partido o totales">
        <button type="button" id="jug-po-pg" class="toggle-chip active" aria-pressed="true" onclick="setJugPoMode('pg')">Por partido</button>
        <button type="button" id="jug-po-tot" class="toggle-chip" aria-pressed="false" onclick="setJugPoMode('tot')">Totales</button>
      </div>
      <div class="tabla-scroll" id="jug-po-table">${jugPoSeasonTableHtml()}</div>`;
  }
  return jugSection('Playoffs', html);
}

function jugPremios(j) {
  const rings = TL_ANILLOS[drNorm(j.nombre)] || {};
  const champs = Object.keys(rings).map(y => ({ tipo: 'Campeón NBA', year: +y, team: rings[y], notas: 'Anillo NBA' }));
  const p = [...champs, ...(j.premios || [])];
  if (!p.length) return '';
  const items = [...p].sort((a, b) => (b.year || 0) - (a.year || 0)).map(a => {
    const hito = a.tipo === 'ROY' || a.tipo === 'DPOY' || /campe/i.test(a.tipo);
    return `<li class="jug-award">
      <span class="jug-award-tipo${hito ? ' jug-award-hito' : ''}">${escapeHtml(a.tipo)}</span>
      <span class="td-muted">${escapeHtml([a.year, a.team, a.notas].filter(Boolean).join(' · '))}</span>
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
    return `<li class="jug-dorsal"><span class="jug-jersey">${jerseySvg(num)}</span><div class="dp-teams">${stints}</div></li>`;
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
  const rows = [...trans].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || ''))).map(t => `<tr class="tr-row" tabindex="0" role="button" aria-label="Ver detalle de la transacción"
      onclick="openTrDrawer('${t._id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTrDrawer('${t._id}');}">
    <td class="td-center td-muted">${trFechaDisplay(t.fecha)}</td>
    <td><span class="tr-tipo ${trTipoClass(t.tipo)}">${escapeHtml(t.tipo)}</span></td>
    <td class="td-center">${trTeamCell(t.equipo1)}</td><td class="td-center">${trTeamCell(t.equipo2)}</td>
    <td class="td-chevron" aria-hidden="true">›</td>
  </tr>`).join('');
  return jugSection('Transacciones',
    `<div class="tabla-scroll"><table><thead><tr><th class="td-center">Fecha</th><th>Tipo</th><th class="td-center">Equipo</th><th class="td-center">Equipo 2</th><th class="td-chevron"></th></tr></thead><tbody>${rows}</tbody></table></div>`);
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

// 4 jugadores con cifras PARECIDAS en una estadística (ventana consecutiva al ordenar)
function qCloseFour(pool, k, n = 4) {
  const val = j => (typeof k === 'function' ? k(j) : j[k]) || 0;
  const arr = pool.filter(j => val(j) > 0).sort((a, b) => val(a) - val(b));
  if (arr.length < n) return null;
  const start = Math.floor(Math.random() * (arr.length - n + 1));
  const win = arr.slice(start, start + n);
  if (val(win[n - 1]) === val(win[n - 2])) return null;   // máximo ambiguo → descarta
  return win;
}
function qDebutYear(j) { const m = String((j.primer_partido && j.primer_partido.fecha) || '').match(/(\d{4})/); return m ? +m[1] : null; }
function qNumTeams(j) { return (j.equipos_nba || '').split(/[,/]/).map(s => s.trim()).filter(Boolean).length; }
// Partidos de temporada regular por equipo: { EQUIPO: { jugador: partidos } }
function qBuildByTeam(J) {
  const bt = {};
  J.forEach(j => (j.temporadas_data || []).forEach(t => {
    const tm = (t.team || '').toUpperCase();
    if (!tm || tm === 'TOT') return;
    (bt[tm] = bt[tm] || {})[j.nombre] = (bt[tm][j.nombre] || 0) + (t.g || 0);
  }));
  return bt;
}

// «¿Quién tiene más…?» — se eligen 4 jugadores con cifras parecidas para que no sea obvio
const QSTAT = [
  ['pts_g', '¿Quién promedió más <b>puntos por partido</b> en su carrera?'],
  ['rbd_g', '¿Quién promedió más <b>rebotes por partido</b>?'],
  ['ast_g', '¿Quién promedió más <b>asistencias por partido</b>?'],
  ['min_g', '¿Quién promedió más <b>minutos por partido</b>?'],
  ['pts_total', '¿Quién ha anotado más <b>puntos totales</b> en la NBA?'],
  ['rbd_total', '¿Quién ha capturado más <b>rebotes totales</b>?'],
  ['ast_total', '¿Quién ha dado más <b>asistencias totales</b>?'],
  ['stl_total', '¿Quién ha sumado más <b>robos totales</b>?'],
  ['blk_total', '¿Quién ha puesto más <b>tapones totales</b>?'],
  ['tres_total', '¿Quién ha anotado más <b>triples</b> (total)?'],
  ['min_total', '¿Quién ha jugado más <b>minutos totales</b>?'],
  ['partidos', '¿Quién ha disputado más <b>partidos</b>?'],
  ['td_total', '¿Quién ha firmado más <b>triples-dobles</b>?'],
  ['ganancias', '¿Quién ha <b>ganado más dinero</b> en la NBA?'],
  ['_seasons', '¿Quién ha disputado <b>más temporadas</b>?'],
];
// Récords en un solo partido (game highs)
const QREC = [
  ['pts', '¿Quién tiene el <b>récord de puntos</b> en un partido?', '¿Quién anotó más <b>puntos</b> en un partido, de estos jugadores?'],
  ['rbd', '¿Quién tiene el <b>récord de rebotes</b> en un partido?', '¿Quién capturó más <b>rebotes</b> en un partido, de estos jugadores?'],
  ['ast', '¿Quién tiene el <b>récord de asistencias</b> en un partido?', '¿Quién dio más <b>asistencias</b> en un partido, de estos jugadores?'],
];
// Porcentajes de tiro de carrera (mín. 200 partidos, cifras parecidas)
const QPCT = [
  ['fg_pct', '¿Quién tiene mejor <b>tiro de campo (FG%)</b> de carrera?'],
  ['ft_pct', '¿Quién tiene mejor <b>tiro libre (FT%)</b> de carrera?'],
  ['tres_pct', '¿Quién tiene mejor <b>triple (3P%)</b> de carrera?'],
];

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
  // Estadísticas «quién más» con 4 jugadores de cifras parecidas
  ...QSTAT.map(([key, q]) => D => {
    const four = qCloseFour(D.stat, key);
    if (!four) return null;
    return { q, correct: four[four.length - 1].nombre, options: qShuffle(four.map(x => x.nombre)) };
  }),
  // Récords en un partido: solo se dice «récord» si el correcto tiene de verdad el career-high más alto;
  // si no, se pregunta «¿quién… de estos jugadores?» para no dar por récord a quien no lo es.
  ...QREC.map(([key, qRec, qEntre]) => D => {
    const val = j => (j.game_highs[key]) || 0;
    const four = qCloseFour(D.highs, val);
    if (!four) return null;
    const winner = four[four.length - 1];
    const globalMax = Math.max(...D.highs.map(val));
    const esRecord = val(winner) === globalMax;
    return { q: esRecord ? qRec : qEntre, correct: winner.nombre, options: qShuffle(four.map(x => x.nombre)) };
  }),
  // Porcentajes de carrera
  ...QPCT.map(([key, q]) => D => {
    const four = qCloseFour(D.stat.filter(j => (j.partidos || 0) >= 200), key);
    if (!four) return null;
    return { q, correct: four[four.length - 1].nombre, options: qShuffle(four.map(x => x.nombre)) };
  }),
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
  D => { // cuántos anillos
    if (!D.champs.length) return null;
    const c = qPick(D.champs);
    return { q: `¿Cuántos <b>anillos NBA</b> ganó ${c.nombre}?`, correct: String(c.rings), options: qOptions(String(c.rings), ['1', '2', '3', '4']) };
  },
  D => { // qué español NO ganó anillo
    if (D.champs.length < 3) return null;
    const noRing = D.stat.filter(j => !D.champs.some(c => c.nombre === j.nombre));
    if (!noRing.length) return null;
    const u = qPick(noRing); const three = qSample(D.champs, 3).map(x => x.nombre);
    return { q: '¿Cuál de estos jugadores <b>NO ganó el anillo</b> de la NBA?', correct: u.nombre, options: qShuffle([u.nombre, ...three]) };
  },
  D => { // cuál NO fue drafteado
    const und = D.J.filter(j => !j.draft && (j.partidos || 0) > 0); if (und.length < 1 || D.drafted.length < 3) return null;
    const u = qPick(und); const three = qSample(D.drafted, 3).map(x => x.nombre);
    return { q: '¿Cuál de estos jugadores <b>NO fue drafteado</b>?', correct: u.nombre, options: qShuffle([u.nombre, ...three]) };
  },
  D => { // contra qué equipo debutó
    const pool = D.J.filter(j => j.primer_partido && j.primer_partido.rival);
    const rivals = [...new Set(pool.map(x => x.primer_partido.rival))];
    if (pool.length < 4 || rivals.length < 4) return null;
    const j = qPick(pool);
    return { q: `¿Contra qué equipo <b>debutó ${j.nombre}</b> en la NBA?`, correct: j.primer_partido.rival, options: qOptions(j.primer_partido.rival, rivals) };
  },
  D => { // con qué equipo debutó
    const pool = D.J.filter(j => j.primer_partido && j.primer_partido.equipo);
    const teams = [...new Set(pool.map(x => x.primer_partido.equipo))];
    if (pool.length < 4 || teams.length < 4) return null;
    const j = qPick(pool);
    return { q: `¿Con qué equipo <b>debutó ${j.nombre}</b> en la NBA?`, correct: j.primer_partido.equipo, options: qOptions(j.primer_partido.equipo, teams) };
  },
  D => { // año de debut
    const pool = D.J.filter(j => qDebutYear(j)); const years = [...new Set(pool.map(qDebutYear))];
    if (pool.length < 4 || years.length < 4) return null;
    const j = qPick(pool);
    return { q: `¿En qué año <b>debutó ${j.nombre}</b> en la NBA?`, correct: qDebutYear(j), options: qOptions(qDebutYear(j), years) };
  },
  D => { // puntos en el debut
    const pool = D.J.filter(j => j.primer_partido && j.primer_partido.pts != null);
    const nums = [...new Set(pool.map(x => String(x.primer_partido.pts)))];
    if (pool.length < 4 || nums.length < 4) return null;
    const j = qPick(pool);
    return { q: `¿Cuántos <b>puntos anotó ${j.nombre}</b> en su debut NBA?`, correct: String(j.primer_partido.pts), options: qOptions(String(j.primer_partido.pts), nums) };
  },
  D => { // quién debutó antes
    const pool = D.J.filter(j => qDebutYear(j)); if (pool.length < 4) return null;
    const four = qSample(pool, 4);
    const win = four.reduce((a, b) => qDebutYear(b) < qDebutYear(a) ? b : a);
    if (four.filter(x => qDebutYear(x) === qDebutYear(win)).length > 1) return null;   // empate → descarta
    return { q: '¿Cuál de estos jugadores <b>debutó antes</b> en la NBA?', correct: win.nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
  D => { // con cuántos equipos NBA jugó
    const pool = D.stat.filter(j => qNumTeams(j) > 0); if (pool.length < 4) return null;
    const j = qPick(pool); const n = qNumTeams(j);
    return { q: `¿Con cuántos <b>equipos NBA</b> jugó ${j.nombre}?`, correct: String(n), options: qOptions(String(n), ['1', '2', '3', '4', '5', '6']) };
  },
  D => { // con qué equipo firmó en X año
    const firmas = D.trans.filter(t => /agente libre|firma contrato rookie|renovaci/i.test(t.tipo) && t.equipo1 && /\d{4}/.test(t.fecha || ''));
    const teams = [...new Set(D.trans.map(t => t.equipo1).filter(Boolean))];
    if (firmas.length < 4 || teams.length < 4) return null;
    const t = qPick(firmas); const year = String(t.fecha).match(/(\d{4})/)[1];
    return { q: `¿Con qué equipo <b>firmó ${t.jugador}</b> en ${year}?`, correct: t.equipo1, options: qOptions(t.equipo1, teams) };
  },
  D => { // a qué equipo fue traspasado en X mes/año (con mes, porque hay varios trades el mismo año)
    const trades = D.trans.filter(t => /traspas/i.test(t.tipo) && t.equipo2 && /^\d{4}-\d{2}/.test(t.fecha || ''));
    const teams = [...new Set(D.trans.map(t => t.equipo2).filter(Boolean))];
    if (trades.length < 4 || teams.length < 4) return null;
    const t = qPick(trades); const m = String(t.fecha).match(/^(\d{4})-(\d{2})/);
    const mes = MESES_LARGOS[parseInt(m[2]) - 1]; if (!mes) return null;   // fecha con mes inválido → descarta
    const cuando = `${mes} de ${m[1]}`;
    return { q: `¿A qué equipo fue <b>traspasado ${t.jugador}</b> en ${cuando}?`, correct: t.equipo2, options: qOptions(t.equipo2, teams) };
  },
  D => { // equipo con el que jugó la Summer League
    const teams = [...new Set(D.sl.map(x => x.equipo))];
    if (D.sl.length < 4 || teams.length < 4) return null;
    const s = qPick(D.sl);
    return { q: `¿Con qué equipo disputó <b>${s.jugador}</b> la Summer League${s.year ? ` de ${s.year}` : ''}?`, correct: s.equipo, options: qOptions(s.equipo, teams) };
  },
  D => { // franquicia con más partidos de españoles (total)
    const tot = Object.entries(D.byTeam).map(([tm, v]) => [tm, Object.values(v).reduce((s, n) => s + n, 0)]).sort((a, b) => b[1] - a[1]);
    if (tot.length < 4 || tot.filter(x => x[1] === tot[0][1]).length > 1) return null;
    const correct = teamInfo(tot[0][0]).name;
    return { q: '¿En qué equipo han jugado <b>más partidos</b> los españoles (en total)?', correct, options: qOptions(correct, tot.slice(1).map(([tm]) => teamInfo(tm).name)) };
  },
  D => { // quién ha jugado más partidos con X equipo
    const cands = Object.entries(D.byTeam).filter(([, v]) => Object.keys(v).length >= 3);
    if (!cands.length) return null;
    const [tm, v] = qPick(cands);
    const four = qSample(Object.entries(v), Math.min(4, Object.keys(v).length));   // [nombre, partidos]
    const win = four.reduce((a, b) => b[1] > a[1] ? b : a);
    if (four.filter(x => x[1] === win[1]).length > 1) return null;   // empate → descarta
    return { q: `¿Quién ha jugado <b>más partidos</b> con ${teamInfo(tm).name}?`, correct: win[0], options: qShuffle(four.map(x => x[0])) };
  },
  D => { // único español que ha jugado en X franquicia
    const solo = Object.entries(D.byTeam).filter(([, v]) => Object.keys(v).length === 1);
    if (!solo.length || D.J.length < 4) return null;
    const [tm, v] = qPick(solo);
    const correct = Object.keys(v)[0];
    return { q: `¿Cuál es el <b>único español</b> que ha jugado en ${teamInfo(tm).name}?`, correct, options: qOptions(correct, D.J.map(j => j.nombre).filter(n => n !== correct)) };
  },
  D => { // ¿de qué comunidad autónoma es?
    const pool = D.J.filter(j => { const ca = AG_COMUNIDAD[drNorm(j.nombre)]; return ca && ca !== 'Fuera de España' && ca !== 'Otros'; });
    const cas = [...new Set(Object.values(AG_COMUNIDAD).filter(c => c !== 'Fuera de España' && c !== 'Otros'))];
    if (pool.length < 4 || cas.length < 4) return null;
    const j = qPick(pool); const correct = AG_COMUNIDAD[drNorm(j.nombre)];
    return { q: `¿De qué <b>comunidad autónoma</b> es ${j.nombre}?`, correct, options: qOptions(correct, cas.filter(c => c !== correct)) };
  },
  D => { // ¿dónde nació? (ciudad de origen)
    const org = j => (BIO[drNorm(j.nombre)] || {}).origen;
    const pool = D.J.filter(org); const origenes = [...new Set(pool.map(org))];
    if (pool.length < 4 || origenes.length < 4) return null;
    const j = qPick(pool); const correct = org(j);
    return { q: `¿Dónde <b>nació ${j.nombre}</b>?`, correct, options: qOptions(correct, origenes.filter(o => o !== correct)) };
  },
  D => { // año de nacimiento
    const yr = j => { const m = String(j.nacimiento_fecha || j.nacimiento || '').match(/(\d{4})/); return m ? m[1] : null; };
    const pool = D.J.filter(yr); const years = [...new Set(pool.map(yr))];
    if (pool.length < 4 || years.length < 4) return null;
    const j = qPick(pool); const correct = yr(j);
    return { q: `¿En qué <b>año nació ${j.nombre}</b>?`, correct, options: qOptions(correct, years.filter(y => y !== correct)) };
  },
  D => { // quién es el más veterano (nació antes)
    const yr = j => { const m = String(j.nacimiento_fecha || j.nacimiento || '').match(/(\d{4})/); return m ? +m[1] : null; };
    const pool = D.J.filter(yr); if (pool.length < 4) return null;
    const four = qSample(pool, 4);
    const win = four.reduce((a, b) => yr(b) < yr(a) ? b : a);
    if (four.filter(x => yr(x) === yr(win)).length > 1) return null;   // empate → descarta
    return { q: '¿Cuál de estos jugadores es el <b>más veterano</b> (nació antes)?', correct: win.nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
  D => { // quién es más alto
    const h = j => { const b = BIO[drNorm(j.nombre)]; const m = b && b.altura && b.altura.match(/(\d)[,.](\d{2})/); return m ? +(m[1] + '.' + m[2]) : null; };
    const pool = D.J.filter(h); if (pool.length < 4) return null;
    const four = qSample(pool, 4);
    const win = four.reduce((a, b) => h(b) > h(a) ? b : a);
    if (four.filter(x => h(x) === h(win)).length > 1) return null;   // empate → descarta
    return { q: '¿Cuál de estos jugadores es el <b>más alto</b>?', correct: win.nombre, options: qShuffle(four.map(x => x.nombre)) };
  },
];

function quizBuildData(data) {
  const J = data.jugadores || [];
  J.forEach(j => { j._seasons = new Set((j.temporadas_data || []).map(t => t.year).filter(Boolean)).size; });
  return {
    J,
    drafted: J.filter(j => j.draft && j.draft_anio),
    stat: J.filter(j => (j.partidos || 0) > 0),
    highs: J.filter(j => j.game_highs && j.game_highs.pts),
    champs: J.map(j => ({ nombre: j.nombre, rings: Object.keys(TL_ANILLOS[drNorm(j.nombre)] || {}).length }))
             .filter(x => x.rings > 0),
    dorsales: (data.dorsales || []).filter(d => d.numero != null),
    premios: J.flatMap(j => (j.premios || []).map(p => ({ ...p, jugador: j.nombre }))),
    sl: (data.summer_league || []).filter(s => s.equipo && s.jugador),
    trans: (data.transacciones || []),
    byTeam: qBuildByTeam(J),
  };
}

let quizMode = 'reto';
async function initTestPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('quiz-q').textContent = 'Error al cargar los datos'; return; }
  quizData = quizBuildData(data);
  const params = new URLSearchParams(location.search);
  setQuizMode(params.get('modo') === 'libre' ? 'free' : 'reto');
}

function setQuizMode(m) {
  quizMode = m;
  ['reto', 'free'].forEach(x => {
    const btn = document.getElementById('qmode-' + x);
    if (btn) { btn.classList.toggle('active', x === m); btn.setAttribute('aria-pressed', String(x === m)); }
  });
  const scoreEl = document.querySelector('.quiz-score');
  const nb = document.getElementById('quiz-next');
  if (m === 'free') {
    if (scoreEl) scoreEl.style.display = '';
    const pr = document.getElementById('reto-progress'); if (pr) pr.hidden = true;
    quizScore = 0; quizTotal = 0; quizStreak = 0;
    document.getElementById('quiz-score').textContent = '0 / 0';
    document.getElementById('quiz-streak').textContent = '';
    if (nb) { nb.onclick = quizNext; nb.textContent = 'Siguiente →'; }
    quizNext();
  } else {
    if (scoreEl) scoreEl.style.display = 'none';
    retoStart();
  }
}

// ══════════════════════════════════════════════
// RETO DEL DÍA — mismas preguntas para todos cada día (semilla = fecha)
// ══════════════════════════════════════════════
const RETO_N = 5;
let retoQs = [], retoIdx = 0, retoResults = [], retoAnswered = false;

function retoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function retoDate(long) {   // etiqueta de fecha del reto de hoy
  const d = new Date(), dd = d.getDate(), mm = d.getMonth(), yy = d.getFullYear();
  return long ? `${dd} de ${MESES_LARGOS[mm]} de ${yy}` : `${dd} ${MESES[mm]} ${yy}`;
}
function retoMulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function retoSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Genera las preguntas del día de forma determinista (sustituye Math.random por
// un PRNG sembrado con la fecha mientras se generan, y lo restaura después).
function retoGenerate() {
  const rnd = retoMulberry32(retoSeed(retoToday()));
  const orig = Math.random; Math.random = rnd;
  const qs = [], stems = new Set(); let guard = 0;
  try {
    while (qs.length < RETO_N && guard < 500) {
      guard++;
      const gen = QUIZ_GENS[Math.floor(rnd() * QUIZ_GENS.length)];
      const q = gen(quizData);
      if (!q) continue;
      const stem = q.q.replace(/<[^>]+>/g, '');
      if (stems.has(stem)) continue;   // sin preguntas repetidas en el mismo reto
      stems.add(stem); qs.push(q);
    }
  } finally { Math.random = orig; }
  return qs;
}
function retoKey() { return 'ag-reto-' + retoToday(); }

function retoStart() {
  retoQs = retoGenerate();
  if (!retoQs.length) { document.getElementById('quiz-q').textContent = 'No hay datos suficientes para el reto de hoy.'; return; }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(retoKey()) || 'null'); } catch (e) { }
  if (saved && Array.isArray(saved.results) && saved.results.length === retoQs.length) {
    retoResults = saved.results; retoShowResult(true);
    return;
  }
  retoIdx = 0; retoResults = []; retoAnswered = false;
  retoRenderQ();
}

function retoRenderQ() {
  const q = retoQs[retoIdx];
  retoAnswered = false;
  document.getElementById('quiz-next').hidden = true;
  const fb = document.getElementById('quiz-feedback'); fb.textContent = ''; fb.className = 'quiz-feedback';
  document.getElementById('quiz-q').innerHTML = `<span class="reto-qnum">Reto del día · ${retoDate(false)} · Pregunta ${retoIdx + 1}/${RETO_N}</span>${q.q}`;
  document.getElementById('quiz-options').innerHTML = q.options.map((o, i) => `<button class="quiz-opt" onclick="retoAnswer(${i})">${o}</button>`).join('');
  retoRenderProgress();
}
function retoRenderProgress() {
  const pr = document.getElementById('reto-progress'); if (!pr) return;
  pr.hidden = false;
  pr.innerHTML = retoQs.map((_, i) => {
    let cls = 'reto-dot';
    if (i < retoResults.length) cls += retoResults[i] ? ' ok' : ' ko';
    else if (i === retoIdx) cls += ' cur';
    return `<span class="${cls}"></span>`;
  }).join('');
}
function retoAnswer(i) {
  if (retoAnswered) return;
  retoAnswered = true;
  const q = retoQs[retoIdx];
  const ok = String(q.options[i]) === String(q.correct);
  retoResults.push(ok);
  [...document.querySelectorAll('.quiz-opt')].forEach((b, k) => {
    b.disabled = true;
    if (String(q.options[k]) === String(q.correct)) b.classList.add('quiz-ok');
    else if (k === i) b.classList.add('quiz-ko');
  });
  const fb = document.getElementById('quiz-feedback');
  fb.innerHTML = ok ? '¡Correcto!' : `Respuesta: <b>${q.correct}</b>`;
  fb.className = 'quiz-feedback ' + (ok ? 'fb-ok' : 'fb-ko');
  retoRenderProgress();
  const nb = document.getElementById('quiz-next');
  nb.hidden = false;
  nb.textContent = retoIdx + 1 < RETO_N ? 'Siguiente →' : 'Ver resultado →';
  nb.onclick = retoNext;
}
function retoNext() {
  if (retoIdx + 1 < RETO_N) { retoIdx++; retoRenderQ(); }
  else {
    try { localStorage.setItem(retoKey(), JSON.stringify({ results: retoResults })); } catch (e) { }
    track('reto_completado', { aciertos: retoResults.filter(Boolean).length, total: RETO_N });
    retoShowResult(false);
  }
}
function retoShowResult(already) {
  const score = retoResults.filter(Boolean).length;
  const grid = retoResults.map(r => r ? '🟩' : '🟥').join('');
  document.getElementById('quiz-options').innerHTML = '';
  document.getElementById('quiz-next').hidden = true;
  document.getElementById('quiz-feedback').textContent = '';
  const pr = document.getElementById('reto-progress'); if (pr) pr.hidden = true;
  const msg = score === RETO_N ? '¡Pleno! 🏆' : score >= 3 ? '¡Bien jugado! 👏' : 'Mañana hay revancha 💪';
  const xico = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  document.getElementById('quiz-q').innerHTML = `<div class="reto-result">
    <div class="reto-result-score">${score}<span>/${RETO_N}</span></div>
    <div class="reto-result-grid">${grid}</div>
    <div class="reto-result-msg">${msg}</div>
    <p class="reto-result-sub">${retoDate(true)}${already ? ' · Ya lo jugaste hoy' : ''} · Vuelve mañana para uno nuevo.</p>
    <div class="reto-result-actions">
      <button type="button" class="efm-share-btn reto-share-btn" onclick="retoShare()"><span class="efm-share-ico">${xico}</span> Compartir resultado</button>
      <button type="button" class="reto-free-link" onclick="setQuizMode('free')">Seguir con práctica libre →</button>
    </div>
  </div>`;
}
// Imagen-resultado del reto del día (cuadros de color según los aciertos)
async function retoBuildImage(results) {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { }
  const score = results.filter(Boolean).length, N = results.length;
  const W = 1080, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const CO = { bg: '#0e0e10', text: '#e9e9ec', muted: '#9a9aa5', yellow: '#ffc400', red: '#c60b1e', green: '#22c55e', ko: '#e23b3b', coral: '#f2545b' };
  x.fillStyle = CO.bg; x.fillRect(0, 0, W, H);
  const flag = y => { x.fillStyle = CO.red; x.fillRect(0, y, W, 12); x.fillStyle = CO.yellow; x.fillRect(W * 0.30, y, W * 0.40, 12); x.fillStyle = CO.red; x.fillRect(W * 0.70, y, W * 0.30, 12); };
  flag(0); flag(H - 12);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillStyle = CO.yellow; x.font = '700 26px Inter, sans-serif'; x.save(); x.letterSpacing = '6px'; x.fillText('ESPAÑOLES EN LA NBA', W / 2, 98); x.restore();
  x.fillStyle = CO.text; x.font = "italic 700 76px 'DM Serif Display', serif"; x.fillText('Reto del día', W / 2, 206);
  x.fillStyle = CO.muted; x.font = '600 30px Inter, sans-serif'; x.save(); x.letterSpacing = '1px'; x.fillText(retoDate(true), W / 2, 256); x.restore();
  const pleno = score === N;
  x.fillStyle = pleno ? CO.yellow : CO.coral; x.font = "400 250px 'Bebas Neue', sans-serif";
  x.fillText(`${score}/${N}`, W / 2, 560);
  // Cuadros de aciertos/fallos
  const sq = 108, gap = 24, totalW = N * sq + (N - 1) * gap, sx = (W - totalW) / 2, sy = 636;
  results.forEach((r, i) => {
    const px = sx + i * (sq + gap);
    x.fillStyle = r ? CO.green : CO.ko;
    x.beginPath(); x.roundRect(px, sy, sq, sq, 18); x.fill();
  });
  const msg = pleno ? '¡Pleno! Lo clavaste 🏆' : score >= 3 ? '¡Bien jugado! 👏' : 'Mañana hay revancha 💪';
  x.fillStyle = CO.text; x.font = '700 44px Inter, sans-serif'; x.fillText(msg, W / 2, 858);
  x.fillStyle = CO.muted; x.font = '500 30px Inter, sans-serif'; x.fillText('¿Cuántas aciertas tú?', W / 2, 912);
  x.textAlign = 'left'; x.fillStyle = CO.text; x.font = '700 24px Inter, sans-serif'; x.fillText('espanoles-nba.alejandroggo.com', 60, H - 46);
  x.textAlign = 'right'; x.fillStyle = CO.yellow; x.font = '700 24px Inter, sans-serif'; x.fillText('@alejandroggo · #EspañolesNBA', W - 60, H - 46);
  x.textAlign = 'center';
  return c;
}
function retoDescargaImagen(bl) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'reto-diario-espanoles-nba.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function retoShare() {
  const score = retoResults.filter(Boolean).length;
  track('compartir', { metodo: 'twitter', origen: 'reto', aciertos: score });
  const grid = retoResults.map(r => r ? '🟩' : '🟥').join('');
  const texto = `Reto del día · ${retoDate(false)}\n${score}/${RETO_N} ${grid}\n\n¿Cuántas aciertas tú? #EspañolesNBA (vía @alejandroggo)`;
  const url = 'https://espanoles-nba.alejandroggo.com/test.html';
  const xIntent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(texto + '\n\n' + url);
  const isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  // Escritorio: abrir X dentro del gesto + descargar la imagen aparte.
  if (!isTouch) {
    window.open(xIntent, '_blank', 'noopener,noreferrer');
    try { const c = await retoBuildImage(retoResults); retoDescargaImagen(await qntBlob(c)); } catch (e) { }
    return;
  }
  // Móvil: menú nativo con la imagen adjunta.
  try {
    const c = await retoBuildImage(retoResults); const bl = await qntBlob(c);
    const file = new File([bl], 'reto-diario-espanoles-nba.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto + '\n\n' + url }); return; }
    retoDescargaImagen(bl);
  } catch (e) { if (e && e.name === 'AbortError') return; }
  window.open(xIntent, '_blank', 'noopener,noreferrer');
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
let highsMode = 'game';     // 'total' | 'pg' | 'game' — por defecto "En un partido" (lo más importante)
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
  const s = document.getElementById('hi-mode'); if (s) s.value = highsMode;
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
      return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (highsSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortHighs('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('highs-body').innerHTML = rows.map((r, i) => {
    const j = r.j;
    const cells = cols.map(c => {
      if (c.key === 'rank') return `<td class="td-rank td-muted">${i + 1}</td>`;
      if (c.key === 'foto') return `<td class="td-foto"><a class="pl-link" href="${jugadorHref(j.id)}">${(j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" class="player-thumb" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'player-thumb')}</a></td>`;
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
  renderOrigenes(debutRows, 'debut-origenes', `Los ${debutRows.length} españoles que han debutado en la NBA, por comunidad de nacimiento.`);
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
      return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (debutSortAsc ? ' asc' : '') : ''}"
        aria-sort="${ariaSort}" onclick="sortDebut('${c.key}')">${c.label}</th>`;
    }).join('')}
  </tr>`;

  document.getElementById('debut-body').innerHTML = rows.map((r, i) => `
    <tr>
      <td class="td-rank td-muted">${i + 1}</td>
      <td class="td-foto"><a class="pl-link" href="${jugadorHref(r.id)}">${(r.id || r.foto_url || r.bref_id) ? `<img loading="lazy" class="player-thumb" ${agFotoSrc(r)} onerror="agImgHide(this)" alt="">` : avatarHtml(r.nombre, 'player-thumb')}</a></td>
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

// Comunidad autónoma de nacimiento por jugador (clave: nombre normalizado).
const AG_COMUNIDAD = {
  'pau gasol': 'Cataluña', 'marc gasol': 'Cataluña', 'juan carlos navarro': 'Cataluña', 'ricky rubio': 'Cataluña', 'raul lopez': 'Cataluña', 'jose a. montero': 'Cataluña', 'albert miralles': 'Cataluña',
  'willy hernangomez': 'Madrid', 'juancho hernangomez': 'Madrid', 'hugo gonzalez': 'Madrid', 'jorge garbajosa': 'Madrid', 'fernando martin': 'Madrid', 'roberto duenas': 'Madrid', 'dani diez': 'Madrid', 'juan nunez': 'Madrid',
  'rudy fernandez': 'Baleares', 'alex abrines': 'Baleares', 'baba miller': 'Baleares', 'sergio llull': 'Baleares',
  'santi aldama': 'Canarias', 'sergio rodriguez': 'Canarias',
  'jose m. calderon': 'Extremadura', 'victor claver': 'C. Valenciana', 'usman garuba': 'Castilla-La Mancha',
  'sergio de larrea': 'Castilla y León', 'aday mara': 'Aragón', 'fran vazquez': 'Galicia',
  'nikola mirotic': 'Fuera de España', 'serge ibaka': 'Fuera de España',
};
function renderOrigenes(jugadores, containerId, subtitle) {
  const el = document.getElementById(containerId || 'jug-origenes');
  if (!el) return;
  const groups = {};
  jugadores.forEach(j => { const ca = AG_COMUNIDAD[drNorm(j.nombre)] || 'Otros'; (groups[ca] = groups[ca] || []).push(j); });
  const entries = Object.entries(groups).sort((a, b) => {
    if (a[0] === 'Fuera de España') return 1;
    if (b[0] === 'Fuera de España') return -1;
    return b[1].length - a[1].length || a[0].localeCompare(b[0], 'es');
  });
  const card = ([ca, js]) => {
    const chips = js.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map(j => {
      const foto = (j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'orig-avatar');
      return `<a class="orig-chip" href="${jugadorHref(j.id)}"><span class="orig-thumb">${foto}</span><span class="orig-name">${nombreResp(j.nombre)}</span></a>`;
    }).join('');
    return `<div class="orig-card"><div class="orig-head"><span class="orig-region">${ca}</span><span class="orig-count">${js.length}</span></div><div class="orig-players">${chips}</div></div>`;
  };
  const sub = subtitle || `Los ${jugadores.length} españoles en la NBA por comunidad de nacimiento.`;
  el.innerHTML = `<h2 class="orig-title">¿De dónde son?</h2><p class="orig-sub">${sub}</p><div class="orig-grid">${entries.map(card).join('')}</div>`;
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
    const meta = jugMeta(j);
    return `<a class="jug-card" href="${jugadorHref(j.id)}">
      ${(j.id || j.foto_url || j.bref_id) ? `<span class="jug-card-photo"><img loading="lazy" ${agFotoSrc(j)} onerror="agImgRemove(this)" alt=""></span>` : avatarHtml(j.nombre, 'jug-card-photo')}
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
  SEA: { name: 'Seattle SuperSonics',    label: 'Seattle',       color: '#1a6b3c' },
  NJN: { name: 'New Jersey Nets',        label: 'New Jersey',    color: '#1a2a5e' },
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
  const has = j.id || j.foto_url || j.bref_id;
  return `<span class="tl-facewrap">${avatarHtml(j.nombre, 'tl-avatar')}${has ? `<img loading="lazy" class="tl-face" ${agFotoSrc(j)} onerror="agImgRemove(this)" alt="">` : ''}</span>`;
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
// Hover sobre una fila: marca esa fila y resalta en la cabecera los años que jugó.
function tlHoverRow(tr) {
  const t = document.getElementById('tl-table');
  if (!t) return;
  tr.classList.add('tl-rowhl');
  tr.querySelectorAll('td.tl-cell').forEach(td => {
    const a = +td.dataset.c0, b = +td.dataset.c1;
    for (let k = a; k <= b; k++) t.querySelectorAll(`.tl-year[data-idx="${k}"]`).forEach(el => el.classList.add('tl-yearhl'));
  });
}
function tlClearRow(tr) {
  if (tr) tr.classList.remove('tl-rowhl');
  const t = document.getElementById('tl-table');
  if (t) t.querySelectorAll('.tl-year.tl-yearhl').forEach(el => el.classList.remove('tl-yearhl'));
}
// Elegir una temporada: resalta a los que jugaron ese año y atenúa al resto (clic de nuevo = quitar)
function tlSelectYear(year) {
  tlSelYear = (tlSelYear === year) ? null : year;
  renderTimeline();
}

let tlPlayers = [];
let tlAxis = [];
let tlSortMode = 'debut';
let tlYearFrom = null;
let tlYearTo = null;
let tlSelYear = null;   // temporada elegida (clic en la cabecera de año) → resalta activos ese año

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

  // Clic en una fila → fijar/desfijar el resaltado de ese jugador (los enlaces siguen funcionando)
  body.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const row = e.target.closest('tr');
    if (row) row.classList.toggle('tl-focusrow');
  });

  // Clic en una fila → fija/quita el resaltado del jugador (sin robar el clic a su enlace)
  body.addEventListener('click', e => {
    if (e.target.closest('a, button')) return;
    const row = e.target.closest('tr[data-pid]');
    if (row && row.dataset.pid) row.classList.toggle('tl-focusrow');
  });

  // Resaltar la fila de un jugador si se llega con ?focus=<id>
  const focus = new URLSearchParams(location.search).get('focus');
  if (focus) requestAnimationFrame(() => tlFocusRow(focus));

  // Barra de scroll horizontal también arriba, sincronizada con la tabla
  const wrap = document.getElementById('tl-wrap'), top = document.getElementById('tl-topscroll');
  if (wrap && top) {
    let lock = false;
    wrap.addEventListener('scroll', () => { if (lock) return; lock = true; top.scrollLeft = wrap.scrollLeft; lock = false; });
    top.addEventListener('scroll', () => { if (lock) return; lock = true; wrap.scrollLeft = top.scrollLeft; lock = false; });
    window.addEventListener('resize', tlSyncTopScroll);
  }

  renderTimeline();
}

// Resalta y centra la fila de un jugador (llegada desde su ficha)
function tlFocusRow(id) {
  document.querySelectorAll('#tl-body tr.tl-focusrow').forEach(r => r.classList.remove('tl-focusrow'));
  const row = document.querySelector(`#tl-body tr[data-pid="${id}"]`);
  if (!row) return;
  row.classList.add('tl-focusrow');
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Iguala el ancho del scroll superior al de la tabla
function tlSyncTopScroll() {
  const wrap = document.getElementById('tl-wrap'), inner = document.getElementById('tl-topscroll-inner'), top = document.getElementById('tl-topscroll');
  const table = document.getElementById('tl-table');
  if (!wrap || !inner || !table || !top) return;
  inner.style.width = table.scrollWidth + 'px';
  top.style.display = table.scrollWidth > wrap.clientWidth ? 'block' : 'none';
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
    : `<th class="tl-year${c === tlSelYear ? ' tl-year-sel' : ''}" data-idx="${idx}" onmouseenter="tlHighlightCol(${idx})" onmouseleave="tlClearCol()" onclick="tlSelectYear(${c})" title="${drSeason(c)} · clic para resaltar quién jugó">${tlYY(c)}</th>`).join('');
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
        // Si el primer/último segmento continúa la barra vecina del mismo equipo, no repetimos
        // el código (la barra grande de al lado ya lo etiqueta); solo queda el color, que enlaza.
        const cL = connL(c), cR = connR(c);
        const segs = teams.map((tm, si) => {
          const info = teamInfo(tm);
          const cont = (si === 0 && cL) || (si === teams.length - 1 && cR);
          // En celdas de traspaso (2+ equipos en una temporada) no cabe el código: solo color (el tooltip lo dice).
          return `<span class="tl-seg${cont ? ' tl-seg-cont' : ''}" data-team="${tm}" style="background-color:${info.color};color:${info.text || '#fff'}" title="${info.name} · ${drSeason(c)}${p.rings[c] === tm ? ' · campeón' : ''}"></span>`;
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
    const dim = (tlSelYear != null && !p.seasons[tlSelYear]) ? ' tl-dim' : '';
    return `<tr data-pid="${p.j.id || ''}" class="${dim.trim()}" onmouseenter="tlHoverRow(this)" onmouseleave="tlClearRow(this)">
      <th scope="row" class="tl-name"><span class="tl-namewrap">${tlFace(p)}${p.j.id ? `<a class="pl-link tl-pname" href="${jugadorHref(p.j.id)}">${p.j.nombre}</a>` : `<span class="tl-pname">${p.j.nombre}</span>`}</span></th>
      <td class="tl-debut">${p._debut || tlDebutYear(p.j, p.first)}</td>
      ${cells.join('')}
      <td class="tl-seas">${tlFmtSeas(p.total)}</td>
    </tr>`;
  }).join('');

  // Fila de conteo (españoles activos por temporada)
  const footCells = axis.map((c, idx) => (typeof c === 'object')
    ? `<td class="tl-break" data-c0="${idx}" data-c1="${idx}"></td>`
    : `<td class="tl-count" data-c0="${idx}" data-c1="${idx}">${activeBy[c] || ''}</td>`).join('');
  const totalSeas = players.reduce((s, p) => s + p.total, 0);
  document.getElementById('tl-tfoot').innerHTML =
    `<tr><td class="tl-name-f">Españoles activos</td><td class="tl-debut"></td>${footCells}<td class="tl-seas tl-seas-total">${tlFmtSeas(totalSeas)}</td></tr>`;

  tlSyncTopScroll();
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
let cmpState = { a: { id: null, from: null, to: null }, b: { id: null, from: null, to: null }, c: { id: null, from: null, to: null } };

// Lados activos: A y B siempre; C solo si hay tercer jugador elegido
function cmpSides() {
  const c = document.getElementById('cmp-c');
  return (c && c.value) ? ['a', 'b', 'c'] : ['a', 'b'];
}
function cmpPlayers() { return cmpSides().map(s => cmpCur(s)).filter(Boolean); }

// Temporadas que TODOS los jugadores activos disputaron (para 'misma temporada')
function cmpCommon(players) {
  const list = players.filter(Boolean);
  if (!list.length) return [];
  return list.map(cmpSeasons).reduce((acc, ys) => { const s = new Set(ys); return acc.filter(y => s.has(y)); });
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
  return filter ? p.filter(filter).length : p.length;   // devuelve 0 (no null): las filas de premios se muestran siempre
}

// Lista de premios del jugador (incluye anillos), filtrada al periodo activo del lado
function cmpPremiosList(j, side) {
  const rings = TL_ANILLOS[drNorm(j.nombre)] || {};
  const champs = Object.keys(rings).map(y => ({ tipo: 'Campeón NBA', year: +y }));
  let list = [...champs, ...(j.premios || [])];
  if (cmpMode === 'same') list = list.filter(p => p.year === cmpSame);
  else if (cmpMode === 'diff') {
    const st = cmpState[side], lo = st.from, hi = st.to;
    if (lo || hi) list = list.filter(p => p.year && (!lo || p.year >= lo) && (!hi || p.year <= hi));
  }
  return list;
}
function cmpPoSeasons(j) { return (j.playoffs_temporadas || []).filter(t => t && (t.year || t.g)).length || null; }
function cmpPoGames(j) { return (j.playoffs_temporadas || []).reduce((s, t) => s + (t.g || 0), 0) || null; }

const CMP_SECTIONS = [
  { title: 'Trayectoria', career: true, rows: [
    { label: 'Temporadas',        get: j => cmpSeasons(j).length || j.temporadas || null, fmt: fmtEnt, dir: 'high' },
    { label: 'Partidos',          get: j => j.partidos ?? null, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Partidos titular',  get: j => j.partidos_titular ?? null, fmt: fmtEnt, dir: 'high', bar: true },
    { label: '% titular',         get: j => j.partidos ? (j.partidos_titular || 0) / j.partidos : null, fmt: fmtPct, dir: 'high', bar: true },
    { label: 'Equipos NBA',       get: j => cmpNTeams(j), fmt: fmtEnt, dir: 'high' },
    { label: 'Equipos',             get: j => j.equipos_nba ? j.equipos_nba.replace(/\s*,\s*/g, ' · ') : null, fmt: v => v, dir: 'neutral', cls: 'cmp-row-teams' },
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
  { title: 'Máximos en un partido', career: true, when: (a, b) => a.game_highs || b.game_highs, rows: [
    { label: 'Puntos',      get: j => j.game_highs && j.game_highs.pts, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Rebotes',     get: j => j.game_highs && j.game_highs.rbd, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Asistencias', get: j => j.game_highs && j.game_highs.ast, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Robos',       get: j => j.game_highs && j.game_highs.stl, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Tapones',     get: j => j.game_highs && j.game_highs.blk, fmt: fmtEnt, dir: 'high', bar: true },
  ]},
  { title: 'Premios', premios: true, rows: [
    { label: 'Anillos NBA',          get: j => cmpPremios(j, p => /campe/i.test(p.tipo)), fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'All-NBA',              get: j => cmpPremios(j, p => /all[\s-]?nba/i.test(p.tipo)), fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'All-Star',             get: j => cmpPremios(j, p => /all[\s-]?star/i.test(p.tipo) && !/concurso/i.test(p.tipo)), fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'All-Defense',          get: j => cmpPremios(j, p => /all[\s-]?defense/i.test(p.tipo)), fmt: fmtEnt, dir: 'high', bar: true },
    // Premios individuales mayores: MVP (votos), ROY y DPOY
    { label: 'Premios individuales', get: j => cmpPremios(j, p => /mvp|\broy\b|rookie of the year|\bdpoy\b/i.test(p.tipo)), fmt: fmtEnt, dir: 'high', bar: true },
    // Premios menores: All-Rookie, Jugador/Rookie del Mes, Rising Stars y concursos del All-Star
    { label: 'Premios menores',      get: j => cmpPremios(j, p => /all[\s-]?rookie|player of the month|rookie of the month|rising stars|concurso/i.test(p.tipo)), fmt: fmtEnt, dir: 'high', bar: true },
  ]},
  { title: 'Dinero', career: true, when: (a, b) => a.ganancias || b.ganancias, rows: [
    { label: 'Ganancias', get: j => j.ganancias || null, fmt: fmtDinero, dir: 'high', bar: true },
    { label: '$ por partido', get: j => (j.ganancias_ganado && j.partidos) ? j.ganancias_ganado / j.partidos : ((j.ganancias && j.partidos) ? j.ganancias / j.partidos : null), fmt: fmtDinero, dir: 'high', bar: true },
  ]},
  { title: 'Playoffs', career: true, when: (a, b) => cmpPoSeasons(a) || cmpPoSeasons(b) || a.playoffs_totales || b.playoffs_totales, rows: [
    { label: 'Temporadas de playoffs',  get: j => cmpPoSeasons(j), fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Partidos de playoffs',    get: j => (j.playoffs_totales && j.playoffs_totales.partidos) || cmpPoGames(j), fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Puntos por partido',      get: j => j.playoffs_totales && j.playoffs_totales.pts_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'Rebotes por partido',     get: j => j.playoffs_totales && j.playoffs_totales.rbd_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'Asistencias por partido', get: j => j.playoffs_totales && j.playoffs_totales.ast_g, fmt: fmtDec1, dir: 'high', bar: true },
    { label: 'FG%',                     get: j => j.playoffs_totales && j.playoffs_totales.fg_pct, fmt: fmtPct, dir: 'high', bar: true },
    { label: 'Puntos totales',          get: j => j.playoffs_totales && j.playoffs_totales.pts_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Rebotes totales',         get: j => j.playoffs_totales && j.playoffs_totales.rbd_total, fmt: fmtEnt, dir: 'high', bar: true },
    { label: 'Asistencias totales',     get: j => j.playoffs_totales && j.playoffs_totales.ast_total, fmt: fmtEnt, dir: 'high', bar: true },
  ]},
];

// Compara una fila entre N jugadores (2 o 3). Gana el mejor si es único.
// Dos jugadores: barras enfrentadas desde el centro; tres: una barra por columna.
// Cada barra lleva el color del jugador; la del ganador va llena y las demás atenuadas.
function cmpRow(row, datas) {
  const vals = datas.map(d => row.get(d));
  const nums = vals.map(v => (typeof v === 'number' ? v : null));
  let wins = datas.map(() => false);
  const present = nums.filter(n => n != null);
  if (row.dir !== 'neutral' && present.length >= 2) {
    const best = row.dir === 'low' ? Math.min(...present) : Math.max(...present);
    if (present.filter(n => n === best).length === 1) wins = nums.map(n => n === best);
  }
  const fmts = vals.map(v => (v == null ? '—' : row.fmt(v)));
  const mx = Math.max(...present.map(Math.abs), 0) || 1;
  const hasBar = !!row.bar && present.length >= 2;
  const anyWin = wins.some(Boolean);
  const pct = i => (nums[i] == null ? 0 : Math.max(2, Math.round(Math.abs(nums[i]) / mx * 100)));
  const valCls = i => `cmp-val${wins[i] ? ' win' : ''}${anyWin && !wins[i] ? ' lose' : ''}`;
  const sideOf = i => ['a', 'b', 'c'][i];
  const fill = i => `<span class="cmp-dfill p-${sideOf(i)}${wins[i] ? ' win' : ''}" style="width:${pct(i)}%"></span>`;
  const extraCls = (row.cls ? ' ' + row.cls : '') + (row.dir === 'neutral' ? ' cmp-row--info' : '') + (hasBar && !anyWin ? ' cmp-row--tie' : '');
  const metricLabel = row.dir === 'neutral'
    ? `${row.label}<span class="cmp-noscore">*</span>`
    : row.label;
  let html;
  if (datas.length === 2) {
    const bars = hasBar ? `<div class="cmp-dbar" aria-hidden="true"><span class="cmp-dhalf a">${fill(0)}</span><span class="cmp-dhalf b">${fill(1)}</span></div>` : '';
    html = `<div class="cmp-row${extraCls}">
      <div class="${valCls(0)} a">${fmts[0]}</div>
      <div class="cmp-mid"><div class="cmp-metric">${metricLabel}</div>${bars}</div>
      <div class="${valCls(1)} b">${fmts[1]}</div>
    </div>`;
  } else {
    html = `<div class="cmp-row3${extraCls}">
      <div class="cmp-metric cmp-metric--left">${metricLabel}</div>
      ${datas.map((_, i) => `<div class="cmp-cell3"><div class="${valCls(i)}">${fmts[i]}</div>${hasBar ? `<span class="cmp-dhalf b" aria-hidden="true">${fill(i)}</span>` : ''}</div>`).join('')}
    </div>`;
  }
  return { wins, empty: vals.every(v => v == null), html };
}

// Ficha del jugador en el cara a cara: foto con aro de su color, nombre y datos básicos
function cmpCard(j, side) {
  const foto = (j.id || j.foto_url || j.bref_id) ? `<span class="cmp-photo"><img loading="lazy" ${agFotoSrc(j)} onerror="agImgRemove(this)" alt="${j.nombre}"></span>` : `<span class="cmp-photo">${avatarHtml(j.nombre, 'cmp-avatar')}</span>`;
  const draft = j.draft ? `Draft ${j.draft_anio || ''} · nº ${j.draft_pick || '?'}` : 'No drafteado';
  const meta = [j.posicion, draft].filter(Boolean).join(' · ');
  const teams = cmpMode === 'career' && j.equipos_nba ? `<span class="cmp-teams">${j.equipos_nba.replace(/\s*,\s*/g, ' · ')}</span>` : '';
  return `<div class="cmp-card cmp-${side}">
    ${foto}
    <a class="cmp-name" href="${jugadorHref(j.id)}">${j.nombre}</a>
    <span class="cmp-meta">${meta}</span>
    ${teams}
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
function cmpModeBar(players) {
  const common = cmpCommon(players);
  const chip = (m, label, on) => `<button type="button" class="cmp-seg-btn${cmpMode === m ? ' active' : ''}" aria-pressed="${cmpMode === m}"${on === false ? ' disabled' : ''} onclick="cmpSetMode('${m}')">${label}</button>`;
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
    <div class="cmp-seg" role="group" aria-label="Qué comparar">
      ${chip('career', 'Toda la carrera')}
      ${chip('same', 'Misma temporada', common.length > 0)}
      ${chip('diff', 'Diferentes años')}
    </div>
    ${extra}
  </div>`;
}

// Franquicias en las que jugó dentro de un rango [lo, hi] (en orden cronológico).
// Una temporada → la franquicia; varias → todas las franquicias del tramo.
function cmpTeamsLabel(j, lo, hi) {
  const seen = [];
  (j.temporadas_data || []).forEach(t => {
    const y = t.year, tm = (t.team || '').toUpperCase();
    if (!y || !tm || tm === 'TOT') return;
    if ((lo != null && y < lo) || (hi != null && y > hi)) return;
    if (!seen.includes(tm)) seen.push(tm);
  });
  return seen.map(tm => teamInfo(tm).name).join(' · ');
}

// Selector Desde/Hasta bajo la foto (solo en modo 'diff')
function cmpRangeUI(side, j, agg) {
  if (cmpMode !== 'diff') {
    if (cmpMode === 'same' && cmpSame) {
      const teams = cmpTeamsLabel(j, cmpSame, cmpSame);
      return `<div class="cmp-range cmp-range--one">${drSeason(cmpSame)}${teams ? `<span class="cmp-range-team">${teams}</span>` : ''}</div>`;
    }
    return '';
  }
  const seasons = cmpSeasons(j);
  if (!seasons.length) return '';
  if (seasons.length === 1) {
    const teams = cmpTeamsLabel(j, seasons[0], seasons[0]);
    return `<div class="cmp-range cmp-range--one">${drSeason(seasons[0])}${teams ? `<span class="cmp-range-team">${teams}</span>` : ''}</div>`;
  }
  const optFrom = seasons.map(y => `<option value="${y}"${y === agg._from ? ' selected' : ''}>${drSeason(y)}</option>`).join('');
  const optTo = seasons.map(y => `<option value="${y}"${y === agg._to ? ' selected' : ''}>${drSeason(y)}</option>`).join('');
  const lbl = agg._full
    ? `<span class="cmp-range-lbl">Toda la carrera</span>`
    : `<span class="cmp-range-lbl">${agg._n} temp. · ${fmtEnt(agg.partidos)} GP · <button type="button" class="cmp-range-reset" onclick="cmpResetRange('${side}')">Toda la carrera</button></span>`;
  const teams = cmpTeamsLabel(j, agg._from, agg._to);
  const teamsHtml = teams ? `<div class="cmp-range-team">${teams}</div>` : '';
  return `<div class="cmp-range">
    <div class="cmp-range-sel">
      <select class="sel cmp-rsel" aria-label="Desde" onchange="cmpSetRange('${side}','from',this.value)">${optFrom}</select>
      <span class="cmp-range-dash">–</span>
      <select class="sel cmp-rsel" aria-label="Hasta" onchange="cmpSetRange('${side}','to',this.value)">${optTo}</select>
    </div>
    ${lbl}
    ${teamsHtml}
  </div>`;
}

// Los <select> de jugador viven en la ficha de cada uno (y el del 3.º en el centro). Como el
// cara a cara se repinta entero, se guardan fuera antes de repintar y se recolocan después.
function cmpStashSelects() {
  const hold = document.querySelector('.cmp-pick');
  ['a', 'b', 'c'].forEach(s => { const el = document.getElementById('cmp-' + s); if (el && hold) hold.appendChild(el); });
}
function cmpPlaceSelects() {
  document.querySelectorAll('#cmp-out [data-sel]').forEach(slot => {
    const el = document.getElementById('cmp-' + slot.getAttribute('data-sel'));
    if (el) slot.appendChild(el);
  });
  const c = document.getElementById('cmp-c');
  if (c && c.options.length) c.options[0].text = c.value ? 'Quitar 3er jugador' : '+ Añadir 3er jugador';
}
function cmpScoreHtml(sc, sides) {
  return sides.map((s, i) => `<i class="cmp-dot p-${s}" aria-hidden="true"></i><b>${sc[i]}</b>`).join('<span class="cmp-sc-dash">–</span>');
}

function cmpRender() {
  const sides = cmpSides();
  const players = sides.map(s => cmpCur(s));
  if (players.some(p => !p)) return;
  const aggs = sides.map((s, i) => cmpAggFor(s, players[i]));
  const prems = sides.map((s, i) => ({ nombre: players[i].nombre, premios: cmpPremiosList(players[i], s) }));
  const scores = sides.map(() => 0);
  const partial = cmpMode !== 'career';
  const noteLbl = cmpMode === 'same' ? (cmpSame ? drSeason(cmpSame) : 'sin datos') : 'rango elegido';
  const sections = CMP_SECTIONS
    .filter(s => !s.when || players.some(p => s.when(p, p)))
    .filter(s => !(partial && s.career))          // en modo parcial se ocultan las secciones de carrera
    .map(s => {
      const datas = sides.map((_, i) => (s.premios ? prems[i] : (s.ranged ? aggs[i] : players[i])));
      let rows = s.rows.map(r => cmpRow(r, datas));
      if (!rows.length) return '';
      const sec = sides.map(() => 0);
      rows.forEach(r => r.wins.forEach((w, i) => { if (w) { scores[i]++; sec[i]++; } }));
      const note = ((s.ranged || s.premios) && partial) ? `<span class="cmp-sec-note">${noteLbl}</span>` : '';
      return `<details class="cmp-section" open><summary class="cmp-sec-title"><span class="cmp-sec-name">${s.title}${note}</span><span class="cmp-sec-score">${cmpScoreHtml(sec, sides)}</span></summary><div class="cmp-sec-body">${rows.map(r => r.html).join('')}</div></details>`;
    }).join('');

  const mxScore = Math.max(...scores);
  const uniqueTop = scores.filter(s => s === mxScore).length === 1;
  const scoreHtml = scores.map(s => `<span class="cmp-sc${(uniqueTop && s === mxScore) ? ' win' : ''}">${s}</span>`).join('<span class="cmp-sc-sep">–</span>');
  const three = sides.length === 3;
  const center = `<div class="cmp-center">
      <div class="cmp-scoreboard"><div class="cmp-score">${scoreHtml}</div><div class="cmp-sc-lbl">categorías ganadas</div></div>
      ${cmpModeBar(players)}
      ${three ? '' : '<span class="cmp-sel-slot cmp-sel-slot--add" data-sel="c"></span>'}
    </div>`;
  const sideHtml = sides.map((s, i) => `<div class="cmp-side p-${s}">${cmpCard(players[i], s)}${cmpRangeUI(s, players[i], aggs[i])}<span class="cmp-sel-slot" data-sel="${s}"></span></div>`);
  const share = cmpShareBand(players, scores);
  const head = three
    ? `<section class="cmp-head cmp-head--3" aria-label="Cara a cara">${sideHtml.join('')}${center}${share}</section>`
    : `<section class="cmp-head" aria-label="Cara a cara">${sideHtml[0]}${center}${sideHtml[1]}${share}</section>`;
  cmpStashSelects();
  document.getElementById('cmp-out').innerHTML = head + sections + cmpLegend();
  cmpPlaceSelects();
  cmpShareThumb();
}

// Banda «Comparte el cara a cara»: miniatura en vivo de la imagen que se publicará en X
function cmpShareBand(players, scores) {
  const names = players.map(p => cmpShortName(p.nombre, players.length)).join(' vs ');
  const xIco = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  return `<button type="button" class="cmp-sharebar" onclick="cmpShare()" aria-label="Compartir la comparación en X (${names}, ${scores.join('–')})">
    <span class="cmp-sb-thumb" aria-hidden="true"><canvas id="cmp-sb-canvas" width="120" height="134"></canvas></span>
    <span class="cmp-sb-txt"><span class="cmp-sb-kicker">Comparte el cara a cara</span><span class="cmp-sb-sub">${names} · <b>${scores.join('–')}</b> · imagen lista para X</span></span>
    <span class="cmp-sb-go" aria-hidden="true"><span class="cmp-sb-lbl">Compartir</span><span class="cmp-sb-x">${xIco}</span><span class="cmp-sb-arrow">→</span></span>
  </button>`;
}
let cmpThumbTok = 0;
async function cmpShareThumb() {
  const tok = ++cmpThumbTok;
  const d = cmpScoreData();
  if (!d) return;
  try {
    const big = await cmpBuildImage(d);
    const cv = document.getElementById('cmp-sb-canvas');
    if (tok !== cmpThumbTok || !cv) return;   // ya hay un repintado más reciente
    cv.height = Math.round(cv.width * big.height / big.width);
    const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(big, 0, 0, cv.width, cv.height);
  } catch (e) { }
}
function cmpLegend() {
  return `<p class="cmp-legend"><span class="cmp-noscore">*</span> No puntúa (fila informativa). El marcador suma <b>1 categoría</b> por cada fila numérica que gana un jugador; los empates no cuentan. Barra llena = gana la fila; atenuada = pierde.</p>`;
}

// Calcula el resultado por bloque y el total (misma lógica que cmpRender, estructurado)
function cmpScoreData() {
  const sides = cmpSides();
  const players = sides.map(s => cmpCur(s));
  if (players.some(p => !p)) return null;
  const aggs = sides.map((s, i) => cmpAggFor(s, players[i]));
  const prems = sides.map((s, i) => ({ nombre: players[i].nombre, premios: cmpPremiosList(players[i], s) }));
  const total = sides.map(() => 0);
  const partial = cmpMode !== 'career';
  const blocks = [];
  CMP_SECTIONS
    .filter(s => !s.when || players.some(p => s.when(p, p)))
    .filter(s => !(partial && s.career))
    .forEach(s => {
      const datas = sides.map((_, i) => (s.premios ? prems[i] : (s.ranged ? aggs[i] : players[i])));
      let rows = s.rows.map(r => cmpRow(r, datas));
      if (!rows.length) return;
      const sec = sides.map(() => 0);
      rows.forEach(r => r.wins.forEach((w, i) => { if (w) { sec[i]++; total[i]++; } }));
      blocks.push({ title: s.title, scores: sec });
    });
  const modoTxt = cmpMode === 'same' ? (cmpSame ? drSeason(cmpSame) : '') : (cmpMode === 'diff' ? 'tramos elegidos' : 'toda la carrera');
  return { players, total, blocks, modoTxt };
}

// Dibuja la imagen-resumen de la comparación con el diseño «cara a cara» de la página:
// fichas con el color de cada jugador, marcador grande (líder subrayado en dorado) y una
// barra enfrentada por bloque (2 jugadores) o una barra por jugador (3).
async function cmpBuildImage(d) {
  try {
    if (document.fonts) {
      await Promise.all(['400 64px "Bebas Neue"', '700 20px Inter', '800 20px Inter'].map(f => document.fonts.load(f).catch(() => null)));
      await document.fonts.ready;
    }
  } catch (e) { }
  const n = d.players.length, three = n === 3;
  const W = 1080, PAD = 56;
  const panelH = three ? 400 : 420, scoreH = 250, rowH = three ? 84 : 78, footH = 100, headH = 150;
  const H = headH + panelH + scoreH + d.blocks.length * rowH + 40 + footH;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const CO = GR_PNG_CO;
  const col = i => GR_PNG_COLORS[i % GR_PNG_COLORS.length];
  const spaced = (px, fn) => { x.save(); try { x.letterSpacing = px + 'px'; } catch (e) { } fn(); x.restore(); };
  const imgs = await Promise.all(d.players.map(p => qntLoadImg(`img/players/${p.id}.jpg`)));

  // Fondo, franja de bandera y antetítulo
  x.fillStyle = CO.bg; x.fillRect(0, 0, W, H);
  x.fillStyle = CO.red; x.fillRect(0, 0, W, 10);
  x.fillStyle = CO.yellow; x.fillRect(W * 0.3, 0, W * 0.4, 10);
  x.textBaseline = 'alphabetic'; x.textAlign = 'center';
  x.font = '400 30px "Bebas Neue", Inter, sans-serif';
  spaced(6, () => { x.fillStyle = CO.yellow; x.fillText('ESPAÑOLES EN LA NBA · EL COMPARADOR', W / 2, 78); });
  const tf = d.modoTxt === 'toda la carrera' ? 'Toda la carrera' : d.modoTxt === 'tramos elegidos' ? 'Tramos elegidos por jugador' : `Temporada ${d.modoTxt}`;
  x.fillStyle = CO.muted; x.font = '500 24px Inter, sans-serif'; x.fillText(tf, W / 2, 116);

  // Fichas: panel teñido del color del jugador, cara con aro, nombre y draft
  const top = headH, pw = (W - 2 * PAD) / n;
  d.players.forEach((p, i) => {
    const px = PAD + i * pw, cx = px + pw / 2;
    x.save();
    x.beginPath(); x.rect(px, top, pw, panelH); x.clip();
    x.fillStyle = col(i); x.globalAlpha = 0.14; x.fillRect(px, top, pw, panelH); x.globalAlpha = 1;
    x.fillRect(px, top, pw, 8);
    x.restore();
    const r = three ? 92 : 112, cy = top + 40 + r;
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
    const img = imgs[i];
    if (img) {
      x.fillStyle = CO.face; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      const sc = 2 * r / GR_FACE.s;
      x.drawImage(img, cx - r - GR_FACE.x * sc, cy - r - GR_FACE.y * sc, GR_FACE.w * sc, img.height * sc * (GR_FACE.w / img.width));
    } else {
      x.fillStyle = qntAvatarColor(p.nombre); x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      x.fillStyle = '#fff'; x.font = `700 ${Math.round(r * 0.7)}px Inter, sans-serif`; x.textBaseline = 'middle'; x.fillText(qntInitials(p.nombre), cx, cy); x.textBaseline = 'alphabetic';
    }
    x.restore();
    x.beginPath(); x.arc(cx, cy, r - 4, 0, Math.PI * 2); x.strokeStyle = col(i); x.lineWidth = 8; x.stroke();
    let fs = three ? 54 : 70;
    x.font = `400 ${fs}px "Bebas Neue", Inter, sans-serif`;
    const name = cmpShortName(p.nombre, n).toUpperCase();
    while (x.measureText(name).width > pw - 24 && fs > 34) { fs -= 2; x.font = `400 ${fs}px "Bebas Neue", Inter, sans-serif`; }
    x.fillStyle = CO.text; x.fillText(name, cx, cy + r + 30 + fs * 0.75);
    x.fillStyle = CO.muted; x.font = `500 ${three ? 20 : 24}px Inter, sans-serif`;
    x.fillText(p.draft ? `Draft ${p.draft_anio || ''} · nº ${p.draft_pick || '?'}` : 'No drafteado', cx, cy + r + 30 + fs * 0.75 + 40);
  });

  // Marcador total
  const sy = top + panelH + 150;
  const mx = Math.max(...d.total), uniqueTop = d.total.filter(t => t === mx).length === 1;
  x.font = '400 150px "Bebas Neue", Inter, sans-serif';
  const sep = '–', gap = 36;
  const ws = d.total.map(t => x.measureText(String(t)).width);
  x.font = '400 90px "Bebas Neue", Inter, sans-serif'; const sw = x.measureText(sep).width;
  let sx = W / 2 - (ws.reduce((a, b) => a + b, 0) + (n - 1) * (sw + 2 * gap)) / 2;
  d.total.forEach((t, i) => {
    const lead = uniqueTop && t === mx;
    x.textAlign = 'left'; x.font = '400 150px "Bebas Neue", Inter, sans-serif';
    x.fillStyle = lead ? CO.text : CO.muted; x.fillText(String(t), sx, sy);
    if (lead) { x.fillStyle = '#f5c518'; x.fillRect(sx + ws[i] / 2 - 40, sy + 18, 80, 9); }
    sx += ws[i];
    if (i < n - 1) { x.font = '400 90px "Bebas Neue", Inter, sans-serif'; x.fillStyle = '#4a4a52'; x.fillText(sep, sx + gap, sy - 20); sx += sw + 2 * gap; }
  });
  x.textAlign = 'center'; x.fillStyle = CO.muted; x.font = '700 20px Inter, sans-serif';
  spaced(4, () => x.fillText('CATEGORÍAS GANADAS', W / 2, sy + 66));

  // Bloques: título + barras como en la página
  let y = top + panelH + scoreH;
  d.blocks.forEach((b, k) => {
    const yc = y + rowH / 2;
    if (k) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(PAD, y, W - 2 * PAD, 1); }
    const bmx = Math.max(...b.scores), uniq = b.scores.filter(s => s === bmx).length === 1;
    const win = i => uniq && b.scores[i] === bmx;
    const tot = b.scores.reduce((a, s) => a + s, 0) || 1;
    if (!three) {
      x.textAlign = 'center'; x.fillStyle = CO.dim; x.font = '700 18px Inter, sans-serif';
      spaced(3, () => x.fillText(b.title.toUpperCase(), W / 2, yc - 12));
      const bx0 = PAD + 120, bx1 = W - PAD - 120, mid = W / 2, half = (bx1 - bx0) / 2 - 3;
      x.fillStyle = '#1f1f26'; x.fillRect(bx0, yc + 2, bx1 - bx0, 12);
      const fill = (i, w) => { x.globalAlpha = win(i) ? 1 : (uniq ? 0.35 : 0.6); x.fillStyle = col(i); if (i === 0) x.fillRect(mid - 3 - w, yc + 2, w, 12); else x.fillRect(mid + 3, yc + 2, w, 12); x.globalAlpha = 1; };
      fill(0, Math.max(4, half * b.scores[0] / Math.max(1, bmx))); fill(1, Math.max(4, half * b.scores[1] / Math.max(1, bmx)));
      x.font = '800 40px Inter, sans-serif';
      x.textAlign = 'right'; x.fillStyle = win(0) ? CO.text : CO.muted; x.fillText(String(b.scores[0]), bx0 - 28, yc + 20);
      x.textAlign = 'left'; x.fillStyle = win(1) ? CO.text : CO.muted; x.fillText(String(b.scores[1]), bx1 + 28, yc + 20);
    } else {
      x.textAlign = 'left'; x.fillStyle = CO.text; x.font = '400 34px "Bebas Neue", Inter, sans-serif';
      spaced(1, () => x.fillText(b.title.toUpperCase(), PAD, yc + 12));
      const colW = (W - 2 * PAD - 330) / 3;
      b.scores.forEach((s, i) => {
        const cx0 = PAD + 330 + i * colW;
        x.font = '800 34px Inter, sans-serif'; x.fillStyle = win(i) ? CO.text : CO.muted; x.textAlign = 'right';
        x.fillText(String(s), cx0 + 44, yc + 12);
        x.fillStyle = '#1f1f26'; x.fillRect(cx0 + 58, yc - 4, colW - 80, 12);
        x.globalAlpha = win(i) ? 1 : (uniq ? 0.35 : 0.6); x.fillStyle = col(i); x.fillRect(cx0 + 58, yc - 4, Math.max(4, (colW - 80) * s / Math.max(1, bmx)), 12); x.globalAlpha = 1;
      });
    }
    y += rowH;
  });

  // Pie de marca
  x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(PAD, H - footH + 20, W - 2 * PAD, 1);
  x.textBaseline = 'middle'; x.font = '700 24px Inter, sans-serif';
  x.textAlign = 'left'; x.fillStyle = CO.text; x.fillText('espanoles-nba.alejandroggo.com', PAD, H - footH / 2 + 10);
  x.textAlign = 'right'; x.fillStyle = CO.yellow; x.fillText('@alejandroggo · #EspañolesNBA', W - PAD, H - footH / 2 + 10);
  return c;
}
function cmpShortName(nombre, n) {
  if (n === 2 && nombre.length <= 18) return nombre;
  const parts = String(nombre).trim().split(/\s+/);
  if (parts.length < 2) return nombre;
  return parts[0][0] + '. ' + parts.slice(1).join(' ');
}

function cmpDescargaImagen(bl) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'comparacion-espanoles-nba.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function cmpShare() {
  if (typeof cmpSyncUrl === 'function') cmpSyncUrl();   // la URL refleja la comparación actual
  const d = cmpScoreData();
  if (!d || d.players.length < 2) return;
  track('compartir', { metodo: 'twitter', origen: 'comparador', jugadores: d.players.map(p => p.nombre).sort().join(' vs ') });
  const names = d.players.map(p => efmHandle(p.nombre) || p.nombre);   // @ de X si lo tenemos, si no el nombre
  const vs = names.length <= 2 ? names.join(' vs ') : names.slice(0, -1).join(', ') + ' vs ' + names[names.length - 1];
  const modo = d.modoTxt === 'toda la carrera' ? '' : (d.modoTxt === 'tramos elegidos' ? ' (tramos elegidos)' : ` (${d.modoTxt})`);
  const texto = `${vs} — cara a cara${modo} 🏀 #EspañolesNBA (vía @alejandroggo)`;
  const url = location.href;
  const xIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto + '\n\n' + url)}`;
  const isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  // Escritorio: abrir X dentro del gesto (si no, el navegador bloquea el popup) y descargar la imagen aparte.
  if (!isTouch) {
    window.open(xIntent, '_blank', 'noopener,noreferrer');
    try { const c = await cmpBuildImage(d); cmpDescargaImagen(await qntBlob(c)); } catch (e) { }
    return;
  }

  // Móvil/táctil: menú nativo con la imagen adjunta (permite elegir la app de X con la foto).
  try {
    const c = await cmpBuildImage(d); const bl = await qntBlob(c);
    const file = new File([bl], 'comparacion-espanoles-nba.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: `${texto}\n\n${url}` });
      return;
    }
    cmpDescargaImagen(bl);
  } catch (e) { if (e && e.name === 'AbortError') return; }
  window.open(xIntent, '_blank', 'noopener,noreferrer');
}

function cmpCur(side) {
  const sel = document.getElementById('cmp-' + side);
  return sel && sel.value ? cmpAll.find(j => j.id === sel.value) : null;
}
function cmpSyncUrl() {
  updateUrlParam('a', document.getElementById('cmp-a').value);
  updateUrlParam('b', document.getElementById('cmp-b').value);
  const selC = document.getElementById('cmp-c');
  updateUrlParam('c', selC ? selC.value : '');
  updateUrlParam('modo', cmpMode === 'career' ? '' : cmpMode);
  updateUrlParam('se', cmpMode === 'same' ? (cmpSame || '') : '');
  const diff = cmpMode === 'diff';
  updateUrlParam('af', diff ? (cmpState.a.from || '') : '');
  updateUrlParam('at', diff ? (cmpState.a.to || '') : '');
  updateUrlParam('bf', diff ? (cmpState.b.from || '') : '');
  updateUrlParam('bt', diff ? (cmpState.b.to || '') : '');
  updateUrlParam('cf', (diff && selC && selC.value) ? (cmpState.c.from || '') : '');
  updateUrlParam('ct', (diff && selC && selC.value) ? (cmpState.c.to || '') : '');
}

async function initComparadorPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  cmpAll = (data.jugadores || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  document.getElementById('hero-sub').textContent = `Compara cara a cara a dos (o tres) de los ${cmpAll.length} españoles de la NBA`;

  const opts = cmpAll.map(j => `<option value="${j.id}">${j.nombre}</option>`).join('');
  const selA = document.getElementById('cmp-a'), selB = document.getElementById('cmp-b'), selC = document.getElementById('cmp-c');
  selA.innerHTML = opts; selB.innerHTML = opts;
  if (selC) selC.innerHTML = `<option value="">3º jugador (opcional)</option>` + opts;

  const params = new URLSearchParams(location.search);
  const withStats = cmpAll.filter(j => (j.partidos || 0) > 0);
  const pick = (frag, i) => (withStats.find(j => new RegExp(frag, 'i').test(j.nombre)) || withStats[i] || cmpAll[i] || cmpAll[0]).id;
  const has = id => cmpAll.some(j => j.id === id);
  const defA = params.get('a'), defB = params.get('b'), defC = params.get('c');
  selA.value = has(defA) ? defA : pick('pau gasol', 0);
  selB.value = has(defB) ? defB : pick('marc gasol', 1);
  if (selA.value === selB.value) selB.value = (cmpAll.find(j => j.id !== selA.value) || cmpAll[0]).id;
  if (selC && has(defC)) selC.value = defC;

  cmpState.a = { id: selA.value, from: null, to: null };
  cmpState.b = { id: selB.value, from: null, to: null };
  cmpState.c = { id: selC ? selC.value : null, from: null, to: null };

  // Restaurar modo desde la URL
  const m = params.get('modo');
  if (m === 'same' || m === 'diff') cmpMode = m;
  if (cmpMode === 'diff') {
    cmpInitRange('a', params.get('af'), params.get('at'));
    cmpInitRange('b', params.get('bf'), params.get('bt'));
    if (selC && selC.value) cmpInitRange('c', params.get('cf'), params.get('ct'));
  } else if (cmpMode === 'same') {
    const common = cmpCommon(cmpPlayers());
    const se = Number(params.get('se'));
    cmpSame = common.includes(se) ? se : (common.length ? common[common.length - 1] : null);
    if (!common.length) cmpMode = 'career';
  }

  selA.onchange = cmpUpdate; selB.onchange = cmpUpdate;
  if (selC) selC.onchange = cmpUpdate;
  cmpRender();
  cmpSyncUrl();
}

// Valida y aplica un rango de la URL a un jugador
function cmpInitRange(side, from, to) {
  const j = cmpCur(side);
  if (!j) return;
  const seasons = cmpSeasons(j);
  if (seasons.length < 2) return;
  const inRange = v => { const n = Number(v); return v && seasons.includes(n) ? n : null; };
  let f = inRange(from), t = inRange(to);
  if (f && t && f > t) { const tmp = f; f = t; t = tmp; }
  cmpState[side].from = f; cmpState[side].to = t;
}

// Al cambiar de jugador, revalida las selecciones del modo activo
function cmpUpdate() {
  cmpSides().forEach(s => {
    const id = document.getElementById('cmp-' + s).value;
    if (cmpState[s].id !== id) cmpState[s] = { id, from: null, to: null };
  });
  const players = cmpPlayers();
  if (players.length < 2) return;
  track('comparar_jugadores', { jugadores: players.map(p => p.nombre).sort().join(' vs '), n: players.length });
  if (cmpMode === 'same') {
    const common = cmpCommon(players);
    if (!common.length) { cmpMode = 'career'; cmpSame = null; }
    else if (!common.includes(cmpSame)) cmpSame = common[common.length - 1];
  }
  cmpRender(); cmpSyncUrl();
}

function cmpSetMode(m) {
  cmpMode = m;
  if (m === 'same') {
    const common = cmpCommon(cmpPlayers());
    if (!common.includes(cmpSame)) cmpSame = common.length ? common[common.length - 1] : null;
  }
  cmpRender();
  cmpSyncUrl();
}
function cmpSetSame(value) {
  cmpSame = Number(value);
  cmpRender();
  cmpSyncUrl();
}

function cmpSetRange(side, which, value) {
  const v = Number(value);
  const st = cmpState[side];
  if (which === 'from') { st.from = v; if (st.to != null && st.to < v) st.to = v; }
  else { st.to = v; if (st.from != null && st.from > v) st.from = v; }
  cmpRender();
  cmpSyncUrl();
}

function cmpResetRange(side) {
  const st = cmpState[side];
  st.from = null; st.to = null;   // null = toda la carrera (ver cmpAgg)
  cmpRender();
  cmpSyncUrl();
}

function cmpSwap() {
  const a = document.getElementById('cmp-a'), b = document.getElementById('cmp-b');
  const t = a.value; a.value = b.value; b.value = t;
  const tmp = cmpState.a; cmpState.a = cmpState.b; cmpState.b = tmp;
  cmpRender();
  cmpSyncUrl();
}

// ══════════════════════════════════════════════
// TEMPORADAS — todas las temporadas de todos los españoles (filtrable)
// ══════════════════════════════════════════════
let tmpRows = [], tmpMode = 'total', tmpDim = 'reg';
let tmpRowsReg = [], tmpRowsPo = [];
let tmpSortCol = 'year', tmpSortAsc = false;
let tmpFilterTeam = '', tmpFilterYear = '', tmpSearch = '', tmpHidePartials = false;
let tmpFilters = []; // filtros avanzados: [{ col, op, value }]

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

// ── Filtros avanzados (constructor de condiciones) ──
// Columnas filtrables (los per-game se ajustan al modo Totales/Por partido).
function tmpFilterCols() {
  const perg = key => r => { const v = r.t[key]; if (v == null) return null; return tmpMode === 'total' ? (r.g ? v * r.g : null) : v; };
  const pct = key => r => r.t[key] != null ? r.t[key] * 100 : null;
  return [
    { key: 'jugador', label: 'Jugador', type: 'text', val: r => r.jugador },
    { key: 'year', label: 'Año', type: 'num', val: r => r.year },
    { key: 'team', label: 'Equipo', type: 'text', val: r => r.team },
    { key: 'g', label: 'GP', type: 'num', val: r => r.g },
    { key: 'min_g', label: 'MIN', type: 'num', val: perg('min_g') },
    { key: 'pts_g', label: 'PTS', type: 'num', val: perg('pts_g') },
    { key: 'rbd_g', label: 'REB', type: 'num', val: perg('rbd_g') },
    { key: 'ast_g', label: 'AST', type: 'num', val: perg('ast_g') },
    { key: 'stl_g', label: 'ROB', type: 'num', val: perg('stl_g') },
    { key: 'blk_g', label: 'TAP', type: 'num', val: perg('blk_g') },
    { key: 'fgm_g', label: 'FGM', type: 'num', val: perg('fgm_g') },
    { key: 'tres_g', label: '3PM', type: 'num', val: perg('tres_g') },
    { key: 'ftm_g', label: 'FTM', type: 'num', val: perg('ftm_g') },
    { key: 'tov_g', label: 'TOV', type: 'num', val: perg('tov_g') },
    { key: 'pf_g', label: 'PF', type: 'num', val: perg('pf_g') },
    { key: 'td', label: 'TD', type: 'num', val: r => r.t.td },
    { key: 'fg_pct', label: 'FG%', type: 'num', val: pct('fg_pct') },
    { key: 'tres_pct', label: '3P%', type: 'num', val: pct('tres_pct') },
    { key: 'ft_pct', label: 'FT%', type: 'num', val: pct('ft_pct') },
  ];
}
const TMP_OPS_NUM = [['>', '>'], ['>=', '≥'], ['<', '<'], ['<=', '≤'], ['=', '='], ['!=', '≠']];
const TMP_OPS_TXT = [['contiene', 'contiene'], ['=', 'es'], ['!=', 'no es']];

function tmpApplyFilters(rows) {
  const active = tmpFilters.filter(f => f.value !== '' && f.value != null);
  if (!active.length) return rows;
  const colMap = {}; tmpFilterCols().forEach(c => colMap[c.key] = c);
  return rows.filter(r => active.every(f => {
    const col = colMap[f.col];
    if (!col) return true;
    const v = col.val(r);
    if (col.type === 'text') {
      const s = String(v || '').toLowerCase(), q = String(f.value).toLowerCase();
      if (f.op === '=') return s === q;
      if (f.op === '!=') return s !== q;
      return s.includes(q);
    }
    if (v == null) return false;
    const n = parseFloat(String(f.value).replace(',', '.'));
    if (isNaN(n)) return true;
    switch (f.op) {
      case '>': return v > n; case '>=': return v >= n;
      case '<': return v < n; case '<=': return v <= n;
      case '=': return Math.abs(v - n) < 1e-9; case '!=': return Math.abs(v - n) >= 1e-9;
    }
    return true;
  }));
}

function tmpAddFilter() { tmpFilters.push({ col: 'pts_g', op: '>', value: '' }); renderTmpFilters(); }
function tmpDelFilter(i) { tmpFilters.splice(i, 1); renderTmpFilters(); renderTmpTable(); }
function tmpSetFilterCol(i, key) {
  const col = tmpFilterCols().find(c => c.key === key);
  tmpFilters[i].col = key;
  const validOps = (col && col.type === 'text' ? TMP_OPS_TXT : TMP_OPS_NUM).map(o => o[0]);
  if (!validOps.includes(tmpFilters[i].op)) tmpFilters[i].op = validOps[0];
  renderTmpFilters(); renderTmpTable();
}
function tmpSetFilterOp(i, op) { tmpFilters[i].op = op; renderTmpTable(); }
function tmpSetFilterVal(i, v) { tmpFilters[i].value = v; renderTmpTable(); }

function renderTmpFilters() {
  const wrap = document.getElementById('tmp-filterbar');
  if (!wrap) return;
  const cols = tmpFilterCols();
  const rowsHtml = tmpFilters.map((f, i) => {
    const col = cols.find(c => c.key === f.col) || cols[0];
    const ops = col.type === 'text' ? TMP_OPS_TXT : TMP_OPS_NUM;
    const colOpts = cols.map(c => `<option value="${c.key}"${c.key === f.col ? ' selected' : ''}>${c.label}</option>`).join('');
    const opOpts = ops.map(o => `<option value="${o[0]}"${o[0] === f.op ? ' selected' : ''}>${o[1]}</option>`).join('');
    return `<div class="tmp-filter">
      <select class="tmp-f-col" aria-label="Columna" onchange="tmpSetFilterCol(${i}, this.value)">${colOpts}</select>
      <select class="tmp-f-op" aria-label="Operador" onchange="tmpSetFilterOp(${i}, this.value)">${opOpts}</select>
      <input class="tmp-f-val" aria-label="Valor" placeholder="Valor" value="${String(f.value).replace(/"/g, '&quot;')}" oninput="tmpSetFilterVal(${i}, this.value)">
      <button type="button" class="tmp-f-del" aria-label="Quitar filtro" onclick="tmpDelFilter(${i})">×</button>
    </div>`;
  }).join('');
  wrap.innerHTML = `${rowsHtml}<button type="button" class="toggle-chip tmp-add-filter" onclick="tmpAddFilter()"><span class="tmp-add-ico">▼</span> Añadir filtro</button>`;
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

// Filas de playoffs: una por temporada-equipo. Sin traspasos ni cortes (no aplican en playoffs).
function tmpBuildPo(jugadores) {
  const rows = [];
  (jugadores || []).forEach(j => {
    const foto = j.foto_url || (j.bref_id ? `https://www.basketball-reference.com/req/202605210/images/headshots/${j.bref_id}.jpg` : '');
    (j.playoffs_temporadas || []).forEach(t => {
      if (!t || !t.year || String(t.team || '').toUpperCase() === 'TOT') return;
      rows.push({ id: j.id, jugador: j.nombre, foto, year: +t.year, team: t.team || '—', teamCode: t.team || '', g: t.g || 0, t, kind: 'normal', nEq: 1, seq: 0, cut: false });
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
  const beforeAdv = rows.length;
  rows = tmpApplyFilters(rows);
  const advFilteredOut = beforeAdv - rows.length;

  const dir = tmpSortAsc ? 1 : -1;
  rows.sort((a, b) => {
    const va = tmpSortVal(a, tmpSortCol), vb = tmpSortVal(b, tmpSortCol);
    let cmp;
    if (typeof va === 'string' || typeof vb === 'string') cmp = String(va).localeCompare(String(vb), 'es');
    else cmp = (va == null ? -Infinity : va) - (vb == null ? -Infinity : vb);
    if (cmp !== 0) return cmp * dir;
    return (b.year - a.year) || a.jugador.localeCompare(b.jugador, 'es') || (a.seq - b.seq); // desempate: total antes que parciales
  });

  document.getElementById('tmp-count').textContent = `${rows.length} fila${rows.length === 1 ? '' : 's'}${advFilteredOut > 0 ? ` · ${advFilteredOut} filtrada${advFilteredOut === 1 ? '' : 's'}` : ''}`;

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
    return `<th scope="col" tabindex="0" class="th-sortable ${c.cls || ''} ${active ? 'sorted' + (tmpSortAsc ? ' asc' : '') : ''}" aria-sort="${ariaSort}" onclick="sortTmp('${c.key}')">${c.label}</th>`;
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
    const thumb = (r.id || r.foto)
      ? `<img loading="lazy" class="player-thumb" ${agFotoSrc2(r.id, r.foto)} onerror="agImgHide(this)" alt="">`
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

function toggleTmpAdv() {
  const bar = document.getElementById('tmp-filterbar');
  const btn = document.getElementById('tmp-adv');
  if (!bar || !btn) return;
  const open = bar.hidden;
  bar.hidden = !open;
  btn.classList.toggle('active', open);
  btn.setAttribute('aria-expanded', String(open));
  const caret = btn.querySelector('.tmp-adv-caret');
  if (caret) caret.textContent = open ? '▴' : '▾';
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
  const sel = document.getElementById('tmp-mode');
  if (sel) sel.value = tmpMode;
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

function tmpPopulateFilters() {
  const teams = [...new Set(tmpRows.filter(r => r.teamCode).map(r => r.teamCode))].sort();
  const years = [...new Set(tmpRows.map(r => r.year))].sort((a, b) => b - a);
  const teamSel = document.getElementById('tmp-team'), yearSel = document.getElementById('tmp-year');
  teamSel.innerHTML = `<option value="">Todos los equipos</option>` + teams.map(t => `<option value="${t}">${t}</option>`).join('');
  yearSel.innerHTML = `<option value="">Todas las temporadas</option>` + years.map(y => `<option value="${y}">${drSeason(y)}</option>`).join('');
  teamSel.value = tmpFilterTeam; yearSel.value = tmpFilterYear;
}

function tmpUpdateHero() {
  const src = tmpDim === 'po' ? tmpRowsPo : tmpRowsReg;
  const players = new Set(src.map(r => r.id));
  const seasons = new Set(src.map(r => r.id + ':' + r.year));
  if (tmpDim === 'po') {
    document.getElementById('hero-sub').textContent = `${seasons.size} temporadas de playoffs de ${players.size} españoles`;
  } else {
    const cutSeasons = new Set(src.filter(r => r.cut).map(r => r.id + ':' + r.year));
    const efec = (seasons.size - 0.5 * cutSeasons.size).toLocaleString('es-ES');
    document.getElementById('hero-sub').textContent = `${efec} temporadas de ${players.size} españoles · los traspasos cuentan 1 y los cortes ½ (${cutSeasons.size})`;
  }
}

function setTmpDim(d) {
  if (tmpDim === d) return;
  tmpDim = d;
  tmpRows = d === 'po' ? tmpRowsPo : tmpRowsReg;
  const dimSel = document.getElementById('tmp-dim'); if (dimSel) dimSel.value = d;
  // Equipos y años difieren entre dimensiones → se reinician los filtros
  tmpFilterTeam = ''; tmpFilterYear = '';
  updateUrlParam('equipo', ''); updateUrlParam('anio', '');
  updateUrlParam('tipo', d === 'po' ? 'po' : '');
  tmpPopulateFilters();
  // Parciales y leyenda solo aplican a temporada regular
  const legend = document.querySelector('.tmp-legend'); if (legend) legend.style.display = d === 'po' ? 'none' : '';
  const hideBtn = document.getElementById('tmp-hide'); if (hideBtn) hideBtn.style.display = d === 'po' ? 'none' : '';
  tmpUpdateHero();
  renderTmpTable();
}

async function initTemporadasPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  tmpRowsReg = tmpBuild(data.jugadores);
  tmpRowsPo = tmpBuildPo(data.jugadores);

  const params = new URLSearchParams(location.search);
  if (params.get('tipo') === 'po' && tmpRowsPo.length) {
    tmpDim = 'po';
    const dimSel = document.getElementById('tmp-dim'); if (dimSel) dimSel.value = 'po';
    const legend = document.querySelector('.tmp-legend'); if (legend) legend.style.display = 'none';
    const hideBtn = document.getElementById('tmp-hide'); if (hideBtn) hideBtn.style.display = 'none';
  }
  tmpRows = tmpDim === 'po' ? tmpRowsPo : tmpRowsReg;
  tmpUpdateHero();

  // Poblar filtros (equipos: solo códigos reales, no las filas TOT)
  tmpPopulateFilters();
  const teams = [...new Set(tmpRows.filter(r => r.teamCode).map(r => r.teamCode))].sort();
  const years = [...new Set(tmpRows.map(r => r.year))].sort((a, b) => b - a);
  const teamSel = document.getElementById('tmp-team'), yearSel = document.getElementById('tmp-year');

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
  const tmpQ = new URLSearchParams(location.search).get('q');
  if (tmpQ) { tmpSearch = tmpQ.trim().toLowerCase(); document.getElementById('tmp-search').value = tmpQ; }

  renderTmpFilters();
  renderTmpTable();
}

// ══════════════════════════════════════════════
// PARTIDOS POR EQUIPO (matriz jugador × equipo)
// ══════════════════════════════════════════════
// Jugadores en activo en la NBA → equipo actual (mantener a mano)
const POEQ_ACTIVE = {
  'santi-aldama': 'DAL',
  'hugo-gonzalez': 'BOS',
  'sergio-de-larrea': 'MEM',
  'baba-miller': 'LAC',
  'aday-mara': 'OKC',
};

// Las 30 franquicias actuales (se muestran todas, aunque no tengan españoles)
const POEQ_TEAMS = ['ATL', 'BKN', 'BOS', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOL', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];

let poeqJ = [], poeqMode = 'reg', poeqSelTeam = null;

// {team: partidos} en temporada regular (desde temporadas_data, sin TOT)
function poeqRegByTeam(j) {
  const m = {};
  (j.temporadas_data || []).forEach(t => {
    const tm = (t.team || '').toUpperCase();
    if (tm && tm !== 'TOT') m[tm] = (m[tm] || 0) + (t.g || 0);
  });
  return m;
}
// {team: partidos} en playoffs (desde playoffs_temporadas del data.json)
function poeqPoByTeam(j) {
  const m = {};
  (j.playoffs_temporadas || []).forEach(t => {
    const tm = (t.team || '').toUpperCase();
    if (tm && tm !== 'TOT') m[tm] = (m[tm] || 0) + (t.g || 0);
  });
  return m;
}

async function initPorEquipoPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  poeqJ = data.jugadores || [];
  if (new URLSearchParams(location.search).get('modo') === 'po') { poeqMode = 'po'; poeqSyncButtons(); }

  const wrap = document.getElementById('poeq-wrap'), top = document.getElementById('poeq-topscroll');
  if (wrap && top) {
    let lock = false;
    wrap.addEventListener('scroll', () => { if (lock) return; lock = true; top.scrollLeft = wrap.scrollLeft; lock = false; });
    top.addEventListener('scroll', () => { if (lock) return; lock = true; wrap.scrollLeft = top.scrollLeft; lock = false; });
  }
  renderPorEquipo();
}

function poeqSyncButtons() {
  const s = document.getElementById('poeq-mode'); if (s) s.value = poeqMode;
}
function setPoeqMode(m) {
  if (poeqMode === m) return;
  poeqMode = m; poeqSyncButtons();
  updateUrlParam('modo', m === 'reg' ? '' : m);
  renderPorEquipo();
}

// Verde de mapa de calor según intensidad (0..1)
function poeqHeat(v, max) {
  if (!v || !max) return '';
  const a = 0.10 + 0.55 * (v / max);
  return `background: rgba(22,163,74,${a.toFixed(3)});`;
}

// Elegir un equipo: resalta a los que jugaron ahí y atenúa al resto (clic de nuevo = quitar)
function poeqSelectTeam(t) {
  poeqSelTeam = (poeqSelTeam === t) ? null : t;
  renderPorEquipo();
}

function renderPorEquipo() {
  const byTeam = poeqMode === 'reg' ? poeqRegByTeam : poeqPoByTeam;
  const showActive = poeqMode === 'reg';   // los activos sin debutar solo en temporada regular
  const rows = poeqJ.map(j => {
    const bt = byTeam(j);
    const total = Object.values(bt).reduce((s, n) => s + n, 0);
    const src = j.foto_url || (j.bref_id ? `${BREF_HEADSHOTS}/${j.bref_id}.jpg` : '');
    return { id: j.id, nombre: j.nombre, foto: src, bt, total, active: POEQ_ACTIVE[j.id] || null };
  }).filter(r => r.total > 0 || (showActive && r.active)).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'));

  // Las 30 franquicias (+ cualquier código histórico que aparezca en los datos)
  const teams = [...new Set([...POEQ_TEAMS, ...rows.flatMap(r => Object.keys(r.bt)), ...(showActive ? rows.map(r => r.active).filter(Boolean) : [])])].sort();
  const grand = rows.reduce((s, r) => s + r.total, 0);
  const maxCell = Math.max(1, ...rows.flatMap(r => Object.values(r.bt)));
  const teamTot = {}, teamPl = {};
  teams.forEach(t => { teamTot[t] = 0; teamPl[t] = 0; });
  rows.forEach(r => teams.forEach(t => { if (r.bt[t]) { teamTot[t] += r.bt[t]; teamPl[t]++; } }));

  document.getElementById('hero-sub').textContent =
    `${rows.length} españoles · ${grand.toLocaleString('es-ES')} partidos ${poeqMode === 'reg' ? 'de temporada regular' : 'de playoffs'} repartidos por ${teams.length} equipos`;
  document.getElementById('poeq-count').innerHTML = poeqMode === 'reg'
    ? '<b>En negrita</b>, jugadores en activo · • equipo actual'
    : 'Partidos de playoffs por equipo';

  const head = `<tr><th class="poeq-name-h">Jugador</th>${teams.map(t => {
    const info = teamInfo(t);
    return `<th class="poeq-th${t === poeqSelTeam ? ' poeq-th-sel' : ''}" title="${info.name} · clic para resaltar quién jugó aquí" style="box-shadow: inset 0 -3px 0 ${info.color}" onclick="poeqSelectTeam('${t}')">${t}</th>`;
  }).join('')}<th class="poeq-tot-h">TOTAL</th><th class="poeq-pct-h">%</th></tr>`;
  document.getElementById('poeq-thead').innerHTML = head;

  document.getElementById('poeq-tbody').innerHTML = rows.map(r => {
    const thumb = (r.id || r.foto)
      ? `<img loading="lazy" class="player-thumb" ${agFotoSrc2(r.id, r.foto)} onerror="agImgHide(this)" alt="">`
      : avatarHtml(r.nombre, 'player-thumb');
    const cells = teams.map(t => {
      const v = r.bt[t];
      const cur = (showActive && r.active === t);   // equipo actual del activo
      if (v) return `<td class="poeq-cell${cur ? ' poeq-current' : ''}" style="${poeqHeat(v, maxCell)}">${v}</td>`;
      if (cur) return `<td class="poeq-cell poeq-current" title="En plantilla actualmente">•</td>`;
      return `<td class="poeq-cell poeq-zero"></td>`;
    }).join('');
    const dim = (poeqSelTeam && !r.bt[poeqSelTeam]) ? ' poeq-dim' : '';
    return `<tr class="${dim.trim()}">
      <th scope="row" class="poeq-name${r.active ? ' poeq-active' : ''}"><span class="poeq-player">${thumb}${plLink(r.nombre, nombreResp(r.nombre))}</span></th>
      ${cells}
      <td class="poeq-tot">${r.total}</td>
      <td class="poeq-pct">${grand ? fmtPctN(r.total / grand * 100) : "—"}</td>
    </tr>`;
  }).join('');

  const footTot = teams.map(t => `<td class="poeq-foot-num">${teamTot[t]}</td>`).join('');
  const footPct = teams.map(t => `<td class="poeq-foot-sub">${grand ? fmtPctN(teamTot[t] / grand * 100) : ""}</td>`).join('');
  const footPl = teams.map(t => `<td class="poeq-foot-sub">${teamPl[t] || ''}</td>`).join('');
  const footTeams = teams.map(t => `<td class="poeq-foot-team" title="${teamInfo(t).name}" style="box-shadow: inset 0 3px 0 ${teamInfo(t).color}">${t}</td>`).join('');
  document.getElementById('poeq-tfoot').innerHTML =
    `<tr class="poeq-foot"><th class="poeq-name">Total partidos</th>${footTot}<td class="poeq-tot">${grand}</td><td class="poeq-pct">100%</td></tr>
     <tr class="poeq-foot poeq-foot--sub poeq-foot--pct"><th class="poeq-name">% del total</th>${footPct}<td></td><td></td></tr>
     <tr class="poeq-foot poeq-foot--sub"><th class="poeq-name">Jugadores</th>${footPl}<td class="poeq-tot">${rows.length}</td><td></td></tr>
     <tr class="poeq-foot poeq-foot--teams"><th class="poeq-name poeq-name-h">Equipo</th>${footTeams}<td class="poeq-tot-h">TOTAL</td><td class="poeq-pct-h">%</td></tr>`;

  const table = document.getElementById('poeq-table'), inner = document.getElementById('poeq-topscroll-inner'), wrap = document.getElementById('poeq-wrap'), top = document.getElementById('poeq-topscroll');
  if (table && inner) { inner.style.width = table.scrollWidth + 'px'; if (top) top.style.display = table.scrollWidth > wrap.clientWidth ? 'block' : 'none'; }
}

// ══════════════════════════════════════════════
// PÁGINA PREGÚNTAME (buscador Q&A local sobre los datos)
// Motor determinista: interpreta la pregunta y responde leyendo data.json.
// No usa IA ni servidor; nunca inventa: si no lo entiende, lo dice.
// ══════════════════════════════════════════════
let botPlayers = [];
let botCtx = null, botPending = null;   // memoria conversacional (seguimiento)
let botExtra = { dorsales: [], transacciones: [], efemerides: [], summer_league: [] };   // datos globales (no por jugador)
// Prepara la lista de jugadores para el motor (deriva el nº de temporadas)
function botPrepPlayers(list, data) {
  botPlayers = list || [];
  if (data) botExtra = { dorsales: data.dorsales || [], transacciones: data.transacciones || [], efemerides: data.efemerides || [], summer_league: data.summer_league || [] };
  botPlayers.forEach(j => {
    if (j._temporadas == null) {
      const yrs = new Set((j.temporadas_data || []).filter(t => t.year && (t.team || '').toUpperCase() !== 'TOT').map(t => t.year));
      j._temporadas = j.temporadas || yrs.size || null;
    }
  });
}

// Parejas (compañeros) y duelos (cara a cara) para el buscador PEPU
let BOT_PAREJAS = [];
let BOT_DUELOS = [];
async function botLoadExtras() {
  try { if (!BOT_PAREJAS.length) BOT_PAREJAS = await fetch('data/parejas.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []); } catch (e) { }
  try { if (!BOT_DUELOS.length) BOT_DUELOS = await fetch('data/duelos.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : []); } catch (e) { }
}
function botFindPareja(a, b) {
  const na = botNorm(a.nombre), nb = botNorm(b.nombre);
  return BOT_PAREJAS.find(p => { const pa = botNorm(p.a), pb = botNorm(p.b); return (pa === na && pb === nb) || (pa === nb && pb === na); }) || null;
}
function botFindDuelo(a, b) {
  const na = botNorm(a.nombre), nb = botNorm(b.nombre);
  return BOT_DUELOS.find(d => { const da = botNorm(d.a), db = botNorm(d.b); return (da === na && db === nb) || (da === nb && db === na); }) || null;
}
function botDueloMsg(d, a, b) {
  const igual = /^igualado/i.test(d.rec);
  const fechas = (d.primer && d.ultimo) ? ` entre <b>${d.primer}</b> y <b>${d.ultimo}</b>` : '';
  let s = igual
    ? `El <b>cara a cara</b> entre <b>${d.a}</b> y <b>${d.b}</b> está <b>igualado</b>: ${d.rec}.`
    : `En el <b>cara a cara</b> entre <b>${d.a}</b> y <b>${d.b}</b>, el récord es <b>${d.rec}</b>.`;
  s += ` Se enfrentaron <b>${d.g}</b> ${d.g === 1 ? 'vez' : 'veces'}${fechas}.`;
  if (d.av) s += ` Medias por partido — <b>${d.a}</b>: ${d.av[d.a]}; <b>${d.b}</b>: ${d.av[d.b]}.`;
  if (d.playoffs && d.playoffs.length) s += ` En playoffs: ${d.playoffs.map(x => `${x.temporada} ${x.serie}`).join('; ')}.`;
  s += ` ${botPlayerChip(a)}${botPlayerChip(b)}`;
  if (d.nota) s += `<div class="bot-sub">${d.nota}</div>`;
  s += `<div class="bot-sub"><a href="cara-a-cara.html">Ver la matriz del cara a cara →</a></div>`;
  return s;
}

const BOT_EXAMPLES = [
  '¿Quién ha metido más puntos?',
  '¿Cuántos anillos tiene Pau Gasol?',
  '¿En qué equipos jugó Ibaka?',
  'Pau Gasol vs Marc Gasol',
  '¿Cuántos puntos metió Pau Gasol en 2010?',
  '¿En qué equipo jugaba Ibaka en 2016?',
  '¿Cuánto ha ganado Ricky Rubio?',
  '¿Quién ha jugado en los Lakers?',
  'Triples de Sergio Rodríguez en playoffs',
  '¿Récord de puntos de Pau en un partido?',
  '¿Quién tiene más All-Star?',
  '¿Qué dorsal lleva Ricky Rubio?',
  '¿Quién gana el cara a cara entre Pau y Marc?',
  '¿Cuántos partidos jugaron juntos Marc e Ibaka?',
  'Ricky Rubio contra José Calderón',
];

// Diccionario de estadísticas. El orden importa (triple-doble antes que triples).
const BOT_STATS = [
  { re: /triples?\s*dobles?|triple[- ]?doble/, total: 'td_total', pg: 'td_total', label: 'triples dobles', kind: 'count' },
  { re: /\bpunto|anota|anotad|maximo anotador|max anotador|scorer|\bpts?\b/, total: 'pts_total', pg: 'pts_g', label: 'puntos', kind: 'num' },
  { re: /rebote|\brbd\b|\breb\b/, total: 'rbd_total', pg: 'rbd_g', label: 'rebotes', kind: 'num' },
  { re: /asist|\bast\b/, total: 'ast_total', pg: 'ast_g', label: 'asistencias', kind: 'num' },
  { re: /\brobo|\bstl\b|steal/, total: 'stl_total', pg: 'stl_g', label: 'robos', kind: 'num' },
  { re: /tapon|bloqueo|\bblk\b/, total: 'blk_total', pg: 'blk_g', label: 'tapones', kind: 'num' },
  { re: /porcentaje de (tiro|campo)|tiro de campo|\bfg%|efectividad/, total: 'fg_pct', pg: 'fg_pct', label: 'FG% (tiro de campo)', kind: 'pct' },
  { re: /porcentaje de triple|triple%|\b3p%/, total: 'tres_pct', pg: 'tres_pct', label: '3P% (triples)', kind: 'pct' },
  { re: /tiro libre|libres|\bft%/, total: 'ft_pct', pg: 'ft_pct', label: 'FT% (tiros libres)', kind: 'pct' },
  { re: /triples?|\b3pm?\b/, total: 'tres_total', pg: 'tres_g', label: 'triples', kind: 'num' },
  { re: /minuto|\bmin\b/, total: 'min_total', pg: 'min_g', label: 'minutos', kind: 'num' },
  { re: /\btemporadas\b|\bcampañas\b|\bcampanas\b/, total: '_temporadas', pg: '_temporadas', label: 'temporadas', kind: 'count' },
  { re: /partido|juego|\bgp\b/, total: 'partidos', pg: 'partidos', label: 'partidos', kind: 'count' },
];

function botNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function botHref(page) { return page; }
// Contenido secundario plegable: la respuesta va corta y se amplía solo al hacer click
function botMore(inner) { return ` <details class="bot-more"><summary>Ver detalle</summary>${inner}</details>`; }
function botPlayerChip(j) {
  const thumb = (j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'bot-avatar');
  return `<a class="bot-chip" href="${jugadorHref(j.id)}"><span class="bot-chip-thumb">${thumb}</span>${j.nombre}</a>`;
}

// Detecta a los jugadores mencionados (por nombre, apellido o nombre completo).
// Admite varios jugadores nombrados de forma desigual ("Marc Gasol e Ibaka").
function botFindPlayers(raw) {
  const q = ' ' + botNorm(raw).replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  const cands = botPlayers.map(j => {
    const full = botNorm(j.nombre).replace(/[^a-z0-9]+/g, ' ').trim();
    const toks = full.split(' ').filter(t => t.length >= 3);
    const matched = new Set(toks.filter(t => q.includes(' ' + t + ' ')));
    return { j, matched };
  }).filter(c => c.matched.size > 0);
  if (!cands.length) return [];
  // Descarta candidatos "dominados": otro jugador cubre un superconjunto estricto
  // de sus tokens (así "Pau Gasol" descarta a Marc, pero "Gasol" mantiene a ambos).
  const kept = cands.filter(c => !cands.some(o =>
    o !== c && o.matched.size > c.matched.size && [...c.matched].every(t => o.matched.has(t))));
  return kept.map(c => c.j);
}

function botFindStat(q) { return BOT_STATS.find(s => s.re.test(q)) || null; }

// Códigos que coinciden con palabras españolas comunes: no valen como detector de equipo
const BOT_TEAM_STOP = new Set(['por', 'mil', 'min', 'den', 'sac', 'was']);
// Detecta un equipo por nombre, ciudad o código
function botFindTeam(q) {
  const nq = ' ' + q.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  for (const [code, info] of Object.entries(TEAM_INFO)) {
    const cand = [botNorm(info.name), botNorm(info.label)];
    if (!BOT_TEAM_STOP.has(code.toLowerCase())) cand.push(code.toLowerCase());
    // apodos/última palabra (lakers, celtics, spurs…)
    const last = botNorm(info.name).split(' ').pop();
    if (last.length >= 4) cand.push(last);
    if (cand.some(c => nq.includes(' ' + c + ' '))) return code;
  }
  return null;
}

function botRings(j) { return TL_ANILLOS[drNorm(j.nombre)] || {}; }
function botTeamsOf(j) {
  const seen = [];
  [...(j.temporadas_data || [])].sort((a, b) => (a.year || 0) - (b.year || 0)).forEach(t => {
    const tm = (t.team || '').toUpperCase();
    if (tm && tm !== 'TOT' && !seen.includes(tm)) seen.push(tm);
  });
  return seen;
}
function botFmt(stat, v, perGame) {
  if (v == null) return '—';
  if (stat.kind === 'pct') return fmtPct(v);
  if (perGame && stat.kind === 'num') return fmtDec1(v);
  return fmtEnt(v);
}

// Ranking de una estadística (top 5). dim: 'reg' | 'po'. asc: menos→más.
function botRankList(stat, dim, asc, perGame) {
  const field = perGame ? stat.pg : stat.total;
  let pool = botPlayers.map(j => {
    const src = dim === 'po' ? j.playoffs_totales : j;
    const games = dim === 'po' ? (j.playoffs_totales ? j.playoffs_totales.partidos : 0) : j.partidos;
    return { j, v: src ? src[field] : null, games: games || 0 };
  }).filter(x => x.games > 0 && x.v != null);
  if (stat.kind === 'pct') pool = pool.filter(x => x.games >= (dim === 'po' ? 20 : 50));
  else pool = pool.filter(x => x.v > 0);
  pool.sort((a, b) => asc ? a.v - b.v : b.v - a.v);
  return pool.slice(0, 5);
}

// Posición de un jugador en el ranking español de una estadística
function botRankOf(j, field, dim, minGames) {
  const mg = minGames || 0;
  const pool = botPlayers.map(p => {
    const src = dim === 'po' ? p.playoffs_totales : p;
    const games = dim === 'po' ? (p.playoffs_totales ? p.playoffs_totales.partidos : 0) : p.partidos;
    return { id: p.id, v: src ? src[field] : null, games: games || 0 };
  }).filter(x => x.games > mg && x.v != null).sort((a, b) => b.v - a.v);
  const i = pool.findIndex(x => x.id === j.id);
  return i >= 0 ? { rank: i + 1, total: pool.length } : null;
}
// Partidos por equipo (temporada regular)
function botTeamGames(j) {
  const m = {};
  (j.temporadas_data || []).forEach(t => { const tm = (t.team || '').toUpperCase(); if (tm && tm !== 'TOT') m[tm] = (m[tm] || 0) + (t.g || 0); });
  return m;
}
// Agrega una estadística de un jugador SOLO con un equipo (desde temporadas_data)
function botTeamAgg(j, team, stat, dim) {
  const rows = (dim === 'po' ? j.playoffs_temporadas : j.temporadas_data) || [];
  let g = 0, weighted = 0, td = 0; const seasons = new Set();
  rows.forEach(t => {
    if ((t.team || '').toUpperCase() !== team) return;
    const gg = t.g || 0; g += gg; td += (t.td || 0); if (t.year) seasons.add(t.year);
    const per = t[stat.pg];
    if (per != null) weighted += per * gg;
  });
  if (!g) return null;
  if (stat.total === '_temporadas') return { v: seasons.size, g, per: null };
  if (stat.total === 'partidos') return { v: g, g, per: null };
  if (stat.label === 'triples dobles') return { v: td, g, per: null };
  if (stat.kind === 'pct') return { v: weighted / g, g, per: weighted / g };   // media ponderada por partidos
  return { v: weighted, g, per: weighted / g };                                 // total y media
}
function botDebutYear(j) { const m = String((j.primer_partido && j.primer_partido.fecha) || '').match(/(\d{4})/); return m ? +m[1] : null; }
// Temporadas-equipo de un jugador (para saber con quién coincidió)
function botTeamSeasonSet(j) {
  const s = new Set();
  (j.temporadas_data || []).forEach(t => { const tm = (t.team || '').toUpperCase(); if (tm && tm !== 'TOT' && t.year) s.add(t.year + '|' + tm); });
  return s;
}
// Temporadas en que dos jugadores fueron compañeros (mismo equipo y año)
function botTogether(a, b) {
  const sb = botTeamSeasonSet(b);
  return [...botTeamSeasonSet(a)].filter(x => sb.has(x))
    .map(x => { const p = x.split('|'); return { year: +p[0], team: p[1] }; })
    .sort((p, q) => p.year - q.year);
}
// Detecta el año (de fin de temporada) mencionado: "2010", "2009-10", "15-16"
function botYear(q) {
  let m = q.match(/\b(19|20)(\d{2})\s*[-/–]\s*(\d{2})\b/);
  if (m) { const y1 = parseInt(m[1] + m[2], 10), yy = parseInt(m[3], 10); let end = Math.floor(y1 / 100) * 100 + yy; if (end <= y1) end += 100; return end; }
  m = q.match(/\b(\d{2})\s*[-/–]\s*(\d{2})\b/);
  if (m) { const b = parseInt(m[2], 10); return b < 60 ? 2000 + b : 1900 + b; }
  // Año suelto, pero NO si es una cantidad ("2000 puntos", "3000 rebotes")
  const re = /\b(19[5-9]\d|20[0-2]\d)\b/g;
  let mm;
  while ((mm = re.exec(q))) {
    const after = q.slice(mm.index + mm[0].length);
    if (/^\s+(puntos?|rebotes?|asistencias?|triples?|tapones?|robos?|partidos?|minutos?|dolares?|millones?|anillos?|mil\b)/.test(after)) continue;
    return parseInt(mm[1], 10);
  }
  return null;
}
function botSeasonRows(j, year) { return (j.temporadas_data || []).filter(t => t.year === year); }
function botSeasonMain(j, year) {
  const rows = botSeasonRows(j, year);
  if (!rows.length) return null;
  return rows.find(t => String(t.team || '').toUpperCase() === 'TOT') || rows[0];
}
function botSeasonTeams(j, year) {
  return botSeasonRows(j, year).filter(t => String(t.team || '').toUpperCase() !== 'TOT').map(t => (t.team || '').toUpperCase());
}
function botRankSentence(j, field, dim, label, minGames) {
  const r = botRankOf(j, field, dim, minGames);
  if (!r) return '';
  const poTxt = dim === 'po' ? ' en playoffs' : '';
  if (r.rank === 1) return ` Es el <b>máximo</b> de todos los españoles en ${label}${poTxt}.`;
  return ` Ocupa el <b>${r.rank}º</b> puesto entre los españoles en ${label}${poTxt}.`;
}

// ── Soporte para temas nuevos (career highs, premios por tipo, dorsales, transacciones, efemérides, posición) ──
function botSameName(a, b) { return botNorm(a) === botNorm(b); }
// Máximo en un partido → clave dentro de game_highs
const BOT_GH = { puntos: 'pts', rebotes: 'rbd', asistencias: 'ast', robos: 'stl', tapones: 'blk', triples: 'tres_m', minutos: 'min' };
// Tipos de premio reconocibles por su nombre coloquial (orden: lo más específico primero)
const BOT_AWARDS = [
  { re: /concurso|three ?point|mates|skills|habilidad(es)?/, tipo: 'All Star – Concursos', label: 'concursos del All-Star' },
  { re: /all[- ]?star|partido de las estrellas/, tipo: 'All Star', label: 'All-Star' },
  { re: /all[- ]?nba|mejor quinteto(?!.*defens)/, tipo: 'All NBA', label: 'All-NBA' },
  { re: /all[- ]?rookie|quinteto de (rookie|novato)/, tipo: 'All Rookie', label: 'All-Rookie' },
  { re: /all[- ]?defens|quinteto defensivo|mejor defensa/, tipo: 'All Defense', label: 'All-Defense' },
  { re: /\broy\b|rookie of the year|rookie del a[nñ]o|novato del a[nñ]o|mejor novato/, tipo: 'ROY', label: 'Rookie del Año' },
  { re: /\bdpoy\b|defensive player|defensor del a[nñ]o|mejor defensor/, tipo: 'DPOY', label: 'Mejor Defensor del Año' },
  { re: /\bmvp\b|jugador mas valioso/, tipo: 'MVP (votos)', label: 'candidato al MVP' },
  { re: /jugador del mes|player of the month/, tipo: 'Player of the Month', label: 'Jugador del Mes' },
  { re: /novato del mes|rookie of the month/, tipo: 'Rookie of the Month', label: 'Novato del Mes' },
  { re: /rising star/, tipo: 'Rising Stars', label: 'Rising Stars' },
];
function botAwards(j, tipo) { return (j.premios || []).filter(a => a.tipo === tipo); }
// Posiciones (sin dígitos sueltos para no confundir con "top 3", "3 triples"…)
const BOT_POS = [
  { re: /\bpivots?\b|\bcenter\b/, pos: 'Pívot', label: 'pívot' },
  { re: /ala[- ]?pivots?|power forward/, pos: 'Ala-Pívot', label: 'ala-pívot' },
  { re: /\baleros?\b|small forward/, pos: 'Alero', label: 'alero' },
  { re: /\bescoltas?\b|shooting guard/, pos: 'Escolta', label: 'escolta' },
  { re: /\bbases?\b|point guard/, pos: 'Base', label: 'base' },
];
// Fecha de efeméride: admite "1 jan 2015" y "2015-02-08". Devuelve [día, mes] o null.
const BOT_MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, ene: 1, abr: 4, ago: 8, dic: 12 };
function botEfeMD(f) {
  const s = String(f || '').toLowerCase().trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return [parseInt(m[3], 10), parseInt(m[2], 10)];
  m = s.match(/^(\d{1,2})\s+([a-z]{3})/);
  if (m && BOT_MON[m[2]]) return [parseInt(m[1], 10), BOT_MON[m[2]]];
  return null;
}
// Fecha de nacimiento → {d, mo, y} (admite "6 jul 1980" y "1980-07-06"); si solo hay año, {y}.
function botBirth(j) {
  const s = String(j.nacimiento_fecha || '').toLowerCase().trim();
  let m = s.match(/^(\d{1,2})\s+([a-z]{3})\.?\s+(\d{4})/);
  if (m && BOT_MON[m[2]]) return { d: +m[1], mo: BOT_MON[m[2]], y: +m[3] };
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { d: +m[3], mo: +m[2], y: +m[1] };
  if (j.nacimiento) return { d: null, mo: null, y: +j.nacimiento };
  return null;
}
// Fallecidos: no se calcula una "edad actual" (único caso: Fernando Martín, 1962–1989)
const BOT_FALLECIDOS = { 'fernando-martin': 1989 };
function botAge(j) {
  if (BOT_FALLECIDOS[j.id]) return null;
  const b = botBirth(j);
  if (!b || !b.y || !b.mo) return null;
  const t = new Date();
  let a = t.getFullYear() - b.y;
  if (t.getMonth() + 1 < b.mo || (t.getMonth() + 1 === b.mo && t.getDate() < b.d)) a--;
  return a;
}

// Respuesta a una pregunta. Devuelve HTML o null (no entendido). Se explaya con contexto.
function botAnswer(raw) {
  const text = raw.trim();
  if (!text) return null;
  const q = botNorm(text);
  let players = botFindPlayers(text);
  let stat = botFindStat(q);
  const team = botFindTeam(q);
  let dim = /playoff|postemporada|post ?temporada|eliminatoria|postseason/.test(q) ? 'po' : 'reg';
  let perGame = /por partido|de media|media de|promedi|por noche|por juego/.test(q);
  const superl = /quien|cual|cuales|mas |menos|maximo|max |mejor|peor|top|ranking|lider|record|primero/.test(q);
  const asc = /menos|peor|menor/.test(q);
  let year = botYear(q);

  // Seguimiento conversacional: hereda lo que falte de la pregunta anterior
  const qClean = q.replace(/^[¿¡\s]+/, '');
  const shift = /siguiente|posterior|despues|que viene/.test(q) ? 1 : (/anterior|previ|antes/.test(q) ? -1 : 0);
  const isFollow = /^y\b/.test(qClean) || /\bsiguiente\b|\banterior\b/.test(q) || shift !== 0;
  if (isFollow && botCtx) {
    if (!players.length && botCtx.players && botCtx.players.length) players = botCtx.players;
    if (!stat && botCtx.stat) stat = botCtx.stat;
    if (dim === 'reg' && botCtx.dim === 'po' && !/regular/.test(q)) dim = 'po';
    let base = (year != null) ? year : botCtx.year;
    if (shift && base != null) base += shift;
    year = base != null ? base : null;
    if (!/(por partido|de media|totales?|en total)/.test(q)) perGame = perGame || botCtx.perGame;
  }
  const dimTxt = dim === 'po' ? ' en playoffs' : '';
  botPending = { players, stat, year, dim, perGame, count: false };

  // 0) COMPAÑEROS: españoles que jugaron juntos (mismo equipo y temporada)
  if (/\bparejas?\b|juntos|junto a|compañer|companer|coincid|mismo equipo|a la vez|de compañero|con (que|quien|algun|otro|otros?|algun otro) espanol|con espanoles|con algun espanol/.test(q)) {
    const caveat = `<div class="bot-sub">Es el dato de temporadas compartidas en el mismo equipo; no tengo el recuento exacto de partidos juntos en pista.</div>`;
    if (players.length >= 2) {
      const [a, b] = players;
      const pj = botFindPareja(a, b);
      if (pj) {
        const verFicha = `<div class="bot-sub"><a href="parejas.html">Ver la ficha de la pareja →</a></div>`;
        if (!pj.partidos_juntos) {
          let s0 = `<b>${pj.a}</b> y <b>${pj.b}</b> son compañeros`;
          if (pj.equipo) s0 += ` en <b>${pj.equipo}</b>`;
          s0 += pj.en_activo ? ' (en activo)' : '';
          s0 += `, pero <b>aún no han jugado juntos</b>: la pareja está por estrenarse.`;
          return `${s0} ${botPlayerChip(a)}${botPlayerChip(b)}${verFicha}`;
        }
        let s0 = `<b>${pj.a}</b> y <b>${pj.b}</b> fueron compañeros`;
        if (pj.equipo) s0 += ` en <b>${pj.equipo}</b>`;
        if (pj.era) s0 += ` (${pj.era})`;
        s0 += `: jugaron <b>${pj.partidos_juntos}</b> partidos juntos`;
        if (pj.victorias_pct != null) s0 += ` con un <b>${pj.victorias_pct}%</b> de victorias${pj.record ? ` (${pj.record})` : ''}`;
        s0 += `.`;
        if (pj.campeones) s0 += ` Fueron <b>campeones de la NBA en 2019</b>.`;
        if (pj.playoffs) s0 += ` Playoffs: ${pj.playoffs}.`;
        return `${s0} ${botPlayerChip(a)}${botPlayerChip(b)}${verFicha}`;
      }
      const c = botTogether(a, b);
      if (!c.length) return `<b>${a.nombre}</b> y <b>${b.nombre}</b> <b>nunca</b> fueron compañeros en la NBA (no jugaron en el mismo equipo la misma temporada). ${botPlayerChip(a)}${botPlayerChip(b)}`;
      const det = c.map(x => `${drSeason(x.year)} (${teamInfo(x.team).name})`).join(', ');
      return `<b>${a.nombre}</b> y <b>${b.nombre}</b> fueron compañeros en <b>${c.length}</b> temporada${c.length > 1 ? 's' : ''}: ${det}. ${botPlayerChip(a)}${botPlayerChip(b)} ${caveat}`;
    }
    if (players.length === 1) {
      const j = players[0];
      const mates = botPlayers.filter(o => o.id !== j.id).map(o => ({ o, c: botTogether(j, o) })).filter(x => x.c.length);
      if (!mates.length) return `<b>${j.nombre}</b> no coincidió con ningún otro español como compañero de equipo en la NBA. ${botPlayerChip(j)}`;
      const det = mates.map(x => `<b>${x.o.nombre}</b> (${[...new Set(x.c.map(s => teamInfo(s.team).label + ' ' + drSeason(s.year)))].join(', ')})`).join('; ');
      return `<b>${j.nombre}</b> compartió vestuario con <b>${mates.length}</b> español${mates.length > 1 ? 'es' : ''}: ${det}. <div class="bot-chips">${mates.map(x => botPlayerChip(x.o)).join('')}</div> ${caveat}`;
    }
    // General: todas las parejas
    const seen = [];
    for (let i = 0; i < botPlayers.length; i++) for (let k = i + 1; k < botPlayers.length; k++) {
      const c = botTogether(botPlayers[i], botPlayers[k]);
      if (c.length) seen.push({ a: botPlayers[i], b: botPlayers[k], c });
    }
    if (!seen.length) return null;
    return `Estos españoles han sido <b>compañeros de equipo</b> en la NBA:<div class="bot-sub">${seen.map(s => `• <b>${s.a.nombre}</b> y <b>${s.b.nombre}</b> — ${[...new Set(s.c.map(x => teamInfo(x.team).label + ' ' + drSeason(x.year)))].join(', ')}`).join('<br>')}</div>`;
  }

  // 0.5) CARA A CARA (duelos directos entre españoles)
  {
    const explicitDuel = /cara a cara|se enfrent|enfrentaron|enfrentamiento|\bduelo|duelos|mano a mano|frente a frente/.test(q);
    const vsWord = /\bcontra\b|frente a|\bante\b|quien gan/.test(q);
    const duel2 = players.length >= 2 && (explicitDuel || (vsWord && !stat && !team));
    const duel1 = players.length === 1 && explicitDuel && !stat;
    if (duel2) {
      const [a, b] = players;
      const d = botFindDuelo(a, b);
      if (d) return botDueloMsg(d, a, b);
      if (explicitDuel || vsWord) {
        const tg = botTogether(a, b);
        const extra = tg.length ? ' Fueron compañeros de equipo, así que apenas coincidieron como rivales.' : '';
        return `No tengo registrado ningún <b>duelo directo</b> entre <b>${a.nombre}</b> y <b>${b.nombre}</b> en la NBA.${extra} ${botPlayerChip(a)}${botPlayerChip(b)}`;
      }
    }
    if (duel1) {
      const j = players[0], me = botNorm(j.nombre);
      const ds = BOT_DUELOS.filter(d => botNorm(d.a) === me || botNorm(d.b) === me);
      if (!ds.length) return `No tengo <b>duelos directos</b> registrados de <b>${j.nombre}</b> contra otros españoles. ${botPlayerChip(j)}`;
      ds.sort((x, y) => y.g - x.g);
      const rival = d => botNorm(d.a) === me ? d.b : d.a;
      const list = ds.slice(0, 6).map(d => `<b>${rival(d)}</b> (${d.rec} · ${d.g} part.)`).join('; ');
      const totG = ds.reduce((s, d) => s + d.g, 0);
      return `<b>${j.nombre}</b> tiene <b>${ds.length}</b> rivales españoles en el cara a cara (<b>${totG}</b> enfrentamientos en total). Los más repetidos: ${list}. ${botPlayerChip(j)}<div class="bot-sub"><a href="cara-a-cara.html">Ver la matriz del cara a cara →</a></div>`;
    }
  }

  // 1) ANILLOS
  if (/anillo|campeon|titulo nba|campeonato/.test(q)) {
    const champs = botPlayers.map(j => ({ j, r: botRings(j), n: Object.keys(botRings(j)).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
    if (superl && !players.length) {
      if (!champs.length) return null;
      const top = champs[0];
      const totAnillos = champs.reduce((s, x) => s + x.n, 0);
      return `El español con más anillos de la NBA es <b>${top.j.nombre}</b>, con <b>${top.n}</b> (${Object.entries(top.r).map(([y, t]) => `${y}, ${teamInfo(t).name}`).join('; ')}). En total, solo <b>${champs.length}</b> españoles han sido campeones de la NBA, sumando <b>${totAnillos}</b> anillos entre todos. ${botPlayerChip(top.j)}
        <div class="bot-sub">${champs.map(x => `${x.j.nombre}: ${x.n}`).join(' · ')}</div>`;
    }
    if (players.length) {
      return players.map(j => {
        const r = botRings(j), n = Object.keys(r).length;
        if (!n) return `<b>${j.nombre}</b> <b>no ganó</b> ningún anillo de la NBA a lo largo de su carrera. ${botPlayerChip(j)}`;
        const det = Object.entries(r).map(([y, t]) => `<b>${y}</b> con ${teamInfo(t).name}`).join(' y ');
        const otros = champs.filter(x => x.j.id !== j.id).map(x => x.j.nombre);
        const ctx = champs.length > 1 ? ` Es uno de los <b>${champs.length}</b> únicos españoles campeones de la NBA${otros.length ? `, junto a ${otros.join(' y ')}` : ''}.` : '';
        return `<b>${j.nombre}</b> ganó <b>${n}</b> anillo${n > 1 ? 's' : ''} de la NBA: ${det}.${ctx} ${botPlayerChip(j)}`;
      }).join('<hr class="bot-hr">');
    }
  }

  // 2) DINERO / SALARIO
  if (/dinero|cuanto (ha )?gan|ganad|salario|sueldo|cobr|euros|dolar|\$/.test(q) && !stat) {
    const ranked = botPlayers.filter(j => j.ganancias).sort((a, b) => b.ganancias - a.ganancias);
    const salPend = /pendiente|por cobrar|le queda|falta por cobrar|firmad|por ganar|\bfuturo\b/.test(q);
    const salCob = /cobrad|ha cobrado|\bcobro\b|realmente (ha )?gan|de verdad/.test(q);
    // dinero pendiente de cobrar (contrato firmado)
    if (salPend) {
      if (players.length) {
        return players.map(j => {
          const fut = j.ganancias_futuro || 0;
          if (!fut) return `<b>${j.nombre}</b> no tiene dinero pendiente de cobrar: ya ha cobrado todo lo firmado${j.ganancias ? ` (<b>${fmtDinero(j.ganancias_ganado != null ? j.ganancias_ganado : j.ganancias)}</b>)` : ''}. ${botPlayerChip(j)}`;
          return `A <b>${j.nombre}</b> le quedan por cobrar <b>${fmtDinero(fut)}</b> de contrato firmado (ya ha cobrado ${fmtDinero(j.ganancias_ganado || 0)}). ${botPlayerChip(j)}`;
        }).join('<hr class="bot-hr">');
      }
      const pend = botPlayers.filter(j => (j.ganancias_futuro || 0) > 0).sort((a, b) => b.ganancias_futuro - a.ganancias_futuro);
      if (!pend.length) return `Ningún español tiene dinero pendiente de cobrar registrado.`;
      const top = pend[0], second = pend[1];
      return `El español con más dinero <b>pendiente de cobrar</b> es <b>${top.nombre}</b>, con <b>${fmtDinero(top.ganancias_futuro)}</b> firmados${second ? `, por delante de <b>${second.nombre}</b> (${fmtDinero(second.ganancias_futuro)})` : ''}. ${botPlayerChip(top)}${botMore(`<ol class="bot-rank">${pend.slice(0, 5).map(j => `<li><span>${j.nombre}</span><b>${fmtDinero(j.ganancias_futuro)}</b></li>`).join('')}</ol>`)}`;
    }
    // dinero realmente cobrado
    if (salCob && players.length) {
      return players.map(j => {
        const cob = j.ganancias_ganado != null ? j.ganancias_ganado : j.ganancias;
        if (cob == null) return `No tengo datos de salario de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
        const fut = j.ganancias_futuro || 0;
        return `<b>${j.nombre}</b> ha cobrado <b>${fmtDinero(cob)}</b> en su carrera NBA.${fut ? ` Le quedan <b>${fmtDinero(fut)}</b> por cobrar de contrato firmado.` : ''} ${botPlayerChip(j)}`;
      }).join('<hr class="bot-hr">');
    }
    if (superl && !players.length) {
      if (!ranked.length) return null;
      const top3 = ranked.slice(0, 3);
      return `El español que más dinero ha ganado en la NBA es <b>${ranked[0].nombre}</b>, con <b>${fmtDinero(ranked[0].ganancias)}</b> brutos en toda su carrera. Le siguen <b>${top3[1] ? top3[1].nombre : ''}</b> (${top3[1] ? fmtDinero(top3[1].ganancias) : ''})${top3[2] ? ` y <b>${top3[2].nombre}</b> (${fmtDinero(top3[2].ganancias)})` : ''}. ${botPlayerChip(ranked[0])}${botMore(`<ol class="bot-rank">${ranked.slice(0, 5).map(j => `<li><span>${j.nombre}</span><b>${fmtDinero(j.ganancias)}</b></li>`).join('')}</ol>`)}`;
    }
    if (players.length) {
      return players.map(j => {
        if (!j.ganancias) return `No tengo datos de salario de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
        const pos = ranked.findIndex(x => x.id === j.id) + 1;
        const posTxt = pos ? ` Eso le convierte en el <b>${pos}º</b> español que más ha ganado en la liga.` : '';
        return `<b>${j.nombre}</b> ha ganado <b>${fmtDinero(j.ganancias)}</b> brutos a lo largo de su carrera en la NBA.${posTxt} ${botPlayerChip(j)}`;
      }).join('<hr class="bot-hr">');
    }
  }

  // 3) DRAFT
  if (/draft|drafte|elegid|pick|seleccionad/.test(q) && players.length) {
    return players.map(j => {
      const deb = (j.primer_partido && j.primer_partido.fecha) ? ` Debutó en la NBA el <b>${j.primer_partido.fecha}</b>.` : '';
      if (!j.draft) return `<b>${j.nombre}</b> <b>no fue drafteado</b>: llegó a la NBA como agente libre no seleccionado.${deb} ${botPlayerChip(j)}`;
      const ronda = j.draft_pick ? (j.draft_pick <= 30 ? ' en primera ronda' : ' en segunda ronda') : '';
      const notas = j.draft_notas ? ` ${j.draft_notas}.` : '';
      return `A <b>${j.nombre}</b> lo eligió <b>${j.draft_equipo ? teamInfo(j.draft_equipo).name : '—'}</b> con el <b>número ${j.draft_pick || '?'}</b> del <b>draft de ${j.draft_anio || '?'}</b>${ronda}.${notas}${deb} ${botPlayerChip(j)}`;
    }).join('<hr class="bot-hr">');
  }

  // 4) DEBUT
  if (/debut|primer partido|estreno|cuando (empez|llego|debut)/.test(q) && players.length) {
    return players.map(j => {
      const p = j.primer_partido;
      if (!p || !p.fecha) return `No tengo la fecha de debut de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
      const edadN = parseInt(p.edad, 10);
      const edad = edadN ? `, con <b>${edadN} años</b>,` : '';
      const rival = p.rival ? ` frente a ${p.rival}` : '';
      const plz = (n, s, pl) => `${n} ${n === 1 ? s : pl}`;
      const linea = [p.pts != null ? plz(p.pts, 'punto', 'puntos') : null, p.rbd != null ? plz(p.rbd, 'rebote', 'rebotes') : null, p.ast != null ? plz(p.ast, 'asistencia', 'asistencias') : null].filter(Boolean);
      const stats = linea.length ? ` En su estreno firmó <b>${linea.join(', ')}</b>${p.min ? ` en ${p.min} minutos` : ''}.` : '';
      return `<b>${j.nombre}</b> debutó en la NBA el <b>${p.fecha}</b>${edad} con <b>${p.equipo ? teamInfo(p.equipo).name : '—'}</b>${rival}.${stats} ${botPlayerChip(j)}`;
    }).join('<hr class="bot-hr">');
  }

  // E1) PREMIO CONCRETO (All-Star, All-NBA, ROY, DPOY, MVP…): conteo por jugador y ranking por tipo
  {
    const aw = BOT_AWARDS.find(a => a.re.test(q));
    if (aw) {
      const held = botPlayers.map(j => ({ j, list: botAwards(j, aw.tipo) })).filter(x => x.list.length);
      if (players.length) {
        return players.map(j => {
          const list = botAwards(j, aw.tipo);
          if (!list.length) return `No me consta que <b>${j.nombre}</b> haya sido <b>${aw.label}</b>. ${botPlayerChip(j)}`;
          const years = list.map(a => a.year).filter(Boolean).sort((p, r) => p - r);
          const ref = held.slice().sort((p, r) => r.list.length - p.list.length);
          const pos = ref.findIndex(x => x.j.id === j.id) + 1;
          const liderTxt = (pos === 1 && (ref.length < 2 || list.length > ref[1].list.length)) ? ` Es el español con <b>más ${aw.label}</b>.` : (pos ? ` Es el <b>${pos}º</b> español con más ${aw.label}.` : '');
          const yrTxt = years.length ? ` (${years.map(drSeason).join(', ')})` : '';
          return `<b>${j.nombre}</b> fue <b>${aw.label}</b> <b>${list.length}</b> ${list.length === 1 ? 'vez' : 'veces'}${yrTxt}.${liderTxt} ${botPlayerChip(j)}`;
        }).join('<hr class="bot-hr">');
      }
      if (!held.length) return `No me consta ningún español que haya sido <b>${aw.label}</b>.`;
      const ranked = held.slice().sort((p, r) => r.list.length - p.list.length);
      if (['ROY', 'DPOY'].includes(aw.tipo) || ranked.every(x => x.list.length === 1)) {
        const quienes = ranked.map(x => `<b>${x.j.nombre}</b>${x.list[0] && x.list[0].year ? ` (${drSeason(x.list[0].year)})` : ''}`);
        return `${ranked.length === 1 ? 'El único español que ha sido' : 'Los españoles que han sido'} <b>${aw.label}</b>: ${quienes.join(', ')}. ${botPlayerChip(ranked[0].j)}`;
      }
      const top = ranked[0], second = ranked[1];
      const cola = second ? ` Le sigue <b>${second.j.nombre}</b> (${second.list.length}).` : '';
      return `El español con más <b>${aw.label}</b> es <b>${top.j.nombre}</b>, con <b>${top.list.length}</b>.${cola} ${botPlayerChip(top.j)}${botMore(`<ol class="bot-rank">${ranked.map(x => `<li><span>${x.j.nombre}</span><b>${x.list.length}</b></li>`).join('')}</ol>`)}`;
    }
  }

  // E2) MÁXIMO EN UN PARTIDO (career high): "récord de puntos de Pau en un partido"
  if (/career ?high|en un (solo )?partido|en un (solo )?encuentro|en un (solo )?choque|en un mismo partido/.test(q) && stat && BOT_GH[stat.label]) {
    const key = BOT_GH[stat.label];
    const ghList = botPlayers.map(j => ({ j, v: j.game_highs ? j.game_highs[key] : null })).filter(x => x.v != null);
    if (players.length) {
      return players.map(j => {
        const v = j.game_highs ? j.game_highs[key] : null;
        if (v == null) return `No tengo el máximo de <b>${stat.label}</b> en un partido de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
        const ref = ghList.slice().sort((a, b) => b.v - a.v);
        const pos = ref.findIndex(x => x.j.id === j.id) + 1;
        const posTxt = pos === 1 ? ' Es el <b>mejor registro</b> de un español.' : (pos ? ` Es el <b>${pos}º</b> mejor registro de un español.` : '');
        return `El máximo de <b>${j.nombre}</b> en un partido NBA es de <b>${fmtEnt(v)} ${stat.label}</b>.${posTxt} ${botPlayerChip(j)}`;
      }).join('<hr class="bot-hr">');
    }
    if (!ghList.length) return null;
    const ranked = ghList.sort((a, b) => asc ? a.v - b.v : b.v - a.v).slice(0, 5);
    const top = ranked[0], second = ranked[1];
    return `El récord de un español en <b>${stat.label}</b> en un solo partido lo tiene <b>${top.j.nombre}</b>, con <b>${fmtEnt(top.v)}</b>${second ? `, por delante de <b>${second.j.nombre}</b> (${fmtEnt(second.v)})` : ''}. ${botPlayerChip(top.j)}${botMore(`<ol class="bot-rank">${ranked.map(x => `<li><span>${x.j.nombre}</span><b>${fmtEnt(x.v)}</b></li>`).join('')}</ol>`)}`;
  }

  // E3) DORSALES
  {
    const wearVerb = /(llev|llevo|llevaba|lleva|llevaron|uso|usa|usaba|usado|lucia|luce|viste|vistio|gasta|porta|porto)/.test(q);
    const dorsalWord = /dorsal|camiseta/.test(q) || (/\bnumeros?\b/.test(q) && wearVerb);
    const numMatch = q.match(/(?:numero|dorsal|el|con|llev\w*|us\w*|luc\w*|vist\w*|gast\w*|port\w*)\s+(?:el\s+)?(\d{1,2})\b/);
    if ((dorsalWord || (wearVerb && numMatch)) && botExtra.dorsales.length) {
      const num = numMatch ? parseInt(numMatch[1], 10) : null;
      if (num != null && !players.length) {
        const who = [];
        botExtra.dorsales.filter(d => d.numero === num).forEach(d => { if (!who.some(w => botSameName(w, d.jugador))) who.push(d.jugador); });
        if (!who.length) return `No me consta ningún español con el dorsal <b>${num}</b>. <div class="bot-sub"><a href="dorsales.html">Ver todos los dorsales →</a></div>`;
        return `${who.length === 1 ? 'Ha llevado' : 'Han llevado'} el dorsal <b>${num}</b> en la NBA: <b>${who.join('</b>, <b>')}</b>. <div class="bot-sub"><a href="dorsales.html">Ver dorsales →</a></div>`;
      }
      if (players.length) {
        return players.map(j => {
          const mine = botExtra.dorsales.filter(d => botSameName(d.jugador, j.nombre));
          if (!mine.length) return `No tengo el dorsal de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
          const byNum = {};
          mine.forEach(d => { (byNum[d.numero] = byNum[d.numero] || []).push(d.team); });
          const nums = Object.keys(byNum).map(n => +n).sort((a, b) => a - b);
          const parts = nums.map(n => `<b>${n}</b> (${[...new Set(byNum[n])].map(t => teamInfo(t).name).join(', ')})`);
          const txt = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
          return `<b>${j.nombre}</b> ha lucido ${parts.length === 1 ? 'el dorsal' : 'los dorsales'} ${txt} en la NBA. ${botPlayerChip(j)}`;
        }).join('<hr class="bot-hr">');
      }
    }
  }

  // E4) TRANSACCIONES / MOVIMIENTOS DE MERCADO
  {
    const trxWord = /transaccion|traspas|fichaj|ficho|ficharon|cortad|\bcorto\b|cortaron|waiver|agente libre|renovacion|renovo|extension|movimientos?|renuncia de derechos/.test(q);
    if (trxWord && botExtra.transacciones.length) {
      const T = botExtra.transacciones;
      const TRX = [
        { re: /traspas/, tipo: 'Traspasado', label: 'traspasado', noun: 'traspasos' },
        { re: /cortad|\bcorto\b|cortaron/, tipo: 'Cortado', label: 'cortado', noun: 'cortes' },
        { re: /waiver/, tipo: 'Waivers', label: 'pasado por waivers', noun: 'waivers' },
        { re: /agente libre/, tipo: 'Agente libre', label: 'firmado como agente libre', noun: 'fichajes como agente libre' },
        { re: /renovacion|renovo|renova/, tipo: 'Renovación', label: 'renovado', noun: 'renovaciones' },
        { re: /extension|extendi/, tipo: 'Extensión', label: 'con extensión', noun: 'extensiones' },
      ];
      const trx = TRX.find(t => t.re.test(q));
      if (superl && !players.length && trx) {
        const c = {};
        T.filter(r => r.tipo === trx.tipo).forEach(r => { c[r.jugador] = (c[r.jugador] || 0) + 1; });
        const ranked = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (!ranked.length) return `No tengo movimientos de tipo <b>${trx.label}</b> de españoles.`;
        const [n0, v0] = ranked[0], nx = ranked[1];
        return `El español con más <b>${trx.noun}</b> es <b>${n0}</b> (${v0})${nx ? `, seguido de <b>${nx[0]}</b> (${nx[1]})` : ''}.${botMore(`<ol class="bot-rank">${ranked.map(([n, v]) => `<li><span>${n}</span><b>${v}</b></li>`).join('')}</ol>`)}`;
      }
      if (trx && !players.length) {
        const who = [...new Set(T.filter(r => r.tipo === trx.tipo).map(r => r.jugador))];
        if (!who.length) return `No tengo españoles con movimiento de tipo <b>${trx.label}</b>.`;
        return `Españoles que han sido <b>${trx.label}</b> alguna vez en la NBA: <b>${who.join('</b>, <b>')}</b>. <div class="bot-sub"><a href="transacciones.html">Ver todas las transacciones →</a></div>`;
      }
      if (players.length) {
        return players.map(j => {
          const mine = T.filter(r => botSameName(r.jugador, j.nombre)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
          if (!mine.length) return `No tengo movimientos de mercado de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
          const byType = {};
          mine.forEach(r => { byType[r.tipo] = (byType[r.tipo] || 0) + 1; });
          const resumen = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t.toLowerCase()}`).join(', ');
          const last = mine[0], dest = last.equipo2 || last.equipo1;
          return `<b>${j.nombre}</b> registra <b>${mine.length}</b> movimiento${mine.length === 1 ? '' : 's'} en la NBA (${resumen}). El más reciente: <b>${last.tipo}</b>${dest ? ` — ${dest}` : ''} (${last.fecha}). ${botPlayerChip(j)}`;
        }).join('<hr class="bot-hr">');
      }
    }
  }

  // E5) EFEMÉRIDES
  {
    const gameWinner = /game ?winner|canasta ganadora|tiro ganador|sobre la bocina/.test(q);
    const efeWord = gameWinner || /efemerid|un dia como hoy|tal dia como hoy|dia como hoy|on this day|\bhitos?\b|que paso (un|el) /.test(q);
    if (efeWord && botExtra.efemerides.length) {
      const E = botExtra.efemerides;
      if (players.length) {
        return players.map(j => {
          let mine = E.filter(e => botSameName(e.jugador, j.nombre));
          if (gameWinner) mine = mine.filter(e => /GAME WINNER/.test(String(e.etiqueta || '')));
          if (!mine.length) return `No tengo ${gameWinner ? 'canastas ganadoras' : 'efemérides'} de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
          const items = mine.slice(0, 4).map(e => `<li><b>${e.fecha}</b> — ${e.hito}</li>`).join('');
          return `${gameWinner ? 'Canastas ganadoras' : 'Hitos'} de <b>${j.nombre}</b>: <ul class="bot-list">${items}</ul>${mine.length > 4 ? `<div class="bot-sub">…y ${mine.length - 4} más. <a href="efemerides.html">Ver efemérides →</a></div>` : `<div class="bot-sub"><a href="efemerides.html">Ver efemérides →</a></div>`} ${botPlayerChip(j)}`;
        }).join('<hr class="bot-hr">');
      }
      if (gameWinner) {
        const gw = E.filter(e => /GAME WINNER/.test(String(e.etiqueta || '')));
        if (!gw.length) return `No tengo canastas ganadoras registradas.`;
        return `Canastas ganadoras de españoles en la NBA: <ul class="bot-list">${gw.slice(0, 6).map(e => `<li><b>${e.jugador}</b> · ${e.fecha} — ${e.hito}</li>`).join('')}</ul><div class="bot-sub"><a href="efemerides.html">Ver todas →</a></div>`;
      }
      const today = new Date(), hits = E.filter(e => { const p = botEfeMD(e.fecha); return p && p[0] === today.getDate() && p[1] === today.getMonth() + 1; });
      if (!hits.length) return `No tengo ninguna efeméride de españoles para un día como hoy. <div class="bot-sub"><a href="efemerides.html">Ver todas las efemérides →</a></div>`;
      return `Un día como hoy en la historia de los españoles en la NBA: <ul class="bot-list">${hits.slice(0, 6).map(e => `<li><b>${e.jugador}</b> — ${e.hito}</li>`).join('')}</ul><div class="bot-sub"><a href="efemerides.html">Ver efemérides →</a></div>`;
    }
  }

  // E6) POSICIÓN / QUINTETO
  {
    const posEntry = BOT_POS.find(p => p.re.test(q));
    const askPos = /posicion|de que juega|en que posicion|juega de|que puesto|\bes (un |una )?(base|escolta|alero|pivot|ala[- ]?pivot)/.test(q);
    if (players.length && askPos) {
      return players.map(j => j.posicion
        ? `<b>${j.nombre}</b> juega de <b>${j.posicion}</b>. ${botPlayerChip(j)}`
        : `No tengo la posición de <b>${j.nombre}</b>. ${botPlayerChip(j)}`).join('<hr class="bot-hr">');
    }
    if (posEntry && !players.length) {
      const group = botPlayers.filter(j => j.posicion === posEntry.pos);
      if (!group.length) return `No tengo españoles catalogados como <b>${posEntry.label}</b>.`;
      if (superl) {
        const s = (stat && stat.kind !== 'count') ? stat : BOT_STATS.find(x => x.label === 'puntos');
        const pg = perGame || s.kind === 'pct';
        const field = pg ? s.pg : s.total;
        const ranked = group.map(j => ({ j, v: j[field] })).filter(x => x.v != null).sort((a, b) => asc ? a.v - b.v : b.v - a.v);
        if (ranked.length) {
          const top = ranked[0];
          return `El mejor <b>${posEntry.label}</b> español por <b>${s.label}</b> es <b>${top.j.nombre}</b> (${botFmt(s, top.v, pg)}).${botMore(`<ol class="bot-rank">${ranked.slice(0, 5).map(x => `<li><span>${x.j.nombre}</span><b>${botFmt(s, x.v, pg)}</b></li>`).join('')}</ol>`)} ${botPlayerChip(top.j)}`;
        }
      }
      return `Españoles que juegan o han jugado de <b>${posEntry.label}</b> en la NBA: <b>${group.map(j => j.nombre).join('</b>, <b>')}</b>. <div class="bot-chips">${group.map(botPlayerChip).join('')}</div>`;
    }
  }

  // E7) EDAD / NACIMIENTO
  {
    const bornQ = /nacio|nacimiento|cuando nacio|fecha de nacimiento|cumpleanos/.test(q);
    const ageQ = /\bedad\b|cuantos anos|que anos tiene|anos tiene/.test(q);
    const youngQ = /mas joven|menor edad|\bbenjamin\b/.test(q);
    const oldQ = /mas viejo|mas veterano|mayor edad|mas mayor/.test(q);
    if ((ageQ || bornQ) && players.length) {
      return players.map(j => {
        const b = botBirth(j), age = botAge(j);
        if (BOT_FALLECIDOS[j.id]) {
          return `<b>${j.nombre}</b> nació ${b && b.d && b.mo ? `el <b>${j.nacimiento_fecha}</b>` : `en <b>${b ? b.y : '?'}</b>`} y falleció en <b>${BOT_FALLECIDOS[j.id]}</b>. ${botPlayerChip(j)}`;
        }
        if (bornQ && !ageQ) {
          if (!b) return `No tengo la fecha de nacimiento de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
          return `<b>${j.nombre}</b> nació ${b.d && b.mo ? `el <b>${j.nacimiento_fecha}</b>` : `en <b>${b.y}</b>`}${age != null ? ` (tiene ${age} años)` : ''}. ${botPlayerChip(j)}`;
        }
        if (age == null) return `No tengo la edad de <b>${j.nombre}</b>${b && b.y ? ` (nació en ${b.y})` : ''}. ${botPlayerChip(j)}`;
        return `<b>${j.nombre}</b> tiene <b>${age} años</b> (nació el ${j.nacimiento_fecha}). ${botPlayerChip(j)}`;
      }).join('<hr class="bot-hr">');
    }
    if ((youngQ || oldQ) && !players.length) {
      const withAge = botPlayers.map(j => ({ j, a: botAge(j) })).filter(x => x.a != null);
      if (withAge.length) {
        withAge.sort((x, y) => youngQ ? x.a - y.a : y.a - x.a);
        const top = withAge[0];
        return `El español <b>${youngQ ? 'más joven' : 'más veterano'}</b> (de los que tengo fecha de nacimiento) es <b>${top.j.nombre}</b>, con <b>${top.a} años</b>. ${botPlayerChip(top.j)}${botMore(`<ol class="bot-rank">${withAge.slice(0, 5).map(x => `<li><span>${x.j.nombre}</span><b>${x.a} años</b></li>`).join('')}</ol>`)}`;
      }
    }
  }

  // E8) SUMMER LEAGUE
  if (/summer league|liga de verano/.test(q) && botExtra.summer_league.length) {
    const SL = botExtra.summer_league;
    if (players.length) {
      return players.map(j => {
        const mine = SL.filter(s => botSameName(s.jugador, j.nombre)).sort((a, b) => (a.year || 0) - (b.year || 0));
        if (!mine.length) return `No me consta que <b>${j.nombre}</b> haya jugado la Summer League. ${botPlayerChip(j)}`;
        const parts = mine.map(s => `${s.year} (${s.equipo ? teamInfo(s.equipo).name : '—'})`);
        return `<b>${j.nombre}</b> jugó la Summer League en ${parts.join(', ')}. ${botPlayerChip(j)}`;
      }).join('<hr class="bot-hr">');
    }
    if (team) {
      const who = [...new Set(SL.filter(s => s.equipo === team).map(s => s.jugador))];
      if (!who.length) return `No me consta ningún español en la Summer League de <b>${teamInfo(team).name}</b>.`;
      return `Españoles que han jugado la Summer League con <b>${teamInfo(team).name}</b>: <b>${who.join('</b>, <b>')}</b>. <div class="bot-sub"><a href="summer-league.html">Ver Summer League →</a></div>`;
    }
    const all = [...new Set(SL.map(s => s.jugador))];
    return `<b>${all.length}</b> españoles han disputado la Summer League de la NBA. <div class="bot-sub"><a href="summer-league.html">Ver el listado completo →</a></div>`;
  }

  // 4.5) TEMPORALES: preguntas sobre una temporada concreta (año detectado)
  if (year) {
    const teamQ = /equipo|franquicia|jugaba|milita|donde jug/.test(q);

    // Recuento de españoles esa temporada (o su seguimiento: "¿y un año después?")
    if (!players.length && !stat && (/cuantos|numero de|que espanoles|quienes/.test(q) || (isFollow && botCtx && botCtx.count))) {
      botPending.count = true;
      const list = botPlayers.filter(j => botSeasonMain(j, year));
      if (!list.length) return `No me consta ningún español en la NBA en la temporada <b>${drSeason(year)}</b>.`;
      return `En la temporada <b>${drSeason(year)}</b> jugaron <b>${list.length}</b> españoles en la NBA: ${list.map(j => j.nombre).join(', ')}.
        <div class="bot-chips">${list.map(botPlayerChip).join('')}</div>`;
    }

    // Ranking de una estadística en esa temporada
    if (stat && !players.length) {
      const pgMode = perGame;
      const rows = botPlayers.map(j => {
        const main = botSeasonMain(j, year);
        if (!main) return null;
        let v;
        if (stat.kind === 'pct') { if ((main.g || 0) < 15) return null; v = main[stat.pg]; }
        else if (stat.total === 'partidos') v = main.g;
        else if (stat.label === 'triples dobles') v = main.td;
        else { const per = main[stat.pg]; v = pgMode ? per : (per != null && main.g ? per * main.g : null); }
        return (v != null) ? { j, v } : null;
      }).filter(Boolean).sort((a, b) => asc ? a.v - b.v : b.v - a.v).slice(0, 5);
      if (!rows.length) return `No tengo datos de <b>${stat.label}</b> de españoles en la temporada <b>${drSeason(year)}</b>.`;
      const fmtV = v => stat.kind === 'pct' ? fmtPct(v) : ((pgMode && stat.kind === 'num') ? fmtDec1(v) : fmtEnt(v));
      const top = rows[0], second = rows[1];
      const modo = pgMode && stat.kind === 'num' ? ' por partido' : '';
      return `En la temporada <b>${drSeason(year)}</b>, el español con ${asc ? 'menos' : 'más'} <b>${stat.label}</b>${modo} fue <b>${top.j.nombre}</b>, con <b>${fmtV(top.v)}</b>${second ? `, por delante de <b>${second.j.nombre}</b> (${fmtV(second.v)})` : ''}. ${botPlayerChip(top.j)}${botMore(`<ol class="bot-rank">${rows.map(x => `<li><span>${x.j.nombre}</span><b>${fmtV(x.v)}</b></li>`).join('')}</ol>`)}`;
    }

    // Jugador + año
    if (players.length) {
      return players.map(j => {
        // Playoffs de una temporada concreta (usa playoffs_temporadas)
        if (dim === 'po') {
          const po = (j.playoffs_temporadas || []).find(t => t.year === year);
          if (!po) return `<b>${j.nombre}</b> no disputó playoffs en <b>${drSeason(year)}</b> (o no hay registro). ${botPlayerChip(j)}`;
          const tn = po.team ? ` con ${teamInfo(po.team).name}` : '';
          if (stat && stat.total === 'partidos') return `En los playoffs de <b>${drSeason(year)}</b>, <b>${j.nombre}</b> disputó <b>${fmtEnt(po.g)} partidos</b>${tn}. ${botPlayerChip(j)}`;
          if (stat && stat.kind !== 'count' && stat.pg && po[stat.pg] != null) {
            if (stat.kind === 'pct') return `En los playoffs de <b>${drSeason(year)}</b>, <b>${j.nombre}</b> promedió un <b>${fmtPct(po[stat.pg])}</b> en ${stat.label}${tn} (${fmtEnt(po.g)} partidos). ${botPlayerChip(j)}`;
            const tot = po.g ? Math.round(po[stat.pg] * po.g) : null;
            return `En los playoffs de <b>${drSeason(year)}</b>, <b>${j.nombre}</b> promedió <b>${fmtDec1(po[stat.pg])} ${stat.label} por partido</b>${tot != null ? ` (<b>${fmtEnt(tot)}</b> en total)` : ''} en ${fmtEnt(po.g)} partidos${tn}. ${botPlayerChip(j)}`;
          }
          return `En los playoffs de <b>${drSeason(year)}</b>, <b>${j.nombre}</b> promedió <b>${fmtDec1(po.pts_g)} puntos</b>, ${fmtDec1(po.rbd_g)} rebotes y ${fmtDec1(po.ast_g)} asistencias en ${fmtEnt(po.g)} partidos${tn}. ${botPlayerChip(j)}`;
        }
        const main = botSeasonMain(j, year);
        if (!main) return `<b>${j.nombre}</b> no jugó en la NBA en la temporada <b>${drSeason(year)}</b>. ${botPlayerChip(j)}`;
        const teams = botSeasonTeams(j, year);
        const teamTxt = teams.length ? teams.map(t => teamInfo(t).name).join(' y ') : '—';
        const traspaso = teams.length > 1 ? ' (temporada con traspaso)' : '';

        // Solo el equipo
        if (teamQ && !stat) {
          return `En la temporada <b>${drSeason(year)}</b>, <b>${j.nombre}</b> jugó en <b>${teamTxt}</b>${traspaso}. ${botPlayerChip(j)}`;
        }
        // Estadística concreta
        if (stat) {
          if (stat.kind === 'pct') {
            return main[stat.pg] == null ? `No tengo ${stat.label} de <b>${j.nombre}</b> en ${drSeason(year)}. ${botPlayerChip(j)}`
              : `En la temporada <b>${drSeason(year)}</b>, <b>${j.nombre}</b> promedió un <b>${fmtPct(main[stat.pg])}</b> en ${stat.label} con ${teamTxt}. ${botPlayerChip(j)}`;
          }
          if (stat.total === 'partidos') return `En la temporada <b>${drSeason(year)}</b>, <b>${j.nombre}</b> disputó <b>${fmtEnt(main.g)} partidos</b> con ${teamTxt}. ${botPlayerChip(j)}`;
          if (stat.label === 'triples dobles') return `En la temporada <b>${drSeason(year)}</b>, <b>${j.nombre}</b> firmó <b>${fmtEnt(main.td || 0)} triples dobles</b> con ${teamTxt}. ${botPlayerChip(j)}`;
          const per = main[stat.pg], tot = (per != null && main.g) ? Math.round(per * main.g) : null;
          return `En la temporada <b>${drSeason(year)}</b>, <b>${j.nombre}</b> promedió <b>${fmtDec1(per)} ${stat.label} por partido</b>${tot != null ? ` (<b>${fmtEnt(tot)}</b> en total)` : ''} en ${fmtEnt(main.g)} partidos con ${teamTxt}. ${botPlayerChip(j)}`;
        }
        // Resumen de la temporada
        return `En la temporada <b>${drSeason(year)}</b>, <b>${j.nombre}</b> promedió <b>${fmtDec1(main.pts_g)} puntos</b>, ${fmtDec1(main.rbd_g)} rebotes y ${fmtDec1(main.ast_g)} asistencias en ${fmtEnt(main.g)} partidos con ${teamTxt}${traspaso}. ${botPlayerChip(j)}`;
      }).join('<hr class="bot-hr">');
    }
  }

  // 4.7) ESTADÍSTICA FILTRADA POR EQUIPO ("puntos de Pau con Memphis", "quién metió más puntos con los Lakers")
  if (team && stat && !year) {
    const tname = teamInfo(team).name;
    const pgMode = perGame && stat.kind === 'num';
    // De un jugador concreto
    if (players.length) {
      return players.map(j => {
        const a = botTeamAgg(j, team, stat, dim);
        if (!a) return `<b>${j.nombre}</b> no jugó${dimTxt} (o no tengo registro) con <b>${tname}</b>. ${botPlayerChip(j)}`;
        if (stat.kind === 'pct') return `Con <b>${tname}</b>${dimTxt}, <b>${j.nombre}</b> promedió un <b>${fmtPct(a.v)}</b> en ${stat.label} (${fmtEnt(a.g)} partidos). ${botPlayerChip(j)}`;
        if (stat.total === 'partidos') return `<b>${j.nombre}</b> disputó <b>${fmtEnt(a.v)} partidos</b>${dimTxt} con <b>${tname}</b>. ${botPlayerChip(j)}`;
        if (stat.total === '_temporadas') return `<b>${j.nombre}</b> jugó <b>${fmtEnt(a.v)} temporada${a.v === 1 ? '' : 's'}</b>${dimTxt} con <b>${tname}</b>. ${botPlayerChip(j)}`;
        if (stat.label === 'triples dobles') return `<b>${j.nombre}</b> firmó <b>${fmtEnt(a.v)} triples dobles</b>${dimTxt} con <b>${tname}</b>. ${botPlayerChip(j)}`;
        return `Con <b>${tname}</b>${dimTxt}, <b>${j.nombre}</b> sumó <b>${fmtEnt(a.v)} ${stat.label}</b>, a una media de <b>${fmtDec1(a.per)} por partido</b> en ${fmtEnt(a.g)} partidos. ${botPlayerChip(j)}`;
      }).join('<hr class="bot-hr">');
    }
    // Ranking con ese equipo
    const rows = botPlayers.map(j => {
      const a = botTeamAgg(j, team, stat, dim);
      if (!a) return null;
      if (stat.kind === 'pct' && a.g < 15) return null;
      const v = pgMode ? a.per : a.v;
      return (v != null) ? { j, v } : null;
    }).filter(Boolean).sort((x, y) => asc ? x.v - y.v : y.v - x.v).slice(0, 5);
    if (!rows.length) return `No me consta ningún español que haya jugado${dimTxt} con <b>${tname}</b> para eso.`;
    const fmtV = v => stat.kind === 'pct' ? fmtPct(v) : (pgMode ? fmtDec1(v) : fmtEnt(v));
    const top = rows[0], second = rows[1];
    return `Con <b>${tname}</b>${dimTxt}, el español con ${asc ? 'menos' : 'más'} <b>${stat.label}</b>${pgMode ? ' por partido' : ''} es <b>${top.j.nombre}</b>, con <b>${fmtV(top.v)}</b>${second ? `, por delante de <b>${second.j.nombre}</b> (${fmtV(second.v)})` : ''}. ${botPlayerChip(top.j)}${botMore(`<ol class="bot-rank">${rows.map(x => `<li><span>${x.j.nombre}</span><b>${fmtV(x.v)}</b></li>`).join('')}</ol>`)}`;
  }

  // 5) EQUIPOS DE UN JUGADOR
  if (players.length && !team && /(que|cuantos|en que|donde).*(equipo|franquicia|jugo|jugado)|equipos (de|en que)|franquicias/.test(q)) {
    return players.map(j => {
      const ts = botTeamsOf(j);
      if (!ts.length) return `No tengo trayectoria por equipos de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
      const g = botTeamGames(j);
      const top = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
      const donde = top ? ` Donde más tiempo pasó fue en <b>${teamInfo(top[0]).name}</b> (${fmtEnt(top[1])} partidos).` : '';
      return `<b>${j.nombre}</b> jugó en <b>${ts.length}</b> equipo${ts.length > 1 ? 's' : ''} de la NBA a lo largo de su carrera: ${ts.map(t => teamInfo(t).name).join(', ')}.${donde} ${botPlayerChip(j)}`;
    }).join('<hr class="bot-hr">');
  }

  // 6) COMPARACIÓN (dos jugadores)
  if (players.length === 2 && (/vs|versus|compar|contra|\bo\b/.test(q) || stat)) {
    const [a, b] = players;
    let winA = 0, winB = 0;
    const rows = [['Puntos', 'pts_g'], ['Rebotes', 'rbd_g'], ['Asistencias', 'ast_g']].map(([l, k]) => {
      const va = a[k], vb = b[k];
      const wa = (va != null && vb != null && va > vb), wb = (va != null && vb != null && vb > va);
      if (wa) winA++; if (wb) winB++;
      return `<tr><td class="${wa ? 'bot-win' : ''}">${fmtDec1(va)}</td><th>${l} (por partido)</th><td class="${wb ? 'bot-win' : ''}">${fmtDec1(vb)}</td></tr>`;
    }).join('');
    const ra = Object.keys(botRings(a)).length, rb = Object.keys(botRings(b)).length;
    if (ra > rb) winA++; else if (rb > ra) winB++;
    const ringRow = `<tr><td class="${ra > rb ? 'bot-win' : ''}">${ra}</td><th>Anillos NBA</th><td class="${rb > ra ? 'bot-win' : ''}">${rb}</td></tr>`;
    const veredicto = winA === winB ? `Están muy igualados: empatan a <b>${winA}</b> categorías.` : `En estas categorías, <b>${winA > winB ? a.nombre : b.nombre}</b> se impone (<b>${Math.max(winA, winB)}</b> a ${Math.min(winA, winB)}).`;
    return `<div class="bot-cmp-head"><b>${a.nombre}</b><span>vs</span><b>${b.nombre}</b></div>
      <table class="bot-cmp">${rows}${ringRow}</table>
      <div class="bot-sub">${veredicto} <a href="comparador.html?a=${encodeURIComponent(a.id)}&b=${encodeURIComponent(b.id)}">Ver comparación completa →</a></div>`;
  }

  // 7) RANKING por estadística (superlativo sin jugador concreto)
  if (stat && (superl || !players.length) && !players.length) {
    const pg = perGame || stat.kind === 'pct';
    const list = botRankList(stat, dim, asc, pg);
    if (!list.length) return null;
    const top = list[0], second = list[1], third = list[2];
    const verbo = asc ? 'menos' : 'más';
    const pgTxt = pg && stat.kind === 'num' ? ' por partido' : '';
    // dato secundario del líder: si mostramos media, añadimos su total (y viceversa)
    let extra = '';
    if (stat.kind === 'num') {
      const tj = top.j, tot = (dim === 'po' ? (tj.playoffs_totales || {}) : tj)[stat.total], g = (dim === 'po' ? (tj.playoffs_totales || {}).partidos : tj.partidos);
      extra = pg ? ` (${fmtEnt(tot)} en total)` : ` (${fmtDec1((dim === 'po' ? (tj.playoffs_totales || {}) : tj)[stat.pg])} por partido en ${fmtEnt(g)} partidos)`;
    }
    const cola = second ? ` Le siguen <b>${second.j.nombre}</b> (${botFmt(stat, second.v, pg)})${third ? ` y <b>${third.j.nombre}</b> (${botFmt(stat, third.v, pg)})` : ''}.` : '';
    return `El español con ${verbo} <b>${stat.label}</b>${pgTxt}${dimTxt} es <b>${top.j.nombre}</b>, con <b>${botFmt(stat, top.v, pg)}</b>${extra}.${cola} ${botPlayerChip(top.j)}${botMore(`<ol class="bot-rank">${list.map(x => `<li><span>${x.j.nombre}</span><b>${botFmt(stat, x.v, pg)}</b></li>`).join('')}</ol>`)}`;
  }

  // 8) ESTADÍSTICA de un jugador
  if (players.length && stat) {
    return players.map(j => {
      const src = dim === 'po' ? j.playoffs_totales : j;
      if (!src || (dim === 'po' && !(src.partidos > 0))) return `No tengo datos${dimTxt} de <b>${j.nombre}</b>${dim === 'po' ? ' (no disputó playoffs o no hay registro)' : ''}. ${botPlayerChip(j)}`;
      const games = src.partidos;
      if (stat.kind === 'pct') {
        const v = src[stat.pg];
        if (v == null) return `No tengo ${stat.label}${dimTxt} de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
        return `<b>${j.nombre}</b> promedia un <b>${fmtPct(v)}</b> en ${stat.label}${dimTxt} a lo largo de su carrera (${fmtEnt(games)} partidos).${botRankSentence(j, stat.pg, dim, stat.label, dim === 'po' ? 20 : 50)} ${botPlayerChip(j)}`;
      }
      if (stat.kind === 'count') {
        const v = src[stat.total];
        if (v == null) return `No tengo ${stat.label}${dimTxt} de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
        const verbo = stat.total === 'partidos' ? 'ha disputado' : (stat.total === '_temporadas' ? 'ha jugado' : 'ha firmado');
        return `<b>${j.nombre}</b> ${verbo} <b>${fmtEnt(v)} ${stat.label}</b>${dimTxt} en la NBA.${botRankSentence(j, stat.total, dim, stat.label)} ${botPlayerChip(j)}`;
      }
      // num: total + media + puesto
      const tot = src[stat.total], avg = src[stat.pg];
      if (tot == null && avg == null) return `No tengo ${stat.label}${dimTxt} de <b>${j.nombre}</b>. ${botPlayerChip(j)}`;
      return `<b>${j.nombre}</b> suma <b>${fmtEnt(tot)} ${stat.label}</b>${dimTxt} en su carrera, a una media de <b>${fmtDec1(avg)} por partido</b> en ${fmtEnt(games)} partidos.${botRankSentence(j, stat.total, dim, stat.label)} ${botPlayerChip(j)}`;
    }).join('<hr class="bot-hr">');
  }

  // 9) JUGADORES DE UN EQUIPO
  if (team) {
    const name = teamInfo(team).name;
    const list = botPlayers.filter(j => botTeamsOf(j).includes(team))
      .map(j => ({ j, g: botTeamGames(j)[team] || 0 })).sort((a, b) => b.g - a.g);
    if (!list.length) return `No me consta ningún español que haya jugado en <b>${name}</b>. <div class="bot-sub"><a href="por-equipo.html">Ver la matriz por equipo →</a></div>`;
    const detalle = list.map(x => `${x.j.nombre} (${fmtEnt(x.g)} partidos)`).join(', ');
    return `Por <b>${name}</b> ${list.length === 1 ? 'ha pasado' : 'han pasado'} <b>${list.length}</b> español${list.length > 1 ? 'es' : ''}: ${detalle}. El que más partidos jugó allí fue <b>${list[0].j.nombre}</b>.
      <div class="bot-chips">${list.map(x => botPlayerChip(x.j)).join('')}</div>`;
  }

  // 10) CUÁNTOS ESPAÑOLES / RECUENTO GLOBAL
  if (/cuantos espanoles|cuantos jugadores|cuantos han jugado|numero de espanoles/.test(q)) {
    const conNba = botPlayers.filter(j => (j.partidos || 0) > 0);
    const primero = conNba.filter(botDebutYear).sort((a, b) => botDebutYear(a) - botDebutYear(b))[0];
    const anotador = [...conNba].sort((a, b) => (b.pts_total || 0) - (a.pts_total || 0))[0];
    return `Han jugado en la NBA <b>${conNba.length}</b> españoles con minutos en partido oficial (de ${botPlayers.length} en la base de datos, contando drafteados que no llegaron a debutar).${primero ? ` El pionero fue <b>${primero.nombre}</b> (${botDebutYear(primero)})` : ''}${anotador ? ` y el máximo anotador de todos es <b>${anotador.nombre}</b> con ${fmtEnt(anotador.pts_total)} puntos` : ''}. <div class="bot-sub"><a href="jugadores.html">Ver el directorio completo →</a></div>`;
  }

  // 11) PREMIOS de un jugador (genérico)
  if (/premio|galardon|mvp|dpoy|\broy\b|all[- ]?star|all[- ]?nba/.test(q) && players.length) {
    return players.map(j => {
      const p = j.premios || [];
      const rings = Object.keys(botRings(j)).length;
      if (!p.length && !rings) return `<b>${j.nombre}</b> no tiene premios individuales registrados. ${botPlayerChip(j)}`;
      const top = p.slice(0, 8).map(a => `${a.tipo}${a.year ? ` (${a.year})` : ''}`).join(', ');
      const anillos = rings ? ` Además, ha ganado <b>${rings}</b> anillo${rings > 1 ? 's' : ''} de la NBA.` : '';
      const lista = p.length ? ` Entre ellos: ${top}${p.length > 8 ? '…' : ''}.` : '';
      return `<b>${j.nombre}</b> acumula <b>${p.length}</b> reconocimiento${p.length === 1 ? '' : 's'} individual${p.length === 1 ? '' : 'es'} en la NBA.${lista}${anillos} ${botPlayerChip(j)}
        <div class="bot-sub"><a href="premios.html">Ver todos los premios →</a></div>`;
    }).join('<hr class="bot-hr">');
  }

  // 12) JUGADOR SUELTO → ficha resumen extendida
  if (players.length === 1) {
    const j = players[0];
    const frases = [];
    if (j.partidos) {
      const medias = [j.pts_g != null ? `${fmtDec1(j.pts_g)} puntos` : null, j.rbd_g != null ? `${fmtDec1(j.rbd_g)} rebotes` : null, j.ast_g != null ? `${fmtDec1(j.ast_g)} asistencias` : null].filter(Boolean);
      frases.push(`<b>${j.nombre}</b> ha disputado <b>${fmtEnt(j.partidos)} partidos</b> en la NBA${medias.length ? ` con promedios de <b>${medias.join(', ')}</b>` : ''}.`);
    } else {
      frases.push(`<b>${j.nombre}</b> figura en la base de datos de españoles en la NBA.`);
    }
    if (j.draft) frases.push(`Llegó a la liga en el <b>draft de ${j.draft_anio || '?'}</b> (#${j.draft_pick || '?'}${j.draft_equipo ? `, ${teamInfo(j.draft_equipo).name}` : ''}).`);
    const nteams = botTeamsOf(j).length;
    if (nteams) frases.push(`Vistió la camiseta de <b>${nteams}</b> equipo${nteams > 1 ? 's' : ''}.`);
    const rings = Object.keys(botRings(j)).length;
    if (rings) frases.push(`Ganó <b>${rings}</b> anillo${rings > 1 ? 's' : ''} de la NBA.`);
    return `${frases.join(' ')} ${botPlayerChip(j)}
      <div class="bot-sub">Puedes preguntarme por una estadística concreta (puntos, triples, asistencias…), su salario, su draft, su debut o en qué equipos jugó.</div>`;
  }

  // 13) VARIOS JUGADORES sin más contexto → desambiguación (p. ej. "Sergio", "Gasol", "Pau y Marc")
  if (players.length > 1) {
    const cmp = players.length === 2
      ? ` <div class="bot-sub"><a href="comparador.html?a=${encodeURIComponent(players[0].id)}&b=${encodeURIComponent(players[1].id)}">Comparar ${players[0].nombre} y ${players[1].nombre} →</a></div>`
      : '';
    return `Puedo darte datos de varios: ${players.map(j => j.nombre).join(', ')}. ¿Sobre cuál preguntas?
      <div class="bot-chips">${players.map(botPlayerChip).join('')}</div>
      <div class="bot-sub">Dime el nombre completo o añade una estadística (p. ej. "puntos de ${players[0].nombre}").</div>${cmp}`;
  }

  return null;
}

// Enrutado a la página correcta según el tema de la pregunta
const BOT_PAGES = [
  { re: /salario|sueldo|cuanto (ha )?gan|dinero|cobr/, page: 'salarios.html', label: 'Salarios' },
  { re: /dorsal|numero de camiseta|camiseta|numero que llev/, page: 'dorsales.html', label: 'Dorsales' },
  { re: /summer league|liga de verano/, page: 'summer-league.html', label: 'Summer League' },
  { re: /transaccion|traspas|fichaj|\bcort|movimiento de mercado|firm/, page: 'transacciones.html', label: 'Transacciones' },
  { re: /premio|galardon|all[- ]?star|all[- ]?nba|\bmvp\b|dpoy|\broy\b|quinteto/, page: 'premios.html', label: 'Premios' },
  { re: /draft|drafte|elegid en el draft/, page: 'draft.html', label: 'Draft' },
  { re: /debut|primer partido|estreno/, page: 'debut.html', label: 'Debut' },
  { re: /career high|mejor partido|maximo en un partido|mejor temporada/, page: 'career-highs.html', label: 'Career Highs' },
  { re: /comparar|comparador|cara a cara|\bvs\b|versus|enfrent/, page: 'comparador.html', label: 'Comparador' },
  { re: /linea temporal|cronolog|trayectoria/, page: 'linea-temporal.html', label: 'Línea temporal' },
  { re: /por equipo|franquicia|matriz|con cada equipo/, page: 'por-equipo.html', label: 'Por equipo' },
  { re: /por temporada|temporada a temporada|cada temporada/, page: 'temporadas.html', label: 'Temporadas' },
  { re: /test|quiz|trivial|poner a prueba/, page: 'test.html', label: 'Test' },
  { re: /ranking|carrera|lider|estadisticas de carrera|mejores numeros/, page: 'ranking.html', label: 'Carrera' },
  { re: /directorio|lista de jugadores|todos los jugadores|todos los espanoles|listado/, page: 'jugadores.html', label: 'Jugadores' },
];
function botRoute(q) { return BOT_PAGES.find(p => p.re.test(q)) || null; }

function botReply(raw) {
  if (!botPlayers || !botPlayers.length) return `Estoy cargando los datos… dame un segundo y vuelve a preguntar. 🙂`;
  // Tracking: registra cada consulta con su resultado y el texto, para ver uso y fallos en GA4
  const qTxt = String(raw || '').trim().slice(0, 100);
  const origen = location.pathname.indexOf('preguntas') >= 0 ? 'pagina' : 'widget';
  const html = botAnswer(raw);
  if (html) { botCtx = botPending; track('bot_pregunta', { resultado: 'respondida', pregunta: qTxt, origen }); return html; }   // recuerda el contexto solo si hubo respuesta
  // Si no hay respuesta con datos, intento llevar a la página adecuada
  const r = botRoute(botNorm(raw));
  if (r) { track('bot_pregunta', { resultado: 'derivada', pregunta: qTxt, destino: r.label, origen }); return `Para eso, tu mejor sitio es la página de <b>${r.label}</b>. <div class="bot-sub"><a href="${r.page}">Ir a ${r.label} →</a></div>`; }
  track('bot_pregunta', { resultado: 'sin_respuesta', pregunta: qTxt, origen });
  return `No he sabido responder a eso 🤔. Puedo darte <b>estadísticas</b> (puntos, rebotes, triples…), <b>rankings</b> ("¿quién tiene más…?"), <b>anillos</b>, <b>salario</b>, <b>draft</b>, <b>debut</b>, <b>equipos</b> y <b>comparaciones</b> — o llevarte a la sección que busques. También puedes encadenar: "¿y la siguiente temporada?", "¿y Marc Gasol?", "¿y en playoffs?".`;
}

function botAppend(role, html) {
  const log = document.getElementById('bot-log');
  const el = document.createElement('div');
  el.className = 'bot-msg bot-msg--' + role;
  el.innerHTML = html;
  log.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function botSubmit(text) {
  const t = (text || '').trim();
  if (!t) return;
  botAppend('q', t.replace(/</g, '&lt;'));
  const answer = botReply(t);
  botAppend('a', answer);
}

async function initPreguntasPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  botPrepPlayers(data.jugadores, data);
  await botLoadExtras();
  document.getElementById('hero-sub').textContent = `Escribe una pregunta y te respondo con los datos de los ${botPlayers.length} españoles de la NBA.`;

  const sug = document.getElementById('bot-suggest');
  if (sug) sug.innerHTML = BOT_EXAMPLES.map(e => `<button type="button" class="bot-eg">${e}</button>`).join('');
  document.querySelectorAll('.bot-eg').forEach(b => b.addEventListener('click', () => { botSubmit(b.textContent); document.getElementById('bot-input').value = ''; }));

  const form = document.getElementById('bot-form'), input = document.getElementById('bot-input');
  form.addEventListener('submit', e => { e.preventDefault(); botSubmit(input.value); input.value = ''; input.focus(); });

  botAppend('a', `¡Hola! 👋 Soy <b>PEPU</b>, el buscador de <b>Españoles en la NBA</b>. Pregúntame lo que quieras: estadísticas, anillos, salarios, draft, trayectoria, <b>parejas</b> y <b>duelos cara a cara</b>. Toca un ejemplo para empezar.`);
}

// ── WIDGET DE CHAT FLOTANTE (burbuja abajo, en todas las páginas) ──
let cwOpen = false, cwGreeted = false;

function buildChatWidget() {
  if (document.getElementById('cw-root')) return;
  const here = location.pathname.split('/').pop() || 'index.html';
  if (here === 'preguntas.html') return;   // esa página ya ES el buscador
  const root = document.createElement('div');
  root.id = 'cw-root';
  root.innerHTML = `
    <button class="cw-launch" id="cw-launch" aria-label="Abrir asistente" aria-expanded="false" aria-haspopup="dialog">
      <svg class="cw-ico-chat" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      <svg class="cw-ico-close" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
    <div class="cw-panel" id="cw-panel" hidden role="dialog" aria-label="Asistente de Españoles en la NBA">
      <div class="cw-head">
        <span class="cw-dot"></span>
        <span class="cw-title">PEPU</span>
        <a class="cw-expand" href="preguntas.html" title="Abrir en pantalla completa" aria-label="Abrir en pantalla completa">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </a>
        <button class="cw-min" id="cw-min" type="button" title="Minimizar" aria-label="Minimizar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>
        </button>
      </div>
      <div class="cw-log" id="cw-log" aria-live="polite"></div>
      <div class="cw-suggest" id="cw-suggest"></div>
      <form class="cw-bar" id="cw-form" autocomplete="off">
        <input type="text" id="cw-input" class="cw-input" placeholder="Escribe tu pregunta…" aria-label="Escribe tu pregunta">
        <button type="submit" class="cw-send" aria-label="Enviar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </form>
    </div>`;
  document.body.appendChild(root);
  document.getElementById('cw-launch').addEventListener('click', cwToggle);
  document.getElementById('cw-min').addEventListener('click', cwToggle);
  document.getElementById('cw-form').addEventListener('submit', e => {
    e.preventDefault();
    const i = document.getElementById('cw-input');
    cwSubmit(i.value); i.value='';
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cwOpen) cwToggle(); });
}

async function cwEnsureData() {
  if (botPlayers.length) return;
  try { const d = await loadData(); buildPlayerIds(d.jugadores); botPrepPlayers(d.jugadores, d); await botLoadExtras(); } catch (e) { botPlayers = []; }
}

async function cwToggle() {
  const panel = document.getElementById('cw-panel'), launch = document.getElementById('cw-launch');
  if (!panel) return;
  cwOpen = !cwOpen;
  panel.hidden = !cwOpen;
  // La burbuja solo abre: mientras el panel está abierto se oculta (se cierra con el botón − o Escape)
  launch.hidden = cwOpen;
  launch.setAttribute('aria-expanded', String(cwOpen));
  if (!cwOpen) return;
  await cwEnsureData();
  if (!cwGreeted) {
    cwGreeted = true;
    cwAppend('a', `¡Hola! 👋 Pregúntame sobre los españoles en la NBA —estadísticas, anillos, salarios, comparaciones— o dime qué buscas y te llevo a la página.`);
    const sug = document.getElementById('cw-suggest');
    const egs = ['¿Quién ha metido más puntos?', 'Anillos de Pau Gasol', 'Salarios', 'Pau vs Marc'];
    sug.innerHTML = egs.map(e => `<button type="button" class="cw-eg">${e}</button>`).join('');
    sug.querySelectorAll('.cw-eg').forEach(b => b.addEventListener('click', () => cwSubmit(b.textContent)));
  }
  document.getElementById('cw-input').focus();
}

function cwAppend(role, html) {
  const log = document.getElementById('cw-log');
  const el = document.createElement('div');
  el.className = 'cw-msg cw-msg--' + role;
  el.innerHTML = html;
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

function cwSubmit(text) {
  const t = (text || '').trim();
  if (!t) return;
  const sug = document.getElementById('cw-suggest'); if (sug) sug.innerHTML = '';
  cwAppend('q', t.replace(/</g, '&lt;'));
  cwAppend('a', botReply(t));
}

// ══════════════════════════════════════════════
// PÁGINA EFEMÉRIDES ("Un día como hoy")
// Cruza transacciones + debuts + drafts por día del año.
// ══════════════════════════════════════════════
let efmEvents = [], efmMonth = 1, efmDay = 1, efmToday = { m: 1, d: 1 };
let efmPlMap = {}, efmDaySet = new Set(), efmCalMonth = null, efmCalOpen = false, efmCurrentList = [];

// Meses en inglés (abreviados) para admitir fechas tipo "10 jan 2015" o "30 april 2010"
const MESES_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function efmParseShort(s) {
  const m = String(s || '').match(/(\d{1,2})\s+([a-zA-ZñÑáéíóúÁÉÍÓÚ]{3,})\s+(\d{4})/);
  if (!m) return null;
  const mo3 = drNorm(m[2]).slice(0, 3);
  let mo = MESES.indexOf(mo3);
  if (mo < 0) mo = MESES_EN.indexOf(mo3);
  if (mo < 0) return null;
  return { d: +m[1], m: mo + 1, year: +m[3] };
}
function efmTeamName(x) { if (!x) return ''; const c = String(x).toUpperCase(); return TEAM_INFO[c] ? TEAM_INFO[c].name : x; }
// Texto de una efeméride del Sheet: escapa HTML y permite **negrita**
function efmFmtText(s) { return String(s || '').replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
// Clase de color de la etiqueta de una efeméride (insensible a mayúsculas/acentos)
function efmTagClass(tag) {
  const t = drNorm(tag || '');
  if (/anillo|campe|titulo|title|finales/.test(t)) return 'efm-tag--anillo';
  if (/all.?star|premio|mvp|galardon/.test(t)) return 'efm-tag--allstar';
  if (/serie|debut.*playoff/.test(t)) return 'efm-tag--serie';
  // Violeta (jugadas y partidos destacados: fusión de violeta + azul)
  if (/game.?winner|tiro ganador|bocina|buzzer|jugada histor|jugadon|triple.?doble|partido|destacad|actuacion/.test(t)) return 'efm-tag--winner';
  // Rojo (lesiones + cortes, waivers, renuncias y opciones rechazadas)
  if (/lesion|cortad|waiver|renuncia|rechaza|opcion|opción/.test(t)) return 'efm-tag--lesion';
  // Naranja (récords, primeras veces y debut)
  if (/franquicia|career.?high|record|milestone|marca|primera vez|primer espanol|primer español|debut/.test(t)) return 'efm-tag--record';
  // Azul (movimientos: draft, traspaso y firmas)
  if (/draft|traspas|firma|renov|agente libre|extensi|sign|contrato/.test(t)) return 'efm-tag--partido';
  // Turquesa (cumpleaños / nacimiento)
  if (/cumple|nacimiento|nace/.test(t)) return 'efm-tag--cumple';
  return 'efm-tag--hito';
}
// Extrae el ID de un vídeo de YouTube desde varias formas de URL (o el propio ID)
function efmYtId(url) {
  const s = String(url || '').trim();
  const m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|[?&]v=)([\w-]{11})/);
  if (m) return m[1];
  if (/^[\w-]{11}$/.test(s)) return s;
  return '';
}
// Sustituye el botón por el reproductor embebido de YouTube (carga diferida al hacer clic)
function efmPlayVideo(btn, id) {
  const wrap = document.createElement('div');
  wrap.className = 'efm-video';
  wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}" title="Vídeo de la efeméride" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  btn.replaceWith(wrap);
}
// Handles de X (Twitter) por jugador. Clave: nombre normalizado (drNorm). Valor: handle SIN @.
// Rellenar solo con handles verificados — un handle equivocado etiquetaría a otra persona.
const TW_HANDLES = {
  'pau gasol': 'paugasol',
  'marc gasol': 'MarcGasol',
  'serge ibaka': 'sergeibaka',
  'juan carlos navarro': 'jcnavarroworld',
  'ricky rubio': 'rickyrubio9',
  'santi aldama': 'santialdama',
  'rudy fernandez': 'rudy5fernandez',
  'jose m. calderon': 'JmCalderon',
  'jorge garbajosa': 'jgarbajosa15',
  'willy hernangomez': 'willyhg94',
  'alex abrines': 'alexabrines',
  'juancho hernangomez': 'juanchiviris41',
  'sergio rodriguez': 'SergioRodriguez',
  'hugo gonzalez': 'hugoglezz_',
  'victor claver': 'Victor_Claver',
  'usman garuba': 'Usmangaruba',
  'baba miller': '_bmillxr_',
  'sergio de larrea': 'Laaarry_14',
  'albert miralles': 'Miralles10',
  'sergio llull': '23Llull',
  'dani diez': 'danidiez11',
  'juan nunez': 'juaan_ng',
};
function efmHandle(nombre) {
  const h = TW_HANDLES[drNorm(nombre || '')];
  return h ? ('@' + String(h).replace(/^@/, '')) : '';
}

// Comparte la efeméride en X: abre el compositor con el texto + enlace.
// El enlace lleva ?m=&d= para abrir justo ese día en la página de efemérides.
function efmShare(btn, i) {
  const e = (efmCurrentList || [])[i];
  if (!e) return;
  track('compartir', { metodo: 'twitter', origen: 'efemerides', tipo: e.type || e.tipo || '' });
  const tmp = document.createElement('div');
  tmp.innerHTML = e.html || '';
  let texto = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
  // Si el jugador tiene handle verificado, usamos el @ en vez de su nombre.
  const handle = efmHandle(e.player);
  if (handle && e.player) texto = texto.split(e.player).join(handle);
  const fechaTxt = `${efmDay} de ${MESES_LARGOS[efmMonth - 1]} de ${e.year}`;
  const url = `${location.origin}${location.pathname}?m=${efmMonth}&d=${efmDay}`;
  const prefijo = `📅 ${fechaTxt} — `;
  const sufijo = ' #NBA #EspañolesNBA (vía @alejandroggo)';
  // X/Twitter cuenta ~280 caracteres y la URL ocupa 23 (+1 espacio); recortamos
  // solo el texto de la efeméride para que el prefijo, los hashtags/vía y la URL quepan siempre.
  const presupuesto = 280 - 24 - prefijo.length - sufijo.length;
  let cuerpoTexto = texto;
  if (cuerpoTexto.length > presupuesto) cuerpoTexto = cuerpoTexto.slice(0, presupuesto - 1).trimEnd() + '…';
  const cuerpo = `${prefijo}${cuerpoTexto}${sufijo}`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(cuerpo + '\n\n' + url)}`;
  window.open(intent, '_blank', 'noopener,noreferrer');
}

// Extrae la cifra del contrato de las notas (ej. "$17,2M x 3", "$300K x 2")
function efmMoney(s) { const m = String(s || '').match(/\$\s?[\d.,]+\s?[MK]?(?:\s?[x×]\s?\d+)?/i); return m ? m[0].replace(/\s+/g, ' ').trim() : ''; }
function efmPick(s) { const m = String(s || '').match(/#\s?(\d+)/); return m ? ('#' + m[1]) : ''; }
// Línea de estadísticas destacadas del debut (pts / reb / ast)
function efmDebutStat(p) {
  const parts = [];
  if (p.pts != null) parts.push(`<b>${p.pts}</b> punto${p.pts === 1 ? '' : 's'}`);
  if (p.rbd != null) parts.push(`<b>${p.rbd}</b> rebote${p.rbd === 1 ? '' : 's'}`);
  if (p.ast != null) parts.push(`<b>${p.ast}</b> asistencia${p.ast === 1 ? '' : 's'}`);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
}
// Frase natural para una transacción según su tipo
function efmTransText(t) {
  const j = `<b>${plLink(t.jugador, t.jugador)}</b>`, e1 = t.equipo1 || '', e2 = t.equipo2 || '';
  const money = efmMoney(t.notas || ''), por = money ? ` por <b>${money}</b>` : '';
  const tp = drNorm(t.tipo || '');
  if (/traspas/.test(tp)) return e2 ? `${j} es traspasado de ${e1} a ${e2}.` : `${j} es traspasado${e1 ? ` a ${e1}` : ''}.`;
  if (/agente libre/.test(tp)) return `${j} firma como agente libre con ${e1}${por}.`;
  if (/contrato rookie/.test(tp)) return `${j} firma su contrato rookie con ${e1}${por}.`;
  if (/renovaci/.test(tp)) return `${j} renueva con ${e1}${por}.`;
  if (/extensi/.test(tp)) return `${j} firma una extensión de contrato con ${e1}${por}.`;
  if (/cortad|waived/.test(tp)) return `${e1 || 'Su equipo'} corta a ${j}.`;
  if (/waivers/.test(tp)) return `${j} es reclamado en waivers por ${e1}.`;
  if (/renuncia de derechos/.test(tp)) return `${e1 || 'Su equipo'} renuncia a los derechos de ${j}.`;
  if (/rechaza opci.*jugador/.test(tp)) return `${j} rechaza su opción de jugador con ${e1} y queda agente libre.`;
  if (/rechaza opci.*equipo/.test(tp)) return `${e1 || 'Su equipo'} no ejerce la opción sobre ${j}, que queda agente libre.`;
  if (/draft/.test(tp)) { const pk = efmPick(t.notas); return `${j} es elegido en el draft${e1 ? ` por ${e1}` : ''}${pk ? ` con el pick ${pk}` : ''}.`; }
  const eqs = [e1, e2].filter(Boolean);
  return `${j}${eqs.length ? ` · ${eqs.join(' → ')}` : ''}`;
}

// Efemérides añadidas A MANO (hitos, récords, momentos históricos que no salen
// de los datos automáticos). Formato: { d, m, year, text, tag? }  (tag por defecto: 'Hito')
// El texto admite HTML (p. ej. <b>…</b>).
const EFM_MANUAL = [
  { d: 14, m: 6, year: 2009, text: '<b>Pau Gasol</b> conquista su <b>primer anillo NBA</b> con Los Angeles Lakers (Finales ante Orlando), primer español campeón de la NBA.' },
  { d: 17, m: 6, year: 2010, text: '<b>Pau Gasol</b> gana su <b>segundo anillo</b> con los Lakers en el séptimo partido de las Finales ante Boston.' },
  { d: 13, m: 6, year: 2019, text: '<b>Marc Gasol</b> y <b>Serge Ibaka</b> se proclaman campeones con los Toronto Raptors, primer título de la franquicia.' },
];

function efmBuild(data) {
  const ev = [];
  const draftKey = new Set();
  // Mapa nombre -> datos de foto del jugador (para el avatar de cada efeméride)
  efmPlMap = {};
  (data.jugadores || []).forEach(j => { efmPlMap[drNorm(j.nombre)] = { id: j.id, foto: j.foto_url || '', bref: j.bref_id || '', nombre: j.nombre }; });
  // Efemérides manuales: preferimos la pestaña del Sheet (data.efemerides);
  // si el bot aún no la exporta, se usan las de EFM_MANUAL como respaldo.
  let manual;
  if (data.efemerides && data.efemerides.length) {
    manual = data.efemerides.map(e => {
      const s = String(e.fecha || '').trim();
      let dm = null, m;
      if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) dm = { year: +m[1], m: +m[2], d: +m[3] };
      else if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) { let y = +m[3]; if (y < 100) y += 2000; dm = { d: +m[1], m: +m[2], year: y }; }
      else dm = efmParseShort(s);
      return dm ? { d: dm.d, m: dm.m, year: dm.year, tag: (e.tipo || e.etiqueta || 'Hito'), jugador: String(e.jugador || '').trim(), text: efmFmtText(e.texto || e.text || e.hito || ''), video: String(e.video || e.video_url || e.youtube || e.yt || '').trim() } : null;
    }).filter(x => x && x.text);
  } else {
    manual = EFM_MANUAL;
  }
  manual.forEach(e => {
    if (!(e.d && e.m && e.year)) return;
    let html = e.text;
    const jug = e.jugador || '';
    // Si hay columna JUGADOR y el texto no empieza ya por ese nombre, anteponemos el
    // nombre enlazado y pasamos a minúscula la primera letra del texto (que suele ser un verbo).
    if (jug) {
      const plain = drNorm(e.text.replace(/<[^>]+>/g, ''));
      if (!plain.startsWith(drNorm(jug))) {
        html = `<b>${plLink(jug, jug)}</b> ` + e.text.replace(/^([A-Za-zÁÉÍÓÚÑáéíóúñ])/, c => c.toLowerCase());
      }
    }
    ev.push({ d: e.d, m: e.m, year: e.year, kind: 'hito', tag: e.tag || 'Hito', html, video: e.video || '', player: jug });
  });
  // Debuts y drafts (fuente principal del draft, con nº de pick)
  (data.jugadores || []).forEach(j => {
    const p = j.primer_partido;
    if (p && p.fecha) {
      const dt = efmParseShort(p.fecha);
      if (dt) {
        const eq = p.equipo ? ` con ${efmTeamName(p.equipo)}` : '';
        const riv = p.rival ? ` ante ${efmTeamName(p.rival)}` : '';
        const st = efmDebutStat(p);
        ev.push({ ...dt, kind: 'debut', tag: 'Debut', player: j.nombre, video: String(p.video || p.video_url || '').trim(), html: `<b>${plLink(j.nombre, j.nombre)}</b> debutó en la NBA${eq}${riv}${st ? `, firmando ${st}` : ''}.` });
      }
    }
    if (j.draft && j.draft_fecha) {
      const dt = efmParseShort(j.draft_fecha);
      if (dt) { ev.push({ ...dt, kind: 'draft', tag: 'Draft', player: j.nombre, video: String(j.draft_video || j.video_draft || '').trim(), html: `<b>${plLink(j.nombre, j.nombre)}</b> es elegido en el draft${j.draft_equipo ? ` por ${efmTeamName(j.draft_equipo)}` : ''}${j.draft_pick ? ` con el pick #${j.draft_pick}` : ''}.` }); draftKey.add(drNorm(j.nombre) + '|' + dt.year); }
    }
    // Cumpleaños: "un día como hoy nació X"
    if (j.nacimiento_fecha) {
      const dt = efmParseShort(j.nacimiento_fecha);
      if (dt) ev.push({ ...dt, kind: 'cumple', tag: 'Cumpleaños', player: j.nombre, video: '', html: `Nace <b>${plLink(j.nombre, j.nombre)}</b>.` });
    }
  });
  // Transacciones (evitando duplicar el draft ya recogido arriba)
  (data.transacciones || []).forEach(t => {
    const m = String(t.fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return;
    if (/draft/i.test(t.tipo || '') && draftKey.has(drNorm(t.jugador) + '|' + (+m[1]))) return;
    ev.push({ m: +m[2], d: +m[3], year: +m[1], kind: 'trans', tag: t.tipo, player: t.jugador || '', video: String(t.video || t.video_url || t.youtube || t.yt || '').trim(), html: efmTransText(t),
      detail: { jugador: t.jugador || '', fecha: t.fecha || '', tipo: t.tipo || '', equipo1: t.equipo1 || '', equipo2: t.equipo2 || '', otros: t.otros || '', notas: t.notas || '' } });
  });
  return ev;
}

function efmNextDay() {
  for (let i = 1; i <= 366; i++) {
    const dt = new Date(2000, efmMonth - 1, efmDay); dt.setDate(dt.getDate() + i);
    const mm = dt.getMonth() + 1, dd = dt.getDate();
    if (efmEvents.some(e => e.m === mm && e.d === dd)) return { m: mm, d: dd };
  }
  return null;
}
function efmShift(delta) { const dt = new Date(2000, efmMonth - 1, efmDay); dt.setDate(dt.getDate() + delta); efmMonth = dt.getMonth() + 1; efmDay = dt.getDate(); efmCalMonth = efmMonth; renderEfm(); }
function efmGoto(m, d) { efmMonth = m; efmDay = d; efmCalMonth = m; renderEfm(); }

// Fecha completa "DD de mes de AAAA" a partir de una fecha ISO o texto corto
function efmFullDate(s) {
  const iso = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  let d;
  if (iso) d = { d: +iso[3], m: +iso[2], year: +iso[1] };
  else d = efmParseShort(s);
  return d ? `${d.d} de ${MESES_LARGOS[d.m - 1]} de ${d.year}` : String(s || '');
}

// Popup con los detalles completos de una transacción (efeméride)
function efmShowDetail(i) {
  const e = efmCurrentList[i];
  if (!e || !e.detail) return;
  const d = e.detail;
  const rows = [];
  const add = (label, val) => { if (val) rows.push(`<div class="efm-md-row"><span class="efm-md-k">${label}</span><span class="efm-md-v">${val}</span></div>`); };
  const esTraspaso = /traspas/i.test(d.tipo || '');
  add('Jugador', d.jugador ? `<b>${plLink(d.jugador, escapeHtml(d.jugador))}</b>` : '');
  add('Fecha', efmFullDate(d.fecha));
  add('Tipo', escapeHtml(d.tipo));
  add(esTraspaso && d.equipo2 ? 'Desde' : 'Equipo', efmTeamName(d.equipo1));
  if (d.equipo2) add(esTraspaso ? 'Hacia' : 'Equipo 2', efmTeamName(d.equipo2));
  add('Otros implicados', escapeHtml(d.otros));
  add('Notas', escapeHtml(d.notas));

  const modal = document.createElement('div');
  modal.className = 'efm-modal';
  modal.innerHTML = `
    <div class="efm-modal-box" role="dialog" aria-modal="true" aria-label="Detalles de la transacción">
      <button type="button" class="efm-modal-close" aria-label="Cerrar">×</button>
      <div class="efm-modal-head"><span class="tr-tipo ${efmTagClass(e.tag)}">${e.tag}</span><span class="efm-modal-year">${e.year}</span></div>
      <p class="efm-modal-title">${e.html}</p>
      <div class="efm-md-rows">${rows.join('')}</div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = ev => { if (ev.key === 'Escape') close(); };
  modal.addEventListener('click', ev => { if (ev.target === modal) close(); });
  modal.querySelector('.efm-modal-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
}

// Foto (enlazada) del jugador de una efeméride; cae a iniciales si no hay foto
function efmPhoto(name) {
  const j = efmPlMap[drNorm(name || '')];
  if (!j) return '';
  const fb = j.foto || (j.bref ? BREF_HEADSHOTS + '/' + j.bref + '.jpg' : '');
  const inner = (j.id || fb) ? `<img loading="lazy" class="efm-photo-img" ${agFotoSrc2(j.id, fb)} onerror="agImgHide(this)" alt="">` : avatarHtml(j.nombre, 'efm-photo-img');
  return `<a class="efm-photo" href="${jugadorHref(j.id)}" aria-label="${j.nombre}">${inner}</a>`;
}

// ── Calendario para saltar a cualquier fecha ──
function efmToggleCal() {
  efmCalOpen = !efmCalOpen;
  const cal = document.getElementById('efm-cal');
  if (cal) cal.hidden = !efmCalOpen;
  const btn = document.getElementById('efm-cal-btn');
  if (btn) btn.classList.toggle('active', efmCalOpen);
  if (efmCalOpen) renderEfmCal();
}
function efmCalShift(delta) { efmCalMonth = ((efmCalMonth - 1 + delta + 12) % 12) + 1; renderEfmCal(); }
function renderEfmCal() {
  const cal = document.getElementById('efm-cal');
  if (!cal) return;
  if (efmCalMonth == null) efmCalMonth = efmMonth;
  const mIdx = efmCalMonth;
  const nDays = new Date(2000, mIdx, 0).getDate();          // 2000 es bisiesto → sale el 29-feb
  const offset = (new Date(2000, mIdx - 1, 1).getDay() + 6) % 7;  // lunes primero
  let cells = '';
  for (let i = 0; i < offset; i++) cells += '<span class="efm-cal-empty"></span>';
  for (let d = 1; d <= nDays; d++) {
    const has = efmDaySet.has(mIdx + '-' + d);
    const sel = (mIdx === efmMonth && d === efmDay);
    const today = (mIdx === efmToday.m && d === efmToday.d);
    cells += `<button type="button" class="efm-cal-day${has ? ' has' : ''}${sel ? ' efm-day-sel' : ''}${today ? ' today' : ''}" onclick="efmGoto(${mIdx},${d})">${d}</button>`;
  }
  cal.innerHTML = `
    <div class="efm-cal-head">
      <button type="button" class="efm-arrow efm-arrow-sm" onclick="efmCalShift(-1)" aria-label="Mes anterior">‹</button>
      <span class="efm-cal-title">${MESES_LARGOS[mIdx - 1]}</span>
      <button type="button" class="efm-arrow efm-arrow-sm" onclick="efmCalShift(1)" aria-label="Mes siguiente">›</button>
    </div>
    <div class="efm-cal-dow"><span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span></div>
    <div class="efm-cal-grid">${cells}</div>`;
}

function renderEfm() {
  const list = efmEvents.filter(e => e.m === efmMonth && e.d === efmDay).sort((a, b) => b.year - a.year || a.tag.localeCompare(b.tag));
  const nowY = new Date().getFullYear();
  const fecha = `${efmDay} de ${MESES_LARGOS[efmMonth - 1]}`;
  document.getElementById('efm-date').textContent = fecha;
  document.getElementById('efm-count').textContent = list.length ? `${list.length} efeméride${list.length === 1 ? '' : 's'}` : '';
  const isToday = efmMonth === efmToday.m && efmDay === efmToday.d;
  document.getElementById('efm-today').classList.toggle('active', isToday);
  if (efmCalOpen) renderEfmCal();
  const body = document.getElementById('efm-list');
  if (!list.length) {
    const next = efmNextDay();
    body.innerHTML = `<li class="efm-empty">No hay efemérides registradas el <b>${fecha}</b>.${next ? ` <button type="button" class="toggle-chip" onclick="efmGoto(${next.m},${next.d})">Ir al ${next.d} de ${MESES_LARGOS[next.m - 1]} →</button>` : ''}</li>`;
    return;
  }
  efmCurrentList = list;
  body.innerHTML = list.map((e, i) => {
    const ago = nowY - e.year;
    const tags = String(e.tag || '').split(/\s*[,/|]\s*/).map(s => s.trim()).filter(Boolean);
    const tagsHtml = (tags.length ? tags : ['Hito']).map(tg => `<span class="tr-tipo ${efmTagClass(tg)} efm-tag">${tg}</span>`).join(' ');
    const vid = e.video ? efmYtId(e.video) : '';
    const videoBtn = vid ? `<button type="button" class="efm-video-btn" onclick="efmPlayVideo(this,'${vid}')"><span class="efm-video-ico">▶</span> Ver vídeo</button>` : '';
    const detailBtn = e.detail ? `<button type="button" class="efm-detail-btn" onclick="efmShowDetail(${i})">Ver detalles</button>` : '';
    const shareBtn = `<button type="button" class="efm-share-btn" onclick="efmShare(this,${i})" aria-label="Compartir en X"><span class="efm-share-ico"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></span> Compartir en X</button>`;
    const acts = `<div class="efm-acts">${videoBtn}${detailBtn}${shareBtn}</div>`;
    const photo = efmPhoto(e.player);
    return `<li class="efm-item">
      <div class="efm-year">${e.year}<span class="efm-ago">${ago > 0 ? `hace ${ago} año${ago === 1 ? '' : 's'}` : 'este año'}</span></div>
      ${photo}
      <div class="efm-body"><span class="efm-tags">${tagsHtml}</span><p class="efm-text">${e.html}</p>${acts}</div>
    </li>`;
  }).join('');
}

async function initEfemeridesPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  efmEvents = efmBuild(data);
  const now = new Date();
  efmToday = { m: now.getMonth() + 1, d: now.getDate() };
  // Fecha inicial: parámetros ?m=&d= (enlaces desde el perfil) o el día de hoy
  const params = new URLSearchParams(location.search);
  const pm = +params.get('m'), pd = +params.get('d');
  if (pm >= 1 && pm <= 12 && pd >= 1 && pd <= 31) { efmMonth = pm; efmDay = pd; }
  else { efmMonth = efmToday.m; efmDay = efmToday.d; }
  efmCalMonth = efmMonth;
  efmDaySet = new Set(efmEvents.map(e => e.m + '-' + e.d));
  document.getElementById('hero-sub').textContent = `Un día como hoy en la historia de los españoles en la NBA · ${efmEvents.length} efemérides en ${efmDaySet.size} días`;
  document.getElementById('efm-prev').onclick = () => efmShift(-1);
  document.getElementById('efm-next').onclick = () => efmShift(1);
  document.getElementById('efm-today').onclick = () => { efmMonth = efmToday.m; efmDay = efmToday.d; efmCalMonth = efmMonth; renderEfm(); };
  const calBtn = document.getElementById('efm-cal-btn');
  if (calBtn) calBtn.onclick = efmToggleCal;
  renderEfm();
}

// ══════════════════════════════════════════════
// PÁGINA QUINTETO IDEAL (arrastrar jugadores a la pista)
// ══════════════════════════════════════════════
const QNT_SLOTS = [
  { key: 'PG', label: 'PG', left: '50%', top: '76%' },
  { key: 'SG', label: 'SG', left: '81%', top: '54%' },
  { key: 'SF', label: 'SF', left: '19%', top: '54%' },
  { key: 'PF', label: 'PF', left: '69%', top: '23%' },
  { key: 'C',  label: 'C',  left: '31%', top: '23%' },
];
let qntAll = [], qntById = {}, qntSel = null;
const qntState = { PG: null, SG: null, SF: null, PF: null, C: null };   // slot → id
const qntYear = { PG: null, SG: null, SF: null, PF: null, C: null };    // slot → año (null = carrera)

function qntThumb(j, cls) {
  return (j.id || j.foto_url || j.bref_id) ? `<img loading="lazy" ${agFotoSrc(j)} onerror="agImgHide(this)" alt="" class="${cls}">` : avatarHtml(j.nombre, cls);
}
function qntShort(nombre) { const p = nombre.split(' '); return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : nombre; }
function qntPlayers() { return QNT_SLOTS.map(s => qntState[s.key]).filter(Boolean).map(id => qntById[id]); }
function qntRings(j) { return Object.keys(TL_ANILLOS[drNorm(j.nombre)] || {}).length; }
function qntAllStars(j) { return (j.premios || []).filter(p => /all[\s-]?star/i.test(p.tipo) && !/concurso|weekend|skills|three|rising|celebr/i.test(p.tipo)).length; }
function qntSeasons(j) { return j.temporadas || new Set((j.temporadas_data || []).filter(t => t.year && (t.team || '').toUpperCase() !== 'TOT').map(t => t.year)).size; }
function qntSeasonYears(j) { return [...new Set((j.temporadas_data || []).filter(t => t.year).map(t => t.year))].sort((a, b) => a - b); }
function qntSeasonRow(j, year) { const rows = (j.temporadas_data || []).filter(t => t.year === year); return rows.find(t => String(t.team || '').toUpperCase() === 'TOT') || rows[0] || null; }
function qntSeasonShort(year) { return drSeason(year).slice(2); }   // "06-07"
// Estadística de un slot (carrera o una temporada concreta)
function qntStat(id, year) {
  const j = qntById[id]; if (!j) return null;
  if (!year) return { pts_g: j.pts_g || 0, rbd_g: j.rbd_g || 0, ast_g: j.ast_g || 0, stl_g: j.stl_g || 0, blk_g: j.blk_g || 0, tres_g: j.tres_g || 0, pts_total: j.pts_total || 0, rings: qntRings(j), allstars: qntAllStars(j) };
  const r = qntSeasonRow(j, year) || {}, g = r.g || 0;
  return { pts_g: r.pts_g || 0, rbd_g: r.rbd_g || 0, ast_g: r.ast_g || 0, stl_g: r.stl_g || 0, blk_g: r.blk_g || 0, tres_g: r.tres_g || 0,
    pts_total: Math.round((r.pts_g || 0) * g),
    rings: (TL_ANILLOS[drNorm(j.nombre)] || {})[year] ? 1 : 0,
    allstars: (j.premios || []).filter(p => /all[\s-]?star/i.test(p.tipo) && !/concurso|weekend|skills|three|rising|celebr/i.test(p.tipo) && p.year === year).length };
}
function qntStatsList() { return QNT_SLOTS.filter(s => qntState[s.key]).map(s => qntStat(qntState[s.key], qntYear[s.key])); }

function qntAssign(slot, id) {
  const eraCompleto = QNT_SLOTS.every(s => qntState[s.key]);
  // si el jugador ya está en otra posición, se mueve (y suelta su temporada)
  QNT_SLOTS.forEach(s => { if (qntState[s.key] === id) { qntState[s.key] = null; qntYear[s.key] = null; } });
  qntState[slot] = id; qntYear[slot] = null;
  qntSel = null;
  // Solo al pasar de incompleto a completo: señal de que acaba de montar una alineación.
  if (!eraCompleto && QNT_SLOTS.every(s => qntState[s.key])) track('montar_quinteto', { completo: true });
  qntSyncUrl(); qntRender();
}
function qntClear(slot) { qntState[slot] = null; qntYear[slot] = null; qntSyncUrl(); qntRender(); }
function qntReset() { QNT_SLOTS.forEach(s => { qntState[s.key] = null; qntYear[s.key] = null; }); qntSel = null; qntSyncUrl(); qntRender(); }

function qntSyncUrl() { QNT_SLOTS.forEach(s => { const id = qntState[s.key]; updateUrlParam(s.key.toLowerCase(), id ? (id + (qntYear[s.key] ? ':' + qntYear[s.key] : '')) : ''); }); }

function qntRenderSlots() {
  document.getElementById('qnt-slots').innerHTML = QNT_SLOTS.map(s => {
    const id = qntState[s.key], j = id ? qntById[id] : null;
    const yrs = j ? qntSeasonYears(j) : [];
    const sel = (j && yrs.length) ? `<select class="qnt-season" data-slot="${s.key}" aria-label="Temporada de ${j.nombre}">
        <option value=""${!qntYear[s.key] ? ' selected' : ''}>Carrera</option>
        ${yrs.map(y => `<option value="${y}"${qntYear[s.key] === y ? ' selected' : ''}>${qntSeasonShort(y)}</option>`).join('')}
      </select>` : '';
    const inner = j
      ? `<span class="qnt-slot-face">${qntThumb(j, 'qnt-slot-img')}</span><span class="qnt-slot-name">${qntShort(j.nombre)}</span>${sel}<button type="button" class="qnt-slot-x" data-slot="${s.key}" aria-label="Quitar">✕</button>`
      : `<span class="qnt-slot-plus">＋</span>`;
    return `<div class="qnt-slot${j ? ' filled' : ''}${qntSel ? ' droppable' : ''}" data-slot="${s.key}" style="left:${s.left};top:${s.top}">
      ${inner}<span class="qnt-slot-pos">${s.label}</span></div>`;
  }).join('');
}

function qntRenderPool(filter) {
  const nq = drNorm((filter || '').trim());
  const used = new Set(Object.values(qntState).filter(Boolean));
  document.getElementById('qnt-pool').innerHTML = qntAll
    .filter(j => !nq || drNorm(j.nombre).includes(nq))
    .map(j => `<button type="button" class="qnt-card${used.has(j.id) ? ' used' : ''}${qntSel === j.id ? ' sel' : ''}" draggable="true" data-id="${j.id}">
      <span class="qnt-card-thumb">${qntThumb(j, 'qnt-card-img')}</span><span class="qnt-card-name">${j.nombre}</span></button>`).join('')
    || `<p class="td-muted" style="padding:1rem">Sin resultados.</p>`;
}

function qntRenderStats() {
  const L = qntStatsList(), n = L.length, el = document.getElementById('qnt-stats');
  if (!n) {
    el.innerHTML = `<div class="qnt-stats-empty"><h2>Tu quinteto ideal</h2><p>Arrastra (o toca) jugadores a cada posición de la pista. Podrás elegir su carrera o una temporada concreta, y calcularé las estadísticas combinadas.</p></div>`;
    return;
  }
  const sum = k => L.reduce((s, v) => s + (v[k] || 0), 0);
  const pg = [['PTS', sum('pts_g')], ['REB', sum('rbd_g')], ['AST', sum('ast_g')], ['ROB', sum('stl_g')], ['TAP', sum('blk_g')], ['3PM', sum('tres_g')]]
    .map(([l, v]) => statBox(l, fmtDec1(v))).join('');
  const tot = [statBox('Puntos', fmtEnt(sum('pts_total'))), statBox('Anillos', fmtEnt(sum('rings'))), statBox('All-Star', fmtEnt(sum('allstars')))].join('');
  const lineup = QNT_SLOTS.filter(s => qntState[s.key]).map(s => {
    const j = qntById[qntState[s.key]], y = qntYear[s.key];
    return `<li><span class="qnt-lu-pos">${s.label}</span> ${plLink(j.nombre, j.nombre)}${y ? ` <span class="qnt-lu-yr">${drSeason(y)}</span>` : ''}</li>`;
  }).join('');
  el.innerHTML = `<div class="qnt-stats-head"><h2>Tu quinteto ideal</h2><span class="qnt-stats-n">${n}/5</span></div>
    <p class="qnt-stats-lead">Este quinteto promediaría <b>${fmtDec1(sum('pts_g'))} puntos</b>, ${fmtDec1(sum('rbd_g'))} rebotes y ${fmtDec1(sum('ast_g'))} asistencias por partido.</p>
    <h3 class="qnt-stats-sub">Promedios combinados</h3><div class="stat-grid qnt-grid">${pg}</div>
    <h3 class="qnt-stats-sub">Palmarés</h3><div class="stat-grid qnt-grid">${tot}</div>
    <ol class="qnt-lineup">${lineup}</ol>`;
}

function qntRender() { qntRenderSlots(); qntRenderPool(document.getElementById('qnt-search').value); qntRenderStats(); qntWireDynamic(); }

// Listeners de elementos que se regeneran (slots y cartas)
function qntWireDynamic() {
  document.querySelectorAll('#qnt-pool .qnt-card').forEach(card => {
    const id = card.dataset.id;
    card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('click', () => {
      const inSlot = Object.values(qntState).includes(id);
      if (inSlot) { QNT_SLOTS.forEach(s => { if (qntState[s.key] === id) qntState[s.key] = null; }); qntSel = null; qntSyncUrl(); qntRender(); return; }
      qntSel = (qntSel === id) ? null : id; qntRender();
    });
  });
  document.querySelectorAll('#qnt-slots .qnt-slot').forEach(slot => {
    const key = slot.dataset.slot;
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('over'));
    slot.addEventListener('drop', e => { e.preventDefault(); slot.classList.remove('over'); const id = e.dataTransfer.getData('text/plain'); if (id && qntById[id]) qntAssign(key, id); });
    slot.addEventListener('click', e => {
      if (e.target.classList.contains('qnt-slot-x')) return;   // la ✕ tiene su propio handler
      if (qntSel) qntAssign(key, qntSel);
    });
  });
  document.querySelectorAll('.qnt-slot-x').forEach(x => x.addEventListener('click', e => { e.stopPropagation(); qntClear(x.dataset.slot); }));
  document.querySelectorAll('#qnt-slots .qnt-season').forEach(se => {
    se.addEventListener('click', e => e.stopPropagation());       // no dispara la asignación del slot
    se.addEventListener('mousedown', e => e.stopPropagation());
    se.addEventListener('change', e => { qntYear[se.dataset.slot] = e.target.value ? parseInt(e.target.value, 10) : null; qntSyncUrl(); qntRenderStats(); });
  });
}

async function initQuintetoPage() {
  let data;
  try { data = await loadData(); }
  catch (e) { document.getElementById('hero-sub').textContent = 'Error al cargar los datos'; return; }
  buildPlayerIds(data.jugadores);
  qntAll = (data.jugadores || []).slice().sort((a, b) => (b.pts_total || 0) - (a.pts_total || 0));
  qntById = {}; qntAll.forEach(j => qntById[j.id] = j);
  document.getElementById('hero-sub').textContent = `Monta tu quinteto histórico de españoles y descubre sus números combinados`;

  // Restaurar desde la URL (formato id  o  id:año)
  const params = new URLSearchParams(location.search);
  QNT_SLOTS.forEach(s => {
    const raw = params.get(s.key.toLowerCase()); if (!raw) return;
    const [id, yr] = raw.split(':');
    if (qntById[id]) { qntState[s.key] = id; if (yr && qntSeasonYears(qntById[id]).includes(+yr)) qntYear[s.key] = +yr; }
  });

  document.getElementById('qnt-search').addEventListener('input', e => qntRenderPool(e.target.value));
  document.getElementById('qnt-reset').addEventListener('click', qntReset);
  document.getElementById('qnt-download').addEventListener('click', qntDownload);
  document.getElementById('qnt-share').addEventListener('click', qntShare);
  qntRender();
}

// ── Quinteto: exportar como imagen (canvas, sin librerías) ──
// Carga una imagen del mismo origen; resuelve null si no existe (para no romper la exportación).
function qntLoadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function qntAvatarColor(name) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff; return `hsl(${h % 360} 45% 42%)`; }
function qntInitials(name) { const p = name.trim().split(/\s+/); return (((p[0] || '')[0] || '') + ((p[p.length - 1] || '')[0] || '')).toUpperCase(); }

async function qntBuildImage() {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { }
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const CO = { bg: '#0f1117', court: '#1b2230', line: 'rgba(255,255,255,.28)', accent: '#f87171', text: '#e8eaf0', muted: '#8892a4' };
  x.fillStyle = CO.bg; x.fillRect(0, 0, W, H);
  x.textAlign = 'center';
  x.fillStyle = CO.accent; x.font = "italic 700 62px 'DM Serif Display', serif"; x.fillText('Mi Quinteto', W / 2, 92);
  x.fillStyle = CO.muted; x.font = "600 25px Inter, sans-serif"; x.fillText('ESPAÑOLES EN LA NBA', W / 2, 132);

  const cw = 720, ch = Math.round(cw * 340 / 300), cx = (W - cw) / 2, cy = 170;
  const M = (sx, sy) => [cx + sx / 300 * cw, cy + sy / 340 * ch];
  const R = v => v / 300 * cw;
  x.fillStyle = CO.court; x.beginPath(); x.roundRect(cx, cy, cw, ch, 16); x.fill();
  x.strokeStyle = CO.line; x.lineWidth = 3; x.beginPath(); x.roundRect(cx, cy, cw, ch, 16); x.stroke();
  const seg = (a, b, d, e) => { const p = M(a, b), q = M(d, e); x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); };
  const circ = (a, b, r) => { const p = M(a, b); x.beginPath(); x.arc(p[0], p[1], R(r), 0, 7); x.stroke(); };
  seg(130, 20, 170, 20); circ(150, 29, 7);
  const k = M(118, 20), k2 = M(182, 128); x.strokeRect(k[0], k[1], k2[0] - k[0], k2[1] - k[1]);
  circ(150, 128, 30);
  seg(40, 20, 40, 128); seg(260, 20, 260, 128);
  { const rim = M(150, 29); x.beginPath(); x.arc(rim[0], rim[1], R(148), 42 * Math.PI / 180, 138 * Math.PI / 180, false); x.stroke(); }
  seg(3, 316, 297, 316); circ(150, 316, 28);

  // Fotos locales (mismo origen → sin "taint"). Si no existen, se usan iniciales.
  const imgs = {};
  await Promise.all(QNT_SLOTS.map(async s => { const id = qntState[s.key]; if (id) imgs[id] = await qntLoadImg(`img/players/${id}.jpg`); }));

  QNT_SLOTS.forEach(s => {
    const px = cx + parseFloat(s.left) / 100 * cw, py = cy + parseFloat(s.top) / 100 * ch;
    const id = qntState[s.key], j = id ? qntById[id] : null, r = 46, im = id ? imgs[id] : null, yr = id ? qntYear[s.key] : null;
    x.beginPath(); x.arc(px, py, r, 0, 7);
    if (j && im) {
      x.save(); x.clip();
      const sc = Math.max(2 * r / im.naturalWidth, 2 * r / im.naturalHeight), dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
      x.drawImage(im, px - dw / 2, py - dh / 2, dw, dh); x.restore();
      x.beginPath(); x.arc(px, py, r, 0, 7); x.lineWidth = 3; x.strokeStyle = CO.accent; x.stroke();
    } else if (j) {
      x.fillStyle = qntAvatarColor(j.nombre); x.fill();
      x.lineWidth = 3; x.strokeStyle = CO.accent; x.stroke();
      x.fillStyle = '#fff'; x.font = "800 30px Inter, sans-serif"; x.textBaseline = 'middle'; x.fillText(qntInitials(j.nombre), px, py + 2); x.textBaseline = 'alphabetic';
    } else {
      x.setLineDash([6, 6]); x.strokeStyle = CO.line; x.lineWidth = 2; x.stroke(); x.setLineDash([]);
      x.fillStyle = CO.muted; x.font = "700 34px Inter"; x.textBaseline = 'middle'; x.fillText('+', px, py + 2); x.textBaseline = 'alphabetic';
    }
    if (j) {
      x.fillStyle = CO.text; x.font = "700 21px Inter, sans-serif"; x.fillText(qntShort(j.nombre), px, py + r + 26);
      if (yr) { x.fillStyle = CO.muted; x.font = "600 16px Inter, sans-serif"; x.fillText(drSeason(yr), px, py + r + 47); }
      x.fillStyle = CO.accent; x.font = "800 17px Inter"; x.fillText(s.label, px, py + r + (yr ? 68 : 48));
    } else {
      x.fillStyle = CO.muted; x.font = "800 17px Inter"; x.fillText(s.label, px, py + r + 28);
    }
  });

  const L = qntStatsList(), sum = k => L.reduce((s, v) => s + (v[k] || 0), 0);
  const fy = cy + ch + 96;
  [['PTS', fmtDec1(sum('pts_g'))], ['REB', fmtDec1(sum('rbd_g'))], ['AST', fmtDec1(sum('ast_g'))]].forEach((cc, i) => {
    const colx = W / 2 + (i - 1) * 300;
    x.fillStyle = CO.accent; x.font = "400 72px 'Bebas Neue', sans-serif"; x.fillText(cc[1], colx, fy);
    x.fillStyle = CO.muted; x.font = "600 22px Inter"; x.fillText(cc[0], colx, fy + 34);
  });
  x.fillStyle = CO.text; x.font = "600 25px Inter"; x.fillText(`${sum('rings')} anillos · ${sum('allstars')} All-Star · ${L.length}/5`, W / 2, fy + 92);
  // Pie: web (izq.) + hashtag (dcha.)
  x.textAlign = 'left'; x.fillStyle = CO.text; x.font = "700 22px Inter, sans-serif"; x.fillText('espanoles-nba.alejandroggo.com', 60, H - 42);
  x.textAlign = 'right'; x.fillStyle = CO.accent; x.font = "700 22px Inter, sans-serif"; x.fillText('@alejandroggo · #EspañolesNBA', W - 60, H - 42);
  x.textAlign = 'center';
  return c;
}

function qntBlob(c) { return new Promise(res => c.toBlob(res, 'image/png')); }
async function qntDownload() {
  if (!qntPlayers().length) { alert('Añade algún jugador a la pista primero.'); return; }
  const c = await qntBuildImage(), bl = await qntBlob(c);
  const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'mi-quinteto-espanol.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function qntDescargaImagen(bl) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'mi-quinteto-espanol.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function qntShare() {
  if (!qntPlayers().length) { alert('Añade algún jugador a la pista primero.'); return; }
  track('compartir', { metodo: 'twitter', origen: 'quinteto', jugadores: qntPlayers().length });
  const txt = 'Mi quinteto histórico de españoles en la NBA 🏀 #EspañolesNBA (vía @alejandroggo)\n\n' + location.href;
  const xIntent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(txt);
  const isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  // Escritorio: abrir X dentro del gesto (si no, el navegador bloquea el popup) y descargar la imagen aparte.
  if (!isTouch) {
    window.open(xIntent, '_blank', 'noopener,noreferrer');
    try { const c = await qntBuildImage(); qntDescargaImagen(await qntBlob(c)); } catch (e) { }
    return;
  }

  // Móvil/táctil: menú nativo con la imagen adjunta (permite elegir X con la foto).
  try {
    const c = await qntBuildImage(); const bl = await qntBlob(c);
    const file = new File([bl], 'mi-quinteto-espanol.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: txt });
      return;
    }
    qntDescargaImagen(bl);
  } catch (e) { if (e && e.name === 'AbortError') return; }
  window.open(xIntent, '_blank', 'noopener,noreferrer');
}

// ══════════════════════════════════════════════
// GRÁFICOS — creador de gráficos (líneas y dispersión) sobre data.json
// ══════════════════════════════════════════════
// Capas: datos (funciones puras, testeadas en tools/test-graficos.mjs) → escena
// (series/puntos en unidades de datos) → maquetación en píxeles (grLayout) →
// dibujo en SVG (pantalla) o canvas (PNG). Nada se interpola ni se inventa: una
// temporada sin partidos no se dibuja y un % sin muestra suficiente se oculta.

const GR_MAX = 6;   // jugadores destacados a la vez (6 colores distinguibles + 6 formas)
const GR_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'tri-down', 'plus'];
// Colores del PNG (siempre fondo oscuro, como el resto de imágenes). En pantalla
// salen de las variables --gr-c1…6 de style.css (claro/oscuro).
const GR_PNG_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];

// Catálogo: solo campos que existen en data.json. kind: pg (por partido),
// pct (porcentaje 0-1), tot (total de temporada/carrera), count (partidos), age.
const GR_METRICS = [
  { key: 'pts_g', short: 'PTS', name: 'Puntos por partido', kind: 'pg', tot: 'pts_total' },
  { key: 'rbd_g', short: 'REB', name: 'Rebotes por partido', kind: 'pg', tot: 'rbd_total' },
  { key: 'ast_g', short: 'AST', name: 'Asistencias por partido', kind: 'pg', tot: 'ast_total' },
  { key: 'stl_g', short: 'ROB', name: 'Robos por partido', kind: 'pg', tot: 'stl_total' },
  { key: 'blk_g', short: 'TAP', name: 'Tapones por partido', kind: 'pg', tot: 'blk_total' },
  { key: 'tres_g', short: '3PM', name: 'Triples anotados por partido', kind: 'pg', tot: 'tres_total' },
  { key: 'min_g', short: 'MIN', name: 'Minutos por partido', kind: 'pg', tot: 'min_total' },
  { key: 'tov_g', short: 'TOV', name: 'Pérdidas por partido', kind: 'pg', tot: 'tov_total' },
  { key: 'pf_g', short: 'PF', name: 'Faltas personales por partido', kind: 'pg', tot: 'pf_total' },
  { key: 'fg_pct', short: 'FG%', name: 'Porcentaje de tiros de campo', kind: 'pct', made: 'fgm_g', minAtt: 50, minAttCar: 150 },
  { key: 'tres_pct', short: '3P%', name: 'Porcentaje de triples', kind: 'pct', made: 'tres_g', minAtt: 20, minAttCar: 50 },
  { key: 'ft_pct', short: 'FT%', name: 'Porcentaje de tiros libres', kind: 'pct', made: 'ftm_g', minAtt: 20, minAttCar: 50 },
  { key: 'g', short: 'PJ', name: 'Partidos jugados', kind: 'count' },
  { key: 'pts_tot', short: 'PTS', name: 'Puntos totales', kind: 'tot', src: 'pts_g', tot: 'pts_total' },
  { key: 'rbd_tot', short: 'REB', name: 'Rebotes totales', kind: 'tot', src: 'rbd_g', tot: 'rbd_total' },
  { key: 'ast_tot', short: 'AST', name: 'Asistencias totales', kind: 'tot', src: 'ast_g', tot: 'ast_total' },
];
const GR_EDAD = { key: 'edad', short: 'Edad', name: 'Edad', kind: 'age' };   // solo eje X (temporadas)
function grMetric(key) { return key === 'edad' ? GR_EDAD : (GR_METRICS.find(m => m.key === key) || null); }

function grFmt(m, v) {
  if (v == null || !isFinite(v)) return '—';
  if (m.kind === 'pct') return fmtPct(v);
  if (m.kind === 'pg') return fmtDec1(v);
  return fmtEnt(v);
}

// ── Datos por temporada ──
// Una fila por temporada (la TOT en años con traspaso, nunca la suma de parciales).
// Descarta filas sin año (year 0) y sin partidos (g 0: temporada aún sin empezar).
function grSeasonRows(j, comp) {
  const src = (comp === 'po' ? j.playoffs_temporadas : j.temporadas_data) || [];
  const by = {}, teams = {};
  src.forEach(t => {
    const y = t && t.year;
    if (!y) return;
    const isTot = String(t.team || '').toUpperCase() === 'TOT';
    if (!isTot && t.team) (teams[y] = teams[y] || []).push(t.team);
    if (!(y in by) || isTot) by[y] = t;
  });
  return Object.keys(by).map(Number).sort((a, b) => a - b)
    .filter(y => (by[y].g || 0) > 0)
    .map(y => ({ year: y, g: by[y].g, teams: (teams[y] || []).join(' / ') || by[y].team || '', t: by[y] }));
}

// Nº de temporada en la NBA (temporada regular) para cada año: {year: 1, 2, …}
function grSeasonIndex(j) {
  const idx = {};
  grSeasonRows(j, 'reg').forEach((r, i) => { idx[r.year] = i + 1; });
  return idx;
}

// Fecha de nacimiento "6 jul 1980" → {y, m (0-11), d}
function grBirth(j) {
  const m = String(j.nacimiento_fecha || '').trim().toLowerCase().match(/^(\d{1,2})\s+([a-zñ]{3})[a-z]*\.?\s+(\d{4})$/);
  if (!m) return null;
  const mes = MESES.indexOf(m[2]);
  return mes < 0 ? null : { y: +m[3], m: mes, d: +m[1] };
}
// Edad en la temporada (criterio Basketball Reference: edad a 1 de febrero del año en que termina)
function grAge(j, year) {
  const b = grBirth(j);
  if (!b || !year) return null;
  return year - b.y - ((b.m > 1 || (b.m === 1 && b.d > 1)) ? 1 : 0);
}

// Intentos estimados de una fila = anotados/partido × partidos / %. Null si no se puede saber.
function grEstAttempts(t, m) {
  const pct = t[m.key], made = t[m.made];
  if (pct == null || made == null || !t.g) return null;
  if (pct === 0) return null;   // 0 anotados: no hay forma de saber cuántos intentó
  return made * t.g / pct;
}

// Valor de una métrica en una fila de temporada → { value, hidden } (hidden = % con muestra pequeña)
function grSeasonValue(r, m, opts) {
  const t = r.t;
  if (m.kind === 'count') return { value: r.g };
  if (m.kind === 'tot') return { value: t[m.src] != null ? Math.round(t[m.src] * r.g) : null };
  const v = t[m.key];
  if (v == null) return { value: null };
  if (m.kind === 'pct' && opts && opts.muestra) {
    const att = grEstAttempts(t, m);
    if (att == null || att < m.minAtt) return { value: null, hidden: true };
  }
  return { value: v };
}

// ── Datos de carrera (o de un tramo) ──
// Reutiliza cmpAgg (comparador) sobre las temporadas válidas: con la carrera completa usa
// los totales oficiales; con un tramo, totales = Σ(por partido × partidos) y % = anotados/intentos.
function grCareerAgg(j, comp, from, to) {
  const rows = grSeasonRows(j, comp);
  if (!rows.length) return null;
  const inR = rows.filter(r => (!from || r.year >= from) && (!to || r.year <= to));
  if (!inR.length) return null;
  const off = comp === 'po' ? j.playoffs_totales : j;
  const pseudo = Object.assign({}, off || {}, { temporadas_data: rows.map(r => r.t) });
  // Sin totales oficiales (no debería pasar) → forzar cálculo desde temporadas
  const full = !!off && inR.length === rows.length;
  const agg = cmpAgg(pseudo, full ? null : inR[0].year, full ? null : inR[inR.length - 1].year);
  const att = {};
  GR_METRICS.filter(m => m.kind === 'pct').forEach(m => {
    let a = 0, ok = false;
    inR.forEach(r => { const x = grEstAttempts(r.t, m); if (x != null) { a += x; ok = true; } });
    att[m.key] = ok ? a : null;
  });
  return { agg, g: agg.partidos || 0, n: inR.length, from: inR[0].year, to: inR[inR.length - 1].year, full, att };
}

// Valor de carrera: los "por partido" salen de total ÷ partidos (nunca de sumar promedios)
function grCareerValue(c, m, opts) {
  const a = c.agg, G = c.g;
  if (!G) return { value: null };
  if (m.kind === 'count') return { value: G };
  if (m.kind === 'tot') return { value: a[m.tot] != null ? Math.round(a[m.tot]) : null };
  if (m.kind === 'pg') return { value: a[m.tot] != null ? a[m.tot] / G : null };
  if (m.kind === 'pct') {
    const v = a[m.key];
    if (v == null) return { value: null };
    if (opts && opts.muestra) { const at = c.att[m.key]; if (at == null || at < m.minAttCar) return { value: null, hidden: true }; }
    return { value: v };
  }
  return { value: null };
}

// Jugadores con al menos una temporada NBA con partidos (los que se pueden graficar)
function grEligible(jugadores) {
  return (jugadores || []).filter(j => grSeasonRows(j, 'reg').length)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
// Temporadas disponibles (unión de todos los jugadores) en la competición
function grYears(players, comp) {
  const s = new Set();
  (players || []).forEach(j => grSeasonRows(j, comp).forEach(r => s.add(r.year)));
  return [...s].sort((a, b) => a - b);
}

// ── Estado (configuración del gráfico) y URL ──
const GR_TIPOS = ['lineas', 'dispersion'];
// Caras de los jugadores como marcas: en líneas, al final de cada línea; en dispersión,
// solo cuando cada punto es una carrera (por temporadas se repetiría la misma cara decenas de veces)
function grUsesFaces(st) { return !!st.caras && (st.tipo === 'lineas' || st.u === 'carrera'); }
// Recorte de las fotos locales (img/players/<id>.jpg, 420×560): cuadrado centrado en la cara
const GR_FACE = { x: 45, y: 55, s: 330, w: 420, h: 560 };
const GR_EJES_X = ['temp', 'n', 'edad'];
function grDefaults() {
  return {
    tipo: 'lineas', comp: 'reg', ids: ['pau-gasol', 'marc-gasol'],
    m: 'pts_g', ex: 'temp',                    // líneas
    u: 'carrera', x: 'ast_g', y: 'pts_g',      // dispersión
    desde: null, hasta: null, ming: null,      // ming null = valor por defecto del contexto
    ctx: true, nom: true, ley: true, muestra: true, caras: true, t: '',
  };
}
// Opciones de mínimo de partidos según unidad (temporada/carrera) y competición
function grMinOptions(st) {
  const carrera = st.tipo === 'dispersion' && st.u === 'carrera';
  if (carrera) return st.comp === 'po' ? [0, 10, 25, 50, 100] : [0, 50, 100, 250, 500];
  return st.comp === 'po' ? [0, 3, 5, 10, 15] : [0, 10, 20, 41, 58];
}
function grMinDefault(st) {
  if (st.tipo === 'dispersion' && st.u === 'temporada') return st.comp === 'po' ? 5 : 20;
  return 0;
}
function grMinG(st) { return st.ming == null ? grMinDefault(st) : st.ming; }

// Valida y completa un estado (de la URL o de la interfaz). Nunca lanza: lo inválido vuelve al defecto.
function grNormalize(raw, players) {
  const d = grDefaults(), s = Object.assign({}, d, raw || {});
  if (!GR_TIPOS.includes(s.tipo)) s.tipo = d.tipo;
  if (s.comp !== 'po') s.comp = 'reg';
  if (s.u !== 'temporada') s.u = 'carrera';
  if (!GR_EJES_X.includes(s.ex)) s.ex = d.ex;
  const ids = new Set((players || []).map(j => j.id));
  s.ids = [...new Set((Array.isArray(s.ids) ? s.ids : []).filter(id => ids.has(id)))].slice(0, GR_MAX);
  if (!grMetric(s.m) || s.m === 'edad') s.m = d.m;
  if (!grMetric(s.y) || s.y === 'edad') s.y = d.y;
  if (!grMetric(s.x) || (s.x === 'edad' && s.u !== 'temporada')) s.x = d.x;
  if (s.x === s.y) s.y = s.x === 'pts_g' ? 'ast_g' : 'pts_g';
  const years = grYears(players, s.comp);
  const yr = v => { const n = Number(v); return v != null && v !== '' && years.includes(n) ? n : null; };
  s.desde = yr(s.desde); s.hasta = yr(s.hasta);
  if (s.desde && s.hasta && s.desde > s.hasta) { const t = s.desde; s.desde = s.hasta; s.hasta = t; }
  const mg = s.ming == null || s.ming === '' ? null : Number(s.ming);
  s.ming = grMinOptions(s).includes(mg) ? mg : null;
  ['ctx', 'nom', 'ley', 'muestra', 'caras'].forEach(k => { s[k] = s[k] !== false; });
  s.t = String(s.t || '').replace(/\s+/g, ' ').trim().slice(0, 90);
  return s;
}

function grParseState(params, players) {
  const g = k => params.get(k);
  const flag = k => g(k) === '0' ? false : true;
  return grNormalize({
    tipo: g('tipo'), comp: g('comp'),
    ids: params.has('j') ? String(g('j') || '').split(',').map(x => x.trim()).filter(Boolean) : grDefaults().ids,
    m: g('m'), ex: g('ex'), u: g('u'), x: g('x'), y: g('y'),
    desde: g('desde'), hasta: g('hasta'), ming: g('min'),
    ctx: flag('ctx'), nom: flag('nom'), ley: flag('ley'), muestra: flag('muestra'), caras: flag('caras'), t: g('t'),
  }, players);
}

// Solo escribe en la URL lo que difiere del defecto (más jugadores y tipo siempre)
const GR_URL_KEYS = ['tipo', 'j', 'comp', 'm', 'ex', 'u', 'x', 'y', 'desde', 'hasta', 'min', 'ctx', 'nom', 'ley', 'muestra', 'caras', 't'];
function grStateToParams(s) {
  const d = grDefaults(), p = new URLSearchParams();
  p.set('tipo', s.tipo);
  p.set('j', s.ids.join(','));
  if (s.comp !== d.comp) p.set('comp', s.comp);
  if (s.tipo === 'lineas') {
    if (s.m !== d.m) p.set('m', s.m);
    if (s.ex !== d.ex) p.set('ex', s.ex);
  } else {
    p.set('u', s.u); p.set('x', s.x); p.set('y', s.y);
    if (!s.ctx) p.set('ctx', '0');
    if (!s.nom && s.u === 'carrera') p.set('nom', '0');
  }
  if (s.desde) p.set('desde', s.desde);
  if (s.hasta) p.set('hasta', s.hasta);
  if (s.ming != null) p.set('min', s.ming);
  if (!s.ley) p.set('ley', '0');
  if (!s.muestra) p.set('muestra', '0');
  if (!s.caras && grUsesFaces(Object.assign({}, s, { caras: true }))) p.set('caras', '0');
  if (s.t) p.set('t', s.t);
  return p;
}

// ── Escena: lo que se dibuja, en unidades de datos ──
function grSeasonLbl(y) { return drSeason(y); }
function grRangeTxt(st, players) {
  const ys = grYears(players, st.comp);
  if (!st.desde && !st.hasta) return '';
  const a = st.desde || ys[0], b = st.hasta || ys[ys.length - 1];
  return a === b ? `Temporada ${grSeasonLbl(a)}` : `${grSeasonLbl(a)} a ${grSeasonLbl(b)}`;
}
function grAutoTitle(st, sel) {
  const names = sel.map(j => j.nombre);
  const vs = names.length <= 3 ? names.join(' vs ') : `${names.length} jugadores`;
  if (st.tipo === 'lineas') return `${grMetric(st.m).name}${vs ? ' · ' + vs : ''}`;
  const x = grMetric(st.x), y = grMetric(st.y);
  return `${y.name} frente a ${x.name.charAt(0).toLowerCase() + x.name.slice(1)}`;
}

// slots: {id: 0-5} (color y forma fijos por jugador); si falta, el orden de selección
function grBuildScene(st, players, slots) {
  const sel = st.ids.map(id => players.find(p => p.id === id)).filter(Boolean);
  const slotOf = (j, i) => (slots && slots[j.id] != null) ? slots[j.id] : i;
  const warnings = [], compTxt = st.comp === 'po' ? 'Playoffs' : 'Temporada regular';
  const inRange = y => (!st.desde || y >= st.desde) && (!st.hasta || y <= st.hasta);
  const ming = grMinG(st);
  const opts = { muestra: st.muestra };
  let hidden = 0;
  const noData = j => `${j.nombre} no ${st.comp === 'po' ? 'disputó playoffs' : 'jugó'} en la NBA`;
  const rangeTxt = grRangeTxt(st, players);
  const notes = [];
  if (st.comp === 'reg') notes.push('En temporadas con traspaso se usa el total de la temporada (TOT), no la suma de promedios.');
  const scene = { tipo: st.tipo, title: st.t || grAutoTitle(st, sel), autoTitle: !st.t, warnings, notes, series: [], points: [], legend: [] };

  if (st.tipo === 'lineas') {
    const m = grMetric(st.m);
    scene.faces = grUsesFaces(st);
    const xName = st.ex === 'edad' ? 'Edad (a 1 de febrero de cada temporada)' : st.ex === 'n' ? 'Nº de temporada en la NBA' : 'Temporada';
    sel.forEach((j, i) => {
      const rows = grSeasonRows(j, st.comp);
      const slot = slotOf(j, i), shape = GR_SHAPES[slot % GR_SHAPES.length];
      scene.legend.push({ id: j.id, name: j.nombre, slot, shape });
      if (!rows.length) { warnings.push(noData(j)); scene.series.push({ id: j.id, name: j.nombre, slot, shape, points: [], segs: [] }); return; }
      const idx = grSeasonIndex(j);
      const pts = [];
      rows.filter(r => inRange(r.year) && r.g >= ming).forEach(r => {
        const v = grSeasonValue(r, m, opts);
        if (v.hidden) hidden++;
        if (v.value == null) return;
        const x = st.ex === 'edad' ? grAge(j, r.year) : st.ex === 'n' ? idx[r.year] : r.year;
        if (x == null) return;
        pts.push({ x, y: v.value, year: r.year, teams: r.teams, g: r.g, id: j.id, name: j.nombre, slot, shape });
      });
      if (st.ex === 'edad' && !grBirth(j)) warnings.push(`${j.nombre}: falta su fecha de nacimiento`);
      else if (!pts.length) warnings.push(`${j.nombre}: sin temporadas con datos en este filtro`);
      // Temporadas sin participación → la línea se corta (no se interpola)
      const segs = [];
      pts.forEach((p, k) => { if (!k || p.x - pts[k - 1].x > 1) segs.push([]); segs[segs.length - 1].push(p); });
      scene.series.push({ id: j.id, name: j.nombre, slot, shape, points: pts, segs });
    });
    const all = scene.series.flatMap(s => s.points);
    scene.x = { kind: 'int', metric: { key: st.ex, kind: st.ex === 'temp' ? 'season' : 'int' }, name: xName,
      fmt: st.ex === 'temp' ? grSeasonLbl : (v => String(v)), vals: all.map(p => p.x) };
    scene.y = { kind: 'num', metric: m, name: m.name, fmt: v => grFmt(m, v), vals: all.map(p => p.y), zero: m.kind !== 'pct' };
    const unit = 'Cada punto = una temporada' + (ming ? ` (mín. ${ming} PJ)` : '');
    scene.subtitle = [compTxt, rangeTxt, unit].filter(Boolean).join(' · ');
    if (gaps(scene.series)) notes.push('Las líneas se cortan en las temporadas sin partidos.');
    if (st.ex === 'edad') notes.push('Edad a 1 de febrero de cada temporada (criterio de Basketball Reference).');
    if (!sel.length) scene.empty = 'Añade al menos un jugador para dibujar el gráfico.';
    else if (!all.length) scene.empty = 'No hay datos para esta combinación.';
  } else {
    const mx = grMetric(st.x), my = grMetric(st.y);
    const selIds = new Map(sel.map((j, i) => [j.id, j]));
    sel.forEach((j, i) => { const slot = slotOf(j, i); scene.legend.push({ id: j.id, name: j.nombre, slot, shape: GR_SHAPES[slot % GR_SHAPES.length] }); });
    const pool = st.ctx ? players : sel;
    const ctxPts = [], selPts = [];
    pool.forEach(j => {
      const isSel = selIds.has(j.id);
      const li = scene.legend.find(l => l.id === j.id);
      const slot = isSel ? li.slot : null, shape = isSel ? li.shape : 'circle';
      const push = p => (isSel ? selPts : ctxPts).push(Object.assign(p, { id: j.id, name: j.nombre, slot, shape, sel: isSel }));
      if (st.u === 'carrera') {
        const c = grCareerAgg(j, st.comp, st.desde, st.hasta);
        if (!c || c.g < ming) { if (isSel) warnings.push(c ? `${j.nombre}: no llega al mínimo de ${ming} partidos` : (grSeasonRows(j, st.comp).length ? `${j.nombre}: sin temporadas en el periodo elegido` : noData(j))); return; }
        const vx = grCareerValue(c, mx, opts), vy = grCareerValue(c, my, opts);
        if (vx.hidden || vy.hidden) hidden++;
        if (vx.value == null || vy.value == null) return;
        push({ x: vx.value, y: vy.value, g: c.g, n: c.n, from: c.from, to: c.to, label: abrevNombre(j.nombre) });
      } else {
        const rows = grSeasonRows(j, st.comp);
        if (!rows.length) { if (isSel) warnings.push(noData(j)); return; }
        let any = false;
        rows.filter(r => inRange(r.year) && r.g >= ming).forEach(r => {
          const vx = mx.kind === 'age' ? { value: grAge(j, r.year) } : grSeasonValue(r, mx, opts);
          const vy = grSeasonValue(r, my, opts);
          if (vx.hidden || vy.hidden) hidden++;
          if (vx.value == null || vy.value == null) return;
          any = true;
          push({ x: vx.value, y: vy.value, g: r.g, year: r.year, teams: r.teams });
        });
        if (isSel && !any) warnings.push(`${j.nombre}: sin temporadas con datos en este filtro`);
      }
    });
    scene.points = ctxPts.concat(selPts);   // los destacados se dibujan encima
    scene.ctx = st.ctx && ctxPts.length > 0;
    scene.labels = st.u === 'carrera' && st.nom;
    scene.faces = grUsesFaces(st);
    const ax = (m, vals) => ({ kind: 'num', metric: m, name: m.name, fmt: v => grFmt(m, v), vals, zero: m.kind !== 'pct' && m.kind !== 'age' });
    scene.x = ax(mx, scene.points.map(p => p.x));
    scene.y = ax(my, scene.points.map(p => p.y));
    if (mx.kind === 'age') scene.x.name = 'Edad (a 1 de febrero de cada temporada)';
    const unit = st.u === 'carrera'
      ? (st.desde || st.hasta ? 'Cada punto = lo jugado por un jugador en el periodo' : 'Cada punto = la carrera de un jugador')
      : 'Cada punto = una temporada de un jugador';
    scene.subtitle = [compTxt, rangeTxt, unit + (ming ? ` (mín. ${ming} PJ)` : '')].filter(Boolean).join(' · ');
    if (st.u === 'carrera' && !st.desde && !st.hasta) notes.push('Carrera: promedios = totales ÷ partidos de la carrera.');
    if (st.u === 'carrera' && (st.desde || st.hasta)) notes.push('Periodo: promedios ponderados por partidos; los % se calculan con intentos estimados.');
    if (mx.kind === 'age') notes.push('Edad a 1 de febrero de cada temporada (criterio de Basketball Reference).');
    if (!scene.points.length) scene.empty = sel.length || st.ctx ? 'No hay datos para esta combinación.' : 'Añade jugadores o activa «Resto de españoles».';
  }
  if (hidden) notes.push(`Se ocultan ${hidden} valor${hidden === 1 ? '' : 'es'} de % con muestra pequeña (menos de ${pctThresholds(st)} intentos estimados).`);
  return scene;

  function gaps(series) { return series.some(s => s.segs.length > 1); }
  function pctThresholds(s) {
    const keys = s.tipo === 'lineas' ? [s.m] : [s.x, s.y];
    const car = s.tipo === 'dispersion' && s.u === 'carrera';
    return keys.map(grMetric).filter(m => m && m.kind === 'pct').map(m => `${car ? m.minAttCar : m.minAtt} en ${m.short}`).join(' / ');
  }
}

// ── Escalas y marcas de eje ──
function grNiceStep(raw) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}
function grNiceTicks(min, max, count) {
  if (!isFinite(min) || !isFinite(max)) return [0, 1];
  if (min === max) { const pad = Math.abs(min) * 0.1 || 1; min -= pad; max += pad; }
  const step = grNiceStep((max - min) / Math.max(1, count));
  const t0 = Math.floor(min / step + 1e-9) * step, t1 = Math.ceil(max / step - 1e-9) * step;
  const out = [];
  for (let v = t0; v <= t1 + step / 2; v += step) out.push(+v.toFixed(10));
  return out;
}
// Paso de las marcas enteras (temporadas/edad) para que las etiquetas quepan
function grIntStep(span, plotW, labelW) {
  for (const s of [1, 2, 3, 4, 5, 10]) if (plotW / Math.max(1, span / s) >= labelW + 10) return s;
  return 10;
}
function grTickFmt(axis, step) {
  const m = axis.metric;
  if (m.kind === 'pct') { const d = step < 0.01 ? 1 : 0; return v => (v * 100).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'; }
  const d = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
  return v => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Maquetación en píxeles (compartida por SVG y PNG) ──
// s = escala de fuente (1 en pantalla). Devuelve ejes, marcas y posiciones de cada punto.
function grLayout(scene, W, H, s) {
  s = s || 1;
  const fs = 12 * s, cw = 6.7 * s;   // ancho aprox. de un carácter
  const ax = scene.x, ay = scene.y;
  const ext = (vals, zero) => {
    let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
    if (zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    return [lo, hi];
  };
  // Eje Y (siempre numérico)
  const [ylo, yhi] = ext(ay.vals, ay.zero);
  const plotH0 = H - (12 + 18 + 22 + 16) * s;
  const yTicks = grNiceTicks(ylo, yhi, Math.max(3, Math.min(8, Math.floor(plotH0 / (46 * s)))));
  const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 1;
  const yFmt = grTickFmt(ay, yStep);
  const yLabW = Math.max(...yTicks.map(v => yFmt(v).length)) * cw;
  const fp = scene.faces ? 14 * s : 0;   // hueco para que las caras de los bordes no se corten
  const m = { t: 12 * s + fp, r: 18 * s + fp, b: (18 + 22 + 14) * s, l: 22 * s + yLabW + 10 * s };
  const plot = { x: m.l, y: m.t, w: Math.max(40, W - m.l - m.r), h: Math.max(40, H - m.t - m.b) };
  const yd = [yTicks[0], yTicks[yTicks.length - 1]];
  // Eje X
  let xTicks, xd, xFmt;
  if (ax.kind === 'int') {
    const [lo, hi] = ext(ax.vals, false);
    const span = Math.max(1, hi - lo);
    xFmt = ax.fmt;
    const labW = Math.max(...[lo, hi].map(v => String(xFmt(v)).length)) * cw;
    const step = grIntStep(span, plot.w, labW + 8 * s);
    xTicks = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) xTicks.push(v);
    if (!xTicks.length) xTicks = [lo];
    const pad = Math.max(0.35, span * 0.03);
    xd = [lo - pad, hi + pad];
  } else {
    const [lo, hi] = ext(ax.vals, ax.zero);
    xTicks = grNiceTicks(lo, hi, Math.max(3, Math.min(9, Math.floor(plot.w / (64 * s)))));
    xFmt = grTickFmt(ax, xTicks.length > 1 ? xTicks[1] - xTicks[0] : 1);
    xd = [xTicks[0], xTicks[xTicks.length - 1]];
  }
  const sx = v => plot.x + (v - xd[0]) / ((xd[1] - xd[0]) || 1) * plot.w;
  const sy = v => plot.y + plot.h - (v - yd[0]) / ((yd[1] - yd[0]) || 1) * plot.h;
  const L = {
    W, H, s, fs, plot, sx, sy,
    xTicks: xTicks.map(v => ({ v, p: sx(v), label: String(xFmt(v)) })),
    yTicks: yTicks.map(v => ({ v, p: sy(v), label: yFmt(v) })),
    xName: ax.name, yName: ay.name,
    xZero: ax.kind === 'num' && xd[0] < 0 && xd[1] > 0 ? sx(0) : null,
  };
  if (scene.tipo === 'lineas') {
    L.series = scene.series.map(se => ({
      se, segs: se.segs.map(seg => seg.map(p => ({ px: sx(p.x), py: sy(p.y), p }))),
      pts: se.points.map(p => ({ px: sx(p.x), py: sy(p.y), p })),
    }));
    if (scene.faces) L.series.forEach(se => { const q = se.pts[se.pts.length - 1]; if (q) { q.face = true; q.r = 14 * s; } });
    L.xs = [...new Set(scene.series.flatMap(se => se.points.map(p => p.x)))].sort((a, b) => a - b);
  } else {
    L.pts = scene.points.map(p => ({ px: sx(p.x), py: sy(p.y), p, face: !!scene.faces, r: scene.faces ? (p.sel ? 15 : 11) * s : null }));
    L.labels = scene.labels ? grPlaceLabels(L.pts, plot, s, cw) : [];
  }
  return L;
}

// Etiquetas de nombre sin solapes (greedy): destacados primero, cuatro posiciones candidatas
function grPlaceLabels(pts, plot, s, cw) {
  const rad = q => q.r || 5 * s;
  const boxes = pts.map(q => ({ x: q.px - rad(q), y: q.py - rad(q), w: 2 * rad(q), h: 2 * rad(q) }));
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const out = [];
  const order = pts.slice().sort((a, b) => (b.p.sel ? 1 : 0) - (a.p.sel ? 1 : 0));
  order.forEach(q => {
    const txt = q.p.label || '';
    const w = txt.length * cw * 0.95, h = 13 * s, gap = q.r ? q.r + 4 * s : 7 * s;
    const cands = [
      { x: q.px + gap, y: q.py - h / 2, anchor: 'start' },
      { x: q.px - gap - w, y: q.py - h / 2, anchor: 'end' },
      { x: q.px - w / 2, y: q.py - gap - h, anchor: 'middle' },
      { x: q.px - w / 2, y: q.py + gap, anchor: 'middle' },
    ];
    for (const c of cands) {
      const b = { x: c.x, y: c.y, w, h };
      if (b.x < plot.x || b.x + w > plot.x + plot.w || b.y < plot.y || b.y + h > plot.y + plot.h) continue;
      if (boxes.some(o => hit(b, o))) continue;
      boxes.push(b);
      const tx = c.anchor === 'start' ? b.x : c.anchor === 'end' ? b.x + w : b.x + w / 2;
      out.push({ x: tx, y: b.y + h / 2, text: txt, anchor: c.anchor, sel: q.p.sel, p: q.p });
      break;
    }
  });
  return out;
}

// Forma de un marcador como path SVG (también vale para canvas vía Path2D)
function grShapePath(shape, cx, cy, r) {
  const f = n => (+n).toFixed(2);
  switch (shape) {
    case 'square': { const a = r * 0.86; return `M${f(cx - a)} ${f(cy - a)}h${f(2 * a)}v${f(2 * a)}h${f(-2 * a)}Z`; }
    case 'triangle': { const a = r * 1.2; return `M${f(cx)} ${f(cy - a)}L${f(cx + a * 0.95)} ${f(cy + a * 0.65)}L${f(cx - a * 0.95)} ${f(cy + a * 0.65)}Z`; }
    case 'tri-down': { const a = r * 1.2; return `M${f(cx)} ${f(cy + a)}L${f(cx + a * 0.95)} ${f(cy - a * 0.65)}L${f(cx - a * 0.95)} ${f(cy - a * 0.65)}Z`; }
    case 'diamond': { const a = r * 1.22; return `M${f(cx)} ${f(cy - a)}L${f(cx + a)} ${f(cy)}L${f(cx)} ${f(cy + a)}L${f(cx - a)} ${f(cy)}Z`; }
    case 'plus': { const a = r * 1.1, b = r * 0.42; return `M${f(cx - b)} ${f(cy - a)}h${f(2 * b)}v${f(a - b)}h${f(a - b)}v${f(2 * b)}h${f(b - a)}v${f(a - b)}h${f(-2 * b)}v${f(b - a)}h${f(b - a)}v${f(-2 * b)}h${f(a - b)}Z`; }
    default: return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  }
}

// Filas de la tabla de datos (accesible y verificable sin pasar el ratón)
function grTableData(scene) {
  if (scene.tipo === 'lineas') {
    const xs = [...new Set(scene.series.flatMap(s => s.points.map(p => p.x)))].sort((a, b) => a - b);
    const head = [scene.x.name.replace(/ \(.*\)$/, ''), ...scene.series.map(s => s.name)];
    const rows = xs.map(x => [scene.x.fmt(x), ...scene.series.map(s => {
      const p = s.points.find(q => q.x === x);
      return p ? `${scene.y.fmt(p.y)}${scene.x.metric.key !== 'temp' ? ` (${grSeasonLbl(p.year)})` : ''}` : '—';
    })]);
    return { head, rows };
  }
  const season = scene.points.some(p => p.year);
  const head = ['Jugador', season ? 'Temporada' : 'Periodo', 'PJ', scene.x.metric.name || scene.x.name, scene.y.metric.name];
  const rows = scene.points.slice().sort((a, b) => (b.sel - a.sel) || a.name.localeCompare(b.name, 'es') || (a.year || 0) - (b.year || 0))
    .map(p => [p.name, season ? `${grSeasonLbl(p.year)}${p.teams ? ' · ' + p.teams : ''}` : (p.from === p.to ? grSeasonLbl(p.from) : `${grSeasonLbl(p.from)} a ${grSeasonLbl(p.to)}`),
      fmtEnt(p.g), scene.x.fmt(p.x), scene.y.fmt(p.y)]);
  return { head, rows };
}

// ── Dibujo en SVG (pantalla) ──
function grSwatch(slot, shape, lineas, ctx, face) {
  const cls = ctx ? 'gr-ctx' : `gr-s${slot + 1}`;
  if (face && !lineas) return `<svg class="gr-sw ${cls}" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle class="gr-ring" cx="7" cy="7" r="5"/></svg>`;
  return `<svg class="gr-sw ${cls}" width="${lineas ? 22 : 14}" height="14" viewBox="0 0 ${lineas ? 22 : 14} 14" aria-hidden="true">`
    + (lineas ? '<path class="gr-line" d="M1 7H21"/>' : '')
    + `<path class="gr-mk" d="${grShapePath(shape, lineas ? 11 : 7, 7, 4)}"/></svg>`;
}

function grFaceSvg(q, k, ringCls) {
  const c = GR_FACE, r = q.r, sc = 2 * r / c.s, f = n => (+n).toFixed(1), cx = f(q.px), cy = f(q.py);
  return `<g class="gr-face ${ringCls}"><clipPath id="grf${k}"><circle cx="${cx}" cy="${cy}" r="${f(r)}"/></clipPath>`
    + `<circle class="gr-face-gap" cx="${cx}" cy="${cy}" r="${f(r + 1.5)}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${f(r)}" fill="${avatarColor(q.p.name)}"/>`
    + `<text class="gr-face-ini" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${f(r * 0.75)}">${escapeHtml(iniciales(q.p.name))}</text>`
    + `<image href="img/players/${encodeURIComponent(q.p.id)}.jpg" x="${f(q.px - r - c.x * sc)}" y="${f(q.py - r - c.y * sc)}" width="${f(c.w * sc)}" height="${f(c.h * sc)}" clip-path="url(#grf${k})" preserveAspectRatio="xMidYMin slice"/>`
    + `<circle class="gr-face-ring" cx="${cx}" cy="${cy}" r="${f(r)}"/></g>`;
}

function grSvg(L, scene) {
  const p = L.plot, f = n => (+n).toFixed(1);
  let g = '';
  // rejilla y ejes (recesivos)
  L.yTicks.forEach(t => {
    g += `<line class="gr-grid" x1="${f(p.x)}" x2="${f(p.x + p.w)}" y1="${f(t.p)}" y2="${f(t.p)}"/>`;
    g += `<text class="gr-tick" x="${f(p.x - 8)}" y="${f(t.p)}" text-anchor="end" dominant-baseline="middle">${escapeHtml(t.label)}</text>`;
  });
  L.xTicks.forEach(t => {
    if (scene.tipo === 'dispersion') g += `<line class="gr-grid" x1="${f(t.p)}" x2="${f(t.p)}" y1="${f(p.y)}" y2="${f(p.y + p.h)}"/>`;
    g += `<text class="gr-tick" x="${f(t.p)}" y="${f(p.y + p.h + 18)}" text-anchor="middle">${escapeHtml(t.label)}</text>`;
  });
  g += `<line class="gr-axis" x1="${f(p.x)}" x2="${f(p.x + p.w)}" y1="${f(p.y + p.h)}" y2="${f(p.y + p.h)}"/>`;
  g += `<text class="gr-axname" x="${f(p.x + p.w / 2)}" y="${f(L.H - 6)}" text-anchor="middle">${escapeHtml(L.xName)}</text>`;
  g += `<text class="gr-axname" transform="translate(13 ${f(p.y + p.h / 2)}) rotate(-90)" text-anchor="middle">${escapeHtml(L.yName)}</text>`;
  g += `<line id="gr-cross" class="gr-cross" x1="0" x2="0" y1="${f(p.y)}" y2="${f(p.y + p.h)}" visibility="hidden"/>`;
  if (scene.tipo === 'lineas') {
    L.series.forEach(se => {
      const c = `gr-s${se.se.slot + 1}`;
      se.segs.forEach(seg => { if (seg.length > 1) g += `<path class="gr-line ${c}" d="${seg.map((q, i) => (i ? 'L' : 'M') + f(q.px) + ' ' + f(q.py)).join('')}"/>`; });
      se.pts.forEach(q => { if (!q.face) g += `<path class="gr-mk ${c}" d="${grShapePath(se.se.shape, q.px, q.py, 4)}"/>`; });
    });
    L.series.forEach((se, k) => se.pts.forEach(q => { if (q.face) g += grFaceSvg(q, k, `gr-s${se.se.slot + 1}`); }));
  } else {
    L.pts.forEach((q, k) => {
      if (q.face) { g += grFaceSvg(q, k, q.p.sel ? `gr-s${q.p.slot + 1}` : 'ctx'); return; }
      g += q.p.sel ? `<path class="gr-mk gr-s${q.p.slot + 1}" d="${grShapePath(q.p.shape, q.px, q.py, 5)}"/>`
        : `<circle class="gr-ctx" cx="${f(q.px)}" cy="${f(q.py)}" r="3.5"/>`;
    });
    (L.labels || []).forEach(l => {
      g += `<text class="gr-lbl${l.sel ? ' sel' : ''}" x="${f(l.x)}" y="${f(l.y)}" text-anchor="${l.anchor}" dominant-baseline="middle">${escapeHtml(l.text)}</text>`;
    });
  }
  g += '<g id="gr-hl"></g>';
  const aria = `${scene.title}. ${scene.subtitle}`;
  return `<svg id="gr-svg" class="gr-svg" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" role="img" tabindex="0" aria-label="${escapeHtml(aria)}">${g}</svg>`;
}

// ── Dibujo en canvas (PNG para redes y artículos) ──
// Plantilla «Españoles NBA · Gráficos» (diseñada en el lienzo de Claude Design): franja
// de bandera, antetítulo en Bebas Neue, título en DM Serif Display con la parte variable
// en cursiva de acento, tarjetas de jugador con cara, máximos anotados y pie de marca.
const GR_PNG_FMT = {
  h: { W: 1600, H: 900, PAD: 64, flag: 8, top: 38, s: 1.4, title: 64, sub: 22, kick: 26, chip: 52, foot: 74, faceL: 32, faceS: 32, faceC: 18 },
  v: { W: 1080, H: 1350, PAD: 56, flag: 10, top: 46, s: 1.55, title: 60, sub: 24, kick: 28, chip: 56, foot: 120, faceL: 36, faceS: 34, faceC: 20, twoLines: true },
};
const GR_PNG_CO = { bg: '#0e0e10', grid: 'rgba(255,255,255,.07)', axis: 'rgba(255,255,255,.28)', yellow: '#ffc400', red: '#c60b1e', text: '#f4f4f6', muted: '#9a9aa5', dim: '#8a8a94', accent: '#f2545b', sep: '#3a3a44', ctxRing: '#55555f', ctxFill: '#2a2a31', face: '#1c1c22' };

// Título automático → [parte fija, parte en cursiva]: «Métrica · Jugadores» o «Y frente a X»
function grTitleParts(scene) {
  const t = scene.title;
  if (!scene.autoTitle) return [t, ''];
  let i = t.indexOf(' · ');
  if (i > 0) return [t.slice(0, i) + ',', t.slice(i + 3)];
  i = t.indexOf(' frente a ');
  if (i > 0) {   // «Puntos por partido, frente a asistencias» (sin repetir «por partido»)
    const a = t.slice(0, i), b = t.slice(i + 1), suf = ' por partido';
    return [a + ',', a.endsWith(suf) && b.endsWith(suf) ? b.slice(0, -suf.length) : b];
  }
  return [t, ''];
}
// Línea de datos de cada tarjeta de jugador
function grLegendStat(scene, l) {
  const unit = m => m.short.replace('%', '');
  const val = (a, v) => `${a.fmt(v)}${a.metric.kind === 'pct' ? '' : ' ' + unit(a.metric)}`;
  if (scene.tipo === 'lineas') {
    const se = scene.series.find(s => s.id === l.id);
    if (!se || !se.points.length) return 'Sin datos en este filtro';
    const m = se.points.reduce((a, b) => (b.y > a.y ? b : a));
    return `Máx. ${val(scene.y, m.y)} · ${grSeasonLbl(m.year)}`;
  }
  const pts = scene.points.filter(p => p.id === l.id);
  if (!pts.length) return 'Sin datos en este filtro';
  if (pts[0].year) return `${pts.length} temporada${pts.length === 1 ? '' : 's'}`;
  const p = pts[0];
  return `${val(scene.y, p.y)} · ${val(scene.x, p.x)} · ${fmtEnt(p.g)} PJ`;
}
function grWrap(x, text, maxW, maxLines) {
  const lines = [];
  String(text).split(' ').forEach(w => {
    const last = lines[lines.length - 1];
    if (last != null && x.measureText(last + ' ' + w).width <= maxW) lines[lines.length - 1] = last + ' ' + w;
    else lines.push(w);
  });
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…'); }
  return lines;
}
function grMedian(a) { const s = a.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

async function grBuildImage(scene, legend, fmt) {
  const F = GR_PNG_FMT[fmt] || GR_PNG_FMT.h, CO = GR_PNG_CO, { W, H, PAD } = F;
  try {
    if (document.fonts) {
      await Promise.all([`400 ${F.title}px "DM Serif Display"`, `italic 400 ${F.title}px "DM Serif Display"`, `400 ${F.kick}px "Bebas Neue"`, '700 20px Inter', '800 20px Inter']
        .map(f => document.fonts.load(f).catch(() => null)));
      await document.fonts.ready;
    }
  } catch (e) { }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const lineas = scene.tipo === 'lineas';
  const col = slot => GR_PNG_COLORS[slot % GR_PNG_COLORS.length];
  const spaced = (px, fn) => { x.save(); try { x.letterSpacing = px + 'px'; } catch (e) { } fn(); x.restore(); };
  // Fotos: las de las tarjetas siempre; en dispersión por carreras, también las del resto
  const ids = new Set((legend || []).map(l => l.id));
  if (scene.faces && !lineas) scene.points.forEach(p => ids.add(p.id));
  const imgs = {};
  await Promise.all([...ids].map(async id => { imgs[id] = await qntLoadImg(`img/players/${id}.jpg`); }));

  // Cara recortada en círculo (respaldo: iniciales); ctx = resto de españoles, en gris y atenuado
  const face = (id, name, cx, cy, r, ring, ringW, ctx) => {
    const img = imgs[id];
    x.save();
    x.beginPath(); x.arc(cx, cy, r + 3, 0, Math.PI * 2); x.fillStyle = CO.bg; x.fill();
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
    x.fillStyle = img ? CO.face : qntAvatarColor(name); x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    if (img) {
      const sc = 2 * r / GR_FACE.s;
      x.drawImage(img, cx - r - GR_FACE.x * sc, cy - r - GR_FACE.y * sc, GR_FACE.w * sc, img.height * sc * (GR_FACE.w / img.width));
      if (ctx) {   // desaturar con modo de fusión (ctx.filter no existe en Safari) y atenuar
        x.globalCompositeOperation = 'saturation'; x.fillStyle = '#808080'; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
        x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(14,14,16,.42)'; x.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      }
    } else { x.fillStyle = '#fff'; x.font = `700 ${Math.round(r * 0.75)}px Inter, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(qntInitials(name), cx, cy); }
    x.restore();
    x.beginPath(); x.arc(cx, cy, r - ringW / 2, 0, Math.PI * 2); x.strokeStyle = ring; x.lineWidth = ringW; x.stroke();
    x.restore();
  };
  const mark = (shape, px, py, r, color) => {
    const path = new Path2D(grShapePath(shape, px, py, r));
    x.lineWidth = 3; x.strokeStyle = CO.bg; x.stroke(path); x.fillStyle = color; x.fill(path);
  };

  // Fondo y franja de bandera
  x.fillStyle = CO.bg; x.fillRect(0, 0, W, H);
  x.fillStyle = CO.red; x.fillRect(0, 0, W, F.flag);
  x.fillStyle = CO.yellow; x.fillRect(W * 0.3, 0, W * 0.4, F.flag);

  // Antetítulo
  let y = F.flag + F.top;
  x.textBaseline = 'top'; x.textAlign = 'left';
  x.font = `400 ${F.kick}px "Bebas Neue", Inter, sans-serif`;
  let kx = PAD;
  spaced(5, () => { x.fillStyle = CO.yellow; x.fillText('ESPAÑOLES EN LA NBA', kx, y); kx += x.measureText('ESPAÑOLES EN LA NBA').width + 14; });
  x.fillStyle = CO.sep; x.fillRect(kx, y + F.kick * 0.36, 28, 2); kx += 42;
  spaced(5, () => { x.fillStyle = CO.dim; x.fillText('GRÁFICOS', kx, y); });
  y += F.kick + 12;

  // Título: parte fija + parte variable en cursiva de acento (una o dos líneas)
  const [ta, tb] = grTitleParts(scene), maxW = W - 2 * PAD;
  const fA = sz => `400 ${sz}px "DM Serif Display", Georgia, serif`, fB = sz => `italic 400 ${sz}px "DM Serif Display", Georgia, serif`;
  const wA = sz => { x.font = fA(sz); return x.measureText(ta).width; }, wB = sz => { x.font = fB(sz); return x.measureText(tb).width; };
  let T = F.title, two = !!tb && !!F.twoLines;
  if (!two && tb && wA(T) + 16 + wB(T) > maxW) two = true;
  const fits = sz => two ? Math.max(wA(sz), wB(sz)) <= maxW : wA(sz) + (tb ? 16 + wB(sz) : 0) <= maxW;
  while (!fits(T) && T > 38) T -= 2;
  x.fillStyle = CO.text; x.font = fA(T);
  const fitTxt = (t, w) => { if (x.measureText(t).width <= w) return t; while (t.length > 1 && x.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; };
  x.fillText(fitTxt(ta, maxW), PAD, y);
  if (tb) {
    const bx = two ? PAD : PAD + wA(T) + 16, by = two ? y + T * 1.05 : y;
    x.font = fB(T); x.fillStyle = CO.accent; x.fillText(fitTxt(tb, maxW - (bx - PAD)), bx, by);
  }
  y += T * 1.05 * (two ? 2 : 1) + 8;
  x.fillStyle = CO.muted; x.font = `400 ${F.sub}px Inter, sans-serif`;
  x.fillText(fitTxt(scene.subtitle, maxW), PAD, y);
  y += F.sub * 1.2 + 22;

  // Tarjetas de jugador (cara + nombre + dato clave)
  const cards = (legend || []).map(l => ({ l, stat: grLegendStat(scene, l) }));
  let cx0 = PAD, rowY = y;
  const ch = F.chip, nameF = `700 ${Math.round(ch * 0.42)}px Inter, sans-serif`, statF = `400 ${Math.round(ch * 0.31)}px Inter, sans-serif`;
  const place = w => { if (cx0 > PAD && cx0 + w > W - PAD) { cx0 = PAD; rowY += ch + 16; } const at = cx0; cx0 += w + 44; return at; };
  cards.forEach(({ l, stat }) => {
    x.font = nameF; const nw = x.measureText(l.name).width; x.font = statF; const sw = x.measureText(stat).width;
    const at = place(ch + 14 + Math.max(nw, sw));
    face(l.id, l.name, at + ch / 2, rowY + ch / 2, ch / 2, col(l.slot), 3, false);
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = CO.text; x.font = nameF; x.fillText(l.name, at + ch + 14, rowY + ch * 0.46);
    x.fillStyle = CO.muted; x.font = statF; x.fillText(stat, at + ch + 14, rowY + ch * 0.86);
  });
  if (!lineas && scene.ctx) {
    x.font = `600 ${Math.round(ch * 0.35)}px Inter, sans-serif`;
    const txt = 'Resto de españoles', at = place(22 + 12 + x.measureText(txt).width);
    x.beginPath(); x.arc(at + 11, rowY + ch / 2, 10, 0, Math.PI * 2); x.fillStyle = CO.ctxFill; x.fill(); x.lineWidth = 2; x.strokeStyle = CO.ctxRing; x.stroke();
    x.fillStyle = CO.muted; x.textBaseline = 'middle'; x.fillText(txt, at + 34, rowY + ch / 2);
  }
  y = rowY + (cards.length || scene.ctx ? ch : 0);

  // Área del gráfico
  const top = y + 58, bottom = H - F.foot - 8;
  const L = grLayout(scene, W - 2 * PAD + 20, bottom - top, F.s);
  const p = L.plot, s = L.s, fs = L.fs;
  if (L.series) L.series.forEach(se => se.pts.forEach(q => { if (q.face) q.r = F.faceL; }));
  if (L.pts && scene.faces) {
    L.pts.forEach(q => { q.r = q.p.sel ? F.faceS : F.faceC; });
    if (scene.labels) L.labels = grPlaceLabels(L.pts, p, s, 6.7 * s);
  }
  x.save(); x.translate(PAD - 20, top);
  x.textBaseline = 'alphabetic';
  // nombre del eje Y, en horizontal sobre el gráfico
  x.font = `600 ${Math.round(fs * 0.9)}px Inter, sans-serif`; x.fillStyle = CO.dim; x.textAlign = 'left';
  spaced(2, () => x.fillText(L.yName.replace(/ \(.*\)$/, '').toUpperCase(), p.x, p.y - 18));
  x.lineWidth = 1;
  L.yTicks.forEach(t => {
    if (t.p < p.y + p.h - 0.5) { x.strokeStyle = CO.grid; x.beginPath(); x.moveTo(p.x, t.p); x.lineTo(p.x + p.w, t.p); x.stroke(); }
    x.fillStyle = CO.dim; x.font = `400 ${fs}px Inter, sans-serif`; x.textAlign = 'right'; x.textBaseline = 'middle';
    x.fillText(t.label, p.x - 14, t.p);
  });
  x.textBaseline = 'alphabetic';
  L.xTicks.forEach(t => {
    if (!lineas && t.p > p.x + 0.5) { x.strokeStyle = CO.grid; x.beginPath(); x.moveTo(t.p, p.y); x.lineTo(t.p, p.y + p.h); x.stroke(); }
    x.fillStyle = CO.dim; x.font = `400 ${fs}px Inter, sans-serif`; x.textAlign = 'center'; x.fillText(t.label, t.p, p.y + p.h + fs * 2);
  });
  x.strokeStyle = CO.axis; x.lineWidth = 1.5; x.beginPath(); x.moveTo(p.x, p.y + p.h); x.lineTo(p.x + p.w, p.y + p.h); x.stroke();
  if (scene.x.metric.key !== 'temp') {
    x.font = `600 ${Math.round(fs * 0.82)}px Inter, sans-serif`; x.fillStyle = CO.dim; x.textAlign = 'right';
    spaced(2, () => x.fillText(L.xName.replace(/ \(.*\)$/, '').toUpperCase(), p.x + p.w, L.H - 2));
  }

  let median = null;
  if (lineas) {
    L.series.forEach(se => {
      x.strokeStyle = col(se.se.slot); x.lineWidth = 2.9 * s; x.lineJoin = 'round'; x.lineCap = 'round';
      se.segs.forEach(seg => { if (seg.length < 2) return; x.beginPath(); seg.forEach((q, i) => i ? x.lineTo(q.px, q.py) : x.moveTo(q.px, q.py)); x.stroke(); });
      se.pts.forEach(q => { if (!q.face) mark(se.se.shape, q.px, q.py, 4.6 * s, col(se.se.slot)); });
    });
    // Máximo de cada jugador anotado (si no coincide con la cara final); con más de 3 líneas se saturaría
    if (L.series.length <= 3) L.series.forEach(se => {
      if (!se.pts.length) return;
      const m = se.pts.reduce((a, b) => (b.p.y > a.p.y ? b : a));
      if (m.face) return;
      x.beginPath(); x.arc(m.px, m.py, 13, 0, Math.PI * 2); x.strokeStyle = CO.text; x.lineWidth = 1.5; x.stroke();
      const v = scene.y.fmt(m.p.y), sub = ' MÁX.';
      x.font = `800 ${Math.round(fs * 1.18)}px Inter, sans-serif`; const vw = x.measureText(v).width;
      x.font = `600 ${Math.round(fs * 0.82)}px Inter, sans-serif`; const sw = x.measureText(sub).width;
      const lx = Math.min(Math.max(m.px - (vw + sw) / 2, p.x), p.x + p.w - vw - sw), ly = m.py - 24;
      x.textAlign = 'left'; x.fillStyle = CO.text; x.font = `800 ${Math.round(fs * 1.18)}px Inter, sans-serif`; x.fillText(v, lx, ly);
      x.fillStyle = CO.muted; x.font = `600 ${Math.round(fs * 0.82)}px Inter, sans-serif`; x.fillText(sub, lx + vw, ly);
    });
    L.series.forEach(se => se.pts.forEach(q => { if (q.face) face(q.p.id, q.p.name, q.px, q.py, q.r, col(se.se.slot), 4, false); }));
  } else {
    // Medianas de los puntos dibujados como referencia
    if (scene.points.length >= 5) {
      median = { x: grMedian(scene.points.map(q => q.x)), y: grMedian(scene.points.map(q => q.y)) };
      const mx = L.sx(median.x), my = L.sy(median.y);
      x.save(); x.setLineDash([6, 6]); x.strokeStyle = CO.ctxRing; x.lineWidth = 1.5;
      x.beginPath(); x.moveTo(mx, p.y); x.lineTo(mx, p.y + p.h); x.moveTo(p.x, my); x.lineTo(p.x + p.w, my); x.stroke(); x.restore();
      const unit = m => m.kind === 'pct' ? '' : m.kind === 'age' ? ' años' : ' ' + m.short.replace('%', '');
      x.font = `600 ${Math.round(fs * 0.82)}px Inter, sans-serif`; x.fillStyle = CO.dim;
      x.textAlign = 'left'; x.fillText(`Mediana: ${scene.x.fmt(median.x)}${unit(scene.x.metric)}`, mx + 10, p.y + 18);
      x.textAlign = 'right'; x.fillText(`Mediana: ${scene.y.fmt(median.y)}${unit(scene.y.metric)}`, p.x + p.w - 8, my - 9);
    }
    L.pts.forEach(q => {
      if (q.face) face(q.p.id, q.p.name, q.px, q.py, q.r, q.p.sel ? col(q.p.slot) : CO.ctxRing, q.p.sel ? 4 : 2, !q.p.sel);
      else if (q.p.sel) mark(q.p.shape, q.px, q.py, 5.6 * s, col(q.p.slot));
      else { x.fillStyle = 'rgba(233,233,236,.28)'; x.beginPath(); x.arc(q.px, q.py, 3.9 * s, 0, Math.PI * 2); x.fill(); }
    });
    x.textBaseline = 'middle';
    (L.labels || []).forEach(l => {
      x.textAlign = l.anchor === 'middle' ? 'center' : l.anchor === 'end' ? 'right' : 'left';
      if (l.sel) {
        const pt = l.p;
        x.font = `800 ${Math.round(fs * 1.18)}px Inter, sans-serif`; x.fillStyle = CO.text; x.fillText(l.text, l.x, l.y - 6);
        if (pt) { x.font = `500 ${Math.round(fs * 0.88)}px Inter, sans-serif`; x.fillStyle = CO.muted; x.fillText(`${scene.y.fmt(pt.y)} · ${scene.x.fmt(pt.x)}`, l.x, l.y + fs * 0.95); }
      } else { x.font = `500 ${Math.round(fs * 0.88)}px Inter, sans-serif`; x.fillStyle = CO.muted; x.fillText(l.text, l.x, l.y); }
    });
  }
  x.restore();

  // Pie: fuente y notas a la izquierda (o arriba en vertical), marca a la derecha
  const fy = H - F.foot;
  x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(PAD, fy, W - 2 * PAD, 1);
  const notes = ['Fuente: Basketball Reference.'].concat(scene.notes)
    .concat(median ? [`Líneas discontinuas: mediana de los ${scene.points.length} ${scene.points[0].year ? 'puntos' : 'jugadores'}.`] : []).join(' ');
  const brandF = `700 ${F.foot > 100 ? 22 : 19}px Inter, sans-serif`;
  x.font = brandF; const siteW = x.measureText('espanoles-nba.alejandroggo.com').width, handW = x.measureText('@alejandroggo · #EspañolesNBA').width;
  x.textBaseline = 'middle';
  if (F.foot > 100) {
    x.font = '400 16px Inter, sans-serif'; x.fillStyle = CO.dim; x.textAlign = 'left';
    grWrap(x, notes, W - 2 * PAD, 2).forEach((ln, i) => x.fillText(ln, PAD, fy + 30 + i * 21));
    x.font = brandF; x.fillStyle = CO.text; x.fillText('espanoles-nba.alejandroggo.com', PAD, H - 34);
    x.fillStyle = CO.yellow; x.textAlign = 'right'; x.fillText('@alejandroggo · #EspañolesNBA', W - PAD, H - 34);
  } else {
    const nw = W - 2 * PAD - siteW - handW - 18 - 32;
    x.font = '400 15px Inter, sans-serif'; x.fillStyle = CO.dim; x.textAlign = 'left';
    const ls = grWrap(x, notes, nw, 3);
    ls.forEach((ln, i) => x.fillText(ln, PAD, fy + F.foot / 2 + (i - (ls.length - 1) / 2) * 19));
    x.font = brandF; x.textAlign = 'right';
    x.fillStyle = CO.yellow; x.fillText('@alejandroggo · #EspañolesNBA', W - PAD, fy + F.foot / 2);
    x.fillStyle = CO.text; x.fillText('espanoles-nba.alejandroggo.com', W - PAD - handW - 18, fy + F.foot / 2);
  }
  return c;
}

// ── Interfaz ──
let grPlayers = [], grState = null, grSlots = {}, grScene = null, grL = null, grHover = null, grSuggIdx = -1, grSuggList = [];

// Color/forma fijos por jugador: los que siguen conservan el suyo; los nuevos toman el primero libre
function grAssignSlots() {
  Object.keys(grSlots).forEach(id => { if (!grState.ids.includes(id)) delete grSlots[id]; });
  grState.ids.forEach(id => {
    if (grSlots[id] != null) return;
    const used = new Set(Object.values(grSlots)); let k = 0; while (used.has(k)) k++;
    grSlots[id] = k;
  });
}

async function initGraficosPage() {
  const sub = document.getElementById('hero-sub');
  let data;
  try { data = await loadData(); }
  catch (e) { sub.textContent = 'Error al cargar los datos'; grShowEmpty('No se pudieron cargar los datos. Recarga la página para intentarlo de nuevo.'); return; }
  buildPlayerIds(data.jugadores);
  grPlayers = grEligible(data.jugadores);
  sub.textContent = `Construye gráficos de líneas y de dispersión con las estadísticas de los ${grPlayers.length} españoles que han jugado en la NBA`;
  grState = grParseState(new URLSearchParams(location.search), grPlayers);
  grAssignSlots();
  grBindUI();
  grUpdate();
  const chart = document.getElementById('gr-chart');
  let lastW = chart.clientWidth;
  const onResize = () => { if (chart.clientWidth !== lastW) { lastW = chart.clientWidth; grDraw(); } };
  if (window.ResizeObserver) new ResizeObserver(onResize).observe(chart); else window.addEventListener('resize', onResize);
}

function grSet(patch) {
  grState = grNormalize(Object.assign({}, grState, patch), grPlayers);
  grAssignSlots();
  grUpdate();
}

function grBindUI() {
  const $ = id => document.getElementById(id);
  const opt = (v, l) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`;
  const metricOpts = GR_METRICS.map(m => opt(m.key, m.kind === 'tot' ? m.name : `${m.name} (${m.short})`)).join('');
  $('gr-m').innerHTML = metricOpts;
  $('gr-y').innerHTML = metricOpts;
  $('gr-x').innerHTML = metricOpts + opt('edad', 'Edad');
  [['gr-tipo', 'tipo'], ['gr-comp', 'comp'], ['gr-m', 'm'], ['gr-ex', 'ex'], ['gr-u', 'u'], ['gr-x', 'x'], ['gr-y', 'y'], ['gr-desde', 'desde'], ['gr-hasta', 'hasta'], ['gr-min', 'ming']]
    .forEach(([id, k]) => { $(id).addEventListener('change', e => grSet({ [k]: e.target.value })); });
  ['ley', 'ctx', 'nom', 'muestra', 'caras'].forEach(k => {
    $('gr-' + k).addEventListener('click', () => grSet({ [k]: !grState[k] }));
  });
  let tTimer = null;
  $('gr-t').addEventListener('input', e => { clearTimeout(tTimer); tTimer = setTimeout(() => grSet({ t: e.target.value }), 250); });
  // Buscador de jugadores (selección múltiple)
  const q = $('gr-q');
  q.addEventListener('focus', () => grSuggRender());
  q.addEventListener('input', () => { grSuggIdx = -1; grSuggRender(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'Escape') { grSuggClose(); return; }
    if (e.key === 'Backspace' && !q.value && grState.ids.length) { grRemove(grState.ids[grState.ids.length - 1]); return; }
    if (!grSuggList.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); grSuggIdx = Math.min(grSuggIdx + 1, grSuggList.length - 1); grSuggRender(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); grSuggIdx = Math.max(grSuggIdx - 1, 0); grSuggRender(); }
    else if (e.key === 'Enter') { e.preventDefault(); const j = grSuggList[grSuggIdx >= 0 ? grSuggIdx : 0]; if (j) grAdd(j.id); }
  });
  document.addEventListener('click', e => { const w = $('gr-picker'); if (w && !w.contains(e.target)) grSuggClose(); });
}

function grAdd(id) {
  if (grState.ids.includes(id) || grState.ids.length >= GR_MAX) return;
  const q = document.getElementById('gr-q');
  q.value = ''; grSuggIdx = -1;
  grSet({ ids: grState.ids.concat(id) });
  if (grState.ids.length < GR_MAX) { q.focus(); grSuggRender(); } else grSuggClose();
}
function grRemove(id) { grSet({ ids: grState.ids.filter(x => x !== id) }); }

function grSuggRender() {
  const q = document.getElementById('gr-q'), panel = document.getElementById('gr-sugg');
  const nq = drNorm(q.value);
  grSuggList = grPlayers.filter(j => !grState.ids.includes(j.id) && (!nq || drNorm(j.nombre).includes(nq)));
  if (grState.ids.length >= GR_MAX || !grSuggList.length) { panel.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
  panel.innerHTML = '';
  grSuggList.forEach((j, i) => {
    const rows = grSeasonRows(j, grState.comp);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'gr-sugg-item' + (i === grSuggIdx ? ' active' : '');
    b.setAttribute('role', 'option');
    const n = document.createElement('span'); n.textContent = j.nombre;
    const m = document.createElement('span'); m.className = 'gr-sugg-meta';
    m.textContent = rows.length ? (rows.length === 1 ? grSeasonLbl(rows[0].year) : `${grSeasonLbl(rows[0].year)} – ${grSeasonLbl(rows[rows.length - 1].year)}`) : (grState.comp === 'po' ? 'sin playoffs' : 'sin partidos');
    b.append(n, m);
    b.addEventListener('mousedown', e => e.preventDefault());   // no perder el foco del input
    b.addEventListener('click', () => grAdd(j.id));
    panel.appendChild(b);
  });
  panel.hidden = false; q.setAttribute('aria-expanded', 'true');
  const act = panel.querySelector('.active'); if (act) act.scrollIntoView({ block: 'nearest' });
}
function grSuggClose() {
  const panel = document.getElementById('gr-sugg'), q = document.getElementById('gr-q');
  if (panel) panel.hidden = true; if (q) q.setAttribute('aria-expanded', 'false');
}

function grSyncControls() {
  const st = grState, $ = id => document.getElementById(id);
  const opt = (v, l) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`;
  const years = grYears(grPlayers, st.comp);
  $('gr-desde').innerHTML = opt('', 'Desde el inicio') + years.map(y => opt(y, grSeasonLbl(y))).join('');
  $('gr-hasta').innerHTML = opt('', 'Hasta hoy') + years.slice().reverse().map(y => opt(y, grSeasonLbl(y))).join('');
  $('gr-min').innerHTML = grMinOptions(st).map(v => opt(v, v ? `${v} o más` : 'Sin mínimo')).join('');
  [['gr-tipo', st.tipo], ['gr-comp', st.comp], ['gr-m', st.m], ['gr-ex', st.ex], ['gr-u', st.u], ['gr-x', st.x], ['gr-y', st.y],
    ['gr-desde', st.desde || ''], ['gr-hasta', st.hasta || ''], ['gr-min', grMinG(st)]].forEach(([id, v]) => { $(id).value = String(v); });
  // Combinaciones incompatibles: misma métrica en ambos ejes / edad solo en temporadas
  [...$('gr-x').options].forEach(o => { o.disabled = o.value === st.y || (o.value === 'edad' && st.u !== 'temporada'); o.hidden = o.value === 'edad' && st.u !== 'temporada'; });
  [...$('gr-y').options].forEach(o => { o.disabled = o.value === st.x; });
  document.querySelectorAll('[data-gr]').forEach(el => {
    const need = el.getAttribute('data-gr');
    const pctUsed = (st.tipo === 'lineas' ? [st.m] : [st.x, st.y]).some(k => (grMetric(k) || {}).kind === 'pct');
    const show = need === st.tipo || (need === 'carrera' && st.tipo === 'dispersion' && st.u === 'carrera') || (need === 'pct' && pctUsed) || (need === 'caras' && grUsesFaces(Object.assign({}, st, { caras: true })));
    el.hidden = !show;
  });
  ['ley', 'ctx', 'nom', 'muestra', 'caras'].forEach(k => { const b = $('gr-' + k); b.classList.toggle('active', !!st[k]); b.setAttribute('aria-pressed', st[k] ? 'true' : 'false'); });
  const t = $('gr-t');
  if (document.activeElement !== t) t.value = st.t;
  const q = $('gr-q');
  q.disabled = st.ids.length >= GR_MAX;
  q.placeholder = st.ids.length >= GR_MAX ? `Máximo ${GR_MAX} jugadores` : (st.ids.length ? 'Añadir otro jugador…' : 'Buscar jugador…');
  $('gr-count').textContent = `${st.ids.length}/${GR_MAX}`;
}

function grRenderChips() {
  const box = document.getElementById('gr-chips');
  const lineas = grState.tipo === 'lineas';
  box.innerHTML = grState.ids.map(id => {
    const j = grPlayers.find(p => p.id === id), slot = grSlots[id];
    return `<span class="gr-chip">${grSwatch(slot, GR_SHAPES[slot % GR_SHAPES.length], lineas, false, grUsesFaces(grState))}<span class="gr-chip-name">${escapeHtml(j.nombre)}</span>`
      + `<button type="button" class="gr-chip-x" aria-label="Quitar a ${escapeHtml(j.nombre)}" onclick="grRemove('${escapeHtml(id)}')">×</button></span>`;
  }).join('');
}

function grRenderMeta() {
  const sc = grScene, $ = id => document.getElementById(id);
  $('gr-title').textContent = sc.title;
  $('gr-sub').textContent = sc.subtitle;
  $('gr-t').placeholder = grAutoTitle(grState, grState.ids.map(id => grPlayers.find(p => p.id === id)));
  const lineas = sc.tipo === 'lineas';
  const leg = $('gr-legend');
  const items = sc.legend.map(l => `<span class="gr-leg-item">${grSwatch(l.slot, l.shape, lineas, false, sc.faces)}${escapeHtml(l.name)}</span>`);
  if (!lineas && sc.ctx) items.push(`<span class="gr-leg-item">${grSwatch(0, 'circle', false, true, sc.faces)}Resto de españoles</span>`);
  leg.innerHTML = items.join('');
  leg.hidden = !grState.ley || !items.length;
  const w = $('gr-warn');
  w.innerHTML = sc.warnings.map(t => `<li>${escapeHtml(t)}</li>`).join('');
  w.hidden = !sc.warnings.length;
  $('gr-note').textContent = ['Fuente: Basketball Reference.'].concat(sc.notes).join(' ');
}

function grShowEmpty(msg) {
  const el = document.getElementById('gr-chart');
  if (el) el.innerHTML = `<p class="gr-empty">${escapeHtml(msg)}</p>`;
  grL = null;
}

function grDraw() {
  const el = document.getElementById('gr-chart');
  if (!el || !grScene) return;
  if (grScene.empty) { grShowEmpty(grScene.empty); return; }
  const w = Math.max(280, el.clientWidth);
  const h = w < 560 ? Math.round(w * 0.92) : Math.round(Math.min(560, Math.max(360, w * 0.56)));
  grL = grLayout(grScene, w, h, 1);
  el.innerHTML = grSvg(grL, grScene) + '<div class="gr-tip" id="gr-tip" role="status" aria-live="polite" hidden></div>';
  grHover = null;
  const svg = document.getElementById('gr-svg');
  svg.addEventListener('pointermove', grPointer);
  svg.addEventListener('pointerdown', grPointer);
  svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') grHideTip(); });
  svg.addEventListener('keydown', grKey);
  svg.addEventListener('focus', () => { if (grHover == null) grShowAt(grScene.tipo === 'lineas' ? grL.xs.length - 1 : grOrderedPts().length - 1); });
  svg.addEventListener('blur', grHideTip);
}

// Puntos de dispersión ordenados por X (navegación con teclado)
function grOrderedPts() { return grL && grL.pts ? grL.pts.map((q, i) => i).sort((a, b) => grL.pts[a].px - grL.pts[b].px) : []; }

function grPointer(e) {
  if (!grL) return;
  const r = e.currentTarget.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top, p = grL.plot;
  if (mx < p.x - 24 || mx > p.x + p.w + 24 || my < p.y - 24 || my > p.y + p.h + 24) { grHideTip(); return; }
  if (grScene.tipo === 'lineas') {
    let best = -1, bd = Infinity;
    grL.xs.forEach((v, i) => { const d = Math.abs(grL.sx(v) - mx); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) grShowAt(best);
  } else {
    let best = -1, bd = 28 * 28;   // área de acierto mayor que el punto
    grL.pts.forEach((q, i) => { const d = (q.px - mx) ** 2 + (q.py - my) ** 2; if (d < bd || (d === bd && q.p.sel)) { bd = d; best = i; } });
    if (best >= 0) grShowAt(grOrderedPts().indexOf(best)); else grHideTip();
  }
}

function grKey(e) {
  if (!grL) return;
  const n = grScene.tipo === 'lineas' ? grL.xs.length : grL.pts.length;
  if (e.key === 'Escape') { grHideTip(); return; }
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  const cur = grHover == null ? -1 : grHover;
  grShowAt(Math.max(0, Math.min(n - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))));
}

function grHideTip() {
  grHover = null;
  const t = document.getElementById('gr-tip'), c = document.getElementById('gr-cross'), h = document.getElementById('gr-hl');
  if (t) t.hidden = true; if (c) c.setAttribute('visibility', 'hidden'); if (h) h.innerHTML = '';
}

// Tooltip: el valor manda, el nombre acompaña. Todo con textContent.
function grShowAt(i) {
  if (!grL || i == null || i < 0) return;
  grHover = i;
  const tip = document.getElementById('gr-tip'), hl = document.getElementById('gr-hl'), cross = document.getElementById('gr-cross');
  const sc = grScene;
  tip.innerHTML = '';
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  let ax, ay, hlHtml = '';
  if (sc.tipo === 'lineas') {
    const xv = grL.xs[i];
    ax = grL.sx(xv);
    cross.setAttribute('x1', ax); cross.setAttribute('x2', ax); cross.setAttribute('visibility', 'visible');
    const key = sc.x.metric.key;
    tip.appendChild(el('div', 'gr-tip-h', key === 'temp' ? `Temporada ${grSeasonLbl(xv)}` : key === 'n' ? `Temporada nº ${xv} en la NBA` : `${xv} años`));
    const ys = [];
    grL.series.forEach(se => {
      const q = se.pts.find(o => o.p.x === xv);
      const row = el('div', 'gr-tip-r');
      row.appendChild(el('span', `gr-tip-k gr-s${se.se.slot + 1}`));
      if (q) {
        ys.push(q.py);
        hlHtml += q.face ? `<circle class="gr-face-hl" cx="${q.px}" cy="${q.py}" r="${q.r + 3}"/>`
          : `<path class="gr-mk-hl gr-s${se.se.slot + 1}" d="${grShapePath(se.se.shape, q.px, q.py, 6)}"/>`;
        row.appendChild(el('strong', null, sc.y.fmt(q.p.y)));
        row.appendChild(el('span', 'gr-tip-n', se.se.name));
        row.appendChild(el('span', 'gr-tip-m', `${key !== 'temp' ? grSeasonLbl(q.p.year) + ' · ' : ''}${q.p.teams ? q.p.teams + ' · ' : ''}${q.p.g} PJ`));
      } else {
        row.appendChild(el('strong', 'gr-tip-na', '—'));
        row.appendChild(el('span', 'gr-tip-n', se.se.name));
        row.appendChild(el('span', 'gr-tip-m', 'sin datos'));
      }
      tip.appendChild(row);
    });
    ay = ys.length ? Math.min(...ys) : grL.plot.y + grL.plot.h / 2;
  } else {
    const q = grL.pts[grOrderedPts()[i]];
    if (!q) return;
    ax = q.px; ay = q.py;
    hlHtml = q.face ? `<circle class="gr-face-hl" cx="${q.px}" cy="${q.py}" r="${q.r + 3}"/>` : `<path class="gr-mk-hl ${q.p.sel ? 'gr-s' + (q.p.slot + 1) : 'gr-ctx-hl'}" d="${grShapePath(q.p.shape, q.px, q.py, q.p.sel ? 7 : 6)}"/>`;
    tip.appendChild(el('div', 'gr-tip-h', q.p.name));
    tip.appendChild(el('div', 'gr-tip-s', q.p.year ? `${grSeasonLbl(q.p.year)}${q.p.teams ? ' · ' + q.p.teams : ''} · ${q.p.g} PJ`
      : `${q.p.from === q.p.to ? grSeasonLbl(q.p.from) : grSeasonLbl(q.p.from) + ' a ' + grSeasonLbl(q.p.to)} · ${q.p.n} temp. · ${fmtEnt(q.p.g)} PJ`));
    [[sc.y, q.p.y], [sc.x, q.p.x]].forEach(([a, v]) => {
      const row = el('div', 'gr-tip-r');
      row.appendChild(el('strong', null, a.fmt(v)));
      row.appendChild(el('span', 'gr-tip-n', a.name.replace(/ \(.*\)$/, '')));
      tip.appendChild(row);
    });
  }
  hl.innerHTML = hlHtml;
  tip.hidden = false;
  // Posición: a la derecha del punto, o a la izquierda si no cabe
  const box = document.getElementById('gr-chart'), tw = tip.offsetWidth, th = tip.offsetHeight;
  let left = ax + 14; if (left + tw > box.clientWidth - 4) left = ax - 14 - tw; if (left < 4) left = 4;
  let top = ay - th / 2; top = Math.max(4, Math.min(top, grL.H - th - 4));
  tip.style.left = left + 'px'; tip.style.top = top + 'px';
}

function grRenderTable() {
  const box = document.getElementById('gr-table');
  if (!grScene || grScene.empty) { box.innerHTML = '<p class="td-muted">Sin datos.</p>'; return; }
  const d = grTableData(grScene);
  box.innerHTML = `<table><thead><tr>${d.head.map((h, i) => `<th class="${i ? 'td-num' : ''}">${escapeHtml(h)}</th>`).join('')}</tr></thead>`
    + `<tbody>${d.rows.map(r => `<tr>${r.map((c, i) => `<td class="${i ? 'td-num' : 'td-nombre'}">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function grSyncUrl() {
  const url = new URL(location.href);
  GR_URL_KEYS.forEach(k => url.searchParams.delete(k));
  grStateToParams(grState).forEach((v, k) => url.searchParams.set(k, v));
  history.replaceState(null, '', url);
}

function grUpdate() {
  grSyncControls();
  grRenderChips();
  grScene = grBuildScene(grState, grPlayers, grSlots);
  grRenderMeta();
  grDraw();
  grRenderTable();
  grSyncUrl();
}

// ── Exportar / compartir ──
function grTrackInfo() { return { tipo: grState.tipo, unidad: grState.tipo === 'lineas' ? 'temporada' : grState.u, metrica: grState.tipo === 'lineas' ? grState.m : `${grState.y}~${grState.x}`, n: grState.ids.length }; }
function grPngFmt() { const el = document.getElementById('gr-fmt'); return el && el.value === 'v' ? 'v' : 'h'; }
function grDescargaImagen(bl) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = 'grafico-espanoles-nba.png';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function grDownload() {
  if (!grScene || grScene.empty) return;
  track('grafico_descargar', grTrackInfo());
  try { const c = await grBuildImage(grScene, grScene.legend, grPngFmt()); grDescargaImagen(await qntBlob(c)); }
  catch (e) { alert('No se pudo generar la imagen.'); }
}
async function grShare() {
  if (!grScene || grScene.empty) return;
  grSyncUrl();
  track('compartir', Object.assign({ metodo: 'twitter', origen: 'graficos' }, grTrackInfo()));
  const texto = `${grScene.title} 📈 #EspañolesNBA (vía @alejandroggo)`;
  const url = location.href;
  const xIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto + '\n\n' + url)}`;
  const isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!isTouch) {
    window.open(xIntent, '_blank', 'noopener,noreferrer');
    try { const c = await grBuildImage(grScene, grScene.legend, grPngFmt()); grDescargaImagen(await qntBlob(c)); } catch (e) { }
    return;
  }
  try {
    const c = await grBuildImage(grScene, grScene.legend, grPngFmt()); const bl = await qntBlob(c);
    const file = new File([bl], 'grafico-espanoles-nba.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `${texto}\n\n${url}` }); return; }
    grDescargaImagen(bl);
  } catch (e) { if (e && e.name === 'AbortError') return; }
  window.open(xIntent, '_blank', 'noopener,noreferrer');
}
async function grCopyLink(btn) {
  grSyncUrl();
  track('compartir', Object.assign({ metodo: 'enlace', origen: 'graficos' }, grTrackInfo()));
  let ok = false;
  try { await navigator.clipboard.writeText(location.href); ok = true; } catch (e) { }
  if (!ok) { window.prompt('Copia el enlace del gráfico:', location.href); return; }
  const prev = btn.textContent; btn.textContent = '¡Enlace copiado!';
  setTimeout(() => { btn.textContent = prev; }, 2000);
}


// ══════════════════════════════════════════════
// PAREJAS (compañeros) — página oculta del menú
// ══════════════════════════════════════════════
// Mapa compartido nombre→jugador (para fotos en parejas y cara a cara)
let AG_NAME2PLAYER = null;
let PJ_DATA = [];
async function agNamePlayerMap() {
  if (AG_NAME2PLAYER) return AG_NAME2PLAYER;
  const d = await loadData();
  const m = {};
  (d.jugadores || []).forEach(j => { m[drNorm(j.nombre)] = j; });
  AG_NAME2PLAYER = m;
  return m;
}
function agPhotoImg(name, cls) {
  const j = (AG_NAME2PLAYER || {})[drNorm(name)];
  if (!j) return '';
  return '<img class="' + cls + '" ' + agFotoSrc2(j.id, agFotoFb(j)) + ' alt="' + name + '" loading="lazy" onerror="agImgHide(this)">';
}

function pjCol(eq) {
  const m = [['Dallas', '#0053bc'], ['Toronto', '#CE1141'], ['Portland', '#E03A3E'],
  ['Chicago', '#CE1141'], ['Minnesota', '#236192'], ['Memphis', '#5D76A9']];
  for (const [k, c] of m) if ((eq || '').includes(k)) return c;
  return '#b91c1c';
}
function pjIni(nm) {
  const w = (nm || '').trim().split(/\s+/);
  return ((w[0] || ' ')[0] + (w[w.length - 1] || ' ')[0]).toUpperCase();
}
function pjDec1(v) { return (v === null || v === undefined) ? '—' : (typeof v === 'number' ? v.toFixed(1) : ('' + v)).replace('.', ','); }
function pjNum(v) { return (v === null || v === undefined) ? '—' : ('' + v).replace('.', ','); }
function pjPhoto(name, color) {
  const img = agPhotoImg(name, 'pj-img');
  if (img) return '<div class="pj-photo" style="border-color:' + color + '">' + img + '</div>';
  return '<div class="pj-disc" style="background:' + color + '">' + pjIni(name) + '</div>';
}

function pjCard(p, idx) {
  const c = pjCol(p.equipo), gold = p.en_activo;
  let badge;
  if (gold) badge = '<span class="pj-badge gold"><span class="pj-liv"></span>EN ACTIVO</span>';
  else if (p.campeones) badge = '<span class="pj-badge champ">🏆 CAMPEONES 2019</span>';
  else badge = '<span class="pj-era">' + p.era + '</span>';

  const keys = Object.keys(p.pts).filter(k => k !== 'juntos');
  const ka = keys[0], kb = keys[1];
  const row = (lbl, cat) => {
    const d = p[cat];
    const jv = d.juntos === null || d.juntos === undefined ? '—'
      : (cat === 'min' ? String(Math.round(d.juntos)) : pjDec1(d.juntos));
    return '<tr><th>' + lbl + '</th><td>' + pjDec1(d[ka]) + '</td><td>' + pjDec1(d[kb]) + '</td><td class="jt">' + jv + '</td></tr>';
  };
  const rows = row('Minutos', 'min') + row('Puntos', 'pts') + row('Rebotes', 'reb') + row('Asist.', 'ast');
  const vic = (p.victorias_pct !== null && p.victorias_pct !== undefined) ? pjDec1(p.victorias_pct) + '%' : '—';
  const rec = p.record || 'por empezar';
  const pj = pjNum(p.partidos_juntos);

  const oc = p.oncourt;
  let ocblock, octitle;
  if (oc) {
    const net = oc.net, nets = (net >= 0 ? '+' : '') + pjDec1(net);
    ocblock = '<div class="pj-oc"><div><div class="v">' + pjDec1(oc.off) + '</div><div class="l">Rtg of.</div></div>'
      + '<div><div class="v">' + pjDec1(oc.def) + '</div><div class="l">Rtg def.</div></div>'
      + '<div><div class="v net">' + nets + '</div><div class="l">Net Rtg</div></div></div>';
    octitle = '🏀 Con los dos en pista' + (oc.min ? ' · ' + oc.min + ' min' : '');
  } else {
    ocblock = '<div class="pj-oc"><div><div class="v dim">—</div><div class="l">Rtg of.</div></div><div><div class="v dim">—</div><div class="l">Rtg def.</div></div><div><div class="v dim">—</div><div class="l">Net Rtg</div></div></div>';
    octitle = '🏀 Con los dos en pista';
  }
  const ocnote = p.oncourt_nota ? '<div class="pj-note">' + p.oncourt_nota + '</div>' : '';
  const ae = p.asist_entre, aek = Object.keys(ae || {});
  const conn = aek.length ? '<div class="pj-conn"><div><div class="v">' + pjNum(ae[aek[0]]) + '</div><div class="l">' + aek[0] + '</div></div>'
    + '<div><div class="v">' + pjNum(ae[aek[1]]) + '</div><div class="l">' + aek[1] + '</div></div></div>' : '';
  const po = p.playoffs ? '<div class="pj-po">🏀 Playoffs · ' + p.playoffs + '</div>' : '';
  const facts = (p.facts || []).map(f => '<div class="pj-fact"><span class="ic">•</span><div>' + f + '</div></div>').join('');

  return '<div class="pj-card' + (gold ? ' gold' : '') + '">'
    + '<div class="pj-top"><span class="pj-team"><span class="pj-tdot" style="background:' + c + '"></span>' + (p.equipo || '').toUpperCase() + '</span>' + badge + '</div>'
    + '<div class="pj-duo"><div class="pj-pl">' + pjPhoto(p.a, c) + '<div class="n">' + p.a + '</div></div>'
    + '<span class="pj-amp">&amp;</span><div class="pj-pl">' + pjPhoto(p.b, c) + '<div class="n">' + p.b + '</div></div></div>'
    + '<div class="pj-block"><div><div class="big">' + pj + '</div><div class="lbl">partidos juntos</div></div>'
    + '<div><div class="big">' + vic + '</div><div class="lbl">victorias</div><div class="mini">' + rec + '</div></div></div>'
    + '<table class="pj-table"><thead><tr><th class="l"></th><th>' + ka + '</th><th>' + kb + '</th><th class="jt">Juntos</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div class="pj-sect"><div class="t">' + octitle + '</div>' + ocblock + '</div>' + ocnote
    + '<div class="pj-sect"><div class="t">🔗 Se asistieron entre ellos</div>' + conn + '</div>' + po
    + '<div class="pj-facts">' + facts + '</div>'
    + pjShareBar(idx, p)
    + '</div>';
}

async function initParejasPage() {
  const root = document.getElementById('pj-root');
  if (!root) return;
  let P;
  try {
    P = await fetch('data/parejas.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(); return r.json(); });
  } catch (e) {
    root.innerHTML = '<p class="pj-err">No se pudieron cargar las parejas.</p>';
    return;
  }
  try { await agNamePlayerMap(); } catch (e) { }
  const sub = document.getElementById('pj-hero-sub');
  if (sub) sub.innerHTML = 'Españoles que compartieron vestuario en la NBA · números como dúo, rendimiento con los dos en pista y cómo se conectaban.';
  PJ_DATA = P;
  root.innerHTML = '<div class="pj-grid">' + P.map((p, i) => pjCard(p, i)).join('') + '</div>';
}

// ── Compartir pareja: botón + imagen PNG (canvas, sin librerías) ──
function pjShareBar(idx, p) {
  const xIco = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  return '<button type="button" class="pj-sharebar" onclick="pjShare(' + idx + ')" aria-label="Compartir la pareja ' + p.a + ' y ' + p.b + ' en X">'
    + '<span class="pj-sb-txt"><span class="pj-sb-kicker">Comparte esta pareja</span><span class="pj-sb-sub">' + p.a + ' &amp; ' + p.b + ' · imagen lista para X</span></span>'
    + '<span class="pj-sb-go"><span class="pj-sb-lbl">Compartir</span><span class="pj-sb-x">' + xIco + '</span><span class="pj-sb-arrow">→</span></span>'
    + '</button>';
}
function pjFilename(p) { return ('pareja-' + drNorm(p.a) + '-' + drNorm(p.b)).replace(/\s+/g, '-') + '.png'; }
function pjDescargaImg(bl, p) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = pjFilename(p);
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function pjShare(idx) {
  const p = PJ_DATA[idx]; if (!p) return;
  try { track('compartir', { metodo: 'twitter', origen: 'parejas', pareja: p.a + ' & ' + p.b }); } catch (e) { }
  const texto = p.a + ' & ' + p.b + ' — la pareja española en la NBA 🏀 #EspañolesNBA (vía @alejandroggo)';
  const url = location.href;
  const xIntent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(texto + '\n\n' + url);
  const isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!isTouch) {
    window.open(xIntent, '_blank', 'noopener,noreferrer');
    try { const c = await pjBuildImage(p); pjDescargaImg(await qntBlob(c), p); } catch (e) { }
    return;
  }
  try {
    const c = await pjBuildImage(p); const bl = await qntBlob(c);
    const file = new File([bl], pjFilename(p), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto + '\n\n' + url }); return; }
    pjDescargaImg(bl, p);
  } catch (e) { if (e && e.name === 'AbortError') return; }
  window.open(xIntent, '_blank', 'noopener,noreferrer');
}
async function pjBuildImage(p) {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { }
  const CO = { bg: '#0e0e10', panel: '#17171d', line: 'rgba(255,255,255,.08)', coral: '#f2545b', yellow: '#ffc400', gold: '#f5c518', text: '#e9e9ec', muted: '#9a9aa5', red: '#c60b1e', green: '#2faa66' };
  const d1 = v => (v === null || v === undefined) ? '—' : (typeof v === 'number' ? v.toFixed(1) : ('' + v)).replace('.', ',');
  const i0 = v => (v === null || v === undefined) ? '—' : String(Math.round(v));
  const col = pjCol(p.equipo);
  const keys = Object.keys(p.pts).filter(k => k !== 'juntos'); const ka = keys[0], kb = keys[1];
  const mkRow = (lbl, cat) => [lbl, d1(p[cat][ka]), d1(p[cat][kb]), (cat === 'min' ? i0(p[cat].juntos) : d1(p[cat].juntos))];
  const rows = [mkRow('MINUTOS', 'min'), mkRow('PUNTOS', 'pts'), mkRow('REBOTES', 'reb'), mkRow('ASIST.', 'ast')];
  const oc = p.oncourt, ae = p.asist_entre || {}, aek = Object.keys(ae);
  const W = 1080;
  const HEAD = 490, BIG = 134, THEAD = 54, TROW = 60, TAB = THEAD + 4 * TROW, OC = 142, AS = 126, PO = p.playoffs ? 72 : 0, FOOT = 94, GAP = 18;
  const H = HEAD + GAP + BIG + GAP + TAB + GAP + OC + GAP + AS + (PO ? GAP + PO : 0) + GAP + FOOT;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const rr = (X, Y, Wd, Hd, R) => { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + Wd, Y, X + Wd, Y + Hd, R); x.arcTo(X + Wd, Y + Hd, X, Y + Hd, R); x.arcTo(X, Y + Hd, X, Y, R); x.arcTo(X, Y, X + Wd, Y, R); x.closePath(); };
  x.fillStyle = CO.bg; x.fillRect(0, 0, W, H);
  const flag = y => { x.fillStyle = CO.red; x.fillRect(0, y, W, 10); x.fillStyle = CO.yellow; x.fillRect(W * 0.30, y, W * 0.40, 10); x.fillStyle = CO.red; x.fillRect(W * 0.70, y, W * 0.30, 10); };
  flag(0); flag(H - 10);
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.fillStyle = CO.yellow; x.font = '700 24px Inter, sans-serif'; x.save(); x.letterSpacing = '6px'; x.fillText('ESPAÑOLES EN LA NBA', W / 2, 58); x.restore();
  x.fillStyle = CO.muted; x.font = '600 22px Inter, sans-serif'; x.save(); x.letterSpacing = '3px'; x.fillText('LAS PAREJAS', W / 2, 92); x.restore();
  x.fillStyle = CO.text; x.font = '800 34px Inter, sans-serif'; x.fillText((p.equipo || '').toUpperCase(), W / 2, 140);
  const badge = p.en_activo ? 'EN ACTIVO' : (p.campeones ? '★ CAMPEONES 2019' : (p.era ? 'ERA ' + p.era : ''));
  if (badge) { x.fillStyle = (p.en_activo || p.campeones) ? CO.gold : CO.muted; x.font = '700 20px Inter, sans-serif'; x.save(); x.letterSpacing = '2px'; x.fillText(badge, W / 2, 172); x.restore(); }
  const cols = [W * 0.28, W * 0.72], cy = 300, r = 90;
  const pa = (AG_NAME2PLAYER || {})[drNorm(p.a)], pb = (AG_NAME2PLAYER || {})[drNorm(p.b)];
  const imgs = await Promise.all([pa, pb].map(j => j ? qntLoadImg('img/players/' + j.id + '.jpg') : Promise.resolve(null)));
  const drawFace = (cx, img, name) => {
    x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.closePath(); x.clip();
    if (img) { const s = Math.max(2 * r / img.width, 2 * r / img.height); const w = img.width * s, h = img.height * s; x.drawImage(img, cx - w / 2, cy - h / 2 - r * 0.12, w, h); }
    else { x.fillStyle = qntAvatarColor(name); x.fillRect(cx - r, cy - r, 2 * r, 2 * r); x.fillStyle = '#fff'; x.font = '700 52px Inter, sans-serif'; x.textBaseline = 'middle'; x.fillText(qntInitials(name), cx, cy); x.textBaseline = 'alphabetic'; }
    x.restore();
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.strokeStyle = col; x.lineWidth = 5; x.stroke();
  };
  drawFace(cols[0], imgs[0], p.a); drawFace(cols[1], imgs[1], p.b);
  x.fillStyle = CO.yellow; x.font = '400 56px "DM Serif Display", Georgia, serif'; x.fillText('&', W / 2, cy + 18);
  x.fillStyle = CO.text; x.font = '800 30px Inter, sans-serif';
  x.fillText(cmpShortName(p.a, 2), cols[0], cy + r + 48);
  x.fillText(cmpShortName(p.b, 2), cols[1], cy + r + 48);
  // banda de grandes cifras
  let y = HEAD + GAP;
  x.fillStyle = CO.panel; rr(40, y, W - 80, BIG - 8, 18); x.fill();
  x.beginPath(); x.moveTo(W / 2, y + 18); x.lineTo(W / 2, y + BIG - 26); x.strokeStyle = CO.line; x.lineWidth = 2; x.stroke();
  const bcy = y + (BIG - 8) / 2;
  x.textAlign = 'center';
  x.fillStyle = CO.coral; x.font = '800 58px Inter, sans-serif'; x.fillText(i0(p.partidos_juntos), W * 0.28, bcy + 4);
  x.fillStyle = CO.muted; x.font = '700 18px Inter, sans-serif'; x.save(); x.letterSpacing = '2px'; x.fillText('PARTIDOS JUNTOS', W * 0.28, bcy + 38); x.restore();
  const vic = p.victorias_pct == null ? '—' : ('' + p.victorias_pct).replace('.', ',') + '%';
  x.fillStyle = CO.coral; x.font = '800 58px Inter, sans-serif'; x.fillText(vic, W * 0.72, bcy + 4);
  x.fillStyle = CO.muted; x.font = '700 18px Inter, sans-serif'; x.save(); x.letterSpacing = '1px'; x.fillText('VICTORIAS' + (p.record ? ' · ' + p.record : ''), W * 0.72, bcy + 38); x.restore();
  // tabla de medias
  y += BIG + GAP;
  const cA = W * 0.52, cB = W * 0.70, cJ = W * 0.90, lx = 74;
  x.textAlign = 'center'; x.fillStyle = CO.muted; x.font = '700 18px Inter, sans-serif';
  x.fillText(cmpShortName(p.a, 2).toUpperCase(), cA, y + 34);
  x.fillText(cmpShortName(p.b, 2).toUpperCase(), cB, y + 34);
  x.fillStyle = CO.coral; x.fillText('JUNTOS', cJ, y + 34);
  y += THEAD;
  rows.forEach((rw, k) => {
    if (k % 2 === 0) { x.fillStyle = CO.panel; rr(40, y, W - 80, TROW, 12); x.fill(); }
    const ry = y + TROW / 2; x.textBaseline = 'middle';
    x.textAlign = 'left'; x.fillStyle = CO.muted; x.font = '700 20px Inter, sans-serif'; x.fillText(rw[0], lx, ry);
    x.textAlign = 'center'; x.fillStyle = CO.text; x.font = '800 26px Inter, sans-serif';
    x.fillText(rw[1], cA, ry); x.fillText(rw[2], cB, ry);
    x.fillStyle = CO.coral; x.fillText(rw[3], cJ, ry);
    x.textBaseline = 'alphabetic'; y += TROW;
  });
  // con los dos en pista
  y += GAP;
  x.fillStyle = CO.panel; rr(40, y, W - 80, OC - 8, 18); x.fill();
  x.textAlign = 'center'; x.fillStyle = CO.muted; x.font = '700 18px Inter, sans-serif';
  x.save(); x.letterSpacing = '2px'; x.fillText('CON LOS DOS EN PISTA' + (oc && oc.min ? ' · ' + oc.min + ' MIN' : ''), W / 2, y + 32); x.restore();
  const ocCols = [W * 0.25, W * 0.5, W * 0.75], ocy = y + (OC - 8) / 2 + 24;
  const net = oc ? oc.net : null;
  const ocVals = [oc ? d1(oc.off) : '—', oc ? d1(oc.def) : '—', oc ? ((net >= 0 ? '+' : '') + d1(net)) : '—'];
  const ocLbls = ['RTG OF.', 'RTG DEF.', 'NET RTG'];
  ocVals.forEach((v, i) => { x.fillStyle = oc ? (i === 2 ? (net >= 0 ? CO.green : CO.coral) : CO.text) : CO.muted; x.font = '800 42px Inter, sans-serif'; x.fillText(v, ocCols[i], ocy); x.fillStyle = CO.muted; x.font = '700 16px Inter, sans-serif'; x.save(); x.letterSpacing = '1px'; x.fillText(ocLbls[i], ocCols[i], ocy + 30); x.restore(); });
  // asistencias entre ellos
  y += OC + GAP;
  x.fillStyle = CO.panel; rr(40, y, W - 80, AS - 8, 18); x.fill();
  x.beginPath(); x.moveTo(W / 2, y + 18); x.lineTo(W / 2, y + AS - 26); x.strokeStyle = CO.line; x.lineWidth = 2; x.stroke();
  x.textAlign = 'center'; x.fillStyle = CO.muted; x.font = '700 16px Inter, sans-serif'; x.save(); x.letterSpacing = '2px'; x.fillText('SE ASISTIERON ENTRE ELLOS', W / 2, y + 30); x.restore();
  const asCols = [W * 0.28, W * 0.72], asy = y + (AS - 8) / 2 + 24;
  [0, 1].forEach(i => { const k = aek[i]; x.fillStyle = CO.text; x.font = '800 44px Inter, sans-serif'; x.fillText(k != null ? i0(ae[k]) : '—', asCols[i], asy); x.fillStyle = CO.muted; x.font = '600 18px Inter, sans-serif'; x.fillText(k || '', asCols[i], asy + 30); });
  // playoffs
  if (PO) {
    y += AS + GAP; x.fillStyle = 'rgba(245,197,24,.14)'; rr(40, y, W - 80, PO - 8, 14); x.fill();
    x.textAlign = 'left'; x.fillStyle = CO.gold; x.font = '700 22px Inter, sans-serif'; x.textBaseline = 'middle';
    x.fillText('🏀 PLAYOFFS · ' + p.playoffs, 74, y + (PO - 8) / 2); x.textBaseline = 'alphabetic';
  }
  // pie
  x.textAlign = 'left'; x.fillStyle = CO.text; x.font = '700 24px Inter, sans-serif'; x.fillText('espanoles-nba.alejandroggo.com', 60, H - 40);
  x.textAlign = 'right'; x.fillStyle = CO.yellow; x.font = '700 24px Inter, sans-serif'; x.fillText('@alejandroggo · #EspañolesNBA', W - 60, H - 40);
  return c;
}

// ══════════════════════════════════════════════
// CARA A CARA — matriz (página oculta del menú)
// ══════════════════════════════════════════════
const CC_SHORT2FULL = {
  'Pau': 'Pau Gasol', 'Marc': 'Marc Gasol', 'Chacho': 'Sergio Rodríguez', 'Ibaka': 'Serge Ibaka',
  'Ricky': 'Ricky Rubio', 'Calderón': 'José M. Calderón', 'Mirotić': 'Nikola Mirotic', 'Rudy': 'Rudy Fernández',
  'Raül': 'Raül Lopez', 'Garuba': 'Usman Garuba', 'Abrines': 'Alex Abrines', 'Willy': 'Willy Hernangómez',
  'Juancho': 'Juancho Hernangómez', 'Aldama': 'Santi Aldama', 'Hugo': 'Hugo González',
  'Navarro': 'Juan Carlos Navarro', 'Garbajosa': 'Jorge Garbajosa', 'Claver': 'Víctor Claver'
};
function ccNrm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function ccParseRec(rec, a, b) {
  const m = /(\d+)\s*-\s*(\d+)/.exec(rec);
  if (!m) return [0, 0];
  const w = +m[1], l = +m[2];
  if (ccNrm(rec).startsWith('igualado')) return [w, l];
  const head = ccNrm(rec.slice(0, m.index)).trim();
  let winner = null;
  for (const [sh, full] of Object.entries(CC_SHORT2FULL)) {
    if (head.startsWith(ccNrm(sh))) { winner = full; break; }
  }
  if (winner === a) return [w, l];
  if (winner === b) return [l, w];
  return [w, l];
}
function ccIni(nm) { const w = nm.split(/\s+/); return (w[0][0] + w[w.length - 1][0]).toUpperCase(); }
function ccTint(w, l) {
  if (w === l) return 'background:var(--surface-2)';
  const tot = w + l, frac = Math.abs(w - l) / tot, a = 0.14 + 0.5 * frac;
  const c = w > l ? 'var(--win)' : 'var(--loss)';
  return 'background:color-mix(in srgb,' + c + ' ' + (a * 100).toFixed(0) + '%,transparent);color:' + (frac > 0.55 ? '#fff' : 'var(--text)');
}

async function initCaraACaraPage() {
  const host = document.getElementById('cc-root');
  if (!host) return;
  let D;
  try {
    D = await fetch('data/duelos.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(); return r.json(); });
  } catch (e) {
    host.innerHTML = '<p class="cc-err">No se pudieron cargar los duelos.</p>';
    return;
  }
  try { await agNamePlayerMap(); } catch (e) { }
  const FULL2SHORT = {};
  for (const [sh, full] of Object.entries(CC_SHORT2FULL)) FULL2SHORT[full] = sh;

  const cell = {}, duel = {}, games = {};
  for (const d of D) {
    const a = d.a, b = d.b;
    const [wa, la] = ccParseRec(d.rec, a, b);
    cell[a + '|' + b] = [wa, la]; cell[b + '|' + a] = [la, wa];
    duel[[a, b].sort().join('|')] = d;
    for (const p of [a, b]) games[p] = (games[p] || 0) + d.g;
  }
  const players = Object.keys(games).sort((x, y) => games[y] - games[x]);
  const P = players.map(p => ({ full: p, short: FULL2SHORT[p] || p.split(/\s+/).pop(), ini: ccIni(p) }));

  // récord total de cada jugador (suma de todos sus duelos)
  const totalRec = {};
  players.forEach(a => {
    let w = 0, l = 0;
    players.forEach(b => { const c = cell[a + '|' + b]; if (c) { w += c[0]; l += c[1]; } });
    totalRec[a] = [w, l];
  });
  const ccHead = p => { const im = agPhotoImg(p.full, 'cc-ph'); return im || p.ini; };
  const ccRowHead = rp => { const im = agPhotoImg(rp.full, 'cc-ph'); return im ? ('<span class="cc-rh-in">' + im + '<span>' + rp.short + '</span></span>') : rp.short; };

  let html = '<tr><th class="cc-corner">fila&nbsp;vs&nbsp;col</th>';
  P.forEach(p => { html += '<th class="cc-ch" title="' + p.full + '">' + ccHead(p) + '</th>'; });
  html += '<th class="cc-ch cc-tot-h" title="Récord total">TOT</th></tr>';
  P.forEach((rp, i) => {
    html += '<tr><th class="cc-rh" title="' + rp.full + '">' + ccRowHead(rp) + '</th>';
    P.forEach((cp, j) => {
      if (i === j) { html += '<td class="cc-diag"></td>'; return; }
      const c = cell[rp.full + '|' + cp.full];
      if (!c) { html += '<td class="cc-none">·</td>'; return; }
      html += '<td class="cc-cell" style="' + ccTint(c[0], c[1]) + '" data-i="' + i + '" data-j="' + j + '">' + c[0] + '-' + c[1] + '</td>';
    });
    const tr = totalRec[rp.full];
    html += '<td class="cc-tot" title="Récord total">' + tr[0] + '-' + tr[1] + '</td>';
    html += '</tr>';
  });
  document.getElementById('cc-mx').innerHTML = html;

  const det = document.getElementById('cc-detail');
  document.getElementById('cc-mx').addEventListener('click', e => {
    const td = e.target.closest('td.cc-cell'); if (!td) return;
    const A = P[+td.dataset.i].full, B = P[+td.dataset.j].full;
    const d = duel[[A, B].sort().join('|')]; if (!d) return;
    const av = d.av, mn = d.min || {}, ks = [d.a, d.b];
    const hasMin = mn[d.a] || mn[d.b];
    const rows = ks.map(k => '<tr><td class="l">' + k + '</td>' + (hasMin ? '<td>' + (mn[k] || '—') + '</td>' : '') + '<td>' + av[k] + '</td></tr>').join('');
    const dates = (d.primer && d.ultimo) ? '<div class="cc-ddates">Primer duelo <b>' + d.primer + '</b> · último <b>' + d.ultimo + '</b></div>' : '';
    let po = '';
    if (d.playoffs && d.playoffs.length) {
      po = '<div class="cc-dpo"><div class="cc-dpo-h">En playoffs</div>' + d.playoffs.map(s =>
        '<div class="cc-dpo-row"><span class="yr">' + s.temporada + '</span><span class="sr">' + s.serie + '<br><span class="rd">' + s.ronda + '</span></span></div>').join('') + '</div>';
    }
    det.className = 'cc-detail';
    det.innerHTML = '<div class="cc-dhead">' + d.a + '<span class="vs">vs</span>' + d.b + '</div>'
      + '<div class="cc-drec">' + d.rec + ' · ' + d.g + ' partidos</div>' + dates
      + '<table class="cc-dtbl"><thead><tr><th class="l"></th>' + (hasMin ? '<th>min</th>' : '') + '<th>pts/reb/ast</th></tr></thead><tbody>' + rows + '</tbody></table>' + po;
    det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // ── Tarjetas premium: las rivalidades con más de 10 enfrentamientos ──
  const shortOf = full => FULL2SHORT[full] || full.split(/\s+/).pop();
  const yr = s => { const m = String(s || '').match(/\d{4}/); return m ? m[0] : ''; };
  const premCard = d => {
    const m = d.rec.match(/^(.*?)(?:\s*\((.*)\))?$/);
    const recMain = m[1].trim(), recSub = (m[2] || '').trim();
    const mn = d.min || {};
    const plLine = full => {
      const im = agPhotoImg(full, 'cc-prem-ph');
      const mnTxt = mn[full] ? '<span class="cc-prem-min">' + mn[full] + ' min</span>' : '';
      return '<div class="cc-prem-pl">' + (im || '<span class="cc-prem-ph"></span>')
        + '<div class="cc-prem-pln"><span class="cc-prem-nm">' + shortOf(full) + '</span>' + mnTxt + '</div>'
        + '<div class="cc-prem-av">' + (d.av ? d.av[full] : '') + '</div></div>';
    };
    const po = (d.playoffs && d.playoffs.length)
      ? '<div class="cc-prem-po">' + d.playoffs.map(s => '<span><b>' + s.temporada + '</b> ' + s.serie + '</span>').join('') + '</div>' : '';
    const nota = d.nota ? '<div class="cc-prem-note">' + d.nota + '</div>' : '';
    const span = (yr(d.primer) && yr(d.ultimo)) ? ' · ' + yr(d.primer) + '–' + yr(d.ultimo) : '';
    return '<div class="cc-prem-card">'
      + '<div class="cc-prem-head"><span class="cc-prem-rec">' + recMain + '</span>'
      + (recSub ? '<span class="cc-prem-sub">' + recSub + '</span>' : '')
      + '<span class="cc-prem-g">' + d.g + ' partidos' + span + '</span></div>'
      + '<div class="cc-prem-body">' + plLine(d.a) + plLine(d.b) + '</div>'
      + po + nota + '</div>';
  };
  const prem = D.filter(d => d.g > 10).sort((a, b) => b.g - a.g);
  const wrap = document.createElement('section');
  wrap.className = 'cc-prem-wrap';
  wrap.setAttribute('aria-label', 'Los grandes duelos');
  wrap.innerHTML = '<h2 class="cc-prem-title">Los grandes <em>duelos</em></h2>'
    + '<p class="cc-prem-lead">Las rivalidades que se vieron más de 10 veces — récord, medias por partido y playoffs.</p>'
    + '<div class="cc-prem-grid">' + prem.map(premCard).join('') + '</div>';
  host.parentNode.appendChild(wrap);
}

// ══════════════════════════════════════════════
// SALARIOS POR EQUIPO — página oculta del menú
// ══════════════════════════════════════════════
const SE_COL = { MEM: '#5D76A9', TOR: '#CE1141', LAL: '#552583', MIN: '#236192', OKC: '#007ac1', SAS: '#8a8d8f', SAC: '#5a2d81', CHI: '#CE1141', UTA: '#5c2f83', CLE: '#860038', NOP: '#0C2340', NYK: '#f58426', LAC: '#1d428a', PHX: '#e56020', DET: '#1d428a', POR: '#E03A3E', MIL: '#00471B', DEN: '#0e2240', ORL: '#0077c0', IND: '#002d62', PHI: '#006bb6', DAL: '#00538c', HOU: '#ce1141', CHA: '#1d1160', BOS: '#007a33', GSW: '#1d428a', ATL: '#e03a3e' };
const SE_DISP = { 'Pau Gasol': 'Pau', 'Marc Gasol': 'Marc', 'Raül Lopez': 'Raül', 'Raül López': 'Raül', 'Fernando Martín': 'F. Martín', 'José M. Calderón': 'Calderón', 'Sergio Rodríguez': 'Chacho', 'Serge Ibaka': 'Ibaka', 'Ricky Rubio': 'Ricky', 'Nikola Mirotić': 'Mirotić', 'Nikola Mirotic': 'Mirotić', 'Santi Aldama': 'Aldama', 'Usman Garuba': 'Garuba', 'Alex Abrines': 'Abrines', 'Álex Abrines': 'Abrines', 'Willy Hernangómez': 'Willy', 'Juancho Hernangómez': 'Juancho', 'Víctor Claver': 'Claver', 'Jorge Garbajosa': 'Garbajosa', 'Juan Carlos Navarro': 'Navarro', 'Hugo González': 'Hugo', 'Aday Mara': 'Aday', 'Baba Miller': 'Baba', 'Sergio de Larrea': 'De Larrea', 'Eli Ndiaye': 'Ndiaye' };
// Fotos de jugadores aún no presentes en data.json (override manual)
const SE_PHOTO = { 'Eli Ndiaye': 'img/players/eli-ndiaye.jpg' };
function seIni(nm) { const w = (nm || '').trim().split(/\s+/); return (((w[0] || ' ')[0]) + ((w[w.length - 1] || ' ')[0])).toUpperCase(); }
function seMoney(n) { return n >= 1e6 ? ('$' + (n / 1e6).toFixed(1) + ' M').replace('.', ',') : (n > 0 ? '$' + Math.round(n / 1e3) + ' K' : '$0'); }
function seDollar(n) { return n ? '$' + Math.round(n).toLocaleString('de-DE') : '—'; }

