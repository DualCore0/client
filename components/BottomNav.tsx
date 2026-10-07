"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: "dashboard" },
    { name: "Rooms", path: "/rooms", icon: "meeting_room" },
    { name: "Tests", path: "/tests", icon: "assignment" },
    { name: "Ranks", path: "/leaderboard", icon: "leaderboard" },
    { name: "Profile", path: "/profile", icon: "account_circle" },
  ];

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.04)] hide-on-keyboard">
      <div className="h-16 px-space-2xs flex items-center justify-around">
        {navItems.map((item) => {
          // Simple active check
          const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
          
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex flex-col items-center justify-center min-w-[56px] h-12 transition-colors ${
                isActive ? "text-primary font-semibold" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[22px]" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                {item.icon}
              </span>
              <span className="font-label-mono-sm text-label-mono-sm uppercase mt-0.5">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
