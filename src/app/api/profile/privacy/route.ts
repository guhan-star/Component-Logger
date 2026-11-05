import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const privacySchema = z.object({
  profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
  showAvatarTo: z.enum(['public', 'friends', 'private']).optional(),
  showBioTo: z.enum(['public', 'friends', 'private']).optional(),
  showEducationTo: z.enum(['public', 'friends', 'private']).optional(),
  showProfessionalTo: z.enum(['public', 'friends', 'private']).optional(),
  showSkillsTo: z.enum(['public', 'friends', 'private']).optional(),
  allowExactDiscovery: z.boolean().optional(),
  isDiscoverable: z.boolean().optional(),
});

// PATCH /api/profile/privacy - Update server-side privacy controls
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const parsed = privacySchema.safeParse(body);

    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message || 'Invalid privacy payload';
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const updated = await prisma.userPrivacySettings.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...parsed.data,
      },
      update: parsed.data,
    });

    return NextResponse.json({
      success: true,
      message: 'Privacy settings updated successfully',
      privacySettings: updated,
    });
  } catch (error: any) {
    console.error('PATCH /api/profile/privacy error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update privacy settings' }, { status: 500 });
  }
}
