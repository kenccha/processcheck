"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  mockProjects,
  mockChecklistItems,
  mockChangeRequests,
  departments,
  projectStages,
  getStatusLabel,
  getRiskColor,
} from "@/lib/mockData";
import { Project, ChecklistItem, ProjectStage, Department } from "@/lib/types";

type TabType = "overview" | "checklist" | "files" | "changes";

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [selectedStage, setSelectedStage] = useState<ProjectStage | "all">("all");
  const [selectedDepartment, setSelectedDepartment] = useState<Department | "all">("all");

  useEffect(() => {
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
      router.push("/");
      return;
    }

    const foundProject = mockProjects.find((p) => p.id === projectId);
    if (!foundProject) {
      router.push("/projects");
      return;
    }

    setProject(foundProject);

    const items = mockChecklistItems.filter((item) => item.projectId === projectId);
    setChecklistItems(items);
  }, [router, projectId]);

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-600">프로젝트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 통계 계산
  const totalTasks = checklistItems.length;
  const completedTasks = checklistItems.filter((t) => t.status === "completed").length;
  const inProgressTasks = checklistItems.filter((t) => t.status === "in_progress").length;
  const delayedTasks = checklistItems.filter((t) => 
    t.status !== "completed" && new Date(t.dueDate) < new Date()
  ).length;
  const pendingApprovals = checklistItems.filter((t) => t.status === "completed").length;

  // 필터링된 작업들
  const filteredItems = checklistItems.filter((item) => {
    const matchesStage = selectedStage === "all" || item.stage === selectedStage;
    const matchesDept = selectedDepartment === "all" || item.department === selectedDepartment;
    return matchesStage && matchesDept;
  });

  // 매트릭스 데이터 계산
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

  // 부서별 진행률
  const getDepartmentProgress = (dept: Department) => {
    const deptTasks = checklistItems.filter((item) => item.department === dept);
    if (deptTasks.length === 0) return 0;
    const completed = deptTasks.filter((item) => item.status === "completed").length;
    return Math.round((completed / deptTasks.length) * 100);
  };

  // 단계별 진행률
  const getStageProgress = (stage: ProjectStage) => {
    const stageTasks = checklistItems.filter((item) => item.stage === stage);
    if (stageTasks.length === 0) return 0;
    const completed = stageTasks.filter((item) => item.status === "completed").length;
    return Math.round((completed / stageTasks.length) * 100);
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

  const getStatusColor = (status: ChecklistItem["status"]) => {
    switch (status) {
      case "pending":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "in_progress":
        return "bg-primary-100 text-primary-700 border-primary-300";
      case "completed":
        return "bg-success-100 text-success-700 border-success-300";
      case "rejected":
        return "bg-danger-100 text-danger-700 border-danger-300";
    }
  };

  const handleMatrixCellClick = (stage: ProjectStage, dept: Department) => {
    setSelectedStage(stage);
    setSelectedDepartment(dept);
    setTimeout(() => {
      const element = document.getElementById(`dept-${dept}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // 설계 변경 데이터
  const projectChanges = mockChangeRequests.filter((cr) => cr.projectId === projectId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
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
                  className="text-primary-600 font-medium"
                >
                  프로젝트
                </a>
              </div>
            </div>

            <button
              onClick={() => router.push("/projects")}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 font-medium flex items-center space-x-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>프로젝트 목록</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  {project.name}
                </h1>
                <span
                  className={`w-3 h-3 rounded-full ${getRiskColor(project.riskLevel)}`}
                  title={`위험도: ${project.riskLevel}`}
                ></span>
              </div>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>📦 {project.productType}</span>
                <span>•</span>
                <span>👤 PM: {project.pm}</span>
                <span>•</span>
                <span>
                  📅{" "}
                  {new Date(project.startDate).toLocaleDateString("ko-KR")} ~{" "}
                  {new Date(project.endDate).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-4xl font-bold text-primary-600 mb-1">
                {project.progress}%
              </div>
              <div className="text-sm text-gray-600">전체 진행률</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-primary-600 h-3 rounded-full transition-all"
              style={{ width: `${project.progress}%` }}
            ></div>
          </div>

          {/* Current Stage */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-blue-900 mb-1">
              📍 현재 단계
            </div>
            <div className="text-lg font-semibold text-blue-700">
              {project.currentStage.replace(/_/g, " - ")}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "overview"
                  ? "border-b-2 border-primary-600 text-primary-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📊 개요
            </button>
            <button
              onClick={() => setActiveTab("checklist")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "checklist"
                  ? "border-b-2 border-primary-600 text-primary-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              ✅ 체크리스트 ({totalTasks})
            </button>
            <button
              onClick={() => setActiveTab("files")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "files"
                  ? "border-b-2 border-primary-600 text-primary-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              📁 파일
            </button>
            <button
              onClick={() => setActiveTab("changes")}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === "changes"
                  ? "border-b-2 border-primary-600 text-primary-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              🔄 설계 변경 ({projectChanges.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">전체 작업</span>
                  <span className="text-2xl">📋</span>
                </div>
                <div className="text-3xl font-bold text-gray-900">{totalTasks}</div>
                <div className="text-sm text-gray-500 mt-1">
                  완료: {completedTasks}개
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">진행 중</span>
                  <span className="text-2xl">🔵</span>
                </div>
                <div className="text-3xl font-bold text-primary-600">{inProgressTasks}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {Math.round((inProgressTasks / totalTasks) * 100)}%
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">지연</span>
                  <span className="text-2xl">🔴</span>
                </div>
                <div className="text-3xl font-bold text-danger-600">{delayedTasks}</div>
                <div className="text-sm text-gray-500 mt-1">
                  긴급 조치 필요
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">승인 대기</span>
                  <span className="text-2xl">⏳</span>
                </div>
                <div className="text-3xl font-bold text-warning-600">{pendingApprovals}</div>
                <div className="text-sm text-gray-500 mt-1">
                  검토 필요
                </div>
              </div>
            </div>

            {/* Stage Progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                단계별 진행 상황
              </h2>
              <div className="space-y-4">
                {projectStages.map((stage) => {
                  const progress = getStageProgress(stage);
                  const isCurrent = project.currentStage === stage;
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${isCurrent ? "text-blue-700" : "text-gray-700"}`}>
                            {stage.replace(/_/g, " - ")}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                              현재
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-gray-900">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isCurrent ? "bg-blue-500" : "bg-primary-600"
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Department Progress */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                부서별 진행 상황
              </h2>
              <div className="space-y-4">
                {departments.map((dept) => {
                  const progress = getDepartmentProgress(dept);
                  const deptTasks = checklistItems.filter((item) => item.department === dept);
                  return (
                    <div key={dept}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {dept} ({deptTasks.length}개 작업)
                        </span>
                        <span className="text-sm font-bold text-gray-900">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                최근 활동
              </h2>
              <div className="space-y-3">
                {checklistItems
                  .filter((t) => t.completedDate || t.status === "in_progress")
                  .slice(0, 5)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-1">
                        {task.status === "completed" ? "✅" : "🔵"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {task.assignee} • {task.department} • {task.stage.split("_")[0]}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-xs text-gray-500">
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

        {activeTab === "checklist" && (
          <div className="space-y-6">
            {/* Mini Matrix View */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                📊 전체 진행 현황
              </h2>
              
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
                          className="border border-gray-300 bg-gray-50 p-2 text-center text-xs font-medium text-gray-700 min-w-[60px]"
                        >
                          {stage.split("_")[0]}
                          <div className="text-xs text-gray-500 mt-1">
                            {getStageProgress(stage)}%
                          </div>
                        </th>
                      ))}
                      <th className="border border-gray-300 bg-gray-50 p-2 text-center text-sm font-medium text-gray-700 sticky right-0">
                        진행률
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept}>
                        <td className="border border-gray-300 bg-white p-2 text-sm font-medium text-gray-900 sticky left-0 z-10">
                          {dept}
                        </td>
                        {projectStages.map((stage) => {
                          const cellData = getMatrixCellData(stage, dept);
                          return (
                            <td
                              key={`${stage}-${dept}`}
                              onClick={() => cellData.status !== "none" && handleMatrixCellClick(stage, dept)}
                              className={`border border-gray-300 p-2 text-center cursor-pointer hover:opacity-80 transition-opacity ${
                                cellData.status !== "none" ? "cursor-pointer" : "cursor-default"
                              }`}
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
                        <td className="border border-gray-300 bg-white p-2 text-center sticky right-0">
                          <span className="text-sm font-bold text-primary-600">
                            {getDepartmentProgress(dept)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-success-500"></div>
                  <span>완료</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-primary-500"></div>
                  <span>진행중</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-gray-300"></div>
                  <span>대기</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-gray-100 border border-gray-300"></div>
                  <span>작업없음</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    단계 필터
                  </label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value as ProjectStage | "all")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="all">전체 단계</option>
                    {projectStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage.replace(/_/g, " - ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    부서 필터
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value as Department | "all")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  >
                    <option value="all">전체 부서</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                {(selectedStage !== "all" || selectedDepartment !== "all") && (
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setSelectedStage("all");
                        setSelectedDepartment("all");
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
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
                  <div
                    key={dept}
                    id={`dept-${dept}`}
                    className="bg-white rounded-xl border border-gray-200 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {dept}
                        </h3>
                        <span className="text-sm text-gray-600">
                          {deptTasks.length}개 작업
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary-600">
                          {getDepartmentProgress(dept)}%
                        </div>
                        <div className="text-xs text-gray-500">부서 진행률</div>
                      </div>
                    </div>

                    {deptTasks.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
                        {selectedStage === "all" && selectedDepartment === "all" ? (
                          <div>
                            <div className="text-4xl mb-2">📭</div>
                            <p>이 부서에 배정된 작업이 없습니다</p>
                          </div>
                        ) : (
                          <div>
                            <div className="text-4xl mb-2">🔍</div>
                            <p>선택한 조건에 해당하는 작업이 없습니다</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {deptTasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() =>
                              router.push(`/projects/${projectId}/tasks/${task.id}`)
                            }
                            className="p-4 border-2 rounded-lg hover:border-primary-300 hover:bg-gray-50 transition-all cursor-pointer"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                      task.status
                                    )}`}
                                  >
                                    {getStatusLabel(task.status)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {task.stage.replace(/_/g, " - ")}
                                  </span>
                                </div>
                                <h4 className="font-medium text-gray-900 mb-1">
                                  {task.title}
                                </h4>
                                <p className="text-sm text-gray-600 mb-3">
                                  {task.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center space-x-4 text-gray-600">
                                <span>👤 {task.assignee}</span>
                                <span>✅ {task.reviewer}</span>
                              </div>
                              <div
                                className={`font-medium ${
                                  new Date(task.dueDate) < new Date()
                                    ? "text-danger-600"
                                    : new Date(task.dueDate).getTime() -
                                        new Date().getTime() <
                                      3 * 24 * 60 * 60 * 1000
                                    ? "text-warning-500"
                                    : "text-gray-600"
                                }`}
                              >
                                📅{" "}
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

        {activeTab === "files" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                📁 프로젝트 문서
              </h2>
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
                <span>파일 업로드</span>
              </button>
            </div>

            {/* File Upload Area */}
            <div className="mb-6">
              <label className="block w-full p-12 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-primary-500 hover:bg-gray-50 transition-all">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-base text-gray-600 mb-2">
                  클릭하여 파일 업로드 또는 드래그 앤 드롭
                </p>
                <p className="text-sm text-gray-500">
                  PDF, DOC, XLS, PPT, DWG, ZIP (최대 50MB)
                </p>
                <input type="file" className="hidden" multiple />
              </label>
            </div>

            {/* Files by Stage */}
            <div className="space-y-6">
              {projectStages.slice(0, 3).map((stage) => (
                <div key={stage}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    {stage.replace(/_/g, " - ")}
                  </h3>
                  <div className="space-y-2">
                    {/* Sample Files */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            제품_컨셉_문서_v2.pdf
                          </p>
                          <p className="text-xs text-gray-500">
                            2.3 MB • 김철수 • 2026-01-20
                          </p>
                        </div>
                      </div>
                      <button className="p-2 text-gray-600 hover:text-primary-600">
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
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            사업성_검토.xlsx
                          </p>
                          <p className="text-xs text-gray-500">
                            1.1 MB • 정재무 • 2026-01-18
                          </p>
                        </div>
                      </div>
                      <button className="p-2 text-gray-600 hover:text-primary-600">
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
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "changes" && (
          <div className="space-y-6">
            {/* Add Change Request Button */}
            <div className="flex justify-end">
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
                <span>새 변경 요청</span>
              </button>
            </div>

            {/* Change Requests */}
            {projectChanges.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">🔄</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  설계 변경 요청이 없습니다
                </h3>
                <p className="text-gray-600">
                  새 변경 요청을 등록해주세요.
                </p>
              </div>
            ) : (
              projectChanges.map((change) => (
                <div
                  key={change.id}
                  className="bg-white rounded-xl border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {change.title}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            change.scale === "major"
                              ? "bg-danger-100 text-danger-700"
                              : change.scale === "medium"
                              ? "bg-warning-100 text-warning-700"
                              : "bg-success-100 text-success-700"
                          }`}
                        >
                          {change.scale === "major"
                            ? "대규모"
                            : change.scale === "medium"
                            ? "중간"
                            : "경미"}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            change.status === "approved"
                              ? "bg-success-100 text-success-700"
                              : change.status === "in_review"
                              ? "bg-primary-100 text-primary-700"
                              : change.status === "rejected"
                              ? "bg-danger-100 text-danger-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {change.status === "approved"
                            ? "승인"
                            : change.status === "in_review"
                            ? "검토 중"
                            : change.status === "rejected"
                            ? "반려"
                            : "대기"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        {change.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>👤 요청: {change.requestedBy}</span>
                        <span>•</span>
                        <span>
                          📅{" "}
                          {new Date(change.requestedAt).toLocaleDateString(
                            "ko-KR"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Affected Departments */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      영향 부서 확인 현황
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {change.affectedDepartments.map((dept) => (
                        <div
                          key={dept}
                          className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                            change.readBy[dept]
                              ? "bg-success-100"
                              : "bg-warning-100"
                          }`}
                        >
                          <span className="text-lg">
                            {change.readBy[dept] ? "✅" : "⏳"}
                          </span>
                          <span
                            className={`text-sm font-medium ${
                              change.readBy[dept]
                                ? "text-success-700"
                                : "text-warning-700"
                            }`}
                          >
                            {dept}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {change.status === "in_review" && (
                    <div className="flex space-x-3">
                      <button className="flex-1 px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors font-medium">
                        승인
                      </button>
                      <button className="flex-1 px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors font-medium">
                        반려
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                        상세보기
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
