> Restauración de TestFlight solicitada por el propietario: la exigencia de
> documentos está desactivada por defecto. `VITE_ENFORCE_LEGAL_CONSENTS=true`
> la reactiva al compilar. Las pruebas mantienen este valor explícito para
> conservar cobertura del proceso legal. Desactivarlo no registra aceptaciones
> ni elimina identidad, cancelación o controles de acceso. Los flujos normales
> FoodAI/chat/voz/laboratorios/programa pueden continuar sin abrir el modal legal.

# Autorizaciones versionadas en la app

Esta preparación no publica documentos ni habilita proveedores. La política
oficial y los documentos/proveedores aprobados siguen pendientes de la empresa.
No se debe enviar una nueva versión a revisión hasta completar esa publicación
y la validación del despliegue correspondiente.

`src/utils/legalConsents.ts` consume el contrato autenticado del backend:

- `GET /api/v1/me/legal-consents?locale=es|en`, sin caché.
- `POST /api/v1/me/legal-consents/acceptances`, con alcance, versión,
  idioma, disclosure y UUID de idempotencia de la decisión.
- `DELETE /api/v1/me/legal-consents/acceptances/{receiptId}`, para el recibo propio.

El POST siempre termina con otro GET. La app exige que el recibo actual acepte
exactamente la versión y el disclosure mostrados. Un cambio exige presentar otra
vez el documento con la casilla desmarcada. Un reintento de la misma decisión
conserva su UUID. Los recibos retirados o históricos no autorizan otra petición.

`LegalConsentProvider` muestra un modal Ionic reutilizable: documento y lista de
proveedores servidos por el backend, como texto escapado; aceptación explícita,
cancelación y reintento. No ejecuta HTML del CMS, inventa proveedores ni sustituye
un documento legal por una traducción de la app. Los documentos deben estar
publicados en el idioma elegido.

## Entradas protegidas

| Entrada | Alcance |
| --- | --- |
| Chat, stream y feedback | `chat` |
| URL firmada, SDK de voz, herramientas y mensajes del SDK | `voice` |
| Alternativa de voz del dispositivo + chat, tras elección explícita | `voice` y `chat` |
| Foto de alimentos, antes de multipart | `food` |
| Examen de laboratorio, antes de multipart | `lab` |
| Generación del análisis de evaluaciones | `patient-ai` |
| Paso de autorización del onboarding y comprobación previa a guardarlo | `program` |

FoodAI ahora envía el Bearer vigente después de comprobar la autorización. Las
lecturas de historial y resultados guardados conservan su ruta de lectura. La
entrada de una cuenta ya inscrita no exige aceptar IA ni documentos inexistentes.
Las llamadas de emergencia y el aviso GPS existente no pasan por este modal.

Perfil → Cuenta y preferencias → **Autorizaciones y privacidad** permite revisar
los alcances del servidor, autorizar el análisis/los planes con `patient-ai` y
retirar un recibo propio, incluso cuando su documento actual no está disponible.
El enlace separado **Política de privacidad** conserva la URL registrada en
App Store Connect; ese enlace no prueba que el documento sea el definitivo.

Un rechazo tipado de consentimiento, una cancelación o un fallo de comprobación
detienen la petición. No inician otro motor ni un reintento de chat bloqueante.
La voz del dispositivo requiere una elección adicional; no se activa en silencio
si falla ElevenLabs. Retirar voz/chat o cambiar de cuenta cierra el micrófono y
la sesión del SDK. Una comprobación periódica y al volver a primer plano también
cierra la sesión si ya no puede confirmarse la autorización.

El servidor sigue siendo la autoridad y debe desplegar sus filtros y controles
de salida junto con este cliente. Los flujos de voz ya emitidos por un proveedor
no tienen una promesa de revocación remota inmediata; tampoco se promete borrar
datos ya procesados al retirar un recibo.

## Validación sin pacientes ni proveedores

Las pruebas usan documentos sintéticos y transportes simulados. Cubren cancelar
sin subir archivos/abrir micrófono, ausencia de documentos, cambio de versión o
proveedores, idioma sin documento, recibo retirado, autorización separada
`patient-ai`, autenticación FoodAI y rechazo de fallbacks.

```sh
npm test -- src/utils/__tests__/legalConsents.test.ts src/context/__tests__/LegalConsentContext.test.tsx src/context/__tests__/chatConsolidation.test.tsx src/components/__tests__/VoiceOverlay.test.tsx src/pages/__tests__/OnboardingPage.test.tsx
```

Antes de publicar: probar el modal Ionic y su foco/scroll en iOS/Android,
documentos largos ES/EN, cancelación, nueva versión, retirada durante voz y
retorno a primer plano. Esta tarea no ejecuta aceptaciones ni peticiones reales
a proveedores o datos de producción.

## Identidad y cancelación durante esperas

Las decisiones legales envían `expectedUserId` a `apiFetch`: una respuesta o
reintento 401 nunca transfiere la aceptación de A a una sesión B. Un refresh
anterior tampoco puede sobrescribir o borrar el token de un login posterior.
FoodAI verifica el propietario tanto después del consentimiento como después del
refresh antes de enviar la foto. Chat, laboratorio y voz conservan esa identidad.

Las herramientas y mensajes de voz capturan la generación, identidad y señal de
cancelación de su sesión. Tras cada espera, la sesión debe seguir vigente antes
de consultar o ejecutar una acción; los resultados antiguos no se entregan al
SDK nuevo. El contexto de paciente se consulta para cada acción y no se comparte
entre cuentas. El cierre del modal legal es idempotente y está ligado a su
presentación: un `onDidDismiss` tardío no cancela la siguiente petición autorizada.
