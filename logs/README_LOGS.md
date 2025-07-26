# 📊 Sistema de Logging TeAlquilamos Bot

> **Guía completa de los 3 sistemas de logging implementados**

## 🎯 Resumen de Sistemas

El bot implementa **3 sistemas de logging diferenciados** según necesidad y entorno:

1. **🖥️ Terminal Local Limpios** - Logs básicos para desarrollo
2. **📁 Local Técnicos** - Logs detallados con archivos de sesión
3. **☁️ Railway Técnicos** - Logs optimizados para producción

---

## 1. 🖥️ Terminal Local Limpios

### **Propósito:**
Logs básicos y limpios durante desarrollo local para no saturar la terminal.

### **Configuración:**
```typescript
// Solo logs esenciales en consola
console.log('✅ Bot iniciado');
console.log('📨 Mensaje recibido');
console.log('🤖 Respuesta enviada');
```

### **Características:**
- ✅ **Minimal**: Solo información esencial
- ✅ **Colores**: Para fácil identificación visual
- ✅ **Sin archivos**: No genera archivos de log
- ✅ **Performance**: Sin impacto en velocidad

### **Cuándo usar:**
- Desarrollo cotidiano
- Testing rápido
- Cuando no necesitas logs detallados

---

## 2. 📁 Local Técnicos

### **Propósito:**
Logs técnicos completos con archivos de sesión para análisis profundo local.

### **Configuración:**
```typescript
// Buffer optimizado para tiempo real
BUFFER_FLUSH_INTERVAL: 100ms    // Cada 100 milisegundos
MAX_BUFFER_SIZE_LOCAL: 50       // O cada 50 logs
```

### **estructura de Archivos:**
```
c:\Users\alex-\Bot-Wsp-Whapi-IA\logs\
├── bot-session-2025-07-23T16-45-12.log
├── bot-session-2025-07-23T16-47-30.log
└── bot-session-2025-07-23T16-50-15.log
```

### **Contenido del Archivo:**
```
=== NUEVA SESIÓN DEL BOT ===
Timestamp: 2025-07-23 16:45:12 (Colombia UTC-5)
Session ID: session-2025-07-23T16-45-12
PID: 12345
Node Version: v22.16.0
Environment: Local Development
=============================

[2025-07-23T16:45:13] [INFO] [MESSAGE_RECEIVED] Mensaje recibido de 573003913251@s.whatsapp.net
[2025-07-23T16:45:14] [CONTEXT_FUNCTION] Solicitando contexto de conversación
[2025-07-23T16:45:15] [OPENAI_REQUEST] creating_run
[2025-07-23T16:45:18] [WHAPI_SEND] Mensaje enviado exitosamente

=============================
=== FIN DE SESIÓN DEL BOT ===
Timestamp: 2025-07-23 16:47:30 (Colombia UTC-5)
Session ID: session-2025-07-23T16-45-12
Duración: 137s
=============================
```

### **Características:**
- ✅ **Tiempo real**: Se escriben cada 100ms
- ✅ **Completos**: Todos los eventos técnicos
- ✅ **Estructurados**: Headers y footers de sesión
- ✅ **Limpieza automática**: Mantiene últimas 5 sesiones
- ✅ **Análisis**: Fácil debugging con archivos

### **Cuándo usar:**
- Debugging profundo
- Análisis de performance
- Auditorías de sistema
- Desarrollo de nuevas funcionalidades

---

## 3. ☁️ Railway Técnicos

### **Propósito:**
Logs técnicos optimizados para producción en Railway con menor I/O.

### **Configuración:**
```typescript
// Buffer optimizado para eficiencia
MAX_BUFFER_SIZE_RAILWAY: 400    // Solo cada 400 logs
NO_TIMER: true                  // Sin timer automático
```

### **Doble Sistema:**

#### **📁 Archivos (si es posible):**
```
/app/logs/bot-session-2025-07-23T21-45-12.log
```

#### **🖥️ Railway Dashboard:**
```
2025-07-23T21:45:13.123Z [INFO] [MESSAGE_RECEIVED] Mensaje recibido
2025-07-23T21:45:14.456Z [CONTEXT_FUNCTION] Solicitando contexto  
2025-07-23T21:45:15.789Z [OPENAI_REQUEST] creating_run
```

### **Características:**
- ✅ **Eficiente**: Solo escribe cada 400 logs
- ✅ **Dual**: Archivos + consola JSON
- ✅ **Optimizado**: Menor I/O en contenedor
- ✅ **Monitoreable**: Railway Dashboard integrado
- ✅ **Persistente**: Archivos cuando es posible

### **Cuándo usar:**
- Producción en Railway
- Monitoreo en vivo
- Análisis post-mortem
- Debugging remoto

---

## 🔄 Configuración por Entorno

### **Detección Automática:**
```typescript
const isCloudRun = !!process.env.K_SERVICE || process.env.NODE_ENV === 'production';

// LOCAL
if (!isCloudRun) {
    // Sistema: Local Técnicos
    // Timer: 100ms
    // Buffer: 50 logs
    // Archivos: Siempre
}

// RAILWAY  
if (isCloudRun) {
    // Sistema: Railway Técnicos
    // Timer: Ninguno
    // Buffer: 400 logs
    // Archivos: Si es posible
}
```

### **Variables de Control:**
```bash
# Habilitar logs detallados en Railway
ENABLE_DETAILED_LOGS=true

# Cambiar nivel de logging
LOG_LEVEL=DEBUG

# Deshabilitar archivos (emergencia)
DISABLE_FILE_LOGS=true
```

---

## 📊 Comparación de Sistemas

| Característica | Terminal Limpios | Local Técnicos | Railway Técnicos |
|----------------|------------------|----------------|------------------|
| **Archivos** | ❌ No | ✅ Sí | ✅ Si es posible |
| **Frecuencia** | Inmediata | 100ms / 50 logs | 400 logs |
| **Detalle** | Básico | Completo | Completo |
| **Performance** | Máxima | Alta | Optimizada |
| **Análisis** | Limitado | Profundo | Dashboard + Archivos |
| **Entorno** | Desarrollo | Desarrollo | Producción |

---

## 🛠️ Comandos Útiles

### **Ver Logs Locales:**
```bash
# Último archivo de sesión
ls -la logs/ | tail -1

# Seguir logs en tiempo real
tail -f logs/bot-session-*.log

# Buscar errores
grep "ERROR" logs/bot-session-*.log
```

### **Railway Logs:**
```bash
# Dashboard web
https://railway.app → Tu Proyecto → Logs Tab

# CLI (si tienes railway CLI)
railway logs --follow
```

### **Limpiar Logs:**
```bash
# Limpiar logs antiguos (local)
npm run clean

# O manualmente
rm logs/bot-session-*.log
```

---

## 🔍 Debugging con Logs

### **1. Problema de Performance:**
```bash
# Local: Ver archivos detallados
grep "OPENAI_LATENCY" logs/bot-session-*.log

# Railway: Filtrar en dashboard
[OPENAI_LATENCY]
```

### **2. Error de Conexión:**
```bash
# Buscar errores de conectividad
grep -i "error\|timeout\|failed" logs/bot-session-*.log
```

### **3. Flujo de Mensajes:**
```bash
# Seguir un mensaje específico
grep "573003913251" logs/bot-session-*.log
```

---

## 📈 Métricas de Logging

### **Local Técnicos:**
- **Escrituras**: ~600/minuto (cada 100ms)
- **Tamaño archivo**: ~5-50MB/sesión
- **Performance**: <1ms impacto

### **Railway Técnicos:**
- **Escrituras**: ~9/minuto (cada 400 logs)
- **Tamaño archivo**: ~10-100MB/sesión
- **Performance**: <0.1ms impacto

---

## 🎯 Recomendaciones de Uso

### **Para Desarrollo:**
1. **Usar Local Técnicos** para debugging
2. **Terminal Limpios** para desarrollo rápido
3. **Analizar archivos** con herramientas como VS Code

### **Para Producción:**
1. **Railway Técnicos** está optimizado automáticamente
2. **Monitorear Dashboard** para issues en tiempo real
3. **ENABLE_DETAILED_LOGS=true** solo cuando sea necesario

### **Para Debugging:**
1. **Local**: Revisar archivos de sesión
2. **Railway**: Usar filtros del dashboard
3. **Combinar ambos** para análisis completo

---

*Sistema de logging actualizado: Julio 2025*  
*Versión: 3.0 - Optimizado Local + Railway*  
*Autor: Alexander - TeAlquilamos*