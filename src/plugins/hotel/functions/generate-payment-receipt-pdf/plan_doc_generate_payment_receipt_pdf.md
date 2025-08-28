# Plan de Implementación: Generate Payment Receipt PDF

## 🎯 Objetivo
Implementar sistema de recibos específicos para pagos individuales, diferenciado de las confirmaciones completas de reserva.

## 📋 Propósito
- **Trigger**: Generar recibo específico cuando se registra un segundo pago o más
- **Diferenciación**: Distinto de la confirmación completa de reserva
- **Enfoque**: Solo el pago específico registrado más datos básicos de reserva

## 🔧 Parámetros Finales
- `bookingId` (requerido): ID de la reserva en Beds24
- `distribucion` (opcional): Descripción de camas (heredado por compatibilidad)
- **CAMBIO**: Eliminado `paymentIndex` - Auto-detecta último pago para simplificar

## 🏗️ Arquitectura Optimizada
```
Cliente → OpenAI → edit_booking (detecta 2+ pagos) → generate_payment_receipt_pdf → PDF Recibo
                            ↓ (1er pago)
                   generate_booking_confirmation_pdf → PDF Confirmación
```

## ✅ Estado Actual
🚀 **ESTRUCTURA CREADA - LISTO PARA IMPLEMENTACIÓN** 🚀

## 📝 TODO Actualizado
- [x] Crear estructura de archivos y carpetas
- [x] Definir interfaces y schema base
- [ ] **SIGUIENTE**: Implementar lógica principal (clonar + modificar)
- [ ] Crear template HTML completo (simplificado vs confirmación)
- [ ] Modificar edit-booking para detección condicional
- [ ] Integrar al sistema de plugins hotel
- [ ] Testing con datos reales


## 🧠 Análisis Arquitectural

### ✅ **Validación del Plan**
El plan es **sólido y bien estructurado**, reutiliza la arquitectura existente de `generate-booking-confirmation-pdf` para minimizar código duplicado, mejorando mantenibilidad y escalabilidad. Mantiene enfoque en datos reales de Beds24 API, evitando alucinaciones de OpenAI.

### 🎯 **Ventajas Identificadas**
- **Detección automática** de pagos múltiples en edit-booking → sugerencias contextuales
- **Separación de responsabilidades**: Recibo ≠ Confirmación completa
- **Auto-detección último pago** → Simplifica llamadas OpenAI, reduce errores
- **Flujo más autónomo** sin requerir paymentIndex manual

### 📊 **Análisis del Flujo Actual**

#### **edit-booking.ts** (Líneas clave: ~149-186)
- ✅ Registra pagos como `invoiceItems` tipo `'payment'`  
- ⚠️ **FALTANTE**: Siempre sugiere `generate_booking_confirmation_pdf`, sin detectar "segundo pago+"
- 🔧 **Integración**: Antes de `bookingUpdateData` (línea ~149) → contar `existingPayments`
- 🔧 **Respuesta**: En `formattedMessage` (línea ~186) → condicional para nueva función si `existingPayments >= 1`

#### **generate-booking-confirmation-pdf.ts** (Base para clonar)
- ✅ **Excelente arquitectura**: `fetchBookingByIdFromBeds24` + `transformBookingDetailsToPDFData` + `getPDFService`
- ✅ **Separación de pagos** (línea ~348-358): `paymentItems` ya filtrados
- 🔄 **Para nueva función**: Filtrar solo último `paymentItem` + `documentType: 'RECIBO DE PAGO'`
- ✅ **Attachment system** reutilizable para envío automático

### ⚡ **Mejoras de Escalabilidad**
- **Anti-duplicados**: `checkExistingPDF` con patrón `'receipt-[bookingId]-[timestamp].pdf'`
- **Singleton PDF Service**: Ya optimizado para concurrency, sin cambios necesarios
- **Template dinámico**: Cargar `receipt-template.html` vs `invoice-template.html` según `documentType`

---

## 🚀 Plan Detallado Paso a Paso - Implementación Simple y Perfecta

**Estrategia**: Cambios mínimos → Clona funciones existentes + condicionales puntuales + reutiliza servicios  
**Tiempo estimado**: 1-2 horas | **Complejidad**: Baja | **Riesgo**: Mínimo

### 🗂️ Estructura Actual (✅ COMPLETADA)
```
src/plugins/hotel/functions/generate-payment-receipt-pdf/
├── generate-payment-receipt-pdf.ts    # Función principal (skeleton)
├── plan_doc_generate_payment_receipt_pdf.md  # Este documento
├── schema.json                        # Validación OpenAI
├── config/receipt-config.json         # Configuración PDF
├── services/receipt-processor.service.ts  # Procesador específico
└── templates/receipt-template.html    # Template HTML (básico)
```

### 📋 Pasos de Implementación

#### **1. 🔄 Implementar Lógica Principal (SIGUIENTE)**
- **Acción**: Clonar `generate-booking-confirmation-pdf.ts` → adaptar para recibos
- **Cambios clave**:
  ```typescript
  // Parámetros simplificados  
  interface GeneratePaymentReceiptPDFParams { 
    bookingId: string; 
    distribucion?: string; 
  }
  
  // En transformBookingDetailsToPDFData (línea ~295)
  const paymentItems = (bookingData.invoiceItems || [])
    .filter((item: any) => item.type === 'payment')
    .slice(-1); // Solo último pago
  const lastPayment = paymentItems[0] || {};
  
  // En finalPdfData (línea ~390)
  documentType: 'RECIBO DE PAGO',
  paymentDescription: lastPayment.description || '',
  paymentItems: [lastPayment]  // Solo último pago
  
  // En checkExistingPDF
  const pdfPattern = new RegExp(`receipt-${bookingId}-\\d+\\.pdf$`);
  
  // En respuesta (línea ~576)
  message: `Recibo de pago generado para reserva ${params.bookingId}. 
           Indícale al huésped que verifique el pago registrado.`
  ```

#### **2. 🎨 Crear Template HTML Simplificado**
- **Acción**: Copiar `invoice-template.html` → simplificar para recibos
- **Cambios clave**:
  ```html
  <!-- Header principal -->
  <h1>RECIBO DE PAGO</h1>
  
  <!-- Datos básicos (reutilizar) -->
  <div class="booking-info">
    {{guestName}} | Reserva: {{bookingId}} | {{checkInDate}} - {{checkOutDate}}
  </div>
  
  <!-- FOCO: Solo el pago específico -->
  <div class="payment-section">
    <h2>Pago Registrado</h2>
    <table>
      <tr><th>Descripción</th><td>{{paymentItems.[0].description}}</td></tr>
      <tr><th>Monto</th><td>${{paymentItems.[0].formattedAmount}}</td></tr>
      <tr><th>Fecha</th><td>{{currentDate}}</td></tr>
    </table>
  </div>
  
  <!-- Resumen financiero -->
  <div class="financial-summary">
    <p><strong>Total Pagado:</strong> ${{totalPaid}}</p>
    <p><strong>Saldo Pendiente:</strong> ${{balance}}</p>
  </div>
  ```
- **Template Loading**: Modificar `pdf-generator.service.ts`:
  ```typescript
  const templateFile = documentType === 'RECIBO DE PAGO' 
    ? 'receipt-template.html' 
    : 'invoice-template.html';
  ```

#### **3. ⚡ Modificar edit-booking.ts - Detección Condicional**
- **Ubicación**: Líneas ~149 (antes de `bookingUpdateData`) y ~186 (`formattedMessage`)
- **Cambios mínimos**:
  ```typescript
  // AÑADIR en línea ~149 (antes de bookingUpdateData)
  const existingPayments = existingBooking.invoiceItems?.filter((item: any) => 
    item.type === 'payment'
  ).length || 0;
  const isSecondPaymentOrMore = existingPayments >= 1;
  
  // MODIFICAR en línea ~186 (sugerencia condicional)
  const suggestion = isSecondPaymentOrMore 
    ? '🔔 **Sugerencia:** Procede a llamar `generate_payment_receipt_pdf` para generar recibo de este pago específico.'
    : '🔔 **Sugerencia:** Procede a llamar `generate_booking_confirmation_pdf` para generar confirmación actualizada.';
  
  // Reemplazar línea existente con: ${suggestion}
  ```
- **Impacto**: Cero cambios en flujo original, solo añade lógica condicional

#### **4. 🔗 Integrar al Sistema de Plugins**
- **Archivo**: `src/plugins/hotel/index.ts`
- **Cambios**:
  ```typescript
  // Import nueva función
  import { generatePaymentReceiptPDFFunction } from './functions/generate-payment-receipt-pdf/generate-payment-receipt-pdf';
  
  // Añadir al array de funciones
  export const hotelFunctions = [
    // ... funciones existentes,
    generatePaymentReceiptPDFFunction
  ];
  ```

#### **5. ✅ Validación y Testing**
- **Flujo 1**: `edit-booking` + primer pago → verificar sugerencia `confirmation_pdf`
- **Flujo 2**: `edit-booking` + segundo pago → verificar sugerencia `receipt_pdf`  
- **Flujo 3**: Llamar `generate_payment_receipt_pdf({bookingId})` → verificar PDF generado
- **Logs**: Buscar `'PAYMENTS PROCESADOS'` para confirmar solo 1 `paymentItem`
- **Fallback**: Verificar `fetchBookingByIdFromBeds24` reutilizado correctamente

#### **6. 🚀 Deploy y Monitoreo**
- **Pre-deploy**: Testing local completo + validación PDF attachment
- **Deploy**: Commit cambios → Railway deployment
- **Monitoreo**: Logs `'EDIT_BOOKING'` y `'GENERATE_PAYMENT_RECEIPT_PDF'`
- **Escalabilidad**: Validar singleton PDF service bajo carga (ya optimizado)

---

## ✨ Resultado Esperado

**Para OpenAI Assistant:**
- 1er pago → `generate_booking_confirmation_pdf` (confirmación completa)
- 2+ pago → `generate_payment_receipt_pdf` (recibo específico)

**Para Huéspedes:**
- Recibo enfocado solo en el pago reciente registrado
- PDF limpio sin información innecesaria de confirmación completa
- Envío automático vía WhatsApp (attachment system reutilizado)