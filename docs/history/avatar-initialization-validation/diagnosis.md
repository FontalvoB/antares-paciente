# Diagnóstico previo a modificar código

14/09/2026. Inspeccionados AvatarPage, useAvatarProgress, useAvatarConfiguration, AvatarBodyState, AvatarViewer, WeightRecordModal, servicios HTTP y disponibilidad de sesión en AppContext/Router. No se modificó código durante esta inspección.

- useAvatarProgress YA ejecuta GET automáticamente al montar con token real. El efecto también se ejecuta al cambiar attempt después de refresh. No hay dos consultas HTTP distintas.
- «Actualizar historial» NO llama refresh: abre WeightRecordModal. Solo después de POST correcto y cierre del modal se invoca progress.refresh(). Esa diferencia de comportamiento sí está comprobada en el código.
- Preferencias e historial arrancan en paralelo. AvatarViewer espera ambos resultados, aplica morphs antes del primer render y espera los módulos equipados. La inicialización no sigue todavía el orden preferencias → historial solicitado.
- GET de historial utiliza caché HTTP por defecto; no se ha demostrado que una respuesta cacheada cause el síntoma. Se solicitará no-store únicamente en la carga del avatar.
- Una respuesta de preferencias nula/204 no tiene fallback explícito; los errores no deben confundirse con preferencias ausentes.
- Router espera authLoading, pero AvatarPage/hooks no expresan por sí mismos esa dependencia. La corrección mantendrá ese requisito de forma explícita sin tocar Auth.

Reproducción con código anterior:

1. Ensayo controlado con los componentes/GLB reales: GET automático, primer frame BodyLean=.5, sin pulsar refresh. Historial ~2.510 ms; avatar visible ~4.022 ms. `before/before.json`.
2. Navegador real en localhost:5173: la sesión inicial era demo y la pantalla informó correctamente que no consulta mediciones reales. Se inició sesión normalmente con la cuenta de pruebas ya autorizada; sin migraciones ni reinicios.
3. Entrada desde perfil a Mi evolución con API real: cuatro registros existentes, configuración femenina, primer frame BodyVolume=1 y BodyLean=0, elementos equipados, Idle. Historial ~10.480 ms; GLB ~170 ms; avatar visible ~12.670 ms. No se pulsó Actualizar historial ni se guardó peso. `before/live.json`.

Conclusión: el síntoma de «no consulta hasta pulsar refresh» NO se reprodujo ni con API real ni en el ensayo controlado. No es correcto afirmar que faltaba el efecto inicial, que el GLB era neutral o que la caché era la causa demostrada. Sí se corrigen la semántica del botón, el orden explícito, la reutilización de la carga y la ausencia de preferencias. La latencia real previa queda registrada; no se hará optimización ni cambios de backend.
