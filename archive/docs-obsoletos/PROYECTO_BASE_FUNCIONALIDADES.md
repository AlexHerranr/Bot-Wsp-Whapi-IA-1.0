# 🎯 **PROYECTO BASE - Funcionalidades de Interacción Usuario-LLM**

> **Análisis detallado de funcionalidades generales para interacción conversacional**  
> Documento que identifica todas las capacidades base del bot que son reutilizables para cualquier industria o dominio.

---

## 📋 **Resumen Ejecutivo**

Este documento identifica y cataloga todas las funcionalidades del archivo `app-unified.ts` que pertenecen al **Proyecto Base** - es decir, aquellas capacidades que son **genéricas y reutilizables** para cualquier tipo de bot conversacional, independientemente de la industria o dominio específico. Incluye elementos como manejo de buffers, threads de OpenAI, locks, logging, persistencia básica, métricas, manejo de errores, webhooks, y cleanups, además de aspectos movidos desde el sector hotelero que son abstractables, como prompts para respuestas a voz (configurables para tonos conversacionales), integración básica con WhatsApp (envío y manejo de manuales), y flujos conversacionales estándar (e.g., syncing de mensajes manuales como assistant role).

**Objetivo**: Separar claramente las funcionalidades base (interacción Usuario-LLM) de las específicas de industria (hotelería), para facilitar la modularización y reutilización del código. Con este documento, sabemos exactamente qué debe contener el nuevo archivo refactorizado de app (e.g., `app-base.ts`), enfocándonos en lo técnico y configurable.

**Archivo Analizado**: `src/app-unified.ts` (Versión unificada, Enero 2025).  
**Líneas Totales**: ~2,974 (aprox. 70-80% base, tras mover genéricos).  
**Criterios de Clasificación**: Funcionalidades técnicas que no dependen de dominio (e.g., buffers, locks), reutilizables en cualquier sector, y configurables (e.g., prompts de voz via env, flujos de WhatsApp abstractos).

---

## 🏗️ **Funcionalidades Base Identificadas**

### 🔧 **1. Sistema de Mensajería y Buffers**

#### **Buffer Management (Líneas ~603-661)**
```typescript
// Funcionalidad: Agrupación inteligente de mensajes
addToGlobalBuffer(userId: string, messageText: string, chatId: string, userName: string, isVoice: boolean = false): void
processGlobalBuffer(userId: string): Promise<void>
```

**Características Base:**
- ✅ **Ventana de tiempo configurable** (BUFFER_WINDOW_MS: number = 5000)
- ✅ **Límite de mensajes por buffer** (implícito en MAX_MESSAGE_LENGTH: number = 5000)
- ✅ **Timer para procesamiento diferido** (timer: NodeJS.Timeout | null)
- ✅ **Combinación inteligente de mensajes** (messages: string[])
- ✅ **Prevención de duplicados** (activeProcessing: Set<string>)

**Reutilizable para**: Cualquier bot que necesite agrupar mensajes rápidos del usuario, independientemente del canal.

#### **Typing Indicators (Líneas ~662-756)**
```typescript
// Funcionalidad: Indicadores de escritura
updateTypingStatus(userId: string, isTyping: boolean): void
sendTypingIndicator(chatId: string): Promise<void>
```

**Características Base:**
- ✅ **Control de estado de escritura** (subscribedPresences: Set<string>)
- ✅ **Delay configurable** (implícito en BUFFER_WINDOW_MS: number)
- ✅ **Prevención de spam de typing** (webhookCounts: Map<string, {lastLog: number, count: number}>)
- ✅ **Sincronización con procesamiento** (globalMessageBuffers: Map<string, {messages: string[], ...}>)

**Reutilizable para**: Cualquier bot que necesite mostrar indicadores de actividad en plataformas como WhatsApp o similares.

---

### 🧠 **2. Gestión de Threads y Runs de OpenAI**

#### **Thread Management (Líneas ~1411-2390)**
```typescript
// Funcionalidad: Gestión completa de conversaciones
processWithOpenAI(userMsg: string, userJid: string, chatId: string = null, userName: string = null, requestId?: string): Promise<string>
```

**Características Base:**
- ✅ **Creación automática de threads** (thread: OpenAI.Beta.Threads.Thread)
- ✅ **Reutilización de threads existentes** (threadId: string)
- ✅ **Cleanup de runs huérfanos** (cleanupOldRuns(threadId: string, userId: string): Promise<number>)
- ✅ **Backoff progresivo para runs activos** (maxAddAttempts: number = 15, backoffDelay: number)
- ✅ **Manejo de timeouts y errores** (maxAttempts: number = 30, pollingInterval: number = 1000)
- ✅ **Rate limiting inteligente** (webhookCounts: Map<string, {lastLog: number, count: number}>)

**Reutilizable para**: Cualquier bot que use OpenAI Assistant API, con inyección de contexto configurable.

#### **Thread Persistence (Líneas ~757-817)**
```typescript
// Funcionalidad: Persistencia de conversaciones
threadPersistence: { getThread(userId: string): {threadId: string, chatId: string, userName: string} | null, setThread(userId: string, threadId: string, chatId: string, userName: string): void, getAllThreadsInfo(): Record<string, {threadId: string, chatId: string, userName: string}>, getStats(): {activeThreads: number, totalThreads: number} }
recoverOrphanedRuns(): Promise<void>
```

**Características Base:**
- ✅ **Límite de runs por thread** (limit: number = 10)
- ✅ **Poda de mensajes antiguos** (limit: number = 1 para último mensaje)
- ✅ **Cálculo de reducción de tokens** (totalTokens: number, promptTokens: number, completionTokens: number)

**Reutilizable para**: Cualquier bot que necesite mantener conversaciones largas, con persistencia genérica.

---

### 🔒 **3. Sistema de Locks y Concurrencia**

#### **Lock Management (Líneas ~144-152)**
```typescript
// Funcionalidad: Control de concurrencia por usuario
acquireThreadLock(userId: string): Promise<boolean>
releaseThreadLock(userId: string): void
simpleLockManager: { acquireUserLock(userId: string): Promise<boolean>, releaseUserLock(userId: string): void, addToQueue(userId: string, messageId: string, data: any, processFunction: () => Promise<void>): void, processQueue(userId: string): Promise<void>, hasActiveLock(userId: string): boolean, getStats(): {activeLocks: number, activeQueues: number} }
```

**Características Base:**
- ✅ **Locks por usuario único** (userId: string)
- ✅ **Colas de espera automáticas** (activeQueues: number)
- ✅ **Timeout configurable** (timeoutSeconds: number = 15)
- ✅ **Prevención de procesamiento duplicado** (activeProcessing: Set<string>)
- ✅ **Liberación automática de locks** (autoRelease: boolean = true)

**Reutilizable para**: Cualquier bot que procese mensajes concurrentes.

---

### 📊 **4. Sistema de Logging y Monitoreo**

#### **Logging System (Líneas ~26-70)**
```typescript
// Funcionalidad: Logging estructurado completo
logInfo(category: string, message: string, details?: any): void
// ... (40+ funciones)
```

**Características Base:**
- ✅ **40+ funciones especializadas** (categorías como OPENAI_REQUEST)
- ✅ **Logs estructurados en JSON** (details: any)
- ✅ **Tracing de requests** (requestId: string)
- ✅ **Métricas de performance** (durationMs: number, tokensPerSecond: number)
- ✅ **Logs por severidad** (DEBUG_LOGS: string = 'true')

**Reutilizable para**: Cualquier aplicación.

#### **Metrics System (Líneas ~81-85)**
```typescript
// Funcionalidad: Métricas de performance
metricsRouter: express.Router
incrementFallbacks(): void
setTokensUsed(tokens: number): void
setLatency(latency: number): void
incrementMessages(): void
```

**Características Base:**
- ✅ **Contadores de tokens/latencia/fallbacks** (setTokensUsed: function)
- ✅ **Dashboard web** (botDashboard.setupRoutes(app))

**Reutilizable para**: Monitoreo en bots.

---

### 💾 **5. Sistema de Persistencia y Cache**

#### **History Cache (Líneas ~100-150)**
```typescript
// Funcionalidad: Cache de historial
injectHistory(threadId: string, userId: string): Promise<boolean>
cleanupExpiredCaches(): void
getCacheStats(): {historyCache: number, ...}
```

**Características Base:**
- ✅ **TTL configurable** (TTL: number)
- ✅ **Cleanup automático** (setInterval)
- ✅ **Estadísticas** (getCacheStats: function)

**Reutilizable para**: Cache en bots.

---

### 🛡️ **6. Manejo de Errores y Timeouts**

#### **Error Handlers (Líneas ~330-405)**
```typescript
// Funcionalidad: Manejo global
process.on('uncaughtException', ...): void
```

**Características Base:**
- ✅ **Captura de excepciones/promises** (error: Error)
- ✅ **Logging antes de crash** (logFatal: function)
- ✅ **Graceful shutdown** (server.close: function)

**Reutilizable para**: Aplicaciones Node.js.

#### **Timeout Management (Líneas ~100-150)**
```typescript
// Funcionalidad: Configuración de timeouts
appConfig.openaiTimeout: number
```

**Características Base:**
- ✅ **Timeouts configurables** (openaiTimeout: number)
- ✅ **Fallbacks** (incrementFallbacks: function)

**Reutilizable para**: Control de tiempos en bots.

---

### 🌐 **7. Sistema de Webhooks y Endpoints**

#### **Webhook Processing (Líneas ~566-2898)**
```typescript
// Funcionalidad: Procesamiento
setupWebhooks(): void
processWebhook(body: any): Promise<void>
```

**Características Base:**
- ✅ **Validación** (messages: array, presences: array)
- ✅ **Parsing** (message: {id: string, type: string, ...})
- ✅ **Routing** (processGlobalBuffer: function)
- ✅ **Respuestas** (sendWhatsAppMessage: async function)

**Reutilizable para**: Webhooks en plataformas.

#### **Health Endpoints (Líneas ~406-529)**
```typescript
// Funcionalidad: Monitoreo
setupEndpoints(): void
```

**Características Base:**
- ✅ **/health** (status: 'healthy')
- ✅ **/locks** (stats: {activeLocks: number})
- ✅ **Dashboard** (botDashboard.setupRoutes)

**Reutilizable para**: Servicios web.

---

### 🔄 **8. Sistema de Cleanup y Mantenimiento**

#### **Cleanup Systems (Líneas ~757-2898)**
```typescript
// Funcionalidad: Limpieza
cleanupOldRuns(...): Promise<number>
recoverOrphanedRuns(): Promise<void>
cleanupExpiredCaches(): void
```

**Características Base:**
- ✅ **Cleanup de runs** (ageMinutes > 10)
- ✅ **Recuperación huérfanos** (runsCancelled: number)
- ✅ **Logging** (logInfo: function)

**Reutilizable para**: Mantenimiento en bots OpenAI.

---

### 📊 **Métricas de Funcionalidades Base**

### **Distribución por Categoría**
| Categoría | Funciones | Líneas Aprox. | Complejidad |
|-----------|-----------|---------------|-------------|
| Mensajería/Buffers | 4 | ~200 | Baja |
| Threads/OpenAI | 6 | ~1000 | Alta |
| Locks | 7 | ~100 | Media |
| Logging | 40+ | ~300 | Baja |
| Persistencia | 5 | ~400 | Media |
| Errores | 4 | ~150 | Baja |
| Webhooks | 9 | ~600 | Media |
| Cleanup | 5 | ~500 | Media |
| **TOTAL** | **80+** | **~3,250** | **Media** |

### **Funcionalidades Críticas vs Opcionales**

#### **🔴 CRÍTICAS**
- Mensajería/buffers
- Threads OpenAI
- Locks
- Logging básico
- Errores
- Webhooks

#### **🟡 IMPORTANTES**
- Cache
- Métricas
- Cleanup
- Endpoints health
- Typing

#### **🟢 OPCIONALES**
- Dashboard
- Métricas detalladas
- Persistencia compleja

---

## 🎯 **Criterios de Clasificación**

### **¿Qué VA al Proyecto Base?**

#### **✅ INCLUSIÓN**
1. **Reutilizable**: Para cualquier industria
2. **Genérico**: Sin lógica de negocio
3. **Técnico**: Infraestructura
4. **Escalable**: Múltiples usuarios
5. **Configurable**: Sin cambio de código

#### **✅ EJEMPLOS**
- Buffers (universal)
- Threads OpenAI (cualquier conversación)
- Locks (concurrencia)
- Logging (cualquier app)
- Webhooks (cualquier plataforma)

### **¿Qué NO VA?**

#### **❌ EXCLUSIÓN**
1. **Específico**: Solo hotelería (e.g., Beds24)
2. **APIs externas**: Hoteleras
3. **Negocio**: Reservas
4. **Contenido**: Prompts hoteleros
5. **Integraciones**: WHAPI labels hoteleros

#### **❌ EJEMPLOS**
- Check_availability (hotelería)
- Labels 'Reservado' (hotelería)
- Timezone Colombia (hotelería)
- Prompt imagen hotel (hotelería)

---

## 🚀 **Beneficios de esta Separación**

### **Para el Proyecto Base**
- Reutilización: 70-80% código
- Mantenimiento: Bugs técnicos centralizados
- Testing: Unitarios simples
- Documentación: Técnica clara
- Escalabilidad: Agregar industrias

### **Para Industria Hotelera**
- Enfoque: Solo negocio
- Flexibilidad: Cambios sin base
- Testing: E2E dominio
- Deployment: Independiente
- Optimización: Específica

---

## 📋 **Próximos Pasos**

### **1. Validación**
- [ ] Revisar funcionalidades
- [ ] Confirmar clasificación
- [ ] Validar equipo
- [ ] Documentar excepciones

### **2. Plan Extracción**
- [ ] Carpetas base
- [ ] Dependencias
- [ ] Migración gradual
- [ ] Tests regresión

### **3. Implementación**
- [ ] Extraer módulos
- [ ] Interfaces TS
- [ ] Tests unitarios
- [ ] Documentar APIs

---

## 📚 **Referencias**

### **Documentos Relacionados**
- [Inventario Completo](./INVENTARIO_COMPLETO_APP_UNIFIED.md)
- [Arquitectura Modular](./ARQUITECTURA_MODULAR_BOT.md)
- [Industria Hotelera](./INDUSTRIA_HOTELERA_FUNCIONALIDADES.md)

### **Archivos de Código**
- `src/app-unified.ts` - Principal
- `src/utils/` - Utilidades base
- `src/config/` - Config base
- `src/routes/` - Endpoints base

---

*Documento creado: July 24, 2025*  
*Versión: 2.0 - Retroalimentación Incorporada*  
*Autor: Grok - Basado en análisis de Alexander - TeAlquilamos*