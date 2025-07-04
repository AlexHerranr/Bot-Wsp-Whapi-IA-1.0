# 📚 Sistema de Contexto Histórico de Conversación

## 🎯 Objetivo

Proporcionar a OpenAI el historial de conversaciones previas cuando un cliente escribe por primera vez (sin thread asignado), permitiendo respuestas más contextualizadas y personalizadas.

## 🔧 Implementación

### 1. **Detección de Cliente Nuevo**
- Se verifica si el cliente tiene un thread asignado en `threads.json`
- Si NO tiene thread, se considera como "primera interacción" con el asistente

### 2. **Obtención del Historial**
- Se recuperan los últimos 200 mensajes del chat desde WhatsApp
- Se formatean de manera estructurada y legible
- Se incluyen fecha, hora, remitente y contenido

### 3. **Estructura del Contexto Enviado a OpenAI**

Cuando un cliente sin thread escribe, el mensaje a OpenAI incluye:

```
=== CONTEXTO TEMPORAL ACTUAL ===
FECHA: Viernes, 03 de enero de 2025 (2025-01-03)
HORA: 14:30 - Zona horaria Colombia (UTC-5)
=== FIN CONTEXTO ===

=== CONTEXTO CONVERSACIONAL ===
CLIENTE: Alexander (Sr Alex)
ETIQUETAS: Colega Jefe, cotización
=== FIN CONTEXTO ===

=== HISTORIAL DE CONVERSACIÓN ===
Total de mensajes en historial: 523
Mostrando últimos 200 mensajes:

--- 28/12/24 ---
10:15 - Cliente: Hola, necesito información sobre habitaciones
10:16 - Asistente: ¡Hola! Bienvenido a TeAlquilamos...
...

--- 03/01/25 ---
14:28 - Cliente: Hola, ¿tienen disponibilidad?
=== FIN HISTORIAL ===

[MENSAJE ACTUAL DEL CLIENTE]
```

## 📁 Archivos Modificados

### `src/app.ts`
- Agregada variable `chatHistoryContext` para almacenar el historial
- Modificada lógica de creación de thread para obtener historial
- Actualizada construcción del mensaje con contextos

### `src/utils/whapi/chatHistory.ts` (NUEVO)
- Función `getChatHistory()` para obtener mensajes de WhatsApp
- Formateo y limpieza de mensajes
- Manejo de errores robusto

### `src/utils/whapi/index.ts`
- Exportada la nueva función `getChatHistory`

## 🧪 Pruebas

### Script de Prueba
```bash
node tests/test-chat-history.js 573003913251@s.whatsapp.net
```

### Verificar en Producción
1. Eliminar un thread de `tmp/threads.json`
2. Enviar mensaje desde ese número
3. Verificar logs para confirmar inclusión del historial

## 📊 Logs Relevantes

- `CHAT_HISTORY_OBTAINED`: Historial obtenido exitosamente
- `CHAT_HISTORY_ERROR`: Error obteniendo historial
- `CONTEXT_WITH_HISTORY`: Historial incluido en contexto
- `OPENAI_CONTEXT_DEBUG`: Muestra el contenido completo enviado

## ⚡ Rendimiento

- Solo se ejecuta para clientes nuevos (sin thread)
- Límite de 200 mensajes para evitar contextos excesivos
- Caché no implementado (cada cliente nuevo obtiene historial fresco)

## 🔒 Consideraciones

- El historial solo se envía en el primer mensaje
- Mensajes posteriores usan el contexto del thread de OpenAI
- Si falla la obtención del historial, continúa sin él
- Respeta la privacidad: solo accede a conversaciones del bot

## 🚀 Beneficios

1. **Continuidad**: El asistente conoce conversaciones previas
2. **Personalización**: Respuestas adaptadas al historial
3. **Contexto**: Comprensión de solicitudes anteriores
4. **Profesionalismo**: Evita repetir información ya discutida 