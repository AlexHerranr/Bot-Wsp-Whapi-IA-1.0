import "dotenv/config";
import express from 'express';

// Configuración mínima
const PORT = parseInt(process.env.PORT || '8080', 10);
const app = express();

app.use(express.json());

// Health check INMEDIATO
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        port: PORT,
        timestamp: new Date().toISOString(),
        version: 'emergency'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        service: 'TeAlquilamos Bot',
        status: 'running',
        version: '1.0.0-emergency'
    });
});

// Webhook básico - solo responde 200
app.post('/hook', (req, res) => {
    console.log('📩 Webhook recibido:', new Date().toISOString());
    console.log('📊 Body size:', JSON.stringify(req.body).length);
    res.status(200).json({ 
        received: true, 
        timestamp: new Date().toISOString() 
    });
});

// INICIAR SERVIDOR INMEDIATAMENTE
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor EMERGENCY iniciado en puerto ${PORT}`);
    console.log(`📍 Health: http://localhost:${PORT}/health`);
    console.log(`📍 Webhook: http://localhost:${PORT}/hook`);
});

// Inicialización diferida - NO bloquea el servidor
setTimeout(() => {
    console.log('⚡ Inicializando componentes en background...');
    console.log('✅ Bot emergency listo para recibir webhooks');
}, 2000);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⏹️  SIGTERM recibido, cerrando servidor...');
    server.close(() => {
        console.log('👋 Servidor cerrado correctamente');
        process.exit(0);
    });
});

export { app }; 