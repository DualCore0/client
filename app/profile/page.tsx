"use client";

import { BottomNav } from "@/components/BottomNav";
import { useRouter } from "next/navigation";

export default function Profile() {
  const router = useRouter();

  const handleSignOut = () => {
    // Fake sign out
    setTimeout(() => {
      router.push("/login");
    }, 500);
  };

  return (
    <div className="flex-1 w-full bg-surface pb-20 min-h-screen">
      
      {/* Header */}
      <header className="fixed top-0 w-full z-40 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-gutter-mobile flex items-center justify-between">
          <h1 className="font-headline-sm text-headline-sm text-on-surface">Academic Profile</h1>
          <button className="text-secondary hover:text-on-surface p-2">
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </header>

      <div className="pt-20 px-margin-mobile flex flex-col gap-space-md">
        
        {/* Profile Card */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-md text-xl shadow-md shrink-0">
            AR
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-mono-sm text-[10px] uppercase font-bold tracking-wide">
                Teacher
              </span>
              <span className="font-label-mono-sm text-label-mono-sm text-tertiary flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                Verified ID
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface truncate">Alex Rivera</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">alex.rivera@example.com</p>
            <p className="font-label-mono text-label-mono text-secondary mt-2">Department of Computer Science</p>
          </div>
        </div>

        {/* Academic Metrics */}
        <div className="grid grid-cols-2 gap-space-2xs">
          <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col shadow-sm">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Active Rooms</span>
            <span className="font-stat-mono-lg text-stat-mono-lg text-primary mt-1">4</span>
          </div>
          <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col shadow-sm">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Total Students</span>
            <span className="font-stat-mono-lg text-stat-mono-lg text-on-surface mt-1">182</span>
          </div>
          <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col shadow-sm">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Tests Generated</span>
            <span className="font-stat-mono-lg text-stat-mono-lg text-on-surface mt-1">24</span>
          </div>
          <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col shadow-sm">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Proctoring Alerts</span>
            <span className="font-stat-mono-lg text-stat-mono-lg text-tertiary mt-1">0</span>
          </div>
        </div>

        {/* Preferences Menu */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container overflow-hidden mt-2">
          <h3 className="px-space-md py-3 font-label-mono-sm text-label-mono-sm uppercase text-secondary tracking-wider bg-surface-container-low/50">Preferences & Settings</h3>
          
          <div className="flex flex-col divide-y divide-surface-container">
            <button className="px-space-md py-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">dark_mode</span>
                <span className="font-body-md text-body-md text-on-surface font-medium">Appearance</span>
              </div>
              <span className="font-label-mono-sm text-label-mono-sm text-secondary flex items-center gap-1">
                System <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </span>
            </button>
            
            <button className="px-space-md py-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">notifications</span>
                <span className="font-body-md text-body-md text-on-surface font-medium">Push Notifications</span>
              </div>
              <div className="w-10 h-5 rounded-full bg-primary flex items-center p-0.5">
                <div className="w-4 h-4 rounded-full bg-on-primary transform translate-x-5 shadow-sm"></div>
              </div>
            </button>

            <button className="px-space-md py-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">security</span>
                <span className="font-body-md text-body-md text-on-surface font-medium">Security & Telemetry</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-secondary">chevron_right</span>
            </button>
            
            <button className="px-space-md py-4 flex items-center justify-between hover:bg-surface-container-low transition-colors">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary">help</span>
                <span className="font-body-md text-body-md text-on-surface font-medium">Help & Support</span>
              </div>
              <span className="material-symbols-outlined text-[16px] text-secondary">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Sign Out Button */}
        <button 
          onClick={handleSignOut}
          className="w-full mt-4 h-12 bg-error-container/50 hover:bg-error-container text-error rounded-xl font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined">logout</span>
          <span>Sign Out of Academic Portal</span>
        </button>

      </div>

      <BottomNav />
    </div>
  );
}
