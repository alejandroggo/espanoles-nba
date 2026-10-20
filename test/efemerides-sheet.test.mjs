// Bloque B (Fase 4): capa de datos + efsGenerarSemana, probada sobre un almacén
// EN MEMORIA (sin Google Sheets, sin red, sin desplegar). Carga los tres .gs
// (generador + core + sheet) en un mismo contexto vm, como en Apps Script.
// Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AS = path.join(ROOT, 'tools', 'apps-script');

function loadProyecto() {
  const code = ['efemerides-generador.gs', 'efemerides-core.gs', 'efemerides-sheet.gs']
    .map(f => fs.readFileSync(path.join(AS, f), 'utf8')).join('\n;\n');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const G = n => vm.runInContext(n, ctx);
  return {
    efsGenerarSemana: G('efsGenerarSemana'), efsRecordToRow: G('efsRecordToRow'),
    efsRowToRecord: G('efsRowToRecord'), efsHeaderIdx: G('efsHeaderIdx'),
    efsProximaSemanaLunDom: G('efsProximaSemanaLunDom'),
    EFS_HEADERS: Array.from(G('EFS_HEADERS')),
  };
}
const P = loadProyecto();
const H = P.EFS_HEADERS;
const col = name => H.indexOf(name);

const WK = { weekStart: '2026-01-05', weekEnd: '2026-01-11', campaignYear: 2026, now: 'T', slots: ['10:00', '14:00', '19:00'] };
const baseData = () => ({
  jugadores: [{ id: 'pau-gasol', nombre: 'Pau Gasol' }],
  transacciones: [],
  efemerides: [
    { fecha: '7 jan 2014', jugador: 'Pau Gasol', hito: 'Hito A.', etiqueta: 'CAREER-HIGH', id: 'id-a' },
    { fecha: '10 jan 2015', jugador: 'Pau Gasol', hito: 'Hito B.', etiqueta: 'CAREER-HIGH', id: 'id-b' },
  ],
});
function makeDeps(data, rows, logs) {
  return {
    ...WK,
    fetchData: () => data,
    leerBorradores: () => rows,
    escribir: (upserts) => {
      for (const u of upserts) {
        if (u.tipo === 'append') rows.push(Array.from(u.row));
        else rows[u.rowIndex] = Array.from(u.row);
      }
    },
    log: (entries) => { for (const e of entries) logs.push(e); },
  };
}

test('round-trip record ↔ row ↔ record (serialización fiel)', () => {
  const rec = { draftId: 'd#2026', eventId: 'd', campaignYear: 2026, kind: 'hito', eventDateISO: '2015-01-10', category: 'CAREER-HIGH', players: [{ name: 'Pau Gasol', id: 'pau-gasol' }], textX: 'tuit', suggestedAt: { wall: '2026-01-10T10:00', tz: 'America/Toronto', offset: '-05:00', utc: '2026-01-10T15:00:00.000Z' }, status: 'pendiente', editedText: true, editedTime: false, sourceFingerprint: 'fpA', sourceSnapshot: { texto: 'x' }, reviewedFingerprint: null, observedFingerprint: null, observedSnapshot: null, pendingSourceChange: false, orphan: false, createdAt: 'C', updatedAt: 'C', sourceSeenAt: 'C', lastMissingAt: null };
  const row1 = P.efsRecordToRow(rec);
  const rec2 = P.efsRowToRecord(P.efsHeaderIdx(H), row1);
  const row2 = P.efsRecordToRow(rec2);
  assert.equal(JSON.stringify(row2), JSON.stringify(row1), 'round-trip estable');
});

test('primera generación: crea una fila por efeméride de la semana', () => {
  const rows = [Array.from(H)], logs = [];
  const r = P.efsGenerarSemana(makeDeps(baseData(), rows, logs));
  assert.equal(r.resumen.nuevo, 2);
  assert.equal(r.upserts.filter(u => u.tipo === 'append').length, 2);
  assert.equal(rows.length, 3, 'cabecera + 2 borradores');
  assert.ok(logs.some(e => e.tipo === 'run_ok'));
});

test('idempotencia: regenerar sin cambios no añade ni modifica filas', () => {
  const rows = [Array.from(H)], logs = [];
  const data = baseData();
  P.efsGenerarSemana(makeDeps(data, rows, logs));
  const r2 = P.efsGenerarSemana(makeDeps(data, rows, logs));
  assert.equal(r2.upserts.length, 0, 'sin upserts en la 2ª pasada');
  assert.equal(r2.resumen.sin_cambios, 2);
  assert.equal(rows.length, 3, 'no se duplican filas');
});

test('edición manual preservada cuando cambia el origen', () => {
  const rows = [Array.from(H)], logs = [];
  const data = baseData();
  P.efsGenerarSemana(makeDeps(data, rows, logs));
  // El humano edita el tuit de la efeméride B y marca edited_text:
  const rB = rows.findIndex(row => row[col('draftId')] === 'hito:pau-gasol:2015-01-10#2026');
  assert.ok(rB > 0);
  rows[rB][col('textX')] = 'MANUAL';
  rows[rB][col('editedText')] = true;
  // El origen cambia el texto de B:
  data.efemerides[1].hito = 'Hito B modificado.';
  const r = P.efsGenerarSemana(makeDeps(data, rows, logs));
  assert.equal(r.resumen.edicion_preservada, 1);
  const recB = P.efsRowToRecord(P.efsHeaderIdx(H), rows[rB]);
  assert.equal(recB.textX, 'MANUAL', 'no se sobreescribe la edición manual');
  assert.equal(recB.pendingSourceChange, true, 'queda marcada para revisión');
  assert.equal(rows.length, 3, 'sigue sin duplicar');
});

test('evento desaparecido: la fila se marca huérfana, no se elimina', () => {
  const rows = [Array.from(H)], logs = [];
  const data = baseData();
  P.efsGenerarSemana(makeDeps(data, rows, logs));
  // El origen deja de traer la efeméride B:
  data.efemerides = [data.efemerides[0]];
  const r = P.efsGenerarSemana(makeDeps(data, rows, logs));
  assert.equal(r.resumen.desaparecido, 1);
  assert.equal(rows.length, 3, 'no se borra ninguna fila');
  const rB = rows.find(row => row[col('draftId')] === 'hito:pau-gasol:2015-01-10#2026');
  assert.equal(P.efsRowToRecord(P.efsHeaderIdx(H), rB).orphan, true);
});

test('efsProximaSemanaLunDom: lunes a domingo de la semana siguiente', () => {
  // 2026-10-17 es sábado.
  const r = P.efsProximaSemanaLunDom(new Date('2026-10-17T12:00:00Z'), 'America/Toronto');
  assert.equal(new Date(r.weekStart + 'T12:00:00Z').getUTCDay(), 1, 'weekStart es lunes');
  assert.equal(new Date(r.weekEnd + 'T12:00:00Z').getUTCDay(), 0, 'weekEnd es domingo');
  const dias = (Date.parse(r.weekEnd) - Date.parse(r.weekStart)) / 86400000;
  assert.equal(dias, 6, 'lun..dom = 6 días');
  assert.ok(r.weekStart > '2026-10-17', 'es la semana siguiente');
});

test('datos REALES: genera borradores para una semana de enero', () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
  const rows = [Array.from(H)], logs = [];
  const r = P.efsGenerarSemana(makeDeps(data, rows, logs));
  assert.ok(r.resumen.nuevo > 0, 'propone al menos un borrador');
  // Toda fila nueva tiene draftId, tweet_text sin HTML y url.
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i][col('draftId')], 'draftId presente');
    assert.ok(!/<[^>]+>/.test(String(rows[i][col('textX')])), 'tuit sin HTML');
    assert.match(String(rows[i][col('url')]), /efemerides\.html\?m=\d+&d=\d+/);
  }
});
