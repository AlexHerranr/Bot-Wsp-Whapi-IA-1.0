// Test CRM query to debug why getChatIdByPhone returns null
const { PrismaClient } = require('@prisma/client');

class TestDatabaseService {
  constructor() {
    this.prisma = new PrismaClient();
    this.isConnected = true;
  }
  
  async getClientByPhone(phoneNumber) {
    return await this.findUserByPhoneNumber(phoneNumber);
  }
  
  async findUserByPhoneNumber(phoneNumber) {
    if (this.isConnected) {
      try {
        return await this.prisma.clientView.findUnique({ where: { phoneNumber } });
      } catch (error) {
        console.warn(`⚠️ Error buscando usuario en PostgreSQL: ${error.message}`);
        this.isConnected = false;
        return null;
      }
    }
    return null;
  }
  
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

async function testCRMQuery() {
  const db = new TestDatabaseService();
  
  try {
    console.log('🔍 Testing CRM getChatIdByPhone for 573003913251...');
    
    // Test the exact method that CRM is using
    const client = await db.getClientByPhone('573003913251');
    console.log('📊 getClientByPhone result:', client);
    
    if (client) {
      console.log('✅ Client found via getClientByPhone:');
      console.log('  - phoneNumber:', client.phoneNumber);
      console.log('  - chatId:', client.chatId);
      console.log('  - chatId type:', typeof client.chatId);
      console.log('  - chatId null?:', client.chatId === null);
    } else {
      console.log('❌ getClientByPhone returned null');
    }
    
    // Test direct findUserByPhoneNumber
    const directClient = await db.findUserByPhoneNumber('573003913251');
    console.log('📊 findUserByPhoneNumber result:', directClient);
    
  } catch (error) {
    console.error('❌ CRM query error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await db.disconnect();
  }
}

testCRMQuery();