"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateRoom() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("BCA 5th Semester - DBMS");
  const [subject, setSubject] = useState("Database Management System");
  const [desc, setDesc] = useState("Weekly tests and midterm revision for BCA batch 2024-25");
  
  const [instantLeaderboard, setInstantLeaderboard] = useState(true);
  const [cameraProctoring, setCameraProctoring] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Fake API Create
    setTimeout(() => {
      setLoading(false);
      setCreated(true);
      
      // Auto redirect to new room dashboard
      setTimeout(() => {
        router.push("/rooms/K7M4P2");
      }, 1200);
    }, 1500);
  };

  return (
    <div className="flex-1 w-full bg-surface-container-low min-h-screen relative flex items-center justify-center p-4">
      
      {/* Active Focus Bottom Sheet / Modal Canvas */}
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden relative">
        {/* Sheet Header */}
        <div className="px-margin-mobile pt-space-md pb-space-xs flex items-start justify-between border-b border-surface-container-high/30">
          <div className="pr-space-xs">
            <div className="flex items-center gap-space-2xs mb-space-2xs">
              <span className="px-space-xs py-0.5 rounded bg-primary-fixed text-on-primary-fixed font-label-mono-sm text-label-mono-sm uppercase tracking-wide">
                Teacher Console
              </span>
            </div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Create a new Room</h2>
            <p className="font-body-sm text-body-sm text-secondary mt-0.5">
              Set up a classroom cohort to generate AI tests and track live leaderboards.
            </p>
          </div>
          <button 
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Form Container */}
        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto px-margin-mobile py-space-md space-y-space-md">
          {/* Field 1: Room Name */}
          <div className="space-y-space-2xs">
            <label className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary font-medium tracking-wide" htmlFor="roomNameInput">
              Room Name <span className="text-error">*</span>
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">school</span>
              <input 
                id="roomNameInput" 
                type="text" 
                required 
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                className="w-full pl-10 pr-3 h-11 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary transition-all" 
                placeholder="e.g. BCA 5th Semester - DBMS" 
              />
            </div>
          </div>

          {/* Field 2: Subject */}
          <div className="space-y-space-2xs">
            <label className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary font-medium tracking-wide" htmlFor="subjectInput">
              Subject <span className="text-error">*</span>
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">menu_book</span>
              <input 
                id="subjectInput" 
                type="text" 
                required 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full pl-10 pr-3 h-11 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary transition-all" 
                placeholder="e.g. Database Management System" 
              />
            </div>
          </div>

          {/* Field 3: Description (Optional) */}
          <div className="space-y-space-2xs">
            <div className="flex items-center justify-between">
              <label className="block font-label-mono-sm text-label-mono-sm uppercase text-secondary font-medium tracking-wide" htmlFor="descInput">
                Description
              </label>
              <span className="font-label-mono-sm text-label-mono-sm text-outline">Optional</span>
            </div>
            <div className="relative">
              <textarea 
                id="descInput" 
                rows={3}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                className="w-full p-3 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none" 
                placeholder="Describe syllabus coverage or schedule requirements..."
              ></textarea>
            </div>
          </div>

          {/* Configuration Toggles */}
          <div className="space-y-space-xs pt-space-2xs">
            <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary font-medium tracking-wide block">
              Room Governance & Telemetry
            </span>
            
            {/* Toggle: Instant Room Leaderboard */}
            <div className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between">
              <div className="flex items-start gap-space-xs pr-space-xs">
                <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">leaderboard</span>
                <div>
                  <span className="font-body-md text-body-md font-semibold text-on-surface block">Enable Instant Room Leaderboard</span>
                  <span className="font-body-sm text-body-sm text-secondary block">Stream realtime percentiles and accuracy scores post-test.</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setInstantLeaderboard(!instantLeaderboard)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${instantLeaderboard ? 'bg-primary' : 'bg-outline-variant'}`}
              >
                <div className={`bg-on-primary w-4 h-4 rounded-full shadow-sm transform transition-transform ${instantLeaderboard ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>

            {/* Toggle: Camera Proctoring Active */}
            <div className="p-space-sm rounded-lg bg-surface-container-low flex items-center justify-between">
              <div className="flex items-start gap-space-xs pr-space-xs">
                <span className="material-symbols-outlined text-tertiary text-[20px] mt-0.5">visibility</span>
                <div>
                  <span className="font-body-md text-body-md font-semibold text-on-surface block">Camera Proctoring Active</span>
                  <span className="font-body-sm text-body-sm text-secondary block">Require periodic webcam verification snapshots during assessment.</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setCameraProctoring(!cameraProctoring)}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${cameraProctoring ? 'bg-primary' : 'bg-outline-variant'}`}
              >
                <div className={`bg-on-primary w-4 h-4 rounded-full shadow-sm transform transition-transform ${cameraProctoring ? 'translate-x-6' : 'translate-x-0'}`}></div>
              </button>
            </div>
          </div>

          {/* Interactive Notice Banner */}
          <div className="p-space-sm rounded-lg bg-surface-container-high flex items-start gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">qr_code_2</span>
            <p className="font-body-sm text-body-sm text-on-surface">
              A unique <span className="font-label-mono text-label-mono font-semibold text-primary">6-character Room ID</span> and instant QR code will be generated upon creation for student self-enrollment.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-space-xs pb-space-sm flex items-center gap-space-xs sticky bottom-0 bg-surface-container-lowest mt-4 py-2 border-t border-surface-container-low">
            <button 
              type="button" 
              onClick={() => router.back()}
              className="flex-1 h-11 px-space-md rounded-lg bg-surface-container font-headline-sm text-headline-sm text-on-surface hover:bg-surface-container-high active:scale-[0.98] transition-all flex items-center justify-center"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || created}
              className={`flex-[2] h-11 px-space-md rounded-lg font-headline-sm text-headline-sm text-on-primary active:scale-[0.98] transition-all flex items-center justify-center gap-space-xs shadow-sm ${created ? 'bg-tertiary' : 'bg-primary hover:bg-primary-container'}`}
            >
              {loading ? (
                <>
                  <span>Generating...</span>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                </>
              ) : created ? (
                <>
                  <span>Created: #K7M4P2</span>
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                </>
              ) : (
                <>
                  <span>Create Room</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
