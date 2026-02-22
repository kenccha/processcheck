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
  const [showAllNotifs, setShowAllNotifs] = useState(false);

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
      setNotifications(notifs);
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
    if (diff < 0) return "text-danger-400";
    if (diff <= 1) return "text-danger-400";
    if (diff <= 3) return "text-warning-400";
    return "text-slate-500";
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
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-500 font-mono tracking-wider uppercase">시스템 로딩</span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const overdueCount = myTasks.filter((t) => new Date(t.dueDate) < new Date()).length;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-surface-0 bg-grid">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-8 bg-primary-500 rounded-full shadow-glow-sm" />
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              {currentUser.name}
            </h1>
            <span className="text-sm font-mono text-slate-500 bg-surface-2 px-2.5 py-0.5 rounded border border-surface-3">
              {currentUser.role === "pm" ? "PM (기획조정실)" : currentUser.role === "manager" ? "매니저" : "실무자"}
            </span>
          </div>
          <p className="text-slate-400 ml-5 pl-0.5">
            {myTasks.length > 0 ? (
              <>
                <span className="font-mono font-semibold text-primary-400">{myTasks.length}개</span>
                <span className="text-slate-500"> 작업 대기 중</span>
                {overdueCount > 0 && (
                  <span className="ml-3 inline-flex items-center gap-1.5 text-danger-400 font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    {overdueCount}개 지연
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500">대기 중인 작업이 없습니다.</span>
            )}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* 오늘 할 일 */}
          <div className="animate-fade-in bg-surface-2 border border-surface-3 rounded-lg p-5 hover:border-primary-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 uppercase tracking-wider font-mono">작업 대기</span>
              <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 transition-colors">
                <svg className="w-4.5 h-4.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              </div>
            </div>
            <div className="stat-value text-slate-100 shadow-glow-sm">{myTasks.length}</div>
          </div>

          {/* 승인 대기 */}
          <div className="animate-fade-in-delay-1 bg-surface-2 border border-surface-3 rounded-lg p-5 hover:border-warning-400/30 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 uppercase tracking-wider font-mono">승인 대기</span>
              <div className="w-9 h-9 rounded-lg bg-warning-400/10 flex items-center justify-center group-hover:bg-warning-400/20 transition-colors">
                <svg className="w-4.5 h-4.5 text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="stat-value text-warning-400">{pendingApprovals.length}</div>
          </div>

          {/* 진행 중 프로젝트 */}
          <div className="animate-fade-in-delay-2 bg-surface-2 border border-surface-3 rounded-lg p-5 hover:border-primary-500/30 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 uppercase tracking-wider font-mono">프로젝트</span>
              <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 transition-colors">
                <svg className="w-4.5 h-4.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
            </div>
            <div className="stat-value text-primary-400">{myProjects.length}</div>
          </div>

          {/* 알림 */}
          <div className="animate-fade-in-delay-3 bg-surface-2 border border-surface-3 rounded-lg p-5 hover:border-danger-400/30 transition-all duration-300 group relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500 uppercase tracking-wider font-mono">미확인 알림</span>
              <div className="w-9 h-9 rounded-lg bg-danger-400/10 flex items-center justify-center group-hover:bg-danger-400/20 transition-colors relative">
                <svg className="w-4.5 h-4.5 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger-400 rounded-full animate-pulse" />
                )}
              </div>
            </div>
            <div className="stat-value text-danger-400">{unreadCount}</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* 오늘 할 일 */}
            <div className="animate-fade-in-delay-1 bg-surface-2 border border-surface-3 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-primary-500 rounded-full" />
                  <h2 className="section-title">작업 대기</h2>
                </div>
                <span className="text-xs font-mono text-slate-500 bg-surface-3 px-2.5 py-1 rounded">
                  {myTasks.length}건
                </span>
              </div>

              <div className="divide-y divide-surface-3">
                {myTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm">대기 중인 작업이 없습니다</p>
                  </div>
                ) : (
                  myTasks.map((task) => {
                    const isOverdue = new Date(task.dueDate) < new Date();
                    const borderColor = isOverdue
                      ? "border-l-danger-400"
                      : task.status === "in_progress"
                        ? "border-l-primary-400"
                        : "border-l-slate-600";

                    return (
                      <div
                        key={task.id}
                        onClick={() => router.push(`/task?projectId=${task.projectId}&taskId=${task.id}`)}
                        className={`px-6 py-4 border-l-2 ${borderColor} hover:bg-surface-3/50 transition-all duration-200 cursor-pointer group`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-200 group-hover:text-primary-400 transition-colors truncate">
                              {task.title}
                            </h3>
                            <p className="text-sm text-slate-500 mt-0.5 font-mono">
                              {task.department} / {task.stage.replace(/_/g, " ")}
                            </p>
                          </div>
                          <span
                            className={`ml-3 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${
                              task.status === "pending"
                                ? "badge-neutral"
                                : "badge-primary"
                            }`}
                          >
                            {getStatusLabel(task.status)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">
                            <span className="text-slate-600">검토:</span> {task.reviewer}
                          </span>
                          <span className={`font-mono font-medium ${getDateColor(task.dueDate)}`}>
                            {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 승인 대기 */}
            {pendingApprovals.length > 0 && (
              <div className="animate-fade-in-delay-2 bg-surface-2 border border-surface-3 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
                  <div className="flex items-center gap-3">
                    <div className="w-1 h-5 bg-warning-400 rounded-full" />
                    <h2 className="section-title">승인 대기</h2>
                  </div>
                  <span className="text-xs font-mono text-warning-400 bg-warning-400/10 px-2.5 py-1 rounded border border-warning-400/20">
                    {pendingApprovals.length}건
                  </span>
                </div>
                <div className="divide-y divide-surface-3">
                  {pendingApprovals.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/task?projectId=${task.projectId}&taskId=${task.id}`)}
                      className="px-6 py-4 border-l-2 border-l-warning-400 hover:bg-surface-3/50 transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="badge-success text-xs font-mono">완료</span>
                        <span className="text-xs text-slate-600 font-mono">
                          {task.completedDate &&
                            new Date(task.completedDate).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <h3 className="font-medium text-slate-200 group-hover:text-warning-400 transition-colors mb-1">
                        {task.title}
                      </h3>
                      <p className="text-sm text-slate-500 font-mono">
                        {task.department} / {task.stage.replace(/_/g, " ")}
                      </p>
                      <div className="flex items-center justify-between text-xs mt-3 pt-3 border-t border-surface-3">
                        <span className="text-slate-500">
                          <span className="text-slate-600">검토:</span> {task.reviewer}
                        </span>
                        <span className="text-warning-400 font-mono font-medium flex items-center gap-1.5">
                          <svg className="w-3 h-3 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="4" />
                          </svg>
                          승인 대기
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 내 프로젝트 */}
            <div className="animate-fade-in-delay-2 bg-surface-2 border border-surface-3 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-primary-500 rounded-full" />
                  <h2 className="section-title">프로젝트</h2>
                </div>
                <button
                  onClick={() => router.push("/projects")}
                  className="btn-ghost text-xs font-mono flex items-center gap-1 hover:text-primary-400 transition-colors"
                >
                  전체 보기
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
              <div className="divide-y divide-surface-3">
                {myProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <svg className="w-10 h-10 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <p className="text-sm">참여 중인 프로젝트가 없습니다</p>
                  </div>
                ) : (
                  myProjects.slice(0, 3).map((project) => (
                    <div
                      key={project.id}
                      onClick={() => router.push(`/project?id=${project.id}`)}
                      className="px-6 py-4 hover:bg-surface-3/50 transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-slate-200 group-hover:text-primary-400 transition-colors truncate">
                            {project.name}
                          </h3>
                          <p className="text-sm text-slate-500 mt-0.5 font-mono">
                            {project.productType} / PM: {project.pm}
                          </p>
                        </div>
                        <span
                          className={`ml-3 flex-shrink-0 w-2.5 h-2.5 rounded-full ring-2 ring-surface-2 ${getRiskColor(project.riskLevel)}`}
                          title={`위험도: ${project.riskLevel}`}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-surface-3 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-primary-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-medium text-slate-400 tabular-nums w-10 text-right">
                          {project.progress}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Notifications */}
          <div className="lg:col-span-1">
            <div className="animate-fade-in-delay-3 bg-surface-2 border border-surface-3 rounded-lg overflow-hidden sticky top-8">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-3">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 bg-primary-500 rounded-full" />
                  <h2 className="section-title text-base">알림</h2>
                </div>
                {unreadCount > 0 && (
                  <span className="text-xs font-mono text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full border border-primary-500/20">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="divide-y divide-surface-3">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                    <svg className="w-8 h-8 text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    <p className="text-xs">알림이 없습니다</p>
                  </div>
                ) : (
                  (showAllNotifs ? notifications : notifications.slice(0, 5)).map((notif) => (
                    <div
                      key={notif.id}
                      className={`px-5 py-3.5 transition-all duration-200 cursor-pointer group ${
                        notif.read
                          ? "hover:bg-surface-3/40"
                          : "bg-primary-500/5 hover:bg-primary-500/10"
                      }`}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div className="flex items-start gap-2.5">
                        {!notif.read && (
                          <span className="w-1.5 h-1.5 bg-primary-400 rounded-full flex-shrink-0 mt-1.5 shadow-glow-sm" />
                        )}
                        <div className={`flex-1 min-w-0 ${notif.read ? "ml-4" : ""}`}>
                          <h4 className="text-sm font-medium text-slate-300 group-hover:text-slate-100 transition-colors truncate">
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-xs text-slate-600 font-mono mt-1.5">{formatTimeAgo(notif.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-5 py-3 border-t border-surface-3">
                <button onClick={() => setShowAllNotifs(!showAllNotifs)} className="w-full py-1.5 text-xs font-mono text-slate-500 hover:text-primary-400 transition-colors tracking-wider uppercase">
                  {showAllNotifs ? "최근 알림만 보기" : "모든 알림 보기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
