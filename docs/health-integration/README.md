# Integración con Apple Health / Health Connect — paquete UX, copy y revisión (1.0)

> Estado: **diseño y documentación** (2026-11-21). La implementación la hace codex con
> `@capacitor/health-fitness` v8. Todo lo que dependa de su implementación está marcado como
> `[[CONFIRMAR: ...]]`. Este paquete no modifica `src/`, `ios/`, `android/` ni `docs/app-review/`.

## Contexto

App Review rechazó iOS 1.0 (63) por **1.4.1** (hardware conectado sin clearance / test report) y
**2.1** (falta video del flujo BLE). Vía rápida acordada: publicar 1.0 **sin conexión BLE directa**
y leer los datos que el accesorio de bienestar ya guarda en **Apple Health (app Salud)** en iOS o
**Health Connect** en Android, solo con permiso explícito. El código BLE se conserva para 1.1
detrás de feature flag (`src/utils/features.ts`).

## Índice

| Documento                                                  | Para quién                     | Contenido                                                                |
| ---------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------ |
| [UX-FLOW.md](UX-FLOW.md)                                   | Diseño / codex                 | Entradas, máquina de estados, pasos 1-2-3, guía por app, a11y, motion    |
| [COPY-ES-EN.md](COPY-ES-EN.md)                             | codex (i18n)                   | Todas las cadenas ES/EN, textos de permiso iOS, rationale Health Connect |
| [GUIA-USUARIO.md](GUIA-USUARIO.md)                         | Usuario final / soporte        | Paso a paso por plataforma y por app                                     |
| [APP-REVIEW-HEALTH.md](APP-REVIEW-HEALTH.md)               | Owner / quien envía a revisión | Notas para revisor, privacidad, 5.1.1/5.1.2/5.1.3, qué no afirmar        |
| [CHECKLIST-IMPLEMENTACION.md](CHECKLIST-IMPLEMENTACION.md) | QA / codex                     | Matriz de pruebas de diseño e implementación                             |

## Decisiones

| #   | Decisión                                                                                                                                       | Motivo                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| D1  | **Solo lectura.** La app no escribe en Apple Health ni en Health Connect en 1.0.                                                               | Minimiza permisos, superficie de revisión (5.1.3) y riesgo de datos incorrectos en la fuente del usuario.              |
| D2  | **Set mínimo de tipos de dato**: pasos, distancia, energía activa, frecuencia cardíaca, frecuencia cardíaca en reposo y sueño.                 | Minimización de datos (5.1.1). Son las métricas que la app ya muestra. `[[CONFIRMAR: tipos soportados por el plugin]]` |
| D3  | **No leer** SpO2, presión arterial, glucosa, temperatura ni ECG en 1.0.                                                                        | Son métricas percibidas como clínicas; reintroducen el riesgo 1.4.1 / claims médicos.                                  |
| D4  | **Sin sincronización en segundo plano**: se lee al abrir la pantalla, al volver a primer plano y con "Actualizar".                             | Evita background modes / permisos extra (`READ_HEALTH_DATA_IN_BACKGROUND`) y el requisito de video 2.1.                |
| D5  | **Una sola pantalla asistida** ("Conecta tu accesorio") con pasos 1-2-3 adaptados a la plataforma detectada; nunca mostrar la otra plataforma. | Objetivo de comprensión en 10 s. Mostrar Apple Health en Android (o viceversa) confunde y App Review lo penaliza.      |
| D6  | **Pre-permiso propio** antes del diálogo del sistema, con la lista exacta de datos y un enlace a privacidad.                                   | Aumenta la tasa de aceptación y deja claro el propósito antes del diálogo nativo (no reemplaza al nativo).             |
| D7  | **El registro manual siempre es una salida válida**, visible en todos los estados.                                                             | El accesorio es opcional; no bloquear el programa por no tener accesorio o no autorizar.                               |
| D8  | **No nombrar modelos de hardware** (H59/R88) ni hablar de "medir" o "conectar por Bluetooth" en la UI de 1.0.                                  | 1.0 no se conecta a hardware; nombrar el anillo reabre 1.4.1.                                                          |
| D9  | **"Apple Health" / "app Salud"** en la UI; nunca "HealthKit" visible para el usuario.                                                          | Guías de marca de Apple; HealthKit es el framework, no el producto.                                                    |
| D10 | **Datos de Apple Health/Health Connect no se envían a la IA** en 1.0 salvo que el aviso de IA lo declare explícitamente.                       | 5.1.2(i) y 5.1.3: compartir datos de salud con terceros (proveedores de IA) exige divulgación y permiso específicos.   |
| D11 | Tokens del design system existente (`--wellness-*`, `--brand-*`, `--grad-brand-v`); sin dark mode (no existe en la app).                       | Consistencia visual; AGENTS.md.                                                                                        |
| D12 | Nombre de la marca en copy: **Copp Adresd**.                                                                                                   | Coherente con la ficha de App Store.                                                                                   |

## Dependencias abiertas con codex

**Android, justificación de permisos.** El AAR transitivo
`io.ionic.libs:ionhealthfitness-android:1.0.1` del plugin oficial aporta
`com.outsystems.plugins.healthfitness.PermissionsRationaleActivity` para
`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`. El manifest fusionado de
la app también contiene su alias `ViewPermissionUsageActivity` con
`android.intent.action.VIEW_PERMISSION_USAGE` y
`android.intent.category.HEALTH_PERMISSIONS`. La actividad lee
`privacy_policy_url`, que se genera desde `android/healthfitness.config.json`.

1. API real del plugin para disponibilidad, permisos, lectura agregada y origen del dato (`[[CONFIRMAR]]` en UX-FLOW §3).
2. Si las muestras leídas se envían al backend (p. ej. vía `metrics-outbox`) y con qué deduplicación.
3. Si el chat IA recibe métricas del accesorio como contexto.
4. Nombre del feature flag para la entrada nueva (p. ej. `HEALTH_SYNC_ENABLED`) y su relación con `WEARABLE_ENABLED`.
5. Si la app del fabricante del anillo del programa escribe en Apple Health / Health Connect (ver riesgos en APP-REVIEW-HEALTH §8).
