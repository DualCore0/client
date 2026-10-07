"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { getGlobalWeeklyLeaderboard } from "@/lib/api";

interface LeaderEntry {
  rank: number;
  studentId: string;
  name: string;
  globalScore: number;
  avgPercentage: number;
  accuracy: number;
  testsCompleted: number;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getGlobalWeeklyLeaderboard()
      .then((data) => setLeaderboard(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <div className="flex-1 w-full bg-surface pb-24 min-h-screen">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-40 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-gutter-mobile flex items-center justify-between">
          <h1 className="font-headline-sm text-headline-sm text-on-surface">Global Weekly Leaderboard</h1>
          <span className="font-label-mono-sm text-label-mono-sm text-tertiary bg-tertiary-container/10 px-2 py-1 rounded-full">
            {weekLabel}
          </span>
        </div>
      </header>

      <div className="pt-20 px-margin-mobile flex flex-col gap-space-md">
        
        {/* Info Card */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-label-mono-sm text-label-mono-sm text-primary uppercase tracking-wide font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">public</span>
              Global Rankings
            </span>
            <span className="flex items-center gap-1 font-label-mono-sm text-label-mono-sm text-tertiary bg-tertiary-container/10 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
              Live
            </span>
          </div>
          <h2 className="font-headline-md text-headline-md text-on-surface leading-tight">
            Weekly Performance Rankings
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Score = 70% Avg Score + 20% Accuracy + 10% Participation. Minimum 3 tests per week to qualify.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-error-container text-on-error-container text-sm flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {!loading && !error && leaderboard.length === 0 && (
          <div className="bg-surface-container-lowest rounded-xl p-10 shadow-sm border border-surface-container text-center flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-surface-container-low text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">leaderboard</span>
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">No Rankings Yet</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs">
              Students need to complete at least 3 tests this week to appear on the global leaderboard.
            </p>
          </div>
        )}

        {!loading && leaderboard.length >= 3 && (
          <>
            {/* Podium (Top 3) */}
            <div className="grid grid-cols-3 gap-2 mt-2 items-end">
              {/* Rank 2 */}
              <div className="bg-surface-container-lowest p-3 rounded-t-xl border-x border-t border-surface-container shadow-sm flex flex-col items-center text-center gap-1 pb-4 order-1 h-[140px] justify-end relative">
                <div className="absolute top-2 left-2 font-stat-mono-lg text-secondary text-sm font-bold opacity-50">#02</div>
                <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-bold font-label-mono-sm">
                  {getInitials(leaderboard[1].name)}
                </div>
                <span className="font-body-sm text-[12px] font-semibold text-on-surface leading-tight mt-1 line-clamp-1">{leaderboard[1].name}</span>
                <span className="font-stat-mono-lg text-lg text-on-surface">{leaderboard[1].globalScore}</span>
                <span className="font-label-mono-sm text-[10px] text-secondary">{leaderboard[1].testsCompleted} tests</span>
              </div>

              {/* Rank 1 */}
              <div className="bg-primary/5 p-3 rounded-t-xl border-x border-t border-primary/20 shadow-md flex flex-col items-center text-center gap-1 pb-6 order-2 h-[160px] justify-end relative">
                <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 w-6 h-6 bg-primary rounded-full text-on-primary flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-[14px]">military_tech</span>
                </div>
                <div className="absolute top-2 left-2 font-stat-mono-lg text-primary text-sm font-bold opacity-80">#01</div>
                <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold font-label-mono-sm ring-4 ring-primary/10">
                  {getInitials(leaderboard[0].name)}
                </div>
                <span className="font-body-sm text-[13px] font-semibold text-primary leading-tight mt-1 line-clamp-1">{leaderboard[0].name}</span>
                <span className="font-stat-mono-lg text-xl text-primary">{leaderboard[0].globalScore}</span>
                <span className="font-label-mono-sm text-[10px] text-primary/70">{leaderboard[0].testsCompleted} tests</span>
              </div>

              {/* Rank 3 */}
              <div className="bg-surface-container-lowest p-3 rounded-t-xl border-x border-t border-surface-container shadow-sm flex flex-col items-center text-center gap-1 pb-2 order-3 h-[120px] justify-end relative">
                <div className="absolute top-2 left-2 font-stat-mono-lg text-secondary text-sm font-bold opacity-50">#03</div>
                <div className="w-10 h-10 rounded-full bg-surface-container-high text-secondary flex items-center justify-center font-bold font-label-mono-sm">
                  {getInitials(leaderboard[2].name)}
                </div>
                <span className="font-body-sm text-[12px] font-semibold text-secondary leading-tight mt-1 line-clamp-1">{leaderboard[2].name}</span>
                <span className="font-stat-mono-lg text-lg text-secondary">{leaderboard[2].globalScore}</span>
                <span className="font-label-mono-sm text-[10px] text-secondary">{leaderboard[2].testsCompleted} tests</span>
              </div>
            </div>

            {/* Full Table */}
            {leaderboard.length > 3 && (
              <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-surface-container flex flex-col -mt-2 relative z-10">
                <div className="grid grid-cols-12 px-space-sm py-2.5 bg-surface-container-low font-label-mono-sm text-[10px] uppercase text-on-surface-variant font-medium tracking-wider">
                  <span className="col-span-2 text-center">Rank</span>
                  <span className="col-span-4">Student</span>
                  <span className="col-span-2 text-right">Avg %</span>
                  <span className="col-span-2 text-right">Acc %</span>
                  <span className="col-span-2 text-right">Score</span>
                </div>
                
                <div className="flex flex-col divide-y divide-surface-container">
                  {leaderboard.slice(3).map((entry) => (
                    <div key={entry.studentId} className="grid grid-cols-12 px-space-sm py-3 items-center hover:bg-surface-container-low/50 transition-colors">
                      <div className="col-span-2 flex items-center justify-center">
                        <span className="font-stat-mono-lg text-[15px] leading-none text-secondary font-semibold">
                          {String(entry.rank).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="col-span-4 flex items-center gap-2 min-w-0 pr-1">
                        <span className="font-body-sm text-[13px] font-semibold text-on-surface truncate">{entry.name}</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-stat-mono-lg text-[13px] text-tertiary">{entry.avgPercentage}%</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-stat-mono-lg text-[13px] text-secondary">{entry.accuracy}%</span>
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="font-stat-mono-lg text-[15px] text-on-surface font-semibold">{entry.globalScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && leaderboard.length > 0 && leaderboard.length < 3 && (
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-surface-container">
            <div className="grid grid-cols-12 px-space-sm py-2.5 bg-surface-container-low font-label-mono-sm text-[10px] uppercase text-on-surface-variant font-medium tracking-wider">
              <span className="col-span-2 text-center">Rank</span>
              <span className="col-span-4">Student</span>
              <span className="col-span-2 text-right">Avg %</span>
              <span className="col-span-2 text-right">Acc %</span>
              <span className="col-span-2 text-right">Score</span>
            </div>
            <div className="flex flex-col divide-y divide-surface-container">
              {leaderboard.map((entry) => (
                <div key={entry.studentId} className="grid grid-cols-12 px-space-sm py-3 items-center">
                  <div className="col-span-2 text-center font-stat-mono-lg text-[15px] text-primary font-semibold">
                    {String(entry.rank).padStart(2, '0')}
                  </div>
                  <div className="col-span-4 font-body-sm text-[13px] font-semibold text-on-surface truncate">{entry.name}</div>
                  <div className="col-span-2 text-right font-stat-mono-lg text-[13px] text-tertiary">{entry.avgPercentage}%</div>
                  <div className="col-span-2 text-right font-stat-mono-lg text-[13px] text-secondary">{entry.accuracy}%</div>
                  <div className="col-span-2 text-right font-stat-mono-lg text-[15px] text-on-surface font-semibold">{entry.globalScore}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
