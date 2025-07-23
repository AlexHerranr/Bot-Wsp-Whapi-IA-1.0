# Scripts de Windows - Git y Railway

## 🚂 Railway Scripts

### **Configuración Inicial de Railway:**
```powershell
# Configurar Railway CLI y autenticación
.\scripts\windows\setup-railway.ps1
```

### **Descarga de Logs de Railway:**
```powershell
# Descargar logs del deployment más reciente
.\scripts\windows\download-railway-logs.ps1

# Especificar directorio de salida
.\scripts\windows\download-railway-logs.ps1 "C:\temp\logs"
```

### **Filtrado de Logs de Railway:**
```powershell
# Filtrar por tipo de evento
.\scripts\windows\filter-railway-logs.ps1 openai
.\scripts\windows\filter-railway-logs.ps1 errors
.\scripts\windows\filter-railway-logs.ps1 messages
.\scripts\windows\filter-railway-logs.ps1 beds24

# Ver todos los logs
.\scripts\windows\filter-railway-logs.ps1 all
```

### **Características de Railway:**
- ✅ **Instalación automática** de Railway CLI
- ✅ **Autenticación** y enlace de proyecto
- ✅ **Descarga dual** (TXT + JSON)
- ✅ **Verificación** de dependencias
- ✅ **Manejo de errores** robusto

## 🔧 Git Scripts

### Problema Solucionado
Git no funciona directamente en PowerShell porque no está en el PATH. Estos scripts solucionan ese problema.

## Solución Rápida (Recomendada)

### Para hacer push inmediato:
```powershell
.\scripts\windows\git-push-simple.ps1
```

### Para hacer push con mensaje personalizado:
```powershell
.\scripts\windows\git-push-simple.ps1 "Mi mensaje de commit"
```

## Configuración Permanente (Opcional)

Si quieres que Git funcione siempre en PowerShell:

1. Ejecuta UNA SOLA VEZ:
```powershell
.\scripts\windows\git-setup-simple.ps1
```

2. Reinicia PowerShell

3. Después podrás usar:
```powershell
git status
gitpush
gitstatus
```

## Archivos Incluidos

### 🚂 Railway Scripts:
- `setup-railway.ps1` - Configuración inicial de Railway CLI
- `download-railway-logs.ps1` - Descarga automática de logs
- `filter-railway-logs.ps1` - Filtrado de logs por categorías

### 🔧 Git Scripts:
- `git-push-simple.ps1` - Script para push inmediato (RECOMENDADO)
- `git-setup-simple.ps1` - Configuración permanente de Git
- `git-setup.ps1` - Versión avanzada (puede tener problemas de encoding)
- `git-push.ps1` - Versión con emojis (puede tener problemas de encoding)

## Uso Diario Recomendado

Simplemente ejecuta cuando quieras hacer push:
```powershell
.\scripts\windows\git-push-simple.ps1 "Descripción de cambios"
```

¡Eso es todo! No más problemas con Git en PowerShell. 