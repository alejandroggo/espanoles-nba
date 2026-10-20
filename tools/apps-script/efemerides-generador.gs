/**
 * efemerides-generador.gs — Port a Apps Script del constructor de eventos y del
 * compositor de tuit de la web (FASE 4, Bloque A).
 *
 * Apps Script no puede cargar app.js (no hay DOM ni módulos), así que esta es la
 * ÚNICA parte que hay que re-expresar: `efgBuild()` reproduce `efmBuild()` y
 * `efgTweet()` reproduce `efmShare()`, byte a byte. Un test de paridad en Node
 * (test/efemerides-generador-paridad.test.mjs) compara esta salida contra el
 * app.js real sobre data.json, para garantizar que no diverge.
 *
 * Entrada: `data` = el objeto data.json (jugadores, transacciones, efemerides…),
 * que Apps Script obtiene del repo publicado. Las efemérides manuales ya traen
 * `id` (Fase 3A); `efgBuild` lo adjunta a cada evento de tipo 'hito'.
 *
 * No depende del exportador ni de otras hojas; funciones con prefijo `efg`/`EFG_`
 * para no colisionar al convivir en el mismo proyecto de Apps Script.
 */

var EFG_MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
var EFG_MESES_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
var EFG_MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// abreviatura -> nombre completo (copiado de TEAM_INFO en app.js)
var EFG_TEAM_INFO = {
  ATL: 'Atlanta Hawks', BOS: 'Boston Celtics', BKN: 'Brooklyn Nets', CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls', CLE: 'Cleveland Cavaliers', DAL: 'Dallas Mavericks', DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons', GSW: 'Golden State Warriors', HOU: 'Houston Rockets', IND: 'Indiana Pacers',
  LAC: 'Los Angeles Clippers', LAL: 'Los Angeles Lakers', MEM: 'Memphis Grizzlies', MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks', MIN: 'Minnesota Timberwolves', NOL: 'New Orleans Pelicans', NOP: 'New Orleans Pelicans',
  NYK: 'New York Knicks', OKC: 'Oklahoma City Thunder', ORL: 'Orlando Magic', PHI: 'Philadelphia 76ers',
  PHX: 'Phoenix Suns', POR: 'Portland Trail Blazers', SAC: 'Sacramento Kings', SAS: 'San Antonio Spurs',
  TOR: 'Toronto Raptors', UTA: 'Utah Jazz', WAS: 'Washington Wizards', SEA: 'Seattle SuperSonics', NJN: 'New Jersey Nets'
};

// handles de X por jugador (clave: nombre normalizado). Copiado de TW_HANDLES en app.js.
var EFG_TW_HANDLES = {
  'pau gasol': 'paugasol', 'marc gasol': 'MarcGasol', 'serge ibaka': 'sergeibaka',
  'juan carlos navarro': 'jcnavarroworld', 'ricky rubio': 'rickyrubio9', 'santi aldama': 'santialdama',
  'rudy fernandez': 'rudy5fernandez', 'jose m. calderon': 'JmCalderon', 'jorge garbajosa': 'jgarbajosa15',
  'willy hernangomez': 'willyhg94', 'alex abrines': 'alexabrines', 'juancho hernangomez': 'juanchiviris41',
  'sergio rodriguez': 'SergioRodriguez', 'hugo gonzalez': 'hugoglezz_', 'victor claver': 'Victor_Claver',
  'usman garuba': 'Usmangaruba', 'baba miller': '_bmillxr_', 'sergio de larrea': 'Laaarry_14',
  'albert miralles': 'Miralles10', 'sergio llull': '23Llull', 'dani diez': 'danidiez11', 'juan nunez': 'juaan_ng'
};

var EFG_SITE_URL = 'https://espanoles-nba.alejandroggo.com/efemerides.html';

function efgNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
function efgTeamName(x) { if (!x) return ''; var c = String(x).toUpperCase(); return EFG_TEAM_INFO[c] ? EFG_TEAM_INFO[c] : x; }
function efgParseShort(s) {
  var m = String(s || '').match(/(\d{1,2})\s+([a-zA-ZñÑáéíóúÁÉÍÓÚ]{3,})\s+(\d{4})/);
  if (!m) return null;
  var mo3 = efgNorm(m[2]).slice(0, 3);
  var mo = EFG_MESES.indexOf(mo3);
  if (mo < 0) mo = EFG_MESES_EN.indexOf(mo3);
  if (mo < 0) return null;
  return { d: +m[1], m: mo + 1, year: +m[3] };
}
function efgFmtText(s) { return String(s || '').replace(/[<>]/g, function (c) { return c === '<' ? '&lt;' : '&gt;'; }).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>'); }
function efgMoney(s) { var m = String(s || '').match(/\$\s?[\d.,]+\s?[MK]?(?:\s?[x×]\s?\d+)?/i); return m ? m[0].replace(/\s+/g, ' ').trim() : ''; }
function efgPick(s) { var m = String(s || '').match(/#\s?(\d+)/); return m ? ('#' + m[1]) : ''; }
function efgDebutStat(p) {
  var parts = [];
  if (p.pts != null) parts.push('<b>' + p.pts + '</b> punto' + (p.pts === 1 ? '' : 's'));
  if (p.rbd != null) parts.push('<b>' + p.rbd + '</b> rebote' + (p.rbd === 1 ? '' : 's'));
  if (p.ast != null) parts.push('<b>' + p.ast + '</b> asistencia' + (p.ast === 1 ? '' : 's'));
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
}

function efgBuildPlayerIds(jugadores) {
  var m = {};
  (jugadores || []).forEach(function (j) { m[efgNorm(j.nombre)] = j.id; });
  return m;
}
function efgPlLink(ids, name) {
  var id = ids[efgNorm(name)];
  return id ? ('<a class="pl-link" href="jugador-' + id + '.html">' + name + '</a>') : name;
}
function efgTransText(ids, t) {
  var j = '<b>' + efgPlLink(ids, t.jugador) + '</b>', e1 = t.equipo1 || '', e2 = t.equipo2 || '';
  var money = efgMoney(t.notas || ''), por = money ? ' por <b>' + money + '</b>' : '';
  var tp = efgNorm(t.tipo || '');
  if (/traspas/.test(tp)) return e2 ? (j + ' es traspasado de ' + e1 + ' a ' + e2 + '.') : (j + ' es traspasado' + (e1 ? ' a ' + e1 : '') + '.');
  if (/agente libre/.test(tp)) return j + ' firma como agente libre con ' + e1 + por + '.';
  if (/contrato rookie/.test(tp)) return j + ' firma su contrato rookie con ' + e1 + por + '.';
  if (/renovaci/.test(tp)) return j + ' renueva con ' + e1 + por + '.';
  if (/extensi/.test(tp)) return j + ' firma una extensión de contrato con ' + e1 + por + '.';
  if (/cortad|waived/.test(tp)) return (e1 || 'Su equipo') + ' corta a ' + j + '.';
  if (/waivers/.test(tp)) return j + ' es reclamado en waivers por ' + e1 + '.';
  if (/renuncia de derechos/.test(tp)) return (e1 || 'Su equipo') + ' renuncia a los derechos de ' + j + '.';
  if (/rechaza opci.*jugador/.test(tp)) return j + ' rechaza su opción de jugador con ' + e1 + ' y queda agente libre.';
  if (/rechaza opci.*equipo/.test(tp)) return (e1 || 'Su equipo') + ' no ejerce la opción sobre ' + j + ', que queda agente libre.';
  if (/draft/.test(tp)) { var pk = efgPick(t.notas); return j + ' es elegido en el draft' + (e1 ? ' por ' + e1 : '') + (pk ? ' con el pick ' + pk : '') + '.'; }
  var eqs = [e1, e2].filter(Boolean);
  return j + (eqs.length ? ' · ' + eqs.join(' → ') : '');
}

// Reproduce efmBuild(data): devuelve el array de eventos con el MISMO `html`.
function efgBuild(data) {
  var ev = [];
  var draftKey = {};
  var ids = efgBuildPlayerIds(data.jugadores);

  // Hitos manuales (pestaña EFEMERIDES, ya con id)
  (data.efemerides || []).forEach(function (e) {
    var s = String(e.fecha || '').trim();
    var dm = null, m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) dm = { year: +m[1], m: +m[2], d: +m[3] };
    else if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) { var y = +m[3]; if (y < 100) y += 2000; dm = { d: +m[1], m: +m[2], year: y }; }
    else dm = efgParseShort(s);
    if (!dm) return;
    var text = efgFmtText(e.texto || e.text || e.hito || '');
    if (!text) return;
    var tag = (e.tipo || e.etiqueta || 'Hito');
    var jug = String(e.jugador || '').trim();
    var html = text;
    if (jug) {
      var plain = efgNorm(text.replace(/<[^>]+>/g, ''));
      if (plain.indexOf(efgNorm(jug)) !== 0) {
        html = '<b>' + efgPlLink(ids, jug) + '</b> ' + text.replace(/^([A-Za-zÁÉÍÓÚÑáéíóúñ])/, function (c) { return c.toLowerCase(); });
      }
    }
    ev.push({ d: dm.d, m: dm.m, year: dm.year, kind: 'hito', tag: tag, html: html, video: String(e.video || e.video_url || e.youtube || e.yt || '').trim(), player: jug, id: e.id || null });
  });

  // Debut, draft y cumpleaños (de la ficha del jugador)
  (data.jugadores || []).forEach(function (j) {
    var p = j.primer_partido;
    if (p && p.fecha) {
      var dt = efgParseShort(p.fecha);
      if (dt) {
        var eq = p.equipo ? ' con ' + efgTeamName(p.equipo) : '';
        var riv = p.rival ? ' ante ' + efgTeamName(p.rival) : '';
        var st = efgDebutStat(p);
        ev.push({ d: dt.d, m: dt.m, year: dt.year, kind: 'debut', tag: 'Debut', player: j.nombre, video: String((p.video || p.video_url || '')).trim(), html: '<b>' + efgPlLink(ids, j.nombre) + '</b> debutó en la NBA' + eq + riv + (st ? ', firmando ' + st : '') + '.' });
      }
    }
    if (j.draft && j.draft_fecha) {
      var dd = efgParseShort(j.draft_fecha);
      if (dd) {
        ev.push({ d: dd.d, m: dd.m, year: dd.year, kind: 'draft', tag: 'Draft', player: j.nombre, video: String((j.draft_video || j.video_draft || '')).trim(), html: '<b>' + efgPlLink(ids, j.nombre) + '</b> es elegido en el draft' + (j.draft_equipo ? ' por ' + efgTeamName(j.draft_equipo) : '') + (j.draft_pick ? ' con el pick #' + j.draft_pick : '') + '.' });
        draftKey[efgNorm(j.nombre) + '|' + dd.year] = true;
      }
    }
    if (j.nacimiento_fecha) {
      var dn = efgParseShort(j.nacimiento_fecha);
      if (dn) ev.push({ d: dn.d, m: dn.m, year: dn.year, kind: 'cumple', tag: 'Cumpleaños', player: j.nombre, video: '', html: 'Nace <b>' + efgPlLink(ids, j.nombre) + '</b>.' });
    }
  });

  // Transacciones (evitando duplicar el draft ya recogido)
  (data.transacciones || []).forEach(function (t) {
    var m = String(t.fecha || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return;
    if (/draft/i.test(t.tipo || '') && draftKey[efgNorm(t.jugador) + '|' + (+m[1])]) return;
    ev.push({ m: +m[2], d: +m[3], year: +m[1], kind: 'trans', tag: t.tipo, player: t.jugador || '', video: String(t.video || t.video_url || t.youtube || t.yt || '').trim(), html: efgTransText(ids, t),
      detail: { jugador: t.jugador || '', fecha: t.fecha || '', tipo: t.tipo || '', equipo1: t.equipo1 || '', equipo2: t.equipo2 || '', otros: t.otros || '', notas: t.notas || '' } });
  });

  return ev;
}

// Quita etiquetas y decodifica entidades (equivalente a element.textContent).
function efgStripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function efgHandle(name) {
  var h = EFG_TW_HANDLES[efgNorm(name || '')];
  return h ? ('@' + String(h).replace(/^@/, '')) : '';
}

// Compone el tuit del borrador. Formato (decisión de Alejandro):
//   «#EspañolesNBA Hoy hace X años <texto>» + enlace
// Sin la fecha al inicio y sin «(vía @alejandroggo)» (todos son tuits suyos).
// `pubYear` = año de publicación (campaña); X = pubYear - año del acontecimiento.
function efgTweet(ev, pubYear) {
  var texto = efgStripHtml(ev.html).replace(/\s+/g, ' ').trim();
  var handle = efgHandle(ev.player);
  if (handle && ev.player) texto = texto.split(ev.player).join(handle);
  // Cumpleaños: "Nace X" -> "nace X" para que fluya tras el prefijo.
  if (/^Nace /.test(texto)) texto = texto.charAt(0).toLowerCase() + texto.slice(1);
  var anios = (pubYear || new Date().getUTCFullYear()) - ev.year;
  var prefijoAnios = anios >= 2 ? ('Hoy hace ' + anios + ' años ') : (anios === 1 ? 'Hoy hace 1 año ' : 'Hoy ');
  var inicio = '#EspañolesNBA ' + prefijoAnios;
  var url = EFG_SITE_URL + '?m=' + ev.m + '&d=' + ev.d;
  // Límite de X (280): enlace pesa 23 + 2 saltos de línea.
  var presupuesto = 280 - 25 - inicio.length;
  if (texto.length > presupuesto) texto = texto.slice(0, presupuesto - 1).replace(/\s+$/, '') + '…';
  return inicio + texto + '\n\n' + url;
}
