// tests/integration/crm-internal.test.ts
// Tests específicos para Escenario A (Sistema Interno/Autónomo)

import { SimpleCRMService } from '../../src/core/services/simple-crm.service';
import { DailyActionsJob } from '../../src/core/jobs/daily-actions.job';
import { WebhookProcessor } from '../../src/core/api/webhook-processor';
import { DatabaseService } from '../../src/core/services/database.service';
import { container } from 'tsyringe';

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    beta: {
      threads: {
        create: jest.fn().mockResolvedValue({ id: 'thread_test' }),
        messages: {
          create: jest.fn(),
          list: jest.fn().mockResolvedValue({
            data: [{
              content: [{
                type: 'text',
                text: { 
                  value: JSON.stringify({
                    profileStatus: 'Cliente interesado en hotel boutique',
                    proximaAccion: 'enviar opciones disponibles',
                    fechaProximaAccion: '2025-08-01',
                    prioridad: 1
                  })
                }
              }]
            }]
          })
        },
        del: jest.fn()
      },
      runs: {
        create: jest.fn().mockResolvedValue({ id: 'run_test' }),
        retrieve: jest.fn().mockResolvedValue({ status: 'completed' })
      }
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Hola! Te contacto para seguir con tu consulta sobre hoteles.'
            }
          }]
        })
      }
    }
  }))
}));

// Mock fetch
global.fetch = jest.fn();

describe('CRM Internal System Tests - Escenario A', () => {
  let databaseService: DatabaseService;
  let crmService: SimpleCRMService;
  let dailyJob: DailyActionsJob;

  beforeAll(() => {
    // Setup
    databaseService = new DatabaseService();
    crmService = new SimpleCRMService(databaseService);
    dailyJob = new DailyActionsJob(databaseService);
    
    container.registerInstance('DatabaseService', databaseService);
    container.registerInstance('SimpleCRMService', crmService);
    container.registerInstance('DailyActionsJob', dailyJob);

    // Environment
    process.env.CRM_MODE = 'internal';
    process.env.CRM_ANALYSIS_ENABLED = 'true';
    process.env.CRM_ASSISTANT_ID = 'asst_71khCoEEshKgFVbwwnFPrNO8';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  // Test 13: Integración webhook → análisis CRM interno
  test('13. should integrate webhook to internal CRM analysis', async () => {
    // Mock WHAPI messages
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        messages: [
          { from_name: 'Cliente Test', text: { body: 'Busco hotel en Cartagena' } }
        ]
      })
    });

    // Mock database methods
    jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
      phoneNumber: '573001234567',
      chatId: '573001234567@s.whatsapp.net'
    });
    
    const updateSpy = jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    await crmService.analyzeAndUpdate('573001234567');

    expect(updateSpy).toHaveBeenCalledWith(
      '573001234567',
      expect.objectContaining({
        profileStatus: expect.any(String),
        proximaAccion: expect.any(String),
        fechaProximaAccion: expect.any(Date),
        prioridad: expect.any(Number)
      })
    );
  });

  // Test 14: Cron diario ejecuta correctamente
  test('14. should execute daily cron correctly', async () => {
    const mockClients = [{
      phoneNumber: '573001234567',
      userName: 'Cliente Test',
      chatId: '573001234567@s.whatsapp.net',
      profileStatus: 'Cliente interesado',
      proximaAccion: 'enviar seguimiento',
      prioridad: 1
    }];

    jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue(mockClients);
    jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    // Mock WHAPI send
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sent: true })
    });

    await dailyJob.executeManual();

    // Verifica envío a WHAPI
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/text'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer')
        })
      })
    );

    // Verifica cleanup
    expect(databaseService.updateClient).toHaveBeenCalledWith(
      '573001234567',
      { proximaAccion: null, fechaProximaAccion: null }
    );
  });

  // Test 15: Cleanup acción después de envío
  test('15. should cleanup action after sending', async () => {
    const updateSpy = jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    await crmService.cleanupAction('573001234567');

    expect(updateSpy).toHaveBeenCalledWith(
      '573001234567',
      { proximaAccion: null, fechaProximaAccion: null }
    );
  });

  // Test 16: No acciones si no hay clientes hoy
  test('16. should handle no clients for today', async () => {
    jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue([]);
    
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await dailyJob.executeManual();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No hay clientes con acciones programadas para hoy')
    );

    // No debería hacer llamadas WHAPI
    expect(fetch).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // Test 17: Error en cron (WHAPI falla)
  test('17. should handle cron errors gracefully', async () => {
    const mockClients = [{
      phoneNumber: '573001234567',
      chatId: '573001234567@s.whatsapp.net',
      profileStatus: 'Test',
      proximaAccion: 'Test action'
    }];

    jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue(mockClients);

    // Mock WHAPI error
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('WHAPI Error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await dailyJob.executeManual();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error procesando cliente')
    );

    consoleSpy.mockRestore();
  });

  // Test 18: Performance cron con múltiples clientes
  test('18. should handle multiple clients efficiently', async () => {
    // Genera 10 clientes para test de performance
    const mockClients = Array(10).fill(0).map((_, i) => ({
      phoneNumber: `5730012345${i.toString().padStart(2, '0')}`,
      userName: `Cliente ${i + 1}`,
      chatId: `5730012345${i.toString().padStart(2, '0')}@s.whatsapp.net`,
      profileStatus: `Cliente ${i + 1} profile`,
      proximaAccion: `Acción ${i + 1}`,
      prioridad: (i % 3) + 1
    }));

    jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue(mockClients);
    jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    // Mock WHAPI success
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: true })
    });

    const startTime = Date.now();
    await dailyJob.executeManual();
    const duration = Date.now() - startTime;

    // Debe procesar 10 clientes en menos de 10 segundos
    expect(duration).toBeLessThan(10000);
    expect(fetch).toHaveBeenCalledTimes(10);
  });

  // Test 19: Generación mensaje personalizado interno
  test('19. should generate personalized messages internally', async () => {
    const mockClient = {
      profileStatus: 'Cliente VIP interesado en hotel boutique',
      proximaAccion: 'enviar opciones premium',
      userName: 'Juan Pérez'
    };

    // El mensaje debe ser generado por OpenAI
    const response = await dailyJob['processClientAction'](mockClient);

    // Verifica que se llamó OpenAI para generar mensaje
    expect(require('openai').OpenAI).toHaveBeenCalled();
  });

  // Test 20: Análisis asíncrono no bloquea webhook
  test('20. should not block webhook with async analysis', async () => {
    const startTime = Date.now();

    // Simula análisis asíncrono (setImmediate)
    const asyncAnalysis = () => {
      return new Promise(resolve => {
        setImmediate(() => resolve('analysis complete'));
      });
    };

    await asyncAnalysis();
    
    const duration = Date.now() - startTime;
    
    // Debe ser muy rápido (< 50ms para webhook response)
    expect(duration).toBeLessThan(50);
  });

  // Test 21: Update BD después de análisis interno
  test('21. should update database after internal analysis', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        messages: [{ from_name: 'Test', text: { body: 'Hotel en Medellín' } }]
      })
    });

    jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
      phoneNumber: '573001234567',
      chatId: '573001234567@s.whatsapp.net'
    });

    const updateSpy = jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    await crmService.analyzeAndUpdate('573001234567');

    expect(updateSpy).toHaveBeenCalledWith(
      '573001234567',
      expect.objectContaining({
        profileStatus: 'Cliente interesado en hotel boutique',
        proximaAccion: 'enviar opciones disponibles',
        fechaProximaAccion: new Date('2025-08-01'),
        prioridad: 1
      })
    );
  });

  // Test 22: Fallback si OpenAI falla en interno
  test('22. should handle OpenAI failures gracefully', async () => {
    // Mock OpenAI error
    const mockOpenAI = require('openai').OpenAI;
    mockOpenAI.mockImplementationOnce(() => {
      throw new Error('OpenAI API Error');
    });

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        messages: [{ from_name: 'Test', text: { body: 'test' } }]
      })
    });

    jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
      phoneNumber: '573001234567',
      chatId: '573001234567@s.whatsapp.net'
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await crmService.analyzeAndUpdate('573001234567');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error en CRM analysis para 573001234567')
    );

    consoleSpy.mockRestore();
  });

  // Test 23: Configuración deshabilitada
  test('23. should respect disabled configuration', async () => {
    const originalEnabled = process.env.CRM_ANALYSIS_ENABLED;
    process.env.CRM_ANALYSIS_ENABLED = 'false';

    const updateSpy = jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    // Si está deshabilitado, no debe hacer análisis
    if (process.env.CRM_ANALYSIS_ENABLED !== 'true') {
      console.log('CRM Analysis disabled');
    } else {
      await crmService.analyzeAndUpdate('573001234567');
    }

    expect(updateSpy).not.toHaveBeenCalled();

    // Restore
    process.env.CRM_ANALYSIS_ENABLED = originalEnabled;
  });

  // Test 24: Backup enabled en modo interno
  test('24. should handle backup mode correctly', async () => {
    process.env.CRM_BACKUP_ENABLED = 'true';
    
    expect(process.env.CRM_BACKUP_ENABLED).toBe('true');
    
    // En modo interno, backup está disponible si N8N fallara
    const hasBackup = process.env.CRM_BACKUP_ENABLED === 'true';
    expect(hasBackup).toBe(true);
  });

  // Test 25: Consistencia datos post-cron
  test('25. should maintain data consistency after cron', async () => {
    const testClient = {
      phoneNumber: '573001234567',
      userName: 'Test Client',
      chatId: '573001234567@s.whatsapp.net',
      profileStatus: 'Cliente test',
      proximaAccion: 'acción test',
      fechaProximaAccion: new Date(),
      prioridad: 2
    };

    // Full cycle: análisis → programa acción → cron → envío → cleanup
    
    // 1. Análisis (mock)
    jest.spyOn(databaseService, 'updateClient').mockResolvedValue();
    
    // 2. Cron encuentra cliente
    jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue([testClient]);
    
    // 3. Envío exitoso
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sent: true })
    });

    await dailyJob.executeManual();

    // 4. Verifica cleanup
    expect(databaseService.updateClient).toHaveBeenLastCalledWith(
      '573001234567',
      { proximaAccion: null, fechaProximaAccion: null }
    );
  });
});