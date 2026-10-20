// Equivalencia del port del núcleo (FASE 4, Bloque A): garantiza que
// tools/apps-script/efemerides-core.gs produce EXACTAMENTE lo mismo que los
// módulos .mjs ya probados (planGeneration, applyPlan, validador, ids), sobre los
// mismos escenarios. Compara por JSON.stringify (inmune al realm del vm).
// Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { planGeneration as planM, _tz as tzM } from '../tools/efemerides-gen-core.mjs';
import { createStore as storeM, applyPlan as applyM, resolverRevision as resolverM } from '../tools/efemerides-apply.mjs';
import { parsearFecha as parseM, validarYMD as ymdM } from '../tools/efemerides-fecha.mjs';
import { eventId as eidM, draftId as didM } from '../tools/efemerides-id.mjs';
import { createAppSandbox } from '../tools/efemerides-build.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Carga del núcleo .gs (JS plano) en su propio contexto vm.
function loadCore() {
  const code = fs.readFileSync(path.join(ROOT, 'tools', 'apps-script', 'efemerides-core.gs'), 'utf8');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const G = n => vm.runInContext(n, ctx);
  return {
    planGeneration: G('planGeneration'), createStore: G('createStore'), applyPlan: G('applyPlan'),
    resolverRevision: G('resolverRevision'), parsearFecha: G('parsearFecha'), validarYMD: G('validarYMD'),
    calcEventId: G('calcEventId'), calcDraftId: G('calcDraftId'), _tz: G('_tz'),
  };
}
const gs = loadCore();
const J = JSON.stringify;
const eq = (a, b, msg) => assert.equal(J(a), J(b), msg);

// Helpers de escenario (idénticos a los del test de gen-core).
const NOW = '2026-01-03T12:00:00Z';
const WK = { weekStart: '2026-01-05', weekEnd: '2026-01-11', campaignYear: 2026 };
const dataWith = jugs => ({ jugadores: jugs.map(j => ({ id: j.id, nombre: j.nombre })), efemerides: [], transacciones: [] });
const ev = (kind, player, y, m, d, o = {}) => ({ kind, player, year: y, m, d, tag: o.tag || 'Hito', html: o.html ?? `<b>${player}</b> algo en ${y}.`, video: o.video || '', detail: o.detail, tweetText: o.tweetText ?? `tuit ${player} ${y}` });
const JUGS = [{ id: 'pau-gasol', nombre: 'Pau Gasol' }, { id: 'marc-gasol', nombre: 'Marc Gasol' }];
function opToRecord(op) { return { draftId: op.draftId, eventId: op.eventId, campaignYear: 2026, kind: op.kind, eventDateISO: op.eventDateISO, category: op.category, players: op.players, textX: op.textX, status: op.status, editedText: false, editedTime: false, sourceFingerprint: op.sourceFingerprint, suggestedAt: op.suggestedAt }; }

test('equivalencia: validador de fechas (parsearFecha + validarYMD)', () => {
  for (const s of ['1 nov 2001', '1 jan 2015', '2015-02-08', '29 feb 2016', '29 feb 2015', '31 nov 2020', '32 ene 2020', 'foo', '', '01/02/2020', '1 ene 1800', '2000-02-29']) {
    eq(gs.parsearFecha(s), parseM(s), `parsearFecha(${JSON.stringify(s)})`);
  }
  for (const [y, m, d] of [[2016, 2, 29], [2015, 2, 29], [2020, 13, 1], [2020, 0, 5], [2020, 4, 31], [1900, 2, 29]]) {
    eq(gs.validarYMD(y, m, d), ymdM(y, m, d), `validarYMD(${y},${m},${d})`);
  }
});

test('equivalencia: ids (calcEventId / calcDraftId) en los 5 tipos', () => {
  const nameToId = { 'pau gasol': 'pau-gasol', 'jose m. calderon': 'jose-m-calderon', 'albert miralles': 'albert-miralles' };
  const casos = [
    ev('debut', 'Pau Gasol', 2001, 11, 1),
    ev('draft', 'Pau Gasol', 2001, 6, 27),
    ev('cumple', 'Pau Gasol', 1980, 7, 6),
    ev('hito', 'Pau Gasol', 2015, 1, 10),
    { kind: 'trans', player: 'Albert Miralles', year: 2016, m: 7, d: 7, tag: 'Traspasado', detail: { fecha: '2016-07-07', tipo: 'Traspasado', equipo1: 'Milwaukee Bucks', equipo2: 'Cleveland Cavaliers' } },
  ];
  for (const c of casos) {
    eq(gs.calcEventId(c, nameToId), eidM(c, nameToId), `eventId ${c.kind}`);
    eq(gs.calcDraftId(gs.calcEventId(c, nameToId), 2026), didM(eidM(c, nameToId), 2026), `draftId ${c.kind}`);
  }
});

test('equivalencia: sugerencias horarias (incl. DST inexistente/ambiguo)', () => {
  for (const [dia, slot] of [['2026-01-10', '10:00'], ['2026-07-08', '14:00'], ['2026-03-08', '02:30'], ['2026-11-01', '01:30'], ['2026-03-08', '03:30']]) {
    eq(gs._tz.sugerenciaHoraria(dia, slot), tzM.sugerenciaHoraria(dia, slot), `${dia} ${slot}`);
  }
});

// Compara planGeneration + applyPlan (.gs vs .mjs) para un escenario completo.
function equivPlanApply(label, data, events, existing) {
  const pM = planM({ data, events, existing, ...WK, now: NOW });
  const pG = gs.planGeneration({ data, events, existing, ...WK, now: NOW });
  eq(pG, pM, `plan: ${label}`);
  const sM = applyM(storeM(existing), pM, { now: 'T1' });
  const sG = gs.applyPlan(gs.createStore(existing), pG, { now: 'T1' });
  eq(sG.store, sM.store, `store: ${label}`);
}

test('equivalencia: planGeneration + applyPlan en escenarios sintéticos', () => {
  const data = dataWith(JUGS);
  // nuevo
  equivPlanApply('nuevo', data, [ev('hito', 'Pau Gasol', 2015, 1, 10)], []);
  // sin_cambios (regenerar sobre el store ya creado)
  const base = planM({ data, events: [ev('hito', 'Pau Gasol', 2015, 1, 10)], existing: [], ...WK, now: NOW });
  const store0 = Object.values(applyM(storeM([]), base, { now: NOW }).store);
  equivPlanApply('sin_cambios', data, [ev('hito', 'Pau Gasol', 2015, 1, 10)], store0);
  // cambio_contenido (pendiente, sin editar)
  const rec = opToRecord(base.ops[0]);
  equivPlanApply('cambio_contenido', data, [ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> OTRO.', tweetText: 'TUIT NUEVO' })], [rec]);
  // edicion_preservada (editado + cambio de origen)
  equivPlanApply('edicion_preservada', data, [ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> OTRO.' })], [{ ...rec, editedText: true, textX: 'MANUAL' }]);
  // estado terminal
  equivPlanApply('aprobado', data, [ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> OTRO.' })], [{ ...rec, status: 'aprobado' }]);
  // desaparecido
  equivPlanApply('desaparecido', data, [], [rec]);
  // colisión con borrador existente
  const did = 'hito:pau-gasol:2009-01-10#2026';
  const recCol = { draftId: did, eventId: 'hito:pau-gasol:2009-01-10', campaignYear: 2026, kind: 'hito', eventDateISO: '2009-01-10', players: [{ name: 'Pau Gasol', id: 'pau-gasol' }], textX: 'HUMANO', status: 'aprobado', editedText: true, sourceFingerprint: 'viejo', suggestedAt: { wall: 'w' } };
  equivPlanApply('colision', data, [ev('hito', 'Pau Gasol', 2009, 1, 10, { tag: 'A', html: '<b>Pau Gasol</b> a.' }), ev('hito', 'Pau Gasol', 2009, 1, 10, { tag: 'B', html: '<b>Pau Gasol</b> b.' })], [recCol]);
});

test('equivalencia: resolverRevision', () => {
  const store = [{ draftId: 'd#2026', eventId: 'd', campaignYear: 2026, kind: 'hito', editedText: true, textX: 'MANUAL', sourceFingerprint: 'fpA', observedFingerprint: 'fpB', pendingSourceChange: true }];
  const rM = resolverM(storeM(store), 'd#2026', { modo: 'mantener', now: 'T2' });
  const rG = gs.resolverRevision(gs.createStore(store), 'd#2026', { modo: 'mantener', now: 'T2' });
  eq(rG.store, rM.store, 'resolverRevision mantener');
});

test('equivalencia: datos REALES (semana de enero) — plan idéntico', () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
  const sb = createAppSandbox();
  const events = sb.buildEvents(data).map(e => ({ kind: e.kind, player: e.player, year: e.year, m: e.m, d: e.d, tag: e.tag, html: e.html, video: e.video, detail: e.detail, tweetText: sb.tweetTextFor(e) }));
  const pM = planM({ data, events, existing: [], ...WK, now: NOW });
  const pG = gs.planGeneration({ data, events, existing: [], ...WK, now: NOW });
  eq(pG, pM, 'plan datos reales');
  assert.ok(pM.stats.nuevo > 0);
});
