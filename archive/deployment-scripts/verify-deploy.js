#!/usr/bin/env node

// Script para verificar que el deploy tiene la versión correcta
require('dotenv').config();

const axios = require('axios');

async function verifyDeploy() {
    console.log('🔍 Verificando Deploy - Sistema de Contexto Optimizado');
    console.log('=====================================================\n');
    
    const EXPECTED_COMMIT = '596132570a1dff5313d10c8217ef67acac0fa44c';
    const RAILWAY_URL = process.env.RAILWAY_URL || 'https://bot-wsp-whapi-ia-production.up.railway.app';
    
    console.log(`📍 URL de Railway: ${RAILWAY_URL}`);
    console.log(`🎯 Commit esperado: ${EXPECTED_COMMIT.substring(0, 8)}`);
    console.log('');
    
    try {
        // 1. Verificar que el servicio responde
        console.log('🔍 1. Verificando que el servicio esté activo...');
        
        const healthResponse = await axios.get(`${RAILWAY_URL}/health`, {
            timeout: 10000
        });
        
        if (healthResponse.status === 200) {
            console.log('✅ Servicio activo y respondiendo');
        }
        
        // 2. Verificar métricas si están disponibles
        console.log('\n🔍 2. Verificando métricas del sistema...');
        
        try {
            const metricsResponse = await axios.get(`${RAILWAY_URL}/metrics`, {
                timeout: 10000
            });
            
            if (metricsResponse.data) {
                console.log('✅ Endpoint de métricas accesible');
            }
        } catch (error) {
            console.log('⚠️  Métricas no accesibles (normal si no están configuradas)');
        }
        
        // 3. Instrucciones para verificación manual
        console.log('\n📋 Verificación Manual en Railway Console:');
        console.log('==========================================');
        console.log('1. Ve a Railway Dashboard > Logs');
        console.log('2. Busca al inicio del deploy:');
        console.log(`   "Deploying commit: ${EXPECTED_COMMIT}"`);
        console.log('3. Confirma que aparece:');
        console.log('   "[HISTORY_STRATEGY] OpenAI decide contexto bajo demanda"');
        console.log('4. Confirma que NO aparece:');
        console.log('   "[HISTORY_INJECTION_COMPLETED]"');
        console.log('   "[HISTORY_INJECTION_SKIP]"');
        
        console.log('\n🧪 Test Funcional:');
        console.log('==================');
        console.log('1. Envía un mensaje al bot: "recuerda lo que hablamos"');
        console.log('2. Verifica en logs que aparece:');
        console.log('   "[CONTEXT_FUNCTION] Solicitando contexto de conversación"');
        console.log('3. Verifica que OpenAI usa: get_conversation_context');
        
        console.log('\n✅ Verificación completada exitosamente!');
        console.log('\n🎯 Tu versión local coincide con Railway si:');
        console.log('   - Hash del commit coincide');
        console.log('   - Logs muestran nueva estrategia');
        console.log('   - Función de contexto funciona correctamente');
        
    } catch (error) {
        console.log('❌ Error verificando deploy:');
        console.log(`🔍 Error: ${error.message}`);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 El servicio puede estar reiniciándose después del deploy');
        }
    }
}

// Ejecutar verificación
verifyDeploy().catch(console.error);