// Pruebas del validador estricto de fechas (FASE 2A).
// Ejecutar con:  node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsearFecha, validarYMD, diasDelMes } from '../tools/efemerides-fecha.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('acepta los 3 formatos reales de data.json', () => {
  assert.deepEqual(pick(parsearFecha('1 nov 2001')), { ok: true, iso: '2001-11-01', formato: 'texto' }); // es (jugador)
  assert.deepEqual(pick(parsearFecha('6 jul 1980')), { ok: true, iso: '1980-07-06', formato: 'texto' }); // es (nacimiento)
  assert.deepEqual(pick(parsearFecha('1 jan 2015')), { ok: true, iso: '2015-01-01', formato: 'texto' }); // en (efemerides)
  assert.deepEqual(pick(parsearFecha('1 may 2020')), { ok: true, iso: '2020-05-01', formato: 'texto' }); // "may" común
  assert.deepEqual(pick(parsearFecha('2015-02-08')), { ok: true, iso: '2015-02-08', formato: 'iso' });   // iso (transacciones)
  assert.deepEqual(pick(parsearFecha('2024-01-04T00:00:00Z')), { ok: true, iso: '2024-01-04', formato: 'iso' });
});

test('valida el calendario real, incluidos bisiestos', () => {
  assert.equal(parsearFecha('29 feb 2016').ok, true);         // 2016 bisiesto
  assert.equal(parsearFecha('29 feb 2015').code, 'dia_fuera_de_rango'); // 2015 no bisiesto
  assert.equal(parsearFecha('2000-02-29').ok, true);          // divisible por 400
  assert.equal(diasDelMes(2016, 2), 29);
  assert.equal(diasDelMes(2015, 2), 28);
  assert.equal(diasDelMes(2000, 2), 29); // 2000 bisiesto (400)
  assert.equal(diasDelMes(1900, 2), 28); // 1900 NO bisiesto (100 no 400)
  assert.equal(diasDelMes(2020, 4), 30);
});

test('rechaza fechas imposibles con código claro', () => {
  assert.equal(parsearFecha('31 nov 2020').code, 'dia_fuera_de_rango'); // nov tiene 30
  assert.equal(parsearFecha('30 feb 2020').code, 'dia_fuera_de_rango');
  assert.equal(parsearFecha('32 ene 2020').code, 'dia_fuera_de_rango'); // caso Fase 1.1
  assert.equal(parsearFecha('0 ene 2020').code, 'dia_fuera_de_rango');  // caso Fase 1.1
  assert.equal(parsearFecha('2015-13-01').code, 'mes_invalido');
  assert.equal(parsearFecha('2015-00-10').code, 'mes_invalido');
  assert.equal(parsearFecha('2015-02-30').code, 'dia_fuera_de_rango');
});

test('rechaza entradas vacías, ambiguas o no reconocidas', () => {
  assert.equal(parsearFecha('').code, 'vacia');
  assert.equal(parsearFecha('   ').code, 'vacia');
  assert.equal(parsearFecha(null).code, 'vacia');
  assert.equal(parsearFecha('foo').code, 'no_reconocida');
  assert.equal(parsearFecha('2020').code, 'no_reconocida');
  assert.equal(parsearFecha('01/02/2020').code, 'no_reconocida');  // DMY ambiguo: no se usa en los datos
  assert.equal(parsearFecha('1 maravilla 2020').code, 'mes_invalido'); // token alfabético no-mes
});

test('acota el año a un rango razonable', () => {
  assert.equal(parsearFecha('1 ene 1800').code, 'anio_fuera_de_rango');
  assert.equal(parsearFecha('1 ene 3000').code, 'anio_fuera_de_rango');
  assert.equal(parsearFecha('1 ene 1946').ok, true); // límite inferior
});

test('TODAS las fechas reales de data.json pasan el validador (0 errores)', () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
  const malas = [];
  const chk = (fuente, ref, raw) => { const r = parsearFecha(raw); if (!r.ok) malas.push(`${fuente}:${ref}="${raw}" (${r.code})`); };
  (data.efemerides || []).forEach((e, i) => chk('efemerides', i, e.fecha));
  (data.transacciones || []).forEach((t, i) => chk('transacciones', i, t.fecha));
  (data.jugadores || []).forEach(j => {
    if (j.primer_partido && j.primer_partido.fecha) chk('debut', j.id, j.primer_partido.fecha);
    if (j.draft && j.draft_fecha) chk('draft', j.id, j.draft_fecha);
    if (j.nacimiento_fecha) chk('nacimiento', j.id, j.nacimiento_fecha);
  });
  assert.deepEqual(malas, []);
});

function pick(r) { return r.ok ? { ok: true, iso: r.iso, formato: r.formato } : { ok: false, code: r.code }; }
