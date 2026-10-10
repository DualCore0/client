import DetailsClient from './DetailsClient';

export const metadata = {
  title: 'Attempt details — ClassRank',
};

export default function AttemptDetailsPage({ params }: { params: { id: string } }) {
  return <DetailsClient testId={params.id} />;
}
