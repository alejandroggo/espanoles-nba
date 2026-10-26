// Pruebas del contrato de aplicación (FASE 2B). Almacén ficticio en memoria.
// Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, applyPlan, resolverRevision } from '../tools/efemerides-apply.mjs';

const DID = 'hito:pau-gasol:2015-01-10#2026';
function record(over = {}) {
  return {
    draftId: DID, eventId: 'hito:pau-gasol:2015-01-10', campaignYear: 2026, kind: 'hito',
    eventDateISO: '2015-01-10', category: 'CAREER-HIGH', players: [{ name: 'Pau Gasol', id: 'pau-gasol' }],
    textX: 'tuit original', suggestedAt: { wall: '2026-01-10T10:00', tz: 'America/Toronto', offset: '-05:00', utc: 'x' },
    status: 'pendiente', editedText: false, editedTime: false,
    sourceFingerprint: 'fpA', sourceSnapshot: { texto: 'A' }, reviewedFingerprint: null,
    observedFingerprint: null, observedSnapshot: null, pendingSourceChange: false, orphan: false,
    createdAt: 'C0', updatedAt: 'C0', sourceSeenAt: 'C0',
    ...over,
  };
}
const planWith = (...ops) => ({ ops, review: [] });

test('sin_cambios: refresca textX con la plantilla actual solo si no está editado ni terminal', () => {
  const sc = (over = {}) => ({ op: 'sin_cambios', draftId: DID, eventId: 'hito:pau-gasol:2015-01-10', kind: 'hito', campaignYear: 2026, status: over.status || 'pendiente', textX: 'tuit original', textXCanonico: 'TUIT NUEVA PLANTILLA', suggestedAt: null, flags: {} });
  // pendiente, sin edición: se refresca al texto canónico nuevo.
  let r = applyPlan(createStore([record({ status: 'pendiente', editedText: false })]), planWith(sc()), { now: 'C1' });
  assert.equal(r.store[DID].textX, 'TUIT NUEVA PLANTILLA', 'refresca el no editado');
  // editado a mano: se preserva.
  r = applyPlan(createStore([record({ textX: 'MI EDICIÓN', editedText: true })]), planWith(sc()), { now: 'C1' });
  assert.equal(r.store[DID].textX, 'MI EDICIÓN', 'no toca la edición manual');
  // estado terminal: se preserva aunque no esté editado.
  for (const estado of ['aprobado', 'descartado', 'publicado']) {
    r = applyPlan(createStore([record({ status: estado, textX: 'tuit original', editedText: false })]), planWith(sc({ status: estado })), { now: 'C1' });
    assert.equal(r.store[DID].textX, 'tuit original', `terminal (${estado}) preservado`);
  }
  // idempotente: si el texto canónico coincide, no cambia updatedAt.
  r = applyPlan(createStore([record({ status: 'pendiente', editedText: false, textX: 'IGUAL', updatedAt: 'C0' })]), planWith({ ...sc(), textXCanonico: 'IGUAL' }), { now: 'C1' });
  assert.equal(r.store[DID].updatedAt, 'C0', 'sin reescritura si el texto no cambia');
});

test('nuevo: crea; no sobrescribe si ya existe', () => {
  const r = applyPlan(createStore([]), planWith({
    op: 'nuevo', draftId: DID, eventId: 'e', campaignYear: 2026, kind: 'hito',
    eventDateISO: '2015-01-10', category: 'X', players: [], textX: 'T', status: 'pendiente',
    sourceFingerprint: 'fpA', sourceSnapshot: {}, suggestedAt: null, createdAt: 'C0', updatedAt: 'C0',
  }), { now: 'C0' });
  assert.equal(r.store[DID].textX, 'T');
  assert.equal(r.store[DID].createdAt, 'C0');
  // intento de 'nuevo' sobre existente -> omitido, no sobrescribe
  const r2 = applyPlan(createStore([record({ textX: 'HUMANO' })]), planWith({ op: 'nuevo', draftId: DID, textX: 'OTRO', eventId: 'e', campaignYear: 2026, kind: 'hito' }), { now: 'C1' });
  assert.equal(r2.store[DID].textX, 'HUMANO');
  assert.ok(r2.log.some(l => l.resultado === 'omitido'));
});

test('createdAt nunca cambia; status terminal no se reabre', () => {
  for (const estado of ['aprobado', 'descartado', 'publicado']) {
    const store = createStore([record({ status: estado, createdAt: 'C0' })]);
    const r = applyPlan(store, planWith({ op: 'cambio_contenido', draftId: DID, textX: 'NUEVO', category: 'X', eventDateISO: '2015-01-10', players: [], sourceFingerprint: 'fpB', sourceSnapshot: {}, suggestedAt: null }), { now: 'C1' });
    assert.equal(r.store[DID].status, estado, 'status terminal preservado');
    assert.equal(r.store[DID].textX, 'tuit original', 'no regenera texto de terminal');
    assert.equal(r.store[DID].createdAt, 'C0', 'createdAt inmutable');
  }
});

test('cambio_contenido: regenera texto y APLICA el fingerprint (si pendiente sin editar)', () => {
  const store = createStore([record({ sourceFingerprint: 'fpA' })]);
  const r = applyPlan(store, planWith({ op: 'cambio_contenido', draftId: DID, textX: 'NUEVO TEXTO', category: 'CAREER-HIGH', eventDateISO: '2015-01-10', players: [{ name: 'Pau Gasol', id: 'pau-gasol' }], sourceFingerprint: 'fpB', sourceSnapshot: { texto: 'B' }, suggestedAt: null }), { now: 'C1' });
  assert.equal(r.store[DID].textX, 'NUEVO TEXTO');
  assert.equal(r.store[DID].sourceFingerprint, 'fpB');
  assert.equal(r.store[DID].createdAt, 'C0');
});

test('cambio_contenido NO sobrescribe texto/hora editados a mano', () => {
  const store = createStore([record({ editedText: true, editedTime: true, textX: 'MANUAL', suggestedAt: { wall: 'MANUAL' } })]);
  const r = applyPlan(store, planWith({ op: 'cambio_contenido', draftId: DID, textX: 'REGEN', category: 'X', eventDateISO: '2015-01-10', players: [], sourceFingerprint: 'fpB', sourceSnapshot: {}, suggestedAt: { wall: 'OTRA' } }), { now: 'C1' });
  assert.equal(r.store[DID].textX, 'MANUAL', 'texto manual intacto');
  assert.deepEqual(r.store[DID].suggestedAt, { wall: 'MANUAL' }, 'hora manual intacta');
});

test('edicion_preservada: no toca nada aplicable; guarda observado; NO aplica fingerprint', () => {
  const store = createStore([record({ editedText: true, textX: 'MANUAL', sourceFingerprint: 'fpA' })]);
  const r = applyPlan(store, planWith({ op: 'edicion_preservada', draftId: DID, status: 'pendiente', textX: 'MANUAL', suggestedAt: record().suggestedAt, sourceFingerprintObservado: 'fpB', sourceSnapshotObservado: { texto: 'B' } }), { now: 'C1' });
  const d = r.store[DID];
  assert.equal(d.textX, 'MANUAL');
  assert.equal(d.sourceFingerprint, 'fpA', 'NO aplica el fingerprint observado');
  assert.equal(d.observedFingerprint, 'fpB');
  assert.equal(d.pendingSourceChange, true);
});

test('desaparecido: marca huérfano, NO elimina', () => {
  const store = createStore([record({ status: 'aprobado', textX: 'MANUAL' })]);
  const r = applyPlan(store, planWith({ op: 'desaparecido', draftId: DID, status: 'aprobado', flags: { orphan: true } }), { now: 'C1' });
  assert.ok(r.store[DID], 'el registro sigue existiendo');
  assert.equal(r.store[DID].orphan, true);
  assert.equal(r.store[DID].status, 'aprobado');
  assert.equal(r.store[DID].textX, 'MANUAL');
});

test('review (colisión) nunca muta el almacén', () => {
  const store = createStore([record({ textX: 'HUMANO', status: 'aprobado', createdAt: 'C0' })]);
  const antes = JSON.stringify(store[DID]);
  const r = applyPlan(store, { ops: [], review: [{ tipo: 'colision_id', draftId: DID, borradoresAfectados: [{ draftId: DID }] }] }, { now: 'C9' });
  assert.equal(JSON.stringify(r.store[DID]), antes, 'registro intacto');
  assert.ok(r.log.some(l => l.tipo === 'colision_id' && l.resultado === 'revision_humana'));
});

test('resolverRevision mantener: reconoce el observado y deja de avisar', () => {
  const store = createStore([record({ editedText: true, textX: 'MANUAL', sourceFingerprint: 'fpA', observedFingerprint: 'fpB', pendingSourceChange: true })]);
  const r = resolverRevision(store, DID, { modo: 'mantener', now: 'C2' });
  assert.equal(r.store[DID].reviewedFingerprint, 'fpB');
  assert.equal(r.store[DID].pendingSourceChange, false);
  assert.equal(r.store[DID].textX, 'MANUAL');
});

test('aplicar es puro: no muta el almacén de entrada', () => {
  const store = createStore([record()]);
  const snap = JSON.stringify(store);
  applyPlan(store, planWith({ op: 'cambio_contenido', draftId: DID, textX: 'X', category: 'Y', eventDateISO: '2015-01-10', players: [], sourceFingerprint: 'fpB', sourceSnapshot: {}, suggestedAt: null }), { now: 'C1' });
  assert.equal(JSON.stringify(store), snap, 'el store original no se modifica');
});
