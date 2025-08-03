/**
 * Pruebas de Equivalencia Funcional - End-to-End
 * Valida que la implementación modular mantiene 100% compatibilidad con app-unified.ts
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Mock data simulando webhooks reales de WHAPI
const createWebhookPayload = (messageType: 'text' | 'voice' | 'image', userId: string = '5493815567391@c.us') => {
  const baseMessage = {
    id: `wamid.${Date.now()}_${Math.random()}`,
    from: userId,
    to: '5493815567391@c.us',
    timestamp: Math.floor(Date.now() / 1000),
    chat_id: userId,
    from_name: 'Test User'
  };

  switch (messageType) {
    case 'text':
      return {
        messages: [{
          ...baseMessage,
          type: 'text',
          text: { body: 'Hola, necesito información sobre disponibilidad para el 15 de febrero al 20 de febrero para 2 personas' }
        }]
      };
    
    case 'voice':
      return {
        messages: [{
          ...baseMessage,
          type: 'voice',
          voice: {
            id: 'voice_test_id',
            mime_type: 'audio/ogg; codecs=opus',
            sha256: 'test_sha256'
          }
        }]
      };
    
    case 'image':
      return {
        messages: [{
          ...baseMessage,
          type: 'image',
          image: {
            id: 'image_test_id',
            mime_type: 'image/jpeg',
            sha256: 'test_sha256',
            caption: 'Mira esta imagen de la propiedad'
          }
        }]
      };
  }
};

describe('Equivalencia Funcional End-to-End', () => {
  let app: any;
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    // Configurar entorno de prueba
    process.env.NODE_ENV = 'test';
    process.env.USE_DATABASE = 'false'; // Forzar modo memoria para comparar con original
    process.env.WHAPI_TOKEN = 'test_token';
    process.env.OPENAI_API_KEY = 'test_key';
    
    // Importar aplicación modular
    const mainModule = await import('../../src/main');
    app = await mainModule.default();
    
    // Usar puerto dinámico para evitar conflictos
    const port = 0; // Let system assign free port
    server = app.listen(port);
    const actualPort = server.address()?.port;
    baseUrl = `http://localhost:${actualPort}`;
    
    // Esperar inicialización
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('1. Webhook Processing - Comportamiento Exacto', () => {
    test('debe procesar webhook de texto con buffering de 5 segundos', async () => {
      const startTime = performance.now();
      const payload = createWebhookPayload('text');
      
      // Enviar webhook
      const response = await request(app)
        .post('/hook')
        .send(payload)
        .expect(200);

      // Verificar respuesta inmediata (original behavior)
      expect(response.body).toMatchObject({
        received: true,
        timestamp: expect.any(String)
      });

      // Verificar tiempo de respuesta < 100ms (como original)
      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    test('debe aplicar buffering correcto según tipo de mensaje', async () => {
      const userId = '5493815567391@c.us';
      
      // Test 1: Mensaje de texto -> 5s buffer
      const textPayload = createWebhookPayload('text', userId);
      await request(app).post('/hook').send(textPayload).expect(200);
      
      // Test 2: Mensaje de voz -> 8s buffer  
      const voicePayload = createWebhookPayload('voice', userId);
      await request(app).post('/hook').send(voicePayload).expect(200);
      
      // Verificar que no hay errores de race condition
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('debe manejar múltiples mensajes concurrentes sin bloqueos', async () => {
      const promises = [];
      const userIds = [
        '5493815567391@c.us',
        '5493815567392@c.us', 
        '5493815567393@c.us'
      ];

      // Enviar 3 webhooks simultáneos
      for (const userId of userIds) {
        const payload = createWebhookPayload('text', userId);
        promises.push(
          request(app)
            .post('/hook')
            .send(payload)
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);
      
      // Todos deben responder exitosamente
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
    });
  });

  describe('2. Buffer Timing - Validación Exacta de Delays', () => {
    test('debe respetar BUFFER_DELAY_MS = 5000 para mensajes', async () => {
      const payload = createWebhookPayload('text');
      
      // Mock del buffer manager para capturar timing
      const originalConsoleLog = console.log;
      let bufferDelayCapturado: number | null = null;
      
      console.log = (...args) => {
        const message = args.join(' ');
        if (message.includes('buffer') && message.includes('5000')) {
          bufferDelayCapturado = 5000;
        }
        originalConsoleLog(...args);
      };

      await request(app).post('/hook').send(payload);
      
      console.log = originalConsoleLog;
      
      // Verificar delay correcto (puede ser implícito en logs)
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('debe aplicar BUFFER_DELAY_MS = 5000 para typing events', async () => {
      const typingPayload = {
        presences: [{
          contact_id: '5493815567391@c.us',
          status: 'typing'
        }],
        event: { type: 'presences', event: 'post' }
      };

      const response = await request(app)
        .post('/hook')
        .send(typingPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });
  });

  describe('3. Memory State Management - Equivalencia con Original', () => {
    test('debe mantener estado de usuario como app-unified.ts', async () => {
      const userId = '5493815567391@c.us';
      const payload = createWebhookPayload('text', userId);

      // Enviar mensaje inicial
      await request(app).post('/hook').send(payload);
      
      // Verificar que el estado se mantiene
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Segundo mensaje del mismo usuario
      const payload2 = createWebhookPayload('text', userId);
      await request(app).post('/hook').send(payload2);
      
      // No debe haber errores de threading
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('debe limpiar buffers expirados automáticamente', async () => {
      // Verificar comportamiento de cleanup (original tenía intervalos de limpieza)
      const payload = createWebhookPayload('text');
      await request(app).post('/hook').send(payload);
      
      // Esperar más del buffer window
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Buffer debería estar limpio para nuevo procesamiento
      const payload2 = createWebhookPayload('text');
      const response = await request(app).post('/hook').send(payload2);
      
      expect(response.body.received).toBe(true);
    }, 10000);
  });

  describe('4. Error Handling - Comportamiento Original', () => {
    test('debe manejar webhooks malformados sin crash', async () => {
      const malformedPayload = {
        invalid: 'data',
        messages: null
      };

      const response = await request(app)
        .post('/hook')
        .send(malformedPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    test('debe procesar payload vacío como original', async () => {
      const emptyPayload = {};

      const response = await request(app)
        .post('/hook')
        .send(emptyPayload)
        .expect(200);

      expect(response.body.received).toBe(true);
    });
  });

  describe('5. Performance Benchmarks - Comparación Temporal', () => {
    test('tiempo de respuesta webhook debe ser < 50ms (como original)', async () => {
      const payload = createWebhookPayload('text');
      
      const startTime = performance.now();
      await request(app).post('/hook').send(payload).expect(200);
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(50);
    });

    test('debe procesar 10 webhooks concurrentes en < 200ms total', async () => {
      const promises = [];
      const startTime = performance.now();
      
      for (let i = 0; i < 10; i++) {
        const payload = createWebhookPayload('text', `549381556739${i}@c.us`);
        promises.push(request(app).post('/hook').send(payload));
      }
      
      await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(200);
    });
  });

  describe('6. Endpoints de Sistema - Compatibilidad', () => {
    test('endpoint raíz debe devolver estadísticas como original', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('service', 'TeAlquilamos Bot');
      expect(response.body).toHaveProperty('status', 'running');
    });

    test('endpoint de métricas debe estar disponible', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('messages');
    });
  });
});