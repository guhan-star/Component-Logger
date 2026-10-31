import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('👑 Setting up single Operator Main account for Stark Industries WMC...');

  // Delete old test users
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('operator123', 10);

  const mainOperator = await prisma.user.create({
    data: {
      email: 'operator@stark.wmc',
      username: 'operator',
      name: 'Operator Main',
      passwordHash,
      role: 'ADMIN', // full permissions
    },
  });

  console.log('✅ Operator Main created:');
  console.log(`   Name:     ${mainOperator.name}`);
  console.log(`   Email:    ${mainOperator.email}`);
  console.log(`   Username: ${mainOperator.username}`);
  console.log(`   Role:     ADMIN (Full Control)`);
  console.log(`   Password: operator123`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
