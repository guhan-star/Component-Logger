import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { returnLentAtomic, returnBorrowedAtomic } from '@/lib/custody-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/components/[id]/return - Authoritative component custody return
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;
    let bodyType = 'lend';
    let bodyNotes = '';
    try {
      const body = await request.json();
      bodyType = body?.type || 'lend';
      bodyNotes = body?.notes || '';
    } catch {}

    let result;
    if (bodyType === 'borrow') {
      result = await returnBorrowedAtomic({
        userId: user.id,
        componentId: id,
        notes: bodyNotes,
      });
    } else {
      result = await returnLentAtomic({
        userId: user.id,
        componentId: id,
        notes: bodyNotes,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Component custody balance returned successfully.',
      result,
    });
  } catch (error: any) {
    console.error('POST /api/components/[id]/return error:', error);
    const msg = error?.message || 'Failed to process return.';
    const status = msg.includes('not found') ? 404 : msg.includes('already') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
