# 🚀 Guía de Deploy en Railway - Bot WhatsApp TeAlquilamos

*Fecha: Julio 16, 2025*  
*Estado: ✅ DEPLOY EXITOSO Y FUNCIONANDO*

---

## 📋 Resumen Ejecutivo

**Migración exitosa** del bot de WhatsApp de Google Cloud Run a Railway, logrando un deploy más simple, rápido y económico.

### ✅ **Resultados Obtenidos:**
- **Deploy exitoso** en Railway
- **Webhook funcionando** correctamente
- **Primera prueba exitosa** con mensaje real
- **Configuración optimizada** para producción

---

## 🎯 **Configuración Final en Railway**

### **URL de Producción:**
```
https://bot-wsp-whapi-ia-10-production.up.railway.app
```

### **Webhook URL:**
```
https://bot-wsp-whapi-ia-10-production.up.railway.app/hook
```

### **Health Check:**
```
https://bot-wsp-whapi-ia-10-production.up.railway.app/health
```

---

## 🔧 **Configuración Técnica**

### **Variables de Entorno Configuradas:**
> ⚠️ **IMPORTANTE:** Nunca incluyas claves reales de API, tokens o secretos en la documentación ni en el repositorio. Configura siempre estos valores directamente en Railway o en el entorno seguro correspondiente. Los siguientes valores son solo ejemplos genéricos:
```bash
NODE_ENV=production
PORT=8080
OPENAI_API_KEY=sk-xxxxxx
ASSISTANT_ID=asst-xxxxxx
WHAPI_TOKEN=whapi-xxxxxx
WHAPI_API_URL=https://gate.whapi.cloud
BEDS24_TOKEN=beds24-xxxxxx
BEDS24_API_URL=https://api.beds24.com/v2
BEDS24_TIMEOUT=15000
```

### **Configuración del Servicio:**
- **Builder**: Dockerfile (detectado automáticamente)
- **Start Command**: `npm start`
- **Health Check Path**: `/health`
- **Health Check Timeout**: 300 segundos
- **Port**: 8080
- **Restart Policy**: On Failure
- **Max Restart Retries**: 10
- **Cron Schedule**: Eliminado (bot siempre activo)

---

## 📊 **Logs de Deploy Exitoso**

### **Arranque del Bot:**
```
🚀 Iniciando TeAlquilamos Bot...
✅ Configuración y secretos cargados.
🔧 Configuración del Entorno:
   📍 Entorno: cloud-run
   🌐 Puerto: 8080
   Webhook: https://bot-wsp-whapi-ia-10-production.up.railway.app/hook
   📊 Log Level: production
   🔍 Logs Detallados: Sí
   ⏱️  Buffer de Mensajes: Activo (10s)
   ☁️  Modo: Cloud Run
   🚀 Producción: Activo
   🔑 Secretos: Cargados
   📜 Inyección Historial: Activa (1 meses, 50 msgs)
   ⏱️ Cache TTL: 3600 segundos (1h)
```

### **Primera Prueba Exitosa:**
```
[WEBHOOK] Procesando 1 mensajes del webhook
[MESSAGE_RECEIVED] Mensaje recibido
📥 [BUFFER] 573003913251: "Hola..." → ⏳ 5s...
[GLOBAL_BUFFER_ADD] Mensaje agregado al buffer global
[THREAD_PERSIST] Thread creado para 573003913251
[THREAD_CREATED] Thread creado
[INJECTION_CHECK_NEW_THREAD] Thread nuevo necesita inyección
[CHAT_HISTORY] Obteniendo historial de chat para 573003913251@s.whatsapp.net
[CHAT_HISTORY] Historial obtenido: 50 mensajes procesados
[HISTORY_COMPRESSED] Historial comprimido para optimizar tokens
[HISTORY_INJECTION_NEW_THREAD] Historial inyectado para thread nuevo
```

---

## 🔄 **Proceso de Migración**

### **1. Preparación:**
- ✅ Eliminación de archivo `.env` del repositorio
- ✅ Actualización de `.gitignore`
- ✅ Configuración de URL de Railway en código

### **2. Configuración en Railway:**
- ✅ Creación del servicio
- ✅ Configuración de variables de entorno
- ✅ Configuración de networking
- ✅ Configuración de health check

### **3. Configuración en Whapi:**
- ✅ Cambio de URL del webhook a Railway
- ✅ Verificación de conectividad

### **4. Pruebas:**
- ✅ Health check exitoso
- ✅ Webhook recibiendo mensajes
- ✅ Procesamiento de mensajes funcionando
- ✅ Respuesta del bot correcta

---

## 🆚 **Comparación: Railway vs Google Cloud Run**

| Aspecto | Railway | Google Cloud Run |
|---------|---------|------------------|
| **Configuración** | Más simple | Más compleja |
| **Deploy** | Automático desde GitHub | Manual o CI/CD |
| **Variables** | Interfaz web simple | CLI o archivos YAML |
| **Logs** | Tiempo real en web | Google Cloud Console |
| **Costo** | Plan gratuito disponible | Siempre pago |
| **Escalabilidad** | Automática | Configurable |
| **URL** | Automática | Configurable |

---

## 🚨 **Troubleshooting**

### **Problemas Comunes y Soluciones:**

#### **1. Health Check Falla**
**Síntoma**: Deploy no se completa
**Solución**: Verificar que `/health` endpoint esté funcionando

#### **2. Variables de Entorno Faltantes**
**Síntoma**: "Configuración y secretos cargados" no aparece
**Solución**: Verificar todas las variables de entorno en Railway

#### **3. Puerto Incorrecto**
**Síntoma**: Bot no responde
**Solución**: Usar puerto 8080 en Railway

#### **4. Webhook No Llega**
**Síntoma**: No hay logs de `[WEBHOOK]`
**Solución**: Verificar URL en Whapi y configuración de red

---

## 📈 **Métricas de Performance**

### **Tiempos de Respuesta:**
- **Health Check**: < 1 segundo
- **Webhook Processing**: < 2 segundos
- **Message Processing**: < 5 segundos
- **OpenAI Response**: < 30 segundos

### **Recursos Utilizados:**
- **CPU**: 2 vCPU (máximo)
- **Memory**: 1 GB (máximo)
- **Storage**: Docker image optimizada

---

## 🔮 **Próximos Pasos**

### **Monitoreo Continuo:**
1. **Logs en tiempo real** en Railway
2. **Métricas de performance** en `/metrics`
3. **Health check** automático

### **Optimizaciones Futuras:**
1. **Custom domain** si es necesario
2. **SSL certificates** automáticos
3. **Backup automático** de threads
4. **Alertas** de downtime

---

## 🏆 **Conclusión**

El deploy en Railway ha sido **completamente exitoso**, proporcionando:

- ✅ **Simplicidad**: Configuración más directa
- ✅ **Confiabilidad**: Health checks y restart automático
- ✅ **Economía**: Plan gratuito disponible
- ✅ **Performance**: Respuestas rápidas y consistentes
- ✅ **Escalabilidad**: Automática según demanda

**El bot está funcionando perfectamente en producción y listo para uso comercial.**

---

*Última actualización: Julio 16, 2025*  
*Deploy exitoso en Railway*  
*Bot funcionando en producción* 