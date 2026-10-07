"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { mockRoom, mockActiveTests, mockLeaderboard } from "@/lib/mock-data";
import { BottomNav } from "@/components/BottomNav";

export default function RoomDashboard() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<typeof mockRoom | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const fetchRoom = async () => {
      setLoading(true);
      try {
        const { getRoomDetails } = await import('../../../lib/api');
        const data = await getRoomDetails(params.id as string);
        setRoom({
          id: data.id,
          code: data.code,
          name: data.name,
          subject: 'General Subject',
          term: 'Current Term',
          instructor: data.teacher?.fullname || 'Instructor',
          cohortCount: data.members?.length || 0,
          tests: data.tests?.length || 0,
          liveExams: data.tests?.length || 0,
          avgAccuracy: 0,
          passingRate: 0,
          testsData: data.tests || [],
          membersData: data.members || []
        } as any);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchRoom();
  }, [params.id]);

  if (loading || !room) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div className="px-margin-mobile pt-space-xs pb-space-lg flex flex-col gap-space-md">
        
        {/* Header Card */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
          <div className="flex items-start justify-between gap-space-xs">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-space-2xs mb-1">
                <span className="bg-secondary-container text-on-secondary-container font-label-mono-sm text-label-mono-sm uppercase px-2 py-0.5 rounded-full font-medium">{room.term}</span>
                <span className="bg-surface-container-high text-primary font-label-mono-sm text-label-mono-sm uppercase px-2 py-0.5 rounded-full font-semibold">Active Room</span>
              </div>
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight truncate">{room.name}</h1>
              <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                <span>{room.subject}</span>
                <span className="inline-block w-1 h-1 rounded-full bg-outline-variant"></span>
                <span className="font-label-mono text-label-mono text-primary font-semibold">ID: {room.id}</span>
              </p>
            </div>
            <button aria-label="Room Settings" className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors" onClick={() => setShowShareModal(true)}>
              <span className="material-symbols-outlined text-[20px]">more_vert</span>
            </button>
          </div>
          <div className="flex items-center gap-space-2xs pt-1">
            <button className="flex-1 h-10 px-space-xs bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-body-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]" onClick={() => setShowShareModal(true)}>
              <span className="material-symbols-outlined text-[18px] text-primary">share</span>
              <span>Share Room</span>
            </button>
            <button className="h-10 px-space-sm bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-body-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]" onClick={() => setShowShareModal(true)}>
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
              <span>QR</span>
            </button>
            <button 
              className="flex-1 h-10 px-space-sm bg-primary hover:bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
              onClick={() => router.push(`/tests/create?roomId=${room.id}`)}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Create Test</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-surface-container-low p-1 rounded-xl flex items-center">
          <button className="flex-1 py-2 text-center rounded-lg bg-surface-container-lowest text-primary font-body-sm text-body-sm font-semibold shadow-sm transition-all">Overview</button>
          <button className="flex-1 py-2 text-center rounded-lg text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm font-medium transition-all">Tests ({room.tests})</button>
          <button className="flex-1 py-2 text-center rounded-lg text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm font-medium transition-all">Students ({room.cohortCount})</button>
          <button className="flex-1 py-2 text-center rounded-lg text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm font-medium transition-all">Ranks</button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-space-2xs">
          <div className="bg-surface-container-lowest p-space-sm rounded-xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-mono-sm text-label-mono-sm uppercase text-on-surface-variant">Enrolled</span>
              <span className="material-symbols-outlined text-secondary text-[18px]">group</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-stat-mono-lg text-stat-mono-lg text-on-surface">{room.cohortCount}</span>
              <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">Active</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-sm rounded-xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-mono-sm text-label-mono-sm uppercase text-on-surface-variant">Total Tests</span>
              <span className="material-symbols-outlined text-secondary text-[18px]">assignment_turned_in</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-stat-mono-lg text-stat-mono-lg text-on-surface">{room.tests}</span>
              <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">Assigned</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-sm rounded-xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-mono-sm text-label-mono-sm uppercase text-on-surface-variant">Avg. Accuracy</span>
              <span className="material-symbols-outlined text-tertiary text-[18px]">query_stats</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-stat-mono-lg text-stat-mono-lg text-on-surface">{room.avgAccuracy}%</span>
              <span className="font-label-mono-sm text-label-mono-sm text-tertiary flex items-center font-medium">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +3.2%
              </span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-sm rounded-xl flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-label-mono-sm text-label-mono-sm uppercase text-on-surface-variant">Live Exams</span>
              <div className="flex items-center gap-1 bg-surface-container px-1.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-tertiary-container animate-ping"></span>
                <span className="font-label-mono-sm text-label-mono-sm text-tertiary font-semibold">LIVE</span>
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-stat-mono-lg text-stat-mono-lg text-primary">{room.liveExams}</span>
              <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">Active now</span>
            </div>
          </div>
        </div>

        {/* Active Tests */}
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Active Tests</h2>
              <span className="bg-primary-fixed text-on-primary-fixed font-label-mono-sm text-label-mono-sm px-1.5 py-0.5 rounded-full font-semibold">{mockActiveTests.length}</span>
            </div>
            <button className="font-label-mono text-label-mono text-primary font-medium hover:underline">View All</button>
          </div>
          
          {room.testsData && room.testsData.length > 0 ? (
            room.testsData.map((test: any) => (
              <div key={test.id} className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm relative overflow-hidden">
                {/* Fake LIVE indicator for now */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary"></div>
                
                <div className="flex items-start justify-between gap-space-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`font-label-mono-sm text-label-mono-sm px-2 py-0.5 rounded font-semibold uppercase bg-surface-container-high text-primary`}>
                        {test.status || 'Online'}
                      </span>
                      <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">
                        {test.duration ? `${test.duration} min` : 'Untimed'}
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface tracking-tight truncate">{test.title}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{test.topic || 'General Assessment'}</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-1.5 pt-1">
                  <button 
                    onClick={() => router.push(`/tests/${test.id}`)}
                    className="w-full h-9 bg-primary text-on-primary font-body-sm text-body-sm font-semibold rounded-lg flex items-center justify-center gap-1 shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all"
                  >
                    Take Test
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container text-center text-sm text-on-surface-variant">
              No tests created yet.
            </div>
          )}
        </div>

        {/* Recent Submissions Leaderboard */}
        <div className="flex flex-col gap-space-xs mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Recent Submissions</h2>
              <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">Real-time</span>
            </div>
            <button aria-label="Refresh submissions" className="p-1 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">sync</span>
            </button>
          </div>
          
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="grid grid-cols-12 px-space-sm py-2.5 bg-surface-container-low font-label-mono-sm text-label-mono-sm uppercase text-on-surface-variant font-medium">
              <span className="col-span-2">Rank</span>
              <span className="col-span-6">Student</span>
              <span className="col-span-4 text-right">Score</span>
            </div>
            <div className="flex flex-col divide-y divide-surface-container">
              {room.membersData && room.membersData.length > 0 ? (
                room.membersData.map((student: any, i: number) => {
                  const studentData = student.student || student.user || {};
                  return (
                    <div key={studentData.id || i} className="grid grid-cols-12 px-space-sm py-3 items-center hover:bg-surface-container-low/50 transition-colors">
                      <div className="col-span-2 flex items-center">
                        <span className={`font-stat-mono-lg text-[16px] leading-none font-semibold ${i === 0 ? 'text-primary' : i === 1 ? 'text-on-surface' : 'text-secondary'}`}>
                          #{String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="col-span-6 flex items-center gap-2 min-w-0 pr-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-label-mono-sm text-label-mono-sm font-bold flex-shrink-0 ${i === 0 ? 'bg-surface-container-high text-primary' : 'bg-surface-container text-secondary'}`}>
                          {studentData.fullname?.substring(0,2).toUpperCase() || 'U'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-body-sm text-body-sm font-semibold text-on-surface truncate">{studentData.fullname || 'Unknown'}</span>
                          <span className="font-label-mono-sm text-[10px] text-on-surface-variant truncate">ID: {studentData.id || 'N/A'}</span>
                        </div>
                      </div>
                      <div className="col-span-4 flex flex-col items-end">
                        <div className="flex items-center gap-1">
                          <span className={`font-stat-mono-lg text-[16px] leading-none font-semibold ${student.verified ? 'text-tertiary' : 'text-on-surface'}`}>N/A</span>
                        </div>
                        <span className="font-label-mono-sm text-[10px] text-on-surface-variant">Joined</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-sm text-on-surface-variant">No members yet.</div>
              )}
            </div>
            <button className="py-2.5 bg-surface-container-low/50 text-center font-label-mono-sm text-label-mono-sm uppercase text-primary font-semibold hover:bg-surface-container transition-colors w-full">
              Open Full Leaderboard Table
            </button>
          </div>
        </div>

        {/* Proctoring Report Alert */}
        <div className="bg-primary/5 rounded-xl p-space-md flex items-center gap-space-sm mt-1">
          <div className="w-10 h-10 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[24px]">insights</span>
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-body-sm text-body-sm font-semibold text-on-surface">Auto-Proctor Report Ready</span>
            <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">0 flagged events detected in Normalization test.</span>
          </div>
        </div>

      </div>

      {/* Share Modal Backdrop */}
      {showShareModal && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center transition-opacity duration-200" onClick={() => setShowShareModal(false)}>
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-space-md flex flex-col gap-space-md shadow-xl transition-transform duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-primary-fixed text-primary rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">share</span>
                </span>
                <div className="flex flex-col">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Share Room</h3>
                  <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">{room.name}</span>
                </div>
              </div>
              <button aria-label="Close dialog" className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface" onClick={() => setShowShareModal(false)}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            
            <div className="flex flex-col items-center justify-center p-space-md bg-surface-container-low rounded-xl">
              <div className="p-3 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col items-center">
                {/* SVG QR Code */}
                <svg className="w-40 h-40" fill="none" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <rect x="10" y="10" width="24" height="24" rx="3" fill="#0B1C30" />
                  <rect x="14" y="14" width="16" height="16" rx="1" fill="#FFFFFF" />
                  <rect x="18" y="18" width="8" height="8" fill="#143EE4" />
                  <rect x="66" y="10" width="24" height="24" rx="3" fill="#0B1C30" />
                  <rect x="70" y="14" width="16" height="16" rx="1" fill="#FFFFFF" />
                  <rect x="74" y="18" width="8" height="8" fill="#143EE4" />
                  <rect x="10" y="66" width="24" height="24" rx="3" fill="#0B1C30" />
                  <rect x="14" y="70" width="16" height="16" rx="1" fill="#FFFFFF" />
                  <rect x="18" y="74" width="8" height="8" fill="#143EE4" />
                  <rect x="42" y="12" width="6" height="6" fill="#0B1C30" />
                  <rect x="52" y="12" width="6" height="6" fill="#0B1C30" />
                  <rect x="42" y="24" width="6" height="12" fill="#0B1C30" />
                  <rect x="52" y="24" width="6" height="6" fill="#0B1C30" />
                  <rect x="12" y="42" width="6" height="10" fill="#0B1C30" />
                  <rect x="22" y="42" width="12" height="6" fill="#0B1C30" />
                  <rect x="22" y="52" width="6" height="8" fill="#0B1C30" />
                  <rect x="40" y="40" width="8" height="8" fill="#143EE4" />
                  <rect x="52" y="40" width="8" height="8" fill="#0B1C30" />
                  <rect x="40" y="52" width="20" height="6" fill="#0B1C30" />
                  <rect x="66" y="42" width="10" height="6" fill="#0B1C30" />
                  <rect x="80" y="42" width="10" height="10" fill="#0B1C30" />
                  <rect x="66" y="54" width="6" height="6" fill="#0B1C30" />
                  <rect x="76" y="56" width="14" height="6" fill="#0B1C30" />
                  <rect x="42" y="66" width="6" height="12" fill="#0B1C30" />
                  <rect x="52" y="72" width="8" height="6" fill="#0B1C30" />
                  <rect x="42" y="82" width="18" height="8" fill="#0B1C30" />
                  <rect x="66" y="68" width="8" height="8" fill="#0B1C30" />
                  <rect x="78" y="70" width="12" height="6" fill="#0B1C30" />
                  <rect x="70" y="80" width="20" height="8" fill="#0B1C30" />
                </svg>
                <div className="mt-2 flex items-center gap-1 text-on-surface">
                  <span className="material-symbols-outlined text-[14px] text-tertiary">check_circle</span>
                  <span className="font-label-mono-sm text-label-mono-sm tracking-wider uppercase font-semibold">Valid for DBMS Room</span>
                </div>
              </div>
              <button className="mt-space-xs text-on-surface-variant hover:text-primary font-label-mono-sm text-label-mono-sm flex items-center gap-1 font-semibold uppercase">
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>Download High-Res QR</span>
              </button>
            </div>
            
            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase font-medium">Room Passcode ID</label>
              <div className="flex items-center justify-between p-2.5 bg-surface-container rounded-lg">
                <span className="font-stat-mono-lg text-[20px] leading-tight font-bold text-on-surface tracking-widest pl-1">{room.id}</span>
                <button className="h-8 px-space-xs bg-surface-container-lowest text-primary font-label-mono-sm text-label-mono-sm rounded flex items-center gap-1 shadow-sm font-semibold active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-[15px]">content_copy</span>
                  <span>Copy ID</span>
                </button>
              </div>
            </div>
            
            <div className="flex flex-col gap-space-2xs">
              <label className="font-label-mono-sm text-label-mono-sm text-on-surface-variant uppercase font-medium">Invite Link</label>
              <div className="flex items-center justify-between p-2 bg-surface-container rounded-lg gap-2">
                <span className="font-label-mono text-label-mono text-on-surface truncate pl-1">classrank.app/join/{room.id}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button className="h-8 px-space-xs bg-surface-container-lowest text-on-surface font-label-mono-sm text-label-mono-sm rounded flex items-center gap-1 shadow-sm font-medium hover:text-primary active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-[15px]">link</span>
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Insert BottomNav here */}
      <div className="pb-8"></div>
      <BottomNav />
    </div>
  );
}
