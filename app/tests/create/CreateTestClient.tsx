'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  deleteQuestion,
  editQuestion,
  generateAITest,
  getDocument,
  getRooms,
  getRoomDocuments,
  publishTest,
  uploadDocument,
  type DocumentRecord,
  type Room,
  type TestDetails,
} from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { BottomNav, TopBar } from '@/components/BottomNav';
import { EmptyState, ErrorState, LoadingState, StatusPill } from '@/components/States';

type Step = 'source' | 'configure' | 'review';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function CreateTestClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { ready } = useRequireAuth('TEACHER');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState(searchParams.get('room') || '');
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentId, setDocumentId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [polling, setPolling] = useState(false);

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(15);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('MEDIUM');

  const [step, setStep] = useState<Step>('source');
  const [generating, setGenerating] = useState(false);
  const [test, setTest] = useState<TestDetails | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── load rooms ───────────────────────────────────────────── */
  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    setRoomsError(null);
    try {
      const list = await getRooms();
      setRooms(list);
      setRoomId((current) => current || list[0]?.id || '');
    } catch (err) {
      setRoomsError(err instanceof Error ? err.message : 'Could not load your rooms.');
    } finally {
      setRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void loadRooms();
  }, [ready, loadRooms]);

  /* ── load documents for the selected room ─────────────────── */
  const loadDocuments = useCallback(async (id: string) => {
    if (!id) {
      setDocuments([]);
      return;
    }
    try {
      const docs = await getRoomDocuments(id);
      setDocuments(docs);
      setDocumentId((current) => {
        if (docs.some((d) => d.id === current && d.status === 'READY')) return current;
        return docs.find((d) => d.status === 'READY')?.id || '';
      });
    } catch {
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    if (roomId) void loadDocuments(roomId);
  }, [roomId, loadDocuments]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  /* ── upload + poll until the PDF is READY ─────────────────── */
  const handleUpload = async (file: File) => {
    if (!roomId) {
      toast.error('Select a room first.');
      return;
    }
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files can be uploaded.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDFs must be smaller than 10 MB.');
      return;
    }

    setUploading(true);
    try {
      const doc = await uploadDocument(roomId, file);
      setDocuments((prev) => [doc, ...prev]);
      toast.toast(`Uploaded ${doc.fileName}. Extracting text…`, 'info');

      // Generation needs extracted text, so wait for READY before continuing.
      setPolling(true);
      let attempts = 0;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const latest = await getDocument(doc.id);
          setDocuments((prev) => prev.map((d) => (d.id === latest.id ? { ...d, ...latest } : d)));
          if (latest.status === 'READY') {
            if (pollRef.current) clearInterval(pollRef.current);
            setPolling(false);
            setDocumentId(latest.id);
            if (!title) setTitle(latest.fileName.replace(/\.pdf$/i, ''));
            toast.success('Text extracted — ready to generate questions.');
          } else if (latest.status === 'FAILED' || attempts > 40) {
            if (pollRef.current) clearInterval(pollRef.current);
            setPolling(false);
            toast.error(latest.error || 'Could not read this PDF. Try a text-based PDF.');
          }
        } catch {
          if (attempts > 40 && pollRef.current) {
            clearInterval(pollRef.current);
            setPolling(false);
          }
        }
      }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  /* ── generate ─────────────────────────────────────────────── */
  const handleGenerate = async () => {
    if (!roomId || !documentId) {
      toast.error('Choose a room and a processed PDF first.');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the test a title.');
      return;
    }
    setGenerating(true);
    try {
      const generated = await generateAITest({
        roomId,
        documentId,
        title: title.trim(),
        topic: topic.trim() || undefined,
        duration,
        questionCount,
        difficulty,
      });
      setTest(generated);
      setStep('review');
      toast.success(`Drafted ${generated.questions.length} questions. Review before publishing.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The AI could not generate questions.');
    } finally {
      setGenerating(false);
    }
  };

  /* ── review actions ───────────────────────────────────────── */
  const handleDeleteQuestion = async (questionId: string) => {
    if (!test) return;
    try {
      await deleteQuestion(test.id, questionId);
      setTest({ ...test, questions: test.questions.filter((q) => q.id !== questionId) });
      toast.toast('Question removed.', 'info');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the question.');
    }
  };

  const handleSaveQuestion = async (
    questionId: string,
    data: { questionText: string; options: string[]; correctAnswer: number },
  ) => {
    if (!test) return;
    if (data.options.some((o) => !o.trim())) {
      toast.error('All four options are required.');
      return;
    }
    try {
      const updated = await editQuestion(test.id, questionId, data);
      setTest({
        ...test,
        questions: test.questions.map((q) => (q.id === questionId ? { ...q, ...updated } : q)),
      });
      setEditingId(null);
      toast.success('Question updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the question.');
    }
  };

  const handlePublish = async () => {
    if (!test) return;
    setPublishing(true);
    try {
      await publishTest(test.id);
      toast.success('Test published — students in this room can now take it.');
      router.push(`/rooms/${rooms.find((r) => r.id === test.roomId)?.code || ''}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not publish the test.');
    } finally {
      setPublishing(false);
    }
  };

  const selectedRoom = useMemo(() => rooms.find((r) => r.id === roomId) || null, [rooms, roomId]);

  if (!ready) return null;

  if (roomsLoading) {
    return (
      <div className="min-h-screen bg-surface">
        <LoadingState label="Loading your rooms…" />
      </div>
    );
  }

  if (roomsError) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <ErrorState message={roomsError} onRetry={loadRooms} />
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <EmptyState
            icon="meeting_room"
            title="Create a room first"
            description="Tests are always attached to a classroom so you can share them with students."
            action={
              <Link
                href="/rooms/create"
                className="inline-flex h-10 px-4 items-center rounded-lg bg-primary text-on-primary font-headline-sm text-[14px]"
              >
                Create a room
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      <TopBar
        title="Create a test"
        subtitle={`Step ${step === 'source' ? 1 : step === 'configure' ? 2 : 3} of 3`}
        backHref="/tests"
      />

      <div className="pt-20 px-gutter-mobile max-w-3xl mx-auto flex flex-col gap-4">
        {/* Stepper */}
        <ol className="flex items-center gap-2 font-label-mono-sm text-label-mono-sm uppercase">
          {[
            { key: 'source', label: 'Upload' },
            { key: 'configure', label: 'Configure' },
            { key: 'review', label: 'Review' },
          ].map((s, index) => {
            const order = ['source', 'configure', 'review'];
            const activeIndex = order.indexOf(step);
            const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo';
            return (
              <li key={s.key} className="flex items-center gap-2 flex-1">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    state === 'done'
                      ? 'bg-tertiary text-on-tertiary'
                      : state === 'active'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {state === 'done' ? '✓' : index + 1}
                </span>
                <span className={state === 'todo' ? 'text-on-surface-variant' : 'text-on-surface'}>{s.label}</span>
                {index < 2 && <span className="flex-1 h-px bg-surface-container-high" />}
              </li>
            );
          })}
        </ol>

        {step === 'source' && (
          <>
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">1. Choose the room</h2>
              <select
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setDocumentId('');
                  setDocuments([]);
                }}
                className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} (#{room.code})
                  </option>
                ))}
              </select>
            </section>

            <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-3">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">2. Upload the study material</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                A text-based PDF up to 10 MB. Scanned images need OCR, which is not supported.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                  e.target.value = '';
                }}
              />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || polling}
                className="w-full rounded-xl border-2 border-dashed border-surface-container-high hover:border-primary/40 hover:bg-primary/5 p-6 flex flex-col items-center gap-2 transition-colors disabled:opacity-60"
              >
                {uploading || polling ? (
                  <span className="material-symbols-outlined text-[28px] text-primary animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[28px] text-primary">upload_file</span>
                )}
                <span className="font-headline-sm text-[14px] text-on-surface">
                  {uploading ? 'Uploading…' : polling ? 'Extracting text…' : 'Select a PDF'}
                </span>
                <span className="font-body-sm text-[12px] text-on-surface-variant">Max 10 MB</span>
              </button>

              {documents.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">
                    Documents in this room
                  </span>
                  {documents.map((doc) => {
                    const selectable = doc.status === 'READY';
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        disabled={!selectable}
                        onClick={() => {
                          setDocumentId(doc.id);
                          if (!title) setTitle(doc.fileName.replace(/\.pdf$/i, ''));
                        }}
                        className={`rounded-lg border p-3 flex items-center gap-3 text-left transition-colors disabled:opacity-60 ${
                          documentId === doc.id
                            ? 'border-primary bg-primary/5'
                            : 'border-surface-container bg-surface-container-low'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0">
                          picture_as_pdf
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-body-md text-body-md text-on-surface truncate">
                            {doc.fileName}
                          </span>
                          <span className="block font-label-mono-sm text-[10px] text-secondary">
                            {doc.chunkCount ? `${doc.chunkCount} chunks` : 'processing'}
                          </span>
                        </span>
                        <StatusPill status={doc.status} />
                      </button>
                    );
                  })}
                </div>
              )}

              {documents.some((d) => d.status === 'FAILED') && (
                <p className="font-body-sm text-body-sm text-error">
                  One of your uploads could not be read. Delete it and try a different PDF.
                </p>
              )}
            </section>

            <button
              type="button"
              onClick={() => setStep('configure')}
              disabled={!documentId}
              className="h-12 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              Continue
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </>
        )}

        {step === 'configure' && (
          <>
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-4">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Test settings</h2>

              <div>
                <label htmlFor="title" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
                  Test title <span className="text-error">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. DBMS Unit 1 — Normalization"
                  className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label htmlFor="topic" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
                  Topic focus <span className="text-outline">(optional)</span>
                </label>
                <input
                  id="topic"
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Normalization and keys"
                  className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="count" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
                    Questions
                  </label>
                  <input
                    id="count"
                    type="number"
                    min={1}
                    max={50}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                    className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label htmlFor="duration" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
                    Duration (minutes)
                  </label>
                  <input
                    id="duration"
                    type="number"
                    min={1}
                    max={180}
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                    className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div>
                <span className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
                  Difficulty
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {['EASY', 'MEDIUM', 'HARD'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficulty(level)}
                      className={`h-10 rounded-lg font-label-mono-sm text-label-mono-sm uppercase transition-colors ${
                        difficulty === level
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <p className="font-body-sm text-[12px] text-on-surface-variant">
                Generating for <strong>{selectedRoom?.name}</strong> from{' '}
                <strong>{documents.find((d) => d.id === documentId)?.fileName}</strong>.
              </p>
            </section>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('source')}
                className="h-12 px-5 rounded-xl bg-surface-container-low text-on-surface font-headline-sm text-[14px]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !title.trim()}
                className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {generating ? (
                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                )}
                {generating ? 'Generating questions…' : 'Generate with AI'}
              </button>
            </div>

            {generating && (
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                Reading your document and drafting {questionCount} questions. This can take up to a minute.
              </p>
            )}
          </>
        )}

        {step === 'review' && test && (
          <>
            <section className="rounded-xl bg-surface-container-lowest border border-surface-container p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-headline-md text-headline-md text-on-surface truncate">{test.title}</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {test.questions.length} questions • {test.duration} min • {selectedRoom?.name}
                  </p>
                </div>
                <StatusPill status="DRAFT" />
              </div>
              <p className="font-body-sm text-[12px] text-on-surface-variant bg-surface-container-low rounded-lg p-3">
                AI never publishes for you. Check every question and answer key, edit or delete anything wrong, then
                publish.
              </p>
            </section>

            <section className="flex flex-col gap-3">
              {test.questions.map((question, index) => (
                <ReviewQuestion
                  key={question.id}
                  index={index}
                  question={question}
                  editing={editingId === question.id}
                  onEdit={() => setEditingId(question.id)}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => handleDeleteQuestion(question.id)}
                  onSave={(data) => handleSaveQuestion(question.id, data)}
                />
              ))}
            </section>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('configure')}
                className="h-12 px-5 rounded-xl bg-surface-container-low text-on-surface font-headline-sm text-[14px]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing || test.questions.length === 0}
                className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {publishing && (
                  <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                )}
                {publishing ? 'Publishing…' : `Publish ${test.questions.length} questions`}
              </button>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function ReviewQuestion({
  index,
  question,
  editing,
  onEdit,
  onCancel,
  onDelete,
  onSave,
}: {
  index: number;
  question: { id: string; questionText: string; options: string[]; correctAnswer?: number; difficulty?: string | null };
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onSave: (data: { questionText: string; options: string[]; correctAnswer: number }) => void;
}) {
  const [text, setText] = useState(question.questionText);
  const [options, setOptions] = useState<string[]>(question.options);
  const [correct, setCorrect] = useState(question.correctAnswer ?? 0);

  useEffect(() => {
    setText(question.questionText);
    setOptions(question.options);
    setCorrect(question.correctAnswer ?? 0);
  }, [question]);

  return (
    <article className="rounded-xl bg-surface-container-lowest border border-surface-container p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <span className="font-label-mono-sm text-label-mono-sm text-secondary shrink-0">Q{index + 1}</span>
        {editing ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="font-label-mono-sm text-label-mono-sm uppercase text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave({ questionText: text, options, correctAnswer: correct })}
              className="font-label-mono-sm text-label-mono-sm uppercase text-primary"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit question"
              className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete question"
              className="w-8 h-8 rounded-md flex items-center justify-center text-on-surface-variant hover:text-error"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCorrect(optionIndex)}
                aria-label={`Mark option ${OPTION_LABELS[optionIndex]} as correct`}
                className={`w-8 h-8 shrink-0 rounded-full font-label-mono-sm text-label-mono-sm font-bold ${
                  correct === optionIndex ? 'bg-tertiary text-on-tertiary' : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {OPTION_LABELS[optionIndex]}
              </button>
              <input
                type="text"
                value={option}
                onChange={(e) => setOptions(options.map((o, i) => (i === optionIndex ? e.target.value : o)))}
                className="flex-1 h-10 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="font-body-md text-body-md text-on-surface">{question.questionText}</p>
          <ul className="flex flex-col gap-1.5">
            {question.options.map((option, optionIndex) => (
              <li
                key={optionIndex}
                className={`rounded-lg px-3 py-2 flex items-center gap-2 font-body-sm text-body-sm ${
                  question.correctAnswer === optionIndex
                    ? 'bg-tertiary-container/20 text-on-surface font-medium'
                    : 'bg-surface-container-low text-on-surface-variant'
                }`}
              >
                <span className="font-label-mono-sm text-label-mono-sm w-4 shrink-0">{OPTION_LABELS[optionIndex]}</span>
                <span className="flex-1">{option}</span>
                {question.correctAnswer === optionIndex && (
                  <span className="font-label-mono-sm text-[10px] uppercase text-tertiary shrink-0">answer key</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
