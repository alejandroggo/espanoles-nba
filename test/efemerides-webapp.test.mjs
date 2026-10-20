// Bloque C (Fase 4): operaciones de servidor de la Web App, probadas sobre un
// almacén en memoria (sin Apps Script UI). Carga los cuatro .gs en un contexto vm.
// Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AS = path.join(ROOT, 'tools', 'apps-script');

function load() {
  const code = ['efemerides-generador.gs', 'efemerides-core.gs', 'efemerides-sheet.gs', 'efemerides-webapp.gs']
    .map(f => fs.readFileSync(path.join(AS, f), 'utf8')).join('\n;\n');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const G = n => vm.runInContext(n, ctx);
  return {
    efwAccion: G('efwAccion'), efwProcesarAccion: G('efwProcesarAccion'), efwProcesarResolver: G('efwProcesarResolver'),
    efwAgruparSemana: G('efwAgruparSemana'), efsGenerarSemana: G('efsGenerarSemana'),
    efsRowsToStore: G('efsRowsToStore'), efsRowToRecord: G('efsRowToRecord'), efsHeaderIdx: G('efsHeaderIdx'),
    EFS_HEADERS: Array.from(G('EFS_HEADERS')),
  };
}
const P = load();
const H = P.EFS_HEADERS;
const col = n => H.indexOf(n);
const WK = { weekStart: '2026-01-05', weekEnd: '2026-01-11', campaignYear: 2026, now: 'T', slots: ['10:00', '14:00', '19:00'] };
const baseData = () => ({ jugadores: [{ id: 'pau-gasol', nombre: 'Pau Gasol' }], transacciones: [], efemerides: [
  { fecha: '7 jan 2014', jugador: 'Pau Gasol', hito: 'Hito A.', etiqueta: 'CAREER-HIGH', id: 'id-a' },
  { fecha: '10 jan 2015', jugador: 'Pau Gasol', hito: 'Hito B.', etiqueta: 'CAREER-HIGH', id: 'id-b' },
] });

// Genera una semana en memoria y devuelve {rows, store}.
function semanaEnMemoria() {
  const rows = [Array.from(H)];
  const deps = { ...WK, fetchData: baseData, leerBorradores: () => rows,
    escribir: ups => { for (const u of ups) u.tipo === 'append' ? rows.push(Array.from(u.row)) : (rows[u.rowIndex] = Array.from(u.row)); }, log: () => {} };
  P.efsGenerarSemana(deps);
  return { rows, store: P.efsRowsToStore(rows).store };
}
const rec = () => ({ draftId: 'd#2026', eventId: 'd', campaignYear: 2026, kind: 'hito', eventDateISO: '2015-01-10', category: 'CAREER-HIGH', players: [], textX: 'orig', suggestedAt: { wall: 'w' }, status: 'pendiente', editedText: false, editedTime: false, sourceFingerprint: 'fp', createdAt: 'C', updatedAt: 'C' });

test('efwAccion editarTexto: marca edited y preserva estado/createdAt', () => {
  const o = P.efwAccion(rec(), 'editarTexto', { texto: 'NUEVO' }, 'T2');
  assert.equal(o.textX, 'NUEVO'); assert.equal(o.editedText, true);
  assert.equal(o.status, 'pendiente'); assert.equal(o.createdAt, 'C'); assert.equal(o.updatedAt, 'T2');
});
test('efwAccion aprobar/descartar/publicar: cambia estado, preserva texto', () => {
  for (const [a, s] of [['aprobar', 'aprobado'], ['descartar', 'descartado'], ['publicar', 'publicado']]) {
    const o = P.efwAccion(rec(), a, {}, 'T2');
    assert.equal(o.status, s); assert.equal(o.textX, 'orig');
  }
});
test('efwAccion editarHora: fija editedTime y conserva el texto', () => {
  const o = P.efwAccion(rec(), 'editarHora', { suggestedAt: { wall: '2026-01-10T21:00', tz: 'America/Toronto' } }, 'T2');
  assert.equal(o.editedTime, true); assert.equal(o.textX, 'orig'); assert.equal(o.suggestedAt.wall, '2026-01-10T21:00');
});

test('efwProcesarAccion: devuelve upsert aplicable y persistente', () => {
  const { rows } = semanaEnMemoria();
  const did = 'hito:pau-gasol:2015-01-10#2026';
  const r = P.efwProcesarAccion(rows, did, 'aprobar', {}, 'T2');
  assert.equal(r.upsert.tipo, 'update');
  rows[r.upsert.rowIndex] = Array.from(r.upsert.row);
  const recB = P.efsRowToRecord(P.efsHeaderIdx(H), rows.find(x => x[col('draftId')] === did));
  assert.equal(recB.status, 'aprobado');
});
test('efwProcesarAccion sobre draftId inexistente → error', () => {
  const { rows } = semanaEnMemoria();
  assert.equal(P.efwProcesarAccion(rows, 'no#2026', 'aprobar', {}, 'T').error, 'no_existe');
});

test('efwProcesarResolver mantener: reconoce el origen y quita la alerta', () => {
  const { rows } = semanaEnMemoria();
  const did = 'hito:pau-gasol:2015-01-10#2026';
  // simulamos una revisión pendiente en la fila
  const idx = P.efsHeaderIdx(H);
  const rowI = rows.findIndex(x => x[col('draftId')] === did);
  rows[rowI][col('pendingSourceChange')] = true;
  rows[rowI][col('observedFingerprint')] = 'fpNuevo';
  const r = P.efwProcesarResolver(rows, did, 'mantener', 'T3');
  assert.equal(r.record.reviewedFingerprint, 'fpNuevo');
  assert.equal(r.record.pendingSourceChange, false);
});

test('efwAgruparSemana: agrupa por día y cuenta por estado', () => {
  const { store } = semanaEnMemoria();
  const g = P.efwAgruparSemana(store, WK.weekStart, WK.weekEnd, 2026);
  assert.equal(g.contadores.total, 2);
  assert.equal(g.contadores.pendiente, 2);
  assert.equal(g.dias.length, 7);
  const conItems = g.dias.filter(d => d.items.length);
  assert.equal(conItems.length, 2, 'Jan 7 y Jan 10');
  assert.ok(conItems.every(d => d.items[0].url.includes('efemerides.html')));
});

test('flujo UI end-to-end en memoria: aprobar se refleja en la agrupación', () => {
  const { rows } = semanaEnMemoria();
  const did = 'hito:pau-gasol:2015-01-10#2026';
  const r = P.efwProcesarAccion(rows, did, 'aprobar', {}, 'T2');
  rows[r.upsert.rowIndex] = Array.from(r.upsert.row);
  const g = P.efwAgruparSemana(P.efsRowsToStore(rows).store, WK.weekStart, WK.weekEnd, 2026);
  assert.equal(g.contadores.aprobado, 1);
  assert.equal(g.contadores.pendiente, 1);
});
