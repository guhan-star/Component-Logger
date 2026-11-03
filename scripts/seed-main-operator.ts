/**
 * Stark Industries WMC — Controlled Administrator Provisioning
 * Reads credentials from environment variables (ADMIN_EMAIL, ADMIN_PASSWORD).
 * Never hardcodes plaintext passwords in source control.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log('ℹ️  No ADMIN_EMAIL / ADMIN_PASSWORD configured in environment. Skipping automatic admin seed.');
    console.log('💡 Use "npx ts-node scripts/manage-admin.ts <email> <password>" for controlled provisioning.');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const username = adminEmail.split('@')[0].toLowerCase();

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      role: 'ADMIN',
      isActive: true,
      passwordHash,
    },
    create: {
      email: adminEmail.toLowerCase(),
      username,
      name: process.env.ADMIN_NAME || 'System Administrator',
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Administrator account configured: ${admin.email} (@${admin.username}) - Role: ${admin.role}`);
}

main()
  .catch((e) => {
    console.error('Error during admin provisioning:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
