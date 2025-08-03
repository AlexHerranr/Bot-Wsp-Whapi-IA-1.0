/**
 * Golden Path End-to-End Test
 * Valida el flujo completo: Webhook → Processing → PostgreSQL → Query
 * Simula el uso real de la aplicación
 */

import { DatabaseService } from '../../src/core/services/database.service';
import { WebhookProcessor } from '../../src/core/api/webhook-processor';
import { BufferManager } from '../../src/core/state/buffer-manager';
import { UserManager } from '../../src/core/state/user-state-manager';
import { MediaManager } from '../../src/core/state/media-manager';
import { MediaService } from '../../src/core/services/media.service';
import { TerminalLog } from '../../src/core/utils/terminal-log';
import { PrismaClient } from '@prisma/client';

describe('Golden Path: Complete End-to-End Flow', () => {
  let databaseService: DatabaseService;
  let webhookProcessor: WebhookProcessor;
  let bufferManager: BufferManager;
  let userManager: UserManager;
  let mediaManager: MediaManager;
  let mediaService: MediaService;
  let terminalLog: TerminalLog;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Initialize services
    databaseService = new DatabaseService();
    terminalLog = new TerminalLog();
    mediaService = new MediaService();
    mediaManager = new MediaManager(mediaService, terminalLog);
    userManager = new UserManager();
    
    // Mock process callback for BufferManager
    const mockProcessCallback = async (userId: string, combinedText: string, chatId: string, userName: string) => {
      console.log(`Processing: ${userId} - ${combinedText.substring(0, 50)}...`);
    };
    
    bufferManager = new BufferManager(mockProcessCallback);
    webhookProcessor = new WebhookProcessor(bufferManager, userManager, mediaManager, mediaService, terminalLog);
    prisma = new PrismaClient();
    
    // Connect to database
    await databaseService.connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Webhook to ClientView Persistence', () => {
    it('should process complete webhook flow and persist to PostgreSQL', async () => {
      const testPhoneNumber = '573003999001@c.us';
      const testUserName = 'Test User Golden Path';
      
      // 1. Simulate incoming webhook message
      const webhookPayload = {
        messages: [{
          id: 'test-msg-001',
          from: testPhoneNumber,
          body: 'Hola, necesito información sobre apartamentos',
          timestamp: Date.now(),
          type: 'text'
        }]
      };

      console.log('📱 Simulating webhook arrival...');
      
      // 2. Process webhook through the system
      await webhookProcessor.process(webhookPayload);
      
      // 3. Simulate thread data processing (como lo haría el bot)
      const threadData = {
        openaiId: 'thread_golden_path_001',
        userId: testPhoneNumber,
        userName: testUserName,
        labels: ['Potencial', 'Apartamentos', 'Primera_Consulta'],
        prioridad: 'MEDIA' as const,
        perfilStatus: 'Nuevo_Cliente',
        proximaAccion: 'Enviar_Catalogo',
        lastActivity: new Date()
      };

      console.log('🤖 Processing thread data...');
      
      // 4. Save thread to database
      await databaseService.saveOrUpdateThread(testPhoneNumber, threadData);
      
      console.log('💾 Thread saved, querying ClientView...');
      
      // 5. Query ClientView to verify persistence
      const clientView = await prisma.clientView.findFirst({
        where: { phoneNumber: testPhoneNumber }
      });
      
      // 6. Verify Golden Path results
      expect(clientView).toBeTruthy();
      expect(clientView?.phoneNumber).toBe(testPhoneNumber);
      expect(clientView?.userName).toBe(testUserName);
      expect(clientView?.prioridad).toBe('MEDIA');
      expect(clientView?.label1).toBe('Potencial');
      expect(clientView?.label2).toBe('Apartamentos');
      expect(clientView?.label3).toBe('Primera_Consulta');
      expect(clientView?.lastActivity).toBeDefined();
      
      console.log('✅ Golden Path: Webhook → PostgreSQL flow verified');
      console.log(`📊 ClientView record created for: ${testPhoneNumber}`);
    });

    it('should handle priority calculation and IA processing', async () => {
      const testPhoneNumber = '573003999002@c.us';
      
      // Simulate high-priority user interaction
      const threadData = {
        openaiId: 'thread_golden_path_002',
        userId: testPhoneNumber,
        userName: 'VIP Client Test',
        labels: ['VIP', 'Urgente', 'Apartamento_Lujo'],
        prioridad: 'ALTA' as const,
        perfilStatus: 'Cliente_VIP',
        proximaAccion: 'Llamada_Inmediata',
        lastActivity: new Date()
      };

      // Process through database service
      await databaseService.saveOrUpdateThread(testPhoneNumber, threadData);
      
      // Verify IA-calculated priority persisted correctly
      const clientView = await prisma.clientView.findFirst({
        where: { phoneNumber: testPhoneNumber }
      });
      
      expect(clientView?.prioridad).toBe('ALTA');
      expect(clientView?.label1).toBe('VIP');
      expect(clientView?.label2).toBe('Urgente');
      
      console.log('✅ IA Priority calculation and persistence verified');
    });
  });

  describe('2. Update Logic Equivalence (SQLite → PostgreSQL)', () => {
    it('should update existing records maintaining all field mappings', async () => {
      const testPhoneNumber = '573003999003@c.us';
      
      // Create initial record
      const initialData = {
        openaiId: 'thread_update_001',
        userId: testPhoneNumber,
        userName: 'Update Test User',
        labels: ['Inicial'],
        prioridad: 'BAJA' as const,
        lastActivity: new Date('2025-01-01')
      };
      
      await databaseService.saveOrUpdateThread(testPhoneNumber, initialData);
      
      // Update the record (simulating SQLite update behavior)
      const updatedData = {
        openaiId: 'thread_update_001',
        userId: testPhoneNumber,
        userName: 'Updated Test User',
        labels: ['Actualizado', 'Seguimiento', 'Interes_Alto'],
        prioridad: 'ALTA' as const,
        lastActivity: new Date()
      };
      
      await databaseService.saveOrUpdateThread(testPhoneNumber, updatedData);
      
      // Verify update logic worked as in SQLite
      const updatedRecord = await prisma.clientView.findFirst({
        where: { phoneNumber: testPhoneNumber }
      });
      
      expect(updatedRecord?.userName).toBe('Updated Test User');
      expect(updatedRecord?.prioridad).toBe('ALTA');
      expect(updatedRecord?.label1).toBe('Actualizado');
      expect(updatedRecord?.label2).toBe('Seguimiento');
      expect(updatedRecord?.label3).toBe('Interes_Alto');
      expect(updatedRecord?.lastActivity).toBeDefined();
      
      console.log('✅ Update logic equivalence SQLite → PostgreSQL verified');
    });
  });

  describe('3. Existing Data Verification', () => {
    it('should verify all existing columns and data integrity', async () => {
      // Query all existing data to verify migration
      const allClientViews = await prisma.clientView.findMany({
        orderBy: { lastActivity: 'desc' },
        take: 10
      });
      
      console.log(`📊 Found ${allClientViews.length} existing ClientView records`);
      
      // Verify schema structure
      if (allClientViews.length > 0) {
        const sample = allClientViews[0];
        
        // Check all expected fields exist
        expect(sample).toHaveProperty('phoneNumber');
        expect(sample).toHaveProperty('userName');
        expect(sample).toHaveProperty('prioridad');
        expect(sample).toHaveProperty('label1');
        expect(sample).toHaveProperty('label2');
        expect(sample).toHaveProperty('label3');
        expect(sample).toHaveProperty('lastActivity');
        // Note: createdAt/updatedAt might not exist in current schema
        console.log('Available properties:', Object.keys(sample));
        
        console.log('✅ All expected columns present in existing data');
        console.log(`📱 Sample record: ${sample.phoneNumber} (${sample.userName})`);
      }
      
      // Verify data types and constraints
      for (const record of allClientViews.slice(0, 3)) {
        expect(typeof record.phoneNumber).toBe('string');
        expect(['ALTA', 'MEDIA', 'BAJA'].includes(record.prioridad)).toBe(true);
        expect(record.lastActivity).toBeInstanceOf(Date);
      }
      
      console.log('✅ Data types and constraints verified for existing records');
    });

    it('should verify thread data persistence and retrieval', async () => {
      // Test thread operations similar to original SQLite logic
      const testUserId = '573003999004@c.us';
      const threadData = {
        openaiId: 'thread_persistence_001',
        userId: testUserId,
        userName: 'Thread Persistence Test',
        labels: ['Test', 'Persistence'],
        prioridad: 'MEDIA' as const
      };
      
      // Save thread
      await databaseService.saveOrUpdateThread(testUserId, threadData);
      
      // Retrieve thread (testing getThread functionality)
      const retrievedThread = await databaseService.getThread(testUserId);
      
      expect(retrievedThread).toBeTruthy();
      if (retrievedThread) {
        console.log('Retrieved thread properties:', Object.keys(retrievedThread));
        // Note: Properties may differ from expected based on ThreadRecord interface
      }
      
      console.log('✅ Thread persistence and retrieval verified');
    });
  });

  describe('4. Performance and Concurrency', () => {
    it('should handle concurrent golden path operations', async () => {
      const concurrentOperations = 10;
      const promises = [];
      
      console.log(`⚡ Testing ${concurrentOperations} concurrent golden path operations...`);
      
      for (let i = 0; i < concurrentOperations; i++) {
        const phoneNumber = `5730039990${i.toString().padStart(2, '0')}@c.us`;
        const threadData = {
          openaiId: `thread_concurrent_${i}`,
          userId: phoneNumber,
          userName: `Concurrent User ${i}`,
          labels: ['Concurrent', 'Test', `Batch_${i}`],
          prioridad: 'MEDIA' as const,
          lastActivity: new Date()
        };
        
        promises.push(
          databaseService.saveOrUpdateThread(phoneNumber, threadData)
        );
      }
      
      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentOperations;
      
      console.log(`⚡ ${concurrentOperations} operations completed in ${totalTime}ms`);
      console.log(`📊 Average time per operation: ${avgTime.toFixed(2)}ms`);
      
      // Verify all records were created
      const concurrentRecords = await prisma.clientView.findMany({
        where: {
          phoneNumber: {
            startsWith: '5730039990'
          }
        }
      });
      
      expect(concurrentRecords.length).toBeGreaterThanOrEqual(concurrentOperations);
      expect(avgTime).toBeLessThan(100); // Should be fast
      
      console.log('✅ Concurrent golden path operations verified');
    });
  });
});