import { PrismaClient } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '../src/lib/categories';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default user settings
  await prisma.userSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      theme: 'dark',
      defaultCurrency: 'INR',
      defaultUnit: 'pcs',
      defaultPageSize: 25,
      defaultSortField: 'updatedAt',
      defaultSortOrder: 'desc',
      dateFormat: 'DD/MM/YYYY',
      lowStockThreshold: 5,
    },
  });
  console.log('✅ Default settings created');

  // Create default categories with spec templates
  for (const catTemplate of DEFAULT_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { name: catTemplate.name },
      update: {
        description: catTemplate.description,
        icon: catTemplate.icon,
      },
      create: {
        name: catTemplate.name,
        description: catTemplate.description,
        icon: catTemplate.icon,
        isCustom: false,
      },
    });

    // Create spec templates for this category
    for (const spec of catTemplate.specs) {
      await prisma.specTemplate.upsert({
        where: {
          categoryId_fieldName: {
            categoryId: category.id,
            fieldName: spec.fieldName,
          },
        },
        update: {
          label: spec.label,
          fieldType: spec.fieldType,
          unit: spec.unit || null,
          baseUnit: spec.baseUnit || null,
          options: spec.options ? JSON.stringify(spec.options) : null,
          sortOrder: spec.sortOrder,
          isRequired: spec.isRequired || false,
        },
        create: {
          categoryId: category.id,
          fieldName: spec.fieldName,
          label: spec.label,
          fieldType: spec.fieldType,
          unit: spec.unit || null,
          baseUnit: spec.baseUnit || null,
          options: spec.options ? JSON.stringify(spec.options) : null,
          sortOrder: spec.sortOrder,
          isRequired: spec.isRequired || false,
        },
      });
    }

    console.log(`✅ Category "${catTemplate.name}" with ${catTemplate.specs.length} spec templates`);
  }

  console.log('\n🎉 Database seeded successfully!');
  console.log('📝 Note: No demo data was inserted. The database is ready for your real inventory.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
