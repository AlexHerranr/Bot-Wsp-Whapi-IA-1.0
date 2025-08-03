// scripts/verify-database-updates.js
// Script para verificar qué datos se están guardando en la BD

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PHONE_NUMBER = '573003913251';

async function verifyDatabaseUpdates() {
  console.log('🔍 VERIFICANDO ACTUALIZACIONES EN BASE DE DATOS');
  console.log('═'.repeat(60));
  
  try {
    console.log('📋 PASO 1: Verificando datos actuales del cliente...');
    
    const client = await prisma.clientView.findUnique({
      where: { phoneNumber: PHONE_NUMBER }
    });
    
    if (!client) {
      console.log('❌ Cliente no encontrado');
      return;
    }
    
    console.log('✅ Cliente encontrado:');
    console.log(JSON.stringify(client, null, 2));
    
    console.log('\n🔍 PASO 2: Analizando campos CRM...');
    
    const crmFields = {
      profileStatus: client.profileStatus,
      proximaAccion: client.proximaAccion,
      fechaProximaAccion: client.fechaProximaAccion,
      prioridad: client.prioridad,
      threadId: client.threadId
    };
    
    console.log('📊 Campos CRM:');
    Object.entries(crmFields).forEach(([field, value]) => {
      const status = value !== null ? '✅ SET' : '❌ NULL';
      const preview = value ? (typeof value === 'string' ? value.substring(0, 50) + '...' : value) : 'null';
      console.log(`   ${field}: ${status} - ${preview}`);
    });
    
    console.log('\n🔍 PASO 3: Verificando todas las tablas...');
    
    // Verificar otras tablas relacionadas
    try {
      // Verificar tabla de threads si existe
      const threadTables = await prisma.$queryRaw`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND (name LIKE '%thread%' OR name LIKE '%Thread%');
      `;
      console.log('📋 Tablas de threads encontradas:', threadTables);
      
      // Verificar tabla de mensajes si existe
      const messageTables = await prisma.$queryRaw`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND (name LIKE '%message%' OR name LIKE '%Message%');
      `;
      console.log('📋 Tablas de mensajes encontradas:', messageTables);
      
      // Verificar todas las tablas
      const allTables = await prisma.$queryRaw`
        SELECT name FROM sqlite_master WHERE type='table';
      `;
      console.log('📋 Todas las tablas:', allTables.map(t => t.name));
      
    } catch (error) {
      console.log('⚠️ Error verificando tablas:', error.message);
    }
    
    console.log('\n🔍 PASO 4: Verificando schema de ClientView...');
    
    try {
      const tableInfo = await prisma.$queryRaw`PRAGMA table_info(ClientView);`;
      console.log('📋 Campos de ClientView:');
      tableInfo.forEach(field => {
        console.log(`   - ${field.name}: ${field.type} ${field.notnull ? 'NOT NULL' : 'NULLABLE'}`);
      });
    } catch (error) {
      console.log('⚠️ Error obteniendo schema:', error.message);
    }
    
    console.log('\n❓ DIAGNÓSTICO:');
    
    if (!client.profileStatus) {
      console.log('❌ profileStatus está NULL - El análisis CRM no se guardó');
    } else {
      console.log('✅ profileStatus está lleno - Análisis CRM guardado correctamente');
    }
    
    if (!client.threadId) {
      console.log('❌ threadId está NULL - No se está guardando el thread ID');
      console.log('   💡 Esto puede ser normal si no hay una tabla separada de threads');
    } else {
      console.log('✅ threadId está lleno - Thread ID guardado');
    }
    
    if (!client.proximaAccion) {
      console.log('❌ proximaAccion está NULL - Puede haberse limpiado por el daily action');
    } else {
      console.log('✅ proximaAccion está llena - Próxima acción guardada');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión cerrada');
  }
}

if (require.main === module) {
  verifyDatabaseUpdates();
}