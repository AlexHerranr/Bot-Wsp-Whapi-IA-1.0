# Inventario de Endpoints y Funciones

## **Resumen Ejecutivo**

Este documento lista todos los endpoints REST, rutas de métricas y funciones expuestas del bot para integración externa, testing y monitoreo.

## **Endpoints REST**

### **Webhook Principal**
```
POST /webhook
```
**Descripción**: Endpoint principal para recibir mensajes de WhatsApp desde Whapi.

**Headers requeridos**:
```
Content-Type: application/json
```

**Body de ejemplo**:
```json
{
  "messages": [
    {
      "from": "1234567890@s.whatsapp.net",
      "text": "Hola, ¿tienes disponibilidad?",
      "timestamp": "2025-07-13T10:30:00Z"
    }
  ]
}
```

**Respuesta**:
```json
{
  "success": true,
  "message": "Mensaje procesado",
  "timestamp": "2025-07-13T10:30:01Z"
}
```

### **Health Check**
```
GET /health
```
**Descripción**: Verificar estado del bot.

**Respuesta**:
```json
{
  "status": "healthy",
  "uptime": 2.5,
  "totalRequests": 1250,
  "environment": "production",
  "timestamp": "2025-07-13T10:30:00Z"
}
```

### **Métricas Básicas (JSON)**
```
GET /metrics/json
```
**Descripción**: Métricas básicas del sistema en formato JSON.

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "totalRequests": 1250,
    "totalLogs": 5000,
    "activeThreads": 45,
    "uptime": 2.5,
    "environment": "production",
    "timestamp": "2025-07-13T10:30:00Z"
  },
  "meta": {
    "endpoint": "/metrics/json",
    "version": "2.0.0",
    "description": "Métricas básicas del sistema (JSON)"
  }
}
```

### **Métricas Prometheus**
```
GET /metrics
```
**Descripción**: Métricas en formato Prometheus para integración con sistemas de monitoreo.

**Headers de respuesta**:
```
Content-Type: text/plain; version=0.0.4; charset=utf-8
```

**Ejemplo de respuesta**:
```
# HELP bot_messages_processed_total Total de mensajes procesados por el bot
# TYPE bot_messages_processed_total counter
bot_messages_processed_total 1250

# HELP fuzzy_hits_total Total de matches fuzzy encontrados en patrones y contexto
# TYPE fuzzy_hits_total counter
fuzzy_hits_total 45

# HELP race_errors_total Total de errores de race condition en threads
# TYPE race_errors_total counter
race_errors_total 3

# HELP token_cleanups_total Total de cleanups de threads con alto uso de tokens
# TYPE token_cleanups_total counter
token_cleanups_total 12

# HELP high_token_threads Número de threads con uso de tokens por encima del threshold
# TYPE high_token_threads gauge
high_token_threads 2
```

### **Estadísticas del Cache**
```
GET /metrics/cache
```
**Descripción**: Estadísticas detalladas del cache de labels y perfiles.

**Respuesta**:
```json
{
  "success": true,
  "data": {
    "cache": {
      "size": 150,
      "hits": 1250,
      "misses": 45,
      "hitRate": 96.5
    },
    "metrics": {
      "hits": 1250,
      "misses": 45,
      "size": 150,
      "invalidations": 12
    }
  },
  "meta": {
    "endpoint": "/metrics/cache",
    "version": "2.0.0",
    "description": "Estadísticas del cache de labels"
  }
}
```

## **Funciones de OpenAI**

### **check_availability**
**Descripción**: Consulta disponibilidad en tiempo real de propiedades en Beds24.

**Parámetros**:
```json
{
  "startDate": "2025-08-15",
  "endDate": "2025-08-20",
  "propertyId": 123,
  "roomId": 456
}
```

**Respuesta**:
```
📅 **Disponibilidad para 15/08/2025 a 20/08/2025**

✅ **Opciones Completas (5 noches)**
• Apartamento 1722-A: $150/noche = $750 total
• Apartamento 715: $120/noche = $600 total

🔄 **Opciones con Transferencias**
• 2 noches en 1722-A + 3 noches en 715 = $690 total
```

### **make_booking**
**Descripción**: Crea una reserva en Beds24.

**Parámetros**:
```json
{
  "startDate": "2025-08-15",
  "endDate": "2025-08-20",
  "propertyId": 123,
  "guestName": "Juan Pérez",
  "guestEmail": "juan@email.com",
  "guestPhone": "+1234567890"
}
```

### **escalate_to_human**
**Descripción**: Escala la conversación a un agente humano.

**Parámetros**:
```json
{
  "reason": "technical_issue",
  "description": "Error en consulta de disponibilidad",
  "userId": "user123"
}
```

## **Funciones Internas (No Expuestas)**

### **Sistema de Locks**
- `acquireThreadLock(userId)`: Adquiere lock para un usuario
- `releaseThreadLock(userId)`: Libera lock de un usuario

### **Cleanup y Optimización**
- `cleanupHighTokenThreads()`: Limpia threads con alto uso de tokens
- `recoverOrphanedRuns()`: Recupera runs huérfanos al inicio
- `generateHistorialSummary(threadId, userId)`: Genera resumen de conversación

### **Fuzzy Parsing**
- `detectSimplePattern(message)`: Detecta patrones simples con fuzzy matching
- `analyzeForContextInjection(messages)`: Analiza necesidad de inyección de contexto
- `validateAndFixDates(startDate, endDate)`: Valida y corrige fechas con typos

## **Variables de Entorno**

### **Configuración Principal**
```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
OPENAI_ASSISTANT_ID=asst_...

# Whapi
WHAPI_API_KEY=...
WHAPI_API_URL=https://gate.whapi.cloud

# Beds24
BEDS24_API_KEY=...
BEDS24_AUTH_TOKEN=...
```

### **Optimización y Monitoreo**
```bash
# Thresholds
THREAD_TOKEN_THRESHOLD=8000
HISTORIAL_SUMMARY_THRESHOLD=5000

# Timeouts
LOCK_TIMEOUT=30000
ORPHANED_RUN_MAX_AGE=300000

# Logging
DETAILED_LOGS=false
```

## **Ejemplos de Uso**

### **Testing del Webhook**
```bash
curl -X POST http://localhost:3008/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "from": "1234567890@s.whatsapp.net",
        "text": "Hola, ¿tienes disponibilidad para el 15 de agosto?",
        "timestamp": "2025-07-13T10:30:00Z"
      }
    ]
  }'
```

### **Monitoreo de Métricas**
```bash
# Métricas básicas
curl http://localhost:3008/metrics/json

# Métricas Prometheus
curl http://localhost:3008/metrics

# Health check
curl http://localhost:3008/health
```

### **Análisis de Cache**
```bash
# Estadísticas del cache
curl http://localhost:3008/metrics/cache
```

## **Códigos de Error**

### **HTTP Status Codes**
- `200`: Operación exitosa
- `400`: Bad Request (parámetros inválidos)
- `500`: Internal Server Error (error interno)

### **Log Levels**
- `INFO`: Operaciones normales
- `WARNING`: Situaciones que requieren atención
- `ERROR`: Errores que afectan funcionalidad
- `SUCCESS`: Operaciones exitosas importantes

### **Métricas de Error**
- `race_errors_total`: Errores de concurrencia
- `bot_fallbacks_total`: Fallbacks activados
- `openai_latency_ms`: Latencia de OpenAI

## **Rate Limiting**

### **Límites Actuales**
- **Webhook**: Sin límite específico (manejo por locks)
- **Métricas**: Sin límite (endpoints de solo lectura)
- **OpenAI**: Según plan de OpenAI (gpt-4: 500 requests/min)

### **Protecciones**
- Locks por usuario para prevenir procesamiento simultáneo
- Buffer de mensajes con timeout configurable
- Cleanup automático de threads con tokens altos

## **Seguridad**

### **Autenticación**
- Los endpoints no requieren autenticación (bot interno)
- Se recomienda usar firewall/load balancer para acceso externo

### **Validación**
- Validación de parámetros en todos los endpoints
- Sanitización de mensajes de entrada
- Timeouts para prevenir DoS

### **Logging**
- Logs estructurados sin información sensible
- Métricas anonimizadas
- Rotación automática de logs

## **Integración con Sistemas Externos**

### **Prometheus**
```yaml
scrape_configs:
  - job_name: 'tealquilamos-bot'
    static_configs:
      - targets: ['localhost:3008']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### **Grafana Dashboard**
- Importar métricas desde `/metrics`
- Configurar alertas basadas en thresholds
- Crear paneles para monitoreo en tiempo real

### **Log Aggregation**
- Enviar logs a sistemas como ELK Stack
- Configurar alertas basadas en patrones de logs
- Crear dashboards de operación

## **Mantenimiento y Troubleshooting**

### **Comandos Útiles**
```bash
# Verificar estado
curl http://localhost:3008/health

# Ver métricas
curl http://localhost:3008/metrics | grep -E "(race_errors|fuzzy_hits)"

# Analizar logs
grep "ERROR" logs/bot.log | tail -20
```

### **Monitoreo Recomendado**
- Health check cada 30 segundos
- Métricas cada 1 minuto
- Logs en tiempo real para debugging
- Alertas para race errors y tokens altos 