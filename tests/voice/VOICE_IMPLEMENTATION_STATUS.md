# Estado de Implementación de Voz 🎤

## Estado Actual ✅

### Lo que YA funciona:
1. **Procesamiento de mensajes de voz entrantes** - El webhook ahora puede recibir mensajes tipo `voice`, `audio` y `ptt`
2. **Transcripción de audio** - Si está habilitada, transcribe el audio usando Whisper
3. **Marcado de estado de voz** - Se marca cuando un usuario envía voz para responder con voz
4. **Generación de TTS** - OpenAI genera correctamente el audio de la respuesta
5. **Lógica de decisión** - El bot decide cuándo responder con voz según los criterios configurados

### Lo que NO funciona aún ❌:
1. **Envío de notas de voz** - WHAPI requiere una URL del archivo de audio, no base64
2. **Subida de archivos a WHAPI** - No está implementado el upload de archivos para obtener URLs

## Problema Principal

WHAPI requiere que el audio se envíe como una URL:
```json
{
  "to": "573003913251",
  "media": "https://example.com/audio.ogg"  // URL, no base64
}
```

Pero actualmente estamos generando el audio como un buffer/base64.

## Soluciones Posibles

### Opción 1: Subir a WHAPI Media (Recomendado)
1. Buscar si WHAPI tiene un endpoint para subir archivos
2. Subir el audio generado y obtener una URL
3. Usar esa URL para enviar la nota de voz

### Opción 2: Usar un servicio externo
1. Subir el audio a un servicio como S3, Cloudinary, etc.
2. Obtener la URL pública
3. Usar esa URL con WHAPI

### Opción 3: Servir archivos localmente
1. Guardar el audio temporalmente en el servidor
2. Exponerlo a través de un endpoint público
3. Usar esa URL con WHAPI

## Implementación Temporal

Por ahora, el bot envía un mensaje de texto con el prefijo `🔊 [Este mensaje debería ser una nota de voz]` para indicar que la respuesta debería haber sido de voz.

## Próximos Pasos

1. **Investigar API de WHAPI** para subida de archivos
2. **Implementar subida de archivos** si existe el endpoint
3. **Actualizar el código** para usar URLs en lugar de base64
4. **Probar end-to-end** con notas de voz reales

## Configuración Necesaria

```env
# Variables actuales necesarias
ENABLE_VOICE_RESPONSES=true
ENABLE_VOICE_TRANSCRIPTION=true
TTS_VOICE=nova
VOICE_THRESHOLD=150
VOICE_RANDOM_PROBABILITY=0.1
WHISPER_LANGUAGE=es
MAX_AUDIO_SIZE=26214400

# Posibles variables futuras
WHAPI_MEDIA_UPLOAD_URL=https://api.whapi.cloud/media  # Si existe
AUDIO_STORAGE_SERVICE=whapi  # whapi, s3, local, etc.
```

## Test Actual

El test `test-voice-to-voice.js` está preparado para:
1. ✅ Simular correctamente un mensaje de voz entrante
2. ✅ Verificar que el bot procese la voz
3. ⚠️ Verificar el envío (actualmente envía texto como fallback)

## Referencias

- [WHAPI Voice Message Docs](https://whapi.readme.io/reference/post_messages-voice)
- [OpenAI TTS Docs](https://platform.openai.com/docs/guides/text-to-speech)
- [Whisper API Docs](https://platform.openai.com/docs/guides/speech-to-text)