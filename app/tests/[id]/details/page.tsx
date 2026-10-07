"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
const mockTestHistory: any[] = [];
import { BottomNav } from "@/components/BottomNav";

export default function TestDetails() {
  const params = useParams();
  const router = useRouter();
  
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import('../../../../lib/api').then(({ getSubmissions }) => {
      getSubmissions().then((data) => {
        const found = data.find((s: any) => s.testId === params.id);
        if (found) {
          setTest({
            id: found.testId,
            date: new Date(found.startTime).toLocaleDateString(),
            title: found.test?.title || 'Assessment',
            room: found.test?.room?.name || 'Classroom',
            score: `${found.result?.score || 0}/${found.result?.maxScore || 100}`,
            percentile: 90, // mock
            passRate: 85, // mock
            failRate: 15, // mock
            topScorer: 'N/A' // mock
          });
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setLoading(false);
      });
    });
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex-1 w-full bg-surface min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex-1 w-full bg-surface min-h-screen flex items-center justify-center">
        <span className="font-body-lg text-on-surface">Test not found</span>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-surface pb-20 min-h-screen">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-40 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-gutter-mobile flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="text-secondary hover:text-on-surface p-1 transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="font-headline-sm text-headline-sm text-on-surface">Assessment Details</h1>
          </div>
          <button className="text-secondary hover:text-primary p-1 transition-colors">
            <span className="material-symbols-outlined">share</span>
          </button>
        </div>
      </header>

      <div className="pt-20 px-margin-mobile flex flex-col gap-space-md">
        
        {/* Main Details Card */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-label-mono-sm text-[10px] text-secondary uppercase tracking-wider">
              {test.date} • {test.room}
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface leading-tight">{test.title}</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-surface-container-low">
            <div className="flex flex-col gap-1">
              <span className="font-label-mono-sm text-[10px] uppercase text-secondary">Your Score</span>
              <div className="flex items-end gap-1">
                <span className="font-stat-mono-lg text-2xl text-primary leading-none">{test.score}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-label-mono-sm text-[10px] uppercase text-secondary">Percentile</span>
              <div className="flex items-end gap-1">
                <span className="font-stat-mono-lg text-2xl text-tertiary leading-none">{test.percentile}</span>
                <span className="font-label-mono-sm text-[10px] text-secondary mb-1">Prctl</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cohort Performance */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container flex flex-col gap-4">
          <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">groups</span>
            Cohort Performance
          </h3>
          
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-label-mono-sm text-[11px] uppercase text-secondary font-medium">Pass Rate</span>
                <span className="font-label-mono-sm text-[11px] text-tertiary font-bold">{test.passRate}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div className="h-full bg-tertiary rounded-full" style={{ width: `${test.passRate}%` }}></div>
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-label-mono-sm text-[11px] uppercase text-secondary font-medium">Fail Rate</span>
                <span className="font-label-mono-sm text-[11px] text-error font-bold">{test.failRate}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div className="h-full bg-error rounded-full" style={{ width: `${test.failRate}%` }}></div>
              </div>
            </div>
          </div>
          
          <div className="mt-2 p-3 bg-tertiary/10 rounded-lg flex items-center justify-between border border-tertiary/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
              <span className="font-body-sm text-[13px] font-medium text-on-surface">Class Top Scorer</span>
            </div>
            <span className="font-stat-mono-lg text-[14px] text-tertiary font-bold">{test.topScorer}</span>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => alert("Reviewing answers is not available for this exam yet.")}
          className="w-full h-12 bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-on-surface rounded-xl font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">visibility</span>
          Review Answers
        </button>

      </div>

      <BottomNav />
    </div>
  );
}
