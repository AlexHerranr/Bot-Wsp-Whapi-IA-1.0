# 📚 Índice de Documentación - Bot WhatsApp TeAlquilamos

## 🚀 progress/ROADMAP.md - Retos y Desarrollo Futuro ⭐ NUEVO
- **Prioridad Alta**: Pruebas multi-usuario, contexto histórico Whapi, **Function Calling** ⭐ CRÍTICO, optimización performance
- **Prioridad Media**: Dashboard tiempo real, sistema moderación, analytics
- **Prioridad Baja**: Handoff inteligente, personalización, integración CRM
- Timeline de desarrollo y criterios de priorización

## 📋 progress/PROGRESO-BOT.md - Estado Actual y Funcionalidades ⭐ NUEVO
- **Estado Production Ready**: Thread persistence, sincronización manual, UI optimizada
- **23 Funcionalidades**: Sistema buffering, logs dual, colores profesionales, multi-usuario
- **Avances Recientes**: Sincronización manual agentes, optimización masiva UI (7→2 líneas)
- **Sistema Timeouts**: Evolución a 8s fijos (simple y predecible)

## 1. ../README.md - Documentación Principal

### 1.1 Migración de BuilderBot a Whapi
- Por qué migramos (limitaciones vs beneficios)
- Tabla comparativa de arquitectura

### 1.2 Cambios Técnicos
- Archivos modificados
- Dependencias actualizadas
- Nueva estructura del proyecto

### 1.3 Mejoras Implementadas
- Sistema de cola de mensajes
- Tiempo de escritura simulado (3 segundos)
- Procesamiento secuencial por usuario
- Logs estructurados con timestamps
- Manejo robusto de errores
- Contexto de usuario en mensajes

### 1.4 Mejoras Pendientes
- Sistema de memoria a largo plazo
- Deployment sin puerto local
- URL de webhook persistente
- ✅ Function calling para disponibilidad (IMPLEMENTADO)
- Extracción inteligente de contexto

### 1.5 Nuevas Posibilidades con Whapi
- Gestión de estados y presencia
- Interacción con grupos
- Sistema de etiquetas
- Encuestas interactivas
- Stories/Estados
- Catálogo de productos
- Gestión de llamadas
- Lista negra
- Ubicación en vivo
- Confirmaciones de lectura

### 1.6 Inicio Rápido
- Requisitos del sistema
- Instalación paso a paso
- Variables de entorno necesarias

---

## 2. development/MIGRATION_GUIDE.md - Guía Técnica de Migración

### 2.1 Análisis de Diferencias
- Modelo de conexión (QR vs Token)
- Estructura de webhooks
- Formato de mensajes
- Métodos de envío

### 2.2 Proceso de Migración
- **Fase 1**: Análisis y preparación
- **Fase 2**: Implementación del servidor
- **Fase 3**: Adaptación de lógica de negocio
- **Fase 4**: Testing y debugging

### 2.3 Mejoras Técnicas
- Manejo de concurrencia
- Simulación de comportamiento humano
- Persistencia de estado

### 2.4 Consideraciones
- Seguridad y variables de entorno
- Validación de webhooks
- Manejo de errores

### 2.5 Troubleshooting
- Errores comunes y soluciones
- Verificación de webhooks
- Debugging con ngrok

## 3. FEATURE_ROADMAP.md - Roadmap de Funcionalidades

### 3.1 Funcionalidades Prioritarias

#### 🎯 3.1.1 Function Calling para Disponibilidad (IMPLEMENTADO)
- Integración con n8n
- Consulta a Beds24 o Google Sheets
- Respuestas en tiempo real sobre habitaciones
- Creación de pre-reservas
- Cálculo de precios automático

#### 3.1.2 Sistema de Memoria Inteligente
- Perfiles enriquecidos de huéspedes
- Historial de preferencias
- Integración con etiquetas

#### 3.1.3 Grupos Automáticos por Reserva
- Creación automática para familias
- Información compartida de check-in
- Comunicación grupal coordinada

### 3.2 Funcionalidades de Marketing

#### 3.2.1 Catálogo Visual de Habitaciones
- Habitaciones como productos
- Fotos y precios actualizados
- Disponibilidad en tiempo real

#### 3.2.2 Stories Automatizadas
- Publicación programada
- Promociones semanales
- Analytics de engagement

### 3.3 Funcionalidades de Gestión

#### 3.3.1 Sistema de Etiquetas
- Categorización automática (VIP, Corporativo, etc.)
- Integración con contexto de IA
- Personalización de respuestas

#### 3.3.2 Encuestas Post-Estadía
- Feedback automatizado
- Gestión de reseñas
- Mejora continua

### 3.4 Funcionalidades Operativas

#### 3.4.1 Gestión de Documentos
- Envío automático de facturas
- Guías y menús en PDF
- Documentación personalizada

#### 3.4.2 Ubicación en Tiempo Real
- Shuttle tracking
- Guía desde aeropuerto
- Puntos de interés cercanos

#### 3.4.3 Lista Negra Automática
- Triggers configurables
- Bloqueo preventivo
- Gestión de incidencias

---

## 4. ASSISTANT_CONFIG.md - Configuración Function Calling

### 4.1 Configuración del OpenAI Assistant
- Definición de funciones (check_availability, create_booking, get_room_price)
- Instrucciones del Assistant
- Mejores prácticas

### 4.2 Implementación en el Bot
- availability-handler.js
- function-handler.js
- groqAi.js actualizado

### 4.3 Configuración n8n
- Workflow de ejemplo
- Integración con Beds24
- Integración con Google Sheets

### 4.4 Testing y Monitoreo
- Casos de prueba
- Debugging
- Logs y métricas

---

## 5. features/SISTEMA_ACTUALIZACION_LABELS.md - Sistema de Etiquetas Automático ⭐ NUEVO

### 5.1 Arquitectura del Sistema
- ThreadPersistenceManager actualizado
- WhapiLabelsManager integración
- FunctionHandler sincronización

### 5.2 Actualización Automática
- En cada mensaje recibido
- Al crear threads nuevos
- Después de procesar con OpenAI
- Via función update_client_labels

### 5.3 Persistencia y Respaldo
- Auto-guardado optimizado (5 minutos)
- Sistema de backups automático
- Validación de datos

### 5.4 Testing
- Script test-labels-update.js
- Verificación de sincronización
- Comparación de estados

---

## 6. features/EXTRACCION_ETIQUETAS_WHATSAPP.md - Proceso de Extracción ⭐ NUEVO

### 6.1 API de WhatsApp
- Endpoint /chats/{CHAT_ID}
- Estructura de respuesta JSON
- Formato de etiquetas

### 6.2 Implementación
- Función getEnhancedContactInfo
- Validación de datos
- Manejo de errores

### 6.3 Casos de Uso
- Cliente sin etiquetas
- Múltiples etiquetas
- Modificaciones externas

### 6.4 Herramientas de Prueba
- test-chat-specific.js
- Logging detallado
- Debugging tips

---

## 7. features/CONTEXTO_HISTORIAL_CONVERSACION.md - Contexto Histórico ⭐ IMPLEMENTADO

### 7.1 Sistema de Contexto
- Detección de clientes nuevos (sin thread)
- Obtención de últimos 200 mensajes vía API de WhatsApp
- Formato estructurado para OpenAI con fecha, hora y remitente
- Activación automática solo en primer contacto

### 7.2 Implementación
- getChatHistory en chatHistory.ts
- Integración en processWithOpenAI
- Manejo de errores robusto
- Logs detallados para debugging

### 7.3 Estructura del Contexto
- Contexto temporal (fecha/hora Colombia UTC-5)
- Contexto conversacional (cliente/etiquetas)
- Historial de conversación (últimos 200 mensajes)
- Mensaje actual del cliente

### 7.4 Testing y Verificación
- test-chat-history.js - Prueba de obtención de historial
- test-new-client-context.js - Simulación de contexto completo
- test-metadata-updates.js - Verificación de metadatos
- Verificación exitosa en producción ✅

### 7.5 Beneficios
- Bot recuerda conversaciones anteriores sin thread
- Respuestas más contextualizadas desde el primer mensaje
- Mejor experiencia para clientes recurrentes
- Reducción de preguntas repetitivas

---

## 8. Estructura de Archivos del Proyecto

```
Bot-Wsp-Whapi-IA/
├── 📄 README.md                    # Documentación principal
├── 📁 config/                      # Archivos de configuración
│   ├── 📄 assistant-config.json    # Configuración del asistente
│   ├── 📄 nodemon.json            # Configuración de nodemon
│   └── 📄 rollup.config.js        # Configuración de rollup
├── 📁 docs/
│   ├── 📄 INDEX.md                # Este archivo
│   ├── 📁 progress/               # Documentación de progreso
│   │   ├── 📄 ROADMAP.md
│   │   ├── 📄 PROGRESO-BOT.md
│   │   ├── 📄 TAREAS_PENDIENTES.md
│   │   └── 📄 HISTORIAL_CAMBIOS.md
│   ├── 📁 features/               # Documentación de funcionalidades
│   │   ├── 📄 SISTEMA_ACTUALIZACION_LABELS.md
│   │   ├── 📄 EXTRACCION_ETIQUETAS_WHATSAPP.md
│   │   ├── 📄 CONTEXTO_HISTORIAL_CONVERSACION.md
│   │   ├── 📄 BEDS24_INTEGRATION_COMPLETE.md
│   │   └── 📄 ESCALATE_TO_HUMAN_SPEC.md
│   ├── 📁 development/            # Documentación técnica
│   │   ├── 📄 MIGRATION_GUIDE.md
│   │   └── 📄 PROPUESTA_REORGANIZACION_PROYECTO.md
│   └── 📁 legacy/                 # Documentación antigua
│       └── 📄 README_OLD.md
├── 📁 src/
│   ├── 📄 app.ts                  # Servidor principal con Whapi
│   ├── 📁 utils/
│   │   ├── 📄 groqAi.js           # Integración OpenAI + Functions
│   │   └── 📄 guestMemory.js      # Sistema de memoria
│   └── 📁 handlers/
│       ├── 📄 function-handler.js  # Manejador principal
│       └── 📄 availability-handler.js # Functions de disponibilidad
├── 📁 tests/
│   └── 📄 test-labels-update.js   # Prueba de actualización de etiquetas ⭐ NUEVO
├── 📄 .env.example                # Variables de entorno ejemplo
└── 📄 package.json                # Dependencias del proyecto
```
---
## 9. Orden de Lectura Recomendado

1. **Para nuevos desarrolladores:**
   - ../README.md → progress/PROGRESO-BOT.md → progress/ROADMAP.md

2. **Para entender el estado actual:**
   - progress/PROGRESO-BOT.md → Funcionalidades implementadas

3. **Para planificar desarrollo futuro:**
   - progress/ROADMAP.md → Retos por prioridad → Timeline

4. **Para implementar function calling (legacy):**
   - ASSISTANT_CONFIG.md → availability-handler.js → function-handler.js

5. **Para migración técnica (legacy):**
   - development/MIGRATION_GUIDE.md → Troubleshooting

6. **Para entender funcionalidades legacy:**
   - FEATURE_ROADMAP.md → Casos de uso específicos

7. **Para implementar actualización de etiquetas:**
   - features/SISTEMA_ACTUALIZACION_LABELS.md → features/EXTRACCION_ETIQUETAS_WHATSAPP.md → test-labels-update.js

8. **Para implementar contexto histórico:**
   - features/CONTEXTO_HISTORIAL_CONVERSACION.md → chatHistory.ts → test-chat-history.js