# Tests de Whapi API

## 📋 Descripción General
Colección de tests para probar diferentes endpoints de la API de Whapi, incluyendo mensajes, chats, etiquetas y análisis de conversaciones.

## 🧪 Tests Disponibles

### 1. **test-chat-specific.js** ⭐ **NUEVO - IMPLEMENTACIÓN MEJORADA**
**Análisis completo de conversación con formato optimizado**

#### 🚀 **Características Principales:**
- **Análisis dual**: Combina información de chat (`/chats/{ChatID}`) y mensajes (`/messages/list/{ChatID}`)
- **Formato legible**: Output organizado con emojis, separadores y numeración
- **Agrupación inteligente**: Mensajes organizados por día con separadores visuales
- **Truncado inteligente**: Contenido de mensajes truncado por palabras completas (70 caracteres)
- **Identificación clara**: Emojis para distinguir remitentes (🤖 Yo / 👤 Cliente)
- **Estadísticas completas**: Resumen de mensajes, período y duración de conversación

#### 📊 **Funcionalidades:**
- ✅ Información de contacto y etiquetas
- ✅ Conversación cronológica (más recientes primero)
- ✅ Agrupación por días con separadores
- ✅ Numeración secuencial de mensajes
- ✅ Truncado inteligente de contenido
- ✅ Manejo de diferentes tipos de mensaje
- ✅ Estadísticas de participación
- ✅ Cálculo de duración de conversación

#### 🛠️ **Uso:**
```bash
# Análisis básico (200 mensajes por defecto)
node test-chat-specific.js 573003913251@s.whatsapp.net

# Análisis con cantidad personalizada
node test-chat-specific.js 573003913251@s.whatsapp.net 100

# Mostrar ayuda
node test-chat-specific.js --help
```

#### 📈 **Output de Ejemplo:**
```
👤 Contacto: Sr Alex
🏷️  Etiquetas: Colega Jefe, cotización
📊 Mensajes: 200 de 2.293 totales

📱 CONVERSACIÓN (más recientes primero):
──────────────────────────────────────────────────────────────────────
📅 03/07/25
──────────────────────────────
001. 17:38 🤖 Yo: Cómo te va
002. 17:38 🤖 Yo: Hola rinoceronte de aguas dulces
003. 17:30 🤖 Yo: Si te refieres a "Hojas del Mar", puedo ayudarte...
...
📈 Resumen: 116 míos, 84 del cliente
📅 Período: 01/07/25 a 03/07/25
📊 Conversación abarca: 3 día(s)
```

---

### 2. **test-chats.js**
**Lista todos los chats disponibles**

#### 🛠️ **Uso:**
```bash
node test-chats.js
```

#### 📊 **Funcionalidades:**
- Lista todos los chats
- Muestra información básica de cada chat
- Busca etiquetas en los chats

---

## 🔧 Configuración

### **Token de API:**
El token de Whapi debe estar configurado en cada archivo de test:
```javascript
const WHAPI_TOKEN = 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';
const WHAPI_BASE_URL = 'https://gate.whapi.cloud';
```

### **Formato de Chat ID:**
Los Chat IDs deben seguir el formato: `número@s.whatsapp.net`
- Ejemplo: `573003913251@s.whatsapp.net`

---

## 📊 **Progreso de Implementación**

### ✅ **Completado:**
- [x] Test básico de mensajes
- [x] Test de etiquetas de chat
- [x] Test de lista de chats
- [x] **Análisis completo de conversación** ⭐
- [x] Formato optimizado y legible
- [x] Agrupación por días
- [x] Estadísticas de conversación
- [x] Truncado inteligente de contenido

### 🔄 **En Desarrollo:**
- [ ] Exportación a JSON
- [ ] Análisis de sentimientos
- [ ] Detección de patrones de conversación
- [ ] Integración con sistema de etiquetas

### 📋 **Pendiente:**
- [ ] Tests de endpoints de etiquetas
- [ ] Análisis de tipos de mensaje
- [ ] Métricas de engagement
- [ ] Comparación entre chats

---

## 🎯 **Mejoras Implementadas en test-chat-specific.js**

### **v2.0 - Análisis Completo:**
1. **Funciones de limpieza de texto:**
   - `cleanMessageContent()`: Normaliza espacios y caracteres
   - `smartTruncate()`: Trunca por palabras completas

2. **Display optimizado:**
   - `displayInfo()`: Información de contacto y etiquetas
   - `displayConversations()`: Conversación organizada por días
   - `displaySummary()`: Estadísticas y resumen

3. **Características avanzadas:**
   - Agrupación cronológica por días
   - Numeración secuencial de mensajes
   - Identificación visual de remitentes
   - Manejo de diferentes tipos de mensaje
   - Cálculo de duración de conversación

4. **UX mejorada:**
   - Emojis para mejor legibilidad
   - Separadores visuales
   - Formato consistente
   - Mensajes de error claros
   - Sistema de ayuda integrado

---

## 📝 **Notas Técnicas**

### **Endpoints Utilizados:**
- `GET /chats/{ChatID}` - Información del chat y etiquetas
- `GET /messages/list/{ChatID}` - Lista de mensajes

### **Límites de API:**
- Máximo 200 mensajes por defecto
- Configurable hasta el límite de la API
- Rate limiting según plan de Whapi

### **Formato de Fechas:**
- Entrada: Timestamp Unix
- Salida: DD/MM/YY HH:MM (formato español)
- Agrupación: Por día completo 