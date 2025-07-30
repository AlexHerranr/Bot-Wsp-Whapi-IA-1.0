/**
 * 🧪 TESTS UNITARIOS PARA SISTEMA DE LOGGING
 * 
 * Validación completa de todas las categorías de logging,
 * filtros, agregación y funcionalidad del sistema.
 */

const assert = require('assert');
const sinon = require('sinon');
const { describe, it, beforeEach, afterEach } = require('mocha');

// Importar módulos a testear
const { cloudLog } = require('../../src/utils/logging/cloud-logger');
const { 
    shouldLog, 
    applyContextualFilters, 
    checkUserSpecificFilters, 
    LogFilterMetrics 
} = require('../../src/utils/logging/log-filters');
const { LogAggregator } = require('../../src/utils/logging/log-aggregator');
const { 
    logMessageReceived,
    logMessageProcess,
    logWhatsAppSend,
    logWhatsAppChunksComplete,
    logOpenAIRequest,
    logOpenAIResponse,
    logFunctionCallingStart,
    logFunctionExecuting,
    logFunctionHandler,
    logBeds24Request,
    logBeds24ApiCall,
    logBeds24ResponseDetail,
    logBeds24Processing,
    logThreadCreated,
    logThreadPersist,
    logThreadCleanup,
    logServerStart,
    logBotReady
} = require('../../src/utils/logging/index');

describe('🧪 Sistema de Logging - Tests Unitarios', () => {
    let consoleLogStub;
    let originalEnv;
    
    beforeEach(() => {
        // Mock console.log para capturar logs
        consoleLogStub = sinon.stub(console, 'log');
        
        // Guardar variables de entorno originales
        originalEnv = { ...process.env };
        
        // Resetear métricas
        LogFilterMetrics.reset();
    });
    
    afterEach(() => {
        // Restaurar console.log
        consoleLogStub.restore();
        
        // Restaurar variables de entorno
        process.env = originalEnv;
    });

    describe('📝 Categorías de Logging - Mensajes y Comunicación', () => {
        it('✅ logMessageReceived debe generar log correcto', () => {
            const testMessage = 'Mensaje de prueba recibido';
            const testDetails = {
                userId: '573001234567',
                messageType: 'text',
                chatId: '573001234567@s.whatsapp.net',
                messageLength: 25
            };
            
            logMessageReceived(testMessage, testDetails);
            
            // Verificar que console.log fue llamado
            assert(consoleLogStub.calledOnce, 'console.log debería ser llamado una vez');
            
            // Verificar estructura del log
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.message, '[MESSAGE_RECEIVED] ' + testMessage);
            assert.strictEqual(logData.jsonPayload.category, 'MESSAGE_RECEIVED');
            assert.strictEqual(logData.jsonPayload.userId, testDetails.userId);
            assert.strictEqual(logData.jsonPayload.messageInfo.messageType, testDetails.messageType);
            assert.strictEqual(logData.labels.messageFlow, 'true');
            assert.strictEqual(logData.labels.component, 'messaging');
        });

        it('✅ logMessageProcess debe incluir información de agrupación', () => {
            const testMessage = 'Procesando mensajes agrupados';
            const testDetails = {
                userId: '573001234567',
                messageCount: 3,
                totalLength: 150
            };
            
            logMessageProcess(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'MESSAGE_PROCESS');
            assert.strictEqual(logData.jsonPayload.messageInfo.messageLength, testDetails.totalLength);
            assert.strictEqual(logData.labels.messageFlow, 'true');
        });

        it('✅ logWhatsAppSend debe registrar envío exitoso', () => {
            const testMessage = 'Mensaje enviado exitosamente';
            const testDetails = {
                userId: '573001234567',
                chatId: '573001234567@s.whatsapp.net',
                messageId: 'wamid.test123',
                chunks: 1
            };
            
            logWhatsAppSend(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'WHATSAPP_SEND');
            assert.strictEqual(logData.jsonPayload.messageInfo.chunks, testDetails.chunks);
            assert.strictEqual(logData.labels.whatsappAPI, 'true');
        });

        it('✅ logWhatsAppChunksComplete debe registrar chunks múltiples', () => {
            const testMessage = 'Todos los párrafos enviados exitosamente';
            const testDetails = {
                userId: '573001234567',
                totalChunks: 3,
                totalLength: 450
            };
            
            logWhatsAppChunksComplete(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'WHATSAPP_CHUNKS_COMPLETE');
            assert.strictEqual(logData.jsonPayload.messageInfo.chunks, testDetails.totalChunks);
            assert.strictEqual(logData.labels.whatsappAPI, 'true');
        });
    });

    describe('🤖 Categorías de Logging - OpenAI y Funciones', () => {
        it('✅ logOpenAIRequest debe incluir información de estado', () => {
            const testMessage = 'Enviando request a OpenAI';
            const testDetails = {
                userId: '573001234567',
                threadId: 'thread_test123',
                state: 'adding_message',
                requestType: 'message'
            };
            
            logOpenAIRequest(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'OPENAI_REQUEST');
            assert.strictEqual(logData.jsonPayload.openaiInfo.threadId, testDetails.threadId);
            assert.strictEqual(logData.jsonPayload.openaiInfo.state, testDetails.state);
            assert.strictEqual(logData.labels.aiProcessing, 'true');
        });

        it('✅ logOpenAIResponse debe registrar respuesta exitosa', () => {
            const testMessage = 'Respuesta recibida de OpenAI';
            const testDetails = {
                userId: '573001234567',
                threadId: 'thread_test123',
                runId: 'run_test456',
                responsePreview: 'Hola, ¿cómo puedo ayudarte?'
            };
            
            logOpenAIResponse(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'OPENAI_RESPONSE');
            assert.strictEqual(logData.jsonPayload.openaiInfo.runId, testDetails.runId);
            assert.strictEqual(logData.labels.aiProcessing, 'true');
        });

        it('✅ logFunctionCallingStart debe registrar inicio de función', () => {
            const testMessage = 'OpenAI requiere ejecutar función';
            const testDetails = {
                userId: '573001234567',
                threadId: 'thread_test123',
                runId: 'run_test456',
                toolCallsCount: 1
            };
            
            logFunctionCallingStart(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'FUNCTION_CALLING_START');
            assert.strictEqual(logData.labels.functionCalling, 'true');
        });

        it('✅ logFunctionExecuting debe incluir nombre de función', () => {
            const testMessage = 'Ejecutando función check_availability';
            const testDetails = {
                userId: '573001234567',
                functionName: 'check_availability',
                arguments: {
                    startDate: '2025-01-15',
                    endDate: '2025-01-20'
                }
            };
            
            logFunctionExecuting(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'FUNCTION_EXECUTING');
            assert.strictEqual(logData.jsonPayload.openaiInfo.functionName, testDetails.functionName);
            assert.strictEqual(logData.labels.functionCalling, 'true');
        });

        it('✅ logFunctionHandler debe procesar resultado de función', () => {
            const testMessage = 'Función ejecutada exitosamente';
            const testDetails = {
                functionName: 'check_availability',
                result: 'Disponibilidad encontrada',
                duration: 1250
            };
            
            logFunctionHandler(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'FUNCTION_HANDLER');
            assert.strictEqual(logData.jsonPayload.duration, testDetails.duration);
            assert.strictEqual(logData.labels.functionCalling, 'true');
        });
    });

    describe('🏨 Categorías de Logging - Integración Beds24', () => {
        it('✅ logBeds24Request debe registrar solicitud de disponibilidad', () => {
            const testMessage = 'Consultando disponibilidad en Beds24';
            const testDetails = {
                startDate: '2025-01-15',
                endDate: '2025-01-20',
                requestType: 'availability'
            };
            
            logBeds24Request(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'BEDS24_REQUEST');
            assert.strictEqual(logData.jsonPayload.beds24Info.startDate, testDetails.startDate);
            assert.strictEqual(logData.jsonPayload.beds24Info.endDate, testDetails.endDate);
            assert.strictEqual(logData.labels.beds24Integration, 'true');
        });

        it('✅ logBeds24ApiCall debe incluir información de endpoint', () => {
            const testMessage = 'Llamada a API Beds24';
            const testDetails = {
                method: 'POST',
                endpoint: '/api/v1/availability',
                propertyId: 12345
            };
            
            logBeds24ApiCall(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'BEDS24_API_CALL');
            assert.strictEqual(logData.jsonPayload.beds24Info.method, testDetails.method);
            assert.strictEqual(logData.jsonPayload.beds24Info.endpoint, testDetails.endpoint);
            assert.strictEqual(logData.labels.beds24Integration, 'true');
        });

        it('✅ logBeds24ResponseDetail debe procesar respuesta completa', () => {
            const testMessage = 'Respuesta detallada de Beds24';
            const testDetails = {
                status: 200,
                dataCount: 5,
                responseTime: 850
            };
            
            logBeds24ResponseDetail(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'BEDS24_RESPONSE_DETAIL');
            assert.strictEqual(logData.jsonPayload.responseTime, testDetails.responseTime);
            assert.strictEqual(logData.labels.beds24Integration, 'true');
        });

        it('✅ logBeds24Processing debe registrar etapa de procesamiento', () => {
            const testMessage = 'Procesando datos de disponibilidad';
            const testDetails = {
                processingStage: 'data_parsing',
                recordsProcessed: 10
            };
            
            logBeds24Processing(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'BEDS24_PROCESSING');
            assert.strictEqual(logData.labels.beds24Integration, 'true');
        });
    });

    describe('🧵 Categorías de Logging - Sistema y Threads', () => {
        it('✅ logThreadCreated debe registrar creación de thread', () => {
            const testMessage = 'Nuevo thread creado';
            const testDetails = {
                userId: '573001234567',
                threadId: 'thread_test123',
                userName: 'Usuario Test',
                environment: 'development'
            };
            
            logThreadCreated(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'THREAD_CREATED');
            assert.strictEqual(logData.jsonPayload.threadInfo.threadId, testDetails.threadId);
            assert.strictEqual(logData.labels.threadManagement, 'true');
        });

        it('✅ logThreadPersist debe registrar persistencia', () => {
            const testMessage = 'Threads guardados exitosamente';
            const testDetails = {
                threadsCount: 5,
                source: 'save_operation'
            };
            
            logThreadPersist(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'THREAD_PERSIST');
            assert.strictEqual(logData.labels.threadManagement, 'true');
        });

        it('✅ logThreadCleanup debe registrar limpieza', () => {
            const testMessage = 'Limpieza de threads completada';
            const testDetails = {
                operation: 'cleanup_all',
                threadsDeleted: 3,
                success: true
            };
            
            logThreadCleanup(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'THREAD_CLEANUP');
            assert.strictEqual(logData.labels.threadManagement, 'true');
        });

        it('✅ logServerStart debe registrar inicio del servidor', () => {
            const testMessage = 'Servidor HTTP iniciado';
            const testDetails = {
                host: 'localhost',
                port: 3000,
                environment: 'development'
            };
            
            logServerStart(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'SERVER_START');
            assert.strictEqual(logData.labels.component, 'system');
        });

        it('✅ logBotReady debe registrar bot listo', () => {
            const testMessage = 'Bot completamente inicializado';
            const testDetails = {
                environment: 'development',
                port: 3000
            };
            
            logBotReady(testMessage, testDetails);
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'BOT_READY');
            assert.strictEqual(logData.labels.component, 'system');
        });
    });

    describe('🎛️ Sistema de Filtros', () => {
        it('✅ shouldLog debe respetar niveles mínimos por categoría', () => {
            // DEBUG en MESSAGE_RECEIVED (requiere INFO) - debe fallar
            assert.strictEqual(shouldLog('DEBUG', 'MESSAGE_RECEIVED', 'development'), false);
            
            // INFO en MESSAGE_RECEIVED - debe pasar
            assert.strictEqual(shouldLog('INFO', 'MESSAGE_RECEIVED', 'development'), true);
            
            // ERROR siempre debe pasar
            assert.strictEqual(shouldLog('ERROR', 'ANY_CATEGORY', 'production'), true);
        });

        it('✅ shouldLog debe filtrar por entorno', () => {
            // En producción, nivel global mínimo es INFO
            assert.strictEqual(shouldLog('DEBUG', 'SOME_CATEGORY', 'production'), false);
            assert.strictEqual(shouldLog('INFO', 'SOME_CATEGORY', 'production'), true);
            
            // En desarrollo, nivel global mínimo es DEBUG
            assert.strictEqual(shouldLog('DEBUG', 'SOME_CATEGORY', 'development'), true);
        });

        it('✅ applyContextualFilters debe filtrar contenido largo en producción', () => {
            const longDetails = { body: 'a'.repeat(1500) };
            
            // En producción, logs largos solo si no son DEBUG
            assert.strictEqual(applyContextualFilters('DEBUG', 'SOME_CATEGORY', longDetails, 'production'), false);
            assert.strictEqual(applyContextualFilters('INFO', 'SOME_CATEGORY', longDetails, 'production'), true);
            
            // En desarrollo, permitir todos
            assert.strictEqual(applyContextualFilters('DEBUG', 'SOME_CATEGORY', longDetails, 'development'), true);
        });

        it('✅ checkUserSpecificFilters debe aplicar filtros de usuario', () => {
            // Usuario sin filtros específicos - debe pasar
            assert.strictEqual(checkUserSpecificFilters('normal_user', 'INFO', 'SOME_CATEGORY'), true);
            
            // Usuario debug configurado - debe pasar todo
            assert.strictEqual(checkUserSpecificFilters('debug_user', 'DEBUG', 'SOME_CATEGORY'), true);
        });

        it('✅ LogFilterMetrics debe registrar estadísticas', () => {
            LogFilterMetrics.reset();
            
            // Registrar algunas métricas
            LogFilterMetrics.recordTotal();
            LogFilterMetrics.recordTotal();
            LogFilterMetrics.recordFiltered('MESSAGE_RECEIVED', 'level-filter');
            
            const stats = LogFilterMetrics.getStats();
            
            assert.strictEqual(stats.totalLogs, 2);
            assert.strictEqual(stats.filteredLogs, 1);
            assert.strictEqual(stats.filteredPercentage, '50.00');
            assert.strictEqual(stats.filteredByCategory['MESSAGE_RECEIVED:level-filter'], 1);
        });
    });

    describe('📊 Sistema de Agregación', () => {
        let aggregator;
        let emittedLogs;

        beforeEach(() => {
            emittedLogs = [];
            aggregator = new LogAggregator((logString) => {
                emittedLogs.push(JSON.parse(logString));
            });
        });

        it('✅ debe agregar logs similares', (done) => {
            const entry1 = {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                category: 'MESSAGE_RECEIVED',
                message: 'Mensaje recibido del usuario',
                details: { userId: 'user1' },
                environment: 'development'
            };

            const entry2 = {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                category: 'MESSAGE_RECEIVED',
                message: 'Mensaje recibido del usuario',
                details: { userId: 'user2' },
                environment: 'development'
            };

            aggregator.addLog(entry1);
            aggregator.addLog(entry2);

            // Forzar flush después de un breve delay
            setTimeout(() => {
                aggregator.forceFlush();
                
                // Debe haber emitido un log agregado
                assert.strictEqual(emittedLogs.length, 1);
                
                const aggregatedLog = emittedLogs[0];
                assert(aggregatedLog.message.includes('×2 occurrences'));
                assert.strictEqual(aggregatedLog.jsonPayload.aggregation.count, 2);
                assert.strictEqual(aggregatedLog.jsonPayload.aggregation.isAggregated, true);
                
                done();
            }, 100);
        });

        it('✅ debe emitir logs de alta prioridad directamente', (done) => {
            const errorEntry = {
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                category: 'SYSTEM_ERROR',
                message: 'Error crítico del sistema',
                details: { error: 'Test error' },
                environment: 'production'
            };

            aggregator.addLog(errorEntry);

            setTimeout(() => {
                aggregator.forceFlush();
                
                // Los errores deben emitirse inmediatamente
                assert.strictEqual(emittedLogs.length, 1);
                
                const errorLog = emittedLogs[0];
                assert.strictEqual(errorLog.jsonPayload.aggregation.count, 1);
                assert.strictEqual(errorLog.jsonPayload.aggregation.isAggregated, false);
                
                done();
            }, 100);
        });

        it('✅ debe calcular métricas de agregación', () => {
            const entry = {
                timestamp: new Date().toISOString(),
                level: 'INFO',
                category: 'TEST_CATEGORY',
                message: 'Test message',
                details: { userId: 'user1' },
                environment: 'development'
            };

            aggregator.addLog(entry);
            
            const stats = aggregator.getStats();
            
            assert.strictEqual(stats.bufferSize, 1);
            assert.strictEqual(stats.isFlushInProgress, false);
            assert.strictEqual(stats.aggregatedEntries.length, 1);
            assert.strictEqual(stats.aggregatedEntries[0].category, 'TEST_CATEGORY');
        });
    });

    describe('🔧 Integración Completa', () => {
        it('✅ debe procesar log completo con filtros y agregación', () => {
            // Configurar entorno de producción
            process.env.K_SERVICE = 'test-service';
            
            const testMessage = 'Test integration message';
            const testDetails = {
                userId: '573001234567',
                messageType: 'text'
            };
            
            // Esto debe pasar por filtros y agregación
            logMessageReceived(testMessage, testDetails);
            
            // Verificar que se registraron métricas
            const stats = LogFilterMetrics.getStats();
            assert(stats.totalLogs > 0, 'Debe registrar logs totales');
        });

        it('✅ debe manejar errores en logging sin fallar', () => {
            // Test con datos malformados
            assert.doesNotThrow(() => {
                cloudLog('INFO', 'TEST_CATEGORY', 'Test message', {
                    circularRef: {}
                });
            });
        });

        it('✅ debe validar categorías de logging', () => {
            // Categoría inválida debe usar 'OTHER'
            cloudLog('INFO', 'INVALID_CATEGORY', 'Test message', {});
            
            const logCall = consoleLogStub.getCall(0);
            const logData = JSON.parse(logCall.args[0]);
            
            assert.strictEqual(logData.jsonPayload.category, 'OTHER');
        });
    });

    describe('📈 Métricas de Rendimiento', () => {
        it('✅ debe medir tiempo de ejecución de logging', () => {
            const start = Date.now();
            
            for (let i = 0; i < 100; i++) {
                logMessageReceived(`Test message ${i}`, { userId: `user${i}` });
            }
            
            const duration = Date.now() - start;
            
            // 100 logs no deben tomar más de 1 segundo
            assert(duration < 1000, `Logging demasiado lento: ${duration}ms`);
        });

        it('✅ debe manejar volumen alto de logs', () => {
            const logCount = 1000;
            
            assert.doesNotThrow(() => {
                for (let i = 0; i < logCount; i++) {
                    cloudLog('INFO', 'MESSAGE_RECEIVED', `High volume test ${i}`, {
                        userId: `user${i % 10}` // 10 usuarios diferentes
                    });
                }
            });
            
            // Verificar métricas
            const stats = LogFilterMetrics.getStats();
            assert(stats.totalLogs >= logCount, 'Debe registrar todos los logs');
        });
    });
});

/**
 * 🏃 EJECUTAR TESTS
 * 
 * Para ejecutar estos tests:
 * 1. npm install --save-dev mocha sinon
 * 2. npm test
 * 
 * O ejecutar específicamente:
 * npx mocha tests/logging/test-logging-system.js
 */ 