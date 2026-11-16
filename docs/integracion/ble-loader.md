# Corrección del loader BLE en instalaciones CRLF

Corrección independiente de Vita, preparada para cherry-pick sobre F2/dev.
No cambia contratos nativos, versión 8.3.0, manifest, hashes aprobados,
`native.patch`, fuentes Swift/Kotlin/XML ni lockfiles.

## Causa y evidencia

El fallo de `npm ci` del árbol `.worktrees/vita-integration-app` se reprodujo en
`.worktrees/vita-app`. Git tiene `core.autocrlf=true`, sin un atributo EOL específico
para el parche. `native.patch` contiene 696 terminadores CRLF. El loader normalizaba
los archivos originales a LF, pero dividía el parche crudo solamente por `\n`.

La ruta leída de `+++ b/ios/Sources/BluetoothLe/Device.swift\r` retenía el CR final.
El manifest contiene `ios/Sources/BluetoothLe/Device.swift`, sin CR. Por eso
`hunks.get(entry.path)` no encontraba ninguna sección y aplicaba una lista vacía.
El hash original era válido; el resultado seguía siendo el original y fallaba
la comparación con `after` en la antigua línea 66. No era un cambio del plugin.

Comprobación sin escribir: usando el mismo algoritmo y normalizando solo la
lectura del parche, los **siete resultados coinciden con los siete hashes after
ya aprobados**. El parche y el manifest, normalizados a LF, son idénticos en
el worktree APP y en el árbol integrado.

| Recurso | SHA-256 LF sin cambios |
| --- | --- |
| native.patch | f79f8ade22ff812888f48ff38dacb0f00c8e0f4357b1d3da83c0e0c0f5dafd4c |
| manifest.json | dd6dce4ac49b973d69a04cac02abff455e92e5515ac058950cbf8041c9c518d0 |
| Device.swift original | 26265ba85d82d32d94bd3ca5cd66e3bfb5b6e5acd8d1ad06bed0c2831ba62ea6 |
| Device.swift parcheado | 5c0929d8d64007e9cb50366021d9475d0e18d1612e1d961fba57071158a03391 |

## Cambio mínimo

`scripts/apply-bluetooth-patches.mjs` aplica su función `normalize` existente al
texto de `native.patch` antes de dividirlo e indexar rutas/hunks. Esto elimina
también los CR de las líneas de contexto. El algoritmo de aplicación, los controles
de versión/contexto/hashes, la validación previa a todas las escrituras y el modo
`--check` permanecen intactos. No se añade fuzzy matching ni dependencia externa.

## Verificación

`src/utils/__tests__/bluetoothPatchLoader.test.ts` ejecuta el loader real como
subproceso, en directorios temporales propios sin enlaces, con un plugin sintético.
Prueba dos hunks separados, LF, CRLF y mezclas entre parche/plugin/manifest;
check sin escrituras, aplicación, recheck e idempotencia byte a byte. También exige
rechazo de resultado/hash no aprobado, contexto cambiado, segundo original
modificado sin escribir el primero, versión distinta y adición nativa alterada.

- Antes del fix: **2 fallos / 7 correctos**; fallan exactamente los dos escenarios
  con parche CRLF, reproduciendo `Resultado inesperado ... Device.swift`.
- Con el fix: **9/9 correctos**.
- `--check` sobre plugin limpio: rechazo esperado, 14 archivos pendientes y sin
  escrituras. Aplicación: exit 0, 14 archivos. Check posterior: exit 0, cero pendientes.
- **`npm ci --no-audit --no-fund` real, sin ignore-scripts: exit 0**. El postinstall
  aplica de nuevo 14 archivos sobre la instalación limpia, plugin 8.3.0.
- Después de reinstalar: `npm run native:ble:check`, reaplicación y check final
  con exit 0. Los 14 archivos conservan sus bytes en la reaplicación; siete hashes
  aprobados y siete adiciones verificadas contra las fuentes del parche.

La suite completa, lint, build e i18n se ejecutan después de esa reinstalación.
Resultado: **209 archivos / 1685 tests correctos, exit 0**; build, lint e i18n
con exit 0 (avisos heredados de lint/chunks; cero traducciones faltantes).
El test declara los tipos Node ya instalados sin cambiar tsconfig/dependencias.
SHA del commit: handoff APP en
`openspec/changes/vita-asistente-integral/handoffs/app.md`, sección loader BLE.

Logs locales ignorados: `.vita-ble-loader-red.log`, `.vita-ble-loader-tests.log`,
`.vita-ble-native-sequence.log`, `.vita-ble-clean-install.log`,
`.vita-ble-all-tests.log`, `.vita-ble-build.log`, `.vita-ble-lint.log`,
`.vita-ble-i18n.log`; resumen de los 14 archivos en
`test-results/ble-loader-verification.json`.

Esta evidencia acredita instalación y aplicación/verificación del código nativo
aprobado. No es compilación Xcode/Gradle ni prueba de Bluetooth físico; esas puertas
siguen correspondiendo al CI/dispositivo del árbol integrado. No hubo push, rebase,
cambios remotos ni intervención en tab1.
