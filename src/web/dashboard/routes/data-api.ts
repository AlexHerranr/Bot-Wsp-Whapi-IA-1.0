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
        
        // Obtener clientes
        const clients = await dbService['prisma'].whatsApp.findMany({
            orderBy: { lastActivity: 'desc' }
        });
        
        // Calcular clientes activos hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeToday = await dbService['prisma'].whatsApp.count({
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
            users: clients.map(client => ({
                id: client.phoneNumber,
                phone: client.phoneNumber,
                name: client.name || client.userName || client.phoneNumber,
                created: client.lastActivity,
                lastActivity: client.lastActivity,
                threads: client.threadId ? 1 : 0,
                totalMessages: 0
            })),
            threads: clients.filter(c => c.threadId).map(client => ({
                id: client.threadId,
                openaiId: client.threadId,
                userPhone: client.phoneNumber,
                userName: client.name || client.userName || client.phoneNumber,
                chatId: client.chatId,
                created: client.lastActivity,
                lastActivity: client.lastActivity,
                messages: 0,
                labels: []
            })),
            messages: []
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
router.post('/users', async (req: any, res: any) => {
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
                id: user.phoneNumber,
                phone: user.phoneNumber,
                name: user.name,
                created: user.lastActivity,
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
router.post('/messages', async (req: any, res: any) => {
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
        
        // Guardar mensaje (implementación simplificada)
        await dbService.saveMessage({
            user_id: thread.chatId,
            chat_id: thread.threadId,
            role: role as 'user' | 'assistant',
            content: content,
            response_id: null,
            timestamp: new Date()
        });
        
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
        
        // Eliminar cliente
        await dbService['prisma'].whatsApp.delete({
            where: { phoneNumber: id }
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
router.get('/export/csv', async (req: any, res: any) => {
    try {
        const { table } = req.query;
        
        await dbService.connect();
        
        let data;
        let filename;
        
        switch (table) {
            case 'users':
            case 'threads':
            case 'messages':
                data = await dbService['prisma'].whatsApp.findMany();
                filename = 'clientes.csv';
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