# 🗺️ **MAPA DE NAVEGACIÓN COMPLETO - TeAlquilamos Bot**

## 📁 **ESTRUCTURA DEL PROYECTO**

```
Bot-Wsp-Whapi-IA/
├── 📄 README.md                           # Documentación principal del proyecto
├── 📄 PROJECT_STRUCTURE.md                # Este archivo - Mapa de navegación
├── 📄 QUICK_START.md                      # Guía de inicio rápido
├── 📄 HERRAMIENTAS_BOT.md                 # Herramientas y utilidades del bot
├── 📄 env.example                         # Plantilla de variables de entorno
├── 📄 package.json                        # Configuración del proyecto Node.js
├── 📄 pnpm-lock.yaml                      # Lockfile de dependencias (pnpm)
├── 📄 tsconfig.json                       # Configuración de TypeScript
├── 📄 Dockerfile                          # Configuración de contenedor Docker
├── 📄 cloudbuild.yaml                     # Configuración de Cloud Build
├── 📄 setup-secrets.sh                    # Script de configuración de secretos
├── 📄 cleanup.py                          # Script de limpieza Python
├── 📄 .gitignore                          # Archivos ignorados por Git
├── 📄 .gcloudignore                       # Archivos ignorados por Google Cloud
├── 📄 .dockerignore                       # Archivos ignorados por Docker
├── 📄 .cursorignore                       # Archivos ignorados por Cursor
│
├── 📁 src/                                # CÓDIGO FUENTE PRINCIPAL
│   ├── 📄 app-unified.ts                  # 🚀 APLICACIÓN PRINCIPAL (ENTRADA)
│   ├── 📁 config/                         # Configuración del sistema
│   │   ├── 📄 environment.ts              # Configuración de entornos
│   │   ├── 📄 secrets.ts                  # Gestión de secretos
│   │   └── 📁 integrations/
│   │       └── 📄 beds24.config.ts        # Configuración de Beds24
│   │
│   ├── 📁 handlers/                       # Manejadores de IA y webhooks
│   │   ├── 📄 ai_handler.interface.ts     # Interfaz de manejadores de IA
│   │   ├── 📄 function-handler.ts         # Manejador de funciones
│   │   ├── 📄 gemini_handler.ts           # Manejador de Google Gemini
│   │   ├── 📄 multi-assistant-handler.ts  # Manejador multi-asistente
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
│   │   │   └── 📄 README.md
│   │   └── 📄 guest-memory.service.ts     # Servicio de memoria de huéspedes
│   │
│   ├── 📁 functions/                      # Funciones de OpenAI Function Calling
│   │   ├── 📄 index.ts                    # Exportaciones de funciones
│   │   ├── 📄 README.md                   # Documentación de funciones
│   │   ├── 📁 availability/               # Funciones de disponibilidad
│   │   │   └── 📄 beds24-availability.ts  # Consulta de disponibilidad
│   │   ├── 📁 escalation/                 # Funciones de escalamiento
│   │   │   └── 📄 escalate-to-human.ts    # Escalamiento a humano
│   │   ├── 📁 registry/                   # Registro de funciones
│   │   │   └── 📄 function-registry.ts    # Registro dinámico
│   │   └── 📁 types/                      # Tipos de funciones
│   │       └── 📄 function-types.ts       # Tipos de Function Calling
│   │
│   ├── 📁 utils/                          # Utilidades y helpers
│   │   ├── 📄 logger.ts                   # Sistema de logging principal
│   │   ├── 📄 log-config.ts               # Configuración de logs
│   │   ├── 📄 messageBuffering.ts         # Buffer de mensajes
│   │   ├── 📄 typingDetector.ts           # Detector de escritura
│   │   ├── 📄 userStateManager.ts         # Gestor de estado de usuario
│   │   ├── 📄 thread-cleanup.ts           # Limpieza de threads
│   │   │
│   │   ├── 📁 ai/                         # Utilidades de IA
│   │   │   ├── 📄 groqAi.js               # Cliente de Groq AI
│   │   │   └── 📄 index.ts                # Exportaciones de IA
│   │   │
│   │   ├── 📁 context/                    # Gestión de contexto
│   │   │   ├── 📄 contextManager.ts       # Gestor de contexto
│   │   │   ├── 📄 conversationHistory.ts  # Historial de conversaciones
│   │   │   └── 📄 index.ts                # Exportaciones de contexto
│   │   │
│   │   ├── 📁 core/                       # Utilidades core
│   │   │   └── 📄 index.ts                # Exportaciones core
│   │   │
│   │   ├── 📁 logging/                    # Sistema de logging avanzado
│   │   │   ├── 📄 index.ts                # Exportaciones de logging
│   │   │   ├── 📄 README.md               # Documentación de logging
│   │   │   └── 📄 data-sanitizer.ts       # Sanitización de datos
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
│   ├── 📁 types/                          # Tipos TypeScript
│   │   └── 📄 logger.types.ts             # Tipos de logging
│   │
│   ├── 📁 features/                       # Características específicas
│   ├── 📁 ai/                             # Implementaciones de IA
│   ├── 📁 core/                           # Funcionalidades core
│   └── 📁 whatsapp/                       # Funcionalidades de WhatsApp
│
├── 📁 config/                             # Configuraciones adicionales
│   ├── 📄 assistant-config.json           # Configuración del asistente
│   ├── 📄 nodemon.json                    # Configuración de nodemon
│   └── 📄 rollup.config.mjs               # Configuración de Rollup
│
├── 📁 scripts/                            # Scripts de automatización
│   ├── 📄 verify-environment.js           # Verificación de entorno
│   ├── 📄 apply-stability-fixes.js        # Aplicación de fixes
│   ├── 📄 cleanup-project.js              # Limpieza del proyecto
│   ├── 📄 check-docs.js                   # Verificación de documentación
│   ├── 📄 create-new-assistant-v2.js      # Creación de asistente
│   ├── 📄 test-history-cache.js           # Test de cache de historial
│   ├── 📄 test-improvements.sh            # Test de mejoras
│   ├── 📄 test-logging-improvements.js    # Test de logging
│   ├── 📄 test-logging-simple.js          # Test simple de logging
│   ├── 📄 test-thread-persistence.js      # Test de persistencia
│   ├── 📄 toggle-buffer.js                # Toggle de buffer
│   ├── 📄 validate-cloud-run-logging.js   # Validación de logs
│   ├── 📄 validate-logging-v2.js          # Validación de logging v2
│   ├── 📄 pre-deploy.ps1                  # Script pre-deploy
│   ├── 📄 cleanup-threads.ps1             # Limpieza de threads
│   │
│   ├── 📁 assistant-management/           # Gestión de asistentes
│   │   ├── 📄 assistant-cli.js            # CLI de gestión
│   │   ├── 📄 add-rag-file.js             # Agregar archivo RAG
│   │   ├── 📄 cleanup-threads.js          # Limpieza de threads
│   │   ├── 📄 cleanup-threads-local.js    # Limpieza local
│   │   ├── 📄 remove-prompt-file.js       # Remover archivo de prompt
│   │   ├── 📄 remove-rag-file.js          # Remover archivo RAG
│   │   ├── 📄 test-remove-file.js         # Test de remoción
│   │   ├── 📄 update-assistant-smart.js   # Actualización inteligente
│   │   ├── 📄 update-functions.js         # Actualización de funciones
│   │   ├── 📄 update-prompt.js            # Actualización de prompt
│   │   ├── 📄 README.md                   # Documentación
│   │   └── 📄 REMOVE_FILE_GUIDE.md        # Guía de remoción
│   │
│   ├── 📁 development/                    # Scripts de desarrollo
│   │   ├── 📄 test-env.js                 # Test de entorno
│   │   └── 📄 update-assistant.js         # Actualización de asistente
│   │
│   ├── 📁 test/                           # Scripts de testing
│   │   ├── 📄 test-function-registry.js   # Test de registro de funciones
│   │   └── 📄 test-imports.js             # Test de imports
│   │
│   └── 📁 windows/                        # Scripts específicos de Windows
│       ├── 📄 README.md                   # Documentación Windows
│       ├── 📄 add-secret-values.ps1       # Agregar secretos
│       ├── 📄 add-secret-values-interactive.ps1
│       ├── 📄 enterprise-logs.ps1         # Logs empresariales
│       ├── 📄 git-setup.ps1               # Setup de Git
│       ├── 📄 setup-environment.ps1       # Setup de entorno
│       ├── 📄 setup-secrets.ps1           # Setup de secretos
│       ├── 📄 simple-logs.ps1             # Logs simples
│       ├── 📄 start-bot.bat               # Iniciar bot (batch)
│       ├── 📄 start-bot.ps1               # Iniciar bot (PowerShell)
│       ├── 📄 start-bot-single.ps1        # Iniciar bot único
│       ├── 📄 stop-bot-single.ps1         # Detener bot único
│       └── 📄 view-logs.ps1               # Ver logs
│
├── 📁 tests/                              # Tests y validaciones
│   ├── 📄 README.md                       # Documentación de tests
│   ├── 📄 test-chat-history.js            # Test de historial de chat
│   ├── 📄 test-labels-update.js           # Test de actualización de etiquetas
│   ├── 📄 test-metadata-updates.js        # Test de metadatos
│   ├── 📄 test-new-client-context.js      # Test de contexto de cliente
│   │
│   ├── 📁 beds24/                         # Tests de Beds24
│   │   ├── 📄 test-beds24.js              # Test principal de Beds24
│   │   ├── 📄 TEST_BEDS24_README.md       # Documentación de tests Beds24
│   │   └── 📁 logs/                       # Logs de tests
│   │
│   ├── 📁 escalation/                     # Tests de escalamiento
│   │   ├── 📄 test-minimal-escalation.js  # Test de escalamiento mínimo
│   │   └── 📄 ANALISIS_RAZONES_ESCALAMIENTO.md
│   │
│   ├── 📁 logging/                        # Tests de logging
│   │   └── 📄 test-logging-system.js      # Test del sistema de logging
│   │
│   └── 📁 whapi/                          # Tests de WhatsApp API
│       ├── 📄 README.md                   # Documentación WHAPI
│       ├── 📄 README_MESSAGES_TEST.md     # Documentación de tests de mensajes
│       ├── 📄 test-chat-specific.js       # Test específico de chat
│       ├── 📄 IMPLEMENTACION_CHAT_ANALYSIS.md
│       └── 📄 PROGRESO_IMPLEMENTACION.md
│
├── 📁 docs/                               # DOCUMENTACIÓN COMPLETA
│   ├── 📄 README.md                       # Documentación principal
│   ├── 📄 INDEX.md                        # Índice de documentación
│   ├── 📄 DOCUMENTATION_MAP.json          # Mapa de documentación
│   ├── 📄 SISTEMA_ACTUALIZACION_RAG.md    # Sistema de actualización RAG
│   │
│   ├── 📁 deployment/                     # Documentación de deployment
│   │   ├── 📄 README.md                   # Guía principal de deployment
│   │   ├── 📄 CLOUD_RUN_CHECKLIST.md      # Checklist de Cloud Run
│   │   ├── 📄 DEPLOY_WEB_CONSOLE.md       # Deploy desde consola web
│   │   ├── 📄 DEPLOYMENT_GUIDE.md         # Guía completa de deployment
│   │   ├── 📄 EXITO_TOTAL_COMPILACION.md  # Éxito de compilación
│   │   ├── 📄 HISTORIAL_SOLUCION_CLOUD_RUN.md
│   │   └── 📄 VERIFICACION_FINAL_COMPLETA.md
│   │
│   ├── 📁 development/                    # Documentación de desarrollo
│   │   ├── 📄 ANALISIS_ARCHIVOS_REDUNDANTES.md
│   │   ├── 📄 DASHBOARD_WEB_DESARROLLO.md
│   │   ├── 📄 ETAPA1_THREAD_PERSISTENCE.md
│   │   ├── 📄 ETAPA2_HISTORY_CACHE_OPTIMIZATION.md
│   │   ├── 📄 EXECUTIVE_SUMMARY_JULY_2025.md
│   │   ├── 📄 GUIA_SISTEMA_DOCUMENTACION.md
│   │   ├── 📄 IMPLEMENTACIONES_PAUSADAS.md
│   │   ├── 📄 local-setup.md              # Setup local
│   │   ├── 📄 MIGRATION_GUIDE.md          # Guía de migración
│   │   ├── 📄 OPTIMIZACION_CLOUD_RUN.md   # Optimización de Cloud Run
│   │   ├── 📄 PLAN_ESTABILIZACION_BOT_V2.md
│   │   ├── 📄 PLAN_ESTABILIZACION_BOT.md
│   │   ├── 📄 PLAN_OPTIMIZACION_CRITICA.md
│   │   ├── 📄 PROPUESTA_REORGANIZACION_PROYECTO.md
│   │   ├── 📄 PROTOCOLO_ENTORNOS.md       # Protocolo de entornos
│   │   ├── 📄 REORGANIZACION_MODULAR_ENERO_2025.md
│   │   ├── 📄 RESUMEN_ANALISIS_LOGS.md
│   │   └── 📄 SOLUCION_RATE_LIMITING.md
│   │
│   ├── 📁 features/                       # Documentación de características
│   │   ├── 📄 ASSISTANT_CONFIG.md         # Configuración de asistente
│   │   ├── 📄 BEDS24_INTEGRATION_COMPLETE.md
│   │   ├── 📄 BEDS24_PRIORITY_LOGIC.md    # Lógica de prioridad Beds24
│   │   ├── 📄 CONTEXTO_HISTORIAL_CONVERSACION.md
│   │   ├── 📄 ESCALATE_TO_HUMAN_SPEC.md   # Especificación de escalamiento
│   │   ├── 📄 EXTRACCION_ETIQUETAS_WHATSAPP.md
│   │   ├── 📄 OPENAI_CONTEXT_MESSAGES.md  # Mensajes de contexto OpenAI
│   │   ├── 📄 OPTIMIZACION_FORMATO_BEDS24.md
│   │   ├── 📄 RESUMEN_ACTUALIZACION_LABELS.md
│   │   ├── 📄 SIGUIENTE_IMPLEMENTACION.md
│   │   └── 📄 SISTEMA_ETIQUETAS_SIMPLE.md
│   │
│   ├── 📁 functions/                      # Documentación de funciones
│   │   ├── 📄 FUNCTION_INVENTORY.md       # Inventario de funciones
│   │   ├── 📁 booking/                    # Funciones de reserva
│   │   │   ├── 📄 cancel_booking.md       # Cancelar reserva
│   │   │   ├── 📄 create_booking.md       # Crear reserva
│   │   │   └── 📄 get_booking_details.md  # Detalles de reserva
│   │
│   ├── 📁 guides/                         # Guías
│   ├── 📁 integrations/                   # Documentación de integraciones
│   │   └── 📁 beds24/                     # Documentación de Beds24
│   │       └── 📄 architecture.md         # Arquitectura de Beds24
│   │
│   ├── 📁 legacy/                         # Documentación legacy
│   │   └── 📄 README_OLD.md               # README antiguo
│   │
│   ├── 📁 logging/                        # Documentación de logging
│   │   └── 📄 LOGGING_SYSTEM_COMPLETE.md  # Sistema de logging completo
│   │
│   └── 📁 progress/                       # Documentación de progreso
│       ├── 📄 ACTUALIZACION_ENERO_2025.md
│       ├── 📄 ACTUALIZACION_REFERENCIAS_CODIGO.md
│       ├── 📄 ESTADO_FINAL_PROYECTO.md
│       ├── 📄 FASE1_REORGANIZACION_COMPLETADA.md
│       ├── 📄 LIMPIEZA_ARCHIVOS_COMPLETADA.md
│       ├── 📄 REORGANIZACION_COMPLETADA.md
│       └── 📄 TAREAS_PENDIENTES.md
│
├── 📁 tools/                              # Herramientas y utilidades
│   ├── 📄 README.md                       # Documentación de herramientas
│   └── 📁 log-tools/                      # Herramientas de logging
│       ├── 📄 README.md                   # Documentación de log tools
│       └── 📁 cloud-parser/               # Parser de logs de Cloud
│           ├── 📄 parse_bot_logs.py       # Parser principal
│           ├── 📄 botlogs                 # Script de logs
│           ├── 📄 botlogs.bat             # Script de logs (Windows)
│           ├── 📄 log_config.yaml         # Configuración de logs
│           ├── 📄 requirements.txt        # Dependencias Python
│           ├── 📄 README.md               # Documentación
│           ├── 📄 QUICK_START.md          # Inicio rápido
│           ├── 📄 SETUP_GOOGLE_CLOUD.md   # Setup de Google Cloud
│           ├── 📄 test_raw_logs.py        # Test de logs raw
│           ├── 📄 COMANDOS_INDIVIDUALES.md
│           ├── 📄 COMANDOS_RAPIDOS.md
│           ├── 📄 examples/               # Ejemplos
│           │   └── 📄 ejemplo_archivo_consolidado.txt
│           ├── 📁 docs/                   # Documentación
│           │   ├── 📄 MANUAL_USO.md       # Manual de uso
│           │   ├── 📄 README_BOT_LOGS.md  # README de logs del bot
│           │   └── 📄 SETUP_INSTRUCTIONS.md
│           ├── 📁 tests/                  # Tests
│           │   ├── 📄 test_advanced_features.py
│           │   └── 📄 test_parser.py
│           └── 📁 botlogs                 # Directorio de logs
│
├── 📁 logs/                               # Logs del sistema
│   ├── 📄 README.md                       # Documentación de logs
│   ├── 📁 cloud-production/               # Logs de producción
│   │   └── 📁 processed/                  # Logs procesados
│   └── 📁 local-development/              # Logs de desarrollo local
│       ├── 📄 README.md                   # Documentación
│       └── 📁 sessions/                   # Sesiones de desarrollo
│
├── 📁 tmp/                                # Archivos temporales
│   ├── 📄 RESTORE_THREADS_BACKUP.md       # Guía de restauración
│   └── 📁 backups/                        # Backups de threads
│       └── [archivos de backup...]
│
├── 📁 integrations/                       # Integraciones externas
│   └── 📁 beds24/                         # Integración con Beds24
│       ├── 📄 config.md                   # Configuración
│       ├── 📄 README.md                   # Documentación
│       ├── 📁 examples/                   # Ejemplos
│       └── 📁 tests/                      # Tests de integración
│
├── 📁 assets/                             # Recursos estáticos
│   └── 📄 sample.png                      # Imagen de ejemplo
│
├── 📁 dist/                               # Código compilado (generado)
│   └── [archivos compilados...]
│
├── 📁 node_modules/                       # Dependencias (generado)
│   └── [dependencias...]
│
└── 📁 archive/                            # ARCHIVOS HISTÓRICOS Y TEMPORALES
    ├── 📄 README.md                       # Documentación del archivo
    ├── 📁 temp-files/                     # Archivos temporales movidos
    │   ├── 📄 APP REFERENCIA.ts           # Archivo de referencia
    │   ├── 📄 ANALISIS_COMPLETO_SISTEMA_LOGGING.md
    │   ├── 📄 LOGGING_MIGRATION_REPORT.md
    │   ├── 📄 REORGANIZATION_SUMMARY.md
    │   ├── 📄 whatsapp-sync-debug.log
    │   ├── 📁 openai-testing/             # Testing de OpenAI
    │   ├── 📁 public/                     # Directorio público vacío
    │   ├── 📁 .venv/                      # Entorno virtual Python
    │   ├── 📁 .idx/                       # Archivos de índice
    │   ├── 📁 .vscode/                    # Configuración VS Code
    │   ├── 📄 .eslintrc.json              # Configuración ESLint
    │   ├── 📄 .eslintignore               # Ignore ESLint
    │   └── 📄 package-lock.json           # Lockfile npm
    │
    ├── 📁 app-versions/                   # Versiones anteriores de la app
    │   ├── 📄 app-basic.ts                # Versión básica
    │   ├── 📄 app-emergency-backup.ts     # Backup de emergencia
    │   ├── 📄 app-emergency.ts            # Versión de emergencia
    │   ├── 📄 app-nuclear.ts              # Versión nuclear
    │   ├── 📄 app-original.ts             # Versión original
    │   └── 📄 app.ts.backup.1751833834188 # Backup con timestamp
    │
    ├── 📁 configs-old/                    # Configuraciones antiguas
    │   ├── 📄 cloud-run-config.yaml       # Configuración antigua Cloud Run
    │   ├── 📄 cloud-run-service.yaml      # Servicio antiguo Cloud Run
    │   └── 📄 rollup.config.mjs           # Configuración antigua Rollup
    │
    ├── 📁 deployment-scripts/             # Scripts de deployment antiguos
    │   ├── 📄 check-webhook.js            # Verificación de webhook
    │   ├── 📄 deploy-cloud-run-fixed.ps1  # Deploy corregido PowerShell
    │   ├── 📄 deploy-cloud-run-fixed.sh   # Deploy corregido Shell
    │   ├── 📄 deploy-cloud-run-v2.ps1     # Deploy v2 PowerShell
    │   ├── 📄 deploy-cloud-run.ps1        # Deploy PowerShell
    │   ├── 📄 deploy-cloud-run.sh         # Deploy Shell
    │   ├── 📄 diagnose-cloud-run.sh       # Diagnóstico Cloud Run
    │   ├── 📄 fix-typescript-errors.js    # Corrección de errores TypeScript
    │   └── 📄 verify-build.js             # Verificación de build
    │
    ├── 📁 docs-old/                       # Documentación antigua
    │   └── 📄 README-UNIFIED.md           # README unificado antiguo
    │
    └── 📁 experimental-modular/           # Experimentos modulares
        ├── 📄 interfaces                  # Interfaces experimentales
        ├── 📄 main.ts                     # Main experimental
        ├── 📄 README.md                   # Documentación experimental
        └── 📄 server.ts                   # Servidor experimental
```

## 🎯 **ARCHIVOS CLAVE PARA DESARROLLO**

### **🚀 Punto de Entrada Principal**
- `src/app-unified.ts` - **ARCHIVO PRINCIPAL** - Aplicación unificada

### **⚙️ Configuración**
- `src/config/environment.ts` - Configuración de entornos
- `src/config/secrets.ts` - Gestión de secretos
- `package.json` - Configuración del proyecto
- `tsconfig.json` - Configuración de TypeScript

### **📚 Documentación Esencial**
- `README.md` - Documentación principal
- `QUICK_START.md` - Inicio rápido
- `docs/development/local-setup.md` - Setup local
- `docs/deployment/README.md` - Guía de deployment

### **🛠️ Scripts Importantes**
- `scripts/verify-environment.js` - Verificación de entorno
- `scripts/pre-deploy.ps1` - Pre-deploy
- `scripts/windows/start-bot.ps1` - Iniciar bot (Windows)

## 🔍 **BÚSQUEDA RÁPIDA POR FUNCIONALIDAD**

### **🤖 IA y OpenAI**
- `src/handlers/openai_handler.ts` - Manejador de OpenAI
- `src/functions/` - Funciones de Function Calling
- `src/utils/ai/` - Utilidades de IA

### **📱 WhatsApp y WHAPI**
- `src/providers/whapi.provider.ts` - Proveedor de WhatsApp
- `src/utils/whapi/` - Utilidades de WhatsApp
- `src/handlers/` - Manejadores de webhooks

### **🏨 Beds24 e Integraciones**
- `src/services/beds24/` - Servicio de Beds24
- `src/functions/availability/` - Funciones de disponibilidad
- `integrations/beds24/` - Configuración de Beds24

### **📊 Logging y Monitoreo**
- `src/utils/logger.ts` - Sistema de logging
- `src/utils/logging/` - Logging avanzado
- `src/utils/monitoring/` - Monitoreo
- `tools/log-tools/` - Herramientas de logs

### **🔄 Persistencia y Estado**
- `src/utils/persistence/` - Persistencia de datos
- `src/utils/context/` - Gestión de contexto
- `tmp/` - Archivos temporales

## 🧹 **ARCHIVOS LIMPIADOS/MOVIDOS**

### **✅ Movidos a `archive/temp-files/`:**
- `APP REFERENCIA.ts` - Archivo de referencia obsoleto
- `ANALISIS_COMPLETO_SISTEMA_LOGGING.md` - Análisis temporal
- `LOGGING_MIGRATION_REPORT.md` - Reporte temporal
- `REORGANIZATION_SUMMARY.md` - Resumen temporal
- `whatsapp-sync-debug.log` - Log temporal
- `openai-testing/` - Testing temporal
- `public/` - Directorio vacío
- `.venv/` - Entorno virtual Python
- `.idx/` - Archivos de índice
- `.vscode/` - Configuración VS Code
- `.eslintrc.json` - Configuración ESLint
- `.eslintignore` - Ignore ESLint
- `package-lock.json` - Lockfile redundante

### **🗑️ Eliminados (basura temporal):**
- `tmp/threads.json` - Datos temporales
- `tmp/pending-messages.json` - Mensajes temporales
- `tmp/threads.backup-20250703-215948.json` - Backup antiguo
- `tmp/threads.json.backup` - Backup redundante

## 📋 **COMANDOS ÚTILES**

### **🔍 Verificar Estructura**
```bash
npm run verify
```

### **🚀 Desarrollo Local**
```bash
npm run dev:local
```

### **☁️ Deploy a Producción**
```bash
npm run deploy
```

### **📊 Ver Logs**
```bash
npm run cloud:logs
```

---

**📝 Nota**: Este mapa se actualiza automáticamente. Para mantenerlo actualizado, ejecuta `npm run verify` regularmente. 