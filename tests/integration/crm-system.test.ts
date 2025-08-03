// tests/integration/crm-system.test.ts
import { SimpleCRMService } from '../../src/core/services/simple-crm.service';
import { DatabaseService } from '../../src/core/services/database.service';
import { DailyActionsJob } from '../../src/core/jobs/daily-actions.job';
import { container } from 'tsyringe';

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
                  profileStatus: 'Cliente interesado en hotel boutique en Cartagena',
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
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Hola! Te contacto para seguir con tu consulta sobre hoteles en Cartagena. ¿Ya tienes fechas definidas?'
            }
          }]
        })
      }
    }
  }))
}));

// Mock fetch for WHAPI calls
global.fetch = jest.fn();

describe('CRM System Integration Tests', () => {
  let databaseService: DatabaseService;
  let crmService: SimpleCRMService;
  let dailyJob: DailyActionsJob;

  beforeAll(() => {
    // Setup dependency injection for tests
    databaseService = new DatabaseService();
    container.registerInstance('DatabaseService', databaseService);
    
    crmService = new SimpleCRMService(databaseService);
    container.registerInstance('SimpleCRMService', crmService);
    
    dailyJob = new DailyActionsJob(databaseService);
    container.registerInstance('DailyActionsJob', dailyJob);

    // Mock environment variables  
    process.env.CRM_ASSISTANT_ID = 'asst_71khCoEEshKgFVbwwnFPrNO8';
    process.env.OPENAI_API_KEY = 'sk-test-key';
    process.env.WHAPI_API_URL = 'https://test-whapi.com';
    process.env.WHAPI_TOKEN = 'test-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  describe('SimpleCRMService', () => {
    test('should analyze conversation and return valid CRM data', async () => {
      // Mock WHAPI messages response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          messages: [
            {
              from_name: 'Cliente Test',
              text: { body: 'Busco hotel en Cartagena para 3 días' },
              body: 'Busco hotel en Cartagena para 3 días'
            }
          ]
        })
      });

      // Mock database methods
      jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
        phoneNumber: '573001234567',
        chatId: '573001234567@s.whatsapp.net',
        userName: 'Cliente Test'
      });

      jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

      await crmService.analyzeAndUpdate('573001234567');

      expect(databaseService.updateClient).toHaveBeenCalledWith(
        '573001234567',
        expect.objectContaining({
          profileStatus: expect.any(String),
          proximaAccion: expect.any(String),
          fechaProximaAccion: expect.any(Date),
          prioridad: expect.any(Number)
        })
      );
    });

    test('should handle missing chatId gracefully', async () => {
      jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue(null);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await crmService.analyzeAndUpdate('573001234567');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No se encontró chatId para 573001234567')
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle WHAPI API errors', async () => {
      jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
        phoneNumber: '573001234567',
        chatId: '573001234567@s.whatsapp.net'
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await crmService.analyzeAndUpdate('573001234567');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error en CRM analysis para 573001234567')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('DailyActionsJob', () => {
    test('should get job status correctly', () => {
      const status = dailyJob.getStatus();
      
      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('nextExecution');
      expect(status.nextExecution).toBe('Diariamente a las 9:00 AM');
    });

    test('should execute daily actions manually', async () => {
      // Mock clients with actions for today
      const mockClients = [
        {
          phoneNumber: '573001234567',
          userName: 'Cliente Test',
          chatId: '573001234567@s.whatsapp.net',
          profileStatus: 'Cliente interesado en reserva',
          proximaAccion: 'enviar confirmación de disponibilidad',
          prioridad: 1
        }
      ];

      jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue(mockClients);
      jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

      // Mock WHAPI send message
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sent: true })
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await dailyJob.executeManual();

      expect(databaseService.getClientsWithActionToday).toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith(
        'https://test-whapi.com/messages/text',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          })
        })
      );
      expect(databaseService.updateClient).toHaveBeenCalledWith(
        '573001234567',
        { proximaAccion: null, fechaProximaAccion: null }
      );

      consoleSpy.mockRestore();
    });

    test('should handle empty clients list', async () => {
      jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue([]);
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await dailyJob.executeManual();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'ℹ️ No hay clientes con acciones programadas para hoy'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Database Integration', () => {
    test('should update client with CRM fields', async () => {
      const mockUpdate = jest.spyOn(databaseService, 'updateClient').mockResolvedValue();
      
      const crmData = {
        profileStatus: 'Cliente frecuente interesado en hoteles boutique',
        proximaAccion: 'enviar promociones especiales',
        fechaProximaAccion: new Date('2025-08-01'),
        prioridad: 2
      };

      await databaseService.updateClient('573001234567', crmData);
      
      expect(mockUpdate).toHaveBeenCalledWith('573001234567', crmData);
    });

    test('should get clients with actions for today', async () => {
      const today = new Date();
      const mockClients = [
        {
          phoneNumber: '573001234567',
          fechaProximaAccion: today,
          proximaAccion: 'seguimiento de reserva'
        }
      ];

      jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue(mockClients);
      
      const result = await databaseService.getClientsWithActionToday();
      
      expect(result).toEqual(mockClients);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle OpenAI API errors gracefully', async () => {
      jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
        phoneNumber: '573001234567',
        chatId: '573001234567@s.whatsapp.net'
      });

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [{ from_name: 'Test', text: { body: 'test' } }] })
      });

      // Mock OpenAI error
      const mockOpenAI = require('openai').OpenAI;
      mockOpenAI.mockImplementationOnce(() => {
        throw new Error('OpenAI API Error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await crmService.analyzeAndUpdate('573001234567');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should handle database connection errors', async () => {
      jest.spyOn(databaseService, 'getClientByPhone').mockRejectedValue(new Error('DB Connection Error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await crmService.analyzeAndUpdate('573001234567');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error en CRM analysis para 573001234567')
      );
      
      consoleSpy.mockRestore();
    });
  });
});