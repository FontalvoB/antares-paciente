# QA web contra producción: proxy de Vite

Comando desde `antares-paciente`:

```bash
VITE_GATEWAY_BASE_URL=https://erp.coppadresd.com npm run dev
```

En web de desarrollo, los helpers de API/Auth/GraphQL usan rutas relativas.
Vite reenvía las solicitudes al gateway indicado por la variable, evitando
peticiones cross-origin desde el navegador. Las suscripciones usan el host
actual con `ws:`/`wss:` y el proxy WS específico precede los prefijos HTTP.

El cambio conserva la conexión directa al gateway en builds de producción y
en Capacitor. No desactiva CORS del backend ni protecciones del navegador.
Al cambiar `vite.config.ts` o el destino del gateway, reiniciar el dev server.

Validación 2026-10-07:

- Ocho tests de URLs y refresh/logout por aplicación: pasan.
- Build de producción: pasa.
- Lint: sin errores, con warnings existentes.
- Computer use: login con la cuenta de prueba original completa el acceso;
  inicio, citas, disponibilidad y confirmación de booking cargan; no se
  guardó una cita nueva. La comunidad carga publicaciones reales.
- La sesión se restaura tras recargar; la reacción sobre un post propio
  cambió de 0 a 1 y volvió a 0 al retirarla (limpieza comprobada).

La validación completa de módulos y sincronización ERP↔app sigue pendiente.
