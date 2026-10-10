'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSubmissions, getMe, getRooms, initialsOf, logoutAll, percent } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, LoadingState, StatCard } from '@/components/States';

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { ready } = useRequireAuth();
  const { user, signOut, refresh } = useAuth();

  const [stats, setStats] = useState<{ rooms: number; tests: number; average: number | null; best: number | null }>({
    rooms: 0,
    tests: 0,
    average: null,
    best: null,
  });
  const [loading, setLoading] = useState(true);
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rooms = await getRooms();
      if (user.role === 'STUDENT') {
        const submissions = await getSubmissions();
        const done = submissions.filter((s) => s.submittedAt);
        const scored = done.map((s) => s.percentage).filter((p): p is number => typeof p === 'number');
        setStats({
          rooms: rooms.length,
          tests: done.length,
          average: scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null,
          best: scored.length ? Math.max(...scored) : null,
        });
      } else {
        setStats({ rooms: rooms.length, tests: 0, average: null, best: null });
      }

      // Pull the freshest identity from the API (name may have changed elsewhere).
      await Promise.all([getMe(), refresh()]).catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [user, refresh]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const handleSignOut = () => {
    signOut();
    router.replace('/login');
  };

  /**
   * Revokes every session and invalidates all outstanding access tokens, so a
   * stolen token stops working immediately.
   */
  const handleSignOutEverywhere = async () => {
    setSigningOutEverywhere(true);
    try {
      const result = await logoutAll();
      toast.success(`Signed out of ${result.sessionsRevoked} session(s) on all devices.`);
      signOut();
      router.replace('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not sign out everywhere.');
      setSigningOutEverywhere(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar title="My profile" subtitle={user?.role === 'TEACHER' ? 'Teacher' : 'Student'} />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        {loading && <LoadingState label="Loading your profile…" />}

        {!loading && user && (
          <>
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex items-center gap-4">
              <span className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-md text-headline-md shrink-0">
                {initialsOf(user.fullname || user.email)}
              </span>
              <div className="min-w-0">
                <h2 className="font-headline-md text-headline-md text-on-surface truncate">
                  {user.fullname || 'Unnamed account'}
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{user.email}</p>
                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-mono-sm text-label-mono-sm uppercase">
                  <span className="material-symbols-outlined text-[13px]">
                    {user.role === 'TEACHER' ? 'co_present' : 'school'}
                  </span>
                  {user.role.toLowerCase()}
                </span>
              </div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Rooms" value={stats.rooms} icon="meeting_room" tone="primary" />
              {user.role === 'STUDENT' ? (
                <>
                  <StatCard label="Tests taken" value={stats.tests} icon="task_alt" />
                  <StatCard
                    label="Average"
                    value={stats.average === null ? '—' : percent(stats.average, 0)}
                    icon="trending_up"
                  />
                  <StatCard
                    label="Best"
                    value={stats.best === null ? '—' : percent(stats.best, 0)}
                    icon="workspace_premium"
                    tone="tertiary"
                  />
                </>
              ) : (
                <>
                  <StatCard label="Account" value="Teacher" icon="badge" />
                  <StatCard label="Member since" value={user.createdAt ? new Date(user.createdAt).getFullYear() : '—'} icon="calendar_today" />
                  <StatCard label="Status" value="Active" icon="verified" tone="tertiary" />
                </>
              )}
            </section>

            {user.role === 'STUDENT' && stats.tests === 0 && (
              <EmptyState
                icon="assignment"
                title="No completed tests yet"
                description="Once you submit a test your averages will appear here."
                action={
                  <Link
                    href="/tests"
                    className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
                  >
                    Find a test
                  </Link>
                }
              />
            )}

            <section className="flex flex-col gap-2">
              <Link
                href="/leaderboard"
                className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex items-center gap-3 hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-primary">leaderboard</span>
                <span className="flex-1 font-body-md text-body-md text-on-surface">Weekly global leaderboard</span>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </Link>
              <Link
                href="/rooms"
                className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex items-center gap-3 hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-primary">meeting_room</span>
                <span className="flex-1 font-body-md text-body-md text-on-surface">My rooms</span>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </Link>
            </section>

            {/* Security controls */}
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-3">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">shield_lock</span>
                Security
              </h3>

              <div className="flex flex-col gap-1 font-body-sm text-body-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-on-surface-variant">Account status</span>
                  <span className="inline-flex items-center gap-1 text-tertiary font-medium">
                    <span className="material-symbols-outlined text-[15px]">verified_user</span>
                    {(user.status ?? 'ACTIVE').toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-on-surface-variant">Email verified</span>
                  <span className={user.emailVerified ? 'text-tertiary' : 'text-on-surface-variant'}>
                    {user.emailVerified ? 'yes' : 'not yet'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-on-surface-variant">Access tokens</span>
                  <span className="text-on-surface-variant">short-lived, auto-renewed</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Link
                  href="/forgot-password"
                  className="flex-1 h-10 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[13px] flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">key</span>
                  Change password
                </Link>
                <button
                  type="button"
                  onClick={handleSignOutEverywhere}
                  disabled={signingOutEverywhere}
                  className="flex-1 h-10 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[13px] flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">devices_other</span>
                  {signingOutEverywhere ? 'Signing out…' : 'Sign out everywhere'}
                </button>
              </div>
            </section>

            <button
              type="button"
              onClick={handleSignOut}
              className="h-12 rounded-xl bg-error-container/50 text-on-error-container font-headline-sm text-headline-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Sign out
            </button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
