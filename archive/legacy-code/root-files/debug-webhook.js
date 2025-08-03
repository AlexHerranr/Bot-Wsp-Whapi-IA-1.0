// Debug webhook format
const axios = require('axios');

const validWebhook = {
  messages: [{
    id: 'msg_123',
    from: '573003913251',
    from_me: false,
    chat_id: '573003913251@s.whatsapp.net',
    from_name: 'Alex',
    type: 'text',
    text: {
      body: 'Hola, ¿qué tal? Como va todo?'
    }
  }]
};

console.log('Valid webhook format:', JSON.stringify(validWebhook, null, 2));

// Test webhook locally
async function testWebhook() {
  try {
    const response = await axios.post('http://localhost:3008/hook', validWebhook, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Webhook response:', response.data);
  } catch (error) {
    console.error('Webhook error:', error.message);
  }
}

// Only test if server is running
if (process.argv.includes('--test')) {
  testWebhook();
}