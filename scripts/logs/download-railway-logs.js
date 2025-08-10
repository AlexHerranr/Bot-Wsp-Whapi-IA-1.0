#!/usr/bin/env node

/**
 * Script para descargar logs de Railway y organizarlos localmente
 * Uso: node scripts/logs/download-railway-logs.js [opciones]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuración
// Nota: este archivo vive en scripts/logs/, por eso subimos dos niveles para llegar a logs/railway
const LOG_DIR = path.join(__dirname, '..', '..', 'logs', 'railway');
const MAX_CHUNKS = 10; // Máximo número de chunks a mantener

// Crear directorio si no existe
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Función para limpiar chunks antiguos
function cleanupOldChunks() {
    try {
        const files = fs.readdirSync(LOG_DIR)
            .filter(file => file.startsWith('railway-logs-') && file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: path.join(LOG_DIR, file),
                stats: fs.statSync(path.join(LOG_DIR, file))
            }))
            .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

        if (files.length > MAX_CHUNKS) {
            const filesToDelete = files.slice(MAX_CHUNKS);
            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                    console.log(`🗑️ Chunk antiguo eliminado: ${file.name}`);
                } catch (error) {
                    console.error(`Error eliminando ${file.name}:`, error.message);
                }
            });
        }
    } catch (error) {
        console.error('Error limpiando chunks antiguos:', error.message);
    }
}

// Función principal
async function downloadRailwayLogs(timeRange = '1h') {
    try {
        console.log(`📥 Descargando logs de Railway (últimas ${timeRange})...`);
        
        // Limpiar chunks antiguos
        cleanupOldChunks();
        
        // Generar nombre de archivo con timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const outputFile = path.join(LOG_DIR, `railway-logs-${timestamp}.log`);
        
        // Descargar logs usando Railway CLI con límite de líneas
        const command = process.platform === 'win32' ? 
            `railway logs --deployment | cmd /c "findstr /n ." | cmd /c "findstr /r ^1:.*$ ^2:.*$ ^3:.*$ ^4:.*$ ^5:.*$ ^6:.*$ ^7:.*$ ^8:.*$ ^9:.*$ ^[0-9][0-9]:.*$ ^[0-9][0-9][0-9]:.*$ ^[0-9][0-9][0-9][0-9]:.*$ ^[0-9][0-9][0-9][0-9][0-9]:.*$" | head -1000` :
            `railway logs --deployment | head -1000`;
            
        console.log(`🚀 Ejecutando descarga limitada de logs Railway...`);
        console.log(`⚠️  Limitando a últimas 1000 líneas para evitar timeout`);
        
        const logs = execSync('railway logs --deployment', { 
            encoding: 'utf8', 
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            timeout: 30000 // 30 seconds timeout
        });
        
        // Crear header
        const header = `
=============================
📊 Railway Logs - ${new Date().toLocaleString('es-CO')}
=============================
Rango de tiempo: ${timeRange}
Descargado: ${timestamp}
Líneas totales: ${logs.split('\n').length}
=============================

`;
        
        // Escribir archivo
        fs.writeFileSync(outputFile, header + logs);
        
        console.log(`✅ Logs descargados exitosamente:`);
        console.log(`📁 Archivo: ${outputFile}`);
        console.log(`📊 Líneas: ${logs.split('\n').length}`);
        console.log(`💾 Tamaño: ${Math.round(fs.statSync(outputFile).size / 1024)} KB`);
        
        // Buscar milestones
        const milestones = logs.split('\n').filter(line => line.includes('LOG_MILESTONE'));
        if (milestones.length > 0) {
            console.log(`🎯 Milestones encontrados: ${milestones.length}`);
            milestones.forEach(milestone => {
                const match = milestone.match(/Línea (\d+) de logs/);
                if (match) {
                    console.log(`   📈 ${match[1]} logs técnicos procesados`);
                }
            });
        }
        
        return outputFile;
        
    } catch (error) {
        console.error('❌ Error descargando logs de Railway:', error.message);
        
        if (error.message.includes('railway: command not found')) {
            console.error('💡 Instala Railway CLI: npm install -g @railway/cli');
        }
        
        throw error;
    }
}

// Función para mostrar estadísticas
function showStats() {
    try {
        const files = fs.readdirSync(LOG_DIR)
            .filter(file => file.endsWith('.log'))
            .map(file => {
                const filePath = path.join(LOG_DIR, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: Math.round(stats.size / 1024),
                    date: stats.mtime.toISOString().slice(0, 19).replace('T', ' ')
                };
            })
            .sort((a, b) => b.date > a.date ? 1 : -1);
        
        console.log('\n📊 Estadísticas de logs descargados:');
        console.log('====================================');
        files.forEach(file => {
            console.log(`📁 ${file.name}`);
            console.log(`   💾 ${file.size} KB | 📅 ${file.date}`);
        });
        console.log(`\n📈 Total archivos: ${files.length}`);
        console.log(`💾 Espacio usado: ${files.reduce((total, f) => total + f.size, 0)} KB`);
        
    } catch (error) {
        console.error('Error mostrando estadísticas:', error.message);
    }
}

// CLI
const args = process.argv.slice(2);
const command = args[0] || 'download';

switch (command) {
    case 'download':
        const timeRange = args[1] || '1h';
        downloadRailwayLogs(timeRange)
            .then(file => {
                console.log(`\n🎉 Descarga completada: ${path.basename(file)}`);
            })
            .catch(error => {
                console.error('❌ Descarga falló:', error.message);
                process.exit(1);
            });
        break;
        
    case 'stats':
        showStats();
        break;
        
    case 'help':
        console.log(`
📊 Script de Descarga de Logs Railway

Uso:
  node scripts/logs/download-railway-logs.js download [tiempo]  # Descargar logs
  node scripts/logs/download-railway-logs.js stats             # Ver estadísticas
  node scripts/logs/download-railway-logs.js help              # Ver ayuda

Ejemplos:
  node scripts/logs/download-railway-logs.js download 1h       # Última hora
  node scripts/logs/download-railway-logs.js download 6h       # Últimas 6 horas
  node scripts/logs/download-railway-logs.js download 24h      # Último día
  node scripts/logs/download-railway-logs.js stats             # Ver archivos descargados

Archivos se guardan en: logs/railway/
`);
        break;
        
    default:
        console.error(`❌ Comando desconocido: ${command}`);
        console.error('💡 Usa: node scripts/logs/download-railway-logs.js help');
        process.exit(1);
}