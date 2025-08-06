# 📊 Sistema de Logs Railway - Documentación Completa

## 🎯 Descripción General

Este sistema gestiona logs técnicos tanto en **desarrollo local** como en **producción Railway**, con características especiales:

- ✅ **Logs compactos**: 87% menos verbosos que JSON tradicional
- ✅ **Auto-descarga**: Archivos cada 500 líneas en Railway  
- ✅ **Dual format**: Compacto para Railway, detallado para local
- ✅ **Control total**: Variable de entorno para alternar formatos

---

## 📁 Estructura de Archivos

```
logs/
├── README_RAILWAY_LOGS.md              # Esta documentación
├── bot-session-{timestamp}.log         # Logs locales (formato detallado)
├── railway/                            # Logs descargados de Railway
│   ├── test-sample.log                 # Muestras de descarga manual
│   └── railway-logs-{timestamp}.log    # Descargas automáticas
└── railway-logs-chunk-X-{timestamp}.log # Auto-generados cada 500 líneas (Railway)
```

---

## 🚀 Funcionamiento Automático

### **En Railway (Producción)**
1. **Logs compactos** se envían a `console.log()`
2. **Buffer interno** acumula cada log  
3. **Cada 500 líneas**: 
   - Se muestra milestone: `[MILESTONE] Line 500 reached`
   - Se crea archivo: `railway-logs-chunk-1-{timestamp}.log`
   - Buffer se limpia y comienza chunk 2

### **En Local (Desarrollo)**
- Logs detallados van a `bot-session-{timestamp}.log`
- Máximo 5 sesiones mantenidas automáticamente
- No se crean chunks (solo Railway)

---

## 📊 Formato de Logs Compactos

### **Antes (JSON verboso - 591 caracteres):**
```json
{"timestamp":"2025-08-05T20:09:31.361948069Z","severity":"INFO","message":"[MESSAGE_RECEIVED] Mensaje de voz recibido","labels":{"app":"whatsapp-bot","category":"MESSAGE_RECEIVED","flow_stage":"1_receive","level":"INFO","message_id":"QqASIXkeO2NM8dqYOhgstw-gAaFabHYIw","user_id":"573003913251"},"jsonPayload":{"category":"MESSAGE_RECEIVED","chatId":"573003913251@s.whatsapp.net","flow":{"sequence":1,"stage":"1_receive"},"level":"INFO","messageId":"QqASIXkeO2NM8dqYOhgstw-gAaFabHYIw","messageType":"voice","timestamp":"2025-08-05T20:09:31.358Z","userId":"573003913251","userName":"Sr Alex"}}
```

### **Ahora (Compacto - 77 caracteres):**
```
2025-08-05T20:09:31Z [MSG_RX] 57300...251: voice 🔊"Bueno, yo quería cons..."
```

### **🎯 Reducción: 87% menos espacio**

---

## 🏷️ Categorías de Logs Compactos

| Categoría Original | Compacta | Formato | Información Preservada |
|-------------------|----------|---------|------------------------|
| `MESSAGE_RECEIVED` | `[MSG_RX]` | `[MSG_RX] user: type "preview..."` | Usuario, tipo mensaje, contenido |
| `AUDIO_TRANSCRIBED` | `[AUDIO]` | `[AUDIO] user: "transcription..."` | Usuario, transcripción |
| `BUFFER_GROUPED` | `[BUFFER]` | `[BUFFER] user: 2msg, 156ch` | Usuario, cantidad, tamaño |
| `OPENAI_PROCESSING_START` | `[AI_START]` | `[AI_START] user \| thread` | Usuario, thread ID |
| `OPENAI_RUN_COMPLETED` | `[AI_DONE]` | `[AI_DONE] user \| thread \| 3s \| 1.2kt` | Usuario, thread, tiempo, tokens |
| `MESSAGE_SENT` | `[SENT]` | `[SENT] user \| 339ch \| 31s` | Usuario, tamaño respuesta, tiempo |
| `WEBHOOK_RECEIVED` | `[WEBHOOK]` | `[WEBHOOK] msg:1` | Tipo de webhook |
| `BEDS24_REQUEST` | `[BEDS24]` | `[BEDS24] API request` | Solicitud API |
| `BEDS24_RESPONSE_DETAIL` | `[BEDS24]` | `[BEDS24] 3 rooms found` | Habitaciones encontradas |
| `MESSAGE_CHUNKS` | `[CHUNKS]` | `[CHUNKS] user: 2 parts` | Usuario, número de partes |
| `FUNCTION_CALLING_START` | `[FUNC]` | `[FUNC] check_availability()` | Nombre de función |
| `CACHE_HIT/MISS` | `[CACHE_HIT/MISS]` | `[CACHE_HIT] user` | Usuario, resultado cache |
| `THREAD_REUSE/NEW` | `[THR_REUSE/NEW]` | `[THR_REUSE] thread` | Thread ID |
| `LOG_MILESTONE` | `[MILESTONE]` | `[MILESTONE] Line 500 reached` | Número de línea alcanzado |
| `ERROR` | `[ERROR]` | `[ERROR] user: message...` | Usuario, mensaje error |

---

## ⚙️ Configuración

### **Variables de Entorno**

```bash
# Railway - Activar logs compactos (por defecto)
export RAILWAY_COMPACT_LOGS=true

# Railway - Volver a logs JSON detallados  
export RAILWAY_COMPACT_LOGS=false

# General - Nivel de detalle
export ENABLE_DETAILED_LOGS=true
export LOG_LEVEL=debug  # debug, info, warn, error
```

### **Detección Automática de Entorno**
```typescript
// Detecta Railway automáticamente
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
```

---

## 📥 Comandos de Descarga Manual

### **NPM Scripts Disponibles**
```bash
# Descargar logs de Railway (automático)
npm run logs:download           # Última hora (limitado)
npm run logs:download:1h        # Última hora
npm run logs:download:6h        # Últimas 6 horas  
npm run logs:download:24h       # Últimas 24 horas

# Ver estadísticas de archivos descargados
npm run logs:stats

# Railway CLI directo
npm run logs:railway            # Ver logs Railway
railway logs --deployment      # Comando directo
```

### **Comandos Manuales**
```bash
# Descarga limitada (rápida)
railway logs --deployment | head -50 > logs/railway/sample.log

# Descarga completa (lenta - puede tardar minutos)
railway logs --deployment > logs/railway/full-logs.log

# Ver logs en tiempo real
railway logs --deployment --follow
```

---

## 🔧 Implementación Técnica

### **Archivo Principal**: `src/utils/logging/index.ts`

#### **1. Detección de Entorno y Configuración**
```typescript
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
const RAILWAY_COMPACT_MODE = process.env.RAILWAY_COMPACT_LOGS !== 'false';
let railwayLogCounter = 0;
let railwayLogBuffer: string[] = [];
```

#### **2. Sistema Dual de Logging**
```typescript
if (IS_PRODUCTION) {
    if (RAILWAY_COMPACT_MODE) {
        const compactLog = formatCompactRailwayLog(category, message, details, level);
        console.log(compactLog);           // Railway console
        railwayLogBuffer.push(compactLog); // Buffer para archivo
    } else {
        console.log(JSON.stringify(detailedLogEntry)); // JSON completo
    }
    
    // Auto-archivo cada 500 líneas
    railwayLogCounter++;
    if (railwayLogCounter % 500 === 0) {
        writeRailwayLogChunk();
    }
}
```

#### **3. Función de Formato Compacto**
```typescript
function formatCompactRailwayLog(category: string, message: string, details: any, level: LogLevel): string {
    const timestamp = new Date().toISOString().slice(0, 19) + 'Z';
    const userId = details?.userId ? truncateId(details.userId) : null;
    
    switch (category) {
        case 'MESSAGE_RECEIVED':
            return `${timestamp} [MSG_RX] ${userId}: ${details.messageType} "${details.body?.substring(0, 20)}..."`;
        case 'MESSAGE_SENT':
            return `${timestamp} [SENT] ${userId} | ${details.responseLength}ch | ${Math.round(details.processingTime/1000)}s`;
        // ... más categorías
    }
}
```

#### **4. Auto-generación de Archivos**
```typescript
function writeRailwayLogChunk(): void {
    const chunkNumber = Math.ceil(railwayLogCounter / 500);
    const railwayLogFile = path.join(LOG_DIR, `railway-logs-chunk-${chunkNumber}-${SESSION_TIMESTAMP}.log`);
    
    const chunkHeader = `
=============================
📊 Railway Logs Chunk ${chunkNumber} - ${new Date().toLocaleString('es-CO')}
=============================
Líneas: ${(chunkNumber - 1) * 500 + 1} - ${railwayLogCounter}
Sesión: ${SESSION_TIMESTAMP}
Environment: Railway Production
=============================
`;
    
    fs.writeFileSync(railwayLogFile, chunkHeader + railwayLogBuffer.join('\n'));
    railwayLogBuffer = []; // Limpiar buffer
}
```

---

## 📈 Monitoreo y Métricas

### **Milestones Automáticos**
- **Línea 500**: `2025-08-05T20:09:31Z [MILESTONE] Line 500 reached`
- **Línea 1000**: `2025-08-05T20:09:31Z [MILESTONE] Line 1000 reached`
- **Línea 1500**: `2025-08-05T20:09:31Z [MILESTONE] Line 1500 reached`

### **Estadísticas de Archivos**
```bash
npm run logs:stats
# Output:
# 📊 Estadísticas de logs descargados:
# ====================================
# 📁 railway-logs-chunk-1-2025-08-05T20-45-01.log
#    💾 45 KB | 📅 2025-08-05 20:45:12
# 📈 Total archivos: 1
# 💾 Espacio usado: 45 KB
```

---

## 🔍 Troubleshooting

### **Problema: No se generan chunks automáticos**
```bash
# Verificar variables de entorno
echo $NODE_ENV                 # Debe ser 'production'
echo $K_SERVICE               # Debe existir en Railway
echo $RAILWAY_COMPACT_LOGS    # 'true' por defecto
```

### **Problema: Logs muy verbosos**
```bash
# Activar modo compacto
export RAILWAY_COMPACT_LOGS=true

# O en Railway settings:
# RAILWAY_COMPACT_LOGS=true
```

### **Problema: Descarga manual tarda mucho**
```bash
# Usar descarga limitada
railway logs --deployment | head -100 > sample.log

# En lugar de descarga completa
railway logs --deployment > full.log  # Puede tardar minutos
```

### **Problema: No se ven logs en Railway Dashboard**
1. Verificar que la aplicación esté desplegada
2. Confirmar que hay actividad reciente
3. Usar filtros en Railway Dashboard:
   - `[MSG_RX]` - Mensajes recibidos
   - `[SENT]` - Respuestas enviadas  
   - `[ERROR]` - Errores
   - `[MILESTONE]` - Contadores cada 500

---

## 💡 Casos de Uso

### **Debugging Rápido**
```bash
# Ver últimos mensajes recibidos
railway logs --deployment | grep "\[MSG_RX\]" | tail -10

# Ver errores recientes  
railway logs --deployment | grep "\[ERROR\]" | tail -5

# Monitorear tiempo de respuesta IA
railway logs --deployment | grep "\[AI_DONE\]" | tail -10
```

### **Análisis de Performance**
```bash
# Descargar y analizar tiempo de respuesta
npm run logs:download:1h
grep "\[SENT\]" logs/railway/railway-logs-*.log | grep -o "\d\+s" | sort -n
```

### **Monitoreo de Volumen**
```bash
# Ver milestones para entender carga
railway logs --deployment | grep "\[MILESTONE\]"
# Output: Line 500, Line 1000, Line 1500... = carga del sistema
```

---

## 🎯 Beneficios del Sistema

### **Performance**
- ✅ **87% menos tráfico** de logs a Railway
- ✅ **Escritura más rápida** a archivos
- ✅ **Menos ancho de banda** consumido

### **Debugging**
- ✅ **Información crítica preservada**
- ✅ **Formato legible** para humanos
- ✅ **Búsqueda más fácil** con grep
- ✅ **Identificación rápida** de problemas

### **Gestión**
- ✅ **Archivos organizados** por chunks
- ✅ **Limpieza automática** de archivos antiguos
- ✅ **Control total** con variables de entorno
- ✅ **Compatibilidad** hacia atrás con JSON

---

## 🚀 Próximas Mejoras

### **Funcionalidades Planificadas**
- [ ] **Dashboard web** para visualizar logs
- [ ] **Alertas automáticas** por volumen/errores
- [ ] **Exportación** a formato CSV/Excel
- [ ] **Integración** con servicios de monitoreo externos
- [ ] **Filtros avanzados** en tiempo real
- [ ] **Compresión automática** de archivos antiguos

### **Optimizaciones Técnicas**
- [ ] **Buffer inteligente** que se ajusta a la carga
- [ ] **Rotación de archivos** por tamaño además de líneas
- [ ] **Encriptación** de logs sensibles
- [ ] **Indexación** para búsquedas más rápidas

---

## 📞 Soporte

### **Archivos Clave**
- **Implementación**: `src/utils/logging/index.ts`
- **Scripts**: `scripts/download-railway-logs.js`
- **Configuración**: `package.json` (npm scripts)

### **Logs de Debug del Sistema**
Si el sistema de logging falla, revisa:
1. **Console local**: Errores durante inicialización
2. **Railway console**: Mensajes de `[LOG_FILE_ERROR]`
3. **Permisos de archivos**: Directorio `logs/` escribible

---

**📊 Este sistema garantiza logs técnicos eficientes, organizados y fáciles de debuggear tanto en desarrollo como en producción Railway.**