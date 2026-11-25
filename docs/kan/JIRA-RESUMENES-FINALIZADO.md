# Jira — resúmenes para Finalizado de Agentic Wellness IA

**Base final:** `dev` en `e472af7`, 24/11/2026. Los nueve issues y la generación de KAN-136/142 están integrados. **Todos quedan listos para Finalizado del alcance móvil cuando TestFlight esté verde.** Adjuntar el resultado del run y el número de compilación si aparece. Los gates del PR son históricos. Los gates finales validan el SHA completo. Las dependencias de backend y de dispositivo quedan registradas en sus tareas. [Run TestFlight 45478408297](https://github.com/FontalvoB/antares-paciente/actions/runs/45478408297) · [Handoff de producción](HANDOFF-PRODUCCION-DIOMEDES.md).

**TestFlight al corte.** Run `45478408297` en curso a las 15:19:58 de Bogotá. Pendientes de confirmación la conclusión del run y el número de compilación.

## KAN-136 · Onboarding y objetivo

- **Entrega móvil.** Onboarding por correo con contactos de emergencia, términos versionados y contraseña. Wizard de ocho pasos con compuerta PAR-Q/NQS. Desde el PR #37, el envío válido guarda las respuestas, solicita generación una sola vez y abre Inicio en la misma interacción.
- **Código.** `feat/KAN-136-onboarding-objetivo` → `dev`, squash `d696242`. [PR #28](https://github.com/FontalvoB/antares-paciente/pull/28)
- **Gates.** PR: 2043/2043, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2185/2185 en Vitest.
- **Evidencia.** `.ai/operations/2026-11-24-kan136/`, `kan136-results.json` y capturas de correo a plan listo e Inicio a 320/390 px. Con API sintética aparece un 401 en consola. [Run iOS 45444106260](https://github.com/FontalvoB/antares-paciente/actions/runs/45444106260)
- **Dependencias.** Auth real por correo, activación después del pago web, deep link, roles de contacto y consentimiento persistidos. El bloque de generación registra la entrega móvil y el handoff para KAN-130 y KAN-116.

## KAN-139 · Ejercicio diario y sesión guiada

- **Entrega móvil.** Rutina de cuatro ejercicios con patrón semanal, técnica y variantes, fases, semanas de descarga, adaptación por check-in y próximos desbloqueos. Sesión con temporizador, pausa y reanudación. Al terminar actualiza el paso de Ejercicio y registra la finalización local.
- **Código.** `feat/KAN-139-ejercicio-sesion` → `dev`, squash `b1bcdd8`. [PR #31](https://github.com/FontalvoB/antares-paciente/pull/31)
- **Gates.** PR: 2104/2104, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2185/2185 en Vitest.
- **Evidencia.** `.ai/operations/2026-11-24-kan139/`, E2E 320/390 desde Home hasta sesión completada, protocolo 1/5 y cofre 5/5. El JSON evidencia el recorrido y registra 401 de API sintética. [Run iOS 45451786275](https://github.com/FontalvoB/antares-paciente/actions/runs/45451786275)
- **Dependencias y cierre.** Consumir rutina versionada del motor, vincular procedencia del check-in y sincronizar sesiones/completados idempotentes por cuenta. Validar bloqueo de pantalla, vuelta a primer plano, cronómetro y recuperación offline reales en KAN-173.

## KAN-142 · Home del plan de 365 días

- **Entrega móvil.** Inicio con día de 365, adherencia, puntos, racha, nivel, protocolo y accesos a Nutrición, Ejercicio y Vita. Baterías n/7 opcionales. El PR #37 agrega progreso por plan, fallo/reintento, listo, refresco automático y bandeja visible.
- **Código.** `feat/KAN-142-home-365` → `dev`, squash `7191040`. [PR #29](https://github.com/FontalvoB/antares-paciente/pull/29)
- **Gates.** PR: 2058/2058, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2185/2185 en Vitest.
- **Evidencia.** `.ai/operations/2026-11-24-kan142/`, Home 1/365, 0/5 y baterías 0/7 a 320/390 px; 401 en consola de API sintética. Su run de push fue cancelado y el commit está incluido en el run iOS exitoso de KAN-139. [Run iOS 45451786275](https://github.com/FontalvoB/antares-paciente/actions/runs/45451786275)
- **Dependencias.** Sustituir datos locales por lecturas del motor, protocolo y baterías. Integrar estados y bandeja reales con KAN-130 y validar en KAN-173.

## KAN-143 · Protocolo y cofre

- **Entrega móvil.** Cinco pasos con progreso compartido con Home, registro de ejercicio reducido y check-in emocional. El cofre muestra qué falta, solo abre tras los primeros cuatro pasos y concede puntos/bono una vez por fecha local. El protocolo cambia de día a medianoche.
- **Código.** `feat/KAN-143-protocolo-cofre` → `dev`, squash `b1f43de`. [PR #30](https://github.com/FontalvoB/antares-paciente/pull/30)
- **Gates.** PR: 2070/2070, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2185/2185 en Vitest.
- **Evidencia.** `.ai/operations/2026-11-24-kan143/`, capturas del cofre, protocolo completo y Home 5/5 a 320/390 px. JSON con 401 de API sintética. Su run de push fue cancelado y el commit está incluido en el run iOS exitoso de KAN-139. [Run iOS 45451786275](https://github.com/FontalvoB/antares-paciente/actions/runs/45451786275)
- **Dependencias y cierre.** Persistir completados y recompensa por persona y día del programa, con idempotencia, zona horaria y sync tras reconexión. Coordinar vitales KAN-138 y el cierre/bono explícito con KAN-141. Validar cambio de día y duplicados desde dos dispositivos.

## KAN-144 · Cambiar objetivo

- **Entrega móvil.** Perfil → Mi plan → Objetivo. Confirmación, wizard precargado, nueva compuerta PAR-Q/NQS y términos, y resumen de diferencias de objetivo y macros. Conserva fecha de inicio, día N, protocolo e historial. Versiona snapshots y normaliza datos anteriores.
- **Código.** `feat/KAN-144-cambiar-objetivo` → `dev`, squash `cc441ec`. [PR #32](https://github.com/FontalvoB/antares-paciente/pull/32)
- **Gates.** PR: 2116/2116, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2185/2185 en Vitest.
- **Evidencia.** Tests de pantalla y estado `wellness-goal.test.tsx` y `goal-change.test.ts`. Falta E2E dedicado y evidencia visual individual en `.ai/operations`. El run de push fue cancelado. [Run del SHA final e472af7](https://github.com/FontalvoB/antares-paciente/actions/runs/45478408297)
- **Dependencias y cierre.** Guardar versiones en el backend, publicar nueva versión de forma atómica, conservar plan vigente ante fallos y exponer versión al ERP vía KAN-130. Probar día N e historial tras cambio de meta y reintento desde otro dispositivo.

## KAN-145 · Dieta diaria

- **Entrega móvil.** Cuatro comidas con macros, fibra, agua, alternativas acordes con preferencias y modo simplificado. «Lo comí» actualiza el protocolo. La foto usa Food AI y permite corregir los valores antes de confirmar; ofrece entrada manual cuando falla la estimación.
- **Código.** `feat/KAN-145-dieta` → `dev`, squash `d045955`. [PR #33](https://github.com/FontalvoB/antares-paciente/pull/33)
- **Gates.** PR: 2128/2128, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2185/2185 en Vitest.
- **Evidencia.** `e2e/wellness-diet.mjs` con PASS 320/390 documentado en el PR, usando auth y análisis simulados. Pendiente evidencia individual en `.ai/operations` con cámara y Food AI reales. [Run del SHA final e472af7](https://github.com/FontalvoB/antares-paciente/actions/runs/45478408297)
- **Dependencias y cierre.** Publicar menú del motor y sincronizar comidas, agua y progreso por persona, día y versión. Validar autorización del endpoint existente, permiso denegado, recuperación offline y registro actualizado en otro dispositivo.

## KAN-141 · Cierre del día offline

- **Entrega móvil.** Formulario desde Inicio/protocolo, guardado offline, cola pendiente al reconectar, sincronización simulada y un cierre por cuenta/fecha local. Rechaza fechas futuras y aplica los efectos del día anterior a ejercicio y dieta.
- **Código.** `feat/KAN-141-cerrar-dia` → `dev`, squash `eca5ec4`. [PR #34](https://github.com/FontalvoB/antares-paciente/pull/34)
- **Gates y evidencia.** PR: 2147/2147, TypeScript, oxlint, i18n sin faltantes, build y E2E 320/390. `.ai/operations/2026-11-24-kan146/` contiene formulario, cierre pendiente y sincronización al reconectar. Base final: 2185/2185, build, oxlint e i18n OK.
- **Handoff Diomedes.** Publicar contrato idempotente y sincronización real en KAN-130. Guardar una fila por paciente/membresía/día y entregar efectos versionados de mañana. Probar duplicados entre dos dispositivos, reconexión y fecha futura. KAN-173 cubre zona horaria y offline nativo.

## KAN-137 · SOS global

- **Entrega móvil.** Botón global, capa sobre interfaz y cuenta regresiva de 5 s con llamada de emergencia, contacto o cancelación. Auditoría local de fecha, pantalla y resultado, hasta 50 eventos. El marcador usa 123 en Colombia y 911 en EE. UU. o como fallback. Cancelar evita el envío; el aviso del camino de cuenta regresiva es local.
- **Código.** `feat/KAN-137-sos-global` → `dev`, squash `f591ce3`. [PR #35](https://github.com/FontalvoB/antares-paciente/pull/35)
- **Gates y evidencia.** PR: 2183/2183, TypeScript, oxlint, i18n sin faltantes, build y E2E `e2e/wellness-sos.mjs` a 320/390 con marcador interceptado. Tests `wellness-sos.test.tsx` y `sos-store.test.ts`. Base final: 2185/2185, build, oxlint e i18n OK.
- **Handoff Diomedes.** Preservar REQ-SOS-07. `POST /api/v1/sos/alerts` ocurre tras orbe y confirmación afirmativa. El temporizador abre el marcador. Acordar con Legal el envío automático a contactos y cómo auditar entrega. KAN-173 cubre teclado, segundo plano y vídeo nativo a pantalla completa.

## KAN-146 · Navegación v5.1 y Perfil

- **Entrega móvil.** Barra Inicio · Nutrición · SOS · Ejercicio · Perfil. Perfil centraliza cuenta/avatar, evaluaciones, planes y cambio de objetivo. Los destinos retirados caen en Inicio. Chat IA, clínica, citas, academia, INFINITO, podcast, marketplace, avatar independiente y Programa anterior dejan de exponerse.
- **Código.** `feat/KAN-146-navegacion` → `dev`, squash `d055936`. [PR #36](https://github.com/FontalvoB/antares-paciente/pull/36)
- **Gates y evidencia.** PR: 2175/2175, TypeScript, oxlint, i18n sin faltantes, build y E2E 320/390. `.ai/operations/2026-11-24-kan146/kan146-results.json` y capturas de Nutrición, Ejercicio, Perfil y Objetivo. Base final: 2185/2185, build, oxlint e i18n OK.
- **Handoff Diomedes.** Actualizar destinos de pushes y deep links al mapa v5.1. Comunidad/Medicamentos quedan fuera hasta KAN-135, Apple Health hasta KAN-160, BLE hasta KAN-158 y Citas hasta KAN-174. Validar fallback y rutas restauradas cuando corresponda.

## KAN-136 + KAN-142 · Generación en segundo plano

- **Entrega móvil.** Confirmación válida guarda respuestas, dispara una sola generación local y navega de inmediato a Inicio. Home muestra generando, fallo/reintento y listo. El refresco automático incluye progreso de ejercicio, nutrición y bandeja. Las respuestas y artefactos listos se conservan al reintentar. La bandeja muestra carga, mensajes o texto de estado vacío.
- **Código.** `feat/KAN-136-142-generacion` → `dev`, squash `62889ff`. [PR #37](https://github.com/FontalvoB/antares-paciente/pull/37)
- **Gates y evidencia.** PR y base final: 2185/2185, TypeScript/build, oxlint e i18n sin faltantes. E2E en `.ai/operations/2026-11-24-kan136-142-gen/kan136-results.json`: `generationMs` 1683 a 390 px y 1676 a 320 px, con bandeja fechada. Es el tiempo del mock.
- **Handoff Diomedes.** Publicar operaciones `/v1/wellness`, outbox e idempotencia de envío y reintento. KAN-110 motor, KAN-134 persistencia, KAN-130 API y KAN-116 pago y activación por correo. Verificar concurrencia, `409/422/503`, fallo parcial y reintento entre dispositivos. [Contrato y adaptación](KAN-136-142-handoff-diomedes.md).
