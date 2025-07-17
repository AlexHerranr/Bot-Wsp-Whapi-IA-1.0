# 🗺️ **GUÍA DE NAVEGACIÓN - TeAlquilamos Bot**

> **Mapa completo para navegar y entender el proyecto en 5inutos**

## 🎯 **RUTA DE NAVEGACIÓN RÁPIDA (5 MINUTOS)**

### **1 PRIMER CONTACTO (30segundos)**
- **📄 README.md** - Visión general del proyecto
- **📄 package.json** - Tecnologías y dependencias
- **📄 src/app-unified.ts** - Punto de entrada principal

### **2RQUITECTURA (1nuto)**
- **📁 src/** - Código fuente organizado por capas
- **📁 docs/ARCHITECTURE.md** - Diseño del sistema
- **📁 docs/API_ENDPOINTS.md** - Endpoints disponibles

### **3 FUNCIONALIDADES (2 minutos)**
- **📁 docs/features/** - Características específicas
- **📁 src/functions/** - Funciones de OpenAI
- **📁 src/services/** - Servicios de negocio

### **4. CONFIGURACIÓN (1o)**
- **📁 config/** - Configuraciones del sistema
- **📄 env.example** - Variables de entorno
- **📁 docs/deployment/** - Guías de despliegue

### **5. DESARROLLO (30segundos)**
- **📁 docs/development/** - Guías de desarrollo
- **📁 tests/** - Tests y validaciones
- **📁 scripts/** - Herramientas de automatización

---

## 🏗️ **ARQUITECTURA DEL SISTEMA**

### **CAPA DE PRESENTACIÓN**
```
src/
├── app-unified.ts              # 🚀 PUNTO DE ENTRADA
├── routes/                     # Endpoints de la API
└── providers/                  # Proveedores externos
```

### **CAPA DE LÓGICA DE NEGOCIO**
```
src/
├── handlers/                   # Manejadores de eventos
├── services/                   # Servicios de negocio
└── functions/                  # Funciones de OpenAI
```

### **CAPA DE DATOS**
```
src/
├── utils/persistence/          # Persistencia de datos
├── utils/context/              # Gestión de contexto
└── config/                     # Configuraciones
```

### **CAPA DE UTILIDADES**
```
src/
├── utils/logging/              # Sistema de logs
├── utils/monitoring/           # Monitoreo y métricas
└── utils/whapi/                # Utilidades de WhatsApp
```

---

## 📚 **DOCUMENTACIÓN JERÁRQUICA**

### **NIVEL1 VISIÓN GENERAL**
- **README.md** - Propósito y características
- **QUICK_START.md** - Inicio rápido
- **PROJECT_STRUCTURE.md** - Estructura completa

### **NIVEL 2: ARQUITECTURA**
- **docs/ARCHITECTURE.md** - Diseño del sistema
- **docs/API_ENDPOINTS.md** - API reference
- **docs/SECURITY_AND_DEPLOYMENT.md** - Seguridad

### **NIVEL 3FUNCIONALIDADES**
- **docs/features/** - Características específicas
- **docs/integrations/** - Integraciones externas
- **docs/functions/** - Funciones de OpenAI

### **NIVEL4 DESARROLLO**
- **docs/development/** - Guías de desarrollo
- **docs/guides/** - Tutoriales y troubleshooting
- **docs/logging/** - Sistema de logging

### **NIVEL 5: MANTENIMIENTO**
- **docs/progress/** - Estado del proyecto
- **docs/legacy/** - Documentación histórica
- **docs/archive/** - Archivos obsoletos

---

## 🔍 **BÚSQUEDA RÁPIDA POR FUNCIONALIDAD**

### **🤖 IA y OpenAI**
- **src/handlers/openai_handler.ts** - Manejador principal
- **src/functions/** - Funciones de OpenAI
- **docs/features/OPENAI_CONTEXT_MESSAGES.md** - Contexto

### **💬 WhatsApp**
- **src/providers/whapi.provider.ts** - Proveedor WhatsApp
- **src/utils/whapi/** - Utilidades WhatsApp
- **docs/integrations/WHAPI_COMPLETE_API_REFERENCE.md** - API

### **🏨 Beds24**
- **src/services/beds24** - Servicio Beds24
- **src/functions/availability/** - Consultas disponibilidad
- **docs/features/BEDS24_INTEGRATION_COMPLETE.md** - Integración

### **📊 Monitoreo**
- **src/utils/monitoring/dashboard.ts** - Dashboard
- **src/routes/metrics.ts** - Endpoints métricas
- **docs/DASHBOARD_GUIDE.md** - Guía dashboard

### **🔧 Configuración**
- **src/config/** - Configuraciones
- **config/** - Archivos de configuración
- **docs/deployment/** - Guías despliegue

---

## 🚀 **RUTAS DE ACCESO RÁPIDO**

### **PARA DESARROLLADORES NUEVOS**1 README.md → QUICK_START.md → docs/development/local-setup.md
2src/app-unified.ts → docs/ARCHITECTURE.md → docs/API_ENDPOINTS.md

### **PARA DEBUGGING**
1 docs/guides/TROUBLESHOOTING_AND_FAQ.md
2. src/utils/logging/ → logs/
3 docs/logging/LOGGING_SYSTEM_COMPLETE.md

### **PARA DESPLIEGUE**
1. docs/deployment/RAILWAY_DEPLOYMENT_GUIDE.md2 docs/SECURITY_AND_DEPLOYMENT.md
3. scripts/windows/ → scripts/assistant-management/

### **PARA MANTENIMIENTO**1 docs/progress/ESTADO_FINAL_PROYECTO.md
2. docs/development/ → docs/features/
3. tests/ → scripts/

---

## 📋 **CHECKLIST DE NAVEGACIÓN**

### **✅ COMPRENSIÓN BÁSICA**
- README.md completo
- [ ] Revisar package.json y dependencias
- [ ] Entender estructura de carpetas
- [ ] Identificar punto de entrada (app-unified.ts)

### **✅ ARQUITECTURA**
- Revisar docs/ARCHITECTURE.md
-  Entender flujo de datos
- [ ] Identificar componentes principales
-apear dependencias entre módulos

### **✅ FUNCIONALIDADES**
- orar docs/features/
- [ ] Entender funciones de OpenAI
-isar integraciones externas
- [ ] Comprender sistema de contexto

### **✅ DESARROLLO**
- [ ] Configurar entorno local
- Ejecutar tests básicos
- [ ] Revisar scripts disponibles
- [ ] Entender sistema de logging

### **✅ PRODUCCIÓN**
-] Revisar guías de despliegue
- [ ] Entender variables de entorno
- omprender monitoreo
- [ ] Conocer troubleshooting

---

## 🎯 **PRINCIPIOS DE ORGANIZACIÓN**

### **1JERARQUÍA CLARA**
- Documentación organizada por niveles de detalle
- Navegación intuitiva de general a específico
- Separación clara entre documentación y código

### **2. CONSISTENCIA**
- Nomenclatura uniforme en archivos y carpetas
- Estructura similar en todos los módulos
- Patrones de documentación consistentes

### **3. ACCESIBILIDAD**
- Información crítica visible desde la raíz
- Enlaces cruzados entre documentos relacionados
- Búsqueda rápida por funcionalidad

### **4. MANTENIBILIDAD**
- Documentación actualizada automáticamente
- Separación entre estado actual e histórico
- Archivos obsoletos claramente marcados

---

*Esta guía debe ser el primer documento que cualquier IA o desarrollador lea para entender el proyecto completo.* 