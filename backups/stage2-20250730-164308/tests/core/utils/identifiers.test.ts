// tests/core/utils/identifiers.test.ts
import { getShortUserId, cleanContactName } from '../../../src/core/utils/identifiers';

describe('Identifier Utilities', () => {
    describe('getShortUserId', () => {
        it('should extract the number from a WhatsApp JID', () => {
            const jid = '573001234567@s.whatsapp.net';
            expect(getShortUserId(jid)).toBe('573001234567');
        });

        it('should return the same string if no @ is present', () => {
            const jid = '1234567890';
            expect(getShortUserId(jid)).toBe('1234567890');
        });

        it('should handle empty string', () => {
            expect(getShortUserId('')).toBe('');
        });

        it('should handle non-string input', () => {
            // @ts-ignore - testing invalid input
            expect(getShortUserId(null)).toBe('unknown');
            // @ts-ignore - testing invalid input
            expect(getShortUserId(undefined)).toBe('unknown');
            // @ts-ignore - testing invalid input
            expect(getShortUserId(123)).toBe('unknown');
        });
    });

    describe('cleanContactName', () => {
        it('should remove special characters and extra spaces', () => {
            const rawName = '   Juan!! Pérez©   ';
            expect(cleanContactName(rawName)).toBe('Juan Pérez');
        });

        it('should return "Usuario" for null or invalid input', () => {
            expect(cleanContactName(null)).toBe('Usuario');
            expect(cleanContactName(undefined)).toBe('Usuario');
            expect(cleanContactName('')).toBe('Usuario');
            // @ts-ignore - testing invalid input
            expect(cleanContactName(123)).toBe('Usuario');
        });

        it('should handle names with accents correctly', () => {
            const rawName = 'José María González';
            expect(cleanContactName(rawName)).toBe('José María González');
        });

        it('should truncate names longer than 50 characters', () => {
            const longName = 'A'.repeat(60);
            expect(cleanContactName(longName)).toBe('A'.repeat(50));
        });

        it('should remove multiple types of special characters', () => {
            const rawName = '***John@#$%&*()+-={}[]|\\:";\'<>?,./Doe***';
            expect(cleanContactName(rawName)).toBe('JohnDoe');
        });
    });
});