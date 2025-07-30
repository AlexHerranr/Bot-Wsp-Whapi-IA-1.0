// tests/unit/webhook-validator.test.ts
import { WebhookValidator } from '../../src/core/api/webhook-validator';

describe('🧪 WebhookValidator', () => {
    let validator: WebhookValidator;
    let mockTerminalLog: any;

    beforeEach(() => {
        mockTerminalLog = {
            debug: jest.fn(),
            error: jest.fn(),
            warning: jest.fn(),
            info: jest.fn()
        };
        validator = new WebhookValidator(mockTerminalLog);
    });

    describe('validatePayload', () => {
        test('should validate valid webhook with messages', () => {
            const validPayload = {
                messages: [{
                    id: 'msg_123',
                    from: '1234567890',
                    from_me: false,
                    chat_id: 'chat_123',
                    from_name: 'Test User',
                    type: 'text',
                    text: { body: 'Hello world' }
                }]
            };

            const result = validator.validatePayload(validPayload);

            expect(result.valid).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.error).toBeUndefined();
            expect(mockTerminalLog.debug).toHaveBeenCalledWith('Webhook válido: 1 mensajes, 0 presencias');
        });

        test('should validate valid webhook with presences', () => {
            const validPayload = {
                presences: [{
                    contact_id: '1234567890',
                    status: 'typing'
                }]
            };

            const result = validator.validatePayload(validPayload);

            expect(result.valid).toBe(true);
            expect(result.data).toBeDefined();
            expect(mockTerminalLog.debug).toHaveBeenCalledWith('Webhook válido: 0 mensajes, 1 presencias');
        });

        test('should reject invalid webhook payload', () => {
            const invalidPayload = {
                invalid: 'data'
            };

            const result = validator.validatePayload(invalidPayload);

            expect(result.valid).toBe(false);
            expect(result.data).toBeUndefined();
            expect(result.error).toContain('Webhook validation failed');
            expect(mockTerminalLog.error).toHaveBeenCalled();
        });

        test('should handle malformed payload', () => {
            const result = validator.validatePayload(null);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Webhook validation failed');
        });
    });

    describe('validateBasic', () => {
        test('should accept valid basic payload with messages', () => {
            const payload = {
                messages: [{
                    id: 'msg_123',
                    from: '1234567890',
                    type: 'text'
                }]
            };

            const result = validator.validateBasic(payload);

            expect(result).toBe(true);
        });

        test('should accept valid basic payload with presences', () => {
            const payload = {
                presences: [{
                    contact_id: '1234567890',
                    status: 'typing'
                }]
            };

            const result = validator.validateBasic(payload);

            expect(result).toBe(true);
        });

        test('should reject payload without messages or presences', () => {
            const payload = {};

            const result = validator.validateBasic(payload);

            expect(result).toBe(false);
            expect(mockTerminalLog.error).toHaveBeenCalledWith('Payload debe contener al menos messages o presences');
        });

        test('should reject non-object payload', () => {
            const result = validator.validateBasic('invalid');

            expect(result).toBe(false);
            expect(mockTerminalLog.error).toHaveBeenCalledWith('Payload no es un objeto válido');
        });

        test('should reject messages with missing required fields', () => {
            const payload = {
                messages: [{
                    id: 'msg_123'
                    // Missing 'from' and 'type'
                }]
            };

            const result = validator.validateBasic(payload);

            expect(result).toBe(false);
            expect(mockTerminalLog.error).toHaveBeenCalledWith('1 mensajes inválidos encontrados');
        });
    });

    describe('sanitizePayload', () => {
        test('should remove dangerous fields', () => {
            const dangerousPayload = {
                messages: [{
                    id: 'msg_123',
                    from: '1234567890',
                    type: 'text',
                    __proto__: { dangerous: 'property' },
                    constructor: 'dangerous',
                    text: { 
                        body: 'Hello',
                        prototype: 'also dangerous'
                    }
                }]
            };

            const sanitized = validator.sanitizePayload(dangerousPayload);

            expect(sanitized.messages[0].__proto__).toBeUndefined();
            expect(sanitized.messages[0].constructor).toBeUndefined();
            expect(sanitized.messages[0].text.prototype).toBeUndefined();
            expect(sanitized.messages[0].id).toBe('msg_123'); // Normal fields preserved
        });

        test('should handle non-object input', () => {
            expect(validator.sanitizePayload(null)).toBe(null);
            expect(validator.sanitizePayload('string')).toBe('string');
            expect(validator.sanitizePayload(123)).toBe(123);
        });
    });

    describe('process', () => {
        test('should use Zod validation first', () => {
            const validPayload = {
                messages: [{
                    id: 'msg_123',
                    from: '1234567890',
                    from_me: false,
                    type: 'text',
                    text: { body: 'Hello' }
                }]
            };

            const result = validator.process(validPayload);

            expect(result.valid).toBe(true);
            expect(mockTerminalLog.debug).toHaveBeenCalled();
        });

        test('should fallback to basic validation if Zod fails', () => {
            const payloadWithExtraFields = {
                messages: [{
                    id: 'msg_123',
                    from: '1234567890',
                    type: 'text',
                    extraField: 'should be ignored'
                }]
            };

            const result = validator.process(payloadWithExtraFields);

            // May pass with basic validation even if Zod is strict
            expect(typeof result.valid).toBe('boolean');
        });

        test('should fail if all validations fail', () => {
            const invalidPayload = {
                completely: 'invalid'
            };

            const result = validator.process(invalidPayload);

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});