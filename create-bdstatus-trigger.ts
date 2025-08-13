import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🎯 Creando trigger automático para BDStatus...');
        
        // 1. Crear función que calcula BDStatus
        const createFunction = `
            CREATE OR REPLACE FUNCTION calculate_bdstatus()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW."BDStatus" := CASE
                    -- 1️⃣ CANCELADAS
                    WHEN LOWER(NEW.status) = 'cancelled' THEN
                        CASE
                            WHEN NEW."arrivalDate"::date >= CURRENT_DATE THEN 'Cancelada Futura'
                            ELSE 'Cancelada Pasada'
                        END
                    
                    -- 2️⃣ FECHA FUTURA (arrivalDate >= hoy)
                    WHEN NEW."arrivalDate"::date >= CURRENT_DATE THEN
                        CASE
                            -- 🎯 OTAs (Airbnb + Expedia) + fecha futura = Confirmada
                            WHEN LOWER(NEW.channel) LIKE '%airbnb%' OR LOWER(NEW.channel) LIKE '%expedia%'
                            THEN 'Futura Confirmada'
                            -- Otros canales: confirmed + payments + fecha futura = Confirmada
                            WHEN LOWER(NEW.status) = 'confirmed' AND JSONB_ARRAY_LENGTH(NEW.payments::jsonb) > 0
                            THEN 'Futura Confirmada'
                            -- Sin payments + fecha futura + (new o confirmed) - EXCEPTO Airbnb/Expedia
                            ELSE 'Futura Pendiente'
                        END
                    
                    -- 3️⃣ FECHA PASADA (arrivalDate < hoy) - MISMA LÓGICA que futura
                    ELSE
                        CASE
                            -- 🎯 OTAs (Airbnb + Expedia) + fecha pasada = Confirmada
                            WHEN LOWER(NEW.channel) LIKE '%airbnb%' OR LOWER(NEW.channel) LIKE '%expedia%'
                            THEN 'Pasada Confirmada'
                            -- Otros canales: confirmed + payments + fecha pasada = Confirmada
                            WHEN LOWER(NEW.status) = 'confirmed' AND JSONB_ARRAY_LENGTH(NEW.payments::jsonb) > 0
                            THEN 'Pasada Confirmada'
                            -- Resto = NULL (no nos interesa "Pasada Pendiente")
                            ELSE NULL
                        END
                END;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `;
        
        console.log('🔧 Creando función calculate_bdstatus...');
        await prisma.$executeRawUnsafe(createFunction);
        console.log('✅ Función creada exitosamente');
        
        // 2. Eliminar trigger existente si existe
        const dropTrigger = `
            DROP TRIGGER IF EXISTS update_bdstatus_trigger ON "Booking";
        `;
        
        console.log('🗑️ Eliminando trigger anterior si existe...');
        await prisma.$executeRawUnsafe(dropTrigger);
        
        // 3. Crear trigger que se ejecuta en INSERT y UPDATE
        const createTrigger = `
            CREATE TRIGGER update_bdstatus_trigger
                BEFORE INSERT OR UPDATE ON "Booking"
                FOR EACH ROW
                EXECUTE FUNCTION calculate_bdstatus();
        `;
        
        console.log('🎯 Creando trigger automático...');
        await prisma.$executeRawUnsafe(createTrigger);
        console.log('✅ Trigger creado exitosamente');
        
        // 4. Recalcular BDStatus para todos los registros existentes
        console.log('\n🔄 Recalculando BDStatus para registros existentes...');
        const updateExisting = `
            UPDATE "Booking" SET 
                status = status,
                "lastUpdatedBD" = NOW()
            WHERE "BDStatus" IS NULL OR "BDStatus" != '';
        `;
        
        const result = await prisma.$executeRawUnsafe(updateExisting);
        console.log(`✅ Recalculados registros existentes`);
        
        // 5. Verificar distribución final
        console.log('\n📊 Distribución final de BDStatus:');
        const distribution = await prisma.$queryRaw`
            SELECT "BDStatus", COUNT(*) as count
            FROM "Booking" 
            GROUP BY "BDStatus" 
            ORDER BY count DESC;
        `;
        
        console.table(distribution);
        
        // 6. Crear índice para optimizar consultas por BDStatus
        console.log('\n⚡ Creando índice para optimizar consultas...');
        try {
            await prisma.$executeRawUnsafe(`
                CREATE INDEX IF NOT EXISTS idx_booking_bdstatus 
                ON "Booking" ("BDStatus") 
                WHERE "BDStatus" IS NOT NULL;
            `);
            console.log('✅ Índice creado exitosamente');
        } catch (e) {
            console.log('ℹ️ Índice ya existe');
        }
        
        console.log('\n🎉 ¡Trigger automático implementado exitosamente!');
        console.log('\n📋 Características del trigger:');
        console.log('- ✅ Se ejecuta automáticamente en INSERT/UPDATE');
        console.log('- ✅ Independiente del backend/N8N');
        console.log('- ✅ Calcula BDStatus en tiempo real');
        console.log('- ✅ Optimizado con índices');
        console.log('- ✅ 5 categorías: Cancelada Futura/Pasada, Futura/Pasada Confirmada, Futura Pendiente');
        console.log('- ✅ OTAs (Airbnb/Expedia) siempre confirmadas (excepto cancelled)');
        console.log('\n🔄 Se actualizará automáticamente cuando cambien:');
        console.log('- status');
        console.log('- arrivalDate');
        console.log('- payments (JSON)');
        console.log('- channel');
        
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

main();
