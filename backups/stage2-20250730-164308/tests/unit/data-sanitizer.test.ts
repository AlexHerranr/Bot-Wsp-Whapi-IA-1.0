// 🧪 Tests Unitarios - Sanitización de Datos
// Tests para el sistema de sanitización y protección de datos sensibles

import { 
  sanitizeDetails, 
  containsSensitiveData,
  testSanitization 
} from '../../src/utils/logging/data-sanitizer';

describe('🧪 Sistema de Sanitización de Datos', () => {
  describe('sanitizeDetails', () => {
    it('debería sanitizar tokens de OpenAI', () => {
      const data = {
        token: 'sk-1234567890abcdef1234567890abcdef',
        normalField: 'datos normales'
      };

      const sanitized = sanitizeDetails(data);

      expect(sanitized.token).toBe('***REDACTED***');
      expect(sanitized.normalField).toBe('datos normales');
    });

    it('debería sanitizar tokens de WHAPI', () => {
      const data = {
        apiKey: 'whapi_abcd1234efgh5678ijkl9012mnop3456',
        message: 'mensaje normal'
      };

      const sanitized = sanitizeDetails(data);

      expect(sanitized.apiKey).toBe('whap************3456');
      expect(sanitized.message).toBe('mensaje normal');
    });

    it('debería enmascarar números de teléfono', () => {
      const data = {
        phone: '573001234567',
        email: 'user@example.com'
      };

      const sanitized = sanitizeDetails(data);

      expect(sanitized.phone).toBe('573*****4567');
      expect(sanitized.email).toBe('u***@example.com');
    });

    it('debería sanitizar emails manteniendo dominio', () => {
      const data = {
        email: 'usuario@hotel.com',
        name: 'Juan Pérez'
      };

      const sanitized = sanitizeDetails(data);

      expect(sanitized.email).toBe('u***o@hotel.com');
      expect(sanitized.name).toBe('Juan Pérez');
    });

    it('debería manejar objetos anidados', () => {
      const data = {
        user: {
          phone: '573001234567',
          email: 'user@example.com',
          token: 'sk-secret123'
        },
        message: 'Hola mundo'
      };

      const sanitized = sanitizeDetails(data);

      expect(sanitized.user.phone).toBe('573*****4567');
      expect(sanitized.user.email).toBe('u***@example.com');
      expect(sanitized.user.token).toBe('***REDACTED***');
      expect(sanitized.message).toBe('Hola mundo');
    });

    it('debería manejar arrays', () => {
      const data = {
        users: [
          { phone: '573001234567', name: 'Juan' },
          { phone: '573009876543', name: 'María' }
        ]
      };

      const sanitized = sanitizeDetails(data);

      expect(sanitized.users[0].phone).toBe('573*****4567');
      expect(sanitized.users[0].name).toBe('Juan');
      expect(sanitized.users[1].phone).toBe('573*****6543');
      expect(sanitized.users[1].name).toBe('María');
    });

    it('debería preservar estructura de datos', () => {
      const data = {
        id: 123,
        active: true,
        nullValue: null,
        undefinedValue: undefined,
        emptyString: ''
      };

      const sanitized = sanitizeDetails(data);

      expect(sanitized.id).toBe(123);
      expect(sanitized.active).toBe(true);
      expect(sanitized.nullValue).toBeNull();
      expect(sanitized.undefinedValue).toBeUndefined();
      expect(sanitized.emptyString).toBe('');
    });

    it('debería manejar errores gracefully', () => {
      const data = {
        circular: {} as any
      };
      data.circular.self = data; // Referencia circular

      const sanitized = sanitizeDetails(data);

      expect(sanitized.circular.self).toBe('[Circular Reference]');
      expect(typeof sanitized).toBe('object');
    });
  });

  describe('containsSensitiveData', () => {
    it('debería detectar tokens de OpenAI', () => {
      const data = {
        token: 'sk-1234567890abcdef1234567890abcdef'
      };

      expect(containsSensitiveData(data)).toBe(true);
    });

    it('debería detectar tokens de WHAPI', () => {
      const data = {
        apiKey: 'whapi_abcd1234efgh5678ijkl9012mnop3456'
      };

      expect(containsSensitiveData(data)).toBe(true);
    });

    it('debería detectar contraseñas', () => {
      const data = {
        password: 'mySecretPassword123'
      };

      expect(containsSensitiveData(data)).toBe(true);
    });

    it('debería detectar campos con nombres sensibles', () => {
      const data = {
        secretKey: 'valor secreto',
        privateToken: 'token privado',
        apiKey: 'clave api'
      };

      expect(containsSensitiveData(data)).toBe(true);
    });

    it('debería retornar false para datos no sensibles', () => {
      const data = {
        name: 'Juan Pérez',
        message: 'Hola mundo',
        age: 30
      };

      expect(containsSensitiveData(data)).toBe(false);
    });

    it('debería ser case-insensitive', () => {
      const data = {
        APIKEY: 'sk-1234567890abcdef1234567890abcdef',
        Token: 'whapi_abcd1234efgh5678ijkl9012mnop3456'
      };

      expect(containsSensitiveData(data)).toBe(true);
    });
  });

  describe('testSanitization', () => {
    it('debería ejecutar sin errores', () => {
      // Esta función solo imprime, no retorna nada
      expect(() => testSanitization()).not.toThrow();
    });
  });

  describe('Configuración personalizada', () => {
    it('debería permitir configuración personalizada', () => {
      const data = {
        phone: '573001234567',
        email: 'user@example.com'
      };

      const customConfig = {
        maskPhoneNumbers: false,
        maskEmails: true
      };

      const sanitized = sanitizeDetails(data, customConfig);

      expect(sanitized.phone).toBe('573001234567'); // No enmascarado porque maskPhoneNumbers: false
      expect(sanitized.email).toBe('u***@example.com'); // Enmascarado
    });

    it('debería respetar maxFieldLength', () => {
      const data = {
        longMessage: 'Este es un mensaje muy largo que debería ser truncado según la configuración'
      };

      const customConfig = {
        maxFieldLength: 20
      };

      const sanitized = sanitizeDetails(data, customConfig);

      expect(sanitized.longMessage.length).toBeLessThanOrEqual(34); // Incluye ...[TRUNCATED]
    });
  });
}); 