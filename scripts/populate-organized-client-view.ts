// scripts/populate-organized-client-view.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateOrganizedClientView() {
    try {
        await prisma.$connect();
        
        console.log('🎯 Creando datos con ORDEN VISUAL y nombres exactos de metadatos...');
        
        // Cliente 1: Sr Alex - Datos reales del threads.json
        await prisma.clientView.create({
            data: {
                // PRIORIDAD VISUAL 1: IDENTIFICACIÓN BÁSICA
                phoneNumber: '573003913251',
                name: 'Sr Alex', // chatData.name (WHAPI)
                userName: 'Sr Alex', // threads.json.userName
                
                // PRIORIDAD VISUAL 2: CRM - LO MÁS IMPORTANTE  
                perfilStatus: '👤 Sr Alex (Colega Jefe) | 💼 Cotización pendiente | 📅 4 días sin conversación',
                proximaAccion: '📞 CONTACTAR URGENTE - Seguir cotización importante',
                prioridad: 'ALTA',
                
                // PRIORIDAD VISUAL 3: ETIQUETAS
                label1: 'Colega Jefe', // threads.json.labels[0]
                label2: 'cotización', // threads.json.labels[1]
                label3: null,
                
                // PRIORIDAD VISUAL 4: CONTACTO
                chatId: '573003913251@s.whatsapp.net', // threads.json.chatId
                isContact: false,
                
                // PRIORIDAD VISUAL 5: ACTIVIDAD RECIENTE
                lastMessageRole: null,
                lastMessageAt: null,
                lastActivity: new Date('2025-07-26T20:59:03.974Z'), // threads.json.lastActivity
                
                // PRIORIDAD VISUAL 6: THREAD TÉCNICO
                threadId: 'thread_CjofXRjUJT64MPIoi19Fp9we' // threads.json.threadId (OpenAI)
            }
        });
        
        // Cliente 2: María - Cliente activo
        await prisma.clientView.create({
            data: {
                phoneNumber: '573009876543',
                name: 'María Rodríguez',
                userName: 'María Rodríguez',
                
                perfilStatus: '👤 María Rodríguez | 💬 Primera consulta hospedaje | ⏳ Esperando respuesta hace 2h',
                proximaAccion: '⚡ RESPONDER AHORA - Cliente escribió hace 2 horas',
                prioridad: 'ALTA',
                
                label1: 'consulta',
                label2: 'primera-vez',
                label3: null,
                
                chatId: '573009876543@s.whatsapp.net',
                isContact: true,
                
                lastMessageRole: 'user',
                lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
                lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
                
                threadId: 'thread_1753831571764_oem60q1wi'
            }
        });
        
        // Cliente 3: Carlos - Bot respondió
        await prisma.clientView.create({
            data: {
                phoneNumber: '573005555555',
                name: 'Carlos Mendoza',
                userName: 'Carlos Mendoza',
                
                perfilStatus: '👤 Carlos Mendoza | 💬 Consultando precios | 🤖 Bot envió tarifas hace 1h',
                proximaAccion: '⏳ MONITOREAR - Esperar respuesta del cliente',
                prioridad: 'MEDIA',
                
                label1: 'información',
                label2: 'precios',
                label3: null,
                
                chatId: '573005555555@s.whatsapp.net',
                isContact: false,
                
                lastMessageRole: 'assistant',
                lastMessageAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
                lastActivity: new Date(Date.now() - 1 * 60 * 60 * 1000),
                
                threadId: 'thread_1753839475487_06073rbc9'
            }
        });
        
        // Cliente 4: Cliente frío
        await prisma.clientView.create({
            data: {
                phoneNumber: '573001234567',
                name: null,
                userName: null,
                
                perfilStatus: '👤 Cliente anónimo | 🆕 Sin conversación | ⏰ Thread creado hace 7 días',
                proximaAccion: '🔄 REACTIVAR - Enviar mensaje inicial',
                prioridad: 'BAJA',
                
                label1: null,
                label2: null,
                label3: null,
                
                chatId: '573001234567@s.whatsapp.net',
                isContact: false,
                
                lastMessageRole: null,
                lastMessageAt: null,
                lastActivity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                
                threadId: 'thread_1753831490903_bx8zesd82'
            }
        });
        
        console.log('✅ Datos organizados creados');
        
        // Mostrar resumen
        const clients = await prisma.clientView.findMany({
            orderBy: [
                { prioridad: 'asc' }, // ALTA primero
                { lastActivity: 'desc' }
            ]
        });
        
        console.log('\n📊 ClientView ORGANIZADA - Orden visual + Metadatos exactos:');
        console.log('===========================================================\n');
        
        clients.forEach((client, index) => {
            console.log(`${index + 1}. ${client.prioridad} - ${client.name || 'Sin nombre'}`);
            console.log(`   📱 Tel: ${client.phoneNumber}`);
            console.log(`   🎯 Perfil: ${client.perfilStatus}`);
            console.log(`   📞 Acción: ${client.proximaAccion}`);
            console.log(`   🏷️ Labels: ${[client.label1, client.label2, client.label3].filter(Boolean).join(', ') || 'Sin etiquetas'}`);
            console.log(`   🧵 Thread: ${client.threadId}`);
            console.log('   ' + '─'.repeat(50));
        });
        
        console.log('\n🎉 ¡Vista FINAL organizada por prioridad visual!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

populateOrganizedClientView();