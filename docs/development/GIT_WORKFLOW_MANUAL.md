# 📚 Manual de Git Workflow - Bot WhatsApp IA

## 🎯 Propósito
Este manual establece las mejores prácticas para el control de versiones en el proyecto Bot WhatsApp IA, adaptado a un entorno profesional y las configuraciones específicas del proyecto.

---

## 🏗️ Arquitectura de Ramas Recomendada

### **Flujo de Trabajo Profesional**
```
master (producción)
├── develop (integración)
├── feature/nueva-funcionalidad
├── hotfix/error-critico
└── release/v1.2.0
```

### **Flujo Simplificado (Recomendado para este proyecto)**
```
main (producción)
├── feature/nueva-funcionalidad
└── hotfix/error-critico
```

---

## 🚀 Configuración Inicial

### **1. Configuración de Git en Windows**
```powershell
# Función temporal para la sesión actual
function git { & "C:\Program Files\Git\bin\git.exe" $args }

# Configuración permanente (ejecutar UNA SOLA VEZ)
.\scripts\windows\git-setup-simple.ps1
```

### **2. Configuración de Usuario**
```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-email@ejemplo.com"
```

### **3. Configuración del Proyecto**
```bash
# Configurar rama principal
git branch -M main

# Configurar upstream
git remote add origin https://github.com/AlexHerranr/Bot-Wsp-Whapi-IA-1.0.git
```

---

## 📝 Convenciones de Commits

### **Formato de Mensajes (Conventional Commits)**
```bash
# Estructura
<tipo>(<alcance>): <descripción>

[body opcional]

[footer opcional]
```

### **Tipos de Commit**
- `feat:` - Nueva funcionalidad
- `fix:` - Corrección de bug
- `docs:` - Documentación
- `style:` - Formato, punto y coma faltante, etc.
- `refactor:` - Refactorización de código
- `test:` - Agregar o corregir tests
- `chore:` - Tareas de mantenimiento

### **Ejemplos de Mensajes Profesionales**
```bash
# ✅ BUENOS EJEMPLOS
git commit -m "feat: implement PostgreSQL planning and MCP servers analysis"
git commit -m "fix: resolve webhook validation timeout issues"
git commit -m "docs: update API reference with new endpoints"
git commit -m "refactor: optimize memory usage in conversation cache"
git commit -m "test: add integration tests for Beds24 availability"

# ❌ EVITAR
git commit -m "fix"
git commit -m "update"
git commit -m "remocion de claves secretas"
git commit -m "cambios varios"
```

---

## 🔄 Flujo de Trabajo Diario

### **1. Desarrollo de Nueva Funcionalidad**

```bash
# 1. Crear rama de feature
git checkout -b feature/nueva-funcionalidad

# 2. Hacer cambios y commits frecuentes
git add .
git commit -m "feat: implement initial database schema"

git add .
git commit -m "feat: add user authentication logic"

# 3. Push de la rama
git push origin feature/nueva-funcionalidad

# 4. Crear Pull Request en GitHub
# 5. Revisar y mergear a main
```

### **2. Corrección de Bugs Críticos**

```bash
# 1. Crear rama de hotfix
git checkout -b hotfix/error-critico

# 2. Hacer la corrección
git add .
git commit -m "fix: resolve critical webhook timeout issue"

# 3. Push y merge directo
git push origin hotfix/error-critico
# Crear PR y mergear inmediatamente
```

### **3. Commits Directos a Main (Solo en casos específicos)**

```bash
# ✅ PERMITIDO para:
# - Documentación menor
# - Configuraciones de desarrollo
# - Correcciones menores de formato

# ❌ NO PERMITIDO para:
# - Nuevas funcionalidades
# - Cambios en lógica de negocio
# - Refactorizaciones importantes
```

---

## 🛠️ Scripts Automatizados

### **Scripts Disponibles**
```powershell
# Push rápido con mensaje personalizado
.\scripts\windows\git-push-simple.ps1 "feat: implement new feature"

# Push con mensaje por defecto
.\scripts\windows\git-push-simple.ps1

# Configuración permanente de Git
.\scripts\windows\git-setup-simple.ps1
```

### **Comandos Personalizados (después de setup)**
```powershell
git status    # Estado del repositorio
gitpush       # Push rápido
gitstatus     # Status rápido
```

---

## 📊 Mejores Prácticas

### **1. Frecuencia de Commits**
- ✅ **Commits frecuentes** en ramas de feature (está bien)
- ✅ **Commits atómicos** - un cambio lógico por commit
- ❌ **Commits masivos** con múltiples cambios no relacionados

### **2. Tamaño de Commits**
- ✅ **Pequeños y frecuentes** - más fácil de revisar
- ✅ **Descriptivos** - mensaje claro del cambio
- ❌ **Monolíticos** - cambios grandes sin contexto

### **3. Revisión de Código**
- ✅ **Pull Requests** para todas las funcionalidades
- ✅ **Auto-review** antes de mergear
- ✅ **Tests** antes de push

### **4. Nomenclatura**
- ✅ **Ramas descriptivas**: `feature/user-authentication`
- ✅ **Commits claros**: `feat: add OAuth2 authentication`
- ❌ **Nombres genéricos**: `feature/new`, `fix/bug`

---

## 🔍 Comandos Útiles

### **Estado y Información**
```bash
# Ver estado actual
git status

# Ver historial de commits
git log --oneline -10

# Ver diferencias
git diff

# Ver ramas
git branch -a
```

### **Manejo de Ramas**
```bash
# Crear y cambiar a nueva rama
git checkout -b feature/nueva-funcionalidad

# Cambiar entre ramas
git checkout main
git checkout feature/nueva-funcionalidad

# Eliminar rama local
git branch -d feature/rama-completada

# Eliminar rama remota
git push origin --delete feature/rama-completada
```

### **Sincronización**
```bash
# Actualizar rama local
git pull origin main

# Actualizar todas las ramas remotas
git fetch --all

# Rebase para mantener historial limpio
git rebase main
```

---

## 🚨 Casos Especiales

### **1. Commits Directos a Main**
```bash
# Solo para documentación y configuraciones menores
git add .
git commit -m "docs: update README with new setup instructions"
git push origin main
```

### **2. Corrección de Último Commit**
```bash
# Cambiar mensaje del último commit
git commit --amend -m "feat: implement improved error handling"

# Agregar archivos al último commit
git add archivo-olvidado.ts
git commit --amend --no-edit
```

### **3. Revertir Cambios**
```bash
# Revertir último commit
git revert HEAD

# Revertir commit específico
git revert <commit-hash>

# Reset hard (¡CUIDADO!)
git reset --hard HEAD~1
```

---

## 📋 Checklist de Commit

### **Antes de Hacer Commit**
- [ ] ¿Los cambios están relacionados lógicamente?
- [ ] ¿El mensaje de commit es descriptivo?
- [ ] ¿Se han ejecutado los tests localmente?
- [ ] ¿Se han eliminado archivos temporales?
- [ ] ¿Se han actualizado las dependencias si es necesario?

### **Antes de Push**
- [ ] ¿Estoy en la rama correcta?
- [ ] ¿He hecho pull de los últimos cambios?
- [ ] ¿Los tests pasan en mi entorno?
- [ ] ¿El código sigue las convenciones del proyecto?

### **Antes de Merge**
- [ ] ¿He creado un Pull Request?
- [ ] ¿He revisado mi propio código?
- [ ] ¿He actualizado la documentación si es necesario?
- [ ] ¿He verificado que no hay conflictos?

---

## 🎯 Recomendaciones Específicas del Proyecto

### **1. Estructura de Commits para este Bot**
```bash
# Funcionalidades del bot
git commit -m "feat: add intelligent message buffering system"
git commit -m "feat: implement Beds24 availability integration"

# Mejoras de performance
git commit -m "perf: optimize conversation cache with TTL"
git commit -m "perf: reduce OpenAI API calls by 50%"

# Correcciones de bugs
git commit -m "fix: resolve webhook timeout in Cloud Run"
git commit -m "fix: handle rate limiting for WHAPI calls"

# Documentación
git commit -m "docs: update deployment guide for Cloud Run"
git commit -m "docs: add troubleshooting section for common issues"
```

### **2. Ramas Recomendadas**
```bash
# Funcionalidades principales
feature/message-buffering
feature/beds24-integration
feature/ai-context-management

# Mejoras de performance
feature/performance-optimization
feature/memory-optimization

# Correcciones críticas
hotfix/webhook-timeout
hotfix/api-rate-limit
```

### **3. Configuración Específica**
```bash
# Usar la ruta completa de Git en Windows
& "C:\Program Files\Git\bin\git.exe" <comando>

# O configurar permanentemente
.\scripts\windows\git-setup-simple.ps1
```

---

## 🔄 Migración del Flujo Actual

### **Para Proyectos Existentes**
1. **Evaluar commits actuales**: ¿Son apropiados para main?
2. **Crear rama develop**: Para integración futura
3. **Configurar protección**: Proteger ramas principales
4. **Documentar cambios**: Actualizar este manual

### **Para Nuevas Funcionalidades**
1. **Siempre usar ramas de feature**
2. **Crear Pull Requests**
3. **Revisar antes de mergear**
4. **Mantener historial limpio**

---

## 📚 Recursos Adicionales

### **Documentación Relacionada**
- `scripts/windows/README.md` - Scripts de Git para Windows
- `docs/progress/ACTUALIZACION_ENERO_2025.md` - Configuración de Git
- `docs/SECURITY_AND_DEPLOYMENT.md` - Seguridad y deployment

### **Comandos de Referencia**
```bash
# Configuración de Git
git config --list
git config --global --list

# Información del repositorio
git remote -v
git branch -a

# Historial detallado
git log --graph --oneline --all
```

---

## 🎉 Conclusión

Este manual establece un flujo de trabajo profesional que:
- ✅ **Mantiene la calidad** del código
- ✅ **Facilita la colaboración** futura
- ✅ **Preserva el historial** de cambios
- ✅ **Optimiza el desarrollo** diario
- ✅ **Adapta las mejores prácticas** a tu proyecto específico

**Recuerda**: Un buen flujo de Git es la base de un proyecto profesional y mantenible a largo plazo. 