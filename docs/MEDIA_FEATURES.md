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