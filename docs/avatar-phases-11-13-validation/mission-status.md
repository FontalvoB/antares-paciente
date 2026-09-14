# Misión 11 → 11.1 → 12 → 13

**Estado confirmado por el usuario: IMPLEMENTADA, PENDIENTE DE VALIDACIÓN DEL CIRCUITO NORMAL DE LOGIN/GATEWAY.** No autorizada la migración ERP ni reinicios que la apliquen. Diagnóstico de solo lectura y alternativas no implementadas: [login-gateway-diagnosis.md](login-gateway-diagnosis.md).

Solicitud vinculante: attachment 1639d35f-d7ab-4620-8cbb-cdb39170aa65. La numeración histórica de docs 17/18 no coincide con estas fases; prevalece la solicitud actual. Ejecución secuencial, sin integración antes de validar Female Body.

- Fase 11: validada; female-checkpoint.json. Primer envío rechazado HTTP 422 sin job; reenvío mínimo aceptado.
- Job: `0d1bd2e1-6b90-4065-a4bb-792820af084a`, `tripo_3d`, 5 créditos reportados, completado. No hubo otra generación.
- Fase 11.1: validada antes de implementar 12; phase11-integration/after.json.
- Fase 12: validada antes de implementar 13; phase12/after.json y female-equipment-checkpoint.json.
- Fase 13: implementada; pruebas HTTP/JWT/PostgreSQL y commit/nueva conexión correctos. Restauración de página con HTTP controlado validada. Pendiente circuito normal login/gateway: el arranque Auth aplicaría una migración ERP ajena pendiente. Ver ../avatar-phases-11-13.md.
- Activos masculinos protegidos. Checkpoint vivo previo en `public/models/avatar/sources/female-v1/before-female-checkpoint.blend`; escena nueva `Female_V1` con proxy de escala, cámaras/luces compartidas sin cambios.
- Skills Blender requeridos leídos; Scene Passport en `sources/female-v1/SCENE-PASSPORT.md`.
- La generación aceptada usó parámetros por defecto del Bridge; los parámetros explícitos del primer intento no se aplicaron.
