"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navigation from "@/components/Navigation";
import { useRequireAuth } from "@/contexts/AuthContext";
import {
  subscribeChecklistItems,
  subscribeProjects,
  completeTask,
  approveTask,
  rejectTask,
  addComment,
} from "@/lib/firestoreService";
import { getStatusLabel } from "@/lib/mockData";
import type { ChecklistItem, Project } from "@/lib/types";

const DEFAULT_CHECKLIST = [
  { id: "1", content: "요구사항 문서 작성 완료", checked: false, required: true },
  { id: "2", content: "기술 스펙 문서 작성 완료", checked: false, required: true },
  { id: "3", content: "관련 부서 검토 완료", checked: false, required: true },
  { id: "4", content: "예산 검토 완료", checked: false, required: false },
  { id: "5", content: "일정 검토 완료", checked: false, required: true },
];

function TaskDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || "";
  const taskId = searchParams.get("taskId") || "";
  const { currentUser, loading } = useRequireAuth();

  const [task, setTask] = useState<ChecklistItem | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [comment, setComment] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST.map((i) => ({ ...i })));
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 프로젝트 구독 (ID 필터)
  useEffect(() => {
    const unsub = subscribeProjects((projects) => {
      const found = projects.find((p) => p.id === projectId);
      setProject(found || null);
    });
    return unsub;
  }, [projectId]);

  // 태스크 실시간 구독 (프로젝트의 모든 아이템 중 필터)
  useEffect(() => {
    const unsub = subscribeChecklistItems(projectId, (items) => {
      const found = items.find((t) => t.id === taskId);
      if (found) {
        setTask(found);
      } else if (items.length > 0) {
        // 항목이 로드됐으나 해당 태스크를 찾을 수 없으면 프로젝트 페이지로
        router.push(`/project?id=${projectId}`);
      }
    });
    return unsub;
  }, [projectId, taskId, router]);

  // 피드백 자동 소멸
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const showFeedback = useCallback((type: "success" | "error", text: string) => {
    setFeedback({ type, text });
  }, []);

  const handleChecklistToggle = (id: string) => {
    if (!canComplete) return;
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const getChecklistProgress = () => {
    const total = checklist.length;
    const completed = checklist.filter((item) => item.checked).length;
    const requiredTotal = checklist.filter((item) => item.required).length;
    const requiredCompleted = checklist.filter((item) => item.required && item.checked).length;
    return { total, completed, requiredTotal, requiredCompleted };
  };

  const isChecklistComplete = () => {
    const { requiredTotal, requiredCompleted } = getChecklistProgress();
    return requiredCompleted === requiredTotal;
  };

  const handleComplete = async () => {
    if (!task || actionLoading) return;
    if (!isChecklistComplete()) {
      showFeedback("error", "필수 체크리스트 항목을 모두 완료해주세요.");
      return;
    }
    try {
      setActionLoading(true);
      await completeTask(task.id);
      showFeedback("success", "작업이 완료되었습니다. 부서 관리자의 승인을 기다립니다.");
    } catch (e) {
      console.error(e);
      showFeedback("error", "작업 완료 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!task || !currentUser || actionLoading) return;
    try {
      setActionLoading(true);
      await approveTask(task.id, currentUser.name);
      showFeedback("success", "작업이 승인되었습니다.");
    } catch (e) {
      console.error(e);
      showFeedback("error", "승인 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!task || !currentUser || actionLoading) return;
    if (!rejectionReason.trim()) {
      showFeedback("error", "반려 사유를 입력해주세요.");
      return;
    }
    try {
      setActionLoading(true);
      await rejectTask(task.id, currentUser.name, rejectionReason.trim());
      showFeedback("success", "작업이 반려되었습니다. 담당자에게 알림이 전송됩니다.");
      setRejectionReason("");
    } catch (e) {
      console.error(e);
      showFeedback("error", "반려 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!task || !currentUser || actionLoading) return;
    if (!comment.trim()) {
      showFeedback("error", "코멘트를 입력해주세요.");
      return;
    }
    try {
      setActionLoading(true);
      await addComment(task.id, currentUser.id, currentUser.name, comment.trim());
      setComment("");
      showFeedback("success", "코멘트가 추가되었습니다.");
    } catch (e) {
      console.error(e);
      showFeedback("error", "코멘트 추가 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const diff = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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

  const isWorker = currentUser.role === "worker";
  const isManager = currentUser.role === "manager";
  const canComplete = isWorker && (task.status === "pending" || task.status === "in_progress");
  const canApprove =
    isManager &&
    task.status === "completed" &&
    (!task.approvalStatus || task.approvalStatus === "pending");

  const getStatusColor = (status: ChecklistItem["status"]) => {
    switch (status) {
      case "pending": return "bg-gray-100 text-gray-700 border-gray-300";
      case "in_progress": return "bg-primary-100 text-primary-700 border-primary-300";
      case "completed": return "bg-success-100 text-success-700 border-success-300";
      case "rejected": return "bg-danger-100 text-danger-700 border-danger-300";
    }
  };

  const taskDueDate = new Date(task.dueDate);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
          <button onClick={() => router.push("/projects")} className="hover:text-gray-900">프로젝트</button>
          <span>/</span>
          <button onClick={() => router.push(`/project?id=${projectId}`)} className="hover:text-gray-900 truncate max-w-xs">
            {project.name}
          </button>
          <span>/</span>
          <span className="text-gray-900 font-medium">작업 상세</span>
        </div>

        {/* Task Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </span>
                {task.approvalStatus === "approved" && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-success-100 text-success-700 border border-success-300">
                    ✓ 승인 완료
                  </span>
                )}
                <span className="text-sm text-gray-600">{task.stage.replace(/_/g, " ")}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{task.title}</h1>
              <p className="text-lg text-gray-700 leading-relaxed">{task.description}</p>
            </div>
          </div>

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
              <div className={`font-medium ${taskDueDate < new Date() ? "text-danger-600" : "text-gray-900"}`}>
                {taskDueDate.toLocaleDateString("ko-KR")}
              </div>
            </div>
          </div>

          {/* Rejection reason if rejected */}
          {task.status === "rejected" && task.rejectionReason && (
            <div className="mt-4 p-4 bg-danger-50 border border-danger-200 rounded-lg">
              <p className="text-sm font-medium text-danger-800 mb-1">반려 사유</p>
              <p className="text-sm text-danger-700">{task.rejectionReason}</p>
              {task.rejectedBy && (
                <p className="text-xs text-danger-500 mt-1">
                  반려자: {task.rejectedBy} • {task.rejectedAt && new Date(task.rejectedAt).toLocaleDateString("ko-KR")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Checklist Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">✅ 체크리스트</h2>
                <div className="text-sm">
                  <span className="font-semibold text-primary-600">{getChecklistProgress().completed}</span>
                  <span className="text-gray-500">/{getChecklistProgress().total}</span>
                  <span className="text-gray-400 ml-2">
                    (필수: {getChecklistProgress().requiredCompleted}/{getChecklistProgress().requiredTotal})
                  </span>
                </div>
              </div>

              <div className="w-full h-2 bg-gray-200 rounded-full mb-6">
                <div
                  className="h-full bg-primary-600 rounded-full transition-all duration-300"
                  style={{
                    width: `${(getChecklistProgress().completed / getChecklistProgress().total) * 100}%`,
                  }}
                />
              </div>

              <div className="space-y-3">
                {checklist.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all ${
                      item.checked ? "bg-primary-50 border-primary-300" : "bg-white border-gray-200 hover:border-gray-300"
                    } ${!canComplete ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
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
                        <span className={`text-sm ${item.checked ? "text-gray-900 font-medium" : "text-gray-700"}`}>
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
                      <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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

              {canComplete && !isChecklistComplete() && (
                <div className="mt-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                  <p className="text-sm text-warning-800">⚠️ 필수 체크리스트 항목을 모두 완료해야 작업을 완료할 수 있습니다.</p>
                </div>
              )}
              {canComplete && isChecklistComplete() && (
                <div className="mt-4 p-3 bg-success-50 border border-success-200 rounded-lg">
                  <p className="text-sm text-success-800">✅ 모든 필수 항목이 완료되었습니다. 작업을 완료할 수 있습니다.</p>
                </div>
              )}
            </div>

            {/* Files Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">📎 첨부 파일</h2>
              {canComplete && (
                <div className="mb-4">
                  <label className="block w-full p-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-primary-500 hover:bg-gray-50 transition-all">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-600">클릭하여 파일 업로드 또는 드래그 앤 드롭</p>
                    <input type="file" className="hidden" multiple />
                  </label>
                </div>
              )}

              {/* Real files from task */}
              {task.files && task.files.length > 0 ? (
                <div className="space-y-2">
                  {task.files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{file.name}</div>
                          <div className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(1)} MB • {file.uploadedBy}
                          </div>
                        </div>
                      </div>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-600 hover:text-primary-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">첨부된 파일이 없습니다.</p>
              )}
            </div>

            {/* Comments Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">💬 코멘트</h2>

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
                    disabled={actionLoading || !comment.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    코멘트 추가
                  </button>
                </div>
              </div>

              {/* Real comments from Firestore */}
              <div className="space-y-4">
                {task.comments && task.comments.length > 0 ? (
                  [...task.comments]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((c) => (
                      <div key={c.id} className="flex space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-primary-700">
                            {c.userName.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900">{c.userName}</span>
                              <span className="text-xs text-gray-500">{formatTimeAgo(c.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-700">{c.content}</p>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">코멘트가 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">작업 관리</h2>

              {/* Feedback message */}
              {feedback && (
                <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
                  feedback.type === "success"
                    ? "bg-success-50 border border-success-200 text-success-800"
                    : "bg-danger-50 border border-danger-200 text-danger-800"
                }`}>
                  {feedback.type === "success" ? "✅ " : "❌ "}
                  {feedback.text}
                </div>
              )}

              {/* Worker Actions */}
              {canComplete && (
                <div className="space-y-3">
                  <button
                    onClick={handleComplete}
                    disabled={!isChecklistComplete() || actionLoading}
                    className={`w-full py-3 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2 ${
                      isChecklistComplete() && !actionLoading
                        ? "bg-success-600 text-white hover:bg-success-700 cursor-pointer"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>✅ 작업 완료</span>
                    )}
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
                    disabled={actionLoading}
                    className="w-full py-3 bg-success-600 text-white rounded-lg hover:bg-success-700 transition-colors font-medium flex items-center justify-center disabled:opacity-60"
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "✅ 승인"
                    )}
                  </button>

                  <div className="pt-3 border-t border-gray-200">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">반려 사유</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="반려 사유를 입력하세요..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-danger-500 focus:border-danger-500 outline-none resize-none mb-2"
                    />
                    <button
                      onClick={handleReject}
                      disabled={actionLoading || !rejectionReason.trim()}
                      className="w-full py-3 bg-danger-600 text-white rounded-lg hover:bg-danger-700 transition-colors font-medium flex items-center justify-center disabled:opacity-60"
                    >
                      {actionLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "❌ 반려"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Approved state */}
              {task.status === "completed" && task.approvalStatus === "approved" && (
                <div className="text-center py-6">
                  <div className="text-4xl mb-2">🎉</div>
                  <p className="text-sm font-medium text-success-700">승인 완료</p>
                  {task.approvedBy && (
                    <p className="text-xs text-gray-500 mt-1">승인자: {task.approvedBy}</p>
                  )}
                </div>
              )}

              {/* View Only / other statuses */}
              {!canComplete && !canApprove && task.approvalStatus !== "approved" && (
                <div className="text-center py-6 text-gray-500">
                  {task.status === "completed" && (!task.approvalStatus || task.approvalStatus === "pending") && (
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
                  {task.status === "pending" && !isWorker && !isManager && (
                    <div>
                      <div className="text-4xl mb-2">👀</div>
                      <p className="text-sm">조회 전용</p>
                    </div>
                  )}
                </div>
              )}

              {/* Task History */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">작업 히스토리</h3>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mt-1.5" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-900 font-medium">작업 배정됨</p>
                      <p className="text-xs text-gray-500">
                        {new Date(new Date(task.dueDate).getTime() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                  {task.status !== "pending" && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-1.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-900 font-medium">작업 시작됨</p>
                        <p className="text-xs text-gray-500">
                          {new Date(new Date(task.dueDate).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  )}
                  {task.completedDate && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-success-600 rounded-full mt-1.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-900 font-medium">작업 완료됨</p>
                        <p className="text-xs text-gray-500">
                          {new Date(task.completedDate).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  )}
                  {task.approvalStatus === "approved" && task.approvedAt && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-success-600 rounded-full mt-1.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-900 font-medium">승인 완료</p>
                        <p className="text-xs text-gray-500">
                          {new Date(task.approvedAt).toLocaleDateString("ko-KR")} • {task.approvedBy}
                        </p>
                      </div>
                    </div>
                  )}
                  {task.status === "rejected" && task.rejectedAt && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-danger-600 rounded-full mt-1.5" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-900 font-medium">반려됨</p>
                        <p className="text-xs text-gray-500">
                          {new Date(task.rejectedAt).toLocaleDateString("ko-KR")} • {task.rejectedBy}
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

export default function TaskDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <TaskDetailContent />
    </Suspense>
  );
}
