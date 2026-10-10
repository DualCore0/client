import { Suspense } from 'react';
import ResultClient from './ResultClient';
import { LoadingState } from '@/components/States';

export const metadata = {
  title: 'Result — ClassRank',
};

export default function TestResultPage({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface">
          <LoadingState label="Calculating your result…" />
        </div>
      }
    >
      <ResultClient testId={params.id} />
    </Suspense>
  );
}