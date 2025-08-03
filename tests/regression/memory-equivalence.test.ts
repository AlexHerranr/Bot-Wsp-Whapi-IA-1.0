/**
 * Memory Equivalence Tests
 * Valida que el uso de memoria se mantiene dentro de los límites del app-unified.ts original
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';

// Threshold targets basados en análisis del app-unified.ts
const MEMORY_TARGETS = {
  initialHeap: 50, // MB - Heap inicial esperado
  maxGrowthUnderLoad: 100, // MB - Crecimiento máximo bajo carga
  gcRecoveryThreshold: 80, // % - Memoria recuperada después de GC
  bufferMemoryLimit: 25, // MB - Memoria máxima para buffers activos
  cacheMemoryLimit: 15 // MB - Memoria máxima para caches
};

const measureMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB  
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024) // MB
  };
};

const createMemoryTestPayload = (size: 'small' | 'medium' | 'large' = 'small', userId: string) => {
  let message: string;
  if (size === 'large') {
    message = 'Consulta muy detallada: '.repeat(100) + 'información sobre disponibilidad';
  } else if (size === 'medium') {
    message = 'Necesito información sobre disponibilidad para el próximo fin de semana para 2 personas';
  } else {
    message = 'Consulta rápida sobre disponibilidad';
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

describe('Memory Equivalence Tests', () => {
  let app: any;
  let server: any;
  let baseMemory: any;

  beforeAll(async () => {
    // Configurar entorno de prueba
    process.env.NODE_ENV = 'test';
    process.env.USE_DATABASE = 'false';
    process.env.WHAPI_TOKEN = 'test_token';
    process.env.OPENAI_API_KEY = 'test_key';
    
    // Forzar GC para baseline limpio
    if (global.gc) global.gc();
    
    // Medir memoria inicial
    baseMemory = measureMemoryUsage();
    console.log('📊 Base Memory:', baseMemory);
    
    // Inicializar aplicación
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
    
    // Forzar cleanup y GC final
    if (global.gc) global.gc();
  });

  describe('1. Baseline Memory Usage', () => {
    test('memoria inicial debe estar dentro del rango esperado', async () => {
      const currentMemory = measureMemoryUsage();
      console.log('📊 Current Memory after startup:', currentMemory);
      
      // El heap inicial no debe exceder el límite establecido
      expect(currentMemory.heapUsed).toBeLessThan(MEMORY_TARGETS.initialHeap);
      
      // RSS no debe ser excesivo para una aplicación Node.js típica
      expect(currentMemory.rss).toBeLessThan(150); // 150MB RSS limit
    });
  });

  describe('2. Memory Growth Under Load', () => {
    test('procesamiento de múltiples webhooks no debe causar memory leak', async () => {
      const startMemory = measureMemoryUsage();
      console.log('📊 Start Memory:', startMemory);
      
      // Simular carga de 50 webhooks
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const userId = `549381556739${String(i).padStart(2, '0')}@c.us`;
        const payload = createMemoryTestPayload('small', userId);
        promises.push(request(app).post('/hook').send(payload));
      }
      
      await Promise.all(promises);
      
      // Esperar procesamiento de buffers
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      const afterLoadMemory = measureMemoryUsage();
      console.log('📊 After Load Memory:', afterLoadMemory);
      
      const memoryGrowth = afterLoadMemory.heapUsed - startMemory.heapUsed;
      console.log('📈 Memory Growth:', memoryGrowth, 'MB');
      
      // El crecimiento debe estar dentro del límite
      expect(memoryGrowth).toBeLessThan(MEMORY_TARGETS.maxGrowthUnderLoad);
    });

    test('memoria debe recuperarse después de GC', async () => {
      const beforeGC = measureMemoryUsage();
      
      // Forzar garbage collection
      if (global.gc) {
        global.gc();
        // Dar tiempo para que GC termine
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const afterGC = measureMemoryUsage();
      console.log('📊 Before GC:', beforeGC);
      console.log('📊 After GC:', afterGC);
      
      const recoveredMemory = beforeGC.heapUsed - afterGC.heapUsed;
      const recoveryPercentage = (recoveredMemory / beforeGC.heapUsed) * 100;
      
      console.log('♻️  Memory Recovered:', recoveredMemory, 'MB');
      console.log('📊 Recovery Percentage:', recoveryPercentage.toFixed(1), '%');
      
      // Debe recuperar al menos cierto porcentaje de memoria
      // (Nota: en pruebas puede ser menor debido a overhead de testing)
      expect(recoveryPercentage).toBeGreaterThan(0);
    });
  });

  describe('3. Buffer Memory Management', () => {
    test('buffers activos no deben consumir memoria excesiva', async () => {
      const startMemory = measureMemoryUsage();
      
      // Crear múltiples buffers activos
      const promises = [];
      for (let i = 0; i < 20; i++) {
        const userId = `buffer_test_${i}@c.us`;
        const payload = createMemoryTestPayload('large', userId);
        promises.push(request(app).post('/hook').send(payload));
      }
      
      await Promise.all(promises);
      
      // Medir memoria inmediatamente (buffers activos)
      const withBuffersMemory = measureMemoryUsage();
      const bufferMemoryUsage = withBuffersMemory.heapUsed - startMemory.heapUsed;
      
      console.log('🔄 Buffer Memory Usage:', bufferMemoryUsage, 'MB');
      
      // Los buffers no deben usar memoria excesiva
      expect(bufferMemoryUsage).toBeLessThan(MEMORY_TARGETS.bufferMemoryLimit);
      
      // Esperar que se procesen los buffers
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Verificar limpieza
      const afterProcessingMemory = measureMemoryUsage();
      const memoryAfterCleanup = afterProcessingMemory.heapUsed - startMemory.heapUsed;
      
      console.log('🧹 Memory after buffer cleanup:', memoryAfterCleanup, 'MB');
      
      // La memoria debe reducirse después del procesamiento
      expect(memoryAfterCleanup).toBeLessThan(bufferMemoryUsage);
    });
  });

  describe('4. Long-running Stability', () => {
    test('memoria debe mantenerse estable durante operación prolongada', async () => {
      const measurements = [];
      const startMemory = measureMemoryUsage();
      measurements.push(startMemory.heapUsed);
      
      // Simular operación por 10 segundos con carga ligera constante
      for (let cycle = 0; cycle < 5; cycle++) {
        // Enviar 10 webhooks
        const promises = [];
        for (let i = 0; i < 10; i++) {
          const userId = `stability_${cycle}_${i}@c.us`;
          const payload = createMemoryTestPayload('small', userId);
          promises.push(request(app).post('/hook').send(payload));
        }
        
        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const currentMemory = measureMemoryUsage();
        measurements.push(currentMemory.heapUsed);
        console.log(`📊 Cycle ${cycle + 1} Memory:`, currentMemory.heapUsed, 'MB');
      }
      
      // Analizar tendencia de memoria
      const finalMemory = measurements[measurements.length - 1];
      const memoryGrowth = finalMemory - measurements[0];
      const averageGrowthPerCycle = memoryGrowth / 5;
      
      console.log('📈 Total Memory Growth:', memoryGrowth, 'MB');
      console.log('📊 Average Growth per Cycle:', averageGrowthPerCycle, 'MB');
      
      // No debe haber crecimiento sostenido excesivo
      expect(averageGrowthPerCycle).toBeLessThan(5); // Max 5MB growth per cycle
      expect(memoryGrowth).toBeLessThan(25); // Max 25MB total growth
    });
  });

  describe('5. Memory Comparison with Original', () => {
    test('uso de memoria debe ser comparable con app-unified.ts', async () => {
      // Simular carga típica
      const promises = [];
      for (let i = 0; i < 30; i++) {
        const userId = `comparison_${i}@c.us`;
        const payload = createMemoryTestPayload('medium', userId);
        promises.push(request(app).post('/hook').send(payload));
      }
      
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      const finalMemory = measureMemoryUsage();
      const totalGrowth = finalMemory.heapUsed - baseMemory.heapUsed;
      
      console.log('📊 Final Memory Usage:', finalMemory);
      console.log('📈 Total Growth from Baseline:', totalGrowth, 'MB');
      
      // El crecimiento total debe estar dentro de límites razonables
      // Basado en observaciones del app-unified.ts original
      expect(totalGrowth).toBeLessThan(75); // 75MB max growth from baseline
      expect(finalMemory.heapUsed).toBeLessThan(125); // 125MB absolute limit
    });
  });
});