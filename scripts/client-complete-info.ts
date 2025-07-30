// scripts/client-complete-info.ts
// Vista completa y simplificada de toda la información de clientes

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getCompleteClientInfo() {
    try {
        await prisma.$connect();
        console.log('👥 INFORMACIÓN COMPLETA DE CLIENTES');
        console.log('===================================\n');

        const users = await prisma.user.findMany({
            include: {
                threads: {
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            },
            orderBy: { lastActivity: 'desc' }
        });

        const now = new Date();
        
        // RESUMEN EJECUTIVO
        console.log('📊 RESUMEN EJECUTIVO:');
        console.log(`   👥 Total Clientes: ${users.length}`);
        
        let nuevos = 0, activos = 0, inactivos = 0;
        users.forEach(user => {
            const totalMessages = user.threads.reduce((sum, t) => sum + t.messages.length, 0);
            const daysSinceActivity = Math.floor((now.getTime() - user.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
            
            if (totalMessages === 0) nuevos++;
            else if (daysSinceActivity <= 1) activos++;
            else inactivos++;
        });
        
        console.log(`   🆕 Nuevos (sin mensajes): ${nuevos}`);
        console.log(`   🔥 Activos (último día): ${activos}`);
        console.log(`   😴 Inactivos: ${inactivos}\n`);

        // INFORMACIÓN DETALLADA POR CLIENTE
        console.log('📋 INFORMACIÓN DETALLADA POR CLIENTE:');
        console.log('====================================\n');

        const clientsData = [];

        users.forEach((user, index) => {
            const thread = user.threads[0]; // Thread más reciente
            const allMessages = user.threads.flatMap(t => t.messages);
            const lastMessage = allMessages[0];
            const userMessages = allMessages.filter(m => m.role === 'user');
            const botMessages = allMessages.filter(m => m.role === 'assistant');
            const daysSinceActivity = Math.floor((now.getTime() - user.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
            
            // Determinar estado
            let estado = '';
            let prioridad = '';
            let accionSugerida = '';
            
            if (allMessages.length === 0) {
                estado = '🆕 Nuevo';
                prioridad = '⚡ Alta';
                accionSugerida = 'Dar bienvenida personalizada';
            } else if (daysSinceActivity <= 1) {
                estado = '🔥 Activo';
                prioridad = '⚡ Alta';
                accionSugerida = 'Responder normalmente';
            } else if (daysSinceActivity <= 7) {
                estado = '💎 Potencial';
                prioridad = '📊 Media';
                accionSugerida = 'Hacer seguimiento proactivo';
            } else {
                estado = '😴 Inactivo';
                prioridad = '🔻 Baja';
                accionSugerida = 'Reactivar con oferta especial';
            }
            
            console.log(`${index + 1}. 📱 CLIENTE: ${user.phoneNumber}`);
            console.log(`   ═══════════════════════════════════════════════`);
            console.log(`   👤 INFORMACIÓN BÁSICA:`);
            console.log(`      Nombre: ${user.name || 'Sin nombre'}`);
            console.log(`      ID Sistema: ${user.id}`);
            console.log(`      Teléfono: ${user.phoneNumber}`);
            console.log(`      Chat ID: ${thread?.chatId || user.phoneNumber}`);
            
            console.log(`\n   📅 FECHAS IMPORTANTES:`);
            console.log(`      Registro: ${user.createdAt.toLocaleString('es-CO')}`);
            console.log(`      Última Actividad: ${user.lastActivity.toLocaleString('es-CO')}`);
            console.log(`      Días sin Actividad: ${daysSinceActivity}`);
            
            console.log(`\n   💬 CONVERSACIONES:`);
            console.log(`      Thread ID: ${thread?.openaiId || 'Sin thread'}`);
            console.log(`      Total Threads: ${user.threads.length}`);
            console.log(`      Creado: ${thread?.createdAt.toLocaleString('es-CO') || 'N/A'}`);
            console.log(`      Última Actividad Thread: ${thread?.lastActivity.toLocaleString('es-CO') || 'N/A'}`);
            
            console.log(`\n   📝 MENSAJES:`);
            console.log(`      Total Mensajes: ${allMessages.length}`);
            console.log(`      Mensajes Usuario: ${userMessages.length}`);
            console.log(`      Mensajes Bot: ${botMessages.length}`);
            console.log(`      Último Mensaje: "${lastMessage?.content.substring(0, 80) || 'Sin mensajes'}${lastMessage && lastMessage.content.length > 80 ? '...' : ''}"`);
            console.log(`      Fecha Último Mensaje: ${lastMessage?.createdAt.toLocaleString('es-CO') || 'N/A'}`);
            console.log(`      Tipo Último: ${lastMessage?.role === 'user' ? '👤 Usuario' : lastMessage?.role === 'assistant' ? '🤖 Bot' : 'N/A'}`);
            
            console.log(`\n   🏷️ ETIQUETAS Y CLASIFICACIÓN:`);
            const labels = (thread?.labels as string[]) || [];
            console.log(`      Labels: ${labels.length > 0 ? labels.join(', ') : 'Sin etiquetas'}`);
            console.log(`      Estado: ${estado}`);
            console.log(`      Es Nuevo: ${allMessages.length === 0 ? '✅ Sí' : '❌ No'}`);
            console.log(`      Es Activo Hoy: ${daysSinceActivity <= 1 ? '✅ Sí' : '❌ No'}`);
            console.log(`      Necesita Seguimiento: ${daysSinceActivity > 3 && allMessages.length > 0 ? '⚠️ SÍ' : '✅ No'}`);
            
            console.log(`\n   🎯 RECOMENDACIONES PARA EL SISTEMA:`);
            console.log(`      Prioridad de Respuesta: ${prioridad}`);
            console.log(`      Acción Sugerida: ${accionSugerida}`);
            console.log(`      Tiempo Respuesta Sugerido: ${prioridad.includes('Alta') ? 'Inmediato (< 5 min)' : prioridad.includes('Media') ? 'Rápido (< 30 min)' : 'Normal (< 2 horas)'}`);
            
            // Metadata técnica si existe
            if (thread?.metadata) {
                console.log(`\n   🔧 METADATA TÉCNICA:`);
                console.log(`      ${JSON.stringify(thread.metadata, null, 6)}`);
            }
            
            console.log(`\n${'═'.repeat(60)}\n`);
            
            // Guardar para CSV
            clientsData.push({
                'Teléfono': user.phoneNumber,
                'Nombre': user.name || 'Sin nombre',
                'ID Sistema': user.id,
                'Chat ID': thread?.chatId || user.phoneNumber,
                'Thread ID': thread?.openaiId || 'Sin thread',
                'Fecha Registro': user.createdAt.toLocaleDateString('es-CO'),
                'Última Actividad': user.lastActivity.toLocaleDateString('es-CO'),
                'Días sin Actividad': daysSinceActivity,
                'Estado': estado.replace(/[🆕🔥💎😴]/g, '').trim(),
                'Total Mensajes': allMessages.length,
                'Mensajes Usuario': userMessages.length,
                'Mensajes Bot': botMessages.length,
                'Último Mensaje': lastMessage?.content.substring(0, 100) || 'Sin mensajes',
                'Fecha Último Mensaje': lastMessage?.createdAt.toLocaleDateString('es-CO') || 'N/A',
                'Tipo Último': lastMessage?.role || 'N/A',
                'Labels': labels.join(', '),
                'Prioridad': prioridad.replace(/[⚡📊🔻]/g, '').trim(),
                'Acción Sugerida': accionSugerida,
                'Necesita Seguimiento': daysSinceActivity > 3 && allMessages.length > 0 ? 'Sí' : 'No'
            });
        });
        
        // EXPORTAR A CSV
        await exportToCSV(clientsData);
        
        console.log('\n🎯 CONCLUSIONES Y RECOMENDACIONES:');
        console.log('==================================');
        console.log('✅ Esta vista te muestra TODA la información relevante de cada cliente');
        console.log('✅ Incluye datos para seguimiento comercial Y técnico');
        console.log('✅ El sistema puede usar esta info para personalizar respuestas');
        console.log('✅ Exportado a CSV para análisis en Excel/Sheets');
        console.log('✅ También visible en Prisma Studio (http://localhost:5555)');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

async function exportToCSV(data: any[]) {
    const fs = require('fs');
    const path = require('path');
    
    const exportDir = './exports';
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir);
    }
    
    if (data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(',')
        )
    ].join('\n');
    
    const filename = path.join(exportDir, 'informacion-completa-clientes.csv');
    fs.writeFileSync(filename, csvContent, 'utf8');
    
    console.log(`\n📊 ARCHIVO CSV EXPORTADO:`);
    console.log(`   📁 ${filename}`);
    console.log(`   💡 Ábrelo en Excel/Google Sheets para análisis`);
}

// Ejecutar
if (require.main === module) {
    getCompleteClientInfo();
}

export { getCompleteClientInfo };