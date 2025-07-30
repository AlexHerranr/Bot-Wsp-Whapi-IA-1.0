// scripts/complete-metadata-view.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CompleteMetadata {
    // Identificación
    phoneNumber: string;
    chatId: string;
    
    // Nombres (múltiples fuentes)
    whatsappProfileName: string | null;    // chatInfo.name - Nombre del perfil de WhatsApp
    extractedName: string | null;          // profile.name - Nombre extraído de conversaciones
    userName: string | null;               // thread.userName - Nombre del thread
    displayName: string;                   // Nombre principal a mostrar
    
    // Threads
    openaiThreadId: string;
    prismaThreadId: string;
    
    // Actividad y mensajes
    createdAt: string;
    lastActivity: string;
    firstInteraction?: string;
    lastInteraction?: string;
    totalMessages: number;
    lastMessage: string | null;
    lastMessageRole: 'user' | 'assistant' | null;
    
    // Labels y etiquetas
    whapiLabels: any[];                    // Etiquetas completas de WHAPI
    extractedLabels: string[];             // Labels simples
    primaryLabel: string | null;           // Label principal
    
    // Metadata adicional
    isContact?: boolean;
    metadata: any;
    
    // Fuente de datos
    dataSource: 'prisma' | 'json' | 'guest_memory' | 'combined';
    
    // Datos raw para debug
    rawData?: {
        prismaData?: any;
        jsonData?: any;
        guestData?: any;
    };
}

async function loadGuestProfiles(): Promise<Map<string, any>> {
    const guestFile = path.join(process.cwd(), 'tmp', 'guest_profiles.json');
    const guestProfiles = new Map();
    
    try {
        if (fs.existsSync(guestFile)) {
            const data = fs.readFileSync(guestFile, 'utf-8');
            const profilesArray = JSON.parse(data);
            
            // Convertir array a Map
            for (const [phoneNumber, profileData] of profilesArray) {
                guestProfiles.set(phoneNumber, profileData);
            }
            
            console.log(`👥 Cargados ${guestProfiles.size} perfiles de guest_profiles.json`);
        }
    } catch (error) {
        console.error('❌ Error cargando guest_profiles.json:', error.message);
    }
    
    return guestProfiles;
}

async function loadJsonThreads(): Promise<Map<string, any>> {
    const threadsFile = path.join(process.cwd(), 'tmp', 'threads.json');
    const jsonThreads = new Map();
    
    try {
        if (fs.existsSync(threadsFile)) {
            const data = fs.readFileSync(threadsFile, 'utf-8');
            const threadsArray = JSON.parse(data);
            
            for (const [phoneNumber, threadData] of threadsArray) {
                jsonThreads.set(phoneNumber, threadData);
            }
            
            console.log(`📄 Cargados ${jsonThreads.size} threads desde threads.json`);
        }
    } catch (error) {
        console.error('❌ Error cargando threads.json:', error.message);
    }
    
    return jsonThreads;
}

async function getCompleteMetadata(): Promise<CompleteMetadata[]> {
    try {
        await prisma.$connect();
        
        // Cargar todas las fuentes de datos
        const [prismaUsers, jsonThreads, guestProfiles] = await Promise.all([
            prisma.user.findMany({
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
            }),
            loadJsonThreads(),
            loadGuestProfiles()
        ]);

        const completeMetadata: CompleteMetadata[] = [];
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
                const guestData = guestProfiles.get(cleanPhone);

                // Determinar el mejor nombre para mostrar
                let displayName = 'Sin nombre';
                let whatsappProfileName = null;
                let extractedName = null;

                if (guestData?.name) {
                    extractedName = guestData.name;
                    displayName = guestData.name;
                }
                
                if (jsonData?.userName && jsonData.userName !== cleanPhone + '@s.whatsapp.net') {
                    whatsappProfileName = jsonData.userName;
                    displayName = jsonData.userName;
                }

                if (user.name && user.name !== cleanPhone + '@s.whatsapp.net') {
                    whatsappProfileName = user.name;
                    displayName = user.name;
                }

                // Combinar labels de todas las fuentes
                const whapiLabels = guestData?.whapiLabels || jsonData?.labels || [];
                const extractedLabels = (thread.labels as string[]) || [];
                const primaryLabel = guestData?.label || null;

                let dataSource: 'prisma' | 'json' | 'guest_memory' | 'combined' = 'prisma';
                if (jsonData && guestData) dataSource = 'combined';
                else if (jsonData) dataSource = 'combined';
                else if (guestData) dataSource = 'combined';

                completeMetadata.push({
                    phoneNumber: cleanPhone,
                    chatId: thread.chatId || `${cleanPhone}@s.whatsapp.net`,
                    
                    whatsappProfileName,
                    extractedName,
                    userName: thread.userName,
                    displayName,
                    
                    openaiThreadId: thread.openaiId,
                    prismaThreadId: thread.id,
                    
                    createdAt: thread.createdAt.toISOString(),
                    lastActivity: thread.lastActivity.toISOString(),
                    firstInteraction: guestData?.firstInteraction,
                    lastInteraction: guestData?.lastInteraction,
                    totalMessages: messageCount,
                    lastMessage: lastMessage?.content || null,
                    lastMessageRole: (lastMessage?.role as 'user' | 'assistant') || null,
                    
                    whapiLabels: Array.isArray(whapiLabels) ? whapiLabels : [],
                    extractedLabels,
                    primaryLabel,
                    
                    isContact: guestData?.isContact,
                    metadata: thread.metadata,
                    
                    dataSource,
                    
                    rawData: {
                        prismaData: { user, thread },
                        jsonData,
                        guestData
                    }
                });
            }
        }

        // Procesar datos que solo están en JSON o Guest
        for (const [phoneNumber, jsonData] of jsonThreads.entries()) {
            if (!processedPhones.has(phoneNumber)) {
                const guestData = guestProfiles.get(phoneNumber);
                
                let displayName = 'Sin nombre';
                let whatsappProfileName = null;
                let extractedName = null;

                if (guestData?.name) {
                    extractedName = guestData.name;
                    displayName = guestData.name;
                }
                
                if (jsonData.userName && jsonData.userName !== phoneNumber + '@s.whatsapp.net') {
                    whatsappProfileName = jsonData.userName;
                    displayName = jsonData.userName;
                }

                completeMetadata.push({
                    phoneNumber,
                    chatId: jsonData.chatId,
                    
                    whatsappProfileName,
                    extractedName,
                    userName: jsonData.userName,
                    displayName,
                    
                    openaiThreadId: jsonData.threadId,
                    prismaThreadId: 'N/A',
                    
                    createdAt: jsonData.createdAt,
                    lastActivity: jsonData.lastActivity,
                    firstInteraction: guestData?.firstInteraction,
                    lastInteraction: guestData?.lastInteraction,
                    totalMessages: 0,
                    lastMessage: null,
                    lastMessageRole: null,
                    
                    whapiLabels: jsonData.labels || [],
                    extractedLabels: [],
                    primaryLabel: guestData?.label || null,
                    
                    isContact: guestData?.isContact,
                    metadata: null,
                    
                    dataSource: guestData ? 'combined' : 'json',
                    
                    rawData: {
                        jsonData,
                        guestData
                    }
                });
                
                processedPhones.add(phoneNumber);
            }
        }

        // Procesar datos que solo están en Guest Memory
        for (const [phoneNumber, guestData] of guestProfiles.entries()) {
            if (!processedPhones.has(phoneNumber)) {
                completeMetadata.push({
                    phoneNumber,
                    chatId: `${phoneNumber}@s.whatsapp.net`,
                    
                    whatsappProfileName: null,
                    extractedName: guestData.name,
                    userName: null,
                    displayName: guestData.name || 'Sin nombre',
                    
                    openaiThreadId: 'N/A',
                    prismaThreadId: 'N/A',
                    
                    createdAt: guestData.firstInteraction,
                    lastActivity: guestData.lastInteraction,
                    firstInteraction: guestData.firstInteraction,
                    lastInteraction: guestData.lastInteraction,
                    totalMessages: 0,
                    lastMessage: null,
                    lastMessageRole: null,
                    
                    whapiLabels: guestData.whapiLabels || [],
                    extractedLabels: [],
                    primaryLabel: guestData.label,
                    
                    isContact: guestData.isContact,
                    metadata: null,
                    
                    dataSource: 'guest_memory',
                    
                    rawData: {
                        guestData
                    }
                });
            }
        }

        return completeMetadata.sort((a, b) => 
            new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        );
        
    } finally {
        await prisma.$disconnect();
    }
}

async function displayCompleteMetadata() {
    try {
        console.clear();
        console.log('🎯 METADATOS COMPLETOS DE TODOS LOS CLIENTES');
        console.log('============================================\n');
        
        const clients = await getCompleteMetadata();
        
        if (clients.length === 0) {
            console.log('⚠️ No hay datos disponibles.');
            return;
        }

        const sourceCount = {
            prisma: clients.filter(c => c.dataSource === 'prisma').length,
            json: clients.filter(c => c.dataSource === 'json').length,
            guest_memory: clients.filter(c => c.dataSource === 'guest_memory').length,
            combined: clients.filter(c => c.dataSource === 'combined').length
        };

        console.log(`📊 RESUMEN POR FUENTE DE DATOS:`);
        console.log(`   🗄️ Solo Prisma: ${sourceCount.prisma}`);
        console.log(`   📄 Solo JSON: ${sourceCount.json}`);
        console.log(`   👥 Solo Guest Memory: ${sourceCount.guest_memory}`);
        console.log(`   🔄 Combinado: ${sourceCount.combined}`);
        console.log(`   📈 Total: ${clients.length}\n`);

        // Tabla principal con TODOS los metadatos
        const tableData = clients.map((client, index) => ({
            '#': (index + 1),
            'TELÉFONO': client.phoneNumber,
            'NOMBRE_WHATSAPP': client.whatsappProfileName || '-',
            'NOMBRE_EXTRAÍDO': client.extractedName || '-',
            'NOMBRE_MOSTRAR': client.displayName,
            'CHAT_ID': client.chatId.replace('@s.whatsapp.net', ''),
            'THREAD_OPENAI': client.openaiThreadId.substring(0, 15) + '...',
            'LABELS_WHAPI': JSON.stringify(client.whapiLabels).substring(0, 20),
            'LABEL_PRINCIPAL': client.primaryLabel || '-',
            'MSGS': client.totalMessages,
            'ES_CONTACTO': client.isContact ? '✅' : '❌',
            'FUENTE': {
                'prisma': '🗄️',
                'json': '📄', 
                'guest_memory': '👥',
                'combined': '🔄'
            }[client.dataSource]
        }));

        console.table(tableData);

        console.log('\n📋 DETALLES COMPLETOS POR CLIENTE:');
        console.log('==================================\n');

        clients.forEach((client, index) => {
            console.log(`${index + 1}. 📱 ${client.phoneNumber}`);
            console.log(`   👤 NOMBRES:`);
            console.log(`      • WhatsApp Profile: ${client.whatsappProfileName || 'N/A'}`);
            console.log(`      • Extraído de chat: ${client.extractedName || 'N/A'}`);
            console.log(`      • Username thread: ${client.userName || 'N/A'}`);
            console.log(`      • 🎯 MOSTRAR: ${client.displayName}`);
            
            console.log(`   🧵 THREADS:`);
            console.log(`      • OpenAI: ${client.openaiThreadId}`);
            console.log(`      • Prisma: ${client.prismaThreadId}`);
            
            console.log(`   📊 ACTIVIDAD:`);
            console.log(`      • Creado: ${new Date(client.createdAt).toLocaleString('es-CO')}`);
            console.log(`      • Última actividad: ${new Date(client.lastActivity).toLocaleString('es-CO')}`);
            if (client.firstInteraction) {
                console.log(`      • Primera interacción: ${new Date(client.firstInteraction).toLocaleString('es-CO')}`);
            }
            console.log(`      • Total mensajes: ${client.totalMessages}`);
            
            if (client.lastMessage) {
                const roleIcon = client.lastMessageRole === 'user' ? '👤' : '🤖';
                const preview = client.lastMessage.length > 50 ? 
                    client.lastMessage.substring(0, 50) + '...' : 
                    client.lastMessage;
                console.log(`      • Último mensaje (${roleIcon}): "${preview}"`);
            }

            console.log(`   🏷️ ETIQUETAS:`);
            if (client.whapiLabels.length > 0) {
                console.log(`      • WHAPI Labels: ${JSON.stringify(client.whapiLabels)}`);
            }
            if (client.extractedLabels.length > 0) {
                console.log(`      • Labels extraídos: ${JSON.stringify(client.extractedLabels)}`);
            }
            if (client.primaryLabel) {
                console.log(`      • Label principal: ${client.primaryLabel}`);
            }

            console.log(`   📦 METADATOS:`);
            console.log(`      • Es contacto: ${client.isContact ? 'Sí' : 'No'}`);
            console.log(`      • Fuente de datos: ${client.dataSource}`);
            
            if (client.metadata) {
                console.log(`      • Metadata adicional: ${JSON.stringify(client.metadata, null, 6)}`);
            }

            console.log('   ' + '─'.repeat(60));
        });

        console.log('\n✅ Metadatos completos generados exitosamente');
        console.log('💡 Leyenda: 🗄️=Prisma, 📄=JSON, 👥=Guest Memory, 🔄=Combinado');
        
    } catch (error) {
        console.error('❌ Error generando metadatos completos:', error);
    }
}

// Exportar para uso en otros archivos
export { getCompleteMetadata, CompleteMetadata };

// Ejecutar si se llama directamente
if (require.main === module) {
    displayCompleteMetadata();
}