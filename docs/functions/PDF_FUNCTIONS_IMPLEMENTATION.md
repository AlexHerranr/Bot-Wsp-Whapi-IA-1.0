# Implementación de Funciones de Generación de PDFs

## Problema Identificado

El bot intentaba ejecutar las funciones `generate_booking_confirmation_pdf` y `generate_payment_receipt_pdf` pero estas no existían en el código fuente, causando el error:

```
❌ Error en función generate_booking_confirmation_pdf: Función 'generate_booking_confirmation_pdf' no encontrada
```

## Causa del Problema

Las funciones de PDF estaban registradas en una versión anterior del código (posiblemente en un plugin de hotel) pero no existían en el código fuente actual (`src/`). Solo había referencias en los logs pero no implementación real.

## Solución Implementada

### 1. Creación de Funciones PDF

Se crearon dos nuevas funciones en `src/functions/pdf/`:

#### `generate-booking-confirmation.ts`
- Genera PDF de confirmación de reserva
- Acepta `bookingId` como parámetro principal
- Incluye contexto del usuario opcional
- Por ahora retorna respuesta simulada (placeholder)

#### `generate-payment-receipt.ts`
- Genera PDF de recibo de pago
- Acepta `bookingId` y `paymentId` opcional
- Incluye contexto del usuario opcional
- Por ahora retorna respuesta simulada (placeholder)

### 2. Registro de Funciones

Las funciones fueron agregadas al registro central en `src/functions/registry/function-registry.ts`:

```typescript
export const FUNCTION_REGISTRY: Record<string, FunctionDefinition> = {
  // ... otras funciones ...
  
  // Funciones de generación de PDFs
  generate_booking_confirmation_pdf: generateBookingConfirmationPDFFunction,
  generate_payment_receipt_pdf: generatePaymentReceiptPDFFunction,
  
  // ...
};
```

### 3. Estructura de Archivos

```
src/functions/
├── pdf/
│   ├── index.ts
│   ├── generate-booking-confirmation.ts
│   └── generate-payment-receipt.ts
├── registry/
│   └── function-registry.ts (actualizado)
└── index.ts (actualizado)
```

## Estado Actual

### ✅ Completado
- Funciones creadas y registradas
- Estructura de tipos correcta
- Sin errores de TypeScript
- Proyecto compilado exitosamente
- Funciones disponibles en `dist/`

### ⚠️ Pendiente de Implementación Completa

Las funciones actualmente retornan respuestas simuladas. Para completar la implementación real necesitarás:

1. **Integración con Beds24 API**
   - Obtener detalles reales de la reserva
   - Acceder a información de pagos

2. **Templates HTML**
   - Crear plantillas Handlebars para los PDFs
   - Diseñar layouts profesionales

3. **Generación Real de PDFs con Puppeteer**
   - Usar la configuración de Chromium ya preparada
   - Renderizar HTML a PDF
   - Manejar estilos y formatos

4. **Almacenamiento de PDFs**
   - Definir dónde guardar los PDFs (local/cloud)
   - Generar URLs accesibles
   - Gestionar limpieza de archivos temporales

5. **Envío por WhatsApp**
   - Integrar con WHAPI para enviar PDFs
   - Manejar attachments en las respuestas

## Ejemplo de Respuesta Actual

```json
{
  "success": true,
  "message": "PDF de confirmación generado exitosamente para la reserva 74793397",
  "bookingId": "74793397",
  "pdfUrl": "https://example.com/pdfs/booking-74793397.pdf",
  "details": {
    "fileName": "booking-confirmation-74793397.pdf",
    "generatedAt": "2025-08-29T04:30:00.000Z",
    "size": "245KB",
    "pages": 2
  }
}
```

## Pruebas

Para probar las funciones:

1. **Local**:
   ```bash
   npm run dev
   ```

2. **Verificar registro**:
   Las funciones deberían aparecer en los logs de inicio:
   ```
   ✅ generate_booking_confirmation_pdf registered
   ✅ generate_payment_receipt_pdf registered
   ```

3. **Llamada desde OpenAI**:
   El bot ahora puede ejecutar estas funciones sin error "función no encontrada"

## Próximos Pasos

1. **Implementar lógica real de generación de PDFs**
   - Conectar con Beds24 API
   - Crear templates HTML profesionales
   - Usar Puppeteer para generar PDFs reales

2. **Configurar almacenamiento**
   - Decidir si usar almacenamiento local o cloud (Google Cloud Storage)
   - Implementar URLs temporales o permanentes

3. **Integrar con WhatsApp**
   - Enviar PDFs como attachments
   - Manejar límites de tamaño de archivo

## Referencias

- [Puppeteer Documentation](https://pptr.dev/)
- [Handlebars Templates](https://handlebarsjs.com/)
- [Beds24 API Documentation](https://www.beds24.com/api/)
- Configuración de Chromium: `/docs/deployment/CHROMIUM_RAILWAY_FIX.md`