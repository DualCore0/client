'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/dashboard', icon: 'dashboard', roles: ['STUDENT', 'TEACHER'] },
  { name: 'Rooms', path: '/rooms', icon: 'meeting_room', roles: ['STUDENT', 'TEACHER'] },
  { name: 'Tests', path: '/tests', icon: 'assignment', roles: ['STUDENT', 'TEACHER'] },
  { name: 'Ranks', path: '/leaderboard', icon: 'leaderboard', roles: ['STUDENT', 'TEACHER'] },
  { name: 'Profile', path: '/profile', icon: 'account_circle', roles: ['STUDENT', 'TEACHER'] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = NAV_ITEMS.filter((item) => !user || item.roles.includes(user.role));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-surface/90 backdrop-blur-xl border-t border-surface-container-high hide-on-keyboard">
      <div className="h-16 px-space-2xs flex items-center justify-around max-w-3xl mx-auto">
        {items.map((item) => {
          const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
          return (
            <Link
              key={item.name}
              href={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center min-w-[56px] h-12 rounded-lg transition-colors ${
                isActive ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="font-label-mono-sm text-label-mono-sm uppercase mt-0.5">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Sticky top bar with an optional back button and a sign-out action. */
export function TopBar({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    signOut();
    router.replace('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 pt-safe bg-surface/85 backdrop-blur-xl border-b border-surface-container-high">
      <div className="h-16 px-gutter-mobile md:px-gutter max-w-5xl mx-auto flex items-center gap-3">
        {backHref ? (
          <button
            type="button"
            aria-label="Go back"
            onClick={() => router.push(backHref)}
            className="w-9 h-9 shrink-0 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
        ) : (
          <Link
            href="/dashboard"
            aria-label="ClassRank home"
            className="w-9 h-9 shrink-0 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold font-label-mono-sm"
          >
            CR
          </Link>
        )}

        <div className="min-w-0 flex-1">
          {subtitle && (
            <span className="block font-label-mono-sm text-label-mono-sm uppercase text-primary tracking-wide truncate">
              {subtitle}
            </span>
          )}
          <h1 className="font-headline-sm text-headline-sm text-on-surface leading-tight truncate">{title}</h1>
        </div>

        {action}
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="w-9 h-9 shrink-0 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  );
}
