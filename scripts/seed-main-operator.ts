import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('👑 Ensuring primary administrator accounts exist...');

  const adminsToSeed = [
    {
      email: 'technovater24@gmail.com',
      username: 'technovater24',
      name: 'Technovater Admin',
      password: 'guhank01',
      role: 'ADMIN',
    },
    {
      email: 'technovaters24@gmail.com',
      username: 'technovaters24',
      name: 'Technovaters Admin',
      password: 'guhank01',
      role: 'ADMIN',
    },
    {
      email: 'operator@stark.wmc',
      username: 'operator',
      name: 'Operator Main',
      password: 'operator123',
      role: 'ADMIN',
    },
  ];

  for (const item of adminsToSeed) {
    const passwordHash = await bcrypt.hash(item.password, 12);

    const admin = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        role: 'ADMIN',
        isActive: true,
        passwordHash, // update password to requested password
      },
      create: {
        email: item.email,
        username: item.username,
        name: item.name,
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

    console.log(`✅ Admin account configured: ${admin.email} (@${admin.username}) - Role: ${admin.role}`);
  }
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
