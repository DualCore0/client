import TestResultsClient from './TestResultsClient';

export const metadata = {
  title: 'Test results — ClassRank',
};

export default function TestResultsPage({ params }: { params: { id: string } }) {
  return <TestResultsClient testId={params.id} />;
}
