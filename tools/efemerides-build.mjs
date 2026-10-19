// Adaptador de desarrollo: carga app.js en un sandbox de SOLO LECTURA (igual que
// tools/test-graficos.mjs) y expone sus funciones reales para que el núcleo del
// generador NO tenga que duplicar ni las plantillas de texto (efmBuild) ni el
// compositor del tuit (efmShare).
//
// No modifica app.js ni el DOM real; no escribe nada. Es la "capa de reutilización"
// entre el código de la web y el núcleo puro del generador.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}
function makeEl() {
  let html = '';
  return {
    set innerHTML(v) { html = String(v == null ? '' : v); },
    get innerHTML() { return html; },
    get textContent() { return decodeEntities(html.replace(/<[^>]*>/g, '')); },
  };
}

// Crea un sandbox con app.js cargado y devuelve ayudantes de reutilización.
export function createAppSandbox(appPath = path.join(ROOT, 'app.js')) {
  const noop = () => {};
  let opened = null;
  const ctx = {
    console, URL, URLSearchParams, Intl, setTimeout, clearTimeout, Date, Math, JSON,
    encodeURIComponent, decodeURIComponent,
    location: { href: 'https://espanoles-nba.alejandroggo.com/efemerides.html', search: '', pathname: '/efemerides.html', origin: 'https://espanoles-nba.alejandroggo.com' },
    history: { replaceState: noop },
    window: { matchMedia: () => ({ matches: false, addEventListener: noop }), addEventListener: noop, open: (u) => { opened = u; } },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, createElement: () => makeEl() },
    navigator: {}, localStorage: { getItem: () => null, setItem: noop },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(appPath, 'utf8'), ctx);
  const G = n => vm.runInContext(n, ctx);
  vm.runInContext('globalThis.__setEfm = function(ev, m, d){ efmCurrentList=[ev]; efmMonth=m; efmDay=d; };', ctx);
  const efmShare = G('efmShare');

  // Construye los eventos tal cual lo hace la web (reutiliza efmBuild).
  function buildEvents(data) {
    G('buildPlayerIds')(data.jugadores);
    return G('efmBuild')(data);
  }

  // Compone el tuit EXACTAMENTE como efmShare (captura el intent de window.open).
  function tweetTextFor(ev) {
    opened = null;
    ctx.__setEfm(ev, ev.m, ev.d);
    efmShare(null, 0);
    if (!opened) return null;
    return new URL(opened).searchParams.get('text');
  }

  return { ctx, G, buildEvents, tweetTextFor };
}
