// =============================================================================
// Project Detail Page — 3-tab project view (개요+작업 / 스케줄 / 병목)
// =============================================================================

import { guardPage } from "../auth.js";
import { showToast } from "../ui/toast.js";
import { confirmModal } from "../ui/confirm-modal.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
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
  getTemplateDepartments,
  applyTemplateToProject,
  applyLaunchChecklistToProject,
  subscribeLaunchChecklists,
  subscribeGateRecords,
  updateGateRecord,
  addGateMeetingNote,
  PHASE_DESCRIPTIONS,
} from "../firestore-service.js";
import { openSlideOver, closeSlideOver } from "../ui/slide-over.js";
import { renderSkeletonCards, renderSkeletonStats } from "../ui/skeleton.js";
import { initSortable, guardRender } from "../ui/dnd.js";
import {
  departments,
  projectStages,
  PHASE_GROUPS,
  GATE_STAGES,
  getStatusLabel,
  getStatusBadgeClass,
  formatStageName,
  escapeHtml,
  formatDate,
  getQueryParam,
  daysUntil,
  getRiskClass,
  getRiskLabel,
  getProgressClass,
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
let unsubProject = null;
let unsubChecklist = null;
let gateRecords = [];
let launchCount = 0;

let projectsLoaded = false;
unsubProject = subscribeProjects((projects) => {
  project = projects.find((p) => p.id === projectId) || null;
  projectsLoaded = true;
  render();
});

unsubChecklist = subscribeChecklistItems(projectId, (items) => {
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
function getActiveGateStages() {
  return getActivePhaseGroups().map(p => p.gateStage);
}

function getMatrixCellData(stageName, dept) {
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

function renderProjectHeader(phaseIndex, phaseStatuses, totalTasks, overdueTasks, approvalPending) {
  const p = project;
  const activePhases = getActivePhaseGroups();
  const currentPhaseName = phaseIndex >= 0 && phaseIndex < activePhases.length ? activePhases[phaseIndex].name : formatStageName(p.currentStage);

  // D-day
  const endDate = p.endDate ? new Date(p.endDate) : null;
  const dDays = endDate ? daysUntil(endDate) : null;
  const dDayText = dDays !== null ? (dDays < 0 ? `D+${Math.abs(dDays)}` : dDays === 0 ? "D-Day" : `D-${dDays}`) : "-";
  const dDayColor = dDays !== null ? (dDays < 0 ? "var(--danger-400)" : dDays <= 7 ? "var(--warning-400)" : "var(--success-400)") : "var(--slate-400)";

  // Delay reason
  let delayReason = "";
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
            <span style="font-family:'JetBrains Mono',monospace;font-size:1.75rem;font-weight:800;color:${dDayColor};">${dDayText}</span>
            <div style="font-size:0.8rem;color:var(--slate-400);">
              ${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}
            </div>
          </div>

          ${delayReason ? `
            <div style="display:inline-flex;align-items:center;gap:0.375rem;padding:0.375rem 0.75rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-lg);margin-bottom:0.5rem;">
              <svg width="12" height="12" fill="none" stroke="var(--danger-400)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
              <span style="font-size:0.75rem;color:var(--danger-400);">${escapeHtml(delayReason)}</span>
            </div>
          ` : `
            <div style="display:inline-flex;align-items:center;gap:0.375rem;padding:0.375rem 0.75rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-lg);margin-bottom:0.5rem;">
              <svg width="12" height="12" fill="none" stroke="var(--success-400)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span style="font-size:0.75rem;color:var(--success-400);">정상 진행</span>
            </div>
          `}

          <!-- Phase pipeline (컴팩트, 스크롤 가능) -->
          <div class="phase-pipeline-wrap">
            ${activePhases.map((ph, idx) => {
              const st = phaseStatuses[idx];
              const isCompleted = st === "completed";
              const isCurrent = st === "active";
              // gateRecord 기반 승인 상태
              const gr = gateRecords.find(r => r.phaseName === ph.name);
              const gateStatus = gr?.gateStatus || "pending";
              const noteCount = gr?.meetingNotes?.length || 0;
              const statusCls = gateStatus === "approved" ? "done" : gateStatus === "rejected" ? "rejected" : isCompleted ? "done" : isCurrent ? "active" : "pending";
              const icon = gateStatus === "approved" ? "✔" : gateStatus === "rejected" ? "✗" : isCurrent ? "▶" : "";
              return `<div class="phase-pip-item">
                <button class="phase-pip-badge phase-pip-${statusCls}" data-phase-panel="${idx}" title="${escapeHtml(ph.gateStage)}">
                  ${icon ? `<span class="phase-pip-icon">${icon}</span>` : ""}${ph.name}${noteCount > 0 ? ` <span class="phase-pip-note-count">${noteCount}</span>` : ""}
                </button>
                ${idx < activePhases.length - 1 ? '<span class="phase-pip-arrow">→</span>' : ""}
              </div>`;
            }).join("")}
          </div>

          <!-- Export Buttons -->
          <div style="margin-top:0.75rem;display:flex;gap:0.5rem;">
            <button class="btn-ghost btn-sm" id="export-csv-btn" style="font-size:0.75rem;">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:0.25rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>CSV
            </button>
            <button class="btn-ghost btn-sm" id="export-pdf-btn" style="font-size:0.75rem;">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:0.25rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>PDF
            </button>
            <button class="btn-ghost btn-sm" id="print-btn" data-print-hide style="font-size:0.75rem;">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:0.25rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>인쇄
            </button>
          </div>
        </div>

        <!-- Right: Key stats -->
        <div style="display:flex;gap:1.25rem;text-align:center;flex-shrink:0;">
          <div>
            <div style="font-size:1.75rem;font-weight:700;color:var(--slate-100);">${totalTasks}</div>
            <div style="font-size:0.65rem;color:var(--slate-400);">전체 작업</div>
          </div>
          <div>
            <div style="font-size:1.75rem;font-weight:700;color:${overdueTasks > 0 ? "var(--danger-400)" : "var(--slate-100)"};">${overdueTasks}</div>
            <div style="font-size:0.65rem;color:var(--slate-400);">지연</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// Tab 1: 개요+작업 (2-column layout)
// =============================================================================

function renderPhaseCards() {
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
    <!-- Phase Cards -->
    ${renderPhaseCards()}

    <!-- View Switcher -->
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">
      ${["phase","timeline","department","board","matrix","list"].map(v => {
        const labels = { phase: "Phase", timeline: "타임라인", department: "부서", board: "보드", matrix: "매트릭스", list: "리스트" };
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

    <!-- Quick Add -->
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem;align-items:stretch;">
      <input type="text" id="quick-add-input" class="input-field" style="flex:1;font-size:0.8rem"
        placeholder="@담당자 #부서 !긴급 작업 내용 ~마감일">
      <button class="btn-primary btn-sm" id="quick-add-btn" style="white-space:nowrap;padding:0.4rem 0.75rem;font-size:0.75rem;">추가</button>
      <button class="btn-secondary btn-sm" id="open-add-modal-btn" style="padding:0.4rem 0.6rem;" title="상세 입력">+</button>
      <button class="btn-secondary btn-sm" id="apply-template-btn" style="white-space:nowrap;padding:0.4rem 0.75rem;font-size:0.75rem;">📋 템플릿 적용</button>
      <button class="btn-secondary btn-sm" id="apply-launch-btn" style="white-space:nowrap;padding:0.4rem 0.75rem;font-size:0.75rem;${launchCount > 0 ? 'display:none;' : ''}">🚀 출시 준비 적용</button>
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
  if (checklistView === "department") return renderDepartmentView();
  if (checklistView === "board") return renderBoardView();
  if (checklistView === "matrix") return renderMatrixView();
  return renderListView();
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
  return `
    <div class="card-hover pd-task-row" data-task-id="${task.id}" style="border:none;border-bottom:1px solid var(--surface-3);border-radius:0;padding:0.625rem 0.75rem;cursor:pointer;${isOverdue ? "border-left:3px solid var(--danger-400);" : ""}">
      <div style="display:flex;align-items:start;gap:0.5rem;">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.375rem;margin-bottom:0.25rem;flex-wrap:wrap;">
            <span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${
              task.status === "completed" ? "var(--success-400)" :
              task.status === "in_progress" ? "var(--primary-400)" :
              task.status === "rejected" ? "var(--danger-400)" : "var(--slate-400)"
            };"></span>
            <span style="font-size:0.8rem;font-weight:500;color:var(--slate-200);">${escapeHtml(task.title)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;font-size:0.65rem;color:var(--slate-400);flex-wrap:wrap;">
            ${task.assignee ? `<span>${escapeHtml(task.assignee)}</span>` : ""}
            <span>${escapeHtml(task.department)}</span>
            <span style="${isOverdue ? "color:var(--danger-400);font-weight:600;" : ""}">${formatDate(task.dueDate)}${task.status !== "completed" && dd !== null ? (dd < 0 ? ` D+${Math.abs(dd)}` : dd === 0 ? " D-Day" : ` D-${dd}`) : ""}</span>
            ${task.source === "manual" ? '<span class="peek-badge-manual">추가</span>' : ""}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:0.25rem;">
        ${task.source === "manual" ? `<button class="peek-delete-btn" data-delete-task="${task.id}" onclick="event.stopPropagation()" title="삭제"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>` : ""}
        <select class="inline-status-select" data-status-item="${task.id}" data-current="${task.status}" onclick="event.stopPropagation()">
          <option value="pending" ${task.status==="pending"?"selected":""}>대기</option>
          <option value="in_progress" ${task.status==="in_progress"?"selected":""}>진행</option>
          <option value="completed" ${task.status==="completed"?"selected":""}>완료</option>
        </select>
        </div>
      </div>
    </div>
  `;
}

function renderPhaseView() {
  const filtered = getFilteredTasks();
  if (filtered.length === 0) return renderEmptyState();

  const phases = getActivePhaseGroups();
  const MAX_VISIBLE_TASKS = 5;

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
    const gateStatus = gr?.gateStatus || "pending";
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
    const visibleTasks = sortedTasks.slice(0, MAX_VISIBLE_TASKS);
    const hiddenTasks = sortedTasks.slice(MAX_VISIBLE_TASKS);

    return `
      <div class="phase-card ${borderCls} mb-3" id="phase-card-${idx}" data-phase-idx="${idx}">
        <!-- Header (clickable to toggle) -->
        <div class="phase-card-header" data-phase-toggle="${idx}">
          <div class="phase-card-header-left">
            <span class="phase-card-chevron ${defaultOpen ? 'open' : ''}">▶</span>
            <span class="phase-card-name">${phase.name}</span>
            <span class="phase-card-count">${completed}/${total}</span>
            ${minDate && maxDate ? `<span class="phase-card-dates">🗓 ${(minDate.getMonth()+1)}/${minDate.getDate()}~${(maxDate.getMonth()+1)}/${maxDate.getDate()}</span>` : ""}
            ${statusBadge}
          </div>
        </div>

        <!-- Body (collapsible) -->
        <div class="phase-card-body ${defaultOpen ? 'open' : ''}">
          <!-- 1. Description -->
          ${desc ? `<div class="phase-section phase-desc-section"><span class="phase-section-icon">📋</span><span class="phase-desc-text">${escapeHtml(desc)}</span></div>` : ""}

          <!-- 2. Gate approval (위원회 승인) — 모든 사용자에게 표시 -->
          <div class="phase-section phase-gate-section">
            <div class="phase-gate-header">
              <span class="phase-section-icon">🔒</span>
              <span class="phase-gate-label">위원회 승인:</span>
              <span class="phase-gate-status ${gateStatus === "approved" ? "gate-approved" : gateStatus === "rejected" ? "gate-rejected" : "gate-pending"}">
                ${gateStatus === "approved" ? "✅ 승인 완료" : gateStatus === "rejected" ? "❌ 반려" : "⏳ 대기"}
              </span>
              ${gr?.approvedBy ? `<span class="phase-gate-meta">(${escapeHtml(gr.approvedBy)}, ${gr.approvedAt ? new Date(gr.approvedAt).toLocaleDateString("ko-KR") : ""})</span>` : ""}
            </div>
            <div class="phase-gate-actions">
              <button class="btn-sm phase-gate-btn phase-gate-btn-approve" data-inline-gate="${idx}" data-gate-action="approved" ${gateStatus === "approved" ? "disabled" : ""}>✅ 승인</button>
              <button class="btn-sm phase-gate-btn phase-gate-btn-reject" data-inline-gate="${idx}" data-gate-action="rejected" ${gateStatus === "rejected" ? "disabled" : ""}>❌ 반려</button>
              ${gateStatus !== "pending" ? `<button class="btn-sm phase-gate-btn phase-gate-btn-reset" data-inline-gate="${idx}" data-gate-action="pending">↩ 초기화</button>` : ""}
            </div>
          </div>

          <!-- 3. Meeting notes -->
          <div class="phase-section phase-notes-section">
            <div class="phase-notes-header">
              <span class="phase-section-icon">💬</span>
              <span class="phase-notes-title">회의록 <span class="phase-notes-count">${notes.length}건</span></span>
              <button class="btn-sm phase-note-add-btn" data-note-toggle="${idx}">+ 등록</button>
            </div>
            ${notes.length > 0 ? `
              <div class="phase-notes-list">
                ${notes.slice(0, 2).map(n => `
                  <div class="phase-note-item">
                    <span class="phase-note-author">${escapeHtml(n.author)}</span>
                    <span class="phase-note-date">${n.createdAt ? new Date(n.createdAt).toLocaleDateString("ko-KR") : ""}</span>
                    <span class="phase-note-content">${escapeHtml(n.content)}</span>
                  </div>
                `).join("")}
                ${notes.length > 2 ? `
                  <div class="phase-notes-hidden" data-notes-more="${idx}" style="display:none;">
                    ${notes.slice(2).map(n => `
                      <div class="phase-note-item">
                        <span class="phase-note-author">${escapeHtml(n.author)}</span>
                        <span class="phase-note-date">${n.createdAt ? new Date(n.createdAt).toLocaleDateString("ko-KR") : ""}</span>
                        <span class="phase-note-content">${escapeHtml(n.content)}</span>
                      </div>
                    `).join("")}
                  </div>
                  <button class="phase-notes-more-btn" data-notes-expand="${idx}">${notes.length - 2}건 더 보기 ▼</button>
                ` : ""}
              </div>
            ` : '<div class="phase-notes-empty">등록된 회의록이 없습니다</div>'}
            <div class="phase-note-form" data-note-form="${idx}" style="display:none;">
              <textarea class="phase-note-input" data-note-input="${idx}" placeholder="회의 내용, 피드백, 결정 사항 등을 기록하세요..." rows="2"></textarea>
              <button class="btn-primary btn-sm phase-note-submit" data-note-submit="${idx}">등록</button>
            </div>
          </div>

          <!-- 4. Checklist tasks -->
          <div class="phase-section phase-tasks-section">
            <div class="phase-tasks-header">
              <span class="phase-section-icon">📝</span>
              <span>체크리스트 (${completed}/${total} 완료${overdueTasks.length > 0 ? `, <span style="color:var(--danger-400)">${overdueTasks.length}건 지연</span>` : ""})</span>
            </div>
            <div class="phase-tasks-list">
              ${visibleTasks.map(t => renderTaskRow(t)).join("")}
            </div>
            ${hiddenTasks.length > 0 ? `
              <div class="phase-tasks-hidden" data-tasks-more="${idx}" style="display:none;">
                ${hiddenTasks.map(t => renderTaskRow(t)).join("")}
              </div>
              <button class="phase-tasks-toggle-btn" data-tasks-expand="${idx}">${hiddenTasks.length}개 항목 더 보기 ▼</button>
            ` : ""}
          </div>
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

function renderDepartmentView() {
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

  function renderKanbanCard(t) {
    const isUrgent = t.importance === "red";
    const urgentBorder = isUrgent ? "border-left:3px solid var(--danger-400);" : "";
    return `
      <div class="card-hover pd-task-row kanban-card" data-task-id="${t.id}" data-status="${t.status}" style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--surface-3);cursor:pointer;${urgentBorder}">
        ${isUrgent ? '<span style="font-size:0.55rem;color:var(--danger-400);font-weight:700;">긴급</span>' : ''}
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
            ${activePhases.map(phase => `<th style="padding:0.625rem 0.5rem;text-align:center;font-weight:600;color:var(--slate-300);min-width:80px;">
              ${escapeHtml(phase.name)}
            </th>`).join("")}
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
                const gateInfo = getGateInfo(gate);
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
      </div>
    </div>
  `;
}

function renderListView() {
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
        ${applyBtn}
      </div>
    </div>
  `;
}

const ACTION_LABELS = {
  complete_task: "작업 완료", approve_task: "승인", reject_task: "반려",
  restart_task: "재작업 시작", create_task: "작업 생성", assign_task: "담당자 지정",
  add_comment: "코멘트 작성", upload_file: "파일 업로드",
};

function renderRecentActivity() {
  // Prefer real activity logs; fall back to checklistItems
  if (activityLogs.length > 0) {
    return `
      <div class="timeline">
        ${activityLogs.slice(0, 15).map(log => {
          const label = ACTION_LABELS[log.action] || log.action;
          const actor = log.actorName || log.userName || "";
          const ts = log.timestamp ? timeAgo(log.timestamp) : "";
          return `
            <div class="timeline-item" style="padding-bottom:0.625rem;">
              <div class="timeline-dot ${log.action?.includes("complete") || log.action?.includes("approve") ? "completed" : "active"}"></div>
              <div>
                <div style="font-size:0.75rem;font-weight:500;color:var(--slate-200);">${escapeHtml(actor)} 님이 ${escapeHtml(label)}</div>
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
    return `<div style="padding:1.5rem;text-align:center;font-size:0.75rem;color:var(--slate-400);">최근 활동이 없습니다</div>`;
  }

  return `
    <div class="timeline">
      ${recentItems.map(item => {
        const isCompleted = item.status === "completed";
        return `
          <div class="timeline-item" style="padding-bottom:0.625rem;">
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

  // Phase bars
  const phaseDuration = totalDays / 6;

  return `
    <div class="card p-5">
      <h3 style="font-size:0.9rem;font-weight:600;color:var(--slate-200);margin-bottom:1rem;">프로젝트 스케줄</h3>

      <!-- Timeline header -->
      <div style="position:relative;margin-bottom:0.5rem;padding-left:100px;">
        <div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--slate-400);">
          <span>${formatDate(projectStart)}</span>
          <span>${formatDate(projectEnd)}</span>
        </div>
      </div>

      <!-- Gantt rows -->
      <div style="position:relative;">
        ${getActivePhaseGroups().map((phase, idx) => {
          const progress = getPhaseWorkProgress(phase.name);
          const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
          const startPct = (idx * phaseDuration / totalDays) * 100;
          const widthPct = (phaseDuration / totalDays) * 100;
          const gateStatus = getPhaseGateStatus(phase.name);

          const barColor = pct === 100 ? "var(--success-500)" :
                           progress.overdue > 0 ? "var(--danger-500)" :
                           pct > 0 ? "var(--primary-500)" : "var(--surface-4)";

          return `
            <div style="display:flex;align-items:center;margin-bottom:0.375rem;">
              <div style="width:100px;flex-shrink:0;font-size:0.7rem;font-weight:500;color:var(--slate-300);padding-right:0.5rem;">${phase.name}</div>
              <div style="flex:1;position:relative;height:28px;background:var(--surface-2);border-radius:var(--radius-sm);overflow:hidden;">
                <!-- Phase bar background -->
                <div style="position:absolute;left:${startPct}%;width:${widthPct}%;height:100%;background:rgba(100,116,139,0.15);"></div>
                <!-- Progress fill -->
                <div style="position:absolute;left:${startPct}%;width:${widthPct * pct / 100}%;height:100%;background:${barColor};opacity:0.7;transition:width 0.3s;"></div>
                <!-- Label -->
                <div style="position:absolute;left:${startPct + 0.5}%;top:50%;transform:translateY(-50%);font-size:0.6rem;color:white;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,0.5);z-index:1;white-space:nowrap;">
                  ${pct}%${progress.overdue > 0 ? ` (${progress.overdue}건 지연)` : ""}
                </div>
                <!-- Gate status indicator -->
                <div style="position:absolute;right:${100 - startPct - widthPct + 0.5}%;top:50%;transform:translateY(-50%);font-size:0.65rem;z-index:1;" title="${phase.gateStage}">
                  ${gateStatus === "approved" ? "✅" : gateStatus === "rejected" ? "❌" : gateStatus === "pending" ? "⏳" : ""}
                </div>
              </div>
            </div>
          `;
        }).join("")}

        <!-- Today marker -->
        ${todayPct > 0 && todayPct < 100 ? `
          <div style="position:absolute;left:calc(100px + ${todayPct}% * (100% - 100px) / 100%);left:calc(100px + ${todayPct / 100 * (100)}%);top:0;bottom:0;width:2px;background:var(--danger-400);z-index:2;pointer-events:none;">
            <div style="position:absolute;top:-16px;left:-12px;font-size:0.55rem;color:var(--danger-400);font-weight:600;white-space:nowrap;">오늘</div>
          </div>
        ` : ""}
      </div>

      <!-- Legend -->
      <div style="display:flex;gap:1rem;margin-top:1rem;font-size:0.6rem;color:var(--slate-400);flex-wrap:wrap;">
        <span style="display:flex;align-items:center;gap:0.25rem;"><span style="width:10px;height:10px;border-radius:2px;background:var(--success-500);"></span> 완료</span>
        <span style="display:flex;align-items:center;gap:0.25rem;"><span style="width:10px;height:10px;border-radius:2px;background:var(--primary-500);"></span> 진행중</span>
        <span style="display:flex;align-items:center;gap:0.25rem;"><span style="width:10px;height:10px;border-radius:2px;background:var(--danger-500);"></span> 지연</span>
        <span style="display:flex;align-items:center;gap:0.25rem;">✅ 완료</span>
      </div>
    </div>

    <!-- Phase Detail Table -->
    <div class="card p-5" style="margin-top:1rem;">
      <h3 style="font-size:0.9rem;font-weight:600;color:var(--slate-200);margin-bottom:0.75rem;">단계별 상세</h3>
      <div class="table-responsive">
        <table class="data-table" style="font-size:0.75rem;">
          <thead>
            <tr>
              <th>단계</th>
              <th>전체</th>
              <th>완료</th>
              <th>진행중</th>
              <th>대기</th>
              <th>지연</th>
              <th>승인위원회</th>
            </tr>
          </thead>
          <tbody>
            ${getActivePhaseGroups().map(phase => {
              const prog = getPhaseWorkProgress(phase.name);
              const gs = getPhaseGateStatus(phase.name);
              const gsLabel = { approved: "✓ 승인", rejected: "✗ 반려", pending: "⏳ 대기", not_reached: "— 미도달", none: "-" }[gs];
              const gsColor = { approved: "var(--success-400)", rejected: "var(--danger-400)", pending: "var(--warning-400)", not_reached: "var(--slate-400)", none: "var(--slate-400)" }[gs];
              return `
                <tr>
                  <td style="font-weight:600;color:var(--slate-200);">${phase.name}</td>
                  <td>${prog.total}</td>
                  <td style="color:var(--success-400);">${prog.completed}</td>
                  <td style="color:var(--primary-400);">${prog.inProgress}</td>
                  <td>${prog.pending}</td>
                  <td style="color:${prog.overdue > 0 ? "var(--danger-400)" : "inherit"};font-weight:${prog.overdue > 0 ? "600" : "normal"};">${prog.overdue}</td>
                  <td style="color:${gsColor};font-weight:500;">${gsLabel}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =============================================================================
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
                <div class="card-hover pd-task-row" data-task-id="${t.id}" style="padding:0.5rem 0.75rem;border-bottom:1px solid var(--surface-3);border-left:3px solid var(--danger-400);cursor:pointer;">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                      <div style="font-size:0.75rem;font-weight:500;color:var(--slate-200);">${escapeHtml(t.title)}</div>
                      <div style="font-size:0.6rem;color:var(--slate-400);margin-top:0.125rem;">
                        ${escapeHtml(t.assignee || "미배정")} · ${formatStageName(t.stage)} · 마감 ${formatDate(t.dueDate)}
                      </div>
                    </div>
                    <div style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;font-weight:700;color:var(--danger-400);flex-shrink:0;">D+${dd}</div>
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

  // Inline gate approval/rejection buttons (위원회 승인)
  app.querySelectorAll("[data-inline-gate]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.inlineGate);
      const action = btn.dataset.gateAction;
      const phases = getActivePhaseGroups();
      const phase = phases[idx];
      if (!phase) return;
      const phaseId = `phase${idx}`;
      try {
        btn.disabled = true;
        await updateGateRecord(projectId, phaseId, phase.name, action, user?.name || "");
        showToast("success", action === "approved" ? "승인 완료" : action === "rejected" ? "반려 처리" : "초기화 완료");
      } catch (err) {
        showToast("error", "처리 실패: " + err.message);
        btn.disabled = false;
      }
    });
  });

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
  const quickAddInput = app.querySelector("#quick-add-input");
  if (quickAddInput) quickAddInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleQuickAdd(); });
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
      if (newStatus === prevStatus) return; // no change
      try {
        sel.disabled = true;
        if (newStatus === "completed") {
          // Use completeTask for proper stats recalculation
          const { completeTask } = await import("../firestore-service.js");
          await completeTask(itemId);
        } else {
          await updateChecklistItemStatus(itemId, newStatus);
        }
        sel.dataset.current = newStatus;
        showToast("success", `상태가 '${newStatus === "pending" ? "대기" : newStatus === "in_progress" ? "진행" : "완료"}'(으)로 변경되었습니다.`);
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
      } catch (err) {
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
            } catch (err) {
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
      const headers = ["제목", "단계", "부서", "담당자", "상태", "마감일", "승인상태"];
      const data = checklistItems.map(t => [
        t.title, t.stage, t.department, t.assignee || "", getStatusLabel(t.status),
        formatDate(t.dueDate)
      ]);
      exportToCSV(data, headers, `${project.name}_체크리스트.csv`);
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
  const printBtn = app.querySelector("#print-btn");
  if (printBtn) printBtn.addEventListener("click", () => window.print());

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
  const filesHtml = files.length > 0
    ? files.map(f => `<div class="peek-file-item">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
        <span>${escapeHtml(f.name || f)}</span>
      </div>`).join("")
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

  // File input (store filenames only since Firebase Storage not connected)
  const fileInput = document.getElementById("peek-file-input");
  if (fileInput) {
    fileInput.addEventListener("change", async () => {
      const fileNames = [...fileInput.files].map(f => ({ name: f.name, size: f.size, addedAt: new Date().toISOString() }));
      const existing = task.attachments || [];
      const merged = [...existing, ...fileNames];
      try {
        await updateChecklistItem(task.id, { attachments: merged });
        showToast(`${fileNames.length}개 파일 기록 저장`, "success");
        // Update display
        const filesDiv = document.getElementById("peek-files");
        if (filesDiv) {
          filesDiv.innerHTML = merged.map(f => `<div class="peek-file-item">
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
            <span>${escapeHtml(f.name || f)}</span>
          </div>`).join("");
        }
      } catch (e) {
        showToast("파일 저장 실패", "error");
      }
    });
  }
}

// ─── Quick Add Task (NLP Parsing + Smart Assignee) ──────────────────────────

function parseQuickInput(text) {
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
    const changeScale = project?.changeScale || "major";
    const count = await applyTemplateToProject(projectId, projectType, changeScale);
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
    const changeScale = project?.changeScale || "major";
    const endDate = project?.endDate || new Date();
    const count = await applyLaunchChecklistToProject(projectId, projectType, changeScale, endDate);
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
        ${gr?.approvedBy ? `<div class="gate-meta">승인자: ${escapeHtml(gr.approvedBy)} · ${gr.approvedAt ? new Date(gr.approvedAt).toLocaleDateString("ko-KR") : ""}</div>` : ""}
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
          ${notes.length === 0 ? '<p class="gate-empty">등록된 회의록이 없습니다</p>' :
            notes.map(n => `
              <div class="gate-note">
                <div class="gate-note-header">
                  <span class="gate-note-author">${escapeHtml(n.author)}</span>
                  <span class="gate-note-date">${n.createdAt ? new Date(n.createdAt).toLocaleDateString("ko-KR") : ""}</span>
                </div>
                <div class="gate-note-content">${escapeHtml(n.content)}</div>
              </div>
            `).join("")
          }
        </div>
        <div class="gate-note-form">
          <textarea class="gate-note-input" placeholder="회의 내용, 피드백, 결정 사항 등을 기록하세요..." rows="3"></textarea>
          <button class="btn-primary btn-sm gate-note-submit">등록</button>
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
          await updateGateRecord(projectId, phaseId, phase.name, action, user?.name || "");
          showToast("success", action === "approved" ? "승인 완료" : action === "rejected" ? "반려 처리" : "초기화 완료");
          // 패널 갱신 (gateRecords 구독이 자동으로 render() 호출 → 하지만 패널은 수동 갱신)
          setTimeout(() => openPhasePanel(phase, phaseIdx), 300);
        } catch (err) {
          showToast("error", "처리 실패: " + err.message);
        }
      });
    });

    // 회의록 등록
    const submitBtn = panel.querySelector(".gate-note-submit");
    const textarea = panel.querySelector(".gate-note-input");
    if (submitBtn && textarea) {
      submitBtn.addEventListener("click", async () => {
        const content = textarea.value.trim();
        if (!content) { showToast("warning", "내용을 입력해주세요"); return; }
        try {
          submitBtn.disabled = true;
          submitBtn.textContent = "등록 중...";
          await addGateMeetingNote(projectId, phaseId, phase.name, user?.name || "익명", content);
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
  const input = document.getElementById("quick-add-input");
  if (!input || !input.value.trim()) return;
  const parsed = parseQuickInput(input.value);
  if (!parsed.title) { showToast('warning', "작업 내용을 입력해주세요"); return; }
  if (!parsed.department) parsed.department = user.department || departments[0];
  if (!parsed.assignee) {
    const suggestions = getSmartAssigneeSuggestions(parsed.department);
    parsed.assignee = suggestions.length > 0 ? suggestions[0].name : user.name;
  }
  if (!parsed.dueDate) parsed.dueDate = new Date(Date.now() + 14 * 86400000);
  isCreating = true;
  const btn = document.getElementById("quick-add-btn");
  if (btn) btn.disabled = true;
  try {
    await createChecklistItem({ projectId, title: parsed.title, assignee: parsed.assignee, department: parsed.department, stage: parsed.stage, importance: parsed.importance, dueDate: parsed.dueDate, status: "pending", source: "manual" });
    input.value = "";
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
