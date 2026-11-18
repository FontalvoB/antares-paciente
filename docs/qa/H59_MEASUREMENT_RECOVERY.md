# Recuperación de mediciones H59 — 18/11/2026

## Cuándo aparecía la vista del ensayo

El fallo aparece cuando el driver no confirma la medición. Para FC de H59,
la ventana es de 40 segundos y exige dos lecturas distintas. No es una
confirmación de falta de contacto: también puede ser silencio de radio, eco
constante, fallo de comando o desconexión. Sin el Registro BLE del ensayo no
se puede atribuir aquel caso a una causa específica.

Se detectó un falso negativo posible: 72.1 y 72.4 lpm se redondeaban ambos a
72 antes de comparar, así que no llegaban al objetivo. Ahora se comparan las
décimas originales y se mantiene el número entero para presentación. El eco
u16 idéntico no cuenta ni reemplaza la lectura confirmada durante ese intento.
Una lectura histórica no se presenta como nueva en la vista de medición.

Cada intento sigue limitado a 40 s; no se baja el criterio a una lectura ni
se inventa éxito para evitar el error. Un START que falla se comunica sin
esperar todo el timeout. Las respuestas tardías de intentos anteriores no
pueden cerrar un reintento nuevo.

## Comportamiento visible

El fallo cierra el modal de medición y aparece dentro de Reloj. No abre otra
pantalla de error ni duplica el mensaje en un toast. Conserva las lecturas
previas con su hora original. Reintentar mide la misma métrica. En Medir todo,
Medir siguiente omite solo la fallida. Cerrar vacía la cola y libera las
acciones; no deja otras medidas pendientes bloqueando la página.

## Ensayo físico pendiente (no sustituible por Vitest ni simulador)

Usar el build de TestFlight que contenga este cambio. Registrar versión/build,
nombre H59, hora de inicio y fin, dispositivo y firmware si están disponibles.
Cerrar la app oficial para que no compita por la conexión y habilitar Registro
BLE solo mientras se recoge evidencia.

1. Conectar H59 y medir FC sola cinco veces, con banda ajustada y brazo quieto.
   Cada intento termina con lectura nueva o aviso dentro de 40 s más latencia
   de UI; una cifra anterior no acredita éxito. Anotar tiempo al primer dato.
2. Observar un intento sin lectura válida. Debe conservar la página y la hora
   anterior, sin icono de alerta de pantalla completa ni segundo toast.
3. Pulsar Reintentar: se inicia una sola medida. Si falla, volver a intentar;
   el callback del intento anterior no puede cerrar el actual.
4. En Medir todo, provocar un fallo de FC y pulsar Medir siguiente: pasa a
   SpO2, sin reiniciar FC. Probar también Cerrar tras un fallo y lanzar una
   nueva secuencia: las tarjetas no deben quedar en cola.
5. Cancelar a mitad de FC y volver a medir. Apagar Bluetooth durante otro
   intento y reconectar. No debe informarse éxito por una lectura antigua.
6. Cambiar de pantalla y regresar, bloquear/desbloquear el teléfono, y repetir.
   Verificar que una respuesta tardía no agrega un aviso de un intento cerrado.
7. Verificar SpO2 y presión, y una medición R88 por regresión. Sus ventanas y
   criterios no se cambiaron. Medir todo debe continuar en el orden previsto.
8. Repetir el aviso en español e inglés y revisar a 375 px, tablet y con tamaño
   de texto aumentado. Retry/Next/Close deben quedar visibles y táctiles.

Si falla: guardar Registro BLE con inicio, primer dato y cierre; anotar si hubo
lecturas y el outcome (`no-signal`, `timeout`, `command-failed`, etc.). No subir
contraseñas ni tokens con la evidencia. Comparar con la app oficial en otro
intento separado, nunca conectadas simultáneamente al mismo wearable.

## Verificación automática

`npm run lint`, `npm run i18n:check`, `npm run build`, `npm test`,
`npm run release:check` y `npm run native:ble:check`.
Las pruebas cubren precisión cruda, rechazo de comando, timeout sin éxito
inventado, eco repetido, preservación de lectura, modal cerrado al fallar,
reintento con callback obsoleto, omisión de métrica y limpieza de cola.
