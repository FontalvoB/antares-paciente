# KAN-157 · Privacidad y datos de bienestar

**Borrador para revisión legal. Aprobación pendiente.** Este documento prepara la revisión con Legal y deja constancia de los límites del frontend.

## Implementación local

- Perfil → **Privacidad y datos** muestra categorías, usos, destinatarios y controles. Los términos previos de bienestar y los consentimientos del servidor conservan sus contratos. Al llegar a los formularios de objetivo, ejercicio y cierre del día se comprueba la autorización local para datos sensibles.
- Apple Health tiene un consentimiento independiente. El adaptador existente comprueba la versión antes de solicitar acceso y antes de leer o enviar muestras. Si falta, abre Privacidad y espera a que se vuelva a iniciar la acción. KAN-160 expondrá la activación en el flujo Wellness. La app actual tampoco pide push al arrancar. En nativo, Privacidad explica el uso del identificador del dispositivo y permite habilitar notificaciones con una acción explícita.
- Se utiliza edad en años completos para el objetivo y plan Wellness. No hay un campo de fecha de nacimiento en ese flujo. El dato se conserva en `age` y el campo legacy `dob` queda fuera de este cambio.
- Al abrir SOS se usa ubicación solo si el sistema la autorizó previamente. El permiso inicial se pide al elegir usar ubicación en el flujo de servicios cercanos o en la confirmación que explica los destinatarios de la alerta. Se puede activar la alerta sin ubicación.
- Hay una versión de texto por alcance. Se exige la versión vigente y una fecha válida con un máximo provisional de 365 días. Cada aceptación, retirada y borrado agrega un evento sin reescribir los anteriores. La auditoría usa `copp.wellness-privacy.audit.v1.*` y conserva el identificador del actor y las fechas. Es un registro local y editable desde el almacenamiento del dispositivo. Legal debe decidir retención y requisitos de evidencia de producción.
- El JSON incluye metadatos de esquema y fecha, las claves locales `wellness.*` y la auditoría del actor actual. Se ocultan los valores de `wellness.mock.accounts.v1` porque el mock guarda credenciales. En navegador descarga el archivo. En nativo se ofrece guardarlo con el menú del sistema y se retira la copia temporal de la app.
- El borrado elimina el espacio local `wellness.*`, invalida los consentimientos anteriores y conserva la sesión y la auditoría. El alcance es este dispositivo. Algunas claves legacy son compartidas entre sesiones de una misma instalación. La propiedad y separación de datos por cuenta deben resolverse antes de usar esta exportación en dispositivos compartidos.
- La app no integra analítica en Wellness. Si se añade, se debe declarar su alcance, versión, categorías, finalidad y destinatarios, y comprobar la aceptación antes de iniciar la recolección. Para una nueva integración de permisos, usar `requireWellnessConsent` desde la acción de activar y abrir Privacidad si falta el alcance vigente. Volver a comprobar la aceptación antes de leer o transmitir datos.

## Revisión estatal con Legal

| Jurisdicción | Puntos para determinar con Legal |
| --- | --- |
| Washington | Aplicabilidad de My Health My Data y excepciones. Política dedicada, uso, autorización separada para compartir cuando corresponda y retirada, acceso, borrado, destinatarios, copias y apelación. [RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true) |
| Nevada | Aplicabilidad de las disposiciones de datos de salud del consumidor, consentimiento explícito para recogida o compartición cuando aplique, política, derechos, procesadores y apelación. [NRS 603A](https://www.leg.state.nv.us/NRS/NRS-603A.html) |
| Connecticut | Aplicabilidad a controladores de datos de salud del consumidor, tratamiento de datos sensibles, derechos y revisión de avisos ES/EN. [Fiscalía de Connecticut](https://portal.ct.gov/AG/Sections/Privacy-/The-Connecticut-Data-Privacy-Act) |
| California | Aplicabilidad de CCPA/CPRA y del régimen de información médica según los datos y actores. Minimización para cada finalidad, avisos, acceso, borrado y límites de uso o divulgación. [CPPA](https://cppa.ca.gov/faq) · [Guía de minimización](https://cppa.ca.gov/pdf/enfadvisory202401.pdf) |
| Oregon | Aplicabilidad de OCPA, consentimiento para usos de datos sensibles, evaluaciones de impacto y solicitudes de copia, destinatarios y borrado. [Fiscalía de Oregon](https://www.doj.state.or.us/wp-content/uploads/2025/03/OCPA-Six-Month-Enforcement-Report-Public.pdf) |

Legal debe confirmar jurisdicciones efectivas y exclusiones dataset por dataset, qué terceros participan y en qué función, la afirmación sobre venta o publicidad, el plazo de consentimiento y la retención de evidencia. Se debe aprobar el texto ES/EN y el canal verificable de solicitudes con responsables, plazos y apelación, incluida la ejecución sobre backend, ERP, profesionales, procesadores y copias. La descarga y el borrado de este cambio operan sobre el dispositivo. También queda pendiente validar la descarga nativa y la activación de Apple Health en iOS.

## Accesibilidad

Encabezados semánticos, casillas etiquetadas, foco visible, objetivos de 44 px, aviso de estado accesible y confirmación con foco inicial en Cancelar. Referencia de diseño [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
