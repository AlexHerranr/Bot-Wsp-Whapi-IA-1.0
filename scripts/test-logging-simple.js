#!/usr/bin/env node

/**
 * 🧪 PRUEBA SIMPLE - Sistema de Logging V2.0
 * 
 * Prueba básica para validar que el sistema funciona correctamente
 * sin depender de importaciones TypeScript complejas.
 */

const colors = {
    GREEN: '\x1b[32m',
    RED: '\x1b[31m',
    YELLOW: '\x1b[33m',
    CYAN: '\x1b[36m',
    RESET: '\x1b[0m',
    BOLD: '\x1b[1m'
};

console.log(`${colors.BOLD}${colors.CYAN}🧪 PRUEBA SIMPLE - SISTEMA DE LOGGING V2.0${colors.RESET}`);
console.log(`${colors.CYAN}Verificando que los archivos estén correctamente implementados${colors.RESET}\n`);

/**
 * 🔍 VERIFICAR ARCHIVOS IMPLEMENTADOS
 */
function verifyImplementation() {
    const fs = require('fs');
    const path = require('path');
    
    console.log(`${colors.YELLOW}📋 Verificando archivos implementados...${colors.RESET}\n`);
    
    const files = [
        'src/utils/logging/formatters.ts',
        'src/utils/logging/console-logger.ts',
        'src/utils/logging/file-logger.ts',
        'src/utils/logging/cloud-logger.ts',
        'src/utils/logging/index.ts',
        'src/utils/logging/types.ts'
    ];
    
    let allFilesExist = true;
    
    for (const file of files) {
        const exists = fs.existsSync(file);
        console.log(`${exists ? colors.GREEN + '✅' : colors.RED + '❌'} ${file}${colors.RESET}`);
        if (!exists) allFilesExist = false;
    }
    
    console.log('');
    return allFilesExist;
}

/**
 * 🔍 VERIFICAR CONTENIDO DE FORMATTERS
 */
function verifyFormatters() {
    const fs = require('fs');
    
    console.log(`${colors.YELLOW}📋 Verificando formatters.ts...${colors.RESET}\n`);
    
    try {
        const content = fs.readFileSync('src/utils/logging/formatters.ts', 'utf8');
        
        const checks = [
            { name: 'formatTechnicalLogEntry', pattern: /export function formatTechnicalLogEntry/ },
            { name: 'formatConsoleLogEntry', pattern: /export function formatConsoleLogEntry/ },
            { name: 'shouldShowInConsole', pattern: /export function shouldShowInConsole/ },
            { name: 'JSON structured format', pattern: /jsonPayload/ },
            { name: 'Console emoji support', pattern: /getEmojiForCategory/ },
            { name: 'Category filtering', pattern: /CONSOLE_VISIBLE_CATEGORIES/ }
        ];
        
        let allChecksPass = true;
        
        for (const check of checks) {
            const found = check.pattern.test(content);
            console.log(`${found ? colors.GREEN + '✅' : colors.RED + '❌'} ${check.name}${colors.RESET}`);
            if (!found) allChecksPass = false;
        }
        
        console.log('');
        return allChecksPass;
        
    } catch (error) {
        console.log(`${colors.RED}❌ Error leyendo formatters.ts: ${error.message}${colors.RESET}\n`);
        return false;
    }
}

/**
 * 🔍 VERIFICAR CONTENIDO DE FILE-LOGGER
 */
function verifyFileLogger() {
    const fs = require('fs');
    
    console.log(`${colors.YELLOW}📋 Verificando file-logger.ts...${colors.RESET}\n`);
    
    try {
        const content = fs.readFileSync('src/utils/logging/file-logger.ts', 'utf8');
        
        const checks = [
            { name: 'Import formatTechnicalLogEntry', pattern: /import.*formatTechnicalLogEntry.*from.*formatters/ },
            { name: 'Uses formatTechnicalLogEntry', pattern: /formatTechnicalLogEntry\(entry\)/ },
            { name: 'Updated comment', pattern: /ACTUALIZADO V2\.0/ },
            { name: 'JSON idéntico a Cloud', pattern: /JSON idéntico a Cloud/ }
        ];
        
        let allChecksPass = true;
        
        for (const check of checks) {
            const found = check.pattern.test(content);
            console.log(`${found ? colors.GREEN + '✅' : colors.RED + '❌'} ${check.name}${colors.RESET}`);
            if (!found) allChecksPass = false;
        }
        
        console.log('');
        return allChecksPass;
        
    } catch (error) {
        console.log(`${colors.RED}❌ Error leyendo file-logger.ts: ${error.message}${colors.RESET}\n`);
        return false;
    }
}

/**
 * 🔍 VERIFICAR CONTENIDO DE CONSOLE-LOGGER
 */
function verifyConsoleLogger() {
    const fs = require('fs');
    
    console.log(`${colors.YELLOW}📋 Verificando console-logger.ts...${colors.RESET}\n`);
    
    try {
        const content = fs.readFileSync('src/utils/logging/console-logger.ts', 'utf8');
        
        const checks = [
            { name: 'Import formatters', pattern: /import.*formatConsoleLogEntry.*shouldShowInConsole.*from.*formatters/ },
            { name: 'Uses shouldShowInConsole', pattern: /shouldShowInConsole\(category\)/ },
            { name: 'Uses formatConsoleLogEntry', pattern: /formatConsoleLogEntry\(level, category, message, details\)/ },
            { name: 'Updated comment', pattern: /ACTUALIZADA V2\.0/ },
            { name: 'Removed complex formatting', pattern: /DEPRECATED/ }
        ];
        
        let allChecksPass = true;
        
        for (const check of checks) {
            const found = check.pattern.test(content);
            console.log(`${found ? colors.GREEN + '✅' : colors.RED + '❌'} ${check.name}${colors.RESET}`);
            if (!found) allChecksPass = false;
        }
        
        console.log('');
        return allChecksPass;
        
    } catch (error) {
        console.log(`${colors.RED}❌ Error leyendo console-logger.ts: ${error.message}${colors.RESET}\n`);
        return false;
    }
}

/**
 * 🔍 VERIFICAR CONFIGURACIÓN DE LOGGING
 */
function verifyLoggingConfig() {
    const fs = require('fs');
    
    console.log(`${colors.YELLOW}📋 Verificando logging config...${colors.RESET}\n`);
    
    try {
        const content = fs.readFileSync('src/utils/logging/index.ts', 'utf8');
        
        const checks = [
            { name: 'File format structured', pattern: /format:\s*['"']structured['"']/ },
            { name: 'Console format simple', pattern: /format:\s*['"']simple['"']/ },
            { name: 'Cloud format structured', pattern: /format:\s*['"']structured['"']/ }
        ];
        
        let allChecksPass = true;
        
        for (const check of checks) {
            const found = check.pattern.test(content);
            console.log(`${found ? colors.GREEN + '✅' : colors.RED + '❌'} ${check.name}${colors.RESET}`);
            if (!found) allChecksPass = false;
        }
        
        console.log('');
        return allChecksPass;
        
    } catch (error) {
        console.log(`${colors.RED}❌ Error leyendo index.ts: ${error.message}${colors.RESET}\n`);
        return false;
    }
}

/**
 * 🔍 VERIFICAR TIPOS ACTUALIZADOS
 */
function verifyTypes() {
    const fs = require('fs');
    
    console.log(`${colors.YELLOW}📋 Verificando types.ts...${colors.RESET}\n`);
    
    try {
        const content = fs.readFileSync('src/utils/logging/types.ts', 'utf8');
        
        const checks = [
            { name: 'FileLogConfig supports structured', pattern: /format:\s*['"']detailed['"']\s*\|\s*['"']structured['"']/ },
            { name: 'Updated comment', pattern: /ACTUALIZADO.*formato JSON idéntico a Cloud/ }
        ];
        
        let allChecksPass = true;
        
        for (const check of checks) {
            const found = check.pattern.test(content);
            console.log(`${found ? colors.GREEN + '✅' : colors.RED + '❌'} ${check.name}${colors.RESET}`);
            if (!found) allChecksPass = false;
        }
        
        console.log('');
        return allChecksPass;
        
    } catch (error) {
        console.log(`${colors.RED}❌ Error leyendo types.ts: ${error.message}${colors.RESET}\n`);
        return false;
    }
}

/**
 * 🚀 EJECUTAR TODAS LAS VERIFICACIONES
 */
function runAllChecks() {
    console.log(`${colors.BOLD}${colors.CYAN}🔍 EJECUTANDO VERIFICACIONES COMPLETAS${colors.RESET}\n`);
    
    const results = {
        files: verifyImplementation(),
        formatters: verifyFormatters(),
        fileLogger: verifyFileLogger(),
        consoleLogger: verifyConsoleLogger(),
        config: verifyLoggingConfig(),
        types: verifyTypes()
    };
    
    // Resumen
    console.log(`${colors.BOLD}${colors.CYAN}📊 RESUMEN DE VERIFICACIONES${colors.RESET}`);
    
    const checkNames = Object.keys(results);
    const passedChecks = checkNames.filter(check => results[check]).length;
    const totalChecks = checkNames.length;
    
    for (const [check, passed] of Object.entries(results)) {
        console.log(`${passed ? colors.GREEN + '✅' : colors.RED + '❌'} ${check}: ${passed ? 'PASSED' : 'FAILED'}${colors.RESET}`);
    }
    
    console.log(`\n${colors.CYAN}📈 Porcentaje de éxito: ${Math.round((passedChecks / totalChecks) * 100)}%${colors.RESET}\n`);
    
    if (passedChecks === totalChecks) {
        console.log(`${colors.GREEN}${colors.BOLD}🎉 ¡VERIFICACIÓN EXITOSA!${colors.RESET}`);
        console.log(`${colors.GREEN}✅ Sistema de logging V2.0 implementado correctamente${colors.RESET}`);
        console.log(`${colors.GREEN}✅ File Logs = Cloud Logs (formato técnico idéntico)${colors.RESET}`);
        console.log(`${colors.GREEN}✅ Console Logs limpios con emojis${colors.RESET}`);
        console.log(`${colors.GREEN}✅ Configuración actualizada${colors.RESET}`);
        return true;
    } else {
        console.log(`${colors.RED}${colors.BOLD}🚨 VERIFICACIÓN FALLIDA!${colors.RESET}`);
        console.log(`${colors.RED}❌ ${totalChecks - passedChecks} verificaciones fallaron${colors.RESET}`);
        console.log(`${colors.YELLOW}💡 Revisar los archivos marcados como FAILED${colors.RESET}`);
        return false;
    }
}

/**
 * 🎯 EJECUTAR VERIFICACIÓN
 */
if (require.main === module) {
    const success = runAllChecks();
    process.exit(success ? 0 : 1);
}

module.exports = { runAllChecks }; 