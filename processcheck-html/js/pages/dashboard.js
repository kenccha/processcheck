// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Page Controller
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage, getUser } from "../auth.js";
import { renderNav, renderSpinner } from "../components.js";
import {
  subscribeChecklistItemsByAssignee,
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

unsubscribers.push(
  subscribeChecklistItemsByAssignee(user.name, (tasks) => {
    allTasks = tasks;
    computeDerived();
    render();
  })
);

unsubscribers.push(
  subscribeNotifications(user.id, (notifs) => {
    notifications = notifs.slice(0, 5);
    render();
  })
);

if (navUnsub) unsubscribers.push(navUnsub);

// ─── Derived State Computation ──────────────────────────────────────────────

function computeDerived() {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 86400000);

  // Tasks that are pending or in_progress AND due within 3 days
  myTasks = allTasks
    .filter(
      (t) =>
        (t.status === "pending" || t.status === "in_progress") &&
        new Date(t.dueDate) <= threeDaysFromNow
    )
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Tasks that are completed but not yet approved
  pendingApprovals = allTasks.filter(
    (t) =>
      t.status === "completed" &&
      (!t.approvalStatus || t.approvalStatus === "pending")
  );

  // Active projects that contain at least one of the user's tasks
  const myProjectIds = new Set(allTasks.map((t) => t.projectId));
  myProjects = allProjects.filter(
    (p) => p.status === "active" && myProjectIds.has(p.id)
  );
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
  if (days === 0) return "text-warning";
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

// ─── Project Name Lookup ────────────────────────────────────────────────────

function getProjectName(projectId) {
  const p = allProjects.find((proj) => proj.id === projectId);
  return p ? p.name : projectId;
}

// ─── Render ─────────────────────────────────────────────────────────────────

function render() {
  const overdueCount = getOverdueCount();
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

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
            <span class="text-sm text-soft">
              담당 작업 <span class="font-semibold" style="color: var(--primary-400)">${myTasks.length}</span>건
            </span>
            ${
              overdueCount > 0
                ? `<span class="text-sm" style="color: var(--danger-400)">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;margin-right:2px">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                    </svg>
                    마감 초과 ${overdueCount}건
                  </span>`
                : ""
            }
          </div>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in-delay-1">
        <div class="stat-card">
          <div class="stat-card-label">작업 대기</div>
          <div class="stat-card-row">
            <span class="stat-value" style="color: var(--primary-400)">${myTasks.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">승인 대기</div>
          <div class="stat-card-row">
            <span class="stat-value" style="color: var(--warning-400)">${pendingApprovals.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">프로젝트</div>
          <div class="stat-card-row">
            <span class="stat-value" style="color: var(--success-400)">${myProjects.length}</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">미확인 알림</div>
          <div class="stat-card-row">
            <span class="stat-value" style="color: ${unreadNotifCount > 0 ? "var(--danger-400)" : "var(--slate-400)"}">${unreadNotifCount}</span>
          </div>
        </div>
      </div>

      <!-- Two Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-delay-2">

        <!-- Left Column (2/3) -->
        <div class="lg:col-span-2 flex flex-col gap-6">

          <!-- 작업 대기 Section -->
          <div class="card" style="padding: 0; overflow: hidden;">
            <div class="flex items-center justify-between" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--surface-3)">
              <div class="flex items-center gap-2">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--primary-400)">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
                <span class="section-title">작업 대기</span>
                <span class="badge badge-neutral" style="margin-left: 0.25rem">${myTasks.length}</span>
              </div>
            </div>
            <div>
              ${
                myTasks.length === 0
                  ? `<div class="empty-state" style="padding: 2.5rem 1rem">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span class="empty-state-text">3일 이내 마감 예정인 작업이 없습니다</span>
                    </div>`
                  : myTasks
                      .map(
                        (task) => `
                    <div class="task-row cursor-pointer" data-task-project="${task.projectId}" data-task-id="${task.id}" style="padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;">
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
                        <span class="text-xs" style="color: var(--slate-600)">${formatDate(task.dueDate)}</span>
                      </div>
                    </div>
                  `
                      )
                      .join("")
              }
            </div>
          </div>

          <!-- 승인 대기 Section -->
          ${
            pendingApprovals.length > 0
              ? `
            <div class="card" style="padding: 0; overflow: hidden;">
              <div class="flex items-center justify-between" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--surface-3)">
                <div class="flex items-center gap-2">
                  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--warning-400)">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span class="section-title">승인 대기</span>
                  <span class="badge badge-warning" style="margin-left: 0.25rem">${pendingApprovals.length}</span>
                </div>
              </div>
              <div>
                ${pendingApprovals
                  .map(
                    (task) => `
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
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <!-- 프로젝트 Section -->
          <div class="card" style="padding: 0; overflow: hidden;">
            <div class="flex items-center justify-between" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--surface-3)">
              <div class="flex items-center gap-2">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--success-400)">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
                <span class="section-title">프로젝트</span>
                <span class="badge badge-neutral" style="margin-left: 0.25rem">${myProjects.length}</span>
              </div>
              <button class="btn-ghost btn-sm" id="btn-view-all-projects">
                전체 보기
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
            <div>
              ${
                myProjects.length === 0
                  ? `<div class="empty-state" style="padding: 2.5rem 1rem">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                      </svg>
                      <span class="empty-state-text">배정된 프로젝트가 없습니다</span>
                    </div>`
                  : myProjects
                      .map(
                        (project) => `
                    <div class="project-row cursor-pointer" data-project-id="${project.id}" style="padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;">
                      <div class="flex items-center justify-between gap-3 mb-2">
                        <div class="flex items-center gap-2 flex-1" style="min-width: 0">
                          <span class="risk-dot ${project.riskLevel || "green"}"></span>
                          <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(project.name)}</span>
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
                    </div>
                  `
                      )
                      .join("")
              }
            </div>
          </div>
        </div>

        <!-- Right Column (1/3) -->
        <div class="lg:col-span-1">

          <!-- 알림 Panel -->
          <div class="card" style="padding: 0; overflow: hidden; position: sticky; top: 4.5rem;">
            <div class="flex items-center justify-between" style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--surface-3)">
              <div class="flex items-center gap-2">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--warning-400)">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <span class="section-title">알림</span>
                ${
                  unreadNotifCount > 0
                    ? `<span class="badge badge-danger" style="margin-left: 0.25rem">${unreadNotifCount}</span>`
                    : ""
                }
              </div>
            </div>
            <div>
              ${
                notifications.length === 0
                  ? `<div class="empty-state" style="padding: 2.5rem 1rem">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                      </svg>
                      <span class="empty-state-text">알림이 없습니다</span>
                    </div>`
                  : notifications
                      .map(
                        (notif) => `
                    <div class="notif-dash-item cursor-pointer" data-notif-id="${notif.id}" style="padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;${!notif.read ? " border-left: 3px solid var(--primary-500);" : ""}">
                      <div class="flex items-start gap-2">
                        ${
                          !notif.read
                            ? `<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--primary-400); margin-top: 6px; flex-shrink: 0;"></span>`
                            : `<span style="width: 6px; height: 6px; margin-top: 6px; flex-shrink: 0;"></span>`
                        }
                        <div style="flex: 1; min-width: 0;">
                          <div class="text-sm font-medium truncate" style="color: ${!notif.read ? "var(--slate-100)" : "var(--slate-300)"}; margin-bottom: 0.125rem">
                            ${escapeHtml(notif.title)}
                          </div>
                          <div class="text-xs" style="color: var(--slate-500); margin-bottom: 0.375rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                            ${escapeHtml(notif.message)}
                          </div>
                          <div class="text-xs" style="color: var(--slate-600)">
                            ${timeAgo(notif.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  `
                      )
                      .join("")
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // ─── Bind Click Handlers ────────────────────────────────────────────────

  // Task rows → navigate to task detail
  app.querySelectorAll(".task-row").forEach((row) => {
    row.addEventListener("click", () => {
      const projectId = row.dataset.taskProject;
      const taskId = row.dataset.taskId;
      window.location.href = `task.html?projectId=${projectId}&taskId=${taskId}`;
    });
    // Hover effect
    row.addEventListener("mouseenter", () => {
      row.style.background = "rgba(26, 34, 52, 0.5)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "";
    });
  });

  // Project rows → navigate to project detail
  app.querySelectorAll(".project-row").forEach((row) => {
    row.addEventListener("click", () => {
      const projectId = row.dataset.projectId;
      window.location.href = `project.html?id=${projectId}`;
    });
    row.addEventListener("mouseenter", () => {
      row.style.background = "rgba(26, 34, 52, 0.5)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "";
    });
  });

  // "전체 보기" button → navigate to projects page
  const viewAllBtn = app.querySelector("#btn-view-all-projects");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = "projects.html";
    });
  }

  // Notification items → mark as read
  app.querySelectorAll(".notif-dash-item").forEach((item) => {
    item.addEventListener("click", () => {
      const notifId = item.dataset.notifId;
      markNotificationRead(notifId);
    });
    item.addEventListener("mouseenter", () => {
      item.style.background = "var(--surface-3)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "";
    });
  });
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

window.addEventListener("beforeunload", () => {
  unsubscribers.forEach((fn) => typeof fn === "function" && fn());
});
