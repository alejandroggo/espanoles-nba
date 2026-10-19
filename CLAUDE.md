# CLAUDE.md — Españoles NBA

Contexto persistente del proyecto para no reconstruirlo en cada sesión. Léelo primero.
Convención: **[verificado]** = comprobado en el repo · **[decisión]** = acordado con Alejandro · **[pendiente/propuesto]** = sin confirmar o sin implementar.

---

## 1. Descripción del proyecto
- **Qué es:** web estática sobre todos los jugadores españoles de la historia de la NBA (de Fernando Martín al presente). Base de datos + herramientas de consulta y visualización. [verificado: README, data.json]
- **Público:** aficionados al baloncesto en español; la mantiene **Alejandro Gaitán** (periodista NBA). 
- **Web:** https://espanoles-nba.alejandroggo.com · **Repo:** https://github.com/alejandroggo/espanoles-nba
- **Objetivo:** consultar y comparar carreras, estadísticas, dinero, récords e historia de los españoles NBA, y generar/compartir contenido (imágenes, gráficos).

## 2. Arquitectura técnica
Sitio **100% estático, vanilla JS** (sin framework ni build). Toda la lógica vive en un único `app.js`; cada `.html` es una página con su propia función `init…Page()`.

**Archivos clave** [verificado]:
- `app.js` (~8.600 líneas): toda la lógica. Al final define por secciones comentadas cada feature.
- `style.css` (~2.300 líneas): estilos + modo claro/oscuro con variables (`--accent #b91c1c`, `--dorado #f5c518`, fuentes Bebas Neue / DM Serif Display / Inter).
- `data.json` (raíz): **base de datos principal**. La escribe un bot de **Google Apps Script** (fuera del repo) que commitea a `main`; Vercel despliega solo.
- `data/` (datasets curados a mano, NO los toca el bot): `duelos.json` (68 duelos cara a cara), `parejas.json` (7 parejas), `salarios.json` (reparto por equipo/franquicia), `rookies.json`.
- `*.html` páginas de sección + 29 `jugador-*.html` (fichas) + `jugador.html` (ficha dinámica por `?id=`).
- `sw.js` (service worker), `tools/` (`gen-fichas.mjs`, `test-graficos.mjs`), `README.md`.
- Páginas que leen `data/`: `parejas.html`, `cara-a-cara.html` y `salarios.html` (sección "por equipo").

**Esquema de `data.json`** [verificado]:
- Top-level: `actualizado`, `jugadores[]`, y arrays globales `superaciones` (hitos recientes, se muestran en la portada), `summer_league`, `dorsales`, `transacciones`, `efemerides`.
- Cada jugador: `id` (slug), `nombre`, totales (`pts_total`, `rbd_total`, `ast_total`, `min_total`, `tres_total`, `td_total`…) y por partido (`pts_g`, `rbd_g`, `ast_g`…), `partidos`, `temporadas` (nº), `%` (`fg_pct`, `tres_pct`, `ft_pct`), `game_highs`, `ganancias`/`ganancias_ganado`/`ganancias_futuro`, `equipos_nba` (string), `premios[]`, `records`, `playoffs_temporadas`/`playoffs_totales`, `draft*`, `primer_partido`, `posicion`, `bref_id`, `nacimiento`/`nacimiento_fecha`, `post_nba`, `summer_league`, y **`temporadas_data[]`**.
- `temporadas_data[]`: una fila por paso por equipo y temporada (`year`, `team`, `g`, `*_g`, `*_pct`). **En temporadas con traspaso hay una fila `TOT` + una por equipo.** Para una fila por año usar **`cmpYearRows()`** (prefiere `TOT`, nunca suma parciales). Los totales de carrera oficiales viven en los campos `*_total`; las vistas por temporada salen de `temporadas_data`.
- Campos manuales (`posicion`, `bref_id`, `nacimiento`, `foto_url`, etc.) los **preserva el Apps Script** (mecanismo `CAMPOS_MANUALES`, fuera del repo) al regenerar: editarlos en `data.json` persiste. [decisión, confirmado por Alejandro]

**Carga de datos** [verificado]: `loadData()` hace un único `fetch('data.json', {cache:'no-cache'})` deduplicado (`AG_DATA_PROMISE`); normaliza `BRK→BKN`. Las páginas que usan `data/` hacen su propio `fetch('data/<x>.json')`.

**Patrón de página** [verificado]: `<head>` con GA4 (Consent Mode v2, cookies denegadas por defecto + banner) + fuentes + `style.css?v=N`; header + hero + contenido + footer; al final `<script src="app.js?v=N"></script>` y `<script>initTheme(); init<Nombre>Page();</script>`. `initTheme()` llama a `buildNav()`, `buildHeaderSearch()`, `buildShareButton()`, banner de cookies, etc.

**Funciones compartidas que hay que reutilizar** [verificado]:
- Datos/estado: `loadData`, `drNorm` (normaliza nombres), `drSeason`, `teamInfo`, `buildPlayerIds`, `jugadorHref`, `agNamePlayerMap` (mapa nombre→jugador para fotos).
- Fotos: `agFotoSrc`/`agFotoSrc2`/`agFotoFb` (local `img/players/<id>.jpg` con respaldo a bref), `avatarHtml` (iniciales).
- Dinero/formatos: `fmtDinero`.
- Comparador/temporadas: `cmpYearRows`, `cmpSeasons`, `cmpAgg`.
- **Export a imagen (canvas, sin librerías):** `qntBlob()` (canvas→PNG) + builders `cmpBuildImage`, `grBuildImage`, `qntBuildImage`, `retoBuildImage`, `pjBuildImage`. Plantilla PNG oscura con franjas de bandera. Reutilizar este motor para cualquier imagen nueva.
- Analítica: `track(evento, params)` (falla en silencio si no hay gtag).

**Caché:** cache-busting `?v=N` en `app.js` y `style.css` en TODAS las páginas. **Al cambiar `app.js`/`style.css` hay que subir N** (hoy **v=209**) con `sed -i 's/?v=209/?v=210/g' *.html`. [verificado]

**Despliegue** [verificado/decisión]: sin `vercel.json` ni workflows → sitio estático. **Push a `main` → Vercel despliega automáticamente** en el dominio. El bot de Apps Script también commitea a `main`. No publicar sin autorización (ver §4).

## 3. Funcionalidades existentes (NO reconstruir)
Todas verificadas por sus `init…Page()` en `app.js` y su `.html`:
- **Comparador** (`comparador.html`, `initComparadorPage`): compara 2-3 jugadores por bloques, con imagen "cara a cara" para X.
- **Fichas de jugador** (`jugador.html`/`jugador-*.html`, `initJugadorPage`): perfil completo con stats, temporadas, premios, dinero, playoffs; imagen compartible.
- **Listados/estadística histórica:** `jugadores.html`, `ranking.html` (Carrera), `temporadas.html`, `career-highs.html` (máximos), `por-equipo.html` (partidos por equipo, matriz), `linea-temporal.html`, `draft.html`, `dorsales.html`, `premios.html`, `summer-league.html`, `debut.html`.
- **Salarios** (`salarios.html`, `initSalariosPage`): ranking de ganancias + sección "por equipo" (dropdown de reparto por franquicia al pulsar cada jugador + tabla de franquicias con %). Lee `data/salarios.json`.
- **Marcas al alcance** (`marcas.html`): récords/superaciones próximas.
- **Transacciones / Efemérides** (`transacciones.html`, `efemerides.html`): leen arrays globales de `data.json`.
- **Test / Quinteto ideal** (`test.html`, `quinteto.html`): cuestionario ("reto del día") y "arma tu quinteto", ambos con imagen compartible.
- **Creador de gráficos** (`graficos.html`): ver §5 (implementado).
- **Buscador PEPU** (`preguntas.html`, `initPreguntasPage`): Q&A **determinista** (no IA) sobre `data.json` + `data/parejas.json` + `data/duelos.json`. Oculto del menú por ahora (ver §7).
- **Parejas** (`parejas.html`) y **Cara a cara / matriz de duelos** (`cara-a-cara.html`): live pero **ocultas** (sin enlace en menú, `noindex`). Leen `data/parejas.json` y `data/duelos.json`. Parejas tiene botón "Compartir pareja" (PNG).
- Portada (`index.html`) con "recién superadas", buscador de jugador en cabecera, menú global (`buildNav`), tema claro/oscuro, banner de cookies.

## 4. Decisiones y preferencias de desarrollo
**Confirmadas** (Alejandro las pide expresamente):
- **Reutilizar** código y datos existentes antes de crear nada nuevo.
- **No duplicar la base de datos** ni mantener fuentes paralelas (`data.json` es la fuente; `data/*.json` son datasets curados específicos).
- **Cambios localizados**, no refactors generales cuando solo hace falta una modificación puntual.
- **Mantener el diseño y la identidad visual** (variables CSS, fuentes, estética editorial).
- **No introducir dependencias nuevas** sin justificación concreta (todo es vanilla; export de imágenes por canvas propio).
- **Proteger lo que ya funciona**: no romper features existentes.
- **No desplegar/publicar (push a `main`, publicar artifacts) sin autorización explícita.**
- Trabajar por **tareas acotadas** y **verificar** el resultado (en este repo: render headless con Chromium + `node --check app.js`).

**Decisiones de contenido de este ciclo** [decisión]:
- El buscador se llama **PEPU**.
- Parejas y Cara a cara: **públicas pero ocultas** (sin menú) hasta que Alejandro las encienda.
- Salarios por equipo: **integrado dentro de `salarios.html`** (una sola tabla con dropdown), no como página aparte.
- `Ricky Rubio` perdonó **$424.672** (buyout 2023) → sus splits no cuadran con su total; Indiana pagó a Ricky e Ibaka sin que jugaran (caso especial en la tabla de franquicias).

**Propuesto, NO aprobado** [propuesto]:
- Página/sección de **"españoles no jugadores"** (entrenadores/staff) para Jordi Fernández y futuros. Hay un **preview** de la ficha de Jordi (artifact), sin desplegar.

## 5. Proyecto: creador de gráficos (`graficos.html`)
**Estado: IMPLEMENTADO** [verificado] (módulo en `app.js`, sección "GRÁFICOS", ~líneas 7014-8585; funciones puras testeadas en `tools/test-graficos.mjs`). Resumen de lo que YA existe:
- Tipos: **líneas** (evolución de carrera) y **dispersión/scatter** (dos métricas). `GR_TIPOS = ['lineas','dispersion']`. [verificado]
- Selección de **jugadores** (picker/chips) y **métricas** (catálogo `GR_CATS`: pts/reb/ast/rob/tap/triples/min/tov/pf por partido, totales y %; eje X `temp`/`n`/`edad`). [verificado]
- Periodos/filtros compatibles con los datos: **carrera vs temporada**, **reg vs playoffs**, rango `desde`/`hasta`, mínimo de partidos. Manejo correcto de **`TOT`** (una fila/año vía dedup), promedios por partido (nunca suma de promedios) y valores ausentes. [verificado]
- **Export a imagen PNG** (`grDownload`, horizontal 1600×900 o vertical 1080×1350) y **compartir en X** (`grShare`, `navigator.share`), reutilizando `qntBlob`/`grBuildImage`. [verificado]
- **Compartir configuración por URL**: estado serializado en query params (`grParseState` + `history.replaceState`) + "Copiar enlace" (`grCopyLink`). [verificado]
- **Tooltips** (`gr-tip`, pointermove), **leyenda** (`gr-legend`), **ejes etiquetados**, **responsive** (`ResizeObserver`→`grDraw`), caras de jugadores como marcas. [verificado]

**Pendiente/propuesto:**
- **Gráficos de barras**: NO implementados aún (solo líneas y dispersión). [propuesto]
- Ejemplo inicial "puntos por partido de Pau y Marc Gasol en líneas": soportado por la herramienta; **el estado por defecto exacto está sin confirmar** (el default actual incluye un scatter). [pendiente de confirmar]

## 6. Preferencias de trabajo con Alejandro
- Respuestas **directas y prácticas**; cambios concretos, no reescrituras innecesarias.
- Explicaciones **breves** salvo que pida más detalle.
- Informes centrados en **archivos modificados, pruebas realizadas y problemas pendientes**.
- **No repetir auditorías completas** si el contexto sigue vigente.
- Suele pedir **preview (artifact)** antes de desplegar a la web; itera sobre el preview.

## 7. Estado actual y próximos pasos
**Hechos verificados (repo):**
- Menú (`NAV_LINKS`) enlaza todas las secciones **excepto** PEPU/`preguntas.html` (comentado), `parejas.html` y `cara-a-cara.html` (ocultas, `noindex`).
- `data.json` actualizado 2026-10-18; 29 jugadores. Caché en **v=209**.
- Creador de gráficos, comparador, salarios (con "por equipo"), parejas, cara a cara y PEPU: funcionando.

**Decisiones en conversación (este ciclo):**
- `data/duelos.json` completo (récord, medias, minutos, primer/último duelo, series de playoffs) y `data/salarios.json` actualizado a 2026-27 (Aldama→Dallas, rookies que debutan, Eli Ndiaye→Atlanta).
- Preview de Jordi Fernández listo (perfil de entrenador, orden cronológico inverso, NBA destacado, Nets 46-118 en 2 temporadas).

**Pendiente / requiere confirmación:**
- **Encender PEPU** del todo (enlace en menú + widget flotante `buildChatWidget`): decisión de Alejandro.
- **GA4**: crear las 3 dimensiones personalizadas del buscador (`resultado`, `pregunta`, `origen`) — tarea manual en la consola; hay recordatorio programado.
- **Gráficos de barras** (pendiente de implementar).
- **Página "españoles no jugadores"** (Jordi): propuesta, no construida.
- Salario de **Eli Ndiaye ($85.300)**: tomado tal cual, a confirmar.
- Backlog de ideas: ver el artifact "Pendientes · Web NBA" (lista viva mantenida por Claude).
- **Siguiente paso recomendado:** confirmar con Alejandro si se enciende PEPU y si se construye la sección de no-jugadores; mientras, no desplegar sin su visto bueno.

## 8. Protocolo para ahorrar tokens
En cada sesión futura:
1. **Lee primero este `CLAUDE.md`.**
2. Inspecciona **solo los archivos relevantes** a la tarea; no releas `app.js`/`data.json` enteros si basta con buscar.
3. **Busca funciones/datos existentes antes de crear** (grep en `app.js`, revisa §2/§3). Reutiliza `loadData`, `qntBlob`, `agFotoSrc`, `cmpYearRows`, etc.
4. Evita releer archivos grandes completos: usa `grep`/`sed`/`Read` con offset para partes concretas.
5. **No repitas explicaciones ni auditorías ya documentadas** aquí.
6. Verifica tus cambios (render headless + `node --check app.js`) e informa breve: archivos tocados, pruebas, pendientes.
7. **Al cambiar `app.js`/`style.css`, sube la versión `?v=N`** en todas las páginas.
8. **No despliegues a `main` sin autorización.**
9. Actualiza este archivo **solo** cuando cambien de forma significativa decisiones, arquitectura o estado.
