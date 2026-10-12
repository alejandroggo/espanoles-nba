// Pre-renderiza el <h1> y un párrafo de contexto en cada jugador-<id>.html, para
// que los buscadores/agregadores que no ejecutan JS vean contenido real. El JS
// sustituye ese bloque al cargar, así que no hay stats que se queden viejas.
// Uso: tras añadir un jugador nuevo (su jugador-<id>.html con el placeholder
// "Cargando…"), ejecuta:  node tools/gen-fichas.mjs
import fs from 'fs';
const ROOT = new URL('..', import.meta.url).pathname;
const NAME_FIX = {
  'Alex Abrines': 'Álex Abrines',
  'Raül Lopez': 'Raül López',
  'Juan Nuñez': 'Juan Núñez',
  'Sergio De Larrea': 'Sergio de Larrea',
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const data = JSON.parse(fs.readFileSync(ROOT + '/data.json', 'utf8'));
const PLACEHOLDER = '<div id="jug-content"><p class="td-muted" style="padding:2rem">Cargando…</p></div>';

let done = 0, skipped = [];
for (const j of (data.jugadores || [])) {
  const name = esc(NAME_FIX[j.nombre] || j.nombre);
  const file = `${ROOT}/jugador-${j.id}.html`;
  if (!fs.existsSync(file)) { skipped.push(j.id + ' (no file)'); continue; }
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes(PLACEHOLDER)) { skipped.push(j.id + ' (no placeholder)'); continue; }
  const pre = `<div id="jug-content"><header class="jug-pre"><h1 class="jug-name">${name}</h1>` +
    `<p class="jug-pre-sub">Perfil de ${name} en la NBA: estadísticas de carrera, temporada a temporada, playoffs, premios, dorsales y toda su trayectoria entre los españoles que han jugado en la NBA.</p></header></div>`;
  html = html.replace(PLACEHOLDER, pre);
  fs.writeFileSync(file, html);
  done++;
}
console.log('pre-rendered:', done, '· skipped:', skipped.length ? skipped : 'none');
