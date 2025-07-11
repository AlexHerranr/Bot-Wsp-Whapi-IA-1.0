# 🔧 Configuración Google Cloud para Parser de Logs

## 🚀 Setup Inicial (Solo una vez)

### 1. Autenticación
```bash
gcloud auth login
```
- Se abrirá el navegador automáticamente
- Inicia sesión con tu cuenta de Google Cloud
- Autoriza el acceso

### 2. Verificar Configuración
```bash
# Verificar que estés autenticado
gcloud auth list

# Verificar proyecto actual
gcloud config get-value project
# Debe mostrar: gen-lang-client-0318357688

# Si el proyecto no es correcto, configurarlo:
gcloud config set project gen-lang-client-0318357688
```

### 3. Verificar Permisos
```bash
# Probar acceso a logs
gcloud logging read "resource.type=cloud_run_revision" --limit=1
```

## 🔄 Uso Diario

Una vez configurado, simplemente ejecuta:
```bash
python parse_bot_logs.py --sessions 10
```

## ❌ Problemas Comunes

### Error: "Reautentication failed"
**Solución:**
```bash
gcloud auth login
```

### Error: "Project not set"
**Solución:**
```bash
gcloud config set project gen-lang-client-0318357688
```

### Error: "Permission denied"
**Solución:**
- Verificar que tu cuenta tenga permisos de "Logging Viewer"
- Contactar al administrador del proyecto

## 📋 Comandos Útiles

```bash
# Ver logs en tiempo real
gcloud logging tail "resource.type=cloud_run_revision"

# Ver configuración actual
gcloud config list

# Cambiar cuenta (si tienes múltiples)
gcloud config set account tu-email@gmail.com
```

## 🔗 Enlaces Útiles

- [Documentación gcloud CLI](https://cloud.google.com/sdk/gcloud)
- [Guía de Cloud Logging](https://cloud.google.com/logging/docs)
- [Configuración de proyectos](https://cloud.google.com/resource-manager/docs/creating-managing-projects)

---

**💡 Tip**: Guarda este archivo para futuras referencias. La autenticación se mantiene por varios días/semanas normalmente. 