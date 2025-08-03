# 🧪 Tests de la Arquitectura Modular

Este directorio contiene las pruebas unitarias para la nueva arquitectura modular del bot.

## 📁 Estructura de Tests

```
tests/
├── core/
│   ├── utils/
│   │   └── identifiers.test.ts    # Tests para funciones de identificación
│   └── state/
│       └── cache-manager.test.ts  # Tests para el gestor de caché
└── plugins/
    └── hotel/
        └── logic/
            └── validation.test.ts # Tests para validación hotelera
```

## 🚀 Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch (re-ejecuta al detectar cambios)
npm run test:watch

# Ejecutar tests con cobertura
npm run test:coverage

# Ejecutar solo tests unitarios
npm run test:unit
```

## ✅ Tests Implementados

### Core Utils
- **identifiers.test.ts**: Prueba las funciones `getShortUserId` y `cleanContactName`
  - Manejo de JIDs de WhatsApp
  - Limpieza de nombres de contacto
  - Casos edge con inputs inválidos

### Core State
- **cache-manager.test.ts**: Prueba el sistema de caché LRU
  - Operaciones básicas (get, set, delete)
  - TTL (Time To Live)
  - Gestión de límites de tamaño
  - Limpieza de caché

### Hotel Plugin
- **validation.test.ts**: Prueba la validación de mensajes hoteleros
  - Detección de precios y cotizaciones
  - Sistema de reintentos
  - Validación de respuestas

## 📝 Escribir Nuevos Tests

Ejemplo de estructura básica:

```typescript
import { MiModulo } from '../../../src/path/to/module';

describe('MiModulo', () => {
    let modulo: MiModulo;

    beforeEach(() => {
        modulo = new MiModulo();
    });

    describe('método específico', () => {
        it('debería hacer algo esperado', () => {
            const resultado = modulo.metodo('input');
            expect(resultado).toBe('output esperado');
        });

        it('debería manejar errores', () => {
            expect(() => modulo.metodoQueFalla()).toThrow();
        });
    });
});
```

## 🎯 Próximos Tests a Implementar

1. **BufferManager**: Probar la lógica de agrupación de mensajes
2. **MediaService**: Mock de OpenAI para probar transcripción y análisis
3. **WhatsappService**: Mock de fetchWithRetry para probar envíos
4. **CoreBot**: Tests de integración con todos los módulos
5. **DatabaseService**: Tests con base de datos en memoria

## 🔧 Configuración

La configuración de Jest se encuentra en `jest.config.js`:
- Preset: `ts-jest` para soporte de TypeScript
- Entorno: `node`
- Pattern de archivos: `**/tests/**/*.test.ts`