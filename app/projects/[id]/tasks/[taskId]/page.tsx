"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  mockChecklistItems,
  mockProjects,
  getStatusLabel,
} from "@/lib/mockData";
import { ChecklistItem, Project } from "@/lib/types";

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const taskId = params.taskId as string;

  const [task, setTask] = useState<ChecklistItem | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [userRole, setUserRole] = useState("");
  const [comment, setComment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [checklist, setChecklist] = useState([
    { id: "1", content: "요구사항 문서 작성 완료", checked: false, required: true },
    { id: "2", content: "기술 스펙 문서 작성 완료", checked: false, required: true },
    { id: "3", content: "관련 부서 검토 완료", checked: false, required: true },
    { id: "4", content: "예산 검토 완료", checked: false, required: false },
    { id: "5", content: "일정 검토 완료", checked: false, required: true },
  ]);

  useEffect(() => {
    // 로그인 확인
    const userStr = localStorage.getItem("currentUser");
    if (!userStr) {
      router.push("/");
      return;
    }

    const user = JSON.parse(userStr);
    setUserRole(user.role);

    // 작업 찾기
    const foundTask = mockChecklistItems.find((t) => t.id === taskId);
    if (!foundTask) {
      router.push(`/projects/${projectId}`);
      return;
    }

    setTask(foundTask);

    // 프로젝트 찾기
    const foundProject = mockProjects.find((p) => p.id === projectId);
    setProject(foundProject || null);
  }, [router, projectId, taskId]);

  const handleChecklistToggle = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const getChecklistProgress = () => {
    const total = checklist.length;
    const completed = checklist.filter((item) => item.checked).length;
    const requiredTotal = checklist.filter((item) => item.required).length;
    const requiredCompleted = checklist.filter(
      (item) => item.required && item.checked
    ).length;
    return { total, completed, requiredTotal, requiredCompleted };
  };

  const isChecklistComplete = () => {
    const { requiredTotal, requiredCompleted } = getChecklistProgress();
    return requiredCompleted === requiredTotal;
  };

  const handleComplete = () => {
    if (!task) return;

    if (!isChecklistComplete()) {
      alert("필수 체크리스트 항목을 모두 완료해주세요.");
      return;
    }
    
    if (confirm("작업을 완료로 표시하시겠습니까?")) {
      alert("작업이 완료되었습니다. 부서 관리자의 승인을 기다립니다.");
      // 실제로는 API 호출
      router.push(`/projects/${projectId}`);
    }
  };

  const handleApprove = () => {
    if (!task) return;
    
    if (confirm("이 작업을 승인하시겠습니까?")) {
      alert("작업이 승인되었습니다.");
      // 실제로는 API 호출
      router.push(`/projects/${projectId}`);
    }
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert("반려 사유를 입력해주세요.");
      return;
    }
    
    if (confirm("이 작업을 반려하시겠습니까?")) {
      alert("작업이 반려되었습니다. 담당자에게 알림이 전송됩니다.");
      // 실제로는 API 호출
      router.push(`/projects/${projectId}`);
    }
  };

  const handleAddComment = () => {
    if (!comment.trim()) {
      alert("코멘트를 입력해주세요.");
      return;
    }
    
    alert("코멘트가 추가되었습니다.");
    setComment("");
    // 실제로는 API 호출
  };

  if (!task || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-gray-600">작업을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const isWorker = userRole === "worker";
  const isManager = userRole === "manager";
  const canComplete = isWorker && (task.status === "pending" || task.status === "in_progress");
  const canApprove = isManager && task.status === "completed";

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
                <a
                  href="/admin/checklists"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  체크리스트 관리
                </a>
              </div>
            </div>

            <button
              onClick={() => router.push(`/projects/${projectId}`)}
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
              <span>프로젝트로 돌아가기</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <a href="/projects" className="hover:text-gray-900">
            프로젝트
          </a>
          <span>/</span>
          <a
            href={`/projects/${projectId}`}
            className="hover:text-gray-900 truncate max-w-xs"
          >
            {project.name}
          </a>
          <span>/</span>
          <span className="text-gray-900 font-medium">작업 상세</span>
        </div>

        {/* Task Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(
                    task.status
                  )}`}
                >
                  {getStatusLabel(task.status)}
                </span>
                <span className="text-sm text-gray-600">
                  {task.stage.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {task.title}
              </h1>
              <p className="text-lg text-gray-700 leading-relaxed">
                {task.description}
              </p>
            </div>
          </div>

          {/* Task Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div>
              <div className="text-sm text-gray-600 mb-1">부서</div>
              <div className="font-medium text-gray-900">{task.department}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">담당자</div>
              <div className="font-medium text-gray-900">{task.assignee}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">검토자</div>
              <div className="font-medium text-gray-900">{task.reviewer}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">마감일</div>
              <div
                className={`font-medium ${
                  new Date(task.dueDate) < new Date()
                    ? "text-danger-600"
                    : "text-gray-900"
                }`}
              >
                {new Date(task.dueDate).toLocaleDateString("ko-KR")}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Checklist Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  ✅ 체크리스트
                </h2>
                <div className="text-sm">
                  <span className="font-semibold text-primary-600">
                    {getChecklistProgress().completed}
                  </span>
                  <span className="text-gray-500">
                    /{getChecklistProgress().total}
                  </span>
                  <span className="text-gray-400 ml-2">
                    (필수: {getChecklistProgress().requiredCompleted}/
                    {getChecklistProgress().requiredTotal})
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-gray-200 rounded-full mb-6">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (getChecklistProgress().completed /
                        getChecklistProgress().total) *
                      100
                    }%`,
                  }}
                ></div>
              </div>

              {/* Checklist Items */}
              <div className="space-y-3">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      item.checked
                        ? "bg-primary-50 border-primary-300"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    } ${!canComplete ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleChecklistToggle(item.id)}
                      disabled={!canComplete}
                      className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-sm ${
                            item.checked
                              ? "text-gray-900 font-medium"
                              : "text-gray-700"
                          }`}
                        >
                          {item.content}
                        </span>
                        {item.required && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-danger-100 text-danger-700">
                            필수
                          </span>
                        )}
                      </div>
                    </div>
                    {item.checked && (
                      <svg
                        className="w-5 h-5 text-primary-600 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </label>
                ))}
              </div>

              {/* Completion Warning */}
              {!isChecklistComplete() && canComplete && (
                <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                  <p className="text-sm text-warning-800">
                    ⚠️ 필수 체크리스트 항목을 모두 완료해야 작업을 완료할 수
                    있습니다.
                  </p>
                </div>
              )}

              {/* Completion Success */}
              {isChecklistComplete() && canComplete && (
                <div className="mt-4 p-3 bg-success-50 border border-success-200 rounded-lg">
                  <p className="text-sm text-success-800">
                    ✅ 모든 필수 항목이 완료되었습니다. 작업을 완료할 수 있습니다.
                  </p>
                </div>
              )}
            </div>

            {/* Files Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                📎 첨부 파일
              </h2>

              {/* File Upload */}
              {canComplete && (
                <div className="mb-4">
                  <label className="block w-full p-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-primary-500 hover:bg-gray-50 transition-all">
                    <svg
                      className="w-12 h-12 mx-auto mb-2 text-gray-400"
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
                    <p className="text-sm text-gray-600">
                      클릭하여 파일 업로드 또는 드래그 앤 드롭
                    </p>
                    <input type="file" className="hidden" multiple />
                  </label>
                </div>
              )}

              {/* File List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-primary-600"
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
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        설계_문서_v1.pdf
                      </div>
                      <div className="text-xs text-gray-500">2.5 MB</div>
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

            {/* Comments Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                💬 코멘트
              </h2>

              {/* Add Comment */}
              <div className="mb-6">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="코멘트를 입력하세요..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddComment}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    코멘트 추가
                  </button>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                <div className="flex space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-gray-600">
                      김
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          김철수
                        </span>
                        <span className="text-xs text-gray-500">
                          2시간 전
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        스펙 문서 검토 완료했습니다. 일부 수정사항이 있어서 파일 다시 첨부했습니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-gray-600">
                      이
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          이영희
                        </span>
                        <span className="text-xs text-gray-500">
                          어제
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        확인했습니다. 수고하셨습니다!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                작업 관리
              </h2>

              {/* Worker Actions */}
              {canComplete && (
                <div className="space-y-3">
                  <button
                    onClick={handleComplete}
                    disabled={!isChecklistComplete()}
                    className={`w-full py-3 rounded-lg transition-colors font-medium ${
                      isChecklistComplete()
                        ? "bg-success-600 text-white hover:bg-success-700 cursor-pointer"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    ✅ 작업 완료
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    {isChecklistComplete()
                      ? "완료 후 부서 관리자의 승인이 필요합니다"
                      : "체크리스트를 완료해주세요"}
                  </p>
                </div>
              )}

              {/* Manager Actions */}
              {canApprove && (
                <div className="space-y-3">
                  <button
                    onClick={handleApprove}
                    className="w-full py-3 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors font-medium"
                  >
                    ✅ 승인
                  </button>
                  
                  <div className="pt-3 border-t border-gray-200">
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="반려 사유를 입력하세요..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-danger-500 focus:border-danger-500 outline-none resize-none mb-2"
                    />
                    <button
                      onClick={handleReject}
                      className="w-full py-3 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors font-medium"
                    >
                      ❌ 반려
                    </button>
                  </div>
                </div>
              )}

              {/* View Only */}
              {!canComplete && !canApprove && (
                <div className="text-center py-6 text-gray-500">
                  {task.status === "completed" && !isManager && (
                    <div>
                      <div className="text-4xl mb-2">⏳</div>
                      <p className="text-sm">승인 대기 중</p>
                    </div>
                  )}
                  {task.status === "rejected" && (
                    <div>
                      <div className="text-4xl mb-2">❌</div>
                      <p className="text-sm">반려됨</p>
                      <p className="text-xs mt-2">재작업이 필요합니다</p>
                    </div>
                  )}
                  {!isWorker && !isManager && (
                    <div>
                      <div className="text-4xl mb-2">👀</div>
                      <p className="text-sm">조회 전용</p>
                    </div>
                  )}
                </div>
              )}

              {/* Task History */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  작업 히스토리
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-primary-600 rounded-full mt-1.5"></div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-900 font-medium">
                        작업 배정됨
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(task.dueDate.getTime() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                  {task.status !== "pending" && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-900 font-medium">
                          작업 시작됨
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(task.dueDate.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  )}
                  {task.completedDate && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-success-600 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-900 font-medium">
                          작업 완료됨
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(task.completedDate).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
