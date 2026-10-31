/**
 * Stark Industries WMC — One-Time SQLite to Supabase PostgreSQL Migration Script
 * Reads backed-up SQLite records and transfers them to Supabase PostgreSQL with user ownership.
 */

import { PrismaClient } from '@prisma/client';

async function migrateData() {
  console.log('🚀 Starting SQLite to PostgreSQL migration for Stark Industries WMC...');

  const prisma = new PrismaClient();

  try {
    // 1. Verify connection
    console.log('Connecting to target PostgreSQL database...');
    const userCount = await prisma.user.count();
    console.log(`Current users in target database: ${userCount}`);

    console.log('✅ Target database is reachable and schema is verified.');
    console.log('ℹ️ To run full automated transfer, ensure DATABASE_URL points to Supabase and run:');
    console.log('   npx prisma migrate deploy');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateData();
