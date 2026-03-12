// ═══════════════════════════════════════════════════════════════════════════════
// Task Detail Page — view & manage a single checklist item
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage, getUser } from "../auth.js";
import { confirmModal } from "../ui/confirm-modal.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
import { renderSkeletonCards } from "../ui/skeleton.js";
initTheme();
import {
  subscribeProjects,
  subscribeChecklistItems,
  completeTask,
  restartTask,
  addComment,
  updateComment,
  deleteComment,
  addFileMetadata,
  removeFileMetadata,
  subscribeActivityLogs,
  getUsers,
  updateChecklistItem,
  updateChecklistItemStatus,
  subscribeGateRecords,
  addGateMeetingNote,
} from "../firestore-service.js";
import { getStatusLabel, escapeHtml, timeAgo, formatDate, formatStageName, getStatusBadgeClass, GATE_STAGES, parseMentions, renderSimpleMarkdown, getFileIcon, formatFileSize, validateFile, extractMentions, departments, PHASE_GROUPS, projectStages } from "../utils.js";
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
  app.innerHTML = `<div class="container"><div class="card p-6 mt-6 text-center"><p class="text-soft">잘못된 접근입니다. 프로젝트 ID 또는 작업 ID가 없습니다.</p><a href="projects.html?type=신규개발" class="btn-primary mt-4" style="display:inline-flex">대시보드로 이동</a></div></div>`;
  throw new Error("Missing projectId or taskId");
}

// ── State ────────────────────────────────────────────────────────────────────
let task = null;
let project = null;
let gateRecords = [];
let meetingNoteText = "";
let comment = "";
let rejectionReason = "";
let actionLoading = false;
let feedback = null; // { type: "success" | "error", text: string }
let feedbackTimer = null;
let allUsers = [];
let showMentionDropdown = false;
let mentionQuery = "";

// ── Initial skeleton ─────────────────────────────────────────────────────────
if (app) app.innerHTML = `<div class="container">${renderSkeletonCards(2)}</div>`;

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

// Gate records subscription (for meeting notes)
if (projectId) {
  const unsubGate = subscribeGateRecords(projectId, (records) => {
    gateRecords = records;
    render();
  });
  unsubscribers.push(unsubGate);
}

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

function getPhaseForStage(stageName) {
  return PHASE_GROUPS.find(p => p.workStage === stageName || p.gateStage === stageName) || null;
}

function getGateRecordForPhase(phaseName) {
  return gateRecords.find(gr => gr.phaseName === phaseName) || null;
}

function getMeetingNotes() {
  const phase = getPhaseForStage(task?.stage);
  if (!phase) return [];
  const gr = getGateRecordForPhase(phase.name);
  return (gr?.meetingNotes || []).map(n => ({
    ...n,
    createdAt: n.createdAt?.toDate ? n.createdAt.toDate() : (n.createdAt ? new Date(n.createdAt) : null),
  })).sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
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
      app.innerHTML = `<div class="container"><div class="card p-6 mt-6 text-center"><p class="text-soft">작업을 찾을 수 없습니다.</p><a href="projects.html?type=신규개발" class="btn-primary mt-4" style="display:inline-flex">대시보드로 이동</a></div></div>`;
      return;
    }
    return;
  }

  const statusLabels = { pending: "대기", in_progress: "진행 중", completed: "완료", rejected: "반려" };
  const dueDateVal = task.dueDate ? (task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate)).toISOString().slice(0, 10) : "";
  const deptOptions = departments.map(d => `<option value="${d}" ${task.department === d ? "selected" : ""}>${d}</option>`).join("");
  const userOptions = allUsers.map(u => `<option value="${u.name}" ${task.assignee === u.name ? "selected" : ""}>${u.name}${u.department ? ` (${u.department})` : ""}</option>`).join("");
  const phase = getPhaseForStage(task.stage);
  const meetingNotes = getMeetingNotes();

  // D-Day calculation
  let ddText = "";
  let ddColor = "var(--slate-400)";
  if (task.dueDate) {
    const due = task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate);
    const now = new Date();
    const diff = Math.ceil((due - now) / 86400000);
    if (task.status === "completed") { ddText = "완료"; ddColor = "var(--success-400)"; }
    else if (diff < 0) { ddText = `D+${Math.abs(diff)}`; ddColor = "var(--danger-400)"; }
    else if (diff === 0) { ddText = "D-Day"; ddColor = "var(--warning-400)"; }
    else { ddText = `D-${diff}`; ddColor = diff <= 3 ? "var(--warning-400)" : "var(--slate-300)"; }
  }

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Breadcrumb -->
      <nav class="flex items-center gap-2 text-sm text-soft mb-6" style="margin-top:0.5rem">
        <a href="projects.html?type=신규개발" style="color:var(--slate-400);text-decoration:none">프로젝트</a>
        <span style="color:var(--slate-400)">${ICONS.chevronRight}</span>
        <a href="project.html?id=${escapeHtml(projectId)}" style="color:var(--slate-400);text-decoration:none">${escapeHtml(project.name)}</a>
        <span style="color:var(--slate-400)">${ICONS.chevronRight}</span>
        <span style="color:var(--slate-300)">작업 상세</span>
      </nav>

      <!-- Feedback Toast -->
      ${feedback ? `
        <div class="mb-4 animate-fade-in" style="padding:0.75rem 1rem;border-radius:var(--radius-lg);${feedback.type === "success"
          ? "background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);color:var(--success-400)"
          : "background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:var(--danger-400)"}">
          <span class="text-sm">${escapeHtml(feedback.text)}</span>
        </div>
      ` : ""}

      <!-- Task Header Card (Editable) -->
      <div class="card p-6 mb-6">
        <div class="flex items-center gap-3 flex-wrap mb-3">
          <select id="task-status" style="padding:0.375rem 0.75rem;font-size:0.8rem;border:1px solid var(--surface-3);border-radius:var(--radius-lg);background:var(--surface-2);color:var(--slate-200);font-weight:600;">
            ${Object.entries(statusLabels).map(([k, v]) => `<option value="${k}" ${task.status === k ? "selected" : ""}>${v}</option>`).join("")}
          </select>
          <span class="badge badge-neutral">${escapeHtml(formatStageName(task.stage))}</span>
          <span style="font-size:1.1rem;font-weight:700;color:${ddColor};margin-left:auto;">${ddText}</span>
        </div>
        <h1 style="font-size:1.5rem;font-weight:700;color:var(--slate-100);letter-spacing:-0.025em;margin-bottom:0.5rem">${escapeHtml(task.title)}</h1>
        ${task.description ? `<p class="text-sm text-soft" style="line-height:1.6;max-width:48rem">${escapeHtml(task.description)}</p>` : ""}

        <hr class="divider" style="margin:1.25rem 0" />

        <!-- Editable Fields Grid -->
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;">
          <div>
            <label class="text-xs text-dim font-medium" style="display:block;margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.05em">부서</label>
            <select id="task-dept" class="input-field" style="font-size:0.85rem;padding:0.5rem 0.75rem;">
              <option value="">미지정</option>
              ${deptOptions}
            </select>
          </div>
          <div>
            <label class="text-xs text-dim font-medium" style="display:block;margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.05em">담당자</label>
            <select id="task-assignee" class="input-field" style="font-size:0.85rem;padding:0.5rem 0.75rem;">
              <option value="">미배분</option>
              ${userOptions}
            </select>
          </div>
          <div>
            <label class="text-xs text-dim font-medium" style="display:block;margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.05em">마감일</label>
            <input type="date" id="task-duedate" class="input-field" style="font-size:0.85rem;padding:0.5rem 0.75rem;" value="${dueDateVal}">
          </div>
          <div>
            <label class="text-xs text-dim font-medium" style="display:block;margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.05em">중요도</label>
            <select id="task-importance" class="input-field" style="font-size:0.85rem;padding:0.5rem 0.75rem;">
              <option value="green" ${(task.importance || "green") === "green" ? "selected" : ""}>보통</option>
              <option value="yellow" ${task.importance === "yellow" ? "selected" : ""}>중요</option>
              <option value="red" ${task.importance === "red" ? "selected" : ""}>긴급</option>
            </select>
          </div>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end mt-4 gap-3">
          <button class="btn-primary" id="save-task-btn" style="border-radius:var(--radius-xl);padding:0.5rem 1.5rem;">
            저장
          </button>
        </div>
      </div>

      <!-- Two-Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column -->
        <div style="grid-column:span 1" class="lg-col-span-2 flex flex-col gap-6">

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
              ${(() => {
                const allFiles = [
                  ...(task.files || []).map(f => ({ ...f, source: "upload" })),
                  ...(task.attachments || []).map(f => ({ ...f, source: "attachment" })),
                ];
                if (allFiles.length === 0) return '<div class="text-xs" style="color:var(--slate-400);padding:8px">업로드된 파일이 없습니다</div>';
                return allFiles.map(f => `
                  <div class="flex items-center gap-3" style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--surface-3)">
                    <span>${getFileIcon(f.name || '')}</span>
                    ${f.url
                      ? `<a href="${escapeHtml(f.url)}" target="_blank" class="text-sm" style="color:var(--primary-400);flex:1;text-decoration:none">${escapeHtml(f.name || '파일')}</a>`
                      : `<span class="text-sm" style="color:var(--slate-200);flex:1">${escapeHtml(f.name || '파일')}</span>`
                    }
                    <span class="text-xs" style="color:var(--slate-400)">${f.size ? formatFileSize(f.size) : ''}</span>
                    <span class="text-xs" style="color:var(--slate-400)">${escapeHtml(f.uploadedBy || '')}</span>
                    ${f.source === "upload" && f.uploadedBy === user.name ? `<button class="btn-ghost btn-xs" data-delete-file="${escapeHtml(f.id || '')}" data-file-path="${escapeHtml(f.storagePath || '')}">삭제</button>` : ''}
                  </div>
                `).join("");
              })()}
            </div>
          </div>

          <!-- Meeting Notes Section (회의록) -->
          <div class="card p-6">
            <h2 class="section-title mb-4">회의록</h2>
            ${phase ? `<div class="text-xs text-dim mb-3">Phase: ${escapeHtml(phase.name)}</div>` : ""}
            <div class="flex flex-col gap-3 mb-4">
              <textarea class="input-field" id="meeting-note-input" placeholder="회의록을 입력하세요..." rows="3">${escapeHtml(meetingNoteText)}</textarea>
              <div class="flex justify-end">
                <button class="btn-primary btn-sm" id="add-meeting-note-btn" style="border-radius:var(--radius-xl);">
                  회의록 추가
                </button>
              </div>
            </div>
            <div id="meeting-notes-list">
              ${renderMeetingNotes(meetingNotes)}
            </div>
          </div>
        </div>

        <!-- Right Sidebar -->
        <div style="grid-column:span 1">
          <div class="sticky" style="top:5rem">
            <div class="card p-6">
              <h3 class="section-title mb-4">작업 히스토리</h3>
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

function renderMeetingNotes(notes) {
  if (!notes || notes.length === 0) {
    return `<div class="empty-state" style="padding:1rem"><span class="empty-state-text">아직 회의록이 없습니다</span></div>`;
  }
  return notes.map((n) => `
    <div style="padding:0.75rem;background:var(--surface-1);border-radius:var(--radius-lg);margin-bottom:0.5rem;border-left:3px solid var(--primary-400);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.375rem;">
        <span style="font-weight:600;font-size:0.8rem;color:var(--slate-200);">${escapeHtml(n.author || "")}</span>
        <span style="font-size:0.7rem;color:var(--slate-400);">${n.createdAt ? formatDate(n.createdAt) : ""}</span>
      </div>
      <div style="font-size:0.8rem;color:var(--slate-300);line-height:1.5;white-space:pre-wrap;">${escapeHtml(n.content || "")}</div>
    </div>
  `).join("");
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
  // Save task fields
  const saveBtn = app.querySelector("#save-task-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      if (actionLoading) return;
      actionLoading = true;
      const dueDateVal = task.dueDate ? (task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate)).toISOString().slice(0, 10) : "";
      const updates = {};
      const newAssignee = document.getElementById("task-assignee")?.value;
      const newDept = document.getElementById("task-dept")?.value;
      const newDueDate = document.getElementById("task-duedate")?.value;
      const newImportance = document.getElementById("task-importance")?.value;
      const newStatus = document.getElementById("task-status")?.value;

      if (newAssignee !== (task.assignee || "")) updates.assignee = newAssignee;
      if (newDept !== (task.department || "")) updates.department = newDept;
      if (newImportance !== (task.importance || "green")) updates.importance = newImportance;
      if (newDueDate && newDueDate !== dueDateVal) updates.dueDate = new Date(newDueDate);

      try {
        if (newStatus && newStatus !== task.status) {
          await updateChecklistItemStatus(task.id, newStatus);
        }
        if (Object.keys(updates).length > 0) {
          await updateChecklistItem(task.id, updates);
        }
        showFeedback("success", "저장 완료");
      } catch (e) {
        console.error(e);
        showFeedback("error", "저장 중 오류가 발생했습니다.");
      } finally {
        actionLoading = false;
      }
    });
  }

  // Meeting note input sync
  const meetingNoteInput = app.querySelector("#meeting-note-input");
  if (meetingNoteInput) {
    meetingNoteInput.addEventListener("input", (e) => {
      meetingNoteText = e.target.value;
    });
  }

  // Add meeting note
  const addMeetingNoteBtn = app.querySelector("#add-meeting-note-btn");
  if (addMeetingNoteBtn) {
    addMeetingNoteBtn.addEventListener("click", async () => {
      const text = meetingNoteText.trim();
      if (!text) { showFeedback("error", "회의록 내용을 입력하세요."); return; }
      const phase = getPhaseForStage(task.stage);
      if (!phase) { showFeedback("error", "Phase를 찾을 수 없습니다."); return; }
      try {
        await addGateMeetingNote(projectId, phase.name === "발의" ? "phase0" : phase.name === "기획" ? "phase1" : phase.name === "WM" ? "phase2" : phase.name === "Tx" ? "phase3" : phase.name === "MSG" ? "phase4" : "phase5", phase.name, user.name, text);
        meetingNoteText = "";
        showFeedback("success", "회의록이 추가되었습니다.");
      } catch (e) {
        console.error(e);
        showFeedback("error", "회의록 추가 중 오류가 발생했습니다.");
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
      if (!await confirmModal("파일을 삭제하시겠습니까?")) return;
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
