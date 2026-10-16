'use strict';

// Test de consistencia de datos (data.json).
//
// Invariante: para cada jugador, el total oficial de partidos de carrera
// (`partidos`, el que usa el gráfico de carrera y el comparador) debe
// coincidir con la suma de partidos de sus temporadas (lo que usa el
// gráfico por temporadas).
//
// La suma por temporadas toma UNA fila por año, prefiriendo la fila "TOT"
// en los años con traspaso (misma lógica que `cmpYearRows` en app.js), para
// no contar dos veces las temporadas repartidas entre varios equipos.
//
// Ejecutar con:  node --test   (o  npm test)

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data.json'), 'utf8')
);
const jugadores = data.jugadores || [];

// Una fila por temporada, prefiriendo TOT (espejo de cmpYearRows en app.js).
function sumaPartidosTemporadas(j) {
  const porAnio = {};
  for (const t of j.temporadas_data || []) {
    const y = t.year;
    if (!y) continue; // descarta filas placeholder (year 0 / vacío)
    if (!(y in porAnio) || t.team === 'TOT') porAnio[y] = t;
  }
  return Object.values(porAnio).reduce((acc, r) => acc + (r.g || 0), 0);
}

test('cada jugador con temporadas_data cuadra partidos ↔ suma de temporadas', async (t) => {
  const conTemporadas = jugadores.filter(
    (j) => (j.temporadas_data || []).some((x) => x.year)
  );
  assert.ok(conTemporadas.length > 0, 'no se encontraron jugadores con temporadas_data');

  const descuadres = [];
  for (const j of conTemporadas) {
    const nombre = (j.nombre || j.id || '?').trim();
    await t.test(nombre, () => {
      const oficial = j.partidos;
      const suma = sumaPartidosTemporadas(j);
      if (oficial !== suma) {
        descuadres.push({ nombre, oficial, suma, dif: suma - oficial });
      }
      assert.strictEqual(
        suma,
        oficial,
        `${nombre}: partidos=${oficial} pero la suma de temporadas da ${suma} (diferencia ${suma - oficial >= 0 ? '+' : ''}${suma - oficial})`
      );
    });
  }

  if (descuadres.length) {
    const tabla = descuadres
      .map((d) => `  - ${d.nombre}: partidos=${d.oficial}, temporadas=${d.suma} (${d.dif >= 0 ? '+' : ''}${d.dif})`)
      .join('\n');
    assert.fail(`${descuadres.length} jugador(es) con partidos de carrera que no cuadran con la suma de temporadas:\n${tabla}`);
  }
});
