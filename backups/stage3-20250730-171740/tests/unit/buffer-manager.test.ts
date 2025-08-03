// tests/unit/buffer-manager.test.ts
import { BufferManager } from '../../src/core/state/buffer-manager';
import { BUFFER_WINDOW_MS, VOICE_BUFFER_MS, TYPING_EXTENDED_MS } from '../../src/core/utils/constants';

describe('🧪 Buffer Manager', () => {
    let bufferManager: BufferManager;
    let mockProcessCallback: jest.Mock;

    beforeEach(() => {
        mockProcessCallback = jest.fn().mockResolvedValue(undefined);
        bufferManager = new BufferManager(mockProcessCallback);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Basic Buffer Operations', () => {
        test('should create buffer when adding first message', () => {
            bufferManager.addMessage('user123', 'Hello world', 'chat123', 'TestUser');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer).toBeDefined();
            expect(buffer.messages).toEqual(['Hello world']);
            expect(buffer.chatId).toBe('chat123');
            expect(buffer.userName).toBe('TestUser');
            expect(buffer.timer).toBeDefined();
        });

        test('should accumulate messages in buffer', () => {
            bufferManager.addMessage('user123', 'Message 1', 'chat123', 'TestUser');
            bufferManager.addMessage('user123', 'Message 2', 'chat123', 'TestUser');
            bufferManager.addMessage('user123', 'Message 3', 'chat123', 'TestUser');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.messages).toEqual(['Message 1', 'Message 2', 'Message 3']);
        });

        test('should update userName when provided non-default value', () => {
            bufferManager.addMessage('user123', 'Hello', 'chat123', 'TestUser');
            bufferManager.addMessage('user123', 'World', 'chat123', 'BetterName');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.userName).toBe('BetterName');
        });

        test('should not update userName with "Usuario"', () => {
            bufferManager.addMessage('user123', 'Hello', 'chat123', 'TestUser');
            bufferManager.addMessage('user123', 'World', 'chat123', 'Usuario');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.userName).toBe('TestUser');
        });

        test('should return undefined for non-existent buffer', () => {
            const buffer = bufferManager.getBuffer('non-existent');
            expect(buffer).toBeUndefined();
        });
    });

    describe('Buffer Processing and Limits', () => {
        test('should process buffer immediately when limit reached', async () => {
            // Add 50 messages first (fills buffer but doesn't trigger limit)
            for (let i = 1; i <= 50; i++) {
                bufferManager.addMessage('user123', `Message ${i}`, 'chat123', 'TestUser');
            }
            
            // The 51st message should trigger immediate processing
            bufferManager.addMessage('user123', 'Message 51', 'chat123', 'TestUser');
            
            // Should have triggered immediate processing with first 50 messages
            expect(mockProcessCallback).toHaveBeenCalledWith(
                'user123',
                expect.stringContaining('Message 1'),
                'chat123',
                'TestUser'
            );
        });

        test('should warn when buffer limit is reached', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            // Add 50 messages first
            for (let i = 1; i <= 50; i++) {
                bufferManager.addMessage('user123', `Message ${i}`, 'chat123', 'TestUser');
            }
            
            // The 51st message should trigger the warning
            bufferManager.addMessage('user123', 'Message 51', 'chat123', 'TestUser');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Buffer limit reached for user user123')
            );
            
            consoleSpy.mockRestore();
        });

        test('should combine messages with newlines when processing', async () => {
            jest.useFakeTimers();
            
            bufferManager.addMessage('user123', 'Line 1', 'chat123', 'TestUser');
            bufferManager.addMessage('user123', 'Line 2', 'chat123', 'TestUser');  
            bufferManager.addMessage('user123', 'Line 3', 'chat123', 'TestUser');
            
            // Fast-forward past buffer window
            jest.advanceTimersByTime(BUFFER_WINDOW_MS + 100);
            
            await jest.runAllTimersAsync();
            
            expect(mockProcessCallback).toHaveBeenCalledWith(
                'user123',
                'Line 1\nLine 2\nLine 3',
                'chat123',
                'TestUser'
            );
        });

        test('should clear buffer after processing', async () => {
            jest.useFakeTimers();
            
            bufferManager.addMessage('user123', 'Test message', 'chat123', 'TestUser');
            
            // Fast-forward to trigger processing
            jest.advanceTimersByTime(BUFFER_WINDOW_MS + 100);
            await jest.runAllTimersAsync();
            
            // Buffer should be deleted after processing
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer).toBeUndefined();
        });
    });

    describe('Intelligent Timer System', () => {
        test('should use correct delay for message type (5s)', () => {
            jest.useFakeTimers();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            bufferManager.addMessage('user123', 'Hello', 'chat123', 'TestUser');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.currentDelay).toBe(BUFFER_WINDOW_MS); // 5000ms
            
            consoleSpy.mockRestore();
        });

        test('should use correct delay for voice type (8s)', () => {
            jest.useFakeTimers();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            bufferManager.addMessage('user123', 'Initial', 'chat123', 'TestUser');
            bufferManager.setIntelligentTimer('user123', 'voice');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.currentDelay).toBe(VOICE_BUFFER_MS); // 8000ms
            
            consoleSpy.mockRestore();
        });

        test('should use correct delay for typing type (10s)', () => {
            jest.useFakeTimers();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            bufferManager.addMessage('user123', 'Initial', 'chat123', 'TestUser');
            bufferManager.setIntelligentTimer('user123', 'typing');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.currentDelay).toBe(TYPING_EXTENDED_MS); // 10000ms
            
            consoleSpy.mockRestore();
        });

        test('should use correct delay for recording type (10s)', () => {
            jest.useFakeTimers();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            bufferManager.addMessage('user123', 'Initial', 'chat123', 'TestUser');
            bufferManager.setIntelligentTimer('user123', 'recording');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.currentDelay).toBe(TYPING_EXTENDED_MS); // 10000ms
            
            consoleSpy.mockRestore();
        });

        test('should reconfigure timer when new delay is greater', () => {
            jest.useFakeTimers();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            // Start with message (5s)
            bufferManager.addMessage('user123', 'Hello', 'chat123', 'TestUser');
            expect(bufferManager.getBuffer('user123').currentDelay).toBe(5000);
            
            // Upgrade to voice (8s) - should reconfigure
            bufferManager.setIntelligentTimer('user123', 'voice');
            expect(bufferManager.getBuffer('user123').currentDelay).toBe(8000);
            
            // Upgrade to typing (10s) - should reconfigure
            bufferManager.setIntelligentTimer('user123', 'typing');
            expect(bufferManager.getBuffer('user123').currentDelay).toBe(10000);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Timer reconfigured for user user123')
            );
            
            consoleSpy.mockRestore();
        });

        test('should respect existing timer when new delay is smaller', () => {
            jest.useFakeTimers();
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            // Start with typing (10s)
            bufferManager.addMessage('user123', 'Hello', 'chat123', 'TestUser');
            bufferManager.setIntelligentTimer('user123', 'typing');
            expect(bufferManager.getBuffer('user123').currentDelay).toBe(10000);
            
            // Try to downgrade to message (5s) - should be respected
            bufferManager.setIntelligentTimer('user123', 'message');
            expect(bufferManager.getBuffer('user123').currentDelay).toBe(10000); // Still 10s
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Timer respected for user user123')
            );
            
            consoleSpy.mockRestore();
        });

        test('should handle setIntelligentTimer for non-existent buffer', () => {
            expect(() => {
                bufferManager.setIntelligentTimer('non-existent', 'message');
            }).not.toThrow();
        });
    });

    describe('Timer Execution', () => {
        test('should process buffer when timer expires', async () => {
            jest.useFakeTimers();
            
            bufferManager.addMessage('user123', 'Test message', 'chat123', 'TestUser');
            
            // Fast-forward past buffer window
            jest.advanceTimersByTime(BUFFER_WINDOW_MS + 100);
            await jest.runAllTimersAsync();
            
            expect(mockProcessCallback).toHaveBeenCalledWith(
                'user123',
                'Test message',
                'chat123',
                'TestUser'
            );
        });

        test('should handle processing errors gracefully', async () => {
            jest.useFakeTimers();
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Make callback throw an error
            mockProcessCallback.mockRejectedValueOnce(new Error('Processing failed'));
            
            bufferManager.addMessage('user123', 'Test message', 'chat123', 'TestUser');
            
            jest.advanceTimersByTime(BUFFER_WINDOW_MS + 100);
            await jest.runAllTimersAsync();
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Error processing buffer for user user123'),
                expect.any(Error)
            );
            
            consoleSpy.mockRestore();
        });

        test('should not process empty buffer', async () => {
            jest.useFakeTimers();
            
            // Create buffer but don't add messages
            bufferManager.addMessage('user123', 'Test', 'chat123', 'TestUser');
            const buffer = bufferManager.getBuffer('user123');
            buffer.messages = []; // Empty the messages
            
            jest.advanceTimersByTime(BUFFER_WINDOW_MS + 100);
            await jest.runAllTimersAsync();
            
            expect(mockProcessCallback).not.toHaveBeenCalled();
        });
    });

    describe('Cleanup Operations', () => {
        test('should cleanup old buffers', () => {
            const now = Date.now();
            
            // Create buffer and manually set old timestamp
            bufferManager.addMessage('user123', 'Old message', 'chat123', 'TestUser');
            const buffer = bufferManager.getBuffer('user123');
            buffer.lastActivity = now - (20 * 60 * 1000); // 20 minutes ago
            
            // Cleanup buffers older than 15 minutes
            const cleanedCount = bufferManager.cleanup(15 * 60 * 1000);
            
            expect(cleanedCount).toBe(1);
            expect(bufferManager.getBuffer('user123')).toBeUndefined();
        });

        test('should not cleanup recent buffers', () => {
            bufferManager.addMessage('user123', 'Recent message', 'chat123', 'TestUser');
            
            const cleanedCount = bufferManager.cleanup(15 * 60 * 1000);
            
            expect(cleanedCount).toBe(0);
            expect(bufferManager.getBuffer('user123')).toBeDefined();
        });

        test('should cleanup multiple old buffers', () => {
            const now = Date.now();
            const oldTime = now - (20 * 60 * 1000);
            
            // Create multiple old buffers
            bufferManager.addMessage('user1', 'Old 1', 'chat1', 'User1');
            bufferManager.addMessage('user2', 'Old 2', 'chat2', 'User2');
            bufferManager.addMessage('user3', 'Recent', 'chat3', 'User3');
            
            // Make first two old
            bufferManager.getBuffer('user1').lastActivity = oldTime;
            bufferManager.getBuffer('user2').lastActivity = oldTime;
            
            const cleanedCount = bufferManager.cleanup(15 * 60 * 1000);
            
            expect(cleanedCount).toBe(2);
            expect(bufferManager.getBuffer('user1')).toBeUndefined();
            expect(bufferManager.getBuffer('user2')).toBeUndefined();
            expect(bufferManager.getBuffer('user3')).toBeDefined();
        });

        test('should clear timers when cleaning up buffers', () => {
            jest.useFakeTimers();
            const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
            const now = Date.now();
            
            bufferManager.addMessage('user123', 'Old message', 'chat123', 'TestUser');
            const buffer = bufferManager.getBuffer('user123');
            buffer.lastActivity = now - (20 * 60 * 1000);
            
            bufferManager.cleanup(15 * 60 * 1000);
            
            expect(clearTimeoutSpy).toHaveBeenCalled();
        });

        test('should use default cleanup age when not specified', () => {
            const now = Date.now();
            
            bufferManager.addMessage('user123', 'Old message', 'chat123', 'TestUser');
            const buffer = bufferManager.getBuffer('user123');
            buffer.lastActivity = now - (20 * 60 * 1000); // 20 minutes ago (older than default 15 min)
            
            const cleanedCount = bufferManager.cleanup(); // No age specified
            
            expect(cleanedCount).toBe(1);
        });
    });

    describe('Edge Cases', () => {
        test('should handle concurrent message additions', () => {
            // Simulate rapid message additions
            for (let i = 0; i < 10; i++) {
                bufferManager.addMessage('user123', `Message ${i}`, 'chat123', 'TestUser');
            }
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.messages).toHaveLength(10);
            expect(buffer.messages[0]).toBe('Message 0');
            expect(buffer.messages[9]).toBe('Message 9');
        });

        test('should handle empty message text', () => {
            bufferManager.addMessage('user123', '', 'chat123', 'TestUser');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.messages).toEqual(['']);
        });

        test('should handle very long messages', () => {
            const longMessage = 'A'.repeat(10000);
            bufferManager.addMessage('user123', longMessage, 'chat123', 'TestUser');
            
            const buffer = bufferManager.getBuffer('user123');
            expect(buffer.messages[0]).toBe(longMessage);
        });

        test('should update lastActivity when adding messages', () => {
            const startTime = Date.now();
            
            bufferManager.addMessage('user123', 'First', 'chat123', 'TestUser');
            const firstActivity = bufferManager.getBuffer('user123').lastActivity;
            
            // Wait a bit and add another message
            setTimeout(() => {
                bufferManager.addMessage('user123', 'Second', 'chat123', 'TestUser');
                const secondActivity = bufferManager.getBuffer('user123').lastActivity;
                
                expect(secondActivity).toBeGreaterThan(firstActivity);
            }, 10);
        });
    });
});