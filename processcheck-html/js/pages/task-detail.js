// ═══════════════════════════════════════════════════════════════════════════════
// Task Detail Page — view & manage a single checklist item
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage, getUser } from "../auth.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
initTheme();
import {
  subscribeProjects,
  subscribeChecklistItems,
  completeTask,
  approveTask,
  rejectTask,
  restartTask,
  addComment,
  updateComment,
  deleteComment,
  addFileMetadata,
  removeFileMetadata,
  subscribeActivityLogs,
  getUsers,
} from "../firestore-service.js";
import { getStatusLabel, escapeHtml, timeAgo, formatDate, formatStageName, getStatusBadgeClass, GATE_STAGES, parseMentions, renderSimpleMarkdown, getFileIcon, formatFileSize, validateFile, extractMentions } from "../utils.js";
import { storage } from "../firebase-init.js";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

// ── Guard ────────────────────────────────────────────────────────────────────
const user = guardPage();
if (!user) throw new Error("Not authenticated");

// ── DOM refs ─────────────────────────────────────────────────────────────────
const navRoot = document.getElementById("nav-root");
const app = document.getElementById("app");
const navUnsub = renderNav(navRoot);

// ── URL params ───────────────────────────────────────────────────────────────
const params = new URLSearchParams(window.location.search);
const projectId = params.get("projectId");
const taskId = params.get("taskId");

if (!projectId || !taskId) {
  app.innerHTML = `<div class="container"><div class="card p-6 mt-6 text-center"><p class="text-soft">잘못된 접근입니다. 프로젝트 ID 또는 작업 ID가 없습니다.</p><a href="dashboard.html" class="btn-primary mt-4" style="display:inline-flex">대시보드로 이동</a></div></div>`;
  throw new Error("Missing projectId or taskId");
}

// ── State ────────────────────────────────────────────────────────────────────
let task = null;
let project = null;
let checklist = [
  { id: "cl-1", content: "요구사항 문서 검토 완료", checked: false, required: true },
  { id: "cl-2", content: "기술 스펙 확인 완료", checked: false, required: true },
  { id: "cl-3", content: "관련 부서 협의 완료", checked: false, required: true },
  { id: "cl-4", content: "테스트 결과 확인", checked: false, required: false },
  { id: "cl-5", content: "최종 검토 및 서명", checked: false, required: true },
];
let comment = "";
let rejectionReason = "";
let actionLoading = false;
let feedback = null; // { type: "success" | "error", text: string }
let feedbackTimer = null;
let allUsers = [];
let showMentionDropdown = false;
let mentionQuery = "";

// ── Subscriptions ────────────────────────────────────────────────────────────
const unsubscribers = [];

const unsubProjects = subscribeProjects((projects) => {
  project = projects.find((p) => p.id === projectId) || null;
  render();
});
unsubscribers.push(unsubProjects);

const unsubItems = subscribeChecklistItems(projectId, (items) => {
  task = items.find((t) => t.id === taskId) || null;
  render();
});
unsubscribers.push(unsubItems);

// Load all users for @mention support
getUsers().then(users => { allUsers = users; });

// ── Cleanup ──────────────────────────────────────────────────────────────────
window.addEventListener("beforeunload", () => {
  unsubscribers.forEach((u) => u && u());
  if (navUnsub) navUnsub();
  if (feedbackTimer) clearTimeout(feedbackTimer);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function showFeedback(type, text) {
  feedback = { type, text };
  render();
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    feedback = null;
    render();
  }, 4000);
}

function handleFileUpload(files) {
  if (!files || files.length === 0 || !task) return;
  const file = files[0];
  const validation = validateFile(file);
  if (!validation.valid) {
    showFeedback("error", validation.error);
    return;
  }
  const fileId = `file-${Date.now()}`;
  const storageRef = ref(storage, `tasks/${task.projectId}/${task.id}/${fileId}_${file.name}`);
  const uploadTask = uploadBytesResumable(storageRef, file);

  // Show progress
  const progressEl = document.getElementById("upload-progress");
  if (progressEl) progressEl.style.display = "block";

  uploadTask.on("state_changed",
    (snapshot) => {
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      const bar = document.getElementById("upload-progress-bar");
      if (bar) bar.style.width = pct + "%";
    },
    (error) => {
      showFeedback("error", "파일 업로드 실패: " + error.message);
      if (progressEl) progressEl.style.display = "none";
    },
    async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      await addFileMetadata(task.id, {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url,
        uploadedBy: user.name,
        storagePath: storageRef.fullPath,
      });
      showFeedback("success", "파일 업로드 완료");
      if (progressEl) progressEl.style.display = "none";
    }
  );
}

function getApprovalBadge(t) {
  if (!t) return "";
  if (t.approvalStatus === "approved") return `<span class="badge badge-success">승인됨</span>`;
  if (t.approvalStatus === "rejected") return `<span class="badge badge-danger">반려됨</span>`;
  if (t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending")) {
    return `<span class="badge badge-warning">승인 대기</span>`;
  }
  return "";
}

function canComplete() {
  return user.role === "worker" && task && (task.status === "pending" || task.status === "in_progress");
}

function isGateStage(stageName) {
  return GATE_STAGES.includes(stageName);
}

function canApprove() {
  if (!task || task.status !== "completed" || (task.approvalStatus && task.approvalStatus !== "pending")) {
    return false;
  }
  // 모든 승인은 기획조정실(observer)만 수행
  // 매니저는 작업 배분만 담당
  return user.role === "observer";
}

function canRestart() {
  return user.role === "worker" && task && task.status === "rejected";
}

function allRequiredChecked() {
  return checklist.filter((c) => c.required).every((c) => c.checked);
}

function getCheckedCount() {
  return checklist.filter((c) => c.checked).length;
}

function getChecklistProgress() {
  return Math.round((getCheckedCount() / checklist.length) * 100);
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

const ICONS = {
  check: `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
  checkCircle: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  x: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/></svg>`,
  clock: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  eye: `<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`,
  upload: `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>`,
  file: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`,
  chevronRight: `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`,
  spinner: `<div class="spinner" style="width:18px;height:18px;border-width:2px"></div>`,
  warning: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>`,
};

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  if (!task || !project) {
    if (task === null && project === null) {
      // Still loading
      return;
    }
    if (!task) {
      app.innerHTML = `<div class="container"><div class="card p-6 mt-6 text-center"><p class="text-soft">작업을 찾을 수 없습니다.</p><a href="dashboard.html" class="btn-primary mt-4" style="display:inline-flex">대시보드로 이동</a></div></div>`;
      return;
    }
    return;
  }

  const statusClass = getStatusBadgeClass(task.status);
  const statusLabel = getStatusLabel(task.status);
  const progress = getChecklistProgress();
  const checkedCount = getCheckedCount();
  const _canComplete = canComplete();
  const _canApprove = canApprove();

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-soft mb-6" style="margin-top:0.5rem">
        <a href="dashboard.html" style="color:var(--slate-400);text-decoration:none">프로젝트</a>
        <span style="color:var(--slate-400)">${ICONS.chevronRight}</span>
        <a href="project.html?id=${escapeHtml(projectId)}" style="color:var(--slate-400);text-decoration:none">${escapeHtml(project.name)}</a>
        <span style="color:var(--slate-400)">${ICONS.chevronRight}</span>
        <span style="color:var(--slate-300)">작업 상세</span>
      </nav>

      <!-- Task Header Card -->
      <div class="card p-6 mb-6">
        <div class="flex items-center gap-3 flex-wrap mb-3">
          <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
          ${getApprovalBadge(task)}
          <span class="badge badge-neutral">${escapeHtml(formatStageName(task.stage))}</span>
        </div>
        <h1 style="font-size:1.5rem;font-weight:700;color:var(--slate-100);letter-spacing:-0.025em;margin-bottom:0.5rem">${escapeHtml(task.title)}</h1>
        <p class="text-sm text-soft" style="line-height:1.6;max-width:48rem">${escapeHtml(task.description || "")}</p>

        <hr class="divider" style="margin:1.25rem 0" />

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div class="text-xs text-dim font-medium mb-1" style="text-transform:uppercase;letter-spacing:0.05em">부서</div>
            <div class="text-sm" style="color:var(--slate-200)">${escapeHtml(task.department || "-")}</div>
          </div>
          <div>
            <div class="text-xs text-dim font-medium mb-1" style="text-transform:uppercase;letter-spacing:0.05em">담당자</div>
            <div class="text-sm" style="color:var(--slate-200)">${escapeHtml(task.assignee || "-")}</div>
          </div>
          <div>
            <div class="text-xs text-dim font-medium mb-1" style="text-transform:uppercase;letter-spacing:0.05em">검토자</div>
            <div class="text-sm" style="color:var(--slate-200)">${escapeHtml(task.reviewer || "-")}</div>
          </div>
          <div>
            <div class="text-xs text-dim font-medium mb-1" style="text-transform:uppercase;letter-spacing:0.05em">마감일</div>
            <div class="text-sm" style="color:var(--slate-200)">${formatDate(task.dueDate)}</div>
          </div>
        </div>

        ${task.approvalStatus === "rejected" && task.rejectionReason ? `
          <div style="margin-top:1.25rem;padding:1rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-lg)">
            <div class="flex items-center gap-2 mb-2">
              <span style="color:var(--danger-400)">${ICONS.x}</span>
              <span class="text-sm font-semibold" style="color:var(--danger-400)">반려 사유</span>
            </div>
            <p class="text-sm" style="color:var(--danger-300);line-height:1.5">${escapeHtml(task.rejectionReason)}</p>
            ${task.rejectedBy ? `<p class="text-xs text-dim mt-2">반려자: ${escapeHtml(task.rejectedBy)}</p>` : ""}
          </div>
        ` : ""}
      </div>

      <!-- Two-Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column -->
        <div style="grid-column:span 1" class="lg-col-span-2 flex flex-col gap-6">

          <!-- Checklist Section -->
          <div class="card p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="section-title">체크리스트</h2>
              <span class="text-sm text-soft font-mono">${checkedCount}/${checklist.length}</span>
            </div>
            <div class="progress-bar mb-4">
              <div class="progress-fill${progress === 100 ? " success" : ""}" style="width:${progress}%"></div>
            </div>
            <div class="flex flex-col gap-2">
              ${checklist.map((item, idx) => `
                <div class="flex items-center gap-3" style="padding:0.5rem 0.75rem;border-radius:var(--radius-lg);transition:background 0.15s;${_canComplete ? "cursor:pointer" : ""}" data-checklist-idx="${idx}" ${_canComplete ? 'role="button" tabindex="0"' : ""}>
                  <div class="checkbox-custom${item.checked ? " checked" : ""}" data-checklist-toggle="${idx}">
                    ${item.checked ? ICONS.check : ""}
                  </div>
                  <span class="text-sm${item.checked ? "" : ""}" style="color:${item.checked ? "var(--slate-300)" : "var(--slate-200)"};${item.checked ? "text-decoration:line-through" : ""};flex:1">${escapeHtml(item.content)}</span>
                  ${item.required ? `<span class="text-xs" style="color:var(--danger-400);font-weight:500">필수</span>` : `<span class="text-xs text-dim">선택</span>`}
                </div>
              `).join("")}
            </div>
            ${_canComplete && !allRequiredChecked() ? `
              <div class="flex items-center gap-2 mt-4" style="padding:0.75rem 1rem;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius-lg)">
                <span style="color:var(--warning-400)">${ICONS.warning}</span>
                <span class="text-xs" style="color:var(--warning-400)">모든 필수 항목을 완료해야 작업을 완료할 수 있습니다.</span>
              </div>
            ` : ""}
          </div>

          <!-- Attachments Section -->
          <div class="card p-6">
            <h2 class="section-title mb-4">첨부 파일</h2>
            <div id="file-upload-area" style="border:2px dashed var(--surface-4);border-radius:var(--radius-xl);padding:1.5rem;text-align:center;cursor:pointer;transition:border-color 0.2s">
              <input type="file" id="file-input" style="display:none" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif">
              <div style="color:var(--slate-300);margin-bottom:0.5rem">${ICONS.upload}</div>
              <p class="text-sm text-soft">파일을 드래그하거나 클릭하여 업로드</p>
              <p class="text-xs text-dim mt-1">PDF, DOC, XLS, 이미지 등 (최대 10MB)</p>
            </div>
            <div id="upload-progress" style="display:none;margin-top:8px">
              <div class="progress-bar"><div id="upload-progress-bar" class="progress-fill progress-fill-primary" style="width:0%"></div></div>
            </div>
            <div id="file-list" class="mt-3">
              ${(task.files || []).length > 0 ? task.files.map(f => `
                <div class="flex items-center gap-3" style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--surface-3)">
                  <span>${getFileIcon(f.name || '')}</span>
                  <a href="${escapeHtml(f.url || '#')}" target="_blank" class="text-sm" style="color:var(--primary-400);flex:1;text-decoration:none">${escapeHtml(f.name || '파일')}</a>
                  <span class="text-xs" style="color:var(--slate-400)">${formatFileSize(f.size)}</span>
                  <span class="text-xs" style="color:var(--slate-400)">${escapeHtml(f.uploadedBy || '')}</span>
                  ${f.uploadedBy === user.name ? `<button class="btn-ghost btn-xs" data-delete-file="${escapeHtml(f.id || '')}" data-file-path="${escapeHtml(f.storagePath || '')}">삭제</button>` : ''}
                </div>
              `).join("") : `
                <div class="text-xs" style="color:var(--slate-400);padding:8px">업로드된 파일이 없습니다</div>
              `}
            </div>
          </div>

          <!-- Comments Section -->
          <div class="card p-6">
            <h2 class="section-title mb-4">코멘트</h2>
            <div class="flex flex-col gap-3 mb-4" style="position:relative">
              <textarea class="input-field" id="comment-input" placeholder="코멘트를 입력하세요... (@로 멘션)" rows="3"></textarea>
              <div id="mention-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface-2);border:1px solid var(--surface-4);border-radius:var(--radius-lg);max-height:160px;overflow-y:auto;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,0.3)"></div>
              <div class="flex justify-end">
                <button class="btn-primary btn-sm" id="add-comment-btn" ${!comment.trim() ? "disabled" : ""}>
                  코멘트 추가
                </button>
              </div>
            </div>
            <div id="comments-list">
              ${renderComments()}
            </div>
          </div>
        </div>

        <!-- Right Sidebar -->
        <div style="grid-column:span 1">
          <div class="sticky" style="top:5rem">
            <div class="card p-6">
              <h3 class="section-title mb-4">작업 관리</h3>

              <!-- Feedback -->
              ${feedback ? `
                <div class="mb-4 animate-fade-in" style="padding:0.75rem 1rem;border-radius:var(--radius-lg);${feedback.type === "success"
                  ? "background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);color:var(--success-400)"
                  : "background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:var(--danger-400)"}">
                  <span class="text-sm">${escapeHtml(feedback.text)}</span>
                </div>
              ` : ""}

              <!-- Action Buttons -->
              <div class="flex flex-col gap-3 mb-6">
                ${renderActionSection()}
              </div>

              <hr class="divider" style="margin-bottom:1.25rem" />

              <!-- Timeline -->
              <h4 class="text-sm font-semibold mb-4" style="color:var(--slate-300)">작업 히스토리</h4>
              <div class="timeline">
                ${renderTimeline()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Fix left column span for lg breakpoint
  const leftCol = app.querySelector(".lg-col-span-2");
  if (leftCol) {
    leftCol.style.gridColumn = "";
    // Apply via media query workaround
    if (window.innerWidth >= 1024) {
      leftCol.style.gridColumn = "span 2";
    }
  }

  bindEvents();
}

// ── Render Helpers ────────────────────────────────────────────────────────────

function renderComments() {
  const comments = task.comments || [];
  if (comments.length === 0) {
    return `<div class="empty-state" style="padding:1rem"><span class="empty-state-text">아직 코멘트가 없습니다</span></div>`;
  }
  const sorted = [...comments].sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return bTime - aTime;
  });
  return sorted.map((c) => `
    <div class="comment">
      <div class="comment-avatar">${escapeHtml((c.userName || "?").charAt(0))}</div>
      <div class="comment-body">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(c.userName || "알 수 없음")}</span>
          <span class="comment-time">${timeAgo(c.createdAt)}</span>
        </div>
        <div class="comment-text">${parseMentions(c.content || "", allUsers.map(u => u.name))}</div>
        ${c.editedAt ? '<div class="text-xs" style="color:var(--slate-300);margin-top:2px">(수정됨)</div>' : ''}
        ${c.userId === user.id ? `
          <div class="flex gap-2 mt-1">
            <button class="btn-ghost btn-xs" data-edit-comment="${c.id}">수정</button>
            <button class="btn-ghost btn-xs" style="color:var(--danger-400)" data-delete-comment="${c.id}">삭제</button>
          </div>
        ` : ''}
      </div>
    </div>
  `).join("");
}

function renderActionSection() {
  if (!task) return "";

  const _canComplete = canComplete();
  const _canApprove = canApprove();

  // Worker: complete task
  if (_canComplete) {
    const disabled = !allRequiredChecked() || actionLoading;
    return `
      <button class="btn-primary w-full" id="complete-task-btn" ${disabled ? "disabled" : ""}>
        ${actionLoading ? ICONS.spinner : ICONS.checkCircle}
        <span>작업 완료</span>
      </button>
      ${!allRequiredChecked() ? `<p class="text-xs text-dim text-center">필수 체크리스트 항목을 모두 완료하세요</p>` : ""}
    `;
  }

  // Manager: approve / reject
  if (_canApprove) {
    return `
      <button class="btn-primary w-full" id="approve-task-btn" ${actionLoading ? "disabled" : ""}>
        ${actionLoading ? ICONS.spinner : ICONS.checkCircle}
        <span>승인</span>
      </button>
      <textarea class="input-field" id="rejection-reason-input" placeholder="반려 사유를 입력하세요..." rows="2"></textarea>
      <button class="btn-danger w-full" id="reject-task-btn" ${actionLoading ? "disabled" : ""}>
        ${ICONS.x}
        <span>반려</span>
      </button>
    `;
  }

  // Approved state
  if (task.approvalStatus === "approved") {
    return `
      <div class="flex items-center justify-center gap-2 p-4" style="color:var(--success-400)">
        ${ICONS.checkCircle}
        <span class="text-sm font-semibold">승인 완료</span>
      </div>
      ${task.approvedBy ? `<p class="text-xs text-dim text-center">승인자: ${escapeHtml(task.approvedBy)}</p>` : ""}
    `;
  }

  // Waiting for approval
  if (task.status === "completed" && (!task.approvalStatus || task.approvalStatus === "pending")) {
    return `
      <div class="flex items-center justify-center gap-2 p-4" style="color:var(--warning-400)">
        ${ICONS.spinner}
        <span class="text-sm font-semibold">승인 대기 중</span>
      </div>
      <div class="text-xs text-dim text-center" style="margin-top:0.25rem">
        ${task.reviewer ? `검토자: ${escapeHtml(task.reviewer)}` : ""}
        ${task.completedDate ? ` · 완료일: ${formatDate(task.completedDate)}` : ""}
      </div>
    `;
  }

  // Rejected — worker can restart
  if (task.approvalStatus === "rejected") {
    return `
      <div class="flex items-center justify-center gap-2 p-4" style="color:var(--danger-400)">
        ${ICONS.x}
        <span class="text-sm font-semibold">반려됨</span>
      </div>
      ${task.rejectedBy ? `<p class="text-xs text-dim text-center">반려자: ${escapeHtml(task.rejectedBy)}</p>` : ""}
      ${canRestart() ? `
        <button class="btn-primary w-full mt-3" id="restart-task-btn" ${actionLoading ? "disabled" : ""}>
          ${actionLoading ? ICONS.spinner : ICONS.checkCircle}
          <span>재작업 시작</span>
        </button>
      ` : ""}
    `;
  }

  // View only
  return `
    <div class="flex items-center justify-center gap-2 p-4" style="color:var(--slate-300)">
      ${ICONS.eye}
      <span class="text-sm font-semibold">조회 전용</span>
    </div>
  `;
}

function renderTimeline() {
  if (!task) return "";

  // 추정 날짜 계산
  const dueDate = task.dueDate instanceof Date ? task.dueDate : (task.dueDate ? new Date(task.dueDate) : null);
  const assignedDate = dueDate ? new Date(dueDate.getTime() - 14 * 86400000) : null;
  const startedDate = dueDate ? new Date(dueDate.getTime() - 7 * 86400000) : null;

  const events = [
    {
      label: "작업 배정됨",
      date: assignedDate,
      active: true,
      completed: true,
    },
    {
      label: "작업 시작됨",
      date: startedDate,
      active: task.status === "in_progress" || task.status === "completed" || task.status === "rejected",
      completed: task.status === "in_progress" || task.status === "completed" || task.status === "rejected",
      hideIfInactive: task.status === "pending",
    },
    {
      label: "작업 완료됨",
      date: task.completedDate || null,
      active: task.status === "completed" || task.status === "rejected",
      completed: task.status === "completed" || task.status === "rejected",
    },
    {
      label: task.approvalStatus === "approved" ? `승인 완료${task.approvedBy ? ` (${task.approvedBy})` : ""}` : "승인 완료",
      date: task.approvedAt || null,
      active: task.approvalStatus === "approved",
      completed: task.approvalStatus === "approved",
    },
    {
      label: task.approvalStatus === "rejected" ? `반려됨${task.rejectedBy ? ` (${task.rejectedBy})` : ""}` : "반려됨",
      date: task.rejectedAt || null,
      active: task.approvalStatus === "rejected",
      completed: false,
      isDanger: true,
    },
  ];

  return events.map((ev) => {
    let dotClass = "timeline-dot";
    if (ev.isDanger && ev.active) dotClass += " active";
    else if (ev.completed) dotClass += " completed";
    else if (ev.active) dotClass += " active";

    const textColor = ev.active || ev.completed
      ? (ev.isDanger ? "var(--danger-400)" : "var(--slate-200)")
      : "var(--slate-400)";

    const dateStr = ev.date ? formatDate(ev.date) : "";

    return `
      <div class="timeline-item">
        <div class="${dotClass}" ${ev.isDanger && ev.active ? 'style="border-color:var(--danger-500);background:var(--danger-500)"' : ""}></div>
        <div>
          <div class="text-sm" style="color:${textColor}">${escapeHtml(ev.label)}</div>
          ${dateStr ? `<div class="text-xs" style="color:var(--slate-300);margin-top:0.125rem">${dateStr}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

// ── Event Binding ────────────────────────────────────────────────────────────

function bindEvents() {
  // Checklist toggles
  if (canComplete()) {
    app.querySelectorAll("[data-checklist-toggle]").forEach((el) => {
      const parent = el.closest("[data-checklist-idx]");
      const handler = () => {
        const idx = parseInt(el.dataset.checklistToggle, 10);
        checklist[idx].checked = !checklist[idx].checked;
        render();
      };
      el.addEventListener("click", handler);
      if (parent) {
        parent.addEventListener("click", (e) => {
          if (e.target === el || el.contains(e.target)) return;
          handler();
        });
        parent.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handler();
          }
        });
      }
    });
  }

  // Complete task
  const completeBtn = app.querySelector("#complete-task-btn");
  if (completeBtn) {
    completeBtn.addEventListener("click", async () => {
      if (!allRequiredChecked() || actionLoading) return;
      actionLoading = true;
      render();
      try {
        await completeTask(taskId);
        showFeedback("success", "작업이 완료 처리되었습니다.");
      } catch (e) {
        console.error(e);
        showFeedback("error", "작업 완료 중 오류가 발생했습니다.");
      } finally {
        actionLoading = false;
      }
    });
  }

  // Approve task
  const approveBtn = app.querySelector("#approve-task-btn");
  if (approveBtn) {
    approveBtn.addEventListener("click", async () => {
      if (actionLoading) return;
      actionLoading = true;
      render();
      try {
        await approveTask(taskId, user.name);
        showFeedback("success", "작업이 승인되었습니다.");
      } catch (e) {
        console.error(e);
        showFeedback("error", "승인 중 오류가 발생했습니다.");
      } finally {
        actionLoading = false;
      }
    });
  }

  // Reject task
  const rejectBtn = app.querySelector("#reject-task-btn");
  if (rejectBtn) {
    rejectBtn.addEventListener("click", async () => {
      const reasonInput = app.querySelector("#rejection-reason-input");
      const reason = reasonInput ? reasonInput.value.trim() : "";
      if (!reason) {
        showFeedback("error", "반려 사유를 입력해주세요.");
        return;
      }
      if (actionLoading) return;
      actionLoading = true;
      rejectionReason = reason;
      render();
      try {
        await rejectTask(taskId, user.name, rejectionReason);
        showFeedback("success", "작업이 반려되었습니다.");
        rejectionReason = "";
      } catch (e) {
        console.error(e);
        showFeedback("error", "반려 중 오류가 발생했습니다.");
      } finally {
        actionLoading = false;
      }
    });
  }

  // Restart task (after rejection)
  const restartBtn = app.querySelector("#restart-task-btn");
  if (restartBtn) {
    restartBtn.addEventListener("click", async () => {
      if (actionLoading) return;
      actionLoading = true;
      render();
      try {
        await restartTask(taskId);
        showFeedback("success", "작업이 재시작되었습니다.");
      } catch (e) {
        console.error(e);
        showFeedback("error", "재시작 중 오류가 발생했습니다.");
      } finally {
        actionLoading = false;
      }
    });
  }

  // Rejection reason textarea sync
  const rejectionInput = app.querySelector("#rejection-reason-input");
  if (rejectionInput) {
    rejectionInput.value = rejectionReason;
    rejectionInput.addEventListener("input", (e) => {
      rejectionReason = e.target.value;
    });
  }

  // Comment input
  const commentInput = app.querySelector("#comment-input");
  if (commentInput) {
    commentInput.value = comment;
    commentInput.addEventListener("input", (e) => {
      comment = e.target.value;
      const addBtn = app.querySelector("#add-comment-btn");
      if (addBtn) addBtn.disabled = !comment.trim();
    });
  }

  // Add comment
  const addCommentBtn = app.querySelector("#add-comment-btn");
  if (addCommentBtn) {
    addCommentBtn.addEventListener("click", async () => {
      const text = comment.trim();
      if (!text) return;
      try {
        await addComment(taskId, user.id, user.name, text);
        comment = "";
        showFeedback("success", "코멘트가 추가되었습니다.");
      } catch (e) {
        console.error(e);
        showFeedback("error", "코멘트 추가 중 오류가 발생했습니다.");
      }
    });
  }

  // File upload events
  const uploadArea = document.getElementById("file-upload-area");
  const fileInput = document.getElementById("file-input");
  if (uploadArea && fileInput) {
    uploadArea.addEventListener("click", () => fileInput.click());
    uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.style.borderColor = "var(--primary-400)"; });
    uploadArea.addEventListener("dragleave", () => { uploadArea.style.borderColor = "var(--surface-3)"; });
    uploadArea.addEventListener("drop", (e) => { e.preventDefault(); uploadArea.style.borderColor = "var(--surface-3)"; handleFileUpload(e.dataTransfer.files); });
    fileInput.addEventListener("change", () => { handleFileUpload(fileInput.files); fileInput.value = ""; });
  }

  // File delete
  app.querySelectorAll("[data-delete-file]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("파일을 삭제하시겠습니까?")) return;
      const fileId = btn.dataset.deleteFile;
      const filePath = btn.dataset.filePath;
      try {
        if (filePath) {
          const { deleteObject, ref: storageRef } = await import("firebase/storage");
          await deleteObject(storageRef(storage, filePath));
        }
        await removeFileMetadata(task.id, fileId);
        showFeedback("success", "파일 삭제 완료");
      } catch(err) { showFeedback("error", "파일 삭제 실패"); }
    });
  });

  // Comment edit
  app.querySelectorAll("[data-edit-comment]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const cId = btn.dataset.editComment;
      const existing = (task.comments || []).find(c => c.id === cId);
      const newText = prompt("코멘트 수정:", existing?.content || "");
      if (newText !== null && newText.trim()) {
        await updateComment(task.id, cId, newText.trim());
        showFeedback("success", "코멘트 수정 완료");
      }
    });
  });

  // Comment delete
  app.querySelectorAll("[data-delete-comment]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("코멘트를 삭제하시겠습니까?")) return;
      await deleteComment(task.id, btn.dataset.deleteComment);
      showFeedback("success", "코멘트 삭제 완료");
    });
  });

  // Responsive left column sizing
  handleResponsiveLayout();
}

function handleResponsiveLayout() {
  const leftCol = app.querySelector(".lg-col-span-2");
  if (leftCol) {
    const applyLayout = () => {
      leftCol.style.gridColumn = window.innerWidth >= 1024 ? "span 2" : "span 1";
    };
    applyLayout();
    window._taskDetailResizeHandler = applyLayout;
    window.addEventListener("resize", applyLayout);
  }
}

// Clean up resize handler on re-render
const _originalRender = render;
