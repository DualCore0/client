"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
const mockRoom: any = { name: "Demo Room", subject: "Subject", id: "0000" };
import { BottomNav } from "@/components/BottomNav";

export default function JoinRoom() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [verifiedRoom, setVerifiedRoom] = useState<typeof mockRoom | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
  
  const handleVerify = async () => {
    if (!roomCode || roomCode.length < 6) return;
    
    setLoading(true);
    setError(false);
    
    // Fake API interaction
    timerRef.current = setTimeout(() => {
      setLoading(false);
      if (roomCode.toUpperCase() === mockRoom.id) {
        setVerifiedRoom(mockRoom);
      } else {
        setError(true);
        setVerifiedRoom(null);
      }
    }, 800);
  };

  const handleJoin = () => {
    if (!verifiedRoom) return;
    setLoading(true);
    // Fake join API
    timerRef.current = setTimeout(() => {
      setLoading(false);
      // Student joins room and proceeds to test or wait lobby
      alert(`Joined ${verifiedRoom.name}!`);
      router.push("/dashboard");
    }, 800);
  };

  return (
    <div className="flex flex-col w-full pb-8">
      <div className="px-margin-mobile pt-space-md flex flex-col gap-space-xs">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container">
            <span className="material-symbols-outlined text-[14px]">vpn_key</span>
            <span className="font-label-mono-sm text-label-mono-sm uppercase tracking-wide">Secure Access</span>
          </div>
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mt-2">Join a Room</h1>
        <p className="font-body-md text-body-md text-secondary">Enter the Room ID shared by your teacher or scan their QR code.</p>
      </div>

      {error && (
        <div className="mx-margin-mobile mt-space-sm p-space-sm rounded-lg bg-error-container text-on-error-container flex items-start gap-space-xs shadow-sm">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">error</span>
          <div className="flex-1 min-w-0">
            <p className="font-headline-sm text-headline-sm text-error">Invalid Room Code</p>
            <p className="font-body-sm text-body-sm text-on-error-container">Room not found. Check the Room ID and try again.</p>
          </div>
          <button className="text-on-error-container hover:text-error shrink-0" onClick={() => setError(false)}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <div className="mx-margin-mobile mt-space-md bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-md">
        <div className="flex flex-col gap-1.5">
          <label className="font-label-mono-sm text-label-mono-sm uppercase tracking-wider text-secondary" htmlFor="roomCode">
            Room ID / Join Code
          </label>
          <div className="relative flex items-center">
            <input 
              id="roomCode"
              type="text"
              maxLength={6}
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                if (error) setError(false);
              }}
              className="w-full h-14 bg-surface-container-low focus:bg-surface-container-lowest rounded-lg px-4 font-stat-mono-lg text-stat-mono-lg tracking-[0.25em] text-center uppercase text-on-surface transition-all outline-none ring-1 ring-transparent focus:ring-primary/20 focus:border-primary"
              placeholder="••••••"
            />
            {roomCode && (
              <button className="absolute right-3 w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors" onClick={() => { setRoomCode(""); setVerifiedRoom(null); }}>
                <span className="material-symbols-outlined text-[18px]">backspace</span>
              </button>
            )}
          </div>
          <p className="font-label-mono text-label-mono text-secondary text-center mt-2 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[14px]">link</span>
            <span>Direct link: <span className="text-primary font-medium">classrank.app/join/{roomCode || "XXXXXX"}</span></span>
          </p>
        </div>

        <button 
          onClick={handleVerify}
          disabled={loading || roomCode.length < 6 || !!verifiedRoom}
          className="w-full h-11 bg-primary text-on-primary rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {loading ? (
             <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
          ) : (
             <span className="material-symbols-outlined text-[20px]">verified</span>
          )}
          <span>{loading ? "Verifying..." : "Verify & Join Room"}</span>
        </button>
        
        {!verifiedRoom && (
          <>
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute inset-x-0 h-[1px] bg-surface-container-high"></div>
              <span className="relative px-3 bg-surface-container-lowest font-label-mono-sm text-label-mono-sm uppercase text-secondary">or</span>
            </div>
            
            <button className="w-full h-11 bg-surface-container-low text-on-surface hover:bg-surface-container rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-sm transition-colors active:scale-[0.98]">
              <span className="material-symbols-outlined text-[20px] text-primary">qr_code_scanner</span>
              <span>Scan QR Code</span>
            </button>
          </>
        )}
      </div>

      {verifiedRoom && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="px-margin-mobile mt-space-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-tertiary">check_circle</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Verified Academic Room</h2>
            </div>
            <span className="font-label-mono-sm text-label-mono-sm text-secondary bg-surface-container-high px-2 py-0.5 rounded">LIVE PREVIEW</span>
          </div>
          
          <div className="mx-margin-mobile mt-space-xs bg-surface-container-lowest rounded-xl shadow-md overflow-hidden flex flex-col">
            <div className="p-space-md bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high flex flex-col gap-space-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-mono-sm text-label-mono-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                  Room Preview Found
                </span>
                <span className="font-stat-mono-lg text-[16px] text-primary bg-surface-container-lowest px-2.5 py-0.5 rounded font-semibold tracking-wider">
                  #{verifiedRoom.id}
                </span>
              </div>
              <div className="mt-2">
                <h3 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-1">{verifiedRoom.name}</h3>
                <p className="font-body-sm text-body-sm text-secondary mt-0.5">{verifiedRoom.department} • {verifiedRoom.term}</p>
              </div>
            </div>
            
            <div className="p-space-md flex flex-col gap-space-sm">
              <div className="grid grid-cols-2 gap-space-xs">
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Subject</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface mt-1 truncate">{verifiedRoom.subject}</span>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col">
                  <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Instructor</span>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-headline-sm text-headline-sm text-on-surface truncate">{verifiedRoom.instructor}</span>
                    <span className="material-symbols-outlined text-[16px] text-primary shrink-0" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-space-xs mt-2">
                <div className="bg-surface-container-low p-space-sm rounded-lg flex items-center gap-space-xs">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[20px]">groups</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Cohort</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface truncate">{verifiedRoom.cohortCount} enrolled</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-space-sm rounded-lg flex items-center gap-space-xs">
                  <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-tertiary shrink-0">
                    <span className="material-symbols-outlined text-[20px]">military_tech</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-mono-sm text-label-mono-sm uppercase text-secondary">Passing Rate</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface truncate">{verifiedRoom.passingRate}%</span>
                  </div>
                </div>
              </div>
              
              {verifiedRoom.activeAssessment && (
                <div className="p-space-sm rounded-lg bg-error-container/30 flex items-center justify-between gap-space-xs mt-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative flex items-center justify-center shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping absolute"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-error relative"></span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-mono-sm text-label-mono-sm uppercase text-error font-medium">Active Assessment</span>
                      <span className="font-headline-sm text-headline-sm text-on-surface truncate">{verifiedRoom.activeAssessment.title}</span>
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-1 rounded bg-error text-on-error font-label-mono-sm text-label-mono-sm uppercase font-semibold">Live Now</span>
                </div>
              )}
              
              <div className="flex flex-col gap-2 pt-space-xs mt-2">
                <button 
                  onClick={handleJoin}
                  disabled={loading}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-on-primary rounded-lg font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all disabled:opacity-80"
                >
                  {loading ? (
                    <span className="material-symbols-outlined text-[20px] animate-spin">refresh</span>
                  ) : (
                    <span className="material-symbols-outlined text-[20px]">login</span>
                  )}
                  <span>{loading ? "Connecting..." : "Confirm & Enter Room"}</span>
                </button>
                <button 
                  onClick={() => setVerifiedRoom(null)}
                  className="w-full h-10 bg-transparent text-secondary hover:text-on-surface rounded-lg font-body-md text-body-md transition-colors"
                >
                  Cancel & Search Different ID
                </button>
              </div>
            </div>
          </div>
          
          <div className="mx-margin-mobile mt-space-md p-space-sm bg-surface-container-low rounded-lg flex items-start gap-space-xs">
            <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">info</span>
            <p className="font-body-sm text-body-sm text-secondary">
              Entering an institutional room registers your academic ID for real-time exam tracking, proctored benchmarks, and cohort percentile leaderboards.
            </p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
