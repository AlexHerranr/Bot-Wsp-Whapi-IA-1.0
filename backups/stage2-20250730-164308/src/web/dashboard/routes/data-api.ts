// src/web/dashboard/routes/data-api.ts
import express from 'express';
import { DatabaseService } from '../../../core/services/database.service';

const router = express.Router();
const dbService = new DatabaseService();

// GET /api/data - Obtener todos los datos
router.get('/data', async (req, res) => {
    try {
        await dbService.connect();
        
        // Obtener estadísticas
        const stats = await dbService.getStats();
        
        // Obtener usuarios con threads
        const users = await dbService['prisma'].user.findMany({
            include: {
                threads: {
                    include: {
                        messages: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        
        // Obtener threads con usuarios
        const threads = await dbService['prisma'].thread.findMany({
            include: {
                user: true,
                messages: true
            },
            orderBy: { createdAt: 'desc' }
        });
        
        // Obtener mensajes con threads y usuarios
        const messages = await dbService['prisma'].message.findMany({
            include: {
                thread: {
                    include: {
                        user: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100 // Limitar a 100 mensajes más recientes
        });
        
        // Calcular usuarios activos hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeToday = await dbService['prisma'].user.count({
            where: {
                lastActivity: {
                    gte: today
                }
            }
        });
        
        const response = {
            stats: {
                ...stats,
                activeToday
            },
            users: users.map(user => ({
                id: user.id,
                phone: user.phoneNumber,
                name: user.name || user.phoneNumber,
                created: user.createdAt,
                lastActivity: user.lastActivity,
                threads: user.threads.length,
                totalMessages: user.threads.reduce((sum, thread) => sum + thread.messages.length, 0)
            })),
            threads: threads.map(thread => ({
                id: thread.id,
                openaiId: thread.openaiId,
                userPhone: thread.user.phoneNumber,
                userName: thread.user.name || thread.user.phoneNumber,
                chatId: thread.chatId,
                created: thread.createdAt,
                lastActivity: thread.lastActivity,
                messages: thread.messages.length,
                labels: thread.labels || []
            })),
            messages: messages.map(message => ({
                id: message.id,
                threadId: message.threadId,
                threadOpenaiId: message.thread.openaiId,
                userPhone: message.thread.user.phoneNumber,
                userName: message.thread.user.name || message.thread.user.phoneNumber,
                role: message.role,
                content: message.content,
                created: message.createdAt,
                metadata: message.metadata
            }))
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        await dbService.disconnect();
    }
});

// POST /api/users - Crear usuario
router.post('/users', async (req, res) => {
    try {
        const { phoneNumber, name } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'phoneNumber es requerido' });
        }
        
        await dbService.connect();
        const user = await dbService.getOrCreateUser(phoneNumber, name);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                phone: user.phoneNumber,
                name: user.name,
                created: user.createdAt,
                lastActivity: user.lastActivity
            }
        });
        
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ error: 'Error creando usuario' });
    } finally {
        await dbService.disconnect();
    }
});

// POST /api/messages - Crear mensaje
router.post('/messages', async (req, res) => {
    try {
        const { userPhone, role, content } = req.body;
        
        if (!userPhone || !role || !content) {
            return res.status(400).json({ error: 'userPhone, role y content son requeridos' });
        }
        
        await dbService.connect();
        
        // Obtener o crear usuario
        const user = await dbService.getOrCreateUser(userPhone, userPhone);
        
        // Obtener o crear thread
        let thread = await dbService.getThread(userPhone);
        if (!thread) {
            const newThreadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            thread = await dbService.saveOrUpdateThread(userPhone, {
                threadId: newThreadId,
                chatId: userPhone,
                userName: userPhone,
                labels: []
            });
        }
        
        // Guardar mensaje
        await dbService.saveMessage(thread.threadId, role as 'user' | 'assistant', content);
        
        res.json({
            success: true,
            message: 'Mensaje guardado correctamente'
        });
        
    } catch (error) {
        console.error('Error guardando mensaje:', error);
        res.status(500).json({ error: 'Error guardando mensaje' });
    } finally {
        await dbService.disconnect();
    }
});

// DELETE /api/users/:id - Eliminar usuario
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await dbService.connect();
        
        // Eliminar mensajes relacionados
        await dbService['prisma'].message.deleteMany({
            where: {
                thread: {
                    userId: id
                }
            }
        });
        
        // Eliminar threads
        await dbService['prisma'].thread.deleteMany({
            where: { userId: id }
        });
        
        // Eliminar usuario
        await dbService['prisma'].user.delete({
            where: { id }
        });
        
        res.json({ success: true, message: 'Usuario eliminado correctamente' });
        
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error eliminando usuario' });
    } finally {
        await dbService.disconnect();
    }
});

// GET /api/export/csv - Exportar a CSV
router.get('/export/csv', async (req, res) => {
    try {
        const { table } = req.query;
        
        await dbService.connect();
        
        let data;
        let filename;
        
        switch (table) {
            case 'users':
                data = await dbService['prisma'].user.findMany();
                filename = 'usuarios.csv';
                break;
            case 'threads':
                data = await dbService['prisma'].thread.findMany({
                    include: { user: true }
                });
                filename = 'threads.csv';
                break;
            case 'messages':
                data = await dbService['prisma'].message.findMany({
                    include: {
                        thread: {
                            include: { user: true }
                        }
                    }
                });
                filename = 'mensajes.csv';
                break;
            default:
                return res.status(400).json({ error: 'Tabla no válida' });
        }
        
        // Convertir a CSV
        const csv = convertToCSV(data);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
    } catch (error) {
        console.error('Error exportando CSV:', error);
        res.status(500).json({ error: 'Error exportando datos' });
    } finally {
        await dbService.disconnect();
    }
});

// Función auxiliar para convertir a CSV
function convertToCSV(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => 
        headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value);
            const str = String(value);
            return str.includes(',') || str.includes('"') || str.includes('\n') 
                ? `"${str.replace(/"/g, '""')}"` 
                : str;
        }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
}

export default router;