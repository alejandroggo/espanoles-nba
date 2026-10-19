// Núcleo PURO del futuro generador semanal de borradores de efemérides (FASE 2A).
//
// Función determinista: recibe una instantánea de data.json (+ los eventos ya
// construidos por efmBuild, para no duplicar plantillas), una instantánea de los
// borradores existentes y la ventana semanal + año de campaña, y devuelve un PLAN
// de operaciones. NO escribe nada: ni archivos, ni Google Sheets, ni servicios.
//
// No modifica app.js ni data.json. No depende de la zona horaria de la máquina:
// las sugerencias horarias se calculan con Intl y timeZone 'America/Toronto'.
//
// Reutiliza:
//   · eventId/draftId  -> tools/efemerides-id.mjs
//   · validación fechas -> tools/efemerides-fecha.mjs
//   · plantillas de texto y compositor de tuit -> NO se duplican; el llamador
//     adjunta `tweetText` a cada evento usando el efmShare real (ver
//     tools/efemerides-build.mjs). Si no viene, se cae al texto plano del html.

import { eventId as calcEventId, draftId as calcDraftId, buildNameToId, norm } from './efemerides-id.mjs';
import { parsearFecha, validarYMD } from './efemerides-fecha.mjs';

const SLOTS_DEFAULT = ['10:00', '14:00', '19:00']; // franjas sugeridas (configurable)
const TZ = 'America/Toronto';

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

// ── zona horaria America/Toronto (DST correcto vía Intl, sin librerías) ───────
function tzOffsetMs(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +(p.hour === '24' ? '0' : p.hour), +p.minute, +p.second);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}
// UTC exacto de una hora de pared (YYYY-MM-DD HH:MM) en Toronto, con DST.
function wallToUTC(y, mo, d, h, mi, tz) {
  let ts = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) { const off = tzOffsetMs(new Date(ts), tz); ts = Date.UTC(y, mo - 1, d, h, mi) - off; }
  return new Date(ts);
}
function offsetLabel(date, tz) {
  const off = tzOffsetMs(date, tz);           // ms
  const min = Math.round(off / 60000);
  const sign = min <= 0 ? '-' : '+';
  const a = Math.abs(min);
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
function sugerenciaHoraria(dateStr, hhmm) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const utc = wallToUTC(y, mo, d, h, mi, TZ);
  return { wall: `${dateStr}T${pad(h)}:${pad(mi)}`, tz: TZ, offset: offsetLabel(utc, TZ), utc: utc.toISOString() };
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
    const eventId = calcEventId(ev, nameToId);
    const draftId = calcDraftId(eventId, campaignYear);
    candidates.push({
      ev, eventId, draftId,
      kind: ev.kind,
      eventDateISO: vr.iso,
      mmdd: `${ev.m}-${ev.d}`,
      category: ev.tag || '',
      players: playersOf(ev, nameToId),
      textX: textXFor(ev),
      fingerprint: contentFingerprint(ev),
    });
  }

  // 2) colisiones de draftId (dos eventos de origen distintos → misma identidad).
  const byDraft = new Map();
  for (const c of candidates) (byDraft.get(c.draftId) || byDraft.set(c.draftId, []).get(c.draftId)).push(c);
  const review = [];
  const uniq = [];
  for (const [draftId, group] of byDraft) {
    if (group.length === 1) { uniq.push(group[0]); continue; }
    review.push({
      tipo: 'colision_id', draftId,
      eventos: group.map(g => ({ eventId: g.eventId, kind: g.kind, eventDateISO: g.eventDateISO, texto: stripText(g.ev.html).slice(0, 120) })),
      nota: 'Dos eventos de origen distintos comparten identidad. No se fusionan ni se crean borradores en conflicto; requiere revisión humana (p. ej. id de origen para hitos).',
    });
    // No emitimos ops para un draftId en conflicto: el almacén nunca recibe duplicados.
  }

  // 3) asignación de franjas horarias por día (determinista: orden por draftId).
  const porDia = new Map();
  for (const c of uniq) (porDia.get(c.mmdd) || porDia.set(c.mmdd, []).get(c.mmdd)).push(c);
  const suggestedById = new Map();
  for (const [mmdd, group] of porDia) {
    group.sort((a, b) => a.draftId < b.draftId ? -1 : a.draftId > b.draftId ? 1 : 0);
    const fecha = winDate.get(mmdd);
    group.forEach((c, i) => {
      const slot = slots[Math.min(i, slots.length - 1)];
      const s = sugerenciaHoraria(fecha, slot);
      if (i >= slots.length) s.overflow = true; // más eventos que franjas ese día
      suggestedById.set(c.draftId, s);
    });
  }

  // 4) diff contra los borradores existentes.
  const existingByDraft = new Map((existing || []).map(r => [r.draftId, r]));
  const seenEventIds = new Set(uniq.map(c => c.eventId));
  const ops = [];

  for (const c of uniq) {
    const ex = existingByDraft.get(c.draftId);
    const suggestedAt = suggestedById.get(c.draftId) || null;
    if (!ex) {
      ops.push({
        op: 'nuevo', draftId: c.draftId, eventId: c.eventId, kind: c.kind,
        eventDateISO: c.eventDateISO, category: c.category, players: c.players,
        textX: c.textX, status: 'pendiente', sourceFingerprint: c.fingerprint,
        suggestedAt, edited: false, createdAt: now, updatedAt: now, flags: {},
      });
      continue;
    }
    const changed = ex.sourceFingerprint !== c.fingerprint;
    const locked = !!ex.edited || (ex.status && ex.status !== 'pendiente');
    if (!changed) {
      ops.push({ op: 'sin_cambios', draftId: c.draftId, eventId: c.eventId, kind: c.kind,
        status: ex.status, textX: ex.textX, suggestedAt: ex.suggestedAt ?? suggestedAt, flags: {} });
    } else if (locked) {
      ops.push({
        op: 'edicion_preservada', draftId: c.draftId, eventId: c.eventId, kind: c.kind,
        status: ex.status,                 // nunca se reinicia
        textX: ex.textX,                   // la edición manual nunca se sobrescribe
        suggestedAt: ex.suggestedAt ?? suggestedAt,
        sourceFingerprintNuevo: c.fingerprint,
        flags: { sourceChanged: true, edited: !!ex.edited, statusBloqueado: !!(ex.status && ex.status !== 'pendiente') },
        nota: 'El contenido del origen cambió, pero hay edición manual o estado no-pendiente: se conserva. Marcado para revisión.',
      });
    } else {
      ops.push({
        op: 'cambio_contenido', draftId: c.draftId, eventId: c.eventId, kind: c.kind,
        eventDateISO: c.eventDateISO, category: c.category, players: c.players,
        textX: c.textX,                    // regenerado (pendiente y no editado)
        status: 'pendiente', sourceFingerprint: c.fingerprint,
        suggestedAt: ex.suggestedAt ?? suggestedAt, updatedAt: now,
        flags: { sourceChanged: true },
      });
    }
  }

  // 5) eventos desaparecidos del origen (no se eliminan: se marcan para revisión).
  const orphans = [];
  for (const r of (existing || [])) {
    if (r.campaignYear !== campaignYear) continue;
    const mmdd = isoToMMDD(r.eventDateISO);
    if (!mmdd || !winSet.has(mmdd)) continue;              // solo los de esta ventana
    if (seenEventIds.has(r.eventId)) continue;             // sigue en el origen
    if (r.status === 'descartado' || r.status === 'publicado') continue; // ya resuelto: historial intacto
    const o = {
      op: 'desaparecido', draftId: r.draftId, eventId: r.eventId, kind: r.kind,
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
  errors.sort((a, b) => cmp(a.fuente + a.ref, b.fuente + b.ref));

  const stats = {
    nuevo: ops.filter(o => o.op === 'nuevo').length,
    sin_cambios: ops.filter(o => o.op === 'sin_cambios').length,
    cambio_contenido: ops.filter(o => o.op === 'cambio_contenido').length,
    edicion_preservada: ops.filter(o => o.op === 'edicion_preservada').length,
    desaparecido: ops.filter(o => o.op === 'desaparecido').length,
    colisiones: review.filter(r => r.tipo === 'colision_id').length,
    posibles_correcciones: review.filter(r => r.tipo === 'posible_correccion_identidad').length,
    fechas_invalidas: errors.length,
  };

  return { campaignYear, weekStart, weekEnd, tz: TZ, slots, ventana: win.map(x => `${pad(x.m)}-${pad(x.d)}`), ops, review, errors, stats };
}

// ── helpers varios ────────────────────────────────────────────────────────────
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function isoToMMDD(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[2]}-${+m[3]}` : null; }
function sharePlayer(players, orphan) {
  // El huérfano no guarda players normalizados garantizados; comparamos por id si existe.
  if (!Array.isArray(players) || !orphan.players) return false;
  const ids = new Set(players.map(p => p.id).filter(Boolean));
  return (orphan.players || []).some(p => p.id && ids.has(p.id));
}
function dayDiff(isoA, isoB) {
  const a = Date.parse(isoA + 'T00:00:00Z'), b = Date.parse(isoB + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.abs(Math.round((a - b) / 86400000));
}
