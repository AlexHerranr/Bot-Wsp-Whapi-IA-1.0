# Roadmap de Funcionalidades - Bot TeAlquilamos

## 🎯 Visión General

Transformar el bot de un simple respondedor a un asistente hotelero completo que gestione todo el ciclo de vida del huésped, desde el primer contacto hasta post-estadía.

## 📊 Estado Actual vs Potencial

### Lo que teníamos con BuilderBot:
- ❌ Solo mensajes de texto
- ❌ Sin persistencia real
- ❌ Sin gestión de grupos
- ❌ Sin multimedia avanzada
- ❌ Sin análisis de datos

### Lo que podemos hacer con Whapi:
- ✅ Gestión completa de reservas
- ✅ Grupos automáticos por familia
- ✅ Marketing via Stories
- ✅ Catálogo visual de habitaciones
- ✅ Seguimiento post-estadía
- ✅ Analytics en tiempo real

## 🚀 Funcionalidades por Implementar

### 1. Function Calling para Disponibilidad de Habitaciones 🏨 [PRIORITARIO]

**Objetivo:** Responder consultas de disponibilidad con datos reales en tiempo real.

**Arquitectura:**
```
Usuario → WhatsApp → Bot → OpenAI Assistant → Function Call → n8n → Beds24/Google Sheets → Respuesta
```

**Implementación en OpenAI Assistant:**
```json
{
  "name": "check_availability",
  "description": "Consulta disponibilidad de habitaciones para fechas específicas",
  "parameters": {
    "type": "object",
    "properties": {
      "check_in": {
        "type": "string",
        "description": "Fecha de entrada (YYYY-MM-DD)"
      },
      "check_out": {
        "type": "string",
        "description": "Fecha de salida (YYYY-MM-DD)"
      },
      "guests": {
        "type": "integer",
        "description": "Número de huéspedes"
      },
      "room_type": {
        "type": "string",
        "description": "Tipo de habitación solicitada",
        "enum": ["standard", "deluxe", "suite", "cualquiera"]
      }
    },
    "required": ["check_in", "check_out", "guests"]
  }
}
```

**Handler en el Bot (src/handlers/availability-handler.js):**
```javascript
export async function checkAvailability(params) {
  // Llamar webhook n8n
  const response = await fetch(process.env.N8N_WEBHOOK_URL + '/check-availability', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  
  const availability = await response.json();
  
  // Formato de respuesta para OpenAI
  return {
    available: availability.rooms.length > 0,
    rooms: availability.rooms.map(room => ({
      type: room.name,
      price: room.price_per_night,
      capacity: room.max_guests,
      amenities: room.amenities
    })),
    total_nights: availability.total_nights,
    suggested_alternatives: availability.alternatives
  };
}
```

**Workflow n8n:**
1. Recibe webhook con parámetros
2. Consulta Beds24 API o Google Sheets
3. Procesa disponibilidad y precios
4. Calcula alternativas si no hay disponibilidad
5. Retorna JSON estructurado

**Ejemplos de conversación:**
```
Usuario: "¿Tienen habitaciones del 15 al 20 de julio?"
Bot: [Function Call → check_availability]
Bot: "¡Sí! Para esas fechas tenemos disponibles:
- Habitación Deluxe Vista Mar: $280.000/noche
- Suite Familiar: $450.000/noche
¿Cuántas personas serían?"

Usuario: "Somos 4 personas"
Bot: "Perfecto, la Suite Familiar es ideal para 4 personas. 
Total 5 noches: $2.250.000. ¿Desea que reserve?"
```

### 2. Sistema de Memoria Inteligente 🧠
**Endpoints relevantes:**
- `GET /chats` - Historial completo
- `POST /labels` - Clasificación de huéspedes

**Implementación:**
```javascript
// Estructura de perfil enriquecido
{
  id: "573001234567",
  nombre: "Juan Pérez",
  etiquetas: ["VIP", "Frecuente"],
  preferencias: {
    habitacion: "Vista al mar",
    piso: "Alto",
    almohadas: "Firmes"
  },
  historial: [
    {
      fecha: "2024-06-15",
      habitacion: "501",
      duracion: 5,
      gastoTotal: 850000,
      satisfaccion: 9.5
    }
  ],
  familia: ["María Pérez", "Juanito Pérez"],
  observaciones: "Alérgico a mariscos, celebró aniversario"
}
```

**Beneficio:** La IA puede decir "Bienvenido de vuelta Sr. Pérez, ¿le gustaría la habitación 501 con vista al mar como la última vez?"

### 2. Grupos Automáticos por Reserva 👨‍👩‍👧‍👦
**Endpoints relevantes:**
- `POST /groups` - Crear grupo familiar
- `POST /groups/{GroupID}/participants` - Añadir miembros

**Caso de uso:**
1. Familia reserva 2 habitaciones
2. Bot crea grupo "Familia Pérez - Junio 2024"
3. Añade a todos los miembros automáticamente
4. Comparte info de check-in, wifi, actividades

**Código ejemplo:**
```javascript
async function crearGrupoReserva(reserva) {
  const grupo = await whapi.createGroup({
    subject: `${reserva.apellido} - ${reserva.fechaInicio}`,
    participants: reserva.telefonos
  });
  
  await whapi.sendMessage(grupo.id, 
    `¡Bienvenidos! Este es su grupo privado para la estadía...`
  );
}
```

### 3. Catálogo Visual de Habitaciones 🏨
**Endpoints relevantes:**
- `POST /business/products` - Crear habitaciones como productos
- `POST /business/catalogs` - Enviar catálogo completo

**Implementación:**
- Cada habitación es un "producto"
- Fotos profesionales
- Precio por noche
- Amenidades listadas
- Disponibilidad en tiempo real

**Flujo:**
```
Usuario: "Muéstrame habitaciones disponibles"
Bot: [Envía catálogo interactivo]
Usuario: [Selecciona habitación]
Bot: "Excelente elección, ¿para qué fechas?"
```

### 4. Stories Automatizadas para Marketing 📱
**Endpoints relevantes:**
- `POST /stories/send/media` - Publicar promociones
- `GET /stories` - Analytics de vistas

**Estrategia:**
- Lunes: Promoción semana
- Miércoles: Destacar amenidad
- Viernes: Oferta fin de semana
- Tracking de engagement

**Automatización:**
```javascript
cron.schedule('0 9 * * 1', async () => {
  await whapi.postStory({
    media: 'promo-lunes.jpg',
    caption: '🏖️ 20% OFF esta semana en habitaciones vista al mar!'
  });
});
```

### 5. Sistema de Etiquetas Inteligente 🏷️
**Endpoints relevantes:**
- `POST /labels` - Crear categorías
- `POST /labels/{LabelID}/{ContactID}` - Asignar

**Etiquetas sugeridas:**
```
- 🌟 VIP (>5 estadías)
- 💼 Corporativo
- 👨‍👩‍👧 Familiar
- 🎂 Cumpleañero
- ⚠️ Requiere atención especial
- 🚫 Lista negra
```

**Integración con IA:**
```javascript
const contexto = await getContactLabels(userId);
if (contexto.includes('VIP')) {
  prompt += "[CONTEXTO: Cliente VIP - Trato preferencial]";
}
```

### 6. Encuestas Post-Estadía 📊
**Endpoints relevantes:**
- `POST /messages/poll` - Enviar encuesta

**Flujo automatizado:**
```
[1 día después del checkout]
Bot: "¿Cómo fue su experiencia?"
- ⭐⭐⭐⭐⭐ Excelente
- ⭐⭐⭐⭐ Muy buena
- ⭐⭐⭐ Buena
- ⭐⭐ Regular
- ⭐ Mala

[Si responde 4-5 estrellas]
Bot: "¡Nos alegra! ¿Le gustaría dejar una reseña en Google?"

[Si responde 1-3 estrellas]
Bot: "Lamentamos eso. ¿Podría decirnos qué podemos mejorar?"
```

### 7. Gestión de Documentos 📄
**Endpoints relevantes:**
- `POST /messages/document` - Enviar PDFs

**Automatizaciones:**
- Factura automática post-checkout
- Guía de la ciudad en PDF
- Menú del restaurante
- Protocolo COVID actualizado

### 8. Ubicación en Tiempo Real 📍
**Endpoints relevantes:**
- `POST /messages/live_location` - Compartir ubicación

**Casos de uso:**
- Shuttle del hotel compartiendo ubicación
- Guiar desde aeropuerto
- Mostrar lugares cercanos de interés

### 9. Lista Negra Automática 🚫
**Endpoints relevantes:**
- `PUT /blacklist/{ContactID}` - Bloquear

**Triggers automáticos:**
- 3 no-shows sin aviso
- Comportamiento abusivo reportado
- Intento de estafa detectado

### 10. Integración con Newsletters 📰
**Endpoints relevantes:**
- `POST /newsletters` - Crear boletín del hotel
- `POST /newsletters/{ID}/subscription` - Suscribir huéspedes

**Contenido:**
- Eventos mensuales
- Nuevas amenidades
- Ofertas exclusivas para suscriptores

## 💰 Beneficios Esperados

### Impacto Operativo:
- **Automatización:** Reducción significativa de tareas manuales
- **Disponibilidad:** Respuestas 24/7 sin personal adicional
- **Precisión:** Eliminación de errores en disponibilidad y precios
- **Escalabilidad:** Manejo de múltiples consultas simultáneas

## 🔗 Integraciones Futuras

### Con n8n:
- Sincronización con PMS (Beds24)
- Conexión con pasarela de pagos
- Integración con Google Calendar
- Webhooks a CRM

### Con servicios externos:
- Google My Business (reseñas)
- TripAdvisor (ratings)
- Booking.com (disponibilidad)
- Servicios de limpieza

## 🚧 Consideraciones Técnicas

### Escalabilidad:
- Cache de respuestas frecuentes
- CDN para imágenes del catálogo
- Base de datos indexada correctamente
- Límites de rate para usuarios

### Seguridad:
- Encriptación de datos sensibles
- Backups automáticos diarios
- Logs de auditoría
- Cumplimiento GDPR/LOPD

### Monitoreo:
- Alertas de errores críticos
- Dashboard en tiempo real
- Reportes semanales automáticos
- A/B testing de respuestas

## 🎉 Visión Final

Un asistente que conoce a cada huésped por nombre, anticipa sus necesidades, gestiona grupos familiares, envía documentos importantes, publica contenido atractivo, y convierte cada interacción en una oportunidad de venta, todo mientras el equipo humano se enfoca en brindar experiencias memorables en persona.

**El futuro del hospitality es conversacional, personalizado y automatizado.**