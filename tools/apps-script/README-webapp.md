# Página privada de borradores de efemérides — despliegue (Fase 4, Bloque E)

Guía para poner en marcha la herramienta. **Tú ejecutas estos pasos** (yo no puedo
crear tu hoja ni desplegar). Todo vive en tu cuenta de Google; nada toca la web
pública ni el repo (los borradores viven en una hoja privada).

## Archivos que componen la herramienta
En tu proyecto de Apps Script tendrás, además de lo que ya tienes, estos archivos
(cópialos tal cual del repo, carpeta `tools/apps-script/`):

| Archivo | Qué es |
|---|---|
| `efemerides-generador.gs` | Construye los eventos de la semana y el texto del tuit (port fiel de la web). |
| `efemerides-core.gs` | Núcleo: validación de fechas, identidad, `planGeneration`, `applyPlan`. |
| `efemerides-sheet.gs` | Capa de datos + `generarSemana()` (lee `data.json`, escribe la hoja). |
| `efemerides-webapp.gs` | Web App privada, operaciones de la UI y el trigger. |
| `Index.html` | La página (vista semanal, editar, copiar, aprobar/descartar/publicar). |

> Pueden ir en el **mismo** proyecto que tu exportador, o en uno nuevo. Si van en
> el mismo, no dupliques funciones. Cada función aparece una sola vez.

## Pasos

### 1. Hoja privada de borradores
1. Crea un **Google Sheet nuevo y privado** (p. ej. "Efemérides · Borradores").
2. Copia su **id** (lo que va entre `/d/` y `/edit` en la URL).
3. No hace falta crear pestañas a mano: el script crea `BORRADORES` y `LOG` con sus
   cabeceras la primera vez.

### 2. Pegar el código
1. En ese Sheet: **Extensiones → Apps Script**.
2. Crea los 5 archivos de la tabla y pega su contenido. Para `Index.html`: **+ →
   HTML**, nómbralo exactamente `Index`.
3. En `efemerides-sheet.gs`, pon tu id de hoja: `var EFS_SHEET_ID = 'TU_ID_AQUÍ';`.
4. En `efemerides-webapp.gs`, confirma `EFW_ALLOWLIST = ['a.gaitanojeda@gmail.com']`.
5. **Zona horaria del proyecto:** Configuración del proyecto (⚙) → *Zona horaria* →
   **America/Toronto** (así el trigger del sábado y las sugerencias horarias usan
   esa zona, con horario de verano automático).

### 3. Primera generación (de prueba)
1. Selecciona la función `generarSemana` y **Ejecuta** (acepta permisos).
2. Abre la hoja: la pestaña `BORRADORES` debe tener una fila por efeméride de la
   próxima semana (lun–dom) con su `tweet_text`, `url`, `scheduled_at`, `status =
   pendiente`. Si hay incidencias, mira la pestaña `LOG`.

### 4. Desplegar la Web App (acceso solo para ti)
1. **Implementar → Nueva implementación → Aplicación web.**
2. *Ejecutar como:* **Yo**.
3. *Quién tiene acceso:* **Solo yo**.
4. Implementar → copia la **URL**. Ábrela (en el móvil, con tu misma cuenta de
   Google). Deberías ver la semana con sus tarjetas.
   - La `EFW_ALLOWLIST` es una segunda barrera: aunque cambiaras el acceso, solo
     tu email entra.

### 5. Programar el sábado
1. Selecciona la función `crearTriggerSabado` y **Ejecuta** una vez.
2. Queda un activador semanal: los **sábados ~8:00 (America/Toronto)** se ejecuta
   `generarSemana()`. Si falla, recibes un email y queda en `LOG`.
   - Para quitarlo: ejecuta `borrarTriggerSabado`.

## Uso diario
- Abre la URL (guárdala en el móvil). Verás la semana por días.
- Edita el texto si quieres → **Guardar** (queda marcado como editado y la
  regeneración ya no lo tocará).
- **Copiar tuit** → pégalo en X cuando llegue la hora sugerida.
- **Aprobar** / **Descartar**: organiza lo que está listo.
- Tras publicar en X: **Marcar publicado** (con confirmación) para no repetirlo.
- Botón **Regenerar**: vuelve a generar sin perder tus ediciones, aprobaciones ni
  descartes. Si el origen cambió algo que tú editaste, aparece el aviso "el origen
  cambió — revisar" y el botón "Mantener mi edición".

## Garantías (ya probadas en el repo, 101+ pruebas)
- No se publica nada en X automáticamente; todo es copiar/pegar manual.
- Regenerar es idempotente: no duplica borradores.
- Nunca se pierden ediciones manuales ni estados (aprobado/descartado/publicado).
- Las efemérides que desaparecen del origen se marcan, no se borran.
- Fechas inválidas y colisiones quedan registradas, no generan borradores erróneos.
