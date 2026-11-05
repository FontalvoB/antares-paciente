# Mi rutina y técnica de ejercicios

`src/pages/program/ExerciseLesson.tsx` presenta la rutina del día y una vista
propia por ejercicio. La estación actual muestra su imagen o vídeo inmediatamente, con controles y
sin reproducción automática. «Ver mis indicaciones» abre su detalle. Se muestran
configurado, descripción, series/repeticiones, tiempo, descanso, equipo, músculo,
peso, tempo, esfuerzo percibido y consejos, según los datos disponibles.

El componente conserva el contrato del circuito existente y sus acciones de
pausar, avanzar y completar. Consultar una demostración pausa el cronómetro.
Abrirla o reproducirla no completa la tarea ni concede puntos. Si no existe
rutina o medio asignado, se explica sin fabricar contenido. El reproductor
ofrece controles nativos, sin reproducción automática y con estado de error.

El backend agrega las URL firmadas y el tipo de medio a `ExerciseItemDto`.
Solo se aceptan URL HTTP(S) sin credenciales; no se ejecutan esquemas `data:`,
`javascript:` o `file:`. Los medios antiguos sin estos campos siguen mostrando
el detalle de texto, sin una demostración inventada. La firma dura una hora;
volver a consultar el snapshot renueva la URL conforme a la sesión del usuario.

Pruebas:

```sh
npm test -- src/pages/program/__tests__/ExerciseLesson.test.tsx src/utils/__tests__/exerciseSteps.test.ts
```

Se comprobó con Ionic real en 375 px español, 430 px inglés y 1024 px inglés,
sin desbordamiento horizontal ni errores de página. El arnés visual usa datos
y una imagen sintéticos y no se incorpora al bundle de la aplicación.
