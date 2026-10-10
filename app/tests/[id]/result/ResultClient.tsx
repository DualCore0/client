'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  formatDuration,
  getSubmissionDetails,
  getSubmissions,
  percent,
  type SubmissionDetails,
} from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { ErrorState, LoadingState, StatCard } from '@/components/States';

export default function ResultClient({ testId }: { testId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready } = useRequireAuth('STUDENT');

  const submissionId = searchParams.get('submission');
  const [result, setResult] = useState<SubmissionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The submit response hands us the submission id; when the page is opened
      // directly we fall back to the most recent attempt for this test.
      let id = submissionId;
      if (!id) {
        const mine = await getSubmissions();
        id = mine.find((s) => s.testId === testId)?.id ?? null;
      }
      if (!id) {
        setError('No attempt was found for this test.');
        return;
      }
      setResult(await getSubmissionDetails(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your result.');
    } finally {
      setLoading(false);
    }
  }, [testId, submissionId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <LoadingState label="Calculating your result…" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ErrorState message={error || 'Result unavailable.'} onRetry={load} title="No result found" />
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
  const scoreColor = passed ? 'text-tertiary' : 'text-error';

  return (
    <div className="min-h-screen bg-surface pb-24">
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high pt-safe">
        <div className="max-w-3xl mx-auto h-16 px-gutter-mobile flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/tests')}
            aria-label="Back to my tests"
            className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <h1 className="font-headline-sm text-headline-sm">Assessment result</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-gutter-mobile py-5 flex flex-col gap-4">
        {/* Score hero */}
        <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-6 flex flex-col items-center text-center gap-2">
          <span
            className={`material-symbols-outlined text-[44px] ${scoreColor}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {passed ? 'workspace_premium' : 'school'}
          </span>
          <p className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">
            {result.test.title}
            {result.test.room ? ` • ${result.test.room.name}` : ''}
          </p>
          <div className="flex items-end gap-2">
            <span className={`font-stat-mono-lg text-[44px] leading-none ${scoreColor}`}>
              {result.correctAnswers ?? 0}
            </span>
            <span className="font-headline-md text-headline-md text-on-surface-variant mb-1">/ {total || '—'}</span>
          </div>
          <p className="font-headline-md text-headline-md text-on-surface">{percent(result.percentage)}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {passed ? 'Passed — nice work.' : 'Below the 40% pass mark. Review the answers below.'}
          </p>
        </section>

        {/* Breakdown */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Correct" value={result.correctAnswers ?? 0} icon="check_circle" tone="tertiary" />
          <StatCard label="Wrong" value={result.wrongAnswers ?? 0} icon="cancel" tone="error" />
          <StatCard label="Time taken" value={formatDuration(result.timeTaken)} icon="timer" />
          <StatCard
            label="Submitted"
            value={
              result.submittedAt
                ? new Date(result.submittedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                : '—'
            }
            icon="schedule"
          />
        </section>

        {/* Actions */}
        <section className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setShowReview((v) => !v)}
            className="flex-1 h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">visibility</span>
            {showReview ? 'Hide answer review' : 'Review answers'}
          </button>
          {result.test.room?.code && (
            <Link
              href={`/rooms/${result.test.room.code}/leaderboard`}
              className="flex-1 h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-headline-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">leaderboard</span>
              Room leaderboard
            </Link>
          )}
        </section>

        {/* Answer review */}
        {showReview && (
          <section className="flex flex-col gap-3">
            {result.questions.map((q, index) => {
              const selected = q.selectedAnswer;
              const correct = q.correctAnswer;
              return (
                <article
                  key={q.id}
                  className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-body-md text-body-md text-on-surface font-medium">
                      {index + 1}. {q.questionText}
                    </p>
                    <span
                      className={`material-symbols-outlined text-[20px] shrink-0 ${
                        q.isCorrect ? 'text-tertiary' : 'text-error'
                      }`}
                    >
                      {q.isCorrect ? 'check_circle' : 'cancel'}
                    </span>
                  </div>

                  <ul className="flex flex-col gap-1.5">
                    {q.options.map((option, optionIndex) => {
                      const isCorrectOption = correct === optionIndex;
                      const isChosen = selected === optionIndex;
                      return (
                        <li
                          key={`${q.id}-${optionIndex}`}
                          className={`rounded-lg px-3 py-2 flex items-center gap-2 font-body-sm text-body-sm ${
                            isCorrectOption
                              ? 'bg-tertiary-container/20 text-on-surface font-medium'
                              : isChosen
                                ? 'bg-error-container/40 text-on-surface'
                                : 'bg-surface-container-low text-on-surface-variant'
                          }`}
                        >
                          <span className="font-label-mono-sm text-label-mono-sm w-4 shrink-0">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="flex-1">{option}</span>
                          {isCorrectOption && (
                            <span className="font-label-mono-sm text-label-mono-sm text-tertiary uppercase shrink-0">
                              correct
                            </span>
                          )}
                          {isChosen && !isCorrectOption && (
                            <span className="font-label-mono-sm text-label-mono-sm text-error uppercase shrink-0">
                              your answer
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {selected === null && (
                    <p className="font-body-sm text-[12px] text-on-surface-variant">You did not answer this question.</p>
                  )}
                </article>
              );
            })}
            {result.questions.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No answer detail is available.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
