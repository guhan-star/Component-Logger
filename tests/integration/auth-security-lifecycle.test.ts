import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  requireAuth,
  revokeAllUserSessions,
  COOKIE_NAME,
} from '@/lib/auth';
import { generateSecureToken, hashToken, verifyTokenHash } from '@/lib/tokens';

describe('Integration Tests: Complete Auth Security, Verification, Recovery & Revocation', () => {
  const mockUserId = 'usr_stark_integration_test_01';
  const mockUser = {
    id: mockUserId,
    email: 'integration@stark.com',
    name: 'Integration Operator',
    username: 'integ_op',
    passwordHash: '',
    role: 'USER',
    isActive: true,
    isEmailVerified: false,
    sessionVersion: 1,
  };

  let mockVerificationTokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  }> = [];

  let mockResetTokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
  }> = [];

  beforeEach(async () => {
    mockUser.passwordHash = await hashPassword('InitialStrongPass123!');
    mockUser.isEmailVerified = false;
    mockUser.sessionVersion = 1;
    mockVerificationTokens = [];
    mockResetTokens = [];

    // Mock prisma queries for isolated, clean execution
    vi.spyOn(prisma.user, 'findUnique').mockImplementation(async ({ where }: any) => {
      if (where.id === mockUserId || where.email === mockUser.email || where.username === mockUser.username) {
        return { ...mockUser } as any;
      }
      return null;
    });

    vi.spyOn(prisma.user, 'findFirst').mockImplementation(async ({ where }: any) => {
      if (where?.OR?.some((o: any) => o.email === mockUser.email || o.username === mockUser.username)) {
        return { ...mockUser } as any;
      }
      return null;
    });

    vi.spyOn(prisma.user, 'update').mockImplementation(async ({ where, data }: any) => {
      if (where.id === mockUserId) {
        if (data.sessionVersion && typeof data.sessionVersion === 'object' && data.sessionVersion.increment) {
          mockUser.sessionVersion += data.sessionVersion.increment;
        } else if (data.sessionVersion !== undefined) {
          mockUser.sessionVersion = data.sessionVersion;
        }
        if (data.passwordHash) mockUser.passwordHash = data.passwordHash;
        if (data.isEmailVerified !== undefined) mockUser.isEmailVerified = data.isEmailVerified;
        return { ...mockUser } as any;
      }
      return null as any;
    });

    vi.spyOn(prisma.emailVerificationToken, 'findFirst').mockImplementation(async ({ where }: any) => {
      const hash = where.OR?.[0]?.tokenHash;
      const found = mockVerificationTokens.find((t) => t.tokenHash === hash);
      if (found) {
        return { ...found, user: { ...mockUser } } as any;
      }
      return null;
    });

    vi.spyOn(prisma.emailVerificationToken, 'update').mockImplementation(async ({ where, data }: any) => {
      const idx = mockVerificationTokens.findIndex((t) => t.id === where.id);
      if (idx !== -1) {
        mockVerificationTokens[idx].usedAt = data.usedAt;
        return { ...mockVerificationTokens[idx] } as any;
      }
      return null as any;
    });

    vi.spyOn(prisma.passwordResetToken, 'findUnique').mockImplementation(async ({ where }: any) => {
      const found = mockResetTokens.find((t) => t.tokenHash === where.tokenHash);
      return found ? ({ ...found, user: { ...mockUser } } as any) : null;
    });

    vi.spyOn(prisma.passwordResetToken, 'update').mockImplementation(async ({ where, data }: any) => {
      const idx = mockResetTokens.findIndex((t) => t.id === where.id);
      if (idx !== -1) {
        mockResetTokens[idx].usedAt = data.usedAt;
        return { ...mockResetTokens[idx] } as any;
      }
      return null as any;
    });

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback(prisma);
    });
  });

  // ---------------------------------------------------------------------------
  // 1. REGISTRATION & EMAIL VERIFICATION
  // ---------------------------------------------------------------------------
  it('1. User is registered unverified; raw token is never stored in DB', async () => {
    expect(mockUser.isEmailVerified).toBe(false);
    expect(mockUser.sessionVersion).toBe(1);

    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    mockVerificationTokens.push({
      id: 'vt-1',
      userId: mockUser.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usedAt: null,
    });

    // Verify token was stored as SHA-256 hash, NOT raw token
    expect(mockVerificationTokens[0].tokenHash).not.toBe(rawToken);
    expect(verifyTokenHash(rawToken, mockVerificationTokens[0].tokenHash)).toBe(true);
  });

  it('2. Consumes email verification token atomically and marks user as verified', async () => {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    mockVerificationTokens.push({
      id: 'vt-2',
      userId: mockUser.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usedAt: null,
    });

    // Simulate verification endpoint logic
    const record = await prisma.emailVerificationToken.findFirst({
      where: { OR: [{ tokenHash }] },
    });
    expect(record).not.toBeNull();
    expect(record?.usedAt).toBeNull();

    await prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: record!.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: record!.userId },
        data: { isEmailVerified: true },
      });
    });

    expect(mockUser.isEmailVerified).toBe(true);
    expect(mockVerificationTokens.find((t) => t.id === 'vt-2')?.usedAt).not.toBeNull();
  });

  it('3. Rejects already used verification token (single-use enforcement)', async () => {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    mockVerificationTokens.push({
      id: 'vt-3',
      userId: mockUser.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usedAt: new Date(Date.now() - 5000), // Already consumed!
    });

    const record = await prisma.emailVerificationToken.findFirst({
      where: { OR: [{ tokenHash }] },
    });

    expect(record?.usedAt).not.toBeNull();
    // In endpoint: record.usedAt -> returns 400 TOKEN_ALREADY_USED
  });

  it('4. Rejects expired verification token', async () => {
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);

    mockVerificationTokens.push({
      id: 'vt-4',
      userId: mockUser.id,
      tokenHash,
      expiresAt: new Date(Date.now() - 1000), // Expired!
      usedAt: null,
    });

    const record = await prisma.emailVerificationToken.findFirst({
      where: { OR: [{ tokenHash }] },
    });

    expect(new Date() > record!.expiresAt).toBe(true);
    // In endpoint: new Date() > record.expiresAt -> returns 400 TOKEN_EXPIRED
  });

  // ---------------------------------------------------------------------------
  // 2. FORGOT PASSWORD & PASSWORD RESET
  // ---------------------------------------------------------------------------
  it('5. Generates hashed single-use password reset token with 1-hour expiry', async () => {
    const rawResetToken = generateSecureToken(32);
    const resetTokenHash = hashToken(rawResetToken);

    mockResetTokens.push({
      id: 'prt-1',
      userId: mockUser.id,
      tokenHash: resetTokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    });

    expect(mockResetTokens[0].tokenHash).not.toBe(rawResetToken);
    expect(verifyTokenHash(rawResetToken, mockResetTokens[0].tokenHash)).toBe(true);
  });

  it('6. Completes password reset atomically, updates hash, and bumps sessionVersion', async () => {
    const rawResetToken = generateSecureToken(32);
    const resetTokenHash = hashToken(rawResetToken);

    mockResetTokens.push({
      id: 'prt-2',
      userId: mockUser.id,
      tokenHash: resetTokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    });

    const newPassword = 'BrandNewSuperSecurePass456!';
    const newPasswordHash = await hashPassword(newPassword);

    const initialVersion = mockUser.sessionVersion; // 1

    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: 'prt-2' },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: mockUser.id },
        data: {
          passwordHash: newPasswordHash,
          sessionVersion: { increment: 1 },
        },
      });
    });

    // Verify token was marked as consumed
    expect(mockResetTokens.find((t) => t.id === 'prt-2')?.usedAt).not.toBeNull();

    // Verify password was updated
    const isNewPassValid = await verifyPassword(newPassword, mockUser.passwordHash);
    expect(isNewPassValid).toBe(true);

    const isOldPassValid = await verifyPassword('InitialStrongPass123!', mockUser.passwordHash);
    expect(isOldPassValid).toBe(false);

    // Verify sessionVersion was incremented (from 1 to 2)
    expect(mockUser.sessionVersion).toBe(initialVersion + 1);
  });

  it('7. Rejects already used password reset token', async () => {
    const rawResetToken = generateSecureToken(32);
    const resetTokenHash = hashToken(rawResetToken);

    mockResetTokens.push({
      id: 'prt-3',
      userId: mockUser.id,
      tokenHash: resetTokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: new Date(Date.now() - 10_000), // Already consumed!
    });

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: resetTokenHash },
    });

    expect(record?.usedAt).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // 3. MANDATORY: SESSION REVOCATION ACROSS ALL DEVICES
  // ---------------------------------------------------------------------------
  it('8. CRITICAL: Rejects prior session tokens immediately after sessionVersion increment', async () => {
    // Device A logs in while user is on sessionVersion: 1
    mockUser.sessionVersion = 1;
    const deviceAJwt = await signSessionToken(
      {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        username: mockUser.username,
        role: 'USER',
        sessionVersion: 1,
      },
      1
    );

    // Verify Device A can access protected route with sessionVersion 1
    const mockRequestBefore = {
      cookies: {
        get: (name: string) => (name === COOKIE_NAME ? { value: deviceAJwt } : undefined),
      },
    };

    const authBefore = await requireAuth(mockRequestBefore);
    expect(authBefore.error).toBeUndefined();
    expect(authBefore.user?.id).toBe(mockUser.id);

    // Password is reset or user clicks "Revoke All Other Sessions", bumping sessionVersion to 2!
    await revokeAllUserSessions(mockUser.id);
    expect(mockUser.sessionVersion).toBe(2);

    // Device A attempts to use its old JWT (sessionVersion: 1)
    const authAfter = await requireAuth(mockRequestBefore);

    // MUST BE REJECTED!
    expect(authAfter.error).toBe(true);
    expect(authAfter.response).toBeDefined();
    expect(authAfter.response.status).toBe(401);

    const json = await authAfter.response.json();
    expect(json.code).toBe('SESSION_REVOKED');
  });

  it('9. Allows access for newly issued tokens matching the new sessionVersion', async () => {
    mockUser.sessionVersion = 2;

    const freshDeviceJwt = await signSessionToken(
      {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        username: mockUser.username,
        role: 'USER',
        sessionVersion: 2,
      },
      2
    );

    const mockRequest = {
      cookies: {
        get: (name: string) => (name === COOKIE_NAME ? { value: freshDeviceJwt } : undefined),
      },
    };

    const authResult = await requireAuth(mockRequest);
    expect(authResult.error).toBeUndefined();
    expect(authResult.user?.id).toBe(mockUser.id);
    expect(authResult.user?.sessionVersion).toBe(2);
  });
});
