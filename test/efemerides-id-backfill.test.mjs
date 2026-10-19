// Pruebas de la lógica de asignación/validación de `id` en EFEMERIDES (Fase 3A).
// Lógica pura, sin Google Sheets. Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planAsignacion, validarParaExportar, construirObjetos, aplicarPlanEnMemoria,
  indiceCabecera, filaValida, CAMPOS_REQUERIDOS,
} from '../tools/efemerides-id-backfill.mjs';

// Generador de ids determinista para las pruebas.
function contador() { let n = 0; return () => `uuid-${++n}`; }

// Cabeceras como en data.json real + id al final.
const H = ['fecha', 'jugador', 'hito', 'etiqueta', 'video', 'data', 'etiquetas', 'id'];
const fila = (fecha, jugador, hito, id = '') => [fecha, jugador, hito, 'CAREER-HIGH', '', '110', '', id];

test('cabeceras: detecta `id` sin distinguir mayúsculas; -1 si falta', () => {
  assert.equal(indiceCabecera(['fecha', 'ID'], 'id'), 1);
  assert.equal(indiceCabecera(['fecha', 'jugador'], 'id'), -1);
});

test('fila válida requiere fecha + jugador + hito', () => {
  assert.equal(filaValida({ fecha: '1 jan 2015', jugador: 'Pau Gasol', hito: 'x' }), true);
  assert.equal(filaValida({ fecha: '1 jan 2015', jugador: '', hito: 'x' }), false);
  assert.deepEqual(CAMPOS_REQUERIDOS, ['fecha', 'jugador', 'hito']);
});

test('IDs vacíos: asigna UUID a cada fila válida sin id; no toca nada más', () => {
  const values = [H, fila('1 jan 2015', 'Pau Gasol', 'A'), fila('4 jan 2013', 'Marc Gasol', 'B')];
  const plan = planAsignacion(values, { newId: contador() });
  assert.equal(plan.necesitaColumna, false);
  assert.equal(plan.porAsignar, 2);
  assert.deepEqual(plan.asignaciones.map(a => a.fila), [2, 3]);
  assert.deepEqual(plan.asignaciones.map(a => a.uuid), ['uuid-1', 'uuid-2']);
});

test('IDs existentes: NUNCA se regeneran ni modifican', () => {
  const values = [H, fila('1 jan 2015', 'Pau Gasol', 'A', 'YA-TENGO-ID'), fila('4 jan 2013', 'Marc Gasol', 'B')];
  const plan = planAsignacion(values, { newId: contador() });
  assert.equal(plan.porAsignar, 1, 'solo la fila 3 sin id');
  assert.deepEqual(plan.asignaciones.map(a => a.fila), [3]);
  assert.equal(plan.yaConId, 1);
});

test('duplicados: se detectan y se reportan; NO se corrigen', () => {
  const values = [H,
    fila('1 jan 2015', 'Pau Gasol', 'A', 'DUP'),
    fila('4 jan 2013', 'Marc Gasol', 'B', 'DUP'),   // fila copiada: mismo id
    fila('7 jan 2014', 'José M. Calderón', 'C', 'OK'),
  ];
  const plan = planAsignacion(values, { newId: contador() });
  assert.equal(plan.duplicados.length, 1);
  assert.deepEqual(plan.duplicados[0], { id: 'DUP', filas: [2, 3] });

  const val = validarParaExportar(values);
  assert.equal(val.ok, false);
  assert.equal(val.motivo, 'ids_duplicados');
  assert.deepEqual(val.duplicados[0].filas, [2, 3]);
});

test('filas inválidas: no reciben id; las incompletas se listan, las vacías se ignoran', () => {
  const values = [H,
    fila('1 jan 2015', 'Pau Gasol', 'A'),          // válida
    fila('', 'Alguien', 'Sin fecha'),              // incompleta (falta fecha)
    ['', '', '', '', '', '', '', ''],              // totalmente vacía -> se ignora
  ];
  const plan = planAsignacion(values, { newId: contador() });
  assert.equal(plan.porAsignar, 1, 'solo la válida');
  assert.deepEqual(plan.asignaciones.map(a => a.fila), [2]);
  assert.deepEqual(plan.incompletas.map(i => i.fila), [3], 'la incompleta se marca, la vacía no');
});

test('falta la columna id: el plan lo indica y la validación detiene la exportación', () => {
  const Hsin = ['fecha', 'jugador', 'hito', 'etiqueta'];
  const values = [Hsin, ['1 jan 2015', 'Pau Gasol', 'A', 'CAREER-HIGH']];
  const plan = planAsignacion(values, { newId: contador() });
  assert.equal(plan.necesitaColumna, true);
  assert.equal(plan.porAsignar, 1);
  assert.equal(plan.asignaciones[0].col, null, 'col nula: la columna id aún no existe');
  const val = validarParaExportar(values);
  assert.equal(val.ok, false);
  assert.equal(val.motivo, 'falta_columna_id');
});

test('item 6: construirObjetos (header-based) incluye `id` en la salida', () => {
  const values = [H, fila('1 jan 2015', 'Pau Gasol', 'A', 'ID-1')];
  const objs = construirObjetos(values);
  assert.equal(objs.length, 1);
  assert.equal(objs[0].id, 'ID-1');
  assert.equal(objs[0].jugador, 'Pau Gasol');
});

test('idempotencia: aplicar el plan y re-planificar no asigna nada nuevo ni cambia ids', () => {
  const values = [H, fila('1 jan 2015', 'Pau Gasol', 'A'), fila('4 jan 2013', 'Marc Gasol', 'B')];
  const plan1 = planAsignacion(values, { newId: contador() });
  const tras = aplicarPlanEnMemoria(values, plan1);
  const plan2 = planAsignacion(tras, { newId: contador() });
  assert.equal(plan2.porAsignar, 0, 'nada por asignar en la 2ª pasada');
  const val = validarParaExportar(tras);
  assert.equal(val.ok, true, 'tras el backfill, listo para exportar');
  // y los ids asignados sobreviven e identifican cada fila
  const objs = construirObjetos(tras);
  assert.equal(objs[0].id, 'uuid-1');
  assert.equal(objs[1].id, 'uuid-2');
});

test('añadir la columna id en memoria: no altera el resto de columnas', () => {
  const Hsin = ['fecha', 'jugador', 'hito'];
  const values = [Hsin, ['1 jan 2015', 'Pau Gasol', 'A']];
  const plan = planAsignacion(values, { newId: contador() });
  const tras = aplicarPlanEnMemoria(values, plan);
  assert.deepEqual(tras[0], ['fecha', 'jugador', 'hito', 'id']);
  assert.deepEqual(tras[1].slice(0, 3), ['1 jan 2015', 'Pau Gasol', 'A']);
  assert.equal(tras[1][3], 'uuid-1');
});
