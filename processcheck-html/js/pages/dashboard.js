// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard Page Controller — Project-Centric View (D-Day + Delay Focus)
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage } from "../auth.js";
import { renderNav, initTheme } from "../components.js";
initTheme();
import {
  subscribeChecklistItemsByAssignee,
  subscribeAllChecklistItems,
  subscribeProjects,
  subscribeNotifications,
  markNotificationRead,
  fallbackLoadProjects,
  fallbackLoadChecklistItemsByAssignee,
  fallbackLoadNotifications,
  loadDashboardActiveTasks,
  loadDashboardPendingApprovals,
  getTemplateStages,
  checkAndCreateEscalations,
} from "../firestore-service.js";
import {
  escapeHtml,
  getRoleName,
  formatDate,
  timeAgo,
  daysUntil,
  PHASE_GROUPS,
} from "../utils.js";
import { saveViewState, loadViewState } from "../ui/view-state.js";
import { renderSkeletonStats, renderSkeletonCards } from "../ui/skeleton.js";

// ─── Auth Guard ─────────────────────────────────────────────────────────────

const user = guardPage();
if (!user) throw new Error("Not authenticated");

// ─── Render Navigation ──────────────────────────────────────────────────────

const navUnsub = renderNav(document.getElementById("nav-root"));

// ─── State ──────────────────────────────────────────────────────────────────

let allProjects = [];
let allTasks = [];
let notifications = [];

// Dynamic phase groups
let dynamicPhaseGroups = [];
function getActivePhaseGroups() {
  return dynamicPhaseGroups.length > 0 ? dynamicPhaseGroups : PHASE_GROUPS;
}
getTemplateStages().then((stages) => {
  dynamicPhaseGroups = stages.map(s => ({
    id: s.id, name: s.name, workStage: s.workStageName, gateStage: s.gateStageName,
  }));
}).catch(() => {});

// Derived state
let projectCards = []; // enriched project data
let myTasks = [];
let pendingApprovals = [];
let unassignedTasks = [];
let urgencyGroups = { overdue: [], today: [], thisWeek: [], later: [] };

// UI state
const _savedDash = loadViewState('dashboard');
let activeTab = (_savedDash && _savedDash.activeTab) || "projects";
let showLaterTasks = false;
let approvalLimit = 10;
let _hasFullData = false;

const app = document.getElementById("app");
const unsubscribers = [];

// ─── SessionStorage Cache ───────────────────────────────────────────────────

const CACHE_KEY = `pc_dash_${user.id}`;
const CACHE_TTL = 120_000;

function loadFromCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    parsed.tasks.forEach((t) => {
      t.dueDate = new Date(t.dueDate);
      if (t.completedDate) t.completedDate = new Date(t.completedDate);
    });
    parsed.projects.forEach((p) => {
      p.startDate = new Date(p.startDate);
      p.endDate = new Date(p.endDate);
    });
    parsed.notifs.forEach((n) => {
      n.createdAt = new Date(n.createdAt);
    });
    return parsed;
  } catch {
    sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function saveToCache(tasks, projects, notifs) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ tasks, projects, notifs, ts: Date.now() })
    );
  } catch { /* ignore storage errors */ }
}

// ─── Phase 0: Instant render from cache ─────────────────────────────────────

if (navUnsub) unsubscribers.push(navUnsub);

const cached = loadFromCache();
if (cached) {
  allTasks = cached.tasks;
  allProjects = cached.projects;
  notifications = cached.notifs;
  computeDerived();
  render();
} else {
  // Show skeleton before data arrives
  if (app) app.innerHTML = `<div class="container">${renderSkeletonStats(4)}${renderSkeletonCards(4)}</div>`;
}

// ─── Phase 1 + 2: Fast targeted queries → background subscriptions ──────────

(async () => {
  try {
    let tasks;
    if (user.role === "worker") {
      tasks = await fallbackLoadChecklistItemsByAssignee(user.name);
    } else {
      const dept = user.role === "manager" ? user.department : null;
      const [activeTasks, approvalTasks] = await Promise.all([
        loadDashboardActiveTasks(dept),
        loadDashboardPendingApprovals(dept),
      ]);
      const seen = new Set();
      tasks = [];
      for (const t of [...activeTasks, ...approvalTasks]) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          tasks.push(t);
        }
      }
    }

    const [projects, notifs] = await Promise.all([
      fallbackLoadProjects(),
      fallbackLoadNotifications(user.id),
    ]);

    allTasks = tasks;
    allProjects = projects;
    notifications = notifs.slice(0, 20);
    computeDerived();
    render();
    saveToCache(tasks, projects, notifs.slice(0, 20));

    // 에스컬레이션 체크 (백그라운드, 하루 1회)
    checkAndCreateEscalations(user).catch(() => {});
  } catch (e) {
    console.error("초기 로딩 오류:", e);
  }

  // Background subscriptions
  unsubscribers.push(
    subscribeProjects((projects) => {
      allProjects = projects;
      window.__pcProjects = projects;
      computeDerived();
      render();
    })
  );

  if (user.role === "observer" || user.role === "manager" || user.role === "admin") {
    unsubscribers.push(
      subscribeAllChecklistItems((tasks) => {
        if (user.role === "manager") {
          allTasks = tasks.filter((t) => t.department === user.department);
        } else {
          allTasks = tasks;
        }
        _hasFullData = true;
        computeDerived();
        render();
      })
    );
  } else {
    unsubscribers.push(
      subscribeChecklistItemsByAssignee(user.name, (tasks) => {
        allTasks = tasks;
        _hasFullData = true;
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
})();

// ─── Derived State Computation ──────────────────────────────────────────────

function computeDerived() {
  // --- Project cards (enriched with D-Day, delay, etc.) ---
  const activeProjects = allProjects.filter((p) => p.status === "active");

  projectCards = activeProjects.map((project) => {
    const projectTasks = allTasks.filter((t) => t.projectId === project.id);
    const dDay = daysUntil(project.endDate);

    // Current phase: first phase with incomplete tasks
    let currentPhase = null;
    for (const pg of getActivePhaseGroups()) {
      const phaseTasks = projectTasks.filter(
        (t) => t.stage === pg.workStage || t.stage === pg.gateStage
      );
      if (phaseTasks.length === 0) continue;
      const allDone = phaseTasks.every((t) => t.status === "completed");
      if (!allDone) {
        currentPhase = pg.name;
        break;
      }
    }

    // Overdue tasks
    const overdueTasks = projectTasks.filter((t) => {
      if (t.status === "completed" || t.status === "rejected") return false;
      const d = daysUntil(t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate));
      return d !== null && d < 0;
    });

    // Delay reason: most overdue task
    let delayReason = null;
    let maxDelay = 0;
    overdueTasks.forEach((t) => {
      const d = Math.abs(daysUntil(t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate)));
      if (d > maxDelay) {
        maxDelay = d;
        delayReason = {
          department: t.department || "미정",
          title: t.title,
          days: d,
          assignee: t.assignee || "미배분",
        };
      }
    });

    // Pending assignment (no assignee)
    const pendingAssignment = projectTasks.filter(
      (t) => (t.status === "pending" || t.status === "in_progress") && !t.assignee
    ).length;

    return {
      ...project,
      dDay,
      currentPhase,
      delayReason,
      maxDelay,
      overdueCount: overdueTasks.length,
      pendingAssignment,
      totalTasks: projectTasks.length,
      activeTasks: projectTasks.filter((t) => t.status !== "completed").length,
    };
  });

  // Sort: delayed first → then by D-Day ascending
  projectCards.sort((a, b) => {
    if (a.overdueCount > 0 && b.overdueCount === 0) return -1;
    if (a.overdueCount === 0 && b.overdueCount > 0) return 1;
    return (a.dDay ?? 999) - (b.dDay ?? 999);
  });

  // --- My tasks with urgency grouping ---
  const activeTasks = allTasks.filter(
    (t) => t.status === "pending" || t.status === "in_progress"
  );

  if (user.role === "worker") {
    myTasks = activeTasks.filter((t) => t.assignee === user.name);
  } else {
    myTasks = activeTasks;
  }

  myTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Urgency grouping
  urgencyGroups = { overdue: [], today: [], thisWeek: [], later: [] };
  myTasks.forEach((t) => {
    const d = daysUntil(t.dueDate instanceof Date ? t.dueDate : new Date(t.dueDate));
    if (d === null) {
      urgencyGroups.later.push(t);
    } else if (d < 0) {
      urgencyGroups.overdue.push(t);
    } else if (d === 0) {
      urgencyGroups.today.push(t);
    } else if (d <= 7) {
      urgencyGroups.thisWeek.push(t);
    } else {
      urgencyGroups.later.push(t);
    }
  });

  // --- Unassigned tasks (for managers) ---
  unassignedTasks = [];
  if (user.role === "manager" || user.role === "observer" || user.role === "admin") {
    unassignedTasks = allTasks.filter(
      (t) => (t.status === "pending" || t.status === "in_progress") && !t.assignee
    );
  }

  // 승인 절차 제거됨
  pendingApprovals = [];
}

// ─── Date Helpers ───────────────────────────────────────────────────────────

function formatDDay(days) {
  if (days === null || days === undefined) return "-";
  if (days < 0) return `D+${Math.abs(days)}`;
  if (days === 0) return "D-Day";
  return `D-${days}`;
}

function getDDayColor(days) {
  if (days === null || days === undefined) return "var(--slate-400)";
  if (days < 0) return "var(--danger-400)";
  if (days <= 3) return "var(--warning-400)";
  if (days <= 7) return "var(--primary-400)";
  return "var(--success-400)";
}

function getProjectName(projectId) {
  const p = allProjects.find((proj) => proj.id === projectId);
  return p ? p.name : projectId;
}

// ─── Today Helper ───────────────────────────────────────────────────────────

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = dayNames[now.getDay()];
  return `${year}년 ${month}월 ${date}일 (${dayName})`;
}

// ─── Main Render ────────────────────────────────────────────────────────────

function render() {
  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const delayedProjects = projectCards.filter((p) => p.overdueCount > 0).length;
  const urgentCount = urgencyGroups.overdue.length + urgencyGroups.today.length;

  app.innerHTML = `
    <div class="container animate-fade-in">
      ${renderHeader()}
      ${renderStatCards(delayedProjects, urgentCount, unreadNotifCount)}
      <div class="card animate-fade-in-delay-2" style="padding: 0; overflow: hidden;">
        ${renderTabBar(unreadNotifCount)}
        <div class="dash-tab-content">
          ${activeTab === "projects" ? renderProjectsTab() : ""}
          ${activeTab === "tasks" ? renderTasksTab() : ""}
          ${activeTab === "notifications" ? renderNotificationsTab() : ""}
        </div>
      </div>
    </div>
  `;

  bindClickHandlers();
}

// ─── Header ─────────────────────────────────────────────────────────────────

function renderHeader() {
  return `
    <div class="dash-header mb-4 animate-fade-in">
      <div class="flex items-center gap-3">
        <h1 class="text-xl font-bold" style="color: var(--slate-100)">
          ${escapeHtml(user.name)}님
        </h1>
        <span class="badge badge-primary">${escapeHtml(getRoleName(user.role))}</span>
      </div>
      <div class="text-xs text-soft">${getTodayString()} &nbsp;·&nbsp; <a href="reports.html" style="color:var(--primary-400);text-decoration:underline;">리포트 보기 →</a></div>
    </div>
  `;
}

// ─── Stat Cards ─────────────────────────────────────────────────────────────

function renderStatCards(delayedProjects, urgentCount, unreadNotifCount) {
  return `
    <div class="dash-stat-grid mb-4 animate-fade-in-delay-1">
      <div class="dash-stat-card cursor-pointer card-hover" data-stat="projects">
        <div class="dash-stat-label">프로젝트</div>
        <div class="dash-stat-value" style="color: var(--primary-400)">${projectCards.length}</div>
        ${delayedProjects > 0 ? `<div class="text-xs" style="color: var(--danger-400); margin-top: 2px;">지연 ${delayedProjects}건</div>` : `<div class="text-xs text-soft" style="margin-top: 2px;">정상</div>`}
      </div>
      <div class="dash-stat-card cursor-pointer card-hover" data-stat="tasks">
        <div class="dash-stat-label">긴급</div>
        <div class="dash-stat-value" style="color: ${urgentCount > 0 ? "var(--danger-400)" : "var(--slate-300)"}">${urgentCount}</div>
        <div class="text-xs" style="color: var(--slate-400); margin-top: 2px;">초과 ${urgencyGroups.overdue.length} · 오늘 ${urgencyGroups.today.length}</div>
      </div>
      <div class="dash-stat-card cursor-pointer card-hover" data-stat="notifications">
        <div class="dash-stat-label">알림</div>
        <div class="dash-stat-value" style="color: ${unreadNotifCount > 0 ? "var(--danger-400)" : "var(--slate-300)"}">${unreadNotifCount}</div>
      </div>
    </div>
  `;
}

// ─── Tab Bar ────────────────────────────────────────────────────────────────

function renderTabBar(unreadNotifCount) {
  const tabs = [
    { key: "projects", label: "프로젝트", count: projectCards.length },
    { key: "tasks", label: "내 작업", count: myTasks.length },
    { key: "notifications", label: "알림", count: unreadNotifCount, badgeClass: unreadNotifCount > 0 ? "badge-danger" : "" },
  ];

  return `
    <div class="tab-bar" style="padding: 0 0.5rem; background: var(--surface-2); border-radius: var(--radius-xl) var(--radius-xl) 0 0;">
      ${tabs
        .map(
          (t) => `
        <button class="tab-btn ${activeTab === t.key ? "active" : ""}" data-tab="${t.key}">
          ${t.label}
          ${t.count > 0 ? `<span class="badge ${t.badgeClass || "badge-neutral"}" style="margin-left: 4px; font-size: 0.625rem; padding: 0.0625rem 0.3rem;">${t.count}</span>` : ""}
        </button>
      `
        )
        .join("")}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Projects Tab — D-Day + Delay Focus
// ═══════════════════════════════════════════════════════════════════════════════

function renderProjectsTab() {
  if (projectCards.length === 0) {
    return `
      <div class="empty-state" style="padding: 3rem 1rem">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        <span class="empty-state-text">진행 중인 프로젝트가 없습니다</span>
        <a href="projects.html?type=신규개발" class="btn-primary btn-sm" style="margin-top: 0.75rem;">프로젝트 목록 보기</a>
      </div>
    `;
  }

  return `
    ${projectCards
      .map(
        (p) => `
      <div class="dash-project-row${p.overdueCount > 0 ? " delayed" : ""} cursor-pointer" data-project-id="${p.id}">
        <div class="dash-project-main">
          <div class="dash-dday" style="color: ${getDDayColor(p.dDay)};">
            ${formatDDay(p.dDay)}
          </div>
          <div class="dash-project-info">
            <div class="dash-project-title-row">
              <span class="dash-project-name">${escapeHtml(p.name)}</span>
              ${p.currentPhase ? `<span class="badge badge-primary" style="font-size:0.6rem;padding:0.1rem 0.375rem;">${escapeHtml(p.currentPhase)}</span>` : ""}
            </div>
            <div class="dash-project-status-row">
              ${
                p.delayReason
                  ? `<span class="dash-status-delay">${p.maxDelay}일 지연 — ${escapeHtml(p.delayReason.department)} ${escapeHtml(p.delayReason.title)}</span>`
                  : `<span class="dash-status-ok">정상 진행</span>`
              }
            </div>
          </div>
          <div class="dash-project-meta">
            ${p.overdueCount > 0 ? `<span class="dash-meta-danger">지연 ${p.overdueCount}</span>` : ""}
            ${p.pendingAssignment > 0 ? `<span class="dash-meta-warning">배분 ${p.pendingAssignment}</span>` : ""}
          </div>
        </div>
      </div>
    `
      )
      .join("")}
    <div class="dash-show-more" id="btn-view-all-projects" style="border-top: 1px solid var(--surface-3);">
      전체 프로젝트 목록 →
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tasks Tab — Urgency Grouped
// ═══════════════════════════════════════════════════════════════════════════════

function renderTasksTab() {
  if (myTasks.length === 0 && unassignedTasks.length === 0) {
    return `
      <div class="empty-state" style="padding: 3rem 1rem">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="empty-state-text">대기 중인 작업이 없습니다</span>
      </div>
    `;
  }

  let html = "";

  // Group 0: Unassigned (for managers/observers)
  if (unassignedTasks.length > 0 && (user.role === "manager" || user.role === "observer" || user.role === "admin")) {
    html += renderTaskGroup("미배정", unassignedTasks, "var(--warning-300)", true);
  }

  // Group 1: Overdue (D+N)
  if (urgencyGroups.overdue.length > 0) {
    html += renderTaskGroup("마감 초과", urgencyGroups.overdue, "var(--danger-400)", true);
  }

  // Group 2: Today (D-Day)
  if (urgencyGroups.today.length > 0) {
    html += renderTaskGroup("오늘 마감", urgencyGroups.today, "var(--warning-400)", true);
  }

  // Group 3: This week
  if (urgencyGroups.thisWeek.length > 0) {
    html += renderTaskGroup("이번 주", urgencyGroups.thisWeek, "var(--primary-400)", true);
  }

  // Group 4: Later (collapsed by default)
  if (urgencyGroups.later.length > 0) {
    if (showLaterTasks) {
      html += renderTaskGroup("이후", urgencyGroups.later, "var(--slate-400)", true);
      html += `<div class="dash-show-more" id="btn-hide-later">접기</div>`;
    } else {
      html += `
        <div class="dash-show-more" id="btn-show-later" style="border-top: 1px solid var(--surface-3);">
          이후 ${urgencyGroups.later.length}건 더 보기
        </div>
      `;
    }
  }

  return html;
}

function renderTaskGroup(label, tasks, color, showProjectName) {
  return `
    <div class="dash-urgency-group">
      <div class="dash-urgency-header" style="border-left: 3px solid ${color};">
        <span style="color: ${color}; font-weight: 600; font-size: 0.75rem;">${label}</span>
        <span class="badge badge-neutral" style="font-size: 0.625rem; padding: 0.0625rem 0.3rem;">${tasks.length}</span>
      </div>
      ${tasks
        .map(
          (task) => `
        <div class="dash-row cursor-pointer" data-task-project="${task.projectId}" data-task-id="${task.id}">
          <div class="flex items-center gap-2 flex-1" style="min-width: 0">
            <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(task.title)}</span>
            ${showProjectName ? `<span class="text-xs text-soft" style="flex-shrink: 0;">${escapeHtml(getProjectName(task.projectId))}</span>` : ""}
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span class="text-xs text-soft">${escapeHtml((task.department || "").split("+")[0])}</span>
            <span class="font-mono text-xs font-semibold" style="color: ${color}; min-width: 3rem; text-align: right;">${formatDDay(daysUntil(task.dueDate instanceof Date ? task.dueDate : new Date(task.dueDate)))}</span>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Approvals Tab
// ═══════════════════════════════════════════════════════════════════════════════

function _renderApprovalsTab() {
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

  const canApprove = user.role === "observer" || user.role === "admin";
  const visible = pendingApprovals.slice(0, approvalLimit);
  const remaining = pendingApprovals.length - approvalLimit;

  const visibleGrouped = {};
  visible.forEach((t) => {
    if (!visibleGrouped[t.projectId]) visibleGrouped[t.projectId] = [];
    visibleGrouped[t.projectId].push(t);
  });

  return `
    ${Object.entries(visibleGrouped)
      .map(
        ([projId, tasks]) => `
      <div class="dash-group-header">
        <span class="text-xs font-semibold" style="color: var(--slate-300)">${escapeHtml(getProjectName(projId))}</span>
        <span class="badge badge-neutral" style="font-size: 0.625rem; padding: 0.0625rem 0.3rem;">${tasks.length}</span>
      </div>
      ${tasks
        .map(
          (task) => `
        <div class="dash-row ${canApprove ? "" : "cursor-pointer"}" data-task-project="${task.projectId}" data-task-id="${task.id}">
          <div class="flex items-center gap-2 flex-1" style="min-width: 0">
            <span class="font-medium text-sm truncate" style="color: var(--slate-200)">${escapeHtml(task.title)}</span>
            <span class="badge badge-success" style="flex-shrink: 0; font-size: 0.625rem; padding: 0.0625rem 0.3rem;">완료</span>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-xs text-soft">${task.completedDate ? formatDate(task.completedDate) : ""}</span>
            ${canApprove ? `
              <button class="dash-approve-btn" data-approve-id="${task.id}" title="승인"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg></button>
              <button class="dash-reject-btn" data-reject-id="${task.id}" title="반려"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
            ` : ""}
          </div>
        </div>
      `
        )
        .join("")}
    `
      )
      .join("")}
    ${remaining > 0 ? `<div class="dash-show-more" id="btn-show-more-approvals">나머지 ${remaining}건 더 보기</div>` : ""}
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Notifications Tab
// ═══════════════════════════════════════════════════════════════════════════════

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
    ${notifications
      .map(
        (notif) => `
      <div class="dash-notif-item cursor-pointer" data-notif-id="${notif.id}" data-notif-link="${escapeHtml(notif.link || "")}" style="${notif.type?.startsWith("escalation_") ? "border-left: 3px solid var(--danger-400); background: rgba(239,68,68,0.05);" : !notif.read ? "border-left: 3px solid var(--primary-500);" : ""}">
        <div class="flex items-start gap-2">
          ${!notif.read
            ? `<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--primary-400); margin-top: 6px; flex-shrink: 0;"></span>`
            : `<span style="width: 6px; height: 6px; margin-top: 6px; flex-shrink: 0;"></span>`}
          <div style="flex: 1; min-width: 0;">
            <div class="text-sm truncate" style="color: ${!notif.read ? "var(--slate-100)" : "var(--slate-300)"}; font-weight: ${!notif.read ? 600 : 400}; margin-bottom: 0.125rem;">
              ${escapeHtml(notif.title)}
            </div>
            <div class="text-xs" style="color: var(--slate-300); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">
              ${escapeHtml(notif.message)}
            </div>
            <div class="text-xs" style="color: var(--slate-400); margin-top: 0.125rem;">
              ${timeAgo(notif.createdAt)}
            </div>
          </div>
        </div>
      </div>
    `
      )
      .join("")}
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Click Handlers
// ═══════════════════════════════════════════════════════════════════════════════

function bindClickHandlers() {
  // Tab switching
  app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      approvalLimit = 10;
      saveViewState('dashboard', { activeTab });
      render();
    });
  });

  // Stat cards → tab switching
  app.querySelectorAll("[data-stat]").forEach((card) => {
    card.addEventListener("click", () => {
      const stat = card.dataset.stat;
      if (stat === "tasks") activeTab = "tasks";
      else if (stat === "projects") activeTab = "projects";
      else if (stat === "notifications") activeTab = "notifications";
      render();
    });
  });

  // Project rows → navigate
  app.querySelectorAll("[data-project-id]").forEach((row) => {
    row.addEventListener("click", () => {
      window.location.href = `project.html?id=${row.dataset.projectId}`;
    });
  });

  // View all projects
  const viewAllBtn = app.querySelector("#btn-view-all-projects");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = "projects.html?type=신규개발";
    });
  }

  // Show/hide later tasks
  const showLaterBtn = app.querySelector("#btn-show-later");
  if (showLaterBtn) {
    showLaterBtn.addEventListener("click", () => {
      showLaterTasks = true;
      render();
    });
  }
  const hideLaterBtn = app.querySelector("#btn-hide-later");
  if (hideLaterBtn) {
    hideLaterBtn.addEventListener("click", () => {
      showLaterTasks = false;
      render();
    });
  }

  // Task rows → navigate
  app.querySelectorAll(".dash-row[data-task-id]").forEach((row) => {
    row.addEventListener("click", (_e) => {
      const projectId = row.dataset.taskProject;
      const taskId = row.dataset.taskId;
      window.location.href = `task.html?projectId=${projectId}&taskId=${taskId}`;
    });
  });

  // Mark all notifications read
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

  // Notification items
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
  if (link === "/dashboard" || link === "/dashboard/") return "projects.html?type=신규개발";
  return null;
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

window.addEventListener("beforeunload", () => {
  unsubscribers.forEach((fn) => typeof fn === "function" && fn());
});
