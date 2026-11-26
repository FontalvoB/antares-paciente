# KAN-124 · Menú del Motor 365 en la app

Dieta de hoy solicita `/api/v1/people/me/plan?includeMenu=true` y muestra los
platos, porciones, preferencias y modo simplificado recibidos del motor.
El calendario sin menú sigue sirviendo a las demás pantallas. Si existe
consentimiento de datos sensibles, la misma consulta también puede solicitar
la sincronización de KAN-153. La meta de
nutrición no cambia al elegir otro plato. Una elección se guarda localmente
con el registro del día, igual que antes, y al reabrir se verifica que siga
disponible y que la combinación mantenga las kcal y los macros dentro de
tolerancia. Si no hay opción compatible, no se ofrece «Cambiar plato».

El menú de demostración local se conserva solo para el recorrido legado.
Un plan real sin menú no muestra platos simulados. El caché del calendario
para el uso sin conexión sigue sin guardar el menú.

Para desplegar ambos cambios, publicar primero el backend que sirve el menú.
