#!/bin/bash

# Script para ejecutar la migración en Railway
echo "🚀 Ejecutando migración para agregar property_name..."

# Necesitas configurar el DATABASE_URL de Railway
# export DATABASE_URL="postgresql://usuario:password@host:puerto/database"

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL no está configurada"
    echo "Por favor, configura la variable DATABASE_URL con la conexión de Railway"
    echo "Ejemplo: export DATABASE_URL='postgresql://...'"
    exit 1
fi

# Generar el cliente de Prisma
echo "📦 Generando cliente de Prisma..."
npx prisma generate

# Ejecutar la migración
echo "🔄 Aplicando migración..."
npx prisma db push --skip-generate

# Verificar que la columna se agregó
echo "✅ Verificando la columna..."
npx prisma db execute --stdin <<EOF
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'hotel_apartments' 
AND column_name = 'property_name';
EOF

echo "✨ Migración completada"