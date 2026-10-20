// Paridad del port de Apps Script (FASE 4, Bloque A): garantiza que
// tools/apps-script/efemerides-generador.gs (efgBuild/efgTweet) produce
// EXACTAMENTE los mismos eventos y textos que el app.js real (efmBuild/efmShare).
// Si divergen, falla. Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createAppSandbox } from '../tools/efemerides-build.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));

// ── Carga del .gs en un sandbox aparte (es JS plano, sin import/export) ──
function loadGs() {
  const code = fs.readFileSync(path.join(ROOT, 'tools', 'apps-script', 'efemerides-generador.gs'), 'utf8');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return {
    efgBuild: vm.runInContext('efgBuild', ctx),
    efgTweet: vm.runInContext('efgTweet', ctx),
  };
}

const gs = loadGs();
const sb = createAppSandbox();

// Eventos "verdad" (app.js) y del port (.gs), con el mismo data.json real.
const truth = sb.buildEvents(data);
const mine = gs.efgBuild(data);

// Proyección a objeto plano del host (evita falsos negativos por realm del vm).
const proj = e => ({ kind: e.kind, player: e.player || '', m: e.m, d: e.d, year: e.year, tag: String(e.tag || ''), html: e.html || '' });
const keyOf = e => `${e.kind}|${(e.player || '').toLowerCase()}|${e.year}-${e.m}-${e.d}|${e.html}`;
// Array.from (host) evita falsos negativos por el realm del vm.
const sortByKey = arr => Array.from(arr, proj).sort((a, b) => keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : 0);

test('paridad efgBuild ↔ efmBuild: mismo nº de eventos', () => {
  assert.equal(mine.length, truth.length, `eventos: port=${mine.length} vs app.js=${truth.length}`);
});

test('paridad efgBuild ↔ efmBuild: mismos eventos (kind, jugador, fecha, tag, html exactos)', () => {
  const a = sortByKey(truth);
  const b = sortByKey(mine);
  assert.deepEqual(b, a);
});

test('paridad efgTweet ↔ efmShare: mismo texto de tuit para cada evento real', () => {
  // Usamos los eventos "verdad" en ambos para aislar la composición del tuit.
  const fallos = [];
  for (const ev of truth) {
    const esperado = sb.tweetTextFor(ev);   // efmShare real
    const obtenido = gs.efgTweet({ html: ev.html, player: ev.player, m: ev.m, d: ev.d, year: ev.year });
    if (esperado !== obtenido) fallos.push({ ev: keyOf(proj(ev)), esperado, obtenido });
  }
  assert.deepEqual(fallos, [], `tuits divergentes:\n${fallos.slice(0, 3).map(f => f.ev + '\n  esperado: ' + f.esperado + '\n  obtenido: ' + f.obtenido).join('\n')}`);
});

test('ningún tuit lleva HTML y todos respetan el límite real de X (peso t.co=23)', () => {
  const peso = t => { const urls = t.match(/https?:\/\/\S+/g) || []; let s = t; for (const u of urls) s = s.replace(u, ''); return s.length + urls.length * 23; };
  for (const ev of truth) {
    const t = gs.efgTweet({ html: ev.html, player: ev.player, m: ev.m, d: ev.d, year: ev.year });
    assert.ok(!/<[^>]+>/.test(t), `HTML en tuit: ${keyOf(proj(ev))}`);
    assert.ok(peso(t) <= 281, `tuit > 281 (${peso(t)}) en ${keyOf(proj(ev))}`); // efmShare tiene el desajuste +1 conocido
  }
});

test('efgBuild adjunta el id de la hoja a los hitos (fixture sintético con id)', () => {
  const fixture = {
    jugadores: [{ id: 'pau-gasol', nombre: 'Pau Gasol' }],
    transacciones: [],
    efemerides: [
      { fecha: '10 jan 2015', jugador: 'Pau Gasol', hito: 'Anota 46 puntos.', etiqueta: 'CAREER-HIGH', id: 'uuid-123' },
      { fecha: '16 dec 2009', jugador: 'Pau Gasol', hito: 'Su primer 20+20.', etiqueta: 'PARTIDO DESTACADO', id: 'uuid-456' },
    ],
  };
  const evs = Array.from(gs.efgBuild(fixture)).filter(e => e.kind === 'hito');
  assert.equal(evs.length, 2);
  assert.deepEqual(Array.from(evs, e => e.id).sort(), ['uuid-123', 'uuid-456']);
});
