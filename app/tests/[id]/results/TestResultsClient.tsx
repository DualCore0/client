'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDuration, getTestResults, percent } from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState, StatCard } from '@/components/States';

type Results = Awaited<ReturnType<typeof getTestResults>>;

export default function TestResultsClient({ testId }: { testId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { ready } = useRequireAuth('TEACHER');

  const [data, setData] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTestResults(testId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load results.');
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const exportCsv = () => {
    if (!data) return;
    const header = ['Rank', 'Student', 'Score', 'Percentage', 'Correct', 'Wrong', 'Time (s)', 'Submitted'];
    const rows = data.attempts.map((a) => [
      a.rank,
      a.name,
      a.score ?? '',
      a.percentage ?? '',
      a.correctAnswers ?? '',
      a.wrongAnswers ?? '',
      a.timeTaken ?? '',
      a.submittedAt ?? '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `classrank-${data.test.title.replace(/\s+/g, '-').toLowerCase()}-results.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Results exported as CSV.');
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <LoadingState label="Loading results…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ErrorState message={error || 'Results unavailable.'} onRetry={load} title="Could not load results" />
          <Link
            href="/tests"
            className="mt-3 flex items-center justify-center h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-headline-sm"
          >
            Back to my tests
          </Link>
        </div>
      </div>
    );
  }

  const { test, summary, attempts } = data;

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar
        title={test.title}
        subtitle="Results"
        backHref="/tests"
        action={
          attempts.length > 0 ? (
            <button
              type="button"
              onClick={exportCsv}
              aria-label="Export results as CSV"
              className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined text-[20px]">download</span>
            </button>
          ) : undefined
        }
      />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5">
          <p className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">
            {test.room ? `${test.room.name} • #${test.room.code}` : 'Standalone test'}
          </p>
          <h2 className="font-headline-md text-headline-md text-on-surface mt-1">{test.title}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            {test.questionCount} questions
            {test.duration ? ` • ${test.duration} min` : ''}
            {test.difficulty ? ` • ${test.difficulty.toLowerCase()}` : ''}
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Attempts" value={summary.attemptCount} icon="how_to_reg" tone="primary" />
          <StatCard
            label="Average"
            value={summary.averagePercentage === null ? '—' : percent(summary.averagePercentage, 0)}
            icon="trending_up"
          />
          <StatCard
            label="Highest"
            value={summary.highPercentage === null ? '—' : percent(summary.highPercentage, 0)}
            icon="arrow_upward"
            tone="tertiary"
          />
          <StatCard
            label="Lowest"
            value={summary.lowPercentage === null ? '—' : percent(summary.lowPercentage, 0)}
            icon="arrow_downward"
            tone="error"
          />
        </section>

        {attempts.length === 0 ? (
          <EmptyState
            icon="hourglass_empty"
            title="No attempts yet"
            description={
              test.status === 'PUBLISHED'
                ? 'Share the room code so students can take this test.'
                : 'Publish this test to let students attempt it.'
            }
            action={
              test.room ? (
                <button
                  type="button"
                  onClick={() => router.push(`/rooms/${test.room!.code}`)}
                  className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
                >
                  Open room
                </button>
              ) : undefined
            }
          />
        ) : (
          <section className="rounded-xl bg-surface-container-lowest border border-surface-container overflow-hidden">
            <div className="grid grid-cols-[36px_1fr_60px_60px] gap-2 px-4 py-2 bg-surface-container-low font-label-mono-sm text-label-mono-sm uppercase text-secondary">
              <span>#</span>
              <span>Student</span>
              <span className="text-right">Score</span>
              <span className="text-right">Time</span>
            </div>
            {attempts.map((attempt) => {
              const passed = (attempt.percentage ?? 0) >= 40;
              return (
                <div
                  key={attempt.submissionId}
                  className="grid grid-cols-[36px_1fr_60px_60px] gap-2 px-4 py-3 items-center border-t border-surface-container-low"
                >
                  <span className="font-stat-mono-lg text-[14px] text-on-surface-variant">{attempt.rank}</span>
                  <span className="min-w-0">
                    <span className="block font-body-md text-body-md text-on-surface truncate">{attempt.name}</span>
                    <span className="block font-label-mono-sm text-[10px] text-secondary">
                      {attempt.correctAnswers ?? 0} correct • {attempt.wrongAnswers ?? 0} wrong
                    </span>
                  </span>
                  <span
                    className={`font-stat-mono-lg text-[14px] text-right ${passed ? 'text-tertiary' : 'text-error'}`}
                  >
                    {attempt.percentage === null ? '—' : `${attempt.percentage.toFixed(0)}%`}
                  </span>
                  <span className="font-label-mono-sm text-[11px] text-on-surface-variant text-right">
                    {formatDuration(attempt.timeTaken)}
                  </span>
                </div>
              );
            })}
            {summary.passRate !== null && (
              <div className="px-4 py-3 bg-surface-container-low border-t border-surface-container-high font-body-sm text-body-sm text-on-surface-variant">
                {summary.passRate.toFixed(0)}% of attempts reached the 40% pass mark.
              </div>
            )}
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
