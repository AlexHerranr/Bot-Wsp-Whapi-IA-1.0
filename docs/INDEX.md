# 📚 Índice de Documentación - TeAlquilamos Bot

## 🏠 Documentación Principal

### 📋 Estado del Proyecto
- [**Estado Actual del Proyecto**](./ESTADO_ACTUAL_PROYECTO.md) - Resumen del estado actual y cambios recientes
- [**Historial Consolidado 2025**](./HISTORIAL_CONSOLIDADO_2025.md) - Historial completo de cambios
- [**Tareas Pendientes**](./progress/TAREAS_PENDIENTES.md) - Roadmap y tareas por implementar

### 🏗️ Arquitectura y Diseño
- [**Arquitectura del Sistema**](./ARCHITECTURE.md) - Diseño técnico y componentes
- [**Estructura del Proyecto**](./architecture/PROJECT_STRUCTURE_UPDATED.md) - Mapa de navegación actualizado
- [**API Endpoints**](./API_ENDPOINTS.md) - Documentación de endpoints HTTP
- [**Sistema de Actualización RAG**](./SISTEMA_ACTUALIZACION_RAG.md) - Sistema de gestión de conocimiento

### 🚀 Guías de Implementación
- [**Dashboard Guide**](./DASHBOARD_GUIDE.md) - Guía del dashboard web
- [**Media Features**](./MEDIA_FEATURES.md) - Funcionalidades de media (voz, imágenes)
- [**Assistant Management**](./ASSISTANT_MANAGEMENT.md) - Gestión del asistente OpenAI
- [**Security and Deployment**](./SECURITY_AND_DEPLOYMENT.md) - Seguridad y despliegue

### 📁 Estructura de Carpetas

```
docs/
├── 📄 INDEX.md                          # Este archivo
├── 📄 README_DOCUMENTACION.md           # Introducción a la documentación
├── 📄 ESTADO_ACTUAL_PROYECTO.md         # Estado actual del proyecto
├── 📄 HISTORIAL_CONSOLIDADO_2025.md     # Historial de cambios
├── 📄 ARCHITECTURE.md                   # Arquitectura técnica
├── 📄 API_ENDPOINTS.md                  # Documentación de APIs
├── 📄 MEDIA_FEATURES.md                 # Funcionalidades multimedia
│
├── 📁 architecture/                     # Diagramas y diseños técnicos
├── 📁 deployment/                       # Guías de despliegue
├── 📁 development/                      # Guías de desarrollo
├── 📁 features/                         # Documentación de características
├── 📁 functions/                        # Documentación de funciones
├── 📁 guides/                          # Guías generales
├── 📁 integrations/                    # Integraciones externas
├── 📁 logging/                         # Sistema de logging
├── 📁 progress/                        # Estado y progreso
└── 📁 rag/                            # Sistema RAG
```

### 🔧 Desarrollo

#### Guías de Desarrollo
- [**Configuración Local**](./development/local-setup.md) - Configuración completa para desarrollo local
- [**Protocolo de Entornos**](./development/PROTOCOLO_ENTORNOS.md) - Manejo de entornos de desarrollo
- [**Git Workflow Manual**](./development/GIT_WORKFLOW_MANUAL.md) - Workflow de Git para el proyecto

#### Herramientas y Optimizaciones
- [**Optimización Cloud Run**](./development/OPTIMIZACION_CLOUD_RUN.md) - Optimizaciones para Cloud Run
- [**Solución Rate Limiting**](./development/SOLUCION_RATE_LIMITING.md) - Solución para rate limiting
- [**Dashboard Web Desarrollo**](./development/DASHBOARD_WEB_DESARROLLO.md) - Dashboard para desarrollo

#### Análisis y Resúmenes
- [**Resumen Ejecutivo Julio 2025**](./development/EXECUTIVE_SUMMARY_JULY_2025.md) - Resumen ejecutivo actual
- [**Resumen Análisis Logs**](./development/RESUMEN_ANALISIS_LOGS.md) - Análisis del sistema de logs

#### Funciones y Características
- [**Sistema de Funciones**](./functions/FUNCTION_SYSTEM.md)
- [**Gestión de Contexto**](./functions/CONTEXT_MANAGEMENT.md)
- [**Sistema de Colas**](./features/QUEUE_SYSTEM.md)

### 🔌 Integraciones

- [**WhatsApp Business API (Whapi)**](./integrations/WHAPI.md)
- [**OpenAI Integration**](./integrations/OPENAI.md)
- [**Beds24 Integration**](./integrations/BEDS24.md)

### 🔐 Seguridad

- [**Gestión de Secretos**](./security/SECRETS_MANAGEMENT_GUIDE.md)
- [**Security and Deployment**](./SECURITY_AND_DEPLOYMENT.md)
- [**Reporte de Limpieza de Seguridad**](./security/SECURITY_CLEANUP_REPORT.md) - Limpieza de secretos hardcodeados

### 📊 Monitoreo y Logs

- [**Sistema de Logging**](./logging/LOGGING_SYSTEM.md)
- [**Métricas y Monitoreo**](./logging/METRICS.md)
- [**Troubleshooting**](./guides/TROUBLESHOOTING.md)

### 🚀 Despliegue

- [**Railway Deployment**](./deployment/RAILWAY.md)
- [**Variables de Entorno**](./deployment/ENVIRONMENT_VARIABLES.md)
- [**CI/CD Pipeline**](./deployment/CI_CD.md)

---

## 🔍 Búsqueda Rápida

### Por Tecnología
- **Node.js/TypeScript**: [Arquitectura](./ARCHITECTURE.md), [Estándares](./development/CODE_STANDARDS.md)
- **WhatsApp**: [Whapi Integration](./integrations/WHAPI.md), [Media Features](./MEDIA_FEATURES.md)
- **OpenAI**: [Assistant Management](./ASSISTANT_MANAGEMENT.md), [Integration](./integrations/OPENAI.md)
- **Railway**: [Deployment Guide](./deployment/RAILWAY.md)

### Por Funcionalidad
- **Mensajería**: [API Endpoints](./API_ENDPOINTS.md), [Media Features](./MEDIA_FEATURES.md)
- **IA/Chatbot**: [Assistant Management](./ASSISTANT_MANAGEMENT.md), [RAG System](./SISTEMA_ACTUALIZACION_RAG.md)
- **Reservas**: [Beds24 Integration](./integrations/BEDS24.md)
- **Monitoreo**: [Dashboard](./DASHBOARD_GUIDE.md), [Logging](./logging/LOGGING_SYSTEM.md)

---

## 📝 Notas

- La documentación está organizada por categorías para facilitar la navegación
- Los archivos obsoletos y análisis temporales han sido movidos a `/archive`
- Para cambios recientes, ver [Estado Actual](./ESTADO_ACTUAL_PROYECTO.md)
- Para tareas pendientes, ver [Roadmap](./progress/TAREAS_PENDIENTES.md)
- Para referencias históricas, consultar `/archive/README.md`