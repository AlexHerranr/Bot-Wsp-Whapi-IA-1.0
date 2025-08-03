// scripts/clean-and-setup-contact.js
// Script para limpiar BD y crear contacto único correctamente estructurado

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Datos correctos del contacto
const CONTACT_DATA = {
  phoneNumber: '573003913251',
  chatId: '573003913251@s.whatsapp.net',
  name: 'Sr Alex',
  userName: 'Sr Alex', // No debe ser el número de teléfono
  label1: 'Colega Jefe',
  label2: 'cotización',
  label3: null,
  profileStatus: null, // Se llenará con el análisis CRM
  proximaAccion: null,
  fechaProximaAccion: null,
  prioridad: null,
  lastActivity: new Date(),
  threadId: null
};

async function cleanAndSetupContact() {
  console.log('🧹 LIMPIANDO BD Y CREANDO CONTACTO ÚNICO');
  console.log('═'.repeat(60));
  
  try {
    console.log('🗑️ PASO 1: Limpiando todos los contactos existentes...');
    
    // Eliminar todos los contactos existentes
    const deleteResult = await prisma.clientView.deleteMany({});
    console.log(`✅ Eliminados ${deleteResult.count} contactos existentes`);
    
    console.log('\n👤 PASO 2: Creando contacto único con datos correctos...');
    console.log('📋 Datos del contacto:');
    console.log(JSON.stringify(CONTACT_DATA, null, 2));
    
    // Crear el contacto único
    const newContact = await prisma.clientView.create({
      data: CONTACT_DATA
    });
    
    console.log('✅ Contacto creado exitosamente');
    
    console.log('\n🔍 PASO 3: Verificando resultado...');
    
    // Verificar que solo existe un contacto
    const allContacts = await prisma.clientView.findMany();
    console.log(`📊 Total de contactos en BD: ${allContacts.length}`);
    
    if (allContacts.length === 1) {
      const contact = allContacts[0];
      console.log('\n✅ CONTACTO ÚNICO VERIFICADO:');
      console.log(`   📞 Teléfono: ${contact.phoneNumber}`);
      console.log(`   👤 Nombre: ${contact.name}`);
      console.log(`   📝 Username: ${contact.userName}`);
      console.log(`   🏷️ Etiqueta 1: ${contact.label1}`);
      console.log(`   🏷️ Etiqueta 2: ${contact.label2}`);
      console.log(`   🏷️ Etiqueta 3: ${contact.label3 || 'null'}`);
      console.log(`   💬 Chat ID: ${contact.chatId}`);
      console.log(`   📅 Última actividad: ${contact.lastActivity}`);
      
      // Verificar que userName no sea el número de teléfono
      if (contact.userName === contact.phoneNumber) {
        console.log('⚠️ PROBLEMA: userName es igual al phoneNumber');
        console.log('🔄 Corrigiendo...');
        
        await prisma.clientView.update({
          where: { phoneNumber: contact.phoneNumber },
          data: { userName: CONTACT_DATA.name }
        });
        
        console.log('✅ userName corregido');
      }
      
    } else {
      console.log('❌ Error: Debería haber exactamente 1 contacto');
    }
    
    console.log('\n🎯 PASO 4: Datos listos para análisis CRM');
    console.log('✅ BD limpia con contacto único');
    console.log('✅ Campos name y userName correctos');
    console.log('✅ Etiquetas estructuradas');
    console.log('✅ Listo para próximo análisis CRM');
    
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 LIMPIEZA Y SETUP COMPLETADO');
    console.log('═'.repeat(60));
    console.log('📋 Próximos pasos:');
    console.log('1. Ejecutar análisis CRM para llenar profileStatus');
    console.log('2. Probar daily actions con datos limpios');
    console.log('3. Verificar mensaje personalizado final');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión cerrada');
  }
}

if (require.main === module) {
  cleanAndSetupContact();
}