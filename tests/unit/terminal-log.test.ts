// tests/unit/terminal-log.test.ts
import { TerminalLog, IDashboard, StartupConfig } from '../../src/core/utils/terminal-log';

describe('🧪 TerminalLog System', () => {
    let terminalLog: TerminalLog;
    let mockDashboard: jest.Mocked<IDashboard>;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        mockDashboard = {
            addLog: jest.fn()
        };
        
        const config: StartupConfig = {
            host: 'localhost',
            port: 3008,
            webhookUrl: 'https://example.com/webhook',
            showFunctionLogs: true
        };

        terminalLog = new TerminalLog(mockDashboard, config);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'clear').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Core Logging Methods (1-8)', () => {
        test('1. message() should log user messages with truncation', () => {
            const longText = 'A'.repeat(100);
            terminalLog.message('TestUser', longText);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('👤 TestUser: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA..."')
            );
            expect(mockDashboard.addLog).toHaveBeenCalled();
        });

        test('2. typing() should log typing status', () => {
            terminalLog.typing('TestUser');
            expect(consoleLogSpy).toHaveBeenCalledWith('✍️ TestUser está escribiendo...');
        });

        test('3. processing() should be silent (no logs)', () => {
            terminalLog.processing('TestUser');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        test('4. response() should log OpenAI responses with duration', () => {
            terminalLog.response('TestUser', 'Response text', 2500);
            
            expect(consoleLogSpy).toHaveBeenCalledWith('🤖 OpenAI → TestUser (2.5s)');
            expect(mockDashboard.addLog).toHaveBeenCalled();
        });

        test('5. error() should log errors', () => {
            terminalLog.error('Test error message');
            expect(consoleLogSpy).toHaveBeenCalledWith('❌ Error: Test error message');
        });

        test('6. openaiError() should log OpenAI errors', () => {
            terminalLog.openaiError('TestUser', 'Rate limit exceeded');
            expect(consoleLogSpy).toHaveBeenCalledWith('❌ Error enviar a OpenAI → TestUser: Rate limit exceeded');
        });

        test('7. imageError() should log image processing errors', () => {
            terminalLog.imageError('TestUser', 'Invalid format');
            expect(consoleLogSpy).toHaveBeenCalledWith('❌ Error al procesar imagen → TestUser: Invalid format');
        });

        test('8. voiceError() should log voice processing errors', () => {
            terminalLog.voiceError('TestUser', 'Transcription failed');
            expect(consoleLogSpy).toHaveBeenCalledWith('❌ Error al procesar audio → TestUser: Transcription failed');
        });
    });

    describe('Error and Function Methods (9-12)', () => {
        test('9. functionError() should log function errors', () => {
            terminalLog.functionError('check_availability', 'Missing parameters');
            expect(consoleLogSpy).toHaveBeenCalledWith('❌ Error en función check_availability: Missing parameters');
        });

        test('10. whapiError() should log WHAPI errors', () => {
            terminalLog.whapiError('sendMessage', 'Network timeout');
            expect(consoleLogSpy).toHaveBeenCalledWith('❌ Error WHAPI (sendMessage): Network timeout');
        });

        test('11. functionStart() should log function starts with special handling for check_availability', () => {
            const args = { startDate: '2025-01-15', endDate: '2025-01-20' };
            terminalLog.functionStart('check_availability', args);
            
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('⚙️ check_availability(01/15-01/20, 5 noches)')
            );
        });

        test('11b. functionStart() should respect SHOW_FUNCTION_LOGS toggle', () => {
            const configWithoutLogs: StartupConfig = { showFunctionLogs: false };
            const terminalLogNoFunc = new TerminalLog(mockDashboard, configWithoutLogs);
            
            terminalLogNoFunc.functionStart('test_function');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        test('12. functionProgress() should be eliminated (no logs)', () => {
            terminalLog.functionProgress('test', 'step1');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('System and Media Methods (13-16)', () => {
        test('13. startup() should clear console and show startup info', () => {
            terminalLog.startup();
            
            expect(console.clear).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith('\n=== Bot TeAlquilamos Iniciado ===');
            expect(consoleLogSpy).toHaveBeenCalledWith('🚀 Servidor: localhost:3008');
            expect(consoleLogSpy).toHaveBeenCalledWith('🔗 Webhook: https://example.com/webhook');
            expect(consoleLogSpy).toHaveBeenCalledWith('✅ Sistema listo\n');
        });

        test('14. newConversation() should log new conversation', () => {
            terminalLog.newConversation('TestUser');
            expect(consoleLogSpy).toHaveBeenCalledWith('\n📨 Nueva conversación con TestUser');
        });

        test('15. image() should log image received', () => {
            terminalLog.image('TestUser');
            expect(consoleLogSpy).toHaveBeenCalledWith('📷 TestUser: [Imagen recibida]');
        });

        test('16. voice() should log voice message', () => {
            terminalLog.voice('TestUser');
            
            expect(consoleLogSpy).toHaveBeenCalledWith('🎤 TestUser: [Nota de voz recibida]');
            expect(mockDashboard.addLog).toHaveBeenCalled();
        });
    });

    describe('Final Methods (17-20)', () => {
        test('17. recording() should log recording status', () => {
            terminalLog.recording('TestUser');
            expect(consoleLogSpy).toHaveBeenCalledWith('🎙️ TestUser está grabando...');
        });

        test('18. availabilityResult() should log search results', () => {
            terminalLog.availabilityResult(3, 2, 1500);
            
            expect(consoleLogSpy).toHaveBeenCalledWith('🏠 3 completas + 2 alternativas (1.5s)');
            expect(mockDashboard.addLog).toHaveBeenCalled();
        });

        test('19. info() should log information messages', () => {
            terminalLog.info('System information');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('ℹ️ System information')
            );
        });

        test('20. debug() should log debug messages only in development', () => {
            // Test with DEBUG enabled
            const originalEnv = process.env.DEBUG;
            process.env.DEBUG = 'true';
            
            terminalLog.debug('Debug information');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('🐛 DEBUG: Debug information')
            );
            
            // Restore
            process.env.DEBUG = originalEnv;
        });
    });

    describe('Additional Methods', () => {
        test('externalApi() should log external API calls', () => {
            terminalLog.externalApi('OpenAI', 'createCompletion', 'success');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('🔗 [')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('OpenAI → createCompletion → success')
            );
        });

        test('warning() should log warnings', () => {
            terminalLog.warning('This is a warning');
            expect(consoleLogSpy).toHaveBeenCalledWith('⚠️ Advertencia: This is a warning');
        });

        test('getStats() should return configuration stats', () => {
            const stats = terminalLog.getStats();
            
            expect(stats.showFunctionLogs).toBe(true);
            expect(stats.config.host).toBe('localhost');
            expect(stats.config.port).toBe(3008);
        });
    });

    describe('Edge Cases', () => {
        test('should handle short messages without truncation', () => {
            terminalLog.message('User', 'Hi');
            expect(consoleLogSpy).toHaveBeenCalledWith('👤 User: "Hi"');
        });

        test('should handle availabilityResult() with single items', () => {
            terminalLog.availabilityResult(1, 1);
            expect(consoleLogSpy).toHaveBeenCalledWith('🏠 1 completa + 1 alternativa');
        });

        test('should handle functionStart() with regular functions', () => {
            terminalLog.functionStart('regular_function');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                expect.stringContaining('⚙️ regular_function()')
            );
        });

        test('debug() should not log when DEBUG is false', () => {
            const originalEnv = process.env.DEBUG;
            const originalNodeEnv = process.env.NODE_ENV;
            
            process.env.DEBUG = 'false';
            process.env.NODE_ENV = 'production';
            
            terminalLog.debug('Should not appear');
            expect(consoleLogSpy).not.toHaveBeenCalledWith(
                expect.stringContaining('DEBUG')
            );
            
            // Restore
            process.env.DEBUG = originalEnv;
            process.env.NODE_ENV = originalNodeEnv;
        });
    });
});