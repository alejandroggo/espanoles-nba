// Tests del creador de gráficos (sin dependencias). Carga app.js en un sandbox
// con un DOM mínimo y comprueba los cálculos contra el data.json real.
// Uso:  node tools/test-graficos.mjs
import fs from 'fs';
import vm from 'vm';
import assert from 'assert/strict';

const ROOT = new URL('..', import.meta.url).pathname;
const noop = () => {};
const ctx = {
  console, URL, URLSearchParams, Intl, setTimeout, clearTimeout,
  location: { href: 'https://espanoles-nba.alejandroggo.com/graficos.html', search: '', pathname: '/graficos.html' },
  history: { replaceState: noop },
  window: { matchMedia: () => ({ matches: false, addEventListener: noop }), addEventListener: noop },
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop },
  navigator: {}, localStorage: { getItem: () => null, setItem: noop },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT + 'app.js', 'utf8'), ctx);
const G = name => vm.runInContext(name, ctx);
const data = JSON.parse(fs.readFileSync(ROOT + 'data.json', 'utf8'));
const J = data.jugadores;
const P = id => J.find(j => j.id === id);

const grSeasonRows = G('grSeasonRows'), grAge = G('grAge'), grCareerAgg = G('grCareerAgg'), grCareerValue = G('grCareerValue');
const grMetric = G('grMetric'), grSeasonValue = G('grSeasonValue'), grEligible = G('grEligible'), grNormalize = G('grNormalize');
const grParseState = G('grParseState'), grStateToParams = G('grStateToParams'), grBuildScene = G('grBuildScene');
const grLayout = G('grLayout'), grNiceTicks = G('grNiceTicks'), grTableData = G('grTableData'), grYears = G('grYears');
const players = grEligible(J);
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} ≠ ${b}`);

let n = 0, warns = [];
const test = (name, fn) => { try { fn(); n++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; } };

console.log('Gráficos · datos');
test('una fila por temporada: la TOT en años con traspaso (Pau 2007-08, MEM / LAL)', () => {
  const r = grSeasonRows(P('pau-gasol'), 'reg').find(x => x.year === 2008);
  const parts = P('pau-gasol').temporadas_data.filter(t => t.year === 2008 && t.team !== 'TOT');
  assert.equal(r.t.team, 'TOT'); assert.equal(r.g, parts.reduce((s, t) => s + t.g, 0)); assert.equal(r.teams, 'MEM / LAL');
  const all = grSeasonRows(P('pau-gasol'), 'reg');
  assert.equal(new Set(all.map(x => x.year)).size, all.length, 'años duplicados');
});
test('TOT = media ponderada de los parciales en todos los traspasos', () => {
  J.forEach(j => {
    const by = {};
    (j.temporadas_data || []).filter(t => t.year).forEach(t => (by[t.year] = by[t.year] || []).push(t));
    Object.entries(by).forEach(([y, rs]) => {
      const tot = rs.find(t => t.team === 'TOT'); if (!tot) return;
      const parts = rs.filter(t => t.team !== 'TOT'), g = parts.reduce((s, t) => s + t.g, 0);
      assert.equal(g, tot.g, `${j.id} ${y} PJ`);
      ['pts_g', 'rbd_g', 'ast_g', 'min_g'].forEach(k => near(parts.reduce((s, t) => s + t[k] * t.g, 0) / g, tot[k], 0.051, `${j.id} ${y} ${k}`));
    });
  });
});
test('descarta filas sin año (year 0) y sin partidos (temporada 2026-27 sin empezar)', () => {
  J.forEach(j => ['reg', 'po'].forEach(c => grSeasonRows(j, c).forEach(r => { assert.ok(r.year > 0); assert.ok(r.g > 0); })));
  assert.ok(!grSeasonRows(P('santi-aldama'), 'reg').some(r => r.year === 2027));
  assert.ok(!grSeasonRows(P('pau-gasol'), 'reg').some(r => r.year === 0));
});
test('selector: solo jugadores con partidos NBA (excluye no debutados y novatos sin partidos)', () => {
  const ids = players.map(j => j.id);
  ['sergio-llull', 'fran-vazquez', 'aday-mara', 'baba-miller', 'sergio-de-larrea'].forEach(id => assert.ok(!ids.includes(id), id));
  ['pau-gasol', 'fernando-martin', 'hugo-gonzalez'].forEach(id => assert.ok(ids.includes(id), id));
});
test('edad a 1 de febrero (criterio Basketball Reference)', () => {
  assert.equal(grAge(P('pau-gasol'), 2009), 28);     // 6 jul 1980
  assert.equal(grAge(P('marc-gasol'), 2009), 24);    // 29 ene 1985 → ya cumplidos el 1 de febrero
  assert.equal(grAge(P('fernando-martin'), 1987), 25); // 25 ene 1962
  players.forEach(j => assert.ok(grAge(j, 2020) != null, `${j.id} sin fecha de nacimiento válida`));
});
test('playoffs: sin TOT, una fila por año y suma de PJ = totales oficiales', () => {
  J.forEach(j => {
    const rows = grSeasonRows(j, 'po');
    if (!j.playoffs_totales) { assert.equal(rows.length, 0, j.id); return; }
    assert.equal(rows.reduce((s, r) => s + r.g, 0), j.playoffs_totales.partidos, j.id);
  });
  assert.equal(grSeasonRows(P('juan-carlos-navarro'), 'po').length, 0);
});

console.log('Gráficos · carrera y periodos');
test('carrera completa = totales oficiales (promedio = total ÷ partidos)', () => {
  const pau = P('pau-gasol');
  const c = grCareerAgg(pau, 'reg');
  assert.ok(c.full); assert.equal(c.g, pau.partidos);
  near(grCareerValue(c, grMetric('pts_g')).value, pau.pts_total / pau.partidos, 1e-9, 'PTS');
  near(grCareerValue(c, grMetric('tres_g')).value, pau.tres_total / pau.partidos, 1e-9, '3PM (no el promedio redondeado)');
  assert.equal(grCareerValue(c, grMetric('fg_pct')).value, pau.fg_pct);
  const po = grCareerAgg(pau, 'po');
  assert.equal(po.g, pau.playoffs_totales.partidos);
  near(grCareerValue(po, grMetric('pts_g')).value, pau.playoffs_totales.pts_total / pau.playoffs_totales.partidos, 1e-9, 'PTS playoffs');
});
test('periodo: media ponderada por partidos, no media de promedios', () => {
  const pau = P('pau-gasol');
  const rows = grSeasonRows(pau, 'reg').filter(r => r.year >= 2002 && r.year <= 2008);
  const c = grCareerAgg(pau, 'reg', 2002, 2008);
  assert.ok(!c.full); assert.equal(c.n, rows.length);
  const G0 = rows.reduce((s, r) => s + r.g, 0);
  const w = rows.reduce((s, r) => s + r.t.pts_g * r.g, 0) / G0;
  const simple = rows.reduce((s, r) => s + r.t.pts_g, 0) / rows.length;
  assert.equal(c.g, G0);
  near(grCareerValue(c, grMetric('pts_g')).value, w, 1e-9, 'ponderada');
  assert.ok(Math.abs(w - simple) > 1e-6, 'el caso de prueba debe distinguir ambas medias');
});
test('periodo sin temporadas del jugador → sin punto', () => {
  assert.equal(grCareerAgg(P('fernando-martin'), 'reg', 2010, 2020), null);
});
test('% con muestra pequeña se oculta y el 0% sin intentos conocidos no se inventa', () => {
  const m = grMetric('tres_pct');
  const pau = grSeasonRows(P('pau-gasol'), 'reg');
  const tiny = pau.find(r => r.t.tres_pct != null && r.t.tres_g * r.g / r.t.tres_pct < 20);
  assert.ok(tiny, 'hay temporadas de Pau con pocos triples');
  assert.equal(grSeasonValue(tiny, m, { muestra: true }).value, null);
  assert.ok(grSeasonValue(tiny, m, { muestra: true }).hidden);
  assert.equal(grSeasonValue(tiny, m, { muestra: false }).value, tiny.t.tres_pct);
  const fake = { year: 2000, g: 10, t: { g: 10, tres_pct: 0, tres_g: 0 } };
  assert.ok(grSeasonValue(fake, m, { muestra: true }).hidden);
  const nul = { year: 2000, g: 10, t: { g: 10, tres_pct: null, tres_g: 0 } };
  assert.equal(grSeasonValue(nul, m, { muestra: false }).value, null);
});
test('totales de temporada = por partido × partidos', () => {
  const r = grSeasonRows(P('pau-gasol'), 'reg').find(x => x.year === 2009);
  assert.equal(grSeasonValue(r, grMetric('pts_tot')).value, Math.round(r.t.pts_g * r.g));
  assert.equal(grSeasonValue(r, grMetric('g')).value, r.g);
});

console.log('Gráficos · escena');
const base = grNormalize({}, players);
test('ejemplo por defecto: Pau vs Marc, PTS por partido, carrera, temporada regular', () => {
  assert.deepEqual([...base.ids], ['pau-gasol', 'marc-gasol']);
  const sc = grBuildScene(base, players);
  assert.equal(sc.series.length, 2);
  const pau = sc.series[0], marc = sc.series[1];
  assert.equal(pau.points.length, 18); assert.equal(marc.points.length, 13);
  assert.equal(pau.points[0].year, 2002); assert.equal(pau.points[pau.points.length - 1].year, 2019);
  near(pau.points.find(p => p.year === 2008).y, P('pau-gasol').temporadas_data.find(t => t.year === 2008 && t.team === 'TOT').pts_g, 1e-12, 'TOT 2008');
  assert.equal(sc.empty, undefined);
  assert.match(sc.title, /Puntos por partido · Pau Gasol vs Marc Gasol/);
});
test('temporadas sin participación cortan la línea (Sergio Rodríguez 2011-2016)', () => {
  const sc = grBuildScene(grNormalize({ ids: ['sergio-rodriguez'] }, players), players);
  assert.equal(sc.series[0].segs.length, 2);
  assert.equal(JSON.stringify(sc.series[0].segs.map(s => s.map(p => p.year))), '[[2007,2008,2009,2010],[2017]]');
  assert.ok(sc.notes.some(t => /se cortan/.test(t)));
  const n2 = grBuildScene(grNormalize({ ids: ['sergio-rodriguez'], ex: 'n' }, players), players);
  assert.equal(n2.series[0].segs.length, 1, 'por nº de temporada no hay hueco');
});
test('playoffs: jugador sin playoffs avisa y no aporta puntos', () => {
  const sc = grBuildScene(grNormalize({ ids: ['pau-gasol', 'juan-carlos-navarro'], comp: 'po' }, players), players);
  assert.equal(sc.series[1].points.length, 0);
  assert.ok(sc.warnings.some(w => /Navarro no disputó playoffs/.test(w)));
  assert.equal(sc.series[0].points.length, 12);
});
test('mínimo de partidos y periodo filtran temporadas', () => {
  const sc = grBuildScene(grNormalize({ ids: ['pau-gasol'], desde: 2005, hasta: 2010, ming: 58 }, players), players);
  sc.series[0].points.forEach(p => { assert.ok(p.year >= 2005 && p.year <= 2010); assert.ok(p.g >= 58); });
  assert.ok(sc.series[0].points.length > 0);
});
test('dispersión por carreras: un punto por jugador con partidos, sin duplicados', () => {
  const st = grNormalize({ tipo: 'dispersion', u: 'carrera', x: 'ast_g', y: 'pts_g' }, players);
  const sc = grBuildScene(st, players);
  assert.equal(sc.points.length, players.length);
  assert.equal(new Set(sc.points.map(p => p.id)).size, sc.points.length);
  const pau = sc.points.find(p => p.id === 'pau-gasol');
  assert.ok(pau.sel); near(pau.y, P('pau-gasol').pts_total / P('pau-gasol').partidos, 1e-9, 'Pau PTS');
  assert.match(sc.subtitle, /Cada punto = la carrera de un jugador/);
});
test('dispersión por temporadas: edad × PTS con mínimo de PJ por defecto (20)', () => {
  const st = grNormalize({ tipo: 'dispersion', u: 'temporada', x: 'edad', y: 'pts_g', ctx: false }, players);
  const sc = grBuildScene(st, players);
  assert.equal(sc.points.length, grSeasonRows(P('pau-gasol'), 'reg').filter(r => r.g >= 20).length + grSeasonRows(P('marc-gasol'), 'reg').filter(r => r.g >= 20).length);
  sc.points.forEach(p => { assert.ok(p.g >= 20); assert.equal(p.x, grAge(P(p.id), p.year)); });
  assert.match(sc.subtitle, /Cada punto = una temporada de un jugador \(mín\. 20 PJ\)/);
});
test('color/forma fijos por jugador (slots) aunque cambie el orden', () => {
  const sc = grBuildScene(grNormalize({ ids: ['marc-gasol', 'pau-gasol'] }, players), players, { 'pau-gasol': 0, 'marc-gasol': 1 });
  assert.equal(sc.series.find(s => s.id === 'pau-gasol').slot, 0);
  assert.equal(sc.series.find(s => s.id === 'marc-gasol').shape, 'square');
});
test('sin jugadores: estado vacío explícito', () => {
  assert.ok(grBuildScene(grNormalize({ ids: [] }, players), players).empty);
});

console.log('Gráficos · URL y validación');
test('URL de ida y vuelta conserva la configuración', () => {
  const st = grNormalize({ tipo: 'dispersion', ids: ['ricky-rubio', 'jose-m-calderon'], comp: 'po', u: 'temporada', x: 'edad', y: 'ast_g', desde: 2013, hasta: 2019, ming: 3, ctx: false, ley: false, t: 'Bases  en playoffs' }, players);
  const back = grParseState(grStateToParams(st), players);
  ['tipo', 'comp', 'u', 'x', 'y', 'desde', 'hasta', 'ming', 'ctx', 'ley', 't'].forEach(k => assert.equal(back[k], st[k], k));
  assert.deepEqual([...back.ids], [...st.ids]);
  assert.equal(back.t, 'Bases en playoffs');
});
test('valores inválidos vuelven al defecto sin romper', () => {
  const st = grParseState(new URLSearchParams('tipo=tarta&j=pau-gasol,nadie,pau-gasol&m=foo&x=pts_g&y=pts_g&desde=1900&hasta=abc&min=7&comp=x'), players);
  assert.equal(st.tipo, 'lineas'); assert.equal(st.comp, 'reg'); assert.equal(st.m, 'pts_g');
  assert.deepEqual([...st.ids], ['pau-gasol']);
  assert.notEqual(st.x, st.y, 'misma métrica en los dos ejes');
  assert.equal(st.desde, null); assert.equal(st.hasta, null); assert.equal(st.ming, null);
  const e = grNormalize({ tipo: 'dispersion', u: 'carrera', x: 'edad' }, players);
  assert.notEqual(e.x, 'edad', 'edad no aplica a carreras');
  const sw = grNormalize({ desde: 2015, hasta: 2005 }, players);
  assert.ok(sw.desde < sw.hasta);
  assert.equal(grNormalize({ ids: players.map(j => j.id) }, players).ids.length, 6);
});
test('j vacío en la URL = ningún jugador (no el ejemplo por defecto)', () => {
  assert.equal(grParseState(new URLSearchParams('j='), players).ids.length, 0);
  assert.equal(grParseState(new URLSearchParams(''), players).ids.length, 2);
});

console.log('Gráficos · maquetación');
test('marcas de eje "bonitas" y que cubren el rango', () => {
  assert.deepEqual([...grNiceTicks(0, 17.2, 5)], [0, 5, 10, 15, 20]);
  const t = grNiceTicks(0.41, 0.59, 5); assert.ok(t[0] <= 0.41 && t[t.length - 1] >= 0.59);
});
test('layout: todos los puntos dentro del área y etiquetas sin solaparse', () => {
  [360, 1000].forEach(W => {
    const sc = grBuildScene(grNormalize({ tipo: 'dispersion', u: 'carrera' }, players), players);
    const L = grLayout(sc, W, Math.round(W * 0.6), 1), p = L.plot;
    L.pts.forEach(q => { assert.ok(q.px >= p.x - 0.5 && q.px <= p.x + p.w + 0.5 && q.py >= p.y - 0.5 && q.py <= p.y + p.h + 0.5, `fuera del área a ${W}px`); });
    const lines = grBuildScene(base, players), L2 = grLayout(lines, W, 400, 1);
    const xs = L2.xTicks.map(t => t.p);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 50, `etiquetas de temporada demasiado juntas a ${W}px`);
  });
});
test('tabla de datos: una fila por temporada y una columna por jugador', () => {
  const d = grTableData(grBuildScene(base, players));
  assert.equal(d.head.length, 3);
  assert.equal(d.rows.length, new Set([...grSeasonRows(P('pau-gasol'), 'reg'), ...grSeasonRows(P('marc-gasol'), 'reg')].map(r => r.year)).size);
});

console.log('Datos · coherencia (avisos, no bloquean)');
J.forEach(j => {
  const rows = grSeasonRows(j, 'reg');
  if (!rows.length) return;
  const g = rows.reduce((s, r) => s + r.g, 0);
  if (g !== j.partidos) warns.push(`${j.nombre}: partidos de carrera ${j.partidos} ≠ suma de temporadas ${g}`);
});
warns.forEach(w => console.log('  ⚠', w));
console.log(`\n${n} tests OK${process.exitCode ? ' · HAY FALLOS' : ''}`);
