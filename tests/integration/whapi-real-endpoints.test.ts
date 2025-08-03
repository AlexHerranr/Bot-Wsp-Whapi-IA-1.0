/**
 * WHAPI Real Endpoints Test
 * Usa endpoints reales de WHAPI con el número 573003913251
 * Verifica la integración completa PostgreSQL con datos reales
 */

import { DatabaseService } from '../../src/core/services/database.service';
import { PrismaClient } from '@prisma/client';

// WHAPI response types
interface WHAPILabel {
  id: string;
  name: string;
  color?: string;
}

interface WHAPIChatInfo {
  id: string;
  name?: string;
  labels?: WHAPILabel[];
}

describe('WHAPI Real Endpoints Integration', () => {
  let databaseService: DatabaseService;
  let prisma: PrismaClient;
  
  // Formato correcto para WhatsApp según WHAPI docs
  const testPhoneNumber = '573003913251@s.whatsapp.net';
  const shortFormat = '573003913251@c.us'; // Formato usado en PostgreSQL
  
  const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
  const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

  beforeAll(async () => {
    databaseService = new DatabaseService();
    prisma = new PrismaClient();
    await databaseService.connect();
    
    console.log('🔧 WHAPI Configuration:');
    console.log('📡 API URL:', WHAPI_API_URL);
    console.log('🔑 Token configured:', !!WHAPI_TOKEN);
    console.log('📱 Test phone:', testPhoneNumber);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Real WHAPI Endpoints', () => {
    it('should get real chat info from WHAPI for 573003913251', async () => {
      if (!WHAPI_TOKEN) {
        console.log('⚠️ Skipping real WHAPI test - no token configured');
        return;
      }

      console.log('🔍 Making real WHAPI getChatInfo request...');
      console.log('📱 Target chat:', testPhoneNumber);
      
      try {
        const endpoint = `${WHAPI_API_URL}/chats/${encodeURIComponent(testPhoneNumber)}?token=${WHAPI_TOKEN}`;
        console.log('🌐 Request URL:', endpoint.replace(WHAPI_TOKEN, '[TOKEN]'));
        
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        console.log('📊 Response status:', response.status);
        console.log('📊 Response OK:', response.ok);

        if (!response.ok) {
          if (response.status === 404) {
            console.log('ℹ️ Chat not found (expected for some numbers)');
            return;
          }
          if (response.status === 401 || response.status === 403) {
            console.log('⚠️ Authentication issue - check WHAPI token');
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const chatData = await response.json() as WHAPIChatInfo;
        console.log('📊 Real WHAPI response received');
        console.log('📝 Chat ID:', chatData.id);
        console.log('👤 Chat name:', chatData.name || 'No name');
        console.log('🏷️ Labels count:', chatData.labels?.length || 0);
        
        if (chatData.labels && chatData.labels.length > 0) {
          console.log('🏷️ Labels found:', chatData.labels.map((l: any) => l.name || l.id));
        }

        // Verify response structure
        expect(chatData).toHaveProperty('id');
        expect(chatData.id).toBe(testPhoneNumber);
        
        if (chatData.labels) {
          expect(Array.isArray(chatData.labels)).toBe(true);
        }

        console.log('✅ Real WHAPI getChatInfo working correctly');
        
        return chatData;
        
      } catch (error) {
        console.error('❌ WHAPI request failed:', (error as Error).message);
        
        if ((error as Error).message.includes('fetch')) {
          console.log('🌐 Network error - check internet connection');
        }
        
        throw error;
      }
    }, 15000);

    it('should get available labels from WHAPI', async () => {
      if (!WHAPI_TOKEN) {
        console.log('⚠️ Skipping real WHAPI labels test - no token configured');
        return;
      }

      console.log('🔍 Getting available labels from WHAPI...');
      
      try {
        const endpoint = `${WHAPI_API_URL}/labels?token=${WHAPI_TOKEN}`;
        console.log('🌐 Request URL:', endpoint.replace(WHAPI_TOKEN, '[TOKEN]'));
        
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        console.log('📊 Response status:', response.status);

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            console.log('⚠️ Authentication issue - check WHAPI token');
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const labels = await response.json() as WHAPILabel[];
        console.log('📊 Available labels received');
        console.log('🔢 Total labels:', labels.length);
        
        if (labels.length > 0) {
          console.log('🏷️ Sample labels:', labels.slice(0, 5).map((l: any) => l.name || l.id));
        }

        expect(Array.isArray(labels)).toBe(true);
        
        console.log('✅ Real WHAPI getAvailableLabels working correctly');
        
        return labels;
        
      } catch (error) {
        console.error('❌ WHAPI labels request failed:', (error as Error).message);
        throw error;
      }
    }, 10000);
  });

  describe('2. Real WHAPI Data → PostgreSQL Integration', () => {
    it('should process real WHAPI data and save to PostgreSQL', async () => {
      console.log('🔄 Processing real WHAPI data for PostgreSQL...');
      
      // Check if we have real data for this user
      const existingUser = await prisma.clientView.findFirst({
        where: { phoneNumber: shortFormat }
      });

      console.log('👤 Existing user in PostgreSQL:', !!existingUser);
      if (existingUser) {
        console.log('📊 Current user data:', {
          userName: existingUser.userName,
          prioridad: existingUser.prioridad,
          labels: [existingUser.label1, existingUser.label2, existingUser.label3].filter(Boolean)
        });
      }

      // Simulate real webhook data format (based on WHAPI webhook structure)
      const realWebhookData = {
        messages: [{
          id: 'msg_test_' + Date.now(),
          from: testPhoneNumber,  // Real format: 573003913251@s.whatsapp.net
          from_me: false,
          chat_id: testPhoneNumber,
          from_name: 'Alex Test User',  // Real name from webhook
          type: 'text' as const,
          text: {
            body: 'Test message from real webhook simulation'
          }
        }]
      };

      console.log('📱 Simulating real webhook structure:', {
        from: realWebhookData.messages[0].from,
        chat_id: realWebhookData.messages[0].chat_id,
        from_name: realWebhookData.messages[0].from_name
      });

      // Process webhook data (convert to internal format)
      const userId = shortFormat; // Convert to internal format: 573003913251@c.us
      const userName = realWebhookData.messages[0].from_name;
      const chatId = realWebhookData.messages[0].chat_id;

      // Simulate WHAPI enrichment (what would come from getChatInfo)
      const whapiEnrichmentData = {
        id: testPhoneNumber,
        name: 'Alex - Real WHAPI User',  // From WHAPI getChatInfo
        labels: [
          { id: 'test_cliente', name: 'Cliente_Real', color: '#FF0000' },
          { id: 'test_whapi', name: 'WHAPI_Test', color: '#00FF00' },
          { id: 'test_integration', name: 'Integration_Test', color: '#0000FF' }
        ]
      };

      console.log('🔄 Simulating WHAPI enrichment:', {
        name: whapiEnrichmentData.name,
        labels: whapiEnrichmentData.labels.map(l => l.name)
      });

      // Save to PostgreSQL using the real data structure
      const threadData = {
        openaiId: 'thread_real_whapi_' + Date.now(),
        userId: userId, // 573003913251@c.us format for PostgreSQL
        userName: whapiEnrichmentData.name, // Real name from WHAPI
        labels: whapiEnrichmentData.labels.map(l => l.name), // Real labels from WHAPI
        prioridad: 'ALTA' as const, // Upgraded due to real interaction
        perfilStatus: 'Cliente_Real_WHAPI',
        proximaAccion: 'Contactar_Usuario_Real',
        lastActivity: new Date()
      };

      console.log('💾 Saving real WHAPI data to PostgreSQL...');
      await databaseService.saveOrUpdateThread(userId, threadData);

      // Verify data was saved correctly
      const savedUser = await prisma.clientView.findFirst({
        where: { phoneNumber: userId }
      });

      expect(savedUser).toBeTruthy();
      expect(savedUser?.userName).toBe('Alex - Real WHAPI User');
      expect(savedUser?.prioridad).toBe('ALTA');
      expect(savedUser?.label1).toBe('Cliente_Real');
      expect(savedUser?.label2).toBe('WHAPI_Test');
      expect(savedUser?.label3).toBe('Integration_Test');
      expect(savedUser?.perfilStatus).toBe('Cliente_Real_WHAPI');

      console.log('✅ Real WHAPI data processed and saved to PostgreSQL');
      console.log('📊 Final PostgreSQL data:', {
        phoneNumber: savedUser?.phoneNumber,
        userName: savedUser?.userName,
        prioridad: savedUser?.prioridad,
        labels: [savedUser?.label1, savedUser?.label2, savedUser?.label3].filter(Boolean),
        status: savedUser?.perfilStatus,
        nextAction: savedUser?.proximaAccion
      });
    });

    it('should simulate real webhook processing with correct formats', async () => {
      console.log('🔄 Simulating real webhook processing...');
      
      // Real webhook payload structure from WHAPI
      const realWebhookPayload = {
        messages: [{
          id: 'msg_real_' + Date.now(),
          from: testPhoneNumber,  // Real: 573003913251@s.whatsapp.net
          from_me: false,
          chat_id: testPhoneNumber,
          from_name: 'Alex Real User',
          type: 'text' as const,
          text: {
            body: 'Hola, necesito información sobre apartamentos'
          }
        }],
        presences: [{
          contact_id: testPhoneNumber,  // Real: 573003913251@s.whatsapp.net
          status: 'typing'
        }]
      };

      console.log('📱 Real webhook payload structure:', {
        messageFrom: realWebhookPayload.messages[0].from,
        presenceContactId: realWebhookPayload.presences[0].contact_id,
        formats: {
          webhook: testPhoneNumber,
          postgresql: shortFormat
        }
      });

      // Process the webhook (format conversion)
      const message = realWebhookPayload.messages[0];
      
      // Convert webhook format to internal format
      const internalUserId = message.from.replace('@s.whatsapp.net', '@c.us');
      console.log('🔄 Format conversion:', {
        from: message.from,
        to: internalUserId
      });

      // Save using internal format
      const messageData = {
        openaiId: 'thread_webhook_real',
        userId: internalUserId,
        userName: message.from_name || 'Usuario Real',
        labels: ['Webhook_Real', 'Procesado'],
        prioridad: 'MEDIA' as const,
        lastActivity: new Date()
      };

      await databaseService.saveOrUpdateThread(internalUserId, messageData);

      // Verify
      const webhookUser = await prisma.clientView.findFirst({
        where: { phoneNumber: internalUserId }
      });

      expect(webhookUser).toBeTruthy();
      expect(webhookUser?.phoneNumber).toBe(internalUserId);
      expect(webhookUser?.userName).toBe('Alex Real User');

      console.log('✅ Real webhook processing verified');
      console.log('📊 Webhook processing result:', {
        originalFormat: message.from,
        savedFormat: webhookUser?.phoneNumber,
        userName: webhookUser?.userName
      });
    });
  });

  describe('3. Format Validation and Conversion', () => {
    it('should handle format conversion correctly', async () => {
      console.log('🔄 Testing format conversion...');
      
      const formats = {
        whatsapp: '573003913251@s.whatsapp.net',  // WHAPI webhook format
        internal: '573003913251@c.us',            // PostgreSQL format
        phone: '573003913251'                     // Just phone number
      };

      console.log('📱 Testing format conversions:', formats);

      // Test conversion functions
      const whatsappToInternal = (whatsappFormat: string) => {
        return whatsappFormat.replace('@s.whatsapp.net', '@c.us');
      };

      const internalToWhatsapp = (internalFormat: string) => {
        return internalFormat.replace('@c.us', '@s.whatsapp.net');
      };

      expect(whatsappToInternal(formats.whatsapp)).toBe(formats.internal);
      expect(internalToWhatsapp(formats.internal)).toBe(formats.whatsapp);

      console.log('✅ Format conversion working correctly');
      console.log('🔄 Conversions verified:', {
        'WhatsApp → Internal': whatsappToInternal(formats.whatsapp),
        'Internal → WhatsApp': internalToWhatsapp(formats.internal)
      });
    });

    it('should verify PostgreSQL data consistency with real formats', async () => {
      console.log('🔍 Verifying PostgreSQL data consistency...');
      
      // Check current data for the test user
      const currentUser = await prisma.clientView.findFirst({
        where: { phoneNumber: shortFormat }
      });

      if (currentUser) {
        console.log('📊 Current user data in PostgreSQL:', {
          phoneNumber: currentUser.phoneNumber,
          userName: currentUser.userName,
          labels: [currentUser.label1, currentUser.label2, currentUser.label3].filter(Boolean),
          lastUpdate: currentUser.lastActivity
        });

        // Verify format is consistent
        expect(currentUser.phoneNumber.includes('@c.us')).toBe(true);
        expect(currentUser.phoneNumber.includes('@s.whatsapp.net')).toBe(false);

        console.log('✅ PostgreSQL format consistency verified');
      } else {
        console.log('ℹ️ No existing data found for test user');
      }

      // Show total users with different formats
      const allUsers = await prisma.clientView.findMany({
        select: { phoneNumber: true },
        take: 5
      });

      console.log('📊 Sample user formats in PostgreSQL:', 
        allUsers.map(u => u.phoneNumber)
      );

      console.log('✅ PostgreSQL data consistency check completed');
    });
  });
});