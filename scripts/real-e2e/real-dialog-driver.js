// scripts/real-e2e/real-dialog-driver.js
// Driver E2E real: usa un segundo token de WHAPI para hablar con el bot y
// un asistente de OpenAI que toma el rol de cliente para continuar la charla.
// Solo para entorno local; no ejecutar en producción.

/*
ENV requeridas (no comprometer claves):
  - TEST_WHAPI_API_URL=https://gate.whapi.cloud
  - TEST_WHAPI_TOKEN=BearerTokenDeLaCuentaDePrueba
  - TEST_TARGET_PHONE=573XXXXXXXXX   // número del BOT (destino)
  - OPENAI_API_KEY=sk-...
Opcionales:
  - TEST_MAX_TURNS=10
  - TEST_POLL_INTERVAL_MS=2000
  - TEST_RESPONSE_TIMEOUT_MS=20000
  - TEST_MODEL=gpt-4o-mini
  - TEST_INITIAL_PROMPT_PATH=scripts/real-e2e/assistant-client.config.example.json
  - ENABLE_REAL_E2E=true (requerido para correr)
*/

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function nowIso() { return new Date().toISOString(); }

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno: ${name}`);
  return v;
}

function loadInitialPrompt(p) {
  try {
    const content = fs.readFileSync(p, 'utf8');
    return JSON.parse(content);
  } catch {
    return {
      system: 'Eres un cliente que está consultando disponibilidad y precios de apartamentos en un hotel. Haz preguntas claras y cortas y responde a lo que diga el bot. Evita emojis, mantén educación y precisión.',
      seed: 'Hola, ¿tienes disponibilidad del 25 al 28 de agosto para 2 personas?'
    };
  }
}

async function fetchChatMessages(apiUrl, token, chatId, limit = 10) {
  const url = `${apiUrl}/chats/${encodeURIComponent(chatId)}/messages?limit=${limit}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const text = await resp.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: resp.status, ok: resp.ok, raw: text, json };
}

async function sendText(apiUrl, token, to, body, typingTimeSec = 2) {
  const resp = await fetch(`${apiUrl}/messages/text`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, body, typing_time: typingTimeSec })
  });
  const raw = await resp.text();
  let json = null;
  try { json = JSON.parse(raw); } catch {}
  return { status: resp.status, ok: resp.ok, raw, json };
}

function extractNewBotMessages(messages, botPhone, sinceId) {
  // Heurística: devolver mensajes cuyo remitente sea el botPhone y con id > sinceId
  if (!Array.isArray(messages)) return [];
  const list = [];
  for (const m of messages) {
    const id = m?.id || m?._id || null;
    const from = (m?.from || m?.sender || '').toString();
    const text = m?.text || m?.body || m?.message || m?.content || null;
    if (from.includes(botPhone) || from === botPhone) {
      if (!sinceId || (id && id !== sinceId)) {
        list.push({ id, from, text, raw: m });
      }
    }
  }
  return list;
}

async function run() {
  if (process.env.ENABLE_REAL_E2E !== 'true') {
    console.error('Real E2E deshabilitado. Set ENABLE_REAL_E2E=true para ejecutar.');
    process.exit(1);
  }
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production' || process.env.RAILWAY_STATIC_URL) {
    console.error('No ejecutar en producción/railway. Solo local.');
    process.exit(1);
  }

  const apiUrl = required('TEST_WHAPI_API_URL');
  const token = required('TEST_WHAPI_TOKEN');
  const botPhone = required('TEST_TARGET_PHONE');
  const maxTurns = parseInt(process.env.TEST_MAX_TURNS || '10', 10);
  const pollIntervalMs = parseInt(process.env.TEST_POLL_INTERVAL_MS || '2000', 10);
  const responseTimeoutMs = parseInt(process.env.TEST_RESPONSE_TIMEOUT_MS || '20000', 10);
  const model = process.env.TEST_MODEL || 'gpt-4o-mini';
  const promptPath = process.env.TEST_INITIAL_PROMPT_PATH || path.join(process.cwd(), 'scripts', 'real-e2e', 'assistant-client.config.example.json');
  const initial = loadInitialPrompt(promptPath);

  const openai = new OpenAI({ apiKey: required('OPENAI_API_KEY') });

  const startedAt = new Date();
  const logDir = path.join(process.cwd(), 'logs', 'real-tests');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `real-dialog-${startedAt.toISOString().replace(/[:.]/g, '-')}.json`);
  const timeline = [];
  const push = (evt, data) => timeline.push({ ts: nowIso(), evt, ...(data || {}) });

  push('REAL_TEST_START', { botPhone, maxTurns, model });

  // Turno 0: enviar seed inicial
  const seed = initial.seed || 'Hola, ¿tienes disponibilidad del 25 al 28 de agosto para 2 personas?';
  push('CLIENT_SEND_SEED_ATTEMPT', { seed });
  const seedRes = await sendText(apiUrl, token, botPhone, seed, 2);
  push('CLIENT_SEND_SEED_RESULT', seedRes);

  let lastSeenId = null;
  for (let turn = 1; turn <= maxTurns; turn++) {
    // Esperar respuesta del bot (polling)
    push('WAIT_BOT_RESPONSE_START', { turn });
    const waitStart = Date.now();
    let botReply = null;
    while (Date.now() - waitStart < responseTimeoutMs) {
      const mres = await fetchChatMessages(apiUrl, token, botPhone, 20);
      push('POLL_MESSAGES', { status: mres.status });
      const msgs = mres.json?.messages || mres.json?.data || mres.json || [];
      const newOnes = extractNewBotMessages(msgs, botPhone, lastSeenId);
      if (newOnes.length > 0) {
        const latest = newOnes[newOnes.length - 1];
        lastSeenId = latest.id || lastSeenId;
        botReply = latest.text || null;
        push('BOT_REPLY_DETECTED', { id: latest.id, preview: (botReply || '').slice(0, 160) });
        break;
      }
      await sleep(pollIntervalMs);
    }
    if (!botReply) {
      push('BOT_REPLY_TIMEOUT', { turn });
      break;
    }

    // Generar siguiente pregunta del cliente con OpenAI
    const messages = [
      { role: 'system', content: initial.system || 'Eres un cliente educado y preciso.' },
      { role: 'user', content: `El bot respondió: \n${botReply}\n\nResponde con una sola pregunta corta y clara para continuar la conversación.` }
    ];
    let clientText = '';
    try {
      push('OPENAI_CLIENT_GEN_START', { turn });
      const cc = await openai.chat.completions.create({ model, messages, temperature: 0.3, max_tokens: 200 });
      clientText = cc.choices?.[0]?.message?.content?.trim() || '';
      push('OPENAI_CLIENT_GEN_OK', { turn, preview: clientText.slice(0, 160) });
    } catch (e) {
      push('OPENAI_CLIENT_GEN_ERROR', { error: String(e && e.message ? e.message : e) });
      break;
    }
    if (!clientText) {
      push('CLIENT_GEN_EMPTY', { turn });
      break;
    }

    // Enviar la siguiente pregunta al bot
    const sendRes = await sendText(apiUrl, token, botPhone, clientText, 2);
    push('CLIENT_SEND_TURN', { turn, ok: sendRes.ok, status: sendRes.status });

    // Pausa breve antes del siguiente ciclo
    await sleep(1200);
  }

  push('REAL_TEST_DONE', {});
  fs.writeFileSync(logFile, JSON.stringify({ startedAt: startedAt.toISOString(), finishedAt: nowIso(), timeline }, null, 2), 'utf8');
  console.log(`🧪 REAL_E2E: finalizado. Log: ${logFile}`);
}

run().catch(err => {
  console.error('🧪 REAL_E2E: error fatal', err);
  process.exit(1);
});


