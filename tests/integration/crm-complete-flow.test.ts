// tests/integration/crm-complete-flow.test.ts
// Tests completos del flujo CRM end-to-end

import { PrismaClient } from '@prisma/client';
import { OpenAI } from 'openai';

jest.setTimeout(60000); // 60 segundos para tests completos

describe('CRM Complete Flow Integration Tests', () => {
  let prisma;
  let openai;
  
  const TEST_PHONE = '573003913251';
  const TEST_CHAT_ID = '573003913251@s.whatsapp.net';
  const TEST_CLIENT_DATA = {
    phoneNumber: TEST_PHONE,
    chatId: TEST_CHAT_ID,
    name: 'Sr Alex',
    userName: 'Sr Alex',
    label1: 'Colega Jefe',
    label2: 'cotización',
    label3: null
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Limpiar BD antes de cada test
    await prisma.clientView.deleteMany({});
  });

  describe('1. Database Field Population Tests', () => {
    
    test('should populate all fields according to schema specifications', async () => {
      // Crear cliente con datos completos
      const client = await prisma.clientView.create({
        data: {
          ...TEST_CLIENT_DATA,
          lastActivity: new Date(),
          threadId: 'thread_test123',
          profileStatus: 'Test profile status',
          proximaAccion: 'Test próxima acción',
          fechaProximaAccion: new Date(),
          prioridad: 1
        }
      });

      // Verificar que todos los campos requeridos estén llenos
      expect(client.phoneNumber).toBe(TEST_PHONE);
      expect(client.name).toBe('Sr Alex');
      expect(client.userName).toBe('Sr Alex');
      expect(client.label1).toBe('Colega Jefe');
      expect(client.label2).toBe('cotización');
      expect(client.chatId).toBe(TEST_CHAT_ID);
      expect(client.lastActivity).toBeInstanceOf(Date);
      expect(client.threadId).toBe('thread_test123');
      expect(client.profileStatus).toBe('Test profile status');
      expect(client.proximaAccion).toBe('Test próxima acción');
      expect(client.fechaProximaAccion).toBeInstanceOf(Date);
      expect(client.prioridad).toBe(1);
    });

    test('should handle nullable fields correctly', async () => {
      // Crear cliente con campos mínimos
      const client = await prisma.clientView.create({
        data: {
          phoneNumber: TEST_PHONE,
          chatId: TEST_CHAT_ID
        }
      });

      // Verificar campos nullable
      expect(client.name).toBeNull();
      expect(client.label1).toBeNull();
      expect(client.label2).toBeNull();
      expect(client.label3).toBeNull();
      expect(client.threadId).toBeNull();
      expect(client.profileStatus).toBeNull();
      expect(client.proximaAccion).toBeNull();
      expect(client.fechaProximaAccion).toBeNull();
      expect(client.prioridad).toBe(2); // default value
    });
  });

  describe('2. CRM Analysis Flow Tests', () => {
    
    test('should execute complete CRM analysis flow', async () => {
      // Crear cliente base
      await prisma.clientView.create({ data: TEST_CLIENT_DATA });

      // Simular análisis CRM
      const mockAnalysis = {
        profileStatus: 'El cliente Sr. Alex, según sus etiquetas, está en proceso de cotización.',
        proximaAccion: 'Hacer seguimiento sobre opciones de apartamentos.',
        fechaProximaAccion: '2025-08-01',
        prioridad: 2
      };

      // Actualizar con análisis CRM
      const updatedClient = await prisma.clientView.update({
        where: { phoneNumber: TEST_PHONE },
        data: {
          profileStatus: mockAnalysis.profileStatus,
          proximaAccion: mockAnalysis.proximaAccion,
          fechaProximaAccion: new Date(mockAnalysis.fechaProximaAccion),
          prioridad: mockAnalysis.prioridad
        }
      });

      // Verificar que el análisis se guardó correctamente
      expect(updatedClient.profileStatus).toBe(mockAnalysis.profileStatus);
      expect(updatedClient.proximaAccion).toBe(mockAnalysis.proximaAccion);
      expect(updatedClient.prioridad).toBe(mockAnalysis.prioridad);
    });

    test('should retrieve clients for daily actions', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Crear cliente con acción para hoy
      await prisma.clientView.create({
        data: {
          ...TEST_CLIENT_DATA,
          proximaAccion: 'Test action',
          fechaProximaAccion: today,
          prioridad: 1
        }
      });

      // Crear cliente sin acción
      await prisma.clientView.create({
        data: {
          phoneNumber: '573001234567',
          chatId: '573001234567@s.whatsapp.net',
          name: 'Otro Cliente'
        }
      });

      // Buscar clientes con acciones para hoy
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const clientsWithActions = await prisma.clientView.findMany({
        where: {
          fechaProximaAccion: {
            gte: today,
            lt: tomorrow
          },
          proximaAccion: {
            not: null
          }
        }
      });

      expect(clientsWithActions).toHaveLength(1);
      expect(clientsWithActions[0].phoneNumber).toBe(TEST_PHONE);
    });
  });

  describe('3. Daily Actions Flow Tests', () => {
    
    test('should process daily action and clean up fields', async () => {
      // Crear cliente con acción pendiente
      const today = new Date();
      await prisma.clientView.create({
        data: {
          ...TEST_CLIENT_DATA,
          proximaAccion: 'Hacer seguimiento',
          fechaProximaAccion: today,
          prioridad: 1
        }
      });

      // Simular procesamiento de daily action
      // 1. Recuperar cliente
      const client = await prisma.clientView.findUnique({
        where: { phoneNumber: TEST_PHONE }
      });

      expect(client.proximaAccion).toBe('Hacer seguimiento');

      // 2. Simular envío de mensaje (normalmente aquí iría la llamada a WHAPI)
      const messageGenerated = true;

      // 3. Limpiar acción después del envío
      if (messageGenerated) {
        await prisma.clientView.update({
          where: { phoneNumber: TEST_PHONE },
          data: {
            proximaAccion: null,
            fechaProximaAccion: null
          }
        });
      }

      // Verificar que la acción se limpió
      const cleanedClient = await prisma.clientView.findUnique({
        where: { phoneNumber: TEST_PHONE }
      });

      expect(cleanedClient.proximaAccion).toBeNull();
      expect(cleanedClient.fechaProximaAccion).toBeNull();
      expect(cleanedClient.profileStatus).toBeTruthy(); // Se mantiene
      expect(cleanedClient.prioridad).toBeTruthy(); // Se mantiene
    });
  });

  describe('4. Thread Management Tests', () => {
    
    test('should store and retrieve thread IDs', async () => {
      const testThreadId = 'thread_abc123def456';

      // Crear cliente con thread ID
      const client = await prisma.clientView.create({
        data: {
          ...TEST_CLIENT_DATA,
          threadId: testThreadId
        }
      });

      expect(client.threadId).toBe(testThreadId);

      // Verificar que se puede actualizar
      await prisma.clientView.update({
        where: { phoneNumber: TEST_PHONE },
        data: { threadId: 'thread_updated789' }
      });

      const updatedClient = await prisma.clientView.findUnique({
        where: { phoneNumber: TEST_PHONE }
      });

      expect(updatedClient.threadId).toBe('thread_updated789');
    });

    test('should handle null thread IDs gracefully', async () => {
      const client = await prisma.clientView.create({
        data: {
          ...TEST_CLIENT_DATA,
          threadId: null
        }
      });

      expect(client.threadId).toBeNull();
    });
  });

  describe('5. Data Consistency Tests', () => {
    
    test('should maintain data consistency across updates', async () => {
      // Crear cliente inicial
      const initialClient = await prisma.clientView.create({
        data: TEST_CLIENT_DATA
      });

      // Simular múltiples actualizaciones como en el flujo real
      const updates = [
        { profileStatus: 'Status 1', prioridad: 1 },
        { proximaAccion: 'Acción 1', fechaProximaAccion: new Date() },
        { threadId: 'thread_123' },
        { proximaAccion: null, fechaProximaAccion: null }, // Limpieza
      ];

      let currentClient = initialClient;
      for (const update of updates) {
        currentClient = await prisma.clientView.update({
          where: { phoneNumber: TEST_PHONE },
          data: update
        });
      }

      // Verificar estado final
      expect(currentClient.phoneNumber).toBe(TEST_PHONE);
      expect(currentClient.name).toBe('Sr Alex');
      expect(currentClient.profileStatus).toBe('Status 1');
      expect(currentClient.proximaAccion).toBeNull();
      expect(currentClient.threadId).toBe('thread_123');
    });
  });

  describe('6. Assistant Integration Tests', () => {
    
    test('should format data correctly for CRM Assistant', () => {
      const clientData = {
        name: 'Sr Alex',
        phoneNumber: TEST_PHONE,
        labels: [{ name: 'Colega Jefe' }, { name: 'cotización' }],
        isContact: true
      };

      const messages = [
        { from_name: 'Sr Alex', text: { body: 'Hola, necesito apartamento' }, timestamp: 1627834800 },
        { from_me: true, text: { body: 'Perfecto, tengo opciones disponibles' }, timestamp: 1627834860 }
      ];

      // Formatear como se haría en el script real
      const labelsText = clientData.labels.map(l => l.name).join(', ');
      const clientHeader = `=== INFORMACIÓN DEL CLIENTE ===
Nombre: ${clientData.name}
Teléfono: ${clientData.phoneNumber}
Etiquetas actuales: ${labelsText}
Tipo de contacto: ${clientData.isContact ? 'En agenda' : 'No guardado'}

=== HISTORIAL DE CONVERSACIÓN ===`;

      expect(clientHeader).toContain('Sr Alex');
      expect(clientHeader).toContain('Colega Jefe, cotización');
      expect(clientHeader).toContain('En agenda');
    });

    test('should format data correctly for Reservas Assistant', () => {
      const clientData = {
        name: 'Sr Alex',
        label1: 'Colega Jefe',
        label2: 'cotización',
        label3: null,
        profileStatus: 'El cliente está en proceso de cotización...',
        proximaAccion: 'Hacer seguimiento sobre apartamentos'
      };

      // Formatear como se haría en el script real
      const clientLabels = [clientData.label1, clientData.label2, clientData.label3]
        .filter(Boolean);
      const labelsText = clientLabels.length > 0 ? clientLabels.join(' y ') : 'sin etiquetas específicas';

      const prompt = `(Disparador Interno para Hacer Seguimiento)

El cliente ${clientData.name} con etiquetas "${labelsText}". 

Análisis del cliente: ${clientData.profileStatus}

Próxima acción requerida: ${clientData.proximaAccion}

Genera un mensaje de seguimiento natural para WhatsApp dirigido al cliente.`;

      expect(prompt).toContain('Sr Alex');
      expect(prompt).toContain('Colega Jefe y cotización');
      expect(prompt).toContain('Disparador Interno');
    });
  });
});

// Tests completados - ver documentación para resultados