import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signSessionToken, verifySessionToken, AuthUser } from '@/lib/auth';
import { generateSecureToken, hashToken, verifyTokenHash } from '@/lib/tokens';

describe('Unit Tests: Tokens & Cryptography', () => {
  it('hashes passwords securely and verifies them accurately', async () => {
    const plain = 'StarkIndustriesSecurePass123!';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);

    const isMatch = await verifyPassword(plain, hash);
    expect(isMatch).toBe(true);

    const isWrong = await verifyPassword('WrongPassword123!', hash);
    expect(isWrong).toBe(false);
  });

  it('generates high-entropy cryptographic random hex tokens', () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);

    expect(token1).toHaveLength(64); // 32 bytes = 64 hex characters
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it('computes deterministic SHA-256 token hashes', () => {
    const rawToken = '4f8b2d1c9a6e3f0a5b8c2d1e7f9a0b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a';
    const hash1 = hashToken(rawToken);
    const hash2 = hashToken(rawToken);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(rawToken);
  });

  it('verifies token hashes with timing-safe comparison', () => {
    const rawToken = generateSecureToken(32);
    const storedHash = hashToken(rawToken);

    expect(verifyTokenHash(rawToken, storedHash)).toBe(true);
    expect(verifyTokenHash('tampered-token-value', storedHash)).toBe(false);
    expect(verifyTokenHash('', storedHash)).toBe(false);
  });

  it('signs and verifies session JWT embedding sessionVersion and identity', async () => {
    const testUser: AuthUser = {
      id: 'test-user-id-123',
      email: 'tony@stark.com',
      name: 'Tony Stark',
      username: 'ironman',
      role: 'ADMIN',
      sessionVersion: 3,
      sessionId: 'session-abc-456',
    };

    const jwtToken = await signSessionToken(testUser, 3, 'session-abc-456');
    expect(jwtToken).toBeDefined();
    expect(typeof jwtToken).toBe('string');

    const verified = await verifySessionToken(jwtToken);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(testUser.id);
    expect(verified?.email).toBe(testUser.email);
    expect(verified?.sessionVersion).toBe(3);
    expect(verified?.sessionId).toBe('session-abc-456');
  });

  it('rejects tampered JWT session tokens', async () => {
    const testUser: AuthUser = {
      id: 'test-user-tamper',
      email: 'hacker@target.com',
      name: 'Hacker',
      username: 'hacker',
      role: 'USER',
      sessionVersion: 1,
    };

    const jwtToken = await signSessionToken(testUser, 1);
    const tampered = jwtToken.slice(0, -6) + 'abcdef';

    const verified = await verifySessionToken(tampered);
    expect(verified).toBeNull();
  });
});
