# Presentación neutral de mediciones del wearable

Vita acompaña la educación y la adherencia al programa. Las tarjetas de signos
muestran valores ingresados, sin clasificarlos como altos, bajos o dentro de un
rango clínico mediante bandas fijas locales. Una meta explícita de actividad
conserva su progreso de adherencia; no equivale a una conclusión clínica.

Se conservan los valores, unidades, fechas y fuentes del registro, los controles
de entrada existentes y los contenidos asignados por el equipo. La historia y
las muestras antiguas no se utilizan para autollenar una lectura actual. Estos
cambios de presentación no alteran planes, conexiones BLE ni comandos del sensor.

El componente interno `EcgTrace` ahora muestra círculos decorativos, con la
leyenda visible «Animación decorativa; no es un electrocardiograma (ECG)». No
recibe FC ni muestras, no dibuja ondas QRS ni cuadrícula y su movimiento tiene
una cadencia fija. Con movimiento reducido permanece estático. El número de FC
se muestra por separado, conservando su indicación de antigüedad/fuente.
La presión usa un arco sencillo en lugar de un trazado con picos; tanto ese
arco como las burbujas de SpO2 se identifican como decorativos, sin representar
una señal medida.

Las regresiones cubren valores fuera de las bandas anteriores sin conclusiones
clínicas, envío numérico sin cambios, exclusión de historia antigua, ES/EN y
semántica decorativa sin canvas. La verificación de navegador comprueba el
componente real y el CSS en 320/768 px con movimiento normal y reducido; usa una
página aislada sin servicios ni pacientes reales.

Estas comprobaciones no verifican exactitud, calibración, capacidades clínicas
ni funcionamiento físico nuevo de H59/R88. No se ejecutaron mediciones de
hardware ni se añaden afirmaciones de registro, certificación o autorización.
