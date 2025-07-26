# Logs de Railway - Guía Completa
**Bot WhatsApp Hotelero en Railway Cloud**

## 🚀 **Railway CLI Setup**

### Verificar Instalación
```bash
# Verificar Railway CLI está instalado
railway --version

# Verificar conexión al proyecto
railway status
# Debería mostrar:
# Project: awake-enchantment
# Environment: production
# Service: Bot-Wsp-Whapi-IA-1.0
```

### Login (si es necesario)
```bash
railway login
# Seguir instrucciones para autenticarse
```

## 📊 **Comandos de Logs Disponibles**

### 🔍 **Ver Logs en Tiempo Real (Recomendado para Debugging)**
```bash
npm run logs:railway:live
# O directamente:
railway logs --deployment --follow
```
**Uso:** Debugging activo, ver logs mientras el bot procesa mensajes

### 💾 **Descargar y Guardar Logs con Timestamp**
```bash
npm run logs:railway:save
# Guarda en: logs/railway/railway-logs-YYYY-MM-DD_HH-MM-SS.txt
```
**Uso:** Crear snapshots para análisis posterior

### 👁️ **Ver Logs Directamente en Terminal**
```bash
npm run logs:railway
# O directamente:
railway logs --deployment
```
**Uso:** Revisión rápida del estado actual

### 📄 **Descargar en Formato JSON**
```bash
npm run logs:railway:json
# Guarda en: logs/railway/railway-logs-json-YYYY-MM-DD_HH-MM-SS.json
```
**Uso:** Análisis programático, integración con herramientas

## 📁 **Estructura de Logs**

### Ubicación de Archivos
```
logs/railway/
├── railway-downloads/          # Logs descargados automáticamente
├── railway-logs-2025-07-26_17-08-33.txt    # Logs de deployment
├── railway-logs-json-2025-07-26_17-08-33.json  # Logs en formato JSON
└── README_LOGS_RAILWAY.md      # Esta documentación
```

### Formato de Logs Railway
```
# Formato típico de línea
2025-07-26T22:06:08.846148151Z [INFO] [THREAD_PERSIST] Mensaje del log jsonPayload={...} labels={...} timestamp="..."

# Componentes:
- Timestamp UTC: 2025-07-26T22:06:08.846148151Z
- Nivel: [INFO], [SUCCESS], [ERROR], [WARNING]
- Categoría: [THREAD_PERSIST], [WEBHOOK_PROCESS], etc.
- Mensaje: Descripción del evento
- jsonPayload: Datos estructurados del evento
- labels: Etiquetas para filtrado
```

## 🔍 **Análisis de Logs Común**

### ✅ **Verificar Startup Exitoso**
```bash
# Buscar líneas de inicio
grep "Bot TeAlquilamos Iniciado" logs/railway/railway-logs-*.txt
grep "Sistema listo" logs/railway/railway-logs-*.txt
```

### ❌ **Buscar Errores**
```bash
# Buscar errores generales
grep -i "error\|fail\|crash\|exception" logs/railway/railway-logs-*.txt

# Buscar errores específicos
grep "ERROR" logs/railway/railway-logs-*.txt
grep "FATAL" logs/railway/railway-logs-*.txt
```

### 🎤 **Verificar Funcionalidad de Voz**
```bash
# Buscar logs de transcripción
grep "AUDIO_TRANSCRIBED" logs/railway/railway-logs-*.txt

# Buscar logs de respuesta de voz
grep "VOICE_RESPONSE_SENT" logs/railway/railway-logs-*.txt

# Buscar logs de TTS
grep "TTS\|audio\.speech" logs/railway/railway-logs-*.txt
```

### 🏨 **Verificar Integración Beds24**
```bash
# Buscar consultas de disponibilidad
grep "AVAILABILITY_HANDLER\|check_availability" logs/railway/railway-logs-*.txt

# Buscar respuestas de Beds24
grep "BEDS24_" logs/railway/railway-logs-*.txt
```

### 📱 **Verificar Procesamiento de Webhooks**
```bash
# Buscar webhooks recibidos
grep "WEBHOOK_PROCESS_START" logs/railway/railway-logs-*.txt

# Buscar mensajes procesados
grep "QUEUE_ITEM_SUCCESS" logs/railway/railway-logs-*.txt
```

## 🎯 **Escenarios de Troubleshooting**

### 🔧 **Bot No Responde**
```bash
# 1. Verificar que el bot esté corriendo
npm run logs:railway:live

# 2. Buscar último webhook recibido
grep "WEBHOOK_PROCESS_START" logs/railway/railway-logs-*.txt | tail -5

# 3. Verificar si hay errores
grep -i "error" logs/railway/railway-logs-*.txt | tail -10
```

### 🎤 **Problemas de Voz**
```bash
# 1. Verificar transcripción
grep "AUDIO_TRANSCRIBED\|transcribeAudio" logs/railway/railway-logs-*.txt

# 2. Verificar generación TTS
grep "VOICE_RESPONSE_SENT\|TTS" logs/railway/railway-logs-*.txt

# 3. Verificar configuración
grep "ENABLE_VOICE" logs/railway/railway-logs-*.txt
```

### 🏨 **Problemas con Beds24**
```bash
# 1. Verificar calls a función
grep "check_availability" logs/railway/railway-logs-*.txt

# 2. Verificar respuesta API
grep "BEDS24_API_CALL\|BEDS24_RESPONSE" logs/railway/railway-logs-*.txt

# 3. Verificar errores específicos
grep "BEDS24.*ERROR\|AVAILABILITY.*ERROR" logs/railway/railway-logs-*.txt
```

## 📊 **Logs de Ejemplo y Significado**

### ✅ **Startup Exitoso**
```
Starting Container
> tealquilamos-bot@1.0.0 start
> node dist/app-unified.js

📁 Logs de esta sesión: logs/bot-session-2025-07-26T17-06-08.log
🚀 TeAlquilamos Bot - Iniciando...
✅ Detectado: Railway
🔗 Webhook: https://bot-wsp-whapi-ia-10-production.up.railway.app/hook
✅ Sistema listo
```

### 🎤 **Procesamiento de Voz Exitoso**
```
[SUCCESS] AUDIO_TRANSCRIBED: Audio transcrito exitosamente | {"userId":"573003913251","transcriptionLength":20,"preview":"Hola, ¿cómo va todo?"}
[SUCCESS] VOICE_RESPONSE_SENT: Respuesta de voz enviada exitosamente | {"userId":"573003913251","messageLength":126}
```

### 🏨 **Consulta Beds24 Exitosa**
```
[INFO] FUNCTION_EXECUTING: function_executing | {"functionName":"check_availability","toolCallId":"call_xyz","args":{"startDate":"2025-11-25","endDate":"2025-11-30"}}
[SUCCESS] AVAILABILITY_HANDLER: Consulta completada exitosamente | {"completeOptions":7,"splitOptions":0,"processingMs":887}
```

## ⚙️ **Configuración Avanzada**

### 🔄 **Auto-descarga de Logs**
Crear script para descargar logs periódicamente:

```bash
# Crear script en scripts/logs/auto-download-railway.sh
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M-%S)
railway logs --deployment > "logs/railway/auto-railway-logs-$DATE.txt"
echo "Logs descargados: logs/railway/auto-railway-logs-$DATE.txt"
```

### 📧 **Alertas de Errores**
```bash
# Script para detectar errores y alertar
grep -i "error\|fatal\|crash" logs/railway/railway-logs-*.txt > /tmp/errors.txt
if [ -s /tmp/errors.txt ]; then
    echo "⚠️ Errores detectados en logs de Railway!"
    cat /tmp/errors.txt
fi
```

### 🔍 **Análisis de Performance**
```bash
# Buscar métricas de performance
grep "PERFORMANCE_METRICS" logs/railway/railway-logs-*.txt
grep "totalDurationMs\|tokensPerSecond" logs/railway/railway-logs-*.txt
```

## 📋 **Checklist de Logs Saludables**

Al revisar logs de Railway, verificar:

- [ ] ✅ **Startup sin errores**
- [ ] 🔗 **Webhook URL correcta y accesible**
- [ ] 📊 **Logs de inicialización completos**
- [ ] 🎤 **Transcripción de audio funcionando** (si se usa)
- [ ] 🏨 **Integración Beds24 respondiendo** (si se usa)
- [ ] 📱 **Webhooks procesándose sin errores**
- [ ] 💾 **Sin memory leaks o warnings críticos**
- [ ] ⏱️ **Performance dentro de rangos aceptables**

## 🚨 **Señales de Alerta en Logs**

### 🔴 **Críticas (Acción Inmediata)**
```
- "FATAL" messages
- "Container crashed"
- "Out of memory"
- "OpenAI API key invalid"
- "WHAPI connection failed"
```

### 🟡 **Advertencias (Monitorear)**
```
- "WARNING" messages frecuentes
- Timeouts esporádicos
- "Memory usage high"
- Latencia alta en respuestas
```

## 💡 **Tips Profesionales**

### 🕐 **Mejores Prácticas**
1. **Revisar logs después de cada deploy**
2. **Descargar logs antes de troubleshooting**
3. **Usar logs en tiempo real para debugging activo**
4. **Mantener snapshots de logs de releases estables**

### 🔧 **Comandos Útiles**
```bash
# Ver solo los últimos 50 logs
railway logs --deployment | tail -50

# Filtrar por nivel de log específico
railway logs --deployment | grep "\[ERROR\]"

# Buscar logs de usuario específico
railway logs --deployment | grep "573003913251"

# Ver logs de build (si hay problemas de deployment)
railway logs --build
```

---

**📞 Para Soporte:** Siempre incluir logs relevantes al reportar issues  
**🔄 Actualizado:** 26 de Julio de 2025  
**📍 Proyecto Railway:** awake-enchantment / Bot-Wsp-Whapi-IA-1.0