// scripts/create-test-data.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestData() {
    try {
        await prisma.$connect();
        
        console.log('🔧 Creando datos de prueba...');
        
        // Crear usuario de prueba
        const user = await prisma.user.create({
            data: {
                phoneNumber: '573001234567@s.whatsapp.net',
                name: 'Usuario de Prueba',
                whatsappProfileName: 'Juan Pérez',
                extractedName: 'Juan',
                displayName: 'Juan Pérez',
                isContact: true,
                isVip: false,
                customerStatus: 'nuevo',
                totalStays: 0
            }
        });
        
        console.log('✅ Usuario creado:', user.id);
        
        // Crear thread de prueba
        const thread = await prisma.thread.create({
            data: {
                openaiId: 'thread_test_12345',
                userId: user.id,
                chatId: '573001234567@s.whatsapp.net',
                userName: 'Juan Pérez',
                labels: ['cliente', 'consulta'],
                whapiLabels: [
                    { id: '1', name: 'Cliente VIP', color: 'blue' },
                    { id: '2', name: 'Consulta', color: 'green' }
                ],
                primaryLabel: 'Cliente VIP',
                perfilStatus: '👤 Juan Pérez | 💬 Primera consulta | 🏷️ Cliente VIP',
                proximaAccion: '📞 RESPONDER - Cliente esperando información',
                prioridad: 'ALTA',
                estadoComercial: 'prospecto',
                totalMessages: 1,
                lastMessageRole: 'user',
                lastMessageAt: new Date()
            }
        });
        
        console.log('✅ Thread creado:', thread.id);
        
        // Crear mensaje de prueba
        const message = await prisma.message.create({
            data: {
                threadId: thread.id,
                role: 'user',
                content: '¡Hola! Me gustaría saber sobre disponibilidad para este fin de semana.',
                messageType: 'text',
                sentiment: 'positive',
                intent: 'consulta'
            }
        });
        
        console.log('✅ Mensaje creado:', message.id);
        
        console.log('\n🎉 Datos de prueba creados exitosamente!');
        console.log('Ahora deberías ver las 3 pestañas en Prisma Studio con datos.');
        
    } catch (error) {
        console.error('❌ Error creando datos de prueba:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createTestData();