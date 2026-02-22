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
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">시스템 초기화 중...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">PC</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ProcessCheck</h1>
          <p className="text-gray-600">개발 프로세스 관리 시스템</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">시스템 로그인</h2>

          {/* Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setError(""); }}
              placeholder="홍길동"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              disabled={loading}
            />
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">역할 선택</label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => setSelectedRole(role.value)}
                  disabled={loading}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedRole === role.value
                      ? "border-primary-600 bg-primary-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-2">{role.icon}</div>
                  <div className="text-sm font-semibold text-gray-900">{role.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{role.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-4 p-3 bg-danger-100 border border-danger-200 rounded-lg text-sm text-danger-700">
              {error}
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              <span>로그인</span>
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Firebase Firestore 연동 · 실시간 데이터 동기화
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">© 2026 ProcessCheck. All rights reserved.</p>
      </div>
    </main>
  );
}
