'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  getAttemptState,
  getTestDetails,
  startTest,
  submitTest,
  type Question,
  type TestDetails,
} from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { ErrorState, LoadingState } from '@/components/States';

type AnswerMap = Record<string, number>;

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TakeTestClient({ testId }: { testId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { ready } = useRequireAuth('STUDENT');

  const [test, setTest] = useState<TestDetails | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const [remaining, setRemaining] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState<string | null>(null);

  // Keeps the auto-submit path from firing twice.
  const submittingRef = useRef(false);

  /* ── load test + start/resume the attempt ─────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      const [details, state] = await Promise.all([getTestDetails(testId), getAttemptState(testId)]);

      if (state.submissionId && state.submittedAt) {
        setAlreadySubmitted(state.submissionId);
        return;
      }

      setTest(details);
      setQuestions(details.questions ?? []);

      // The server owns the clock: resume an in-progress attempt using its
      // deadline, otherwise start a fresh one.
      if (state.submissionId) {
        setDeadline(state.deadline ? new Date(state.deadline).getTime() : null);
      } else {
        const started = await startTest(testId);
        const startedAt = new Date(started.startedAt).getTime();
        setDeadline(
          details.duration ? startedAt + details.duration * 60 * 1000 : null,
        );
      }
    } catch (err) {
      const status = err instanceof ApiError ? err.status : null;
      setErrorStatus(status);
      setError(
        status === 403
          ? 'You are not a member of this room, or the test is not published yet.'
          : status === 404
            ? 'This test no longer exists.'
            : err instanceof Error
              ? err.message
              : 'Could not load this test.',
      );
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const doSubmit = useCallback(
    async (auto = false) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const payload = questions
          .filter((q) => answers[q.id] !== undefined)
          .map((q) => ({ questionId: q.id, selectedAnswer: answers[q.id] }));

        const result = await submitTest(testId, payload);
        if (auto) toast.toast('Time is up — your answers were submitted automatically.', 'info');
        router.replace(`/tests/${testId}/result?submission=${result.id}`);
      } catch (err) {
        submittingRef.current = false;
        setSubmitting(false);
        toast.error(err instanceof Error ? err.message : 'Could not submit your test.');
      }
    },
    [answers, questions, router, testId, toast],
  );

  /* ── countdown ────────────────────────────────────────────── */
  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const left = Math.round((deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) void doSubmit(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, doSubmit]);

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [answers, questions],
  );

  const select = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const goTo = (index: number) => {
    setCurrent(Math.max(0, Math.min(index, questions.length - 1)));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── render ───────────────────────────────────────────────── */

  if (!ready || loading) {
    return (
      <div className="min-h-screen bg-surface">
        <LoadingState label="Preparing your test…" />
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-surface-container-lowest border border-surface-container p-6 text-center flex flex-col gap-3">
          <span className="material-symbols-outlined text-[40px] text-tertiary mx-auto">task_alt</span>
          <h1 className="font-headline-md text-headline-md">You already submitted this test</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Each test can only be attempted once. You can review your result now.
          </p>
          <button
            type="button"
            onClick={() => router.replace(`/tests/${testId}/result?submission=${alreadySubmitted}`)}
            className="mt-2 h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm"
          >
            View my result
          </button>
        </div>
      </div>
    );
  }

  if (error || !test || questions.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ErrorState
            message={error || 'This test does not have any questions yet.'}
            onRetry={error ? load : undefined}
            title={errorStatus === 403 ? 'Access denied' : 'Cannot open this test'}
          />
          <button
            type="button"
            onClick={() => router.replace('/tests')}
            className="mt-3 w-full h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-headline-sm"
          >
            Back to my tests
          </button>
        </div>
      </div>
    );
  }

  const question = questions[current];
  const selected = answers[question.id];
  const lowTime = remaining !== null && remaining <= 60;
  const progress = Math.round(((current + 1) / questions.length) * 100);

  return (
    <div className="min-h-screen bg-surface pb-32">
      {/* Header + timer */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-xl border-b border-surface-container-high pt-safe">
        <div className="max-w-3xl mx-auto px-gutter-mobile py-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-label-mono-sm text-label-mono-sm uppercase text-primary truncate">
              {test.room?.name || 'Assessment'}
            </p>
            <h1 className="font-headline-sm text-headline-sm text-on-surface truncate">{test.title}</h1>
          </div>
          <div
            className={`shrink-0 rounded-lg px-3 py-1.5 flex items-center gap-1.5 font-stat-mono-lg text-[16px] tabular-nums ${
              lowTime ? 'bg-error-container text-error' : 'bg-surface-container-high text-on-surface'
            }`}
            aria-live="polite"
          >
            <span className="material-symbols-outlined text-[18px]">timer</span>
            {remaining === null ? '--:--' : formatClock(remaining)}
          </div>
        </div>
        <div className="h-1 bg-surface-container-high">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-gutter-mobile py-5 flex flex-col gap-4">
        {/* Question navigator */}
        <div className="flex flex-wrap gap-2">
          {questions.map((q, index) => {
            const isAnswered = answers[q.id] !== undefined;
            const isCurrent = index === current;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Question ${index + 1}${isAnswered ? ' (answered)' : ''}`}
                aria-current={isCurrent ? 'true' : undefined}
                className={`w-9 h-9 rounded-lg font-label-mono-sm text-label-mono-sm transition-colors ${
                  isCurrent
                    ? 'bg-primary text-on-primary'
                    : isAnswered
                      ? 'bg-tertiary-container/20 text-tertiary'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <div className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">
              Question {current + 1} of {questions.length}
            </span>
            {question.difficulty && (
              <span className="font-label-mono-sm text-label-mono-sm uppercase text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                {question.difficulty}
              </span>
            )}
          </div>

          <h2 className="font-headline-md text-headline-md text-on-surface leading-snug">
            {question.questionText}
          </h2>

          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Answer options">
            {question.options.map((option, index) => {
              const isSelected = selected === index;
              return (
                <button
                  key={`${question.id}-${index}`}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => select(question.id, index)}
                  className={`w-full text-left rounded-lg border p-3.5 flex items-start gap-3 transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-surface-container-high bg-surface-container-low hover:bg-surface-container'
                  }`}
                >
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-label-mono-sm text-label-mono-sm font-semibold ${
                      isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="font-body-md text-body-md text-on-surface pt-0.5">{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="h-11 px-4 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[14px] flex items-center gap-1 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            Previous
          </button>

          {current < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              className="flex-1 h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-[14px] flex items-center justify-center gap-1"
            >
              Next question
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="flex-1 h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-[14px] flex items-center justify-center gap-1"
            >
              Review &amp; submit
              <span className="material-symbols-outlined text-[18px]">done_all</span>
            </button>
          )}
        </div>

        <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
          {answeredCount} of {questions.length} answered
          {answeredCount < questions.length && ' — unanswered questions score zero.'}
        </p>
      </main>

      {/* Submit confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] bg-on-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-surface-container-lowest p-6 shadow-xl flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-primary">fact_check</span>
              <h2 className="font-headline-md text-headline-md">Submit test?</h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              You answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length && ' Unanswered questions will be marked wrong.'} This cannot be
              undone.
            </p>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[14px]"
              >
                Keep answering
              </button>
              <button
                type="button"
                onClick={() => doSubmit(false)}
                disabled={submitting}
                className="flex-1 h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-[14px] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {submitting && (
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                )}
                {submitting ? 'Submitting…' : 'Submit now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-[65] bg-surface/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined text-[36px] text-primary animate-spin">progress_activity</span>
          <p className="font-headline-sm text-headline-sm">Evaluating your answers…</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Graded on the server — this only takes a moment.
          </p>
        </div>
      )}
    </div>
  );
}
