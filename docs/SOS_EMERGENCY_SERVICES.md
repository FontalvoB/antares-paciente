# Servicios de emergencia y mensajes SOS

## Acciones independientes

El panel SOS muestra **Ambulancia**, **Policía** y **Bomberos** como tres
acciones propias, con nombre, icono, descripción y botón «Llamar». La app no
muestra los teléfonos de destino, tampoco en las etiquetas accesibles. Las tres
abren el marcador del teléfono. Si existe un contacto local verificado para el
servicio y la ciudad actual, se elige esa línea. Para cualquier servicio sin
contacto local utilizable se conserva **123 en Colombia** o **911 en Estados Unidos**.
Son centrales unificadas; el usuario indica al operador qué servicio necesita.
No se afirma que exista una línea directa distinta ni que la app despache una
ambulancia automáticamente.

El selector Ionic «Mi equipo / Emergencias» permanece fuera del área de scroll.
«Mi equipo» se abre primero con la alerta SOS, el equipo médico, los contactos
y los datos compartidos; «Emergencias» muestra los tres servicios a un toque.
Cambiar de sección vuelve al inicio y no activa una alerta ni realiza llamadas.
Cerrar y reabrir SOS restaura «Mi equipo». La llamada manual a los
contactos está dentro de la red de ayuda. No se muestran teléfonos personales
ni números enmascarados en esta vista.

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
- La selección del país y de la línea es automática; no hay selector de país.
  Se conserva el indicador del país/ciudad obtenido por el dispositivo.
- Sin ubicación utilizable o fuera de cobertura no se adivina un número por
  idioma, zona horaria o perfil. Los tres servicios siguen visibles, deshabilitados,
  con un aviso de ubicación y «Reintentar ubicación». El SOS y la llamada a los
  contactos personales siguen disponibles.
- GPS se renueva al regresar a foreground y cada minuto con la vista abierta,
  también después de un fallo. Cada nuevo intento invalida el destino anterior.
  Los resultados de consultas canceladas al cerrar/reintentar se descartan.
- Activar el SOS espera como máximo 2,5 segundos por GPS; si falla, envía la
  alerta sin ubicación. Metadatos inválidos o posiciones viejas se omiten.

Las declaraciones de permisos Android/iOS se incluyen en los proyectos nativos.
La respuesta API de coordenadas planas se adapta a `location`, y un HTTP 204
en `/alerts/active` significa que no hay alerta activa.

## Directorio por ciudad y fallback

El catálogo incluido en el build es
[`src/data/emergency-city-directory.json`](../src/data/emergency-city-directory.json).
No consulta directorios externos ni transmite GPS a terceros. La descarga del
archivo local no bloquea la llamada: mientras carga o si falla, se mantiene la
central nacional. No depende del backend SOS ni de tener un contacto familiar.

Cobertura local inicial: **Manizales, Bomberos 119**, y **San José, California,
Policía +1 408 277 8911**. Las demás combinaciones ciudad/servicio usan 123/911.
Las fuentes oficiales, entidades, método y fechas de revisión están en cada
contacto. «Verificado» significa contrastado con una publicación oficial; no se
han realizado llamadas reales ni confirmado disponibilidad con los organismos.
No se cargan números administrativos ni números con información contradictoria.

La ciudad se identifica por polígonos DANE MGN 2025 y U.S. Census TIGERweb ACS
2025. Se conservan islas y huecos: una localidad próxima o un área no incorporada
no hereda el número de una ciudad vecina. La precisión GPS debe estar disponible,
la posición tener menos de un minuto y su incertidumbre quedar dentro del límite.
Un margen mínimo de 250 m ante el borde evita elegir una jurisdicción dudosa.
Dos ciudades superpuestas o geometría inválida usan la central nacional del
país detectado. No se usa el domicilio del perfil como ubicación actual.

Las revisiones de contactos y límites caducan a los **90 días como máximo**.
Una entrada pendiente, futura, expirada, duplicada para el mismo servicio o con
teléfono inválido no se utiliza. La pantalla renueva el destino al caducar, y
cada toque lo valida nuevamente. Si un número local no contesta, el usuario
tiene un botón independiente para llamar a la central; la app no puede conocer
el resultado de la llamada ni hacer reintentos automáticos al servicio público.

Para añadir una ciudad, agregar una entrada con país, identificador DANE/GEOID,
nombre, límite y fuentes oficiales. Añadir únicamente los servicios cuyo destino
de emergencias esté comprobado; los ausentes ya tienen fallback. Antes de activar
`status: verified`, revisar jurisdicción, finalidad de emergencias y conflictos
recientes, y registrar `verifiedAt`, `expiresAt`, `verificationMethod`, `agency`
y `sourceUrl`. Nunca renovar las fechas automáticamente.

Para descargar los límites y preservar los contactos y fechas existentes:

```sh
python3 scripts/update-emergency-city-directory.py --output /tmp/emergency-city-directory-review.json
```

Revisar el archivo y las fuentes antes de reemplazar el catálogo. El catálogo es
parte del paquete: las ampliaciones y revisiones requieren un nuevo build de la
app. La expiración sigue aplicando a instalaciones antiguas y devuelve la central
nacional. Sin país conocido, los botones esperan una ubicación utilizable; no
se inventa el país ni se muestra un teléfono vacío.

El E2E actual está en `e2e/emergency-city-routing.mjs`. Comprueba el orden
médico primero, ausencia de selector/números visibles y destinos internos
exactos de cada llamada, incluyendo cambio de país, reintento GPS y caducidad.
Simula sesión, coordenadas,
variantes del catálogo y la entrega de `tel:` al sistema, sin alertas ni llamadas
reales. Las capturas y logs deben dirigirse a una carpeta temporal externa al repo.

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
