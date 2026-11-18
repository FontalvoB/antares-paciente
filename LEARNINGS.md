# Memoria del worktree de preparación de publicación

## 2026-11-10 — Fallos de Vita y documentos originales

El antiguo `botReply` llegaba a release y devolvía citas/valores fijos tras fallos.
No reintroducir consejos ni datos de ejemplo como fallback: usar indisponibilidad
localizada y descartar streams incompletos. La voz del dispositivo comparte ese chat.
Los documentos usan `/me/documents`: `user.id` identifica una cuenta, no necesariamente
su perfil de paciente. La API resuelve la propiedad y la UI cancela aperturas tardías.
Las clasificaciones de cuestionarios conservan su fuente; no equivalen a una nueva
conclusión clínica de Vita ni a evidencia de validación del instrumento.

## 18/11/2026 — H59 y recuperación de medidas

- Comparar FC u16 en décimas antes de redondear: 72.1 y 72.4 deben contar como distintas aunque se vean como 72.
- El primer u16 puede ser eco: durante FC manual no reemplazar la lectura confirmada hasta observar variación cruda.
- Cerrar un fallo debe limpiar la cola; callbacks y escrituras tardías se aíslan por generación de intento.
