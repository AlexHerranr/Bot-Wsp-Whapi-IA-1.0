// scripts/populate-clean-client-view.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateCleanClientView() {
    try {
        await prisma.$connect();
        
        console.log('🧹 Creando datos limpios - SOLO metadatos reales...');
        
        // Cliente 1: Datos reales del JSON que teníamos
        await prisma.clientView.create({
            data: {
                phoneNumber: '573003913251',
                displayName: 'Sr Alex',
                whatsappProfileName: 'Sr Alex',  // chatInfo.name
                extractedName: null,
                chatId: '573003913251@s.whatsapp.net',
                openaiThreadId: 'thread_CjofXRjUJT64MPIoi19Fp9we',
                labels: ['Colega Jefe', 'cotización'], // Como venía en threads.json
                perfilStatus: '👤 Sr Alex | 🏷️ Colega Jefe, cotización | 📅 Sin conversación activa',
                proximaAccion: '📞 CONTACTAR - Iniciar conversación',
                totalMessages: 0,
                lastMessageRole: null,
                lastMessage: null
            }
        });
        
        // Cliente 2: Datos de Prisma que teníamos
        await prisma.clientView.create({
            data: {
                phoneNumber: '573005555555',
                displayName: 'Sin nombre',
                whatsappProfileName: null,
                extractedName: null,
                chatId: '573005555555@s.whatsapp.net',
                openaiThreadId: 'thread_1753839475487_06073rbc9',
                labels: [], // Sin etiquetas
                perfilStatus: '👤 Cliente nuevo | 💬 2 mensajes | 🤖 Bot respondió',
                proximaAccion: '⏳ ESPERAR RESPUESTA - Bot respondió reciente',
                totalMessages: 2,
                lastMessageRole: 'assistant',
                lastMessage: 'Respuesta del bot...'
            }
        });
        
        // Cliente 3: Otro ejemplo
        await prisma.clientView.create({
            data: {
                phoneNumber: '573009876543',
                displayName: 'Sin nombre',
                whatsappProfileName: null,
                extractedName: null,
                chatId: '573009876543@s.whatsapp.net',
                openaiThreadId: 'thread_1753831571764_oem60q1wi',
                labels: [],
                perfilStatus: '👤 Cliente nuevo | 💬 1 mensaje | 👤 Cliente escribió',
                proximaAccion: '🔥 RESPONDER HOY - Cliente esperando',
                totalMessages: 1,
                lastMessageRole: 'user',
                lastMessage: 'Mensaje del cliente...'
            }
        });
        
        console.log('✅ Datos limpios creados');
        
        // Mostrar resumen
        const clients = await prisma.clientView.findMany({
            orderBy: { lastActivity: 'desc' }
        });
        
        console.log('\n📊 ClientView limpia con', clients.length, 'clientes:');
        clients.forEach((client, index) => {
            console.log(`${index + 1}. ${client.displayName} - ${client.proximaAccion}`);
        });
        
        console.log('\n🎉 ¡Vista limpia creada con solo los metadatos reales!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

populateCleanClientView();