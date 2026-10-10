import { Suspense } from 'react';
import CreateTestClient from './CreateTestClient';
import { LoadingState } from '@/components/States';

export const metadata = {
  title: 'Create a test — ClassRank',
};

export default function CreateTestPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface">
          <LoadingState label="Loading…" />
        </div>
      }
    >
      <CreateTestClient />
    </Suspense>
  );
}
