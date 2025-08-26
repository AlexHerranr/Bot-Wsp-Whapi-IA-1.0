# Tests - Generate Invoice PDF

Esta carpeta contiene las pruebas para la funcionalidad de generación de PDFs de facturas.

## 📋 Test Funcional

### `test-pdf-generation.js`
Test principal que verifica la generación correcta de PDFs con el nuevo diseño visual.

**Características:**
- ✅ Genera PDF con template funcional (`invoice-template.html`)
- ✅ Datos de prueba completos y realistas
- ✅ Verifica tamaño, tiempo y eficiencia
- ✅ Guarda PDF en `src/temp/pdfs/`

**Uso:**
```bash
npx tsx tests/test-pdf-generation.js
```

**Resultado esperado:**
- PDF generado: ~540KB
- Tiempo: 5-6 segundos
- Diseño moderno con nuevo layout visual
- Sin errores de sintaxis Handlebars

## 🎯 Propósito

Este test valida que:
1. El template principal funciona correctamente
2. No hay errores de parsing Handlebars
3. El PDF se genera con el diseño visual solicitado
4. Todos los datos dinámicos se renderizan correctamente