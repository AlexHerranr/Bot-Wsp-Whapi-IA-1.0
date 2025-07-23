// 🧪 Setup para Jest - Tests del Bot WhatsApp
// Configuración básica para tests unitarios

// Configurar variables de entorno para testing
process.env.NODE_ENV = 'test';

// Mock de variables de entorno sensibles
process.env.OPENAI_API_KEY = 'sk-test-key-for-testing-only';
process.env.WHAPI_TOKEN = 'whapi-test-token-for-testing-only';
process.env.ASSISTANT_ID = 'asst-test-id-for-testing-only';

// Configurar timeouts más largos para tests de integración
jest.setTimeout(10000);

// Suprimir logs durante tests para output más limpio
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Silenciar logs durante tests
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restaurar logs después de tests
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Configuración global para tests
global.testConfig = {
  // Configuración para tests de logging
  logging: {
    enabled: false, // Deshabilitar logging durante tests
    level: 'error' // Solo errores críticos
  },
  
  // Configuración para tests de API
  api: {
    timeout: 5000,
    retries: 1
  },
  
  // Configuración para tests de funciones
  functions: {
    mockOpenAI: true,
    mockWHAPI: true
  }
};

// Helper para limpiar mocks entre tests
export const clearMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
};

// Helper para crear datos de prueba
export const createTestData = {
  // Datos de prueba para mensajes de WhatsApp
  whatsappMessage: {
    id: 'test-message-id',
    type: 'text',
    text: { body: 'Hola, necesito información sobre apartamentos' },
    from: '573001234567@s.whatsapp.net',
    timestamp: '1234567890'
  },
  
  // Datos de prueba para usuario
  user: {
    id: '573001234567@s.whatsapp.net',
    name: 'Usuario Test',
    phone: '573001234567'
  },
  
  // Datos de prueba para contexto
  context: {
    userId: '573001234567@s.whatsapp.net',
    conversationId: 'test-conversation-id',
    timestamp: new Date().toISOString()
  }
};

// Helper para validar respuestas
export const validateResponse = {
  // Validar que una respuesta contiene texto
  hasText: (response: any) => {
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  },
  
  // Validar que una respuesta es un objeto válido
  isValidObject: (response: any) => {
    expect(response).toBeDefined();
    expect(typeof response).toBe('object');
    expect(response).not.toBeNull();
  },
  
  // Validar que una respuesta contiene campos específicos
  hasFields: (response: any, fields: string[]) => {
    fields.forEach(field => {
      expect(response).toHaveProperty(field);
    });
  }
};

console.log('🧪 Jest setup completado - Tests listos para ejecutar'); 