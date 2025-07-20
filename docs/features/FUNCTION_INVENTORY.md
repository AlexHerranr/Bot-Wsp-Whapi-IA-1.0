# 📋 INVENTARIO DE FUNCIONES DEL BOT

## 🔧 Funciones Implementadas

### 🤖 OpenAI Functions
- `get_conversation_context` - Obtiene contexto de conversación
- `inject_history` - Inyecta historial de conversación
- `escalate_to_human` - Escala conversación a humano

### 🏨 Beds24 Functions
- `beds24_availability` - Consulta disponibilidad de habitaciones

### 📱 Nuevas Funcionalidades Media (Planificadas)
- **Detección de Respuestas Citadas** - Contexto mejorado cuando usuarios responden mensajes específicos
- **Procesamiento de Imágenes** - Análisis automático de imágenes con OpenAI Vision
- **Transcripción de Voz** - Conversión de notas de voz a texto con Whisper
- **Respuestas de Voz** - Generación automática de respuestas en audio con TTS

## 🚧 Funciones en Desarrollo

### 🎯 Próximas Implementaciones
- Sistema de etiquetas inteligente
- Buffer basado en typing
- Optimizaciones de memoria

## 📊 Estado de Implementación

| Función | Estado | Prioridad | Complejidad |
|---------|--------|-----------|-------------|
| get_conversation_context | ✅ Implementada | Alta | Media |
| inject_history | ✅ Implementada | Alta | Media |
| escalate_to_human | ✅ Implementada | Media | Baja |
| beds24_availability | ✅ Implementada | Alta | Alta |
| **Detección de Respuestas** | 📋 Planificada | Media | Baja |
| **Procesamiento de Imágenes** | 📋 Planificada | Alta | Media |
| **Transcripción de Voz** | 📋 Planificada | Alta | Alta |
| **Respuestas de Voz** | 📋 Planificada | Media | Alta |

## 🔄 Flujo de Funciones

### Flujo Principal
1. **Recepción de Mensaje** → Webhook
2. **Análisis de Tipo** → Texto, Imagen, Audio, Voz
3. **Procesamiento Específico** → Según tipo de medio
4. **Inyección de Contexto** → get_conversation_context
5. **Generación de Respuesta** → OpenAI + Funciones
6. **Envío** → Texto o Voz según configuración

### Nuevas Rutas de Procesamiento
- **📱 Respuestas Citadas**: `message.context?.quoted_content` → Enriquecimiento de contexto
- **🖼️ Imágenes**: `message.type === 'image'` → OpenAI Vision → Descripción
- **🎤 Audio/Voz**: `message.type === 'voice|audio|ptt'` → Whisper → Transcripción
- **🔊 Respuestas de Voz**: Decisión inteligente → TTS → Audio

## ⚙️ Configuración Requerida

### Variables de Entorno para Media
```env
# Toggles principales
ENABLE_REPLY_DETECTION=false
ENABLE_IMAGE_PROCESSING=false
ENABLE_VOICE_TRANSCRIPTION=false
ENABLE_VOICE_RESPONSES=false

# Configuración de voz
TTS_VOICE=alloy
VOICE_THRESHOLD=150
VOICE_RANDOM_PROBABILITY=0.1

# Límites de seguridad
MAX_IMAGE_SIZE=20971520
MAX_AUDIO_SIZE=26214400
MAX_AUDIO_DURATION=300

# Procesamiento
IMAGE_ANALYSIS_MODEL=gpt-4o-mini
WHISPER_LANGUAGE=es
```

## 📈 Métricas y Monitoreo

### KPIs de Media
- % usuarios usando voz
- Imágenes procesadas/día
- Respuestas citadas/día
- Tiempo promedio transcripción
- Tasa de fallback a texto

### Endpoints de Monitoreo
- `/metrics/media` - Estadísticas de funcionalidades media
- Logs con emojis específicos: 🎤🖼️🔊📱

## 🎯 Próximos Pasos

1. **Implementar Etapa 0** - Preparación y validación
2. **Implementar Etapa 1** - Detección de respuestas citadas
3. **Implementar Etapa 2** - Procesamiento de imágenes
4. **Implementar Etapa 3** - Transcripción de voz
5. **Implementar Etapa 4** - Respuestas de voz
6. **Implementar Etapa 5** - Optimización y limpieza
7. **Implementar Etapa 6** - Pruebas integrales y deploy

---

*Última actualización: Julio 2025 - Plan de funcionalidades media agregado* 