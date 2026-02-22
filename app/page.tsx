"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { seedDatabaseIfEmpty } from "@/lib/firestoreService";
import type { UserRole } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>("worker");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(true);
  const [error, setError] = useState("");

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

  const handleLogin = async () => {
    if (!userName.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(userName.trim(), selectedRole);
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
      setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: "worker" as UserRole, label: "실무자", description: "체크리스트 작업 수행", icon: "👨‍💻" },
    { value: "manager" as UserRole, label: "부서 관리자", description: "작업 검토 및 승인", icon: "👔" },
    { value: "pm" as UserRole, label: "프로세스 관리자", description: "전체 프로세스 모니터링", icon: "📊" },
    { value: "scheduler" as UserRole, label: "일정 관리자", description: "일정 및 마감일 관리", icon: "📅" },
  ];

  if (seeding) {
    return (
      <main className="min-h-screen bg-surface-0 bg-grid flex items-center justify-center relative overflow-hidden">
        {/* Background noise overlay */}
        <div className="absolute inset-0 bg-noise pointer-events-none" />
        {/* Radial glow behind spinner */}
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
      {/* Background noise overlay */}
      <div className="absolute inset-0 bg-noise pointer-events-none" />

      {/* Ambient glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-500/[0.04] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary-900/10 blur-[80px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10 opacity-0 animate-fade-in">
          <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow mb-5 relative">
            {/* Inner subtle shine */}
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

        {/* Login Form */}
        <div className="bg-surface-2 border border-surface-3 rounded-2xl p-8 shadow-glow-sm opacity-0 animate-fade-in-delay-1 relative overflow-hidden">
          {/* Card top edge highlight */}
          <div className="absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />

          <h2 className="text-lg font-semibold text-slate-100 tracking-tight mb-7">
            시스템 로그인
          </h2>

          {/* Name Input */}
          <div className="mb-7 opacity-0 animate-fade-in-delay-2">
            <label className="block text-sm font-medium text-slate-400 mb-2.5 tracking-wide">
              이름
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setError(""); }}
              placeholder="홍길동"
              className="input-field"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              disabled={loading}
            />
          </div>

          {/* Role Selection */}
          <div className="mb-7 opacity-0 animate-fade-in-delay-3">
            <label className="block text-sm font-medium text-slate-400 mb-3 tracking-wide">
              역할 선택
            </label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => setSelectedRole(role.value)}
                  disabled={loading}
                  className={`group relative p-4 rounded-xl border transition-all duration-200 text-left ${
                    selectedRole === role.value
                      ? "border-primary-500/60 bg-primary-500/10 shadow-glow-sm"
                      : "border-surface-3 bg-surface-1 hover:border-surface-4 hover:bg-surface-2"
                  }`}
                >
                  {/* Selected indicator dot */}
                  {selectedRole === role.value && (
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
                  )}
                  <div className="text-2xl mb-2">{role.icon}</div>
                  <div className={`text-sm font-semibold mb-0.5 ${
                    selectedRole === role.value ? "text-primary-300" : "text-slate-200"
                  }`}>
                    {role.label}
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    {role.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-5 p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-sm text-danger-400 flex items-start gap-2">
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Login Button */}
          <div className="opacity-0 animate-fade-in-delay-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-400 active:bg-primary-600 transition-all duration-150 font-semibold shadow-glow-sm hover:shadow-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-glow-sm flex items-center justify-center gap-2.5"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>로그인 중...</span>
                </>
              ) : (
                <span>로그인</span>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-slate-600 mt-5 tracking-wide font-mono">
            Firebase Firestore 연동 · 실시간 데이터 동기화
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-8 tracking-wider opacity-0 animate-fade-in-delay-4">
          &copy; 2026 ProcessCheck. All rights reserved.
        </p>
      </div>
    </main>
  );
}
