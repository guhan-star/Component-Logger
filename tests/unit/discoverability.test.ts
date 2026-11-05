import { describe, it, expect } from 'vitest';
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

describe('Unit Tests: Discoverability & Privacy Settings Validation', () => {
  it('defaults isDiscoverable to true when unset or missing in user settings', () => {
    const rawSettings: { isDiscoverable?: boolean } = {};
    const effectiveDiscoverable = rawSettings.isDiscoverable !== false;
    expect(effectiveDiscoverable).toBe(true);
  });

  it('preserves explicit false discoverability preference', () => {
    const rawSettings: { isDiscoverable?: boolean } = { isDiscoverable: false };
    const effectiveDiscoverable = rawSettings.isDiscoverable !== false;
    expect(effectiveDiscoverable).toBe(false);
  });

  it('validates isDiscoverable as a boolean in privacy update schema', () => {
    const validPayload = {
      isDiscoverable: false,
      allowExactDiscovery: true,
      profileVisibility: 'friends' as const,
    };

    const result = privacySchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isDiscoverable).toBe(false);
    }
  });

  it('rejects invalid types for isDiscoverable in privacy update schema', () => {
    const invalidPayload = {
      isDiscoverable: 'not-a-boolean',
    };

    const result = privacySchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });
});
