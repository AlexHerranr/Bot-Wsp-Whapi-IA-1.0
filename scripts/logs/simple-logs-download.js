#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📥 Descargando logs de Railway...');

// Crear directorio logs/railway si no existe (archivo vive en scripts/logs)
const logsDir = path.join(__dirname, '..', '..', 'logs', 'railway');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log('📁 Directorio logs/railway creado');
}

// Generar timestamp para el archivo
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const filename = `railway-logs-${timestamp}.log`;
const filepath = path.join(logsDir, filename);

try {
    console.log('⏳ Ejecutando railway logs --deployment...');
    
    // Comando simple y directo con limitación para evitar timeouts
    const command = 'railway logs --deployment | head -2000';
    const output = execSync(command, { 
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024, // 5MB buffer
        timeout: 30000, // 30 segundos timeout
        shell: true
    });
    
    // Guardar a archivo
    fs.writeFileSync(filepath, output);
    
    // Mostrar estadísticas
    const stats = fs.statSync(filepath);
    const sizeKB = Math.round(stats.size / 1024);
    
    console.log('✅ Descarga completada:');
    console.log(`📁 Archivo: ${filename}`);
    console.log(`💾 Tamaño: ${sizeKB} KB`);
    console.log(`📍 Ruta: ${filepath}`);
    
    // Contar líneas aproximadas
    const lines = output.split('\n').length;
    console.log(`📊 Líneas aproximadas: ${lines}`);
    
} catch (error) {
    console.error('❌ Error descargando logs:', error.message);
    
    if (error.message.includes('timeout')) {
        console.log('💡 Sugerencia: Los logs son muy extensos. Usa railway logs --deployment | head -1000 para limitar');
    }
    
    process.exit(1);
}