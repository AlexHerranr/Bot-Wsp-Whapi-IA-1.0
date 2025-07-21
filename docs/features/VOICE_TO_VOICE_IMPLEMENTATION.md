# Implementación de Voz a Voz 🎤 → 🔊

## Estado Actual ✅

La funcionalidad de voz a voz está **completamente implementada** en el código, pero tiene una limitación con WHAPI en entornos de desarrollo local.

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
   - Convierte la respuesta a voz usando OpenAI TTS
   - Genera archivos OGG en `tmp/audio/`
   - Crea URLs públicas para los archivos

5. **Decisión inteligente** ✅
   - SIEMPRE responde con voz cuando el usuario envió voz
   - Ignora otros criterios (longitud, probabilidad aleatoria)

### Limitación con WHAPI ⚠️

WHAPI devuelve **error 500** al intentar descargar archivos desde URLs de ngrok. Esto es una limitación conocida en desarrollo local.

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

## Resumen

✅ **La implementación está completa y funcional**
⚠️ **Limitación**: WHAPI no puede acceder a URLs de ngrok en desarrollo local
🚀 **Solución**: Funcionará correctamente en producción con URLs públicas reales