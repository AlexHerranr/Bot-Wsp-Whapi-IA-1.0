// Verificar configuración actual del webhook
import https from 'https';
import { config } from 'dotenv';

config();

const WHAPI_TOKEN = process.env.WHAPI_TOKEN;

const options = {
    hostname: 'gate.whapi.cloud',
    port: 443,
    path: '/settings',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${WHAPI_TOKEN}`,
        'Accept': 'application/json'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const settings = JSON.parse(data);
        const webhook = settings.webhooks?.[0];
        
        console.log('🔍 URL actual del webhook:', webhook?.url);
        console.log('📋 Eventos configurados:', webhook?.events?.map(e => e.type).join(', '));
        
        if (webhook?.url?.endsWith('/hook')) {
            console.log('✅ URL correcta - apunta a /hook');
        } else {
            console.log('❌ URL incorrecta - debe apuntar a /hook');
            console.log('💡 Necesita actualización');
        }
    });
});

req.on('error', (error) => console.error('❌ Error:', error.message));
req.end(); 