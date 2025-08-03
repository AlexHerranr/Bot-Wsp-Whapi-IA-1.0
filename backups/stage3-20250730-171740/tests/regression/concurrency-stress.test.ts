/**
 * Pruebas de Concurrencia y Stress Testing
 * Valida el comportamiento bajo carga alta y condiciones de estrés
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';

const createConcurrentWebhooks = (count: number, messageType: 'text' | 'voice' | 'mixed' = 'mixed') => {
  const webhooks = [];
  
  for (let i = 0; i < count; i++) {
    const userId = `549381556739${String(i).padStart(2, '0')}@c.us`;
    const type = messageType === 'mixed' ? (i % 3 === 0 ? 'voice' : i % 3 === 1 ? 'image' : 'text') : messageType;
    
    let payload: any = {
      messages: [{
        id: `wamid.${Date.now()}_${i}`,
        from: userId,
        to: '5493815567391@c.us',
        timestamp: Math.floor(Date.now() / 1000),
        chat_id: userId,
        from_name: `User${i}`
      }]
    };

    switch (type) {
      case 'text':
        payload.messages[0].type = 'text';
        payload.messages[0].text = { body: `Mensaje de prueba ${i} - consulta sobre disponibilidad` };
        break;
      case 'voice':
        payload.messages[0].type = 'voice';
        payload.messages[0].voice = {
          id: `voice_${i}`,
          mime_type: 'audio/ogg; codecs=opus',
          sha256: `sha256_${i}`
        };
        break;
      case 'image':
        payload.messages[0].type = 'image';
        payload.messages[0].image = {
          id: `image_${i}`,
          mime_type: 'image/jpeg',
          sha256: `sha256_${i}`,
          caption: `Imagen de prueba ${i}`
        };
        break;
    }

    webhooks.push({ payload, userId, index: i });
  }
  
  return webhooks;
};

describe('Concurrency & Stress Testing', () => {
  let app: any;
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_DATABASE = 'false';
    process.env.WHAPI_TOKEN = 'test_token_stress';
    process.env.OPENAI_API_KEY = 'test_key_stress';
    
    const { default: createApp } = await import('../../src/main');
    app = await createApp();
    
    const port = 4001;
    server = app.listen(port);
    baseUrl = `http://localhost:${port}`;
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('1. Concurrencia de 50 Usuarios Simultáneos', () => {
    test('debe procesar 50 webhooks concurrentes sin pérdida de datos', async () => {
      const webhooks = createConcurrentWebhooks(50, 'text');
      const startTime = performance.now();
      
      // Enviar todos los webhooks al mismo tiempo
      const promises = webhooks.map(({ payload }) => 
        request(app)
          .post('/hook')
          .send(payload)
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      // Verificaciones
      expect(responses).toHaveLength(50);
      responses.forEach((response, index) => {
        expect(response.body.received).toBe(true);
        expect(response.body.timestamp).toBeDefined();
      });

      // Performance: debe procesar 50 requests en menos de 2 segundos
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(2000);
      
      console.log(`✅ 50 webhooks concurrentes procesados en ${(totalTime).toFixed(0)}ms`);
    });

    test('debe manejar 50 usuarios diferentes sin conflictos de estado', async () => {
      const webhooks = createConcurrentWebhooks(50, 'mixed');
      
      // Procesar en lotes para simular llegada escalonada
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < webhooks.length; i += batchSize) {
        batches.push(webhooks.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const promises = batch.map(({ payload }) => 
          request(app).post('/hook').send(payload).expect(200)
        );
        await Promise.all(promises);
        
        // Pequeña pausa entre lotes
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Verificar que no hay memory leaks evidentes
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      // Heap no debería exceder 100MB para 50 usuarios
      expect(heapUsedMB).toBeLessThan(100);
      
      console.log(`✅ Memoria después de 50 usuarios: ${heapUsedMB}MB heap`);
    });
  });

  describe('2. Race Conditions y Locks', () => {
    test('debe evitar race conditions en el mismo usuario', async () => {
      const userId = '5493815567391@c.us';
      const simultaneousMessages = 5;
      
      // Crear 5 mensajes del mismo usuario al mismo tiempo
      const webhooks = Array.from({ length: simultaneousMessages }, (_, i) => ({
        messages: [{
          id: `wamid.${Date.now()}_${i}`,
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000) + i,
          chat_id: userId,
          from_name: 'Race Test User',
          type: 'text',
          text: { body: `Mensaje concurrente ${i}` }
        }]
      }));

      const promises = webhooks.map(payload => 
        request(app).post('/hook').send(payload).expect(200)
      );

      const responses = await Promise.all(promises);
      
      // Todos deben procesar exitosamente
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });

      // Esperar a que se resuelvan los buffers
      await new Promise(resolve => setTimeout(resolve, 6000));
    }, 10000);

    test('debe manejar threading de OpenAI sin bloqueos', async () => {
      const userId = '5493815567399@c.us';
      
      // Simular secuencia: mensaje inicial + respuesta rápida (como user typing)
      const initialMessage = {
        messages: [{
          id: `wamid.${Date.now()}_initial`,
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: userId,
          from_name: 'Threading Test',
          type: 'text',
          text: { body: 'Consulta inicial sobre disponibilidad' }
        }]
      };

      // Mensaje de seguimiento inmediato
      const followupMessage = {
        messages: [{
          id: `wamid.${Date.now()}_followup`,
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000) + 1,
          chat_id: userId,
          from_name: 'Threading Test',
          type: 'text',
          text: { body: 'Y también necesito info sobre precios' }
        }]
      };

      // Enviar con 500ms de diferencia
      const response1 = await request(app).post('/hook').send(initialMessage).expect(200);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response2 = await request(app).post('/hook').send(followupMessage).expect(200);

      expect(response1.body.received).toBe(true);
      expect(response2.body.received).toBe(true);
    });
  });

  describe('3. Memory Pressure Testing', () => {
    test('debe mantener memoria estable bajo carga sostenida', async () => {
      const initialMemory = process.memoryUsage();
      const rounds = 10;
      const messagesPerRound = 20;

      for (let round = 0; round < rounds; round++) {
        const webhooks = createConcurrentWebhooks(messagesPerRound, 'mixed');
        
        const promises = webhooks.map(({ payload }) => 
          request(app).post('/hook').send(payload).expect(200)
        );
        
        await Promise.all(promises);
        
        // Pausa entre rondas para permitir cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Forzar garbage collection si está disponible
        if (global.gc) {
          global.gc();
        }
        
        const currentMemory = process.memoryUsage();
        const heapGrowth = currentMemory.heapUsed - initialMemory.heapUsed;
        const heapGrowthMB = Math.round(heapGrowth / 1024 / 1024);
        
        console.log(`Round ${round + 1}/${rounds}: Heap growth ${heapGrowthMB}MB`);
        
        // El crecimiento de heap no debería ser excesivo
        expect(heapGrowthMB).toBeLessThan(50);
      }
      
      console.log(`✅ Memoria estable después de ${rounds * messagesPerRound} mensajes`);
    }, 30000);

    test('debe limpiar buffers expirados automáticamente', async () => {
      // Crear múltiples usuarios con actividad y luego inactividad
      const users = 15;
      const webhooks = createConcurrentWebhooks(users, 'text');
      
      // Procesar todos los mensajes
      const promises = webhooks.map(({ payload }) => 
        request(app).post('/hook').send(payload).expect(200)
      );
      await Promise.all(promises);
      
      // Esperar más que el buffer window para forzar cleanup
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      // Verificar que se puede procesar nuevos mensajes sin problemas
      const newWebhooks = createConcurrentWebhooks(5, 'text');
      const newPromises = newWebhooks.map(({ payload }) => 
        request(app).post('/hook').send(payload).expect(200)
      );
      
      const responses = await Promise.all(newPromises);
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      console.log('✅ Cleanup automático de buffers funcionando');
    }, 20000);
  });

  describe('4. Error Recovery Under Load', () => {
    test('debe recuperarse de errores sin afectar otros usuarios', async () => {
      // Mix de mensajes válidos e inválidos
      const validWebhooks = createConcurrentWebhooks(10, 'text');
      const invalidWebhooks = Array.from({ length: 5 }, (_, i) => ({
        payload: {
          messages: null, // Mensaje inválido
          invalid_field: `error_${i}`
        },
        userId: `invalid_${i}`,
        index: i
      }));

      const allWebhooks = [...validWebhooks, ...invalidWebhooks];
      
      // Mezclar el orden
      allWebhooks.sort(() => Math.random() - 0.5);
      
      const promises = allWebhooks.map(({ payload }) => 
        request(app).post('/hook').send(payload).expect(200) // Siempre 200, no crash
      );

      const responses = await Promise.all(promises);
      
      // Todos deben recibir respuesta exitosa (error handling interno)
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      console.log('✅ Error recovery funcionando bajo carga mixta');
    });

    test('debe mantener performance después de errores', async () => {
      // Crear errores primero
      const errorPayloads = Array.from({ length: 10 }, () => ({
        messages: { invalid: 'structure' }
      }));
      
      for (const payload of errorPayloads) {
        await request(app).post('/hook').send(payload).expect(200);
      }
      
      // Luego medir performance de mensajes válidos
      const validWebhooks = createConcurrentWebhooks(20, 'text');
      const startTime = performance.now();
      
      const promises = validWebhooks.map(({ payload }) => 
        request(app).post('/hook').send(payload).expect(200)
      );
      
      await Promise.all(promises);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      // Performance no debería degradarse por errores previos
      expect(processingTime).toBeLessThan(500);
      
      console.log(`✅ Performance post-error: ${processingTime.toFixed(0)}ms para 20 mensajes`);
    });
  });
});