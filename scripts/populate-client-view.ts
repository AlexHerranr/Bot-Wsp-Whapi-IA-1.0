// scripts/populate-client-view.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateClientView() {
    try {
        await prisma.$connect();
        
        console.log('🔧 Creando datos para ClientView (vista unificada)...');
        
        // Cliente 1: Alta prioridad - Esperando respuesta
        await prisma.clientView.create({
            data: {
                prioridad: 'ALTA',
                phoneNumber: '573003913251',
                displayName: 'Sr Alex',
                whatsappProfileName: 'Sr Alex',
                chatId: '573003913251@s.whatsapp.net',
                isContact: false,
                isVip: true,
                primaryLabel: 'Colega Jefe',
                labels: ['Colega Jefe', 'cotización'],
                whapiLabels: [
                    { id: '1', name: 'Colega Jefe', color: 'red' },
                    { id: '2', name: 'cotización', color: 'blue' }
                ],
                perfilStatus: '👤 Sr Alex (Colega Jefe) | 💬 Cotización pendiente | 🏷️ VIP',
                proximaAccion: '💼 SEGUIMIENTO COMERCIAL - Cotización pendiente',
                estadoComercial: 'cotizacion',
                totalMessages: 3,
                lastMessageRole: 'user',
                lastMessage: 'Buenos días, ¿ya tienen disponibilidad para el evento del sábado?',
                lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 horas atrás
                daysSinceActivity: 0,
                sentiment: 'positive',
                intent: 'consulta',
                openaiThreadId: 'thread_CjofXRjUJT64MPIoi19Fp9we',
                customerStatus: 'vip',
                totalStays: 2
            }
        });
        
        // Cliente 2: Alta prioridad - Cliente nuevo escribió
        await prisma.clientView.create({
            data: {
                prioridad: 'ALTA',
                phoneNumber: '573009876543',
                displayName: 'María Rodríguez',
                whatsappProfileName: 'María Rodríguez',
                chatId: '573009876543@s.whatsapp.net',
                isContact: true,
                isVip: false,
                primaryLabel: 'Cliente Nuevo',
                labels: ['consulta', 'primera-vez'],
                perfilStatus: '👤 María Rodríguez | 💬 Primera consulta | 📅 Hoy',
                proximaAccion: '⚡ RESPONDER URGENTE - Cliente esperando',
                estadoComercial: 'prospecto',
                totalMessages: 1,
                lastMessageRole: 'user',
                lastMessage: 'Hola! Me gustaría información sobre hospedaje para 4 personas',
                lastMessageAt: new Date(Date.now() - 1000 * 60 * 30), // 30 min atrás
                daysSinceActivity: 0,
                sentiment: 'positive',
                intent: 'consulta',
                openaiThreadId: 'thread_1753831571764_oem60q1wi',
                customerStatus: 'nuevo',
                totalStays: 0
            }
        });
        
        // Cliente 3: Media prioridad - Bot respondió
        await prisma.clientView.create({
            data: {
                prioridad: 'MEDIA',
                phoneNumber: '573005555555',
                displayName: 'Carlos Mendoza',
                whatsappProfileName: 'Carlos Mendoza',
                chatId: '573005555555@s.whatsapp.net',
                isContact: false,
                isVip: false,
                primaryLabel: 'Interesado',
                labels: ['información', 'precios'],
                perfilStatus: '👤 Carlos Mendoza | 💬 Consultando precios | ⏳ Bot respondió',
                proximaAccion: '⏳ ESPERAR RESPUESTA - Bot respondió reciente',
                estadoComercial: 'prospecto',
                totalMessages: 4,
                lastMessageRole: 'assistant',
                lastMessage: 'Te envío la información de nuestros servicios y tarifas...',
                lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 1), // 1 hora atrás
                daysSinceActivity: 0,
                sentiment: 'neutral',
                intent: 'información',
                openaiThreadId: 'thread_1753839475487_06073rbc9',
                customerStatus: 'activo',
                totalStays: 0
            }
        });
        
        // Cliente 4: Baja prioridad - Cliente frío
        await prisma.clientView.create({
            data: {
                prioridad: 'BAJA',
                phoneNumber: '573001234567',
                displayName: 'Sin nombre',
                chatId: '573001234567@s.whatsapp.net',
                isContact: false,
                isVip: false,
                primaryLabel: 'Inactivo',
                labels: [],
                perfilStatus: '👤 Cliente nuevo | 🆕 Sin conversación | ⏰ Hace 7 días',
                proximaAccion: '🔄 REACTIVAR - Cliente frío, reactivar',
                estadoComercial: 'perdido',
                totalMessages: 0,
                lastMessageRole: null,
                lastMessage: null,
                lastMessageAt: null,
                daysSinceActivity: 7,
                sentiment: null,
                intent: null,
                openaiThreadId: 'thread_1753831490903_bx8zesd82',
                customerStatus: 'inactivo',
                totalStays: 0
            }
        });
        
        console.log('✅ Datos creados en ClientView');
        
        // Verificar que se crearon correctamente ordenados por prioridad
        const clients = await prisma.clientView.findMany({
            orderBy: [
                { prioridad: 'desc' }, // ALTA primero
                { lastActivity: 'desc' }
            ]
        });
        
        console.log('\n📊 Vista unificada creada con', clients.length, 'clientes:');
        clients.forEach((client, index) => {
            console.log(`${index + 1}. ${client.prioridad} - ${client.displayName} - ${client.proximaAccion}`);
        });
        
        console.log('\n🎉 ¡ClientView poblada exitosamente!');
        console.log('Ahora verás solo 1 pestaña "ClientView" en Prisma Studio con todos los metadatos');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

populateClientView();