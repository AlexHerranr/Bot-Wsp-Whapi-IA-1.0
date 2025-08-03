// scripts/test-crm-system.js
// Script para probar el sistema CRM sin iniciar el bot completo

console.log('🧪 Testing CRM System Configuration...\n');

// Verificar variables de entorno
console.log('📋 Environment Variables:');
console.log(`- CRM_MODE: ${process.env.CRM_MODE || 'NOT SET'}`);
console.log(`- CRM_ANALYSIS_ENABLED: ${process.env.CRM_ANALYSIS_ENABLED || 'NOT SET'}`);
console.log(`- CRM_ASSISTANT_ID: ${process.env.CRM_ASSISTANT_ID || 'NOT SET'}`);
console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET ✅' : 'NOT SET ❌'}`);
console.log('');

// Test básico de OpenAI connection
if (process.env.OPENAI_API_KEY && process.env.CRM_ASSISTANT_ID) {
  console.log('🔌 Testing OpenAI Connection...');
  
  const OpenAI = require('openai').OpenAI;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Test simple
  openai.models.list()
    .then(() => {
      console.log('✅ OpenAI API connection: OK');
      
      // Test Assistant exists
      return openai.beta.assistants.retrieve(process.env.CRM_ASSISTANT_ID);
    })
    .then((assistant) => {
      console.log(`✅ CRM Assistant found: ${assistant.name || 'Unnamed'}`);
      console.log(`   Model: ${assistant.model}`);
      console.log(`   Instructions: ${assistant.instructions?.substring(0, 100)}...`);
      console.log('');
      console.log('🎉 CRM System Ready!');
      console.log('');
      console.log('📝 Next Steps:');
      console.log('1. npm run dev          # Start bot');
      console.log('2. Send WhatsApp message # Trigger CRM analysis');
      console.log('3. Check logs for CRM updates');
    })
    .catch((error) => {
      console.log(`❌ Error: ${error.message}`);
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('- Check CRM_ASSISTANT_ID is correct');
      console.log('- Verify Assistant exists in OpenAI dashboard');
      console.log('- Check OPENAI_API_KEY permissions');
    });
} else {
  console.log('❌ Missing required environment variables');
  console.log('');
  console.log('🔧 Required Setup:');
  console.log('1. Set OPENAI_API_KEY in .env');
  console.log('2. Set CRM_ASSISTANT_ID in .env');
  console.log('3. Run: node scripts/test-crm-system.js');
}