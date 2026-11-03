/**
 * Stark Industries WMC — Controlled Administrator Provisioning CLI
 *
 * Securely provisions or promotes an administrator account.
 * Reads credentials from environment variables or command-line arguments.
 * NEVER hardcodes credentials in source control or prints passwords in logs.
 *
 * Usage:
 *   npx ts-node scripts/manage-admin.ts <email> [password] [name] [username]
 * Or via env:
 *   ADMIN_EMAIL=admin@stark.wmc ADMIN_PASSWORD=StrongPass123! npx ts-node scripts/manage-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || process.argv[2] || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || process.argv[3] || '';
  const name = process.env.ADMIN_NAME || process.argv[4] || 'System Administrator';
  const username = (process.env.ADMIN_USERNAME || process.argv[5] || email.split('@')[0] || 'admin').trim().toLowerCase();

  if (!email) {
    console.error('❌ Error: Administrator email is required.');
    console.log('Usage: npx ts-node scripts/manage-admin.ts <email> [password] [name] [username]');
    process.exit(1);
  }

  console.log(`🔒 Provisioning administrator for: ${email}`);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const updateData: any = {
      role: 'ADMIN',
      isActive: true,
    };

    if (password) {
      if (password.length < 8) {
        console.error('❌ Error: Password must be at least 8 characters long.');
        process.exit(1);
      }
      updateData.passwordHash = await bcrypt.hash(password, 12);
      console.log('🔑 Updating password to provided credentials...');
    }

    const updated = await prisma.user.update({
      where: { id: existingUser.id },
      data: updateData,
      select: { id: true, email: true, username: true, role: true },
    });

    console.log(`✅ User successfully promoted to ADMIN: ${updated.email} (@${updated.username})`);
    return;
  }

  // Creating new admin
  if (!password) {
    console.error('❌ Error: Password is required when creating a new administrator account.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters long.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const newAdmin = await prisma.user.create({
    data: {
      email,
      username,
      name,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      settings: {
        create: {
          theme: 'dark',
          defaultCurrency: 'INR',
          defaultUnit: 'Piece',
          defaultPageSize: 25,
        },
      },
    },
    select: { id: true, email: true, username: true, role: true },
  });

  console.log(`✅ Administrator successfully created: ${newAdmin.email} (@${newAdmin.username})`);
}

main()
  .catch((e) => {
    console.error('❌ Error provisioning administrator:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
