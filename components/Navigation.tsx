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
      manager: "부서 관리자",
      pm: "프로세스 관리자",
      scheduler: "일정 관리자",
    };
    return map[role] || role;
  };

  const navLinks = [
    { href: "/dashboard", label: "대시보드" },
    { href: "/projects", label: "프로젝트" },
    { href: "/admin/checklists", label: "체크리스트 관리" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* 로고 + 메뉴 */}
          <div className="flex items-center space-x-8">
            <button onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PC</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">ProcessCheck</span>
            </button>

            <div className="hidden md:flex space-x-6">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.href);
                return (
                  <button
                    key={link.href}
                    onClick={() => router.push(link.href)}
                    className={`text-sm font-medium transition-colors pb-1 ${
                      isActive
                        ? "text-primary-600 border-b-2 border-primary-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 우측: 알림 + 유저 */}
          <div className="flex items-center space-x-4">
            {/* 알림 아이콘 */}
            <button className="relative p-2 text-gray-600 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
              )}
            </button>

            {/* 유저 정보 + 로그아웃 */}
            {currentUser && (
              <div className="flex items-center space-x-3 border-l border-gray-200 pl-4">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{currentUser.name}</div>
                  <div className="text-xs text-gray-500">{getRoleName(currentUser.role)}</div>
                </div>
                <button
                  onClick={handleLogout}
                  title="로그아웃"
                  className="p-2 text-gray-600 hover:text-gray-900"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
