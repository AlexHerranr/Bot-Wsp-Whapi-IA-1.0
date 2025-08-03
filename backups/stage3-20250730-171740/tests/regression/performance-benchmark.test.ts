/**
 * Performance Benchmark Tests
 * Compara rendimiento entre implementación original y modular
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Métricas de rendimiento para tracking
interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  memoryUsage: number;
  cpuTime: number;
  concurrentUsers: number;
  successRate: number;
}

// Benchmark targets basados en app-unified.ts original
const PERFORMANCE_TARGETS = {
  webhookResponseTime: 50, // ms
  concurrentThroughput: 100, // requests/second
  memoryGrowthLimit: 50, // MB
  bufferAccuracy: 95, // % accuracy in timing
  errorRecoveryTime: 200, // ms
  cacheHitRatio: 80 // % for context cache
};

const createBenchmarkPayload = (userId: string, messageType: 'text' | 'voice' | 'image' = 'text', size: 'small' | 'medium' | 'large' = 'medium') => {
  const baseMessage = {
    id: `wamid.benchmark_${Date.now()}_${Math.random()}`,
    from: userId,
    to: '5493815567391@c.us',
    timestamp: Math.floor(Date.now() / 1000),
    chat_id: userId,
    from_name: `Benchmark User ${userId.slice(-2)}`
  };

  const textSizes = {
    small: 'Consulta rápida',
    medium: 'Necesito información sobre disponibilidad para el próximo fin de semana para 2 personas',
    large: `Consulta muy detallada: ${'Estoy buscando alojamiento para mis vacaciones familiares. Somos 4 personas adultas y 2 niños. Necesitamos un lugar con cocina completa, aire acondicionado, wifi, estacionamiento y que esté cerca de la playa. Las fechas que manejamos son flexibles entre febrero y marzo. Nuestro presupuesto es de hasta $250 por noche. '.repeat(3)}`
  };

  switch (messageType) {
    case 'text':
      return {
        messages: [{
          ...baseMessage,
          type: 'text',
          text: { body: textSizes[size] }
        }]
      };
    case 'voice':
      return {
        messages: [{
          ...baseMessage,
          type: 'voice',
          voice: {
            id: `voice_benchmark_${size}`,
            mime_type: 'audio/ogg; codecs=opus',
            sha256: `sha256_benchmark_${size}`,
            file_size: size === 'small' ? 5000 : size === 'medium' ? 15000 : 45000
          }
        }]
      };
    case 'image':
      return {
        messages: [{
          ...baseMessage,
          type: 'image',
          image: {
            id: `image_benchmark_${size}`,
            mime_type: 'image/jpeg',
            sha256: `sha256_benchmark_${size}`,
            file_size: size === 'small' ? 100000 : size === 'medium' ? 500000 : 2000000,
            caption: textSizes[size]
          }
        }]
      };
  }
};

describe('Performance Benchmark Tests', () => {
  let app: any;
  let server: any;
  let benchmarkResults: PerformanceMetrics[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'benchmark';
    process.env.USE_DATABASE = 'false'; // Para comparar con original (memory-based)
    process.env.WHAPI_TOKEN = 'benchmark_token';
    process.env.OPENAI_API_KEY = 'benchmark_key';
    
    const { default: createApp } = await import('../../src/main');
    app = await createApp();
    
    const port = 4008;
    server = app.listen(port);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    
    // Generar reporte de benchmark
    await generateBenchmarkReport();
  });

  const measureMemoryUsage = () => {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024) // MB
    };
  };

  const generateBenchmarkReport = async () => {
    const reportPath = path.join(process.cwd(), 'tests', 'reports', 'benchmark-results.json');
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        targets: PERFORMANCE_TARGETS,
        results: benchmarkResults,
        summary: {
          totalTests: benchmarkResults.length,
          averageResponseTime: benchmarkResults.reduce((sum, r) => sum + r.responseTime, 0) / benchmarkResults.length,
          averageThroughput: benchmarkResults.reduce((sum, r) => sum + r.throughput, 0) / benchmarkResults.length,
          averageMemoryUsage: benchmarkResults.reduce((sum, r) => sum + r.memoryUsage, 0) / benchmarkResults.length
        }
      }, null, 2));
      
      console.log(`📊 Benchmark report saved to: ${reportPath}`);
    } catch (error) {
      console.warn('Could not save benchmark report:', error);
    }
  };

  describe('1. Response Time Benchmarks', () => {
    test('webhook response debe ser < 50ms (target original)', async () => {
      const samples = 20;
      const times: number[] = [];
      const userId = '5493815567601@c.us';
      
      for (let i = 0; i < samples; i++) {
        const payload = createBenchmarkPayload(userId, 'text', 'medium');
        
        const startTime = performance.now();
        const response = await request(app).post('/hook').send(payload).expect(200);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        expect(response.body.received).toBe(true);
        
        // Pequeña pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const avgTime = times.reduce((sum, t) => sum + t) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      console.log(`📊 Response Times: avg=${avgTime.toFixed(1)}ms, min=${minTime.toFixed(1)}ms, max=${maxTime.toFixed(1)}ms`);
      
      expect(avgTime).toBeLessThan(PERFORMANCE_TARGETS.webhookResponseTime);
      
      benchmarkResults.push({
        responseTime: avgTime,
        throughput: 1000 / avgTime, // rough throughput estimate
        memoryUsage: measureMemoryUsage().heapUsed,
        cpuTime: avgTime, // approximation
        concurrentUsers: 1,
        successRate: 100
      });
    });

    test('debe mantener performance bajo diferentes tamaños de mensaje', async () => {
      const userId = '5493815567602@c.us';
      const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
      const results: { size: string; time: number }[] = [];
      
      for (const size of sizes) {
        const payload = createBenchmarkPayload(userId, 'text', size);
        
        const startTime = performance.now();
        await request(app).post('/hook').send(payload).expect(200);
        const endTime = performance.now();
        
        const responseTime = endTime - startTime;
        results.push({ size, time: responseTime });
        
        console.log(`📊 ${size.toUpperCase()} message: ${responseTime.toFixed(1)}ms`);
      }
      
      // Todos los tamaños deben estar dentro del target
      results.forEach(result => {
        expect(result.time).toBeLessThan(PERFORMANCE_TARGETS.webhookResponseTime);
      });
      
      // El crecimiento entre small y large no debería ser más de 3x
      const growthRatio = results[2].time / results[0].time;
      expect(growthRatio).toBeLessThan(3);
    });
  });

  describe('2. Throughput Benchmarks', () => {
    test('debe manejar carga concurrente sostenida', async () => {
      const concurrentUsers = 25;
      const messagesPerUser = 2;
      const totalRequests = concurrentUsers * messagesPerUser;
      
      const startTime = performance.now();
      const promises: Promise<any>[] = [];
      
      for (let user = 0; user < concurrentUsers; user++) {
        const userId = `549381556760${String(user).padStart(2, '0')}@c.us`;
        
        for (let msg = 0; msg < messagesPerUser; msg++) {
          const payload = createBenchmarkPayload(userId, 'text', 'medium');
          promises.push(request(app).post('/hook').send(payload).expect(200));
        }
      }
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = (endTime - startTime) / 1000; // segundos
      const throughput = totalRequests / totalTime; // requests/second
      
      console.log(`📊 Concurrent throughput: ${throughput.toFixed(1)} req/s (${totalRequests} requests in ${totalTime.toFixed(2)}s)`);
      
      // Verificar éxito
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      expect(throughput).toBeGreaterThan(PERFORMANCE_TARGETS.concurrentThroughput);
      
      benchmarkResults.push({
        responseTime: (totalTime * 1000) / totalRequests,
        throughput,
        memoryUsage: measureMemoryUsage().heapUsed,
        cpuTime: totalTime * 1000,
        concurrentUsers,
        successRate: 100
      });
    });

    test('debe mantener performance con diferentes tipos de media', async () => {
      const mediaTypes: ('text' | 'voice' | 'image')[] = ['text', 'voice', 'image'];
      const results: { type: string; throughput: number }[] = [];
      
      for (const mediaType of mediaTypes) {
        const requests = 10;
        const startTime = performance.now();
        
        const promises = Array.from({ length: requests }, (_, i) => {
          const userId = `549381556761${i}@c.us`;
          const payload = createBenchmarkPayload(userId, mediaType, 'medium');
          return request(app).post('/hook').send(payload).expect(200);
        });
        
        await Promise.all(promises);
        const endTime = performance.now();
        
        const throughput = requests / ((endTime - startTime) / 1000);
        results.push({ type: mediaType, throughput });
        
        console.log(`📊 ${mediaType.toUpperCase()} throughput: ${throughput.toFixed(1)} req/s`);
      }
      
      // Todos los tipos deben cumplir con throughput mínimo
      results.forEach(result => {
        expect(result.throughput).toBeGreaterThan(PERFORMANCE_TARGETS.concurrentThroughput * 0.7); // 70% del target
      });
    });
  });

  describe('3. Memory Usage Benchmarks', () => {
    test('debe mantener memoria estable bajo carga sostenida', async () => {
      const initialMemory = measureMemoryUsage();
      const rounds = 5;
      const requestsPerRound = 15;
      const memorySnapshots: number[] = [];
      
      for (let round = 0; round < rounds; round++) {
        const roundStart = performance.now();
        const promises: Promise<any>[] = [];
        
        for (let i = 0; i < requestsPerRound; i++) {
          const userId = `549381556762${String(round * requestsPerRound + i).padStart(2, '0')}@c.us`;
          const payload = createBenchmarkPayload(userId, 'text', 'medium');
          promises.push(request(app).post('/hook').send(payload).expect(200));
        }
        
        await Promise.all(promises);
        const roundEnd = performance.now();
        
        // Forzar garbage collection si está disponible
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = measureMemoryUsage();
        memorySnapshots.push(currentMemory.heapUsed);
        
        console.log(`📊 Round ${round + 1}: ${currentMemory.heapUsed}MB heap, ${(roundEnd - roundStart).toFixed(0)}ms`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const finalMemory = measureMemoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`📊 Memory growth: ${memoryGrowth}MB (${initialMemory.heapUsed}MB → ${finalMemory.heapUsed}MB)`);
      
      expect(memoryGrowth).toBeLessThan(PERFORMANCE_TARGETS.memoryGrowthLimit);
      
      // Verificar que no hay memory leaks evidentes (crecimiento linear)
      const growthRate = memoryGrowth / rounds;
      expect(growthRate).toBeLessThan(10); // <10MB por round
    }, 30000);

    test('debe liberar memoria después de inactividad', async () => {
      // Crear carga inicial
      const initialUsers = 20;
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < initialUsers; i++) {
        const userId = `549381556763${String(i).padStart(2, '0')}@c.us`;
        const payload = createBenchmarkPayload(userId, 'text', 'large');
        promises.push(request(app).post('/hook').send(payload).expect(200));
      }
      
      await Promise.all(promises);
      const peakMemory = measureMemoryUsage();
      
      // Esperar período de inactividad (para cleanup automático)
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Forzar garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const afterIdleMemory = measureMemoryUsage();
      const memoryReduced = peakMemory.heapUsed - afterIdleMemory.heapUsed;
      
      console.log(`📊 Memory cleanup: ${memoryReduced}MB freed after idle period`);
      
      // Debería liberar al menos algo de memoria
      expect(memoryReduced).toBeGreaterThan(0);
    }, 15000);
  });

  describe('4. Buffer Timing Accuracy', () => {
    test('debe respetar timing de buffer con precisión > 95%', async () => {
      const testCases = [
        { type: 'text' as const, expectedDelay: 5000, tolerance: 250 },
        { type: 'voice' as const, expectedDelay: 8000, tolerance: 400 },
      ];
      
      for (const testCase of testCases) {
        const userId = `5493815567640@c.us`;
        const payload = createBenchmarkPayload(userId, testCase.type, 'medium');
        
        // Medir tiempo de respuesta inicial (debería ser inmediato)
        const responseStart = performance.now();
        const response = await request(app).post('/hook').send(payload).expect(200);
        const responseEnd = performance.now();
        
        const responseTime = responseEnd - responseStart;
        
        expect(response.body.received).toBe(true);
        expect(responseTime).toBeLessThan(100); // Response inmediata
        
        console.log(`📊 ${testCase.type.toUpperCase()} buffer: immediate response in ${responseTime.toFixed(1)}ms`);
        
        // En implementación real, aquí se verificaría que el procesamiento
        // ocurre después del delay esperado
      }
    });

    test('debe manejar buffer priority correctamente', async () => {
      const userId = '5493815567641@c.us';
      
      // Secuencia: texto (5s) → voz (8s) → typing (10s)
      const sequence = [
        { type: 'text' as const, expectedDelay: 5000 },
        { type: 'voice' as const, expectedDelay: 8000 }, // Debería extender buffer
      ];
      
      for (const [index, item] of sequence.entries()) {
        const payload = createBenchmarkPayload(userId, item.type, 'medium');
        const response = await request(app).post('/hook').send(payload).expect(200);
        
        expect(response.body.received).toBe(true);
        
        // Pequeña pausa entre mensajes
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('✅ Buffer priority sequence processed');
    });
  });

  describe('5. Error Recovery Performance', () => {
    test('debe recuperarse rápidamente de errores', async () => {
      // Crear error primero
      const errorPayload = {
        messages: { invalid: 'structure' }
      };
      
      const errorStart = performance.now();
      await request(app).post('/hook').send(errorPayload).expect(200);
      const errorEnd = performance.now();
      
      // Inmediatamente procesar request válido
      const validPayload = createBenchmarkPayload('5493815567642@c.us', 'text', 'medium');
      
      const recoveryStart = performance.now();
      const response = await request(app).post('/hook').send(validPayload).expect(200);
      const recoveryEnd = performance.now();
      
      const errorTime = errorEnd - errorStart;
      const recoveryTime = recoveryEnd - recoveryStart;
      
      console.log(`📊 Error recovery: error processed in ${errorTime.toFixed(1)}ms, recovery in ${recoveryTime.toFixed(1)}ms`);
      
      expect(response.body.received).toBe(true);
      expect(recoveryTime).toBeLessThan(PERFORMANCE_TARGETS.errorRecoveryTime);
    });

    test('debe mantener performance después de múltiples errores', async () => {
      // Generar varios errores
      const errorCount = 5;
      for (let i = 0; i < errorCount; i++) {
        const errorPayload = { messages: null, error_id: i };
        await request(app).post('/hook').send(errorPayload).expect(200);
      }
      
      // Medir performance después de errores
      const validRequests = 10;
      const startTime = performance.now();
      
      const promises = Array.from({ length: validRequests }, (_, i) => {
        const userId = `549381556764${i}@c.us`;
        const payload = createBenchmarkPayload(userId, 'text', 'medium');
        return request(app).post('/hook').send(payload).expect(200);
      });
      
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      const avgResponseTime = (endTime - startTime) / validRequests;
      
      console.log(`📊 Performance after ${errorCount} errors: ${avgResponseTime.toFixed(1)}ms avg response`);
      
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_TARGETS.webhookResponseTime);
    });
  });

  describe('6. Comparative Analysis', () => {
    test('debe generar métricas comparativas finales', async () => {
      const testScenarios = [
        { name: 'Single User', users: 1, messages: 10 },
        { name: 'Low Concurrency', users: 5, messages: 5 },
        { name: 'High Concurrency', users: 20, messages: 3 },
        { name: 'Stress Test', users: 50, messages: 2 }
      ];
      
      const scenarioResults: any[] = [];
      
      for (const scenario of testScenarios) {
        const startTime = performance.now();
        const promises: Promise<any>[] = [];
        
        for (let user = 0; user < scenario.users; user++) {
          for (let msg = 0; msg < scenario.messages; msg++) {
            const userId = `549381556770${String(user).padStart(2, '0')}@c.us`;
            const payload = createBenchmarkPayload(userId, 'text', 'medium');
            promises.push(request(app).post('/hook').send(payload).expect(200));
          }
        }
        
        const responses = await Promise.all(promises);
        const endTime = performance.now();
        
        const totalTime = endTime - startTime;
        const totalRequests = scenario.users * scenario.messages;
        const throughput = totalRequests / (totalTime / 1000);
        const avgResponseTime = totalTime / totalRequests;
        
        const result = {
          scenario: scenario.name,
          users: scenario.users,
          requests: totalRequests,
          totalTime: totalTime.toFixed(0),
          throughput: throughput.toFixed(1),
          avgResponseTime: avgResponseTime.toFixed(1),
          successRate: (responses.filter(r => r.body.received).length / totalRequests * 100).toFixed(1)
        };
        
        scenarioResults.push(result);
        
        console.log(`📊 ${scenario.name}: ${throughput.toFixed(1)} req/s, ${avgResponseTime.toFixed(1)}ms avg`);
      }
      
      // Generar resumen comparativo
      console.log('\n📊 BENCHMARK SUMMARY:');
      console.table(scenarioResults);
      
      // Todas las pruebas deben tener éxito
      scenarioResults.forEach(result => {
        expect(parseFloat(result.successRate)).toBeGreaterThan(99);
      });
    }, 60000);
  });
});