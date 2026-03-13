// =============================================================================
// Project Detail Page — 3-tab project view (개요+작업 / 스케줄 / 병목)
// =============================================================================

import { guardPage } from "../auth.js";
import { showToast } from "../ui/toast.js";
import { confirmModal } from "../ui/confirm-modal.js";
import { renderNav, initTheme } from "../components.js";
initTheme();
import {
  subscribeProjects,
  subscribeChecklistItems,
  subscribeActivityLogs,
  getUsers,
  createChecklistItem,
  deleteChecklistItem,
  updateChecklistItemStatus,
  updateChecklistItem,
  getTemplateStages,
  applyTemplateToProject,
  applyLaunchChecklistToProject,
  subscribeLaunchChecklists,
  subscribeGateRecords,
  updateGateRecord,
  updateGateApprovedAt,
  addGateMeetingNote,
  batchUpdateMultiPhaseSchedule,
  PHASE_DESCRIPTIONS,
  getBlockingStatus,
} from "../firestore-service.js";
import { openSlideOver, closeSlideOver } from "../ui/slide-over.js";
import { storage } from "../firebase-init.js";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { renderSkeletonCards, renderSkeletonStats } from "../ui/skeleton.js";
import { initSortable } from "../ui/dnd.js";
import {
  departments,
  PHASE_GROUPS,
  getStatusLabel,
  formatStageName,
  escapeHtml,
  formatDate,
  formatDateShort,
  getQueryParam,
  daysUntil,
  getRiskLabel,
  timeAgo,
  exportToCSV,
  exportToPDF,
} from "../utils.js";

// --- Auth guard ---
const user = guardPage();
if (!user) throw new Error("Not authenticated");

// --- Get project ID from URL ---
const projectId = getQueryParam("id");
if (!projectId) {
  window.location.href = "projects.html?type=신규개발";
  throw new Error("No project ID");
}

// --- DOM refs ---
const navRoot = document.getElementById("nav-root");
const app = document.getElementById("app");

// --- State ---
let project = null;
let checklistItems = [];
let activeTab = "work";      // work | schedule | bottleneck
let selectedStage = "";
let selectedDepartment = "";
let checklistFilter = "";
let allUsers = [];
let activityLogs = [];
let checklistView = "phase"; // phase | timeline | department | board | list
let dynamicPhaseGroups = []; // Firestore templateStages 기반 동적 phase

// --- Render nav ---
if (navRoot) renderNav(navRoot, "project.html", user);

// --- Loading ---
if (app) app.innerHTML = `<div class="container">${renderSkeletonStats(4)}${renderSkeletonCards(6)}</div>`;

// --- Load users + template stages ---
getUsers().then((u) => { allUsers = u; }).catch(() => {});
getTemplateStages().then((stages) => {
  dynamicPhaseGroups = stages.map(s => ({
    id: s.id,
    name: s.name,
    workStage: s.workStageName,
    gateStage: s.gateStageName,
  }));
  render();
}).catch(() => {});

// --- Subscribe ---
let _unsubProject = null;
let _unsubChecklist = null;
let gateRecords = [];
let launchCount = 0;

let projectsLoaded = false;
_unsubProject = subscribeProjects((projects) => {
  project = projects.find((p) => p.id === projectId) || null;
  projectsLoaded = true;
  render();
});

_unsubChecklist = subscribeChecklistItems(projectId, (items) => {
  checklistItems = items;
  render();
});

subscribeActivityLogs("project", projectId, (logs) => {
  activityLogs = logs;
  render();
});

subscribeGateRecords(projectId, (records) => {
  gateRecords = records;
  render();
});

subscribeLaunchChecklists(projectId, (items) => {
  launchCount = items.length;
  // Update launch button visibility if rendered
  const btn = document.getElementById("apply-launch-btn");
  if (btn) btn.style.display = launchCount > 0 ? "none" : "";
});

// =============================================================================
// Helpers
// =============================================================================

// 동적 phase groups (Firestore templateStages 우선, 없으면 하드코딩 PHASE_GROUPS 폴백)
function getActivePhaseGroups() {
  return dynamicPhaseGroups.length > 0 ? dynamicPhaseGroups : PHASE_GROUPS;
}

// 해당 phase의 gate stage 목록 (동적)
function _getActiveGateStages() {
  return getActivePhaseGroups().map(p => p.gateStage);
}

function _getMatrixCellData(stageName, dept) {
  const tasks = checklistItems.filter(
    (t) => t.stage === stageName && t.department === dept
  );
  const total = tasks.length;
  const count = tasks.filter((t) => t.status === "completed").length;
  const status = total === 0 ? "empty" : count === total ? "completed" : count > 0 ? "in_progress" : "pending";
  return { total, count, status };
}

function getPhaseGateStatus(phaseName) {
  // gateRecords에서 위원회 승인 상태 확인
  const phases = getActivePhaseGroups();
  const phaseIdx = phases.findIndex(p => p.name === phaseName);
  if (phaseIdx < 0) return "none";
  const phaseId = `phase${phaseIdx}`;
  const gr = gateRecords.find(r => r.phaseId === phaseId);
  if (gr?.gateStatus === "approved") return "approved";
  if (gr?.gateStatus === "rejected") return "rejected";
  return "not_reached";
}

function getPhaseWorkProgress(phaseName) {
  const phase = getActivePhaseGroups().find(p => p.name === phaseName);
  if (!phase) return { total: 0, completed: 0, inProgress: 0, pending: 0, overdue: 0 };
  const tasks = checklistItems.filter(t => t.stage === phase.workStage);
  return {
    total: tasks.length,
    completed: tasks.filter(t => t.status === "completed").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    pending: tasks.filter(t => t.status === "pending").length,
    overdue: tasks.filter(t => {
      if (t.status === "completed" || t.status === "rejected") return false;
      const d = daysUntil(t.dueDate);
      return d !== null && d < 0;
    }).length,
  };
}

function getDDayClass(diff, status) {
  if (status === "completed") return "dday-done";
  if (diff === null) return "dday-none";
  if (diff < 0) return "dday-overdue";
  if (diff === 0) return "dday-today";
  if (diff <= 7) return "dday-soon";
  return "dday-safe";
}

// =============================================================================
// Main Render
// =============================================================================

function render() {
  if (!app) return;
  if (!project) {
    if (projectsLoaded) {
      app.innerHTML = `<div style="max-width:600px;margin:4rem auto;text-align:center;padding:2rem;">
        <div style="font-size:3rem;margin-bottom:1rem;">📋</div>
        <h2 style="color:var(--text-primary);margin-bottom:0.5rem;">프로젝트를 찾을 수 없습니다</h2>
        <p style="color:var(--text-soft);margin-bottom:1.5rem;">요청하신 프로젝트가 존재하지 않거나 삭제되었습니다.</p>
        <a href="projects.html?type=신규개발" class="btn-primary" style="display:inline-block;padding:0.5rem 1.5rem;border-radius:0.5rem;text-decoration:none;">프로젝트 목록으로</a>
      </div>`;
    }
    return;
  }

  // Phase 완료 상태를 체크리스트 데이터에서 직접 계산
  const activePhases = getActivePhaseGroups();
  const phaseStatuses = activePhases.map(ph => {
    const phaseTasks = checklistItems.filter(
      t => t.stage === ph.workStage || t.stage === ph.gateStage
    );
    if (phaseTasks.length === 0) return "empty";
    const allDone = phaseTasks.every(t => t.status === "completed");
    if (allDone) return "completed";
    const anyActive = phaseTasks.some(
      t => t.status === "in_progress" || t.status === "completed"
    );
    if (anyActive) return "active";
    return "pending";
  });

  // phaseIndex = 첫 번째 미완료 phase (기존 로직과 호환)
  let phaseIndex = phaseStatuses.findIndex(s => s !== "completed");
  if (phaseIndex === -1) phaseIndex = activePhases.length; // 전부 완료

  // Compute stats
  const totalTasks = checklistItems.length;
  const overdueTasks = checklistItems.filter(t => {
    if (t.status === "completed" || t.status === "rejected") return false;
    const d = daysUntil(t.dueDate);
    return d !== null && d < 0;
  }).length;
  const approvalPending = 0; // 승인 절차 제거됨

  // Save scroll + phase card open/close state before re-render
  const scrollY = window.scrollY;
  const openPhaseCards = new Set();
  app.querySelectorAll(".phase-card").forEach(card => {
    const body = card.querySelector(".phase-card-body");
    if (body && body.classList.contains("open")) {
      openPhaseCards.add(card.dataset.phaseIdx);
    }
  });
  const hadPhaseCards = openPhaseCards.size > 0 || app.querySelector(".phase-card") !== null;

  app.innerHTML = `
    <div class="container">
      ${renderProjectHeader(phaseIndex, phaseStatuses, totalTasks, overdueTasks, approvalPending)}

      <!-- Tabs -->
      <div class="tab-group mb-4" style="margin-top:1rem;">
        <button class="tab-btn${activeTab === "work" ? " active" : ""}" data-tab="work">개요 + 작업</button>
        <button class="tab-btn${activeTab === "schedule" ? " active" : ""}" data-tab="schedule">스케줄</button>
        <button class="tab-btn${activeTab === "bottleneck" ? " active" : ""}" data-tab="bottleneck">병목</button>
      </div>

      <!-- Tab Content -->
      <div class="animate-fade-in">
        ${activeTab === "work" ? renderWorkTab() : ""}
        ${activeTab === "schedule" ? renderScheduleTab() : ""}
        ${activeTab === "bottleneck" ? renderBottleneckTab() : ""}
      </div>
    </div>
  `;

  bindEvents();

  // Restore phase card open/close state after re-render
  if (hadPhaseCards) {
    app.querySelectorAll(".phase-card").forEach(card => {
      const idx = card.dataset.phaseIdx;
      const body = card.querySelector(".phase-card-body");
      const chevron = card.querySelector(".phase-card-chevron");
      if (openPhaseCards.has(idx)) {
        if (body && !body.classList.contains("open")) body.classList.add("open");
        if (chevron && !chevron.classList.contains("open")) chevron.classList.add("open");
      } else if (openPhaseCards.size > 0) {
        // Only collapse if we had explicit state (user had interacted)
        if (body) body.classList.remove("open");
        if (chevron) chevron.classList.remove("open");
      }
    });
    // Restore scroll position
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  } else {
    // UXA-01: Auto-scroll to current (active) phase in phase view (first load only)
    if (activeTab === "work" && checklistView === "phase") {
      requestAnimationFrame(() => {
        const activePhase = app.querySelector('[data-active-phase="true"]');
        if (activePhase) activePhase.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }
}

// =============================================================================
// Project Header — D-Day + Phase + Delay Reason (merged, compact)
// =============================================================================

function renderProjectHeader(phaseIndex, phaseStatuses, totalTasks, overdueTasks, _approvalPending) {
  const p = project;
  const activePhases = getActivePhaseGroups();
  const currentPhaseName = phaseIndex >= 0 && phaseIndex < activePhases.length ? activePhases[phaseIndex].name : formatStageName(p.currentStage);

  // D-day (원래 종료일 기준)
  const endDate = p.endDate ? new Date(p.endDate) : null;
  const dDays = endDate ? daysUntil(endDate) : null;
  const dDayText = dDays !== null ? (dDays < 0 ? `D+${Math.abs(dDays)}` : dDays === 0 ? "D-Day" : `D-${dDays}`) : "-";
  const headerDDayClass = getDDayClass(dDays, p.status);

  // 스케줄 지연 계산 (현재 단계 기준 누적 지연)
  const schedules = calculatePhaseSchedules();
  const lastSchedule = schedules.length > 0 ? schedules[schedules.length - 1] : null;
  const totalDelay = lastSchedule ? lastSchedule.totalDelay : 0;
  // 현재 활성 또는 지연 중인 Phase 찾기
  const currentSchedule = schedules.find(s => s.status === "delayed" || s.status === "active") || schedules.find(s => s.status === "pending");
  const _currentPhasDelay = currentSchedule ? currentSchedule.phaseDelay : 0;
  const _currentCumDelay = currentSchedule ? currentSchedule.totalDelay : totalDelay;
  // 예상 종료일 = 원래 종료일 + 누적 지연
  const projectedEndDate = endDate && totalDelay > 0 ? new Date(endDate.getTime() + totalDelay * 86400000) : null;

  // Delay reason (가장 많이 지연된 작업)
  let delayReason = "";
  let delayTaskId = "";
  if (overdueTasks > 0) {
    const overdue = checklistItems
      .filter(t => {
        if (t.status === "completed" || t.status === "rejected") return false;
        const d = daysUntil(t.dueDate);
        return d !== null && d < 0;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    if (overdue.length > 0) {
      const worst = overdue[0];
      const worstDays = Math.abs(daysUntil(worst.dueDate));
      delayReason = `${worst.department} ${worst.title} (${worst.assignee || "미배정"}) — ${worstDays}일 지연`;
      delayTaskId = worst.id;
    }
  }

  return `
    <div class="card p-5 animate-fade-in">
      <div style="display:flex;flex-wrap:wrap;gap:1.5rem;justify-content:space-between;align-items:flex-start;">
        <!-- Left: Title + Phase + D-Day -->
        <div style="flex:1;min-width:260px;">
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;flex-wrap:wrap;">
            <h1 style="font-size:1.5rem;font-weight:700;color:var(--slate-100);margin:0;">${escapeHtml(p.name)}</h1>
            <span class="badge badge-primary" style="font-size:0.75rem;">${currentPhaseName}</span>
            <span class="risk-dot ${p.riskLevel}" data-tooltip="${getRiskLabel(p.riskLevel)}"></span>
          </div>

          <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:0.5rem;">
            <!-- D-Day big -->
            <span class="dday-badge dday-badge-lg ${headerDDayClass}">${dDayText}</span>
            <div style="font-size:0.8rem;color:var(--slate-400);">
              ${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}
            </div>
            ${totalDelay > 0 ? `
              <div style="display:inline-flex;align-items:center;gap:0.375rem;padding:0.25rem 0.625rem;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-full);white-space:nowrap;">
                <span style="font-size:0.7rem;color:var(--danger-400);font-weight:600;">📅 예상 종료 ${projectedEndDate ? formatDate(projectedEndDate) : ""}</span>
                <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;font-weight:700;color:var(--danger-400);">(+${totalDelay}일)</span>
              </div>
            ` : ""}
          </div>

          ${delayReason || totalDelay > 0 ? `
            <${delayTaskId ? `a href="task.html?projectId=${encodeURIComponent(p.id)}&taskId=${encodeURIComponent(delayTaskId)}"` : "div"} style="display:inline-flex;align-items:center;gap:0.375rem;padding:0.375rem 0.75rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-lg);margin-bottom:0.5rem;max-width:100%;text-decoration:none;${delayTaskId ? "cursor:pointer;" : ""}transition:background 0.15s;" ${delayTaskId ? 'onmouseover="this.style.background=\'rgba(239,68,68,0.15)\'" onmouseout="this.style.background=\'rgba(239,68,68,0.08)\'"' : ""}>
              <svg width="12" height="12" fill="none" stroke="var(--danger-400)" viewBox="0 0 24 24" style="flex-shrink:0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              <span style="font-size:0.75rem;color:var(--danger-400);">${delayReason ? escapeHtml(delayReason) : `현재 단계 기준 누적 ${totalDelay}일 지연`}</span>
            </${delayTaskId ? "a" : "div"}>
          ` : `
            <div style="display:inline-flex;align-items:center;gap:0.375rem;padding:0.375rem 0.75rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-lg);margin-bottom:0.5rem;">
              <svg width="12" height="12" fill="none" stroke="var(--success-400)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span style="font-size:0.75rem;color:var(--success-400);">정상 진행</span>
            </div>
          `}

        </div>

        <!-- Right: Export Buttons -->
        <div style="display:flex;gap:0.5rem;flex-shrink:0;align-items:flex-start;">
          <button class="btn-ghost btn-sm" id="export-csv-btn" style="font-size:0.75rem;">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:0.25rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>CSV
          </button>
          <button class="btn-ghost btn-sm" id="export-pdf-btn" style="font-size:0.75rem;">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:0.25rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>PDF
          </button>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// Tab 1: 개요+작업 (2-column layout)
// =============================================================================

function _renderPhaseCards() {
  const activePhases = getActivePhaseGroups();
  return `
    <div class="phase-cards-row">
      ${activePhases.map((ph, idx) => {
        const phaseTasks = checklistItems.filter(t => t.stage === ph.workStage || t.stage === ph.gateStage);
        const total = phaseTasks.length;
        const completed = phaseTasks.filter(t => t.status === "completed").length;
        const overdue = phaseTasks.filter(t => {
          if (t.status === "completed" || t.status === "rejected") return false;
          const d = daysUntil(t.dueDate);
          return d !== null && d < 0;
        }).length;
        const gr = gateRecords.find(r => r.phaseName === ph.name);
        const gateStatus = gr?.gateStatus || "pending";

        // Determine status
        let cardStatus = "pending";
        if (gateStatus === "approved") cardStatus = "done";
        else if (gateStatus === "rejected") cardStatus = "rejected";
        else if (total > 0 && completed === total) cardStatus = "done";
        else if (phaseTasks.some(t => t.status === "in_progress" || t.status === "completed")) cardStatus = "active";

        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        const statusIcon = cardStatus === "done" ? "✔" : cardStatus === "rejected" ? "✗" : cardStatus === "active" ? "▶" : "";
        const statusLabel = cardStatus === "done" ? "완료" : cardStatus === "rejected" ? "반려" : cardStatus === "active" ? "진행 중" : "대기";

        return `
          <button class="phase-card-pip phase-card-pip-${cardStatus}" data-phase-panel="${idx}">
            ${idx > 0 ? '<div class="phase-card-pip-connector"></div>' : ""}
            <div class="phase-card-pip-inner">
              <div class="phase-card-pip-header">
                ${statusIcon ? `<span class="phase-card-pip-icon">${statusIcon}</span>` : ""}
                <span class="phase-card-pip-name">${ph.name}</span>
              </div>
              ${total > 0 ? `
                <div class="phase-card-pip-progress-bar">
                  <div class="phase-card-pip-progress-fill phase-card-pip-fill-${cardStatus}" style="width:${pct}%"></div>
                </div>
                <div class="phase-card-pip-meta">
                  <span>${completed}/${total}</span>
                  ${overdue > 0 ? `<span class="phase-card-pip-overdue">⚠ ${overdue}</span>` : ""}
                </div>
              ` : `<div class="phase-card-pip-meta" style="font-size:0.6rem;color:var(--slate-500);">${statusLabel}</div>`}
            </div>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderWorkTab() {
  return `
    <!-- Gate Approval Card (위원회 승인 + 일정) -->
    ${renderGateApprovalCard(getActivePhaseGroups())}

    <!-- View Switcher -->
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
      ${["phase","timeline","board","matrix"].map(v => {
        const labels = { phase: "Phase", timeline: "타임라인", board: "부서", matrix: "매트릭스" };
        return `<button class="btn-ghost btn-sm view-switch-btn${checklistView === v ? " active" : ""}" data-view="${v}" style="font-size:0.7rem;padding:0.3rem 0.6rem;${checklistView === v ? "background:var(--primary-500);color:white;" : ""}">${labels[v]}</button>`;
      }).join("")}
    </div>

    <!-- Filters -->
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem;">
      <select class="input-field" style="width:auto;min-width:140px;font-size:0.8rem;" id="filter-stage">
        <option value="">전체 단계</option>
        ${getActivePhaseGroups().map(phase => `<option value="${phase.name}" ${selectedStage === phase.name ? "selected" : ""}>${phase.name}</option>`).join("")}
      </select>
      <select class="input-field" style="width:auto;min-width:130px;font-size:0.8rem;" id="filter-dept">
        <option value="">전체 부서</option>
        ${departments.map(d => `<option value="${d}" ${selectedDepartment === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}
      </select>
      ${checklistFilter ? `<button class="btn-ghost btn-sm" id="clear-filter-btn" style="font-size:0.7rem;">필터 해제 ✕</button>` : ""}
    </div>

    <!-- Quick Add (프로젝트 전용) -->
    <div style="background:var(--surface-2);border:1px solid var(--surface-3);border-radius:var(--radius-lg);padding:0.75rem;margin-bottom:1rem;">
      <p style="margin:0 0 0.5rem 0;font-size:0.7rem;color:var(--slate-400);">이 프로젝트에만 필요한 추가 작업을 등록합니다. 기본 템플릿 체크리스트와 별도로 관리됩니다.</p>
      <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;">
        <input type="text" id="quick-add-title" class="input-field" style="flex:1;font-size:0.8rem;min-width:0;" placeholder="프로젝트 전용 작업 내용을 입력하세요">
        <button class="btn-primary btn-sm" id="quick-add-btn" style="white-space:nowrap;padding:0.4rem 0.75rem;font-size:0.75rem;">추가</button>
      </div>
      <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
        <select id="quick-add-stage" class="input-field" style="width:auto;min-width:80px;font-size:0.7rem;padding:0.25rem 0.4rem;">
          ${getActivePhaseGroups().map((p, i) => `<option value="${p.workStage}" ${i === 0 ? "selected" : ""}>${p.name}</option>`).join("")}
        </select>
        <select id="quick-add-dept" class="input-field" style="width:auto;min-width:80px;font-size:0.7rem;padding:0.25rem 0.4rem;">
          ${departments.map(d => `<option value="${d}" ${d === (user.department || departments[0]) ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}
        </select>
        <select id="quick-add-importance" class="input-field" style="width:auto;min-width:60px;font-size:0.7rem;padding:0.25rem 0.4rem;">
          <option value="green">보통</option>
          <option value="yellow">중요</option>
          <option value="red">긴급</option>
        </select>
        <input type="date" id="quick-add-due" class="input-field" style="width:auto;font-size:0.7rem;padding:0.25rem 0.4rem;" value="${new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}">
        <span style="flex:1;"></span>
        <button class="btn-secondary btn-sm" id="open-add-modal-btn" style="padding:0.25rem 0.5rem;font-size:0.65rem;" title="상세 입력">상세 +</button>
        <button class="btn-secondary btn-sm" id="apply-template-btn" style="white-space:nowrap;padding:0.25rem 0.5rem;font-size:0.65rem;">📋 템플릿</button>
        <button class="btn-secondary btn-sm" id="apply-launch-btn" style="white-space:nowrap;padding:0.25rem 0.5rem;font-size:0.65rem;${launchCount > 0 ? 'display:none;' : ''}">🚀 출시</button>
      </div>
    </div>

    <!-- 2-Column Layout -->
    <div class="pd-two-col" style="display:grid;grid-template-columns:1fr 320px;gap:1rem;align-items:start;">
      <!-- Left: Checklist -->
      <div style="max-height:70vh;overflow-y:auto;border-radius:var(--radius-lg);">
        ${renderChecklist()}
      </div>

      <!-- Right: Recent Activity -->
      <div class="card p-4" style="max-height:70vh;overflow-y:auto;position:sticky;top:1rem;">
        <h3 style="font-size:0.85rem;font-weight:600;color:var(--slate-200);margin-bottom:0.75rem;">최근 활동</h3>
        ${renderRecentActivity()}
      </div>
    </div>

  `;
}

// --- Checklist views ---

function renderChecklist() {
  if (checklistView === "phase") return renderPhaseView();
  if (checklistView === "timeline") return renderTimelineView();
  if (checklistView === "board") return renderBoardView();
  if (checklistView === "matrix") return renderMatrixView();
  return renderPhaseView();
}

function getFilteredTasks() {
  let filtered = [...checklistItems];
  if (selectedStage) {
    const phase = getActivePhaseGroups().find(p => p.name === selectedStage);
    if (phase) {
      filtered = filtered.filter(t => t.stage === phase.workStage || t.stage === phase.gateStage);
    }
  }
  if (selectedDepartment) {
    filtered = filtered.filter(t => t.department === selectedDepartment);
  }
  if (checklistFilter === "delayed") {
    filtered = filtered.filter(t => {
      if (t.status === "completed" || t.status === "rejected") return false;
      const d = daysUntil(t.dueDate);
      return d !== null && d < 0;
    });
  }
  return filtered;
}

function renderTaskRow(task) {
  const dd = daysUntil(task.dueDate);
  const isOverdue = task.status !== "completed" && task.status !== "rejected" && dd !== null && dd < 0;
  const dotColor = isOverdue ? "var(--danger-400)" :
    task.status === "completed" ? "var(--success-400)" :
    task.status === "in_progress" ? "var(--primary-400)" :
    task.status === "rejected" ? "var(--danger-400)" : "var(--slate-400)";
  const ddText = task.status !== "completed" && dd !== null ? (dd < 0 ? `D+${Math.abs(dd)}` : dd === 0 ? "D-Day" : `D-${dd}`) : "";
  const rowClass = isOverdue ? "task-row-overdue" : task.status === "completed" ? "task-row-completed" : task.status === "in_progress" ? "task-row-inprogress" : "";
  const taskDDClass = getDDayClass(dd, task.status);

  // Dependency blocking status
  const deps = task.dependencies || [];
  const blocking = deps.length > 0 ? getBlockingStatus(task, checklistItems) : { blocked: false, blockers: [] };
  const blockedClass = blocking.blocked ? " task-row-blocked" : "";
  const depBadge = blocking.blocked
    ? `<span class="dep-inline-badge blocked">🔒 선행 ${blocking.blockers.length}건 미완료</span>`
    : deps.length > 0 && task.status !== "completed"
    ? `<span class="dep-inline-badge resolved">✓ 선행 완료</span>`
    : "";

  return `
    <div class="card-hover pd-task-row ${rowClass}${blockedClass}" data-task-id="${task.id}" style="border:none;border-bottom:1px solid var(--surface-3);border-radius:0;padding:0.625rem 0.75rem;cursor:pointer;">
      <div style="display:flex;align-items:start;gap:0.5rem;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.375rem;margin-bottom:0.25rem;flex-wrap:wrap;">
            <span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${dotColor};"></span>
            <span style="font-size:0.8rem;font-weight:500;${isOverdue ? "color:var(--danger-400);" : "color:var(--slate-200);"}">${escapeHtml(task.title)}</span>
            ${depBadge}
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.65rem;${isOverdue ? "color:var(--danger-400);font-weight:600;" : "color:var(--slate-400);"};flex-wrap:wrap;">
            <span>${escapeHtml(task.department)}</span>
            ${task.assignee ? `<span>${escapeHtml(task.assignee)}</span>` : ""}
            <span>${formatDate(task.dueDate)}</span>
            ${ddText ? `<span class="dday-badge dday-badge-sm ${taskDDClass}">${ddText}</span>` : ""}
            ${task.source === "manual" ? '<span class="peek-badge-manual">추가</span>' : ""}
            ${(task.attachments && task.attachments.length > 0) ? `<span style="display:inline-flex;align-items:center;gap:0.15rem;color:var(--primary-400);font-weight:500;" title="${task.attachments.length}개 첨부파일"><svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>${task.attachments.length}</span>` : ""}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.25rem;">
        ${task.source === "manual" ? `<button class="peek-delete-btn" data-delete-task="${task.id}" onclick="event.stopPropagation()" title="삭제"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : ""}
        <select class="inline-status-select" data-status-item="${task.id}" data-current="${task.status}" onclick="event.stopPropagation()">
          <option value="pending" ${task.status==="pending"?"selected":""}>대기</option>
          <option value="in_progress" ${task.status==="in_progress"?"selected":""}>진행</option>
          <option value="delayed" ${isOverdue?"selected":""}>지연</option>
          <option value="completed" ${task.status==="completed"?"selected":""}>완료</option>
        </select>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// Schedule Timeline Card — Phase별 일정 지연 전파 시각화
// =============================================================================

const DEFAULT_PHASE_DURATION = 60; // days per phase

// Phase별 실제 task dueDate 범위 계산
function getPhaseTaskDates(phase) {
  const tasks = checklistItems.filter(t => t.stage === phase.workStage || t.stage === phase.gateStage);
  let min = null, max = null;
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const d = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return { start: min, end: max, count: tasks.length };
}

function calculatePhaseSchedules() {
  const phases = getActivePhaseGroups();
  const p = project;
  if (!p || !p.startDate) return [];

  const projStart = new Date(p.startDate);
  projStart.setHours(0, 0, 0, 0);

  // 프로젝트에 저장된 phaseSchedules (계획 일정)
  const savedSchedules = p.phaseSchedules || {};

  const results = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const phaseId = `phase${i}`;
    const saved = savedSchedules[phaseId] || {};

    // 계획 일정: 저장된 값 우선, 없으면 고정 60일 기반 폴백
    const fallbackStart = new Date(projStart.getTime() + i * DEFAULT_PHASE_DURATION * 86400000);
    const fallbackEnd = new Date(projStart.getTime() + (i + 1) * DEFAULT_PHASE_DURATION * 86400000 - 86400000);

    const plannedStart = saved.plannedStart ? new Date(saved.plannedStart) : fallbackStart;
    const plannedEnd = saved.plannedEnd ? new Date(saved.plannedEnd) : fallbackEnd;
    plannedStart.setHours(0, 0, 0, 0);
    plannedEnd.setHours(0, 0, 0, 0);
    const plannedDuration = Math.max(1, Math.round((plannedEnd - plannedStart) / 86400000));

    // 실제 일정: 저장된 actual 값 우선, 없으면 계획 = 실제
    const actualStart = saved.actualStart ? new Date(saved.actualStart) : new Date(plannedStart);
    const actualEnd = saved.actualEnd ? new Date(saved.actualEnd) : new Date(plannedEnd);
    actualStart.setHours(0, 0, 0, 0);
    actualEnd.setHours(0, 0, 0, 0);

    // 지연 계산: 실제 종료 - 계획 종료
    const phaseDelay = Math.max(0, Math.round((actualEnd - plannedEnd) / 86400000));

    // 진행 상태
    const gr = gateRecords.find(r => r.phaseId === phaseId);
    const gateStatus = gr?.gateStatus || "pending";
    let status = "pending";

    if (gateStatus === "approved") {
      status = "completed";
    } else {
      const progress = getPhaseWorkProgress(phase.name);
      if (progress.total > 0 && progress.completed > 0) status = "active";
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (today > actualEnd && status !== "completed") status = "delayed";
    }

    // 계획 일정이 저장된 적이 있는지
    const hasPlanned = !!(saved.plannedStart && saved.plannedEnd);

    results.push({
      phase, phaseId, index: i,
      plannedStart, plannedEnd, plannedDuration,
      actualStart, actualEnd,
      projectedStart: actualStart,    // 하위 호환
      projectedEnd: actualEnd,        // 하위 호환
      daysPerPhase: plannedDuration,
      phaseDelay,
      cumulativeDelay: 0, // 이제 각 phase별 독립 계산
      totalDelay: phaseDelay,
      status, gateStatus, hasPlanned,
    });
  }

  return results;
}

function _renderScheduleTimelineCard() {
  const schedules = calculatePhaseSchedules();
  if (schedules.length === 0) return "";

  const totalDelay = schedules.length > 0 ? schedules[schedules.length - 1].totalDelay : 0;
  const p = project;
  const projStart = new Date(p.startDate);
  const _projEnd = p.endDate ? new Date(p.endDate) : null;

  // Timeline range: from project start to max of (planned end, projected end)
  const lastSchedule = schedules[schedules.length - 1];
  const plannedProjectEnd = lastSchedule.plannedEnd; // 6 phases × 60 days
  const timelineEnd = new Date(Math.max(
    plannedProjectEnd.getTime(),
    lastSchedule.projectedEnd.getTime(),
    Date.now()
  ));
  const timelineStart = projStart;
  const timelineRange = Math.max(1, (timelineEnd - timelineStart) / 86400000);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPct = Math.min(100, Math.max(0, ((today - timelineStart) / 86400000 / timelineRange) * 100));

  // Format helper
  const fmtShort = (d) => formatDateShort(d);

  return `
    <div class="card mb-4" style="border:1px solid var(--surface-3);overflow:hidden;">
      <div style="padding:0.75rem 1rem;background:var(--surface-1);border-bottom:1px solid var(--surface-3);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="font-size:1rem;">📅</span>
          <span style="font-size:0.9rem;font-weight:600;color:var(--slate-100);">일정 현황</span>
        </div>
        ${totalDelay > 0 ? `
          <div style="display:flex;align-items:center;gap:0.375rem;padding:0.25rem 0.75rem;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:999px;">
            <span style="font-size:0.75rem;font-weight:700;color:var(--danger-400);">누적 지연 +${totalDelay}일</span>
          </div>
        ` : `
          <div style="display:flex;align-items:center;gap:0.375rem;padding:0.25rem 0.75rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:999px;">
            <span style="font-size:0.75rem;font-weight:600;color:var(--success-400);">일정 정상</span>
          </div>
        `}
      </div>

      <div style="padding:0.75rem 1rem;">
        <!-- Legend -->
        <div style="display:flex;gap:1rem;margin-bottom:0.75rem;font-size:0.65rem;color:var(--slate-400);flex-wrap:wrap;">
          <span><span style="display:inline-block;width:12px;height:6px;background:var(--slate-500);opacity:0.3;border-radius:2px;vertical-align:middle;margin-right:3px;"></span>원래 일정</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:var(--success-400);border-radius:2px;vertical-align:middle;margin-right:3px;"></span>완료</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:var(--primary-400);border-radius:2px;vertical-align:middle;margin-right:3px;"></span>진행 중</span>
          <span><span style="display:inline-block;width:12px;height:6px;background:var(--danger-400);border-radius:2px;vertical-align:middle;margin-right:3px;"></span>지연</span>
          <span><span style="display:inline-block;width:1px;height:10px;background:var(--warning-400);vertical-align:middle;margin-right:3px;border-left:1.5px dashed var(--warning-400);"></span>오늘</span>
        </div>

        <!-- Timeline bars -->
        <div style="position:relative;">
          ${schedules.map((s, idx) => {
            const plannedStartPct = ((s.plannedStart - timelineStart) / 86400000 / timelineRange) * 100;
            const plannedWidthPct = (s.daysPerPhase / timelineRange) * 100;
            const projectedStartPct = ((s.projectedStart - timelineStart) / 86400000 / timelineRange) * 100;
            const projectedDuration = (s.projectedEnd - s.projectedStart) / 86400000;
            const projectedWidthPct = (projectedDuration / timelineRange) * 100;

            const barColor = s.status === "completed" ? "var(--success-400)"
              : s.status === "delayed" ? "var(--danger-400)"
              : s.status === "active" ? "var(--primary-400)"
              : "var(--slate-500)";

            const barOpacity = s.status === "pending" ? "0.4" : "0.85";

            // Show inherited delay arrow
            const inheritedDelay = s.cumulativeDelay;
            const ownDelay = s.phaseDelay;

            return `
              <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:${idx < schedules.length - 1 ? "0.5rem" : "0"};">
                <!-- Phase name -->
                <div style="min-width:64px;font-size:0.7rem;font-weight:600;color:var(--slate-200);text-align:right;">${s.phase.name}</div>

                <!-- Bar area -->
                <div style="flex:1;position:relative;height:28px;">
                  <!-- Planned bar (ghost) -->
                  <div style="position:absolute;top:4px;height:8px;left:${plannedStartPct}%;width:${plannedWidthPct}%;background:var(--slate-500);opacity:0.15;border-radius:2px;" title="원래: ${fmtShort(s.plannedStart)}~${fmtShort(s.plannedEnd)}"></div>

                  <!-- Projected/Actual bar -->
                  <div style="position:absolute;top:2px;height:12px;left:${projectedStartPct}%;width:${Math.max(0.5, projectedWidthPct)}%;background:${barColor};opacity:${barOpacity};border-radius:3px;transition:width 0.3s;" title="${fmtShort(s.projectedStart)}~${fmtShort(s.projectedEnd)}"></div>

                  <!-- Delay extension marker (red stripe for delay portion) -->
                  ${(ownDelay > 0 || inheritedDelay > 0) ? `
                    <div style="position:absolute;top:2px;height:12px;left:${plannedStartPct + plannedWidthPct}%;width:${((s.totalDelay) / timelineRange) * 100}%;background:repeating-linear-gradient(135deg,transparent,transparent 2px,rgba(239,68,68,0.15) 2px,rgba(239,68,68,0.15) 4px);border-radius:0 3px 3px 0;pointer-events:none;"></div>
                  ` : ""}

                  <!-- Date labels -->
                  <div style="position:absolute;top:16px;left:${projectedStartPct}%;font-size:0.55rem;color:var(--slate-500);white-space:nowrap;">${fmtShort(s.projectedStart)}</div>
                  <div style="position:absolute;top:16px;left:${projectedStartPct + Math.max(0.5, projectedWidthPct)}%;transform:translateX(-100%);font-size:0.55rem;color:var(--slate-500);white-space:nowrap;">${fmtShort(s.projectedEnd)}</div>
                </div>

                <!-- Delay badge -->
                <div style="min-width:56px;text-align:right;">
                  ${s.totalDelay > 0 ? `
                    <span style="font-size:0.65rem;font-weight:700;color:var(--danger-400);background:rgba(239,68,68,0.08);padding:0.1rem 0.35rem;border-radius:var(--radius-md);">+${s.totalDelay}일</span>
                    ${inheritedDelay > 0 && ownDelay > 0 ? `<div style="font-size:0.5rem;color:var(--slate-500);margin-top:1px;">자체 +${ownDelay} / 이전 +${inheritedDelay}</div>` : ""}
                    ${inheritedDelay > 0 && ownDelay === 0 ? `<div style="font-size:0.5rem;color:var(--slate-500);margin-top:1px;">이전 단계 영향</div>` : ""}
                  ` : s.status === "completed" ? `
                    <span style="font-size:0.65rem;color:var(--success-400);">✓</span>
                  ` : `
                    <span style="font-size:0.65rem;color:var(--slate-500);">—</span>
                  `}
                </div>
              </div>
            `;
          }).join("")}

          <!-- Today line (vertical dashed) -->
          <div style="position:absolute;top:0;bottom:0;left:${todayPct}%;width:0;border-left:1.5px dashed var(--warning-400);opacity:0.7;pointer-events:none;z-index:2;"></div>
        </div>

        <!-- Summary -->
        ${totalDelay > 0 ? `
          <div style="margin-top:0.75rem;padding:0.5rem 0.75rem;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-lg);font-size:0.7rem;color:var(--slate-300);">
            <span style="color:var(--danger-400);font-weight:600;">⚠</span>
            ${(() => {
              const orig = fmtShort(plannedProjectEnd);
              const newEnd = fmtShort(lastSchedule.projectedEnd);
              const delayedPhases = schedules.filter(s => s.phaseDelay > 0);
              const delayChain = delayedPhases.map(s => `${s.phase.name}(+${s.phaseDelay}일)`).join(" → ");
              return `원래 완료일 <strong>${orig}</strong> → 예상 완료일 <strong style="color:var(--danger-400);">${newEnd}</strong>` +
                (delayChain ? ` · 지연 원인: ${delayChain}` : "");
            })()}
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function renderGateApprovalCard(phases) {
  const schedules = calculatePhaseSchedules();
  const totalDelay = schedules.length > 0 ? schedules[schedules.length - 1].totalDelay : 0;
  const fmtShort = (d) => formatDateShort(d);

  return `
    <div class="card mb-4" style="border:1px solid var(--surface-3);overflow:hidden;">
      <div style="padding:0.75rem 1rem;background:var(--surface-1);border-bottom:1px solid var(--surface-3);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <span style="font-size:1rem;">🔒</span>
          <span style="font-size:0.9rem;font-weight:600;color:var(--slate-100);">위원회 승인</span>
        </div>
        ${totalDelay > 0 ? `
          <div style="display:flex;align-items:center;gap:0.375rem;padding:0.2rem 0.6rem;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:999px;">
            <span style="font-size:0.7rem;font-weight:700;color:var(--danger-400);">누적 지연 +${totalDelay}일</span>
          </div>
        ` : ""}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:0;">
        ${phases.map((phase, idx) => {
          const phaseId = `phase${idx}`;
          const gr = gateRecords.find(r => r.phaseId === phaseId) || null;
          const gateStatus = gr?.gateStatus || "pending";
          const bgColor = gateStatus === "approved" ? "rgba(34,197,94,0.06)" : gateStatus === "rejected" ? "rgba(239,68,68,0.06)" : "transparent";

          // Schedule info
          const sched = schedules[idx];
          const plannedEndStr = sched ? fmtShort(sched.plannedEnd) : "";
          const projectedEndStr = sched ? fmtShort(sched.projectedEnd) : "";
          const ownDelay = sched?.phaseDelay || 0;
          const inherited = sched?.cumulativeDelay || 0;
          const totalPhaseDelay = sched?.totalDelay || 0;
          const isDelayed = totalPhaseDelay > 0;

          const noteCount = gr?.meetingNotes?.length || 0;
          return `
            <div data-gate-panel="${idx}" style="padding:0.75rem;border-right:1px solid var(--surface-3);border-bottom:1px solid var(--surface-3);background:${bgColor};text-align:center;cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background='var(--surface-2)'" onmouseleave="this.style.background='${bgColor}'">
              <div style="font-size:0.75rem;font-weight:600;color:var(--slate-200);margin-bottom:0.25rem;">${phase.name}</div>

              <!-- Schedule: due date + delay -->
              ${sched ? `
                <div style="margin-bottom:0.375rem;">
                  <div style="font-size:0.6rem;color:var(--slate-500);">예정 ~${plannedEndStr}</div>
                  ${isDelayed ? `
                    <div style="display:inline-flex;align-items:center;gap:0.2rem;margin-top:0.15rem;padding:0.1rem 0.35rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-md);">
                      <span style="font-size:0.6rem;font-weight:700;color:var(--danger-400);">→ ${projectedEndStr} (+${totalPhaseDelay}일)</span>
                    </div>
                    ${inherited > 0 ? `<div style="font-size:0.5rem;color:var(--slate-500);margin-top:0.1rem;">${ownDelay > 0 ? `자체+${ownDelay} · 이전+${inherited}` : `이전 단계 +${inherited}일 영향`}</div>` : ""}
                  ` : gateStatus === "approved" ? `
                    <div style="font-size:0.55rem;color:var(--success-400);margin-top:0.1rem;">정상 완료</div>
                  ` : ""}
                </div>
              ` : ""}

              <div style="font-size:0.7rem;margin-bottom:0.25rem;color:${gateStatus === "approved" ? "var(--success-400)" : gateStatus === "rejected" ? "var(--danger-400)" : "var(--slate-400)"};">
                ${gateStatus === "approved" ? "✅ 승인" : gateStatus === "rejected" ? "❌ 반려" : "⏳ 대기"}
              </div>
              ${gr?.approvedBy ? `<div style="font-size:0.6rem;color:var(--slate-400);margin-bottom:0.25rem;">${escapeHtml(gr.approvedBy)} · ${gr.approvedAt ? formatDate(gr.approvedAt) : ""}</div>` : ""}
              ${noteCount > 0 ? `<div style="font-size:0.6rem;color:var(--primary-400);">💬 회의록 (${noteCount})</div>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderPhaseView() {
  const filtered = getFilteredTasks();
  if (filtered.length === 0) return renderEmptyState();

  const phases = getActivePhaseGroups();

  // Find active phase (first with incomplete tasks)
  const activePhaseIdx = phases.findIndex(phase => {
    const pt = checklistItems.filter(t => t.stage === phase.workStage || t.stage === phase.gateStage);
    return pt.length > 0 && pt.some(t => t.status !== "completed");
  });

  return phases.map((phase, idx) => {
    const phaseTasks = filtered.filter(t => t.stage === phase.workStage || t.stage === phase.gateStage);
    if (phaseTasks.length === 0) return "";

    const workTasks = phaseTasks.filter(t => t.stage !== phase.gateStage);
    const gateTasks = phaseTasks.filter(t => t.stage === phase.gateStage);
    const allTasks = [...workTasks, ...gateTasks];
    const completed = allTasks.filter(t => t.status === "completed").length;
    const total = allTasks.length;

    // Phase status determination
    const progress = getPhaseWorkProgress(phase.name);
    const isActive = idx === activePhaseIdx;
    const isCompleted = completed === total;
    const hasOverdue = progress.overdue > 0;

    // Date range from dueDate
    const dueDates = allTasks.filter(t => t.dueDate).map(t => new Date(t.dueDate).getTime());
    const minDate = dueDates.length > 0 ? new Date(Math.min(...dueDates)) : null;
    const maxDate = dueDates.length > 0 ? new Date(Math.max(...dueDates)) : null;

    // Max delay days among overdue incomplete tasks
    const overdueTasks = allTasks.filter(t => {
      if (t.status === "completed" || t.status === "rejected") return false;
      const d = daysUntil(t.dueDate);
      return d !== null && d < 0;
    });
    const maxDelayDays = overdueTasks.length > 0 ? Math.max(...overdueTasks.map(t => Math.abs(daysUntil(t.dueDate)))) : 0;

    // Border color class
    const borderCls = isCompleted ? "phase-card-done" : hasOverdue ? "phase-card-overdue" : isActive ? "phase-card-active" : "phase-card-pending";
    // Default collapsed for completed phases, expanded for active/future
    const defaultOpen = !isCompleted;

    // Phase description
    const desc = PHASE_DESCRIPTIONS[phase.name] || "";

    // Gate record (for approval + meeting notes)
    const phaseId = `phase${idx}`;
    const gr = gateRecords.find(r => r.phaseId === phaseId) || null;
    const _gateStatus = gr?.gateStatus || "pending";
    const notes = gr?.meetingNotes || [];

    // Status badge text
    const statusBadge = isCompleted ? '<span class="phase-status-badge phase-badge-done">✅ 완료</span>'
      : hasOverdue ? `<span class="phase-status-badge phase-badge-overdue">⚠ D+${maxDelayDays} 지연 (${overdueTasks.length}건)</span>`
      : isActive ? '<span class="phase-status-badge phase-badge-active">▶ 진행 중</span>'
      : '<span class="phase-status-badge phase-badge-wait">— 대기</span>';

    // Sort tasks: overdue → in_progress → pending → completed
    const sortedTasks = [...allTasks].sort((a, b) => {
      const order = t => {
        if (t.status !== "completed" && t.status !== "rejected") {
          const d = daysUntil(t.dueDate);
          if (d !== null && d < 0) return 0; // overdue
        }
        if (t.status === "in_progress") return 1;
        if (t.status === "pending") return 2;
        return 3; // completed/rejected
      };
      return order(a) - order(b);
    });
    // All tasks shown with scroll (no "더보기" pagination)

    return `
      <div class="phase-card ${borderCls} mb-3" id="phase-card-${idx}" data-phase-idx="${idx}">
        <!-- Header (clickable to toggle) -->
        <div class="phase-card-header" data-phase-toggle="${idx}">
          <div class="phase-card-header-left">
            <span class="phase-card-chevron ${defaultOpen ? 'open' : ''}">▶</span>
            <span class="phase-card-name">${phase.name}</span>
            <span class="phase-card-count">${completed}/${total}</span>
            ${minDate && maxDate ? `<span class="phase-card-dates">🗓 ${formatDateShort(minDate)}~${formatDateShort(maxDate)}</span>` : ""}
            ${statusBadge}
          </div>
          <button class="btn-ghost btn-sm phase-edit-dates-btn" data-phase-edit="${idx}" title="기간 편집" style="font-size:0.6rem;padding:2px 6px;opacity:0.5;" onclick="event.stopPropagation()">✏️</button>
        </div>

        <!-- Body (collapsible) -->
        <div class="phase-card-body ${defaultOpen ? 'open' : ''}">
          <!-- 1. Description -->
          ${desc ? `<div class="phase-section phase-desc-section"><span class="phase-section-icon">📋</span><span class="phase-desc-text">${escapeHtml(desc)}</span></div>` : ""}

          <!-- Inline date editor removed — uses slide-over panel now -->

          <!-- Checklist tasks split by work/gate stage -->
          ${(() => {
            const workTasks = sortedTasks.filter(t => t.stage === phase.workStage);
            const gateTasks = sortedTasks.filter(t => t.stage === phase.gateStage);
            const renderStageSection = (label, icon, tasks) => {
              if (tasks.length === 0) return "";
              const done = tasks.filter(t => t.status === "completed").length;
              const od = tasks.filter(t => t.status !== "completed" && t.status !== "rejected" && daysUntil(t.dueDate) !== null && daysUntil(t.dueDate) < 0).length;
              // Group by dept
              const deptGroups = {};
              tasks.forEach(t => { const dept = t.department || "미지정"; if (!deptGroups[dept]) deptGroups[dept] = []; deptGroups[dept].push(t); });
              return `
                <div class="phase-section phase-tasks-section" style="margin-bottom:0.5rem;">
                  <div class="phase-tasks-header">
                    <span class="phase-section-icon">${icon}</span>
                    <span>${label} (${done}/${tasks.length} 완료${od > 0 ? `, <span style="color:var(--danger-400)">${od}건 지연</span>` : ""})</span>
                  </div>
                  <div class="phase-tasks-list" style="max-height:320px;overflow-y:auto;">
                    ${Object.entries(deptGroups).map(([dept, dTasks]) => {
                      const dDone = dTasks.filter(t => t.status === "completed").length;
                      return `
                        <div class="phase-dept-group" style="margin-bottom:0.25rem;">
                          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0.75rem;background:var(--surface-1);border-bottom:1px solid var(--surface-3);position:sticky;top:0;z-index:1;">
                            <span style="font-size:0.7rem;font-weight:600;color:var(--slate-300);">${escapeHtml(dept)}</span>
                            <span style="font-size:0.6rem;color:var(--slate-400);">${dDone}/${dTasks.length}</span>
                          </div>
                          ${dTasks.map(t => renderTaskRow(t)).join("")}
                        </div>
                      `;
                    }).join("")}
                  </div>
                </div>
              `;
            };
            return renderStageSection("작업 체크리스트", "📝", workTasks) + renderStageSection("승인 체크리스트", "🔒", gateTasks);
          })()}

          <!-- Meeting notes inline -->
          ${notes.length > 0 ? `
          <div class="phase-section" style="margin-top:0.25rem;">
            <div class="phase-tasks-header">
              <span class="phase-section-icon">💬</span>
              <span>회의록 (${notes.length}건)</span>
            </div>
            <div style="max-height:200px;overflow-y:auto;padding:0.25rem 0.75rem;">
              ${notes.slice().reverse().slice(0, 3).map(n => `
                <div style="padding:0.5rem;background:var(--surface-1);border-radius:var(--radius-md);margin-bottom:0.375rem;font-size:0.75rem;">
                  <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                    <span style="font-weight:600;color:var(--slate-200);">${escapeHtml(n.author || "")}</span>
                    <span style="font-size:0.6rem;color:var(--slate-400);">${n.createdAt ? formatDate(n.createdAt) : ""}</span>
                  </div>
                  <div style="color:var(--slate-300);white-space:pre-wrap;">${escapeHtml(n.content || "")}</div>
                  ${n.files && n.files.length > 0 ? `<div style="margin-top:0.25rem;font-size:0.65rem;color:var(--primary-400);">📎 ${n.files.length}개 파일</div>` : ""}
                </div>
              `).join("")}
              ${notes.length > 3 ? `<div style="text-align:center;"><button class="btn-ghost btn-sm" data-gate-notes="${phaseId}" style="font-size:0.65rem;color:var(--primary-400);">전체 보기 (${notes.length}건) →</button></div>` : ""}
            </div>
          </div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function renderTimelineView() {
  const filtered = getFilteredTasks();
  if (filtered.length === 0) return renderEmptyState();

  // Group by week
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const groups = { overdue: [], thisWeek: [], nextWeek: [], later: [], noDue: [] };
  for (const t of filtered) {
    if (!t.dueDate) { groups.noDue.push(t); continue; }
    const due = new Date(t.dueDate);
    const dd = daysUntil(t.dueDate);
    if (t.status !== "completed" && t.status !== "rejected" && dd !== null && dd < 0) {
      groups.overdue.push(t);
    } else if (due < new Date(weekStart.getTime() + 7 * 86400000)) {
      groups.thisWeek.push(t);
    } else if (due < new Date(weekStart.getTime() + 14 * 86400000)) {
      groups.nextWeek.push(t);
    } else {
      groups.later.push(t);
    }
  }

  const groupLabels = [
    { key: "overdue", label: "마감 초과", color: "var(--danger-400)" },
    { key: "thisWeek", label: "이번 주", color: "var(--warning-400)" },
    { key: "nextWeek", label: "다음 주", color: "var(--primary-400)" },
    { key: "later", label: "이후", color: "var(--slate-400)" },
    { key: "noDue", label: "마감일 없음", color: "var(--slate-400)" },
  ];

  return groupLabels.map(g => {
    const tasks = groups[g.key];
    if (tasks.length === 0) return "";
    return `
      <div class="card mb-3">
        <div style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--surface-3);">
          <span style="font-size:0.75rem;font-weight:600;color:${g.color};">${g.label}</span>
          <span style="font-size:0.65rem;color:var(--slate-400);margin-left:0.5rem;">${tasks.length}건</span>
        </div>
        ${tasks.sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0)).map(t => renderTaskRow(t)).join("")}
      </div>
    `;
  }).join("");
}

function _renderDepartmentView() {
  const filtered = getFilteredTasks();
  if (filtered.length === 0) return renderEmptyState();

  const grouped = {};
  for (const t of filtered) {
    const dept = t.department || "미배정";
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(t);
  }

  return Object.entries(grouped).map(([dept, tasks]) => {
    const completed = tasks.filter(t => t.status === "completed").length;
    return `
      <div class="card mb-3">
        <div style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--surface-3);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.8rem;font-weight:600;color:var(--slate-200);">${escapeHtml(dept)}</span>
          <span style="font-size:0.65rem;color:var(--slate-400);">${completed}/${tasks.length}</span>
        </div>
        ${tasks.map(t => renderTaskRow(t)).join("")}
      </div>
    `;
  }).join("");
}

function renderBoardView() {
  const filtered = getFilteredTasks();
  const cols = [
    { key: "pending", label: "대기중", color: "var(--slate-400)" },
    { key: "in_progress", label: "진행중", color: "var(--primary-400)" },
    { key: "completed", label: "완료", color: "var(--success-400)" },
  ];

  // Get unique departments for swimlanes
  const deptSet = new Set(filtered.map(t => t.department).filter(Boolean));
  const deptList = [...deptSet].sort();

  function sortByUrgency(tasks) {
    return tasks.slice().sort((a, b) => {
      const aUrgent = a.importance === "red" ? 0 : a.importance === "yellow" ? 1 : 2;
      const bUrgent = b.importance === "red" ? 0 : b.importance === "yellow" ? 1 : 2;
      return aUrgent - bUrgent;
    });
  }

  // Phase 매핑 (stage name → phase name)
  const stageToPhase = {};
  for (const p of getActivePhaseGroups()) {
    stageToPhase[p.workStage] = p.name;
    stageToPhase[p.gateStage] = p.name;
  }

  function renderKanbanCard(t) {
    const isUrgent = t.importance === "red";
    const phaseName = stageToPhase[t.stage] || "";
    const isGate = getActivePhaseGroups().some(p => p.gateStage === t.stage);
    const dd = daysUntil(t.dueDate);
    const ddText = dd === null ? "" : dd < 0 ? `D+${Math.abs(dd)}` : dd === 0 ? "D-Day" : `D-${dd}`;
    const kanbanDDClass = getDDayClass(dd, t.status);
    const kanbanRowClass = isUrgent ? "task-row-overdue" : t.status === "completed" ? "task-row-completed" : t.status === "in_progress" ? "task-row-inprogress" : "";
    return `
      <div class="card-hover pd-task-row kanban-card ${kanbanRowClass}" data-task-id="${t.id}" data-status="${t.status}" style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--surface-3);cursor:pointer;">
        <div style="display:flex;align-items:center;gap:0.25rem;margin-bottom:0.25rem;flex-wrap:wrap;">
          ${phaseName ? `<span style="font-size:0.55rem;font-weight:600;padding:0.1rem 0.3rem;border-radius:var(--radius-sm);background:var(--primary-500);color:white;opacity:0.85;">${phaseName}</span>` : ""}
          ${isGate ? `<span style="font-size:0.55rem;font-weight:600;padding:0.1rem 0.3rem;border-radius:var(--radius-sm);background:var(--warning-500);color:white;">승인</span>` : ""}
          ${isUrgent ? '<span style="font-size:0.55rem;color:var(--danger-400);font-weight:700;">긴급</span>' : ''}
          ${ddText && t.status !== "completed" ? `<span class="dday-badge dday-badge-sm ${kanbanDDClass}" style="margin-left:auto;">${ddText}</span>` : ""}
        </div>
        <div style="font-size:0.75rem;font-weight:500;color:var(--slate-200);margin-bottom:0.25rem;">${escapeHtml(t.title)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.6rem;color:var(--slate-400);">${escapeHtml(t.assignee || "미배정")}</span>
          <select class="inline-status-select kanban-status-select" data-task-id="${t.id}" style="font-size:0.6rem;padding:0.1rem 0.25rem;border-radius:var(--radius-md);background:var(--surface-3);color:var(--text-secondary);border:1px solid var(--surface-4);cursor:pointer;">
            <option value="pending" ${t.status === "pending" ? "selected" : ""}>대기</option>
            <option value="in_progress" ${t.status === "in_progress" ? "selected" : ""}>진행</option>
            <option value="completed" ${t.status === "completed" ? "selected" : ""}>완료</option>
          </select>
        </div>
      </div>`;
  }

  return `
    <div>
      ${deptList.map(dept => {
        const deptTasks = filtered.filter(t => t.department === dept);
        if (deptTasks.length === 0) return "";
        return `
          <div style="margin-bottom:1rem;">
            <div style="font-size:0.7rem;font-weight:600;color:var(--text-secondary);padding:0.375rem 0;border-bottom:1px solid var(--surface-3);margin-bottom:0.5rem;">${escapeHtml(dept)} (${deptTasks.length})</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">
              ${cols.map(col => {
                const tasks = sortByUrgency(deptTasks.filter(t => t.status === col.key));
                return `
                  <div class="card" style="min-height:80px;">
                    <div style="padding:0.375rem 0.5rem;border-bottom:2px solid ${col.color};display:flex;justify-content:space-between;align-items:center;">
                      <span style="font-size:0.65rem;font-weight:600;color:${col.color};">${col.label}</span>
                      <span style="font-size:0.6rem;color:var(--slate-400);">${tasks.length}</span>
                    </div>
                    <div class="kanban-col" data-kanban-status="${col.key}" data-kanban-dept="${dept}" style="max-height:40vh;overflow-y:auto;min-height:40px;">
                      ${tasks.length === 0 ? '<div style="padding:1rem;text-align:center;font-size:0.6rem;color:var(--slate-400);">—</div>' :
                        tasks.map(t => renderKanbanCard(t)).join("")}
                    </div>
                  </div>`;
              }).join("")}
            </div>
          </div>`;
      }).join("")}
    </div>
  `;
}

function renderMatrixView() {
  const activePhases = getActivePhaseGroups();
  const tasks = getFilteredTasks();
  if (tasks.length === 0) return renderEmptyState();

  // Collect departments present in tasks
  const deptSet = new Set(tasks.map(t => t.department).filter(Boolean));
  const depts = [...deptSet].sort();

  // Build matrix: dept -> phase -> { work, gate }
  const matrix = {};
  for (const dept of depts) {
    matrix[dept] = {};
    for (const phase of activePhases) {
      matrix[dept][phase.name] = {
        work: { total: 0, completed: 0, inProgress: 0, delayed: 0 },
        gate: { status: "none" },
      };
    }
  }

  for (const t of tasks) {
    const dept = t.department;
    if (!matrix[dept]) continue;
    for (const phase of activePhases) {
      if (t.stage === phase.workStage) {
        matrix[dept][phase.name].work.total++;
        if (t.status === "completed") matrix[dept][phase.name].work.completed++;
        else if (t.status === "in_progress") matrix[dept][phase.name].work.inProgress++;
        const d = daysUntil(t.dueDate);
        if (t.status !== "completed" && d !== null && d < 0) matrix[dept][phase.name].work.delayed++;
        break;
      }
      if (t.stage === phase.gateStage) {
        const gateData = matrix[dept][phase.name].gate;
        if (t.status === "completed") {
          if (gateData.status !== "rejected") gateData.status = "approved";
        }
        break;
      }
    }
  }

  function getWorkColor(work) {
    if (work.total === 0) return "var(--slate-400)";
    if (work.delayed > 0) return "var(--danger-400)";
    if (work.completed === work.total) return "var(--success-400)";
    if (work.inProgress > 0) return "var(--primary-400)";
    return "var(--slate-300)";
  }

  function getGateInfo(gate) {
    switch (gate.status) {
      case "approved": return { symbol: "✓", color: "var(--success-400)", bg: "rgba(34,197,94,0.15)" };
      case "rejected": return { symbol: "✗", color: "var(--danger-400)", bg: "rgba(239,68,68,0.15)" };
      case "pending":  return { symbol: "⏳", color: "var(--warning-400)", bg: "rgba(245,158,11,0.15)" };
      default:         return { symbol: "—", color: "var(--slate-400)", bg: "var(--surface-3)" };
    }
  }

  return `
    <div class="card" style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:0.8rem;">
        <thead>
          <tr style="border-bottom:1px solid var(--surface-3);">
            <th style="padding:0.625rem 0.75rem;text-align:left;font-weight:600;color:var(--slate-300);min-width:100px;">부서</th>
            ${activePhases.map(phase => {
              const gs = getPhaseGateStatus(phase.name);
              const gsIcon = gs === "approved" ? "✅" : gs === "rejected" ? "❌" : gs === "pending" ? "⏳" : "";
              const gsLabel = gs === "approved" ? "승인" : gs === "rejected" ? "반려" : gs === "pending" ? "대기" : "";
              return `<th style="padding:0.5rem 0.5rem;text-align:center;font-weight:600;color:var(--slate-300);min-width:80px;">
                <div>${escapeHtml(phase.name)}</div>
                ${gsIcon ? `<div style="font-size:0.55rem;margin-top:2px;font-weight:500;">${gsIcon} ${gsLabel}</div>` : ""}
              </th>`;
            }).join("")}
          </tr>
        </thead>
        <tbody>
          ${depts.map(dept => `
            <tr style="border-bottom:1px solid var(--surface-3);">
              <td style="padding:0.5rem 0.75rem;font-weight:500;color:var(--slate-200);">${escapeHtml(dept)}</td>
              ${activePhases.map(phase => {
                const cell = matrix[dept][phase.name];
                const work = cell.work;
                const gate = cell.gate;
                const _gateInfo = getGateInfo(gate);
                const workColor = getWorkColor(work);
                const hasWork = work.total > 0;
                const hasBg = work.delayed > 0 ? "background:rgba(239,68,68,0.06)" : work.inProgress > 0 ? "background:rgba(6,182,212,0.06)" : (work.completed === work.total && work.total > 0) ? "background:rgba(34,197,94,0.06)" : "";

                return `<td style="${hasBg};padding:0.5rem 0.375rem;text-align:center;" title="${dept} | ${phase.name}: ${work.completed}/${work.total}">
                  <div style="display:flex;align-items:center;justify-content:center">
                    <span style="display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:50%;background:${hasWork ? "rgba(0,0,0,0.15)" : "var(--surface-3)"};border:2px solid ${workColor};font-size:0.6rem;color:${workColor};font-weight:700;font-family:'JetBrains Mono',monospace">${hasWork ? `${work.completed}/${work.total}` : "-"}</span>
                  </div>
                </td>`;
              }).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
      <div style="display:flex;align-items:center;gap:1rem;padding:0.75rem;font-size:0.7rem;color:var(--slate-400);border-top:1px solid var(--surface-3);flex-wrap:wrap;">
        <span style="display:flex;align-items:center;gap:0.25rem"><span style="width:10px;height:10px;border-radius:50%;border:2px solid var(--success-400);display:inline-block"></span> 완료</span>
        <span style="display:flex;align-items:center;gap:0.25rem"><span style="width:10px;height:10px;border-radius:50%;border:2px solid var(--primary-400);display:inline-block"></span> 진행</span>
        <span style="display:flex;align-items:center;gap:0.25rem"><span style="width:10px;height:10px;border-radius:50%;border:2px solid var(--danger-400);display:inline-block"></span> 지연</span>
        <span style="display:flex;align-items:center;gap:0.25rem"><span style="width:10px;height:10px;border-radius:50%;border:2px solid var(--slate-500);display:inline-block"></span> 대기</span>
        <span style="margin-left:0.5rem;border-left:1px solid var(--surface-4);padding-left:0.75rem;">✅ 승인  ⏳ 대기  ❌ 반려</span>
      </div>
    </div>
  `;
}

function _renderListView() {
  const filtered = getFilteredTasks();
  if (filtered.length === 0) return renderEmptyState();

  return `
    <div class="card">
      ${filtered.map(t => renderTaskRow(t)).join("")}
    </div>
  `;
}

function renderEmptyState() {
  const hasAnyTasks = checklistItems.length > 0;
  const applyBtn = !hasAnyTasks ? `
    <button id="apply-template-btn" class="btn btn-primary" style="margin-top:1rem">
      📋 템플릿에서 체크리스트 생성
    </button>
    <p style="margin-top:0.5rem;font-size:0.8rem;color:var(--slate-400)">체크리스트 관리에서 등록한 템플릿 항목을 이 프로젝트에 적용합니다</p>
  ` : "";
  return `
    <div class="card">
      <div class="empty-state" style="padding:3rem;">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <span class="empty-state-text">${hasAnyTasks ? "해당하는 작업이 없습니다" : "체크리스트 항목이 없습니다"}</span>
        <span class="empty-state-subtext">${hasAnyTasks ? "필터 조건을 변경해 보세요" : "템플릿을 적용하여 체크리스트를 생성하세요"}</span>
        ${applyBtn}
      </div>
    </div>
  `;
}

const ACTION_LABELS = {
  complete_task: "작업 완료", approve_task: "승인", reject_task: "반려",
  restart_task: "재작업 시작", create_task: "작업 생성", assign_task: "담당자 지정",
  add_comment: "코멘트 작성", upload_file: "파일 업로드",
  gate_approved: "위원회 승인", gate_rejected: "위원회 반려", gate_reset: "위원회 초기화",
};

function renderRecentActivity() {
  // Prefer real activity logs; fall back to checklistItems
  if (activityLogs.length > 0) {
    return `
      <div class="timeline">
        ${activityLogs.slice(0, 15).map((log, idx) => {
          const label = ACTION_LABELS[log.action] || log.action;
          const actor = log.actorName || log.userName || "";
          const ts = log.timestamp ? timeAgo(log.timestamp) : "";
          return `
            <div class="timeline-item animate-slide-in-up" style="padding-bottom:0.625rem;animation-delay:${idx * 0.08}s">
              <div class="timeline-dot ${log.action?.includes("complete") || log.action?.includes("approved") || log.action?.includes("approve") ? "completed" : log.action?.includes("reject") ? "overdue" : "active"}"></div>
              <div>
                <div style="font-size:0.75rem;font-weight:500;color:var(--slate-200);">${escapeHtml(actor)} 님이 ${escapeHtml(label)}${log.details?.taskTitle ? ` — ${escapeHtml(log.details.taskTitle)}` : ""}${log.details?.phaseName ? ` — ${escapeHtml(log.details.phaseName)}` : ""}</div>
                <div style="font-size:0.6rem;color:var(--slate-400);margin-top:0.125rem;">${ts}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // Fallback: derive from checklist items
  const recentItems = checklistItems
    .filter(t => t.status === "completed" || t.status === "in_progress")
    .sort((a, b) => {
      const dateA = a.completedDate || a.dueDate;
      const dateB = b.completedDate || b.dueDate;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 10);

  if (recentItems.length === 0) {
    return `<div class="empty-state" style="padding:1.5rem">
      <div class="empty-state-icon">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      </div>
      <span class="empty-state-text">최근 활동이 없습니다</span>
      <span class="empty-state-subtext">작업이 완료되면 여기에 활동 내역이 표시됩니다</span>
    </div>`;
  }

  return `
    <div class="timeline">
      ${recentItems.map((item, idx) => {
        const isCompleted = item.status === "completed";
        return `
          <div class="timeline-item animate-slide-in-up" style="padding-bottom:0.625rem;animation-delay:${idx * 0.08}s">
            <div class="timeline-dot ${isCompleted ? "completed" : "active"}"></div>
            <div>
              <div style="font-size:0.75rem;font-weight:500;color:var(--slate-200);">${escapeHtml(item.title)}</div>
              <div style="font-size:0.6rem;color:var(--slate-400);margin-top:0.125rem;">
                ${escapeHtml(item.department)} · ${escapeHtml(item.assignee || "")} · ${isCompleted && item.completedDate ? timeAgo(item.completedDate) : formatDate(item.dueDate)}
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// =============================================================================
// Tab 2: 스케줄 (Gantt-style timeline)
// =============================================================================

function renderScheduleTab() {
  const p = project;
  const projectStart = p.startDate ? new Date(p.startDate) : new Date();
  const projectEnd = p.endDate ? new Date(p.endDate) : new Date(projectStart.getTime() + 365 * 86400000);
  const totalDays = Math.max(1, Math.ceil((projectEnd - projectStart) / 86400000));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = Math.ceil((today - projectStart) / 86400000);
  const todayPct = Math.min(100, Math.max(0, (todayOffset / totalDays) * 100));
  const elapsed = Math.min(totalDays, Math.max(0, todayOffset));
  const remaining = Math.max(0, totalDays - elapsed);

  const phases = getActivePhaseGroups();

  // 전체 진행률: 작업 완료 기준 (시간 기준 X)
  const totalTasks = checklistItems.length;
  const completedTasks = checklistItems.filter(t => t.status === "completed").length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const timePct = Math.min(100, Math.round((elapsed / totalDays) * 100));

  // Calculate actual date range per phase from task dueDates
  function getPhaseActualDates(phase) {
    const phaseTasks = checklistItems.filter(t => t.stage === phase.workStage || t.stage === phase.gateStage);
    let earliest = null, latest = null;
    for (const t of phaseTasks) {
      if (!t.dueDate) continue;
      const d = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
      if (!earliest || d < earliest) earliest = d;
      if (!latest || d > latest) latest = d;
    }
    return { start: earliest, end: latest, count: phaseTasks.length };
  }

  // Generate month labels
  const months = [];
  const cursor = new Date(projectStart);
  cursor.setDate(1);
  if (cursor < projectStart) cursor.setMonth(cursor.getMonth() + 1);
  while (cursor <= projectEnd) {
    const off = Math.ceil((cursor - projectStart) / 86400000);
    const pct = (off / totalDays) * 100;
    if (pct >= 0 && pct <= 100) {
      months.push({ label: `${cursor.getFullYear()}.${String(cursor.getMonth() + 1).padStart(2, "0")}`, pct });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const ROW_H = 40;
  const LABEL_W = 100;

  return `
    <!-- Schedule Overview -->
    <div class="card p-5">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.25rem;flex-wrap:wrap;gap:0.75rem;">
        <div>
          <h3 style="font-size:1rem;font-weight:700;color:var(--slate-100);margin:0 0 0.25rem;">프로젝트 일정 현황</h3>
          <p style="font-size:0.75rem;color:var(--slate-400);margin:0;">각 Phase의 실제 작업 일정과 진행 상태를 보여줍니다. Phase를 클릭하면 기간을 수정할 수 있습니다.</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.7rem;color:var(--slate-400);">${formatDate(projectStart)} ~ ${formatDate(projectEnd)}</div>
          <div style="font-size:0.8rem;font-weight:600;color:${remaining <= 0 && progressPct < 100 ? "var(--danger-400)" : "var(--primary-400)"};margin-top:0.25rem;">${elapsed}일 경과 / ${remaining > 0 ? remaining + "일 남음" : "기한 초과"}</div>
        </div>
      </div>

      <!-- Overall progress: task-based -->
      <div style="margin-bottom:1.25rem;">
        <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--slate-400);margin-bottom:0.25rem;">
          <span>작업 진행률 (${completedTasks}/${totalTasks})</span>
          <span>${progressPct}%</span>
        </div>
        <div style="height:6px;background:var(--surface-3);border-radius:var(--radius-full);overflow:hidden;">
          <div style="height:100%;width:${progressPct}%;background:${progressPct === 100 ? "var(--success-500)" : "var(--primary-500)"};border-radius:var(--radius-full);transition:width 0.3s;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--slate-500);margin-top:0.25rem;">
          <span>일정 소진 ${timePct}%</span>
          ${timePct > progressPct + 10 ? `<span style="color:var(--danger-400);">일정 대비 작업 지연</span>` : ""}
        </div>
      </div>

      <!-- Timeline header -->
      <div style="position:relative;margin-left:${LABEL_W}px;height:18px;margin-bottom:2px;border-bottom:1px solid var(--surface-3);">
        ${months.map(m => `<span style="position:absolute;left:${m.pct}%;transform:translateX(-50%);font-size:0.55rem;color:var(--slate-400);white-space:nowrap;top:0;">${m.label}</span>`).join("")}
      </div>

      <!-- Gantt area -->
      <div style="position:relative;min-height:${phases.length * (ROW_H + 6)}px;">
        <!-- Month grid lines -->
        ${months.map(m => `<div style="position:absolute;left:calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${m.pct / 100});top:0;bottom:0;width:1px;background:var(--surface-3);opacity:0.4;pointer-events:none;"></div>`).join("")}

        <!-- Today marker -->
        ${todayPct > 0 && todayPct < 100 ? `
          <div style="position:absolute;left:calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${todayPct / 100});top:-20px;bottom:0;width:2px;background:var(--danger-400);z-index:3;pointer-events:none;">
            <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);background:var(--danger-400);color:white;font-size:0.5rem;font-weight:700;padding:1px 5px;border-radius:6px;white-space:nowrap;">오늘</div>
          </div>
        ` : ""}

        <!-- Phase rows -->
        ${phases.map((phase, idx) => {
          const progress = getPhaseWorkProgress(phase.name);
          const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
          const dates = getPhaseActualDates(phase);
          const gateStatus = getPhaseGateStatus(phase.name);
          const top = idx * (ROW_H + 6);

          // Calculate bar position from actual task dates
          let startPct = (idx / 6) * 100;
          let widthPct = (1 / 6) * 100;
          if (dates.start && dates.end) {
            const sOff = Math.max(0, Math.ceil((dates.start - projectStart) / 86400000));
            const eOff = Math.ceil((dates.end - projectStart) / 86400000);
            startPct = (sOff / totalDays) * 100;
            widthPct = Math.max(2, ((eOff - sOff) / totalDays) * 100);
          }

          const barColor = pct === 100 ? "var(--success-500)" :
                           progress.overdue > 0 ? "var(--danger-500)" :
                           pct > 0 ? "var(--primary-500)" : "var(--surface-4)";

          const gateIcon = gateStatus === "approved" ? "✅" : gateStatus === "rejected" ? "❌" : gateStatus === "pending" ? "⏳" : "";
          const dateLabel = dates.start && dates.end ? `${formatDateShort(dates.start)}~${formatDateShort(dates.end)}` : "미설정";

          return `
            <div class="schedule-phase-row" data-schedule-phase="${phase.name}" style="position:absolute;top:${top}px;left:0;right:0;height:${ROW_H}px;display:flex;align-items:center;cursor:pointer;border-radius:var(--radius-md);transition:background 0.15s;" onmouseenter="this.style.background='var(--surface-2)'" onmouseleave="this.style.background='transparent'">
              <!-- Label -->
              <div style="width:${LABEL_W}px;flex-shrink:0;padding-right:0.5rem;">
                <div style="font-size:0.75rem;font-weight:600;color:var(--slate-200);display:flex;align-items:center;gap:4px;">
                  ${gateIcon} ${phase.name}
                </div>
                <div style="font-size:0.55rem;color:var(--slate-400);">${dateLabel}</div>
              </div>
              <!-- Track -->
              <div style="flex:1;position:relative;height:${ROW_H - 8}px;">
                <div style="position:absolute;left:${startPct}%;width:${widthPct}%;height:100%;background:var(--surface-3);border-radius:var(--radius-sm);opacity:0.5;"></div>
                <div style="position:absolute;left:${startPct}%;width:${widthPct * pct / 100}%;height:100%;background:${barColor};border-radius:var(--radius-sm);opacity:0.85;transition:width 0.3s;"></div>
                <div style="position:absolute;left:${startPct + 1}%;top:50%;transform:translateY(-50%);font-size:0.6rem;color:white;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,0.6);z-index:1;white-space:nowrap;">
                  ${pct}%${progress.overdue > 0 ? ` (${progress.overdue}건 지연)` : ""}
                </div>
                <div style="position:absolute;left:${startPct + widthPct + 0.5}%;top:50%;transform:translateY(-50%);font-size:0.6rem;color:var(--slate-400);white-space:nowrap;z-index:1;">
                  ${progress.completed}/${progress.total}
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <!-- Legend -->
      <div style="display:flex;gap:1rem;margin-top:0.75rem;font-size:0.6rem;color:var(--slate-400);flex-wrap:wrap;padding-top:0.5rem;border-top:1px solid var(--surface-3);">
        <span style="display:flex;align-items:center;gap:0.25rem;"><span style="width:10px;height:10px;border-radius:2px;background:var(--success-500);"></span> 완료</span>
        <span style="display:flex;align-items:center;gap:0.25rem;"><span style="width:10px;height:10px;border-radius:2px;background:var(--primary-500);"></span> 진행중</span>
        <span style="display:flex;align-items:center;gap:0.25rem;"><span style="width:10px;height:10px;border-radius:2px;background:var(--danger-500);"></span> 지연</span>
        <span style="display:flex;align-items:center;gap:0.25rem;"><span style="width:4px;height:14px;background:var(--danger-400);border-radius:1px;"></span> 오늘</span>
        <span>💡 Phase 클릭 → 기간 수정</span>
      </div>
    </div>

    <!-- Phase Detail Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0.75rem;margin-top:1rem;">
      ${phases.map(phase => {
        const prog = getPhaseWorkProgress(phase.name);
        const gs = getPhaseGateStatus(phase.name);
        const gsLabel = { approved: "✅ 승인", rejected: "❌ 반려", pending: "⏳ 대기", not_reached: "— 미도달", none: "-" }[gs];
        const gsColor = { approved: "var(--success-400)", rejected: "var(--danger-400)", pending: "var(--warning-400)", not_reached: "var(--slate-400)", none: "var(--slate-400)" }[gs];
        const dates = getPhaseActualDates(phase);
        const pct = prog.total > 0 ? Math.round((prog.completed / prog.total) * 100) : 0;
        const barColor = pct === 100 ? "var(--success-500)" : prog.overdue > 0 ? "var(--danger-500)" : "var(--primary-500)";

        return `
          <div class="card p-4 schedule-phase-row" data-schedule-phase="${phase.name}" style="cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
              <span style="font-size:0.85rem;font-weight:700;color:var(--slate-100);">${phase.name}</span>
              <span style="font-size:0.7rem;color:${gsColor};font-weight:500;">${gsLabel}</span>
            </div>
            <!-- Progress bar -->
            <div style="height:5px;background:var(--surface-3);border-radius:var(--radius-full);overflow:hidden;margin-bottom:0.5rem;">
              <div style="height:100%;width:${pct}%;background:${barColor};border-radius:var(--radius-full);"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.25rem;font-size:0.7rem;">
              <div><span style="color:var(--slate-400);">기간</span> <span style="color:var(--slate-200);font-weight:500;">${dates.start ? formatDate(dates.start) : "-"} ~ ${dates.end ? formatDate(dates.end) : "-"}</span></div>
              <div style="text-align:right;"><span style="color:var(--slate-400);">진행</span> <span style="color:var(--slate-200);font-weight:600;">${pct}%</span> <span style="color:var(--slate-400);">(${prog.completed}/${prog.total})</span></div>
              <div><span style="color:var(--slate-400);">진행중</span> <span style="color:var(--primary-400);">${prog.inProgress}</span></div>
              <div style="text-align:right;">${prog.overdue > 0 ? `<span style="color:var(--danger-400);font-weight:600;">지연 ${prog.overdue}건</span>` : `<span style="color:var(--slate-400);">지연 없음</span>`}</div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// =============================================================================
function renderCriticalPathHints() {
  // Find incomplete tasks that block the most other tasks
  const blockingMap = new Map(); // taskId → Set of dependent taskIds
  for (const t of checklistItems) {
    const deps = t.dependencies || [];
    for (const depId of deps) {
      if (!blockingMap.has(depId)) blockingMap.set(depId, new Set());
      blockingMap.get(depId).add(t.id);
    }
  }

  // Only incomplete tasks that actually block something
  const criticalTasks = [];
  for (const [taskId, dependents] of blockingMap.entries()) {
    const task = checklistItems.find(t => t.id === taskId);
    if (!task || task.status === "completed") continue;
    criticalTasks.push({ task, waitingCount: dependents.size });
  }

  criticalTasks.sort((a, b) => b.waitingCount - a.waitingCount);
  const top10 = criticalTasks.slice(0, 10);

  if (top10.length === 0) return "";

  return `
    <div class="card p-5 mb-4">
      <h3 style="font-size:0.9rem;font-weight:600;color:var(--warning-400);margin-bottom:0.5rem;">핵심 경로 힌트</h3>
      <p style="font-size:0.65rem;color:var(--slate-400);margin-bottom:0.75rem;">다른 작업을 가장 많이 막고 있는 미완료 작업</p>
      <div>
        ${top10.map((item, idx) => `
          <div class="critical-path-item card-hover pd-task-row" data-task-id="${item.task.id}" style="cursor:pointer;">
            <span class="critical-path-rank">${idx + 1}</span>
            <div class="critical-path-info">
              <div class="critical-path-title">${escapeHtml(item.task.title)}</div>
              <div class="critical-path-meta">${escapeHtml(item.task.department || "미배정")} · ${escapeHtml(item.task.assignee || "미배분")}</div>
            </div>
            <span class="critical-path-count">${item.waitingCount}건 대기 중</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// Tab 3: 병목 (Bottleneck analysis)
// =============================================================================

function renderBottleneckTab() {
  // Phase × Department heatmap data
  const heatmapData = {};
  for (const phase of getActivePhaseGroups()) {
    heatmapData[phase.name] = {};
    for (const dept of departments) {
      const tasks = checklistItems.filter(t =>
        (t.stage === phase.workStage || t.stage === phase.gateStage) && t.department === dept
      );
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === "completed").length;
      const overdue = tasks.filter(t => {
        if (t.status === "completed" || t.status === "rejected") return false;
        const d = daysUntil(t.dueDate);
        return d !== null && d < 0;
      }).length;
      heatmapData[phase.name][dept] = { total, completed, overdue, pct: total > 0 ? Math.round(completed / total * 100) : -1 };
    }
  }

  // Overdue tasks by department
  const overdueTasks = checklistItems.filter(t => {
    if (t.status === "completed" || t.status === "rejected") return false;
    const d = daysUntil(t.dueDate);
    return d !== null && d < 0;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const overdueByDept = {};
  for (const t of overdueTasks) {
    const dept = t.department || "미배정";
    if (!overdueByDept[dept]) overdueByDept[dept] = [];
    overdueByDept[dept].push(t);
  }

  return `
    <!-- Heatmap -->
    <div class="card p-5 mb-4">
      <h3 style="font-size:0.9rem;font-weight:600;color:var(--slate-200);margin-bottom:0.75rem;">Phase × 부서 히트맵</h3>
      <p style="font-size:0.65rem;color:var(--slate-400);margin-bottom:0.75rem;">빨간색 = 지연 작업 있음 · 숫자 = 완료율% · 빈 칸 = 해당 작업 없음</p>
      <div class="table-responsive">
        <table class="data-table" style="font-size:0.7rem;">
          <thead>
            <tr>
              <th style="min-width:80px;">부서</th>
              ${getActivePhaseGroups().map(p => `<th style="min-width:60px;text-align:center;">${p.name}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${departments.map(dept => {
              const hasAnyTasks = getActivePhaseGroups().some(p => heatmapData[p.name][dept].total > 0);
              if (!hasAnyTasks) return "";
              return `
                <tr>
                  <td style="font-weight:500;color:var(--slate-300);white-space:nowrap;">${escapeHtml(dept)}</td>
                  ${getActivePhaseGroups().map(p => {
                    const cell = heatmapData[p.name][dept];
                    if (cell.total === 0) return `<td style="text-align:center;color:var(--slate-400);">—</td>`;
                    const bg = cell.overdue > 0 ? "rgba(239,68,68,0.2)" :
                               cell.pct === 100 ? "rgba(34,197,94,0.15)" :
                               cell.pct > 50 ? "rgba(6,182,212,0.1)" : "transparent";
                    const color = cell.overdue > 0 ? "var(--danger-400)" :
                                  cell.pct === 100 ? "var(--success-400)" :
                                  "var(--slate-300)";
                    return `<td style="text-align:center;background:${bg};color:${color};font-weight:${cell.overdue > 0 ? "700" : "500"};">
                      ${cell.pct}%${cell.overdue > 0 ? `<br><span style="font-size:0.55rem;color:var(--danger-400);">${cell.overdue}건 지연</span>` : ""}
                    </td>`;
                  }).join("")}
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pipeline Diagram -->
    <div class="card p-5 mb-4">
      <h3 style="font-size:0.9rem;font-weight:600;color:var(--slate-200);margin-bottom:0.75rem;">Phase 파이프라인</h3>
      <div style="display:flex;gap:0.375rem;align-items:flex-end;height:120px;">
        ${getActivePhaseGroups().map(phase => {
          const prog = getPhaseWorkProgress(phase.name);
          const pct = prog.total > 0 ? Math.round(prog.completed / prog.total * 100) : 0;
          const barHeight = Math.max(20, (prog.total / Math.max(1, ...getActivePhaseGroups().map(p => getPhaseWorkProgress(p.name).total))) * 100);
          const fillColor = prog.overdue > 0 ? "var(--danger-400)" : pct === 100 ? "var(--success-400)" : "var(--primary-400)";
          return `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:0.25rem;">
              <span style="font-size:0.6rem;color:var(--slate-400);">${pct}%</span>
              <div style="width:100%;height:${barHeight}px;background:var(--surface-3);border-radius:var(--radius-sm);position:relative;overflow:hidden;">
                <div style="position:absolute;bottom:0;width:100%;height:${pct}%;background:${fillColor};border-radius:var(--radius-sm);transition:height 0.3s;"></div>
              </div>
              <span style="font-size:0.6rem;font-weight:500;color:var(--slate-300);text-align:center;">${phase.name}</span>
              <span style="font-size:0.55rem;color:var(--slate-400);">${prog.total}건</span>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <!-- Critical Path Hints -->
    ${renderCriticalPathHints()}

    <!-- Delay Reason Detail -->
    <div class="card p-5">
      <h3 style="font-size:0.9rem;font-weight:600;color:${overdueTasks.length > 0 ? "var(--danger-400)" : "var(--slate-200)"};margin-bottom:0.75rem;">
        ${overdueTasks.length > 0 ? `현재 지연 원인 (${overdueTasks.length}건)` : "지연 없음 ✓"}
      </h3>

      ${overdueTasks.length === 0 ? `
        <div style="padding:2rem;text-align:center;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">🎉</div>
          <div style="font-size:0.8rem;color:var(--success-400);font-weight:500;">모든 작업이 정상적으로 진행 중입니다</div>
        </div>
      ` : `
        ${Object.entries(overdueByDept).map(([dept, tasks]) => `
          <div style="margin-bottom:1rem;">
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
              <span style="font-size:0.8rem;font-weight:600;color:var(--slate-200);">${escapeHtml(dept)}</span>
              <span style="font-size:0.65rem;padding:0.1rem 0.4rem;background:rgba(239,68,68,0.15);border-radius:var(--radius-sm);color:var(--danger-400);font-weight:600;">${tasks.length}건</span>
            </div>
            ${tasks.map(t => {
              const dd = Math.abs(daysUntil(t.dueDate));
              return `
                <div class="card-hover pd-task-row task-row-overdue" data-task-id="${t.id}" style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--surface-3);cursor:pointer;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                      <div style="font-size:0.75rem;font-weight:500;color:var(--slate-200);">${escapeHtml(t.title)}</div>
                      <div style="font-size:0.6rem;color:var(--slate-400);margin-top:0.125rem;">
                        ${escapeHtml(t.assignee || "미배정")} · ${formatStageName(t.stage)} · 마감 ${formatDate(t.dueDate)}
                      </div>
                    </div>
                    <span class="dday-badge dday-badge-sm dday-overdue" style="flex-shrink:0;">D+${dd}</span>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `).join("")}
      `}
    </div>
  `;
}

// =============================================================================
// Event binding
// =============================================================================

function bindEvents() {
  // Tab switching
  app.querySelectorAll("[data-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      checklistFilter = "";
      render();
    });
  });

  // Phase pipeline click → scroll to phase card & expand
  app.querySelectorAll("[data-phase-panel]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.phasePanel);
      const card = document.getElementById(`phase-card-${idx}`);
      if (card) {
        // Expand if collapsed
        const body = card.querySelector(".phase-card-body");
        const chevron = card.querySelector(".phase-card-chevron");
        if (body && !body.classList.contains("open")) {
          body.classList.add("open");
          if (chevron) chevron.classList.add("open");
        }
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // Phase card toggle (접기/펼치기)
  app.querySelectorAll("[data-phase-toggle]").forEach(hdr => {
    hdr.addEventListener("click", () => {
      const idx = hdr.dataset.phaseToggle;
      const card = document.getElementById(`phase-card-${idx}`);
      if (!card) return;
      const body = card.querySelector(".phase-card-body");
      const chevron = card.querySelector(".phase-card-chevron");
      if (body) body.classList.toggle("open");
      if (chevron) chevron.classList.toggle("open");
    });
  });

  // Phase date edit → slide-over panel (also from schedule tab)
  app.querySelectorAll("[data-phase-edit]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.phaseEdit);
      openPhaseScheduleSlideOver(idx);
    });
  });

  // Schedule tab phase rows → slide-over
  app.querySelectorAll("[data-schedule-phase]").forEach(el => {
    el.addEventListener("click", () => {
      const phaseName = el.dataset.schedulePhase;
      const phases = getActivePhaseGroups();
      const idx = phases.findIndex(p => p.name === phaseName);
      if (idx >= 0) openPhaseScheduleSlideOver(idx);
    });
  });

  // Meeting note toggle (+ 등록 버튼)
  app.querySelectorAll("[data-note-toggle]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = btn.dataset.noteToggle;
      const form = app.querySelector(`[data-note-form="${idx}"]`);
      if (form) form.style.display = form.style.display === "none" ? "block" : "none";
    });
  });

  // Meeting note submit
  app.querySelectorAll("[data-note-submit]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.noteSubmit);
      const textarea = app.querySelector(`[data-note-input="${idx}"]`);
      const content = textarea?.value?.trim();
      if (!content) { showToast("warning", "내용을 입력해주세요"); return; }
      const pg = getActivePhaseGroups()[idx];
      if (!pg) return;
      const phaseId = `phase${idx}`;
      try {
        btn.disabled = true;
        btn.textContent = "등록 중...";
        await addGateMeetingNote(projectId, phaseId, pg.name, user?.name || "익명", content);
        showToast("success", "회의록이 등록되었습니다");
      } catch (err) {
        showToast("error", "등록 실패: " + err.message);
        btn.disabled = false;
        btn.textContent = "등록";
      }
    });
  });

  // Gate panel open (회의록 버튼)
  app.querySelectorAll("[data-gate-panel]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.gatePanel);
      const phases = getActivePhaseGroups();
      const phase = phases[idx];
      if (phase) openPhasePanel(phase, idx);
    });
  });

  // Inline gate buttons removed — approval is now only in slide-over panel

  // Notes "더 보기" toggle
  app.querySelectorAll("[data-notes-expand]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = btn.dataset.notesExpand;
      const hidden = app.querySelector(`[data-notes-more="${idx}"]`);
      if (hidden) {
        const showing = hidden.style.display !== "none";
        hidden.style.display = showing ? "none" : "block";
        btn.textContent = showing ? btn.textContent.replace("▲", "▼") : btn.textContent.replace("▼", "▲");
      }
    });
  });

  // Tasks "더 보기" toggle
  app.querySelectorAll("[data-tasks-expand]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = btn.dataset.tasksExpand;
      const hidden = app.querySelector(`[data-tasks-more="${idx}"]`);
      if (hidden) {
        const showing = hidden.style.display !== "none";
        hidden.style.display = showing ? "none" : "block";
        btn.textContent = showing ? btn.textContent.replace("▲", "▼") : btn.textContent.replace("▼", "▲");
      }
    });
  });

  // View switching
  app.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      checklistView = btn.dataset.view;
      render();
    });
  });

  // Quick Add
  const quickAddBtn = app.querySelector("#quick-add-btn");
  if (quickAddBtn) quickAddBtn.addEventListener("click", handleQuickAdd);
  const quickAddTitle = app.querySelector("#quick-add-title");
  if (quickAddTitle) quickAddTitle.addEventListener("keydown", (e) => { if (e.key === "Enter") handleQuickAdd(); });
  const openModalBtn = app.querySelector("#open-add-modal-btn");
  if (openModalBtn) openModalBtn.addEventListener("click", showAddTaskModal);

  // Apply template button
  const applyTemplateBtn = app.querySelector("#apply-template-btn");
  if (applyTemplateBtn) applyTemplateBtn.addEventListener("click", handleApplyTemplate);

  // Apply launch checklist button
  const applyLaunchBtn = app.querySelector("#apply-launch-btn");
  if (applyLaunchBtn) applyLaunchBtn.addEventListener("click", handleApplyLaunch);

  // Clear filter
  const clearBtn = app.querySelector("#clear-filter-btn");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    checklistFilter = "";
    selectedStage = "";
    selectedDepartment = "";
    render();
  });

  // Filters
  const stageFilter = app.querySelector("#filter-stage");
  if (stageFilter) stageFilter.addEventListener("change", (e) => { selectedStage = e.target.value; checklistFilter = ""; render(); });
  const deptFilter = app.querySelector("#filter-dept");
  if (deptFilter) deptFilter.addEventListener("change", (e) => { selectedDepartment = e.target.value; checklistFilter = ""; render(); });

  // Inline status change (UXA-06) — event delegation for reliability
  app.querySelectorAll("[data-status-item]").forEach(sel => {
    sel.addEventListener("change", async (e) => {
      e.stopPropagation();
      const itemId = sel.dataset.statusItem;
      const newStatus = sel.value;
      const prevStatus = sel.dataset.current;
      // "delayed" is display-only — maps to "in_progress" in DB
      const actualStatus = newStatus === "delayed" ? "in_progress" : newStatus;
      if (actualStatus === prevStatus && newStatus !== "delayed") return; // no change
      try {
        sel.disabled = true;
        // Soft-warning for dependency blocking
        if (actualStatus === "completed") {
          const task = checklistItems.find(t => t.id === itemId);
          if (task) {
            const depStatus = getBlockingStatus(task, checklistItems);
            if (depStatus.blocked) {
              const proceed = await confirmModal(`선행 작업 ${depStatus.blockers.length}건이 미완료입니다. 그래도 완료 처리하시겠습니까?`);
              if (!proceed) { sel.value = prevStatus; sel.disabled = false; return; }
            }
          }
        }
        if (actualStatus === "completed") {
          // Use completeTask for proper stats recalculation
          const { completeTask } = await import("../firestore-service.js");
          await completeTask(itemId);
        } else {
          await updateChecklistItemStatus(itemId, actualStatus);
        }
        sel.dataset.current = actualStatus;
        const statusLabels = { pending: "대기", in_progress: "진행", delayed: "지연", completed: "완료" };
        showToast("success", `상태가 '${statusLabels[newStatus] || newStatus}'(으)로 변경되었습니다.`);
      } catch (err) {
        console.error("상태 변경 실패:", err);
        showToast("error", "상태 변경에 실패했습니다: " + (err.message || "알 수 없는 오류"));
        sel.value = prevStatus; // revert
      } finally {
        sel.disabled = false;
      }
    });
  });

  // Kanban inline status change
  app.querySelectorAll(".kanban-status-select").forEach(sel => {
    sel.addEventListener("change", async (e) => {
      e.stopPropagation();
      const itemId = sel.dataset.taskId;
      const newStatus = sel.value;
      try {
        await updateChecklistItemStatus(itemId, newStatus);
        showToast("success", `상태가 변경되었습니다.`);
      } catch {
        showToast("error", "상태 변경에 실패했습니다.");
      }
    });
    sel.addEventListener("click", (e) => e.stopPropagation());
  });

  // Initialize SortableJS on kanban columns
  if (checklistView === "board") {
    app.querySelectorAll(".kanban-col").forEach(col => {
      initSortable(col, {
        group: "kanban",
        onEnd: async (evt) => {
          const taskId = evt.item?.dataset?.taskId;
          const newStatus = evt.to?.dataset?.kanbanStatus;
          if (taskId && newStatus) {
            try {
              await updateChecklistItemStatus(taskId, newStatus);
              showToast("success", "상태가 변경되었습니다.");
            } catch {
              showToast("error", "상태 변경에 실패했습니다.");
              render();
            }
          }
        },
      });
    });
  }

  // Task click → peek panel (UXA-05) on middle area, full navigate on chevron
  app.querySelectorAll("[data-task-id]").forEach(el => {
    el.addEventListener("click", (e) => {
      // Don't navigate if clicking checkbox or status select
      if (e.target.closest(".task-checkbox") || e.target.closest(".inline-status-select")) return;
      const taskId = el.dataset.taskId;
      const task = checklistItems.find(t => t.id === taskId);
      if (task) {
        openTaskPeek(task);
      }
    });
  });

  // Delete manual task
  app.querySelectorAll("[data-delete-task]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.deleteTask;
      if (!await confirmModal("이 작업을 삭제하시겠습니까?")) return;
      try {
        await deleteChecklistItem(taskId);
        showToast("success", "작업이 삭제되었습니다.");
      } catch (err) { showToast("error", "삭제 실패: " + err.message); }
    });
  });

  // Export CSV
  const csvBtn = app.querySelector("#export-csv-btn");
  if (csvBtn) {
    csvBtn.addEventListener("click", () => {
      const headers = ["제목", "단계", "부서", "담당자", "상태", "마감일"];
      const data = checklistItems.map(t => [
        t.title, t.stage, t.department, t.assignee || "", getStatusLabel(t.status),
        t.dueDate ? new Date(t.dueDate).toLocaleString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }) : "-"
      ]);
      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}${String(now.getMinutes()).padStart(2,"0")}`;
      exportToCSV(data, headers, `${project.name}_체크리스트_${ts}.csv`);
    });
  }

  // Export PDF
  const pdfBtn = app.querySelector("#export-pdf-btn");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      const completed = checklistItems.filter(t => t.status === "completed").length;
      const inProgress = checklistItems.filter(t => t.status === "in_progress").length;
      const pending = checklistItems.filter(t => t.status === "pending").length;
      const overdue = checklistItems.filter(t => {
        if (t.status === "completed" || t.status === "rejected") return false;
        const d = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
        return d < new Date();
      }).length;
      const phaseRows = getActivePhaseGroups().map(pg => {
        const pTasks = checklistItems.filter(t => t.stage === pg.workStage || t.stage === pg.gateStage);
        const pDone = pTasks.filter(t => t.status === "completed").length;
        return `<tr><td>${escapeHtml(pg.name)}</td><td>${pDone}</td><td>${pTasks.length}</td><td>${pTasks.length > 0 ? Math.round(pDone / pTasks.length * 100) : 0}%</td></tr>`;
      }).join("");

      const deptMap = {};
      checklistItems.forEach(t => {
        const dept = t.department || "미정";
        if (!deptMap[dept]) deptMap[dept] = { total: 0, done: 0, overdue: 0 };
        deptMap[dept].total++;
        if (t.status === "completed") deptMap[dept].done++;
        const d = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate);
        if (t.status !== "completed" && t.status !== "rejected" && d < new Date()) deptMap[dept].overdue++;
      });
      const deptRows = Object.entries(deptMap).map(([dept, info]) =>
        `<tr><td>${escapeHtml(dept)}</td><td>${info.done}</td><td>${info.total}</td><td>${info.overdue > 0 ? `<span class="badge badge-danger">${info.overdue}건 지연</span>` : "정상"}</td></tr>`
      ).join("");

      const overdueList = checklistItems
        .filter(t => { if (t.status === "completed" || t.status === "rejected") return false; const d = t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate); return d < new Date(); })
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
        .map(t => `<tr><td>${escapeHtml(t.title)}</td><td>${escapeHtml(t.department || "-")}</td><td>${escapeHtml(t.assignee || "-")}</td><td>${formatDate(t.dueDate)}</td><td>${escapeHtml(formatStageName(t.stage))}</td></tr>`)
        .join("");

      const content = `
        <p style="margin-bottom:4px"><strong>프로젝트:</strong> ${escapeHtml(project.name)}</p>
        <!-- PM 제거됨 -->
        <p style="margin-bottom:4px"><strong>기간:</strong> ${formatDate(project.startDate)} ~ ${formatDate(project.endDate)}</p>
        <p style="margin-bottom:16px"><strong>전체 진행:</strong> 완료 ${completed} / 전체 ${checklistItems.length}</p>
        <h2 style="font-size:16px;margin:24px 0 8px;">요약</h2>
        <table><tr><th>대기</th><th>진행중</th><th>완료</th><th>마감초과</th></tr>
        <tr><td>${pending}</td><td>${inProgress}</td><td>${completed}</td><td>${overdue > 0 ? `<span class="badge badge-danger">${overdue}</span>` : "0"}</td></tr></table>
        <h2 style="font-size:16px;margin:24px 0 8px;">단계별 현황</h2>
        <table><tr><th>단계</th><th>완료</th><th>전체</th><th>진행률</th></tr>${phaseRows}</table>
        <h2 style="font-size:16px;margin:24px 0 8px;">부서별 현황</h2>
        <table><tr><th>부서</th><th>완료</th><th>전체</th><th>상태</th></tr>${deptRows}</table>
        ${overdue > 0 ? `<h2 style="font-size:16px;margin:24px 0 8px;color:#dc2626;">마감 초과 (${overdue}건)</h2>
        <table><tr><th>작업</th><th>부서</th><th>담당자</th><th>마감일</th><th>단계</th></tr>${overdueList}</table>` : ""}
      `;
      exportToPDF(`${project.name} 프로젝트 보고서`, content);
    });
  }
}

  // Print button
  // Print button removed

// ─── Phase Schedule Slide-Over ───────────────────────────────────────────────

function openPhaseScheduleSlideOver(phaseIdx) {
  const phases = getActivePhaseGroups();
  const phase = phases[phaseIdx];
  if (!phase) return;

  // 항상 실제 task dueDate 기준으로 날짜 표시
  const allTaskDates = phases.map(p => getPhaseTaskDates(p));
  const taskDates = allTaskDates[phaseIdx];
  const savedSchedules = project.phaseSchedules || {};

  const startVal = taskDates.start ? taskDates.start.toISOString().slice(0, 10) : "";
  const endVal = taskDates.end ? taskDates.end.toISOString().slice(0, 10) : "";

  // 전체 Phase 요약 (실제 task 날짜 기준)
  const allPhaseSummary = phases.map((p, i) => {
    const td = allTaskDates[i];
    const isCurrent = i === phaseIdx;
    const saved = savedSchedules[`phase${i}`];
    const hasPlanned = saved && saved.plannedStart && saved.plannedEnd;
    // 지연 표시: 계획 대비 실제가 늦은 경우
    let delayBadge = "";
    if (hasPlanned && td.end) {
      const plannedEnd = new Date(saved.plannedEnd);
      const delay = Math.round((td.end - plannedEnd) / 86400000);
      if (delay > 0) delayBadge = `<span style="font-size:0.6rem;color:var(--danger-400);font-weight:600;">+${delay}일</span>`;
    }
    return `
      <div style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0.5rem;border-radius:var(--radius-md);${isCurrent ? "background:var(--surface-2);border:1px solid var(--primary-400);" : "background:var(--surface-1);"}">
        <span style="font-size:0.75rem;font-weight:${isCurrent ? "700" : "500"};color:${isCurrent ? "var(--primary-400)" : "var(--slate-300)"};min-width:60px;">${p.name}</span>
        <span style="font-size:0.7rem;color:var(--slate-400);flex:1;">${td.start ? formatDate(td.start) : "-"} ~ ${td.end ? formatDate(td.end) : "-"}</span>
        ${delayBadge}
        <span style="font-size:0.65rem;color:var(--slate-400);">${td.count}건</span>
      </div>
    `;
  }).join("");

  // 계획 일정 표시 (이미 세팅된 경우)
  const saved = savedSchedules[`phase${phaseIdx}`];
  const hasPlanned = saved && saved.plannedStart && saved.plannedEnd;
  let plannedInfo = "";
  if (hasPlanned) {
    const pStart = new Date(saved.plannedStart);
    const pEnd = new Date(saved.plannedEnd);
    const delay = taskDates.end ? Math.max(0, Math.round((taskDates.end - pEnd) / 86400000)) : 0;
    plannedInfo = `<div style="font-size:0.65rem;color:var(--slate-400);margin-bottom:0.5rem;padding:0.375rem 0.5rem;background:var(--surface-1);border-radius:var(--radius-md);">
      계획: ${formatDate(pStart)} ~ ${formatDate(pEnd)}
      ${delay > 0 ? `<span style="color:var(--danger-400);font-weight:600;"> (${delay}일 지연)</span>` : `<span style="color:var(--success-400);"> (정상)</span>`}
    </div>`;
  }

  const modeLabel = hasPlanned ? "실제 일정 조정" : "계획 일정 설정";
  const modeDesc = hasPlanned
    ? "계획 일정은 유지되고, 변경된 일정은 실제 일정으로 저장됩니다."
    : "처음 설정하는 일정은 계획(Baseline)으로 저장됩니다.";

  const body = `
    <div>
      <div style="margin-bottom:1rem;">
        <span class="peek-label" style="margin-bottom:0.5rem;display:block;">전체 Phase 일정 (실제 작업 기준)</span>
        <div style="display:flex;flex-direction:column;gap:0.25rem;">
          ${allPhaseSummary}
        </div>
      </div>

      ${plannedInfo}

      <div style="background:var(--surface-1);border-radius:var(--radius-lg);padding:1rem;margin-bottom:1rem;">
        <div style="font-size:0.8rem;font-weight:600;color:var(--slate-200);margin-bottom:0.25rem;">📅 ${phase.name} — ${modeLabel}</div>
        <div style="font-size:0.65rem;color:var(--slate-400);margin-bottom:0.75rem;">${modeDesc}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div>
            <label style="font-size:0.65rem;color:var(--slate-400);display:block;margin-bottom:0.25rem;">시작일</label>
            <input type="date" id="so-phase-start" class="input-field" style="font-size:0.8rem;padding:0.5rem;" value="${startVal}">
          </div>
          <div>
            <label style="font-size:0.65rem;color:var(--slate-400);display:block;margin-bottom:0.25rem;">종료일</label>
            <input type="date" id="so-phase-end" class="input-field" style="font-size:0.8rem;padding:0.5rem;" value="${endVal}">
          </div>
        </div>
      </div>

      <div style="background:var(--surface-1);border-radius:var(--radius-lg);padding:0.75rem 1rem;margin-bottom:1rem;">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          <input type="checkbox" id="so-cascade" checked style="accent-color:var(--primary-400);">
          <span style="font-size:0.75rem;color:var(--slate-300);">후속 Phase 일정도 자동 조정</span>
        </label>
        <div style="font-size:0.65rem;color:var(--slate-400);margin-top:0.25rem;margin-left:1.5rem;">
          이 Phase의 종료일 이후로 다음 Phase들의 시작일/종료일이 순차적으로 밀려납니다.
        </div>
      </div>

      <div style="font-size:0.7rem;color:var(--slate-400);margin-bottom:0.75rem;">
        이 Phase의 <strong style="color:var(--slate-200);">${taskDates.count}개</strong> 작업 마감일이 새 기간 내에 균등 분배됩니다.
      </div>

      <button class="btn-primary" id="so-phase-apply" style="width:100%;border-radius:var(--radius-xl);padding:0.625rem;">적용</button>
    </div>
  `;

  openSlideOver(`${phase.name} 일정 편집`, body);

  // Bind apply — batchUpdateMultiPhaseSchedule (task dueDate + project phaseSchedules 원자적 업데이트)
  const applyBtn = document.getElementById("so-phase-apply");
  if (applyBtn) {
    applyBtn.addEventListener("click", async () => {
      const startStr = document.getElementById("so-phase-start")?.value;
      const endStr = document.getElementById("so-phase-end")?.value;
      if (!startStr || !endStr) { showToast("warning", "시작일과 종료일을 모두 입력해주세요"); return; }

      const startDate = new Date(startStr + "T00:00:00");
      const endDate = new Date(endStr + "T00:00:00");
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) { showToast("warning", "유효하지 않은 날짜입니다"); return; }
      if (endDate < startDate) { showToast("warning", "종료일이 시작일보다 앞설 수 없습니다"); return; }

      const cascade = document.getElementById("so-cascade")?.checked;

      applyBtn.disabled = true;
      applyBtn.textContent = "적용 중...";

      try {
        // Build phaseUpdates array for batchUpdateMultiPhaseSchedule
        const phaseUpdates = [];

        function buildPhaseUpdate(ph, pIdx, sDate, eDate) {
          const tasks = checklistItems.filter(t => t.stage === ph.workStage || t.stage === ph.gateStage);
          const days = Math.max(1, Math.ceil((eDate - sDate) / 86400000));
          const taskUpdates = tasks.map((t, i) => {
            const offset = tasks.length > 1 ? (i / (tasks.length - 1)) * days : 0;
            return { id: t.id, dueDate: new Date(sDate.getTime() + offset * 86400000) };
          });

          const existing = (project.phaseSchedules || {})[`phase${pIdx}`];
          const isFirst = !existing || !existing.plannedStart;

          return {
            phaseKey: `phase${pIdx}`,
            plannedStart: isFirst ? sDate : null,
            plannedEnd: isFirst ? eDate : null,
            actualStart: sDate,
            actualEnd: eDate,
            taskUpdates,
          };
        }

        // 현재 Phase
        phaseUpdates.push(buildPhaseUpdate(phase, phaseIdx, startDate, endDate));

        // Cascade: 후속 Phase 자동 조정
        if (cascade && phaseIdx < phases.length - 1) {
          let prevEnd = endDate;
          for (let j = phaseIdx + 1; j < phases.length; j++) {
            const nextPhase = phases[j];
            const nd = getPhaseTaskDates(nextPhase);
            let dur = 30;
            if (nd.start && nd.end) dur = Math.max(1, Math.ceil((nd.end - nd.start) / 86400000));

            const newStart = new Date(prevEnd.getTime() + 86400000);
            const newEnd = new Date(newStart.getTime() + dur * 86400000);

            phaseUpdates.push(buildPhaseUpdate(nextPhase, j, newStart, newEnd));
            prevEnd = newEnd;
          }
        }

        const totalTasks = phaseUpdates.reduce((sum, pu) => sum + pu.taskUpdates.length, 0);
        await batchUpdateMultiPhaseSchedule(projectId, phaseUpdates);

        const cascadeMsg = cascade ? " (후속 Phase 포함)" : "";
        showToast("success", `${phase.name} 일정이 변경되었습니다${cascadeMsg} — ${totalTasks}개 작업 업데이트`);
        closeSlideOver();
      } catch (err) {
        console.error("Phase schedule update failed:", err);
        showToast("error", "일정 변경 실패: " + err.message);
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = "적용";
      }
    });
  }
}

// ─── UXA-05: Task Peek Slide-Over ───────────────────────────────────────────

function openTaskPeek(task) {
  const dd = daysUntil(task.dueDate);
  const ddText = dd === null ? "-" : dd < 0 ? `D+${Math.abs(dd)}` : dd === 0 ? "D-Day" : `D-${dd}`;
  const ddColor = dd === null ? "var(--slate-400)" : dd < 0 ? "var(--danger-400)" : dd <= 3 ? "var(--warning-400)" : "var(--success-400)";

  const statusLabels = { pending: "대기", in_progress: "진행중", completed: "완료", rejected: "반려" };
  // 승인 절차 제거됨

  const dueDateVal = task.dueDate ? (task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate)).toISOString().split("T")[0] : "";
  const userOptions = allUsers.map(u => `<option value="${escapeHtml(u.name)}" ${task.assignee === u.name ? "selected" : ""}>${escapeHtml(u.name)} (${escapeHtml(u.department || "")})</option>`).join("");
  const deptOptions = [...new Set(checklistItems.map(t => t.department).filter(Boolean))].sort()
    .map(d => `<option value="${escapeHtml(d)}" ${task.department === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("");

  const files = task.attachments || [];

  // File icon helper (used in initial render & dynamic updates)
  function _getFileIcon(fileName) {
    const ext = (fileName || "").split(".").pop().toLowerCase();
    const icons = { doc: "primary", docx: "primary", hwp: "primary", txt: "primary", xls: "#22c55e", xlsx: "#22c55e", csv: "#22c55e", ppt: "#f97316", pptx: "#f97316", pdf: "#ef4444", png: "#8b5cf6", jpg: "#8b5cf6", jpeg: "#8b5cf6" };
    const _color = icons[ext] || "var(--slate-300)";
    if (["doc","docx","hwp","hwpx","txt","rtf"].includes(ext)) return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-400)" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    if (["xls","xlsx","csv"].includes(ext)) return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="12" y1="9" x2="12" y2="17"/></svg>`;
    if (["ppt","pptx"].includes(ext)) return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
    if (ext === "pdf") return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    if (["png","jpg","jpeg","gif","bmp","svg","webp"].includes(ext)) return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--slate-300)" stroke-width="1.5"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>`;
  }
  function _fmtSize(b) { if (!b) return ""; if (b < 1024) return b+" B"; if (b < 1048576) return (b/1024).toFixed(1)+" KB"; return (b/1048576).toFixed(1)+" MB"; }

  const filesHtml = files.length > 0
    ? files.map((f, fi) => {
        const fn = f.name || f;
        const hasUrl = !!f.url;
        const sz = f.size ? ` (${_fmtSize(f.size)})` : "";
        return `<div class="peek-file-item" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.375rem 0.5rem;background:var(--surface-1);border-radius:var(--radius-md);margin-bottom:0.25rem;transition:background 0.15s;" onmouseenter="this.style.background='var(--surface-2)'" onmouseleave="this.style.background='var(--surface-1)'">
          <${hasUrl ? `a href="${f.url}" target="_blank" rel="noopener"` : "div"} style="display:flex;align-items:center;gap:0.5rem;min-width:0;text-decoration:none;color:inherit;flex:1;cursor:${hasUrl ? "pointer" : "default"};" ${hasUrl ? `title="클릭하여 파일 열기"` : ""}>
            ${_getFileIcon(fn)}
            <div style="min-width:0;flex:1;">
              <div style="font-size:0.78rem;font-weight:500;color:${hasUrl ? "var(--primary-400)" : "var(--slate-200)"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${hasUrl ? "text-decoration:underline;text-underline-offset:2px;" : ""}">${escapeHtml(fn)}</div>
              ${sz ? `<div style="font-size:0.6rem;color:var(--slate-400);margin-top:0.1rem;">${sz}</div>` : ""}
            </div>
          </${hasUrl ? "a" : "div"}>
          <button class="peek-file-delete" data-file-idx="${fi}" title="삭제" style="flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--slate-400);cursor:pointer;border-radius:var(--radius-sm);font-size:0.8rem;padding:0;transition:all 0.15s;" onmouseenter="this.style.background='rgba(239,68,68,0.15)';this.style.color='var(--danger-400)';" onmouseleave="this.style.background='transparent';this.style.color='var(--slate-400)';">✕</button>
        </div>`;
      }).join("")
    : `<span style="font-size:0.75rem;color:var(--slate-400);">첨부 파일 없음</span>`;

  const isManual = task.source === "manual";

  const body = `
    <div>
      <!-- Header: Status + D-Day -->
      <div class="peek-header">
        <div class="peek-field">
          <select class="peek-field" id="peek-status" style="padding:0.375rem 0.5rem;font-size:0.8rem;border:1px solid var(--surface-3);border-radius:var(--radius-md);background:var(--surface-2);color:var(--slate-200);">
            ${Object.entries(statusLabels).map(([k, v]) => `<option value="${k}" ${task.status === k ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </div>
        <span class="peek-dday" style="color:${ddColor};">${ddText}</span>
      </div>

      <!-- Stage -->
      <div class="peek-section">
        <span class="peek-label">단계</span>
        <span class="peek-value">${escapeHtml(formatStageName(task.stage))}${isManual ? ' <span class="peek-badge-manual">추가</span>' : ""}</span>
      </div>

      <!-- Department + Assignee -->
      <div class="peek-section">
        <div class="peek-grid">
          <div class="peek-field">
            <span class="peek-label">부서</span>
            <select id="peek-dept">
              <option value="">미지정</option>
              ${deptOptions}
            </select>
          </div>
          <div class="peek-field">
            <span class="peek-label">담당자</span>
            <select id="peek-assignee">
              <option value="">미배분</option>
              ${userOptions}
            </select>
          </div>
        </div>
      </div>

      <!-- Due Date + Importance -->
      <div class="peek-section">
        <div class="peek-grid">
          <div class="peek-field">
            <span class="peek-label">마감일</span>
            <input type="date" id="peek-duedate" value="${dueDateVal}">
          </div>
          <div class="peek-field">
            <span class="peek-label">중요도</span>
            <select id="peek-importance">
              <option value="green" ${(task.importance || "green") === "green" ? "selected" : ""}>보통</option>
              <option value="yellow" ${task.importance === "yellow" ? "selected" : ""}>중요</option>
              <option value="red" ${task.importance === "red" ? "selected" : ""}>긴급</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Files -->
      <div class="peek-section">
        <span class="peek-label">산출물 / 첨부파일</span>
        <div class="peek-file-list" id="peek-files">${filesHtml}</div>
        <div style="margin-top:0.5rem;">
          <label class="peek-upload-btn">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"/></svg>
            파일 첨부
            <input type="file" id="peek-file-input" multiple style="display:none;">
          </label>
        </div>
      </div>

      <!-- Comments -->
      ${task.comments && task.comments.length > 0 ? `
      <div class="peek-section">
        <span class="peek-label">코멘트 (${task.comments.length})</span>
        ${task.comments.slice(-3).map(c => `
          <div style="padding:0.5rem;background:var(--surface-1);border-radius:var(--radius-md);margin-bottom:0.375rem;font-size:0.8rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
              <span style="font-weight:500;color:var(--slate-200);">${escapeHtml(c.userName || "")}</span>
              <span style="font-size:0.65rem;color:var(--slate-400);">${c.createdAt ? formatDate(new Date(c.createdAt)) : ""}</span>
            </div>
            <div style="color:var(--slate-300);">${escapeHtml(c.content || "")}</div>
          </div>
        `).join("")}
      </div>` : ""}

      <!-- Save Button -->
      <button class="peek-save-btn" id="peek-save-btn" style="margin-top:0.75rem;">저장</button>
      <a href="task.html?projectId=${projectId}&taskId=${task.id}" style="display:block;text-align:center;margin-top:0.5rem;font-size:0.8rem;color:var(--primary-400);text-decoration:none;">상세 보기 &rarr;</a>
    </div>
  `;

  openSlideOver(escapeHtml(task.title), body);

  // Bind save
  const saveBtn = document.getElementById("peek-save-btn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const updates = {};
      const newStatus = document.getElementById("peek-status")?.value;
      const newAssignee = document.getElementById("peek-assignee")?.value;
      const newDept = document.getElementById("peek-dept")?.value;
      const newDueDate = document.getElementById("peek-duedate")?.value;
      const newImportance = document.getElementById("peek-importance")?.value;

      if (newAssignee !== (task.assignee || "")) updates.assignee = newAssignee;
      if (newDept !== (task.department || "")) updates.department = newDept;
      if (newImportance !== (task.importance || "green")) updates.importance = newImportance;
      if (newDueDate && newDueDate !== dueDateVal) updates.dueDate = new Date(newDueDate);

      try {
        // Status change
        if (newStatus && newStatus !== task.status) {
          await updateChecklistItemStatus(task.id, newStatus);
        }
        // Other field changes
        if (Object.keys(updates).length > 0) {
          await updateChecklistItem(task.id, updates);
        }
        showToast("저장 완료", "success");
        closeSlideOver();
      } catch (e) {
        console.error("저장 오류:", e);
        showToast("저장 실패: " + e.message, "error");
      }
    });
  }

  // Helper: render file list with delete buttons and download links (reuses _getFileIcon, _fmtSize)
  function renderFileListHtml(fileList) {
    if (fileList.length === 0) return `<span style="font-size:0.75rem;color:var(--slate-400);">첨부 파일 없음</span>`;
    return fileList.map((f, fi) => {
      const fn = f.name || f;
      const hasUrl = !!f.url;
      const sz = f.size ? ` (${_fmtSize(f.size)})` : "";
      return `<div class="peek-file-item" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.375rem 0.5rem;background:var(--surface-1);border-radius:var(--radius-md);margin-bottom:0.25rem;transition:background 0.15s;" onmouseenter="this.style.background='var(--surface-2)'" onmouseleave="this.style.background='var(--surface-1)'">
        <${hasUrl ? `a href="${f.url}" target="_blank" rel="noopener"` : "div"} style="display:flex;align-items:center;gap:0.5rem;min-width:0;text-decoration:none;color:inherit;flex:1;cursor:${hasUrl ? "pointer" : "default"};" ${hasUrl ? `title="클릭하여 파일 열기"` : ""}>
          ${_getFileIcon(fn)}
          <div style="min-width:0;flex:1;">
            <div style="font-size:0.78rem;font-weight:500;color:${hasUrl ? "var(--primary-400)" : "var(--slate-200)"};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${hasUrl ? "text-decoration:underline;text-underline-offset:2px;" : ""}">${escapeHtml(fn)}</div>
            ${sz ? `<div style="font-size:0.6rem;color:var(--slate-400);margin-top:0.1rem;">${sz}</div>` : ""}
          </div>
        </${hasUrl ? "a" : "div"}>
        <button class="peek-file-delete" data-file-idx="${fi}" title="삭제" style="flex-shrink:0;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:none;background:transparent;color:var(--slate-400);cursor:pointer;border-radius:var(--radius-sm);font-size:0.8rem;padding:0;transition:all 0.15s;" onmouseenter="this.style.background='rgba(239,68,68,0.15)';this.style.color='var(--danger-400)';" onmouseleave="this.style.background='transparent';this.style.color='var(--slate-400)';">✕</button>
      </div>`;
    }).join("");
  }

  // Helper: bind file delete buttons
  function bindFileDeleteButtons(taskId, currentFiles) {
    const filesDiv = document.getElementById("peek-files");
    if (!filesDiv) return;
    filesDiv.querySelectorAll(".peek-file-delete").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.fileIdx);
        const fileName = currentFiles[idx]?.name || currentFiles[idx];
        if (!confirm(`"${fileName}" 파일을 삭제하시겠습니까?`)) return;
        const updated = currentFiles.filter((_, i) => i !== idx);
        try {
          await updateChecklistItem(taskId, { attachments: updated });
          // Update task object in memory
          task.attachments = updated;
          filesDiv.innerHTML = renderFileListHtml(updated);
          bindFileDeleteButtons(taskId, updated);
          showToast("파일이 삭제되었습니다", "success");
        } catch (err) {
          showToast("파일 삭제 실패: " + err.message, "error");
        }
      });
    });
  }

  // Bind initial file delete buttons
  bindFileDeleteButtons(task.id, files);

  // File input — upload to Firebase Storage
  const fileInput = document.getElementById("peek-file-input");
  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const rawFiles = [...fileInput.files];
      if (rawFiles.length === 0) return;

      const filesDiv = document.getElementById("peek-files");
      const uploadLabel = fileInput.closest("label");
      if (uploadLabel) { uploadLabel.style.opacity = "0.5"; uploadLabel.style.pointerEvents = "none"; }

      // Show uploading state
      const progressId = "upload-progress-" + Date.now();
      if (filesDiv) {
        filesDiv.insertAdjacentHTML("beforeend", `<div id="${progressId}" style="padding:0.375rem 0.5rem;background:var(--surface-1);border-radius:var(--radius-md);margin-bottom:0.25rem;font-size:0.75rem;color:var(--primary-400);display:flex;align-items:center;gap:0.5rem;">
          <svg width="14" height="14" class="spin" style="animation:spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.49-8.49l2.83-2.83M2 12h4m12 0h4m-3.93 7.07l-2.83-2.83M6.34 6.34L3.51 3.51"/></svg>
          <span>업로드 중... (0/${rawFiles.length})</span>
        </div>`);
      }

      const uploaded = [];
      let count = 0;
      for (const file of rawFiles) {
        try {
          const fileId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
          const path = `attachments/${projectId}/${task.id}/${fileId}_${file.name}`;
          const ref = storageRef(storage, path);
          const snapshot = await uploadBytesResumable(ref, file);
          const url = await getDownloadURL(snapshot.ref);
          uploaded.push({ name: file.name, size: file.size, url, path, addedAt: new Date().toISOString() });
          count++;
          const prog = document.getElementById(progressId);
          if (prog) prog.querySelector("span").textContent = `업로드 중... (${count}/${rawFiles.length})`;
        } catch (err) {
          console.error("Upload error:", err);
          // Fallback: save without URL
          uploaded.push({ name: file.name, size: file.size, addedAt: new Date().toISOString() });
          count++;
        }
      }

      const existing = task.attachments || [];
      const merged = [...existing, ...uploaded];
      try {
        await updateChecklistItem(task.id, { attachments: merged });
        task.attachments = merged;
        showToast(`${uploaded.length}개 파일 업로드 완료`, "success");
        if (filesDiv) {
          filesDiv.innerHTML = renderFileListHtml(merged);
          bindFileDeleteButtons(task.id, merged);
        }
      } catch (e) {
        showToast("파일 저장 실패: " + e.message, "error");
      }

      if (uploadLabel) { uploadLabel.style.opacity = "1"; uploadLabel.style.pointerEvents = ""; }
      fileInput.value = "";
    });
  }
}

// ─── Quick Add Task (NLP Parsing + Smart Assignee) ──────────────────────────

function _parseQuickInput(text) {
  const phases = getActivePhaseGroups();
  const result = { title: "", assignee: "", department: "", importance: "green", dueDate: null, stage: phases.length > 0 ? phases[0].workStage : "" };
  let remaining = text;

  const mentionMatch = remaining.match(/@([\uAC00-\uD7A3a-zA-Z]{2,10})/);
  if (mentionMatch) { result.assignee = mentionMatch[1]; remaining = remaining.replace(mentionMatch[0], "").trim(); }

  const deptMatch = remaining.match(/#([\uAC00-\uD7A3a-zA-Z\uc2e4]+)/);
  if (deptMatch) {
    const input = deptMatch[1];
    const found = departments.find(d => d.includes(input) || input.includes(d.replace("팀", "")));
    if (found) result.department = found;
    remaining = remaining.replace(deptMatch[0], "").trim();
  }

  if (remaining.includes("!긴급") || remaining.includes("!red")) { result.importance = "red"; remaining = remaining.replace(/!긴급|!red/g, "").trim(); }
  else if (remaining.includes("!중요") || remaining.includes("!yellow")) { result.importance = "yellow"; remaining = remaining.replace(/!중요|!yellow/g, "").trim(); }

  const dateMatch = remaining.match(/~(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})/);
  if (dateMatch) {
    let dateStr = dateMatch[1];
    if (dateStr.length === 5) dateStr = `${new Date().getFullYear()}-${dateStr}`;
    result.dueDate = new Date(dateStr);
    remaining = remaining.replace(dateMatch[0], "").trim();
  }

  const stageKeywords = { "발의": 0, "기획": 1, "WM": 2, "wm": 2, "Tx": 3, "tx": 3, "MSG": 4, "msg": 4, "양산": 5, "이관": 5 };
  for (const [kw, idx] of Object.entries(stageKeywords)) {
    if (remaining.includes(kw) && phases[idx]) { result.stage = phases[idx].workStage; break; }
  }

  result.title = remaining.trim();
  return result;
}

function getSmartAssigneeSuggestions(department) {
  if (!department || allUsers.length === 0) return [];
  const deptUsers = allUsers.filter(u => u.department === department && u.role === "worker");
  return deptUsers.map(u => {
    const tasks = checklistItems.filter(t => t.assignee === u.name);
    const active = tasks.filter(t => t.status === "in_progress" || t.status === "pending").length;
    const overdue = tasks.filter(t => { if (t.status === "completed") return false; const d = daysUntil(t.dueDate); return d !== null && d < 0; }).length;
    return { name: u.name, active, overdue, score: active + overdue * 2 };
  }).sort((a, b) => a.score - b.score);
}

async function handleApplyTemplate() {
  if (!await confirmModal("템플릿 항목을 이 프로젝트의 체크리스트로 생성하시겠습니까?")) return;
  const btn = app.querySelector("#apply-template-btn");
  if (btn) { btn.disabled = true; btn.textContent = "생성 중..."; }
  try {
    const projectType = project?.projectType || "신규개발";
    const count = await applyTemplateToProject(projectId, projectType);
    if (count > 0) {
      showToast("success", `${count}개 체크리스트 항목이 생성되었습니다.`);
    } else {
      showToast("warning", "생성할 템플릿 항목이 없거나 이미 적용되었습니다.");
    }
  } catch (err) {
    console.error("템플릿 적용 오류:", err);
    showToast("error", "템플릿 적용 실패: " + err.message);
    if (btn) { btn.disabled = false; btn.textContent = "📋 템플릿에서 체크리스트 생성"; }
  }
}

async function handleApplyLaunch() {
  if (!await confirmModal("출시 준비 체크리스트를 이 프로젝트에 생성하시겠습니까?")) return;
  const btn = app.querySelector("#apply-launch-btn");
  if (btn) { btn.disabled = true; btn.textContent = "생성 중..."; }
  try {
    const projectType = project?.projectType || "신규개발";
    const endDate = project?.endDate || new Date();
    const count = await applyLaunchChecklistToProject(projectId, projectType, endDate);
    if (count > 0) {
      showToast("success", `${count}개 출시 준비 체크리스트가 생성되었습니다.`);
      if (btn) btn.style.display = "none";
    } else {
      showToast("warning", "생성할 출시 준비 항목이 없습니다.");
    }
  } catch (err) {
    console.error("출시 준비 적용 오류:", err);
    showToast("error", "출시 준비 적용 실패: " + err.message);
    if (btn) { btn.disabled = false; btn.textContent = "🚀 출시 준비 적용"; }
  }
}

// =============================================================================
// Phase Panel (슬라이드 오버 — 승인 기록 + 회의록)
// =============================================================================

function openPhasePanel(phase, phaseIdx) {
  const phaseId = `phase${phaseIdx}`;
  const gr = gateRecords.find(r => r.phaseId === phaseId) || null;
  const gateStatus = gr?.gateStatus || "pending";
  const notes = gr?.meetingNotes || [];
  const desc = PHASE_DESCRIPTIONS[phase.name] || "";

  const statusLabel = gateStatus === "approved" ? "✅ 승인 완료" : gateStatus === "rejected" ? "❌ 반려" : "⏳ 대기";
  const statusCls = gateStatus === "approved" ? "gate-approved" : gateStatus === "rejected" ? "gate-rejected" : "gate-pending";

  // 체크리스트 기반 진행 현황
  const phaseTasks = checklistItems.filter(t => t.stage === phase.workStage || t.stage === phase.gateStage);
  const doneTasks = phaseTasks.filter(t => t.status === "completed").length;
  const totalTasks = phaseTasks.length;

  const body = `
    <div class="gate-panel">
      <!-- 설명 -->
      <div class="gate-section">
        <div class="gate-section-title">📋 Phase 설명</div>
        <p class="gate-desc">${escapeHtml(desc) || "설명 없음"}</p>
        <div class="gate-progress-row">
          <span>체크리스트 진행</span>
          <span class="gate-progress-count">${doneTasks} / ${totalTasks}</span>
        </div>
        ${totalTasks > 0 ? `<div class="gate-progress-bar"><div class="gate-progress-fill" style="width:${Math.round(doneTasks/totalTasks*100)}%"></div></div>` : ""}
      </div>

      <!-- 승인 상태 -->
      <div class="gate-section">
        <div class="gate-section-title">🔒 위원회 승인</div>
        <div class="gate-status ${statusCls}">${statusLabel}</div>
        ${gr?.approvedBy ? `<div class="gate-meta" style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          <span>승인자: ${escapeHtml(gr.approvedBy)}</span>
          <span style="color:var(--slate-400);">·</span>
          <span class="gate-date-display" style="display:inline-flex;align-items:center;gap:0.25rem;">
            <input type="date" class="gate-date-input" value="${gr.approvedAt ? new Date(gr.approvedAt).toISOString().slice(0,10) : ""}" style="font-size:0.75rem;padding:0.15rem 0.3rem;border:1px solid var(--surface-4);border-radius:var(--radius-sm);background:var(--surface-1);color:var(--text-primary);cursor:pointer;width:auto;" title="날짜 클릭하여 수정">
          </span>
        </div>` : ""}
        <div class="gate-actions">
          <button class="btn-sm gate-btn-approve" data-gate-action="approved" ${gateStatus === "approved" ? "disabled" : ""}>✅ 승인</button>
          <button class="btn-sm gate-btn-reject" data-gate-action="rejected" ${gateStatus === "rejected" ? "disabled" : ""}>❌ 반려</button>
          ${gateStatus !== "pending" ? `<button class="btn-sm gate-btn-reset" data-gate-action="pending">↩ 초기화</button>` : ""}
        </div>
      </div>

      <!-- 회의록 -->
      <div class="gate-section">
        <div class="gate-section-title">💬 회의록 · 피드백 <span class="gate-note-count">${notes.length}건</span></div>
        <div class="gate-notes-list">
          ${notes.length === 0 ? `<div class="empty-state" style="padding:1rem">
              <div class="empty-state-icon">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
              </div>
              <span class="empty-state-text">등록된 회의록이 없습니다</span>
            </div>` :
            notes.map(n => `
              <div class="gate-note">
                <div class="gate-note-header">
                  <span class="gate-note-author">${escapeHtml(n.author)}</span>
                  <span class="gate-note-date">${n.createdAt ? formatDate(n.createdAt) : ""}</span>
                </div>
                <div class="gate-note-content">${escapeHtml(n.content)}</div>
                ${(n.files && n.files.length > 0) ? `
                  <div class="gate-note-files" style="margin-top:0.375rem;display:flex;flex-wrap:wrap;gap:0.25rem;">
                    ${n.files.map(f => `
                      <a href="${f.url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.5rem;background:var(--surface-2);border:1px solid var(--surface-4);border-radius:var(--radius-sm);font-size:0.65rem;color:var(--primary-400);text-decoration:none;">
                        📎 ${escapeHtml(f.name)}
                      </a>
                    `).join("")}
                  </div>
                ` : ""}
              </div>
            `).join("")
          }
        </div>
        <div class="gate-note-form">
          <textarea class="gate-note-input" placeholder="회의 내용, 피드백, 결정 사항 등을 기록하세요..." rows="3"></textarea>
          <div class="gate-note-file-area" style="margin-top:0.375rem;">
            <label style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.3rem 0.6rem;background:var(--surface-2);border:1px solid var(--surface-4);border-radius:var(--radius-sm);font-size:0.7rem;color:var(--slate-300);cursor:pointer;">
              📎 파일 첨부
              <input type="file" class="gate-note-file-input" multiple style="display:none;">
            </label>
            <div class="gate-note-file-list" style="margin-top:0.25rem;font-size:0.65rem;color:var(--slate-400);"></div>
          </div>
          <button class="btn-primary btn-sm gate-note-submit" style="margin-top:0.375rem;">등록</button>
        </div>
      </div>
    </div>
  `;

  openSlideOver(`${phase.name} — ${phase.gateStage}`, body);

  // 이벤트 바인딩 (슬라이드 패널 내부)
  setTimeout(() => {
    const panel = document.querySelector(".slide-over-body");
    if (!panel) return;

    // 승인/반려/초기화 버튼
    panel.querySelectorAll("[data-gate-action]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset.gateAction;
        try {
          btn.disabled = true;
          btn.style.opacity = "0.5";
          await updateGateRecord(projectId, phaseId, phase.name, action, user?.name || "");
          showToast("success", action === "approved" ? "승인 완료" : action === "rejected" ? "반려 처리" : "초기화 완료");
          // Optimistic update: immediately patch local gateRecords so panel re-renders with new status
          const existingIdx = gateRecords.findIndex(r => r.phaseId === phaseId);
          const now = new Date().toISOString();
          if (existingIdx >= 0) {
            gateRecords[existingIdx].gateStatus = action;
            if (action === "approved" || action === "rejected") {
              gateRecords[existingIdx].approvedBy = user?.name || "";
              gateRecords[existingIdx].approvedAt = now;
            }
            if (action === "pending") {
              gateRecords[existingIdx].approvedBy = "";
              gateRecords[existingIdx].approvedAt = null;
            }
          } else {
            gateRecords.push({ phaseId, phaseName: phase.name, gateStatus: action, approvedBy: action !== "pending" ? (user?.name || "") : "", approvedAt: action !== "pending" ? now : null, meetingNotes: [] });
          }
          // Re-open panel immediately with updated data
          openPhasePanel(phase, phaseIdx);
        } catch (err) {
          showToast("error", "처리 실패: " + err.message);
          btn.disabled = false;
          btn.style.opacity = "1";
        }
      });
    });

    // 승인 날짜 수정
    const dateInput = panel.querySelector(".gate-date-input");
    if (dateInput) {
      dateInput.addEventListener("change", async () => {
        const newDate = dateInput.value;
        if (!newDate) return;
        try {
          await updateGateApprovedAt(projectId, phaseId, newDate);
          // Optimistic update
          const idx = gateRecords.findIndex(r => r.phaseId === phaseId);
          if (idx >= 0) gateRecords[idx].approvedAt = new Date(newDate).toISOString();
          showToast("success", "승인 날짜가 수정되었습니다");
        } catch (err) {
          showToast("error", "날짜 수정 실패: " + err.message);
        }
      });
    }

    // 파일 첨부 미리보기
    const fileInput = panel.querySelector(".gate-note-file-input");
    const fileListEl = panel.querySelector(".gate-note-file-list");
    if (fileInput && fileListEl) {
      fileInput.addEventListener("change", () => {
        const names = Array.from(fileInput.files).map(f => f.name);
        fileListEl.textContent = names.length > 0 ? names.join(", ") : "";
      });
    }

    // 회의록 등록 (파일 첨부 포함)
    const submitBtn = panel.querySelector(".gate-note-submit");
    const textarea = panel.querySelector(".gate-note-input");
    if (submitBtn && textarea) {
      submitBtn.addEventListener("click", async () => {
        const content = textarea.value.trim();
        const files = fileInput ? Array.from(fileInput.files) : [];
        if (!content && files.length === 0) { showToast("warning", "내용 또는 파일을 입력해주세요"); return; }
        try {
          submitBtn.disabled = true;
          submitBtn.textContent = files.length > 0 ? "업로드 중..." : "등록 중...";

          // Upload files to Storage
          const uploadedFiles = [];
          for (const file of files) {
            const fileId = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
            const path = `gateNotes/${projectId}/${phaseId}/${fileId}_${file.name}`;
            const ref = storageRef(storage, path);
            const snap = await uploadBytesResumable(ref, file);
            const url = await getDownloadURL(snap.ref);
            uploadedFiles.push({ name: file.name, url, size: file.size, type: file.type });
          }

          await addGateMeetingNote(projectId, phaseId, phase.name, user?.name || "익명", content || "(파일 첨부)", uploadedFiles);
          showToast("success", "회의록이 등록되었습니다");
          setTimeout(() => openPhasePanel(phase, phaseIdx), 300);
        } catch (err) {
          showToast("error", "등록 실패: " + err.message);
          submitBtn.disabled = false;
          submitBtn.textContent = "등록";
        }
      });
    }
  }, 100);
}

let isCreating = false;
async function handleQuickAdd() {
  if (isCreating) return;
  const titleInput = document.getElementById("quick-add-title");
  if (!titleInput || !titleInput.value.trim()) { showToast('warning', "작업 내용을 입력해주세요"); return; }
  const title = titleInput.value.trim();
  const stage = document.getElementById("quick-add-stage")?.value || getActivePhaseGroups()[0]?.workStage || "";
  const dept = document.getElementById("quick-add-dept")?.value || user.department || departments[0];
  const importance = document.getElementById("quick-add-importance")?.value || "green";
  const dueDateStr = document.getElementById("quick-add-due")?.value;
  const dueDate = dueDateStr ? new Date(dueDateStr) : new Date(Date.now() + 14 * 86400000);
  const suggestions = getSmartAssigneeSuggestions(dept);
  const assignee = suggestions.length > 0 ? suggestions[0].name : user.name;
  isCreating = true;
  const btn = document.getElementById("quick-add-btn");
  if (btn) btn.disabled = true;
  try {
    await createChecklistItem({ projectId, title, assignee, department: dept, stage, importance, dueDate, status: "pending", source: "manual" });
    titleInput.value = "";
  } catch (err) { showToast('error', "작업 생성 실패: " + err.message); }
  finally { isCreating = false; if (btn) btn.disabled = false; }
}

function showAddTaskModal() {
  const dept = user.department || departments[0];
  const suggestions = getSmartAssigneeSuggestions(dept);
  const suggestHtml = suggestions.slice(0, 5).map(s =>
    `<div class="smart-suggest-item" data-name="${escapeHtml(s.name)}" style="display:flex;justify-content:space-between;padding:6px 10px;cursor:pointer;border-radius:var(--radius-sm);font-size:0.8rem">
      <span><strong>${escapeHtml(s.name)}</strong></span>
      <span style="color:var(--slate-400)">${s.active}건 ${s.overdue > 0 ? `<span style="color:var(--danger-400)">${s.overdue}건 지연</span>` : ""}</span>
    </div>`
  ).join("");

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "add-task-modal";
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:1.1rem">작업 추가</h3>
        <button class="btn-ghost btn-sm" id="close-add-modal">&times;</button>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="form-label">작업 내용 *</label>
          <input type="text" id="modal-task-title" class="input-field" placeholder="작업 내용을 입력하세요">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form-label">단계</label>
            <select id="modal-task-stage" class="input-field">
              ${getActivePhaseGroups().map(p => `<option value="${p.workStage}">${p.name} (작업)</option><option value="${p.gateStage}">${p.name} (승인)</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="form-label">부서</label>
            <select id="modal-task-dept" class="input-field">
              ${departments.map(d => `<option value="${d}" ${d === dept ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div>
          <label class="form-label">담당자 ${suggestions.length > 0 ? '<span style="font-size:0.7rem;color:var(--primary-400)">(추천순)</span>' : ""}</label>
          <input type="text" id="modal-task-assignee" class="input-field" placeholder="담당자 이름" value="${suggestions.length > 0 ? escapeHtml(suggestions[0].name) : ""}">
          ${suggestHtml ? `<div class="smart-suggest-list" style="margin-top:4px;border:1px solid var(--surface-3);border-radius:var(--radius-md);max-height:150px;overflow-y:auto">${suggestHtml}</div>` : ""}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form-label">마감일</label>
            <input type="date" id="modal-task-due" class="input-field" value="${new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}">
          </div>
          <div>
            <label class="form-label">중요도</label>
            <select id="modal-task-importance" class="input-field">
              <option value="green">보통</option>
              <option value="yellow">중요</option>
              <option value="red">긴급</option>
            </select>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding-top:12px">
        <button class="btn-ghost btn-sm" id="cancel-add-modal">취소</button>
        <button class="btn-primary btn-sm" id="submit-add-modal">작업 생성</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector("#close-add-modal").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#cancel-add-modal").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll(".smart-suggest-item").forEach(item => {
    item.addEventListener("click", () => { overlay.querySelector("#modal-task-assignee").value = item.dataset.name; });
    item.addEventListener("mouseenter", () => { item.style.background = "var(--surface-2)"; });
    item.addEventListener("mouseleave", () => { item.style.background = ""; });
  });

  overlay.querySelector("#modal-task-dept").addEventListener("change", (e) => {
    const newSugs = getSmartAssigneeSuggestions(e.target.value);
    const list = overlay.querySelector(".smart-suggest-list");
    if (list && newSugs.length > 0) {
      list.innerHTML = newSugs.slice(0, 5).map(s =>
        `<div class="smart-suggest-item" data-name="${escapeHtml(s.name)}" style="display:flex;justify-content:space-between;padding:6px 10px;cursor:pointer;border-radius:var(--radius-sm);font-size:0.8rem">
          <span><strong>${escapeHtml(s.name)}</strong></span>
          <span style="color:var(--slate-400)">${s.active}건 ${s.overdue > 0 ? `<span style="color:var(--danger-400)">${s.overdue}건 지연</span>` : ""}</span>
        </div>`
      ).join("");
      list.querySelectorAll(".smart-suggest-item").forEach(item => {
        item.addEventListener("click", () => { overlay.querySelector("#modal-task-assignee").value = item.dataset.name; });
      });
      if (newSugs.length > 0) overlay.querySelector("#modal-task-assignee").value = newSugs[0].name;
    }
  });

  overlay.querySelector("#submit-add-modal").addEventListener("click", async () => {
    if (isCreating) return;
    const title = overlay.querySelector("#modal-task-title").value.trim();
    if (!title) { showToast('warning', "작업 내용을 입력해주세요"); return; }
    isCreating = true;
    const submitBtn = overlay.querySelector("#submit-add-modal");
    if (submitBtn) submitBtn.disabled = true;
    try {
      await createChecklistItem({
        projectId, title,
        assignee: overlay.querySelector("#modal-task-assignee").value.trim() || user.name,
        department: overlay.querySelector("#modal-task-dept").value,
        stage: overlay.querySelector("#modal-task-stage").value,
        importance: overlay.querySelector("#modal-task-importance").value,
        dueDate: new Date(overlay.querySelector("#modal-task-due").value),
        status: "pending",
        source: "manual",
      });
      overlay.remove();
    } catch (err) { showToast('error', "작업 생성 실패: " + err.message); }
    finally { isCreating = false; }
  });
}
