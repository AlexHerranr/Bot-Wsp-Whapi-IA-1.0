# 📋 Configuración Manual para Migración a Responses API

## 🚀 Pasos para Activar la Nueva Versión con Responses API

### 1. Variables de Entorno en Railway

**Agrega estas nuevas variables:**

```bash
# 🔴 IMPORTANTE: Tu Prompt ID del dashboard de OpenAI
OPENAI_PROMPT_ID=pmpt_68b7dbd8b694819386644f198b2165880410e06c7884ad66
OPENAI_PROMPT_VERSION=1

# Configuración del modelo
OPENAI_MODEL=gpt-5-mini-2025-08-07

# Usar Conversations API para mantener contexto
USE_CONVERSATIONS_API=true

# Tokens máximos de salida (opcional - por defecto 4096)
MAX_OUTPUT_TOKENS=4096

# Temperatura (opcional - por defecto 0.7, no funciona con GPT-5)
# TEMPERATURE=0.7
```

**Nota:** Si NO configurar `OPENAI_PROMPT_ID`, el sistema usará instrucciones inline con la variable `SYSTEM_INSTRUCTIONS`.

**Variables que se mantienen igual:**
- `OPENAI_API_KEY` - Tu API key actual
- `WHAPI_TOKEN` - Token de WhatsApp
- `BEDS24_TOKEN` - Token de Beds24
- Todas las demás variables existentes

### 2. Base de Datos - Ejecutar Migración

En Railway, ejecuta este comando en la consola:

```bash
psql $DATABASE_URL -f prisma/migrations/add_responses_api_tables.sql
```

O si prefieres hacerlo manualmente, ejecuta este SQL en tu base de datos:

```sql
-- Crear tabla de conversaciones
CREATE TABLE IF NOT EXISTS Conversations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    last_response_id VARCHAR(255),
    message_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, chat_id)
);

-- Crear índices
CREATE INDEX idx_conversations_user_chat ON Conversations(user_id, chat_id);
CREATE INDEX idx_conversations_last_activity ON Conversations(last_activity);
CREATE INDEX idx_conversations_response_id ON Conversations(last_response_id);

-- Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS ConversationMessages (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    response_id VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Crear índices para mensajes
CREATE INDEX idx_messages_user_chat ON ConversationMessages(user_id, chat_id);
CREATE INDEX idx_messages_response_id ON ConversationMessages(response_id);
CREATE INDEX idx_messages_timestamp ON ConversationMessages(timestamp);
```

### 3. Cambiar el Script de Inicio en Railway

En la configuración de Railway, cambia el comando de inicio:

**Antes (Assistants API):**
```bash
npm start
```

**Después (Responses API):**

Tienes dos opciones:

**Opción 1: Usar comando personalizado en Railway (Recomendado)**
```bash
node dist/main-responses.js
```
En Railway: Settings > Deploy > Start Command

**Opción 2: Modificar package.json (Permanente)**
Cambia el script `start` en tu package.json:
```json
{
  "scripts": {
    "start": "node dist/main-responses.js"
  }
}
```

### 4. Configuración en OpenAI Dashboard

**Ya configuraste el prompt en el dashboard** ✅

El prompt ID que obtuviste (`pmpt_68b77888dee08196b8eda3b7dd55710c010ad598dbee3811`) se usa en la variable de entorno `OPENAI_PROMPT_ID`.

Si necesitas actualizar el prompt:
1. Ve al dashboard de OpenAI
2. Edita tu prompt
3. Publica una nueva versión
4. Actualiza `OPENAI_PROMPT_VERSION` en Railway si cambió

### 5. Verificar el Despliegue

Una vez desplegado, verifica:

1. **Health Check:**
   ```bash
   curl https://tu-app.up.railway.app/health
   ```
   
   Deberías ver:
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-...",
     "version": "responses-api-v1"
   }
   ```

2. **Stats:**
   ```bash
   curl https://tu-app.up.railway.app/stats
   ```

### 6. Migración de Base de Datos

**IMPORTANTE:** La nueva versión requiere tablas adicionales para gestionar conversaciones:

```sql
-- Crear tabla de conversaciones
CREATE TABLE IF NOT EXISTS Conversations (
    user_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255),
    last_response_id VARCHAR(255),
    message_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    PRIMARY KEY (user_id, chat_id)
);

-- Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS ConversationMessages (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    response_id VARCHAR(255),
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversation_messages (user_id, chat_id, timestamp)
);
```

### 7. Rollback (Si es Necesario)

Para volver a la versión anterior con Assistants API:

1. Cambia el comando de inicio de vuelta a:
   ```bash
   npm start
   ```

2. Las tablas nuevas no afectan la versión anterior, no necesitas eliminarlas.

## 🔧 Configuración Adicional (Opcional)

### Personalizar las Instrucciones del Sistema

Si quieres cambiar el prompt del asistente sin tocar el código:

1. En Railway, agrega la variable:
   ```
   SYSTEM_INSTRUCTIONS="Eres un asistente de reservas para TeAlquilamos. [Tu prompt completo aquí]"
   ```

### Ajustar Límites de Conversación

Para cambiar cuándo se resetean las conversaciones por tokens:

1. Busca `MAX_TOKEN_COUNT` en el código (por defecto 100,000)
2. Ajusta según tus necesidades

### Monitoreo

La nueva versión incluye logs mejorados:
- `RESPONSE_API_START` - Inicio de llamada
- `RESPONSE_API_SUCCESS` - Respuesta exitosa
- `CONVERSATION_CREATED` - Nueva conversación
- `CONVERSATION_RESET` - Reset por límite de tokens

## ⚠️ Consideraciones Importantes

1. **Primera Ejecución**: Las conversaciones existentes no se migran. Los usuarios comenzarán con conversaciones nuevas.

2. **Funciones**: Todas las funciones del hotel plugin funcionan igual que antes.

3. **Performance**: La Responses API es generalmente más rápida porque no requiere polling.

4. **Costos**: Los costos son similares a Assistants API, pero puedes tener mejor control del contexto.

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs en Railway
2. Verifica que las tablas se crearon correctamente
3. Confirma que todas las variables de entorno están configuradas

## ✅ Checklist de Migración

- [ ] Variables de entorno configuradas (solo las nuevas opcionales)
- [ ] Migración de base de datos ejecutada
- [ ] Comando de inicio actualizado a `node dist/main-responses.js`
- [ ] Deploy realizado en Railway
- [ ] Health check verificado
- [ ] Prueba de mensaje enviada

## 🚀 Ventajas de la Nueva Versión

1. **GPT-5 Mini**: Modelo más avanzado y capaz
2. **Mejor rendimiento**: Respuestas más rápidas
3. **Imágenes nativas**: GPT-5 procesa imágenes directamente sin servicios intermedios
4. **Prompt Caching**: Hasta 80% menos latencia y 75% menos costo automáticamente
5. **Conversations API**: Contexto persistente entre sesiones
6. **Sin threads huérfanos**: Gestión más confiable del estado
7. **Logs mejorados**: Tracking detallado de tokens y conversaciones