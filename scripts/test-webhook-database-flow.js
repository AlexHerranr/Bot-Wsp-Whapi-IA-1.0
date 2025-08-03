// scripts/test-webhook-database-flow.js
// Test manual para verificar flujo webhook → BD

const { PrismaClient } = require('@prisma/client');
const express = require('express');
const axios = require('axios');

const prisma = new PrismaClient();

// Simular el webhook processor
const createWebhookProcessor = () => {
    const app = express();
    app.use(express.json());

    app.post('/webhook', async (req, res) => {
        try {
            const webhookData = req.body;
            console.log('📨 Webhook recibido:', JSON.stringify(webhookData, null, 2));

            const { message } = webhookData;
            if (!message) {
                return res.status(400).json({ error: 'No message in webhook' });
            }

            const phoneNumber = message.from;
            const userName = message.from_name;
            const chatId = message.chat_id;
            const messageContent = message.text?.body || message.type || 'Sin contenido';
            const timestamp = message.timestamp;

            console.log(`👤 Procesando usuario: ${phoneNumber} (${userName})`);
            console.log(`💬 Mensaje: "${messageContent}"`);

            // 1. Verificar si existe el usuario
            const existingUser = await prisma.clientView.findUnique({
                where: { phoneNumber }
            });

            if (existingUser) {
                // Actualizar usuario existente
                const updatedUser = await prisma.clientView.update({
                    where: { phoneNumber },
                    data: {
                        userName: userName || existingUser.userName,
                        chatId,
                        lastActivity: new Date(timestamp * 1000)
                    }
                });
                console.log(`🔄 Usuario actualizado: ${updatedUser.phoneNumber}`);
            } else {
                // Crear nuevo usuario
                const newUser = await prisma.clientView.create({
                    data: {
                        phoneNumber,
                        userName,
                        chatId,
                        lastActivity: new Date(timestamp * 1000),
                        prioridad: 'MEDIA'
                    }
                });
                console.log(`✅ Usuario creado: ${newUser.phoneNumber}`);
            }

            // Simular respuesta del bot (actualizar actividad)
            await prisma.clientView.update({
                where: { phoneNumber },
                data: {
                    lastActivity: new Date() // Actualizamos cuando respondemos
                }
            });

            console.log(`🤖 Respuesta del bot simulada para ${phoneNumber}`);

            res.json({ 
                success: true, 
                processed: {
                    phoneNumber,
                    userName,
                    messageType: message.type,
                    messageContent: messageContent.substring(0, 50)
                }
            });

        } catch (error) {
            console.error('❌ Error procesando webhook:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return app;
};

async function testWebhookFlow() {
    try {
        console.log('🚀 Iniciando test de flujo webhook → BD...\n');

        // Conectar a BD
        await prisma.$connect();
        console.log('✅ Conectado a PostgreSQL\n');

        // Obtener estado inicial
        const initialCount = await prisma.clientView.count();
        console.log(`📊 Usuarios iniciales en BD: ${initialCount}\n`);

        // Crear servidor webhook
        const app = createWebhookProcessor();
        const server = app.listen(3001, () => {
            console.log('🔗 Servidor webhook ejecutándose en puerto 3001\n');
        });

        // Esperar que el servidor esté listo
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Nuevo usuario
        console.log('📱 TEST 1: Nuevo usuario');
        console.log('='.repeat(50));
        
        const testMessage1 = {
            message: {
                from: '573555666777@s.whatsapp.net',
                from_name: 'Usuario Test E2E',
                chat_id: '573555666777@s.whatsapp.net',
                timestamp: Math.floor(Date.now() / 1000),
                text: {
                    body: 'Hola, quiero información sobre apartamentos en Cartagena'
                },
                type: 'text',
                from_me: false
            }
        };

        const response1 = await axios.post('http://localhost:3001/webhook', testMessage1);
        console.log(`✅ Respuesta webhook: ${JSON.stringify(response1.data)}\n`);

        // Verificar en BD
        const newUser = await prisma.clientView.findUnique({
            where: { phoneNumber: '573555666777@s.whatsapp.net' }
        });
        console.log(`🗄️  Usuario en BD: ${JSON.stringify(newUser, null, 2)}\n`);

        // Test 2: Usuario existente (actualización)
        console.log('📱 TEST 2: Usuario existente');
        console.log('='.repeat(50));

        await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar para timestamp diferente

        const testMessage2 = {
            message: {
                from: '573555666777@s.whatsapp.net',
                from_name: 'Usuario Test Actualizado',
                chat_id: '573555666777@s.whatsapp.net',
                timestamp: Math.floor(Date.now() / 1000),
                text: {
                    body: 'Mensaje de seguimiento'
                },
                type: 'text',
                from_me: false
            }
        };

        const response2 = await axios.post('http://localhost:3001/webhook', testMessage2);
        console.log(`✅ Respuesta webhook: ${JSON.stringify(response2.data)}\n`);

        // Verificar actualización
        const updatedUser = await prisma.clientView.findUnique({
            where: { phoneNumber: '573555666777@s.whatsapp.net' }
        });
        console.log(`🗄️  Usuario actualizado: ${JSON.stringify(updatedUser, null, 2)}\n`);

        // Test 3: Mensaje de voz
        console.log('📱 TEST 3: Mensaje de voz');
        console.log('='.repeat(50));

        const testMessage3 = {
            message: {
                from: '573888999000@s.whatsapp.net',
                from_name: 'Usuario Voz',
                chat_id: '573888999000@s.whatsapp.net',
                timestamp: Math.floor(Date.now() / 1000),
                type: 'voice',
                from_me: false,
                voice: {
                    id: 'voice-test-123',
                    seconds: 15
                }
            }
        };

        const response3 = await axios.post('http://localhost:3001/webhook', testMessage3);
        console.log(`✅ Respuesta webhook: ${JSON.stringify(response3.data)}\n`);

        // Estado final
        const finalCount = await prisma.clientView.count();
        console.log('📊 RESUMEN FINAL:');
        console.log('='.repeat(50));
        console.log(`   Usuarios iniciales: ${initialCount}`);
        console.log(`   Usuarios finales: ${finalCount}`);
        console.log(`   Usuarios creados: ${finalCount - initialCount}`);

        // Mostrar todos los usuarios de prueba
        const testUsers = await prisma.clientView.findMany({
            where: {
                phoneNumber: {
                    in: ['573555666777@s.whatsapp.net', '573888999000@s.whatsapp.net']
                }
            },
            orderBy: { lastActivity: 'desc' }
        });

        console.log('\n👥 Usuarios de prueba creados:');
        testUsers.forEach(user => {
            console.log(`   📞 ${user.phoneNumber}`);
            console.log(`      👤 ${user.userName}`);
            console.log(`      🕐 ${user.lastActivity.toLocaleString()}`);
            console.log('');
        });

        // Cerrar servidor
        server.close();
        console.log('🛑 Servidor webhook cerrado');

    } catch (error) {
        console.error('💥 Error en test:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    } finally {
        await prisma.$disconnect();
        console.log('🔌 Desconectado de PostgreSQL');
    }
}

// Instalar axios si no está disponible
async function ensureAxios() {
    try {
        require('axios');
    } catch (error) {
        console.log('📦 Instalando axios...');
        const { execSync } = require('child_process');
        execSync('npm install axios', { stdio: 'inherit' });
        console.log('✅ Axios instalado\n');
    }
}

// Ejecutar test
if (require.main === module) {
    ensureAxios().then(() => {
        testWebhookFlow()
            .then(() => {
                console.log('✨ Test completado exitosamente');
                process.exit(0);
            })
            .catch((error) => {
                console.error('💥 Error en test:', error);
                process.exit(1);
            });
    });
}

module.exports = { testWebhookFlow };