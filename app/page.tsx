"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { seedDatabaseIfEmpty } from "@/lib/firestoreService";

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, login } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(true);

  // 이미 로그인된 경우 대시보드로
  useEffect(() => {
    if (currentUser) {
      router.push("/dashboard");
    }
  }, [currentUser, router]);

  // 앱 초기 로드 시 Firestore 시드 확인
  useEffect(() => {
    seedDatabaseIfEmpty()
      .catch((e) => console.warn("시드 오류 (무시 가능):", e))
      .finally(() => setSeeding(false));
  }, []);

  const handleRoleLogin = async (role: "worker" | "manager" | "observer") => {
    setLoading(role);
    try {
      // 시드된 대표 사용자로 바로 로그인
      const userMap = {
        worker: "김철수",
        manager: "이영희",
        observer: "박민수",
      };
      await login(userMap[role], role);
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const roleCards = [
    {
      role: "worker" as const,
      label: "실무자",
      user: "김철수",
      dept: "개발팀",
      description: "체크리스트 작업 수행 · 완료 보고",
      color: "primary",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
      ),
    },
    {
      role: "manager" as const,
      label: "매니저",
      user: "이영희",
      dept: "개발팀",
      description: "부서 작업 검토 · 승인/반려",
      color: "warning",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      role: "observer" as const,
      label: "기획조정실",
      user: "박민수",
      dept: "경영관리팀",
      description: "전체 프로젝트 현황 모니터링 · 옵저버",
      color: "success",
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
  ];

  if (seeding) {
    return (
      <main className="min-h-screen bg-surface-0 bg-grid flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-noise pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] rounded-full bg-primary-500/5 blur-3xl" />
        <div className="relative text-center animate-fade-in">
          <div className="w-14 h-14 border-[3px] border-primary-500/30 border-t-primary-400 rounded-full animate-spin mx-auto mb-5" />
          <p className="text-slate-400 text-sm tracking-wide font-medium">시스템 초기화 중...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-0 bg-grid flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-noise pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-500/[0.04] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary-900/10 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 opacity-0 animate-fade-in">
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow mb-5 relative">
            <div className="absolute inset-[1px] rounded-2xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            <span className="font-mono text-2xl font-bold text-white tracking-tighter relative z-10">PC</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight mb-2 glow-text">
            ProcessCheck
          </h1>
          <p className="text-slate-500 text-sm tracking-wide">
            개발 프로세스 관리 시스템
          </p>
        </div>

        {/* Role Cards */}
        <div className="space-y-4 opacity-0 animate-fade-in-delay-1">
          <p className="text-center text-sm text-slate-400 mb-6">역할을 선택하여 시작하세요</p>

          <div className="grid grid-cols-1 gap-3">
            {roleCards.map((card, i) => {
              const isLoading = loading === card.role;
              const colorMap = {
                primary: {
                  border: "border-primary-500/60",
                  bg: "bg-primary-500/10",
                  hoverBorder: "hover:border-primary-500/40",
                  text: "text-primary-400",
                  iconBg: "bg-primary-500/15",
                },
                warning: {
                  border: "border-warning-400/60",
                  bg: "bg-warning-400/10",
                  hoverBorder: "hover:border-warning-400/40",
                  text: "text-warning-400",
                  iconBg: "bg-warning-400/15",
                },
                success: {
                  border: "border-success-500/60",
                  bg: "bg-success-500/10",
                  hoverBorder: "hover:border-success-500/40",
                  text: "text-success-400",
                  iconBg: "bg-success-500/15",
                },
              };
              const c = colorMap[card.color as keyof typeof colorMap];

              return (
                <button
                  key={card.role}
                  onClick={() => handleRoleLogin(card.role)}
                  disabled={loading !== null}
                  className={`group relative w-full p-5 rounded-2xl border transition-all duration-200 text-left flex items-center gap-5 ${
                    isLoading
                      ? `${c.border} ${c.bg}`
                      : `border-surface-3 bg-surface-2 ${c.hoverBorder} hover:bg-surface-3`
                  } disabled:opacity-60 disabled:cursor-not-allowed ${
                    i === 0 ? "animate-fade-in" : i === 1 ? "animate-fade-in-delay-1" : "animate-fade-in-delay-2"
                  }`}
                >
                  <div className={`w-14 h-14 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0 ${c.text}`}>
                    {isLoading ? (
                      <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      card.icon
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-lg font-semibold ${isLoading ? c.text : "text-slate-100 group-hover:" + c.text}`}>
                        {card.label}
                      </span>
                      <span className="text-xs font-mono text-slate-500 bg-surface-3 px-2 py-0.5 rounded">
                        {card.user}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{card.description}</p>
                    <p className="text-xs text-slate-600 mt-1 font-mono">{card.dept}</p>
                  </div>
                  <svg className={`w-5 h-5 text-slate-600 group-hover:${c.text} transition-colors flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-8 tracking-wider opacity-0 animate-fade-in-delay-4 font-mono">
          Firebase Firestore 연동 · 실시간 데이터 동기화
        </p>
      </div>
    </main>
  );
}
