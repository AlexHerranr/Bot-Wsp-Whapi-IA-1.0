# Checklist de Pre-Deploy - Bot WhatsApp Hotelero
**Versión:** 1.0  
**Última actualización:** 26 de Julio de 2025

## 🎯 **Propósito**
Este checklist debe ejecutarse **ANTES de cualquier deploy** para verificar que todas las funcionalidades críticas del bot funcionan correctamente y no hay regresiones.

---

## ✅ **1. FUNCIONALIDADES CORE**

### 📱 **Recepción de Mensajes**
- [ ] Recibe mensajes de texto correctamente
- [ ] Procesa webhooks de WHAPI sin errores
- [ ] Buffer inteligente agrupa mensajes múltiples
- [ ] Detecta y respeta indicadores de typing
- [ ] Maneja presencias (online, typing, recording)

### 🎤 **Audio y Voz**
- [ ] Transcribe notas de voz a texto (Whisper)
- [ ] **CRÍTICO:** Input voz → Respuesta voz (TTS)
- [ ] **CRÍTICO:** Input texto → Respuesta texto
- [ ] Muestra "recording..." cuando generará voz
- [ ] Muestra "typing..." cuando generará texto
- [ ] Fallback a texto si falla TTS
- [ ] Maneja archivos de audio grandes sin crash

### 🖼️ **Procesamiento de Imágenes**
- [ ] Detecta y procesa imágenes enviadas
- [ ] Análisis de contenido con GPT-4V
- [ ] Responde apropiadamente a imágenes de recibos/documentos
- [ ] Maneja múltiples imágenes en una conversación

### 💬 **Respuestas Inteligentes**
- [ ] Respuestas contextualizadas según historial
- [ ] Mantiene contexto entre sesiones
- [ ] Tono profesional hotelero
- [ ] No responde a sus propios mensajes

---

## 🏨 **2. FUNCIONALIDADES HOTELERAS**

### 🛏️ **Consultas de Disponibilidad (Beds24)**
- [ ] Procesa solicitudes de fechas correctamente
- [ ] **CRÍTICO:** Function calling `check_availability` funciona
- [ ] Integración con Beds24 API exitosa
- [ ] Respuestas incluyen precios y opciones
- [ ] Maneja fechas en formato correcto
- [ ] Muestra apartamentos disponibles con links
- [ ] Calcula noches correctamente
- [ ] Cache de disponibilidad funciona

### 🏷️ **Sistema de Etiquetas**
- [ ] Sincroniza etiquetas de WHAPI
- [ ] Identifica clientes (Colega Jefe, VIP, etc.)
- [ ] Aplica contexto según etiquetas
- [ ] Updates de etiquetas se persisten

### 📋 **Gestión de Reservas**
- [ ] Información de check-in/check-out
- [ ] Detalles de apartamentos específicos
- [ ] Políticas de hotel y restricciones

---

## ⚡ **3. PERFORMANCE Y ESTABILIDAD**

### 🚀 **Tiempos de Respuesta**
- [ ] Respuesta a texto simple: <10s
- [ ] Consulta disponibilidad: <30s
- [ ] Transcripción de voz: <5s
- [ ] Generación TTS: <10s
- [ ] No timeouts en OpenAI

### 🔄 **Manejo de Errores**
- [ ] Errores de OpenAI no crashean bot
- [ ] Errores de Beds24 tienen fallback
- [ ] Errores de WHAPI se loguean correctamente
- [ ] Reconexión automática después de fallos
- [ ] Memory leaks no detectados

### 🎛️ **Configuración**
- [ ] Variables de entorno cargadas correctamente
- [ ] `ENABLE_VOICE_RESPONSES=true` activo
- [ ] `ENABLE_VOICE_TRANSCRIPTION=true` activo
- [ ] `ENABLE_IMAGE_PROCESSING=true` activo
- [ ] Todas las API keys válidas

---

## 🔧 **4. INTEGRACIONES EXTERNAS**

### 🤖 **OpenAI**
- [ ] Assistant ID correcto
- [ ] Thread creation/reuse funciona
- [ ] Function calling activo
- [ ] Whisper transcription funciona
- [ ] TTS generation funciona
- [ ] Context injection apropiado

### 📱 **WHAPI**
- [ ] Envío de mensajes de texto
- [ ] Envío de notas de voz
- [ ] Indicadores de typing/recording
- [ ] Recepción de webhooks
- [ ] Status de mensajes (delivered/read)

### 🛏️ **Beds24**
- [ ] API connection estable
- [ ] Respuestas de disponibilidad válidas
- [ ] Cache funcionando
- [ ] Timeout handling apropiado

---

## 📊 **5. LOGGING Y MONITOREO**

### 📝 **Logs Requeridos**
- [ ] Sesión inicia con información completa
- [ ] Logs de éxito/error claros
- [ ] Performance metrics visibles
- [ ] Memory usage tracking
- [ ] Terminal logs legibles

### 🏷️ **Logs Específicos a Verificar**
- [ ] `AUDIO_TRANSCRIBED` - Transcripción exitosa
- [ ] `VOICE_RESPONSE_SENT` - Voz enviada correctamente
- [ ] `AVAILABILITY_HANDLER` - Beds24 consultas
- [ ] `PERFORMANCE_METRICS` - Métricas de respuesta
- [ ] `WEBHOOK_PROCESS_*` - Procesamiento webhooks

---

## 🧪 **6. ESCENARIOS DE PRUEBA**

### 🎬 **Flujo Completo Voz-a-Voz**
1. [ ] Enviar nota de voz: "Hola, ¿disponibilidad del 15 al 20 de agosto?"
2. [ ] Verificar: Muestra "recording..." indicator
3. [ ] Verificar: Responde con nota de voz
4. [ ] Verificar: Logs muestran `VOICE_RESPONSE_SENT`

### 📝 **Flujo Completo Texto-a-Texto**
1. [ ] Enviar texto: "Disponibilidad del 25 al 30 de noviembre"
2. [ ] Verificar: Muestra "typing..." indicator  
3. [ ] Verificar: Responde con texto estructurado
4. [ ] Verificar: Incluye precios y links de apartamentos

### 🖼️ **Procesamiento de Imágenes**
1. [ ] Enviar imagen de recibo/documento
2. [ ] Verificar: Procesa y analiza contenido
3. [ ] Verificar: Respuesta relevante al contenido

### 🔄 **Manejo de Buffers**
1. [ ] Enviar múltiples mensajes rápidos
2. [ ] Verificar: Se agrupan en buffer
3. [ ] Verificar: Respuesta única y coherente

---

## 🚨 **7. VALIDACIONES CRÍTICAS**

### ❌ **SHOWSTOPPERS (Deploy NO permitido si falla)**
- [ ] Bot responde a mensajes básicos
- [ ] Audio → Audio y Texto → Texto funciona
- [ ] Beds24 integration no rota
- [ ] No crashes en startup
- [ ] OpenAI Assistant responde

### ⚠️ **WARNINGS (Deploy condicional)**
- [ ] Performance degraded pero funcional
- [ ] Algunos logs faltantes
- [ ] Caché no óptimo pero funciona

---

## 🔄 **8. PROCESO DE ROLLBACK**

### 📋 **Si algo falla después del deploy:**
1. **Inmediato:** Revert al commit anterior estable
2. **Logs:** Capturar logs de error para análisis
3. **Fix:** Corregir en branch separado
4. **Re-test:** Ejecutar checklist completo
5. **Re-deploy:** Solo después de checklist ✅

### 📝 **Commits de Referencia Estables:**
- `3d6b54a` - Recording indicators corregidos
- `9e7c656` - Respuestas de voz restauradas  
- `45e2f4c` - Optimizaciones conversacionales

---

## 🏃‍♂️ **9. EJECUCIÓN RÁPIDA**

### ⚡ **Checklist Express (5 minutos)**
Para cambios menores, verificar mínimo:
1. [ ] Bot inicia sin errores
2. [ ] Responde a "Hola" con texto
3. [ ] Responde a nota de voz con voz
4. [ ] Consulta "disponibilidad del 1 al 5 de agosto" funciona
5. [ ] Logs sin errores fatales

### 🔍 **Checklist Completo (15-20 minutos)**
Para cambios mayores, ejecutar todas las secciones anteriores.

---

## 📋 **10. TEMPLATE DE REPORTE**

```
## Pre-Deploy Checklist Execution
**Fecha:** [FECHA]
**Commit:** [HASH]
**Ejecutado por:** [NOMBRE]

### Resultados:
- ✅ Funcionalidades Core: [PASSED/FAILED]
- ✅ Hoteleras: [PASSED/FAILED]  
- ✅ Performance: [PASSED/FAILED]
- ✅ Integraciones: [PASSED/FAILED]
- ✅ Logging: [PASSED/FAILED]
- ✅ Escenarios: [PASSED/FAILED]

### Issues Encontrados:
- [DESCRIPCIÓN DEL PROBLEMA]
- [SEVERIDAD: CRITICAL/WARNING]

### Decisión:
- [ ] ✅ DEPLOY APROBADO
- [ ] ❌ DEPLOY BLOQUEADO - Requiere fixes
```

---

**📞 Contacto para dudas:** [Tu contacto]  
**🔄 Última validación exitosa:** [Fecha del último deploy exitoso]