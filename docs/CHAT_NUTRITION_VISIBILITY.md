# Nutrición dentro del chat (KAN-52)

Los accesos de Nutrición en el chat están ocultos por defecto. La implementación,
las traducciones anteriores, los servicios, los datos y el módulo dedicado siguen
conservados. No se cambian las APIs ni se borran mensajes del historial.

## Qué controla

`src/utils/chatNutritionVisibility.ts` centraliza la visibilidad:

- Oculta «¿Qué comer?» en las acciones rápidas.
- Desactiva la promoción y respuesta nutricional del fallback local; conserva
  esas ramas para su posterior restauración.
- En respuestas e historial del bot, convierte enlaces de Nutrición en texto
  sin acción y omite URLs directas de esos destinos. Reconoce rutas, query,
  fragmentos y escapes URL de `nutrition`, `nutricion`, `nut`, `program-nut`
  y `foodai`/`food-ai`, además de enlaces rotulados como Nutrición aunque su URL
  sea opaca. Conserva los enlaces generales y el texto de la conversación.
- Oculta botones sugeridos que identifiquen la funcionalidad nutricional.
- Omite una burbuja cuyo único contenido sea una URL oculta, sin simular
  que el bot sigue escribiendo.

La interfaz dedicada de Nutrición, el registro de comidas, Foto IA, las citas,
los adjuntos clínicos, el historial del chat y el envío normal permanecen disponibles.
Esta opción controla presentación; no prohíbe que el usuario pregunte sobre
alimentación ni modifica el modelo o el enrutamiento del asistente.

## Restauración

Definir `VITE_CHAT_NUTRITION_ENABLED=true` **durante el build**. Solo la cadena
exacta `true` habilita la experiencia. Ausente, `false` u otro valor la ocultan.

```sh
# Web
VITE_CHAT_NUTRITION_ENABLED=true npm run build
# Build y sincronización nativa
VITE_CHAT_NUTRITION_ENABLED=true npm run sync
```

Para TestFlight/Android, compilar y distribuir una nueva versión con ese valor.
En desarrollo, reiniciar Vite después de modificar el entorno. No hay que restaurar
archivos eliminados ni migrar datos. El flag no es un control de autorización.

## Verificación

`e2e/chat-nutrition-visibility.mjs` recorre la app con Playwright, en español/inglés,
en móvil/escritorio y con el flag apagado/encendido. Se ejecuta contra dos servidores
Vite locales con esos valores. Auth, chat y APIs de dominio usan respuestas sintéticas;
no prueba un modelo real ni transacciones con una base de producción.

```sh
COP_E2E_OUTPUT=/tmp/copp-chat-nutrition-review \
COP_E2E_APP_URL=http://127.0.0.1:5186 \
COP_E2E_ENABLED_URL=http://127.0.0.1:5187 \
node e2e/chat-nutrition-visibility.mjs
```

Capturas y resultados quedan fuera del repositorio en `COP_E2E_OUTPUT`.
