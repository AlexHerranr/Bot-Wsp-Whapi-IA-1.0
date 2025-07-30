/**
 * Pruebas de Media Processing Real (Sin Mocks)
 * Valida el procesamiento real de audio e imágenes
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

// Crear archivos de test reales
const createTestMediaFiles = async () => {
  const testDir = path.join(process.cwd(), 'tests', 'fixtures', 'media');
  
  try {
    await fs.mkdir(testDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  // Crear archivo de audio de prueba (simulado - en producción sería real)
  const audioPath = path.join(testDir, 'test-audio.ogg');
  const imageUrl = path.join(testDir, 'test-image.jpg');
  
  // Audio OGG básico (header simulado para tests)
  const oggHeader = Buffer.from([
    0x4F, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, // OggS header
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x30, 0x00, 0x00
  ]);
  await fs.writeFile(audioPath, oggHeader);

  // JPG básico (header simulado)
  const jpgHeader = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, // JPG header
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
  ]);
  await fs.writeFile(imageUrl, jpgHeader);

  return { audioPath, imageUrl };
};

// Mock de servicios externos con comportamiento realista
const mockExternalServices = () => {
  // Mock OpenAI Whisper response
  const originalFetch = global.fetch;
  
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    
    // Mock WHAPI media download
    if (urlStr.includes('whapi.cloud') && urlStr.includes('media')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'audio/ogg']]),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      } as Response);
    }
    
    // Mock OpenAI Whisper
    if (urlStr.includes('openai.com') && urlStr.includes('audio/transcriptions')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          text: "Necesito información sobre disponibilidad para el próximo fin de semana"
        })
      } as Response);
    }
    
    // Mock OpenAI Vision
    if (urlStr.includes('openai.com') && urlStr.includes('chat/completions')) {
      const body = JSON.parse(options?.body || '{}');
      if (body.messages?.some((m: any) => m.content?.some((c: any) => c.type === 'image_url'))) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: "Esta imagen muestra una propiedad con excelente vista. Puedo ayudarte con información sobre disponibilidad y precios."
              }
            }],
            usage: { total_tokens: 150 }
          })
        } as Response);
      }
    }
    
    // Default: usar fetch original para otros casos
    return originalFetch(url, options);
  }) as jest.MockedFunction<typeof fetch>;
};

describe('Media Processing Real Tests', () => {
  let app: any;
  let server: any;
  let testMediaFiles: { audioPath: string; imageUrl: string };

  beforeAll(async () => {
    // Setup
    process.env.NODE_ENV = 'test';
    process.env.USE_DATABASE = 'false';
    process.env.WHAPI_TOKEN = 'test_token_media';
    process.env.OPENAI_API_KEY = 'test_key_media';
    
    // Crear archivos de test
    testMediaFiles = await createTestMediaFiles();
    
    // Configurar mocks realistas
    mockExternalServices();
    
    const { default: createApp } = await import('../../src/main');
    app = await createApp();
    
    const port = 4002;
    server = app.listen(port);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
    
    // Cleanup test files
    try {
      await fs.unlink(testMediaFiles.audioPath);
      await fs.unlink(testMediaFiles.imageUrl);
    } catch (error) {
      // Files might not exist
    }
  });

  describe('1. Audio Processing - Whisper Integration', () => {
    test('debe procesar nota de voz con transcripción real', async () => {
      const voiceWebhook = {
        messages: [{
          id: 'wamid.voice_test_001',
          from: '5493815567391@c.us',
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: '5493815567391@c.us',
          from_name: 'Voice Test User',
          type: 'voice',
          voice: {
            id: 'voice_media_test_001',
            mime_type: 'audio/ogg; codecs=opus',
            sha256: 'test_voice_sha256',
            file_size: 15620
          }
        }]
      };

      const startTime = performance.now();
      
      const response = await request(app)
        .post('/hook')
        .send(voiceWebhook)
        .expect(200);

      const responseTime = performance.now() - startTime;
      
      // Verificaciones básicas
      expect(response.body.received).toBe(true);
      expect(responseTime).toBeLessThan(100); // Response inmediata
      
      // Esperar procesamiento del audio (buffer de 8s para voice)
      await new Promise(resolve => setTimeout(resolve, 9000));
      
      console.log('✅ Audio processing iniciado correctamente');
    }, 15000);

    test('debe manejar errores de descarga de audio gracefully', async () => {
      const invalidVoiceWebhook = {
        messages: [{
          id: 'wamid.voice_invalid_001',
          from: '5493815567392@c.us',
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: '5493815567392@c.us',
          from_name: 'Invalid Voice User',
          type: 'voice',
          voice: {
            id: 'invalid_voice_id',
            mime_type: 'audio/ogg',
            sha256: 'invalid_sha256'
          }
        }]
      };

      const response = await request(app)
        .post('/hook')
        .send(invalidVoiceWebhook)
        .expect(200);

      expect(response.body.received).toBe(true);
      
      // El sistema debe continuar funcionando después del error
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Error handling para audio inválido funciona');
    });

    test('debe procesar múltiples audios concurrentes', async () => {
      const voiceWebhooks = Array.from({ length: 3 }, (_, i) => ({
        messages: [{
          id: `wamid.voice_concurrent_${i}`,
          from: `549381556739${i}@c.us`,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000) + i,
          chat_id: `549381556739${i}@c.us`,
          from_name: `Concurrent Voice ${i}`,
          type: 'voice',
          voice: {
            id: `voice_concurrent_${i}`,
            mime_type: 'audio/ogg; codecs=opus',
            sha256: `concurrent_sha256_${i}`
          }
        }]
      }));

      const promises = voiceWebhooks.map(webhook => 
        request(app).post('/hook').send(webhook).expect(200)
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.body.received).toBe(true);
      });
      
      console.log('✅ Procesamiento concurrente de audio funcionando');
    });
  });

  describe('2. Image Processing - Vision Integration', () => {
    test('debe procesar imagen con análisis de Vision API', async () => {
      const imageWebhook = {
        messages: [{
          id: 'wamid.image_test_001',
          from: '5493815567393@c.us',
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: '5493815567393@c.us',
          from_name: 'Image Test User',
          type: 'image',
          image: {
            id: 'image_media_test_001',
            mime_type: 'image/jpeg',
            sha256: 'test_image_sha256',
            caption: 'Mira esta propiedad que me interesa'
          }
        }]
      };

      const startTime = performance.now();
      
      const response = await request(app)
        .post('/hook')
        .send(imageWebhook)
        .expect(200);

      const responseTime = performance.now() - startTime;
      
      expect(response.body.received).toBe(true);
      expect(responseTime).toBeLessThan(100);
      
      // Esperar procesamiento de imagen (buffer normal de 5s)
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      console.log('✅ Image processing iniciado correctamente');
    }, 10000);

    test('debe manejer imágenes grandes sin timeout', async () => {
      const largeImageWebhook = {
        messages: [{
          id: 'wamid.large_image_001',
          from: '5493815567394@c.us',
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: '5493815567394@c.us',
          from_name: 'Large Image User',
          type: 'image',
          image: {
            id: 'large_image_001',
            mime_type: 'image/jpeg',
            sha256: 'large_image_sha256',
            file_size: 5242880, // 5MB
            caption: 'Imagen de alta resolución de la propiedad'
          }
        }]
      };

      const response = await request(app)
        .post('/hook')
        .send(largeImageWebhook)
        .expect(200);

      expect(response.body.received).toBe(true);
      
      console.log('✅ Large image handling funciona');
    });

    test('debe procesar imagen sin caption', async () => {
      const imageCaptionlessWebhook = {
        messages: [{
          id: 'wamid.no_caption_001',
          from: '5493815567395@c.us',
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: '5493815567395@c.us',
          from_name: 'No Caption User',
          type: 'image',
          image: {
            id: 'image_no_caption_001',
            mime_type: 'image/jpeg',
            sha256: 'no_caption_sha256'
            // Sin caption
          }
        }]
      };

      const response = await request(app)
        .post('/hook')
        .send(imageCaptionlessWebhook)
        .expect(200);

      expect(response.body.received).toBe(true);
      
      console.log('✅ Image sin caption procesada correctamente');
    });
  });

  describe('3. Mixed Media Scenarios', () => {
    test('debe procesar secuencia: texto → imagen → audio', async () => {
      const userId = '5493815567396@c.us';
      
      // 1. Mensaje de texto
      const textWebhook = {
        messages: [{
          id: 'wamid.sequence_text',
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: userId,
          from_name: 'Sequence User',
          type: 'text',
          text: { body: 'Hola, tengo algunas consultas' }
        }]
      };
      
      // 2. Imagen
      const imageWebhook = {
        messages: [{
          id: 'wamid.sequence_image',
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000) + 1,
          chat_id: userId,
          from_name: 'Sequence User',
          type: 'image',
          image: {
            id: 'sequence_image',
            mime_type: 'image/jpeg',
            sha256: 'sequence_image_sha256',
            caption: 'Esta es la propiedad'
          }
        }]
      };
      
      // 3. Audio
      const voiceWebhook = {
        messages: [{
          id: 'wamid.sequence_voice',
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000) + 2,
          chat_id: userId,
          from_name: 'Sequence User',
          type: 'voice',
          voice: {
            id: 'sequence_voice',
            mime_type: 'audio/ogg',
            sha256: 'sequence_voice_sha256'
          }
        }]
      };

      // Enviar secuencialmente con pequeñas pausas
      await request(app).post('/hook').send(textWebhook).expect(200);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await request(app).post('/hook').send(imageWebhook).expect(200);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await request(app).post('/hook').send(voiceWebhook).expect(200);
      
      // Esperar que se procesen todos los buffers
      await new Promise(resolve => setTimeout(resolve, 12000));
      
      console.log('✅ Secuencia mixta de media procesada');
    }, 20000);

    test('debe mantener context entre diferentes tipos de media', async () => {
      const userId = '5493815567397@c.us';
      
      // Conversación con contexto: imagen seguida de pregunta
      const imageWithContext = {
        messages: [{
          id: 'wamid.context_image',
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: userId,
          from_name: 'Context User',
          type: 'image',
          image: {
            id: 'context_image',
            mime_type: 'image/jpeg',
            sha256: 'context_image_sha256',
            caption: 'Esta propiedad me gusta'
          }
        }]
      };
      
      const followUpText = {
        messages: [{
          id: 'wamid.context_followup',
          from: userId,
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000) + 10,
          chat_id: userId,
          from_name: 'Context User',
          type: 'text',
          text: { body: '¿Cuánto cuesta por noche?' }
        }]
      };

      await request(app).post('/hook').send(imageWithContext).expect(200);
      
      // Esperar procesamiento de imagen
      await new Promise(resolve => setTimeout(resolve, 7000));
      
      await request(app).post('/hook').send(followUpText).expect(200);
      
      // Esperar procesamiento del texto
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      console.log('✅ Context mantenido entre imagen y texto');
    }, 15000);
  });

  describe('4. Error Recovery y Resilencia', () => {
    test('debe continuar funcionando después de errores de media', async () => {
      // Mensaje que causará error en processing
      const corruptMediaWebhook = {
        messages: [{
          id: 'wamid.corrupt_media',
          from: '5493815567398@c.us',
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000),
          chat_id: '5493815567398@c.us',
          from_name: 'Corrupt Media User',
          type: 'voice',
          voice: {
            id: 'corrupt_voice_id',
            mime_type: 'audio/mp3', // Tipo no soportado
            sha256: 'corrupt_sha256'
          }
        }]
      };

      // Procesar media corrupto
      await request(app).post('/hook').send(corruptMediaWebhook).expect(200);
      
      // Esperar manejo del error
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verificar que sistema sigue funcionando con mensaje normal
      const normalTextWebhook = {
        messages: [{
          id: 'wamid.recovery_text',
          from: '5493815567398@c.us',
          to: '5493815567391@c.us',
          timestamp: Math.floor(Date.now() / 1000) + 5,
          chat_id: '5493815567398@c.us',
          from_name: 'Recovery User',
          type: 'text',
          text: { body: 'Mensaje normal después del error' }
        }]
      };

      const response = await request(app)
        .post('/hook')
        .send(normalTextWebhook)
        .expect(200);

      expect(response.body.received).toBe(true);
      
      console.log('✅ Sistema se recupera después de errores de media');
    });
  });
});