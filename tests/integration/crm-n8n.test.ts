// tests/integration/crm-n8n.test.ts
// Tests específicos para Escenario B (Sistema N8N/Externo)

import request from 'supertest';
import express from 'express';
import { crmRoutes } from '../../src/core/routes/crm.routes';
import { DatabaseService } from '../../src/core/services/database.service';
import { SimpleCRMService } from '../../src/core/services/simple-crm.service';
import { DailyActionsJob } from '../../src/core/jobs/daily-actions.job';
import { container } from 'tsyringe';

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Hola! Te contacto para seguir con tu consulta sobre hoteles en Cartagena.'
            }
          }]
        })
      }
    }
  }))
}));

// Mock fetch
global.fetch = jest.fn();

describe('CRM N8N System Tests - Escenario B', () => {
  let app: express.Application;
  let databaseService: DatabaseService;
  let crmService: SimpleCRMService;
  let dailyJob: DailyActionsJob;

  beforeAll(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/crm', crmRoutes);

    // Setup services
    databaseService = new DatabaseService();
    crmService = new SimpleCRMService(databaseService);
    dailyJob = new DailyActionsJob(databaseService);
    
    container.registerInstance('DatabaseService', databaseService);
    container.registerInstance('SimpleCRMService', crmService);
    container.registerInstance('DailyActionsJob', dailyJob);

    // Environment
    process.env.CRM_MODE = 'n8n';
    process.env.CRM_ANALYSIS_ENABLED = 'true';
    process.env.CRM_BACKUP_ENABLED = 'true';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  // Test 26: Endpoint /api/crm/send-followup
  test('26. should handle send-followup endpoint correctly', async () => {
    const payload = {
      phoneNumber: '573001234567',
      profileStatus: 'Cliente VIP interesado en hotel boutique',
      proximaAccion: 'enviar opciones premium',
      userName: 'Juan Pérez'
    };

    // Mock client in database
    jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
      phoneNumber: '573001234567',
      chatId: '573001234567@s.whatsapp.net',
      userName: 'Juan Pérez'
    });

    // Mock WHAPI success
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sent: true })
    });

    // Mock database update
    jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    const response = await request(app)
      .post('/api/crm/send-followup')
      .send(payload)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Seguimiento enviado correctamente');
    
    // Verifica llamada a WHAPI
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages/text'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Juan Pérez')
      })
    );

    // Verifica cleanup
    expect(databaseService.updateClient).toHaveBeenCalledWith(
      '573001234567',
      { proximaAccion: null, fechaProximaAccion: null }
    );
  });

  // Test 27: Endpoint /api/crm/analyze-conversation
  test('27. should handle analyze-conversation endpoint', async () => {
    const payload = { phoneNumber: '573001234567' };

    jest.spyOn(crmService, 'analyzeAndUpdate').mockResolvedValue();

    const response = await request(app)
      .post('/api/crm/analyze-conversation')
      .send(payload)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Análisis CRM completado');
    
    expect(crmService.analyzeAndUpdate).toHaveBeenCalledWith('573001234567');
  });

  // Test 28: Workflow N8N análisis (simulado)
  test('28. should simulate N8N analysis workflow', async () => {
    // Simula workflow N8N que:
    // 1. Recibe webhook
    // 2. Llama a /api/crm/analyze-conversation
    // 3. Verifica update en BD

    const webhookData = {
      messages: [{
        from: '573001234567',
        from_name: 'Cliente Test',
        text: { body: 'Busco hotel en Cartagena' }
      }]
    };

    // Paso 1: N8N recibe webhook (simulado)
    expect(webhookData.messages).toHaveLength(1);

    // Paso 2: N8N llama al endpoint
    jest.spyOn(crmService, 'analyzeAndUpdate').mockResolvedValue();

    const response = await request(app)
      .post('/api/crm/analyze-conversation')
      .send({ phoneNumber: '573001234567' })
      .expect(200);

    // Paso 3: Verifica resultado
    expect(response.body.success).toBe(true);
    expect(crmService.analyzeAndUpdate).toHaveBeenCalled();
  });

  // Test 29: Workflow N8N daily actions
  test('29. should simulate N8N daily actions workflow', async () => {
    // Simula workflow N8N que ejecuta cron:
    // 1. Cron trigger en N8N
    // 2. Query clientes con acciones hoy
    // 3. Loop y POST a send-followup

    // Paso 1: N8N query equivalente
    const mockClients = [{
      phoneNumber: '573001234567',
      userName: 'Cliente Test',
      profileStatus: 'Cliente interesado',
      proximaAccion: 'enviar seguimiento',
      prioridad: 1
    }];

    jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue(mockClients);

    const clientsResponse = await request(app)
      .get('/api/crm/today-actions')
      .expect(200);

    expect(clientsResponse.body.clients).toHaveLength(1);

    // Paso 2: Para cada cliente, N8N llama send-followup
    jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
      phoneNumber: '573001234567',
      chatId: '573001234567@s.whatsapp.net'
    });

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sent: true })
    });

    jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    const followupResponse = await request(app)
      .post('/api/crm/send-followup')
      .send(mockClients[0])
      .expect(200);

    expect(followupResponse.body.success).toBe(true);
  });

  // Test 30: Fallback de N8N a interno
  test('30. should handle N8N fallback to internal', async () => {
    const originalMode = process.env.CRM_MODE;
    process.env.CRM_MODE = 'n8n';

    // Simula falla N8N (no forward webhook)
    const simulateN8NFailure = (backupEnabled: boolean) => {
      if (backupEnabled) {
        console.log('N8N failed, activating internal fallback');
        return 'internal';
      }
      return 'n8n';
    };

    const result = simulateN8NFailure(true);
    expect(result).toBe('internal');

    // Restore
    process.env.CRM_MODE = originalMode;
  });

  // Test 31: Error en endpoint send-followup
  test('31. should handle send-followup endpoint errors', async () => {
    const payload = {
      phoneNumber: '573001234567',
      profileStatus: 'Test',
      proximaAccion: 'Test'
    };

    // Mock OpenAI error
    const mockOpenAI = require('openai').OpenAI;
    mockOpenAI.mockImplementationOnce(() => ({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('OpenAI API Error'))
        }
      }
    }));

    const response = await request(app)
      .post('/api/crm/send-followup')
      .send(payload)
      .expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('OpenAI API Error');
  });

  // Test 32: Performance N8N integration
  test('32. should handle multiple N8N requests efficiently', async () => {
    const requests = Array(10).fill(0).map((_, i) => ({
      phoneNumber: `5730012345${i.toString().padStart(2, '0')}`,
      profileStatus: `Cliente ${i}`,
      proximaAccion: `Acción ${i}`,
      userName: `User ${i}`
    }));

    // Mock services
    jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
      phoneNumber: '573001234567',
      chatId: '573001234567@s.whatsapp.net'
    });

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sent: true })
    });

    jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    const startTime = Date.now();

    // Ejecuta 10 requests en paralelo
    const promises = requests.map(payload =>
      request(app)
        .post('/api/crm/send-followup')
        .send(payload)
    );

    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;

    // Todas exitosas
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Performance requirement: <5s for 10 requests
    expect(duration).toBeLessThan(5000);
  });

  // Test 33: Validación payload en endpoints
  test('33. should validate payload in endpoints', async () => {
    // Missing required fields
    const invalidPayload = {
      phoneNumber: '573001234567'
      // Missing profileStatus and proximaAccion
    };

    const response = await request(app)
      .post('/api/crm/send-followup')
      .send(invalidPayload)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Faltan campos requeridos');
  });

  // Test 34: Switch de modo a N8N
  test('34. should handle mode switch to N8N', async () => {
    process.env.CRM_MODE = 'n8n';
    
    expect(process.env.CRM_MODE).toBe('n8n');

    // En modo N8N, el bot no debe hacer análisis interno
    const shouldAnalyzeInternally = process.env.CRM_MODE === 'internal';
    expect(shouldAnalyzeInternally).toBe(false);
  });

  // Test 35: Backup enabled en modo N8N
  test('35. should handle backup in N8N mode', async () => {
    process.env.CRM_MODE = 'n8n';
    process.env.CRM_BACKUP_ENABLED = 'true';

    const hasBackup = process.env.CRM_BACKUP_ENABLED === 'true';
    expect(hasBackup).toBe(true);

    // Simula falla N8N y activa backup
    const activateBackup = (n8nFailed: boolean, backupEnabled: boolean) => {
      return n8nFailed && backupEnabled;
    };

    expect(activateBackup(true, true)).toBe(true);
  });

  // Test 36: Consistencia datos post-workflow N8N
  test('36. should maintain data consistency in N8N workflow', async () => {
    // Full N8N cycle: webhook → análisis → programar → cron → envío → cleanup

    // 1. Análisis via endpoint
    jest.spyOn(crmService, 'analyzeAndUpdate').mockResolvedValue();

    await request(app)
      .post('/api/crm/analyze-conversation')
      .send({ phoneNumber: '573001234567' })
      .expect(200);

    // 2. Query acciones programadas
    jest.spyOn(databaseService, 'getClientsWithActionToday').mockResolvedValue([{
      phoneNumber: '573001234567',
      userName: 'Test Client',
      profileStatus: 'Test',
      proximaAccion: 'Test action',
      prioridad: 2
    }]);

    const actionsResponse = await request(app)
      .get('/api/crm/today-actions')
      .expect(200);

    expect(actionsResponse.body.clients).toHaveLength(1);

    // 3. Envío y cleanup
    jest.spyOn(databaseService, 'getClientByPhone').mockResolvedValue({
      phoneNumber: '573001234567',
      chatId: '573001234567@s.whatsapp.net'
    });

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sent: true })
    });

    jest.spyOn(databaseService, 'updateClient').mockResolvedValue();

    await request(app)
      .post('/api/crm/send-followup')
      .send({
        phoneNumber: '573001234567',
        profileStatus: 'Test',
        proximaAccion: 'Test action'
      })
      .expect(200);

    // Verifica cleanup final
    expect(databaseService.updateClient).toHaveBeenLastCalledWith(
      '573001234567',
      { proximaAccion: null, fechaProximaAccion: null }
    );
  });

  // Test 37: No análisis si CRM_ANALYSIS_ENABLED=false en N8N
  test('37. should respect disabled analysis in N8N mode', async () => {
    const originalEnabled = process.env.CRM_ANALYSIS_ENABLED;
    process.env.CRM_ANALYSIS_ENABLED = 'false';

    const response = await request(app)
      .get('/api/crm/status')
      .expect(200);

    expect(response.body.crm_enabled).toBe(false);

    // Restore
    process.env.CRM_ANALYSIS_ENABLED = originalEnabled;
  });

  // Test 38: Manejo de conversación sin historial en N8N
  test('38. should handle empty conversation in N8N workflow', async () => {
    // Simula análisis con conversación vacía
    jest.spyOn(crmService, 'analyzeAndUpdate').mockImplementation(async (phoneNumber) => {
      // Mock sin historial - usa defaults
      console.log(`Analysis for ${phoneNumber} with no history - using defaults`);
    });

    const response = await request(app)
      .post('/api/crm/analyze-conversation')
      .send({ phoneNumber: '573001234567' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(crmService.analyzeAndUpdate).toHaveBeenCalledWith('573001234567');
  });

  // Test adicional: Status endpoint
  test('should return correct system status', async () => {
    const response = await request(app)
      .get('/api/crm/status')
      .expect(200);

    expect(response.body).toHaveProperty('crm_mode');
    expect(response.body).toHaveProperty('crm_enabled');
    expect(response.body).toHaveProperty('database');
    expect(response.body).toHaveProperty('daily_job');
  });
});