// tests/unit/media.service.test.ts
import { MediaService, MediaServiceConfig } from '../../src/core/services/media.service';
import { TerminalLog, IDashboard, StartupConfig } from '../../src/core/utils/terminal-log';
import { MediaProcessingResult, MediaType } from '../../src/shared/types';
import { promises as fs } from 'fs';
import path from 'path';

// Mock OpenAI
jest.mock('openai');
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

// Mock downloadWithRetry and openAIWithRetry
jest.mock('../../src/core/utils/retry-utils', () => ({
    downloadWithRetry: jest.fn(),
    openAIWithRetry: jest.fn(),
    NoRetryError: class NoRetryError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'NoRetryError';
        }
    }
}));

// Mock fs promises
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn(),
        writeFile: jest.fn(),
        unlink: jest.fn()
    },
    createReadStream: jest.fn()
}));

import { downloadWithRetry, openAIWithRetry, NoRetryError } from '../../src/core/utils/retry-utils';

describe('🧪 Media Service', () => {
    let mediaService: MediaService;
    let mockTerminalLog: TerminalLog;
    let mockDashboard: jest.Mocked<IDashboard>;
    let config: MediaServiceConfig;

    beforeEach(() => {
        mockDashboard = {
            addLog: jest.fn()
        };
        
        const startupConfig: StartupConfig = {
            host: 'localhost',
            port: 3008,
            webhookUrl: 'https://test.com/webhook',
            showFunctionLogs: true
        };
        
        mockTerminalLog = new TerminalLog(mockDashboard, startupConfig);
        
        config = {
            openaiApiKey: 'test-api-key',
            maxFileSize: 10 * 1024 * 1024, // 10MB for tests
            tempDir: './test-temp'
        };
        
        mediaService = new MediaService(mockTerminalLog, config);
        
        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'clear').mockImplementation();
        
        // Reset mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Audio Transcription', () => {
        const mockAudioBuffer = new ArrayBuffer(1024);
        const mockAudioStream = { pipe: jest.fn() };
        
        beforeEach(() => {
            const mockResponse = {
                ok: true,
                headers: {
                    get: jest.fn().mockImplementation((header) => {
                        if (header === 'content-type') return 'audio/mpeg';
                        if (header === 'content-length') return '1024';
                        return null;
                    })
                },
                arrayBuffer: jest.fn().mockResolvedValue(mockAudioBuffer)
            };
            
            (downloadWithRetry as jest.Mock).mockResolvedValue(mockResponse);
            (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
            (fs.unlink as jest.Mock).mockResolvedValue(undefined);
            
            const mockFs = require('fs');
            mockFs.createReadStream.mockReturnValue(mockAudioStream);
        });

        test('should successfully transcribe audio', async () => {
            const transcriptionResponse = {
                text: 'Hello, this is a test transcription',
                language: 'es'
            };
            
            (openAIWithRetry as jest.Mock).mockResolvedValue(transcriptionResponse);
            
            const result = await mediaService.transcribeAudio('https://test.com/audio.mp3', 'user123');
            
            expect(result.success).toBe(true);
            expect(result.type).toBe('audio');
            expect(result.result).toBe('Hello, this is a test transcription');
            expect(result.metadata?.language).toBe('es');
            expect(result.metadata?.fileSize).toBe(1024);
            expect(result.metadata?.processingTime).toBeGreaterThan(0);
        });

        test('should handle audio transcription with file size validation', async () => {
            const largeSizeResponse = new Response('', {
                headers: {
                    'content-length': '50000000' // 50MB - exceeds limit
                }
            });
            
            (downloadWithRetry as jest.Mock).mockImplementation((url, options) => {
                // Simulate validation
                options.validateResponse(largeSizeResponse);
                return Promise.resolve(mockAudioBuffer);
            });
            
            try {
                await mediaService.transcribeAudio('https://test.com/large-audio.mp3', 'user123');
            } catch (error) {
                // Should trigger validation error
                expect(downloadWithRetry).toHaveBeenCalled();
            }
        });

        test('should handle audio transcription errors gracefully', async () => {
            (downloadWithRetry as jest.Mock).mockRejectedValue(new Error('Download failed'));
            
            const result = await mediaService.transcribeAudio('https://test.com/audio.mp3', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.type).toBe('audio');
            expect(result.error).toContain('Download failed');
            expect(result.metadata?.processingTime).toBeGreaterThan(0);
        });

        test('should handle OpenAI transcription API errors', async () => {
            (downloadWithRetry as jest.Mock).mockResolvedValue(mockAudioBuffer);
            (openAIWithRetry as jest.Mock).mockRejectedValue(new Error('OpenAI API error'));
            
            const result = await mediaService.transcribeAudio('https://test.com/audio.mp3', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('OpenAI API error');
        });

        test('should clean up temporary files after transcription', async () => {
            (openAIWithRetry as jest.Mock).mockResolvedValue({ text: 'Test' });
            
            await mediaService.transcribeAudio('https://test.com/audio.mp3', 'user123');
            
            expect(fs.mkdir).toHaveBeenCalledWith(
                path.join(process.cwd(), config.tempDir),
                { recursive: true }
            );
            expect(fs.writeFile).toHaveBeenCalled();
            expect(fs.unlink).toHaveBeenCalled();
        });
    });

    describe('Image Analysis', () => {
        test('should successfully analyze image', async () => {
            const mockImageBuffer = new ArrayBuffer(2048);
            const mockImageResponse = {
                ok: true,
                headers: {
                    get: jest.fn().mockImplementation((header) => {
                        if (header === 'content-type') return 'image/jpeg';
                        if (header === 'content-length') return '2048';
                        return null;
                    })
                },
                arrayBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
            };
            
            const visionResponse = {
                choices: [{
                    message: {
                        content: 'This is a hotel room with a bed and window'
                    }
                }],
                usage: {
                    total_tokens: 150
                }
            };
            
            (downloadWithRetry as jest.Mock).mockResolvedValue(mockImageResponse);
            (openAIWithRetry as jest.Mock).mockResolvedValue(visionResponse);
            
            const result = await mediaService.analyzeImage('https://test.com/image.jpg', 'user123');
            
            expect(result.success).toBe(true);
            expect(result.type).toBe('image');
            expect(result.result).toBe('This is a hotel room with a bed and window');
            expect(result.metadata?.tokensUsed).toBe(150);
            expect(result.metadata?.processingTime).toBeGreaterThan(0);
        });

        test('should handle image analysis with unsupported format', async () => {
            const unsupportedResponse = new Response('', {
                headers: {
                    'content-type': 'image/tiff'
                }
            });
            
            (downloadWithRetry as jest.Mock).mockImplementation((url, options) => {
                expect(() => options.validateResponse(unsupportedResponse)).toThrow(NoRetryError);
                throw new NoRetryError('Unsupported image type: image/tiff');
            });
            
            const result = await mediaService.analyzeImage('https://test.com/image.tiff', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported image type');
        });

        test('should handle image analysis errors gracefully', async () => {
            (downloadWithRetry as jest.Mock).mockRejectedValue(new Error('Network error'));
            
            const result = await mediaService.analyzeImage('https://test.com/image.jpg', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Network error');
            expect(result.metadata?.processingTime).toBeGreaterThan(0);
        });

        test('should handle Vision API errors', async () => {
            const mockImageBuffer = new ArrayBuffer(2048);
            (downloadWithRetry as jest.Mock).mockResolvedValue(mockImageBuffer);
            (openAIWithRetry as jest.Mock).mockRejectedValue(new Error('Vision API rate limit'));
            
            const result = await mediaService.analyzeImage('https://test.com/image.jpg', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Vision API rate limit');
        });

        test('should handle empty Vision API response', async () => {
            const mockImageBuffer = new ArrayBuffer(2048);
            const emptyResponse = {
                choices: [],
                usage: { total_tokens: 0 }
            };
            
            (downloadWithRetry as jest.Mock).mockResolvedValue(mockImageBuffer);
            (openAIWithRetry as jest.Mock).mockResolvedValue(emptyResponse);
            
            const result = await mediaService.analyzeImage('https://test.com/image.jpg', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('No analysis result received');
        });
    });

    describe('Generic Media Processing', () => {
        test('should route audio to transcription', async () => {
            const transcriptionSpy = jest.spyOn(mediaService, 'transcribeAudio');
            transcriptionSpy.mockResolvedValue({
                success: true,
                type: 'audio',
                result: 'Transcribed text'
            });
            
            const result = await mediaService.processMedia(
                'https://test.com/audio.mp3', 
                'audio' as MediaType, 
                'user123'
            );
            
            expect(transcriptionSpy).toHaveBeenCalledWith('https://test.com/audio.mp3', 'user123');
            expect(result.success).toBe(true);
            expect(result.type).toBe('audio');
        });

        test('should route image to analysis', async () => {
            const analysisSpy = jest.spyOn(mediaService, 'analyzeImage');
            analysisSpy.mockResolvedValue({
                success: true,
                type: 'image',
                result: 'Image description'
            });
            
            const result = await mediaService.processMedia(
                'https://test.com/image.jpg', 
                'image' as MediaType, 
                'user123',
                'Custom prompt'
            );
            
            expect(analysisSpy).toHaveBeenCalledWith('https://test.com/image.jpg', 'user123', 'Custom prompt');
            expect(result.success).toBe(true);
            expect(result.type).toBe('image');
        });

        test('should handle unsupported media types', async () => {
            const result = await mediaService.processMedia(
                'https://test.com/document.pdf', 
                'video' as MediaType, 
                'user123'
            );
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported media type: video');
            expect(result.metadata?.attemptedUrl).toBe('https://test.com/document.pdf');
        });
    });

    describe('Utility Methods', () => {
        test('should check audio format support', () => {
            expect(mediaService.isAudioSupported('audio/mpeg')).toBe(true);
            expect(mediaService.isAudioSupported('audio/wav')).toBe(true);
            expect(mediaService.isAudioSupported('audio/flac')).toBe(false);
        });

        test('should check image format support', () => {
            expect(mediaService.isImageSupported('image/jpeg')).toBe(true);
            expect(mediaService.isImageSupported('image/png')).toBe(true);
            expect(mediaService.isImageSupported('image/svg+xml')).toBe(false);
        });

        test('should return max file size', () => {
            expect(mediaService.getMaxFileSize()).toBe(config.maxFileSize);
        });
    });

    describe('Health Check', () => {
        test('should return healthy status when API is accessible', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { 'content-type': 'application/json' },
                text: () => Promise.resolve('{"data": [{"id": "gpt-4"}]}'),
                json: () => Promise.resolve({ data: [{ id: 'gpt-4' }] })
            };
            
            (openAIWithRetry as jest.Mock).mockResolvedValue(mockResponse);
            
            const health = await mediaService.healthCheck();
            
            expect(health.status).toBe('healthy');
            expect(health.details.openaiConnectivity).toBe('ok');
            expect(health.details.maxFileSize).toBe(config.maxFileSize);
        });

        test('should return unhealthy status when API is not accessible', async () => {
            (openAIWithRetry as jest.Mock).mockRejectedValue(new Error('Network timeout'));
            
            const health = await mediaService.healthCheck();
            
            expect(health.status).toBe('unhealthy');
            expect(health.details.error).toContain('Network timeout');
            expect(health.details.openaiConnectivity).toBe('failed');
        });

        test('should return unhealthy status when API returns error status', async () => {
            const mockResponse = {
                ok: false,
                status: 401,
                headers: { 'content-type': 'application/json' },
                text: () => Promise.resolve('{"error": "Unauthorized"}'),
                json: () => Promise.resolve({ error: 'Unauthorized' })
            };
            
            (openAIWithRetry as jest.Mock).mockResolvedValue(mockResponse);
            
            const health = await mediaService.healthCheck();
            
            expect(health.status).toBe('unhealthy');
            expect(health.details.error).toContain('API returned status 401');
        });
    });

    describe('Legacy Methods', () => {
        test('should support legacy transcribeAudio signature', async () => {
            const transcriptionResponse = {
                text: 'Legacy transcription'
            };
            
            const mockAudioBuffer = new ArrayBuffer(1024);
            (downloadWithRetry as jest.Mock).mockResolvedValue(mockAudioBuffer);
            (openAIWithRetry as jest.Mock).mockResolvedValue(transcriptionResponse);
            (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
            (fs.unlink as jest.Mock).mockResolvedValue(undefined);
            
            const mockFs = require('fs');
            mockFs.createReadStream.mockReturnValue({ pipe: jest.fn() });
            
            const result = await mediaService.legacyTranscribeAudio(
                'https://test.com/audio.mp3', 
                'user123',
                'TestUser',
                'msg123'
            );
            
            expect(result.success).toBe(true);
            expect(result.result).toBe('Legacy transcription');
        });

        test('should support legacy analyzeImage signature', async () => {
            const visionResponse = {
                choices: [{
                    message: {
                        content: 'Legacy image analysis'
                    }
                }],
                usage: { total_tokens: 100 }
            };
            
            const mockImageBuffer = new ArrayBuffer(2048);
            (downloadWithRetry as jest.Mock).mockResolvedValue(mockImageBuffer);
            (openAIWithRetry as jest.Mock).mockResolvedValue(visionResponse);
            
            const result = await mediaService.legacyAnalyzeImage(
                'https://test.com/image.jpg', 
                'user123',
                'TestUser',
                'msg123'
            );
            
            expect(result.success).toBe(true);
            expect(result.result).toBe('Legacy image analysis');
        });
    });

    describe('Configuration and Edge Cases', () => {
        test('should use default configuration values', () => {
            const minimalConfig: MediaServiceConfig = {
                openaiApiKey: 'test-key'
            };
            
            const service = new MediaService(mockTerminalLog, minimalConfig);
            
            expect(service.getMaxFileSize()).toBe(25 * 1024 * 1024); // 25MB default
            expect(service.isAudioSupported('audio/mpeg')).toBe(true);
            expect(service.isImageSupported('image/jpeg')).toBe(true);
        });

        test('should handle empty audio URL', async () => {
            const result = await mediaService.transcribeAudio('', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle empty image URL', async () => {
            const result = await mediaService.analyzeImage('', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        test('should handle cleanup failures gracefully', async () => {
            const mockAudioBuffer = new ArrayBuffer(1024);
            (downloadWithRetry as jest.Mock).mockResolvedValue(mockAudioBuffer);
            (openAIWithRetry as jest.Mock).mockResolvedValue({ text: 'Test' });
            (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
            (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
            (fs.unlink as jest.Mock).mockRejectedValue(new Error('Cleanup failed'));
            
            const mockFs = require('fs');
            mockFs.createReadStream.mockReturnValue({ pipe: jest.fn() });
            
            const result = await mediaService.transcribeAudio('https://test.com/audio.mp3', 'user123');
            
            // Should still succeed despite cleanup failure
            expect(result.success).toBe(true);
            expect(result.result).toBe('Test');
        });
    });
});