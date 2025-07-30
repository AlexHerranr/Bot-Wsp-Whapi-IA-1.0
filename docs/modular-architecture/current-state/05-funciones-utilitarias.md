# 5. Funciones Utilitarias y Auxiliares

> **Introducción**: Este documento examina las funciones utilitarias del sistema monolítico, que constituyen ~50 funciones auxiliares distribuidas en ~2100 líneas de código. Basado en el CURRENT_STATE.md, documenta helpers básicos (`getTimestamp`, `getShortUserId`, `cleanContactName`, `isQuoteOrPriceMessage`), gestión de estados y caches (`getOrCreateUserState`, `invalidateUserCaches`, `getPrecomputedContextBase`, `getRelevantContext`, `getCachedChatInfo`), manejo de media (`transcribeAudio`, `analyzeImage`, `sendTypingIndicator`, `sendRecordingIndicator`, `subscribeToPresence`), sistema de locks (`acquireUserLock`, `releaseUserLock`), buffering inteligente (`addToGlobalBuffer`, `setIntelligentTimer`, `processGlobalBuffer`), envío de mensajes (`sendWhatsAppMessage` con split/fallback), utilities OpenAI (`isRunActive`, `cleanupOldRuns`, `recoverOrphanedRuns`), y tracing requests (`startRequestTracing`, `updateRequestStage`, `registerToolCall`, `updateToolCallStatus`, `endRequestTracing`). Identifica problemas como memory leaks en `/tmp` (acumulación archivos temporales), race conditions en timers, falta de retry en fetch, hardcoded TTLs/regex, y errors inconsistentes, proporcionando recomendaciones para migración modular.

## Ubicación en el Código
**Líneas**: ~400-2500 del archivo `app-unified.ts`

## Helpers Básicos

### 1. Helpers Básicos

| Función | Descripción | Uso Principal |
|---------|-------------|---------------|
| `getTimestamp()` | Timestamp ISO format | Logs y estado de usuario |
| `getShortUserId(jid)` | Extrae número de JID WhatsApp | Logs y identificación |
| `cleanContactName(rawName)` | Limpia y valida nombres de contactos | Normalización segura |
| `isQuoteOrPriceMessage(message)` | Detecta mensajes sensibles (precios/enlaces) | Fallback voice a texto |

```typescript
function getTimestamp(): string {
    return new Date().toISOString();
}

function getShortUserId(jid: string): string {
    return jid.split('@')[0] || jid;
}

function cleanContactName(rawName: any): string {
    if (!rawName || typeof rawName !== 'string') return 'Usuario';
    return rawName.trim()
        .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50) || 'Usuario';
}

function isQuoteOrPriceMessage(message: string): boolean {
    const patterns = [
        /\$\d+[.,]?\d*/g,                // Precios en dólares
        /\d+[.,]?\d*\s*(cop|pesos?)/gi,  // Precios en pesos
        /\d+\s*noches?/gi,               // Noches de hotel
        /https?:\/\/\S+/i,               // Enlaces HTTP
        /wa\.me\/p/i                     // Enlaces WhatsApp Business
    ];
    return patterns.some(p => p.test(message));
}
```

## Gestión de Estados y Caches

### 1. User State Management
```typescript
function getOrCreateUserState(userId: string, chatId?: string, userName?: string): UserState {
    let userState = globalUserStates.get(userId);
    if (!userState) {
        userState = {
            userId,
            isTyping: false,
            lastTypingTimestamp: 0,
            lastMessageTimestamp: 0,
            messages: [],
            chatId: chatId || `${userId}@s.whatsapp.net`,
            userName: userName || 'Usuario',
            typingEventsCount: 0,
            averageTypingDuration: 0,
            lastInputVoice: false,
            lastTyping: 0
        };
        globalUserStates.set(userId, userState);
    }
    return userState;
}

function invalidateUserCaches(userId: string): void {
    const shortUserId = getShortUserId(userId);
    if (chatInfoCache.has(userId)) {
        chatInfoCache.delete(userId);
    }
    if (contextCache.has(shortUserId)) {
        contextCache.delete(shortUserId);
    }
}
```

### 2. Cache Management
```typescript
async function getCachedChatInfo(userId: string): Promise<any> {
    const now = Date.now();
    const cached = chatInfoCache.get(userId);
    if (cached && (now - cached.timestamp) < CHAT_INFO_CACHE_TTL) {
        return cached.data;
    }
    try {
        const chatInfo = await whapiLabels.getChatInfo(userId);
        chatInfoCache.set(userId, { data: chatInfo, timestamp: now });
        return chatInfo;
    } catch (error) {
        return null;
    }
}

// TTL = 1 minuto para context base
let precomputedContextBase: { date: string; time: string; timestamp: number } | null = null;
const CONTEXT_BASE_CACHE_TTL = 60 * 1000;

function getPrecomputedContextBase(): { date: string; time: string } {
    const now = Date.now();
    if (precomputedContextBase && (now - precomputedContextBase.timestamp) < CONTEXT_BASE_CACHE_TTL) {
        return { date: precomputedContextBase.date, time: precomputedContextBase.time };
    }
    const currentDate = new Date().toLocaleDateString('es-ES', { 
        timeZone: 'America/Bogota', 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
    const currentTime = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/Bogota', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });
    precomputedContextBase = { date: currentDate, time: currentTime, timestamp: now };
    return { date: currentDate, time: currentTime };
}

// TTL = 3 horas o hasta cambios significativos
async function getRelevantContext(userId: string, requestId?: string): Promise<string> {
    const now = Date.now();
    const shortUserId = getShortUserId(userId);
    const cached = contextCache.get(shortUserId);
    if (cached && (now - cached.timestamp) < CONTEXT_CACHE_TTL) {
        return cached.context;
    }
    
    const profile = await guestMemory.getOrCreateProfile(userId);
    const chatInfo = await getCachedChatInfo(userId);
    const clientName = profile?.name || 'Cliente';
    const contactName = chatInfo?.name || clientName;
    const { date, time } = getPrecomputedContextBase();
    
    const allLabels = [...new Set([
        ...(profile?.whapiLabels?.map(l => l.name) || []),
        ...(chatInfo?.labels?.map(l => l.name) || [])
    ])].slice(0, 2);
    
    let context = `Fecha: ${date} | Hora: ${time} (Colombia)\n`;
    context += `Cliente: ${clientName} | Contacto WhatsApp: ${contactName}`;
    if (allLabels.length > 0) context += ` | Status: ${allLabels.join(', ')}`;
    context += `\n---\nMensaje del cliente:\n`;
    
    contextCache.set(shortUserId, { context, timestamp: now });
    return context;
}
```

## Media Handling

### 1. Audio Transcription
```typescript
async function transcribeAudio(audioUrl: string | undefined, userId: string, userName?: string, messageId?: string): Promise<string> {
    try {
        let finalAudioUrl = audioUrl;
        if (!finalAudioUrl && messageId) {
            const messageResponse = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/${messageId}`, {
                headers: { 'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}` }
            });
            if (messageResponse.ok) {
                const messageData = await messageResponse.json();
                finalAudioUrl = messageData.audio?.link || messageData.voice?.link || messageData.ptt?.link;
            }
        }
        if (!finalAudioUrl) throw new Error('No se pudo obtener la URL del audio');
        
        const audioResponse = await fetch(finalAudioUrl);
        if (!audioResponse.ok) throw new Error(`Error descargando audio: ${audioResponse.status}`);
        
        const audioBuffer = await audioResponse.arrayBuffer();
        const tempPath = path.join('tmp', `audio_${Date.now()}.ogg`);
        await fs.writeFile(tempPath, Buffer.from(audioBuffer));
        
        const transcription = await openaiClient.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: 'whisper-1',
            language: 'es'
        });
        
        await fs.unlink(tempPath).catch(() => {});
        return transcription.text || 'No se pudo transcribir el audio';
    } catch (error) {
        terminalLog.voiceError(userName || getShortUserId(userId), error.message);
        throw error; // Lanza el error en lugar de retornar un string
    }
}
```

### 2. Image Analysis
```typescript
async function analyzeImage(imageUrl: string | undefined, userId: string, userName?: string, messageId?: string): Promise<string> {
    try {
        let finalImageUrl = imageUrl;
        // Si no hay URL, intentar obtenerla desde WHAPI
        if (!finalImageUrl && messageId) {
            const messageResponse = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/${messageId}`, {
                headers: { 'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}` }
            });
            if (messageResponse.ok) {
                const messageData = await messageResponse.json();
                finalImageUrl = messageData.image?.link || messageData.document?.link;
            }
        }
        if (!finalImageUrl || !finalImageUrl.startsWith('http')) {
            throw new Error('URL de imagen inválida o no disponible');
        }
        
        const visionResponse = await openaiClient.chat.completions.create({
            model: process.env.IMAGE_ANALYSIS_MODEL || 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Analiza esta imagen en el contexto de un hotel. Describe lo que ves y si contiene texto, transcríbelo. Responde en español.' },
                    { type: 'image_url', image_url: { url: finalImageUrl, detail: 'low' }}
                ]
            }],
            max_tokens: 150,
            temperature: 0.3
        });
        
        return visionResponse.choices[0].message.content || 'Imagen recibida';
    } catch (error) {
        terminalLog.imageError(userName || getShortUserId(userId), error.message);
        throw error; // Lanza el error en lugar de retornar un string
    }
}
```

### 3. Comunicación y Presencia

| Función | Descripción |
|---------|-------------|
| `sendTypingIndicator(chatId)` | Envía el estado "escribiendo..." al chat del usuario |
| `sendRecordingIndicator(chatId)` | Envía el estado "grabando audio..." al chat del usuario |
| `subscribeToPresence(userId)` | Suscribe al bot a eventos de presencia del usuario (typing/recording) para mejor UX. Evita duplicados |

```typescript
function sendTypingIndicator(chatId: string): void {
    fetch(`${appConfig.whapi.baseUrl}/presences/${chatId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${appConfig.whapi.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ presence: 'typing' })
    }).catch(() => {}); // Ignore errors
}

function sendRecordingIndicator(chatId: string): void {
    fetch(`${appConfig.whapi.baseUrl}/presences/${chatId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${appConfig.whapi.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ presence: 'recording' })
    }).catch(() => {});
}

function subscribeToPresence(userId: string): void {
    if (subscribedPresences.has(userId)) return;
    
    fetch(`${appConfig.whapi.baseUrl}/presences/${userId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${appConfig.whapi.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscribe: true })
    }).then(() => {
        subscribedPresences.add(userId);
    }).catch(() => {});
}
```

## Sistema de Locks

### 1. Thread Locking
```typescript
async function acquireUserLock(userId: string, timeout: number = 15000): Promise<boolean> {
    try {
        const acquired = await simpleLockManager.acquireUserLock(userId, timeout);
        if (acquired) {
            terminalLog.debug(`Acquired user lock: ${getShortUserId(userId)}`);
        } else {
            terminalLog.warning(`Failed to acquire user lock: ${getShortUserId(userId)}`);
        }
        return acquired;
    } catch (error) {
        terminalLog.error(`User lock error: ${error}`);
        return false;
    }
}

function releaseUserLock(userId: string): void {
    try {
        simpleLockManager.releaseUserLock(userId);
        terminalLog.debug(`Released user lock: ${getShortUserId(userId)}`);
    } catch (error) {
        terminalLog.error(`User unlock error: ${error}`);
    }
}

```

## Buffer Management

| Función | Descripción |
|---------|-------------|
| `addToGlobalBuffer(...)` | Añade un mensaje (texto o voz) al buffer unificado de un usuario |
| `setIntelligentTimer(...)` | Configura temporizador dinámico (5-10s) que se extiende si el usuario está escribiendo o grabando |
| `processGlobalBuffer(userId)` | Lógica principal que se ejecuta cuando el timer expira. Combina mensajes del buffer y los envía a `processCombinedMessage` |

```typescript
// Código exacto de app-unified.ts
function addToGlobalBuffer(userId: string, messageText: string, chatId: string, userName: string, isVoice: boolean = false): void {
    if (!globalMessageBuffers.has(userId)) {
        globalMessageBuffers.set(userId, []);
    }
    
    const buffer = globalMessageBuffers.get(userId)!;
    buffer.push({
        text: messageText,
        timestamp: Date.now(),
        isVoice: isVoice,
        chatId: chatId,
        userName: userName
    });
    
    setIntelligentTimer(userId, chatId, userName, isVoice ? 'voice' : 'message');
    
    terminalLog.buffering(userName, `Buffer actualizado: ${buffer.length} mensajes`);
}

function setIntelligentTimer(userId: string, chatId: string, userName: string, triggerType: 'message' | 'voice' | 'typing' | 'recording'): void {
    if (globalMessageBuffers.has(userId)) {
        const buffer = globalMessageBuffers.get(userId)!;
        
        // Cancelar timer existente en el buffer
        if (buffer.timer) {
            clearTimeout(buffer.timer);
        }
        
        let delay = BUFFER_WINDOW_MS; // Base: 7000ms
        
        if (triggerType === 'typing' || triggerType === 'recording') {
            delay = TYPING_EXTENDED_MS; // 10000ms
        }
        
        buffer.timer = setTimeout(async () => {
            if (!activeProcessing.has(userId)) {
                await processGlobalBuffer(userId);
            }
        }, delay);
        
        terminalLog.debug(`Timer establecido para ${userName}: ${delay}ms (${triggerType})`);
    }
}

async function processGlobalBuffer(userId: string): Promise<void> {
    if (activeProcessing.has(userId)) {
        return;
    }
    
    const buffer = globalMessageBuffers.get(userId);
    if (!buffer || buffer.length === 0) {
        return;
    }
    
    activeProcessing.add(userId);
    
    try {
        const combinedText = buffer.map(msg => msg.text).join('\n');
        const messageInfo = {
            chatId: buffer[0].chatId,
            userName: buffer[0].userName,
            hasVoice: buffer.some(msg => msg.isVoice)
        };
        
        // Limpiar buffer y timer
        globalMessageBuffers.delete(userId);
        
        await processCombinedMessage(messageInfo.chatId, combinedText, messageInfo);
        
    } finally {
        activeProcessing.delete(userId);
    }
}
```

## Envío de Mensajes

### 1. WhatsApp Message Sending
El sistema utiliza una única función `sendWhatsAppMessage` que contiene lógica compleja para:
1. **Decidir el formato**: Responde con voz (`tts-1` de OpenAI) si el último input del usuario fue de voz y `ENABLE_VOICE_RESPONSES` es `true`
2. **Fallback a Texto**: Si el contenido es sensible (precios, enlaces detectados por `isQuoteOrPriceMessage`), fuerza envío como texto 
3. **División Inteligente**: Divide mensajes largos por párrafos (`\n\n`) o listas con viñetas, enviando cada parte con retraso y indicador "escribiendo"

```typescript
async function sendWhatsAppMessage(chatId: string, message: string): Promise<boolean> {
    try {
        const userState = getOrCreateUserState(chatId);
        const shouldUseVoice = process.env.ENABLE_VOICE_RESPONSES === 'true' && userState.lastInputVoice;
        
        // 1. Verificar si usar voz y si el contenido es sensible
        if (shouldUseVoice && !isQuoteOrPriceMessage(message)) {
            try {
                // Generar audio con OpenAI TTS
                const speechResponse = await openaiClient.audio.speech.create({
                    model: 'tts-1',
                    voice: 'nova',
                    input: message.substring(0, 4000),
                    response_format: 'mp3'
                });
                
                const audioBuffer = await speechResponse.arrayBuffer();
                const base64Audio = Buffer.from(audioBuffer).toString('base64');
                
                // Enviar audio vía WHAPI
                const response = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/voice`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        to: chatId,
                        media: base64Audio
                    })
                });
                
                if (response.ok) {
                    terminalLog.success(`Respuesta de voz enviada a ${getShortUserId(chatId)}`);
                    return true;
                }
            } catch (error) {
                terminalLog.warning(`Error enviando voz, fallback a texto: ${error}`);
                // Continúa para enviar como texto
            }
        }
        
        // 2. Envío como texto con división inteligente
        sendTypingIndicator(chatId);
        
        // División por párrafos o listas
        const chunks = message.split(/\n\n|(?=\n[\u2022\-\*])/).filter(chunk => chunk.trim());
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i].trim();
            
            // Tiempo de escritura dinámico
            const typing_time = chunk.length > 100 ? 3000 : 2000;
            await new Promise(resolve => setTimeout(resolve, typing_time));
            
            // Enviar chunk
            const response = await fetch(`${appConfig.secrets.WHAPI_API_URL}/messages/text`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${appConfig.secrets.WHAPI_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    to: chatId,
                    body: chunk
                })
            });
            
            if (!response.ok) {
                throw new Error(`Error enviando mensaje: ${response.status}`);
            }
        }
        
        return true;
        
    } catch (error) {
        terminalLog.whapiError('sendWhatsAppMessage', error.message);
        return false;
    }
}
```

## Utilities OpenAI

### 1. Assistant Run Management

| Función | Descripción |
|---------|-------------|
| `isRunActive(run)` | Verifica si un run de OpenAI está en estado activo ('queued', 'in_progress', 'cancelling', 'requires_action') |
| `cleanupOldRuns(threadId, userId)` | Cancela runs que han estado activos por más de 10 minutos para evitar que queden "atascados" |
| `recoverOrphanedRuns()` | Se ejecuta al iniciar el bot. Recorre todos los threads conocidos y cancela runs activos desde reinicios anteriores |

```typescript
function isRunActive(run: any): boolean {
    return ['queued', 'in_progress', 'cancelling', 'requires_action'].includes(run.status);
}

async function cleanupOldRuns(threadId: string): Promise<void> {
    try {
        const runs = await openaiClient.beta.threads.runs.list(threadId, { limit: 100 });
        const oldRuns = runs.data.filter(run => 
            !isRunActive(run) && 
            Date.now() - new Date(run.created_at * 1000).getTime() > 3600000 // 1 hora
        );
        
        for (const run of oldRuns.slice(0, 10)) { // Máximo 10 por vez
            try {
                await openaiClient.beta.threads.runs.cancel(threadId, run.id);
                terminalLog.debug(`Cleaned up old run: ${run.id}`);
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    } catch (error) {
        terminalLog.error(`Error cleaning up runs: ${error}`);
    }
}

async function recoverOrphanedRuns(): Promise<void> {
    try {
        // Recorre todos los threads conocidos para encontrar runs huérfanos
        const allThreadIds = Array.from(globalUserStates.values()).map(state => state.threadId).filter(Boolean);
        
        for (const threadId of allThreadIds) {
            try {
                const runs = await openaiClient.beta.threads.runs.list(threadId, { limit: 20 });
                const orphanedRuns = runs.data.filter(run => 
                    isRunActive(run) && 
                    Date.now() - new Date(run.created_at * 1000).getTime() > 300000 // 5 minutos
                );
                
                for (const run of orphanedRuns) {
                    try {
                        await openaiClient.beta.threads.runs.cancel(threadId, run.id);
                        terminalLog.warning(`Recovered orphaned run: ${run.id} from thread: ${threadId}`);
                    } catch (error) {
                        terminalLog.error(`Failed to recover run ${run.id}: ${error}`);
                    }
                }
            } catch (error) {
                terminalLog.error(`Error processing thread ${threadId}: ${error}`);
            }
        }
    } catch (error) {
        terminalLog.error(`Error recovering orphaned runs: ${error}`);
    }
}
```

## Sistema de Tracing

### 1. Request Tracing
```typescript
function startRequestTracing(chatId: string, userId: string): string {
    const requestId = generateRequestId();
    
    activeTracing.set(requestId, {
        requestId,
        chatId,
        userId,
        startTime: Date.now(),
        currentStage: 'init',
        stages: [{
            stage: 'init',
            startTime: Date.now()
        }],
        toolCalls: []
    });
    
    terminalLog.debug(`Started tracing: ${requestId}`);
    return requestId;
}

function updateRequestStage(requestId: string, stage: string): void {
    const trace = activeTracing.get(requestId);
    if (trace) {
        const now = Date.now();
        
        // Close previous stage
        const lastStage = trace.stages[trace.stages.length - 1];
        if (!lastStage.endTime) {
            lastStage.endTime = now;
            lastStage.duration = now - lastStage.startTime;
        }
        
        // Start new stage
        trace.stages.push({
            stage,
            startTime: now
        });
        trace.currentStage = stage;
        
        terminalLog.debug(`Stage transition [${requestId}]: ${stage}`);
    }
}

function endRequestTracing(requestId: string): void {
    const trace = activeTracing.get(requestId);
    if (trace) {
        const now = Date.now();
        
        // Close last stage
        const lastStage = trace.stages[trace.stages.length - 1];
        if (!lastStage.endTime) {
            lastStage.endTime = now;
            lastStage.duration = now - lastStage.startTime;
        }
        
        const totalDuration = now - trace.startTime;
        terminalLog.debug(`Completed tracing [${requestId}]: ${formatDuration(totalDuration)}`);
        
        // Log detailed breakdown if > 5s
        if (totalDuration > 5000) {
            const breakdown = trace.stages.map(s => 
                `${s.stage}: ${formatDuration(s.duration || 0)}`
            ).join(', ');
            terminalLog.warning(`Slow request [${requestId}]: ${breakdown}`);
        }
        
        activeTracing.delete(requestId);
    }
}
```

## Análisis de Problemas

### Problemas Identificados
1. **Memory leaks** en tempAudioFiles sin cleanup garantizado
2. **Race conditions** en buffer processing
3. **Falta de retry logic** en funciones de media
4. **Hardcoded timeouts** sin configuración
5. **Inconsistent error handling** entre funciones

### Recomendaciones para Migración
1. **Modularizar por responsabilidad** (media, cache, locks, etc.)
2. **Implementar interfaces** consistentes para todas las utilidades
3. **Centralizar configuration** de timeouts y límites
4. **Agregar comprehensive error handling** con retry logic
5. **Implementar unit tests** para todas las funciones utilitarias