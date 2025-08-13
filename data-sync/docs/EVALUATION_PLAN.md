# Plan de Evaluación 4 Semanas

## 📅 Timeline
- **Inicio**: 12 de Agosto, 2025
- **Evaluación**: 9 de Septiembre, 2025 (4 semanas)
- **Duración Total**: 2 horas para análisis completo

## 🎯 Objetivo
Determinar si el sistema actual (Opción C) debe continuar o evolucionar a Fase 3/5 basado en métricas reales.

## 📊 Datos a Recolectar (Automático - 1 hora)

### 1. Configurar Logging Persistente
```bash
# Agregar en producción/desarrollo
cd data-sync
npm run dev 2>&1 | tee -a logs/sync-$(date +%Y-%m-%d).log
```

### 2. Script de Análisis Automático
```bash
# Crear script data-sync/scripts/analyze-performance.ts
# Parsear logs de 4 semanas y generar reporte
npm run analyze:performance -- --weeks 4
```

### 3. Métricas Clave a Extraer
- **Duration Average**: Promedio de tiempo sync en ms
- **Rate Average**: Promedio bookings/segundo procesados  
- **Error Rate**: % de syncs fallidos vs exitosos
- **Volume**: Total bookings procesados por semana
- **Peak Times**: Horas de mayor actividad
- **API Response Times**: Beds24 latency patterns

## 🔍 Análisis vs Triggers (30 min)

### Trigger Matrix (Semáforo)
| Métrica | Verde (Continuar Actual) | Amarillo (Monitor) | Rojo (Upgrade) |
|---------|-------------------------|-------------------|----------------|
| **Duration Avg** | <2 min | 2-5 min | >5 min |
| **Rate Avg** | >10 booking/s | 5-10 booking/s | <5 booking/s |
| **Error Rate** | <2% | 2-5% | >5% |
| **Volume Semanal** | <200 | 200-500 | >500 |
| **Memory Usage** | <100MB | 100-200MB | >200MB |
| **API Failures** | <1% | 1-3% | >3% |

### Evaluación Cualitativa
- **Team Velocity**: ¿Desarrollo de features está ralentizado por arquitectura actual?
- **Operational Burden**: ¿Manual sync/monitoring es carga significativa?
- **Business Growth**: ¿Volumen de bookings creciendo exponencialmente?
- **Separation Needs**: ¿Equipos requieren deploy/development independiente?

## 🚦 Matriz de Decisión (30 min)

### ✅ Continuar Opción C (Verde) Si:
- **Performance**: Todas métricas en verde
- **Stability**: <2% error rate, zero downtime
- **Team**: Equipo cómodo con sistema actual
- **Business**: Crecimiento predecible y manejable

**Acción**: Mantener sistema actual, review mensual

### ⚠️ Optimizar Sistema Actual (Amarillo) Si:
- **Performance**: 2-3 métricas en amarillo
- **Growth**: Tendencia creciente pero controlable
- **Fixes**: Gaps menores identificados

**Acción**: Implementar Fase 2.1 (fixes menores):
- Reactivar messages con getMessagesForBooking()
- Cargar propertyMap consistentemente  
- Agregar tests automatizados básicos
- Implementar alerts en errors

### 🚀 Upgrade a Fase 3 (Rojo Performance) Si:
- **Performance**: Duration >5min O rate <5 booking/s
- **Volume**: >500 bookings/semana sostenido
- **Reliability**: Frequent API rate limits/timeouts

**Acción**: Implementar colas Redis/BullMQ:
1. Setup Redis en Railway/local
2. Instalar BullMQ: `npm install bullmq ioredis`
3. Crear queue.manager.ts con job definitions
4. Refactor webhooks para queue.add() vs direct sync
5. Add dashboard en /admin/queues

### 🏗️ Upgrade a Fase 5 (Rojo Operational) Si:
- **Team**: Equipos separados requieren independencia
- **Deploy**: Necesidad de CI/CD independiente
- **Architecture**: Data-sync complejidad > bot complexity

**Acción**: Extracción a repo independiente:
1. Crear nuevo repo: claude-hotels/data-sync
2. Copy data-sync/ directory con historia Git
3. Setup Railway deployment independiente
4. Refactor bot: database.service.ts → HTTP client
5. Implement API versioning para compatibilidad

## 📋 Checklist de Evaluación

### Pre-Evaluación (Día -1)
- [ ] Verificar logs de 4 semanas disponibles
- [ ] Ejecutar script analyze-performance
- [ ] Backup completo de BD
- [ ] Documentar incidentes/downtime

### Durante Evaluación (2 horas)
- [ ] **Hora 1**: Recolectar y analizar métricas automáticamente
- [ ] **Hora 1.5**: Aplicar trigger matrix y decisión cualitativa  
- [ ] **Hora 2**: Documentar decisión y próximos pasos

### Post-Evaluación
- [ ] Commit decisión en EVALUATION_RESULTS.md
- [ ] Crear issues/tasks para acciones decididas
- [ ] Schedule next evaluation (mensual si Verde, semanal si upgrade)

## 🎯 Métricas Objetivo (Benchmarks)

### Baseline Actual (Agosto 12, 2025)
- **System**: data-sync funcional, backfill validado
- **Performance**: Duration ~1s para 0-7 bookings, rate variable  
- **Reliability**: 100% success en tests, Prisma inicialización corregida
- **Volume**: ~1000 bookings/año estimado basado en tests

### Targets 4 Semanas
- **Green Target**: Mantener performance actual, error rate <2%
- **Yellow Threshold**: 2-5x crescimento en volume/complexity
- **Red Threshold**: Degradación performance o >500 bookings/semana

## 📞 Escalation Plan

### Si Upgrade Necesario Pero No Recursos
1. **Priorizar Fase 2.1** (fixes menores) vs full upgrade
2. **Schedule Upgrade** para siguiente sprint/mes
3. **Implement Workarounds** temporales (e.g., manual backfill más frecuente)

### Si Incident Durante Periodo
1. **Document** en logs con severity
2. **Immediate Fix** si posible
3. **Include en Evaluation** como factor crítico
4. **Consider Emergency Upgrade** si recurrente

## 🔄 Próximas Evaluaciones

- **Si Verde**: Evaluación mensual (más relajada)
- **Si Upgrade**: Semanal durante implementation  
- **Post-Upgrade**: 2 semanas para validar mejoras

---

**Fecha Próxima Evaluación**: 9 de Septiembre, 2025
**Owner**: Equipo desarrollo
**Stakeholders**: Product, DevOps (si upgrade a Fase 5)