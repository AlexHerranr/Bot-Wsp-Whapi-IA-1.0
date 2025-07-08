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
}

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
 * Configuración unificada del entorno
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
            ? 'https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook'
            : 'https://actual-bobcat-handy.ngrok-free.app/hook'
    );
    
    // Base URL dinámica
    const baseUrl = process.env.BASE_URL || (
        isCloudRun 
            ? 'https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app'
            : `http://localhost:${port}`
    );
    
    // Configuración de logs
    const logLevel = (process.env.LOG_LEVEL as 'development' | 'production') || 
                    (isCloudRun ? 'production' : 'development');
    
    const enableDetailedLogs = process.env.ENABLE_DETAILED_LOGS === 'true' || 
                              (!isCloudRun && logLevel === 'development');

    // 🔧 NUEVO: Configuración adicional de logs
    const enableVerboseLogs = process.env.ENABLE_VERBOSE_LOGS === 'true';
    const enableBufferLogs = process.env.ENABLE_BUFFER_LOGS === 'true';
    const enableTimingLogs = process.env.ENABLE_TIMING_LOGS === 'true';
    
    // Configuración de OpenAI optimizada por entorno
    const openaiTimeout = parseInt(process.env.OPENAI_TIMEOUT || (isCloudRun ? '30000' : '45000'), 10);
    const openaiRetries = parseInt(process.env.OPENAI_RETRIES || (isCloudRun ? '2' : '3'), 10);
    
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
        openaiRetries
    };
};

/**
 * Configuración global del entorno
 */
export const config = createEnvironmentConfig();

/**
 * Función para logging de configuración
 */
export const logEnvironmentConfig = () => {
    console.log('🔧 Configuración del Entorno:');
    console.log(`   📍 Entorno: ${config.environment}`);
    console.log(`   🌐 Puerto: ${config.port}`);
    console.log(`   🔗 Webhook: ${config.webhookUrl}`);
    console.log(`   📊 Log Level: ${config.logLevel}`);
    console.log(`   🔍 Logs Detallados: ${config.enableDetailedLogs ? 'Sí' : 'No'}`);
    
    if (config.isLocal) {
        console.log('   🏠 Modo: Desarrollo Local');
        console.log('   🚇 Ngrok: Activo');
    } else {
        console.log('   ☁️  Modo: Cloud Run');
        console.log('   🚀 Producción: Activo');
    }
};

/**
 * Validar configuración requerida
 */
export const validateEnvironmentConfig = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    // Variables requeridas
    const requiredEnvVars = [
        'ASSISTANT_ID',
        'OPENAI_API_KEY',
        'WHAPI_TOKEN',
        'WHAPI_API_URL'
    ];
    
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            errors.push(`Variable de entorno requerida: ${envVar}`);
        }
    }
    
    // Validar puerto
    if (isNaN(config.port) || config.port < 1000 || config.port > 65535) {
        errors.push(`Puerto inválido: ${config.port}`);
    }
    
    // Validar URLs
    try {
        new URL(config.webhookUrl);
        new URL(config.baseUrl);
    } catch (error) {
        errors.push(`URL inválida en configuración: ${error.message}`);
    }
    
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

export default config; 