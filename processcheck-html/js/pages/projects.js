// =============================================================================
// Projects Page -- 7 view modes (cards, table, gantt, kanban, timeline, calendar, matrix)
// =============================================================================

import { guardPage, getUser } from "../auth.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
initTheme();
import { subscribeProjects, subscribeAllChecklistItems, updateProject, createProject } from "../firestore-service.js";
import {
  departments,
  projectStages,
  PHASE_GROUPS,
  GATE_STAGES,
  getStatusLabel,
  getStatusBadgeClass,
  formatStageName,
  formatDate,
  escapeHtml,
  getRiskClass,
  getRiskLabel,
  daysUntil,
  exportToCSV,
} from "../utils.js";

// -- Guard --
const user = guardPage();
if (!user) throw new Error("Unauthorized");

// -- DOM --
const app = document.getElementById("app");
const navRoot = document.getElementById("nav-root");

// -- Render nav --
const unsubNav = renderNav(navRoot);

// -- Read query params --
const urlParams = new URLSearchParams(window.location.search);
const forcedType = urlParams.get("type"); // "신규개발" | "설계변경" | null

// -- State --
let projects = [];
let allTasks = [];
let projectTypeTab = forcedType || "신규개발"; // "신규개발" | "설계변경"
let viewMode = "table"; // table | matrix | cards | gantt | kanban | timeline | calendar
let changeViewMode = "table"; // table | kanban (설계변경 전용)
let searchQuery = "";
let statusFilter = "all"; // all | active | completed | on_hold
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth(); // 0-based
let sortField = "startDate"; // name | status | pm | progress | startDate
let sortDir = "desc"; // asc | desc

// -- Subscriptions --
const unsubProjects = subscribeProjects((data) => {
  projects = data;
  render();
});

const unsubTasks = subscribeAllChecklistItems((data) => {
  allTasks = data;
  render();
});

// -- Cleanup --
window.addEventListener("beforeunload", () => {
  if (unsubNav) unsubNav();
  if (unsubProjects) unsubProjects();
  if (unsubTasks) unsubTasks();
});

// =============================================================================
// Filtering
// =============================================================================

function getFilteredProjects() {
  return projects.filter((p) => {
    // project type tab filter
    const pType = p.projectType || "신규개발";
    if (pType !== projectTypeTab) return false;
    // status filter
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    // search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (p.name || "").toLowerCase().includes(q);
      const typeMatch = (p.productType || "").toLowerCase().includes(q);
      if (!nameMatch && !typeMatch) return false;
    }
    return true;
  });
}

// =============================================================================
// Task stats helpers
// =============================================================================

function getProjectTasks(projectId) {
  return allTasks.filter((t) => t.projectId === projectId);
}

function getTaskStats(projectId) {
  const tasks = getProjectTasks(projectId);
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const delayed = tasks.filter((t) => {
    if (t.status === "completed") return false;
    const d = daysUntil(t.dueDate);
    return d !== null && d < 0;
  }).length;
  return { total, completed, inProgress, delayed };
}

// =============================================================================
// Gantt helpers
// =============================================================================

function getGanttRange(filteredProjects) {
  if (filteredProjects.length === 0) {
    const now = new Date();
    return { minDate: now, maxDate: new Date(now.getTime() + 86400000 * 30), totalDays: 30 };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const p of filteredProjects) {
    const s = new Date(p.startDate).getTime();
    const e = new Date(p.endDate).getTime();
    if (s < min) min = s;
    if (e > max) max = e;
  }
  const totalDays = Math.max(1, Math.ceil((max - min) / 86400000));
  return { minDate: new Date(min), maxDate: new Date(max), totalDays };
}

function getBarPosition(project, minDate, totalDays) {
  const minMs = minDate.getTime();
  const startMs = new Date(project.startDate).getTime();
  const endMs = new Date(project.endDate).getTime();
  const leftPct = Math.max(0, ((startMs - minMs) / (totalDays * 86400000)) * 100);
  const widthPct = Math.max(0.5, ((endMs - startMs) / (totalDays * 86400000)) * 100);
  return { left: leftPct, width: Math.min(widthPct, 100 - leftPct) };
}

// =============================================================================
// Calendar helpers
// =============================================================================

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];

  // Previous month fill
  const prevLast = new Date(year, month, 0);
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false, isToday: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    dt.setHours(0, 0, 0, 0);
    days.push({ date: dt, isCurrentMonth: true, isToday: dt.getTime() === today.getTime() });
  }

  // Next month fill (complete to 42 = 6 rows of 7)
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - daysInMonth - startDow + 1);
    days.push({ date: d, isCurrentMonth: false, isToday: false });
  }

  return days;
}

function sameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// =============================================================================
// View mode labels
// =============================================================================

const VIEW_MODES = [
  { key: "table", label: "테이블" },
  { key: "matrix", label: "매트릭스" },
  { key: "cards", label: "카드" },
  { key: "gantt", label: "간트" },
  { key: "kanban", label: "칸반" },
  { key: "timeline", label: "타임라인" },
  { key: "calendar", label: "캘린더" },
];

const CHANGE_VIEW_MODES = [
  { key: "table", label: "테이블" },
  { key: "kanban", label: "칸반" },
];

// =============================================================================
// Status filter labels
// =============================================================================

const STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "active", label: "활성" },
  { value: "completed", label: "완료" },
  { value: "on_hold", label: "보류" },
];

function getProjectStatusLabel(status) {
  switch (status) {
    case "active": return "활성";
    case "completed": return "완료";
    case "on_hold": return "보류";
    default: return status;
  }
}

function getProjectStatusBadge(status) {
  switch (status) {
    case "active": return "badge-primary";
    case "completed": return "badge-success";
    case "on_hold": return "badge-warning";
    default: return "badge-neutral";
  }
}

// =============================================================================
// Main render
// =============================================================================

function render() {
  const filtered = getFilteredProjects();
  const isChangeTab = projectTypeTab === "설계변경";
  const currentViewModes = isChangeTab ? CHANGE_VIEW_MODES : VIEW_MODES;
  const currentView = isChangeTab ? changeViewMode : viewMode;

  const pageTitle = forcedType === "설계변경" ? "설계변경" : forcedType === "신규개발" ? "출시위원회" : "프로젝트";

  app.innerHTML = `
    <div class="container">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color:var(--slate-100)">${pageTitle}</h1>
          <p class="text-sm text-soft mt-1">총 ${filtered.length}개 프로젝트</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-ghost btn-sm" id="export-projects-csv" style="font-size:0.75rem">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:0.25rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>CSV 내보내기
          </button>
          <button class="btn btn-primary" id="btn-create-project" style="gap:6px">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            ${isChangeTab ? "설계변경 등록" : "프로젝트 등록"}
          </button>
        </div>
      </div>

      <!-- Project Type Tabs (신규개발 / 설계변경) — hidden when forced via URL -->
      ${!forcedType ? `<div class="tab-bar mb-4">
        <button class="tab-btn${projectTypeTab === "신규개발" ? " active" : ""}" data-type-tab="신규개발">신규개발</button>
        <button class="tab-btn${projectTypeTab === "설계변경" ? " active" : ""}" data-type-tab="설계변경">설계변경</button>
      </div>` : ""}

      <!-- Controls -->
      <div class="flex items-center gap-4 mb-6 flex-wrap">
        <!-- Search -->
        <div class="search-wrapper" style="flex:1;min-width:200px;max-width:320px">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input class="input-field" id="search-input" type="text" placeholder="프로젝트 검색..." value="${escapeHtml(searchQuery)}">
        </div>

        <!-- Status filter -->
        <select class="input-field" id="status-filter" style="width:auto;min-width:120px">
          ${STATUS_OPTIONS.map(
            (o) => `<option value="${o.value}"${statusFilter === o.value ? " selected" : ""}>${o.label}</option>`
          ).join("")}
        </select>

        <!-- View mode switcher -->
        <div class="view-switcher">
          ${currentViewModes.map(
            (vm) =>
              `<button class="view-switcher-btn${currentView === vm.key ? " active" : ""}" data-view="${vm.key}">${vm.label}</button>`
          ).join("")}
        </div>
      </div>

      <!-- Content -->
      <div id="view-content">
        ${isChangeTab ? renderChangeViewContent(filtered) : renderViewContent(filtered)}
      </div>
    </div>

    <!-- Create Project Modal -->
    <div class="modal-backdrop" id="create-modal" style="display:none">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <h3 class="modal-title">${isChangeTab ? "설계변경 등록" : "신규개발 프로젝트 등록"}</h3>
          <button class="modal-close" id="create-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="flex flex-col gap-4">
            <div>
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem">프로젝트명 <span style="color:var(--danger-400)">*</span></label>
              <input type="text" class="input-field" id="cp-name" placeholder="${isChangeTab ? "예: 센서 교체 (혈압계)" : "예: 신규 체성분 분석기 개발"}" />
            </div>
            <div>
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem">제품 유형 <span style="color:var(--danger-400)">*</span></label>
              <input type="text" class="input-field" id="cp-product" placeholder="예: 체성분 분석기, 혈압계, FRA" />
            </div>
            ${isChangeTab ? `
            <div>
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem">변경 규모 <span style="color:var(--danger-400)">*</span></label>
              <select class="input-field" id="cp-scale">
                <option value="">선택하세요</option>
                <option value="minor">경미 (minor) — 접수→승인</option>
                <option value="medium">중간 (medium) — 접수→검토→승인→적용</option>
                <option value="major">대규모 (major) — 전체 6 Phase</option>
              </select>
            </div>
            ` : ""}
            <div class="flex gap-4">
              <div style="flex:1">
                <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem">시작일 <span style="color:var(--danger-400)">*</span></label>
                <input type="date" class="input-field" id="cp-start" value="${new Date().toISOString().split("T")[0]}" />
              </div>
              <div style="flex:1">
                <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem">종료 예정일 <span style="color:var(--danger-400)">*</span></label>
                <input type="date" class="input-field" id="cp-end" />
              </div>
            </div>
            <div>
              <label class="text-sm font-medium text-soft" style="display:block;margin-bottom:0.375rem">PM (프로젝트 매니저)</label>
              <input type="text" class="input-field" id="cp-pm" value="${escapeHtml(user.name || "")}" />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="create-modal-cancel">취소</button>
          <button class="btn btn-primary" id="btn-submit-project">등록</button>
        </div>
      </div>
    </div>
  `;

  bindControls();
}

function renderViewContent(filtered) {
  switch (viewMode) {
    case "cards":    return renderCards(filtered);
    case "table":    return renderTable(filtered);
    case "gantt":    return renderGantt(filtered);
    case "kanban":   return renderKanban(filtered);
    case "timeline": return renderTimeline(filtered);
    case "calendar": return renderCalendar(filtered);
    case "matrix":   return renderMatrix(filtered);
    default:         return renderCards(filtered);
  }
}

function renderChangeViewContent(filtered) {
  switch (changeViewMode) {
    case "kanban":  return renderChangeKanban(filtered);
    case "table":   return renderChangeTable(filtered);
    default:        return renderChangeTable(filtered);
  }
}

// =============================================================================
// 설계변경 전용 테이블 뷰
// =============================================================================

function getChangeScaleLabel(scale) {
  switch (scale) {
    case "major": return "대규모";
    case "medium": return "중간";
    case "minor": return "경미";
    default: return scale || "-";
  }
}

function getChangeScaleBadge(scale) {
  switch (scale) {
    case "major": return "badge-danger";
    case "medium": return "badge-warning";
    case "minor": return "badge-neutral";
    default: return "badge-neutral";
  }
}

function renderChangeTable(filtered) {
  if (filtered.length === 0) return renderEmpty();

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>프로젝트명</th>
            <th>규모</th>
            <th>상태</th>
            <th>PM</th>
            <th>중요도</th>
            <th>진행률</th>
            <th>요청일</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(p => `
            <tr class="cursor-pointer" data-project-id="${p.id}">
              <td><span class="font-medium" style="color:var(--slate-100)">${escapeHtml(p.name)}</span></td>
              <td><span class="badge ${getChangeScaleBadge(p.changeScale)}">${getChangeScaleLabel(p.changeScale)}</span></td>
              <td><span class="badge ${getProjectStatusBadge(p.status)}">${getProjectStatusLabel(p.status)}</span></td>
              <td>${escapeHtml(p.pm || "-")}</td>
              <td><span class="risk-dot ${p.riskLevel || ""}"></span> ${getRiskLabel(p.riskLevel)}</td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="progress-bar" style="width:80px">
                    <div class="progress-fill" style="width:${p.progress || 0}%"></div>
                  </div>
                  <span class="text-xs font-mono">${p.progress || 0}%</span>
                </div>
              </td>
              <td class="text-xs whitespace-nowrap">${formatDate(p.startDate)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// =============================================================================
// 설계변경 전용 칸반 뷰
// =============================================================================

function renderChangeKanban(filtered) {
  const columns = [
    { key: "active", label: "진행 중", color: "var(--primary-400)" },
    { key: "completed", label: "완료", color: "var(--success-400)" },
    { key: "on_hold", label: "보류", color: "var(--warning-400)" },
  ];
  // Note: DnD is handled by bindControls() via data-drop-zone and data-drag-project attributes

  return `
    <div class="kanban-board">
      ${columns.map(col => {
        const colProjects = filtered.filter(p => p.status === col.key);
        return `
        <div class="kanban-column" data-kanban-col="${col.key}" style="flex:1;max-width:none">
          <div class="kanban-column-header">
            <div class="flex items-center gap-2">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col.color}"></span>
              <span class="kanban-column-title">${col.label}</span>
            </div>
            <span class="kanban-column-count">${colProjects.length}</span>
          </div>
          <div class="kanban-column-body" data-drop-zone="${col.key}">
            ${colProjects.length === 0
              ? `<div class="empty-state" style="padding:2rem"><span class="empty-state-text">프로젝트 없음</span></div>`
              : colProjects.map(p => `
                <div class="kanban-card" data-project-id="${p.id}" draggable="true" data-drag-project="${p.id}">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-semibold" style="color:var(--slate-100)">${escapeHtml(p.name)}</span>
                    <span class="badge ${getChangeScaleBadge(p.changeScale)}" style="font-size:0.625rem">${getChangeScaleLabel(p.changeScale)}</span>
                  </div>
                  <div class="text-xs text-soft mb-2">PM: ${escapeHtml(p.pm || "-")}</div>
                  <div class="progress-bar mb-1">
                    <div class="progress-fill" style="width:${p.progress || 0}%"></div>
                  </div>
                  <div class="text-xs text-soft">${p.progress || 0}%</div>
                </div>`).join("")}
          </div>
        </div>`;
      }).join("")}
    </div>
  `;
}

// =============================================================================
// 1) Cards view
// =============================================================================

function renderCards(filtered) {
  if (filtered.length === 0) return renderEmpty();

  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${filtered
        .map((p) => {
          const stats = getTaskStats(p.id);
          const riskClass = getRiskClass(p.riskLevel);
          const progress = p.progress || 0;
          return `
          <div class="card-hover p-5 cursor-pointer animate-fade-in" data-project-id="${p.id}">
            <div class="flex items-center justify-between mb-3">
              <span class="badge ${getProjectStatusBadge(p.status)}">${getProjectStatusLabel(p.status)}</span>
              <span class="risk-dot ${p.riskLevel || ""}" title="중요도: ${getRiskLabel(p.riskLevel)}"></span>
            </div>
            <h3 class="font-semibold mb-1" style="color:var(--slate-100)">${escapeHtml(p.name)}</h3>
            <p class="text-xs text-soft mb-3">${escapeHtml(p.productType || "")}</p>
            <div class="text-xs text-soft mb-1">PM: ${escapeHtml(p.pm || "-")}</div>
            <div class="text-xs text-soft mb-3">${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}</div>
            <div class="text-xs text-soft mb-1">현재 단계: <span style="color:var(--primary-300)">${formatStageName(p.currentStage)}</span></div>
            <div class="progress-bar mt-3 mb-2">
              <div class="progress-fill ${riskClass === "danger" ? "danger" : riskClass === "warning" ? "warning" : "success"}" style="width:${progress}%"></div>
            </div>
            <div class="flex items-center justify-between text-xs text-soft">
              <span>${progress}%</span>
              <span>완료 ${stats.completed}/${stats.total}</span>
            </div>
            <div class="flex gap-3 mt-3">
              <div class="text-xs">
                <span class="stat-value" style="font-size:0.875rem;color:var(--slate-200)">${stats.total}</span>
                <span class="text-soft"> 전체</span>
              </div>
              <div class="text-xs">
                <span style="font-size:0.875rem;font-weight:700;color:var(--success-400)">${stats.completed}</span>
                <span class="text-soft"> 완료</span>
              </div>
              <div class="text-xs">
                <span style="font-size:0.875rem;font-weight:700;color:var(--primary-400)">${stats.inProgress}</span>
                <span class="text-soft"> 진행</span>
              </div>
              ${
                stats.delayed > 0
                  ? `<div class="text-xs">
                      <span style="font-size:0.875rem;font-weight:700;color:var(--danger-400)">${stats.delayed}</span>
                      <span class="text-soft"> 지연</span>
                    </div>`
                  : ""
              }
            </div>
          </div>`;
        })
        .join("")}
    </div>
  `;
}

// =============================================================================
// 2) Table view
// =============================================================================

function sortArrow(field) {
  if (sortField !== field) return '<span style="opacity:0.3;font-size:10px;">&#9650;&#9660;</span>';
  return sortDir === "asc"
    ? '<span style="font-size:10px;">&#9650;</span>'
    : '<span style="font-size:10px;">&#9660;</span>';
}

function applySorting(list) {
  return [...list].sort((a, b) => {
    let va, vb;
    switch (sortField) {
      case "name": va = (a.name || "").toLowerCase(); vb = (b.name || "").toLowerCase(); break;
      case "status": va = a.status || ""; vb = b.status || ""; break;
      case "pm": va = (a.pm || "").toLowerCase(); vb = (b.pm || "").toLowerCase(); break;
      case "progress": va = a.progress || 0; vb = b.progress || 0; break;
      case "startDate": va = new Date(a.startDate).getTime(); vb = new Date(b.startDate).getTime(); break;
      default: va = new Date(a.startDate).getTime(); vb = new Date(b.startDate).getTime();
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ? 1 : -1;
    return 0;
  });
}

function renderTable(filtered) {
  if (filtered.length === 0) return renderEmpty();
  const sorted = applySorting(filtered);

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="sortable-th" data-sort="name" style="cursor:pointer;user-select:none;">프로젝트명 ${sortArrow("name")}</th>
            <th>제품유형</th>
            <th class="sortable-th" data-sort="status" style="cursor:pointer;user-select:none;">상태 ${sortArrow("status")}</th>
            <th class="sortable-th" data-sort="pm" style="cursor:pointer;user-select:none;">PM ${sortArrow("pm")}</th>
            <th>현재단계</th>
            <th>중요도</th>
            <th class="sortable-th" data-sort="progress" style="cursor:pointer;user-select:none;">진행률 ${sortArrow("progress")}</th>
            <th class="sortable-th" data-sort="startDate" style="cursor:pointer;user-select:none;">기간 ${sortArrow("startDate")}</th>
          </tr>
        </thead>
        <tbody>
          ${sorted
            .map(
              (p) => `
            <tr class="cursor-pointer" data-project-id="${p.id}">
              <td>
                <span class="font-medium" style="color:var(--slate-100)">${escapeHtml(p.name)}</span>
              </td>
              <td>${escapeHtml(p.productType || "-")}</td>
              <td><span class="badge ${getProjectStatusBadge(p.status)}">${getProjectStatusLabel(p.status)}</span></td>
              <td>${escapeHtml(p.pm || "-")}</td>
              <td class="text-xs">${formatStageName(p.currentStage)}</td>
              <td><span class="risk-dot ${p.riskLevel || ""}"></span></td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="progress-bar" style="width:80px">
                    <div class="progress-fill" style="width:${p.progress || 0}%"></div>
                  </div>
                  <span class="text-xs font-mono">${p.progress || 0}%</span>
                </div>
              </td>
              <td class="text-xs whitespace-nowrap">${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// =============================================================================
// 3) Gantt view
// =============================================================================

function renderGantt(filtered) {
  if (filtered.length === 0) return renderEmpty();

  const { minDate, maxDate, totalDays } = getGanttRange(filtered);
  const todayMs = new Date().getTime();
  const todayPct = Math.max(0, Math.min(100, ((todayMs - minDate.getTime()) / (totalDays * 86400000)) * 100));

  // Month markers
  const months = [];
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (cursor.getTime() <= maxDate.getTime()) {
    const leftPct = Math.max(0, ((cursor.getTime() - minDate.getTime()) / (totalDays * 86400000)) * 100);
    months.push({
      label: `${cursor.getFullYear()}.${String(cursor.getMonth() + 1).padStart(2, "0")}`,
      left: leftPct,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return `
    <div class="card p-4" style="overflow-x:auto">
      <!-- Month header -->
      <div style="position:relative;height:24px;margin-bottom:8px;margin-left:200px;min-width:600px">
        ${months
          .map(
            (m) =>
              `<span class="text-xs text-soft" style="position:absolute;left:${m.left}%;white-space:nowrap">${m.label}</span>`
          )
          .join("")}
      </div>

      <!-- Rows -->
      <div style="min-width:800px">
        ${filtered
          .map((p) => {
            const { left, width } = getBarPosition(p, minDate, totalDays);
            const barClass = getRiskClass(p.riskLevel);
            return `
            <div class="gantt-row cursor-pointer" data-project-id="${p.id}">
              <div class="gantt-label" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
              <div class="gantt-track">
                <div class="gantt-bar ${barClass}" style="left:${left}%;width:${width}%" title="${escapeHtml(p.name)}: ${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}"></div>
                <!-- Today marker -->
                <div style="position:absolute;top:0;bottom:0;left:${todayPct}%;width:2px;background:var(--danger-400);opacity:0.6;z-index:1"></div>
              </div>
            </div>`;
          })
          .join("")}
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-4 mt-4 text-xs text-soft" style="margin-left:200px">
        <span class="flex items-center gap-1"><span style="display:inline-block;width:12px;height:4px;border-radius:2px;background:var(--success-500)"></span> 보통</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:12px;height:4px;border-radius:2px;background:var(--warning-500)"></span> 중요</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:12px;height:4px;border-radius:2px;background:var(--danger-500)"></span> 긴급</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:2px;height:12px;background:var(--danger-400);opacity:0.6"></span> 오늘</span>
      </div>
    </div>
  `;
}

// =============================================================================
// 4) Kanban view
// =============================================================================

function renderKanban(filtered) {
  const columns = [
    { key: "active", label: "활성", color: "var(--primary-400)" },
    { key: "completed", label: "완료", color: "var(--success-400)" },
    { key: "on_hold", label: "보류", color: "var(--warning-400)" },
  ];

  return `
    <div class="kanban-board">
      ${columns
        .map((col) => {
          const colProjects = filtered.filter((p) => p.status === col.key);
          return `
          <div class="kanban-column" data-kanban-col="${col.key}" style="flex:1;max-width:none">
            <div class="kanban-column-header">
              <div class="flex items-center gap-2">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${col.color}"></span>
                <span class="kanban-column-title">${col.label}</span>
              </div>
              <span class="kanban-column-count">${colProjects.length}</span>
            </div>
            <div class="kanban-column-body" data-drop-zone="${col.key}">
              ${
                colProjects.length === 0
                  ? `<div class="empty-state" style="padding:2rem"><span class="empty-state-text">프로젝트 없음</span></div>`
                  : colProjects
                      .map((p) => {
                        const stats = getTaskStats(p.id);
                        return `
                        <div class="kanban-card" data-project-id="${p.id}" draggable="true" data-drag-project="${p.id}">
                          <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-semibold" style="color:var(--slate-100)">${escapeHtml(p.name)}</span>
                            <span class="risk-dot ${p.riskLevel || ""}"></span>
                          </div>
                          <div class="text-xs text-soft mb-2">${escapeHtml(p.productType || "")}</div>
                          <div class="text-xs text-soft mb-2">PM: ${escapeHtml(p.pm || "-")}</div>
                          <div class="text-xs text-soft mb-2">단계: ${formatStageName(p.currentStage)}</div>
                          <div class="progress-bar mb-1">
                            <div class="progress-fill" style="width:${p.progress || 0}%"></div>
                          </div>
                          <div class="flex items-center justify-between text-xs text-soft">
                            <span>${p.progress || 0}%</span>
                            <span>${stats.completed}/${stats.total} 완료</span>
                          </div>
                        </div>`;
                      })
                      .join("")
              }
            </div>
          </div>`;
        })
        .join("")}
    </div>
  `;
}

// =============================================================================
// 5) Timeline view
// =============================================================================

function renderTimeline(filtered) {
  if (filtered.length === 0) return renderEmpty();

  // Sort by start date
  const sorted = [...filtered].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return `
    <div class="card p-6">
      <div class="timeline">
        ${sorted
          .map((p) => {
            const stats = getTaskStats(p.id);
            const isCompleted = p.status === "completed";
            const isActive = p.status === "active";
            const dotClass = isCompleted ? "completed" : isActive ? "active" : "";
            return `
            <div class="timeline-item cursor-pointer" data-project-id="${p.id}">
              <div class="timeline-dot ${dotClass}"></div>
              <div class="card-hover p-4" style="margin-bottom:0.5rem">
                <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div class="flex items-center gap-2">
                    <span class="badge ${getProjectStatusBadge(p.status)}">${getProjectStatusLabel(p.status)}</span>
                    <span class="risk-dot ${p.riskLevel || ""}"></span>
                  </div>
                  <span class="text-xs text-soft">${formatDate(p.startDate)} ~ ${formatDate(p.endDate)}</span>
                </div>
                <h3 class="font-semibold mb-1" style="color:var(--slate-100)">${escapeHtml(p.name)}</h3>
                <p class="text-xs text-soft mb-2">${escapeHtml(p.productType || "")} | PM: ${escapeHtml(p.pm || "-")}</p>
                <div class="text-xs text-soft mb-2">현재 단계: <span style="color:var(--primary-300)">${formatStageName(p.currentStage)}</span></div>
                <div class="progress-bar mb-1">
                  <div class="progress-fill" style="width:${p.progress || 0}%"></div>
                </div>
                <div class="flex items-center justify-between text-xs text-soft">
                  <span>${p.progress || 0}%</span>
                  <span>완료 ${stats.completed}/${stats.total}${stats.delayed > 0 ? ` | 지연 ${stats.delayed}` : ""}</span>
                </div>
              </div>
            </div>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

// =============================================================================
// 6) Calendar view
// =============================================================================

function renderCalendar(filtered) {
  const days = getCalendarDays(calendarYear, calendarMonth);
  const monthLabel = `${calendarYear}년 ${calendarMonth + 1}월`;
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  // Collect events for each day
  function getEventsForDay(date) {
    const events = [];

    // Project start/end dates
    for (const p of filtered) {
      const start = new Date(p.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(p.endDate);
      end.setHours(0, 0, 0, 0);

      if (sameDay(date, start)) {
        events.push({
          label: `[시작] ${p.name}`,
          bg: "rgba(6,182,212,0.2)",
          color: "var(--primary-300)",
          projectId: p.id,
        });
      }
      if (sameDay(date, end)) {
        events.push({
          label: `[종료] ${p.name}`,
          bg: "rgba(239,68,68,0.2)",
          color: "var(--danger-300)",
          projectId: p.id,
        });
      }
    }

    // Task due dates
    const projectIds = new Set(filtered.map((p) => p.id));
    for (const t of allTasks) {
      if (!projectIds.has(t.projectId)) continue;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      if (sameDay(date, due)) {
        const statusColor =
          t.status === "completed"
            ? "rgba(34,197,94,0.2)"
            : t.status === "in_progress"
            ? "rgba(6,182,212,0.15)"
            : "rgba(100,116,139,0.15)";
        const textColor =
          t.status === "completed"
            ? "var(--success-400)"
            : t.status === "in_progress"
            ? "var(--primary-300)"
            : "var(--slate-400)";
        events.push({
          label: t.title,
          assignee: t.assignee || "",
          bg: statusColor,
          color: textColor,
          projectId: t.projectId,
        });
      }
    }

    return events;
  }

  return `
    <div class="card p-4">
      <!-- Calendar header -->
      <div class="flex items-center justify-between mb-4">
        <button class="btn-ghost btn-sm" id="cal-prev">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          이전
        </button>
        <h3 class="section-title">${monthLabel}</h3>
        <button class="btn-ghost btn-sm" id="cal-next">
          다음
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      <!-- Calendar grid -->
      <div class="calendar-grid">
        ${dayLabels.map((d) => `<div class="calendar-header-cell">${d}</div>`).join("")}
        ${days
          .map((day) => {
            const events = getEventsForDay(day.date);
            const cellClass = `calendar-cell${day.isCurrentMonth ? "" : " other-month"}${day.isToday ? " today" : ""}`;
            return `
            <div class="${cellClass}">
              <div class="calendar-date">${day.date.getDate()}</div>
              ${events
                .slice(0, 3)
                .map(
                  (ev) =>
                    `<span class="calendar-event" style="background:${ev.bg};color:${ev.color}" data-project-id="${ev.projectId}" title="${escapeHtml(ev.label)}${ev.assignee ? " (" + escapeHtml(ev.assignee) + ")" : ""}">${escapeHtml(ev.label)}${ev.assignee ? `<span style="font-size:0.55rem;opacity:0.7;margin-left:3px">${escapeHtml(ev.assignee)}</span>` : ""}</span>`
                )
                .join("")}
              ${events.length > 3 ? `<span class="text-xs text-soft" style="padding-left:0.375rem">+${events.length - 3}개 더</span>` : ""}
            </div>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

// =============================================================================
// 7) Matrix view (Department x Stage)
// =============================================================================

function renderMatrix(filtered) {
  const projectIds = new Set(filtered.map((p) => p.id));
  const relevantTasks = allTasks.filter((t) => projectIds.has(t.projectId));

  // Build count map: dept -> phase -> { work: { total, completed, inProgress, delayed }, gate: { status } }
  const matrix = {};
  for (const dept of departments) {
    matrix[dept] = {};
    for (const phase of PHASE_GROUPS) {
      matrix[dept][phase.name] = {
        work: { total: 0, completed: 0, inProgress: 0, delayed: 0 },
        gate: { status: "none" }, // none | pending | approved | rejected
      };
    }
  }

  for (const t of relevantTasks) {
    const dept = t.department;
    if (!matrix[dept]) continue;
    // Find which phase this task belongs to
    for (const phase of PHASE_GROUPS) {
      if (t.stage === phase.workStage) {
        matrix[dept][phase.name].work.total++;
        if (t.status === "completed") matrix[dept][phase.name].work.completed++;
        else if (t.status === "in_progress") matrix[dept][phase.name].work.inProgress++;
        const d = daysUntil(t.dueDate);
        if (t.status !== "completed" && d !== null && d < 0) matrix[dept][phase.name].work.delayed++;
        break;
      }
      if (t.stage === phase.gateStage) {
        // Gate tasks — determine status
        const gateData = matrix[dept][phase.name].gate;
        if (t.approvalStatus === "rejected" || t.status === "rejected") {
          gateData.status = "rejected";
        } else if (t.approvalStatus === "approved") {
          if (gateData.status !== "rejected") gateData.status = "approved";
        } else if (t.status === "completed") {
          if (gateData.status === "none") gateData.status = "pending";
        } else if (t.status === "in_progress" || t.status === "pending") {
          // task not yet completed, gate not yet ready
          if (gateData.status === "none") gateData.status = "none";
        }
        break;
      }
    }
  }

  // Get work circle color
  function getWorkColor(work) {
    if (work.total === 0) return "var(--slate-600)";
    if (work.delayed > 0) return "var(--danger-400)";
    if (work.completed === work.total) return "var(--success-400)";
    if (work.inProgress > 0) return "var(--primary-400)";
    return "var(--slate-500)";
  }

  // Get gate circle info
  function getGateInfo(gate) {
    switch (gate.status) {
      case "approved": return { symbol: "✓", color: "var(--success-400)", bg: "rgba(34,197,94,0.15)" };
      case "rejected": return { symbol: "✗", color: "var(--danger-400)", bg: "rgba(239,68,68,0.15)" };
      case "pending":  return { symbol: "⏳", color: "var(--warning-400)", bg: "rgba(245,158,11,0.15)" };
      default:         return { symbol: "—", color: "var(--slate-600)", bg: "var(--surface-3)" };
    }
  }

  return `
    <div class="matrix-table card">
      <table>
        <thead>
          <tr>
            <th style="min-width:100px">부서 / 페이즈</th>
            ${PHASE_GROUPS.map(phase => `<th style="min-width:100px">${phase.name}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${departments.map(dept => `
            <tr>
              <td>${escapeHtml(dept)}</td>
              ${PHASE_GROUPS.map(phase => {
                const cell = matrix[dept][phase.name];
                const work = cell.work;
                const gate = cell.gate;
                const gateInfo = getGateInfo(gate);
                const workColor = getWorkColor(work);
                const hasWork = work.total > 0;
                const hasBg = work.delayed > 0 ? "background:rgba(239,68,68,0.06)" : work.inProgress > 0 ? "background:rgba(6,182,212,0.06)" : (work.completed === work.total && work.total > 0) ? "background:rgba(34,197,94,0.06)" : "";

                return `<td class="matrix-cell" style="${hasBg};padding:0.5rem 0.375rem" title="${dept} | ${phase.name}: 작업 ${work.completed}/${work.total}, 승인 ${gate.status}">
                  <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem">
                    <!-- Work circle -->
                    <div style="display:flex;flex-direction:column;align-items:center;gap:0.125rem">
                      <span style="display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:50%;background:${hasWork ? "rgba(0,0,0,0.15)" : "var(--surface-3)"};border:2px solid ${workColor};font-size:0.6rem;color:${workColor};font-weight:700;font-family:'JetBrains Mono',monospace">${hasWork ? `${work.completed}/${work.total}` : "-"}</span>
                      <span style="font-size:0.5rem;color:var(--slate-600)">작업</span>
                    </div>
                    <!-- Gate circle -->
                    <div style="display:flex;flex-direction:column;align-items:center;gap:0.125rem">
                      <span style="display:inline-flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:50%;background:${gateInfo.bg};font-size:0.7rem;color:${gateInfo.color};font-weight:700">${gateInfo.symbol}</span>
                      <span style="font-size:0.5rem;color:var(--slate-600)">승인</span>
                    </div>
                  </div>
                </td>`;
              }).join("")}
            </tr>`).join("")}
        </tbody>
      </table>

      <!-- Legend -->
      <div class="flex items-center gap-4 p-4 text-xs text-soft flex-wrap" style="border-top:1px solid var(--surface-3)">
        <span style="font-weight:600;color:var(--slate-300)">작업:</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid var(--success-400)"></span> 완료</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid var(--primary-400)"></span> 진행 중</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid var(--danger-400)"></span> 지연</span>
        <span style="margin-left:0.5rem;font-weight:600;color:var(--slate-300)">승인:</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:rgba(34,197,94,0.15)"></span> ✓승인</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:rgba(245,158,11,0.15)"></span> ⏳대기</span>
        <span class="flex items-center gap-1"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:rgba(239,68,68,0.15)"></span> ✗반려</span>
      </div>
    </div>
  `;
}

// =============================================================================
// Empty state
// =============================================================================

function renderEmpty() {
  return `
    <div class="empty-state" style="padding:4rem">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
      </svg>
      <span class="empty-state-text">조건에 맞는 프로젝트가 없습니다</span>
    </div>
  `;
}

// =============================================================================
// Bind event handlers
// =============================================================================

function bindControls() {
  // Project type tab switcher (신규개발 / 설계변경)
  document.querySelectorAll("[data-type-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      projectTypeTab = btn.dataset.typeTab;
      render();
    });
  });

  // Search
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      render();
      // Restore focus and cursor position
      const el = document.getElementById("search-input");
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  // Status filter
  const statusSelect = document.getElementById("status-filter");
  if (statusSelect) {
    statusSelect.addEventListener("change", (e) => {
      statusFilter = e.target.value;
      render();
    });
  }

  // View mode switcher
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (projectTypeTab === "설계변경") {
        changeViewMode = btn.dataset.view;
      } else {
        viewMode = btn.dataset.view;
      }
      render();
    });
  });

  // Table sort
  document.querySelectorAll(".sortable-th[data-sort]").forEach((th) => {
    th.addEventListener("click", (e) => {
      e.stopPropagation();
      const field = th.dataset.sort;
      if (sortField === field) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortField = field;
        sortDir = "asc";
      }
      render();
    });
  });

  // Project click -> navigate
  document.querySelectorAll("[data-project-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      // Skip if clicked on a calendar event with its own handler
      if (e.target.closest(".calendar-event")) return;
      const id = el.dataset.projectId;
      if (id) window.location.href = `project.html?id=${id}`;
    });
  });

  // Calendar navigation
  const calPrev = document.getElementById("cal-prev");
  const calNext = document.getElementById("cal-next");
  if (calPrev) {
    calPrev.addEventListener("click", () => {
      calendarMonth--;
      if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
      }
      render();
    });
  }
  if (calNext) {
    calNext.addEventListener("click", () => {
      calendarMonth++;
      if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
      }
      render();
    });
  }

  // Calendar event clicks
  document.querySelectorAll(".calendar-event[data-project-id]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = el.dataset.projectId;
      if (id) window.location.href = `project.html?id=${id}`;
    });
  });

  // --- Kanban Drag & Drop ---
  document.querySelectorAll("[data-drag-project]").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", card.dataset.dragProject);
      card.style.opacity = "0.5";
    });
    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
    });
  });

  document.querySelectorAll("[data-drop-zone]").forEach((zone) => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.style.background = "rgba(6, 182, 212, 0.05)";
      zone.style.outline = "2px dashed var(--primary-400)";
      zone.style.outlineOffset = "-2px";
    });
    zone.addEventListener("dragleave", () => {
      zone.style.background = "";
      zone.style.outline = "";
    });
    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.style.background = "";
      zone.style.outline = "";
      const projectId = e.dataTransfer.getData("text/plain");
      const newStatus = zone.dataset.dropZone;
      if (!projectId || !newStatus) return;
      const proj = projects.find((p) => p.id === projectId);
      if (!proj || proj.status === newStatus) return;
      if (!confirm(`"${proj.name}" 상태를 "${getProjectStatusLabel(newStatus)}"(으)로 변경하시겠습니까?`)) return;
      try {
        await updateProject(projectId, { status: newStatus });
      } catch (err) {
        alert("상태 변경 실패: " + err.message);
      }
    });
  });

  // --- CSV Export ---
  const exportBtn = document.getElementById("export-projects-csv");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const filtered = getFilteredProjects();
      const headers = ["이름", "유형", "PM", "상태", "진행률", "시작일", "종료일", "현재 단계"];
      const data = filtered.map((p) => [
        p.name, p.projectType || "", p.pm || "", getProjectStatusLabel(p.status),
        (p.progress || 0) + "%", formatDate(p.startDate), formatDate(p.endDate),
        formatStageName(p.currentStage),
      ]);
      exportToCSV(data, headers, "프로젝트_목록.csv");
    });
  }

  // ── Create Project Modal ──
  const createBtn = document.getElementById("btn-create-project");
  const modal = document.getElementById("create-modal");
  const closeModal = () => { if (modal) modal.style.display = "none"; };
  const openModal = () => { if (modal) modal.style.display = ""; };

  if (createBtn) createBtn.addEventListener("click", openModal);
  const closeBtn = document.getElementById("create-modal-close");
  const cancelBtn = document.getElementById("create-modal-cancel");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  const submitBtn = document.getElementById("btn-submit-project");
  if (submitBtn) {
    submitBtn.addEventListener("click", async () => {
      const name = document.getElementById("cp-name")?.value.trim();
      const productType = document.getElementById("cp-product")?.value.trim();
      const startStr = document.getElementById("cp-start")?.value;
      const endStr = document.getElementById("cp-end")?.value;
      const pm = document.getElementById("cp-pm")?.value.trim() || "";
      const scaleEl = document.getElementById("cp-scale");
      const changeScale = scaleEl ? scaleEl.value : null;
      const isChange = projectTypeTab === "설계변경";

      // Validation
      if (!name || !productType || !startStr || !endStr) {
        alert("필수 항목을 모두 입력하세요.");
        return;
      }
      if (isChange && !changeScale) {
        alert("변경 규모를 선택하세요.");
        return;
      }
      if (new Date(endStr) <= new Date(startStr)) {
        alert("종료일은 시작일보다 이후여야 합니다.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "등록 중...";

      try {
        const projData = {
          name,
          productType,
          projectType: isChange ? "설계변경" : "신규개발",
          status: "active",
          progress: 0,
          startDate: new Date(startStr),
          endDate: new Date(endStr),
          pm,
          riskLevel: "green",
          currentStage: "발의검토",
        };
        if (isChange) projData.changeScale = changeScale;

        const newId = await createProject(projData);
        closeModal();

        // Navigate to the new project detail page
        window.location.href = `project.html?id=${newId}`;
      } catch (err) {
        console.error("프로젝트 등록 오류:", err);
        alert("프로젝트 등록 중 오류가 발생했습니다.");
        submitBtn.disabled = false;
        submitBtn.textContent = "등록";
      }
    });
  }
}
