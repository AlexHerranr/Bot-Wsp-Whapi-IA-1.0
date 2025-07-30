# 6. Procesamiento Principal y Flujos de OpenAI con Webhooks

> **Introducción**: Esta sección detalla el núcleo operativo del bot. Cubre desde la recepción inicial de un webhook hasta la entrega de una respuesta final al usuario. Se explican los flujos de agrupación de mensajes, el manejo de concurrencia mediante locks, la orquestación de la lógica con la API de OpenAI (incluyendo `function calling` y manejo de media), y los flujos especiales para garantizar una interacción robusta y coherente.

## Ubicación en el Código
* **Recepción y Lógica de Webhooks**: `setupEndpoints()` y `processWebhook()` (líneas `~3000-3500` y `~2000-2500`).
* **Lógica de Buffering y Timers**: `addToGlobalBuffer()`, `setIntelligentTimer()`, `processGlobalBuffer()` (definidas en la sección de utilidades, `~1000-1200`).
* **Núcleo de OpenAI**: `processCombinedMessage` y `processWithOpenAI()` (anidadas dentro de `setupWebhooks`, `~2500-3000`).
* **Manejo de Media**: `transcribeAudio()` y `analyzeImage()` (sección de utilidades, `~600-900`).

## 1. Recepción y Procesamiento Inicial del Webhook

El flujo comienza cuando Whapi Cloud envía una petición `POST` al endpoint `/hook`.

### Endpoint `/hook`
* **Respuesta Inmediata**: El servidor responde con un `status 200` de forma inmediata. Esto es crítico para evitar que Whapi considere la entrega como fallida por timeout. El procesamiento real ocurre de forma asíncrona.

```typescript
app.post('/hook', async (req: Request, res: Response) => {
    res.status(200).json({ received: true, timestamp: new Date().toISOString() });
    
    // Procesamiento asíncrono sin bloquear respuesta
    setImmediate(() => {
        processWebhook(req.body).catch(error => {
            terminalLog.error(`Webhook processing failed: ${error.message}`);
        });
    });
});
```

### Función `processWebhook`
Esta función es el controlador principal que discrimina el tipo de evento recibido:

#### Eventos de Presencia (`presences`)
* Si un usuario está `typing` o `recording`, se actualiza su estado en `globalUserStates`
* Se llama a `setIntelligentTimer` con un delay extendido de **10 segundos** para darle tiempo a terminar de escribir o grabar
* Los logs en la terminal (`✍️...`, `🎙️...`) están limitados a uno cada 5 segundos para no saturar la consola
* Se limpia `isCurrentlyRecording` cuando el usuario va `online` o `offline`

#### Eventos de Mensajes (`messages`)
Se itera sobre cada mensaje para dirigirlo al flujo correspondiente según su tipo.

### Tabla de Manejo por Tipo de Mensaje
| Tipo | Lógica de Procesamiento | Funciones Clave | Notas Adicionales |
|------|--------------------------|------------------|-------------------|
| **Texto** | El mensaje se agrega al `globalMessageBuffers` precedido por "📝". | `addToGlobalBuffer` | Se establece `lastInputVoice = false` en el `UserState`. |
| **Voz/Audio** | Si `ENABLE_VOICE_TRANSCRIPTION` es `true`, el audio se transcribe usando `transcribeAudio`. El texto resultante se agrega al buffer como "🎤 [transcripción]". | `transcribeAudio` | Establece `lastInputVoice = true` para permitir respuestas de voz. Utiliza un archivo temporal en `/tmp/` que se elimina post-procesamiento. |
| **Imagen** | Se invoca `analyzeImage` para obtener una descripción contextual usando `gpt-4o-mini`. La URL original de la imagen se almacena en `pendingImages` para ser usada como contenido multimodal. | `analyzeImage`, `pendingImages.push` | La descripción de la imagen y un placeholder "📷" se agregan al buffer. |
| **Manual (`from_me`)** | Si el mensaje no proviene del bot (no está en `botSentMessages`), se trata como una intervención de un agente. Se agrupa en un buffer especial (usando el `chatId` como clave) y, tras 5 segundos, se sincroniza con el thread de OpenAI. | `threads.messages.create` (roles `user` y `assistant`) | Es vital para que la IA sepa lo que los agentes humanos han comunicado. |

## 2. Agrupación Inteligente y Procesamiento de Buffers

Para que la conversación sea natural y no interrumpir al usuario, los mensajes se agrupan antes de ser procesados.

### Sistema de Buffering
* **`globalMessageBuffers`**: Un `Map` que almacena los mensajes entrantes por `userId`
* **Límite de Buffer**: Máximo 50 mensajes por usuario para evitar memory leaks
* **Flujo de Datos**: `Webhook` → `processWebhook` → `addToGlobalBuffer` → `setIntelligentTimer` → (expira) → `processGlobalBuffer`

### `setIntelligentTimer` - Gestión de Tiempo de Espera
Esta función gestiona el tiempo de espera inteligente basado en el tipo de actividad:

* **5 segundos** para mensajes de texto e imágenes (`BUFFER_WINDOW_MS`)
* **8-10 segundos** para mensajes de voz (más tiempo de procesamiento)
* **10 segundos** si el usuario está escribiendo o grabando (`TYPING_EXTENDED_MS`)

**Lógica de Timer**:
```typescript
function setIntelligentTimer(userId: string, chatId: string, userName: string, triggerType: 'message' | 'voice' | 'typing' | 'recording'): void {
    const delays = {
        'message': 5000,
        'voice': 8000,
        'typing': 10000,
        'recording': 10000
    };
    
    const newDelay = delays[triggerType];
    const buffer = globalMessageBuffers.get(userId);
    
    // Solo establece/extiende si el nuevo delay es mayor al actual
    if (!buffer?.timer || newDelay > buffer.currentDelay) {
        if (buffer?.timer) clearTimeout(buffer.timer);
        
        buffer.timer = setTimeout(() => processGlobalBuffer(userId), newDelay);
        buffer.currentDelay = newDelay;
    }
}
```

### `processGlobalBuffer` - Consolidación de Mensajes
Cuando el timer expira, esta función:

1. **Verifica typing reciente**: Si hay solo 1 mensaje y el usuario escribió hace <10s, retrasa el procesamiento
2. **Previene concurrencia**: Usa `activeProcessing` Map para evitar procesamiento simultáneo
3. **Consolida mensajes**: Combina todos los mensajes del buffer en un solo texto (separados por `\n`)
4. **Pasa control**: Llama a `processCombinedMessage` con el mensaje consolidado

## 3. Gestión de Concurrencia con Locks y Colas

Para evitar procesar múltiples mensajes de un mismo usuario simultáneamente (race conditions), se utiliza un sistema de locks y colas.

### `processCombinedMessage` - Puerta de Entrada al Lock Manager
Esta función actúa como intermediario crítico:

**Responsabilidades principales**:
1. **Verificación de Run Activo**: Usa `isRunActive()` con `cleanupOldRuns()` para verificar si hay un run de OpenAI en progreso
2. **Retry Logic**: Si hay un run activo, reintenta hasta 3 veces con delay de 1 segundo, cancelando runs en `requires_action` si es necesario
3. **Encolado**: En lugar de ejecutar la lógica de OpenAI directamente, encola la tarea usando `simpleLockManager.addToQueue`

```typescript
async function processCombinedMessage(userMsg: string, userJid: string, chatId: string, userName: string): Promise<void> {
    // 1. Verificar y limpiar runs activos
    if (isRunActive) {
        for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const run = await openaiClient.beta.threads.runs.retrieve(threadId, runId);
            if (run.status === 'requires_action') {
                await cancelRun(threadId, runId);
                break;
            }
            if (run.status !== 'in_progress') break;
        }
    }
    
    // 2. Encolar para procesamiento secuencial
    await simpleLockManager.addToQueue(userJid, async () => {
        await processFunction(userMsg, userJid, chatId, userName);
    });
}
```

### `simpleLockManager` - Garantía de Procesamiento Secuencial
* **FIFO Queue**: Procesa las tareas en orden de llegada por usuario
* **Un Lock por Usuario**: Permite concurrencia entre diferentes usuarios pero serializa para cada usuario individual
* **Prevención de Race Conditions**: Evita que múltiples requests del mismo usuario interfieran entre sí

## 4. Orquestación Principal con OpenAI (`processWithOpenAI`)

Esta es la función más compleja, donde ocurre la interacción con la API de OpenAI. Se ejecuta secuencialmente gracias al `simpleLockManager`.

### Flujo de Procesamiento Paso a Paso

#### 1. Inicio y Tracing
```typescript
const traceId = startRequestTracing(userJid, chatId);
updateRequestStage(traceId, 'init');
```

#### 2. Contexto Temporal con `getRelevantContext`
Se determina si es necesario inyectar contexto. Las condiciones son:
* Han pasado más de **3 horas** desde la última interacción
* El nombre del contacto o sus etiquetas han cambiado
* Es el primer mensaje de la conversación

**Cuando se detecta cambio**:
```typescript
if (needsContext) {
    invalidateUserCaches(userJid); // Fuerza recarga de datos
    const contextualMessage = await getRelevantContext(userMsg, userJid, chatId);
    // Usa getPrecomputedContextBase cache TTL 1min para fecha/hora
}
```

#### 3. Gestión de Threads y Presencias
```typescript
// Obtener o crear thread
const threadId = await getOrCreateThread(userJid);

// Suscribirse a presencias (solo si no está ya suscrito)
if (!subscribedPresences.has(userJid)) {
    await subscribeToPresence(userJid);
    subscribedPresences.add(userJid);
}

// Limpiar runs antiguos si es thread nuevo
if (isNewThread) {
    await cleanupOldRuns(threadId);
}
```

#### 4. Creación de Mensaje Multimodal
El mensaje del usuario, el contexto temporal y las URLs de imágenes pendientes se combinan:

```typescript
const messageContent = [];

// Texto principal
messageContent.push({
    type: 'text',
    text: contextualMessage || userMsg
});

// Imágenes pendientes (multimodal)
if (pendingImages.length > 0) {
    pendingImages.forEach(imageUrl => {
        messageContent.push({
            type: 'image_url',
            image_url: { url: imageUrl, detail: 'low' }
        });
    });
    pendingImages.length = 0; // Limpiar después de usar
}

await openaiClient.beta.threads.messages.create(threadId, {
    role: 'user',
    content: messageContent
});
```

#### 5. Creación y Polling del Run
```typescript
const run = await openaiClient.beta.threads.runs.create(threadId, {
    assistant_id: ASSISTANT_ID
});

// Polling con manejo de race conditions
let attempts = 0;
while (attempts < 30) {
    try {
        const currentRun = await openaiClient.beta.threads.runs.retrieve(threadId, run.id);
        
        if (currentRun.status === 'completed') {
            // Procesar respuesta final
            break;
        } else if (currentRun.status === 'requires_action') {
            // Manejar function calling
            await handleRequiresAction(threadId, run.id, currentRun);
            break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    } catch (error) {
        // Backoff exponencial en race conditions
        const delay = Math.min((attempts + 1) * 1000, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}
```

#### 6. Manejo de `requires_action` (Function Calling)
Cuando el run requiere ejecutar funciones, la lógica se maneja **inline**:

```typescript
if (run.status === 'requires_action') {
    const toolOutputs = [];
    
    for (const toolCall of run.required_action.submit_tool_outputs.tool_calls) {
        // Importación dinámica del registry
        const { executeFunction } = await import('./functions/registry/function-registry.js');
        
        // Tracing de la llamada
        registerToolCall(toolCall.function.name, toolCall.id);
        updateToolCallStatus(toolCall.id, 'executing');
        
        // Log visual en terminal
        terminalLog.functionStart(`⚙️ ${toolCall.function.name}(${JSON.stringify(JSON.parse(toolCall.function.arguments))})`);
        
        try {
            const result = await executeFunction(toolCall.function.name, JSON.parse(toolCall.function.arguments));
            updateToolCallStatus(toolCall.id, 'success');
            
            toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(result)
            });
            
            terminalLog.functionSuccess(`✅ ${toolCall.function.name} completed`);
        } catch (error) {
            updateToolCallStatus(toolCall.id, 'error');
            toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ error: error.message })
            });
            
            terminalLog.functionError(`❌ ${toolCall.function.name} failed: ${error.message}`);
        }
    }
    
    // Enviar resultados y continuar polling
    await openaiClient.beta.threads.runs.submitToolOutputs(threadId, run.id, {
        tool_outputs: toolOutputs
    });
    
    // Polling post-tool con backoff (máx. 10 intentos)
    await pollPostToolExecution(threadId, run.id);
}
```

#### 7. Procesamiento de Respuesta Final
```typescript
if (run.status === 'completed') {
    const messages = await openaiClient.beta.threads.messages.list(threadId, { limit: 1 });
    const response = messages.data[0].content[0].text.value;
    
    // Validación y corrección
    const { correctedResponse, needsRetry } = await validateAndCorrectResponse(response, toolOutputs);
    
    if (needsRetry && canRetry(userJid)) {
        // Retry con correctiveMessage
        await retryWithCorrection(threadId, correctedResponse);
    } else {
        // Enviar respuesta final
        await sendWhatsAppMessage(chatId, correctedResponse);
    }
}
```

## 5. Análisis de Imágenes con `analyzeImage`

Una funcionalidad robusta que utiliza `gpt-4o-mini` para analizar imágenes en contexto hotelero:

```typescript
async function analyzeImage(imageUrl: string, userJid: string): Promise<string> {
    try {
        // Si no hay URL, obtener del endpoint de Whapi
        if (!imageUrl) {
            const mediaResponse = await fetch(`${WHAPI_BASE_URL}/messages/${messageId}`, {
                headers: { 'Authorization': `Bearer ${WHAPI_TOKEN}` }
            });
            imageUrl = mediaResponse.data.media_url;
        }
        
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: [
                    { 
                        type: 'text', 
                        text: 'Analiza esta imagen en contexto hotelero. Describe qué ves de manera concisa y útil para un asistente de hotel. Máximo 100 palabras.' 
                    },
                    { 
                        type: 'image_url', 
                        image_url: { url: imageUrl, detail: 'low' } 
                    }
                ]
            }],
            max_tokens: 150,
            temperature: 0.3
        });
        
        const analysis = response.choices[0].message.content;
        terminalLog.success(`📷 Image analyzed: "${analysis.substring(0, 50)}..."`);
        
        return analysis;
    } catch (error) {
        terminalLog.imageError(getShortUserId(userJid), `Image analysis failed: ${error.message}`);
        return '[Error al analizar imagen]';
    }
}
```

**Uso en el flujo**:
1. La URL se guarda en `pendingImages` para contenido multimodal
2. Se obtiene una descripción textual que se agrega al buffer con "📷"
3. Ambos (descripción + URL original) se envían a OpenAI para contexto completo

## 6. Envío y Validación de Respuestas

### `validateAndCorrectResponse` - Control de Calidad
Compara la respuesta de la IA con los datos crudos de las `tool outputs` usando la distancia de Levenshtein:

```typescript
async function validateAndCorrectResponse(response: string, originalOutputs?: string): Promise<{ correctedResponse: string, needsRetry: boolean }> {
    if (!originalOutputs) return { correctedResponse: response, needsRetry: false };
    
    // Calcular distancia de Levenshtein
    const distance = levenshtein(response, originalOutputs);
    const similarity = 1 - (distance / Math.max(response.length, originalOutputs.length));
    
    // Si la similitud es muy baja, posible alucinación
    const needsRetry = similarity < 0.3 && userRetryState.get(userJid)?.canRetry();
    
    return {
        correctedResponse: response,
        needsRetry
    };
}
```

**Control de Reintentos**:
- Máximo 1 reintento cada 5 minutos por usuario (`userRetryState`)
- Si se detecta error, se formula un `correctiveMessage` interno
- Se ejecuta un nuevo run con el mensaje correctivo

### `sendWhatsAppMessage` - Entrega Final
```typescript
async function sendWhatsAppMessage(chatId: string, message: string): Promise<boolean> {
    const userState = getOrCreateUserState(extractUserFromChat(chatId));
    
    // Determinar si usar voz
    const shouldUseVoice = ENABLE_VOICE_RESPONSES && 
                          userState.lastInputVoice && 
                          !isQuoteOrPriceMessage(message);
    
    if (shouldUseVoice) {
        try {
            // TTS con voz nova
            const audioResponse = await openai.audio.speech.create({
                model: 'tts-1',
                voice: 'nova',
                input: message.substring(0, 4000) // Límite de caracteres
            });
            
            const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
            const audioBase64 = audioBuffer.toString('base64');
            
            await whapiClient.sendVoiceMessage(chatId, audioBase64);
            userState.lastInputVoice = false; // Reset flag
            
            terminalLog.response(getShortUserId(userState.userJid), `🔊 Voice: "${message.substring(0, 50)}..."`);
            return true;
        } catch (error) {
            terminalLog.warning(`Voice TTS failed, falling back to text: ${error.message}`);
            // Continuar con envío de texto
        }
    }
    
    // Envío de texto con división inteligente
    const chunks = splitMessageIntelligently(message);
    
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const typingTime = i === 0 ? 3000 : 2000; // Primer chunk más tiempo
        
        await whapiClient.sendTextMessage(chatId, chunk, { typing_time: typingTime });
        
        // Registrar para evitar self-loops
        const messageId = `msg_${Date.now()}_${i}`;
        botSentMessages.set(messageId, true);
        setTimeout(() => botSentMessages.delete(messageId), 10 * 60 * 1000); // TTL 10min
    }
    
    terminalLog.response(getShortUserId(userState.userJid), message);
    return true;
}
```

**División Inteligente de Mensajes**:
```typescript
function splitMessageIntelligently(message: string): string[] {
    // Dividir por párrafos dobles
    let chunks = message.split('\n\n').filter(chunk => chunk.trim());
    
    // Si hay listas, dividir también por elementos de lista
    chunks = chunks.flatMap(chunk => {
        if (chunk.includes(':') && /[•\-\*]/.test(chunk)) {
            return chunk.split(/(?=\n[•\-\*])/);
        }
        return [chunk];
    });
    
    return chunks.map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
}
```

## 7. Terminal Log - Feedback Visual para Desarrolladores

El `terminalLog` es el mecanismo principal de feedback visual en la consola, mostrando de forma limpia y formateada el flujo de la conversación:

### Tipos de Logs Principales
```typescript
// Mensajes de usuario
terminalLog.message(userId, "📝 Hola, ¿hay disponibilidad para mañana?");

// Estados de presencia
terminalLog.typing(userId, "✍️ Usuario escribiendo...");
terminalLog.recording(userId, "🎙️ Usuario grabando...");

// Function calling
terminalLog.functionStart("⚙️ check_availability({checkin: '2025-01-15', checkout: '2025-01-16'})");
terminalLog.functionSuccess("✅ check_availability completed - 3 rooms available");
terminalLog.functionError("❌ check_availability failed: API timeout");

// Respuestas del asistente
terminalLog.response(userId, "🏠 Excelente, tenemos 3 habitaciones disponibles para esas fechas...", 1250);

// Errores y warnings
terminalLog.error("❌ OpenAI API error: Rate limit exceeded");
terminalLog.warning("⚠️ Voice TTS failed, falling back to text");

// Éxitos del sistema
terminalLog.success("✅ MANUAL_SYNC_SUCCESS - Agent message synchronized");
```

### Rate Limiting de Logs
Para evitar spam en la consola:
- **Typing/Recording logs**: Máximo uno cada 5 segundos por usuario
- **Webhook inválidos**: Máximo uno cada minuto usando `webhookCounts` Map
- **Errores repetitivos**: Debouncing automático para errores similares

## 8. Impacto de Flujos de Inicio y Apagado

### Al Iniciar (`initializeBot`)
```typescript
async function initializeBot(): Promise<void> {
    // Recovery de runs huérfanos (background task)
    setTimeout(async () => {
        await recoverOrphanedRuns();
    }, 5000);
    
    // Cleanup intervals
    setInterval(cleanupExpiredCaches, 10 * 60 * 1000); // 10min
    setInterval(logMemoryUsage, 5 * 60 * 1000); // 5min - alert >300MB
    setInterval(cleanupUserStates, 60 * 60 * 1000); // 1h - >24h inactive
    setInterval(cleanupGlobalBuffers, 10 * 60 * 1000); // 10min - >15min inactive
}

async function recoverOrphanedRuns(): Promise<void> {
    const threads = threadPersistence.getAllThreadsInfo();
    let cancelledCount = 0;
    
    for (const [userJid, threadInfo] of threads) {
        const runs = await openaiClient.beta.threads.runs.list(threadInfo.threadId, { limit: 10 });
        
        for (const run of runs.data) {
            if (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
                await openaiClient.beta.threads.runs.cancel(threadInfo.threadId, run.id);
                const ageMinutes = (Date.now() - run.created_at * 1000) / (60 * 1000);
                
                terminalLog.warning(`🧹 ORPHANED_RUN_CANCELLED: ${run.id} (${ageMinutes.toFixed(1)}min old)`);
                cancelledCount++;
            }
        }
    }
    
    if (cancelledCount > 0) {
        terminalLog.success(`✅ Recovery complete: ${cancelledCount} orphaned runs cancelled`);
    }
}
```

### Al Apagar (`setupSignalHandlers`)
```typescript
function setupSignalHandlers(): void {
    const gracefulShutdown = (signal: string) => {
        terminalLog.info(`📤 ${signal} received, initiating graceful shutdown...`);
        
        // Limpiar todos los timers de buffers
        let timersCleaned = 0;
        for (const [userId, buffer] of globalMessageBuffers.entries()) {
            if (buffer.timer) {
                clearTimeout(buffer.timer);
                timersCleaned++;
            }
        }
        
        terminalLog.info(`🧹 Cleared ${timersCleaned} pending buffer timers`);
        
        // Cerrar servidor con timeout
        server.close(() => {
            terminalLog.success('✅ Server shutdown complete');
            process.exit(0);
        });
        
        // Forzar salida si no se cierra en 5s
        setTimeout(() => {
            terminalLog.error('❌ Forced shutdown due to timeout');
            process.exit(1);
        }, 5000);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Manejo de errores no capturados
    process.on('uncaughtException', (error, origin) => {
        terminalLog.fatal(`💀 UNCAUGHT EXCEPTION [${origin}]: ${error.message}\nStack: ${error.stack}`);
        setTimeout(() => process.exit(1), 2000);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        terminalLog.fatal(`💀 UNHANDLED REJECTION at: ${promise}, reason: ${reason}`);
        setTimeout(() => process.exit(1), 2000);
    });
}
```

## 9. Métricas y Observabilidad

### Request Tracing Completo
```typescript
// Inicio del request
const traceId = startRequestTracing(userJid, chatId);

// Etapas del procesamiento
updateRequestStage(traceId, 'init');              // Buffer consolidado
updateRequestStage(traceId, 'processing');        // Entrando a processWithOpenAI
updateRequestStage(traceId, 'function_calling');  // Ejecutando tools
updateRequestStage(traceId, 'post_tools_completed'); // Tools completados
updateRequestStage(traceId, 'completed');         // Respuesta enviada

// Métricas específicas de OpenAI
logOpenAIUsage(
    run.usage.total_tokens,
    run.usage.prompt_tokens, 
    run.usage.completion_tokens,
    run.usage.completion_tokens_details?.reasoning_tokens || 0,
    run.usage.total_tokens / (duration / 1000) // tokensPerSecond
);

logOpenAILatency(duration, duration > 30000); // isHighLatency >30s

logPerformanceMetrics(
    duration,
    run.usage.total_tokens,
    response.length,
    duration < 10000 && run.usage.total_tokens < 2000, // isEfficient
    process.memoryUsage()
);

// Finalización
endRequestTracing(traceId, {
    duration: Date.now() - startTime,
    success: true,
    tokensUsed: run.usage.total_tokens,
    functionsCalled: toolCalls.length
});
```

## 10. Riesgos y Mitigaciones

### Race Conditions
**Problema**: Múltiples requests simultáneos del mismo usuario pueden causar conflictos.
**Mitigación**: 
- `simpleLockManager` garantiza procesamiento secuencial por usuario
- Backoff exponencial en `add message` (hasta 15 intentos)
- Backoff post-tool (hasta 10 intentos)

### Memory Leaks
**Problemas identificados**:
- `globalMessageBuffers` sin limpieza → **Mitigado**: Cleanup cada 10min para >15min inactivos
- `userRetryState` sin TTL → **Sugerencia**: Agregar cleanup cada 5min
- `botSentMessages` crecimiento → **Mitigado**: TTL automático de 10min por mensaje

### Acumulación de Archivos Temporales
**Problema**: `transcribeAudio` usa `fs.unlink().catch(() => {})` ignorando errores.
**Riesgo**: Acumulación en `/tmp/` si el unlink falla.
**Mitigación sugerida**:
```typescript
// Cleanup periódico de archivos temporales
setInterval(() => {
    const tmpDir = '/tmp';
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    fs.readdir(tmpDir, (err, files) => {
        if (err) return;
        
        files.filter(f => f.startsWith('audio_')).forEach(file => {
            const filePath = path.join(tmpDir, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && stats.mtime.getTime() < oneHourAgo) {
                    fs.unlink(filePath).catch(() => {});
                }
            });
        });
    });
}, 60 * 60 * 1000); // Cleanup cada hora
```

### Billing Risk - Orphaned Runs
**Problema**: Runs activos huérfanos facturan indefinidamente.
**Mitigación**: `recoverOrphanedRuns` cancela **todos** los runs activos al iniciar.
**Trade-off**: Se pierden runs legítimos en progreso, pero se evita facturación excesiva.

### Dependencia de Red para Obtener URLs de Media
**Problema**: Si la URL de un audio o imagen no viene directamente en el payload del webhook, las funciones `transcribeAudio` y `analyzeImage` deben realizar una llamada `fetch` adicional a la API de Whapi (`/messages/{id}`) para obtener la URL del medio.
**Riesgo**: Fallo de red o timeout puede interrumpir el procesamiento de media, causando respuestas incompletas.
**Mitigación actual**: Try/catch con fallback a mensajes de error (`[Error al analizar imagen]`, log `voiceError`).
**Sugerencia**: Implementar retry con backoff exponencial para llamadas a Whapi API.

## 11. Diagrama de Flujo de Datos Completo

```
📨 Webhook POST /hook
    ↓ [immediate 200 response]
🔄 processWebhook(body)
    ↓ [discriminate event type]
    
👁️ PRESENCES                           💬 MESSAGES
    ↓                                      ↓
Update lastTyping                      [type discrimination]
setIntelligentTimer(10s)                   ↓
terminalLog.typing (rate 5s)          TEXT │ VOICE │ IMAGE │ MANUAL
subscribedPresences.add                    │       │       │
                                          ↓       ↓       ↓       ↓
                                    addToGlobal transcribe analyzeImage buffer
                                    Buffer + 📝  Audio +🎤  gpt-4o-mini separate
                                          ↓       ↓    📷+desc    chatId
                                    setIntelligent   pendingImages  timer 5s
                                    Timer(5s)    Timer(8-10s)  .push    ↓
                                          ↓       ↓       ↓    threads.
                                          └───┬───┘       │    messages
                                              ↓           │    .create x2
                                        [timer expires]   │         ↓
                                              ↓           │    setThread
                                        processGlobal     │    metadata
                                        Buffer           │         ↓
                                              ↓           │    MANUAL_SYNC
                                        [check typing     │    _SUCCESS
                                         recent <10s]     │
                                              ↓           │
                                        [if !active      │
                                         Processing]     │
                                              ↓           │
                                        processCombined ←┘
                                        Message
                                              ↓
                                        [isRunActive?]
                                              ↓
                                        [retry 3x 1s if active]
                                              ↓
                                        simpleLockManager
                                        .addToQueue
                                              ↓
                                        🔒 [sequential per user]
                                              ↓
🤖 processWithOpenAI ←─────────────────────────┘
    ↓ [startRequestTracing]
    ↓ [updateStage: init]
    ↓
📋 getRelevantContext?
    ↓ [3h elapsed OR change name/labels OR first msg]
    ├─ YES → invalidateUserCaches + getPrecomputedContextBase(cache 1min)
    └─ NO → direct message
    ↓
🧵 get/create thread
    ↓ [threadPersistence]
📡 subscribeToPresence (if !subscribedPresences.has)
    ↓
🧹 cleanupOldRuns (if new thread)
    ↓
📝 create multimodal message
    ↓ [text + pendingImages, clear after]
▶️ create run
    ↓
🔄 polling loop (while attempts < 30, setTimeout 1000)
    ↓ [with backoff on race: min((attempt+1)*1000, 5000) max 15]
    ↓
STATUS CHECK:
├─ completed → get response → validateAndCorrectResponse
│                ↓ [levenshtein distance]
│                ├─ needsRetry + canRetry → correctiveMessage + retry run
│                └─ send final response
│
├─ requires_action → 🛠️ FUNCTION CALLING
│    ↓ [inline handling, no separate function]
│    ├─ import('./functions/registry/function-registry.js')
│    ├─ registerToolCall + updateToolCallStatus('executing')
│    ├─ terminalLog.functionStart('⚙️ function_name(...)')
│    ├─ executeFunction(name, args)
│    ├─ updateToolCallStatus('success'/'error')
│    ├─ terminalLog.functionSuccess/Error
│    ├─ submitToolOutputs
│    └─ polling post-tool: min((postAttempts+1)*500, 5000) max 10
│                ↓
│            get final response
│
└─ failed/timeout → log error
                    ↓
📤 sendWhatsAppMessage
    ↓ [shouldUseVoice check]
    ├─ VOICE → TTS nova mp3 base64 → /messages/voice → clear lastInputVoice
    │           ↓ [fallback on error]
    └─ TEXT → split chunks (\n\n or lists) → typing_time → /messages/text
                ↓
            botSentMessages.set(id, TTL 10min)
                ↓
            terminalLog.response
                ↓
🏁 endRequestTracing(summary)

[BOOT IMPACT] recoverOrphanedRuns (5s delay) → cancel ALL active runs → log ORPHANED_CANCELLED
[SHUTDOWN IMPACT] clear all buffer timers → server.close(5s timeout) → exit(0/1)
```

## 12. Preparación para Modularización

### Separación Sugerida por Módulos

#### `webhook.ts` - Manejo de Webhooks
- `processWebhook()`
- `handlePresenceEvents()`
- `handleMessageEvents()`
- Validación y filtrado de webhooks

#### `bufferManager.ts` - Gestión de Agrupación
- `addToGlobalBuffer()`
- `setIntelligentTimer()`
- `processGlobalBuffer()`
- Cleanup de buffers inactivos

#### `lockManager.ts` - Control de Concurrencia
- `simpleLockManager`
- `processCombinedMessage()`
- Queue management por usuario

#### `openaiOrchestrator.ts` - Lógica de OpenAI
- `processWithOpenAI()`
- Function calling inline
- Polling y retry logic
- Context injection

#### `mediaProcessor.ts` - Manejo de Media
- `transcribeAudio()`
- `analyzeImage()`
- Gestión de archivos temporales

#### `responseHandler.ts` - Envío de Respuestas
- `sendWhatsAppMessage()`
- `validateAndCorrectResponse()`
- Voice TTS y text splitting

### Interfaces de Comunicación
```typescript
// Eventos entre módulos
interface WebhookEvent {
    type: 'message' | 'presence';
    userId: string;
    chatId: string;
    data: any;
}

interface ProcessingRequest {
    userMessage: string;
    userId: string;
    chatId: string;
    context?: any;
    images?: string[];
}

interface OpenAIResponse {
    success: boolean;
    response?: string;
    error?: string;
    tokensUsed: number;
    duration: number;
}
```

Esta estructura modular facilitará:
- **Testing independiente** de cada componente
- **Escalabilidad horizontal** (diferentes instancias para diferentes módulos)
- **Mantenimiento focalizado** (cambios en OpenAI no afectan webhook handling)
- **Reusabilidad** (el bufferManager puede usarse para otros tipos de eventos)

---

La sección 6 representa el corazón del sistema, donde convergen todas las tecnologías y se orquesta la experiencia del usuario final. Su complejidad refleja la sofisticación necesaria para manejar conversaciones naturales, multimodales y con function calling en un entorno de producción robusto.