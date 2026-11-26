# KAN-132 · Ajustes diarios del Motor 365

Inicio muestra **Por qué cambió tu plan** únicamente cuando el calendario
autenticado devuelve motivos en `why`. La app elige el texto ES/EN apto para
el idioma activo y no vuelve a evaluar las señales de un plan del servidor.
Los motivos no se guardan en la caché persistente del calendario. Una
respuesta compatible sin `why` no muestra la tarjeta.

Nutrición usa el menú del servidor y muestra el recordatorio de cenar más
temprano solo cuando `lighterDinner` está activo. El plan local de
demostración conserva sus reglas anteriores.

La prueba funcional vive en el backend
(`tests/CoppAddresd.Wellness365.E2E/playwright.kan132.config.cjs`).
Cierra un día desde la interfaz, avanza el reloj de Bogotá y abre la app
en otra sesión de navegador para comprobar el cambio de plan.
