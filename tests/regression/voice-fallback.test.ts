// tests/regression/voice-fallback.test.ts
import { WhatsappService } from '../../src/core/services/whatsapp.service';
import { TerminalLog } from '../../src/core/utils/terminal-log';
import OpenAI from 'openai';

// Mock fetch para simular WHAPI
global.fetch = jest.fn();

describe('Voice Response Fallback Functionality', () => {
    let whatsappService: WhatsappService;
    let mockTerminalLog: jest.Mocked<TerminalLog>;
    let mockOpenAI: jest.Mocked<OpenAI>;

    beforeEach(() => {
        mockTerminalLog = {
            voice: jest.fn(),
            warning: jest.fn(),
            error: jest.fn()
        } as any;

        const config = {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        };

        // Mock fetch responses
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                message: { id: 'test-message-id' }
            })
        });

        // Reset environment variable
        process.env.ENABLE_VOICE_RESPONSES = 'true';
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.ENABLE_VOICE_RESPONSES;
    });

    test('should send voice message when conditions are met', async () => {
        // Mock successful TTS
        mockOpenAI = {
            audio: {
                speech: {
                    create: jest.fn().mockResolvedValue({
                        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
                    })
                }
            }
        } as any;

        whatsappService = new WhatsappService(mockOpenAI, mockTerminalLog, {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        });

        const message = 'Hola, este es un mensaje de prueba';
        const userState = { lastInputVoice: true };

        await whatsappService.sendWhatsAppMessage('test-chat-id', message, userState, false);

        // Verificar que se llamó a TTS
        expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith({
            model: 'tts-1',
            voice: 'nova',
            input: message,
            response_format: 'mp3'
        });

        // Verificar que se envió como mensaje de voz
        expect(fetch).toHaveBeenCalledWith(
            'https://test-api.whapi.com/messages/voice',
            expect.objectContaining({
                method: 'POST'
            })
        );

        // Verificar que el body contiene los datos correctos
        const fetchCall = (fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        expect(body.to).toBe('test-chat-id');
        expect(body.media).toMatch(/^data:audio\/mp3;base64,/);

        expect(mockTerminalLog.voice).toHaveBeenCalled();
    });

    test('should fallback to text when TTS fails', async () => {
        // Mock TTS failure
        mockOpenAI = {
            audio: {
                speech: {
                    create: jest.fn().mockRejectedValue(new Error('TTS service unavailable'))
                }
            }
        } as any;

        whatsappService = new WhatsappService(mockOpenAI, mockTerminalLog, {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        });

        const message = 'Mensaje que falla en TTS';
        const userState = { lastInputVoice: true };

        await whatsappService.sendWhatsAppMessage('test-chat-id', message, userState, false);

        // Verificar que se intentó TTS
        expect(mockOpenAI.audio.speech.create).toHaveBeenCalled();

        // Verificar que se loggeó el warning
        expect(mockTerminalLog.warning).toHaveBeenCalledWith(
            expect.stringContaining('Fallo al enviar voz')
        );

        // Verificar que se envió como texto (fallback)
        expect(fetch).toHaveBeenCalledWith(
            'https://test-api.whapi.com/messages/text',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    to: 'test-chat-id',
                    body: message,
                    typing_time: 3
                })
            })
        );
    });

    test('should send text when voice is disabled', async () => {
        process.env.ENABLE_VOICE_RESPONSES = 'false';

        mockOpenAI = {
            audio: {
                speech: {
                    create: jest.fn()
                }
            }
        } as any;

        whatsappService = new WhatsappService(mockOpenAI, mockTerminalLog, {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        });

        const message = 'Mensaje con voz deshabilitada';
        const userState = { lastInputVoice: true };

        await whatsappService.sendWhatsAppMessage('test-chat-id', message, userState, false);

        // No debería llamar a TTS
        expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();

        // Debería enviar como texto directamente
        expect(fetch).toHaveBeenCalledWith(
            'https://test-api.whapi.com/messages/text',
            expect.anything()
        );
    });

    test('should send text when user input was not voice', async () => {
        mockOpenAI = {
            audio: {
                speech: {
                    create: jest.fn()
                }
            }
        } as any;

        whatsappService = new WhatsappService(mockOpenAI, mockTerminalLog, {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        });

        const message = 'Respuesta a mensaje de texto';
        const userState = { lastInputVoice: false };

        await whatsappService.sendWhatsAppMessage('test-chat-id', message, userState, false);

        // No debería llamar a TTS cuando el input no fue voz
        expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();

        // Debería enviar como texto
        expect(fetch).toHaveBeenCalledWith(
            'https://test-api.whapi.com/messages/text',
            expect.anything()
        );
    });

    test('should send text for quotes/prices even with voice input', async () => {
        mockOpenAI = {
            audio: {
                speech: {
                    create: jest.fn()
                }
            }
        } as any;

        whatsappService = new WhatsappService(mockOpenAI, mockTerminalLog, {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        });

        const priceMessage = 'El precio es $840.000 por noche';
        const userState = { lastInputVoice: true };

        await whatsappService.sendWhatsAppMessage('test-chat-id', priceMessage, userState, true); // isQuoteOrPrice = true

        // No debería llamar a TTS para precios/cotizaciones
        expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();

        // Debería enviar como texto
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

    test('should handle TTS message length limit', async () => {
        // Mock successful TTS
        mockOpenAI = {
            audio: {
                speech: {
                    create: jest.fn().mockResolvedValue({
                        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
                    })
                }
            }
        } as any;

        whatsappService = new WhatsappService(mockOpenAI, mockTerminalLog, {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        });

        // Mensaje muy largo (más de 4000 caracteres)
        const longMessage = 'A'.repeat(5000);
        const userState = { lastInputVoice: true };

        await whatsappService.sendWhatsAppMessage('test-chat-id', longMessage, userState, false);

        // Verificar que se truncó el mensaje para TTS
        expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith({
            model: 'tts-1',
            voice: 'nova',
            input: 'A'.repeat(4000), // Debería estar truncado a 4000 caracteres
            response_format: 'mp3'
        });
    });

    test('should handle empty or whitespace messages', async () => {
        mockOpenAI = {} as any;

        whatsappService = new WhatsappService(mockOpenAI, mockTerminalLog, {
            secrets: {
                WHAPI_API_URL: 'https://test-api.whapi.com',
                WHAPI_TOKEN: 'test-token'
            }
        });

        const emptyMessage = '   '; // Solo espacios
        const userState = { lastInputVoice: true };

        const result = await whatsappService.sendWhatsAppMessage('test-chat-id', emptyMessage, userState, false);

        // Debería retornar true pero no enviar nada
        expect(result).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
        expect(mockTerminalLog.error).toHaveBeenCalledWith(
            expect.stringContaining('Intento de enviar mensaje vacío')
        );
    });
});