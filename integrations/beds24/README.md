# 🏨 Integración Beds24

Integración completa con Beds24 para consultas de disponibilidad en tiempo real.

## 🚀 Inicio Rápido

### 1. Configuración
Ver: [`config.md`](./config.md)

### 2. Tests
Ver: [`tests/manual.md`](./tests/manual.md)

```bash
# Test completo
node integrations/beds24/tests/test-beds24-availability.mjs

# Test específico de OpenAI
node integrations/beds24/tests/test-beds24-availability.mjs openai
```

### 3. Documentación Técnica
Ver: [`../../docs/integrations/beds24/architecture.md`](../../docs/integrations/beds24/architecture.md)

## 📁 Estructura

```
integrations/beds24/
├── README.md              # 👈 Estás aquí
├── config.md              # Configuración step-by-step
├── tests/
│   ├── test-beds24-availability.mjs  # Tests principales
│   ├── test-beds24.mjs              # Test de autenticación
│   └── manual.md                    # Manual de uso de tests
└── examples/
    └── (futuro) sample-responses.json
```

## ✅ Estado Actual

- ✅ **Autenticación** - Token long-life configurado
- ✅ **Disponibilidad** - Consultas en tiempo real
- ✅ **28 propiedades** conectadas
- ✅ **Tests completos** para debugging
- ✅ **Integración OpenAI** funcionando

## 🔧 Uso desde el Bot

La función `check_availability` está disponible automáticamente para OpenAI:

```javascript
// Ejemplo de llamada desde OpenAI
{
  "startDate": "2025-07-15",
  "endDate": "2025-07-18",
  "propertyId": 173311  // opcional
}
```

## 🐛 Debugging

Si algo no funciona:

1. **Verifica autenticación**: `node tests/test-beds24.mjs`
2. **Prueba disponibilidad**: `node tests/test-beds24-availability.mjs openai`
3. **Revisa logs**: `logs/bot-YYYY-MM-DD.log`

## 📚 Links Útiles

- [Configuración](./config.md)
- [Manual de Tests](./tests/manual.md)
- [Arquitectura](../../docs/integrations/beds24/architecture.md)
- [API Beds24](https://api.beds24.com/v2) 