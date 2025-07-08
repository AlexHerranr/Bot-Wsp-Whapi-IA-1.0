# Scripts de Git para Windows

## Problema Solucionado
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