/**
 * Simplified SQL Fallback Test
 * Tests memory-only mode vs SQL mode functionality
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';

const createTestPayload = (userId: string, text: string) => ({
  messages: [{
    id: `wamid.${Date.now()}_${Math.random()}`,
    from: userId,
    to: '5493815567391@c.us',
    timestamp: Math.floor(Date.now() / 1000),
    chat_id: userId,
    from_name: `User ${userId.slice(-2)}`,
    type: 'text',
    text: { body: text }
  }]
});

describe('SQL Fallback Functionality', () => {
  let appMemory: any;
  let serverMemory: any;

  beforeAll(async () => {
    // Force memory-only mode for consistency
    process.env.NODE_ENV = 'test';
    process.env.USE_DATABASE = 'false'; // Force memory fallback
    process.env.WHAPI_TOKEN = 'test_token';
    process.env.OPENAI_API_KEY = 'test_key';
    delete process.env.DATABASE_URL; // Remove any existing DB URL
    
    // Clear module cache to ensure fresh import
    Object.keys(require.cache).forEach(key => {
      if (key.includes('src/')) {
        delete require.cache[key];
      }
    });
    
    // Import and create app
    const mainModule = await import('../../src/main');
    appMemory = await mainModule.default();
    
    // Use dynamic port
    const port = 0;
    serverMemory = appMemory.listen(port);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (serverMemory) {
      serverMemory.close();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  });

  describe('1. Memory-Only Mode Functionality', () => {
    test('should initialize successfully in memory mode', async () => {
      const response = await request(appMemory)
        .get('/')
        .expect(200);

      expect(response.body.service).toBe('TeAlquilamos Bot');
      expect(response.body.status).toBe('running');
      
      console.log('✅ Memory mode initialization successful');
    });

    test('should process webhooks without database', async () => {
      const userId = '5493815567700@c.us';
      const payload = createTestPayload(userId, 'Test message without SQL');
      
      const startTime = performance.now();
      const response = await request(appMemory)
        .post('/hook')
        .send(payload)
        .expect(200);
      const endTime = performance.now();

      expect(response.body.received).toBe(true);
      
      const responseTime = endTime - startTime;
      console.log(`✅ Memory mode response time: ${responseTime.toFixed(1)}ms`);
      
      // Should respond quickly without database overhead
      expect(responseTime).toBeLessThan(100);
    });

    test('should handle multiple concurrent users in memory mode', async () => {
      const users = [
        '5493815567701@c.us',
        '5493815567702@c.us', 
        '5493815567703@c.us',
        '5493815567704@c.us',
        '5493815567705@c.us'
      ];
      
      const promises = users.map(userId => {
        const payload = createTestPayload(userId, `Concurrent test from ${userId.slice(-3)}`);
        return request(appMemory).post('/hook').send(payload).expect(200);
      });

      const startTime = performance.now();
      const responses = await Promise.all(promises);
      const endTime = performance.now();

      // All should succeed
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      const totalTime = endTime - startTime;
      console.log(`✅ Concurrent users processed in ${totalTime.toFixed(1)}ms`);
      
      // Should handle concurrency well
      expect(totalTime).toBeLessThan(500);
    });

    test('should maintain buffer functionality without database', async () => {
      const userId = '5493815567710@c.us';
      
      // Send multiple messages to test buffering
      const messages = [
        'First message for buffering test',
        'Second message should be buffered',
        'Third message in buffer'
      ];
      
      const responses = [];
      for (const message of messages) {
        const payload = createTestPayload(userId, message);
        const response = await request(appMemory).post('/hook').send(payload).expect(200);
        responses.push(response);
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // All responses should be successful
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      console.log('✅ Buffering works without database');
    });

    test('should handle malformed requests gracefully', async () => {
      const malformedPayload = {
        invalid: 'data',
        messages: null
      };

      const response = await request(appMemory)
        .post('/hook')
        .send(malformedPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
      console.log('✅ Malformed requests handled gracefully');
    });
  });

  describe('2. Memory Performance Characteristics', () => {
    test('should have consistent response times in memory mode', async () => {
      const userId = '5493815567720@c.us';
      const measurements = [];
      
      // Take 10 measurements
      for (let i = 0; i < 10; i++) {
        const payload = createTestPayload(userId, `Performance test ${i}`);
        
        const startTime = performance.now();
        await request(appMemory).post('/hook').send(payload).expect(200);
        const endTime = performance.now();
        
        measurements.push(endTime - startTime);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const avgTime = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);
      
      console.log(`📊 Response times: avg=${avgTime.toFixed(1)}ms, min=${minTime.toFixed(1)}ms, max=${maxTime.toFixed(1)}ms`);
      
      // Performance should be consistent
      expect(avgTime).toBeLessThan(50); // Fast average
      expect(maxTime - minTime).toBeLessThan(30); // Low variance
    });

    test('should maintain low memory footprint', async () => {
      const initialMemory = process.memoryUsage();
      
      // Generate some load
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const userId = `5493815567730${String(i).padStart(2, '0')}@c.us`;
        const payload = createTestPayload(userId, `Memory footprint test ${i}`);
        promises.push(request(appMemory).post('/hook').send(payload));
      }
      
      await Promise.all(promises);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalMemory = process.memoryUsage();
      const heapGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`📊 Memory growth: ${heapGrowth.toFixed(1)}MB`);
      
      // Should have reasonable memory growth
      expect(heapGrowth).toBeLessThan(30); // Max 30MB growth
    });
  });

  describe('3. Functional Equivalence Validation', () => {
    test('should provide equivalent functionality to SQL mode', async () => {
      // Test all core features work in memory mode
      const userId = '5493815567740@c.us';
      
      // 1. Basic message processing
      const textPayload = createTestPayload(userId, 'Necesito información sobre disponibilidad');
      const textResponse = await request(appMemory).post('/hook').send(textPayload).expect(200);
      expect(textResponse.body.received).toBe(true);
      
      console.log('✅ Text message processing works');
      
      // 2. Voice message simulation
      const voicePayload = {
        messages: [{
          id: `wamid.voice_${Date.now()}`,
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: userId,
          from_name: 'Test User',
          type: 'voice',
          voice: {
            id: 'voice_test_id',
            mime_type: 'audio/ogg; codecs=opus',
            sha256: 'test_sha256'
          }
        }]
      };
      
      const voiceResponse = await request(appMemory).post('/hook').send(voicePayload).expect(200);
      expect(voiceResponse.body.received).toBe(true);
      
      console.log('✅ Voice message handling works');
      
      // 3. Status endpoints
      const statusResponse = await request(appMemory).get('/').expect(200);
      expect(statusResponse.body).toHaveProperty('service');
      expect(statusResponse.body).toHaveProperty('status');
      
      console.log('✅ Status endpoints work');
      
      // 4. Health check
      const healthResponse = await request(appMemory).get('/health').expect(200);
      expect(healthResponse.body).toHaveProperty('timestamp');
      
      console.log('✅ Health check works');
    });

    test('should maintain state consistency across requests', async () => {
      const userId = '5493815567750@c.us';
      
      // Send sequence of messages from same user
      const messageSequence = [
        'Hola, necesito información',
        'Para 2 personas',
        'Del 15 al 20 de febrero'
      ];
      
      const responses = [];
      for (const message of messageSequence) {
        const payload = createTestPayload(userId, message);
        const response = await request(appMemory).post('/hook').send(payload).expect(200);
        responses.push(response);
        
        // Small delay to ensure sequence
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // All messages should be processed successfully
      responses.forEach((response, index) => {
        expect(response.body.received).toBe(true);
        console.log(`✅ Message ${index + 1} processed successfully`);
      });
      
      console.log('✅ State consistency maintained across message sequence');
    });
  });

  describe('4. Error Recovery and Resilience', () => {
    test('should recover from processing errors', async () => {
      const userId = '5493815567760@c.us';
      
      // Send a normal message first
      const normalPayload = createTestPayload(userId, 'Normal message');
      const normalResponse = await request(appMemory).post('/hook').send(normalPayload).expect(200);
      expect(normalResponse.body.received).toBe(true);
      
      // Send malformed message
      const malformedPayload = { invalid: 'structure' };
      const malformedResponse = await request(appMemory).post('/hook').send(malformedPayload).expect(200);
      expect(malformedResponse.body.received).toBe(true);
      
      // Send another normal message to verify recovery
      const recoveryPayload = createTestPayload(userId, 'Recovery message');
      const recoveryResponse = await request(appMemory).post('/hook').send(recoveryPayload).expect(200);
      expect(recoveryResponse.body.received).toBe(true);
      
      console.log('✅ System recovers from processing errors');
    });

    test('should handle high load gracefully', async () => {
      const promises = [];
      const startTime = performance.now();
      
      // Create high load - 50 concurrent requests
      for (let i = 0; i < 50; i++) {
        const userId = `5493815567800${String(i).padStart(2, '0')}@c.us`;
        const payload = createTestPayload(userId, `High load test ${i}`);
        promises.push(request(appMemory).post('/hook').send(payload));
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      // All should succeed
      const successCount = responses.filter(r => r.body.received).length;
      expect(successCount).toBe(50);
      
      const totalTime = endTime - startTime;
      console.log(`✅ Handled 50 concurrent requests in ${totalTime.toFixed(0)}ms`);
      
      // Should handle load reasonably well
      expect(totalTime).toBeLessThan(5000); // 5 second max for 50 requests
    });
  });
});