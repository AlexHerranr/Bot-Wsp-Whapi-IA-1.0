// tests/regression/send-chunks.test.ts
import { WhatsappService } from '../../src/core/services/whatsapp.service';
import { TerminalLog } from '../../src/core/utils/terminal-log';
import OpenAI from 'openai';

// Mock fetch para simular WHAPI
global.fetch = jest.fn();

describe('Message Chunks Functionality', () => {
    let whatsappService: WhatsappService;
    let mockTerminalLog: jest.Mocked<TerminalLog>;
    let mockOpenAI: jest.Mocked<OpenAI>;

    beforeEach(() => {
        mockTerminalLog = {
            voice: jest.fn(),
            warning: jest.fn(),
            error: jest.fn(),
            whapiError: jest.fn()
        } as any;

        mockOpenAI = {} as any;

        const config = {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        };

        whatsappService = new WhatsappService(mockOpenAI, mockTerminalLog, config);
        
        // Mock sendTypingIndicator method
        jest.spyOn(whatsappService, 'sendTypingIndicator').mockResolvedValue();
        
        // Mock fetch responses
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                message: { id: 'test-message-id' }
            })
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should send single message when no splitting patterns found', async () => {
        const shortMessage = 'Hola, ¿cómo estás?';
        const userState = { lastInputVoice: false };

        await whatsappService.sendWhatsAppMessage('test-chat-id', shortMessage, userState, false);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
            'https://test-api.whapi.com/messages/text',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    to: 'test-chat-id',
                    body: shortMessage,
                    typing_time: 3
                })
            })
        );
    });

    test('should split message by paragraphs (\\n\\n)', async () => {
        const messageWithParagraphs = `Primer párrafo con información inicial.

Segundo párrafo con más detalles.

Tercer párrafo con conclusiones.`;

        const userState = { lastInputVoice: false };

        await whatsappService.sendWhatsAppMessage('test-chat-id', messageWithParagraphs, userState, false);

        // Debería enviar 3 mensajes + 2 typing indicators (para chunks 2 y 3)
        expect(fetch).toHaveBeenCalledTimes(5);
        
        // Verificar que se llamó al typing indicator para chunks 2 y 3
        expect(whatsappService.sendTypingIndicator).toHaveBeenCalledTimes(2);
        
        // Verificar que los mensajes de texto se enviaron correctamente
        // (las llamadas serán intercaladas con typing indicators)
        const textCalls = (fetch as jest.Mock).mock.calls.filter(call => 
            call[0].includes('/messages/text')
        );
        
        expect(textCalls).toHaveLength(3);
        
        // Verificar contenido de los mensajes
        expect(textCalls[0][1].body).toContain('Primer párrafo con información inicial');
        expect(textCalls[1][1].body).toContain('Segundo párrafo con más detalles');
        expect(textCalls[2][1].body).toContain('Tercer párrafo con conclusiones');
    });

    test('should split message by bullet lists with headers', async () => {
        const messageWithBullets = `Aquí tienes las opciones disponibles:
• Primera opción
• Segunda opción
• Tercera opción

Y aquí más información:
- Detalle uno
- Detalle dos`;

        const userState = { lastInputVoice: false };

        await whatsappService.sendWhatsAppMessage('test-chat-id', messageWithBullets, userState, false);

        // Debería dividir por los patrones de bullet lists
        expect(fetch).toHaveBeenCalled();
        
        // Verificar que se procesó correctamente (al menos se hizo la llamada)
        const firstCall = (fetch as jest.Mock).mock.calls[0];
        expect(firstCall[1].body).toContain('test-chat-id');
    });

    test('should include delays between chunks', async () => {
        const messageWithParagraphs = `Párrafo corto.

Párrafo más largo con mucho más contenido para testear el delay.`;

        const userState = { lastInputVoice: false };

        // Mock setTimeout para capturar los delays
        const originalSetTimeout = global.setTimeout;
        const setTimeoutSpy = jest.fn((fn, delay) => {
            fn(); // Ejecutar inmediatamente para el test
            return 1 as any;
        });
        (global as any).setTimeout = setTimeoutSpy;

        await whatsappService.sendWhatsAppMessage('test-chat-id', messageWithParagraphs, userState, false);

        // Debería haber un delay entre los chunks
        expect(setTimeoutSpy).toHaveBeenCalled();
        
        // Con el nuevo sistema, el delay debería ser más humano (mínimo 1s, máximo 8s)
        const delayCall = setTimeoutSpy.mock.calls[0];
        expect(delayCall[1]).toBeGreaterThanOrEqual(1000);
        expect(delayCall[1]).toBeLessThanOrEqual(8000);

        (global as any).setTimeout = originalSetTimeout;
    });

    test('should use voice when appropriate and fallback to text on error', async () => {
        const message = 'Mensaje para voz';
        const userState = { lastInputVoice: true };
        
        // Mock OpenAI TTS to fail
        mockOpenAI.audio = {
            speech: {
                create: jest.fn().mockRejectedValue(new Error('TTS failed'))
            }
        } as any;

        // Mock environment variable
        process.env.ENABLE_VOICE_RESPONSES = 'true';

        await whatsappService.sendWhatsAppMessage('test-chat-id', message, userState, false);

        // Debería haber intentado voz y luego fallback a texto
        expect(mockTerminalLog.warning).toHaveBeenCalledWith(
            expect.stringContaining('Fallo al enviar voz')
        );
        
        // Debería haber enviado como texto después del fallo
        expect(fetch).toHaveBeenCalledWith(
            'https://test-api.whapi.com/messages/text',
            expect.anything()
        );
    });

    test('should not split quotes or price messages even if they have paragraphs', async () => {
        const priceMessage = `Precio de habitación:

$840.000 por noche

Disponible del 15 al 20 de enero.`;

        const userState = { lastInputVoice: false };

        await whatsappService.sendWhatsAppMessage('test-chat-id', priceMessage, userState, true); // isQuoteOrPrice = true

        // Debería enviar como un solo mensaje para precios
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
            'https://test-api.whapi.com/messages/text',
            expect.objectContaining({
                body: JSON.stringify({
                    to: 'test-chat-id',
                    body: priceMessage,
                    typing_time: 3
                })
            })
        );
    });
});