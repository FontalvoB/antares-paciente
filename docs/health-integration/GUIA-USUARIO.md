# Guía: conecta tu anillo o banda con Copp Adresd

> Para participantes del programa y para el equipo de soporte. Lenguaje del usuario final.
> Las rutas de menú de apps de terceros pueden cambiar con sus actualizaciones.
> `[[CONFIRMAR: revisar rutas en la versión vigente de cada app antes de publicar esta guía]]`

## Cómo funciona (en 10 segundos)

```
Tu anillo o banda  →  su app  →  Apple Health (iPhone) o Health Connect (Android)  →  Copp Adresd
```

- Tu accesorio **no** se conecta directamente a Copp Adresd.
- La app de tu accesorio guarda tus datos en la app de salud de tu teléfono.
- Copp Adresd **solo lee** los datos que tú autorices. **No escribe ni cambia nada.**
- Puedes quitar el permiso cuando quieras.
- Tu accesorio es de bienestar: sus datos son **estimaciones** y no sustituyen la opinión de un profesional.

## Qué datos leemos

Pasos, distancia, energía activa, frecuencia cardíaca, frecuencia cardíaca en reposo y sueño.
`[[CONFIRMAR: lista final]]`. Puedes autorizar solo algunos. No vendemos tus datos ni los usamos
para publicidad.

---

## iPhone (Apple Health)

### Paso 1 — Abre la app de tu accesorio

Comprueba que muestra datos recientes (de hoy o de anoche).

### Paso 2 — Activa la sincronización con Apple Health

En los ajustes de la app de tu accesorio busca **Apple Health**, **Salud** o **Apps conectadas**
y actívalo. Si te pregunta, permite que la app **escriba** en Salud (ese permiso es para tu
accesorio, no para Copp Adresd).

### Paso 3 — Autoriza la lectura en Copp Adresd

1. Abre Copp Adresd y toca **Conectar** en el inicio (o **Perfil > Accesorio y datos de bienestar**).
2. Toca **Autorizar lectura** y luego **Continuar**.
3. En la ventana de Salud, activa las categorías que quieras compartir y toca **Permitir**.
4. Verás "¡Listo! Tu accesorio está conectado" y tus datos de hoy.

### Si no ves datos

iPhone no le dice a Copp Adresd si negaste el permiso, por eso revisa las dos cosas:

1. **Que tu accesorio sincronice con Salud**: abre la app Salud > Explorar > Actividad o Sueño y comprueba que hay datos recientes de tu accesorio.
2. **Que Copp Adresd tenga permiso**: Ajustes > Salud > Acceso a datos y dispositivos > Copp Adresd > activa las categorías. (También en la app Salud > tu foto de perfil > Apps.)

Después vuelve a Copp Adresd y toca **Actualizar**.

### Quitar el permiso

Ajustes > Salud > Acceso a datos y dispositivos > Copp Adresd > desactiva las categorías.
Copp Adresd deja de leer desde ese momento.

---

## Android (Health Connect)

### Antes de empezar

- **Android 14 o superior**: Health Connect ya viene en el teléfono (Ajustes > Seguridad y privacidad > Privacidad > Health Connect; la ruta varía por fabricante).
- **Android 13 o anterior**: instala **Health Connect** desde Google Play. Copp Adresd te muestra el botón **Instalar Health Connect** si falta.

### Paso 1 — Abre la app de tu accesorio

Comprueba que muestra datos recientes.

### Paso 2 — Activa la sincronización con Health Connect

En los ajustes de la app de tu accesorio busca **Health Connect** y permite que **escriba** datos.

### Paso 3 — Autoriza la lectura en Copp Adresd

1. Abre Copp Adresd y toca **Conectar** (o **Perfil > Accesorio y datos de bienestar**).
2. Toca **Autorizar lectura** y luego **Continuar**.
3. En Health Connect, activa los permisos que quieras y toca **Permitir**.

### Si no ves datos

- Abre Health Connect > Datos y acceso, y comprueba que hay datos recientes de tu accesorio.
- Health Connect solo comparte los datos de aproximadamente los **30 días anteriores** a tu primera autorización.
- Si rechazaste el permiso dos veces, Android ya no vuelve a preguntar: actívalo en **Health Connect > Permisos de apps > Copp Adresd**.

### Quitar el permiso

Health Connect > Permisos de apps > Copp Adresd > **Quitar todos los permisos**.

---

## Guía por app

| App                | iPhone (Apple Health)                                                                  | Android (Health Connect)                                                       |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Oura**           | Oura > Ajustes/Perfil > Apps conectadas > Apple Health > activar.                      | Oura > Ajustes > Apps conectadas > Health Connect > activar.                   |
| **Ultrahuman**     | Ultrahuman > Perfil > Integraciones > Apple Health > activar.                          | Ultrahuman > Perfil > Integraciones > Health Connect > activar.                |
| **Fitbit**         | Fitbit no comparte datos con Apple Health de forma oficial. Registra tus datos a mano. | Fitbit > Perfil/Ajustes > Health Connect > activar.                            |
| **Garmin**         | Garmin Connect > Más > Ajustes > Apps conectadas > Apple Health > activar.             | Garmin Connect > Ajustes > Apps conectadas > Health Connect `[[CONFIRMAR]]`.   |
| **Samsung Health** | No disponible en iPhone.                                                               | Samsung Health > Ajustes > Health Connect > permitir escritura.                |
| **Apple Watch**    | Automático. Ve directo al paso 3.                                                      | No aplica.                                                                     |
| **Otra app**       | Busca "Apple Health" o "Salud" en sus ajustes. Si no aparece, puede no ser compatible. | Busca "Health Connect" en sus ajustes. Si no aparece, puede no ser compatible. |

Anillo o banda entregado por el programa: `[[CONFIRMAR: app oficial y si escribe en Apple Health / Health Connect; añadir fila con su ruta]]`.

## No tengo accesorio o no quiero autorizar

No pasa nada: el programa funciona igual. Toca **Registrar a mano** para anotar tus datos, o
**Ahora no**. Puedes conectar tu accesorio más tarde desde **Perfil > Accesorio y datos de bienestar**.

## Preguntas frecuentes

- **¿Copp Adresd escribe en mi app de salud?** No. Solo lee lo que autorices.
- **¿Se actualiza solo?** Copp Adresd lee tus datos cada vez que abres la app o tocas **Actualizar**. No lee en segundo plano.
- **¿Gasta batería?** Muy poca: solo lee mientras usas la app.
- **¿Mis pasos salen duplicados si uso reloj y teléfono?** Apple Health y Health Connect combinan las fuentes; Copp Adresd usa ese total. `[[CONFIRMAR: lectura agregada implementada]]`
- **¿Estos datos sirven para un diagnóstico?** No. Son estimaciones de un accesorio de bienestar. Ante cualquier duda de salud, consulta a un profesional.
