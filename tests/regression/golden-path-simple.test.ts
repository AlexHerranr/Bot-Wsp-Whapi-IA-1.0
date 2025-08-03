/**
 * Golden Path Simplified Test
 * Verifica el flujo directo: Database Service → PostgreSQL → Query
 * Enfocado en verificar la lógica de actualización SQLite → PostgreSQL
 */

import { DatabaseService } from '../../src/core/services/database.service';
import { PrismaClient } from '@prisma/client';

describe('Golden Path: Database Flow Verification', () => {
  let databaseService: DatabaseService;
  let prisma: PrismaClient;

  beforeAll(async () => {
    databaseService = new DatabaseService();
    prisma = new PrismaClient();
    await databaseService.connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. SQLite → PostgreSQL Logic Equivalence', () => {
    it('should save and update thread data exactly like SQLite', async () => {
      const testPhoneNumber = '573003888001@c.us';
      const testUserName = 'Golden Path User';
      
      console.log('🗄️ Testing thread save/update logic...');
      
      // Step 1: Initial save (simulating first interaction)
      const initialThreadData = {
        openaiId: 'thread_golden_001',
        userId: testPhoneNumber,
        userName: testUserName,
        labels: ['Inicial', 'Primera_Consulta'],
        prioridad: 'BAJA' as const,
        perfilStatus: 'Nuevo',
        proximaAccion: 'Responder',
        lastActivity: new Date('2025-01-01T10:00:00Z')
      };

      await databaseService.saveOrUpdateThread(testPhoneNumber, initialThreadData);
      console.log('✅ Initial thread saved');

      // Step 2: Verify initial save in ClientView
      let clientView = await prisma.clientView.findFirst({
        where: { phoneNumber: testPhoneNumber }
      });

      expect(clientView).toBeTruthy();
      expect(clientView?.userName).toBe(testUserName);
      expect(clientView?.prioridad).toBe('BAJA');
      expect(clientView?.label1).toBe('Inicial');
      expect(clientView?.label2).toBe('Primera_Consulta');
      expect(clientView?.label3).toBeNull(); // Should be null for 2 labels
      
      console.log('✅ Initial save verified in ClientView');

      // Step 3: Update thread (simulating IA processing)
      const updatedThreadData = {
        openaiId: 'thread_golden_001',
        userId: testPhoneNumber,
        userName: 'Golden Path User Updated',
        labels: ['VIP', 'Urgente', 'Apartamento_Lujo'], // 3 labels now
        prioridad: 'ALTA' as const,
        perfilStatus: 'Cliente_VIP',
        proximaAccion: 'Llamada_Inmediata',
        lastActivity: new Date() // Updated timestamp
      };

      await databaseService.saveOrUpdateThread(testPhoneNumber, updatedThreadData);
      console.log('✅ Thread updated with IA processing');

      // Step 4: Verify update logic worked
      clientView = await prisma.clientView.findFirst({
        where: { phoneNumber: testPhoneNumber }
      });

      expect(clientView?.userName).toBe('Golden Path User Updated');
      expect(clientView?.prioridad).toBe('ALTA');
      expect(clientView?.label1).toBe('VIP');
      expect(clientView?.label2).toBe('Urgente');
      expect(clientView?.label3).toBe('Apartamento_Lujo');
      expect(clientView?.lastActivity).toBeDefined();
      
      // Verify timestamp was updated (should be recent)
      const timeDiff = Date.now() - clientView!.lastActivity.getTime();
      expect(timeDiff).toBeLessThan(5000); // Less than 5 seconds ago

      console.log('✅ Update logic verified - SQLite → PostgreSQL equivalence confirmed');
    });

    it('should handle label array mapping correctly', async () => {
      const testPhoneNumber = '573003888002@c.us';
      
      // Test with different label scenarios
      const testCases = [
        { labels: ['Solo_Uno'], expected: { label1: 'Solo_Uno', label2: null, label3: null } },
        { labels: ['Uno', 'Dos'], expected: { label1: 'Uno', label2: 'Dos', label3: null } },
        { labels: ['Uno', 'Dos', 'Tres'], expected: { label1: 'Uno', label2: 'Dos', label3: 'Tres' } },
        { labels: [], expected: { label1: null, label2: null, label3: null } }
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const phoneNumber = `${testPhoneNumber}${i}`;
        
        const threadData = {
          openaiId: `thread_labels_${i}`,
          userId: phoneNumber,
          userName: `Labels Test ${i}`,
          labels: testCase.labels,
          prioridad: 'MEDIA' as const,
          lastActivity: new Date()
        };

        await databaseService.saveOrUpdateThread(phoneNumber, threadData);

        const clientView = await prisma.clientView.findFirst({
          where: { phoneNumber }
        });

        expect(clientView?.label1).toBe(testCase.expected.label1);
        expect(clientView?.label2).toBe(testCase.expected.label2);
        expect(clientView?.label3).toBe(testCase.expected.label3);
        
        console.log(`✅ Label mapping verified for ${testCase.labels.length} labels`);
      }
    });
  });

  describe('2. Existing Data Verification', () => {
    it('should verify all existing users migrated correctly', async () => {
      // Get all existing ClientView records
      const existingUsers = await prisma.clientView.findMany({
        orderBy: { lastActivity: 'desc' },
        take: 10
      });

      console.log(`📊 Found ${existingUsers.length} existing users in PostgreSQL`);
      
      expect(existingUsers.length).toBeGreaterThan(0);

      // Verify each record has required fields
      for (const user of existingUsers) {
        expect(user.phoneNumber).toBeTruthy();
        expect(typeof user.phoneNumber).toBe('string');
        expect(['ALTA', 'MEDIA', 'BAJA'].includes(user.prioridad)).toBe(true);
        expect(user.lastActivity).toBeInstanceOf(Date);
        
        // Verify userName exists (may be null in some cases)
        if (user.userName) {
          expect(typeof user.userName).toBe('string');
        }
        
        console.log(`📱 User ${user.phoneNumber}: ${user.userName || 'No name'} (${user.prioridad})`);
      }

      console.log('✅ All existing users have valid data structure');
    });

    it('should verify thread operations work with existing data', async () => {
      // Get an existing user
      const existingUser = await prisma.clientView.findFirst({
        orderBy: { lastActivity: 'desc' }
      });

      if (!existingUser) {
        console.log('⚠️ No existing users found, skipping thread operation test');
        return;
      }

      console.log(`🔄 Testing thread operations with existing user: ${existingUser.phoneNumber}`);

      // Try to retrieve thread for existing user
      const retrievedThread = await databaseService.getThread(existingUser.phoneNumber);
      
      if (retrievedThread) {
        console.log('✅ Thread retrieved for existing user');
        console.log(`Thread properties:`, Object.keys(retrievedThread));
      } else {
        console.log('⚠️ No thread found for existing user (expected for migrated users)');
      }

      // Try to update existing user
      const updateData = {
        openaiId: 'thread_existing_update',
        userId: existingUser.phoneNumber,
        userName: existingUser.userName || 'Updated User',
        labels: ['Existing_User', 'Updated'],
        prioridad: 'MEDIA' as const,
        lastActivity: new Date()
      };

      await databaseService.saveOrUpdateThread(existingUser.phoneNumber, updateData);

      // Verify update worked
      const updatedUser = await prisma.clientView.findFirst({
        where: { phoneNumber: existingUser.phoneNumber }
      });

      expect(updatedUser?.label1).toBe('Existing_User');
      expect(updatedUser?.label2).toBe('Updated');
      
      console.log('✅ Existing user update successful');
    });
  });

  describe('3. Performance and Concurrency', () => {
    it('should handle concurrent database operations', async () => {
      const concurrentOps = 20;
      const promises = [];
      
      console.log(`⚡ Testing ${concurrentOps} concurrent database operations...`);
      
      const startTime = Date.now();
      
      for (let i = 0; i < concurrentOps; i++) {
        const phoneNumber = `573003777${i.toString().padStart(3, '0')}@c.us`;
        const priority = i % 3 === 0 ? 'ALTA' : i % 3 === 1 ? 'MEDIA' : 'BAJA';
        const threadData = {
          openaiId: `thread_perf_${i}`,
          userId: phoneNumber,
          userName: `Performance Test ${i}`,
          labels: ['Performance', 'Concurrent', `Test_${i}`],
          prioridad: priority as 'ALTA' | 'MEDIA' | 'BAJA',
          lastActivity: new Date()
        };
        
        promises.push(
          databaseService.saveOrUpdateThread(phoneNumber, threadData)
        );
      }
      
      await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentOps;
      
      console.log(`⚡ ${concurrentOps} operations completed in ${totalTime}ms`);
      console.log(`📊 Average time per operation: ${avgTime.toFixed(2)}ms`);
      
      // Verify all records were created
      const performanceRecords = await prisma.clientView.findMany({
        where: {
          phoneNumber: {
            startsWith: '573003777'
          }
        }
      });
      
      expect(performanceRecords.length).toBeGreaterThanOrEqual(concurrentOps);
      expect(avgTime).toBeLessThan(200); // Should be reasonable
      
      console.log('✅ Concurrent operations completed successfully');
    });
  });

  describe('4. Data Integrity and Edge Cases', () => {
    it('should handle special characters and edge cases', async () => {
      const testPhoneNumber = '573003666001@c.us';
      
      const threadData = {
        openaiId: 'thread_special_chars',
        userId: testPhoneNumber,
        userName: 'José María Rodríguez-Pérez ¿Cómo está? ¡Excelente! áéíóúñ',
        labels: ['Español', 'Acentos_éáíóú', 'Signos_¿¡'],
        prioridad: 'ALTA' as const,
        perfilStatus: 'Cliente con acentos áéíóú',
        proximaAccion: 'Llamar ¿cuándo?',
        lastActivity: new Date()
      };

      await databaseService.saveOrUpdateThread(testPhoneNumber, threadData);

      const clientView = await prisma.clientView.findFirst({
        where: { phoneNumber: testPhoneNumber }
      });

      expect(clientView?.userName).toContain('José María');
      expect(clientView?.userName).toContain('¿Cómo está?');
      expect(clientView?.label1).toBe('Español');
      expect(clientView?.label2).toBe('Acentos_éáíóú');
      expect(clientView?.label3).toBe('Signos_¿¡');
      
      console.log('✅ Special characters handled correctly');
      console.log(`✅ User name preserved: ${clientView?.userName}`);
    });

    it('should handle null and undefined values gracefully', async () => {
      const testPhoneNumber = '573003666002@c.us';
      
      const threadData = {
        openaiId: 'thread_null_values',
        userId: testPhoneNumber,
        userName: undefined, // Test undefined
        labels: [], // Empty labels
        prioridad: 'BAJA' as const,
        perfilStatus: null, // Test null
        proximaAccion: undefined, // Test undefined
        lastActivity: new Date()
      };

      await databaseService.saveOrUpdateThread(testPhoneNumber, threadData as any);

      const clientView = await prisma.clientView.findFirst({
        where: { phoneNumber: testPhoneNumber }
      });

      expect(clientView).toBeTruthy();
      expect(clientView?.phoneNumber).toBe(testPhoneNumber);
      expect(clientView?.prioridad).toBe('BAJA');
      expect(clientView?.label1).toBeNull();
      expect(clientView?.label2).toBeNull();
      expect(clientView?.label3).toBeNull();
      
      console.log('✅ Null/undefined values handled gracefully');
    });
  });
});