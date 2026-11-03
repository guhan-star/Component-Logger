'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  GraduationCap,
  Briefcase,
  Sliders,
  Shield,
  Key,
  Camera,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Plus,
  X,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Globe,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

interface ProfileData {
  displayName?: string | null;
  mobile?: string | null;
  isMobileVerified?: boolean;
  dob?: string | null;
  gender?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  bio?: string | null;
  preferredLanguage?: string;
  timezone?: string;
  occupation?: string | null;
  organization?: string | null;
  jobRole?: string | null;
  experienceYears?: number | null;
  skills?: string | null;
  programmingLanguages?: string | null;
  hardwareInterests?: string | null;
  engineeringDomains?: string | null;
  preferredTechnologies?: string | null;
  portfolioUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
}

interface EducationData {
  id?: string;
  institutionName: string;
  department?: string | null;
  degree?: string | null;
  course?: string | null;
  specialization?: string | null;
  academicStatus: 'Studying' | 'Graduated' | 'Postgraduate' | 'Other';
  currentYear?: number | null;
  admissionYear?: number | null;
  expectedGraduationYear?: number | null;
  passoutYear?: number | null;
  location?: string | null;
  collegeEmail?: string | null;
  portfolioUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
}

interface PreferencesData {
  theme: string;
  defaultCurrency: string;
  defaultUnit: string;
  dateFormat: string;
  defaultInventoryView: string;
  notifyEmail: boolean;
  notifyProjectInvites: boolean;
  notifyBorrowReminders: boolean;
  notifyReturnReminders: boolean;
}

interface PrivacyData {
  profileVisibility: string;
  showAvatarTo: string;
  showBioTo: string;
  showEducationTo: string;
  showProfessionalTo: string;
  showSkillsTo: string;
  allowExactDiscovery: boolean;
}

const parseTagArray = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return typeof val === 'string'
      ? val.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
  }
};

export default function ProfilePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    'personal' | 'education' | 'professional' | 'preferences' | 'privacy' | 'security'
  >('personal');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Core Data
  const [user, setUser] = useState<UserData | null>(null);
  const [profile, setProfile] = useState<ProfileData>({});
  const [education, setEducation] = useState<EducationData>({
    institutionName: '',
    academicStatus: 'Studying',
  });
  const [preferences, setPreferences] = useState<PreferencesData>({
    theme: 'dark',
    defaultCurrency: 'INR',
    defaultUnit: 'Piece',
    dateFormat: 'DD/MM/YYYY',
    defaultInventoryView: 'table',
    notifyEmail: true,
    notifyProjectInvites: true,
    notifyBorrowReminders: true,
    notifyReturnReminders: true,
  });
  const [privacy, setPrivacy] = useState<PrivacyData>({
    profileVisibility: 'friends',
    showAvatarTo: 'friends',
    showBioTo: 'private',
    showEducationTo: 'private',
    showProfessionalTo: 'private',
    showSkillsTo: 'private',
    allowExactDiscovery: true,
  });

  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);
  const [completion, setCompletion] = useState({ percentage: 0, missingSuggestions: [] as string[] });

  // Tag inputs
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');

  const [progLangTags, setProgLangTags] = useState<string[]>([]);
  const [newProgLang, setNewProgLang] = useState('');

  const [hwInterestTags, setHwInterestTags] = useState<string[]>([]);
  const [newHwInterest, setNewHwInterest] = useState('');

  // Password Change
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  // Account Deletion Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Email Change
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [verificationTokenInput, setVerificationTokenInput] = useState('');
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/profile');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setProfile(data.profile || {});
        if (data.educations && data.educations.length > 0) {
          setEducation(data.educations[0]);
        }
        if (data.settings) {
          setPreferences({
            theme: data.settings.theme || 'dark',
            defaultCurrency: data.settings.defaultCurrency || 'INR',
            defaultUnit: data.settings.defaultUnit || 'Piece',
            dateFormat: data.settings.dateFormat || 'DD/MM/YYYY',
            defaultInventoryView: data.settings.defaultInventoryView || 'table',
            notifyEmail: data.settings.notifyEmail !== false,
            notifyProjectInvites: data.settings.notifyProjectInvites !== false,
            notifyBorrowReminders: data.settings.notifyBorrowReminders !== false,
            notifyReturnReminders: data.settings.notifyReturnReminders !== false,
          });
        }
        if (data.privacySettings) {
          setPrivacy(data.privacySettings);
        }
        setCalculatedAge(data.calculatedAge);
        setCompletion(data.completion || { percentage: 0, missingSuggestions: [] });

        setSkillTags(parseTagArray(data.profile?.skills));
        setProgLangTags(parseTagArray(data.profile?.programmingLanguages));
        setHwInterestTags(parseTagArray(data.profile?.hardwareInterests));
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Avatar Upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Avatar file size cannot exceed 5 MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUser((prev) => (prev ? { ...prev, avatarUrl: data.avatarUrl } : null));
        setSaveSuccess('Profile picture updated successfully!');
        setTimeout(() => setSaveSuccess(null), 3000);
        loadProfile();
      } else {
        alert(data.error || 'Failed to upload profile picture');
      }
    } catch {
      alert('Network error while uploading profile picture');
    }
  };

  const handleAvatarRemove = async () => {
    if (!confirm('Remove your profile picture and restore default avatar?')) return;
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' });
      if (res.ok) {
        setUser((prev) => (prev ? { ...prev, avatarUrl: null } : null));
        setSaveSuccess('Profile picture removed.');
        setTimeout(() => setSaveSuccess(null), 3000);
        loadProfile();
      }
    } catch {
      alert('Failed to remove avatar');
    }
  };

  // Save Personal & Professional Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const payload = {
        name: user?.name,
        displayName: profile.displayName || null,
        mobile: profile.mobile || null,
        dob: profile.dob || null,
        gender: profile.gender || null,
        country: profile.country || null,
        state: profile.state || null,
        city: profile.city || null,
        bio: profile.bio || null,
        preferredLanguage: profile.preferredLanguage || 'en',
        timezone: profile.timezone || 'Asia/Kolkata',

        occupation: profile.occupation || null,
        organization: profile.organization || null,
        jobRole: profile.jobRole || null,
        experienceYears: profile.experienceYears ? Number(profile.experienceYears) : null,
        skills: skillTags,
        programmingLanguages: progLangTags,
        hardwareInterests: hwInterestTags,
        portfolioUrl: profile.portfolioUrl || null,
        githubUrl: profile.githubUrl || null,
        linkedinUrl: profile.linkedinUrl || null,
        websiteUrl: profile.websiteUrl || null,
      };

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      setSaveSuccess('Profile information saved successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
      loadProfile();
    } catch (err: any) {
      setSaveError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  // Save Education
  const handleSaveEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const payload = {
        id: education.id,
        institutionName: education.institutionName.trim(),
        department: education.department || null,
        degree: education.degree || null,
        course: education.course || null,
        specialization: education.specialization || null,
        academicStatus: education.academicStatus || 'Studying',
        currentYear: education.currentYear ? Number(education.currentYear) : null,
        admissionYear: education.admissionYear ? Number(education.admissionYear) : null,
        expectedGraduationYear: education.expectedGraduationYear ? Number(education.expectedGraduationYear) : null,
        passoutYear: education.passoutYear ? Number(education.passoutYear) : null,
        location: education.location || null,
        collegeEmail: education.collegeEmail || null,
        portfolioUrl: education.portfolioUrl || null,
        githubUrl: education.githubUrl || null,
        linkedinUrl: education.linkedinUrl || null,
        websiteUrl: education.websiteUrl || null,
      };

      const res = await fetch('/api/profile/education', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save education information');
      }

      setSaveSuccess('Academic information saved successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
      loadProfile();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save education details.');
    } finally {
      setSaving(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save preferences');

      setSaveSuccess('Preferences updated successfully!');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  // Save Privacy
  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/profile/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(privacy),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update privacy settings');

      setSaveSuccess('Privacy settings saved.');
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save privacy settings.');
    } finally {
      setSaving(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setSaveError('New passwords do not match');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setSaveSuccess('Password successfully updated!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  // Delete Account
  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch('/api/profile/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          confirmationText: deleteConfirmation,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete account');
      }

      alert('Your account has been deleted. Redirecting to login.');
      router.push('/login');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  // Tag Helpers
  const addTag = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    val: string,
    setVal: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const clean = val.trim();
    if (clean && !list.includes(clean)) {
      setList([...list, clean]);
      setVal('');
    }
  };

  const removeTag = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    tagToRemove: string
  ) => {
    setList(list.filter((t) => t !== tagToRemove));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-[var(--muted)]">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[var(--amber)] border-t-transparent rounded-full animate-spin" />
          <span>Loading operator profile data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-xs pb-16">
      {/* Page Heading */}
      <div>
        <div className="brand text-[10px] sm:text-xs">USER IDENTITY & COLLABORATION</div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] mt-0.5">
          Operator Profile & Account Management
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Manage your personal details, academic background, engineering domains, and account security.
        </p>
      </div>

      {/* Global Alerts */}
      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}
      {saveError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Profile Header Hero Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--panel)] border border-[var(--line)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start sm:items-center gap-4">
          {/* Avatar with Camera Action */}
          <div className="relative group shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--bg)] border-2 border-[var(--line)] overflow-hidden flex items-center justify-center shadow-inner">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--muted)]" />
              )}
            </div>

            <label
              title="Upload new profile picture"
              className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-xl bg-[var(--amber)] text-black hover:bg-amber-400 cursor-pointer shadow-md transition-transform active:scale-95 flex items-center justify-center"
            >
              <Camera className="w-3.5 h-3.5" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>

            {user?.avatarUrl && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                title="Remove profile picture"
                className="absolute -top-1.5 -right-1.5 p-1 rounded-lg bg-red-500 text-white hover:bg-red-600 shadow-xs"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Identity details */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text)]">
                {profile.displayName || user?.name || 'Operator'}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/30 font-semibold">
                @{user?.username}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)]">
                {user?.role === 'ADMIN' ? 'OPERATOR MAIN' : 'OPERATOR'}
              </span>
            </div>

            <p className="text-xs text-[var(--muted)] line-clamp-1">
              {profile.occupation || 'Hardware Specialist'}
              {profile.organization ? ` @ ${profile.organization}` : ''}
              {education.institutionName ? ` · ${education.institutionName}` : ''}
            </p>

            <div className="flex items-center gap-3 text-[11px] text-[var(--muted)] pt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {user?.email}
              </span>
              {calculatedAge !== null && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {calculatedAge} yrs old
                </span>
              )}
              {profile.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {profile.city}
                  {profile.country ? `, ${profile.country}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile Completion Bar */}
        <div className="w-full md:w-64 p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)] shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--amber)]" />
              Profile Completion
            </span>
            <span className="font-mono font-bold text-[var(--amber)]">{completion.percentage}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-[var(--panel)] overflow-hidden">
            <div
              className="h-full bg-[var(--amber)] transition-all duration-300 rounded-full"
              style={{ width: `${completion.percentage}%` }}
            />
          </div>

          {completion.missingSuggestions.length > 0 && (
            <p className="text-[10px] text-[var(--muted)] line-clamp-1">
              Tip: {completion.missingSuggestions[0]}
            </p>
          )}
        </div>
      </div>

      {/* Tabs Navigation (Responsive Horizontal Scroll) */}
      <div className="flex border-b border-[var(--line)] gap-1 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('personal')}
          className={`px-3 py-2 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'personal'
              ? 'bg-[var(--panel)] text-[var(--amber)] border-t border-x border-[var(--line)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Personal Info
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('education')}
          className={`px-3 py-2 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'education'
              ? 'bg-[var(--panel)] text-[var(--amber)] border-t border-x border-[var(--line)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          Academic & Education
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('professional')}
          className={`px-3 py-2 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'professional'
              ? 'bg-[var(--panel)] text-[var(--amber)] border-t border-x border-[var(--line)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Professional & Skills
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`px-3 py-2 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'preferences'
              ? 'bg-[var(--panel)] text-[var(--amber)] border-t border-x border-[var(--line)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          App Preferences
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          className={`px-3 py-2 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'privacy'
              ? 'bg-[var(--panel)] text-[var(--amber)] border-t border-x border-[var(--line)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Privacy Controls
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-3 py-2 rounded-t-lg font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'security'
              ? 'bg-[var(--panel)] text-[var(--amber)] border-t border-x border-[var(--line)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--text)]'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          Account Security
        </button>
      </div>

      {/* TAB 1: PERSONAL INFORMATION */}
      {activeTab === 'personal' && (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <User className="w-4 h-4 text-[var(--amber)]" />
              Personal & Contact Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={user?.name || ''}
                  onChange={(e) => setUser((u) => (u ? { ...u, name: e.target.value } : null))}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Display Name (Nickname / Peer Handle)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tony Stark"
                  value={profile.displayName || ''}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={user?.username || ''}
                  onChange={(e) => setUser((u) => (u ? { ...u, username: e.target.value.toLowerCase() } : null))}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Primary Email (Account Identity)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full px-3 py-2 bg-[var(--bg)]/50 border border-[var(--line)] rounded-lg text-xs text-[var(--muted)] cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailChange(!showEmailChange)}
                    className="px-2.5 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--amber)] text-[10px] font-semibold whitespace-nowrap"
                  >
                    Change
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={profile.mobile || ''}
                  onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Date of Birth (Optional)
                </label>
                <input
                  type="date"
                  value={profile.dob ? profile.dob.split('T')[0] : ''}
                  onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
                {calculatedAge !== null && (
                  <span className="text-[10px] text-[var(--amber)] mt-1 block">
                    Calculated age: {calculatedAge} years
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Gender (Self-Described / Optional)
                </label>
                <select
                  value={profile.gender || ''}
                  onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Self-Described">Self-Described</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Country
                </label>
                <input
                  type="text"
                  placeholder="e.g. India"
                  value={profile.country || ''}
                  onChange={(e) => setProfile({ ...profile, country: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bengaluru, Chennai, Mumbai"
                  value={profile.city || ''}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>
            </div>

            {/* Email change sub-form */}
            {showEmailChange && (
              <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--amber)]/30 space-y-2">
                <div className="font-semibold text-xs text-[var(--amber)]">Request Email Address Change</div>
                <p className="text-[11px] text-[var(--muted)]">
                  Enter your new email address. A genuine verification token will be generated.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="new.email@example.com"
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setEmailMsg(null);
                      try {
                        const res = await fetch('/api/profile/request-email-change', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ newEmail: newEmailInput }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setEmailMsg(`Token generated: ${data.token}. Use the box below to verify.`);
                          setVerificationTokenInput(data.token);
                        } else {
                          setEmailMsg(`Error: ${data.error}`);
                        }
                      } catch {
                        setEmailMsg('Network error requesting email change.');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--amber)] text-black font-semibold text-xs"
                  >
                    Request Token
                  </button>
                </div>

                {verificationTokenInput && (
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Paste verification token"
                      value={verificationTokenInput}
                      onChange={(e) => setVerificationTokenInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)]"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/profile/verify-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token: verificationTokenInput }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert('Email successfully updated!');
                            setShowEmailChange(false);
                            loadProfile();
                          } else {
                            alert(data.error);
                          }
                        } catch {
                          alert('Failed to verify token');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                    >
                      Confirm Change
                    </button>
                  </div>
                )}

                {emailMsg && <div className="text-[11px] text-[var(--amber)]">{emailMsg}</div>}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                Short Bio / Engineering Focus
              </label>
              <textarea
                rows={3}
                placeholder="Share your focus in embedded engineering, robotics, or hardware design..."
                value={profile.bio || ''}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden resize-none"
              />
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--line)]">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[var(--amber)] text-black font-bold text-xs hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Personal Info'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: EDUCATION & ACADEMIC */}
      {activeTab === 'education' && (
        <form onSubmit={handleSaveEducation} className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[var(--amber)]" />
              Academic & Higher Education Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  College / University Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Indian Institute of Technology, Madras / Anna University"
                  value={education.institutionName || ''}
                  onChange={(e) => setEducation({ ...education, institutionName: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Department
                </label>
                <input
                  type="text"
                  placeholder="e.g. Electrical & Electronics Engineering"
                  value={education.department || ''}
                  onChange={(e) => setEducation({ ...education, department: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Degree / Qualification
                </label>
                <input
                  type="text"
                  placeholder="e.g. B.Tech, B.E., M.S., Diploma"
                  value={education.degree || ''}
                  onChange={(e) => setEducation({ ...education, degree: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Specialization / Branch
                </label>
                <input
                  type="text"
                  placeholder="e.g. Embedded Systems & Robotics"
                  value={education.specialization || ''}
                  onChange={(e) => setEducation({ ...education, specialization: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Academic Status
                </label>
                <select
                  value={education.academicStatus || 'Studying'}
                  onChange={(e: any) => setEducation({ ...education, academicStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                >
                  <option value="Studying">Currently Studying</option>
                  <option value="Graduated">Graduated / Passed Out</option>
                  <option value="Postgraduate">Postgraduate Scholar</option>
                  <option value="Other">Other / Independent</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Admission Year
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2022"
                  value={education.admissionYear || ''}
                  onChange={(e) =>
                    setEducation({ ...education, admissionYear: parseInt(e.target.value, 10) || null })
                  }
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Expected Graduation Year / Passout Year
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2026"
                  value={education.expectedGraduationYear || education.passoutYear || ''}
                  onChange={(e) => {
                    const yr = parseInt(e.target.value, 10) || null;
                    setEducation({
                      ...education,
                      expectedGraduationYear: yr,
                      passoutYear: yr,
                    });
                  }}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  College Institutional Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="rollno@college.edu.in"
                  value={education.collegeEmail || ''}
                  onChange={(e) => setEducation({ ...education, collegeEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--line)]">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[var(--amber)] text-black font-bold text-xs hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Education Details'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: PROFESSIONAL & TECHNICAL */}
      {activeTab === 'professional' && (
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[var(--amber)]" />
              Professional Career & Engineering Interests
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Professional Title / Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Embedded Firmware Engineer"
                  value={profile.occupation || ''}
                  onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Company / Organization / Lab
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stark Industries / Robotics Club"
                  value={profile.organization || ''}
                  onChange={(e) => setProfile({ ...profile, organization: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Years of Experience
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 2.5"
                  value={profile.experienceYears ?? ''}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      experienceYears: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  GitHub Profile URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/username"
                  value={profile.githubUrl || ''}
                  onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={profile.linkedinUrl || ''}
                  onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Portfolio / Personal Website
                </label>
                <input
                  type="url"
                  placeholder="https://yourportfolio.dev"
                  value={profile.portfolioUrl || ''}
                  onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
                />
              </div>
            </div>

            {/* Interactive Tags for Technical Skills */}
            <div className="space-y-3 pt-2 border-t border-[var(--line)]">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Technical & Hardware Skills
                </label>
                <div className="flex gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. KiCad, Circuit Simulation, Oscilloscopes, SMD Soldering"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(skillTags, setSkillTags, newSkill, setNewSkill);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(skillTags, setSkillTags, newSkill, setNewSkill)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/30 font-semibold"
                  >
                    + Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skillTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-md bg-[var(--bg)] border border-[var(--line)] text-[11px] font-medium text-[var(--text)] flex items-center gap-1.5"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(skillTags, setSkillTags, tag)}
                        className="hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Programming Languages
                </label>
                <div className="flex gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. C++, Embedded C, Python, Rust"
                    value={newProgLang}
                    onChange={(e) => setNewProgLang(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(progLangTags, setProgLangTags, newProgLang, setNewProgLang);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(progLangTags, setProgLangTags, newProgLang, setNewProgLang)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/30 font-semibold"
                  >
                    + Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {progLangTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-md bg-[var(--bg)] border border-[var(--line)] text-[11px] font-mono font-medium text-[var(--text)] flex items-center gap-1.5"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(progLangTags, setProgLangTags, tag)}
                        className="hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Hardware & Electronics Focus Areas
                </label>
                <div className="flex gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. Microcontrollers, Power Electronics, RF/Wireless, Motor Drivers"
                    value={newHwInterest}
                    onChange={(e) => setNewHwInterest(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(hwInterestTags, setHwInterestTags, newHwInterest, setNewHwInterest);
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                  />
                  <button
                    type="button"
                    onClick={() => addTag(hwInterestTags, setHwInterestTags, newHwInterest, setNewHwInterest)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/30 font-semibold"
                  >
                    + Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {hwInterestTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-md bg-[var(--bg)] border border-[var(--line)] text-[11px] font-medium text-[var(--text)] flex items-center gap-1.5"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(hwInterestTags, setHwInterestTags, tag)}
                        className="hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--line)]">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[var(--amber)] text-black font-bold text-xs hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Technical Details'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: APP PREFERENCES */}
      {activeTab === 'preferences' && (
        <form onSubmit={handleSavePreferences} className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--amber)]" />
              Component Logger Preferences
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Default Currency
                </label>
                <select
                  value={preferences.defaultCurrency}
                  onChange={(e) => setPreferences({ ...preferences, defaultCurrency: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                >
                  <option value="INR">INR (₹) - Indian Rupee</option>
                  <option value="USD">USD ($) - US Dollar</option>
                  <option value="EUR">EUR (€) - Euro</option>
                  <option value="GBP">GBP (£) - British Pound</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Default Measurement Unit
                </label>
                <input
                  type="text"
                  value={preferences.defaultUnit}
                  onChange={(e) => setPreferences({ ...preferences, defaultUnit: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Date Format
                </label>
                <select
                  value={preferences.dateFormat}
                  onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (Standard)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Default Inventory View
                </label>
                <select
                  value={preferences.defaultInventoryView}
                  onChange={(e) => setPreferences({ ...preferences, defaultInventoryView: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                >
                  <option value="table">Table View (Dense Information)</option>
                  <option value="cards">Card Grid (Visual Cards)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Color Theme
                </label>
                <select
                  value={preferences.theme}
                  onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                >
                  <option value="dark">Stark Dark (Industrial)</option>
                  <option value="light">High-Contrast Light</option>
                  <option value="system">System Synchronized</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--line)] space-y-2.5">
              <h4 className="font-semibold text-xs text-[var(--text)]">Notification Alerts</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                  <input
                    type="checkbox"
                    checked={preferences.notifyProjectInvites}
                    onChange={(e) =>
                      setPreferences({ ...preferences, notifyProjectInvites: e.target.checked })
                    }
                    className="accent-[var(--amber)]"
                  />
                  <span>Project BOM invitations & collaborative updates</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-[var(--bg)] border border-[var(--line)]">
                  <input
                    type="checkbox"
                    checked={preferences.notifyReturnReminders}
                    onChange={(e) =>
                      setPreferences({ ...preferences, notifyReturnReminders: e.target.checked })
                    }
                    className="accent-[var(--amber)]"
                  />
                  <span>Custody & expected loan return date reminders</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--line)]">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[var(--amber)] text-black font-bold text-xs hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 5: PRIVACY CONTROLS */}
      {activeTab === 'privacy' && (
        <form onSubmit={handleSavePrivacy} className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--amber)]" />
              Field-Level Privacy & Visibility Controls
            </h3>

            <div className="p-3 rounded-lg bg-[var(--bg)] border-l-2 border-[var(--amber)] text-[11px] text-[var(--muted)] space-y-1">
              <div className="font-semibold text-[var(--text)] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[var(--amber)]" />
                Stark Zero-Leakage Privacy Policy
              </div>
              <p>
                Your personal inventory, purchase costs, private notes, email address, mobile number, date of birth,
                and precise address are <strong>ALWAYS STRICTLY PRIVATE</strong> and are never exposed to other users or search endpoints under any circumstances.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Profile Card Visibility
                </label>
                <select
                  value={privacy.profileVisibility}
                  onChange={(e) => setPrivacy({ ...privacy, profileVisibility: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                >
                  <option value="friends">Accepted Friends & Project Collaborators</option>
                  <option value="public">Exact Username Match Search</option>
                  <option value="private">Private (Hidden from discovery)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Profile Picture Visibility
                </label>
                <select
                  value={privacy.showAvatarTo}
                  onChange={(e) => setPrivacy({ ...privacy, showAvatarTo: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                >
                  <option value="friends">Accepted Friends Only</option>
                  <option value="public">Public to Collaborators</option>
                  <option value="private">Private (Show default avatar)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Education Background Visibility
                </label>
                <select
                  value={privacy.showEducationTo}
                  onChange={(e) => setPrivacy({ ...privacy, showEducationTo: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                >
                  <option value="friends">Accepted Friends</option>
                  <option value="public">Visible in Project Collaborations</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                  Skills & Technical Domains Visibility
                </label>
                <select
                  value={privacy.showSkillsTo}
                  onChange={(e) => setPrivacy({ ...privacy, showSkillsTo: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                >
                  <option value="friends">Accepted Friends</option>
                  <option value="public">Visible in Project Collaborations</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--line)]">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[var(--amber)] text-black font-bold text-xs hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Privacy Settings'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 6: ACCOUNT SECURITY */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          {/* Change Password Form */}
          <form onSubmit={handleChangePassword}>
            <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
                <Key className="w-4 h-4 text-[var(--amber)]" />
                Change Password
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                    Current Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                    New Password * (Min 8 characters)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passwordForm.confirmNewPassword}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-[var(--line)]">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-[var(--amber)] text-black font-bold text-xs hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Key className="w-4 h-4" />
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </div>
          </form>

          {/* Account Details & Danger Zone */}
          <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--muted)]" />
              Session & Account Metadata
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
                <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">Account Created</span>
                <div className="font-mono text-[var(--text)] font-semibold">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--line)] space-y-1">
                <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">Session Status</span>
                <div className="font-mono text-emerald-400 font-semibold flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Active Secure JWT Session
                </div>
              </div>
            </div>

            {/* Danger Zone: Account Deletion */}
            <div className="pt-3 border-t border-red-500/20">
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs text-red-400">Permanently Delete Account</div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5">
                    Irreversibly deletes your account, personal components, and loan records.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors shrink-0"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md p-5 rounded-2xl bg-[var(--panel)] border border-red-500/40 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                Confirm Account Deletion
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 rounded text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-[var(--muted)]">
              This action <strong>cannot be undone</strong>. Your personal inventory, custody records, and account
              credentials will be permanently purged.
            </p>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px]">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleConfirmDeleteAccount} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase mb-1">
                  Confirm Current Password *
                </label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase mb-1">
                  Type <span className="font-mono text-red-400">DELETE {user?.username}</span> to confirm *
                </label>
                <input
                  type="text"
                  required
                  placeholder={`DELETE ${user?.username}`}
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--line)] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
