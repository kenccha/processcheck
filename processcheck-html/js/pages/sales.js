// =============================================================================
// Sales Dashboard — 영업 출시 준비 대시보드 (멀티뷰)
// 5가지 뷰: 제품별 카드 | 카테고리 매트릭스 | D-Day 타임라인 | 거래처 현황 | 테이블
// =============================================================================

import { initTheme, renderNav } from "../components.js";
import { guardPage } from "../auth.js";
import {
  subscribeAllLaunchChecklists,
  subscribeProjects,
  completeLaunchChecklist,
  updateLaunchChecklist,
  confirmLaunchChecklist,
  LAUNCH_CATEGORY_LABELS,
} from "../firestore-service.js";
import { escapeHtml, formatDate, daysUntil, timeAgo } from "../utils.js";

initTheme();

const user = guardPage();
if (!user) throw new Error("Not authenticated");

const app = document.getElementById("app");
const navRoot = document.getElementById("nav-root");

// =============================================================================
// View Modes
// =============================================================================

const VIEW_MODES = [
  { key: "product",  label: "제품별" },
  { key: "matrix",   label: "카테고리" },
  { key: "timeline", label: "D-Day" },
  { key: "customer", label: "거래처" },
  { key: "table",    label: "테이블" },
];

// =============================================================================
// State
// =============================================================================

let allItems = [];
let projects = [];
let viewMode = "product";
let filterProject = "all";
let filterCategory = "all";
let filterStatus = "all";
let searchQuery = "";
let showAllCategories = false;

// Table view
let collapsedProjects = new Set();
// Product card view
let expandedProducts = new Set();
// Customer board view
let expandedCustomers = new Set();
// Timeline view
let timelineShowCompleted = false;
let timelineShowLater = false;

// Confirm modal
let pendingConfirmId = null;

// 영업 핵심 카테고리
const SALES_CORE_CATEGORIES = ["pricing", "sales_training", "dealer_notify"];
const SALES_DEPT_KEYWORDS = ["영업"];

// =============================================================================
// Init
// =============================================================================

function init() {
  renderNav(navRoot);
  subscribeProjects((data) => {
    projects = data;
    render();
  });
  subscribeAllLaunchChecklists((data) => {
    allItems = data;
    render();
  });
}

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

function getStatusBadge(status) {
  const map = {
    pending: { label: "대기", cls: "badge-neutral" },
    in_progress: { label: "진행중", cls: "badge-warning" },
    completed: { label: "완료", cls: "badge-success" },
  };
  const s = map[status] || { label: status, cls: "badge-neutral" };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function getCategoryBadge(category) {
  const label = LAUNCH_CATEGORY_LABELS[category] || category;
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

function getDDayBadge(item) {
  if (!item.dueDate) return "";
  const days = daysUntil(item.dueDate);
  if (days === null) return "";
  if (days < 0) return `<span class="badge badge-danger">D+${Math.abs(days)}</span>`;
  if (days <= 7) return `<span class="badge badge-warning">D-${days}</span>`;
  return `<span class="badge badge-neutral">D-${days}</span>`;
}

function getCheckedDisplay(item) {
  if (item.checkedBy) {
    const dateStr = item.checkedAt ? timeAgo(item.checkedAt) : "";
    return `<span class="badge badge-success" style="font-size:10px;" title="${item.checkedNote || ""}">✓ ${escapeHtml(item.checkedBy)}</span>${dateStr ? `<br><span class="text-xs text-soft">${dateStr}</span>` : ""}`;
  }
  if (item.customerId) {
    return `<button class="btn btn-sm btn-secondary confirm-btn" data-id="${item.id}" title="거래처 확인 처리" style="font-size:11px;padding:2px 8px;">확인</button>`;
  }
  return `<span class="text-xs text-soft">—</span>`;
}

function getActionButtons(item) {
  if (item.status === "pending") return `<button class="btn btn-sm btn-secondary start-btn" data-id="${item.id}" title="시작">&#9654;</button>`;
  if (item.status === "in_progress") return `<button class="btn btn-sm btn-primary complete-btn" data-id="${item.id}" title="완료">&#10003;</button>`;
  return "";
}

function renderEmpty() {
  return `<div class="card" style="padding:3rem;text-align:center;"><p class="text-soft">표시할 항목이 없습니다</p></div>`;
}

function renderItemRow(item, opts = {}) {
  const showProject = opts.showProject !== false;
  const showCategory = opts.showCategory !== false;
  const showCustomer = opts.showCustomer !== false;
  const showChecked = opts.showChecked !== false;
  const isOverdue = item.status !== "completed" && item.dueDate && daysUntil(item.dueDate) !== null && daysUntil(item.dueDate) < 0;
  return `
    <tr${isOverdue ? ' style="background:rgba(239,68,68,0.06);"' : ""}>
      <td><code class="text-sm">${escapeHtml(item.code || "")}</code></td>
      <td>
        ${escapeHtml(item.title)}
        ${item.isRequired ? '<span class="badge badge-danger" style="margin-left:4px;font-size:10px;">필수</span>' : ""}
      </td>
      ${showProject ? `<td class="text-sm">${escapeHtml(getProjectName(item.projectId))}</td>` : ""}
      ${showCategory ? `<td class="text-sm">${getCategoryBadge(item.category)}</td>` : ""}
      <td class="text-sm">${escapeHtml(item.assignee || item.department || "")}</td>
      <td>${getStatusBadge(item.status)}</td>
      <td class="text-sm">${getDueDateDisplay(item)}</td>
      ${showCustomer ? `<td class="text-sm">${item.customerName ? `<span class="badge badge-neutral">${escapeHtml(item.customerName)}</span>` : "—"}</td>` : ""}
      ${showChecked ? `<td class="text-sm">${getCheckedDisplay(item)}</td>` : ""}
      <td>${getActionButtons(item)}</td>
    </tr>`;
}

function renderItemTable(items, opts = {}) {
  const showProject = opts.showProject !== false;
  const showCategory = opts.showCategory !== false;
  const showCustomer = opts.showCustomer !== false;
  const showChecked = opts.showChecked !== false;
  return `
    <div style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th style="width:70px;">코드</th>
            <th>항목</th>
            ${showProject ? '<th>프로젝트</th>' : ''}
            ${showCategory ? '<th>카테고리</th>' : ''}
            <th>담당</th>
            <th>상태</th>
            <th>마감일</th>
            ${showCustomer ? '<th>고객</th>' : ''}
            ${showChecked ? '<th>확인</th>' : ''}
            <th style="width:60px;">액션</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => renderItemRow(item, opts)).join("")}
        </tbody>
      </table>
    </div>`;
}

// =============================================================================
// Main Render
// =============================================================================

function render() {
  const filtered = getFiltered();

  // 통계 (영업 관련 전체 기준)
  const salesItems = showAllCategories ? allItems : allItems.filter(isSalesRelevant);
  const customerItems = salesItems.filter(i => i.customerId);
  const uncheckedCount = customerItems.filter(i => !i.checkedBy).length;
  const stats = {
    total: salesItems.length,
    completed: salesItems.filter((i) => i.status === "completed").length,
    unchecked: uncheckedCount,
    overdue: salesItems.filter((i) => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    }).length,
  };

  // 프로젝트/카테고리 선택 옵션
  const projectIds = [...new Set(allItems.map((i) => i.projectId))];
  const categories = showAllCategories
    ? Object.keys(LAUNCH_CATEGORY_LABELS)
    : [...SALES_CORE_CATEGORIES];

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- 헤더 -->
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color:var(--slate-100)">영업 출시 준비 대시보드</h1>
          <p class="text-sm text-soft mt-1">전체 프로젝트의 영업 관련 출시 체크리스트를 한 눈에 확인</p>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;" class="text-sm text-soft">
          <input type="checkbox" id="toggle-all-categories" ${showAllCategories ? "checked" : ""}>
          전체 카테고리 보기
        </label>
      </div>

      <!-- Stat 카드 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card card-hover cursor-pointer" data-stat-action="all">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-card-label">전체 항목</div>
        </div>
        <div class="stat-card card-hover cursor-pointer" data-stat-action="completed">
          <div class="stat-value text-success">${stats.completed}</div>
          <div class="stat-card-label">완료</div>
        </div>
        <div class="stat-card card-hover cursor-pointer" data-stat-action="unchecked">
          <div class="stat-value" style="color:var(--warning)">${stats.unchecked}</div>
          <div class="stat-card-label">미확인 (거래처)</div>
        </div>
        <div class="stat-card card-hover cursor-pointer" data-stat-action="overdue">
          <div class="stat-value" style="color:var(--danger)">${stats.overdue}</div>
          <div class="stat-card-label">마감 초과</div>
        </div>
      </div>

      <!-- 필터 바 + 뷰 스위처 -->
      <div class="card mb-6" style="padding: 1rem 1.25rem;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <input type="text" class="input-field" id="search-input" placeholder="검색 (제목, 코드, 부서, 고객명)" value="${escapeHtml(searchQuery)}" style="flex:1;min-width:200px;">
          <select class="input-field" id="filter-project" style="width:auto;">
            <option value="all">전체 프로젝트</option>
            ${projectIds.map((pid) => `<option value="${pid}" ${filterProject === pid ? "selected" : ""}>${escapeHtml(getProjectName(pid))}</option>`).join("")}
          </select>
          <select class="input-field" id="filter-category" style="width:auto;">
            <option value="all">전체 카테고리</option>
            ${categories.map((cat) => `<option value="${cat}" ${filterCategory === cat ? "selected" : ""}>${LAUNCH_CATEGORY_LABELS[cat] || cat}</option>`).join("")}
          </select>
          <select class="input-field" id="filter-status" style="width:auto;">
            <option value="all">전체 상태</option>
            <option value="pending" ${filterStatus === "pending" ? "selected" : ""}>대기</option>
            <option value="in_progress" ${filterStatus === "in_progress" ? "selected" : ""}>진행중</option>
            <option value="completed" ${filterStatus === "completed" ? "selected" : ""}>완료</option>
          </select>
        </div>
      </div>

      <!-- 뷰 스위처 -->
      <div class="flex items-center justify-between mb-4">
        <div class="view-switcher">
          ${VIEW_MODES.map(vm =>
            `<button class="view-switcher-btn${viewMode === vm.key ? " active" : ""}" data-view="${vm.key}">${vm.label}</button>`
          ).join("")}
        </div>
        <span class="text-sm text-soft">${filtered.length}개 항목</span>
      </div>

      <!-- 뷰 콘텐츠 -->
      <div id="view-content">
        ${renderViewContent(filtered)}
      </div>

      <!-- 확인 모달 -->
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
      </div>
    </div>
  `;

  bindEvents();

  // Restore search focus
  if (searchQuery) {
    const input = app.querySelector("#search-input");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

// =============================================================================
// View Dispatcher
// =============================================================================

function renderViewContent(filtered) {
  switch (viewMode) {
    case "product":  return renderProductCards(filtered);
    case "matrix":   return renderCategoryMatrix(filtered);
    case "timeline": return renderTimelineView(filtered);
    case "customer": return renderCustomerBoard(filtered);
    case "table":    return renderTableView(filtered);
    default:         return renderProductCards(filtered);
  }
}

// =============================================================================
// View 1: 제품별 카드뷰
// =============================================================================

function renderProductCards(filtered) {
  // Group by project
  const grouped = {};
  for (const item of filtered) {
    if (!grouped[item.projectId]) grouped[item.projectId] = [];
    grouped[item.projectId].push(item);
  }

  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const overdueA = a[1].filter(i => i.status !== "completed" && i.dueDate && daysUntil(i.dueDate) !== null && daysUntil(i.dueDate) < 0).length;
    const overdueB = b[1].filter(i => i.status !== "completed" && i.dueDate && daysUntil(i.dueDate) !== null && daysUntil(i.dueDate) < 0).length;
    return overdueB - overdueA;
  });

  if (sortedGroups.length === 0) return renderEmpty();

  let html = `<div class="grid grid-cols-1 gap-4" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr));">`;

  for (const [projectId, items] of sortedGroups) {
    const proj = projects.find(p => p.id === projectId);
    const pName = getProjectName(projectId);
    const completedCount = items.filter(i => i.status === "completed").length;
    const pct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
    const overdueCount = items.filter(i => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    }).length;
    const custItems = items.filter(i => i.customerId);
    const unchecked = custItems.filter(i => !i.checkedBy).length;
    const isExpanded = expandedProducts.has(projectId);

    // Category breakdown
    const catMap = {};
    for (const item of items) {
      if (!catMap[item.category]) catMap[item.category] = { total: 0, done: 0 };
      catMap[item.category].total++;
      if (item.status === "completed") catMap[item.category].done++;
    }
    const catEntries = Object.entries(catMap).sort((a, b) => {
      const pctA = a[1].total > 0 ? a[1].done / a[1].total : 1;
      const pctB = b[1].total > 0 ? b[1].done / b[1].total : 1;
      return pctA - pctB; // least complete first
    });

    html += `
      <div class="card card-hover cursor-pointer" data-product-card="${projectId}" style="padding:0;overflow:hidden;${isExpanded ? 'outline:2px solid var(--primary);' : ''}">
        <div style="padding:1.25rem;">
          <!-- Header -->
          <div class="flex items-center justify-between mb-2">
            <div>
              <strong style="color:var(--slate-100);font-size:1.05rem;">${escapeHtml(pName)}</strong>
              ${proj && proj.currentStage ? `<span class="text-xs text-soft" style="margin-left:6px;">${escapeHtml(proj.currentStage)}</span>` : ""}
            </div>
            <span class="text-lg font-mono font-bold" style="color:var(--primary-400)">${pct}%</span>
          </div>

          <!-- Progress bar -->
          <div class="progress-bar mb-3" style="height:6px;">
            <div class="progress-fill" style="width:${pct}%;${pct >= 80 ? 'background:var(--success)' : pct >= 50 ? 'background:var(--primary)' : 'background:var(--warning)'}"></div>
          </div>

          <!-- Badges row -->
          <div class="flex items-center gap-2 flex-wrap mb-3">
            <span class="badge badge-neutral">${completedCount}/${items.length} 완료</span>
            ${overdueCount > 0 ? `<span class="badge badge-danger">${overdueCount} 지연</span>` : ""}
            ${unchecked > 0 ? `<span class="badge badge-warning">${unchecked} 미확인</span>` : ""}
          </div>

          <!-- Category mini progress (top 6) -->
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${catEntries.slice(0, 6).map(([cat, data]) => {
              const catPct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
              const catLabel = LAUNCH_CATEGORY_LABELS[cat] || cat;
              return `
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="text-xs" style="width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--slate-400);">${escapeHtml(catLabel)}</span>
                  <div class="progress-bar" style="flex:1;height:4px;">
                    <div class="progress-fill" style="width:${catPct}%;${catPct >= 100 ? 'background:var(--success)' : ''}"></div>
                  </div>
                  <span class="text-xs text-soft" style="min-width:36px;text-align:right;">${data.done}/${data.total}</span>
                </div>`;
            }).join("")}
            ${catEntries.length > 6 ? `<span class="text-xs text-soft">외 ${catEntries.length - 6}개 카테고리</span>` : ""}
          </div>

          <!-- Expand hint -->
          <div class="text-xs text-soft text-center" style="margin-top:10px;">
            ${isExpanded ? "▲ 접기" : "▼ 상세 보기"}
          </div>
        </div>

        <!-- Expanded detail -->
        ${isExpanded ? renderProductDetail(projectId, items, catEntries) : ""}
      </div>`;
  }

  html += `</div>`;
  return html;
}

function renderProductDetail(projectId, items, catEntries) {
  let html = `<div style="border-top:1px solid var(--border);">`;

  for (const [cat, data] of catEntries) {
    const catLabel = LAUNCH_CATEGORY_LABELS[cat] || cat;
    const catItems = items.filter(i => i.category === cat);
    html += `
      <div style="padding:0.5rem 1rem;background:var(--surface-2);border-bottom:1px solid var(--surface-3);">
        <div class="flex items-center justify-between">
          ${getCategoryBadge(cat)}
          <span class="text-xs text-soft">${data.done}/${data.total}</span>
        </div>
      </div>
      ${renderItemTable(catItems, { showProject: false, showCategory: false })}`;
  }

  html += `</div>`;
  return html;
}

// =============================================================================
// View 2: 카테고리 매트릭스
// =============================================================================

function renderCategoryMatrix(filtered) {
  const cats = showAllCategories
    ? Object.keys(LAUNCH_CATEGORY_LABELS)
    : [...new Set(filtered.map(i => i.category))];

  // Build matrix
  const matrix = {};
  for (const cat of cats) {
    matrix[cat] = { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
  }
  for (const item of filtered) {
    if (!matrix[item.category]) {
      matrix[item.category] = { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
    }
    matrix[item.category].total++;
    matrix[item.category][item.status]++;
    if (item.status !== "completed" && item.dueDate && daysUntil(item.dueDate) !== null && daysUntil(item.dueDate) < 0) {
      matrix[item.category].overdue++;
    }
  }

  // Sort: least complete first
  const sortedCats = Object.entries(matrix)
    .filter(([, d]) => d.total > 0)
    .sort((a, b) => {
      const pctA = a[1].total > 0 ? a[1].completed / a[1].total : 1;
      const pctB = b[1].total > 0 ? b[1].completed / b[1].total : 1;
      return pctA - pctB;
    });

  if (sortedCats.length === 0) return renderEmpty();

  // Totals
  const totals = { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
  for (const [, d] of sortedCats) {
    totals.total += d.total;
    totals.pending += d.pending;
    totals.in_progress += d.in_progress;
    totals.completed += d.completed;
    totals.overdue += d.overdue;
  }
  const totalPct = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  let html = `
    <div class="table-wrapper mb-6">
      <table>
        <thead>
          <tr>
            <th>카테고리</th>
            <th style="text-align:center;">전체</th>
            <th style="text-align:center;">대기</th>
            <th style="text-align:center;">진행중</th>
            <th style="text-align:center;">완료</th>
            <th style="text-align:center;">지연</th>
            <th>진행률</th>
          </tr>
        </thead>
        <tbody>
          ${sortedCats.map(([cat, d]) => {
            const pct = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;
            const isSalesCore = SALES_CORE_CATEGORIES.includes(cat);
            const rowBg = d.overdue > 0 ? 'background:rgba(239,68,68,0.04);' : '';
            return `
              <tr class="cursor-pointer" data-matrix-category="${cat}" style="${rowBg}" title="클릭하여 상세 보기">
                <td>
                  ${getCategoryBadge(cat)}
                  ${isSalesCore ? ' <span style="color:var(--warning);font-size:11px;">★</span>' : ""}
                </td>
                <td style="text-align:center;" class="font-mono">${d.total}</td>
                <td style="text-align:center;">${d.pending > 0 ? `<span class="badge badge-neutral">${d.pending}</span>` : '<span class="text-soft">0</span>'}</td>
                <td style="text-align:center;">${d.in_progress > 0 ? `<span class="badge badge-warning">${d.in_progress}</span>` : '<span class="text-soft">0</span>'}</td>
                <td style="text-align:center;">${d.completed > 0 ? `<span class="badge badge-success">${d.completed}</span>` : '<span class="text-soft">0</span>'}</td>
                <td style="text-align:center;">${d.overdue > 0 ? `<span class="badge badge-danger">${d.overdue}</span>` : '<span class="text-soft">0</span>'}</td>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="progress-bar" style="width:100px;">
                      <div class="progress-fill" style="width:${pct}%;${pct >= 100 ? 'background:var(--success)' : ''}"></div>
                    </div>
                    <span class="text-xs font-mono">${pct}%</span>
                  </div>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
        <tfoot>
          <tr style="font-weight:600;background:var(--surface-2);">
            <td>합계</td>
            <td style="text-align:center;" class="font-mono">${totals.total}</td>
            <td style="text-align:center;">${totals.pending}</td>
            <td style="text-align:center;">${totals.in_progress}</td>
            <td style="text-align:center;">${totals.completed}</td>
            <td style="text-align:center;">${totals.overdue}</td>
            <td>
              <div class="flex items-center gap-2">
                <div class="progress-bar" style="width:100px;">
                  <div class="progress-fill" style="width:${totalPct}%"></div>
                </div>
                <span class="text-xs font-mono">${totalPct}%</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  // Project × Category sub-matrix
  const projectIds = [...new Set(filtered.map(i => i.projectId))];
  if (projectIds.length > 1) {
    html += `
      <h3 class="text-sm font-medium mb-3" style="color:var(--slate-300);">프로젝트별 카테고리 분포</h3>
      <div class="table-wrapper">
        <table style="font-size:0.8rem;">
          <thead>
            <tr>
              <th>프로젝트</th>
              ${sortedCats.map(([cat]) => {
                const label = LAUNCH_CATEGORY_LABELS[cat] || cat;
                const shortLabel = label.length > 6 ? label.slice(0, 6) + "…" : label;
                return `<th style="text-align:center;font-size:11px;" title="${escapeHtml(label)}">${escapeHtml(shortLabel)}</th>`;
              }).join("")}
            </tr>
          </thead>
          <tbody>
            ${projectIds.map(pid => {
              const pItems = filtered.filter(i => i.projectId === pid);
              return `
                <tr>
                  <td class="text-xs">${escapeHtml(getProjectName(pid))}</td>
                  ${sortedCats.map(([cat]) => {
                    const catItems = pItems.filter(i => i.category === cat);
                    const done = catItems.filter(i => i.status === "completed").length;
                    const total = catItems.length;
                    if (total === 0) return `<td style="text-align:center;"><span class="text-soft">—</span></td>`;
                    const cellPct = Math.round((done / total) * 100);
                    const color = cellPct >= 100 ? 'color:var(--success)' : cellPct >= 50 ? 'color:var(--primary-400)' : cellPct > 0 ? 'color:var(--warning)' : 'color:var(--slate-500)';
                    return `<td style="text-align:center;${color};font-weight:500;">${done}/${total}</td>`;
                  }).join("")}
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  return html;
}

// =============================================================================
// View 3: D-Day 타임라인
// =============================================================================

function renderTimelineView(filtered) {
  const active = filtered.filter(i => i.status !== "completed");
  const completed = filtered.filter(i => i.status === "completed");

  const buckets = {
    overdue: [],
    thisWeek: [],
    nextWeek: [],
    upcoming: [],
    later: [],
    noDueDate: [],
  };

  for (const item of active) {
    const d = daysUntil(item.dueDate);
    if (d === null)    { buckets.noDueDate.push(item); }
    else if (d < 0)    { buckets.overdue.push(item); }
    else if (d <= 7)   { buckets.thisWeek.push(item); }
    else if (d <= 14)  { buckets.nextWeek.push(item); }
    else if (d <= 30)  { buckets.upcoming.push(item); }
    else               { buckets.later.push(item); }
  }

  // Sort within each bucket
  for (const key of Object.keys(buckets)) {
    buckets[key].sort((a, b) => (daysUntil(a.dueDate) ?? 999) - (daysUntil(b.dueDate) ?? 999));
  }

  if (active.length === 0 && completed.length === 0) return renderEmpty();

  const sections = [
    { key: "overdue", label: "마감 초과", icon: "🚨", items: buckets.overdue, color: "var(--danger)", bg: "rgba(239,68,68,0.06)", alwaysOpen: true },
    { key: "thisWeek", label: "이번 주 (D-7 ~ D0)", icon: "⚠️", items: buckets.thisWeek, color: "var(--warning)", bg: "rgba(245,158,11,0.06)", alwaysOpen: true },
    { key: "nextWeek", label: "다음 주 (D1 ~ D7)", icon: "📅", items: buckets.nextWeek, color: "var(--primary-400)", bg: "rgba(6,182,212,0.06)", alwaysOpen: true },
    { key: "upcoming", label: "이후 (D8 ~ D30)", icon: "📋", items: buckets.upcoming, color: "var(--slate-400)", bg: "transparent", alwaysOpen: false, toggleKey: "later" },
    { key: "later", label: "장기 (D31+)", icon: "📦", items: buckets.later, color: "var(--slate-500)", bg: "transparent", alwaysOpen: false, toggleKey: "later" },
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
        ${isOpen ? renderItemTable(sec.items, { showProject: true, showCategory: true, showCustomer: false, showChecked: false }) : ""}
      </div>`;
  }

  // No due date items
  if (buckets.noDueDate.length > 0) {
    html += `
      <div class="card" style="border-left:4px solid var(--slate-600);padding:0;overflow:hidden;">
        <div style="padding:0.75rem 1rem;background:transparent;border-bottom:1px solid var(--border);">
          <div class="flex items-center gap-2">
            <span>❓</span>
            <strong style="color:var(--slate-500)">마감일 미설정</strong>
            <span class="badge badge-neutral" style="font-size:11px;">${buckets.noDueDate.length}건</span>
          </div>
        </div>
        ${renderItemTable(buckets.noDueDate, { showProject: true, showCategory: true, showCustomer: false, showChecked: false })}
      </div>`;
  }

  // Completed (collapsed by default)
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
        ${timelineShowCompleted ? renderItemTable(completed.slice(0, 50), { showProject: true, showCategory: true, showCustomer: false, showChecked: false }) : ""}
        ${timelineShowCompleted && completed.length > 50 ? `<div class="text-xs text-soft text-center" style="padding:0.5rem;">외 ${completed.length - 50}건</div>` : ""}
      </div>`;
  }

  html += `</div>`;
  return html;
}

// =============================================================================
// View 4: 거래처 확인현황 보드
// =============================================================================

function renderCustomerBoard(filtered) {
  const customerItems = filtered.filter(i => i.customerId);
  const nonCustomerCount = filtered.filter(i => !i.customerId).length;

  // Group by customer
  const byCustomer = {};
  for (const item of customerItems) {
    const key = item.customerId;
    if (!byCustomer[key]) {
      byCustomer[key] = { customerId: item.customerId, customerName: item.customerName || "알 수 없음", items: [] };
    }
    byCustomer[key].items.push(item);
  }

  const customerList = Object.values(byCustomer).sort((a, b) => {
    const uncA = a.items.filter(i => !i.checkedBy).length;
    const uncB = b.items.filter(i => !i.checkedBy).length;
    return uncB - uncA;
  });

  // Total stats
  const totalChecked = customerItems.filter(i => i.checkedBy).length;
  const totalUnchecked = customerItems.filter(i => !i.checkedBy).length;

  if (customerList.length === 0) {
    return `
      <div class="card" style="padding:3rem;text-align:center;">
        <p class="text-soft">거래처별 항목이 없습니다</p>
        ${nonCustomerCount > 0 ? `<p class="text-xs text-soft" style="margin-top:8px;">일반 항목 ${nonCustomerCount}건은 테이블 뷰에서 확인하세요</p>` : ""}
      </div>`;
  }

  let html = `
    <!-- 요약 배너 -->
    <div class="card mb-4" style="padding:1rem 1.25rem;">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <strong style="color:var(--slate-100)">거래처별 확인 현황</strong>
          <span class="text-sm text-soft" style="margin-left:8px;">${customerList.length}개 거래처 · ${customerItems.length}개 항목</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="badge badge-success">확인 완료 ${totalChecked}</span>
          <span class="badge badge-warning">미확인 ${totalUnchecked}</span>
        </div>
      </div>
    </div>

    <!-- 거래처 카드 -->
    <div class="grid grid-cols-1 gap-4" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));">`;

  for (const cust of customerList) {
    const checkedCount = cust.items.filter(i => i.checkedBy).length;
    const uncheckedCount = cust.items.filter(i => !i.checkedBy).length;
    const completedCount = cust.items.filter(i => i.status === "completed").length;
    const inProgressCount = cust.items.filter(i => i.status === "in_progress").length;
    const pendingCount = cust.items.filter(i => i.status === "pending").length;
    const overdueCount = cust.items.filter(i => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    }).length;
    const confirmedPct = cust.items.length > 0 ? Math.round((checkedCount / cust.items.length) * 100) : 0;
    const isExpanded = expandedCustomers.has(cust.customerId);

    html += `
      <div class="card card-hover cursor-pointer" data-customer-card="${cust.customerId}" style="padding:0;overflow:hidden;${isExpanded ? 'outline:2px solid var(--primary);' : ''}">
        <div style="padding:1rem 1.25rem;">
          <!-- Header -->
          <div class="flex items-center justify-between mb-2">
            <strong style="color:var(--slate-100);">${escapeHtml(cust.customerName)}</strong>
            <span class="text-xs text-soft">${cust.items.length}개 항목</span>
          </div>

          <!-- Confirmation progress -->
          <div class="progress-bar mb-2" style="height:6px;">
            <div class="progress-fill" style="width:${confirmedPct}%;background:var(--success);"></div>
          </div>
          <div class="flex items-center justify-between text-xs mb-3">
            <span style="color:var(--success)">확인 ${checkedCount}</span>
            <span style="color:var(--warning)">미확인 ${uncheckedCount}</span>
          </div>

          <!-- Status badges -->
          <div class="flex items-center gap-2 flex-wrap">
            ${completedCount > 0 ? `<span class="badge badge-success">${completedCount} 완료</span>` : ""}
            ${inProgressCount > 0 ? `<span class="badge badge-warning">${inProgressCount} 진행</span>` : ""}
            ${pendingCount > 0 ? `<span class="badge badge-neutral">${pendingCount} 대기</span>` : ""}
            ${overdueCount > 0 ? `<span class="badge badge-danger">${overdueCount} 지연</span>` : ""}
          </div>

          <!-- Expand hint -->
          <div class="text-xs text-soft text-center" style="margin-top:8px;">
            ${isExpanded ? "▲ 접기" : "▼ 상세 보기"}
          </div>
        </div>

        <!-- Expanded detail -->
        ${isExpanded ? `
          <div style="border-top:1px solid var(--border);">
            ${renderItemTable(cust.items, { showProject: true, showCategory: true, showCustomer: false, showChecked: true })}
          </div>` : ""}
      </div>`;
  }

  html += `</div>`;

  // Non-customer items note
  if (nonCustomerCount > 0) {
    html += `
      <div class="card" style="padding:0.75rem 1rem;margin-top:1rem;">
        <span class="text-sm text-soft">거래처 미지정 항목: ${nonCustomerCount}건 — 테이블 뷰에서 확인하세요</span>
      </div>`;
  }

  return html;
}

// =============================================================================
// View 5: 테이블 (기존 뷰)
// =============================================================================

function renderTableView(filtered) {
  const grouped = {};
  for (const item of filtered) {
    if (!grouped[item.projectId]) grouped[item.projectId] = [];
    grouped[item.projectId].push(item);
  }

  if (Object.keys(grouped).length === 0) return renderEmpty();

  return Object.entries(grouped).map(([projectId, items]) => {
    const pName = getProjectName(projectId);
    const proj = projects.find((p) => p.id === projectId);
    const isCollapsed = collapsedProjects.has(projectId);
    const completedCount = items.filter((i) => i.status === "completed").length;
    const overdueCount = items.filter((i) => {
      if (i.status === "completed") return false;
      const d = daysUntil(i.dueDate);
      return d !== null && d < 0;
    }).length;
    const custItems = items.filter(i => i.customerId);
    const unchecked = custItems.filter(i => !i.checkedBy).length;
    const pct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

    return `
      <div class="card mb-4" style="padding:0;overflow:hidden;">
        <div class="project-group-header" data-project-id="${projectId}" style="padding:1rem 1.25rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:${isCollapsed ? "none" : "1px solid var(--border)"};">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="transition:transform 0.2s;transform:rotate(${isCollapsed ? "0" : "90"}deg);font-size:12px;">&#9654;</span>
            <div>
              <strong style="color:var(--slate-100)">${escapeHtml(pName)}</strong>
              ${proj ? `<span class="text-sm text-soft" style="margin-left:8px;">${proj.currentStage || ""}</span>` : ""}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            ${overdueCount > 0 ? `<span class="badge" style="background:var(--danger);color:#fff;">${overdueCount} 지연</span>` : ""}
            ${unchecked > 0 ? `<span class="badge badge-warning" style="font-size:10px;">${unchecked} 미확인</span>` : ""}
            <span class="text-sm text-soft">${completedCount}/${items.length}</span>
            <div style="width:80px;height:6px;background:var(--surface-2);border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:var(--primary);border-radius:3px;"></div>
            </div>
            <span class="text-sm font-medium" style="color:var(--primary);min-width:32px;text-align:right;">${pct}%</span>
          </div>
        </div>
        ${isCollapsed ? "" : renderItemTable(items, { showProject: false, showCategory: false })}
      </div>`;
  }).join("");
}

// =============================================================================
// Event Binding
// =============================================================================

function bindEvents() {
  // Search & filters
  app.querySelector("#search-input")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    render();
  });
  app.querySelector("#filter-project")?.addEventListener("change", (e) => {
    filterProject = e.target.value;
    render();
  });
  app.querySelector("#filter-category")?.addEventListener("change", (e) => {
    filterCategory = e.target.value;
    render();
  });
  app.querySelector("#filter-status")?.addEventListener("change", (e) => {
    filterStatus = e.target.value;
    render();
  });
  app.querySelector("#toggle-all-categories")?.addEventListener("change", (e) => {
    showAllCategories = e.target.checked;
    filterCategory = "all";
    render();
  });

  // View mode switcher
  app.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      viewMode = btn.dataset.view;
      render();
    });
  });

  // Stat card click actions
  app.querySelectorAll("[data-stat-action]").forEach((card) => {
    card.addEventListener("click", () => {
      const action = card.dataset.statAction;
      if (action === "all") { filterStatus = "all"; }
      if (action === "completed") { filterStatus = "completed"; }
      if (action === "unchecked") { viewMode = "customer"; filterStatus = "all"; }
      if (action === "overdue") { viewMode = "timeline"; filterStatus = "all"; }
      render();
    });
  });

  // Product card expand/collapse
  app.querySelectorAll("[data-product-card]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const pid = card.dataset.productCard;
      if (expandedProducts.has(pid)) {
        expandedProducts.delete(pid);
      } else {
        expandedProducts.clear();
        expandedProducts.add(pid);
      }
      render();
    });
  });

  // Customer card expand/collapse
  app.querySelectorAll("[data-customer-card]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const cid = card.dataset.customerCard;
      if (expandedCustomers.has(cid)) {
        expandedCustomers.delete(cid);
      } else {
        expandedCustomers.add(cid);
      }
      render();
    });
  });

  // Matrix row drill-down
  app.querySelectorAll("[data-matrix-category]").forEach((row) => {
    row.addEventListener("click", () => {
      filterCategory = row.dataset.matrixCategory;
      viewMode = "table";
      render();
    });
  });

  // Timeline toggles
  app.querySelector("[data-toggle-completed]")?.addEventListener("click", () => {
    timelineShowCompleted = !timelineShowCompleted;
    render();
  });
  app.querySelectorAll("[data-toggle-later]").forEach((el) => {
    el.addEventListener("click", () => {
      timelineShowLater = !timelineShowLater;
      render();
    });
  });

  // Table view: project group toggle
  app.querySelectorAll(".project-group-header").forEach((header) => {
    header.addEventListener("click", () => {
      const pid = header.dataset.projectId;
      if (collapsedProjects.has(pid)) {
        collapsedProjects.delete(pid);
      } else {
        collapsedProjects.add(pid);
      }
      render();
    });
  });

  // Start buttons
  app.querySelectorAll(".start-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await updateLaunchChecklist(btn.dataset.id, { status: "in_progress" });
      } catch (err) {
        console.error("시작 실패:", err);
      }
    });
  });

  // Complete buttons
  app.querySelectorAll(".complete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await completeLaunchChecklist(btn.dataset.id);
      } catch (err) {
        console.error("완료 실패:", err);
      }
    });
  });

  // Confirm buttons — open modal
  app.querySelectorAll(".confirm-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      pendingConfirmId = btn.dataset.id;
      const modal = document.getElementById("confirm-modal");
      modal.classList.remove("hidden");
      document.getElementById("confirm-name").value = "";
      document.getElementById("confirm-note").value = "";
      document.getElementById("confirm-name").focus();
    });
  });

  // Modal close
  const modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-modal-close")?.addEventListener("click", () => {
    modal.classList.add("hidden");
    pendingConfirmId = null;
  });
  document.getElementById("confirm-cancel")?.addEventListener("click", () => {
    modal.classList.add("hidden");
    pendingConfirmId = null;
  });
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
      pendingConfirmId = null;
    }
  });

  // Modal submit
  document.getElementById("confirm-submit")?.addEventListener("click", async () => {
    const name = document.getElementById("confirm-name").value.trim();
    if (!name) {
      alert("확인자 이름을 입력해주세요.");
      return;
    }
    const note = document.getElementById("confirm-note").value.trim();
    try {
      await confirmLaunchChecklist(pendingConfirmId, name, note);
      modal.classList.add("hidden");
      pendingConfirmId = null;
    } catch (err) {
      console.error("확인 처리 실패:", err);
      alert("확인 처리에 실패했습니다.");
    }
  });
}

init();
