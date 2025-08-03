// tests/regression/rate-limit-logs.test.ts
import 'reflect-metadata';
import { WebhookProcessor } from '../../src/core/api/webhook-processor';
import { BufferManager } from '../../src/core/state/buffer-manager';
import { UserManager } from '../../src/core/state/user-state-manager';
import { MediaManager } from '../../src/core/state/media-manager';
import { MediaService } from '../../src/core/services/media.service';
import { DatabaseService } from '../../src/core/services/database.service';
import { TerminalLog } from '../../src/core/utils/terminal-log';

// Mock all dependencies
jest.mock('../../src/core/state/buffer-manager');
jest.mock('../../src/core/state/user-state-manager');
jest.mock('../../src/core/state/media-manager');
jest.mock('../../src/core/services/media.service');
jest.mock('../../src/core/services/database.service');
jest.mock('../../src/core/utils/terminal-log');

describe('Rate Limiting for Typing Logs', () => {
    let webhookProcessor: WebhookProcessor;
    let mockBufferManager: jest.Mocked<BufferManager>;
    let mockUserManager: jest.Mocked<UserManager>;
    let mockMediaManager: jest.Mocked<MediaManager>;
    let mockMediaService: jest.Mocked<MediaService>;
    let mockDatabaseService: jest.Mocked<DatabaseService>;
    let mockTerminalLog: jest.Mocked<TerminalLog>;

    beforeEach(() => {
        // Setup mocks
        mockBufferManager = {
            setIntelligentTimer: jest.fn()
        } as any;

        mockUserManager = {
            getOrCreateState: jest.fn().mockReturnValue({
                userId: 'test-user',
                userName: 'Test User',
                isTyping: false,
                lastInputVoice: false
            })
        } as any;

        mockMediaManager = {} as any;
        mockMediaService = {} as any;
        mockDatabaseService = {} as any;
        
        mockTerminalLog = {
            typing: jest.fn(),
            error: jest.fn()
        } as any;

        webhookProcessor = new WebhookProcessor(
            mockBufferManager,
            mockUserManager,
            mockMediaManager,
            mockMediaService,
            mockDatabaseService,
            mockTerminalLog
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should rate limit typing logs to once every 5 seconds per user', async () => {
        const mockWebhookData = {
            messages: [],
            presences: [
                {
                    contact_id: 'test-user-123',
                    status: 'typing',
                    timestamp: Date.now()
                }
            ]
        };

        // First typing event - should log
        await webhookProcessor.process(mockWebhookData);
        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(1);
        expect(mockTerminalLog.typing).toHaveBeenCalledWith('Test User');

        // Immediate second typing event - should NOT log due to rate limiting
        await webhookProcessor.process(mockWebhookData);
        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(1); // Still 1, not 2

        // Third typing event after some time but less than 5s - should NOT log
        setTimeout(async () => {
            await webhookProcessor.process(mockWebhookData);
            expect(mockTerminalLog.typing).toHaveBeenCalledTimes(1); // Still 1
        }, 2000);

        // However, setIntelligentTimer should be called every time
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenCalledTimes(2);
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenCalledWith('test-user-123', 'typing');
    });

    test('should allow logging after 5 second cooldown period', async () => {
        const mockWebhookData = {
            messages: [],
            presences: [
                {
                    contact_id: 'test-user-456',
                    status: 'recording',
                    timestamp: Date.now()
                }
            ]
        };

        // First event - should log
        await webhookProcessor.process(mockWebhookData);
        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(1);

        // Mock time passage of 5+ seconds
        const originalDateNow = Date.now;
        Date.now = jest.fn(() => originalDateNow() + 6000); // +6 seconds

        // Second event after 6 seconds - should log again
        await webhookProcessor.process(mockWebhookData);
        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(2);

        // Restore Date.now
        Date.now = originalDateNow;
    });

    test('should handle multiple users independently', async () => {
        const mockWebhookDataUser1 = {
            messages: [],
            presences: [
                {
                    contact_id: 'user-1',
                    status: 'typing',
                    timestamp: Date.now()
                }
            ]
        };

        const mockWebhookDataUser2 = {
            messages: [],
            presences: [
                {
                    contact_id: 'user-2',
                    status: 'typing',
                    timestamp: Date.now()
                }
            ]
        };

        mockUserManager.getOrCreateState
            .mockReturnValueOnce({ userId: 'user-1', userName: 'User One', isTyping: false, lastInputVoice: false } as any)
            .mockReturnValueOnce({ userId: 'user-2', userName: 'User Two', isTyping: false, lastInputVoice: false } as any);

        // Both users typing simultaneously - both should log (different rate limits)
        await webhookProcessor.process(mockWebhookDataUser1);
        await webhookProcessor.process(mockWebhookDataUser2);

        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(2);
        expect(mockTerminalLog.typing).toHaveBeenNthCalledWith(1, 'User One');
        expect(mockTerminalLog.typing).toHaveBeenNthCalledWith(2, 'User Two');

        // Second typing from user 1 - should be rate limited
        await webhookProcessor.process(mockWebhookDataUser1);
        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(2); // Still 2, not 3
    });

    test('should rate limit both typing and recording events', async () => {
        const typingData = {
            messages: [],
            presences: [
                {
                    contact_id: 'test-user-mixed',
                    status: 'typing',
                    timestamp: Date.now()
                }
            ]
        };

        const recordingData = {
            messages: [],
            presences: [
                {
                    contact_id: 'test-user-mixed',
                    status: 'recording',
                    timestamp: Date.now()
                }
            ]
        };

        // First typing event - should log
        await webhookProcessor.process(typingData);
        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(1);

        // Immediate recording event from same user - should NOT log due to rate limiting
        await webhookProcessor.process(recordingData);
        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(1); // Still 1

        // Both events should trigger buffer manager
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenCalledTimes(2);
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenNthCalledWith(1, 'test-user-mixed', 'typing');
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenNthCalledWith(2, 'test-user-mixed', 'recording');
    });

    test('should handle presence events without userName gracefully', async () => {
        mockUserManager.getOrCreateState.mockReturnValue({
            userId: 'unnamed-user',
            userName: undefined, // No userName
            isTyping: false,
            lastInputVoice: false
        } as any);

        const mockWebhookData = {
            messages: [],
            presences: [
                {
                    contact_id: 'unnamed-user',
                    status: 'typing',
                    timestamp: Date.now()
                }
            ]
        };

        await webhookProcessor.process(mockWebhookData);

        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(1);
        expect(mockTerminalLog.typing).toHaveBeenCalledWith('Usuario'); // Default fallback
    });

    test('should ignore non-typing/recording presence events', async () => {
        const mockWebhookData = {
            messages: [],
            presences: [
                {
                    contact_id: 'test-user-online',
                    status: 'online',
                    timestamp: Date.now()
                },
                {
                    contact_id: 'test-user-offline',
                    status: 'offline',
                    timestamp: Date.now()
                }
            ]
        };

        await webhookProcessor.process(mockWebhookData);

        // Should not log typing for online/offline status
        expect(mockTerminalLog.typing).not.toHaveBeenCalled();
        
        // Should not trigger buffer manager for non-typing events
        expect(mockBufferManager.setIntelligentTimer).not.toHaveBeenCalled();
    });

    test('should handle case-insensitive status values', async () => {
        const mockWebhookData = {
            messages: [],
            presences: [
                {
                    contact_id: 'test-user-caps',
                    status: 'TYPING', // Uppercase
                    timestamp: Date.now()
                }
            ]
        };

        await webhookProcessor.process(mockWebhookData);

        expect(mockTerminalLog.typing).toHaveBeenCalledTimes(1);
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenCalledWith('test-user-caps', 'typing'); // Should be lowercased
    });
});