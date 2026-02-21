"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<UserRole>("worker");
  const [userName, setUserName] = useState("");

  const handleLogin = () => {
    if (!userName.trim()) {
      alert("이름을 입력해주세요");
      return;
    }

    // 임시로 localStorage에 사용자 정보 저장
    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        name: userName,
        role: selectedRole,
      })
    );

    // 역할에 따라 다른 대시보드로 이동
    router.push("/dashboard");
  };

  const roles = [
    {
      value: "worker" as UserRole,
      label: "실무자",
      description: "체크리스트 작업 수행",
      icon: "👨‍💻",
    },
    {
      value: "manager" as UserRole,
      label: "부서 관리자",
      description: "작업 검토 및 승인",
      icon: "👔",
    },
    {
      value: "pm" as UserRole,
      label: "프로세스 관리자",
      description: "전체 프로세스 모니터링",
      icon: "📊",
    },
    {
      value: "scheduler" as UserRole,
      label: "일정 관리자",
      description: "일정 및 마감일 관리",
      icon: "📅",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">PC</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ProcessCheck
          </h1>
          <p className="text-gray-600">개발 프로세스 관리 시스템</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            시스템 로그인
          </h2>

          {/* Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이름
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="홍길동"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              역할 선택
            </label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map((role) => (
                <button
                  key={role.value}
                  onClick={() => setSelectedRole(role.value)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedRole === role.value
                      ? "border-primary-600 bg-primary-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-2xl mb-2">{role.icon}</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {role.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {role.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            className="w-full py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold shadow-sm"
          >
            로그인
          </button>

          {/* Demo Note */}
          <p className="text-center text-xs text-gray-500 mt-4">
            데모 버전: Firebase 연동 전 Mock Data 사용 중
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 ProcessCheck. All rights reserved.
        </p>
      </div>
    </main>
  );
}
