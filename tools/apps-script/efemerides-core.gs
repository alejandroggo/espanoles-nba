/**
 * efemerides-core.gs — Núcleo de reconciliación portado a Apps Script (Fase 4, Bloque A).
 *
 * Transliteración FIEL de los módulos .mjs ya probados (misma lógica; solo se quita
 * import/export, se deduplican `norm`/`pad` y se renombran eventId/draftId →
 * calcEventId/calcDraftId para no chocar con variables locales llamadas draftId):
 *   · tools/efemerides-fecha.mjs      → validador estricto de fechas
 *   · tools/efemerides-id.mjs         → identidad (calcEventId/calcDraftId)
 *   · tools/efemerides-gen-core.mjs   → planGeneration (plan determinista)
 *   · tools/efemerides-apply.mjs      → applyPlan / resolverRevision (contrato)
 *
 * Verificado por test/efemerides-core-equivalencia.test.mjs (compara esta copia
 * .gs contra los .mjs sobre los mismos escenarios). No toca app.js/data.json/web.
 */

// ════════ util compartida ════════
function norm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
const pad = n => String(n).padStart(2, '0');

// ════════ fechas (efemerides-fecha.mjs) ════════
const MES_MAP = (() => {
  const m = {};
  const add = (names, n) => names.forEach(x => { m[x] = n; });
  add(['ene', 'enero', 'jan', 'january'], 1);
  add(['feb', 'febrero', 'february'], 2);
  add(['mar', 'marzo', 'march'], 3);
  add(['abr', 'abril', 'apr', 'april'], 4);
  add(['may', 'mayo'], 5);
  add(['jun', 'junio', 'june'], 6);
  add(['jul', 'julio', 'july'], 7);
  add(['ago', 'agosto', 'aug', 'august'], 8);
  add(['sep', 'set', 'sept', 'septiembre', 'setiembre', 'september'], 9);
  add(['oct', 'octubre', 'october'], 10);
  add(['nov', 'noviembre', 'november'], 11);
  add(['dic', 'diciembre', 'dec', 'december'], 12);
  return m;
})();
function esBisiesto(y) { return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0); }
function diasDelMes(y, m) { return [31, esBisiesto(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }
function validarYMD(y, m, d, opts = {}) {
  const minYear = opts.minYear ?? 1946;
  const maxYear = opts.maxYear ?? 2100;
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return { ok: false, code: 'no_reconocida', motivo: 'componentes no numéricos' };
  if (m < 1 || m > 12) return { ok: false, code: 'mes_invalido', motivo: `mes ${m} fuera de 1..12` };
  if (y < minYear || y > maxYear) return { ok: false, code: 'anio_fuera_de_rango', motivo: `año ${y} fuera de ${minYear}..${maxYear}` };
  const max = diasDelMes(y, m);
  if (d < 1 || d > max) return { ok: false, code: 'dia_fuera_de_rango', motivo: `día ${d} fuera de 1..${max} para ${y}-${pad(m)}` };
  return { ok: true, y, m, d, iso: `${y}-${pad(m)}-${pad(d)}` };
}
function parsearFecha(raw, opts = {}) {
  const input = raw;
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return { ok: false, code: 'vacia', motivo: 'fecha vacía', input };
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (m) { const r = validarYMD(+m[1], +m[2], +m[3], opts); return r.ok ? { ...r, formato: 'iso', input } : { ...r, input }; }
  m = s.match(/^(\d{1,2})\s+([a-záéíóúñ.]+)\s+(\d{4})$/i);
  if (m) {
    const tok = norm(m[2]).replace(/\.$/, '');
    const mes = MES_MAP[tok];
    if (!mes) return { ok: false, code: 'mes_invalido', motivo: `mes no reconocido: "${m[2]}"`, input };
    const r = validarYMD(+m[3], mes, +m[1], opts);
    return r.ok ? { ...r, formato: 'texto', input } : { ...r, input };
  }
  return { ok: false, code: 'no_reconocida', motivo: 'formato no reconocido', input };
}

// ════════ identidad (efemerides-id.mjs) ════════
function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function isoOf(ev) { return `${ev.year}-${pad(ev.m)}-${pad(ev.d)}`; }
function playerSlug(ev, nameToId) {
  const n = norm(ev.player || '');
  if (!n) return 'na';
  const id = nameToId && nameToId[n];
  return id || ('name-' + slug(ev.player));
}
function buildNameToId(jugadores) {
  const map = {};
  (jugadores || []).forEach(j => { if (j && j.nombre) map[norm(j.nombre)] = j.id; });
  return map;
}
function calcEventId(ev, nameToId) {
  const pid = playerSlug(ev, nameToId);
  switch (ev.kind) {
    case 'debut': return `debut:${pid}`;
    case 'draft': return `draft:${pid}`;
    case 'cumple': return `cumple:${pid}`;
    case 'trans': {
      const d = ev.detail || {};
      const iso = /^\d{4}-\d{2}-\d{2}/.test(String(d.fecha || '')) ? String(d.fecha).slice(0, 10) : isoOf(ev);
      const parts = ['trans', pid, iso, slug(d.tipo || ev.tag || '')];
      if (d.equipo1 || d.equipo2) parts.push(slug(d.equipo1 || ''), slug(d.equipo2 || ''));
      return parts.join(':');
    }
    case 'hito': return `hito:${pid}:${isoOf(ev)}`;
    default: return `${ev.kind || 'ev'}:${pid}:${isoOf(ev)}`;
  }
}
function calcDraftId(evId, anioPublicacion) { return `${evId}#${anioPublicacion}`; }
function eventIdOf(draftIdStr) { const s = String(draftIdStr || ''); const i = s.lastIndexOf('#'); return i === -1 ? s : s.slice(0, i); }

// ════════ planGeneration (efemerides-gen-core.mjs) ════════
const SLOTS_DEFAULT = ['10:00', '14:00', '19:00'];
const TZ = 'America/Toronto';
const ESTADOS_TERMINALES = new Set(['aprobado', 'descartado', 'publicado']);
const ESTADOS_RESUELTOS = new Set(['descartado', 'publicado']);

function stripText(html) {
  return String(html || '').replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function hash(s) { let h = 5381; const str = String(s); for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0; return h.toString(36); }
function contentFingerprint(ev) { return hash(stripText(ev.html) + '|' + (ev.tag || '') + '|' + (ev.video || '')); }
function textXFor(ev) { return ev.tweetText != null ? ev.tweetText : stripText(ev.html); }
function playersOf(ev, nameToId) { const name = ev.player || ''; if (!name) return []; return [{ name, id: nameToId[norm(name)] || null }]; }
function snapshotOf(ev, eventDateISO, players) { return { texto: stripText(ev.html), tag: ev.tag || '', video: ev.video || '', eventDateISO, players }; }
function editFlags(ex) { return { editedText: !!(ex.editedText ?? ex.edited ?? false), editedTime: !!(ex.editedTime ?? false) }; }

function tzParts(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = {};
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +(p.hour === '24' ? '0' : p.hour), mi: +p.minute, s: +p.second };
}
function tzOffsetMs(date, tz) { const p = tzParts(date, tz); const asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s); return asUTC - Math.floor(date.getTime() / 1000) * 1000; }
function wallMatches(date, y, mo, d, h, mi, tz) { const p = tzParts(date, tz); return p.y === y && p.mo === mo && p.d === d && p.h === h && p.mi === mi; }
function resolveWall(y, mo, d, h, mi, tz) {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const c1 = naive - tzOffsetMs(new Date(naive - 12 * 3600000), tz);
  const c2 = naive - tzOffsetMs(new Date(naive + 12 * 3600000), tz);
  const v1 = wallMatches(new Date(c1), y, mo, d, h, mi, tz);
  const v2 = wallMatches(new Date(c2), y, mo, d, h, mi, tz);
  if (c1 === c2) return v1 ? { ok: true, utc: new Date(c1) } : { ok: false, code: 'hora_inexistente' };
  if (v1 && v2) return { ok: false, code: 'hora_ambigua' };
  if (v1) return { ok: true, utc: new Date(c1) };
  if (v2) return { ok: true, utc: new Date(c2) };
  return { ok: false, code: 'hora_inexistente' };
}
function offsetLabel(date, tz) { const min = Math.round(tzOffsetMs(date, tz) / 60000); const sign = min < 0 ? '-' : '+'; const a = Math.abs(min); return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`; }
function sugerenciaHoraria(dateStr, hhmm) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const wall = `${dateStr}T${pad(h)}:${pad(mi)}`;
  const r = resolveWall(y, mo, d, h, mi, TZ);
  if (!r.ok) return { wall, tz: TZ, error: r.code };
  return { wall, tz: TZ, offset: offsetLabel(r.utc, TZ), utc: r.utc.toISOString() };
}
function windowDays(weekStart, weekEnd) {
  const start = new Date(weekStart + 'T00:00:00Z');
  const end = new Date(weekEnd + 'T00:00:00Z');
  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const dt = new Date(t);
    out.push({ m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` });
    if (out.length > 60) break;
  }
  return out;
}
function scanRawDates(data, opts) {
  const errs = [];
  const push = (fuente, ref, raw) => { const r = parsearFecha(raw, opts); if (!r.ok) errs.push({ tipo: 'fecha_invalida', fuente, ref, fechaBruta: raw ?? null, code: r.code, motivo: r.motivo }); };
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

function planGeneration(input) {
  const { data, events, existing = [], weekStart, weekEnd, campaignYear, now = null, slots = SLOTS_DEFAULT, dateOpts = {} } = input;
  const nameToId = buildNameToId(data.jugadores);
  const win = windowDays(weekStart, weekEnd);
  const winSet = new Set(win.map(x => `${x.m}-${x.d}`));
  const winDate = new Map(win.map(x => [`${x.m}-${x.d}`, x.date]));
  const errors = scanRawDates(data, dateOpts);

  const candidates = [];
  for (const ev of (events || [])) {
    if (!winSet.has(`${ev.m}-${ev.d}`)) continue;
    const vr = validarYMD(ev.year, ev.m, ev.d, dateOpts);
    if (!vr.ok) { errors.push({ tipo: 'fecha_invalida', fuente: 'evento', ref: `${ev.kind}:${ev.player || ''}`, fechaBruta: `${ev.year}-${ev.m}-${ev.d}`, code: vr.code, motivo: vr.motivo }); continue; }
    const eid = calcEventId(ev, nameToId);
    const did = calcDraftId(eid, campaignYear);
    const players = playersOf(ev, nameToId);
    candidates.push({ ev, eventId: eid, draftId: did, kind: ev.kind, eventDateISO: vr.iso, mmdd: `${ev.m}-${ev.d}`, category: ev.tag || '', players, textX: textXFor(ev), fingerprint: contentFingerprint(ev), sourceSnapshot: snapshotOf(ev, vr.iso, players) });
  }

  const existingByDraft = new Map((existing || []).map(r => [r.draftId, r]));
  const byDraft = new Map();
  for (const c of candidates) (byDraft.get(c.draftId) || byDraft.set(c.draftId, []).get(c.draftId)).push(c);
  const review = [];
  const uniq = [];
  const colisionEventIds = new Set();
  const colisionDraftIds = new Set();
  for (const [did, group] of byDraft) {
    if (group.length === 1) { uniq.push(group[0]); continue; }
    colisionEventIds.add(group[0].eventId);
    colisionDraftIds.add(did);
    const ex = existingByDraft.get(did);
    review.push({ tipo: 'colision_id', draftId: did, eventId: group[0].eventId,
      eventos: group.map(g => ({ eventId: g.eventId, kind: g.kind, eventDateISO: g.eventDateISO, categoria: g.category, texto: stripText(g.ev.html).slice(0, 140) })),
      borradoresAfectados: ex ? [{ draftId: ex.draftId, status: ex.status, editedText: editFlags(ex).editedText, editedTime: editFlags(ex).editedTime, textXPreview: String(ex.textX || '').slice(0, 80) }] : [],
      nota: 'Dos o más eventos de origen comparten identidad. No se crea ni modifica ningún borrador y NINGUNO se marca como desaparecido: el/los borradores existentes quedan intactos. Requiere resolución humana (p. ej. id de origen para hitos).' });
  }

  const porDia = new Map();
  for (const c of uniq) (porDia.get(c.mmdd) || porDia.set(c.mmdd, []).get(c.mmdd)).push(c);
  const suggestedById = new Map();
  for (const [mmdd, group] of porDia) {
    group.sort((a, b) => cmp(a.draftId, b.draftId));
    const fecha = winDate.get(mmdd);
    group.forEach((c, i) => {
      const slot = slots[Math.min(i, slots.length - 1)];
      const s = sugerenciaHoraria(fecha, slot);
      if (i >= slots.length) s.overflow = true;
      if (s.error) errors.push({ tipo: 'hora_invalida', fuente: 'slot', ref: c.draftId, slot, fecha, code: s.error });
      suggestedById.set(c.draftId, s);
    });
  }

  const seenEventIds = new Set(uniq.map(c => c.eventId));
  for (const id of colisionEventIds) seenEventIds.add(id);
  const ops = [];
  for (const c of uniq) {
    const ex = existingByDraft.get(c.draftId);
    const suggestedAt = suggestedById.get(c.draftId) || null;
    if (!ex) {
      ops.push({ op: 'nuevo', draftId: c.draftId, eventId: c.eventId, kind: c.kind, campaignYear, eventDateISO: c.eventDateISO, category: c.category, players: c.players, textX: c.textX, status: 'pendiente', sourceFingerprint: c.fingerprint, sourceSnapshot: c.sourceSnapshot, suggestedAt, editedText: false, editedTime: false, createdAt: now, updatedAt: now, flags: {} });
      continue;
    }
    const { editedText, editedTime } = editFlags(ex);
    const changed = ex.sourceFingerprint !== c.fingerprint;
    const acknowledged = ex.reviewedFingerprint != null && ex.reviewedFingerprint === c.fingerprint;
    const textLocked = editedText || ESTADOS_TERMINALES.has(ex.status);
    const suggKeep = ex.suggestedAt ?? suggestedAt;
    if (!changed || acknowledged) {
      ops.push({ op: 'sin_cambios', draftId: c.draftId, eventId: c.eventId, kind: c.kind, campaignYear, status: ex.status, textX: ex.textX, textXCanonico: c.textX, suggestedAt: suggKeep, flags: { editedText, editedTime, acknowledged: acknowledged && changed } });
    } else if (textLocked) {
      ops.push({ op: 'edicion_preservada', draftId: c.draftId, eventId: c.eventId, kind: c.kind, campaignYear, status: ex.status, textX: ex.textX, suggestedAt: suggKeep, sourceFingerprintObservado: c.fingerprint, sourceSnapshotObservado: c.sourceSnapshot, flags: { sourceChanged: true, editedText, editedTime, statusBloqueado: ESTADOS_TERMINALES.has(ex.status) }, nota: 'El contenido del origen cambió, pero hay edición manual de texto o estado terminal: se conserva. Marcado para revisión. El fingerprint NO se actualiza hasta que un humano lo resuelva (resolverRevision).' });
    } else {
      ops.push({ op: 'cambio_contenido', draftId: c.draftId, eventId: c.eventId, kind: c.kind, campaignYear, eventDateISO: c.eventDateISO, category: c.category, players: c.players, textX: c.textX, status: ex.status, sourceFingerprint: c.fingerprint, sourceSnapshot: c.sourceSnapshot, suggestedAt: suggKeep, updatedAt: now, flags: { sourceChanged: true, editedTime } });
    }
  }

  const orphans = [];
  for (const r of (existing || [])) {
    if (r.campaignYear !== campaignYear) continue;
    if (colisionDraftIds.has(r.draftId)) continue;
    const mmdd = isoToMMDD(r.eventDateISO);
    if (!mmdd || !winSet.has(mmdd)) continue;
    if (seenEventIds.has(r.eventId)) continue;
    if (ESTADOS_RESUELTOS.has(r.status)) continue;
    const o = { op: 'desaparecido', draftId: r.draftId, eventId: r.eventId, kind: r.kind, campaignYear, eventDateISO: r.eventDateISO, status: r.status, players: r.players || [], flags: { orphan: true }, nota: 'Este borrador ya no corresponde a ningún evento del origen esta semana. No se elimina automáticamente; requiere revisión.' };
    ops.push(o); orphans.push(o);
  }

  const nuevos = ops.filter(o => o.op === 'nuevo');
  for (const o of orphans) {
    for (const n of nuevos) {
      if (n.kind !== o.kind) continue;
      const share = sharePlayer(n.players, o) || n.eventDateISO === o.eventDateISO;
      const dd = dayDiff(n.eventDateISO, o.eventDateISO);
      if (share && dd != null && dd <= 7) {
        review.push({ tipo: 'posible_correccion_identidad', desaparecido: { draftId: o.draftId, eventId: o.eventId, eventDateISO: o.eventDateISO }, nuevo: { draftId: n.draftId, eventId: n.eventId, eventDateISO: n.eventDateISO }, nota: 'Posible corrección en origen (fecha/equipo/jugador). No se fusiona automáticamente; el humano decide heredar estado/edición.' });
      }
    }
  }

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

function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function isoToMMDD(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[2]}-${+m[3]}` : null; }
function sharePlayer(players, orphan) {
  if (!Array.isArray(players) || !orphan.players) return false;
  const ids = new Set(players.map(p => p.id).filter(Boolean));
  return (orphan.players || []).some(p => p.id && ids.has(p.id));
}
function dayDiff(isoA, isoB) { const a = Date.parse(isoA + 'T00:00:00Z'), b = Date.parse(isoB + 'T00:00:00Z'); if (Number.isNaN(a) || Number.isNaN(b)) return null; return Math.abs(Math.round((a - b) / 86400000)); }

const _tz = { sugerenciaHoraria, resolveWall };

// ════════ contrato de aplicación (efemerides-apply.mjs) ════════
const TERMINALES = new Set(['aprobado', 'descartado', 'publicado']);
const clone = r => ({ ...r });

function createStore(records = []) {
  const s = {};
  for (const r of records) if (r && r.draftId) s[r.draftId] = clone(r);
  return s;
}
function applyPlan(store, plan, opts = {}) {
  const now = opts.now ?? null;
  const out = {};
  for (const k of Object.keys(store)) out[k] = clone(store[k]);
  const log = [];
  for (const op of (plan.ops || [])) {
    const prev = out[op.draftId];
    switch (op.op) {
      case 'nuevo': {
        if (prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'ya existe; nuevo no sobrescribe' }); break; }
        out[op.draftId] = { draftId: op.draftId, eventId: op.eventId, campaignYear: op.campaignYear, kind: op.kind, eventDateISO: op.eventDateISO, category: op.category, players: op.players, textX: op.textX, suggestedAt: op.suggestedAt, status: op.status ?? 'pendiente', editedText: false, editedTime: false, sourceFingerprint: op.sourceFingerprint, sourceSnapshot: op.sourceSnapshot, reviewedFingerprint: null, observedFingerprint: null, observedSnapshot: null, pendingSourceChange: false, orphan: false, createdAt: op.createdAt ?? now, updatedAt: now, sourceSeenAt: now };
        log.push({ draftId: op.draftId, resultado: 'creado' });
        break;
      }
      case 'sin_cambios': {
        if (!prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'sin_cambios sobre inexistente' }); break; }
        if (op.textXCanonico != null && !prev.editedText && !TERMINALES.has(prev.status) && op.textXCanonico !== prev.textX) { prev.textX = op.textXCanonico; prev.updatedAt = now; }
        prev.sourceSeenAt = now; prev.orphan = false; prev.pendingSourceChange = false; prev.observedFingerprint = null; prev.observedSnapshot = null;
        log.push({ draftId: op.draftId, resultado: 'sin_cambios' });
        break;
      }
      case 'cambio_contenido': {
        if (!prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'cambio sobre inexistente' }); break; }
        if (TERMINALES.has(prev.status)) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'estado terminal: no se regenera' }); prev.sourceSeenAt = now; break; }
        if (!prev.editedText) prev.textX = op.textX;
        if (!prev.editedTime && op.suggestedAt) prev.suggestedAt = op.suggestedAt;
        prev.category = op.category; prev.eventDateISO = op.eventDateISO; prev.players = op.players;
        prev.sourceFingerprint = op.sourceFingerprint; prev.sourceSnapshot = op.sourceSnapshot;
        prev.reviewedFingerprint = null; prev.observedFingerprint = null; prev.observedSnapshot = null; prev.pendingSourceChange = false;
        prev.orphan = false; prev.updatedAt = now; prev.sourceSeenAt = now;
        log.push({ draftId: op.draftId, resultado: 'actualizado' });
        break;
      }
      case 'edicion_preservada': {
        if (!prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'preservada sobre inexistente' }); break; }
        prev.observedFingerprint = op.sourceFingerprintObservado ?? null; prev.observedSnapshot = op.sourceSnapshotObservado ?? null;
        prev.pendingSourceChange = true; prev.orphan = false; prev.sourceSeenAt = now;
        log.push({ draftId: op.draftId, resultado: 'preservado_pendiente_revision' });
        break;
      }
      case 'desaparecido': {
        if (!prev) { log.push({ draftId: op.draftId, resultado: 'omitido', motivo: 'desaparecido sobre inexistente' }); break; }
        prev.orphan = true; prev.lastMissingAt = now;
        log.push({ draftId: op.draftId, resultado: 'marcado_huerfano' });
        break;
      }
      default: log.push({ draftId: op.draftId, resultado: 'ignorado', motivo: `op desconocida: ${op.op}` });
    }
  }
  for (const r of (plan.review || [])) log.push({ tipo: r.tipo, draftId: r.draftId || null, resultado: 'revision_humana' });
  return { store: out, log };
}
function resolverRevision(store, draftId, opts = {}) {
  const out = {};
  for (const k of Object.keys(store)) out[k] = clone(store[k]);
  const r = out[draftId];
  if (!r) return { store: out, resultado: 'omitido', motivo: 'no existe' };
  const modo = opts.modo ?? 'mantener';
  if (modo === 'mantener') { r.reviewedFingerprint = r.observedFingerprint ?? r.reviewedFingerprint ?? null; r.pendingSourceChange = false; r.updatedAt = opts.now ?? r.updatedAt; return { store: out, resultado: 'reconocido_mantener' }; }
  if (modo === 'aceptar_origen') { r.editedText = false; r.reviewedFingerprint = null; r.pendingSourceChange = false; r.updatedAt = opts.now ?? r.updatedAt; return { store: out, resultado: 'aceptar_origen' }; }
  return { store: out, resultado: 'omitido', motivo: `modo desconocido: ${modo}` };
}
