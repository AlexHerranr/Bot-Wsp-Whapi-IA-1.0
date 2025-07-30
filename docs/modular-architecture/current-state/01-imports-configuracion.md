# 1. Imports y Configuración Inicial

> **Introducción**: Este documento detalla los imports, configuración inicial y variables globales críticas del sistema monolítico. Basado en el análisis completo del CURRENT_STATE.md, documenta las 26+ variables globales, el sistema de logging con 21 métodos, estructuras de datos en memoria (buffers, caches, estados), y los riesgos de memory leaks identificados. Incluye todas las dependencias externas, interfaces WHAPI, y la preparación necesaria para la migración modular.

## Ubicación en el Código
**Líneas**: ~1-150 del archivo `app-unified.ts`

## Imports Principales

### Core Dependencies
```typescript
import "dotenv/config"; // Configuración de entorno
import express, { Request, Response } from 'express'; // Servidor web
import http from 'http'; // Creación de servidor HTTP
import OpenAI from 'openai'; // Cliente OpenAI para Assistant API, TTS, Whisper
```

### Utilidades y Bibliotecas
```typescript
import levenshtein from 'fast-levenshtein'; // Distancia de strings (usado en validateAndCorrectResponse)
import path from 'path'; // Manejo de rutas de archivos (temp audio)
import fs from 'fs/promises'; // Operaciones asíncronas de archivos (audio temporal)
```

### Configuración y Entorno
```typescript
import { AppConfig, loadAndValidateConfig, logEnvironmentConfig } from './config/environment.js';
import { getConfig } from './config/environment'; // Uso puntual pendiente de refactorización
```

### Sistema de Logging (21 funciones)
```typescript
import {
    logInfo, logSuccess, logError, logWarning, logDebug, logFatal, logAlert,
    // Obsoletos comentados pero importados:
    logMessageReceived, logOpenAIRequest, logOpenAIResponse,
    logFunctionCallingStart, logFunctionExecuting, logFunctionHandler,
    logThreadCreated, logServerStart, logOpenAIUsage, logOpenAILatency,
    logFallbackTriggered, logPerformanceMetrics,
    // Nuevas funciones de tracing:
    logRequestTracing, logToolOutputsSubmitted, logAssistantNoResponse,
    startRequestTracing, updateRequestStage, registerToolCall,
    updateToolCallStatus, endRequestTracing
} from './utils/logging/index.js';
```
**Nota**: Las funciones obsoletas (e.g., logMessageReceived) están comentadas en el código pero importadas para registro histórico; no se usan activamente.

### Persistencia y Memoria
```typescript
import { threadPersistence } from './utils/persistence/index.js';
import { guestMemory } from './utils/persistence/index.js'; // Obsoleto pero importado
```

### APIs y Utilidades Externas
```typescript
import { whapiLabels } from './utils/whapi/index.js';
import type { UserState } from './utils/userStateManager.js';
import { botDashboard } from './utils/monitoring/dashboard.js';
import { validateAndCorrectResponse } from './utils/response-validator.js';
```

### Métricas y Routing
```typescript
import metricsRouter, { 
    incrementFallbacks, 
    setTokensUsed, 
    setLatency, 
    incrementMessages 
} from './routes/metrics.js';
```

### Context y Caches
```typescript
import { cleanupExpiredCaches, getCacheStats } from './utils/context/historyInjection.js';
```

### Sistema de Locks
```typescript
import { simpleLockManager } from './utils/simpleLockManager.js';
```

### Function Registry (Importación Dinámica)
```typescript
// Comentado - Se importa dinámicamente en processWithOpenAI:
// import { executeFunction } from './functions/registry/function-registry.js';
// Se importa con: const { executeFunction } = await import('./functions/registry/function-registry.js');
```

### Imports Dinámicos
```typescript
// Dentro de transcribeAudio (línea ~800+):
const audioStream = (await import('fs')).createReadStream(tempAudioPath); // Stream para archivos en Node.js
```
**Descripción**: Usado para compatibilidad con entornos como Railway, evita import estático innecesario.

## Sistema de Logging Terminal (`terminalLog`)

### Descripción
Objeto global con 21 métodos para logs limpios en terminal y dashboard. Centraliza toda la salida visual del bot.

### Implementación Completa
```typescript
const terminalLog = {
    // Logs principales con formato limpio
    message: (user: string, text: string) => {
        const logMsg = `👤 ${user}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}}"`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    typing: (user: string) => console.log(`✍️ ${user} está escribiendo...`),
    processing: (user: string) => {}, // Eliminado - no mostrar en terminal
    response: (user: string, text: string, duration: number) => {
        const logMsg = `🤖 OpenAI → ${user} (${(duration/1000).toFixed(1)}s)`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    
    // Logs de errores
    error: (message: string) => console.log(`❌ Error: ${message}`),
    openaiError: (user: string, error: string) => console.log(`❌ Error enviar a OpenAI → ${user}: ${error}`),
    imageError: (user: string, error: string) => console.log(`❌ Error al procesar imagen → ${user}: ${error}`),
    voiceError: (user: string, error: string) => console.log(`❌ Error al procesar audio → ${user}: ${error}`),
    functionError: (functionName: string, error: string) => console.log(`❌ Error en función ${functionName}: ${error}`),
    whapiError: (operation: string, error: string) => console.log(`❌ Error WHAPI (${operation}): ${error}`),
    
    // Logs de funciones
    functionStart: (name: string, args?: any) => {
        if (name === 'check_availability' && args) {
            const { startDate, endDate } = args;
            const start = startDate?.split('-').slice(1).join('/'); // MM/DD
            const end = endDate?.split('-').slice(1).join('/');     // MM/DD
            const nights = args.endDate && args.startDate ? 
                Math.round((new Date(args.endDate).getTime() - new Date(args.startDate).getTime()) / (1000 * 60 * 60 * 24)) : '?';
            console.log(`⚙️ check_availability(${start}-${end}, ${nights} noches)`);
        } else {
            console.log(`⚙️ ${name}()`);
        }
    },
    functionProgress: (name: string, step: string, data?: any) => {}, // Eliminado - logs redundantes
    functionCompleted: (name: string, result?: any, duration?: number) => {}, // Se maneja en availabilityResult
    
    // Nota: functionProgress y functionCompleted están vacíos/eliminados en el código para reducir redundancia, pero se mantienen como placeholders.
    
    // Logs de sistema
    startup: () => {
        console.clear();
        console.log('\n=== Bot TeAlquilamos Iniciado ===');
        console.log(`🚀 Servidor: ${appConfig?.host || 'localhost'}:${appConfig?.port || 3008}`);
        console.log(`🔗 Webhook: ${appConfig?.webhookUrl || 'configurando...'}`);
        console.log('✅ Sistema listo\n');
    },
    newConversation: (user: string) => console.log(`\n📨 Nueva conversación con ${user}`),
    
    // Logs de media
    image: (user: string) => console.log(`📷 ${user}: [Imagen recibida]`),
    voice: (user: string) => {
        const logMsg = `🎤 ${user}: [Nota de voz recibida]`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    recording: (user: string) => console.log(`🎙️ ${user} está grabando...`),
    
    // Logs de resultados
    availabilityResult: (completas: number, splits: number, duration?: number) => {
        const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : '';
        const logMsg = `🏠 ${completas} completa${completas !== 1 ? 's' : ''} + ${splits} alternativa${splits !== 1 ? 's' : ''}${durationStr}`;
        console.log(logMsg);
        botDashboard.addLog(logMsg);
    },
    
    // Logs de APIs externas
    externalApi: (service: string, action: string, result?: string) => {
        const timestamp = new Date().toLocaleTimeString();
        if (result) {
            console.log(`🔗 [${timestamp}] ${service} → ${action} → ${result}`);
        } else {
            console.log(`🔗 [${timestamp}] ${service} → ${action}...`);
        }
    },
    
};
```

## Rate Limiting y Control

### Variables de Control
```typescript
// Rate limiting y control
const webhookCounts = new Map<string, { lastLog: number; count: number }>(); // Rate limiting logs webhooks
const typingLogTimestamps = new Map<string, number>(); // Rate limiting typing logs (5s)

// Control de configuración
const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false'; // Logs functions en terminal
```

### Rate Limiting Manual Implementado
```typescript
// Rate limiting manual para logs (no usa paquetes externos)
// webhookCounts: Limita logs de webhooks inválidos (1/minuto).
// typingLogTimestamps: Limita logs de typing (cada 5s).
```

### Estados y Procesamiento
```typescript
// Estados y procesamiento
const activeProcessing = new Set<string>(); // Usuarios en procesamiento activo

// Control de retries y validación
const userRetryState = new Map<string, { retryCount: number; lastRetryTime: number }>(); // Control retries (evitar loops)
// Cooldown: 5 minutos, Límite: 1 retry por usuario

```

## Buffer Unificado de Mensajes

### Estructura del Buffer Global
```typescript
// Buffer unificado de mensajes
const globalMessageBuffers = new Map<string, {
    messages: string[],
    chatId: string,
    userName: string,
    lastActivity: number,
    timer: NodeJS.Timeout | null,
    currentDelay?: number // Delay actual del timer para comparaciones
}>();

// Constantes de tiempo para buffers
const BUFFER_WINDOW_MS = 5000; // 5 segundos para agrupar mensajes normales
const TYPING_EXTENDED_MS = 10000; // 10 segundos cuando usuario está escribiendo/grabando
```

### Media y Mensajes
```typescript
// Media y mensajes
const pendingImages = new Map<string, string[]>(); // URLs imágenes pendientes por usuario
const botSentMessages = new Set<string>(); // IDs de mensajes enviados por bot (evitar self-loops)
const globalUserStates = new Map<string, UserState>(); // Estados de usuario completos

// Constantes
const MAX_MESSAGE_LENGTH = 5000; // Límite longitud mensajes
```

## Caches con TTLs

### Chat Info Cache (Estructura con Timestamp)
```typescript
const chatInfoCache = new Map<string, { data: any; timestamp: number }>(); // Cache info chats
const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
```

### Context Cache (Estructura con Timestamp)
```typescript
const contextCache = new Map<string, { context: string, timestamp: number }>(); // Cache contexto temporal
const CONTEXT_CACHE_TTL = 60 * 60 * 1000; // 1 hora
```

## Interfaces WHAPI

### Definiciones de Tipos
```typescript
// Tipos para WHAPI
interface WHAPIMediaLink {
    link?: string;
    id?: string;
    mime_type?: string;
    file_size?: number;
}

interface WHAPIMessage {
    id: string;
    type: string;
    audio?: WHAPIMediaLink;
    voice?: WHAPIMediaLink;
    ptt?: WHAPIMediaLink;
    image?: WHAPIMediaLink;
}

interface WHAPIError {
    error?: {
        code: number;
        message: string;
        details?: string;
    };
}
```

## Configuración de Entorno

### Proceso de Carga
1. **dotenv/config**: Carga variables de `.env`
2. **loadAndValidateConfig()**: Valida y estructura configuración
3. **logEnvironmentConfig()**: Registra configuración cargada

### Variables Críticas Verificadas
- `OPENAI_ASSISTANT_ID`
- `WHAPI_TOKEN`
- `BEDS24_PROP_ID`
- `ENABLE_VOICE_RESPONSES`
- `ENABLE_TRANSCRIPTIONS`

**Nota**: getConfig: Uso puntual pendiente de refactorización. El método preferido es loadAndValidateConfig para unificación local/cloud.

## Análisis de Dependencias

### Dependencias Críticas
| Paquete | Versión | Uso | Criticidad |
|---------|---------|-----|------------|
| `openai` | Última | API OpenAI (Assistant, TTS, Whisper) | Alta |
| `express` | Estable | Servidor HTTP | Alta |
| `dotenv` | Estable | Variables de entorno | Alta |
| `fast-levenshtein` | Estable | Validación de respuestas | Media |
| `fs/promises` | Estable | Operaciones asíncronas de archivos (e.g., audio temporal en /tmp/) | Alta (media handling) |
| `path` | Estable | Manejo de rutas para archivos temporales | Media |

### Dependencias Modulares Preparadas
- `./config/environment.js`: Configuración centralizada
- `./utils/logging/index.js`: Sistema de logging modular
- `./utils/persistence/index.js`: Persistencia modular
- `./utils/simpleLockManager.js`: Sistema de locks independiente

## Variables Globales Críticas

### Resumen de Todas las Variables
```typescript
// Configuración principal
let appConfig: AppConfig;
let openaiClient: OpenAI;
let server: http.Server;
let isServerInitialized = false;

// Rate limiting y control
const webhookCounts = new Map<string, { lastLog: number; count: number }>();
const typingLogTimestamps = new Map<string, number>();
const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false';

// Estados y procesamiento
const activeProcessing = new Set<string>();
const userRetryState = new Map<string, { retryCount: number; lastRetryTime: number }>();

// Buffer unificado
const globalMessageBuffers = new Map<string, {
    messages: string[];
    chatId: string;
    userName: string;
    lastActivity: number;
    timer: NodeJS.Timeout | null;
    currentDelay?: number;
}>();
const BUFFER_WINDOW_MS = 5000;
const TYPING_EXTENDED_MS = 10000;

// Media y mensajes
const pendingImages = new Map<string, string[]>();
const botSentMessages = new Set<string>();
const globalUserStates = new Map<string, UserState>();
const MAX_MESSAGE_LENGTH = 5000;

// Caches con TTL
const chatInfoCache = new Map<string, { data: any; timestamp: number }>();
const CHAT_INFO_CACHE_TTL = 5 * 60 * 1000;
const contextCache = new Map<string, { context: string, timestamp: number }>();
const CONTEXT_CACHE_TTL = 60 * 60 * 1000;

// Sistema de logging
const terminalLog = { /* 21 métodos definidos arriba */ };

// Cache pre-computado para contexto base
let precomputedContextBase: { date: string; time: string; timestamp: number } | null = null;
const CONTEXT_BASE_CACHE_TTL = 60 * 1000; // 1 minuto
```

## Riesgos Identificados

### Imports Obsoletos
- `guestMemory`: Importado pero no usado activamente  
- Funciones de logging obsoletas: Importadas pero comentadas
- `getConfig`: **Uso puntual pendiente de refactorización**. El método preferido es `loadAndValidateConfig`.

### Memory Leaks Potenciales
- **globalMessageBuffers**: Timers no cancelados en race conditions
- **contextCache/chatInfoCache**: Crecimiento sin límite máximo
- **globalUserStates**: Cleanup cada hora pero puede acumular
- **pendingImages**: Se limpia manualmente después de uso, pero hay riesgo si el flujo falla antes de procesar. **Sugerencia**: Implementar un cleanup automático con TTL (ej. 10 minutos) para evitar que imágenes huérfanas permanezcan en memoria indefinidamente.

### Importaciones Dinámicas
- `executeFunction`: Se importa dinámicamente, puede causar problemas en bundling
- **Imports Dinámicos**: executeFunction y fs.createReadStream son dinámicos; pueden fallar en entornos sin await import soporte completo (e.g., bundlers antiguos).

### Recomendaciones para Migración
1. **Limpiar imports obsoletos** antes de migración
2. **Convertir importaciones dinámicas** a estáticas donde sea posible
3. **Separar configuración** de lógica de negocio
4. **Modularizar sistema de logging** completamente
5. **Implementar TTL automático** para todas las estructuras Map/Set

## Preparación para Modularización

### Módulos Listos
- ✅ `config/environment`
- ✅ `utils/logging`
- ✅ `utils/persistence`
- ✅ `utils/simpleLockManager`

### Módulos Por Crear
- 🔄 `core/messaging`
- 🔄 `core/openai`
- 🔄 `integrations/whapi`
- 🔄 `integrations/beds24`
- 🔄 `utils/media-handler`: Para pendingImages y transcripciones de audio.

### Variables que Requieren Migración Especial
| Variable | Tipo | Riesgo | Estrategia de Migración |
|----------|------|--------|------------------------|
| `globalMessageBuffers` | Map con timers | Alto | Refactorizar a BufferManager con cleanup garantizado |
| `globalUserStates` | Map sin TTL | Alto | Migrar a StateManager con LRU cache |
| `pendingImages` | Map sin TTL | Medio | Agregar TTL automático de 10 minutos |
| `botSentMessages` | Set creciente | Medio | Implementar LRU con límite de entradas |
| `activeProcessing` | Set temporal | Bajo | Mantener como está pero con timeout automático |
| `contextCache` | Map con timestamp | Bajo | Migrar a CacheManager estándar |
| `chatInfoCache` | Map con timestamp | Bajo | Migrar a CacheManager estándar |

### Checklist Pre-migración Específico
- [ ] Verificar que todos los Maps/Sets tengan estrategia de TTL
- [ ] Confirmar que todos los timers se cancelen correctamente
- [ ] Asegurar que `botSentMessages` mantenga funcionalidad anti-loop
- [ ] Validar que el cleanup de `globalMessageBuffers` sea atómico
- [ ] Verificar que `userRetryState` preserve cooldowns durante migración
- [ ] Migrar terminalLog a un módulo independiente `./utils/terminal-log.js` para decoupling de console/dashboard.