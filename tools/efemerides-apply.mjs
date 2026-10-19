// Contrato de APLICACIÓN del plan a un almacén (FASE 2B). Módulo de desarrollo
// PURO: no conecta con ningún servicio real; opera sobre un almacén ficticio en
// memoria (objeto keyed por draftId) y devuelve uno nuevo (no muta la entrada).
//
// Regla general: una operación NO cambia un campo por el mero hecho de venir en
// el objeto de entrada. Cada operación tiene una política explícita de qué
// actualiza y qué preserva. Las entradas de `review` (colisiones, posibles
// correcciones) NO se aplican: nunca tocan el almacén.
//
// CONTRATO POR OPERACIÓN
// ──────────────────────────────────────────────────────────────────────────────
//  campo            nuevo      sin_cambios  cambio_contenido      edicion_preservada  desaparecido
//  draftId/eventId  set        -            -                     -                   -
//  campaignYear     set        -            -                     -                   -
//  kind             set        -            -                     -                   -
//  createdAt        =now       PRESERVA     PRESERVA              PRESERVA            PRESERVA
//  status           'pendiente' PRESERVA    PRESERVA              PRESERVA            PRESERVA
//  textX            set        PRESERVA     set (si !editedText)  PRESERVA            PRESERVA
//  suggestedAt      set        PRESERVA     set (si !editedTime)  PRESERVA            PRESERVA
//  editedText       false      PRESERVA     PRESERVA              PRESERVA            PRESERVA
//  editedTime       false      PRESERVA     PRESERVA              PRESERVA            PRESERVA
//  category/players/eventDateISO set       PRESERVA  set          PRESERVA            PRESERVA
//  sourceFingerprint set       PRESERVA     = observado           PRESERVA (¡no!)     PRESERVA
//  reviewedFingerprint —       PRESERVA     limpia                PRESERVA            PRESERVA
//  sourceSnapshot   set        PRESERVA     = observado           PRESERVA            PRESERVA
//  observed* / pendingSourceChange —  limpia  limpia             set (observado)     PRESERVA
//  sourceSeenAt     =now       =now         =now                 =now                PRESERVA (no visto)
//  orphan           false      false(limpia) false(limpia)       PRESERVA            =true
//  updatedAt        =now       PRESERVA     =now                  PRESERVA            =now
//
// Estados terminales (aprobado/descartado/publicado): NUNCA se reabren aquí. El
// cambio de estado es una acción humana aparte (no la hace la regeneración).
//
// Fingerprint OBSERVADO vs APLICADO: `cambio_contenido` aplica el nuevo
// fingerprint (converge a sin_cambios). `edicion_preservada` NO lo aplica: guarda
// el observado para revisión y sigue avisando hasta que un humano lo resuelva con
// `resolverRevision` (que fija `reviewedFingerprint`), no de forma automática.

const TERMINALES = new Set(['aprobado', 'descartado', 'publicado']);
const clone = r => ({ ...r });

export function createStore(records = []) {
  const s = {};
  for (const r of records) if (r && r.draftId) s[r.draftId] = clone(r);
  return s;
}

export function applyPlan(store, plan, opts = {}) {
  const now = opts.now ?? null;
  const out = {};
  for (const k of Object.keys(store)) out[k] = clone(store[k]);
  const log = [];

  for (const op of (plan.ops || [])) {
    const prev = out[op.draftId];
    switch (op.op) {
      case 'nuevo': {
        if (prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'ya existe; nuevo no sobrescribe' }); break; }
        out[op.draftId] = {
          draftId: op.draftId, eventId: op.eventId, campaignYear: op.campaignYear, kind: op.kind,
          eventDateISO: op.eventDateISO, category: op.category, players: op.players,
          textX: op.textX, suggestedAt: op.suggestedAt,
          status: op.status ?? 'pendiente', editedText: false, editedTime: false,
          sourceFingerprint: op.sourceFingerprint, sourceSnapshot: op.sourceSnapshot,
          reviewedFingerprint: null, observedFingerprint: null, observedSnapshot: null,
          pendingSourceChange: false, orphan: false,
          createdAt: op.createdAt ?? now, updatedAt: now, sourceSeenAt: now,
        };
        log.push({ draftId: op.draftId, resultado: 'creado' });
        break;
      }
      case 'sin_cambios': {
        if (!prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'sin_cambios sobre inexistente' }); break; }
        prev.sourceSeenAt = now;
        prev.orphan = false;                         // reapareció/está presente
        prev.pendingSourceChange = false;            // contenido acorde con lo aplicado/reconocido
        prev.observedFingerprint = null; prev.observedSnapshot = null;
        log.push({ draftId: op.draftId, resultado: 'sin_cambios' });
        break;
      }
      case 'cambio_contenido': {
        if (!prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'cambio sobre inexistente' }); break; }
        if (TERMINALES.has(prev.status)) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'estado terminal: no se regenera' }); prev.sourceSeenAt = now; break; }
        // Nunca sobrescribe un texto editado a mano (defensa en profundidad).
        if (!prev.editedText) prev.textX = op.textX;
        if (!prev.editedTime && op.suggestedAt) prev.suggestedAt = op.suggestedAt;
        prev.category = op.category; prev.eventDateISO = op.eventDateISO; prev.players = op.players;
        prev.sourceFingerprint = op.sourceFingerprint;   // APLICA el nuevo fingerprint → converge
        prev.sourceSnapshot = op.sourceSnapshot;
        prev.reviewedFingerprint = null;                 // ya no hay revisión pendiente
        prev.observedFingerprint = null; prev.observedSnapshot = null; prev.pendingSourceChange = false;
        prev.orphan = false; prev.updatedAt = now; prev.sourceSeenAt = now;
        log.push({ draftId: op.draftId, resultado: 'actualizado' });
        break;
      }
      case 'edicion_preservada': {
        if (!prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'preservada sobre inexistente' }); break; }
        // NO toca textX/status/suggestedAt/sourceFingerprint: solo registra lo observado.
        prev.observedFingerprint = op.sourceFingerprintObservado ?? null;
        prev.observedSnapshot = op.sourceSnapshotObservado ?? null;
        prev.pendingSourceChange = true;
        prev.orphan = false; prev.sourceSeenAt = now;
        log.push({ draftId: op.draftId, resultado: 'preservado_pendiente_revision' });
        break;
      }
      case 'desaparecido': {
        if (!prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'desaparecido sobre inexistente' }); break; }
        prev.orphan = true; prev.lastMissingAt = now;   // NO se elimina; nada más cambia
        log.push({ draftId: op.draftId, resultado: 'marcado_huerfano' });
        break;
      }
      default:
        log.push({ draftId: op.draftId, resultado: 'ignorado', motivo: `op desconocida: ${op.op}` });
    }
  }

  // Las revisiones (colisiones, correcciones) nunca mutan el almacén.
  for (const r of (plan.review || [])) log.push({ tipo: r.tipo, draftId: r.draftId || null, resultado: 'revision_humana' });

  return { store: out, log };
}

// Resolución HUMANA de una alerta `edicion_preservada`.
//   modo 'mantener' (por defecto): conserva la edición manual y RECONOCE el
//     contenido observado (reviewedFingerprint := observado) → deja de avisar.
//   modo 'aceptar_origen': descarta la edición manual de texto (editedText=false)
//     para que la próxima regeneración haga cambio_contenido y adopte el origen.
export function resolverRevision(store, draftId, opts = {}) {
  const out = {};
  for (const k of Object.keys(store)) out[k] = clone(store[k]);
  const r = out[draftId];
  if (!r) return { store: out, resultado: 'omitido', motivo: 'no existe' };
  const modo = opts.modo ?? 'mantener';
  if (modo === 'mantener') {
    r.reviewedFingerprint = r.observedFingerprint ?? r.reviewedFingerprint ?? null;
    r.pendingSourceChange = false;
    r.updatedAt = opts.now ?? r.updatedAt;
    return { store: out, resultado: 'reconocido_mantener' };
  }
  if (modo === 'aceptar_origen') {
    r.editedText = false;            // permite que cambio_contenido regenere el texto
    r.reviewedFingerprint = null;    // no reconoce: se adoptará el origen
    r.pendingSourceChange = false;
    r.updatedAt = opts.now ?? r.updatedAt;
    return { store: out, resultado: 'aceptar_origen' };
  }
  return { store: out, resultado: 'omitido', motivo: `modo desconocido: ${modo}` };
}
