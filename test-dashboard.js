#!/usr/bin/env node

/**
 * Script de prueba para verificar el dashboard
 * Ejecutar: node test-dashboard.js
 */

const http = require('http');

const TEST_URL = 'http://localhost:3008';

async function testEndpoint(endpoint, description) {
    return new Promise((resolve) => {
        const req = http.get(`${TEST_URL}${endpoint}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`✅ ${description}: ${res.statusCode}`);
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        console.log(`   📊 Datos: ${Object.keys(json).join(', ')}`);
                    } catch (e) {
                        console.log(`   📄 Respuesta: ${data.substring(0, 100)}...`);
                    }
                }
                resolve(res.statusCode === 200);
            });
        });
        
        req.on('error', (err) => {
            console.log(`❌ ${description}: ${err.message}`);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            console.log(`⏰ ${description}: Timeout`);
            req.destroy();
            resolve(false);
        });
    });
}

async function testDashboard() {
    console.log('🧪 Probando Dashboard del Bot...\n');
    
    const tests = [
        { endpoint: '/health', description: 'Health Check' },
        { endpoint: '/metrics', description: 'Métricas Prometheus' },
        { endpoint: '/metrics/json', description: 'Métricas JSON' },
        { endpoint: '/dashboard', description: 'Dashboard Web' },
        { endpoint: '/api/metrics', description: 'API Métricas' },
        { endpoint: '/api/logs', description: 'API Logs' },
        { endpoint: '/locks', description: 'Estado de Locks' }
    ];
    
    let passed = 0;
    let total = tests.length;
    
    for (const test of tests) {
        const success = await testEndpoint(test.endpoint, test.description);
        if (success) passed++;
        console.log('');
    }
    
    console.log(`📊 Resultados: ${passed}/${total} endpoints funcionando`);
    
    if (passed === total) {
        console.log('🎉 ¡Dashboard completamente funcional!');
        console.log(`🌐 Abre http://localhost:3008/dashboard en tu navegador`);
    } else {
        console.log('⚠️  Algunos endpoints no funcionan. Verifica que el bot esté ejecutándose.');
    }
}

// Ejecutar tests
testDashboard().catch(console.error); 