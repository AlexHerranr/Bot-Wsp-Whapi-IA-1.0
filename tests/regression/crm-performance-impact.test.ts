// tests/regression/crm-performance-impact.test.ts
import 'reflect-metadata';
import { WebhookProcessor } from '../../src/core/api/webhook-processor';
import { BufferManager } from '../../src/core/state/buffer-manager';
import { UserManager } from '../../src/core/state/user-state-manager';
import { MediaManager } from '../../src/core/state/media-manager';
import { MediaService } from '../../src/core/services/media.service';
import { DatabaseService } from '../../src/core/services/database.service';
import { SimpleCRMService } from '../../src/core/services/simple-crm.service';
import { TerminalLog } from '../../src/core/utils/terminal-log';

// Mock all dependencies
jest.mock('../../src/core/state/buffer-manager');
jest.mock('../../src/core/state/user-state-manager');
jest.mock('../../src/core/state/media-manager');
jest.mock('../../src/core/services/media.service');
jest.mock('../../src/core/services/database.service');
jest.mock('../../src/core/services/simple-crm.service');
jest.mock('../../src/core/utils/terminal-log');

// Mock container
jest.mock('tsyringe', () => ({
    container: {
        resolve: jest.fn()
    }
}));

const { container } = require('tsyringe');

describe('CRM Performance Impact Validation', () => {
    let webhookProcessor: WebhookProcessor;
    let mockBufferManager: jest.Mocked<BufferManager>;
    let mockUserManager: jest.Mocked<UserManager>;
    let mockMediaManager: jest.Mocked<MediaManager>;
    let mockMediaService: jest.Mocked<MediaService>;
    let mockDatabaseService: jest.Mocked<DatabaseService>;
    let mockCRMService: jest.Mocked<SimpleCRMService>;
    let mockTerminalLog: jest.Mocked<TerminalLog>;

    const standardMessage = {
        messages: [{
            id: 'msg_performance_test',
            type: 'text',
            body: 'Test message for performance',
            from: '573001234567',
            chatId: '573001234567@c.us',
            timestamp: Date.now(),
            fromMe: false
        }]
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset environment variables
        delete process.env.CRM_ANALYSIS_ENABLED;
        delete process.env.CRM_MODE;

        // Setup mocks
        mockBufferManager = {
            processMessage: jest.fn().mockResolvedValue(undefined),
            setIntelligentTimer: jest.fn(),
            clearIntelligentTimer: jest.fn()
        } as any;

        mockUserManager = {
            getUser: jest.fn().mockReturnValue({
                userId: 'test-user',
                userName: 'Test User',
                isTyping: false,
                lastInputVoice: false
            }),
            extractPhoneNumber: jest.fn().mockReturnValue('573001234567')
        } as any;

        mockMediaManager = {
            processMessage: jest.fn().mockResolvedValue(undefined)
        } as any;

        mockMediaService = {} as any;
        mockDatabaseService = {} as any;
        
        mockCRMService = {
            analyzeAndUpdate: jest.fn().mockResolvedValue(undefined)
        } as any;

        mockTerminalLog = {
            typing: jest.fn(),
            info: jest.fn(),
            warning: jest.fn(),
            error: jest.fn()
        } as any;

        // Setup container mock
        container.resolve.mockImplementation((token: any) => {
            if (token === SimpleCRMService) return mockCRMService;
            return {};
        });

        webhookProcessor = new WebhookProcessor(
            mockBufferManager,
            mockUserManager,
            mockMediaManager,
            mockMediaService,
            mockDatabaseService,
            mockTerminalLog
        );
    });

    describe('Performance Impact Assessment', () => {
        test('should process messages within 50ms when CRM is disabled', async () => {
            // Ensure CRM is disabled
            process.env.CRM_ANALYSIS_ENABLED = 'false';

            const startTime = Date.now();
            await webhookProcessor.process(standardMessage);
            const processingTime = Date.now() - startTime;

            expect(processingTime).toBeLessThan(50);
            expect(mockCRMService.analyzeAndUpdate).not.toHaveBeenCalled();
        });

        test('should process messages within 50ms when CRM is enabled but non-blocking', async () => {
            // Enable CRM in non-blocking mode
            process.env.CRM_ANALYSIS_ENABLED = 'true';
            process.env.CRM_MODE = 'internal';

            // Mock CRM to take some time but not block
            mockCRMService.analyzeAndUpdate.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
            );

            const startTime = Date.now();
            await webhookProcessor.process(standardMessage);
            const processingTime = Date.now() - startTime;

            // Should complete quickly because CRM runs in background
            expect(processingTime).toBeLessThan(50);
            
            // CRM should be called asynchronously (fire and forget)
            expect(mockCRMService.analyzeAndUpdate).toHaveBeenCalledWith('573001234567');
        });

        test('should handle CRM errors without affecting main processing time', async () => {
            process.env.CRM_ANALYSIS_ENABLED = 'true';
            process.env.CRM_MODE = 'internal';

            // Mock CRM to throw error
            mockCRMService.analyzeAndUpdate.mockRejectedValue(new Error('CRM API down'));

            const startTime = Date.now();
            await webhookProcessor.process(standardMessage);
            const processingTime = Date.now() - startTime;

            // Should still be fast despite CRM error
            expect(processingTime).toBeLessThan(50);
            expect(mockCRMService.analyzeAndUpdate).toHaveBeenCalled();
        });

        test('should maintain performance under multiple concurrent messages', async () => {
            process.env.CRM_ANALYSIS_ENABLED = 'true';
            process.env.CRM_MODE = 'internal';

            // Mock CRM with variable delays
            mockCRMService.analyzeAndUpdate.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, Math.random() * 300))
            );

            const messages = Array.from({ length: 10 }, (_, i) => ({
                messages: [{
                    id: `msg_concurrent_${i}`,
                    type: 'text',
                    body: `Concurrent test message ${i}`,
                    from: `57300123456${i}`,
                    chatId: `57300123456${i}@c.us`,
                    timestamp: Date.now(),
                    fromMe: false
                }]
            }));

            const startTime = Date.now();
            
            // Process all messages concurrently
            const promises = messages.map(msg => webhookProcessor.process(msg));
            await Promise.all(promises);
            
            const totalTime = Date.now() - startTime;
            const averageTime = totalTime / messages.length;

            // Average processing time should still be under 50ms per message
            expect(averageTime).toBeLessThan(50);
            expect(mockCRMService.analyzeAndUpdate).toHaveBeenCalledTimes(10);
        });

        test('should validate CRM runs independently of main flow', async () => {
            process.env.CRM_ANALYSIS_ENABLED = 'true';
            process.env.CRM_MODE = 'internal';

            let crmStarted = false;
            let crmCompleted = false;

            mockCRMService.analyzeAndUpdate.mockImplementation(async () => {
                crmStarted = true;
                await new Promise(resolve => setTimeout(resolve, 100));
                crmCompleted = true;
            });

            const startTime = Date.now();
            await webhookProcessor.process(standardMessage);
            const mainProcessingTime = Date.now() - startTime;

            // Main processing should complete quickly
            expect(mainProcessingTime).toBeLessThan(50);
            
            // CRM should have started but may not be completed yet
            expect(crmStarted).toBe(true);
            
            // Wait a bit more to let CRM complete
            await new Promise(resolve => setTimeout(resolve, 150));
            expect(crmCompleted).toBe(true);
        });

        test('should handle different CRM modes efficiently', async () => {
            const modes = ['internal', 'n8n'];
            
            for (const mode of modes) {
                jest.clearAllMocks();
                
                process.env.CRM_ANALYSIS_ENABLED = 'true';
                process.env.CRM_MODE = mode;

                const startTime = Date.now();
                await webhookProcessor.process(standardMessage);
                const processingTime = Date.now() - startTime;

                expect(processingTime).toBeLessThan(50);
                
                if (mode === 'internal') {
                    expect(mockCRMService.analyzeAndUpdate).toHaveBeenCalled();
                } else {
                    // n8n mode might use different integration
                    expect(processingTime).toBeLessThan(50);
                }
            }
        });
    });

    describe('Performance Benchmarking', () => {
        test('should establish baseline performance without CRM', async () => {
            process.env.CRM_ANALYSIS_ENABLED = 'false';

            const iterations = 100;
            const times: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                await webhookProcessor.process(standardMessage);
                times.push(Date.now() - startTime);
            }

            const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);
            const p95Time = times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

            // Performance assertions
            expect(averageTime).toBeLessThan(20); // Should be very fast without CRM
            expect(maxTime).toBeLessThan(50); // Even max should be under target
            expect(p95Time).toBeLessThan(30); // 95% should be well under target

            console.log(`Baseline Performance (no CRM):
                Average: ${averageTime.toFixed(2)}ms
                Max: ${maxTime}ms
                P95: ${p95Time}ms`);
        });

        test('should measure performance impact with CRM enabled', async () => {
            process.env.CRM_ANALYSIS_ENABLED = 'true';
            process.env.CRM_MODE = 'internal';

            // Mock CRM with realistic delay
            mockCRMService.analyzeAndUpdate.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 50))
            );

            const iterations = 100;
            const times: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                await webhookProcessor.process(standardMessage);
                times.push(Date.now() - startTime);
            }

            const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);
            const p95Time = times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];

            // Performance should still meet targets
            expect(averageTime).toBeLessThan(50);
            expect(maxTime).toBeLessThan(100); // Allow some overhead for async setup
            expect(p95Time).toBeLessThan(50);

            console.log(`Performance with CRM enabled:
                Average: ${averageTime.toFixed(2)}ms
                Max: ${maxTime}ms
                P95: ${p95Time}ms`);
        });
    });

    describe('Resource Usage Validation', () => {
        test('should not create memory leaks with CRM enabled', async () => {
            process.env.CRM_ANALYSIS_ENABLED = 'true';
            process.env.CRM_MODE = 'internal';

            const initialMemory = process.memoryUsage().heapUsed;

            // Process many messages
            for (let i = 0; i < 1000; i++) {
                await webhookProcessor.process({
                    messages: [{
                        id: `msg_memory_test_${i}`,
                        type: 'text',
                        body: `Memory test ${i}`,
                        from: `573001234${i % 100}`,
                        chatId: `573001234${i % 100}@c.us`,
                        timestamp: Date.now(),
                        fromMe: false
                    }]
                });
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Memory increase should be reasonable (less than 10MB)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });

        test('should handle high concurrent load with CRM', async () => {
            process.env.CRM_ANALYSIS_ENABLED = 'true';
            process.env.CRM_MODE = 'internal';

            mockCRMService.analyzeAndUpdate.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 20))
            );

            const concurrentMessages = 50;
            const messages = Array.from({ length: concurrentMessages }, (_, i) => ({
                messages: [{
                    id: `msg_load_test_${i}`,
                    type: 'text',
                    body: `Load test message ${i}`,
                    from: `57312345${String(i).padStart(3, '0')}`,
                    chatId: `57312345${String(i).padStart(3, '0')}@c.us`,
                    timestamp: Date.now(),
                    fromMe: false
                }]
            }));

            const startTime = Date.now();
            
            // Process all messages concurrently
            const promises = messages.map(msg => webhookProcessor.process(msg));
            await Promise.all(promises);
            
            const totalTime = Date.now() - startTime;
            const averageTime = totalTime / concurrentMessages;

            // Should handle concurrent load efficiently
            expect(averageTime).toBeLessThan(100); // Relaxed target for high concurrency
            expect(totalTime).toBeLessThan(3000); // Total should complete within 3 seconds
        });
    });
});