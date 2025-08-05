# Hook de Actualización Externa - API Documentation

## Endpoint: `POST /update-user`

Endpoint para actualizar información de usuarios desde sistemas externos (n8n, webhooks de Whapi, etc.).

### URL
```
POST http://tu-bot-url:3010/update-user
```

### Headers
```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | ✅ | Número de teléfono del usuario (ej: "573003913251") |
| `changes` | string[] | ❌ | Array de cambios específicos |

### Changes Options
- `"cache_invalidate"` - Solo invalidar cache (por defecto)
- `"enrichment"` - Forzar enriquecimiento desde Whapi API
- `"name"` - El name/userName cambió
- `"labels"` - Las etiquetas cambiaron
- `"all"` - Todos los datos cambiaron

### Ejemplos de Uso

#### 1. Invalidar cache básico (más común)
```json
POST /update-user
{
  "userId": "573003913251"
}
```

#### 2. Forzar enriquecimiento completo
```json
POST /update-user
{
  "userId": "573003913251",
  "changes": ["enrichment"]
}
```

#### 3. Cambios específicos
```json
POST /update-user
{
  "userId": "573003913251", 
  "changes": ["name", "labels"]
}
```

### Response

#### Success (200)
```json
{
  "success": true,
  "message": "Cache invalidated for user 573003913251",
  "changes": ["cache_invalidated"]
}
```

#### Error (400)
```json
{
  "error": "userId is required"
}
```

#### Error (500)
```json
{
  "error": "Internal server error"
}
```

## Integración con n8n

### Workflow Example
1. **Webhook Trigger**: Recibir evento de Whapi
2. **HTTP Request**: `POST /update-user` con userId del evento  
3. **Response**: Confirmar actualización exitosa

### Configuración n8n
```javascript
// Nodo HTTP Request en n8n
{
  "method": "POST",
  "url": "http://tu-bot:3010/update-user",
  "body": {
    "userId": "{{$json.from}}",
    "changes": ["cache_invalidate"]
  }
}
```

## Flujo Optimizado

### Antes (sobrecarga)
```
Mensaje → getThread() → BD query → shouldEnrichUser() → 
  → enrichUserFromWhapi() → HTTP Whapi → BD update → BD query again
```

### Después (optimizado)
```
1. Thread Lookup (Cache-First):
   Mensaje → cache.get(userId) → obtiene threadId
   ├─ [HIT] threadId del cache (12h TTL)
   └─ [MISS] BD query → threadId de BD → actualiza cache

2. Thread Processing:
   OpenAI → obtiene/crea threadId → compara con existente:
   ├─ threadId igual → THREAD REUSADO → suma tokens BD + nuevos
   └─ threadId diferente → THREAD NUEVO → resetea tokens, ignora BD

3. Updates:
   Hook externo → /update-user → cache.invalidate() → próximo mensaje refresca
```

## Beneficios

✅ **95% menos llamadas a Whapi API**  
✅ **Latencia reducida**: Cache hits son ~1ms vs ~500ms BD query  
✅ **Escalabilidad**: 1000 mensajes simultáneos = solo cache lookups  
✅ **Costo reducido**: Menos API usage en Whapi  
✅ **Datos frescos**: Hook garantiza updates cuando realmente cambian  
✅ **Thread-aware tokens**: Tokens amarrados al threadId correctamente  
✅ **Thread reusado vs nuevo**: Lógica inteligente para acumular o resetear tokens  

## Logs y Monitoreo

### **Logs Exitosos** - Categoría `HOOK_UPDATE`:
```
[INFO] [HOOK_UPDATE] Recibido hook de actualización para usuario: 573003913251
```

### **Logs de Error** - Categoría `HOOK_ERROR`:
```
[ERROR] [HOOK_ERROR] Error procesando hook de actualización
```

### **Logs de Cache** - Manejo robusto de errores:
```
[WARN] [CACHE_INVALIDATE_ERROR] Error invalidando cache, continuando
```

## Manejo de Errores Robusto

### ✅ **El endpoint NUNCA falla completamente:**
- Error invalidando cache → Log técnico + continúa
- Error de enriquecimiento → Log técnico + continúa  
- Error de BD → Log técnico + continúa
- **Hook siempre retorna 200 OK** (excepto request malformado)

### **Fallback automático:**
```
Hook → cache.invalidate() FALLA → 
    Log técnico + próximo mensaje fuerza BD query
```

### **Monitoreo recomendado:**
```bash
# Ver todos los hooks recibidos
grep "HOOK_UPDATE" logs/technical.log

# Ver errores de hooks (requiere atención)
grep "HOOK_ERROR\|CACHE_INVALIDATE_ERROR" logs/technical.log
```