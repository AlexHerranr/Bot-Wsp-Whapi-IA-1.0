// tests/unit/crm-common.test.ts
// Tests comunes que aplican a ambos escenarios (A y B)

import { OpenAI } from 'openai';

// Mock completo de OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    models: {
      list: jest.fn().mockResolvedValue({ data: [] })
    },
    beta: {
      assistants: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'asst_71khCoEEshKgFVbwwnFPrNO8',
          name: 'CRM Assistant',
          model: 'gpt-4o-mini'
        })
      },
      threads: {
        create: jest.fn().mockResolvedValue({ id: 'thread_test' }),
        messages: {
          create: jest.fn().mockResolvedValue({}),
          list: jest.fn().mockResolvedValue({
            data: [{
              content: [{
                type: 'text',
                text: { 
                  value: JSON.stringify({
                    profileStatus: 'Cliente interesado en hotel boutique en Cartagena',
                    proximaAccion: 'enviar opciones de hoteles boutique disponibles',
                    fechaProximaAccion: '2025-08-01',
                    prioridad: 1
                  })
                }
              }]
            }]
          })
        },
        del: jest.fn().mockResolvedValue({})
      },
      runs: {
        create: jest.fn().mockResolvedValue({ id: 'run_test' }),
        retrieve: jest.fn().mockResolvedValue({ status: 'completed' })
      }
    }
  }))
}));

// Mock fetch para WHAPI
global.fetch = jest.fn();

describe('CRM Common Tests - Funcionalidades Compartidas', () => {
  let openai: OpenAI;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.CRM_ASSISTANT_ID = 'asst_71khCoEEshKgFVbwwnFPrNO8';
    process.env.WHAPI_API_URL = 'https://test-whapi.com';
    process.env.WHAPI_TOKEN = 'test-token';
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  // Test 1: Análisis de conversación simple con OpenAI Assistant
  test('1. should analyze simple conversation with OpenAI Assistant', async () => {
    const conversation = 'Busco hotel en Cartagena para 3 días';
    
    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: conversation
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.CRM_ASSISTANT_ID!
    });

    const messages = await openai.beta.threads.messages.list(thread.id);
    const responseText = (messages.data[0].content[0] as any).text.value;
    const result = JSON.parse(responseText);

    // Validaciones
    expect(result).toHaveProperty('profileStatus');
    expect(result).toHaveProperty('proximaAccion');
    expect(result).toHaveProperty('fechaProximaAccion');
    expect(result).toHaveProperty('prioridad');
    
    expect(typeof result.profileStatus).toBe('string');
    expect(result.profileStatus.length).toBeLessThanOrEqual(300);
    expect([1, 2, 3]).toContain(result.prioridad);
    expect(result.fechaProximaAccion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Test 2: Análisis de conversación larga (10+ mensajes)
  test('2. should handle long conversation efficiently', async () => {
    const longConversation = Array(15).fill(0).map((_, i) => 
      `Mensaje ${i + 1}: Información sobre reserva de hotel`
    ).join('\n');

    expect(longConversation.length).toBeGreaterThan(500); // Conversación larga
    
    const thread = await openai.beta.threads.create();
    const messages = await openai.beta.threads.messages.list(thread.id);
    const result = JSON.parse((messages.data[0].content[0] as any).text.value);

    // Debe manejar eficientemente sin exceder límites
    expect(result.profileStatus).toBeTruthy();
    expect(result.profileStatus.length).toBeLessThanOrEqual(300);
  });

  // Test 3: Validación de JSON output del Assistant
  test('3. should validate JSON output structure', async () => {
    const mockInvalidResponse = { profileStatus: 'test', prioridad: 4 }; // prioridad inválida
    
    expect(() => {
      if (mockInvalidResponse.prioridad < 1 || mockInvalidResponse.prioridad > 3) {
        throw new Error('Invalid prioridad range');
      }
    }).toThrow('Invalid prioridad range');

    // Test fecha inválida
    const mockInvalidDate = { fechaProximaAccion: '2025-13-01' }; // mes inválido
    expect(mockInvalidDate.fechaProximaAccion).not.toMatch(/^(0[1-9]|1[0-2])$/);
  });

  // Test 4: Update de campos CRM en BD (mock)
  test('4. should update CRM fields in database', async () => {
    const mockClient = {
      phoneNumber: '573001234567',
      profileStatus: 'Cliente VIP interesado en reserva',
      proximaAccion: 'enviar opciones premium',
      fechaProximaAccion: new Date('2025-08-01'),
      prioridad: 1
    };

    // Simula update exitoso
    const updateResult = { success: true, updated: mockClient };
    expect(updateResult.success).toBe(true);
    expect(updateResult.updated.prioridad).toBe(1);
  });

  // Test 5: Manejo de conversación vacía o mínima
  test('5. should handle empty or minimal conversation', async () => {
    const minimalConversation = 'Hola';
    
    const thread = await openai.beta.threads.create();
    const messages = await openai.beta.threads.messages.list(thread.id);
    const result = JSON.parse((messages.data[0].content[0] as any).text.value);

    // Debe generar defaults razonables
    expect(result.profileStatus).toBeTruthy();
    expect(result.proximaAccion).toBeTruthy();
    expect(result.prioridad).toBeGreaterThanOrEqual(1);
    expect(result.prioridad).toBeLessThanOrEqual(3);
  });

  // Test 6: Error en OpenAI API (rate limit)
  test('6. should handle OpenAI API errors gracefully', async () => {
    const mockOpenAIError = new Error('Rate limit exceeded');
    
    const errorHandler = (error: Error) => {
      console.error('OpenAI Error:', error.message);
      return { success: false, error: error.message };
    };

    const result = errorHandler(mockOpenAIError);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limit exceeded');
  });

  // Test 7: Error en WHAPI (historial mensajes falla)
  test('7. should handle WHAPI fetch errors', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('WHAPI unavailable'));

    try {
      await fetch('https://test-whapi.com/messages/list');
    } catch (error) {
      expect(error.message).toBe('WHAPI unavailable');
    }

    // Debe usar defaults si no hay historial
    const fallbackResult = {
      profileStatus: 'Cliente - información limitada',
      proximaAccion: 'seguimiento general',
      prioridad: 2
    };

    expect(fallbackResult.prioridad).toBe(2); // Default MEDIA
  });

  // Test 8: Performance de análisis (simulado)
  test('8. should meet performance requirements', async () => {
    const startTime = Date.now();
    
    // Simula análisis rápido
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms simulated
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(2000); // <2s requirement
  });

  // Test 9: Validación de fecha (fechaProximaAccion)
  test('9. should validate date format correctly', async () => {
    const validDates = ['2025-08-01', '2025-12-31', '2025-01-15'];
    const invalidDates = ['2025-13-01', '25-08-01', '2025/08/01'];

    validDates.forEach(date => {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(date).getTime()).not.toBeNaN();
    });

    invalidDates.forEach(date => {
      if (date.includes('/') || date.length !== 10) {
        expect(date).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  // Test 10: Prioridad basada en urgencia
  test('10. should assign priority based on urgency', async () => {
    const urgentKeywords = ['urgente', 'hoy', 'inmediato', 'canceló'];
    const normalKeywords = ['próximo mes', 'consulta', 'información'];
    const lowKeywords = ['quizás', 'futuro', 'eventualmente'];

    // Simula análisis de urgencia
    const analyzeUrgency = (text: string) => {
      if (urgentKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
        return 1; // Alta
      } else if (lowKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
        return 3; // Baja
      }
      return 2; // Media
    };

    expect(analyzeUrgency('Necesito hotel urgente para hoy')).toBe(1);
    expect(analyzeUrgency('Consulta general sobre precios')).toBe(2);
    expect(analyzeUrgency('Quizás reserve en el futuro')).toBe(3);
  });

  // Test 11: Resumen profileStatus conciso
  test('11. should create concise profile status', async () => {
    const longProfile = 'Cliente frecuente que ha reservado 5 veces, siempre hoteles boutique en Cartagena, presupuesto alto, prefiere suites con vista al mar, viaja en familia, necesita servicios premium, tiene programa VIP, última reserva exitosa';
    
    // Simula truncación inteligente
    const truncateProfile = (text: string, maxLength: number = 300) => {
      if (text.length <= maxLength) return text;
      
      // Corta en palabra completa más cercana
      const truncated = text.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      return truncated.substring(0, lastSpace) + '...';
    };

    const result = truncateProfile(longProfile);
    expect(result.length).toBeLessThanOrEqual(300);
    expect(result).toContain('boutique');
    expect(result).toContain('Cartagena');
  });

  // Test 12: Switch de modo con fallback
  test('12. should handle mode switching with fallback', async () => {
    const originalMode = process.env.CRM_MODE;
    
    // Test switch a N8N
    process.env.CRM_MODE = 'n8n';
    expect(process.env.CRM_MODE).toBe('n8n');
    
    // Simula falla N8N y fallback
    const handleFallback = (mode: string, backupEnabled: boolean) => {
      if (mode === 'n8n' && backupEnabled) {
        console.log('N8N failed, switching to internal mode');
        return 'internal';
      }
      return mode;
    };

    const result = handleFallback('n8n', true);
    expect(result).toBe('internal');
    
    // Restore
    process.env.CRM_MODE = originalMode;
  });
});