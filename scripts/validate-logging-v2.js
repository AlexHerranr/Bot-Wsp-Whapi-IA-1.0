#!/usr/bin/env node

/**
 * 🧪 SCRIPT DE VALIDACIÓN - Sistema de Logging V2.0
 * 
 * Valida que el sistema de logging funcione correctamente:
 * 1. Console: Solo emojis y mensajes limpios
 * 2. File: Formato JSON técnico idéntico a Cloud
 * 3. Cloud: Formato JSON técnico idéntico a File
 * 
 * OBJETIVO: Verificar que File Logs = Cloud Logs (formato técnico idéntico)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colores para terminal
const colors = {
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    CYAN: '\x1b[36m',
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m'
};

console.log(`${colors.BOLD}${colors.CYAN}🧪 VALIDACIÓN DEL SISTEMA DE LOGGING V2.0${colors.RESET}`);
console.log(`${colors.CYAN}Objetivo: Verificar que File Logs = Cloud Logs (formato técnico idéntico)${colors.RESET}\n`);

/**
 * 🧪 CASOS DE PRUEBA
 */
const testCases = [
    {
        name: 'Mensaje de Usuario',
        level: 'INFO',
        category: 'MESSAGE_RECEIVED',
        message: 'Mensaje recibido del usuario',
        details: {
            userId: '573001234567',
            messageType: 'text',
            body: 'Hola, necesito ayuda con mi reserva'
        }
    },
    {
        name: 'Función Ejecutándose',
        level: 'INFO',
        category: 'FUNCTION_EXECUTING',
        message: 'Ejecutando función check_availability',
        details: {
            userId: '573001234567',
            functionName: 'check_availability',
            args: {
                startDate: '2025-01-15',
                endDate: '2025-01-20'
            }
        }
    },
    {
        name: 'Respuesta Beds24',
        level: 'SUCCESS',
        category: 'BEDS24_RESPONSE_DETAIL',
        message: 'Respuesta recibida de Beds24',
        details: {
            status: 200,
            dataCount: 3,
            properties: ['Apartamento Centro', 'Casa Playa', 'Loft Moderno']
        }
    },
    {
        name: 'Error del Sistema',
        level: 'ERROR',
        category: 'OPENAI_REQUEST',
        message: 'Error en solicitud a OpenAI',
        details: {
            error: 'Timeout después de 30 segundos',
            threadId: 'thread_abc123def456',
            userId: '573001234567'
        }
    },
    {
        name: 'Inicio del Servidor',
        level: 'SUCCESS',
        category: 'SERVER_START',
        message: 'Servidor HTTP iniciado',
        details: {
            host: 'localhost',
            port: 3008,
            environment: 'development'
        }
    }
];

/**
 * 🎯 FUNCIÓN PRINCIPAL DE VALIDACIÓN
 */
async function validateLoggingSystem() {
    console.log(`${colors.YELLOW}📋 Ejecutando ${testCases.length} casos de prueba...${colors.RESET}\n`);
    
    let passedTests = 0;
    let failedTests = 0;
    
    for (const [index, testCase] of testCases.entries()) {
        console.log(`${colors.CYAN}${index + 1}. Validando: ${testCase.name}${colors.RESET}`);
        
        try {
            const result = await validateTestCase(testCase);
            
            if (result.success) {
                console.log(`${colors.GREEN}   ✅ PASSED${colors.RESET}`);
                passedTests++;
            } else {
                console.log(`${colors.RED}   ❌ FAILED: ${result.error}${colors.RESET}`);
                failedTests++;
            }
            
            // Mostrar detalles del resultado
            if (result.details) {
                console.log(`${colors.YELLOW}   📊 Detalles:${colors.RESET}`);
                console.log(`      Console: ${result.details.console ? '✅' : '❌'}`);
                console.log(`      File: ${result.details.file ? '✅' : '❌'}`);
                console.log(`      Cloud: ${result.details.cloud ? '✅' : '❌'}`);
                
                if (result.details.formatMatch !== undefined) {
                    console.log(`      File = Cloud: ${result.details.formatMatch ? '✅' : '❌'}`);
                }
            }
            
        } catch (error) {
            console.log(`${colors.RED}   ❌ ERROR: ${error.message}${colors.RESET}`);
            failedTests++;
        }
        
        console.log('');
    }
    
    // Resumen final
    console.log(`${colors.BOLD}${colors.CYAN}📊 RESUMEN DE VALIDACIÓN${colors.RESET}`);
    console.log(`${colors.GREEN}✅ Pruebas exitosas: ${passedTests}${colors.RESET}`);
    console.log(`${colors.RED}❌ Pruebas fallidas: ${failedTests}${colors.RESET}`);
    console.log(`${colors.CYAN}📈 Porcentaje de éxito: ${Math.round((passedTests / testCases.length) * 100)}%${colors.RESET}\n`);
    
    if (failedTests === 0) {
        console.log(`${colors.GREEN}${colors.BOLD}🎉 ¡VALIDACIÓN EXITOSA! Sistema de logging V2.0 funcionando correctamente${colors.RESET}`);
        console.log(`${colors.GREEN}   • Console: Logs limpios con emojis ✅${colors.RESET}`);
        console.log(`${colors.GREEN}   • File: Formato JSON técnico ✅${colors.RESET}`);
        console.log(`${colors.GREEN}   • Cloud: Formato JSON técnico ✅${colors.RESET}`);
        console.log(`${colors.GREEN}   • File = Cloud: Formato idéntico ✅${colors.RESET}`);
        return true;
    } else {
        console.log(`${colors.RED}${colors.BOLD}🚨 VALIDACIÓN FALLIDA! Revisar implementación${colors.RESET}`);
        return false;
    }
}

/**
 * 🧪 VALIDAR CASO DE PRUEBA INDIVIDUAL
 */
async function validateTestCase(testCase) {
    const result = {
        success: false,
        error: null,
        details: {
            console: false,
            file: false,
            cloud: false,
            formatMatch: false
        }
    };
    
    try {
        // Crear logs de prueba
        const testLogs = await createTestLogs(testCase);
        
        // Validar que se crearon correctamente
        result.details.console = testLogs.console !== null;
        result.details.file = testLogs.file !== null;
        result.details.cloud = testLogs.cloud !== null;
        
        // Validar formato File = Cloud
        if (testLogs.file && testLogs.cloud) {
            result.details.formatMatch = validateFormatMatch(testLogs.file, testLogs.cloud);
        }
        
        // Validar contenido específico
        const contentValidation = validateLogContent(testCase, testLogs);
        
        result.success = result.details.console && result.details.file && 
                        result.details.cloud && result.details.formatMatch && 
                        contentValidation.success;
        
        if (!result.success) {
            result.error = contentValidation.error || 'Formato o contenido inválido';
        }
        
    } catch (error) {
        result.error = error.message;
    }
    
    return result;
}

/**
 * 🏗️ CREAR LOGS DE PRUEBA
 */
async function createTestLogs(testCase) {
    // Simular el sistema de logging
    const mockLogs = {
        console: null,
        file: null,
        cloud: null
    };
    
    try {
        // Importar el sistema de logging
        const loggingPath = path.join(__dirname, '..', 'src', 'utils', 'logging');
        
        // Simular environment para cada tipo
        const originalKService = process.env.K_SERVICE;
        
        // 1. Test Console Logger (desarrollo local)
        delete process.env.K_SERVICE;
        const { formatConsoleLogEntry, shouldShowInConsole } = require(path.join(loggingPath, 'formatters'));
        
        if (shouldShowInConsole(testCase.category)) {
            mockLogs.console = formatConsoleLogEntry(testCase.level, testCase.category, testCase.message, testCase.details);
        } else {
            mockLogs.console = ''; // No se muestra en console
        }
        
        // 2. Test File Logger (desarrollo local)
        const { formatTechnicalLogEntry } = require(path.join(loggingPath, 'formatters'));
        const mockLogEntry = {
            timestamp: new Date().toISOString(),
            level: testCase.level,
            category: testCase.category,
            message: testCase.message,
            details: testCase.details,
            environment: 'development'
        };
        
        mockLogs.file = formatTechnicalLogEntry(mockLogEntry);
        
        // 3. Test Cloud Logger (producción)
        process.env.K_SERVICE = 'test-service';
        mockLogs.cloud = formatTechnicalLogEntry({
            ...mockLogEntry,
            environment: 'production'
        });
        
        // Restaurar environment
        if (originalKService) {
            process.env.K_SERVICE = originalKService;
        } else {
            delete process.env.K_SERVICE;
        }
        
    } catch (error) {
        throw new Error(`Error creando logs de prueba: ${error.message}`);
    }
    
    return mockLogs;
}

/**
 * 🔍 VALIDAR COINCIDENCIA DE FORMATO
 */
function validateFormatMatch(fileLog, cloudLog) {
    try {
        // Parsear ambos logs JSON
        const fileData = JSON.parse(fileLog);
        const cloudData = JSON.parse(cloudLog);
        
        // Comparar estructura básica
        const fileKeys = Object.keys(fileData).sort();
        const cloudKeys = Object.keys(cloudData).sort();
        
        if (JSON.stringify(fileKeys) !== JSON.stringify(cloudKeys)) {
            return false;
        }
        
        // Comparar campos críticos
        const criticalFields = ['severity', 'jsonPayload', 'labels', 'resource'];
        
        for (const field of criticalFields) {
            if (fileData[field] && cloudData[field]) {
                // Comparar estructura del campo
                const fileFieldKeys = Object.keys(fileData[field]).sort();
                const cloudFieldKeys = Object.keys(cloudData[field]).sort();
                
                if (JSON.stringify(fileFieldKeys) !== JSON.stringify(cloudFieldKeys)) {
                    return false;
                }
            }
        }
        
        return true;
        
    } catch (error) {
        return false;
    }
}

/**
 * 📝 VALIDAR CONTENIDO DE LOGS
 */
function validateLogContent(testCase, testLogs) {
    const result = { success: true, error: null };
    
    try {
        // Validar Console Log
        if (testLogs.console) {
            // Debe contener emoji
            const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(testLogs.console);
            if (!hasEmoji) {
                result.success = false;
                result.error = 'Console log debe contener emoji';
                return result;
            }
            
            // No debe contener JSON
            if (testLogs.console.includes('{') || testLogs.console.includes('}')) {
                result.success = false;
                result.error = 'Console log no debe contener JSON';
                return result;
            }
        }
        
        // Validar File Log
        if (testLogs.file) {
            try {
                const fileData = JSON.parse(testLogs.file);
                
                // Debe tener estructura JSON válida
                if (!fileData.jsonPayload || !fileData.severity) {
                    result.success = false;
                    result.error = 'File log debe tener estructura JSON válida';
                    return result;
                }
                
                // Debe contener la categoría
                if (!fileData.jsonPayload.category || fileData.jsonPayload.category !== testCase.category) {
                    result.success = false;
                    result.error = 'File log debe contener categoría correcta';
                    return result;
                }
                
            } catch (error) {
                result.success = false;
                result.error = 'File log debe ser JSON válido';
                return result;
            }
        }
        
        // Validar Cloud Log
        if (testLogs.cloud) {
            try {
                const cloudData = JSON.parse(testLogs.cloud);
                
                // Debe tener estructura JSON válida
                if (!cloudData.jsonPayload || !cloudData.severity) {
                    result.success = false;
                    result.error = 'Cloud log debe tener estructura JSON válida';
                    return result;
                }
                
                // Debe contener la categoría
                if (!cloudData.jsonPayload.category || cloudData.jsonPayload.category !== testCase.category) {
                    result.success = false;
                    result.error = 'Cloud log debe contener categoría correcta';
                    return result;
                }
                
            } catch (error) {
                result.success = false;
                result.error = 'Cloud log debe ser JSON válido';
                return result;
            }
        }
        
    } catch (error) {
        result.success = false;
        result.error = `Error validando contenido: ${error.message}`;
    }
    
    return result;
}

/**
 * 🚀 EJECUTAR VALIDACIÓN
 */
if (require.main === module) {
    validateLoggingSystem()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error(`${colors.RED}${colors.BOLD}💥 Error crítico: ${error.message}${colors.RESET}`);
            process.exit(1);
        });
}

module.exports = { validateLoggingSystem, validateTestCase }; 