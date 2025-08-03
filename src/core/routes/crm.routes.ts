import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { container } from 'tsyringe';
import { DatabaseService } from '../services/database.service';
import { SimpleCRMService } from '../services/simple-crm.service';
import { DailyActionsJob } from '../jobs/daily-actions.job';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Endpoint para N8N: Enviar seguimiento personalizado
router.post('/send-followup', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, profileStatus, proximaAccion, userName } = req.body;

    if (!phoneNumber || !profileStatus || !proximaAccion) {
      res.status(400).json({ 
        success: false, 
        error: 'Faltan campos requeridos: phoneNumber, profileStatus, proximaAccion' 
      });
      return;
    }

    const prompt = `Genera un mensaje personalizado para seguimiento de cliente:

    Perfil del cliente: ${profileStatus}
    Acción programada: ${proximaAccion}
    Nombre: ${userName || 'Cliente'}
    
    Contexto: Empresa TeAlquilamos (hoteles en Colombia). 
    Genera un mensaje amigable y profesional para WhatsApp.
    El mensaje debe ser directo, útil y motivar una respuesta del cliente.
    Máximo 200 palabras.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const message = response.choices[0]?.message?.content;
    
    if (!message) {
      throw new Error('No se generó mensaje de seguimiento');
    }

    // Obtener chatId del cliente
    const db = container.resolve(DatabaseService);
    const client = await db.getClientByPhone(phoneNumber);
    
    if (!client?.chatId) {
      res.status(404).json({ 
        success: false, 
        error: 'Cliente no encontrado o sin chatId' 
      });
      return;
    }

    // Enviar mensaje de WhatsApp
    const whapiResponse = await fetch(`${process.env.WHAPI_API_URL}/messages/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHAPI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: client.chatId,
        body: message
      })
    });

    if (!whapiResponse.ok) {
      throw new Error(`WHAPI error: ${whapiResponse.status}`);
    }

    // Limpiar la acción completada
    await db.updateClient(phoneNumber, {
      proximaAccion: null,
      fechaProximaAccion: null
    });

    res.json({ 
      success: true, 
      message: 'Seguimiento enviado correctamente',
      generatedText: message
    });

  } catch (error) {
    console.error('❌ Error en /send-followup:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    });
  }
});

// Endpoint para N8N: Analizar conversación y actualizar CRM
router.post('/analyze-conversation', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      res.status(400).json({ 
        success: false, 
        error: 'phoneNumber es requerido' 
      });
      return;
    }

    const crmService = container.resolve(SimpleCRMService);
    await crmService.analyzeAndUpdate(phoneNumber);

    res.json({ 
      success: true, 
      message: 'Análisis CRM completado' 
    });

  } catch (error) {
    console.error('❌ Error en /analyze-conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    });
  }
});

// Endpoint para obtener clientes con acciones pendientes para hoy
router.get('/today-actions', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = container.resolve(DatabaseService);
    const clients = await db.getClientsWithActionToday();

    res.json({
      success: true,
      count: clients.length,
      clients: clients.map(client => ({
        phoneNumber: client.phoneNumber,
        userName: client.userName,
        profileStatus: client.profileStatus,
        proximaAccion: client.proximaAccion,
        fechaProximaAccion: client.fechaProximaAccion,
        prioridad: client.prioridad
      }))
    });

  } catch (error) {
    console.error('❌ Error en /today-actions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    });
  }
});

// Endpoint para ejecutar daily actions manualmente (testing)
router.post('/execute-daily-actions', async (req: Request, res: Response): Promise<void> => {
  try {
    const dailyJob = container.resolve(DailyActionsJob);
    await dailyJob.executeManual();

    res.json({ 
      success: true, 
      message: 'Daily actions ejecutadas correctamente' 
    });

  } catch (error) {
    console.error('❌ Error en /execute-daily-actions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    });
  }
});

// Endpoint para obtener estado del sistema CRM
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = container.resolve(DatabaseService);
    const dailyJob = container.resolve(DailyActionsJob);
    
    const dbStatus = db.getConnectionStatus();
    const jobStatus = dailyJob.getStatus();

    res.json({
      success: true,
      crm_mode: process.env.CRM_MODE || 'internal',
      crm_enabled: process.env.CRM_ANALYSIS_ENABLED === 'true',
      database: dbStatus,
      daily_job: jobStatus,
      assistant_id: process.env.CRM_ASSISTANT_ID || 'not_configured'
    });

  } catch (error) {
    console.error('❌ Error en /status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    });
  }
});

export { router as crmRoutes };