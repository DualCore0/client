'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPassword, validatePassword, PASSWORD_MIN_LENGTH } from '@/lib/api';
import { LoadingState } from '@/components/States';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const policy = validatePassword(password);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Paste the reset token from your email.');
      return;
    }
    if (!policy.ok) {
      setError(`Password does not meet the security policy: ${policy.errors.join(', ')}.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token: token.trim(), password });
      setDone(true);
      setTimeout(() => router.replace('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-md rounded-xl bg-surface-container-lowest border border-surface-container p-6 flex flex-col gap-3 text-center">
        <span className="material-symbols-outlined text-[40px] text-tertiary">check_circle</span>
        <h1 className="font-headline-md text-headline-md">Password updated</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Every other session was signed out for your security. Redirecting you to sign in…
        </p>
        <Link href="/login" className="font-body-sm text-body-sm text-primary hover:underline">
          Go to sign in now
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-md rounded-xl bg-surface-container-lowest border border-surface-container p-6 flex flex-col gap-4"
    >
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface">Choose a new password</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Minimum {PASSWORD_MIN_LENGTH} characters with upper case, lower case, a digit and a symbol.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-error-container text-on-error-container p-3">
          <span className="material-symbols-outlined text-[20px] text-error">error</span>
          <p className="font-body-sm text-body-sm">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="token" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
          Reset token
        </label>
        <input
          id="token"
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the token from your email"
          className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface font-label-mono-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label htmlFor="password" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {password.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {policy.ok ? (
              <li className="flex items-center gap-1.5 font-body-sm text-[12px] text-tertiary">
                <span className="material-symbols-outlined text-[14px]">verified_user</span>
                Meets the password policy
              </li>
            ) : (
              policy.errors.map((issue) => (
                <li key={issue} className="flex items-center gap-1.5 font-body-sm text-[12px] text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px] text-error">cancel</span>
                  {issue}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div>
        <label htmlFor="confirm" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
          Confirm password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
        {loading ? 'Updating…' : 'Set new password'}
      </button>

      <Link href="/login" className="font-body-sm text-body-sm text-primary hover:underline text-center">
        Back to sign in
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col w-full min-h-screen items-center justify-center p-space-md">
      <Suspense fallback={<LoadingState label="Loading…" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
