# 📄 Generate Invoice PDF - Generador Interno de PDFs

## 🎯 **Descripción**
Sistema interno de generación de PDFs usando **Puppeteer** para crear facturas profesionales de Pa'Cartagena directamente en el bot, sin depender de servicios externos.

## ✨ **Características**
- ✅ **Generación interna** con Puppeteer (sin dependencias N8N)
- ✅ **Template HTML profesional** con branding Pa'Cartagena
- ✅ **Múltiples tipos de documento** automáticos
- ✅ **Validación robusta** de parámetros
- ✅ **Logging detallado** para debugging
- ✅ **Optimizado para producción** - PDFs <2MB

## 📁 **Estructura de Archivos**
```
src/plugins/hotel/functions/generate-invoice-pdf/
├── generate-invoice-pdf.ts        # Función principal OpenAI
├── README.md                      # Esta documentación
├── schema.json                    # Schema OpenAI
└── templates/
    └── invoice-template.html      # Template HTML optimizado

src/plugins/hotel/services/
└── pdf-generator.service.ts       # Servicio PDF con Puppeteer

temp/pdfs/                         # PDFs generados (opcional)
```

## 🔧 **Uso desde OpenAI Functions**

### **Parámetros Mínimos Requeridos:**
```javascript
{
  "bookingId": "BOOK-12345",
  "guestName": "Juan Pérez",
  "email": "juan@email.com", 
  "checkInDate": "2024-12-15",
  "checkOutDate": "2024-12-17",
  "roomName": "Apartamento Premium",
  "nights": 2,
  "totalCharges": "$400.000",
  "invoiceItems": [
    {
      "description": "Alojamiento 2 noches",
      "quantity": "2",
      "unitPrice": "$200.000",
      "totalAmount": "$400.000"
    }
  ]
}
```

### **Parámetros Opcionales:**
- `guestCount`: Número de huéspedes (default: "1 persona")
- `phone`: Teléfono del huésped
- `totalPaid`: Total pagado
- `balance`: Saldo pendiente  
- `bookingStatus`: Estado de la reserva
- `triggerFunction`: Tipo de función (`create_new_booking`, `add_payment_booking`, `confirm_booking`)
- `saveToFile`: Guardar PDF en disco (default: false)
- `returnBuffer`: Retornar buffer del PDF (default: false)

## 🎨 **Tipos de Documento Automáticos**

| Trigger Function | Tipo de Documento |
|------------------|-------------------|
| `create_new_booking` | **CONFIRMACIÓN DE RESERVA** |
| `add_payment_booking` | **COMPROBANTE DE PAGO** |
| `confirm_booking` | **RESERVA CONFIRMADA** |
| Otro/vacío | **FACTURA** |

## 📤 **Respuesta Exitosa**
```json
{
  "success": true,
  "message": "✅ PDF generado exitosamente para reserva BOOK-12345",
  "bookingId": "BOOK-12345",
  "documentType": "CONFIRMACIÓN DE RESERVA",
  "size": "156.3 KB",
  "generationTime": "1247ms",
  "pdfPath": "/temp/pdfs/invoice-BOOK-12345-1703512345678.pdf"
}
```

## 🚫 **Respuesta de Error**
```json
{
  "success": false,
  "message": "Parámetros inválidos: email es requerido",
  "bookingId": "BOOK-12345",
  "errors": ["email es requerido"],
  "error": "Validation failed"
}
```

## 🏗️ **Uso Programático Directo**

### **Desde el Servicio:**
```javascript
import { PDFGeneratorService } from '../../../services/pdf-generator.service';

const pdfService = new PDFGeneratorService();
const result = await pdfService.generateInvoicePDF(invoiceData, {
  saveToFile: true,
  outputDir: './temp/pdfs'
});
```

### **Desde la Función OpenAI:**
```javascript
import { generateInvoicePDF } from './generate-invoice-pdf';

const result = await generateInvoicePDF({
  bookingId: "BOOK-001",
  guestName: "María García",
  email: "maria@email.com",
  // ... otros parámetros
});
```

## 🎨 **Template HTML**

**Ubicación:** `templates/invoice-template.html`

**Características del Template:**
- ✅ **Diseño profesional** con gradientes y branding
- ✅ **Responsive** - Móvil/desktop/print ready
- ✅ **Variables Handlebars** - `{{variable}}`
- ✅ **Condicionales** - `{{#if}}...{{/if}}`
- ✅ **Loops** - `{{#each}}...{{/each}}`
- ✅ **CSS optimizado** con print styles
- ✅ **Logo Pa'Cartagena** embebido

**Variables disponibles:**
- `{{documentType}}` - Tipo de documento
- `{{bookingId}}` - ID de reserva
- `{{currentDate}}` - Fecha actual
- `{{guestName}}` - Nombre del huésped
- `{{guestCount}}` - Número de huéspedes
- `{{checkInDate}}` / `{{checkOutDate}}` - Fechas
- `{{roomName}}` - Nombre del apartamento
- `{{totalCharges}}` / `{{balance}}` - Montos
- `{{invoiceItems}}` - Array de items
- `{{companyInfo.*}}` - Datos de la empresa

## ⚙️ **Configuración Técnica**

### **Puppeteer Config:**
```javascript
{
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  format: 'A4',
  printBackground: true,
  margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
}
```

### **Información de Empresa (Hard-coded):**
```javascript
{
  name: 'TE ALQUILAMOS S.A.S',
  nit: '900.890.457',
  address: 'Cartagena, Bolívar - Barrio Laguito, Edificio Nuevo Conquistador, Oficina 1706',
  phone: '302-3371476',
  whatsapp: '+57 302 337 1476',
  email: 'reservas@pacartagena.com',
  website: 'www.pacartagena.com'
}
```

## 🔍 **Logs y Debugging**

El sistema incluye logging detallado:
- ✅ **Inicio:** `Iniciando generación PDF para reserva: BOOK-123`
- ✅ **Éxito:** `PDF generado exitosamente en 1247ms`
- ✅ **Error:** `Error generando PDF: Template no encontrado`
- ✅ **Métricas:** Tamaño del PDF, tiempo de generación

## 📦 **Dependencias**
```json
{
  "puppeteer": "^21.0.0",
  "fs": "built-in",
  "path": "built-in"
}
```

## ⚠️ **Consideraciones**
- Template debe existir en `templates/invoice-template.html`
- Puppeteer requiere ~300MB de descarga inicial
- PDFs se guardan en `temp/pdfs/` si `saveToFile=true`
- Timeout configurado a 30 segundos
- Tamaño promedio: 150-300KB por PDF

## 🚀 **¡Sistema Listo para Producción!**
- ✅ Sin dependencias externas (N8N, APIs)
- ✅ Generación rápida (1-3 segundos)
- ✅ Template profesional optimizado
- ✅ Validaciones robustas
- ✅ Logging completo para debugging