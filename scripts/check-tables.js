#!/usr/bin/env node

const { Client } = require('pg');

async function checkTables() {
    const databaseUrl = 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway';
    
    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('📡 Conectando a Railway DB...');
        await client.connect();
        console.log('✅ Conectado\n');

        // Listar todas las tablas
        console.log('📋 TABLAS EN LA BASE DE DATOS:');
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
        
        // Buscar tablas que contengan "chat" o "whats"
        console.log('\n🔍 TABLAS RELACIONADAS CON CHAT/WHATSAPP:');
        const chatTables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (LOWER(table_name) LIKE '%chat%' OR LOWER(table_name) LIKE '%whats%')
            ORDER BY table_name;
        `);
        
        if (chatTables.rows.length > 0) {
            for (const row of chatTables.rows) {
                console.log(`\n📊 Tabla: ${row.table_name}`);
                
                // Mostrar columnas de cada tabla relacionada
                const columns = await client.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = $1
                    ORDER BY ordinal_position;
                `, [row.table_name]);
                
                console.log('   Columnas:');
                columns.rows.forEach(col => {
                    console.log(`     - ${col.column_name} (${col.data_type})`);
                });
            }
        } else {
            console.log('   No se encontraron tablas con "chat" o "whats" en el nombre');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
        console.log('\n📡 Conexión cerrada');
    }
}

checkTables();