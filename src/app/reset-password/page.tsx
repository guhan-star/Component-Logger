'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, KeyRound, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      setTokenError('Missing recovery token. Please click the link in your email.');
      return;
    }

    // Validate token against backend
    fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
          setTokenError(data.error || 'This password reset link is invalid or has expired.');
        }
      })
      .catch(() => {
        setTokenValid(false);
        setTokenError('Failed to verify token with security service. Please try again.');
      })
      .finally(() => {
        setValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (newPassword !== confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password.');
      }

      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred while updating your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 select-none">
      <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--line)] rounded-lg shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1.5 border-b border-[var(--line)] pb-5">
          <div className="flex items-center justify-center gap-2">
            <span className="brand font-bold tracking-wider text-xs text-[var(--amber)]">
              STARK INDUSTRIES WMC
            </span>
            <span className="text-[var(--line)]">|</span>
            <span className="text-[10px] font-mono text-[var(--muted)]">SECURE RESET</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Create New Password
          </h1>
          <p className="text-xs text-[var(--muted)]">
            Set a new strong security key for your operator account.
          </p>
        </div>

        {validating ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-6 h-6 border-2 border-[var(--amber)] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[var(--muted)] font-mono">Verifying recovery cryptographic token...</p>
          </div>
        ) : isSuccess ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">Password Successfully Updated</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Your new password is now active. For security, all prior sessions on other devices have been revoked.
              </p>
            </div>
            <div className="pt-4 border-t border-[var(--line)]">
              <Link
                href="/login"
                className="w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] transition-colors block text-center"
              >
                Sign In With New Password
              </Link>
            </div>
          </div>
        ) : !tokenValid ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">Link Invalid or Expired</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {tokenError || 'This password reset link is invalid, expired, or has already been consumed.'}
              </p>
            </div>
            <div className="pt-4 border-t border-[var(--line)] space-y-2">
              <Link
                href="/forgot-password"
                className="w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider bg-[var(--panel2)] border border-[var(--line)] text-[var(--text)] hover:border-[var(--amber)] transition-colors block text-center"
              >
                Request New Reset Link
              </Link>
              <Link
                href="/login"
                className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors inline-flex items-center gap-1.5 pt-2"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {submitError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {emailParam && (
              <div className="text-xs text-[var(--muted)] font-mono pb-1">
                Account: <span className="text-[var(--text)] font-semibold">{emailParam}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                New Password *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="At least 8 characters (letters & numbers)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono text-sm"
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
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className="w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              {loading ? 'Securing Account...' : 'Update Password & Invalidate Sessions'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--muted)] font-mono">Loading recovery console...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
