# 📊 Guía para Ver Logs en Railway

## 🎯 Dónde Encontrar los Logs a Consola

### **1. Railway Dashboard**
```
1. Ve a: https://railway.app/dashboard
2. Selecciona tu proyecto: bot-wsp-whapi-ia
3. Click en la pestaña "Logs" 
4. Verás logs en tiempo real
```

### **2. Tipos de Logs que Verás**

#### **🟢 Logs de Aplicación (console.log)**
```
2025-07-23T21:45:13.123Z [INFO] [MESSAGE_RECEIVED] Mensaje recibido
2025-07-23T21:45:14.456Z [CONTEXT_FUNCTION] Solicitando contexto  
2025-07-23T21:45:15.789Z [OPENAI_REQUEST] creating_run
```

#### **🔴 Logs de Error (console.error)**
```
2025-07-23T21:45:20.999Z ERROR: Error escribiendo logs: EACCES: permission denied
2025-07-23T21:45:21.123Z ERROR: [OPENAI_ERROR] Request timeout
```

#### **🔵 Logs del Sistema Railway**
```
2025-07-23T21:44:59.000Z Deploying commit: 434775e...
2025-07-23T21:45:00.000Z Starting application...
2025-07-23T21:45:02.000Z Application is ready and listening on port 8080
```

### **3. Filtros Útiles en Railway**

#### **Filtrar por Nivel**
- `ERROR` - Solo errores
- `INFO` - Logs informativos
- `[CONTEXT_FUNCTION]` - Solo logs de contexto
- `[OPENAI_REQUEST]` - Solo requests a OpenAI

#### **Filtrar por Tiempo**
- Last 1 hour
- Last 6 hours  
- Last 24 hours
- Custom range

### **4. Logs vs Archivos de Log**

#### **Logs a Consola (Railway Dashboard)**
✅ Se ven en tiempo real en Railway Dashboard  
✅ Se pueden filtrar y buscar  
✅ Railway los guarda automáticamente  
❌ No están en archivos físicos accesibles  

#### **Archivos de Log (si se crean)**
✅ Archivos físicos: `logs/bot-session-*.log`  
✅ Formato estructurado con headers/footers  
✅ Historial de sesiones completo  
❌ No accesibles directamente desde Railway Dashboard  

### **5. Comandos para Debugging**

#### **Ver Logs en Tiempo Real**
```bash
# Comando Railway CLI (si lo tienes instalado)
railway logs --follow

# O desde el dashboard web
# Railway Dashboard → Tu Proyecto → Logs Tab
```

#### **Buscar Logs Específicos**
```bash
# En Railway Dashboard, usar filtros:
[HISTORY_STRATEGY]           # Ver estrategia de historial
[CONTEXT_FUNCTION]           # Ver llamadas de contexto  
[OPENAI_REQUEST]             # Ver requests a OpenAI
ERROR                        # Ver solo errores
```

### **6. Ejemplo de Sesión Completa**

```
# Inicio de aplicación
2025-07-23T21:45:00.000Z 📁 Logs de esta sesión: logs/bot-session-2025-07-23T21-45-00.log
2025-07-23T21:45:00.100Z 🔄 Manteniendo máximo 5 sesiones

# Mensaje recibido
2025-07-23T21:45:13.123Z [INFO] [MESSAGE_RECEIVED] Mensaje recibido de 573003913251@s.whatsapp.net
2025-07-23T21:45:13.200Z [HISTORY_STRATEGY] OpenAI decide contexto bajo demanda - sin inyección automática

# OpenAI procesa
2025-07-23T21:45:14.456Z [OPENAI_REQUEST] creating_run
2025-07-23T21:45:15.789Z [CONTEXT_FUNCTION] Solicitando contexto de conversación
2025-07-23T21:45:16.123Z [CONTEXT_FUNCTION] Contexto obtenido exitosamente: 50 mensajes

# Respuesta enviada
2025-07-23T21:45:18.456Z [WHAPI_SEND] Mensaje enviado exitosamente
```

### **7. Verificar que el Sistema Funciona**

#### **✅ Logs que DEBEN aparecer ahora:**
```
📁 Logs de esta sesión: logs/bot-session-YYYY-MM-DDTHH-MM-SS.log
[HISTORY_STRATEGY] OpenAI decide contexto bajo demanda
[CONTEXT_FUNCTION] Solicitando contexto de conversación
```

#### **❌ Logs que NO deben aparecer:**
```
[HISTORY_INJECTION_COMPLETED] Inyección de historial completada
[HISTORY_INJECTION_SKIP] Saltando inyección
```

---

**💡 Tip**: Los logs a consola en Railway son lo que ves en el Dashboard, mientras que los archivos de log son para análisis más detallado (si se pueden crear).