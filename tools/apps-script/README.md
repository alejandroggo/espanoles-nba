# EFEMERIDES · identificadores estables (Fase 3A)

Código **para pegar** en tu proyecto de Google Apps Script (el que exporta
`data.json`). No se ejecuta desde este repositorio. Es **aditivo** y seguro para
la web pública: `app.js` nunca lee el campo `id` de las efemérides, así que
añadir la columna no cambia el comportamiento del sitio.

- `efemerides-ids.gs` — funciones a añadir al proyecto de Apps Script.
- Espejo verificable en Node (con pruebas): `../efemerides-id-backfill.mjs`,
  `../../test/efemerides-id-backfill.test.mjs`.

## Qué hace
1. **Columna `id`**: la añade *al final* de `EFEMERIDES` si no existe. No renombra
   ni reordena columnas.
2. **Asignación**: a cada fila **válida** (con `fecha`, `jugador` y `hito`) que
   tenga el `id` vacío le escribe un `Utilities.getUuid()` en la propia hoja.
   **Nunca** toca un `id` que ya exista.
3. **Validación (gate)**: antes de exportar comprueba que toda fila válida tenga
   `id` y que no haya `id` duplicados. Si los hay (p. ej. una fila copiada),
   **detiene la exportación** y lista las filas a revisar. No corrige nada solo.

Como `getEfemerides()` construye los objetos a partir de las cabeceras, el nuevo
campo `id` viaja automáticamente a `data.json`.

## Integración (una línea en tu exportador)
En tu función de exportación, **antes** de `getEfemerides()` / de construir
`data.json`, añade:

```js
function exportarData() {            // <-- tu función existente (nombre a modo de ejemplo)
  prepararEfemeridesIds_();          // 1) asegura columna, 2) asigna ids, 3) valida (lanza si hay que revisar)
  // ... tu código actual: getEfemerides(), armar data.json, publicar ...
}
```

Si `prepararEfemeridesIds_()` lanza, la exportación se corta antes de tocar
`data.json`: resuelve las filas señaladas y vuelve a ejecutar.

## Migración (qué tienes que hacer tú, paso a paso)
> No ejecutes nada de esto sobre datos reales hasta que lo hayamos validado juntos.

1. **Copia de seguridad**: duplica la hoja de cálculo (Archivo → Hacer una copia)
   o la pestaña `EFEMERIDES`. Es la red de seguridad (reversible).
2. **Pega el código**: copia `efemerides-ids.gs` en el editor de Apps Script del
   proyecto que ya exporta `data.json`.
3. **Ensayo en una COPIA** (recomendado): sobre la hoja duplicada, ejecuta
   manualmente `prepararEfemeridesIds_()` desde el editor. Revisa que:
   - aparece una columna `id` al final con un UUID por fila válida,
   - las filas incompletas (sin fecha/jugador/hito) quedan sin `id`,
   - no se ha modificado ninguna otra columna.
4. **Backfill real** (con tu visto bueno): ejecuta `prepararEfemeridesIds_()` una
   vez sobre la hoja real. Las 86 filas existentes reciben su UUID. Si salta el
   gate por duplicados, revisa a mano las filas indicadas (normalmente filas
   copiadas) y repite.
5. **Integra** la llamada en tu exportador (sección anterior) para que las filas
   nuevas reciban `id` automáticamente en cada exportación.

## Verificación
- Exporta a `data.json` (en tu flujo habitual, cuando autorices) y comprueba que
  cada efeméride trae `id`.
- Repite la exportación sin editar la hoja: los `id` **no cambian**.
- Añade una fila nueva dejando `id` vacío y exporta: recibe un `id` nuevo y el
  resto queda intacto.

## Notas de diseño
- El `id` es **opaco** (UUID): no depende del número de fila ni del orden; viaja
  en la celda, así que ordenar o insertar filas no lo altera.
- **Copiar una fila** arrastra su `id` → el gate lo detecta como duplicado y
  obliga a revisión (no se corrige solo).
- El trigger automático al editar una celda **no** se activa en esta fase (solo
  en la exportación), según lo pedido.
