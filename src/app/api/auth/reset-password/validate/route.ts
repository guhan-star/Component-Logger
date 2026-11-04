import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Reset token is required.' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      return NextResponse.json({ valid: false, code: 'INVALID_TOKEN', error: 'Reset token is invalid or unrecognized.' });
    }

    if (record.usedAt) {
      return NextResponse.json({ valid: false, code: 'TOKEN_ALREADY_USED', error: 'This password reset link has already been used.' });
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ valid: false, code: 'TOKEN_EXPIRED', error: 'This password reset link has expired.' });
    }

    return NextResponse.json({ valid: true, expiresAt: record.expiresAt });
  } catch (error: any) {
    console.error('GET /api/auth/reset-password/validate error:', error);
    return NextResponse.json({ valid: false, error: 'Failed to validate token.' }, { status: 500 });
  }
}
