# Sistema Simple de Etiquetas - TeAlquilamos Bot

## 🎯 ¿Qué hace?
Sincroniza las etiquetas de WhatsApp Business con el bot de forma **simple y eficiente**.

## 📋 ¿Cuándo se actualizan las etiquetas?

### 1️⃣ **Cuando un huésped escribe por primera vez**
```
Cliente nuevo → Bot crea thread → Obtiene etiquetas → Las guarda
```

### 2️⃣ **Cuando OpenAI decide cambiar etiquetas**
```
Cliente: "Soy un cliente VIP"
OpenAI: Detecta contexto → Ejecuta update_client_labels → Actualiza
```

### 3️⃣ **Cuando han pasado más de 24 horas desde la última interacción**
```
Cliente escribe después de 24h → Bot detecta tiempo → Actualiza etiquetas
(Por si alguien las cambió manualmente desde el celular)
```

## 🚀 Ventajas del Sistema Simple

✅ **Eficiente**: Solo 3 casos específicos, no en cada mensaje  
✅ **Simple**: Fácil de entender y mantener  
✅ **Completo**: Cubre todos los casos necesarios  
✅ **Sin sobrecarga**: No hace llamadas innecesarias  
✅ **Inteligente**: Detecta cambios manuales después de 24h  

## 📁 ¿Dónde se guardan?

En `tmp/threads.json`:
```json
{
  "573003913251": {
    "threadId": "thread_xxx",
    "labels": [
      {
        "id": "9",
        "name": "Colega Jefe",
        "color": "rebeccapurple"
      }
    ]
  }
}
```

## 🧪 ¿Cómo probar?

```bash
# Ver etiquetas actuales
node tests/whapi/test-chat-specific.js 573003913251@s.whatsapp.net

# Probar el sistema
node tests/test-labels-update.js 573003913251
```

## 💡 Resumen
- **NO** se actualizan en cada mensaje ❌
- **SÍ** se actualizan cuando es nuevo usuario ✅
- **SÍ** se actualizan cuando OpenAI lo decide ✅
- **SÍ** se actualizan después de 24h sin contacto ✅

Simple, eficiente y funcional. 🎯 