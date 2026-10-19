// Identificadores estables para las efemérides (herramienta de desarrollo, FASE 1).
//
// Este módulo NO está conectado a la web pública: app.js no lo importa y el sitio
// sigue funcionando igual que hoy. Sirve como base verificable para el futuro
// generador semanal de borradores y para las pruebas de `test/efemerides-id.test.mjs`.
//
// Separamos dos identidades distintas (ver informe de Fase 1):
//   · eventId : identidad del ACONTECIMIENTO histórico. Estable para siempre; no
//               depende de la redacción del texto. Se construye a partir de la
//               clave natural del evento (jugador + fecha + tipo/equipos), nunca
//               del número de fila de una hoja ni de un hash del texto.
//   · draftId : identidad del BORRADOR de publicación de una campaña/año concreto.
//               Es `${eventId}#${añoPublicacion}`, de modo que la misma efeméride
//               pueda proponerse en años distintos sin confundir el acontecimiento
//               histórico con el borrador de una temporada.
//
// El módulo trabaja sobre los eventos TAL CUAL los produce `efmBuild(data)` en
// app.js (objetos con { kind, player, m, d, year, tag, detail? }). Por eso NO
// reimplementa el parseo de fechas ni las plantillas de texto: reutiliza los
// campos ya calculados por la web, evitando duplicar su lógica.

// Mismo criterio de normalización que `drNorm` en app.js (NFD + sin diacríticos
// + minúsculas + trim). Se replica aquí, mínimo y autocontenido, para no acoplar
// la herramienta al sandbox de app.js.
export function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Slug ASCII estable para usar dentro de un id (equipos, tipos, nombres sin ficha).
export function slug(s) {
  return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const pad = n => String(n).padStart(2, '0');

// Fecha ISO (YYYY-MM-DD) del acontecimiento a partir de los campos ya parseados
// por efmBuild. No parsea cadenas: usa year/m/d del propio evento.
export function isoOf(ev) {
  return `${ev.year}-${pad(ev.m)}-${pad(ev.d)}`;
}

// Slug del jugador. Preferimos SIEMPRE el id canónico de su ficha (`j.id`, un
// campo manual que el Apps Script preserva), que es estable aunque se corrija la
// grafía del nombre. Si el jugador no tiene ficha, caemos a un slug del nombre
// normalizado, marcado con el prefijo `name-` para que sea evidente que es un
// respaldo (y revisable).
export function playerSlug(ev, nameToId) {
  const n = norm(ev.player || '');
  if (!n) return 'na';
  const id = nameToId && nameToId[n];
  return id || ('name-' + slug(ev.player));
}

// Construye un mapa nombre-normalizado -> id de ficha a partir de data.jugadores.
export function buildNameToId(jugadores) {
  const map = {};
  (jugadores || []).forEach(j => { if (j && j.nombre) map[norm(j.nombre)] = j.id; });
  return map;
}

// eventId: identidad del acontecimiento histórico.
//
//   debut / draft / cumple : un único acontecimiento por jugador en toda su vida,
//        así que basta con el jugador  ->  `debut:<pid>`, `draft:<pid>`, `cumple:<pid>`.
//        (Verificado en los datos reales: ningún jugador tiene más de uno.)
//
//   trans : un jugador puede tener varias transacciones, incluso el mismo día y del
//        mismo tipo (p. ej. un traspaso encadenado). La clave natural es
//        jugador + fecha + tipo + equipos implicados. Incluir los equipos distingue
//        los traspasos encadenados del mismo día (caso real: Albert Miralles,
//        2016-07-07, Bucks->Cavs y Cavs->Bulls).
//
//   hito : los hitos manuales NO tienen id de origen (solo fecha/jugador/hito/
//        etiqueta/video). Clave natural de respaldo: jugador + fecha completa.
//        Es estable frente a reescrituras del texto, pero NO puede distinguir dos
//        hitos distintos del mismo jugador en la misma fecha (ver limitaciones en
//        el informe: la solución robusta es un id persistente en el origen).
export function eventId(ev, nameToId) {
  const pid = playerSlug(ev, nameToId);
  switch (ev.kind) {
    case 'debut':  return `debut:${pid}`;
    case 'draft':  return `draft:${pid}`;
    case 'cumple': return `cumple:${pid}`;
    case 'trans': {
      const d = ev.detail || {};
      const iso = /^\d{4}-\d{2}-\d{2}/.test(String(d.fecha || '')) ? String(d.fecha).slice(0, 10) : isoOf(ev);
      const parts = ['trans', pid, iso, slug(d.tipo || ev.tag || '')];
      if (d.equipo1 || d.equipo2) parts.push(slug(d.equipo1 || ''), slug(d.equipo2 || ''));
      return parts.join(':');
    }
    case 'hito':   return `hito:${pid}:${isoOf(ev)}`;
    default:       return `${ev.kind || 'ev'}:${pid}:${isoOf(ev)}`;
  }
}

// draftId: identidad del borrador de publicación para un año de campaña.
// La misma efeméride en 2026 y en 2027 produce draftIds distintos; regenerar la
// misma semana del mismo año produce el MISMO draftId (idempotente).
export function draftId(evId, anioPublicacion) {
  return `${evId}#${anioPublicacion}`;
}

// Extrae el eventId a partir de un draftId (útil para el historial anti-duplicados).
export function eventIdOf(draftIdStr) {
  const s = String(draftIdStr || '');
  const i = s.lastIndexOf('#');
  return i === -1 ? s : s.slice(0, i);
}
