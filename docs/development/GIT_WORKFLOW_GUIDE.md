# 🚀 Guía Completa: Workflow Git para Desarrollo Colaborativo

## 📋 Índice
1. [¿Qué es Git y por qué lo necesitamos?](#qué-es-git-y-por-qué-lo-necesitamos)
2. [Conceptos Básicos de Git](#conceptos-básicos-de-git)
3. [El Problema: Conflictos entre Desarrolladores](#el-problema-conflictos-entre-desarrolladores)
4. [La Solución: Ramas de Desarrollo](#la-solución-ramas-de-desarrollo)
5. [Protocolo Paso a Paso](#protocolo-paso-a-paso)
6. [Ejemplos Prácticos](#ejemplos-prácticos)
7. [Comandos de Referencia](#comandos-de-referencia)

---

## 🤔 ¿Qué es Git y por qué lo necesitamos?

### ¿Qué es Git?
Git es como un **sistema de control de versiones** - imagina que es como tener una máquina del tiempo para tu código. Te permite:
- Guardar diferentes versiones de tu proyecto
- Trabajar en equipo sin pisarse los cambios
- Revertir cambios si algo sale mal
- Ver quién hizo qué y cuándo

### ¿Por qué lo necesitamos?
Sin Git, trabajar en equipo sería un caos:
- ❌ Dos personas editando el mismo archivo = conflictos
- ❌ No saber qué versión es la correcta
- ❌ Perder trabajo si algo se rompe
- ❌ No poder deshacer cambios

---

## 📚 Conceptos Básicos de Git

### 1. **Repositorio (Repo)**
Es como una carpeta especial que Git vigila. Contiene:
- Tu código fuente
- Un historial de todos los cambios
- Información sobre quién hizo qué

### 2. **Commit**
Es como una "foto" de tu código en un momento específico. Cada commit tiene:
- Un mensaje que describe qué cambió
- Un ID único (hash)
- Fecha y autor

### 3. **Rama (Branch)**
Es como una "línea de tiempo" separada. Imagina que es como crear una copia de tu proyecto donde puedes experimentar sin afectar la versión principal.

### 4. **Master/Main**
Es la rama principal, la versión "oficial" de tu proyecto.

---

## ⚠️ El Problema: Conflictos entre Desarrolladores

### Escenario Problemático:
```
Tú (Desarrollo Local)          Cursor Agent (Nube)
     ↓                              ↓
  Editas archivo A              Edita archivo A
     ↓                              ↓
  Haces commit                   Hace commit
     ↓                              ↓
  Intentas hacer push ←→ CONFLICTO! ← Recibe tu push
```

### ¿Qué pasa en un conflicto?
1. Git no sabe qué versión usar
2. Te pide que decidas manualmente
3. Puedes perder trabajo
4. El proyecto puede romperse

---

## ✅ La Solución: Ramas de Desarrollo

### ¿Qué son las ramas?
Imagina que tienes un árbol con ramas:
- **Tronco (master)**: Versión estable y oficial
- **Ramas**: Versiones experimentales donde puedes trabajar sin miedo

### Ventajas de usar ramas:
- ✅ Puedes experimentar sin romper nada
- ✅ Trabajas en paralelo sin conflictos
- ✅ Puedes probar antes de publicar
- ✅ Fácil de deshacer si algo sale mal

---

## 🔄 Protocolo Paso a Paso

### **FASE 1: Preparación (Antes de trabajar)**

#### Paso 1: Obtener cambios de Cursor Agent
```bash
git checkout master
```
**¿Qué hace?** Cambia a la rama principal (master)

**¿Por qué?** Necesitas estar en master para obtener los últimos cambios

#### Paso 2: Descargar cambios del servidor
```bash
git pull origin master
```
**¿Qué hace?** Descarga todos los cambios que Cursor Agent hizo en la nube

**¿Por qué?** Para tener la versión más actualizada antes de empezar a trabajar

#### Paso 3: Cambiar a tu rama de trabajo
```bash
git checkout desarrollo-local
```
**¿Qué hace?** Cambia a tu rama personal donde puedes trabajar sin miedo

**¿Por qué?** Aquí puedes hacer todos los cambios que quieras sin afectar la versión oficial

#### Paso 4: Sincronizar tu rama
```bash
git merge master
```
**¿Qué hace?** Copia todos los cambios de Cursor Agent a tu rama

**¿Por qué?** Para que tu rama tenga los últimos cambios y no haya conflictos

### **FASE 2: Desarrollo (Mientras trabajas)**

#### ✅ Lo que SÍ debes hacer:
- Trabajar solo en `desarrollo-local`
- Hacer commits frecuentes y descriptivos
- Probar tu código antes de mergear

#### ❌ Lo que NO debes hacer:
- Tocar la rama `master` directamente
- Hacer push de tu rama de desarrollo
- Trabajar sin hacer commits

### **FASE 3: Finalización (Al terminar)**

#### Paso 1: Cambiar a master
```bash
git checkout master
```
**¿Qué hace?** Vuelve a la rama principal

#### Paso 2: Integrar tus cambios
```bash
git merge desarrollo-local
```
**¿Qué hace?** Copia todos tus cambios a la rama principal

#### Paso 3: Subir al servidor
```bash
git push origin master
```
**¿Qué hace?** Envía tus cambios a la nube para que Cursor Agent los vea

#### Paso 4: Volver a tu rama
```bash
git checkout desarrollo-local
```
**¿Qué hace?** Regresa a tu rama de trabajo para continuar

---

## 🎯 Ejemplos Prácticos

### Ejemplo 1: Día normal de trabajo

**9:00 AM - Empezar a trabajar:**
```bash
# 1. Obtener cambios de Cursor Agent
git checkout master
git pull origin master

# 2. Ir a mi rama de trabajo
git checkout desarrollo-local
git merge master

# 3. Empezar a trabajar
# ... editar archivos ...
```

**12:00 PM - Guardar progreso:**
```bash
# Hacer commit de lo que llevo
git add .
git commit -m "feat: agregar validación de email en formulario"
```

**6:00 PM - Terminar y publicar:**
```bash
# 1. Ir a master
git checkout master

# 2. Integrar mis cambios
git merge desarrollo-local

# 3. Subir al servidor
git push origin master

# 4. Volver a mi rama
git checkout desarrollo-local
```

### Ejemplo 2: Cursor Agent hace cambios mientras trabajas

**Situación:** Estás trabajando en `desarrollo-local` y Cursor Agent hace cambios en `master`

**Solución:**
```bash
# 1. Guardar mi trabajo actual
git add .
git commit -m "feat: trabajo en progreso"

# 2. Obtener cambios de Cursor Agent
git checkout master
git pull origin master

# 3. Actualizar mi rama
git checkout desarrollo-local
git merge master

# 4. Continuar trabajando
# ... seguir editando ...
```

---

## 📝 Comandos de Referencia

### Comandos Básicos
```bash
# Ver estado actual
git status

# Ver historial de commits
git log --oneline

# Ver en qué rama estoy
git branch

# Ver todas las ramas
git branch -a
```

### Comandos de Sincronización
```bash
# Obtener cambios del servidor
git fetch origin

# Ver qué cambios hay
git log HEAD..origin/master

# Aplicar cambios
git pull origin master
```

### Comandos de Ramas
```bash
# Crear nueva rama
git checkout -b mi-nueva-funcionalidad

# Cambiar de rama
git checkout nombre-rama

# Eliminar rama
git branch -d nombre-rama
```

### Comandos de Commit
```bash
# Ver cambios
git diff

# Agregar archivos
git add archivo.ts
git add .  # todos los archivos

# Hacer commit
git commit -m "feat: descripción del cambio"

# Ver commits recientes
git log --oneline -5
```

---

## 🚨 Situaciones de Emergencia

### Si algo sale mal:
```bash
# Deshacer último commit (mantiene cambios)
git reset --soft HEAD~1

# Deshacer último commit (elimina cambios)
git reset --hard HEAD~1

# Descartar cambios en un archivo
git checkout -- archivo.ts

# Ver qué archivos cambié
git status
```

### Si hay conflictos:
```bash
# Ver archivos con conflictos
git status

# Abrir archivo y resolver manualmente
# Buscar marcadores: <<<<<<< HEAD, =======, >>>>>>>

# Después de resolver:
git add archivo-resuelto.ts
git commit -m "fix: resolver conflictos"
```

---

## 🎉 Resumen

### El Protocolo en 3 Pasos:
1. **Antes de trabajar:** Sincronizar con Cursor Agent
2. **Durante desarrollo:** Trabajar en rama separada
3. **Al terminar:** Integrar y publicar

### Beneficios:
- ✅ Sin conflictos con Cursor Agent
- ✅ Trabajo organizado y seguro
- ✅ Fácil de deshacer si algo sale mal
- ✅ Desarrollo paralelo sin problemas

### Recuerda:
- **Master = Versión oficial** (no tocar directamente)
- **Desarrollo-local = Tu espacio de trabajo** (aquí puedes experimentar)
- **Commits frecuentes = Seguridad** (no perder trabajo)
- **Sincronización diaria = Sin conflictos** (mantener actualizado)

---

## 📞 ¿Necesitas Ayuda?

Si tienes dudas sobre cualquier paso:
1. Revisa esta guía
2. Usa el script automático: `.\scripts\sync-with-cursor.ps1`
3. Consulta los comandos de referencia
4. En caso de emergencia, usa los comandos de recuperación

**¡Recuerda: Es mejor preguntar antes que romper algo!** 🛡️ 