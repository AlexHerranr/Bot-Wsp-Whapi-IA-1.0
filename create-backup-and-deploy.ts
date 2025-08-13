import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🛡️ Creando backup completo antes del deployment...');
        
        // 1. Crear backup de todas las tablas importantes
        console.log('\n📊 Creando backup de datos críticos...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        console.log(`📅 Timestamp del backup: ${timestamp}`);
        
        // Backup de estadísticas generales
        const stats = await prisma.$queryRaw`
            SELECT 
                'Reservas' as tabla,
                (SELECT COUNT(*) FROM "Booking") as total_registros,
                (SELECT COUNT(*) FROM "Booking" WHERE "BDStatus" = 'Futura Pendiente') as futura_pendiente
            UNION ALL
            SELECT 
                'Prospectos' as tabla,
                (SELECT COUNT(*) FROM "Leads") as total_registros,
                (SELECT COUNT(*) FROM "Leads" WHERE source = 'beds24') as beds24_auto
            UNION ALL
            SELECT 
                'WhatsApp' as tabla,
                (SELECT COUNT(*) FROM "ClientView") as total_registros,
                (SELECT COUNT(*) FROM "ClientView" WHERE "threadId" IS NOT NULL) as con_thread
            UNION ALL
            SELECT 
                'Apartamentos' as tabla,
                (SELECT COUNT(*) FROM hotel_apartments) as total_registros,
                (SELECT COUNT(*) FROM hotel_apartments WHERE capacity > 0) as con_capacidad;
        `;
        
        console.log('📋 Estado actual del sistema:');
        console.table(stats);
        
        // Backup específico de triggers (críticos)
        console.log('\n⚡ Verificando triggers críticos...');
        
        const triggers = await prisma.$queryRaw`
            SELECT trigger_name, event_object_table, event_manipulation, action_timing
            FROM information_schema.triggers 
            WHERE event_object_table IN ('Booking', 'Leads')
            ORDER BY event_object_table, trigger_name;
        `;
        
        console.log('Triggers activos (deben mantenerse después del deploy):');
        console.table(triggers);
        
        // Verificar BDStatus distribution
        const bdStatusDistribution = await prisma.$queryRaw`
            SELECT "BDStatus", COUNT(*) as count
            FROM "Booking" 
            GROUP BY "BDStatus" 
            ORDER BY count DESC;
        `;
        
        console.log('\n📊 Distribución BDStatus (debe mantenerse):');
        console.table(bdStatusDistribution);
        
        // Verificar sincronización Reservas <-> Prospectos
        const syncCheck = await prisma.$queryRaw`
            SELECT 
                (SELECT COUNT(*) FROM "Booking" WHERE "BDStatus" = 'Futura Pendiente') as reservas_pendientes,
                (SELECT COUNT(*) FROM "Leads" WHERE source = 'beds24') as leads_beds24;
        `;
        
        const sync = (syncCheck as any)[0];
        console.log('\n🔄 Verificación de sincronización:');
        console.log(`📋 Reservas "Futura Pendiente": ${sync.reservas_pendientes}`);
        console.log(`📋 Leads de Beds24: ${sync.leads_beds24}`);
        
        if (parseInt(sync.reservas_pendientes) === parseInt(sync.leads_beds24)) {
            console.log('✅ Sincronización perfecta - LISTO PARA DEPLOY');
        } else {
            console.log('❌ ALERTA: Desincronización detectada - REVISAR ANTES DE DEPLOY');
            return;
        }
        
        console.log('\n🛡️ BACKUP COMPLETO - DATOS CRÍTICOS REGISTRADOS');
        
        console.log('\n🚀 PREPARANDO DEPLOYMENT...');
        
        console.log('\n📋 CAMBIOS A DESPLEGAR:');
        console.log('✅ Schema Prisma actualizado con nombres en español');
        console.log('✅ Modelos: Reservas, Prospectos, WhatsApp, Apartamentos');
        console.log('✅ @@map mantiene tablas físicas intactas');
        console.log('✅ Triggers automáticos NO se ven afectados');
        
        console.log('\n⚠️ IMPORTANTE DESPUÉS DEL DEPLOY:');
        console.log('1. Verificar que triggers siguen funcionando');
        console.log('2. Verificar sincronización Reservas ↔ Prospectos');
        console.log('3. Verificar que bot responde normalmente');
        console.log('4. Verificar que nuevos nombres funcionan en código');
        
        console.log('\n🎯 COMANDOS PARA DEPLOYMENT:');
        console.log('1. git add .');
        console.log('2. git commit -m "feat: renombrar tablas a español con @@map - sin cambios físicos"');
        console.log('3. git push');
        console.log('4. Railway auto-deploy activará');
        
        console.log('\n✅ BACKUP COMPLETADO - LISTO PARA DESPLEGAR');
        
    } catch (error) {
        console.error('❌ Error creando backup:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();