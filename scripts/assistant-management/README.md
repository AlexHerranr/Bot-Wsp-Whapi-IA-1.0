# 🤖 Assistant Management - TeAlquilamos

## **📋 Descripción**

Sistema profesional para gestionar el assistant de OpenAI de TeAlquilamos. Incluye herramientas para actualizar prompts, archivos RAG, funciones y más.

## **🚀 Uso Rápido**

### **Desde el directorio raíz:**
```bash
# Ver ayuda
npm run assistant help

# Ver estado
npm run assistant status

# Actualizar prompt
npm run assistant prompt

# Agregar archivo RAG
npm run assistant add-file "# 17_NUEVO_ARCHIVO.txt"

# Eliminar archivo RAG
npm run assistant remove-file "# 17_NUEVO_ARCHIVO.txt"

# Actualización completa
npm run assistant update-all
```

### **Desde esta carpeta:**
```bash
# Ver ayuda
node assistant-cli.js help

# Ver estado
node assistant-cli.js status

# Listar archivos
node assistant-cli.js list-files

# Listar archivos en vector store
node assistant-cli.js list-vector-files
```

## **📁 Estructura**

```
assistant-management/
├── assistant-cli.js          # 🎯 CLI unificado principal
├── update-prompt.js          # Actualizar prompt principal
├── add-rag-file.js           # Agregar archivos RAG
├── remove-rag-file.js        # Eliminar archivos RAG
├── update-functions.js       # Actualizar funciones
├── update-assistant-smart.js # Actualización inteligente
├── test-remove-file.js       # Script de prueba
└── README.md                 # Esta documentación
```

## **🔧 Comandos Disponibles**

| Comando | Descripción | Uso |
|---------|-------------|-----|
| `help` | Mostrar ayuda | `npm run assistant help` |
| `status` | Estado del assistant | `npm run assistant status` |
| `list-files` | Listar archivos RAG locales | `npm run assistant list-files` |
| `list-vector-files` | Listar archivos en vector store | `npm run assistant list-vector-files` |
| `prompt` | Actualizar prompt | `npm run assistant prompt` |
| `functions` | Actualizar funciones | `npm run assistant functions` |
| `add-file` | Agregar archivo RAG | `npm run assistant add-file "# 17_NUEVO.txt"` |
| `remove-file` | Eliminar archivo RAG | `npm run assistant remove-file "# 17_NUEVO.txt"` |
| `update-all` | Actualización completa | `npm run assistant update-all` |
| `create` | Crear assistant nuevo | `npm run assistant create` |
| `docs` | Ver documentación | `npm run assistant docs` |
| `cleanup-threads` | Eliminar todos los threads/conversaciones | `npm run assistant cleanup-threads` |
| `cleanup-threads-local` | Limpiar solo los threadId locales (otros datos conservados) | `npm run assistant cleanup-threads-local` |

## **💡 Casos de Uso Comunes**

### **1. Modificar el Prompt Principal**
```bash
# 1. Editar: RAG OPEN AI ASSISTANCE/# 00_INSTRUCCIONES_DEL_ASISTENTE.txt
# 2. Actualizar:
npm run assistant prompt
```

### **2. Agregar Nueva Información**
```bash
# 1. Crear: RAG OPEN AI ASSISTANCE/# 17_NUEVA_INFO.txt
# 2. Agregar:
npm run assistant add-file "# 17_NUEVA_INFO.txt"
```

### **3. Eliminar Información**
```bash
# 1. Ver archivos en el vector store:
npm run assistant list-vector-files

# 2. Eliminar archivo específico:
npm run assistant remove-file "# 17_NUEVA_INFO.txt"

# ⚠️ NOTA: # 00_INSTRUCCIONES_DEL_ASISTENTE.txt está protegido
# Para modificarlo usa: npm run assistant prompt
```

### **4. Verificar Estado**
```bash
# Ver estado completo
npm run assistant status

# Listar archivos locales
npm run assistant list-files

# Listar archivos en vector store
npm run assistant list-vector-files

# Probar funcionalidad de eliminación
node scripts/assistant-management/test-remove-file.js
```

### **5. Actualización Inteligente**
```bash
# Detecta cambios automáticamente
npm run assistant update-all
```

### **6. Limpiar todos los threads/conversaciones**
```bash
npm run assistant cleanup-threads
```
Esto eliminará todas las conversaciones (threads) asociadas al assistant en OpenAI.

### **7. Limpiar solo los threadId locales (conservar datos de contacto)**
```bash
npm run assistant cleanup-threads-local
```
Esto dejará todos los threadId en null, pero conservará chatId, userName y demás datos de cada usuario.

## **⚠️ Notas Importantes**

### **Tipos de Archivos**
- **`# 00_INSTRUCCIONES_DEL_ASISTENTE.txt`**: Instrucciones principales del assistant (PROTEGIDO)
  - Se usa directamente como prompt del assistant
  - Para modificarlo: `npm run assistant prompt`
  - NO se puede eliminar con `remove-file`

- **Otros archivos RAG**: Información de referencia para el assistant
  - Se pueden agregar/eliminar libremente
  - Se consultan según necesidad

### **Buenas Prácticas**
- **Siempre verifica el estado** antes de hacer cambios: `npm run assistant status`
- **Usa comandos específicos** en lugar de `update-all` para cambios simples
- **Mantén backup** de `assistant-config.json` antes de cambios grandes
- **Prueba después de cambios** reiniciando el bot: `npm run dev`

## **🔗 Enlaces**

- **Documentación completa**: `docs/ASSISTANT_MANAGEMENT.md`
- **Archivos RAG**: `RAG OPEN AI ASSISTANCE/`
- **Configuración**: `assistant-config.json`

---

**🎯 RECOMENDACIÓN:** Usa siempre `npm run assistant` desde el directorio raíz para mejor experiencia. 