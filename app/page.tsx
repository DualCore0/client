import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen w-full bg-surface">
      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
        <div className="h-16 px-gutter-mobile md:px-gutter max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold font-label-mono-sm">CR</div>
            <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-semibold">ClassRank</span>
          </div>
          <div className="flex items-center gap-space-sm">
            <Link href="/login" className="font-headline-sm text-headline-sm text-secondary hover:text-on-surface transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/signup" className="h-10 px-space-md bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm flex items-center justify-center transition-all shadow-sm active:scale-[0.98]">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full pt-24 pb-20 px-gutter-mobile md:px-gutter max-w-7xl mx-auto flex flex-col gap-16 md:gap-24">
        
        {/* Hero Section */}
        <section className="flex flex-col items-center text-center pt-8 md:pt-16 max-w-3xl mx-auto gap-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-mono-sm text-label-mono-sm uppercase tracking-wide">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            ClassRank v2.4 Live
          </div>
          <h1 className="text-4xl md:text-6xl font-bold font-headline-lg text-on-surface tracking-tight leading-tight">
            Academic Assessment, <br className="hidden md:block"/> Engineered with Precision.
          </h1>
          <p className="text-lg md:text-xl font-body-lg text-on-surface-variant max-w-2xl">
            Turn study material into smarter class tests instantly. Generate AI-powered assessments, track live cohorts, and measure percentile leaderboards in real-time.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full sm:w-auto">
            <Link href="/signup" className="w-full sm:w-auto h-12 px-8 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98]">
              <span>Create Institution Account</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
            <Link href="/join" className="w-full sm:w-auto h-12 px-8 bg-surface-container-lowest hover:bg-surface-container border border-surface-container-high text-on-surface rounded-lg font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]">
              <span className="material-symbols-outlined text-[20px] text-tertiary">vpn_key</span>
              <span>Join a Room</span>
            </Link>
          </div>
        </section>

        {/* Value Props Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
            <div className="w-12 h-12 rounded-lg bg-tertiary-container/10 text-tertiary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface">AI Evaluation Engine</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Upload syllabi and textbooks. Instantly generate pedagogically sound multiple-choice assessments aligned with ABET benchmarks.
            </p>
          </div>
          
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>leaderboard</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface">Real-Time Leaderboards</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Live cohort telemetry. Track student progress, aggregate class accuracy, and stream instant percentiles upon exam completion.
            </p>
          </div>

          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
            <div className="w-12 h-12 rounded-lg bg-error-container/20 text-error flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface">Auto-Proctoring V4</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Ensure academic integrity with camera proctoring snapshots, browser locking, and real-time anomaly detection during live sessions.
            </p>
          </div>
        </section>

        {/* Trust Banner */}
        <section className="bg-surface-container-low rounded-2xl p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 flex flex-col gap-4">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Trusted by 94+ Universities Worldwide</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Join leading academic institutions utilizing ClassRank to standardize testing protocols.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 justify-center md:justify-end">
            <div className="px-6 py-3 bg-surface-container-lowest rounded-lg font-stat-mono-lg text-lg text-on-surface font-semibold shadow-sm">MIT</div>
            <div className="px-6 py-3 bg-surface-container-lowest rounded-lg font-stat-mono-lg text-lg text-on-surface font-semibold shadow-sm">Stanford</div>
            <div className="px-6 py-3 bg-surface-container-lowest rounded-lg font-stat-mono-lg text-lg text-on-surface font-semibold shadow-sm">Oxford</div>
          </div>
        </section>

      </main>

      <footer className="w-full bg-surface-container-lowest border-t border-surface-container-high py-8 px-gutter-mobile md:px-gutter mt-auto text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-secondary text-on-secondary flex items-center justify-center font-bold font-label-mono-sm text-[10px]">CR</div>
          <span className="font-headline-sm text-headline-sm text-on-surface-variant">ClassRank Higher Ed © 2026</span>
        </div>
        <div className="flex items-center gap-6 font-body-sm text-body-sm text-secondary">
          <Link href="#" className="hover:text-primary">Academic Honor Code</Link>
          <Link href="#" className="hover:text-primary">Privacy Policy</Link>
          <Link href="#" className="hover:text-primary">Support</Link>
        </div>
      </footer>
    </div>
  );
}
