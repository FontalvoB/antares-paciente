# Cambios asignados a Diomedes

La entrega cubre los 13 puntos marcados con Diomedes, incluidos los compartidos.
Los cambios previos de Bluetooth, SOS e idioma se conservan.

| # | Solicitud | Implementación |
|---|---|---|
| 1 | Sin seguro primero y por defecto | El formulario ofrece «Sin seguro» primero; persiste la ausencia de asegurador explícitamente y conserva una póliza existente al editar otros datos. |
| 2 | Dos contactos de emergencia | Principal obligatorio y respaldo opcional, ambos editables y persistidos. SOS guarda ambos destinatarios y solicita SMS, llamada y correo para cada uno; un fallo del principal no bloquea al respaldo. |
| 3 | Consentimiento al final del texto | La aceptación y la continuación requieren llegar al final del documento real; cambiar el documento reinicia la comprobación. |
| 4 | Traducciones y carga de baterías | Se completó ES/EN del contenido inicial sembrado, con skeleton y estado de guardado Ionic. |
| 5 | Análisis de mi perfil | Vita genera una explicación con IA de resultados reales, prioridades, acciones sencillas y preguntas para el equipo; la API conserva el análisis por revisión de resultados e idioma. |
| 6 | IA, revisión, trazabilidad y 30 días | Generación durable después de completar las baterías, revisión de nutrición y publicación de la versión aprobada. La app muestra día y fechas del ciclo. |
| 7 | Aprobación individual y masiva | ERP permite revisar, confirmar y aprobar versiones concretas, con alcance por paciente, control de concurrencia e historial de decisiones. |
| 8 | Plan nutricional y merienda | Acceso visible a desayuno, almuerzo, merienda y cena antes de las metas; cada acceso lleva a su prescripción. Menú por día y ciclo de 30 días. |
| 9 | Ejercicios y multimedia ERP/app | Editor ERP con imagen/video configurados por ejercicio; la estación actual muestra el reproductor pausado desde el inicio y conserva un detalle con las indicaciones reales. |
| 10 | Nutracéutico | Día del programa destacado, foto de referencia, contraste, progreso y opción de preparar una publicación editable. Solo se ofrece compartir una toma confirmada. |
| 11 | Evaluación emocional y sueño | Guarda ánimo, barrera, estrés/motivación contestados, sueño y notas. Ofrece el registro de sueño de un wearable real con fecha de despertar de hoy; la corrección manual cambia el origen. |
| 12 | Pregunta duplicada | Una sola acción de registro en el protocolo. La sección semanal queda como resumen de constancia. |
| 13 | Recordatorio diario | Aviso «Tu salud te espera» en Inicio con actividades pendientes, una vez por inscripción y fecha local. Respeta llamada SOS, voz, consulta, visibilidad y sesiones sin datos reales. |

## Datos y sesiones

- Las respuestas no contestadas de estrés/motivación se omiten; el slider no
  convierte su posición inicial en una respuesta clínica.
- Una marca optimista o una escritura en cola no equivale a confirmación del
  servidor. Nutracéutico y evaluación emocional muestran la sincronización
  pendiente; compartir no publica automáticamente.
- Cambiar de cuenta, cerrar sesión o invalidarla limpia las caches clínicas y
  del programa. El borrador de comunidad vive en memoria, caduca y solo lo
  consume la misma cuenta.
- El estado y el día del plan se actualizan mientras está abierto. El menú
  semanal se repite dentro del ciclo de 30 días según el día del servidor.
- Un estado de revisión o caducidad oculta inmediatamente el menú de cache.
  La revisión del menú debe coincidir con la aprobada; una versión antigua
  espera la descarga de las indicaciones vigentes.

## Verificación

Resultado final de la entrega (04/11/2026):

- App: **1188 pruebas aprobadas**. Permanece un fallo anterior en
  `NotificationsModal.test.tsx`, cuya expectativa «Esta semana» depende del
  día de ejecución; no corresponde a los cambios de esta entrega.
- Backend: 291 pruebas focalizadas y 93 de multimedia aprobadas. El contrato
  nutricional con la revisión de cache se comprobó nuevamente con 35 pruebas.
- PostgreSQL aislado: 12 escenarios del flujo nutricional, 7 de multimedia y
  la persistencia de la evaluación emocional aprobados.
- ERP: 4 recorridos de revisión/aprobación y 3 de ejercicios aprobados.
  La compilación normal de producción genera las 89 páginas. Las tipografías
  existentes se sirven localmente, con licencias y procedencia en
  `coppaddresd-front/app/fonts/README.md`.
- Servicio IA: 15 pruebas del contrato y validación Ruff aprobadas.
- Builds de app y backend, traducciones ES/EN y APK Android aprobados. El APK
  se reconstruyó el 04/11 y sus chunks JS/CSS coinciden con `dist`.

Las pruebas usan pacientes, mensajes y multimedia de prueba. Se verifican
formularios, consentimiento, resultados, estados, ejercicios, dieta y protocolo
con Ionic real a 375 px (ES), 430 px (EN) y 1024 px. Los escenarios ERP simulan
las APIs. No se envían publicaciones, avisos ni planes a pacientes reales.

Comandos relevantes:

```sh
npm test
npm run i18n:check
npm run lint
npm run build
node .artifacts/forms-qa/verify.mjs
node .artifacts/diomedes-protocol-qa.mjs
```

Los arneses y capturas históricos se generaron con datos ficticios. Las nuevas
revisiones y su evidencia se guardan exclusivamente en directorios temporales
fuera de los repositorios; no forman parte del bundle de producción. Las pruebas del backend incluyen
PostgreSQL local aislado y un contrato de IA simulado, además de pruebas
unitarias de autorización, revisión, contactos, multimedia y evaluación emocional.

## Activación en un entorno

La entrega modifica app, ERP, API, Auth y servicio IA. Se deben desplegar juntos
según el runbook del flujo nutricional y aplicar la migración
`AddNutritionReviewWorkflowAndEmergencyContacts` antes de activar la API nueva.
La migración amplía `emergency_contact` a texto y agrega la persistencia de
generación/revisión; no borra los menús existentes ni inventa aprobaciones.

Asignar a los revisores reales el rol **NutritionReviewer**, acceso ERP y el
alcance profesional de sus pacientes. Actualizar la sesión para cargar los
permisos nuevos. Los planes personales previos requieren revisión explícita;
el historial registra al actor y la fecha de cada decisión o modificación.

Para probar en hardware, compilar y sincronizar Capacitor con `npm run sync`.
El build iOS requiere macOS/Xcode. Las pruebas automáticas de IA validan el
contrato y las transiciones; el contenido nutricional generado sigue pasando
por la revisión del profesional antes de publicarse.


## Refinamientos y verificación integrada (4 de noviembre de 2026)

Los resultados anteriores son históricos, no el resultado de una nueva ejecución
completa. Esta revisión añadió:

- SOS: instantánea durable por contacto con estados independientes por canal,
  outbox e idempotencia por destinatario. La app muestra principal y respaldo
  por separado. Se solicita llamada automática al proveedor para ambos; abrir
  el marcador del teléfono sigue siendo una acción manual. Aceptación del
  proveedor no significa llamada contestada ni SMS entregado.
- Consentimiento: recorrido de navegador con 80 secciones sintéticas. Inicio
  y mitad mantienen las tres aceptaciones bloqueadas; llegar al final permite
  marcarlas y Continuar exige las tres. Esto no acredita una aceptación legal
  persistida de un paciente.
- Perfil: petición real app → API → IA con explicación humana, hasta tres
  prioridades y acciones enlazadas a códigos de resultados. El análisis se
  conserva en PostgreSQL por revisión e idioma. No se fabrica texto si falla
  el proveedor. Nuevos resultados invalidan el análisis anterior.
- Preparación nutricional: etapas, revisión profesional, duración y acciones
  útiles mientras la dieta está pendiente. Una plantilla histórica sin revisión
  no cuenta como un ciclo personalizado aprobado ni impide generar/publicar
  el nuevo plan. Guardar el editor ERP cierra el diálogo solo tras éxito.
- ERP: prueba sin interceptar APIs, con Auth, backend y una copia aislada de
  PostgreSQL. Edición de una merienda del borrador real generado por IA;
  aprobación individual; nueva edición que revoca la aprobación; aprobación
  masiva exitosa de dos versiones. Se comprobaron las dos filas directamente
  en PostgreSQL y el actor/fecha del historial.
- Chat: orientación práctica ante síntomas leves, opciones genéricas sin receta
  cuando hay información suficiente, instrucciones del producto en lugar de
  pautas numéricas, precauciones y seguimiento por persistencia/empeoramiento.
  Conserva atención urgente para señales de alarma. Cuatro conversaciones
  sintéticas con respuestas reales del modelo cubren autocuidado, OTC, urgencia
  y riesgo de duplicar acetaminofén con enfermedad hepática. No equivalen a
  validación clínica exhaustiva ni prueban todos los fármacos o síntomas.

### Permisos de revisión nutricional

Para ver y editar: `Wellness.View` y `Wellness.Manage`. Para aprobar:
`NutritionPlans.Approve`. `Patients.ViewOwn`, un profesional vinculado y una
asignación activa limitan el acceso a sus pacientes. `Patients.View` permite
alcance global. También se necesita acceso a la aplicación ERP y completar
el onboarding profesional.

El rol sembrado `NutritionReviewer` reúne los permisos propios. En la base local
copiada, antes de preparar las cuentas QA, no tenía usuarios; `Admin` tenía un
usuario y todos los permisos. La prueba creó un revisor con dos pacientes y
sin `Patients.View`, y aprobó con su identidad. No se consultaron los titulares
de roles en producción ni se modificaron permisos de usuarios reales.

### Ejecución reproducible

Los scripts fuente viven en `e2e/`. Credenciales, datos de prueba, vídeos,
capturas, reportes y configuración de servicios quedan en `/tmp`, fuera del
repositorio. El host `CoppAddresd.E2EHost` exige una base `copp_review_` y sustituye
solo los transportes externos de SOS. No realiza llamadas ni envíos reales.

```sh
COP_E2E_FIXTURES=/tmp/.../private-fixtures.json COP_E2E_OUTPUT=/tmp/... node e2e/chat-symptom-guidance.mjs
COP_E2E_FIXTURES=/tmp/.../private-fixtures.json COP_E2E_OUTPUT=/tmp/... node e2e/nutrition-meal-navigation.mjs
COP_E2E_FIXTURE_URL=http://localhost:5173/@fs/tmp/.../fixture.html COP_E2E_OUTPUT=/tmp/... node e2e/diomedes-layout.mjs
```

Los casos SOS/perfil/preparación de `diomedes-review.mjs` permiten seleccionar
`COP_E2E_CASE` y `COP_E2E_PATIENT`; requieren preparar el estado correspondiente.
La prueba ERP `e2e/nutrition-plan-real-db.mjs` requiere dos borradores pendientes
y cambia solo los registros QA. No debe ejecutarse con pacientes de producción.
Los cambios no están desplegados; el APK construido antes de estos refinamientos
no contiene este código nuevo.
