import PublicProfileClient from './PublicProfileClient';

export const metadata = {
  title: 'Student profile — ClassRank',
};

export default function PublicProfilePage({ params }: { params: { id: string } }) {
  return <PublicProfileClient userId={params.id} />;
}
