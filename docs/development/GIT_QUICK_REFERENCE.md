# 🚀 Guía Rápida: Git Workflow

## 🎯 El Problema
- Cursor Agent edita archivos en la nube
- Tú editas archivos localmente
- **Resultado:** Conflictos cuando intentas subir cambios

## ✅ La Solución
Usar **ramas separadas** para evitar conflictos.

---

## 📋 Protocolo Diario (3 Pasos)

### 1️⃣ **ANTES de trabajar** (Sincronizar)
```bash
git checkout master
git pull origin master
git checkout desarrollo-local
git merge master
```

### 2️⃣ **DURANTE el trabajo** (Desarrollar)
```bash
# Trabajar solo en desarrollo-local
# Hacer commits frecuentes
git add .
git commit -m "feat: mi nueva funcionalidad"
```

### 3️⃣ **AL TERMINAR** (Publicar)
```bash
git checkout master
git merge desarrollo-local
git push origin master
git checkout desarrollo-local
```

---

## 🛠️ Script Automático
En lugar de hacer los 4 comandos manualmente, usa:
```bash
.\scripts\sync-with-cursor.ps1
```

---

## 🎯 Analogía Simple

**Imagina que tienes una casa:**

- **Master** = La casa oficial (no tocar directamente)
- **Desarrollo-local** = Tu taller personal (aquí puedes experimentar)
- **Commits** = Fotos de tu trabajo (para no perder nada)
- **Merge** = Mover tus mejoras a la casa oficial

---

## 🚨 Comandos de Emergencia

```bash
# Ver en qué rama estoy
git branch

# Ver estado actual
git status

# Deshacer último commit
git reset --soft HEAD~1

# Descartar cambios
git checkout -- archivo.ts
```

---

## 📞 ¿Cuándo usar cada cosa?

| Situación | Comando |
|-----------|---------|
| Empezar a trabajar | `.\scripts\sync-with-cursor.ps1` |
| Guardar progreso | `git add . && git commit -m "mensaje"` |
| Terminar funcionalidad | Mergear a master y hacer push |
| Ver qué cambié | `git status` |
| Deshacer algo | `git reset --soft HEAD~1` |

---

## 🎉 Beneficios

- ✅ **Sin conflictos** con Cursor Agent
- ✅ **Trabajo seguro** (puedes experimentar)
- ✅ **Fácil deshacer** si algo sale mal
- ✅ **Desarrollo paralelo** sin problemas

---

**¡Recuerda: Master = Oficial, Desarrollo-local = Tu espacio de experimentación!** 🛡️ 