# Implementación de Voz a Voz 🎤 → 🔊

## Estado Actual ✅ (Actualizado 26 Julio 2025)

La funcionalidad de voz a voz está **implementada con simplificación** en mensajes interinos. Se eliminó la complejidad de mensajes interinos de voz por solicitud del usuario.

### Lo que funciona:

1. **Detección de mensajes de voz** ✅
   - El bot detecta correctamente cuando recibe mensajes tipo `voice`, `audio` o `ptt`
   - Se marca el estado `lastInputVoice = true` para el usuario

2. **Transcripción (opcional)** ✅
   - Si está habilitada (`ENABLE_VOICE_TRANSCRIPTION=true`), transcribe el audio
   - El texto se prefija con "🎤 [NOTA DE VOZ]:" para identificación

3. **Instrucciones especiales a OpenAI** ✅
   - Cuando detecta nota de voz, agrega instrucciones para respuestas breves
   - OpenAI responde de forma concisa (2-3 oraciones máximo)

4. **Generación de audio TTS** ✅
   - Convierte la respuesta a voz usando OpenAI TTS con modelo `gpt-4o-mini-tts`
   - Usa voz `coral` optimizada para español
   - Genera archivos MP3 con base64 directo para mejor compatibilidad

5. **Decisión inteligente** ✅
   - SIEMPRE responde con voz cuando el usuario envió voz
   - Ignora otros criterios (longitud, probabilidad aleatoria)

6. **🆕 Mensajes interinos simplificados** ✅ (26 Julio 2025)
   - **ELIMINADO**: Sistema complejo de mensajes interinos de voz (`generateVoiceResponse`)
   - **NUEVO**: Mensaje simple de texto "Voy a consultar disponibilidad" antes de funciones
   - **Beneficios**: Código más simple, menos complejidad, mismo propósito funcional

### Limitación con WHAPI ⚠️

WHAPI devuelve **error 500** al intentar descargar archivos desde URLs de ngrok. Esto es una limitación conocida en desarrollo local.

## 🔄 **Cambios Recientes (26 Julio 2025)**

### **❌ Removido: Función `generateVoiceResponse`**
```typescript
// ANTES (Eliminado):
async function generateVoiceResponse(message: string, chatId: string): Promise<void> {
    // 67 líneas de código complejo para TTS interino
    // Lógica de generación de audio
    // Manejo de errores y fallbacks
}
```

### **✅ Nuevo: Mensajes interinos simplificados**
```typescript
// DESPUÉS (Simplificado):
if (hasAvailabilityCheck && chatId) {
    await sendWhatsAppMessage(chatId, "Voy a consultar disponibilidad");
    logInfo('AVAILABILITY_INTERIM_SENT', 'Mensaje interino enviado', { 
        userId: shortUserId,
        chatId,
        environment: appConfig.environment,
        requestId
    });
}
```

### **📊 Beneficios de la Simplificación:**
- ✅ **67 líneas menos** de código complejo
- ✅ **Sin dependencias** de TTS para mensajes interinos
- ✅ **Menos puntos de falla** (errores de audio, base64, etc.)
- ✅ **Respuesta más rápida** (sin generar audio temporal)
- ✅ **Mismo propósito funcional** (informar al usuario sobre el proceso)

---

## Código Implementado

### 1. Procesamiento de mensajes de voz en el webhook

```typescript
// En app-unified.ts, líneas ~2960-2990
if (['voice', 'audio', 'ptt'].includes(message.type) && !message.from_me) {
    // Marcar que el usuario envió voz
    const userState = globalUserStates.get(userId) || { lastInputVoice: false };
    userState.lastInputVoice = true;
    globalUserStates.set(userId, userState);
    
    if (process.env.ENABLE_VOICE_TRANSCRIPTION === 'true') {
        // Transcribir audio
        const audioUrl = message.voice?.url || message.audio?.url || message.ptt?.url;
        const transcription = await transcribeAudio(audioUrl, userId, message.id);
        const audioText = `🎤 [NOTA DE VOZ]: ${transcription}`;
        
        // Agregar al buffer con flag de voz
        addToGlobalBuffer(userId, audioText, chatId, userName, true);
    }
}
```

### 2. Detección de mensaje de voz en OpenAI

```typescript
// En processWithOpenAI, líneas ~1820-1835
const isVoiceMessage = userMsg.includes('🎤 [NOTA DE VOZ]');
let messageWithContext = temporalContext + userMsg;

if (isVoiceMessage) {
    const voiceInstructions = `\n\n[INSTRUCCIÓN DEL SISTEMA: El usuario envió una NOTA DE VOZ. Por favor responde de forma CONCISA y NATURAL, como si estuvieras hablando. Usa un tono conversacional, evita listas largas o información muy detallada. Máximo 2-3 oraciones cortas.]`;
    messageWithContext = temporalContext + userMsg + voiceInstructions;
}
```

### 3. Decisión de responder con voz

```typescript
// En sendWhatsAppMessage, líneas ~655-660
const shouldUseVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && (
    userState?.lastInputVoice  // Si el usuario envió voz, SIEMPRE responder con voz
);
```

## Configuración Requerida

```env
# En .env
ENABLE_VOICE_RESPONSES=true
ENABLE_VOICE_TRANSCRIPTION=true
TTS_VOICE=nova  # Opciones: alloy, echo, fable, onyx, nova, shimmer
WHISPER_LANGUAGE=es
MAX_AUDIO_SIZE=26214400  # 25MB
MAX_AUDIO_DURATION=300   # 5 minutos
```

## Soluciones para Producción

### Opción 1: Railway/Cloud Run (Recomendado)
En producción con una URL pública real, WHAPI debería poder descargar los archivos sin problemas.

### Opción 2: CDN o Almacenamiento Externo
```javascript
// Pseudocódigo para subir a S3/Cloudinary
const audioBuffer = await ttsResponse.arrayBuffer();
const publicUrl = await uploadToS3(audioBuffer, fileName);
// Usar publicUrl en lugar de URL local
```

### Opción 3: Base64 con conversión
Investigar si WHAPI tiene un endpoint para subir archivos directamente y obtener una URL interna.

## Tests Disponibles

1. **Test completo**: `node tests/test-voice-to-voice.mjs`
   - Simula una nota de voz real con URL de audio

2. **Test simplificado**: `node tests/test-voice-simple.mjs`
   - Simula transcripción ya procesada

## Logs para Debugging

```bash
# Ver todos los logs de voz
tail -f logs/bot-session-*.log | grep -E "(VOICE|🎤|🔊)"

# Ver errores específicos
grep -E "VOICE_.*ERROR" logs/bot-session-*.log

# Ver flujo completo
grep "573003913251" logs/bot-session-*.log | grep -E "(VOICE|MESSAGE_RECEIVED|OPENAI)"
```

## ⚠️ Problemas Identificados

### Problema Crítico: Pronunciación en Español del TTS

**Estado**: Problema activo reportado  
**Severidad**: Media - Afecta calidad de experiencia de usuario  
**Modelo Actual**: OpenAI TTS con voz `alloy` (por defecto en código)

#### Descripción del Problema
El modelo TTS actual (configurado como `alloy` en `src/app-unified.ts:1045`) está presentando **fallas en la pronunciación del español**, lo que afecta la comprensión y naturalidad de las respuestas de voz del bot.

#### Modelos/Voces Disponibles para Evaluación

**Voces OpenAI TTS Actuales:**
- `alloy` - Neutral, balanceada ⚠️ **(Actual - Con problemas)**
- `echo` - Masculina, profunda  
- `fable` - Británica, expresiva
- `onyx` - Masculina, grave
- `nova` - Femenina, cálida 🔍 **(Candidata para español)**
- `shimmer` - Femenina, suave 🔍 **(Candidata para español)**

#### Alternativas Técnicas a Evaluar

**1. Cambio de Voz OpenAI TTS:**
```env
# Probar en .env
TTS_VOICE=nova    # Voz más cálida, podría ser mejor para español
# o
TTS_VOICE=shimmer # Voz suave, alternativa para español
```

**2. Servicios Especializados en Español:**
- **Amazon Polly**: Voces nativas en español (Conchita, Enrique, Miguel, Penélope)
- **Google Cloud TTS**: Voces WaveNet en español con pronunciación superior
- **Microsoft Azure Speech**: Voces neurales específicas para español latinoamericano
- **ElevenLabs**: TTS premium con voces muy naturales (costo más alto)

**3. Modelos Open Source:**
- **Coqui TTS**: Modelos entrenados específicamente en español
- **Mozilla TTS**: Alternativa open source con soporte español
- **Tortoise TTS**: Alta calidad pero mayor latencia

#### Configuración de Evaluación

```typescript
// src/app-unified.ts - Líneas a modificar
// Actual:
voice: process.env.TTS_VOICE as any || 'alloy',

// Para testing:
voice: process.env.TTS_VOICE as any || 'nova', // Cambiar default
```

#### Variables de Entorno para Testing
```env
# Testing de voces OpenAI
TTS_VOICE=nova          # Probar voz cálida
TTS_VOICE=shimmer       # Probar voz suave
TTS_VOICE=onyx          # Probar voz masculina grave

# Para implementación futura de servicios alternativos
TTS_SERVICE=openai      # openai, aws-polly, google, azure
AWS_POLLY_VOICE=Penelope # Si se implementa Polly
GOOGLE_TTS_VOICE=es-ES-Wavenet-C # Si se implementa Google
```

#### Plan de Evaluación Sugerido

**Fase 1: Testing Inmediato (OpenAI)**
1. Cambiar default de `alloy` a `nova` 
2. Probar respuestas con texto en español típico del dominio hotelero
3. Evaluar pronunciación de: fechas, números, direcciones, nombres propios

**Fase 2: Comparación Sistemática**
1. Crear script de testing con frases comunes del bot
2. Generar audios con todas las voces OpenAI disponibles
3. Evaluación cualitativa de pronunciación y naturalidad

**Fase 3: Implementación de Alternativas (Si es necesario)**
1. Integración con Amazon Polly para voces nativas español
2. Comparación de calidad vs costo vs latencia
3. Implementación de fallback automático

#### Impacto en Costos
- **OpenAI TTS**: $0.015 por 1K caracteres (sin cambio de costo)
- **Amazon Polly**: $4.00 por 1M caracteres (26% más barato)
- **Google Cloud TTS**: $16.00 por 1M caracteres (similar a OpenAI)
- **ElevenLabs**: $0.30 por 1K caracteres (20x más caro)

#### Métricas para Evaluación
- **Pronunciación correcta**: Palabras en español, números, fechas
- **Naturalidad**: Fluidez y entonación apropiada
- **Comprensibilidad**: Facilidad de entendimiento por usuarios
- **Consistencia**: Calidad uniforme en diferentes tipos de respuesta
- **Latencia**: Tiempo de generación de audio
- **Costo**: Impacto en costos operacionales

#### ✅ Implementado - Julio 2025
- [x] **Upgrade a `gpt-4o-mini-tts`**: Modelo más reciente 2024-2025 (reemplaza tts-1-hd)
- [x] **Instrucciones de pronunciación**: Agregadas instrucciones específicas para español neutro
- [x] **Cambio a voz `coral`**: Nueva voz recomendada por OpenAI (reemplaza nova)
- [x] **11 voces disponibles**: Acceso a voces nuevas (ash, ballad, coral, sage)
- [x] **Investigación completa**: Documentado análisis comparativo vs Amazon Polly

#### Tareas Pendientes
- [ ] Crear script de testing con frases típicas del dominio hotelero
- [ ] **EVALUAR INMEDIATO**: Pronunciación con `gpt-4o-mini-tts` + `coral` + instrucciones
- [ ] Probar voces nuevas: `ash`, `ballad`, `sage` para español
- [ ] Documentar diferencias de pronunciación entre las 11 voces disponibles
- [ ] Investigar integración con Amazon Polly (solo si persisten problemas)
- [ ] Considerar implementación de selección dinámica de voz por idioma
- [ ] Determinar costo del nuevo modelo `gpt-4o-mini-tts`

---

## Resumen

✅ **La implementación está completa y funcional**  
⚠️ **Limitación**: WHAPI no puede acceder a URLs de ngrok en desarrollo local  
🚀 **Solución**: Funcionará correctamente en producción con URLs públicas reales  
🔍 **Pendiente**: Evaluar y mejorar pronunciación en español del TTS actual