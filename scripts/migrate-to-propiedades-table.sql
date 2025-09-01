-- Script de migración: hotel_apartments -> propiedades

-- 1. Crear la nueva tabla 'propiedades' si no existe
CREATE TABLE IF NOT EXISTS propiedades (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL,
    property_name VARCHAR(255) DEFAULT 'TeAlquilamos',
    room_id INTEGER UNIQUE NOT NULL,
    room_name VARCHAR(255) NOT NULL,
    extra_charge JSONB DEFAULT '{"amount": 70000, "description": "Cargo adicional:"}',
    capacity INTEGER DEFAULT 4,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_propiedades_room_id ON propiedades(room_id);
CREATE INDEX IF NOT EXISTS idx_propiedades_property_id ON propiedades(property_id);

-- 3. Si existe hotel_apartments, migrar los datos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hotel_apartments') THEN
        -- Insertar datos que no existan
        INSERT INTO propiedades (property_id, room_id, room_name, extra_charge, capacity)
        SELECT 
            property_id,
            room_id,
            room_name,
            extra_charge,
            capacity
        FROM hotel_apartments
        ON CONFLICT (room_id) DO NOTHING;
        
        RAISE NOTICE 'Datos migrados de hotel_apartments a propiedades';
    END IF;
END $$;

-- 4. Verificar la migración
SELECT 
    'propiedades' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT property_id) as propiedades_unicas
FROM propiedades;

-- 5. Mostrar algunos registros de ejemplo
SELECT 
    room_id,
    room_name,
    property_name,
    property_id,
    extra_charge
FROM propiedades
LIMIT 5;