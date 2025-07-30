// tests/regression/buffer-timing.test.ts
import { BufferManager } from '../../src/core/state/buffer-manager';

describe('Buffer Timing Regression Tests', () => {
    let bufferManager: BufferManager;
    let mockCallback: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        mockCallback = jest.fn();
        bufferManager = new BufferManager(mockCallback);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should process buffer after 5s for normal messages', async () => {
        // Simular mensaje normal
        bufferManager.addMessage('user1', 'Hola, necesito información', 'chat1', 'Usuario Test');
        
        // No debe procesar antes de 5s
        jest.advanceTimersByTime(4999);
        expect(mockCallback).not.toHaveBeenCalled();
        
        // Debe procesar exactamente a los 5s
        jest.advanceTimersByTime(1);  // Total: 5000ms
        expect(mockCallback).toHaveBeenCalledWith('user1', 'Hola, necesito información', 'chat1', 'Usuario Test');
    });

    test('should extend buffer to 10s when typing is detected', async () => {
        // Mensaje inicial (establece timer de 5s)
        bufferManager.addMessage('user1', 'Estoy escribiendo', 'chat1', 'Usuario Test');
        
        // Simular typing a los 3s (debe cancelar timer de 5s y crear uno de 10s)
        jest.advanceTimersByTime(3000);
        bufferManager.setIntelligentTimer('user1', 'typing');
        
        // No debe procesar a los 5s originales (timer fue cancelado)
        jest.advanceTimersByTime(2000);  // Total: 5000ms desde inicio
        expect(mockCallback).not.toHaveBeenCalled();
        
        // Debe procesar exactamente 10s después del evento typing
        jest.advanceTimersByTime(10000);  // 10s completos desde el typing
        expect(mockCallback).toHaveBeenCalledWith('user1', 'Estoy escribiendo', 'chat1', 'Usuario Test');
    });

    test('should extend buffer to 10s when recording is detected', async () => {
        // Mensaje inicial (establece timer de 5s)
        bufferManager.addMessage('user1', 'Grabando audio', 'chat1', 'Usuario Test');
        
        // Simular recording a los 2s (debe cancelar timer de 5s y crear uno de 10s)
        jest.advanceTimersByTime(2000);
        bufferManager.setIntelligentTimer('user1', 'recording');
        
        // No debe procesar a los 5s originales (timer fue cancelado)
        jest.advanceTimersByTime(3000);  // Total: 5000ms desde inicio
        expect(mockCallback).not.toHaveBeenCalled();
        
        // Debe procesar exactamente 10s después del evento recording
        jest.advanceTimersByTime(10000);  // 10s completos desde el recording
        expect(mockCallback).toHaveBeenCalledWith('user1', 'Grabando audio', 'chat1', 'Usuario Test');
    });

    test('should handle multiple messages in buffer correctly', async () => {
        // Múltiples mensajes del mismo usuario
        bufferManager.addMessage('user1', 'Mensaje 1', 'chat1', 'Usuario Test');
        jest.advanceTimersByTime(1000);
        bufferManager.addMessage('user1', 'Mensaje 2', 'chat1', 'Usuario Test');
        jest.advanceTimersByTime(1000);
        bufferManager.addMessage('user1', 'Mensaje 3', 'chat1', 'Usuario Test');
        
        // Debe combinar todos los mensajes
        jest.advanceTimersByTime(3000);  // Total: 5000ms
        expect(mockCallback).toHaveBeenCalledWith('user1', 'Mensaje 1\nMensaje 2\nMensaje 3', 'chat1', 'Usuario Test');
    });
});