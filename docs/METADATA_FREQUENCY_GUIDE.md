# 📊 GUÍA DE FRECUENCIAS DE ACTUALIZACIÓN - METADATOS CLIENTVIEW

## 🎯 **FUENTES DE DATOS Y FRECUENCIAS ÓPTIMAS**

### **🔥 PRIORIDAD VISUAL 1: IDENTIFICACIÓN BÁSICA**

#### **`phoneNumber`**
- **FUENTE**: `webhookData.message.from` (WHAPI webhook)
- **CÓDIGO**: Webhook handler principal
- **FRECUENCIA ACTUAL**: En cada mensaje
- **FRECUENCIA ÓPTIMA**: ✅ PERFECTA - Solo se obtiene cuando llega mensaje
- **SOBRECARGA**: NINGUNA - Es reactivo

#### **`name`** 
- **FUENTE**: `whapiLabels.getChatInfo().name`
- **CÓDIGO**: `guestMemory.js:217` en `syncWhapiLabels()`
- **FRECUENCIA ACTUAL**: Solo threads viejos (>X días)
- **FRECUENCIA ÓPTIMA**: ✅ PERFECTA - Evita llamadas innecesarias
- **SOBRECARGA**: BAJA - Solo threads fríos

#### **`userName`**
- **FUENTE**: `threads.json.userName`
- **CÓDIGO**: Al crear thread
- **FRECUENCIA ACTUAL**: Una vez al crear
- **FRECUENCIA ÓPTIMA**: ✅ PERFECTA - No cambia
- **SOBRECARGA**: NINGUNA

---

### **🔥 PRIORIDAD VISUAL 2: CRM - LO MÁS IMPORTANTE**

#### **`perfilStatus` & `proximaAccion`**
- **FUENTE**: Calculado por bot
- **CÓDIGO**: Lógica CRM personalizada
- **FRECUENCIA ACTUAL**: En cada interacción
- **FRECUENCIA ÓPTIMA**: ⚠️ OPTIMIZAR
- **RECOMENDACIÓN**: 
  - ✅ **Calcular**: En cada mensaje nuevo
  - ✅ **Cache**: 5 minutos para consultas
  - ❌ **Evitar**: Recalcular en cada vista

#### **`prioridad`**
- **FUENTE**: Calculado basado en actividad
- **FRECUENCIA ÓPTIMA**: 
  - ✅ **ALTA**: Recalcular inmediatamente
  - ✅ **MEDIA/BAJA**: Cache 30 minutos

---

### **🔥 PRIORIDAD VISUAL 3: ETIQUETAS**

#### **`label1`, `label2`, `label3`**
- **FUENTE**: `threads.json.labels[]`
- **CÓDIGO**: Al asignar etiquetas manualmente
- **FRECUENCIA ACTUAL**: Manual
- **FRECUENCIA ÓPTIMA**: ✅ PERFECTA - Solo cuando se cambian
- **SOBRECARGA**: NINGUNA

---

### **🔥 PRIORIDAD VISUAL 4-6: ACTIVIDAD Y THREADS**

#### **`chatId`**
- **FUENTE**: `threads.json.chatId`
- **FRECUENCIA ÓPTIMA**: ✅ PERFECTA - No cambia

#### **`lastMessageRole` & `lastMessageAt`**
- **FUENTE**: `message.role` y `message.createdAt` (Prisma)
- **FRECUENCIA ÓPTIMA**: ✅ PERFECTA - Automático con cada mensaje

#### **`threadId`**
- **FUENTE**: `threads.json.threadId` (OpenAI)
- **FRECUENCIA ÓPTIMA**: ✅ PERFECTA - Solo cuando cambia thread

---

## ⚡ **RECOMENDACIONES PARA EVITAR SOBRECARGA**

### **🟢 FRECUENCIAS ÓPTIMAS**

1. **TIEMPO REAL** (0 segundos):
   - `phoneNumber` - Del webhook
   - `lastMessageRole`, `lastMessageAt` - De Prisma
   - `threadId` - Al cambiar

2. **CACHE 5 MINUTOS**:
   - `perfilStatus`, `proximaAccion` - Para consultas frecuentes
   - `prioridad` si es ALTA

3. **CACHE 30 MINUTOS**:
   - `name` - Para threads activos
   - `prioridad` si es MEDIA/BAJA

4. **SOLO CUANDO NECESARIO**:
   - `name` - Solo threads viejos (syncWhapiLabels)
   - `labels` - Solo cambios manuales

### **🔴 EVITAR SOBRECARGA**

❌ **NO HACER**:
- Llamar `getChatInfo()` en cada mensaje
- Recalcular `perfilStatus` en cada consulta
- Sincronizar threads activos innecesariamente

✅ **SÍ HACER**:
- Cache inteligente basado en prioridad
- Actualización reactiva (webhook-driven)
- Sync solo para threads fríos

### **📊 CÓDIGOS QUE CONTROLAN FRECUENCIA**

1. **`guestMemory.js:196`** - `syncWhapiLabels()` - Controla sync de name
2. **`guestMemory.js:114`** - `getChatInfo()` - Obtiene name de WHAPI
3. **Webhook handler** - Controla phoneNumber automático
4. **Cache TTL** en `guestMemory.js:24` - `LABEL_CACHE_TTL = 300000` (5 min)

### **🎯 FRECUENCIA PERFECTA ACTUAL**

El sistema YA tiene frecuencias casi óptimas:
- ✅ **Reactivo**: phoneNumber, mensajes
- ✅ **Cache**: Labels (5 min)  
- ✅ **Inteligente**: Solo sync threads viejos
- ⚠️ **Mejorar**: Cache para CRM calculations

**CONCLUSIÓN**: El sistema actual es eficiente, solo optimizar cache CRM.