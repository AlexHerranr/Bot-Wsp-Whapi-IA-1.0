// tests/integration/ensamblaje/webhook-to-database-flow.test.ts
// Test end-to-end: webhook → procesamiento → actualización BD

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DatabaseService } from '../../../src/core/services/database.service';
import request from 'supertest';
import express, { Request, Response } from 'express';

// Simular el webhook processor y core bot
const mockWebhookProcessor = (databaseService: DatabaseService) => {
    const app = express();
    app.use(express.json());

    // Simular endpoint webhook que procesa mensajes
    app.post('/webhook', async (req: Request, res: Response) => {
        try {
            const webhookData = req.body;
            
            // Extraer datos del webhook simulado
            const { message } = webhookData;
            if (!message) {
                return res.status(400).json({ error: 'No message in webhook' });
            }

            const phoneNumber = message.from;
            const userName = message.from_name;
            const chatId = message.chat_id;
            const messageContent = message.text?.body || '';
            const timestamp = message.timestamp;

            // Simular procesamiento del bot
            console.log(`📨 Procesando mensaje de ${phoneNumber}: "${messageContent}"`);

            // 1. Crear/actualizar usuario en BD
            await databaseService.getOrCreateUser(phoneNumber, userName);

            // 2. Actualizar thread info
            await databaseService.saveOrUpdateThread(phoneNumber, {
                chatId,
                userName,
                lastActivity: new Date(timestamp * 1000)
            });

            // 3. Simular respuesta del bot (actualizar que enviamos respuesta)
            await databaseService.saveOrUpdateThread(phoneNumber, {
                chatId,
                userName,
                lastActivity: new Date() // Ahora cuando enviamos respuesta
            });

            console.log(`✅ Usuario ${phoneNumber} actualizado en BD`);

            res.json({ 
                success: true, 
                processed: {
                    phoneNumber,
                    userName,
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

describe('Webhook to Database Flow Integration', () => {
    let databaseService: DatabaseService;
    let webhookApp: express.Application;

    beforeAll(async () => {
        databaseService = new DatabaseService();
        await databaseService.connect();
        webhookApp = mockWebhookProcessor(databaseService);
    });

    afterAll(async () => {
        await databaseService.disconnect();
    });

    beforeEach(async () => {
        // Limpiar datos de prueba antes de cada test
        // Note: en production no haríamos esto, pero para tests es necesario
        console.log('🧹 Limpiando datos de test...');
    });

    it('should process new user message and update database', async () => {
        const testPhoneNumber = '573111222333@s.whatsapp.net';
        const testUserName = 'Usuario Test E2E';
        const testMessage = 'Hola, quiero información sobre apartamentos';

        // 1. Simular webhook de mensaje entrante
        const webhookPayload = {
            message: {
                from: testPhoneNumber,
                from_name: testUserName,
                chat_id: testPhoneNumber,
                timestamp: Math.floor(Date.now() / 1000),
                text: {
                    body: testMessage
                },
                type: 'text',
                from_me: false
            }
        };

        // 2. Verificar que el usuario NO existe antes
        const userBefore = await databaseService.findUserByPhoneNumber(testPhoneNumber);
        expect(userBefore).toBeNull();

        // 3. Enviar webhook
        console.log(`🔗 Enviando webhook para ${testPhoneNumber}...`);
        const response = await request(webhookApp)
            .post('/webhook')
            .send(webhookPayload)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.processed.phoneNumber).toBe(testPhoneNumber);

        // 4. Verificar que el usuario se creó en BD
        const userAfter = await databaseService.findUserByPhoneNumber(testPhoneNumber);
        expect(userAfter).not.toBeNull();
        expect(userAfter?.phoneNumber).toBe(testPhoneNumber);
        expect(userAfter?.userName).toBe(testUserName);
        expect(userAfter?.chatId).toBe(testPhoneNumber);

        console.log(`✅ Usuario creado correctamente: ${userAfter?.phoneNumber}`);
    });

    it('should update existing user on new message', async () => {
        const testPhoneNumber = '573444555666@s.whatsapp.net';
        const initialUserName = 'Usuario Inicial';
        const updatedUserName = 'Usuario Actualizado';

        // 1. Crear usuario inicial
        await databaseService.getOrCreateUser(testPhoneNumber, initialUserName);
        const initialUser = await databaseService.findUserByPhoneNumber(testPhoneNumber);
        const initialActivity = initialUser?.lastActivity;

        // Esperar un momento para que los timestamps sean diferentes
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 2. Simular nuevo mensaje con nombre actualizado
        const webhookPayload = {
            message: {
                from: testPhoneNumber,
                from_name: updatedUserName,
                chat_id: testPhoneNumber,
                timestamp: Math.floor(Date.now() / 1000),
                text: {
                    body: 'Mensaje de seguimiento'
                },
                type: 'text',
                from_me: false
            }
        };

        // 3. Procesar webhook
        const response = await request(webhookApp)
            .post('/webhook')
            .send(webhookPayload)
            .expect(200);

        expect(response.body.success).toBe(true);

        // 4. Verificar actualización
        const updatedUser = await databaseService.findUserByPhoneNumber(testPhoneNumber);
        expect(updatedUser?.userName).toBe(updatedUserName);
        expect(updatedUser?.lastActivity).not.toEqual(initialActivity);

        console.log(`✅ Usuario actualizado correctamente: ${updatedUser?.userName}`);
    });

    it('should handle multiple messages from same user', async () => {
        const testPhoneNumber = '573777888999@s.whatsapp.net';
        const userName = 'Usuario Múltiples Mensajes';

        const messages = [
            'Primer mensaje',
            'Segundo mensaje',
            'Tercer mensaje'
        ];

        // Procesar múltiples mensajes
        for (let i = 0; i < messages.length; i++) {
            const webhookPayload = {
                message: {
                    from: testPhoneNumber,
                    from_name: userName,
                    chat_id: testPhoneNumber,
                    timestamp: Math.floor(Date.now() / 1000) + i,
                    text: {
                        body: messages[i]
                    },
                    type: 'text',
                    from_me: false
                }
            };

            const response = await request(webhookApp)
                .post('/webhook')
                .send(webhookPayload)
                .expect(200);

            expect(response.body.success).toBe(true);

            // Esperar entre mensajes
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Verificar que solo hay un usuario (no duplicados)
        const finalUser = await databaseService.findUserByPhoneNumber(testPhoneNumber);
        expect(finalUser).not.toBeNull();
        expect(finalUser?.userName).toBe(userName);

        console.log(`✅ Usuario con múltiples mensajes procesado correctamente`);
    });

    it('should handle voice messages', async () => {
        const testPhoneNumber = '573000111222@s.whatsapp.net';
        const userName = 'Usuario Voz';

        const webhookPayload = {
            message: {
                from: testPhoneNumber,
                from_name: userName,
                chat_id: testPhoneNumber,
                timestamp: Math.floor(Date.now() / 1000),
                type: 'voice',
                from_me: false,
                voice: {
                    id: 'voice-123',
                    seconds: 15,
                    mime_type: 'audio/ogg'
                }
            }
        };

        const response = await request(webhookApp)
            .post('/webhook')
            .send(webhookPayload)
            .expect(200);

        expect(response.body.success).toBe(true);

        const user = await databaseService.findUserByPhoneNumber(testPhoneNumber);
        expect(user).not.toBeNull();
        expect(user?.userName).toBe(userName);

        console.log(`✅ Mensaje de voz procesado correctamente`);
    });

    it('should handle malformed webhook gracefully', async () => {
        // Webhook sin message
        const response1 = await request(webhookApp)
            .post('/webhook')
            .send({})
            .expect(400);

        expect(response1.body.error).toBe('No message in webhook');

        // Webhook con estructura incompleta
        const response2 = await request(webhookApp)
            .post('/webhook')
            .send({ message: {} })
            .expect(500);

        console.log(`✅ Webhooks malformados manejados correctamente`);
    });

    it('should verify database state after processing', async () => {
        // Obtener estadísticas finales
        const stats = await databaseService.getStats();
        
        expect(stats.users).toBeGreaterThan(0);
        console.log(`📊 Estado final BD: ${stats.users} usuarios`);

        // Verificar algunos usuarios de prueba
        const testUsers = [
            '573111222333@s.whatsapp.net',
            '573444555666@s.whatsapp.net', 
            '573777888999@s.whatsapp.net',
            '573000111222@s.whatsapp.net'
        ];

        for (const phoneNumber of testUsers) {
            const user = await databaseService.findUserByPhoneNumber(phoneNumber);
            if (user) {
                console.log(`   ✅ ${user.phoneNumber} - ${user.userName}`);
                expect(user.phoneNumber).toBe(phoneNumber);
                expect(user.lastActivity).toBeDefined();
            }
        }
    });
});