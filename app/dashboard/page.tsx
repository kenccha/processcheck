"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  mockProjects,
  mockChecklistItems,
  mockNotifications,
  getStatusLabel,
  getRiskColor,
} from "@/lib/mockData";
import { ChecklistItem, Notification, Project } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [myTasks, setMyTasks] = useState<ChecklistItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ChecklistItem[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // 로그인 확인
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
      router.push("/");
      return;
    }

    const user = JSON.parse(userStr);
    setUserName(user.name);
    setUserRole(user.role);

    // 내 작업 필터링: assignee가 나인 작업
    const myAssignedTasks = mockChecklistItems.filter(
      (item) => item.assignee === user.name
    );

    // 오늘 할 일: 마감일이 오늘이거나 지났거나 3일 이내, pending 또는 in_progress 상태
    const now = new Date();
    now.setHours(0, 0, 0, 0); // 오늘 00:00:00
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const todayTasks = myAssignedTasks.filter((item) => {
      if (item.status !== "pending" && item.status !== "in_progress") {
        return false;
      }
      const dueDate = new Date(item.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate <= threeDaysLater; // 3일 이내 또는 지연
    });
    
    // 마감일 순으로 정렬 (지연된 것 먼저)
    todayTasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    setMyTasks(todayTasks);

    // 승인 대기 중인 작업: 내가 완료했지만 아직 승인되지 않은 작업
    const approvals = myAssignedTasks.filter(
      (item) => item.status === "completed"
    );
    setPendingApprovals(approvals);

    // 내 프로젝트: 내가 작업을 하나라도 가지고 있는 프로젝트
    const myProjectIds = new Set(myAssignedTasks.map((task) => task.projectId));
    const myActiveProjects = mockProjects.filter(
      (p) => p.status === "active" && myProjectIds.has(p.id)
    );
    setMyProjects(myActiveProjects);

    // 내 알림만 필터링
    const myNotifs = mockNotifications.filter(
      (notif) => notif.userId === "user1" // 임시로 user1 고정, 실제로는 user.id 사용
    );
    myNotifs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    setNotifications(myNotifs.slice(0, 5));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/");
  };

  const getRoleName = (role: string) => {
    const roleMap: { [key: string]: string } = {
      worker: "실무자",
      manager: "부서 관리자",
      pm: "프로세스 관리자",
      scheduler: "일정 관리자",
    };
    return roleMap[role] || role;
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return `${Math.abs(diff)}일 지연`;
    if (diff === 0) return "오늘 마감";
    if (diff === 1) return "내일 마감";
    return `${diff}일 남음`;
  };

  const getDateColor = (date: Date) => {
    const diff = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) return "text-danger-600";
    if (diff <= 1) return "text-danger-500";
    if (diff <= 3) return "text-warning-500";
    return "text-gray-600";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PC</span>
                </div>
                <span className="text-xl font-semibold text-gray-900">
                  ProcessCheck
                </span>
              </div>
              <div className="hidden md:flex space-x-6">
                <a
                  href="/dashboard"
                  className="text-primary-600 font-medium border-b-2 border-primary-600 pb-1"
                >
                  대시보드
                </a>
                <a
                  href="/projects"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  프로젝트
                </a>
                <a
                  href="/admin/checklists"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  체크리스트 관리
                </a>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <button className="relative p-2 text-gray-600 hover:text-gray-900">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full"></span>
                )}
              </button>

              {/* User Menu */}
              <div className="flex items-center space-x-3 border-l border-gray-200 pl-4">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {userName}
                  </div>
                  <div className="text-xs text-gray-500">{getRoleName(userRole)}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:text-gray-900"
                  title="로그아웃"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            안녕하세요, {userName}님! 👋
          </h1>
          <p className="text-gray-600">
            {myTasks.length > 0 ? (
              <>
                <span className="font-medium text-primary-600">{myTasks.length}개</span>의 작업이 대기 중입니다.
                {myTasks.filter(t => new Date(t.dueDate) < new Date()).length > 0 && (
                  <span className="ml-2 text-danger-600 font-medium">
                    ({myTasks.filter(t => new Date(t.dueDate) < new Date()).length}개 지연)
                  </span>
                )}
              </>
            ) : (
              "오늘 할 일이 없습니다. 좋은 하루 되세요!"
            )}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">오늘 할 일</span>
              <span className="text-2xl">📋</span>
            </div>
            <div className="text-3xl font-bold text-gray-900">{myTasks.length}</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">승인 대기</span>
              <span className="text-2xl">⏳</span>
            </div>
            <div className="text-3xl font-bold text-warning-500">
              {pendingApprovals.length}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">진행 중 프로젝트</span>
              <span className="text-2xl">🚀</span>
            </div>
            <div className="text-3xl font-bold text-primary-600">
              {myProjects.length}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">읽지 않은 알림</span>
              <span className="text-2xl">🔔</span>
            </div>
            <div className="text-3xl font-bold text-danger-500">
              {notifications.filter((n) => !n.read).length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Tasks */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Tasks */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  📋 오늘 할 일
                </h2>
                <span className="text-sm text-gray-500">
                  {myTasks.length}개 작업
                </span>
              </div>

              <div className="space-y-3">
                {myTasks.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    할 일이 없습니다 ✨
                  </p>
                ) : (
                  myTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/projects/${task.projectId}/tasks/${task.id}`)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-1">
                            {task.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            {task.department} · {task.stage.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            task.status === "pending"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-primary-100 text-primary-700"
                          }`}
                        >
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          검토자: {task.reviewer}
                        </span>
                        <span className={`font-medium ${getDateColor(task.dueDate)}`}>
                          {formatDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pending Approvals */}
            {pendingApprovals.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    ⏳ 승인 대기 중
                  </h2>
                  <span className="text-sm text-warning-600 font-medium">
                    {pendingApprovals.length}개 작업
                  </span>
                </div>

                <div className="space-y-3">
                  {pendingApprovals.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/projects/${task.projectId}/tasks/${task.id}`)}
                      className="p-4 border-2 border-warning-200 bg-warning-50 rounded-lg hover:border-warning-400 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                              완료됨
                            </span>
                            <span className="text-xs text-gray-500">
                              {task.completedDate &&
                                new Date(task.completedDate).toLocaleDateString("ko-KR")}
                            </span>
                          </div>
                          <h3 className="font-medium text-gray-900 mb-1">
                            {task.title}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {task.department} · {task.stage.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-warning-200">
                        <span className="text-gray-600">
                          검토자: {task.reviewer}
                        </span>
                        <span className="text-warning-700 font-medium">
                          승인 대기 중 ⏳
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Projects */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  🚀 내 프로젝트
                </h2>
                <button
                  onClick={() => router.push("/projects")}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  전체 보기 →
                </button>
              </div>

              <div className="space-y-3">
                {myProjects.slice(0, 3).map((project) => (
                  <div
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">
                          {project.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {project.productType} · PM: {project.pm}
                        </p>
                      </div>
                      <span
                        className={`w-3 h-3 rounded-full ${getRiskColor(project.riskLevel)}`}
                        title={`위험도: ${project.riskLevel}`}
                      ></span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {project.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Notifications */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                🔔 최근 알림
              </h2>

              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      notif.read
                        ? "border-gray-200 bg-white"
                        : "border-primary-200 bg-primary-50"
                    }`}
                    onClick={() => notif.link && router.push(notif.link)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-primary-600 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{notif.message}</p>
                    <p className="text-xs text-gray-500">
                      {(() => {
                        const diff = Math.floor((new Date().getTime() - new Date(notif.createdAt).getTime()) / 1000);
                        if (diff < 60) return "방금 전";
                        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
                        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
                        return `${Math.floor(diff / 86400)}일 전`;
                      })()}
                    </p>
                  </div>
                ))}
              </div>

              <button className="w-full mt-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium">
                모든 알림 보기
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
