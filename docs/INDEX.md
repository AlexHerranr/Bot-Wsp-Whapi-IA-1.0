# 📚 Índice de Documentación - TeAlquilamos Bot

## 🏠 Documentación Principal

### 📋 Estado del Proyecto
- [**Estado Actual del Proyecto**](./ESTADO_ACTUAL_PROYECTO.md) - Resumen del estado actual y cambios recientes
- [**Historial Consolidado 2025**](./HISTORIAL_CONSOLIDADO_2025.md) - Historial completo de cambios
- [**Tareas Pendientes**](./progress/TAREAS_PENDIENTES.md) - Roadmap y tareas por implementar

### 🏗️ Arquitectura y Diseño
- [**Arquitectura del Sistema**](./ARCHITECTURE.md) - Diseño técnico y componentes
- [**Estructura del Proyecto**](./architecture/PROJECT_STRUCTURE.md) - Mapa de navegación completo
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
- [**Configuración Local**](./development/LOCAL_SETUP.md)
- [**Guía de Contribución**](./development/CONTRIBUTING.md)
- [**Estándares de Código**](./development/CODE_STANDARDS.md)

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
- Los archivos obsoletos han sido movidos a `/archive`
- Para cambios recientes, ver [Estado Actual](./ESTADO_ACTUAL_PROYECTO.md)
- Para tareas pendientes, ver [Roadmap](./progress/TAREAS_PENDIENTES.md)