import { describe, it, expect } from 'vitest';
import { calculateAge, calculateProfileCompletion, sanitizeProfileForViewer } from '@/lib/profile-utils';

describe('Integration Tests: Profile System, Role Adaptability & Privacy Sanitization', () => {
  it('accurately calculates user age from date of birth without timezone distortion', () => {
    const today = new Date();
    const twentyYearsAgo = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate() - 2);
    const age = calculateAge(twentyYearsAgo);
    expect(age).toBe(20);

    // Empty or null returns null
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge('')).toBeNull();
  });

  it('calculates profile completion percentage based on non-sensitive engineering fields', () => {
    const user = { name: 'Tony Stark', username: 'ironman', avatarUrl: 'https://stark.com/avatar.jpg' };
    const profile = {
      bio: 'Genius, billionaire, playboy, philanthropist. Hardware engineer.',
      skills: '["C++", "Circuit Design", "Embedded C"]',
    };
    const educations = [{ institutionName: 'MIT' }];

    const metrics = calculateProfileCompletion(user, profile, educations);
    expect(metrics.percentage).toBeGreaterThanOrEqual(80);
    expect(metrics.completedSections).toContain('Core Account Identity');
    expect(metrics.completedSections).toContain('Profile Picture');
  });

  it('STRICT PRIVACY: Sanitizes target user profile for non-friend viewer (Zero PII Leakage)', () => {
    const targetUser = {
      id: 'usr_target_777',
      name: 'Pepper Potts',
      username: 'pepper',
      email: 'pepper.potts@private-corp.com', // MUST NEVER LEAK
      avatarUrl: 'https://stark.com/pepper.jpg',
      profile: {
        mobile: '+91 9876543210',             // MUST NEVER LEAK
        dob: new Date('1990-05-15'),          // MUST NEVER LEAK
        bio: 'Chief Executive Officer.',
        occupation: 'Management',
        skills: '["Operations", "Procurement"]',
      },
      privacySettings: {
        profileVisibility: 'public',
        showAvatarTo: 'public',
        showBioTo: 'public',
        showEducationTo: 'private',
        showSkillsTo: 'private',
        allowExactDiscovery: true,
        isDiscoverable: true,
      },
    };

    const sanitized = sanitizeProfileForViewer(targetUser, 'viewer_id_999', false);

    // Public/allowed fields
    expect(sanitized.id).toBe(targetUser.id);
    expect(sanitized.username).toBe(targetUser.username);
    expect(sanitized.name).toBe(targetUser.name);

    // STRICT PRIVACY REDACTION:
    expect((sanitized as any).email).toBeUndefined();
    expect((sanitized as any).mobile).toBeUndefined();
    expect((sanitized as any).dob).toBeUndefined();
    expect((sanitized as any).passwordHash).toBeUndefined();
  });
});
