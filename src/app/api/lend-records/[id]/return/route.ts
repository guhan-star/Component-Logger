import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { returnLentAtomic } from '@/lib/custody-service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/lend-records/[id]/return - Authoritative transactional return
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;
    let bodyNotes = '';
    try {
      const body = await request.json();
      bodyNotes = body?.notes || '';
    } catch {}

    const result = await returnLentAtomic({
      userId: user.id,
      lendRecordId: id,
      notes: bodyNotes,
    });

    return NextResponse.json({
      success: true,
      message: 'Item marked as returned and available stock restored.',
      result,
    });
  } catch (error: any) {
    console.error('POST /api/lend-records/[id]/return error:', error);
    const msg = error?.message || 'Failed to process return.';
    const status = msg.includes('not found')
      ? 404
      : msg.includes('already') || msg.includes('Insufficient')
      ? 400
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
