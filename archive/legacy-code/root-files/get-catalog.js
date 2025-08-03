const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configuración
const WHAPI_TOKEN = process.env.WHAPI_TOKEN || 'hXoVA1qcPcFPQ0uh8AZckGzbPxquj7dZ';
const WHAPI_API_URL = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
const CONTACT_NUMBER = '573107433329'; // Sin espacios ni +

// Función para descargar imagen
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const buffer = await response.buffer();
        const imagePath = path.join('catalog-images', filename);
        
        // Crear directorio si no existe
        if (!fs.existsSync('catalog-images')) {
            fs.mkdirSync('catalog-images');
        }
        
        fs.writeFileSync(imagePath, buffer);
        return imagePath;
    } catch (error) {
        console.error(`❌ Error descargando imagen ${filename}:`, error.message);
        return null;
    }
}

async function getCatalog() {
    try {
        // Formar el ContactID correcto
        const contactId = `${CONTACT_NUMBER}@c.us`;
        console.log(`🔍 Obteniendo catálogo de: ${contactId}`);
        
        console.log('🔄 Consultando catálogo directamente...');
        
        // Obtener el catálogo - usar solo el número sin @c.us
        const response = await fetch(`${WHAPI_API_URL}/business/${CONTACT_NUMBER}/products`, {
            headers: {
                'Authorization': `Bearer ${WHAPI_TOKEN}`
            }
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.log(`❌ Error al obtener catálogo: ${response.status} - ${error}`);
            return;
        }
        
        const data = await response.json();
        console.log('\n📋 CATÁLOGO OBTENIDO:');
        console.log('='.repeat(50));
        
        if (!data.products || data.products.length === 0) {
            console.log('📭 No se encontraron productos en el catálogo');
            return;
        }
        
        // Extraer y mostrar datos solicitados
        const productos = [];
        
        for (let i = 0; i < data.products.length; i++) {
            const product = data.products[i];
            const index = i;
            
            const nombre = product.name || 'Sin nombre';
            const precio = product.price ? `$${product.price} ${product.currency || ''}` : 'Sin precio';
            const descripcion = product.description || 'Sin descripción';
            
            console.log(`\n${index + 1}. ${nombre}`);
            console.log(`   💰 Precio: ${precio}`);
            console.log(`   📝 Descripción: ${descripcion}`);
            
            // Descargar imágenes si existen
            const imagenes = [];
            if (product.media && product.media.length > 0) {
                console.log(`   📸 Descargando ${product.media.length} imagen(es)...`);
                
                for (let j = 0; j < product.media.length; j++) {
                    const media = product.media[j];
                    if (media.url) {
                        const extension = media.url.split('.').pop().split('?')[0] || 'jpg';
                        const filename = `producto_${product.id}_imagen_${j+1}.${extension}`;
                        const localPath = await downloadImage(media.url, filename);
                        
                        if (localPath) {
                            imagenes.push({
                                url: media.url,
                                localPath: localPath,
                                filename: filename
                            });
                            console.log(`   ✅ Imagen guardada: ${filename}`);
                        }
                    }
                }
            } else {
                console.log(`   📸 Sin imágenes disponibles`);
            }
            
            // Generar enlace de WhatsApp para el producto
            const waLink = `https://wa.me/p/${product.id}/${CONTACT_NUMBER}`;
            
            productos.push({
                nombre,
                precio: product.price,
                moneda: product.currency,
                descripcion,
                id: product.id,
                disponibilidad: product.availability,
                imagenes: imagenes,
                totalImagenes: imagenes.length,
                enlaceWhatsApp: waLink
            });
            
            console.log(`   🔗 Enlace: ${waLink}`);
        }
        
        console.log('\n='.repeat(50));
        console.log(`✅ Total productos encontrados: ${productos.length}`);
        
        const totalImagenes = productos.reduce((sum, p) => sum + p.totalImagenes, 0);
        console.log(`📸 Total imágenes descargadas: ${totalImagenes}`);
        
        // Guardarlo en JSON para fácil acceso
        fs.writeFileSync('catalogo-with-images.json', JSON.stringify(productos, null, 2));
        console.log('💾 Datos guardados en: catalogo-with-images.json');
        console.log('📁 Imágenes guardadas en: catalog-images/');
        
        return productos;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Ejecutar
getCatalog();