"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navigation from "@/components/Navigation";
import { useRequireAuth } from "@/contexts/AuthContext";
import {
  subscribeProjects,
  subscribeAllChecklistItems,
  createProject,
} from "@/lib/firestoreService";
import {
  departments,
  formatStageName,
  getRiskColor,
  getStatusLabel as getTaskStatusLabel,
} from "@/lib/mockData";
import type { ChecklistItem, Department, Project } from "@/lib/types";
import { PHASE_GROUPS } from "@/lib/types";

export default function ProjectsPage() {
  const router = useRouter();
  const { currentUser, loading } = useRequireAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<ChecklistItem[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "on_hold">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<
    "cards" | "table" | "gantt" | "kanban" | "timeline" | "calendar" | "matrix"
  >("table");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    productType: "",
    pm: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });
  const [creating, setCreating] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "status" | "progress" | "currentStage" | "pm" | "endDate">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // 실시간 프로젝트 구독
  useEffect(() => {
    const unsub = subscribeProjects(setProjects);
    return unsub;
  }, []);

  // 실시간 체크리스트 아이템 구독
  useEffect(() => {
    const unsub = subscribeAllChecklistItems(setAllTasks);
    return unsub;
  }, []);

  const filteredProjects = projects.filter((project) => {
    const matchesFilter = filter === "all" || project.status === filter;
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.productType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name": cmp = a.name.localeCompare(b.name, "ko"); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "progress": cmp = a.progress - b.progress; break;
        case "currentStage": cmp = a.currentStage.localeCompare(b.currentStage, "ko"); break;
        case "pm": cmp = a.pm.localeCompare(b.pm, "ko"); break;
        case "endDate": cmp = new Date(a.endDate).getTime() - new Date(b.endDate).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredProjects, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: typeof sortKey }) => (
    <span className="inline-block ml-1 text-[10px]">
      {sortKey === columnKey ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  const getProjectStatusLabel = (status: Project["status"]) => {
    switch (status) {
      case "active": return "진행 중";
      case "completed": return "완료";
      case "on_hold": return "보류";
    }
  };

  const getStatusColor = (status: Project["status"]) => {
    switch (status) {
      case "active": return "badge-primary";
      case "completed": return "badge-success";
      case "on_hold": return "badge-neutral";
    }
  };

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((p) => p.id)),
    [filteredProjects]
  );

  const filteredTasks = useMemo(
    () => allTasks.filter((item) => filteredProjectIds.has(item.projectId)),
    [allTasks, filteredProjectIds]
  );

  const ganttRange = useMemo(() => {
    if (filteredProjects.length === 0) return { start: new Date(), end: new Date(), totalDays: 1 };
    const start = new Date(Math.min(...filteredProjects.map((p) => new Date(p.startDate).getTime())));
    const end = new Date(Math.max(...filteredProjects.map((p) => new Date(p.endDate).getTime())));
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { start, end, totalDays };
  }, [filteredProjects]);

  const kanbanColumns: { key: ChecklistItem["status"]; label: string }[] = [
    { key: "pending", label: "대기" },
    { key: "in_progress", label: "진행 중" },
    { key: "completed", label: "완료" },
    { key: "rejected", label: "반려" },
  ];

  // 페이즈 병합 매트릭스 셀 (workStage + gateStage 합산)
  const phaseCellStatus = (phaseIndex: number, dept: Department) => {
    const phase = PHASE_GROUPS[phaseIndex];
    const tasks = filteredTasks.filter(
      (item) => (item.stage === phase.workStage || item.stage === phase.gateStage) && item.department === dept
    );
    if (tasks.length === 0) return { status: "none", count: 0, total: 0 };
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    if (completed === tasks.length) return { status: "completed", count: completed, total: tasks.length };
    if (inProgress > 0) return { status: "in_progress", count: completed, total: tasks.length };
    return { status: "pending", count: completed, total: tasks.length };
  };

  const getMatrixCellColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success-500";
      case "in_progress": return "bg-primary-500";
      case "pending": return "bg-surface-4";
      default: return "bg-surface-3";
    }
  };

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const calendarDays = useMemo(() => {
    const startDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const totalDays = endDay.getDate();
    const startWeekday = startDay.getDay();
    const cells: { date: Date | null; tasks: ChecklistItem[] }[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, tasks: [] });
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const tasks = filteredTasks.filter(
        (task) => new Date(task.dueDate).toDateString() === date.toDateString()
      );
      cells.push({ date, tasks });
    }
    return cells;
  }, [currentMonth, filteredTasks]);

  const timelineItems = useMemo(
    () => [...filteredTasks].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [filteredTasks]
  );

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.productType || !newProject.pm || !newProject.endDate) return;
    setCreating(true);
    try {
      await createProject({
        name: newProject.name,
        productType: newProject.productType,
        projectType: "신규개발",
        pm: newProject.pm,
        startDate: new Date(newProject.startDate),
        endDate: new Date(newProject.endDate),
        status: "active",
        progress: 0,
        currentStage: "발의검토",
        riskLevel: "green",
      });
      setShowCreateModal(false);
      setNewProject({ name: "", productType: "", pm: "", startDate: new Date().toISOString().split("T")[0], endDate: "" });
    } catch {
      alert("프로젝트 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-surface-0 bg-grid">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 tracking-tight mb-1">
              프로젝트
            </h1>
            <p className="text-slate-500 font-mono text-sm">
              <span className="text-primary-400">{filteredProjects.length}</span>개의 프로젝트
            </p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>새 프로젝트</span>
          </button>
        </div>

        {/* Filters + View Toggle */}
        <div className="card p-4 mb-6 animate-fade-in-delay-1 opacity-0">
          <div className="flex flex-col space-y-4">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="프로젝트명, 제품 종류 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-12"
              />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Filter buttons */}
              <div className="flex flex-wrap gap-2">
                {(["all", "active", "completed", "on_hold"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      filter === f
                        ? "bg-primary-500 text-white shadow-glow-sm"
                        : "bg-surface-3 text-slate-400 hover:bg-surface-4 hover:text-slate-200"
                    }`}
                  >
                    {f === "all" ? "전체" : f === "active" ? "진행 중" : f === "completed" ? "완료" : "보류"}
                  </button>
                ))}
              </div>

              {/* View mode segmented control */}
              <div className="flex flex-wrap bg-surface-3 rounded-xl p-1 gap-0.5">
                {[
                  { key: "table", label: "테이블" },
                  { key: "matrix", label: "매트릭스" },
                  { key: "cards", label: "카드" },
                  { key: "gantt", label: "간트" },
                  { key: "kanban", label: "칸반" },
                  { key: "timeline", label: "타임라인" },
                  { key: "calendar", label: "캘린더" },
                ].map((view) => (
                  <button
                    key={view.key}
                    onClick={() => setViewMode(view.key as typeof viewMode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      viewMode === view.key
                        ? "bg-primary-500 text-white shadow-glow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── 카드 뷰 ── */}
        {viewMode === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project, i) => (
              <div
                key={project.id}
                onClick={() => router.push(`/project?id=${project.id}`)}
                className={`card-hover p-5 cursor-pointer opacity-0 ${
                  i % 4 === 0 ? "animate-fade-in" :
                  i % 4 === 1 ? "animate-fade-in-delay-1" :
                  i % 4 === 2 ? "animate-fade-in-delay-2" : "animate-fade-in-delay-3"
                }`}
              >
                {/* Status + Risk */}
                <div className="flex items-center space-x-2 mb-3">
                  <span className={getStatusColor(project.status)}>
                    {getProjectStatusLabel(project.status)}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${getRiskColor(project.riskLevel)}`} title={`위험도: ${project.riskLevel}`} />
                </div>

                {/* Name + Type */}
                <h3 className="text-base font-semibold text-slate-100 mb-1 tracking-tight">
                  {project.name}
                </h3>
                <p className="text-sm text-slate-500 mb-4">{project.productType}</p>

                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">진행률</span>
                    <span className="text-sm font-bold font-mono text-primary-400">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-surface-3 rounded-full h-1.5">
                    <div
                      className="bg-primary-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {/* Current stage */}
                <div className="mb-4 p-3 bg-surface-1 rounded-xl border border-surface-3">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-0.5">현재 단계</div>
                  <div className="text-sm font-medium text-slate-200">{project.currentStage}</div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-surface-3">
                  <div className="text-xs text-slate-400">
                    <span className="text-slate-500">PM</span>{" "}
                    <span className="text-slate-300">{project.pm}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    {new Date(project.endDate).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}까지
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 테이블 뷰 ── */}
        {viewMode === "table" && (
          <div className="card overflow-hidden animate-fade-in">
            <table className="min-w-full divide-y divide-surface-3 text-sm">
              <thead className="bg-surface-2">
                <tr>
                  <th onClick={() => toggleSort("name")} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">프로젝트<SortIcon columnKey="name" /></th>
                  <th onClick={() => toggleSort("status")} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">상태<SortIcon columnKey="status" /></th>
                  <th onClick={() => toggleSort("progress")} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">진행률<SortIcon columnKey="progress" /></th>
                  <th onClick={() => toggleSort("currentStage")} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">현재 단계<SortIcon columnKey="currentStage" /></th>
                  <th onClick={() => toggleSort("pm")} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">PM<SortIcon columnKey="pm" /></th>
                  <th onClick={() => toggleSort("endDate")} className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">종료일<SortIcon columnKey="endDate" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-3">
                {sortedProjects.map((project, i) => (
                  <tr
                    key={project.id}
                    onClick={() => router.push(`/project?id=${project.id}`)}
                    className={`cursor-pointer transition-colors duration-150 hover:bg-surface-2 ${
                      i % 2 === 0 ? "bg-surface-1" : "bg-surface-0"
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-200">{project.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{project.productType}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={getStatusColor(project.status)}>
                        {getProjectStatusLabel(project.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-24 bg-surface-3 rounded-full h-1.5">
                          <div className="bg-primary-500 h-1.5 rounded-full" style={{ width: `${project.progress}%` }} />
                        </div>
                        <span className="text-sm font-mono font-medium text-primary-400">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-sm">{project.currentStage}</td>
                    <td className="px-5 py-3.5 text-slate-300 text-sm">{project.pm}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-500 text-sm">{new Date(project.endDate).toLocaleDateString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 간트 뷰 ── */}
        {viewMode === "gantt" && (
          <div className="card p-6 animate-fade-in">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-6 pb-3 border-b border-surface-3">
              <span>
                시작 <span className="text-slate-300">{ganttRange.start.toLocaleDateString("ko-KR")}</span>
              </span>
              <span>
                종료 <span className="text-slate-300">{ganttRange.end.toLocaleDateString("ko-KR")}</span>
              </span>
            </div>
            <div className="space-y-5">
              {filteredProjects.map((project) => {
                const startOffset = Math.max(0, Math.floor((new Date(project.startDate).getTime() - ganttRange.start.getTime()) / (1000 * 60 * 60 * 24)));
                const duration = Math.max(1, Math.ceil((new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) / (1000 * 60 * 60 * 24)));
                const leftPercent = (startOffset / ganttRange.totalDays) * 100;
                const widthPercent = (duration / ganttRange.totalDays) * 100;
                return (
                  <div key={project.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <button
                        onClick={() => router.push(`/project?id=${project.id}`)}
                        className="font-medium text-slate-200 hover:text-primary-400 transition-colors"
                      >
                        {project.name}
                      </button>
                      <span className="font-mono text-xs text-slate-500">
                        {new Date(project.startDate).toLocaleDateString("ko-KR")} ~ {new Date(project.endDate).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <div className="relative h-3 bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 h-3 rounded-full bg-primary-500 shadow-glow-sm transition-all"
                        style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 칸반 뷰 ── */}
        {viewMode === "kanban" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-fade-in">
            {kanbanColumns.map((column, ci) => (
              <div
                key={column.key}
                className={`bg-surface-2 rounded-2xl border border-surface-3 p-4 opacity-0 ${
                  ci === 0 ? "animate-fade-in" :
                  ci === 1 ? "animate-fade-in-delay-1" :
                  ci === 2 ? "animate-fade-in-delay-2" : "animate-fade-in-delay-3"
                }`}
              >
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-surface-3">
                  <h3 className="text-sm font-semibold text-slate-200 tracking-tight">{column.label}</h3>
                  <span className="font-mono text-xs text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-md">
                    {filteredTasks.filter((t) => t.status === column.key).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredTasks.filter((t) => t.status === column.key).map((task) => (
                    <div
                      key={task.id}
                      onClick={() => router.push(`/task?projectId=${task.projectId}&taskId=${task.id}`)}
                      className="p-3 bg-surface-1 border border-surface-3 rounded-xl hover:border-primary-500/30 hover:shadow-glow-sm transition-all duration-200 cursor-pointer"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
                        {task.department} / {formatStageName(task.stage)}
                      </div>
                      <div className="text-sm font-medium text-slate-200 mb-2">{task.title}</div>
                      <div className="text-xs font-mono text-slate-500">
                        마감 {new Date(task.dueDate).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                  ))}
                  {filteredTasks.filter((t) => t.status === column.key).length === 0 && (
                    <div className="text-xs text-slate-500 text-center py-8 border border-dashed border-surface-3 rounded-xl">
                      작업 없음
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 타임라인 뷰 ── */}
        {viewMode === "timeline" && (
          <div className="card p-6 animate-fade-in">
            <div className="space-y-0">
              {timelineItems.map((task, i) => (
                <div key={task.id} className="flex items-start space-x-4">
                  {/* Vertical line + dot */}
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary-500 shadow-glow-sm ring-4 ring-surface-2" />
                    {i < timelineItems.length - 1 && (
                      <div className="w-px flex-1 bg-surface-3 min-h-[40px]" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="text-xs font-mono text-slate-500 mb-1">
                      {new Date(task.dueDate).toLocaleDateString("ko-KR")}
                      <span className="mx-1.5 text-surface-4">|</span>
                      <span className="text-slate-400">{task.department}</span>
                    </div>
                    <button
                      onClick={() => router.push(`/task?projectId=${task.projectId}&taskId=${task.id}`)}
                      className="text-sm font-semibold text-slate-200 hover:text-primary-400 transition-colors"
                    >
                      {task.title}
                    </button>
                    <div className="text-xs text-slate-500 mt-1">
                      {formatStageName(task.stage)} / {getTaskStatusLabel(task.status)}
                    </div>
                  </div>
                </div>
              ))}
              {timelineItems.length === 0 && (
                <div className="text-center text-slate-500 py-12">표시할 작업이 없습니다</div>
              )}
            </div>
          </div>
        )}

        {/* ── 캘린더 뷰 ── */}
        {viewMode === "calendar" && (
          <div className="card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-surface-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="section-title">
                  {currentMonth.toLocaleDateString("ko-KR", { year: "numeric", month: "long" })}
                </h2>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => { const now = new Date(); setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1)); }}
                  className="ml-2 px-2.5 py-1 text-xs font-medium text-slate-400 bg-surface-3 hover:bg-surface-4 hover:text-slate-200 rounded-lg transition-colors"
                >
                  오늘
                </button>
              </div>
              <span className="font-mono text-xs text-slate-500">
                마감 작업 <span className="text-primary-400">{filteredTasks.length}</span>개
              </span>
            </div>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
                <div key={label} className="text-center text-[10px] uppercase tracking-widest font-semibold text-slate-500 py-1">
                  {label}
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((cell, index) => (
                <div
                  key={`${cell.date?.toDateString() || "empty"}-${index}`}
                  className={`min-h-[92px] rounded-xl p-2 text-xs border transition-colors ${
                    cell.date
                      ? "bg-surface-1 border-surface-3 hover:border-surface-4"
                      : "bg-transparent border-transparent"
                  }`}
                >
                  {cell.date && (
                    <>
                      <div className={`font-mono font-medium mb-1.5 ${
                        cell.date.toDateString() === new Date().toDateString()
                          ? "text-primary-400 glow-text"
                          : "text-slate-400"
                      }`}>
                        {cell.date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {cell.tasks.slice(0, 2).map((task) => (
                          <button
                            key={task.id}
                            onClick={() => router.push(`/task?projectId=${task.projectId}&taskId=${task.id}`)}
                            className="block text-left w-full truncate text-[11px] text-primary-400 hover:text-primary-300 transition-colors"
                            title={task.title}
                          >
                            {task.title}
                          </button>
                        ))}
                        {cell.tasks.length > 2 && (
                          <div className="font-mono text-slate-500">+{cell.tasks.length - 2}건</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 매트릭스 뷰 ── */}
        {viewMode === "matrix" && (
          <div className="card p-6 animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-surface-3 bg-surface-2 p-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 sticky left-0 z-10">
                      부서 / 페이즈
                    </th>
                    {PHASE_GROUPS.map((phase) => (
                      <th
                        key={phase.name}
                        className="border border-surface-3 bg-surface-2 p-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-400 min-w-[100px]"
                      >
                        <div>{phase.name}</div>
                        <div className="text-[9px] text-slate-600 font-normal normal-case mt-0.5">
                          {formatStageName(phase.workStage)} + {formatStageName(phase.gateStage)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept}>
                      <td className="border border-surface-3 bg-surface-1 p-3 text-sm font-medium text-slate-200 sticky left-0 z-10">
                        {dept}
                      </td>
                      {PHASE_GROUPS.map((phase, phaseIdx) => {
                        const cellData = phaseCellStatus(phaseIdx, dept);
                        return (
                          <td key={`${phase.name}-${dept}`} className="border border-surface-3 bg-surface-0 p-2 text-center">
                            <div className="flex items-center justify-center">
                              <div className={`w-10 h-10 rounded-lg ${getMatrixCellColor(cellData.status)} flex items-center justify-center transition-colors`}>
                                {cellData.status !== "none" ? (
                                  <span className="text-[11px] font-mono text-white font-medium">
                                    {cellData.count}/{cellData.total}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-500">-</span>
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

        {/* ── Empty state ── */}
        {filteredProjects.length === 0 && (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-surface-2 border border-surface-3 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">프로젝트가 없습니다</h3>
            <p className="text-slate-500 text-sm">새 프로젝트를 생성하거나 검색 조건을 변경해보세요.</p>
          </div>
        )}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
            <div className="bg-surface-2 border border-surface-3 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-slate-100 mb-6">새 프로젝트</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">프로젝트명 *</label>
                  <input type="text" className="input-field" placeholder="예: 스마트 워치 2세대" value={newProject.name} onChange={(e) => setNewProject({...newProject, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">제품 종류 *</label>
                  <input type="text" className="input-field" placeholder="예: 스마트 워치" value={newProject.productType} onChange={(e) => setNewProject({...newProject, productType: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">PM *</label>
                  <input type="text" className="input-field" placeholder="담당 PM 이름" value={newProject.pm} onChange={(e) => setNewProject({...newProject, pm: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1.5">시작일</label>
                    <input type="date" className="input-field" value={newProject.startDate} onChange={(e) => setNewProject({...newProject, startDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1.5">종료일 *</label>
                    <input type="date" className="input-field" value={newProject.endDate} onChange={(e) => setNewProject({...newProject, endDate: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-surface-3">
                <button onClick={() => setShowCreateModal(false)} className="btn-secondary">취소</button>
                <button onClick={handleCreateProject} disabled={creating || !newProject.name || !newProject.productType || !newProject.pm || !newProject.endDate} className="btn-primary disabled:opacity-50">
                  {creating ? "생성 중..." : "프로젝트 생성"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
