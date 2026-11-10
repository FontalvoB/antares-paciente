# Vita: educación, registros verificables y planes aprobados

La primera publicación define a Vita como apoyo para educación general en salud
y seguimiento de planes aprobados por el equipo. Este cambio no constituye una
declaración regulatoria ni certifica la exactitud clínica de H59/R88.

## Comportamiento del móvil

- Se elimina `botReply`: un fallo del chat no crea citas, valores, metas ni
  recomendaciones clínicas de ejemplo. Se conserva el mensaje del paciente y
  aparece un aviso localizado de indisponibilidad. Una respuesta parcial que
  no termina se retira; no se reejecutan herramientas automáticamente después
  de haber recibido tokens. El flujo bloqueante sigue recuperando respuestas
  reales cuando el stream falla antes de emitir texto.
- Una respuesta vacía se trata como fallo. Los avisos locales se identifican
  como `service-error`, sin `executionId` ni feedback de respuesta del modelo.
  El cambio de cuenta no puede insertar un aviso tardío de la sesión anterior.
- Chat explica el alcance educativo y ofrece una acción de hábitos. Los
  resultados conservan las puntuaciones y etiquetas registradas, atribuyendo
  estas últimas al cuestionario; el móvil no las vuelve a calcular ni las
  presenta como una nueva conclusión de Vita. La validez y finalidad de cada
  instrumento sigue requiriendo documentación clínica del responsable.
- Las mediciones conservan valores, procedencia y antigüedad. Se eliminan las
  etiquetas clínicas locales Alto/Bajo/En rango y las formas sintéticas tipo
  ECG. Las ilustraciones son decorativas; no cambian los comandos Bluetooth,
  las muestras ni los planes. Ver `WEARABLE_NEUTRAL_PRESENTATION.md`.

## Archivos de laboratorio

La API conserva el original y la extracción como candidatos pendientes de
verificación. El móvil no afirma que se hayan guardado nuevas mediciones ni que
se haya completado un control. No presenta una narración clínica de un servidor
antiguo como si fuera verificación del original.

Historia clínica incorpora **Mis documentos** mediante los componentes Ionic
existentes, con estados de carga, vacío, error y paginación. La identidad procede
de la sesión: el móvil no envía `patientId` a esos endpoints.

```
GET /api/v1/me/documents?page=1&pageSize=20
GET /api/v1/me/documents/{id}/download
```

El segundo endpoint emite un enlace temporal solamente después de comprobar
propiedad. El original se abre con `Browser.open` tras un toque explícito. Las
firmas no se persisten; errores de acceso no provocan un fallback a otra ruta.
Las consultas se aíslan por cuenta y una firma tardía de otra sesión no se abre.
El listado muestra archivos disponibles, no una aprobación clínica de su contenido.

El equipo usa el original y el registro profesional existente para verificar los
datos cuando corresponda. No se implementó una cola de revisión ni se promete
una notificación automática. El historial previo no se borra ni se marca como
verificado retroactivamente. Una comparación numérica no demuestra beneficio.

## Despliegue coordinado y evidencia pendiente

Primero deben desplegarse la API compatible y el servicio IA con el mismo alcance.
La caché de explicaciones usa `guidance-v3-patient-education:` para no recuperar
textos generados bajo la política anterior. Los documentos originales/candidatos
usan el espacio protegido `documents/{patientId}/{documentId}/`; no se habilita
su firma, lectura ni escritura mediante rutas genéricas de almacenamiento.

La voz sigue solicitando el idioma y entregando solo `signedUrl` al SDK, sin
overrides. El servidor verifica versiones y herramientas aprobadas. Requiere
configuración y revisión reales ES/EN descritas en el repositorio IA
`docs/VITA_PATIENT_SCOPE.md`; su ausencia produce indisponibilidad, no una sesión
con instrucciones clínicas antiguas. El modo voz del dispositivo conserva su
autorización explícita y utiliza el mismo chat acotado.

Antes de publicar quedan la configuración y prueba real de voz/modelos, un build
firmado final, comprobación nativa de originales/permisos y capturas actualizadas,
documentación de hardware/instrumentos, política oficial y determinación de la
empresa. Las pruebas locales no demuestran cumplimiento universal del LLM,
exactitud OCR, seguridad de la configuración AWS desplegada ni aprobación de Apple.
