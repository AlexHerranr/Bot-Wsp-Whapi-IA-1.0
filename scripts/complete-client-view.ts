// scripts/complete-client-view.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CompleteClientInfo {
    // Datos principales
    phoneNumber: string;
    chatId: string;
    name: string | null;
    
    // OpenAI Thread info
    openaiThreadId: string;
    prismaThreadId: string;
    
    // Actividad
    createdAt: string;
    lastActivity: string;
    totalMessages: number;
    lastMessage: string | null;
    lastMessageRole: 'user' | 'assistant' | null;
    
    // Labels y metadata
    labels: any[];
    metadata: any;
    
    // Source de los datos
    dataSource: 'prisma' | 'json' | 'both';
    
    // Datos del JSON (threads.json)
    jsonData?: {
        threadId: string;
        userName: string;
        labels: string[];
        createdAt: string;
        lastActivity: string;
    } | null;
}

async function loadJsonThreads(): Promise<Map<string, any>> {
    const threadsFile = path.join(process.cwd(), 'tmp', 'threads.json');
    const jsonThreads = new Map();
    
    try {
        if (fs.existsSync(threadsFile)) {
            const data = fs.readFileSync(threadsFile, 'utf-8');
            const threadsArray = JSON.parse(data);
            
            // Convertir array a Map
            for (const [phoneNumber, threadData] of threadsArray) {
                jsonThreads.set(phoneNumber, threadData);
            }
            
            console.log(`📄 Cargados ${jsonThreads.size} threads desde JSON`);
        }
    } catch (error) {
        console.error('❌ Error cargando threads.json:', error.message);
    }
    
    return jsonThreads;
}

async function getCompleteClientInfo(): Promise<CompleteClientInfo[]> {
    try {
        await prisma.$connect();
        
        // Cargar datos de Prisma
        const prismaUsers = await prisma.user.findMany({
            include: {
                threads: {
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { lastActivity: 'desc' }
        });
        
        // Cargar datos JSON
        const jsonThreads = await loadJsonThreads();
        
        const completeInfo: CompleteClientInfo[] = [];
        const processedPhones = new Set<string>();
        
        // Procesar datos de Prisma
        for (const user of prismaUsers) {
            for (const thread of user.threads) {
                const cleanPhone = user.phoneNumber.replace('@s.whatsapp.net', '');
                processedPhones.add(cleanPhone);
                
                const messageCount = await prisma.message.count({
                    where: { threadId: thread.id }
                });
                
                const lastMessage = thread.messages[0] || null;
                const jsonData = jsonThreads.get(cleanPhone);
                
                completeInfo.push({
                    phoneNumber: cleanPhone,
                    chatId: thread.chatId || `${cleanPhone}@s.whatsapp.net`,
                    name: user.name || thread.userName,
                    
                    openaiThreadId: thread.openaiId,
                    prismaThreadId: thread.id,
                    
                    createdAt: thread.createdAt.toISOString(),
                    lastActivity: thread.lastActivity.toISOString(),
                    totalMessages: messageCount,
                    lastMessage: lastMessage?.content || null,
                    lastMessageRole: (lastMessage?.role as 'user' | 'assistant') || null,
                    
                    labels: thread.labels as any[] || [],
                    metadata: thread.metadata,
                    
                    dataSource: jsonData ? 'both' : 'prisma',
                    jsonData
                });
            }
        }
        
        // Procesar datos que solo están en JSON
        for (const [phoneNumber, threadData] of jsonThreads.entries()) {
            if (!processedPhones.has(phoneNumber)) {
                completeInfo.push({
                    phoneNumber,
                    chatId: threadData.chatId,
                    name: threadData.userName,
                    
                    openaiThreadId: threadData.threadId,
                    prismaThreadId: 'N/A',
                    
                    createdAt: threadData.createdAt,
                    lastActivity: threadData.lastActivity,
                    totalMessages: 0,
                    lastMessage: null,
                    lastMessageRole: null,
                    
                    labels: threadData.labels || [],
                    metadata: null,
                    
                    dataSource: 'json',
                    jsonData: threadData
                });
            }
        }
        
        return completeInfo.sort((a, b) => 
            new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        );
        
    } finally {
        await prisma.$disconnect();
    }
}

async function displayCompleteInfo() {
    try {
        console.clear();
        console.log('📊 INFORMACIÓN COMPLETA DE CLIENTES (PRISMA + JSON)');
        console.log('===================================================\n');
        
        const clients = await getCompleteClientInfo();
        
        if (clients.length === 0) {
            console.log('⚠️ No hay datos disponibles.');
            return;
        }
        
        const prismaOnly = clients.filter(c => c.dataSource === 'prisma').length;
        const jsonOnly = clients.filter(c => c.dataSource === 'json').length;
        const both = clients.filter(c => c.dataSource === 'both').length;
        
        console.log(`📈 RESUMEN DE FUENTES DE DATOS:`);
        console.log(`   🗄️ Solo Prisma: ${prismaOnly}`);
        console.log(`   📄 Solo JSON: ${jsonOnly}`);
        console.log(`   🔄 Ambos: ${both}`);
        console.log(`   📊 Total: ${clients.length}\n`);
        
        // Tabla principal
        const tableData = clients.map((client, index) => ({
            '#': (index + 1),
            'TELÉFONO': client.phoneNumber,
            'NOMBRE': client.name || 'Sin nombre',
            'CHAT_ID': client.chatId.replace('@s.whatsapp.net', ''),
            'THREAD_OPENAI': client.openaiThreadId.substring(0, 20) + '...',
            'MSGS': client.totalMessages,
            'ÚLTIMO': client.lastMessageRole === 'user' ? '👤' : 
                     client.lastMessageRole === 'assistant' ? '🤖' : '❌',
            'LABELS': JSON.stringify(client.labels).substring(0, 30),
            'FUENTE': client.dataSource === 'both' ? '🔄' : 
                     client.dataSource === 'prisma' ? '🗄️' : '📄'
        }));
        
        console.table(tableData);
        
        console.log('\n📋 DETALLES COMPLETOS POR CLIENTE:');
        console.log('==================================\n');
        
        clients.forEach((client, index) => {
            const sourceIcon = client.dataSource === 'both' ? '🔄 Ambos' : 
                              client.dataSource === 'prisma' ? '🗄️ Prisma' : '📄 JSON';
            
            console.log(`${index + 1}. 📱 ${client.phoneNumber}`);
            console.log(`   👤 Nombre: ${client.name || 'Sin nombre'}`);
            console.log(`   💬 Chat ID: ${client.chatId}`);
            console.log(`   🧵 OpenAI Thread: ${client.openaiThreadId}`);
            console.log(`   🔑 Prisma Thread ID: ${client.prismaThreadId}`);
            console.log(`   📊 Total mensajes: ${client.totalMessages}`);
            console.log(`   📅 Creado: ${new Date(client.createdAt).toLocaleString('es-CO')}`);
            console.log(`   ⏰ Última actividad: ${new Date(client.lastActivity).toLocaleString('es-CO')}`);
            
            if (client.lastMessage) {
                const roleIcon = client.lastMessageRole === 'user' ? '👤' : '🤖';
                const preview = client.lastMessage.length > 60 ? 
                    client.lastMessage.substring(0, 60) + '...' : 
                    client.lastMessage;
                console.log(`   💭 Último mensaje (${roleIcon}): "${preview}"`);
            }
            
            console.log(`   🏷️ Labels: ${JSON.stringify(client.labels)}`);
            console.log(`   📦 Fuente de datos: ${sourceIcon}`);
            
            if (client.jsonData && client.dataSource === 'both') {
                console.log(`   📄 Datos JSON:`);
                console.log(`      • Thread ID: ${client.jsonData.threadId}`);
                console.log(`      • Usuario: ${client.jsonData.userName}`);
                console.log(`      • Labels JSON: ${JSON.stringify(client.jsonData.labels)}`);
            }
            
            if (client.metadata) {
                console.log(`   🔧 Metadata: ${JSON.stringify(client.metadata, null, 4)}`);
            }
            
            console.log('   ' + '─'.repeat(60));
        });
        
        console.log('\n✅ Información completa generada exitosamente');
        console.log('💡 Leyenda: 🗄️=Prisma, 📄=JSON, 🔄=Ambos, 👤=Usuario, 🤖=Bot');
        
    } catch (error) {
        console.error('❌ Error generando información completa:', error);
    }
}

// Exportar para uso en otros archivos
export { getCompleteClientInfo, CompleteClientInfo };

// Ejecutar si se llama directamente
if (require.main === module) {
    displayCompleteInfo();
}