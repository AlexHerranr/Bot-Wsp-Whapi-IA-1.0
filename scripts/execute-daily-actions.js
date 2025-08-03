// scripts/execute-daily-actions.js
// Script para ejecutar manualmente el daily actions job

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { DatabaseService } = require('../dist/src/core/services/database.service');
const { DailyActionsJob } = require('../dist/src/core/jobs/daily-actions.job');

console.log('🚀 EJECUTANDO DAILY ACTIONS JOB MANUALMENTE');
console.log('═'.repeat(60));

async function executeDailyActions() {
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
  
  try {
    console.log('🔧 Inicializando servicios...');
    
    // Inicializar DatabaseService
    const dbService = new DatabaseService();
    
    // Inicializar DailyActionsJob
    const dailyActionsJob = new DailyActionsJob(dbService);
    
    console.log('✅ Servicios inicializados');
    console.log('📅 Ejecutando acciones diarias...');
    
    // Ejecutar manualmente
    await dailyActionsJob.executeManual();
    
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 DAILY ACTIONS COMPLETADO');
    console.log('═'.repeat(60));
    console.log('📱 Verifica tu WhatsApp para ver si llegó el mensaje');
    
  } catch (error) {
    console.error('\n💥 ERROR EJECUTANDO DAILY ACTIONS:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
    console.log('\n👋 Conexión a BD cerrada');
  }
}

// Ejecutar script
if (require.main === module) {
  executeDailyActions();
}