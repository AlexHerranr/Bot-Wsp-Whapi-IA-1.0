/**
 * Migration Script: Convert PostgreSQL data to Real WHAPI Format
 * Converts phoneNumber from @c.us format to @s.whatsapp.net format
 * Eliminates unnecessary format conversion logic
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  totalUsers: number;
  migrated: number;
  errors: number;
  alreadyCorrect: number;
}

async function migrateToRealWhapiFormat(): Promise<MigrationStats> {
  console.log('🔄 Starting migration to Real WHAPI Format...');
  console.log('📱 Converting @c.us → @s.whatsapp.net');
  
  const stats: MigrationStats = {
    totalUsers: 0,
    migrated: 0,
    errors: 0,
    alreadyCorrect: 0
  };

  try {
    // Get all users
    const allUsers = await prisma.clientView.findMany({
      select: {
        phoneNumber: true,
        userName: true,
        prioridad: true
      }
    });

    stats.totalUsers = allUsers.length;
    console.log(`📊 Found ${stats.totalUsers} users to process`);

    // Process each user
    for (const user of allUsers) {
      try {
        const oldPhoneNumber = user.phoneNumber;
        
        // Check if already in correct format
        if (oldPhoneNumber.includes('@s.whatsapp.net')) {
          stats.alreadyCorrect++;
          console.log(`✅ Already correct: ${oldPhoneNumber}`);
          continue;
        }

        // Convert format: 573003913251@c.us → 573003913251@s.whatsapp.net
        let newPhoneNumber: string;
        
        if (oldPhoneNumber.includes('@c.us')) {
          newPhoneNumber = oldPhoneNumber.replace('@c.us', '@s.whatsapp.net');
        } else if (oldPhoneNumber.match(/^\d+$/)) {
          // Just a phone number without format
          newPhoneNumber = `${oldPhoneNumber}@s.whatsapp.net`;
        } else {
          console.log(`⚠️ Unknown format: ${oldPhoneNumber}`);
          stats.errors++;
          continue;
        }

        console.log(`🔄 Converting: ${oldPhoneNumber} → ${newPhoneNumber}`);

        // Get full user data
        const fullUserData = await prisma.clientView.findUnique({
          where: { phoneNumber: oldPhoneNumber }
        });

        if (!fullUserData) {
          console.log(`❌ User data not found: ${oldPhoneNumber}`);
          stats.errors++;
          continue;
        }

        // Check if new phoneNumber already exists
        const existingUser = await prisma.clientView.findUnique({
          where: { phoneNumber: newPhoneNumber }
        });

        if (existingUser) {
          console.log(`⚠️ Target phoneNumber already exists: ${newPhoneNumber}`);
          console.log(`   Deleting old format: ${oldPhoneNumber}`);
          
          // Delete the old format entry
          await prisma.clientView.delete({
            where: { phoneNumber: oldPhoneNumber }
          });
          
          stats.migrated++;
          continue;
        }

        // Create new record with correct format
        await prisma.clientView.create({
          data: {
            phoneNumber: newPhoneNumber,
            name: fullUserData.name,
            userName: fullUserData.userName,
            perfilStatus: fullUserData.perfilStatus,
            proximaAccion: fullUserData.proximaAccion,
            prioridad: fullUserData.prioridad,
            label1: fullUserData.label1,
            label2: fullUserData.label2,
            label3: fullUserData.label3,
            chatId: fullUserData.chatId,
            lastActivity: fullUserData.lastActivity,
            threadId: fullUserData.threadId
          }
        });

        // Delete old record
        await prisma.clientView.delete({
          where: { phoneNumber: oldPhoneNumber }
        });

        stats.migrated++;
        console.log(`✅ Migrated: ${oldPhoneNumber} → ${newPhoneNumber}`);

      } catch (error) {
        console.error(`❌ Error migrating ${user.phoneNumber}:`, error);
        stats.errors++;
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }

  return stats;
}

async function main() {
  try {
    console.log('🚀 WHAPI Format Migration Started');
    console.log('📅 Date:', new Date().toISOString());
    
    const stats = await migrateToRealWhapiFormat();
    
    console.log('\n📊 Migration Results:');
    console.log(`📱 Total users: ${stats.totalUsers}`);
    console.log(`✅ Migrated: ${stats.migrated}`);
    console.log(`✅ Already correct: ${stats.alreadyCorrect}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    if (stats.errors > 0) {
      console.log('\n⚠️ Some errors occurred during migration');
    } else {
      console.log('\n🎉 Migration completed successfully!');
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const allUsers = await prisma.clientView.findMany({
      select: { phoneNumber: true },
      take: 10
    });

    console.log('📊 Sample phoneNumbers after migration:');
    allUsers.forEach(user => {
      console.log(`  📱 ${user.phoneNumber}`);
    });

    const cUsCount = await prisma.clientView.count({
      where: {
        phoneNumber: {
          contains: '@c.us'
        }
      }
    });

    const whatsappNetCount = await prisma.clientView.count({
      where: {
        phoneNumber: {
          contains: '@s.whatsapp.net'
        }
      }
    });

    console.log(`\n📊 Format verification:`);
    console.log(`  @c.us format: ${cUsCount} users`);
    console.log(`  @s.whatsapp.net format: ${whatsappNetCount} users`);

    if (cUsCount === 0) {
      console.log('✅ All users now use real WHAPI format!');
    } else {
      console.log('⚠️ Some users still use old format');
    }

  } catch (error) {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { migrateToRealWhapiFormat };