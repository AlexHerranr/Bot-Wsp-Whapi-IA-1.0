// scripts/clean-duplicate-contacts.js
// Script para limpiar contactos duplicados y dejar solo el correcto

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PHONE_NUMBER = '573003913251';

async function cleanDuplicateContacts() {
  console.log('🧹 LIMPIANDO CONTACTOS DUPLICADOS');
  console.log('═'.repeat(50));
  
  try {
    // Buscar todos los contactos con este número
    console.log(`🔍 Buscando todos los contactos con ${PHONE_NUMBER}...`);
    
    const allContacts = await prisma.clientView.findMany({
      where: {
        OR: [
          { phoneNumber: PHONE_NUMBER },
          { phoneNumber: { contains: '3003913251' } },
          { chatId: { contains: '3003913251' } }
        ]
      },
      orderBy: {
        lastActivity: 'desc' // Más reciente primero
      }
    });
    
    console.log(`📋 Encontrados ${allContacts.length} contactos:`);
    
    allContacts.forEach((contact, index) => {
      console.log(`\n${index + 1}. ID: ${contact.phoneNumber}`);
      console.log(`   Nombre: ${contact.name || contact.userName || 'Sin nombre'}`);
      console.log(`   Chat ID: ${contact.chatId}`);
      console.log(`   Última actividad: ${contact.lastActivity}`);
      console.log(`   Profile Status: ${contact.profileStatus?.substring(0, 100)}...`);
      console.log(`   Próxima acción: ${contact.proximaAccion || 'Sin acción'}`);
    });
    
    if (allContacts.length <= 1) {
      console.log('\n✅ No hay duplicados que limpiar');
      return;
    }
    
    console.log('\n🎯 SELECCIONANDO CONTACTO A MANTENER...');
    
    // Mantener el más reciente o el que tenga más información
    const contactToKeep = allContacts.find(c => c.name || c.userName) || allContacts[0];
    const contactsToDelete = allContacts.filter(c => c.phoneNumber !== contactToKeep.phoneNumber);
    
    console.log(`\n✅ MANTENER: ${contactToKeep.phoneNumber}`);
    console.log(`   Nombre: ${contactToKeep.name || contactToKeep.userName || 'Sin nombre'}`);
    
    console.log(`\n❌ ELIMINAR (${contactsToDelete.length} contactos):`);
    contactsToDelete.forEach(contact => {
      console.log(`   - ${contact.phoneNumber} (${contact.name || contact.userName || 'Sin nombre'})`);
    });
    
    console.log('\n🔄 Eliminando contactos duplicados...');
    
    for (const contact of contactsToDelete) {
      await prisma.clientView.delete({
        where: { phoneNumber: contact.phoneNumber }
      });
      console.log(`   ✅ Eliminado: ${contact.phoneNumber}`);
    }
    
    console.log('\n📋 VERIFICANDO RESULTADO FINAL...');
    const finalContacts = await prisma.clientView.findMany({
      where: {
        OR: [
          { phoneNumber: PHONE_NUMBER },
          { phoneNumber: { contains: '3003913251' } },
          { chatId: { contains: '3003913251' } }
        ]
      }
    });
    
    console.log(`\n✅ RESULTADO: ${finalContacts.length} contacto(s) restante(s)`);
    
    if (finalContacts.length > 0) {
      const remaining = finalContacts[0];
      console.log('\n📋 CONTACTO FINAL:');
      console.log(`   📞 Teléfono: ${remaining.phoneNumber}`);
      console.log(`   👤 Nombre: ${remaining.name || remaining.userName || 'Sin nombre'}`);
      console.log(`   🏷️ Etiquetas: ${[remaining.label1, remaining.label2, remaining.label3].filter(Boolean).join(', ') || 'Sin etiquetas'}`);
      console.log(`   💬 Chat ID: ${remaining.chatId}`);
      console.log(`   📅 Última actividad: ${remaining.lastActivity}`);
    }
    
    console.log('\n🎉 LIMPIEZA COMPLETADA');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión cerrada');
  }
}

if (require.main === module) {
  cleanDuplicateContacts();
}