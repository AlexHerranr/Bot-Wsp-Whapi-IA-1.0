// import { Beds24Config } from '../services/beds24/beds24.types';

// Temporary type definition to avoid build errors
interface Beds24Config {
    apiUrl: string;
    apiToken: string;
}

/**
 * Configuración para el servicio de Beds24
 * 
 * Variables de entorno requeridas:
 * - BEDS24_TOKEN: Token de larga duración obtenido desde Beds24
 * - BEDS24_API_URL: URL de la API (opcional, por defecto usa v2)
 * - BEDS24_TIMEOUT: Timeout en milisegundos (opcional, por defecto 15000)
 */

export function getBeds24Config(): Beds24Config {
    const token = process.env.BEDS24_TOKEN;
    
    if (!token) {
        throw new Error(`
❌ BEDS24_TOKEN no está configurado en las variables de entorno.

Para configurar Beds24:
1. Ve a tu cuenta de Beds24
2. Settings > Apps & Integrations > API
3. Crea un "Long life token" con permisos de lectura
4. Agrega BEDS24_TOKEN=tu_token_aqui en tu archivo .env

Permisos necesarios para el token:
- read:inventory (para disponibilidad)
- read:properties (para información de propiedades)
- read:bookings (opcional, para futuras funciones)
        `);
    }

    return {
        apiUrl: process.env.BEDS24_API_URL || 'https://api.beds24.com/v2',
        apiToken: token
    };
}

// Configuración adicional opcional
export const BEDS24_SETTINGS = {
    timeout: parseInt(process.env.BEDS24_TIMEOUT || '15000'),
    defaultCacheTTL: 300, // 5 minutos (si decides implementar caché más adelante)
    maxRetries: 3,
    retryDelay: 1000 // 1 segundo
};

/**
 * Función para validar que la configuración esté completa
 */
export function validateBeds24Config(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!process.env.BEDS24_TOKEN) {
        errors.push('BEDS24_TOKEN es requerido');
    }
    
    const apiUrl = process.env.BEDS24_API_URL || 'https://api.beds24.com/v2';
    if (!apiUrl.startsWith('https://')) {
        errors.push('BEDS24_API_URL debe ser una URL HTTPS válida');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
} 