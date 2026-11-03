/**
 * Stark Industries WMC — User Profile Utilities
 * Handles exact age calculation, meaningful profile completion scoring,
 * and server-side privacy filtering / field-level redaction.
 */

export function calculateAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export interface ProfileCompletionMetrics {
  percentage: number;
  completedSections: string[];
  missingSuggestions: string[];
}

/**
 * Calculates profile completion from meaningful, non-sensitive fields.
 * Explicitly DOES NOT require sensitive personal info (DOB, mobile, gender) to hit 100%.
 */
export function calculateProfileCompletion(
  user: { name?: string; username?: string; avatarUrl?: string | null },
  profile?: any,
  educations?: any[]
): ProfileCompletionMetrics {
  const completedSections: string[] = [];
  const missingSuggestions: string[] = [];

  let score = 0;

  // 1. Core Identity (25%)
  if (user.name && user.username) {
    score += 25;
    completedSections.push('Core Account Identity');
  }

  // 2. Profile Picture (20%)
  if (user.avatarUrl) {
    score += 20;
    completedSections.push('Profile Picture');
  } else {
    missingSuggestions.push('Upload an avatar or profile photo');
  }

  // 3. Bio & Professional Context (20%)
  if (profile?.bio && profile.bio.trim().length >= 10) {
    score += 20;
    completedSections.push('Bio & Summary');
  } else {
    missingSuggestions.push('Add a short technical bio describing your engineering background');
  }

  // 4. Academic or Education History (20%)
  if (educations && educations.length > 0 && educations[0].institutionName) {
    score += 20;
    completedSections.push('Education Background');
  } else {
    missingSuggestions.push('Add your college or university details');
  }

  // 5. Technical Skills & Engineering Interests (15%)
  const hasSkills = Boolean(profile?.skills || profile?.programmingLanguages || profile?.hardwareInterests);
  if (hasSkills) {
    score += 15;
    completedSections.push('Technical Skills & Focus Areas');
  } else {
    missingSuggestions.push('List your hardware skills or programming languages');
  }

  return {
    percentage: Math.min(100, score),
    completedSections,
    missingSuggestions,
  };
}

/**
 * Strips sensitive fields (DOB, mobile, private email, internal security)
 * and enforces server-side field-level privacy settings.
 */
export function sanitizeProfileForViewer(
  targetUser: any,
  viewerUserId: string,
  isFriend: boolean = false
) {
  const isOwner = targetUser.id === viewerUserId;

  // Owner always sees full profile with private fields
  if (isOwner) {
    return {
      ...targetUser,
      calculatedAge: calculateAge(targetUser.profile?.dob),
      isOwner: true,
    };
  }

  const privacy = targetUser.privacySettings || {
    profileVisibility: 'friends',
    showAvatarTo: 'friends',
    showBioTo: 'private',
    showEducationTo: 'private',
    showProfessionalTo: 'private',
    showSkillsTo: 'private',
  };

  // If profile visibility is private and viewer is not owner, return minimal discovery representation
  if (privacy.profileVisibility === 'private') {
    return {
      id: targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      isOwner: false,
      isFriend,
    };
  }

  const canViewFriendsFields = isFriend;

  // Build filtered representation
  const sanitized: any = {
    id: targetUser.id,
    username: targetUser.username,
    name: targetUser.name,
    displayName: targetUser.profile?.displayName || targetUser.name,
    isOwner: false,
    isFriend,
  };

  // Avatar visibility
  if (privacy.showAvatarTo === 'public' || (privacy.showAvatarTo === 'friends' && canViewFriendsFields)) {
    sanitized.avatarUrl = targetUser.avatarUrl;
  }

  // Bio visibility
  if (privacy.showBioTo === 'public' || (privacy.showBioTo === 'friends' && canViewFriendsFields)) {
    sanitized.bio = targetUser.profile?.bio || null;
  }

  // Education visibility
  if (privacy.showEducationTo === 'public' || (privacy.showEducationTo === 'friends' && canViewFriendsFields)) {
    sanitized.educations = (targetUser.educations || []).map((e: any) => ({
      institutionName: e.institutionName,
      department: e.department,
      degree: e.degree,
      academicStatus: e.academicStatus,
      passoutYear: e.passoutYear,
    }));
  }

  // Professional & Skills visibility
  if (privacy.showProfessionalTo === 'public' || (privacy.showProfessionalTo === 'friends' && canViewFriendsFields)) {
    sanitized.occupation = targetUser.profile?.occupation || null;
    sanitized.organization = targetUser.profile?.organization || null;
    sanitized.jobRole = targetUser.profile?.jobRole || null;
  }

  if (privacy.showSkillsTo === 'public' || (privacy.showSkillsTo === 'friends' && canViewFriendsFields)) {
    sanitized.skills = targetUser.profile?.skills || null;
    sanitized.programmingLanguages = targetUser.profile?.programmingLanguages || null;
    sanitized.hardwareInterests = targetUser.profile?.hardwareInterests || null;
    sanitized.engineeringDomains = targetUser.profile?.engineeringDomains || null;
  }

  // SENSITIVE FIELDS ARE NEVER EXPOSED TO OTHER USERS:
  // - email: REDACTED
  // - mobile: REDACTED
  // - dob / age: REDACTED
  // - gender: REDACTED
  // - city / address: REDACTED
  // - passwordHash: NEVER INCLUDED

  return sanitized;
}
