import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import * as authModule from '@/lib/auth';
import { GET as getComponent, PUT as updateComponent, DELETE as deleteComponent } from '@/app/api/components/[id]/route';
import { NextRequest } from 'next/server';

describe('Integration Tests: Inventory Security & Multi-Tenant Data Isolation', () => {
  const userA = {
    id: 'usr_alpha_101',
    email: 'alpha@stark.test',
    username: 'alpha_op',
    name: 'Alpha Operator',
    role: 'USER' as const,
  };

  const userB = {
    id: 'usr_bravo_202',
    email: 'bravo@stark.test',
    username: 'bravo_op',
    name: 'Bravo Operator',
    role: 'USER' as const,
  };

  const componentOfUserA = {
    id: 'comp_sensor_999',
    userId: userA.id,
    sku: 'SKU-SNS-999',
    name: 'BME280 Environmental Sensor',
    category: 'Sensors',
    quantityOwned: 20,
    quantityAvailable: 15,
    quantityReserved: 5,
    quantityTotal: 20,
    quantityHere: 15,
    unitCost: 350,
    unit: 'pcs',
    ownershipType: 'Mine',
    currentStatus: 'Active',
    supplier: 'Private Supplier Co',
    storageLocation: 'Zone A-01',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows owner User A to read their own component', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({ user: userA } as any);
    vi.spyOn(prisma.component, 'findFirst').mockImplementation(async ({ where }: any) => {
      if (where?.id === componentOfUserA.id && where?.userId === userA.id) {
        return componentOfUserA as any;
      }
      return null;
    });

    const req = new NextRequest(`http://localhost:3000/api/components/${componentOfUserA.id}`);
    const res = await getComponent(req, { params: Promise.resolve({ id: componentOfUserA.id }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.component.id).toBe(componentOfUserA.id);
    expect(body.component.name).toBe('BME280 Environmental Sensor');
  });

  it('STRICT SECURITY: Blocks User B from viewing User A private component with 404', async () => {
    // Authenticate as User B
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({ user: userB } as any);
    // findFirst checks userId: user.id -> returns null for User B
    vi.spyOn(prisma.component, 'findFirst').mockImplementation(async ({ where }: any) => {
      if (where?.id === componentOfUserA.id && where?.userId === userA.id) {
        return componentOfUserA as any;
      }
      return null;
    });

    const req = new NextRequest(`http://localhost:3000/api/components/${componentOfUserA.id}`);
    const res = await getComponent(req, { params: Promise.resolve({ id: componentOfUserA.id }) });
    const body = await res.json();

    // Must be rejected - unauthorized cross-tenant access prevented
    expect(res.status).toBe(404);
    expect(body.error).toBe('Component not found.');
  });

  it('STRICT SECURITY: Blocks User B from updating User A component with 404', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({ user: userB } as any);
    vi.spyOn(prisma.component, 'findFirst').mockImplementation(async ({ where }: any) => {
      if (where?.id === componentOfUserA.id && where?.userId === userA.id) {
        return componentOfUserA as any;
      }
      return null;
    });

    const req = new NextRequest(`http://localhost:3000/api/components/${componentOfUserA.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Component Name' }),
    });

    const res = await updateComponent(req, { params: Promise.resolve({ id: componentOfUserA.id }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Component not found.');
  });

  it('STRICT SECURITY: Blocks User B from deleting User A component with 404', async () => {
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({ user: userB } as any);
    vi.spyOn(prisma.component, 'findFirst').mockImplementation(async ({ where }: any) => {
      if (where?.id === componentOfUserA.id && where?.userId === userA.id) {
        return componentOfUserA as any;
      }
      return null;
    });

    const req = new NextRequest(`http://localhost:3000/api/components/${componentOfUserA.id}`, {
      method: 'DELETE',
    });

    const res = await deleteComponent(req, { params: Promise.resolve({ id: componentOfUserA.id }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Component not found.');
  });
});
