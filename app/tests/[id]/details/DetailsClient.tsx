'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  formatDateTime,
  formatDuration,
  getSubmissionDetails,
  getSubmissions,
  percent,
  type SubmissionDetails,
} from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { ErrorState, LoadingState, StatCard } from '@/components/States';

export default function SubmissionDetailsClient({ testId }: { testId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { ready } = useRequireAuth('STUDENT');

  const [result, setResult] = useState<SubmissionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mine = await getSubmissions();
      const found = mine.find((s) => s.testId === testId);
      if (!found) {
        setError('You have not attempted this test yet.');
        return;
      }
      setResult(await getSubmissionDetails(found.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this attempt.');
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const share = async () => {
    if (!result) return;
    const lines = [
      `${result.test.title}${result.test.room ? ` — ${result.test.room.name}` : ''}`,
      `Score: ${result.correctAnswers ?? 0}/${(result.correctAnswers ?? 0) + (result.wrongAnswers ?? 0)} (${percent(result.percentage)})`,
      `Time: ${formatDuration(result.timeTaken)}`,
      'via ClassRank',
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: result.test.title, text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        toast.success('Result copied to your clipboard.');
      }
    } catch {
      toast.error('Could not share this result.');
    }
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <LoadingState label="Loading your attempt…" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex-1 w-full bg-surface min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ErrorState message={error || 'Attempt unavailable.'} title="No attempt found" />
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

  const total = (result.correctAnswers ?? 0) + (result.wrongAnswers ?? 0);
  const passed = (result.percentage ?? 0) >= 40;

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-40 pt-safe bg-surface/85 backdrop-blur-xl border-b border-surface-container-high">
        <div className="h-16 px-gutter-mobile max-w-3xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/tests')}
            aria-label="Back to my tests"
            className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <h1 className="font-headline-sm text-headline-sm flex-1 truncate">Attempt details</h1>
          <button
            type="button"
            onClick={share}
            aria-label="Share this result"
            className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:text-primary"
          >
            <span className="material-symbols-outlined text-[20px]">share</span>
          </button>
        </div>
      </header>

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-1">
          <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">
            {formatDateTime(result.submittedAt)} {result.test.room ? `• ${result.test.room.name}` : ''}
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface leading-tight">{result.test.title}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            {result.test.topic || 'General assessment'}
            {result.test.duration ? ` • ${result.test.duration} minute limit` : ''}
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Score"
            value={`${result.correctAnswers ?? 0}/${total || '—'}`}
            tone={passed ? 'tertiary' : 'error'}
          />
          <StatCard label="Percentage" value={percent(result.percentage)} tone={passed ? 'primary' : 'error'} />
          <StatCard label="Correct" value={result.correctAnswers ?? 0} icon="check_circle" tone="tertiary" />
          <StatCard label="Wrong" value={result.wrongAnswers ?? 0} icon="cancel" tone="error" />
        </section>

        <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-3">
          <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">insights</span>
            Attempt summary
          </h3>
          <dl className="grid grid-cols-2 gap-3 font-body-sm text-body-sm">
            <div>
              <dt className="text-secondary font-label-mono-sm text-label-mono-sm uppercase">Started</dt>
              <dd className="text-on-surface">{formatDateTime(result.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-secondary font-label-mono-sm text-label-mono-sm uppercase">Submitted</dt>
              <dd className="text-on-surface">{formatDateTime(result.submittedAt)}</dd>
            </div>
            <div>
              <dt className="text-secondary font-label-mono-sm text-label-mono-sm uppercase">Time taken</dt>
              <dd className="text-on-surface">{formatDuration(result.timeTaken)}</dd>
            </div>
            <div>
              <dt className="text-secondary font-label-mono-sm text-label-mono-sm uppercase">Accuracy</dt>
              <dd className="text-on-surface">{percent(result.percentage)}</dd>
            </div>
          </dl>
        </section>

        <Link
          href={`/tests/${testId}/result`}
          className="w-full h-12 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">visibility</span>
          Review answers
        </Link>
      </div>
    </div>
  );
}
