# 🖥️ Guía de Logs de Terminal - Sistema Limpio

## 🎯 Resumen Ejecutivo

El sistema de logs de terminal ha sido **optimizado para simplicidad y legibilidad**, eliminando logs técnicos innecesarios y enfocándose en el flujo humano de conversación. Los logs técnicos detallados siguen disponibles en archivos JSON estructurados para debugging avanzado.

## 🚀 **Cambios Implementados (Julio 2025)**

### **✅ Logs Eliminados de Terminal**
- ❌ `⏰ Timer configurado para 10s por typing`
- ❌ `⏰ Timer ANIQUILADO por typing (era de 5s o 10s)`
- ❌ `🔍 TYPING DETECTADO - Buffer existe: true, Mensajes: 2, Timer activo: true`

### **✅ Logs Limpios Mantenidos**
- ✅ `✍️ Usuario está escribiendo...` - Indicador de typing
- ✅ `👤 Usuario: "mensaje"` - Mensajes de texto del usuario
- ✅ `🤖 OpenAI → Usuario: "respuesta" (duración)` - Respuestas de OpenAI
- ✅ `⏰ ✍️ Usuario dejó de escribir.` - Indicador de stop typing
- ✅ `📷 Usuario: [Imagen recibida]` - Imágenes recibidas
- ✅ `🎤 Usuario: [Nota de voz recibida]` - Notas de voz recibidas
- ✅ `📨 Nueva conversación con Usuario` - Inicio de conversación
- ✅ `❌ Error: mensaje` - Errores generales
- ✅ `❌ Error enviar a OpenAI → Usuario: error` - Errores de OpenAI
- ✅ `❌ Error al procesar imagen → Usuario: error` - Errores de imagen
- ✅ `❌ Error al procesar audio → Usuario: error` - Errores de audio
- ✅ `❌ Error en función función: error` - Errores de funciones
- ✅ `❌ Error WHAPI (operación): error` - Errores de WhatsApp API

## 📊 **Ejemplo de Terminal Limpia**

### **Antes (Logs Técnicos):**
```
[BOT] ⏰ Timer ANIQUILADO por typing (era de 5s o 10s)
[BOT] ⏰ Timer configurado para 10s por typing
[BOT] ✍️ 573003913251 está escribiendo...
[BOT] 👤 Sr Alex: "hola como va todo"
[BOT] ⏰ Timer ANIQUILADO por typing (era de 5s o 10s)
[BOT] ⏰ Timer configurado para 10s por typing
[BOT] ✍️ 573003913251 está escribiendo...
[BOT] 👤 Sr Alex: "se dice"
[BOT] ⏰ Timer ANIQUILADO por typing (era de 5s o 10s)
[BOT] ⏰ Timer configurado para 10s por typing
[BOT] ✍️ 573003913251 está escribiendo...
[BOT] 👤 Sr Alex: "voy"
[BOT] 👤 Sr Alex: "a probar un mensaje"
[BOT] 👤 Sr Alex: "largo"
[BOT] 🤖 OpenAI → 573003913251: "Hola, todo va bien, gracias. Veo que estás probando un mensa..." (9.3s)
```

### **Después (Logs Limpios):**
```
[BOT] === Bot TeAlquilamos Iniciado ===
[BOT] 🚀 Servidor: localhost:3008
[BOT] 🔗 Webhook: https://actual-bobcat-handy.ngrok-free.app/hook
[BOT] ✅ Sistema listo

[BOT] 📨 Nueva conversación con Sr Alex
[BOT] ✍️ Sr Alex está escribiendo...
[BOT] 👤 Sr Alex: "hola como va todo"
[BOT] ✍️ Sr Alex está escribiendo...
[BOT] 👤 Sr Alex: "se dice"
[BOT] ✍️ Sr Alex está escribiendo...
[BOT] 👤 Sr Alex: "voy"
[BOT] 👤 Sr Alex: "a probar un mensaje"
[BOT] 👤 Sr Alex: "largo"
[BOT] ⏰ ✍️ Sr Alex dejó de escribir.
[BOT] 🤖 OpenAI → Sr Alex: "Hola, todo va bien, gracias. Veo que estás probando un mensa..." (9.3s)

[BOT] 👤 Sr Alex: "necesito una habitación para mañana"
[BOT] ⏰ ✍️ Sr Alex dejó de escribir.
[BOT] ⚙️ Function calling iniciado
[BOT]   ↳ get_booking_details ejecutándose...
[BOT]   ✓ get_booking_details completada
[BOT] 🤖 OpenAI → Sr Alex: "Perfecto, he consultado la disponibilidad. Tenemos habitaciones..." (12.1s)
```

## 🎯 **Beneficios de los Logs Limpios**

### **1. Simplicidad Operativa**
- **Fácil monitoreo** de conversaciones en tiempo real
- **Menos ruido visual** en la terminal
- **Enfoque en el flujo humano** (typing → mensajes → respuestas)

### **2. Practicidad Hotelera**
- **Identificación rápida** de clientes que "dejan de escribir" frecuentemente
- **Monitoreo de patrones** de conversación
- **Detección de confusiones** o problemas de UX

### **3. Mantenimiento Técnico**
- **Logs técnicos preservados** en archivos JSON para debugging
- **No impacto en performance** del sistema
- **Compatibilidad total** con herramientas de análisis existentes

### **4. Monitoreo de Funciones**
- **Visibilidad de function calling** en tiempo real
- **Tracking de funciones específicas** (Beds24, booking, etc.)
- **Detección de errores** en funciones críticas del negocio

## 📋 **Catálogo Completo de Logs de Terminal**

### **🔄 Logs de Flujo de Conversación**
| Log | Descripción | Ejemplo |
|-----|-------------|---------|
| `✍️ Usuario está escribiendo...` | Usuario está escribiendo | `✍️ Sr Alex está escribiendo...` |
| `👤 Usuario: "mensaje"` | Mensaje de texto recibido | `👤 Sr Alex: "Hola, necesito una habitación"` |
| `⏰ ✍️ Usuario dejó de escribir.` | Usuario dejó de escribir | `⏰ ✍️ Sr Alex dejó de escribir.` |
| `🤖 OpenAI → Usuario: "respuesta" (duración)` | Respuesta de OpenAI | `🤖 OpenAI → Sr Alex: "Perfecto, te ayudo..." (8.2s)` |

### **📱 Logs de Contenido Multimedia**
| Log | Descripción | Ejemplo |
|-----|-------------|---------|
| `📷 Usuario: [Imagen recibida]` | Imagen recibida | `📷 Sr Alex: [Imagen recibida]` |
| `🎤 Usuario: [Nota de voz recibida]` | Nota de voz recibida | `🎤 Sr Alex: [Nota de voz recibida]` |

### **💬 Logs de Conversación**
| Log | Descripción | Ejemplo |
|-----|-------------|---------|
| `📨 Nueva conversación con Usuario` | Inicio de conversación | `📨 Nueva conversación con Sr Alex` |

### **⚙️ Logs de Funciones (Function Calling)**
| Log | Descripción | Ejemplo |
|-----|-------------|---------|
| `⚙️ Function calling iniciado` | OpenAI solicita ejecutar funciones | `⚙️ Function calling iniciado` |
| `  ↳ función ejecutándose...` | Función específica ejecutándose | `  ↳ get_booking_details ejecutándose...` |
| `  ↳ create_booking ejecutándose...` | Otra función ejecutándose | `  ↳ create_booking ejecutándose...` |
| `  ✓ función completada` | Función ejecutada exitosamente | `  ✓ get_booking_details completada` |
| `  ✓ create_booking completada` | Otra función completada | `  ✓ create_booking completada` |

### **❌ Logs de Errores**
| Log | Descripción | Ejemplo |
|-----|-------------|---------|
| `❌ Error: mensaje` | Error general | `❌ Error: Sin respuesta (15s)` |
| `❌ Error enviar a OpenAI → Usuario: error` | Error de OpenAI | `❌ Error enviar a OpenAI → Sr Alex: ECONNRESET` |
| `❌ Error al procesar imagen → Usuario: error` | Error de imagen | `❌ Error al procesar imagen → Sr Alex: Invalid format` |
| `❌ Error al procesar audio → Usuario: error` | Error de audio | `❌ Error al procesar audio → Sr Alex: Transcription failed` |
| `❌ Error en función función: error` | Error de función | `❌ Error en función get_booking_details: API timeout` |
| `❌ Error WHAPI (operación): error` | Error de WhatsApp | `❌ Error WHAPI (enviar mensaje): Rate limit exceeded` |

### **🚀 Logs de Startup**
| Log | Descripción | Ejemplo |
|-----|-------------|---------|
| `=== Bot TeAlquilamos Iniciado ===` | Inicio del bot | `=== Bot TeAlquilamos Iniciado ===` |
| `🚀 Servidor: host:puerto` | Configuración del servidor | `🚀 Servidor: localhost:3008` |
| `🔗 Webhook: URL` | URL del webhook | `🔗 Webhook: https://actual-bobcat-handy.ngrok-free.app/hook` |
| `✅ Sistema listo` | Sistema listo | `✅ Sistema listo` |

## 🔧 **Logs Técnicos Disponibles**

### **Archivos JSON Estructurados**
Los logs técnicos siguen disponibles para debugging avanzado:

```json
{
  "timestamp": "2025-07-22T18:13:00.730Z",
  "level": "INFO",
  "category": "PRESENCE_RECEIVED",
  "message": "Presencia para 573003913251: typing",
  "metadata": {
    "userId": "573003913251",
    "status": "typing",
    "environment": "local"
  }
}
```

### **Categorías Técnicas Disponibles**
- `PRESENCE_RECEIVED` - Eventos de typing/online/offline
- `BUFFER_PROCESS_DELAYED_BY_RECENT_TYPING` - Retrasos por typing reciente
- `GLOBAL_BUFFER_ADD` - Mensajes agregados al buffer
- `GLOBAL_BUFFER_PROCESS` - Procesamiento de buffer
- `OPENAI_PROCESSING_START` - Inicio de procesamiento con OpenAI

## 🛠️ **Implementación Técnica**

### **Código Modificado**

#### **1. Eliminación de Logs Técnicos**
```typescript
// ANTES (eliminado):
console.log(`⏰ Timer ANIQUILADO por typing (era de 5s o 10s)`);
console.log(`⏰ Timer configurado para 10s por typing`);

// DESPUÉS:
// Solo terminalLog.typing() se mantiene
terminalLog.typing(buffer.userName || getShortUserId(userId));
```

#### **2. Nuevo Log Simple**
```typescript
// En processGlobalBuffer (antes de procesar):
const displayUser = buffer.userName || getShortUserId(userId);
console.log(`⏰ ✍️ ${displayUser} dejó de escribir.`);
```

#### **3. Unificación de Formato**
```typescript
// En presences (online/offline/pending):
console.log(`⏰ ✍️ ${userName} dejó de escribir.`);
```

#### **4. Logs de Function Calling**
```typescript
// En processWithOpenAI (function calling):
logFunctionCallingStart('function_calling_required', {
    shortUserId,
    threadId,
    runId: run.id,
    toolCallsCount: toolCalls.length,
    environment: appConfig.environment,
    requestId
});

// Para cada función ejecutándose:
logFunctionExecuting('function_executing', {
    shortUserId,
    functionName,
    toolCallId: toolCall.id,
    args: functionArgs,
    environment: appConfig.environment,
    requestId
});

// Cuando la función se completa:
logFunctionHandler('function_success', {
    shortUserId,
    functionName,
    status: 'success',
    toolCallId: toolCall.id,
    resultLength: formattedResult.length,
    environment: appConfig.environment,
    requestId
});
```

## 📋 **Guía de Monitoreo**

### **Para Operadores de Hotel**
1. **Monitorear conversaciones activas:**
   ```
   📨 Nueva conversación con Cliente
   ✍️ Cliente está escribiendo...
   👤 Cliente: "Hola, necesito una habitación"
   👤 Cliente: "para mañana"
   👤 Cliente: "con desayuno incluido"
   ⏰ ✍️ Cliente dejó de escribir.
   ⚙️ Function calling iniciado
     ↳ get_booking_details ejecutándose...
     ✓ get_booking_details completada
   🤖 OpenAI → Cliente: "Perfecto, te ayudo con tu reserva..." (12.1s)
   ```

2. **Identificar patrones problemáticos:**
   - Muchos "dejó de escribir" sin respuesta → Posible confusión
   - Mensajes muy fragmentados → Problema de UX
   - Respuestas lentas → Problema de performance
   - Errores frecuentes → Problema técnico
   - Funciones que fallan → Problema de integración (Beds24, etc.)
   - Function calling muy lento → Problema de APIs externas

3. **Monitorear tipos de contenido:**
   - `📷 Cliente: [Imagen recibida]` - Cliente envió foto
   - `🎤 Cliente: [Nota de voz recibida]` - Cliente envió audio

4. **Monitorear funciones críticas:**
   - `⚙️ Function calling iniciado` - OpenAI está ejecutando funciones
   - `  ↳ get_booking_details ejecutándose...` - Consultando disponibilidad
   - `  ↳ create_booking ejecutándose...` - Creando reserva
   - `  ↳ cancel_booking ejecutándose...` - Cancelando reserva
   - `  ✓ función completada` - Función exitosa
   - `❌ Error en función función: error` - Función falló

### **Para Desarrolladores**
1. **Debugging con logs JSON:**
   ```bash
   # Buscar logs técnicos en archivos JSON
   grep "BUFFER_PROCESS_DELAYED" logs/bot-session-*.log
   ```

2. **Análisis de performance:**
   ```bash
   # Analizar tiempos de respuesta
   grep "OPENAI_PROCESSING_START\|PERFORMANCE_METRICS" logs/bot-session-*.log
   ```

## 🎯 **Configuración y Personalización**

### **Control de Logs de Function Calling**
Los logs de function calling en terminal se pueden controlar mediante la variable de entorno `TERMINAL_LOGS_FUNCTIONS`:

- **`TERMINAL_LOGS_FUNCTIONS=true`** (por defecto): Muestra logs de function calling en terminal
- **`TERMINAL_LOGS_FUNCTIONS=false`**: Oculta logs de function calling en terminal (mantiene logs JSON)

**Ejemplo de uso:**
```bash
# Mostrar logs de function calling (por defecto)
npm run dev

# Ocultar logs de function calling
TERMINAL_LOGS_FUNCTIONS=false npm run dev
```

### **Variables de Entorno**
```env
# Nivel de logs técnicos (JSON)
LOG_LEVEL=INFO  # TRACE, DEBUG, INFO, SUCCESS, WARNING, ERROR, FATAL, ALERT

# Logs de terminal (siempre limpios)
TERMINAL_LOGS_CLEAN=true  # Por defecto: true

# Logs de function calling en terminal
TERMINAL_LOGS_FUNCTIONS=true  # Por defecto: true, usar 'false' para desactivar
```

### **Personalización de Emojis**
```typescript
// En src/app-unified.ts
const terminalLog = {
    // Logs principales
    typing: (userName: string) => console.log(`✍️ ${userName} está escribiendo...`),
    message: (userName: string, text: string) => console.log(`👤 ${userName}: "${text}"`),
    response: (userName: string, text: string, duration: number) => 
        console.log(`🤖 OpenAI → ${userName}: "${text.substring(0, 50)}..." (${duration}s)`),
    
    // Logs de contenido multimedia
    image: (userName: string) => console.log(`📷 ${userName}: [Imagen recibida]`),
    voice: (userName: string) => console.log(`🎤 ${userName}: [Nota de voz recibida]`),
    
    // Logs de conversación
    newConversation: (userName: string) => console.log(`📨 Nueva conversación con ${userName}`),
    
    // Logs de errores
    error: (message: string) => console.log(`❌ Error: ${message}`),
    openaiError: (userName: string, error: string) => console.log(`❌ Error enviar a OpenAI → ${userName}: ${error}`),
    imageError: (userName: string, error: string) => console.log(`❌ Error al procesar imagen → ${userName}: ${error}`),
    voiceError: (userName: string, error: string) => console.log(`❌ Error al procesar audio → ${userName}: ${error}`),
    functionError: (functionName: string, error: string) => console.log(`❌ Error en función ${functionName}: ${error}`),
    whapiError: (operation: string, error: string) => console.log(`❌ Error WHAPI (${operation}): ${error}`),
    
    // Logs de function calling
    functionStart: () => console.log('⚙️ Function calling iniciado'),
    functionExecuting: (name: string) => console.log(`  ↳ ${name} ejecutándose...`),
    functionCompleted: (name: string) => console.log(`  ✓ ${name} completada`),
    
    // Logs de startup
    startup: () => {
        console.log('\n=== Bot TeAlquilamos Iniciado ===');
        console.log(`🚀 Servidor: ${appConfig?.host || 'localhost'}:${appConfig?.port || 3008}`);
        console.log(`🔗 Webhook: ${appConfig?.webhookUrl || 'configurando...'}`);
        console.log('✅ Sistema listo\n');
    }
};
```

## 📊 **Métricas y Análisis**

### **Métricas Disponibles**
- **Tiempo promedio de respuesta** por conversación
- **Frecuencia de "dejó de escribir"** por usuario
- **Patrones de fragmentación** de mensajes
- **Performance del sistema** de buffering
- **Tipos de contenido** (texto, imagen, audio)
- **Frecuencia de errores** por categoría
- **Duración de conversaciones** por usuario
- **Uso de funciones** por tipo (booking, availability, etc.)
- **Tiempo de ejecución** de funciones críticas
- **Tasa de éxito** de function calling

### **Herramientas de Análisis**
- **Parser de logs** en `tools/log-tools/`
- **Dashboard de métricas** en `/metrics`
- **Análisis de patrones** en archivos JSON

## ✅ **Validación de Implementación**

### **Tests Automatizados**
```bash
# Verificar logs limpios
npm run test:terminal-logs

# Verificar logs técnicos JSON
npm run test:json-logs
```

### **Verificación Manual**
1. **Iniciar bot:** `npm run dev:local`
2. **Enviar mensajes fragmentados** con typing
3. **Verificar terminal:** Solo logs limpios visibles
4. **Verificar archivos JSON:** Logs técnicos presentes

## 🚀 **Próximas Mejoras**

### **Fase 1 (Completada)**
- ✅ Eliminación de logs técnicos de terminal
- ✅ Implementación de logs limpios
- ✅ Preservación de logs técnicos en JSON
- ✅ **Implementación de logs de function calling en terminal**

### **Fase 2 (Planificada)**
- 🔄 **Logs de color** para mejor legibilidad
- 🔄 **Filtros dinámicos** por tipo de evento
- 🔄 **Exportación de métricas** a dashboards externos

### **Fase 3 (Futura)**
- 🔄 **Alertas automáticas** basadas en patrones
- 🔄 **Análisis predictivo** de comportamiento de usuarios
- 🔄 **Integración con herramientas** de monitoreo empresarial

## ✅ **Implementación de Logs de Function Calling (Julio 2025)**

### **Cambios Realizados**

#### **1. Extensión del objeto `terminalLog`**
```typescript
// Agregado en src/app-unified.ts línea ~99
functionStart: () => console.log('⚙️ Function calling iniciado'),
functionExecuting: (name: string) => console.log(`  ↳ ${name} ejecutándose...`),
functionCompleted: (name: string) => console.log(`  ✓ ${name} completada`),
```

#### **2. Variable de entorno de control**
```typescript
// Agregado en src/app-unified.ts línea ~160
const SHOW_FUNCTION_LOGS = process.env.TERMINAL_LOGS_FUNCTIONS !== 'false'; // true por defecto
```

#### **3. Implementación en el bloque `requires_action`**
```typescript
// En src/app-unified.ts línea ~2300
// Log inicial de function calling
if (SHOW_FUNCTION_LOGS) {
    terminalLog.functionStart();
}

// En el loop de toolCalls
if (SHOW_FUNCTION_LOGS) {
    terminalLog.functionExecuting(functionName);
}

// Después de ejecución exitosa
if (SHOW_FUNCTION_LOGS) {
    terminalLog.functionCompleted(functionName);
}
```

### **Configuración**
- **Por defecto:** Los logs de function calling están habilitados
- **Desactivar:** `TERMINAL_LOGS_FUNCTIONS=false npm run dev`
- **Activar:** `TERMINAL_LOGS_FUNCTIONS=true npm run dev` (por defecto)

### **Archivos Modificados**
- ✅ `src/app-unified.ts` - Implementación principal
- ✅ `docs/logging/TERMINAL_LOGS_GUIDE.md` - Documentación actualizada
- ✅ `tests/logging/test-function-calling-logs.js` - Tests de validación

### **Resultado**
Ahora la implementación coincide completamente con la guía de documentación, proporcionando visibilidad en tiempo real de function calling para operadores hoteleros mientras mantiene los logs técnicos en JSON para debugging avanzado.

---

## 📚 **Referencias Relacionadas**

- [Sistema de Logging Completo](./LOGGING_SYSTEM_COMPLETE.md)
- [Sistema de Typing](../features/TYPING_SYSTEM.md)
- [Herramientas de Análisis de Logs](../../tools/log-tools/README.md) 