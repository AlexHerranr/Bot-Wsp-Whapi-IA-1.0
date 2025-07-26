# 📚 **Documentación - Bot WhatsApp TeAlquilamos**

> Sistema de IA conversacional para gestión de reservas hoteleras con OpenAI GPT-4

## 🚀 **Inicio Rápido**

### **📖 Documentación Esencial**
- **[🏗️ Arquitectura](architecture/ARCHITECTURE.md)** - Diseño del sistema
- **[⚙️ Funcionalidades](features/)** - Características implementadas
- **[🔍 Validación de Respuestas](features/RESPONSE_VALIDATION_SYSTEM.md)** - Sistema anti-errores IA
- **[🔧 Funciones OpenAI](functions/)** - Inventario de funciones
- **[🏨 Integración Beds24](integrations/beds24/)** - API hotelera
- **[📱 API WhatsApp](integrations/WHAPI_COMPLETE_API_REFERENCE.md)** - Referencia completa

### **🛠️ Desarrollo**
- **[🚀 Despliegue](deployment/)** - Guías de deployment
- **[💻 Desarrollo Local](development/)** - Setup y workflow
- **[🔒 Seguridad](security/)** - Manejo de secretos y seguridad
- **[📊 Logging](logging/)** - Sistema de logs

### **📋 Guías de Usuario**
- **[🎯 Guías Prácticas](guides/)** - Dashboard, APIs, troubleshooting
- **[⚙️ Configuración Validador](guides/RESPONSE_VALIDATION_CONFIG.md)** - Setup del sistema de validación
- **[🤖 Gestión Asistente](development/ASSISTANT_MANAGEMENT.md)** - Configuración OpenAI
- **[🧠 Sistema RAG](rag/)** - Documentos de contexto

## 📁 **Estructura de Documentación**

```
docs/
├── 📖 README.md                    # Esta guía principal
├── 🗺️ DOCUMENTATION_MAP.json      # Mapa navegacional
├── 📋 README_DOCS.md               # Manual de organización
│
├── 🏗️ architecture/               # Arquitectura del sistema
│   ├── ARCHITECTURE.md            # Diseño principal
│   ├── PROJECT_STRUCTURE.md       # Estructura del proyecto
│   ├── GOOGLE_CLOUD_ARCHITECTURE.md
│   └── LOCKING_AND_RECOVERY.md    # Sistema de bloqueos
│
├── ⚙️ features/                   # Funcionalidades activas
│   ├── MEDIA_FEATURES.md          # Características multimedia
│   ├── FUNCTION_INVENTORY.md      # Inventario de funciones
│   ├── BEDS24_INTEGRATION_COMPLETE.md
│   ├── ESCALATE_TO_HUMAN_SPEC.md  # Escalamiento humano
│   └── VOICE_TO_VOICE_IMPLEMENTATION.md
│
├── 🔧 functions/                  # Funciones OpenAI
│   ├── FUNCTION_INVENTORY.md      # Inventario completo
│   └── booking/                   # Funciones de reserva
│       ├── create_booking.md
│       ├── cancel_booking.md
│       └── get_booking_details.md
│
├── 🔗 integrations/               # Integraciones externas
│   ├── WHAPI_COMPLETE_API_REFERENCE.md
│   └── beds24/
│       └── architecture.md
│
├── 🚀 deployment/                 # Despliegue y producción
│   ├── README.md                  # Guía general
│   └── RAILWAY_DEPLOYMENT_GUIDE.md
│
├── 💻 development/                # Desarrollo local
│   ├── README.md                  # Guía de desarrollo
│   ├── local-setup.md             # Setup local
│   ├── GIT_WORKFLOW_MANUAL.md     # Workflow Git
│   ├── MIGRATION_GUIDE.md         # Guías de migración
│   ├── PROTOCOLO_ENTORNOS.md      # Manejo de entornos
│   ├── ASSISTANT_MANAGEMENT.md    # Gestión asistente OpenAI
│   ├── ASSISTANT_CONFIG.md        # Configuración asistente
│   └── OPENAI_CONTEXT_MESSAGES.md # Contexto OpenAI
│
├── 📋 guides/                     # Guías prácticas
│   ├── API_ENDPOINTS.md           # Endpoints del sistema
│   ├── DASHBOARD_GUIDE.md         # Uso del dashboard
│   ├── HERRAMIENTAS_BOT.md        # Herramientas disponibles
│   ├── NAVIGATION_GUIDE.md        # Navegación del sistema
│   └── TROUBLESHOOTING_AND_FAQ.md # Resolución de problemas
│
├── 🔒 security/                   # Seguridad
│   ├── SECRETS_MANAGEMENT_GUIDE.md
│   ├── SECURITY_AND_DEPLOYMENT.md
│   └── SECURITY_CLEANUP_REPORT.md
│
├── 📊 logging/                    # Sistema de logging
│   └── LOGGING_SYSTEM_COMPLETE.md
│
├── 🧠 rag/                        # Sistema RAG (contexto IA)
│   ├── SISTEMA_ACTUALIZACION_RAG.md # Sistema de actualización RAG
│   ├── # 00_INSTRUCCIONES_DEL_ASISTENTE.txt
│   ├── # 02_TARIFAS_TEMPORADAS.txt
│   ├── # 03_INVENTARIO_APARTAMENTOS.txt
│   └── [... otros archivos de contexto]
│
└── 🗃️ archive/                   # Documentación archivada
    ├── docs-historical/           # Reportes históricos
    ├── docs-implemented-features/ # Features ya completadas
    └── docs-technical-redundant/  # Docs técnicos redundantes
```

## 🎯 **Por Dónde Empezar Según tu Rol**

### **👨‍💻 Desarrollador Nuevo**
1. **[🏗️ Arquitectura](architecture/ARCHITECTURE.md)** - Entender el sistema
2. **[💻 Setup Local](development/local-setup.md)** - Configurar entorno
3. **[⚙️ Funcionalidades](features/FUNCTION_INVENTORY.md)** - Conocer características
4. **[🔧 Funciones](functions/)** - API y funciones disponibles

### **🚀 DevOps/Deployment**
1. **[🚀 Deployment](deployment/)** - Guías de despliegue
2. **[🔒 Seguridad](security/)** - Manejo de secretos
3. **[📊 Logging](logging/)** - Sistema de monitoreo
4. **[🏗️ Arquitectura Cloud](architecture/GOOGLE_CLOUD_ARCHITECTURE.md)**

### **🎯 Usuario/Tester**
1. **[📋 Guías Prácticas](guides/)** - Uso del sistema
2. **[🤖 Gestión Asistente](ASSISTANT_MANAGEMENT.md)** - Configuración
3. **[🧠 Sistema RAG](rag/)** - Contexto y datos
4. **[📋 Troubleshooting](guides/TROUBLESHOOTING_AND_FAQ.md)**

## 📝 **Documentación Actualizada**

- ✅ **Estructura limpia** - Eliminados duplicados y obsoletos
- ✅ **Documentación activa** - Solo features y sistemas actuales
- ✅ **Organización profesional** - Por área funcional
- ✅ **Archivos históricos** - Movidos a `archive/`
- ✅ **Referencias cruzadas** - Enlaces internos consistentes

## 🔄 **Mantenimiento de Documentación**

- **Archivos activos**: Mantener actualizados con cambios en código
- **Archivos archivados**: Preservados en `archive/` para referencia histórica
- **Nuevas características**: Documentar en carpeta `features/`
- **Cambios de arquitectura**: Actualizar `architecture/`