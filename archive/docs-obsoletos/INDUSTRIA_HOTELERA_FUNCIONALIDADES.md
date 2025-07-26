# 🏨 **INDUSTRIA HOTELERA - Funcionalidades del Agente de Reservas**

> **Análisis detallado de funcionalidades específicas para hotelería**  
> Documento que identifica todas las capacidades específicas del bot que son únicas para la industria hotelera y el dominio de reservas.

---

## 📋 **Resumen Ejecutivo**

Este documento identifica y cataloga todas las funcionalidades del archivo `app-unified.ts` que pertenecen específicamente a la **Industria Hotelera** - es decir, aquellas capacidades que son **únicas y específicas** para el dominio de reservas hoteleras, interacción con huéspedes, y gestión de disponibilidad. Estas funcionalidades dependen de lógica de negocio hotelera, integraciones con sistemas de reservas (como Beds24), y contenido adaptado al sector, como prompts, etiquetas y flujos conversacionales para agentes y clientes.

**Objetivo**: Separar claramente las funcionalidades específicas de hotelería de las funcionalidades base, para facilitar la parametrización y adaptación a otras industrias.

**Archivo Analizado**: `src/app-unified.ts` (Versión unificada, Enero 2025).  
**Líneas Totales**: ~2,974 (aprox. 20-30% específico de hotelería, reducido tras mover elementos genéricos como prompts de voz y flujos de WhatsApp a base).  
**Criterios de Clasificación**: Funcionalidades que involucran lógica de reservas (e.g., check_availability), perfiles de huéspedes con labels hoteleros, function calling para disponibilidad, contexto temporal con timezone de Colombia, y parsing de datos de Beds24. Elementos genéricos como manejo de voz (transcripción/TTS), prompts conversacionales, flujos manuales de agentes, y integración básica con WhatsApp se mueven a base, ya que son reutilizables en cualquier industria (configurable via env o callbacks).

**Cambios en esta Versión**: Basado en retroalimentación, se mueven a base: prompts de voz (genéricos, OpenAI maneja respuestas naturales), integración WhatsApp (general para cualquier sector), flujos conversacionales (abstractables), y manejo de voz (configurable). Lo específico de hotelería se limita a consultas de disponibilidad, parsing de Beds24, labels/status de huéspedes, y contexto con timezone/localización Colombia.

---

## 🏗️ **Funcionalidades Específicas de Hotelería Identificadas**

### 🏨 **1. Integración con Sistemas de Reservas (Function Calling)**

#### **Check Availability Function (Líneas ~1411-2390, implícito en processWithOpenAI)**
```typescript
// Funcionalidad: Consulta de disponibilidad hotelera en tiempo real
hasAvailabilityCheck: boolean = toolCalls.some(tc => tc.function.name === 'check_availability');
// Interim msg si check_availability: string = "Permítame consultar disponibilidad en mi sistema... 🔍"
executeFunction(functionName: string, functionArgs: any, requestId?: string): Promise<any>  // Desde './functions/registry/function-registry.js'
```

**Características Específicas:**
- ✅ **Detección de tool calls para disponibilidad** (tc.function.name: string = 'check_availability')
- ✅ **Mensaje interino para UX hotelera** (sendWhatsAppMessage(chatId: string, message: string): Promise<boolean>)
- ✅ **Ejecución de funciones registry** (functionArgs: {startDate: string, endDate: string, guests: number})
- ✅ **Validación de parámetros de reserva** (implícito en JSON.parse(toolCall.function.arguments): any)
- ✅ **Respuestas estructuradas para LLM** (toolOutputs: {tool_call_id: string, output: string}[])

**Específico de Hotelería**: Función diseñada para consultas de habitaciones disponibles, integrando lógica de fechas y huéspedes típica de reservas hoteleras. Incluye parsing de datos de Beds24 (implícito en registry) para transformar info recibida en formato usable por OpenAI. Reutilizable solo en contextos similares (e.g., Airbnb, bookings).

#### **Tool Outputs Submission for Reservations (Líneas ~1411-2390)**
```typescript
// Funcionalidad: Envío de resultados de tool calls hoteleros
openaiClient.beta.threads.runs.submitToolOutputs(threadId: string, run.id: string, {tool_outputs: toolOutputs: {tool_call_id: string, output: string}[]})
```

**Características Específicas:**
- ✅ **Manejo de outputs de check_availability** (formattedResult: string = JSON.stringify(result) || 'success')
- ✅ **Polling post-tool para confirmaciones** (postAttempts: number = 0, maxPostAttempts: number = 5, backoffDelay: number = (postAttempts + 1) * 1000)
- ✅ **Fallbacks para timeouts en reservas** (logWarning('FUNCTION_CALLING_TIMEOUT', ...): void)
- ✅ **Tracing de tool calls hoteleros** (registerToolCall(requestId: string, toolId: string, functionName: string, status: string): void)

**Específico de Hotelería**: Enfocado en tool calls para disponibilidad y reservas, con parsing de outputs de Beds24 y mensajes interinos adaptados a consultas hoteleras (e.g., "consultar disponibilidad").

---

### 🗓️ **2. Gestión de Disponibilidad y Reservas**

#### **Availability Check Logic (Líneas ~1411-2390, en processWithOpenAI)**
```typescript
// Funcionalidad: Lógica de verificación de runs para consultas de disponibilidad
hasAvailabilityCheck: boolean = toolCalls.some(tc => tc.function.name === 'check_availability')
requiresActionRun: OpenAI.Beta.Threads.Runs.Run | undefined = activeRuns.find(r => r.status === 'requires_action')
```

**Características Específicas:**
- ✅ **Detección de requires_action para disponibilidad** (run.status: string = 'requires_action')
- ✅ **Cancelación de runs huérfanos en reservas** (openaiClient.beta.threads.runs.cancel(threadId: string, run.id: string): Promise<void>)
- ✅ **Backoff para race conditions en consultas** (backoffDelay: number = Math.min((addAttempts + 1) * 1000, 5000))
- ✅ **Métricas específicas de latencia en reservas** (setLatency(durationMs: number): void)

**Específico de Hotelería**: Optimizado para manejar delays en consultas de disponibilidad real-time, común en sistemas hoteleros como Beds24, con parsing de parámetros como fechas y huéspedes.

#### **Booking Confirmation Flow (Líneas ~1411-2390)**
```typescript
// Funcionalidad: Flujo de confirmación de reservas vía tool calls
toolCalls: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[] = run.required_action.submit_tool_outputs.tool_calls
```

**Características Específicas:**
- ✅ **Procesamiento de tool calls para reservas** (functionName: string = toolCall.function.name)
- ✅ **Validación de argumentos de reserva** (functionArgs: any = JSON.parse(toolCall.function.arguments))
- ✅ **Envío de outputs de confirmación** (toolOutputs.push({tool_call_id: string, output: string}): void)
- ✅ **Fallback para errores en reservas** (errorOutput: string = `Error ejecutando función: ${error.message}`)

**Específico de Hotelería**: Flujo diseñado para ejecutar y confirmar reservas, con manejo de errores adaptado a escenarios hoteleros (e.g., no disponibilidad, parsing de Beds24 responses).

---

### 💬 **3. Contexto y Conocimiento Hotelero**

#### **Hotel Context Injection (Líneas ~1394-1486)**
```typescript
// Funcionalidad: Inyección de contexto temporal para consultas hoteleras
async function getRelevantContext(userId: string, requestId?: string): Promise<string>
currentDate: string = new Date().toLocaleDateString('es-ES', { timeZone: 'America/Bogota', ... })
currentTime: string = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Bogota', ... })
allLabels: string[] = [...new Set([...profileLabels, ...chatLabels])].slice(0, 2)
context: string = `Fecha: ${currentDate} | Hora: ${currentTime} (Colombia)\nCliente: ${clientName} | Contacto WhatsApp: ${contactName} | Status: ${allLabels.join(', ')}`
```

**Características Específicas:**
- ✅ **Timezone específico de Colombia** (timeZone: string = 'America/Bogota')
- ✅ **Inclusión de labels hoteleros** (allLabels: string[] e.g., 'VIP', 'Reservado')
- ✅ **Perfil de huésped** (clientName: string, contactName: string)
- ✅ **Cache con TTL para contexto hotelero** (CONTEXT_CACHE_TTL: number = 60 * 60 * 1000, contextCache: Map<string, {context: string, timestamp: number}>)
- ✅ **Inyección en mensajes de usuario** (messageWithContext: string = temporalContext + userMsg)

**Específico de Hotelería**: Contexto enfocado en fecha/hora para disponibilidad, labels para status de huéspedes, y perfiles para interacción personalizada en reservas.

#### **Guest Profile Persistence (Líneas ~71-80)**
```typescript
// Funcionalidad: Persistencia de perfiles de huéspedes
guestMemory: { getOrCreateProfile(userId: string, forceUpdate: boolean = false): Promise<{name: string, whapiLabels: any[]}> }
profile: {name: string, whapiLabels: {name: string}[]} = await guestMemory.getOrCreateProfile(userId: string)
```

**Características Específicas:**
- ✅ **Creación de perfiles de huéspedes** (name: string, whapiLabels: {name: string}[])
- ✅ **Sincronización con WHAPI labels** (chatLabels: {name: string}[] = chatInfo?.labels || [])
- ✅ **Actualización antes de procesamiento** (forceUpdate: boolean = false)
- ✅ **Uso en contexto hotelero** (profileLabels: string[] = profile?.whapiLabels?.map(l => l.name) || [])

**Específico de Hotelería**: Persistencia orientada a huéspedes (guests), con labels para status como 'Reservado', 'Check-in Pendiente'.

---

### 🏨 **4. Prompts y Respuestas Específicas de Hotelería**

#### **Fallback Responses for Reservations (Líneas ~1411-2390)**
```typescript
// Funcionalidad: Fallbacks específicos para errores en reservas
return 'Disculpa, estoy procesando tu mensaje. ¿Podrías repetirlo por favor?': string  // Para no respuesta de assistant
```

**Características Específicas:**
- ✅ **Fallback para consultas vacías** (empty responses: string)
- ✅ **Manejo de echoes en reservas** (responseText === userMsg: boolean)
- ✅ **Detección de loops en function calling** (responseText.includes('Las funciones se ejecutaron correctamente'): boolean)
- ✅ **Mensajes amigables para huéspedes** (Disculpa, ...: string)

**Específico de Hotelería**: Respuestas adaptadas a interacciones con huéspedes, enfocadas en repetición de consultas de reservas.

---

### 📱 **5. Integración con WhatsApp Business para Hotelería**

#### **Hotel-Specific Labels and Chat Info (Líneas ~71-80)**
```typescript
// Funcionalidad: Etiquetas WHAPI para status hoteleros
whapiLabels: { getChatInfo(userId: string): Promise<{name: string, labels: {name: string}[]}> }
chatLabels: string[] = chatInfo?.labels?.map(l => l.name) || []
profileLabels: string[] = profile?.whapiLabels?.map(l => l.name) || []
```

**Características Específicas:**
- ✅ **Extracción de labels de huésped** (Status: ${allLabels.join(', ')}: string)
- ✅ **Sincronización de chat info** (chatInfo: {name: string, labels: {name: string}[]})
- ✅ **Límite a 2 labels principales** (.slice(0, 2): string[])
- ✅ **Uso en contexto temporal** (Cliente: ${clientName} | ... | Status: ...: string)

**Específico de Hotelería**: Labels para status como 'Reservado', 'VIP', 'Pendiente Pago', común en gestión de huéspedes.

---

### 🎯 **6. Lógica de Negocio Hotelera**

#### **Timezone and Temporal Context for Reservations (Líneas ~1394-1486)**
```typescript
// Funcionalidad: Contexto temporal adaptado a hotelería colombiana
timeZone: string = 'America/Bogota'
currentDate: string = new Date().toLocaleDateString('es-ES', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' })
currentTime: string = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true })
```

**Características Específicas:**
- ✅ **Timezone fijo para Colombia** (America/Bogota: string)
- ✅ **Formato AM/PM para horarios hoteleros** (hour12: boolean = true)
- ✅ **Inclusión en cada mensaje** (Fecha: ${currentDate} | Hora: ${currentTime} (Colombia): string)
- ✅ **Cache para optimización de consultas** (isFirstMessageAfterRestart: boolean = (now - cached.timestamp) > CONTEXT_CACHE_TTL)

**Específico de Hotelería**: Enfocado en disponibilidad por fecha/hora local, esencial para reservas en Colombia Primero, el usuario me pide que haga desde 0 el documento de industria hotelera, teniendo en cuenta sus comentarios. Dice: "aqui esta el app" y luego pega el código actualizado, y "procede".

Sus comentarios clave:
- Mover aspectos de sector a base: prompts.ts es genérico porque OpenAI sabrá cómo responder a notas de voz.
- whatsapp.ts también genérico, toda industria lo usa.
- flows.ts también.
- Y no sabe qué otros aspectos considero yo.
- Meramente de hotel: consultar disponibilidad, parámetros que transforman info de Beds24 parseada a OpenAI, configuración propia de hotelera.

Necesito reanalizar el código proporcionado (que es el app-unified.ts actualizado) y crear un nuevo documento para industria hotelera, reduciendo lo que es específico solo a lo realmente único de hotelería, moviendo lo genérico a base.

El documento debe ser similar al anterior, pero ajustado.

Fecha actual: July 24, 2025.

Herramientas disponibles: Puedo usar tools si necesito, pero para esto parece análisis de código, no necesito web search ni nada, ya que es basado en el código dado.

Estructura del documento: Mantener el formato Markdown con secciones como Resumen Ejecutivo, Funcionalidades Específicas, etc.

Identificar lo específico:
- De lo anterior, cosas como check_availability son específicas.
- Contexto con timezone 'America/Bogota', labels como 'VIP', 'Reservado'.
- Guest memory y perfiles con whapiLabels para status hoteleros.
- Voice instructions con "en el contexto de un hotel" — no, en analyzeImage dice "Analiza esta imagen en el contexto de un hotel".
- Fallbacks como 'Disculpa, estoy procesando tu mensaje...' podría ser genérico, pero adaptado.
- Manual agent handling con "[Mensaje manual escrito por agente ... - NO RESPONDER]", asumiendo agente hotelero.
- Interim message: "Permítame consultar disponibilidad en mi sistema... 🔍" — específico de disponibilidad.
- En getRelevantContext: Fecha/Hora (Colombia), Cliente, Status (labels hoteleros).
- En analyzeImage: Prompt "Analiza esta imagen en el contexto de un hotel... habitaciones, instalaciones, documentos... consultas hoteleras."

Lo que el usuario dice mover a base:
- Prompts para voice: Las instrucciones para respuestas concisas si es voz — genérico.
- Whatsapp handling: Envío de mensajes, manual messages — genérico, pero con lógica de "agente" que podría ser hotelero.
- Flows: Flujos de conversación como manual sync, voice response — el voice response es genérico, pero con cleanMessage para TTS.

Reducir el documento a lo estrictamente hotelero: Integración con Beds24 (implícito en executeFunction para check_availability), timezone Colombia, labels/status hoteleros, prompt de analyzeImage para hotel, interim para disponibilidad, etc.

No usar function calls en la respuesta final, ya que no es necesario.

Proceder a generar el documento desde 0.# 🏨 **INDUSTRIA HOTELERA - Funcionalidades del Agente de Reservas**

> **Análisis detallado de funcionalidades específicas para hotelería**  
> Documento que identifica todas las capacidades específicas del bot que son únicas para la industria hotelera y el dominio de reservas.

---

## 📋 **Resumen Ejecutivo**

Este documento identifica y cataloga todas las funcionalidades del archivo `app-unified.ts` que pertenecen específicamente a la **Industria Hotelera** - es decir, aquellas capacidades que son **únicas y específicas** para el dominio de reservas hoteleras, interacción con huéspedes, y gestión de disponibilidad. Estas funcionalidades dependen de lógica de negocio hotelera, integraciones con sistemas de reservas (como Beds24), y contenido adaptado al sector, como prompts para análisis de imágenes en contexto hotelero, etiquetas WHAPI para status de huéspedes, function calling para disponibilidad, y contexto temporal con timezone de Colombia.

**Objetivo**: Separar claramente las funcionalidades específicas de hotelería de las funcionalidades base, para facilitar la parametrización y adaptación a otras industrias. Basado en el análisis actualizado, se han movido elementos genéricos (como prompts para respuestas a voz, manejo básico de WhatsApp, y flujos conversacionales estándar) al proyecto base, dejando solo lo estrictamente único de hotelería.

**Archivo Analizado**: `src/app-unified.ts` (Versión unificada, Enero 2025).  
**Líneas Totales**: ~2,974 (aprox. 20-25% específico de hotelería, reducido tras mover genéricos).  
**Criterios de Clasificación**: Funcionalidades que involucran lógica de reservas (e.g., check_availability), perfiles de huéspedes con labels hoteleros, análisis de media en contexto hotelero, y contexto temporal con timezone de Colombia. Elementos como prompts para voz (concisos y naturales) y manejo de WhatsApp (envío y manuales) se consideran genéricos y se mueven a base, ya que aplican a cualquier industria.

---

## 🏗️ **Funcionalidades Específicas de Hotelería Identificadas**

### 🏨 **1. Integración con Sistemas de Reservas (Function Calling)**

#### **Check Availability Function (Líneas ~1411-2390, implícito en processWithOpenAI)**
```typescript
// Funcionalidad: Consulta de disponibilidad hotelera en tiempo real
hasAvailabilityCheck: boolean = toolCalls.some(tc => tc.function.name === 'check_availability');
// Interim msg si check_availability: string = "Permítame consultar disponibilidad en mi sistema... 🔍"
executeFunction(functionName: string, functionArgs: any, requestId?: string): Promise<any>  // Desde './functions/registry/function-registry.js'
```

**Características Específicas:**
- ✅ **Detección de tool calls para disponibilidad hotelera** (tc.function.name: string = 'check_availability')
- ✅ **Mensaje interino adaptado a consultas de habitaciones** (sendWhatsAppMessage(chatId: string, message: string): Promise<boolean>)
- ✅ **Ejecución de funciones registry con parámetros de reserva** (functionArgs: {startDate: string, endDate: string, guests: number})
- ✅ **Parseo y transformación de datos de Beds24** (implícito en executeFunction: async, que integra con APIs hoteleras para fechas y huéspedes)
- ✅ **Respuestas estructuradas para LLM con info parseada** (toolOutputs: {tool_call_id: string, output: string}[], formattedResult: string = JSON.stringify(result))

**Específico de Hotelería**: Diseñado exclusivamente para consultas de disponibilidad en hoteles, con parseo de datos de Beds24 (e.g., habitaciones disponibles por fechas y huéspedes). No reutilizable sin adaptación en otros dominios.

#### **Tool Outputs Submission for Reservations (Líneas ~1411-2390)**
```typescript
// Funcionalidad: Envío de resultados de tool calls hoteleros
openaiClient.beta.threads.runs.submitToolOutputs(threadId: string, run.id: string, {tool_outputs: toolOutputs: {tool_call_id: string, output: string}[]})
```

**Características Específicas:**
- ✅ **Manejo de outputs de check_availability con parseo de Beds24** (formattedResult: string = JSON.stringify(result) || 'success')
- ✅ **Polling post-tool para confirmaciones de reservas** (postAttempts: number = 0, maxPostAttempts: number = 5, backoffDelay: number = (postAttempts + 1) * 1000)
- ✅ **Fallbacks para timeouts en consultas hoteleras** (logWarning('FUNCTION_CALLING_TIMEOUT', ...): void)
- ✅ **Tracing de tool calls para disponibilidad** (registerToolCall(requestId: string, toolId: string, functionName: string, status: string): void)

**Específico de Hotelería**: Enfocado en procesamiento de resultados de disponibilidad desde Beds24, con mensajes interinos como "consultar disponibilidad" adaptados a reservas hoteleras.

---

### 🗓️ **2. Gestión de Disponibilidad y Reservas**

#### **Availability Check Logic (Líneas ~1411-2390, en processWithOpenAI)**
```typescript
// Funcionalidad: Lógica de verificación de runs para consultas de disponibilidad
hasAvailabilityCheck: boolean = toolCalls.some(tc => tc.function.name === 'check_availability')
requiresActionRun: OpenAI.Beta.Threads.Runs.Run | undefined = activeRuns.find(r => r.status === 'requires_action')
```

**Características Específicas:**
- ✅ **Detección de requires_action para disponibilidad hotelera** (run.status: string = 'requires_action')
- ✅ **Cancelación de runs huérfanos en consultas de reservas** (openaiClient.beta.threads.runs.cancel(threadId: string, run.id: string): Promise<void>)
- ✅ **Backoff para race conditions en consultas de Beds24** (backoffDelay: number = Math.min((addAttempts + 1) * 1000, 5000))
- ✅ **Métricas de latencia específicas para reservas** (setLatency(durationMs: number): void)

**Específico de Hotelería**: Optimizado para delays en consultas real-time de disponibilidad hotelera, integrando con sistemas como Beds24.

#### **Booking Confirmation Flow (Líneas ~1411-2390)**
```typescript
// Funcionalidad: Flujo de confirmación de reservas vía tool calls
toolCalls: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[] = run.required_action.submit_tool_outputs.tool_calls
```

**Características Específicas:**
- ✅ **Procesamiento de tool calls para reservas hoteleras** (functionName: string = toolCall.function.name)
- ✅ **Validación de argumentos de reserva (fechas, huéspedes)** (functionArgs: any = JSON.parse(toolCall.function.arguments))
- ✅ **Envío de outputs parseados de Beds24** (toolOutputs.push({tool_call_id: string, output: string}): void)
- ✅ **Fallback para errores en reservas (e.g., no disponibilidad)** (errorOutput: string = `Error ejecutando función: ${error.message}`)

**Específico de Hotelería**: Flujo para ejecutar y confirmar reservas, con transformación de datos de Beds24 y manejo de errores específico de escenarios hoteleros.

---

### 💬 **3. Contexto y Conocimiento Hotelero**

#### **Hotel Context Injection (Líneas ~1394-1486)**
```typescript
// Funcionalidad: Inyección de contexto temporal para consultas hoteleras
async function getRelevantContext(userId: string, requestId?: string): Promise<string>
currentDate: string = new Date().toLocaleDateString('es-ES', { timeZone: 'America/Bogota', ... })
currentTime: string = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Bogota', ... })
allLabels: string[] = [...new Set([...profileLabels, ...chatLabels])].slice(0, 2)
context: string = `Fecha: ${currentDate} | Hora: ${currentTime} (Colombia)\nCliente: ${clientName} | Contacto WhatsApp: ${contactName} | Status: ${allLabels.join(', ')}`
```

**Características Específicas:**
- ✅ **Timezone fijo de Colombia para disponibilidad** (timeZone: string = 'America/Bogota')
- ✅ **Inclusión de labels hoteleros (e.g., 'VIP', 'Reservado')** (allLabels: string[] via guestMemory y whapiLabels)
- ✅ **Perfil de huésped con nombres adaptados** (clientName: string, contactName: string)
- ✅ **Cache con TTL para contexto de reservas** (CONTEXT_CACHE_TTL: number = 60 * 60 * 1000, contextCache: Map<string, {context: string, timestamp: number}>)
- ✅ **Inyección en mensajes para consultas hoteleras** (messageWithContext: string = temporalContext + userMsg)

**Específico de Hotelería**: Contexto enfocado en fecha/hora local para disponibilidad de habitaciones, y labels para status de huéspedes como 'Reservado'.

#### **Guest Profile Persistence (Líneas ~71-80)**
```typescript
// Funcionalidad: Persistencia de perfiles de huéspedes
guestMemory: { getOrCreateProfile(userId: string, forceUpdate: boolean = false): Promise<{name: string, whapiLabels: any[]}> }
profile: {name: string, whapiLabels: {name: string}[]} = await guestMemory.getOrCreateProfile(userId: string)
```

**Características Específicas:**
- ✅ **Creación de perfiles de huéspedes con labels hoteleros** (name: string, whapiLabels: {name: string}[] e.g., 'Check-in Pendiente')
- ✅ **Sincronización con WHAPI para status de reservas** (chatLabels: {name: string}[] = chatInfo?.labels || [])
- ✅ **Actualización antes de procesamiento de consultas** (forceUpdate: boolean = false)
- ✅ **Uso en contexto para interacción personalizada** (profileLabels: string[] = profile?.whapiLabels?.map(l => l.name) || [])

**Específico de Hotelería**: Persistencia orientada a huéspedes (guests), con labels para status como 'Reservado' o 'VIP', común en gestión hotelera.

---

### 🏨 **4. Análisis de Media en Contexto Hotelero**

#### **Image Analysis for Hotel Queries (Líneas ~2500-fin, en setupWebhooks)**
```typescript
// Funcionalidad: Análisis de imágenes en contexto de hotel
async function analyzeImage(imageUrl: string | undefined, userId: string, messageId?: string): Promise<string>
visionResponse = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
        role: 'user',
        content: [
            { type: 'text', text: 'Analiza esta imagen en el contexto de un hotel. Describe brevemente qué ves, enfocándote en: habitaciones, instalaciones, documentos, o cualquier elemento relevante para consultas hoteleras. Máximo 100 palabras.' },
            { type: 'image_url', image_url: { url: finalImageUrl, detail: 'low' } }
        ]
    }],
    max_tokens: 150,
    temperature: 0.3
})
```

**Características Específicas:**
- ✅ **Prompt adaptado a contexto hotelero** (habitaciones, instalaciones, documentos, consultas hoteleras: string)
- ✅ **Obtención de URL desde WHAPI para imágenes de huéspedes** (finalImageUrl: string = messageData.image?.link)
- ✅ **Análisis con low detail para optimización en reservas** (detail: 'low' para costos)
- ✅ **Fallback si URL inválida** (throw Error('URL de imagen inválida o no disponible'))

**Específico de Hotelería**: Prompt enfocado en elementos hoteleros como habitaciones o documentos de reserva, no genérico para otros dominios.

---

### 📱 **5. Integración con WHAPI para Etiquetas Hoteleras**

#### **Hotel-Specific Labels and Chat Info (Líneas ~71-80)**
```typescript
// Funcionalidad: Etiquetas WHAPI para status hoteleros
whapiLabels: { getChatInfo(userId: string): Promise<{name: string, labels: {name: string}[]}> }
chatLabels: string[] = chatInfo?.labels?.map(l => l.name) || []
profileLabels: string[] = profile?.whapiLabels?.map(l => l.name) || []
```

**Características Específicas:**
- ✅ **Extracción de labels para status de huéspedes** (Status: ${allLabels.join(', ')}: string, e.g., 'Reservado', 'VIP')
- ✅ **Sincronización de chat info para perfiles hoteleros** (chatInfo: {name: string, labels: {name: string}[]})
- ✅ **Límite a 2 labels principales para contexto de reservas** (.slice(0, 2): string[])
- ✅ **Uso en contexto temporal para consultas personalizadas** (Cliente: ${clientName} | ... | Status: ...: string)

**Específico de Hotelería**: Labels diseñados para status como 'Pendiente Pago' o 'Check-in', común en gestión de reservas hoteleras.

---

### 🎯 **6. Lógica de Negocio Hotelera**

#### **Timezone and Temporal Context for Reservations (Líneas ~1394-1486)**
```typescript
// Funcionalidad: Contexto temporal adaptado a hotelería colombiana
timeZone: string = 'America/Bogota'
currentDate: string = new Date().toLocaleDateString('es-ES', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' })
currentTime: string = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit', hour12: true })
```

**Características Específicas:**
- ✅ **Timezone fijo para Colombia en consultas de disponibilidad** (America/Bogota: string)
- ✅ **Formato AM/PM para horarios de check-in/out** (hour12: boolean = true)
- ✅ **Inclusión en cada mensaje para reservas por fecha/hora** (Fecha: ${currentDate} | Hora: ${currentTime} (Colombia): string)
- ✅ **Cache para optimización en entornos hoteleros** (isFirstMessageAfterRestart: boolean = (now - cached.timestamp) > CONTEXT_CACHE_TTL)

**Específico de Hotelería**: Enfocado en disponibilidad por fecha/hora local en Colombia, esencial para reservas hoteleras regionales.

---

## 📊 **Métricas de Funcionalidades Específicas**

### **Distribución por Categoría**
| Categoría | Funciones | Líneas Aproximadas | Complejidad |
|-----------|-----------|-------------------|-------------|
| Function Calling | 2 | ~300 | Alta |
| Disponibilidad y Reservas | 2 | ~200 | Media |
| Contexto Hotelero | 2 | ~150 | Baja |
| Análisis de Media | 1 | ~100 | Baja |
| Integración WHAPI | 1 | ~100 | Media |
| Lógica de Negocio | 1 | ~100 | Media |
| **TOTAL** | **9** | **~950** | **Media** |

### **Funcionalidades Críticas vs Opcionales**

#### **🔴 CRÍTICAS (Esenciales para hotelería)**
- Function calling para check_availability con parseo de Beds24
- Contexto temporal con labels y timezone Colombia
- Persistencia de perfiles guests con status hoteleros

#### **🟡 IMPORTANTES (Mejoran la experiencia)**
- Mensajes interinos para disponibilidad
- Análisis de imágenes en contexto hotelero
- Tracing y fallbacks para tool calls de reservas

#### **🟢 OPCIONALES (Optimizaciones avanzadas)**
- Cache para contexto hotelero
- Detección de loops en function calling para reservas

---

## 🎯 **Criterios de Clasificación**

### **¿Qué VA a la Industria Hotelera?**

#### **✅ CRITERIOS DE INCLUSIÓN**
1. **Específico de dominio**: Involucra reservas, huéspedes, disponibilidad hotelera
2. **Dependiente de APIs**: WHAPI labels para status hoteleros, function-registry para check_availability con Beds24
3. **Lógica de negocio**: Mensajes interinos para consultas de habitaciones, parseo de datos de reservas
4. **Contenido específico**: Timezone Colombia, labels como 'Reservado', prompts para análisis hotelero
5. **Configuración propia**: Transformación de info de Beds24 a OpenAI

#### **✅ EJEMPLOS CLAROS**
- Check_availability en tool calls con parseo de Beds24 (solo para disponibilidad hotelera)
- Labels WHAPI para status de huéspedes (e.g., 'Reservado')
- Mensaje interino "consultar disponibilidad" (específico de reservas)
- Contexto con "Cliente" y "Status" (adaptado a perfiles hoteleros)
- Prompt de analyzeImage para "habitaciones, instalaciones" (contexto hotelero)

### **¿Qué NO VA a la Industria Hotelera?**

#### **❌ CRITERIOS DE EXCLUSIÓN**
1. **Genérico**: Funciona para cualquier industria (e.g., prompts de voz concisos, flujos manuales)
2. **Técnico**: Manejo de infraestructura (e.g., polling, logging)
3. **Reutilizable**: Se puede usar en otros dominios (e.g., transcripción voz, TTS)
4. **Configurable**: Se adapta sin código específico (e.g., WhatsApp envío, manual sync abstractable)
5. **Escalable**: No depende de hotelería (e.g., threads OpenAI, buffers)

#### **❌ EJEMPLOS CLAROS**
- Voice instructions y TTS (genérico, OpenAI maneja respuestas naturales)
- Manual agent handling (abstractable para cualquier soporte, sin "agente" hardcodeado)
- SendWhatsAppMessage y subscribeToPresence (general para cualquier industria usando WhatsApp)
- TranscribeAudio (genérico para cualquier voz)
- ProcessGlobalBuffer (agrupación universal)

---

## 🚀 **Beneficios de esta Separación**

### **Para la Industria Hotelera**
- **Enfoque**: Solo lógica de reservas y parseo de Beds24
- **Flexibilidad**: Cambios en labels o functions sin afectar base
- **Testing**: Tests para flujos hoteleros (e.g., check_availability con Beds24)
- **Deployment**: Módulos independientes para hotelería
- **Optimización**: Mejoras en contexto temporal para reservas

### **Para el Proyecto Base**
- **Reutilización**: Código técnico ~70-80% genérico
- **Mantenimiento**: Bugs en base no afectan hotelería
- **Testing**: Tests unitarios para infra
- **Documentación**: APIs claras para extensión
- **Escalabilidad**: Fácil adaptar a otros sectores (e.g., retail con sus propias functions)

---

## 📋 **Próximos Pasos**

### **1. Validación del Análisis**
- [ ] Revisar functions en function-registry.js para parseo de Beds24
- [ ] Confirmar labels WHAPI con ejemplos hoteleros
- [ ] Validar con equipo de desarrollo hotelero
- [ ] Documentar integraciones como Beds24

### **2. Plan de Parametrización**
- [ ] Crear config para functions hoteleras (e.g., Beds24 API keys)
- [ ] Identificar hooks para inyección hotelera (e.g., callback para contexto)
- [ ] Plan de migración a módulos sectoriales
- [ ] Tests end-to-end para flujos de reservas

### **3. Implementación**
- [ ] Extraer functions a /sectors/hotel/
- [ ] Crear interfaces para contexto hotelero
- [ ] Implementar tests para check_availability
- [ ] Documentar APIs sectoriales

---

## 📚 **Referencias**

### **Documentos Relacionados**
- [Inventario Completo](./INVENTARIO_COMPLETO_APP_UNIFIED.md)
- [Arquitectura Modular](./ARQUITECTURA_MODULAR_BOT.md)
- [Proyecto Base](./PROYECTO_BASE_FUNCIONALIDADES.md)

### **Archivos de Código**
- `src/app-unified.ts` - Archivo principal analizado
- `src/functions/registry/function-registry.js` - Registry para check_availability y parseo de Beds24
- `src/utils/whapi/index.js` - Labels y chat info hoteleros
- `src/utils/persistence/index.js` - Persistencia de guests

---

*Documento creado: July 24, 2025*  
*Versión: 2.0 - Retroalimentación Incorporada*  
*Autor: Grok - Basado en análisis de Alexander - TeAlquilamos*