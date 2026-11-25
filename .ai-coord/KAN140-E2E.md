# KAN-140 · E2E adaptado al Home rediseñado (KAN-121)

**ESTADO DONE** · 2026-11-25 · worktree `.worktrees/kan140`, rama `feat/KAN-140-anio-365` (incluye `origin/dev` con KAN-121). Sin commit ni push. Único fichero modificado: `e2e/wellness-year.mjs`. No se tocó código de la aplicación.

## Causa del fallo

La línea 180 buscaba `button "Perfil"` exacto en la barra inferior. El Home nuevo (`WellnessFrame` + `useWellnessOverview`) se renderiza con `hideNav`: no hay barra inferior. Perfil se alcanza desde el menú de opciones (`IonPopover`) de `WellnessFrame`.

## Cambios en el script

| Flujo anterior | Equivalente actual |
| --- | --- |
| Inicio → botón "Abrir Año 365" | Sin cambio: la tarjeta "Año 365" sigue en el Home nuevo, bajo `.wh-task-list`. |
| Año 365 → "Volver a Inicio" | Sin cambio. Se añade la comprobación de que `.wh-task-list` (Home nuevo) es visible. |
| Pestaña "Perfil" de la barra inferior | Menú "Más opciones" (cabecera, 44 px) → ítem "Perfil" → fila "Año 365" de Perfil. |
| — | "Accesos rápidos" (`.wh-add`) se abre y se comprueba que el menú contiene "Perfil". Después se cierra con Escape. |

Comprobaciones añadidas (ninguna se eliminó ni se relajó): botón "Más opciones" e ítem "Perfil" ≥ 44×44 px, fila "Año 365" de Perfil ≥ 44 px de alto, ausencia de overflow horizontal tras volver a Año 365 desde Perfil y cierre del popover tras la selección. Diccionario EN: `Accesos rápidos → Quick actions` y `Más opciones → More options`.

Se mantienen todas las comprobaciones previas: 365 fechas, estados completado, parcial, sin datos y futuro sin datos inventados, resumen mensual (70 %, 75 %, racha, deltas), curvas con descripción accesible, marcador e hito, filtros 7, 30 y 90 y por mes, estados vacíos de enero de 2027, unidades lb/in a 390 px y kg/cm en el resto, teclado (salto al calendario y flechas), árbol accesible por roles, cero overflow, texto sin recorte, contraste AA de celdas, filtros ≥ 44 px y cero errores de consola. Viewports 320, 390 y 768 en es y en.

## Hallazgo fuera de alcance (código de app, no tocado)

`.wh-add` ("Accesos rápidos") mide **38×38 px** en los 6 casos (`wellness-home.css:57` y `:118`), por debajo de 44 px. Por eso el script no lo usa como ruta hacia Perfil: usa "Más opciones", que cumple. El tamaño se registra en la salida (`INFO .wh-add …`). Corresponde a KAN-121 o a un ticket nuevo.

## Gates

| Comando | Resultado |
| --- | --- |
| `COP_E2E_BROWSER_CHANNEL=chrome node e2e/wellness-year.mjs` | OK, salida 0. 6/6 PASS: 320, 390 y 768 en ES y EN. |
| `npm run build` | OK. tsc + Vite, con el aviso preexistente de tamaño de chunk. |
| `npx oxlint` | OK. 0 errores, 29 avisos preexistentes. `e2e/wellness-year.mjs` sin avisos. |
| `git diff --check` | OK. |

Capturas en `C:/Users/Luis/Documents/CoppAddresd/Repos/.ai/operations/2026-11-25-ola4/kan140` (`kan140-year-*`, `kan140-calendar-*`).

## Procesos

Vite: `npm run dev -- --port 5183 --host 127.0.0.1 --strictPort` lanzado con `Start-Process -WindowStyle Hidden` (PID raíz 20244). Antes de cerrar se verificó que el listener PID 55744 (`vite.js … --port 5183`, ruta del worktree) pertenecía al árbol de 20244. Se cerraron los PID 55744, 37116, 50032, 49636 y 20244, y el puerto 5183 quedó libre. Chrome se cerró con `browser.close()` en el `finally`.
