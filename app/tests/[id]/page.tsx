import TakeTestClient from './TakeTestClient';

export const metadata = {
  title: 'Take test — ClassRank',
};

export default function TestAttemptPage({ params }: { params: { id: string } }) {
  return <TakeTestClient testId={params.id} />;
}
