# 🧪 Tests - Bot WhatsApp TeAlquilamos

## 📁 Estructura de Tests

```
tests/
├── README_TESTS.md              # Esta documentación
├── test-chat-history.js         # Test de historial de chat
│
├── beds24/                      # Tests de integración Beds24
│   ├── test-beds24.js          # Test principal de Beds24
│   └── TEST_BEDS24_README.md   # Documentación específica
│
├── escalation/                  # Tests de escalamiento
│   ├── test-minimal-escalation.js
│   └── ANALISIS_RAZONES_ESCALAMIENTO.md
│
├── logging/                     # Tests del sistema de logging
│   └── test-logging-system.js
│
├── voice/                       # Tests de funcionalidad de voz
│   ├── README_VOICE_TESTS.md   # Documentación de tests de voz
│   ├── test-voice-simple.mjs   # Test simple de voz
│   └── test-voice-to-voice.mjs # Test de voz a voz
│
└── whapi/                       # Tests de WhatsApp API
    ├── README_WHAPI_TESTS.md    # Documentación de tests WHAPI
    ├── README_MESSAGES_TEST.md  # Guía de tests de mensajes
    └── test-chat-specific.js    # Test de análisis de chat específico
```

## 🎯 Tests Disponibles

### 1. 🏨 **Tests de Beds24**
- **Archivo**: `beds24/test-beds24.js`
- **Documentación**: `beds24/TEST_BEDS24_README.md`
- **Propósito**: Probar integración con API de Beds24

### 2. 💬 **Tests de WhatsApp API**
- **Archivo**: `whapi/test-chat-specific.js`
- **Documentación**: `whapi/README_WHAPI_TESTS.md`
- **Propósito**: Análisis de conversaciones específicas

### 3. 🎤 **Tests de Voz**
- **Archivos**: `voice/test-voice-simple.mjs`, `voice/test-voice-to-voice.mjs`
- **Documentación**: `voice/README_VOICE_TESTS.md`
- **Propósito**: Probar funcionalidades de voz y transcripción

### 4. 📊 **Tests de Logging**
- **Archivo**: `logging/test-logging-system.js`
- **Propósito**: Validar sistema de logging

### 5. 🚨 **Tests de Escalamiento**
- **Archivo**: `escalation/test-minimal-escalation.js`
- **Documentación**: `escalation/ANALISIS_RAZONES_ESCALAMIENTO.md`
- **Propósito**: Probar escalamiento a agente humano

### 6. 📜 **Test de Historial**
- **Archivo**: `test-chat-history.js`
- **Propósito**: Probar gestión de historial de conversaciones

## 🚀 **Uso Rápido**

```bash
# Test de Beds24
npx tsx tests/beds24/test-beds24.js health

# Test de análisis de chat específico
node tests/whapi/test-chat-specific.js 573003913251

# Test de voz simple
node tests/voice/test-voice-simple.mjs

# Test de logging
node tests/logging/test-logging-system.js

# Test de historial de chat
node tests/test-chat-history.js 573003913251
```

## 📖 **Documentación Detallada**

Cada carpeta de tests contiene su propia documentación:
- `beds24/TEST_BEDS24_README.md` - Guía completa de tests de Beds24
- `whapi/README_WHAPI_TESTS.md` - Documentación de tests de WhatsApp
- `voice/README_VOICE_TESTS.md` - Guía de tests de voz
- `escalation/ANALISIS_RAZONES_ESCALAMIENTO.md` - Análisis de escalamiento

## 🔧 **Organización y Mantenimiento**

### Archivos Archivados
- **Tests obsoletos**: Movidos a `/archive/tests-obsoletos/`
- **Documentación completada**: Movida a `/archive/tests-documentacion/`

### Estructura Actual
- Cada tipo de test en su propia carpeta
- Documentación específica por funcionalidad
- Tests activos y mantenidos únicamente

## 📝 **Cambios Recientes (2025-07-23)**

1. ✅ Movidos tests de voz a carpeta `voice/`
2. ✅ Archivado `test-labels-update.js` (funcionalidad DISABLED)
3. ✅ Archivado `test-hybrid-flow.js` (ETAPA 2 completada)
4. ✅ Renombrados READMEs para evitar confusión
5. ✅ Archivada documentación de implementaciones completadas 