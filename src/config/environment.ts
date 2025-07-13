
import "dotenv/config";
import { AppSecrets, getSecrets, areSecretsLoaded } from './secrets.js';

/**
 * Sistema de Configuración Unificada
 * Detecta automáticamente el entorno y configura variables dinámicamente
 * 
 * @docs: Un código, múltiples entornos
 * @author: Alexander - TeAlquilamos
 */

export interface EnvironmentConfig {
    // Detección de entorno
    isCloudRun: boolean;
    isLocal: boolean;
    environment: 'local' | 'cloud-run' | 'development';
    
    // Configuración de red
    port: number;
    host: string;
    
    // URLs y endpoints
    webhookUrl: string;
    baseUrl: string;
    
    // Configuración de logs
    logLevel: 'development' | 'production';
    enableDetailedLogs: boolean;
    enableVerboseLogs: boolean;
    enableBufferLogs: boolean;
    enableTimingLogs: boolean;
    
    // Configuración de OpenAI
    openaiTimeout: number;
    openaiRetries: number;

    // Inyección de historial
    historyInjectMonths: number;
    historyMsgCount: number;
    enableHistoryInject: boolean;
    historyLimitNewThreads: number;

    // Cache TTL
    cacheTtlSeconds: number;
}

export interface AppConfig extends EnvironmentConfig {
    secrets: AppSecrets;
}

let appConfig: AppConfig | null = null;

/**
 * Detecta automáticamente el entorno de ejecución
 */
const detectEnvironment = (): EnvironmentConfig['environment'] => {
    // Cloud Run tiene la variable K_SERVICE
    if (process.env.K_SERVICE) {
        return 'cloud-run';
    }
    
    // Si NODE_ENV está definido, usarlo
    if (process.env.NODE_ENV === 'production') {
        return 'cloud-run';
    }
    
    // Por defecto, desarrollo local
    return 'local';
};

/**
 * Configuración unificada del entorno (solo valores no secretos)
 */
export const createEnvironmentConfig = (): EnvironmentConfig => {
    const environment = detectEnvironment();
    const isCloudRun = environment === 'cloud-run';
    const isLocal = environment === 'local';
    
    // Puerto dinámico
    const port = parseInt(process.env.PORT || (isLocal ? '3008' : '8080'), 10);
    
    // Host dinámico
    const host = isCloudRun ? '0.0.0.0' : 'localhost';
    
    // Webhook URL dinámica
    const webhookUrl = process.env.WEBHOOK_URL || (
        isCloudRun 
            ? `${process.env.CLOUD_RUN_URL || 'https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app'}/hook`
            : 'https://actual-bobcat-handy.ngrok-free.app/hook'
    );
    
    // Base URL dinámica
    const baseUrl = process.env.BASE_URL || (
        isCloudRun 
            ? process.env.CLOUD_RUN_URL || 'https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app'
            : `http://localhost:${port}`
    );
    
    // Configuración de logs
    const logLevel = (process.env.LOG_LEVEL as 'development' | 'production') || 
                    (isCloudRun ? 'production' : 'development');
    
    // 🔧 MEJORADO: Habilitar logs detallados en Cloud Run también (van a Google Cloud Console)
    const enableDetailedLogs = process.env.ENABLE_DETAILED_LOGS === 'true' || 
                              (!isCloudRun && logLevel === 'development') ||
                              isCloudRun; // ← Siempre true en Cloud Run

    // 🔧 NUEVO: Configuración adicional de logs
    const enableVerboseLogs = process.env.ENABLE_VERBOSE_LOGS === 'true';
    const enableBufferLogs = process.env.ENABLE_BUFFER_LOGS === 'true';
    const enableTimingLogs = process.env.ENABLE_TIMING_LOGS === 'true';
    
    // Configuración de OpenAI optimizada por entorno
    const openaiTimeout = parseInt(process.env.OPENAI_TIMEOUT || (isCloudRun ? '30000' : '45000'), 10);
    const openaiRetries = parseInt(process.env.OPENAI_RETRIES || (isCloudRun ? '2' : '3'), 10);

    // Inyección de historial
    const historyInjectMonths = parseInt(process.env.HISTORY_INJECT_MONTHS || '1', 10); // Reducido de 3 a 1 mes
    const historyMsgCount = parseInt(process.env.HISTORY_MSG_COUNT || '50', 10); // Reducido de 200 a 50
    const enableHistoryInject = process.env.ENABLE_HISTORY_INJECT !== 'false';
    
    // 🔧 ETAPA 10: Límite de historial para threads nuevos
    const historyLimitNewThreads = parseInt(process.env.HISTORY_LIMIT_NEW_THREADS || '20', 10); // Reducido de 50 a 20

    // Cache TTL
    const cacheTtlSeconds = parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10);
    
    return {
        isCloudRun,
        isLocal,
        environment,
        port,
        host,
        webhookUrl,
        baseUrl,
        logLevel,
        enableDetailedLogs,
        enableVerboseLogs,
        enableBufferLogs,
        enableTimingLogs,
        openaiTimeout,
        openaiRetries,
        historyInjectMonths,
        historyMsgCount,
        enableHistoryInject,
        historyLimitNewThreads,
        cacheTtlSeconds,
    };
};

/**
 * Carga y valida la configuración completa, incluyendo secretos.
 * Esta función debe ser llamada al inicio de la aplicación.
 */
export const loadAndValidateConfig = async (): Promise<AppConfig> => {
    if (appConfig) {
        return appConfig;
    }

    const envConfig = createEnvironmentConfig();
    const secrets = await getSecrets();

    appConfig = {
        ...envConfig,
        secrets,
    };

    // Validar configuración completa
    const { isValid, errors } = validateConfig(appConfig);
    if (!isValid) {
        errors.forEach(error => console.error(`   - ${error}`));
        throw new Error('Configuración inválida. Saliendo...');
    }
    
    return appConfig;
};


/**
 * Devuelve la configuración cargada. Lanza un error si no se ha cargado.
 */
export const getConfig = (): AppConfig => {
    if (!appConfig) {
        throw new Error('La configuración no ha sido inicializada. Llama a loadAndValidateConfig() primero.');
    }
    return appConfig;
};


/**
 * Función para logging de configuración
 */
export const logEnvironmentConfig = () => {
    const config = getConfig();
    console.log('🔧 Configuración del Entorno:');
    console.log(`   📍 Entorno: ${config.environment}`);
    console.log(`   🌐 Puerto: ${config.port}`);
    console.log(`   �� Webhook: ${config.webhookUrl}`);
    console.log(`   📊 Log Level: ${config.logLevel}`);
    console.log(`   🔍 Logs Detallados: ${config.enableDetailedLogs ? 'Sí' : 'No'}`);
    
    // 🔧 NUEVO: Mostrar estado del buffer de mensajes
    const bufferDisabled = process.env.DISABLE_MESSAGE_BUFFER === 'true';
    if (bufferDisabled) {
        console.log('   ⚡ Buffer de Mensajes: PAUSADO (Respuesta inmediata)');
        console.log('   ⚠️  Modo de Prueba: Velocidad máxima activada');
    } else {
        console.log('   ⏱️  Buffer de Mensajes: Activo (10s)');
    }
    
    if (config.isLocal) {
        console.log('   🏠 Modo: Desarrollo Local');
        console.log('   🚇 Ngrok: Activo');
    } else {
        console.log('   ☁️  Modo: Cloud Run');
        console.log('   🚀 Producción: Activo');
    }
    console.log(`   🔑 Secretos: ${areSecretsLoaded() ? 'Cargados' : 'No cargados'}`);
    console.log(`   📜 Inyección Historial: ${config.enableHistoryInject ? 'Activa' : 'Inactiva'} (${config.historyInjectMonths} meses, ${config.historyMsgCount} msgs)`);
    console.log(`   ⏱️ Cache TTL: ${config.cacheTtlSeconds} segundos (${Math.round(config.cacheTtlSeconds/3600)}h)`);
};

/**
 * Validar configuración requerida
 */
const validateConfig = (config: AppConfig): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Las variables de entorno requeridas ahora se validan dentro de getSecrets()
    if (!areSecretsLoaded()) {
        errors.push("Los secretos de la aplicación no se pudieron cargar.");
    }
    
    // Validar puerto
    if (isNaN(config.port) || config.port < 1000 || config.port > 65535) {
        errors.push(`Puerto inválido: ${config.port}`);
    }
    
    // Validar URLs
    try {
        new URL(config.webhookUrl);
        new URL(config.baseUrl);
    } catch (error: any) {
        errors.push(`URL inválida en configuración: ${error.message}`);
    }

    if (config.historyInjectMonths < 1) errors.push('HISTORY_INJECT_MONTHS debe ser al menos 1');
    if (config.historyMsgCount < 50) errors.push('HISTORY_MSG_COUNT debe ser al menos 50');  // Validación extra simple
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Configuración específica para desarrollo
 */
export const developmentConfig = {
    // Configuración de ngrok
    ngrokDomain: 'actual-bobcat-handy.ngrok-free.app',
    ngrokPort: 3008,
    
    // Configuración de hot reload
    enableHotReload: true,
    watchFiles: ['src/**/*.ts', 'config/**/*.json'],
    
    // Configuración de debugging
    enableDebugLogs: true,
    debugLogFile: './logs/debug.log'
};

/**
 * Configuración específica para Cloud Run
 */
export const cloudRunConfig = {
    // Configuración de recursos
    maxMemory: '1Gi',
    maxCPU: '1',
    
    // Configuración de escalamiento
    minInstances: 0,
    maxInstances: 10,
    
    // Configuración de timeouts
    requestTimeout: 300,
    healthCheckTimeout: 10,
    
    // Configuración de logs
    enableStructuredLogs: true,
    logFormat: 'json'
}; 