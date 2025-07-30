// scripts/populate-final-client-view.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateFinalClientView() {
    try {
        await prisma.$connect();
        
        console.log('🎯 Creando datos con estructura FINAL...');
        
        // Cliente 1: Sr Alex - Alta prioridad
        await prisma.clientView.create({
            data: {
                phoneNumber: '573003913251',
                prioridad: 'ALTA',
                displayName: 'Sr Alex',
                whatsappProfileName: 'Sr Alex',
                chatId: '573003913251@s.whatsapp.net',
                isContact: false,
                label1: 'Colega Jefe',
                label2: 'cotización',
                label3: null,
                perfilStatus: '👤 Sr Alex (Colega Jefe) | 💼 Cotización pendiente | 📅 4 días sin actividad',
                proximaAccion: '📞 CONTACTAR - Seguir cotización pendiente',
                lastMessageRole: null,
                lastMessageAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 días atrás
                lastThreadOpenAI: 'thread_CjofXRjUJT64MPIoi19Fp9we'
            }
        });
        
        // Cliente 2: María - Alta prioridad (esperando respuesta)
        await prisma.clientView.create({
            data: {
                phoneNumber: '573009876543',
                prioridad: 'ALTA',
                displayName: 'María Rodríguez',
                whatsappProfileName: 'María Rodríguez',
                chatId: '573009876543@s.whatsapp.net',
                isContact: true,
                label1: 'consulta',
                label2: 'primera-vez',
                label3: null,
                perfilStatus: '👤 María Rodríguez | 💬 Primera consulta hospedaje | ⏳ Esperando respuesta',
                proximaAccion: '⚡ RESPONDER URGENTE - Cliente escribió hace 2 horas',
                lastMessageRole: 'user',
                lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
                lastThreadOpenAI: 'thread_1753831571764_oem60q1wi'
            }
        });
        
        // Cliente 3: Carlos - Media prioridad (bot respondió)
        await prisma.clientView.create({
            data: {
                phoneNumber: '573005555555',
                prioridad: 'MEDIA',
                displayName: 'Carlos Mendoza',
                whatsappProfileName: 'Carlos Mendoza',
                chatId: '573005555555@s.whatsapp.net',
                isContact: false,
                label1: 'información',
                label2: 'precios',
                label3: null,
                perfilStatus: '👤 Carlos Mendoza | 💬 Consultando precios | 🤖 Bot respondió tarifas',
                proximaAccion: '⏳ ESPERAR RESPUESTA - Bot envió información hace 1 hora',
                lastMessageRole: 'assistant',
                lastMessageAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hora atrás
                lastThreadOpenAI: 'thread_1753839475487_06073rbc9'
            }
        });
        
        // Cliente 4: Cliente inactivo - Baja prioridad
        await prisma.clientView.create({
            data: {
                phoneNumber: '573001234567',
                prioridad: 'BAJA',
                displayName: 'Sin nombre',
                whatsappProfileName: null,
                chatId: '573001234567@s.whatsapp.net',
                isContact: false,
                label1: null,
                label2: null,
                label3: null,
                perfilStatus: '👤 Cliente anónimo | 🆕 Sin conversación | ⏰ Inactivo 7 días',
                proximaAccion: '🔄 REACTIVAR - Enviar mensaje de reactivación',
                lastMessageRole: null,
                lastMessageAt: null,
                lastThreadOpenAI: 'thread_1753831490903_bx8zesd82'
            }
        });
        
        console.log('✅ Datos finales creados');
        
        // Mostrar resumen ordenado por prioridad
        const clients = await prisma.clientView.findMany({
            orderBy: [
                { prioridad: 'asc' }, // ALTA primero (orden alfabético: ALTA, BAJA, MEDIA)
                { lastMessageAt: 'desc' }
            ]
        });
        
        console.log('\n📊 ClientView FINAL con', clients.length, 'clientes ordenados por prioridad:');
        clients.forEach((client, index) => {
            const labels = [client.label1, client.label2, client.label3].filter(Boolean).join(', ');
            console.log(`${index + 1}. ${client.prioridad} - ${client.displayName} [${labels || 'sin etiquetas'}]`);
            console.log(`   ${client.proximaAccion}`);
        });
        
        console.log('\n🎉 ¡Vista FINAL creada con solo 12 columnas necesarias!');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

populateFinalClientView();