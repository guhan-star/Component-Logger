import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('👑 Ensuring primary administrator account exists...');

  const email = 'operator@stark.wmc';
  const username = 'operator';
  const passwordHash = await bcrypt.hash('operator123', 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      email,
      username,
      name: 'Operator Main',
      passwordHash,
      role: 'ADMIN',
    },
  });

  // Ensure default settings exist
  await prisma.userSettings.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      theme: 'dark',
      defaultCurrency: 'INR',
      defaultUnit: 'Piece',
      defaultPageSize: 25,
    },
  });

  console.log('✅ Main administrator account is ready:');
  console.log(`   ID:       ${admin.id}`);
  console.log(`   Email:    ${admin.email}`);
  console.log(`   Username: ${admin.username}`);
  console.log(`   Role:     ${admin.role}`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
