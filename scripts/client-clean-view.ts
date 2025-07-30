// scripts/client-clean-view.ts
// Vista limpia con solo los datos REALMENTE importantes

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getCleanClientView() {
    try {
        await prisma.$connect();
        console.log('👥 VISTA LIMPIA DE CLIENTES - SOLO DATOS RELEVANTES');
        console.log('==================================================\n');

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
        console.log('📊 RESUMEN:');
        console.log(`   👥 Total Clientes: ${users.length}`);
        
        let nuevos = 0, activos = 0, inactivos = 0;
        users.forEach(user => {
            const totalMessages = user.threads.reduce((sum, t) => sum + t.messages.length, 0);
            const daysSinceActivity = Math.floor((now.getTime() - user.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
            
            if (totalMessages === 0) nuevos++;
            else if (daysSinceActivity <= 1) activos++;
            else inactivos++;
        });
        
        console.log(`   🆕 Nuevos: ${nuevos} | 🔥 Activos: ${activos} | 😴 Inactivos: ${inactivos}\n`);

        // DATOS LIMPIOS POR CLIENTE
        console.log('📋 INFORMACIÓN ESENCIAL POR CLIENTE:');
        console.log('====================================\n');

        const cleanData = [];

        users.forEach((user, index) => {
            const allMessages = user.threads.flatMap(t => t.messages);
            const lastMessage = allMessages[0];
            const userMessages = allMessages.filter(m => m.role === 'user');
            const botMessages = allMessages.filter(m => m.role === 'assistant');
            const daysSinceActivity = Math.floor((now.getTime() - user.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
            
            // Determinar estado simple
            let estado = '';
            let prioridad = '';
            
            if (allMessages.length === 0) {
                estado = 'Nuevo';
                prioridad = 'Alta';
            } else if (daysSinceActivity <= 1) {
                estado = 'Activo';
                prioridad = 'Alta';
            } else if (daysSinceActivity <= 7) {
                estado = 'Potencial';
                prioridad = 'Media';
            } else {
                estado = 'Inactivo';
                prioridad = 'Baja';
            }
            
            // Extraer solo el número de teléfono limpio
            const telefonoLimpio = user.phoneNumber.replace('@s.whatsapp.net', '');
            
            console.log(`${index + 1}. 📱 ${telefonoLimpio}`);
            console.log(`   👤 Nombre: ${user.name && user.name !== user.phoneNumber ? user.name : 'Sin nombre'}`);
            console.log(`   📅 Registro: ${user.createdAt.toLocaleDateString('es-CO')}`);
            console.log(`   ⏰ Última vez: ${user.lastActivity.toLocaleDateString('es-CO')} ${user.lastActivity.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`);
            console.log(`   📊 Estado: ${estado} (${daysSinceActivity} días sin actividad)`);
            console.log(`   💬 Mensajes: ${allMessages.length} total (👤${userMessages.length} + 🤖${botMessages.length})`);
            
            if (lastMessage) {
                const tipoIcon = lastMessage.role === 'user' ? '👤' : '🤖';
                const preview = lastMessage.content.length > 60 ? 
                    lastMessage.content.substring(0, 60) + '...' : 
                    lastMessage.content;
                console.log(`   💬 Último: ${tipoIcon} "${preview}"`);
                console.log(`   📅 Cuándo: ${lastMessage.createdAt.toLocaleDateString('es-CO')} ${lastMessage.createdAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`);
            } else {
                console.log(`   💬 Último: Sin mensajes aún`);
            }
            
            console.log(`   🎯 Prioridad: ${prioridad}`);
            console.log(`   ⚠️ Seguimiento: ${daysSinceActivity > 3 && allMessages.length > 0 ? 'Necesario' : 'No necesario'}`);
            
            // Labels si existen
            const thread = user.threads[0];
            const labels = (thread?.labels as string[]) || [];
            if (labels.length > 0) {
                console.log(`   🏷️ Etiquetas: ${labels.join(', ')}`);
            }
            
            console.log('   ' + '─'.repeat(50));
            console.log('');
            
            // Guardar para CSV limpio
            cleanData.push({
                'Teléfono': telefonoLimpio,
                'Nombre': user.name && user.name !== user.phoneNumber ? user.name : '',
                'Registro': user.createdAt.toLocaleDateString('es-CO'),
                'Última Actividad': user.lastActivity.toLocaleDateString('es-CO'),
                'Días Sin Actividad': daysSinceActivity,
                'Estado': estado,
                'Total Mensajes': allMessages.length,
                'Mensajes Usuario': userMessages.length,
                'Mensajes Bot': botMessages.length,
                'Último Mensaje': lastMessage ? lastMessage.content.substring(0, 100) : '',
                'Tipo Último': lastMessage ? (lastMessage.role === 'user' ? 'Usuario' : 'Bot') : '',
                'Fecha Último Mensaje': lastMessage ? lastMessage.createdAt.toLocaleDateString('es-CO') : '',
                'Prioridad': prioridad,
                'Necesita Seguimiento': daysSinceActivity > 3 && allMessages.length > 0 ? 'Sí' : 'No',
                'Etiquetas': labels.join(', ')
            });
        });
        
        // EXPORTAR CSV LIMPIO
        await exportCleanCSV(cleanData);
        
        console.log('\n🎯 DATOS OPTIMIZADOS:');
        console.log('====================');
        console.log('✅ Eliminados: IDs técnicos irrelevantes');
        console.log('✅ Teléfonos: Solo números limpios');
        console.log('✅ Fechas: Formato legible');
        console.log('✅ Estados: Simplificados y claros');
        console.log('✅ Mensajes: Resumen útil');
        console.log('✅ CSV: Solo datos comercialmente relevantes');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

async function exportCleanCSV(data: any[]) {
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
    
    const filename = path.join(exportDir, 'clientes-limpio.csv');
    fs.writeFileSync(filename, csvContent, 'utf8');
    
    console.log(`\n📊 CSV LIMPIO EXPORTADO:`);
    console.log(`   📁 ${filename}`);
    console.log(`   💡 Solo datos comercialmente útiles - perfecto para Excel`);
}

// Ejecutar
if (require.main === module) {
    getCleanClientView();
}

export { getCleanClientView };