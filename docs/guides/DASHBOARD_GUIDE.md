# 📊 Dashboard Web - Guía Completa

## 🎯 **Descripción**

El dashboard web te permite monitorear el comportamiento del bot en tiempo real desde cualquier navegador. Muestra métricas, logs y actividad de usuarios de forma visual e interactiva.

## 🚀 **Cómo Acceder**

### **Localmente:**
```bash
# 1. Inicia el bot
npm run dev

# 2. Abre en navegador
http://localhost:3008/dashboard
```

### **En Railway/Cloud Run:**
```
https://tu-app.railway.app/dashboard
```

## 📊 **Endpoints Disponibles**

| Endpoint | Descripción | Tipo |
|----------|-------------|------|
| `/dashboard` | Dashboard web completo | HTML |
| `/api/metrics` | Métricas en JSON | API |
| `/api/logs` | Logs recientes | API |
| `/health` | Estado del sistema | API |
| `/metrics` | Métricas Prometheus | API |
| `/locks` | Estado de locks | API |

## 🧪 **Probar el Dashboard**

```bash
# Ejecutar tests automáticos
npm run test:dashboard

# O manualmente
node test-dashboard.js
```

## 🎨 **Características del Dashboard**

### **1. Métricas en Tiempo Real**
- **📊 Mensajes Totales**: Contador de mensajes procesados
- **⚡ Tiempo Promedio**: Tiempo de respuesta promedio
- **👥 Usuarios Activos**: Usuarios únicos que han interactuado
- **📈 Actividad Reciente**: Últimas 10 interacciones

### **2. Logs del Sistema**
- **🔄 Auto-refresh**: Cada 30 segundos
- **🎨 Colores**: Diferentes colores por tipo de log
- **📝 Formato**: Timestamp + categoría + mensaje
- **🔍 Filtros**: Por tipo de actividad

### **3. Estado del Sistema**
- **✅ Estado**: Activo/Inactivo
- **🌍 Entorno**: Local/Cloud Run
- **⏱️ Uptime**: Tiempo de funcionamiento
- **🔄 Última actualización**: Timestamp

## 🔧 **Configuración**

### **Variables de Entorno Requeridas**
```bash
NODE_ENV=production  # o development
PORT=8080           # Puerto del servidor
```

### **Funcionalidades Automáticas**
- **Auto-refresh**: Cada 30 segundos
- **Log capture**: Todos los logs se envían automáticamente
- **Métricas**: Se actualizan en tiempo real
- **Responsive**: Funciona en móvil y desktop

## 📱 **Diseño Responsive**

El dashboard está optimizado para:
- **🖥️ Desktop**: Vista completa con todas las métricas
- **📱 Móvil**: Diseño adaptativo con scroll
- **🔄 Auto-refresh**: Sin interrumpir la experiencia

## 🎯 **Lo que Verás**

### **Header**
```
🏨 TeAlquilamos Bot - Monitor en Vivo
├── ✅ Estado: Activo
├── 🌍 Entorno: production
├── ⏱️ Uptime: 2d 5h 30m
└── 🔄 Última actualización: 10:30:15
```

### **Métricas**
```
📊 Mensajes Totales: 1,247
⚡ Tiempo Promedio: 2.3s
👥 Usuarios Activos: 89
📈 Actividad Reciente: [Lista de últimas interacciones]
```

### **Logs**
```
[10:30:15] 👤 Alexander: "Disponibilidad julio" → ⏳ 8s...
[10:30:22] 🤖 [BOT] Procesando con IA...
[10:30:25] ✅ [BOT] Completado (2.1s) → 💬 "Tenemos disponibilidad..."
[10:31:05] 👤 Maria: "Precios apartamento" → ⏳ 8s...
```

## 🔍 **Troubleshooting**

### **Dashboard No Carga**
```bash
# 1. Verificar que el bot esté ejecutándose
npm run dev

# 2. Probar endpoints
curl http://localhost:3008/health

# 3. Verificar logs
tail -f logs/bot.log
```

### **Logs No Aparecen**
- Verificar que el sistema de logging esté funcionando
- Comprobar que no hay errores en la consola
- Revisar que las funciones de logging estén siendo llamadas

### **Métricas Vacías**
- El dashboard se llena con el uso real del bot
- Enviar algunos mensajes de prueba para ver actividad
- Verificar que las funciones de métricas estén activas

## 🚀 **Deploy en Railway**

El dashboard funciona automáticamente en Railway:

1. **Deploy normal** del bot
2. **Acceder** a `https://tu-app.railway.app/dashboard`
3. **Configurar variables** de entorno si es necesario

## 📈 **Monitoreo Avanzado**

### **API Endpoints para Integración**
```bash
# Métricas en JSON
curl https://tu-app.railway.app/api/metrics

# Logs recientes
curl https://tu-app.railway.app/api/logs

# Estado de locks
curl https://tu-app.railway.app/locks
```

### **Prometheus Integration**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'tealquilamos-bot'
    static_configs:
      - targets: ['tu-app.railway.app']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

## 🎉 **¡Listo para Usar!**

El dashboard está completamente configurado y funcional. Solo necesitas:

1. **Iniciar el bot**: `npm run dev`
2. **Abrir el dashboard**: `http://localhost:3008/dashboard`
3. **¡Disfrutar del monitoreo en tiempo real!**

---

**Nota**: El dashboard se actualiza automáticamente y captura todos los logs del sistema. No requiere configuración adicional. 