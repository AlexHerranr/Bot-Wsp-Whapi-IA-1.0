# Guía de Troubleshooting y FAQ

## **Resumen Ejecutivo**

Esta guía ayuda a resolver problemas comunes del bot, interpretar métricas y responder preguntas frecuentes sobre operación y mantenimiento.

## **Problemas Comunes y Soluciones**

### **1. Race Errors Elevados**

#### **Síntomas**
- Métrica `race_errors_total` crece rápidamente
- Logs: `THREAD_LOCK_BUSY` frecuentes
- Usuarios reportan respuestas duplicadas o lentas

#### **Causas Posibles**
- Muchos usuarios enviando mensajes simultáneamente
- Latencia alta de OpenAI (causa timeouts de lock)
- Código que no libera locks correctamente

#### **Soluciones**
```bash
# 1. Verificar métricas
curl http://localhost:3008/metrics | grep race_errors_total

# 2. Revisar logs de locks
grep "THREAD_LOCK" logs/bot.log | tail -20

# 3. Ajustar timeout si es necesario
export LOCK_TIMEOUT=45000  # Aumentar a 45 segundos
```

#### **Prevención**
- Monitorear `rate(race_errors_total[5m])`
- Configurar alerta si > 0.1 por minuto
- Revisar latencia de OpenAI regularmente

### **2. Alto Uso de Tokens**

#### **Síntomas**
- Métrica `high_token_threads` > 5
- Logs: `HIGH_TOKEN_THREAD_DETECTED` frecuentes
- Respuestas lentas o timeouts

#### **Causas Posibles**
- Conversaciones muy largas sin cleanup
- Usuarios abusivos enviando muchos mensajes
- Threshold de tokens muy bajo

#### **Soluciones**
```bash
# 1. Verificar threads con tokens altos
curl http://localhost:3008/metrics | grep high_token_threads

# 2. Revisar logs de cleanup
grep "TOKEN_CLEANUP" logs/bot.log | tail -10

# 3. Ajustar threshold si es necesario
export THREAD_TOKEN_THRESHOLD=12000  # Aumentar a 12k tokens
```

#### **Prevención**
- Monitorear `high_token_threads` gauge
- Configurar alerta si > 10 threads
- Revisar logs de cleanup diariamente

### **3. Fuzzy Hits Anómalos**

#### **Síntomas**
- Métrica `fuzzy_hits_total` crece inusualmente rápido
- Logs: `FUZZY_PATTERN_MATCH` frecuentes
- Posibles falsos positivos en detección

#### **Causas Posibles**
- Usuarios con typos muy frecuentes
- Keywords demasiado permisivas
- Tolerance de Levenshtein muy alto

#### **Soluciones**
```bash
# 1. Verificar fuzzy hits
curl http://localhost:3008/metrics | grep fuzzy_hits_total

# 2. Revisar logs de fuzzy matches
grep "FUZZY" logs/bot.log | tail -20

# 3. Ajustar tolerance si es necesario
# En el código: const tolerance = 2; // Reducir de 3 a 2
```

#### **Prevención**
- Monitorear ratio de fuzzy hits vs total de mensajes
- Revisar keywords expandidas regularmente
- Ajustar thresholds dinámicos si es necesario

### **4. Runs Huérfanos Frecuentes**

#### **Síntomas**
- Logs: `ORPHANED_RUN_CANCELLED` frecuentes al inicio
- Usuarios reportan respuestas perdidas
- Inconsistencias en conversaciones

#### **Causas Posibles**
- Reinicios frecuentes del bot
- Fallos de red con OpenAI
- Timeouts muy agresivos

#### **Soluciones**
```bash
# 1. Verificar runs huérfanos
grep "ORPHANED_RUN" logs/bot.log | tail -10

# 2. Revisar estabilidad de red
ping api.openai.com

# 3. Ajustar timeout de runs
# En el código: const fiveMinutes = 10 * 60 * 1000; // Aumentar a 10 min
```

#### **Prevención**
- Monitorear estabilidad del bot
- Configurar health checks robustos
- Revisar logs de recuperación al inicio

### **5. Errores de Beds24**

#### **Síntomas**
- Logs: `BEDS24_VALIDATION` o `BEDS24_ERROR`
- Usuarios no pueden consultar disponibilidad
- Fechas no se procesan correctamente

#### **Causas Posibles**
- Fechas con typos no corregidos
- API de Beds24 no disponible
- Configuración incorrecta de Beds24

#### **Soluciones**
```bash
# 1. Verificar logs de Beds24
grep "BEDS24" logs/bot.log | tail -20

# 2. Probar API de Beds24
curl -X GET "https://api.beds24.com/json/getAuth" \
  -H "Content-Type: application/json" \
  -d '{"authentication":{"apiKey":"YOUR_KEY"}}'

# 3. Verificar fuzzy parsing de fechas
# Probar con fechas como "15 de agosot"
```

#### **Prevención**
- Monitorear disponibilidad de Beds24
- Revisar logs de validación de fechas
- Actualizar mapeo de typos si es necesario

## **Interpretación de Métricas**

### **Métricas Clave y Valores Normales**

| Métrica | Valor Normal | Alerta | Acción |
|---------|-------------|--------|--------|
| `race_errors_total` | 0-5 por hora | > 10 por hora | Revisar locks y latencia |
| `fuzzy_hits_total` | 10-50 por hora | > 100 por hora | Revisar keywords y tolerance |
| `token_cleanups_total` | 0-3 por hora | > 10 por hora | Revisar uso de tokens |
| `high_token_threads` | 0-3 | > 5 | Revisar conversaciones largas |
| `bot_messages_processed_total` | Variable | 0 por 5 min | Verificar que el bot esté activo |

### **Queries Prometheus Útiles**

```promql
# Race errors por minuto
rate(race_errors_total[1m])

# Fuzzy hits por minuto
rate(fuzzy_hits_total[1m])

# Threads con tokens altos
high_token_threads

# Cleanups por hora
rate(token_cleanups_total[1h])

# Mensajes procesados por minuto
rate(bot_messages_processed_total[1m])
```

## **FAQ - Preguntas Frecuentes**

### **Operación General**

**Q: ¿Por qué el bot responde lento?**
A: Verificar métricas de latencia, race errors y uso de tokens. Posibles causas: OpenAI lento, muchos race errors, threads con tokens altos.

**Q: ¿Por qué algunos usuarios no reciben respuesta?**
A: Verificar logs de `THREAD_LOCK_BUSY` y `ORPHANED_RUN_CANCELLED`. Posibles causas: locks no liberados, runs huérfanos, errores de red.

**Q: ¿Cómo sé si el bot está funcionando correctamente?**
A: Monitorear `bot_messages_processed_total` (debe crecer), `race_errors_total` (debe ser bajo), y logs de actividad normal.

### **Configuración y Tuning**

**Q: ¿Cuándo debo ajustar el LOCK_TIMEOUT?**
A: Si hay muchos race errors (> 10 por hora) o usuarios reportan respuestas perdidas. Aumentar de 30s a 45s.

**Q: ¿Cuándo debo ajustar el THREAD_TOKEN_THRESHOLD?**
A: Si hay muchos cleanups (> 10 por hora) o conversaciones normales se cortan. Aumentar de 8000 a 12000 tokens.

**Q: ¿Cómo ajusto la tolerance de fuzzy matching?**
A: Si hay muchos falsos positivos, reducir de 3 a 2. Si se pierden typos válidos, aumentar a 4.

### **Monitoreo y Alertas**

**Q: ¿Qué alertas debo configurar?**
A: Mínimo: race errors > 0, fuzzy hits anómalos, threads con tokens altos > 5, bot sin actividad por 5 minutos.

**Q: ¿Cómo interpreto los logs?**
A: Buscar patrones: `THREAD_LOCK` (concurrencia), `FUZZY` (typos), `TOKEN_CLEANUP` (optimización), `ORPHANED_RUN` (recuperación).

**Q: ¿Cuándo debo escalar el bot?**
A: Si race errors > 20 por hora, latencia > 10s promedio, o uso de memoria > 80%. Considerar más instancias.

## **Comandos de Debugging**

### **Verificar Estado del Bot**
```bash
# Health check
curl http://localhost:3008/health

# Métricas básicas
curl http://localhost:3008/metrics/json

# Métricas Prometheus
curl http://localhost:3008/metrics
```

### **Análisis de Logs**
```bash
# Race errors recientes
grep "THREAD_LOCK" logs/bot.log | tail -20

# Fuzzy matches
grep "FUZZY" logs/bot.log | tail -20

# Cleanups de tokens
grep "TOKEN_CLEANUP" logs/bot.log | tail -10

# Errores de Beds24
grep "BEDS24" logs/bot.log | tail -10

# Runs huérfanos
grep "ORPHANED_RUN" logs/bot.log | tail -10
```

### **Monitoreo en Tiempo Real**
```bash
# Seguir logs en tiempo real
tail -f logs/bot.log | grep -E "(ERROR|WARNING|THREAD_LOCK|FUZZY)"

# Métricas cada 30 segundos
watch -n 30 'curl -s http://localhost:3008/metrics | grep -E "(race_errors|fuzzy_hits|token_cleanups)"'
```

## **Contacto y Soporte**

Para problemas no cubiertos en esta guía:
1. Revisar logs completos en `/logs`
2. Verificar métricas en `/metrics`
3. Consultar documentación técnica en `/docs`
4. Contactar al equipo de desarrollo con logs y métricas relevantes 