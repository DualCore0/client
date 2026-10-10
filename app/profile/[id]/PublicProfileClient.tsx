'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDate, getPublicProfile, initialsOf, percent, type PublicProfile } from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState, StatCard } from '@/components/States';

export default function PublicProfileClient({ userId }: { userId: string }) {
  const router = useRouter();
  const { user, ready } = useRequireAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await getPublicProfile(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <LoadingState label="Loading profile…" />
      </div>
    );
  }

  const isSelf = user?.id === userId;

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar
        title={isSelf ? 'My profile' : 'Student profile'}
        subtitle={profile?.primaryRoom ? `#${profile.primaryRoom.code}` : undefined}
        backHref={isSelf ? '/profile' : '/leaderboard'}
      />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        {error && <ErrorState message={error} onRetry={load} title="Profile unavailable" />}

        {!error && profile && (
          <>
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex items-center gap-4">
              <span className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-md text-headline-md shrink-0">
                {initialsOf(profile.name)}
              </span>
              <div className="min-w-0">
                <h2 className="font-headline-md text-headline-md text-on-surface truncate">{profile.name}</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {profile.primaryRoom ? profile.primaryRoom.name : 'No room activity yet'}
                </p>
                <p className="font-label-mono-sm text-label-mono-sm text-secondary mt-0.5">
                  joined {formatDate(profile.joinedAt)}
                </p>
              </div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Tests" value={profile.stats.testsCompleted} icon="task_alt" tone="primary" />
              <StatCard
                label="Average"
                value={profile.stats.averagePercentage === null ? '—' : percent(profile.stats.averagePercentage, 0)}
                icon="trending_up"
              />
              <StatCard
                label="Accuracy"
                value={profile.stats.accuracy === null ? '—' : percent(profile.stats.accuracy, 0)}
                icon="target"
              />
              <StatCard
                label="Best"
                value={profile.stats.highPercentage === null ? '—' : percent(profile.stats.highPercentage, 0)}
                icon="workspace_premium"
                tone="tertiary"
              />
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Recent tests</h3>
              {profile.recentTests.length === 0 ? (
                <EmptyState
                  icon="history"
                  title="No completed tests"
                  description="Results appear here after the first submission."
                />
              ) : (
                profile.recentTests.map((entry) => {
                  const passed = (entry.percentage ?? 0) >= 40;
                  return (
                    <div
                      key={entry.submissionId}
                      className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex items-center gap-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-label-mono-sm text-label-mono-sm text-secondary">
                          {formatDate(entry.submittedAt)} {entry.room ? `• ${entry.room}` : ''}
                        </span>
                        <span className="block font-body-md text-body-md text-on-surface truncate">
                          {entry.title}
                        </span>
                        {entry.topic && (
                          <span className="block font-body-sm text-[12px] text-on-surface-variant">{entry.topic}</span>
                        )}
                      </span>
                      <span
                        className={`font-stat-mono-lg text-[18px] shrink-0 ${passed ? 'text-tertiary' : 'text-error'}`}
                      >
                        {entry.percentage === null ? '—' : percent(entry.percentage, 0)}
                      </span>
                    </div>
                  );
                })
              )}
            </section>

            {!isSelf && (
              <button
                type="button"
                onClick={() => router.push('/leaderboard')}
                className="h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[14px] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">leaderboard</span>
                Back to the leaderboard
              </button>
            )}

            {isSelf && (
              <Link
                href="/profile"
                className="h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[14px] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">account_circle</span>
                Account settings
              </Link>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
