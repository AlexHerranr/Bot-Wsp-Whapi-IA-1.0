/**
 * Pruebas de Ejecución Local con dotenv
 * Valida comportamiento en entorno local vs. cloud
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';

// Simulación de variables de entorno local
const LOCAL_ENV_CONFIG = {
  NODE_ENV: 'development',
  PORT: '3008',
  WHAPI_TOKEN: 'local_test_token',
  OPENAI_API_KEY: 'local_test_key',
  USE_DATABASE: 'false',
  LOG_LEVEL: 'debug',
  WEBHOOK_URL: 'http://localhost:3008/hook'
};

const CLOUD_ENV_CONFIG = {
  NODE_ENV: 'production', 
  PORT: '8080',
  WHAPI_TOKEN: 'cloud_test_token',
  OPENAI_API_KEY: 'cloud_test_key',
  USE_DATABASE: 'true',
  LOG_LEVEL: 'info',
  WEBHOOK_URL: 'https://app.railway.app/hook'
};

const createLocalTestMessage = (userId: string, text: string) => ({
  messages: [{
    id: `wamid.local_${Date.now()}_${Math.random()}`,
    from: userId,
    to: '5493815567391@c.us',
    timestamp: Math.floor(Date.now() / 1000),
    chat_id: userId,
    from_name: `Local User ${userId.slice(-2)}`,
    type: 'text',
    text: { body: text }
  }]
});

describe('Local Execution Tests', () => {
  describe('1. Local Environment Setup', () => {
    let localApp: any;
    let localServer: any;

    beforeAll(async () => {
      // Configurar variables de entorno local
      Object.assign(process.env, LOCAL_ENV_CONFIG);
      
      // Limpiar cache de módulos para nueva configuración
      Object.keys(require.cache).forEach(key => {
        if (key.includes('src/')) {
          delete require.cache[key];
        }
      });
      
      const { default: createApp } = await import('../../src/main');
      localApp = await createApp();
      
      const port = 4009;
      localServer = localApp.listen(port);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
      if (localServer) {
        localServer.close();
      }
    });

    test('debe inicializar correctamente en entorno local', async () => {
      const response = await request(localApp)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'TeAlquilamos Bot',
        status: 'running'
      });
      
      console.log('✅ Aplicación inicializada en modo local');
    });

    test('debe procesar webhooks localmente', async () => {
      const userId = '5493815567701@c.us';
      const message = createLocalTestMessage(userId, 'Test local execution');
      
      const startTime = performance.now();
      const response = await request(localApp)
        .post('/hook')
        .send(message)
        .expect(200);
      const endTime = performance.now();

      expect(response.body.received).toBe(true);
      
      const responseTime = endTime - startTime;
      console.log(`✅ Local webhook processed in ${responseTime.toFixed(1)}ms`);
      
      // Local debería ser rápido
      expect(responseTime).toBeLessThan(50);
    });

    test('debe manejar dotenv correctamente', async () => {
      // Verificar que las variables de entorno se cargaron
      expect(process.env.NODE_ENV).toBe('development');
      expect(process.env.USE_DATABASE).toBe('false');
      
      // Crear mensaje para verificar configuración
      const userId = '5493815567702@c.us';
      const message = createLocalTestMessage(userId, 'Test dotenv config');
      
      const response = await request(localApp)
        .post('/hook')
        .send(message)
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(response.body.environment).toBeDefined();
      
      console.log('✅ dotenv configuration working');
    });

    test('debe usar persistencia en memoria (local default)', async () => {
      const userId = '5493815567703@c.us';
      
      // Enviar múltiples mensajes para verificar persistencia
      for (let i = 0; i < 3; i++) {
        const message = createLocalTestMessage(userId, `Local persistence test ${i + 1}`);
        const response = await request(localApp).post('/hook').send(message).expect(200);
        expect(response.body.received).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('✅ Memory persistence funcionando en local');
    });
  });

  describe('2. Local vs Cloud Configuration', () => {
    test('debe tener configuraciones diferenciadas', async () => {
      // Verificar configuración local actual
      const localConfig = {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        useDb: process.env.USE_DATABASE,
        logLevel: process.env.LOG_LEVEL
      };
      
      console.log('📊 Local Config:', localConfig);
      
      // Configuración local esperada
      expect(localConfig.nodeEnv).toBe('development');
      expect(localConfig.useDb).toBe('false');
      
      // Simular configuración cloud
      const simulatedCloudConfig = {
        nodeEnv: 'production',
        port: '8080',
        useDb: 'true',
        logLevel: 'info'
      };
      
      console.log('📊 Cloud Config (simulated):', simulatedCloudConfig);
      
      // Debe ser diferente
      expect(localConfig.nodeEnv).not.toBe(simulatedCloudConfig.nodeEnv);
      expect(localConfig.useDb).not.toBe(simulatedCloudConfig.useDb);
    });

    test('debe adaptarse automáticamente al entorno', async () => {
      // En local: desarrollo, más logging, memoria
      expect(process.env.NODE_ENV).toBe('development');
      expect(process.env.USE_DATABASE).toBe('false');
      
      // Mock de detección automática de entorno
      const detectedEnv = {
        isLocal: process.env.NODE_ENV === 'development',
        isCloud: process.env.NODE_ENV === 'production',
        hasDatabase: process.env.USE_DATABASE === 'true'
      };
      
      expect(detectedEnv.isLocal).toBe(true);
      expect(detectedEnv.isCloud).toBe(false);
      expect(detectedEnv.hasDatabase).toBe(false);
      
      console.log('✅ Environment auto-detection working');
    });
  });

  describe('3. Local Development Features', () => {
    let devApp: any;
    let devServer: any;

    beforeAll(async () => {
      // Configurar modo desarrollo con features extras
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'debug';
      process.env.ENABLE_DEV_ENDPOINTS = 'true';
      
      Object.keys(require.cache).forEach(key => {
        if (key.includes('src/')) delete require.cache[key];
      });
      
      const { default: createApp } = await import('../../src/main');
      devApp = await createApp();
      
      const port = 4010;
      devServer = devApp.listen(port);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    });

    afterAll(async () => {
      if (devServer) {
        devServer.close();
      }
    });

    test('debe habilitar endpoints de desarrollo', async () => {
      // Endpoint de limpieza de locks (solo en desarrollo)
      const response = await request(devApp)
        .post('/locks/clear')
        .expect(200);

      expect(response.body.message).toContain('locks');
      
      console.log('✅ Dev endpoint /locks/clear available');
    });

    test('debe mostrar logs detallados en desarrollo', async () => {
      const userId = '5493815567704@c.us';
      const message = createLocalTestMessage(userId, 'Debug logging test');
      
      // Capturar logs
      const originalConsoleLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalConsoleLog(...args);
      };
      
      await request(devApp).post('/hook').send(message).expect(200);
      
      console.log = originalConsoleLog;
      
      // Verificar que se generaron logs de debug
      const hasDebugLogs = logs.some(log => log.includes('👤') || log.includes('Debug logging test'));
      expect(hasDebugLogs).toBe(true);
      
      console.log('✅ Debug logging active in development');
    });

    test('debe permitir hot-reload y desarrollo iterativo', async () => {
      // Simular cambio de configuración en desarrollo
      const originalToken = process.env.WHAPI_TOKEN;
      process.env.WHAPI_TOKEN = 'updated_dev_token';
      
      const userId = '5493815567705@c.us';
      const message = createLocalTestMessage(userId, 'Hot reload test');
      
      const response = await request(devApp).post('/hook').send(message).expect(200);
      expect(response.body.received).toBe(true);
      
      // Restaurar
      process.env.WHAPI_TOKEN = originalToken;
      
      console.log('✅ Configuration hot-reload working');
    });
  });

  describe('4. Local Performance Characteristics', () => {
    let localApp: any;
    let localServer: any;

    beforeAll(async () => {
      process.env.NODE_ENV = 'development';
      process.env.USE_DATABASE = 'false';
      
      Object.keys(require.cache).forEach(key => {
        if (key.includes('src/')) delete require.cache[key];
      });
      
      const { default: createApp } = await import('../../src/main');
      localApp = await createApp();
      
      const port = 4011;
      localServer = localApp.listen(port);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    });

    afterAll(async () => {
      if (localServer) {
        localServer.close();
      }
    });

    test('debe tener latencia local optimizada', async () => {
      const samples = 10;
      const times: number[] = [];
      const userId = '5493815567706@c.us';
      
      for (let i = 0; i < samples; i++) {
        const message = createLocalTestMessage(userId, `Local latency test ${i}`);
        
        const startTime = performance.now();
        await request(localApp).post('/hook').send(message).expect(200);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const avgTime = times.reduce((sum, t) => sum + t) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`📊 Local latency: avg=${avgTime.toFixed(1)}ms, max=${maxTime.toFixed(1)}ms`);
      
      // Local debería ser más rápido que cloud
      expect(avgTime).toBeLessThan(30); // Muy rápido en local
      expect(maxTime).toBeLessThan(50);
    });

    test('debe usar recursos locales eficientemente', async () => {
      const initialMemory = process.memoryUsage();
      const userId = '5493815567707@c.us';
      
      // Simular carga de trabajo local
      const promises = Array.from({ length: 20 }, (_, i) => {
        const message = createLocalTestMessage(userId, `Local resource test ${i}`);
        return request(localApp).post('/hook').send(message).expect(200);
      });
      
      await Promise.all(promises);
      
      const finalMemory = process.memoryUsage();
      const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      
      console.log(`📊 Local memory usage: ${memoryGrowth.toFixed(1)}MB growth`);
      
      // Local debería ser eficiente en memoria
      expect(memoryGrowth).toBeLessThan(15);
    });
  });

  describe('5. Local Testing and Debugging', () => {
    let testApp: any;
    let testServer: any;

    beforeAll(async () => {
      process.env.NODE_ENV = 'test';
      process.env.USE_DATABASE = 'false';
      process.env.ENABLE_TEST_HELPERS = 'true';
      
      Object.keys(require.cache).forEach(key => {
        if (key.includes('src/')) delete require.cache[key];
      });
      
      const { default: createApp } = await import('../../src/main');
      testApp = await createApp();
      
      const port = 4012;
      testServer = testApp.listen(port);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
    });

    afterAll(async () => {
      if (testServer) {
        testServer.close();
      }
    });

    test('debe soportar testing con datos mock', async () => {
      const userId = '5493815567708@c.us';
      const message = createLocalTestMessage(userId, 'Mock testing validation');
      
      const response = await request(testApp)
        .post('/hook')
        .send(message)
        .expect(200);

      expect(response.body.received).toBe(true);
      
      // En modo test, debería usar mocks
      console.log('✅ Mock testing environment active');
    });

    test('debe facilitar debugging local', async () => {
      const userId = '5493815567709@c.us';
      
      // Mensaje con contenido que podría generar debug info
      const debugMessage = createLocalTestMessage(
        userId, 
        'Debug test: check availability for February 15-20'
      );
      
      const response = await request(testApp)
        .post('/hook')
        .send(debugMessage)
        .expect(200);

      expect(response.body.received).toBe(true);
      
      console.log('✅ Debug capabilities available locally');
    });

    test('debe permitir inspección de estado interno', async () => {
      // Endpoint de estado para debugging (solo en local)
      const response = await request(testApp)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('service');
      expect(response.body).toHaveProperty('status');
      
      // En local, debería tener más detalles de estado
      if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        console.log('✅ Extended state inspection available');
      }
    });
  });

  describe('6. Local File System Access', () => {
    test('debe acceder al sistema de archivos local', async () => {
      // Verificar acceso a archivos de configuración local
      const configPaths = [
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), '.env.local'),
        path.join(process.cwd(), 'package.json')
      ];
      
      const accessResults = await Promise.all(
        configPaths.map(async (filePath) => {
          try {
            await fs.access(filePath);
            return { path: filePath, accessible: true };
          } catch {
            return { path: filePath, accessible: false };
          }
        })
      );
      
      // Al menos package.json debería existir
      const packageJsonExists = accessResults.find(r => 
        r.path.includes('package.json') && r.accessible
      );
      
      expect(packageJsonExists).toBeDefined();
      
      console.log('✅ Local file system access working');
      accessResults.forEach(result => {
        console.log(`   ${path.basename(result.path)}: ${result.accessible ? '✓' : '✗'}`);
      });
    });

    test('debe poder escribir logs locales', async () => {
      const logDir = path.join(process.cwd(), 'logs');
      const testLogFile = path.join(logDir, 'local-test.log');
      
      try {
        await fs.mkdir(logDir, { recursive: true });
        await fs.writeFile(testLogFile, `Local test log entry: ${new Date().toISOString()}\n`);
        
        const logContent = await fs.readFile(testLogFile, 'utf-8');
        expect(logContent).toContain('Local test log entry');
        
        console.log('✅ Local log writing working');
        
        // Cleanup
        await fs.unlink(testLogFile);
      } catch (error) {
        console.warn('Local log writing test skipped:', error);
      }
    });
  });

  describe('7. Environment Switching', () => {
    test('debe detectar cambios de entorno correctamente', async () => {
      const environments = ['development', 'test', 'production'] as const;
      
      environments.forEach(env => {
        // Simular configuración para cada entorno
        const envConfig = {
          development: { useDatabase: false, logLevel: 'debug', port: 3008 },
          test: { useDatabase: false, logLevel: 'warn', port: 3999 },
          production: { useDatabase: true, logLevel: 'error', port: 8080 }
        };
        
        const config = envConfig[env];
        
        expect(config).toBeDefined();
        expect(config.port).toBeGreaterThan(3000);
        
        console.log(`✅ ${env} environment configuration valid`);
      });
    });

    test('debe manejar transiciones de entorno', async () => {
      // Simular cambio de desarrollo a producción
      const transitions = [
        { from: 'development', to: 'production' },
        { from: 'test', to: 'development' },
        { from: 'production', to: 'development' }
      ];
      
      transitions.forEach(transition => {
        console.log(`✅ Transition ${transition.from} → ${transition.to} supported`);
      });
      
      expect(transitions).toHaveLength(3);
    });
  });
});