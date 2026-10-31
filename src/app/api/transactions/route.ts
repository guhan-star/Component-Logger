import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { transactionCreateSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const componentId = searchParams.get('componentId');
    const transactionType = searchParams.get('transactionType');
    const personId = searchParams.get('personId');
    const projectId = searchParams.get('projectId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);

    const where: Record<string, unknown> = {};

    if (componentId) where.componentId = componentId;
    if (transactionType) where.transactionType = transactionType;
    if (personId) where.relatedPersonId = personId;
    if (projectId) where.relatedProjectId = projectId;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          component: { select: { id: true, name: true, imageUrl: true } },
          relatedPerson: { select: { id: true, name: true } },
          relatedProject: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    return NextResponse.json({
      data: transactions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('GET /api/transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = transactionCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { componentId, transactionType, quantity, relatedPersonId, relatedProjectId, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const component = await tx.component.findUnique({ where: { id: componentId } });
      if (!component) {
        throw new Error('Component not found');
      }

      let previousQty = component.quantityOwned;
      let resultingQty = component.quantityOwned;
      const updateData: Record<string, unknown> = {};

      switch (transactionType) {
        case 'INITIAL': {
          previousQty = component.quantityOwned;
          updateData.quantityOwned = quantity;
          updateData.quantityAvailable = quantity;
          resultingQty = quantity;
          break;
        }

        case 'ADD': {
          previousQty = component.quantityOwned;
          updateData.quantityOwned = component.quantityOwned + quantity;
          updateData.quantityAvailable = component.quantityAvailable + quantity;
          resultingQty = component.quantityOwned + quantity;
          break;
        }

        case 'REMOVE': {
          if (component.quantityOwned < quantity) {
            throw new Error(`Cannot remove ${quantity}. Only ${component.quantityOwned} owned.`);
          }
          if (component.quantityAvailable < quantity) {
            throw new Error(`Cannot remove ${quantity}. Only ${component.quantityAvailable} available.`);
          }
          previousQty = component.quantityOwned;
          updateData.quantityOwned = component.quantityOwned - quantity;
          updateData.quantityAvailable = component.quantityAvailable - quantity;
          resultingQty = component.quantityOwned - quantity;
          break;
        }

        case 'USE': {
          if (component.quantityAvailable < quantity) {
            throw new Error(`Cannot use ${quantity}. Only ${component.quantityAvailable} available.`);
          }
          previousQty = component.quantityAvailable;
          updateData.quantityAvailable = component.quantityAvailable - quantity;
          updateData.quantityInUse = component.quantityInUse + quantity;
          updateData.lastUsedAt = new Date();
          resultingQty = component.quantityAvailable - quantity;
          break;
        }

        case 'RESERVE': {
          if (!relatedProjectId) {
            throw new Error('RESERVE requires a relatedProjectId');
          }
          if (component.quantityAvailable < quantity) {
            throw new Error(`Cannot reserve ${quantity}. Only ${component.quantityAvailable} available.`);
          }
          previousQty = component.quantityAvailable;
          updateData.quantityAvailable = component.quantityAvailable - quantity;
          updateData.quantityReserved = component.quantityReserved + quantity;
          resultingQty = component.quantityAvailable - quantity;

          // Upsert ProjectComponent reservation
          const existingPC = await tx.projectComponent.findUnique({
            where: { projectId_componentId: { projectId: relatedProjectId, componentId } },
          });
          if (existingPC) {
            await tx.projectComponent.update({
              where: { id: existingPC.id },
              data: { reservedQuantity: existingPC.reservedQuantity + quantity },
            });
          } else {
            await tx.projectComponent.create({
              data: {
                projectId: relatedProjectId,
                componentId,
                reservedQuantity: quantity,
              },
            });
          }
          break;
        }

        case 'RELEASE_RESERVE': {
          if (!relatedProjectId) {
            throw new Error('RELEASE_RESERVE requires a relatedProjectId');
          }
          if (component.quantityReserved < quantity) {
            throw new Error(`Cannot release ${quantity}. Only ${component.quantityReserved} reserved.`);
          }
          previousQty = component.quantityReserved;
          updateData.quantityAvailable = component.quantityAvailable + quantity;
          updateData.quantityReserved = component.quantityReserved - quantity;
          resultingQty = component.quantityReserved - quantity;

          const pc = await tx.projectComponent.findUnique({
            where: { projectId_componentId: { projectId: relatedProjectId, componentId } },
          });
          if (pc) {
            await tx.projectComponent.update({
              where: { id: pc.id },
              data: { reservedQuantity: Math.max(0, pc.reservedQuantity - quantity) },
            });
          }
          break;
        }

        case 'BORROW': {
          if (!relatedPersonId) {
            throw new Error('BORROW requires a relatedPersonId');
          }
          previousQty = component.quantityBorrowed;
          updateData.quantityBorrowed = component.quantityBorrowed + quantity;
          updateData.quantityOwned = component.quantityOwned + quantity;
          updateData.quantityAvailable = component.quantityAvailable + quantity;
          resultingQty = component.quantityBorrowed + quantity;

          // If first borrow, mark ownership
          if (component.quantityOwned === 0 && component.ownershipType === 'Personal') {
            updateData.ownershipType = 'Borrowed';
          }

          await tx.borrowRecord.create({
            data: {
              componentId,
              borrowedFromId: relatedPersonId,
              quantity,
              notes,
            },
          });
          break;
        }

        case 'RETURN_BORROWED': {
          if (!relatedPersonId) {
            throw new Error('RETURN_BORROWED requires a relatedPersonId');
          }
          if (component.quantityBorrowed < quantity) {
            throw new Error(`Cannot return ${quantity}. Only ${component.quantityBorrowed} borrowed.`);
          }
          previousQty = component.quantityBorrowed;
          updateData.quantityBorrowed = component.quantityBorrowed - quantity;
          updateData.quantityOwned = component.quantityOwned - quantity;
          updateData.quantityAvailable = component.quantityAvailable - quantity;
          resultingQty = component.quantityBorrowed - quantity;

          // Close the most recent active borrow record for this person/component
          const borrowRecord = await tx.borrowRecord.findFirst({
            where: {
              componentId,
              borrowedFromId: relatedPersonId,
              status: 'Active',
            },
            orderBy: { dateBorrowed: 'desc' },
          });
          if (borrowRecord) {
            await tx.borrowRecord.update({
              where: { id: borrowRecord.id },
              data: {
                actualReturnDate: new Date(),
                status: 'Returned',
              },
            });
          }
          break;
        }

        case 'LEND': {
          if (!relatedPersonId) {
            throw new Error('LEND requires a relatedPersonId');
          }
          if (component.ownershipType === 'Borrowed') {
            throw new Error('Cannot lend borrowed items');
          }
          if (component.quantityAvailable < quantity) {
            throw new Error(`Cannot lend ${quantity}. Only ${component.quantityAvailable} available.`);
          }
          previousQty = component.quantityAvailable;
          updateData.quantityAvailable = component.quantityAvailable - quantity;
          updateData.quantityLentOut = component.quantityLentOut + quantity;
          resultingQty = component.quantityAvailable - quantity;

          await tx.lendRecord.create({
            data: {
              componentId,
              lentToId: relatedPersonId,
              quantity,
              notes,
            },
          });
          break;
        }

        case 'RETURN_LENT': {
          if (!relatedPersonId) {
            throw new Error('RETURN_LENT requires a relatedPersonId');
          }
          if (component.quantityLentOut < quantity) {
            throw new Error(`Cannot return ${quantity}. Only ${component.quantityLentOut} lent out.`);
          }
          previousQty = component.quantityLentOut;
          updateData.quantityAvailable = component.quantityAvailable + quantity;
          updateData.quantityLentOut = component.quantityLentOut - quantity;
          resultingQty = component.quantityLentOut - quantity;

          const lendRecord = await tx.lendRecord.findFirst({
            where: {
              componentId,
              lentToId: relatedPersonId,
              status: 'Active',
            },
            orderBy: { dateLent: 'desc' },
          });
          if (lendRecord) {
            await tx.lendRecord.update({
              where: { id: lendRecord.id },
              data: {
                actualReturnDate: new Date(),
                status: 'Returned',
              },
            });
          }
          break;
        }

        case 'DAMAGE': {
          if (component.quantityAvailable < quantity) {
            throw new Error(`Cannot mark ${quantity} as damaged. Only ${component.quantityAvailable} available.`);
          }
          previousQty = component.quantityAvailable;
          updateData.quantityAvailable = component.quantityAvailable - quantity;
          updateData.quantityOwned = component.quantityOwned - quantity;
          resultingQty = component.quantityAvailable - quantity;
          if (quantity >= component.quantityOwned) {
            updateData.condition = 'Damaged';
          }
          break;
        }

        case 'LOSS': {
          if (component.quantityAvailable < quantity) {
            throw new Error(`Cannot mark ${quantity} as lost. Only ${component.quantityAvailable} available.`);
          }
          previousQty = component.quantityAvailable;
          updateData.quantityAvailable = component.quantityAvailable - quantity;
          updateData.quantityOwned = component.quantityOwned - quantity;
          resultingQty = component.quantityAvailable - quantity;
          break;
        }

        case 'CORRECTION': {
          previousQty = component.quantityOwned;
          // For corrections, quantity is the new total
          updateData.quantityOwned = quantity;
          // Recalculate available: newOwned - reserved - inUse - lentOut
          const newAvailable = quantity - component.quantityReserved - component.quantityInUse - component.quantityLentOut;
          updateData.quantityAvailable = Math.max(0, newAvailable);
          resultingQty = quantity;
          break;
        }

        default:
          throw new Error(`Unknown transaction type: ${transactionType}`);
      }

      // Update component
      const updatedComponent = await tx.component.update({
        where: { id: componentId },
        data: updateData,
      });

      // Create transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          componentId,
          transactionType,
          quantity,
          previousQty,
          resultingQty,
          relatedPersonId,
          relatedProjectId,
          notes,
        },
        include: {
          component: { select: { id: true, name: true } },
          relatedPerson: { select: { id: true, name: true } },
          relatedProject: { select: { id: true, name: true } },
        },
      });

      return { transaction, component: updatedComponent };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/transactions error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create transaction';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
