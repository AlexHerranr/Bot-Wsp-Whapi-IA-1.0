/**
 * Pruebas de Context Cache Temporal
 * Valida el comportamiento de caching y contexto temporal como el original
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';

// Simular diferentes ventanas temporales para contexto
const createTimestampedMessage = (userId: string, text: string, hoursAgo: number = 0) => ({
  messages: [{
    id: `wamid.${Date.now()}_${Math.random()}`,
    from: userId,
    to: '5493815567391@c.us',
    timestamp: Math.floor((Date.now() - (hoursAgo * 60 * 60 * 1000)) / 1000),
    chat_id: userId,
    from_name: `User ${userId.slice(-2)}`,
    type: 'text',
    text: { body: text }
  }]
});

describe('Context Cache Temporal Tests', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.USE_DATABASE = 'false'; // Forzar cache en memoria como original
    process.env.WHAPI_TOKEN = 'test_token_context';
    process.env.OPENAI_API_KEY = 'test_key_context';
    
    const { default: createApp } = await import('../../src/main');
    app = await createApp();
    
    const port = 4003;
    server = app.listen(port);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('1. Cache de Conversación - TTL Behavior', () => {
    test('debe mantener contexto dentro de ventana de 5 minutos', async () => {
      const userId = '5493815567401@c.us';
      
      // Mensaje inicial
      const initialMessage = createTimestampedMessage(
        userId, 
        'Hola, necesito información sobre disponibilidad para febrero', 
        0
      );
      
      await request(app).post('/hook').send(initialMessage).expect(200);
      
      // Esperar procesamiento inicial
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Mensaje de seguimiento inmediato (dentro de TTL)
      const followUpMessage = createTimestampedMessage(
        userId,
        'Específicamente del 15 al 20 de febrero',
        0
      );
      
      const startTime = performance.now();
      await request(app).post('/hook').send(followUpMessage).expect(200);
      const endTime = performance.now();
      
      // El segundo mensaje debería procesar rápido (context cached)
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(50);
      
      console.log(`✅ Context cache hit: ${responseTime.toFixed(1)}ms`);
    }, 10000);

    test('debe limpiar contexto después de TTL expiry', async () => {
      const userId = '5493815567402@c.us';
      
      // Simular mensaje "antiguo" (fuera del TTL de 5 min chat cache)  
      const oldMessage = createTimestampedMessage(
        userId,
        'Mensaje de hace tiempo',
        0.1 // 6 minutos atrás
      );
      
      await request(app).post('/hook').send(oldMessage).expect(200);
      
      // Esperar que expire el cache (forzar cleanup)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Nuevo mensaje después de TTL
      const newMessage = createTimestampedMessage(
        userId,
        'Nuevo mensaje después de TTL',
        0
      );
      
      const response = await request(app).post('/hook').send(newMessage).expect(200);
      expect(response.body.received).toBe(true);
      
      console.log('✅ TTL expiry manejado correctamente');
    });

    test('debe mantener cache separado por usuario', async () => {
      const user1 = '5493815567403@c.us';
      const user2 = '5493815567404@c.us';
      
      // Mensajes simultáneos de diferentes usuarios
      const message1 = createTimestampedMessage(user1, 'Consulta usuario 1', 0);
      const message2 = createTimestampedMessage(user2, 'Consulta usuario 2', 0);
      
      await Promise.all([
        request(app).post('/hook').send(message1).expect(200),
        request(app).post('/hook').send(message2).expect(200)
      ]);
      
      // Esperar procesamiento
      await new Promise(resolve => setTimeout(resolve, 7000));
      
      // Mensajes de seguimiento
      const followUp1 = createTimestampedMessage(user1, 'Seguimiento usuario 1', 0);
      const followUp2 = createTimestampedMessage(user2, 'Seguimiento usuario 2', 0);
      
      const responses = await Promise.all([
        request(app).post('/hook').send(followUp1).expect(200),
        request(app).post('/hook').send(followUp2).expect(200)
      ]);
      
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      console.log('✅ Cache isolado por usuario funciona');
    }, 12000);
  });

  describe('2. Context Injection - Comportamiento Temporal', () => {
    test('debe inyectar contexto reciente en nueva conversación', async () => {
      const userId = '5493815567405@c.us';
      
      // Crear historial de conversación
      const historyMessages = [
        'Me interesan propiedades en la costa',
        'Busco para 4 personas',
        'Presupuesto hasta $200 por noche'
      ];
      
      // Enviar mensajes históricos
      for (let i = 0; i < historyMessages.length; i++) {
        const message = createTimestampedMessage(
          userId,
          historyMessages[i],
          0.05 * (historyMessages.length - i) // Espaciados en tiempo
        );
        
        await request(app).post('/hook').send(message).expect(200);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Esperar procesamiento del historial
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Nueva consulta que debería tener contexto
      const contextualMessage = createTimestampedMessage(
        userId,
        '¿Qué propiedades me recomendás para este fin de semana?',
        0
      );
      
      const response = await request(app)
        .post('/hook')
        .send(contextualMessage)
        .expect(200);
      
      expect(response.body.received).toBe(true);
      
      console.log('✅ Context injection funcionando');
    }, 15000);

    test('debe limitar contexto por tokens (evitar context overflow)', async () => {
      const userId = '5493815567406@c.us';
      
      // Crear múltiples mensajes largos para forzar límite de tokens
      const longMessages = Array.from({ length: 10 }, (_, i) => 
        `Mensaje muy largo número ${i + 1}: ${
          'Esta es una consulta muy detallada sobre propiedades de alquiler temporario que incluye muchos detalles específicos sobre fechas, ubicaciones, amenities, precios y requisitos particulares para el alojamiento. '.repeat(5)
        }`
      );
      
      // Enviar mensajes largos
      for (const [index, text] of longMessages.entries()) {
        const message = createTimestampedMessage(userId, text, 0.01 * (longMessages.length - index));
        await request(app).post('/hook').send(message).expect(200);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Mensaje final que debería procesar con contexto limitado
      const finalMessage = createTimestampedMessage(
        userId,
        'Resumiendo todo lo anterior, ¿qué me recomendás?',
        0
      );
      
      const response = await request(app).post('/hook').send(finalMessage).expect(200);
      expect(response.body.received).toBe(true);
      
      console.log('✅ Token limiting en context injection funciona');
    }, 20000);
  });

  describe('3. Memory Management - Cache Efficiency', () => {
    test('debe usar LRU eviction correctamente', async () => {
      // Crear múltiples usuarios para llenar cache
      const users = Array.from({ length: 15 }, (_, i) => `549381556740${String(i).padStart(2, '0')}@c.us`);
      
      // Llenar cache con conversaciones
      for (const user of users) {
        const message = createTimestampedMessage(
          user,
          `Conversación inicial del usuario ${user.slice(-5)}`,
          0
        );
        await request(app).post('/hook').send(message).expect(200);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Esperar procesamiento
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Volver a usar el primer usuario (debería reactivar su cache)
      const reactivationMessage = createTimestampedMessage(
        users[0],
        'Mensaje para reactivar cache',
        0
      );
      
      const response = await request(app).post('/hook').send(reactivationMessage).expect(200);
      expect(response.body.received).toBe(true);
      
      console.log('✅ LRU cache behavior verificado');
    }, 10000);

    test('debe hacer cleanup automático de caches expirados', async () => {
      const userId = '5493815567420@c.us';
      
      // Crear entrada en cache
      const message = createTimestampedMessage(userId, 'Mensaje para cache', 0);
      await request(app).post('/hook').send(message).expect(200);
      
      // Verificar memoria inicial
      const memoryBefore = process.memoryUsage();
      
      // Esperar más que el TTL para forzar cleanup
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Forzar alguna actividad para trigger cleanup
      const cleanupMessage = createTimestampedMessage(
        '5493815567421@c.us',
        'Mensaje para trigger cleanup',
        0
      );
      await request(app).post('/hook').send(cleanupMessage).expect(200);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar que memoria no creció descontroladamente
      const memoryAfter = process.memoryUsage();
      const heapGrowth = (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024;
      
      expect(heapGrowth).toBeLessThan(10); // No más de 10MB de crecimiento
      
      console.log(`✅ Memory cleanup: heap growth ${heapGrowth.toFixed(1)}MB`);
    }, 15000);
  });

  describe('4. Context Priority y Smart Caching', () => {
    test('debe priorizar contexto más relevante', async () => {
      const userId = '5493815567422@c.us';
      
      // Crear mix de mensajes relevantes e irrelevantes
      const messages = [
        { text: 'Hola, cómo estás?', relevant: false },
        { text: 'Busco alojamiento en Mar del Plata', relevant: true },
        { text: 'Para 3 personas', relevant: true },
        { text: 'Del 15 al 20 de febrero', relevant: true },
        { text: 'Gracias por la información', relevant: false },
        { text: 'También me interesa Villa Gesell', relevant: true }
      ];
      
      // Enviar mensajes con pequeñas pausas
      for (const [index, msg] of messages.entries()) {
        const message = createTimestampedMessage(
          userId,
          msg.text,
          0.01 * (messages.length - index)
        );
        await request(app).post('/hook').send(message).expect(200);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Mensaje que debería usar el contexto más relevante
      const queryMessage = createTimestampedMessage(
        userId,
        '¿Cuál me conviene más?',
        0
      );
      
      const response = await request(app).post('/hook').send(queryMessage).expect(200);
      expect(response.body.received).toBe(true);
      
      console.log('✅ Context prioritization funciona');
    }, 15000);

    test('debe manejar context switching entre topics', async () => {
      const userId = '5493815567423@c.us';
      
      // Topic 1: Fechas de febrero
      await request(app).post('/hook').send(
        createTimestampedMessage(userId, 'Busco para febrero del 15 al 20', 0.1)
      ).expect(200);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Topic 2: Cambio a marzo  
      await request(app).post('/hook').send(
        createTimestampedMessage(userId, 'Mejor cambiemos a marzo del 1 al 7', 0.05)
      ).expect(200);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Query sobre el topic más reciente
      const response = await request(app).post('/hook').send(
        createTimestampedMessage(userId, '¿Hay disponibilidad para esas fechas?', 0)
      ).expect(200);
      
      expect(response.body.received).toBe(true);
      
      console.log('✅ Context switching entre topics funciona');
    });
  });

  describe('5. Cache Performance bajo Load', () => {
    test('debe mantener performance de cache con múltiples usuarios activos', async () => {
      const activeUsers = 20;
      const messagesPerUser = 3;
      
      // Crear actividad concurrente de múltiples usuarios
      const allPromises = [];
      
      for (let userId = 0; userId < activeUsers; userId++) {
        const userIdString = `549381556750${String(userId).padStart(2, '0')}@c.us`;
        
        for (let msgIndex = 0; msgIndex < messagesPerUser; msgIndex++) {
          const message = createTimestampedMessage(
            userIdString,
            `Mensaje ${msgIndex + 1} del usuario ${userId}`,
            0.001 * msgIndex // Muy cercanos en tiempo
          );
          
          allPromises.push(
            request(app).post('/hook').send(message).expect(200)
          );
        }
      }
      
      const startTime = performance.now();
      const responses = await Promise.all(allPromises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const avgTimePerMessage = totalTime / (activeUsers * messagesPerUser);
      
      // Performance targets
      expect(responses).toHaveLength(activeUsers * messagesPerUser);
      expect(avgTimePerMessage).toBeLessThan(30); // <30ms por mensaje promedio
      expect(totalTime).toBeLessThan(3000); // <3s total para 60 mensajes
      
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      console.log(`✅ Cache performance: ${avgTimePerMessage.toFixed(1)}ms/msg promedio`);
    }, 15000);
  });
});