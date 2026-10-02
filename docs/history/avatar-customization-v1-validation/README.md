# Mi Avatar: personalización, piel y pantalones

Implementación del 14/09/2026. UI y contrato ampliados; assets reales exportados. La validación de guardado en el servicio activo está pendiente de activar el contrato actualizado de Auth mediante un procedimiento autorizado.

## Experiencia

La página existente Mi Avatar conserva Mi evolución y la carga posterior a preferencias + historial. Incorpora categorías con Ionicons (body, shirt, cut, watch) sobre pequeñas superficies CSS con relieve; no hay escenas GLB para iconos ni dependencias nuevas. Incluye controles frontal/perfil, acercar/alejar/restablecer, cinco muestras de piel, camiseta, pantalón, zapatos, cabello y accesorios. Selección inmediata, guardado explícito, confirmación, error con borrador conservado y reintento.

## Estado y piel

AvatarConfiguration/AvatarState incorporan `skin`: skin-01 Claro, skin-02 Claro medio, skin-03 Medio, skin-04 Medio oscuro, skin-05 Oscuro. Las configuraciones antiguas sin este campo conservan sus opciones y reciben skin-03. Nuevas configuraciones sin preferencias reciben pantalón 01 compatible; un `pants:null` guardado sigue vacío. El cambio de género conserva piel y opciones compartidas, y retira exclusivamente IDs incompatibles.

El tono modifica una uniform del shader de materiales corporales. Reutiliza textura original, normales y ORM. Una máscara cromática conserva zonas neutras/oscuras del atlas; no se aplica a materiales de prendas, pelo o accesorios. Es una máscara artística sobre estos atlas, no una segmentación anatómica universal para futuros cuerpos. No se duplican texturas por tono. El catálogo de tonos está separado del código Three.js para mantener la carga diferida del visor.

BodyState, fórmulas, mediciones e historial permanecen separados y sin cambios.

## Assets

Raíz: `public/models/avatar/`.

| Asset | Archivo | Triángulos |
|---|---|---:|
| pants-male-01, deportivo | clothing/pants/pants-male-01.glb | 4.269 |
| pants-male-02, casual arena | clothing/pants/pants-male-02.glb | 4.269 |
| pants-male-03, denim amplio | clothing/pants/pants-male-03.glb | 4.269 |
| pants-female-01, deportivo | clothing/pants/pants-female-01.glb | 2.144 |
| pants-female-02, casual arena | clothing/pants/pants-female-02.glb | 2.144 |
| pants-female-03, denim amplio | clothing/pants/pants-female-03.glb | 2.144 |
| shoes-male-01 | clothing/shoes/shoes-male-01.glb | 578 |
| shoes-female-01 | clothing/shoes/shoes-female-01.glb | 464 |

Los pantalones tienen distinta holgura/silueta y materiales PBR mates, no solo cambios de color. Los femeninos usan un patrón continuo de cintura, bifurcación y perneras regulares para eliminar defectos heredados de la superficie corporal. Todos los módulos incorporan los nueve morphs y pesos normalizados del rig canónico. Usan el Idle del cuerpo; no incluyen ni requieren otra animación. No se modificaron los GLB corporales ni las prendas anteriores.

Fuente editable final: `sources/customization-v1/customization-final.blend`. `export-manifest.json` contiene tamaños exactos. `SCENE-PASSPORT.md`, scripts de construcción y capturas conservan el proceso; las capturas intermedias no son la entrega final. La fuente Blender final contiene los refinamientos posteriores a la construcción inicial.

## Persistencia

Se reutiliza `auth."UserPreferences"."AvatarConfiguration"` (JSONB). Sin nuevas tablas ni migraciones. GET/PUT `/api/auth/me/avatar`, controlador, casos de uso y store existentes; autoridad exclusivamente del JWT. Se amplía el DTO con Skin opcional por compatibilidad y el catálogo de dominio con seis pantalones y dos zapatos. Se rechazan IDs, tonos, slots y géneros incompatibles. No se aceptan campos clínicos ni userId como autoridad. Idioma y color de acento se conservan.

Prueba HTTP/JWT/PostgreSQL: 2 géneros × 5 tonos × 3 pantalones, pelo compatible, camiseta, zapatos y tres accesorios; PUT + GET y aislamiento entre usuarios. Se ejecuta con una conexión real configurada y rollback, sin mediciones ni cambios permanentes en identidades. Ver log backend `.artifacts/avatar-customization-postgres.log`. La prueba optativa que escribe en la cuenta demo permaneció deshabilitada.

## Validación

- 31 pruebas frontend: carga, sesiones, borrador tras fallo, compatibilidad, defaults antiguos y estabilidad del catálogo.
- .NET: 13 casos reportados correctos; uno es el opt-in de escritura demo deshabilitado. La prueba PostgreSQL/JWT fue ejecutada además individualmente y pasó.
- Build de producción correcto; lint sin errores, con avisos preexistentes; traducciones sin claves faltantes.
- `scripts/avatar-customization-check.mjs`: componentes, WebGL y GLB reales con HTTP controlado. Selección de las seis prendas; cinco tonos por género; guardado fallido + reintento; recarga y restauración de todos los slots; BodyVolume 0/.25/.5/.75/1 y BodyLean .5/1; móvil y escritorio. `browser/results.json` guarda resultados y métricas.
- `glb-audit.json`: hashes, nueve morphs y matrices inverse-bind comparadas con cada GLB corporal.
- Blender: `sources/customization-v1/fit-audit.json`, 280 muestras (8 módulos × 7 estados × 5 frames). La distancia al triángulo más próximo no distingue superficies ocultas/entrepierna: existen valores negativos residuales; no equivale a una certificación de cero intersecciones. La revisión visual final se apoya en las capturas del patrón continuo y del visor, no en los renders iniciales descartados.
- Las pruebas del navegador no sustituyen Android/iPhone físicos; esas pruebas permanecen manuales según la decisión anterior del usuario.

## Circuito real pendiente

La sesión real carga preferencias e historial y permite previsualizar el nuevo tono. Al intentar guardarlo muestra el error y conserva el borrador (`live.json`). Se descartó el borrador de prueba recargando, sin modificar mediciones.

El proceso Auth activo es anterior a esta ampliación. No se reinició ni se alteró su arranque: ejecuta migraciones y seeders con escrituras ajenas al avatar. No se modificaron ERP, AddErpApplicationSuspension, login, gateway ni Next.js/admin. Se localizó el puerto correcto en launchSettings: 5123. Su Swagger activo expone version/gender/hair/clothing/accessories, pero NO skin; avatar-active-contract.json confirma que el contrato ampliado aún no está cargado. La primera sonda al antiguo 5058 no conectó. La validación por TestServer no sustituye el circuito normal de producción.

Paso pendiente: activar el binario con el contrato actualizado mediante un procedimiento autorizado y repetir la selección completa femenino (skin-04 + pants-female-02 + cabello largo + camiseta + gafas/reloj) y masculino, salir y regresar por la app normal. No requiere otra migración del avatar.

## Archivos de esta fase

Frontend: AvatarCustomizer.tsx, AvatarViewer.tsx, avatar-state.ts, avatar-equipment.ts, nuevos avatar-skin.ts y avatar-skin-catalog.ts; AvatarPage.tsx; avatar-configuration-service.ts; global.css; es.json/en.json. Pruebas: avatar-configuration.test.tsx, nuevo avatar-customization-contract.test.ts y scripts/avatar-customization-check.mjs.

Backend: Application/Avatar/AvatarConfiguration.cs, Domain/Avatar/AvatarCatalog.cs y pruebas AvatarConfigurationTests.cs/AvatarPostgresTests.cs. No se cambiaron controlador, store, Auth general ni gateway.

Assets: ocho GLB nuevos, fuente editable y scripts/evidencias bajo sources/customization-v1. Informe y evidencia de esta fase bajo docs/avatar-customization-v1-validation.

## Rendimiento final

Edge de escritorio con viewport móvil, sin limitación de CPU/GPU. Conjunto completo con camiseta, pantalón 02, zapatos, cabello y tres accesorios.

| Género | FPS observados | Draw calls | Bytes GLB totales | Heap JS MiB (muestra) |
|---|---:|---:|---:|---:|
| female | 36.9–61.5 | 14 | 7,043,764 | 132.0 |
| male | 56.7–61.5 | 13 | 4,778,784 | 221.8 |

La memoria es del proceso JavaScript de la página, no memoria GPU ni consumo físico de un teléfono. Tamaños individuales/hashes en glb-audit.json. No se instalaron dependencias.
