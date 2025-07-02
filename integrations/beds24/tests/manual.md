# 🧪 Manual de Test - Disponibilidad Beds24

## 📋 ¿Cuándo usar este archivo?

Usa `test-beds24-availability.mjs` cuando:

- ❌ OpenAI no responde a consultas de disponibilidad
- 🐛 El bot no muestra la disponibilidad correctamente
- 🔍 Necesitas debuggear problemas específicos
- ✅ Quieres verificar que Beds24 funciona independientemente

## 🚀 Comandos Disponibles

### 🎯 Ejecutar todos los tests
```bash
node test-beds24-availability.mjs
```

### 🔍 Tests específicos

#### Test General - Todas las propiedades
```bash
node test-beds24-availability.mjs general
```
**Útil para:** Ver panorama general de disponibilidad

#### Test OpenAI - Simular consulta del bot
```bash
node test-beds24-availability.mjs openai
```
**Útil para:** Replicar exactamente lo que haría OpenAI

#### Test Tipos - Disponibilidad completa vs parcial  
```bash
node test-beds24-availability.mjs types
```
**Útil para:** Entender diferencias entre disponibilidad total y parcial

#### Test Propiedad - Detalles específicos
```bash
node test-beds24-availability.mjs property
```
**Útil para:** Analizar una propiedad en detalle (ID 173311)

## 📊 Qué esperar de cada test

### 🎯 Test General
```
🎯 TEST 1: Disponibilidad General
──────────────────────────────────────────────────
📅 Fechas: 2025-07-03 a 2025-07-06
✅ 28 habitaciones encontradas
🟢 5 con disponibilidad parcial/completa
🟡 3 con disponibilidad completa
🔴 23 sin disponibilidad
```

### 🤖 Test OpenAI  
```
🎯 TEST 2: Simulación de Consulta OpenAI
──────────────────────────────────────────────────
📱 Respuesta formateada para WhatsApp:
────────────────────────────────────────
📅 **Disponibilidad para 2025-07-15 - 2025-07-18**

✅ **HABITACIONES DISPONIBLES (5)**
🏠 **ESTUDIO** - Propiedad 173311
   📊 3 de 3 días disponibles
   📅 Fechas: 2025-07-15, 2025-07-16, 2025-07-17
```

### 📈 Test Tipos
```
🎯 TEST 3: Disponibilidad Completa vs Parcial
──────────────────────────────────────────────────
📊 Análisis de 28 habitaciones:
🟢 3 - Disponibilidad COMPLETA
🟡 2 - Disponibilidad PARCIAL  
🔴 23 - SIN disponibilidad
```

### 🏠 Test Propiedad
```
🎯 TEST 4: Propiedad Específica (173311 - ESTUDIO)
──────────────────────────────────────────────────
🏠 ESTUDIO (ID: 173311)
📅 Disponibilidad detallada:
   ✅ 2025-07-05 (sáb)
   ✅ 2025-07-06 (dom)
   ❌ 2025-07-07 (lun)
📊 Resumen: 2/3 días (67%)
```

## 🔧 Debugging Específico

### ❌ Si OpenAI no funciona:
1. Ejecuta: `node test-beds24-availability.mjs openai`
2. Compara la respuesta con lo que muestra el bot
3. Si el test funciona pero el bot no, el problema está en la integración

### 🐛 Si los datos están mal:
1. Ejecuta: `node test-beds24-availability.mjs general`
2. Verifica que Beds24 devuelve datos correctos
3. Si los datos están mal aquí, problema en Beds24

### 🏠 Para una propiedad específica:
1. Edita el archivo `test-beds24-availability.mjs`
2. Cambia `const propertyId = 173311;` por tu ID
3. Ejecuta: `node test-beds24-availability.mjs property`

## 🔍 Interpretar Resultados

### ✅ **Disponibilidad COMPLETA**
- Todas las fechas del rango están libres
- Perfecto para reservas sin restricciones

### 🟡 **Disponibilidad PARCIAL**
- Algunas fechas libres, otras ocupadas
- Requiere fechas específicas

### 🔴 **SIN disponibilidad**
- Todas las fechas ocupadas
- No disponible para el rango consultado

## 📝 Personalizar Tests

### Cambiar fechas de prueba:
```javascript
// En testOpenAIStyleQuery()
const params = {
    startDate: '2025-08-01',  // ← Cambia aquí
    endDate: '2025-08-05'     // ← Cambia aquí
};
```

### Probar propiedad específica:
```javascript
// En testSpecificProperty()
const propertyId = 173207;  // ← Cambia por tu ID
```

### Agregar más propiedades:
```javascript
// En cualquier test
params: { 
    propertyId: [173311, 173207, 173308],  // ← Array de IDs
    startDate: start, 
    endDate: end 
}
```

## ⚠️ Errores Comunes

### `Token is missing` o `401`
- Verifica que `BEDS24_TOKEN` esté en el .env
- El token puede haber expirado

### `No data` o `0 habitaciones`
- Las fechas pueden estar muy ocupadas
- Prueba con fechas más futuras

### `timeout` errors
- Beds24 puede estar lento
- Intenta de nuevo en unos minutos

## 💡 Tips de Debugging

1. **Siempre empieza con el test general** para ver el estado global
2. **Usa fechas futuras** (mínimo 1 semana adelante)
3. **Si tienes dudas sobre una propiedad**, usa el test específico
4. **Compara con el panel de Beds24** para validar datos
5. **Los logs del bot** están en `logs/bot-YYYY-MM-DD.log`

## 🎯 Flujo de Debugging Recomendado

```
1. ❓ Problema reportado
2. 🧪 node test-beds24-availability.mjs general
3. ✅ ¿Funciona? → Problema en integración bot
4. ❌ ¿No funciona? → Problema en Beds24 o token
5. 🤖 node test-beds24-availability.mjs openai
6. 📊 Comparar resultados con bot real
7. 🔧 Corregir donde esté la diferencia
```

Con estos tests puedes debuggear cualquier problema de disponibilidad sin depender del bot completo. ¡Muy útil para desarrollo y soporte! 