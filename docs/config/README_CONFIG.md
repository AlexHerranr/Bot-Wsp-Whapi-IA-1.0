# ⚙️ **Configuration Management - Bot WhatsApp TeAlquilamos**

> **Estructura profesional de configuraciones organizadas por propósito y entorno**

## 🎯 **Filosofía de Configuración**

### **Principios de Configuración Profesional**
1. **🎯 Separación por Función**: Configs agrupadas por propósito específico
2. **🌍 Multi-Entorno**: Configuraciones diferenciadas por entorno
3. **🔒 Seguridad**: Separación clara entre configs públicas y secretas
4. **🔄 Mantenibilidad**: Estructura escalable y fácil de mantener
5. **📋 Documentación**: Cada config documentada y versionada

## 📁 **Estructura Profesional Implementada**

```
config/
├── 📖 README_CONFIG.md            # ← ESTE MANUAL
│
├── 🤖 assistant/                  # ← CONFIGURACIÓN OPENAI ASSISTANT
│   └── assistant-config.json      # Estado actual del assistant
│
├── 💻 development/                # ← CONFIGURACIONES DE DESARROLLO
│   ├── nodemon.json               # Configuración nodemon para desarrollo
│   └── jest.config.js             # Configuración testing con Jest
│
├── 🏗️ build/                      # ← CONFIGURACIONES DE BUILD
│   └── tsconfig.build.json        # TypeScript config para producción
│
└── 🌍 environments/               # ← CONFIGURACIONES POR ENTORNO (FUTURO)
    ├── development.json           # Config desarrollo (preparado)
    ├── staging.json               # Config staging (preparado)
    └── production.json            # Config producción (preparado)
```

## 🎯 **Categorías de Configuración**

### 🤖 **Assistant Configuration** (`assistant/`)
**Propósito**: Configuración del asistente OpenAI y estado actual

**📄 `assistant-config.json`**
```json
{
  "timestamp": "2025-07-XX",
  "assistant": {
    "id": "asst_XXX",
    "name": "TeAlquilamos Bot v2.0",
    "model": "gpt-4o"
  },
  "vectorStore": {
    "id": "vs_XXX",
    "name": "TeAlquilamos-RAG-Knowledge-Base-v2",
    "fileCount": 17
  },
  "uploadedFiles": [...],
  "lastUpdate": "2025-07-XX",
  "promptHash": "XXX"
}
```

**🔧 Uso Operativo**:
- Referencia para scripts de gestión del assistant
- Estado sincronizado con OpenAI
- Historial de archivos RAG subidos
- Hash de prompt para control de versiones

### 💻 **Development Configuration** (`development/`)
**Propósito**: Configuraciones para desarrollo local

**📄 `nodemon.json`**
```json
{
  "watch": ["src"],
  "ext": "ts",
  "ignore": ["**/*.test.ts", "**/*.spec.ts", "tmp/threads.json"],
  "delay": "3",
  "execMap": {
    "ts": "tsx"
  }
}
```

**📄 `jest.config.js`**
- Configuración completa de testing
- Coverage reports
- Setup de tests
- Timeouts y verbose mode

### 🏗️ **Build Configuration** (`build/`)
**Propósito**: Configuraciones para construcción y despliegue

**📄 `tsconfig.build.json`**
- Extends del tsconfig principal
- Optimizaciones para producción
- Exclusión de archivos de test
- Output limpio sin sourcemaps

## 🔧 **Configuraciones por Tipo**

### **📋 Runtime Configurations**
```
src/config/
├── environment.ts        # Variables de entorno
├── features.ts          # Feature flags
├── secrets.ts           # Gestión de secretos
└── integrations/        # Configs de integraciones
    └── beds24.config.ts # Configuración Beds24
```

### **🛠️ Build & Development Tools**
```
config/
├── development/nodemon.json      # Hot reload desarrollo
├── development/jest.config.js    # Testing framework
├── build/tsconfig.build.json     # TypeScript build
└── [raíz]/tsconfig.json          # TypeScript base
```

### **🤖 External Services**
```
config/
├── assistant/assistant-config.json  # OpenAI Assistant
└── [futuro]/
    ├── whapi.config.json            # WhatsApp API
    ├── beds24.config.json           # Beds24 API
    └── logging.config.json          # Configuración logs
```

## 🌍 **Configuración por Entornos**

### **🚧 Estructura Preparada (Futuro)**
```
config/environments/
├── development.json     # Desarrollo local
├── staging.json        # Entorno de pruebas
└── production.json     # Producción
```

**Ejemplo de estructura por entorno**:
```json
{
  "environment": "development",
  "api": {
    "port": 3008,
    "baseUrl": "http://localhost:3008",
    "cors": {
      "enabled": true,
      "origins": ["*"]
    }
  },
  "openai": {
    "model": "gpt-4o",
    "maxTokens": 4000,
    "temperature": 0.7
  },
  "whapi": {
    "baseUrl": "https://gate.whapi.cloud",
    "timeout": 30000
  },
  "logging": {
    "level": "debug",
    "console": true,
    "files": true
  }
}
```

## 🔒 **Gestión de Secretos y Seguridad**

### **✅ Configuraciones PÚBLICAS (Repositorio)**
- ✅ **Configuraciones de desarrollo**: nodemon, jest, tsconfig
- ✅ **Configuraciones de build**: optimizaciones, paths
- ✅ **Templates de configuración**: structures sin secrets
- ✅ **Estado de assistant**: IDs públicos, metadata

### **❌ Configuraciones PRIVADAS (NO Repositorio)**
- ❌ **API Keys**: OpenAI, WhatsApp, Beds24
- ❌ **Tokens de acceso**: JWT secrets, session keys
- ❌ **URLs privadas**: Webhooks, internal endpoints
- ❌ **Credenciales**: Passwords, database connections

### **🛡️ Buenas Prácticas**
```bash
# Variables de entorno para secrets
OPENAI_API_KEY=sk-xxx
WHAPI_TOKEN=xxx
BEDS24_API_KEY=xxx

# Archivos .gitignore
config/environments/production.json
config/secrets/
.env
.env.local
.env.production
```

## 🚀 **Uso de Configuraciones**

### **💻 Desarrollo Local**
```bash
# Usar nodemon con config específica
npm run dev
# Internamente usa: nodemon --config config/development/nodemon.json

# Testing con Jest
npm run test
# Usa: config/development/jest.config.js

# Verificar configuración TypeScript
npm run check:types
# Usa: tsconfig.json + config/build/tsconfig.build.json
```

### **🏗️ Build y Deployment**
```bash
# Build optimizado
npm run build
# Usa: config/build/tsconfig.build.json

# Pre-deploy checks
npm run pre-deploy:check
# Verifica todas las configuraciones
```

### **🤖 Gestión Assistant**
```bash
# Scripts usan assistant-config.json automáticamente
node scripts/assistant-management/update-prompt.js
node scripts/assistant-management/add-rag-file.js

# Config se actualiza automáticamente
```

## 🛠️ **Mantenimiento de Configuraciones**

### **🔄 Rutina Semanal**
```bash
# 1. Verificar configuración de assistant
node scripts/assistant-management/assistant-cli.js status

# 2. Validar configuraciones de desarrollo
npm run test:env

# 3. Verificar build configurations
npm run build:check
```

### **📅 Rutina Mensual**
```bash
# 1. Revisar y actualizar dependencies en configs
npm run check:deps

# 2. Auditar configuraciones de seguridad
npm run audit:security

# 3. Verificar configuraciones obsoletas
# 4. Documentar cambios en configs
```

## 📋 **Migración y Versionado**

### **🔄 Cambios en Configuraciones**
1. **Backup de config actual**
2. **Implementar cambio**
3. **Testear en desarrollo**
4. **Documentar el cambio**
5. **Deployar con rollback plan**

### **📝 Control de Versiones**
```json
{
  "configVersion": "2.1.0",
  "lastUpdated": "2025-07-XX",
  "changes": [
    {
      "version": "2.1.0",
      "date": "2025-07-XX",
      "description": "Reorganización estructura profesional",
      "files": ["assistant-config.json", "nodemon.json"]
    }
  ]
}
```

## 🎯 **Roadmap de Configuraciones**

### **🚧 En Desarrollo**
- **🌍 Environment-specific configs** - Por entorno
- **🔄 Auto-sync assistant config** - Sincronización automática
- **📊 Config validation** - Validación automática

### **📋 Planificado**
- **🔒 Encrypted configs** - Configuraciones encriptadas
- **🌐 Remote config management** - Gestión remota
- **📈 Config analytics** - Métricas de configuración

---

## 💡 **Principios de Configuración**

> **"Las configuraciones deben ser explícitas, versionadas y documentadas"**

- 🎯 **Una responsabilidad por archivo**
- 🌍 **Separación por entorno**
- 🔒 **Secrets nunca en repositorio**
- 📋 **Documentación actualizada**
- 🔄 **Versionado y rollback**

---

**📅 Última actualización**: Julio 2025  
**👤 Responsable**: Equipo de Desarrollo  
**🔄 Próxima revisión**: Mensual  
**🎯 Estado**: Reorganización profesional completada