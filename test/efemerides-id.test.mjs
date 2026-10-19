// Pruebas de los identificadores estables y del parseo/plantillas de efemérides
// (FASE 1). No alteran la web pública: cargan app.js en un sandbox de solo
// lectura (como tools/test-graficos.mjs) y comprueban su comportamiento real
// contra el data.json real, más el módulo aislado tools/efemerides-id.mjs.
//
// Ejecutar con:  node --test        (descubre este fichero y test/*.test.js)
//           o:   node --test test/efemerides-id.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import {
  eventId, draftId, eventIdOf, buildNameToId, norm, slug, isoOf,
} from '../tools/efemerides-id.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Sandbox que carga app.js con un DOM mínimo ───────────────────────────────
// document.createElement devuelve un elemento que, al leer textContent, quita
// las etiquetas y decodifica las entidades de su innerHTML: así reproducimos lo
// que hace un navegador real en efmShare() sin necesidad de jsdom.
function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // &amp; al final para no re-decodificar
}
function makeEl() {
  let html = '';
  return {
    set innerHTML(v) { html = String(v == null ? '' : v); },
    get innerHTML() { return html; },
    get textContent() { return decodeEntities(html.replace(/<[^>]*>/g, '')); },
  };
}

function loadSandbox() {
  const noop = () => {};
  let opened = null; // captura la URL de window.open (intent de X)
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
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'), ctx);
  const G = n => vm.runInContext(n, ctx);
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
  G('buildPlayerIds')(data.jugadores);
  const evs = G('efmBuild')(data);
  // Helper para fijar el estado que efmShare lee de variables globales.
  vm.runInContext('globalThis.__setEfm = function(ev, m, d){ efmCurrentList=[ev]; efmMonth=m; efmDay=d; };', ctx);
  const efmShare = G('efmShare');
  function shareText(ev) {
    opened = null;
    ctx.__setEfm(ev, ev.m, ev.d);
    efmShare(null, 0);
    if (!opened) return null;
    return new URL(opened).searchParams.get('text'); // ya viene decodificado
  }
  return { ctx, G, data, evs, shareText };
}

const SB = loadSandbox();
const NAME_TO_ID = buildNameToId(SB.data.jugadores);
const idOf = ev => eventId(ev, NAME_TO_ID);
const drNorm = SB.G('drNorm');
const find = (kind, name) => SB.evs.find(e => e.kind === kind && drNorm(e.player || '') === drNorm(name));

// Peso de un tuit al estilo de X: cada enlace cuenta 23 (t.co), el resto por
// unidades de la cadena (los emojis de par suplente ya cuentan 2 en .length).
function tweetWeight(text) {
  const urls = String(text).match(/https?:\/\/\S+/g) || [];
  let t = String(text);
  for (const u of urls) t = t.replace(u, '');
  return t.length + urls.length * 23;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Los cinco tipos de eventos se identifican correctamente.
// ─────────────────────────────────────────────────────────────────────────────
test('1 · los cinco tipos reciben un eventId con el prefijo correcto', () => {
  assert.equal(idOf(find('debut', 'Pau Gasol')), 'debut:pau-gasol');
  assert.equal(idOf(find('draft', 'Marc Gasol')), 'draft:marc-gasol');
  assert.equal(idOf(find('cumple', 'Pau Gasol')), 'cumple:pau-gasol');

  const tx = SB.evs.find(e => e.kind === 'trans' && drNorm(e.player) === drNorm('José M. Calderón') && e.detail.fecha === '2013-01-30');
  assert.equal(idOf(tx), 'trans:jose-m-calderon:2013-01-30:traspasado:toronto-raptors:detroit-pistons');

  const h = SB.evs.find(e => e.kind === 'hito' && drNorm(e.player) === drNorm('Pau Gasol') && e.m === 1 && e.d === 10 && e.year === 2015);
  assert.equal(idOf(h), 'hito:pau-gasol:2015-01-10');

  // Todo evento produce un id no vacío cuyo prefijo coincide con su kind.
  const prefixes = new Set();
  for (const ev of SB.evs) {
    const id = idOf(ev);
    assert.ok(id && typeof id === 'string', `id vacío para ${ev.kind}`);
    assert.equal(id.split(':')[0], ev.kind, `prefijo != kind en ${id}`);
    prefixes.add(ev.kind);
  }
  assert.deepEqual([...prefixes].sort(), ['cumple', 'debut', 'draft', 'hito', 'trans']);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Los identificadores NO dependen de la redacción del texto.
// ─────────────────────────────────────────────────────────────────────────────
test('2 · reescribir el texto no cambia el eventId', () => {
  for (const kind of ['debut', 'draft', 'cumple', 'hito']) {
    const ev = SB.evs.find(e => e.kind === kind);
    const mutado = { ...ev, html: 'TEXTO COMPLETAMENTE DISTINTO ' + Math.random(), tag: 'OTRA ETIQUETA' };
    assert.equal(idOf(mutado), idOf(ev), `${kind}: el texto/etiqueta afectó al id`);
  }
  // En transacciones, las notas y el texto son libres: no deben influir.
  const tx = SB.evs.find(e => e.kind === 'trans');
  const txMut = { ...tx, html: 'otro texto', detail: { ...tx.detail, notas: 'nota corregida', otros: 'otros cambiados' } };
  assert.equal(idOf(txMut), idOf(tx), 'trans: notas/otros/texto afectaron al id');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Dos acontecimientos distintos no reciben la misma identidad.
// ─────────────────────────────────────────────────────────────────────────────
test('3 · acontecimientos distintos -> eventIds distintos', () => {
  // Traspasos encadenados el mismo día (Albert Miralles, 2016-07-07): dos eventos reales.
  const miralles = SB.evs.filter(e => e.kind === 'trans' && drNorm(e.player) === drNorm('Albert Miralles') && e.detail.fecha === '2016-07-07');
  assert.equal(miralles.length, 2, 'esperaba 2 traspasos de Miralles el 2016-07-07');
  assert.notEqual(idOf(miralles[0]), idOf(miralles[1]), 'los dos traspasos encadenados colisionan');

  // Dos career-highs de Ibaka el mismo día-mes pero en años distintos.
  const ibaka = SB.evs.filter(e => e.kind === 'hito' && drNorm(e.player) === drNorm('Serge Ibaka') && e.m === 2 && e.d === 19);
  if (ibaka.length === 2) assert.notEqual(idOf(ibaka[0]), idOf(ibaka[1]), 'hitos de años distintos colisionan');
});

test('3b · unicidad global de eventId (salvo duplicados conocidos del origen)', () => {
  const byId = new Map();
  for (const ev of SB.evs) {
    const id = idOf(ev);
    (byId.get(id) || byId.set(id, []).get(id)).push(ev);
  }
  const colisiones = [...byId.entries()].filter(([, v]) => v.length > 1);
  // Único duplicado conocido: dos filas manuales idénticas de Pau Gasol el
  // 2009-12-16 ("22 rebotes"), que son el MISMO acontecimiento histórico
  // duplicado en el origen (ver informe, caso límite A). No es un fallo del
  // esquema de ids: la clave natural los funde correctamente. Se documenta aquí
  // para que cualquier NUEVA colisión haga saltar la prueba.
  const esperadas = new Set(['hito:pau-gasol:2009-12-16']);
  const inesperadas = colisiones.filter(([id]) => !esperadas.has(id));
  assert.deepEqual(
    inesperadas.map(([id, v]) => `${id} (x${v.length})`),
    [],
    'colisiones de eventId no previstas'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. La misma efeméride puede tener borradores de años de publicación distintos.
// ─────────────────────────────────────────────────────────────────────────────
test('4 · draftId separa el acontecimiento del año de campaña', () => {
  const ev = find('debut', 'Pau Gasol');
  const id = idOf(ev);
  const d2026 = draftId(id, 2026);
  const d2027 = draftId(id, 2027);
  assert.equal(d2026, 'debut:pau-gasol#2026');
  assert.notEqual(d2026, d2027, 'mismo año/efeméride deberían diferir entre campañas');
  assert.equal(draftId(id, 2026), d2026, 'regenerar la misma semana debe dar el MISMO draftId (idempotente)');
  // El acontecimiento histórico es el mismo en ambas campañas.
  assert.equal(eventIdOf(d2026), id);
  assert.equal(eventIdOf(d2027), id);
  assert.equal(eventIdOf(d2026), eventIdOf(d2027));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Las fechas en los formatos actuales se interpretan correctamente.
// ─────────────────────────────────────────────────────────────────────────────
// efmParseShort devuelve objetos creados DENTRO del sandbox (otro Object.prototype),
// así que los normalizamos a objetos planos del host antes de comparar.
const plain = r => (r && typeof r === 'object') ? { d: r.d, m: r.m, year: r.year } : r;

test('5 · parseo de los formatos de fecha en uso', () => {
  const efmParseShort = SB.G('efmParseShort');
  // Formato textual español (campos de jugador) e inglés (pestaña efemérides).
  assert.deepEqual(plain(efmParseShort('1 nov 2001')), { d: 1, m: 11, year: 2001 }); // primer_partido
  assert.deepEqual(plain(efmParseShort('6 jul 1980')), { d: 6, m: 7, year: 1980 });  // nacimiento
  assert.deepEqual(plain(efmParseShort('1 jan 2015')), { d: 1, m: 1, year: 2015 });  // efemerides (EN)
  assert.deepEqual(plain(efmParseShort('29 ene 1985')), { d: 29, m: 1, year: 1985 });

  // El formato ISO de transacciones lo resuelve efmBuild (no efmParseShort):
  // comprobamos el resultado efectivo sobre un evento real.
  const tx = SB.evs.find(e => e.kind === 'trans' && e.detail.fecha === '2013-01-30');
  assert.deepEqual({ d: tx.d, m: tx.m, year: tx.year }, { d: 30, m: 1, year: 2013 });

  // Ninguna fecha real se está descartando hoy en silencio.
  const malHito = SB.data.efemerides.filter(e => !efmParseShort(String(e.fecha)) && !/^\d{4}-\d{2}-\d{2}/.test(String(e.fecha)) && !/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/.test(String(e.fecha)));
  assert.equal(malHito.length, 0, 'hay hitos con fecha no parseable');
  const malTx = SB.data.transacciones.filter(t => !/^\d{4}-\d{2}-\d{2}/.test(String(t.fecha)));
  assert.equal(malTx.length, 0, 'hay transacciones con fecha no ISO (se descartarían)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Las fechas no válidas se detectan explícitamente (null), no se convierten.
// ─────────────────────────────────────────────────────────────────────────────
test('6 · fechas inválidas -> null (sin conversión silenciosa)', () => {
  const efmParseShort = SB.G('efmParseShort');
  for (const s of ['', '   ', 'foo', '32 xyz 2020', 'enero', '2015']) {
    assert.equal(efmParseShort(s), null, `debería ser null: ${JSON.stringify(s)}`);
  }
  // efmParseShort NO reconoce ISO por sí solo: lo documentamos (lo resuelve efmBuild).
  assert.equal(efmParseShort('2015-02-08'), null, 'efmParseShort no debe resolver ISO por su cuenta');
});

test('6b · LIMITACIÓN documentada: efmParseShort no valida el rango de día/mes', () => {
  // Comportamiento ACTUAL (no lo cambiamos para pasar la prueba): acepta días y
  // meses fuera de rango si el nombre del mes existe. El futuro generador debe
  // usar un validador de calendario estricto aparte. Ver informe, caso límite E.
  const efmParseShort = SB.G('efmParseShort');
  assert.deepEqual(plain(efmParseShort('32 ene 2020')), { d: 32, m: 1, year: 2020 });
  assert.deepEqual(plain(efmParseShort('0 ene 2020')), { d: 0, m: 1, year: 2020 });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Las plantillas deterministas generan el texto actual (snapshots).
//    Si un cambio futuro altera estas frases, la prueba lo señalará (no
//    modificamos las plantillas para pasar la prueba).
// ─────────────────────────────────────────────────────────────────────────────
test('7 · snapshots de las plantillas actuales', () => {
  assert.equal(
    find('debut', 'Pau Gasol').html,
    '<b><a class="pl-link" href="jugador-pau-gasol.html">Pau Gasol</a></b> debutó en la NBA con Memphis Grizzlies ante Detroit Pistons, firmando <b>4</b> puntos, <b>4</b> rebotes y <b>1</b> asistencia.'
  );
  assert.equal(
    find('draft', 'Marc Gasol').html,
    '<b><a class="pl-link" href="jugador-marc-gasol.html">Marc Gasol</a></b> es elegido en el draft por Los Angeles Lakers con el pick #48.'
  );
  assert.equal(
    find('cumple', 'Pau Gasol').html,
    'Nace <b><a class="pl-link" href="jugador-pau-gasol.html">Pau Gasol</a></b>.'
  );
  const tx = SB.evs.find(e => e.kind === 'trans' && e.detail.fecha === '2013-01-30' && drNorm(e.player) === drNorm('José M. Calderón'));
  assert.equal(
    tx.html,
    '<b><a class="pl-link" href="jugador-jose-m-calderon.html">José M. Calderón</a></b> es traspasado de Toronto Raptors a Detroit Pistons.'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. El texto para X no lleva HTML y respeta el presupuesto de 280.
// ─────────────────────────────────────────────────────────────────────────────
test('8 · efmShare: sin etiquetas HTML y dentro del límite de X', () => {
  let maxPeso = 0, peor = null;
  for (const ev of SB.evs) {
    const text = SB.shareText(ev);
    assert.ok(text, `efmShare no abrió intent para ${idOf(ev)}`);
    assert.ok(!/<[^>]+>/.test(text), `el tuit contiene HTML: ${idOf(ev)}\n${text}`);
    const peso = tweetWeight(text);
    if (peso > maxPeso) { maxPeso = peso; peor = idOf(ev); }
    assert.ok(peso <= 280, `tuit supera 280 (${peso}) en ${idOf(ev)}\n${text}`);
  }
  // Informativo: deja constancia del evento más largo con los datos reales.
  console.log(`    [8] peso máx. de tuit con datos reales: ${maxPeso} (${peor})`);
});

test('8b · LIMITACIÓN documentada: desajuste de +1 en el presupuesto de efmShare', () => {
  // efmShare calcula el presupuesto como (280 - 24 - prefijo - sufijo), pero el
  // texto final añade '\n\n' (2) + el enlace (peso 23 en X) = 25, no 24. En un
  // texto suficientemente largo como para activar el recorte, el tuit resultante
  // pesa 281. Con los datos reales de hoy NINGÚN evento lo activa (prueba 8), así
  // que es inocuo por ahora. Comprobamos el comportamiento ACTUAL con un evento
  // sintético muy largo; NO tocamos efmShare (corrección propuesta en el informe).
  const largo = {
    kind: 'hito', player: '', m: 1, d: 10, year: 2015, video: '', tag: 'Hito',
    html: 'x '.repeat(400).trim(), // texto larguísimo que fuerza el recorte
  };
  const text = SB.shareText(largo);
  assert.ok(!/<[^>]+>/.test(text), 'el tuit sintético no debe llevar HTML');
  const peso = tweetWeight(text);
  assert.equal(peso, 281, `comportamiento actual esperado = 281 (desajuste +1); obtenido ${peso}`);
});
