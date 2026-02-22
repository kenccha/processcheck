// =============================================================================
// Project Detail Page — 4-tab project view
// =============================================================================

import { guardPage } from "../auth.js";
import { renderNav, renderSpinner } from "../components.js";
import {
  subscribeProjects,
  subscribeChecklistItems,
  subscribeChangeRequests,
} from "../firestore-service.js";
import {
  departments,
  projectStages,
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

  const stageIndex = projectStages.indexOf(project.currentStage);
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
  const pendingApproval = checklistItems.filter(
    (t) => t.status === "in_progress" && t.approvalStatus === undefined
  ).length;

  app.innerHTML = `
    <div class="container" style="padding-bottom: 3rem;">
      <!-- Project Header Card -->
      ${renderProjectHeader(riskClass, stageIndex, totalTasks)}

      <!-- Tabs -->
      <div class="tab-bar mb-4" style="margin-top: 1.5rem;">
        <button class="tab-btn${activeTab === "overview" ? " active" : ""}" data-tab="overview">개요</button>
        <button class="tab-btn${activeTab === "checklist" ? " active" : ""}" data-tab="checklist">체크리스트</button>
        <button class="tab-btn${activeTab === "files" ? " active" : ""}" data-tab="files">파일</button>
        <button class="tab-btn${activeTab === "changes" ? " active" : ""}" data-tab="changes">설계 변경</button>
      </div>

      <!-- Tab Content -->
      <div class="animate-fade-in">
        ${activeTab === "overview" ? renderOverviewTab(totalTasks, inProgressTasks, delayedTasks, pendingApproval) : ""}
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

function renderProjectHeader(riskClass, stageIndex, totalTasks) {
  const p = project;
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
          <!-- Current Stage -->
          <div style="margin-top: 1rem; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.2); border-radius: var(--radius-lg);">
            <svg width="14" height="14" fill="none" stroke="var(--primary-400)" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span class="text-sm font-semibold" style="color: var(--primary-300);">현재 단계: ${formatStageName(p.currentStage)}</span>
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

function renderOverviewTab(totalTasks, inProgressTasks, delayedTasks, pendingApproval) {
  return `
    <!-- Stat Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="stat-card">
        <div class="stat-card-label">전체 작업</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: var(--slate-100);">${totalTasks}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">진행 중</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: var(--primary-400);">${inProgressTasks}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">지연</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: ${delayedTasks > 0 ? "var(--danger-400)" : "var(--slate-100)"};">${delayedTasks}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">승인 대기</div>
        <div class="stat-card-row">
          <div class="stat-value" style="color: var(--warning-400);">${pendingApproval}</div>
        </div>
      </div>
    </div>

    <!-- Stage Progress -->
    <div class="card p-5 mb-6">
      <h3 class="section-title mb-4">단계별 진행 상황</h3>
      <div class="flex flex-col gap-3">
        ${projectStages
          .map((stage) => {
            const progress = getStageProgress(stage);
            const isCurrent = project.currentStage === stage;
            const stageItems = checklistItems.filter((t) => t.stage === stage);
            const hasItems = stageItems.length > 0;
            return `
              <div style="padding: 0.625rem 0.75rem; border-radius: var(--radius-lg); ${isCurrent ? "border: 1px solid rgba(6, 182, 212, 0.4); background: rgba(6, 182, 212, 0.04);" : "border: 1px solid transparent;"}">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    ${isCurrent ? '<span style="width:6px;height:6px;border-radius:50%;background:var(--primary-400);display:inline-block;"></span>' : ""}
                    <span class="text-sm font-medium" style="color: ${isCurrent ? "var(--primary-300)" : "var(--slate-300)"};">${formatStageName(stage)}</span>
                  </div>
                  <span class="text-xs font-mono" style="color: ${hasItems ? "var(--slate-300)" : "var(--slate-600)"};">${progress}%</span>
                </div>
                <div class="progress-bar" style="height: 0.25rem;">
                  <div class="progress-fill ${progress === 100 ? "success" : isCurrent ? "" : ""}" style="width: ${progress}%; ${isCurrent ? "background: var(--primary-400);" : progress === 100 ? "" : "background: var(--slate-500);"}"></div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>

    <!-- Department Progress -->
    <div class="card p-5 mb-6">
      <h3 class="section-title mb-4">부서별 진행 상황</h3>
      <div class="flex flex-col gap-3">
        ${departments
          .map((dept) => {
            const progress = getDepartmentProgress(dept);
            const deptItems = checklistItems.filter((t) => t.department === dept);
            const hasItems = deptItems.length > 0;
            return `
              <div style="padding: 0.5rem 0;">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-medium" style="color: var(--slate-300);">${escapeHtml(dept)}</span>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-dim">${deptItems.filter((t) => t.status === "completed").length}/${deptItems.length}</span>
                    <span class="text-xs font-mono" style="color: ${hasItems ? "var(--slate-300)" : "var(--slate-600)"};">${progress}%</span>
                  </div>
                </div>
                <div class="progress-bar" style="height: 0.25rem;">
                  <div class="progress-fill ${progress === 100 ? "success" : ""}  " style="width: ${progress}%;"></div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>

    <!-- Recent Activity -->
    <div class="card p-5">
      <h3 class="section-title mb-4">최근 활동</h3>
      ${renderRecentActivity()}
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
    <!-- Matrix -->
    <div class="card p-4 mb-6">
      <h3 class="section-title mb-3">부서 x 단계 매트릭스</h3>
      <div class="matrix-table">
        <table>
          <thead>
            <tr>
              <th style="min-width: 100px; text-align: left;">부서</th>
              ${projectStages
                .map(
                  (stage) =>
                    `<th style="padding: 0.5rem 0.25rem; font-size: 0.625rem; writing-mode: vertical-lr; text-orientation: mixed; transform: rotate(180deg); height: 6rem;" title="${formatStageName(stage)}">${formatStageName(stage)}</th>`
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${departments
              .map(
                (dept) => `
                <tr>
                  <td style="font-size: 0.75rem; font-weight: 500; color: var(--slate-300); white-space: nowrap;">${escapeHtml(dept)}</td>
                  ${projectStages
                    .map((stage) => {
                      const cell = getMatrixCellData(stage, dept);
                      if (cell.status === "none") {
                        return `<td class="matrix-cell" style="padding: 0.375rem;">
                          <span style="display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:50%;background:var(--surface-3);font-size:0.625rem;color:var(--slate-600);">-</span>
                        </td>`;
                      }
                      return `<td class="matrix-cell" data-matrix-stage="${stage}" data-matrix-dept="${dept}" style="padding: 0.375rem;">
                        <span style="display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:50%;background:${getMatrixCellColor(cell.status)};font-size:0.625rem;color:white;font-weight:700;" class="count">${cell.count}/${cell.total}</span>
                      </td>`;
                    })
                    .join("")}
                </tr>
              `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <select class="input-field" style="width: auto; min-width: 160px;" id="filter-stage">
        <option value="">전체 단계</option>
        ${projectStages
          .map(
            (s) =>
              `<option value="${s}" ${selectedStage === s ? "selected" : ""}>${formatStageName(s)}</option>`
          )
          .join("")}
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

  if (selectedStage) {
    filtered = filtered.filter((t) => t.stage === selectedStage);
  }
  if (selectedDepartment) {
    filtered = filtered.filter((t) => t.department === selectedDepartment);
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
      render();
    });
  });

  // Matrix cell click
  app.querySelectorAll("[data-matrix-stage]").forEach((cell) => {
    cell.addEventListener("click", () => {
      selectedStage = cell.dataset.matrixStage;
      selectedDepartment = cell.dataset.matrixDept;
      activeTab = "checklist";
      render();
    });
  });

  // Filter dropdowns
  const stageFilter = app.querySelector("#filter-stage");
  if (stageFilter) {
    stageFilter.addEventListener("change", (e) => {
      selectedStage = e.target.value;
      render();
    });
  }

  const deptFilter = app.querySelector("#filter-dept");
  if (deptFilter) {
    deptFilter.addEventListener("change", (e) => {
      selectedDepartment = e.target.value;
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
