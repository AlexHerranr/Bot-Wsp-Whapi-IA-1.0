# 🗺️ **MAPA DE NAVEGACIÓN ACTUALIZADO - TeAlquilamos Bot**
*Actualizado: 2025-07-23*

## 📁 **ESTRUCTURA DEL PROYECTO**

```
Bot-Wsp-Whapi-IA/
├── 📄 README.md                           # Documentación principal del proyecto
├── 📄 QUICK_START.md                      # Guía de inicio rápido
├── 📄 env.example                         # Plantilla de variables de entorno
├── 📄 package.json                        # Configuración del proyecto Node.js
├── 📄 package-lock.json                   # Lockfile de dependencias (npm)
├── 📄 pnpm-lock.yaml                      # Lockfile de dependencias (pnpm)
├── 📄 tsconfig.json                       # Configuración de TypeScript
├── 📄 Dockerfile                          # Configuración de contenedor Docker
├── 📄 .gitignore                          # Archivos ignorados por Git
├── 📄 .gcloudignore                       # Archivos ignorados por Google Cloud
├── 📄 .dockerignore                       # Archivos ignorados por Docker
├── 📄 .cursorignore                       # Archivos ignorados por Cursor
│
├── 📁 src/                                # CÓDIGO FUENTE PRINCIPAL
│   ├── 📄 app-unified.ts                  # 🚀 APLICACIÓN PRINCIPAL (ENTRADA)
│   │
│   ├── 📁 config/                         # Configuración del sistema
│   │   ├── 📄 environment.ts              # Configuración de entornos
│   │   ├── 📄 features.ts                 # Feature flags
│   │   └── 📄 secrets.ts                  # Gestión de secretos
│   │
│   ├── 📁 handlers/                       # Manejadores de IA y webhooks
│   │   ├── 📄 ai_handler.interface.ts     # Interfaz de manejadores de IA
│   │   ├── 📄 function-handler.ts         # Manejador de funciones
│   │   ├── 📄 gemini_handler.ts           # Manejador de Google Gemini
│   │   ├── 📄 openai_handler.ts           # Manejador de OpenAI
│   │   └── 📁 integrations/
│   │       └── 📄 beds24-availability.ts  # Integración Beds24
│   │
│   ├── 📁 services/                       # Servicios de negocio
│   │   ├── 📁 beds24/                     # Servicio de Beds24
│   │   │   ├── 📄 beds24.service.ts       # Servicio principal Beds24
│   │   │   └── 📄 beds24.types.ts         # Tipos de Beds24
│   │   ├── 📁 escalation/                 # Servicio de escalamiento
│   │   │   ├── 📄 escalation-minimal.config.ts
│   │   │   ├── 📄 escalation-minimal.service.ts
│   │   │   └── 📄 README_ESCALATION.md
│   │   └── 📄 guest-memory.service.ts     # Servicio de memoria de huéspedes
│   │
│   ├── 📁 functions/                      # Funciones de OpenAI Function Calling
│   │   ├── 📄 index.ts                    # Exportaciones de funciones
│   │   ├── 📄 README_FUNCTIONS.md         # Documentación de funciones
│   │   ├── 📁 availability/               # Funciones de disponibilidad
│   │   │   └── 📄 beds24-availability.ts  # Consulta de disponibilidad
│   │   ├── 📁 escalation/                 # Funciones de escalamiento
│   │   │   └── 📄 escalate-to-human.ts    # Escalamiento a humano
│   │   ├── 📁 registry/                   # Registro de funciones
│   │   │   └── 📄 function-registry.ts    # Registro dinámico
│   │   ├── 📁 types/                      # Tipos de funciones
│   │   │   └── 📄 function-types.ts       # Tipos de Function Calling
│   │   └── 📁 future/                     # Funciones futuras (DISABLED)
│   │       └── 📁 labels/                 # Sistema de etiquetas
│   │           ├── 📄 get-available-labels.ts
│   │           └── 📄 update-client-labels.ts
│   │
│   ├── 📁 utils/                          # Utilidades y helpers
│   │   ├── 📄 logger.ts                   # Sistema de logging principal
│   │   ├── 📄 log-config.ts               # Configuración de logs
│   │   ├── 📄 messageBuffering.ts         # Buffer de mensajes
│   │   ├── 📄 typingDetector.ts           # Detector de escritura
│   │   ├── 📄 userStateManager.ts         # Gestor de estado de usuario
│   │   ├── 📄 thread-cleanup.ts           # Limpieza de threads
│   │   ├── 📄 lock-manager.ts             # Gestor de locks
│   │   │
│   │   ├── 📁 ai/                         # Utilidades de IA
│   │   │   ├── 📄 groqAi.js               # Cliente de Groq AI
│   │   │   └── 📄 index.ts                # Exportaciones de IA
│   │   │
│   │   ├── 📁 context/                    # Gestión de contexto
│   │   │   ├── 📄 contextManager.ts       # Gestor de contexto
│   │   │   ├── 📄 conversationHistory.ts  # Historial de conversaciones
│   │   │   ├── 📄 historyInjection.ts     # Inyección de historial
│   │   │   └── 📄 index.ts                # Exportaciones de contexto
│   │   │
│   │   ├── 📁 core/                       # Utilidades core
│   │   │   └── 📄 index.ts                # Exportaciones core
│   │   │
│   │   ├── 📁 logging/                    # Sistema de logging avanzado
│   │   │   ├── 📄 index.ts                # Exportaciones de logging
│   │   │   ├── 📄 README_LOGGING.md       # Documentación de logging
│   │   │   ├── 📄 data-sanitizer.ts       # Sanitización de datos
│   │   │   └── 📄 terminal-logger.ts      # Logger de terminal
│   │   │
│   │   ├── 📁 monitoring/                 # Monitoreo y métricas
│   │   │   └── 📄 dashboard.ts            # Dashboard de métricas
│   │   │
│   │   ├── 📁 persistence/                # Persistencia de datos
│   │   │   ├── 📄 index.ts                # Exportaciones de persistencia
│   │   │   ├── 📄 guestMemory.js          # Memoria de huéspedes
│   │   │   └── 📄 threadPersistence.ts    # Persistencia de threads
│   │   │
│   │   └── 📁 whapi/                      # Utilidades de WhatsApp API
│   │       ├── 📄 index.ts                # Exportaciones de WHAPI
│   │       ├── 📄 chatHistory.ts          # Historial de chat
│   │       └── 📄 whapiLabels.js          # Gestión de etiquetas
│   │
│   ├── 📁 routes/                         # Rutas de la API
│   │   └── 📄 metrics.ts                  # Endpoint de métricas
│   │
│   ├── 📁 interfaces/                     # Interfaces TypeScript
│   │   └── 📄 message.interface.ts        # Interfaz de mensajes
│   │
│   ├── 📁 providers/                      # Proveedores de servicios
│   │   └── 📄 whapi.provider.ts           # Proveedor de WhatsApp API
│   │
│   └── 📁 types/                          # Tipos TypeScript
│       └── 📄 logger.types.ts             # Tipos de logging
│
├── 📁 config/                             # Configuraciones adicionales
│   └── 📄 assistant-config.json           # Configuración del asistente
│
├── 📁 scripts/                            # Scripts de automatización
│   ├── 📄 verify-environment.js           # Verificación de entorno
│   ├── 📄 verify-build.js                 # Verificación de build
│   ├── 📄 check-voice-config.js           # Verificación de configuración de voz
│   ├── 📄 predeploy-checklist.js          # Checklist pre-deploy
│   ├── 📄 setup-secrets.sh                # Setup de secretos
│   ├── 📄 setup-typing-webhook.js         # Setup de webhook de typing
│   ├── 📄 test-reply-detection.js         # Test de detección de respuestas
│   ├── 📄 test-voice-responses.js         # Test de respuestas de voz
│   ├── 📄 test-voice-transcription.js     # Test de transcripción de voz
│   ├── 📄 update-assistant-with-context-function.js
│   ├── 📄 update-assistant-with-history-function.js
│   │
│   ├── 📁 assistant-management/           # Gestión de asistentes
│   │   ├── 📄 README_ASSISTANT_MANAGEMENT.md
│   │   ├── 📄 REMOVE_FILE_GUIDE.md        # Guía de remoción
│   │   ├── 📄 assistant-cli.js            # CLI de gestión
│   │   ├── 📄 add-rag-file.js             # Agregar archivo RAG
│   │   ├── 📄 cleanup-threads.js          # Limpieza de threads
│   │   ├── 📄 cleanup-threads-local.js    # Limpieza local
│   │   ├── 📄 remove-prompt-file.js       # Remover archivo de prompt
│   │   ├── 📄 remove-rag-file.js          # Remover archivo RAG
│   │   ├── 📄 test-remove-file.js         # Test de remoción
│   │   ├── 📄 update-assistant-smart.js   # Actualización inteligente
│   │   ├── 📄 update-functions.cjs        # Actualización de funciones (CommonJS)
│   │   ├── 📄 update-functions.js         # Actualización de funciones
│   │   └── 📄 update-prompt.js            # Actualización de prompt
│   │
│   ├── 📁 development/                    # Scripts de desarrollo
│   │   └── 📄 test-env.js                 # Test de entorno
│   │
│   ├── 📁 test/                           # Scripts de testing
│   │   ├── 📄 test-function-registry.ts   # Test de registro de funciones
│   │   └── 📄 test-imports.js             # Test de imports
│   │
│   └── 📁 windows/                        # Scripts específicos de Windows
│       └── 📄 README_WINDOWS.md           # Documentación Windows
│
├── 📁 tests/                              # Tests y validaciones
│   ├── 📄 README_TESTS.md                 # Documentación de tests
│   ├── 📄 test-chat-history.js            # Test de historial de chat
│   ├── 📄 test-hybrid-flow.js             # Test de flujo híbrido
│   ├── 📄 test-labels-update.js           # Test de actualización de etiquetas
│   ├── 📄 test-voice-simple.mjs           # Test simple de voz
│   ├── 📄 test-voice-to-voice.mjs         # Test de voz a voz
│   │
│   ├── 📁 beds24/                         # Tests de Beds24
│   ├── 📁 escalation/                     # Tests de escalamiento
│   ├── 📁 logging/                        # Tests de logging
│   ├── 📁 voice/                          # Tests de voz
│   └── 📁 whapi/                          # Tests de WhatsApp API
│
├── 📁 docs/                               # DOCUMENTACIÓN DEL PROYECTO
│   ├── 📄 README_DOCUMENTACION.md         # README de documentación
│   ├── 📄 INDEX.md                        # Índice maestro
│   ├── 📄 ESTADO_ACTUAL_PROYECTO.md       # Estado actual
│   ├── 📄 HISTORIAL_CONSOLIDADO_2025.md   # Historial de cambios
│   ├── 📄 ARCHITECTURE.md                 # Arquitectura general
│   ├── 📄 GOOGLE_CLOUD_ARCHITECTURE.md    # Arquitectura GCP
│   ├── 📄 API_ENDPOINTS.md                # Documentación de APIs
│   ├── 📄 MEDIA_FEATURES.md               # Funcionalidades de media
│   ├── 📄 ASSISTANT_MANAGEMENT.md         # Gestión del asistente
│   ├── 📄 DASHBOARD_GUIDE.md              # Guía del dashboard
│   ├── 📄 SECURITY_AND_DEPLOYMENT.md      # Seguridad y despliegue
│   ├── 📄 SISTEMA_ACTUALIZACION_RAG.md    # Sistema RAG
│   ├── 📄 NAVIGATION_GUIDE.md             # Guía de navegación
│   ├── 📄 DOCUMENTATION_MAP.json          # Mapa de documentación JSON
│   │
│   ├── 📁 architecture/                   # Arquitectura y diseño
│   │   └── 📄 PROJECT_STRUCTURE.md        # Este archivo (versión anterior)
│   │
│   ├── 📁 deployment/                     # Guías de despliegue
│   ├── 📁 development/                    # Guías de desarrollo (11 archivos activos)
│   ├── 📁 features/                       # Documentación de características
│   ├── 📁 functions/                      # Sistema de funciones
│   ├── 📁 guides/                         # Guías generales
│   ├── 📁 integrations/                   # Integraciones externas
│   ├── 📁 logging/                        # Sistema de logging
│   ├── 📁 progress/                       # Estado y progreso
│   │   ├── 📄 TAREAS_PENDIENTES.md
│   │   ├── 📄 AUDIT_CLEANUP_REPORT_2025-07-23.md
│   │   └── 📄 REORGANIZACION_DOCS_2025-07-23.md
│   ├── 📁 rag/                           # Sistema RAG
│   └── 📁 security/                      # Seguridad
│       └── 📄 SECRETS_MANAGEMENT_GUIDE.md
│
├── 📁 logs/                              # Logs del sistema
│   ├── 📄 README_LOGS.md
│   └── 📁 local-development/
│
├── 📁 tmp/                               # Archivos temporales
│   └── 📁 audio/                         # Archivos de audio temporales
│
├── 📁 assets/                            # Recursos estáticos
├── 📁 integrations/                      # Integraciones
├── 📁 tools/                             # Herramientas
├── 📁 .github/                           # Configuración de GitHub
│
└── 📁 archive/                           # ARCHIVOS ARCHIVADOS (no incluidos en detalle)
    ├── 📄 README_ARCHIVE.md
    ├── 📁 docs-completados/              # Documentación de tareas completadas
    ├── 📁 docs-planes/                   # Planes y propuestas futuras
    ├── 📁 docs-desarrollo/               # Inventarios detallados
    ├── 📁 docs-duplicados/               # Documentos duplicados
    ├── 📁 scripts-obsoletos/             # Scripts obsoletos
    ├── 📁 code-analysis/                 # Análisis de código
    └── ...                               # Otros archivos archivados
```

## 📝 **NOTAS IMPORTANTES**

1. **Archivos README renombrados**: Para evitar confusión con el README principal, los READMEs en subcarpetas tienen nombres descriptivos (ej: README_TESTS.md, README_LOGS.md)

2. **Carpeta archive**: Contiene documentación histórica, planes futuros y archivos obsoletos. No se incluye en el detalle para mantener el foco en archivos activos.

3. **Documentación activa**: Solo se muestran archivos y carpetas actualmente en uso. La documentación completada o obsoleta está en `/archive`.

4. **Estructura modular**: El código está organizado por funcionalidad (handlers, services, utils, etc.) para facilitar el mantenimiento.

## 🚀 **PUNTOS DE ENTRADA CLAVE**

- **Aplicación principal**: `src/app-unified.ts`
- **Documentación**: `docs/INDEX.md`
- **Configuración**: `env.example` y `src/config/`
- **Tests**: `tests/README_TESTS.md`
- **Scripts**: `scripts/assistant-management/`

---

*Este mapa refleja la estructura actual del proyecto después de la reorganización del 2025-07-23.*