'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  formatDate,
  getRoomDetails,
  getRoomLeaderboard,
  getRooms,
  type RoomDetails,
  type RoomLeaderboardResponse,
} from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState, StatusPill } from '@/components/States';

type Tab = 'overview' | 'tests' | 'students' | 'leaderboard';

export default function RoomDetailClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user, ready } = useRequireAuth();

  const [room, setRoom] = useState<RoomDetails | null>(null);
  const [board, setBoard] = useState<RoomLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      const rooms = await getRooms();
      const match = rooms.find((r) => r.code.toUpperCase() === roomCode.toUpperCase());
      if (!match) {
        setError('You are not a member of this room, or it no longer exists.');
        setErrorStatus(404);
        return;
      }
      const [details, leaderboard] = await Promise.all([
        getRoomDetails(match.id),
        getRoomLeaderboard(match.code).catch(() => null),
      ]);
      setRoom(details);
      setBoard(leaderboard);
    } catch (err) {
      setErrorStatus(err instanceof ApiError ? err.status : null);
      setError(err instanceof Error ? err.message : 'Could not load this room.');
    } finally {
      setLoading(false);
    }
  }, [roomCode, user]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error('Could not copy to the clipboard.');
    }
  };

  const share = async (url: string, name: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: `Join my ClassRank room: ${name}`, url });
      } else {
        await copy(url, 'Join link');
      }
    } catch {
      /* user cancelled */
    }
  };

  const downloadQr = () => {
    if (!room) return;
    const link = document.createElement('a');
    link.href = room.qrCode;
    link.download = `classrank-${room.code}.png`;
    link.click();
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <LoadingState label="Opening room…" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ErrorState
            message={error || 'Room unavailable.'}
            onRetry={load}
            title={errorStatus === 403 ? 'Access denied' : 'Room not found'}
          />
          <Link
            href="/rooms"
            className="mt-3 flex items-center justify-center h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-headline-sm"
          >
            Back to rooms
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.role === 'TEACHER' && room.teacherId === user.id;
  const publishedTests = room.tests.filter((t) => t.status === 'PUBLISHED');
  const averageScore = board?.leaderboard.length
    ? board.leaderboard.reduce((a, e) => a + e.averagePercentage, 0) / board.leaderboard.length
    : null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tests', label: 'Tests', count: room.tests.length },
    { key: 'students', label: 'Students', count: room.members.length },
    { key: 'leaderboard', label: 'Ranks', count: board?.leaderboard.length },
  ];

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar title={room.name} subtitle={`#${room.code}`} backHref="/rooms" />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-container-low overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[80px] h-9 rounded-lg font-label-mono-sm text-label-mono-sm uppercase transition-colors ${
                tab === t.key ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t.label}
              {t.count !== undefined ? ` ${t.count}` : ''}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-headline-md text-headline-md text-on-surface">{room.name}</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {room.subject || 'General'} • created {formatDate(room.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 font-stat-mono-lg text-[24px] tracking-[0.25em] text-primary">
                  {room.code}
                </span>
              </div>
              {room.description && (
                <p className="font-body-sm text-body-sm text-on-surface-variant">{room.description}</p>
              )}
            </section>

            <section className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface-container-lowest border border-surface-container p-4">
                <span className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary">Students</span>
                <span className="block font-stat-mono-lg text-stat-mono-lg text-on-surface">{room.members.length}</span>
              </div>
              <div className="rounded-xl bg-surface-container-lowest border border-surface-container p-4">
                <span className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary">Tests</span>
                <span className="block font-stat-mono-lg text-stat-mono-lg text-on-surface">
                  {publishedTests.length}
                  <span className="font-body-sm text-[13px] text-on-surface-variant"> / {room.tests.length}</span>
                </span>
              </div>
              <div className="rounded-xl bg-surface-container-lowest border border-surface-container p-4">
                <span className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary">Avg score</span>
                <span className="block font-stat-mono-lg text-stat-mono-lg text-primary">
                  {averageScore === null ? '—' : `${averageScore.toFixed(0)}%`}
                </span>
              </div>
            </section>

            {/* Share panel (teachers) */}
            {isOwner && (
              <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-4">
                <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">qr_code_2</span>
                  Invite your students
                </h3>

                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="shrink-0 mx-auto sm:mx-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={room.qrCode}
                      alt={`QR code to join ${room.name}`}
                      width={160}
                      height={160}
                      className="rounded-lg border border-surface-container-high bg-white p-2"
                    />
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <div className="rounded-lg bg-surface-container-low px-3 py-2 flex items-center gap-2">
                      <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary shrink-0">
                        Code
                      </span>
                      <span className="font-stat-mono-lg text-[18px] tracking-[0.25em] text-primary flex-1">
                        {room.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(room.code, 'Room code')}
                        aria-label="Copy room code"
                        className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]">content_copy</span>
                      </button>
                    </div>

                    <div className="rounded-lg bg-surface-container-low px-3 py-2 flex items-center gap-2">
                      <span className="font-body-sm text-[12px] text-on-surface-variant truncate flex-1">
                        {room.joinUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(room.joinUrl, 'Join link')}
                        aria-label="Copy join link"
                        className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary shrink-0"
                      >
                        <span className="material-symbols-outlined text-[18px]">link</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => share(room.joinUrl, room.name)}
                        className="flex-1 h-10 rounded-lg bg-primary text-on-primary font-headline-sm text-[13px] flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">share</span>
                        Share
                      </button>
                      <button
                        type="button"
                        onClick={downloadQr}
                        className="flex-1 h-10 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[13px] flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Save QR
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {isOwner && (
              <Link
                href={`/tests/create?room=${room.id}`}
                className="h-12 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                Generate a test from a PDF
              </Link>
            )}
          </>
        )}

        {tab === 'tests' && (
          <section className="flex flex-col gap-3">
            {room.tests.length === 0 ? (
              <EmptyState
                icon="assignment"
                title="No tests in this room"
                description={isOwner ? 'Upload a PDF and let AI draft your first test.' : 'Check back once your teacher publishes one.'}
                action={
                  isOwner ? (
                    <Link
                      href={`/tests/create?room=${room.id}`}
                      className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
                    >
                      Create a test
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              room.tests.map((test) => (
                <article
                  key={test.id}
                  className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusPill status={test.status} />
                        <span className="font-label-mono-sm text-label-mono-sm text-secondary">
                          {test._count?.questions ?? test.questionCount} questions
                          {test.duration ? ` • ${test.duration} min` : ''}
                        </span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{test.title}</h3>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {isOwner ? (
                      <Link
                        href={`/tests/${test.id}/results`}
                        className="flex-1 h-10 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[13px] flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">bar_chart</span>
                        Results
                      </Link>
                    ) : test.status === 'PUBLISHED' ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/tests/${test.id}`)}
                        className="flex-1 h-10 rounded-lg bg-primary text-on-primary font-headline-sm text-[13px] flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        Take test
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </section>
        )}

        {tab === 'students' && (
          <section className="flex flex-col gap-2">
            {room.members.length === 0 ? (
              <EmptyState
                icon="group"
                title="No students yet"
                description={isOwner ? 'Share the room code or QR so students can join.' : undefined}
              />
            ) : (
              room.members.map((member, index) => (
                <div
                  key={member.id}
                  className="rounded-xl bg-surface-container-lowest border border-surface-container p-3 flex items-center gap-3"
                >
                  <span className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-label-mono-sm text-label-mono-sm">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body-md text-body-md text-on-surface truncate">
                      {member.student.fullname || member.student.email.split('@')[0]}
                    </span>
                    <span className="block font-label-mono-sm text-label-mono-sm text-secondary">
                      joined {formatDate(member.joinedAt)}
                    </span>
                  </span>
                  <Link
                    href={`/profile/${member.studentId}`}
                    className="shrink-0 font-label-mono-sm text-label-mono-sm text-primary uppercase"
                  >
                    Profile
                  </Link>
                </div>
              ))
            )}
          </section>
        )}

        {tab === 'leaderboard' && (
          <section className="flex flex-col gap-2">
            {!board || board.leaderboard.length === 0 ? (
              <EmptyState
                icon="leaderboard"
                title="No ranked attempts yet"
                description="Ranks appear once students submit tests in this room."
              />
            ) : (
              board.leaderboard.map((entry) => {
                const isViewer = entry.studentId === user?.id;
                return (
                  <div
                    key={entry.studentId}
                    className={`rounded-xl border p-3 flex items-center gap-3 ${
                      isViewer ? 'border-primary/40 bg-primary/5' : 'border-surface-container bg-surface-container-lowest'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-label-mono-sm text-label-mono-sm font-bold shrink-0 ${
                        entry.rank === 1
                          ? 'bg-tertiary-container/30 text-tertiary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-body-md text-body-md text-on-surface truncate">
                        {entry.name}
                        {isViewer && <span className="font-label-mono-sm text-label-mono-sm text-primary"> (you)</span>}
                      </span>
                      <span className="block font-label-mono-sm text-label-mono-sm text-secondary">
                        {entry.testsCompleted} test{entry.testsCompleted === 1 ? '' : 's'} completed
                      </span>
                    </span>
                    <span className="font-stat-mono-lg text-[18px] text-primary shrink-0">
                      {entry.averagePercentage.toFixed(1)}%
                    </span>
                  </div>
                );
              })
            )}
            <Link
              href={`/rooms/${room.code}/leaderboard`}
              className="h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[14px] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_full</span>
              Full leaderboard
            </Link>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
