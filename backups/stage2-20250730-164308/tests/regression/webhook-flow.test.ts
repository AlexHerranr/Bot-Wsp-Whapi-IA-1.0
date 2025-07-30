// tests/regression/webhook-flow.test.ts
import { WebhookProcessor } from '../../src/core/api/webhook-processor';
import { BufferManager } from '../../src/core/state/buffer-manager';
import { UserManager } from '../../src/core/state/user-state-manager';
import { MediaManager } from '../../src/core/state/media-manager';
import { MediaService } from '../../src/core/services/media.service';
import { TerminalLog } from '../../src/core/utils/terminal-log';

describe('Webhook Flow Regression Tests', () => {
    let webhookProcessor: WebhookProcessor;
    let mockBufferManager: jest.Mocked<BufferManager>;
    let mockUserManager: jest.Mocked<UserManager>;
    let mockMediaManager: jest.Mocked<MediaManager>;
    let mockMediaService: jest.Mocked<MediaService>;
    let mockTerminalLog: jest.Mocked<TerminalLog>;

    beforeEach(() => {
        // Mock dependencies
        mockBufferManager = {
            addMessage: jest.fn(),
            setIntelligentTimer: jest.fn(),
            processBuffer: jest.fn(),
        } as any;

        mockUserManager = {
            getOrCreateState: jest.fn().mockReturnValue({
                userId: 'test-user',
                userName: 'Test User',
                chatId: 'test-chat'
            }),
            updateState: jest.fn(),
        } as any;

        mockMediaManager = {
            isBotSentMessage: jest.fn().mockReturnValue(false),
            addPendingImage: jest.fn(),
        } as any;

        mockMediaService = {
            transcribeAudio: jest.fn(),
            analyzeImage: jest.fn(),
        } as any;

        mockTerminalLog = {
            typing: jest.fn(),
            error: jest.fn(),
            message: jest.fn(),
            image: jest.fn(),
            voice: jest.fn(),
        } as any;

        webhookProcessor = new WebhookProcessor(
            mockBufferManager,
            mockUserManager,
            mockMediaManager,
            mockMediaService,
            mockTerminalLog
        );
    });

    test('should process text message webhook correctly', async () => {
        const webhook = {
            messages: [{
                id: 'msg_123',
                from: '1234567890@s.whatsapp.net',
                from_me: false,
                chat_id: 'chat_123',
                from_name: 'Test User',
                type: 'text',
                text: { body: 'Hola, necesito información sobre precios' }
            }]
        };

        await webhookProcessor.process(webhook);

        // Verificar que se procesó el mensaje correctamente
        expect(mockBufferManager.addMessage).toHaveBeenCalledWith(
            '1234567890@s.whatsapp.net',
            'Hola, necesito información sobre precios',
            'chat_123',
            'Test User'
        );
    });

    test('should handle typing presence correctly', async () => {
        const webhook = {
            presences: [{
                contact_id: '1234567890@s.whatsapp.net',
                status: 'typing'
            }]
        };

        await webhookProcessor.process(webhook);

        // Verificar que se manejó el typing
        expect(mockUserManager.getOrCreateState).toHaveBeenCalledWith('1234567890@s.whatsapp.net');
        expect(mockTerminalLog.typing).toHaveBeenCalled();
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenCalledWith('1234567890@s.whatsapp.net', 'typing');
    });

    test('should handle recording presence correctly', async () => {
        const webhook = {
            presences: [{
                contact_id: '1234567890@s.whatsapp.net',
                status: 'recording'
            }]
        };

        await webhookProcessor.process(webhook);

        // Verificar que se manejó el recording
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenCalledWith('1234567890@s.whatsapp.net', 'recording');
    });

    test('should ignore bot messages to prevent loops', async () => {
        const webhook = {
            messages: [{
                id: 'msg_123',
                from: '1234567890@s.whatsapp.net',
                from_me: true, // Mensaje del bot
                chat_id: 'chat_123',
                type: 'text',
                text: { body: 'Respuesta del bot' }
            }]
        };

        await webhookProcessor.process(webhook);

        // No debe procesar mensajes del bot
        expect(mockBufferManager.addMessage).not.toHaveBeenCalled();
    });

    test('should handle image messages correctly', async () => {
        const webhook = {
            messages: [{
                id: 'msg_123',
                from: '1234567890@s.whatsapp.net',
                from_me: false,
                chat_id: 'chat_123',
                from_name: 'Test User',
                type: 'image' as const,
                image: {
                    link: 'https://example.com/image.jpg'
                }
            }]
        };


        await webhookProcessor.process(webhook);

        // Verificar que se manejó la imagen
        expect(mockMediaManager.addPendingImage).toHaveBeenCalledWith(
            '1234567890@s.whatsapp.net',
            'https://example.com/image.jpg'
        );
    });

    test('should handle audio messages correctly', async () => {
        const webhook = {
            messages: [{
                id: 'msg_123',
                from: '1234567890@s.whatsapp.net',
                from_me: false,
                chat_id: 'chat_123',
                from_name: 'Test User',
                type: 'audio',
                audio: {
                    link: 'https://example.com/audio.ogg'
                }
            }]
        };

        mockMediaService.transcribeAudio.mockResolvedValue('Texto transcrito del audio');

        await webhookProcessor.process(webhook);

        // Verificar que se procesó el audio
        expect(mockMediaService.transcribeAudio).toHaveBeenCalledWith(
            'https://example.com/audio.ogg',
            '1234567890@s.whatsapp.net',
            'Test User',
            'msg_123'
        );
    });

    test('should reject invalid webhook payload', async () => {
        const invalidWebhook = {
            invalid_field: 'data'
        };

        await webhookProcessor.process(invalidWebhook);

        // Debe registrar error de validación
        expect(mockTerminalLog.error).toHaveBeenCalledWith(
            expect.stringContaining('Webhook inválido')
        );
        
        // No debe procesar nada
        expect(mockBufferManager.addMessage).not.toHaveBeenCalled();
    });

    test('should handle webhook with both messages and presences', async () => {
        const webhook = {
            messages: [{
                id: 'msg_123',
                from: '1234567890@s.whatsapp.net',
                from_me: false,
                chat_id: 'chat_123',
                from_name: 'Test User',
                type: 'text',
                text: { body: 'Mensaje de texto' }
            }],
            presences: [{
                contact_id: '1234567890@s.whatsapp.net',
                status: 'typing'
            }]
        };

        await webhookProcessor.process(webhook);

        // Debe procesar tanto el mensaje como la presencia
        expect(mockBufferManager.addMessage).toHaveBeenCalled();
        expect(mockBufferManager.setIntelligentTimer).toHaveBeenCalled();
    });
});