# `features/wellness/vita` — Vita transversal (KAN-167)

Vita es el agente acompañante persistente de la app: un orbe flotante en cada
pantalla del flujo `app`, con un panel único de voz, texto e imagen.

## API pública (única)

```tsx
import { VitaEntry } from "../vita";

<VitaEntry module="diet" summary={{ mealsLogged: 2, mealsTotal: 4 }} />
```

| Prop      | Tipo                                                                                   | Uso                                                                     |
| --------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `module`  | `"home" \| "protocol" \| "diet" \| "exercise" \| "close-day" \| "goal" \| "profile"` | Pantalla de origen: historial local, sugerencias rápidas y contexto.    |
| `summary` | `Record<string, string \| number \| boolean \| null \| undefined>` (opcional)          | Resumen corto del estado visible. **Nunca** datos personales.           |

Se monta una vez por pantalla, como último hijo de `<Screen>`. `VitaOrb`,
`useVitaConversation`, `context`, `history` y `dock` son internos.

## Comportamiento

- **Orbe**: botón nativo (excepción Ionic-first documentada: `ion-button` no
  refleja `aria-expanded` dinámico) con `aria-haspopup="dialog"`,
  `aria-expanded` y etiqueta "Preguntar a Vita sobre {módulo}". Sube por
  encima del SOS flotante cuando este aparece, se oculta con el teclado abierto
  y respeta `--nav-h` y safe areas.
- **Minimizado**: pestaña compacta en el borde derecho; al tocarla vuelve el
  orbe. Preferencia en `wellness.vita.dock.v1`.
- **Aviso proactivo**: como máximo uno por día local y por cuenta
  (`wellness.vita.nudge.v1:<hash>`), descartable, se retira solo a los 8 s.
- **Panel**: `IonModal` (foco atrapado, Escape, botón y fondo cierran; el foco
  vuelve al disparador). Voz con `openVoice` global; texto e imagen con
  `sendChatMessage` (mismo hilo `threadId`, mismo agente Vita, mismo formato
  `ChatResult`), adjuntos con `useVitaAttachmentDraft`.
- Frase de SOS en el texto → `requestSos("chat")` al instante (KAN-137).

## Contexto en el payload

`POST /api/v1/chat` añade `moduleContext: { module, summary }` (campo aditivo
y opcional). `context.ts` lo sanea siempre:

- máximo 8 claves, claves `[a-zA-Z][a-zA-Z0-9_]*` de ≤32 caracteres;
- descarta claves que contengan nombre, correo, teléfono, documento,
  dirección, ciudad, ubicación, paciente, usuario, id, token o nacimiento;
- descarta valores con correo, 7+ dígitos seguidos (teléfono/documento) o UUID;
- recorta textos a 60 caracteres y números a 2 decimales.

## Historial local — retención

| Regla          | Valor                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Clave          | `wellness.vita.history.v1:<hash FNV-1a del propietario>:<módulo>`     |
| Máximo         | 30 mensajes por módulo (los más recientes)                            |
| Caducidad      | 7 días por mensaje; se purga al leer y al escribir                    |
| Campos         | `id`, `role`, `text`, `at` (ISO), `attachments` (número), `failed`    |
| Nunca se guarda | nombres de fichero, imágenes, `executionId`, acciones, `resourceId`  |
| Saneado        | correos, números de 7+ dígitos y UUID se sustituyen por `•••`         |
| Borrado        | botón de papelera del panel (por módulo)                              |

El historial es una comodidad del dispositivo; la memoria de Vita vive en el
hilo del backend.
