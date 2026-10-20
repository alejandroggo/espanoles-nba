/**
 * efemerides-sheet.gs — Capa de datos + orquestación `generarSemana` (Fase 4, Bloque B).
 *
 * Une el núcleo (efemerides-core.gs: planGeneration/applyPlan) y el constructor
 * (efemerides-generador.gs: efgBuild/efgTweet) con la hoja privada de borradores.
 * La lógica está en `efsGenerarSemana(deps)`, con dependencias INYECTABLES
 * (fetchData / leerBorradores / escribir / log), para poder probarla en Node sobre
 * un almacén en memoria. Los envoltorios reales de Apps Script (UrlFetch, Sheets,
 * LockService, MailApp, trigger) están al final y NO se ejecutan en Node.
 *
 * No toca app.js/data.json ni la web. Todo convive en el mismo proyecto de Apps
 * Script (funciones efg…, del núcleo y efs… en el mismo ámbito).
 */

var EFS_TAB_BORRADORES = 'BORRADORES', EFS_TAB_LOG = 'LOG', EFS_TAB_CONFIG = 'CONFIG';
var EFS_DATA_URL = 'https://raw.githubusercontent.com/alejandroggo/espanoles-nba/main/data.json';
var EFS_TZ = 'America/Toronto';
var EFS_SLOTS_DEFAULT = ['10:00', '14:00', '19:00'];

// Esquema de la pestaña BORRADORES: columna -> campo del record + tipo de celda.
// t: 's' texto · 'n' número · 'b' booleano · 'j' JSON (array/objeto).
var EFS_CAMPOS = [
  { k: 'draftId', t: 's' }, { k: 'eventId', t: 's' }, { k: 'campaignYear', t: 'n' }, { k: 'kind', t: 's' },
  { k: 'eventDateISO', t: 's' }, { k: 'category', t: 's' }, { k: 'players', t: 'j' }, { k: 'textX', t: 's' },
  { k: 'suggestedAt', t: 'j' }, { k: 'status', t: 's' }, { k: 'editedText', t: 'b' }, { k: 'editedTime', t: 'b' },
  { k: 'sourceFingerprint', t: 's' }, { k: 'sourceSnapshot', t: 'j' }, { k: 'reviewedFingerprint', t: 's' },
  { k: 'observedFingerprint', t: 's' }, { k: 'observedSnapshot', t: 'j' }, { k: 'pendingSourceChange', t: 'b' },
  { k: 'orphan', t: 'b' }, { k: 'createdAt', t: 's' }, { k: 'updatedAt', t: 's' }, { k: 'sourceSeenAt', t: 's' },
  { k: 'lastMissingAt', t: 's' }
];
// Cabeceras de la hoja: los campos + dos columnas derivadas legibles (solo lectura).
var EFS_HEADERS = EFS_CAMPOS.map(function (c) { return c.k; }).concat(['url', 'player_ids']);

function efsNormalizarRecord(rec) {
  var o = {};
  EFS_CAMPOS.forEach(function (c) { var v = rec[c.k]; o[c.k] = (c.t === 'b') ? !!v : (v === undefined ? null : v); });
  return o;
}
function efsUrl(rec) {
  var m = String(rec.eventDateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return 'https://espanoles-nba.alejandroggo.com/efemerides.html?m=' + (+m[2]) + '&d=' + (+m[3]);
}
function efsRecordToRow(rec) {
  var n = efsNormalizarRecord(rec);
  var row = EFS_CAMPOS.map(function (c) {
    var v = n[c.k];
    if (c.t === 'j') return v == null ? '' : JSON.stringify(v);
    if (c.t === 'b') return !!v;
    if (c.t === 'n') return v == null ? '' : v;
    return v == null ? '' : String(v);
  });
  row.push(efsUrl(n));
  row.push((n.players || []).map(function (p) { return p && p.id; }).filter(Boolean).join(','));
  return row;
}
function efsHeaderIdx(headers) { var m = {}; headers.forEach(function (h, i) { m[String(h).trim()] = i; }); return m; }
function efsRowToRecord(idx, row) {
  var rec = {};
  EFS_CAMPOS.forEach(function (c) {
    var i = idx[c.k];
    var v = (i == null ? '' : row[i]);
    if (c.t === 'j') rec[c.k] = (v === '' || v == null) ? null : JSON.parse(v);
    else if (c.t === 'b') rec[c.k] = (v === true || String(v).toUpperCase() === 'TRUE');
    else if (c.t === 'n') rec[c.k] = (v === '' || v == null) ? null : Number(v);
    else rec[c.k] = (v === '' || v == null) ? null : String(v);
  });
  return rec;
}
function efsRowsToStore(values) {
  if (!values || !values.length) return { store: {}, idx: {}, rowByDraft: {} };
  var idx = efsHeaderIdx(values[0]);
  var store = {}, rowByDraft = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var did = (idx['draftId'] == null) ? '' : row[idx['draftId']];
    if (did === '' || did == null) continue;
    var rec = efsRowToRecord(idx, row);
    store[rec.draftId] = rec;
    rowByDraft[rec.draftId] = r;
  }
  return { store: store, idx: idx, rowByDraft: rowByDraft };
}

// Eventos de la semana a partir de data.json, con su tuit (reutiliza el generador).
function efsBuildEventos(data) {
  return efgBuild(data).map(function (e) {
    var o = {}; for (var k in e) o[k] = e[k];
    o.tweetText = efgTweet(e);
    return o;
  });
}

// Orquestación PURA (deps inyectables). No escribe en ningún servicio por sí misma.
function efsGenerarSemana(deps) {
  var data = deps.fetchData();
  var events = efsBuildEventos(data);
  var values = deps.leerBorradores() || [EFS_HEADERS];
  var parsed = efsRowsToStore(values);
  var existing = Object.keys(parsed.store).map(function (k) { return parsed.store[k]; });

  var plan = planGeneration({
    data: data, events: events, existing: existing,
    weekStart: deps.weekStart, weekEnd: deps.weekEnd, campaignYear: deps.campaignYear,
    now: deps.now, slots: deps.slots || EFS_SLOTS_DEFAULT
  });
  var applied = applyPlan(parsed.store, plan, { now: deps.now });

  // Upserts: solo las filas cuyo contenido canónico cambia o que son nuevas.
  var upserts = [];
  Object.keys(applied.store).forEach(function (did) {
    var rowNueva = efsRecordToRow(applied.store[did]);
    var prevIdx = parsed.rowByDraft[did];
    if (prevIdx == null) { upserts.push({ tipo: 'append', draftId: did, row: rowNueva }); return; }
    var rowActual = efsRecordToRow(efsRowToRecord(parsed.idx, values[prevIdx])); // re-canoniza para comparar
    if (JSON.stringify(rowActual) !== JSON.stringify(rowNueva)) upserts.push({ tipo: 'update', draftId: did, rowIndex: prevIdx, row: rowNueva });
  });

  if (deps.escribir) deps.escribir(upserts);
  var entries = plan.errors.map(function (e) { return { tipo: e.tipo, ref: e.ref, detalle: e.motivo || e.code }; });
  plan.review.forEach(function (rv) { entries.push({ tipo: rv.tipo, ref: rv.draftId || '', detalle: rv.nota || '' }); });
  entries.push({ tipo: 'run_ok', ref: deps.weekStart + '..' + deps.weekEnd, detalle: JSON.stringify(plan.stats) });
  if (deps.log) deps.log(entries);

  return { plan: plan, upserts: upserts, resumen: plan.stats };
}

// Lunes–domingo de la PRÓXIMA semana respecto a `base` (Date), en zona `tz`.
// Puro y testeable: usa Intl para la fecha local y Date.UTC para avanzar días.
function efsProximaSemanaLunDom(base, tz) {
  var dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  var p = {}; dtf.formatToParts(base).forEach(function (x) { p[x.type] = x.value; });
  var hoy = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, 12, 0, 0)); // mediodía: evita bordes DST
  var dow = hoy.getUTCDay(); // 0=domingo..6=sábado
  var aLunes = ((8 - dow) % 7) || 7; // próximo lunes (si hoy es lunes, el de la semana siguiente)
  var lun = new Date(hoy.getTime() + aLunes * 86400000);
  var dom = new Date(lun.getTime() + 6 * 86400000);
  var fmt = function (d) { return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); };
  return { weekStart: fmt(lun), weekEnd: fmt(dom), campaignYear: dom.getUTCFullYear() };
}

// ════════════════════════════════════════════════════════════════════════════
// ENVOLTORIOS REALES DE APPS SCRIPT — NO se ejecutan en Node (solo referencia
// para el despliegue, Bloque E). Requieren configurar EFS_SHEET_ID.
// ════════════════════════════════════════════════════════════════════════════
var EFS_SHEET_ID = ''; // <-- rellenar con el id del spreadsheet privado al desplegar

function efsFetchDataReal_() {
  var res = UrlFetchApp.fetch(EFS_DATA_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('No se pudo leer data.json (' + res.getResponseCode() + ')');
  return JSON.parse(res.getContentText());
}
function efsHoja_(nombre) {
  var ss = SpreadsheetApp.openById(EFS_SHEET_ID);
  var sh = ss.getSheetByName(nombre);
  if (!sh) { sh = ss.insertSheet(nombre); if (nombre === EFS_TAB_BORRADORES) sh.getRange(1, 1, 1, EFS_HEADERS.length).setValues([EFS_HEADERS]); }
  return sh;
}
function efsLeerBorradoresReal_() {
  var sh = efsHoja_(EFS_TAB_BORRADORES);
  if (sh.getLastRow() < 1) { sh.getRange(1, 1, 1, EFS_HEADERS.length).setValues([EFS_HEADERS]); return [EFS_HEADERS]; }
  return sh.getDataRange().getValues();
}
function efsEscribirReal_(upserts) {
  if (!upserts.length) return;
  var sh = efsHoja_(EFS_TAB_BORRADORES);
  upserts.forEach(function (u) {
    if (u.tipo === 'append') sh.appendRow(u.row);
    else sh.getRange(u.rowIndex + 1, 1, 1, u.row.length).setValues([u.row]); // rowIndex 0-based incl. cabecera
  });
  SpreadsheetApp.flush();
}
function efsLogReal_(entries) {
  if (!entries || !entries.length) return;
  var sh = efsHoja_(EFS_TAB_LOG);
  var ts = new Date().toISOString();
  entries.forEach(function (e) { sh.appendRow([ts, e.tipo, e.ref || '', e.detalle || '']); });
}

// Entrada del trigger del sábado / menú. Protegida contra ejecuciones solapadas.
function generarSemana() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { throw new Error('Otra generación está en curso.'); }
  try {
    var wk = efsProximaSemanaLunDom(new Date(), EFS_TZ);
    efsGenerarSemana({
      fetchData: efsFetchDataReal_, leerBorradores: efsLeerBorradoresReal_,
      escribir: efsEscribirReal_, log: efsLogReal_,
      weekStart: wk.weekStart, weekEnd: wk.weekEnd, campaignYear: wk.campaignYear,
      now: new Date().toISOString(), slots: EFS_SLOTS_DEFAULT
    });
  } catch (e) {
    try { efsLogReal_([{ tipo: 'error', ref: 'generarSemana', detalle: String(e && e.message || e) }]); } catch (_) {}
    try { MailApp.sendEmail(Session.getActiveUser().getEmail(), 'Efemérides: fallo al generar la semana', String(e && e.stack || e)); } catch (_) {}
    throw e;
  } finally {
    lock.releaseLock();
  }
}
