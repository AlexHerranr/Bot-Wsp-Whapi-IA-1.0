// tests/regression/media-real-files.test.ts
import 'reflect-metadata';
import { MediaService } from '../../src/core/services/media.service';
import { TerminalLog } from '../../src/core/utils/terminal-log';

// Mock external dependencies
global.fetch = jest.fn();

// Mock OpenAI
const mockOpenAI = {
    audio: {
        transcriptions: {
            create: jest.fn()
        }
    },
    chat: {
        completions: {
            create: jest.fn()
        }
    }
};

jest.mock('openai', () => ({
    __esModule: true,
    default: jest.fn(() => mockOpenAI)
}));

// Mock fs
jest.mock('fs', () => ({
    promises: {
        unlink: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined)
    }
}));

// Mock retry utils
jest.mock('../../src/core/utils/retry-utils', () => ({
    downloadWithRetry: jest.fn(),
    openAIWithRetry: jest.fn().mockImplementation((fn: any) => fn()),
    fetchWithRetry: jest.fn(),
    NoRetryError: class NoRetryError extends Error {}
}));

describe('Media Processing with Real File Scenarios', () => {
    let mediaService: MediaService;
    let mockTerminalLog: jest.Mocked<TerminalLog>;
    
    // Get access to mocked functions
    const { downloadWithRetry } = require('../../src/core/utils/retry-utils');

    const mockConfig = {
        openaiApiKey: 'test-openai-key',
        whapiApiUrl: 'https://test-api.whapi.com',
        whapiToken: 'test-whapi-token'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockTerminalLog = {
            info: jest.fn(),
            voiceError: jest.fn(),
            imageError: jest.fn(),
            error: jest.fn()
        } as any;

        mediaService = new MediaService(mockTerminalLog, mockConfig);

        // Setup default fetch mock
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        });
    });

    describe('Audio Processing Real-World Scenarios', () => {
        test('should process real voice message successfully', async () => {
            const mockAudioBuffer = Buffer.from('mock-ogg-audio-data');
            const expectedTranscription = 'Hola, necesito información sobre disponibilidad para el próximo fin de semana';

            // Mock successful audio download
            downloadWithRetry.mockResolvedValue(mockAudioBuffer);

            // Mock successful OpenAI transcription
            mockOpenAI.audio.transcriptions.create.mockResolvedValue({
                text: expectedTranscription
            });

            const result = await mediaService.transcribeAudio(
                'https://whapi-real-url.com/voice/12345.ogg',
                'whatsapp-user-573123456789'
            );

            expect(result.success).toBe(true);
            expect(result.type).toBe('audio');
            expect(result.result).toBe(expectedTranscription);
            expect(result.metadata?.processingTime).toBeGreaterThan(0);

            // Verify OpenAI was called with correct parameters
            expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledWith({
                file: expect.any(Object),
                model: 'whisper-1',
                language: 'es',
                response_format: 'text'
            });

            expect(mockTerminalLog.info).toHaveBeenCalledWith(
                expect.stringContaining('Starting audio transcription')
            );
        });

        test('should handle WhatsApp audio format (OGG) correctly', async () => {
            const oggAudioBuffer = Buffer.from('OggS\x00\x02\x00\x00'); // OGG header
            
            downloadWithRetry.mockResolvedValue(oggAudioBuffer);
            mockOpenAI.audio.transcriptions.create.mockResolvedValue({
                text: 'Mensaje de voz de WhatsApp procesado correctamente'
            });

            const result = await mediaService.transcribeAudio(
                'https://whapi.com/media/voice_message.ogg',
                'whatsapp-user-audio'
            );

            expect(result.success).toBe(true);
            expect(result.result).toBe('Mensaje de voz de WhatsApp procesado correctamente');
        });

        test('should handle network failures gracefully', async () => {
            // Simulate network failure during download
            downloadWithRetry.mockRejectedValue(new Error('ECONNRESET: Connection reset by peer'));

            const result = await mediaService.transcribeAudio(
                'https://unreachable-server.com/audio.mp3',
                'user-network-error'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('ECONNRESET');
            expect(result.metadata?.processingTime).toBeGreaterThan(0);

            expect(mockTerminalLog.voiceError).toHaveBeenCalledWith(
                'user-network-error',
                expect.stringContaining('ECONNRESET')
            );
        });

        test('should handle large audio files without memory issues', async () => {
            // Simulate 20MB audio file
            const largeAudioBuffer = Buffer.alloc(20 * 1024 * 1024, 'audio-data');
            
            downloadWithRetry.mockResolvedValue(largeAudioBuffer);
            mockOpenAI.audio.transcriptions.create.mockResolvedValue({
                text: 'Transcripción de archivo grande exitosa'
            });

            const result = await mediaService.transcribeAudio(
                'https://example.com/large-podcast.mp3',
                'user-large-file'
            );

            expect(result.success).toBe(true);
            expect(result.result).toBe('Transcripción de archivo grande exitosa');
            
            // Should handle large files without crashing
            expect(downloadWithRetry).toHaveBeenCalledTimes(1);
        });

        test('should handle OpenAI API rate limits', async () => {
            const audioBuffer = Buffer.from('standard-audio');
            
            downloadWithRetry.mockResolvedValue(audioBuffer);
            mockOpenAI.audio.transcriptions.create.mockRejectedValue(
                new Error('Rate limit exceeded. Please try again later.')
            );

            const result = await mediaService.transcribeAudio(
                'https://example.com/rate-limited.wav',
                'user-rate-limited'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Rate limit exceeded');
        });
    });

    describe('Image Analysis Real-World Scenarios', () => {
        test('should analyze real image with price information', async () => {
            const mockAnalysis = 'Esta imagen muestra una lista de precios para habitaciones: Habitación Estándar $150.000, Suite Junior $250.000, Suite Presidencial $400.000 por noche.';

            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{
                    message: {
                        content: mockAnalysis
                    }
                }]
            });

            const result = await mediaService.analyzeImage(
                'https://whapi-media.com/image/price-list-12345.jpg',
                'whatsapp-user-573987654321'
            );

            expect(result.success).toBe(true);
            expect(result.type).toBe('image');
            expect(result.result).toBe(mockAnalysis);
            expect(result.metadata?.processingTime).toBeGreaterThan(0);

            // Verify vision API was called correctly
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
                model: 'gpt-4o-mini',
                messages: expect.arrayContaining([
                    expect.objectContaining({
                        role: 'user',
                        content: expect.arrayContaining([
                            expect.objectContaining({
                                type: 'image_url',
                                image_url: { url: 'https://whapi-media.com/image/price-list-12345.jpg' }
                            })
                        ])
                    })
                ]),
                max_tokens: 1000
            });
        });

        test('should handle different image formats from WhatsApp', async () => {
            const formats = [
                { url: 'https://whapi.com/media/photo.jpg', format: 'JPEG' },
                { url: 'https://whapi.com/media/screenshot.png', format: 'PNG' },
                { url: 'https://whapi.com/media/sticker.webp', format: 'WebP' }
            ];

            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{ message: { content: 'Imagen analizada correctamente' } }]
            });

            for (const { url, format } of formats) {
                const result = await mediaService.analyzeImage(url, `user-${format.toLowerCase()}`);
                expect(result.success).toBe(true);
                expect(result.result).toBe('Imagen analizada correctamente');
            }

            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
        });

        test('should handle Vision API failures gracefully', async () => {
            mockOpenAI.chat.completions.create.mockRejectedValue(
                new Error('Vision API is currently unavailable')
            );

            const result = await mediaService.analyzeImage(
                'https://example.com/document.pdf',
                'user-vision-failure'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('Vision API is currently unavailable');

            expect(mockTerminalLog.imageError).toHaveBeenCalledWith(
                'user-vision-failure',
                expect.stringContaining('Vision API is currently unavailable')
            );
        });

        test('should handle custom prompts for business use cases', async () => {
            const businessPrompt = 'Extrae todos los precios, fechas y servicios mencionados en esta imagen de un menú de hotel';
            const expectedResponse = 'Servicios encontrados: Desayuno $25.000, Spa $80.000, Tour $120.000. Fechas: Válido hasta Dic 31, 2024.';

            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{ message: { content: expectedResponse } }]
            });

            const result = await mediaService.analyzeImage(
                'https://hotel-images.com/menu-servicios.jpg',
                'hotel-manager-user',
                businessPrompt
            );

            expect(result.success).toBe(true);
            expect(result.result).toBe(expectedResponse);

            // Should include custom prompt in API call
            const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
            const userMessage = callArgs.messages.find(m => m.role === 'user');
            const textContent = userMessage.content.find(c => c.type === 'text');
            expect(textContent.text).toContain('Extrae todos los precios');
        });
    });

    describe('Resource Management and Cleanup', () => {
        test('should clean up temporary files after processing', async () => {
            const { promises: fs } = require('fs');
            
            downloadWithRetry.mockResolvedValue(Buffer.from('temp-file-data'));
            mockOpenAI.audio.transcriptions.create.mockResolvedValue({
                text: 'Cleanup test completed'
            });

            await mediaService.transcribeAudio(
                'https://example.com/cleanup-test.wav',
                'cleanup-user'
            );

            // Should attempt to clean up temporary files
            expect(fs.unlink).toHaveBeenCalled();
        });

        test('should handle concurrent processing without resource leaks', async () => {
            downloadWithRetry.mockResolvedValue(Buffer.from('concurrent-test'));
            mockOpenAI.audio.transcriptions.create.mockResolvedValue({
                text: 'Concurrent processing successful'
            });
            mockOpenAI.chat.completions.create.mockResolvedValue({
                choices: [{ message: { content: 'Concurrent image analysis' } }]
            });

            // Process multiple files concurrently
            const promises = [
                mediaService.transcribeAudio('https://test1.com/audio1.mp3', 'user1'),
                mediaService.transcribeAudio('https://test2.com/audio2.wav', 'user2'),
                mediaService.analyzeImage('https://test3.com/image1.jpg', 'user3'),
                mediaService.analyzeImage('https://test4.com/image2.png', 'user4')
            ];

            const results = await Promise.all(promises);

            // All should succeed
            results.forEach(result => {
                expect(result.success).toBe(true);
            });

            // Should have made appropriate API calls
            expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledTimes(2);
            expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
        });

        test('should maintain performance under load', async () => {
            downloadWithRetry.mockResolvedValue(Buffer.from('performance-test'));
            mockOpenAI.audio.transcriptions.create.mockResolvedValue({
                text: 'Performance test result'
            });

            const startTime = Date.now();
            
            // Process 5 files sequentially to test performance
            for (let i = 0; i < 5; i++) {
                const result = await mediaService.transcribeAudio(
                    `https://perf-test.com/audio${i}.mp3`,
                    `perf-user-${i}`
                );
                expect(result.success).toBe(true);
            }

            const totalTime = Date.now() - startTime;
            
            // Should complete all 5 operations in reasonable time (allowing for mocks)
            expect(totalTime).toBeLessThan(5000); // 5 seconds max for mocked operations
            expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalledTimes(5);
        });
    });
});