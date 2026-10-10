'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, getPublicRoomPreview, joinRoom } from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { ErrorState, LoadingState } from '@/components/States';

type Preview = Awaited<ReturnType<typeof getPublicRoomPreview>>;

export default function JoinClient({ initialCode = '' }: { initialCode?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user, ready } = useRequireAuth();

  const [code, setCode] = useState(initialCode.toUpperCase());
  const [preview, setPreview] = useState<Preview | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  const lookup = useCallback(
    async (value: string) => {
      const clean = value.trim().toUpperCase();
      if (clean.length !== 6) return;
      setVerifying(true);
      setError(null);
      setPreview(null);
      try {
        setPreview(await getPublicRoomPreview(clean));
      } catch (err) {
        setError(
          err instanceof ApiError && err.status === 404
            ? 'No room exists with that code. Check it with your teacher and try again.'
            : err instanceof Error
              ? err.message
              : 'Could not look up that room.',
        );
      } finally {
        setVerifying(false);
      }
    },
    [],
  );

  // Support the shared /join/CODE link.
  useEffect(() => {
    if (ready && initialCode && initialCode.length === 6) void lookup(initialCode);
  }, [ready, initialCode, lookup]);

  const handleJoin = async () => {
    if (!preview) return;
    setJoining(true);
    setError(null);
    try {
      await joinRoom(preview.code);
      toast.success(`Joined ${preview.name}.`);
      router.replace(`/rooms/${preview.code}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not join this room.';
      if (message.toLowerCase().includes('already joined')) {
        setAlreadyMember(true);
        toast.toast('You are already a member of this room.', 'info');
      } else if (err instanceof ApiError && err.status === 403) {
        setError('Only student accounts can join a room by code.');
      } else {
        setError(message);
      }
    } finally {
      setJoining(false);
    }
  };

  const isTeacher = user?.role === 'TEACHER';

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar title="Join a room" subtitle="Student" />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-3">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Enter your room code</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Six characters, shared by your teacher. Letters are not case sensitive.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                setError(null);
                setPreview(null);
                setAlreadyMember(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void lookup(code);
              }}
              maxLength={6}
              inputMode="text"
              autoCapitalize="characters"
              placeholder="K7M4P2"
              aria-label="Room code"
              className="flex-1 h-14 rounded-lg bg-surface-container-low text-center font-stat-mono-lg text-stat-mono-lg tracking-[0.3em] uppercase text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:tracking-normal placeholder:font-body-md placeholder:text-outline"
            />
            <button
              type="button"
              onClick={() => lookup(code)}
              disabled={code.length !== 6 || verifying}
              className="h-14 px-5 rounded-lg bg-primary text-on-primary font-headline-sm text-[14px] disabled:opacity-50"
            >
              {verifying ? 'Checking…' : 'Find room'}
            </button>
          </div>

          {isTeacher && (
            <p className="font-body-sm text-[13px] text-on-surface-variant bg-surface-container-low rounded-lg p-3">
              You are signed in as a teacher. Joining by code is a student action — create your own rooms from the
              Rooms tab instead.
            </p>
          )}
        </section>

        {error && <ErrorState message={error} title="Room not available" onRetry={() => lookup(code)} />}

        {verifying && <LoadingState label="Looking up the room…" />}

        {preview && !verifying && (
          <section className="rounded-xl bg-surface-container-lowest border border-surface-container overflow-hidden">
            <div className="bg-surface-container-low p-5 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-label-mono-sm text-label-mono-sm uppercase">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  room found
                </span>
                <span className="font-stat-mono-lg text-[16px] tracking-widest text-primary">#{preview.code}</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mt-2">{preview.name}</h3>
              <p className="font-body-sm text-body-sm text-secondary">
                {preview.subject || 'General'} • {preview.instructor}
              </p>
              {preview.description && (
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{preview.description}</p>
              )}
            </div>

            <div className="p-5 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface-container-low p-3">
                  <span className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary">Cohort</span>
                  <span className="block font-stat-mono-lg text-[18px] text-on-surface">
                    {preview.memberCount} enrolled
                  </span>
                </div>
                <div className="rounded-lg bg-surface-container-low p-3">
                  <span className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary">
                    Published tests
                  </span>
                  <span className="block font-stat-mono-lg text-[18px] text-on-surface">{preview.testCount}</span>
                </div>
              </div>

              {alreadyMember ? (
                <Link
                  href={`/rooms/${preview.code}`}
                  className="w-full h-12 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">meeting_room</span>
                  Open this room
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining || isTeacher}
                  className="w-full h-12 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {joining ? (
                    <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[20px]">login</span>
                  )}
                  {joining ? 'Joining…' : 'Join this room'}
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
