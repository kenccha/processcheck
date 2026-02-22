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

// --- Render nav ---
const unsubNav = renderNav(navRoot);

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
  if (currentPhase) {
    const phaseStages = [currentPhase.workStage, currentPhase.gateStage];
    const phaseTasks = checklistItems.filter(t => phaseStages.includes(t.stage) && t.status !== "completed");
    const deptCounts = {};
    for (const t of phaseTasks) {
      if (!deptCounts[t.department]) deptCounts[t.department] = { inProgress: 0, pending: 0 };
      if (t.status === "in_progress") deptCounts[t.department].inProgress++;
      else if (t.status === "pending") deptCounts[t.department].pending++;
    }
    for (const [dept, counts] of Object.entries(deptCounts)) {
      const parts = [];
      if (counts.inProgress > 0) parts.push(`${counts.inProgress}건 진행중`);
      if (counts.pending > 0) parts.push(`${counts.pending}건 대기`);
      bottlenecks.push(`${dept} ${parts.join(", ")}`);
    }
  }

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

      <!-- Deadline + Plan Deviation -->
      <div class="flex flex-wrap gap-6 mb-4">
        <div>
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

      <!-- Bottleneck -->
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

    <!-- Task List grouped by department -->
    ${renderTaskList()}
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
  return `
    <div class="card p-6">
      <!-- Upload Area Placeholder -->
      <div style="border: 2px dashed var(--surface-4); border-radius: var(--radius-xl); padding: 3rem 2rem; text-align: center; transition: border-color 0.2s;">
        <svg width="48" height="48" fill="none" stroke="var(--slate-600)" viewBox="0 0 24 24" style="margin: 0 auto 1rem;">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
        <div class="text-sm font-medium" style="color: var(--slate-400); margin-bottom: 0.5rem;">파일을 여기에 드래그하거나 클릭하여 업로드</div>
        <div class="text-xs text-dim">PDF, DOCX, XLSX, 이미지 파일 지원</div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" style="padding: 3rem 1rem; margin-top: 2rem;">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <span class="empty-state-text">업로드된 파일이 없습니다</span>
        <span class="text-xs text-dim" style="margin-top: 0.5rem;">프로젝트 관련 문서와 파일을 업로드하세요</span>
      </div>
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
}
