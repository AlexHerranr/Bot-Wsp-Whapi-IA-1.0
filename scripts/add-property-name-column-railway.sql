-- SQL para agregar la columna property_name a la tabla propiedades en Railway

-- 1. Agregar la columna property_name
ALTER TABLE propiedades 
ADD COLUMN property_name VARCHAR(255) DEFAULT 'TeAlquilamos';

-- 2. Actualizar los nombres basándose en property_id
UPDATE propiedades 
SET property_name = CASE 
    WHEN property_id = 173307 THEN 'TeAlquilamos - Edificio 1820'
    WHEN property_id = 173308 THEN 'TeAlquilamos - Edificio 1317'
    WHEN property_id = 173309 THEN 'TeAlquilamos - Estudio 1722B'
    WHEN property_id = 173312 THEN 'TeAlquilamos - Edificio 1722A'
    WHEN property_id = 240061 THEN 'TeAlquilamos - Edificio 0715'
    WHEN property_id = 173311 THEN 'TeAlquilamos - Estudio 2005B'
    WHEN property_id = 173207 THEN 'TeAlquilamos - Edificio 2005A'
    ELSE 'TeAlquilamos'
END;

-- 3. Verificar que se agregó la columna
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'propiedades'
ORDER BY ordinal_position;

-- 4. Mostrar los datos actualizados
SELECT 
    id,
    property_id,
    property_name,
    room_id,
    room_name,
    capacity
FROM propiedades
ORDER BY id;