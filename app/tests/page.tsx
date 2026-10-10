'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  formatDate,
  getSubmissions,
  getTests,
  percent,
  type Submission,
  type TestSummary,
} from '@/lib/api';
import { useAuth, useRequireAuth } from '@/components/AuthProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState, StatusPill } from '@/components/States';

type Filter = 'all' | 'todo' | 'done';

export default function TestsPage() {
  const router = useRouter();
  const { user, ready } = useRequireAuth();
  const { signOut } = useAuth();

  const [tests, setTests] = useState<TestSummary[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [testList, subs] = await Promise.all([
        getTests(),
        user.role === 'STUDENT' ? getSubmissions() : Promise.resolve<Submission[]>([]),
      ]);
      setTests(testList);
      setSubmissions(subs);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('401')) signOut();
      setError(err instanceof Error ? err.message : 'Could not load tests.');
    } finally {
      setLoading(false);
    }
  }, [user, signOut]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const completedByTest = useMemo(() => {
    const map = new Map<string, Submission>();
    for (const s of submissions) {
      if (!s.submittedAt) continue;
      if (!map.has(s.testId)) map.set(s.testId, s);
    }
    return map;
  }, [submissions]);

  const pendingByTest = useMemo(() => {
    const map = new Map<string, Submission>();
    for (const s of submissions) {
      if (s.submittedAt) continue;
      map.set(s.testId, s);
    }
    return map;
  }, [submissions]);

  const visible = useMemo(() => {
    if (user?.role !== 'STUDENT') return tests;
    if (filter === 'todo') return tests.filter((t) => !completedByTest.has(t.id));
    if (filter === 'done') return tests.filter((t) => completedByTest.has(t.id));
    return tests;
  }, [tests, filter, completedByTest, user?.role]);

  const isTeacher = user?.role === 'TEACHER';

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar
        title="Assessments"
        subtitle={isTeacher ? 'Teacher' : 'Student'}
        action={
          isTeacher ? (
            <Link
              href="/tests/create"
              className="h-9 px-3 rounded-lg bg-primary text-on-primary font-headline-sm text-[13px] flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New test
            </Link>
          ) : undefined
        }
      />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        {!isTeacher && (
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { key: 'all', label: 'All', count: tests.length },
                { key: 'todo', label: 'To take', count: tests.length - completedByTest.size },
                { key: 'done', label: 'Completed', count: completedByTest.size },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  filter === tab.key
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-surface-container bg-surface-container-lowest hover:bg-surface-container-low'
                }`}
              >
                <span
                  className={`block font-label-mono-sm text-label-mono-sm uppercase ${
                    filter === tab.key ? 'text-primary' : 'text-secondary'
                  }`}
                >
                  {tab.label}
                </span>
                <span className="block font-stat-mono-lg text-stat-mono-lg text-on-surface">{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {loading && <LoadingState label="Loading assessments…" />}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && visible.length === 0 && (
          <EmptyState
            icon={isTeacher ? 'note_add' : 'assignment'}
            title={isTeacher ? 'No tests yet' : 'Nothing to take right now'}
            description={
              isTeacher
                ? 'Create a room, upload a PDF and let AI draft your first test.'
                : 'Join a room with a code, or check back once your teacher publishes a test.'
            }
            action={
              <Link
                href={isTeacher ? '/tests/create' : '/join'}
                className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
              >
                {isTeacher ? 'Create a test' : 'Join a room'}
              </Link>
            }
          />
        )}

        {!loading &&
          !error &&
          visible.map((test) => {
            const attempt = completedByTest.get(test.id);
            const pending = pendingByTest.get(test.id);
            const questionCount = test._count?.questions ?? test.questionCount ?? 0;

            if (isTeacher) {
              const attemptCount = test._count?.submissions ?? 0;
              return (
                <article
                  key={test.id}
                  className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusPill status={test.status} />
                        {test.room && (
                          <span className="font-label-mono-sm text-label-mono-sm text-secondary truncate">
                            {test.room.name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{test.title}</h3>
                      <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
                        {questionCount} question{questionCount === 1 ? '' : 's'}
                        {test.duration ? ` • ${test.duration} min` : ' • untimed'} • {attemptCount} attempt
                        {attemptCount === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="font-label-mono-sm text-label-mono-sm text-secondary shrink-0">
                      {formatDate(test.createdAt)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/tests/${test.id}/results`}
                      className="flex-1 h-10 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[13px] flex items-center justify-center gap-1.5 hover:bg-surface-container"
                    >
                      <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                      Results
                    </Link>
                    {test.room && (
                      <Link
                        href={`/rooms/${test.room.code}`}
                        className="flex-1 h-10 rounded-lg bg-primary text-on-primary font-headline-sm text-[13px] flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">meeting_room</span>
                        Open room
                      </Link>
                    )}
                  </div>
                </article>
              );
            }

            return (
              <article
                key={test.id}
                className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {attempt ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-container/15 text-tertiary font-label-mono-sm text-label-mono-sm uppercase">
                          <span className="material-symbols-outlined text-[13px]">check_circle</span> completed
                        </span>
                      ) : pending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-mono-sm text-label-mono-sm uppercase">
                          in progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-mono-sm text-label-mono-sm uppercase">
                          ready
                        </span>
                      )}
                      {test.room && (
                        <span className="font-label-mono-sm text-label-mono-sm text-secondary truncate">
                          {test.room.name}
                        </span>
                      )}
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{test.title}</h3>
                    <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
                      {questionCount} question{questionCount === 1 ? '' : 's'}
                      {test.duration ? ` • ${test.duration} min` : ' • untimed'}
                    </p>
                  </div>
                  {attempt && (
                    <div className="text-right shrink-0">
                      <span className="block font-stat-mono-lg text-[20px] text-primary leading-none">
                        {percent(attempt.percentage, 0)}
                      </span>
                      <span className="font-label-mono-sm text-[11px] text-secondary">
                        {attempt.score ?? 0}/{questionCount || '—'}
                      </span>
                    </div>
                  )}
                </div>

                {attempt ? (
                  <div className="flex gap-2">
                    <Link
                      href={`/tests/${test.id}/result`}
                      className="flex-1 h-10 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[13px] flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                      Review
                    </Link>
                    {test.room && (
                      <Link
                        href={`/rooms/${test.room.code}/leaderboard`}
                        className="flex-1 h-10 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[13px] flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">leaderboard</span>
                        Leaderboard
                      </Link>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push(`/tests/${test.id}`)}
                    className="w-full h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-[14px] flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                    {pending ? 'Resume attempt' : 'Start assessment'}
                  </button>
                )}
              </article>
            );
          })}
      </div>

      <BottomNav />
    </div>
  );
}
