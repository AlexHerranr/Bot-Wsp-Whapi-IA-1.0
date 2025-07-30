// scripts/sync-google-sheets.ts
// Script para sincronizar datos con Google Sheets

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SheetData {
    users: any[];
    messages: any[];
    stats: any;
}

async function exportToGoogleSheets() {
    console.log('📊 PREPARANDO DATOS PARA GOOGLE SHEETS');
    console.log('=====================================\n');
    
    try {
        await prisma.$connect();
        
        // Obtener datos
        const users = await prisma.user.findMany({
            include: {
                threads: {
                    include: {
                        messages: true
                    }
                }
            }
        });
        
        const messages = await prisma.message.findMany({
            include: {
                thread: {
                    include: {
                        user: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        // Formatear para Sheets
        const sheetsData: SheetData = {
            users: users.map(user => ({
                'Teléfono': user.phoneNumber,
                'Nombre': user.name || '',
                'Fecha Registro': user.createdAt.toLocaleDateString('es-CO'),
                'Última Actividad': user.lastActivity.toLocaleDateString('es-CO'),
                'Total Threads': user.threads.length,
                'Total Mensajes': user.threads.reduce((sum, t) => sum + t.messages.length, 0)
            })),
            messages: messages.map(msg => ({
                'Fecha': msg.createdAt.toLocaleDateString('es-CO'),
                'Hora': msg.createdAt.toLocaleTimeString('es-CO'),
                'Usuario': msg.thread.user.phoneNumber,
                'Rol': msg.role === 'user' ? '👤 Usuario' : '🤖 Bot',
                'Mensaje': msg.content,
                'Thread ID': msg.thread.openaiId
            })),
            stats: {
                'Total Usuarios': users.length,
                'Total Mensajes': messages.length,
                'Fecha Reporte': new Date().toLocaleDateString('es-CO')
            }
        };
        
        // Generar CSV para copiar a Sheets
        console.log('📋 DATOS PARA GOOGLE SHEETS:');
        console.log('\n1. USUARIOS (copiar a una hoja):');
        console.log(generateCSV(sheetsData.users));
        
        console.log('\n\n2. MENSAJES (copiar a otra hoja):');
        console.log(generateCSV(sheetsData.messages));
        
        console.log('\n\n3. ESTADÍSTICAS (copiar a otra hoja):');
        console.log(generateCSV([sheetsData.stats]));
        
        console.log('\n📝 INSTRUCCIONES:');
        console.log('1. Crea un Google Sheet nuevo');
        console.log('2. Crea 3 hojas: "Usuarios", "Mensajes", "Estadísticas"');
        console.log('3. Copia cada sección en su hoja correspondiente');
        console.log('4. Los datos se actualizarán cada vez que ejecutes este script');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

function generateCSV(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            return String(value).replace(/"/g, '""');
        }).join('\t') // Usar tabs para mejor pegado en Sheets
    );
    
    return [headers.join('\t'), ...rows].join('\n');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    exportToGoogleSheets();
}

export { exportToGoogleSheets };