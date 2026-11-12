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

### Ajustes locales de propósito y bienvenida (2026-11-12)

El acento de «¿Cuál es tu propósito?» usa azul de marca en selección, foco y botón
principal. Los chips exponen `aria-pressed`; no cambia el color de otras baterías.

La bienvenida de Vita espera todas las evaluaciones requeridas de la cohorte
inicial. El servidor devuelve `isRequired` y `batteryRequiredCount`; un requerido
ausente, una lectura fallida o metadatos anteriores no habilitan la bienvenida.
Una evaluación opcional pendiente no bloquea la bienvenida ni muestra el aviso
de plan pendiente. El texto deja de imponer nueve como requisito fijo.

El onboarding guarda una marca pendiente por cuenta, sin datos clínicos, en esta
instalación. Se conserva al recargar y se consume al cerrar la bienvenida. Las
cuentas existentes sin marca no reciben una bienvenida retroactiva. La identidad
del coach sigue siendo la Vita ya presente en bienvenida/chat: no se agregó un
catálogo de coaches ni confirmación de bienvenida entre dispositivos.

`e2e/easy-local-fixes.mjs` verifica estos comportamientos mediante la UI real y
respuestas HTTP sintéticas, además del texto de plan publicado en Chat. La
integración PostgreSQL del backend comprueba los metadatos del catálogo real de
prueba. Este cambio requiere publicar conjuntamente la API y la app; no se han
publicado estos ajustes ni se ha realizado una prueba en un iPhone real.

### Verificación anterior del formulario

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
