# Bot WhatsApp Hotel - TeAlquilamos

Bot de WhatsApp con IA para gestión hotelera integrado con Beds24.

## 🚀 Deploy Rápido

1. **Local**: `npm run dev:local`
2. **Railway**: Ver [Railway Guide](deployment/RAILWAY_DEPLOYMENT_GUIDE.md)

## 📁 Estructura

```
src/
├── main.ts              # Entry point
├── core/                # Servicios genéricos
│   ├── services/        # database, openai, whatsapp
│   └── state/           # buffer, cache
├── plugins/hotel/       # Plugin hotelero específico
│   ├── functions/       # check-availability
│   └── services/        # beds24
└── config/              # environment, secrets
```

## ⚙️ Variables de Entorno

```bash
# OpenAI
OPENAI_API_KEY=sk-...
ASSISTANT_ID=asst-...

# WhatsApp API
WHAPI_TOKEN=...
WHAPI_API_URL=https://gate.whapi.cloud

# Hotel (Beds24)
BEDS24_TOKEN=...
BEDS24_API_URL=https://api.beds24.com/v2

# Database
DATABASE_URL=postgresql://...
```

## 🔧 Scripts

- `npm run dev:local` - Desarrollo con ngrok
- `npm run build` - Build producción
- `npm start` - Iniciar producción
- `npm test` - Tests
- `railway logs` - Ver logs Railway

## 🏨 Plugin Hotel

El sistema es modular. El plugin hotel está en `src/plugins/hotel/` y se activa con `PLUGIN_HOTEL_ENABLED=true`.

Para otras industrias, crear `src/plugins/ecommerce/`, etc.