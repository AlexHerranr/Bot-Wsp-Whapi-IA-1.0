# 🤖 Bot WhatsApp TeAlquilamos - Sistema Inteligente de Reservas

> **🚀 BOT UNIFICADO Y OPTIMIZADO** - Sistema completo de atención al cliente con IA avanzada

## 🎯 **Descripción del Proyecto**

**TeAlquilamos Bot** es un sistema inteligente de atención al cliente para WhatsApp que automatiza consultas de disponibilidad, reservas y atención al cliente para propiedades turísticas. El bot utiliza **OpenAI GPT-4** con **Function Calling** para integrar con **Beds24** y proporcionar respuestas en tiempo real.

### **✨ Características Principales**

- 🤖 **IA Conversacional Avanzada** - OpenAI GPT-4 con contexto inteligente
- 📅 **Consultas de Disponibilidad en Tiempo Real** - Integración directa con Beds24
- 🏠 **Sistema de Reservas Automatizado** - Creación y gestión de reservas
- 👥 **Atención Multi-Usuario** - Manejo simultáneo de múltiples conversaciones
- 🏷️ **Sistema de Etiquetas Inteligente** - Categorización automática de clientes
- 📊 **Logging Avanzado** - Monitoreo completo con logs estructurados
- ☁️ **Despliegue en Cloud Run** - Escalabilidad automática y alta disponibilidad

---

## 🗺️ **MAPA DE NAVEGACIÓN DEL PROYECTO**

### **📁 Estructura Principal**
```
Bot-Wsp-Whapi-IA/
├── 🚀 src/app-unified.ts                  # APLICACIÓN PRINCIPAL
├── ⚙️ src/config/                         # Configuración del sistema
├── 🤖 src/handlers/                       # Manejadores de IA y webhooks
├── 🏨 src/services/                       # Servicios de negocio (Beds24, etc.)
├── 🔧 src/functions/                      # Funciones de OpenAI Function Calling
├── 🛠️ src/utils/                          # Utilidades y helpers
├── 📚 docs/                               # Documentación completa
├── 🧪 tests/                              # Tests y validaciones
├── 🛠️ scripts/                            # Scripts de automatización
├── 🧹 tmp/                                # Archivos temporales
└── 📦 archive/                            # Archivos históricos
```

### **🎯 Archivos Clave para Desarrollo**
- **`src/app-unified.ts`** - Punto de entrada principal
- **`src/config/environment.ts`** - Configuración de entornos
- **`src/config/secrets.ts`** - Gestión de secretos
- **`package.json`** - Configuración del proyecto
- **`README.md`** - Documentación principal

### **📚 Documentación Esencial**
- **`QUICK_START.md`** - Inicio rápido
- **`docs/development/local-setup.md`** - Setup local
- **`docs/deployment/README.md`** - Guía de deployment
- **`PROJECT_STRUCTURE.md`** - Mapa de navegación completo

### **🛠️ Scripts Importantes**
- **`npm run verify`** - Verificar configuración
- **`npm run dev:local`** - Desarrollo local
- **`npm run deploy`** - Deploy a producción

> **📖 Para ver el mapa completo detallado**: Consulta [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)

---

## 🏗️ **Arquitectura del Sistema**

```
Usuario WhatsApp → WHAPI → Bot (app-unified.ts) → OpenAI Assistant → Function Calling → Beds24 API
                                    ↓
                              Respuesta Inteligente ← Contexto + Historial + Etiquetas
```

### **🔧 Componentes Principales**

| Componente | Función | Estado |
|------------|---------|---------|
| **WHAPI Integration** | Conexión con WhatsApp Business API | ✅ Activo |
| **OpenAI Assistant** | Procesamiento de lenguaje natural | ✅ Activo |
| **Function Calling** | Integración con APIs externas | ✅ Activo |
| **Beds24 Integration** | Consulta de disponibilidad en tiempo real | ✅ Activo |
| **Thread Persistence** | Mantenimiento de contexto conversacional | ✅ Activo |
| **Label Management** | Categorización automática de clientes | ✅ Activo |
| **Message Buffering** | Agrupación inteligente de mensajes | ✅ Activo |

---

## 🚀 **Funcionalidades Implementadas**

### **1. 🤖 Procesamiento Inteligente de Mensajes**
- **Buffer Inteligente**: Agrupa mensajes múltiples en ventanas de 8 segundos
- **División Automática**: Divide mensajes largos en chunks manejables
- **Prevención de Duplicados**: Sistema anti-spam y control de rate limiting
- **Contexto Conversacional**: Mantiene historial de conversaciones por usuario

### **2. 📅 Consultas de Disponibilidad en Tiempo Real**
- **Integración Beds24**: Consulta directa a la API de gestión hotelera
- **Algoritmo Multi-Estrategia**: Prioriza opciones sin traslados, luego alternativas
- **Formato Inteligente**: Presenta opciones con precios, características y totales
- **Validación de Fechas**: Conversión automática de fechas relativas a absolutas

### **3. 🏠 Sistema de Reservas Automatizado**
- **Creación de Pre-Reservas**: Proceso automatizado cuando el cliente confirma interés
- **Validación de Datos**: Verificación de información del huésped
- **Confirmación Automática**: Generación de códigos de reserva únicos
- **Integración con Beds24**: Sincronización automática con sistema de gestión

### **4. 👥 Gestión Avanzada de Clientes**
- **Perfiles de Usuario**: Almacenamiento de preferencias y historial
- **Sistema de Etiquetas**: Categorización automática (VIP, Corporativo, etc.)
- **Contexto Histórico**: Recuperación de conversaciones anteriores
- **Personalización**: Respuestas adaptadas según perfil del cliente

### **5. 🔄 Escalamiento Inteligente**
- **Detección Automática**: Identifica cuando un caso requiere intervención humana
- **Routing Inteligente**: Dirige casos a agentes especializados según el tipo
- **Transferencia de Contexto**: Mantiene toda la información de la conversación
- **Notificaciones Automáticas**: Alerta a agentes humanos vía WhatsApp

### **6. 📊 Monitoreo y Analytics**
- **Logging Estructurado**: Sistema de logs con 40+ categorías estandarizadas
- **Métricas en Tiempo Real**: Dashboard con estadísticas de uso
- **Detección de Errores**: Alertas automáticas para problemas críticos
- **Análisis de Performance**: Métricas de tiempo de respuesta y satisfacción

### **7. 🚀 Sistema Híbrido Inteligente** ✅ NUEVO
- **Patrones Simples**: Detección automática de saludos, agradecimientos, despedidas
- **Respuestas Instantáneas**: <1 segundo para casos comunes sin OpenAI
- **Flujo Híbrido**: Guía inteligente en consultas de disponibilidad incompletas
- **Inyección Condicional**: Contexto histórico solo cuando es relevante
- **Cache Inteligente**: Optimización de llamadas a APIs con TTL configurable
- **Métricas Avanzadas**: Monitoreo detallado de patrones y eficiencia
- **Reducción de Costos**: 30-40% menos llamadas a OpenAI

---

## 🛠️ **Tecnologías Utilizadas**

### **Backend & IA**
- **Node.js** - Runtime de JavaScript
- **TypeScript** - Tipado estático y mejor desarrollo
- **OpenAI GPT-4** - Procesamiento de lenguaje natural
- **Function Calling** - Integración con APIs externas

### **APIs & Integraciones**
- **WHAPI** - WhatsApp Business API
- **Beds24** - Sistema de gestión hotelera
- **Google Cloud Run** - Plataforma de despliegue
- **Google Secret Manager** - Gestión segura de credenciales

### **Monitoreo & Logging**
- **Google Cloud Logging** - Sistema de logs estructurados
- **Custom Logging System** - Categorización y formateo personalizado
- **Health Checks** - Monitoreo de estado del servicio

---

## 🔄 **Arquitectura de Entornos**

### **🏠 Desarrollo Local**
- **Puerto**: 3008
- **Host**: localhost
- **Webhook**: Ngrok (actual-bobcat-handy.ngrok-free.app)
- **Configuración**: Variables de entorno locales (.env)
- **Logs**: Consola + archivos locales
- **Secretos**: Variables de entorno directas

### **☁️ Producción (Cloud Run)**
- **Puerto**: 8080
- **Host**: 0.0.0.0
- **Webhook**: URL de Cloud Run
- **Configuración**: Google Secret Manager
- **Logs**: Google Cloud Logging
- **Secretos**: Google Secret Manager

### **🔄 Separación Automática**
El sistema detecta automáticamente el entorno mediante:
- **Variable `K_SERVICE`**: Presente en Cloud Run
- **Variable `NODE_ENV`**: Configurada como 'production'
- **Configuración dinámica**: URLs, puertos y secretos se ajustan automáticamente

---

## 🚀 **Inicio Rápido**

### **Prerrequisitos**
- Node.js 18+ 
- Cuenta de OpenAI con API key
- Cuenta de WHAPI (WhatsApp Business API)
- Cuenta de Beds24
- Proyecto en Google Cloud Platform

### **1. Clonar el Repositorio**
```bash
git clone https://github.com/tu-usuario/Bot-Wsp-Whapi-IA.git
cd Bot-Wsp-Whapi-IA
```

### **2. Instalar Dependencias**
```bash
npm install
# o
pnpm install
```

### **3. Configurar Variables de Entorno (Desarrollo Local)**
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Configurar variables para desarrollo local
OPENAI_API_KEY=sk-proj-...
ASSISTANT_ID=asst_...
WHAPI_TOKEN=tu_token_whapi
WHAPI_API_URL=https://gate.whapi.cloud
BEDS24_TOKEN=tu_token_beds24
BEDS24_API_URL=https://api.beds24.com
```

### **4. Configurar OpenAI Assistant**
- Crear un nuevo Assistant en OpenAI
- Configurar las funciones de Function Calling (ver documentación)
- Obtener el ASSISTANT_ID

### **5. Ejecutar en Desarrollo**
```bash
# Desarrollo con ngrok automático
npm run dev:local

# Solo desarrollo local
npm run dev

# Desarrollo con configuración de producción
npm run dev:cloud
```

### **6. Desplegar a Producción**
```bash
# Deploy automático con Cloud Build
npm run deploy

# Deploy directo a Cloud Run
npm run deploy:auto
```

---

## ⚙️ **Configuración**

### **Variables de Entorno Requeridas**

#### **Desarrollo Local (.env)**
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...
ASSISTANT_ID=asst_...

# WHAPI Configuration (WhatsApp Business API)
WHAPI_TOKEN=tu_token_whapi
WHAPI_API_URL=https://gate.whapi.cloud

# Beds24 Configuration
BEDS24_TOKEN=tu_token_beds24
BEDS24_API_URL=https://api.beds24.com

# Bot Configuration
WEBHOOK_URL=https://actual-bobcat-handy.ngrok-free.app/hook
ENVIRONMENT=local
```

#### **Producción (Google Secret Manager)**
```bash
# Las mismas variables se configuran en Google Secret Manager
# y se inyectan automáticamente en Cloud Run
```

### **Configuración del OpenAI Assistant**

El bot requiere un Assistant configurado con las siguientes funciones:

#### **Función: check_availability**
```json
{
  "name": "check_availability",
  "description": "Consulta disponibilidad en tiempo real desde Beds24",
  "parameters": {
    "type": "object",
    "properties": {
      "startDate": {
        "type": "string",
        "description": "Fecha de inicio en formato YYYY-MM-DD"
      },
      "endDate": {
        "type": "string", 
        "description": "Fecha de fin en formato YYYY-MM-DD"
      }
    },
    "required": ["startDate", "endDate"]
  }
}
```

#### **Función: create_booking**
```json
{
  "name": "create_booking",
  "description": "Crea una pre-reserva cuando el cliente confirma interés",
  "parameters": {
    "type": "object",
    "properties": {
      "room_id": {"type": "string"},
      "check_in": {"type": "string"},
      "check_out": {"type": "string"},
      "guest_name": {"type": "string"},
      "guests_count": {"type": "integer"}
    },
    "required": ["room_id", "check_in", "check_out", "guest_name", "guests_count"]
  }
}
```

---

## 📊 **Métricas y Monitoreo**

### **Endpoints de Monitoreo**
- **`/health`** - Estado del servicio y métricas básicas
- **`/metrics`** - Métricas detalladas de performance
- **`/`** - Información general del servicio

### **Logs Estructurados**
El sistema genera logs categorizados para facilitar el análisis:

```json
{
  "timestamp": "2025-07-12T03:20:01.808Z",
  "level": "INFO",
  "category": "WHATSAPP_SEND",
  "message": "Mensaje enviado exitosamente",
  "userId": "573003913251",
  "details": {
    "messageLength": 87,
    "environment": "cloud-run"
  }
}
```

### **Categorías de Logs Principales**
- **`MESSAGE_RECEIVED`** - Mensajes entrantes
- **`OPENAI_REQUEST`** - Solicitudes a OpenAI
- **`FUNCTION_CALLING`** - Llamadas a funciones externas
- **`WHATSAPP_SEND`** - Mensajes enviados
- **`THREAD_PERSIST`** - Gestión de conversaciones
- **`BEDS24_API`** - Consultas a Beds24

---

## 🧪 **Testing y Validación**

### **Scripts de Prueba Disponibles**
```bash
# Validar sistema de logging
node scripts/validate-logging-v2.js

# Probar integración con Beds24
node tests/beds24/test-beds24.js

# Validar escalamiento a humanos
node tests/escalation/test-minimal-escalation.js

# Probar sistema de etiquetas
node tests/test-labels-update.js
```

### **Casos de Prueba Principales**
1. **Consulta de Disponibilidad** - Verificar integración con Beds24
2. **Creación de Reserva** - Validar proceso completo de reserva
3. **Escalamiento a Humano** - Probar transferencia de casos complejos
4. **Manejo de Errores** - Verificar robustez del sistema
5. **Multi-Usuario** - Validar concurrencia y buffers

---

## 📈 **Performance y Optimización**

### **Métricas Actuales**
- **Tiempo de Respuesta**: <3 segundos promedio
- **Respuestas Instantáneas**: <1 segundo para patrones simples
- **Throughput**: 100+ mensajes por minuto
- **Uptime**: 99.9% en Cloud Run
- **Escalabilidad**: Auto-scaling configurado
- **Reducción de Costos**: 30-40% menos llamadas a OpenAI

### **Optimizaciones Implementadas**
- **Cache de Historial** - Evita fetches repetidos de conversaciones
- **Thread Reutilización** - Mantiene contexto entre mensajes
- **Rate Limiting** - Previene spam y sobrecarga
- **Message Buffering** - Agrupa mensajes para eficiencia
- **Sistema Híbrido** - Patrones simples y respuestas instantáneas
- **Inyección Condicional** - Contexto histórico optimizado
- **Cache Inteligente** - TTL configurable para optimización

---

## Optimización y Monitoreo Proactivo (Etapas 1-4)

El bot implementa un sistema robusto de optimización y monitoreo:

- **Fuzzy Parsing**: Detección de patrones y fechas con tolerancia a typos usando Levenshtein.
- **Dynamic Thresholds**: Umbrales dinámicos para inyección de contexto y patrones.
- **Token Cleanup**: Poda automática de threads con alto uso de tokens (>8000), migración de mensajes recientes y generación de resúmenes.
- **Métricas Prometheus**: Exposición de métricas clave (`fuzzyHits`, `raceErrors`, `tokenCleanups`, `highTokenThreads`) en `/metrics`.
- **Alertas Proactivas**: Alertas si hay exceso de fuzzy matches, race errors o threads con tokens altos.

### Variables de entorno relevantes
- `THREAD_TOKEN_THRESHOLD` (default: 8000): Límite de tokens por thread antes de poda.
- `HISTORIAL_SUMMARY_THRESHOLD` (default: 5000): Límite para activar resumen automático.
- `OPENAI_MODEL`: Modelo global para resúmenes.

### Consultar métricas
- Accede a `/metrics` para Prometheus.
- Logs detallados en `/logs` y consola para debugging avanzado.

---

Para detalles técnicos, ver:
- `docs/features/OPTIMIZACION_CLOUD_RUN.md` - Optimización y cleanup
- `docs/features/SISTEMA_HIBRIDO_INTELIGENTE.md` - Fuzzy parsing y thresholds
- `docs/architecture/LOCKING_AND_RECOVERY.md` - Sistema de locks y recuperación
- `docs/guides/TROUBLESHOOTING_AND_FAQ.md` - Guía de problemas comunes
- `docs/API_ENDPOINTS.md` - Inventario completo de endpoints

---

## 🔧 **Mantenimiento y Soporte**

### **Comandos de Mantenimiento**
```bash
# Ver logs en tiempo real
npm run logs

# Reiniciar servicio
npm run restart

# Verificar estado
curl https://tu-dominio.com/health

# Limpiar logs antiguos
npm run cleanup-logs
```

### **Monitoreo de Errores**
- **Logs de Error**: Categoría `ERROR` en Google Cloud Logging
- **Alertas Automáticas**: Configuradas para errores críticos
- **Health Checks**: Verificación automática cada 30 segundos

---

## 📚 **Documentación Adicional**

### **Guías Específicas**
- **[Configuración de OpenAI Assistant](docs/features/ASSISTANT_CONFIG.md)** - Configuración detallada
- **[Integración Beds24](docs/features/BEDS24_INTEGRATION_COMPLETE.md)** - Guía completa
- **[Sistema de Escalamiento](docs/features/ESCALATE_TO_HUMAN_SPEC.md)** - Especificación técnica
- **[Sistema de Logging](docs/logging/LOGGING_SYSTEM_COMPLETE.md)** - Arquitectura de logs

### **Documentación de Desarrollo**
- **[Guía de Migración](docs/development/MIGRATION_GUIDE.md)** - Proceso de migración
- **[Roadmap de Funcionalidades](docs/progress/ROADMAP.md)** - Plan de desarrollo
- **[Estado del Proyecto](docs/progress/ESTADO_FINAL_PROYECTO.md)** - Estado actual

---

## 🤝 **Contribución**

### **Proceso de Desarrollo**
1. Crear una rama para la nueva funcionalidad
2. Implementar cambios siguiendo las convenciones del proyecto
3. Ejecutar tests y validaciones
4. Crear Pull Request con descripción detallada
5. Revisión y merge

### **Convenciones del Código**
- **TypeScript** para todo el código nuevo
- **Logging estructurado** para todas las operaciones
- **Documentación** para nuevas funcionalidades
- **Tests** para validar cambios

---

## 📞 **Soporte y Contacto**

### **Canales de Soporte**
- **Issues de GitHub** - Para reportar bugs y solicitar funcionalidades
- **Documentación** - Guías detalladas en `/docs`
- **Logs de Producción** - Monitoreo en Google Cloud Console

### **Información del Proyecto**
- **Versión Actual**: 2.0.0
- **Última Actualización**: Julio 2025
- **Estado**: ✅ Producción Activa
- **Mantenimiento**: Activo

---

## 📄 **Licencia**

Este proyecto es propiedad de **TeAlquilamos** y está diseñado para uso interno. Para consultas sobre licenciamiento, contactar al equipo de desarrollo.

---

**🚀 Desarrollado con ❤️ por el equipo de TeAlquilamos**