import RoomLeaderboardClient from './RoomLeaderboardClient';

export const metadata = {
  title: 'Room leaderboard — ClassRank',
};

export default function RoomLeaderboardPage({ params }: { params: { id: string } }) {
  return <RoomLeaderboardClient roomCode={params.id} />;
}
