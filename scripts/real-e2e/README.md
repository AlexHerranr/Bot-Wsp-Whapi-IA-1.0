# Real E2E Tester (con segundo token WHAPI)

Este módulo permite ejecutar una conversación real contra el bot usando un segundo número/token de WHAPI, y un asistente de OpenAI que toma el rol de cliente para encadenar preguntas. Está diseñado SOLO para entorno local.

## Estructura

- `scripts/real-e2e/real-dialog-driver.js`: driver principal. Envía un seed inicial, espera la respuesta del bot (polling) y genera la siguiente pregunta usando OpenAI.
- `scripts/real-e2e/assistant-client.config.example.json`: configuración del “cliente” (system prompt y seed inicial).
- Logs de cada corrida se guardan en `logs/real-tests/real-dialog-<timestamp>.json`.

## Variables de entorno (local)

Agregar a tu entorno local (NO commitear secretos):

```
ENABLE_REAL_E2E=true
TEST_WHAPI_API_URL=https://gate.whapi.cloud
TEST_WHAPI_TOKEN=<Bearer token de la cuenta de prueba>
TEST_TARGET_PHONE=573XXXXXXXXX   # número del BOT destino
OPENAI_API_KEY=sk-...

# Opcionales
TEST_MAX_TURNS=10
TEST_POLL_INTERVAL_MS=2000
TEST_RESPONSE_TIMEOUT_MS=20000
TEST_MODEL=gpt-4o-mini
TEST_INITIAL_PROMPT_PATH=scripts/real-e2e/assistant-client.config.example.json
```

Nota: No ejecutar en producción ni Railway. El script valida `ENABLE_REAL_E2E=true` y que no estés en producción.

## Cómo ejecutar

Desde el root del proyecto:

```
node scripts/real-e2e/real-dialog-driver.js
```

El script:
- Envía la frase seed al bot.
- Hace polling de mensajes para detectar la respuesta del bot.
- Genera la siguiente pregunta con OpenAI.
- Repite hasta `TEST_MAX_TURNS` o timeout.
- Guarda un log con una `timeline` detallada.

## Flujo detallado

1) Preparación local
- Carga variables de entorno (WHAPI prueba, número destino del bot, OpenAI, etc.).
- Lee `assistant-client.config.example.json` (o el archivo configurado por `TEST_INITIAL_PROMPT_PATH`).

2) Turno inicial (seed)
- Envía el seed como mensaje real al número del bot con `typing_time: 2`.
- Registra `CLIENT_SEND_SEED_*` en la timeline.

3) Espera de respuesta del bot (polling)
- Consulta periódicamente los últimos mensajes del chat de prueba (`/chats/{phone}/messages`).
- Usa una heurística simple (`extractNewBotMessages`) para detectar el último mensaje del bot.
- Registra `WAIT_BOT_RESPONSE_START` y `BOT_REPLY_DETECTED` (o `BOT_REPLY_TIMEOUT`).

4) Generación del siguiente mensaje del “cliente”
- Envía a OpenAI el `system` (rol de cliente) + la respuesta del bot como `user`.
- OpenAI devuelve una pregunta corta para continuar.
- Registra `OPENAI_CLIENT_GEN_*` en la timeline.

5) Envío del siguiente turno del “cliente”
- Envía el texto generado al bot con `typing_time: 2`.
- Registra `CLIENT_SEND_TURN` y espera una breve pausa.

6) Iteración
- Repite pasos 3–5 hasta `TEST_MAX_TURNS` o timeout.
- Escribe `REAL_TEST_DONE` y guarda la timeline en `logs/real-tests/`.

7) Qué observar en tus logs del bot
- Presencias: `INDICATOR_SENT` con `typing` y/o `recording`.
- Chunking de texto: `WHAPI_CHUNK_SEND` con `chunkNumber/totalChunks`.
- Runs de OpenAI: inicio/fin, latencia, tokens.
- Llamadas a funciones (si aplica): entradas/salidas y tiempos.

## Ejemplo de uso

Variables (local):
```
ENABLE_REAL_E2E=true
TEST_WHAPI_API_URL=https://gate.whapi.cloud
TEST_WHAPI_TOKEN=Bearer xxxxxx
TEST_TARGET_PHONE=573123456789
OPENAI_API_KEY=sk-...
TEST_MAX_TURNS=5
```

Comando:
```
node scripts/real-e2e/real-dialog-driver.js
```

Salida esperada (resumen):
```
🧪 REAL_E2E: finalizado. Log: logs/real-tests/real-dialog-2025-08-10T12-34-56-789Z.json
```

Fragmento de timeline (ejemplo):
```
{
  "ts": "2025-08-10T12:34:57.000Z", "evt": "CLIENT_SEND_SEED_RESULT", "status": 200, "ok": true,
  "json": { "messages": [{ "id": "wamid.HBg..." }] }
}
{
  "ts": "2025-08-10T12:35:01.100Z", "evt": "BOT_REPLY_DETECTED", "id": "wamid.HBg...",
  "preview": "Tenemos 2 apartamentos disponibles..."
}
{
  "ts": "2025-08-10T12:35:02.450Z", "evt": "OPENAI_CLIENT_GEN_OK", "turn": 1,
  "preview": "¿Cuál es el precio total por las 3 noches?"
}
```

## Qué valida
- Presencia/typing y chunking visibles para el cliente real (segundo número).
- Latencia de respuesta y tiempos entre chunks.
- Llamadas a funciones (si el bot las ejecuta durante la conversación).
- Flujo de webhooks entrantes/salientes reales en tus logs técnicos.

## Consideraciones
- El polling se hace sobre los mensajes del chat del número de prueba; si la API difiere en estructura, ajusta `extractNewBotMessages`.
- El `typing_time` se fija en 2s para los mensajes del "cliente"; puedes cambiarlo.
- Este flujo no escribe en tu BD; solo invoca WHAPI y OpenAI.

## Pendiente
- Único pendiente: mantener consolidado todo lo relativo a pruebas reales dentro de `scripts/real-e2e/` y retirar cualquier tester legacy suelto si llegara a aparecer fuera de esta carpeta.


