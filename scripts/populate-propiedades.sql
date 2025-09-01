-- Script para poblar la tabla propiedades con datos de ejemplo
-- Ejecutar DESPUÉS de crear la tabla

-- Insertar apartamentos de ejemplo si no existen
INSERT INTO propiedades (property_id, property_name, room_id, room_name, extra_charge, capacity)
VALUES 
    -- Edificio Principal (property_id: 1)
    (1, 'TeAlquilamos - Edificio Principal', 101, 'Suite Ejecutiva 101', '{"amount": 70000, "description": "Aseo y Registro:"}', 4),
    (1, 'TeAlquilamos - Edificio Principal', 102, 'Apartamento Familiar 102', '{"amount": 70000, "description": "Aseo y Registro:"}', 6),
    (1, 'TeAlquilamos - Edificio Principal', 103, 'Studio 103', '{"amount": 70000, "description": "Aseo y Registro:"}', 2),
    (1, 'TeAlquilamos - Edificio Principal', 201, 'Suite Premium 201', '{"amount": 70000, "description": "Aseo y Registro:"}', 4),
    (1, 'TeAlquilamos - Edificio Principal', 202, 'Apartamento Deluxe 202', '{"amount": 70000, "description": "Aseo y Registro:"}', 5),
    
    -- Edificio Norte (property_id: 2)
    (2, 'TeAlquilamos - Torre Norte', 301, 'Penthouse 301', '{"amount": 85000, "description": "Aseo y Registro Premium:"}', 8),
    (2, 'TeAlquilamos - Torre Norte', 302, 'Suite Vista Mar 302', '{"amount": 75000, "description": "Aseo y Registro:"}', 4),
    (2, 'TeAlquilamos - Torre Norte', 401, 'Apartamento Económico 401', '{"amount": 60000, "description": "Aseo y Registro:"}', 3),
    
    -- Anexo Sur (property_id: 3)
    (3, 'TeAlquilamos - Anexo Sur', 501, 'Cabaña Familiar 501', '{"amount": 70000, "description": "Aseo y Registro:"}', 6),
    (3, 'TeAlquilamos - Anexo Sur', 502, 'Cabaña Romántica 502', '{"amount": 70000, "description": "Aseo y Registro:"}', 2)
ON CONFLICT (room_id) 
DO UPDATE SET 
    property_name = EXCLUDED.property_name,
    room_name = EXCLUDED.room_name,
    extra_charge = EXCLUDED.extra_charge,
    capacity = EXCLUDED.capacity,
    updated_at = CURRENT_TIMESTAMP;

-- Verificar los datos insertados
SELECT 
    property_name,
    COUNT(*) as total_apartamentos,
    STRING_AGG(room_name, ', ' ORDER BY room_id) as apartamentos
FROM propiedades
GROUP BY property_name
ORDER BY property_name;

-- Mostrar resumen
SELECT 
    COUNT(*) as total_apartamentos,
    COUNT(DISTINCT property_id) as total_propiedades,
    COUNT(DISTINCT property_name) as nombres_unicos
FROM propiedades;