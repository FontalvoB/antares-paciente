# KAN-172 · Fichas y privacidad de tiendas

**Borrador.** Usar solo después de validar el build exacto de cada tienda y de recibir aprobación de los textos ES/EN. No se han enviado fichas o compilaciones para revisión pública desde este paquete. [KAN-172](https://diomedescerda.atlassian.net/browse/KAN-172) · [Matriz de claims KAN-175](marketing.md)

## Campos para revisión editorial

| Campo | Español | English |
| --- | --- | --- |
| Nombre | Agentic Wellness IA | Agentic Wellness IA |
| Subtítulo de App Store | Tu rutina de bienestar | Your daily wellness routine |
| Descripción breve de Google Play | Elige un objetivo y da seguimiento a tus hábitos de bienestar. | Choose a goal and keep track of your wellness habits. |
| Palabras clave de App Store | bienestar,hábitos,rutina,objetivo,ejercicio,alimentación | wellness,habits,routine,goal,movement,meals |
| Descripción | Elige un objetivo y sigue una rutina con sugerencias de ejercicio y alimentación. Registra tus actividades y consulta tu progreso día a día. Agentic Wellness IA ofrece orientación general de bienestar. Consulta a un profesional si tienes dudas sobre qué rutina es adecuada para ti. | Choose a goal and follow a routine with movement and meal suggestions. Log your activities and see your progress day by day. Agentic Wellness IA offers general wellness guidance. Consult a professional if you have questions about which routine is right for you. |

Categoría candidata para ambas tiendas: **Salud y forma física**. El rating lo determina el cuestionario de cada tienda para el build real. Mantener separada la elegibilidad del producto para personas adultas de la clasificación resultante. No introducir producto, precio, trial o renovación hasta validar el modelo comercial y checkout reales. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Google Play Content ratings](https://support.google.com/googleplay/android-developer/answer/9898843?hl=en)

**Capturas que se deben producir en ES y EN.** Usar una cuenta sintética y el mismo build que se envía. Preparar Inicio (progreso y rutina), Objetivo (elección de meta), Ejercicio (rutina orientativa) y Alimentación (sugerencias y registro). No publicar nombres, métricas, contactos, notificaciones ni imágenes reales. No utilizar capturas de menús deshabilitados, pantallas simuladas ni elementos de la app legada. Guardar por plataforma el identificador de build, idioma, dispositivo y captura aprobada.

## Inventario para las declaraciones de privacidad

Este inventario identifica qué inspeccionar, no qué marcar en las consolas. Para cada fila registrar en el build firmado si se transfiere fuera del dispositivo, propósito, obligatoriedad/opcionalidad, asociación a identidad, terceros y su papel, retención, y evidencia del recorrido. Revisar los SDK y los flags efectivamente incluidos, no solo los manifiestos. [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) · [Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)

| Datos / función | Fuente técnica | Evidencia que falta para declarar |
| --- | --- | --- |
| Cuenta, correo, idioma, identificador y contacto de emergencia | [Onboarding](../../src/pages/OnboardingPage.tsx) y [recibos versionados](../LEGAL_CONSENTS_CLIENT.md). | Campos realmente obligatorios y ruta de guardado/reaceptación según idioma. Para contactos, distinguir alta local, almacenamiento en backend y destinatario de SOS. |
| Meta, actividad, peso, mediciones manuales y conectadas | [Objetivo](../../src/features/wellness/goal/WellnessGoalPage.tsx), [mediciones](../../src/features/wellness/vitals/WellnessVitals.tsx), [plugin iOS](../../ios/App/App/WellnessHealthPlugin.swift) y [manifiesto Android](../../android/app/src/main/AndroidManifest.xml). | Probar denegación, autorización, lectura y sincronización en ambos builds. Los permisos Android declarados no prueban compatibilidad activa ni transferencia. |
| Ubicación y canal SOS | [Prueba de contexto del permiso de ubicación](../../e2e/sos-location-disclosure.mjs). | Precisar cuándo se usa ubicación, si sale del dispositivo y a quién se entrega. Probar en un canal de QA sin notificaciones a terceros reales. |
| Cámara, fotos, micrófono, texto y audio de IA | [Autorización por alcance](../LEGAL_CONSENTS_CLIENT.md) e [Info.plist de iOS](../../ios/App/App/Info.plist). | Para funciones habilitadas, validar destinos, propósito, configuración del proveedor y datos retenidos. Probar que negar permisos no inicia el envío. |
| Eventos de uso, fallos e identificadores | [KAN-177](https://diomedescerda.atlassian.net/browse/KAN-177), [manifest de privacidad iOS](../../ios/App/App/PrivacyInfo.xcprivacy). | Conciliar tráfico, SDK y consentimientos del binario. El manifest de iOS documenta una API y no acredita un inventario de datos. |
| Pagos y suscripción | [KAN-116](https://diomedescerda.atlassian.net/browse/KAN-116) y [KAN-58](https://diomedescerda.atlassian.net/browse/KAN-58). | Validar flujos de cobro reales antes de declarar datos financieros, atribuir al producto un plan o publicar condiciones comerciales. |
| Solicitudes de datos y borrado de cuenta | [Flujo de privacidad](../../src/features/wellness/privacy/ServerPrivacyRequests.tsx) y [QA](../../e2e/privacy-requests.mjs). | Confirmar enlace externo público que corresponda al producto y demostrar el trámite completo en un entorno autorizado. |

## Orden de entrega

1. Confirmar en las consolas los registros de app que recibirán ambos builds. Conservar los IDs del proyecto hasta que Release confirme el destino iOS independiente de [KAN-182](https://diomedescerda.atlassian.net/browse/KAN-182). El [pipeline existente](../IOS_CICD_TESTFLIGHT.md) sube a TestFlight, lo que no acredita aprobación de la ficha pública.
2. Verificar las URL públicas y versionadas de política y términos en ES y EN. El enlace [configurado en la app](../../src/utils/legalLinks.ts) abrió un sitio con título **Copp Adresd — Política de Privacidad | Privacy Policy**. Tratarlo como evidencia de marca anterior, no como política aprobada de Agentic Wellness IA. Confirmar versiones y reaceptación con [KAN-180](https://diomedescerda.atlassian.net/browse/KAN-180) y [KAN-119](https://diomedescerda.atlassian.net/browse/KAN-119).
3. Fijar SHA, versión, número de build, flags, entorno, destino y firma por plataforma. Comparar permisos del artefacto y capturas de la app con el inventario de datos. Completar las declaraciones, el cuestionario de clasificación y las notas de revisión usando esa evidencia.
4. Registrar URL o ID de ficha, compilación aceptada, capturas aprobadas, respuestas de privacidad/edad y cualquier observación de Apple o Google. Si hay rechazo, documentar corrección y nueva decisión de la tienda antes de cerrar.
