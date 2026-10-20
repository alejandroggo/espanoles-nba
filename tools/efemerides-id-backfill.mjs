// Lógica PURA (Node, testable) para asignar y validar el campo `id` de la hoja
// EFEMERIDES. Espeja las decisiones del Apps Script (tools/apps-script/efemerides-ids.gs)
// SIN tocar Google Sheets, ni app.js, ni data.json, ni la web pública.
//
// Reglas (Fase 3A):
//   · `id` opaco (UUID) por fila VÁLIDA que lo tenga vacío.
//   · NUNCA se regenera ni modifica un `id` existente.
//   · Antes de exportar: todas las filas válidas deben tener `id` y no haber
//     duplicados; si hay duplicados/faltantes, se DETIENE (no se autocorrige).
//   · No depende del número de fila ni del orden: el UUID viaja en la celda.
//
// Una fila es VÁLIDA si tiene contenido en los campos requeridos. El criterio
// DEBE coincidir con el de getEfemerides() del exportador real, que incluye una
// fila si tiene `fecha` y `hito` (no exige `jugador`). Así, toda fila que llega a
// data.json recibe id y pasa la validación. Las filas totalmente vacías se
// ignoran; las que tienen algo pero les falta un requerido se marcan como
// "incompletas" (no se les asigna id).

export const CAMPOS_REQUERIDOS = ['fecha', 'hito'];

// Índice (0-based) de una cabecera por nombre, sin distinguir mayúsculas/espacios.
export function indiceCabecera(headers, nombre) {
  const n = String(nombre).trim().toLowerCase();
  for (let i = 0; i < (headers || []).length; i++) {
    if (String(headers[i] ?? '').trim().toLowerCase() === n) return i;
  }
  return -1;
}

function filaObjeto(headers, row) {
  const o = {};
  headers.forEach((h, i) => { o[String(h ?? '').trim().toLowerCase()] = row[i]; });
  return o;
}

const noVacio = v => String(v ?? '').trim() !== '';

export function filaValida(obj, required = CAMPOS_REQUERIDOS) {
  return required.every(k => noVacio(obj[k]));
}

function defaultNewId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Respaldo RFC4122 v4 (solo si no hay crypto; en Apps Script se usa Utilities.getUuid()).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16), v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Construye los objetos a partir de las cabeceras (espejo de cómo describe el
// usuario que getEfemerides() arma los objetos). Sirve para comprobar que `id`
// llega a la salida cuando existe la columna.
export function construirObjetos(values, { soloValidas = true } = {}) {
  const headers = (values[0] || []);
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const obj = filaObjeto(headers, values[r]);
    if (soloValidas && !filaValida(obj)) continue;
    out.push(obj);
  }
  return out;
}

// PLAN de asignación (no escribe nada). `values` = [cabeceras, ...filas].
export function planAsignacion(values, opts = {}) {
  const required = opts.required || CAMPOS_REQUERIDOS;
  const newId = opts.newId || defaultNewId;
  const headers = values[0] || [];
  const idCol = indiceCabecera(headers, 'id');
  const necesitaColumna = idCol === -1;

  const asignaciones = [];   // {fila (1-based), col (1-based o null si falta columna), uuid}
  const incompletas = [];    // filas con algo de contenido pero sin requeridos
  const idMap = new Map();   // id existente -> [filas 1-based]
  const pendientes = [];     // filas válidas con id vacío

  for (let r = 1; r < values.length; r++) {
    const obj = filaObjeto(headers, values[r]);
    if (!filaValida(obj, required)) {
      if (Object.values(obj).some(noVacio)) incompletas.push({ fila: r + 1 });
      continue;
    }
    const idVal = necesitaColumna ? '' : String(values[r][idCol] ?? '').trim();
    if (idVal === '') pendientes.push(r);
    else { if (!idMap.has(idVal)) idMap.set(idVal, []); idMap.get(idVal).push(r + 1); }
  }

  for (const r of pendientes) {
    asignaciones.push({ fila: r + 1, col: necesitaColumna ? null : idCol + 1, uuid: newId() });
  }
  const duplicados = [...idMap.entries()]
    .filter(([, filas]) => filas.length > 1)
    .map(([id, filas]) => ({ id, filas }));

  const conId = [...idMap.values()].reduce((a, v) => a + v.length, 0);
  return {
    necesitaColumna,
    idCol: idCol === -1 ? null : idCol,
    asignaciones,
    incompletas,
    duplicados,
    totalValidas: pendientes.length + conId,
    yaConId: conId,
    porAsignar: asignaciones.length,
  };
}

// VALIDACIÓN previa a exportar. ok=false detiene la exportación.
export function validarParaExportar(values, opts = {}) {
  const required = opts.required || CAMPOS_REQUERIDOS;
  const headers = values[0] || [];
  const idCol = indiceCabecera(headers, 'id');
  if (idCol === -1) return { ok: false, motivo: 'falta_columna_id', faltanId: [], duplicados: [] };

  const faltanId = [];
  const idMap = new Map();
  for (let r = 1; r < values.length; r++) {
    const obj = filaObjeto(headers, values[r]);
    if (!filaValida(obj, required)) continue;
    const idVal = String(values[r][idCol] ?? '').trim();
    if (idVal === '') { faltanId.push(r + 1); continue; }
    if (!idMap.has(idVal)) idMap.set(idVal, []);
    idMap.get(idVal).push(r + 1);
  }
  const duplicados = [...idMap.entries()]
    .filter(([, filas]) => filas.length > 1)
    .map(([id, filas]) => ({ id, filas }));
  const ok = faltanId.length === 0 && duplicados.length === 0;
  return { ok, motivo: ok ? null : (faltanId.length ? 'faltan_ids' : 'ids_duplicados'), faltanId, duplicados };
}

// Aplica un plan sobre una copia de `values` (solo para pruebas/simulación en
// memoria: NUNCA toca una hoja real). Rellena solo celdas id vacías; añade la
// columna `id` al final si faltaba. Devuelve la nueva matriz.
export function aplicarPlanEnMemoria(values, plan) {
  const copia = values.map(row => row.slice());
  let idCol = plan.idCol;
  if (plan.necesitaColumna) {
    idCol = (copia[0] || []).length;
    copia[0] = [...(copia[0] || []), 'id'];
    for (let r = 1; r < copia.length; r++) { while (copia[r].length < idCol) copia[r].push(''); copia[r][idCol] = ''; }
  }
  for (const a of plan.asignaciones) {
    const r = a.fila - 1;
    while (copia[r].length <= idCol) copia[r].push('');
    copia[r][idCol] = a.uuid;
  }
  return copia;
}
