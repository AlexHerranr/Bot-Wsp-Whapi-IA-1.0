# Whapi API - Referencia Completa

## Información General

**API URL:** `https://gate.whapi.cloud/`  
**Token:** `hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ`  
**WhatsApp Business:** `+57 323 5906292`

## Índice

1. [Channel (Canal Principal)](#channel)
2. [Users (Usuarios)](#users)
3. [Messages (Mensajes)](#messages)
4. [Chats (Conversaciones)](#chats)
5. [Contacts (Contactos)](#contacts)
6. [Presences (Presencia)](#presences)
7. [Groups (Grupos)](#groups)
8. [Stories (Estados)](#stories)
9. [Statuses (Estados de Lectura)](#statuses)
10. [Newsletters (Canales/Threads)](#newsletters)
11. [Media (Archivos Multimedia)](#media)
12. [Business (WhatsApp Business)](#business)
13. [Labels (Etiquetas)](#labels)
14. [Blacklist (Lista Negra)](#blacklist)
15. [Communities (Comunidades)](#communities)
16. [Bots](#bots)
17. [Calls (Llamadas)](#calls)

---

## Channel

El canal es la entidad principal de la API. Representa la sesión de WhatsApp del usuario.

### GET `/health`
**Propósito:** Verificar el estado de salud del canal y lanzarlo si es necesario.  
**Casos de uso:**
- Verificar si el bot está funcionando correctamente
- Iniciar el canal automáticamente si está inactivo
- Monitoreo de estado del servicio

### GET `/settings`
**Propósito:** Obtener la configuración actual del canal.  
**Casos de uso:**
- Verificar configuraciones de webhook
- Revisar eventos habilitados
- Obtener información de configuración general

### DELETE `/settings`
**Propósito:** Restablecer la configuración del canal a valores por defecto.  
**Casos de uso:**
- Limpiar configuraciones corruptas
- Resetear webhooks
- Volver a estado inicial

### PATCH `/settings`
**Propósito:** Actualizar la configuración del canal.  
**Casos de uso:**
- Cambiar URL del webhook
- Modificar eventos habilitados
- Actualizar configuraciones de seguridad

### GET `/settings/events`
**Propósito:** Obtener lista de eventos permitidos para el canal.  
**Casos de uso:**
- Verificar qué eventos están habilitados
- Debugging de webhooks
- Configuración de eventos

### POST `/settings/webhook_test`
**Propósito:** Probar la configuración del webhook enviando un evento de prueba.  
**Casos de uso:**
- Verificar que el webhook funciona correctamente
- Testing de integración
- Debugging de problemas de webhook

### GET `/limits`
**Propósito:** Obtener información sobre los límites actuales del canal.  
**Casos de uso:**
- Monitorear uso de la API
- Verificar límites de rate limiting
- Planificación de uso

---

## Users

Gestión de usuarios de WhatsApp relacionados con el canal.

### GET `/users/login`
**Propósito:** Iniciar sesión del usuario usando QR en formato base64.  
**Casos de uso:**
- Autenticación inicial del bot
- Reautenticación después de desconexión
- Setup inicial del canal

### GET `/users/login/image`
**Propósito:** Obtener imagen QR para iniciar sesión.  
**Casos de uso:**
- Mostrar QR en interfaz web
- Autenticación manual
- Setup inicial

### GET `/users/login/rowdata`
**Propósito:** Obtener datos QR en formato raw para iniciar sesión.  
**Casos de uso:**
- Generación de QR personalizado
- Integración con apps móviles
- Autenticación avanzada

### GET `/users/login/{PhoneNumber}`
**Propósito:** Obtener código de autenticación por número de teléfono.  
**Casos de uso:**
- Autenticación por SMS
- Recuperación de cuenta
- Setup alternativo

### POST `/users/logout`
**Propósito:** Cerrar sesión del usuario.  
**Casos de uso:**
- Desconexión segura
- Cambio de cuenta
- Mantenimiento del sistema

### GET `/users/profile`
**Propósito:** Obtener información del perfil del usuario.  
**Casos de uso:**
- Mostrar información del bot
- Verificar estado de la cuenta
- Obtener datos del perfil

### PATCH `/users/profile`
**Propósito:** Actualizar información del perfil del usuario.  
**Casos de uso:**
- Cambiar nombre del bot
- Actualizar foto de perfil
- Modificar información de contacto

### GET `/users/info`
**Propósito:** Consultar información de la cuenta.  
**Casos de uso:**
- Verificar estado de la suscripción
- Obtener información de facturación
- Revisar límites de uso

### POST `/users/gdpr`
**Propósito:** Solicitar reporte de cuenta GDPR.  
**Casos de uso:**
- Cumplimiento de regulaciones
- Exportación de datos
- Solicitudes de privacidad

### GET `/users/gdpr`
**Propósito:** Obtener estado del reporte GDPR.  
**Casos de uso:**
- Verificar progreso de exportación
- Seguimiento de solicitudes
- Gestión de privacidad

### PUT `/status`
**Propósito:** Cambiar el texto de estado del usuario.  
**Casos de uso:**
- Mostrar estado personalizado
- Indicar disponibilidad
- Comunicar información temporal

---

## Messages

Gestión de mensajes enviados y recibidos por el canal.

### GET `/messages/list`
**Propósito:** Obtener lista de mensajes.  
**Casos de uso:**
- Historial de conversaciones
- Búsqueda de mensajes
- Análisis de conversaciones

### GET `/messages/list/{ChatID}`
**Propósito:** Obtener mensajes de un chat específico.  
**Casos de uso:**
- Historial de chat específico
- Análisis de conversación
- Recuperación de mensajes

### POST `/messages/text`
**Propósito:** Enviar mensaje de texto.  
**Casos de uso:**
- Respuestas automáticas
- Notificaciones
- Comunicación general

### POST `/messages/image`
**Propósito:** Enviar mensaje con imagen.  
**Casos de uso:**
- Envío de fotos
- Catálogos de productos
- Material promocional

### POST `/messages/video`
**Propósito:** Enviar mensaje con video.  
**Casos de uso:**
- Tutoriales
- Demostraciones
- Contenido multimedia

### POST `/messages/short`
**Propósito:** Enviar video corto (PTV - Picture to Video).  
**Casos de uso:**
- Videos de estado
- Contenido efímero
- Mensajes temporales

### POST `/messages/gif`
**Propósito:** Enviar mensaje con GIF.  
**Casos de uso:**
- Reacciones animadas
- Contenido divertido
- Expresiones visuales

### POST `/messages/audio`
**Propósito:** Enviar mensaje de audio.  
**Casos de uso:**
- Notas de voz
- Podcasts
- Contenido auditivo

### POST `/messages/voice`
**Propósito:** Enviar mensaje de voz.  
**Casos de uso:**
- Mensajes de voz
- Comunicación personal
- Notas rápidas

### POST `/messages/document`
**Propósito:** Enviar mensaje con documento.  
**Casos de uso:**
- Archivos PDF
- Documentos de trabajo
- Facturas

### POST `/messages/link_preview`
**Propósito:** Enviar mensaje con vista previa de enlace.  
**Casos de uso:**
- Compartir URLs
- Enlaces a sitios web
- Referencias externas

### POST `/messages/location`
**Propósito:** Enviar mensaje con ubicación.  
**Casos de uso:**
- Compartir ubicación
- Direcciones
- Puntos de interés

### POST `/messages/live_location`
**Propósito:** Enviar ubicación en vivo.  
**Casos de uso:**
- Seguimiento en tiempo real
- Ubicación compartida
- Navegación

### POST `/messages/contact`
**Propósito:** Enviar mensaje con contacto.  
**Casos de uso:**
- Compartir información de contacto
- Referencias
- Networking

### POST `/messages/contact_list`
**Propósito:** Enviar lista de contactos.  
**Casos de uso:**
- Directorio de contactos
- Lista de proveedores
- Referencias múltiples

### POST `/messages/poll`
**Propósito:** Enviar mensaje con encuesta.  
**Casos de uso:**
- Votaciones
- Encuestas de satisfacción
- Feedback de clientes

### POST `/messages/interactive`
**Propósito:** Enviar mensaje interactivo.  
**Casos de uso:**
- Botones de respuesta
- Menús interactivos
- Flujos de conversación

### POST `/messages/sticker`
**Propósito:** Enviar mensaje con sticker.  
**Casos de uso:**
- Reacciones visuales
- Contenido divertido
- Expresiones

### POST `/messages/story`
**Propósito:** Enviar mensaje de historia.  
**Casos de uso:**
- Contenido efímero
- Actualizaciones temporales
- Historias de estado

### POST `/messages/story/audio`
**Propósito:** Enviar historia con audio.  
**Casos de uso:**
- Historias con música
- Podcasts efímeros
- Contenido auditivo temporal

### POST `/messages/story/media`
**Propósito:** Enviar historia con media.  
**Casos de uso:**
- Historias con fotos/videos
- Contenido multimedia temporal
- Actualizaciones visuales

### POST `/messages/story/text`
**Propósito:** Enviar historia con texto.  
**Casos de uso:**
- Historias de texto
- Actualizaciones de estado
- Mensajes temporales

### POST `/messages/media/{MediaMessageType}`
**Propósito:** Enviar mensaje multimedia genérico.  
**Casos de uso:**
- Envío flexible de media
- Integración con sistemas externos
- Automatización de envíos

### GET `/messages/{MessageID}`
**Propósito:** Obtener un mensaje específico.  
**Casos de uso:**
- Recuperar mensaje específico
- Análisis de contenido
- Referencias a mensajes

### POST `/messages/{MessageID}`
**Propósito:** Reenviar un mensaje.  
**Casos de uso:**
- Compartir mensajes
- Reenvío de información
- Distribución de contenido

### PUT `/messages/{MessageID}`
**Propósito:** Marcar mensaje como leído.  
**Casos de uso:**
- Confirmar lectura
- Gestión de estado de mensajes
- Seguimiento de entregas

### DELETE `/messages/{MessageID}`
**Propósito:** Eliminar un mensaje.  
**Casos de uso:**
- Corrección de errores
- Eliminación de contenido inapropiado
- Limpieza de conversaciones

### PUT `/messages/{MessageID}/reaction`
**Propósito:** Reaccionar a un mensaje.  
**Casos de uso:**
- Feedback automático
- Confirmación de recepción
- Interacción con mensajes

### DELETE `/messages/{MessageID}/reaction`
**Propósito:** Remover reacción de un mensaje.  
**Casos de uso:**
- Cambiar reacciones
- Eliminar feedback
- Gestión de interacciones

### PUT `/messages/{MessageID}/star`
**Propósito:** Marcar mensaje como favorito.  
**Casos de uso:**
- Guardar mensajes importantes
- Marcado automático
- Gestión de favoritos

### POST `/messages/{MessageID}/pin`
**Propósito:** Fijar un mensaje.  
**Casos de uso:**
- Mensajes importantes
- Anclaje de información
- Destacar contenido

### DELETE `/messages/{MessageID}/pin`
**Propósito:** Desfijar un mensaje.  
**Casos de uso:**
- Gestión de mensajes fijados
- Limpieza de anclajes
- Actualización de contenido

---

## Chats

Gestión de las conversaciones del canal.

### GET `/chats`
**Propósito:** Obtener lista de chats.  
**Casos de uso:**
- Lista de conversaciones
- Gestión de chats
- Análisis de actividad

### GET `/chats/{ChatID}`
**Propósito:** Obtener información de un chat específico.  
**Casos de uso:**
- Detalles de conversación
- Información del contacto
- Estado del chat

### DELETE `/chats/{ChatID}`
**Propósito:** Eliminar un chat.  
**Casos de uso:**
- Limpieza de conversaciones
- Eliminación de chats antiguos
- Gestión de archivo

### POST `/chats/{ChatID}`
**Propósito:** Archivar/Desarchivar un chat.  
**Casos de uso:**
- Organización de chats
- Archivo temporal
- Gestión de conversaciones

### PATCH `/chats/{ChatID}`
**Propósito:** Gestión de configuraciones del chat: Fijar, Silenciar, Leer, Desaparecer.  
**Casos de uso:**
- Configuración de notificaciones
- Gestión de estado
- Personalización de chat

---

## Contacts

Gestión de los contactos del canal.

### GET `/contacts`
**Propósito:** Obtener lista de contactos.  
**Casos de uso:**
- Directorio de contactos
- Gestión de base de datos
- Análisis de contactos

### POST `/contacts`
**Propósito:** Verificar números de teléfono.  
**Casos de uso:**
- Validación de números
- Verificación de existencia
- Limpieza de base de datos

### GET `/contacts/{ContactID}`
**Propósito:** Obtener información de un contacto específico.  
**Casos de uso:**
- Perfil de contacto
- Información detallada
- Gestión de contactos

### POST `/contacts/{ContactID}`
**Propósito:** Enviar información de contacto.  
**Casos de uso:**
- Compartir contactos
- Referencias
- Networking

### HEAD `/contacts/{ContactID}`
**Propósito:** Verificar si existe un contacto.  
**Casos de uso:**
- Validación rápida
- Verificación de existencia
- Optimización de consultas

### GET `/contacts/{ContactID}/profile`
**Propósito:** Obtener perfil de un contacto.  
**Casos de uso:**
- Información de perfil
- Foto de contacto
- Datos personales

### GET `/contacts/lids`
**Propósito:** Obtener LIDs por IDs.  
**Casos de uso:**
- Identificadores únicos
- Referencias internas
- Gestión de contactos

### GET `/contacts/lids/{ContactID}`
**Propósito:** Obtener LID de un contacto específico.  
**Casos de uso:**
- Identificador único
- Referencia interna
- Gestión de contactos

---

## Presences

Gestión de presencia de contactos.

### PUT `/presences/me`
**Propósito:** Enviar presencia online u offline.  
**Casos de uso:**
- Indicar disponibilidad
- Estado de conexión
- Gestión de presencia

### GET `/presences/{EntryID}`
**Propósito:** Obtener presencia de un contacto.  
**Casos de uso:**
- Verificar si está escribiendo
- Estado de conexión
- Monitoreo de actividad

### POST `/presences/{EntryID}`
**Propósito:** Suscribirse a la presencia de un contacto.  
**Casos de uso:**
- Monitoreo de actividad
- Detección de escritura
- Gestión de interacciones

### PUT `/presences/{EntryID}`
**Propósito:** Enviar presencia de escritura o grabación.  
**Casos de uso:**
- Indicar que está escribiendo
- Mostrar actividad
- Feedback visual

---

## Groups

Gestión de grupos del canal.

### GET `/groups`
**Propósito:** Obtener lista de grupos.  
**Casos de uso:**
- Lista de grupos
- Gestión de comunidades
- Análisis de grupos

### POST `/groups`
**Propósito:** Crear un grupo.  
**Casos de uso:**
- Creación de comunidades
- Grupos de trabajo
- Organización de contactos

### PUT `/groups`
**Propósito:** Aceptar invitación a grupo.  
**Casos de uso:**
- Unirse a grupos
- Aceptar invitaciones
- Participación en comunidades

### GET `/groups/{GroupID}`
**Propósito:** Obtener información de un grupo específico.  
**Casos de uso:**
- Detalles del grupo
- Lista de participantes
- Configuración del grupo

### PUT `/groups/{GroupID}`
**Propósito:** Actualizar información del grupo.  
**Casos de uso:**
- Cambiar nombre
- Actualizar descripción
- Modificar configuración

### DELETE `/groups/{GroupID}`
**Propósito:** Salir de un grupo.  
**Casos de uso:**
- Abandonar grupo
- Limpieza de membresías
- Gestión de participación

### PATCH `/groups/{GroupID}`
**Propósito:** Actualizar configuración del grupo.  
**Casos de uso:**
- Cambiar configuraciones
- Modificar permisos
- Gestión de grupo

### GET `/groups/{GroupID}/invite`
**Propósito:** Obtener enlace de invitación del grupo.  
**Casos de uso:**
- Compartir grupo
- Invitar participantes
- Enlaces de acceso

### DELETE `/groups/{GroupID}/invite`
**Propósito:** Revocar enlace de invitación del grupo.  
**Casos de uso:**
- Seguridad del grupo
- Control de acceso
- Gestión de invitaciones

### POST `/groups/{GroupID}/participants`
**Propósito:** Agregar participante al grupo.  
**Casos de uso:**
- Invitar miembros
- Agregar contactos
- Gestión de participantes

### DELETE `/groups/{GroupID}/participants`
**Propósito:** Remover participante del grupo.  
**Casos de uso:**
- Expulsar miembros
- Limpieza de grupo
- Gestión de participantes

### GET `/groups/{GroupID}/icon`
**Propósito:** Obtener ícono del grupo.  
**Casos de uso:**
- Mostrar ícono
- Gestión de imagen
- Personalización

### PUT `/groups/{GroupID}/icon`
**Propósito:** Establecer ícono del grupo.  
**Casos de uso:**
- Cambiar imagen
- Personalización
- Identificación visual

### DELETE `/groups/{GroupID}/icon`
**Propósito:** Eliminar ícono del grupo.  
**Casos de uso:**
- Remover imagen
- Resetear ícono
- Limpieza de grupo

### DELETE `/groups/{GroupID}/admins`
**Propósito:** Degradar administrador del grupo.  
**Casos de uso:**
- Gestión de permisos
- Cambio de roles
- Administración de grupo

### PATCH `/groups/{GroupID}/admins`
**Propósito:** Promover a administrador del grupo.  
**Casos de uso:**
- Asignar permisos
- Gestión de roles
- Administración

### POST `/groups/link/{InviteCode}`
**Propósito:** Enviar enlace de invitación del grupo.  
**Casos de uso:**
- Compartir grupo
- Invitar participantes
- Enlaces de acceso

### GET `/groups/link/{InviteCode}`
**Propósito:** Obtener información del grupo por código de invitación.  
**Casos de uso:**
- Verificar invitación
- Información previa
- Validación de enlace

### GET `/groups/{GroupID}/applications`
**Propósito:** Obtener lista de solicitudes de unión al grupo.  
**Casos de uso:**
- Gestión de solicitudes
- Moderación de grupo
- Control de acceso

### POST `/groups/{GroupID}/applications`
**Propósito:** Aceptar solicitudes de unión al grupo.  
**Casos de uso:**
- Aprobar miembros
- Gestión de solicitudes
- Moderación

### DELETE `/groups/{GroupID}/applications`
**Propósito:** Rechazar solicitudes de unión al grupo.  
**Casos de uso:**
- Denegar acceso
- Moderación
- Control de calidad

---

## Stories

Funciones de WhatsApp Statuses (Stories).

### POST `/messages/story/text`
**Propósito:** Enviar historia de texto.  
**Casos de uso:**
- Actualizaciones de estado
- Mensajes temporales
- Contenido efímero

### GET `/stories`
**Propósito:** Obtener lista de historias.  
**Casos de uso:**
- Ver historias disponibles
- Gestión de contenido
- Análisis de historias

### POST `/stories`
**Propósito:** Crear y publicar historia.  
**Casos de uso:**
- Creación de historias
- Contenido temporal
- Actualizaciones

### POST `/stories/send/text`
**Propósito:** Publicar historia de texto.  
**Casos de uso:**
- Mensajes de estado
- Actualizaciones temporales
- Comunicación efímera

### POST `/stories/send/media`
**Propósito:** Publicar historia con media.  
**Casos de uso:**
- Fotos temporales
- Videos de estado
- Contenido multimedia efímero

### POST `/stories/send/audio`
**Propósito:** Publicar historia con audio.  
**Casos de uso:**
- Audio temporal
- Música de estado
- Contenido auditivo efímero

### GET `/stories/{MessageID}`
**Propósito:** Obtener una historia específica.  
**Casos de uso:**
- Ver historia específica
- Análisis de contenido
- Referencia a historias

### PUT `/stories/{MessageID}`
**Propósito:** Copiar historia.  
**Casos de uso:**
- Reproducir historia
- Compartir contenido
- Reutilización

---

## Statuses

Funciones de WhatsApp View Statuses (ACK). Para verificar el estado de vista de mensajes o historias.

### GET `/statuses/{MessageID}`
**Propósito:** Obtener estados de vista de mensaje o historia.  
**Casos de uso:**
- Confirmación de entrega
- Estado de lectura
- Seguimiento de mensajes

---

## Newsletters

Funciones de WhatsApp Channels (Threads).

### GET `/newsletters`
**Propósito:** Obtener lista de newsletters.  
**Casos de uso:**
- Gestión de canales
- Lista de newsletters
- Análisis de canales

### POST `/newsletters`
**Propósito:** Crear newsletter.  
**Casos de uso:**
- Creación de canal
- Nuevo newsletter
- Configuración inicial

### GET `/newsletters/find`
**Propósito:** Buscar newsletters por filtros.  
**Casos de uso:**
- Búsqueda de canales
- Filtros avanzados
- Descubrimiento de contenido

### GET `/newsletters/recommended`
**Propósito:** Obtener newsletters recomendados por país.  
**Casos de uso:**
- Descubrimiento de contenido
- Recomendaciones
- Contenido local

### GET `/newsletters/{NewsletterID}`
**Propósito:** Obtener información del newsletter.  
**Casos de uso:**
- Detalles del canal
- Información del newsletter
- Configuración

### DELETE `/newsletters/{NewsletterID}`
**Propósito:** Eliminar newsletter.  
**Casos de uso:**
- Eliminación de canal
- Limpieza de newsletters
- Gestión de contenido

### PATCH `/newsletters/{NewsletterID}`
**Propósito:** Editar newsletter.  
**Casos de uso:**
- Modificar configuración
- Actualizar información
- Gestión de newsletter

### POST `/newsletters/{NewsletterID}/subscription`
**Propósito:** Suscribirse al newsletter.  
**Casos de uso:**
- Unirse al canal
- Suscripción
- Seguimiento de contenido

### DELETE `/newsletters/{NewsletterID}/subscription`
**Propósito:** Cancelar suscripción al newsletter.  
**Casos de uso:**
- Salir del canal
- Cancelar suscripción
- Gestión de seguimiento

### POST `/newsletters/invite/{NewsletterInviteCode}/subscription`
**Propósito:** Suscribirse al newsletter por código de invitación.  
**Casos de uso:**
- Unirse por invitación
- Acceso con código
- Suscripción directa

### DELETE `/newsletters/invite/{NewsletterInviteCode}/subscription`
**Propósito:** Cancelar suscripción al newsletter por código de invitación.  
**Casos de uso:**
- Salir por invitación
- Cancelación directa
- Gestión de acceso

### POST `/newsletters/{NewsletterID}/tracking`
**Propósito:** Suscribirse a actualizaciones del newsletter.  
**Casos de uso:**
- Notificaciones de cambios
- Seguimiento de actualizaciones
- Monitoreo de canal

### GET `/newsletters/{NewsletterID}/messages`
**Propósito:** Obtener mensajes del newsletter.  
**Casos de uso:**
- Historial de mensajes
- Contenido del canal
- Análisis de newsletters

### POST `/newsletters/{NewsletterID}/invite/{ContactID}`
**Propósito:** Crear invitación de administrador del newsletter.  
**Casos de uso:**
- Invitar administradores
- Gestión de roles
- Colaboración

### DELETE `/newsletters/{NewsletterID}/invite/{ContactID}`
**Propósito:** Revocar invitación de administrador del newsletter.  
**Casos de uso:**
- Cancelar invitación
- Gestión de permisos
- Control de acceso

### PUT `/newsletters/{NewsletterID}/admins/{ContactID}`
**Propósito:** Aceptar solicitud de administrador del newsletter.  
**Casos de uso:**
- Aprobar administrador
- Gestión de roles
- Colaboración

### DELETE `/newsletters/{NewsletterID}/admins/{ContactID}`
**Propósito:** Degradar administrador del newsletter.  
**Casos de uso:**
- Remover permisos
- Gestión de roles
- Control de acceso

### POST `/newsletters/link/{NewsletterInviteCode}`
**Propósito:** Enviar enlace de invitación del newsletter.  
**Casos de uso:**
- Compartir newsletter
- Invitar suscriptores
- Enlaces de acceso

### GET `/newsletters/link/{NewsletterInviteCode}`
**Propósito:** Obtener información del newsletter por código de invitación.  
**Casos de uso:**
- Verificar invitación
- Información previa
- Validación de enlace

---

## Media

Gestión de archivos multimedia del canal.

### POST `/media`
**Propósito:** Subir archivo multimedia.  
**Casos de uso:**
- Carga de imágenes
- Subida de videos
- Almacenamiento de archivos

### GET `/media`
**Propósito:** Obtener archivos multimedia.  
**Casos de uso:**
- Lista de archivos
- Gestión de media
- Inventario de archivos

### GET `/media/{MediaID}`
**Propósito:** Obtener archivo multimedia específico.  
**Casos de uso:**
- Descarga de archivo
- Verificación de media
- Acceso a archivos

### DELETE `/media/{MediaID}`
**Propósito:** Eliminar archivo multimedia.  
**Casos de uso:**
- Limpieza de archivos
- Gestión de espacio
- Eliminación de contenido

---

## Business

Funciones de WhatsApp Business.

### GET `/business`
**Propósito:** Obtener perfil de negocio.  
**Casos de uso:**
- Información del negocio
- Perfil empresarial
- Datos de contacto

### POST `/business`
**Propósito:** Editar perfil de negocio.  
**Casos de uso:**
- Actualizar información
- Configuración de negocio
- Gestión de perfil

### GET `/business/products`
**Propósito:** Obtener productos.  
**Casos de uso:**
- Catálogo de productos
- Inventario
- Gestión de productos

### POST `/business/products`
**Propósito:** Crear producto.  
**Casos de uso:**
- Agregar productos
- Nuevo inventario
- Gestión de catálogo

### GET `/business/{ContactID}/products`
**Propósito:** Obtener productos por ID de contacto.  
**Casos de uso:**
- Productos específicos
- Catálogo personalizado
- Gestión por cliente

### GET `/business/products/{ProductID}`
**Propósito:** Obtener producto específico.  
**Casos de uso:**
- Detalles de producto
- Información específica
- Gestión individual

### POST `/business/products/{ProductID}`
**Propósito:** Enviar producto.  
**Casos de uso:**
- Compartir producto
- Envío de catálogo
- Promoción de productos

### PATCH `/business/products/{ProductID}`
**Propósito:** Actualizar producto.  
**Casos de uso:**
- Modificar producto
- Actualizar información
- Gestión de inventario

### DELETE `/business/products/{ProductID}`
**Propósito:** Eliminar producto.  
**Casos de uso:**
- Remover producto
- Limpieza de catálogo
- Gestión de inventario

### POST `/business/orders`
**Propósito:** Crear orden.  
**Casos de uso:**
- Nuevas órdenes
- Gestión de pedidos
- Procesamiento de ventas

### GET `/business/orders/{OrderID}`
**Propósito:** Obtener elementos de la orden.  
**Casos de uso:**
- Detalles de orden
- Seguimiento de pedido
- Gestión de ventas

### PUT `/business/cart`
**Propósito:** Actualizar carrito.  
**Casos de uso:**
- Gestión de carrito
- Actualización de pedido
- Modificación de compra

### POST `/business/cart/enabled`
**Propósito:** Habilitar o deshabilitar carrito.  
**Casos de uso:**
- Configuración de carrito
- Gestión de ventas
- Control de funcionalidad

### POST `/business/catalogs/{ContactID}`
**Propósito:** Enviar catálogo por ID de contacto.  
**Casos de uso:**
- Compartir catálogo
- Envío de productos
- Promoción específica

### POST `/business/collections`
**Propósito:** Crear colección.  
**Casos de uso:**
- Agrupar productos
- Categorización
- Organización de catálogo

### GET `/business/collections`
**Propósito:** Obtener colecciones.  
**Casos de uso:**
- Lista de colecciones
- Gestión de categorías
- Organización de productos

### GET `/business/collections/{CollectionID}`
**Propósito:** Obtener colección específica.  
**Casos de uso:**
- Detalles de colección
- Productos agrupados
- Información de categoría

### PATCH `/business/collections/{CollectionID}`
**Propósito:** Editar colección.  
**Casos de uso:**
- Modificar colección
- Actualizar categoría
- Gestión de grupos

### DELETE `/business/collections/{CollectionID}`
**Propósito:** Eliminar colección.  
**Casos de uso:**
- Remover colección
- Limpieza de categorías
- Gestión de organización

### GET `/business/categories`
**Propósito:** Buscar categorías de negocio.  
**Casos de uso:**
- Categorías disponibles
- Clasificación de negocio
- Organización de productos

### GET `/business/verified_names`
**Propósito:** Obtener nombres verificados por IDs.  
**Casos de uso:**
- Verificación de nombres
- Validación de identidad
- Gestión de credibilidad

### GET `/business/verified_names/{UserID}`
**Propósito:** Obtener nombre verificado por ID.  
**Casos de uso:**
- Verificación específica
- Validación individual
- Gestión de identidad

---

## Labels

Funciones de etiquetas de WhatsApp.

### GET `/labels`
**Propósito:** Obtener etiquetas.  
**Casos de uso:**
- Lista de etiquetas
- Gestión de categorías
- Organización de chats

### POST `/labels`
**Propósito:** Crear etiqueta.  
**Casos de uso:**
- Nueva etiqueta
- Categorización
- Organización

### GET `/labels/{LabelID}`
**Propósito:** Obtener objetos asociados con la etiqueta.  
**Casos de uso:**
- Elementos etiquetados
- Contenido categorizado
- Gestión de etiquetas

### POST `/labels/{LabelID}/{AssociationID}`
**Propósito:** Agregar asociación de etiqueta.  
**Casos de uso:**
- Etiquetar elemento
- Asociar contenido
- Categorización

### DELETE `/labels/{LabelID}/{AssociationID}`
**Propósito:** Eliminar asociación de etiqueta.  
**Casos de uso:**
- Remover etiqueta
- Desasociar contenido
- Limpieza de categorías

---

## Blacklist

Funciones de lista negra de WhatsApp.

### PUT `/blacklist/{ContactID}`
**Propósito:** Agregar contacto a la lista negra.  
**Casos de uso:**
- Bloquear contacto
- Gestión de spam
- Control de acceso

### DELETE `/blacklist/{ContactID}`
**Propósito:** Remover contacto de la lista negra.  
**Casos de uso:**
- Desbloquear contacto
- Gestión de acceso
- Control de bloqueos

### GET `/blacklist`
**Propósito:** Obtener lista negra.  
**Casos de uso:**
- Ver contactos bloqueados
- Gestión de bloqueos
- Análisis de lista negra

---

## Communities

Funciones de comunidades de WhatsApp.

### GET `/communities`
**Propósito:** Obtener lista de comunidades.  
**Casos de uso:**
- Gestión de comunidades
- Lista de grupos organizados
- Análisis de comunidades

### POST `/communities`
**Propósito:** Crear comunidad.  
**Casos de uso:**
- Nueva comunidad
- Organización de grupos
- Estructura jerárquica

### GET `/communities/{CommunityID}`
**Propósito:** Obtener información de comunidad específica.  
**Casos de uso:**
- Detalles de comunidad
- Información de estructura
- Gestión de comunidad

### POST `/communities/{CommunityID}`
**Propósito:** Crear grupo en comunidad.  
**Casos de uso:**
- Nuevo grupo en comunidad
- Expansión de comunidad
- Organización jerárquica

### DELETE `/communities/{CommunityID}`
**Propósito:** Desactivar comunidad.  
**Casos de uso:**
- Eliminar comunidad
- Desactivación temporal
- Gestión de comunidades

### DELETE `/communities/{CommunityID}/link`
**Propósito:** Revocar código de invitación de comunidad.  
**Casos de uso:**
- Seguridad de comunidad
- Control de acceso
- Gestión de invitaciones

### PUT `/communities/{CommunityID}/{GroupID}`
**Propósito:** Vincular grupo a comunidad.  
**Casos de uso:**
- Agregar grupo existente
- Organización de grupos
- Estructura de comunidad

### DELETE `/communities/{CommunityID}/{GroupID}`
**Propósito:** Desvincular grupo de comunidad.  
**Casos de uso:**
- Remover grupo
- Reorganización
- Gestión de estructura

### POST `/communities/{CommunityID}/{GroupID}/join`
**Propósito:** Unirse a grupo de comunidad.  
**Casos de uso:**
- Participación en grupo
- Acceso a comunidad
- Gestión de membresía

### PATCH `/communities/{CommunityID}/settings`
**Propósito:** Cambiar configuraciones de comunidad.  
**Casos de uso:**
- Modificar configuración
- Gestión de comunidad
- Personalización

### POST `/communities/{CommunityID}/participants`
**Propósito:** Agregar participantes a comunidad.  
**Casos de uso:**
- Invitar miembros
- Gestión de participantes
- Expansión de comunidad

### DELETE `/communities/{CommunityID}/participants`
**Propósito:** Remover participantes de comunidad.  
**Casos de uso:**
- Expulsar miembros
- Gestión de acceso
- Control de comunidad

### PATCH `/communities/{CommunityID}/admins`
**Propósito:** Promover participantes a administrador en comunidad.  
**Casos de uso:**
- Asignar roles
- Gestión de permisos
- Administración de comunidad

### DELETE `/communities/{CommunityID}/admins`
**Propósito:** Degradar participantes a administrador en comunidad.  
**Casos de uso:**
- Remover permisos
- Gestión de roles
- Control de administración

### GET `/communities/{CommunityID}/subgroups`
**Propósito:** Obtener subgrupos de comunidad.  
**Casos de uso:**
- Lista de subgrupos
- Estructura de comunidad
- Organización jerárquica

### POST `/communities/event`
**Propósito:** Crear evento.  
**Casos de uso:**
- Nuevo evento
- Organización de actividades
- Gestión de eventos

### POST `/communities/{CommunityID}/createGroup`
**Propósito:** Crear grupo en comunidad.  
**Casos de uso:**
- Nuevo grupo
- Expansión de comunidad
- Organización

---

## Bots

Funciones de bots de WhatsApp.

### GET `/bots`
**Propósito:** Obtener lista de bots.  
**Casos de uso:**
- Gestión de bots
- Lista de automatizaciones
- Análisis de bots

---

## Calls

Funciones de llamadas.

### POST `/calls`
**Propósito:** Crear evento de llamada.  
**Casos de uso:**
- Iniciar llamada
- Gestión de llamadas
- Comunicación por voz

### DELETE `/calls/{CallID}`
**Propósito:** Rechazar llamada.  
**Casos de uso:**
- Rechazar llamada
- Gestión de llamadas
- Control de comunicación

### POST `/calls/{CallID}/reject`
**Propósito:** Rechazar llamada.  
**Casos de uso:**
- Rechazar llamada
- Gestión de llamadas
- Control de comunicación

### POST `/calls/group_link`
**Propósito:** Crear enlace de llamada grupal de video.  
**Casos de uso:**
- Llamada grupal
- Video conferencia
- Comunicación grupal

---

## Webhooks

### Eventos Disponibles

- **messages:** POST, PUT, DELETE, PATCH
- **statuses:** POST, PUT
- **chats:** POST, PUT, DELETE, PATCH
- **contacts:** POST, PATCH
- **groups:** POST, PUT, PATCH
- **presences:** POST
- **channel:** POST, PATCH
- **users:** POST, DELETE
- **labels:** POST, DELETE
- **calls:** POST

### Configuración de Webhook

**URL Principal:** `https://actual-bobcat-handy.ngrok-free.app/hook`  
**Modo:** body  
**Método:** POST

### Eventos Especiales

- **Auto Download:** Habilitado para image, audio, voice, video, document, sticker
- **Individual Proxy:** Configurado para Channel PUNISH-5CJRX

---

## Casos de Uso Comunes

### 1. Gestión de Mensajes Automatizados
- Envío de respuestas automáticas
- Notificaciones programadas
- Mensajes de bienvenida

### 2. Integración con CRM
- Sincronización de contactos
- Seguimiento de conversaciones
- Gestión de leads

### 3. E-commerce
- Catálogos de productos
- Procesamiento de órdenes
- Atención al cliente

### 4. Marketing
- Campañas promocionales
- Newsletters
- Encuestas y feedback

### 5. Soporte Técnico
- Tickets de soporte
- Escalamiento automático
- Base de conocimientos

### 6. Automatización de Negocios
- Reservas y citas
- Confirmaciones
- Recordatorios

---

## Mejores Prácticas

1. **Rate Limiting:** Respetar los límites de la API
2. **Error Handling:** Manejar errores apropiadamente
3. **Webhook Security:** Validar webhooks
4. **Data Privacy:** Cumplir con GDPR
5. **Monitoring:** Monitorear uso y errores
6. **Backup:** Mantener respaldos de datos importantes

---

## Recursos Adicionales

- **Knowledge Base:** Centro de ayuda completo
- **Webhook Debugger:** Herramienta de debugging temporal
- **Activity Safety Meter:** Monitoreo de seguridad
- **API Documentation:** Documentación técnica detallada

---

*Esta documentación se actualiza regularmente. Para la información más reciente, consulta la documentación oficial de Whapi.* 