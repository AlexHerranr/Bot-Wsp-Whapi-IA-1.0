# 📊 **Logs Organization - Bot WhatsApp TeAlquilamos**

> **Estructura profesional de logs con rotación automática y retención inteligente**

## 🎯 **Filosofía de Logging Profesional**

### **Principios de Gestión de Logs**
1. **🔄 Rotación Automática**: Logs antiguos archivados automáticamente
2. **📊 Categorización**: Logs separados por tipo y entorno
3. **⏰ Retención Inteligente**: Diferentes períodos según criticidad
4. **🔍 Fácil Debugging**: Estructura navegable para desarrollo
5. **📈 Monitoreo**: Logs optimizados para análisis y alertas

## 📁 **Estructura Profesional Implementada**

```
logs/
├── 📖 README_LOGS.md              # ← DOCUMENTACIÓN SISTEMA LOGGING
├── 📋 README_LOGS_ORGANIZATION.md # ← ESTE MANUAL DE ORGANIZACIÓN
│
├── 📊 sessions/                   # ← LOGS DE SESIONES BOT
│   ├── current/                   # Logs activos (últimas 24h)
│   │   ├── bot-session-2025-07-25T01-52-51.log
│   │   ├── bot-session-2025-07-25T01-56-09.log
│   │   ├── bot-session-2025-07-25T01-58-09.log
│   │   ├── bot-session-2025-07-25T01-58-14.log
│   │   └── bot-session-2025-07-25T02-45-43.log
│   │
│   └── archived/                  # Logs archivados (>24h)
│       ├── 2025-07/              # Por mes
│       ├── 2025-06/
│       └── 2025-05/
│
├── 🚂 railway/                    # ← LOGS DE RAILWAY (PRODUCCIÓN)
│   └── downloads/                 # Logs descargados de Railway
│       ├── railway-logs-2025-07-25.txt
│       ├── railway-logs-2025-07-24.txt
│       └── error-logs/
│
├── 💻 local-development/          # ← LOGS DESARROLLO LOCAL
│   ├── README.md                  # Documentación desarrollo
│   ├── debug/                     # Logs debug profundo
│   ├── performance/               # Logs de rendimiento
│   └── multimedia/                # Logs audio/imagen/voz
│
├── 🚨 alerts/                     # ← LOGS DE ALERTAS (FUTURO)
│   ├── critical/                  # Errores críticos
│   ├── warnings/                  # Advertencias importantes
│   └── notifications/             # Notificaciones sistema
│
└── 📈 analytics/                  # ← LOGS ANALÍTICOS (FUTURO)
    ├── usage/                     # Métricas de uso
    ├── performance/               # Métricas rendimiento
    └── business/                  # Métricas de negocio
```

## 🔄 **Políticas de Rotación y Retención**

### **📊 Sessions Logs** (`sessions/`)
```bash
# Rotación automática diaria
current/     # Últimas 24 horas - ACTIVOS
archived/    # >24 horas - ARCHIVADOS

# Retención: 30 días en archived/
# Después: Compresión y almacenamiento largo plazo
```

### **🚂 Railway Logs** (`railway/`)
```bash
# Logs de producción descargados
downloads/   # Logs descargados de Railway
error-logs/  # Solo logs de error para análisis rápido

# Retención: 90 días para debugging producción
# Compresión: .gz después de 7 días
```

### **💻 Local Development** (`local-development/`)
```bash
# Logs de desarrollo local
debug/       # TRACE y DEBUG logs
performance/ # Métricas de rendimiento
multimedia/  # 🎯 LOGS DE VOZ/AUDIO/IMAGEN

# Retención: 7 días (desarrollo rápido)
# Limpieza: Automática al reiniciar desarrollo
```

## 🎯 **Categorización por Funcionalidad**

### **📊 Session Logs - Operación del Bot**
**Contenido**: Interacciones usuario, procesamiento mensajes, respuestas IA
**Formato**: `[TIMESTAMP] [LEVEL] [CATEGORY] [SOURCE]: Message | JSON`
**Ejemplo**:
```
[2025-07-25T02:45:43.631Z] [SUCCESS] MESSAGE_RECEIVED [app-unified.ts]: Mensaje de voz recibido | {"userId":"573003913251","type":"voice","duration":5.2}
```

### **🚂 Railway Logs - Producción**
**Contenido**: Logs de producción, errores críticos, métricas deployment
**Formato**: Railway JSON + timestamp
**Rotación**: Manual download + análisis

### **💻 Local Development - Debugging**
**Contenido**: 🎯 **MULTIMEDIA DEBUGGING** - Logs detallados de voz, audio, imágenes
**Niveles**: TRACE, DEBUG completos
**Propósito**: Desarrollo de funcionalidades multimedia

## 🔧 **Gestión Automática de Logs**

### **🔄 Rotación Automática**
```bash
# Script de rotación diaria (npm script)
npm run logs:rotate

# Implementación:
# 1. Mover logs >24h a archived/
# 2. Crear carpetas por mes
# 3. Comprimir logs >7 días
# 4. Limpiar logs >30 días (sessions)
# 5. Limpiar logs >90 días (railway)
```

### **📊 Análisis de Logs Automatizado**
```bash
# Análisis rápido de errores
npm run logs:analyze

# Extracción de métricas
npm run logs:metrics

# 🎤 Análisis específico multimedia
npm run logs:multimedia
```

## 🎯 **Logs por Funcionalidad del Bot**

### **🎤 Multimedia Logs** (PRIORITARIO)
```
local-development/multimedia/
├── voice-processing-2025-07-25.log    # Procesamiento voz
├── audio-conversion-2025-07-25.log    # Conversión audio
├── image-analysis-2025-07-25.log      # Análisis imágenes
└── tts-synthesis-2025-07-25.log       # Síntesis de voz
```

### **🤖 AI Processing Logs**
```
sessions/current/
├── openai-requests-2025-07-25.log     # Requests a OpenAI
├── function-calls-2025-07-25.log      # Function calling
└── context-injection-2025-07-25.log   # Inyección contexto
```

### **🏨 Business Logic Logs**
```
sessions/current/
├── beds24-integration-2025-07-25.log  # Integración Beds24
├── booking-requests-2025-07-25.log    # Solicitudes reserva
└── escalation-events-2025-07-25.log   # Escalamientos humano
```

## 🛠️ **Herramientas de Gestión**

### **📊 Comandos de Logs**
```bash
# Ver logs en tiempo real
npm run logs:tail

# Buscar en logs
npm run logs:search "error"

# Análisis de rendimiento
npm run logs:performance

# 🎤 Logs específicos de voz
npm run logs:voice

# Limpiar logs antiguos
npm run logs:cleanup
```

### **🔍 Scripts de Análisis**
```bash
# Análisis de errores más comunes
node scripts/analyze-error-patterns.js

# Métricas de uso multimedia
node scripts/multimedia-usage-stats.js

# Rendimiento por funcionalidad
node scripts/performance-by-feature.js
```

## 🚨 **Alertas y Monitoreo**

### **🚨 Alertas Automáticas** (Futuro)
```
alerts/
├── critical/      # FATAL, ALERT levels
├── warnings/      # WARNING level frecuente
└── notifications/ # Eventos importantes
```

### **📈 Métricas Clave**
- **🎤 Procesamiento multimedia**: Tiempo respuesta voz/imagen
- **🤖 Requests OpenAI**: Latencia, errores, tokens
- **🏨 Conversiones**: Ratio consulta → reserva
- **⚠️ Errores**: Frecuencia, tipos, resolución

## 🔒 **Seguridad y Privacidad**

### **🛡️ Datos Sensibles**
```bash
# NUNCA loggear:
❌ API Keys, tokens
❌ Números de teléfono completos
❌ Datos personales de huéspedes
❌ Información de pago

# SÍ loggear (anonimizado):
✅ User IDs hasheados
✅ Tipos de mensaje
✅ Métricas agregadas
✅ Errores sin datos sensibles
```

### **🔐 Configuración Segura**
```typescript
// logger.config.ts
const logConfig = {
  sensitiveFields: ['phone', 'email', 'payment'],
  anonymization: true,
  dataRetention: {
    sessions: '30d',
    railway: '90d',
    development: '7d'
  }
};
```

## 📋 **Mantenimiento Regular**

### **🔄 Rutina Diaria (Automatizada)**
- Rotación de logs de sesión
- Verificación espacio disco
- Alertas por errores críticos

### **📅 Rutina Semanal**
- Análisis de patrones de error
- Optimización de rendimiento
- Limpieza logs desarrollo

### **📊 Rutina Mensual**
- Archivado de logs antiguos
- Análisis de métricas de negocio
- Optimización de logging system

---

## 💡 **Mejores Prácticas de Logging**

> **"Los logs deben ser informativos, seguros y accionables"**

- 🎯 **Contexto suficiente** para debugging
- 🔒 **Privacidad por diseño** 
- 📊 **Métricas accionables**
- 🔄 **Rotación automática**
- 🚨 **Alertas inteligentes**

---

**📅 Última actualización**: Julio 2025  
**👤 Responsable**: Equipo de Desarrollo  
**🔄 Próxima revisión**: Mensual  
**🎯 Prioridad**: Multimedia debugging y production monitoring