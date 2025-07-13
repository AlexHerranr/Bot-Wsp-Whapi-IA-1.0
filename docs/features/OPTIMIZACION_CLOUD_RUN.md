# Optimización Cloud Run: Cleanup y Monitoreo Proactivo

## Cleanup Automático de Tokens
- Cada hora, el bot revisa todos los threads activos.
- Si un thread supera el umbral de tokens (`THREAD_TOKEN_THRESHOLD`, default 8000), se genera un resumen y se podan/migran mensajes antiguos.
- Si la optimización falla, se migran los últimos 10 mensajes a un nuevo thread y se elimina el anterior.

## Métricas Prometheus
- `fuzzy_hits_total`: Total de fuzzy matches (patrones/contexto).
- `race_errors_total`: Total de errores de race condition (locks/timeouts).
- `token_cleanups_total`: Total de cleanups ejecutados.
- `high_token_threads`: Número de threads con tokens altos.

## Alertas
- Se recomienda configurar alertas si:
  - `fuzzy_hits_total` crece inusualmente rápido (posible UX issue).
  - `race_errors_total` > 0 (problemas de concurrencia).
  - `high_token_threads` > 5 (posible leak o abuso).

## Beneficios
- Previene crecimiento indefinido de memoria y tokens.
- Reduce latencia y errores por threads saturados.
- Facilita monitoreo y escalabilidad en producción. 