# 📟 Terminal Logging System - Documentación Técnica Completa

## 📋 Resumen Ejecutivo

El **Terminal Logging System** es un componente especializado del bot que proporciona **feedback visual inmediato** en la consola del desarrollador durante la ejecución. A diferencia del sistema de logging JSON estructurado, este sistema está optimizado para **monitoreo en tiempo real** y **debugging interactivo** con formato human-readable.

---

## 🏗️ Arquitectura del Sistema

### **Ubicación en el Código**
- **Archivo**: `src/app-unified.ts`
- **Líneas**: 100-217 (117 líneas de código)
- **Tipo**: Objeto literal con 19 métodos especializados

### **Diseño Conceptual**

```typescript
const terminalLog = {
    // Grupo 1: Flujo principal de mensajes
    message: (user, text) => { /* Log de entrada */ },
    typing: (user) => { /* Estado de typing */ },
    processing: (user) => { /* Procesamiento iniciado */ },
    response: (user, text, duration) => { /* Respuesta enviada */ },
    
    // Grupo 2: Gestión de errores
    error: (message) => { /* Error general */ },
    openaiError: (user, error) => { /* Error OpenAI */ },
    imageError: (user, error) => { /* Error imágenes */ },
    voiceError: (user, error) => { /* Error audio */ },
    functionError: (functionName, error) => { /* Error funciones */ },
    whapiError: (operation, error) => { /* Error WhatsApp API */ },
    
    // Grupo 3: Function calling detallado
    functionStart: (name, args) => { /* Inicio función */ },
    functionProgress: (name, step, data) => { /* Progreso función */ },
    functionCompleted: (name, result, duration) => { /* Función completada */ },
    
    // Grupo 4: Eventos del sistema
    startup: () => { /* Inicio del bot */ },
    newConversation: (user) => { /* Nueva conversación */ },
    
    // Grupo 5: Multimedia
    image: (user) => { /* Imagen recibida */ },
    voice: (user) => { /* Voz recibida */ },
    recording: (user) => { /* Grabando audio */ },
    
    // Grupo 6: Especializados
    availabilityResult: (completas, splits, duration) => { /* Resultado búsqueda */ },
    externalApi: (service, action, result) => { /* APIs externas */ }
};
```

---

## 📊 Inventario Completo de Métodos

### **🔵 Grupo 1: Flujo Principal de Mensajes**

#### **1. `message(user: string, text: string)`**
```typescript
message: (user: string, text: string) => {
    console.log(`👤 ${user}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);
}
```
- **Propósito**: Log de mensajes entrantes del usuario
- **Formato**: `👤 Usuario: "mensaje truncado..."`
- **Truncamiento**: Máximo 60 caracteres
- **Usado en**: Recepción de mensajes de texto y voz transcrita

#### **2. `typing(user: string)`**
```typescript
typing: (user: string) => {
    console.log(`✍️ ${user} está escribiendo...`);
}
```
- **Propósito**: Indicar que el usuario está escribiendo
- **Formato**: `✍️ Usuario está escribiendo...`
- **Activado por**: Eventos de presence de WhatsApp
- **Rate limited**: Sí (10 segundos por usuario)

#### **3. `processing(user: string)` - DESHABILITADO**
```typescript
processing: (user: string) => {
    // 🔧 ELIMINADO: No mostrar en terminal
}
```
- **Estado**: Método vacío intencionalmente
- **Razón**: Reducir ruido en terminal durante desarrollo
- **Historial**: Anteriormente mostraba inicio de procesamiento

#### **4. `response(user: string, text: string, duration: number)`**
```typescript
response: (user: string, text: string, duration: number) => {
    console.log(`🤖 OpenAI → ${user}: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}" (${duration}s)`);
}
```
- **Propósito**: Log de respuestas enviadas al usuario
- **Formato**: `🤖 OpenAI → Usuario: "respuesta..." (2.3s)`
- **Incluye**: Tiempo de procesamiento en segundos
- **Truncamiento**: Máximo 60 caracteres

---

### **🔴 Grupo 2: Gestión de Errores**

#### **5. `error(message: string)`**
```typescript
error: (message: string) => {
    console.log(`❌ Error: ${message}`);
}
```
- **Propósito**: Errores generales del sistema
- **Formato**: `❌ Error: descripción`
- **Uso**: Errores no categorizados específicamente

#### **6. `openaiError(user: string, error: string)`**
```typescript
openaiError: (user: string, error: string) => {
    console.log(`❌ Error enviar a OpenAI → ${user}: ${error}`);
}
```
- **Propósito**: Errores específicos de OpenAI API
- **Formato**: `❌ Error enviar a OpenAI → Usuario: error`
- **Contexto**: Incluye usuario afectado

#### **7. `imageError(user: string, error: string)`**
```typescript
imageError: (user: string, error: string) => {
    console.log(`❌ Error al procesar imagen → ${user}: ${error}`);
}
```
- **Propósito**: Errores de procesamiento de imágenes
- **Formato**: `❌ Error al procesar imagen → Usuario: error`
- **Casos**: Fallas en análisis GPT-4 Vision

#### **8. `voiceError(user: string, error: string)`**
```typescript
voiceError: (user: string, error: string) => {
    console.log(`❌ Error al procesar audio → ${user}: ${error}`);
}
```
- **Propósito**: Errores de transcripción y TTS
- **Formato**: `❌ Error al procesar audio → Usuario: error`
- **Casos**: Fallas Whisper API, TTS, descarga audio

#### **9. `functionError(functionName: string, error: string)`**
```typescript
functionError: (functionName: string, error: string) => {
    console.log(`❌ Error en función ${functionName}: ${error}`);
}
```
- **Propósito**: Errores en function calling de OpenAI
- **Formato**: `❌ Error en función nombre_funcion: error`
- **Contexto**: Identifica función específica que falló

#### **10. `whapiError(operation: string, error: string)`**
```typescript
whapiError: (operation: string, error: string) => {
    console.log(`❌ Error WHAPI (${operation}): ${error}`);
}
```
- **Propósito**: Errores de WhatsApp API
- **Formato**: `❌ Error WHAPI (operacion): error`
- **Operaciones**: sendMessage, setTyping, getFile, etc.

---

### **⚙️ Grupo 3: Function Calling Detallado**

#### **11. `functionStart(name: string, args?: any)`**
```typescript
functionStart: (name: string, args?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    if (name === 'check_availability' && args) {
        const { startDate, endDate, guests } = args;
        console.log(`🏨 [${timestamp}] ${name}(${startDate} → ${endDate}, ${guests || '?'} personas)`);
    } else {
        console.log(`⚙️ [${timestamp}] ${name}() iniciando...`);
    }
}
```
- **Propósito**: Inicio de funciones de OpenAI
- **Formato General**: `⚙️ [HH:MM:SS] nombre_funcion() iniciando...`
- **Formato Especial**: `🏨 [HH:MM:SS] check_availability(2025-01-15 → 2025-01-18, 2 personas)`
- **Timestamp**: Hora local incluida

#### **12. `functionProgress(name: string, step: string, data?: any)`**
```typescript
functionProgress: (name: string, step: string, data?: any) => {
    if (name === 'check_availability') {
        if (step.includes('Beds24')) {
            console.log(`  ⏳ Consultando Beds24...`);
        } else if (step.includes('procesando')) {
            const props = data?.propertyCount || '?';
            console.log(`  📊 ${props} propiedades → procesando...`);
        }
    } else {
        console.log(`  ⏳ ${name} → ${step}`);
    }
}
```
- **Propósito**: Progreso de funciones de larga duración
- **Formato General**: `  ⏳ nombre_funcion → paso`
- **Formato check_availability**: 
  - `  ⏳ Consultando Beds24...`
  - `  📊 5 propiedades → procesando...`
- **Indentación**: 2 espacios para mostrar jerarquía

#### **13. `functionCompleted(name: string, result?: any, duration?: number)`**
```typescript
functionCompleted: (name: string, result?: any, duration?: number) => {
    const timestamp = new Date().toLocaleTimeString();
    const durationStr = duration ? `(${(duration/1000).toFixed(1)}s)` : '';
    
    if (name === 'check_availability' && result) {
        const resultLength = typeof result === 'string' ? result.length : JSON.stringify(result).length;
        console.log(`  ✅ Resultado: ${resultLength} chars ${durationStr}`);
    } else {
        console.log(`  ✓ ${name} completada ${durationStr}`);
    }
}
```
- **Propósito**: Finalización de funciones
- **Formato General**: `  ✓ nombre_funcion completada (2.1s)`
- **Formato check_availability**: `  ✅ Resultado: 1247 chars (3.2s)`
- **Duración**: Convertida de ms a segundos con 1 decimal

---

### **🚀 Grupo 4: Eventos del Sistema**

#### **14. `startup()`**
```typescript
startup: () => {
    console.clear();
    console.log('\n=== Bot TeAlquilamos Iniciado ===');
    console.log(`🚀 Servidor: ${appConfig?.host || 'localhost'}:${appConfig?.port || 3008}`);
    console.log(`🔗 Webhook: ${appConfig?.webhookUrl || 'configurando...'}`);
    console.log('✅ Sistema listo\n');
}
```
- **Propósito**: Banner de inicio del bot
- **Características**:
  - Limpia la consola (`console.clear()`)
  - Muestra configuración del servidor
  - Muestra URL del webhook
  - Formato visual llamativo

#### **15. `newConversation(user: string)`**
```typescript
newConversation: (user: string) => {
    console.log(`\n📨 Nueva conversación con ${user}`);
}
```
- **Propósito**: Indica inicio de nueva conversación
- **Formato**: `📨 Nueva conversación con Usuario`
- **Activado**: Al crear nuevo thread de OpenAI
- **Espaciado**: Línea en blanco antes para separar

---

### **🎨 Grupo 5: Multimedia**

#### **16. `image(user: string)`**
```typescript
image: (user: string) => {
    console.log(`📷 ${user}: [Imagen recibida]`);
}
```
- **Propósito**: Notificar recepción de imagen
- **Formato**: `📷 Usuario: [Imagen recibida]`
- **Privacidad**: No muestra contenido, solo recepción

#### **17. `voice(user: string)`**
```typescript
voice: (user: string) => {
    console.log(`🎤 ${user}: [Nota de voz recibida]`);
}
```
- **Propósito**: Notificar recepción de audio
- **Formato**: `🎤 Usuario: [Nota de voz recibida]`
- **Nota**: Transcripción se muestra después vía `message()`

#### **18. `recording(user: string)`**
```typescript
recording: (user: string) => {
    console.log(`🎙️ ${user} está grabando...`);
}
```
- **Propósito**: Indicar que usuario está grabando
- **Formato**: `🎙️ Usuario está grabando...`
- **Activado**: Por eventos de presence de WhatsApp

---

### **⭐ Grupo 6: Especializados**

#### **19. `availabilityResult(completas: number, splits: number, duration?: number)`**
```typescript
availabilityResult: (completas: number, splits: number, duration?: number) => {
    const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : '';
    console.log(`  ✨ Disponibilidad → ${completas} completas, ${splits} con traslados${durationStr}`);
}
```
- **Propósito**: Resultado específico de búsqueda de disponibilidad
- **Formato**: `  ✨ Disponibilidad → 3 completas, 1 con traslados (2.1s)`
- **Contexto**: Solo para función `check_availability`
- **Métricas**: Cuenta habitaciones completas vs con traslados

#### **20. `externalApi(service: string, action: string, result?: string)`**
```typescript
externalApi: (service: string, action: string, result?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    if (result) {
        console.log(`🔗 [${timestamp}] ${service} → ${action} → ${result}`);
    } else {
        console.log(`🔗 [${timestamp}] ${service} → ${action}...`);
    }
}
```
- **Propósito**: Log de llamadas a APIs externas
- **Formato con resultado**: `🔗 [HH:MM:SS] Beds24 → getAvailability → 200 OK`
- **Formato sin resultado**: `🔗 [HH:MM:SS] Beds24 → getAvailability...`
- **Servicios**: Beds24, WHAPI, OpenAI, etc.

---

## 🎯 Características Avanzadas

### **1. Rate Limiting Inteligente**

```typescript
// Rate limiting para logs de typing (línea 222)
const typingLogTimestamps = new Map<string, number>();

// Implementación en updateTypingStatus()
const now = Date.now();
const lastLog = typingLogTimestamps.get(userId) || 0;
if (now - lastLog > 10000) { // 10 segundos
    terminalLog.typing(userName);
    typingLogTimestamps.set(userId, now);
}
```
- **Propósito**: Evitar spam de logs de typing
- **Intervalo**: Máximo 1 log cada 10 segundos por usuario
- **Beneficio**: Terminal más limpio durante conversaciones largas

### **2. Truncamiento Inteligente**

```typescript
// Patrón usado en message() y response()
const truncated = `"${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`;
```
- **Límite**: 60 caracteres máximo
- **Indicador**: `...` cuando se trunca
- **Razón**: Mantener logs legibles en terminal

### **3. Timestamps Contextuales**

```typescript
// Solo en funciones críticas
const timestamp = new Date().toLocaleTimeString();
```
- **Formato**: HH:MM:SS (hora local)
- **Usado en**: Functions, external APIs
- **Propósito**: Tracking preciso de operaciones lentas

### **4. Formateo Visual Consistente**

| Tipo | Emoji | Ejemplo |
|------|-------|---------|
| Usuario | 👤 | `👤 Juan: "Hola"` |
| Bot respuesta | 🤖 | `🤖 OpenAI → Juan: "¡Hola!"` |
| Typing | ✍️ | `✍️ Juan está escribiendo...` |
| Voz | 🎤 | `🎤 Juan: [Nota de voz recibida]` |
| Imagen | 📷 | `📷 Juan: [Imagen recibida]` |
| Error | ❌ | `❌ Error: descripción` |
| Función | ⚙️ | `⚙️ [14:30:15] check_availability() iniciando...` |
| Progreso | ⏳ | `  ⏳ Consultando Beds24...` |
| Completado | ✅ | `  ✅ Resultado: 1247 chars (3.2s)` |
| Disponibilidad | ✨ | `  ✨ Disponibilidad → 3 completas, 1 con traslados` |
| API Externa | 🔗 | `🔗 [14:30:15] Beds24 → getAvailability → 200 OK` |

---

## 🔧 Control y Configuración

### **Variables de Entorno**

```bash
# Control de logs de funciones en terminal
TERMINAL_LOGS_FUNCTIONS=true  # Por defecto true
```

```typescript
// Implementación en línea 232
const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false';
```

### **Logging Condicional**

```typescript
// Ejemplo de uso condicional
if (SHOW_FUNCTION_LOGS) {
    terminalLog.functionStart(functionName, args);
}
```

---

## 📊 Flujo de Uso Típico

### **Secuencia de Conversación Normal**

```
📨 Nueva conversación con Juan

👤 Juan: "Hola, necesito información sobre disponibilidad"
✍️ Juan está escribiendo...
👤 Juan: "para el próximo fin de semana"

🏨 [14:30:15] check_availability(2025-01-25 → 2025-01-27, 2 personas)
  ⏳ Consultando Beds24...
  📊 5 propiedades → procesando...
  ✅ Resultado: 1247 chars (3.2s)
  ✨ Disponibilidad → 3 completas, 1 con traslados (3.2s)

🤖 OpenAI → Juan: "Tenemos excelente disponibilidad para esas fechas..." (5.1s)
```

### **Secuencia con Error**

```
👤 Juan: "¿Hay disponibilidad?"

🏨 [14:30:15] check_availability(2025-01-25 → 2025-01-27, 2 personas)
  ⏳ Consultando Beds24...
❌ Error en función check_availability: Network timeout
❌ Error enviar a OpenAI → Juan: Function call failed

🤖 OpenAI → Juan: "Disculpa, tengo problemas técnicos temporales..." (2.1s)
```

### **Secuencia Multimedia**

```
📷 Juan: [Imagen recibida]
👤 Juan: "¿Qué opinas de esta foto?"

🎤 Juan: [Nota de voz recibida]  
👤 Juan: "Me gustaría saber más detalles sobre las habitaciones"

🤖 OpenAI → Juan: "Veo que la imagen muestra una habitación muy elegante..." (4.2s)
```

---

## ⚠️ Limitaciones y Consideraciones

### **1. No Persistencia**
- Logs solo visibles durante ejecución
- Se pierden al reiniciar el bot
- **Mitigación**: Sistema de logging JSON paralelo para persistencia

### **2. Rate Limiting Básico**
- Solo implementado para typing logs
- Otros eventos pueden generar spam
- **Mejora sugerida**: Rate limiting global por usuario

### **3. Memoria de Rate Limiting**
- Map `typingLogTimestamps` crece indefinidamente
- No hay limpieza automática de entradas antiguas
- **Impacto**: Memory leak potencial en uso prolongado

### **4. Configuración Limitada**
- Solo `TERMINAL_LOGS_FUNCTIONS` es configurable
- Otros aspectos hardcodeados (truncamiento, emojis, etc.)
- **Mejora sugerida**: Configuración más granular

### **5. Formato Fijo**
- Emojis y formato no personalizable
- Puede no ser adecuado para todos los entornos
- **Consideración**: Algunos terminales no soportan emojis

---

## 🚀 Integración con Sistema Principal

### **Relación con Logging JSON**

```typescript
// Terminal logging es COMPLEMENTARIO al sistema principal
terminalLog.response(userName, aiResponse, processingTime);  // Visual
logInfo('OPENAI_RESPONSE_SENT', 'Respuesta enviada', {     // Estructurado
    shortUserId,
    responseLength: aiResponse.length,
    processingTime,
    requestId
});
```

### **Puntos de Integración en el Código**

| Ubicación | Método Terminal | Propósito |
|-----------|----------------|-----------|
| `processWebhook()` | `message()`, `typing()`, `image()`, `voice()` | Entrada de datos |
| `processWithOpenAI()` | `response()`, `openaiError()` | Salida del bot |
| `transcribeAudio()` | `voiceError()` | Errores multimedia |
| `sendWhatsAppMessage()` | `whapiError()` | Errores de envío |
| Function handlers | `functionStart()`, `functionProgress()`, `functionCompleted()` | Function calling |
| Startup | `startup()`, `newConversation()` | Eventos de sistema |

---

## 📝 Recomendaciones de Desarrollo

### **✅ Fortalezas a Mantener**
1. **Feedback inmediato** - Excelente para debugging en vivo
2. **Formato visual consistente** - Fácil de leer y entender
3. **Specialización por tipo de evento** - Contexto apropiado
4. **Rate limiting** - Previene spam en typing

### **⚠️ Áreas de Mejora**

#### **1. Configurabilidad Avanzada**
```typescript
// Propuesta: Configuración via ENV
const TERMINAL_CONFIG = {
    showEmojis: process.env.TERMINAL_SHOW_EMOJIS !== 'false',
    truncateLength: parseInt(process.env.TERMINAL_TRUNCATE_LENGTH) || 60,
    showTimestamps: process.env.TERMINAL_SHOW_TIMESTAMPS === 'true',
    colorOutput: process.env.TERMINAL_USE_COLORS !== 'false'
};
```

#### **2. Rate Limiting Global**
```typescript
// Propuesta: Rate limiting por usuario y tipo de evento
const terminalRateLimiter = new Map<string, { lastLog: number, count: number }>();

function shouldLog(userId: string, eventType: string): boolean {
    const key = `${userId}:${eventType}`;
    const now = Date.now();
    const limit = RATE_LIMITS[eventType] || 1000; // ms
    
    const last = terminalRateLimiter.get(key)?.lastLog || 0;
    if (now - last < limit) return false;
    
    terminalRateLimiter.set(key, { lastLog: now, count: 1 });
    return true;
}
```

#### **3. Cleanup de Memoria**
```typescript
// Propuesta: Limpieza periódica de caches
setInterval(() => {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hora
    
    // Limpiar timestamps de typing
    for (const [key, timestamp] of typingLogTimestamps.entries()) {
        if (now - timestamp > maxAge) {
            typingLogTimestamps.delete(key);
        }
    }
}, 10 * 60 * 1000); // Cada 10 minutos
```

#### **4. Logs Estructurados Opcionalmente**
```typescript
// Propuesta: Modo JSON para environments automatizados
if (process.env.TERMINAL_LOG_FORMAT === 'json') {
    console.log(JSON.stringify({
        type: 'user_message',
        user: userName,
        message: text.substring(0, 60),
        timestamp: new Date().toISOString()
    }));
} else {
    console.log(`👤 ${userName}: "${text.substring(0, 60)}..."`);
}
```

### **🔧 Refactoring Sugerido**

#### **Extraer a Clase Especializada**
```typescript
class TerminalLogger {
    private config: TerminalConfig;
    private rateLimiter: RateLimiter;
    
    constructor(config?: Partial<TerminalConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.rateLimiter = new RateLimiter();
    }
    
    message(user: string, text: string): void {
        if (!this.rateLimiter.shouldLog(user, 'message')) return;
        
        const formatted = this.formatMessage('👤', user, text);
        this.output(formatted);
    }
    
    private formatMessage(emoji: string, user: string, text: string): string {
        const truncated = this.truncateText(text);
        return `${emoji} ${user}: "${truncated}"`;
    }
    
    private output(message: string): void {
        if (this.config.format === 'json') {
            // JSON output
        } else {
            console.log(message);
        }
    }
}
```

---

## 🎯 Conclusión

El **Terminal Logging System** es un componente **altamente especializado** que proporciona feedback visual inmediato indispensable para desarrollo y debugging. Su diseño con **19 métodos especializados** cubre todos los aspectos críticos del flujo del bot.

**Fortalezas principales**:
- ✅ **Feedback inmediato** para desarrollo interactivo
- ✅ **Formato visual consistente** y fácil de leer
- ✅ **Specialización por contexto** (errores, funciones, multimedia)
- ✅ **Rate limiting básico** implementado

**Oportunidades de mejora**:
- ⚠️ **Configurabilidad limitada** - solo 1 variable ENV
- ⚠️ **Memory management** - caches sin limpieza automática
- ⚠️ **Rate limiting parcial** - solo para typing
- ⚠️ **Formato fijo** - no adaptable a diferentes entornos

**Estado actual**: ✅ **Funcionalmente excelente** para desarrollo local, con oportunidades de optimización para entornos de producción y uso a largo plazo.

---

**Referencias de Código**:
- `src/app-unified.ts:100-217` - Objeto terminalLog completo
- `src/app-unified.ts:222` - Rate limiting de typing
- `src/app-unified.ts:232` - Control de logs de funciones