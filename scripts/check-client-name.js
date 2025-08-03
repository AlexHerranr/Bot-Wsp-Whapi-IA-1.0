// scripts/check-client-name.js
// Script para verificar el nombre del cliente en la BD

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PHONE_NUMBER = '573003913251';

async function checkClientName() {
  console.log('🔍 VERIFICANDO NOMBRE DEL CLIENTE EN BD');
  console.log('═'.repeat(50));
  
  try {
    // Obtener todos los campos relacionados con el nombre
    const client = await prisma.clientView.findUnique({
      where: { phoneNumber: PHONE_NUMBER }
    });
    
    if (!client) {
      console.log('❌ Cliente no encontrado');
      return;
    }
    
    console.log('📋 TODOS LOS CAMPOS DEL CLIENTE:');
    console.log(JSON.stringify(client, null, 2));
    
    console.log('\n🎯 CAMPOS DE NOMBRE ESPECÍFICOS:');
    console.log(`- name: "${client.name}"`);
    console.log(`- userName: "${client.userName}"`);
    console.log(`- phoneNumber: "${client.phoneNumber}"`);
    
    console.log('\n🔄 LÓGICA ACTUAL DE NOMBRE:');
    const clientName = client.name || client.userName || 'Cliente';
    console.log(`- Resultado: "${clientName}"`);
    console.log(`- ¿Por qué "Cliente"? name=${client.name ? 'SET' : 'NULL'}, userName=${client.userName ? 'SET' : 'NULL'}`);
    
    if (!client.name && !client.userName) {
      console.log('\n⚠️ PROBLEMA IDENTIFICADO:');
      console.log('- Los campos "name" y "userName" están ambos en NULL');
      console.log('- Por eso usa el fallback "Cliente"');
      
      console.log('\n🔍 VERIFICANDO OTROS CAMPOS QUE PODRÍAN TENER EL NOMBRE:');
      const possibleNameFields = [
        'contactName', 'displayName', 'firstName', 'lastName', 
        'fullName', 'clientName', 'whatsappName'
      ];
      
      possibleNameFields.forEach(field => {
        if (client[field] !== undefined) {
          console.log(`- ${field}: "${client[field]}"`);
        }
      });
    }
    
    console.log('\n🔧 SUGERENCIAS:');
    console.log('1. Verificar de dónde viene el nombre real del cliente');
    console.log('2. Actualizar el campo "name" o "userName" con el nombre correcto');
    console.log('3. Verificar si el nombre se obtiene de WHAPI correctamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión cerrada');
  }
}

if (require.main === module) {
  checkClientName();
}