# Templates Antiguos - Generate Invoice PDF

Esta carpeta contiene las versiones anteriores de los templates de facturación que presentaban problemas de sintaxis Handlebars.

## ⚠️ Templates con Problemas

Todos estos templates generaban errores del tipo:
```
Parse error on line XXX: Expecting 'OPEN_INVERSE_CHAIN', 'INVERSE', 'OPEN_ENDBLOCK', got 'EOF'
```

### Lista de Templates Problemáticos:

- `invoice-template.html` - Template original
- `invoice-template-backup.html` - Respaldo con errores
- `invoice-template-compact.html` - Versión compacta problemática
- `invoice-template-final.html` - Versión "final" con errores de parsing
- `invoice-template-hybrid.html` - Template híbrido no funcional
- `invoice-template-premium.html` - Versión premium con problemas
- `invoice-template-v5-dense.html` - Versión densa v5
- `invoice-template-v6-backup.html` - Backup v6 no funcional

## ✅ Template Funcional Actual

El template funcional actual se encuentra en:
`../templates/invoice-template.html`

Este template:
- ✅ Sintaxis Handlebars correcta
- ✅ Genera PDFs sin errores
- ✅ Diseño visual moderno e idéntico al solicitado
- ✅ Compatible con todos los datos existentes

## 🎯 Propósito

Estos templates se mantienen como referencia histórica pero **NO deben usarse** en producción debido a sus errores de sintaxis.