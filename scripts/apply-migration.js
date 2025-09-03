const { Client } = require('pg');

async function applyMigration() {
    // Configuración de conexión
    const config = {
        host: process.env.PGHOST || 'postgres.railway.internal',
        port: parseInt(process.env.PGPORT || '5432'),
        database: process.env.PGDATABASE || 'railway',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'slTVdKuHwjEfvxJEfvxJEjGtMVTwSTYzdbfuR',
        ssl: {
            rejectUnauthorized: false
        }
    };

    const client = new Client(config);

    try {
        console.log('🔗 Conectando a PostgreSQL...');
        await client.connect();
        console.log('✅ Conectado exitosamente');

        // Verificar si la columna ya existe
        const checkQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'Chats' 
            AND column_name = 'last_response_id';
        `;
        
        const checkResult = await client.query(checkQuery);
        
        if (checkResult.rows.length > 0) {
            console.log('⚠️  La columna last_response_id ya existe');
            return;
        }

        // Aplicar la migración
        console.log('🔧 Aplicando migración: agregando columna last_response_id...');
        const migrationQuery = 'ALTER TABLE "Chats" ADD COLUMN "last_response_id" TEXT;';
        await client.query(migrationQuery);
        console.log('✅ Migración aplicada exitosamente');

        // Verificar que se creó correctamente
        const verifyResult = await client.query(checkQuery);
        if (verifyResult.rows.length > 0) {
            console.log('✅ Columna verificada correctamente');
            
            // Mostrar algunas estadísticas
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_chats,
                    COUNT(last_response_id) as chats_with_response_id
                FROM "Chats";
            `;
            const stats = await client.query(statsQuery);
            console.log(`📊 Estadísticas:`);
            console.log(`   - Total chats: ${stats.rows[0].total_chats}`);
            console.log(`   - Chats con response_id: ${stats.rows[0].chats_with_response_id}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.detail) {
            console.error('   Detalle:', error.detail);
        }
    } finally {
        await client.end();
        console.log('🔌 Conexión cerrada');
    }
}

// Ejecutar
applyMigration();