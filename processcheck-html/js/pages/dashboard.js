// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Page Controller — Tabbed Layout + Compact
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage, getUser } from "../auth.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
initTheme();
import {
  subscribeChecklistItemsByAssignee,
  subscribeAllChecklistItems,
  subscribeProjects,
  subscribeNotifications,
  markNotificationRead,
} from "../firestore-service.js";
import {
  getStatusLabel,
  getStatusBadgeClass,
  getRiskClass,
  getRiskLabel,
  escapeHtml,
  getRoleName,
  formatDate,
  formatStageName,
  timeAgo,
  daysUntil,
  getProgressClass,
} from "../utils.js";

// ─── Auth Guard ─────────────────────────────────────────────────────────────

const user = guardPage();
if (!user) throw new Error("Not authenticated");

// ─── Render Navigation ──────────────────────────────────────────────────────

const navUnsub = renderNav(document.getElementById("nav-root"));

// ─── State ──────────────────────────────────────────────────────────────────

let allProjects = [];
let allTasks = [];
let notifications = [];

// Derived state
let myTasks = [];
let pendingApprovals = [];
let myProjects = [];

// UI state
let activeTab = "tasks";
let chartsExpanded = localStorage.getItem("pc-dash-charts-open") === "true";
let showAllInTab = { tasks: false, approvals: false, projects: false };
const ITEMS_PER_TAB = 5;

const app = document.getElementById("app");
const unsubscribers = [];

// ─── Subscriptions ──────────────────────────────────────────────────────────

unsubscribers.push(
  subscribeProjects((projects) => {
    allProjects = projects;
    computeDerived();
    render();
  })
);

if (user.role === "observer" || user.role === "manager") {
  unsubscribers.push(
    subscribeAllChecklistItems((tasks) => {
      if (user.role === "manager") {
        allTasks = tasks.filter((t) => t.department === user.department);
      } else {
        allTasks = tasks;
      }
      computeDerived();
      render();
    })
  );
} else {
  unsubscribers.push(
    subscribeChecklistItemsByAssignee(user.name, (tasks) => {
      allTasks = tasks;
      computeDerived();
      render();
    })
  );
}

unsubscribers.push(
  subscribeNotifications(user.id, (notifs) => {
    notifications = notifs.slice(0, 10);
    render();
  })
);

if (navUnsub) unsubscribers.push(navUnsub);

// ─── Derived State Computation ──────────────────────────────────────────────

function computeDerived() {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);

  if (user.role === "observer") {
    myTasks = allTasks
      .filter((t) => t.status === "pending" || t.status === "in_progress")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    pendingApprovals = allTasks.filter(
      (t) => t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending")
    );
  } else if (user.role === "manager") {
    myTasks = allTasks
      .filter((t) => t.status === "pending" || t.status === "in_progress")
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    pendingApprovals = allTasks.filter(
      (t) => t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending")
    );
  } else {
    myTasks = allTasks
      .filter(
        (t) =>
          (t.status === "pending" || t.status === "in_progress") &&
          new Date(t.dueDate) <= threeDaysFromNow
      )
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    pendingApprovals = allTasks.filter(
      (t) => t.status === "completed" && (!t.approvalStatus || t.approvalStatus === "pending")
    );
  }

  if (user.role === "observer") {
    myProjects = allProjects.filter((p) => p.status === "active" && p.pm === user.name);
  } else {
    const myProjectIds = new Set(allTasks.map((t) => t.projectId));
    myProjects = allProjects.filter((p) => p.status === "active" && myProjectIds.has(p.id));
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDueDate(date) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  const days = daysUntil(d);
  if (days === null) return formatDate(d);
  if (days < 0) return `D+${Math.abs(days)}`;
  if (days === 0) return "D-Day";
  return `D-${days}`;
}

function getDateColorClass(date) {
  if (!date) return "";
  const days = daysUntil(date instanceof Date ? date : new Date(date));
  if (days === null) return "";
  if (days < 0) return "text-danger";
  if (days === 0) return "text-warning";
  if (days <= 1) return "text-warning";
  return "text-soft";
}

function getTaskUrgencyClass(date) {
  if (!date) return "";
  const days = daysUntil(date instanceof Date ? date : new Date(date));
  if (days === null) return "";
  if (days < 0) return "task-urgent";
  if (days === 0) return "task-warning-border";
  return "";
}

function getOverdueCount() {
  return allTasks.filter((t) => {
    if (t.status === "completed" || t.status === "rejected") return false;
    const days = daysUntil(t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate));
    return days !== null && days < 0;
  }).length;
}

function getDelayedProjectCount() {
  return myProjects.filter((p) => p.riskLevel === "red" || p.riskLevel === "yellow").length;
}

function getMaxApprovalWaitDays() {
  if (pendingApprovals.length === 0) return 0;
  const now = new Date();
  let maxDays = 0;
  for (const task of pendingApprovals) {
    if (task.completedDate) {
      const cd = task.completedDate instanceof Date ? task.completedDate : new Date(task.completedDate);
      const diff = Math.floor((now - cd) / 86400000);
      if (diff > maxDays) maxDays = diff;
    }
  }
  return maxDays;
}

function getProjectName(projectId) {
  const p = allProjects.find((proj) => proj.id === projectId);
  return p ? p.name : projectId;
}

function formatTodayDate() {
  const now = new Date();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${weekdays[now.getDay()]})`;
}

function getProjectPhase(project) {
  if (!project.currentStage) return null;
  const stageMap = {
    "발의검토": "발의", "발의승인": "발의",
    "기획검토": "기획", "기획승인": "기획",
    "WM제작": "WM", "WM승인회": "WM",
    "Tx단계": "Tx", "Tx승인회": "Tx",
    "MasterGatePilot": "MSG", "MSG승인회": "MSG",
    "양산": "양산/이관", "영업이관": "양산/이관",
  };
  return stageMap[project.currentStage] || project.currentStage;
}

// ─── Tab Content Renderers ──────────────────────────────────────────────────

function renderTasksTab() {
  if (myTasks.length === 0) {
    return `<div class="empty-state" style="padding: 2.5rem 1rem">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span class="empty-state-text">${user.role === "worker" ? "3일 이내 마감 예정인 작업이 없습니다" : "대기 중인 작업이 없습니다"}</span>
      <a href="projects.html" class="btn btn-primary btn-sm" style="margin-top: 0.75rem; text-decoration: none;">프로젝트 목록 보기</a>
    </div>`;
  }
  const showAll = showAllInTab.tasks;
  const items = showAll ? myTasks : myTasks.slice(0, ITEMS_PER_TAB);
  const hasMore = myTasks.length > ITEMS_PER_TAB;
  return `<div>${items.map((task) => `
    <div class="task-row cursor-pointer ${getTaskUrgencyClass(task.dueDate)}" data-task-project="${task.projectId}" data-task-id="${task.id}" style="padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;">
      <div class="flex items-center justify-between gap-3 mb-1">
        <div class="flex items-center gap-2 flex-1" style="min-width: 0">
          <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(task.title)}</span>
          <span class="badge ${getStatusBadgeClass(task.status)}" style="flex-shrink: 0">${getStatusLabel(task.status)}</span>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="font-mono text-xs font-semibold ${getDateColorClass(task.dueDate)}">${formatDueDate(task.dueDate)}</span>
        </div>
      </div>
      <div class="flex items-center gap-3 text-xs text-soft">
        <span>${escapeHtml(task.department || "")}${task.stage ? " / " + escapeHtml(formatStageName(task.stage)) : ""}</span>
        ${task.reviewer ? `<span style="color: var(--slate-500)">검토: ${escapeHtml(task.reviewer)}</span>` : ""}
        <span style="color: var(--slate-600)">${formatDate(task.dueDate)}</span>
      </div>
    </div>`).join("")}
    ${hasMore ? `<div class="dash-show-more" style="padding: 0.75rem 1.25rem; border-top: 1px solid var(--surface-3);">
      <button class="btn-ghost btn-sm" data-toggle-more="tasks">
        ${showAll ? "접기" : `나머지 ${myTasks.length - ITEMS_PER_TAB}건 더 보기`}
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${showAll ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}"/></svg>
      </button>
    </div>` : ""}</div>`;
}

function renderApprovalsTab() {
  if (pendingApprovals.length === 0) {
    return `<div class="empty-state" style="padding: 2.5rem 1rem">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span class="empty-state-text">승인 대기 중인 작업이 없습니다</span>
    </div>`;
  }
  const showAll = showAllInTab.approvals;
  const items = showAll ? pendingApprovals : pendingApprovals.slice(0, ITEMS_PER_TAB);
  const hasMore = pendingApprovals.length > ITEMS_PER_TAB;
  return `<div>${items.map((task) => `
    <div class="task-row cursor-pointer" data-task-project="${task.projectId}" data-task-id="${task.id}" style="padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;">
      <div class="flex items-center justify-between gap-3 mb-1">
        <div class="flex items-center gap-2 flex-1" style="min-width: 0">
          <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(task.title)}</span>
          <span class="badge badge-success" style="flex-shrink: 0">완료</span>
          <span class="badge badge-warning" style="flex-shrink: 0">승인 대기</span>
        </div>
      </div>
      <div class="flex items-center gap-3 text-xs text-soft">
        ${task.completedDate ? `<span>완료일: ${formatDate(task.completedDate)}</span>` : ""}
        ${task.reviewer ? `<span style="color: var(--slate-500)">검토: ${escapeHtml(task.reviewer)}</span>` : ""}
      </div>
    </div>`).join("")}
    ${hasMore ? `<div class="dash-show-more" style="padding: 0.75rem 1.25rem; border-top: 1px solid var(--surface-3);">
      <button class="btn-ghost btn-sm" data-toggle-more="approvals">
        ${showAll ? "접기" : `나머지 ${pendingApprovals.length - ITEMS_PER_TAB}건 더 보기`}
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${showAll ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}"/></svg>
      </button>
    </div>` : ""}</div>`;
}

function renderProjectsTab() {
  if (myProjects.length === 0) {
    return `<div class="empty-state" style="padding: 2.5rem 1rem">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
      </svg>
      <span class="empty-state-text">배정된 프로젝트가 없습니다</span>
      <a href="projects.html" class="btn btn-primary btn-sm" style="margin-top: 0.75rem; text-decoration: none;">전체 프로젝트 보기</a>
    </div>`;
  }
  const showAll = showAllInTab.projects;
  const items = showAll ? myProjects : myProjects.slice(0, ITEMS_PER_TAB);
  const hasMore = myProjects.length > ITEMS_PER_TAB;
  return `<div>${items.map((project) => {
    const phase = getProjectPhase(project);
    return `
    <div class="project-row cursor-pointer" data-project-id="${project.id}" style="padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;">
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="flex items-center gap-2 flex-1" style="min-width: 0">
          <span class="risk-dot ${project.riskLevel || "green"}"></span>
          <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(project.name)}</span>
          ${phase ? `<span class="badge badge-primary" style="font-size: 0.625rem; padding: 0.0625rem 0.375rem">${escapeHtml(phase)}</span>` : ""}
        </div>
        <span class="font-mono text-xs font-semibold" style="color: var(--primary-400)">${project.progress || 0}%</span>
      </div>
      <div class="flex items-center gap-3 text-xs text-soft mb-2">
        <span>${escapeHtml(project.productType || "")}</span>
        <span>PM: ${escapeHtml(project.pm || "-")}</span>
        <span class="badge badge-${getRiskClass(project.riskLevel)}" style="font-size: 0.6875rem; padding: 0.125rem 0.375rem">${getRiskLabel(project.riskLevel)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${getProgressClass(project.progress || 0)}" style="width: ${project.progress || 0}%"></div>
      </div>
    </div>`;}).join("")}
    ${hasMore ? `<div class="dash-show-more" style="padding: 0.75rem 1.25rem; border-top: 1px solid var(--surface-3);">
      <button class="btn-ghost btn-sm" data-toggle-more="projects">
        ${showAll ? "접기" : `나머지 ${myProjects.length - ITEMS_PER_TAB}건 더 보기`}
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${showAll ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}"/></svg>
      </button>
    </div>` : ""}
    <div style="padding: 0.5rem 1.25rem; border-top: 1px solid var(--surface-3); text-align: right;">
      <a href="projects.html" class="btn-ghost btn-sm" style="display: inline-flex; gap: 0.25rem; color: var(--primary-400); text-decoration: none;">
        전체 보기 <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </a>
    </div></div>`;
}

// ─── Main Render ────────────────────────────────────────────────────────────

function render() {
  const overdueCount = getOverdueCount();
  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const delayedCount = getDelayedProjectCount();
  const maxWaitDays = getMaxApprovalWaitDays();

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Welcome Header -->
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100)">
            ${escapeHtml(user.name)}님, 안녕하세요
          </h1>
          <div class="flex items-center gap-3 mt-2">
            <span class="badge badge-primary">${escapeHtml(getRoleName(user.role))}</span>
            <span class="dash-date">${formatTodayDate()}</span>
            ${overdueCount > 0 ? `<span class="text-sm" style="color: var(--danger-400)">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;margin-right:2px">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg> 마감 초과 ${overdueCount}건</span>` : ""}
          </div>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in-delay-1">
        <div class="stat-card cursor-pointer card-hover ${activeTab === "tasks" ? "stat-card-active" : ""}" id="stat-tasks" data-dash-tab="tasks">
          <div class="stat-card-label">작업 대기</div>
          <div class="stat-card-row"><span class="stat-value" style="color: var(--primary-400)">${myTasks.length}</span></div>
          ${overdueCount > 0 ? `<div class="stat-sub" style="color: var(--danger-400)">마감 초과 ${overdueCount}건</div>` : ""}
        </div>
        <div class="stat-card cursor-pointer card-hover ${activeTab === "approvals" ? "stat-card-active" : ""}" id="stat-approvals" data-dash-tab="approvals">
          <div class="stat-card-label">승인 대기</div>
          <div class="stat-card-row"><span class="stat-value" style="color: var(--warning-400)">${pendingApprovals.length}</span></div>
          ${maxWaitDays > 0 ? `<div class="stat-sub" style="color: var(--warning-400)">최대 ${maxWaitDays}일 대기</div>` : ""}
        </div>
        <div class="stat-card cursor-pointer card-hover ${activeTab === "projects" ? "stat-card-active" : ""}" id="stat-projects" data-dash-tab="projects">
          <div class="stat-card-label">프로젝트</div>
          <div class="stat-card-row"><span class="stat-value" style="color: var(--success-400)">${myProjects.length}</span></div>
          ${delayedCount > 0 ? `<div class="stat-sub" style="color: var(--danger-400)">지연 ${delayedCount}건</div>` : ""}
        </div>
        <div class="stat-card cursor-pointer card-hover" id="stat-notifs">
          <div class="stat-card-label">미확인 알림</div>
          <div class="stat-card-row"><span class="stat-value" style="color: ${unreadNotifCount > 0 ? "var(--danger-400)" : "var(--slate-400)"}">${unreadNotifCount}</span></div>
        </div>
      </div>

      <!-- Two Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-delay-2">
        <!-- Left Column — Tabbed -->
        <div class="lg:col-span-2">
          <div class="card" id="section-main" style="padding: 0; overflow: hidden;">
            <div class="tab-bar" id="dashboard-tabs" style="padding: 0 0.25rem;">
              <button class="tab-btn ${activeTab === "tasks" ? "active" : ""}" data-dash-tab="tasks">
                작업 대기 <span class="badge badge-neutral" style="margin-left:0.25rem">${myTasks.length}</span>
              </button>
              <button class="tab-btn ${activeTab === "approvals" ? "active" : ""}" data-dash-tab="approvals">
                승인 대기 <span class="badge ${pendingApprovals.length > 0 ? "badge-warning" : "badge-neutral"}" style="margin-left:0.25rem">${pendingApprovals.length}</span>
              </button>
              <button class="tab-btn ${activeTab === "projects" ? "active" : ""}" data-dash-tab="projects">
                프로젝트 <span class="badge badge-neutral" style="margin-left:0.25rem">${myProjects.length}</span>
              </button>
            </div>
            <div class="animate-fade-in" id="tab-content">
              ${activeTab === "tasks" ? renderTasksTab() : ""}
              ${activeTab === "approvals" ? renderApprovalsTab() : ""}
              ${activeTab === "projects" ? renderProjectsTab() : ""}
            </div>
          </div>
        </div>

        <!-- Right Column — Notifications -->
        <div class="lg:col-span-1">
          <div class="card" id="section-notifications" style="padding: 0; overflow: hidden; position: sticky; top: 4.5rem;">
            <div class="flex items-center justify-between" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--surface-3)">
              <div class="flex items-center gap-2">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--warning-400)">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <span class="section-title">알림</span>
                ${unreadNotifCount > 0 ? `<span class="badge badge-danger" style="margin-left: 0.25rem">${unreadNotifCount}</span>` : ""}
              </div>
            </div>
            <div class="dash-notif-scroll">
              ${notifications.length === 0
                ? `<div class="empty-state" style="padding: 2.5rem 1rem">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    <span class="empty-state-text">알림이 없습니다</span>
                  </div>`
                : notifications.map((notif) => `
                  <div class="notif-dash-item cursor-pointer" data-notif-id="${notif.id}" data-notif-link="${escapeHtml(notif.link || "")}" style="padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;${!notif.read ? " border-left: 3px solid var(--primary-500);" : ""}">
                    <div class="flex items-start gap-2">
                      ${!notif.read
                        ? `<span style="width:6px;height:6px;border-radius:50%;background:var(--primary-400);margin-top:6px;flex-shrink:0"></span>`
                        : `<span style="width:6px;height:6px;margin-top:6px;flex-shrink:0"></span>`}
                      <div style="flex:1;min-width:0">
                        <div class="text-sm font-medium truncate" style="color:${!notif.read ? "var(--slate-100)" : "var(--slate-300)"};margin-bottom:0.125rem">${escapeHtml(notif.title)}</div>
                        <div class="text-xs" style="color:var(--slate-500);margin-bottom:0.375rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(notif.message)}</div>
                        <div class="text-xs" style="color:var(--slate-600)">${timeAgo(notif.createdAt)}</div>
                      </div>
                    </div>
                  </div>`).join("")}
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Section (Collapsible) -->
      <section class="mt-8" id="chart-section">
        <div class="card" style="padding: 0; overflow: hidden;">
          <div class="dash-collapsible-header cursor-pointer" id="chart-toggle" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between;">
            <div class="flex items-center gap-2">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--primary-400)">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
              <span class="section-title" style="margin:0">프로젝트 분석</span>
            </div>
            <svg class="dash-chevron ${chartsExpanded ? "dash-chevron-open" : ""}" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
          ${chartsExpanded ? `
          <div style="padding: 1.25rem; border-top: 1px solid var(--surface-3);">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 class="text-sm font-semibold mb-3" style="color:var(--slate-200)">부서별 진행률</h3>
                <div style="height:300px"><canvas id="chart-dept"></canvas></div>
              </div>
              <div class="grid grid-cols-1 gap-4">
                <div>
                  <h3 class="text-sm font-semibold mb-3" style="color:var(--slate-200)">Phase별 완료율 (%)</h3>
                  <div style="height:200px"><canvas id="chart-phase"></canvas></div>
                </div>
                <div>
                  <h3 class="text-sm font-semibold mb-3" style="color:var(--slate-200)">주간 완료 추이</h3>
                  <div style="height:140px"><canvas id="chart-weekly"></canvas></div>
                </div>
              </div>
            </div>
          </div>` : ""}
        </div>
      </section>
    </div>
  `;

  // ─── Event Handlers ─────────────────────────────────────────────────────

  // Tab switching (stat cards + tab buttons)
  app.querySelectorAll("[data-dash-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.dashTab;
      if (activeTab === tab && !btn.classList.contains("tab-btn")) return;
      activeTab = tab;
      showAllInTab = { tasks: false, approvals: false, projects: false };
      render();
    });
  });

  // Notifications stat card → scroll
  const statNotifs = app.querySelector("#stat-notifs");
  if (statNotifs) {
    statNotifs.addEventListener("click", () => {
      const el = document.getElementById("section-notifications");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Show more / collapse toggle
  app.querySelectorAll("[data-toggle-more]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tab = btn.dataset.toggleMore;
      showAllInTab[tab] = !showAllInTab[tab];
      render();
    });
  });

  // Chart section toggle
  const chartToggle = app.querySelector("#chart-toggle");
  if (chartToggle) {
    chartToggle.addEventListener("click", () => {
      chartsExpanded = !chartsExpanded;
      localStorage.setItem("pc-dash-charts-open", chartsExpanded ? "true" : "false");
      render();
    });
  }

  // Task rows → task detail
  app.querySelectorAll(".task-row").forEach((row) => {
    row.addEventListener("click", () => {
      window.location.href = `task.html?projectId=${row.dataset.taskProject}&taskId=${row.dataset.taskId}`;
    });
    row.addEventListener("mouseenter", () => { row.style.background = "rgba(26, 34, 52, 0.5)"; });
    row.addEventListener("mouseleave", () => { row.style.background = ""; });
  });

  // Project rows → project detail
  app.querySelectorAll(".project-row").forEach((row) => {
    row.addEventListener("click", () => {
      window.location.href = `project.html?id=${row.dataset.projectId}`;
    });
    row.addEventListener("mouseenter", () => { row.style.background = "rgba(26, 34, 52, 0.5)"; });
    row.addEventListener("mouseleave", () => { row.style.background = ""; });
  });

  // Notification items → mark read + navigate
  app.querySelectorAll(".notif-dash-item").forEach((item) => {
    item.addEventListener("click", async () => {
      await markNotificationRead(item.dataset.notifId);
      const link = item.dataset.notifLink;
      if (link) {
        const htmlLink = convertNotifLink(link);
        if (htmlLink) window.location.href = htmlLink;
      }
    });
    item.addEventListener("mouseenter", () => { item.style.background = "var(--surface-3)"; });
    item.addEventListener("mouseleave", () => { item.style.background = ""; });
  });

  // Render charts if expanded
  if (chartsExpanded && allTasks.length > 0) renderCharts();
}

// ─── Charts ──────────────────────────────────────────────────────────────────

function renderCharts() {
  const depts = ["개발팀", "품질팀", "영업팀", "제조팀", "구매팀", "CS팀", "경영관리팀", "글로벌임상팀", "디자인연구소", "인증팀"];
  const phases = [
    { name: "발의", stages: ["발의검토", "발의승인"] },
    { name: "기획", stages: ["기획검토", "기획승인"] },
    { name: "WM", stages: ["WM제작", "WM승인회"] },
    { name: "Tx", stages: ["Tx단계", "Tx승인회"] },
    { name: "MSG", stages: ["MasterGatePilot", "MSG승인회"] },
    { name: "양산/이관", stages: ["양산", "영업이관"] },
  ];

  const deptCompleted = depts.map(d => allTasks.filter(t => t.department === d && (t.approvalStatus === "approved" || t.status === "completed")).length);
  const deptInProgress = depts.map(d => allTasks.filter(t => t.department === d && t.status === "in_progress").length);
  const deptPending = depts.map(d => allTasks.filter(t => t.department === d && t.status === "pending").length);

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#cbd5e1" : "#475569";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const ctx1 = document.getElementById("chart-dept");
  if (ctx1) {
    if (ctx1._chart) ctx1._chart.destroy();
    ctx1._chart = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: depts.map(d => d.replace("팀", "")),
        datasets: [
          { label: "완료/승인", data: deptCompleted, backgroundColor: "rgba(16,185,129,0.7)" },
          { label: "진행 중", data: deptInProgress, backgroundColor: "rgba(6,182,212,0.7)" },
          { label: "대기", data: deptPending, backgroundColor: "rgba(148,163,184,0.4)" },
        ],
      },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { color: textColor, font: { size: 11 } } } },
        scales: {
          x: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } },
          y: { stacked: true, ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }

  const phaseData = phases.map(p => {
    const tasks = allTasks.filter(t => p.stages.includes(t.stage));
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter(t => t.approvalStatus === "approved" || t.status === "completed").length / tasks.length) * 100);
  });

  const ctx2 = document.getElementById("chart-phase");
  if (ctx2) {
    if (ctx2._chart) ctx2._chart.destroy();
    ctx2._chart = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: phases.map(p => p.name),
        datasets: [{ data: phaseData, backgroundColor: ["#06b6d4", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#f97316"], borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: textColor, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}% 완료` } },
        },
      },
    });
  }

  const now = new Date();
  const weekLabels = [];
  const weekCounts = [];
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(now.getTime() - (w * 7 + 7) * 86400000);
    const weekEnd = new Date(now.getTime() - w * 7 * 86400000);
    weekLabels.push(`${weekStart.getMonth() + 1}/${weekStart.getDate()}~${weekEnd.getDate()}`);
    weekCounts.push(allTasks.filter(t => {
      if (!t.completedDate) return false;
      const cd = t.completedDate instanceof Date ? t.completedDate : new Date(t.completedDate);
      return cd >= weekStart && cd < weekEnd;
    }).length);
  }

  const ctx3 = document.getElementById("chart-weekly");
  if (ctx3) {
    if (ctx3._chart) ctx3._chart.destroy();
    ctx3._chart = new Chart(ctx3, {
      type: "line",
      data: {
        labels: weekLabels,
        datasets: [{
          label: "완료된 작업", data: weekCounts, borderColor: "#06b6d4",
          backgroundColor: "rgba(6,182,212,0.1)", fill: true, tension: 0.3, pointBackgroundColor: "#06b6d4",
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
        },
      },
    });
  }
}

// ─── Notification Link Converter ────────────────────────────────────────────

function convertNotifLink(link) {
  if (!link) return null;
  if (link.startsWith("/task?") || link.startsWith("/task/?")) return link.replace(/^\/task\/?/, "task.html");
  if (link.startsWith("/project?") || link.startsWith("/project/?")) return link.replace(/^\/project\/?/, "project.html");
  const taskMatch = link.match(/^\/projects\/([^/]+)\/tasks\/([^/]+)/);
  if (taskMatch) return `task.html?projectId=${taskMatch[1]}&taskId=${taskMatch[2]}`;
  const projMatch = link.match(/^\/projects\/([^/]+)/);
  if (projMatch) return `project.html?id=${projMatch[1]}`;
  if (link === "/projects" || link === "/projects/") return "projects.html";
  if (link === "/dashboard" || link === "/dashboard/") return "dashboard.html";
  return null;
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

window.addEventListener("beforeunload", () => {
  unsubscribers.forEach((fn) => typeof fn === "function" && fn());
});
