# 📋 Plan de Optimización Crítica - Bot Hotelero

## 🔍 **Análisis de Logs y Evaluación Crítica**

### **Fecha de Análisis**: 2025-07-05
### **Logs Analizados**: bot-2025-07-04.log, bot-2025-07-05.log
### **Estado Actual**: Producción con problemas identificados

---

## ✅ **PROBLEMAS CRÍTICOS IDENTIFICADOS**

### **1. Memory Leak en messageQueue - PRIORIDAD CRÍTICA**
**Síntoma**: Colas de mensajes acumulándose sin límite
**Impacto**: Posible colapso del sistema por memoria
**Solución**: Implementar limpieza inteligente de colas

### **2. Race Condition en Thread Updates - PRIORIDAD CRÍTICA**
**Síntoma**: Actualizaciones simultáneas causando inconsistencias
**Impacto**: Pérdida de contexto, respuestas duplicadas
**Solución**: Sistema de mutex para operaciones thread-safe

### **3. Timeout Handling Inadecuado - PRIORIDAD ALTA**
**Síntoma**: Timeouts de Beds24 no manejados correctamente
**Impacto**: Usuarios sin respuesta, experiencia degradada
**Solución**: Sistema de timeout con reintentos inteligentes

### **4. Falta de Circuit Breaker - PRIORIDAD ALTA**
**Síntoma**: Sistema colapsa cuando servicios externos fallan
**Impacto**: Indisponibilidad total durante fallos de Beds24
**Solución**: Implementar circuit breaker con fallback

### **5. Mensajes de Error Genéricos - PRIORIDAD MEDIA**
**Síntoma**: Errores poco informativos para usuarios
**Impacto**: Frustración del usuario, escalamientos innecesarios
**Solución**: Mensajes contextuales y útiles

---

## ❌ **PROPUESTAS RECHAZADAS**

### **1. Eliminación de Thread Persistence**
**RECHAZADO**: Los threads deben mantenerse permanentemente
**RAZÓN**: Clientes hoteleros consultan después de meses/años, el contexto histórico es crítico para el negocio

### **2. Reducción de Auto-guardado**
**RECHAZADO**: Auto-guardado cada 5 minutos es necesario
**RAZÓN**: Conversaciones de reservas no pueden perderse, información crítica debe persistir

---

## 🏗️ **PLAN DE IMPLEMENTACIÓN**

### **ETAPA 1: FIXES CRÍTICOS (Semana 1)**

#### **1.1 Memory Leak Fix - messageQueue**
```typescript
// Archivo: src/utils/messageQueueManager.ts
class MessageQueueManager {
  private queues = new Map<string, Message[]>();
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutos
  
  constructor() {
    setInterval(() => this.cleanupEmptyQueues(), this.CLEANUP_INTERVAL);
  }
  
  addMessage(userId: string, message: Message): void {
    if (!this.queues.has(userId)) {
      this.queues.set(userId, []);
    }
    
    const queue = this.queues.get(userId)!;
    queue.push(message);
    
    // Limitar tamaño (mantener solo mensajes recientes)
    if (queue.length > this.MAX_QUEUE_SIZE) {
      queue.splice(0, queue.length - this.MAX_QUEUE_SIZE);
      logger.warn('QUEUE_TRIMMED', `Cola recortada para ${userId}`);
    }
  }
  
  processQueue(userId: string): Message[] {
    const queue = this.queues.get(userId) || [];
    this.queues.set(userId, []); // Vaciar pero mantener referencia
    return queue;
  }
  
  private cleanupEmptyQueues(): void {
    let cleaned = 0;
    for (const [userId, queue] of this.queues.entries()) {
      if (queue.length === 0) {
        this.queues.delete(userId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info('QUEUE_CLEANUP', `${cleaned} colas vacías eliminadas`);
    }
  }
}
```

#### **1.2 Thread Mutex Implementation**
```typescript
// Archivo: src/utils/threadMutex.ts
class ThreadMutex {
  private locks = new Map<string, Promise<void>>();
  private lockTimestamps = new Map<string, number>();
  private readonly LOCK_TIMEOUT = 30000; // 30 segundos
  
  async acquire(userId: string): Promise<() => void> {
    this.cleanupExpiredLocks();
    
    while (this.locks.has(userId)) {
      await this.locks.get(userId);
    }
    
    let release: () => void;
    const promise = new Promise<void>(resolve => {
      release = resolve;
    });
    
    this.locks.set(userId, promise);
    this.lockTimestamps.set(userId, Date.now());
    
    return () => {
      this.locks.delete(userId);
      this.lockTimestamps.delete(userId);
      release();
    };
  }
  
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    for (const [userId, timestamp] of this.lockTimestamps.entries()) {
      if (now - timestamp > this.LOCK_TIMEOUT) {
        this.locks.delete(userId);
        this.lockTimestamps.delete(userId);
        logger.warn('LOCK_EXPIRED', `Lock expirado para ${userId}`);
      }
    }
  }
}
```

### **ETAPA 2: RELIABILITY IMPROVEMENTS (Semana 2)**

#### **2.1 Circuit Breaker para Beds24**
```typescript
// Archivo: src/utils/circuitBreaker.ts
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private serviceName: string,
    private threshold = 5,
    private timeout = 60000,
    private resetTimeout = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('CIRCUIT_BREAKER', `${this.serviceName} - Intentando reconexión`);
      } else {
        throw new ServiceUnavailableError(
          `${this.serviceName} temporalmente no disponible`
        );
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      logger.info('CIRCUIT_BREAKER', `${this.serviceName} - Servicio recuperado`);
    }
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      logger.error('CIRCUIT_BREAKER', 
        `${this.serviceName} - Circuito abierto después de ${this.failures} fallos`);
    }
  }
}
```

#### **2.2 Advanced Timeout Manager**
```typescript
// Archivo: src/utils/timeoutManager.ts
class TimeoutManager {
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    config: TimeoutConfig
  ): Promise<T> {
    const { timeout, retries, backoff, context } = config;
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new TimeoutError(`Timeout after ${timeout}ms`)), timeout)
          )
        ]);
      } catch (error) {
        lastError = error;
        
        if (error instanceof TimeoutError && attempt < retries) {
          logger.warn('TIMEOUT_RETRY', 
            `Intento ${attempt + 1}/${retries + 1} para ${context}`);
          
          await new Promise(r => setTimeout(r, backoff * Math.pow(2, attempt)));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }
}

// Configuraciones por servicio
const timeoutConfigs = {
  beds24: {
    timeout: 45000,
    retries: 2,
    backoff: 1000,
    context: 'Beds24 availability check'
  },
  openai: {
    timeout: 30000,
    retries: 1,
    backoff: 2000,
    context: 'OpenAI processing'
  }
};
```

### **ETAPA 3: USER EXPERIENCE IMPROVEMENTS (Semana 3)**

#### **3.1 Contextual Error Messages**
```typescript
// Archivo: src/utils/errorMessages.ts
export class ContextualErrorHandler {
  private static readonly ERROR_MESSAGES = {
    beds24_timeout: {
      user_friendly: "Estoy verificando disponibilidad... Dame un momento más 🔍",
      retry: "El sistema está procesando tu consulta, casi listo... ⏳",
      final: "Hay un retraso temporal. ¿Te contacto en 5 minutos? 📱"
    },
    
    beds24_unavailable: {
      user_friendly: "Sistema de reservas temporalmente no disponible 🛠️",
      alternative: "¿Te cuento sobre nuestros apartamentos mientras se restablece? 🏨"
    },
    
    date_validation: {
      past_dates: "Las fechas ya pasaron 📅. ¿Buscas fechas futuras?",
      invalid_format: "¿Podrías decir 'del 15 al 20 de marzo'? 📝"
    }
  };
  
  static getContextualMessage(
    errorType: string, 
    attempt: number = 1
  ): string {
    const messages = this.ERROR_MESSAGES[errorType];
    if (!messages) {
      return "Problema técnico. Estoy trabajando para resolverlo 🔧";
    }
    
    if (attempt === 1 && messages.user_friendly) {
      return messages.user_friendly;
    } else if (attempt === 2 && messages.retry) {
      return messages.retry;
    } else if (messages.final) {
      return messages.final;
    }
    
    return messages.user_friendly || "Estoy trabajando para resolver esto 🔧";
  }
}
```

### **ETAPA 4: PERFORMANCE OPTIMIZATIONS (Semana 4)**

#### **4.1 Smart Availability Cache**
```typescript
// Archivo: src/utils/availabilityCache.ts
class AvailabilityCache {
  private cache = new Map<string, CachedAvailability>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  private readonly MAX_CACHE_SIZE = 1000;
  
  generateKey(startDate: string, endDate: string): string {
    return `${startDate}-${endDate}`;
  }
  
  get(startDate: string, endDate: string): AvailabilityResult | null {
    const key = this.generateKey(startDate, endDate);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    logger.info('CACHE_HIT', `Disponibilidad desde cache: ${key}`);
    return cached.data;
  }
  
  set(startDate: string, endDate: string, data: AvailabilityResult): void {
    const key = this.generateKey(startDate, endDate);
    
    // Limitar tamaño del cache
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    logger.info('CACHE_SET', `Disponibilidad guardada: ${key}`);
  }
}
```

### **ETAPA 5: MONITORING & METRICS (Semana 5)**

#### **5.1 Comprehensive Metrics System**
```typescript
// Archivo: src/utils/metrics.ts
class BotMetrics {
  private metrics: MetricsData = {
    conversations: { total: 0, active: 0, escalated: 0 },
    availability: { queries: 0, cache_hits: 0, errors: 0 },
    system: { memory_usage: 0, active_threads: 0, queue_size: 0 }
  };
  
  recordAvailabilityQuery(responseTime: number, cached: boolean): void {
    this.metrics.availability.queries++;
    
    if (cached) {
      this.metrics.availability.cache_hits++;
    }
  }
  
  generateReport(): MetricsReport {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      health: this.calculateHealth(),
      recommendations: this.generateRecommendations()
    };
  }
  
  private calculateHealth(): HealthStatus {
    const errorRate = this.metrics.availability.errors / this.metrics.availability.queries;
    
    if (errorRate > 0.1) return 'CRITICAL';
    if (errorRate > 0.05) return 'WARNING';
    return 'HEALTHY';
  }
}
```

---

## 🎯 **CONSIDERACIONES ESPECIALES NEGOCIO HOTELERO**

### **Thread Persistence Strategy**
- **Threads NUNCA se eliminan** - solo se archivan después de 6 meses
- **Contexto histórico es CRÍTICO** para servicio personalizado
- **Optimización de acceso** sin perder información

### **Reservas y Disponibilidad**
- **Cache inteligente** para consultas frecuentes
- **Fallback** cuando Beds24 no disponible
- **Contexto de temporadas** y precios especiales

---

## 📊 **MÉTRICAS DE ÉXITO ESPERADAS**

### **Etapa 1 (Semana 1)**
- ✅ 0% memory leaks en messageQueue
- ✅ 0% race conditions en threads
- ✅ 95% reducción errores concurrencia

### **Etapa 2 (Semana 2)**
- ✅ 90% uptime servicios externos
- ✅ 50% reducción timeouts
- ✅ Recuperación automática ante fallos

### **Etapa 3 (Semana 3)**
- ✅ 80% mejora satisfacción usuario
- ✅ 60% reducción escalamientos por errores
- ✅ 40% mejora tiempo respuesta percibido

### **Etapa 4 (Semana 4)**
- ✅ 30% reducción carga CPU
- ✅ 50% mejora throughput
- ✅ 70% reducción operaciones redundantes

### **Etapa 5 (Semana 5)**
- ✅ Visibilidad completa sistema
- ✅ Detección proactiva problemas
- ✅ Optimización continua basada en datos

---

## 🚀 **ESTRATEGIA DE DEPLOYMENT**

### **Implementación Gradual**
1. **Desarrollo en rama separada** para cada etapa
2. **Testing exhaustivo** con datos anonimizados
3. **Deployment gradual** con rollback automático
4. **Monitoreo intensivo** primeras 48 horas
5. **Validación con métricas** antes de siguiente etapa

### **Criterios de Éxito**
- **Etapa 1**: 0 memory leaks en 72 horas
- **Etapa 2**: 99% uptime en 1 semana
- **Etapa 3**: 50% menos escalamientos por errores
- **Etapa 4**: 30% mejora tiempo respuesta
- **Etapa 5**: Dashboard funcional con alertas

---

## 🔧 **ARCHIVOS A MODIFICAR**

### **Nuevos Archivos**
- `src/utils/messageQueueManager.ts`
- `src/utils/threadMutex.ts`
- `src/utils/circuitBreaker.ts`
- `src/utils/timeoutManager.ts`
- `src/utils/errorMessages.ts`
- `src/utils/availabilityCache.ts`
- `src/utils/metrics.ts`

### **Archivos a Modificar**
- `src/app.ts` - Integrar nuevos managers
- `src/handlers/openai_handler.ts` - Agregar mutex
- `src/services/beds24/beds24.service.ts` - Circuit breaker
- `src/utils/ai/groqAi.js` - Thread safety

---

**NOTA CRÍTICA**: Este plan respeta completamente la lógica de negocio hotelero, manteniendo contexto histórico mientras optimiza eficiencia operacional. Implementación incremental con rollback disponible.

**Fecha de Creación**: 2025-07-05  
**Próxima Revisión**: Después de Etapa 1  
**Responsable**: Equipo de Desarrollo 