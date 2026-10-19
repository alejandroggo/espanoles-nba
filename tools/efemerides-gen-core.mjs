// Núcleo PURO del futuro generador semanal de borradores de efemérides.
// FASE 2B (endurecimiento tras la auditoría 2A).
//
// Función determinista: recibe una instantánea de data.json (+ los eventos ya
// construidos por efmBuild, para no duplicar plantillas), una instantánea de los
// borradores existentes y la ventana semanal + año de campaña, y devuelve un PLAN
// de operaciones. NO escribe nada: ni archivos, ni Google Sheets, ni servicios.
// La APLICACIÓN del plan a un almacén la hace tools/efemerides-apply.mjs según un
// contrato explícito por operación.
//
// No modifica app.js ni data.json. No depende de la zona horaria de la máquina:
// las horas se calculan con Intl y timeZone 'America/Toronto'.
//
// Reutiliza:
//   · eventId/draftId  -> tools/efemerides-id.mjs
//   · validación fechas -> tools/efemerides-fecha.mjs
//   · plantillas de texto y compositor de tuit -> NO se duplican; el llamador
//     adjunta `tweetText` a cada evento usando el efmShare real (efemerides-build.mjs).
//
// CAMBIOS 2B:
//   H1  Colisión con borradores existentes: se notifica referenciando los
//       draftId afectados y NO se marca su borrador como `desaparecido`.
//   Fingerprint observado vs reconocido: `edicion_preservada` no se silencia sola;
//       solo un `reviewedFingerprint` (que fija el humano al resolver) la calla.
//   Ediciones independientes de texto y hora: `editedText` / `editedTime`
//       (con compatibilidad hacia atrás: `edited` == editedText).
//   DST: horas de pared inexistentes o ambiguas se rechazan con error claro.

import { eventId as calcEventId, draftId as calcDraftId, buildNameToId, norm } from './efemerides-id.mjs';
import { parsearFecha, validarYMD } from './efemerides-fecha.mjs';

const SLOTS_DEFAULT = ['10:00', '14:00', '19:00']; // franjas sugeridas (configurable)
const TZ = 'America/Toronto';
// Para bloqueo de TEXTO / no-regeneración y "no reabrir": aprobado cuenta.
const ESTADOS_TERMINALES = new Set(['aprobado', 'descartado', 'publicado']);
// Para NO marcar como desaparecido: solo los ya resueltos (publicado/descartado).
// Un 'aprobado' cuyo evento desaparece del origen SÍ se avisa (no reabre su estado).
const ESTADOS_RESUELTOS = new Set(['descartado', 'publicado']);

// ── utilidades deterministas ────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');

function stripText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

// Hash djb2 (estable, sin dependencias) en base36.
function hash(s) {
  let h = 5381;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Huella del CONTENIDO (texto + categoría + vídeo). NO incluye la identidad
// (jugador/fecha/equipos): eso ya lo captura el eventId. Dos ejecuciones con el
// mismo contenido dan la misma huella; una corrección de redacción la cambia.
function contentFingerprint(ev) {
  return hash(stripText(ev.html) + '|' + (ev.tag || '') + '|' + (ev.video || ''));
}

function textXFor(ev) {
  return ev.tweetText != null ? ev.tweetText : stripText(ev.html);
}

function playersOf(ev, nameToId) {
  const name = ev.player || '';
  if (!name) return [];
  return [{ name, id: nameToId[norm(name)] || null }];
}

// Instantánea del contenido de origen en el momento de generar (para diff/revisión).
function snapshotOf(ev, eventDateISO, players) {
  return { texto: stripText(ev.html), tag: ev.tag || '', video: ev.video || '', eventDateISO, players };
}

// Edición: `edited` (histórico) == editedText; añadimos editedTime independiente.
function editFlags(ex) {
  const editedText = ex.editedText ?? ex.edited ?? false;
  const editedTime = ex.editedTime ?? false;
  return { editedText: !!editedText, editedTime: !!editedTime };
}

// ── zona horaria America/Toronto (DST correcto vía Intl, sin librerías) ───────
function tzParts(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +(p.hour === '24' ? '0' : p.hour), mi: +p.minute, s: +p.second };
}
function tzOffsetMs(date, tz) {
  const p = tzParts(date, tz);
  const asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}
function wallMatches(date, y, mo, d, h, mi, tz) {
  const p = tzParts(date, tz);
  return p.y === y && p.mo === mo && p.d === d && p.h === h && p.mi === mi;
}
// Resuelve una hora de pared (y,mo,d,h,mi) a un instante UTC en `tz`, detectando
// explícitamente horas INEXISTENTES (salto de primavera) y AMBIGUAS (otoño).
function resolveWall(y, mo, d, h, mi, tz) {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const c1 = naive - tzOffsetMs(new Date(naive - 12 * 3600000), tz); // offset "de antes"
  const c2 = naive - tzOffsetMs(new Date(naive + 12 * 3600000), tz); // offset "de después"
  const v1 = wallMatches(new Date(c1), y, mo, d, h, mi, tz);
  const v2 = wallMatches(new Date(c2), y, mo, d, h, mi, tz);
  if (c1 === c2) return v1 ? { ok: true, utc: new Date(c1) } : { ok: false, code: 'hora_inexistente' };
  if (v1 && v2) return { ok: false, code: 'hora_ambigua' }; // ocurre dos veces
  if (v1) return { ok: true, utc: new Date(c1) };
  if (v2) return { ok: true, utc: new Date(c2) };
  return { ok: false, code: 'hora_inexistente' }; // no ocurre ninguna vez (hueco DST)
}
function offsetLabel(date, tz) {
  const min = Math.round(tzOffsetMs(date, tz) / 60000);
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
// Sugerencia horaria: éxito -> {wall,tz,offset,utc}; fallo -> {wall,tz,error}.
function sugerenciaHoraria(dateStr, hhmm) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const wall = `${dateStr}T${pad(h)}:${pad(mi)}`;
  const r = resolveWall(y, mo, d, h, mi, TZ);
  if (!r.ok) return { wall, tz: TZ, error: r.code };
  return { wall, tz: TZ, offset: offsetLabel(r.utc, TZ), utc: r.utc.toISOString() };
}

// Días (m,d) y fechas reales cubiertos por [weekStart, weekEnd] (ISO), en UTC.
function windowDays(weekStart, weekEnd) {
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(weekEnd + 'T00:00:00Z');
  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const dt = new Date(t);
    out.push({ m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` });
    if (out.length > 60) break; // guardia anti-bucle
  }
  return out;
}

// ── escaneo de fechas inválidas en el ORIGEN (no produce borradores) ──────────
function scanRawDates(data, opts) {
  const errs = [];
  const push = (fuente, ref, raw) => {
    const r = parsearFecha(raw, opts);
    if (!r.ok) errs.push({ tipo: 'fecha_invalida', fuente, ref, fechaBruta: raw ?? null, code: r.code, motivo: r.motivo });
  };
  (data.efemerides || []).forEach((e, i) => push('efemerides', e.id || `#${i}:${e.jugador || ''}`, e.fecha));
  (data.transacciones || []).forEach((t, i) => push('transacciones', `#${i}:${t.jugador || ''}:${t.tipo || ''}`, t.fecha));
  (data.jugadores || []).forEach(j => {
    const p = j.primer_partido;
    if (p && p.fecha) push('primer_partido', j.id, p.fecha);
    if (j.draft && j.draft_fecha) push('draft', j.id, j.draft_fecha);
    if (j.nacimiento_fecha) push('nacimiento', j.id, j.nacimiento_fecha);
  });
  return errs;
}

// ── núcleo ────────────────────────────────────────────────────────────────────
export function planGeneration(input) {
  const {
    data, events, existing = [],
    weekStart, weekEnd, campaignYear,
    now = null, slots = SLOTS_DEFAULT, dateOpts = {},
  } = input;

  const nameToId = buildNameToId(data.jugadores);
  const win = windowDays(weekStart, weekEnd);
  const winSet = new Set(win.map(x => `${x.m}-${x.d}`));
  const winDate = new Map(win.map(x => [`${x.m}-${x.d}`, x.date]));

  const errors = scanRawDates(data, dateOpts);

  // 1) candidatos: eventos de la ventana con fecha válida.
  const candidates = [];
  for (const ev of (events || [])) {
    if (!winSet.has(`${ev.m}-${ev.d}`)) continue;
    const vr = validarYMD(ev.year, ev.m, ev.d, dateOpts);
    if (!vr.ok) { // defensivo: un evento con fecha imposible nunca es borrador
      errors.push({ tipo: 'fecha_invalida', fuente: 'evento', ref: `${ev.kind}:${ev.player || ''}`, fechaBruta: `${ev.year}-${ev.m}-${ev.d}`, code: vr.code, motivo: vr.motivo });
      continue;
    }
    const eid = calcEventId(ev, nameToId);
    const did = calcDraftId(eid, campaignYear);
    const players = playersOf(ev, nameToId);
    candidates.push({
      ev, eventId: eid, draftId: did, kind: ev.kind, eventDateISO: vr.iso,
      mmdd: `${ev.m}-${ev.d}`, category: ev.tag || '', players,
      textX: textXFor(ev), fingerprint: contentFingerprint(ev),
      sourceSnapshot: snapshotOf(ev, vr.iso, players),
    });
  }

  const existingByDraft = new Map((existing || []).map(r => [r.draftId, r]));

  // 2) colisiones de draftId (dos eventos de origen distintos → misma identidad).
  //    H1: se notifican referenciando los borradores existentes y NO se tocan.
  const byDraft = new Map();
  for (const c of candidates) (byDraft.get(c.draftId) || byDraft.set(c.draftId, []).get(c.draftId)).push(c);
  const review = [];
  const uniq = [];
  const colisionEventIds = new Set();   // eventIds en colisión (se consideran "vistos")
  const colisionDraftIds = new Set();   // draftIds en colisión (no se emiten ops)
  for (const [did, group] of byDraft) {
    if (group.length === 1) { uniq.push(group[0]); continue; }
    colisionEventIds.add(group[0].eventId);
    colisionDraftIds.add(did);
    const ex = existingByDraft.get(did);
    review.push({
      tipo: 'colision_id', draftId: did, eventId: group[0].eventId,
      eventos: group.map(g => ({ eventId: g.eventId, kind: g.kind, eventDateISO: g.eventDateISO, categoria: g.category, texto: stripText(g.ev.html).slice(0, 140) })),
      borradoresAfectados: ex ? [{ draftId: ex.draftId, status: ex.status, editedText: editFlags(ex).editedText, editedTime: editFlags(ex).editedTime, textXPreview: String(ex.textX || '').slice(0, 80) }] : [],
      nota: 'Dos o más eventos de origen comparten identidad. No se crea ni modifica ningún borrador y NINGUNO se marca como desaparecido: el/los borradores existentes quedan intactos. Requiere resolución humana (p. ej. id de origen para hitos).',
    });
  }

  // 3) asignación de franjas horarias por día (determinista: orden por draftId).
  const porDia = new Map();
  for (const c of uniq) (porDia.get(c.mmdd) || porDia.set(c.mmdd, []).get(c.mmdd)).push(c);
  const suggestedById = new Map();
  for (const [mmdd, group] of porDia) {
    group.sort((a, b) => cmp(a.draftId, b.draftId));
    const fecha = winDate.get(mmdd);
    group.forEach((c, i) => {
      const slot = slots[Math.min(i, slots.length - 1)];
      const s = sugerenciaHoraria(fecha, slot);
      if (i >= slots.length) s.overflow = true; // más eventos que franjas ese día
      if (s.error) errors.push({ tipo: 'hora_invalida', fuente: 'slot', ref: c.draftId, slot, fecha, code: s.error });
      suggestedById.set(c.draftId, s);
    });
  }

  // 4) diff contra los borradores existentes (solo candidatos únicos).
  const seenEventIds = new Set(uniq.map(c => c.eventId));
  for (const id of colisionEventIds) seenEventIds.add(id); // H1: no desaparecen por colisión
  const ops = [];

  for (const c of uniq) {
    const ex = existingByDraft.get(c.draftId);
    const suggestedAt = suggestedById.get(c.draftId) || null;
    if (!ex) {
      ops.push({
        op: 'nuevo', draftId: c.draftId, eventId: c.eventId, kind: c.kind, campaignYear,
        eventDateISO: c.eventDateISO, category: c.category, players: c.players,
        textX: c.textX, status: 'pendiente', sourceFingerprint: c.fingerprint,
        sourceSnapshot: c.sourceSnapshot, suggestedAt,
        editedText: false, editedTime: false, createdAt: now, updatedAt: now, flags: {},
      });
      continue;
    }
    const { editedText, editedTime } = editFlags(ex);
    const changed = ex.sourceFingerprint !== c.fingerprint;
    const acknowledged = ex.reviewedFingerprint != null && ex.reviewedFingerprint === c.fingerprint;
    const textLocked = editedText || ESTADOS_TERMINALES.has(ex.status);
    const suggKeep = ex.suggestedAt ?? suggestedAt;

    if (!changed || acknowledged) {
      ops.push({ op: 'sin_cambios', draftId: c.draftId, eventId: c.eventId, kind: c.kind, campaignYear,
        status: ex.status, textX: ex.textX, suggestedAt: suggKeep,
        flags: { editedText, editedTime, acknowledged: acknowledged && changed } });
    } else if (textLocked) {
      ops.push({
        op: 'edicion_preservada', draftId: c.draftId, eventId: c.eventId, kind: c.kind, campaignYear,
        status: ex.status,                 // nunca se reinicia
        textX: ex.textX,                   // la edición manual / texto aprobado no se sobrescribe
        suggestedAt: suggKeep,             // la hora manual/previa no se recalcula
        sourceFingerprintObservado: c.fingerprint,   // lo que el origen tiene AHORA (no se aplica aún)
        sourceSnapshotObservado: c.sourceSnapshot,
        flags: { sourceChanged: true, editedText, editedTime, statusBloqueado: ESTADOS_TERMINALES.has(ex.status) },
        nota: 'El contenido del origen cambió, pero hay edición manual de texto o estado terminal: se conserva. Marcado para revisión. El fingerprint NO se actualiza hasta que un humano lo resuelva (resolverRevision).',
      });
    } else {
      // pendiente y sin edición de texto → se regenera el texto; la hora se preserva
      // (incluida una hora editada manualmente, que nunca se recalcula).
      ops.push({
        op: 'cambio_contenido', draftId: c.draftId, eventId: c.eventId, kind: c.kind, campaignYear,
        eventDateISO: c.eventDateISO, category: c.category, players: c.players,
        textX: c.textX, status: ex.status, sourceFingerprint: c.fingerprint,
        sourceSnapshot: c.sourceSnapshot, suggestedAt: suggKeep, updatedAt: now,
        flags: { sourceChanged: true, editedTime },
      });
    }
  }

  // 5) eventos desaparecidos del origen (no se eliminan: se marcan para revisión).
  const orphans = [];
  for (const r of (existing || [])) {
    if (r.campaignYear !== campaignYear) continue;
    if (colisionDraftIds.has(r.draftId)) continue;           // H1: colisión no es desaparición
    const mmdd = isoToMMDD(r.eventDateISO);
    if (!mmdd || !winSet.has(mmdd)) continue;                // solo los de esta ventana
    if (seenEventIds.has(r.eventId)) continue;               // sigue en el origen
    if (ESTADOS_RESUELTOS.has(r.status)) continue;           // publicado/descartado: historial intacto
    const o = {
      op: 'desaparecido', draftId: r.draftId, eventId: r.eventId, kind: r.kind, campaignYear,
      eventDateISO: r.eventDateISO, status: r.status, players: r.players || [],
      flags: { orphan: true },
      nota: 'Este borrador ya no corresponde a ningún evento del origen esta semana. No se elimina automáticamente; requiere revisión.',
    };
    ops.push(o); orphans.push(o);
  }

  // 6) posibles correcciones de identidad (nuevo <-> desaparecido). No se fusionan.
  const nuevos = ops.filter(o => o.op === 'nuevo');
  for (const o of orphans) {
    for (const n of nuevos) {
      if (n.kind !== o.kind) continue;
      const share = sharePlayer(n.players, o) || n.eventDateISO === o.eventDateISO;
      const dd = dayDiff(n.eventDateISO, o.eventDateISO);
      if (share && dd != null && dd <= 7) {
        review.push({
          tipo: 'posible_correccion_identidad',
          desaparecido: { draftId: o.draftId, eventId: o.eventId, eventDateISO: o.eventDateISO },
          nuevo: { draftId: n.draftId, eventId: n.eventId, eventDateISO: n.eventDateISO },
          nota: 'Posible corrección en origen (fecha/equipo/jugador). No se fusiona automáticamente; el humano decide heredar estado/edición.',
        });
      }
    }
  }

  // orden determinista
  ops.sort((a, b) => cmp(a.op, b.op) || cmp(a.draftId, b.draftId));
  review.sort((a, b) => cmp(a.tipo, b.tipo) || cmp(JSON.stringify(a), JSON.stringify(b)));
  errors.sort((a, b) => cmp((a.fuente || '') + (a.ref || ''), (b.fuente || '') + (b.ref || '')));

  const stats = {
    nuevo: ops.filter(o => o.op === 'nuevo').length,
    sin_cambios: ops.filter(o => o.op === 'sin_cambios').length,
    cambio_contenido: ops.filter(o => o.op === 'cambio_contenido').length,
    edicion_preservada: ops.filter(o => o.op === 'edicion_preservada').length,
    desaparecido: ops.filter(o => o.op === 'desaparecido').length,
    colisiones: review.filter(r => r.tipo === 'colision_id').length,
    posibles_correcciones: review.filter(r => r.tipo === 'posible_correccion_identidad').length,
    fechas_invalidas: errors.filter(e => e.tipo === 'fecha_invalida').length,
    horas_invalidas: errors.filter(e => e.tipo === 'hora_invalida').length,
  };

  return { campaignYear, weekStart, weekEnd, tz: TZ, slots, ventana: win.map(x => `${pad(x.m)}-${pad(x.d)}`), ops, review, errors, stats };
}

// ── helpers varios ────────────────────────────────────────────────────────────
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function isoToMMDD(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[2]}-${+m[3]}` : null; }
function sharePlayer(players, orphan) {
  if (!Array.isArray(players) || !orphan.players) return false;
  const ids = new Set(players.map(p => p.id).filter(Boolean));
  return (orphan.players || []).some(p => p.id && ids.has(p.id));
}
function dayDiff(isoA, isoB) {
  const a = Date.parse(isoA + 'T00:00:00Z'), b = Date.parse(isoB + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.abs(Math.round((a - b) / 86400000));
}

// Export para pruebas de zona horaria.
export const _tz = { sugerenciaHoraria, resolveWall };
