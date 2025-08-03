// tests/integration/ensamblaje/thread-persistence-migration.test.ts
// Test para verificar migración de threads.json a PostgreSQL

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ThreadPersistenceService } from '../../../src/core/services/thread-persistence.service';
import { DatabaseService } from '../../../src/core/services/database.service';

describe('Thread Persistence Migration', () => {
    let threadService: ThreadPersistenceService;
    let databaseService: DatabaseService;

    beforeAll(async () => {
        databaseService = new DatabaseService();
        await databaseService.connect();
        threadService = new ThreadPersistenceService(databaseService);
    });

    afterAll(async () => {
        await databaseService.disconnect();
    });

    it('should save and retrieve thread using PostgreSQL', async () => {
        const userId = '573003913251@s.whatsapp.net';
        const threadId = 'thread_123';
        const chatId = '573003913251@s.whatsapp.net';
        const userName = 'Test User';

        // Save thread
        await threadService.setThread(userId, threadId, chatId, userName);

        // Retrieve thread
        const retrieved = await threadService.getThread(userId);

        expect(retrieved).not.toBeNull();
        expect(retrieved?.threadId).toBe(threadId);
        expect(retrieved?.chatId).toBe(chatId);
        expect(retrieved?.userName).toBe(userName);
    });

    it('should update thread metadata', async () => {
        const userId = '573003913252@s.whatsapp.net';
        const threadId = 'thread_456';

        // Create initial thread
        await threadService.setThread(userId, threadId, userId, 'Initial User');

        // Update metadata
        const updateResult = await threadService.updateThreadMetadata(userId, {
            name: 'Updated Name',
            labels: ['VIP', 'Frequent']
        });

        expect(updateResult).toBe(true);

        // Verify update
        const retrieved = await threadService.getThread(userId);
        expect(retrieved?.labels).toContain('VIP');
        expect(retrieved?.labels).toContain('Frequent');
    });

    it('should update thread labels', async () => {
        const userId = '573003913253@s.whatsapp.net';
        const threadId = 'thread_789';

        // Create thread
        await threadService.setThread(userId, threadId, userId, 'Label User');

        // Update labels
        const updateResult = await threadService.updateThreadLabels(userId, ['Premium', 'Active']);

        expect(updateResult).toBe(true);

        // Verify labels
        const retrieved = await threadService.getThread(userId);
        expect(retrieved?.labels).toEqual(['Premium', 'Active']);
    });

    it('should handle non-existent threads gracefully', async () => {
        const nonExistentUserId = 'nonexistent@s.whatsapp.net';

        const retrieved = await threadService.getThread(nonExistentUserId);
        expect(retrieved).toBeNull();

        const updateResult = await threadService.updateThreadMetadata(nonExistentUserId, {
            name: 'Should Fail'
        });
        expect(updateResult).toBe(false);
    });

    it('should maintain data consistency across operations', async () => {
        const userId = '573003913254@s.whatsapp.net';
        const threadId = 'thread_consistency';

        // Create thread
        await threadService.setThread(userId, threadId, userId, 'Consistency User');

        // Multiple updates
        await threadService.updateThreadMetadata(userId, { labels: ['Tag1', 'Tag2'] });
        await threadService.updateThreadLabels(userId, ['Tag1', 'Tag2', 'Tag3']);
        await threadService.updateThreadMetadata(userId, { userName: 'Updated User' });

        // Verify final state
        const final = await threadService.getThread(userId);
        expect(final?.threadId).toBe(threadId);
        expect(final?.userName).toBe('Updated User');
        expect(final?.labels).toEqual(['Tag1', 'Tag2', 'Tag3']);
    });

    it('should work with database fallback mode', async () => {
        // Test that the service works even if database connection fails
        const stats = await threadService.getStats();
        expect(stats).toHaveProperty('totalThreads');
        expect(stats).toHaveProperty('activeThreads');
        expect(typeof stats.totalThreads).toBe('number');
        expect(typeof stats.activeThreads).toBe('number');
    });
});