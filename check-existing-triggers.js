// Script para revisar triggers existentes en la tabla "Chats"
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway',
    ssl: { rejectUnauthorized: false }
});

async function checkExistingTriggers() {
    const client = await pool.connect();
    
    try {
        console.log('🔍 Revisando triggers existentes en tabla "Chats"...\n');
        
        // 1. Listar todos los triggers en la tabla Chats
        const triggersQuery = `
            SELECT 
                t.trigger_name,
                t.event_manipulation,
                t.action_timing,
                t.action_statement,
                t.trigger_schema
            FROM information_schema.triggers t 
            WHERE t.event_object_table = 'Chats'
            ORDER BY t.trigger_name;
        `;
        
        const triggers = await client.query(triggersQuery);
        
        if (triggers.rows.length === 0) {
            console.log('✅ No hay triggers existentes en la tabla "Chats"');
        } else {
            console.log(`⚠️ Encontrados ${triggers.rows.length} triggers existentes:\n`);
            triggers.rows.forEach((trigger, index) => {
                console.log(`${index + 1}. Trigger: "${trigger.trigger_name}"`);
                console.log(`   - Evento: ${trigger.event_manipulation}`);
                console.log(`   - Timing: ${trigger.action_timing}`);
                console.log(`   - Esquema: ${trigger.trigger_schema}`);
                console.log(`   - Statement: ${trigger.action_statement}\n`);
            });
        }
        
        // 2. Listar funciones relacionadas con threads o chats
        const functionsQuery = `
            SELECT 
                p.proname as function_name,
                pg_get_functiondef(p.oid) as function_definition
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
            AND (
                p.proname ILIKE '%thread%' 
                OR p.proname ILIKE '%chat%'
                OR p.proname ILIKE '%prevent%'
                OR p.proname ILIKE '%cleanup%'
            )
            ORDER BY p.proname;
        `;
        
        const functions = await client.query(functionsQuery);
        
        if (functions.rows.length === 0) {
            console.log('✅ No hay funciones relacionadas con threads/chats');
        } else {
            console.log(`📋 Encontradas ${functions.rows.length} funciones relacionadas:\n`);
            functions.rows.forEach((func, index) => {
                console.log(`${index + 1}. Función: "${func.function_name}"`);
                console.log(`   Definition preview: ${func.function_definition.substring(0, 200)}...\n`);
            });
        }
        
        // 3. Verificar si pg_cron está disponible
        try {
            const cronJobs = await client.query(`
                SELECT jobname, schedule, command 
                FROM cron.job 
                WHERE command ILIKE '%thread%' OR command ILIKE '%cleanup%'
            `);
            
            if (cronJobs.rows.length === 0) {
                console.log('✅ No hay cron jobs relacionados con threads');
            } else {
                console.log(`⏰ Encontrados ${cronJobs.rows.length} cron jobs relacionados:\n`);
                cronJobs.rows.forEach((job, index) => {
                    console.log(`${index + 1}. Job: "${job.jobname}"`);
                    console.log(`   - Schedule: ${job.schedule}`);
                    console.log(`   - Command: ${job.command}\n`);
                });
            }
        } catch (cronError) {
            console.log('ℹ️ pg_cron no está disponible o no tiene jobs configurados');
        }
        
        // 4. Mostrar estructura actual de la tabla Chats
        const tableStructure = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'Chats' 
            ORDER BY ordinal_position;
        `);
        
        console.log('\n📋 Estructura actual de tabla "Chats":');
        tableStructure.rows.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
        });
        
        console.log('\n🔍 Revisión completada');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

checkExistingTriggers();