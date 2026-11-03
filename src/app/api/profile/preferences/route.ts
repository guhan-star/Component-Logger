import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const preferencesSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  defaultCurrency: z.string().trim().max(10).optional(),
  defaultUnit: z.string().trim().max(30).optional(),
  dateFormat: z.enum(['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY']).optional(),
  defaultInventoryView: z.enum(['table', 'cards']).optional(),
  notifyEmail: z.boolean().optional(),
  notifyProjectInvites: z.boolean().optional(),
  notifyBorrowReminders: z.boolean().optional(),
  notifyReturnReminders: z.boolean().optional(),
});

// GET /api/profile/preferences - Fetch user preferences
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({
      preferences: settings || {
        theme: 'dark',
        defaultCurrency: 'INR',
        defaultUnit: 'Piece',
        dateFormat: 'DD/MM/YYYY',
        defaultInventoryView: 'table',
        notifyEmail: true,
        notifyProjectInvites: true,
        notifyBorrowReminders: true,
        notifyReturnReminders: true,
      },
    });
  } catch (error) {
    console.error('GET /api/profile/preferences error:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

// PATCH /api/profile/preferences - Update application preferences
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const parsed = preferencesSchema.safeParse(body);

    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message || 'Invalid preferences payload';
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const updated = await prisma.userSettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...parsed.data,
      },
      update: parsed.data,
    });

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: updated,
    });
  } catch (error: any) {
    console.error('PATCH /api/profile/preferences error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update preferences' }, { status: 500 });
  }
}
