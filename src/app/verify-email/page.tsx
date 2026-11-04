'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw, Send } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [verifying, setVerifying] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Resend form
  const [resendEmail, setResendEmail] = useState(emailParam);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setSuccess(true);
          setStatusMessage(data.message || 'Your email address has been successfully verified.');
        } else {
          setSuccess(false);
          setErrorCode(data.code || 'ERROR');
          setStatusMessage(data.error || 'Failed to verify email.');
        }
      })
      .catch(() => {
        setSuccess(false);
        setStatusMessage('Network error communicating with verification service.');
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setResendLoading(true);
    setResendMessage(null);

    try {
      const res = await fetch('/api/auth/verify-email/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });

      const data = await res.json();
      setResendMessage(data.message || 'Verification link dispatched. Please check your inbox.');
    } catch {
      setResendMessage('Failed to transmit verification request. Please try again.');
    } finally {
      setResendLoading(false);
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
            <span className="text-[10px] font-mono text-[var(--muted)]">CREDENTIALS</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Email Verification
          </h1>
          <p className="text-xs text-[var(--muted)]">
            Confirm your account email address to secure your profile and projects.
          </p>
        </div>

        {verifying ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-6 h-6 border-2 border-[var(--amber)] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[var(--muted)] font-mono">Validating cryptographic token...</p>
          </div>
        ) : success ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">Email Address Verified</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {statusMessage || 'Your account credentials have been verified. You can now access full platform capabilities.'}
              </p>
            </div>
            <div className="pt-4 border-t border-[var(--line)] flex gap-2">
              <Link
                href="/components"
                className="flex-1 py-2.5 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] transition-colors block text-center"
              >
                Go to Inventory
              </Link>
              <Link
                href="/profile"
                className="flex-1 py-2.5 rounded font-bold text-xs uppercase tracking-wider bg-[var(--panel2)] border border-[var(--line)] text-[var(--text)] hover:border-[var(--amber)] transition-colors block text-center"
              >
                View Profile
              </Link>
            </div>
          </div>
        ) : token ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">
                {errorCode === 'TOKEN_ALREADY_USED'
                  ? 'Verification Link Already Used'
                  : errorCode === 'TOKEN_EXPIRED'
                  ? 'Verification Link Expired'
                  : 'Invalid Verification Link'}
              </h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                {statusMessage}
              </p>
            </div>

            <div className="pt-4 border-t border-[var(--line)] text-left">
              <h4 className="text-xs font-semibold text-[var(--text)] mb-2">Request a New Verification Link</h4>
              <form onSubmit={handleResend} className="space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="account@stark.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] text-xs font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resendLoading || !resendEmail.trim()}
                  className="w-full py-2 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {resendLoading ? 'Transmitting...' : 'Send Verification Email'}
                </button>
              </form>
              {resendMessage && (
                <p className="text-[11px] text-[var(--amber)] pt-2">{resendMessage}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              If your email has not been verified yet, enter your email below to receive a fresh verification link.
            </p>
            <form onSubmit={handleResend} className="space-y-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                  <Mail className="w-3.5 h-3.5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="account@stark.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={resendLoading || !resendEmail.trim()}
                className="w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                {resendLoading ? 'Transmitting...' : 'Dispatch Verification Link'}
              </button>
            </form>
            {resendMessage && (
              <p className="text-xs text-[var(--amber)] p-2 bg-[var(--panel2)] rounded border border-[var(--line)]">
                {resendMessage}
              </p>
            )}
            <div className="pt-4 border-t border-[var(--line)] text-center">
              <Link
                href="/login"
                className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-[var(--muted)] font-mono">Loading verification module...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
