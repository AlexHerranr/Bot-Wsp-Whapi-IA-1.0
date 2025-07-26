# 👤 Sistema de Gestión de Estados de Usuario - Documentación Técnica Completa

## 📋 Resumen Ejecutivo

El **Sistema de Gestión de Estados de Usuario** es un componente crítico que mantiene información contextual persistente sobre cada usuario que interactúa con el bot. Gestiona estados conversacionales, patrones de comportamiento, preferencias multimedia y métricas de actividad para personalizar la experiencia y optimizar las respuestas del sistema.

---

## 🏗️ Arquitectura del Sistema

### **Estructura Principal**

```typescript
// Cache global de estados en memoria
const globalUserStates = new Map<string, UserState>();

// Interface completa del estado de usuario
interface UserState {
    userId: string;                    // ID único del usuario
    isTyping: boolean;                 // Estado actual de escritura
    lastTypingTimestamp: number;       // Último evento de typing
    lastMessageTimestamp: number;      // Último mensaje enviado
    messages: string[];                // Historial de mensajes recientes
    chatId: string;                    // ID del chat de WhatsApp
    userName: string;                  // Nombre para mostrar
    typingEventsCount: number;         // Contador de eventos de typing
    averageTypingDuration: number;     // Duración promedio de typing
    lastInputVoice: boolean;           // Último input fue de voz
    lastTyping: number;                // Timestamp crítico para buffer timing
}
```

### **Ubicación en el Código**
- **Archivo**: `src/app-unified.ts`
- **Líneas**: 266-298 (Definición y helper functions)
- **Cache Global**: Línea 267
- **Factory Function**: Líneas 279-298

---

## 🔄 Ciclo de Vida del Estado

### **1. Creación de Estado**

```typescript
function getOrCreateUserState(userId: string, chatId?: string, userName?: string): UserState {
    let userState = globalUserStates.get(userId);
    
    if (!userState) {
        // CREAR NUEVO ESTADO CON DEFAULTS
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
            lastTyping: 0  // ⭐ CRÍTICO para timing de buffer
        };
        
        globalUserStates.set(userId, userState);
        
        // Log de nuevo usuario
        logInfo('USER_STATE_CREATED', 'Nuevo estado de usuario creado', {
            userId: getShortUserId(userId),
            chatId: userState.chatId,
            userName: userState.userName
        });
    }
    
    return userState;
}
```

**Características de Creación**:
- ✅ **Lazy loading** - Solo se crea cuando se necesita
- ✅ **Defaults seguros** - Valores iniciales consistentes
- ✅ **Auto-generación** - ChatId y userName automáticos
- ✅ **Logging** - Tracking de nuevos usuarios

### **2. Actualización de Estado**

#### **Actualización por Typing**
```typescript
function updateTypingStatus(userId: string, isTyping: boolean): void {
    const userState = getOrCreateUserState(userId);
    const now = Date.now();
    
    if (isTyping) {
        // INICIO DE TYPING
        userState.isTyping = true;
        userState.lastTyping = now;           // ⭐ CRÍTICO para buffer
        userState.lastTypingTimestamp = now;
        userState.typingEventsCount++;
        
        // Calcular duración promedio (si hay eventos previos)
        if (userState.typingEventsCount > 1) {
            const duration = now - userState.lastTypingTimestamp;
            userState.averageTypingDuration = 
                (userState.averageTypingDuration * (userState.typingEventsCount - 1) + duration) 
                / userState.typingEventsCount;
        }
        
        // Rate limiting para logs
        const lastLog = typingLogTimestamps.get(userId) || 0;
        if (now - lastLog > 10000) { // 10 segundos
            terminalLog.typing(userState.userName);
            typingLogTimestamps.set(userId, now);
        }
        
    } else {
        // FIN DE TYPING
        userState.isTyping = false;
        // MANTENER lastTyping para ventana extendida de buffer
    }
}
```

#### **Actualización por Mensaje**
```typescript
function updateMessageState(userId: string, message: string, isVoice: boolean = false): void {
    const userState = getOrCreateUserState(userId);
    const now = Date.now();
    
    // ACTUALIZAR TIMESTAMPS
    userState.lastMessageTimestamp = now;
    
    // GESTIONAR HISTORIAL DE MENSAJES
    userState.messages.push(message);
    
    // Mantener solo últimos 10 mensajes para evitar memory leak
    if (userState.messages.length > 10) {
        userState.messages = userState.messages.slice(-10);
    }
    
    // MARCAR TIPO DE INPUT
    userState.lastInputVoice = isVoice;
    
    // RESET TYPING STATE
    userState.isTyping = false;
}
```

### **3. Consulta de Estado**

```typescript
// Obtener estado existente (sin crear)
function getUserState(userId: string): UserState | undefined {
    return globalUserStates.get(userId);
}

// Verificar si usuario está activo
function isUserActive(userId: string, windowMs: number = 300000): boolean { // 5 min
    const userState = getUserState(userId);
    if (!userState) return false;
    
    const now = Date.now();
    const lastActivity = Math.max(
        userState.lastMessageTimestamp,
        userState.lastTypingTimestamp
    );
    
    return (now - lastActivity) < windowMs;
}

// Obtener tiempo desde última actividad
function getTimeSinceLastActivity(userId: string): number {
    const userState = getUserState(userId);
    if (!userState) return Infinity;
    
    const now = Date.now();
    const lastActivity = Math.max(
        userState.lastMessageTimestamp,
        userState.lastTypingTimestamp
    );
    
    return now - lastActivity;
}
```

---

## 🎯 Casos de Uso Principales

### **1. Timing Inteligente de Buffer**

```typescript
// Decisión crítica para ventana de buffer
function determineBufferWindow(userId: string): number {
    const userState = globalUserStates.get(userId);
    
    // Si hay typing reciente (menos de 10s), usar ventana extendida
    if (userState?.lastTyping && 
        (Date.now() - userState.lastTyping < TYPING_EXTENDED_MS)) {
        return TYPING_EXTENDED_MS;  // 10 segundos
    }
    
    return BUFFER_WINDOW_MS;  // 5 segundos por defecto
}
```

**Flujo Típico**:
```
T+0s:  Usuario inicia typing → userState.lastTyping = now
T+1s:  Usuario envía mensaje → buffer usa ventana de 10s
T+2s:  Usuario sigue typing → ventana sigue siendo 10s
T+8s:  Usuario para de escribir → ventana expira en 2s más
T+10s: Buffer procesa mensajes agrupados
```

### **2. Decisión de Respuesta por Voz**

```typescript
// Lógica para responder con TTS
function shouldUseVoice(userId: string): boolean {
    if (process.env.ENABLE_VOICE_RESPONSES !== 'true') {
        return false;
    }
    
    const userState = getUserState(userId);
    return userState?.lastInputVoice === true;
}

// Implementación en processWithOpenAI
async function processWithOpenAI(chatId: string, userMsg: string, userName: string, userJid: string) {
    const userState = getUserState(userJid);
    const shouldRespond = shouldUseVoice(userJid);
    
    if (shouldRespond) {
        // Generar respuesta de voz con TTS
        await generateVoiceResponse(aiResponse, chatId, userName);
    } else {
        // Respuesta de texto normal
        await sendWhatsAppMessage(chatId, aiResponse, userName);
    }
}
```

### **3. Personalización de Experiencia**

```typescript
// Adaptar comportamiento basado en historial
function getPersonalizationContext(userId: string): string {
    const userState = getUserState(userId);
    if (!userState) return '';
    
    const context = [];
    
    // Frecuencia de typing
    if (userState.typingEventsCount > 10 && userState.averageTypingDuration > 5000) {
        context.push('Usuario tiende a escribir mensajes largos');
    }
    
    // Preferencia multimedia
    const voiceMessages = userState.messages.filter(m => m.includes('🎤 [NOTA DE VOZ]')).length;
    const totalMessages = userState.messages.length;
    
    if (voiceMessages / totalMessages > 0.5) {
        context.push('Usuario prefiere comunicación por voz');
    }
    
    // Actividad reciente
    const timeSinceLastMessage = Date.now() - userState.lastMessageTimestamp;
    if (timeSinceLastMessage > 24 * 60 * 60 * 1000) { // 24 horas
        context.push('Usuario regresando después de tiempo prolongado');
    }
    
    return context.join('. ');
}
```

### **4. Rate Limiting Inteligente**

```typescript
// Prevenir spam basado en patrones de usuario
function shouldRateLimit(userId: string): boolean {
    const userState = getUserState(userId);
    if (!userState) return false;
    
    const now = Date.now();
    const recentMessages = userState.messages.filter(m => {
        // Filtrar mensajes de los últimos 60 segundos
        const messageTime = userState.lastMessageTimestamp;
        return (now - messageTime) < 60000;
    });
    
    // Rate limit si más de 10 mensajes en 1 minuto
    return recentMessages.length > 10;
}
```

---

## 📊 Métricas y Analytics

### **Métricas por Usuario**

```typescript
function getUserMetrics(userId: string): UserMetrics | null {
    const userState = getUserState(userId);
    if (!userState) return null;
    
    const now = Date.now();
    
    return {
        // Actividad
        totalMessages: userState.messages.length,
        lastActivityMinutesAgo: Math.round((now - userState.lastMessageTimestamp) / 60000),
        isCurrentlyActive: isUserActive(userId, 300000), // 5 min
        
        // Comportamiento
        typingEventsCount: userState.typingEventsCount,
        averageTypingDurationMs: userState.averageTypingDuration,
        preferredInputType: userState.lastInputVoice ? 'voice' : 'text',
        
        // Patrones
        voiceMessagePercentage: calculateVoicePercentage(userState.messages),
        activityPattern: analyzeActivityPattern(userState),
        
        // Estado actual
        isTyping: userState.isTyping,
        timeSinceLastTyping: now - userState.lastTyping
    };
}

function calculateVoicePercentage(messages: string[]): number {
    const voiceMessages = messages.filter(m => m.includes('🎤 [NOTA DE VOZ]')).length;
    return messages.length > 0 ? (voiceMessages / messages.length) * 100 : 0;
}

function analyzeActivityPattern(userState: UserState): 'high' | 'medium' | 'low' | 'inactive' {
    const now = Date.now();
    const timeSinceLastMessage = now - userState.lastMessageTimestamp;
    
    if (timeSinceLastMessage < 60000) return 'high';      // < 1 min
    if (timeSinceLastMessage < 300000) return 'medium';   // < 5 min  
    if (timeSinceLastMessage < 3600000) return 'low';     // < 1 hora
    return 'inactive';
}
```

### **Métricas Globales**

```typescript
function getGlobalUserMetrics(): GlobalMetrics {
    const now = Date.now();
    let totalUsers = 0;
    let activeUsers = 0;
    let typingUsers = 0;
    let voiceUsers = 0;
    let textUsers = 0;
    
    for (const [userId, userState] of globalUserStates.entries()) {
        totalUsers++;
        
        // Usuarios activos (últimos 5 minutos)
        if (isUserActive(userId, 300000)) {
            activeUsers++;
        }
        
        // Usuarios escribiendo actualmente
        if (userState.isTyping) {
            typingUsers++;
        }
        
        // Preferencia de input
        if (userState.lastInputVoice) {
            voiceUsers++;
        } else {
            textUsers++;
        }
    }
    
    return {
        totalUsers,
        activeUsers,
        typingUsers,
        inactiveUsers: totalUsers - activeUsers,
        voicePreferenceUsers: voiceUsers,
        textPreferenceUsers: textUsers,
        memoryUsageKB: Math.round((totalUsers * 1024) / 1024), // Estimación
        cacheHitRate: calculateCacheHitRate()
    };
}
```

---

## 🧹 Gestión de Memoria

### **Problema Identificado**
El sistema **NO implementa limpieza automática** de estados antiguos, causando un **memory leak potencial**:

```typescript
// ❌ PROBLEMA: globalUserStates crece indefinidamente
const globalUserStates = new Map<string, UserState>(); // Sin limpieza automática
```

### **Solución Propuesta**

#### **1. Limpieza Periódica Automática**
```typescript
// Propuesta: Cleanup cada hora
setInterval(() => {
    cleanupInactiveUserStates();
}, 60 * 60 * 1000); // 1 hora

function cleanupInactiveUserStates(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    let cleaned = 0;
    
    for (const [userId, userState] of globalUserStates.entries()) {
        const lastActivity = Math.max(
            userState.lastMessageTimestamp,
            userState.lastTypingTimestamp
        );
        
        // Limpiar estados inactivos por más de 24 horas
        if ((now - lastActivity) > maxAge) {
            globalUserStates.delete(userId);
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        logInfo('USER_STATE_CLEANUP', 'Estados de usuario limpiados', {
            cleanedStates: cleaned,
            remainingStates: globalUserStates.size,
            memoryFreedKB: Math.round(cleaned * 1024)
        });
    }
}
```

#### **2. Limpieza por Límite de Memoria**
```typescript
function cleanupByMemoryPressure(): void {
    const currentSize = globalUserStates.size;
    const maxUsers = 10000; // Límite configurable
    
    if (currentSize > maxUsers) {
        // Obtener usuarios ordenados por última actividad (más antiguos primero)
        const sortedUsers = Array.from(globalUserStates.entries())
            .sort(([, a], [, b]) => {
                const lastA = Math.max(a.lastMessageTimestamp, a.lastTypingTimestamp);
                const lastB = Math.max(b.lastMessageTimestamp, b.lastTypingTimestamp);
                return lastA - lastB;
            });
        
        // Eliminar 20% de usuarios más antiguos
        const toRemove = Math.floor(currentSize * 0.2);
        
        for (let i = 0; i < toRemove; i++) {
            const [userId] = sortedUsers[i];
            globalUserStates.delete(userId);
        }
        
        logWarning('USER_STATE_MEMORY_CLEANUP', 'Limpieza por presión de memoria', {
            removedStates: toRemove,
            remainingStates: globalUserStates.size,
            reason: 'memory_pressure'
        });
    }
}
```

#### **3. Limpieza Manual Bajo Demanda**
```typescript
// Endpoint para limpieza manual
app.delete('/admin/user-states', (req, res) => {
    const sizeBefore = globalUserStates.size;
    
    // Limpiar usuarios inactivos por más de 1 hora
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hora
    
    for (const [userId, userState] of globalUserStates.entries()) {
        const lastActivity = Math.max(
            userState.lastMessageTimestamp,
            userState.lastTypingTimestamp
        );
        
        if ((now - lastActivity) > maxAge) {
            globalUserStates.delete(userId);
        }
    }
    
    const sizeAfter = globalUserStates.size;
    
    res.json({
        cleaned: sizeBefore - sizeAfter,
        remaining: sizeAfter,
        memoryFreedKB: Math.round((sizeBefore - sizeAfter) * 1024)
    });
});
```

---

## 🔧 Integración con Otros Sistemas

### **1. Buffer Inteligente**
```typescript
// Estado crítico para timing de buffer
function addToGlobalBuffer(userId: string, message: string, chatId: string, userName: string, isVoice: boolean = false): void {
    // ACTUALIZAR ESTADO
    updateMessageState(userId, message, isVoice);
    
    // USAR ESTADO PARA DECISIÓN DE TIMING
    const bufferWindow = determineBufferWindow(userId);
    
    // CREAR O ACTUALIZAR BUFFER
    let buffer = globalMessageBuffers.get(getShortUserId(userId));
    if (!buffer) {
        buffer = createNewBuffer(userId, message, chatId, userName, bufferWindow);
    } else {
        updateExistingBuffer(buffer, message);
    }
}
```

### **2. Terminal Logging System**
```typescript
// Estado para rate limiting de logs
function logTypingIfAllowed(userId: string, userName: string): void {
    const now = Date.now();
    const lastLog = typingLogTimestamps.get(userId) || 0;
    
    // Rate limit: máximo 1 log cada 10 segundos
    if (now - lastLog > 10000) {
        terminalLog.typing(userName);
        typingLogTimestamps.set(userId, now);
    }
}
```

### **3. Cache de Contexto**
```typescript
// Invalidación de caches cuando cambia estado
function invalidateUserCaches(userId: string): void {
    const shortUserId = getShortUserId(userId);
    
    // Invalidar cache de chat info
    if (chatInfoCache.has(userId)) {
        chatInfoCache.delete(userId);
        logInfo('CACHE_INVALIDATED', 'Cache de chat info invalidado', { userId: shortUserId });
    }
    
    // Invalidar cache de contexto temporal
    if (contextCache.has(shortUserId)) {
        contextCache.delete(shortUserId);
        logInfo('CACHE_INVALIDATED', 'Cache de contexto temporal invalidado', { userId: shortUserId });
    }
    
    // Marcar estado para regeneración de contexto
    const userState = getUserState(userId);
    if (userState) {
        userState.lastMessageTimestamp = Date.now(); // Forzar update
    }
}
```

---

## 📊 Monitoreo y Debugging

### **Endpoint de Estado de Usuario**
```typescript
// Endpoint para debugging de estados
app.get('/admin/user-state/:userId', (req, res) => {
    const userId = req.params.userId;
    const userState = getUserState(userId);
    
    if (!userState) {
        return res.status(404).json({ error: 'User state not found' });
    }
    
    const metrics = getUserMetrics(userId);
    
    res.json({
        state: userState,
        metrics,
        derivedData: {
            timeSinceLastActivity: getTimeSinceLastActivity(userId),
            isActive: isUserActive(userId),
            shouldUseVoice: shouldUseVoice(userId),
            bufferWindow: determineBufferWindow(userId),
            personalizationContext: getPersonalizationContext(userId)
        }
    });
});
```

### **Logging de Cambios de Estado**
```typescript
function logStateChange(userId: string, field: string, oldValue: any, newValue: any): void {
    logDebug('USER_STATE_CHANGE', 'Estado de usuario actualizado', {
        userId: getShortUserId(userId),
        field,
        oldValue,
        newValue,
        timestamp: new Date().toISOString()
    });
}

// Wrapper para updates con logging
function updateUserStateWithLogging(userId: string, updates: Partial<UserState>): void {
    const userState = getOrCreateUserState(userId);
    
    for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = userState[field as keyof UserState];
        if (oldValue !== newValue) {
            logStateChange(userId, field, oldValue, newValue);
            (userState as any)[field] = newValue;
        }
    }
}
```

---

## ⚠️ Limitaciones y Consideraciones

### **1. Memory Leak Crítico**
- **Problema**: `globalUserStates` crece indefinidamente sin limpieza
- **Impacto**: En uso prolongado con muchos usuarios únicos, puede causar agotamiento de memoria
- **Mitigación**: Implementar cleanup automático propuesto

### **2. Persistencia Temporal**
- **Problema**: Estados se pierden al reiniciar el bot
- **Impacto**: Pérdida de contexto y preferencias de usuario
- **Consideración**: Para casos críticos, implementar persistencia en base de datos

### **3. Concurrencia de Actualizaciones**
- **Problema**: No hay locks para actualizaciones concurrentes del mismo usuario
- **Impacto**: Posible race condition en actualizaciones de estado
- **Mitigación**: Usar el lock manager existente para operaciones críticas

### **4. Límites de Historial**
- **Problema**: `messages` se limita a 10 elementos arbitrariamente
- **Impacto**: Pérdida de contexto en conversaciones muy largas
- **Consideración**: Hacer límite configurable

### **5. Cálculo de Métricas**
- **Problema**: `averageTypingDuration` puede ser inexacto debido a eventos de typing superpuestos
- **Impacto**: Métricas de comportamiento poco confiables
- **Mejora**: Implementar tracking más preciso de eventos

---

## 🚀 Optimizaciones Implementadas

### **1. Lazy Loading**
- Estados se crean solo cuando se necesitan
- Evita inicialización innecesaria de usuarios inactivos
- Reduce footprint de memoria inicial

### **2. Rate Limiting Inteligente**
- Logs de typing limitados a 1 cada 10 segundos por usuario
- Previene spam en terminal durante typing intenso
- Mantiene balance entre información y ruido

### **3. Cache de Nombres**
- `userName` se guarda en estado para evitar lookups repetidos
- Mejora performance en operaciones frecuentes
- Reduce llamadas a APIs externas

### **4. Timestamps Múltiples**
- Tracking separado de diferentes tipos de actividad
- Permite análisis granular de patrones de uso
- Optimiza decisiones de timing

---

## 📝 Recomendaciones de Desarrollo

### **✅ Fortalezas a Mantener**
1. **Factory pattern** con `getOrCreateUserState()` - Garantiza consistencia
2. **Typing timing integrado** - Crítico para experiencia de usuario
3. **Lightweight state structure** - Balance entre información y memoria
4. **Integration points** bien definidos con otros sistemas

### **⚠️ Mejoras Críticas Necesarias**

#### **1. Implementar Cleanup Automático (URGENTE)**
```typescript
// Debe implementarse para evitar memory leak
setInterval(cleanupInactiveUserStates, 60 * 60 * 1000); // Cada hora
```

#### **2. Configurabilidad**
```typescript
const USER_STATE_CONFIG = {
    maxHistoryMessages: parseInt(process.env.MAX_HISTORY_MESSAGES) || 10,
    cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS) || 3600000,
    maxInactiveAgeMs: parseInt(process.env.MAX_INACTIVE_AGE_MS) || 86400000,
    enablePersistence: process.env.ENABLE_STATE_PERSISTENCE === 'true'
};
```

#### **3. Persistencia Opcional**
```typescript
// Para casos críticos donde se requiere persistencia
class PersistentUserStateManager {
    private memoryStates = new Map<string, UserState>();
    private dbConnection: DatabaseConnection;
    
    async getOrCreateUserState(userId: string): Promise<UserState> {
        // 1. Buscar en memoria
        let state = this.memoryStates.get(userId);
        if (state) return state;
        
        // 2. Buscar en base de datos
        state = await this.loadFromDatabase(userId);
        if (state) {
            this.memoryStates.set(userId, state);
            return state;
        }
        
        // 3. Crear nuevo estado
        state = this.createNewState(userId);
        this.memoryStates.set(userId, state);
        await this.saveToDatabase(state);
        
        return state;
    }
    
    async saveState(userId: string): Promise<void> {
        const state = this.memoryStates.get(userId);
        if (state) {
            await this.saveToDatabase(state);
        }
    }
}
```

#### **4. Métricas Avanzadas**
```typescript
// Sistema de métricas más sofisticado
class UserAnalytics {
    static analyzeUserBehavior(userState: UserState): UserBehaviorProfile {
        return {
            communicationStyle: this.analyzeCommunicationStyle(userState),
            activityPattern: this.analyzeActivityPattern(userState),
            preferredTiming: this.analyzePreferredTiming(userState),
            responseExpectation: this.analyzeResponseExpectation(userState)
        };
    }
    
    static generatePersonalizationRecommendations(profile: UserBehaviorProfile): string[] {
        const recommendations = [];
        
        if (profile.communicationStyle === 'voice-heavy') {
            recommendations.push('Priorizar respuestas de voz');
            recommendations.push('Usar lenguaje conversacional');
        }
        
        if (profile.activityPattern === 'burst') {
            recommendations.push('Agrupar información en una respuesta');
            recommendations.push('Usar timing de buffer extendido');
        }
        
        return recommendations;
    }
}
```

---

## 🎯 Conclusión

El **Sistema de Gestión de Estados de Usuario** es un componente **fundamental** que proporciona contexto crítico para personalización y optimización de la experiencia conversacional. Su integración profunda con el sistema de buffer y timing lo convierte en una pieza clave de la arquitectura.

**Fortalezas principales**:
- ✅ **Factory pattern** garantiza estados consistentes
- ✅ **Timing crítico** para buffer inteligente implementado correctamente
- ✅ **Lightweight design** optimizado para memoria
- ✅ **Múltiples puntos de integración** bien definidos

**Problemas críticos**:
- ❌ **Memory leak severo** - Sin limpieza automática (URGENTE)
- ⚠️ **Persistencia temporal** - Se pierde al reiniciar
- ⚠️ **Configurabilidad limitada** - Valores hardcodeados
- ⚠️ **Métricas básicas** - Potencial para análisis más profundo

**Estado actual**: ✅ **Funcionalmente correcto** pero con **riesgo operacional alto** debido al memory leak. Requiere implementación **urgente** de cleanup automático.

**Prioridad de implementación**:
1. **CRÍTICO**: Cleanup automático de estados antiguos
2. **ALTO**: Configurabilidad de parámetros
3. **MEDIO**: Métricas avanzadas y analytics
4. **BAJO**: Persistencia opcional para casos críticos

---

**Referencias de Código**:
- `src/app-unified.ts:266-267` - Cache global y interface
- `src/app-unified.ts:279-298` - Factory function `getOrCreateUserState()`
- `src/app-unified.ts:3123-3127` - Actualización por presencia
- `src/app-unified.ts:2116-2128` - Uso en detección de voz