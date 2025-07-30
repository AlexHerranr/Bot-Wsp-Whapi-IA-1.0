// scripts/add-sample-contacts.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addSampleContacts() {
    console.log('🔄 Agregando 3 contactos de ejemplo...');

    try {
        // Contacto 1: Cliente VIP activo
        await prisma.clientView.upsert({
            where: { phoneNumber: '573001234567' },
            update: {},
            create: {
                // PRIORIDAD VISUAL 1: IDENTIFICACIÓN BÁSICA
                phoneNumber: '573001234567',
                name: 'María García',
                userName: 'María G',
                
                // PRIORIDAD VISUAL 2: CRM - LO MÁS IMPORTANTE
                perfilStatus: 'Cliente VIP - Huésped recurrente del hotel, siempre reserva suite presidencial',
                proximaAccion: 'Contactar para oferta especial temporada alta',
                prioridad: 'ALTA',
                
                // PRIORIDAD VISUAL 3: ETIQUETAS
                label1: 'VIP',
                label2: 'Suite Presidencial',
                label3: 'Huésped Recurrente',
                
                // PRIORIDAD VISUAL 4: CONTACTO
                chatId: '573001234567@s.whatsapp.net',
                
                // PRIORIDAD VISUAL 5: ACTIVIDAD RECIENTE
                lastMessageRole: 'assistant',
                lastMessageAt: new Date('2025-01-29T10:30:00Z'),
                
                // PRIORIDAD VISUAL 6: THREAD TÉCNICO
                threadId: 'thread_vip_maria_garcia_001'
            }
        });

        // Contacto 2: Prospecto en cotización
        await prisma.clientView.upsert({
            where: { phoneNumber: '573007654321' },
            update: {},
            create: {
                // PRIORIDAD VISUAL 1: IDENTIFICACIÓN BÁSICA
                phoneNumber: '573007654321',
                name: 'Carlos Rodríguez',
                userName: 'Carlos R',
                
                // PRIORIDAD VISUAL 2: CRM - LO MÁS IMPORTANTE
                perfilStatus: 'Prospecto interesado - Preguntó por habitación doble para fin de semana',
                proximaAccion: 'Enviar cotización detallada y disponibilidad',
                prioridad: 'ALTA',
                
                // PRIORIDAD VISUAL 3: ETIQUETAS
                label1: 'Prospecto',
                label2: 'Cotización',
                label3: 'Fin de Semana',
                
                // PRIORIDAD VISUAL 4: CONTACTO
                chatId: '573007654321@s.whatsapp.net',
                
                // PRIORIDAD VISUAL 5: ACTIVIDAD RECIENTE
                lastMessageRole: 'user',
                lastMessageAt: new Date('2025-01-29T14:15:00Z'),
                
                // PRIORIDAD VISUAL 6: THREAD TÉCNICO
                threadId: 'thread_prospect_carlos_rod_002'
            }
        });

        // Contacto 3: Cliente de información general
        await prisma.clientView.upsert({
            where: { phoneNumber: '573009876543' },
            update: {},
            create: {
                // PRIORIDAD VISUAL 1: IDENTIFICACIÓN BÁSICA
                phoneNumber: '573009876543',
                name: 'Ana López',
                userName: 'Ana L',
                
                // PRIORIDAD VISUAL 2: CRM - LO MÁS IMPORTANTE
                perfilStatus: 'Consulta inicial - Preguntó por servicios y ubicación del hotel',
                proximaAccion: 'Seguimiento en 48h si no responde',
                prioridad: 'MEDIA',
                
                // PRIORIDAD VISUAL 3: ETIQUETAS
                label1: 'Información',
                label2: 'Primera Consulta',
                label3: null,
                
                // PRIORIDAD VISUAL 4: CONTACTO
                chatId: '573009876543@s.whatsapp.net',
                
                // PRIORIDAD VISUAL 5: ACTIVIDAD RECIENTE
                lastMessageRole: 'assistant',
                lastMessageAt: new Date('2025-01-29T09:45:00Z'),
                
                // PRIORIDAD VISUAL 6: THREAD TÉCNICO
                threadId: 'thread_info_ana_lopez_003'
            }
        });

        console.log('✅ 3 contactos de ejemplo agregados exitosamente');
        
        // Mostrar resumen
        const totalContacts = await prisma.clientView.count();
        console.log(`📊 Total contactos en ClientView: ${totalContacts}`);
        
        // Mostrar los contactos agregados
        const contacts = await prisma.clientView.findMany({
            select: {
                phoneNumber: true,
                name: true,
                prioridad: true,
                label1: true,
                perfilStatus: true
            },
            orderBy: {
                lastActivity: 'desc'
            }
        });
        
        console.log('\n📋 Contactos en la base de datos:');
        contacts.forEach((contact, index) => {
            console.log(`${index + 1}. ${contact.name} (${contact.phoneNumber})`);
            console.log(`   Prioridad: ${contact.prioridad} | Label: ${contact.label1}`);
            console.log(`   Perfil: ${contact.perfilStatus?.substring(0, 50)}...`);
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error agregando contactos:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addSampleContacts();