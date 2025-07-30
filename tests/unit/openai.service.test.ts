// tests/unit/openai.service.test.ts
import { OpenAIService, OpenAIServiceConfig } from '../../src/core/services/openai.service';
import { TerminalLog, IDashboard, StartupConfig } from '../../src/core/utils/terminal-log';
import { CacheManager } from '../../src/core/state/cache-manager';
import { FunctionCall } from '../../src/shared/types';

// Mock OpenAI
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        beta: {
            threads: {
                create: jest.fn(),
                del: jest.fn(),
                messages: {
                    create: jest.fn(),
                    list: jest.fn()
                },
                runs: {
                    create: jest.fn(),
                    retrieve: jest.fn(),
                    cancel: jest.fn(),
                    submitToolOutputs: jest.fn()
                }
            },
            assistants: {
                retrieve: jest.fn()
            }
        },
        models: {
            list: jest.fn()
        }
    }));
});

const mockOpenAI = {
    beta: {
        threads: {
            create: jest.fn(),
            del: jest.fn(),
            messages: {
                create: jest.fn(),
                list: jest.fn()
            },
            runs: {
                create: jest.fn(),
                retrieve: jest.fn(),
                cancel: jest.fn(),
                submitToolOutputs: jest.fn()
            }
        },
        assistants: {
            retrieve: jest.fn()
        }
    },
    models: {
        list: jest.fn()
    }
};

// Mock retry utils
jest.mock('../../src/core/utils/retry-utils', () => ({
    openAIWithRetry: jest.fn().mockImplementation((fn) => fn()),
    withTimeout: jest.fn().mockImplementation((fn) => fn())
}));

import { openAIWithRetry } from '../../src/core/utils/retry-utils';

describe('🧪 OpenAI Service', () => {
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
        
        // Reset mocks
        jest.clearAllMocks();
        (openAIWithRetry as jest.Mock).mockImplementation((fn) => fn());
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

    describe('Thread Management', () => {
        test('should create new thread when not cached', async () => {
            const mockThread = { id: 'thread_test123' };
            mockOpenAI.beta.threads.create.mockResolvedValue(mockThread);
            mockCache.get.mockReturnValue(undefined);
            
            const threadId = await (openaiService as any).getOrCreateThread('user123', 'chat456');
            
            expect(mockOpenAI.beta.threads.create).toHaveBeenCalled();
            expect(mockCache.set).toHaveBeenCalledWith('thread:user123:chat456', 'thread_test123', 3600000);
            expect(threadId).toBe('thread_test123');
        });

        test('should use cached thread when available', async () => {
            mockCache.get.mockReturnValue('thread_cached123');
            
            const threadId = await (openaiService as any).getOrCreateThread('user123', 'chat456');
            
            expect(mockOpenAI.beta.threads.create).not.toHaveBeenCalled();
            expect(threadId).toBe('thread_cached123');
        });

        test('should add message to thread', async () => {
            mockOpenAI.beta.threads.messages.create.mockResolvedValue({ id: 'msg_test' });
            
            await (openaiService as any).addMessageToThread('thread_test', 'Hello world');
            
            expect(mockOpenAI.beta.threads.messages.create).toHaveBeenCalledWith('thread_test', {
                role: 'user',
                content: 'Hello world'
            });
        });

        test('should delete thread successfully', async () => {
            mockOpenAI.beta.threads.del.mockResolvedValue({ deleted: true });
            
            const result = await openaiService.deleteThread('thread_test');
            
            expect(result).toBe(true);
            expect(mockOpenAI.beta.threads.del).toHaveBeenCalledWith('thread_test');
        });

        test('should handle thread deletion errors gracefully', async () => {
            mockOpenAI.beta.threads.del.mockRejectedValue(new Error('Not found'));
            
            const result = await openaiService.deleteThread('thread_test');
            
            expect(result).toBe(false);
            expect(mockTerminalLog.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to delete thread')
            );
        });
    });

    describe('Run Management', () => {
        test('should create run successfully', async () => {
            const mockRun = { id: 'run_test123', status: 'queued' };
            mockOpenAI.beta.threads.runs.create.mockResolvedValue(mockRun);
            
            // Mock successful run completion
            mockOpenAI.beta.threads.runs.retrieve
                .mockResolvedValueOnce({ id: 'run_test123', status: 'completed', usage: { total_tokens: 150 } });
            
            const result = await (openaiService as any).createAndMonitorRun('thread_test', 'TestUser');
            
            expect(result.success).toBe(true);
            expect(result.runId).toBe('run_test123');
            expect(result.tokensUsed).toBe(150);
        });

        test('should handle run creation failure', async () => {
            mockOpenAI.beta.threads.runs.create.mockRejectedValue(new Error('API Error'));
            
            const result = await (openaiService as any).createAndMonitorRun('thread_test', 'TestUser');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('API Error');
        });

        test('should cancel run successfully', async () => {
            mockOpenAI.beta.threads.runs.cancel.mockResolvedValue({ status: 'cancelled' });
            
            const result = await openaiService.cancelRun('thread_test', 'run_test');
            
            expect(result).toBe(true);
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith('thread_test', 'run_test');
        });
    });

    describe('Run Polling and Status Monitoring', () => {
        test('should handle completed run', async () => {
            mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
                id: 'run_test',
                status: 'completed',
                usage: { total_tokens: 200 }
            });
            
            const result = await (openaiService as any).pollRunStatus('thread_test', 'run_test', 'TestUser');
            
            expect(result.success).toBe(true);
            expect(result.tokensUsed).toBe(200);
        });

        test('should handle failed run', async () => {
            mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
                id: 'run_test',
                status: 'failed',
                last_error: { message: 'Rate limit exceeded' }
            });
            
            const result = await (openaiService as any).pollRunStatus('thread_test', 'run_test', 'TestUser');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('failed: Rate limit exceeded');
        });

        test('should handle run requiring action', async () => {
            mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
                id: 'run_test',
                status: 'requires_action',
                required_action: {
                    type: 'submit_tool_outputs',
                    submit_tool_outputs: {
                        tool_calls: [{
                            id: 'call_test',
                            function: {
                                name: 'check_availability',
                                arguments: '{"startDate": "2025-01-15", "endDate": "2025-01-20"}'
                            }
                        }]
                    }
                }
            });
            
            const result = await (openaiService as any).pollRunStatus('thread_test', 'run_test', 'TestUser');
            
            expect(result.success).toBe(true);
            expect(result.functionCalls).toHaveLength(1);
            expect(result.functionCalls![0].function.name).toBe('check_availability');
        });

        test('should handle polling timeout', async () => {
            // Create service with very low polling attempts for testing
            const shortConfig = { ...config, maxPollingAttempts: 2, pollingInterval: 10 };
            const shortService = new OpenAIService(shortConfig, mockTerminalLog, mockCache);
            
            mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
                id: 'run_test',
                status: 'in_progress'
            });
            
            const result = await (shortService as any).pollRunStatus('thread_test', 'run_test', 'TestUser');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('timed out after 2 attempts');
        });
    });

    describe('Function Call Handling', () => {
        test('should handle function calls successfully', async () => {
            const functionCalls: FunctionCall[] = [{
                id: 'call_test',
                function: {
                    name: 'test_function',
                    arguments: '{"param": "value"}'
                }
            }];
            
            mockOpenAI.beta.threads.runs.submitToolOutputs.mockResolvedValue({ id: 'run_test' });
            
            // Mock continued polling after function submission
            mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
                id: 'run_test',
                status: 'completed',
                usage: { total_tokens: 100 }
            });
            
            const result = await (openaiService as any).handleFunctionCalls(
                'thread_test', 
                'run_test', 
                functionCalls,
                'TestUser'
            );
            
            expect(result.success).toBe(true);
            expect(mockTerminalLog.functionStart).toHaveBeenCalledWith('test_function', { param: 'value' });
            expect(mockOpenAI.beta.threads.runs.submitToolOutputs).toHaveBeenCalled();
        });

        test('should handle function execution errors', async () => {
            const functionCalls: FunctionCall[] = [{
                id: 'call_test',
                function: {
                    name: 'failing_function',
                    arguments: '{"param": "value"}'
                }
            }];
            
            // Mock function execution to simulate error handling
            jest.spyOn(openaiService as any, 'executeFunctionCall')
                .mockRejectedValue(new Error('Function failed'));
            
            mockOpenAI.beta.threads.runs.submitToolOutputs.mockResolvedValue({ id: 'run_test' });
            mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
                id: 'run_test',
                status: 'completed'
            });
            
            const result = await (openaiService as any).handleFunctionCalls(
                'thread_test', 
                'run_test', 
                functionCalls,
                'TestUser'
            );
            
            expect(mockTerminalLog.functionError).toHaveBeenCalledWith('failing_function', 'Function failed');
            // Should still submit outputs with error information
            expect(mockOpenAI.beta.threads.runs.submitToolOutputs).toHaveBeenCalled();
        });
    });

    describe('Message Processing End-to-End', () => {
        test('should process message successfully', async () => {
            // Setup mocks for full flow
            mockCache.get.mockReturnValue(undefined);
            mockOpenAI.beta.threads.create.mockResolvedValue({ id: 'thread_test' });
            mockOpenAI.beta.threads.messages.create.mockResolvedValue({ id: 'msg_test' });
            mockOpenAI.beta.threads.runs.create.mockResolvedValue({ id: 'run_test' });
            mockOpenAI.beta.threads.runs.retrieve.mockResolvedValue({
                id: 'run_test',
                status: 'completed',
                usage: { total_tokens: 150 }
            });
            mockOpenAI.beta.threads.messages.list.mockResolvedValue({
                data: [{
                    role: 'assistant',
                    content: [{
                        type: 'text',
                        text: { value: 'Hello! How can I help you today?' }
                    }]
                }]
            });
            
            const result = await openaiService.processMessage('user123', 'Hello', 'chat456', 'TestUser');
            
            expect(result.success).toBe(true);
            expect(result.response).toBe('Hello! How can I help you today?');
            expect(result.tokensUsed).toBe(150);
            expect(result.threadId).toBe('thread_test');
            expect(result.runId).toBe('run_test');
            expect(result.processingTime).toBeGreaterThan(0);
        });

        test('should handle processing errors gracefully', async () => {
            mockOpenAI.beta.threads.create.mockRejectedValue(new Error('API unavailable'));
            
            const result = await openaiService.processMessage('user123', 'Hello', 'chat456', 'TestUser');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('API unavailable');
            expect(result.processingTime).toBeGreaterThan(0);
            expect(mockTerminalLog.openaiError).toHaveBeenCalledWith('TestUser', 'API unavailable');
        });
    });

    describe('Utility Methods', () => {
        test('should get thread messages', async () => {
            const mockMessages = {
                data: [
                    { role: 'assistant', content: [{ type: 'text', text: { value: 'Response 2' } }] },
                    { role: 'user', content: [{ type: 'text', text: { value: 'Message 2' } }] },
                    { role: 'assistant', content: [{ type: 'text', text: { value: 'Response 1' } }] }
                ]
            };
            
            mockOpenAI.beta.threads.messages.list.mockResolvedValue(mockMessages);
            
            const messages = await openaiService.getThreadMessages('thread_test', 5);
            
            expect(messages).toHaveLength(3);
            expect(mockOpenAI.beta.threads.messages.list).toHaveBeenCalledWith('thread_test', {
                order: 'desc',
                limit: 5
            });
        });

        test('should get thread messages with default limit', async () => {
            mockOpenAI.beta.threads.messages.list.mockResolvedValue({ data: [] });
            
            await openaiService.getThreadMessages('thread_test');
            
            expect(mockOpenAI.beta.threads.messages.list).toHaveBeenCalledWith('thread_test', {
                order: 'desc',
                limit: 10
            });
        });
    });

    describe('Health Check', () => {
        test('should return healthy status when services are accessible', async () => {
            mockOpenAI.models.list.mockResolvedValue({
                data: [{ id: 'gpt-4' }, { id: 'gpt-3.5-turbo' }]
            });
            
            mockOpenAI.beta.assistants.retrieve.mockResolvedValue({
                id: 'asst_test123',
                name: 'Test Assistant'
            });
            
            const health = await openaiService.healthCheck();
            
            expect(health.status).toBe('healthy');
            expect(health.details.apiConnectivity).toBe('ok');
            expect(health.details.assistantId).toBe('asst_test123');
            expect(health.details.assistantName).toBe('Test Assistant');
            expect(health.details.modelsAvailable).toBe(2);
        });

        test('should return unhealthy status when services are not accessible', async () => {
            mockOpenAI.models.list.mockRejectedValue(new Error('Network timeout'));
            
            const health = await openaiService.healthCheck();
            
            expect(health.status).toBe('unhealthy');
            expect(health.details.error).toContain('Network timeout');
            expect(health.details.apiConnectivity).toBe('failed');
        });
    });

    describe('Legacy Interface Compatibility', () => {
        test('should work with processWithOpenAI interface', async () => {
            // Mock successful processing
            jest.spyOn(openaiService, 'processMessage').mockResolvedValue({
                success: true,
                response: 'Test response',
                processingTime: 1500,
                tokensUsed: 100,
                threadId: 'thread_test',
                runId: 'run_test'
            });
            
            await expect(
                openaiService.processWithOpenAI('user123', 'Hello', 'chat456', 'TestUser')
            ).resolves.not.toThrow();
            
            expect(mockTerminalLog.response).toHaveBeenCalledWith('TestUser', 'Test response', 1500);
        });

        test('should throw error when processWithOpenAI fails', async () => {
            jest.spyOn(openaiService, 'processMessage').mockResolvedValue({
                success: false,
                error: 'Processing failed',
                processingTime: 1000
            });
            
            await expect(
                openaiService.processWithOpenAI('user123', 'Hello', 'chat456', 'TestUser')
            ).rejects.toThrow('Processing failed');
            
            expect(mockTerminalLog.openaiError).toHaveBeenCalledWith('TestUser', 'Processing failed');
        });
    });

    describe('Configuration Edge Cases', () => {
        test('should handle cache disabled configuration', () => {
            const noCacheConfig = { ...config, enableThreadCache: false };
            const service = new OpenAIService(noCacheConfig, mockTerminalLog);
            
            expect(service.getConfig().enableThreadCache).toBe(false);
        });

        test('should handle service without cache manager', async () => {
            const serviceNoCache = new OpenAIService(config, mockTerminalLog); // No cache manager
            
            mockOpenAI.beta.threads.create.mockResolvedValue({ id: 'thread_test' });
            
            const threadId = await (serviceNoCache as any).getOrCreateThread('user123', 'chat456');
            
            expect(threadId).toBe('thread_test');
            // Should not try to use cache
            expect(mockCache.get).not.toHaveBeenCalled();
            expect(mockCache.set).not.toHaveBeenCalled();
        });
    });
});