/**
 * Stark Industries WMC — Initial User Accounts Seed (Development Only)
 * Reads credentials from environment variables or uses dummy non-production passwords.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  Development seed script blocked in production.');
    return;
  }

  console.log('🔐 Seeding initial local development test accounts...');
  const devPassword = process.env.DEV_SEED_PASSWORD || 'StarkDev#2026!';
  const passwordHash = await bcrypt.hash(devPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@stark.warehouse' },
    update: {},
    create: {
      email: 'admin@stark.warehouse',
      username: 'admin',
      name: 'Tony Stark',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@stark.warehouse' },
    update: {},
    create: {
      email: 'operator@stark.warehouse',
      username: 'operator',
      name: 'Lab Operator',
      passwordHash,
      role: 'USER',
    },
  });

  console.log('✅ Development accounts configured safely.');
}

main()
  .catch((e) => {
    console.error('Error seeding users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
