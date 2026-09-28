# CI/CD iOS → TestFlight (ANTARES Paciente)

Pipeline automatizado que lleva el código de `dev` hasta TestFlight sin abrir Xcode:
validaciones → build web de producción → Capacitor sync → firma de distribución →
archive Release → IPA → upload a App Store Connect.

- **Workflow**: `.github/workflows/ios-testflight.yml`
- **Automatización**: `fastlane/` (Fastfile, Appfile, Matchfile) + `Gemfile`
- **Estado actual (verificado)**: implementado; requiere completar los
  [secretos](#secretos-de-github-actions) una sola vez (sección
  [Puesta en marcha](#puesta-en-marcha-pasos-humanos)).

---

## 1. Arquitectura

```text
┌────────────┐   push/merge    ┌──────────────────────────────────────────────┐
│  dev (git) │ ──────────────► │ GitHub Actions · iOS TestFlight              │
└────────────┘                 │                                              │
                               │  JOB 1 · quality (ubuntu-24.04, rápido)      │
                               │   yarn install --frozen-lockfile             │
                               │   npm run lint / test / i18n:check           │
                               │   npm run release:check (Info.plist)         │
                               │   npm run build  → artefacto dist-web        │
                               │                                              │
                               │  JOB 2 · testflight (macos-26 + Xcode 26.6)  │
                               │   ruby 3.4 + bundle (Gemfile.lock)           │
                               │   dist-web → npx cap sync ios                │
                               │   App Store Connect API Key (.p8)            │
                               │   fastlane ios beta skip_web_build:true      │
                               │     ├─ match (cert Apple Distribution)       │
                               │     ├─ build number = TestFlight + 1         │
                               │     ├─ gym: archive Release → IPA firmado    │
                               │     └─ upload_to_testflight (espera process) │
                               └──────────────┬───────────────────────────────┘
                                              ▼
                                   App Store Connect → TestFlight (iOS)
```

También se puede lanzar manualmente (`workflow_dispatch`) con opción de **dry run**
(compila y archiva sin subir) y de forzar el número de build.

---

## 2. Auditoría del proyecto (datos reales verificados)

| Elemento               | Valor                                                                             |
| ---------------------- | --------------------------------------------------------------------------------- |
| Framework Ionic        | **React** (`@ionic/react ^8.8.18`)                                                |
| React / Vite / TS      | React 19.2 · Vite 8 · TypeScript 6 (`tsc -b`)                                     |
| Capacitor              | 8.5.x (`@capacitor/core 8.5.0`, `@capacitor/ios 8.5.1`) — **SPM, sin CocoaPods**  |
| Node / package manager | Node 24 · **Yarn 1.22** con `yarn.lock` (canónico; `npm` solo como script runner) |
| Proyecto iOS           | `ios/App/App.xcodeproj` (sin `.xcworkspace`, sin `Podfile`)                       |
| Scheme / config        | `App` / `Release` (scheme compartido)                                             |
| Bundle Identifier real | **`com.coppadresd.mobile`** (`project.pbxproj`)                                   |
| Development Team       | **`XZSSM34MU6`**                                                                  |
| Versión comercial      | `MARKETING_VERSION = 1.0` (`CFBundleShortVersionString`)                          |
| Build actual           | `CURRENT_PROJECT_VERSION = 1` (en CI se resuelve automáticamente)                 |
| Signing local actual   | Automático + `Apple Development` (no se toca)                                     |
| Repo git               | `https://github.com/FontalvoB/antares-paciente` (público)                         |
| Ramas                  | `dev` (integración), `main` (release), más ramas de trabajo                       |
| CI/CD previo           | Ninguno (no existían `.github/`, `fastlane/`, Codemagic)                          |
| Scripts npm útiles     | `lint`, `test`, `i18n:check`, `build`, `sync`, `sync:dev`, `release:check`        |
| Guarda de release      | `npm run release:check` — falla si `Info.plist` conserva el ATS de desarrollo     |

Notas de la auditoría que **no** se tocaron (funcionan hoy):

- `capacitor.config.ts` usa `appId: "com.coppadresd.app"` (plantilla/Android). El
  bundle id **real de iOS** es `com.coppadresd.mobile`, definido en Xcode. No se
  modificó ninguno de los dos.
- Existe un segundo Team ID legacy (`65CVWW23HP`) en perfiles viejos del Mac;
  el correcto para esta app es `XZSSM34MU6`.
- El repo arrastra `package-lock.json` y `pnpm-lock.yaml` obsoletos además de
  `yarn.lock`. El CI usa **Yarn** (el lockfile más reciente y el que usa el
  equipo). Recomendación: eliminar los otros dos en una limpieza aparte.
- Existe `ios/App/App.xcodeproj/xcshareddata/xcodecloud/manifest.json`
  (intento previo con Xcode Cloud). No se usa; se conserva.
- **Xcode Cloud está configurado en App Store Connect** y publica su propio
  check (`App | Default | Build - iOS`) en cada commit. Es independiente de este
  pipeline: no lo bloquea, pero genera ruido y —si alguien lo reactiva— podría
  subir builds en paralelo. Si se adopta GitHub Actions, desactivar allí el
  workflow (App Store Connect ▸ Xcode Cloud ▸ Manage Workflows) para evitar
  duplicados y números de build encontrados.

---

## 3. Estrategia de firma (por qué Match)

**Problema**: en runners de CI efímeros, firmar con "automatic signing" hace que
Xcode cree un certificado nuevo en cada ejecución (la llave privada muere con el
runner). Apple limita los certificados por cuenta (2 de desarrollo / 3 de
distribución) → el pipeline se rompe a las pocas corridas.

**Solución**: [fastlane match](https://docs.fastlane.tools/actions/match/)
(`type: appstore`) guarda **una sola vez** el certificado `Apple Distribution` y
el perfil `App Store` en un **repo privado**, cifrados con `MATCH_PASSWORD`
(AES-256-GCM). En cada ejecución:

1. `match` clona el repo de certificados y los importa (CI: `readonly: true`).
2. `update_code_signing_settings` aplica firma manual **solo en la copia local
   del `.pbxproj`** (con respaldo/restauración automática; el repo nunca cambia).
3. `gym` archiva con `Apple Distribution` + `match AppStore com.coppadresd.mobile`
   y exporta el IPA con `signingStyle: manual` + `provisioningProfiles`.

El signing de desarrollo local (Xcode + Apple Development) queda intacto: los
lanes no lo modifican de forma permanente.

---

## 4. Número de build automático

- `CFBundleVersion` = **último build de TestFlight + 1** (consulta real a App
  Store Connect con la API Key; `latest_testflight_build_number`).
- Se inyecta en el build vía `xcargs: CURRENT_PROJECT_VERSION=<n>` (sin editar
  archivos).
- `CFBundleShortVersionString` (`MARKETING_VERSION`) **no** se incrementa solo.
- Overrides disponibles:
  - `BUILD_NUMBER=42 bundle exec fastlane ios beta`
  - GitHub Actions ▸ Run workflow ▸ campo `build_number`.
- Si no hay builds previos, empieza en 1.

---

## 5. Secretos de GitHub Actions

Configurar en: **GitHub ▸ repo `FontalvoB/antares-paciente` ▸ Settings ▸ Secrets
and variables ▸ Actions ▸ New repository secret**.

| Secreto                         | Contenido                                      | Cómo obtenerlo                                                                                                         |
| ------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `APP_STORE_CONNECT_KEY_ID`      | Key ID de la API Key (10 caracteres)           | App Store Connect ▸ Users and Access ▸ Integrations ▸ Team Keys (columna **Key ID**)                                   |
| `APP_STORE_CONNECT_ISSUER_ID`   | Issuer ID (UUID)                               | Misma pantalla (arriba: **Issuer ID**)                                                                                 |
| `APP_STORE_CONNECT_API_KEY`     | **Base64** del archivo `.p8`                   | `base64 -i ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8 \| pbcopy`                                              |
| `APPLE_TEAM_ID`                 | `XZSSM34MU6`                                   | Ya verificado en `project.pbxproj`                                                                                     |
| `MATCH_PASSWORD`                | Contraseña de cifrado del repo de certificados | Generada al poner en marcha (guardar en gestor de contraseñas)                                                         |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `base64("usuario:token")`                      | Fine-grained PAT con permiso **Contents: Read** solo sobre el repo de certificados: `printf 'usuario:TOKEN' \| pbcopy` |

Opcional (Settings ▸ Secrets and variables ▸ Actions ▸ **Variables**):

| Variable        | Contenido                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MATCH_GIT_URL` | URL del repo de certificados, si se migra a otra cuenta/organización (por defecto: `https://github.com/diomedescerda/antares-paciente-certificates.git`) |

> ℹ️ El repo es **público**: los secretos de Actions nunca se exponen a PRs de
> forks ni se imprimen en logs (GitHub los enmascara). Aun así, restringir quién
> puede pushear a `dev` es la mejor defensa.

---

## 6. Puesta en marcha (pasos humanos, una sola vez)

### 6.1 Repo privado de certificados (si no existe)

Debe ser **privado** (contiene el certificado de distribución cifrado):

1. GitHub ▸ **New repository** ▸ nombre `antares-paciente-certificates` ▸
   **Private** ▸ Create.
2. Si se crea en otra cuenta/organización, actualizar la variable `MATCH_GIT_URL`
   o la URL por defecto del `fastlane/Matchfile`.

### 6.2 App Store Connect API Key

1. Entrar a [App Store Connect](https://appstoreconnect.apple.com) ▸
   **Users and Access** ▸ pestaña **Integrations** ▸ **Team Keys** (App Store
   Connect API).
2. Pulsar **➕** / **Generate API Key**.
3. Nombre: `CI TestFlight (fastlane)` · Access/Role: **App Manager**.
4. Pulsar **Generate** y **Download API Key** (el `.p8` **solo se descarga una
   vez**).
5. Guardar el archivo como `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8`
   (crear las carpetas si no existen).
6. Copiar de la pantalla: **Key ID** e **Issuer ID**.

### 6.3 Primera firma (crea cert + profile en el repo de Match)

En el Mac, con el `.p8` ya guardado:

```bash
cd <repo>
bundle install                                   # una vez
export APP_STORE_CONNECT_KEY_ID=<KEY_ID>
export APP_STORE_CONNECT_ISSUER_ID=<ISSUER_ID>
export MATCH_PASSWORD='<contraseña del gestor>'  # y guardarla también como secreto
bundle exec fastlane ios signing                 # crea/actualiza cert + profile
```

### 6.4 Cargar los secretos y probar el workflow

1. Settings ▸ Secrets and variables ▸ Actions ▸ cargar los 6 secretos de la
   tabla (§5).
2. Actions ▸ **iOS · TestFlight** ▸ **Run workflow** ▸ marcar `skip_upload` =
   true (dry run) → debe terminar en verde sin subir nada.
3. Repetir sin `skip_upload` → la build aparece en TestFlight.

---

## 7. Uso local (Mac)

Prerrequisitos: Xcode instalado (local: Xcode 27), `bundle install`, y las
variables de entorno (`APP_STORE_CONNECT_*`, `MATCH_PASSWORD`; o el `.p8` en la
ruta estándar de fastlane). Para no exportarlas a mano, crear `fastlane/.env`
(ignorado por git):

```bash
# fastlane/.env  (NUNCA commitear)
APP_STORE_CONNECT_KEY_ID=XXXXXXXXXX
APP_STORE_CONNECT_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MATCH_PASSWORD=********
```

Comandos:

```bash
bundle exec fastlane ios check      # lint + tests + i18n + release:check
bundle exec fastlane ios signing    # crea/renueva certificado y profile (Match)
bundle exec fastlane ios build      # build web + sync + firma + archive + IPA (sin subir)
bundle exec fastlane ios beta       # flujo COMPLETO hasta TestFlight
```

Parámetros útiles (como opciones o variables de entorno):

| Opción / variable                                      | Efecto                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `skip_web_build:true` / `FASTLANE_SKIP_WEB_BUILD=true` | No compila el bundle web (se usa el `dist/` existente)     |
| `BUILD_NUMBER=42`                                      | Fuerza el número de build                                  |
| `MATCH_READONLY=false`                                 | Permite a Match crear/renovar assets (solo lane `signing`) |
| `WAIT_FOR_PROCESSING=false`                            | No esperar el procesamiento de Apple al subir              |
| `TESTFLIGHT_GROUPS=Internos,Beta`                      | Asignar la build a grupos de testers                       |
| `TESTFLIGHT_CHANGELOG="..."`                           | Texto "Qué probar" en TestFlight                           |

El IPA y los dSYMs quedan en `ios/App/output/` (ignorado por git).

---

## 8. GitHub Actions

- Archivo: `.github/workflows/ios-testflight.yml`.
- Disparadores:
  - **push a `dev`** (ignora cambios solo-docs) → validaciones + upload.
  - **PR hacia `dev`** → solo el job de validaciones (sin secretos ni upload).
  - **workflow_dispatch** (manual, con `skip_upload` y `build_number`).
- Runners fijos (sin `-latest`): `ubuntu-24.04` para validaciones y `macos-26`
  con **Xcode 26.6** para el build iOS. Node 24 + Ruby 3.4.
- Cachés: `yarn` (setup-node) y gems (ruby/setup-ruby `bundler-cache`).
- El job `quality` es obligatorio antes de `testflight`; cualquier fallo
  (lint, tests, i18n, release:check, build) **detiene el despliegue**.
- `concurrency: ios-testflight-<ref>` evita subidas simultáneas (números de
  build duplicados).
- Nota: `workflow_dispatch` aparece en la UI (y en la API) recién cuando el
  workflow vive en la rama por defecto del repo (`main`). Hasta entonces, para
  disparar el pipeline completo usá push a `dev`; una vez mergeado a `main`, el
  botón **Run workflow** queda disponible.
- Para publicar también desde `main`: descomentar `branches: [dev, main]` en el
  workflow.
- Endurecimiento opcional: crear un **Environment** `testflight` (Settings ▸
  Environments) con _required reviewers_ y mover ahí los secretos para exigir
  aprobación manual antes de cada upload.

---

## 9. Publicación

### Automática

```text
merge/push a dev → GitHub Actions → quality ✅ → testflight ✅ → TestFlight
```

### Manual desde GitHub

Actions ▸ **iOS · TestFlight** ▸ **Run workflow** ▸ elegir rama (normalmente
`dev`) ▸ opciones (`skip_upload` para dry run; `build_number` para forzar) ▸ Run.

### Manual desde el Mac

`bundle exec fastlane ios beta` (ver §7). Útil para hotfixes o diagnóstico.

### Verificación en TestFlight

1. App Store Connect ▸ **Apps** ▸ Copp Adresd ▸ pestaña **TestFlight** ▸ iOS.
2. La build nueva aparece primero en _Processing_ (10–30 min); el lane con
   `WAIT_FOR_PROCESSING=true` espera y reporta estados/errores de Apple.
3. Cuando pasa a _Ready to Submit_ / _Testing_, asignar grupo de testers si no
   lo hace `TESTFLIGHT_GROUPS`.
4. Si Apple reporta "Missing Compliance", responder una vez el formulario de
   exportación de cifrado en la ficha de la build (Info ▸ Export Compliance).

---

## 10. Operaciones frecuentes

### Cambiar la versión comercial (`CFBundleShortVersionString`)

1. Abrir `ios/App/App.xcodeproj` en Xcode ▸ target **App** ▸ _General_ ▸
   **Version** (o editar `MARKETING_VERSION` en `project.pbxproj`).
2. Commit a `dev`. En el siguiente deploy la build saldrá con esa versión y el
   build number se calcula solo (cada versión acepta builds únicos; nuestro
   esquema sigue siendo monótono y válido).

### Renovar certificado / perfil (expiran ~1 año)

```bash
MATCH_READONLY=false bundle exec fastlane ios signing
# si Apple exige recrear desde cero:
FORCE_SIGNING=true MATCH_READONLY=false bundle exec fastlane ios signing
```

### Rotar credenciales

| Credencial       | Procedimiento                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API Key (`.p8`)  | App Store Connect ▸ Integrations ▸ revocar key vieja ▸ crear nueva (App Manager) ▸ actualizar secretos `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY` |
| `MATCH_PASSWORD` | `bundle exec fastlane match change_password` (re-cifra el repo con la nueva) ▸ actualizar el secreto y el gestor de contraseñas                                                               |
| PAT de lectura   | GitHub ▸ Settings ▸ Developer settings ▸ Fine-grained tokens ▸ regenerar ▸ recalcular `MATCH_GIT_BASIC_AUTHORIZATION`                                                                         |
| Certificado      | lane `signing` con `MATCH_READONLY=false` (y `FORCE_SIGNING=true` si aplica); funciona aunque el cert viejo exista                                                                            |

### Detener temporalmente el autodespliegue

- **Opción rápida**: GitHub ▸ Actions ▸ workflow **iOS · TestFlight** ▸ menú
  `···` ▸ _Disable workflow_. Reactivar: _Enable workflow_.
- **Opción quirúrgica**: comentar el bloque `push:` en
  `.github/workflows/ios-testflight.yml` (queda solo el manual).
- **Solo menos despliegues**: añadir al job `testflight` la condición
  `if: github.event_name == 'workflow_dispatch'`.
- **Xcode Cloud** (si sigue activo como integración aparte): se detiene en
  App Store Connect ▸ **Xcode Cloud** ▸ _Manage Workflows_ ▸ desactivar/eliminar
  el workflow `Default`.

---

## 11. Troubleshooting

| Síntoma                                                        | Causa / solución                                                                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Couldn't find a matching provisioning profile` en `gym`       | No se ejecutó `fastlane ios signing` o el repo de certs está vacío. Ejecutarlo con `MATCH_READONLY=false`                                                      |
| `No profiles for 'com.coppadresd.mobile' were found`           | Match no pudo clonar/descifrar: revisar `MATCH_PASSWORD` y `MATCH_GIT_BASIC_AUTHORIZATION`                                                                     |
| `Failed to get matching certificates` / límite de certificados | Revocar certs viejos en [developer.apple.com](https://developer.apple.com/account/resources/certificates) ▸ Certificates, o regenerar con `FORCE_SIGNING=true` |
| `ERROR ITMS-4238: Redundant Binary Upload`                     | Build number duplicado: el workflow usa `concurrency` y TestFlight+1; forzar `BUILD_NUMBER` o esperar a que Apple registre el build previo                     |
| `The bundle identifier ... was not found`                      | El App ID debe existir en developer.apple.com y la app en App Store Connect (ya existen)                                                                       |
| `Missing Compliance` en TestFlight                             | Responder el formulario de cifrado en App Store Connect (una vez por versión)                                                                                  |
| Falla el check `App \| Default` en PRs                         | Es **Xcode Cloud** (integración aparte en App Store Connect), no este pipeline; no bloquea el despliegue. Desactivarlo si se adopta GitHub Actions             |
| Falla `npm run release:check`                                  | `Info.plist` conserva ATS de desarrollo (`NSAllowsArbitraryLoads`/`NSAllowsLocalNetworking`): revertir antes de archivar                                       |
| `xcodebuild` no resuelve paquetes SPM                          | En CI se ejecuta `yarn install` + `npx cap sync ios` antes del archive (los plugins de Capacitor son paquetes SPM locales de `node_modules`)                   |
| `errSecInternalComponent` / prompts de keychain en CI          | `setup_ci` crea el keychain temporal; verificar que el lane corre con `CI=true`                                                                                |
| Cambió el Xcode del runner y falla el build                    | El workflow fija `xcode-version: "26.6"` en una imagen `macos-26`; si GitHub retira esa versión, actualizar el pin en el workflow                              |
| `Mixing lockfiles` en el log de Yarn                           | Ruido por `package-lock.json`/`pnpm-lock.yaml` obsoletos; no rompe el build (recomendado eliminarlos)                                                          |

---

## 12. Seguridad

- `.gitignore` bloquea `*.p8`, `*.p12`, `*.mobileprovision`, `*.cer`, `*.key`,
  `fastlane/.env*`, IPAs y artefactos.
- El `.p8` y `MATCH_PASSWORD` viven **solo** en: keychain/gestor de contraseñas
  del equipo, GitHub Secrets y (para el `.p8`) `~/.appstoreconnect/`.
- `fastlane match` cifra los certificados antes de subirlos al repo privado.
- `.env.production` sí se versiona **a propósito**: solo contiene variables
  `VITE_*` públicas que Vite incrusta en el bundle. Nunca poner secretos ahí.
- Historial del repo: sin secretos (auditado; no se encontraron `.p8/.p12/
.mobileprovision` ni `.env` versionados).

---

## 13. Archivos que componen el pipeline

| Archivo                                | Rol                                                      |
| -------------------------------------- | -------------------------------------------------------- |
| `fastlane/Fastfile`                    | Lanes `check`, `signing`, `build`, `beta`                |
| `fastlane/Appfile`                     | Bundle ID + Team ID                                      |
| `fastlane/Matchfile`                   | Repo de certificados (`MATCH_GIT_URL`)                   |
| `Gemfile` / `Gemfile.lock`             | Versión exacta de fastlane                               |
| `.github/workflows/ios-testflight.yml` | CI/CD en GitHub Actions                                  |
| `.env.production`                      | Config pública del bundle de producción (versionada)     |
| `ios/App/App.xcodeproj`                | Proyecto real (bundle id, team, versiones) — sin cambios |
