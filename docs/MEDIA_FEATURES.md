# 📋 Funcionalidades Media para Bot WhatsApp

## 🎯 Etapa 1: Detección de Respuestas Citadas ✅

### Descripción
Esta funcionalidad detecta cuando un usuario responde a un mensaje específico (quoted/reply) y enriquece el contexto agregando información del mensaje citado.

### Implementación Completada

#### 1. Cambios en el Código

**Archivo: `src/utils/userStateManager.ts`**
- Agregados campos `lastInputVoice` y `quotedMessagesCount` a la interface `UserState`

**Archivo: `src/app-unified.ts`**
- Importado tipo `UserState` desde `userStateManager.js`
- Creado Map global `globalUserStates` para mantener estados de usuario
- Agregada función helper `getTimestamp()`
- Implementada lógica de detección en el webhook handler

#### 2. Variables de Entorno Agregadas

En `.env` y `.env.example`:
```env
# === NUEVAS FUNCIONALIDADES MEDIA ===
ENABLE_REPLY_DETECTION=false
ENABLE_IMAGE_PROCESSING=false
ENABLE_VOICE_TRANSCRIPTION=false
ENABLE_VOICE_RESPONSES=false

# Configuración adicional...
```

#### 3. Cómo Funciona

Cuando un usuario responde a un mensaje:
1. El webhook detecta el campo `context.quoted_content`
2. Extrae el texto del mensaje citado
3. Enriquece el mensaje actual con el contexto
4. Formato: `[Usuario responde a: "texto citado..."] mensaje actual`
5. El mensaje enriquecido se envía a OpenAI con contexto completo

### Activación

1. En tu archivo `.env`, cambia:
   ```env
   ENABLE_REPLY_DETECTION=true
   ```

2. Reinicia el bot:
   ```bash
   npm run dev
   ```

### Pruebas

#### Prueba Manual
1. En WhatsApp, envía un mensaje al bot
2. Responde a ese mensaje usando la función de responder/citar
3. Verifica en los logs que aparezca: `📱 Respuesta detectada a:`

#### Script de Prueba
```bash
node scripts/test-reply-detection.js
```

### Logs y Monitoreo

Los siguientes logs se generan:
- `QUOTED_MESSAGE_DETECTED` - Cuando se detecta una respuesta citada
- Console log con emoji 📱 para identificación visual rápida

### Métricas

El sistema rastrea:
- `quotedMessagesCount` - Número de respuestas citadas por usuario
- `lastMessageTime` - Última actividad del usuario

### Próximas Etapas

- [ ] Etapa 2: Procesamiento de Imágenes
- [ ] Etapa 3: Transcripción de Voz
- [ ] Etapa 4: Respuestas de Voz

### Troubleshooting

**Problema**: No se detectan las respuestas citadas
- Verifica que `ENABLE_REPLY_DETECTION=true` en `.env`
- Confirma que el webhook está recibiendo el campo `context`
- Revisa los logs para mensajes de error

**Problema**: El contexto no se agrega correctamente
- Verifica la estructura del mensaje en los logs
- Asegúrate de que el mensaje citado tenga contenido de texto

---

## 🎯 Etapa 3: Transcripción de Voz ✅

### Descripción
Esta funcionalidad transcribe automáticamente las notas de voz enviadas por los usuarios usando OpenAI Whisper API, convirtiendo el audio en texto para que el bot pueda procesarlo y responder adecuadamente.

### Implementación Completada

#### 1. Cambios en el Código

**Archivo: `src/app-unified.ts`**
- Agregada función `transcribeAudio()` para procesar audio con Whisper API
- Implementado manejo de mensajes tipo 'voice', 'audio' y 'ptt' (Push to Talk)
- Transcripción asíncrona con fallbacks para errores
- Marcado de estado `lastInputVoice` para respuestas contextuales

#### 2. Cómo Funciona

Cuando un usuario envía una nota de voz:
1. El webhook detecta mensaje tipo 'voice', 'audio' o 'ptt'
2. Extrae la URL del audio
3. Descarga el audio y valida el tamaño (máx. 25MB)
4. Envía a OpenAI Whisper API (modelo whisper-1)
5. Recibe transcripción en español
6. Agrega al buffer: `🎤 [transcripción del audio]`
7. Marca `lastInputVoice = true` para posibles respuestas de voz

### Configuración

Variables de entorno relevantes:
```env
ENABLE_VOICE_TRANSCRIPTION=false    # Toggle principal
WHISPER_LANGUAGE=es                 # Idioma de transcripción
MAX_AUDIO_SIZE=26214400            # 25MB máximo
MAX_AUDIO_DURATION=300             # 5 minutos máximo
```

### Activación

1. En tu archivo `.env`, cambia:
   ```env
   ENABLE_VOICE_TRANSCRIPTION=true
   ```

2. Reinicia el bot

### Pruebas

#### Prueba Manual
1. Envía una nota de voz desde WhatsApp
2. Verifica en los logs: `🎤 Procesando nota de voz...`
3. Confirma que aparezca: `🎤 Transcripción: "[texto transcrito]"`
4. El bot debe responder considerando el contenido transcrito

#### Script de Prueba
```bash
node scripts/test-voice-transcription.js
```

Este script prueba:
- Nota de voz normal (type: voice)
- Audio PTT (Push to Talk)
- Audio sin URL (fallback)

### Logs y Monitoreo

Logs generados:
- `AUDIO_TRANSCRIPTION_ERROR` - Error transcribiendo audio
- `AUDIO_NO_URL` - Audio recibido sin URL
- `VOICE_TRANSCRIBED` - Voz transcrita exitosamente
- `VOICE_PROCESSING_ERROR` - Error general en procesamiento
- Console logs con emoji 🎤 para identificación visual

### Optimizaciones

- Temperatura 0.2 para mayor precisión
- Prompt contextualizado para hoteles
- Procesamiento asíncrono para no bloquear
- Validación de tamaño antes de descargar

### Tipos de Audio Soportados

1. **voice** - Notas de voz normales
2. **audio** - Archivos de audio
3. **ptt** - Push to Talk (grabación rápida)

### Casos de Uso

Ideal para:
- Consultas rápidas por voz mientras conducen
- Usuarios que prefieren hablar en lugar de escribir
- Mensajes largos o detallados
- Accesibilidad para usuarios con dificultades para escribir

### Métricas Rastreadas

- `transcriptionLength` - Longitud del texto transcrito
- `words` - Número de palabras transcritas
- `lastInputVoice` - Marca para respuestas contextuales

### Troubleshooting

**Problema**: Las notas de voz no se transcriben
- Verifica `ENABLE_VOICE_TRANSCRIPTION=true`
- Confirma que la API key tenga acceso a Whisper
- Revisa el tamaño del audio (< 25MB)

**Problema**: Transcripciones en inglés
- Verifica `WHISPER_LANGUAGE=es` en .env
- El prompt está en español para contexto

**Problema**: Errores de timeout
- Audios muy largos pueden causar timeout
- Considera reducir `MAX_AUDIO_DURATION`

**Problema**: Transcripciones imprecisas
- Whisper funciona mejor con audio claro
- Ruido de fondo puede afectar la precisión

### Próximas Etapas

- [x] Etapa 1: Detección de Respuestas Citadas
- [x] Etapa 2: Procesamiento de Imágenes
- [x] Etapa 3: Transcripción de Voz
- [x] Etapa 4: Respuestas de Voz

---

## 🎯 Etapa 4: Respuestas de Voz Automáticas ✅

### Descripción
Esta funcionalidad genera automáticamente respuestas en voz usando OpenAI TTS (Text-to-Speech), decidiendo inteligentemente cuándo usar voz basándose en el contexto de la conversación.

### Implementación Completada

#### 1. Cambios en el Código

**Archivo: `src/app-unified.ts`**
- Modificada función `sendWhatsAppMessage()` para incluir lógica de decisión de voz
- Implementada generación de audio con OpenAI TTS
- Conversión y envío de audio como nota de voz via WHAPI
- Fallback automático a texto si falla el envío de voz

#### 2. Cómo Funciona

El bot decide usar voz cuando:
1. **Usuario envió voz** - Si `lastInputVoice = true`
2. **Mensaje largo** - Si supera `VOICE_THRESHOLD` caracteres
3. **Respuesta a transcripción** - Si el mensaje contiene emoji 🎤
4. **Factor aleatorio** - Probabilidad configurable para variedad

Proceso:
1. Evalúa criterios de decisión
2. Limpia el texto (emojis, caracteres especiales)
3. Genera audio con OpenAI TTS
4. Convierte a base64
5. Envía como nota de voz via WHAPI
6. Fallback a texto si hay error

### Configuración

Variables de entorno relevantes:
```env
ENABLE_VOICE_RESPONSES=false       # Toggle principal
TTS_VOICE=alloy                   # Voz a usar
VOICE_THRESHOLD=150               # Caracteres mínimos
VOICE_RANDOM_PROBABILITY=0.1      # 10% probabilidad aleatoria
```

Voces disponibles:
- **alloy** - Neutral, balanceada
- **echo** - Masculina, profunda
- **fable** - Británica, expresiva
- **onyx** - Masculina, grave
- **nova** - Femenina, cálida
- **shimmer** - Femenina, suave

### Activación

1. En tu archivo `.env`:
   ```env
   ENABLE_VOICE_RESPONSES=true
   TTS_VOICE=nova  # O tu preferida
   ```

2. Reinicia el bot

### Pruebas

#### Prueba Manual
1. **Test voz→voz**: Envía una nota de voz, deberías recibir respuesta en voz
2. **Test mensaje largo**: Envía mensaje > 150 caracteres
3. **Test mensaje corto**: Envía mensaje < 150 caracteres (respuesta en texto)

#### Script de Prueba
```bash
node scripts/test-voice-responses.js
```

Este script prueba:
- Entrada de voz → Respuesta de voz
- Mensaje largo → Respuesta de voz
- Mensaje corto → Respuesta de texto

### Logs y Monitoreo

Logs generados:
- `VOICE_RESPONSE_SENT` - Respuesta de voz enviada exitosamente
- `VOICE_SEND_ERROR` - Error enviando voz (fallback a texto)
- Console logs con emoji 🔊 para identificación visual

### Optimizaciones

- Limpieza automática de emojis y caracteres especiales
- Límite de 4096 caracteres para TTS
- Fallback robusto a texto si falla
- Flag `lastInputVoice` se limpia después de responder

### Criterios de Decisión

1. **Prioridad alta**: Usuario envió voz
2. **Prioridad media**: Mensaje largo o contiene 🎤
3. **Prioridad baja**: Factor aleatorio

### Casos de Uso

Ideal para:
- Respuestas a consultas por voz
- Mensajes largos o explicaciones detalladas
- Crear experiencia más conversacional
- Accesibilidad para usuarios con dificultades visuales

### Costos

- TTS-1: $0.015 por 1K caracteres
- Aproximadamente $0.05-0.15 por respuesta de voz típica
- Controlable via thresholds y probabilidad

### Troubleshooting

**Problema**: No se generan respuestas de voz
- Verifica `ENABLE_VOICE_RESPONSES=true`
- Confirma que OpenAI API key tenga acceso a TTS
- Revisa el threshold configurado

**Problema**: Voz suena robótica o poco natural
- Prueba diferentes voces (nova, alloy, echo)
- Ajusta la velocidad si es necesario

**Problema**: Demasiadas respuestas de voz
- Aumenta `VOICE_THRESHOLD` (ej: 200-300)
- Reduce `VOICE_RANDOM_PROBABILITY` (ej: 0.05)

**Problema**: Error al enviar audio
- Verifica límites de WHAPI para audio
- Revisa que el formato base64 sea correcto