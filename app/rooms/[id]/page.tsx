import RoomDetailClient from './RoomDetailClient';

export const metadata = {
  title: 'Room — ClassRank',
};

/**
 * The room segment is the human-readable 6-character room code (that is what
 * the QR code and share link use), resolved to a room id by the client.
 */
export default function RoomPage({ params }: { params: { id: string } }) {
  return <RoomDetailClient roomCode={params.id} />;
}
