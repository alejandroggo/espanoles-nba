/**
 * efemerides-ids.gs — Identificadores estables para la hoja EFEMERIDES (Fase 3A).
 *
 * Código PARA PEGAR en el proyecto de Apps Script existente (el que exporta
 * data.json). NO se ejecuta desde este repositorio. Es ADITIVO: no renombra ni
 * reordena columnas, no toca otras hojas, no modifica getEfemerides() ni el
 * resto de la exportación. Solo:
 *   1) garantiza una columna `id` (añadida AL FINAL si no existe),
 *   2) asigna un UUID a cada fila válida con `id` vacío (nunca toca ids existentes),
 *   3) valida que todas las válidas tengan id único y DETIENE la exportación si no.
 *
 * Integración: llama a prepararEfemeridesIds_() AL PRINCIPIO de tu función de
 * exportación, ANTES de getEfemerides()/de construir data.json. Ver README.
 *
 * Espejo verificable en Node: tools/efemerides-id-backfill.mjs (con pruebas).
 */

var EFEMERIDES_HOJA = 'EFEMERIDES';
var EFEMERIDES_REQUERIDOS = ['fecha', 'jugador', 'hito']; // una fila es válida si tiene estos 3

/** Punto de entrada único para el flujo de exportación. Lanza si hay que revisar. */
function prepararEfemeridesIds_() {
  var sh = _efemHoja_();
  _efemAsegurarColumnaId_(sh);     // 1) columna id
  var asignados = _efemAsignarIds_(sh); // 2) UUID a válidas sin id
  _efemValidarIds_(sh);            // 3) gate: detiene si faltan/duplican
  return asignados;
}

function _efemHoja_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(EFEMERIDES_HOJA);
  if (!sh) throw new Error('No existe la hoja "' + EFEMERIDES_HOJA + '".');
  return sh;
}

function _efemHeaders_(sh) {
  var ncol = sh.getLastColumn();
  return sh.getRange(1, 1, 1, ncol).getValues()[0].map(function (h) { return String(h).trim(); });
}

function _idxCabecera_(headers, nombre) {
  var n = String(nombre).trim().toLowerCase();
  for (var i = 0; i < headers.length; i++) if (String(headers[i]).trim().toLowerCase() === n) return i;
  return -1;
}

/** Añade la columna `id` AL FINAL si no existe. No reordena ni renombra nada. */
function _efemAsegurarColumnaId_(sh) {
  var headers = _efemHeaders_(sh);
  if (_idxCabecera_(headers, 'id') !== -1) return;
  var col = sh.getLastColumn() + 1;
  sh.getRange(1, col).setValue('id');
}

function _efemFilaValida_(obj) {
  for (var i = 0; i < EFEMERIDES_REQUERIDOS.length; i++) {
    if (String(obj[EFEMERIDES_REQUERIDOS[i]] || '').trim() === '') return false;
  }
  return true;
}

function _efemObjetos_(values, headers) {
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[String(headers[c]).trim().toLowerCase()] = values[r][c];
    out.push({ fila: r + 1, idx: r, obj: obj });
  }
  return out;
}

/** Asigna UUID a cada fila válida con id vacío. Devuelve cuántas asignó. Solo escribe celdas vacías. */
function _efemAsignarIds_(sh) {
  var rango = sh.getDataRange();
  var values = rango.getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var idCol = _idxCabecera_(headers, 'id');
  if (idCol === -1) throw new Error('Falta la columna id (ejecuta _efemAsegurarColumnaId_ primero).');

  var filas = _efemObjetos_(values, headers);
  var asignados = 0;
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (!_efemFilaValida_(f.obj)) continue;                 // incompleta: no se asigna
    var actual = String(values[f.idx][idCol] || '').trim();
    if (actual !== '') continue;                            // ya tiene id: NUNCA se toca
    var uuid = Utilities.getUuid();
    sh.getRange(f.fila, idCol + 1).setValue(uuid);          // escribe en la hoja (persiste)
    asignados++;
  }
  if (asignados > 0) SpreadsheetApp.flush();
  return asignados;
}

/** Valida que toda fila válida tenga id y que no haya ids duplicados. Lanza si no. */
function _efemValidarIds_(sh) {
  var values = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var idCol = _idxCabecera_(headers, 'id');
  if (idCol === -1) throw new Error('EFEMERIDES: falta la columna id.');

  var filas = _efemObjetos_(values, headers);
  var faltan = [];
  var vistos = {};      // id -> [filas]
  for (var i = 0; i < filas.length; i++) {
    var f = filas[i];
    if (!_efemFilaValida_(f.obj)) continue;
    var id = String(values[f.idx][idCol] || '').trim();
    if (id === '') { faltan.push(f.fila); continue; }
    (vistos[id] = vistos[id] || []).push(f.fila);
  }
  var dups = [];
  for (var k in vistos) if (vistos[k].length > 1) dups.push(k + ' -> filas ' + vistos[k].join(', '));

  if (faltan.length || dups.length) {
    var msg = 'EXPORTACIÓN DETENIDA — EFEMERIDES requiere revisión manual:';
    if (faltan.length) msg += '\n- Filas válidas SIN id: ' + faltan.join(', ');
    if (dups.length) msg += '\n- IDs DUPLICADOS (p. ej. filas copiadas):\n  ' + dups.join('\n  ');
    msg += '\nRevisa esas filas a mano. No se asignan ni corrigen ids automáticamente.';
    throw new Error(msg);
  }
}
