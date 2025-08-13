# Plan de Monitoreo Post-Fase 2

## 🎯 Objetivo
Mantener el sistema data-sync estable y detectar cuándo necesita escalabilidad (Fase 3/5).

## 📊 Métricas Clave Monitoreadas

### Logging Avanzado Implementado
- **Duration**: Tiempo total de sync en ms
- **Rate**: Bookings procesados por segundo
- **Processed/Upserted**: Cantidad de registros manejados
- **Errors**: Fallos en sync o conexión

### Estructura de Logs
```json
{
  "level": 30,
  "time": 1755053189575,
  "msg": "Cancelled reservations sync completed",
  "processed": 45,
  "upserted": 12,
  "duration": 3200,
  "rate": 14
}
```

## 🔄 Rutina de Monitoreo Semanal (1 hora)

### 1. Sync Manual Test (15 min)
```bash
cd data-sync
npm run backfill -- --type cancelled --from 2025-08-05 --to 2025-08-12 --limit 10
npm run backfill -- --type leads --from 2025-08-12 --to 2025-08-19 --limit 10
```

### 2. Verificación BD (15 min)
```sql
-- Contar reservas nuevas última semana
SELECT COUNT(*) FROM ReservationsCancelled 
WHERE modifiedDate > NOW() - INTERVAL '7 days';

-- Chequear leads activos
SELECT COUNT(*) FROM ReservationsPendingFuture 
WHERE createdAt > NOW() - INTERVAL '7 days';
```

### 3. Review de Logs (15 min)
```bash
# Ver sync completados
grep "sync completed" logs/data-sync.log | tail -20

# Buscar errores
grep '"level":50' logs/data-sync.log | jq .
```

### 4. Health Check (15 min)
```bash
# Servidor status
curl http://localhost:3020/health

# Test webhook
curl -X POST http://localhost:3020/webhooks/beds24 \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"test-'$(date +%s)'","action":"created"}'
```

## 🚨 Triggers para Upgrade

### ➡️ Ir a Fase 3 (Colas Redis/BullMQ) si:
- **Performance**: Sync toma >5 minutos
- **Volume**: >500 bookings/día procesados
- **Reliability**: >5% error rate en syncs
- **API Limits**: Rate limiting frecuente de Beds24

### ➡️ Ir a Fase 5 (Extracción Repo) si:
- **Team Growth**: Equipos separados manejan bot vs data
- **Deployment**: Necesitas deploy independiente
- **Scaling**: Data-sync crece >bot en complejidad

### ✅ Quedarse con Sistema Actual si:
- **Stability**: <2% error rate
- **Performance**: Sync completa <2 minutos
- **Volume**: <200 bookings/día
- **Team**: Mismo equipo maneja ambos

## 📈 Métricas Objetivo (Benchmarks)

| Métrica | Verde | Amarillo | Rojo |
|---------|-------|----------|------|
| Sync Duration | <2 min | 2-5 min | >5 min |
| Error Rate | <2% | 2-5% | >5% |
| Processing Rate | >10 booking/s | 5-10 booking/s | <5 booking/s |
| Volume Diario | <200 | 200-500 | >500 |

## 🔧 Comandos Útiles

### Logs con Filtro
```bash
# Solo errores
npm run dev 2>&1 | grep '"level":50'

# Solo sync completados  
npm run dev 2>&1 | grep "sync completed"

# Formato pretty
npm run dev 2>&1 | npx pino-pretty
```

### Backup Antes de Sync
```bash
# Backup automático
npm run backup:db

# Verificar backup
ls -la backups/backup-*.dump
```

### Reset en Emergencia
```bash
# Parar data-sync
pkill -f "tsx.*main.ts"

# Rollback Prisma (si necesario)
npm run db:migrate:reset
```

## 📅 Schedule Sugerido

- **Diario**: Health check automático vía cron
- **Semanal**: Review completo (1 hora)
- **Mensual**: Evaluación de triggers de upgrade
- **Trimestral**: Revisión estratégica del plan

## 🎯 Próxima Evaluación

**Fecha**: 4 semanas post-implementación
**Criterio**: Si métricas están en "Verde" → Continuar con sistema actual
**Acción**: Si "Amarillo"/"Rojo" → Activar upgrade correspondiente