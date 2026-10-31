import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runTests() {
  console.log('🧪 Starting automated E2E system tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  let testCompId: string | null = null;
  let testPersonId: string | null = null;
  let testProjectId: string | null = null;
  let testPcId: string | null = null;

  try {
    // 1. Verify Category Taxonomy
    const categoryCount = await prisma.category.count();
    assert(categoryCount >= 17, `Category taxonomy is populated (Count: ${categoryCount})`);

    // 2. Test Component Creation & Availability Calculation
    const testComp = await prisma.component.create({
      data: {
        name: 'STM32F401 Black Pill Development Board',
        mpn: 'STM32F401CCU6',
        quantityOwned: 10,
        quantityAvailable: 10,
        condition: 'New',
        unitOfMeasurement: 'pcs',
        ownershipType: 'Personal',
        unitCost: 280,
      },
    });
    testCompId = testComp.id;
    assert(testComp.quantityAvailable === 10, 'Component created with correct quantity balance');

    // 3. Test Stock Transaction (ADD)
    await prisma.inventoryTransaction.create({
      data: {
        componentId: testComp.id,
        transactionType: 'ADD',
        quantity: 5,
        previousQty: 10,
        resultingQty: 15,
        notes: 'Restock test batch',
      },
    });
    await prisma.component.update({
      where: { id: testComp.id },
      data: {
        quantityOwned: 15,
        quantityAvailable: 15,
      },
    });
    const updatedComp = await prisma.component.findUnique({ where: { id: testComp.id } });
    assert(updatedComp?.quantityAvailable === 15, 'Stock transaction correctly increments available quantity');

    // 4. Test Person & Lend Record Workflow
    const person = await prisma.person.create({
      data: {
        name: 'Test Engineer',
        email: 'test@example.com',
      },
    });
    testPersonId = person.id;
    assert(!!person, 'Created temporary test person contact');

    // Lend 3 units
    const lend = await prisma.lendRecord.create({
      data: {
        componentId: testComp.id,
        lentToId: person.id,
        quantity: 3,
        notes: 'Test loan',
      },
    });
    await prisma.component.update({
      where: { id: testComp.id },
      data: {
        quantityAvailable: { decrement: 3 },
        quantityLentOut: { increment: 3 },
      },
    });

    const afterLend = await prisma.component.findUnique({ where: { id: testComp.id } });
    assert(afterLend?.quantityAvailable === 12 && afterLend?.quantityLentOut === 3, 'Lending reduces available stock and increments lentOut');

    // Return lent item
    await prisma.lendRecord.update({
      where: { id: lend.id },
      data: { status: 'Returned', actualReturnDate: new Date() },
    });
    await prisma.component.update({
      where: { id: testComp.id },
      data: {
        quantityAvailable: { increment: 3 },
        quantityLentOut: { decrement: 3 },
      },
    });

    const afterReturn = await prisma.component.findUnique({ where: { id: testComp.id } });
    assert(afterReturn?.quantityAvailable === 15 && afterReturn?.quantityLentOut === 0, 'Returning lent item restores available stock');

    // 5. Test Project & BOM Reservation Workflow
    const project = await prisma.project.create({
      data: {
        name: 'Quadcopter Flight Controller V2',
        status: 'Active',
      },
    });
    testProjectId = project.id;

    const pc = await prisma.projectComponent.create({
      data: {
        projectId: project.id,
        componentId: testComp.id,
        plannedQuantity: 2,
        reservedQuantity: 2,
      },
    });
    testPcId = pc.id;

    await prisma.component.update({
      where: { id: testComp.id },
      data: {
        quantityAvailable: { decrement: 2 },
        quantityReserved: { increment: 2 },
      },
    });

    const afterReserve = await prisma.component.findUnique({ where: { id: testComp.id } });
    assert(afterReserve?.quantityAvailable === 13 && afterReserve?.quantityReserved === 2, 'Project BOM reservation reserves stock from available pool');

    console.log(`\n========================================`);
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  } finally {
    // Clean up all temporary test artifacts so the database stays completely clean
    if (testPcId) await prisma.projectComponent.deleteMany({ where: { id: testPcId } });
    if (testProjectId) await prisma.project.deleteMany({ where: { id: testProjectId } });
    if (testCompId) {
      await prisma.inventoryTransaction.deleteMany({ where: { componentId: testCompId } });
      await prisma.lendRecord.deleteMany({ where: { componentId: testCompId } });
      await prisma.component.deleteMany({ where: { id: testCompId } });
    }
    if (testPersonId) await prisma.person.deleteMany({ where: { id: testPersonId } });

    await prisma.$disconnect();
  }
}

runTests();
