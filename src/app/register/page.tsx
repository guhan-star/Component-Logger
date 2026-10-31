'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, User, Mail, Lock, ArrowRight, AlertCircle, Shield } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create account.');
      }

      router.push('/components');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Error communicating with registration service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 select-none">
      <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--line)] rounded-lg shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Brand & Title */}
        <div className="text-center space-y-1.5 border-b border-[var(--line)] pb-5">
          <div className="flex items-center justify-center gap-2">
            <span className="brand font-bold tracking-wider text-xs text-[var(--amber)]">
              STARK INDUSTRIES WMC
            </span>
            <span className="text-[var(--line)]">|</span>
            <span className="text-[10px] font-mono text-[var(--muted)]">NEW OPERATOR</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
            Create Operator Account
          </h1>
          <p className="text-xs text-[var(--muted)]">
            Register your operator credentials to manage personal and shared warehouse inventory.
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
              Full Name *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <User className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                required
                placeholder="e.g. Peter Parker"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Email Address *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <input
                type="email"
                required
                placeholder="e.g. operator@stark.warehouse"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Password *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                type="password"
                required
                placeholder="Minimum 4 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Confirm Password *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
                <Shield className="w-3.5 h-3.5" />
              </span>
              <input
                type="password"
                required
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              <span>Registering account...</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Login Link */}
        <div className="text-center pt-2 border-t border-[var(--line)] text-xs text-[var(--muted)]">
          Already registered?{' '}
          <Link href="/login" className="text-[var(--amber)] hover:underline font-medium">
            Sign in to existing account
          </Link>
        </div>
      </div>
    </div>
  );
}
