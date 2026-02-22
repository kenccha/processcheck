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
  restartTask,
  addComment,
  uploadTaskFile,
  getTemplateItemsByStageAndDept,
} from "@/lib/firestoreService";
import { getStatusLabel } from "@/lib/mockData";
import type { ChecklistItem, ChecklistTemplateItem, Project } from "@/lib/types";

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
  const [checklist, setChecklist] = useState<{ id: string; content: string; checked: boolean; required: boolean }[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
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

  // 태스크 로드 후 Firestore 체크리스트 템플릿 로드
  useEffect(() => {
    if (!task) return;
    setChecklistLoading(true);
    getTemplateItemsByStageAndDept(task.stage, task.department)
      .then((templateItems: ChecklistTemplateItem[]) => {
        if (templateItems.length > 0) {
          setChecklist(
            templateItems.map((ti) => ({
              id: ti.id,
              content: ti.content,
              checked: false,
              required: ti.isRequired,
            }))
          );
        } else {
          // 해당 단계/부서에 템플릿이 없으면 기본 항목
          setChecklist([
            { id: "default-1", content: "관련 문서 작성 완료", checked: false, required: true },
            { id: "default-2", content: "관련 부서 검토 완료", checked: false, required: true },
            { id: "default-3", content: "일정 검토 완료", checked: false, required: true },
          ]);
        }
      })
      .catch((e) => {
        console.error("체크리스트 템플릿 로드 실패:", e);
        setChecklist([
          { id: "default-1", content: "관련 문서 작성 완료", checked: false, required: true },
          { id: "default-2", content: "관련 부서 검토 완료", checked: false, required: true },
          { id: "default-3", content: "일정 검토 완료", checked: false, required: true },
        ]);
      })
      .finally(() => setChecklistLoading(false));
  // Only re-load template when task's stage/department change, not on every task update
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.stage, task?.department]);

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

  const handleRestart = async () => {
    if (!task || actionLoading) return;
    try {
      setActionLoading(true);
      await restartTask(task.id);
      showFeedback("success", "작업이 재시작되었습니다. 수정 후 다시 완료해주세요.");
    } catch (e) {
      console.error(e);
      showFeedback("error", "재작업 처리 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!task || !currentUser || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setUploadLoading(true);
    try {
      for (const file of files) {
        await uploadTaskFile(task.id, task.projectId, file, currentUser.name);
      }
      showFeedback("success", `${files.length}개 파일이 업로드되었습니다.`);
    } catch (err) {
      console.error(err);
      showFeedback("error", "파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadLoading(false);
      e.target.value = "";
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
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task || !project) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">작업을 불러오는 중...</p>
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
  const canRestart = isWorker && task.status === "rejected";

  const getStatusColor = (status: ChecklistItem["status"]) => {
    switch (status) {
      case "pending": return "bg-slate-500/15 text-slate-400 border-slate-500/20";
      case "in_progress": return "bg-primary-500/15 text-primary-300 border-primary-500/20";
      case "completed": return "bg-success-500/15 text-success-400 border-success-500/20";
      case "rejected": return "bg-danger-500/15 text-danger-400 border-danger-500/20";
    }
  };

  const taskDueDate = new Date(task.dueDate);
  const progress = getChecklistProgress();

  return (
    <div className="min-h-screen bg-surface-0">
      <Navigation />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center space-x-2 text-sm text-slate-500 mb-8">
          <button
            onClick={() => router.push("/projects")}
            className="hover:text-slate-300 transition-colors"
          >
            프로젝트
          </button>
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
          </svg>
          <button
            onClick={() => router.push(`/project?id=${projectId}`)}
            className="hover:text-slate-300 transition-colors truncate max-w-xs"
          >
            {project.name}
          </button>
          <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-200 font-medium">작업 상세</span>
        </nav>

        {/* Task Header Card */}
        <div className="bg-surface-2 border border-surface-3 rounded-2xl p-8 mb-8">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center flex-wrap gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold tracking-wide border ${getStatusColor(task.status)}`}>
                {getStatusLabel(task.status)}
              </span>
              {task.approvalStatus === "approved" && (
                <span className="badge-success">
                  승인 완료
                </span>
              )}
              <span className="text-xs text-slate-500 font-mono uppercase tracking-widest">
                {task.stage}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-100 tracking-tight">{task.title}</h1>
            <p className="text-base text-slate-400 leading-relaxed max-w-3xl">{task.description}</p>
          </div>

          <div className="divider my-6" />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">부서</div>
              <div className="text-sm font-semibold text-slate-200">{task.department}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">담당자</div>
              <div className="text-sm font-semibold text-slate-200">{task.assignee}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">검토자</div>
              <div className="text-sm font-semibold text-slate-200">{task.reviewer}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-medium">마감일</div>
              <div className={`text-sm font-semibold font-mono ${taskDueDate < new Date() ? "text-danger-400" : "text-slate-200"}`}>
                {taskDueDate.toLocaleDateString("ko-KR")}
              </div>
            </div>
          </div>

          {/* Rejection reason if rejected */}
          {task.status === "rejected" && task.rejectionReason && (
            <div className="mt-6 p-5 bg-danger-500/10 border border-danger-500/20 rounded-xl">
              <p className="text-sm font-semibold text-danger-400 mb-1.5">반려 사유</p>
              <p className="text-sm text-slate-300 leading-relaxed">{task.rejectionReason}</p>
              {task.rejectedBy && (
                <p className="text-xs text-slate-500 mt-2">
                  반려자: {task.rejectedBy} · {task.rejectedAt && new Date(task.rejectedAt).toLocaleDateString("ko-KR")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Checklist Section */}
            <div className="bg-surface-2 border border-surface-3 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="section-title">체크리스트</h2>
                <div className="text-sm font-mono">
                  <span className="text-primary-400 font-bold">{progress.completed}</span>
                  <span className="text-slate-500">/{progress.total}</span>
                  <span className="text-slate-600 ml-3 text-xs">
                    필수 <span className="text-primary-400 font-bold">{progress.requiredCompleted}</span>
                    <span className="text-slate-500">/{progress.requiredTotal}</span>
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-surface-3 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>

              <div className="space-y-3">
                {checklistLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-sm text-slate-500">체크리스트 로딩 중...</span>
                  </div>
                ) : checklist.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    이 단계/부서에 해당하는 체크리스트 항목이 없습니다.
                  </div>
                ) : checklist.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                      item.checked
                        ? "bg-primary-500/10 border-primary-500/30"
                        : "bg-surface-1 border-surface-3 hover:border-surface-4"
                    } ${!canComplete ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleChecklistToggle(item.id)}
                        disabled={!canComplete}
                        className="sr-only peer"
                      />
                      <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                        item.checked
                          ? "bg-primary-500 border-primary-500"
                          : "border-surface-4 bg-surface-1"
                      }`}>
                        {item.checked && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className={`text-sm ${item.checked ? "text-slate-200 font-medium" : "text-slate-400"}`}>
                        {item.content}
                      </span>
                      {item.required && (
                        <span className="badge-danger text-[10px] py-0.5 px-1.5">필수</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {canComplete && !isChecklistComplete() && (
                <div className="mt-5 p-4 bg-warning-500/10 border border-warning-500/20 rounded-xl">
                  <p className="text-sm text-warning-400">필수 체크리스트 항목을 모두 완료해야 작업을 완료할 수 있습니다.</p>
                </div>
              )}
              {canComplete && isChecklistComplete() && (
                <div className="mt-5 p-4 bg-success-500/10 border border-success-500/20 rounded-xl">
                  <p className="text-sm text-success-400">모든 필수 항목이 완료되었습니다. 작업을 완료할 수 있습니다.</p>
                </div>
              )}
            </div>

            {/* Files Section */}
            <div className="bg-surface-2 border border-surface-3 rounded-2xl p-8">
              <h2 className="section-title mb-6">첨부 파일</h2>
              {canComplete && (
                <div className="mb-6">
                  <label className={`group block w-full p-8 border-2 border-dashed border-surface-4 rounded-xl text-center transition-all duration-200 ${
                    uploadLoading ? "opacity-50 cursor-wait" : "cursor-pointer hover:border-primary-500/40 hover:bg-surface-1/50"
                  }`}>
                    {uploadLoading ? (
                      <>
                        <div className="w-10 h-10 mx-auto mb-3 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-slate-400">업로드 중...</p>
                      </>
                    ) : (
                      <>
                        <svg className="w-10 h-10 mx-auto mb-3 text-slate-500 group-hover:text-primary-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">클릭하여 파일 업로드 또는 드래그 앤 드롭</p>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      disabled={uploadLoading}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              )}

              {/* Real files from task */}
              {task.files && task.files.length > 0 ? (
                <div className="space-y-2">
                  {task.files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 bg-surface-1 border border-surface-3 rounded-xl group hover:border-surface-4 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/15 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-200">{file.name}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {(file.size / 1024 / 1024).toFixed(1)} MB · {file.uploadedBy}
                          </div>
                        </div>
                      </div>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-500 hover:text-primary-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-8">첨부된 파일이 없습니다.</p>
              )}
            </div>

            {/* Comments Section */}
            <div className="bg-surface-2 border border-surface-3 rounded-2xl p-8">
              <h2 className="section-title mb-6">코멘트</h2>

              <div className="mb-8">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="코멘트를 입력하세요..."
                  rows={3}
                  className="input-field resize-none"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleAddComment}
                    disabled={actionLoading || !comment.trim()}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
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
                      <div key={c.id} className="flex gap-3">
                        <div className="w-9 h-9 bg-primary-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-primary-300">
                            {c.userName.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="bg-surface-1 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-slate-200">{c.userName}</span>
                              <span className="text-xs text-slate-500 font-mono">{formatTimeAgo(c.createdAt)}</span>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">{c.content}</p>
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-8">코멘트가 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Actions */}
          <div className="lg:col-span-1">
            <div className="bg-surface-2 border border-surface-3 rounded-2xl p-6 sticky top-8">
              <h2 className="section-title mb-5">작업 관리</h2>

              {/* Feedback message */}
              {feedback && (
                <div className={`mb-5 p-4 rounded-xl text-sm font-medium ${
                  feedback.type === "success"
                    ? "bg-success-500/10 border border-success-500/20 text-success-400"
                    : "bg-danger-500/10 border border-danger-500/20 text-danger-400"
                }`}>
                  {feedback.text}
                </div>
              )}

              {/* Worker Actions */}
              {canComplete && (
                <div className="space-y-3">
                  <button
                    onClick={handleComplete}
                    disabled={!isChecklistComplete() || actionLoading}
                    className={`w-full py-3 rounded-xl transition-all duration-200 font-medium flex items-center justify-center gap-2 ${
                      isChecklistComplete() && !actionLoading
                        ? "bg-success-600 text-white hover:bg-success-500 shadow-glow-sm cursor-pointer"
                        : "bg-surface-3 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>작업 완료</span>
                    )}
                  </button>
                  <p className="text-xs text-slate-500 text-center">
                    {isChecklistComplete()
                      ? "완료 후 부서 관리자의 승인이 필요합니다"
                      : "체크리스트를 완료해주세요"}
                  </p>
                </div>
              )}

              {/* Manager Actions */}
              {canApprove && (
                <div className="space-y-4">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="w-full py-3 bg-success-600 text-white rounded-xl hover:bg-success-500 transition-all duration-200 font-medium flex items-center justify-center disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "승인"
                    )}
                  </button>

                  <div className="divider my-4" />

                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">반려 사유</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="반려 사유를 입력하세요..."
                      rows={3}
                      className="input-field resize-none text-sm mb-3"
                    />
                    <button
                      onClick={handleReject}
                      disabled={actionLoading || !rejectionReason.trim()}
                      className="btn-danger w-full py-3 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {actionLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "반려"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Approved state */}
              {task.status === "completed" && task.approvalStatus === "approved" && (
                <div className="text-center py-8">
                  <div className="w-14 h-14 mx-auto mb-3 bg-success-500/15 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-success-400">승인 완료</p>
                  {task.approvedBy && (
                    <p className="text-xs text-slate-500 mt-1">승인자: {task.approvedBy}</p>
                  )}
                </div>
              )}

              {/* Restart action for rejected tasks (worker) */}
              {canRestart && (
                <div className="space-y-3">
                  <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl mb-3">
                    <p className="text-sm text-danger-400 font-medium">반려됨</p>
                    <p className="text-xs text-slate-500 mt-1">수정 후 다시 제출해주세요</p>
                  </div>
                  <button
                    onClick={handleRestart}
                    disabled={actionLoading}
                    className="w-full py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-500 transition-all duration-200 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>재작업 시작</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* View Only / other statuses */}
              {!canComplete && !canApprove && !canRestart && task.approvalStatus !== "approved" && (
                <div className="text-center py-8 text-slate-500">
                  {task.status === "completed" && (!task.approvalStatus || task.approvalStatus === "pending") && (
                    <div>
                      <div className="w-14 h-14 mx-auto mb-3 bg-primary-500/10 rounded-full flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <p className="text-sm text-slate-400">승인 대기 중</p>
                    </div>
                  )}
                  {task.status === "rejected" && (
                    <div>
                      <div className="w-14 h-14 mx-auto mb-3 bg-danger-500/10 rounded-full flex items-center justify-center">
                        <svg className="w-7 h-7 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-sm text-slate-400">반려됨</p>
                      <p className="text-xs text-slate-500 mt-1">담당자의 재작업이 필요합니다</p>
                    </div>
                  )}
                  {task.status === "pending" && !isWorker && !isManager && (
                    <div>
                      <div className="w-14 h-14 mx-auto mb-3 bg-surface-3 rounded-full flex items-center justify-center">
                        <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-sm text-slate-400">조회 전용</p>
                    </div>
                  )}
                </div>
              )}

              {/* Task History */}
              <div className="mt-6 pt-6 divider">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-4">작업 히스토리</h3>
                <div className="relative space-y-4">
                  {/* Timeline line */}
                  <div className="absolute left-[5px] top-2 bottom-2 w-px bg-surface-3" />

                  <div className="relative flex items-start gap-3">
                    <div className="w-[11px] h-[11px] bg-surface-4 rounded-full mt-0.5 z-10 ring-2 ring-surface-2" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-300 font-medium">작업 배정됨</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {new Date(new Date(task.dueDate).getTime() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                  </div>
                  {task.status !== "pending" && (
                    <div className="relative flex items-start gap-3">
                      <div className="w-[11px] h-[11px] bg-primary-500 rounded-full mt-0.5 z-10 ring-2 ring-surface-2" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-300 font-medium">작업 시작됨</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {new Date(new Date(task.dueDate).getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  )}
                  {task.completedDate && (
                    <div className="relative flex items-start gap-3">
                      <div className="w-[11px] h-[11px] bg-success-500 rounded-full mt-0.5 z-10 ring-2 ring-surface-2" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-300 font-medium">작업 완료됨</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {new Date(task.completedDate).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  )}
                  {task.approvalStatus === "approved" && task.approvedAt && (
                    <div className="relative flex items-start gap-3">
                      <div className="w-[11px] h-[11px] bg-success-500 rounded-full mt-0.5 z-10 ring-2 ring-surface-2" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-300 font-medium">승인 완료</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {new Date(task.approvedAt).toLocaleDateString("ko-KR")} · {task.approvedBy}
                        </p>
                      </div>
                    </div>
                  )}
                  {task.status === "rejected" && task.rejectedAt && (
                    <div className="relative flex items-start gap-3">
                      <div className="w-[11px] h-[11px] bg-danger-500 rounded-full mt-0.5 z-10 ring-2 ring-surface-2" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-300 font-medium">반려됨</p>
                        <p className="text-xs text-slate-500 font-mono">
                          {new Date(task.rejectedAt).toLocaleDateString("ko-KR")} · {task.rejectedBy}
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
    <Suspense fallback={<div className="min-h-screen bg-surface-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <TaskDetailContent />
    </Suspense>
  );
}
