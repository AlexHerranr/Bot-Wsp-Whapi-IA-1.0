// scripts/export-to-csv.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function escapeCSV(field: any): string {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function arrayToCSV(data: any[], headers: string[]): string {
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => 
        headers.map(header => escapeCSV(row[header])).join(',')
    );
    return [csvHeaders, ...csvRows].join('\n');
}

async function exportToCSV() {
    try {
        await prisma.$connect();
        console.log('📊 EXPORTANDO DATOS A CSV...\n');

        const exportDir = './exports';
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir);
            console.log('📁 Directorio exports/ creado');
        }

        // 1. EXPORTAR USUARIOS
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' }
        });

        const usersCSV = arrayToCSV(users.map(user => ({
            id: user.id,
            phoneNumber: user.phoneNumber,
            name: user.name || '',
            createdAt: user.createdAt.toISOString(),
            lastActivity: user.lastActivity.toISOString()
        })), ['id', 'phoneNumber', 'name', 'createdAt', 'lastActivity']);

        fs.writeFileSync(path.join(exportDir, 'usuarios.csv'), usersCSV, 'utf8');
        console.log('✅ usuarios.csv creado');

        // 2. EXPORTAR THREADS
        const threads = await prisma.thread.findMany({
            include: { user: true },
            orderBy: { createdAt: 'desc' }
        });

        const threadsCSV = arrayToCSV(threads.map(thread => ({
            id: thread.id,
            openaiId: thread.openaiId,
            userId: thread.userId,
            userPhone: thread.user.phoneNumber,
            chatId: thread.chatId || '',
            userName: thread.userName || '',
            labels: JSON.stringify(thread.labels || []),
            createdAt: thread.createdAt.toISOString(),
            lastActivity: thread.lastActivity.toISOString()
        })), ['id', 'openaiId', 'userId', 'userPhone', 'chatId', 'userName', 'labels', 'createdAt', 'lastActivity']);

        fs.writeFileSync(path.join(exportDir, 'threads.csv'), threadsCSV, 'utf8');
        console.log('✅ threads.csv creado');

        // 3. EXPORTAR MENSAJES
        const messages = await prisma.message.findMany({
            include: { 
                thread: { 
                    include: { user: true } 
                } 
            },
            orderBy: { createdAt: 'desc' }
        });

        const messagesCSV = arrayToCSV(messages.map(message => ({
            id: message.id,
            threadId: message.threadId,
            threadOpenaiId: message.thread.openaiId,
            userPhone: message.thread.user.phoneNumber,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
            metadata: JSON.stringify(message.metadata || {})
        })), ['id', 'threadId', 'threadOpenaiId', 'userPhone', 'role', 'content', 'createdAt', 'metadata']);

        fs.writeFileSync(path.join(exportDir, 'mensajes.csv'), messagesCSV, 'utf8');
        console.log('✅ mensajes.csv creado');

        // 4. CREAR RESUMEN ESTADÍSTICO
        const stats = {
            timestamp: new Date().toISOString(),
            totalUsers: users.length,
            totalThreads: threads.length,
            totalMessages: messages.length,
            usersWithMessages: messages.reduce((acc, msg) => {
                acc.add(msg.thread.user.phoneNumber);
                return acc;
            }, new Set()).size,
            avgMessagesPerUser: messages.length / Math.max(users.length, 1),
            lastMessageDate: messages[0]?.createdAt.toISOString() || 'N/A',
            firstUserDate: users[users.length - 1]?.createdAt.toISOString() || 'N/A'
        };

        const statsCSV = arrayToCSV([stats], Object.keys(stats));
        fs.writeFileSync(path.join(exportDir, 'estadisticas.csv'), statsCSV, 'utf8');
        console.log('✅ estadisticas.csv creado');

        console.log('\n📊 ARCHIVOS EXPORTADOS:');
        console.log('======================');
        console.log('📁 exports/usuarios.csv     - Lista de usuarios');
        console.log('📁 exports/threads.csv      - Conversaciones/hilos');  
        console.log('📁 exports/mensajes.csv     - Todos los mensajes');
        console.log('📁 exports/estadisticas.csv - Resumen estadístico');
        console.log('\n💡 Puedes abrir estos archivos en Excel, Google Sheets, etc.');
        
    } catch (error) {
        console.error('❌ Error exportando:', error);
    } finally {
        await prisma.$disconnect();
    }
}

exportToCSV();