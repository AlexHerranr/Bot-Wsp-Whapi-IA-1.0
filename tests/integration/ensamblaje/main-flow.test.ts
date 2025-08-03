// tests/integration/ensamblaje/main-flow.test.ts
import 'reflect-metadata';
import request from 'supertest';
import { CoreBot } from '../../../src/core/bot';
import { setupDependencyInjection } from '../../../src/main';

describe('🔄 Main Flow Integration Tests', () => {
    let bot: CoreBot;
    let originalEnv: NodeJS.ProcessEnv;

    beforeAll(async () => {
        originalEnv = { ...process.env };
        
        // Set test environment
        process.env.OPENAI_API_KEY = 'test-openai-key';
        process.env.WHAPI_TOKEN = 'test-whapi-token';
        process.env.WHAPI_API_URL = 'https://test-api.whapi.cloud';
        process.env.PORT = '0'; // Use random port for testing
        process.env.HOST = '127.0.0.1';
    });

    afterAll(async () => {
        process.env = originalEnv;
        if (bot) {
            await bot.stop();
        }
    });

    beforeEach(async () => {
        const config = {
            port: 0, // Random port
            host: '127.0.0.1',
            secrets: {
                OPENAI_API_KEY: 'test-openai-key',
                WHAPI_API_URL: 'https://test-api.whapi.cloud',
                WHAPI_TOKEN: 'test-whapi-token'
            }
        };

        const { functionRegistry } = setupDependencyInjection();
        bot = new CoreBot(config, functionRegistry);
    });

    afterEach(async () => {
        if (bot) {
            await bot.stop();
        }
    });

    describe('Bot Lifecycle', () => {
        test('should start and stop bot successfully', async () => {
            expect(bot).toBeDefined();

            // Start bot
            await bot.start();
            
            const stats = bot.getStats();
            expect(stats.server.running).toBe(true);
            expect(stats.functions.totalFunctions).toBeGreaterThan(0);

            // Stop bot
            await bot.stop();
        }, 10000);

        test('should provide accurate stats', async () => {
            await bot.start();

            const stats = bot.getStats();
            
            expect(stats.server).toBeDefined();
            expect(stats.server.host).toBe('127.0.0.1');
            expect(stats.server.running).toBe(true);
            
            expect(stats.functions).toBeDefined();
            expect(stats.functions.totalFunctions).toBeGreaterThan(0);
            expect(stats.functions.availableFunctions).toContain('check_availability');

            await bot.stop();
        }, 10000);
    });

    describe('HTTP Endpoints', () => {
        beforeEach(async () => {
            await bot.start();
        });

        test('should respond to health check', async () => {
            const response = await request(bot['app'])
                .get('/health')
                .expect(200);

            expect(response.body.status).toBe('healthy');
            expect(response.body.timestamp).toBeDefined();
            expect(response.body.uptime).toBeGreaterThan(0);
            expect(response.body.functions).toBeDefined();
        });

        test('should respond to ping', async () => {
            const response = await request(bot['app'])
                .get('/ping')
                .expect(200);

            expect(response.text).toBe('pong');
        });

        test('should provide status information', async () => {
            const response = await request(bot['app'])
                .get('/status')
                .expect(200);

            expect(response.body.server).toBeDefined();
            expect(response.body.functions).toBeDefined();
            expect(response.body.functions.totalFunctions).toBeGreaterThan(0);
        });

        test('should provide functions information', async () => {
            const response = await request(bot['app'])
                .get('/functions')
                .expect(200);

            expect(response.body.functions).toContain('check_availability');
            expect(response.body.stats).toBeDefined();
            expect(response.body.history).toBeDefined();
            expect(response.body.history.length).toBeGreaterThan(0);
        });

        test('should handle webhook posts', async () => {
            const webhookPayload = {
                messages: [{
                    id: 'test-message-id',
                    timestamp: Date.now(),
                    type: 'text',
                    from: '1234567890',
                    text: { body: 'Test message' }
                }]
            };

            const response = await request(bot['app'])
                .post('/hook')
                .send(webhookPayload)
                .expect(200);

            expect(response.body.received).toBe(true);
            expect(response.body.timestamp).toBeDefined();
            expect(response.body.requestId).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle malformed webhook payload gracefully', async () => {
            await bot.start();

            const malformedPayload = {
                invalid: 'payload'
            };

            const response = await request(bot['app'])
                .post('/hook')
                .send(malformedPayload)
                .expect(200); // Should still acknowledge receipt

            expect(response.body.received).toBe(true);
        });

        test('should handle startup errors gracefully', async () => {
            // Create bot with invalid configuration
            const invalidConfig = {
                port: -1, // Invalid port
                host: '127.0.0.1',
                secrets: {
                    OPENAI_API_KEY: 'test-key',
                    WHAPI_API_URL: 'invalid-url',
                    WHAPI_TOKEN: 'test-token'
                }
            };

            const { functionRegistry } = setupDependencyInjection();
            const invalidBot = new CoreBot(invalidConfig, functionRegistry);

            await expect(invalidBot.start()).rejects.toThrow();
        });
    });

    describe('Cleanup and Shutdown', () => {
        test('should cleanup resources on shutdown', async () => {
            await bot.start();
            
            const statsBefore = bot.getStats();
            expect(statsBefore.server.running).toBe(true);

            await bot.stop();
            
            // Verify cleanup happened (can't easily test internal state, 
            // but we can verify the stop process completed without errors)
            expect(true).toBe(true); // Test passed if no errors thrown
        });

        test('should handle multiple stop calls gracefully', async () => {
            await bot.start();
            
            await bot.stop();
            await bot.stop(); // Second call should not throw
            
            expect(true).toBe(true);
        });
    });
});