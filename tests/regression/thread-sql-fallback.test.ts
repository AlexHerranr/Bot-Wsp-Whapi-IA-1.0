// tests/regression/thread-sql-fallback.test.ts
import { DatabaseService } from '../../src/core/services/database.service';
import { ThreadPersistenceService } from '../../src/core/services/thread-persistence.service';

// Mock PrismaClient para simular fallos de base de datos
const mockPrismaClient = {
    clientView: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn()
    },
    client: {
        create: jest.fn(),
        findUnique: jest.fn()
    },
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined)
};

// Mock the PrismaClient constructor
jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn(() => mockPrismaClient)
}));

describe('Thread Persistence SQL Fallback', () => {
    let databaseService: DatabaseService;
    let threadPersistenceService: ThreadPersistenceService;

    beforeEach(async () => {
        jest.clearAllMocks();
        
        // Reset mocks
        mockPrismaClient.clientView.findUnique.mockReset();
        mockPrismaClient.clientView.upsert.mockReset();
        mockPrismaClient.$connect.mockResolvedValue(undefined);
        mockPrismaClient.$disconnect.mockResolvedValue(undefined);

        databaseService = new DatabaseService();
        
        // Simulate successful connection for tests that need it
        await databaseService.connect();
        
        threadPersistenceService = new ThreadPersistenceService(databaseService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should retrieve thread from SQL when database is connected', async () => {
        const mockThreadData = {
            phoneNumber: 'test-user-123',
            threadId: 'thread_abc123',
            chatId: 'chat_xyz789',
            userName: 'Juan Pérez',
            lastActivity: new Date('2024-01-15T10:30:00Z'),
            label1: 'hotel-guest',
            label2: 'vip-customer',
            label3: null
        };

        mockPrismaClient.clientView.findUnique.mockResolvedValue(mockThreadData);

        const result = await threadPersistenceService.getThread('test-user-123');

        expect(result).toEqual({
            threadId: 'thread_abc123',
            chatId: 'chat_xyz789',
            userName: 'Juan Pérez',
            lastActivity: mockThreadData.lastActivity,
            labels: ['hotel-guest', 'vip-customer']
        });

        expect(mockPrismaClient.clientView.findUnique).toHaveBeenCalledWith({
            where: { phoneNumber: 'test-user-123' }
        });
    });

    test('should fallback to memory when SQL query fails', async () => {
        // First, save a thread to memory by simulating a SQL failure
        mockPrismaClient.clientView.upsert.mockRejectedValue(new Error('Database connection lost'));
        
        // This will save to memory due to the SQL failure
        await threadPersistenceService.setThread('test-user-456', 'thread_memory123', 'chat_memory456', 'María García');

        // Now simulate SQL failure on read as well
        mockPrismaClient.clientView.findUnique.mockRejectedValue(new Error('SQL query timeout'));

        const result = await threadPersistenceService.getThread('test-user-456');

        expect(result).toEqual({
            threadId: 'thread_memory123',
            chatId: 'chat_memory456',
            userName: 'María García',
            lastActivity: expect.any(Date),
            labels: []
        });

        expect(mockPrismaClient.clientView.findUnique).toHaveBeenCalledWith({
            where: { phoneNumber: 'test-user-456' }
        });
    });

    test('should save to SQL when database is connected', async () => {
        const mockUpsertResult = {
            phoneNumber: 'test-user-789',
            threadId: 'thread_new123',
            chatId: 'chat_new456',
            userName: 'Carlos López',
            lastActivity: new Date(),
            label1: null,
            label2: null,
            label3: null
        };

        mockPrismaClient.clientView.upsert.mockResolvedValue(mockUpsertResult);

        await threadPersistenceService.setThread('test-user-789', 'thread_new123', 'chat_new456', 'Carlos López');

        expect(mockPrismaClient.clientView.upsert).toHaveBeenCalledWith({
            where: { phoneNumber: 'test-user-789' },
            update: expect.objectContaining({
                threadId: 'thread_new123',
                chatId: 'chat_new456',
                userName: 'Carlos López'
            }),
            create: expect.objectContaining({
                phoneNumber: 'test-user-789',
                threadId: 'thread_new123',
                chatId: 'chat_new456',
                userName: 'Carlos López'
            })
        });
    });

    test('should save to memory when SQL fails', async () => {
        // Simulate SQL failure
        mockPrismaClient.clientView.upsert.mockRejectedValue(new Error('Database connection error'));

        await threadPersistenceService.setThread('test-user-error', 'thread_error123', 'chat_error456', 'Ana Ruiz');

        // Verify it was saved to memory by trying to retrieve it
        // (SQL will fail, so it should come from memory)
        mockPrismaClient.clientView.findUnique.mockRejectedValue(new Error('Still no connection'));

        const result = await threadPersistenceService.getThread('test-user-error');

        expect(result).toEqual({
            threadId: 'thread_error123',
            chatId: 'chat_error456',
            userName: 'Ana Ruiz',
            lastActivity: expect.any(Date),
            labels: []
        });
    });

    test('should update thread metadata in SQL when connected', async () => {
        // First, mock existing thread
        const existingThread = {
            phoneNumber: 'test-user-update',
            threadId: 'thread_existing',
            chatId: 'chat_existing',
            userName: 'Old Name',
            lastActivity: new Date('2024-01-10T09:00:00Z'),
            label1: 'old-label',
            label2: null,
            label3: null
        };

        mockPrismaClient.clientView.findUnique.mockResolvedValue(existingThread);
        mockPrismaClient.clientView.upsert.mockResolvedValue({
            ...existingThread,
            userName: 'Updated Name',
            label1: 'new-label-1',
            label2: 'new-label-2'
        });

        const success = await threadPersistenceService.updateThreadMetadata('test-user-update', {
            userName: 'Updated Name',
            labels: ['new-label-1', 'new-label-2']
        });

        expect(success).toBe(true);
        expect(mockPrismaClient.clientView.upsert).toHaveBeenCalled();
    });

    test('should handle thread metadata update when thread does not exist', async () => {
        mockPrismaClient.clientView.findUnique.mockResolvedValue(null);

        const success = await threadPersistenceService.updateThreadMetadata('non-existent-user', {
            userName: 'Should Not Work'
        });

        expect(success).toBe(false);
        expect(mockPrismaClient.clientView.upsert).not.toHaveBeenCalled();
    });

    test('should handle database reconnection', async () => {
        // Simulate initial connection failure
        mockPrismaClient.clientView.findUnique.mockRejectedValueOnce(new Error('Connection lost'));
        
        // Save to memory first
        await threadPersistenceService.setThread('test-reconnect', 'thread_reconnect', 'chat_reconnect', 'Reconnect User');

        // Simulate database coming back online
        mockPrismaClient.clientView.findUnique.mockResolvedValue({
            phoneNumber: 'test-reconnect',
            threadId: 'thread_reconnect',
            chatId: 'chat_reconnect',
            userName: 'Reconnect User',
            lastActivity: new Date(),
            label1: null,
            label2: null,
            label3: null
        });

        const result = await threadPersistenceService.getThread('test-reconnect');

        expect(result).toEqual({
            threadId: 'thread_reconnect',
            chatId: 'chat_reconnect',
            userName: 'Reconnect User',
            lastActivity: expect.any(Date),
            labels: []
        });
    });

    test('should preserve labels correctly during SQL operations', async () => {
        const threadWithLabels = {
            phoneNumber: 'test-labels',
            threadId: 'thread_labels',
            chatId: 'chat_labels',
            userName: 'Label User',
            lastActivity: new Date(),
            label1: 'premium',
            label2: 'frequent-guest',
            label3: 'corporate'
        };

        mockPrismaClient.clientView.findUnique.mockResolvedValue(threadWithLabels);

        const result = await threadPersistenceService.getThread('test-labels');

        expect(result?.labels).toEqual(['premium', 'frequent-guest', 'corporate']);
    });

    test('should handle partial label data correctly', async () => {
        const threadWithPartialLabels = {
            phoneNumber: 'test-partial-labels',
            threadId: 'thread_partial',
            chatId: 'chat_partial',
            userName: 'Partial User',
            lastActivity: new Date(),
            label1: 'first-label',
            label2: null,
            label3: 'third-label'
        };

        mockPrismaClient.clientView.findUnique.mockResolvedValue(threadWithPartialLabels);

        const result = await threadPersistenceService.getThread('test-partial-labels');

        expect(result?.labels).toEqual(['first-label', 'third-label']);
    });

    test('should maintain thread consistency between memory and SQL', async () => {
        const userId = 'consistency-test';
        const threadId = 'thread_consistency';
        const chatId = 'chat_consistency';
        const userName = 'Consistency User';

        // First save - should try SQL and fallback to memory on failure
        mockPrismaClient.clientView.upsert.mockRejectedValueOnce(new Error('Initial SQL failure'));
        await threadPersistenceService.setThread(userId, threadId, chatId, userName);

        // First read - should try SQL and fallback to memory
        mockPrismaClient.clientView.findUnique.mockRejectedValueOnce(new Error('SQL still failing'));
        const memoryResult = await threadPersistenceService.getThread(userId);

        expect(memoryResult).toEqual({
            threadId,
            chatId,
            userName,
            lastActivity: expect.any(Date),
            labels: []
        });

        // Now SQL comes back online
        mockPrismaClient.clientView.findUnique.mockResolvedValue({
            phoneNumber: userId,
            threadId,
            chatId,
            userName,
            lastActivity: new Date(),
            label1: null,
            label2: null,
            label3: null
        });

        const sqlResult = await threadPersistenceService.getThread(userId);

        expect(sqlResult).toEqual({
            threadId,
            chatId,
            userName,
            lastActivity: expect.any(Date),
            labels: []
        });
    });
});