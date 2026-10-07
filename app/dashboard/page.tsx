"use client";

import { useState , useEffect} from "react";
import { BottomNav } from "@/components/BottomNav";

import Link from "next/link";

export default function Dashboard() {
  const [activeView, setActiveView] = useState("upcoming");
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  
  useEffect(() => {
    import('../../lib/api').then(({ getRooms, getSubmissions }) => {
      Promise.all([getRooms(), getSubmissions()]).then(([rooms, submissions]) => {
        // Map backend data to frontend expected shapes
        setUpcoming(rooms.flatMap((r: any) => (r.tests || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          roomName: r.name,
          roomId: r.id,
          date: new Date(t.createdAt).toLocaleDateString(),
          time: new Date(t.createdAt).toLocaleTimeString(),
          duration: t.duration ? `${t.duration} min` : 'Untimed',
          details: t.topic || 'General Assessment'
        }))));
        setCompleted(submissions.map((s: any) => ({
          id: s.id,
          title: s.test?.title || 'Assessment',
          room: s.test?.room?.name || 'Classroom',
          date: new Date(s.startTime).toLocaleDateString(),
          score: `${s.result?.score || 0}/${s.result?.maxScore || 100}`,
          percentile: 90, // mock percentile
          passRate: 85,
          failRate: 15,
          topScorer: 'N/A'
        })));
      }).catch(console.error);
    });
  }, []);

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-40 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-gutter-mobile flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-primary font-semibold tracking-wide">
              Overview
            </span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface leading-tight">Global Dashboard</h1>
          </div>
          <button className="relative p-2 text-on-surface-variant hover:text-on-surface rounded-lg bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-surface"></span>
          </button>
        </div>
      </header>

      <div className="pt-20 px-margin-mobile flex flex-col gap-space-md">
        
        {/* Welcome Section */}
        <div className="flex flex-col gap-1">
          <h2 className="font-headline-md text-headline-md text-on-surface">Welcome back, Jordan!</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Here is your academic assessment schedule.</p>
        </div>

        {/* Global Stats / Tabs */}
        <div className="grid grid-cols-2 gap-space-2xs">
          <button 
            onClick={() => setActiveView('upcoming')}
            className={`text-left p-space-sm rounded-xl shadow-sm border transition-all flex flex-col ${activeView === 'upcoming' ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container-low'}`}
          >
            <span className={`font-label-mono-sm text-label-mono-sm uppercase flex items-center gap-1 ${activeView === 'upcoming' ? 'text-primary' : 'text-secondary'}`}>
              <span className="material-symbols-outlined text-[14px]">event_note</span> Upcoming
            </span>
            <span className={`font-stat-mono-lg text-stat-mono-lg mt-1 ${activeView === 'upcoming' ? 'text-primary' : 'text-on-surface'}`}>
              {upcoming.length} <span className="text-sm font-body-sm text-on-surface-variant font-medium">Exams</span>
            </span>
          </button>
          
          <button 
            onClick={() => setActiveView('completed')}
            className={`text-left p-space-sm rounded-xl shadow-sm border transition-all flex flex-col ${activeView === 'completed' ? 'bg-primary/5 border-primary/20' : 'bg-surface-container-lowest border-surface-container hover:bg-surface-container-low'}`}
          >
            <span className={`font-label-mono-sm text-label-mono-sm uppercase flex items-center gap-1 ${activeView === 'completed' ? 'text-primary' : 'text-secondary'}`}>
              <span className="material-symbols-outlined text-[14px]">assignment_turned_in</span> Completed
            </span>
            <span className={`font-stat-mono-lg text-stat-mono-lg mt-1 ${activeView === 'completed' ? 'text-primary' : 'text-on-surface'}`}>
              {completed.length} <span className="text-sm font-body-sm text-on-surface-variant font-medium">Exams</span>
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-col gap-space-xs mt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              {activeView === 'upcoming' ? 'Upcoming Assessments' : 'Completed Assessments'}
            </h2>
          </div>

          <div className="flex flex-col gap-space-sm">
            {activeView === 'upcoming' && upcoming.map((exam) => (
              <div key={exam.id} className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container overflow-hidden animate-in fade-in duration-300">
                <div className="p-space-md flex flex-col gap-space-xs relative">
                  <div className="absolute top-0 left-0 bottom-0 w-1 bg-tertiary"></div>
                  
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-mono-sm text-label-mono-sm text-tertiary font-semibold uppercase tracking-wide bg-tertiary-container/10 px-2 py-0.5 rounded self-start mb-1">
                        {exam.date} • {exam.time}
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">{exam.title}</h3>
                      <Link href={`/rooms/${exam.roomId}`} className="font-body-sm text-[13px] text-secondary hover:text-primary transition-colors flex items-center gap-1 mt-0.5 truncate">
                        <span className="material-symbols-outlined text-[14px]">meeting_room</span>
                        {exam.roomName}
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-1 pt-3 border-t border-surface-container-low">
                    <div className="flex items-center gap-1 font-label-mono-sm text-label-mono-sm text-on-surface-variant">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {exam.duration}
                    </div>
                    <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                    <div className="font-label-mono-sm text-label-mono-sm text-on-surface-variant truncate">
                      {exam.details}
                    </div>
                  </div>
                  <Link href={`/tests/${exam.id}`} className="mt-4 w-full h-11 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-[14px] font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]">
                    <span>Take Assessment</span>
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  </Link>
                </div>
              </div>
            ))}

            {activeView === 'completed' && completed.map((test) => (
              <div key={test.id} className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container overflow-hidden animate-in fade-in duration-300 flex flex-col">
                <div className="p-space-md flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-mono-sm text-[10px] text-secondary uppercase tracking-wider mb-1">
                        {test.date}
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                        {test.title}
                      </h3>
                      <p className="font-body-sm text-[13px] text-on-surface-variant truncate mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">meeting_room</span>
                        {test.room}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-stat-mono-lg text-[18px] text-primary leading-tight">{test.score}</span>
                      <span className="font-label-mono-sm text-[10px] text-tertiary font-bold">{test.percentile} PRCTL</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-surface-container-low">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-label-mono-sm text-[10px] uppercase text-secondary">Pass Rate</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                          <div className="bg-tertiary h-full rounded-full" style={{ width: `${test.passRate}%` }}></div>
                        </div>
                        <span className="font-stat-mono-lg text-[13px] text-tertiary leading-none">{test.passRate}%</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 pl-2 border-l border-surface-container-low">
                      <span className="font-label-mono-sm text-[10px] uppercase text-secondary">Fail Rate</span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                          <div className="bg-error h-full rounded-full" style={{ width: `${test.failRate}%` }}></div>
                        </div>
                        <span className="font-stat-mono-lg text-[13px] text-error leading-none">{test.failRate}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 p-2.5 bg-surface-container-low rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
                      </div>
                      <span className="font-label-mono-sm text-[11px] uppercase text-secondary font-medium">Top Scorer</span>
                    </div>
                    <span className="font-body-sm text-[13px] font-bold text-on-surface">{test.topScorer}</span>
                  </div>
                </div>
              </div>
            ))}

            {activeView === 'upcoming' && upcoming.length === 0 && (
              <div className="bg-surface-container-lowest rounded-xl p-8 shadow-sm border border-surface-container text-center flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-surface-container-low text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">event_available</span>
                </div>
                <p className="font-body-md text-body-md text-on-surface font-medium mt-2">No upcoming exams</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">You are all caught up!</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
