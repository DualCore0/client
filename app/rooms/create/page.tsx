'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom } from '@/lib/api';
import { useRequireAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/ToastProvider';

export default function CreateRoomPage() {
  const router = useRouter();
  const toast = useToast();
  const { ready } = useRequireAuth('TEACHER');

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ code: string; name: string } | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error('Give the room a name.');
      return;
    }
    setSaving(true);
    try {
      const room = await createRoom({
        name: name.trim(),
        subject: subject.trim() || undefined,
        description: description.trim() || undefined,
      });
      setCreated({ code: room.code, name: room.name });
      toast.success(`Room created with code ${room.code}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the room.');
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  if (created) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-surface-container-lowest border border-surface-container p-6 flex flex-col gap-4 text-center">
          <span className="material-symbols-outlined text-[40px] text-tertiary mx-auto">check_circle</span>
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">{created.name} is ready</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Share this code, QR or link with your students.
            </p>
          </div>
          <div className="rounded-lg bg-surface-container-low py-4">
            <span className="font-stat-mono-lg text-[28px] tracking-[0.35em] text-primary">{created.code}</span>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/rooms/${created.code}`)}
            className="h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm"
          >
            Open room dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setName('');
              setSubject('');
              setDescription('');
            }}
            className="h-11 rounded-lg bg-surface-container-low text-on-surface font-headline-sm text-[14px]"
          >
            Create another room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-surface-container-lowest border border-surface-container overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-surface-container-high">
          <span className="inline-block px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-mono-sm text-label-mono-sm uppercase">
            Teacher console
          </span>
          <h1 className="font-headline-md text-headline-md text-on-surface mt-2">Create a new room</h1>
          <p className="font-body-sm text-body-sm text-secondary mt-0.5">
            A unique 6-character code and QR will be generated automatically.
          </p>
        </div>

        <form onSubmit={handleCreate} className="p-5 flex flex-col gap-4">
          <div>
            <label htmlFor="roomName" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
              Room name <span className="text-error">*</span>
            </label>
            <input
              id="roomName"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BCA 5th Semester - DBMS"
              className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label htmlFor="subject" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
              Subject
            </label>
            <input
              id="subject"
              type="text"
              maxLength={100}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Database Management Systems"
              className="w-full h-11 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label htmlFor="description" className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary mb-1.5">
              Description <span className="text-outline">(optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Syllabus coverage or schedule notes…"
              className="w-full p-3 rounded-lg bg-surface-container-low text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 h-11 rounded-lg bg-surface-container text-on-surface font-headline-sm text-headline-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] h-11 rounded-lg bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {saving && <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>}
              {saving ? 'Creating…' : 'Create room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
