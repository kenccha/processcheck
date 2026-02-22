"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import { useRequireAuth } from "@/contexts/AuthContext";
import {
  subscribeChecklistItemsByAssignee,
  subscribeProjects,
  subscribeNotifications,
  markNotificationRead,
} from "@/lib/firestoreService";
import { getStatusLabel, getRiskColor } from "@/lib/mockData";
import type { ChecklistItem, Notification, Project } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, loading } = useRequireAuth();

  const [myTasks, setMyTasks] = useState<ChecklistItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ChecklistItem[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<ChecklistItem[]>([]);

  // 프로젝트 실시간 구독
  useEffect(() => {
    const unsub = subscribeProjects((projects) => {
      setAllProjects(projects);
    });
    return unsub;
  }, []);

  // 내 작업 실시간 구독 (assignee 기준)
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeChecklistItemsByAssignee(currentUser.name, (items) => {
      setAllTasks(items);
    });
    return unsub;
  }, [currentUser]);

  // 알림 실시간 구독 (올바른 userId 사용 - 버그 수정)
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeNotifications(currentUser.id, (notifs) => {
      setNotifications(notifs.slice(0, 5));
    });
    return unsub;
  }, [currentUser?.id]);

  // 파생 데이터 계산
  useEffect(() => {
    if (!allTasks.length) return;

    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // 오늘 할 일: 마감일 3일 이내, pending/in_progress
    const todayTasks = allTasks
      .filter((item) => {
        if (item.status !== "pending" && item.status !== "in_progress") return false;
        const due = new Date(item.dueDate);
        return due <= threeDaysLater;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    setMyTasks(todayTasks);

    // 승인 대기: 내가 완료 처리했지만 아직 manager가 검토 안 한 것
    // approvalStatus가 없거나 "pending"인 completed 항목
    const approvals = allTasks.filter(
      (item) =>
        item.status === "completed" &&
        (!item.approvalStatus || item.approvalStatus === "pending")
    );
    setPendingApprovals(approvals);
  }, [allTasks]);

  // 내 프로젝트 계산
  useEffect(() => {
    if (!allTasks.length || !allProjects.length) return;
    const myProjectIds = new Set(allTasks.map((t) => t.projectId));
    const active = allProjects.filter(
      (p) => p.status === "active" && myProjectIds.has(p.id)
    );
    setMyProjects(active);
  }, [allTasks, allProjects]);

  const handleNotifClick = async (notif: Notification) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
    }
    if (notif.link) router.push(notif.link);
  };

  const formatDate = (date: Date) => {
    const diff = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}일 지연`;
    if (diff === 0) return "오늘 마감";
    if (diff === 1) return "내일 마감";
    return `${diff}일 남음`;
  };

  const getDateColor = (date: Date) => {
    const diff = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return "text-danger-600";
    if (diff <= 1) return "text-danger-500";
    if (diff <= 3) return "text-warning-500";
    return "text-gray-600";
  };

  const formatTimeAgo = (date: Date) => {
    const diff = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            안녕하세요, {currentUser.name}님! 👋
          </h1>
          <p className="text-gray-600">
            {myTasks.length > 0 ? (
              <>
                <span className="font-medium text-primary-600">{myTasks.length}개</span>의 작업이 대기 중입니다.
                {myTasks.filter((t) => new Date(t.dueDate) < new Date()).length > 0 && (
                  <span className="ml-2 text-danger-600 font-medium">
                    ({myTasks.filter((t) => new Date(t.dueDate) < new Date()).length}개 지연)
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
            <div className="text-3xl font-bold text-warning-500">{pendingApprovals.length}</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-sm">진행 중 프로젝트</span>
              <span className="text-2xl">🚀</span>
            </div>
            <div className="text-3xl font-bold text-primary-600">{myProjects.length}</div>
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
          {/* 좌측 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 오늘 할 일 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">📋 오늘 할 일</h2>
                <span className="text-sm text-gray-500">{myTasks.length}개 작업</span>
              </div>

              <div className="space-y-3">
                {myTasks.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">할 일이 없습니다 ✨</p>
                ) : (
                  myTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/projects/${task.projectId}/tasks/${task.id}`)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 mb-1">{task.title}</h3>
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
                        <span className="text-gray-500">검토자: {task.reviewer}</span>
                        <span className={`font-medium ${getDateColor(task.dueDate)}`}>
                          {formatDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 승인 대기 */}
            {pendingApprovals.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">⏳ 승인 대기 중</h2>
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
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                          완료됨
                        </span>
                        <span className="text-xs text-gray-500">
                          {task.completedDate &&
                            new Date(task.completedDate).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-1">{task.title}</h3>
                      <p className="text-sm text-gray-600">{task.department} · {task.stage.replace(/_/g, " ")}</p>
                      <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-warning-200">
                        <span className="text-gray-600">검토자: {task.reviewer}</span>
                        <span className="text-warning-700 font-medium">승인 대기 중 ⏳</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 내 프로젝트 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">🚀 내 프로젝트</h2>
                <button
                  onClick={() => router.push("/projects")}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  전체 보기 →
                </button>
              </div>
              <div className="space-y-3">
                {myProjects.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">참여 중인 프로젝트가 없습니다.</p>
                ) : (
                  myProjects.slice(0, 3).map((project) => (
                    <div
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-gray-50 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900 mb-1">{project.name}</h3>
                          <p className="text-sm text-gray-600">
                            {project.productType} · PM: {project.pm}
                          </p>
                        </div>
                        <span
                          className={`w-3 h-3 rounded-full ${getRiskColor(project.riskLevel)}`}
                          title={`위험도: ${project.riskLevel}`}
                        />
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{project.progress}%</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 우측: 알림 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">🔔 최근 알림</h2>
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-center text-gray-500 py-4 text-sm">알림이 없습니다.</p>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        notif.read
                          ? "border-gray-200 bg-white"
                          : "border-primary-200 bg-primary-50"
                      }`}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-900">{notif.title}</h4>
                        {!notif.read && (
                          <span className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{notif.message}</p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(notif.createdAt)}</p>
                    </div>
                  ))
                )}
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
