# TeAlquilamos Bot - Base Reutilizable

**Bot de WhatsApp modular y extensible** construido con TypeScript, OpenAI Assistants API y PostgreSQL.

> **Proyecto base desarrollado para TeAlquilamos, diseñado para ser reutilizable en cualquier industria.**

---

## 🚀 Características

- **Arquitectura Modular**: Core genérico + sistema de plugins por industria
- **Plugin Hotelero**: Integración completa con Beds24 y gestión de reservas
- **OpenAI Integration**: Assistant API con function calling y threading inteligente
- **Procesamiento Inteligente**: Buffer de mensajes con detección de typing
- **Base de Datos**: PostgreSQL con Prisma ORM
- **CRM Interno**: Sistema de gestión de contactos y análisis automático
- **Logging Dual**: Terminal limpio + logs técnicos detallados
- **Jobs Programados**: Análisis CRM y acciones diarias automatizadas

## 📦 Estructura del Proyecto

```
src/
├── core/              # Núcleo reutilizable (no industry-specific)
│   ├── services/      # Servicios base: database, openai, whatsapp
│   ├── jobs/          # Jobs programados
│   ├── state/         # Gestión de estado y cache
│   └── utils/         # Utilidades comunes
├── plugins/           # Plugins por industria
│   └── hotel/         # Plugin hotelero (Beds24)
├── functions/         # Functions genéricas de OpenAI
├── utils/             # Utilidades globales (logging, persistence)
└── main.ts           # Entry point con carga dinámica de plugins
```

## 🔧 Instalación

1. **Clona el repositorio**
```bash
git clone [repo-url]
cd Bot-Wsp-Whapi-IA
```

2. **Instala dependencias**
```bash
npm install
```

3. **Configura variables de entorno**
```bash
cp .env.example .env
# Edita .env con tus credenciales
```

4. **Configura la base de datos**
```bash
npx prisma generate
npx prisma db push
```

5. **Inicia el bot**
```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

## ⚙️ Variables de Entorno

### Obligatorias
- `OPENAI_API_KEY`: API key de OpenAI
- `ASSISTANT_ID`: ID del Assistant de OpenAI
- `WHAPI_TOKEN`: Token de Whapi.cloud
- `WHAPI_API_URL`: URL base de Whapi.cloud
- `DATABASE_URL`: URL de conexión a PostgreSQL

### Plugins
- `PLUGIN_HOTEL_ENABLED`: `true|false` (default: true)
- `BEDS24_TOKEN`: Token para Beds24 (solo si plugin hotel activo)
- `BEDS24_API_URL`: URL de Beds24 API

### CRM
- `CRM_MODE`: `internal|n8n|disabled` (default: disabled)
- `CRM_ANALYSIS_ENABLED`: `true|false` (default: false)

---

## 🚀 Despliegue en Railway

### **Despliegue Automático**
```bash
# Railway se despliega automáticamente con cada push
git add .
git commit -m "feat: Actualización del bot"
git push origin main
```

### **Configuración Manual en Railway**
1. **Conectar repositorio** de GitHub a Railway
2. **Configurar variables de entorno** en Railway Dashboard
3*Configurar puerto**: 8080. **Configurar comando de inicio**: `npm start`

### **Variables de Entorno en Railway**
Configurar en Railway Dashboard:
- `OPENAI_API_KEY`
- `ASSISTANT_ID`
- `WHAPI_TOKEN`
- `WHAPI_API_URL`
- `NODE_ENV=production`

---

## 📊 Monitoreo y Logs

### **Logs Clave para Monitorear**
```typescript
// Sistema de inyección de historial
HISTORY_INJECTION_COMPLETED' // Inyección exitosa
HISTORY_INJECTION_SKIP' // Inyección saltadaHISTORY_COMPRESSED' // Historial comprimido

// Sistema de cache
HISTORY_CACHE_HIT' // Cache hit
CACHE_CLEANUP' // Cleanup ejecutado

// Funciones de OpenAI
OPENAI_FUNCTION_CALL' // Llamada a función
OPENAI_RESPONSE_RECEIVED' // Respuesta recibida

// Sistema de etiquetas
LABELS_SYNC_START' // Sincronización iniciada
LABELS_SYNC_COMPLETE' // Sincronización completada
```

### **Endpoints de Monitoreo**
- **Health Check**: `GET /health`
- **Métricas**: `GET /metrics`
- **Estado del sistema**: `GET /ready`

---

## 🏗️ Arquitectura del Sistema

### **Componentes Principales**
```
src/
├── app-unified.ts              # Aplicación principal
├── config/                     # Configuración
│   ├── environment.ts          # Variables de entorno
│   └── secrets.ts              # Gestión de secretos
├── functions/                  # Funciones de OpenAI
│   ├── availability/           # Consultas de disponibilidad
│   ├── booking/                # Gestión de reservas
│   └── context/                # Contexto de conversación
├── handlers/                   # Manejadores de eventos
│   ├── ai_handler.interface.ts # Interfaz de IA
│   └── function-handler.ts     # Manejador de funciones
├── services/                   # Servicios externos
│   ├── beds24                 # Integración Beds24
│   └── escalation/             # Escalamiento a humano
├── utils/                      # Utilidades
│   ├── context/                # Gestión de contexto
│   ├── logging/                # Sistema de logs
│   └── persistence/            # Persistencia de datos
└── types/                      # Tipos TypeScript
```

### **Flujo de Procesamiento**1*Recepción de mensaje** via webhook de WhatsApp2**Validación y pre-procesamiento** del mensaje3ección de contexto** histórico si es necesario
4*Procesamiento por OpenAI** con funciones específicas5ución de funciones** (consultas Beds24, etc.)
6ación de respuesta** contextualizada
7. **Envío de respuesta** via WhatsApp API
8**Actualización de etiquetas** y contexto

---

## 📚 Documentación

### **🗺️ Navegación Rápida (5minutos)**
- **[Guía de Navegación](docs/NAVIGATION_GUIDE.md)** - **🎯 EMPIEZA AQUÍ** - Mapa completo del proyecto
- **[Inicio Rápido](QUICK_START.md)** - Configuración inicial
- **[Arquitectura del Sistema](docs/ARCHITECTURE.md)** - Diseño completo

### **📖 Documentación Técnica**
- **[Índice de Documentación](docs/INDEX.md)** - Documentación completa
- **[API Reference](docs/API_ENDPOINTS.md)** - Endpoints disponibles
- **[Guía de Despliegue](docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md)** - Despliegue completo

### **🔧 Desarrollo y Mantenimiento**
- **[Guía de Desarrollo](docs/development/local-setup.md)** - Configuración local
- **[Troubleshooting](docs/guides/TROUBLESHOOTING_AND_FAQ.md)** - Solución de problemas
- **[Sistema de Logging](docs/logging/LOGGING_SYSTEM_COMPLETE.md)** - Monitoreo y logs

### **📋 Características Específicas**
- **[Integración Beds24docs/features/BEDS24_INTEGRATION_COMPLETE.md)** - Gestión de disponibilidad
- **[Contexto de Conversación](docs/features/CONTEXTO_HISTORIAL_CONVERSACION.md)** - Memoria persistente
- **[Sistema de Etiquetas](docs/features/SISTEMA_ETIQUETAS_SIMPLE.md)** - Organización automática
- **[Sistema de Buffer](docs/features/TYPING_BASED_BUFFER.md)** - Respuestas naturales

### **🎤🖼️ Funcionalidades Multimedia**
- **[Sistema Audio-to-Text](tests/audio/README_AUDIO_TO_TEXT.md)** - Transcripción de voz
- **[Sistema Text-to-Audio](tests/audio/README_TEXT_TO_AUDIO.md)** - Respuestas de voz
- **[Procesamiento de Imágenes](tests/media/README_IMAGE_PROCESSING.md)** - Análisis visual
- **[Tests de Audio](tests/audio/)** - Pruebas y validación de audio
- **[Tests de Media](tests/media/)** - Pruebas de imágenes y multimedia

### **🔧 Herramientas y Utilidades**
- **[Herramientas del Bot](docs/guides/HERRAMIENTAS_BOT.md)** - Scripts y utilidades
- **[Estado del Proyecto](docs/progress/ESTADO_FINAL_PROYECTO.md)** - Estado actual y métricas

---

## 🔧 Desarrollo

### **Scripts Disponibles**
```bash
# Desarrollo
npm run dev              # Desarrollo local
npm run build            # Compilar TypeScript
npm run start            # Iniciar en producción

# Testing
npm run test             # Ejecutar tests
npm run health-check     # Verificar estado

# Utilidades
npm run clean            # Limpiar archivos temporales
npm run logs             # Ver logs en tiempo real
```

### **Estructura de Desarrollo**
- **TypeScript** para type safety
- **ESLint** para calidad de código
- **Prettier** para formateo
- **Jest** para testing

---

## 📈 Métricas y Performance

### **Tiempos de Respuesta**
- **Respuesta inicial**: <2egundos
- **Procesamiento de mensaje**: <1undo
- **Inyección de historial**: <500
- **Consulta Beds24: <3egundos

### **Disponibilidad**
- **Uptime**:990.9ailway)
- **Health Check**: Respuesta inmediata
- **Recuperación de errores**: Automática

---

## 🤝 Contribución

### **Proceso de Desarrollo**
1. **Fork** del repositorio2. **Crear branch** para nueva funcionalidad
3 **Desarrollar** y testear cambios4*Commit** con mensajes descriptivos
5. **Push** y crear Pull Request

### **Estándares de Código**
- **TypeScript** para todo el código nuevo
- **ESLint** para mantener calidad
- **Tests** para nuevas funcionalidades
- **Documentación** actualizada

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

---

## 🆘 Soporte

### **Contacto**
- **Issues**: [GitHub Issues](https://github.com/tu-usuario/Bot-Wsp-Whapi-IA/issues)
- **Documentación**: [docs/](docs/)
- **Troubleshooting**: [docs/guides/TROUBLESHOOTING_AND_FAQ.md](docs/guides/TROUBLESHOOTING_AND_FAQ.md)

### **Estado del Proyecto**
- **Versión**: 20Estable)
- **Plataforma**: Railway (Producción)
- **Última Actualización**: Julio 2025- **Estado**: ✅ **OPERATIVO**

---

*Desarrollado con ❤️ para TeAlquilamos*