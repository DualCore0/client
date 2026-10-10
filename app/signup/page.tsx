"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, type AuthUser, type Role } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

export default function Signup() {
  const router = useRouter();
  const { signIn } = useAuth();
  
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdRole, setCreatedRole] = useState<Role>("STUDENT");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isValidEmail = email.includes("@") && email.includes(".");
  
  const calculateStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strengthScore = calculateStrength(password);
  
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullname.trim()) {
      setErrorMsg("Please enter your full official name.");
      return;
    }
    if (!isValidEmail) {
      setErrorMsg("Valid email address required.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const data = await register({
        email: email.trim(),
        password,
        fullname: fullname.trim(),
        role: role.toUpperCase() as Role,
      });
      await signIn(data.access_token, data.user as AuthUser);
      setCreatedRole(data.user.role);
      setShowSuccessModal(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen">
      <div className="flex flex-col w-full pb-10 max-w-md mx-auto">
        
        {/* Dynamic Top Visual Ribbon */}
        <div className="w-full px-4 pt-2 pb-4">
          <div className="relative overflow-hidden rounded-xl bg-surface-container-low p-5 shadow-sm">
            <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-primary-fixed/30 blur-2xl pointer-events-none"></div>
            <div className="relative z-10 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-md shrink-0">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-mono-sm text-label-mono-sm uppercase tracking-wide mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  Academic Evaluation Engine
                </div>
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface leading-tight">
                  Create your ClassRank account
                </h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 leading-snug">
                  Join your university classroom or manage courses with AI-powered assessment.
                </p>
              </div>
            </div>
            
            {/* Campus Image Mosaic Strip (Simulated) */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t-0">
              <div className="h-16 rounded-lg bg-surface-variant relative shadow-sm flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary opacity-50">menu_book</span>
              </div>
              <div className="h-16 rounded-lg bg-surface-variant relative shadow-sm flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary opacity-50">laptop_mac</span>
              </div>
              <div className="h-16 rounded-lg bg-surface-variant relative shadow-sm flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary opacity-50">school</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Sign-Up Form Container */}
        <div className="px-4">
          <div className="rounded-xl bg-surface-container-lowest p-5 shadow-sm space-y-5">
            
            {/* Role Selection Toggle */}
            <div>
              <label className="block font-label-mono text-label-mono text-secondary uppercase tracking-wide mb-2">
                Academic Profile Role
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1.5 rounded-xl">
                <button 
                  type="button" 
                  onClick={() => setRole("student")}
                  className={`py-2.5 px-3 rounded-lg flex flex-col items-center justify-center text-center transition-all duration-200 shadow-sm ${role === 'student' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <div className="flex items-center gap-1.5 font-headline-sm text-headline-sm">
                    <span className="material-symbols-outlined text-lg">person_pin</span>
                    <span>Student</span>
                  </div>
                  <span className="font-body-sm text-body-sm opacity-90 text-[11px] leading-tight mt-0.5">Take tests & track rank</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setRole("teacher")}
                  className={`py-2.5 px-3 rounded-lg flex flex-col items-center justify-center text-center transition-all duration-200 shadow-sm ${role === 'teacher' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <div className="flex items-center gap-1.5 font-headline-sm text-headline-sm">
                    <span className="material-symbols-outlined text-lg">co_present</span>
                    <span>Teacher</span>
                  </div>
                  <span className="font-body-sm text-body-sm opacity-80 text-[11px] leading-tight mt-0.5">Create rooms & generate tests</span>
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-surface-container text-on-surface-variant font-body-sm text-body-sm">
                <span className="material-symbols-outlined text-primary text-base shrink-0">info</span>
                <span className="text-xs">
                  {role === 'student' ? 'Student mode: Auto-links to university lecture cohorts via room codes.' : 'Teacher mode: Instantly provision exam vaults, AI rubrics, and grade distribution curves.'}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm flex items-start gap-2">
                <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSignup}>
              
              <div>
                <label className="block font-label-mono text-label-mono text-secondary uppercase tracking-wide mb-1.5" htmlFor="fullname-input">
                  Full Academic Name
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-xl pointer-events-none">badge</span>
                  <input 
                    id="fullname-input" 
                    type="text" 
                    required 
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-outline" 
                    placeholder="e.g. Alex Rivera or Prof. Harrison" 
                  />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-label-mono text-label-mono text-secondary uppercase tracking-wide" htmlFor="email-input">
                    Email Address
                  </label>
                  {isValidEmail && (
                    <span className="inline-flex items-center gap-1 font-label-mono-sm text-label-mono-sm text-tertiary px-1.5 py-0.5 rounded bg-tertiary-container/10">
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      Valid format
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-xl pointer-events-none">mail</span>
                  <input 
                    id="email-input" 
                    type="email" 
                    required 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-outline" 
                    placeholder="user@example.com" 
                  />
                  {isValidEmail && (
                    <span className="material-symbols-outlined absolute right-3 text-tertiary text-xl pointer-events-none" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-label-mono text-label-mono text-secondary uppercase tracking-wide mb-1.5" htmlFor="password-input">
                  Master Password
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-xl pointer-events-none">lock</span>
                  <input 
                    id="password-input" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-outline" 
                    placeholder="••••••••••••" 
                  />
                  <button 
                    type="button" 
                    aria-label="Toggle password visibility" 
                    className="absolute right-2.5 p-1 rounded-md text-secondary hover:text-on-surface focus:outline-none" 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-label-mono-sm text-label-mono-sm text-secondary uppercase tracking-wide">Security Strength</span>
                    <span className={`font-label-mono text-label-mono ${strengthScore <= 1 ? 'text-error' : strengthScore === 2 ? 'text-secondary' : strengthScore === 3 ? 'text-primary' : 'text-tertiary'}`}>
                      {strengthScore <= 1 ? 'Weak' : strengthScore === 2 ? 'Moderate' : strengthScore === 3 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                    <div className={`rounded-full transition-colors duration-300 ${strengthScore >= 1 ? (strengthScore <= 1 ? 'bg-error' : strengthScore === 2 ? 'bg-secondary' : strengthScore === 3 ? 'bg-primary' : 'bg-tertiary') : 'bg-surface-container-high'}`}></div>
                    <div className={`rounded-full transition-colors duration-300 ${strengthScore >= 2 ? (strengthScore === 2 ? 'bg-secondary' : strengthScore === 3 ? 'bg-primary' : 'bg-tertiary') : 'bg-surface-container-high'}`}></div>
                    <div className={`rounded-full transition-colors duration-300 ${strengthScore >= 3 ? (strengthScore === 3 ? 'bg-primary' : 'bg-tertiary') : 'bg-surface-container-high'}`}></div>
                    <div className={`rounded-full transition-colors duration-300 ${strengthScore >= 4 ? 'bg-tertiary' : 'bg-surface-container-high'}`}></div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-label-mono text-label-mono text-secondary uppercase tracking-wide" htmlFor="confirm-password-input">
                    Confirm Password
                  </label>
                  {confirmPassword && password === confirmPassword && (
                    <span className="inline-flex items-center gap-1 font-label-mono-sm text-label-mono-sm text-tertiary px-1.5 py-0.5 rounded bg-tertiary-container/10">
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      Passwords match
                    </span>
                  )}
                  {confirmPassword && password !== confirmPassword && (
                    <span className="inline-flex items-center gap-1 font-label-mono-sm text-label-mono-sm text-error px-1.5 py-0.5 rounded bg-error-container/20">
                      <span className="material-symbols-outlined text-xs">close</span>
                      Mismatch
                    </span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-secondary text-xl pointer-events-none">password</span>
                  <input 
                    id="confirm-password-input" 
                    type={showConfirmPassword ? "text" : "password"} 
                    required 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-outline" 
                    placeholder="••••••••••••" 
                  />
                  <button 
                    type="button" 
                    aria-label="Toggle confirm password visibility" 
                    className="absolute right-2.5 p-1 rounded-md text-secondary hover:text-on-surface focus:outline-none" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-outlined text-xl">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <input 
                  id="terms-checkbox" 
                  type="checkbox" 
                  required 
                  defaultChecked
                  className="mt-1 w-4 h-4 rounded text-primary focus:ring-0 focus:outline-none bg-surface-container-low cursor-pointer accent-primary" 
                />
                <label className="font-body-sm text-body-sm text-on-surface-variant leading-tight cursor-pointer" htmlFor="terms-checkbox">
                  I agree to the <a href="#" className="text-primary underline">Academic Honor Code</a>, assessment telemetry tracking, and ClassRank terms.
                </label>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full h-11 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-lg shadow-md hover:bg-primary/95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-80"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow h-px bg-surface-variant"></div>
              <span className="flex-shrink mx-3 font-label-mono-sm text-label-mono-sm text-outline uppercase tracking-wider">or</span>
              <div className="flex-grow h-px bg-surface-variant"></div>
            </div>

            <button type="button" className="w-full h-11 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg shadow-sm hover:bg-surface-container transition-all flex items-center justify-center gap-3 active:scale-[0.99]">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z" fill="#4285F4"></path>
                <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.36 24 12 24z" fill="#34A853"></path>
                <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.98 0 12s.45 3.84 1.24 5.42l4.04-3.15z" fill="#FBBC05"></path>
                <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"></path>
              </svg>
              <span className="font-headline-sm text-headline-sm">Continue with Google</span>
            </button>

            <div className="text-center pt-2">
              <span className="font-body-md text-body-md text-on-surface-variant">Already have an account?</span>
              <Link href="/login" className="ml-1.5 font-headline-sm text-headline-sm text-primary hover:underline">
                Login
              </Link>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4">
          <div className="p-3.5 rounded-xl bg-surface-container-low shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 font-stat-mono-lg text-stat-mono-lg">
                <span className="material-symbols-outlined text-lg">domain</span>
              </div>
              <div className="min-w-0">
                <div className="font-headline-sm text-headline-sm text-on-surface truncate">94 Universities Enrolled</div>
                <div className="font-label-mono-sm text-label-mono-sm text-secondary">Real-time cohort synchronization</div>
              </div>
            </div>
            <div className="flex -space-x-2 shrink-0">
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary font-label-mono-sm text-label-mono-sm flex items-center justify-center shadow-xs">MIT</div>
              <div className="w-7 h-7 rounded-full bg-tertiary-container text-on-tertiary-container font-label-mono-sm text-label-mono-sm flex items-center justify-center shadow-xs">STF</div>
              <div className="w-7 h-7 rounded-full bg-surface-container-high text-on-surface font-label-mono-sm text-label-mono-sm flex items-center justify-center shadow-xs">+92</div>
            </div>
          </div>
        </div>

        {/* Success Modal Overlay */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm transition-opacity duration-300">
            <div className="w-full max-w-sm rounded-xl bg-surface-container-lowest p-6 shadow-xl space-y-4 text-center transform transition-transform duration-300 scale-100">
              <div className="w-16 h-16 mx-auto rounded-full bg-tertiary-container/20 text-tertiary flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl animate-bounce" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              </div>
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-tertiary-container/10 text-tertiary font-label-mono-sm text-label-mono-sm uppercase tracking-wider mb-1">
                  Verification Passed
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Account Created!</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1.5">
                  {createdRole === "TEACHER"
                    ? "Create your first room to share assessment codes with students."
                    : "Join a classroom with the code your teacher shared."}
                </p>
              </div>
              <div className="w-full bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-full w-full animate-[pulse_1s_infinite]"></div>
              </div>
              <div className="pt-2">
                <button 
                  onClick={() => router.push(createdRole === 'STUDENT' ? '/join' : '/rooms/create')}
                  className="w-full py-2 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-lg hover:bg-primary-container transition-colors"
                >
                  {createdRole === "TEACHER" ? "Create my first room" : "Join my first room"}
                </button>
                <button 
                  onClick={() => router.push(createdRole === 'STUDENT' ? '/dashboard' : '/rooms')}
                  className="w-full py-2 mt-2 text-on-surface-variant font-body-sm text-body-sm"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
