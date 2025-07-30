// tests/unit/media.service.simple.test.ts
import { MediaService, MediaServiceConfig } from '../../src/core/services/media.service';
import { TerminalLog, IDashboard, StartupConfig } from '../../src/core/utils/terminal-log';
import { MediaType } from '../../src/shared/types';

describe('🧪 Media Service - Core Functionality', () => {
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
        jest.spyOn(mockTerminalLog, 'info').mockImplementation();
        jest.spyOn(mockTerminalLog, 'voiceError').mockImplementation();
        jest.spyOn(mockTerminalLog, 'imageError').mockImplementation();
        
        config = {
            openaiApiKey: 'test-api-key',
            maxFileSize: 10 * 1024 * 1024, // 10MB for tests
            tempDir: './test-temp'
        };
        
        mediaService = new MediaService(mockTerminalLog, config);
        
        // Mock console methods
        jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'clear').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Configuration and Initialization', () => {
        test('should initialize with provided config', () => {
            expect(mediaService.getMaxFileSize()).toBe(config.maxFileSize);
        });

        test('should use default configuration when minimal config provided', () => {
            const minimalConfig: MediaServiceConfig = {
                openaiApiKey: 'test-key'
            };
            
            const service = new MediaService(mockTerminalLog, minimalConfig);
            
            expect(service.getMaxFileSize()).toBe(25 * 1024 * 1024); // 25MB default
        });
    });

    describe('Media Type Support', () => {
        test('should support standard audio formats', () => {
            expect(mediaService.isAudioSupported('audio/mpeg')).toBe(true);
            expect(mediaService.isAudioSupported('audio/mp4')).toBe(true);
            expect(mediaService.isAudioSupported('audio/wav')).toBe(true);
            expect(mediaService.isAudioSupported('audio/webm')).toBe(true);
            expect(mediaService.isAudioSupported('audio/ogg')).toBe(true);
        });

        test('should not support unsupported audio formats', () => {
            expect(mediaService.isAudioSupported('audio/flac')).toBe(false);
            expect(mediaService.isAudioSupported('audio/aac')).toBe(false);
        });

        test('should support standard image formats', () => {
            expect(mediaService.isImageSupported('image/jpeg')).toBe(true);
            expect(mediaService.isImageSupported('image/png')).toBe(true);
            expect(mediaService.isImageSupported('image/gif')).toBe(true);
            expect(mediaService.isImageSupported('image/webp')).toBe(true);
        });

        test('should not support unsupported image formats', () => {
            expect(mediaService.isImageSupported('image/svg+xml')).toBe(false);
            expect(mediaService.isImageSupported('image/tiff')).toBe(false);
        });
    });

    describe('Error Handling', () => {
        test('should handle empty audio URL gracefully', async () => {
            const result = await mediaService.transcribeAudio('', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.type).toBe('audio');
            expect(result.error).toBeDefined();
            expect(result.metadata?.processingTime).toBeGreaterThan(0);
        });

        test('should handle empty image URL gracefully', async () => {
            const result = await mediaService.analyzeImage('', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.type).toBe('image');
            expect(result.error).toBeDefined();
            expect(result.metadata?.processingTime).toBeGreaterThan(0);
        });

        test('should handle invalid URLs gracefully', async () => {
            const result = await mediaService.transcribeAudio('not-a-url', 'user123');
            
            expect(result.success).toBe(false);
            expect(result.type).toBe('audio');
            expect(result.error).toBeDefined();
        });
    });

    describe('Media Processing Router', () => {
        test('should handle unsupported media types', async () => {
            const result = await mediaService.processMedia(
                'https://test.com/document.pdf', 
                'video' as MediaType, 
                'user123'
            );
            
            expect(result.success).toBe(false);
            expect(result.type).toBe('video');
            expect(result.error).toContain('Unsupported media type: video');
            expect(result.metadata?.attemptedUrl).toBe('https://test.com/document.pdf');
        });
    });

    describe('Logging Integration', () => {
        test('should log transcription start', async () => {
            await mediaService.transcribeAudio('invalid-url', 'user123');
            
            expect(mockTerminalLog.info).toHaveBeenCalledWith(
                'Starting audio transcription for user123'
            );
        });

        test('should log image analysis start', async () => {
            await mediaService.analyzeImage('invalid-url', 'user123');
            
            expect(mockTerminalLog.info).toHaveBeenCalledWith(
                'Starting image analysis for user123'
            );
        });

        test('should log errors appropriately', async () => {
            await mediaService.transcribeAudio('invalid-url', 'user123');
            
            expect(mockTerminalLog.voiceError).toHaveBeenCalledWith(
                'user123',
                expect.any(String)
            );
        });
    });

    describe('Result Structure', () => {
        test('should return proper error structure for transcription', async () => {
            const result = await mediaService.transcribeAudio('invalid-url', 'user123');
            
            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('type', 'audio');
            expect(result).toHaveProperty('error');
            expect(result).toHaveProperty('metadata');
            expect(result.metadata).toHaveProperty('processingTime');
            expect(typeof result.metadata?.processingTime).toBe('number');
        });

        test('should return proper error structure for image analysis', async () => {
            const result = await mediaService.analyzeImage('invalid-url', 'user123');
            
            expect(result).toHaveProperty('success', false);
            expect(result).toHaveProperty('type', 'image');
            expect(result).toHaveProperty('error');
            expect(result).toHaveProperty('metadata');
            expect(result.metadata).toHaveProperty('processingTime');
            expect(typeof result.metadata?.processingTime).toBe('number');
        });
    });

    describe('Configuration Validation', () => {
        test('should accept custom file size limits', () => {
            const customConfig: MediaServiceConfig = {
                openaiApiKey: 'test-key',
                maxFileSize: 5 * 1024 * 1024 // 5MB
            };
            
            const service = new MediaService(mockTerminalLog, customConfig);
            expect(service.getMaxFileSize()).toBe(5 * 1024 * 1024);
        });

        test('should accept custom supported formats', () => {
            const customConfig: MediaServiceConfig = {
                openaiApiKey: 'test-key',
                supportedAudioTypes: ['audio/mpeg'],
                supportedImageTypes: ['image/jpeg']
            };
            
            const service = new MediaService(mockTerminalLog, customConfig);
            
            expect(service.isAudioSupported('audio/mpeg')).toBe(true);
            expect(service.isAudioSupported('audio/wav')).toBe(false);
            expect(service.isImageSupported('image/jpeg')).toBe(true);
            expect(service.isImageSupported('image/png')).toBe(false);
        });
    });

    describe('Processing Time Tracking', () => {
        test('should track processing time for failed operations', async () => {
            const startTime = Date.now();
            const result = await mediaService.transcribeAudio('invalid-url', 'user123');
            const endTime = Date.now();
            
            expect(result.metadata?.processingTime).toBeGreaterThan(0);
            expect(result.metadata?.processingTime).toBeLessThan(endTime - startTime + 100); // Small buffer
        });
    });
});