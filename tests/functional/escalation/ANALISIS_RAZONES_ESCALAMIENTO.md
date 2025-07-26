# 📊 ANÁLISIS COMPLETO DE RAZONES DE ESCALAMIENTO

## 🎯 **RAZONES IDENTIFICADAS EN EL RAG**

### **🔥 ALTA PRIORIDAD (Inmediatas)**

#### **💰 Reservas y Pagos**
- `complete_booking` - Cliente listo para completar reserva
- `payment_received` - Cliente envió comprobante de pago
- `booking_modification` - Modificación de reserva existente
- `cancellation_request` - Solicitud de cancelación

#### **⚠️ Atención al Cliente**
- `complaint` - Queja o reclamo del cliente
- `emergency` - Situación de emergencia
- `billing_dispute` - Disputa de facturación

#### **🏠 Operaciones Críticas**
- `late_arrival` - Llegada nocturna/tardía (después 8 PM)
- `special_access` - Llegada madrugada (requiere coordinación especial)
- `extreme_arrival` - Llegada muy tardía (requiere escalamiento inmediato)

---

### **🟡 PRIORIDAD MEDIA**

#### **📅 Coordinación Operativa**
- `early_checkin` - Check-in temprano (antes 3 PM)
- `late_checkout` - Check-out tardío (después 11 AM)
- `special_coordination` - Coordinación especial requerida

#### **🏢 Disponibilidad**
- `no_availability` - Sin disponibilidad en inventario
- `pricing_complex_case` - Caso de precios complejo
- `external_apartment_photos` - Fotos de apartamentos externos

#### **👥 Grupos**
- `large_group` - Grupos grandes (8+ apartamentos)
- `group_checkin_coordination` - Coordinación check-in grupal

---

### **🔧 PRIORIDAD BAJA**

#### **🛠️ Técnico**
- `technical_issue` - Problemas técnicos del bot
- `building_authorization` - Autorización de edificio

#### **🤝 B2B**
- `b2b_complex` - Casos B2B complejos
- `verification_request` - Solicitudes de verificación

#### **🎯 Servicios Especiales**
- `special_service_request` - Solicitudes de servicios especiales
- `complex_request` - Solicitudes complejas generales

---

## 🔄 **MAPEO ACTUAL vs RAG**

### **✅ YA CONFIGURADAS**
```typescript
'complete_booking'     → RESERVAS_PRINCIPAL (HIGH)
'payment_received'     → RESERVAS_PRINCIPAL (HIGH)
'late_arrival'         → OPERACIONES (MEDIUM)
'no_availability'      → RESERVAS_PRINCIPAL (MEDIUM)
'complaint'            → ATENCION_CLIENTE (HIGH)
'technical_issue'      → SOPORTE_TECNICO (LOW)
'emergency'            → GRUPO_URGENCIAS (URGENT)
'large_group'          → GRUPO_OPERACIONES (MEDIUM)
```

### **❌ FALTANTES POR AGREGAR**
```typescript
'booking_modification'
'cancellation_request'
'billing_dispute'
'special_access'
'extreme_arrival'
'early_checkin'
'late_checkout'
'special_coordination'
'pricing_complex_case'
'external_apartment_photos'
'group_checkin_coordination'
'building_authorization'
'b2b_complex'
'verification_request'
'special_service_request'
'complex_request'
```

---

## 🎯 **CONTEXTOS ESPECÍFICOS POR RAZÓN**

### **Llegadas Especiales**
```typescript
context: {
  booking_info: { apartment, dates, guests },
  arrival_time: "21:00",
  type: "nocturna" | "madrugada" | "extrema"
}
```

### **Grupos Grandes**
```typescript
context: {
  total_apartments: 8,
  group_size: 25,
  checkin_coordination: true,
  dates: { start, end }
}
```

### **Pagos y Reservas**
```typescript
context: {
  payment_amount: 500000,
  booking_reference: "BK123",
  apartment_info: { id, type, price }
}
```

---

## 📋 **RECOMENDACIONES DE IMPLEMENTACIÓN**

### **Fase 1: Críticas (Implementar YA)**
1. `booking_modification`
2. `cancellation_request`
3. `billing_dispute`
4. `special_access`
5. `extreme_arrival`

### **Fase 2: Operativas (Siguiente)**
1. `early_checkin`
2. `late_checkout`
3. `special_coordination`
4. `pricing_complex_case`
5. `group_checkin_coordination`

### **Fase 3: Complementarias (Después)**
1. `external_apartment_photos`
2. `building_authorization`
3. `b2b_complex`
4. `verification_request`
5. `special_service_request`
6. `complex_request`

---

## 🔍 **PATRONES IDENTIFICADOS**

### **Triggers Automáticos**
- **Horarios**: Llegadas después 8 PM → `late_arrival`
- **Cantidades**: 8+ apartamentos → `large_group`
- **Palabras clave**: "queja", "reclamo" → `complaint`
- **Contexto**: Comprobante de pago → `payment_received`

### **Urgencia por Horario**
- **Horario comercial (8 AM - 10 PM)**: Prioridad normal
- **Fuera de horario**: Prioridad alta
- **Madrugada (12 AM - 6 AM)**: Prioridad urgente

### **Destinatarios por Tipo**
- **Reservas/Pagos**: Contacto principal
- **Operaciones**: Coordinador operativo
- **Urgencias**: Grupo de urgencias
- **Técnico**: Soporte técnico 