# 🧪 Tests - Bot WhatsApp

## 📋 Descripción
Esta carpeta contiene todos los tests del proyecto Bot-Wsp-Whapi-IA, organizados por tipo y funcionalidad.

## 🗂️ Estructura

```
tests/
├── 📄 setup.ts                    # Configuración global de Jest
├── 📄 README.md                   # Este archivo
├── 📁 unit/                       # Tests unitarios
│   ├── logger.test.ts            # Tests del sistema de logging
│   └── data-sanitizer.test.ts    # Tests de sanitización de datos
├── 📁 integration/                # Tests de integración (futuro)
├── 📁 e2e/                       # Tests end-to-end (futuro)
└── 📁 mocks/                     # Mocks y fixtures (futuro)
```

## 🚀 Comandos de Testing

### Tests Básicos
```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Ejecutar tests con cobertura
npm run test:coverage

# Ejecutar solo tests unitarios
npm run test:unit
```

### Tests Específicos
```bash
# Ejecutar tests de logging
npm test -- tests/unit/logger.test.ts

# Ejecutar tests de sanitización
npm test -- tests/unit/data-sanitizer.test.ts

# Ejecutar tests con patrón específico
npm test -- --testNamePattern="logInfo"
```

## 📊 Cobertura de Tests

### Funcionalidades Cubiertas
- ✅ **Sistema de Logging**: Todas las funciones principales
- ✅ **Sanitización de Datos**: Protección de información sensible
- 🔄 **Tests de Integración**: En desarrollo
- 🔄 **Tests E2E**: Planificados

### Métricas Objetivo
- **Cobertura de código**: >80%
- **Tests unitarios**: 100% de funciones críticas
- **Tests de integración**: APIs principales
- **Tests E2E**: Flujos de conversación básicos

## 🧪 Tipos de Tests

### Tests Unitarios (`/unit/`)
- **Propósito**: Probar funciones individuales de forma aislada
- **Tecnología**: Jest + TypeScript
- **Cobertura**: Funciones de utilidad, helpers, validaciones

#### Archivos Actuales:
- `logger.test.ts` - Sistema de logging
- `data-sanitizer.test.ts` - Sanitización de datos sensibles

### Tests de Integración (`/integration/`) - Futuro
- **Propósito**: Probar interacciones entre módulos
- **Cobertura**: APIs, webhooks, integraciones externas

### Tests E2E (`/e2e/`) - Futuro
- **Propósito**: Probar flujos completos de conversación
- **Cobertura**: Experiencia de usuario completa

## 🔧 Configuración

### Jest Configuration (`jest.config.js`)
```javascript
{
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/app-unified.ts', // Excluido por complejidad
  ]
}
```

### Setup Global (`setup.ts`)
- Configuración de variables de entorno para testing
- Mocks de APIs externas
- Helpers para datos de prueba
- Configuración de timeouts

## 📝 Convenciones

### Nomenclatura
```typescript
// Archivos de test
logger.test.ts
data-sanitizer.test.ts

// Describe blocks
describe('🧪 Sistema de Logging', () => {
  describe('logInfo', () => {
    it('debería registrar información correctamente', () => {
      // test implementation
    });
  });
});
```

### Estructura de Tests
```typescript
describe('🧪 [Nombre del Sistema]', () => {
  beforeEach(() => {
    // Setup antes de cada test
  });

  afterEach(() => {
    // Cleanup después de cada test
  });

  describe('[Funcionalidad Específica]', () => {
    it('debería [comportamiento esperado]', () => {
      // Arrange
      const input = 'test data';
      
      // Act
      const result = functionToTest(input);
      
      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

## 🚫 Lo que NO se testea

### Archivos Excluidos
- `src/app-unified.ts` - Archivo principal (muy complejo)
- Archivos de configuración
- Scripts de deployment
- Documentación

### Razones de Exclusión
1. **Complejidad**: app-unified.ts es monolítico y difícil de testear
2. **Dependencias**: Muchas dependencias externas
3. **Configuración**: Archivos de configuración no necesitan tests
4. **Documentación**: Markdown no requiere tests

## 🔄 Próximos Pasos

### Tests Pendientes
1. **Tests de Configuración**: Validar carga de variables de entorno
2. **Tests de Funciones**: Probar function calling
3. **Tests de Buffer**: Validar sistema de buffering
4. **Tests de WHAPI**: Mockear integración con WhatsApp
5. **Tests de OpenAI**: Mockear respuestas de IA

### Mejoras Futuras
1. **Tests de Performance**: Validar timeouts y rate limiting
2. **Tests de Seguridad**: Validar sanitización en producción
3. **Tests de Recuperación**: Validar manejo de errores
4. **Tests de Escalabilidad**: Validar con múltiples usuarios

## 📊 Reportes

### Cobertura
```bash
npm run test:coverage
```
Genera reporte en `coverage/` con:
- Cobertura por archivo
- Cobertura por función
- Líneas no cubiertas
- Reporte HTML interactivo

### Logs de Tests
```bash
npm test -- --verbose
```
Muestra logs detallados de cada test ejecutado.

---

**Estado**: 🟡 En desarrollo  
**Última actualización**: Julio 2025  
**Cobertura actual**: ~15% (solo tests unitarios básicos) 