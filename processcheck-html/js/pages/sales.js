// =============================================================================
// Sales Dashboard — 영업 출시 준비 대시보드
// 전체 프로젝트의 영업 관련 출시 체크리스트를 한 눈에 확인
// 거래처 확인 추적 (checkedBy/checkedAt) 포함
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

// -- State --
let allItems = [];
let projects = [];
let filterProject = "all";
let filterCategory = "all";
let filterStatus = "all";
let searchQuery = "";
let collapsedProjects = new Set();
let showAllCategories = false; // false = 영업 핵심 카테고리만, true = 전체

// 영업 핵심 카테고리
const SALES_CORE_CATEGORIES = ["pricing", "sales_training", "dealer_notify"];

// 영업 관련 부서 키워드 (다른 카테고리에서 영업 관련 항목 필터)
const SALES_DEPT_KEYWORDS = ["영업"];

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

// -- Filtering --

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

function getCheckedDisplay(item) {
  if (item.checkedBy) {
    const dateStr = item.checkedAt ? timeAgo(item.checkedAt) : "";
    return `<span class="badge badge-success" style="font-size:10px;" title="${item.checkedNote || ""}">✓ ${escapeHtml(item.checkedBy)}</span>${dateStr ? `<br><span class="text-xs text-soft">${dateStr}</span>` : ""}`;
  }
  // 거래처별 항목만 확인 버튼 표시
  if (item.customerId) {
    return `<button class="btn btn-sm btn-secondary confirm-btn" data-id="${item.id}" title="거래처 확인 처리" style="font-size:11px;padding:2px 8px;">확인</button>`;
  }
  return `<span class="text-xs text-soft">—</span>`;
}

// -- Render --

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

  // 프로젝트별 그룹
  const grouped = {};
  for (const item of filtered) {
    if (!grouped[item.projectId]) grouped[item.projectId] = [];
    grouped[item.projectId].push(item);
  }

  // 프로젝트 선택 옵션
  const projectIds = [...new Set(allItems.map((i) => i.projectId))];

  // 카테고리 선택 옵션
  const categories = showAllCategories
    ? Object.keys(LAUNCH_CATEGORY_LABELS)
    : [...SALES_CORE_CATEGORIES];

  app.innerHTML = `
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

    <!-- 통계 카드 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-card-label">전체 항목</div></div>
      <div class="stat-card"><div class="stat-value text-success">${stats.completed}</div><div class="stat-card-label">완료</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${stats.unchecked}</div><div class="stat-card-label">미확인 (거래처)</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--danger)">${stats.overdue}</div><div class="stat-card-label">마감 초과</div></div>
    </div>

    <!-- 필터 바 -->
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

    <!-- 프로젝트별 그룹 -->
    ${Object.keys(grouped).length === 0
      ? `<div class="card" style="padding:2rem;text-align:center;"><p class="text-soft">표시할 항목이 없습니다</p></div>`
      : Object.entries(grouped).map(([projectId, items]) => {
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
              ${isCollapsed ? "" : `
                <div style="overflow-x:auto;">
                  <table>
                    <thead>
                      <tr>
                        <th style="width:70px;">코드</th>
                        <th>항목</th>
                        <th>담당</th>
                        <th>상태</th>
                        <th>마감일</th>
                        <th>고객</th>
                        <th>확인</th>
                        <th style="width:60px;">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${items.map((item) => `
                        <tr${item.status !== "completed" && item.dueDate && daysUntil(item.dueDate) !== null && daysUntil(item.dueDate) < 0 ? ' style="background:rgba(239,68,68,0.06);"' : ""}>
                          <td><code class="text-sm">${escapeHtml(item.code || "")}</code></td>
                          <td>
                            ${escapeHtml(item.title)}
                            ${item.isRequired ? '<span class="badge badge-danger" style="margin-left:4px;font-size:10px;">필수</span>' : ""}
                          </td>
                          <td class="text-sm">${escapeHtml(item.assignee || item.department || "")}</td>
                          <td>${getStatusBadge(item.status)}</td>
                          <td class="text-sm">${getDueDateDisplay(item)}</td>
                          <td class="text-sm">${item.customerName ? `<span class="badge badge-neutral">${escapeHtml(item.customerName)}</span>` : "—"}</td>
                          <td class="text-sm">${getCheckedDisplay(item)}</td>
                          <td>
                            ${item.status === "pending" ? `<button class="btn btn-sm btn-secondary start-btn" data-id="${item.id}" title="시작">&#9654;</button>` : ""}
                            ${item.status === "in_progress" ? `<button class="btn btn-sm btn-primary complete-btn" data-id="${item.id}" title="완료">&#10003;</button>` : ""}
                          </td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              `}
            </div>
          `;
        }).join("")
    }

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
  `;

  bindEvents();

  // Restore focus to search input after render (prevents losing cursor on keystrokes)
  if (searchQuery) {
    const input = app.querySelector("#search-input");
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }
}

let pendingConfirmId = null;

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

  // Project group toggle
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
