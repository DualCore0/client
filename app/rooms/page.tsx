'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError, getRooms, joinRoom, type Room } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export default function RoomsPage() {
  const { user, ready } = useRequireAuth();
  const { signOut } = useAuth();
  const toast = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const isTeacher = user?.role === 'TEACHER';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setRooms(await getRooms());
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes('401')) signOut();
      setError(err instanceof Error ? err.message : 'Could not load your rooms.');
    } finally {
      setLoading(false);
    }
  }, [user, signOut]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const handleJoin = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      toast.error('Room codes are 6 characters long.');
      return;
    }
    setJoining(true);
    try {
      const membership = await joinRoom(clean);
      toast.success(`Joined ${membership.room?.name || 'the room'}.`);
      setCode('');
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.toast('You have already joined this room.', 'info');
      } else if (err instanceof ApiError && err.status === 404) {
        toast.error('No room exists with that code.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Could not join that room.');
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar
        title={isTeacher ? 'My rooms' : 'My classrooms'}
        subtitle={isTeacher ? 'Teacher' : 'Student'}
        action={
          isTeacher ? (
            <Link
              href="/rooms/create"
              className="h-9 px-3 rounded-lg bg-primary text-on-primary font-headline-sm text-[13px] flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              New
            </Link>
          ) : undefined
        }
      />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        {!isTeacher && (
          <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-3">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Join a classroom</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                maxLength={6}
                placeholder="ROOM CODE"
                aria-label="Room code"
                className="flex-1 h-12 rounded-lg bg-surface-container-low text-center font-stat-mono-lg text-[16px] tracking-[0.25em] uppercase text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:tracking-normal placeholder:font-body-sm placeholder:text-outline"
              />
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining || code.length !== 6}
                className="h-12 px-5 rounded-lg bg-primary text-on-primary font-headline-sm text-[14px] disabled:opacity-50"
              >
                {joining ? 'Joining…' : 'Join'}
              </button>
            </div>
            <Link href="/join" className="font-body-sm text-body-sm text-primary hover:underline self-start">
              Or open the full join screen →
            </Link>
          </section>
        )}

        {loading && <LoadingState label="Loading rooms…" />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && rooms.length === 0 && (
          <EmptyState
            icon="meeting_room"
            title={isTeacher ? 'No rooms yet' : 'You have not joined a room'}
            description={
              isTeacher
                ? 'Create a room to get a share code and QR for your students.'
                : 'Ask your teacher for a room code, then join from the box above.'
            }
            action={
              isTeacher ? (
                <Link
                  href="/rooms/create"
                  className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
                >
                  Create a room
                </Link>
              ) : undefined
            }
          />
        )}

        {!loading && !error && rooms.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {isTeacher ? 'Rooms you own' : 'Enrolled classrooms'}
            </h2>
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.code}`}
                className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-3 hover:bg-surface-container-low transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-label-mono-sm font-bold shrink-0">
                    {room.code.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-stat-mono-lg text-[12px] tracking-widest text-secondary uppercase">
                      #{room.code}
                    </span>
                    <span className="block font-headline-sm text-headline-sm text-on-surface truncate">
                      {room.name}
                    </span>
                    {room.subject && (
                      <span className="block font-body-sm text-[12px] text-on-surface-variant">{room.subject}</span>
                    )}
                  </span>
                  <span className="material-symbols-outlined text-on-surface-variant shrink-0">chevron_right</span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-surface-container-low">
                  <div>
                    <span className="block font-label-mono-sm text-[10px] uppercase text-secondary">Cohort</span>
                    <span className="block font-stat-mono-lg text-[14px] text-on-surface">
                      {room._count?.members ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="block font-label-mono-sm text-[10px] uppercase text-secondary">Tests</span>
                    <span className="block font-stat-mono-lg text-[14px] text-on-surface">
                      {room._count?.tests ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="block font-label-mono-sm text-[10px] uppercase text-secondary">Leaderboard</span>
                    <span className="block font-stat-mono-lg text-[14px] text-primary">View</span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
