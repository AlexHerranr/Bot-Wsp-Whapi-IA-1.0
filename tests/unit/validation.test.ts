// tests/unit/validation.test.ts
import { 
    WebhookPayloadSchema, 
    WhatsAppMessageSchema, 
    PresenceEventSchema,
    OpenAIRunSchema,
    FunctionCallSchema,
    UserStateSchema,
    MediaProcessingResultSchema
} from '../../src/shared/validation';

describe('🧪 Validation Schemas', () => {
    
    describe('WebhookPayloadSchema', () => {
        test('should validate valid webhook with messages', () => {
            const validPayload = {
                messages: [{
                    id: 'msg_123',
                    from: '1234567890',
                    from_me: false,
                    chat_id: 'chat_123',
                    from_name: 'Test User',
                    type: 'text' as const,
                    text: { body: 'Hello world' }
                }]
            };
            
            const result = WebhookPayloadSchema.safeParse(validPayload);
            expect(result.success).toBe(true);
        });

        test('should validate valid webhook with presences', () => {
            const validPayload = {
                presences: [{
                    contact_id: '1234567890',
                    status: 'typing'
                }]
            };
            
            const result = WebhookPayloadSchema.safeParse(validPayload);
            expect(result.success).toBe(true);
        });

        test('should reject webhook without messages or presences', () => {
            const invalidPayload = {};
            
            const result = WebhookPayloadSchema.safeParse(invalidPayload);
            expect(result.success).toBe(false);
        });
    });

    describe('WhatsAppMessageSchema', () => {
        test('should validate text message', () => {
            const textMessage = {
                id: 'msg_123',
                from: '1234567890',
                from_me: false,
                type: 'text' as const,
                text: { body: 'Hello world' }
            };
            
            const result = WhatsAppMessageSchema.safeParse(textMessage);
            expect(result.success).toBe(true);
        });

        test('should validate voice message', () => {
            const voiceMessage = {
                id: 'msg_123',
                from: '1234567890',
                from_me: false,
                type: 'voice' as const,
                voice: { link: 'https://example.com/audio.mp3' }
            };
            
            const result = WhatsAppMessageSchema.safeParse(voiceMessage);
            expect(result.success).toBe(true);
        });

        test('should reject invalid message type', () => {
            const invalidMessage = {
                id: 'msg_123',
                from: '1234567890',
                from_me: false,
                type: 'invalid_type'
            };
            
            const result = WhatsAppMessageSchema.safeParse(invalidMessage);
            expect(result.success).toBe(false);
        });
    });

    describe('OpenAIRunSchema', () => {
        test('should validate completed run', () => {
            const completedRun = {
                id: 'run_123',
                status: 'completed' as const
            };
            
            const result = OpenAIRunSchema.safeParse(completedRun);
            expect(result.success).toBe(true);
        });

        test('should validate run requiring action', () => {
            const actionRun = {
                id: 'run_123',
                status: 'requires_action' as const,
                required_action: {
                    type: 'submit_tool_outputs' as const,
                    submit_tool_outputs: {
                        tool_calls: [{ id: 'call_123', function: { name: 'test_func', arguments: '{}' } }]
                    }
                }
            };
            
            const result = OpenAIRunSchema.safeParse(actionRun);
            expect(result.success).toBe(true);
        });
    });

    describe('UserStateSchema', () => {
        test('should validate complete user state', () => {
            const userState = {
                userId: '1234567890',
                isTyping: false,
                lastTypingTimestamp: Date.now(),
                lastMessageTimestamp: Date.now(),
                messages: ['Hello', 'World'],
                chatId: 'chat_123',
                userName: 'Test User',
                typingEventsCount: 5,
                averageTypingDuration: 2500,
                lastInputVoice: false,
                lastTyping: Date.now(),
                isCurrentlyRecording: false
            };
            
            const result = UserStateSchema.safeParse(userState);
            expect(result.success).toBe(true);
        });
    });

    describe('MediaProcessingResultSchema', () => {
        test('should validate successful result', () => {
            const successResult = {
                success: true,
                content: 'Transcription result',
                processingTime: 1500
            };
            
            const result = MediaProcessingResultSchema.safeParse(successResult);
            expect(result.success).toBe(true);
        });

        test('should validate error result', () => {
            const errorResult = {
                success: false,
                error: 'Processing failed',
                processingTime: 500
            };
            
            const result = MediaProcessingResultSchema.safeParse(errorResult);
            expect(result.success).toBe(true);
        });
    });
});