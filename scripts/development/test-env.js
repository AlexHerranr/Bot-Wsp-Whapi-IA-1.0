import 'dotenv/config';

console.log('🔑 Verificando credenciales...\n');

// Verificar OpenAI
console.log('🤖 OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Configurado' : '❌ Faltante');
console.log('🤖 ASSISTANT_ID:', process.env.ASSISTANT_ID ? '✅ Configurado' : '❌ Faltante');

// Verificar Whapi
console.log('📱 WHAPI_TOKEN:', process.env.WHAPI_TOKEN ? '✅ Configurado' : '❌ Faltante');
console.log('📱 WHAPI_API_URL:', process.env.WHAPI_API_URL ? '✅ Configurado' : '❌ Faltante');

// Verificar Beds24
console.log('🏨 BEDS24_TOKEN:', process.env.BEDS24_TOKEN ? '✅ Configurado' : '❌ Faltante');
console.log('🏨 BEDS24_API_URL:', process.env.BEDS24_API_URL ? '✅ Configurado' : '❌ Faltante');

// Verificar configuración
console.log('🌐 PORT:', process.env.PORT || '3008 (default)');
console.log('🔧 NGROK_DOMAIN:', process.env.NGROK_DOMAIN ? '✅ Configurado' : '❌ Faltante');

console.log('\n📊 RESUMEN:');
const requiredVars = ['OPENAI_API_KEY', 'ASSISTANT_ID', 'WHAPI_TOKEN', 'BEDS24_TOKEN'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length === 0) {
    console.log('✅ TODAS las credenciales obligatorias están configuradas');
    console.log('🚀 El bot debería funcionar correctamente');
} else {
    console.log('❌ Faltan credenciales:', missingVars.join(', '));
    console.log('⚠️ El bot NO funcionará sin estas variables');
} 