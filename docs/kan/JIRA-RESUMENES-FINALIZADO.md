# Jira — resúmenes para Finalizado de Agentic Wellness IA

**Base:** `dev` en `d045955`, 24/11/2026. Cada bloque documenta el alcance entregado en móvil y las condiciones pendientes de producción. Pegar el bloque correspondiente al cumplir su Definition of Done, con la evidencia del SHA efectivamente validado. KAN-136/142 están reabiertas para generación en segundo plano. Los resultados con etiqueta «PR» son históricos. En el corte local, la primera corrida de Vitest tuvo un timeout y la repetición pasó. Detalles y checklist en el [handoff de producción](HANDOFF-PRODUCCION-DIOMEDES.md).

## KAN-136 · Onboarding y objetivo

- **Entrega móvil.** Onboarding por correo con contactos de emergencia, términos versionados y contraseña. Wizard de ocho pasos para objetivo y cuestionario. PAR-Q (7) y NQS (6) validan campos, edad, IMC para déficit y confirmación profesional cuando corresponde. La base integrada muestra una vista previa local y abre Inicio desde su CTA.
- **Código.** `feat/KAN-136-onboarding-objetivo` → `dev`, squash `d696242`. [PR #28](https://github.com/FontalvoB/antares-paciente/pull/28)
- **Gates.** PR: 2043/2043, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2128/2128 en la repetición de Vitest.
- **Evidencia.** `.ai/operations/2026-11-24-kan136/`, `kan136-results.json` y capturas de correo a plan listo e Inicio a 320/390 px. Con API sintética aparece un 401 en consola. [Run iOS 45444106260](https://github.com/FontalvoB/antares-paciente/actions/runs/45444106260)
- **Dependencias y cierre.** Auth real por correo, activación después del pago web, deep link, roles de contacto y consentimiento persistidos. El bloque de reapertura requiere un solo disparo al terminar el cuestionario, Home inmediato y reintento conservando respuestas y envío. Ver KAN-130 y KAN-173.

## KAN-139 · Ejercicio diario y sesión guiada

- **Entrega móvil.** Rutina de cuatro ejercicios con patrón semanal, técnica y variantes, fases, semanas de descarga, adaptación por check-in y próximos desbloqueos. Sesión con temporizador, pausa y reanudación. Al terminar actualiza el paso de Ejercicio y registra la finalización local.
- **Código.** `feat/KAN-139-ejercicio-sesion` → `dev`, squash `b1bcdd8`. [PR #31](https://github.com/FontalvoB/antares-paciente/pull/31)
- **Gates.** PR: 2104/2104, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2128/2128 en la repetición de Vitest.
- **Evidencia.** `.ai/operations/2026-11-24-kan139/`, E2E 320/390 desde Home hasta sesión completada, protocolo 1/5 y cofre 5/5. El JSON evidencia el recorrido y registra 401 de API sintética. [Run iOS 45451786275](https://github.com/FontalvoB/antares-paciente/actions/runs/45451786275)
- **Dependencias y cierre.** Consumir rutina versionada del motor, vincular procedencia del check-in y sincronizar sesiones/completados idempotentes por cuenta. Validar bloqueo de pantalla, vuelta a primer plano, cronómetro y recuperación offline reales en KAN-173.

## KAN-142 · Home del plan de 365 días

- **Entrega móvil.** Nuevo Inicio con día de 365, adherencia, puntos, racha, nivel, progreso del protocolo y accesos a Nutrición, Ejercicio y Vita. Tarjeta de baterías n/7 con progreso opcional. Presenta vista previa cuando falta un plan local.
- **Código.** `feat/KAN-142-home-365` → `dev`, squash `7191040`. [PR #29](https://github.com/FontalvoB/antares-paciente/pull/29)
- **Gates.** PR: 2058/2058, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2128/2128 en la repetición de Vitest.
- **Evidencia.** `.ai/operations/2026-11-24-kan142/`, Home 1/365, 0/5 y baterías 0/7 a 320/390 px; 401 en consola de API sintética. Su run de push fue cancelado y el commit está incluido en el run iOS exitoso de KAN-139. [Run iOS 45451786275](https://github.com/FontalvoB/antares-paciente/actions/runs/45451786275)
- **Dependencias y cierre.** Sustituir datos locales por lecturas del motor, protocolo y baterías. La reapertura exige listo/generando/fallo, progreso por plan, refresco automático, reintento y bandeja con contenido en todos los casos. Ver KAN-130 y KAN-173.

## KAN-143 · Protocolo y cofre

- **Entrega móvil.** Cinco pasos con progreso compartido con Home, registro de ejercicio reducido y check-in emocional. El cofre muestra qué falta, solo abre tras los primeros cuatro pasos y concede puntos/bono una vez por fecha local. El protocolo cambia de día a medianoche.
- **Código.** `feat/KAN-143-protocolo-cofre` → `dev`, squash `b1f43de`. [PR #30](https://github.com/FontalvoB/antares-paciente/pull/30)
- **Gates.** PR: 2070/2070, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2128/2128 en la repetición de Vitest.
- **Evidencia.** `.ai/operations/2026-11-24-kan143/`, capturas del cofre, protocolo completo y Home 5/5 a 320/390 px. JSON con 401 de API sintética. Su run de push fue cancelado y el commit está incluido en el run iOS exitoso de KAN-139. [Run iOS 45451786275](https://github.com/FontalvoB/antares-paciente/actions/runs/45451786275)
- **Dependencias y cierre.** Persistir completados y recompensa por persona y día del programa, con idempotencia, zona horaria y sync tras reconexión. Coordinar vitales KAN-138 y el cierre/bono explícito con KAN-141. Validar cambio de día y duplicados desde dos dispositivos.

## KAN-144 · Cambiar objetivo

- **Entrega móvil.** Perfil → Mi plan → Objetivo. Confirmación, wizard precargado, nueva compuerta PAR-Q/NQS y términos, y resumen de diferencias de objetivo y macros. Conserva fecha de inicio, día N, protocolo e historial. Versiona snapshots y normaliza datos anteriores.
- **Código.** `feat/KAN-144-cambiar-objetivo` → `dev`, squash `cc441ec`. [PR #32](https://github.com/FontalvoB/antares-paciente/pull/32)
- **Gates.** PR: 2116/2116, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2128/2128 en la repetición de Vitest.
- **Evidencia.** Tests de pantalla y estado `wellness-goal.test.tsx` y `goal-change.test.ts`. Falta E2E dedicado y evidencia visual individual en `.ai/operations`. El run de push fue cancelado. [Run del SHA candidato d045955](https://github.com/FontalvoB/antares-paciente/actions/runs/45470320286)
- **Dependencias y cierre.** Guardar versiones en el backend, publicar nueva versión de forma atómica, conservar plan vigente ante fallos y exponer versión al ERP vía KAN-130. Probar día N e historial tras cambio de meta y reintento desde otro dispositivo.

## KAN-145 · Dieta diaria

- **Entrega móvil.** Cuatro comidas con macros, fibra, agua, alternativas acordes con preferencias y modo simplificado. «Lo comí» actualiza el protocolo. La foto usa Food AI y permite corregir los valores antes de confirmar; ofrece entrada manual cuando falla la estimación.
- **Código.** `feat/KAN-145-dieta` → `dev`, squash `d045955`. [PR #33](https://github.com/FontalvoB/antares-paciente/pull/33)
- **Gates.** PR: 2128/2128, TypeScript, oxlint e i18n con 0 faltantes. Base actual: build, oxlint e i18n en exit 0 y 2128/2128 en la repetición de Vitest.
- **Evidencia.** `e2e/wellness-diet.mjs` con PASS 320/390 documentado en el PR, usando auth y análisis simulados. Pendiente evidencia individual en `.ai/operations` con cámara y Food AI reales. [Run del SHA candidato d045955](https://github.com/FontalvoB/antares-paciente/actions/runs/45470320286)
- **Dependencias y cierre.** Publicar menú del motor y sincronizar comidas, agua y progreso por persona, día y versión. Validar autorización del endpoint existente, permiso denegado, recuperación offline y registro actualizado en otro dispositivo.

## KAN-136 + KAN-142 · Generación en segundo plano · EN VUELO

- **Rama.** `feat/KAN-136-142-generacion`. El corte auditado de `dev` contiene la vista previa bloqueante sin job ni bandeja real. Incorporar PR y squash de la reapertura al merge.
- **Contrato funcional.** Al confirmar el cuestionario, guardar respuestas e id de envío, abrir Home inmediatamente y disparar un único evento lógico. Home muestra listo, generando o fallo, progreso por plan, actualización automática y bandeja visible. Reintentar preserva el envío, el job y los artefactos confirmados.
- **Backend.** KAN-130 publica `generate`, estado, `retry` e `inbox`. Coordinar datos y migraciones, motor/outbox e inicialización de bienvenida con KAN-110/134/116 según el handoff.
- **Gates y evidencia pendientes de esta rama.** Repetir build, Vitest, i18n y oxlint sobre su SHA de merge. Actualizar E2E para Home inmediato y cubrir doble toque, dos dispositivos, pérdida de respuesta, reinicio, `422`, `503`, progreso parcial, fallo y reintento sin duplicar artefactos. Adjuntar capturas ES/EN, logs correlacionados y matriz nativa KAN-173 en `.ai/operations`.
- **Paso a Finalizado.** Requiere integración en `dev`, evidencia de los estados con backend, TestFlight del mismo SHA procesado y smoke en dispositivo contra servicios estables. Mantener la reapertura mientras falte esa verificación.
