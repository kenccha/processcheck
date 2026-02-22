"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User, UserRole } from "@/lib/types";
import { getUserByName, createUser } from "@/lib/firestoreService";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (name: string, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // localStorage에서 세션 복원
    try {
      const stored = localStorage.getItem("pc_user");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {
      localStorage.removeItem("pc_user");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (name: string, role: UserRole) => {
    // Firestore에서 같은 이름의 유저 찾기
    let user = await getUserByName(name);

    if (!user) {
      // 없으면 새 유저 생성
      user = await createUser({
        name,
        email: `${name.replace(/\s/g, "").toLowerCase()}@processcheck.com`,
        role,
        department: "개발팀", // 기본값; 실제로는 선택 UI 추가 가능
      });
    }

    // 역할은 입력된 것으로 덮어쓰기 (데모 편의상)
    const sessionUser = { ...user, role };
    localStorage.setItem("pc_user", JSON.stringify(sessionUser));
    setCurrentUser(sessionUser);
  };

  const logout = () => {
    localStorage.removeItem("pc_user");
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** 로그인 필요 페이지에서 사용하는 가드 훅 */
export function useRequireAuth() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/");
    }
  }, [currentUser, loading, router]);

  return { currentUser, loading };
}
