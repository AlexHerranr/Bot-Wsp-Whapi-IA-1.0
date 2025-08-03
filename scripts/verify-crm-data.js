// scripts/verify-crm-data.js
require('dotenv').config();
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

async function main() {
  const client = await prisma.clientView.findUnique({
    where: { phoneNumber: '573003913251' }
  });
  
  console.log('📋 Cliente CRM en BD:');
  console.log(JSON.stringify(client, null, 2));
  
  await prisma.$disconnect();
}

main().catch(console.error);