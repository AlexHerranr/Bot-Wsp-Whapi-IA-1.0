// tests/unit/retry-utils.test.ts
import { 
    withRetry, 
    openAIWithRetry, 
    downloadWithRetry,
    withTimeout,
    createRetryableFunction
} from '../../src/core/utils/retry-utils';

describe('🧪 Retry Utils', () => {
    
    describe('withRetry', () => {
        test('should succeed on first attempt', async () => {
            const operation = jest.fn().mockResolvedValue('success');
            
            const result = await withRetry(operation);
            
            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('should retry on failure and eventually succeed', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'))
                .mockResolvedValue('success');
            
            const result = await withRetry(operation, { 
                maxRetries: 3, 
                baseDelay: 10, // Very short delay for tests
                maxDelay: 50 
            });
            
            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(3);
        }, 10000); // Increase timeout

        test('should fail after max retries', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('persistent failure'));
            
            await expect(withRetry(operation, { 
                maxRetries: 2, 
                baseDelay: 10, 
                maxDelay: 50 
            })).rejects.toThrow('persistent failure');
            expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
        }, 10000);

        test('should use exponential backoff', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'))
                .mockResolvedValue('success');

            const startTime = Date.now();
            await withRetry(operation, { 
                maxRetries: 2, 
                baseDelay: 100,
                backoffFactor: 2 
            });
            const endTime = Date.now();

            // Should take at least 100ms + 200ms = 300ms (with some tolerance)
            expect(endTime - startTime).toBeGreaterThan(250);
        });
    });

    describe('openAIWithRetry', () => {
        test('should handle rate limit errors', async () => {
            const operation = jest.fn()
                .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
                .mockResolvedValue('success');
            
            const result = await openAIWithRetry(operation);
            
            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(2);
        });

        test('should not retry on non-retryable errors', async () => {
            const operation = jest.fn()
                .mockRejectedValue({ status: 400, message: 'Bad request' });
            
            await expect(openAIWithRetry(operation, { 
                baseDelay: 10, 
                maxDelay: 50 
            })).rejects.toMatchObject({
                status: 400,
                message: 'Bad request'
            });
            expect(operation).toHaveBeenCalledTimes(1);
        }, 10000);
    });

    describe('withTimeout', () => {
        test('should resolve before timeout', async () => {
            const operation = () => new Promise(resolve => 
                setTimeout(() => resolve('success'), 100)
            );
            
            const result = await withTimeout(operation, 200);
            expect(result).toBe('success');
        });

        test('should reject on timeout', async () => {
            const operation = () => new Promise(resolve => 
                setTimeout(() => resolve('too slow'), 200)
            );
            
            await expect(withTimeout(operation, 100, 'Custom timeout')).rejects.toThrow('Custom timeout');
        });
    });

    describe('createRetryableFunction', () => {
        test('should create retryable version of function', async () => {
            const originalFn = jest.fn()
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValue('success');
                
            const retryableFn = createRetryableFunction(originalFn, { maxRetries: 1 });
            
            const result = await retryableFn('arg1', 'arg2');
            
            expect(result).toBe('success');
            expect(originalFn).toHaveBeenCalledTimes(2);
            expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
        });
    });

    describe('downloadWithRetry', () => {
        // Mock fetch globally for these tests
        const mockFetch = jest.fn();
        global.fetch = mockFetch;

        beforeEach(() => {
            mockFetch.mockClear();
        });

        test('should download successfully', async () => {
            const mockResponse = { 
                ok: true, 
                status: 200,
                statusText: 'OK'
            };
            mockFetch.mockResolvedValue(mockResponse);
            
            const result = await downloadWithRetry('http://example.com/file.jpg');
            
            expect(result).toBe(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith('http://example.com/file.jpg', {
                signal: expect.any(AbortSignal),
                headers: {
                    'User-Agent': 'WhatsApp-Bot/1.0'
                }
            });
        });

        test('should retry on failure', async () => {
            mockFetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValue({ ok: true, status: 200 });
            
            const result = await downloadWithRetry('http://example.com/file.jpg');
            
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result).toMatchObject({ ok: true, status: 200 });
        });
    });
});