# Preflight de release — merge dba70d1

Resultado final: **tests, lint, build e i18n pasan (exit code 0)** sobre
`dba70d185797643f65075f2727e98e0be2c3db17`. Este documento versiona los
resultados de esa ejecución; su commit posterior sólo añade documentación.

## Merge y conflictos

- Rama: `org/f3-antares-paciente`.
- SHA del merge: `dba70d185797643f65075f2727e98e0be2c3db17`.
- Primer padre, rediseño premium/P4 y e2e 4.11:
  `975559fbe279a405a4e696ec6224067ad972373f`.
- Segundo padre, `origin/dev` obtenido mediante fetch:
  `9da1ce7ddfd933f726b9760c4a86badabfd22d5d`.
- Base común: `8fbb840235afbf45a741f6a9cee55652bcd754d1`.

Comandos de integración ejecutados:

```powershell
git fetch origin
git merge --no-ff --no-commit origin/dev
```

Se resolvieron los cuatro archivos con conflictos y se creó el commit de merge
local. Los ajustes de pruebas se incorporaron mediante amend de ese merge aún
no publicado; ambos padres se conservaron, sin rebase.

| Archivo con conflicto | Resolución |
| --- | --- |
| `src/pages/ChatPage.tsx` | Conserva cabecera premium, estados loading/error/empty y reintentos P4. Integra lector canónico, guardas de usuario/hilo, sincronización con voz, limpieza con confirmación, scroll no intrusivo, composer `IonTextarea` y controles stop/retry de dev. |
| `src/theme/global.css` | Conserva los estilos premium/nutrición y añade los estilos de la acción de limpiar conversación de dev. |
| `src/i18n/es.json` | Merge de tres vías por clave: conserva cambios de ambos padres, sin duplicados; 3999 claves finales. |
| `src/i18n/en.json` | Mismo criterio de tres vías y 3999 claves finales, en paridad con español. |

Además, se extendió el estilo del composer premium a `IonTextarea` en
`src/theme/wellness-premium.css`. Las pruebas de paginación y consolidación se
adaptaron al `AbortSignal` de dev y a selectores de reintento limitados al aviso
correspondiente (historial o borrado).

Verificaciones del merge: ambos padres son ancestros del resultado;
`AppContext.tsx`, `VoiceOverlay.tsx` y `threadApi.ts` son idénticos a dev.
`Screen.tsx`, `BottomNav.tsx`, `variables.css`, `NutritionPage.tsx` y
`ProgramPage.tsx` son idénticos al padre premium.

## Gates finales sobre dba70d1

Ejecución local en Windows, desde `.worktrees/app-f3`, el **2026-11-16 UTC**
(2026-11-15, zona America/New_York). Los cuatro registros identifican el SHA
completo del merge anterior; ninguno terminó por señal.

| Gate y comando | Inicio–fin UTC | Resultado exacto |
| --- | --- | --- |
| `npm test -- --reporter=json --outputFile=C:\Users\Luis\Documents\CoppAddresd\Repos\.worktrees\app-f3\.artifacts\release-preflight\tests.json` | 03:59:39.941–04:00:28.395 | **exit 0**; `success: true`; 1859/1859 tests pasan, 0 fallidos, 0 pendientes; 551/551 suites pasan; 220 archivos de test, todos pasan. |
| `npm run lint` | 04:00:28.397–04:00:28.974 | **exit 0**; `oxlint`; 27 warnings, sin errores de lint. |
| `npm run build` | 04:00:28.975–04:01:04.241 | **exit 0**; `tsc -b && vite build`; Vite 8.2.1 genera producción en `dist/`, 1806 módulos transformados. |
| `npm run i18n:check` | 04:01:04.242–04:01:05.068 | **exit 0**; 1854 llamadas `t()`, 3999 claves en `en.json`, **0 faltantes**, 2145 claves huérfanas según el escáner. |

Los gates verdes incluyen diagnósticos que deben distinguirse de los resultados:

- Tests: el log contiene cinco grupos `AggregateError` con `ECONNREFUSED` a
  `::1:3000` y `127.0.0.1:3000`. El reporte JSON confirma 0 tests/suites fallidos
  y `success: true`; esto no acredita disponibilidad de ese servicio.
- Lint: warnings de Fast Refresh (`only-export-components`), dependencias de
  hooks, variables sin uso y una expresión regular con carácter de control.
- Build: warning por chunks mayores de 1300 kB tras minificar; el chunk principal
  JS mide 2664.11 kB (gzip 813.52 kB).
- i18n: las 2145 claves huérfanas son el inventario informado por el escáner;
  no hay claves faltantes que bloqueen este gate.

## Fallos intermedios corregidos

La primera ejecución completa pasó 1857/1859 tests y falló en dos pruebas de
`chatConsolidation.test.tsx`: `Reintentar`/`Retry` coincidían con el estado de
error del historial y con el aviso de borrado. Se limitaron los selectores al
`alertdialog` de borrado. En la siguiente ejecución pasaron los 1859 tests, pero
TypeScript rechazó la opción `exact` de `getByRole`; se retiró esa opción.

Tras esas correcciones se repitieron **los cuatro gates completos** sobre
`dba70d185797643f65075f2727e98e0be2c3db17`, con los resultados finales de la tabla.
Este documento no cambia código de producto ni pruebas y no requiere otra
ejecución para describir ese mismo SHA.

## Evidencia y trazabilidad

Artefactos originales locales en `.artifacts/release-preflight/` (directorio
ignorado por Git). Estos hashes SHA-256 fijan los resultados utilizados para
este registro versionado:

| Artefacto | SHA-256 |
| --- | --- |
| `gates.json` | `1cbe95bed7304ac9fe8f429879e67c37a8da6611620ea01be92859f793bb43ec` |
| `tests.json` | `0d9ab1fbec531e144dc7f63b4a318e0ee7c7de4a75d92160f835257f4a60d761` |
| `tests.log` | `4e20050cbdf67ed0dcfdd6ad2369ff5f13a18a9bc8f7dec2af575943105adec4` |
| `lint.log` | `d629f5cb221f587de2e07b54bdd64ff6c67ad2178a2b401e2a43e788ac148753` |
| `build.log` | `a2c37aa4c2613a241f9a969788fb0a06c7a2467d6a80cfb671b13b46258a33ee` |
| `i18n.log` | `1685a297700d0ea584ff3972e20526712b5bec66b601faf5c6ad608bd727e8a3` |

También se preservó un paquete local compartido en
`openspec/changes/organizar-experiencia-bienestar/revision-app-release-preflight/merge-dba70d1/`
(relativo a la raíz del workspace `Repos`, fuera de este repositorio app):
manifest, padres del merge, resoluciones, logs, resumen JSON, patch de resolución
y 18 capturas del chat integrado.

La revisión visual pasó 6 casos (ES/EN × 320/390/1440 px), con safe-area simulada
20/34 px, movimiento reducido, controles de al menos 44 px y separación entre
composer y SOS. No hubo overflow, errores JS ni escrituras clínicas en ese
harness. Se ejecutó antes del último amend, cuya única diferencia fueron los
selectores del test de consolidación. Se cerró el preview propio; no se
modificaron servicios compartidos.

Al cerrar el preflight, el árbol de app estaba limpio y la referencia remota de
la rama seguía en `715fd4042536e6badf5bec985fefbe131e8d2ad5`. No se ejecutó push,
no se modificó ningún `tasks.md` y no se desplegó a TestFlight.
