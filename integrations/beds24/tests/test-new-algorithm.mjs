import axios from 'axios';

console.log('🧪 TEST: Nuevo Algoritmo Multi-Estrategia');
console.log('='*60);

// Simular las 3 estrategias del nuevo algoritmo
async function testNewAlgorithm() {
    const BEDS24_TOKEN = process.env.BEDS24_TOKEN || 'NPYMgbAIjwWRgBg40noyUysPRWwSbqlOTj1ms6c86IMqNyK5hih7Bd76E+JIV74yokryJ8yVWEMw49pv5nTnaxxQwzFrhxd6/8F7+GyIIE7hSPz9d2tQ2kmUS/dXcqICx7BC1trE3E+E4dDov0Ajzw==';
    const BEDS24_API_URL = 'https://api.beds24.com/v2';
    
    const startDate = '2025-07-10';
    const endDate = '2025-07-20';
    
    console.log(`🗓️ Testeando: ${startDate} al ${endDate} (10 noches)`);
    console.log('🎯 Objetivo: Demostrar múltiples opciones diferentes\n');
    
    try {
        // Obtener nombres de propiedades
        console.log('📋 Obteniendo propiedades...');
        const propsResponse = await axios.get(`${BEDS24_API_URL}/properties`, {
            headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN },
            timeout: 15000
        });
        
        const propertyNames = {};
        if (propsResponse.data.success && propsResponse.data.data) {
            propsResponse.data.data.forEach(property => {
                propertyNames[property.id] = property.name;
            });
        }
        console.log(`✅ ${Object.keys(propertyNames).length} propiedades mapeadas\n`);
        
        // Consultas paralelas
        console.log('🔄 Consultando disponibilidad y precios...');
        const [availabilityResponse, calendarResponse] = await Promise.all([
            axios.get(`${BEDS24_API_URL}/inventory/rooms/availability`, {
                headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN },
                params: { startDate, endDate },
                timeout: 15000
            }),
            axios.get(`${BEDS24_API_URL}/inventory/rooms/calendar`, {
                headers: { 'Accept': 'application/json', 'token': BEDS24_TOKEN },
                params: { 
                    startDate, 
                    endDate,
                    includePrices: true,
                    includeNumAvail: true
                },
                timeout: 15000
            })
        ]);
        
        // Procesar datos
        const dateRange = generateDateRange(startDate, endDate);
        const propertyData = {};
        
        // Procesar disponibilidad
        if (availabilityResponse.data.success && availabilityResponse.data.data) {
            availabilityResponse.data.data.forEach(room => {
                propertyData[room.propertyId] = {
                    propertyId: room.propertyId,
                    propertyName: propertyNames[room.propertyId] || `Propiedad ${room.propertyId}`,
                    roomName: room.name,
                    roomId: room.roomId,
                    availability: room.availability,
                    prices: {}
                };
            });
        }
        
        // Procesar precios
        if (calendarResponse.data.success && calendarResponse.data.data) {
            calendarResponse.data.data.forEach(roomData => {
                const propertyId = roomData.propertyId;
                if (propertyData[propertyId] && roomData.calendar) {
                    roomData.calendar.forEach(calItem => {
                        if (calItem.price1) {
                            const dates = generateDateRange(calItem.from, calItem.to || calItem.from);
                            dates.forEach(date => {
                                if (dateRange.includes(date)) {
                                    propertyData[propertyId].prices[date] = calItem.price1;
                                }
                            });
                        }
                    });
                }
            });
        }
        
        // Clasificar opciones
        const partialOptions = Object.values(propertyData).filter(property => {
            const availableDates = dateRange.filter(date => property.availability[date]);
            return availableDates.length > 0 && availableDates.length < dateRange.length;
        });
        
        console.log(`📊 ${partialOptions.length} propiedades con disponibilidad parcial\n`);
        
        // DEMOSTRAR LAS 3 ESTRATEGIAS
        console.log('🎯 APLICANDO ESTRATEGIAS DIFERENTES:\n');
        
        // ESTRATEGIA 1: Maximizar noches consecutivas
        console.log('🏆 ESTRATEGIA 1: Maximizar Noches Consecutivas');
        console.log('─'.repeat(45));
        const option1 = findBestConsecutiveOption(partialOptions, dateRange, 'maxNights');
        if (option1) {
            displayOption(option1, 1);
        } else {
            console.log('❌ No se encontró opción válida\n');
        }
        
        // ESTRATEGIA 2: Minimizar precio
        console.log('💰 ESTRATEGIA 2: Minimizar Precio Total');
        console.log('─'.repeat(35));
        const option2 = findBestConsecutiveOption(partialOptions, dateRange, 'minPrice');
        if (option2) {
            displayOption(option2, 2);
        } else {
            console.log('❌ No se encontró opción válida\n');
        }
        
        // ESTRATEGIA 3: Empezar con propiedad diferente
        console.log('🔄 ESTRATEGIA 3: Empezar con Propiedad Diferente');
        console.log('─'.repeat(45));
        const option3 = findBestConsecutiveOption(partialOptions, dateRange, 'different');
        if (option3) {
            displayOption(option3, 3);
        } else {
            console.log('❌ No se encontró opción válida\n');
        }
        
        // FORMATO FINAL PARA OPENAI
        console.log('🤖 FORMATO OPTIMIZADO PARA OPENAI:');
        console.log('═'.repeat(50));
        
        const finalOptions = [option1, option2, option3].filter(Boolean);
        if (finalOptions.length > 0) {
            console.log('🥈 **ALTERNATIVAS CON TRASLADO** (por disponibilidad limitada - posible descuento)');
            
            finalOptions.forEach((option, index) => {
                console.log(`🔄 **Opción ${index + 1}**: ${option.transfers} traslado${option.transfers > 1 ? 's' : ''} - $${option.totalPrice.toLocaleString()}`);
                option.properties.forEach((prop, propIndex) => {
                    const dates = prop.dates.length > 1 ? 
                        `${prop.dates[0]} a ${prop.dates[prop.dates.length - 1]}` : 
                        prop.dates[0];
                    console.log(`   ${propIndex === 0 ? '🏠' : '🔄'} ${prop.propertyName}: ${dates} (${prop.nights} noches) - $${prop.price.toLocaleString()}`);
                });
                console.log('');
            });
        }
        
        console.log('✅ Test completado - Múltiples opciones generadas exitosamente');
        
    } catch (error) {
        console.error('❌ Error en test:', error.message);
    }
}

// Helper functions
function generateDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
        dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
}

function findBestConsecutiveOption(partialOptions, dateRange, strategy) {
    const usedProperties = new Set();
    const properties = [];
    let currentDateIndex = 0;
    let totalPrice = 0;
    let totalNights = 0;
    
    while (currentDateIndex < dateRange.length) {
        const currentDate = dateRange[currentDateIndex];
        let bestOption = null;
        let bestScore = strategy === 'minPrice' ? Infinity : 0;
        let bestConsecutiveDays = 0;
        
        for (const option of partialOptions) {
            if (usedProperties.has(option.propertyId)) continue;
            
            let consecutiveDays = 0;
            let tempPrice = 0;
            
            if (option.availability[currentDate]) {
                for (let j = currentDateIndex; j < dateRange.length; j++) {
                    const checkDate = dateRange[j];
                    if (option.availability[checkDate]) {
                        consecutiveDays++;
                        tempPrice += option.prices[checkDate] || 0;
                    } else {
                        break;
                    }
                }
            }
            
            if (consecutiveDays > 0) {
                let score;
                let isWinner = false;
                
                if (strategy === 'maxNights') {
                    score = consecutiveDays;
                    isWinner = score > bestScore;
                } else if (strategy === 'minPrice') {
                    score = tempPrice / consecutiveDays; // precio por noche
                    isWinner = score < bestScore;
                } else if (strategy === 'different') {
                    // Preferir propiedades no usadas en estrategias anteriores
                    score = consecutiveDays;
                    isWinner = score > bestScore && 
                              !['1421 B', '1001'].includes(option.propertyName);
                }
                
                if (isWinner) {
                    bestScore = score;
                    bestConsecutiveDays = consecutiveDays;
                    bestOption = option;
                }
            }
        }
        
        if (!bestOption || bestConsecutiveDays === 0) {
            return null;
        }
        
        const stayDates = dateRange.slice(currentDateIndex, currentDateIndex + bestConsecutiveDays);
        const stayPrice = stayDates.reduce((sum, date) => sum + (bestOption.prices[date] || 0), 0);
        
        properties.push({
            propertyName: bestOption.propertyName,
            roomName: bestOption.roomName,
            nights: bestConsecutiveDays,
            dates: stayDates,
            price: stayPrice
        });
        
        usedProperties.add(bestOption.propertyId);
        currentDateIndex += bestConsecutiveDays;
        totalPrice += stayPrice;
        totalNights += bestConsecutiveDays;
    }
    
    if (totalNights === dateRange.length) {
        return {
            transfers: properties.length - 1,
            totalPrice,
            totalNights,
            properties
        };
    }
    
    return null;
}

function displayOption(option, number) {
    console.log(`✅ **Opción ${number}**: ${option.transfers} traslado${option.transfers > 1 ? 's' : ''} - $${option.totalPrice.toLocaleString()}`);
    
    option.properties.forEach((prop, index) => {
        const dates = prop.dates.length > 1 ? 
            `${prop.dates[0]} a ${prop.dates[prop.dates.length - 1]}` : 
            prop.dates[0];
        console.log(`   ${index === 0 ? '🏠' : '🔄'} ${prop.propertyName}: ${dates} (${prop.nights} noches) - $${prop.price.toLocaleString()}`);
    });
    
    console.log(`   📊 Promedio: $${Math.round(option.totalPrice / option.totalNights).toLocaleString()}/noche\n`);
}

// Ejecutar test
testNewAlgorithm(); 