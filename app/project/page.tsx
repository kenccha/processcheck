"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navigation from "@/components/Navigation";
import { useRequireAuth } from "@/contexts/AuthContext";
import {
  subscribeChecklistItems,
  subscribeChangeRequests,
  subscribeProjects,
  createChangeRequest,
  updateChangeRequest,
} from "@/lib/firestoreService";
import {
  departments,
  projectStages,
  getStatusLabel,
  getRiskColor,
} from "@/lib/mockData";
import type { Project, ChecklistItem, ChangeRequest, ProjectStage, Department } from "@/lib/types";

type TabType = "overview" | "checklist" | "files" | "changes";

function ProjectDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id") || "";
  const { currentUser, loading } = useRequireAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [selectedStage, setSelectedStage] = useState<ProjectStage | "all">("all");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "all">("all");
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false);
  const [newChangeRequest, setNewChangeRequest] = useState({
    title: "",
    description: "",
    scale: "medium" as "major" | "medium" | "minor",
    affectedDepartments: [] as string[],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 프로젝트 실시간 구독 (전체 중 ID 필터링)
  useEffect(() => {
    const unsub = subscribeProjects((projects) => {
      const found = projects.find((p) => p.id === projectId);
      if (!found) {
        setProjectNotFound(true);
      } else {
        setProject(found);
        setProjectNotFound(false);
      }
    });
    return unsub;
  }, [projectId]);

  // 체크리스트 항목 실시간 구독
  useEffect(() => {
    const unsub = subscribeChecklistItems(projectId, (items) => {
      setChecklistItems(items);
    });
    return unsub;
  }, [projectId]);

  // 설계 변경 실시간 구독
  useEffect(() => {
    const unsub = subscribeChangeRequests(projectId, (changes) => {
      setChangeRequests(changes);
    });
    return unsub;
  }, [projectId]);

  // 프로젝트 없음 처리
  useEffect(() => {
    if (projectNotFound) {
      router.push("/projects");
    }
  }, [projectNotFound, router]);

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">프로젝트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 통계 계산
  const totalTasks = checklistItems.length;
  const completedTasks = checklistItems.filter((t) => t.status === "completed").length;
  const inProgressTasks = checklistItems.filter((t) => t.status === "in_progress").length;
  const delayedTasks = checklistItems.filter(
    (t) => t.status !== "completed" && new Date(t.dueDate) < new Date()
  ).length;
  // 버그 수정: completed AND (approvalStatus가 없거나 "pending")인 항목만 승인 대기
  const pendingApprovalsCount = checklistItems.filter(
    (t) => t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending")
  ).length;

  // 필터링된 작업들
  const filteredItems = checklistItems.filter((item) => {
    const matchesStage = selectedStage === "all" || item.stage === selectedStage;
    const matchesDept = selectedDepartment === "all" || item.department === selectedDepartment;
    return matchesStage && matchesDept;
  });

  // 매트릭스 데이터
  const getMatrixCellData = (stage: ProjectStage, dept: Department) => {
    const tasks = checklistItems.filter(
      (item) => item.stage === stage && item.department === dept
    );
    if (tasks.length === 0) return { status: "none", count: 0, total: 0 };
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    if (completed === tasks.length) return { status: "completed", count: completed, total: tasks.length };
    if (inProgress > 0) return { status: "in_progress", count: completed, total: tasks.length };
    return { status: "pending", count: completed, total: tasks.length };
  };

  const getDepartmentProgress = (dept: Department) => {
    const deptTasks = checklistItems.filter((item) => item.department === dept);
    if (deptTasks.length === 0) return 0;
    const completed = deptTasks.filter((item) => item.status === "completed").length;
    return Math.round((completed / deptTasks.length) * 100);
  };

  const getStageProgress = (stage: ProjectStage) => {
    const stageTasks = checklistItems.filter((item) => item.stage === stage);
    if (stageTasks.length === 0) return 0;
    const completed = stageTasks.filter((item) => item.status === "completed").length;
    return Math.round((completed / stageTasks.length) * 100);
  };

  const getMatrixCellColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success-500";
      case "in_progress": return "bg-primary-500";
      case "pending": return "bg-surface-4";
      default: return "bg-surface-3";
    }
  };

  const getStatusColor = (status: ChecklistItem["status"]) => {
    switch (status) {
      case "pending": return "bg-slate-500/15 text-slate-400 border-slate-500/20";
      case "in_progress": return "bg-primary-500/15 text-primary-300 border-primary-500/20";
      case "completed": return "bg-success-500/15 text-success-400 border-success-500/20";
      case "rejected": return "bg-danger-500/15 text-danger-400 border-danger-500/20";
    }
  };

  const handleMatrixCellClick = (stage: ProjectStage, dept: Department) => {
    setSelectedStage(stage);
    setSelectedDepartment(dept);
    setActiveTab("checklist");
    setTimeout(() => {
      const element = document.getElementById(`dept-${dept}`);
      if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-surface-0">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {/* Project Header */}
        <div className="bg-surface-2 border border-surface-3 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                <h1 className="text-3xl font-bold text-slate-100 tracking-tight">{project.name}</h1>
                <span
                  className={`w-3 h-3 rounded-full ${getRiskColor(project.riskLevel)}`}
                  title={`위험도: ${project.riskLevel}`}
                />
              </div>
              <div className="flex items-center space-x-4 text-sm text-slate-400">
                <span>{project.productType}</span>
                <span className="text-slate-500">|</span>
                <span>PM: {project.pm}</span>
                <span className="text-slate-500">|</span>
                <span>
                  {new Date(project.startDate).toLocaleDateString("ko-KR")} ~{" "}
                  {new Date(project.endDate).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-mono font-bold text-primary-400 glow-text mb-1">{project.progress}%</div>
              <div className="text-sm text-slate-500">전체 진행률</div>
            </div>
          </div>

          <div className="w-full bg-surface-3 rounded-full h-2 mb-4">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{ width: `${project.progress}%` }}
            />
          </div>

          <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/30">
            <div className="text-sm font-medium text-primary-300 mb-1">현재 단계</div>
            <div className="text-lg font-semibold text-primary-300">
              {project.currentStage.replace(/_/g, " - ")}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-surface-2 rounded-2xl border border-surface-3 mb-6">
          <div className="flex border-b border-surface-3">
            {(["overview", "checklist", "files", "changes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "border-b-2 border-primary-400 text-primary-400"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {tab === "overview" && "개요"}
                {tab === "checklist" && `체크리스트 (${totalTasks})`}
                {tab === "files" && "파일"}
                {tab === "changes" && `설계 변경 (${changeRequests.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-surface-2 p-6 rounded-2xl border border-surface-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">전체 작업</span>
                </div>
                <div className="stat-value text-slate-100">{totalTasks}</div>
                <div className="text-sm text-slate-500 mt-1">완료: <span className="font-mono">{completedTasks}</span>개</div>
              </div>

              <div className="bg-surface-2 p-6 rounded-2xl border border-surface-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">진행 중</span>
                </div>
                <div className="stat-value text-primary-400">{inProgressTasks}</div>
                <div className="text-sm text-slate-500 mt-1">
                  <span className="font-mono">{totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0}</span>%
                </div>
              </div>

              <div className="bg-surface-2 p-6 rounded-2xl border border-surface-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">지연</span>
                </div>
                <div className="stat-value text-danger-400">{delayedTasks}</div>
                <div className="text-sm text-slate-500 mt-1">긴급 조치 필요</div>
              </div>

              <div className="bg-surface-2 p-6 rounded-2xl border border-surface-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">승인 대기</span>
                </div>
                <div className="stat-value text-warning-400">{pendingApprovalsCount}</div>
                <div className="text-sm text-slate-500 mt-1">검토 필요</div>
              </div>
            </div>

            {/* Stage Progress */}
            <div className="bg-surface-2 rounded-2xl border border-surface-3 p-6">
              <h2 className="section-title mb-4">단계별 진행 상황</h2>
              <div className="space-y-4">
                {projectStages.map((stage) => {
                  const progress = getStageProgress(stage);
                  const isCurrent = project.currentStage === stage;
                  return (
                    <div
                      key={stage}
                      className={`p-3 rounded-xl transition-colors ${
                        isCurrent ? "bg-primary-500/10 border border-primary-500/30" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${isCurrent ? "text-primary-300" : "text-slate-200"}`}>
                            {stage.replace(/_/g, " - ")}
                          </span>
                          {isCurrent && (
                            <span className="badge-primary">현재</span>
                          )}
                        </div>
                        <span className="text-sm font-bold font-mono text-slate-200">{progress}%</span>
                      </div>
                      <div className="w-full bg-surface-3 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${isCurrent ? "bg-primary-400" : "bg-primary-500"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department Progress */}
            <div className="bg-surface-2 rounded-2xl border border-surface-3 p-6">
              <h2 className="section-title mb-4">부서별 진행 상황</h2>
              <div className="space-y-4">
                {departments.map((dept) => {
                  const progress = getDepartmentProgress(dept);
                  const deptTasks = checklistItems.filter((item) => item.department === dept);
                  return (
                    <div key={dept}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">
                          {dept} <span className="text-slate-500">({deptTasks.length}개 작업)</span>
                        </span>
                        <span className="text-sm font-bold font-mono text-slate-200">{progress}%</span>
                      </div>
                      <div className="w-full bg-surface-3 rounded-full h-2">
                        <div
                          className="bg-primary-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-surface-2 rounded-2xl border border-surface-3 p-6">
              <h2 className="section-title mb-4">최근 활동</h2>
              <div className="space-y-3">
                {checklistItems
                  .filter((t) => t.completedDate || t.status === "in_progress")
                  .slice(0, 5)
                  .map((task) => (
                    <div key={task.id} className="flex items-start space-x-3 p-3 bg-surface-1 rounded-xl border border-surface-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className={`w-2 h-2 rounded-full mt-1 ${
                          task.status === "completed" ? "bg-success-500" : "bg-primary-500"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200">{task.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {task.assignee} / {task.department} / {task.stage.split("_")[0]}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-xs font-mono text-slate-500">
                        {task.completedDate
                          ? new Date(task.completedDate).toLocaleDateString("ko-KR")
                          : "진행 중"}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Checklist Tab */}
        {activeTab === "checklist" && (
          <div className="space-y-6">
            {/* Mini Matrix */}
            <div className="bg-surface-2 rounded-2xl border border-surface-3 p-6">
              <h2 className="section-title mb-4">전체 진행 현황</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-surface-3 bg-surface-2 p-2 text-left text-sm font-medium text-slate-200 sticky left-0 z-10">
                        부서 / 단계
                      </th>
                      {projectStages.map((stage) => (
                        <th
                          key={stage}
                          className="border border-surface-3 bg-surface-2 p-2 text-center text-xs font-medium text-slate-200 min-w-[60px]"
                        >
                          {stage.split("_")[0]}
                          <div className="text-xs font-mono text-slate-500 mt-1">{getStageProgress(stage)}%</div>
                        </th>
                      ))}
                      <th className="border border-surface-3 bg-surface-2 p-2 text-center text-sm font-medium text-slate-200 sticky right-0">
                        진행률
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept}>
                        <td className="border border-surface-3 bg-surface-1 p-2 text-sm font-medium text-slate-200 sticky left-0 z-10">
                          {dept}
                        </td>
                        {projectStages.map((stage) => {
                          const cellData = getMatrixCellData(stage, dept);
                          return (
                            <td
                              key={`${stage}-${dept}`}
                              onClick={() => cellData.status !== "none" && handleMatrixCellClick(stage, dept)}
                              className={`border border-surface-3 bg-surface-1 p-2 text-center hover:opacity-80 transition-opacity ${
                                cellData.status !== "none" ? "cursor-pointer" : "cursor-default"
                              }`}
                            >
                              <div className="flex items-center justify-center">
                                <div
                                  className={`w-8 h-8 rounded-full ${getMatrixCellColor(cellData.status)} flex items-center justify-center`}
                                >
                                  {cellData.status !== "none" ? (
                                    <span className="text-xs text-white font-mono font-medium">
                                      {cellData.count}/{cellData.total}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-500">-</span>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                        <td className="border border-surface-3 bg-surface-1 p-2 text-center sticky right-0">
                          <span className="text-sm font-bold font-mono text-primary-400">
                            {getDepartmentProgress(dept)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-center space-x-6 mt-4 text-sm text-slate-400">
                {[
                  { color: "bg-success-500", label: "완료" },
                  { color: "bg-primary-500", label: "진행중" },
                  { color: "bg-surface-4", label: "대기" },
                  { color: "bg-surface-3 border border-surface-4", label: "작업없음" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded-full ${color}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-surface-2 rounded-2xl border border-surface-3 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-200 mb-2 block">단계 필터</label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value as ProjectStage | "all")}
                    className="input-field w-full"
                  >
                    <option value="all">전체 단계</option>
                    {projectStages.map((stage) => (
                      <option key={stage} value={stage}>{stage.replace(/_/g, " - ")}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-slate-200 mb-2 block">부서 필터</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value as Department | "all")}
                    className="input-field w-full"
                  >
                    <option value="all">전체 부서</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                {(selectedStage !== "all" || selectedDepartment !== "all") && (
                  <div className="flex items-end">
                    <button
                      onClick={() => { setSelectedStage("all"); setSelectedDepartment("all"); }}
                      className="btn-ghost"
                    >
                      필터 초기화
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Task List by Department */}
            <div className="space-y-6">
              {departments.map((dept) => {
                const deptTasks = filteredItems.filter((item) => item.department === dept);
                return (
                  <div key={dept} id={`dept-${dept}`} className="bg-surface-2 rounded-2xl border border-surface-3 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h3 className="section-title">{dept}</h3>
                        <span className="text-sm text-slate-500">{deptTasks.length}개 작업</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono text-primary-400">{getDepartmentProgress(dept)}%</div>
                        <div className="text-xs text-slate-500">부서 진행률</div>
                      </div>
                    </div>

                    {deptTasks.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 bg-surface-1 rounded-xl border border-dashed border-surface-4">
                        <p>
                          {selectedStage === "all" && selectedDepartment === "all"
                            ? "이 부서에 배정된 작업이 없습니다"
                            : "선택한 조건에 해당하는 작업이 없습니다"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {deptTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => router.push(`/task?projectId=${projectId}&taskId=${task.id}`)}
                            className={`card-hover p-4 rounded-xl border-l-4 transition-all cursor-pointer ${
                              task.status === "completed"
                                ? "border-l-success-500"
                                : task.status === "in_progress"
                                ? "border-l-primary-500"
                                : task.status === "rejected"
                                ? "border-l-danger-500"
                                : "border-l-slate-500"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                                    {getStatusLabel(task.status)}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {task.stage.replace(/_/g, " - ")}
                                  </span>
                                  {task.status === "completed" && task.approvalStatus === "approved" && (
                                    <span className="badge-success">
                                      승인됨
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-medium text-slate-100 mb-1">{task.title}</h4>
                                <p className="text-sm text-slate-400 mb-3">{task.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-4 text-slate-400">
                                <span>담당: {task.assignee}</span>
                                <span>검토: {task.reviewer}</span>
                              </div>
                              <div
                                className={`font-medium font-mono ${
                                  new Date(task.dueDate) < new Date()
                                    ? "text-danger-400"
                                    : new Date(task.dueDate).getTime() - new Date().getTime() < 3 * 24 * 60 * 60 * 1000
                                    ? "text-warning-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {new Date(task.dueDate).toLocaleDateString("ko-KR")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === "files" && (
          <div className="bg-surface-2 rounded-2xl border border-surface-3 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="section-title">프로젝트 문서</h2>
              <button className="btn-primary flex items-center space-x-2" onClick={() => fileInputRef.current?.click()}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>파일 업로드</span>
              </button>
            </div>
            <label className="block w-full p-12 border-2 border-dashed border-surface-4 bg-surface-1 rounded-2xl text-center cursor-pointer hover:border-primary-500 hover:bg-surface-2 transition-all">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-base text-slate-400 mb-2">클릭하여 파일 업로드 또는 드래그 앤 드롭</p>
              <p className="text-sm text-slate-500">PDF, DOC, XLS, PPT, DWG, ZIP (최대 50MB)</p>
              <input
                type="file"
                className="hidden"
                multiple
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files?.length) alert(`${e.target.files.length}개 파일 선택됨. 파일 업로드 기능은 준비 중입니다.`);
                }}
              />
            </label>
          </div>
        )}

        {/* Changes Tab */}
        {activeTab === "changes" && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button className="btn-primary flex items-center space-x-2" onClick={() => setShowChangeRequestModal(true)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>새 변경 요청</span>
              </button>
            </div>

            {showChangeRequestModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-surface-2 border border-surface-3 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
                  <h3 className="text-lg font-semibold text-slate-100 mb-4">새 변경 요청</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-slate-300 block mb-1">제목</label>
                      <input
                        type="text"
                        className="input-field w-full"
                        value={newChangeRequest.title}
                        onChange={(e) => setNewChangeRequest({ ...newChangeRequest, title: e.target.value })}
                        placeholder="변경 요청 제목"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300 block mb-1">설명</label>
                      <textarea
                        className="input-field w-full"
                        rows={3}
                        value={newChangeRequest.description}
                        onChange={(e) => setNewChangeRequest({ ...newChangeRequest, description: e.target.value })}
                        placeholder="변경 요청 상세 설명"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-300 block mb-1">규모</label>
                      <select
                        className="input-field w-full"
                        value={newChangeRequest.scale}
                        onChange={(e) => setNewChangeRequest({ ...newChangeRequest, scale: e.target.value as "major" | "medium" | "minor" })}
                      >
                        <option value="minor">경미</option>
                        <option value="medium">중간</option>
                        <option value="major">대규모</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-300 block mb-1">영향 부서</label>
                      <div className="flex flex-wrap gap-2">
                        {departments.map((dept) => (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => {
                              const current = newChangeRequest.affectedDepartments;
                              const updated = current.includes(dept)
                                ? current.filter((d) => d !== dept)
                                : [...current, dept];
                              setNewChangeRequest({ ...newChangeRequest, affectedDepartments: updated });
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              newChangeRequest.affectedDepartments.includes(dept)
                                ? "bg-primary-500/20 border-primary-500/40 text-primary-300"
                                : "bg-surface-3 border-surface-4 text-slate-400 hover:border-slate-500"
                            }`}
                          >
                            {dept}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex space-x-3 pt-2">
                      <button
                        className="flex-1 btn-primary"
                        onClick={async () => {
                          if (!newChangeRequest.title.trim()) {
                            alert("제목을 입력하세요.");
                            return;
                          }
                          if (newChangeRequest.affectedDepartments.length === 0) {
                            alert("영향 부서를 선택하세요.");
                            return;
                          }
                          const readBy: { [department: string]: boolean } = {};
                          newChangeRequest.affectedDepartments.forEach((d) => { readBy[d] = false; });
                          await createChangeRequest({
                            projectId,
                            title: newChangeRequest.title,
                            description: newChangeRequest.description,
                            requestedBy: currentUser.name,
                            requestedAt: new Date(),
                            affectedDepartments: newChangeRequest.affectedDepartments as Department[],
                            scale: newChangeRequest.scale,
                            status: "in_review",
                            readBy,
                          });
                          setNewChangeRequest({ title: "", description: "", scale: "medium", affectedDepartments: [] });
                          setShowChangeRequestModal(false);
                        }}
                      >
                        등록
                      </button>
                      <button
                        className="flex-1 btn-secondary"
                        onClick={() => {
                          setNewChangeRequest({ title: "", description: "", scale: "medium", affectedDepartments: [] });
                          setShowChangeRequestModal(false);
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {changeRequests.length === 0 ? (
              <div className="bg-surface-2 rounded-2xl border border-surface-3 p-12 text-center">
                <h3 className="text-xl font-semibold text-slate-200 mb-2">설계 변경 요청이 없습니다</h3>
                <p className="text-slate-500">새 변경 요청을 등록해주세요.</p>
              </div>
            ) : (
              changeRequests.map((change) => (
                <div key={change.id} className="bg-surface-2 rounded-2xl border border-surface-3 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-100">{change.title}</h3>
                        <span className={
                          change.scale === "major" ? "badge-danger"
                            : change.scale === "medium" ? "badge-warning"
                            : "badge-success"
                        }>
                          {change.scale === "major" ? "대규모" : change.scale === "medium" ? "중간" : "경미"}
                        </span>
                        <span className={
                          change.status === "approved" ? "badge-success"
                            : change.status === "in_review" ? "badge-primary"
                            : change.status === "rejected" ? "badge-danger"
                            : "badge-neutral"
                        }>
                          {change.status === "approved" ? "승인"
                            : change.status === "in_review" ? "검토 중"
                            : change.status === "rejected" ? "반려"
                            : "대기"}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mb-4">{change.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-slate-500">
                        <span>요청: {change.requestedBy}</span>
                        <span className="text-surface-4">|</span>
                        <span className="font-mono">{new Date(change.requestedAt).toLocaleDateString("ko-KR")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 p-4 bg-surface-1 rounded-xl border border-surface-3">
                    <h4 className="text-sm font-semibold text-slate-200 mb-3">영향 부서 확인 현황</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {change.affectedDepartments.map((dept) => (
                        <div
                          key={dept}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                            change.readBy[dept]
                              ? "bg-success-500/10 border border-success-500/20"
                              : "bg-warning-500/10 border border-warning-500/20"
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${
                            change.readBy[dept] ? "bg-success-500" : "bg-warning-500"
                          }`} />
                          <span className={`text-sm font-medium ${
                            change.readBy[dept] ? "text-success-400" : "text-warning-400"
                          }`}>
                            {dept}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {change.status === "in_review" && (
                    <div className="flex space-x-3">
                      <button className="flex-1 btn-primary" onClick={() => updateChangeRequest(change.id, { status: "approved" })}>
                        승인
                      </button>
                      <button className="flex-1 btn-danger" onClick={() => { const reason = prompt("반려 사유를 입력하세요:"); if (reason) updateChangeRequest(change.id, { status: "rejected" }); }}>
                        반려
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ProjectDetailContent />
    </Suspense>
  );
}
