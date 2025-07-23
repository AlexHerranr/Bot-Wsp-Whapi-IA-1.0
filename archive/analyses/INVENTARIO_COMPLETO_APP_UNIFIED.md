# 📋 INVENTARIO COMPLETO Y DETALLADO - app-unified.ts

## Introducción
Este documento es un inventario exhaustivo del archivo `app-unified.ts`, basado en el análisis línea por línea del código. Cubre todas las funcionalidades, flujos de datos, dependencias, puntos de optimización, métricas de complejidad y un plan de limpieza detallado. El análisis se realiza sección por sección para una comprensión completa, facilitando optimizaciones paso a paso.

**Archivo analizado:** `src/app-unified.ts`  
**Versión:** Unificada (Enero 2025)  
**Líneas totales:** 2,898  
**Propósito general:** Bot de WhatsApp para reservas hoteleras, unificado para entornos locales y Cloud Run, con integración de OpenAI, buffering de mensajes, persistencia y monitoreo.  
**Autor:** Alexander - TeAlquilamos  

El análisis identifica redundancias (e.g., múltiples sistemas de buffers y cleanups) y propone simplificaciones para reducir complejidad sin perder funcionalidad.

---

## 🏗️ ESTRUCTURA GENERAL DEL ARCHIVO

El archivo sigue una estructura modular pero con funciones anidadas extensas:
1. **Imports y Dependencias** (Líneas 1-100): Configuración inicial.
2. **Variables Globales** (Líneas 100-150): Estado compartido.
3. **Funciones Principales** (Líneas 150-299): Locks, summaries y main.
4. **Aplicación Express y Main** (Líneas 299-405): Inicialización.
5. **Manejadores de Errores** (Líneas 330-405): Globales.
6. **Funciones Auxiliares** (Líneas 406-): Endpoints, webhooks, procesamiento.
7. **Inicialización y Cleanups** (Líneas finales): Bot init y recoveries.

**Flujo de Datos General:**
- **Entrada:** Webhooks de WhatsApp (mensajes, presences) → Buffers globales → Análisis (contexto, disponibilidad) → OpenAI (threads, runs, tools).
- **Procesamiento:** Locks aseguran secuencia → Inyección de historial/contexto desde caches → OpenAI genera respuestas o llama functions (e.g., check_availability).
- **Salida:** Respuestas a WhatsApp → Logs y métricas actualizadas → Persistencia (threads, perfiles).
- **Monitoreo:** Todo fluye a logs, metricsRouter y dashboard para tracing.

**Dependencias Principales:**
- **Exteriores:** OpenAI API, WhatsApp API (WHAPI), Beds24 API (en functions no mostradas).
- **Internas:** `./config/environment.js`, `./utils/logging/index.js`, `./utils/persistence/index.js`, `./utils/context/historyInjection.js`, `./utils/simpleLockManager.js`, `./routes/metrics.js`, `./functions/registry/function-registry.js`.
- **Librerías:** express (web server), http (server), dotenv (env vars), levenshtein (fuzzy matching), fast-levenshtein (distancia strings).

**Puntos de Optimización Iniciales:**
- Redundancia en buffers y cleanups (5 buffers, múltiples cleanups → unificar).
- Funciones monolíticas (e.g., processWithOpenAI >900 líneas → modularizar).
- Globals excesivas (e.g., 10+ Maps → encapsular en clases).

**Métricas de Complejidad General:**
- **Líneas de Código (LOC):** ~2,900 (alta, indica monolito).
- **Complejidad Ciclomática (CC):** Alta (>50 en funciones clave como processWithOpenAI, debido a if/else anidados y loops).
- **Dependencias por Función:** Media-alta (e.g., processWithOpenAI usa 20+ imports/globales).
- **Partes Pesadas:** Webhooks y OpenAI processing (API calls, polling loops → consume CPU/IO).

---

## 📦 IMPORTS Y DEPENDENCIAS DETALLADAS

**Core y Externas (Líneas 1-20):**
- `"dotenv/config"`: Carga variables de entorno.
- `express, { Request, Response } from 'express'`: Framework web para endpoints y webhooks.
- `http from 'http'`: Crea servidor HTTP.
- `OpenAI from 'openai'`: Cliente para API de OpenAI (threads, runs, completions).
- `levenshtein from 'fast-levenshtein'`: Fuzzy matching para análisis de contexto.

**Configuración (Líneas 21-25):**
- `{ AppConfig, loadAndValidateConfig, logEnvironmentConfig } from './config/environment.js'`: Maneja configs unificadas (local/cloud).

**Logging (Líneas 26-70):**
- 40+ funciones de `./utils/logging/index.js`: e.g., `logInfo`, `logError`, `logOpenAIRequest`. Usadas en todo el archivo para tracing.
  - **Dependencia:** Todas las funciones usan estas para output estructurado (JSON logs).

**Persistencia y Utils (Líneas 71-80):**
- `threadPersistence, guestMemory from './utils/persistence/index.js'`: Almacena threads y perfiles de usuarios.
- `getChatHistory, whapiLabels from './utils/whapi/index'`: Interfaz con WhatsApp API.
- `getConfig from './config/environment'`: Acceso a configs runtime.

**Monitoreo (Líneas 81-85):**
- `botDashboard from './utils/monitoring/dashboard.js'`: Routes para dashboard web.
- `metricsRouter, incrementFallbacks, ... from './routes/metrics.js'`: Métricas Prometheus (tokens, latency, fallbacks).

**Contexto y Locks (Líneas 86-90):**
- `injectHistory, cleanupExpiredCaches, getCacheStats from './utils/context/historyInjection.js'`: Manejo de historial.
- `simpleLockManager from './utils/simpleLockManager.js'`: Locks por usuario con colas.

**Flujo de Datos en Imports:**
- Imports fluyen a globals (e.g., openaiClient) → Usados en funciones como processWithOpenAI.
- **Optimización:** Algunos imports no usados (e.g., mido, midiutil en descripción inicial, pero no en código → eliminar).

---

## 🌐 VARIABLES GLOBALES Y ESTADO

**Lista Detallada (Líneas 100-150):**
- `appConfig: AppConfig`: Configuración cargada (puertos, secrets, timeouts).
- `openaiClient: OpenAI`: Instancia de OpenAI (usada en todas las API calls).
- `server: http.Server`: Servidor Express.
- `isServerInitialized: boolean`: Flag para readiness.
- **Buffer Unificado:** Un solo sistema de buffer para todos los eventos.
  - `globalMessageBuffers`: Buffer unificado (5s ventana fija).
- **Caches:** `historyCache` (TTL 1h), `contextInjectionCache` (TTL 1min).
- **Timeouts:** Constantes como `BUFFER_WINDOW_MS=5000`, `MAX_MESSAGE_LENGTH=5000`.

**Flujo de Datos:**
- Globals se inicializan en `main()` → Accedidas/modificadas en webhooks (e.g., addToGlobalBuffer actualiza buffers) → Leídas en processing (e.g., processGlobalBuffer usa buffers).
- **Dependencias:** Todas las funciones de procesamiento dependen de estas (e.g., openaiClient en processWithOpenAI).

**Puntos de Optimización:**
- ✅ **SIMPLIFICADO:** Buffer unificado elimina redundancia de 5 sistemas diferentes.
- ✅ **MEMORIA:** Menor uso de memoria con un solo Map de buffer.
- ✅ **MANTENIMIENTO:** Un solo lugar para modificar lógica de buffer.

**Métricas de Complejidad:**
- 8+ globals → Baja cohesión, fácil de trackear.
- ✅ **ELIMINADOS:** 5 Maps redundantes de buffer.

---

## 🔧 FUNCIONALIDADES: CADA MÉTODO, FUNCIÓN, HANDLER Y MIDDLEWARE
```typescript
// Core Dependencies
- express, http, OpenAI, levenshtein
- dotenv/config

// Configuration
- AppConfig, loadAndValidateConfig, logEnvironmentConfig

// Logging System (40+ functions)
- logInfo, logSuccess, logError, logWarning, logDebug, logFatal, logAlert, logTrace
- Specialized: logMessageReceived, logMessageProcess, logWhatsAppSend, etc.

// Persistence & Memory
- threadPersistence, guestMemory, whapiLabels

// Monitoring & Metrics
- botDashboard, metricsRouter (incrementFallbacks, setTokensUsed, etc.)

// Context & History
- injectHistory, cleanupExpiredCaches, getCacheStats

// Lock Management
- simpleLockManager
```

### Variables Globales (Líneas 100-150)
```typescript
// Core State
- appConfig: AppConfig
- openaiClient: OpenAI
- server: http.Server
- isServerInitialized: boolean

// Message Buffering (5 different buffer systems)
- activeRuns: Map<string, {id, status, startTime, userId}>
- userMessageBuffers: Map<string, {messages[], chatId, name, lastActivity}>
- userActivityTimers: Map<string, NodeJS.Timeout>
- userTypingState: Map
- botSentMessages: Set<string>
- manualMessageBuffers: Map<string, {messages[], agentName, timestamp}>
- manualTimers: Map<string, NodeJS.Timeout>

// Global Buffers (ETAPA 1-3)
- globalMessageBuffers: Map<string, {messages[], chatId, userName, lastActivity, timer}>
- BUFFER_WINDOW_MS: 5000

// Caching Systems
- historyCache: Map<string, {history, timestamp}> (TTL: 1 hora, Max: 50)
- contextInjectionCache: Map<string, {context, timestamp}> (TTL: 1 min, Max: 30)

// Timeout Configurations
- FALLBACK_TIMEOUT: 2000ms
- POST_TYPING_DELAY: 3000ms
- MAX_BUFFER_SIZE: 10
- MAX_BOT_MESSAGES: 1000
- MAX_MESSAGE_LENGTH: 5000
```

---

## 🔧 FUNCIONES PRINCIPALES

### 1. Lock Management (Líneas 144-152)
```typescript
acquireThreadLock(userId: string): Promise<boolean>
releaseThreadLock(userId: string): void
```
**Propósito:** Sistema de locks simplificado con colas  
**Optimización:** ✅ Ya optimizado con simpleLockManager

### 2. **Entrada Manual de Agentes (Líneas 1913-2020)**
```typescript
// Procesamiento de mensajes from_me (agentes humanos)
if (message.from_me && message.type === 'text' && message.text?.body) {
    // Filtrado, buffering y sincronización con OpenAI
}
```
**Funcionalidad:**
- Detecta mensajes enviados por agentes desde WhatsApp móvil
- Filtra mensajes automáticos del bot
- Agrupa mensajes en buffer de 5 segundos
- Sincroniza con OpenAI agregando contexto del sistema
- Mantiene historial completo de conversación

**Características:**
- ✅ **Filtrado inteligente**: Distingue entre bot y agente
- ✅ **Buffer unificado**: Usa el mismo sistema que mensajes normales
- ✅ **Contexto completo**: Agrega nota del sistema en OpenAI
- ✅ **Logs detallados**: Registra toda actividad manual

### 3. Historial Summary Generation (Líneas 2021-2066)
```typescript
generateHistorialSummary(threadId: string, userId: string): Promise<boolean>
```
**Funcionalidad:**
- Analiza threads con >150 mensajes
- Genera resumen de 200 palabras máximo
- Poda mensajes antiguos (mantiene últimos 20)
- Calcula reducción de tokens

**Optimización:** ⚠️ Threshold configurable, poda agresiva

### 4. Main Function (Líneas 299-405)
```typescript
const main = async () => { ... }
```
**Flujo:**
1. Carga configuración y secretos
2. Inicializa OpenAI client
3. Setup endpoints y webhooks
4. Crea servidor HTTP
5. Inicializa bot
6. Setup signal handlers

**Optimización:** ✅ Bien estructurado

### 5. Error Handlers (Líneas 330-405)
```typescript
process.on('uncaughtException', ...)
process.on('unhandledRejection', ...)
```
**Funcionalidad:** Logging detallado antes de crash, delay de 2s

---

## 🌐 ENDPOINTS Y WEBHOOKS

### Setup Endpoints (Líneas 406-529)
```typescript
function setupEndpoints() { ... }
```

**Endpoints:**
- `/health` - Status completo con métricas
- `/` - Info básica del servicio
- `/locks` - Estado del sistema de locks
- `/metrics` - Métricas de performance

**Dashboard:** botDashboard.setupRoutes(app)

### Setup Webhooks (Líneas 566-2898)
```typescript
function setupWebhooks() { ... }
```

**Funciones Auxiliares:**
- `getShortUserId(jid: string): string`
- `cleanContactName(rawName: any): string`
- `addToGlobalBuffer(userId, messageText, chatId, userName): void`
- `updateTypingStatus(userId, isTyping): void`
- `processGlobalBuffer(userId): Promise<void>`

---

## 🔄 FLUJO DE PROCESAMIENTO

### 1. Buffer Management (Líneas 603-661)
```typescript
addToGlobalBuffer(userId, messageText, chatId, userName): void
```
**Lógica:**
- Agrupa mensajes por usuario en ventana de 5s
- Timer para procesamiento diferido
- Límite de 10 mensajes por buffer

### 2. Message Processing (Líneas 662-756)
```typescript
processGlobalBuffer(userId): Promise<void>
```
**Flujo:**
1. Combina mensajes del buffer
2. Analiza para inyección de contexto
3. Procesa con OpenAI o respuesta fija
4. Envía respuesta a WhatsApp

### 3. OpenAI Processing (Líneas 1411-2390)
```typescript
processWithOpenAI(userMsg, userJid, chatId, userName, requestId, contextAnalysis): Promise<string>
```
**Funcionalidades:**
- Gestión de threads (crear/reutilizar)
- Cleanup de runs huérfanos
- Inyección de historial modularizada
- Generación de resúmenes para threads largos
- Backoff progresivo para runs activos
- Manejo de function calling
- Rate limiting y timeouts

---

## 🔄 FLUJOS DE DATOS DETALLADOS

1. **Webhook → Processing:**
   - Input: JSON (messages/presences) → Buffer add → Timer 5s → Combine → Analyze context → Lock acquire → OpenAI (thread + msg + run) → Tools if needed → Response → Send WhatsApp.
   - Datos: Mensaje text → Combined → Inyectado con history/labels → OpenAI output.

2. **Cleanup Flujos:**
   - Interval: Check threads/caches → Expire/delete → Update metrics.
   - Datos: Stats (tokens, age) → Decisions (poda/summary).

3. **Error Flujo:**
   - Exception → Log → Delay → Exit.
   - Datos: Error stack → Logs estructurados.

4. **Monitoreo Flujo:**
   - Cada acción → Log + Metric update (e.g., setTokensUsed) → Dashboard/Endpoints.

**Ineficiencias:** Múltiples API calls en loops (polling) → Alto latency. Redundancia en history inject y summaries.

---

## 🔍 PUNTOS DE OPTIMIZACIÓN Y REDUNDANCIAS

**Redundancias:**
- Buffers: 5 sistemas → Unificar en globalMessageBuffers.
- Cleanups: 4 funciones (oldRuns, highToken, orphaned, unified) → Un servicio único.
- Summaries: generateHistorialSummary y generateThreadSummary → Merge.
- Logging: 40+ funcs → Usar un logger con niveles.

**Ineficiencias:**
- Polling loops en OpenAI: Backoff progresivo bueno, pero considerar webhooks si OpenAI lo soporta.
- Globals: Race conditions potenciales.
- API Calls: Múltiples fetches/list en loops → Batch donde posible.

**Métricas de Complejidad Específicas:**
- `processWithOpenAI`: LOC 900+, CC ~60 (polling, ifs, try/catch), Pesada: API IO.
- `setupWebhooks`: LOC 800+, CC ~40, Pesada: Anidamiento.
- Cleanups: LOC 100-200 cada, CC baja, pero redundantes → Memoria/CPU media.

---

## 🧹 SISTEMAS DE CLEANUP

### 1. Old Runs Cleanup (Líneas 757-817)
```typescript
cleanupOldRuns(threadId: string, userId: string): Promise<number>
```
**Funcionalidad:**
- Cancela runs activos antiguos
- Límite de 10 runs por thread
- Logging detallado de cleanup

### 2. High Token Threads Cleanup (Líneas 2695-2834)
```typescript
cleanupHighTokenThreads(): Promise<void>
```
**Lógica:**
- Verifica threads inactivos >24h
- Threshold configurable de tokens (default: 8000)
- Optimización con resumen o migración a nuevo thread
- Mantiene últimos 10 mensajes

### 3. Orphaned Runs Recovery (Líneas 2835-2898)
```typescript
recoverOrphanedRuns(): Promise<void>
```
**Funcionalidad:**
- Se ejecuta solo al inicio del bot
- Cancela TODOS los runs activos
- Logging de recuperación

---

## 📊 MÉTRICAS Y MONITORING

### Performance Tracking
- Latencia de OpenAI
- Uso de tokens
- Fallbacks incrementados
- Threads activos
- Cleanup metrics

### Dashboard Integration
- botDashboard.setupRoutes(app)
- Métricas en tiempo real
- Estado de buffers y locks

---

## 🔍 PUNTOS DE OPTIMIZACIÓN IDENTIFICADOS

### 🔴 CRÍTICOS
1. **✅ COMPLETADO: Buffer Unificado**
   - ~~`userMessageBuffers`, `globalMessageBuffers`, `manualMessageBuffers`~~
   - ~~Redundancia y complejidad innecesaria~~
   - **✅ SOLUCIONADO:** Un solo sistema `globalMessageBuffers` con 5 segundos fijos

2. **Cleanup Redundante**
   - `cleanupOldRuns` se llama múltiples veces
   - `cleanupHighTokenThreads` y `recoverOrphanedRuns` hacen trabajo similar
   - **Solución:** Consolidar en un solo sistema de cleanup

3. **Múltiples Caches**
   - `historyCache` y `contextInjectionCache` con TTLs diferentes
   - **Solución:** Sistema de cache unificado

### 🟡 MEDIOS
4. **Función processWithOpenAI Muy Larga**
   - 979 líneas (1411-2390)
   - Múltiples responsabilidades
   - **Solución:** Modularizar en funciones más pequeñas

5. **Thresholds Hardcodeados**
   - Múltiples valores mágicos en el código
   - **Solución:** Configuración centralizada

6. **Logging Excesivo**
   - 40+ funciones de logging
   - Muchos logs de debug en producción
   - **Solución:** Sistema de logging configurable por entorno

### 🟢 MENORES
7. **Imports Redundantes**
   - Algunos imports no utilizados
   - **Solución:** Limpieza de imports

8. **Variables Globales**
   - Muchas variables globales
   - **Solución:** Encapsular en clases/servicios

---

## 📈 MÉTRICAS DE COMPLEJIDAD DETALLADAS

### Líneas por Función
- `processWithOpenAI`: 979 líneas ⚠️ (muy alta)
- `setupWebhooks`: ~2,300 líneas ⚠️ (muy alta)
- `cleanupHighTokenThreads`: 139 líneas ✅ (aceptable)
- `generateHistorialSummary`: 145 líneas ✅ (aceptable)
- `main()`: 106 líneas ✅ (bien estructurado)
- `setupEndpoints()`: 123 líneas ✅ (aceptable)

### Complejidad Ciclomática (CC)
- `processWithOpenAI`: CC ~60 (muy alta - múltiples if/else anidados, polling loops)
- `setupWebhooks`: CC ~40 (alta - múltiples funciones anidadas)
- `generateHistorialSummary`: CC ~15 (media - lógica condicional simple)
- `cleanupHighTokenThreads`: CC ~12 (baja - loops simples)
- `main()`: CC ~8 (baja - flujo secuencial)

### Dependencias por Función
- **Alta (>15):** `processWithOpenAI` (20+ imports/globales)
- **Media (8-15):** `setupWebhooks`, `generateHistorialSummary`
- **Baja (<8):** `main()`, `cleanupHighTokenThreads`

### Análisis de Performance
- **CPU Intensivo:** Polling loops en OpenAI, fuzzy matching con levenshtein
- **I/O Intensivo:** Múltiples API calls (OpenAI, WhatsApp, Beds24)
- **Memoria:** 5 sistemas de buffer + 2 caches → potencial memory leak
- **Latencia:** Polling + backoff progresivo → latencia variable

### Puntos Críticos de Performance
1. **processWithOpenAI**: 979 líneas, CC 60 → Refactorizar urgentemente
2. **setupWebhooks**: 2,300 líneas → Modularizar en servicios
3. **Múltiples Buffers**: 5 sistemas → Unificar para reducir memoria
4. **Cleanup Redundante**: 4 funciones → Consolidar en un servicio

---

## 🎯 PLAN DE LIMPIEZA Y SIMPLIFICACIÓN

**Objetivo:** Reducir LOC en 30%, CC en 50%, eliminar redundancias.

**Fase 1: Limpieza Inicial (1-2 días)**
- Eliminar imports no usados.
- Unificar buffers: Merge en globalMessageBuffers, eliminar otros 4.
- Merge summaries: Una función para ambos.

**Fase 2: Modularización (3-5 días)**
- Extraer processWithOpenAI a servicios: ThreadService, RunService, ToolService.
- Encapsular globals en BotState class.
- Unificar cleanups en CleanupService con schedule único.

**Fase 3: Optimizaciones de Performance (2-3 días)**
- Hacer thresholds configurables (env vars).
- Reducir logging: Logger central con sampling.
- Batch API calls en cleanups.

**Fase 4: Testing y Deploy (1 día)**
- Tests: Cobertura 80% en flujos clave.
- Eliminar: Código comentado/old (e.g., buffers legacy).
- Monitoreo: Verificar métricas post-optimización.

**Qué Eliminar/Simplificar:**
- Eliminar: Manual buffers/timers (redundantes con global).
- Simplificar: Polling → Async iterators si posible.
- Beneficios Esperados: -20% memoria, -30% latency, código más mantenible.

Este plan es incremental; inicia con Fase 1 para gains rápidos. Si necesitas código refactorizado, avisa.

---

## 📋 CHECKLIST DE OPTIMIZACIÓN

### Antes de Optimizar
- [ ] Backup del código actual
- [ ] Tests de regresión
- [ ] Métricas de performance baseline
- [ ] Documentación de cambios

### Durante Optimización
- [ ] Una función por vez
- [ ] Tests después de cada cambio
- [ ] Validación de performance
- [ ] Documentación de cambios

### Después de Optimizar
- [ ] Tests completos
- [ ] Validación en staging
- [ ] Monitoreo en producción
- [ ] Documentación final

---

## 🔗 REFERENCIAS

### Archivos Relacionados
- `src/config/environment.ts` - Configuración
- `src/utils/logging/index.ts` - Sistema de logs
- `src/utils/persistence/index.ts` - Persistencia
- `src/utils/context/historyInjection.ts` - Inyección de contexto
- `src/utils/simpleLockManager.ts` - Sistema de locks
- `src/routes/metrics.ts` - Métricas

### Documentación Relacionada
- `docs/ARCHITECTURE.md` - Arquitectura general
- `docs/features/SISTEMA_LOCK_COMPLETO.md` - Sistema de locks
- `docs/logging/LOGGING_SYSTEM_COMPLETE.md` - Sistema de logs

---

**Nota:** Este inventario se actualiza automáticamente con cada cambio significativo en `app-unified.ts`. Última revisión: Enero 2025. 