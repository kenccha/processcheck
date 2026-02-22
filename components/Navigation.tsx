"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeNotifications } from "@/lib/firestoreService";
import { useEffect, useState } from "react";
import type { Notification } from "@/lib/types";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeNotifications(currentUser.id, (notifs: Notification[]) => {
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });
    return unsub;
  }, [currentUser?.id]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const getRoleName = (role: string) => {
    const map: Record<string, string> = {
      worker: "실무자",
      manager: "매니저",
      pm: "PM (기획조정실)",
    };
    return map[role] || role;
  };

  const navLinks = [
    { href: "/dashboard", label: "대시보드", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
      </svg>
    )},
    { href: "/projects", label: "프로젝트", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    )},
    { href: "/admin/checklists", label: "체크리스트", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )},
  ];

  return (
    <nav className="sticky top-0 z-50 bg-surface-1/80 backdrop-blur-xl border-b border-surface-3">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <button onClick={() => router.push("/dashboard")} className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
                <span className="text-white font-bold text-xs tracking-tighter">PC</span>
              </div>
              <span className="text-base font-semibold text-slate-100 tracking-tight hidden sm:block">
                Process<span className="text-primary-400">Check</span>
              </span>
            </button>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <button
                    key={link.href}
                    onClick={() => router.push(link.href)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-primary-500/10 text-primary-300 shadow-inner-light"
                        : "text-slate-400 hover:text-slate-200 hover:bg-surface-3/50"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <button onClick={() => router.push("/dashboard")} className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-surface-3/50 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-surface-1 animate-pulse-soft" />
              )}
            </button>

            {/* User info */}
            {currentUser && (
              <div className="flex items-center gap-3 pl-3 border-l border-surface-3">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-medium text-slate-200 leading-tight">{currentUser.name}</div>
                  <div className="text-xs text-slate-500 leading-tight">{getRoleName(currentUser.role)}</div>
                </div>
                <button
                  onClick={handleLogout}
                  title="로그아웃"
                  className="p-2 text-slate-500 hover:text-slate-300 hover:bg-surface-3/50 rounded-lg transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-200 hover:bg-surface-3/50 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-surface-3 mt-2 animate-fade-in">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <button
                    key={link.href}
                    onClick={() => { router.push(link.href); setMobileOpen(false); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary-500/10 text-primary-300"
                        : "text-slate-400 hover:text-slate-200 hover:bg-surface-3/50"
                    }`}
                  >
                    {link.icon}
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
