'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getRoomLeaderboard, type RoomLeaderboardResponse } from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export default function RoomLeaderboardClient({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const { user, ready } = useRequireAuth();

  const [data, setData] = useState<RoomLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getRoomLeaderboard(roomCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const podium = data?.leaderboard.slice(0, 3) ?? [];

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar
        title={data?.room.name ? `${data.room.name} ranks` : 'Room leaderboard'}
        subtitle={`#${roomCode.toUpperCase()}`}
        backHref={`/rooms/${roomCode}`}
      />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        {loading && <LoadingState label="Building the leaderboard…" />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && data && data.leaderboard.length === 0 && (
          <EmptyState
            icon="leaderboard"
            title="No ranked attempts yet"
            description="Ranks are calculated from the average percentage of a student's completed tests in this room."
            action={
              <Link
                href={`/rooms/${roomCode}`}
                className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
              >
                Back to room
              </Link>
            }
          />
        )}

        {!loading && !error && data && data.leaderboard.length > 0 && (
          <>
            {/* Podium */}
            <section className="grid grid-cols-3 gap-2 items-end">
              {[podium[1], podium[0], podium[2]].map((entry, index) => {
                if (!entry) return <div key={`empty-${index}`} />;
                const heights = ['h-20', 'h-28', 'h-16'];
                const colors = [
                  'bg-surface-container-high text-on-surface',
                  'bg-tertiary-container/30 text-tertiary',
                  'bg-secondary-container text-on-secondary-container',
                ];
                return (
                  <div key={entry.studentId} className="flex flex-col items-center gap-1">
                    <span className="font-label-mono-sm text-label-mono-sm text-secondary">#{entry.rank}</span>
                    <span className="font-body-sm text-[12px] text-on-surface text-center truncate w-full">
                      {entry.name}
                    </span>
                    <div
                      className={`w-full ${heights[index]} rounded-t-xl flex flex-col items-center justify-center ${colors[index]}`}
                    >
                      <span className="font-stat-mono-lg text-[18px]">{entry.averagePercentage.toFixed(0)}%</span>
                      <span className="font-label-mono-sm text-[10px] uppercase">
                        {entry.testsCompleted} test{entry.testsCompleted === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Full table */}
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_70px_60px] gap-2 px-4 py-2 bg-surface-container-low font-label-mono-sm text-label-mono-sm uppercase text-secondary">
                <span>Rank</span>
                <span>Student</span>
                <span className="text-right">Average</span>
                <span className="text-right">Tests</span>
              </div>
              {data.leaderboard.map((entry) => {
                const isViewer = entry.studentId === user?.id;
                return (
                  <div
                    key={entry.studentId}
                    className={`grid grid-cols-[40px_1fr_70px_60px] gap-2 px-4 py-3 items-center border-t border-surface-container-low ${
                      isViewer ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="font-stat-mono-lg text-[14px] text-on-surface-variant">{entry.rank}</span>
                    <span className="min-w-0">
                      <span className="block font-body-md text-body-md text-on-surface truncate">
                        {entry.name}
                        {isViewer && <span className="font-label-mono-sm text-label-mono-sm text-primary"> (you)</span>}
                      </span>
                      <span className="block font-label-mono-sm text-[10px] text-secondary">
                        avg {Math.floor(entry.averageTimeTaken / 60)}m {entry.averageTimeTaken % 60}s
                      </span>
                    </span>
                    <span className="font-stat-mono-lg text-[14px] text-primary text-right">
                      {entry.averagePercentage.toFixed(1)}%
                    </span>
                    <span className="font-stat-mono-lg text-[14px] text-on-surface text-right">
                      {entry.testsCompleted}
                    </span>
                  </div>
                );
              })}
            </section>

            {data.viewer && (
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                You are ranked <strong>#{data.viewer.rank}</strong> of {data.totalParticipants} in this room.
              </p>
            )}

            <button
              type="button"
              onClick={() => router.push('/leaderboard')}
              className="h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[14px] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">public</span>
              Weekly global leaderboard
            </button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
