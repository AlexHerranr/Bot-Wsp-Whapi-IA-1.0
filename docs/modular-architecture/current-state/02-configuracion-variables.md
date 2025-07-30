# 2. Configuración y Variables de Entorno

**Introducción**: Esta sección detalla la configuración completa del sistema, analizando todas las variables de entorno que controlan su comportamiento y su impacto directo en las funcionalidades. La configuración se carga y valida al iniciar el bot a través de la función `loadAndValidateConfig`, creando un objeto `appConfig` que se utiliza en toda la aplicación.

## Variables de Entorno

### Tabla de Variables de Entorno
Esta tabla consolida todas las variables configurables a través del archivo .env.

| Variable | Descripción | Valor por Defecto/Ejemplo | Criticidad |
|----------|-------------|---------------------------|------------|
| `OPENAI_API_KEY` | Clave API principal de OpenAI para autenticación. Sin ella, el bot no puede inicializarse. | - | **CRÍTICA** |
| `OPENAI_ASSISTANT_ID` | ID del Asistente de OpenAI que orquesta las respuestas y funciones. | `asst_xxxxxxxx` | **CRÍTICA** |
| `WHAPI_API_URL` | URL base de la API de Whapi Cloud. | `https://gate.whapi.cloud` | **CRÍTICA** |
| `WHAPI_TOKEN` | Token de autorización para la API de Whapi Cloud. | `xxxxxxxxxx` | **CRÍTICA** |
| `BEDS24_API_KEY` | Clave API para la integración con el sistema de reservas Beds24. | - | **CRÍTICA** |
| `BEDS24_PROP_KEY` | Clave de propiedad específica de Beds24 para filtrar las consultas. | - | **CRÍTICA** |
| `NODE_ENV` | Define el entorno de ejecución (development o production). Afecta el nivel de logs. | `development` | ALTA |
| `PORT` | Puerto en el que se ejecutará el servidor Express. | `3008` | ALTA |
| `HOST` | Host en el que se ejecutará el servidor. Usado principalmente para logs de inicio. | `localhost` | MEDIA |
| `WEBHOOK_URL` | URL pública del webhook. Usado en logs y endpoints informativos. | `""` (string vacío) | MEDIA |
| `OPENAI_TIMEOUT` | Timeout en milisegundos para las solicitudes a la API de OpenAI. | `60000` | MEDIA |
| `OPENAI_MAX_RETRIES` | Número máximo de reintentos para las solicitudes a la API de OpenAI. | `3` | MEDIA |
| `ENABLE_VOICE_TRANSCRIPTION` | Si es "true", las notas de voz se transcriben usando Whisper. Debe ser un string. | `"true"` | ALTA |
| `ENABLE_VOICE_RESPONSES` | Si es "true", el bot responde con voz si el último input del usuario fue por voz. Debe ser un string. | `"true"` | MEDIA |
| `IMAGE_ANALYSIS_MODEL` | Modelo de OpenAI Vision a utilizar para el análisis de imágenes. | `gpt-4o-mini` | MEDIA |
| `TERMINAL_LOGS_FUNCTIONS` | Si es "false", se ocultan los logs de ejecución de funciones en la terminal. Debe ser un string. | `"true"` | BAJA |

### Variables Implícitas (Valores Fijos en el Código)
Estas constantes están "hardcodeadas" en app-unified.ts y afectan el comportamiento del bot, pero no son configurables a través de variables de entorno en la versión actual.

| Constante | Valor Fijo | Descripción e Impacto |
|----------|-------------|----------------------|
| `WHISPER_MODEL` | `whisper-1` | Modelo de IA utilizado para todas las transcripciones de audio. |
| `TTS_MODEL` | `tts-1` | Modelo de IA para generar las respuestas de voz. |
| `TTS_VOICE` | `nova` | Voz específica utilizada para las respuestas de audio. |
| `BUFFER_WINDOW_MS` | `5000` | 5 segundos de espera para agrupar mensajes de texto antes de procesarlos. |
| `TYPING_EXTENDED_MS` | `10000` | 10 segundos de espera extendida si se detecta que el usuario está escribiendo o grabando. |

## Proceso de Carga y Validación
El sistema utiliza un proceso centralizado al arrancar para asegurar que toda la configuración necesaria esté presente y sea válida.

### 1. Secuencia de Carga en main()
La función principal `main` orquesta la carga de configuración como uno de los primeros pasos críticos antes de inicializar el servidor y los servicios.

```typescript
// app-unified.ts
const main = async () => {
    // ... logs iniciales
    
    // 1. Carga y valida las variables de entorno. Si falta una crítica, lanza un error.
    appConfig = await loadAndValidateConfig();
    
    // 2. Muestra la configuración cargada en los logs (excepto secretos).
    logEnvironmentConfig();
    
    // 3. Inicializa el cliente de OpenAI con la configuración cargada.
    openaiClient = new OpenAI({ 
        apiKey: secrets.OPENAI_API_KEY,
        timeout: appConfig.openaiTimeout,
        maxRetries: appConfig.openaiRetries
    });

    // ... el resto de la inicialización
};
```

### 2. Estructura Real del Objeto appConfig
La función `loadAndValidateConfig` retorna un objeto `AppConfig` fuertemente tipado que contiene toda la configuración. Su estructura real es:

```typescript
// Estructura que refleja fielmente el objeto de configuración
interface AppConfig {
    secrets: {
        OPENAI_API_KEY: string;
        WHAPI_API_URL: string;
        WHAPI_TOKEN: string;
        ASSISTANT_ID: string;
    };
    openaiTimeout: number;
    openaiRetries: number;
    environment: string;
    port: number;
    host: string;
    webhookUrl: string;
}
```

### 3. Lógica de loadAndValidateConfig()
Esta función es la única responsable de interactuar con `process.env`. Valida las variables críticas y asigna valores por defecto a las opcionales.

```typescript
// Versión corregida que refleja el código real
function loadAndValidateConfig(): AppConfig {
    const requiredVars = [
        'OPENAI_API_KEY',
        'OPENAI_ASSISTANT_ID', 
        'WHAPI_API_URL',
        'WHAPI_TOKEN'
    ];
    
    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            throw new Error(`Error Crítico: Falta la variable de entorno requerida: ${varName}`);
        }
    }
    
    return {
        secrets: {
            OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
            WHAPI_API_URL: process.env.WHAPI_API_URL!,
            WHAPI_TOKEN: process.env.WHAPI_TOKEN!,
            ASSISTANT_ID: process.env.OPENAI_ASSISTANT_ID!
        },
        openaiTimeout: parseInt(process.env.OPENAI_TIMEOUT || '60000'),
        openaiRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3'),
        environment: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT || '3008'),
        host: process.env.HOST || 'localhost',
        webhookUrl: process.env.WEBHOOK_URL || '' // Variable añadida
    };
}
```

## Impacto de las Variables en Funcionalidades Clave

### Transcripción de Audio: Controlada por ENABLE_VOICE_TRANSCRIPTION.
- Si es "true", el flujo es: Webhook de audio → Descarga de archivo → Transcripción con Whisper → Se añade al buffer como texto.
- Si es "false" o no está definida, se añade al buffer el texto fijo: "🎤 Transcripción deshabilitada".

### Respuestas de Voz: Controlada por ENABLE_VOICE_RESPONSES.
- Si es "true" y el último mensaje del usuario fue de voz, el bot intenta responder con un audio generado por el modelo TTS.
- **Fallback a Texto**: La respuesta de voz se cancela y se envía como texto si el contenido incluye precios, URLs o datos sensibles detectados por la función `isQuoteOrPriceMessage()`.

### Análisis de Imágenes: Controlado por IMAGE_ANALYSIS_MODEL.
- Cuando se recibe una imagen, se utiliza el modelo especificado (e.g., `gpt-4o-mini`) para generar una descripción contextual. Esta descripción se añade al buffer junto con la URL de la imagen para el procesamiento multimodal. Si la variable no está definida, el análisis puede fallar.

### Logs y Debugging: NODE_ENV y TERMINAL_LOGS_FUNCTIONS son clave.
- En `development`, los logs son más detallados.
- Poner `TERMINAL_LOGS_FUNCTIONS` en "false" es útil en producción para reducir el ruido en la consola, mostrando solo los logs más importantes.


## Migración y Modularización

### Estructura Propuesta
```
config/
├── environment.ts     # Carga y validación
├── defaults.ts       # Valores por defecto
├── validation.ts     # Esquemas de validación
└── types.ts         # Tipos TypeScript
```

### Beneficios de Modularización
- **Validación centralizada** con esquemas
- **Tipado fuerte** para toda la configuración
- **Fácil testing** con mocks de configuración
- **Documentación automática** de variables
- **Migraciones** entre versiones de configuración

### Recomendaciones para Migración Modular
- Centraliza en `config/environment.ts` con Zod para validación.
- Usa `process.env` solo en un módulo, inyecta `appConfig`.
- Agrega tests para validación (e.g., Vitest mocks de env).