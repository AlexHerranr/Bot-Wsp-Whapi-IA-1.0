# 8. Funcionalidades Específicas de Hotelería

> **Introducción**: Esta sección detalla las funcionalidades específicas de hotelería implementadas en el codebase de `app-unified.ts`. Se basa exclusivamente en el análisis del código fuente, incluyendo la integración con Beds24 para consultas de disponibilidad a través de function calling con OpenAI, manejo de labels via Whapi, inyección de contexto temporal con timezone America/Bogota, y validación de respuestas sensibles para fallback de voz a texto. No se incluyen implementaciones externas o alucinadas; todo se deriva directamente de las estructuras, funciones y logs presentes en el archivo.

## Función Principal: check_availability

### 1. Definición y Uso en Function Calling
**Ubicación**: No definida directamente en `app-unified.ts`, pero invocada dinámicamente vía `executeFunction` importado de `./functions/registry/function-registry.js` durante el procesamiento de `requires_action` en `processWithOpenAI` (líneas aproximadas ~2000-2500).
- **Descripción inferida**: Consulta disponibilidad en Beds24, calculando noches basadas en `startDate` y `endDate`. Se ejecuta como tool en OpenAI cuando el run.status es 'requires_action'.
- **Handler**: Ejecutado via `executeFunction('check_availability', args)`, donde args incluyen `startDate`, `endDate`.
- **Estado**: Habilitada, con logs específicos para tracking.

### 2. Parámetros
**Inferidos de logs en `terminalLog.functionStart`** (líneas ~200-300):
- `startDate`: string (formato YYYY-MM-DD, usado para log y cálculo de noches).
- `endDate`: string (formato YYYY-MM-DD, usado para log y cálculo de noches).
- Cálculo de noches: `Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))` o '?' si faltan fechas (no parámetro directo, usado en condición de complejidad).

### 3. Ejecución y Flujo
- **Invocación**: En el loop de toolCalls en `processWithOpenAI` (dentro de `if (run.status === 'requires_action')`):
  - Parseo de `functionArgs = JSON.parse(toolCall.function.arguments)`.
  - Ejecución: `await executeFunction(functionName, functionArgs)`.
  - Resultado agregado a `toolOutputs`.
- **Manejo de complejidad**: El código envía un mensaje interino como "Voy a consultar disponibilidad" si la función `check_availability` es llamada. Esto mejora la experiencia del usuario durante la espera, especialmente en consultas que pueden tardar más tiempo.
- **Logging específico**:
  - `terminalLog.functionStart`: Loggea `⚙️ check_availability(start-end, nights noches)`.
  - `terminalLog.availabilityResult`: Loggea `🏠 completas completa(s) + splits alternativa(s) (duration s)`, donde `completas` y `splits` son números de resultados.
  - `logFunctionExecuting` y `logFunctionHandler` para tracking.

### 4. Integración con Beds24
- **Inferida**: Resultados procesados incluyen "completas" (disponibles) y "splits" (alternativas), con parseo de respuesta XML a JSON (mencionado en comentarios). Formateo: completas y splits de resultados.
- **Timezone**: Todas las fechas/horas usan `America/Bogota` (en `getPrecomputedContextBase` con `toLocaleDateString` y `toLocaleTimeString`).
- **Métricas**: Duration calculado para log en `availabilityResult`.
- **Bottlenecks**: Mencionado ~20% timeouts en comentarios, sin retry automático en código visible.

## Sistema de Labels Hoteleros

### 1. Import y Uso
**Ubicación**: Import de `whapiLabels` from './utils/whapi/index.js' (línea ~100).
- **Funcionalidad**: Usado para obtener labels en `getCachedChatInfo` y `getRelevantContext`.
- **Etiquetas disponibles (inferidas de comentarios en CURRENT_STATE, no explícitas en código)**: ['Potencial', 'Consulta', 'Reservado', 'VIP', 'Check-in', 'Check-out', 'Cancelado', 'Repetidor'].
- **Cache**: `chatInfoCache` con TTL 5 min para info de chats incluyendo labels.

### 2. Integración en Contexto
- En `getRelevantContext`: Combina labels de `guestMemory` (obsoleto pero importado) y `whapiLabels` via `getCachedChatInfo`.
  - Únicas y primeras 2: `allLabels = [...new Set([...profileLabels, ...chatLabels])].slice(0, 2)`.
  - Inyectado en contexto como `Status: label1, label2`.
- **Detección de cambios**: En `needsTemporalContext` (dentro de `processWithOpenAI`):
  - Compara storedLabels con currentLabels; si difieren, needsContext = true (razón 'cambio_labels').
  - Actualiza metadata en `threadPersistence.updateThreadMetadata` con `labels`.

## Contexto Temporal Inyectado

### 1. Generación
**Ubicación**: `getRelevantContext` (líneas ~800-900) y `getPrecomputedContextBase` (líneas ~700-800).
- **Condiciones para inyección** (en `needsTemporalContext` dentro de `processWithOpenAI`):
  - Primer mensaje o error en verificación.
  - Más de 3 horas desde lastActivity.
  - Cambio en nombre (clientName o contactName vs storedName).
  - Cambio en labels (JSON.stringify comparación).
  - Reasons explícitas: 'primer_mensaje', 'tiempo_3h', 'cambio_nombre', 'cambio_labels', 'error_verificacion'.
- **Contenido**:
  - `Fecha: DD/MM/YYYY | Hora: HH:MM AM/PM (Colombia)` (de `getPrecomputedContextBase` con TTL 1 min).
  - `Cliente: clientName | Contacto WhatsApp: contactName | Status: labels.join(', ')` si hay labels.
  - Separador `---\nMensaje del cliente:`.

### 2. Cache y Optimización
- `contextCache`: Map con TTL 1 hora para evitar regeneración innecesaria.
- `precomputedContextBase`: Cache para date/time con TTL 1 min.

### 3. Actualización de Metadata
- Si cambio en nombre/labels: `threadPersistence.updateThreadMetadata` con `name`, `userName`, `labels`.

## Validación de Respuestas Sensibles

### 1. Detección
**Ubicación**: `isQuoteOrPriceMessage` (líneas ~600-700).

| Pattern | Descripción | Ejemplo |
|---------|-------------|---------|
| `/\$\d+[.,]?\d*/g` | Precios con $ | $840.000 |
| `/\d+[.,]?\d*\s*(cop|pesos?)/gi` | Precios con COP/pesos | 840000 COP |
| `/\d+\s*noches?/gi` | Número de noches | 4 noches |
| `/https?:\/\/\S+/i` | URLs | https://example.com |
| `/wa\.me\/p/i` | Enlaces WhatsApp | wa.me/p |

- **Uso**: En `sendWhatsAppMessage` para forzar texto si `shouldUseVoice` y match (fallback voice → text).

### 2. Validación Post-Respuesta
- `validateAndCorrectResponse` (importado de './utils/response-validator.js').
- Usa `levenshtein` (importado) para distancia de strings en discrepancias.
- Si `needsRetry`: Verifica canRetry con userRetryState (retryCount === 0 o >5 min). Crea correctiveMessage con originalOutputs de toolOutputs y re-ejecuta run (con `userRetryState` para evitar loops: max 1 retry cada 5 min).

## Análisis de Imágenes con Vision API

### 1. Detección y Flujo de Ejecución
**Ubicación**: La lógica se encuentra en la función `processWebhook` (al detectar `message.type === 'image'`) y en la función `analyzeImage`.
- **Activación**: Se dispara cuando el bot recibe un mensaje de tipo `'image'`.
- **Flujo**:
    1. El webhook detecta la imagen y extrae su `imageUrl`. Si la URL no está en el payload inicial, la función `analyzeImage` intenta obtenerla de nuevo desde la API de Whapi usando el `messageId`.
    2. La URL de la imagen se almacena en el `Map` global `pendingImages`, asociándola al `userId`. Esto permite adjuntar múltiples imágenes a la siguiente interacción del usuario.
    3. Se añade al `globalMessageBuffers` un texto genérico (`'📷 Imagen recibida'`) para confirmar la recepción. El sistema **no utiliza la descripción de la IA directamente en el buffer**, sino que espera el siguiente mensaje de texto del usuario.
    4. Cuando el usuario envía el siguiente mensaje de texto, las imágenes almacenadas en `pendingImages` se incluyen en la llamada a OpenAI como input multimodal.

### 2. Integración con OpenAI Vision
- **Modelo**: Utiliza el modelo definido en la variable de entorno `IMAGE_ANALYSIS_MODEL` o `gpt-4o-mini` por defecto.
- **Prompt**: Envía un prompt específico para analizar la imagen en contexto hotelero, pero **la descripción generada no se utiliza actualmente en el flujo principal**.
- **Procesamiento Real**: Las imágenes se procesan directamente como input multimodal en OpenAI, no a través de la descripción de `analyzeImage`.

### 3. Gestión de Imágenes Pendientes
- **Almacenamiento**: `pendingImages` es un `Map` que asocia `userId` con arrays de URLs de imágenes.
- **Consumo**: Las imágenes se consumen y eliminan de `pendingImages` cuando se procesan con el siguiente mensaje de texto.
- **Confirmación**: El usuario recibe una confirmación inmediata (`'📷 Imagen recibida'`) pero el procesamiento real ocurre con el siguiente mensaje.

## Otras Funcionalidades Relacionadas

### 1. Logging Específico
- `terminalLog.availabilityResult`: Para resultados de Beds24 (completas + splits).

### 2. Métricas y Monitoreo
- Tokens y latency en `processWithOpenAI` incluyen function calling (e.g., Beds24).
- Bottlenecks: Polling OpenAI (1-3s + backoff), Beds24 (~2-5s, 20% timeouts en comentarios).

### 3. Cleanup y Persistencia
- Threads persistidos en `threads-data.json` incluyen `labels` para detección de cambios.
- `guest-memory.json` obsoleto pero importado, usado para labels en contexto.

### 4. Flujos Especiales
- Mensaje interino para `check_availability` complejo.
- Contexto inyectado cada 3h o cambio en labels/nombre.

## Estado de la Implementación
- **Implementado**: Function calling para `check_availability`, labels en contexto, validación sensible, timezone Bogota.
- **Inferido de Código**: Integración Beds24 via handler externo, no detallado aquí.
- **Riesgos**: Memory leaks en caches (e.g., `chatInfoCache`), timeouts Beds24 sin retry.
- **Recomendaciones del Código**: Usar `invalidateUserCaches` al cambiar labels para consistencia.