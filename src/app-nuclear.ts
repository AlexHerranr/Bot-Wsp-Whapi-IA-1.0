// VERSIÓN NUCLEAR - Lo más básico posible
const http = require('http');

const PORT = process.env.PORT || 8080;

console.log('1. Iniciando servidor nuclear...');
console.log('2. Puerto:', PORT);

const server = http.createServer((req, res) => {
    console.log('Request:', req.method, req.url);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    if (req.url === '/health') {
        res.end(JSON.stringify({ 
            status: 'nuclear-ok', 
            time: new Date().toISOString(),
            port: PORT 
        }));
    } else if (req.url === '/hook' && req.method === 'POST') {
        res.end(JSON.stringify({ 
            received: true, 
            time: new Date().toISOString() 
        }));
    } else {
        res.end(JSON.stringify({ 
            service: 'Bot Nuclear', 
            status: 'running',
            endpoints: ['/health', '/hook']
        }));
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`3. ✅ Servidor NUCLEAR escuchando en puerto ${PORT}`);
    console.log(`4. ✅ Health: http://localhost:${PORT}/health`);
    console.log(`5. ✅ Webhook: http://localhost:${PORT}/hook`);
});

server.on('error', (error) => {
    console.error('❌ Error del servidor:', error);
});

console.log('6. Script nuclear completado'); 