# ⚡ Inicio Rápido - Bot Logs Parser

> **¿Necesitas logs del bot AHORA? Esta guía te tiene cubierto en 2 minutos.**

## 🚀 Comandos Esenciales

```bash
# Los únicos 4 comandos que necesitas saber:
.\botlogs.bat                     # Últimas 2 horas
.\botlogs.bat errors              # Solo errores  
.\botlogs.bat user 573003913251   # Logs de usuario específico
.\botlogs.bat 6                   # Últimas 6 horas
```

## 🎯 Casos de Uso Inmediatos

### "El bot no responde"
```bash
.\botlogs.bat 1        # Ver última hora
.\botlogs.bat errors   # Buscar errores
```

### "Usuario X tiene problemas"
```bash
.\botlogs.bat user 573003913251
```

### "¿Qué pasó esta mañana?"
```bash
.\botlogs.bat 8
```

### "Solo los errores importantes"
```bash
.\botlogs.bat errors
```

## 📋 Lo que Verás

```
=== NUEVA SESIÓN DEL BOT ===
🚀 [12:09:55] INFO: Servidor HTTP iniciado
👤 [12:09:57] INFO: 573003913251: "Hola"
🔴 [12:10:02] ERROR: Timeout en OpenAI
=== FIN DE SESIÓN DEL BOT ===
Errores: 1, Usuarios: 1
```

## 🔍 Iconos Importantes

- 🚀 = Bot iniciando (bueno)
- 👤 = Mensaje de usuario (normal)  
- 🔴 = Error (malo)
- ⚠️ = Warning (cuidado)
- ℹ️ = Info (normal)

## ⚙️ ¿No Funciona?

1. **Instalar Python**: https://www.python.org/downloads/
2. **Instalar dependencia**: `python -m pip install pyperclip`
3. **Verificar gcloud**: `gcloud --version`

## 🎯 ¿Listo?

```bash
cd tools/bot-logs-parser
.\botlogs.bat
```

**¡Ya tienes logs organizados como en desarrollo local!** 🎉

---

**Para más detalles**: Lee `README.md` y `MANUAL_USO.md` 