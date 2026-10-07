"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { mockLeaderboard } from "@/lib/mock-data";
import { BottomNav } from "@/components/BottomNav";

export default function StudentProfile() {
  const params = useParams();
  const router = useRouter();
  
  const [student, setStudent] = useState<typeof mockLeaderboard[0] | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // Find the student in the mock leaderboard
    const found = mockLeaderboard.find(s => s.id === params.id);
    if (found) {
      setStudent(found);
    } else {
      // Simulate network delay before showing not found
      setTimeout(() => setNotFound(true), 800);
    }
  }, [params.id]);

  if (notFound) {
    return (
      <div className="flex-1 w-full bg-surface pb-20 min-h-screen flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined text-[48px] text-error">person_off</span>
        <h2 className="font-headline-md text-headline-md text-on-surface">Student Not Found</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant text-center max-w-xs">
          The requested academic profile could not be found or you do not have permission to view it.
        </p>
        <button onClick={() => router.back()} className="mt-4 px-6 py-2 bg-primary text-on-primary rounded-lg font-headline-sm text-[14px]">
          Go Back
        </button>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex-1 w-full bg-surface pb-20 min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-surface pb-20 min-h-screen">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-40 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-gutter-mobile flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => router.back()} className="text-secondary hover:text-on-surface p-1">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="font-headline-sm text-headline-sm text-on-surface">Student Profile</h1>
          </div>
          <button className="text-secondary hover:text-on-surface p-1">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </header>

      <div className="pt-20 px-margin-mobile flex flex-col gap-space-md">
        
        {/* Profile Card */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-headline-md text-xl shadow-md shrink-0">
            {student.initials}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-label-mono-sm text-[10px] uppercase font-bold tracking-wide">
                Student
              </span>
              {student.verified && (
                <span className="font-label-mono-sm text-label-mono-sm text-tertiary flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  Verified ID
                </span>
              )}
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface truncate">{student.name}</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">ID: {student.id}</p>
            <p className="font-label-mono text-label-mono text-secondary mt-2">BCA 5th Semester</p>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-space-2xs">
          <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col shadow-sm border border-surface-container/50">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Global Rank</span>
            <div className="flex items-end gap-1 mt-1">
              <span className="font-stat-mono-lg text-stat-mono-lg text-primary">#{mockLeaderboard.findIndex(s => s.id === student.id) + 1}</span>
              <span className="font-label-mono-sm text-label-mono-sm text-secondary mb-1.5">/ 182</span>
            </div>
          </div>
          <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col shadow-sm border border-surface-container/50">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Avg. Percentile</span>
            <div className="flex items-end gap-1 mt-1">
              <span className="font-stat-mono-lg text-stat-mono-lg text-on-surface">{student.percentile}th</span>
              <span className="font-label-mono-sm text-label-mono-sm text-tertiary mb-1.5 flex items-center">
                <span className="material-symbols-outlined text-[12px]">trending_up</span> Top Tier
              </span>
            </div>
          </div>
          <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col shadow-sm border border-surface-container/50">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Avg. Score</span>
            <span className="font-stat-mono-lg text-stat-mono-lg text-on-surface mt-1">{student.score}%</span>
          </div>
          <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col shadow-sm border border-surface-container/50">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Proctoring Flags</span>
            <span className="font-stat-mono-lg text-stat-mono-lg text-tertiary mt-1">0 <span className="text-sm font-body-sm text-secondary">Flags</span></span>
          </div>
        </div>

        {/* Recent Exams */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container overflow-hidden mt-2">
          <h3 className="px-space-md py-3 font-label-mono-sm text-label-mono-sm uppercase text-secondary tracking-wider bg-surface-container-low/50">Recent Assessments</h3>
          
          <div className="flex flex-col divide-y divide-surface-container">
            <div className="px-space-md py-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
              <div className="flex flex-col gap-0.5">
                <span className="font-body-md text-body-md text-on-surface font-medium">DBMS Normalization</span>
                <span className="font-label-mono-sm text-label-mono-sm text-secondary">Completed in {student.time}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-stat-mono-lg text-lg text-on-surface">{student.score}%</span>
                <span className="font-label-mono-sm text-[10px] text-primary">{student.percentile}th Prctl</span>
              </div>
            </div>
            
            <div className="px-space-md py-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
              <div className="flex flex-col gap-0.5">
                <span className="font-body-md text-body-md text-on-surface font-medium">SQL Joins Quiz</span>
                <span className="font-label-mono-sm text-label-mono-sm text-secondary">Completed in 12m 45s</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-stat-mono-lg text-lg text-on-surface">{(student.score * 0.95).toFixed(0)}%</span>
                <span className="font-label-mono-sm text-[10px] text-primary">{(student.percentile * 0.92).toFixed(0)}th Prctl</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <BottomNav />
    </div>
  );
}
