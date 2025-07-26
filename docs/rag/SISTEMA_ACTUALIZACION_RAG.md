# 🔄 Sistema de Actualización RAG - TeAlquilamos Assistant

## **📋 Resumen del Sistema**

Este sistema permite actualizar el assistant de OpenAI de forma inteligente y eficiente, sin necesidad de recrear todo desde cero.

## **🚀 Scripts Disponibles**

### **1. Actualización Rápida del Prompt Principal**
```bash
npm run update-prompt
```
**¿Cuándo usar?** Cuando solo modificas el archivo `# 00_INSTRUCCIONES_DEL_ASISTENTE.txt`

**Qué hace:**
- Lee el prompt principal actualizado
- Actualiza las `instructions` del assistant
- No toca el vector store

### **2. Agregar Archivo RAG Individual**
```bash
npm run add-rag-file "nombre_archivo.txt"
```
**Ejemplo:**
```bash
npm run add-rag-file "# 17_NUEVO_ARCHIVO.txt"
```

**¿Cuándo usar?** Cuando agregas un nuevo archivo RAG

**Qué hace:**
- Sube el archivo al Files API
- Lo agrega al vector store existente
- No afecta otros archivos

### **3. Actualizar Funciones del Assistant**
```bash
npm run update-functions
```
**¿Cuándo usar?** Cuando modificas las funciones `check_availability` o `escalate_to_human`

**Qué hace:**
- Actualiza las definiciones de funciones
- Mantiene el prompt y vector store intactos

### **4. Actualización Inteligente Completa**
```bash
npm run update-all
```
**¿Cuándo usar?** Cuando modificas múltiples archivos o quieres detectar cambios automáticamente

**Qué hace:**
- Detecta cambios en prompt principal
- Detecta archivos nuevos/modificados
- Actualiza solo lo que cambió
- Guarda configuración actualizada

### **5. Crear Assistant Nuevo (Desde Cero)**
```bash
npm run create-assistant
```
**¿Cuándo usar?** Solo cuando quieres empezar completamente de nuevo

## **📊 Comparación de Opciones**

| Escenario | Script Recomendado | Tiempo | Costo |
|-----------|-------------------|--------|-------|
| Solo prompt cambió | `update-prompt` | ⚡ Rápido | 💰 Mínimo |
| Nuevo archivo RAG | `add-rag-file` | ⚡ Rápido | 💰 Mínimo |
| Funciones cambiaron | `update-functions` | ⚡ Rápido | 💰 Mínimo |
| Múltiples cambios | `update-all` | 🐌 Medio | 💰 Medio |
| Problemas graves | `create-assistant` | 🐌 Lento | 💰 Alto |

## **🔧 Casos de Uso Específicos**

### **Caso 1: Modificar el Prompt Principal**
```bash
# 1. Editar el archivo
# RAG OPEN AI ASSISTANCE/# 00_INSTRUCCIONES_DEL_ASISTENTE.txt

# 2. Actualizar
npm run update-prompt
```

### **Caso 2: Agregar Nueva Información**
```bash
# 1. Crear nuevo archivo
# RAG OPEN AI ASSISTANCE/# 17_NUEVA_INFORMACION.txt

# 2. Agregar al vector store
npm run add-rag-file "# 17_NUEVA_INFORMACION.txt"
```

### **Caso 3: Modificar Archivo Existente**
```bash
# 1. Editar archivo existente
# RAG OPEN AI ASSISTANCE/# 05_DATOS_CORPORATIVOS_CONTACTO.txt

# 2. Actualización inteligente detectará el cambio
npm run update-all
```

### **Caso 4: Actualizar Funciones**
```bash
# 1. Modificar script update-functions.js si es necesario

# 2. Actualizar funciones
npm run update-functions
```

## **⚠️ Consideraciones Importantes**

### **Costos de API**
- **Files API**: ~$0.10 por 1K tokens
- **Vector Store**: ~$0.20 por 1K tokens procesados
- **Assistant Update**: Gratis

### **Límites de Rate**
- **Files API**: 100 requests/minuto
- **Vector Store**: 10 requests/minuto
- **Assistant API**: 3000 requests/minuto

### **Tamaños de Archivo**
- **Máximo por archivo**: 512MB
- **Total vector store**: 1GB
- **Formato**: Solo texto (.txt)

## **🛠️ Solución de Problemas**

### **Error: "No se encontró assistant-config.json"**
```bash
# Solución: Crear assistant desde cero
npm run create-assistant
```

### **Error: "OPENAI_ASSISTANT_ID no encontrado"**
```bash
# Verificar .env
echo $OPENAI_ASSISTANT_ID
# Si está vacío, agregar:
# OPENAI_ASSISTANT_ID=asst_EXAMPLE_ID_KkDuq2r9cL5EZSZa95sXkpVR
```

### **Error: "Rate limit exceeded"**
```bash
# Esperar 1 minuto y reintentar
# O usar actualización selectiva en lugar de completa
```

### **Archivo no se actualiza en vector store**
```bash
# Verificar que el archivo existe
ls "RAG OPEN AI ASSISTANCE/# NOMBRE_ARCHIVO.txt"

# Forzar actualización completa
npm run update-all
```

## **📈 Mejores Prácticas**

### **1. Usar Actualizaciones Selectivas**
- Preferir scripts específicos sobre `update-all`
- Menor costo y tiempo de procesamiento

### **2. Verificar Cambios Antes de Actualizar**
```bash
# Ver qué archivos han cambiado
git status
# O revisar manualmente los archivos
```

### **3. Mantener Backup de Configuración**
```bash
# El archivo assistant-config.json se actualiza automáticamente
# Pero puedes hacer backup manual:
cp assistant-config.json assistant-config-backup.json
```

### **4. Probar Después de Actualizar**
```bash
# Reiniciar el bot
npm run dev

# Probar con mensaje de WhatsApp
# Verificar que las funciones responden correctamente
```

## **🎯 Workflow Recomendado**

### **Para Cambios Diarios:**
1. Editar archivos RAG
2. `npm run update-prompt` (si cambió prompt)
3. `npm run add-rag-file` (si hay archivos nuevos)
4. Probar bot

### **Para Cambios Semanales:**
1. Revisar todos los cambios
2. `npm run update-all`
3. Verificar configuración
4. Probar funcionalidad completa

### **Para Problemas Graves:**
1. `npm run create-assistant`
2. Actualizar .env con nuevo ID
3. Reiniciar bot
4. Probar todo

## **📞 Soporte**

Si encuentras problemas:
1. Revisar logs del script
2. Verificar configuración en `.env`
3. Confirmar que `assistant-config.json` existe
4. Probar con script de creación desde cero

---

**💡 Consejo:** Siempre usa el script más específico para tu caso. La actualización inteligente es potente pero puede ser costosa para cambios simples. 