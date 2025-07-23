# Test de Voz a Voz 🎤

Este directorio contiene tests para verificar la funcionalidad de entrada y salida de voz del bot.

## Configuración Necesaria

Antes de ejecutar el test, asegúrate de tener las siguientes variables en tu archivo `.env`:

```bash
# Habilitar respuestas de voz
ENABLE_VOICE_RESPONSES=true

# Habilitar transcripción de voz
ENABLE_VOICE_TRANSCRIPTION=true

# Configuración de voz TTS (Text-to-Speech)
TTS_VOICE=nova  # Opciones: alloy, echo, fable, onyx, nova, shimmer

# Umbral de caracteres para activar respuesta de voz
VOICE_THRESHOLD=150

# Probabilidad aleatoria de respuesta de voz (0.0 - 1.0)
VOICE_RANDOM_PROBABILITY=0.1

# Idioma para transcripción
WHISPER_LANGUAGE=es

# Tamaño máximo de audio (en bytes)
MAX_AUDIO_SIZE=26214400  # 25MB
```

## Ejecutar el Test

1. **Asegúrate de que el bot esté corriendo:**
   ```bash
   npm run dev
   ```

2. **En otra terminal, ejecuta el test:**
   ```bash
   node tests/test-voice-to-voice.js
   ```

## ¿Qué hace el test?

1. **Simula un mensaje de voz entrante** con tipo `voice`
2. **El bot transcribe el audio** usando Whisper de OpenAI
3. **OpenAI procesa la transcripción** y genera una respuesta
4. **El bot convierte la respuesta a voz** usando TTS
5. **Envía la nota de voz** al usuario vía WHAPI

## Flujo de Voz Completo

```
Usuario envía audio → Webhook recibe tipo "voice" → Transcripción (Whisper)
                                                          ↓
Chat recibe nota de voz ← TTS genera audio ← OpenAI genera respuesta
```

## Debugging

### Ver logs en tiempo real:
```bash
tail -f logs/bot-session-*.log | grep -E "(VOICE|🎤|🔊)"
```

### Buscar errores de voz:
```bash
grep -E "(VOICE_.*ERROR|AUDIO_.*ERROR)" logs/bot-session-*.log
```

### Logs importantes a buscar:

- `🎤 Procesando nota de voz...` - Inicio del procesamiento
- `🎤 Transcripción: "..."` - Resultado de la transcripción
- `🔊 Generando respuesta de voz...` - Inicio de TTS
- `VOICE_RESPONSE_SENT` - Confirmación de envío

## Criterios para Respuesta de Voz

El bot responderá con voz cuando:
1. El usuario envió una nota de voz (`lastInputVoice = true`)
2. La respuesta es mayor al umbral configurado (`VOICE_THRESHOLD`)
3. La respuesta contiene el emoji 🎤
4. Aleatoriamente según `VOICE_RANDOM_PROBABILITY`

## Voces Disponibles (TTS_VOICE)

- **alloy**: Voz neutral balanceada (default)
- **echo**: Voz masculina profunda
- **fable**: Voz británica expresiva
- **onyx**: Voz masculina profunda
- **nova**: Voz femenina cálida ⭐ (recomendada)
- **shimmer**: Voz femenina suave

## Troubleshooting

### El bot no transcribe el audio:
- Verifica que `ENABLE_VOICE_TRANSCRIPTION=true`
- Revisa que el audio tenga una URL válida
- Confirma que el audio sea menor a 25MB

### El bot no responde con voz:
- Verifica que `ENABLE_VOICE_RESPONSES=true`
- Revisa el umbral `VOICE_THRESHOLD`
- Confirma que OpenAI tenga acceso a TTS

### Error "No puedo escuchar audios":
- El mensaje llegó como tipo "text" en vez de "voice"
- El webhook handler no está procesando tipos de audio
- La transcripción está deshabilitada

## Archivos Relacionados

- `/src/app-unified.ts` - Lógica principal de manejo de voz
- `/tests/test-voice-to-voice.js` - Script de prueba
- `/scripts/test-voice-responses.js` - Test de respuestas de voz
- `/scripts/test-voice-transcription.js` - Test de transcripción