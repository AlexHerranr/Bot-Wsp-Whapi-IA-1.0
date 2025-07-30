# 🧪 Tests Structure - Bot WhatsApp TeAlquilamos

Estructura profesional de tests reorganizada según mejores prácticas de testing.

## 📁 Nueva Estructura Organizada

```
tests/
├── 📁 unit/                           # Tests unitarios
│   ├── data-sanitizer.test.ts         # Tests de sanitización de datos
│   ├── logger.test.ts                 # Tests del logger
│   ├── simple.test.ts                 # Tests simples unitarios
│   └── logging/                       # Tests del sistema de logging
│       └── test-logging-system.js
│
├── 📁 integration/                    # Tests de integración
│   ├── test-chat-history.js          # Integración historial de chat
│   ├── test-labels-update.js         # Integración actualización de labels
│   └── beds24/                       # Integración con Beds24
│       ├── test-beds24.js
│       ├── TEST_BEDS24_README.md
│       └── logs/
│
├── 📁 functional/                     # Tests funcionales (flujos completos)
│   ├── test-hybrid-flow.js           # Flujo híbrido completo
│   └── escalation/                   # Tests de escalamiento
│       ├── test-minimal-escalation.js
│       └── ANALISIS_RAZONES_ESCALAMIENTO.md
│
├── 📁 media/                          # Tests multimedia
│   ├── README_IMAGE_PROCESSING.md    # Documentación de procesamiento
│   ├── test-direct-vision.js         # Test visión directa
│   ├── test-full-image-flow.js       # Flujo completo de imágenes
│   ├── test-image-multimodal.js      # Tests multimodales
│   ├── test-real-assistant-image.js  # Test asistente real con imágenes
│   └── test-url-image.js             # Test imágenes por URL
│
├── 📁 audio/                          # Tests de audio
│   ├── README_AUDIO_TO_TEXT.md       # Documentación audio → texto
│   ├── README_TEXT_TO_AUDIO.md       # Documentación texto → audio
│   ├── test-audio-formats.js         # Test formatos de audio
│   ├── test-generated-audio.mp3      # Audio de prueba generado
│   ├── test-real-audio-flow.js       # Flujo real de audio
│   ├── test-simple-audio.js          # Test simple de audio
│   ├── test-text-to-audio.js         # Test texto a audio
│   └── test-voice-response-ready.js  # Test respuesta de voz lista
│
├── 📁 voice/                          # Tests específicos de voz
│   ├── README.md                     # Documentación de voz
│   ├── VOICE_IMPLEMENTATION_STATUS.md # Estado implementación
│   ├── test-voice-simple.mjs         # Test simple de voz
│   └── test-voice-to-voice.mjs       # Test voz a voz
│
├── 📁 e2e/                           # Tests end-to-end (preparado para futuro)
├── setup.ts                         # Configuración global de tests
└── README_TESTS.md                   # Esta documentación
```

## 🎯 Clasificación por Tipos de Tests

### 🔬 Unit Tests (`unit/`)
**Propósito**: Tests de componentes aislados y funciones puras
- Sanitización de datos
- Sistema de logging
- Utilidades individuales
- **Características**: Rápidos, sin dependencias externas

### 🔗 Integration Tests (`integration/`)
**Propósito**: Tests de integración entre servicios y APIs
- Historial de conversaciones con WhatsApp API
- Integración con Beds24 API
- Actualización de labels/etiquetas
- **Características**: Requieren servicios externos, más lentos

### ⚙️ Functional Tests (`functional/`)
**Propósito**: Tests de flujos completos y escenarios reales
- Flujos híbridos de conversación
- Escalamiento a humanos
- Procesos end-to-end del bot
- **Características**: Prueban funcionalidades completas

### 🎨 Media Tests (`media/`, `audio/`, `voice/`)
**Propósito**: Tests de capacidades multimedia
- **Media**: Procesamiento de imágenes, visión por computadora
- **Audio**: Conversión de formatos, transcripción, síntesis
- **Voice**: Conversaciones por voz, respuestas habladas
- **Características**: Requieren procesamiento multimedia, archivos de prueba

## 🚀 Comandos de Ejecución

```bash
# Todos los tests
npm test

# Por categoría
npm run test:unit                    # Solo tests unitarios
npm run test:integration             # Solo tests de integración  
npm run test:functional              # Solo tests funcionales
npm run test:media                   # Tests multimedia

# Tests específicos
node tests/integration/test-chat-history.js 573003913251
node tests/functional/test-hybrid-flow.js
npx tsx tests/integration/beds24/test-beds24.js health
node tests/voice/test-voice-simple.mjs
```

## 📊 Benefits de la Nueva Estructura

### ✅ **Beneficios Organizacionales**
- **Separación clara** por tipo y propósito
- **Escalabilidad** para nuevos tests
- **Mantenimiento** simplificado
- **Onboarding** más fácil para nuevos desarrolladores

### ✅ **Beneficios Técnicos**
- **Ejecución selectiva** por categorías
- **Paralelización** de tests por tipo
- **Configuración específica** por categoría
- **CI/CD optimizado** por pipeline

### ✅ **Beneficios de Desarrollo**
- **Debugging** más eficiente
- **Documentación** específica por área
- **Reutilización** de código de test
- **Cobertura** organizada por funcionalidad

## 🛠 Mejores Prácticas Implementadas

1. **Naming Convention**: Prefijo claro (`test-`) + descripción funcional
2. **Folder Structure**: Agrupación lógica por tipo y propósito  
3. **Documentation**: README específico por área funcional
4. **Isolation**: Tests unitarios sin dependencias externas
5. **Integration**: Tests de integración con servicios reales
6. **Multimedia**: Separación por tipo de media (audio, imagen, voz)

## 📝 Migración Completada

- ✅ **Tests sueltos** movidos a carpetas apropiadas
- ✅ **Estructura jerárquica** implementada
- ✅ **Documentación** actualizada y reorganizada
- ✅ **Archivos obsoletos** movidos a archive/
- ✅ **Tests activos** organizados por funcionalidad

Esta estructura profesional facilita el desarrollo, mantenimiento y escalabilidad del sistema de tests del bot de WhatsApp.