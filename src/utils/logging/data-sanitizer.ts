/**
 * 🔒 SISTEMA DE SANITIZACIÓN DE DATOS SENSIBLES
 * 
 * Protege información confidencial antes de enviar a logs.
 * CRÍTICO para seguridad en producción.
 */

interface SanitizationConfig {
    maskTokens: boolean;
    maskPhoneNumbers: boolean;
    maskEmails: boolean;
    maskPasswords: boolean;
    maskApiKeys: boolean;
    maxFieldLength: number;
    preserveStructure: boolean;
}

const DEFAULT_CONFIG: SanitizationConfig = {
    maskTokens: true,
    maskPhoneNumbers: true,
    maskEmails: true,
    maskPasswords: true,
    maskApiKeys: true,
    maxFieldLength: 500,
    preserveStructure: true
};

/**
 * 🛡️ PATRONES DE DATOS SENSIBLES
 */
const SENSITIVE_PATTERNS = {
    // Tokens y API Keys
    tokens: [
        /Bearer\s+[A-Za-z0-9\-_]+/gi,
        /token["\s]*[:=]["\s]*[A-Za-z0-9\-_]{20,}/gi,
        /api[_-]?key["\s]*[:=]["\s]*[A-Za-z0-9\-_]{20,}/gi,
        /sk-[A-Za-z0-9]{20,}/gi, // OpenAI style
        /whapi_[A-Za-z0-9]{20,}/gi, // WhAPI style
    ],
    
    // Números de teléfono
    phoneNumbers: [
        /\b(\+?57\s?)?([0-9]{3})\s?([0-9]{3})\s?([0-9]{4})\b/g, // Colombia
        /\b(\+?1\s?)?([0-9]{3})\s?([0-9]{3})\s?([0-9]{4})\b/g, // US/Canada
        /\b(\+?[0-9]{1,3}\s?)?([0-9]{2,4})\s?([0-9]{3,4})\s?([0-9]{3,4})\b/g, // General
    ],
    
    // Emails
    emails: [
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g
    ],
    
    // Passwords
    passwords: [
        /password["\s]*[:=]["\s]*[^"\s,}]+/gi,
        /passwd["\s]*[:=]["\s]*[^"\s,}]+/gi,
        /pwd["\s]*[:=]["\s]*[^"\s,}]+/gi,
    ],
    
    // URLs con credenciales
    urlsWithCredentials: [
        /https?:\/\/[^:]+:[^@]+@[^\/\s]+/gi
    ]
};

/**
 * 🏷️ CAMPOS SENSIBLES POR NOMBRE
 */
const SENSITIVE_FIELD_NAMES = new Set([
    'password', 'passwd', 'pwd', 'secret', 'token', 'apiKey', 'api_key',
    'authorization', 'auth', 'bearer', 'key', 'private', 'credential',
    'whapi_token', 'openai_key', 'beds24_key', 'session_id', 'cookie',
    'x-api-key', 'x-auth-token', 'access_token', 'refresh_token'
]);

/**
 * 🔍 DETECTAR NÚMEROS DE TELÉFONO
 */
function detectPhoneNumber(value: string): boolean {
    return SENSITIVE_PATTERNS.phoneNumbers.some(pattern => pattern.test(value));
}

/**
 * 📱 ENMASCARAR NÚMERO DE TELÉFONO
 */
function maskPhoneNumber(phone: string): string {
    // Formato: 573001234567 -> 573****4567
    if (phone.length >= 8) {
        const start = phone.substring(0, 3);
        const end = phone.substring(phone.length - 4);
        const middle = '*'.repeat(phone.length - 7);
        return `${start}${middle}${end}`;
    }
    return '***PHONE***';
}

/**
 * 📧 ENMASCARAR EMAIL
 */
function maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (username && domain) {
        const maskedUsername = username.length > 2 
            ? `${username[0]}***${username[username.length - 1]}`
            : '***';
        return `${maskedUsername}@${domain}`;
    }
    return '***EMAIL***';
}

/**
 * 🔑 ENMASCARAR TOKEN/API KEY
 */
function maskToken(token: string): string {
    if (token.length <= 8) return '***TOKEN***';
    
    const start = token.substring(0, 4);
    const end = token.substring(token.length - 4);
    const middle = '*'.repeat(Math.min(12, token.length - 8));
    
    return `${start}${middle}${end}`;
}

/**
 * 🧹 SANITIZAR VALOR INDIVIDUAL
 */
function sanitizeValue(value: any, config: SanitizationConfig): any {
    if (value === null || value === undefined) {
        return value;
    }
    
    if (typeof value === 'string') {
        let sanitized = value;
        
        // Limitar longitud
        if (sanitized.length > config.maxFieldLength) {
            sanitized = sanitized.substring(0, config.maxFieldLength) + '...[TRUNCATED]';
        }
        
        // Enmascarar tokens y API keys
        if (config.maskTokens) {
            SENSITIVE_PATTERNS.tokens.forEach(pattern => {
                sanitized = sanitized.replace(pattern, (match) => maskToken(match));
            });
        }
        
        // Enmascarar números de teléfono
        if (config.maskPhoneNumbers && detectPhoneNumber(sanitized)) {
            SENSITIVE_PATTERNS.phoneNumbers.forEach(pattern => {
                sanitized = sanitized.replace(pattern, (match) => maskPhoneNumber(match.replace(/\s/g, '')));
            });
        }
        
        // Enmascarar emails
        if (config.maskEmails) {
            SENSITIVE_PATTERNS.emails.forEach(pattern => {
                sanitized = sanitized.replace(pattern, (match) => maskEmail(match));
            });
        }
        
        // Enmascarar passwords
        if (config.maskPasswords) {
            SENSITIVE_PATTERNS.passwords.forEach(pattern => {
                sanitized = sanitized.replace(pattern, (match) => {
                    const [field] = match.split(/[:=]/);
                    return `${field}="***REDACTED***"`;
                });
            });
        }
        
        // Enmascarar URLs con credenciales
        SENSITIVE_PATTERNS.urlsWithCredentials.forEach(pattern => {
            sanitized = sanitized.replace(pattern, (match) => {
                const url = new URL(match);
                return `${url.protocol}//**:**@${url.host}${url.pathname}`;
            });
        });
        
        return sanitized;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    
    if (Array.isArray(value)) {
        return value.map(item => sanitizeValue(item, config));
    }
    
    if (typeof value === 'object') {
        return sanitizeObject(value, config);
    }
    
    return value;
}

/**
 * 🏗️ SANITIZAR OBJETO
 */
function sanitizeObject(obj: any, config: SanitizationConfig): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    const sanitized: any = config.preserveStructure ? {} : obj;
    
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Verificar si el campo es sensible por nombre
        if (SENSITIVE_FIELD_NAMES.has(lowerKey)) {
            sanitized[key] = '***REDACTED***';
            continue;
        }
        
        // Casos especiales
        if (lowerKey.includes('phone') || lowerKey.includes('telefono') || lowerKey.includes('celular')) {
            if (typeof value === 'string' && detectPhoneNumber(value)) {
                sanitized[key] = maskPhoneNumber(value);
                continue;
            }
        }
        
        if (lowerKey.includes('email') || lowerKey.includes('correo')) {
            if (typeof value === 'string' && SENSITIVE_PATTERNS.emails[0].test(value)) {
                sanitized[key] = maskEmail(value);
                continue;
            }
        }
        
        // Sanitizar valor recursivamente
        sanitized[key] = sanitizeValue(value, config);
    }
    
    return sanitized;
}

/**
 * 🛡️ FUNCIÓN PRINCIPAL DE SANITIZACIÓN
 */
export function sanitizeDetails(details: any, customConfig?: Partial<SanitizationConfig>): any {
    if (!details) return {};
    
    const config = { ...DEFAULT_CONFIG, ...customConfig };
    
    try {
        return sanitizeObject(details, config);
    } catch (error) {
        console.error('Error en sanitización:', error);
        return { sanitization_error: 'Failed to sanitize data', original_type: typeof details };
    }
}

/**
 * 🔍 VALIDAR SI CONTIENE DATOS SENSIBLES
 */
export function containsSensitiveData(data: any): boolean {
    const stringified = JSON.stringify(data).toLowerCase();
    
    // Verificar patrones sensibles
    const sensitiveKeywords = [
        'password', 'token', 'apikey', 'secret', 'bearer', 'authorization',
        'whapi_', 'sk-', 'credential', 'private'
    ];
    
    return sensitiveKeywords.some(keyword => stringified.includes(keyword));
}

/**
 * 📊 MÉTRICAS DE SANITIZACIÓN
 */
export class SanitizationMetrics {
    private static phoneNumbersRedacted = 0;
    private static tokensRedacted = 0;
    private static emailsRedacted = 0;
    private static fieldsRedacted = 0;
    private static totalSanitizations = 0;
    
    static recordPhoneRedaction() {
        this.phoneNumbersRedacted++;
        this.totalSanitizations++;
    }
    
    static recordTokenRedaction() {
        this.tokensRedacted++;
        this.totalSanitizations++;
    }
    
    static recordEmailRedaction() {
        this.emailsRedacted++;
        this.totalSanitizations++;
    }
    
    static recordFieldRedaction() {
        this.fieldsRedacted++;
        this.totalSanitizations++;
    }
    
    static getStats() {
        return {
            phoneNumbersRedacted: this.phoneNumbersRedacted,
            tokensRedacted: this.tokensRedacted,
            emailsRedacted: this.emailsRedacted,
            fieldsRedacted: this.fieldsRedacted,
            totalSanitizations: this.totalSanitizations
        };
    }
    
    static reset() {
        this.phoneNumbersRedacted = 0;
        this.tokensRedacted = 0;
        this.emailsRedacted = 0;
        this.fieldsRedacted = 0;
        this.totalSanitizations = 0;
    }
}

/**
 * 🧪 FUNCIÓN DE TESTING
 */
export function testSanitization() {
    const testData = {
        phone: '573001234567',
        email: 'user@example.com',
        token: 'sk-1234567890abcdef1234567890abcdef',
        password: 'mySecretPassword123',
        apiKey: 'whapi_abcd1234efgh5678ijkl9012mnop3456',
        normalField: 'This is normal data',
        userJid: '573001234567@s.whatsapp.net'
    };
    
    console.log('Original:', testData);
    console.log('Sanitized:', sanitizeDetails(testData));
}

/**
 * 🤖 PARA IAs: SISTEMA DE SANITIZACIÓN ROBUSTO
 * 
 * Este sistema:
 * - Protege tokens, API keys, contraseñas
 * - Enmascara números de teléfono parcialmente
 * - Protege emails manteniendo dominio
 * - Detecta campos sensibles por nombre
 * - Mantiene estructura de datos
 * - Proporciona métricas de sanitización
 * - Maneja errores gracefully
 * - Configurable por entorno
 */ 