'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request password reset.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
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
            <span className="text-[10px] font-mono text-[var(--muted)]">RECOVERY</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Reset Account Password
          </h1>
          <p className="text-xs text-[var(--muted)]">
            Enter your registered email address to receive secure recovery instructions.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text)]">Recovery Instructions Dispatched</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                If an active account exists for <span className="font-mono text-[var(--text)]">{email}</span>, a secure reset link has been dispatched to your inbox.
              </p>
              <p className="text-[11px] text-[var(--muted)] pt-2">
                The link is valid for <strong>1 hour</strong> and can only be consumed once.
              </p>
            </div>

            <div className="pt-4 border-t border-[var(--line)]">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--amber)] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                Account Email *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                  <Mail className="w-3.5 h-3.5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="operator@stark.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono text-sm"
                />
              </div>
              <p className="text-[10px] text-[var(--muted)] mt-1.5">
                We will send a single-use token link to verify identity.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 rounded font-bold text-xs uppercase tracking-wider bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              {loading ? 'Transmitting...' : 'Send Recovery Link'}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
