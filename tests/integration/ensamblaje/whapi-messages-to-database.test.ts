// tests/integration/ensamblaje/whapi-messages-to-database.test.ts
// Test para alimentar BD con datos reales del endpoint WHAPI /messages/list

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DatabaseService } from '../../../src/core/services/database.service';
const fetch = require('node-fetch');

// Configuración WHAPI (usando variables de entorno)
const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud/';
const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

interface WhapiMessage {
    id: string;
    from: string;
    from_name?: string;
    chat_id: string;
    timestamp: number;
    from_me: boolean;
    type: string;
    text?: {
        body: string;
    };
}

interface WhapiMessagesResponse {
    messages: WhapiMessage[];
    count: number;
    total: number;
}

describe('WHAPI Messages to Database Integration', () => {
    let databaseService: DatabaseService;

    beforeAll(async () => {
        // Verificar que tenemos las credenciales necesarias
        if (!WHAPI_TOKEN) {
            throw new Error('WHAPI_TOKEN no está configurado en las variables de entorno');
        }

        databaseService = new DatabaseService();
        await databaseService.connect();
    });

    afterAll(async () => {
        await databaseService.disconnect();
    });

    it('should fetch messages from WHAPI and populate database', async () => {
        // 1. Obtener mensajes del endpoint WHAPI
        const messagesUrl = `${WHAPI_API_URL}messages/list?count=50`;
        
        const response = await fetch(messagesUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        expect(response.ok).toBe(true);
        
        const data = await response.json() as WhapiMessagesResponse;
        expect(data.messages).toBeDefined();
        expect(Array.isArray(data.messages)).toBe(true);
        
        console.log(`📨 Obtenidos ${data.messages.length} mensajes del endpoint WHAPI`);

        // 2. Procesar mensajes y extraer usuarios únicos
        const uniqueUsers = new Map<string, {
            phoneNumber: string;
            userName?: string;
            chatId: string;
            lastActivity: Date;
            messageCount: number;
        }>();

        data.messages.forEach(message => {
            const phoneNumber = message.from;
            const existing = uniqueUsers.get(phoneNumber);
            
            if (!existing || message.timestamp > existing.lastActivity.getTime() / 1000) {
                uniqueUsers.set(phoneNumber, {
                    phoneNumber,
                    userName: message.from_name || existing?.userName,
                    chatId: message.chat_id,
                    lastActivity: new Date(message.timestamp * 1000),
                    messageCount: (existing?.messageCount || 0) + 1
                });
            } else {
                existing.messageCount++;
            }
        });

        console.log(`👥 Identificados ${uniqueUsers.size} usuarios únicos`);

        // 3. Insertar usuarios en la base de datos
        let insertedCount = 0;
        let updatedCount = 0;

        for (const [phoneNumber, userData] of uniqueUsers) {
            try {
                // Verificar si el usuario ya existe
                const existingUser = await databaseService.findUserByPhoneNumber(phoneNumber);
                
                if (existingUser) {
                    // Actualizar usuario existente
                    await databaseService.saveOrUpdateThread(phoneNumber, {
                        chatId: userData.chatId,
                        userName: userData.userName,
                        lastActivity: userData.lastActivity
                    });
                    updatedCount++;
                } else {
                    // Crear nuevo usuario
                    await databaseService.getOrCreateUser(phoneNumber, userData.userName);
                    await databaseService.saveOrUpdateThread(phoneNumber, {
                        chatId: userData.chatId,
                        userName: userData.userName,
                        lastActivity: userData.lastActivity
                    });
                    insertedCount++;
                }

                console.log(`✅ Procesado: ${phoneNumber} (${userData.userName || 'Sin nombre'}) - ${userData.messageCount} mensajes`);
                
            } catch (error) {
                console.error(`❌ Error procesando ${phoneNumber}:`, error);
            }
        }

        // 4. Verificar resultados
        console.log(`📊 RESULTADOS:`);
        console.log(`   - Usuarios nuevos: ${insertedCount}`);
        console.log(`   - Usuarios actualizados: ${updatedCount}`);
        console.log(`   - Total procesados: ${insertedCount + updatedCount}`);

        // Verificar en la base de datos
        const stats = await databaseService.getStats();
        expect(stats.users).toBeGreaterThanOrEqual(insertedCount);
        
        console.log(`📈 Total usuarios en BD: ${stats.users}`);

        // 5. Verificar que los datos se insertaron correctamente
        const sampleUsers = await Promise.all([...uniqueUsers.keys()].slice(0, 3).map(async (phoneNumber) => {
            return await databaseService.findUserByPhoneNumber(phoneNumber);
        }));

        sampleUsers.forEach(user => {
            expect(user).not.toBeNull();
            expect(user?.phoneNumber).toBeDefined();
            expect(user?.lastActivity).toBeDefined();
        });

        // 6. Mostrar algunos ejemplos
        console.log(`\n📋 Ejemplos de usuarios insertados:`);
        sampleUsers.forEach(user => {
            if (user) {
                console.log(`   - ${user.phoneNumber} (${user.userName || 'Sin nombre'})`);
            }
        });

        expect(insertedCount + updatedCount).toBeGreaterThan(0);
    }, 30000); // Timeout de 30 segundos

    it('should handle WHAPI API errors gracefully', async () => {
        // Test con token inválido para verificar manejo de errores
        const invalidUrl = `${WHAPI_API_URL}messages/list?count=1`;
        
        const response = await fetch(invalidUrl, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer invalid-token',
                'Accept': 'application/json'
            }
        });

        // Debería fallar con token inválido
        expect(response.ok).toBe(false);
        console.log(`✅ Manejo correcto de errores de API: ${response.status}`);
    });

    it('should verify database schema compatibility', async () => {
        // Verificar que el schema actual puede manejar los datos
        const testUser = {
            phoneNumber: '573000000000@s.whatsapp.net',
            userName: 'Test Schema User',
            chatId: '573000000000@s.whatsapp.net',
            lastActivity: new Date()
        };

        // Crear usuario de prueba
        await databaseService.getOrCreateUser(testUser.phoneNumber, testUser.userName);
        
        // Verificar que se creó correctamente
        const retrievedUser = await databaseService.findUserByPhoneNumber(testUser.phoneNumber);
        
        expect(retrievedUser).not.toBeNull();
        expect(retrievedUser?.phoneNumber).toBe(testUser.phoneNumber);
        expect(retrievedUser?.userName).toBe(testUser.userName);
        
        console.log(`✅ Schema compatible con datos WHAPI`);
    });
});