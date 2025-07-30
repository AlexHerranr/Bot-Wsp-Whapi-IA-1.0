// scripts/create-unified-client-view.ts
// Crear vista unificada de clientes con TODOS los datos importantes

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface UnifiedClient {
    // DATOS BÁSICOS DEL CLIENTE
    id: string;
    telefono: string;
    nombre: string;
    
    // FECHAS IMPORTANTES
    fechaRegistro: Date;
    ultimaActividad: Date;
    diasSinActividad: number;
    
    // CONVERSACIÓN ACTUAL
    threadId: string;
    chatId: string;
    estadoConversacion: 'Nuevo' | 'Activo' | 'Inactivo' | 'Potencial' | 'Cliente';
    
    // INTERACCIONES
    totalMensajes: number;
    mensajesUsuario: number;
    mensajesBot: number;
    ultimoMensaje: string;
    fechaUltimoMensaje: Date;
    tipoUltimoMensaje: 'user' | 'assistant';
    
    // ETIQUETAS Y CLASIFICACIÓN
    labels: string[];
    esNuevo: boolean;
    esPotencial: boolean;
    esClienteActivo: boolean;
    
    // COMPORTAMIENTO SUGERIDO DEL SISTEMA
    necesitaSeguimiento: boolean;
    prioridadRespuesta: 'Alta' | 'Media' | 'Baja';
    tiempoRespuestaSugerido: string;
    accionSugerida: string;
    
    // ANÁLISIS
    frecuenciaInteraccion: 'Diaria' | 'Semanal' | 'Mensual' | 'Esporádica';
    patronHorario: string;
    scoreInteres: number; // 1-10
    
    // METADATA TÉCNICA
    metadata: any;
}

async function createUnifiedClientView(): Promise<UnifiedClient[]> {
    try {
        await prisma.$connect();
        console.log('🔄 Creando vista unificada de clientes...\n');

        const users = await prisma.user.findMany({
            include: {
                threads: {
                    include: {
                        messages: {
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            },
            orderBy: { lastActivity: 'desc' }
        });

        const unifiedClients: UnifiedClient[] = users.map(user => {
            const thread = user.threads[0]; // Thread más reciente
            const allMessages = user.threads.flatMap(t => t.messages);
            const lastMessage = allMessages[0];
            const userMessages = allMessages.filter(m => m.role === 'user');
            const botMessages = allMessages.filter(m => m.role === 'assistant');
            
            // Calcular días sin actividad
            const now = new Date();
            const daysSinceActivity = Math.floor((now.getTime() - user.lastActivity.getTime()) / (1000 * 60 * 60 * 24));
            
            // Determinar estado de conversación
            let estadoConversacion: 'Nuevo' | 'Activo' | 'Inactivo' | 'Potencial' | 'Cliente';
            if (allMessages.length === 0) estadoConversacion = 'Nuevo';
            else if (daysSinceActivity <= 1) estadoConversacion = 'Activo';
            else if (daysSinceActivity <= 7) estadoConversacion = 'Potencial';
            else estadoConversacion = 'Inactivo';
            
            // Calcular score de interés (1-10)
            let scoreInteres = 1;
            if (allMessages.length > 0) scoreInteres += 2;
            if (allMessages.length > 5) scoreInteres += 2;
            if (daysSinceActivity <= 1) scoreInteres += 3;
            if (daysSinceActivity <= 7) scoreInteres += 2;
            scoreInteres = Math.min(scoreInteres, 10);
            
            // Determinar frecuencia de interacción
            let frecuenciaInteraccion: 'Diaria' | 'Semanal' | 'Mensual' | 'Esporádica';
            if (daysSinceActivity <= 1) frecuenciaInteraccion = 'Diaria';
            else if (daysSinceActivity <= 7) frecuenciaInteraccion = 'Semanal';
            else if (daysSinceActivity <= 30) frecuenciaInteraccion = 'Mensual';
            else frecuenciaInteraccion = 'Esporádica';
            
            // Determinar prioridad de respuesta
            let prioridadRespuesta: 'Alta' | 'Media' | 'Baja';
            if (scoreInteres >= 8) prioridadRespuesta = 'Alta';
            else if (scoreInteres >= 5) prioridadRespuesta = 'Media';
            else prioridadRespuesta = 'Baja';
            
            // Acción sugerida
            let accionSugerida = '';
            if (estadoConversacion === 'Nuevo') accionSugerida = 'Dar bienvenida personalizada';
            else if (estadoConversacion === 'Activo') accionSugerida = 'Continuar conversación normal';
            else if (estadoConversacion === 'Potencial') accionSugerida = 'Hacer seguimiento proactivo';
            else accionSugerida = 'Reactivar con oferta especial';
            
            // Tiempo de respuesta sugerido
            let tiempoRespuestaSugerido = '';
            if (prioridadRespuesta === 'Alta') tiempoRespuestaSugerido = 'Inmediato (< 5 min)';
            else if (prioridadRespuesta === 'Media') tiempoRespuestaSugerido = 'Rápido (< 30 min)';
            else tiempoRespuestaSugerido = 'Normal (< 2 horas)';

            return {
                // DATOS BÁSICOS
                id: user.id,
                telefono: user.phoneNumber,
                nombre: user.name || 'Sin nombre',
                
                // FECHAS
                fechaRegistro: user.createdAt,
                ultimaActividad: user.lastActivity,
                diasSinActividad: daysSinceActivity,
                
                // CONVERSACIÓN
                threadId: thread?.openaiId || 'Sin thread',
                chatId: thread?.chatId || user.phoneNumber,
                estadoConversacion,
                
                // INTERACCIONES
                totalMensajes: allMessages.length,
                mensajesUsuario: userMessages.length,
                mensajesBot: botMessages.length,
                ultimoMensaje: lastMessage?.content.substring(0, 100) || 'Sin mensajes',
                fechaUltimoMensaje: lastMessage?.createdAt || user.createdAt,
                tipoUltimoMensaje: lastMessage?.role || 'assistant',
                
                // ETIQUETAS
                labels: (thread?.labels as string[]) || [],
                esNuevo: allMessages.length === 0,
                esPotencial: allMessages.length > 0 && daysSinceActivity <= 7,
                esClienteActivo: daysSinceActivity <= 1,
                
                // COMPORTAMIENTO SUGERIDO
                necesitaSeguimiento: daysSinceActivity > 3 && allMessages.length > 0,
                prioridadRespuesta,
                tiempoRespuestaSugerido,
                accionSugerida,
                
                // ANÁLISIS
                frecuenciaInteraccion,
                patronHorario: 'Por determinar', // Se podría calcular con más datos
                scoreInteres,
                
                // METADATA
                metadata: {
                    totalThreads: user.threads.length,
                    ultimoThreadActivo: thread?.lastActivity || user.lastActivity
                }
            };
        });

        return unifiedClients;
        
    } catch (error) {
        console.error('❌ Error creando vista unificada:', error);
        return [];
    } finally {
        await prisma.$disconnect();
    }
}

async function displayUnifiedView() {
    console.log('👥 VISTA UNIFICADA DE CLIENTES - INFORMACIÓN COMPLETA');
    console.log('====================================================\n');

    const clients = await createUnifiedClientView();
    
    if (clients.length === 0) {
        console.log('⚠️ No hay clientes registrados');
        return;
    }

    // RESUMEN EJECUTIVO
    console.log('📊 RESUMEN EJECUTIVO:');
    console.log(`   👥 Total Clientes: ${clients.length}`);
    console.log(`   🆕 Nuevos: ${clients.filter(c => c.esNuevo).length}`);
    console.log(`   🔥 Activos: ${clients.filter(c => c.esClienteActivo).length}`);
    console.log(`   💎 Potenciales: ${clients.filter(c => c.esPotencial).length}`);
    console.log(`   ⚠️ Necesitan Seguimiento: ${clients.filter(c => c.necesitaSeguimiento).length}`);
    console.log(`   📈 Score Promedio: ${(clients.reduce((sum, c) => sum + c.scoreInteres, 0) / clients.length).toFixed(1)}/10\n`);

    // DETALLES POR CLIENTE
    console.log('📋 INFORMACIÓN DETALLADA POR CLIENTE:');
    console.log('=====================================\n');

    clients.forEach((client, index) => {
        console.log(`${index + 1}. 📱 CLIENTE: ${client.telefono}`);
        console.log(`   👤 Nombre: ${client.nombre}`);
        console.log(`   🆔 ID: ${client.id}`);
        console.log(`   📅 Registro: ${client.fechaRegistro.toLocaleString('es-CO')}`);
        console.log(`   ⏰ Última Actividad: ${client.ultimaActividad.toLocaleString('es-CO')}`);
        console.log(`   📊 Días sin Actividad: ${client.diasSinActividad}`);
        console.log(`   🔄 Estado: ${client.estadoConversacion}`);
        console.log(`   💬 Thread ID: ${client.threadId}`);
        console.log(`   📞 Chat ID: ${client.chatId}`);
        
        console.log(`\n   📊 INTERACCIONES:`);
        console.log(`      📝 Total Mensajes: ${client.totalMensajes}`);
        console.log(`      👤 Mensajes Usuario: ${client.mensajesUsuario}`);
        console.log(`      🤖 Mensajes Bot: ${client.mensajesBot}`);
        console.log(`      💬 Último Mensaje: "${client.ultimoMensaje}"`);
        console.log(`      📅 Fecha Último Mensaje: ${client.fechaUltimoMensaje.toLocaleString('es-CO')}`);
        console.log(`      👤 Tipo: ${client.tipoUltimoMensaje === 'user' ? '👤 Usuario' : '🤖 Bot'}`);
        
        console.log(`\n   🏷️ CLASIFICACIÓN:`);
        console.log(`      🏷️ Labels: ${client.labels.length > 0 ? JSON.stringify(client.labels) : 'Sin etiquetas'}`);
        console.log(`      🆕 Es Nuevo: ${client.esNuevo ? '✅' : '❌'}`);
        console.log(`      💎 Es Potencial: ${client.esPotencial ? '✅' : '❌'}`);
        console.log(`      🔥 Es Cliente Activo: ${client.esClienteActivo ? '✅' : '❌'}`);
        
        console.log(`\n   🎯 COMPORTAMIENTO SUGERIDO:`);
        console.log(`      ⚠️ Necesita Seguimiento: ${client.necesitaSeguimiento ? '✅ SÍ' : '❌ No'}`);
        console.log(`      🔥 Prioridad: ${client.prioridadRespuesta}`);
        console.log(`      ⏱️ Tiempo Respuesta: ${client.tiempoRespuestaSugerido}`);
        console.log(`      💡 Acción Sugerida: ${client.accionSugerida}`);
        
        console.log(`\n   📈 ANÁLISIS:`);
        console.log(`      📊 Frecuencia: ${client.frecuenciaInteraccion}`);
        console.log(`      ⭐ Score Interés: ${client.scoreInteres}/10`);
        console.log(`      🕐 Patrón Horario: ${client.patronHorario}`);
        
        console.log(''.padEnd(60, '─'));
        console.log('');
    });

    // EXPORTAR A CSV PARA ANÁLISIS
    await exportUnifiedToCSV(clients);
}

async function exportUnifiedToCSV(clients: UnifiedClient[]) {
    const fs = require('fs');
    const path = require('path');
    
    const exportDir = './exports';
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir);
    }
    
    // Convertir a formato plano para CSV
    const csvData = clients.map(client => ({
        'Teléfono': client.telefono,
        'Nombre': client.nombre,
        'Fecha Registro': client.fechaRegistro.toLocaleDateString('es-CO'),
        'Última Actividad': client.ultimaActividad.toLocaleDateString('es-CO'),
        'Días sin Actividad': client.diasSinActividad,
        'Estado': client.estadoConversacion,
        'Total Mensajes': client.totalMensajes,
        'Mensajes Usuario': client.mensajesUsuario,
        'Mensajes Bot': client.mensajesBot,
        'Último Mensaje': client.ultimoMensaje,
        'Etiquetas': client.labels.join(', '),
        'Es Nuevo': client.esNuevo ? 'Sí' : 'No',
        'Es Potencial': client.esPotencial ? 'Sí' : 'No',
        'Cliente Activo': client.esClienteActivo ? 'Sí' : 'No',
        'Necesita Seguimiento': client.necesitaSeguimiento ? 'Sí' : 'No',
        'Prioridad': client.prioridadRespuesta,
        'Tiempo Respuesta': client.tiempoRespuestaSugerido,
        'Acción Sugerida': client.accionSugerida,
        'Score Interés': client.scoreInteres,
        'Frecuencia': client.frecuenciaInteraccion
    }));
    
    // Generar CSV
    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
            headers.map(header => {
                const value = row[header as keyof typeof row];
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');
    
    const filename = path.join(exportDir, 'clientes-completo.csv');
    fs.writeFileSync(filename, csvContent, 'utf8');
    
    console.log(`\n📊 ARCHIVO EXPORTADO:`);
    console.log(`   📁 ${filename}`);
    console.log(`   💡 Ábrelo en Excel para análisis completo`);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    displayUnifiedView();
}

export { createUnifiedClientView, displayUnifiedView };