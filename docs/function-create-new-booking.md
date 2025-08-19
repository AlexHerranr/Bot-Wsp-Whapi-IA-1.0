# FUNCIÓN CREATE_NEW_BOOKING - Documentación Técnica

## INFORMACIÓN GENERAL

**Nombre de la función:** `create_new_booking`  
**Estado:** 🔄 Pendiente por configurar  
**Propósito:** Crear una nueva reserva en el sistema con todos los datos del huésped y detalles de la estadía  
**Uso principal:** Conversión de consulta a reserva confirmada Pa'Cartagena 🏖️

---

## ESPECIFICACIÓN JSON SCHEMA PROPUESTA

```json
{
  "name": "create_new_booking",
  "description": "Crea una nueva reserva en el sistema con todos los detalles del huésped y estadía. Usar solo cuando el cliente confirma su intención de reservar.",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "stay": {
        "type": "object",
        "properties": {
          "checkIn": {
            "type": "string",
            "description": "Fecha de entrada en formato YYYY-MM-DD",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "checkOut": {
            "type": "string", 
            "description": "Fecha de salida en formato YYYY-MM-DD",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "numberOfGuests": {
            "type": "integer",
            "description": "Número total de huéspedes (niños 5+ = adultos)",
            "minimum": 1,
            "maximum": 12
          },
          "apartmentNumber": {
            "type": "string",
            "description": "Número del apartamento seleccionado",
            "enum": ["715", "1317", "1722A", "1722B", "1820", "2005A", "2005B"]
          }
        },
        "required": ["checkIn", "checkOut", "numberOfGuests", "apartmentNumber"],
        "additionalProperties": false
      },
      "guest": {
        "type": "object",
        "properties": {
          "fullName": {
            "type": "string",
            "description": "Nombre completo del titular de la reserva",
            "minLength": 2,
            "maxLength": 100
          },
          "phoneNumber": {
            "type": "string",
            "description": "Número de teléfono (formato internacional)",
            "pattern": "^\\+57[0-9]{10}$"
          },
          "email": {
            "type": "string",
            "description": "Correo electrónico del huésped",
            "format": "email"
          },
          "documentType": {
            "type": "string",
            "description": "Tipo de documento de identidad",
            "enum": ["cedula", "passport", "cedula_extranjeria"]
          },
          "documentNumber": {
            "type": "string",
            "description": "Número del documento de identidad",
            "minLength": 5,
            "maxLength": 20
          },
          "nationality": {
            "type": "string",
            "description": "Nacionalidad del huésped (código país ISO)",
            "pattern": "^[A-Z]{2}$"
          }
        },
        "required": ["fullName", "phoneNumber", "email"],
        "additionalProperties": false
      },
      "booking": {
        "type": "object",
        "properties": {
          "platform": {
            "type": "string",
            "description": "Canal de reserva",
            "enum": ["direct", "whatsapp"]
          },
          "totalAmount": {
            "type": "integer",
            "description": "Monto total de la reserva en pesos colombianos",
            "minimum": 50000
          },
          "advancePayment": {
            "type": "integer",
            "description": "Anticipo recibido en pesos colombianos",
            "minimum": 0
          },
          "specialRequests": {
            "type": "string",
            "description": "Solicitudes especiales del huésped",
            "maxLength": 500
          },
          "source": {
            "type": "string",
            "description": "Fuente de la reserva para tracking",
            "enum": ["whatsapp_bot", "phone_call", "walk_in", "referral"]
          }
        },
        "required": ["platform", "totalAmount", "source"],
        "additionalProperties": false
      }
    },
    "required": ["stay", "guest", "booking"],
    "additionalProperties": false
  }
}
```

---

## PARÁMETROS DETALLADOS

### Objeto stay (Detalles de la estadía)

#### checkIn
- **Tipo:** String
- **Formato:** YYYY-MM-DD
- **Ejemplo:** "2024-03-15"
- **Validación:** Debe ser fecha futura

#### checkOut  
- **Tipo:** String
- **Formato:** YYYY-MM-DD
- **Ejemplo:** "2024-03-18"
- **Validación:** Debe ser posterior a checkIn

#### numberOfGuests
- **Tipo:** Integer
- **Rango:** 1-12 personas
- **Ejemplo:** 4
- **Nota:** Incluye niños de 5+ años como adultos

#### apartmentNumber
- **Tipo:** String
- **Valores válidos:** 715, 1317, 1722A, 1722B, 1820, 2005A, 2005B
- **Ejemplo:** "1722A"
- **Validación:** Debe corresponder a apartamento disponible

### Objeto guest (Datos del huésped)

#### fullName
- **Tipo:** String
- **Longitud:** 2-100 caracteres
- **Ejemplo:** "Juan Carlos Pérez García"
- **Formato:** Nombre completo como aparece en documento

#### phoneNumber
- **Tipo:** String
- **Formato:** +57XXXXXXXXXX
- **Ejemplo:** "+573023371476"
- **Validación:** Número colombiano válido

#### email
- **Tipo:** String
- **Formato:** email válido
- **Ejemplo:** "juan.perez@email.com"
- **Uso:** Confirmación de reserva e instrucciones

#### documentType (Opcional)
- **Valores:** cedula, passport, cedula_extranjeria
- **Default:** cedula (colombianos)

#### documentNumber (Opcional)
- **Tipo:** String  
- **Longitud:** 5-20 caracteres
- **Ejemplo:** "12345678" / "AB123456"

#### nationality (Opcional)
- **Formato:** Código país ISO (2 letras)
- **Ejemplo:** "CO", "US", "BR"
- **Default:** "CO"

### Objeto booking (Detalles comerciales)

#### platform
- **Valores:** direct, whatsapp
- **Uso:** Para reservas por asistente siempre "whatsapp"

#### totalAmount
- **Tipo:** Integer
- **Unidad:** Pesos colombianos
- **Ejemplo:** 1005000
- **Incluye:** Alojamiento + extras + impuestos

#### advancePayment
- **Tipo:** Integer
- **Unidad:** Pesos colombianos  
- **Ejemplo:** 300000
- **Nota:** 0 si no ha pagado anticipo aún

#### specialRequests (Opcional)
- **Tipo:** String
- **Ejemplo:** "Llegada después de las 10 PM"
- **Uso:** Early check-in, late check-out, etc.

#### source
- **Valores:** whatsapp_bot, phone_call, walk_in, referral
- **Para bot:** Siempre "whatsapp_bot"

---

## CASOS DE USO

### Caso 1: Reserva Directa Estándar
```javascript
create_new_booking({
  "stay": {
    "checkIn": "2024-03-15",
    "checkOut": "2024-03-18", 
    "numberOfGuests": 4,
    "apartmentNumber": "1722A"
  },
  "guest": {
    "fullName": "Ana María González",
    "phoneNumber": "+573001234567",
    "email": "ana.gonzalez@email.com"
  },
  "booking": {
    "platform": "whatsapp",
    "totalAmount": 1005000,
    "advancePayment": 300000,
    "source": "whatsapp_bot"
  }
})
```

### Caso 2: Reserva con Solicitudes Especiales
```javascript
create_new_booking({
  "stay": {
    "checkIn": "2024-07-20",
    "checkOut": "2024-07-25",
    "numberOfGuests": 2, 
    "apartmentNumber": "2005B"
  },
  "guest": {
    "fullName": "Carlos Rodríguez",
    "phoneNumber": "+573009876543",
    "email": "carlos@email.com",
    "documentType": "cedula",
    "documentNumber": "12345678",
    "nationality": "CO"
  },
  "booking": {
    "platform": "whatsapp", 
    "totalAmount": 850000,
    "advancePayment": 0,
    "specialRequests": "Early check-in 9:00 AM - confirmado por supervisor",
    "source": "whatsapp_bot"
  }
})
```

### Caso 3: Huésped Internacional
```javascript
create_new_booking({
  "stay": {
    "checkIn": "2024-12-24",
    "checkOut": "2024-12-28",
    "numberOfGuests": 6,
    "apartmentNumber": "1820"
  },
  "guest": {
    "fullName": "Michael Johnson", 
    "phoneNumber": "+573147896325",
    "email": "m.johnson@email.com",
    "documentType": "passport",
    "documentNumber": "AB1234567",
    "nationality": "US"
  },
  "booking": {
    "platform": "whatsapp",
    "totalAmount": 1500000,
    "advancePayment": 500000,
    "source": "whatsapp_bot"
  }
})
```

---

## RESPUESTA ESPERADA

### Respuesta exitosa:
```json
{
  "success": true,
  "booking": {
    "reference": "PCG-2024-001234",
    "status": "confirmed",
    "created": "2024-02-15T14:30:00Z",
    "guest": {
      "name": "Ana María González",
      "phone": "+573001234567", 
      "email": "ana.gonzalez@email.com"
    },
    "stay": {
      "checkIn": "2024-03-15",
      "checkOut": "2024-03-18",
      "nights": 3,
      "apartment": "1722A",
      "guests": 4
    },
    "payment": {
      "total": 1005000,
      "advance": 300000,
      "pending": 705000,
      "status": "advance_received"
    },
    "instructions": {
      "email_sent": true,
      "checkin_details": "Se enviaron por email las instrucciones completas"
    }
  }
}
```

### Respuesta de error:
```json
{
  "success": false,
  "error": "apartment_not_available",
  "message": "El apartamento 1722A no está disponible para las fechas seleccionadas",
  "suggestions": ["1820", "2005A"]
}
```

---

## FLUJO DE TRABAJO COMPLETO

### 1. Pre-requisitos (Ya completados)
- Cliente consultó disponibilidad con `check_availability`
- Cliente seleccionó apartamento específico
- Cliente confirmó fechas y número de personas
- Se discutieron precios y condiciones

### 2. Confirmación Final
```
Cliente: "Ok, quiero reservar el apartamento 1722A"
Asistente: "¡Perfecto! Para confirmar tu reserva necesito 
algunos datos adicionales..."
```

### 3. Recolección de Datos del Huésped
```
Asistente: "Me confirmas:
- Tu nombre completo como aparece en tu cédula
- Tu correo electrónico para enviarte las instrucciones
- ¿El teléfono +573001234567 está correcto?"
```

### 4. Confirmación de Detalles Comerciales
```
Asistente: "Resumen de tu reserva:
- Apartamento 1722A del 15 al 18 de marzo
- 4 personas, 3 noches  
- Total: $1.005.000
- Anticipo: $300.000 (1 noche)
- Saldo al llegar: $705.000

¿Todo correcto para proceder?"
```

### 5. Creación de la Reserva
```javascript
create_new_booking({...})
```

### 6. Confirmación al Cliente
```
"¡Excelente Ana María! 🎉

Tu reserva ha sido confirmada:
Código: PCG-2024-001234

Te envié las instrucciones detalladas a ana.gonzalez@email.com

Para completar, necesitas transferir el anticipo de $300.000

¿Te envío los datos para el pago?"
```

---

## VALIDACIONES Y REGLAS DE NEGOCIO

### Validaciones previas obligatorias:
- [ ] **Disponibilidad confirmada:** Apartamento libre para las fechas
- [ ] **Datos completos:** Información mínima requerida del huésped
- [ ] **Precios actuales:** Montos basados en última consulta API
- [ ] **Cliente confirmó:** Intención explícita de reservar

### Validaciones del sistema:
- [ ] **Fechas válidas:** checkIn < checkOut, ambas futuras
- [ ] **Capacidad:** numberOfGuests compatible con apartamento
- [ ] **Formato datos:** Email, teléfono, fechas correctos
- [ ] **Unicidad:** No duplicar reservas para mismas fechas/apartamento

### Reglas de negocio críticas:

#### Anticipos requeridos:
- **Reserva directa:** Siempre requiere anticipo
- **Monto mínimo:** Valor de 1 noche
- **Sin anticipo:** `advancePayment: 0` pero debe pagarse antes de check-in

#### Apartamentos por capacidad:
- **Estudios (1722B, 2005B):** Máx 4 personas + 1 sobrecupo
- **1 Alcoba (resto):** Máx 6 personas + 1 sobrecupo
- **Sobrecupo:** +$70.000/noche por persona extra

#### Plataforma y fuente:
- **Bot de WhatsApp:** platform: "whatsapp", source: "whatsapp_bot"
- **Tracking:** Importante para métricas de conversión

---

## INTEGRACIÓN CON FLUJO ACTUAL

### Secuencia típica:
1. **check_availability** → Cliente ve opciones
2. Cliente elige apartamento → Enviar fotos
3. Cliente dice "quiero reservar" → **create_new_booking**
4. Sistema genera código → Proceso de pago
5. (Futuro) **check_booking_details** → Seguimiento

### Datos que fluyen entre funciones:
- Fechas y personas: check_availability → create_new_booking
- Apartamento seleccionado: Fotos → create_new_booking  
- Precios exactos: check_availability → create_new_booking
- Código generado: create_new_booking → Proceso pago

---

## MANEJO DE ERRORES

### apartment_not_available
```
"El apartamento 1722A ya no está disponible para esas fechas.
Te tengo estas alternativas:
- Apartamento 1820: Mismo precio, piso 18
- Apartamento 2005A: +$50.000, piso 20 con mejor vista

¿Cuál te interesa?"
```

### invalid_guest_data
```
"Hay un problema con los datos proporcionados.
¿Puedes verificar tu email y teléfono?"
```

### payment_processing_error
```
"Tu reserva está creada (PCG-2024-001234) pero hubo 
un problema procesando el pago.

Permíteme consultar con mi supervisor para resolver 
esto inmediatamente."
```

### system_error
```
"Hubo un problema técnico creando tu reserva.
Todos tus datos están seguros.

Permíteme intentar nuevamente o mi supervisor 
te contactará en 5 minutos."
```

---

## NOTIFICACIONES Y SEGUIMIENTO

### Email automático al huésped:
```
Asunto: ✅ Reserva Confirmada PCG-2024-001234 - Pa'Cartagena

Hola Ana María,

¡Tu reserva está confirmada! 🎉

DETALLES DE TU RESERVA:
- Código: PCG-2024-001234
- Apartamento: 1722A (Piso 17)
- Fechas: 15 al 18 de marzo (3 noches)
- Huéspedes: 4 personas
- Total: $1.005.000

INSTRUCCIONES DE LLEGADA:
[Detalles completos de ubicación y acceso]

SALDO PENDIENTE: $705.000
[Instrucciones de pago]

¿Preguntas? WhatsApp: +57 302 337 1476
```

### Notificaciones internas:
- **Slack/Teams:** Nueva reserva creada
- **Dashboard:** Actualización de métricas
- **Calendario:** Bloqueo automático de fechas
- **Contabilidad:** Registro de anticipo pendiente

---

## CONSIDERACIONES TÉCNICAS

### Base de datos:
- **Tabla reservations:** Información principal
- **Tabla guests:** Datos del huésped (GDPR compliant)
- **Tabla payments:** Tracking de pagos y anticipos
- **Tabla apartment_availability:** Actualización automática

### Integración con sistemas:
- **Sistema de pagos:** Para tracking de anticipos
- **Email service:** Envío automático de confirmaciones
- **Calendar system:** Bloqueo de disponibilidad
- **Reporting:** Métricas de conversión y revenue

### Seguridad:
- **Datos sensibles:** Encriptar documento y teléfono
- **Logs de auditoría:** Quién crea qué reserva y cuándo
- **Validación de duplicados:** Prevenir reservas dobles
- **Backup automático:** Información crítica protegida

---

## TESTING Y VALIDACIÓN

### Casos de prueba críticos:
1. **Happy path:** Reserva estándar exitosa
2. **Apartamento no disponible:** Error y alternativas
3. **Datos inválidos:** Validación y corrección
4. **Capacidad excedida:** Manejo de sobrecupo
5. **Email/teléfono duplicado:** Verificación de identidad

### Datos de prueba:
```javascript
// Apartamento siempre disponible para testing
"apartmentNumber": "TEST-001"

// Email de prueba
"email": "test@pacartagena.com"

// Teléfono de prueba  
"phoneNumber": "+573009999999"
```

### Validación post-creación:
- [ ] Código de reserva generado correctamente
- [ ] Email enviado al huésped
- [ ] Apartamento bloqueado en calendario
- [ ] Notificaciones internas enviadas
- [ ] Métricas actualizadas

---

## MÉTRICAS Y KPIs

### Métricas de conversión:
- **check_availability → create_new_booking:** % de conversión
- **Tiempo promedio:** Entre consulta y creación de reserva
- **Apartamentos más reservados:** Por período
- **Revenue generado:** Por canal (WhatsApp bot vs otros)

### Métricas operativas:
- **Tiempo de respuesta:** < 3 segundos para crear reserva
- **Tasa de error:** < 2% de reservas fallidas
- **Emails entregados:** > 98% de confirmaciones enviadas
- **Datos completos:** % de reservas con toda la información

### Alertas críticas:
- **Disponibilidad inconsistente:** Apartamento reservado pero marcado disponible
- **Emails fallando:** Sistema de confirmación caído
- **Duplicados detectados:** Posibles reservas dobles
- **Error rate alto:** > 5% de fallas en período

---

## ROADMAP Y VERSIONES

### V1.0 (MVP):
- [ ] Creación básica de reserva
- [ ] Validaciones esenciales  
- [ ] Email de confirmación
- [ ] Integración con disponibilidad

### V1.1 (Mejoras):
- [ ] Solicitudes especiales
- [ ] Múltiples formas de pago
- [ ] Reservas grupales (múltiples apartamentos)
- [ ] Early/late check-in automático

### V1.2 (Avanzado):
- [ ] Integración con Booking.com/Airbnb
- [ ] Check-in digital
- [ ] Modificación de reservas
- [ ] Programa de fidelidad

### V2.0 (Futuro):
- [ ] IA para optimización de precios
- [ ] Recomendaciones personalizadas
- [ ] Sistema de reviews automático
- [ ] Blockchain para contratos inteligentes

---

## CONFIGURACIÓN REQUERIDA

### Variables de entorno:
```
BOOKING_DATABASE_URL=postgresql://...
EMAIL_SERVICE_API_KEY=sendgrid_key_here
CALENDAR_SYNC_URL=calendar_api_url
PAYMENT_WEBHOOK_SECRET=payment_secret
SLACK_WEBHOOK_URL=slack_notifications
```

### Servicios externos:
- **SendGrid/Mailgun:** Email de confirmaciones
- **Twilio:** SMS de backup (opcional)
- **Stripe/PayU:** Procesamiento de pagos
- **Google Calendar:** Sincronización de disponibilidad

---

## CHECKLIST PRE-IMPLEMENTACIÓN

### Desarrollo:
- [ ] Base de datos diseñada y migrada
- [ ] APIs de integración configuradas
- [ ] Templates de email creados
- [ ] Sistema de logs implementado
- [ ] Tests unitarios y de integración

### Negocio:
- [ ] Flujo de trabajo definido con equipo
- [ ] Templates de respuesta actualizados
- [ ] Políticas de cancelación configuradas
- [ ] Proceso de escalación definido
- [ ] Training del equipo completado

### Infraestructura:
- [ ] Monitoreo y alertas configurados
- [ ] Backup automático funcionando
- [ ] Load balancing si es necesario
- [ ] Security audit completado
- [ ] Disaster recovery plan

---

## NOTAS IMPORTANTES

⚠️ **CRÍTICO:**
- Esta función crea compromisos financieros y legales
- Validar exhaustivamente antes de cualquier despliegue
- Tener plan de rollback preparado
- Coordinar con equipo legal para términos y condiciones

✅ **SUCCESS CRITERIA:**
- 95%+ de reservas creadas exitosamente
- 0 duplicados o conflictos de disponibilidad  
- 100% de confirmaciones enviadas
- < 5 minutos promedio desde consulta hasta reserva confirmada

🚀 **IMPACTO ESPERADO:**
- Automatización completa del proceso de reserva
- Reducción de errores manuales
- Mejora en experiencia del cliente
- Incremento en tasa de conversión de consultas

---

**Estado:** 🔄 Pendiente implementación  
**Prioridad:** CRÍTICA - Función clave del negocio  
**Estimación:** 3-4 sprints de desarrollo  
**Dependencias:** check_availability funcionando, base de datos, servicios de email
