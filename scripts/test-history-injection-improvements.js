/**
 * 🧪 Script de Pruebas: Mejoras en Sistema de Inyección de Historial
 * 
 * Valida las mejoras implementadas:
 * 1. Inyección selectiva y condicional
 * 2. Compresión de historial largo
 * 3. Cache de inyección para evitar duplicados
 * 4. Logging detallado
 */

const { injectHistory, getCacheStats, cleanupExpiredCaches } = require('../src/utils/context/historyInjection.ts');

// Mock de dependencias
const mockThreadPersistence = {
    getThread: jest.fn(),
    setThread: jest.fn()
};

const mockGuestMemory = {
    syncIfNeeded: jest.fn(),
    getProfile: jest.fn()
};

const mockGetChatHistory = jest.fn();

// Mock de logging
const mockLogInfo = jest.fn();
const mockLogSuccess = jest.fn();
const mockLogWarning = jest.fn();
const mockLogError = jest.fn();

// Mock de OpenAI client
const mockOpenAIClient = {
    beta: {
        threads: {
            messages: {
                create: jest.fn()
            }
        }
    }
};

// Configurar mocks
jest.mock('../src/utils/persistence/threadPersistence.ts', () => ({
    threadPersistence: mockThreadPersistence
}));

jest.mock('../src/utils/persistence/index.ts', () => ({
    guestMemory: mockGuestMemory
}));

jest.mock('../src/utils/whapi/index.ts', () => ({
    getChatHistory: mockGetChatHistory
}));

jest.mock('../src/utils/logging/index.ts', () => ({
    logInfo: mockLogInfo,
    logSuccess: mockLogSuccess,
    logWarning: mockLogWarning,
    logError: mockLogError,
    logContextTokens: jest.fn()
}));

describe('🔧 Mejoras en Sistema de Inyección de Historial', () => {
    
    beforeEach(() => {
        // Limpiar todos los mocks
        jest.clearAllMocks();
        
        // Configurar mocks por defecto
        mockThreadPersistence.getThread.mockReturnValue(null);
        mockGuestMemory.getProfile.mockReturnValue({
            whapiLabels: [{ name: 'Cliente Premium' }, { name: 'Interesado' }]
        });
        mockGetChatHistory.mockResolvedValue('Historial de prueba\nMensaje 1\nMensaje 2');
        mockOpenAIClient.beta.threads.messages.create.mockResolvedValue({ id: 'msg_123' });
    });
    
    describe('✅ Test 1: Inyección Selectiva para Threads Nuevos', () => {
        test('Debería inyectar historial completo para thread nuevo', async () => {
            const result = await injectHistory(
                'thread_123',
                'user@whatsapp.net',
                'chat_456',
                true, // isNewThread
                undefined,
                'req_789'
            );
            
            expect(result.success).toBe(true);
            expect(result.reason).toBe('new_thread_history');
            expect(result.tokensUsed).toBeGreaterThan(0);
            expect(result.historyLines).toBeGreaterThan(0);
            expect(result.labelsCount).toBe(2);
            
            // Verificar que se llamó a getChatHistory
            expect(mockGetChatHistory).toHaveBeenCalledWith('chat_456', 50);
            
            // Verificar logging
            expect(mockLogInfo).toHaveBeenCalledWith(
                'INJECTION_CHECK_NEW_THREAD',
                expect.any(String),
                expect.objectContaining({
                    userId: 'user',
                    threadId: 'thread_123'
                })
            );
        });
    });
    
    describe('✅ Test 2: Skip Inyección para Threads Existentes', () => {
        test('Debería saltar inyección para thread con actividad reciente', async () => {
            // Mock thread con actividad reciente
            mockThreadPersistence.getThread.mockReturnValue({
                threadId: 'thread_123',
                lastActivity: new Date().toISOString(),
                chatId: 'chat_456',
                userName: 'Usuario Test'
            });
            
            const result = await injectHistory(
                'thread_123',
                'user@whatsapp.net',
                'chat_456',
                false, // isNewThread
                { needsInjection: false, matchPercentage: 0, reason: 'no_context_needed' },
                'req_789'
            );
            
            expect(result.success).toBe(true);
            expect(result.reason).toBe('thread_exists_no_context_needed');
            expect(result.tokensUsed).toBe(0);
            
            // Verificar que NO se llamó a getChatHistory
            expect(mockGetChatHistory).not.toHaveBeenCalled();
            
            // Verificar logging de skip
            expect(mockLogInfo).toHaveBeenCalledWith(
                'HISTORY_INJECTION_SKIP',
                expect.any(String),
                expect.objectContaining({
                    userId: 'user',
                    threadId: 'thread_123'
                })
            );
        });
    });
    
    describe('✅ Test 3: Compresión de Historial Largo', () => {
        test('Debería comprimir historial cuando excede el umbral', async () => {
            // Mock historial largo
            const longHistory = Array.from({ length: 80 }, (_, i) => `Mensaje ${i + 1}`).join('\n');
            mockGetChatHistory.mockResolvedValue(longHistory);
            
            const result = await injectHistory(
                'thread_123',
                'user@whatsapp.net',
                'chat_456',
                true, // isNewThread
                undefined,
                'req_789'
            );
            
            expect(result.success).toBe(true);
            expect(result.reason).toBe('new_thread_history');
            
            // Verificar que se loggeó la compresión
            expect(mockLogInfo).toHaveBeenCalledWith(
                'HISTORY_COMPRESSED',
                expect.any(String),
                expect.objectContaining({
                    userId: 'user',
                    originalLines: 80,
                    compressedLines: expect.any(Number)
                })
            );
        });
    });
    
    describe('✅ Test 4: Cache de Inyección', () => {
        test('Debería evitar inyección duplicada usando cache', async () => {
            // Primera inyección
            const result1 = await injectHistory(
                'thread_123',
                'user@whatsapp.net',
                'chat_456',
                true,
                undefined,
                'req_789'
            );
            
            expect(result1.success).toBe(true);
            expect(result1.reason).toBe('new_thread_history');
            
            // Segunda inyección inmediata (debería usar cache)
            const result2 = await injectHistory(
                'thread_123',
                'user@whatsapp.net',
                'chat_456',
                false,
                { needsInjection: true, matchPercentage: 80, reason: 'context_needed' },
                'req_790'
            );
            
            expect(result2.success).toBe(true);
            expect(result2.reason).toBe('recently_injected');
            expect(result2.tokensUsed).toBe(0);
            
            // Verificar logging de cache
            expect(mockLogInfo).toHaveBeenCalledWith(
                'INJECTION_CHECK_CACHED',
                expect.any(String),
                expect.objectContaining({
                    userId: 'user',
                    threadId: 'thread_123'
                })
            );
        });
    });
    
    describe('✅ Test 5: Manejo de Errores', () => {
        test('Debería manejar errores en getChatHistory', async () => {
            mockGetChatHistory.mockRejectedValue(new Error('API Error'));
            
            const result = await injectHistory(
                'thread_123',
                'user@whatsapp.net',
                'chat_456',
                true,
                undefined,
                'req_789'
            );
            
            expect(result.success).toBe(false);
            expect(result.reason).toContain('error: API Error');
            expect(result.tokensUsed).toBe(0);
            
            // Verificar logging de error
            expect(mockLogError).toHaveBeenCalledWith(
                'HISTORY_INJECTION_ERROR',
                expect.any(String),
                expect.objectContaining({
                    userId: 'user',
                    threadId: 'thread_123',
                    error: 'API Error'
                })
            );
        });
    });
    
    describe('✅ Test 6: Estadísticas de Cache', () => {
        test('Debería retornar estadísticas válidas del cache', () => {
            const stats = getCacheStats();
            
            expect(stats).toHaveProperty('historyCache');
            expect(stats).toHaveProperty('contextCache');
            expect(stats).toHaveProperty('injectionCache');
            
            expect(stats.historyCache).toHaveProperty('size');
            expect(stats.historyCache).toHaveProperty('ttlMinutes');
            expect(stats.contextCache).toHaveProperty('size');
            expect(stats.contextCache).toHaveProperty('ttlMinutes');
            expect(stats.injectionCache).toHaveProperty('size');
            expect(stats.injectionCache).toHaveProperty('ttlMinutes');
        });
    });
    
    describe('✅ Test 7: Cleanup de Caches', () => {
        test('Debería limpiar caches expirados sin errores', () => {
            expect(() => {
                cleanupExpiredCaches();
            }).not.toThrow();
            
            // Verificar que se ejecutó sin errores
            expect(mockLogInfo).toHaveBeenCalledWith(
                'CACHE_CLEANUP',
                expect.any(String),
                expect.objectContaining({
                    historyExpired: expect.any(Number),
                    contextExpired: expect.any(Number)
                })
            );
        });
    });
    
    describe('✅ Test 8: Inyección Condicional de Contexto', () => {
        test('Debería inyectar contexto relevante para threads existentes cuando sea necesario', async () => {
            // Mock thread existente sin actividad reciente
            mockThreadPersistence.getThread.mockReturnValue({
                threadId: 'thread_123',
                lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
                chatId: 'chat_456',
                userName: 'Usuario Test'
            });
            
            const result = await injectHistory(
                'thread_123',
                'user@whatsapp.net',
                'chat_456',
                false, // isNewThread
                { needsInjection: true, matchPercentage: 75, reason: 'context_needed' },
                'req_789'
            );
            
            expect(result.success).toBe(true);
            expect(result.reason).toBe('conditional_context');
            expect(result.tokensUsed).toBeGreaterThan(0);
            
            // Verificar logging de inyección condicional
            expect(mockLogSuccess).toHaveBeenCalledWith(
                'HISTORY_INJECTION_CONDITIONAL',
                expect.any(String),
                expect.objectContaining({
                    userId: 'user',
                    threadId: 'thread_123',
                    matchPercentage: 75,
                    reason: 'context_needed'
                })
            );
        });
    });
});

// Función para ejecutar pruebas manuales
async function runManualTests() {
    console.log('🧪 Ejecutando pruebas manuales de inyección de historial...\n');
    
    try {
        // Test 1: Estadísticas iniciales
        console.log('📊 Estadísticas iniciales del cache:');
        const initialStats = getCacheStats();
        console.log(JSON.stringify(initialStats, null, 2));
        
        // Test 2: Cleanup de caches
        console.log('\n🧹 Ejecutando cleanup de caches...');
        cleanupExpiredCaches();
        console.log('✅ Cleanup completado');
        
        // Test 3: Estadísticas después del cleanup
        console.log('\n📊 Estadísticas después del cleanup:');
        const finalStats = getCacheStats();
        console.log(JSON.stringify(finalStats, null, 2));
        
        console.log('\n✅ Todas las pruebas manuales completadas exitosamente');
        
    } catch (error) {
        console.error('❌ Error en pruebas manuales:', error.message);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    runManualTests();
}

module.exports = {
    runManualTests
}; 