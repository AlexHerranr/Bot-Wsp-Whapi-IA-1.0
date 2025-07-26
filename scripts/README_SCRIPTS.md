# 🔧 **Scripts Organization - Bot WhatsApp TeAlquilamos**

> **Estructura profesional de scripts para desarrollo, testing y deployment**

## 🎯 **Filosofía de Organización**

### **Principios de Scripts Profesionales**
1. **🎯 Separación por Funcionalidad**: Scripts agrupados por propósito específico
2. **🔄 Desarrollo Activo**: Solo scripts operativos y mantenidos
3. **🧪 Testing Sistemático**: Scripts de prueba organizados por área
4. **🚀 Deployment Eficiente**: Scripts de despliegue centralizados
5. **🛠️ Mantenimiento Fácil**: Documentación clara y estructura escalable

## 📁 **Estructura Profesional Implementada**

```
scripts/
├── 📖 README_SCRIPTS.md           # ← ESTE MANUAL
│
├── 🤖 assistant-management/       # ← GESTIÓN OPENAI ASSISTANT
│   ├── README.md                  # Documentación de gestión
│   ├── REMOVE_FILE_GUIDE.md       # Guía de eliminación de archivos
│   ├── add-rag-file.js            # Agregar archivos RAG
│   ├── assistant-cli.js           # CLI de gestión asistente
│   ├── cleanup-threads-local.js   # Limpieza local de threads
│   ├── cleanup-threads.js         # Limpieza de threads
│   ├── remove-prompt-file.js      # Eliminar archivos de prompt
│   ├── remove-rag-file.js         # Eliminar archivos RAG
│   ├── test-remove-file.js        # Test eliminación archivos
│   ├── update-assistant-smart.js  # Actualización inteligente
│   ├── update-functions.cjs       # Actualizar funciones (CommonJS)
│   ├── update-functions.js        # Actualizar funciones (ES6)
│   └── update-prompt.js           # Actualizar prompt principal
│
├── 🎤 voice/                      # ← SCRIPTS DE VOZ Y AUDIO
│   ├── check-voice-config.js      # 🎯 Verificar configuración voz
│   ├── test-voice-responses.js    # 🎯 Test respuestas de voz
│   └── test-voice-transcription.js # 🎯 Test transcripción voz
│
├── 🧪 testing/                    # ← SCRIPTS DE TESTING
│   ├── test-context-direct.js     # Test contexto directo
│   ├── test-reply-detection.js    # Test detección respuestas
│   └── registry/                  # Tests de registry functions
│       ├── test-function-registry.js
│       ├── test-function-registry.ts
│       └── test-imports.js
│
├── 🚀 deployment/                 # ← SCRIPTS DE DESPLIEGUE
│   ├── predeploy-checklist.js     # Checklist pre-despliegue
│   ├── verify-build.js            # Verificación de build
│   └── verify-environment.js      # Verificación de entorno
│
├── 🛠️ setup/                      # ← SCRIPTS DE CONFIGURACIÓN
│   ├── setup-secrets.sh           # Configurar secretos
│   └── setup-typing-webhook.js    # Configurar webhook typing
│
├── 💻 development/                # ← SCRIPTS DE DESARROLLO
│   └── test-env.js                # Test de entorno desarrollo
│
└── 🪟 windows/                    # ← SCRIPTS ESPECÍFICOS WINDOWS
    ├── README.md                  # Documentación Windows
    ├── add-secret-values-interactive.ps1  # Secrets interactivo
    ├── add-secret-values.ps1              # Agregar secrets
    ├── download-railway-logs.ps1          # Descargar logs Railway
    ├── enterprise-logs.ps1               # Logs empresariales
    ├── filter-railway-logs.ps1           # Filtrar logs Railway
    ├── git-setup.ps1                     # Setup Git
    ├── railway-logs-config.ps1           # Configurar logs Railway
    ├── setup-environment.ps1             # Setup entorno
    ├── setup-railway.ps1                 # Setup Railway
    ├── setup-secrets.ps1                 # Setup secretos
    ├── simple-logs.ps1                   # Logs simples
    ├── start-bot-single.ps1              # Iniciar bot (single)
    ├── start-bot.bat                     # Iniciar bot (batch)
    ├── start-bot.ps1                     # Iniciar bot (PowerShell)
    ├── stop-bot-single.ps1               # Detener bot (single)
    ├── stop-bot.bat                      # Detener bot (batch)
    └── view-logs.ps1                     # Ver logs
```

## 🎯 **Categorías de Scripts**

### 🤖 **Assistant Management** (`assistant-management/`)
**Propósito**: Gestión completa del asistente OpenAI
- ✅ **Archivos RAG**: Agregar/eliminar archivos de contexto
- ✅ **Prompts**: Actualizar instrucciones del asistente
- ✅ **Funciones**: Gestionar funciones OpenAI
- ✅ **Threads**: Limpiar conversaciones
- ✅ **CLI**: Interfaz de línea de comandos

**Scripts Prioritarios**:
```bash
node scripts/assistant-management/update-prompt.js
node scripts/assistant-management/add-rag-file.js [archivo]
node scripts/assistant-management/update-functions.js
```

### 🎤 **Voice Scripts** (`voice/`)
**Propósito**: 🎯 **PRIORIDAD MULTIMEDIA** - Scripts de voz y audio
- ✅ **Configuración**: Verificar setup de transcripción
- ✅ **Testing**: Probar respuestas de voz
- ✅ **Transcripción**: Test de audio a texto

**Scripts de Desarrollo Activo**:
```bash
node scripts/voice/check-voice-config.js        # Verificar configuración
node scripts/voice/test-voice-responses.js      # Test respuestas voz
node scripts/voice/test-voice-transcription.js  # Test transcripción
```

### 🧪 **Testing Scripts** (`testing/`)
**Propósito**: Scripts de prueba y validación
- ✅ **Contexto**: Test de funciones de contexto
- ✅ **Detección**: Test de detección de respuestas
- ✅ **Registry**: Test de registro de funciones

### 🚀 **Deployment Scripts** (`deployment/`)
**Propósito**: Scripts para despliegue y verificación
- ✅ **Pre-deploy**: Checklist antes del despliegue
- ✅ **Build**: Verificación de construcción
- ✅ **Environment**: Validación de entorno

### 🛠️ **Setup Scripts** (`setup/`)
**Propósito**: Configuración inicial del sistema
- ✅ **Secretos**: Configurar variables de entorno
- ✅ **Webhooks**: Setup de webhooks específicos

### 🪟 **Windows Scripts** (`windows/`)
**Propósito**: Scripts específicos para entorno Windows
- ✅ **Railway**: Gestión de logs y deployment
- ✅ **Bot Management**: Iniciar/detener bot
- ✅ **Environment**: Setup de entorno Windows

## 🚀 **Uso Rápido por Categoría**

### **🎤 Desarrollo Multimedia (PRIORIDAD)**
```bash
# Verificar configuración de voz
node scripts/voice/check-voice-config.js

# Test completo de voz
node scripts/voice/test-voice-responses.js
node scripts/voice/test-voice-transcription.js
```

### **🤖 Gestión Asistente OpenAI**
```bash
# Actualizar prompt principal
node scripts/assistant-management/update-prompt.js

# Agregar nuevo archivo RAG
node scripts/assistant-management/add-rag-file.js docs/new-context.txt

# Actualizar funciones
node scripts/assistant-management/update-functions.js
```

### **🧪 Testing y Validación**
```bash
# Test funciones de contexto
node scripts/testing/test-context-direct.js

# Test detección de respuestas
node scripts/testing/test-reply-detection.js

# Test registry de funciones
node scripts/testing/registry/test-function-registry.js
```

### **🚀 Deployment**
```bash
# Pre-deploy checklist
node scripts/deployment/predeploy-checklist.js

# Verificar build
node scripts/deployment/verify-build.js

# Verificar entorno
node scripts/deployment/verify-environment.js
```

### **🪟 Windows (PowerShell)**
```powershell
# Iniciar bot
./scripts/windows/start-bot.ps1

# Ver logs en tiempo real
./scripts/windows/view-logs.ps1

# Descargar logs de Railway
./scripts/windows/download-railway-logs.ps1
```

## 🛠️ **Convenciones de Desarrollo**

### **📝 Nomenclatura de Scripts**
```
[categoria]-[funcion]-[especifico].js

✅ Ejemplos correctos:
- test-voice-transcription.js    # Test específico de transcripción
- setup-typing-webhook.js        # Setup específico de webhook
- verify-build.js                # Verificación de build

❌ Evitar:
- script.js                      # Muy genérico
- test.js                        # Sin especificar qué testea
- update.js                      # Sin especificar qué actualiza
```

### **🔧 Estructura de Script Profesional**
```javascript
#!/usr/bin/env node

/**
 * [Descripción clara del propósito del script]
 * 
 * Uso: node scripts/[categoria]/[nombre-script].js [argumentos]
 * 
 * Ejemplo: node scripts/voice/test-voice-responses.js
 */

import 'dotenv/config';
// ... imports

// Configuración
const CONFIG = {
    // Configuraciones específicas
};

// Función principal
async function main() {
    try {
        console.log('🎯 [Título del Script]\\n');
        // Lógica principal
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
```

## 📊 **Mantenimiento de Scripts**

### **✅ Scripts ACTIVOS (Mantener)**
- **🎤 Voice scripts** - Desarrollo multimedia prioritario
- **🤖 Assistant management** - Gestión OpenAI operativa
- **🧪 Testing scripts** - Validación continua
- **🚀 Deployment scripts** - Despliegue en producción
- **🪟 Windows scripts** - Desarrollo local

### **🗃️ Scripts ARCHIVADOS**
- **update-assistant-with-context-function.js** → `archive/scripts-obsoletos/`
- **update-assistant-with-history-function.js** → `archive/scripts-obsoletos/`

### **🔄 Rutina de Mantenimiento**

#### **📅 Semanal**
```bash
# 1. Verificar scripts de voz funcionan
npm run test:voice

# 2. Validar scripts de deployment
node scripts/deployment/verify-environment.js

# 3. Limpiar threads antiguos
node scripts/assistant-management/cleanup-threads.js
```

#### **📅 Mensual**
```bash
# 1. Revisar scripts obsoletos
# 2. Actualizar documentación
# 3. Validar todos los tests
# 4. Optimizar scripts lentos
```

## 🎯 **Roadmap de Scripts**

### **🚧 En Desarrollo**
- **🖼️ image-processing scripts** - Para análisis de imágenes
- **📊 analytics scripts** - Para métricas del bot
- **🔄 auto-backup scripts** - Backup automatizado

### **📋 Planificados**
- **🧹 cleanup automation** - Limpieza automática
- **📈 performance monitoring** - Monitoreo de rendimiento
- **🔒 security auditing** - Auditoría de seguridad

---

## 💡 **Recordatorio: Scripts como Herramientas**

> **"Un buen script debe ser autoexplicativo y confiable"**

- 🎯 **Propósito claro** en nombre y documentación
- 🛡️ **Manejo de errores** robusto
- 📋 **Logging informativo** para debugging
- 🔧 **Configuración flexible** via parámetros/env vars

---

**📅 Última actualización**: Julio 2025  
**👤 Responsable**: Equipo de Desarrollo  
**🔄 Próxima revisión**: Mensual  
**🎯 Prioridad**: Multimedia (voz, audio, imágenes)