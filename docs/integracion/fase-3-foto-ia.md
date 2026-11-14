# Foto IA — trazabilidad del registro (3.5)

Rama `org/f3-antares-paciente` desde F2 `d701fee962984dab44396fbb5fcd28447ca208ce`,
en `.worktrees/app-f3`. Contrato: tareas 3.5/3.6 del change
`organizar-experiencia-bienestar`, `NUTRICION-CICLOS.md` y contexto
`coppAddresdBack/docs/modules/food-ai/README.md`.

## Payload y estado

`POST /api/v1/program/nutrition/log` recibe:

```json
{
  "mealCode": "des",
  "clientRequestId": "UUID del borrador analizado",
  "intake": {
    "source": "ai_photo",
    "foodAnalysisId": "ID del análisis devuelto por Foto IA",
    "calories": 520,
    "proteinG": 30,
    "carbsG": 60,
    "fatG": 15,
    "fiberG": 5
  }
}
```

`clientRequestId` sigue la convención JSON camelCase de la API; corresponde a
`client_request_id` en persistencia. `foodAnalysisId` permanece dentro de
`intake`, donde el backend lo enlaza; no se aplana en el body.

El flujo actual ya estaba extraído de `NutritionPage` a `MealFoodFlow` y ya
conservaba el análisis al confirmar o editar los nutrientes. Por eso el cambio
de estado se aplica en ese componente y se propaga por `useNutritionLog` al
servicio de registro, sin duplicar lógica en la página ni modificar su UI.
El UUID nace con el resultado del análisis y sobrevive a editar valores y a
reintentar el guardado. Cambiar de foto reemplaza análisis y UUID. Ante un fallo
de transporte, la cola conserva el mismo UUID tanto en el payload como en la
entrada. Los registros anteriores sin identificador mantienen su body.

## Verificación

`NutritionPage.food-analysis.test.tsx` abre Foto IA desde la página y usa
`MealFoodFlow`, formulario, hook y servicio reales. Sustituye cámara, análisis
y transporte; comprueba el body serializable que recibe `apiFetch`:

- Confirmar: nutrientes del resumen del análisis y su ID.
- Corregir: nutrientes editados y el mismo ID de análisis.
- Original: nutrientes originales de `intake` cuando no llega `summary`, y el ID.
- Error de transporte/reintento: mismo body y UUID en envío, cola y segundo intento.
- Cambiar foto: otro ID de análisis y otro UUID.

Las verificaciones de autorización del análisis y deduplicación en base de datos
pertenecen al backend 3.6. Estas pruebas son locales de contrato del cliente;
no prueban persistencia ni autorización contra la API real.

QA: `npm run lint` correcto con advertencias existentes; `npm test` correcto,
1635/1635 pruebas en 202 archivos; `npm run build` correcto con el aviso
existente de tamaño de chunks. `git diff --check` correcto. Sin cambios de
UI, traducciones, backend ni `tasks.md`; sin push.
