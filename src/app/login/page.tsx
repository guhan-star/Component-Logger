'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Mail, ArrowRight, AlertCircle, Check, KeyRound } from 'lucide-react';
import { Modal } from '@/components/ui/modal';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get('next');
  const nextUrl =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('/login') && !rawNext.startsWith('/register')
      ? rawNext
      : '/components';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forgot Password Modal State
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCurrentPassword, setForgotCurrentPassword] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      // Successful login
      router.push(nextUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to connect to authentication terminal.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);

    if (!forgotCurrentPassword) {
      setForgotError('Current password or recovery token is required.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }

    if (forgotNewPassword.length < 8 || !/[A-Za-z]/.test(forgotNewPassword) || !/[0-9]/.test(forgotNewPassword)) {
      setForgotError('Password must be at least 8 characters long and contain both letters and numbers.');
      return;
    }

    setForgotLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          currentPassword: forgotCurrentPassword,
          newPassword: forgotNewPassword,
          confirmPassword: forgotConfirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update password.');
      }

      setIsForgotOpen(false);
      setIdentifier(forgotEmail);
      setSuccessMsg(data.message || 'Password successfully updated! You can now sign in.');
      setForgotEmail('');
      setForgotCurrentPassword('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 select-none">
      <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--line)] rounded-lg shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Brand & Security Header */}
        <div className="text-center space-y-1.5 border-b border-[var(--line)] pb-5">
          <div className="flex items-center justify-center gap-2">
            <span className="brand font-bold tracking-wider text-xs text-[var(--amber)]">
              STARK INDUSTRIES WMC
            </span>
            <span className="text-[var(--line)]">|</span>
            <span className="text-[10px] font-mono text-[var(--muted)]">CONTROL TERMINAL</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Warehouse Management &amp; Control
          </h1>
          <p className="text-xs text-[var(--muted)]">
            Sign in to manage your inventory and collaborative projects.
          </p>
        </div>

        {/* Redirect Notice if coming from a protected feature */}
        {rawNext && rawNext !== '/components' && rawNext !== '/' && (
          <div className="p-3 rounded bg-[var(--amber)]/10 border border-[var(--amber)]/40 text-xs text-[var(--amber)] flex items-center gap-2">
            <span className="font-bold font-mono uppercase text-[10px] bg-[var(--amber)] text-black px-1.5 py-0.5 rounded">
              Account Required
            </span>
            <span>
              Unique usernames, friends, and project teams (up to 6 members) require an account. Sign in or register below.
            </span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded bg-[var(--red)]/10 border border-[var(--red)] text-xs text-[var(--text)]">
            <AlertCircle className="w-4 h-4 text-[var(--red)] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Email or Username *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                required
                autoFocus
                placeholder="Enter your email ID or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                Security Key / Password *
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(identifier);
                  setForgotError(null);
                  setIsForgotOpen(true);
                }}
                className="text-[10px] text-[var(--amber)] hover:underline font-medium"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                type="password"
                required
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to WMC</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Registration Link */}
        <div className="text-center pt-2 border-t border-[var(--line)] text-xs text-[var(--muted)]">
          Need an account?{' '}
          <Link href="/register" className="text-[var(--amber)] hover:underline font-medium">
            Register here
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        title="Reset Password / Security Key"
        description="Verify your registered email address and choose a new password."
      >
        <form onSubmit={handleResetPassword} className="space-y-4 text-xs mt-2">
          {forgotError && (
            <div className="flex items-start gap-2 p-2.5 rounded bg-[var(--red)]/10 border border-[var(--red)] text-xs text-[var(--text)]">
              <AlertCircle className="w-4 h-4 text-[var(--red)] shrink-0 mt-0.5" />
              <span>{forgotError}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Registered Email Address *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <input
                type="email"
                required
                placeholder="e.g. operator@stark.wmc"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--amber)] font-semibold mb-1">
              Current Password or Recovery Token *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <KeyRound className="w-3.5 h-3.5" />
              </span>
              <input
                type="password"
                required
                placeholder="Enter current password or admin token"
                value={forgotCurrentPassword}
                onChange={(e) => setForgotCurrentPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
            <p className="text-[10px] text-[var(--muted)] mt-1">
              Forgot both password and recovery token? Contact your warehouse administrator.
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              New Password * (Min 8 chars with letter &amp; number)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                type="password"
                required
                placeholder="Enter new strong password"
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <KeyRound className="w-3.5 h-3.5" />
              </span>
              <input
                type="password"
                required
                placeholder="Confirm new password"
                value={forgotConfirmPassword}
                onChange={(e) => setForgotConfirmPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => setIsForgotOpen(false)}
              className="px-3.5 py-2 rounded bg-[var(--panel2)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={forgotLoading}
              className="px-4 py-2 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] disabled:opacity-50 transition-colors"
            >
              {forgotLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--muted)] font-mono">Loading authentication interface...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
