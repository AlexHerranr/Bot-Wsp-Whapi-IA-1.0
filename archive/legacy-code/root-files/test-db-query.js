// Test database query for CRM issue
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQuery() {
  try {
    console.log('🔍 Testing database query for 573003913251...');
    
    // Test 1: Check if client exists
    const client = await prisma.clientView.findUnique({
      where: { phoneNumber: '573003913251' }
    });
    
    console.log('📊 Query result:', client);
    
    if (client) {
      console.log('✅ Client found:');
      console.log('  - phoneNumber:', client.phoneNumber);
      console.log('  - chatId:', client.chatId);
      console.log('  - userName:', client.userName);
    } else {
      console.log('❌ Client not found');
      
      // Check if exists with different format
      const altClient = await prisma.clientView.findFirst({
        where: {
          OR: [
            { phoneNumber: { contains: '573003913251' } },
            { chatId: { contains: '573003913251' } }
          ]
        }
      });
      
      if (altClient) {
        console.log('⚠️ Found client with different format:', altClient);
      } else {
        console.log('❌ No client found with any format');
      }
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();