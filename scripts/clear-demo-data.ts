import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing all dummy data from database...');

  // Child / relation records
  await prisma.inventoryTransaction.deleteMany({});
  await prisma.borrowRecord.deleteMany({});
  await prisma.lendRecord.deleteMany({});
  await prisma.projectComponent.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.purchaseItem.deleteMany({});
  await prisma.technicalSpec.deleteMany({});
  await prisma.componentTag.deleteMany({});
  await prisma.customFieldValue.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.inventoryLot.deleteMany({});
  await prisma.changeHistory.deleteMany({});

  // Components
  const comps = await prisma.component.deleteMany({});
  console.log(`Deleted ${comps.count} components.`);

  // People
  const people = await prisma.person.deleteMany({});
  console.log(`Deleted ${people.count} people.`);

  // Suppliers & Manufacturers & Tags
  const suppliers = await prisma.supplier.deleteMany({});
  console.log(`Deleted ${suppliers.count} suppliers.`);

  const manufacturers = await prisma.manufacturer.deleteMany({});
  console.log(`Deleted ${manufacturers.count} manufacturers.`);

  const tags = await prisma.tag.deleteMany({});
  console.log(`Deleted ${tags.count} tags.`);

  console.log('✨ All dummy values cleared! Database is completely clean and ready for real inventory.');
}

main()
  .catch((e) => {
    console.error('Error clearing data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
