require('dotenv').config();
/**
 * PostgreSQL Data Viewer Script
 * Permite visualizar los datos de la base de datos PostgreSQL
 * Uso: node scripts/view-postgresql-data.js
 * 
 * Nota: Usa formatos reales de WHAPI (573003913251@s.whatsapp.net)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = 
// DATABASE_URL Railway check
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL no encontrada - verifica tu .env');
    process.exit(1);
}

if (!process.env.DATABASE_URL.includes('railway')) {
    console.warn('⚠️  DATABASE_URL no parece ser de Railway');
}

new PrismaClient();

async function viewDatabaseData() {
  try {
    console.log('🔍 Conectando a PostgreSQL...');
    
    // 1. Contar total de usuarios
    const totalUsers = await prisma.clientView.count();
    console.log(`📊 Total usuarios en PostgreSQL: ${totalUsers}`);
    
    // 2. Mostrar usuarios recientes (últimos 10)
    console.log('\n📱 Usuarios más recientes:');
    console.log('=' .repeat(80));
    
    const recentUsers = await prisma.clientView.findMany({
      orderBy: { lastActivity: 'desc' },
      take: 10
    });
    
    for (const user of recentUsers) {
      const phone = user.phoneNumber || 'Sin teléfono';
      const name = user.userName || 'Sin nombre';
      const priority = user.prioridad;
      const labels = [user.label1, user.label2, user.label3].filter(Boolean).join(', ') || 'Sin labels';
      const lastActivity = user.lastActivity ? user.lastActivity.toLocaleString('es-CO') : 'N/A';
      
      console.log(`📞 ${phone}`);
      console.log(`   👤 ${name} | 🔥 ${priority} | 🏷️  ${labels}`);
      console.log(`   ⏰ Última actividad: ${lastActivity}`);
      console.log('-'.repeat(80));
    }
    
    // 3. Estadísticas por prioridad
    console.log('\n📊 Distribución por prioridad:');
    const priorities = await prisma.clientView.groupBy({
      by: ['prioridad'],
      _count: {
        prioridad: true
      }
    });
    
    for (const priority of priorities) {
      console.log(`   ${priority.prioridad}: ${priority._count.prioridad} usuarios`);
    }
    
    // 4. Labels más comunes
    console.log('\n🏷️  Labels más comunes:');
    const allUsers = await prisma.clientView.findMany({
      select: { label1: true, label2: true, label3: true }
    });
    
    const labelCounts = {};
    for (const user of allUsers) {
      [user.label1, user.label2, user.label3].forEach(label => {
        if (label) {
          labelCounts[label] = (labelCounts[label] || 0) + 1;
        }
      });
    }
    
    const topLabels = Object.entries(labelCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    
    for (const [label, count] of topLabels) {
      console.log(`   ${label}: ${count} veces`);
    }
    
    // 5. Actividad reciente (últimas 24 horas)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentActivity = await prisma.clientView.count({
      where: {
        lastActivity: {
          gte: yesterday
        }
      }
    });
    
    console.log(`\n⚡ Usuarios activos en las últimas 24h: ${recentActivity}`);
    
    console.log('\n✅ Consulta completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error consultando la base de datos:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para mostrar un usuario específico
async function viewSpecificUser(phoneNumber) {
  try {
    console.log(`🔍 Buscando usuario: ${phoneNumber}`);
    
    const user = await prisma.clientView.findUnique({
      where: { phoneNumber }
    });
    
    if (user) {
      console.log('\n👤 Usuario encontrado:');
      console.log(JSON.stringify(user, null, 2));
    } else {
      console.log('❌ Usuario no encontrado');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función para buscar por texto
async function searchUsers(searchTerm) {
  try {
    console.log(`🔍 Buscando usuarios que contengan: "${searchTerm}"`);
    
    const users = await prisma.clientView.findMany({
      where: {
        OR: [
          { userName: { contains: searchTerm, mode: 'insensitive' } },
          { phoneNumber: { contains: searchTerm } },
          { label1: { contains: searchTerm, mode: 'insensitive' } },
          { label2: { contains: searchTerm, mode: 'insensitive' } },
          { label3: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      take: 20
    });
    
    console.log(`\n📊 Encontrados ${users.length} usuarios:`);
    for (const user of users) {
      console.log(`📞 ${user.phoneNumber} - ${user.userName || 'Sin nombre'} (${user.prioridad})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Vista general
    await viewDatabaseData();
  } else if (args[0] === 'user' && args[1]) {
    // Ver usuario específico
    await viewSpecificUser(args[1]);
  } else if (args[0] === 'search' && args[1]) {
    // Buscar usuarios
    await searchUsers(args[1]);
  } else {
    console.log('📋 Uso del script:');
    console.log('  node scripts/view-postgresql-data.js              # Vista general');
    console.log('  node scripts/view-postgresql-data.js user [phone] # Usuario específico');
    console.log('  node scripts/view-postgresql-data.js search [term] # Buscar usuarios');
  }
}

main().catch(console.error);