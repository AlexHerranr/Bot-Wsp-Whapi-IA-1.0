# 🔄 Restaurar Backup de Threads

## 📁 Backup Creado

Se creó un backup del archivo `threads.json` antes de eliminarlo:
- **Archivo**: `threads.backup-20250703-215948.json`
- **Fecha**: 3 de julio de 2025, 21:59:48

## 🔧 Cómo Restaurar

Si necesitas restaurar el archivo original, ejecuta uno de estos comandos:

### PowerShell (Windows):
```powershell
Copy-Item -Path "tmp/threads.backup-20250703-215948.json" -Destination "tmp/threads.json"
```

### Command Prompt (Windows):
```cmd
copy "tmp\threads.backup-20250703-215948.json" "tmp\threads.json"
```

### Bash (Linux/Mac):
```bash
cp tmp/threads.backup-20250703-215948.json tmp/threads.json
```

## ⚠️ Importante

- El bot creará automáticamente un nuevo `threads.json` cuando reciba mensajes
- Solo restaura si necesitas recuperar el historial de threads anteriores
- Después de restaurar, reinicia el bot para que cargue los threads 