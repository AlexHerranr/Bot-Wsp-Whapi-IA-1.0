Documentación Principal
1.1 Migración de BuilderBot a Whapi

Por qué migramos (limitaciones vs beneficios)
Tabla comparativa de arquitectura

1.2 Cambios Técnicos

Archivos modificados
Dependencias actualizadas
Nueva estructura del proyecto

1.3 Mejoras Implementadas

Sistema de cola de mensajes
Tiempo de escritura simulado (3 segundos)
Procesamiento secuencial por usuario
Logs estructurados con timestamps
Manejo robusto de errores
Contexto de usuario en mensajes

1.4 Mejoras Pendientes

Sistema de memoria a largo plazo
Deployment sin puerto local
URL de webhook persistente
Function calling para disponibilidad
Extracción inteligente de contexto

1.5 Nuevas Posibilidades con Whapi

Gestión de estados y presencia
Interacción con grupos
Sistema de etiquetas
Encuestas interactivas
Stories/Estados
Catálogo de productos
Gestión de llamadas
Lista negra
Ubicación en vivo
Confirmaciones de lectura

1.6 Inicio Rápido

Requisitos del sistema
Instalación paso a paso
Variables de entorno necesarias

# Bot WhatsApp con IA - TeAlquilamos

Bot de WhatsApp inteligente para gestión de reservas hoteleras, integrado con OpenAI Assistant API y Whapi Cloud.

## 🚀 Migración de BuilderBot/Baileys a Whapi Cloud

### ¿Por qué migramos?

**BuilderBot + Baileys** presentaba limitaciones:
- Dependencia de WhatsApp Web (inestable)
- Requería QR constante
- Sin soporte oficial de Meta
- Limitaciones en funcionalidades empresariales

**Whapi Cloud** ofrece:
- API oficial más estable
- Sin necesidad de QR después de la conexión inicial
- Soporte completo de funciones empresariales
- Webhooks confiables
- Escalabilidad garantizada

## 📋 Cambios Técnicos Realizados

### Arquitectura

| Componente | Antes (BuilderBot) | Ahora (Whapi) |
|------------|-------------------|---------------|
| **Proveedor** | `@builderbot/provider-baileys` | API REST Whapi Cloud |
| **Conexión** | WhatsApp Web (QR) | API Token persistente |
| **Webhooks** | Socket.io interno | HTTP POST directo |
| **Estructura de datos** | Formato Baileys | Formato estandarizado Whapi |

### Archivos Modificados

1. **`src/app.ts`** (completamente reescrito)
   - Eliminada dependencia de BuilderBot
   - Implementación directa con Express
   - Manejo nativo de webhooks HTTP

2. **`src/utils/groqAi.js`** (nuevo)
   - Lógica de OpenAI extraída y modularizada
   - Gestión de threads por usuario

3. **`src/utils/guestMemory.js`** (nuevo)
   - Sistema básico de memoria de invitados
   - Preparado para expansión futura

### Dependencias

**Eliminadas:**
- `@builderbot/bot`
- `@builderbot/provider-baileys`
- `qrcode-terminal`

**Mantenidas:**
- `express` - Servidor HTTP
- `openai` - Integración con Assistant API
- `dotenv` - Variables de entorno
- `body-parser` - Parseo de webhooks

**Nuevas:**
- Ninguna adicional (uso de fetch nativo para Whapi)

## ✨ Mejoras Implementadas

### 1. **Sistema de Cola de Mensajes**
**Por qué:** Evita condiciones de carrera cuando llegan múltiples mensajes simultáneos.
```javascript
// Ver implementación en src/app.ts - messageQueue
```

### 2. **Tiempo de Escritura Simulado**
**Por qué:** Hace la conversación más natural y humana.
- 3 segundos de "escribiendo..." antes de cada respuesta
- Configurable via `typing_time` en Whapi

### 3. **Procesamiento Secuencial por Usuario**
**Por qué:** Mantiene coherencia en conversaciones rápidas.
- Un usuario no puede tener mensajes procesándose en paralelo
- Preserva el contexto de la conversación

### 4. **Logs Estructurados con Timestamps**
**Por qué:** Facilita debugging y monitoreo en producción.
```
[2025-06-28T23:55:52.712Z] [INFO] Procesando mensaje de 573003913251: "Hola"
```

### 5. **Manejo Robusto de Errores**
**Por qué:** Evita que el bot se caiga por errores puntuales.
- Try-catch en todos los puntos críticos
- Respuestas de error amigables al usuario
- Logs detallados de errores

### 6. **Contexto de Usuario en Mensajes**
**Por qué:** La IA conoce el nombre del cliente desde el inicio.
```javascript
contextualMessage = `[CONTEXTO: Cliente se llama ${message.from_name}]\n${message.text.body}`;
```

## ✅ MEJORAS COMPLETADAS (Enero 2025)

### 1. **Sistema Unificado de Aplicación**
- **✅ Completado:** Un solo archivo principal (`app-unified.ts`)
- **✅ Beneficio:** Detección automática de entorno (local vs Cloud Run)
- **✅ Resultado:** Configuración dinámica de puertos y timeouts

### 2. **Deployment Optimizado para Cloud Run**
- **✅ Completado:** Sistema de build con TypeScript Compiler
- **✅ Beneficio:** Build más rápido y confiable
- **✅ Resultado:** Deployment automatizado sin errores

### 3. **Function Calling Completo**
- **✅ Completado:** Integración con Beds24 API
- **✅ Beneficio:** Consultas de disponibilidad en tiempo real
- **✅ Resultado:** Respuestas precisas con precios actuales

### 4. **Sistema de Buffers Inteligente**
- **✅ Completado:** Agrupación de mensajes (8s local, 6s Cloud Run)
- **✅ Beneficio:** Respuestas más naturales y contextualizadas
- **✅ Resultado:** Mejor experiencia de usuario

### 5. **Reorganización Completa del Proyecto**
- **✅ Completado:** Archivos históricos archivados en `/archive/`
- **✅ Beneficio:** Proyecto limpio y mantenible
- **✅ Resultado:** Estructura clara para desarrollo futuro

## 🔄 Mejoras Pendientes

### 1. **Sistema de Memoria a Largo Plazo**
- **Estado actual:** Memoria básica en threads OpenAI
- **Objetivo:** Base de datos persistente con perfiles detallados
- **Beneficio:** Recordar preferencias, historial, fechas importantes

### 2. **Escalamiento a Humanos**
- **Estado actual:** Especificación completa lista
- **Objetivo:** Función `escalate_to_human()` implementada
- **Beneficio:** Derivación automática para casos complejos

### 3. **Sistema Multi-Assistant**
- **Estado actual:** Un assistant para todo
- **Objetivo:** Assistants especializados (pricing, availability, info)
- **Beneficio:** Respuestas más rápidas y precisas

### 4. **Dashboard de Monitoreo**
- **Estado actual:** Solo logs de Cloud Run
- **Objetivo:** Interface web para monitoreo en tiempo real
- **Beneficio:** Visibilidad completa del sistema

### 5. **Analytics y Métricas**
- **Estado actual:** Logs básicos
- **Objetivo:** Métricas de uso, patrones de consulta, success rate
- **Beneficio:** Optimización basada en datos reales

## 🆕 Nuevas Posibilidades con Whapi

### 📱 Gestión de Estados y Presencia
```
PUT /status - Cambiar estado del bot
PUT /presences/me - Mostrar "en línea" o "escribiendo"
```
**Uso potencial:** Bot que aparece "fuera de horario" automáticamente

### 👥 Interacción con Grupos
```
POST /groups - Crear grupos de huéspedes
POST /groups/{GroupID}/participants - Añadir participantes
```
**Uso potencial:** Grupos automáticos por reserva familiar/empresarial

### 🏷️ Sistema de Etiquetas
```
POST /labels - Crear etiquetas (VIP, Frecuente, Problemático)
POST /labels/{LabelID}/{ContactID} - Asignar etiquetas
```
**Uso potencial:** OpenAI puede ver si es cliente VIP y ajustar respuestas

### 📊 Encuestas Interactivas
```
POST /messages/poll - Enviar encuestas
```
**Uso potencial:** Satisfacción post-estadía, preferencias de servicios

### 🖼️ Stories/Estados
```
POST /stories/send/media - Publicar promociones
GET /stories - Ver quién vio las historias
```
**Uso potencial:** Marketing directo, ofertas especiales

### 💼 Catálogo de Productos
```
POST /business/products - Crear habitaciones como productos
POST /business/catalogs - Enviar catálogo completo
```
**Uso potencial:** Mostrar habitaciones con precios y fotos

### 📞 Gestión de Llamadas
```
POST /calls - Registrar intentos de llamada
```
**Uso potencial:** Callback automático o derivación a ventas

### 🚫 Lista Negra
```
PUT /blacklist/{ContactID} - Bloquear usuarios problemáticos
```
**Uso potencial:** Gestión automática de spam o usuarios abusivos

### 📍 Ubicación en Vivo
```
POST /messages/live_location - Compartir ubicación del hotel
```
**Uso potencial:** Guiar a huéspedes en tiempo real

### 👁️ Confirmaciones de Lectura
```
PUT /messages/{MessageID} - Marcar como leído
GET /statuses/{MessageID} - Ver quién leyó en grupos
```
**Uso potencial:** Confirmar recepción de información importante

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- Cuenta en Whapi Cloud
- OpenAI API Key con Assistant configurado

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/AlexHerranr/Bot-Wsp-Whapi-IA-1.0

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Desarrollo local (detección automática de entorno)
npm run dev          # Puerto 3008 + detección automática
npm run dev:local    # Puerto 3008 + ngrok automático
npm run dev:cloud    # Simula Cloud Run en puerto 8080

# Build y deploy
npm run build        # Compilación TypeScript
npm run deploy       # Deploy automático a Cloud Run
```

### Variables de Entorno Requeridas

```env
# Whapi
WHAPI_TOKEN=tu_token_aqui
WHAPI_API_URL=https://gate.whapi.cloud/

# OpenAI
OPENAI_API_KEY=sk-...
ASSISTANT_ID=asst_...

# App
PORT=3008
DEBUG_MODE=true
```

## 📚 Documentación Adicional

- [Guía de Migración Técnica](./docs/MIGRATION_GUIDE.md)
- [Roadmap de Funcionalidades](./docs/FEATURE_ROADMAP.md)
- [API Reference de Whapi](https://whapi.readme.io/reference)

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit con mensajes descriptivos
4. Push y crea un Pull Request

## 📄 Licencia

MIT License - ver [LICENSE](./LICENSE) para detalles.