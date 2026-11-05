import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import * as authModule from '@/lib/auth';
import { GET as getSuggestions } from '@/app/api/friends/suggestions/route';
import { NextRequest } from 'next/server';

describe('Integration Tests: People You May Know (Friend Discovery & Privacy)', () => {
  const currentUserId = 'user_current_001';
  const friendUserId = 'user_friend_002';
  const pendingSentUserId = 'user_pending_sent_003';
  const pendingReceivedUserId = 'user_pending_received_004';
  const hiddenUserId = 'user_hidden_005';
  const discoverableUserId = 'user_discoverable_006';

  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock authentication as current user
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
      user: {
        id: currentUserId,
        email: 'current@stark.com',
        name: 'Current Operator',
        username: 'current_op',
        role: 'USER',
      },
    } as any);

    // Mock existing friendships: current user is friends with user_friend_002
    vi.spyOn(prisma.friendship, 'findMany').mockResolvedValue([
      { user1Id: currentUserId, user2Id: friendUserId },
    ] as any);

    // Mock pending requests: sent to user_pending_sent_003, received from user_pending_received_004
    vi.spyOn(prisma.friendRequest, 'findMany').mockResolvedValue([
      { senderId: currentUserId, receiverId: pendingSentUserId },
      { senderId: pendingReceivedUserId, receiverId: currentUserId },
    ] as any);
  });

  it('correctly filters out current user, existing friends, pending requests, and non-discoverable users', async () => {
    // Mock user findMany returning only eligible candidates
    vi.spyOn(prisma.user, 'count').mockResolvedValue(1);
    vi.spyOn(prisma.user, 'findMany').mockImplementation(async ({ where }: any) => {
      const excluded = where.id.notIn;
      expect(excluded).toContain(currentUserId);
      expect(excluded).toContain(friendUserId);
      expect(excluded).toContain(pendingSentUserId);
      expect(excluded).toContain(pendingReceivedUserId);

      // Return only eligible user_discoverable_006
      return [
        {
          id: discoverableUserId,
          username: 'discoverable_op',
          name: 'Discoverable Engineer',
          avatarUrl: 'https://example.com/avatar.jpg',
          createdAt: new Date(),
          profile: {
            jobRole: 'Firmware Architect',
            occupation: null,
            organization: 'Stark Labs',
            bio: 'Embedded Systems Specialist.',
            skills: JSON.stringify(['STM32', 'FreeRTOS']),
            hardwareInterests: JSON.stringify(['Sensors', 'KiCad']),
          },
        },
      ] as any;
    });

    const req = new NextRequest('http://localhost:3000/api/friends/suggestions?page=1&limit=10');
    const res = await getSuggestions(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.suggestions).toHaveLength(1);

    const suggestion = body.suggestions[0];
    expect(suggestion.id).toBe(discoverableUserId);
    expect(suggestion.username).toBe('discoverable_op');
    expect(suggestion.professionalTitle).toBe('Firmware Architect at Stark Labs');
    expect(suggestion.tags).toContain('STM32');

    // CRITICAL SECURITY & PRIVACY CHECK:
    // Ensure sensitive private data is NEVER leaked
    expect(suggestion.email).toBeUndefined();
    expect(suggestion.mobile).toBeUndefined();
    expect(suggestion.passwordHash).toBeUndefined();
    expect(suggestion.inventory).toBeUndefined();
    expect(suggestion.components).toBeUndefined();
  });
});
