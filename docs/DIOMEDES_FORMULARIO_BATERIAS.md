# Formulario y baterías — ajustes Diomedes

## Formulario

- El seguro usa IDs del catálogo real del ERP. «Sin seguro médico» es la primera
  opción y el valor inicial para un paciente sin aseguradora. Seleccionarla
  limpia póliza/grupo; `clearInsurer` expresa el borrado sin cambiar el significado
  de `insurerId: null` para clientes antiguos.
- Hay dos espacios de contacto, compartidos entre onboarding y Perfil. El
  principal necesita nombre/teléfono. El segundo es opcional: si se comienza,
  necesita ambos datos. Ambos admiten parentesco y correo opcional.
- El contacto principal conserva `name/relationship/phone/email` en la raíz del
  JSON existente, y sigue siendo el destinatario del SOS. El segundo se conserva
  en `secondary`, como persona de respaldo. No se afirma que reciba avisos
  automáticos. Omitirlo en una actualización antigua lo conserva; enviar sus
  campos vacíos lo elimina.
- La aceptación del consentimiento y Continuar se bloquean hasta que el final
  del texto sea visible. Un documento que cabe completo se considera visible.
  El texto admite scroll y teclado; luego deben marcarse las tres autorizaciones.

## Batería inicial

Se completaron más de 250 traducciones ES/EN, incluidos todos los textos visibles
españoles del catálogo inicial del backend: preguntas, opciones, secciones,
ayudas y etiquetas. También se traducen unidades textuales como «años» y los
nombres de las dimensiones en resultados. Los valores enviados al backend no
se traducen.

La carga inicial muestra tarjetas skeleton; Guardar conserva el contexto y
muestra un spinner en el propio botón, deshabilitado durante la solicitud.
Los errores conservan las respuestas para reintentar.

«Análisis de mi perfil» resume los resultados persistidos, incluye los indicadores
con severidad configurada y señala temas para conversar con el equipo. No suma
escalas distintas ni inventa un diagnóstico, una clasificación o valores ausentes.
Las dimensiones históricas sin rangos propios siguen sin etiquetas de riesgo.

## Verificación

- 38 pruebas focalizadas de app: onboarding, contactos, persistencia de payload,
  consentimiento, resultados y perfil.
- 104 pruebas `Features.Patients` del backend; compilación del módulo correcta.
- Build de app y lint focalizado correctos.
- Ionic real en 375 px (ES), 430 px (EN) y 1024 px (EN), con lecturas/peticiones
  simuladas: sin errores de página ni scroll horizontal; consentimiento funcional.
  Capturas locales en `.artifacts/forms-qa/`.

Los dos contactos necesitan desplegar el backend actualizado y aplicar la
migración que amplía `app.patient_profiles.emergency_contact` de varchar(500) a
text. La migración compartida de esta entrega también incluye el flujo de planes.
No se aplicaron cambios a bases públicas ni se enviaron mensajes reales.
