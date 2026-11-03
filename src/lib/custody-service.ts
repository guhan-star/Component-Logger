/**
 * Stark Industries WMC — Authoritative Custody Service
 * Centralizes transactional borrowing, lending, and return lifecycles.
 * Enforces atomic stock integrity, prevents duplicate returns, overselling, and negative inventory.
 */

import prisma from '@/lib/prisma';

export interface ReturnLentParams {
  userId: string;
  lendRecordId?: string;
  componentId?: string;
  notes?: string;
}

export interface ReturnBorrowedParams {
  userId: string;
  borrowRecordId?: string;
  componentId?: string;
  notes?: string;
}

export interface LendComponentParams {
  userId: string;
  componentId: string;
  lentTo: string;
  quantity: number;
  expectedReturnDate?: Date | null;
  notes?: string | null;
}

export interface BorrowComponentParams {
  userId: string;
  componentId: string;
  borrowedFrom: string;
  quantity: number;
  expectedReturnDate?: Date | null;
  notes?: string | null;
}

/**
 * Atomically lend hardware to someone with concurrency control.
 * Prevents overselling by checking quantityAvailable >= quantity inside the transaction.
 */
export async function lendComponentAtomic(params: LendComponentParams) {
  const { userId, componentId, lentTo, quantity, expectedReturnDate, notes } = params;

  if (quantity <= 0) {
    throw new Error('Quantity to lend must be at least 1.');
  }
  if (!lentTo.trim()) {
    throw new Error('Recipient name is required.');
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Concurrency-safe atomic check and update on the component
    // We fetch the current state to capture accurate audit metrics
    const comp = await tx.component.findFirst({
      where: { id: componentId, userId },
    });

    if (!comp) {
      throw new Error('Component not found in your inventory.');
    }

    if (comp.quantityAvailable < quantity) {
      throw new Error(
        `Insufficient available quantity. Requested: ${quantity}, Available: ${comp.quantityAvailable}.`
      );
    }

    const prevAvail = comp.quantityAvailable;
    const newAvail = comp.quantityAvailable - quantity;
    const newLentOut = (comp.quantityLentOut || 0) + quantity;

    // Atomic update
    await tx.component.update({
      where: { id: comp.id },
      data: {
        quantityAvailable: newAvail,
        quantityLentOut: newLentOut,
        lentTo: lentTo.trim(),
        lendingDate: new Date(),
        expectedReturnDate: expectedReturnDate || null,
        ownershipType: comp.quantityBorrowed > 0 ? 'Borrowed' : 'Lent',
      },
    });

    // 2. Create authoritative LendRecord
    const lendRecord = await tx.lendRecord.create({
      data: {
        userId,
        componentId: comp.id,
        lentTo: lentTo.trim(),
        quantity,
        dateLent: new Date(),
        expectedReturnDate: expectedReturnDate || null,
        status: 'Active',
        notes: notes || null,
      },
    });

    // 3. Log audit transaction
    await tx.inventoryTransaction.create({
      data: {
        userId,
        componentId: comp.id,
        transactionType: 'LEND',
        quantity,
        previousQty: prevAvail,
        resultingQty: newAvail,
        notes: `Lent ${quantity} ${comp.unitOfMeasurement || 'units'} to ${lentTo.trim()}${notes ? ` - ${notes}` : ''}`,
      },
    });

    return { lendRecord, updatedAvailable: newAvail, updatedLentOut: newLentOut };
  });
}

/**
 * Authoritative, idempotent return of a lent component back into available stock.
 * Prevents duplicate returns and recalculates active loan status.
 */
export async function returnLentAtomic(params: ReturnLentParams) {
  const { userId, lendRecordId, componentId, notes } = params;

  return await prisma.$transaction(async (tx) => {
    let targetRecord: any = null;

    if (lendRecordId) {
      targetRecord = await tx.lendRecord.findFirst({
        where: { id: lendRecordId, userId },
      });
      if (!targetRecord) {
        throw new Error('Lend record not found.');
      }
      if (targetRecord.status === 'Returned') {
        throw new Error('This loan has already been marked as returned.');
      }
    } else if (componentId) {
      // Find latest active lend record for this component
      targetRecord = await tx.lendRecord.findFirst({
        where: { componentId, userId, status: 'Active' },
        orderBy: { dateLent: 'desc' },
      });
    }

    const resolvedCompId = targetRecord?.componentId || componentId;
    if (!resolvedCompId) {
      throw new Error('Target component could not be resolved.');
    }

    const comp = await tx.component.findFirst({
      where: { id: resolvedCompId, userId },
    });

    if (!comp) {
      throw new Error('Associated inventory component not found.');
    }

    const qtyToReturn = targetRecord
      ? targetRecord.quantity
      : comp.quantityLentOut > 0
      ? comp.quantityLentOut
      : Math.max(1, comp.quantityOwned - comp.quantityAvailable);

    // 1. Mark lend record as returned if it exists
    if (targetRecord) {
      const updateCount = await tx.lendRecord.updateMany({
        where: { id: targetRecord.id, userId, status: 'Active' },
        data: {
          status: 'Returned',
          actualReturnDate: new Date(),
          notes: notes
            ? targetRecord.notes
              ? `${targetRecord.notes} | Return Note: ${notes}`
              : `Return Note: ${notes}`
            : targetRecord.notes,
        },
      });

      if (updateCount.count === 0) {
        throw new Error('This loan has already been returned by another concurrent request.');
      }
    }

    // 2. Restore available inventory balance
    const prevAvail = comp.quantityAvailable;
    const newAvail = comp.quantityAvailable + qtyToReturn;
    const newLentOut = Math.max(0, (comp.quantityLentOut || 0) - qtyToReturn);

    // Check for remaining active loans for this component
    const remainingActiveLoans = await tx.lendRecord.findMany({
      where: {
        componentId: comp.id,
        userId,
        status: 'Active',
        ...(targetRecord ? { id: { not: targetRecord.id } } : {}),
      },
      orderBy: { dateLent: 'desc' },
      take: 1,
    });

    const nextLentTo = remainingActiveLoans.length > 0 ? remainingActiveLoans[0].lentTo : null;
    const nextLendingDate = remainingActiveLoans.length > 0 ? remainingActiveLoans[0].dateLent : null;
    const nextExpectedReturn = remainingActiveLoans.length > 0 ? remainingActiveLoans[0].expectedReturnDate : null;
    const nextStatus = newLentOut > 0 ? 'Lent Out' : 'In Storage';
    const nextOwnership = newLentOut > 0 ? 'Lent' : comp.quantityBorrowed > 0 ? 'Borrowed' : 'Mine';

    await tx.component.update({
      where: { id: comp.id },
      data: {
        quantityAvailable: newAvail,
        quantityLentOut: newLentOut,
        ownershipType: nextOwnership,
        lentTo: nextLentTo,
        lendingDate: nextLendingDate,
        expectedReturnDate: nextExpectedReturn,
      },
    });

    // 3. Audit trail
    const recipientName = targetRecord?.lentTo || comp.lentTo || 'Borrower';
    await tx.inventoryTransaction.create({
      data: {
        userId,
        componentId: comp.id,
        transactionType: 'RETURN_LENT',
        quantity: qtyToReturn,
        previousQty: prevAvail,
        resultingQty: newAvail,
        notes: `Returned ${qtyToReturn} units from ${recipientName}${notes ? ` (${notes})` : ''}`,
      },
    });

    return {
      success: true,
      componentId: comp.id,
      quantityReturned: qtyToReturn,
      quantityAvailable: newAvail,
      quantityLentOut: newLentOut,
    };
  });
}

/**
 * Authoritatively record hardware borrowed from a peer or external lab.
 */
export async function borrowComponentAtomic(params: BorrowComponentParams) {
  const { userId, componentId, borrowedFrom, quantity, expectedReturnDate, notes } = params;

  if (quantity <= 0) {
    throw new Error('Quantity borrowed must be at least 1.');
  }
  if (!borrowedFrom.trim()) {
    throw new Error('Lender name is required.');
  }

  return await prisma.$transaction(async (tx) => {
    const comp = await tx.component.findFirst({
      where: { id: componentId, userId },
    });

    if (!comp) {
      throw new Error('Target component not found.');
    }

    const prevAvail = comp.quantityAvailable;
    const newAvail = comp.quantityAvailable + quantity;
    const newBorrowed = (comp.quantityBorrowed || 0) + quantity;

    await tx.component.update({
      where: { id: comp.id },
      data: {
        quantityAvailable: newAvail,
        quantityBorrowed: newBorrowed,
        ownershipType: 'Borrowed',
        borrowedFrom: borrowedFrom.trim(),
        borrowingDate: new Date(),
        expectedReturnDate: expectedReturnDate || null,
      },
    });

    const borrowRecord = await tx.borrowRecord.create({
      data: {
        userId,
        componentId: comp.id,
        borrowedFrom: borrowedFrom.trim(),
        quantity,
        dateBorrowed: new Date(),
        expectedReturnDate: expectedReturnDate || null,
        status: 'Active',
        notes: notes || null,
      },
    });

    await tx.inventoryTransaction.create({
      data: {
        userId,
        componentId: comp.id,
        transactionType: 'BORROW',
        quantity,
        previousQty: prevAvail,
        resultingQty: newAvail,
        notes: `Borrowed ${quantity} units from ${borrowedFrom.trim()}${notes ? ` - ${notes}` : ''}`,
      },
    });

    return { borrowRecord, updatedAvailable: newAvail, updatedBorrowed: newBorrowed };
  });
}

/**
 * Authoritative return of borrowed hardware back to its owner.
 * Crucial: DOES NOT DELETE the component record! Keeps historical audit and custody trail intact.
 */
export async function returnBorrowedAtomic(params: ReturnBorrowedParams) {
  const { userId, borrowRecordId, componentId, notes } = params;

  return await prisma.$transaction(async (tx) => {
    let targetRecord: any = null;

    if (borrowRecordId) {
      targetRecord = await tx.borrowRecord.findFirst({
        where: { id: borrowRecordId, userId },
      });
      if (!targetRecord) {
        throw new Error('Borrow record not found.');
      }
      if (targetRecord.status === 'Returned') {
        throw new Error('This borrowed item has already been marked as returned.');
      }
    } else if (componentId) {
      targetRecord = await tx.borrowRecord.findFirst({
        where: { componentId, userId, status: 'Active' },
        orderBy: { dateBorrowed: 'desc' },
      });
    }

    const resolvedCompId = targetRecord?.componentId || componentId;
    if (!resolvedCompId) {
      throw new Error('Target component could not be resolved.');
    }

    const comp = await tx.component.findFirst({
      where: { id: resolvedCompId, userId },
    });

    if (!comp) {
      throw new Error('Associated component not found.');
    }

    const qtyToReturn = targetRecord
      ? targetRecord.quantity
      : comp.quantityBorrowed > 0
      ? comp.quantityBorrowed
      : 1;

    // 1. Mark borrow record as returned
    if (targetRecord) {
      const updateCount = await tx.borrowRecord.updateMany({
        where: { id: targetRecord.id, userId, status: 'Active' },
        data: {
          status: 'Returned',
          actualReturnDate: new Date(),
          notes: notes
            ? targetRecord.notes
              ? `${targetRecord.notes} | Return Note: ${notes}`
              : `Return Note: ${notes}`
            : targetRecord.notes,
        },
      });

      if (updateCount.count === 0) {
        throw new Error('This borrowed item has already been returned by another concurrent request.');
      }
    }

    // 2. Adjust component balances — NEVER delete historical component
    const prevAvail = comp.quantityAvailable;
    const newAvail = Math.max(0, comp.quantityAvailable - qtyToReturn);
    const newBorrowed = Math.max(0, (comp.quantityBorrowed || 0) - qtyToReturn);

    const remainingActiveBorrows = await tx.borrowRecord.findMany({
      where: {
        componentId: comp.id,
        userId,
        status: 'Active',
        ...(targetRecord ? { id: { not: targetRecord.id } } : {}),
      },
      orderBy: { dateBorrowed: 'desc' },
      take: 1,
    });

    const nextBorrowedFrom = remainingActiveBorrows.length > 0 ? remainingActiveBorrows[0].borrowedFrom : null;
    const nextBorrowingDate = remainingActiveBorrows.length > 0 ? remainingActiveBorrows[0].dateBorrowed : null;
    const nextOwnership = newBorrowed > 0 ? 'Borrowed' : comp.quantityLentOut > 0 ? 'Lent' : 'Mine';

    await tx.component.update({
      where: { id: comp.id },
      data: {
        quantityAvailable: newAvail,
        quantityBorrowed: newBorrowed,
        ownershipType: nextOwnership,
        borrowedFrom: nextBorrowedFrom,
        borrowingDate: nextBorrowingDate,
      },
    });

    // 3. Audit trail
    const lenderName = targetRecord?.borrowedFrom || comp.borrowedFrom || 'Owner';
    await tx.inventoryTransaction.create({
      data: {
        userId,
        componentId: comp.id,
        transactionType: 'RETURN_BORROWED',
        quantity: qtyToReturn,
        previousQty: prevAvail,
        resultingQty: newAvail,
        notes: `Returned ${qtyToReturn} units back to owner ${lenderName}${notes ? ` (${notes})` : ''}`,
      },
    });

    return {
      success: true,
      componentId: comp.id,
      quantityReturned: qtyToReturn,
      quantityAvailable: newAvail,
      quantityBorrowed: newBorrowed,
    };
  });
}
