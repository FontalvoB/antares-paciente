# Revisión de entrega: auditoría inglesa

## Estado verificable

El usuario autorizó también el merge/push de la app a `dev` después de
confirmar las traducciones y la corrección de evaluaciones. Se integra
`origin/dev` `483f7df` preservando la nueva orbe de voz; la entrega activa
el workflow iOS/TestFlight. Los checkpoints locales anteriores se conservan
como historial de validación.

**Evaluaciones EN:** servidor corregido en AI `7c0acd0` y desplegado saludable.
Pasan los 22 GET reales de lista/resultados/nueve versiones, con invariantes
clínicos conservados. Nueva app (1.481 tests/183 archivos) instalada. El usuario confirmó carga
correcta de evaluaciones y primera pregunta/opciones inglesas; hallazgo cerrado.
Publicación de la app autorizada; merge y validación de la revisión vigente en curso.

- App: `FontalvoB/antares-paciente`, rama `fix/diomedes-english-app-audit`,
  base inicial `dev` `15b3217`, integrada con `83c8ed9` al pedir el usuario pull
  y build. Build local firmado instalado en `iPhoneです`, apuntando
  a `https://erp.coppadresd.com`; suite completa actual de 1.481 tests/183 archivos aprobados, incluidas
  las regresiones de conversaciones y recuperación de evaluaciones.
  3.675 claves por idioma.
- Backend: `LFDIAZDEV2209/coppAddresdBack`, publicado en `dev`, integrado con
  `daa3619`. 1.883 tests unitarios aprobados, 105 omisiones existentes por
  entorno, cero fallos. Cinco pruebas reales PostgreSQL aisladas aprobadas.
- AI: `LFDIAZDEV2209/ai-service`, auditoría publicada en `dev` `848ab9d`,
  actualmente `7c0acd0` con narrativa y compatibilidad de traducción preservadas.
  350 tests con SDK productivo y Ruff aprobados. Prueba real de traducción con el texto
  reportado y seis campos sintéticos: HTTP200 en 3,515 s.
  Lote máximo revisado de 64 fuentes: HTTP200 en 16,755 s, con 195 fragmentos
  protegidos intactos y repetición desde cache en 0,001 s.

El usuario autorizó publicar AI/backend. AI se publicó como `848ab9d`
(auditoría `2db4b75` más merge de los avances nuevos de nutrición). Después,
`dev` recibió dos arreglos de narrativa de otros autores; el despliegue vigente
`73dbb59` los incluyó junto con la auditoría. La corrección posterior de
evaluaciones `7c0acd0` fijó el contrato de temperatura y las dependencias del
runtime; despliegue vigente saludable (`ai:38`).
Backend `70e8a8a` quedó bloqueado inicialmente en CI: un test leía configuración
privada ausente del checkout. El arreglo `25f5e79` usa el ejemplo versionado sin
secretos y añade recuperación manual de los cuatro servicios. CI pasó
(1.883 principal, 413 Telemedicina, 149 Comunidad; 105/10 omisiones existentes),
las tareas de migración terminaron en cero y los cuatro rollouts COMPLETED 1/1:
Auth95, API100, Telemedicina97, Comunidad82. Todos los commits propios son de
Kenma. En el checkpoint anterior la app permanecía sin commit/push. Los stashes SOS se conservaron por su SHA exacto.
Antes de incorporar `dev` se guardaron copias verificables en
`/tmp/diomedes-english-pre-dev-20261106T151426Z/`. Se conservaron los avances de
nutrición de `dev`; los tres cuerpos Up/Down de migraciones de auditoría no
cambiaron al actualizar sus modelos de destino.

## Qué se entrega

1. Traducciones de interfaz, calendarios, errores, accesibilidad y recursos
   nativos ES/EN; cambio de idioma que conserva borradores, ejercicios y audio.
2. Proyecciones autorizadas de contenido ERP: comidas, instrucciones, podcast,
   ejercicios, evaluaciones, resultados, métricas y catálogos. Traducción interna
   protegida, acotada y cancelable; validación de cantidades/unidades/códigos.
   Sublotes con límite global de cuatro llamadas y plazo total de 28 segundos;
   glosario revisado de dos términos, cache v2 y validación atómica.
3. `NameEn` histórico/futuro de Food AI, procedencia exacta de instrucciones
   nutricionales inglesas, OTP ES/EN y push por idioma del dispositivo.
4. Limpieza de texto técnico de generación en las notas públicas: después de
   aprobar, no se presenta el aviso interno `Propuesta determinista pendiente
   de revisión.` como una indicación para el paciente. Fuentes clínicas,
   aprobación, cantidades, notas específicas y auditoría permanecen intactas.
5. Proyección limitada a `aud=app` con elección explícita en `X-App-Language`
   o query. ERP y clientes antiguos con idioma automático conservan su fuente.

## Comprobación física y límites

El usuario confirmó el popup Bluetooth y los controles observados de cámara/
selector de fotos completamente ingleses (canceló sin seleccionar/subir imagen).
Tras desplegar API/AI y cambiar ES→EN para refrescar, confirmó en Nutrición y su
misión: **“Everything is English; the technical message is gone”**. Pasa el
hallazgo físico reportado de comidas/notas y boilerplate técnico. Evidencia:
`Designs/english-app-audit/native-nutrition-deployed-english-user-report.json`.

La salud pública respondió 200 y el plan sin autenticación devolvió 401; esas
peticiones no certifican contenido clínico. El resultado nutricional proviene
de la observación manual del usuario. El usuario confirmó también la interfaz/instrucciones de voz y cualquier
prompt observado en inglés. Después confirmó controles del share sheet y
mensajes de estado ingleses al abrir/cancelar sin seleccionar app/destinatario.
H59 y R88 conectados pasan: el usuario confirmó todo el texto observado en
inglés para ambos. Permanecen las limitaciones de transporte/proveedores; no se extrapola una prueba a todos los planes.

La pasada residual encontró copia sin `t()` en conversaciones directas/grupales,
el fallback de errores de Comunidad y dos textos alternativos de imágenes. Se
corrigieron manteniendo mensajes/nombres de autor y estado local; una revisión
estática adicional de 293 archivos no encontró otro literal alcanzable confirmado.
La compilación local vigente incluye esas correcciones y recuperación de
evaluaciones: 1.481 tests/183 archivos,
lint, i18n, build/sync de producción, release/BLE, Xcode e instalación USB
aprobaron. Se cotejaron los 38 assets web del bundle instalado con la salida
verificada. Receipt: `Designs/english-app-audit/final-local-english-ios-receipt.json`.

## Orden de entrega autorizado

1. AI: publicado con identidad Kenma y avances nuevos de `dev` preservados.
   [Workflow](https://github.com/LFDIAZDEV2209/ai-service/actions/runs/42251240228)
   aprobado; el [despliegue vigente](https://github.com/LFDIAZDEV2209/ai-service/actions/runs/42276642835)
   incluye la auditoría y los arreglos posteriores, ECS `cooppadresd-ai:38`, COMPLETED 1/1.
2. Backend: publicado con la misma identidad en `dev`. Su
   [workflow de recuperación](https://github.com/LFDIAZDEV2209/coppAddresdBack/actions/runs/42254501943)
   `deploy-backend.yml` exige CI, aplica las migraciones antes de activar API y despliega los cuatro servicios,
   incluido Auth. CI, migraciones previas y los cuatro rollouts aprobaron;
   API `cooppadresd-api:100` llegó a COMPLETED 1/1.
3. Plan releído en el iPhone: usuario confirmó nombres/alimentos/notas ingleses
   y ausencia del mensaje técnico tanto en Nutrición como en la misión. Cámara/galería observadas pasan;
   voz/micrófono y share sheet observados pasan. H59 y R88 conectados observados pasan; la entrega real de proveedores no está certificada.
4. Pasada física de traducciones planificada completada. El usuario autorizó
   publicar la rama de la app; integrar los últimos cambios de `dev` y validar
   antes de actualizar esa rama. Push a `dev`
   activa `ios-testflight.yml`, que genera y sube un build a TestFlight.

Las tres migraciones backend son aditivas: nombre inglés Food AI nullable,
idioma del dispositivo con default `es` y hash de procedencia inglesa nullable.
No hay backfill clínico automático. La autorización posterior del usuario incluye también publicar la app en
`dev`. Las comprobaciones físicas planificadas pasan; el push activa TestFlight
y su resultado debe verificarse por separado de las pruebas locales.

Ante fallo de traducción, el API devuelve 503 recuperable. La app puede conservar
datos confirmados junto al aviso de reintento para proteger borradores; esto no
equivale a certificar que el contenido conservado ya está en inglés. Las fuentes
originales y el estado de aprobación siempre se mantienen.

Detalle de cobertura y límites: [auditoría](./ENGLISH_LOCALIZATION_AUDIT.md).
