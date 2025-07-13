# Sistema de Locking y Recuperación

## **Resumen Ejecutivo**

El bot implementa un sistema robusto de concurrencia y recuperación para manejar múltiples usuarios simultáneos y recuperarse de fallos de red o crashes.

## **Sistema de Locks por Usuario**

### **Mecanismo de Lock**
```typescript
// Lock por userId para prevenir procesamiento simultáneo
const threadLocks = new Map<string, boolean>();
const lockTimeout = 30000; // 30 segundos
```

### **Flujo de Adquisición de Lock**
1. **Verificación**: Se verifica si el userId ya tiene un lock activo
2. **Adquisición**: Si está libre, se establece el lock con timestamp
3. **Auto-release**: Timer de 30 segundos libera automáticamente el lock
4. **Métricas**: Se incrementa `race_errors_total` si hay conflicto

### **Estados del Lock**
- **LIBRE**: No hay lock activo para el usuario
- **OCUPADO**: Lock activo, procesamiento en curso
- **TIMEOUT**: Lock liberado automáticamente por timeout

### **Ejemplo de Logs**
```
[WARNING] THREAD_LOCK_BUSY: Thread ya está siendo procesado
  userId: "user123"
  isLocked: true

[INFO] THREAD_LOCK_ACQUIRED: Lock adquirido para thread
  userId: "user123"
  timeoutMs: 30000

[WARNING] THREAD_LOCK_TIMEOUT: Lock liberado por timeout
  userId: "user123"
  timeoutMs: 30000
```

## **Recuperación de Runs Huérfanos**

### **Problema**
Los runs de OpenAI pueden quedar en estado `in_progress` o `queued` si:
- El bot se reinicia durante un procesamiento
- Hay fallos de red
- Timeouts de la API de OpenAI

### **Solución Automática**
Al iniciar el bot, se ejecuta `recoverOrphanedRuns()`:

```typescript
// Verificar todos los threads activos
for (const [userId, threadInfo] of Object.entries(threads)) {
  const runs = await openaiClient.beta.threads.runs.list(threadInfo.threadId);
  
  for (const run of runs.data) {
    if (['in_progress', 'queued'].includes(run.status)) {
      const runAge = Date.now() - new Date(run.created_at).getTime();
      
      // Cancelar runs huérfanos de más de 5 minutos
      if (runAge > 5 * 60 * 1000) {
        await openaiClient.beta.threads.runs.cancel(threadInfo.threadId, run.id);
      }
    }
  }
}
```

### **Logs de Recuperación**
```
[INFO] ORPHANED_RUNS_RECOVERY_START: Iniciando recuperación de runs huérfanos

[WARNING] ORPHANED_RUN_CANCELLED: Run huérfano cancelado
  userId: "user123"
  threadId: "thread_abc123"
  runId: "run_xyz789"
  status: "in_progress"
  ageMinutes: 7

[SUCCESS] ORPHANED_RUNS_RECOVERY_COMPLETE: Recuperación completada
  runsChecked: 15
  runsCancelled: 3
```

## **Race Conditions y Resolución**

### **Tipos de Race Conditions**

1. **Múltiples Mensajes Simultáneos**
   - **Problema**: Un usuario envía varios mensajes rápidamente
   - **Solución**: Lock por userId previene procesamiento simultáneo
   - **Métrica**: `race_errors_total` se incrementa

2. **Timeout de Lock**
   - **Problema**: Lock no se libera por error en el código
   - **Solución**: Auto-release después de 30 segundos
   - **Métrica**: `race_errors_total` se incrementa

3. **Runs Huérfanos**
   - **Problema**: Runs quedan activos tras reinicio
   - **Solución**: Cancelación automática al inicio
   - **Log**: `ORPHANED_RUN_CANCELLED`

### **Métricas de Concurrencia**
```prometheus
# Race errors por minuto
rate(race_errors_total[1m])

# Locks activos
thread_locks_active

# Runs huérfanos cancelados
orphaned_runs_cancelled_total
```

## **Configuración y Tuning**

### **Variables de Entorno**
```bash
# Timeout del lock (ms)
LOCK_TIMEOUT=30000

# Edad máxima de runs huérfanos (ms)
ORPHANED_RUN_MAX_AGE=300000  # 5 minutos
```

### **Alertas Recomendadas**
```yaml
- alert: HighRaceErrors
  expr: rate(race_errors_total[5m]) > 0.1
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Alto número de race errors detectados"

- alert: OrphanedRunsDetected
  expr: orphaned_runs_cancelled_total > 0
  for: 1m
  labels:
    severity: info
  annotations:
    summary: "Runs huérfanos cancelados durante recuperación"
```

## **Debugging y Troubleshooting**

### **Comandos Útiles**
```bash
# Ver locks activos
curl http://localhost:3008/metrics | grep thread_locks

# Ver race errors
curl http://localhost:3008/metrics | grep race_errors_total

# Logs de locks
grep "THREAD_LOCK" logs/bot.log
```

### **Problemas Comunes**

1. **"Lock no se libera"**
   - Verificar logs de `THREAD_LOCK_TIMEOUT`
   - Revisar si hay errores en el procesamiento
   - Considerar reducir `LOCK_TIMEOUT`

2. **"Muchos race errors"**
   - Verificar carga de usuarios simultáneos
   - Revisar latencia de OpenAI
   - Considerar aumentar `LOCK_TIMEOUT`

3. **"Runs huérfanos frecuentes"**
   - Verificar estabilidad de red
   - Revisar timeouts de OpenAI
   - Considerar aumentar `ORPHANED_RUN_MAX_AGE`

## **Beneficios del Sistema**

- **Concurrencia Segura**: Previene procesamiento simultáneo del mismo usuario
- **Recuperación Automática**: Se recupera de fallos sin intervención manual
- **Métricas Visibles**: Monitoreo proactivo de problemas de concurrencia
- **Escalabilidad**: Sistema robusto para múltiples usuarios simultáneos 