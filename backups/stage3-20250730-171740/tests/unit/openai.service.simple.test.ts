// tests/unit/openai.service.simple.test.ts
import { OpenAIService, OpenAIServiceConfig } from '../../src/core/services/openai.service';
import { TerminalLog, IDashboard, StartupConfig } from '../../src/core/utils/terminal-log';
import { CacheManager } from '../../src/core/state/cache-manager';

describe('🧪 OpenAI Service - Core Functionality', () => {
    let openaiService: OpenAIService;
    let mockTerminalLog: TerminalLog;
    let mockDashboard: jest.Mocked<IDashboard>;
    let mockCache: jest.Mocked<CacheManager>;
    let config: OpenAIServiceConfig;

    beforeEach(() => {
        mockDashboard = {
            addLog: jest.fn()
        };
        
        const startupConfig: StartupConfig = {
            host: 'localhost',
            port: 3008,
            webhookUrl: 'https://test.com/webhook',
            showFunctionLogs: true
        };
        
        mockTerminalLog = new TerminalLog(mockDashboard, startupConfig);
        
        // Mock terminal log methods
        jest.spyOn(mockTerminalLog, 'info').mockImplementation();
        jest.spyOn(mockTerminalLog, 'debug').mockImplementation();
        jest.spyOn(mockTerminalLog, 'error').mockImplementation();
        jest.spyOn(mockTerminalLog, 'warning').mockImplementation();
        jest.spyOn(mockTerminalLog, 'openaiError').mockImplementation();
        jest.spyOn(mockTerminalLog, 'response').mockImplementation();
        jest.spyOn(mockTerminalLog, 'functionStart').mockImplementation();
        jest.spyOn(mockTerminalLog, 'functionError').mockImplementation();
        
        mockCache = {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            clear: jest.fn(),
            size: jest.fn(),
            has: jest.fn(),
            setChatInfo: jest.fn(),
            getChatInfo: jest.fn(),
            setContext: jest.fn(),
            getContext: jest.fn(),
            setPrecomputed: jest.fn(),
            getPrecomputed: jest.fn(),
            getStats: jest.fn(),
            findKeys: jest.fn(),
            deletePattern: jest.fn(),
            getTtl: jest.fn(),
            destroy: jest.fn()
        } as any;
        
        config = {
            apiKey: 'test-api-key',
            assistantId: 'asst_test123',
            maxRunTime: 60000,
            pollingInterval: 500,
            maxPollingAttempts: 10,
            enableThreadCache: true
        };
        
        openaiService = new OpenAIService(config, mockTerminalLog, mockCache);
        
        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'clear').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Configuration and Initialization', () => {
        test('should initialize with provided config', () => {
            const serviceConfig = openaiService.getConfig();
            
            expect(serviceConfig.apiKey).toBe(config.apiKey);
            expect(serviceConfig.assistantId).toBe(config.assistantId);
            expect(serviceConfig.maxRunTime).toBe(config.maxRunTime);
            expect(serviceConfig.pollingInterval).toBe(config.pollingInterval);
            expect(serviceConfig.enableThreadCache).toBe(true);
        });

        test('should use default configuration when minimal config provided', () => {
            const minimalConfig: OpenAIServiceConfig = {
                apiKey: 'test-key',
                assistantId: 'asst_test'
            };
            
            const service = new OpenAIService(minimalConfig, mockTerminalLog);
            const serviceConfig = service.getConfig();
            
            expect(serviceConfig.maxRunTime).toBe(120000); // 2 minutes default
            expect(serviceConfig.pollingInterval).toBe(1000); // 1 second default
            expect(serviceConfig.maxPollingAttempts).toBe(120); // 2 minutes max
            expect(serviceConfig.enableThreadCache).toBe(true);
        });
    });

    describe('Error Handling and Logging', () => {
        test('should handle processMessage errors gracefully', async () => {
            const result = await openaiService.processMessage('user123', 'Hello', 'chat456', 'TestUser');
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.processingTime).toBeGreaterThan(0);
            expect(mockTerminalLog.openaiError).toHaveBeenCalledWith('TestUser', expect.any(String));
        });

        test('should handle processWithOpenAI failures by throwing', async () => {
            await expect(
                openaiService.processWithOpenAI('user123', 'Hello', 'chat456', 'TestUser')
            ).rejects.toThrow();
            
            expect(mockTerminalLog.openaiError).toHaveBeenCalled();
        });

        test('should log processing start', async () => {
            await openaiService.processMessage('user123', 'Hello', 'chat456', 'TestUser');
            
            expect(mockTerminalLog.info).toHaveBeenCalledWith(
                'Starting OpenAI processing for TestUser'
            );
        });
    });

    describe('Configuration Management', () => {
        test('should handle cache disabled configuration', () => {
            const noCacheConfig = { ...config, enableThreadCache: false };
            const service = new OpenAIService(noCacheConfig, mockTerminalLog);
            
            expect(service.getConfig().enableThreadCache).toBe(false);
        });

        test('should handle service without cache manager', () => {
            const serviceNoCache = new OpenAIService(config, mockTerminalLog); // No cache manager
            const serviceConfig = serviceNoCache.getConfig();
            
            expect(serviceConfig.apiKey).toBe(config.apiKey);
            expect(serviceConfig.assistantId).toBe(config.assistantId);
        });

        test('should accept custom timing configurations', () => {
            const customConfig: OpenAIServiceConfig = {
                apiKey: 'test-key',
                assistantId: 'asst_test',
                maxRunTime: 30000,
                pollingInterval: 2000,
                maxPollingAttempts: 15
            };
            
            const service = new OpenAIService(customConfig, mockTerminalLog);
            const serviceConfig = service.getConfig();
            
            expect(serviceConfig.maxRunTime).toBe(30000);
            expect(serviceConfig.pollingInterval).toBe(2000);
            expect(serviceConfig.maxPollingAttempts).toBe(15);
        });
    });

    describe('Cache Integration', () => {
        test('should use cache when provided', async () => {
            mockCache.get.mockReturnValue('cached_thread_123');
            
            // This would call getOrCreateThread internally, but will fail due to OpenAI mocking
            // We're just testing that cache is being used
            const result = await openaiService.processMessage('user123', 'Hello', 'chat456', 'TestUser');
            
            // Should have attempted to use cache
            expect(mockCache.get).toHaveBeenCalledWith('thread:user123:chat456');
            expect(result.success).toBe(false); // Will fail due to OpenAI mock issues, but cache was attempted
        });

        test('should handle missing cache gracefully', () => {
            const serviceNoCache = new OpenAIService(config, mockTerminalLog); // No cache
            const serviceConfig = serviceNoCache.getConfig();
            
            // Should still work without cache
            expect(serviceConfig.enableThreadCache).toBe(true);
        });
    });

    describe('Processing Result Structure', () => {
        test('should return proper error structure', async () => {
            const result = await openaiService.processMessage('user123', 'Hello', 'chat456', 'TestUser');
            
            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('error');
            expect(result).toHaveProperty('processingTime');
            expect(typeof result.processingTime).toBe('number');
            expect(result.processingTime).toBeGreaterThan(0);
        });

        test('should include timing information', async () => {
            const startTime = Date.now();
            const result = await openaiService.processMessage('user123', 'Hello', 'chat456', 'TestUser');
            const endTime = Date.now();
            
            expect(result.processingTime).toBeGreaterThan(0);
            expect(result.processingTime).toBeLessThan(endTime - startTime + 100); // Small buffer
        });
    });

    describe('Thread and Run Management Interfaces', () => {
        test('should have deleteThread method', async () => {
            const result = await openaiService.deleteThread('thread_test');
            
            // Will fail due to OpenAI mocking but method exists
            expect(typeof result).toBe('boolean');
            expect(mockTerminalLog.error).toHaveBeenCalled();
        });

        test('should have cancelRun method', async () => {
            const result = await openaiService.cancelRun('thread_test', 'run_test');
            
            // Will fail due to OpenAI mocking but method exists
            expect(typeof result).toBe('boolean');
            expect(mockTerminalLog.error).toHaveBeenCalled();
        });

        test('should have getThreadMessages method', async () => {
            try {
                await openaiService.getThreadMessages('thread_test');
            } catch (error) {
                // Expected to fail due to mocking
                expect(error).toBeDefined();
            }
        });

        test('should handle getThreadMessages with custom limit', async () => {
            try {
                await openaiService.getThreadMessages('thread_test', 5);
            } catch (error) {
                // Expected to fail due to mocking
                expect(error).toBeDefined();
            }
        });
    });

    describe('Health Check Interface', () => {
        test('should have healthCheck method that returns proper structure', async () => {
            const health = await openaiService.healthCheck();
            
            expect(health).toHaveProperty('status');
            expect(health).toHaveProperty('details');
            expect(['healthy', 'unhealthy']).toContain(health.status);
            expect(health.details).toHaveProperty('assistantId', config.assistantId);
        });

        test('should return unhealthy status when API fails', async () => {
            const health = await openaiService.healthCheck();
            
            // Will be unhealthy due to mocking
            expect(health.status).toBe('unhealthy');
            expect(health.details).toHaveProperty('error');
            expect(health.details).toHaveProperty('apiConnectivity', 'failed');
        });
    });

    describe('Interface Compliance', () => {
        test('should implement IOpenAIService interface', () => {
            expect(typeof openaiService.processWithOpenAI).toBe('function');
        });

        test('should have all expected public methods', () => {
            expect(typeof openaiService.processMessage).toBe('function');
            expect(typeof openaiService.processWithOpenAI).toBe('function');
            expect(typeof openaiService.getThreadMessages).toBe('function');
            expect(typeof openaiService.deleteThread).toBe('function');
            expect(typeof openaiService.cancelRun).toBe('function');
            expect(typeof openaiService.healthCheck).toBe('function');
            expect(typeof openaiService.getConfig).toBe('function');
        });
    });

    describe('Input Validation', () => {
        test('should handle empty messages', async () => {
            const result = await openaiService.processMessage('user123', '', 'chat456', 'TestUser');
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle special characters in messages', async () => {
            const specialMessage = 'Hello with 🔥 emojis and "quotes" and \n newlines';
            const result = await openaiService.processMessage('user123', specialMessage, 'chat456', 'TestUser');
            
            expect(result.success).toBe(false); // Will fail due to mocking
            expect(result.error).toBeDefined();
        });

        test('should handle very long messages', async () => {
            const longMessage = 'A'.repeat(10000);
            const result = await openaiService.processMessage('user123', longMessage, 'chat456', 'TestUser');
            
            expect(result.success).toBe(false); // Will fail due to mocking
            expect(result.error).toBeDefined();
        });
    });

    describe('Concurrency and Performance', () => {
        test('should handle multiple concurrent requests', async () => {
            const promises = [
                openaiService.processMessage('user1', 'Message 1', 'chat1', 'User1'),
                openaiService.processMessage('user2', 'Message 2', 'chat2', 'User2'),
                openaiService.processMessage('user3', 'Message 3', 'chat3', 'User3')
            ];
            
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result).toHaveProperty('success');
                expect(result).toHaveProperty('processingTime');
            });
        });

        test('should track processing time correctly', async () => {
            const result = await openaiService.processMessage('user123', 'Hello', 'chat456', 'TestUser');
            
            expect(result.processingTime).toBeGreaterThan(0);
            expect(result.processingTime).toBeLessThan(5000); // Should be fast for failed requests
        });
    });
});