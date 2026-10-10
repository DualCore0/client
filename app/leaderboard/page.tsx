'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDate, getGlobalWeeklyLeaderboard, initialsOf, percent, type GlobalLeaderboardResponse } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<GlobalLeaderboardResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<GlobalLeaderboardResponse['leaderboard']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getGlobalWeeklyLeaderboard();
      // Tolerate an unexpected error body instead of crashing the render.
      const rows = Array.isArray(response?.leaderboard) ? response.leaderboard : [];
      setData(response);
      setLeaderboard(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const weekLabel = data
    ? `${new Date(data.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${new Date(
        data.weekEnd,
      ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : '';

  const podium = leaderboard.slice(0, 3);

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar title="Weekly leaderboard" subtitle={weekLabel || 'Global'} />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-primary shrink-0">emoji_events</span>
          <div className="flex-1 min-w-0">
            <p className="font-body-sm text-body-sm text-on-surface">
              Global score ={' '}
              <strong>{(data?.weights.average ?? 0.7) * 100}% average</strong> +{' '}
              <strong>{(data?.weights.accuracy ?? 0.2) * 100}% accuracy</strong> +{' '}
              <strong>{(data?.weights.participation ?? 0.1) * 100}% participation</strong>
            </p>
            <p className="font-body-sm text-[12px] text-on-surface-variant mt-1">
              Ranked from attempts submitted this week. A minimum of {data?.minTestsRequired ?? 3} completed tests is
              required to appear.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-label="How ranking works"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
          </button>
        </section>

        {showInfo && (
          <section className="rounded-xl bg-surface-container-low border border-surface-container p-4 flex flex-col gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <p>
              <strong className="text-on-surface">Average</strong> — mean percentage across every test you completed
              this week.
            </p>
            <p>
              <strong className="text-on-surface">Accuracy</strong> — correct answers divided by all questions you
              answered this week, so guessing on short tests helps less.
            </p>
            <p>
              <strong className="text-on-surface">Participation</strong> — scales with the number of tests you finished
              this week, capped at 5.
            </p>
            <p>Different tests have different difficulty, so this ranks effort and consistency, not raw brilliance.</p>
          </section>
        )}

        {loading && <LoadingState label="Ranking this week's attempts…" />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && leaderboard.length === 0 && (
          <EmptyState
            icon="leaderboard"
            title="No qualifying students this week"
            description={`Students need at least ${data?.minTestsRequired ?? 3} completed tests this week to be ranked.`}
            action={
              <Link
                href="/tests"
                className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
              >
                Take a test
              </Link>
            }
          />
        )}

        {!loading && !error && leaderboard.length > 0 && (
          <>
            {/* Podium */}
            <section className="grid grid-cols-3 gap-2 items-end">
              {[podium[1], podium[0], podium[2]].map((entry, index) => {
                if (!entry) return <div key={`gap-${index}`} />;
                const heights = ['h-20', 'h-28', 'h-16'];
                const tones = [
                  'bg-surface-container-high text-on-surface',
                  'bg-tertiary-container/30 text-tertiary',
                  'bg-secondary-container text-on-secondary-container',
                ];
                return (
                  <div key={entry.studentId} className="flex flex-col items-center gap-1">
                    <span className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-label-mono-sm text-label-mono-sm">
                      {initialsOf(entry.name)}
                    </span>
                    <span className="font-body-sm text-[12px] text-on-surface text-center truncate w-full">
                      {entry.name}
                    </span>
                    <div className={`w-full ${heights[index]} rounded-t-xl flex flex-col items-center justify-center ${tones[index]}`}>
                      <span className="font-stat-mono-lg text-[18px]">{entry.globalScore.toFixed(0)}</span>
                      <span className="font-label-mono-sm text-[10px] uppercase">score</span>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Table */}
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container overflow-hidden">
              <div className="grid grid-cols-[36px_1fr_64px_56px] gap-2 px-4 py-2 bg-surface-container-low font-label-mono-sm text-label-mono-sm uppercase text-secondary">
                <span>#</span>
                <span>Student</span>
                <span className="text-right">Score</span>
                <span className="text-right">Tests</span>
              </div>
              {leaderboard.map((entry) => {
                const isViewer = entry.studentId === user?.id;
                return (
                  <Link
                    key={entry.studentId}
                    href={`/profile/${entry.studentId}`}
                    className={`grid grid-cols-[36px_1fr_64px_56px] gap-2 px-4 py-3 items-center border-t border-surface-container-low hover:bg-surface-container-low transition-colors ${
                      isViewer ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="font-stat-mono-lg text-[14px] text-on-surface-variant">{entry.rank}</span>
                    <span className="min-w-0">
                      <span className="block font-body-md text-body-md text-on-surface truncate">
                        {entry.name}
                        {isViewer && (
                          <span className="font-label-mono-sm text-label-mono-sm text-primary"> (you)</span>
                        )}
                      </span>
                      <span className="block font-label-mono-sm text-[10px] text-secondary">
                        {percent(entry.avgPercentage, 0)} avg • {percent(entry.accuracy, 0)} accuracy
                      </span>
                    </span>
                    <span className="font-stat-mono-lg text-[14px] text-primary text-right">
                      {entry.globalScore.toFixed(1)}
                    </span>
                    <span className="font-stat-mono-lg text-[14px] text-on-surface text-right">
                      {entry.testsCompleted}
                    </span>
                  </Link>
                );
              })}
            </section>

            {data?.viewer ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                You are ranked <strong>#{data.viewer.rank}</strong> this week with a score of{' '}
                <strong>{data.viewer.globalScore.toFixed(1)}</strong>.
              </p>
            ) : (
              user?.role === 'STUDENT' && (
                <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                  Complete {data?.minTestsRequired ?? 3} tests this week to enter the ranking.
                </p>
              )
            )}

            <p className="font-label-mono-sm text-label-mono-sm text-on-surface-variant text-center">
              {data ? `${formatDate(data.weekStart)} — ${formatDate(data.weekEnd)}` : ''}
            </p>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
