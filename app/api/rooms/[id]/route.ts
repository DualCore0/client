import { NextResponse } from 'next/server';
import { mockRoom } from '@/lib/mock-data';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Fake delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (params.id === mockRoom.id) {
    return NextResponse.json(mockRoom);
  }

  return NextResponse.json({ error: 'Room not found' }, { status: 404 });
}
