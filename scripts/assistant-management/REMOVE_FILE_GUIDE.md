# 🗑️ Guía de Eliminación de Archivos RAG

## **📋 Descripción**

Esta guía explica cómo eliminar archivos del vector store del assistant de TeAlquilamos de forma segura y controlada.

## **🚀 Uso Básico**

### **1. Ver archivos disponibles**
```bash
# Ver archivos en el vector store
npm run assistant list-vector-files

# Ver archivos locales
npm run assistant list-files
```

### **2. Eliminar archivo específico**
```bash
# Eliminar archivo del vector store
npm run assistant remove-file "# 17_NUEVO_ARCHIVO.txt"
```

### **3. Verificar eliminación**
```bash
# Verificar que se eliminó
npm run assistant list-vector-files

# Ver estado completo
npm run assistant status
```

## **🔧 Proceso de Eliminación**

El comando `remove-file` realiza las siguientes acciones:

1. **Verificación**: Busca el archivo en la configuración local
2. **Confirmación**: Muestra información del archivo a eliminar
3. **Eliminación del Vector Store**: Remueve el archivo del vector store
4. **Eliminación de OpenAI**: Intenta eliminar el archivo de OpenAI (opcional)
5. **Actualización de Configuración**: Actualiza `assistant-config.json`

## **⚠️ Consideraciones Importantes**

### **Archivos Protegidos**
- 🚫 **`# 00_INSTRUCCIONES_DEL_ASISTENTE.txt`** - NO SE PUEDE ELIMINAR
  - Contiene las instrucciones principales del assistant
  - Para modificarlo: `npm run assistant prompt`
  - Para eliminarlo del vector store, primero actualiza el assistant

### **Antes de Eliminar**
- ✅ Verifica que el archivo existe: `npm run assistant list-vector-files`
- ✅ Asegúrate de que no es crítico para el funcionamiento del bot
- ✅ Haz backup de `assistant-config.json` si es necesario

### **Después de Eliminar**
- ✅ Verifica que se eliminó correctamente
- ✅ Prueba el bot para asegurar que funciona bien
- ✅ Si hay problemas, puedes volver a agregar el archivo

## **🔄 Recuperación**

Si eliminas un archivo por error:

```bash
# 1. Verificar que el archivo local existe
npm run assistant list-files

# 2. Volver a agregar el archivo
npm run assistant add-file "# ARCHIVO_ELIMINADO.txt"

# 3. Verificar que se agregó
npm run assistant list-vector-files
```

## **🧪 Script de Prueba**

Para verificar el estado actual y ver qué archivos están disponibles:

```bash
node scripts/assistant-management/test-remove-file.js
```

Este script muestra:
- Estado del assistant
- Archivos disponibles para eliminar
- Comandos útiles
- Ejemplos de uso

## **📊 Comandos Relacionados**

| Comando | Descripción |
|---------|-------------|
| `list-vector-files` | Ver archivos en el vector store |
| `list-files` | Ver archivos locales |
| `status` | Estado completo del assistant |
| `remove-file` | Eliminar archivo específico |

## **💡 Casos de Uso Comunes**

### **Eliminar archivo obsoleto**
```bash
# 1. Ver archivos
npm run assistant list-vector-files

# 2. Eliminar archivo obsoleto
npm run assistant remove-file "# 15_INFO_ANTIGUA.txt"

# 3. Verificar
npm run assistant list-vector-files
```

### **Limpiar archivos de prueba**
```bash
# Eliminar archivos de prueba
npm run assistant remove-file "# TEST_ARCHIVO.txt"
npm run assistant remove-file "# EXPERIMENTO.txt"
```

### **Actualizar información**
```bash
# 1. Eliminar versión antigua
npm run assistant remove-file "# 05_TARIFAS_VIEJO.txt"

# 2. Agregar versión nueva
npm run assistant add-file "# 05_TARIFAS_NUEVO.txt"
```

---

**🎯 RECOMENDACIÓN:** Siempre verifica antes y después de eliminar archivos para evitar problemas. 