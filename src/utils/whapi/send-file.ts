/**
 * Utilidad para enviar archivos por WhatsApp usando WHAPI
 */

import axios from 'axios';
import { logInfo, logError, logSuccess } from '../logging/index.js';

/**
 * Envía un archivo PDF por WhatsApp
 */
export async function sendPDFViaWhatsApp(
  chatId: string,
  pdfBuffer: Buffer,
  fileName: string,
  caption?: string
): Promise<any> {
  try {
    const whapiToken = process.env.WHAPI_TOKEN;
    const whapiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
    
    if (!whapiToken) {
      throw new Error('WHAPI_TOKEN no configurado');
    }

    // Asegurar que el chatId tenga el formato correcto
    const formattedChatId = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    
    logInfo('WHAPI_SEND_FILE', `Enviando PDF ${fileName} a ${formattedChatId}`);

    // Convertir el PDF a base64
    const base64PDF = pdfBuffer.toString('base64');
    const mimeType = 'application/pdf';
    
    // Construir el data URL
    const media = `data:${mimeType};base64,${base64PDF}`;

    // Enviar el archivo usando WHAPI
    const response = await axios.post(
      `${whapiUrl}/messages/document`,
      {
        to: formattedChatId,
        media: media,
        filename: fileName,
        caption: caption || `📄 ${fileName}`
      },
      {
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos timeout
      }
    );

    logSuccess('WHAPI_SEND_FILE', `✅ PDF enviado exitosamente: ${fileName}`, {
      messageId: response.data?.message?.id,
      chatId: formattedChatId
    });

    return response.data;
    
  } catch (error: any) {
    logError('WHAPI_SEND_FILE', `❌ Error enviando PDF`, {
      error: error.message,
      fileName,
      chatId,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

/**
 * Envía una imagen por WhatsApp
 */
export async function sendImageViaWhatsApp(
  chatId: string,
  imageBuffer: Buffer,
  caption?: string,
  mimeType: string = 'image/jpeg'
): Promise<any> {
  try {
    const whapiToken = process.env.WHAPI_TOKEN;
    const whapiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
    
    if (!whapiToken) {
      throw new Error('WHAPI_TOKEN no configurado');
    }

    // Asegurar que el chatId tenga el formato correcto
    const formattedChatId = chatId.includes('@') ? chatId : `${chatId}@s.whatsapp.net`;
    
    logInfo('WHAPI_SEND_FILE', `Enviando imagen a ${formattedChatId}`);

    // Convertir la imagen a base64
    const base64Image = imageBuffer.toString('base64');
    
    // Construir el data URL
    const media = `data:${mimeType};base64,${base64Image}`;

    // Enviar la imagen usando WHAPI
    const response = await axios.post(
      `${whapiUrl}/messages/image`,
      {
        to: formattedChatId,
        media: media,
        caption: caption
      },
      {
        headers: {
          'Authorization': `Bearer ${whapiToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos timeout
      }
    );

    logSuccess('WHAPI_SEND_FILE', `✅ Imagen enviada exitosamente`, {
      messageId: response.data?.message?.id,
      chatId: formattedChatId
    });

    return response.data;
    
  } catch (error: any) {
    logError('WHAPI_SEND_FILE', `❌ Error enviando imagen`, {
      error: error.message,
      chatId,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

// Exportar funciones
export default {
  sendPDFViaWhatsApp,
  sendImageViaWhatsApp
};