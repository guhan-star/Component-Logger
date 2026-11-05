import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';

function parseTags(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.slice(0, 3);
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch {
    return typeof val === 'string' ? [val] : [];
  }
}

// GET /api/friends/suggestions - Discoverable Component Logger users (People You May Know)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user: currentUser } = authResult;

    // Rate limiting: prevent scraping/enumeration
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(
      `suggestions:${currentUser.id}:${ip}`,
      RATE_LIMIT_POLICIES.USERNAME_DISCOVERY
    );
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(30, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
    const skip = (page - 1) * limit;

    // 1. Gather all existing friendships for the caller
    const existingFriendships = await prisma.friendship.findMany({
      where: {
        OR: [{ user1Id: currentUser.id }, { user2Id: currentUser.id }],
      },
      select: { user1Id: true, user2Id: true },
    });

    const friendIds = new Set<string>();
    existingFriendships.forEach((f) => {
      friendIds.add(f.user1Id === currentUser.id ? f.user2Id : f.user1Id);
    });

    // 2. Gather all pending friend requests (both sent and received)
    const pendingRequests = await prisma.friendRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [{ senderId: currentUser.id }, { receiverId: currentUser.id }],
      },
      select: { senderId: true, receiverId: true },
    });

    const pendingUserIds = new Set<string>();
    pendingRequests.forEach((r) => {
      pendingUserIds.add(r.senderId === currentUser.id ? r.receiverId : r.senderId);
    });

    // Combined exclusion set: caller + existing friends + pending requests
    const excludedIds = [currentUser.id, ...Array.from(friendIds), ...Array.from(pendingUserIds)];

    // 3. Query eligible users
    // Criteria:
    // - Active user
    // - Not in excludedIds
    // - privacySettings is NOT disabled (isDiscoverable != false, or no privacySettings row yet)
    const baseWhere = {
      isActive: true,
      id: { notIn: excludedIds },
      OR: [
        { privacySettings: null },
        { privacySettings: { isDiscoverable: true } },
      ],
    };

    const [totalCount, eligibleUsers] = await Promise.all([
      prisma.user.count({ where: baseWhere }),
      prisma.user.findMany({
        where: baseWhere,
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          profile: {
            select: {
              jobRole: true,
              occupation: true,
              organization: true,
              bio: true,
              skills: true,
              hardwareInterests: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // 4. Calculate mutual friends count for each suggested candidate
    // If caller has friends, inspect candidate friendships to compute mutual count
    const candidateIds = eligibleUsers.map((u) => u.id);
    let mutualCounts = new Map<string, number>();

    if (friendIds.size > 0 && candidateIds.length > 0) {
      const candidateFriendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { user1Id: { in: candidateIds } },
            { user2Id: { in: candidateIds } },
          ],
        },
        select: { user1Id: true, user2Id: true },
      });

      candidateFriendships.forEach((cf) => {
        const cId = candidateIds.includes(cf.user1Id) ? cf.user1Id : cf.user2Id;
        const otherId = cId === cf.user1Id ? cf.user2Id : cf.user1Id;
        if (friendIds.has(otherId)) {
          mutualCounts.set(cId, (mutualCounts.get(cId) || 0) + 1);
        }
      });
    }

    // 5. Sanitize and structure output — ZERO PRIVATE DATA LEAKAGE
    const suggestions = eligibleUsers.map((candidate) => {
      const p = candidate.profile;
      const role = p?.jobRole || p?.occupation || null;
      const company = p?.organization || null;
      const skills = parseTags(p?.skills);
      const hardware = parseTags(p?.hardwareInterests);
      const combinedTags = Array.from(new Set([...skills, ...hardware])).slice(0, 3);

      return {
        id: candidate.id,
        username: candidate.username,
        name: candidate.name,
        avatarUrl: candidate.avatarUrl,
        professionalTitle: role ? (company ? `${role} at ${company}` : role) : null,
        bio: p?.bio ? (p.bio.length > 120 ? `${p.bio.slice(0, 117)}...` : p.bio) : null,
        tags: combinedTags,
        mutualFriends: mutualCounts.get(candidate.id) || 0,
      };
    });

    // Secondary sort: Prioritize candidates with mutual friends
    suggestions.sort((a, b) => b.mutualFriends - a.mutualFriends);

    return NextResponse.json({
      success: true,
      suggestions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    });
  } catch (error: any) {
    console.error('GET /api/friends/suggestions error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch suggestions' },
      { status: 500 }
    );
  }
}
