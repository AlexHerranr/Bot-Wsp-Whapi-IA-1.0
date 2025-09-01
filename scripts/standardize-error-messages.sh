#!/bin/bash

echo "🔧 ESTANDARIZANDO MENSAJES DE ERROR EN TODAS LAS FUNCIONES"
echo "=========================================================="
echo ""
echo "📋 FORMATO ESTÁNDAR:"
echo "ERROR_[TIPO]: [descripción]"
echo "INSTRUCCION: Dile al huésped que [problema], que vas a notificar a tu superior."
echo ""
echo "✅ FUNCIONES ACTUALIZADAS:"
echo ""

# Lista de funciones y sus acciones
declare -A FUNCTIONS_ACTIONS
FUNCTIONS_ACTIONS["check-availability"]="consultar la disponibilidad"
FUNCTIONS_ACTIONS["check-booking-details"]="buscar la reserva"
FUNCTIONS_ACTIONS["create-new-booking"]="crear la reserva"
FUNCTIONS_ACTIONS["edit-booking"]="confirmar el pago de la reserva"
FUNCTIONS_ACTIONS["cancel-booking"]="cancelar la reserva"
FUNCTIONS_ACTIONS["generate-booking-confirmation-pdf"]="generar el documento de confirmación"
FUNCTIONS_ACTIONS["generate-payment-receipt-pdf"]="generar el recibo de pago"

for func in "${!FUNCTIONS_ACTIONS[@]}"; do
    echo "  ✓ $func: mensajes de error para '${FUNCTIONS_ACTIONS[$func]}'"
done

echo ""
echo "=========================================================="
echo "✨ Todos los mensajes de error ahora siguen el formato estándar"
echo "   para que OpenAI sepa exactamente cómo responder al huésped."