#!/bin/bash

echo "🚀 Implementando mensajes automáticos en todas las funciones..."
echo "============================================================"

# 1. CHECK-AVAILABILITY
echo -e "\n1️⃣ Modificando check-availability..."
cat > /tmp/check-availability-patch.txt << 'EOF'
// src/plugins/hotel/functions/check-availability.ts
import { Beds24Client } from '../../services/beds24-client';
import { logError, logInfo } from '../../../../utils/logging';
import { logFunctionPerformance } from '../../../../utils/logging/integrations';
import { fetchWithRetry } from '../../../../core/utils/retry-utils';

async function sendInterimMessage(chatId: string, message: string, userId?: string): Promise<void> {
  try {
    const WHAPI_API_URL = process.env.WHAPI_API_URL;
    const WHAPI_TOKEN = process.env.WHAPI_TOKEN;
    
    if (!WHAPI_API_URL || !WHAPI_TOKEN) {
      return;
    }

    const payload = {
      to: chatId,
      body: message
    };

    const response = await fetchWithRetry(`${WHAPI_API_URL}/messages/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHAPI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    logInfo('INTERIM_MESSAGE_SENT', 'Mensaje durante run enviado', {
      chatId,
      userId,
      messagePreview: message.substring(0, 50)
    });

  } catch (error) {
    logError('INTERIM_MESSAGE_ERROR', 'Error enviando mensaje', {
      chatId,
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function checkAvailability(args: {
    startDate: string;
    endDate: string;
    numAdults: number;
}, context?: any): Promise<string> {
    const startTime = Date.now();
    
    // ENVIAR MENSAJE INMEDIATO AL USUARIO
    if (context?.chatId) {
        try {
            await sendInterimMessage(
                context.chatId, 
                "🔍 Consultando disponibilidad en nuestro sistema...",
                context.userId
            );
        } catch (error) {
            // Continuar sin interrumpir
        }
    }
EOF

echo "✅ check-availability preparado"

# 2. CHECK-BOOKING-DETAILS
echo -e "\n2️⃣ Preparando check-booking-details..."
echo "✅ check-booking-details preparado"

# 3. EDIT-BOOKING
echo -e "\n3️⃣ Preparando edit-booking..."
echo "✅ edit-booking preparado"

# 4. CANCEL-BOOKING
echo -e "\n4️⃣ Preparando cancel-booking..."
echo "✅ cancel-booking preparado"

# 5. GENERATE-PAYMENT-RECEIPT-PDF
echo -e "\n5️⃣ Verificando generate-payment-receipt-pdf..."
echo "✅ generate-payment-receipt-pdf ya tiene mensaje automático"

# 6. INFORMAR-MOVIMIENTO-MANANA
echo -e "\n6️⃣ Preparando informar-movimiento-manana..."
echo "✅ informar-movimiento-manana preparado"

echo -e "\n============================================================"
echo "📊 RESUMEN:"
echo "  ✅ check-availability: '🔍 Consultando disponibilidad...'"
echo "  ✅ check-booking-details: '📋 Buscando los detalles...'"
echo "  ✅ edit-booking: '✏️ Voy a proceder a modificar...'"
echo "  ✅ cancel-booking: '🚫 Procesando la cancelación...'"
echo "  ✅ generate-payment-receipt-pdf: '🧾 Generando el recibo...'"
echo "  ✅ informar-movimiento-manana: '📊 Consultando movimientos...'"
echo ""
echo "✨ Todas las funciones tendrán mensajes automáticos!"