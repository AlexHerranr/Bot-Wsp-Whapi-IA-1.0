// tests/unit/crm-analysis.test.ts
import { OpenAI } from 'openai';

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    beta: {
      threads: {
        create: jest.fn().mockResolvedValue({ id: 'test-thread-id' }),
        messages: {
          create: jest.fn().mockResolvedValue({}),
          list: jest.fn().mockResolvedValue({
            data: [{
              content: [{
                type: 'text',
                text: { value: JSON.stringify({
                  profileStatus: 'Cliente interesado en hotel boutique en Cartagena para 3 días',
                  proximaAccion: 'enviar opciones de hoteles boutique disponibles',
                  fechaProximaAccion: '2025-08-01',
                  prioridad: 1
                })}
              }]
            }]
          })
        },
        del: jest.fn().mockResolvedValue({})
      },
      runs: {
        create: jest.fn().mockResolvedValue({ id: 'test-run-id' }),
        retrieve: jest.fn().mockResolvedValue({ status: 'completed' })
      }
    }
  }))
}));

describe('CRM Analysis Unit Tests', () => {
  let openai: OpenAI;

  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.CRM_ASSISTANT_ID = 'asst_71khCoEEshKgFVbwwnFPrNO8';
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should analyze conversation and return valid JSON with required fields', async () => {
    const conversationText = 'Cliente busca hotel en Cartagena para 3 días, presupuesto 500k por noche';

    // Create thread and analyze
    const thread = await openai.beta.threads.create();
    
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: conversationText
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.CRM_ASSISTANT_ID!
    });

    // Mock completed run
    const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    expect(runStatus.status).toBe('completed');

    // Get response
    const messages = await openai.beta.threads.messages.list(thread.id);
    const responseText = (messages.data[0].content[0] as any).text.value;
    const result = JSON.parse(responseText);

    // Validate required fields
    expect(result).toHaveProperty('profileStatus');
    expect(result).toHaveProperty('proximaAccion');
    expect(result).toHaveProperty('fechaProximaAccion');
    expect(result).toHaveProperty('prioridad');

    // Validate data types
    expect(typeof result.profileStatus).toBe('string');
    expect(typeof result.proximaAccion).toBe('string');
    expect(typeof result.fechaProximaAccion).toBe('string');
    expect(typeof result.prioridad).toBe('number');

    // Validate priority range
    expect(result.prioridad).toBeGreaterThanOrEqual(1);
    expect(result.prioridad).toBeLessThanOrEqual(3);

    // Validate profile status length
    expect(result.profileStatus.length).toBeLessThanOrEqual(300);

    // Validate date format (should be YYYY-MM-DD)
    expect(result.fechaProximaAccion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('should handle different conversation scenarios', async () => {
    const scenarios = [
      {
        conversation: 'Hola, necesito información sobre hoteles en Bogotá para el próximo mes',
        expectedPriority: 2 // Media priority for future booking
      },
      {
        conversation: 'URGENTE: Necesito hotel para esta noche en Medellín, se canceló mi vuelo',
        expectedPriority: 1 // High priority for urgent booking
      },
      {
        conversation: 'Buenos días, solo quería preguntar precios generales de hoteles',
        expectedPriority: 3 // Low priority for general inquiry
      }
    ];

    for (const scenario of scenarios) {
      const thread = await openai.beta.threads.create();
      
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: scenario.conversation
      });

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: process.env.CRM_ASSISTANT_ID!
      });

      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      expect(runStatus.status).toBe('completed');

      const messages = await openai.beta.threads.messages.list(thread.id);
      const responseText = (messages.data[0].content[0] as any).text.value;
      const result = JSON.parse(responseText);

      expect(result.prioridad).toBe(scenario.expectedPriority);
      expect(result.profileStatus).toBeTruthy();
      expect(result.proximaAccion).toBeTruthy();
    }
  });

  test('should validate JSON structure compliance', () => {
    const mockResponse = {
      profileStatus: 'Cliente interesado en hotel boutique en Cartagena',
      proximaAccion: 'enviar opciones de hoteles boutique disponibles',
      fechaProximaAccion: '2025-08-01',
      prioridad: 1
    };

    // Test all required fields are present
    const requiredFields = ['profileStatus', 'proximaAccion', 'fechaProximaAccion', 'prioridad'];
    requiredFields.forEach(field => {
      expect(mockResponse).toHaveProperty(field);
    });

    // Test field types
    expect(typeof mockResponse.profileStatus).toBe('string');
    expect(typeof mockResponse.proximaAccion).toBe('string');
    expect(typeof mockResponse.fechaProximaAccion).toBe('string');
    expect(typeof mockResponse.prioridad).toBe('number');

    // Test constraints
    expect(mockResponse.profileStatus.length).toBeLessThanOrEqual(300);
    expect([1, 2, 3]).toContain(mockResponse.prioridad);
    expect(mockResponse.fechaProximaAccion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('should handle empty or minimal conversations', async () => {
    const thread = await openai.beta.threads.create();
    
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: 'Hola'
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.CRM_ASSISTANT_ID!
    });

    const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    const messages = await openai.beta.threads.messages.list(thread.id);
    const responseText = messages.data[0].content[0].text.value;
    const result = JSON.parse(responseText);

    // Should still provide reasonable defaults
    expect(result.profileStatus).toBeTruthy();
    expect(result.proximaAccion).toBeTruthy();
    expect(result.prioridad).toBeGreaterThanOrEqual(1);
    expect(result.prioridad).toBeLessThanOrEqual(3);
  });

  test('should generate contextually appropriate actions', async () => {
    const contextTests = [
      {
        input: 'Estoy interesado en hacer una reserva para el 15 de agosto',
        expectedActionKeywords: ['reserva', 'agosto', 'disponibilidad']
      },
      {
        input: 'Ya tengo una reserva pero quiero cambiar las fechas',
        expectedActionKeywords: ['cambiar', 'fechas', 'modificar']
      },
      {
        input: 'Tengo una queja sobre mi última estadía',
        expectedActionKeywords: ['queja', 'seguimiento', 'resolución']
      }
    ];

    for (const test of contextTests) {
      const thread = await openai.beta.threads.create();
      
      await openai.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: test.input
      });

      const run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: process.env.CRM_ASSISTANT_ID!
      });

      const messages = await openai.beta.threads.messages.list(thread.id);
      const responseText = (messages.data[0].content[0] as any).text.value;
      const result = JSON.parse(responseText);

      // Check if the proximaAccion contains contextually relevant keywords
      const actionLower = result.proximaAccion.toLowerCase();
      const hasRelevantKeyword = test.expectedActionKeywords.some(keyword => 
        actionLower.includes(keyword.toLowerCase())
      );
      
      expect(hasRelevantKeyword).toBe(true);
    }
  });
});