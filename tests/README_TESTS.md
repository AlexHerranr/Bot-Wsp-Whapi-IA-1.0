# 🧪 Tests - Bot WhatsApp Beds24

## 📁 Estructura de Tests

```
tests/
├── README.md                    # Esta documentación
├── beds24/
│   ├── test-beds24.js          # Test unificado principal
│   └── TEST_BEDS24_README.md   # Documentación específica
└── manual.md                   # Guías manuales (si existen)
```

## 🎯 Tests Disponibles

### 🚀 **Test Principal Unificado**
- **Archivo**: `tests/beds24/test-beds24.js`
- **Comando**: `npx tsx tests/beds24/test-beds24.js [tipo] [parámetros]`

### 📋 **Tipos de Test**

#### **Tests Básicos**
1. `general` - Consulta disponibilidad general
2. `apartment` - Consulta apartamento específico
3. `format` - Formato exacto para OpenAI

#### **Tests Críticos**
4. `health` - Verificar conectividad Beds24
5. `error` - Manejo de errores
6. `performance` - Rendimiento y velocidad

#### **Tests Opcionales**
7. `splits` - Lógica de traslados
8. `tokens` - Análisis de tokens

## 🚀 **Uso Rápido**

```bash
# Ver todos los comandos disponibles
npx tsx tests/beds24/test-beds24.js

# Test crítico de conectividad
npx tsx tests/beds24/test-beds24.js health

# Test de disponibilidad
npx tsx tests/beds24/test-beds24.js general 2025-08-15 2025-08-18

# Test de formato para OpenAI
npx tsx tests/beds24/test-beds24.js format 2025-08-15 2025-08-18
```

## 📖 **Documentación Detallada**

Ver `tests/beds24/TEST_BEDS24_README.md` para documentación completa con ejemplos y casos de uso.

## 🔧 **Mantenimiento**

- **Archivos principales**: `test-beds24.js` y `TEST_BEDS24_README.md`
- **Actualizaciones**: Modificar solo estos archivos
- **Nuevos tests**: Agregar al archivo unificado
- **Documentación**: Mantener sincronizada con el código 