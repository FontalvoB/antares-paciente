---
name: i18n-translations
description: How to add user-facing UI text in the CoppAddresd frontends (antares-paciente and coppaddresd-front) so it stays i18n-correct — wrap in t(), add the key to es.json (identity) and en.json (English translation). Load BEFORE adding any visible string, changing a screen's copy, or editing a data array that renders to the UI.
---

# i18n — Adding Translations (antares-paciente & coppaddresd-front)

Both frontends use a **custom, dependency-free i18n** with the same contract. Spanish
strings are the **translation keys**; English is looked up by key. There is no i18next /
react-i18next — just a provider + two JSON dictionaries.

If you add New UI text and forget the key, English mode silently falls back to the Spanish
source string (or logs `[i18n] Missing key for "en": <source>` in dev). Follow this skill so
every string is translatable.

---

## 1. The contract (both apps)

| Concept | antares-paciente | coppaddresd-front |
|---|---|---|
| Hook/provider | `src/i18n/I18nContext.tsx` | `providers/i18n-provider.tsx` |
| Spanish dict (`es`) | `src/i18n/es.json` | `providers/translations/es.json` |
| English dict (`en`) | `src/i18n/en.json` | `providers/translations/en.json` |
| Access in component | `const t = useT();` | `const t = useT();` |

- `es.json` is an **identity map**: `"Hola": "Hola"` (key === value). It is the source of truth for keys.
- `en.json` maps the same key → English: `"Hola": "Hello"`.
- `t(source, params?)` returns the `en` value when `lang === 'en'`, else the source (Spanish) string.
- Placeholders: `t('Alerta enviada · {phone}', { phone: familyCel })` — the JSON value must contain `· {phone}` exactly (the `{phone}` token is replaced verbatim).

**Golden rule:** every user-visible string lives in `t("...")` and has a matching key in
BOTH `es.json` and `en.json`.

---

## 2. Adding a new string — checklist

1. **Get the hook** (don't shadow `t`):
   ```tsx
   const t = useT();
   ```
2. **Wrap the visible text at render time**:
   ```tsx
   <p>{t('Buenos días')}</p>
   {t(nextTask?.title ?? '')}   // already-Spanish data value from context
   ```
3. **Add the key to BOTH dictionaries** with the EXACT same string (case, accents, punctuation, spaces):
   - `es.json`: `"Buenos días": "Buenos días"`
   - `en.json`: `"Buenos días": "Good morning"`
4. **Parameters**: include the token in the JSON value, not a concatenation:
   ```tsx
   t('{name} ya recibió tu alerta, ubicación y signos.', { name: family.split(' ')[0] })
   ```
   ```json
   { "name": "name already received your alert, location and vitals." }
   ```
   (Token `{name}` in the value, `{name}` in the call. Never build strings with `+`/`template literals` inside `t()` — the key must be a stable literal so it matches the JSON.)

### Data arrays (e.g. `program.ts`, nutrition cards, history rows)
- Keep the **Spanish text as the data key** in the array (it is the source value).
- Translate at **render time**, not definition time:
  ```tsx
  {items.map((it) => <span>{t(it.label)}</span>)}
  ```
- Never call `t()` while building the array — doing so freezes the translation to the current
  language and breaks switching.

### When a visible string changes
Update the key in the code AND both JSON files together. If you rename a key, delete the old one
from both files to avoid drift.

---

## 3. Definition of Done — verification

**Key parity (both apps).** PowerShell 5.1 `ConvertFrom-Json` CRASHES on duplicate-case keys
(e.g. `miembro` vs `Miembro`), so verify with **Node.js**, not PowerShell:

```powershell
# antares-paciente
node -e "const fs=require('fs');const e=JSON.parse(fs.readFileSync('src/i18n/es.json'));const n=JSON.parse(fs.readFileSync('src/i18n/en.json'));const ek=Object.keys(e),nk=Object.keys(n);const missEn=ek.filter(k=>!(k in n));const missEs=nk.filter(k=>!(k in e));console.log('in es not en:',missEn);console.log('in en not es:',missEs);"
# coppaddresd-front
node -e "const fs=require('fs');const e=JSON.parse(fs.readFileSync('providers/translations/es.json'));const n=JSON.parse(fs.readFileSync('providers/translations/en.json'));const ek=Object.keys(e),nk=Object.keys(n);const missEn=ek.filter(k=>!(k in n));const missEs=nk.filter(k=>!(k in e));console.log('in es not en:',missEn);console.log('in en not es:',missEs);"
```
Both arrays must be empty (`[]`).

**Build/typecheck per repo:**
- antares-paciente: `npm run build` (tsc -b && vite build) and `npm run lint`.
- coppaddresd-front: `yarn lint` and `yarn build`.

**Dev smoke test:** run the app in English (`lang === 'en'`) and watch the browser console for
`[i18n] Missing key for "en":` warnings — each means a key is missing from `en.json`.

---

## 4. Pitfalls

- **Duplicate-case keys**: `Mi9embro` and `miembro` as two keys breaks JSON parse in PS 5.1 and
  is ambiguous in JS. Keep one canonical casing per concept.
- **Key drift**: a key in `es.json` but not `en.json` (or vice-versa) → English shows Spanish.
- **Missing `{params}` in value**: if the call passes `{name}` but `en.json` value has no
  `{name}`, the token shows literally.
- **Translating at data-definition time**: `const x = t(label)` inside an array builder freezes the
  language. Translate at render.
- **Date / number locale**: do NOT run dates through `t()`. Use locale-aware formatting:
  antares pattern `lang === 'en' ? 'en-US' : 'es-ES'`. Same for `Intl.NumberFormat`.
- **Shadowing `t`**: name the map variable `t`, but don't reuse `t` for anything else in the
  component (e.g. rename a `task` map variable, not `t`).
- **Wrapping non-text**: never wrap icons, JSX, or component output in `t()` — only the literal
  string the user reads.
