# `features/wellness/vita` — Vita transversal (KAN-167)

Vita es el agente acompañante persistente de la app: un orbe flotante en cada
pantalla del flujo `app`, con un panel único de voz, texto e imagen.

## API pública (única)

```tsx
import { VitaEntry } from "../vita";

<VitaEntry module="diet" summary={{ mealsLogged: 2, mealsTotal: 4 }} />
```

| Prop      | Tipo                                                                 | Uso                                                                  |
| --------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `module`  | `VitaModuleId` (`home`, `protocol`, `diet`, `exercise`, `close-day`, `goal`, `profile`, `privacy`, `notifications`, `vitals`) | Pantalla de origen: historial, sugerencias rápidas y contexto. |
| `summary` | `Record<string, string \| number \| boolean \| null \| undefined>` (opcional) | Resumen del estado visible. Solo pasan claves de la lista permitida. |
| `docked` | `boolean` (opcional) | Muestra el orbe flotante. Inicio usa `false` porque tiene su propio orbe. |
| `homeComposer` | `boolean` (opcional) | Muestra el compositor en Inicio. Comparte el panel y la sesión de voz existentes. |

Se monta una vez por pantalla. En Inicio se coloca junto al saludo con
`docked={false}` y `homeComposer`. También aparece en la pantalla de
consentimiento de datos sensibles (`module="privacy"`, sin resumen).

## Identidad y privacidad en las solicitudes

- **Sin `threadId` del cliente.** El chat (`omitThreadId`), la subida de adjuntos y la
  sesión de voz no envían el hilo `proactive-<id>`. El backend lo deriva del JWT
  (`ChatController.ResolvePatientThread`, `VoiceSessionCommandHandler`), y el AI Service
  acepta adjuntos sin hilo (`row.thread_id in (None, thread_id)`).
- **`moduleContext`** (`{ module, summary }`) viaja en `POST /api/v1/chat` y en
  `POST /api/v1/chat/voice/session`. Es un campo aditivo, y hoy el backend lo ignora (ver
  handoff en `.ai-coord/KAN167.md`).
- **Lista permitida** (`context.ts`): solo claves de dominio conocidas, con validación de
  valor (números acotados, banderas y vocabularios cerrados). Lo demás se descarta.
- **Feedback de respuestas**: no se muestra en el panel, porque
  `POST /api/v1/chat/feedback` exige el `threadId` en el cuerpo.

## Comportamiento

- **Orbe**: `<button>` nativo (excepción Ionic-first: `ion-button` no refleja
  `aria-expanded` dinámico). Sube por encima del SOS flotante, se oculta con el teclado,
  respeta `--nav-h` y las safe areas, y añade espacio al final del scroll.
- **Minimizado**: pestaña compacta en el borde. Se guarda en `wellness.vita.dock.v1`.
- **Aviso proactivo**: como máximo uno por día local y por cuenta
  (`wellness.vita.nudge.v2:<espacio opaco>`). Se puede descartar y se retira solo a los 8 s.
- **Panel**: `IonModal` con foco atrapado. Escape, el botón y el fondo lo cierran, y el
  foco vuelve al disparador. Anillo de foco en el compositor. Con el panel abierto, los
  recordatorios superiores (KAN-176) bajan bajo su cabecera.
- **Compositor de Inicio**: permite enviar texto con el botón o con Enter, abrir la voz
  y elegir adjuntos. El borrador de texto vive en memoria y los adjuntos solo se envían
  desde el panel, donde se pueden revisar.
- **Voz**: `setVitaVoiceOrigin` antes de `openVoice`. `VoiceOverlay` lo lee en cada
  solicitud de sesión, incluidos los reintentos, y lo borra al cerrarse la voz.

## Historial local — retención (v2)

| Regla           | Valor                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| Clave           | `wellness.vita.history.v2:<hash 64 bits de sal del dispositivo + id de cuenta del JWT>:<módulo>` |
| Sin cuenta      | No se persiste nada (no existe fallback compartido)                                        |
| Máximo          | 30 mensajes por módulo                                                                     |
| Caducidad       | 7 días por mensaje. La purga global recorre todas las cuentas y módulos y borra las claves v1 |
| Usuario         | Nunca se guarda su texto libre: solo la clave de una sugerencia o un marcador              |
| Vita            | Texto redactado: identificadores del perfil, correos, números de 7+ dígitos, UUID, direcciones y nombres propios que el usuario escribió en ese turno |
| Nunca se guarda | Imágenes, nombres de fichero, `executionId`, acciones, `resourceId`, hilo                  |
| Borrado         | Botón de papelera del panel (por módulo)                                                   |

La redacción es heurística. Por eso el texto libre del usuario, que es la fuente
principal de datos personales, no se persiste nunca.
