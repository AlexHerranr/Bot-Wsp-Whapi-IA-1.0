# 🚀 Beds24 Sync Service

Servicio independiente de sincronización con Beds24 API, diseñado para escalabilidad y observabilidad avanzada.

## 🏗️ **Arquitectura**

- **`data-sync/`** - Servicio principal BullMQ + Prometheus + OpenAPI
- **`migration-scripts/`** - Scripts de migración y optimización de BD
- **`docs/`** - Documentación técnica
- **`prisma/`** - Esquema de base de datos independiente

## ⚡ **Características**

- **🔄 BullMQ**: Colas distribuidas con retry automático
- **📊 Prometheus**: 15+ métricas de performance y negocio
- **📚 OpenAPI**: Documentación interactiva Swagger
- **🏥 Health Checks**: Monitoreo de Redis, DB, y queues
- **🔍 Monitoring**: Script avanzado con alertas automáticas
- **🐳 Docker**: Redis local para desarrollo

## 🚀 **Inicio Rápido**

### **1. Configuración**
```bash
cd data-sync
cp ../.env.example .env
# Editar .env con tus valores
```

### **2. Instalación**
```bash
npm install
npm run db:generate
```

### **3. Desarrollo**
```bash
# Terminal 1: Redis local
docker-compose up -d

# Terminal 2: Servidor
npm run dev

# Terminal 3: Monitoring
npm run monitor:continuous
```

### **4. Acceso**
- **API**: http://localhost:3001
- **Swagger**: http://localhost:3001/api-docs
- **Bull Dashboard**: http://localhost:3001/api/admin/queues/ui
- **Métricas**: http://localhost:3001/metrics

## 📊 **Scripts Disponibles**

### **Desarrollo**
```bash
npm run dev          # Servidor con hot reload
npm run build        # Compilar TypeScript
npm run test         # Ejecutar tests
```

### **Base de Datos**
```bash
npm run db:generate  # Generar cliente Prisma
npm run db:migrate   # Aplicar migraciones
npm run db:studio    # Interfaz visual DB
```

### **Sincronización**
```bash
npm run backfill     # Sincronización completa
npm run sync:cancelled # Solo reservas canceladas
npm run sync:leads   # Solo leads pendientes
```

### **Monitoring**
```bash
npm run monitor                 # Reporte único
npm run monitor:continuous      # Monitoreo continuo
npm run monitor:json           # Output JSON
```

## 🔧 **Configuración de Entorno**

Ver `.env.example` para variables requeridas:

- **DATABASE_URL**: PostgreSQL connection
- **BEDS24_TOKEN**: Long life token de Beds24
- **REDIS_URL**: Redis para colas y cache
- **PROMETHEUS_ENABLED**: Habilitar métricas
- **SWAGGER_ENABLED**: Habilitar documentación

## 📈 **Endpoints API**

### **Core**
- `GET /api/health` - Health check completo
- `GET /metrics` - Métricas Prometheus
- `GET /api-docs` - Documentación Swagger

### **Admin**
- `GET /api/admin/queues/ui` - Bull Dashboard
- `GET /api/admin/queues/stats` - Estadísticas queues

### **Webhooks**
- `POST /api/webhooks/beds24` - Webhook Beds24

## 🧪 **Testing**

```bash
npm test              # Tests unitarios
npm run test:coverage # Coverage report
```

## 📋 **Scripts de Migración**

En `migration-scripts/`:
- `improve-leads-structure.ts` - Mejora estructura Leads
- `optimize-leads-table.ts` - Optimización performance
- `setup-leads-sync-trigger.ts` - Triggers automáticos

```bash
npx tsx migration-scripts/script-name.ts
```

## ⚠️ **Conflictos Conocidos**

**IMPORTANTE**: Lee `CONFLICTOS_Y_CONSIDERACIONES.md` antes de deploy a producción.

**Resumen**:
- 🟡 **Database compartida** con bot principal
- 🟡 **Token Beds24 compartido** 
- 🟡 **Redis compartido** (usar prefijos diferentes)

## 🐳 **Docker**

Redis local incluido:
```bash
docker-compose up -d    # Iniciar Redis
docker-compose down     # Detener Redis
```

## 📊 **Métricas Disponibles**

- **Jobs**: Procesados, duración, errores
- **HTTP**: Request duration, status codes
- **Business**: Webhooks, sincronizaciones, API calls
- **System**: Redis health, DB connections, uptime

## 🔍 **Troubleshooting**

### **Error de conexión DB**
```bash
# Verificar variables de entorno
npm run monitor

# Regenerar cliente Prisma
npm run db:generate
```

### **Redis no disponible**
```bash
# Iniciar Redis local
docker-compose up redis -d

# O verificar REDIS_URL en .env
```

### **Build failures**
```bash
# Limpiar y reinstalar
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 🤝 **Contribución**

1. Fork el repositorio
2. Crear feature branch
3. Ejecutar tests: `npm test`
4. Build sin errores: `npm run build`
5. Crear Pull Request

## 📄 **Licencia**

MIT License - Ver archivo LICENSE para detalles.

---

**🔗 Parte del ecosistema TeAlquilamos Bot**