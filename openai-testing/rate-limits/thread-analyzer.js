import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno desde la raíz del proyecto
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// Configurar cliente OpenAI
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function analyzeThreads() {
    console.log('🔍 Analizando Threads Existentes...\n');
    
    try {
        // Leer threads desde tu persistencia
        const threadsPath = path.join(__dirname, '..', '..', 'data', 'threads.json');
        
        if (!fs.existsSync(threadsPath)) {
            console.log('❌ No se encontró archivo de threads en:', threadsPath);
            console.log('💡 Verifica que el bot haya guardado threads en data/threads.json');
            return null;
        }

        const threadsData = JSON.parse(fs.readFileSync(threadsPath, 'utf8'));
        
        const analysis = {
            timestamp: new Date().toISOString(),
            totalThreads: Object.keys(threadsData).length,
            threads: [],
            summary: {
                totalMessages: 0,
                totalEstimatedTokens: 0,
                averageTokensPerThread: 0,
                heaviestThread: null,
                oldestThread: null,
                mostActiveThread: null
            }
        };

        console.log(`📊 Analizando ${analysis.totalThreads} threads...\n`);

        for (const [userId, threadInfo] of Object.entries(threadsData)) {
            try {
                console.log(`🔍 Analizando thread de ${threadInfo.userName || userId}...`);
                
                // Obtener mensajes del thread
                const messages = await client.beta.threads.messages.list(
                    threadInfo.threadId,
                    { limit: 100 }
                );

                // Estimar tokens por mensaje
                let estimatedTokens = 0;
                let userMessages = 0;
                let assistantMessages = 0;
                let totalChars = 0;

                messages.data.forEach(msg => {
                    if (msg.content[0]?.type === 'text') {
                        const text = msg.content[0].text.value;
                        const chars = text.length;
                        totalChars += chars;
                        
                        // Estimación: ~4 caracteres por token
                        estimatedTokens += Math.ceil(chars / 4);
                        
                        if (msg.role === 'user') {
                            userMessages++;
                        } else if (msg.role === 'assistant') {
                            assistantMessages++;
                        }
                    }
                });

                // Calcular antigüedad
                const createdAt = new Date(threadInfo.createdAt);
                const lastActivity = new Date(threadInfo.lastActivity);
                const daysSinceCreated = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
                const daysSinceLastActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

                const threadAnalysis = {
                    userId,
                    userName: threadInfo.userName || 'Unknown',
                    threadId: threadInfo.threadId,
                    messageCount: messages.data.length,
                    userMessages,
                    assistantMessages,
                    estimatedTokens,
                    totalChars,
                    averageTokensPerMessage: Math.round(estimatedTokens / messages.data.length),
                    createdAt: threadInfo.createdAt,
                    lastActivity: threadInfo.lastActivity,
                    daysSinceCreated,
                    daysSinceLastActivity,
                    status: daysSinceLastActivity > 7 ? 'INACTIVE' : 
                            daysSinceLastActivity > 3 ? 'LOW_ACTIVITY' : 'ACTIVE'
                };

                analysis.threads.push(threadAnalysis);
                analysis.summary.totalMessages += messages.data.length;
                analysis.summary.totalEstimatedTokens += estimatedTokens;

                console.log(`   📝 ${messages.data.length} mensajes, ~${estimatedTokens} tokens, ${threadAnalysis.status}`);

                // Pequeña pausa para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error(`❌ Error analizando thread ${threadInfo.threadId}:`, error.message);
                
                // Agregar thread con error
                analysis.threads.push({
                    userId,
                    userName: threadInfo.userName || 'Unknown',
                    threadId: threadInfo.threadId,
                    error: error.message,
                    status: 'ERROR'
                });
            }
        }

        // Calcular estadísticas finales
        const validThreads = analysis.threads.filter(t => !t.error);
        
        if (validThreads.length > 0) {
            analysis.summary.averageTokensPerThread = Math.round(
                analysis.summary.totalEstimatedTokens / validThreads.length
            );

            // Encontrar threads destacados
            analysis.summary.heaviestThread = validThreads.reduce((max, thread) => 
                thread.estimatedTokens > (max?.estimatedTokens || 0) ? thread : max
            );

            analysis.summary.oldestThread = validThreads.reduce((oldest, thread) => 
                new Date(thread.createdAt) < new Date(oldest?.createdAt || Date.now()) ? thread : oldest
            );

            analysis.summary.mostActiveThread = validThreads.reduce((most, thread) => 
                thread.messageCount > (most?.messageCount || 0) ? thread : most
            );
        }

        // Mostrar resumen
        console.log('\n📊 RESUMEN DEL ANÁLISIS:');
        console.log('========================');
        console.log(`📱 Total threads: ${analysis.totalThreads}`);
        console.log(`📝 Total mensajes: ${analysis.summary.totalMessages}`);
        console.log(`🔢 Tokens estimados totales: ${analysis.summary.totalEstimatedTokens.toLocaleString()}`);
        console.log(`📊 Promedio por thread: ${analysis.summary.averageTokensPerThread.toLocaleString()} tokens`);
        console.log('');

        // Threads por estado
        const statusCounts = {};
        analysis.threads.forEach(t => {
            statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        });

        console.log('📈 ESTADO DE THREADS:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            const emoji = getStatusEmoji(status);
            console.log(`   ${emoji} ${status}: ${count} threads`);
        });
        console.log('');

        // Threads destacados
        if (analysis.summary.heaviestThread) {
            console.log('🏆 THREADS DESTACADOS:');
            console.log(`   🔥 Más pesado: ${analysis.summary.heaviestThread.userName} (${analysis.summary.heaviestThread.estimatedTokens.toLocaleString()} tokens)`);
            console.log(`   📅 Más antiguo: ${analysis.summary.oldestThread.userName} (${analysis.summary.oldestThread.daysSinceCreated} días)`);
            console.log(`   💬 Más activo: ${analysis.summary.mostActiveThread.userName} (${analysis.summary.mostActiveThread.messageCount} mensajes)`);
            console.log('');
        }

        // Recomendaciones
        console.log('💡 RECOMENDACIONES:');
        const inactiveThreads = analysis.threads.filter(t => t.status === 'INACTIVE').length;
        const heavyThreads = analysis.threads.filter(t => t.estimatedTokens > 10000).length;

        if (inactiveThreads > 0) {
            console.log(`   🧹 Considera limpiar ${inactiveThreads} threads inactivos (>7 días)`);
        }
        if (heavyThreads > 0) {
            console.log(`   ⚖️  ${heavyThreads} threads consumen muchos tokens (>10k cada uno)`);
        }
        if (analysis.summary.averageTokensPerThread > 5000) {
            console.log('   📉 Promedio de tokens por thread es alto, considera optimizar contexto');
        }
        if (analysis.summary.totalEstimatedTokens > 100000) {
            console.log('   🚨 Uso total de tokens muy alto, revisa estrategia de persistencia');
        }

        // Guardar análisis completo
        const resultsPath = path.join(__dirname, '..', 'results', 'thread-analysis.json');
        fs.writeFileSync(resultsPath, JSON.stringify(analysis, null, 2));
        
        console.log(`\n💾 Análisis completo guardado en: ${resultsPath}`);

        return analysis;

    } catch (error) {
        console.error('❌ Error en análisis de threads:', error.message);
        
        // Guardar error
        const errorInfo = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };
        
        const errorPath = path.join(__dirname, '..', 'results', 'thread-analysis-error.json');
        fs.writeFileSync(errorPath, JSON.stringify(errorInfo, null, 2));
        
        return null;
    }
}

function getStatusEmoji(status) {
    switch (status) {
        case 'ACTIVE': return '🟢';
        case 'LOW_ACTIVITY': return '🟡';
        case 'INACTIVE': return '🔴';
        case 'ERROR': return '❌';
        default: return '❓';
    }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    analyzeThreads();
}

export default analyzeThreads; 