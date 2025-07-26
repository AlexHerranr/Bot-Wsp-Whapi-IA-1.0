# 📋 TAREAS PENDIENTES - BOT WHATSAPP

## 🎯 **PRIORIDAD ALTA - FUNCIONALIDADES MEDIA**

### 📱 **1. Detección de Respuestas Citadas**
- **Estado**: 📋 Planificada
- **Tiempo Estimado**: 30 minutos
- **Descripción**: Implementar detección y enriquecimiento de contexto cuando usuarios responden a mensajes específicos
- **Archivos a modificar**: `src/app-unified.ts`
- **Configuración**: `ENABLE_REPLY_DETECTION=true`
- **Dependencias**: Ninguna

### 🖼️ **2. Procesamiento de Imágenes**
- **Estado**: 📋 Planificada
- **Tiempo Estimado**: 45 minutos
- **Descripción**: Implementar análisis automático de imágenes usando OpenAI Vision
- **Archivos a modificar**: `src/app-unified.ts`
- **Configuración**: `ENABLE_IMAGE_PROCESSING=true`
- **Dependencias**: OpenAI SDK v4+, node-fetch@3

### 🎤 **3. Transcripción de Voz**
- **Estado**: 📋 Planificada
- **Tiempo Estimado**: 60 minutos
- **Descripción**: Implementar transcripción automática de notas de voz usando OpenAI Whisper
- **Archivos a modificar**: `src/app-unified.ts`
- **Configuración**: `ENABLE_VOICE_TRANSCRIPTION=true`
- **Dependencias**: OpenAI SDK v4+, node-fetch@3

### 🔊 **4. Respuestas de Voz**
- **Estado**: 📋 Planificada
- **Tiempo Estimado**: 45 minutos
- **Descripción**: Implementar generación automática de respuestas en voz usando OpenAI TTS
- **Archivos a modificar**: `src/app-unified.ts`
- **Configuración**: `ENABLE_VOICE_RESPONSES=true`
- **Dependencias**: OpenAI SDK v4+, WHAPI para envío de audio

---

## 🔧 **PRIORIDAD MEDIA - OPTIMIZACIONES**

### 🏷️ **5. Sistema de Etiquetas Inteligente**
- **Estado**: 🔄 En desarrollo
- **Tiempo Estimado**: 2-3 horas
- **Descripción**: Implementar etiquetado automático de conversaciones
- **Archivos a modificar**: `src/services/`, `src/functions/`
- **Dependencias**: Sistema de contexto existente

### ⌨️ **6. Buffer Basado en Typing**
- **Estado**: 🔄 En desarrollo
- **Tiempo Estimado**: 1-2 horas
- **Descripción**: Implementar procesamiento inteligente basado en indicadores de escritura
- **Archivos a modificar**: `src/utils/messageBuffering.ts`
- **Dependencias**: Sistema de buffer existente

---

## 📊 **PRIORIDAD BAJA - MEJORAS**

### 🧠 **7. Optimizaciones de Memoria**
- **Estado**: 📋 Planificada
- **Tiempo Estimado**: 1 hora
- **Descripción**: Implementar limpieza automática y gestión eficiente de memoria
- **Archivos a modificar**: `src/app-unified.ts`
- **Dependencias**: Sistema de estados existente

### 📈 **8. Métricas Avanzadas**
- **Estado**: 📋 Planificada
- **Tiempo Estimado**: 1-2 horas
- **Descripción**: Implementar métricas avanzadas y alertas automáticas
- **Archivos a modificar**: `src/routes/metrics.ts`
- **Dependencias**: Sistema de logging existente

---

## 🎯 **PLAN DE IMPLEMENTACIÓN DETALLADO**

### **FASE 1: FUNCIONALIDADES MEDIA (3-4 horas)**
1. **Etapa 0**: Preparación y validación (30 min)
   - [ ] Crear branch de desarrollo
   - [ ] Configurar variables de entorno
   - [ ] Verificar dependencias
   - [ ] Backup del código actual

2. **Etapa 1**: Detección de respuestas citadas (30 min)
   - [ ] Implementar interface UserState
   - [ ] Agregar código de detección en webhook
   - [ ] Configurar logs y métricas
   - [ ] Probar funcionalidad

3. **Etapa 2**: Procesamiento de imágenes (45 min)
   - [ ] Implementar función analyzeImage
   - [ ] Agregar caso 'image' en webhook
   - [ ] Configurar manejo de errores
   - [ ] Probar con diferentes tipos de imágenes

4. **Etapa 3**: Transcripción de voz (60 min)
   - [ ] Implementar función transcribeAudio
   - [ ] Agregar casos voice/audio/ptt en webhook
   - [ ] Configurar validación de tamaño
   - [ ] Probar transcripción en diferentes idiomas

5. **Etapa 4**: Respuestas de voz (45 min)
   - [ ] Modificar función sendWhatsAppMessage
   - [ ] Implementar lógica de decisión de voz
   - [ ] Configurar TTS y envío de audio
   - [ ] Probar fallbacks a texto

6. **Etapa 5**: Optimización y limpieza (30 min)
   - [ ] Implementar limpieza automática
   - [ ] Agregar endpoint de métricas
   - [ ] Configurar logs de limpieza
   - [ ] Verificar optimizaciones

7. **Etapa 6**: Pruebas integrales y deploy (45 min)
   - [ ] Pruebas de integración completas
   - [ ] Validar casos límite
   - [ ] Configurar para producción
   - [ ] Deploy y monitoreo

### **FASE 2: OPTIMIZACIONES (2-3 horas)**
- [ ] Sistema de etiquetas inteligente
- [ ] Buffer basado en typing
- [ ] Optimizaciones de memoria

### **FASE 3: ESCALABILIDAD (1-2 horas)**
- [ ] Métricas avanzadas
- [ ] Monitoreo en tiempo real
- [ ] Alertas automáticas

---

## ⚙️ **CONFIGURACIÓN REQUERIDA**

### **Variables de Entorno Nuevas**
```env
# === NUEVAS FUNCIONALIDADES MEDIA ===
# Toggles principales (todas inician deshabilitadas para pruebas)
ENABLE_REPLY_DETECTION=false
ENABLE_IMAGE_PROCESSING=false
ENABLE_VOICE_TRANSCRIPTION=false
ENABLE_VOICE_RESPONSES=false

# Configuración de voz
TTS_VOICE=alloy                    # Opciones: alloy, echo, fable, onyx, nova, shimmer
VOICE_THRESHOLD=150                # Caracteres mínimos para considerar respuesta de voz
VOICE_RANDOM_PROBABILITY=0.1       # 10% de probabilidad de respuesta aleatoria en voz

# Límites de seguridad
MAX_IMAGE_SIZE=20971520           # 20MB máximo para imágenes
MAX_AUDIO_SIZE=26214400          # 25MB máximo para audio (límite Whisper)
MAX_AUDIO_DURATION=300           # 5 minutos máximo de duración

# Configuración de procesamiento
IMAGE_ANALYSIS_MODEL=gpt-4o-mini  # Modelo para análisis de imágenes
WHISPER_LANGUAGE=es               # Idioma principal para transcripción
```

### **Dependencias Requeridas**
- [ ] OpenAI SDK v4+ (ya instalado)
- [ ] node-fetch@3 (instalar si no está)
- [ ] Node.js 18+ (ya cumplido)

---

## 📈 **MÉTRICAS DE ÉXITO**

### **KPIs de Media**
- **Adopción**: % usuarios usando voz, imágenes procesadas/día
- **Performance**: Tiempo promedio transcripción < 3s, análisis imagen < 2s
- **Costos**: Costo/usuario activo, tokens consumidos en Vision
- **Calidad**: Tasa de fallback a texto < 5%

### **Monitoreo**
- [ ] Endpoint `/metrics/media` para estadísticas
- [ ] Logs con emojis específicos: 🎤🖼️🔊📱
- [ ] Alertas automáticas para errores críticos

---

## 🚨 **CONSIDERACIONES TÉCNICAS**

### **Riesgos y Mitigaciones**
- **Alto consumo de tokens**: Fallbacks y límites configurables
- **Latencia en media**: Procesamiento asíncrono
- **Errores de API**: Manejo robusto de errores con fallbacks

### **Optimizaciones**
- **Toggles configurables** para activar/desactivar features
- **Procesamiento asíncrono** para evitar bloqueos
- **Fallbacks automáticos** para garantizar estabilidad
- **Límites de seguridad** para controlar costos

---

## 🎉 **BENEFICIOS ESPERADOS**

### **Experiencia de Usuario**
- **30-50% mejora** en engagement
- **Mejor accesibilidad** para usuarios con preferencias de voz
- **Contexto visual** para consultas hoteleras
- **Respuestas más naturales** y contextuales

### **Operacionales**
- **Reducción de escalamientos** por mejor comprensión
- **Mejor captura** de intenciones del usuario
- **Optimización de recursos** con toggles configurables

---

## 📚 **DOCUMENTACIÓN RELACIONADA**

### **Documentos Principales**
- [PLAN NUEVAS FUNCIONALIDADES.md](../features/PLAN%20NUEVAS%20FUNCIONALIDADES.md) - Plan completo de implementación
- [FUNCTION_INVENTORY.md](../features/FUNCTION_INVENTORY.md) - Inventario de funciones actualizado
- [SIGUIENTE_IMPLEMENTACION.md](../features/SIGUIENTE_IMPLEMENTACION.md) - Roadmap actualizado

### **Configuración**
- [env.example](../../env.example) - Variables de entorno actualizadas
- [package.json](../../package.json) - Dependencias del proyecto

---

## 🎯 **PRÓXIMOS PASOS**

### **Implementación Inmediata**
1. **Revisar** [PLAN NUEVAS FUNCIONALIDADES.md](../features/PLAN%20NUEVAS%20FUNCIONALIDADES.md)
2. **Configurar** variables de entorno en `env.example`
3. **Seguir** las etapas del plan secuencialmente
4. **Probar** cada funcionalidad antes de continuar

### **Monitoreo Post-Implementación**
- Verificar logs con emojis: 🎤🖼️🔊📱
- Acceder a `/metrics/media` para estadísticas
- Monitorear costos y performance

---

*Última actualización: Julio 2025 - Tareas de funcionalidades media agregadas* 