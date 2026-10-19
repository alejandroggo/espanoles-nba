// Validador ESTRICTO de fechas para el futuro generador de efemérides (FASE 2A).
//
// Herramienta de desarrollo aislada: NO la importa app.js, NO sustituye a
// efmParseShort y NO altera la web pública. efmParseShort (en app.js) es laxo a
// propósito (no valida rangos ni resuelve ISO); este módulo es lo contrario: un
// portero estricto que el generador usará para rechazar fechas imposibles y
// registrar un error en vez de crear un borrador.
//
// Formatos aceptados (los que aparecen de verdad en data.json):
//   · ISO            "2015-02-08"            (transacciones)
//   · español corto  "1 nov 2001"           (campos de jugador: primer_partido, nacimiento)
//   · inglés corto   "1 jan 2015"           (pestaña de efemérides)
// Cualquier otra forma se rechaza como `no_reconocida` (incluye DD/MM/AAAA, que
// es ambiguo y no se usa en los datos reales).
//
// Resultado estructurado:
//   { ok:true,  y, m, d, iso:'YYYY-MM-DD', formato:'iso'|'es'|'en' }
//   { ok:false, code, motivo, input }
// Códigos de error: 'vacia' | 'no_reconocida' | 'mes_invalido' |
//                   'dia_fuera_de_rango' | 'anio_fuera_de_rango'

// Normalización equivalente a drNorm (NFD + sin diacríticos + minúsculas + trim).
function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Mapa token-de-mes -> número (1..12). Admite abreviatura de 3 letras y nombre
// completo, en español e inglés. "may" vale para ambos idiomas.
const MES_MAP = (() => {
  const m = {};
  const add = (names, n) => names.forEach(x => { m[x] = n; });
  add(['ene', 'enero', 'jan', 'january'], 1);
  add(['feb', 'febrero', 'february'], 2);
  add(['mar', 'marzo', 'march'], 3);
  add(['abr', 'abril', 'apr', 'april'], 4);
  add(['may', 'mayo'], 5);               // "may" (en) y "mayo" (es)
  add(['jun', 'junio', 'june'], 6);
  add(['jul', 'julio', 'july'], 7);
  add(['ago', 'agosto', 'aug', 'august'], 8);
  add(['sep', 'set', 'sept', 'septiembre', 'setiembre', 'september'], 9);
  add(['oct', 'octubre', 'october'], 10);
  add(['nov', 'noviembre', 'november'], 11);
  add(['dic', 'diciembre', 'dec', 'december'], 12);
  return m;
})();

function esBisiesto(y) {
  return (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
}

export function diasDelMes(y, m) {
  return [31, esBisiesto(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// Valida y/m/d ya numéricos contra el calendario real.
// `opts.minYear`/`opts.maxYear` acotan el año (por defecto 1946..2100, fijos para
// que las pruebas no dependan del reloj ni de la zona horaria de la máquina).
export function validarYMD(y, m, d, opts = {}) {
  const minYear = opts.minYear ?? 1946; // la NBA/BAA arranca en 1946
  const maxYear = opts.maxYear ?? 2100;
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return { ok: false, code: 'no_reconocida', motivo: 'componentes no numéricos' };
  }
  if (m < 1 || m > 12) return { ok: false, code: 'mes_invalido', motivo: `mes ${m} fuera de 1..12` };
  if (y < minYear || y > maxYear) return { ok: false, code: 'anio_fuera_de_rango', motivo: `año ${y} fuera de ${minYear}..${maxYear}` };
  const max = diasDelMes(y, m);
  if (d < 1 || d > max) return { ok: false, code: 'dia_fuera_de_rango', motivo: `día ${d} fuera de 1..${max} para ${y}-${String(m).padStart(2, '0')}` };
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { ok: true, y, m, d, iso };
}

// Parsea + valida una cadena de fecha en cualquiera de los 3 formatos aceptados.
export function parsearFecha(raw, opts = {}) {
  const input = raw;
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return { ok: false, code: 'vacia', motivo: 'fecha vacía', input };

  // ISO: YYYY-MM-DD (admite sufijo de hora/zona, como en algunas transacciones).
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (m) {
    const r = validarYMD(+m[1], +m[2], +m[3], opts);
    return r.ok ? { ...r, formato: 'iso', input } : { ...r, input };
  }

  // Textual corto: "D mes AAAA" (es/en). Día 1-2 cifras, mes alfabético, año 4 cifras.
  m = s.match(/^(\d{1,2})\s+([a-záéíóúñ.]+)\s+(\d{4})$/i);
  if (m) {
    const tok = norm(m[2]).replace(/\.$/, '');
    const mes = MES_MAP[tok];
    if (!mes) return { ok: false, code: 'mes_invalido', motivo: `mes no reconocido: "${m[2]}"`, input };
    const r = validarYMD(+m[3], mes, +m[1], opts); // (año, mes, día)
    // Formato textual corto (es/en comparten muchos tokens: no distinguimos idioma).
    return r.ok ? { ...r, formato: 'texto', input } : { ...r, input };
  }

  return { ok: false, code: 'no_reconocida', motivo: 'formato no reconocido', input };
}
