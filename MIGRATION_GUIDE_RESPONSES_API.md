# Guía de Migración: Assistants API → Responses API

## 📋 Resumen Ejecutivo

Tu proyecto TeAlquilamos Bot actualmente usa:
- **Assistants API** para el flujo principal del bot (gestión de threads, mensajes, runs)
- **Chat Completions API** para análisis de imágenes y transcripciones

## 🎯 Estrategia de Migración Recomendada

### Fase 1: Migración Parcial (✅ COMPLETADA)
Ya hemos migrado los servicios que usan Chat Completions:
- `PerceptionService`: Análisis de comprobantes de pago
- `MediaService`: Descripción general de imágenes

### Fase 2: Evaluación para Migración Completa

## 🔄 Principales Diferencias

### Assistants API (Actual)
```javascript
// Thread persistente
const thread = await openai.beta.threads.create();
// Agregar mensaje
await openai.beta.threads.messages.create(threadId, { role: 'user', content });
// Ejecutar asistente
const run = await openai.beta.threads.runs.create(threadId, { assistant_id });
```

### Responses API (Nueva)
```javascript
// Conversación stateless o con referencia
const response = await openai.responses.create({
    model: 'gpt-4o',
    instructions: 'Tu prompt del sistema',
    input: [{ type: 'message', role: 'user', content }],
    previous_response_id: previousId, // Para mantener contexto
});
```

## ⚠️ Consideraciones Importantes

### 1. Gestión de Estado
- **Assistants API**: OpenAI gestiona los threads automáticamente
- **Responses API**: Debes gestionar el estado de conversación manualmente

### 2. Persistencia
- **Assistants API**: Threads persisten en OpenAI indefinidamente
- **Responses API**: Debes almacenar `response_id` para continuidad

### 3. Function Calling
- **Assistants API**: Funciones se configuran en el Dashboard
- **Responses API**: Funciones se envían en cada request

## 🛠️ Cambios Necesarios para Migración Completa

### 1. Variables de Entorno
```bash
# No se necesitan nuevas variables
# OPENAI_API_KEY sigue siendo la misma
# ASSISTANT_ID ya no se usaría
```

### 2. Nuevo Sistema de Persistencia
```javascript
// Ejemplo de esquema para almacenar conversaciones
interface ConversationState {
    userId: string;
    lastResponseId: string;
    messageCount: number;
    context: string[];
}
```

### 3. Refactorización del OpenAIService
El servicio principal necesitaría:
- Eliminar lógica de threads
- Implementar gestión de `previous_response_id`
- Adaptar el polling (Responses API puede ser síncrona)

## 📊 Ventajas y Desventajas

### Ventajas de Migrar
- ✅ API más moderna y con más características
- ✅ Respuestas más rápidas (sin polling)
- ✅ Mejor control sobre el contexto
- ✅ Soporta características nuevas como reasoning

### Desventajas
- ❌ Requiere reescribir toda la lógica de conversación
- ❌ Necesitas gestionar el estado manualmente
- ❌ Más complejo para conversaciones largas

## 🚀 Recomendación

**Para tu caso específico**, recomiendo:

1. **Mantener Assistants API para el flujo principal** por ahora
2. **Usar Responses API solo para los servicios de visión** (ya migrados)
3. **Evaluar migración completa en el futuro** cuando:
   - Necesites características específicas de Responses API
   - Tengas tiempo para refactorizar completamente
   - La API esté más madura

## 📝 Configuración Manual Requerida

### En Railway
No se necesitan cambios en las variables de entorno.

### En OpenAI Dashboard
- Para Assistants API: Mantén tu configuración actual
- Para Responses API: No requiere configuración en el dashboard
- Los prompts se envían directamente en el código

## 🔧 Código Migrado

### PerceptionService (✅ Migrado)
```javascript
// Antes
const response = await this.openai.chat.completions.create({...});

// Ahora
const response = await this.openai.responses.create({
    model: 'gpt-4o-mini',
    instructions: CAPTIONER_SYSTEM,
    input: [{ type: 'message', role: 'user', content: [...] }],
    max_output_tokens: 300,
    temperature: 0
});
```

### MediaService (✅ Migrado)
Similar al anterior, usando la nueva estructura de Responses API.

## 📞 Soporte

Si decides proceder con la migración completa, considera:
1. Crear una rama de desarrollo separada
2. Implementar gradualmente por módulos
3. Mantener ambas APIs funcionando durante la transición