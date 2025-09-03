# Decisión de Arquitectura: Gestión de Contexto en Responses API

## Contexto
La migración a OpenAI Responses API requiere decidir cómo gestionar el contexto de conversación.

## Opciones Evaluadas

### 1. ✅ **previous_response_id** (SELECCIONADA)
**Ventajas:**
- Simple de implementar
- Ya está funcionando
- OpenAI gestiona el contexto automáticamente
- No requiere infraestructura adicional

**Desventajas:**
- Todos los tokens previos se cobran en cada turno
- Menos control sobre qué contexto incluir
- Puede ser costoso en conversaciones largas

### 2. ❌ Conversations API
**Ventajas:**
- Control total sobre items de conversación
- Posibilidad de editar/eliminar items específicos
- Mejor para casos de uso complejos

**Desventajas:**
- Más complejo de implementar
- Requiere gestionar conversation_id adicional
- Overhead para nuestro caso de uso simple

### 3. ❌ Encadenado Manual
**Ventajas:**
- Control absoluto del contexto
- Optimización máxima de tokens

**Desventajas:**
- Muy complejo de implementar correctamente
- Propenso a errores
- Requiere lógica de gestión de estado

## Decisión Final

Usar **previous_response_id** con las siguientes optimizaciones:

1. **Monitoreo de Tokens**
   - Trackear tokens por conversación
   - Alertar cuando se acerque a límites

2. **Estrategias de Optimización**
   - Resumir conversaciones largas (>8k tokens)
   - Limpiar mensajes antiguos (>20 mensajes)
   - Romper cadena si costo > $1

3. **Campos en BD**
   ```sql
   -- Ya implementados
   last_response_id TEXT
   
   -- Por agregar
   conversation_token_count INTEGER DEFAULT 0
   conversation_message_count INTEGER DEFAULT 0
   last_summary_at TIMESTAMP
   ```

4. **Métricas a Trackear**
   - Tokens promedio por conversación
   - Costo promedio por usuario
   - Frecuencia de optimizaciones

## Implementación Gradual

### Fase 1 (Actual) ✅
- Usar previous_response_id básico
- Guardar last_response_id en BD

### Fase 2 (Próxima)
- Agregar ConversationOptimizer
- Implementar monitoreo de tokens
- Alertas de costos

### Fase 3 (Futura)
- Resúmenes automáticos
- Limpieza inteligente
- Análisis de patrones

## Justificación

Para un bot de WhatsApp con conversaciones típicamente cortas y contextuales, 
`previous_response_id` ofrece el mejor balance entre simplicidad y funcionalidad.
Las optimizaciones propuestas mitigan las desventajas sin agregar complejidad excesiva.

## Monitoreo

Revisar mensualmente:
- Costo promedio por conversación
- Conversaciones que superan límites
- Efectividad de optimizaciones