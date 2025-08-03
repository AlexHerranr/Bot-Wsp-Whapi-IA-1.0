/**
 * Memory Optimization with Heap Monitoring Tests
 * Implementa tests de memoria con heap monitoring y GC optimization
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

// Memory monitoring utilities
const measureMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB  
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    timestamp: Date.now()
  };
};

// Force garbage collection if available
const forceGC = () => {
  if (global.gc) {
    global.gc();
    return true;
  }
  return false;
};

// Create webhook payload for memory testing
const createMemoryTestPayload = (userId: string, size: 'small' | 'medium' | 'large' = 'medium') => {
  let message: string;
  
  switch (size) {
    case 'small':
      message = 'Test pequeño';
      break;
    case 'large':
      message = 'Test de memoria muy grande: '.repeat(100) + 'datos adicionales para testing de memoria';
      break;
    default: // medium
      message = 'Test de memoria mediano: necesito información sobre disponibilidad para el próximo fin de semana';
  }

  return {
    messages: [{
      id: `wamid.${Date.now()}_${Math.random()}`,
      from: userId,
      to: '5493815567391@c.us',
      timestamp: Math.floor(Date.now() / 1000),
      chat_id: userId,
      from_name: `User ${userId.slice(-2)}`,
      type: 'text',
      text: { body: message }
    }]
  };
};

describe('Memory Optimization with Heap Monitoring', () => {
  let app: any;
  let server: any;
  let baselineMemory: any;
  let memorySnapshots: any[] = [];

  beforeAll(async () => {
    // Force initial GC
    forceGC();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Take baseline memory measurement
    baselineMemory = measureMemoryUsage();
    console.log('📊 Baseline Memory:', baselineMemory);
    
    // Setup test environment
    process.env.NODE_ENV = 'test';
    process.env.USE_DATABASE = 'false'; // Memory mode for testing
    process.env.WHAPI_TOKEN = 'test_token';
    process.env.OPENAI_API_KEY = 'test_key';
    
    // Clear module cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('src/')) {
        delete require.cache[key];
      }
    });
    
    // Import and start app
    const mainModule = await import('../../src/main');
    app = await mainModule.default();
    
    const port = 0;
    server = app.listen(port);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (server) {
      server.close();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Final memory report
    console.log('📈 Memory Snapshots Summary:');
    memorySnapshots.forEach((snapshot, index) => {
      console.log(`${index + 1}. ${snapshot.label}: ${snapshot.memory.heapUsed}MB heap`);
    });
    
    // Force final GC
    forceGC();
  });

  beforeEach(() => {
    // Take memory snapshot before each test
    const currentMemory = measureMemoryUsage();
    memorySnapshots.push({
      label: expect.getState().currentTestName || 'Unknown Test',
      memory: currentMemory,
      timestamp: Date.now()
    });
  });

  describe('1. Baseline Memory Validation', () => {
    test('should have reasonable startup memory footprint', async () => {
      const currentMemory = measureMemoryUsage();
      const memoryGrowth = currentMemory.heapUsed - baselineMemory.heapUsed;
      
      console.log(`📊 Startup Memory Growth: ${memoryGrowth}MB`);
      console.log(`📊 Current Heap Usage: ${currentMemory.heapUsed}MB`);
      console.log(`📊 Current RSS: ${currentMemory.rss}MB`);
      
      // Application startup should be reasonable
      expect(currentMemory.heapUsed).toBeLessThan(100); // Max 100MB heap
      expect(currentMemory.rss).toBeLessThan(200); // Max 200MB RSS
      expect(memoryGrowth).toBeLessThan(50); // Max 50MB growth from baseline
    });

    test('should respond to health check without memory spike', async () => {
      const beforeMemory = measureMemoryUsage();
      
      // Make multiple health check requests
      for (let i = 0; i < 10; i++) {
        await request(app).get('/health').expect(200);
      }
      
      const afterMemory = measureMemoryUsage();
      const memoryDiff = afterMemory.heapUsed - beforeMemory.heapUsed;
      
      console.log(`📊 Health Check Memory Impact: ${memoryDiff}MB`);
      
      // Health checks should not cause significant memory growth
      expect(Math.abs(memoryDiff)).toBeLessThan(5); // Max 5MB change
    });
  });

  describe('2. Webhook Processing Memory Usage', () => {
    test('should handle single webhook without memory leak', async () => {
      const beforeMemory = measureMemoryUsage();
      
      const payload = createMemoryTestPayload('573001234590@c.us', 'medium');
      await request(app).post('/hook').send(payload).expect(200);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force GC to see actual memory usage
      forceGC();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const afterMemory = measureMemoryUsage();
      const memoryGrowth = afterMemory.heapUsed - beforeMemory.heapUsed;
      
      console.log(`📊 Single Webhook Memory Growth: ${memoryGrowth}MB`);
      
      // Single webhook should have minimal impact
      expect(memoryGrowth).toBeLessThan(10); // Max 10MB growth
    });

    test('should handle multiple webhooks efficiently', async () => {
      const beforeMemory = measureMemoryUsage();
      const webhookCount = 20;
      
      // Send multiple webhooks
      const promises = [];
      for (let i = 0; i < webhookCount; i++) {
        const userId = `573001234${String(i).padStart(3, '0')}@c.us`;
        const payload = createMemoryTestPayload(userId, 'medium');
        promises.push(request(app).post('/hook').send(payload));
      }
      
      await Promise.all(promises);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force GC
      forceGC();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const afterMemory = measureMemoryUsage();
      const memoryGrowth = afterMemory.heapUsed - beforeMemory.heapUsed;
      const memoryPerWebhook = memoryGrowth / webhookCount;
      
      console.log(`📊 ${webhookCount} Webhooks Total Growth: ${memoryGrowth}MB`);
      console.log(`📊 Memory per Webhook: ${memoryPerWebhook.toFixed(2)}MB`);
      
      // Multiple webhooks should scale reasonably
      expect(memoryGrowth).toBeLessThan(30); // Max 30MB for 20 webhooks
      expect(memoryPerWebhook).toBeLessThan(2); // Max 2MB per webhook
    });

    test('should handle sustained load without continuous growth', async () => {
      const initialMemory = measureMemoryUsage();
      const measurements = [];
      
      // Simulate sustained load over time
      for (let cycle = 0; cycle < 5; cycle++) {
        // Send batch of webhooks
        const promises = [];
        for (let i = 0; i < 10; i++) {
          const userId = `57300124${cycle}${String(i).padStart(2, '0')}@c.us`;
          const payload = createMemoryTestPayload(userId, 'small');
          promises.push(request(app).post('/hook').send(payload));
        }
        
        await Promise.all(promises);
        
        // Wait and measure
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Force GC between cycles
        forceGC();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const cycleMemory = measureMemoryUsage();
        measurements.push({
          cycle: cycle + 1,
          heapUsed: cycleMemory.heapUsed,
          growth: cycleMemory.heapUsed - initialMemory.heapUsed
        });
        
        console.log(`📊 Cycle ${cycle + 1}: ${cycleMemory.heapUsed}MB heap (+${cycleMemory.heapUsed - initialMemory.heapUsed}MB)`);
      }
      
      // Analyze memory trend
      const finalGrowth = measurements[measurements.length - 1].growth;
      const avgGrowthPerCycle = finalGrowth / measurements.length;
      
      console.log(`📈 Final Memory Growth: ${finalGrowth}MB`);
      console.log(`📊 Average Growth per Cycle: ${avgGrowthPerCycle.toFixed(1)}MB`);
      
      // Memory should not grow indefinitely
      expect(finalGrowth).toBeLessThan(40); // Max 40MB total growth
      expect(avgGrowthPerCycle).toBeLessThan(10); // Max 10MB average per cycle
    });
  });

  describe('3. Garbage Collection Effectiveness', () => {
    test('should recover memory after GC', async () => {
      // Create memory pressure
      const beforePressure = measureMemoryUsage();
      
      // Generate significant load
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const userId = `57300125${String(i).padStart(3, '0')}@c.us`;
        const payload = createMemoryTestPayload(userId, 'large');
        promises.push(request(app).post('/hook').send(payload));
      }
      
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const afterPressure = measureMemoryUsage();
      const pressureGrowth = afterPressure.heapUsed - beforePressure.heapUsed;
      
      console.log(`📊 Memory After Pressure: ${afterPressure.heapUsed}MB (+${pressureGrowth}MB)`);
      
      // Force garbage collection
      const gcAvailable = forceGC();
      if (gcAvailable) {
        console.log('♻️  Forced garbage collection');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterGC = measureMemoryUsage();
        const recoveredMemory = afterPressure.heapUsed - afterGC.heapUsed;
        const recoveryPercentage = (recoveredMemory / pressureGrowth) * 100;
        
        console.log(`📊 Memory After GC: ${afterGC.heapUsed}MB`);
        console.log(`♻️  Memory Recovered: ${recoveredMemory}MB`);
        console.log(`📈 Recovery Percentage: ${recoveryPercentage.toFixed(1)}%`);
        
        // GC should recover significant memory
        expect(recoveredMemory).toBeGreaterThan(0);
        expect(recoveryPercentage).toBeGreaterThan(10); // At least 10% recovery
        
      } else {
        console.log('⚠️  GC not available (run with --expose-gc for full testing)');
        expect(true).toBe(true); // Skip GC testing if not available
      }
    });

    test('should maintain stable memory under repeated GC cycles', async () => {
      const initialMemory = measureMemoryUsage();
      const gcResults = [];
      
      for (let cycle = 0; cycle < 3; cycle++) {
        // Create some memory pressure
        const promises = [];
        for (let i = 0; i < 15; i++) {
          const userId = `57300126${cycle}${String(i).padStart(2, '0')}@c.us`;
          const payload = createMemoryTestPayload(userId, 'medium');
          promises.push(request(app).post('/hook').send(payload));
        }
        
        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const beforeGC = measureMemoryUsage();
        
        // Force GC
        const gcSuccess = forceGC();
        if (gcSuccess) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const afterGC = measureMemoryUsage();
          
          gcResults.push({
            cycle: cycle + 1,
            beforeGC: beforeGC.heapUsed,
            afterGC: afterGC.heapUsed,
            recovered: beforeGC.heapUsed - afterGC.heapUsed
          });
          
          console.log(`♻️  GC Cycle ${cycle + 1}: ${beforeGC.heapUsed}MB → ${afterGC.heapUsed}MB (${beforeGC.heapUsed - afterGC.heapUsed}MB recovered)`);
        }
      }
      
      if (gcResults.length > 0) {
        const avgRecovery = gcResults.reduce((sum, result) => sum + result.recovered, 0) / gcResults.length;
        const finalMemory = gcResults[gcResults.length - 1].afterGC;
        const totalGrowth = finalMemory - initialMemory.heapUsed;
        
        console.log(`📊 Average Recovery per GC: ${avgRecovery.toFixed(1)}MB`);
        console.log(`📈 Total Memory Growth: ${totalGrowth}MB`);
        
        // Memory should be reasonably stable across GC cycles
        expect(avgRecovery).toBeGreaterThan(0);
        expect(totalGrowth).toBeLessThan(50); // Max 50MB growth over all cycles
      }
    });
  });

  describe('4. Memory Leak Detection', () => {
    test('should not leak memory with identical operations', async () => {
      const iterations = 20;
      const measurements = [];
      
      // Perform identical operations multiple times
      for (let i = 0; i < iterations; i++) {
        const beforeOp = measureMemoryUsage();
        
        // Identical operation each time
        const payload = createMemoryTestPayload('573001234999@c.us', 'medium');
        await request(app).post('/hook').send(payload).expect(200);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const afterOp = measureMemoryUsage();
        measurements.push({
          iteration: i + 1,
          memoryBefore: beforeOp.heapUsed,
          memoryAfter: afterOp.heapUsed,
          growth: afterOp.heapUsed - beforeOp.heapUsed
        });
        
        // Periodic GC
        if (i % 5 === 4) {
          forceGC();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Analyze for memory leaks
      const growthTrend = measurements.map(m => m.growth);
      const avgGrowth = growthTrend.reduce((sum, growth) => sum + growth, 0) / growthTrend.length;
      const finalMemory = measurements[measurements.length - 1].memoryAfter;
      const initialMemory = measurements[0].memoryBefore;
      const totalGrowth = finalMemory - initialMemory;
      
      console.log(`📊 Leak Detection Results:`);
      console.log(`   - Average growth per operation: ${avgGrowth.toFixed(2)}MB`);
      console.log(`   - Total growth over ${iterations} operations: ${totalGrowth}MB`);
      console.log(`   - Growth per operation: ${(totalGrowth / iterations).toFixed(3)}MB`);
      
      // Should not have significant memory leaks
      expect(avgGrowth).toBeLessThan(1); // Less than 1MB average growth per operation
      expect(totalGrowth).toBeLessThan(20); // Less than 20MB total growth
      expect(totalGrowth / iterations).toBeLessThan(1); // Less than 1MB per operation
    });

    test('should clean up after buffer timeouts', async () => {
      const beforeBuffers = measureMemoryUsage();
      
      // Create multiple buffers that will timeout
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const userId = `573001235${String(i).padStart(3, '0')}@c.us`;
        const payload = createMemoryTestPayload(userId, 'small');
        promises.push(request(app).post('/hook').send(payload));
      }
      
      await Promise.all(promises);
      
      // Wait for buffers to be created
      await new Promise(resolve => setTimeout(resolve, 1000));
      const withBuffers = measureMemoryUsage();
      const bufferMemory = withBuffers.heapUsed - beforeBuffers.heapUsed;
      
      console.log(`📊 Memory with active buffers: +${bufferMemory}MB`);
      
      // Wait for buffer timeout and cleanup (5s + cleanup margin)
      await new Promise(resolve => setTimeout(resolve, 7000));
      
      // Force GC to ensure cleanup is visible
      forceGC();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const afterCleanup = measureMemoryUsage();
      const cleanupMemory = afterCleanup.heapUsed - beforeBuffers.heapUsed;
      const memoryRecovered = bufferMemory - cleanupMemory;
      
      console.log(`📊 Memory after buffer cleanup: +${cleanupMemory}MB`);
      console.log(`♻️  Memory recovered from cleanup: ${memoryRecovered}MB`);
      
      // Buffer cleanup should recover memory
      expect(memoryRecovered).toBeGreaterThan(0);
      expect(cleanupMemory).toBeLessThan(bufferMemory); // Should be less than with buffers
    }, 15000); // Extended timeout for buffer cleanup
  });

  describe('5. Performance Under Memory Pressure', () => {
    test('should maintain performance under memory constraints', async () => {
      // Create initial memory pressure
      const largeBatch = [];
      for (let i = 0; i < 30; i++) {
        const userId = `573001236${String(i).padStart(3, '0')}@c.us`;
        const payload = createMemoryTestPayload(userId, 'large');
        largeBatch.push(request(app).post('/hook').send(payload));
      }
      
      await Promise.all(largeBatch);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pressureMemory = measureMemoryUsage();
      console.log(`📊 Memory under pressure: ${pressureMemory.heapUsed}MB`);
      
      // Test performance under pressure
      const performanceTests = [];
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        const payload = createMemoryTestPayload('573001237000@c.us', 'medium');
        await request(app).post('/hook').send(payload).expect(200);
        const endTime = performance.now();
        
        performanceTests.push(endTime - startTime);
      }
      
      const avgResponseTime = performanceTests.reduce((sum, time) => sum + time, 0) / performanceTests.length;
      const maxResponseTime = Math.max(...performanceTests);
      
      console.log(`⚡ Average response time under pressure: ${avgResponseTime.toFixed(1)}ms`);
      console.log(`⚡ Max response time under pressure: ${maxResponseTime.toFixed(1)}ms`);
      
      // Performance should remain acceptable even under memory pressure
      expect(avgResponseTime).toBeLessThan(200); // Average under 200ms
      expect(maxResponseTime).toBeLessThan(500); // Max under 500ms
    });
  });

  describe('6. Memory Report Generation', () => {
    test('should generate comprehensive memory report', async () => {
      const finalMemory = measureMemoryUsage();
      const totalGrowth = finalMemory.heapUsed - baselineMemory.heapUsed;
      
      const report = {
        testSuite: 'Memory Optimization Tests',
        timestamp: new Date().toISOString(),
        baseline: baselineMemory,
        final: finalMemory,
        growth: {
          heap: totalGrowth,
          rss: finalMemory.rss - baselineMemory.rss
        },
        snapshots: memorySnapshots.slice(-5), // Last 5 snapshots
        gcAvailable: !!global.gc,
        nodeVersion: process.version,
        platform: process.platform
      };
      
      console.log('\n📋 MEMORY OPTIMIZATION REPORT:');
      console.log('=====================================');
      console.log(`Baseline Heap: ${baselineMemory.heapUsed}MB`);
      console.log(`Final Heap: ${finalMemory.heapUsed}MB`);
      console.log(`Total Growth: ${totalGrowth}MB`);
      console.log(`RSS Growth: ${finalMemory.rss - baselineMemory.rss}MB`);
      console.log(`GC Available: ${report.gcAvailable ? 'Yes' : 'No'}`);
      console.log(`Node Version: ${process.version}`);
      console.log('=====================================\n');
      
      // Save report to file for later analysis
      try {
        const reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true });
        }
        
        const reportFile = path.join(reportsDir, `memory-report-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`📄 Memory report saved to: ${reportFile}`);
      } catch (error) {
        console.log('⚠️  Could not save memory report:', error instanceof Error ? error.message : error);
      }
      
      // Validate final memory usage is reasonable
      expect(totalGrowth).toBeLessThan(100); // Max 100MB total growth
      expect(finalMemory.heapUsed).toBeLessThan(200); // Max 200MB final heap
      expect(report.snapshots.length).toBeGreaterThan(0);
    });
  });
});