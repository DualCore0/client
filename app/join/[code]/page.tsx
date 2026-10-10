import JoinClient from '../JoinClient';

export const metadata = {
  title: 'Join a room — ClassRank',
};

export default function JoinByCodePage({ params }: { params: { code: string } }) {
  return <JoinClient initialCode={params.code} />;
}
