// scripts/test-complete-flow.js
const { spawn } = require('child_process');
const http = require('http');

console.log('🧪 PRUEBA DE FLUJO COMPLETO CON BASE DE DATOS');
console.log('==============================================\n');

// Iniciar el servidor
const server = spawn('node', ['dist/main.js'], {
  stdio: 'pipe',
  shell: true
});

let serverOutput = '';

server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('📤 SERVER:', output.trim());
  serverOutput += output;
});

server.stderr.on('data', (data) => {
  const output = data.toString();
  console.log('⚠️ SERVER ERROR:', output.trim());
  serverOutput += output;
});

// Esperar a que el servidor se inicie
setTimeout(async () => {
  console.log('\n📨 Enviando mensaje de prueba...');
  
  const payload = JSON.stringify({
    messages: [{
      id: "msg_test_complete_flow",
      type: "text",
      from_me: false,
      from: "573009876543@s.whatsapp.net",
      chat_id: "573009876543@s.whatsapp.net",
      chat_name: "Test Complete Flow",
      text: {
        body: "Mensaje de prueba para validar flujo completo con base de datos"
      }
    }]
  });
  
  const webhookReq = http.request({
    hostname: 'localhost',
    port: 3008,
    path: '/hook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('✅ Webhook Response:', data);
      
      // Esperar 10 segundos para que se procese el buffer
      console.log('⏳ Esperando 10 segundos para procesamiento...');
      setTimeout(async () => {
        // Verificar base de datos
        console.log('\n🔍 Verificando base de datos...');
        const { spawn: spawnCheck } = require('child_process');
        const checkDB = spawnCheck('npx', ['ts-node', 'scripts/check-db.ts'], {
          stdio: 'pipe',
          shell: true
        });
        
        checkDB.stdout.on('data', (data) => {
          console.log(data.toString());
        });
        
        checkDB.on('close', () => {
          console.log('\n🏁 Prueba completada');
          server.kill('SIGTERM');
          process.exit(0);
        });
        
      }, 10000);
    });
  });
  
  webhookReq.on('error', (err) => {
    console.error('❌ Error en webhook:', err);
    server.kill('SIGTERM');
    process.exit(1);
  });
  
  webhookReq.write(payload);
  webhookReq.end();
  
}, 3000);

server.on('close', (code) => {
  console.log(`\n🔚 Servidor terminado con código: ${code}`);
});