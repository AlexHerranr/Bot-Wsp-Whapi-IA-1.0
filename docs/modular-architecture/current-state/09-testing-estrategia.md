# 9. Estrategia de Testing

> **Introducción**: Esta sección detalla la estrategia de testing para el bot TeAlquilamos en su estado actual monolítico, basada en funciones utilitarias y auxiliares definidas en `app-unified.ts`. Se enfoca en exportar helpers para unit testing (e.g., helpers básicos, media, buffers, locks), mocks para dependencias (openaiClient, fetch), pruebas de integración para buffers/function calling y E2E para webhooks. Sugiere Vitest por compatibilidad Node.js. Cobertura >80% en core, con CI/CD via GitHub Actions. Prepara migración con tests modulares.

## Funciones Exportadas para Testing

### 1. Funciones Utilitarias Exportadas
Recomendar exportar (agregar al final de `app-unified.ts`):

```typescript
export {
    getTimestamp,
    getShortUserId,
    cleanContactName,
    isQuoteOrPriceMessage,
    getOrCreateUserState,
    getCachedChatInfo,
    invalidateUserCaches,
    transcribeAudio,
    analyzeImage,
    acquireThreadLock,
    releaseThreadLock,
    addToGlobalBuffer,
    setIntelligentTimer,
    processGlobalBuffer,
    sendTypingIndicator,
    sendRecordingIndicator,
    sendWhatsAppMessage,
    cleanupOldRuns,
    isRunActive,
    getPrecomputedContextBase,
    getRelevantContext,
    processWithOpenAI,
    processWebhook,
    initializeBot
};
```

## Interfaces para Testing

```typescript
// test/types/testing.ts
interface TestMessage {
    id: string;
    type: 'text' | 'voice' | 'audio' | 'ptt' | 'image';
    from_me: boolean;
    chat_id: string;
    from: string;
    text?: { body: string };
    audio?: WHAPIMediaLink;
    voice?: WHAPIMediaLink;
    ptt?: WHAPIMediaLink;
    image?: WHAPIMediaLink;
}

interface TestRun {
    id: string;
    status: 'queued' | 'in_progress' | 'requires_action' | 'completed' | 'failed';
    required_action?: { submit_tool_outputs: { tool_calls: Array<any> } };
}
```

## Framework de Testing Sugerido

### 1. Configuración Vitest
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
        }
    }
});
```

### 2. Setup de Testing
```typescript
// test/setup.ts
import { vi } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

beforeEach(() => vi.resetAllMocks());
```

## Mocking de Dependencias

### 1. OpenAI Mock
```typescript
// test/mocks/openai.mock.ts
import { vi } from 'vitest';

export const mockOpenAI = {
    audio: { transcriptions: { create: vi.fn().mockResolvedValue({ text: 'Mock transcription' }) } },
    chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'Mock analysis' } }] }) } },
    beta: { threads: { runs: { create: vi.fn().mockResolvedValue({ status: 'completed' }), retrieve: vi.fn(), submitToolOutputs: vi.fn(), cancel: vi.fn() }, messages: { create: vi.fn(), list: vi.fn().mockResolvedValue({ data: [{ content: [{ text: { value: 'Mock response' } }] }] }) } } }
};
```

### 2. Whapi Mock
```typescript
// test/mocks/whapi.mock.ts
import { vi } from 'vitest';

vi.stubGlobal('fetch', vi.fn((url) => {
    if (url.includes('/messages/text') || url.includes('/messages/voice') || url.includes('/presences')) return { ok: true };
    if (url.includes('/chats')) return { json: () => ({ name: 'Mock', labels: ['Mock'] }) };
    if (url.includes('/messages/')) return { json: () => ({ voice: { link: 'mock_url' }, image: { link: 'mock_url' } }) };
}));
```

### 3. Beds24 Mock
```typescript
// test/mocks/beds24.mock.ts
import { vi } from 'vitest';

vi.stubGlobal('fetch', vi.fn((url) => {
    if (url.includes('beds24.com/api')) return { json: () => ({ mock: 'XML parsed to JSON' }) };
}));
vi.mock('./functions/registry/function-registry.js', () => ({ executeFunction: vi.fn().mockResolvedValue('Mock result') }));
```

## Pruebas Unitarias

### 1. Testing de Funciones Utilitarias
```typescript
// test/unit/util.test.ts
import { describe, it, expect } from 'vitest';
import { getTimestamp, getShortUserId, cleanContactName, isQuoteOrPriceMessage, getPrecomputedContextBase } from '../../app-unified.ts';

describe('Util', () => {
    it('getTimestamp', () => expect(getTimestamp()).toMatch(/\d{4}-\d{2}-\d{2}T/));
    it('getShortUserId', () => expect(getShortUserId('123@s.whatsapp.net')).toBe('123'));
    it('cleanContactName', () => expect(cleanContactName('Juan Pérez!@#')).toBe('Juan Pérez'));
    it('isQuoteOrPriceMessage', () => expect(isQuoteOrPriceMessage('$100 COP')).toBe(true));
    it('getPrecomputedContextBase', () => expect(getPrecomputedContextBase().date).toMatch(/\d{2}\/\d{2}\/\d{4}/));
});
```

### 2. Testing de Media Processing
```typescript
// test/unit/media.test.ts
import { describe, it, expect } from 'vitest';
import { transcribeAudio, analyzeImage } from '../../app-unified.ts';
import { mockOpenAI } from '../mocks/openai.mock.ts';

describe('Media', () => {
    it('transcribeAudio', async () => expect(await transcribeAudio('url', '123')).toBe('Mock transcription'));
    it('analyzeImage', async () => expect(await analyzeImage('url', '123')).toBe('Mock analysis'));
});
```

## Pruebas de Integración

### 1. Testing de Function Calling
```typescript
// test/integration/function-calling.test.ts
import { describe, it, expect } from 'vitest';
import { processWithOpenAI } from '../../app-unified.ts';
import { mockOpenAI } from '../mocks/openai.mock.ts';

describe('Function Calling', () => {
    it('handles', async () => {
        await processWithOpenAI('Check', '123@s.whatsapp.net', 'chat123');
        expect(mockOpenAI.beta.threads.runs.create).toHaveBeenCalled();
    });
});
```

### 2. Testing de Buffer Processing
```typescript
// test/integration/buffer.test.ts
import { describe, it, expect } from 'vitest';
import { addToGlobalBuffer, processGlobalBuffer } from '../../app-unified.ts';

describe('Buffer', () => {
    it('processes', async () => {
        addToGlobalBuffer('123', 'msg', 'chat123', 'User');
        await processGlobalBuffer('123');
        expect(globalMessageBuffers.has('123')).toBe(false);
    });
});
```

## Pruebas End-to-End

### 1. Flujo Completo de Conversación
```typescript
// test/e2e/conversation.test.ts
import { describe, it, expect } from 'vitest';
import { processWebhook } from '../../app-unified.ts';

describe('Conversation', () => {
    it('handles webhook', async () => {
        const mockWebhookBody = {
            messages: [{
                id: 'msg_test_123',
                type: 'text',
                from_me: false,
                from: '123@s.whatsapp.net',
                chat_id: 'chat123',
                text: { body: 'Hi' }
            }]
        };
        await processWebhook(mockWebhookBody);
        expect(globalMessageBuffers.size).toBe(0);
    });
});
```

## Cobertura de Testing

### 1. Configuración de Coverage
Usar V8 con thresholds 80%.

### 2. Objetivos de Cobertura
>80% en utilitarias/media, 70% en core.

## CI/CD Integration

### 1. GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test -- --coverage
```

### 2. Test Quality Gates
Script post-test para verificar thresholds, fallar CI si <80%.

## Recomendaciones para Migración
Migrar tests a carpetas modulares (test/utils, test/integration), usar property-testing para edges, integrar CI para PRs.

---

## Análisis Detallado y Sugerencias de Mejora

¡Excelente! Analicemos la sección **9. Estrategia de Testing** en detalle, comparándola con el código `app-unified.ts` para asegurar que sea precisa, completa y útil para la migración.

La sección actual está bien estructurada, pero se pueden realizar varias mejoras para alinearla perfectamente con el código fuente, corregir algunas omisiones y hacerla más robusta.

### **Análisis y Sugerencias Detalladas**

A continuación, se desglosa cada subsección con las modificaciones, adiciones o eliminaciones recomendadas.

#### **Introducción**

* **Análisis**: La introducción es correcta y establece bien el contexto.
* **Sugerencia**: Ningún cambio es necesario aquí. Está perfecta.

---

#### **1. Funciones Exportadas para Testing**

* **Análisis**: El documento presenta dos listas de exportaciones. La segunda es más completa. Sin embargo, ambas omiten funciones clave que son fundamentales para probar flujos E2E y de inicialización. Además, `analyzeImage` no está en la primera lista, lo cual es un error crítico.
* **Acción**: Unificar y completar la lista de exportación.

**MODIFICAR** el bloque de código de exportación para que sea una única lista consolidada y completa. Se añaden `processWebhook`, `initializeBot` y se asegura que `analyzeImage` esté presente.

```typescript
// SUGERENCIA DE CÓDIGO CORREGIDO Y COMPLETO
// En app-unified.ts - Al final del archivo
export {
    // Helpers básicos
    getTimestamp,
    getShortUserId,
    cleanContactName,
    isQuoteOrPriceMessage,
    
    // Gestión de estado y caches
    getOrCreateUserState,
    getCachedChatInfo,
    invalidateUserCaches,
    getPrecomputedContextBase,
    getRelevantContext,
    
    // Media Handling
    transcribeAudio,
    analyzeImage,
    
    // Locks
    acquireThreadLock,
    releaseThreadLock,
    
    // Buffering y Timers
    addToGlobalBuffer,
    setIntelligentTimer,
    processGlobalBuffer,
    
    // Comunicación con WhatsApp (Whapi)
    sendTypingIndicator,
    sendRecordingIndicator,
    sendWhatsAppMessage,
    
    // Lógica de OpenAI
    cleanupOldRuns,
    isRunActive,
    processWithOpenAI,
    
    // Flujo principal y Setup (para tests de integración/E2E)
    processWebhook,
    initializeBot 
};
```

* **Justificación**:
    * **`processWebhook`**: Es el **punto de entrada principal** del bot. Exportarlo es crucial para simular webhooks de Whapi en pruebas de integración y E2E.
    * **`initializeBot`**: Permite probar que los `setIntervals` para cleanups y recuperación de runs se configuran correctamente al iniciar el bot.
    * Se ha organizado por categorías para mayor claridad.

---

#### **2. Interfaces para Testing**

* **Análisis**: La interfaz `TestMessage` está incompleta. El código en `processWebhook` maneja `voice`, `audio` y `ptt`. La interfaz de prueba solo menciona `voice`.
* **Acción**: Actualizar la interfaz `TestMessage` para reflejar todos los tipos de media de audio que maneja el bot.

**CORREGIR** la interfaz `TestMessage` para que sea más precisa.

```typescript
// SUGERENCIA DE CÓDIGO CORREGIDO
interface TestMessage {
    id: string;
    type: 'text' | 'voice' | 'audio' | 'ptt' | 'image'; // AGREGADO: 'audio' y 'ptt'
    from_me: boolean;
    chat_id: string; // AGREGADO: Esencial para simular el webhook
    from: string;    // AGREGADO: Esencial para simular el webhook
    text?: { body: string };
    audio?: WHAPIMediaLink; // AGREGADO
    voice?: WHAPIMediaLink;
    ptt?: WHAPIMediaLink;   // AGREGADO
    image?: WHAPIMediaLink;
}
```

* **Justificación**: Las pruebas E2E que simulen `processWebhook` fallarán o serán incompletas si no se pueden crear objetos de mensaje que coincidan con la lógica interna, que explícitamente busca en `message.voice?.link || message.audio?.link || message.ptt?.link`.

---

#### **3. Mocking de Dependencias**

* **Análisis**: Los mocks son un buen punto de partida, pero les falta un detalle clave en el mock de Whapi y se puede clarificar el de Beds24.
* **Acción**:
  1. **Mejorar el mock de Whapi (`fetch`)**: La función `transcribeAudio` y `analyzeImage` intentan obtener la URL del medio a través de un `fetch` a `/messages/{messageId}` si la URL no viene en el webhook inicial. El mock actual no cubre este caso.
  2. **Clarificar el mock de Beds24**: Explicitar que se debe mockear el import dinámico de `function-registry.js`.

**MODIFICAR** la sección de `Whapi Mock` y `Beds24 Mock`.

```typescript
// SUGERENCIA PARA "Whapi Mock"
vi.stubGlobal('fetch', vi.fn((url) => {
    // ... mocks existentes ...
    // AGREGAR ESTA CONDICIÓN:
    if (url.includes('/messages/')) { // Cubre el fetch para obtener media URL por ID
        return Promise.resolve({ 
            ok: true,
            json: () => Promise.resolve({ 
                voice: { link: 'mock_fetched_audio_url.ogg' },
                image: { link: 'mock_fetched_image_url.png' }
            }) 
        });
    }
    // ...
}));

// SUGERENCIA PARA "Beds24 Mock"
// Aclarar que el mock más importante es el del módulo de funciones.
vi.mock('./functions/registry/function-registry.js', () => ({
    executeFunction: vi.fn().mockResolvedValue('{"completas": 1, "splits": 0}') // Simular un resultado JSON
}));
```

* **Justificación**: Sin el mock del `fetch` por ID de mensaje, las pruebas para `transcribeAudio` y `analyzeImage` solo cubrirían el "happy path" donde la URL ya viene incluida, pero no el caso de fallback que está explícitamente codificado.

---

#### **4. Pruebas End-to-End**

* **Análisis**: El ejemplo de prueba E2E es conceptualmente correcto pero el objeto que se pasa a `processWebhook` es inválido. Un webhook real de `messages` requiere más campos como `from`, `chat_id`, etc., que son usados por la lógica interna.
* **Acción**: Corregir el cuerpo del webhook simulado para que sea realista y funcional.

**CORREGIR** el ejemplo de la prueba E2E.

```typescript
// SUGERENCIA DE CÓDIGO CORREGIDO
// test/e2e/conversation.test.ts
import { describe, it, expect } from 'vitest';
import { processWebhook } from '../../app-unified.ts'; // Asumiendo que se exporta

describe('E2E Conversation Flow', () => {
    it('handles a simple text message webhook flow', async () => {
        const mockWebhookBody = {
            messages: [{
                id: 'msg_123',
                type: 'text',
                from_me: false,
                from: '573001234567@s.whatsapp.net',
                chat_id: '573001234567@s.whatsapp.net',
                chat_name: 'Test User',
                text: { body: 'Hola' }
            }]
        };
        
        // Asumimos que las dependencias (OpenAI, etc.) están mockeadas globalmente
        await processWebhook(mockWebhookBody);
        
        // La aserción depende de lo que se quiera probar.
        // Por ejemplo, verificar que se llamó a OpenAI.
        // expect(mockOpenAI.beta.threads.runs.create).toHaveBeenCalled();
    });
});
```

* **Justificación**: Usar un payload realista asegura que la prueba simule el comportamiento real del sistema desde su punto de entrada, validando que el parsing del `body` y la extracción de `userId`, `chatId` y `userName` funcionen como se espera.

### **Resumen de Cambios**

| Sección | Estado Actual | Sugerencia de Mejora |
|:---|:---|:---|
| **Funciones Exportadas** | Incompleta y duplicada. Faltan `processWebhook`, `initializeBot`, `analyzeImage`. | **Unificar y completar la lista** para incluir todas las funciones clave, organizadas por categoría para mayor claridad. |
| **Interfaces para Testing** | La interfaz `TestMessage` no incluye todos los tipos de audio (`audio`, `ptt`). | **Añadir los tipos de media faltantes** y campos esenciales como `from` y `chat_id` para que coincida con el código. |
| **Mocking de Dependencias** | El mock de `fetch` para Whapi no cubre la obtención de media por ID de mensaje. | **Extender el mock de `fetch`** para simular la respuesta de `/messages/{id}`. Clarificar el mock del import dinámico para Beds24. |
| **Pruebas End-to-End** | El payload de webhook simulado es inválido y no funcionaría con la lógica actual. | **Corregir el payload del webhook** para que incluya todos los campos necesarios (`from`, `chat_id`, `text.body`, etc.). |

Estos ajustes harán que la sección de testing no solo sea teóricamente correcta, sino una guía práctica y precisa para implementar un conjunto de pruebas robusto sobre el código `app-unified.ts` existente.