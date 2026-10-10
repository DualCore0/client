"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login as loginRequest, type AuthUser } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isValidEmail = email.includes("@") && email.includes(".");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await loginRequest({ email: email.trim(), password });
      // The server is the source of truth for the role, not the toggle.
      await signIn(data.access_token, data.user as AuthUser);
      const next = searchParams.get("next");
      if (next && next.startsWith("/")) {
        router.replace(next);
      } else {
        router.replace(data.user.role === "TEACHER" ? "/rooms" : "/dashboard");
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen">
      <div className="w-full max-w-md mx-auto px-margin-mobile py-space-md flex flex-col gap-space-lg">
        {/* Institutional Header & Verification Pill */}
        <header className="flex flex-col items-center text-center gap-space-sm pt-space-xs">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-lg shadow-sm bg-primary text-on-primary flex items-center justify-center font-bold font-label-mono-sm text-lg">CR</div>
            <span className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">ClassRank</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs">
            Turn study material into smarter class tests.
          </p>

          {/* Institutional Credential Badge Card */}
          <div className="w-full bg-surface-container rounded-xl p-space-sm shadow-sm flex flex-col gap-space-2xs text-left mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-2xs">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                <span className="font-label-mono-sm text-label-mono-sm uppercase text-primary tracking-wider font-semibold">Official Academic Portal</span>
              </div>
              <span className="font-label-mono-sm text-label-mono-sm bg-surface-container-lowest text-on-surface-variant px-space-2xs py-0.5 rounded">v2.4</span>
            </div>
            <p className="font-headline-sm text-headline-sm text-on-surface leading-tight mt-1">
              AI-Powered Academic Testing & Cohort Leaderboards
            </p>
            <div className="flex flex-wrap items-center gap-space-xs pt-1">
              <span className="inline-flex items-center gap-1 font-label-mono-sm text-label-mono-sm bg-tertiary-fixed text-on-tertiary-fixed px-2 py-0.5 rounded-full font-medium">
                <span className="material-symbols-outlined text-[13px]">school</span> ABET Aligned
              </span>
              <span className="inline-flex items-center gap-1 font-label-mono-sm text-label-mono-sm bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full font-medium">
                <span className="material-symbols-outlined text-[13px]">bolt</span> Instant Grading
              </span>
            </div>
          </div>
        </header>

        {/* Sign In Card */}
        <main className="w-full bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">Welcome back</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Sign in to access your classrooms and active exams.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-space-xs p-space-sm bg-error-container text-on-error-container rounded-lg">
              <span className="material-symbols-outlined text-[20px] text-error shrink-0">error</span>
              <div className="flex-1">
                <p className="font-body-sm text-body-sm font-semibold text-on-error-container leading-none">Authentication Failed</p>
                <p className="font-body-sm text-body-sm text-on-error-container mt-1">{error}</p>
              </div>
              <button className="text-on-error-container hover:opacity-80" onClick={() => setError(null)}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          )}

          <form className="flex flex-col gap-space-md" onSubmit={handleLogin}>
            {/* Role Selection Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="font-body-sm text-body-sm text-on-surface font-medium">
                Log in as
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1.5 rounded-xl mb-1">
                <button 
                  type="button" 
                  onClick={() => setRole("student")}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-sm ${role === 'student' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">person_pin</span>
                  <span className="font-headline-sm text-[14px]">Student</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setRole("teacher")}
                  className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 shadow-sm ${role === 'teacher' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">co_present</span>
                  <span className="font-headline-sm text-[14px]">Teacher</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="font-body-sm text-body-sm text-on-surface font-medium" htmlFor="email">
                  Email Address
                </label>
                {isValidEmail && (
                  <span className="font-label-mono-sm text-label-mono-sm text-tertiary flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span> Valid Email
                  </span>
                )}
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">
                  alternate_email
                </span>
                <input 
                  id="email" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-10 pr-10 py-2.5 rounded-lg transition-colors focus:bg-surface-container-lowest focus:outline-none ring-1 ring-transparent focus:ring-primary/20 focus:border-primary" 
                  placeholder="user@example.com" 
                  required
                />
                {email && (
                  <button type="button" className="absolute right-3 text-secondary hover:text-on-surface flex items-center justify-center" onClick={() => setEmail("")}>
                    <span className="material-symbols-outlined text-[18px]">cancel</span>
                  </button>
                )}
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-[14px] text-tertiary">domain</span>
                Sign in with your registered email address.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <div className="flex justify-between items-center">
                <label className="font-body-sm text-body-sm text-on-surface font-medium" htmlFor="password">
                  Password
                </label>
                <span className="font-label-mono-sm text-label-mono-sm text-on-surface-variant">Min. 8 chars</span>
              </div>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-secondary text-[20px] pointer-events-none">
                  lock
                </span>
                <input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-10 pr-11 py-2.5 rounded-lg transition-colors focus:bg-surface-container-lowest focus:outline-none ring-1 ring-transparent focus:ring-primary/20 focus:border-primary" 
                  placeholder="••••••••••••" 
                  required
                />
                <button type="button" aria-label="Toggle password view" className="absolute right-3 text-secondary hover:text-on-surface p-1 rounded transition-colors flex items-center" onClick={() => setShowPassword(!showPassword)}>
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded text-primary bg-surface-container-low accent-primary cursor-pointer" defaultChecked />
                <span className="font-body-sm text-body-sm text-on-surface">Remember me</span>
              </label>
              <a href="#" className="font-body-sm text-body-sm text-primary hover:underline font-medium">
                Forgot password?
              </a>
            </div>

            <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm py-2.5 px-space-md rounded-lg shadow-sm transition-all active:scale-[0.99] flex items-center justify-center gap-2 mt-2 disabled:opacity-80">
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center justify-center py-space-xs mt-2">
            <div className="w-full h-px bg-surface-container-highest"></div>
            <span className="absolute bg-surface-container-lowest px-space-sm font-label-mono-sm text-label-mono-sm text-secondary uppercase tracking-wider">
              or continue with
            </span>
          </div>

          <div className="flex flex-col gap-space-xs">
            <button type="button" className="w-full bg-surface-container-low hover:bg-surface-container text-on-surface font-body-md text-body-md py-2.5 px-space-md rounded-lg flex items-center justify-center gap-3 transition-colors shadow-sm">
              <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"></path>
              </svg>
              <span className="font-medium">Continue with Google</span>
            </button>
          </div>

          <div className="text-center pt-space-xs mt-2">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Don&apos;t have an account? 
              <Link href="/signup" className="font-body-sm text-body-sm text-primary font-semibold hover:underline ml-1">
                Sign up
              </Link>
            </p>
          </div>
        </main>

        <footer className="flex flex-col items-center gap-1 text-center pb-space-lg text-on-surface-variant mt-4">
          <div className="flex items-center gap-1 font-label-mono-sm text-label-mono-sm">
            <span className="material-symbols-outlined text-[14px] text-tertiary">lock_clock</span>
            <span>Secure Exam Telemetry & Anti-Cheating Protocol V4 Active</span>
          </div>
          <p className="font-label-mono-sm text-label-mono-sm opacity-70 mt-1">
            ClassRank Higher Ed © 2026 • Strict Academic Compliance
          </p>
        </footer>
      </div>
    </div>
  );
}
