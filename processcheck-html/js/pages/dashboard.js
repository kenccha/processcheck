// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Page Controller — Compact Tabbed Layout
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
  approveTask,
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
  PHASE_GROUPS,
  GATE_STAGES,
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
let taskLimit = 10;
let approvalLimit = 10;

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
    notifications = notifs.slice(0, 20);
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
    myProjects = allProjects.filter(
      (p) => p.status === "active" && p.pm === user.name
    );
  } else {
    const myProjectIds = new Set(allTasks.map((t) => t.projectId));
    myProjects = allProjects.filter(
      (p) => p.status === "active" && myProjectIds.has(p.id)
    );
  }
}

// ─── Date Helpers ───────────────────────────────────────────────────────────

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
  if (days <= 1) return "text-warning";
  return "text-soft";
}

function getOverdueCount() {
  return allTasks.filter((t) => {
    if (t.status === "completed" || t.status === "rejected") return false;
    const days = daysUntil(t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate));
    return days !== null && days < 0;
  }).length;
}

function getTodayDueCount() {
  return allTasks.filter((t) => {
    if (t.status === "completed" || t.status === "rejected") return false;
    const days = daysUntil(t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate));
    return days === 0;
  }).length;
}

function getThisWeekDueCount() {
  return allTasks.filter((t) => {
    if (t.status === "completed" || t.status === "rejected") return false;
    const days = daysUntil(t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate));
    return days !== null && days >= 0 && days <= 7;
  }).length;
}

function getProjectName(projectId) {
  const p = allProjects.find((proj) => proj.id === projectId);
  return p ? p.name : projectId;
}

// ─── Phase Progress Helper ──────────────────────────────────────────────────

function getPhaseDistribution(tasks) {
  const dist = PHASE_GROUPS.map((pg) => {
    const workTasks = tasks.filter((t) => t.stage === pg.workStage);
    const gateTasks = tasks.filter((t) => t.stage === pg.gateStage);
    const total = workTasks.length + gateTasks.length;
    const done = workTasks.filter((t) => t.status === "completed" && t.approvalStatus === "approved").length +
                 gateTasks.filter((t) => t.status === "completed" && t.approvalStatus === "approved").length;
    return { name: pg.name, total, done };
  });
  return dist;
}

// ─── Render ─────────────────────────────────────────────────────────────────

function render() {
  const overdueCount = getOverdueCount();
  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const todayCount = getTodayDueCount();
  const weekCount = getThisWeekDueCount();

  app.innerHTML = `
    <div class="container animate-fade-in">
      ${renderCompactHeader(overdueCount, todayCount, weekCount)}
      ${renderStatCards(overdueCount, unreadNotifCount)}
      <div class="card animate-fade-in-delay-2" style="padding: 0; overflow: hidden;">
        ${renderTabBar(unreadNotifCount)}
        <div class="dash-tab-content">
          ${activeTab === "tasks" ? renderTasksTab() : ""}
          ${activeTab === "approvals" ? renderApprovalsTab() : ""}
          ${activeTab === "projects" ? renderProjectsTab() : ""}
          ${activeTab === "notifications" ? renderNotificationsTab() : ""}
        </div>
      </div>
    </div>
  `;

  bindClickHandlers();
}

// ─── Compact Header ─────────────────────────────────────────────────────────

function renderCompactHeader(overdueCount, todayCount, weekCount) {
  return `
    <div class="dash-header mb-4 animate-fade-in">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-bold" style="color: var(--slate-100)">
          ${escapeHtml(user.name)}님
        </h1>
        <span class="badge badge-primary">${escapeHtml(getRoleName(user.role))}</span>
        <span class="text-xs text-soft">${escapeHtml(user.department || "")}</span>
      </div>
      <div class="flex items-center gap-3 text-xs flex-wrap">
        ${overdueCount > 0 ? `<span style="color: var(--danger-400)"><strong>${overdueCount}</strong> 초과</span><span class="text-soft">·</span>` : ""}
        ${todayCount > 0 ? `<span style="color: var(--warning-400)">오늘 <strong>${todayCount}</strong></span><span class="text-soft">·</span>` : ""}
        <span class="text-soft">이번 주 <strong style="color: var(--primary-400)">${weekCount}</strong>건</span>
      </div>
    </div>
  `;
}

// ─── Stat Cards ─────────────────────────────────────────────────────────────

function renderStatCards(overdueCount, unreadNotifCount) {
  return `
    <div class="dash-stat-grid mb-4 animate-fade-in-delay-1">
      <div class="dash-stat-card cursor-pointer card-hover" data-stat="tasks">
        <div class="dash-stat-label">작업 대기</div>
        <div class="dash-stat-value" style="color: var(--primary-400)">${myTasks.length}</div>
      </div>
      <div class="dash-stat-card cursor-pointer card-hover" data-stat="approvals">
        <div class="dash-stat-label">승인 대기</div>
        <div class="dash-stat-value" style="color: var(--warning-400)">${pendingApprovals.length}</div>
      </div>
      <div class="dash-stat-card cursor-pointer card-hover" data-stat="overdue">
        <div class="dash-stat-label">마감 초과</div>
        <div class="dash-stat-value" style="color: ${overdueCount > 0 ? "var(--danger-400)" : "var(--slate-500)"}">${overdueCount}</div>
      </div>
      <div class="dash-stat-card cursor-pointer card-hover" data-stat="projects">
        <div class="dash-stat-label">프로젝트</div>
        <div class="dash-stat-value" style="color: var(--success-400)">${myProjects.length}</div>
      </div>
      <div class="dash-stat-card cursor-pointer card-hover" data-stat="notifications">
        <div class="dash-stat-label">알림</div>
        <div class="dash-stat-value" style="color: ${unreadNotifCount > 0 ? "var(--danger-400)" : "var(--slate-500)"}">${unreadNotifCount}</div>
      </div>
    </div>
  `;
}

// ─── Tab Bar ────────────────────────────────────────────────────────────────

function renderTabBar(unreadNotifCount) {
  const tabs = [
    { key: "tasks", label: "내 작업", count: myTasks.length, badgeClass: "badge-neutral" },
    { key: "approvals", label: "승인 대기", count: pendingApprovals.length, badgeClass: "badge-warning" },
    { key: "projects", label: "프로젝트", count: myProjects.length, badgeClass: "badge-neutral" },
    { key: "notifications", label: "알림", count: unreadNotifCount, badgeClass: unreadNotifCount > 0 ? "badge-danger" : "badge-neutral" },
  ];

  return `
    <div class="tab-bar" style="padding: 0 0.5rem; background: var(--surface-2); border-radius: var(--radius-xl) var(--radius-xl) 0 0;">
      ${tabs.map((t) => `
        <button class="tab-btn ${activeTab === t.key ? "active" : ""}" data-tab="${t.key}">
          ${t.label}
          ${t.count > 0 ? `<span class="badge ${t.badgeClass}" style="margin-left: 4px; font-size: 0.625rem; padding: 0.0625rem 0.3rem;">${t.count}</span>` : ""}
        </button>
      `).join("")}
    </div>
  `;
}

// ─── Tasks Tab ──────────────────────────────────────────────────────────────

function renderTasksTab() {
  // Phase mini progress bar
  const phaseDist = getPhaseDistribution(allTasks);
  const hasPhaseData = phaseDist.some((p) => p.total > 0);

  const phaseBar = hasPhaseData ? `
    <div class="dash-phase-bar">
      ${phaseDist.map((p) => {
        const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
        const color = pct >= 80 ? "var(--success-400)" : pct >= 50 ? "var(--warning-400)" : p.total > 0 ? "var(--slate-500)" : "var(--surface-3)";
        return `<div class="dash-phase-item" title="${p.name}: ${p.done}/${p.total}">
          <div class="dash-phase-dot" style="background: ${color}; opacity: ${p.total > 0 ? 1 : 0.3}"></div>
          <span class="text-xs text-soft">${p.name}</span>
        </div>`;
      }).join("")}
    </div>
  ` : "";

  if (myTasks.length === 0) {
    return `
      ${phaseBar}
      <div class="empty-state" style="padding: 3rem 1rem">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="empty-state-text">${user.role === "worker" ? "3일 이내 마감 예정인 작업이 없습니다" : "대기 중인 작업이 없습니다"}</span>
      </div>
    `;
  }

  const visible = myTasks.slice(0, taskLimit);
  const remaining = myTasks.length - taskLimit;

  return `
    ${phaseBar}
    ${visible.map((task) => `
      <div class="dash-row cursor-pointer" data-task-project="${task.projectId}" data-task-id="${task.id}">
        <div class="flex items-center gap-2 flex-1" style="min-width: 0">
          <span class="dash-row-dot ${getDateColorClass(task.dueDate) === "text-danger" ? "dot-danger" : getDateColorClass(task.dueDate) === "text-warning" ? "dot-warning" : "dot-default"}"></span>
          <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(task.title)}</span>
          <span class="badge ${getStatusBadgeClass(task.status)}" style="flex-shrink: 0; font-size: 0.625rem; padding: 0.0625rem 0.3rem;">${getStatusLabel(task.status)}</span>
        </div>
        <div class="flex items-center gap-3 flex-shrink-0">
          <span class="text-xs text-soft">${escapeHtml(task.department || "").split("+")[0]}</span>
          <span class="font-mono text-xs font-semibold ${getDateColorClass(task.dueDate)}" style="min-width: 3rem; text-align: right;">${formatDueDate(task.dueDate)}</span>
        </div>
      </div>
    `).join("")}
    ${remaining > 0 ? `
      <div class="dash-show-more" id="btn-show-more-tasks">
        나머지 ${remaining}건 더 보기
      </div>
    ` : ""}
  `;
}

// ─── Approvals Tab ──────────────────────────────────────────────────────────

function renderApprovalsTab() {
  if (pendingApprovals.length === 0) {
    return `
      <div class="empty-state" style="padding: 3rem 1rem">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="empty-state-text">승인 대기 중인 작업이 없습니다</span>
      </div>
    `;
  }

  // Group by project
  const grouped = {};
  pendingApprovals.forEach((t) => {
    if (!grouped[t.projectId]) grouped[t.projectId] = [];
    grouped[t.projectId].push(t);
  });

  const canApprove = user.role === "manager" || user.role === "observer";
  const visible = pendingApprovals.slice(0, approvalLimit);
  const remaining = pendingApprovals.length - approvalLimit;

  // Group visible items
  const visibleGrouped = {};
  visible.forEach((t) => {
    if (!visibleGrouped[t.projectId]) visibleGrouped[t.projectId] = [];
    visibleGrouped[t.projectId].push(t);
  });

  return `
    ${Object.entries(visibleGrouped).map(([projId, tasks]) => `
      <div class="dash-group-header">
        <span class="text-xs font-semibold" style="color: var(--slate-400)">${escapeHtml(getProjectName(projId))}</span>
        <span class="badge badge-neutral" style="font-size: 0.625rem; padding: 0.0625rem 0.3rem;">${tasks.length}</span>
      </div>
      ${tasks.map((task) => `
        <div class="dash-row ${canApprove ? "" : "cursor-pointer"}" data-task-project="${task.projectId}" data-task-id="${task.id}">
          <div class="flex items-center gap-2 flex-1" style="min-width: 0">
            <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(task.title)}</span>
            <span class="badge badge-success" style="flex-shrink: 0; font-size: 0.625rem; padding: 0.0625rem 0.3rem;">완료</span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-xs text-soft">${task.completedDate ? formatDate(task.completedDate) : ""}</span>
            ${canApprove ? `<button class="dash-approve-btn" data-approve-id="${task.id}" title="승인">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            </button>` : ""}
          </div>
        </div>
      `).join("")}
    `).join("")}
    ${remaining > 0 ? `
      <div class="dash-show-more" id="btn-show-more-approvals">
        나머지 ${remaining}건 더 보기
      </div>
    ` : ""}
  `;
}

// ─── Projects Tab ───────────────────────────────────────────────────────────

function renderProjectsTab() {
  if (myProjects.length === 0) {
    return `
      <div class="empty-state" style="padding: 3rem 1rem">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <span class="empty-state-text">배정된 프로젝트가 없습니다</span>
      </div>
    `;
  }

  return `
    <div class="dash-project-grid">
      ${myProjects.map((project) => {
        const phaseDist = getPhaseDistribution(
          allTasks.filter((t) => t.projectId === project.id)
        );
        return `
          <div class="dash-project-card cursor-pointer" data-project-id="${project.id}">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2 flex-1" style="min-width: 0">
                <span class="risk-dot ${project.riskLevel || "green"}"></span>
                <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(project.name)}</span>
              </div>
              <span class="font-mono text-xs font-semibold" style="color: var(--primary-400)">${project.progress || 0}%</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-soft mb-2">
              <span>${escapeHtml(project.productType || "")}</span>
              <span>PM: ${escapeHtml(project.pm || "-")}</span>
              <span class="badge badge-${getRiskClass(project.riskLevel)}" style="font-size: 0.625rem; padding: 0.0625rem 0.3rem;">${getRiskLabel(project.riskLevel)}</span>
            </div>
            <div class="progress-bar" style="height: 0.25rem; margin-bottom: 0.5rem;">
              <div class="progress-fill ${getProgressClass(project.progress || 0)}" style="width: ${project.progress || 0}%"></div>
            </div>
            <div class="dash-phase-dots">
              ${phaseDist.map((p) => {
                if (p.total === 0) return `<span class="phase-dot dot-empty" title="${p.name}: -"></span>`;
                const pct = Math.round((p.done / p.total) * 100);
                const cls = pct >= 100 ? "dot-done" : pct >= 50 ? "dot-half" : pct > 0 ? "dot-partial" : "dot-empty";
                return `<span class="phase-dot ${cls}" title="${p.name}: ${p.done}/${p.total} (${pct}%)"></span>`;
              }).join("")}
            </div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="dash-show-more" id="btn-view-all-projects" style="border-top: 1px solid var(--surface-3);">
      전체 보기 →
    </div>
  `;
}

// ─── Notifications Tab ──────────────────────────────────────────────────────

function renderNotificationsTab() {
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (notifications.length === 0) {
    return `
      <div class="empty-state" style="padding: 3rem 1rem">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span class="empty-state-text">알림이 없습니다</span>
      </div>
    `;
  }

  return `
    ${unreadCount > 0 ? `
      <div style="padding: 0.5rem 1rem; border-bottom: 1px solid var(--surface-3); text-align: right;">
        <button class="btn-ghost btn-sm" id="btn-mark-all-read" style="font-size: 0.75rem;">모두 읽음</button>
      </div>
    ` : ""}
    ${notifications.map((notif) => `
      <div class="dash-notif-item cursor-pointer" data-notif-id="${notif.id}" data-notif-link="${escapeHtml(notif.link || "")}" style="${!notif.read ? "border-left: 3px solid var(--primary-500);" : ""}">
        <div class="flex items-start gap-2">
          ${!notif.read
            ? `<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--primary-400); margin-top: 6px; flex-shrink: 0;"></span>`
            : `<span style="width: 6px; height: 6px; margin-top: 6px; flex-shrink: 0;"></span>`
          }
          <div style="flex: 1; min-width: 0;">
            <div class="text-sm truncate" style="color: ${!notif.read ? "var(--slate-100)" : "var(--slate-300)"}; font-weight: ${!notif.read ? 600 : 400}; margin-bottom: 0.125rem;">
              ${escapeHtml(notif.title)}
            </div>
            <div class="text-xs" style="color: var(--slate-500); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">
              ${escapeHtml(notif.message)}
            </div>
            <div class="text-xs" style="color: var(--slate-600); margin-top: 0.125rem;">
              ${timeAgo(notif.createdAt)}
            </div>
          </div>
        </div>
      </div>
    `).join("")}
  `;
}

// ─── Click Handlers ─────────────────────────────────────────────────────────

function bindClickHandlers() {
  // Tab switching
  app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      taskLimit = 10;
      approvalLimit = 10;
      render();
    });
  });

  // Stat cards → tab switching
  app.querySelectorAll("[data-stat]").forEach((card) => {
    card.addEventListener("click", () => {
      const stat = card.dataset.stat;
      if (stat === "tasks" || stat === "overdue") activeTab = "tasks";
      else if (stat === "approvals") activeTab = "approvals";
      else if (stat === "projects") { window.location.href = "projects.html"; return; }
      else if (stat === "notifications") activeTab = "notifications";
      taskLimit = 10;
      approvalLimit = 10;
      render();
    });
  });

  // Show more buttons
  const showMoreTasks = app.querySelector("#btn-show-more-tasks");
  if (showMoreTasks) {
    showMoreTasks.addEventListener("click", () => {
      taskLimit += 10;
      render();
    });
  }

  const showMoreApprovals = app.querySelector("#btn-show-more-approvals");
  if (showMoreApprovals) {
    showMoreApprovals.addEventListener("click", () => {
      approvalLimit += 10;
      render();
    });
  }

  // Task rows → navigate
  app.querySelectorAll(".dash-row[data-task-id]").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".dash-approve-btn")) return;
      const projectId = row.dataset.taskProject;
      const taskId = row.dataset.taskId;
      window.location.href = `task.html?projectId=${projectId}&taskId=${taskId}`;
    });
  });

  // Project cards → navigate
  app.querySelectorAll(".dash-project-card[data-project-id]").forEach((card) => {
    card.addEventListener("click", () => {
      window.location.href = `project.html?id=${card.dataset.projectId}`;
    });
  });

  // View all projects
  const viewAllBtn = app.querySelector("#btn-view-all-projects");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = "projects.html";
    });
  }

  // Approve buttons (inline)
  app.querySelectorAll(".dash-approve-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.approveId;
      btn.disabled = true;
      btn.innerHTML = `<span class="text-xs">...</span>`;
      try {
        await approveTask(taskId, user.name);
      } catch (err) {
        console.error("승인 실패:", err);
        btn.innerHTML = `<span class="text-xs text-danger">실패</span>`;
      }
    });
  });

  // Mark all notifications as read
  const markAllBtn = app.querySelector("#btn-mark-all-read");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      markAllBtn.disabled = true;
      markAllBtn.textContent = "처리 중...";
      const unread = notifications.filter((n) => !n.read);
      for (const n of unread) {
        try { await markNotificationRead(n.id); } catch (e) { console.error(e); }
      }
    });
  }

  // Notification items → mark as read + navigate
  app.querySelectorAll(".dash-notif-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const notifId = item.dataset.notifId;
      const link = item.dataset.notifLink;
      await markNotificationRead(notifId);
      if (link) {
        const htmlLink = convertNotifLink(link);
        if (htmlLink) window.location.href = htmlLink;
      }
    });
  });
}

// ─── Notification Link Converter ────────────────────────────────────────────

function convertNotifLink(link) {
  if (!link) return null;
  if (link.startsWith("/task?") || link.startsWith("/task/?")) {
    return link.replace(/^\/task\/?/, "task.html");
  }
  if (link.startsWith("/project?") || link.startsWith("/project/?")) {
    return link.replace(/^\/project\/?/, "project.html");
  }
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
