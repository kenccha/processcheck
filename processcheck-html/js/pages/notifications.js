// ═══════════════════════════════════════════════════════════════════════════════
// Notification Center Page Controller
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage, getUser } from "../auth.js";
import { confirmModal } from "../ui/confirm-modal.js";
import { renderNav, initTheme } from "../components.js";
import {
  subscribeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../firestore-service.js";
import { escapeHtml, timeAgo, formatDate } from "../utils.js";

// ─── Init Theme (before render to avoid flash) ──────────────────────────────
initTheme();

// ─── Auth Guard ─────────────────────────────────────────────────────────────
const user = guardPage();
if (!user) throw new Error("Not authenticated");

// ─── Render Navigation ──────────────────────────────────────────────────────
const navUnsub = renderNav(document.getElementById("nav-root"));

// ─── State ──────────────────────────────────────────────────────────────────

let allNotifications = [];
let activeFilter = "all"; // all | unread | task | approval | system

const app = document.getElementById("app");
const unsubscribers = [];

// ─── Notification type classification ───────────────────────────────────────

const TYPE_CATEGORIES = {
  task_assigned: "task",
  task_completed: "task",
  deadline_approaching: "task",
  approval_request: "approval",
  approval_completed: "approval",
  approved: "approval",
  rejected: "approval",
  change_request: "system",
  system: "system",
  phase_completed: "system",
};

function getTypeCategory(type) {
  return TYPE_CATEGORIES[type] || "system";
}

function getTypeIcon(type) {
  switch (type) {
    case "task_assigned":
    case "task_completed":
      // Checkmark icon
      return `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    case "deadline_approaching":
      // Clock warning icon
      return `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    case "approval_request":
    case "approval_completed":
    case "approved":
      // Clock/hourglass icon
      return `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    case "rejected":
      // X circle icon
      return `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    default:
      // Bell icon
      return `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>`;
  }
}

function getTypeIconClass(type) {
  switch (type) {
    case "task_assigned":
    case "task_completed":
      return "nc-icon-task";
    case "deadline_approaching":
      return "nc-icon-deadline";
    case "approval_request":
    case "approval_completed":
    case "approved":
      return "nc-icon-approval";
    case "rejected":
      return "nc-icon-rejected";
    default:
      return "nc-icon-system";
  }
}

// ─── Date grouping ──────────────────────────────────────────────────────────

function getDateGroup(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (d.getTime() === today.getTime()) return "today";
  if (d.getTime() === yesterday.getTime()) return "yesterday";
  if (d.getTime() > weekAgo.getTime()) return "this_week";
  return "older";
}

function getDateGroupLabel(group) {
  switch (group) {
    case "today": return "오늘";
    case "yesterday": return "어제";
    case "this_week": return "이번 주";
    case "older": return "이전";
    default: return group;
  }
}

// ─── Filtering ──────────────────────────────────────────────────────────────

function getFilteredNotifications() {
  switch (activeFilter) {
    case "unread":
      return allNotifications.filter(n => !n.read);
    case "task":
      return allNotifications.filter(n => getTypeCategory(n.type) === "task");
    case "approval":
      return allNotifications.filter(n => getTypeCategory(n.type) === "approval");
    case "system":
      return allNotifications.filter(n => getTypeCategory(n.type) === "system");
    default:
      return allNotifications;
  }
}

function getFilterCounts() {
  const counts = { all: allNotifications.length, unread: 0, task: 0, approval: 0, system: 0 };
  for (const n of allNotifications) {
    if (!n.read) counts.unread++;
    const cat = getTypeCategory(n.type);
    if (cat === "task") counts.task++;
    else if (cat === "approval") counts.approval++;
    else counts.system++;
  }
  return counts;
}

// ─── Link resolution ────────────────────────────────────────────────────────

function resolveNotifLink(link) {
  if (!link) return null;
  // Convert Next.js style routes to HTML routes
  // /projects/proj1/tasks/task4 → task.html?id=task4
  // /projects/proj1 → project.html?id=proj1
  const taskMatch = link.match(/\/projects\/([^/]+)\/tasks\/([^/]+)/);
  if (taskMatch) return `task.html?id=${taskMatch[2]}`;
  const projMatch = link.match(/\/projects\/([^/]+)/);
  if (projMatch) return `project.html?id=${projMatch[1]}`;
  // Already an HTML link
  if (link.endsWith(".html") || link.includes(".html?")) return link;
  return null;
}

// ─── Subscription ───────────────────────────────────────────────────────────

unsubscribers.push(
  subscribeNotifications(user.id, (notifs) => {
    allNotifications = notifs;
    render();
  })
);

if (navUnsub) unsubscribers.push(navUnsub);

// ─── Render ─────────────────────────────────────────────────────────────────

function render() {
  const filtered = getFilteredNotifications();
  const counts = getFilterCounts();

  // Group by date
  const groups = [];
  const groupOrder = ["today", "yesterday", "this_week", "older"];
  const grouped = {};
  for (const n of filtered) {
    const g = getDateGroup(n.createdAt);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(n);
  }
  for (const key of groupOrder) {
    if (grouped[key] && grouped[key].length > 0) {
      groups.push({ key, label: getDateGroupLabel(key), items: grouped[key] });
    }
  }

  app.innerHTML = `
    <div class="nc-container">
      <!-- Header -->
      <div class="nc-header">
        <div class="nc-header-left">
          <h1 class="nc-title">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            알림 센터
          </h1>
          <span class="nc-header-count">${counts.unread > 0 ? `${counts.unread}개 읽지 않음` : "모두 읽음"}</span>
        </div>
        <div class="nc-header-right">
          ${counts.unread > 0 ? `
            <button class="btn btn-secondary btn-sm" id="nc-mark-all-read">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              모두 읽음
            </button>
          ` : ""}
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="nc-filters">
        <button class="nc-filter-tab${activeFilter === "all" ? " active" : ""}" data-filter="all">
          전체 <span class="nc-filter-count">${counts.all}</span>
        </button>
        <button class="nc-filter-tab${activeFilter === "unread" ? " active" : ""}" data-filter="unread">
          안읽음 <span class="nc-filter-count">${counts.unread}</span>
        </button>
        <button class="nc-filter-tab${activeFilter === "task" ? " active" : ""}" data-filter="task">
          작업 <span class="nc-filter-count">${counts.task}</span>
        </button>
        <button class="nc-filter-tab${activeFilter === "approval" ? " active" : ""}" data-filter="approval">
          승인 <span class="nc-filter-count">${counts.approval}</span>
        </button>
        <button class="nc-filter-tab${activeFilter === "system" ? " active" : ""}" data-filter="system">
          시스템 <span class="nc-filter-count">${counts.system}</span>
        </button>
      </div>

      <!-- Notification List -->
      <div class="nc-list">
        ${filtered.length === 0 ? renderEmptyState() : groups.map(g => renderGroup(g)).join("")}
      </div>
    </div>
  `;

  bindEvents();
}

function renderEmptyState() {
  let message = "새 알림이 없습니다";
  if (activeFilter === "unread") message = "읽지 않은 알림이 없습니다";
  else if (activeFilter === "task") message = "작업 관련 알림이 없습니다";
  else if (activeFilter === "approval") message = "승인 관련 알림이 없습니다";
  else if (activeFilter === "system") message = "시스템 알림이 없습니다";

  return `
    <div class="nc-empty">
      <div class="nc-empty-icon">
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
      </div>
      <div class="nc-empty-text">${message}</div>
      <button class="btn btn-secondary btn-sm" onclick="window.location.href='dashboard.html'">
        대시보드로 이동
      </button>
    </div>
  `;
}

function renderGroup(group) {
  return `
    <div class="nc-date-group">
      <div class="nc-date-divider">
        <span class="nc-date-label">${escapeHtml(group.label)}</span>
      </div>
      ${group.items.map(n => renderNotificationItem(n)).join("")}
    </div>
  `;
}

function renderNotificationItem(n) {
  const iconClass = getTypeIconClass(n.type);
  const icon = getTypeIcon(n.type);
  const link = resolveNotifLink(n.link);
  const hasLink = link !== null;

  return `
    <div class="nc-item${n.read ? "" : " nc-unread"}${hasLink ? " nc-clickable" : ""}"
         data-notif-id="${escapeHtml(n.id)}"
         ${hasLink ? `data-notif-link="${escapeHtml(link)}"` : ""}>
      <div class="nc-item-icon ${iconClass}">
        ${icon}
      </div>
      <div class="nc-item-content">
        <div class="nc-item-title">${escapeHtml(n.title)}</div>
        <div class="nc-item-message">${escapeHtml(n.message)}</div>
        <div class="nc-item-meta">
          <span class="nc-item-time">${timeAgo(n.createdAt)}</span>
          <span class="nc-item-date">${formatDate(n.createdAt)}</span>
        </div>
      </div>
      <div class="nc-item-actions">
        ${!n.read ? `
          <button class="nc-item-read-btn" data-mark-read="${escapeHtml(n.id)}" title="읽음 처리">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </button>
        ` : `
          <span class="nc-item-read-dot" title="읽음"></span>
        `}
      </div>
    </div>
  `;
}

// ─── Event Binding ──────────────────────────────────────────────────────────

function bindEvents() {
  // Filter tabs
  app.querySelectorAll("[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  // Mark all read
  const markAllBtn = app.querySelector("#nc-mark-all-read");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      if (await confirmModal("모든 알림을 읽음 처리하시겠습니까?")) {
        markAllBtn.disabled = true;
        markAllBtn.textContent = "처리 중...";
        try {
          await markAllNotificationsRead(user.id);
        } catch (e) {
          console.error("모두 읽음 처리 실패:", e);
        }
      }
    });
  }

  // Individual notification click — mark read + navigate
  app.querySelectorAll("[data-notif-id]").forEach(el => {
    el.addEventListener("click", async (e) => {
      // Ignore if clicking the individual read button
      if (e.target.closest("[data-mark-read]")) return;

      const id = el.dataset.notifId;
      const link = el.dataset.notifLink;

      // Mark as read
      const notif = allNotifications.find(n => n.id === id);
      if (notif && !notif.read) {
        try {
          await markNotificationRead(id);
        } catch (e) {
          console.error("읽음 처리 실패:", e);
        }
      }

      // Navigate
      if (link) {
        window.location.href = link;
      }
    });
  });

  // Individual read button
  app.querySelectorAll("[data-mark-read]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.markRead;
      try {
        await markNotificationRead(id);
      } catch (e) {
        console.error("읽음 처리 실패:", e);
      }
    });
  });
}

// ─── Cleanup on page unload ─────────────────────────────────────────────────

window.addEventListener("beforeunload", () => {
  unsubscribers.forEach(unsub => { if (typeof unsub === "function") unsub(); });
});
