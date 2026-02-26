// =============================================================================
// Project Detail Page — 4-tab project view
// =============================================================================

import { guardPage } from "../auth.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
initTheme();
import {
  subscribeProjects,
  subscribeChecklistItems,
  subscribeChangeRequests,
  bulkApproveTasks,
  bulkUpdateAssignee,
  getUsers,
  createChecklistItem,
} from "../firestore-service.js";
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
  getFileIcon,
  formatFileSize,
} from "../utils.js";

// --- Auth guard ---
const user = guardPage();
if (!user) throw new Error("Not authenticated");

// --- Get project ID from URL ---
const projectId = getQueryParam("id");
if (!projectId) {
  window.location.href = "projects.html";
  throw new Error("No project ID");
}

// --- DOM refs ---
const navRoot = document.getElementById("nav-root");
const app = document.getElementById("app");

// --- State ---
let project = null;
let checklistItems = [];
let changeRequests = [];
let activeTab = "overview";
let selectedStage = "";
let selectedDepartment = "";
let checklistFilter = ""; // "" | "in_progress" | "delayed" | "manager_pending" | "committee_pending"
let selectedTaskIds = new Set();
let allUsers = [];

// --- Render nav ---
const unsubNav = renderNav(navRoot);

// --- Load users ---
getUsers().then(u => { allUsers = u; });

// --- Subscriptions ---
const unsubs = [];

unsubs.push(
  subscribeProjects((projects) => {
    project = projects.find((p) => p.id === projectId) || null;
    render();
  })
);

unsubs.push(
  subscribeChecklistItems(projectId, (items) => {
    checklistItems = items;
    render();
  })
);

unsubs.push(
  subscribeChangeRequests(projectId, (reqs) => {
    changeRequests = reqs;
    render();
  })
);

// --- Cleanup ---
window.addEventListener("beforeunload", () => {
  unsubs.forEach((fn) => fn && fn());
  if (unsubNav) unsubNav();
});

// =============================================================================
// Helper functions
// =============================================================================

function getMatrixCellData(stage, dept) {
  const items = checklistItems.filter(
    (t) => t.stage === stage && t.department === dept
  );
  if (items.length === 0) return { status: "none", count: 0, total: 0 };

  const total = items.length;
  const completed = items.filter((t) => t.status === "completed").length;
  const inProgress = items.filter((t) => t.status === "in_progress").length;

  if (completed === total) return { status: "completed", count: completed, total };
  if (inProgress > 0) return { status: "in_progress", count: completed, total };
  return { status: "pending", count: completed, total };
}

function getDepartmentProgress(dept) {
  const items = checklistItems.filter((t) => t.department === dept);
  if (items.length === 0) return 0;
  const completed = items.filter((t) => t.status === "completed").length;
  return Math.round((completed / items.length) * 100);
}

function getStageProgress(stage) {
  const items = checklistItems.filter((t) => t.stage === stage);
  if (items.length === 0) return 0;
  const completed = items.filter((t) => t.status === "completed").length;
  return Math.round((completed / items.length) * 100);
}

function getMatrixCellColor(status) {
  switch (status) {
    case "completed":
      return "var(--success-500)";
    case "in_progress":
      return "var(--primary-500)";
    case "pending":
      return "var(--surface-4)";
    default:
      return "var(--surface-3)";
  }
}

function getScaleLabel(scale) {
  switch (scale) {
    case "major":
      return "대규모";
    case "medium":
      return "중간";
    case "minor":
      return "경미";
    default:
      return scale;
  }
}

function getScaleBadgeClass(scale) {
  switch (scale) {
    case "major":
      return "badge-danger";
    case "medium":
      return "badge-warning";
    case "minor":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

function getChangeStatusLabel(status) {
  switch (status) {
    case "in_review":
      return "검토 중";
    case "approved":
      return "승인";
    case "rejected":
      return "반려";
    default:
      return status;
  }
}

function getChangeStatusBadgeClass(status) {
  switch (status) {
    case "in_review":
      return "badge-warning";
    case "approved":
      return "badge-success";
    case "rejected":
      return "badge-danger";
    default:
      return "badge-neutral";
  }
}

function getDueDateColor(dueDate) {
  const days = daysUntil(dueDate);
  if (days === null) return "";
  if (days < 0) return "color: var(--danger-400);";
  if (days === 0) return "color: var(--danger-400);";
  if (days <= 2) return "color: var(--warning-400);";
  return "color: var(--slate-400);";
}

function getDueDateLabel(dueDate) {
  const days = daysUntil(dueDate);
  if (days === null) return "";
  if (days < 0) return `D+${Math.abs(days)} (지연)`;
  if (days === 0) return "D-Day (오늘)";
  return `D-${days}`;
}

// =============================================================================
// Main render
// =============================================================================

function render() {
  if (!project) {
    app.innerHTML = renderSpinner("프로젝트를 불러오는 중...");
    return;
  }

  // Phase-based index
  const phaseIndex = PHASE_GROUPS.findIndex(
    (p) => p.workStage === project.currentStage || p.gateStage === project.currentStage
  );
  const riskClass = getRiskClass(project.riskLevel);

  const totalTasks = checklistItems.length;
  const inProgressTasks = checklistItems.filter(
    (t) => t.status === "in_progress"
  ).length;
  const delayedTasks = checklistItems.filter((t) => {
    if (t.status === "completed") return false;
    const days = daysUntil(t.dueDate);
    return days !== null && days < 0;
  }).length;
  // Manager approval pending: work stage tasks completed, awaiting approval
  const managerPending = checklistItems.filter(
    (t) => !GATE_STAGES.includes(t.stage) && t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending")
  ).length;
  // Committee approval pending: gate stage tasks completed, awaiting approval
  const committeePending = checklistItems.filter(
    (t) => GATE_STAGES.includes(t.stage) && t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending")
  ).length;

  app.innerHTML = `
    <div class="container" style="padding-bottom: 3rem;">
      <!-- Project Header Card -->
      ${renderProjectHeader(riskClass, phaseIndex, totalTasks)}

      <!-- Tabs -->
      <div class="tab-bar mb-4" style="margin-top: 1.5rem;">
        <button class="tab-btn${activeTab === "overview" ? " active" : ""}" data-tab="overview">개요</button>
        <button class="tab-btn${activeTab === "checklist" ? " active" : ""}" data-tab="checklist">체크리스트</button>
        <button class="tab-btn${activeTab === "files" ? " active" : ""}" data-tab="files">파일</button>
        <button class="tab-btn${activeTab === "changes" ? " active" : ""}" data-tab="changes">설계 변경</button>
      </div>

      <!-- Tab Content -->
      <div class="animate-fade-in">
        ${activeTab === "overview" ? renderOverviewTab(totalTasks, inProgressTasks, delayedTasks, managerPending, committeePending) : ""}
        ${activeTab === "checklist" ? renderChecklistTab() : ""}
        ${activeTab === "files" ? renderFilesTab() : ""}
        ${activeTab === "changes" ? renderChangesTab() : ""}
      </div>
    </div>
  `;

  bindEvents();
}

// =============================================================================
// Project Header
// =============================================================================

function renderProjectHeader(riskClass, phaseIndex, totalTasks) {
  const p = project;
  const currentPhaseName = phaseIndex >= 0 ? PHASE_GROUPS[phaseIndex].name : formatStageName(p.currentStage);
  return `
    <div class="card p-6 animate-fade-in">
      <div class="flex flex-wrap gap-6" style="justify-content: space-between; align-items: flex-start;">
        <!-- Left: Project Info -->
        <div style="flex: 1; min-width: 240px;">
          <div class="flex items-center gap-3 mb-3">
            <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100);">
              ${escapeHtml(p.name)}
            </h1>
            <span class="risk-dot ${p.riskLevel}" data-tooltip="${getRiskLabel(p.riskLevel)}"></span>
          </div>
          <div class="flex flex-wrap gap-4 text-sm" style="color: var(--slate-400);">
            <span>제품: <strong style="color: var(--slate-200);">${escapeHtml(p.productType)}</strong></span>
            <span>PM: <strong style="color: var(--slate-200);">${escapeHtml(p.pm)}</strong></span>
            <span>${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}</span>
          </div>
          <!-- Current Phase -->
          <div style="margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: var(--radius-lg);">
            <svg width="14" height="14" fill="none" stroke="var(--primary-400)" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span class="text-sm font-semibold" style="color: var(--primary-300);">현재 단계: ${currentPhaseName}</span>
          </div>
          <!-- Export Buttons -->
          <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
            <button class="btn-ghost btn-sm" id="export-csv-btn" style="font-size:0.75rem;">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:0.25rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>CSV 내보내기
            </button>
            <button class="btn-ghost btn-sm" id="export-pdf-btn" style="font-size:0.75rem;">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:0.25rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>PDF 보고서
            </button>
          </div>
        </div>
        <!-- Right: Progress -->
        <div style="text-align: center; min-width: 140px;">
          <div class="stat-value glow-text" style="font-size: 3rem; color: var(--primary-400);">${p.progress}%</div>
          <div class="text-xs text-dim" style="margin-top: 0.25rem;">전체 진행률</div>
          <div class="progress-bar" style="margin-top: 0.75rem; height: 0.5rem; width: 10rem;">
            <div class="progress-fill ${getProgressClass(p.progress)}" style="width: ${p.progress}%;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// Tab 1: Overview (개요)
// =============================================================================

function renderOverviewTab(totalTasks, inProgressTasks, delayedTasks, managerPending, committeePending) {
  return `
    <!-- Stat Cards (clickable, 5 cards) -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      <div class="stat-card cursor-pointer card-hover" data-stat-filter="">
        <div class="stat-card-label">전체 작업</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: var(--slate-100);">${totalTasks}</div>
        </div>
      </div>
      <div class="stat-card cursor-pointer card-hover" data-stat-filter="in_progress">
        <div class="stat-card-label">진행 중</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: var(--primary-400);">${inProgressTasks}</div>
        </div>
      </div>
      <div class="stat-card cursor-pointer card-hover" data-stat-filter="delayed">
        <div class="stat-card-label">지연</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: ${delayedTasks > 0 ? "var(--danger-400)" : "var(--slate-100)"};">${delayedTasks}</div>
        </div>
      </div>
      <div class="stat-card cursor-pointer card-hover" data-stat-filter="manager_pending">
        <div class="stat-card-label">매니저 승인 대기</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: var(--warning-400);">${managerPending}</div>
        </div>
      </div>
      <div class="stat-card cursor-pointer card-hover" data-stat-filter="committee_pending">
        <div class="stat-card-label">위원회 승인 대기</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: var(--warning-400);">${committeePending}</div>
        </div>
      </div>
    </div>

    <!-- Project Status Summary Card -->
    ${renderSummaryCard()}

    <!-- Recent Activity -->
    <div class="card p-5">
      <h3 class="section-title mb-4">최근 활동</h3>
      ${renderRecentActivity()}
    </div>
  `;
}

function renderSummaryCard() {
  const p = project;
  const phaseIndex = PHASE_GROUPS.findIndex(
    (ph) => ph.workStage === p.currentStage || ph.gateStage === p.currentStage
  );
  const currentPhase = phaseIndex >= 0 ? PHASE_GROUPS[phaseIndex] : null;
  const isGateStage = currentPhase && GATE_STAGES.includes(p.currentStage);

  // D-day calculation
  const endDate = p.endDate ? new Date(p.endDate) : null;
  const dDays = endDate ? daysUntil(endDate) : null;
  const dDayLabel = dDays !== null ? (dDays < 0 ? `D+${Math.abs(dDays)} (지연)` : dDays === 0 ? "D-Day (오늘)" : `D-${dDays}`) : "-";

  // Plan deviation: divide total project duration into 6 equal parts
  const startDate = p.startDate ? new Date(p.startDate) : null;
  let deviationLabel = "";
  let deviationColor = "var(--success-400)";
  if (startDate && endDate && phaseIndex >= 0) {
    const totalMs = endDate.getTime() - startDate.getTime();
    const elapsedMs = Date.now() - startDate.getTime();
    const expectedPhase = Math.min(5, Math.floor((elapsedMs / totalMs) * 6));
    const diff = phaseIndex - expectedPhase;
    if (diff >= 1) {
      deviationLabel = "앞서감";
      deviationColor = "var(--success-400)";
    } else if (diff === 0) {
      deviationLabel = "정상";
      deviationColor = "var(--success-400)";
    } else if (diff === -1) {
      deviationLabel = "약간 지연";
      deviationColor = "var(--warning-400)";
    } else {
      deviationLabel = "심각 지연";
      deviationColor = "var(--danger-400)";
    }
  }

  // Bottleneck: in current phase, find departments with pending/in_progress tasks
  const bottlenecks = [];
  const deptCounts = {};
  if (currentPhase) {
    const phaseStages = [currentPhase.workStage, currentPhase.gateStage];
    const phaseTasks = checklistItems.filter(t => phaseStages.includes(t.stage) && t.status !== "completed");
    for (const t of phaseTasks) {
      if (!deptCounts[t.department]) deptCounts[t.department] = { inProgress: 0, pending: 0, inProgressDetails: [], pendingDetails: [] };
      if (t.status === "in_progress") {
        deptCounts[t.department].inProgress++;
        deptCounts[t.department].inProgressDetails.push(t.title || t.content || "작업");
      } else if (t.status === "pending") {
        deptCounts[t.department].pending++;
        deptCounts[t.department].pendingDetails.push(t.title || t.content || "작업");
      }
    }
    for (const [dept, counts] of Object.entries(deptCounts)) {
      const parts = [];
      if (counts.inProgress > 0) parts.push(`${counts.inProgress}건 진행중`);
      if (counts.pending > 0) parts.push(`${counts.pending}건 대기`);
      bottlenecks.push(`${dept} ${parts.join(", ")}`);
    }
  }

  // Build bottleneck table HTML
  const deptEntries = Object.entries(deptCounts);
  const hasBottleneckData = deptEntries.length > 0;
  const bottleneckTableHtml = hasBottleneckData ? `
    <div style="flex:1;min-width:0;overflow-x:auto">
      <table class="bottleneck-table">
        <thead>
          <tr>
            <th></th>
            ${deptEntries.map(([dept]) => `<th><span class="bottleneck-dept-label">${dept}</span></th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bottleneck-row-label">진행중(건)</td>
            ${deptEntries.map(([dept, c]) => {
              const val = c.inProgress || 0;
              const tooltip = c.inProgressDetails.length > 0 ? c.inProgressDetails.join("\\n") : "";
              return `<td class="bottleneck-cell${val > 0 ? " has-value" : ""}" ${tooltip ? `data-tooltip="${tooltip.replace(/"/g, '&quot;')}"` : ""}>${val > 0 ? val : "-"}</td>`;
            }).join("")}
          </tr>
          <tr>
            <td class="bottleneck-row-label">대기(건)</td>
            ${deptEntries.map(([dept, c]) => {
              const val = c.pending || 0;
              const tooltip = c.pendingDetails.length > 0 ? c.pendingDetails.join("\\n") : "";
              return `<td class="bottleneck-cell${val > 0 ? " has-value" : ""}" ${tooltip ? `data-tooltip="${tooltip.replace(/"/g, '&quot;')}"` : ""}>${val > 0 ? val : "-"}</td>`;
            }).join("")}
          </tr>
        </tbody>
      </table>
    </div>
  ` : "";

  return `
    <div class="card p-5 mb-6">
      <h3 class="section-title mb-4">프로젝트 상태 요약</h3>

      <!-- Current Phase -->
      <div class="flex items-center gap-2 mb-4">
        <svg width="16" height="16" fill="none" stroke="var(--primary-400)" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <span class="text-base font-semibold" style="color:var(--primary-300)">${currentPhase ? currentPhase.name : "-"}</span>
        <span class="text-sm text-soft">(${isGateStage ? "승인 위원회 진행 중" : "작업 진행 중"})</span>
      </div>

      <!-- Phase Progress Bar -->
      <div class="flex items-center gap-1 mb-4" style="flex-wrap:wrap">
        ${PHASE_GROUPS.map((ph, idx) => {
          const isCompleted = idx < phaseIndex;
          const isCurrent = idx === phaseIndex;
          const isFuture = idx > phaseIndex;
          const bg = isCompleted ? "var(--success-500)" : isCurrent ? "var(--primary-500)" : "var(--surface-4)";
          const textColor = isCompleted ? "white" : isCurrent ? "white" : "var(--slate-500)";
          return `
            <div style="display:flex;align-items:center;gap:0.25rem">
              <div style="padding:0.25rem 0.625rem;border-radius:var(--radius-lg);background:${bg};color:${textColor};font-size:0.75rem;font-weight:600;white-space:nowrap">
                ${isCompleted ? "✔ " : isCurrent ? "▶ " : ""}${ph.name}
              </div>
              ${idx < PHASE_GROUPS.length - 1 ? '<span style="color:var(--slate-600);font-size:0.75rem">→</span>' : ""}
            </div>
          `;
        }).join("")}
      </div>

      <!-- Deadline + Plan Deviation + Bottleneck Table (2-column) -->
      <div style="display:flex;gap:1.5rem;margin-bottom:1rem;align-items:flex-start;flex-wrap:wrap">
        <!-- Left: Deadline + Deviation -->
        <div style="flex-shrink:0;min-width:140px">
          <div class="mb-3">
            <div class="text-xs text-dim mb-1">마감일</div>
            <div class="text-sm font-semibold" style="color:var(--slate-200)">${formatDate(p.endDate)}</div>
            <div class="text-xs font-mono" style="color:${dDays !== null && dDays < 0 ? "var(--danger-400)" : "var(--primary-400)"}">${dDayLabel}</div>
          </div>
          <div>
            <div class="text-xs text-dim mb-1">계획 대비</div>
            <div class="text-sm font-semibold" style="color:${deviationColor}">${deviationLabel || "-"}</div>
            <div class="text-xs text-soft">현재 ${currentPhase ? currentPhase.name : "-"} (${phaseIndex + 1}/6 phase)</div>
          </div>
        </div>

        <!-- Right: Bottleneck Table -->
        ${bottleneckTableHtml}
      </div>

      <!-- Bottleneck Text Summary -->
      ${bottlenecks.length > 0 ? `
        <div style="padding:0.75rem 1rem;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:var(--radius-lg)">
          <div class="text-xs font-semibold mb-1" style="color:var(--warning-400)">병목</div>
          <div class="text-sm" style="color:var(--slate-300)">${bottlenecks.join(" / ")}</div>
        </div>
      ` : `
        <div style="padding:0.75rem 1rem;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:var(--radius-lg)">
          <div class="text-xs font-semibold" style="color:var(--success-400)">병목 없음 — 원활하게 진행 중</div>
        </div>
      `}
    </div>
  `;
}

function renderRecentActivity() {
  const recentItems = checklistItems
    .filter((t) => t.status === "completed" || t.status === "in_progress")
    .sort((a, b) => {
      const dateA = a.completedDate || a.dueDate;
      const dateB = b.completedDate || b.dueDate;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })
    .slice(0, 5);

  if (recentItems.length === 0) {
    return `
      <div class="empty-state" style="padding: 2rem;">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="empty-state-text">최근 활동이 없습니다</span>
      </div>
    `;
  }

  return `
    <div class="timeline">
      ${recentItems
        .map((item) => {
          const isCompleted = item.status === "completed";
          return `
            <div class="timeline-item">
              <div class="timeline-dot ${isCompleted ? "completed" : "active"}"></div>
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="badge ${getStatusBadgeClass(item.status)}">${getStatusLabel(item.status)}</span>
                  <span class="text-xs text-dim">${escapeHtml(item.department)}</span>
                </div>
                <div class="text-sm font-medium" style="color: var(--slate-200);">${escapeHtml(item.title)}</div>
                <div class="text-xs text-dim" style="margin-top: 0.25rem;">
                  ${formatStageName(item.stage)} &middot; ${escapeHtml(item.assignee || "")} &middot; ${isCompleted && item.completedDate ? timeAgo(item.completedDate) : formatDate(item.dueDate)}
                </div>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

// =============================================================================
// Tab 2: Checklist (체크리스트)
// =============================================================================

function renderChecklistTab() {
  return `
    <!-- Matrix (6 phase) -->
    <div class="card p-4 mb-6">
      <h3 class="section-title mb-3">부서 x 페이즈 매트릭스</h3>
      <div class="matrix-table">
        <table>
          <thead>
            <tr>
              <th style="min-width: 100px; text-align: left;">부서</th>
              ${PHASE_GROUPS.map(phase =>
                `<th style="min-width:100px">${phase.name}</th>`
              ).join("")}
            </tr>
          </thead>
          <tbody>
            ${departments.map(dept => `
              <tr>
                <td style="font-size: 0.75rem; font-weight: 500; color: var(--slate-300); white-space: nowrap;">${escapeHtml(dept)}</td>
                ${PHASE_GROUPS.map(phase => {
                  const workCell = getMatrixCellData(phase.workStage, dept);
                  const gateTasks = checklistItems.filter(t => t.stage === phase.gateStage && t.department === dept);
                  let gateStatus = "none";
                  if (gateTasks.length > 0) {
                    if (gateTasks.some(t => t.approvalStatus === "rejected" || t.status === "rejected")) gateStatus = "rejected";
                    else if (gateTasks.every(t => t.approvalStatus === "approved")) gateStatus = "approved";
                    else if (gateTasks.every(t => t.status === "completed")) gateStatus = "pending";
                  }
                  const gateInfo = { approved: { s: "✓", c: "var(--success-400)", bg: "rgba(34,197,94,0.15)" }, rejected: { s: "✗", c: "var(--danger-400)", bg: "rgba(239,68,68,0.15)" }, pending: { s: "⏳", c: "var(--warning-400)", bg: "rgba(245,158,11,0.15)" }, none: { s: "—", c: "var(--slate-600)", bg: "var(--surface-3)" } }[gateStatus];
                  const hasWork = workCell.total > 0;
                  const workColor = workCell.status === "completed" ? "var(--success-400)" : workCell.status === "in_progress" ? "var(--primary-400)" : hasWork ? "var(--slate-500)" : "var(--slate-600)";

                  return `<td class="matrix-cell" data-matrix-phase="${phase.name}" data-matrix-dept="${dept}" style="padding: 0.375rem;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:0.375rem">
                      <span style="display:inline-flex;align-items:center;justify-content:center;width:1.5rem;height:1.5rem;border-radius:50%;border:2px solid ${workColor};font-size:0.55rem;color:${workColor};font-weight:700;font-family:'JetBrains Mono',monospace">${hasWork ? `${workCell.count}/${workCell.total}` : "-"}</span>
                      <span style="display:inline-flex;align-items:center;justify-content:center;width:1.5rem;height:1.5rem;border-radius:50%;background:${gateInfo.bg};font-size:0.6rem;color:${gateInfo.c};font-weight:700">${gateInfo.s}</span>
                    </div>
                  </td>`;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Quick Add Task Bar -->
    <div class="quick-add-bar" style="margin-bottom:16px;display:flex;gap:8px;align-items:stretch">
      <input type="text" id="quick-add-input" class="input-field" style="flex:1;font-size:0.85rem"
        placeholder="빠른 입력: @담당자 #부서 !긴급 작업 내용 ~마감일 (예: @김철수 #개발팀 WM 도면 검토 ~2026-03-15)">
      <button class="btn-primary btn-sm" id="quick-add-btn" style="white-space:nowrap;padding:0.5rem 1rem">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="display:inline;vertical-align:-2px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        추가
      </button>
      <button class="btn-secondary btn-sm" id="open-add-modal-btn" style="white-space:nowrap;padding:0.5rem 0.75rem" title="상세 입력">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
      </button>
    </div>

    <!-- Filters (phase-based) -->
    <div class="flex flex-wrap gap-3 mb-4">
      <select class="input-field" style="width: auto; min-width: 160px;" id="filter-stage">
        <option value="">전체 단계</option>
        ${PHASE_GROUPS.map(phase =>
          `<option value="${phase.name}" ${selectedStage === phase.workStage || selectedStage === phase.gateStage ? "selected" : ""}>${phase.name}</option>`
        ).join("")}
      </select>
      <select class="input-field" style="width: auto; min-width: 140px;" id="filter-dept">
        <option value="">전체 부서</option>
        ${departments
          .map(
            (d) =>
              `<option value="${d}" ${selectedDepartment === d ? "selected" : ""}>${escapeHtml(d)}</option>`
          )
          .join("")}
      </select>
    </div>

    <!-- Select All -->
    <div class="flex items-center gap-3 mb-3">
      <label class="flex items-center gap-2 text-sm" style="color:var(--slate-300)">
        <input type="checkbox" id="select-all-tasks"> 전체 선택
      </label>
      <span class="text-xs" style="color:var(--slate-400)" id="selected-count">${selectedTaskIds.size > 0 ? `(${selectedTaskIds.size}개 선택)` : ""}</span>
    </div>

    <!-- Task List grouped by department -->
    ${renderTaskList()}

    <!-- Floating Bulk Action Bar -->
    <div id="bulk-action-bar" class="card p-3 flex items-center gap-4" style="display:${selectedTaskIds.size > 0 ? "flex" : "none"};position:sticky;bottom:16px;z-index:10;background:var(--surface-1);border:1px solid var(--primary-400)">
      <span class="text-sm font-semibold" id="bulk-count" style="color:var(--primary-400)">${selectedTaskIds.size}개 선택됨</span>
      <button class="btn-primary btn-sm" id="bulk-approve-btn">일괄 승인</button>
      <button class="btn-secondary btn-sm" id="bulk-assignee-btn">담당자 변경</button>
      <button class="btn-ghost btn-sm" id="bulk-cancel-btn">선택 해제</button>
    </div>
  `;
}

function renderTaskList() {
  let filtered = [...checklistItems];

  // Phase-based stage filter (filter by both work and gate stage of the phase)
  if (selectedStage) {
    const phase = PHASE_GROUPS.find(p => p.name === selectedStage || p.workStage === selectedStage || p.gateStage === selectedStage);
    if (phase) {
      filtered = filtered.filter(t => t.stage === phase.workStage || t.stage === phase.gateStage);
    } else {
      filtered = filtered.filter(t => t.stage === selectedStage);
    }
  }
  if (selectedDepartment) {
    filtered = filtered.filter((t) => t.department === selectedDepartment);
  }

  // Apply checklist filter from stat card click
  if (checklistFilter === "in_progress") {
    filtered = filtered.filter(t => t.status === "in_progress");
  } else if (checklistFilter === "delayed") {
    filtered = filtered.filter(t => {
      if (t.status === "completed") return false;
      const d = daysUntil(t.dueDate);
      return d !== null && d < 0;
    });
  } else if (checklistFilter === "manager_pending") {
    filtered = filtered.filter(t => !GATE_STAGES.includes(t.stage) && t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending"));
  } else if (checklistFilter === "committee_pending") {
    filtered = filtered.filter(t => GATE_STAGES.includes(t.stage) && t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending"));
  }

  if (filtered.length === 0) {
    return `
      <div class="card">
        <div class="empty-state" style="padding: 3rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <span class="empty-state-text">해당하는 작업이 없습니다</span>
        </div>
      </div>
    `;
  }

  // Group by department
  const grouped = {};
  for (const task of filtered) {
    if (!grouped[task.department]) grouped[task.department] = [];
    grouped[task.department].push(task);
  }

  return Object.entries(grouped)
    .map(
      ([dept, tasks]) => `
      <div class="card mb-4">
        <div style="padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--surface-3);">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold" style="color: var(--slate-200);">${escapeHtml(dept)}</span>
            <span class="text-xs text-dim">${tasks.filter((t) => t.status === "completed").length}/${tasks.length} 완료</span>
          </div>
        </div>
        <div>
          ${tasks
            .map(
              (task) => `
              <div class="card-hover" data-task-id="${task.id}" style="border:none; border-bottom: 1px solid var(--surface-3); border-radius: 0; padding: 1rem 1.25rem; cursor: pointer;">
                <div class="flex items-start gap-3">
                  <input type="checkbox" class="task-checkbox" data-task-checkbox="${task.id}" ${selectedTaskIds.has(task.id) ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary-400);flex-shrink:0;margin-top:0.25rem">
                  <div style="flex: 1; min-width: 0;">
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="badge ${getStatusBadgeClass(task.status)}">${getStatusLabel(task.status)}</span>
                      <span class="text-xs text-dim">${formatStageName(task.stage)}</span>
                    </div>
                    <div class="text-sm font-medium" style="color: var(--slate-200); margin-bottom: 0.25rem;">${escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="text-xs text-dim" style="margin-bottom: 0.5rem; line-height: 1.5;">${escapeHtml(task.description)}</div>` : ""}
                    <div class="flex items-center gap-3 text-xs flex-wrap">
                      ${task.assignee ? `<span style="color: var(--slate-400);">담당: <strong style="color: var(--slate-300);">${escapeHtml(task.assignee)}</strong></span>` : ""}
                      ${task.reviewer ? `<span style="color: var(--slate-400);">검토: <strong style="color: var(--slate-300);">${escapeHtml(task.reviewer)}</strong></span>` : ""}
                      <span style="${getDueDateColor(task.dueDate)}">마감: ${formatDate(task.dueDate)} ${task.status !== "completed" ? getDueDateLabel(task.dueDate) : ""}</span>
                    </div>
                  </div>
                  <svg width="16" height="16" fill="none" stroke="var(--slate-500)" viewBox="0 0 24 24" style="flex-shrink: 0; margin-top: 0.25rem;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      </div>
    `
    )
    .join("");
}

// =============================================================================
// Tab 3: Files (파일)
// =============================================================================

function renderFilesTab() {
  // Aggregate files from all checklist items
  const allFiles = [];
  for (const task of checklistItems) {
    if (task.files && task.files.length > 0) {
      for (const f of task.files) {
        allFiles.push({ ...f, taskTitle: task.title, taskId: task.id, department: task.department, stage: task.stage });
      }
    }
  }
  allFiles.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));

  return `
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="section-title">프로젝트 파일 (${allFiles.length})</h3>
        <span class="text-xs text-dim">작업별 업로드된 파일이 여기에 표시됩니다</span>
      </div>

      ${allFiles.length === 0 ? `
        <div class="empty-state" style="padding: 3rem 1rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
          </svg>
          <span class="empty-state-text">업로드된 파일이 없습니다</span>
          <span class="text-xs text-dim" style="margin-top: 0.5rem;">작업 상세에서 파일을 업로드하면 여기에 표시됩니다</span>
        </div>
      ` : `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>작업</th>
                <th>부서</th>
                <th>크기</th>
                <th>업로더</th>
                <th>업로드일</th>
              </tr>
            </thead>
            <tbody>
              ${allFiles.map(f => `
                <tr class="card-hover" style="cursor:pointer" data-file-url="${escapeHtml(f.url || "")}">
                  <td>
                    <div class="flex items-center gap-2">
                      <span>${getFileIcon(f.name)}</span>
                      <span class="text-sm font-medium" style="color:var(--slate-200)">${escapeHtml(f.name)}</span>
                    </div>
                  </td>
                  <td class="text-xs" style="color:var(--slate-400)">${escapeHtml(f.taskTitle)}</td>
                  <td class="text-xs" style="color:var(--slate-400)">${escapeHtml(f.department)}</td>
                  <td class="text-xs text-dim">${formatFileSize(f.size || 0)}</td>
                  <td class="text-xs" style="color:var(--slate-300)">${escapeHtml(f.uploadedBy || "-")}</td>
                  <td class="text-xs text-dim">${f.uploadedAt ? timeAgo(f.uploadedAt) : "-"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// =============================================================================
// Tab 4: Changes (설계 변경)
// =============================================================================

function renderChangesTab() {
  if (changeRequests.length === 0) {
    return `
      <div class="card">
        <div class="empty-state" style="padding: 3rem 1rem;">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span class="empty-state-text">설계 변경 요청이 없습니다</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="flex flex-col gap-4">
      ${changeRequests
        .map(
          (cr) => `
        <div class="card p-5">
          <div class="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="badge ${getScaleBadgeClass(cr.scale)}">${getScaleLabel(cr.scale)}</span>
                <span class="badge ${getChangeStatusBadgeClass(cr.status)}">${getChangeStatusLabel(cr.status)}</span>
              </div>
              <h4 class="text-base font-semibold" style="color: var(--slate-100);">${escapeHtml(cr.title)}</h4>
            </div>
            <div class="text-xs text-dim" style="white-space: nowrap;">${formatDate(cr.requestedAt)}</div>
          </div>

          ${cr.description ? `<p class="text-sm" style="color: var(--slate-400); margin-bottom: 1rem; line-height: 1.6;">${escapeHtml(cr.description)}</p>` : ""}

          <div style="margin-bottom: 1rem;">
            <div class="text-xs font-medium text-dim mb-2">요청부서: ${escapeHtml(cr.requestedBy || "")}</div>
            <div class="text-xs font-medium text-dim mb-2">영향 부서:</div>
            <div class="flex flex-wrap gap-2">
              ${(cr.affectedDepartments || [])
                .map((dept) => {
                  const isRead = cr.readBy && cr.readBy[dept];
                  return `
                    <span class="badge ${isRead ? "badge-success" : "badge-neutral"}" style="gap: 0.25rem;">
                      ${isRead
                        ? '<svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>'
                        : '<svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2"/></svg>'}
                      ${escapeHtml(dept)}
                    </span>
                  `;
                })
                .join("")}
            </div>
          </div>

          ${
            cr.status === "in_review"
              ? `
            <div class="flex gap-2" style="border-top: 1px solid var(--surface-3); padding-top: 1rem;">
              <button class="btn-primary btn-sm" data-approve-cr="${cr.id}">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                승인
              </button>
              <button class="btn-danger btn-sm" data-reject-cr="${cr.id}">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                반려
              </button>
            </div>
          `
              : ""
          }
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// =============================================================================
// Event binding
// =============================================================================

function bindEvents() {
  // Tab switching
  app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      checklistFilter = ""; // reset filter when changing tabs
      render();
    });
  });

  // Quick Add Task
  const quickAddBtn = app.querySelector("#quick-add-btn");
  if (quickAddBtn) {
    quickAddBtn.addEventListener("click", handleQuickAdd);
  }
  const quickAddInput = app.querySelector("#quick-add-input");
  if (quickAddInput) {
    quickAddInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleQuickAdd();
    });
  }
  const openModalBtn = app.querySelector("#open-add-modal-btn");
  if (openModalBtn) {
    openModalBtn.addEventListener("click", showAddTaskModal);
  }

  // Stat card click → switch to checklist tab with filter
  app.querySelectorAll("[data-stat-filter]").forEach((card) => {
    card.addEventListener("click", () => {
      checklistFilter = card.dataset.statFilter;
      activeTab = "checklist";
      selectedStage = "";
      selectedDepartment = "";
      render();
    });
  });

  // Matrix cell click (phase-based)
  app.querySelectorAll("[data-matrix-phase]").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectedStage = cell.dataset.matrixPhase;
      selectedDepartment = cell.dataset.matrixDept;
      checklistFilter = "";
      activeTab = "checklist";
      render();
    });
  });

  // Filter dropdowns
  const stageFilter = app.querySelector("#filter-stage");
  if (stageFilter) {
    stageFilter.addEventListener("change", (e) => {
      selectedStage = e.target.value;
      checklistFilter = "";
      render();
    });
  }

  const deptFilter = app.querySelector("#filter-dept");
  if (deptFilter) {
    deptFilter.addEventListener("change", (e) => {
      selectedDepartment = e.target.value;
      checklistFilter = "";
      render();
    });
  }

  // Task click -> navigate to task detail
  app.querySelectorAll("[data-task-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const taskId = el.dataset.taskId;
      window.location.href = `task.html?projectId=${projectId}&taskId=${taskId}`;
    });
  });

  // Change request approve/reject
  app.querySelectorAll("[data-approve-cr]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const { updateChangeRequest } = await import("../firestore-service.js");
      await updateChangeRequest(btn.dataset.approveCr, { status: "approved" });
    });
  });

  app.querySelectorAll("[data-reject-cr]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const { updateChangeRequest } = await import("../firestore-service.js");
      await updateChangeRequest(btn.dataset.rejectCr, { status: "rejected" });
    });
  });

  // --- Bulk Operations ---
  // Task checkboxes (stop propagation to prevent row click navigation)
  app.querySelectorAll("[data-task-checkbox]").forEach((cb) => {
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    cb.addEventListener("change", (e) => {
      const id = cb.dataset.taskCheckbox;
      if (cb.checked) {
        selectedTaskIds.add(id);
      } else {
        selectedTaskIds.delete(id);
      }
      updateBulkBar();
    });
  });

  // Select all
  const selectAllCb = app.querySelector("#select-all-tasks");
  if (selectAllCb) {
    selectAllCb.addEventListener("change", () => {
      const checkboxes = app.querySelectorAll("[data-task-checkbox]");
      if (selectAllCb.checked) {
        checkboxes.forEach(cb => { cb.checked = true; selectedTaskIds.add(cb.dataset.taskCheckbox); });
      } else {
        checkboxes.forEach(cb => { cb.checked = false; });
        selectedTaskIds.clear();
      }
      updateBulkBar();
    });
  }

  // Bulk approve
  const bulkApproveBtn = app.querySelector("#bulk-approve-btn");
  if (bulkApproveBtn) {
    bulkApproveBtn.addEventListener("click", async () => {
      if (selectedTaskIds.size === 0) return;
      if (!confirm(`${selectedTaskIds.size}개 작업을 일괄 승인하시겠습니까?`)) return;
      await bulkApproveTasks([...selectedTaskIds], user.name);
      selectedTaskIds.clear();
      render();
    });
  }

  // Bulk assignee change
  const bulkAssigneeBtn = app.querySelector("#bulk-assignee-btn");
  if (bulkAssigneeBtn) {
    bulkAssigneeBtn.addEventListener("click", async () => {
      if (selectedTaskIds.size === 0) return;
      const names = allUsers.map(u => u.name);
      const newAssignee = prompt(`새 담당자를 입력하세요:\n(${names.slice(0, 5).join(", ")}...)`);
      if (!newAssignee) return;
      await bulkUpdateAssignee([...selectedTaskIds], newAssignee);
      selectedTaskIds.clear();
      render();
    });
  }

  // Bulk cancel selection
  const bulkCancelBtn = app.querySelector("#bulk-cancel-btn");
  if (bulkCancelBtn) {
    bulkCancelBtn.addEventListener("click", () => {
      selectedTaskIds.clear();
      render();
    });
  }

  // --- Export ---
  const csvBtn = app.querySelector("#export-csv-btn");
  if (csvBtn) {
    csvBtn.addEventListener("click", () => {
      const headers = ["제목", "단계", "부서", "담당자", "상태", "마감일", "승인상태"];
      const data = checklistItems.map(t => [
        t.title, t.stage, t.department, t.assignee || "", getStatusLabel(t.status),
        formatDate(t.dueDate), t.approvalStatus || "-"
      ]);
      exportToCSV(data, headers, `${project.name}_체크리스트.csv`);
    });
  }

  const pdfBtn = app.querySelector("#export-pdf-btn");
  if (pdfBtn) {
    pdfBtn.addEventListener("click", () => {
      const completed = checklistItems.filter(t => t.status === "completed").length;
      const content = `프로젝트: ${project.name}\nPM: ${project.pm}\n진행률: ${project.progress}%\n전체 작업: ${checklistItems.length}\n완료: ${completed}\n현재 단계: ${project.currentStage}\n마감일: ${formatDate(project.endDate)}`;
      exportToPDF(`${project.name} 보고서`, content);
    });
  }

  // File row click -> open URL
  app.querySelectorAll("[data-file-url]").forEach((row) => {
    row.addEventListener("click", () => {
      const url = row.dataset.fileUrl;
      if (url) window.open(url, "_blank");
    });
  });
}

function updateBulkBar() {
  const bar = app.querySelector("#bulk-action-bar");
  const countEl = app.querySelector("#bulk-count");
  const selectedCountEl = app.querySelector("#selected-count");
  if (bar) {
    bar.style.display = selectedTaskIds.size > 0 ? "flex" : "none";
  }
  if (countEl) {
    countEl.textContent = `${selectedTaskIds.size}개 선택됨`;
  }
  if (selectedCountEl) {
    selectedCountEl.textContent = selectedTaskIds.size > 0 ? `(${selectedTaskIds.size}개 선택)` : "";
  }
}

// ─── Quick Add Task (NLP Parsing + Smart Assignee) ──────────────────────────

function parseQuickInput(text) {
  const result = {
    title: "",
    assignee: "",
    department: "",
    importance: "green",
    dueDate: null,
    stage: PHASE_GROUPS[0].workStage,
  };

  let remaining = text;

  // @담당자
  const mentionMatch = remaining.match(/@([\uAC00-\uD7A3a-zA-Z]{2,10})/);
  if (mentionMatch) {
    result.assignee = mentionMatch[1];
    remaining = remaining.replace(mentionMatch[0], "").trim();
  }

  // #부서
  const deptMatch = remaining.match(/#([\uAC00-\uD7A3a-zA-Z\uc2e4]+)/);
  if (deptMatch) {
    const input = deptMatch[1];
    const found = departments.find(d => d.includes(input) || input.includes(d.replace("팀", "")));
    if (found) result.department = found;
    remaining = remaining.replace(deptMatch[0], "").trim();
  }

  // !긴급 or !중요
  if (remaining.includes("!긴급") || remaining.includes("!red")) {
    result.importance = "red";
    remaining = remaining.replace(/!긴급|!red/g, "").trim();
  } else if (remaining.includes("!중요") || remaining.includes("!yellow")) {
    result.importance = "yellow";
    remaining = remaining.replace(/!중요|!yellow/g, "").trim();
  }

  // ~마감일 (YYYY-MM-DD or MM-DD)
  const dateMatch = remaining.match(/~(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})/);
  if (dateMatch) {
    let dateStr = dateMatch[1];
    if (dateStr.length === 5) dateStr = `${new Date().getFullYear()}-${dateStr}`;
    result.dueDate = new Date(dateStr);
    remaining = remaining.replace(dateMatch[0], "").trim();
  }

  // Auto-detect stage from keywords
  const stageKeywords = {
    "발의": 0, "기획": 1, "WM": 2, "wm": 2, "Tx": 3, "tx": 3,
    "MSG": 4, "msg": 4, "MasterGate": 4, "양산": 5, "이관": 5,
  };
  for (const [kw, idx] of Object.entries(stageKeywords)) {
    if (remaining.includes(kw)) {
      result.stage = PHASE_GROUPS[idx].workStage;
      break;
    }
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
    const overdue = tasks.filter(t => {
      if (t.status === "completed") return false;
      const d = daysUntil(t.dueDate);
      return d !== null && d < 0;
    }).length;
    return { name: u.name, active, overdue, score: active + overdue * 2 };
  }).sort((a, b) => a.score - b.score);
}

async function handleQuickAdd() {
  const input = document.getElementById("quick-add-input");
  if (!input || !input.value.trim()) return;

  const parsed = parseQuickInput(input.value);
  if (!parsed.title) {
    alert("작업 내용을 입력해주세요");
    return;
  }

  // Default department from user if not specified
  if (!parsed.department) parsed.department = user.department || departments[0];

  // Smart assignee: if not specified, suggest best one
  if (!parsed.assignee) {
    const suggestions = getSmartAssigneeSuggestions(parsed.department);
    if (suggestions.length > 0) {
      parsed.assignee = suggestions[0].name;
    } else {
      parsed.assignee = user.name;
    }
  }

  // Default due date: 2 weeks from now
  if (!parsed.dueDate) {
    parsed.dueDate = new Date(Date.now() + 14 * 86400000);
  }

  try {
    await createChecklistItem({
      projectId,
      title: parsed.title,
      assignee: parsed.assignee,
      department: parsed.department,
      stage: parsed.stage,
      importance: parsed.importance,
      dueDate: parsed.dueDate,
      status: "pending",
    });
    input.value = "";
  } catch (err) {
    alert("작업 생성 실패: " + err.message);
  }
}

function showAddTaskModal() {
  const dept = user.department || departments[0];
  const suggestions = getSmartAssigneeSuggestions(dept);
  const suggestHtml = suggestions.slice(0, 5).map(s =>
    `<div class="smart-suggest-item" data-name="${escapeHtml(s.name)}" style="display:flex;justify-content:space-between;padding:6px 10px;cursor:pointer;border-radius:var(--radius-sm);font-size:0.8rem">
      <span><strong>${escapeHtml(s.name)}</strong></span>
      <span style="color:var(--text-muted)">${s.active}건 진행 ${s.overdue > 0 ? `<span style="color:var(--danger)">${s.overdue}건 지연</span>` : ""}</span>
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
              ${PHASE_GROUPS.map(p => `<option value="${p.workStage}">${p.name} (작업)</option><option value="${p.gateStage}">${p.name} (승인)</option>`).join("")}
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
          <label class="form-label">담당자 ${suggestions.length > 0 ? '<span style="font-size:0.7rem;color:var(--primary)">(추천순)</span>' : ""}</label>
          <input type="text" id="modal-task-assignee" class="input-field" placeholder="담당자 이름" value="${suggestions.length > 0 ? escapeHtml(suggestions[0].name) : ""}">
          ${suggestHtml ? `<div class="smart-suggest-list" style="margin-top:4px;border:1px solid var(--border);border-radius:var(--radius-md);max-height:150px;overflow-y:auto">${suggestHtml}</div>` : ""}
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

  // Events
  overlay.querySelector("#close-add-modal").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#cancel-add-modal").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });

  // Smart suggestion clicks
  overlay.querySelectorAll(".smart-suggest-item").forEach(item => {
    item.addEventListener("click", () => {
      overlay.querySelector("#modal-task-assignee").value = item.dataset.name;
    });
    item.addEventListener("mouseenter", () => { item.style.background = "var(--surface-2, var(--surface-1))"; });
    item.addEventListener("mouseleave", () => { item.style.background = ""; });
  });

  // Department change → refresh suggestions
  overlay.querySelector("#modal-task-dept").addEventListener("change", (e) => {
    const newSugs = getSmartAssigneeSuggestions(e.target.value);
    const list = overlay.querySelector(".smart-suggest-list");
    if (list && newSugs.length > 0) {
      list.innerHTML = newSugs.slice(0, 5).map(s =>
        `<div class="smart-suggest-item" data-name="${escapeHtml(s.name)}" style="display:flex;justify-content:space-between;padding:6px 10px;cursor:pointer;border-radius:var(--radius-sm);font-size:0.8rem">
          <span><strong>${escapeHtml(s.name)}</strong></span>
          <span style="color:var(--text-muted)">${s.active}건 진행 ${s.overdue > 0 ? `<span style="color:var(--danger)">${s.overdue}건 지연</span>` : ""}</span>
        </div>`
      ).join("");
      list.querySelectorAll(".smart-suggest-item").forEach(item => {
        item.addEventListener("click", () => {
          overlay.querySelector("#modal-task-assignee").value = item.dataset.name;
        });
      });
      if (newSugs.length > 0) overlay.querySelector("#modal-task-assignee").value = newSugs[0].name;
    }
  });

  // Submit
  overlay.querySelector("#submit-add-modal").addEventListener("click", async () => {
    const title = overlay.querySelector("#modal-task-title").value.trim();
    if (!title) { alert("작업 내용을 입력해주세요"); return; }

    try {
      await createChecklistItem({
        projectId,
        title,
        assignee: overlay.querySelector("#modal-task-assignee").value.trim() || user.name,
        department: overlay.querySelector("#modal-task-dept").value,
        stage: overlay.querySelector("#modal-task-stage").value,
        importance: overlay.querySelector("#modal-task-importance").value,
        dueDate: new Date(overlay.querySelector("#modal-task-due").value),
        status: "pending",
      });
      overlay.remove();
    } catch (err) {
      alert("작업 생성 실패: " + err.message);
    }
  });
}
