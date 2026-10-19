// Pruebas del núcleo puro del generador (FASE 2A). Datos sintéticos salvo la
// comprobación final con data.json real (vía el adaptador que reutiliza efmBuild).
// Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planGeneration } from '../tools/efemerides-gen-core.mjs';
import { createAppSandbox } from '../tools/efemerides-build.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = '2026-01-03T12:00:00Z';
const WEEK = { weekStart: '2026-01-05', weekEnd: '2026-01-11' }; // contiene m-d 01-05..01-11

// Jugadores sintéticos -> data con nameToId correcto.
function dataWith(jugs) {
  return { jugadores: jugs.map(j => ({ id: j.id, nombre: j.nombre })), efemerides: [], transacciones: [] };
}
// Evento sintético en forma de salida de efmBuild.
function ev(kind, player, y, m, d, o = {}) {
  return {
    kind, player, year: y, m, d,
    tag: o.tag || 'Hito',
    html: o.html ?? `<b>${player}</b> hizo algo reseñable en ${y}.`,
    video: o.video || '',
    detail: o.detail,
    tweetText: o.tweetText ?? `📅 ${d}/${m}/${y} — ${player} hizo algo. #NBA`,
  };
}
// Convierte una op 'nuevo' en un registro almacenado (para simular el store).
function opToRecord(op, campaignYear) {
  return {
    draftId: op.draftId, eventId: op.eventId, campaignYear, kind: op.kind,
    eventDateISO: op.eventDateISO, category: op.category, players: op.players,
    textX: op.textX, status: op.status, edited: false,
    sourceFingerprint: op.sourceFingerprint, suggestedAt: op.suggestedAt,
  };
}
const JUGS = [{ id: 'pau-gasol', nombre: 'Pau Gasol' }, { id: 'marc-gasol', nombre: 'Marc Gasol' }];

// ─────────────────────────────────────────────────────────────────────────────
test('idempotencia: misma entrada -> mismo plan; re-aplicar -> sin_cambios', () => {
  const data = dataWith(JUGS);
  const events = [ev('hito', 'Pau Gasol', 2015, 1, 10, { tag: 'CAREER-HIGH' })];
  const p1 = planGeneration({ data, events, existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  const p2 = planGeneration({ data, events, existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  assert.deepEqual(p1, p2, 'dos ejecuciones iguales deben dar planes idénticos');
  assert.equal(p1.stats.nuevo, 1);

  const store = p1.ops.filter(o => o.op === 'nuevo').map(o => opToRecord(o, 2026));
  const p3 = planGeneration({ data, events, existing: store, ...WEEK, campaignYear: 2026, now: NOW });
  assert.equal(p3.stats.nuevo, 0, 'no debe crear duplicados');
  assert.equal(p3.stats.sin_cambios, 1);
});

test('la edición manual nunca se sobrescribe', () => {
  const data = dataWith(JUGS);
  const events = [ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> texto NUEVO del origen.' })];
  const base = planGeneration({ data, events: [ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> texto viejo.' })], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  const rec = opToRecord(base.ops[0], 2026);
  rec.edited = true; rec.textX = 'MI TEXTO MANUAL';
  const p = planGeneration({ data, events, existing: [rec], ...WEEK, campaignYear: 2026, now: NOW });
  const op = p.ops.find(o => o.draftId === rec.draftId);
  assert.equal(op.op, 'edicion_preservada');
  assert.equal(op.textX, 'MI TEXTO MANUAL');
  assert.equal(op.flags.sourceChanged, true);
});

test('los estados aprobado/descartado/publicado no se reinician', () => {
  const data = dataWith(JUGS);
  const viejo = ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> viejo.' });
  const nuevo = ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> cambiado.' });
  const base = planGeneration({ data, events: [viejo], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  for (const estado of ['aprobado', 'descartado', 'publicado']) {
    const rec = opToRecord(base.ops[0], 2026); rec.status = estado;
    const p = planGeneration({ data, events: [nuevo], existing: [rec], ...WEEK, campaignYear: 2026, now: NOW });
    const op = p.ops.find(o => o.draftId === rec.draftId);
    assert.equal(op.status, estado, `estado ${estado} no debe cambiar`);
    assert.equal(op.op, 'edicion_preservada');
    assert.equal(op.textX, rec.textX, 'no debe regenerar el texto de un estado no-pendiente');
  }
});

test('cambio de contenido (pendiente, sin editar) -> regenera texto', () => {
  const data = dataWith(JUGS);
  const base = planGeneration({ data, events: [ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> A.' })], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  const rec = opToRecord(base.ops[0], 2026);
  const nuevo = ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> B distinto.', tweetText: 'TUIT NUEVO' });
  const p = planGeneration({ data, events: [nuevo], existing: [rec], ...WEEK, campaignYear: 2026, now: NOW });
  const op = p.ops.find(o => o.draftId === rec.draftId);
  assert.equal(op.op, 'cambio_contenido');
  assert.equal(op.textX, 'TUIT NUEVO');
  assert.equal(op.status, 'pendiente');
});

test('fingerprint (contenido) != identidad (eventId)', () => {
  const data = dataWith(JUGS);
  const a = ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> redacción 1.' });
  const b = ev('hito', 'Pau Gasol', 2015, 1, 10, { html: '<b>Pau Gasol</b> redacción 2 (otra).' });
  const pa = planGeneration({ data, events: [a], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  const pb = planGeneration({ data, events: [b], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  // Mismo acontecimiento (misma identidad) pese a texto distinto:
  assert.equal(pa.ops[0].draftId, pb.ops[0].draftId);
  assert.equal(pa.ops[0].eventId, pb.ops[0].eventId);
  // Pero distinto fingerprint de contenido:
  assert.notEqual(pa.ops[0].sourceFingerprint, pb.ops[0].sourceFingerprint);
});

test('cambio de FECHA -> identidad nueva + huérfano (no es el mismo borrador)', () => {
  const data = dataWith(JUGS);
  const base = planGeneration({ data, events: [ev('hito', 'Pau Gasol', 2015, 1, 10)], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  const rec = opToRecord(base.ops[0], 2026); // identidad con fecha 2015-01-10
  // El origen "corrige" la fecha a 2015-01-11 (sigue en la ventana):
  const p = planGeneration({ data, events: [ev('hito', 'Pau Gasol', 2015, 1, 11)], existing: [rec], ...WEEK, campaignYear: 2026, now: NOW });
  assert.ok(p.ops.some(o => o.op === 'nuevo' && o.eventDateISO === '2015-01-11'));
  assert.ok(p.ops.some(o => o.op === 'desaparecido' && o.draftId === rec.draftId));
  assert.ok(p.review.some(r => r.tipo === 'posible_correccion_identidad'));
});

test('evento desaparecido: se marca, NO se elimina del historial', () => {
  const data = dataWith(JUGS);
  const base = planGeneration({ data, events: [ev('hito', 'Pau Gasol', 2015, 1, 10)], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  const rec = opToRecord(base.ops[0], 2026);
  // Esta semana el origen ya no trae ese evento (events vacío):
  const p = planGeneration({ data, events: [], existing: [rec], ...WEEK, campaignYear: 2026, now: NOW });
  const op = p.ops.find(o => o.draftId === rec.draftId);
  assert.equal(op.op, 'desaparecido');
  assert.equal(op.flags.orphan, true);
  // Un estado terminal (descartado) NO se marca como desaparecido (historial intacto):
  const rec2 = { ...rec, status: 'descartado' };
  const p2 = planGeneration({ data, events: [], existing: [rec2], ...WEEK, campaignYear: 2026, now: NOW });
  assert.equal(p2.ops.filter(o => o.op === 'desaparecido').length, 0);
});

test('colisión de identidad: se notifica y NO se fusiona ni duplica', () => {
  const data = dataWith(JUGS);
  // Dos hitos del mismo jugador y fecha (como el caso real Pau 2009-12-16):
  const events = [
    ev('hito', 'Pau Gasol', 2009, 1, 10, { tag: 'CAREER-HIGH', html: '<b>Pau Gasol</b> récord de rebotes.' }),
    ev('hito', 'Pau Gasol', 2009, 1, 10, { tag: 'PARTIDO DESTACADO', html: '<b>Pau Gasol</b> primer 20+20.' }),
  ];
  const p = planGeneration({ data, events, existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  const col = p.review.find(r => r.tipo === 'colision_id');
  assert.ok(col, 'debe notificar la colisión');
  assert.equal(col.eventos.length, 2);
  // No se emite ninguna op para ese draftId en conflicto:
  assert.equal(p.ops.filter(o => o.draftId === col.draftId).length, 0);
});

test('fecha inválida en el origen: se registra y no genera borrador', () => {
  const data = dataWith(JUGS);
  data.efemerides = [{ fecha: '31 nov 2020', jugador: 'Pau Gasol', hito: 'imposible' }];
  const p = planGeneration({ data, events: [], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  const err = p.errors.find(e => e.fuente === 'efemerides');
  assert.ok(err, 'debe registrar la fecha inválida');
  assert.equal(err.tipo, 'fecha_invalida');
  assert.equal(err.code, 'dia_fuera_de_rango');
  assert.equal(p.ops.length, 0, 'no debe producir borradores');
});

test('sugerencias horarias en America/Toronto, con DST y sin depender del TZ local', () => {
  const data = dataWith(JUGS);
  // Enero (EST, -05:00):
  const invierno = planGeneration({ data, events: [ev('hito', 'Pau Gasol', 2015, 1, 10)], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  assert.equal(invierno.ops[0].suggestedAt.tz, 'America/Toronto');
  assert.equal(invierno.ops[0].suggestedAt.offset, '-05:00');
  // Julio (EDT, -04:00):
  const verano = planGeneration({ data, events: [ev('hito', 'Pau Gasol', 2015, 7, 8)], existing: [], weekStart: '2026-07-06', weekEnd: '2026-07-12', campaignYear: 2026, now: NOW });
  assert.equal(verano.ops[0].suggestedAt.offset, '-04:00');

  // Independencia del TZ de la máquina: cambiar process.env.TZ no altera el resultado.
  const prev = process.env.TZ;
  process.env.TZ = 'Pacific/Kiritimati'; // UTC+14
  const invierno2 = planGeneration({ data, events: [ev('hito', 'Pau Gasol', 2015, 1, 10)], existing: [], ...WEEK, campaignYear: 2026, now: NOW });
  if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
  assert.deepEqual(invierno2.ops[0].suggestedAt, invierno.ops[0].suggestedAt);
});

test('datos REALES: data.json + efmBuild real -> plan coherente, 0 errores de fecha', () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
  const sb = createAppSandbox();
  const events = sb.buildEvents(data).map(e => ({ ...e, tweetText: sb.tweetTextFor(e) }));
  // Semana de 2026 que contiene varias efemérides de enero:
  const p = planGeneration({ data, events, existing: [], weekStart: '2026-01-05', weekEnd: '2026-01-11', campaignYear: 2026, now: NOW });
  assert.equal(p.errors.length, 0, 'no debe haber fechas inválidas en datos reales');
  assert.ok(p.stats.nuevo > 0, 'debe proponer al menos un borrador esa semana');
  // Todos los tuits propuestos vienen del efmShare real: sin HTML.
  for (const op of p.ops.filter(o => o.op === 'nuevo')) {
    assert.ok(!/<[^>]+>/.test(op.textX), `tuit con HTML en ${op.draftId}`);
    assert.equal(op.suggestedAt.tz, 'America/Toronto');
  }
});
