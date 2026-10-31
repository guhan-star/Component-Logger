import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Seeding initial warehouse user accounts...');

  const adminPasswordHash = await bcrypt.hash('admin', 10);
  const operatorPasswordHash = await bcrypt.hash('operator', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@stark.warehouse' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@stark.warehouse',
      username: 'admin',
      name: 'Tony Stark',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@stark.warehouse' },
    update: { passwordHash: operatorPasswordHash },
    create: {
      email: 'operator@stark.warehouse',
      username: 'operator',
      name: 'Lab Operator',
      passwordHash: operatorPasswordHash,
      role: 'OPERATOR',
    },
  });

  console.log('✅ Accounts seeded successfully:');
  console.log('   👑 ADMIN:    admin@stark.warehouse    | password: admin');
  console.log('   🛠️ OPERATOR: operator@stark.warehouse | password: operator');
}

main()
  .catch((e) => {
    console.error('Error seeding users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
