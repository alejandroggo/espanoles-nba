/**
 * efemerides-webapp.gs — Web App privada + operaciones de servidor + trigger
 * (Fase 4, Bloques C y D).
 *
 * Sirve la página privada (Index.html) solo a la cuenta autorizada y expone las
 * operaciones que la UI llama con google.script.run. La lógica de cada acción es
 * PURA y testeable en Node (efwAccion / efwProcesar* / efwAgruparSemana); los
 * envoltorios reales (doGet, getSemana*, acciones, triggers) usan Apps Script y
 * NO se ejecutan en Node. Convive con core/sheet/generador en el mismo proyecto.
 */

var EFW_ALLOWLIST = ['a.gaitanojeda@gmail.com']; // defensa en profundidad además de "solo yo"

// ── lógica PURA (testeable) ──────────────────────────────────────────────────
// Aplica una acción de edición/estado a un record, preservando el resto (respeta
// el contrato: no pierde createdAt, no toca lo que no corresponde).
function efwAccion(rec, accion, payload, now) {
  payload = payload || {};
  var o = {}; for (var k in rec) o[k] = rec[k];
  o.updatedAt = now;
  switch (accion) {
    case 'editarTexto': o.textX = String(payload.texto == null ? '' : payload.texto); o.editedText = true; return o;
    case 'editarHora': o.suggestedAt = payload.suggestedAt; o.editedTime = true; return o;
    case 'aprobar': o.status = 'aprobado'; return o;
    case 'descartar': o.status = 'descartado'; return o;
    case 'publicar': o.status = 'publicado'; return o;
    default: throw new Error('acción desconocida: ' + accion);
  }
}
// Resuelve una acción sobre las filas crudas (values) → {record, upsert} o {error}.
function efwProcesarAccion(values, draftId, accion, payload, now) {
  var parsed = efsRowsToStore(values);
  var rec = parsed.store[draftId];
  if (!rec) return { error: 'no_existe', draftId: draftId };
  var nuevo = efwAccion(rec, accion, payload, now);
  return { record: nuevo, upsert: { tipo: 'update', draftId: draftId, rowIndex: parsed.rowByDraft[draftId], row: efsRecordToRow(nuevo) } };
}
// Resuelve una alerta de revisión (reusa resolverRevision del núcleo).
function efwProcesarResolver(values, draftId, modo, now) {
  var parsed = efsRowsToStore(values);
  var rec = parsed.store[draftId];
  if (!rec) return { error: 'no_existe', draftId: draftId };
  var st = {}; st[draftId] = rec;
  var res = resolverRevision(st, draftId, { modo: modo, now: now });
  var nuevo = res.store[draftId];
  return { record: nuevo, upsert: { tipo: 'update', draftId: draftId, rowIndex: parsed.rowByDraft[draftId], row: efsRecordToRow(nuevo) } };
}
// Agrupa los borradores de una campaña por día de la semana, con contadores.
function efwAgruparSemana(store, weekStart, weekEnd, campaignYear) {
  var win = windowDays(weekStart, weekEnd);
  var winDate = {}; win.forEach(function (x) { winDate[x.m + '-' + x.d] = x.date; });
  var dias = {}; win.forEach(function (x) { dias[x.date] = { fecha: x.date, items: [] }; });
  var contadores = { pendiente: 0, aprobado: 0, descartado: 0, publicado: 0, total: 0, incidencias: 0 };
  Object.keys(store).forEach(function (did) {
    var r = store[did];
    if (String(r.campaignYear) !== String(campaignYear)) return;
    var m = String(r.eventDateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return;
    var fecha = winDate[(+m[2]) + '-' + (+m[3])];
    if (!fecha) return;
    var inc = !!r.orphan || !!r.pendingSourceChange;
    dias[fecha].items.push({ draftId: did, kind: r.kind, category: r.category, textX: r.textX, status: r.status, suggestedAt: r.suggestedAt, url: efsUrl(r), editedText: !!r.editedText, editedTime: !!r.editedTime, orphan: !!r.orphan, pendingSourceChange: !!r.pendingSourceChange, players: r.players });
    if (contadores[r.status] != null) contadores[r.status]++;
    contadores.total++;
    if (inc) contadores.incidencias++;
  });
  Object.keys(dias).forEach(function (f) { dias[f].items.sort(function (a, b) { return a.draftId < b.draftId ? -1 : a.draftId > b.draftId ? 1 : 0; }); });
  return { weekStart: weekStart, weekEnd: weekEnd, campaignYear: campaignYear, dias: win.map(function (x) { return dias[x.date]; }), contadores: contadores };
}

// ── envoltorios reales de Apps Script (NO se ejecutan en Node) ───────────────
function doGet(e) {
  var email = (Session.getActiveUser() && Session.getActiveUser().getEmail()) || '';
  if (EFW_ALLOWLIST.length && EFW_ALLOWLIST.indexOf(email) === -1) {
    return HtmlService.createHtmlOutput('<p style="font-family:system-ui;padding:2rem">Acceso restringido.</p>');
  }
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Borradores · Efemérides NBA')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function getSemanaActual() {
  var wk = efsProximaSemanaLunDom(new Date(), EFS_TZ);
  return getSemana(wk.weekStart, wk.weekEnd);
}
function getSemana(weekStart, weekEnd) {
  var cy = +String(weekEnd).slice(0, 4);
  var parsed = efsRowsToStore(efsLeerBorradoresReal_());
  return efwAgruparSemana(parsed.store, weekStart, weekEnd, cy);
}
function accionBorrador(draftId, accion, payload) {
  var r = efwProcesarAccion(efsLeerBorradoresReal_(), draftId, accion, payload, new Date().toISOString());
  if (r.error) throw new Error(r.error);
  efsEscribirReal_([r.upsert]);
  return r.record;
}
function resolverRevisionBorrador(draftId, modo) {
  var r = efwProcesarResolver(efsLeerBorradoresReal_(), draftId, modo, new Date().toISOString());
  if (r.error) throw new Error(r.error);
  efsEscribirReal_([r.upsert]);
  return r.record;
}
function regenerarSemanaManual() { generarSemana(); return getSemanaActual(); }

// ── trigger del sábado (Bloque D) ────────────────────────────────────────────
function crearTriggerSabado() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'generarSemana') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('generarSemana').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(8).create();
}
function borrarTriggerSabado() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'generarSemana') ScriptApp.deleteTrigger(t); });
}
