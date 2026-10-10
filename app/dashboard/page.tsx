'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  formatDate,
  getRooms,
  getSubmissions,
  getTests,
  percent,
  type Room,
  type Submission,
  type TestSummary,
} from '@/lib/api';
import { useAuth, useRequireAuth } from '@/components/AuthProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState, StatCard } from '@/components/States';

type View = 'upcoming' | 'completed';

export default function DashboardPage() {
  const router = useRouter();
  const { user, ready } = useRequireAuth();
  const { signOut } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('upcoming');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [roomList, testList, subs] = await Promise.all([
        getRooms(),
        getTests(),
        user.role === 'STUDENT' ? getSubmissions() : Promise.resolve<Submission[]>([]),
      ]);
      setRooms(roomList);
      setTests(testList);
      setSubmissions(subs);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('401')) signOut();
      setError(err instanceof Error ? err.message : 'Could not load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, [user, signOut]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const isTeacher = user?.role === 'TEACHER';

  const completed = useMemo(() => submissions.filter((s) => s.submittedAt), [submissions]);

  const averageScore = useMemo(() => {
    const scored = completed.map((s) => s.percentage).filter((p): p is number => typeof p === 'number');
    if (!scored.length) return null;
    return scored.reduce((a, b) => a + b, 0) / scored.length;
  }, [completed]);

  const completedTestIds = useMemo(() => new Set(completed.map((s) => s.testId)), [completed]);
  const studentTodo = useMemo(
    () => tests.filter((t) => !completedTestIds.has(t.id)),
    [tests, completedTestIds],
  );

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar
        title={`Welcome back${user?.fullname ? `, ${user.fullname.split(' ')[0]}` : ''}`}
        subtitle={isTeacher ? 'Teacher overview' : 'Student overview'}
      />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        {loading && <LoadingState label="Loading your dashboard…" />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && (
          <>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Rooms" value={rooms.length} icon="meeting_room" tone="primary" />
              {isTeacher ? (
                <>
                  <StatCard label="Tests" value={tests.length} icon="assignment" />
                  <StatCard
                    label="Published"
                    value={tests.filter((t) => t.status === 'PUBLISHED').length}
                    icon="public"
                    tone="tertiary"
                  />
                  <StatCard
                    label="Attempts"
                    value={tests.reduce((a, t) => a + (t._count?.submissions ?? 0), 0)}
                    icon="how_to_reg"
                  />
                </>
              ) : (
                <>
                  <StatCard label="To take" value={studentTodo.length} icon="pending_actions" />
                  <StatCard label="Completed" value={completed.length} icon="task_alt" tone="tertiary" />
                  <StatCard
                    label="Average"
                    value={averageScore === null ? '—' : percent(averageScore, 0)}
                    icon="trending_up"
                    tone="primary"
                  />
                </>
              )}
            </section>

            {!isTeacher && (
              <section className="grid grid-cols-2 gap-3">
                <Link
                  href="/join"
                  className="rounded-xl bg-primary text-on-primary p-4 flex flex-col gap-1 hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px]">vpn_key</span>
                  <span className="font-headline-sm text-headline-sm">Join a room</span>
                  <span className="font-body-sm text-[12px] opacity-90">Enter your teacher code</span>
                </Link>
                <Link
                  href="/leaderboard"
                  className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-1 hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px] text-primary">leaderboard</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface">Weekly ranks</span>
                  <span className="font-body-sm text-[12px] text-on-surface-variant">See where you stand</span>
                </Link>
              </section>
            )}

            {isTeacher && (
              <section className="grid grid-cols-2 gap-3">
                <Link
                  href="/rooms/create"
                  className="rounded-xl bg-primary text-on-primary p-4 flex flex-col gap-1 hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px]">add_circle</span>
                  <span className="font-headline-sm text-headline-sm">Create a room</span>
                  <span className="font-body-sm text-[12px] opacity-90">Auto-generates a join code</span>
                </Link>
                <Link
                  href="/tests/create"
                  className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-1 hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-[22px] text-primary">auto_awesome</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface">Generate a test</span>
                  <span className="font-body-sm text-[12px] text-on-surface-variant">Upload a PDF to start</span>
                </Link>
              </section>
            )}

            {/* Lists */}
            {isTeacher ? (
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Your rooms</h2>
                  <Link href="/rooms" className="font-label-mono-sm text-label-mono-sm text-primary uppercase">
                    View all
                  </Link>
                </div>
                {rooms.length === 0 ? (
                  <EmptyState
                    icon="meeting_room"
                    title="No rooms yet"
                    description="Create your first classroom to start sharing tests."
                    action={
                      <Link
                        href="/rooms/create"
                        className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
                      >
                        Create a room
                      </Link>
                    }
                  />
                ) : (
                  rooms.slice(0, 4).map((room) => (
                    <Link
                      key={room.id}
                      href={`/rooms/${room.code}`}
                      className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex items-center gap-3 hover:bg-surface-container-low transition-colors"
                    >
                      <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-label-mono-sm font-bold shrink-0">
                        {room.code.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-headline-sm text-headline-sm text-on-surface truncate">
                          {room.name}
                        </span>
                        <span className="block font-body-sm text-[12px] text-on-surface-variant">
                          #{room.code} • {room._count?.members ?? 0} students • {room._count?.tests ?? 0} tests
                        </span>
                      </span>
                      <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                    </Link>
                  ))
                )}
              </section>
            ) : (
              <section className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setView('upcoming')}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      view === 'upcoming'
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-surface-container bg-surface-container-lowest'
                    }`}
                  >
                    <span className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary">
                      To take
                    </span>
                    <span className="block font-stat-mono-lg text-stat-mono-lg text-on-surface">
                      {studentTodo.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('completed')}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      view === 'completed'
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-surface-container bg-surface-container-lowest'
                    }`}
                  >
                    <span className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary">
                      Completed
                    </span>
                    <span className="block font-stat-mono-lg text-stat-mono-lg text-on-surface">
                      {completed.length}
                    </span>
                  </button>
                </div>

                {view === 'upcoming' &&
                  (studentTodo.length === 0 ? (
                    <EmptyState
                      icon="event_available"
                      title="Nothing due right now"
                      description="You have completed every published test in your rooms."
                    />
                  ) : (
                    studentTodo.map((test) => (
                      <article
                        key={test.id}
                        className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-3"
                      >
                        <div>
                          <span className="block font-label-mono-sm text-label-mono-sm text-secondary">
                            {test.room?.name || 'Room'} • {test._count?.questions ?? test.questionCount} questions
                            {test.duration ? ` • ${test.duration} min` : ''}
                          </span>
                          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-1">{test.title}</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push(`/tests/${test.id}`)}
                          className="w-full h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-[14px] flex items-center justify-center gap-2"
                        >
                          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                          Start assessment
                        </button>
                      </article>
                    ))
                  ))}

                {view === 'completed' &&
                  (completed.length === 0 ? (
                    <EmptyState icon="assignment" title="No completed tests yet" description="Your results will appear here." />
                  ) : (
                    completed.map((submission) => {
                      const total = (submission.correctAnswers ?? 0) + (submission.wrongAnswers ?? 0);
                      const passed = (submission.percentage ?? 0) >= 40;
                      return (
                        <Link
                          key={submission.id}
                          href={`/tests/${submission.testId}/result?submission=${submission.id}`}
                          className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex items-center gap-3 hover:bg-surface-container-low transition-colors"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block font-label-mono-sm text-label-mono-sm text-secondary">
                              {formatDate(submission.submittedAt)} • {submission.test?.room?.name || 'Assessment'}
                            </span>
                            <span className="block font-headline-sm text-headline-sm text-on-surface truncate mt-0.5">
                              {submission.test?.title || 'Assessment'}
                            </span>
                            <span className="block font-body-sm text-[12px] text-on-surface-variant">
                              {submission.correctAnswers ?? 0}/{total || '—'} correct
                            </span>
                          </span>
                          <span className="text-right shrink-0">
                            <span
                              className={`block font-stat-mono-lg text-[20px] leading-none ${
                                passed ? 'text-tertiary' : 'text-error'
                              }`}
                            >
                              {percent(submission.percentage, 0)}
                            </span>
                            <span className="font-label-mono-sm text-[11px] text-secondary">
                              {passed ? 'passed' : 'below pass'}
                            </span>
                          </span>
                        </Link>
                      );
                    })
                  ))}
              </section>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
