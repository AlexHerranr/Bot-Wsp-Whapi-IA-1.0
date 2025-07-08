# 🔄 **PROTOCOLO DE GESTIÓN DE ENTORNOS**

## 🚨 **PROBLEMA: DUPLICACIÓN DE MENSAJES**

Si ejecutas el bot en **local** y **Cloud Run** simultáneamente, WhatsApp enviará mensajes a ambos endpoints, causando **respuestas duplicadas**.

## ✅ **SOLUCIÓN: UN SOLO ENTORNO ACTIVO**

### **📋 REGLA PRINCIPAL:**
> **NUNCA ejecutar ambos entornos al mismo tiempo con el mismo webhook**

---

## 🔧 **CONFIGURACIÓN DE WEBHOOKS**

### **1. Desarrollo Local (Testing)**
```bash
# Configurar webhook para desarrollo
WEBHOOK_URL=https://actual-bobcat-handy.ngrok-free.app/hook

# Iniciar bot local
npm run dev
```

### **2. Producción Cloud Run**
```bash
# Configurar webhook para producción  
WEBHOOK_URL=https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook

# Deploy a Cloud Run
npm run deploy
```

---

## 🎯 **FLUJO DE TRABAJO RECOMENDADO**

### **🔄 Cambio de Local a Producción:**

1. **Parar desarrollo local:**
   ```bash
   # Ctrl+C en terminal local
   # O cerrar terminal
   ```

2. **Cambiar webhook a producción:**
   ```bash
   # En WhatsApp API configurar:
   # webhook_url: https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook
   ```

3. **Verificar Cloud Run activo:**
   ```bash
   curl https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/health
   ```

### **🔄 Cambio de Producción a Local:**

1. **Iniciar ngrok:**
   ```bash
   ngrok http 3008 --domain=actual-bobcat-handy.ngrok-free.app
   ```

2. **Cambiar webhook a desarrollo:**
   ```bash
   # En WhatsApp API configurar:
   # webhook_url: https://actual-bobcat-handy.ngrok-free.app/hook
   ```

3. **Iniciar bot local:**
   ```bash
   npm run dev
   ```

---

## 🛡️ **PROTECCIONES IMPLEMENTADAS**

### **1. Detección Automática de Entorno:**
```typescript
// El bot detecta automáticamente si está en:
// - Local: localhost:3008
// - Cloud Run: 0.0.0.0:8080
```

### **2. Logs Diferenciados:**
```typescript
// Local: Logs detallados + colores
// Cloud Run: Logs optimizados + JSON
```

### **3. URLs Automáticas:**
```typescript
// Configuración automática según entorno
const webhookUrl = isCloudRun 
    ? 'https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook'
    : 'https://actual-bobcat-handy.ngrok-free.app/hook'
```

---

## ⚠️ **ADVERTENCIAS IMPORTANTES**

### **❌ NO HACER:**
- ✖️ Ejecutar `npm run dev` con Cloud Run activo
- ✖️ Dejar ambos endpoints configurados en WhatsApp
- ✖️ Hacer testing en producción con clientes reales

### **✅ SÍ HACER:**
- ✅ Cambiar webhook antes de cambiar entorno
- ✅ Verificar que solo un endpoint responde
- ✅ Usar números de testing para desarrollo
- ✅ Monitorear logs para detectar duplicaciones

---

## 🔍 **VERIFICACIÓN DE ESTADO**

### **Comando para verificar qué está activo:**
```bash
# Verificar local
curl http://localhost:3008/health

# Verificar Cloud Run  
curl https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/health

# Solo UNO debe responder correctamente
```

### **Health Check Response:**
```json
{
  "status": "healthy",
  "environment": "local|cloud-run",
  "port": 3008|8080,
  "initialized": true
}
```

---

## 📱 **CONFIGURACIÓN DE WHATSAPP WEBHOOK**

### **Para cambiar webhook (API de WhatsApp):**
```bash
# Configurar para desarrollo
curl -X POST "https://gate.whapi.cloud/settings/webhook" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "webhook_url=https://actual-bobcat-handy.ngrok-free.app/hook"

# Configurar para producción
curl -X POST "https://gate.whapi.cloud/settings/webhook" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "webhook_url=https://bot-wsp-whapi-ia-908808352514.northamerica-northeast1.run.app/hook"
```

---

## 🎯 **RESUMEN EJECUTIVO**

1. **Un solo entorno activo** por vez
2. **Cambiar webhook** antes de cambiar entorno  
3. **Verificar health checks** antes de usar
4. **Monitorear logs** para detectar problemas
5. **Testing en números separados** para desarrollo

**Siguiendo este protocolo evitas duplicación de mensajes y mantienes una experiencia de usuario limpia.** 