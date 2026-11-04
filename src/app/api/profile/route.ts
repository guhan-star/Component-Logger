import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { calculateAge, calculateProfileCompletion, sanitizeProfileForViewer } from '@/lib/profile-utils';
import { z } from 'zod';

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(60).optional(),
  displayName: z.string().trim().max(60).optional().nullable(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain lowercase letters, numbers, underscores, and hyphens')
    .optional(),
  mobile: z.string().trim().max(20).optional().nullable(),
  dob: z.string().optional().nullable(),
  gender: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(60).optional().nullable(),
  state: z.string().trim().max(60).optional().nullable(),
  city: z.string().trim().max(60).optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
  preferredLanguage: z.string().trim().max(10).optional(),
  timezone: z.string().trim().max(50).optional(),

  // Professional & Technical
  occupation: z.string().trim().max(100).optional().nullable(),
  organization: z.string().trim().max(100).optional().nullable(),
  jobRole: z.string().trim().max(100).optional().nullable(),
  experienceYears: z.number().min(0).max(60).optional().nullable(),
  skills: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  programmingLanguages: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  hardwareInterests: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  engineeringDomains: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  preferredTechnologies: z.union([z.string(), z.array(z.string())]).optional().nullable(),
  portfolioUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  githubUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  linkedinUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
  websiteUrl: z.string().trim().url().optional().nullable().or(z.literal('')),
});

// Helper to stringify array or retain string
const serializeJsonArray = (val: any) => {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  if (Array.isArray(val)) return JSON.stringify(val);
  return typeof val === 'string' ? val : JSON.stringify(val);
};

// GET /api/profile - Fetch authenticated user profile or public peer card
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user: currentUser } = authResult;

    const { searchParams } = new URL(request.url);
    const targetUsername = searchParams.get('username')?.toLowerCase()?.trim();

    // If searching for another user
    if (targetUsername && targetUsername !== currentUser.username) {
      const targetUser = await prisma.user.findUnique({
        where: { username: targetUsername },
        include: {
          profile: true,
          educations: { where: { isPrimary: true } },
          privacySettings: true,
        },
      });

      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Check if they are friends
      const isFriend = Boolean(
        await prisma.friendship.findFirst({
          where: {
            OR: [
              { user1Id: currentUser.id, user2Id: targetUser.id },
              { user1Id: targetUser.id, user2Id: currentUser.id },
            ],
          },
        })
      );

      const sanitized = sanitizeProfileForViewer(targetUser, currentUser.id, isFriend);
      return NextResponse.json({ profile: sanitized, isOwner: false });
    }

    // Owner view
    const fullUser = await prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        profile: true,
        educations: { orderBy: { createdAt: 'desc' } },
        settings: true,
        privacySettings: true,
      },
    });

    if (!fullUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const calculatedAge = calculateAge(fullUser.profile?.dob);
    const completion = calculateProfileCompletion(fullUser, fullUser.profile, fullUser.educations);

    return NextResponse.json({
      user: {
        id: fullUser.id,
        name: fullUser.name,
        username: fullUser.username,
        email: fullUser.email,
        role: fullUser.role,
        avatarUrl: fullUser.avatarUrl,
        createdAt: fullUser.createdAt,
        isEmailVerified: fullUser.isEmailVerified,
        sessionVersion: fullUser.sessionVersion,
      },
      profile: fullUser.profile || null,
      educations: fullUser.educations || [],
      settings: fullUser.settings || null,
      privacySettings: fullUser.privacySettings || null,
      calculatedAge,
      completion,
      isOwner: true,
    });
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

// PATCH /api/profile - Secure partial update of user profile
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message || 'Invalid profile information';
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const data = parsed.data;

    // Check username uniqueness if changing
    if (data.username && data.username !== user.username) {
      const conflict = await prisma.user.findUnique({
        where: { username: data.username },
      });
      if (conflict && conflict.id !== user.id) {
        return NextResponse.json({ error: 'Username is already taken. Please choose another.' }, { status: 409 });
      }
    }

    // Update User core fields
    if (data.name || data.username) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.username ? { username: data.username } : {}),
        },
      });
    }

    // Upsert UserProfile record
    const parsedDob = data.dob ? new Date(data.dob) : data.dob === null ? null : undefined;

    const profileData: any = {
      ...(data.displayName !== undefined ? { displayName: data.displayName || null } : {}),
      ...(data.mobile !== undefined ? { mobile: data.mobile || null } : {}),
      ...(parsedDob !== undefined ? { dob: parsedDob } : {}),
      ...(data.gender !== undefined ? { gender: data.gender || null } : {}),
      ...(data.country !== undefined ? { country: data.country || null } : {}),
      ...(data.state !== undefined ? { state: data.state || null } : {}),
      ...(data.city !== undefined ? { city: data.city || null } : {}),
      ...(data.bio !== undefined ? { bio: data.bio || null } : {}),
      ...(data.preferredLanguage ? { preferredLanguage: data.preferredLanguage } : {}),
      ...(data.timezone ? { timezone: data.timezone } : {}),
      ...(data.occupation !== undefined ? { occupation: data.occupation || null } : {}),
      ...(data.organization !== undefined ? { organization: data.organization || null } : {}),
      ...(data.jobRole !== undefined ? { jobRole: data.jobRole || null } : {}),
      ...(data.experienceYears !== undefined ? { experienceYears: data.experienceYears } : {}),
      ...(data.skills !== undefined ? { skills: serializeJsonArray(data.skills) } : {}),
      ...(data.programmingLanguages !== undefined ? { programmingLanguages: serializeJsonArray(data.programmingLanguages) } : {}),
      ...(data.hardwareInterests !== undefined ? { hardwareInterests: serializeJsonArray(data.hardwareInterests) } : {}),
      ...(data.engineeringDomains !== undefined ? { engineeringDomains: serializeJsonArray(data.engineeringDomains) } : {}),
      ...(data.preferredTechnologies !== undefined ? { preferredTechnologies: serializeJsonArray(data.preferredTechnologies) } : {}),
      ...(data.portfolioUrl !== undefined ? { portfolioUrl: data.portfolioUrl || null } : {}),
      ...(data.githubUrl !== undefined ? { githubUrl: data.githubUrl || null } : {}),
      ...(data.linkedinUrl !== undefined ? { linkedinUrl: data.linkedinUrl || null } : {}),
      ...(data.websiteUrl !== undefined ? { websiteUrl: data.websiteUrl || null } : {}),
    };

    const updatedProfile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...profileData,
      },
      update: profileData,
    });

    const calculatedAge = calculateAge(updatedProfile.dob);

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile,
      calculatedAge,
    });
  } catch (error: any) {
    console.error('PATCH /api/profile error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update profile' }, { status: 500 });
  }
}
