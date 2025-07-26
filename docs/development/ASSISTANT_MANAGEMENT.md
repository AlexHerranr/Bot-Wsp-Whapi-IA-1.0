# 🤖 Sistema de Gestión de Assistant - TeAlquilamos

## **📋 Índice**
1. [Introducción](#introducción)
2. [Instalación y Configuración](#instalación-y-configuración)
3. [Comandos Básicos](#comandos-básicos)
4. [Comandos Avanzados](#comandos-avanzados)
5. [Casos de Uso](#casos-de-uso)
6. [Solución de Problemas](#solución-de-problemas)
7. [Mejores Prácticas](#mejores-prácticas)

---

## **🎯 Introducción**

Este sistema permite gestionar el assistant de OpenAI de TeAlquilamos de forma eficiente y profesional. Incluye herramientas para actualizar el prompt principal, agregar archivos RAG, modificar funciones y más.

### **🏗️ Arquitectura del Sistema**

```
scripts/
├── assistant-management/          # 🎯 CARPETA PRINCIPAL
│   ├── assistant-cli.js          # CLI unificado
│   ├── update-prompt.js          # Actualizar prompt
│   ├── add-rag-file.js           # Agregar archivos RAG
│   ├── update-functions.js       # Actualizar funciones
│   └── update-assistant-smart.js # Actualización inteligente
├── create-new-assistant-v2.js    # Crear assistant desde cero
└── development/                  # Scripts de desarrollo

RAG OPEN AI ASSISTANCE/           # Archivos de conocimiento
├── # 00_INSTRUCCIONES_DEL_ASISTENTE.txt     # Prompt principal
├── # 01_MAPA_NAVEGACION.txt      # Archivos RAG
└── ... (17 archivos total)

docs/
└── ASSISTANT_MANAGEMENT.md       # Esta documentación
```

---

## **⚙️ Instalación y Configuración**

### **1. Verificar Configuración**
```bash
# Verificar que las variables estén configuradas
node scripts/assistant-management/assistant-cli.js status
```

### **2. Variables de Entorno Requeridas**
```env
OPENAI_API_KEY=sk-xxxxxx
OPENAI_ASSISTANT_ID=asst_EXAMPLE_ID_KkDuq2r9cL5EZSZa95sXkpVR
```

### **3. Estructura de Archivos**
- **`.env`**: Variables de configuración
- **`assistant-config.json`**: Configuración del assistant (se genera automáticamente)
- **`RAG OPEN AI ASSISTANCE/`**: Archivos de conocimiento

---

## **🔧 Comandos Básicos**

### **CLI Unificado**
```bash
# Navegar a la carpeta de gestión
cd scripts/assistant-management

# Ver ayuda
node assistant-cli.js help

# Ver estado actual
node assistant-cli.js status
```

### **1. Actualizar Prompt Principal**
```bash
node assistant-cli.js prompt
```
**¿Cuándo usar?** Cuando modificas `# 00_INSTRUCCIONES_DEL_ASISTENTE.txt`

**Qué hace:**
- Lee el prompt actualizado
- Actualiza las `instructions` del assistant
- No afecta el vector store

### **2. Agregar Archivo RAG**
```bash
node assistant-cli.js add-file "# 17_NUEVO_ARCHIVO.txt"
```
**¿Cuándo usar?** Cuando agregas un nuevo archivo de conocimiento

**Qué hace:**
- Sube el archivo al Files API
- Lo agrega al vector store
- No afecta otros archivos

### **3. Actualizar Funciones**
```bash
node assistant-cli.js functions
```
**¿Cuándo usar?** Cuando modificas `check_availability` o `escalate_to_human`

**Qué hace:**
- Actualiza las definiciones de funciones
- Mantiene prompt y vector store intactos

### **4. Actualización Inteligente**
```bash
node assistant-cli.js update-all
```
**¿Cuándo usar?** Cuando tienes múltiples cambios simultáneos

**Qué hace:**
- Detecta cambios automáticamente
- Actualiza solo lo que cambió
- Guarda configuración actualizada

---

## **🚀 Comandos Avanzados**

### **1. Crear Assistant Nuevo**
```bash
node assistant-cli.js create
```
**⚠️ ADVERTENCIA:** Esto recrea todo desde cero. Solo usar en casos extremos.

### **2. Ver Estado Detallado**
```bash
node assistant-cli.js status
```
**Salida:**
```
📊 ESTADO DEL ASSISTANT:

🤖 Assistant ID: asst_EXAMPLE_ID_KkDuq2r9cL5EZSZa95sXkpVR
🗃️ Vector Store ID: vs_6865eff81ccc8191bf41f50ba9e497c5
📁 Archivos RAG: 17
🕒 Última actualización: 2025-07-03T00:00:00.000Z
📂 Archivos RAG locales: 17
```

### **3. Listar Archivos RAG**
```bash
node assistant-cli.js list-files
```
**Salida:**
```
📁 ARCHIVOS RAG LOCALES:

01. # 00_INSTRUCCIONES_DEL_ASISTENTE.txt (6.0 KB)
02. # 01_MAPA_NAVEGACION.txt (22.0 KB)
03. # 02_TARIFAS_TEMPORADAS.txt (13.0 KB)
...
17. # 16_GESTION_DISPONIBILIDAD.txt (8.5 KB)
```

---

## **📚 Casos de Uso**

### **Caso 1: Modificar el Prompt Principal**
```bash
# 1. Editar el archivo
# RAG OPEN AI ASSISTANCE/# 00_INSTRUCCIONES_DEL_ASISTENTE.txt

# 2. Actualizar
node assistant-cli.js prompt
```

### **Caso 2: Agregar Nueva Información**
```bash
# 1. Crear nuevo archivo
# RAG OPEN AI ASSISTANCE/# 17_NUEVA_INFORMACION.txt

# 2. Agregar al vector store
node assistant-cli.js add-file "# 17_NUEVA_INFORMACION.txt"
```

### **Caso 3: Modificar Archivo Existente**
```bash
# 1. Editar archivo existente
# RAG OPEN AI ASSISTANCE/# 05_DATOS_CORPORATIVOS_CONTACTO.txt

# 2. Actualización inteligente detectará el cambio
node assistant-cli.js update-all
```

### **Caso 4: Actualizar Funciones**
```bash
# 1. Modificar script update-functions.js si es necesario

# 2. Actualizar funciones
node assistant-cli.js functions
```

### **Caso 5: Verificar Estado Antes de Cambios**
```bash
# 1. Ver estado actual
node assistant-cli.js status

# 2. Listar archivos
node assistant-cli.js list-files

# 3. Hacer cambios necesarios
# 4. Actualizar según corresponda
```

---

## **⚠️ Solución de Problemas**

### **Error: "OPENAI_ASSISTANT_ID no encontrado"**
```bash
# Verificar .env
cat .env | grep OPENAI_ASSISTANT_ID

# Si no existe, agregar:
echo "OPENAI_ASSISTANT_ID=asst_EXAMPLE_ID_KkDuq2r9cL5EZSZa95sXkpVR" >> .env
```

### **Error: "No se encontró assistant-config.json"**
```bash
# Crear assistant desde cero
node assistant-cli.js create
```

### **Error: "Rate limit exceeded"**
```bash
# Esperar 1 minuto y reintentar
# O usar comandos específicos en lugar de update-all
```

### **Error: "Archivo no encontrado"**
```bash
# Verificar que el archivo existe
ls "RAG OPEN AI ASSISTANCE/# NOMBRE_ARCHIVO.txt"

# Verificar sintaxis del comando
node assistant-cli.js add-file "# NOMBRE_ARCHIVO.txt"
```

### **Error: "Cannot read properties of undefined"**
```bash
# Verificar que las dependencias estén instaladas
npm install

# Verificar que el .env esté configurado
node assistant-cli.js status
```

---

## **💡 Mejores Prácticas**

### **1. Usar Comandos Específicos**
```bash
# ✅ BUENO: Comando específico
node assistant-cli.js prompt

# ❌ EVITAR: Actualización completa para cambios simples
node assistant-cli.js update-all
```

### **2. Verificar Antes de Cambiar**
```bash
# Siempre verificar estado antes de hacer cambios
node assistant-cli.js status
node assistant-cli.js list-files
```

### **3. Mantener Backup**
```bash
# Hacer backup de configuración antes de cambios grandes
cp assistant-config.json assistant-config-backup.json
```

### **4. Probar Después de Cambios**
```bash
# 1. Hacer cambios
# 2. Actualizar assistant
# 3. Reiniciar bot: npm run dev
# 4. Probar con mensaje de WhatsApp
```

### **5. Nomenclatura de Archivos**
```bash
# ✅ BUENO: Seguir convención
# 17_NUEVO_ARCHIVO.txt

# ❌ EVITAR: Nombres sin numeración
NUEVO_ARCHIVO.txt
```

---

## **📊 Comparación de Comandos**

| Comando | Tiempo | Costo | Cuándo Usar |
|---------|--------|-------|-------------|
| `prompt` | ⚡ 2s | 💰 Gratis | Solo prompt |
| `add-file` | ⚡ 5s | 💰 $0.01 | Archivo nuevo |
| `functions` | ⚡ 2s | 💰 Gratis | Funciones |
| `update-all` | 🐌 30s | 💰 $0.05 | Múltiples cambios |
| `create` | 🐌 2min | 💰 $0.20 | Problemas graves |

---

## **🔗 Enlaces Útiles**

- **Documentación OpenAI**: https://platform.openai.com/docs
- **API Reference**: https://platform.openai.com/docs/api-reference
- **Vector Stores**: https://platform.openai.com/docs/guides/vector-stores

---

## **📞 Soporte**

### **Antes de Pedir Ayuda:**
1. ✅ Verificar `.env` está configurado
2. ✅ Ejecutar `node assistant-cli.js status`
3. ✅ Revisar logs de error
4. ✅ Probar con comando `help`

### **Información Necesaria:**
- Error exacto
- Comando ejecutado
- Salida de `status`
- Versión de Node.js

---

**🎯 RECOMENDACIÓN FINAL:** Usa siempre el comando más específico para tu caso. El CLI unificado hace que todo sea más fácil y profesional. 