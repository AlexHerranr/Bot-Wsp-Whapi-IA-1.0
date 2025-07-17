# 🏗️ **ARQUITECTURA DEL SISTEMA - TeAlquilamos Bot**

> **Diseño completo del sistema de IA conversacional para gestión de reservas**

## 🎯 **VISIÓN GENERAL**

### **Propósito del Sistema**
Bot inteligente de WhatsApp que utiliza **OpenAI GPT-4 gestionar consultas de reservas y disponibilidad de alojamiento, con integración directa a **Beds24* y capacidades de escalamiento a agentes humanos.

### **Arquitectura General**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   TeAlquilamos  │    │     OpenAI      │
│   Business API  │◄──►│      Bot        │◄──►│   GPT-4 +       │
│   (Whapi)       │    │                 │    │   Assistants    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │     Beds24      │
                       │   (Disponibilidad│
                       │   y Reservas)   │
                       └─────────────────┘
```

---

## 🏛️ **ARQUITECTURA EN CAPAS**

### **CAPA1CIÓN (Presentation Layer)**
```
src/
├── app-unified.ts              # 🚀 PUNTO DE ENTRADA PRINCIPAL
├── routes/                     # Endpoints de la API REST
│   └── metrics.ts              # Métricas y monitoreo
└── providers/                  # Proveedores externos
    └── whapi.provider.ts       # Cliente WhatsApp API
```

**Responsabilidades:**
- Recepción de webhooks de WhatsApp
- Exposición de endpoints de API
- Manejo de requests HTTP
- Validación de entrada

### **CAPA 2 LÓGICA DE NEGOCIO (Business Logic Layer)**
```
src/
├── handlers/                   # Manejadores de eventos
│   ├── ai_handler.interface.ts # Interfaz de IA
│   ├── openai_handler.ts       # Manejador OpenAI
│   ├── function-handler.ts     # Manejador de funciones
│   └── multi-assistant-handler.ts # Manejador multi-asistente
├── services/                   # Servicios de negocio
│   ├── beds24                 # Servicio Beds24
│   ├── escalation/             # Escalamiento a humano
│   └── guest-memory.service.ts # Memoria de huéspedes
└── functions/                  # Funciones de OpenAI
    ├── availability/           # Consultas disponibilidad
    ├── booking/                # Gestión reservas
    └── context/                # Contexto conversación
```

**Responsabilidades:**
- Procesamiento de mensajes
- Lógica de negocio
- Integración con APIs externas
- Gestión de estado de conversación

### **CAPA 3: DATOS (Data Layer)**
```
src/
├── utils/persistence/          # Persistencia de datos
│   ├── threadPersistence.ts    # Persistencia de threads
│   └── guestMemory.js          # Memoria de huéspedes
├── utils/context/              # Gestión de contexto
│   ├── contextManager.ts       # Gestor de contexto
│   ├── conversationHistory.ts  # Historial conversaciones
│   └── historyInjection.ts     # Inyección de historial
└── config/                     # Configuraciones
    ├── environment.ts          # Variables de entorno
    ├── secrets.ts              # Gestión de secretos
    └── integrations/           # Configuraciones externas
```

**Responsabilidades:**
- Persistencia de datos
- Gestión de contexto
- Cache y optimización
- Configuración del sistema

### **CAPA 4: UTILIDADES (Utilities Layer)**
```
src/
├── utils/logging/              # Sistema de logging
│   ├── index.ts                # Exportaciones
│   ├── data-sanitizer.ts       # Sanitización de datos
│   └── README.md               # Documentación
├── utils/monitoring/           # Monitoreo y métricas
│   └── dashboard.ts            # Dashboard de métricas
├── utils/whapi/                # Utilidades WhatsApp
│   ├── chatHistory.ts          # Historial de chat
│   ├── whapiLabels.js          # Gestión de etiquetas
│   └── index.ts                # Exportaciones
└── utils/core/                 # Utilidades core
    └── index.ts                # Exportaciones
```

**Responsabilidades:**
- Logging y monitoreo
- Utilidades comunes
- Herramientas de debugging
- Métricas de performance

---

## 🔄 **FLUJO DE PROCESAMIENTO**

### **1. RECEPCIÓN DE MENSAJE**
```
WhatsApp Webhook → app-unified.ts → Validación → Pre-procesamiento
```

### **2 GESTIÓN DE CONTEXTO**
```
Cliente Nuevo? → Obtener Historial → Cache → Inyección Contexto
```

### **3. PROCESAMIENTO IA**
```
OpenAI Assistant → Function Calling → Resolución → Respuesta
```

### **4. INTEGRACIÓN EXTERNA**
```
Beds24 API → Consulta Disponibilidad → Formateo → Respuesta
```

### **5. ENVÍO DE RESPUESTA**
```
Formateo → WhatsApp API → Etiquetas → Logging
```

---

## 🧩 **COMPONENTES PRINCIPALES**

### **🤖 SISTEMA DE IA**
- **OpenAI GPT-4**: Motor de procesamiento de lenguaje natural
- **Assistants API**: Gestión de conversaciones persistentes
- **Function Calling**: Ejecución de funciones específicas
- **Context Management**: Gestión de contexto histórico

### **💬 INTEGRACIÓN WHATSAPP**
- **WhatsApp Business API**: Comunicación con usuarios
- **Webhook Handler**: Recepción de mensajes
- **Message Buffer**: Buffer basado en typing
- **Labels System**: Categorización automática

### **🏨 INTEGRACIÓN BEDS24**
- **Availability Queries**: Consultas de disponibilidad
- **Booking Management**: Gestión de reservas
- **Real-time Data**: Datos en tiempo real
- **Multi-strategy Algorithm**: Algoritmo de priorización

### **📊 MONITOREO Y MÉTRICAS**
- **Performance Metrics**: Métricas de rendimiento
- **Health Checks**: Verificación de estado
- **Logging System**: Sistema de logs estructurado
- **Dashboard**: Panel de control en tiempo real

---

## 🔧 **CONFIGURACIÓN Y DESPLIEGUE**

### **ENTORNOS**
- **Development**: Configuración local para desarrollo
- **Production**: Railway con escalabilidad automática
- **Testing**: Entorno de pruebas automatizadas

### **VARIABLES DE ENTORNO**
```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key
ASSISTANT_ID=your_assistant_id

# WhatsApp
WHAPI_TOKEN=your_whapi_token
WHAPI_API_URL=https://gate.whapi.cloud/

# Beds24EDS24_API_KEY=your_beds24key
BEDS24_AUTHENTICATION_TOKEN=your_auth_token

# Sistema
NODE_ENV=production
PORT=880
```

### **DESPLIEGUE**
- **Railway**: Plataforma principal de producción
- **Docker**: Contenedorización para consistencia
- **CI/CD**: Despliegue automático con GitHub

---

## 🛡️ **SEGURIDAD Y ROBUSTEZ**

### **SEGURIDAD**
- **API Key Management**: Gestión segura de claves
- **Input Validation**: Validación de entrada
- **Rate Limiting**: Limitación de velocidad
- **Error Handling**: Manejo robusto de errores

### **ROBUSTEZ**
- **Retry Logic**: Lógica de reintento automático
- **Fallback Mechanisms**: Mecanismos de respaldo
- **Graceful Degradation**: Degradación elegante
- **Health Monitoring**: Monitoreo de salud

---

## 📈 **OPTIMIZACIONES IMPLEMENTADAS**

### **PERFORMANCE**
- **Thread Persistence**: Reutilización de threads (95% eficiencia)
- **History Cache**: Cache inteligente con TTL (80% hit rate)
- **Hybrid System**: Sistema híbrido para respuestas rápidas
- **Message Buffer**: Buffer basado en typing para naturalidad

### **COSTOS**
- **Reduced API Calls**:3040% menos llamadas a OpenAI
- **Smart Caching**: Cache inteligente de contexto
- **Conditional Injection**: Inyección condicional de historial
- **Efficient Queries**: Consultas optimizadas a Beds24
---

## 🔍 **MÉTRICAS Y MONITOREO**

### **KPIs PRINCIPALES**
- **Response Time**: <2 segundos promedio
- **Uptime**: 99.9% disponibilidad
- **Cache Hit Rate**:80ficiencia de cache
- **Thread Reuse**:95% reutilización de threads

### **ENDPOINTS DE MONITOREO**
- **GET /health**: Estado del sistema
- **GET /metrics**: Métricas detalladas
- **GET /ready**: Verificación de readiness

---

*Esta arquitectura está diseñada para ser escalable, mantenible y eficiente, con un enfoque en la experiencia del usuario y la optimización de costos.* 