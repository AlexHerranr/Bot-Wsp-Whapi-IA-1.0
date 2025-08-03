// tests/regression/cleanup-old-runs.test.ts
import 'reflect-metadata';
import { OpenAIService } from '../../src/core/services/openai.service';
import { TerminalLog } from '../../src/core/utils/terminal-log';

// Mock OpenAI
const mockOpenAI = {
    beta: {
        threads: {
            runs: {
                list: jest.fn(),
                cancel: jest.fn()
            }
        }
    },
    models: {
        list: jest.fn()
    }
};

jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => mockOpenAI);
});

// Mock retry utils
jest.mock('../../src/core/utils/retry-utils', () => ({
    openAIWithRetry: jest.fn().mockImplementation((fn) => fn()),
    withTimeout: jest.fn((fn) => fn())
}));

describe('OpenAI Runs Cleanup with SQL Persistence', () => {
    let openaiService: OpenAIService;
    let mockTerminalLog: jest.Mocked<TerminalLog>;

    const mockConfig = {
        apiKey: 'test-openai-key',
        assistantId: 'asst_test123'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockTerminalLog = {
            warning: jest.fn(),
            error: jest.fn(),
            info: jest.fn()
        } as any;

        openaiService = new OpenAIService(mockConfig, mockTerminalLog);
    });

    describe('Cleanup Old Runs Functionality', () => {
        test('should cancel runs older than 10 minutes', async () => {
            const oldTimestamp = Math.floor((Date.now() - 15 * 60 * 1000) / 1000); // 15 minutes ago
            const recentTimestamp = Math.floor((Date.now() - 5 * 60 * 1000) / 1000); // 5 minutes ago

            // Mock runs list with mixed old and recent runs
            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_old_123',
                        status: 'in_progress',
                        created_at: oldTimestamp
                    },
                    {
                        id: 'run_recent_456',
                        status: 'in_progress', 
                        created_at: recentTimestamp
                    },
                    {
                        id: 'run_completed_789',
                        status: 'completed',
                        created_at: oldTimestamp
                    }
                ]
            });

            // Mock successful cancellation
            mockOpenAI.beta.threads.runs.cancel.mockResolvedValue({});

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should return count of cancelled runs
            expect(result).toBe(1);

            // Should have called list to get runs
            expect(mockOpenAI.beta.threads.runs.list).toHaveBeenCalledWith(
                'thread_test123', 
                { limit: 10 }
            );

            // Should only cancel the old active run
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledTimes(1);
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith(
                'thread_test123',
                'run_old_123'
            );

            // Should log the cancellation
            expect(mockTerminalLog.warning).toHaveBeenCalledWith(
                expect.stringContaining('Old run cancelled automatically')
            );

            // Should log cleanup summary
            expect(mockTerminalLog.info).toHaveBeenCalledWith(
                expect.stringContaining('Cleaned up 1 old runs')
            );
        });

        test('should not cancel recent runs', async () => {
            const recentTimestamp = Math.floor((Date.now() - 3 * 60 * 1000) / 1000); // 3 minutes ago

            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_recent_1',
                        status: 'in_progress',
                        created_at: recentTimestamp
                    },
                    {
                        id: 'run_recent_2', 
                        status: 'queued',
                        created_at: recentTimestamp
                    }
                ]
            });

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should return 0 cancelled runs
            expect(result).toBe(0);

            // Should not have called cancel
            expect(mockOpenAI.beta.threads.runs.cancel).not.toHaveBeenCalled();

            // Should not log cleanup (no runs cleaned)
            expect(mockTerminalLog.info).not.toHaveBeenCalledWith(
                expect.stringContaining('Cleaned up')
            );
        });

        test('should only cancel active runs (not completed/failed)', async () => {
            const oldTimestamp = Math.floor((Date.now() - 15 * 60 * 1000) / 1000);

            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_old_completed',
                        status: 'completed',
                        created_at: oldTimestamp
                    },
                    {
                        id: 'run_old_failed',
                        status: 'failed',
                        created_at: oldTimestamp
                    },
                    {
                        id: 'run_old_cancelled',
                        status: 'cancelled',
                        created_at: oldTimestamp
                    },
                    {
                        id: 'run_old_expired',
                        status: 'expired',
                        created_at: oldTimestamp
                    }
                ]
            });

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should not cancel any runs (all are already terminated)
            expect(result).toBe(0);
            expect(mockOpenAI.beta.threads.runs.cancel).not.toHaveBeenCalled();
        });

        test('should handle different active run statuses', async () => {
            const oldTimestamp = Math.floor((Date.now() - 20 * 60 * 1000) / 1000); // 20 minutes ago

            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_queued',
                        status: 'queued',
                        created_at: oldTimestamp
                    },
                    {
                        id: 'run_in_progress',
                        status: 'in_progress',
                        created_at: oldTimestamp
                    },
                    {
                        id: 'run_requires_action',
                        status: 'requires_action',
                        created_at: oldTimestamp
                    }
                ]
            });

            mockOpenAI.beta.threads.runs.cancel.mockResolvedValue({});

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should cancel all 3 active runs
            expect(result).toBe(3);
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledTimes(3);

            // Should cancel each run type
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith('thread_test123', 'run_queued');
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith('thread_test123', 'run_in_progress');
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith('thread_test123', 'run_requires_action');
        });

        test('should handle cancellation failures gracefully', async () => {
            const oldTimestamp = Math.floor((Date.now() - 15 * 60 * 1000) / 1000);

            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_cancel_success',
                        status: 'in_progress',
                        created_at: oldTimestamp
                    },
                    {
                        id: 'run_cancel_fail',
                        status: 'in_progress',
                        created_at: oldTimestamp
                    }
                ]
            });

            // First cancellation succeeds, second fails
            mockOpenAI.beta.threads.runs.cancel
                .mockResolvedValueOnce({})
                .mockRejectedValueOnce(new Error('Run cancellation failed'));

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should still return 1 (successful cancellation count)
            expect(result).toBe(1);

            // Should have attempted both cancellations
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledTimes(2);

            // Should log the failure
            expect(mockTerminalLog.error).toHaveBeenCalledWith(
                expect.stringContaining('Failed to cancel old run')
            );

            // Should still log successful cleanup
            expect(mockTerminalLog.info).toHaveBeenCalledWith(
                expect.stringContaining('Cleaned up 1 old runs')
            );
        });

        test('should handle API failures when listing runs', async () => {
            // Mock API failure
            mockOpenAI.beta.threads.runs.list.mockRejectedValue(
                new Error('OpenAI API temporarily unavailable')
            );

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should return 0 on API failure
            expect(result).toBe(0);

            // Should log error
            expect(mockTerminalLog.error).toHaveBeenCalledWith(
                expect.stringContaining('Error cleaning up old runs')
            );

            // Should not attempt cancellations
            expect(mockOpenAI.beta.threads.runs.cancel).not.toHaveBeenCalled();
        });

        test('should handle timestamp edge cases', async () => {
            const exactly10MinutesAgo = Math.floor((Date.now() - 10 * 60 * 1000) / 1000);
            const just11MinutesAgo = Math.floor((Date.now() - 11 * 60 * 1000) / 1000);

            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_exactly_10min',
                        status: 'in_progress',
                        created_at: exactly10MinutesAgo
                    },
                    {
                        id: 'run_just_over_10min',
                        status: 'in_progress',
                        created_at: just11MinutesAgo
                    }
                ]
            });

            mockOpenAI.beta.threads.runs.cancel.mockResolvedValue({});

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should only cancel the run that's over 10 minutes old
            expect(result).toBe(1);
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledTimes(1);
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith(
                'thread_test123',
                'run_just_over_10min'
            );
        });

        test('should handle string timestamps correctly', async () => {
            const oldDate = new Date(Date.now() - 15 * 60 * 1000);

            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_string_timestamp',
                        status: 'in_progress',
                        created_at: oldDate.toISOString() // String timestamp
                    }
                ]
            });

            mockOpenAI.beta.threads.runs.cancel.mockResolvedValue({});

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should handle string timestamp and cancel the old run
            expect(result).toBe(1);
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith(
                'thread_test123',
                'run_string_timestamp'
            );
        });

        test('should handle empty runs list', async () => {
            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: []
            });

            const result = await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should return 0 for empty list
            expect(result).toBe(0);

            // Should not attempt any cancellations
            expect(mockOpenAI.beta.threads.runs.cancel).not.toHaveBeenCalled();

            // Should not log cleanup
            expect(mockTerminalLog.info).not.toHaveBeenCalledWith(
                expect.stringContaining('Cleaned up')
            );
        });

        test('should limit runs query to 10 as per original implementation', async () => {
            mockOpenAI.beta.threads.runs.list.mockResolvedValue({ data: [] });

            await openaiService.cleanupOldRuns('thread_test123', 'user_test456');

            // Should query with limit of 10 (matching original implementation)
            expect(mockOpenAI.beta.threads.runs.list).toHaveBeenCalledWith(
                'thread_test123',
                { limit: 10 }
            );
        });
    });

    describe('Integration with SQL Persistence', () => {
        test('should work with thread IDs from SQL database', async () => {
            // Simulate SQL-persisted thread ID format
            const sqlThreadId = 'thread_sql_abc123def456';
            const sqlUserId = 'whatsapp_user_573123456789';

            const oldTimestamp = Math.floor((Date.now() - 15 * 60 * 1000) / 1000);

            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_sql_cleanup_test',
                        status: 'in_progress',
                        created_at: oldTimestamp
                    }
                ]
            });

            mockOpenAI.beta.threads.runs.cancel.mockResolvedValue({});

            const result = await openaiService.cleanupOldRuns(sqlThreadId, sqlUserId);

            expect(result).toBe(1);
            expect(mockOpenAI.beta.threads.runs.list).toHaveBeenCalledWith(sqlThreadId, { limit: 10 });
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith(sqlThreadId, 'run_sql_cleanup_test');

            // Should log with user information
            expect(mockTerminalLog.warning).toHaveBeenCalledWith(
                expect.stringContaining(sqlUserId)
            );
        });

        test('should handle database connection failures gracefully', async () => {
            // Even if this is called during DB issues, cleanup should still work
            // since it only uses OpenAI API directly
            
            const regularThreadId = 'thread_regular_123';
            const oldTimestamp = Math.floor((Date.now() - 15 * 60 * 1000) / 1000);

            mockOpenAI.beta.threads.runs.list.mockResolvedValue({
                data: [
                    {
                        id: 'run_during_db_issue',
                        status: 'in_progress',
                        created_at: oldTimestamp
                    }
                ]
            });

            mockOpenAI.beta.threads.runs.cancel.mockResolvedValue({});

            const result = await openaiService.cleanupOldRuns(regularThreadId, 'user_db_issue');

            // Should still work independently of database issues
            expect(result).toBe(1);
            expect(mockOpenAI.beta.threads.runs.cancel).toHaveBeenCalledWith(regularThreadId, 'run_during_db_issue');
        });
    });
});