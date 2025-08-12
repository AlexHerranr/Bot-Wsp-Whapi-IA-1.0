import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Crear un nuevo lead directo desde WhatsApp
 */
export async function crearLeadDirecto(data: {
  telefono: string;
  huesped: string;
  llegada?: string;
  pax?: number;
  apto?: string;
  valorEstimado?: string;
  notas?: string;
  responsable?: string;
}) {
  const bookingId = `WA${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Determinar prioridad automática
  let prioridad = 'media';
  const valorNumerico = data.valorEstimado ? parseFloat(data.valorEstimado.replace(/[^\d]/g, '')) : 0;
  
  if (!data.llegada) prioridad = 'alta'; // Sin fecha = urgente
  else if (valorNumerico > 800000) prioridad = 'alta'; // Alto valor
  else if (data.llegada) {
    const llegadaDate = new Date(data.llegada);
    const hoy = new Date();
    const diasHastaLlegada = Math.ceil((llegadaDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (diasHastaLlegada <= 7) prioridad = 'alta'; // Llegada próxima
    else if (diasHastaLlegada > 60) prioridad = 'baja'; // Llegada lejana
  }

  const lead = await prisma.leadsDirectos.create({
    data: {
      bookingId,
      huesped: data.huesped,
      telefono: data.telefono,
      llegada: data.llegada || '2025-12-31', // Default si no especifica
      pax: data.pax,
      apto: data.apto || 'Por definir',
      valorReserva: data.valorEstimado,
      canal: 'WhatsApp Directo',
      estadoLead: 'nuevo',
      prioridad,
      notas: data.notas,
      responsable: data.responsable,
      proximaAccion: new Date(Date.now() + 24 * 60 * 60 * 1000), // Seguimiento en 24h
      reservaCompleta: {
        origen: 'whatsapp_directo',
        fecha_creacion: new Date().toISOString(),
        datos_iniciales: data
      }
    }
  });

  return lead;
}

/**
 * Marcar lead como contactado y agregar notas
 */
export async function marcarLeadContactado(bookingId: string, notas?: string, responsable?: string) {
  const lead = await prisma.leadsDirectos.update({
    where: { bookingId },
    data: {
      estadoLead: 'contactado',
      ultimaGestion: new Date(),
      intentosContacto: { increment: 1 },
      notas: notas ? notas : undefined,
      responsable: responsable ? responsable : undefined,
      proximaAccion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Seguimiento en 3 días
    }
  });

  return lead;
}

/**
 * Programar seguimiento para un lead
 */
export async function programarSeguimiento(bookingId: string, fechaSeguimiento: Date, notas?: string) {
  return await prisma.leadsDirectos.update({
    where: { bookingId },
    data: {
      estadoLead: 'seguimiento',
      proximaAccion: fechaSeguimiento,
      ultimaGestion: new Date(),
      notas: notas ? notas : undefined
    }
  });
}

/**
 * Convertir lead (crear reserva exitosa)
 */
export async function convertirLead(bookingId: string, valorFinal?: string, apartamentoFinal?: string) {
  return await prisma.leadsDirectos.update({
    where: { bookingId },
    data: {
      estadoLead: 'convertido',
      fechaConversion: new Date(),
      ultimaGestion: new Date(),
      valorReserva: valorFinal ? valorFinal : undefined,
      apto: apartamentoFinal ? apartamentoFinal : undefined
    }
  });
}

/**
 * Descartar lead y mover a tabla LeadsDescartados
 */
export async function descartarLead(
  bookingId: string, 
  razon: string, 
  categoria: 'sin_interes' | 'precio' | 'fechas' | 'competencia' | 'otro' = 'sin_interes',
  responsable?: string,
  puedeReactivarse: boolean = true,
  fechaReactivacion?: Date
) {
  // 1. Obtener el lead actual
  const leadActual = await prisma.leadsDirectos.findUnique({
    where: { bookingId }
  });

  if (!leadActual) {
    throw new Error(`Lead con bookingId ${bookingId} no encontrado`);
  }

  // 2. Crear registro en LeadsDescartados
  const leadDescartado = await prisma.leadsDescartados.create({
    data: {
      bookingIdOriginal: leadActual.bookingId,
      huesped: leadActual.huesped,
      apto: leadActual.apto,
      llegada: leadActual.llegada,
      pax: leadActual.pax,
      telefono: leadActual.telefono,
      
      // Motivo del descarte
      razonDescarte: razon,
      categoriaDescarte: categoria,
      
      // Historial original
      estadoOriginal: leadActual.estadoLead,
      prioridadOriginal: leadActual.prioridad,
      intentosRealizados: leadActual.intentosContacto,
      valorEstimadoOriginal: leadActual.valorReserva,
      canalOriginal: leadActual.canal,
      
      // Responsable y notas
      descartadoPor: responsable,
      notasFinales: `${leadActual.notas || ''}\n\nDESCARTE: ${razon}`.trim(),
      
      // Fechas
      fechaCreacionOriginal: leadActual.fechaCreacion,
      fechaUltimaGestion: leadActual.ultimaGestion,
      
      // Reactivación
      puedeReactivarse,
      fechaReactivacion,
      
      // Backup completo
      leadOriginalCompleto: leadActual as any
    }
  });

  // 3. Eliminar de LeadsDirectos
  await prisma.leadsDirectos.delete({
    where: { bookingId }
  });

  return leadDescartado;
}

/**
 * Reactivar lead desde descartados
 */
export async function reactivarLead(bookingIdOriginal: string, responsable?: string, notas?: string) {
  // 1. Obtener lead descartado
  const leadDescartado = await prisma.leadsDescartados.findUnique({
    where: { bookingIdOriginal }
  });

  if (!leadDescartado) {
    throw new Error(`Lead descartado con ID ${bookingIdOriginal} no encontrado`);
  }

  if (!leadDescartado.puedeReactivarse) {
    throw new Error(`Lead ${bookingIdOriginal} marcado como no reactivable`);
  }

  // 2. Recrear en LeadsDirectos con nueva oportunidad
  const leadReactivado = await prisma.leadsDirectos.create({
    data: {
      bookingId: `${leadDescartado.bookingIdOriginal}_R${Date.now()}`, // Nuevo ID con sufijo reactivado
      huesped: leadDescartado.huesped,
      apto: leadDescartado.apto,
      llegada: leadDescartado.llegada,
      pax: leadDescartado.pax,
      telefono: leadDescartado.telefono,
      valorReserva: leadDescartado.valorEstimadoOriginal,
      canal: `${leadDescartado.canalOriginal} (Reactivado)`,
      estadoLead: 'nuevo',
      prioridad: 'media', // Empezar con prioridad media
      notas: `REACTIVADO desde descarte.\nRazón descarte anterior: ${leadDescartado.razonDescarte}\n${notas || ''}`.trim(),
      responsable,
      proximaAccion: new Date(Date.now() + 24 * 60 * 60 * 1000), // Contactar en 24h
      reservaCompleta: {
        origen: 'reactivado',
        descarte_anterior: {
          fecha: leadDescartado.fechaDescarte,
          razon: leadDescartado.razonDescarte,
          categoria: leadDescartado.categoriaDescarte
        }
      }
    }
  });

  // 3. Marcar lead descartado como reactivado
  await prisma.leadsDescartados.update({
    where: { bookingIdOriginal },
    data: {
      puedeReactivarse: false, // Ya fue reactivado
      fechaReactivacion: new Date()
    }
  });

  return leadReactivado;
}

/**
 * Marcar lead como perdido (mantener función original por compatibilidad)
 */
export async function marcarLeadPerdido(bookingId: string, razon?: string) {
  // Usar la nueva función de descarte
  return await descartarLead(
    bookingId,
    razon || 'Lead perdido - sin especificar',
    'otro',
    undefined,
    false // No reactivable por defecto
  );
}

/**
 * Obtener leads activos para gestión
 */
export async function obtenerLeadsActivos(prioridad?: string, responsable?: string) {
  return await prisma.leadsDirectos.findMany({
    where: {
      estadoLead: { in: ['nuevo', 'contactado', 'seguimiento'] },
      ...(prioridad && { prioridad }),
      ...(responsable && { responsable })
    },
    orderBy: [
      { prioridad: 'asc' }, // alta, media, baja
      { fechaCreacion: 'desc' } // Más recientes primero
    ],
    select: {
      bookingId: true,
      huesped: true,
      apto: true,
      llegada: true,
      pax: true,
      telefono: true,
      estadoLead: true,
      prioridad: true,
      ultimaGestion: true,
      proximaAccion: true,
      valorReserva: true,
      notas: true,
      responsable: true,
      intentosContacto: true
    }
  });
}

/**
 * Obtener agenda de seguimientos para hoy
 */
export async function obtenerSeguimientosHoy() {
  const hoy = new Date();
  const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);

  return await prisma.leadsDirectos.findMany({
    where: {
      OR: [
        {
          proximaAccion: {
            gte: inicioDia,
            lt: finDia
          }
        },
        {
          AND: [
            { ultimaGestion: null },
            { prioridad: 'alta' }
          ]
        }
      ],
      estadoLead: { in: ['nuevo', 'contactado', 'seguimiento'] }
    },
    orderBy: { prioridad: 'asc' },
    select: {
      bookingId: true,
      huesped: true,
      telefono: true,
      prioridad: true,
      estadoLead: true,
      ultimaGestion: true,
      notas: true,
      valorReserva: true,
      llegada: true
    }
  });
}

/**
 * Estadísticas rápidas de leads directos
 */
export async function obtenerEstadisticasLeads() {
  const [
    total,
    nuevos,
    contactados,
    seguimiento,
    convertidos,
    perdidos,
    altaPrioridad
  ] = await Promise.all([
    prisma.leadsDirectos.count(),
    prisma.leadsDirectos.count({ where: { estadoLead: 'nuevo' } }),
    prisma.leadsDirectos.count({ where: { estadoLead: 'contactado' } }),
    prisma.leadsDirectos.count({ where: { estadoLead: 'seguimiento' } }),
    prisma.leadsDirectos.count({ where: { estadoLead: 'convertido' } }),
    prisma.leadsDirectos.count({ where: { estadoLead: 'perdido' } }),
    prisma.leadsDirectos.count({ 
      where: { 
        prioridad: 'alta',
        estadoLead: { in: ['nuevo', 'contactado', 'seguimiento'] }
      } 
    })
  ]);

  return {
    total,
    activos: nuevos + contactados + seguimiento,
    nuevos,
    contactados,
    seguimiento,
    convertidos,
    perdidos,
    altaPrioridad
  };
}

// Función para detectar automáticamente leads desde conversaciones de WhatsApp
export async function detectarLeadDesdeConversacion(mensaje: string, telefono: string, nombreContacto?: string) {
  // Palabras clave que indican interés en reservar
  const palabrasClaveReserva = [
    'reservar', 'reserva', 'disponibilidad', 'precio', 'apartamento', 
    'habitación', 'alojamiento', 'hospedaje', 'hotel', 'llegada',
    'salida', 'personas', 'huéspedes', 'fecha', 'cotización'
  ];

  const mensajeLower = mensaje.toLowerCase();
  const esLeadPotencial = palabrasClaveReserva.some(palabra => 
    mensajeLower.includes(palabra)
  );

  if (esLeadPotencial && nombreContacto) {
    // Verificar si ya existe un lead activo para este teléfono
    const leadExistente = await prisma.leadsDirectos.findFirst({
      where: {
        telefono,
        estadoLead: { in: ['nuevo', 'contactado', 'seguimiento'] }
      }
    });

    if (!leadExistente) {
      // Crear lead automático
      return await crearLeadDirecto({
        telefono,
        huesped: nombreContacto,
        notas: `Lead automático detectado. Mensaje inicial: "${mensaje.substring(0, 100)}..."`
      });
    }
  }

  return null;
}

/**
 * Obtener leads descartados para análisis
 */
export async function obtenerLeadsDescartados(categoria?: string, puedeReactivarse?: boolean) {
  return await prisma.leadsDescartados.findMany({
    where: {
      ...(categoria && { categoriaDescarte: categoria }),
      ...(puedeReactivarse !== undefined && { puedeReactivarse })
    },
    orderBy: { fechaDescarte: 'desc' },
    select: {
      bookingIdOriginal: true,
      huesped: true,
      telefono: true,
      razonDescarte: true,
      categoriaDescarte: true,
      valorEstimadoOriginal: true,
      intentosRealizados: true,
      fechaDescarte: true,
      descartadoPor: true,
      puedeReactivarse: true,
      fechaReactivacion: true
    }
  });
}

/**
 * Análisis de descartes por categoría
 */
export async function analizarDescartes() {
  const [
    totalDescartados,
    porCategoria,
    valorPerdido,
    reactivables
  ] = await Promise.all([
    prisma.leadsDescartados.count(),
    prisma.leadsDescartados.groupBy({
      by: ['categoriaDescarte'],
      _count: { categoriaDescarte: true },
      orderBy: { _count: { categoriaDescarte: 'desc' } }
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(CAST("valorEstimadoOriginal" AS NUMERIC)), 0) as valor_perdido
      FROM "LeadsDescartados" 
      WHERE "valorEstimadoOriginal" IS NOT NULL AND "valorEstimadoOriginal" != ''
    `,
    prisma.leadsDescartados.count({
      where: { puedeReactivarse: true }
    })
  ]);

  const valorPerdidoResult = valorPerdido as any[];
  const valorPerdidoFinal = valorPerdidoResult[0]?.valor_perdido || 0;

  return {
    totalDescartados,
    porCategoria,
    valorPerdido: String(valorPerdidoFinal),
    reactivables
  };
}

/**
 * Obtener leads candidatos a reactivación
 */
export async function obtenerCandidatosReactivacion() {
  const hoy = new Date();
  const hace30Dias = new Date(hoy.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  return await prisma.leadsDescartados.findMany({
    where: {
      puedeReactivarse: true,
      OR: [
        { fechaReactivacion: { lte: hoy } }, // Fecha de reactivación llegó
        { 
          AND: [
            { categoriaDescarte: { in: ['fechas', 'precio'] } }, // Categorías reactivables
            { fechaDescarte: { lte: hace30Dias } } // Descartados hace más de 30 días
          ]
        }
      ]
    },
    orderBy: [
      { fechaReactivacion: 'asc' },
      { fechaDescarte: 'asc' }
    ],
    select: {
      bookingIdOriginal: true,
      huesped: true,
      telefono: true,
      razonDescarte: true,
      categoriaDescarte: true,
      valorEstimadoOriginal: true,
      fechaDescarte: true,
      fechaReactivacion: true
    }
  });
}

/**
 * Verificar si un teléfono fue descartado previamente
 */
export async function verificarHistorialDescarte(telefono: string) {
  const descartesPrevios = await prisma.leadsDescartados.findMany({
    where: { telefono },
    orderBy: { fechaDescarte: 'desc' },
    select: {
      huesped: true,
      razonDescarte: true,
      categoriaDescarte: true,
      fechaDescarte: true,
      intentosRealizados: true,
      puedeReactivarse: true
    }
  });

  return {
    tieneDescartes: descartesPrevios.length > 0,
    ultimoDescarte: descartesPrevios[0] || null,
    totalDescartes: descartesPrevios.length,
    esReincidente: descartesPrevios.length > 1
  };
}