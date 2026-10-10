'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await forgotPassword(email.trim());
      setSent(result.message);
      // Outside production the API returns the token because no mailer is wired.
      setDevToken(result.resetToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process that request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen items-center justify-center p-space-md">
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest border border-surface-container p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold font-label-mono-sm">
            CR
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">Reset your password</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              We will send a single-use link that expires in 30 minutes.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg bg-tertiary-container/15 text-on-surface p-3">
              <span className="material-symbols-outlined text-tertiary text-[20px]">mark_email_read</span>
              <p className="font-body-sm text-body-sm">{sent}</p>
            </div>

            {devToken && (
              <div className="rounded-lg bg-surface-container-low p-3 flex flex-col gap-1">
                <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">
                  Development only
                </span>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  No mail provider is configured, so the token is shown here. In production it is emailed and never
                  returned by the API.
                </p>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(devToken)}`}
                  className="mt-1 h-10 rounded-lg bg-primary text-on-primary font-headline-sm text-[14px] flex items-center justify-center"
                >
                  Continue to reset
                </Link>
              </div>
            )}

            <Link href="/login" className="font-body-sm text-body-sm text-primary hover:underline text-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-error-container text-on-error-container p-3">
                <span className="material-symbols-outlined text-[20px] text-error">error</span>
                <p className="font-body-sm text-body-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
                Account email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.includes('@')}
              className="h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
              {loading ? 'Sending…' : 'Send reset link'}
            </button>

            <Link href="/login" className="font-body-sm text-body-sm text-primary hover:underline text-center">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
