# KAN-162 · Ajuste de plan del Motor 365

Antares muestra la acción en «Tu Plan de Bienestar» únicamente cuando el
servidor anuncia que el día es elegible. Solicitar o revertir un ajuste usa la
sesión del paciente y pasa por el Gateway. Antares no envía ni calcula los
valores propuestos ni contacta a un proveedor. La respuesta del motor contiene
el motivo en español e inglés y un nuevo GET sincroniza dieta y ejercicio.

Si cambia la sesión, el día o la conectividad, la app deja de ofrecer la
acción hasta volver a verificar el plan. La caché local de Motor 365 no guarda
el plan ajustado. El proveedor remoto no forma parte de esta entrega.

El recorrido se verifica desde el repositorio de backend con
`npm run test:kan162` en `tests/CoppAddresd.Wellness365.E2E`.
