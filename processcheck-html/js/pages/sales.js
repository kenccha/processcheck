// =============================================================================
// Sales Dashboard — 영업 출시 준비 대시보드 (마케팅 실행 워크플로우)
// 5가지 뷰: 커맨드센터 | 실행보드 | D-Day 타임라인 | 거래처 현황 | 준비현황
// 5단계 파이프라인: 제품정보 → 자료제작 → 거래처배포 → 교육행사 → 출시확인
// =============================================================================

import { initTheme, getThemeIcon, toggleTheme } from "../components.js";
import { guardPage, getUser, logout } from "../auth.js";
import { showToast } from "../ui/toast.js";
import { renderSkeletonStats, renderSkeletonCards } from "../ui/skeleton.js";
import {
  subscribeProjects,
  subscribeCustomers,
} from "../firestore-service.js";
import {
  subscribeAllLaunchChecklists,
  subscribeLaunchPipelineStages,
  subscribeLaunchCategories,
  completeLaunchChecklist,
  updateLaunchChecklist,
  confirmLaunchChecklist,
  applyLaunchTemplate,
  LAUNCH_CATEGORY_LABELS,
} from "../sales-service.js";
import { escapeHtml, formatDate, daysUntil, timeAgo, getRoleName, toLocalDateStr } from "../utils.js";

initTheme();

const user = guardPage();
if (!user) throw new Error("Not authenticated");

const app = document.getElementById("app");
const navRoot = document.getElementById("nav-root");

// =============================================================================
// 5-Stage Execution Pipeline
// =============================================================================

// Dynamic pipeline stages + categories from Firestore (fallback to hardcoded defaults)
const DEFAULT_EXEC_STAGES = [
  { key: "product_info", label: "제품 정보", icon: "📋", categories: ["pricing", "regulatory"] },
  { key: "materials",    label: "자료 제작", icon: "📸", categories: ["brand", "photo", "print", "digital", "design_change"] },
  { key: "distribution", label: "거래처 배포", icon: "📢", categories: ["dealer_notify", "sales_training"] },
  { key: "education",    label: "교육/행사", icon: "🎓", categories: ["launch_event", "kol"] },
  { key: "launch_check", label: "출시 확인", icon: "✅", categories: ["cs", "logistics", "insurance", "post_launch"] },
];
let EXEC_STAGES = [...DEFAULT_EXEC_STAGES];
let dynamicCategoryLabels = { ...LAUNCH_CATEGORY_LABELS };

function getExecStageForCategory(category) {
  for (const stage of EXEC_STAGES) {
    if (stage.categories && stage.categories.includes(category)) return stage;
  }
  return EXEC_STAGES[EXEC_STAGES.length - 1] || DEFAULT_EXEC_STAGES[4];
}

// =============================================================================
// View Modes
// =============================================================================

const VIEW_MODES = [
  { key: "command",   label: "커맨드센터", icon: "🎯" },
  { key: "execute",   label: "실행보드",   icon: "📋" },
  { key: "timeline",  label: "D-Day",     icon: "⏰" },
  { key: "customer",  label: "거래처",     icon: "🏢" },
  { key: "readiness", label: "준비현황",   icon: "🚦" },
];

// =============================================================================
// State
// =============================================================================

let allItems = [];
let projects = [];
let customers = [];
let viewMode = "command";
let filterProject = "all";
let filterCategory = "all";
let filterStatus = "all";
let filterAssignee = "all";
let searchQuery = "";
let showAllCategories = false;
let dataLoaded = { projects: false, items: false };

// Expand/collapse state
let expandedProducts = new Set();
let expandedCustomers = new Set();
let expandedExecStages = new Set(["product_info", "materials", "distribution", "education", "launch_check"]);

// Timeline
let timelineShowCompleted = false;
let timelineShowLater = false;

// Confirm modal
let pendingConfirmId = null;

// Bulk selection
let _selectedItems = new Set();

// 영업 핵심 카테고리
const SALES_CORE_CATEGORIES = ["pricing", "sales_training", "dealer_notify"];
const SALES_DEPT_KEYWORDS = ["영업"];

// =============================================================================
// Sales Nav — independent amber-branded navigation with embedded view tabs
// =============================================================================

function renderSalesNav(container) {
  const u = getUser();
  if (!u) return;

  const viewTabsHtml = VIEW_MODES.map(vm =>
    `<button class="sales-nav-tab${viewMode === vm.key ? " active" : ""}" data-view="${vm.key}" title="${vm.label}">
      <span class="sales-nav-tab-icon">${vm.icon}</span>
      <span class="sales-nav-tab-label">${vm.label}</span>
    </button>`
  ).join("");

  container.innerHTML = `
    <nav class="sales-nav">
      <div class="sales-nav-inner">
        <div class="sales-nav-left">
          <button class="sales-nav-logo" id="sales-home-btn" title="ProcessCheck 홈으로">
            <div class="sales-nav-logo-icon"><span>SL</span></div>
            <span class="sales-nav-logo-text">영업<span class="sales-accent">출시준비</span></span>
          </button>
          <div class="sales-nav-divider"></div>
          <div class="sales-nav-tabs">
            ${viewTabsHtml}
          </div>
        </div>
        <div class="sales-nav-right">
          <button class="sales-nav-icon-btn" id="sales-theme-btn" title="테마 전환">
            ${getThemeIcon()}
          </button>
          ${(u.role === "observer" || u.role === "manager" || u.role === "admin") ? `
          <button class="sales-nav-icon-btn" id="sales-template-btn" title="출시 준비 템플릿 관리">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </button>` : ""}
          <button class="sales-nav-icon-btn" id="sales-hub-btn" title="ProcessCheck 허브">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"/></svg>
          </button>
          <div class="sales-nav-user">
            <span class="sales-nav-user-name">${escapeHtml(u.name)}</span>
            <span class="sales-nav-user-role">${getRoleName(u.role)}</span>
          </div>
          <button class="sales-nav-icon-btn" id="sales-logout-btn" title="로그아웃">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  `;

  // Nav event listeners
  container.querySelector("#sales-home-btn").addEventListener("click", () => window.location.href = "processcheck.html");
  container.querySelector("#sales-hub-btn").addEventListener("click", () => window.location.href = "processcheck.html");
  container.querySelector("#sales-logout-btn").addEventListener("click", logout);
  container.querySelector("#sales-theme-btn").addEventListener("click", toggleTheme);
  const templateBtn = container.querySelector("#sales-template-btn");
  if (templateBtn) templateBtn.addEventListener("click", () => window.location.href = "admin-sales-templates.html");

  // View tab clicks
  container.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.view;
      renderSalesNav(container); // re-render nav for active state
      render();
    });
  });

  // Load global feedback widget
  import("../feedback-widget.js").then(m => m.initFeedbackWidget()).catch(() => {});
}

// =============================================================================
// Init
// =============================================================================

let unsubProjects = null;
let unsubItems = null;
let unsubCustomers = null;
let unsubStages = null;
let unsubCategories = null;

function init() {
  renderSalesNav(navRoot);
  app.innerHTML = `<div class="container">${renderSkeletonStats(4)}${renderSkeletonCards(6)}</div>`;

  // Subscribe to dynamic pipeline stages + categories from Firestore
  // Both subscriptions update shared state, so we rebuild on either change
  let _dynamicStages = [];
  let _dynamicCats = [];

  function rebuildExecStages() {
    if (_dynamicStages.length > 0 && _dynamicCats.length > 0) {
      EXEC_STAGES = _dynamicStages.map(s => {
        const stageCats = _dynamicCats.filter(c => c.pipelineStageId === s.id || c.pipelineStageId === s.key).map(c => c.key);
        return { key: s.key, label: s.label, icon: s.icon || "📋", id: s.id, categories: stageCats };
      });
      dynamicCategoryLabels = {};
      _dynamicCats.forEach(c => { dynamicCategoryLabels[c.key] = c.label; });
    }
    // Always use defaults if Firestore data not loaded yet
    if (EXEC_STAGES.length === 0) {
      EXEC_STAGES = [...DEFAULT_EXEC_STAGES];
    }
    render();
  }

  unsubStages = subscribeLaunchPipelineStages((stages) => {
    _dynamicStages = stages;
    rebuildExecStages();
  });

  unsubCategories = subscribeLaunchCategories((cats) => {
    _dynamicCats = cats;
    rebuildExecStages();
  });

  unsubProjects = subscribeProjects((data) => {
    projects = data;
    dataLoaded.projects = true;
    render();
  });

  unsubItems = subscribeAllLaunchChecklists((data) => {
    allItems = data;
    dataLoaded.items = true;
    render();
  });

  unsubCustomers = subscribeCustomers((data) => {
    customers = data;
  });
}

window.addEventListener("beforeunload", () => {
  unsubProjects?.();
  unsubItems?.();
  unsubCustomers?.();
  unsubStages?.();
  unsubCategories?.();
});

// =============================================================================
// Filtering & Helpers
// =============================================================================

function isSalesRelevant(item) {
  if (SALES_CORE_CATEGORIES.includes(item.category)) return true;
  if (item.department && SALES_DEPT_KEYWORDS.some(k => item.department.includes(k))) return true;
  return false;
}

function getFiltered() {
  return allItems.filter((item) => {
    if (!showAllCategories && !isSalesRelevant(item)) return false;
    if (filterProject !== "all" && item.projectId !== filterProject) return false;
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    if (filterAssignee !== "all" && item.assignee !== filterAssignee) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (item.title || "").toLowerCase().includes(q) ||
        (item.code || "").toLowerCase().includes(q) ||
        (item.department || "").toLowerCase().includes(q) ||
        (item.customerName || "").toLowerCase().includes(q)
      );
    }
    return true;
  });
}

function getProjectName(projectId) {
  const p = projects.find((x) => x.id === projectId);
  return p ? p.name : projectId;
}

function _getStatusBadge(status) {
  const map = {
    pending: { label: "대기", cls: "badge-neutral" },
    in_progress: { label: "진행중", cls: "badge-warning" },
    completed: { label: "완료", cls: "badge-success" },
  };
  const s = map[status] || { label: status, cls: "badge-neutral" };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function getCategoryBadge(category) {
  const label = dynamicCategoryLabels[category] || LAUNCH_CATEGORY_LABELS[category] || category;
  const isSalesCore = SALES_CORE_CATEGORIES.includes(category);
  const cls = isSalesCore ? "badge-primary" : "badge-neutral";
  return `<span class="badge ${cls}">${escapeHtml(label)}</span>`;
}

function getDueDateDisplay(item) {
  if (item.status === "completed") {
    return item.completedDate ? formatDate(item.completedDate) : "완료";
  }
  if (!item.dueDate) return "—";
  const days = daysUntil(item.dueDate);
  if (days === null) return formatDate(item.dueDate);
  if (days < 0) return `<span style="color:var(--danger)">${formatDate(item.dueDate)} (D+${Math.abs(days)})</span>`;
  if (days <= 7) return `<span style="color:var(--warning)">${formatDate(item.dueDate)} (D-${days})</span>`;
  return `${formatDate(item.dueDate)} (D-${days})`;
}

function getActionButtons(item) {
  if (item.status === "pending") return `<button class="btn btn-sm btn-secondary start-btn" data-id="${item.id}" title="시작">&#9654;</button>`;
  if (item.status === "in_progress") return `<button class="btn btn-sm btn-primary complete-btn" data-id="${item.id}" title="완료">&#10003;</button>`;
  return "";
}

function _getCheckedDisplay(item) {
  if (item.checkedBy) {
    const dateStr = item.checkedAt ? timeAgo(item.checkedAt) : "";
    return `<span class="badge badge-success" style="font-size:10px;" title="${item.checkedNote || ""}">✓ ${escapeHtml(item.checkedBy)}</span>${dateStr ? `<br><span class="text-xs text-soft">${dateStr}</span>` : ""}`;
  }
  if (item.customerId) {
    return `<button class="btn btn-sm btn-secondary confirm-btn" data-id="${item.id}" title="거래처 확인 처리" style="font-size:11px;padding:2px 8px;">확인</button>`;
  }
  return `<span class="text-xs text-soft">—</span>`;
}

function renderEmpty() {
  return `<div class="card" style="padding:3rem;text-align:center;"><p class="text-soft">표시할 항목이 없습니다</p></div>`;
}

// =============================================================================
// Pipeline Stats for a project
// =============================================================================

function getProjectPipelineStats(projectItems) {
  return EXEC_STAGES.map(stage => {
    const items = projectItems.filter(i => stage.categories.includes(i.category));
    const total = items.length;
    const completed = items.filter(i => i.status === "completed").length;
    const inProgress = items.filter(i => i.status === "in_progress").length;
    const overdue = items.filter(i => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    }).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    let status = "pending";
    if (total > 0 && completed === total) status = "completed";
    else if (inProgress > 0 || completed > 0) status = "in_progress";
    return { ...stage, total, completed, inProgress, overdue, pct, status };
  });
}

// =============================================================================
// Main Render
// =============================================================================

function render() {
  if (!dataLoaded.items) return;

  // Empty data — show project list with generate buttons
  if (allItems.length === 0) {
    renderEmptyState();
    return;
  }

  const filtered = getFiltered();
  const salesItems = showAllCategories ? allItems : allItems.filter(isSalesRelevant);

  // Stats
  const stats = {
    total: salesItems.length,
    completed: salesItems.filter(i => i.status === "completed").length,
    overdue: salesItems.filter(i => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    }).length,
    projects: [...new Set(salesItems.map(i => i.projectId))].length,
  };
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Assignees + projectIds for filters
  const projectIds = [...new Set(allItems.map(i => i.projectId))];
  const assignees = [...new Set(allItems.map(i => i.assignee).filter(Boolean))].sort();
  const allCatKeys = Object.keys(dynamicCategoryLabels).length > 0 ? Object.keys(dynamicCategoryLabels) : Object.keys(LAUNCH_CATEGORY_LABELS);
  const _categories = showAllCategories
    ? allCatKeys
    : [...SALES_CORE_CATEGORIES];

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Stats bar -->
      <div class="sales-stats-bar">
        <div class="sales-stat-item">
          <div class="sales-stat-value">${stats.projects}</div>
          <div class="sales-stat-label">출시 제품</div>
        </div>
        <div class="sales-stat-item">
          <div class="sales-stat-value">${pct}<span class="sales-stat-unit">%</span></div>
          <div class="sales-stat-label">전체 준비율</div>
        </div>
        <div class="sales-stat-item clickable" data-stat-action="overdue">
          <div class="sales-stat-value ${stats.overdue > 0 ? 'text-danger' : 'text-success'}">${stats.overdue}</div>
          <div class="sales-stat-label">지연 항목</div>
        </div>
        <div class="sales-stat-item">
          <div class="sales-stat-value text-success">${stats.completed}<span class="sales-stat-unit">/${stats.total}</span></div>
          <div class="sales-stat-label">완료</div>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="sales-filter-bar">
        <input type="text" class="input-field" id="search-input" placeholder="검색..." value="${escapeHtml(searchQuery)}" style="flex:1;min-width:140px;max-width:240px;">
        <select class="input-field" id="filter-project" style="width:auto;max-width:160px;">
          <option value="all">전체 프로젝트</option>
          ${projectIds.map(pid => `<option value="${pid}" ${filterProject === pid ? "selected" : ""}>${escapeHtml(getProjectName(pid))}</option>`).join("")}
        </select>
        <select class="input-field" id="filter-status" style="width:auto;">
          <option value="all">전체 상태</option>
          <option value="pending" ${filterStatus === "pending" ? "selected" : ""}>대기</option>
          <option value="in_progress" ${filterStatus === "in_progress" ? "selected" : ""}>진행중</option>
          <option value="completed" ${filterStatus === "completed" ? "selected" : ""}>완료</option>
        </select>
        ${assignees.length > 0 ? `
          <select class="input-field" id="filter-assignee" style="width:auto;max-width:120px;">
            <option value="all">전체 담당자</option>
            ${assignees.map(a => `<option value="${escapeHtml(a)}" ${filterAssignee === a ? "selected" : ""}>${escapeHtml(a)}</option>`).join("")}
          </select>
        ` : ""}
        <label class="sales-toggle-label">
          <input type="checkbox" id="toggle-all-categories" ${showAllCategories ? "checked" : ""}>
          <span>전체</span>
        </label>
      </div>

      <!-- View content -->
      <div id="view-content">
        ${renderViewContent(filtered)}
      </div>

      <!-- Confirm modal -->
      ${renderConfirmModal()}
      ${renderEditModal()}

      <!-- Bulk action bar -->
      ${_selectedItems.size > 0 ? `
        <div class="sales-bulk-bar" id="bulk-bar">
          <span>${_selectedItems.size}개 선택</span>
          <button class="btn btn-sm btn-primary" id="bulk-start">일괄 시작</button>
          <button class="btn btn-sm btn-success" id="bulk-complete">일괄 완료</button>
          <button class="btn btn-sm btn-ghost" id="bulk-clear">선택 해제</button>
        </div>
      ` : ""}
    </div>
  `;

  bindCommonEvents();
  bindViewEvents();
}

function renderConfirmModal() {
  return `
    <div class="modal-overlay hidden" id="confirm-modal">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <h3 class="modal-title">거래처 확인 처리</h3>
          <button class="modal-close" id="confirm-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="mb-4">
            <label class="text-sm font-medium" style="color:var(--slate-300)">확인자 이름 *</label>
            <input type="text" class="input-field" id="confirm-name" placeholder="확인한 담당자 이름" style="margin-top:4px;">
          </div>
          <div class="mb-4">
            <label class="text-sm font-medium" style="color:var(--slate-300)">메모 (선택)</label>
            <input type="text" class="input-field" id="confirm-note" placeholder="확인 메모" style="margin-top:4px;">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="confirm-cancel">취소</button>
          <button class="btn btn-primary" id="confirm-submit">확인 처리</button>
        </div>
      </div>
    </div>`;
}

function renderEmptyState() {
  const activeProjects = projects.filter(p => p.status === "active");
  const projectRows = activeProjects.length > 0
    ? activeProjects.map(p => `
        <tr>
          <td><a href="project.html?id=${p.id}" style="color:var(--primary-400);text-decoration:none;">${escapeHtml(p.name)}</a></td>
          <td class="text-sm">${escapeHtml(p.projectType || "")}</td>
          <td class="text-sm">${p.endDate ? formatDate(p.endDate) : "—"}</td>
          <td>
            <button class="btn btn-sm btn-primary generate-launch-btn" data-project-id="${p.id}" data-project-type="${p.projectType || "신규개발"}" data-end-date="${p.endDate ? p.endDate.toISOString() : ""}">
              출시 준비 생성
            </button>
          </td>
        </tr>`).join("")
    : `<tr><td colspan="4" class="text-sm text-soft" style="text-align:center;padding:1.5rem;">등록된 프로젝트가 없습니다. <a href="projects.html" style="color:var(--primary-400);">프로젝트 등록</a>을 먼저 해주세요.</td></tr>`;

  app.innerHTML = `
    <div class="container animate-fade-in">
      <div class="card" style="padding: 2rem;">
        <h2 class="text-lg font-semibold mb-2" style="color: var(--slate-200)">출시 준비 체크리스트가 없습니다</h2>
        <p class="text-sm text-soft mb-4">아래 프로젝트에서 출시 준비 체크리스트를 생성하세요.</p>
        <div style="overflow-x:auto;">
          <table>
            <thead><tr><th>프로젝트</th><th>유형</th><th>종료일</th><th>작업</th></tr></thead>
            <tbody>${projectRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  app.querySelectorAll(".generate-launch-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const el = e.currentTarget;
      const pId = el.dataset.projectId;
      const pType = el.dataset.projectType;
      const endDateStr = el.dataset.endDate;
      const endDate = endDateStr ? new Date(endDateStr) : new Date();
      el.disabled = true;
      el.textContent = "생성 중...";
      try {
        const custList = customers.map(c => ({ id: c.id, name: c.name }));
        const count = await applyLaunchTemplate(pId, endDate, custList);
        if (count > 0) {
          showToast("success", `${getProjectName(pId)}: ${count}개 출시 준비 체크리스트 생성 완료`);
          el.textContent = "완료";
          el.classList.replace("btn-primary", "btn-secondary");
        } else {
          showToast("warning", "생성할 항목이 없습니다.");
          el.disabled = false;
          el.textContent = "출시 준비 생성";
        }
      } catch (err) {
        console.error("출시 준비 생성 오류:", err);
        showToast("error", "생성 실패: " + err.message);
        el.disabled = false;
        el.textContent = "출시 준비 생성";
      }
    });
  });
}

// =============================================================================
// View Dispatcher
// =============================================================================

function renderViewContent(filtered) {
  switch (viewMode) {
    case "command":   return renderCommandCenter(filtered);
    case "execute":   return renderExecuteBoard(filtered);
    case "timeline":  return renderTimelineView(filtered);
    case "customer":  return renderCustomerBoard(filtered);
    case "readiness": return renderReadinessView(filtered);
    default:          return renderCommandCenter(filtered);
  }
}

// =============================================================================
// View 1: Command Center — product pipeline overview
// =============================================================================

function renderCommandCenter(filtered) {
  // Group by project
  const grouped = {};
  for (const item of filtered) {
    if (!grouped[item.projectId]) grouped[item.projectId] = [];
    grouped[item.projectId].push(item);
  }

  // Sort by D-Day urgency
  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const projA = projects.find(p => p.id === a[0]);
    const projB = projects.find(p => p.id === b[0]);
    const dA = projA?.endDate ? daysUntil(projA.endDate) ?? 9999 : 9999;
    const dB = projB?.endDate ? daysUntil(projB.endDate) ?? 9999 : 9999;
    return dA - dB;
  });

  if (sortedGroups.length === 0) return renderEmpty();

  let html = `<div class="sales-command-grid">`;

  for (const [projectId, items] of sortedGroups) {
    const proj = projects.find(p => p.id === projectId);
    const pipeline = getProjectPipelineStats(items);
    const totalCompleted = items.filter(i => i.status === "completed").length;
    const totalCount = items.length;
    const pct = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;
    const overdueCount = items.filter(i => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    }).length;

    // D-Day
    const projectDDay = proj?.endDate ? daysUntil(proj.endDate) : null;
    let dDayText = "—";
    let dDayClass = "";
    if (projectDDay !== null) {
      if (projectDDay < 0) { dDayText = `D+${Math.abs(projectDDay)}`; dDayClass = "danger"; }
      else if (projectDDay === 0) { dDayText = "D-Day"; dDayClass = "danger"; }
      else if (projectDDay <= 14) { dDayText = `D-${projectDDay}`; dDayClass = "warning"; }
      else { dDayText = `D-${projectDDay}`; dDayClass = "success"; }
    }

    // Bottleneck: find most delayed stage
    const bottleneck = pipeline.filter(s => s.total > 0 && s.status !== "completed").sort((a, b) => a.pct - b.pct)[0];
    const bottleneckItems = bottleneck ? items.filter(i => bottleneck.categories.includes(i.category) && i.status !== "completed") : [];
    const bottleneckText = bottleneck && bottleneck.pct < 100
      ? bottleneckItems.slice(0, 2).map(i => i.title).join(", ")
      : "";

    const isExpanded = expandedProducts.has(projectId);

    html += `
      <div class="sales-command-card${isExpanded ? " expanded" : ""}" data-product-card="${projectId}">
        <!-- Header: Name + D-Day -->
        <div class="sales-command-header">
          <div class="sales-command-title-area">
            <a href="project.html?id=${projectId}" class="sales-command-title" onclick="event.stopPropagation();">${escapeHtml(getProjectName(projectId))}</a>
            <div class="sales-command-meta">
              ${proj?.currentStage ? `<span class="badge badge-neutral" style="font-size:10px;">${escapeHtml(proj.currentStage)}</span>` : ""}
              ${proj?.endDate ? `<span class="text-xs text-soft">${formatDate(proj.endDate)}</span>` : ""}
            </div>
          </div>
          <div class="sales-command-dday ${dDayClass}">
            <div class="sales-command-dday-value">${dDayText}</div>
            <div class="sales-command-dday-label">출시일</div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="sales-command-progress">
          <div class="sales-command-progress-bar">
            <div class="sales-command-progress-fill" style="width:${pct}%;"></div>
          </div>
          <span class="sales-command-progress-text">${pct}%</span>
        </div>

        <!-- 5-Stage Pipeline -->
        <div class="sales-pipeline">
          ${pipeline.map((stage, i) => {
            let stageClass = "pending";
            if (stage.status === "completed") stageClass = "completed";
            else if (stage.status === "in_progress") stageClass = "in_progress";
            if (stage.overdue > 0) stageClass = "overdue";
            return `
              <div class="sales-pipeline-stage ${stageClass}" title="${stage.label}: ${stage.completed}/${stage.total}">
                <div class="sales-pipeline-dot">${stage.status === "completed" ? "✓" : stage.icon}</div>
                <div class="sales-pipeline-label">${stage.label}</div>
                ${stage.total > 0 ? `<div class="sales-pipeline-count">${stage.completed}/${stage.total}</div>` : ""}
              </div>
              ${i < pipeline.length - 1 ? '<div class="sales-pipeline-connector"></div>' : ""}
            `;
          }).join("")}
        </div>

        <!-- Bottleneck / Status -->
        <div class="sales-command-status">
          ${overdueCount > 0 ? `<span class="badge badge-danger" style="font-size:10px;">${overdueCount}건 지연</span>` : ""}
          ${bottleneckText ? `<span class="text-xs text-soft" style="display:inline-block;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">병목: ${escapeHtml(bottleneckText)}</span>` : ""}
          ${overdueCount === 0 && pct >= 80 ? `<span class="badge badge-success" style="font-size:10px;">준비 완료</span>` : ""}
        </div>

        <!-- Expand hint -->
        <div class="sales-command-expand">${isExpanded ? "▲ 접기" : "▼ 상세 보기"}</div>

        <!-- Expanded detail -->
        ${isExpanded ? renderCommandDetail(projectId, items, pipeline) : ""}
      </div>`;
  }

  html += `</div>`;
  return html;
}

function renderCommandDetail(projectId, items, pipeline) {
  let html = `<div class="sales-command-detail">`;
  for (const stage of pipeline) {
    if (stage.total === 0) continue;
    const stageItems = items.filter(i => stage.categories.includes(i.category));
    html += `
      <div class="sales-detail-stage">
        <div class="sales-detail-stage-header">
          <span>${stage.icon} ${stage.label}</span>
          <span class="text-xs text-soft">${stage.completed}/${stage.total}</span>
        </div>
        <div class="sales-detail-items">
          ${stageItems.map(item => {
            const dd = daysUntil(item.dueDate);
            const isOverdue = item.status !== "completed" && dd !== null && dd < 0;
            let ddLabel = "";
            if (dd !== null) {
              if (dd < 0) ddLabel = `D+${Math.abs(dd)}`;
              else if (dd === 0) ddLabel = "D-Day";
              else ddLabel = `D-${dd}`;
            }
            return `
            <div class="sales-detail-item ${item.status}${isOverdue ? " overdue" : ""}" data-item-id="${item.id}">
              <span class="sales-detail-item-status">${item.status === "completed" ? "✓" : item.status === "in_progress" ? "▶" : "○"}</span>
              <span class="sales-detail-item-title">${escapeHtml(item.title)}</span>
              <span class="sales-detail-item-assignee">${escapeHtml(item.assignee || item.department || "")}</span>
              ${item.dueDate ? `<span class="text-xs${isOverdue ? " text-danger" : " text-soft"}" style="min-width:50px;text-align:right;">${ddLabel}</span>` : ""}
              ${getActionButtons(item)}
              <button class="btn btn-sm btn-ghost sales-edit-btn" data-edit-item="${item.id}" title="편집" onclick="event.stopPropagation();" style="font-size:11px;padding:2px 4px;opacity:0.5;">✏️</button>
            </div>`;
          }).join("")}
        </div>
      </div>`;
  }
  html += `</div>`;
  return html;
}

// =============================================================================
// View 2: Execute Board — kanban by execution stage
// =============================================================================

function renderExecuteBoard(filtered) {
  if (filtered.length === 0) return renderEmpty();

  let html = `<div class="sales-kanban">`;

  for (const stage of EXEC_STAGES) {
    const stageItems = filtered.filter(i => stage.categories.includes(i.category));
    const completed = stageItems.filter(i => i.status === "completed").length;
    const total = stageItems.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const overdue = stageItems.filter(i => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    }).length;
    const isOpen = expandedExecStages.has(stage.key);

    // Sort: overdue first, then in_progress, then pending, completed last
    const sorted = [...stageItems].sort((a, b) => {
      const order = { overdue: 0, in_progress: 1, pending: 2, completed: 3 };
      const aKey = (a.status !== "completed" && a.dueDate && daysUntil(a.dueDate) !== null && daysUntil(a.dueDate) < 0) ? "overdue" : a.status;
      const bKey = (b.status !== "completed" && b.dueDate && daysUntil(b.dueDate) !== null && daysUntil(b.dueDate) < 0) ? "overdue" : b.status;
      return (order[aKey] ?? 2) - (order[bKey] ?? 2);
    });

    // Stage column status color
    let stageColor = "var(--slate-400)";
    if (total > 0 && completed === total) stageColor = "var(--success)";
    else if (overdue > 0) stageColor = "var(--danger)";
    else if (completed > 0 || stageItems.some(i => i.status === "in_progress")) stageColor = "var(--warning)";

    html += `
      <div class="sales-kanban-column">
        <div class="sales-kanban-header" data-toggle-exec="${stage.key}" style="border-top:3px solid ${stageColor};">
          <div class="sales-kanban-header-top">
            <span class="sales-kanban-icon">${stage.icon}</span>
            <strong class="sales-kanban-title">${stage.label}</strong>
            ${overdue > 0 ? `<span class="badge badge-danger" style="font-size:10px;">${overdue}</span>` : ""}
          </div>
          <div class="sales-kanban-header-stats">
            <div class="progress-bar" style="height:4px;flex:1;">
              <div class="progress-fill" style="width:${pct}%;${pct >= 100 ? "background:var(--success);" : ""}"></div>
            </div>
            <span class="text-xs font-mono" style="color:${stageColor};">${completed}/${total}</span>
          </div>
        </div>

        <div class="sales-kanban-items${isOpen ? "" : " collapsed"}">
          ${sorted.map(item => {
            const isOverdue = item.status !== "completed" && item.dueDate && daysUntil(item.dueDate) !== null && daysUntil(item.dueDate) < 0;
            const days = daysUntil(item.dueDate);
            let dLabel = "";
            if (days !== null && days !== undefined) {
              if (days < 0) dLabel = `D+${Math.abs(days)}`;
              else if (days === 0) dLabel = "D-Day";
              else dLabel = `D-${days}`;
            }
            return `
              <div class="sales-kanban-card ${item.status}${isOverdue ? " overdue" : ""}" data-navigate-project="${item.projectId}">
                <div class="sales-kanban-card-top">
                  <input type="checkbox" class="sales-bulk-cb" data-bulk-check="${item.id}" ${_selectedItems.has(item.id) ? "checked" : ""} onclick="event.stopPropagation();" title="선택">
                  <span class="sales-kanban-card-title">${escapeHtml(item.title)}</span>
                  ${dLabel ? `<span class="sales-kanban-card-dday${isOverdue ? " danger" : ""}">${dLabel}</span>` : ""}
                </div>
                <div class="sales-kanban-card-bottom">
                  <span class="sales-kanban-card-project">${escapeHtml(getProjectName(item.projectId))}</span>
                  <span class="sales-kanban-card-assignee">${escapeHtml(item.assignee || item.department || "")}</span>
                </div>
                <div class="sales-kanban-card-actions">
                  ${getCategoryBadge(item.category)}
                  ${getActionButtons(item)}
                  <button class="btn btn-sm btn-ghost sales-edit-btn" data-edit-item="${item.id}" title="편집" onclick="event.stopPropagation();" style="font-size:11px;padding:2px 4px;opacity:0.5;">✏️</button>
                </div>
              </div>`;
          }).join("")}
          ${total === 0 ? `<div class="sales-kanban-empty">항목 없음</div>` : ""}
        </div>
      </div>`;
  }

  html += `</div>`;
  return html;
}

// =============================================================================
// View 3: D-Day Timeline
// =============================================================================

function renderTimelineView(filtered) {
  const active = filtered.filter(i => i.status !== "completed");
  const completed = filtered.filter(i => i.status === "completed");

  const buckets = { overdue: [], thisWeek: [], nextWeek: [], upcoming: [], later: [], noDueDate: [] };

  for (const item of active) {
    const d = daysUntil(item.dueDate);
    if (d === null)    { buckets.noDueDate.push(item); }
    else if (d < 0)    { buckets.overdue.push(item); }
    else if (d <= 7)   { buckets.thisWeek.push(item); }
    else if (d <= 14)  { buckets.nextWeek.push(item); }
    else if (d <= 30)  { buckets.upcoming.push(item); }
    else               { buckets.later.push(item); }
  }

  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => (daysUntil(a.dueDate) ?? 999) - (daysUntil(b.dueDate) ?? 999));
  }

  if (active.length === 0 && completed.length === 0) return renderEmpty();

  const sections = [
    { key: "overdue", label: "마감 초과", icon: "🚨", items: buckets.overdue, color: "var(--danger)", bg: "rgba(239,68,68,0.06)", alwaysOpen: true },
    { key: "thisWeek", label: "이번 주", icon: "⚠️", items: buckets.thisWeek, color: "var(--warning)", bg: "rgba(245,158,11,0.06)", alwaysOpen: true },
    { key: "nextWeek", label: "다음 주", icon: "📅", items: buckets.nextWeek, color: "var(--primary-400)", bg: "rgba(6,182,212,0.06)", alwaysOpen: true },
    { key: "upcoming", label: "이후 (D8~D30)", icon: "📋", items: buckets.upcoming, color: "var(--slate-400)", bg: "transparent", alwaysOpen: false, toggleKey: "later" },
    { key: "later", label: "장기 (D31+)", icon: "📦", items: buckets.later, color: "var(--slate-300)", bg: "transparent", alwaysOpen: false, toggleKey: "later" },
  ];

  let html = `<div class="flex flex-col gap-4">`;

  for (const sec of sections) {
    if (sec.items.length === 0) continue;
    const isCollapsible = !sec.alwaysOpen;
    const isOpen = sec.alwaysOpen || (sec.toggleKey === "later" && timelineShowLater);

    html += `
      <div class="card" style="border-left:4px solid ${sec.color};padding:0;overflow:hidden;">
        <div class="flex items-center justify-between${isCollapsible ? ' cursor-pointer' : ''}" ${isCollapsible ? 'data-toggle-later' : ''} style="padding:0.75rem 1rem;background:${sec.bg};border-bottom:${isOpen ? '1px solid var(--border)' : 'none'};">
          <div class="flex items-center gap-2">
            <span>${sec.icon}</span>
            <strong style="color:${sec.color};">${sec.label}</strong>
            <span class="badge" style="background:${sec.color};color:#fff;font-size:11px;">${sec.items.length}건</span>
          </div>
          ${isCollapsible ? `<span style="font-size:12px;transition:transform 0.2s;transform:rotate(${isOpen ? '90' : '0'}deg);">&#9654;</span>` : ""}
        </div>
        ${isOpen ? renderTimelineItems(sec.items) : ""}
      </div>`;
  }

  if (buckets.noDueDate.length > 0) {
    html += `
      <div class="card" style="border-left:4px solid var(--slate-400);padding:0;overflow:hidden;">
        <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--border);">
          <div class="flex items-center gap-2">
            <span>❓</span>
            <strong style="color:var(--slate-300)">마감일 미설정</strong>
            <span class="badge badge-neutral" style="font-size:11px;">${buckets.noDueDate.length}건</span>
          </div>
        </div>
        ${renderTimelineItems(buckets.noDueDate)}
      </div>`;
  }

  if (completed.length > 0) {
    html += `
      <div class="card" style="border-left:4px solid var(--success);padding:0;overflow:hidden;">
        <div class="flex items-center justify-between cursor-pointer" data-toggle-completed style="padding:0.75rem 1rem;background:rgba(16,185,129,0.04);border-bottom:${timelineShowCompleted ? '1px solid var(--border)' : 'none'};">
          <div class="flex items-center gap-2">
            <span>✅</span>
            <strong style="color:var(--success)">완료됨</strong>
            <span class="badge badge-success" style="font-size:11px;">${completed.length}건</span>
          </div>
          <span style="font-size:12px;transition:transform 0.2s;transform:rotate(${timelineShowCompleted ? '90' : '0'}deg);">&#9654;</span>
        </div>
        ${timelineShowCompleted ? renderTimelineItems(completed.slice(0, 30)) : ""}
      </div>`;
  }

  html += `</div>`;
  return html;
}

function renderTimelineItems(items) {
  return `
    <div class="sales-timeline-list">
      ${items.map(item => {
        const isOverdue = item.status !== "completed" && item.dueDate && daysUntil(item.dueDate) !== null && daysUntil(item.dueDate) < 0;
        const stage = getExecStageForCategory(item.category);
        return `
          <div class="sales-timeline-item ${item.status}${isOverdue ? " overdue" : ""}" data-navigate-project="${item.projectId}">
            <div class="sales-timeline-item-left">
              <span class="sales-timeline-item-icon">${stage.icon}</span>
              <div>
                <div class="sales-timeline-item-title">${escapeHtml(item.title)}</div>
                <div class="sales-timeline-item-meta">
                  ${escapeHtml(getProjectName(item.projectId))} · ${escapeHtml(item.assignee || item.department || "")}
                </div>
              </div>
            </div>
            <div class="sales-timeline-item-right">
              ${getDueDateDisplay(item)}
              ${getActionButtons(item)}
            </div>
          </div>`;
      }).join("")}
    </div>`;
}

// =============================================================================
// View 4: Customer Board
// =============================================================================

function renderCustomerBoard(filtered) {
  const customerItems = filtered.filter(i => i.customerId);
  const nonCustomerCount = filtered.filter(i => !i.customerId).length;

  const byCustomer = {};
  for (const item of customerItems) {
    const key = item.customerId;
    if (!byCustomer[key]) byCustomer[key] = { customerId: item.customerId, customerName: item.customerName || "알 수 없음", items: [] };
    byCustomer[key].items.push(item);
  }

  const customerList = Object.values(byCustomer).sort((a, b) => {
    const uncA = a.items.filter(i => !i.checkedBy).length;
    const uncB = b.items.filter(i => !i.checkedBy).length;
    return uncB - uncA;
  });

  if (customerList.length === 0) {
    return `
      <div class="card" style="padding:3rem;text-align:center;">
        <p class="text-soft">거래처별 항목이 없습니다</p>
        ${nonCustomerCount > 0 ? `<p class="text-xs text-soft" style="margin-top:8px;">일반 항목 ${nonCustomerCount}건은 실행보드에서 확인하세요</p>` : ""}
      </div>`;
  }

  const totalChecked = customerItems.filter(i => i.checkedBy).length;
  const totalUnchecked = customerItems.filter(i => !i.checkedBy).length;

  let html = `
    <div class="card mb-4" style="padding:1rem 1.25rem;">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <strong style="color:var(--slate-100)">거래처별 확인 현황</strong>
          <span class="text-sm text-soft" style="margin-left:8px;">${customerList.length}개 거래처</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="badge badge-success">확인 ${totalChecked}</span>
          <span class="badge badge-warning">미확인 ${totalUnchecked}</span>
        </div>
      </div>
    </div>
    <div class="sales-customer-grid">`;

  for (const cust of customerList) {
    const checked = cust.items.filter(i => i.checkedBy).length;
    const unchecked = cust.items.filter(i => !i.checkedBy).length;
    const pct = cust.items.length > 0 ? Math.round((checked / cust.items.length) * 100) : 0;
    const isExpanded = expandedCustomers.has(cust.customerId);

    const lastChecked = cust.items.filter(i => i.checkedAt).sort((a, b) => {
      const ta = a.checkedAt instanceof Date ? a.checkedAt : new Date(a.checkedAt);
      const tb = b.checkedAt instanceof Date ? b.checkedAt : new Date(b.checkedAt);
      return tb - ta;
    })[0];
    const lastTime = lastChecked ? timeAgo(lastChecked.checkedAt) : null;

    html += `
      <div class="card card-hover cursor-pointer${isExpanded ? " expanded" : ""}" data-customer-card="${cust.customerId}" style="padding:0;overflow:hidden;">
        <div style="padding:1rem 1.25rem;">
          <div class="flex items-center justify-between mb-2">
            <strong style="color:var(--slate-100);">${escapeHtml(cust.customerName)}</strong>
            <span class="text-xs" style="color:${pct >= 100 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--danger)"};">${checked}/${cust.items.length}</span>
          </div>
          <div class="progress-bar mb-2" style="height:5px;">
            <div class="progress-fill" style="width:${pct}%;background:${pct >= 100 ? "var(--success)" : "var(--primary)"};"></div>
          </div>
          <div class="text-xs text-soft">
            ${unchecked > 0 ? `미확인 ${unchecked}건` : "전체 확인 완료"}
            ${lastTime ? ` · ${lastTime}` : ""}
          </div>
          <div class="text-xs text-soft text-center" style="margin-top:6px;">${isExpanded ? "▲ 접기" : "▼ 상세 보기"}</div>
        </div>
        ${isExpanded ? `
          <div style="border-top:1px solid var(--border);">
            ${renderTimelineItems(cust.items)}
          </div>` : ""}
      </div>`;
  }

  html += `</div>`;
  return html;
}

// =============================================================================
// View 5: Readiness Scorecard (RAG)
// =============================================================================

function renderReadinessView(filtered) {
  const projectIds = [...new Set(filtered.map(i => i.projectId))];
  if (projectIds.length === 0) return renderEmpty();

  let html = `<div class="flex flex-col gap-4">`;

  for (const pid of projectIds) {
    const projItems = filtered.filter(i => i.projectId === pid);
    const proj = projects.find(p => p.id === pid);
    const pipeline = getProjectPipelineStats(projItems);
    const totalCompleted = projItems.filter(i => i.status === "completed").length;
    const totalCount = projItems.length;
    const pct = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;

    // Overall RAG
    const hasOverdue = projItems.some(i => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    });
    let ragClass = "rag-green";
    if (hasOverdue || pct < 50) ragClass = "rag-red";
    else if (pct < 80) ragClass = "rag-amber";

    const dDay = proj?.endDate ? daysUntil(proj.endDate) : null;
    let goNoGo = "진행 가능";
    let goClass = "text-success";
    if (hasOverdue) { goNoGo = "지연 발생"; goClass = "text-danger"; }
    else if (pct < 80) { goNoGo = "준비 중"; goClass = "text-warning"; }
    else if (pct >= 100) { goNoGo = "출시 준비 완료"; goClass = "text-success"; }

    html += `
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="sales-rag-dot ${ragClass}" style="width:12px;height:12px;"></span>
              <strong style="color:var(--slate-100);">${escapeHtml(getProjectName(pid))}</strong>
              ${dDay !== null ? `<span class="badge badge-neutral">D-${dDay > 0 ? dDay : "Day"}</span>` : ""}
            </div>
            <div class="flex items-center gap-3">
              <span class="${goClass} font-semibold text-sm">${goNoGo}</span>
              <span class="text-sm font-mono" style="color:var(--slate-300);">${pct}%</span>
            </div>
          </div>
        </div>
        <div style="padding:1rem 1.25rem;">
          <div class="sales-readiness-stages">
            ${pipeline.map(stage => {
              let sRag = "rag-gray";
              if (stage.total === 0) sRag = "rag-gray";
              else if (stage.overdue > 0) sRag = "rag-red";
              else if (stage.pct >= 80) sRag = "rag-green";
              else if (stage.pct >= 50) sRag = "rag-amber";
              else sRag = "rag-red";

              return `
                <div class="sales-readiness-stage">
                  <span class="sales-rag-dot ${sRag}"></span>
                  <span class="sales-readiness-stage-label">${stage.icon} ${stage.label}</span>
                  <span class="sales-readiness-stage-stat">${stage.total > 0 ? `${stage.completed}/${stage.total}` : "—"}</span>
                </div>`;
            }).join("")}
          </div>
        </div>
      </div>`;
  }

  html += `</div>`;
  return html;
}

// =============================================================================
// Event Binding — Common
// =============================================================================

function bindCommonEvents() {
  // Search & filters
  app.querySelector("#search-input")?.addEventListener("input", e => { searchQuery = e.target.value; render(); });
  app.querySelector("#filter-project")?.addEventListener("change", e => { filterProject = e.target.value; render(); });
  app.querySelector("#filter-status")?.addEventListener("change", e => { filterStatus = e.target.value; render(); });
  app.querySelector("#filter-assignee")?.addEventListener("change", e => { filterAssignee = e.target.value; render(); });
  app.querySelector("#toggle-all-categories")?.addEventListener("change", e => {
    showAllCategories = e.target.checked;
    filterCategory = "all";
    render();
  });

  // Stat card click
  app.querySelectorAll("[data-stat-action]").forEach(card => {
    card.addEventListener("click", () => {
      const action = card.dataset.statAction;
      if (action === "overdue") { viewMode = "timeline"; renderSalesNav(navRoot); }
      render();
    });
  });

  // Start buttons
  app.querySelectorAll(".start-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = "...";
      try {
        await updateLaunchChecklist(btn.dataset.id, { status: "in_progress" });
      } catch (err) {
        console.error("시작 실패:", err);
        btn.innerHTML = orig;
        btn.disabled = false;
      }
    });
  });

  // Complete buttons
  app.querySelectorAll(".complete-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = "...";
      try {
        await completeLaunchChecklist(btn.dataset.id);
      } catch (err) {
        console.error("완료 실패:", err);
        btn.innerHTML = orig;
        btn.disabled = false;
      }
    });
  });

  // Confirm buttons
  app.querySelectorAll(".confirm-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      pendingConfirmId = btn.dataset.id;
      const modal = document.getElementById("confirm-modal");
      modal.classList.remove("hidden");
      document.getElementById("confirm-name").value = "";
      document.getElementById("confirm-note").value = "";
      document.getElementById("confirm-name").focus();
    });
  });

  // Modal
  const modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-modal-close")?.addEventListener("click", () => { modal.classList.add("hidden"); pendingConfirmId = null; });
  document.getElementById("confirm-cancel")?.addEventListener("click", () => { modal.classList.add("hidden"); pendingConfirmId = null; });
  modal?.addEventListener("click", e => { if (e.target === modal) { modal.classList.add("hidden"); pendingConfirmId = null; } });

  document.getElementById("confirm-submit")?.addEventListener("click", async () => {
    const name = document.getElementById("confirm-name").value.trim();
    if (!name) { showToast("warning", "확인자 이름을 입력해주세요."); return; }
    const note = document.getElementById("confirm-note").value.trim();
    const submitBtn = document.getElementById("confirm-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "처리 중...";
    try {
      await confirmLaunchChecklist(pendingConfirmId, name, note);
      modal.classList.add("hidden");
      pendingConfirmId = null;
      showToast("success", "거래처 확인 처리가 완료되었습니다.");
    } catch (err) {
      console.error("확인 처리 실패:", err);
      showToast("error", "확인 처리에 실패했습니다.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "확인 처리";
    }
  });

  // Navigate to project on row click
  app.querySelectorAll("[data-navigate-project]").forEach(el => {
    el.addEventListener("click", e => {
      if (e.target.closest("button") || e.target.closest("a") || e.target.closest("input")) return;
      const pid = el.dataset.navigateProject;
      if (pid) window.location.href = `project.html?id=${pid}`;
    });
  });

  // Focus search
  if (searchQuery) {
    const input = app.querySelector("#search-input");
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }

  // Edit & Bulk
  bindEditEvents();
  bindBulkEvents();
}

// =============================================================================
// Event Binding — View-specific
// =============================================================================

function bindViewEvents() {
  switch (viewMode) {
    case "command": bindCommandEvents(); break;
    case "execute": bindExecuteEvents(); break;
    case "timeline": bindTimelineEvents(); break;
    case "customer": bindCustomerEvents(); break;
  }
}

function bindCommandEvents() {
  app.querySelectorAll("[data-product-card]").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest("button") || e.target.closest("a")) return;
      const pid = card.dataset.productCard;
      if (expandedProducts.has(pid)) expandedProducts.delete(pid);
      else { expandedProducts.clear(); expandedProducts.add(pid); }
      render();
    });
  });
}

function bindExecuteEvents() {
  app.querySelectorAll("[data-toggle-exec]").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.dataset.toggleExec;
      if (expandedExecStages.has(key)) expandedExecStages.delete(key);
      else expandedExecStages.add(key);
      render();
    });
  });
}

function bindTimelineEvents() {
  app.querySelector("[data-toggle-completed]")?.addEventListener("click", () => {
    timelineShowCompleted = !timelineShowCompleted;
    render();
  });
  app.querySelectorAll("[data-toggle-later]").forEach(el => {
    el.addEventListener("click", () => {
      timelineShowLater = !timelineShowLater;
      render();
    });
  });
}

function bindCustomerEvents() {
  app.querySelectorAll("[data-customer-card]").forEach(card => {
    card.addEventListener("click", e => {
      if (e.target.closest("button")) return;
      const cid = card.dataset.customerCard;
      if (expandedCustomers.has(cid)) expandedCustomers.delete(cid);
      else expandedCustomers.add(cid);
      render();
    });
  });
}

// =============================================================================
// Edit Modal — 항목 인라인 편집 (담당자/마감일/상태)
// =============================================================================

function renderEditModal() {
  return `
    <div class="modal-overlay hidden" id="edit-modal">
      <div class="modal" style="max-width:420px;">
        <div class="modal-header">
          <h3 class="modal-title">항목 편집</h3>
          <button class="modal-close" id="edit-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="mb-3" id="edit-title-display" style="font-weight:600;color:var(--slate-200);font-size:0.9rem;"></div>
          <div class="mb-3">
            <label class="text-sm font-medium" style="color:var(--slate-300)">담당자</label>
            <input type="text" class="input-field" id="edit-assignee" placeholder="담당자 이름" style="margin-top:4px;">
          </div>
          <div class="mb-3">
            <label class="text-sm font-medium" style="color:var(--slate-300)">부서</label>
            <input type="text" class="input-field" id="edit-department" placeholder="부서" style="margin-top:4px;">
          </div>
          <div class="mb-3">
            <label class="text-sm font-medium" style="color:var(--slate-300)">마감일</label>
            <input type="date" class="input-field" id="edit-duedate" style="margin-top:4px;">
          </div>
          <div class="mb-3">
            <label class="text-sm font-medium" style="color:var(--slate-300)">상태</label>
            <select class="input-field" id="edit-status" style="margin-top:4px;">
              <option value="pending">대기</option>
              <option value="in_progress">진행중</option>
              <option value="completed">완료</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="edit-cancel">취소</button>
          <button class="btn btn-primary" id="edit-submit">저장</button>
        </div>
      </div>
    </div>`;
}

function openEditModal(itemId) {
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;

  const modal = document.getElementById("edit-modal");
  modal.classList.remove("hidden");

  document.getElementById("edit-title-display").textContent = item.title;
  document.getElementById("edit-assignee").value = item.assignee || "";
  document.getElementById("edit-department").value = item.department || "";
  document.getElementById("edit-status").value = item.status || "pending";

  document.getElementById("edit-duedate").value = item.dueDate ? toLocalDateStr(item.dueDate) : "";

  // Store editing item id
  modal.dataset.editingId = itemId;
}

function bindEditEvents() {
  const modal = document.getElementById("edit-modal");
  if (!modal) return;

  document.getElementById("edit-modal-close")?.addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("edit-cancel")?.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); });

  document.getElementById("edit-submit")?.addEventListener("click", async () => {
    const itemId = modal.dataset.editingId;
    if (!itemId) return;

    const updates = {};
    const newAssignee = document.getElementById("edit-assignee").value.trim();
    const newDept = document.getElementById("edit-department").value.trim();
    const newDueDate = document.getElementById("edit-duedate").value;
    const newStatus = document.getElementById("edit-status").value;

    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    if (newAssignee !== (item.assignee || "")) updates.assignee = newAssignee;
    if (newDept !== (item.department || "")) updates.department = newDept;
    if (newStatus !== item.status) updates.status = newStatus;
    if (newDueDate) {
      const oldDate = item.dueDate ? toLocalDateStr(item.dueDate) : "";
      if (newDueDate !== oldDate) updates.dueDate = new Date(newDueDate + "T00:00:00");
    }

    if (Object.keys(updates).length === 0) {
      modal.classList.add("hidden");
      return;
    }

    const submitBtn = document.getElementById("edit-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "저장 중...";
    try {
      if (updates.status === "completed") {
        await completeLaunchChecklist(itemId);
        delete updates.status;
      }
      if (Object.keys(updates).length > 0) {
        await updateLaunchChecklist(itemId, updates);
      }
      modal.classList.add("hidden");
      showToast("success", "항목이 수정되었습니다.");
    } catch (err) {
      showToast("error", "수정 실패: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "저장";
    }
  });

  // Edit button clicks (from command detail + other views)
  app.querySelectorAll("[data-edit-item]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      openEditModal(btn.dataset.editItem);
    });
  });
}

// =============================================================================
// Bulk Actions — 일괄 시작/완료
// =============================================================================

function bindBulkEvents() {
  // Bulk action buttons
  document.getElementById("bulk-start")?.addEventListener("click", async () => {
    const ids = [..._selectedItems];
    const btn = document.getElementById("bulk-start");
    btn.disabled = true;
    btn.textContent = `처리 중... (0/${ids.length})`;
    let done = 0;
    for (const id of ids) {
      const item = allItems.find(i => i.id === id);
      if (item && item.status === "pending") {
        try {
          await updateLaunchChecklist(id, { status: "in_progress" });
          done++;
          btn.textContent = `처리 중... (${done}/${ids.length})`;
        } catch { /* skip */ }
      }
    }
    _selectedItems.clear();
    showToast("success", `${done}건 시작 처리 완료`);
    render();
  });

  document.getElementById("bulk-complete")?.addEventListener("click", async () => {
    const ids = [..._selectedItems];
    const btn = document.getElementById("bulk-complete");
    btn.disabled = true;
    btn.textContent = `처리 중... (0/${ids.length})`;
    let done = 0;
    for (const id of ids) {
      const item = allItems.find(i => i.id === id);
      if (item && item.status !== "completed") {
        try {
          await completeLaunchChecklist(id);
          done++;
          btn.textContent = `처리 중... (${done}/${ids.length})`;
        } catch { /* skip */ }
      }
    }
    _selectedItems.clear();
    showToast("success", `${done}건 완료 처리`);
    render();
  });

  document.getElementById("bulk-clear")?.addEventListener("click", () => {
    _selectedItems.clear();
    render();
  });

  // Checkboxes
  app.querySelectorAll("[data-bulk-check]").forEach(cb => {
    cb.addEventListener("change", e => {
      const id = cb.dataset.bulkCheck;
      if (cb.checked) _selectedItems.add(id);
      else _selectedItems.delete(id);
      // Update bulk bar without full re-render
      const bar = document.getElementById("bulk-bar");
      if (_selectedItems.size > 0 && !bar) render();
      else if (_selectedItems.size === 0 && bar) render();
      else if (bar) bar.querySelector("span").textContent = `${_selectedItems.size}개 선택`;
    });
  });
}

init();
