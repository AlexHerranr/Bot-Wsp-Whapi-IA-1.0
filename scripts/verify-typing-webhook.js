#!/usr/bin/env node

/**
 * 🔍 Script de Verificación de Webhook de Typing
 * 
 * Este script verifica que el webhook de presencia esté configurado
 * correctamente en WHAPI para recibir eventos de typing.
 */

const fetch = require('node-fetch');

// Configuración
const config = {
    whapiToken: process.env.WHAPI_TOKEN,
    whapiApiUrl: process.env.WHAPI_API_URL || 'https://api.whapi.com'
};

async function verifyWebhookConfiguration() {
    console.log('🔍 Verificando configuración de webhook de typing...\n');
    
    if (!config.whapiToken) {
        console.error('❌ Error: WHAPI_TOKEN no configurado');
        console.log('💡 Ejecuta: export WHAPI_TOKEN=tu_token_aqui');
        process.exit(1);
    }
    
    try {
        // Obtener configuración actual de webhooks
        const response = await fetch(`${config.whapiApiUrl}/settings`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.whapiToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const settings = await response.json();
        
        console.log('📊 Configuración actual de webhooks:');
        console.log('=====================================');
        
        if (settings.webhooks && Array.isArray(settings.webhooks)) {
            settings.webhooks.forEach((webhook, index) => {
                console.log(`\n🔗 Webhook ${index + 1}:`);
                console.log(`   URL: ${webhook.url}`);
                console.log(`   Modo: ${webhook.mode || 'body'}`);
                
                if (webhook.events && Array.isArray(webhook.events)) {
                    console.log('   Eventos configurados:');
                    webhook.events.forEach(event => {
                        const status = event.type === 'presences' && event.method === 'post' ? '✅' : '❌';
                        console.log(`     ${status} ${event.type}: ${event.method}`);
                    });
                } else {
                    console.log('   ❌ No hay eventos configurados');
                }
            });
        } else {
            console.log('❌ No hay webhooks configurados');
        }
        
        // Verificar si el webhook de presencia está activo
        const hasPresenceWebhook = settings.webhooks?.some(webhook => 
            webhook.events?.some(event => 
                event.type === 'presences' && event.method === 'post'
            )
        );
        
        console.log('\n🎯 Estado del webhook de typing:');
        console.log('================================');
        
        if (hasPresenceWebhook) {
            console.log('✅ Webhook de presencia (typing) está configurado');
            console.log('✅ El bot puede recibir eventos de typing');
        } else {
            console.log('❌ Webhook de presencia (typing) NO está configurado');
            console.log('❌ El bot NO puede recibir eventos de typing');
            console.log('\n💡 Para configurar el webhook de typing:');
            console.log('   node scripts/setup-typing-webhook.js');
        }
        
        // Mostrar información adicional
        console.log('\n📋 Información adicional:');
        console.log('========================');
        console.log('• Los eventos de typing solo funcionan si:');
        console.log('  - El usuario no tiene "visto por última vez" oculto');
        console.log('  - Ya ha interactuado previamente con el bot');
        console.log('  - El bot está suscrito a su presencia');
        console.log('\n• Para probar el sistema:');
        console.log('  node scripts/test-typing-system.js');
        
    } catch (error) {
        console.error('❌ Error verificando configuración:', error.message);
        
        if (error.message.includes('401')) {
            console.log('\n💡 El token de WHAPI parece ser inválido');
            console.log('   Verifica que WHAPI_TOKEN esté configurado correctamente');
        } else if (error.message.includes('403')) {
            console.log('\n💡 No tienes permisos para acceder a la configuración');
            console.log('   Verifica que el token tenga permisos de lectura');
        }
    }
}

async function testPresenceSubscription() {
    console.log('\n🧪 Probando suscripción a presencia...\n');
    
    if (!config.whapiToken) {
        console.error('❌ Error: WHAPI_TOKEN no configurado');
        return;
    }
    
    const testUserId = process.env.TEST_USER_ID || '573235906292';
    
    try {
        // Intentar suscribirse a presencia del usuario de prueba
        const response = await fetch(`${config.whapiApiUrl}/presences/${testUserId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.whapiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // No necesitamos enviar datos específicos para suscribirnos
            })
        });
        
        console.log(`📤 Intentando suscribirse a presencia de ${testUserId}...`);
        
        if (response.ok) {
            console.log('✅ Suscripción a presencia exitosa');
            console.log('✅ El bot puede recibir eventos de typing de este usuario');
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.log(`❌ Error en suscripción: ${response.status} ${response.statusText}`);
            
            if (errorData.error) {
                console.log(`   Detalles: ${errorData.error.message}`);
            }
            
            if (response.status === 404) {
                console.log('💡 El usuario no existe o no está disponible');
            } else if (response.status === 403) {
                console.log('💡 No tienes permisos para suscribirte a este usuario');
            }
        }
        
    } catch (error) {
        console.error('❌ Error en suscripción:', error.message);
    }
}

async function main() {
    console.log('🚀 Verificación completa del sistema de typing...\n');
    
    await verifyWebhookConfiguration();
    await testPresenceSubscription();
    
    console.log('\n✅ Verificación completada!');
    console.log('📝 Si hay problemas, revisa la configuración de WHAPI');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    verifyWebhookConfiguration,
    testPresenceSubscription
}; 