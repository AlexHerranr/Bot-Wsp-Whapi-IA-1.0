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

## 🔄 Mejoras Pendientes

### 1. **Sistema de Memoria a Largo Plazo**
- **Estado actual:** Memoria básica en RAM
- **Objetivo:** Base de datos persistente con perfiles detallados
- **Beneficio:** Recordar preferencias, historial, fechas importantes

### 2. **Deployment sin Puerto Local**
- **Estado actual:** Requiere ngrok para túnel
- **Objetivo:** Deploy en cloud (Firebase Functions, AWS Lambda)
- **Beneficio:** URL persistente, alta disponibilidad

### 3. **URL de Webhook Persistente**
- **Estado actual:** URL cambia con cada sesión de ngrok
- **Solución:** Ngrok Pro o deployment en cloud
- **Costo:** ~$10/mes ngrok Pro o hosting cloud

### 4. **Function Calling para Disponibilidad**
- **Estado actual:** Solo respuestas de texto
- **Objetivo:** Consultar disponibilidad real via n8n
- **Beneficio:** Respuestas precisas sobre habitaciones

### 5. **Extracción Inteligente de Contexto**
- **Estado actual:** Solo guarda nombre
- **Objetivo:** IA extrae fechas, preferencias, grupo familiar
- **Beneficio:** Personalización profunda

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

## 🔄 Sistema Inteligente de Splits y Disponibilidad

### **🎯 Algoritmo de Alternativas con Traslado**

El bot implementa un sistema avanzado para maximizar las reservas cuando no hay disponibilidad completa, ofreciendo alternativas inteligentes con traslados entre apartamentos.

#### **📋 Lógica de Negocio:**

| Escenario | Alternativas Mostradas | Límite Traslados | Estrategia |
|-----------|----------------------|------------------|------------|
| **0 opciones completas** | Hasta 3 splits | 3 traslados | Cubrir la necesidad del cliente |
| **1 opción completa** | Hasta 2 splits | 1 traslado | Ofrecer alternativas adicionales |
| **2+ opciones completas** | Hasta 1 split | 1 traslado | Mostrar alternativa económica |

#### **🧠 Estrategias de Optimización:**

1. **🏆 Maximizar Noches Consecutivas**
   - Algoritmo greedy que prioriza estancias largas sin traslados
   - Reduce molestias al huésped

2. **💰 Minimizar Precio Total**
   - Encuentra la combinación más económica
   - Atrae clientes sensibles al precio

3. **🎯 Diversificar Propiedades**
   - Ofrece opciones con diferentes apartamentos
   - Maximiza utilización del inventario

#### **⚙️ Funcionamiento Técnico:**

```javascript
// Implementación en src/handlers/integrations/beds24-availability.ts
function findConsecutiveSplits(
    partialOptions: PropertyData[], 
    dateRange: string[], 
    maxResults: number = 3, 
    maxTransfers: number = 3
): SplitOption[]
```

**Proceso de Optimización:**
1. **Análisis de Disponibilidad**: Clasifica propiedades en completas/parciales
2. **Aplicación de Reglas**: Determina límites según disponibilidad completa
3. **Generación de Splits**: Ejecuta 3 estrategias en paralelo
4. **Filtrado y Ranking**: Ordena por traslados y precio
5. **Validación**: Verifica cobertura completa del rango

#### **📊 Beneficios del Sistema:**

- ✅ **Incrementa conversión**: Ofrece alternativas cuando no hay disponibilidad ideal
- ✅ **Maximiza ingresos**: Utiliza inventario parcial disponible
- ✅ **Mejora experiencia**: Prioriza comodidad limitando traslados
- ✅ **Optimiza precios**: Encuentra combinaciones económicas
- ✅ **Inteligencia adaptativa**: Ajusta estrategia según disponibilidad

#### **🧪 Testing y Validación:**

```bash
# Test específico de lógica de splits
npx tsx tests/beds24/test-beds24.js splits 2025-07-09 2025-07-11

# Verificación completa del sistema
npx tsx tests/beds24/test-beds24.js general 2025-07-17 2025-07-21
```

**Métricas de Validación:**
- Aplicación correcta de reglas de negocio
- Respeto de límites de traslados
- Cobertura completa del rango solicitado
- Optimización de precios y comodidad

#### **📤 Mensajes Contextualizados a OpenAI:**

El sistema envía mensajes específicos a OpenAI para que entienda la situación de disponibilidad:

**🔴 Sin Disponibilidad Completa:**
```
❌ **No hay Disponibilidad Completa - Solo Parcial con Opción de Traslado**
💡 *Alternativas con cambio de apartamento (ofrecer solo como opción adicional al huésped)*
```

**🟢 Con Disponibilidad Completa:**
```
🥇 **Apartamentos Disponibles (X opciones)**
🔄 **Opciones Adicionales con Traslado**
💡 *Alternativas económicas con cambio de apartamento (opcional para el huésped)*
```

**⚫ Sin Disponibilidad:**
```
❌ **Sin disponibilidad para X noches**
💡 Considera fechas alternativas
```

**Beneficios del contexto:**
- ✅ OpenAI distingue entre disponibilidad ideal vs alternativas
- ✅ Maneja expectativas del huésped apropiadamente
- ✅ Presenta traslados como opciones adicionales, no primarias
- ✅ Guía la conversación hacia la mejor experiencia del cliente

---

## 🤖 Sistema de Gestión del Assistant

### **CLI Unificado para Gestión Profesional**

El proyecto incluye un sistema completo para gestionar el assistant de OpenAI de forma eficiente:

```bash
# Ver ayuda del sistema
npm run assistant help

# Ver estado actual del assistant
npm run assistant status

# Actualizar prompt principal
npm run assistant prompt

# Agregar nuevo archivo RAG
npm run assistant add-file "# 17_NUEVO_ARCHIVO.txt"

# Actualización inteligente completa
npm run assistant update-all
```

### **Características del Sistema:**

- **🎯 CLI Unificado**: Un solo comando para todas las operaciones
- **📊 Estado en Tiempo Real**: Ver configuración, archivos y últimas actualizaciones
- **🔄 Actualización Inteligente**: Detecta cambios automáticamente
- **💰 Optimización de Costos**: Solo actualiza lo que cambió
- **📚 Documentación Completa**: Guías paso a paso para cada operación

### **Estructura de Gestión:**
```
scripts/assistant-management/
├── assistant-cli.js          # CLI principal
├── update-prompt.js          # Gestión de prompts
├── add-rag-file.js           # Archivos RAG
├── update-functions.js       # Funciones del assistant
└── update-assistant-smart.js # Actualización inteligente

RAG OPEN AI ASSISTANCE/       # Archivos de conocimiento
├── # 00_INSTRUCCIONES_DEL_ASISTENTE.txt # Prompt principal
├── # 01_MAPA_NAVEGACION.txt  # Archivos RAG (17 total)
└── ... (archivos de conocimiento)
```

**📖 Documentación completa**: [docs/ASSISTANT_MANAGEMENT.md](./docs/ASSISTANT_MANAGEMENT.md)

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- Cuenta en Whapi Cloud
- OpenAI API Key con Assistant configurado

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/bot-whatsapp-ia

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Desarrollo local
npm run dev

# Para producción (requiere ngrok)
ngrok http 3008
# Copiar URL en configuración de Whapi
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

---

**📅 Última actualización:** Enero 2025 - Versión unificada restaurada con todas las funcionalidades