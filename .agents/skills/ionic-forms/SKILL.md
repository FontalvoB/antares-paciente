---
name: ionic-forms
description: Formularios en ANTARES Paciente (Ionic React). Mapeo completo de controles (IonInput, IonSelect, IonCheckbox, IonRadio, IonToggle, IonTextarea, IonDatetime), controlled components, validación, errores, estados disabled/loading, submit y teclado móvil.
---

# Formularios Ionic — ANTARES Paciente

**ESTADO ACTUAL:** todos los formularios son HTML nativo (`.field input/select/textarea`, `OnboardingPage.tsx:161-200`). **ESTADO RECOMENDADO:** formularios NUEVOS con componentes Ionic. **MIGRACIÓN FUTURA:** migrar los existentes uno a uno (los inputs ganan teclado móvil, labels flotantes y focus nativos gratis).

## Mapeo de controles (obligatorio)

| Necesidad | Componente Ionic | Reemplaza |
|---|---|---|
| Input texto/email/tel/password | `IonInput` | `input.field` |
| Select | `IonSelect` + `IonSelectOption` | `select.field` |
| Checkbox | `IonCheckbox` (+ `IonItem` para hit-area completo) | `.check-row` / `div.checkbox` |
| Radio | `IonRadioGroup` + `IonRadio` | `<input type="radio">` |
| Toggle / switch | `IonToggle` | switch custom |
| Textarea | `IonTextarea` | `<textarea>` |
| Fecha | `IonDatetime` (dentro de `IonModal`/`IonPopover`) | `<input type="date">` |
| OTP 6 dígitos | 6 `IonInput inputmode="numeric" maxlength={1}` o custom actual | 6 `input.otp` (PENDIENTE validar `IonCodeInput` en Ionic 8.8) |

Import: `import { IonInput, IonSelect, IonSelectOption, IonCheckbox, IonRadioGroup, IonRadio, IonToggle, IonDatetime, IonTextarea, IonItem, IonLabel, IonButton } from '@ionic/react'`

## Controlled components (valores)

Estado del formulario: `useState` local (patrón existente `OnboardingPage`); solo subir a `useApp()` si 2+ pantallas lo consumen.

```tsx
const [form, setForm] = useState({ email: '', seguro: '' })
const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))
```

### IonInput (texto, email, tel, password, number)

```tsx
<IonInput
  type="email"
  label="Correo"
  labelPlacement="stacked"
  fill="outline"
  value={form.email}
  onIonInput={(e) => set('email', e.target.value as string)}
  inputmode="email"
  enterkeyhint="next"
/>
```

- **Evento**: `onIonInput` (keystroke) — NO `onChange` (los web components de Ionic no lo disparan para React).
- `type`: text, email, tel, password, number, url.
- `inputmode="numeric"` → teclado numérico (OTP, cédula). `enterkeyhint="done|next"` → tecla de acción móvil.
- `maxlength`, `minlength`, `required`, `autocomplete`, `disabled` directos.
- Label con `labelPlacement="stacked"` en el propio `IonInput` (patrón moderno Ionic 8). NO mezclar con `IonLabel` dentro de `IonItem` a la vez (redundante — elegir uno: `IonItem`+`IonLabel` para layouts legacy, `labelPlacement` para el resto).

### IonSelect

```tsx
<IonSelect
  label="Seguro médico"
  labelPlacement="stacked"
  value={form.seguro}
  onIonChange={(e) => set('seguro', e.detail.value as string)}
  interface="action-sheet"
>
  {opciones.map((s) => <IonSelectOption key={s} value={s}>{s}</IonSelectOption>)}
</IonSelect>
```

- Evento: `onIonChange` con `e.detail.value`.
- `interface="action-sheet"` / `"popover"` mejor UX móvil que el picker por defecto.

### IonCheckbox / IonRadioGroup / IonToggle

```tsx
<IonItem>
  <IonCheckbox checked={checks[0]} onIonChange={(e) => toggle(0, e.detail.checked)} />
  <IonLabel>He leído y acepto el consentimiento informado.</IonLabel>
</IonItem>

<IonRadioGroup value={v} onIonChange={(e) => set('frecuencia', e.detail.value)}>
  <IonRadio value="semanal">Semanal</IonRadio>
  <IonRadio value="mensual">Mensual</IonRadio>
</IonRadioGroup>

<IonToggle checked={notif} onIonChange={(e) => setNotif(e.detail.checked)} />
```

- Todos con `onIonChange` + `e.detail.*`.
- `IonItem` da el hit-area completo táctil.

### IonDatetime (fecha)

```tsx
<IonModal isOpen={dateOpen} onDidDismiss={() => setDateOpen(false)}>
  <IonDatetime value={form.dob} onIonChange={(e) => set('dob', e.detail.value as string)} />
  <IonButton onClick={() => setDateOpen(false)}>Listo</IonButton>
</IonModal>
```

- **Nunca directo en la página** — va dentro de `IonModal`/`IonPopover` (patrón estándar).
- Propiedades útiles: `min`, `max`, `presentation="date|time|date-time"`, `locale`.

### IonTextarea

```tsx
<IonTextarea
  label="¿Cómo te sientes hoy?"
  labelPlacement="stacked"
  fill="outline"
  value={post}
  onIonInput={(e) => setPost(e.target.value as string)}
  autoGrow
/>
```

- `autoGrow` para altura dinámica; `rows` para fija.

### OTP (6 dígitos)

ESTADO ACTUAL: 6 `input.otp` con focus manual (`OnboardingPage.tsx:236-252`). Opciones:
- Mantener custom (funciona), o
- 6 `IonInput` con `inputmode="numeric" maxlength={1}` (validar autofocus manual).
- **PENDIENTE DE VALIDACIÓN:** `IonCodeInput` en Ionic 8.8 antes de usarlo.

## Validación y errores

Patrón existente del proyecto (mantener): validación en handler de submit + `showToast` de `useApp()`.

```tsx
const next = () => {
  if (step === 3) {
    if (!form.fam1Nombre || !form.fam1Cel) {
      showToast('El familiar principal es obligatorio', 'err')  // err | warn | ok | info
      return
    }
    setStep(4)
  }
}
```

- Toasts para errores **globales** (submit). Error **por campo** → `color="danger"` en el input + texto helper debajo (o `IonText` en `danger`) — no abusar del toast.
- `label` + `errorText` en `IonInput`/`IonSelect` (Ionic 8 soporta `errorText` con `label`) para mensaje de campo persistente.
- Contraseña: validación en vivo con estado derivado (patrón `pwdOk`/`strength`, `OnboardingPage.tsx:42-50`). Migrar input a `IonInput type="password"` manteniendo la barra de fuerza custom.
- Validar en español, mismo tono del proyecto.

## Estados: disabled / loading / submit

```tsx
const [saving, setSaving] = useState(false)
<IonButton expand="block" type="submit" disabled={saving} onClick={submit}>
  {saving ? 'Guardando…' : 'Guardar'}
</IonButton>
```

- `disabled` en controles individuales durante envío o por regla de negocio.
- Bloqueos largos (perfil IA, scan BT): `IonLoading` o `IonSpinner` (skill `ionic-overlays`).
- Form submit: `<form onSubmit={...}>` nativo con `e.preventDefault()` + `IonButton type="submit"` (o manejar solo onClick — patrón actual del proyecto).
- Feedback de éxito: `showToast('Guardado', 'ok')`.

## Teclado móvil

- `capacitor.config.ts` ya configura `Keyboard.resize: 'body'` ✓.
- `IonInput`/`IonTextarea` → Ionic hace scroll-into-view del campo enfocado automáticamente.
- `inputmode` correcto por tipo (numeric, email, tel, text) y `enterkeyhint` (`next` entre campos, `done` en el último).
- NO `maximum-scale=1`/`user-scalable=no` (index.html:8 — PENDIENTE de corrección, WCAG 1.4.4): bloquea zoom y empeora la UX de inputs en móvil.

## Reglas

1. Formularios nuevos → componentes Ionic; no añadir más `input.field` nativos.
2. `onIonChange`/`onIonInput` (no `onChange`) en componentes Ionic.
3. Estado local con `useState`; solo `useApp()` si 2+ pantallas lo consumen.
4. Labels SIEMPRE presentes (`labelPlacement="stacked"` o `IonLabel`), nunca placeholder como único texto.
5. Validación en español; toasts para errores de submit, `danger` para errores de campo.
