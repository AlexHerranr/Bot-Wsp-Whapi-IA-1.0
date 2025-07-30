// scripts/crm-sales-view.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CRMClientData {
    // Identificación prioritaria
    phoneNumber: string;
    displayName: string;
    
    // Información de contacto
    chatId: string;
    isContact: boolean;
    
    // Actividad y engagement
    totalMessages: number;
    lastMessageRole: 'user' | 'assistant' | null;
    lastActivity: string;
    daysSinceLastActivity: number;
    
    // Etiquetas y clasificación
    labels: string[];
    primaryLabel: string | null;
    
    // CRM Fields
    perfilStatus: string;      // Resumen del cliente
    proximaAccion: string;     // Qué hacer con este cliente
    prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
    
    // Thread info (para referencia)
    openaiThreadId: string;
    
    // Preview del último mensaje
    lastMessage: string | null;
}

async function loadAllData() {
    // Cargar datos de todas las fuentes
    const threadsFile = path.join(process.cwd(), 'tmp', 'threads.json');
    const guestFile = path.join(process.cwd(), 'tmp', 'guest_profiles.json');
    
    const jsonThreads = new Map();
    const guestProfiles = new Map();
    
    // Cargar threads.json
    try {
        if (fs.existsSync(threadsFile)) {
            const data = fs.readFileSync(threadsFile, 'utf-8');
            const threadsArray = JSON.parse(data);
            for (const [phoneNumber, threadData] of threadsArray) {
                jsonThreads.set(phoneNumber, threadData);
            }
        }
    } catch (error) {
        console.error('❌ Error cargando threads.json:', error.message);
    }
    
    // Cargar guest_profiles.json
    try {
        if (fs.existsSync(guestFile)) {
            const data = fs.readFileSync(guestFile, 'utf-8');
            const profilesArray = JSON.parse(data);
            for (const [phoneNumber, profileData] of profilesArray) {
                guestProfiles.set(phoneNumber, profileData);
            }
        }
    } catch (error) {
        console.error('❌ Error cargando guest_profiles.json:', error.message);
    }
    
    return { jsonThreads, guestProfiles };
}

function calculateDaysSince(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function generatePerfilStatus(client: any): string {
    const messages = client.totalMessages;
    const days = client.daysSinceLastActivity;
    const labels = client.labels;
    const name = client.displayName;
    
    // Generar perfil basado en datos disponibles
    let perfil = '';
    
    // Identificación del cliente
    if (name !== 'Sin nombre') {
        perfil += `👤 ${name}`;
    } else {
        perfil += '👤 Cliente nuevo';
    }
    
    // Estado de la conversación
    if (messages === 0) {
        perfil += ' | 🆕 Sin conversación';
    } else if (messages === 1) {
        perfil += ' | 💬 Primera interacción';
    } else {
        perfil += ` | 💬 ${messages} mensajes`;
    }
    
    // Etiquetas/clasificación
    if (labels.length > 0) {
        perfil += ` | 🏷️ ${labels.join(', ')}`;
    }
    
    // Estado temporal
    if (days === 0) {
        perfil += ' | ⚡ Hoy';
    } else if (days === 1) {
        perfil += ' | 📅 Ayer';
    } else if (days <= 7) {
        perfil += ` | 📅 Hace ${days} días`;
    } else {
        perfil += ` | ⏰ Hace ${days} días (FRÍO)`;
    }
    
    return perfil;
}

function generateProximaAccion(client: any): string {
    const messages = client.totalMessages;
    const days = client.daysSinceLastActivity;
    const lastRole = client.lastMessageRole;
    const labels = client.labels;
    
    // Lógica de próxima acción basada en CRM
    if (messages === 0) {
        return '📞 CONTACTAR - Iniciar conversación';
    }
    
    if (lastRole === 'user' && days === 0) {
        return '⚡ RESPONDER URGENTE - Cliente esperando';
    }
    
    if (lastRole === 'user' && days === 1) {
        return '🔥 RESPONDER HOY - Cliente escribió ayer';
    }
    
    if (lastRole === 'user' && days <= 3) {
        return '📱 RESPONDER - Cliente esperando respuesta';
    }
    
    if (labels.includes('cotización') || labels.includes('Colega Jefe')) {
        if (days <= 7) {
            return '💼 SEGUIMIENTO COMERCIAL - Cotización pendiente';
        } else {
            return '📞 REACTIVAR - Seguir cotización';
        }
    }
    
    if (lastRole === 'assistant' && days <= 3) {
        return '⏳ ESPERAR RESPUESTA - Bot respondió reciente';
    }
    
    if (days <= 7) {
        return '👀 MONITOREAR - Conversación activa';
    }
    
    if (days <= 30) {
        return '🔄 REACTIVAR - Cliente frío, reactivar';
    }
    
    return '📊 ANÁLISIS - Evaluar si continuar seguimiento';
}

function calculatePrioridad(client: any): 'ALTA' | 'MEDIA' | 'BAJA' {
    const messages = client.totalMessages;
    const days = client.daysSinceLastActivity;
    const lastRole = client.lastMessageRole;
    const labels = client.labels;
    
    // ALTA prioridad
    if (lastRole === 'user' && days <= 1) return 'ALTA';
    if (labels.includes('cotización') && days <= 3) return 'ALTA';
    if (labels.includes('Colega Jefe')) return 'ALTA';
    if (messages >= 3 && days <= 2) return 'ALTA';
    
    // MEDIA prioridad
    if (lastRole === 'user' && days <= 7) return 'MEDIA';
    if (messages >= 1 && days <= 7) return 'MEDIA';
    if (labels.length > 0 && days <= 14) return 'MEDIA';
    
    // BAJA prioridad
    return 'BAJA';
}

async function getCRMData(): Promise<CRMClientData[]> {
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
        
        // Cargar datos adicionales
        const { jsonThreads, guestProfiles } = await loadAllData();
        
        const crmData: CRMClientData[] = [];
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
                
                // Determinar mejor nombre
                let displayName = 'Sin nombre';
                if (guestData?.name) displayName = guestData.name;
                if (jsonData?.userName && jsonData.userName !== cleanPhone + '@s.whatsapp.net') {
                    displayName = jsonData.userName;
                }
                if (user.name && user.name !== cleanPhone + '@s.whatsapp.net') {
                    displayName = user.name;
                }
                
                // Combinar labels
                const allLabels = [
                    ...(thread.labels as string[] || []),
                    ...(jsonData?.labels || []),
                    ...(guestData?.whapiLabels?.map((l: any) => l.name || l) || [])
                ];
                const uniqueLabels = [...new Set(allLabels)];
                
                const daysSinceLastActivity = calculateDaysSince(thread.lastActivity.toISOString());
                
                const clientData = {
                    phoneNumber: cleanPhone,
                    displayName,
                    chatId: thread.chatId || `${cleanPhone}@s.whatsapp.net`,
                    isContact: guestData?.isContact || false,
                    totalMessages: messageCount,
                    lastMessageRole: (lastMessage?.role as 'user' | 'assistant') || null,
                    lastActivity: thread.lastActivity.toISOString(),
                    daysSinceLastActivity,
                    labels: uniqueLabels,
                    primaryLabel: guestData?.label || uniqueLabels[0] || null,
                    openaiThreadId: thread.openaiId,
                    lastMessage: lastMessage?.content || null,
                    perfilStatus: '',
                    proximaAccion: '',
                    prioridad: 'BAJA' as 'ALTA' | 'MEDIA' | 'BAJA'
                };
                
                // Generar campos CRM
                clientData.perfilStatus = generatePerfilStatus(clientData);
                clientData.proximaAccion = generateProximaAccion(clientData);
                clientData.prioridad = calculatePrioridad(clientData);
                
                crmData.push(clientData);
            }
        }
        
        // Procesar datos que solo están en JSON
        for (const [phoneNumber, jsonData] of jsonThreads.entries()) {
            if (!processedPhones.has(phoneNumber)) {
                const guestData = guestProfiles.get(phoneNumber);
                
                let displayName = 'Sin nombre';
                if (guestData?.name) displayName = guestData.name;
                if (jsonData.userName && jsonData.userName !== phoneNumber + '@s.whatsapp.net') {
                    displayName = jsonData.userName;
                }
                
                const daysSinceLastActivity = calculateDaysSince(jsonData.lastActivity);
                
                const clientData = {
                    phoneNumber,
                    displayName,
                    chatId: jsonData.chatId,
                    isContact: guestData?.isContact || false,
                    totalMessages: 0,
                    lastMessageRole: null,
                    lastActivity: jsonData.lastActivity,
                    daysSinceLastActivity,
                    labels: jsonData.labels || [],
                    primaryLabel: guestData?.label || jsonData.labels?.[0] || null,
                    openaiThreadId: jsonData.threadId,
                    lastMessage: null,
                    perfilStatus: '',
                    proximaAccion: '',
                    prioridad: 'BAJA' as 'ALTA' | 'MEDIA' | 'BAJA'
                };
                
                clientData.perfilStatus = generatePerfilStatus(clientData);
                clientData.proximaAccion = generateProximaAccion(clientData);
                clientData.prioridad = calculatePrioridad(clientData);
                
                crmData.push(clientData);
            }
        }
        
        // Ordenar por prioridad y luego por actividad reciente
        return crmData.sort((a, b) => {
            const prioridadOrder = { 'ALTA': 3, 'MEDIA': 2, 'BAJA': 1 };
            if (prioridadOrder[a.prioridad] !== prioridadOrder[b.prioridad]) {
                return prioridadOrder[b.prioridad] - prioridadOrder[a.prioridad];
            }
            return a.daysSinceLastActivity - b.daysSinceLastActivity;
        });
        
    } finally {
        await prisma.$disconnect();
    }
}

async function displayCRMView() {
    try {
        console.clear();
        console.log('🎯 CRM - GESTIÓN DE CLIENTES Y VENTAS');
        console.log('====================================\n');
        
        const clients = await getCRMData();
        
        if (clients.length === 0) {
            console.log('⚠️ No hay clientes registrados.');
            return;
        }
        
        const prioridadCount = {
            ALTA: clients.filter(c => c.prioridad === 'ALTA').length,
            MEDIA: clients.filter(c => c.prioridad === 'MEDIA').length,
            BAJA: clients.filter(c => c.prioridad === 'BAJA').length
        };
        
        console.log(`📊 RESUMEN DE PRIORIDADES:`);
        console.log(`   🔥 ALTA: ${prioridadCount.ALTA} clientes`);
        console.log(`   🟡 MEDIA: ${prioridadCount.MEDIA} clientes`);
        console.log(`   🔵 BAJA: ${prioridadCount.BAJA} clientes`);
        console.log(`   📈 Total: ${clients.length} clientes\n`);
        
        // Tabla principal CRM
        const tableData = clients.map((client, index) => ({
            '#': (index + 1),
            'PRIORIDAD': {
                'ALTA': '🔥',
                'MEDIA': '🟡', 
                'BAJA': '🔵'
            }[client.prioridad],
            'TELÉFONO': client.phoneNumber,
            'NOMBRE': client.displayName,
            'MENSAJES': client.totalMessages,
            'ÚLTIMO_MENSAJE': client.lastMessageRole === 'user' ? '👤' : 
                             client.lastMessageRole === 'assistant' ? '🤖' : '❌',
            'DÍAS': client.daysSinceLastActivity,
            'LABELS': client.labels.join(', ').substring(0, 20),
            'CONTACTO': client.isContact ? '✅' : '❌'
        }));
        
        console.table(tableData);
        
        console.log('\n📋 PLAN DE ACCIÓN POR CLIENTE:');
        console.log('==============================\n');
        
        clients.forEach((client, index) => {
            const prioIcon = {
                'ALTA': '🔥',
                'MEDIA': '🟡',
                'BAJA': '🔵'
            }[client.prioridad];
            
            console.log(`${index + 1}. ${prioIcon} ${client.prioridad} - 📱 ${client.phoneNumber}`);
            console.log(`   👤 ${client.displayName}`);
            console.log(`   📊 PERFIL/STATUS: ${client.perfilStatus}`);
            console.log(`   🎯 PRÓXIMA ACCIÓN: ${client.proximaAccion}`);
            
            if (client.lastMessage) {
                const roleIcon = client.lastMessageRole === 'user' ? '👤 Cliente' : '🤖 Bot';
                const preview = client.lastMessage.length > 80 ? 
                    client.lastMessage.substring(0, 80) + '...' : 
                    client.lastMessage;
                console.log(`   💭 Último mensaje (${roleIcon}): "${preview}"`);
            }
            
            console.log(`   🧵 Thread: ${client.openaiThreadId}`);
            console.log('   ' + '─'.repeat(60));
        });
        
        console.log('\n✅ Vista CRM generada exitosamente');
        console.log('💡 Ordenado por: PRIORIDAD → ACTIVIDAD RECIENTE');
        console.log('🎯 Enfócate en los clientes de prioridad ALTA primero');
        
    } catch (error) {
        console.error('❌ Error generando vista CRM:', error);
    }
}

// Exportar para uso en otros archivos
export { getCRMData, CRMClientData };

// Ejecutar si se llama directamente
if (require.main === module) {
    displayCRMView();
}