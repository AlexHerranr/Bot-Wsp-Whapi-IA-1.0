# 🤖 Bot de WhatsApp con IA - Sistema Optimizado

*Bot inteligente para gestión de reservas hoteleras con OpenAI y WhatsApp Business API*

---

## 🚀 Características Principales

### **🤖 IA Conversacional Avanzada**
- **OpenAI GPT-4** para respuestas inteligentes y contextuales
- **Sistema de inyección de historial optimizado** (Julio 2025)
- **Gestión automática de threads** para mantener contexto
- **Funciones especializadas** para disponibilidad y escalamiento

### **📱 Integración WhatsApp Business**
- **API WhatsApp Business** para comunicación directa
- **Gestión de mensajes** en tiempo real
- **Sistema de etiquetas** para categorización de clientes
- **Historial de conversaciones** inteligente

### **🏨 Gestión Hotelera Especializada**
- **Integración Beds24** para disponibilidad en tiempo real
- **Verificación automática** de apartamentos disponibles
- **Sistema de escalamiento** a agentes humanos
- **Gestión de reservas** y consultas

### **⚡ Performance Optimizada**
- **Sistema de cache inteligente** para reducir latencia
- **Compresión automática** de historiales largos
- **Inyección selectiva** de contexto (solo cuando necesario)
- **Cleanup automático** para prevenir memory leaks

---

## 🆕 Nuevas Mejoras - Julio 2025

### **🎯 Sistema de Inyección de Historial Optimizado**
- ✅ **Inyección selectiva**: Solo inyecta contexto cuando es necesario
- ✅ **Compresión automática**: Reduce tokens para historiales largos
- ✅ **Cache inteligente**: Evita duplicados y optimiza fetches
- ✅ **Logging detallado**: Facilita monitoreo y depuración
- ✅ **30-50% reducción de tokens** por conversación
- ✅ **20-40% mejora en latencia** de respuestas

### **🔧 Funciones de OpenAI Disponibles**
- `check_availability`: Verificación de disponibilidad
- `escalate_to_human`: Escalamiento a agentes humanos
- `inject_history`: **NUEVA** - Inyección inteligente de historial

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, TypeScript
- **IA**: OpenAI GPT-4, Assistants API
- **WhatsApp**: WhatsApp Business API (Whapi)
- **Alojamiento**: Google Cloud Run
- **Base de Datos**: Beds24 API
- **Logging**: Sistema personalizado con niveles configurables

---

## 📦 Instalación y Configuración

### **Prerrequisitos**
- Node.js 18+
- Cuenta de OpenAI con API key
- Cuenta de WhatsApp Business API
- Cuenta de Beds24 (opcional)

### **Instalación**
```bash
# Clonar repositorio
git clone <repository-url>
cd Bot-Wsp-Whapi-IA

# Instalar dependencias
npm install

# Configurar variables de entorno
cp env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build
```

### **Variables de Entorno Requeridas**
```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_ASSISTANT_ID=your_assistant_id

# WhatsApp Business API
WHAPI_API_KEY=your_whapi_key
WHAPI_WEBHOOK_SECRET=your_webhook_secret

# Beds24 (opcional)
BEDS24_API_KEY=your_beds24_key
BEDS24_AUTHENTICATION_TOKEN=your_auth_token
```

---

## 🚀 Despliegue

### **Google Cloud Run**
```bash
# Construir imagen
docker build -t bot-whatsapp .

# Desplegar
gcloud run deploy bot-whatsapp \
  --image bot-whatsapp \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### **Variables de Entorno en Cloud Run**
Configurar todas las variables de entorno necesarias en la consola de Google Cloud Run.

---

## 📊 Monitoreo y Logs

### **Logs Clave para Monitorear**
```typescript
// Sistema de inyección de historial
'HISTORY_INJECTION_COMPLETED' // Inyección exitosa
'HISTORY_INJECTION_SKIP' // Inyección saltada
'HISTORY_COMPRESSED' // Historial comprimido

// Sistema de cache
'HISTORY_CACHE_HIT' // Cache hit
'CACHE_CLEANUP' // Cleanup ejecutado

// Funciones de OpenAI
'FUNCTION_CALLED' // Función ejecutada
'FUNCTION_SUCCESS' // Función exitosa
```

### **Métricas de Performance**
- **Tokens utilizados** por conversación
- **Latencia de respuesta** promedio
- **Tasa de éxito** de funciones
- **Uso de cache** y eficiencia

---

## 🧪 Pruebas

### **Scripts de Prueba Disponibles**
```bash
# Pruebas del sistema de inyección de historial
node scripts/test-history-injection-simple.js

# Pruebas de funciones de OpenAI
node scripts/test-function-registry.js

# Pruebas de integración Beds24
node tests/beds24/test-beds24.js
```

---

## 📚 Documentación

### **Documentación Técnica**
- [Arquitectura del Sistema](docs/architecture/)
- [API Endpoints](docs/API_ENDPOINTS.md)
- [Configuración de Funciones](docs/features/FUNCTION_INVENTORY.md)
- [Optimizaciones de Cloud Run](docs/features/OPTIMIZACION_CLOUD_RUN.md)

### **Guías de Desarrollo**
- [Configuración Local](docs/development/local-setup.md)
- [Guía de Despliegue](docs/deployment/DEPLOYMENT_GUIDE.md)
- [Troubleshooting](docs/guides/TROUBLESHOOTING_AND_FAQ.md)

### **Actualizaciones Recientes**
- [Actualización Julio 2025](docs/progress/ACTUALIZACION_JULIO_2025.md)
- [Mejoras de Inyección de Historial](docs/features/HISTORY_INJECTION_IMPROVEMENTS.md)

---

## 🔧 Configuración de Funciones de OpenAI

### **Configuración Manual**
Las funciones deben ser agregadas manualmente en la interfaz de OpenAI:

1. Ir al asistente en OpenAI
2. Sección "Tools"
3. Agregar función con la configuración JSON correspondiente
4. Guardar cambios

### **Funciones Disponibles**
- `check_availability`: Verificación de disponibilidad
- `escalate_to_human`: Escalamiento a agentes humanos
- `inject_history`: Inyección inteligente de historial

---

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama para feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

---

## 🆘 Soporte

Para soporte técnico o preguntas:
- Revisar la [documentación](docs/)
- Consultar [Troubleshooting](docs/guides/TROUBLESHOOTING_AND_FAQ.md)
- Abrir un issue en GitHub

---

## 🎯 Estado del Proyecto

- ✅ **Producción Activa**: Bot funcionando en Cloud Run
- ✅ **Sistema Optimizado**: Inyección de historial mejorada (Julio 2025)
- ✅ **Funciones Implementadas**: Disponibilidad, escalamiento, historial
- 🔄 **Desarrollo Continuo**: Mejoras y optimizaciones en curso

**Última actualización**: Julio 2025 - Sistema de inyección de historial optimizado