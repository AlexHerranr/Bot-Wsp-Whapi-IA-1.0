// scripts/verify-field-sources.js
// Script para verificar que todos los campos se llenen según frecuencia y fuente especificadas en el schema

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Especificaciones de campos según el schema Prisma
const FIELD_SPECIFICATIONS = {
  // 🔥 PRIORIDAD VISUAL 1: IDENTIFICACIÓN BÁSICA
  phoneNumber: {
    required: true,
    source: 'webhook message.from',
    frequency: 'Cada mensaje',
    type: 'String',
    description: 'Número de teléfono único del cliente'
  },
  name: {
    required: false,
    source: 'WHAPI getChatInfo().name',
    frequency: 'syncWhapiLabels()',
    type: 'String?',
    description: 'Nombre principal del cliente desde WHAPI'
  },
  userName: {
    required: false,
    source: 'webhook message.from_name',
    frequency: 'Cada mensaje',
    type: 'String?',
    description: 'Nombre del usuario desde mensajes'
  },

  // 🔥 PRIORIDAD VISUAL 2: ETIQUETAS
  label1: {
    required: false,
    source: 'WHAPI getChatInfo().labels[0].name',
    frequency: 'syncWhapiLabels()',
    type: 'String?',
    description: 'Primera etiqueta desde WHAPI'
  },
  label2: {
    required: false,
    source: 'WHAPI getChatInfo().labels[1].name',
    frequency: 'syncWhapiLabels()',
    type: 'String?',
    description: 'Segunda etiqueta desde WHAPI'
  },
  label3: {
    required: false,
    source: 'WHAPI getChatInfo().labels[2].name',
    frequency: 'syncWhapiLabels()',
    type: 'String?',
    description: 'Tercera etiqueta desde WHAPI'
  },

  // 🔥 PRIORIDAD VISUAL 3: CONTACTO
  chatId: {
    required: false,
    source: 'webhook message.chat_id',
    frequency: 'Cada mensaje',
    type: 'String?',
    description: 'ID del chat en WHAPI'
  },

  // 🔥 PRIORIDAD VISUAL 4: ACTIVIDAD RECIENTE
  lastActivity: {
    required: true,
    source: '@updatedAt automático Prisma',
    frequency: 'Cada cambio',
    type: 'DateTime',
    description: 'Última actividad automática'
  },

  // 🔥 PRIORIDAD VISUAL 5: THREAD TÉCNICO
  threadId: {
    required: false,
    source: 'OpenAI al crear thread',
    frequency: 'Al crear/cambiar thread',
    type: 'String?',
    description: 'ID del thread de OpenAI para CRM'
  },

  // 🔥 PRIORIDAD VISUAL 6: CRM - AUTOMATIZADO
  profileStatus: {
    required: false,
    source: 'OpenAI Assistant CRM',
    frequency: 'Análisis CRM',
    type: 'String?',
    description: 'Resumen del cliente (máx 300 chars)'
  },
  proximaAccion: {
    required: false,
    source: 'OpenAI Assistant CRM',
    frequency: 'Análisis CRM',
    type: 'String?',
    description: 'Acción sugerida por IA'
  },
  fechaProximaAccion: {
    required: false,
    source: 'OpenAI Assistant CRM',
    frequency: 'Análisis CRM',
    type: 'DateTime?',
    description: 'Fecha de la acción (YYYY-MM-DD)'
  },
  prioridad: {
    required: false,
    source: 'OpenAI Assistant CRM',
    frequency: 'Análisis CRM',
    type: 'Int? @default(2)',
    description: '1=Alta, 2=Media, 3=Baja'
  }
};

async function verifyFieldSources() {
  console.log('🔍 VERIFICANDO FUENTES Y FRECUENCIAS DE CAMPOS');
  console.log('═'.repeat(70));
  
  try {
    // Obtener todos los clientes
    const clients = await prisma.clientView.findMany();
    console.log(`📊 Total de clientes en BD: ${clients.length}`);
    
    if (clients.length === 0) {
      console.log('⚠️ No hay clientes para analizar');
      return;
    }

    console.log('\n📋 ANÁLISIS POR CAMPO:');
    console.log('═'.repeat(70));

    // Analizar cada campo
    for (const [fieldName, spec] of Object.entries(FIELD_SPECIFICATIONS)) {
      console.log(`\n🔍 ${fieldName.toUpperCase()}`);
      console.log(`   Especificación:`);
      console.log(`   - Requerido: ${spec.required ? '✅ SÍ' : '❌ NO'}`);
      console.log(`   - Tipo: ${spec.type}`);
      console.log(`   - Fuente: ${spec.source}`);
      console.log(`   - Frecuencia: ${spec.frequency}`);
      console.log(`   - Descripción: ${spec.description}`);

      // Analizar valores actuales
      const fieldValues = clients.map(client => client[fieldName]);
      const nonNullValues = fieldValues.filter(val => val !== null && val !== undefined);
      const nullValues = fieldValues.filter(val => val === null || val === undefined);

      console.log(`   Estado actual:`);
      console.log(`   - Valores llenos: ${nonNullValues.length}/${clients.length} (${Math.round(nonNullValues.length/clients.length*100)}%)`);
      console.log(`   - Valores NULL: ${nullValues.length}/${clients.length} (${Math.round(nullValues.length/clients.length*100)}%)`);

      // Verificar si cumple con las especificaciones
      if (spec.required && nullValues.length > 0) {
        console.log(`   ❌ PROBLEMA: Campo requerido tiene valores NULL`);
      } else if (spec.required && nullValues.length === 0) {
        console.log(`   ✅ CORRECTO: Campo requerido está completo`);
      } else if (!spec.required) {
        console.log(`   ✅ CORRECTO: Campo opcional puede tener NULLs`);
      }

      // Mostrar ejemplos de valores
      if (nonNullValues.length > 0) {
        const sampleValue = nonNullValues[0];
        const preview = typeof sampleValue === 'string' ? 
          sampleValue.substring(0, 50) + (sampleValue.length > 50 ? '...' : '') : 
          sampleValue;
        console.log(`   - Ejemplo: ${preview}`);
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log('📊 RESUMEN DE VERIFICACIÓN');
    console.log('═'.repeat(70));

    // Resumen por categorías
    const categories = {
      'IDENTIFICACIÓN BÁSICA': ['phoneNumber', 'name', 'userName'],
      'ETIQUETAS': ['label1', 'label2', 'label3'],
      'CONTACTO': ['chatId'],
      'ACTIVIDAD': ['lastActivity'],
      'THREAD TÉCNICO': ['threadId'],
      'CRM AUTOMATIZADO': ['profileStatus', 'proximaAccion', 'fechaProximaAccion', 'prioridad']
    };

    for (const [category, fields] of Object.entries(categories)) {
      console.log(`\n🔥 ${category}:`);
      
      for (const fieldName of fields) {
        const client = clients[0]; // Usar primer cliente como ejemplo
        const value = client[fieldName];
        const spec = FIELD_SPECIFICATIONS[fieldName];
        
        const status = value !== null && value !== undefined ? '✅' : '❌';
        const valuePreview = value ? 
          (typeof value === 'string' ? value.substring(0, 30) + '...' : value) : 
          'NULL';
        
        console.log(`   ${status} ${fieldName}: ${valuePreview}`);
        
        // Verificar cumplimiento de especificación
        if (spec.required && (value === null || value === undefined)) {
          console.log(`       ⚠️ FALTA: ${spec.source} (${spec.frequency})`);
        }
      }
    }

    console.log('\n🎯 RECOMENDACIONES:');
    
    // Verificar campos críticos faltantes
    const criticalIssues = [];
    const client = clients[0];
    
    if (!client.phoneNumber) criticalIssues.push('phoneNumber');
    if (!client.lastActivity) criticalIssues.push('lastActivity');
    
    if (criticalIssues.length === 0) {
      console.log('✅ Todos los campos requeridos están presentes');
    } else {
      console.log('❌ Campos requeridos faltantes:', criticalIssues.join(', '));
    }

    // Verificar campos CRM
    const crmFields = ['profileStatus', 'proximaAccion', 'prioridad'];
    const crmComplete = crmFields.every(field => client[field] !== null);
    
    if (crmComplete) {
      console.log('✅ Análisis CRM completo - todos los campos CRM llenos');
    } else {
      const missingCrm = crmFields.filter(field => client[field] === null);
      console.log('⚠️ Análisis CRM incompleto - campos faltantes:', missingCrm.join(', '));
      console.log('💡 Ejecutar análisis CRM para llenar estos campos');
    }

    // Verificar threadId
    if (client.threadId) {
      console.log('✅ ThreadId presente - threads siendo guardados correctamente');
    } else {
      console.log('⚠️ ThreadId faltante - verificar que se guarde el thread después del análisis');
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
  verifyFieldSources();
}

module.exports = { FIELD_SPECIFICATIONS, verifyFieldSources };