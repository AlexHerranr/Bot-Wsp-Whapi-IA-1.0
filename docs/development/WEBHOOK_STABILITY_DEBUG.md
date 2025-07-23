# 🔧 Debug: Reinicio del Bot Post-Webhook

## 🎯 **Problema Identificado**

El bot se reinicia **14 segundos después del inicio** cuando recibe el primer webhook de presencia (typing). Esto causa pérdida de mensajes y interrumpe la conversación con clientes.

### **Síntomas:**
- Bot inicia normalmente (PID estable)
- Recibe primer webhook de presencia (`PRESENCE_EVENT`)
- **3 segundos después**: Bot se reinicia (nuevo PID)
- No hay errores explícitos en logs
- Comportamiento inconsistente en desarrollo local

### **Cronología Típica:**
```
19:16:22 - Bot inicia (PID 3228)
19:16:29 - Recuperación de runs huérfanos completa
19:16:33 - Primer webhook recibido (typing)
19:16:36 - Bot se reinicia (PID 17628) ← PROBLEMA
```

## 🔍 **Causas Probables**

### **1. Hot Reload por tsx --watch (Más Probable)**
- **Causa**: `tsx --watch` monitorea archivos y reinicia al detectar cambios
- **Trigger**: Cambios en `tmp/threads.json` o archivos relacionados
- **Evidencia**: Reinicio rápido (~3s), cambio de PID, sin errores

### **2. Error Silencioso en `recoverOrphanedRuns()`**
- **Causa**: Timeout o error de red en llamadas a OpenAI API
- **Trigger**: Ejecución 5 segundos después del inicio
- **Evidencia**: Función hace llamadas asíncronas a OpenAI

### **3. Error en Webhook Handling**
- **Causa**: Error no capturado en `processWebhook()` o `subscribeToPresence()`
- **Trigger**: Procesamiento del primer webhook
- **Evidencia**: Reinicio justo después de `PRESENCE_RECEIVED`

## 🛠️ **Soluciones Implementadas**

### **1. Logs Detallados de Webhook**
```typescript
// En setupEndpoints()
logDebug('WEBHOOK_PROCESS_START', 'Iniciando procesamiento webhook', { 
    bodyPreview: JSON.stringify(req.body).substring(0, 200),
    environment: appConfig.environment,
    timestamp: new Date().toISOString()
});

logDebug('WEBHOOK_PROCESS_END', 'Webhook procesado exitosamente');
```

### **2. Timeout en `recoverOrphanedRuns()`**
```typescript
// Timeout de 10 segundos para evitar bloqueos
const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Recovery timeout after 10 seconds')), 10000)
);

await Promise.race([
    recoverOrphanedRuns(),
    timeoutPromise
]);
```

### **3. Scripts de Test Estable**
```bash
# Sin hot reload
npm run dev:stable

# Con ngrok pero sin hot reload
npm run dev:local:stable

# Test de estabilidad
npm run test:webhook-stability
```

### **4. Error Handling Mejorado**
```typescript
// Logs más detallados con stack trace
logError('WEBHOOK_ERROR', 'Error procesando webhook', { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    environment: appConfig?.environment,
    bodyPreview: JSON.stringify(req.body).substring(0, 100)
});
```

## 🧪 **Proceso de Testing**

### **Paso 1: Confirmar Hot Reload**
```bash
# Terminal 1: Ejecutar sin hot reload
npm run dev:stable

# Terminal 2: Ejecutar test de estabilidad
npm run test:webhook-stability
```

### **Paso 2: Verificar Logs**
- **Buscar**: `WEBHOOK_PROCESS_START/END`
- **Verificar**: PID constante en logs
- **Confirmar**: No reinicios durante test

### **Paso 3: Test Manual**
1. Enviar mensaje de WhatsApp
2. Verificar que bot responde
3. Enviar múltiples mensajes rápidos
4. Confirmar estabilidad

## 📊 **Métricas de Estabilidad**

### **Indicadores de Éxito:**
- ✅ PID constante durante toda la sesión
- ✅ Logs `WEBHOOK_PROCESS_END` después de cada webhook
- ✅ No errores `WEBHOOK_ERROR` o `ORPHANED_RUNS_RECOVERY_ERROR`
- ✅ Respuestas consistentes a mensajes

### **Indicadores de Problema:**
- ❌ Cambio de PID en logs
- ❌ Logs `WEBHOOK_ERROR` con stack trace
- ❌ Timeout en `recoverOrphanedRuns()`
- ❌ Bot no responde a mensajes

## 🚀 **Uso en Producción**

### **Desarrollo Local:**
```bash
# Para testing estable
npm run dev:stable

# Para desarrollo con hot reload
npm run dev
```

### **Cloud Run:**
- No usar hot reload en producción
- Monitorear logs de `WEBHOOK_ERROR`
- Configurar alertas para reinicios

## 🔄 **Mantenimiento**

### **Revisión Periódica:**
1. **Semanal**: Revisar logs de `WEBHOOK_ERROR`
2. **Mensual**: Ejecutar test de estabilidad
3. **Por Deploy**: Verificar que no hay regresiones

### **Debugging:**
1. Ejecutar con `npm run dev:stable`
2. Revisar logs detallados
3. Usar `npm run test:webhook-stability`
4. Verificar conexión de ngrok

## 📝 **Notas Importantes**

- **Hot reload** es útil en desarrollo pero puede causar reinicios
- **ngrok free tier** puede tener timeouts que afecten estabilidad
- **Logs detallados** son críticos para debugging
- **Testing estable** debe ser parte del workflow de desarrollo

---

**Última actualización**: 2025-07-22
**Estado**: Implementado y en testing 