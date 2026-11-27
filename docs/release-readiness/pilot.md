# KAN-171 · Piloto cerrado de Agentic Wellness IA

**Protocolo de ejecución.** No hay resultados de piloto en este documento. Reclutar 30–50 personas para 2–4 semanas, con cobertura de iOS/Android y ES/EN. Antes de invitar, Product y QA acuerdan la distribución, el criterio de inclusión y la ventana de observación. Soporte necesita un responsable y un canal privado de feedback. [KAN-171](https://diomedescerda.atlassian.net/browse/KAN-171)

## Antes de la primera invitación

- Fijar ventana del piloto, builds por plataforma, entorno, versiones de documentos, zona horaria de referencia y responsables de go/no-go, soporte e incidentes. Validar que el build pueda distribuirse en un grupo cerrado en las dos plataformas.
- Con una cuenta sintética por combinación de plataforma e idioma, ensayar alta, objetivo/plan, protocolo/cofre, ayuda, desactivación de analítica y solicitud de privacidad. Si se prueba SOS, usar destinos de QA. No provocar llamadas de emergencia ni mensajes a contactos reales.
- Validar [KAN-177](https://diomedescerda.atlassian.net/browse/KAN-177) y los eventos de v5.1 §7.2. Reproducir envío normal, cola offline y reintento. Exigir una sola llegada por evento lógico y ninguna emisión después de rechazar o retirar la medición correspondiente. En reportes conservar solo identificador seudónimo del piloto, fecha/día del producto, plataforma, idioma, build y metadatos de evento permitidos. No recoger lecturas, contactos, ubicación, texto libre, audio, correo ni teléfono en analítica. Mantener invitaciones y feedback identificable separados de los eventos con acceso limitado.
- Product acuerda antes del día 0 los umbrales aún sin número en Jira (activación y NPS/CSAT), el canal de fallos y qué se considera incidente crítico. Si faltan estas decisiones, el consentimiento o la instrumentación, no hay base para interpretar el piloto como criterio de lanzamiento.

## Medición y criterios de salida

Usar cada evento lógico una vez, calcular días según la fecha local de la persona y excluir cohortes que aún no tuvieron tiempo de llegar al día que se mide. Informar recuentos y denominadores, no solo porcentajes. Incluir participantes con consentimiento en las métricas que lo requieran y reportar la cobertura por separado para no confundir ausencia de eventos con ausencia de uso.

| Medida | Cálculo o evidencia | Criterio |
| --- | --- | --- |
| Activación | Personas con `registro_completado` ÷ personas con `registro_iniciado`, en la ventana acordada. | ≥ umbral acordado antes del piloto. |
| Objetivo y plan | Entre altas completadas, personas con `objetivo_elegido` y personas con `plan_generado`, por separado. | Revisar caídas de conversión por build e idioma. |
| Adherencia y retorno D7/D14 | Días con `protocolo_completado` ÷ persona-días observables tras generar un plan. Para cada D7/D14, personas activas ese día ÷ cohortes elegibles (día de activación = D0). Acordar y documentar qué evento define actividad antes del piloto. | Reportar D7/D14 aunque el promedio acumulado sea bueno. |
| Cofre | Personas-día con `cofre_abierto` ÷ personas-día elegibles según pasos 1–4 de `paso_completado`. | Investigar más de un cofre por persona-día o divergencias entre los pasos y los registros. |
| SOS y Vita | `sos_activado` e `ia_consulta(modulo)` agregados. Incidentes de flujo se obtienen del canal de soporte, no de contenido personal en la analítica. | No inferir entrega de SOS ni seguridad de una respuesta a partir del recuento de uso. |
| Estabilidad e incidentes | Sesiones sin crash ÷ sesiones observadas en telemetría con cobertura documentada. Clasificar incidentes por gravedad, build, impacto y acción. | ≥99,5 % sin crash y 0 incidentes críticos. Denominador vacío = sin evidencia, no 100 %. |
| Satisfacción | CSAT o NPS según decisión previa. Registrar pregunta, escala, respuestas, tasa de respuesta y comentarios anonimizados. | ≥ objetivo acordado, o mitigación y reevaluación documentadas. |

## Soporte, rollback y decisión

1. Informar a participantes cómo enviar comentarios sin adjuntar datos sensibles y cómo retirarse. Revisar diariamente activación, errores, tickets y cobertura de datos; guardar recuentos, no copias del contenido del usuario.
2. Ante un incidente crítico, detener invitaciones, aislar el flujo o build por el mecanismo ensayado y notificar a los participantes por el canal acordado. Registrar impacto, hora, versión, mitigación, recuperación y responsable. QA debe repetir las comprobaciones afectadas antes de reanudar. Ensayar deshabilitar versiones/flags antes de empezar. No asumir que retirar un build desinstala una app ya distribuida.
3. Al cierre, guardar días y tamaño de la cohorte, builds, resultados por plataforma/idioma cuando el volumen lo permita, denominadores, desviaciones e incidentes. Hacer go solo con evidencia completa y criterios satisfechos, o una decisión explícita de Product sobre cualquier mitigación no crítica. Un incidente crítico o evidencia insuficiente es no-go hasta resolver y repetir los checks correspondientes. Registrar la decisión fechada, Product/QA, acciones y enlace al informe.
