// Script para configurar la tabla propiedades en Railway
// Usa las credenciales de Railway directamente

const { PrismaClient } = require('@prisma/client');

// Configurar DATABASE_URL con los valores de Railway
const DATABASE_URL = process.env.DATABASE_URL || 
  "postgresql://postgres:slTVdKuHwjEfvxJEjGtMVTwSTYzdbfuR@turntable.proxy.rlwy.net:43146/railway";

// Crear cliente con la URL específica
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function setupPropiedadesTable() {
  console.log('🚀 Configurando tabla propiedades en Railway...');
  console.log('📡 Conectando a:', DATABASE_URL.replace(/:[^:@]*@/, ':****@'));
  
  try {
    // 1. Verificar si la tabla existe
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'propiedades'
      );
    `;
    
    if (!tableExists[0].exists) {
      console.log('📦 Creando tabla propiedades...');
      
      // Crear la tabla
      await prisma.$executeRaw`
        CREATE TABLE propiedades (
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
      `;
      
      // Crear índices
      await prisma.$executeRaw`
        CREATE INDEX idx_propiedades_room_id ON propiedades(room_id);
      `;
      
      await prisma.$executeRaw`
        CREATE INDEX idx_propiedades_property_id ON propiedades(property_id);
      `;
      
      console.log('✅ Tabla propiedades creada exitosamente');
    } else {
      console.log('ℹ️ La tabla propiedades ya existe');
    }
    
    // 2. Verificar si hay datos
    const count = await prisma.apartamentos.count();
    console.log(`📊 Apartamentos actuales en la tabla: ${count}`);
    
    if (count === 0) {
      console.log('📝 Insertando datos de ejemplo...');
      
      // Insertar algunos apartamentos de ejemplo
      const ejemplos = [
        { propertyId: 1, propertyName: 'TeAlquilamos - Principal', roomId: 101, roomName: 'Suite 101', capacity: 4 },
        { propertyId: 1, propertyName: 'TeAlquilamos - Principal', roomId: 102, roomName: 'Familiar 102', capacity: 6 },
        { propertyId: 1, propertyName: 'TeAlquilamos - Principal', roomId: 201, roomName: 'Deluxe 201', capacity: 4 },
        { propertyId: 2, propertyName: 'TeAlquilamos - Norte', roomId: 301, roomName: 'Penthouse 301', capacity: 8 },
        { propertyId: 2, propertyName: 'TeAlquilamos - Norte', roomId: 302, roomName: 'Vista Mar 302', capacity: 4 },
      ];
      
      for (const apt of ejemplos) {
        await prisma.apartamentos.create({
          data: {
            ...apt,
            extraCharge: { amount: 70000, description: "Aseo y Registro:" }
          }
        });
        console.log(`  ✅ Creado: ${apt.roomName}`);
      }
    }
    
    // 3. Mostrar resumen
    const resumen = await prisma.apartamentos.groupBy({
      by: ['propertyName'],
      _count: true
    });
    
    console.log('\n📈 Resumen de propiedades:');
    resumen.forEach(r => {
      console.log(`  ${r.propertyName}: ${r._count} apartamentos`);
    });
    
    // 4. Mostrar algunos ejemplos
    const ejemplos = await prisma.apartamentos.findMany({
      take: 5,
      orderBy: { roomId: 'asc' }
    });
    
    console.log('\n🏠 Primeros 5 apartamentos:');
    ejemplos.forEach(apt => {
      console.log(`  Room ${apt.roomId}: ${apt.roomName} (${apt.propertyName})`);
    });
    
    console.log('\n✨ Configuración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // Si es error de conexión, dar instrucciones
    if (error.message.includes('connect') || error.message.includes('ECONNREFUSED')) {
      console.log('\n📝 Para conectar a Railway:');
      console.log('1. Ve a Railway Dashboard → Postgres → Variables');
      console.log('2. Copia DATABASE_PUBLIC_URL');
      console.log('3. Ejecuta: export DATABASE_URL="<tu-url>"');
      console.log('4. Vuelve a ejecutar este script');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
setupPropiedadesTable();