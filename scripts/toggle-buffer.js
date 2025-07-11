#!/usr/bin/env node

/**
 * Script para alternar el buffer de mensajes del bot
 * Facilita las pruebas de velocidad sin editar variables de entorno
 * 
 * Uso:
 *   node scripts/toggle-buffer.js [on|off|status]
 */

const fs = require('fs');
const path = require('path');

// Archivos de configuración
const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_LOCAL_FILE = path.join(__dirname, '..', '.env.local');

// Función para leer archivo .env
function readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
                env[key.trim()] = valueParts.join('=').trim();
            }
        }
    });
    
    return env;
}

// Función para escribir archivo .env
function writeEnvFile(filePath, env) {
    const lines = Object.entries(env)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    fs.writeFileSync(filePath, lines + '\n');
}

// Función para obtener estado actual
function getCurrentStatus() {
    const envLocal = readEnvFile(ENV_LOCAL_FILE);
    const envMain = readEnvFile(ENV_FILE);
    
    // Buscar la variable en ambos archivos
    const bufferDisabled = envLocal.DISABLE_MESSAGE_BUFFER || 
                          envMain.DISABLE_MESSAGE_BUFFER || 
                          process.env.DISABLE_MESSAGE_BUFFER;
    
    return {
        disabled: bufferDisabled === 'true',
        source: envLocal.DISABLE_MESSAGE_BUFFER ? '.env.local' : 
                envMain.DISABLE_MESSAGE_BUFFER ? '.env' : 
                process.env.DISABLE_MESSAGE_BUFFER ? 'system' : 'none'
    };
}

// Función para mostrar estado
function showStatus() {
    const status = getCurrentStatus();
    
    console.log('\n🔧 Estado del Buffer de Mensajes:');
    console.log('=====================================');
    
    if (status.disabled) {
        console.log('⚡ Buffer: PAUSADO (Respuesta inmediata)');
        console.log('⚠️  Modo: Prueba de velocidad activado');
        console.log('🔄 Timeout: 0ms (sin buffer)');
    } else {
        console.log('⏱️  Buffer: ACTIVO (10 segundos)');
        console.log('🔄 Timeout: 10000ms (buffer normal)');
        console.log('📊 Modo: Operación normal');
    }
    
    console.log(`📁 Fuente: ${status.source}`);
    console.log('=====================================');
    
    console.log('\n💡 Comandos disponibles:');
    console.log('   node scripts/toggle-buffer.js off  - Pausar buffer (velocidad máxima)');
    console.log('   node scripts/toggle-buffer.js on   - Activar buffer (normal)');
    console.log('   node scripts/toggle-buffer.js status - Mostrar estado actual');
    console.log('');
}

// Función para activar/desactivar buffer
function toggleBuffer(action) {
    const envFile = fs.existsSync(ENV_LOCAL_FILE) ? ENV_LOCAL_FILE : ENV_FILE;
    const env = readEnvFile(envFile);
    
    if (action === 'off') {
        env.DISABLE_MESSAGE_BUFFER = 'true';
        writeEnvFile(envFile, env);
        
        console.log('\n⚡ Buffer de mensajes PAUSADO');
        console.log('🚀 Velocidad máxima activada');
        console.log('⚠️  Recuerda: Esto es temporal para pruebas');
        console.log('🔄 Reinicia el bot para aplicar cambios');
    } else if (action === 'on') {
        delete env.DISABLE_MESSAGE_BUFFER;
        writeEnvFile(envFile, env);
        
        console.log('\n⏱️  Buffer de mensajes ACTIVADO');
        console.log('📊 Operación normal restaurada');
        console.log('🔄 Reinicia el bot para aplicar cambios');
    }
    
    console.log(`💾 Configuración guardada en: ${envFile}`);
}

// Función principal
function main() {
    const action = process.argv[2];
    
    if (!action || action === 'status') {
        showStatus();
        return;
    }
    
    if (action === 'on') {
        toggleBuffer('on');
        showStatus();
    } else if (action === 'off') {
        toggleBuffer('off');
        showStatus();
    } else {
        console.log('❌ Acción no válida. Use: on, off, o status');
        console.log('💡 Ejemplo: node scripts/toggle-buffer.js off');
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = {
    getCurrentStatus,
    toggleBuffer,
    showStatus
}; 