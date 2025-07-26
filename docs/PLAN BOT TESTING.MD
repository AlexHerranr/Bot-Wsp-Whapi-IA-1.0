### Descripción del Objetivo
El objetivo es crear un proyecto nuevo e independiente llamado "BotTesterSimulator" (o similar), que sea una aplicación web sencilla para simular conversaciones dinámicas con tu bot de TeAlquilamos. El usuario ingresa:
- **Objetivo**: Un prompt que guía al simulador IA (e.g., "Convence de reservar con psicología de ventas sin presión").
- **Preguntas típicas**: Lista de preguntas comunes de clientes (e.g., "Hola, consulta disponibilidad", "Aceptan mascotas?"), usadas para inyectar realismo en la convo.
- **Número de contacto**: El chat ID para testear (e.g., "573003913251@s.whatsapp.net").
- **Duración máxima**: Tiempo en segundos para la simulación (e.g., 3600 para 1 hora).

Al dar "Play", inicia la convo: El simulador (una IA con OpenAI) envía "Hola" y continúa dinámicamente basado en respuestas del bot, integrando el objetivo y preguntas. Puedes parar manualmente o por timer. Al final, evalúa automáticamente (e.g., score de calidad con otro LLM). 

Esto permite testing rápido sin manualidad, enfocándose en calidad de respuestas (texto/voz). No es robusto: Sin locks complejos, polling simple, in-memory (sin DB), y errores básicos manejados. Ideal para local/dev, escalable después si necesitas.

### Método
- **Flujo general**: UI web para inputs -> Backend inicia simulación -> Loop: IA genera mensaje -> Envía a bot via WHAPI -> Recibe respuesta (polling) -> IA responde dinámicamente -> Repite hasta stop/timer. Al final, evalúa convo con LLM (e.g., "Relevancia: 8/10").
- **Dinámica**: El simulador usa OpenAI (gpt-4o-mini) con prompt que incluye objetivo + preguntas + historial, para respuestas naturales (no fijas).
- **Interacción con bot**: Via WHAPI (POST para enviar, GET polling para recibir). Soporta texto; para voz, transcribe si es respuesta de bot.
- **Evaluación**: LLM judge califica al final (relevancia, persuasión, etc.). Logs en consola/archivo simple.
- **Sencillez**: Todo en un solo archivo o pocos módulos. Corre localmente (e.g., `python app.py`).

### Herramientas y Stack
Para mantenerlo sencillo (no robusto como tu bot actual: sin servers distribuidos, cleanups, etc.), usamos:
- **Lenguaje**: Python 3 (fácil, ya lo usamos en ejemplos previos).
- **Backend/API**: FastAPI (simple para endpoints, async para polling; pip install fastapi uvicorn).
- **Frontend/UI**: Streamlit (pip install streamlit) – Es Python-based, crea UI web con botones/forms en minutos, sin JS/HTML. Alternativa: Flask + HTML básico si prefieres, pero Streamlit es más rápido para MVP.
- **IA/LLM**: OpenAI API (gpt-4o-mini para simulador y evaluación; whisper para voz si necesitas).
- **HTTP/WHAPI**: Requests (pip install requests) para POST/GET simples.
- **Otras libs**: Time (para timer), JSON (para logs básicos).
- **Dependencias totales**: pip install fastapi uvicorn streamlit openai requests.
- **No incluye**: Docker, DB (usa listas in-memory), autenticación, multi-threading robusto (solo async básico).
- **Costo estimado**: Bajo (~$0.01-0.05 por convo larga con OpenAI mini).
- **Ejecución**: Local (uvicorn para backend, streamlit run app.py para UI).

### Plan de Implementación por Etapas
Dividido en 5 etapas secuenciales, cada una ~1-2 horas (total ~6-10 horas para MVP). Asume sabes Python básico; si no, puedo dar código detallado por etapa.

1. **Etapa 1: Setup Básico y Estructura del Proyecto (1 hora)**
   - Crea carpeta: `bot_tester_simulator`.
   - Archivos: `app.py` (main con UI/Backend), `requirements.txt` (dependencias).
   - Instala paquetes: `pip install fastapi uvicorn streamlit openai requests`.
   - Configura env: Agrega WHAPI_TOKEN, OPENAI_API_KEY en .env o hardcode temporal.
   - Prueba: Corre un "Hello World" con Streamlit para UI (form vacío) y FastAPI para un endpoint dummy.
   - Meta: Proyecto runnable con UI básica (título "Bot Tester").

2. **Etapa 2: Backend - Funciones para Simulación y WHAPI (1-2 horas)**
   - Implementa funciones: 
     - `generate_user_message(history, objetivo, preguntas)`: Usa OpenAI para generar msg dinámico (prompt = objetivo + random pregunta + history).
     - `send_to_bot(message)`: POST a WHAPI para enviar.
     - `get_bot_response(sent_id)`: Polling GET para recibir (espera 30s max).
     - `evaluate_convo(history)`: OpenAI para score final.
   - Crea endpoint en FastAPI: `/simulate` que recibe inputs y corre loop de convo (while hasta timer/stop).
   - Manejo simple: Lista para history, try/except para errores (log en consola).
   - Prueba: Corre manualmente una convo de 2 turnos sin UI.
   - Meta: Backend funcional; simula convo en consola.

3. **Etapa 3: UI Web con Botones y Forms (1 hora)**
   - Usa Streamlit: Crea form para objetivo, preguntas (textarea), número, duración.
   - Botones: "Play" (llama endpoint /simulate async), "Stop" (variable global para parar loop).
   - Display: Muestra convo en tiempo real (st.write para msgs), progress bar para timer.
   - Integra: Streamlit llama FastAPI internamente (usa requests.post a localhost).
   - Prueba: Ingresa datos, da play, ve msgs en UI.
   - Meta: UI interactiva; convo visible en web (localhost:8501).

4. **Etapa 4: Integración y Dinámica de Convo (1-2 horas)**
   - En el loop de /simulate: Inicia con "Hola", envía/recibe, genera siguiente con OpenAI (usa history para contexto).
   - Inyecta preguntas: Random una pregunta típica cada 2-3 turnos en el prompt del simulador.
   - Stop/Timer: Verifica duración o botón stop (usa shared state como global bool).
   - Al final: Evalúa y muestra score en UI.
   - Soporte voz: Si bot responde voz, transcribe con Whisper y agrega a history.
   - Prueba: Simula 5-min convo completa; verifica dinamismo (e.g., si bot responde X, simulador reacciona).
   - Meta: Simulación end-to-end; evalúa calidad.

5. **Etapa 5: Testing, Logs y Refinamientos (1 hora)**
   - Agrega logs: Guarda convo en JSON (timestamp, msgs, score).
   - Manejo errores: Si timeout, retry simple o para.
   - Test casos: Con objetivo de ventas, verifica si "convence" (score >7).
   - Opcional: Botón "Export" para CSV de benchmarks múltiples.
   - Deploy local: Corre con `streamlit run app.py` (UI) + `uvicorn app:app` (backend en paralelo).
   - Meta: App usable; corre 1 hora de tests, ajusta basado en results.

Procede con Etapa 1: Crea el proyecto y confirma dependencias. Si necesitas código exacto para una etapa, dime. ¡Esto será tu tool de testing ideal, sin complicaciones! 🚀