"use client";

import { useState, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { mockGlobalLeaderboard } from "@/lib/mock-data";
import Link from "next/link";

export default function TestsPage() {
  const [activeTab, setActiveTab] = useState("history"); // 'history' or 'global'
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    import('../../lib/api').then(({ getSubmissions }) => {
      getSubmissions().then((data) => {
        setHistory(data.map((s: any) => ({
          id: s.testId,
          date: new Date(s.startTime).toLocaleDateString(),
          title: s.test?.title || 'Assessment',
          room: s.test?.room?.name || 'Classroom',
          score: `${s.result?.score || 0}/${s.result?.maxScore || 100}`,
          percentile: 90, // mock percentile
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
          <h1 className="font-headline-sm text-headline-sm text-on-surface">Assessments</h1>
          <button className="text-secondary hover:text-on-surface p-2">
            <span className="material-symbols-outlined">search</span>
          </button>
        </div>
      </header>

      <div className="pt-20 px-margin-mobile flex flex-col gap-space-md">
        
        {/* Tabs */}
        <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-center rounded-lg font-body-sm text-body-sm font-semibold transition-all ${activeTab === 'history' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Test History
          </button>
          <button 
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2 text-center rounded-lg font-body-sm text-body-sm font-semibold transition-all flex items-center justify-center gap-1 ${activeTab === 'global' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined text-[16px]">public</span> Global Rank
          </button>
        </div>

        {activeTab === 'history' && (
          <div className="flex flex-col gap-space-sm animate-in fade-in duration-300">
            {history.map((test, index) => (
              <Link href={`/tests/${test.id}/details`} key={test.id + '-' + index} className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container flex flex-col gap-3 hover:bg-surface-container-low transition-colors active:scale-[0.99]">
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
                    <span className="font-stat-mono-lg text-lg text-primary">{test.score}</span>
                    <span className="font-label-mono-sm text-[10px] text-tertiary font-bold">{test.percentile} PRCTL</span>
                  </div>
                </div>

                <div className="mt-1 pt-3 border-t border-surface-container-low flex flex-col gap-1">
                  <span className="font-label-mono-sm text-[10px] uppercase text-secondary">Class Top Scorer</span>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
                    <span className="font-body-sm text-[13px] font-semibold text-on-surface">{test.topScorer}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {activeTab === 'global' && (
          <div className="flex flex-col gap-space-xs animate-in fade-in duration-300">
            <div className="bg-primary/5 rounded-xl p-space-md mb-2 flex items-start gap-3 border border-primary/10">
              <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">public</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline-sm text-headline-sm text-primary">Global University Network</h3>
                <p className="font-body-sm text-[13px] text-on-surface-variant mt-0.5">
                  See how top students across 94+ enrolled universities perform in standardized modules.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-surface-container">
              <div className="grid grid-cols-12 px-space-sm py-2.5 bg-surface-container-low font-label-mono-sm text-[10px] uppercase text-on-surface-variant font-medium tracking-wider">
                <span className="col-span-2 text-center">Rank</span>
                <span className="col-span-7">Student & University</span>
                <span className="col-span-3 text-right pr-2">Avg Score</span>
              </div>
              
              <div className="flex flex-col divide-y divide-surface-container">
                {mockGlobalLeaderboard.map((student) => (
                  <Link href={`/profile/${student.id}`} key={student.rank} className="grid grid-cols-12 px-space-sm py-3 items-center hover:bg-surface-container-low/50 transition-colors active:scale-[0.99] block cursor-pointer">
                    
                    <div className="col-span-2 flex items-center justify-center">
                      {student.rank <= 3 ? (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-stat-mono-lg text-[12px] font-bold shadow-sm ${
                          student.rank === 1 ? 'bg-tertiary text-on-tertiary' : 
                          student.rank === 2 ? 'bg-surface-container-highest text-on-surface' : 
                          'bg-surface-variant text-secondary'
                        }`}>
                          {student.rank}
                        </div>
                      ) : (
                        <span className="font-stat-mono-lg text-[15px] leading-none text-secondary font-semibold">
                          {String(student.rank).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    
                    <div className="col-span-7 flex flex-col min-w-0 pr-1 pl-1">
                      <span className="font-body-sm text-[13px] font-semibold text-on-surface truncate">
                        {student.name}
                      </span>
                      <span className="font-label-mono-sm text-[10px] text-secondary truncate mt-0.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">account_balance</span>
                        {student.university}
                      </span>
                      {student.badges && student.badges.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {student.badges.map(b => (
                            <span key={b} className="text-[9px] font-label-mono-sm uppercase bg-tertiary-container/10 text-tertiary px-1 py-0.5 rounded">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="col-span-3 flex flex-col items-end justify-center pr-2">
                      <span className="font-stat-mono-lg text-[15px] leading-none font-semibold text-primary">
                        {student.score}%
                      </span>
                    </div>

                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      <BottomNav />
    </div>
  );
}
