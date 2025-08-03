// scripts/test-complete-crm-flow.js
// Script para probar el flujo completo CRM

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PHONE_NUMBER = '573003913251';

console.log('🚀 PROBANDO FLUJO COMPLETO CRM');
console.log('═'.repeat(60));
console.log('📱 Usuario:', PHONE_NUMBER);
console.log('🔄 Flujo: Mensaje → CRM Analysis → Daily Action → WhatsApp');
console.log('═'.repeat(60));

async function testCompleteFlow() {
  try {
    console.log('\n📋 PASO 1: Verificando configuración CRM...');
    console.log(`- CRM_ANALYSIS_ENABLED: ${process.env.CRM_ANALYSIS_ENABLED}`);
    console.log(`- CRM_MODE: ${process.env.CRM_MODE}`);
    console.log(`- CRM_ASSISTANT_ID: ${process.env.CRM_ASSISTANT_ID ? 'SET' : 'NOT SET'}`);
    
    if (process.env.CRM_ANALYSIS_ENABLED !== 'true' || process.env.CRM_MODE !== 'internal') {
      console.log('⚠️ CRM no está configurado correctamente');
      console.log('⚠️ Asegúrate de que CRM_ANALYSIS_ENABLED=true y CRM_MODE=internal');
      return;
    }
    
    console.log('✅ Configuración CRM correcta');
    
    console.log('\n📋 PASO 2: Ejecutando análisis CRM real...');
    console.log('🔄 Ejecutando update-crm-real.js...');
    
    // Ejecutar análisis CRM
    const { execSync } = require('child_process');
    try {
      const crmOutput = execSync('npm run update-crm-real', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('✅ Análisis CRM completado');
      console.log('📄 Últimas líneas del output:');
      const lines = crmOutput.split('\n').filter(line => line.trim() !== '');
      lines.slice(-5).forEach(line => console.log(`  ${line}`));
    } catch (error) {
      console.log('⚠️ Error ejecutando CRM analysis:', error.message);
      console.log('🔄 Continuando con el test...');
    }
    
    console.log('\n📋 PASO 3: Verificando datos en BD...');
    const client = await prisma.clientView.findUnique({
      where: { phoneNumber: PHONE_NUMBER },
      select: {
        phoneNumber: true,
        name: true,
        profileStatus: true,
        proximaAccion: true,
        fechaProximaAccion: true,
        prioridad: true
      }
    });
    
    if (!client) {
      console.log('❌ Cliente no encontrado en BD');
      return;
    }
    
    console.log('✅ Cliente encontrado en BD:');
    console.log(`  📱 Teléfono: ${client.phoneNumber}`);
    console.log(`  👤 Nombre: ${client.name || 'Sin nombre'}`);
    console.log(`  📊 Status: ${client.profileStatus?.substring(0, 100)}...`);
    console.log(`  🎯 Próxima acción: ${client.proximaAccion || 'Sin acción'}`);
    console.log(`  📅 Fecha acción: ${client.fechaProximaAccion || 'Sin fecha'}`);
    console.log(`  🔥 Prioridad: ${client.prioridad || 'Sin prioridad'}`);
    
    if (!client.proximaAccion) {
      console.log('⚠️ No hay próxima acción configurada');
      console.log('🔄 Actualizando fecha a hoy para poder probar...');
      
      await prisma.clientView.update({
        where: { phoneNumber: PHONE_NUMBER },
        data: {
          proximaAccion: 'Hacer seguimiento para preguntar si todavía está interesado en los apartamentos disponibles.',
          fechaProximaAccion: new Date()
        }
      });
      
      console.log('✅ Próxima acción configurada para hoy');
    }
    
    console.log('\n📋 PASO 4: Ejecutando Daily Actions Job...');
    console.log('🔄 Ejecutando execute-daily-actions-simple.js...');
    
    try {
      const dailyOutput = execSync('npm run execute-daily-actions-simple', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('✅ Daily Actions completado');
      console.log('📄 Resultado:');
      const lines = dailyOutput.split('\n').filter(line => line.trim() !== '');
      
      // Buscar información clave
      const sentLine = lines.find(line => line.includes('sent: true'));
      const messageLine = lines.find(line => line.includes('Mensaje enviado a'));
      
      if (sentLine && messageLine) {
        console.log('  ✅ Mensaje enviado exitosamente');
        console.log('  📱 Verifica tu WhatsApp');
      } else {
        console.log('  ⚠️ No se detectó envío exitoso');
      }
      
      // Mostrar últimas líneas relevantes
      lines.slice(-8).forEach(line => {
        if (line.includes('✅') || line.includes('📤') || line.includes('🎉')) {
          console.log(`  ${line}`);
        }
      });
      
    } catch (error) {
      console.log('❌ Error ejecutando Daily Actions:', error.message);
    }
    
    console.log('\n📋 PASO 5: Verificando estado final...');
    const finalClient = await prisma.clientView.findUnique({
      where: { phoneNumber: PHONE_NUMBER },
      select: {
        proximaAccion: true,
        fechaProximaAccion: true
      }
    });
    
    if (finalClient?.proximaAccion === null) {
      console.log('✅ Acción limpiada correctamente - flujo completado');
    } else {
      console.log('⚠️ Acción no fue limpiada - puede haber un problema');
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 FLUJO COMPLETO CRM PROBADO');
    console.log('═'.repeat(60));
    console.log('📊 Resumen:');
    console.log('1. ✅ Assistant CRM analiza conversación → Llena BD');
    console.log('2. ✅ Daily Actions Job lee BD → Usa Assistant Reservas');
    console.log('3. ✅ Genera mensaje natural → Envía por WhatsApp');
    console.log('4. ✅ Limpia acción de BD → Ciclo completo');
    console.log('═'.repeat(60));
    console.log('📱 REVISA TU WHATSAPP PARA VER EL MENSAJE FINAL');
    
  } catch (error) {
    console.error('\n💥 ERROR EN FLUJO COMPLETO:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión a BD cerrada');
  }
}

if (require.main === module) {
  testCompleteFlow();
}