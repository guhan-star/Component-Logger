'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
            Authorized operator authentication for electronic component inventory.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded bg-[var(--red)]/10 border border-[var(--red)] text-xs text-[var(--text)]">
            <AlertCircle className="w-4 h-4 text-[var(--red)] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Operator Email or Username *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                required
                autoFocus
                placeholder="operator@stark.wmc or operator"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Security Key / Password *
            </label>
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
      </div>
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
