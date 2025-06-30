# 📚 Índice de Documentación - Bot WhatsApp TeAlquilamos

## 1. README.md - Documentación Principal

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

## 2. MIGRATION_GUIDE.md - Guía Técnica de Migración

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

## 5. Estructura de Archivos del Proyecto

```
BotWhatsApp-TeAlquilamos/
├── 📄 README.md                    # Documentación principal
├── 📁 docs/
│   ├── 📄 MIGRATION_GUIDE.md      # Guía técnica detallada
│   ├── 📄 FEATURE_ROADMAP.md      # Funcionalidades y casos de uso
│   ├── 📄 ASSISTANT_CONFIG.md     # Config function calling
│   └── 📄 DOCS_INDEX.md           # Este archivo
├── 📁 src/
│   ├── 📄 app.ts                  # Servidor principal con Whapi
│   ├── 📁 utils/
│   │   ├── 📄 groqAi.js           # Integración OpenAI + Functions
│   │   └── 📄 guestMemory.js      # Sistema de memoria
│   └── 📁 handlers/
│       ├── 📄 function-handler.js  # Manejador principal
│       └── 📄 availability-handler.js # Functions de disponibilidad
├── 📄 .env.example                # Variables de entorno ejemplo
└── 📄 package.json                # Dependencias del proyecto
```
---
## 6. Orden de Lectura Recomendado

1. **Para nuevos desarrolladores:**
   - README.md → MIGRATION_GUIDE.md → FEATURE_ROADMAP.md

2. **Para implementar function calling:**
   - ASSISTANT_CONFIG.md → availability-handler.js → function-handler.js

3. **Para implementar nuevas funciones:**
   - FEATURE_ROADMAP.md → Sección específica de la función

4. **Para resolver problemas:**
   - MIGRATION_GUIDE.md → Sección Troubleshooting

5. **Para entender el contexto:**
   - README.md → Sección de mejoras y posibilidades