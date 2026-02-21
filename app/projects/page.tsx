"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  mockProjects,
  mockChecklistItems,
  departments,
  projectStages,
  formatStageName,
  getRiskColor,
  getStatusLabel as getTaskStatusLabel,
} from "@/lib/mockData";
import { ChecklistItem, Department, Project, ProjectStage } from "@/lib/types";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "on_hold">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<
    "cards" | "table" | "gantt" | "kanban" | "timeline" | "calendar" | "matrix"
  >("cards");

  useEffect(() => {
    // 로그인 확인
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
      router.push("/");
      return;
    }

    setProjects(mockProjects);
  }, [router]);

  const filteredProjects = projects.filter((project) => {
    const matchesFilter = filter === "all" || project.status === filter;
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.productType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getProjectStatusLabel = (status: Project["status"]) => {
    switch (status) {
      case "active":
        return "진행 중";
      case "completed":
        return "완료";
      case "on_hold":
        return "보류";
    }
  };

  const getStatusColor = (status: Project["status"]) => {
    switch (status) {
      case "active":
        return "bg-primary-100 text-primary-700";
      case "completed":
        return "bg-success-100 text-success-700";
      case "on_hold":
        return "bg-gray-100 text-gray-700";
    }
  };

  const filteredProjectIds = useMemo(() => {
    return new Set(filteredProjects.map((project) => project.id));
  }, [filteredProjects]);

  const filteredTasks = useMemo(() => {
    return mockChecklistItems.filter((item) => filteredProjectIds.has(item.projectId));
  }, [filteredProjectIds]);

  const ganttRange = useMemo(() => {
    if (filteredProjects.length === 0) {
      return {
        start: new Date(),
        end: new Date(),
        totalDays: 1,
      };
    }
    const start = new Date(
      Math.min(...filteredProjects.map((project) => project.startDate.getTime()))
    );
    const end = new Date(
      Math.max(...filteredProjects.map((project) => project.endDate.getTime()))
    );
    const totalDays = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
    return { start, end, totalDays };
  }, [filteredProjects]);

  const kanbanColumns: { key: ChecklistItem["status"]; label: string }[] = [
    { key: "pending", label: "대기" },
    { key: "in_progress", label: "진행 중" },
    { key: "completed", label: "완료" },
    { key: "rejected", label: "반려" },
  ];

  const matrixCellStatus = (stage: ProjectStage, dept: Department) => {
    const tasks = filteredTasks.filter(
      (item) => item.stage === stage && item.department === dept
    );

    if (tasks.length === 0) {
      return { status: "none", count: 0, total: 0 };
    }

    const completed = tasks.filter((task) => task.status === "completed").length;
    const inProgress = tasks.filter((task) => task.status === "in_progress").length;

    if (completed === tasks.length) {
      return { status: "completed", count: completed, total: tasks.length };
    }
    if (inProgress > 0) {
      return { status: "in_progress", count: completed, total: tasks.length };
    }
    return { status: "pending", count: completed, total: tasks.length };
  };

  const getMatrixCellColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success-500";
      case "in_progress":
        return "bg-primary-500";
      case "pending":
        return "bg-gray-300";
      case "none":
        return "bg-gray-100";
    }
  };

  const currentMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  const calendarDays = useMemo(() => {
    const startDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const totalDays = endDay.getDate();
    const startWeekday = startDay.getDay();
    const cells: { date: Date | null; tasks: ChecklistItem[] }[] = [];

    for (let i = 0; i < startWeekday; i += 1) {
      cells.push({ date: null, tasks: [] });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const tasks = filteredTasks.filter(
        (task) => task.dueDate.toDateString() === date.toDateString()
      );
      cells.push({ date, tasks });
    }

    return cells;
  }, [currentMonth, filteredTasks]);

  const timelineItems = useMemo(() => {
    return [...filteredTasks].sort(
      (a, b) => a.dueDate.getTime() - b.dueDate.getTime()
    );
  }, [filteredTasks]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation - Same as Dashboard */}
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
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  대시보드
                </a>
                <a
                  href="/projects"
                  className="text-primary-600 font-medium border-b-2 border-primary-600 pb-1"
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
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem("currentUser");
                  router.push("/");
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 font-medium"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">프로젝트</h1>
            <p className="text-gray-600">
              {filteredProjects.length}개의 프로젝트
            </p>
          </div>

          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center space-x-2">
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>새 프로젝트</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col space-y-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="프로젝트명, 제품 종류 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Status Filter */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "all"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setFilter("active")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "active"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  진행 중
                </button>
                <button
                  onClick={() => setFilter("completed")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "completed"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  완료
                </button>
                <button
                  onClick={() => setFilter("on_hold")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === "on_hold"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  보류
                </button>
              </div>

              {/* View Selector */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "cards", label: "카드" },
                  { key: "table", label: "테이블" },
                  { key: "gantt", label: "간트" },
                  { key: "kanban", label: "칸반" },
                  { key: "timeline", label: "타임라인" },
                  { key: "calendar", label: "캘린더" },
                  { key: "matrix", label: "매트릭스" },
                ].map((view) => (
                  <button
                    key={view.key}
                    onClick={() =>
                      setViewMode(
                        view.key as
                          | "cards"
                          | "table"
                          | "gantt"
                          | "kanban"
                          | "timeline"
                          | "calendar"
                          | "matrix"
                      )
                    }
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === view.key
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* View Content */}
        {viewMode === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:border-primary-300 hover:shadow-lg transition-all cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {getProjectStatusLabel(project.status)}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${getRiskColor(project.riskLevel)}`}
                        title={`위험도: ${project.riskLevel}`}
                      ></span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-600">{project.productType}</p>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      진행률
                    </span>
                    <span className="text-sm font-bold text-primary-600">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${project.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Stage */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">현재 단계</div>
                  <div className="text-sm font-medium text-gray-900">
                    {project.currentStage.replace(/_/g, " ")}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">PM:</span> {project.pm}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(project.endDate).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    까지
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "table" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">프로젝트</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">진행률</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">현재 단계</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">PM</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">종료일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProjects.map((project) => (
                  <tr
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{project.name}</div>
                      <div className="text-xs text-gray-500">{project.productType}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {getProjectStatusLabel(project.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${project.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {project.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {project.currentStage.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{project.pm}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(project.endDate).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === "gantt" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-6">
              <span>
                시작: {ganttRange.start.toLocaleDateString("ko-KR")}
              </span>
              <span>
                종료: {ganttRange.end.toLocaleDateString("ko-KR")}
              </span>
            </div>
            <div className="space-y-4">
              {filteredProjects.map((project) => {
                const startOffset = Math.max(
                  0,
                  Math.floor(
                    (project.startDate.getTime() - ganttRange.start.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                );
                const duration = Math.max(
                  1,
                  Math.ceil(
                    (project.endDate.getTime() - project.startDate.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                );
                const leftPercent = (startOffset / ganttRange.totalDays) * 100;
                const widthPercent = (duration / ganttRange.totalDays) * 100;
                return (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <button
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="font-medium text-gray-900 hover:text-primary-600"
                      >
                        {project.name}
                      </button>
                      <span className="text-gray-500">
                        {project.startDate.toLocaleDateString("ko-KR")} ~{" "}
                        {project.endDate.toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <div className="relative h-3 bg-gray-100 rounded-full">
                      <div
                        className="absolute top-0 h-3 rounded-full bg-primary-600"
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {kanbanColumns.map((column) => (
              <div key={column.key} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">{column.label}</h3>
                  <span className="text-xs text-gray-500">
                    {filteredTasks.filter((task) => task.status === column.key).length}개
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredTasks
                    .filter((task) => task.status === column.key)
                    .map((task) => (
                      <div
                        key={task.id}
                        onClick={() =>
                          router.push(`/projects/${task.projectId}/tasks/${task.id}`)
                        }
                        className="p-3 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-gray-50 transition-all cursor-pointer"
                      >
                        <div className="text-xs text-gray-500 mb-1">
                          {task.department} · {formatStageName(task.stage)}
                        </div>
                        <div className="text-sm font-medium text-gray-900 mb-2">
                          {task.title}
                        </div>
                        <div className="text-xs text-gray-500">
                          마감: {task.dueDate.toLocaleDateString("ko-KR")}
                        </div>
                      </div>
                    ))}
                  {filteredTasks.filter((task) => task.status === column.key).length ===
                    0 && (
                    <div className="text-xs text-gray-400 text-center py-6">
                      작업 없음
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "timeline" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-6">
              {timelineItems.map((task) => (
                <div key={task.id} className="flex items-start space-x-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary-600"></div>
                    <div className="w-px flex-1 bg-gray-200"></div>
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="text-xs text-gray-500 mb-1">
                      {task.dueDate.toLocaleDateString("ko-KR")} · {task.department}
                    </div>
                    <button
                      onClick={() =>
                        router.push(`/projects/${task.projectId}/tasks/${task.id}`)
                      }
                      className="text-sm font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {task.title}
                    </button>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatStageName(task.stage)} · {getTaskStatusLabel(task.status)}
                    </div>
                  </div>
                </div>
              ))}
              {timelineItems.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  표시할 작업이 없습니다
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === "calendar" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentMonth.toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                })}
              </h2>
              <span className="text-sm text-gray-500">
                마감 작업 {filteredTasks.length}개
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 text-xs text-gray-500 mb-2">
              {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
                <div key={label} className="text-center">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((cell, index) => (
                <div
                  key={`${cell.date?.toDateString() || "empty"}-${index}`}
                  className="min-h-[92px] border border-gray-200 rounded-lg p-2 text-xs bg-white"
                >
                  {cell.date && (
                    <>
                      <div className="text-gray-700 font-medium mb-1">
                        {cell.date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {cell.tasks.slice(0, 2).map((task) => (
                          <button
                            key={task.id}
                            onClick={() =>
                              router.push(`/projects/${task.projectId}/tasks/${task.id}`)
                            }
                            className="block text-left w-full truncate text-xs text-primary-700"
                            title={task.title}
                          >
                            {task.title}
                          </button>
                        ))}
                        {cell.tasks.length > 2 && (
                          <div className="text-gray-400">
                            +{cell.tasks.length - 2}건
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === "matrix" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-300 bg-gray-50 p-2 text-left text-sm font-medium text-gray-700 sticky left-0 z-10">
                      부서 / 단계
                    </th>
                    {projectStages.map((stage) => (
                      <th
                        key={stage}
                        className="border border-gray-300 bg-gray-50 p-2 text-center text-xs font-medium text-gray-700 min-w-[80px]"
                      >
                        {stage.split("_")[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept}>
                      <td className="border border-gray-300 bg-white p-2 text-sm font-medium text-gray-900 sticky left-0 z-10">
                        {dept}
                      </td>
                      {projectStages.map((stage) => {
                        const cellData = matrixCellStatus(stage, dept);
                        return (
                          <td
                            key={`${stage}-${dept}`}
                            className="border border-gray-300 p-2 text-center"
                          >
                            <div className="flex items-center justify-center">
                              <div
                                className={`w-8 h-8 rounded-full ${getMatrixCellColor(
                                  cellData.status
                                )} flex items-center justify-center`}
                              >
                                {cellData.status !== "none" && (
                                  <span className="text-xs text-white font-medium">
                                    {cellData.count}/{cellData.total}
                                  </span>
                                )}
                                {cellData.status === "none" && (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredProjects.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              프로젝트가 없습니다
            </h3>
            <p className="text-gray-600 mb-6">
              새 프로젝트를 생성하거나 검색 조건을 변경해보세요.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
