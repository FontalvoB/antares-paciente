# Servicios de emergencia y mensajes SOS

## Acciones independientes

El panel SOS muestra **Ambulancia**, **Policía** y **Bomberos** como tres
acciones propias, con nombre, icono, descripción y número visibles. Las tres
abren el marcador del teléfono: **123 en Colombia** y **911 en Estados Unidos**.
Son centrales unificadas; el usuario indica al operador qué servicio necesita.
No se afirma que exista una línea directa distinta ni que la app despache una
ambulancia automáticamente.

Las llamadas no dependen de crear una alerta al contacto personal. Ese SOS
conserva su confirmación explícita de dos pasos y sus estados reales por canal.
El familiar y el equipo clínico se presentan separados de los servicios públicos.

Fuentes: [Policía Nacional de Colombia](https://www.policia.gov.co/sites/default/files/2024-10/Recomendaciones%20COP%2016.pdf),
[National 911 Program](https://www.911.gov/calling-911/frequently-asked-questions/).

## País del dispositivo

- GPS nativo mediante `@capacitor/geolocation` en Android/iOS; geolocalización
  del navegador en web. La zona horaria no confirma el país actual.
- Resolución local con polígonos de Colombia, Estados Unidos y sus territorios.
  No se envía GPS a un geocodificador externo. Fuente y límites en
  [la cartografía](../src/data/emergency-country-boundaries.SOURCE.md).
- Ubicación desconocida, permiso denegado, baja precisión o cercanía a una
  frontera internacional requieren confirmar Colombia o Estados Unidos. El
  panel distingue «ubicación del dispositivo» de «país confirmado por ti».
- La confirmación manual prevalece durante esa apertura. GPS se renueva al
  regresar a foreground y la selección automática expira mientras el panel
  sigue abierto. Una respuesta tardía no cambia una elección manual.
- Activar el SOS espera como máximo 2,5 segundos por GPS; si falla, envía la
  alerta sin ubicación. Metadatos inválidos o posiciones viejas se omiten.

Las declaraciones de permisos Android/iOS se incluyen en los proyectos nativos.
La respuesta API de coordenadas planas se adapta a `location`, y un HTTP 204
en `/alerts/active` significa que no hay alerta activa.

## Datos y mensajes

Se eliminaron las constantes de signos vitales y el nombre de médico ficticio.
Solo se comparten lecturas del wearable conectado, en vivo, de los últimos
cinco minutos, dentro del contrato del backend. No se usan datos de historial,
de diagnóstico, de una sesión obsoleta ni de un dispositivo no puesto. Una
métrica no disponible se omite: nunca se retrasa la alerta para medirla.

El backend construye el SMS breve y el correo HTML con acciones de llamada y
mapa, sin documento de identidad, referencias internas o precisión técnica.
No se toma la dirección del perfil como ubicación actual. Los enlaces propios
ocultan las coordenadas del SMS y el correo muestra un botón para abrir el mapa.
El estado del correo procede del outbox; un transporte deshabilitado o de
simulación no se presenta como envío correcto.

Para los enlaces legibles se requiere desplegar también el backend y configurar
su origen HTTPS público `SosLocationLinks__PublicBaseUrl` (o el
`SosWebhook:BaseUrl` existente). No se necesita otra clave: se reutiliza con
separación de propósito la firma de Storage ya configurada. Sin origen
configurado se conserva el mapa directo como fallback funcional. Detalle en
`coppAddresdBack/docs/modules/sos/README.md`.

## Verificación y entrega

Los tests de overlay, servicio GPS, países y marcador simulan ubicación,
peticiones y llamadas; no contactan emergencias ni envían SMS/correo. Se revisó
el panel con Ionic real a 375 px (es), 430 px (en) y 1024 px, además del correo
a 400 y 640 px. Se ejecutaron pruebas de mensajes, firma, expiración,
revocación, privacidad y estados del backend.

Antes de publicar: instalar el build en Android/iOS, comprobar permisos GPS y
selección de país en hardware real, y revisar el marcador sin completar una
llamada de prueba a emergencias. iOS requiere compilar con Xcode/macOS.
La prueba de proveedores SMS/correo debe dirigirse a destinos de prueba
autorizados. Los cambios locales no despliegan por sí solos el backend ni la app.
