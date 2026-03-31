// ═══════════════════════════════════════════════════════════════════════════════
// Activity Log Page Controller — 전체 시스템 감사 로그
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage } from "../auth.js";
import { renderNav, initTheme } from "../components.js";
import { subscribeAllActivityLogs, subscribeProjects } from "../firestore-service.js";
import { escapeHtml, formatDateTime, timeAgo, exportToCSV, toLocalDateStr } from "../utils.js";

// ─── State ──────────────────────────────────────────────────────────────────
let currentUser = null;
let allLogs = [];
let projects = [];
let activeFilter = "all"; // all, complete_task, approve_task, reject_task, restart_task, add_comment
let searchQuery = "";
let visibleCount = 50;

// ─── Action Metadata ────────────────────────────────────────────────────────
const ACTION_META = {
  complete_task: {
    label: "작업 완료",
    icon: `<svg width="16" height="16" fill="none" stroke="var(--success)" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
    color: "success",
  },
  approve_task: {
    label: "승인",
    icon: `<svg width="16" height="16" fill="none" stroke="var(--primary)" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    color: "primary",
  },
  reject_task: {
    label: "반려",
    icon: `<svg width="16" height="16" fill="none" stroke="var(--danger)" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    color: "danger",
  },
  restart_task: {
    label: "재작업",
    icon: `<svg width="16" height="16" fill="none" stroke="var(--warning)" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`,
    color: "warning",
  },
  add_comment: {
    label: "코멘트",
    icon: `<svg width="16" height="16" fill="none" stroke="var(--text-secondary)" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
    color: "neutral",
  },
};

function getActionMeta(action) {
  return ACTION_META[action] || { label: action, icon: "", color: "neutral" };
}

// ─── Init ───────────────────────────────────────────────────────────────────
async function init() {
  initTheme();
  currentUser = guardPage();
  if (!currentUser) return;
  renderNav(document.getElementById("nav-root"), currentUser);

  // Subscribe to activity logs (larger limit for this page)
  subscribeAllActivityLogs((logs) => {
    allLogs = logs;
    render();
  }, 500);

  // Subscribe to projects for name lookup
  subscribeProjects((projs) => {
    projects = projs;
  });
}

// ─── Filtering ──────────────────────────────────────────────────────────────
function getFilteredLogs() {
  let filtered = allLogs;

  // Action filter
  if (activeFilter !== "all") {
    filtered = filtered.filter(l => l.action === activeFilter);
  }

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(l =>
      (l.userName || "").toLowerCase().includes(q) ||
      (l.action || "").toLowerCase().includes(q) ||
      (l.targetId || "").toLowerCase().includes(q) ||
      (l.details?.content || "").toLowerCase().includes(q) ||
      (l.details?.reason || "").toLowerCase().includes(q) ||
      getProjectName(l.details?.projectId || l.targetId).toLowerCase().includes(q)
    );
  }

  return filtered;
}

function getProjectName(id) {
  const p = projects.find(p => p.id === id);
  return p ? p.name : "";
}

// ─── Date Grouping ──────────────────────────────────────────────────────────
function getDateGroup(date) {
  const now = new Date();
  const d = new Date(date);
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((now - d) / 86400000);

  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff <= 7) return "이번 주";
  if (diff <= 30) return "이번 달";
  return "이전";
}

function groupLogsByDate(logs) {
  const groups = {};
  const order = ["오늘", "어제", "이번 주", "이번 달", "이전"];
  for (const log of logs) {
    const group = getDateGroup(log.timestamp);
    if (!groups[group]) groups[group] = [];
    groups[group].push(log);
  }
  return order.filter(g => groups[g]).map(g => ({ label: g, logs: groups[g] }));
}

// ─── Stats ──────────────────────────────────────────────────────────────────
function getStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLogs = allLogs.filter(l => {
    const d = new Date(l.timestamp);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  return {
    total: allLogs.length,
    today: todayLogs.length,
    completions: allLogs.filter(l => l.action === "complete_task").length,
    approvals: allLogs.filter(l => l.action === "approve_task").length,
    rejections: allLogs.filter(l => l.action === "reject_task").length,
    comments: allLogs.filter(l => l.action === "add_comment").length,
  };
}

// ─── Render ─────────────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById("app");
  const stats = getStats();
  const filtered = getFilteredLogs();
  const groups = groupLogsByDate(filtered.slice(0, visibleCount));
  const hasMore = filtered.length > visibleCount;

  const filterCounts = {
    all: allLogs.length,
    complete_task: allLogs.filter(l => l.action === "complete_task").length,
    approve_task: allLogs.filter(l => l.action === "approve_task").length,
    reject_task: allLogs.filter(l => l.action === "reject_task").length,
    restart_task: allLogs.filter(l => l.action === "restart_task").length,
    add_comment: allLogs.filter(l => l.action === "add_comment").length,
  };

  app.innerHTML = `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <h1 style="margin:0;font-size:1.5rem;">활동 로그</h1>
        <p style="margin:4px 0 0;color:var(--text-secondary);font-size:0.85rem;">시스템 전체 활동 내역을 실시간으로 확인합니다</p>
      </div>
      <button class="btn btn-secondary" id="btn-export-csv" style="display:flex;align-items:center;gap:6px;">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        CSV 내보내기
      </button>
    </div>

    <!-- Stats Cards -->
    <div class="act-stats">
      <div class="act-stat-card">
        <div class="act-stat-num">${stats.total}</div>
        <div class="act-stat-label">전체 활동</div>
      </div>
      <div class="act-stat-card">
        <div class="act-stat-num" style="color:var(--primary)">${stats.today}</div>
        <div class="act-stat-label">오늘</div>
      </div>
      <div class="act-stat-card">
        <div class="act-stat-num" style="color:var(--success)">${stats.completions}</div>
        <div class="act-stat-label">완료</div>
      </div>
      <div class="act-stat-card">
        <div class="act-stat-num" style="color:var(--primary)">${stats.approvals}</div>
        <div class="act-stat-label">승인</div>
      </div>
      <div class="act-stat-card">
        <div class="act-stat-num" style="color:var(--danger)">${stats.rejections}</div>
        <div class="act-stat-label">반려</div>
      </div>
      <div class="act-stat-card">
        <div class="act-stat-num" style="color:var(--text-secondary)">${stats.comments}</div>
        <div class="act-stat-label">코멘트</div>
      </div>
    </div>

    <!-- Search + Filter -->
    <div class="act-toolbar">
      <div class="act-search-wrap">
        <svg width="16" height="16" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/></svg>
        <input type="text" id="act-search" class="act-search-input" placeholder="이름, 프로젝트, 내용으로 검색..." value="${escapeHtml(searchQuery)}">
      </div>
    </div>

    <div class="act-filters">
      ${renderFilterTab("all", "전체", filterCounts.all)}
      ${renderFilterTab("complete_task", "완료", filterCounts.complete_task)}
      ${renderFilterTab("approve_task", "승인", filterCounts.approve_task)}
      ${renderFilterTab("reject_task", "반려", filterCounts.reject_task)}
      ${renderFilterTab("restart_task", "재작업", filterCounts.restart_task)}
      ${renderFilterTab("add_comment", "코멘트", filterCounts.add_comment)}
    </div>

    <!-- Activity Feed -->
    <div class="act-feed">
      ${groups.length === 0 ? renderEmptyState() : groups.map(g => `
        <div class="act-date-group">
          <div class="act-date-label">${escapeHtml(g.label)}</div>
          ${g.logs.map(renderLogItem).join("")}
        </div>
      `).join("")}

      ${hasMore ? `
        <div style="text-align:center;padding:20px;">
          <button class="btn btn-secondary" id="btn-load-more">
            더 보기 (${filtered.length - visibleCount}건 더)
          </button>
        </div>
      ` : ""}
    </div>
  `;

  bindEvents();
}

function renderFilterTab(key, label, count) {
  const active = activeFilter === key ? "active" : "";
  return `<button class="act-filter-tab ${active}" data-filter="${key}">
    ${escapeHtml(label)} <span class="act-filter-count">${count}</span>
  </button>`;
}

function renderLogItem(log) {
  const meta = getActionMeta(log.action);
  const projName = getProjectName(log.details?.projectId || "");
  const taskLink = log.targetType === "task" && log.targetId && log.details?.projectId
    ? `task.html?projectId=${encodeURIComponent(log.details.projectId)}&taskId=${encodeURIComponent(log.targetId)}`
    : null;

  let detail = "";
  if (log.details?.reason) {
    detail = `<span class="act-detail-reason">사유: ${escapeHtml(log.details.reason)}</span>`;
  } else if (log.details?.content) {
    detail = `<span class="act-detail-content">"${escapeHtml(log.details.content.substring(0, 80))}${log.details.content.length > 80 ? "..." : ""}"</span>`;
  }

  return `
    <div class="act-log-item" ${taskLink ? `data-link="${taskLink}" style="cursor:pointer"` : ""}>
      <div class="act-log-icon act-log-icon-${meta.color}">${meta.icon}</div>
      <div class="act-log-body">
        <div class="act-log-main">
          <strong>${escapeHtml(log.userName || "시스템")}</strong>
          <span class="act-log-action badge badge-${meta.color === "neutral" ? "info" : meta.color}" style="font-size:0.7rem;">${escapeHtml(meta.label)}</span>
          ${projName ? `<span class="act-log-project">${escapeHtml(projName)}</span>` : ""}
        </div>
        ${detail ? `<div class="act-log-detail">${detail}</div>` : ""}
        <div class="act-log-time">${timeAgo(log.timestamp)} &middot; ${formatDateTime(log.timestamp)}</div>
      </div>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="act-empty">
      <svg width="48" height="48" fill="none" stroke="var(--text-muted)" viewBox="0 0 24 24" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
      <h3 style="margin:12px 0 4px;color:var(--text-primary)">활동 기록이 없습니다</h3>
      <p style="color:var(--text-muted);margin:0">작업 완료, 승인, 코멘트 등의 활동이 여기에 표시됩니다</p>
    </div>
  `;
}

// ─── Event Binding ──────────────────────────────────────────────────────────
function bindEvents() {
  const app = document.getElementById("app");

  // Filter tabs
  app.querySelectorAll(".act-filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.filter;
      visibleCount = 50;
      render();
    });
  });

  // Search
  const searchInput = document.getElementById("act-search");
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = e.target.value;
        visibleCount = 50;
        render();
        // Restore focus
        const newInput = document.getElementById("act-search");
        if (newInput) {
          newInput.focus();
          newInput.setSelectionRange(newInput.value.length, newInput.value.length);
        }
      }, 300);
    });
  }

  // Load more
  const loadMore = document.getElementById("btn-load-more");
  if (loadMore) {
    loadMore.addEventListener("click", () => {
      visibleCount += 50;
      render();
    });
  }

  // CSV export
  const exportBtn = document.getElementById("btn-export-csv");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const filtered = getFilteredLogs();
      exportToCSV(filtered, [
        { label: "시간", key: (r) => formatDateTime(r.timestamp) },
        { label: "사용자", key: "userName" },
        { label: "액션", key: (r) => getActionMeta(r.action).label },
        { label: "대상", key: "targetType" },
        { label: "대상 ID", key: "targetId" },
        { label: "상세", key: (r) => r.details?.reason || r.details?.content || "" },
      ], `활동로그_${toLocalDateStr(new Date())}.csv`);
    });
  }

  // Click log item → navigate
  app.querySelectorAll(".act-log-item[data-link]").forEach(item => {
    item.addEventListener("click", () => {
      window.location.href = item.dataset.link;
    });
  });
}

// ─── Start ──────────────────────────────────────────────────────────────────
init();
