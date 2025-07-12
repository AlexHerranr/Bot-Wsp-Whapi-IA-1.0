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
```

### **3. Configurar Variables de Entorno**
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Configurar variables (ver sección de configuración)
```

### **4. Configurar OpenAI Assistant**
- Crear un nuevo Assistant en OpenAI
- Configurar las funciones de Function Calling (ver documentación)
- Obtener el ASSISTANT_ID

### **5. Ejecutar en Desarrollo**
```bash
npm run dev
```

### **6. Desplegar a Producción**
```bash
npm run deploy
```

---

## ⚙️ **Configuración**

### **Variables de Entorno Requeridas**

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

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=tu-proyecto-id
GOOGLE_CLOUD_REGION=northamerica-northeast1

# Bot Configuration
WEBHOOK_URL=https://tu-dominio.com/hook
ENVIRONMENT=production
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
- **Throughput**: 100+ mensajes por minuto
- **Uptime**: 99.9% en Cloud Run
- **Escalabilidad**: Auto-scaling configurado

### **Optimizaciones Implementadas**
- **Cache de Historial** - Evita fetches repetidos de conversaciones
- **Thread Reutilización** - Mantiene contexto entre mensajes
- **Rate Limiting** - Previene spam y sobrecarga
- **Message Buffering** - Agrupa mensajes para eficiencia

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