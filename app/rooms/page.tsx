"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RoomsList() {
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    import('../../lib/api').then(({ getRooms }) => {
      getRooms().then((data) => {
        setRooms(data.map((r: any) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          instructor: r.teacher?.fullname || 'Instructor',
          status: 'Active', // Can be computed based on tests
          cohortCount: r._count?.members || 0,
          passingRate: 85, // Mock for now
          liveExams: r._count?.tests || 0
        })));
      }).catch(console.error);
    });
  }, []);

  const handleJoin = async () => {
    if (!roomCode) return;
    try {
      const { joinRoom } = await import('../../lib/api');
      await joinRoom(roomCode);
      // reload rooms
      window.location.reload();
    } catch (e) {
      alert("Failed to join room. Maybe code is invalid or you already joined.");
    }
  };

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-40 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-gutter-mobile flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[18px]">meeting_room</span>
            </div>
            <h1 className="font-headline-sm text-headline-sm text-on-surface">My Classrooms</h1>
          </div>
          <button 
            onClick={() => router.push('/rooms/create')}
            className="p-2 text-primary hover:text-primary-container rounded-lg bg-primary/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
      </header>

      <div className="pt-20 px-margin-mobile flex flex-col gap-space-md">
        
        {/* Join Room Action Area */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Join a Classroom</h2>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">vpn_key</span>
              <input 
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                maxLength={6}
                placeholder="Enter 6-digit Room Code" 
                className="w-full h-12 pl-10 pr-24 bg-surface-container-low border border-surface-container-high rounded-lg font-stat-mono-lg text-[16px] tracking-widest uppercase focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors placeholder:normal-case placeholder:tracking-normal placeholder:font-body-sm placeholder:text-outline"
              />
              <button 
                onClick={handleJoin}
                className="absolute right-1.5 h-9 px-4 bg-primary text-on-primary rounded-md font-label-mono-sm text-label-mono-sm font-semibold tracking-wide uppercase shadow-sm hover:bg-primary-container transition-colors active:scale-95"
              >
                Join
              </button>
            </div>
            
            <div className="relative flex items-center justify-center py-1">
              <div className="absolute inset-x-0 h-[1px] bg-surface-container-high"></div>
              <span className="relative px-3 bg-surface-container-lowest font-label-mono-sm text-[10px] text-secondary uppercase tracking-wider">or</span>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex-1 h-10 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-body-sm text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors border border-surface-container-high">
                <span className="material-symbols-outlined text-[16px] text-tertiary">qr_code_scanner</span>
                Scan / Upload QR
              </button>
              <button className="flex-1 h-10 bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg font-body-sm text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors border border-surface-container-high">
                <span className="material-symbols-outlined text-[16px] text-primary">link</span>
                Paste URL
              </button>
            </div>
          </div>
        </div>

        {/* Existing Enrolled Rooms Header */}
        <div className="flex items-center justify-between mt-2">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Enrolled Classrooms</h2>
          <button className="text-secondary hover:text-primary transition-colors flex items-center gap-1 font-label-mono-sm text-[10px] uppercase font-semibold">
            <span className="material-symbols-outlined text-[14px]">tune</span> Filter
          </button>
        </div>

        {/* Rooms Grid/List */}
        <div className="flex flex-col gap-space-sm">
          {rooms.map((room) => (
            <Link 
              key={room.id} 
              href={`/rooms/${room.id}`}
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container hover:bg-surface-container-low transition-all active:scale-[0.99] flex flex-col gap-3 group relative overflow-hidden"
            >
              {room.status === 'Active' || room.status === 'Live' ? (
                <div className="absolute top-0 left-0 w-1 h-full bg-primary transition-all group-hover:w-1.5"></div>
              ) : null}
              
              <div className="flex items-start justify-between gap-2 pl-1">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-stat-mono-lg text-[12px] tracking-widest text-secondary font-bold uppercase bg-surface-container px-2 py-0.5 rounded">
                      #{room.code || room.id.substring(0,6)}
                    </span>
                    {room.status === 'Live' && (
                      <span className="flex items-center gap-1 font-label-mono-sm text-[10px] text-tertiary bg-tertiary-container/10 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                        Live Session
                      </span>
                    )}
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface truncate group-hover:text-primary transition-colors">
                    {room.name}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
                    {room.instructor}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                  <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-surface-container-low pl-1">
                <div className="flex flex-col">
                  <span className="font-label-mono-sm text-[10px] uppercase text-secondary">Cohort</span>
                  <span className="font-stat-mono-lg text-[14px] text-on-surface mt-0.5">{room.cohortCount}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-mono-sm text-[10px] uppercase text-secondary">Pass Rate</span>
                  <span className="font-stat-mono-lg text-[14px] text-on-surface mt-0.5">{room.passingRate}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label-mono-sm text-[10px] uppercase text-secondary">Active Exams</span>
                  <span className={`font-stat-mono-lg text-[14px] mt-0.5 ${room.liveExams > 0 ? 'text-tertiary font-bold' : 'text-on-surface'}`}>{room.liveExams}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
