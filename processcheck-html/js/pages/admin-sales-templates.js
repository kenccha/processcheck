// =============================================================================
// Sales Template Admin — Pipeline / Categories / Items management
// =============================================================================

import { guardPage } from "../auth.js";
import { renderNav, initTheme } from "../components.js";
initTheme();
import { showToast } from "../ui/toast.js";
import { confirmModal } from "../ui/confirm-modal.js";
import { renderSkeletonStats, renderSkeletonCards } from "../ui/skeleton.js";
import { escapeHtml } from "../utils.js";
import {
  subscribeLaunchPipelineStages,
  subscribeLaunchCategories,
  subscribeLaunchTemplateItems,
  addLaunchPipelineStage,
  updateLaunchPipelineStage,
  deleteLaunchPipelineStage,
  addLaunchCategory,
  updateLaunchCategory,
  deleteLaunchCategory,
  addLaunchTemplateItem,
  updateLaunchTemplateItem,
  deleteLaunchTemplateItem,
} from "../sales-service.js";

// --- Auth Guard ---------------------------------------------------------------

const user = guardPage();
if (!user || (user.role !== "observer" && user.role !== "manager" && user.role !== "admin")) {
  window.location.href = "processcheck.html";
  throw new Error("Insufficient permissions");
}

// --- DOM refs -----------------------------------------------------------------

const navRoot = document.getElementById("nav-root");
const app = document.getElementById("app");

// --- State --------------------------------------------------------------------

let stages = [];
let categories = [];
let items = [];
let activeTab = "pipeline"; // "pipeline" | "categories" | "items"
let searchQuery = "";
let filterCategory = "";
let filterDepartment = "";
let editingItem = null;   // item object for modal (null = add new)
let showModal = false;
let loading = true;

// Inline editing state for pipeline/category
let editingStageId = null;
let editingCategoryId = null;

// --- Render nav ---------------------------------------------------------------

const unsubNav = renderNav(navRoot);

// --- Subscriptions ------------------------------------------------------------

const unsubStages = subscribeLaunchPipelineStages((list) => {
  stages = list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  loading = false;
  render();
});

const unsubCategories = subscribeLaunchCategories((list) => {
  categories = list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  render();
});

const unsubItems = subscribeLaunchTemplateItems((list) => {
  items = list;
  render();
});

// --- Cleanup ------------------------------------------------------------------

window.addEventListener("beforeunload", () => {
  if (unsubNav) unsubNav();
  if (unsubStages) unsubStages();
  if (unsubCategories) unsubCategories();
  if (unsubItems) unsubItems();
});

// =============================================================================
// Helpers
// =============================================================================

function getCategoriesForStage(stageKey) {
  return categories.filter((c) => c.stageKey === stageKey);
}

function getItemsForCategory(categoryKey) {
  return items.filter((i) => i.categoryKey === categoryKey);
}

function getStageLabel(stageKey) {
  const s = stages.find((st) => st.key === stageKey || st.id === stageKey);
  return s ? s.label : stageKey || "-";
}

function getCategoryLabel(categoryKey) {
  const c = categories.find((ct) => ct.key === categoryKey || ct.id === categoryKey);
  return c ? c.label : categoryKey || "-";
}

function getAllDepartments() {
  const depts = new Set();
  items.forEach((i) => {
    if (i.department) {
      i.department.split("+").forEach((d) => depts.add(d.trim()));
    }
  });
  return [...depts].sort();
}

function getFilteredItems() {
  let filtered = [...items];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        (i.code || "").toLowerCase().includes(q) ||
        (i.title || "").toLowerCase().includes(q) ||
        (i.department || "").toLowerCase().includes(q)
    );
  }
  if (filterCategory) {
    filtered = filtered.filter((i) => i.categoryKey === filterCategory);
  }
  if (filterDepartment) {
    filtered = filtered.filter((i) => {
      const depts = (i.department || "").split("+").map((d) => d.trim());
      return depts.includes(filterDepartment);
    });
  }
  return filtered;
}

const isMobile = () => window.innerWidth < 768;

// =============================================================================
// Main render
// =============================================================================

function render() {
  if (loading) {
    app.innerHTML = `
      <div class="container animate-fade-in">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100);">출시 준비 템플릿 관리</h1>
            <p class="text-sm text-dim" style="margin-top: 0.25rem;">로딩 중...</p>
          </div>
        </div>
        ${renderSkeletonStats(3)}
        <div style="margin-top:1.5rem">${renderSkeletonCards(4)}</div>
      </div>
    `;
    return;
  }

  const totalStages = stages.length;
  const totalCategories = categories.length;
  const totalItems = items.length;
  const requiredItems = items.filter((i) => i.isRequired).length;

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100);">출시 준비 템플릿 관리</h1>
          <p class="text-sm text-dim" style="margin-top: 0.25rem;">파이프라인 ${totalStages}단계, 카테고리 ${totalCategories}개, 항목 ${totalItems}개</p>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card" data-stat-tab="pipeline" style="cursor:pointer">
          <div class="stat-card-label">파이프라인 단계</div>
          <div class="stat-card-row"><span class="stat-value">${totalStages}</span></div>
        </div>
        <div class="stat-card" data-stat-tab="categories" style="cursor:pointer">
          <div class="stat-card-label">카테고리</div>
          <div class="stat-card-row"><span class="stat-value">${totalCategories}</span></div>
        </div>
        <div class="stat-card" data-stat-tab="items" style="cursor:pointer">
          <div class="stat-card-label">전체 항목</div>
          <div class="stat-card-row"><span class="stat-value">${totalItems}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">필수 항목</div>
          <div class="stat-card-row"><span class="stat-value">${requiredItems}</span></div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="tab-bar mb-6">
        <button class="tab-btn ${activeTab === "pipeline" ? "active" : ""}" data-tab="pipeline">파이프라인</button>
        <button class="tab-btn ${activeTab === "categories" ? "active" : ""}" data-tab="categories">카테고리</button>
        <button class="tab-btn ${activeTab === "items" ? "active" : ""}" data-tab="items">항목</button>
      </div>

      <!-- Tab Content -->
      <div class="tab-transition-enter">
        ${activeTab === "pipeline" ? renderPipelineTab() : ""}
        ${activeTab === "categories" ? renderCategoriesTab() : ""}
        ${activeTab === "items" ? renderItemsTab() : ""}
      </div>
    </div>

    ${showModal ? renderModal() : ""}
  `;

  bindEvents();
}

// =============================================================================
// Pipeline Tab
// =============================================================================

function renderPipelineTab() {
  if (stages.length === 0) {
    return `
      <div class="card">
        <div class="empty-state" style="padding: 4rem 1rem">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:3rem;height:3rem">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
          </svg>
          <span class="empty-state-text">파이프라인 단계가 없습니다</span>
          <span class="empty-state-subtext">출시 준비 프로세스의 단계를 추가하세요</span>
          <button class="btn-primary" style="margin-top:1rem" id="empty-add-stage">+ 단계 추가</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="card">
      <div style="padding:1rem 1.5rem;border-bottom:1px solid var(--surface-3);display:flex;align-items:center;justify-content:space-between">
        <span class="text-sm font-semibold" style="color:var(--slate-200)">파이프라인 단계 (${stages.length})</span>
      </div>
      <div style="padding:0.5rem 0">
        ${stages
          .map((stage, idx) => {
            const catCount = getCategoriesForStage(stage.key || stage.id).length;
            const isEditing = editingStageId === stage.id;

            if (isEditing) {
              return `
                <div class="flex items-center gap-3" style="padding:0.75rem 1.5rem;border-bottom:1px solid var(--surface-3)">
                  <span class="text-sm font-semibold" style="color:var(--slate-400);min-width:1.5rem">${idx + 1}</span>
                  <input type="text" class="input-field" id="edit-stage-icon" value="${escapeHtml(stage.icon || "")}" placeholder="아이콘" style="width:3rem;padding:0.25rem 0.5rem;font-size:0.875rem;text-align:center">
                  <input type="text" class="input-field" id="edit-stage-label" value="${escapeHtml(stage.label || "")}" placeholder="단계명" style="flex:1;padding:0.25rem 0.5rem;font-size:0.875rem">
                  <input type="text" class="input-field" id="edit-stage-key" value="${escapeHtml(stage.key || "")}" placeholder="키" style="width:6rem;padding:0.25rem 0.5rem;font-size:0.875rem">
                  <button class="btn-primary btn-sm" data-save-stage="${stage.id}" style="font-size:0.75rem;padding:0.25rem 0.75rem">저장</button>
                  <button class="btn-ghost btn-sm" data-cancel-stage style="font-size:0.75rem;padding:0.25rem 0.5rem">취소</button>
                </div>
              `;
            }

            return `
              <div class="flex items-center gap-3" style="padding:0.75rem 1.5rem;border-bottom:1px solid var(--surface-3);transition:background 0.15s" onmouseenter="this.style.background='var(--surface-1)'" onmouseleave="this.style.background=''">
                <span class="text-sm font-semibold" style="color:var(--slate-400);min-width:1.5rem">${idx + 1}</span>
                <span style="font-size:1.25rem;min-width:2rem;text-align:center">${escapeHtml(stage.icon || "📋")}</span>
                <div style="flex:1;min-width:0">
                  <span class="text-sm font-semibold" style="color:var(--slate-200)">${escapeHtml(stage.label)}</span>
                  <span class="text-xs" style="color:var(--slate-500);margin-left:0.5rem">${escapeHtml(stage.key || "")}</span>
                </div>
                <span class="badge badge-info" style="font-size:0.7rem">${catCount}개 카테고리</span>
                <div class="flex items-center gap-1">
                  <button class="btn-ghost btn-sm" data-move-stage-up="${stage.id}" title="위로" style="padding:0.25rem;font-size:0.875rem;min-width:auto" ${idx === 0 ? "disabled" : ""}>&#9650;</button>
                  <button class="btn-ghost btn-sm" data-move-stage-down="${stage.id}" title="아래로" style="padding:0.25rem;font-size:0.875rem;min-width:auto" ${idx === stages.length - 1 ? "disabled" : ""}>&#9660;</button>
                  <button class="btn-ghost btn-sm" data-edit-stage="${stage.id}" title="수정" style="padding:0.25rem 0.5rem;font-size:0.75rem">수정</button>
                  <button class="btn-ghost btn-sm" data-delete-stage="${stage.id}" title="삭제" style="padding:0.25rem 0.5rem;font-size:0.75rem;color:var(--danger-400)" ${catCount > 0 ? "data-has-refs" : ""}>삭제</button>
                </div>
                ${catCount > 0 ? `<div data-ref-warning-stage="${stage.id}" style="display:none;color:var(--danger-400);font-size:0.7rem;width:100%;padding-left:3.5rem;margin-top:0.25rem">이 단계에 ${catCount}개의 카테고리가 있어 삭제할 수 없습니다. 카테고리를 먼저 삭제하세요.</div>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>
      <div style="padding:1rem 1.5rem;border-top:1px solid var(--surface-3)">
        <button class="btn-primary" id="add-stage-btn" style="font-size:0.875rem;padding:0.5rem 1rem">+ 단계 추가</button>
      </div>
    </div>
  `;
}

// =============================================================================
// Categories Tab
// =============================================================================

function renderCategoriesTab() {
  if (stages.length === 0) {
    return `
      <div class="card">
        <div class="empty-state" style="padding: 4rem 1rem">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:3rem;height:3rem">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
          </svg>
          <span class="empty-state-text">파이프라인 단계를 먼저 추가하세요</span>
          <span class="empty-state-subtext">카테고리는 파이프라인 단계에 속합니다</span>
          <button class="btn-primary" style="margin-top:1rem" data-tab-switch="pipeline">파이프라인 탭으로 이동</button>
        </div>
      </div>
    `;
  }

  return stages
    .map((stage) => {
      const cats = getCategoriesForStage(stage.key || stage.id);
      return `
        <div class="card mb-4">
          <div style="padding:1rem 1.5rem;border-bottom:1px solid var(--surface-3);display:flex;align-items:center;gap:0.5rem;cursor:pointer" data-toggle-stage-section="${stage.id}">
            <span style="font-size:1rem">${escapeHtml(stage.icon || "📋")}</span>
            <span class="text-sm font-semibold" style="color:var(--slate-200);flex:1">${escapeHtml(stage.label)}</span>
            <span class="badge badge-info" style="font-size:0.7rem">${cats.length}개</span>
            <span class="text-xs" style="color:var(--slate-400)" data-chevron="${stage.id}">&#9660;</span>
          </div>
          <div data-stage-section="${stage.id}">
            ${cats.length === 0
              ? `<div style="padding:1.5rem;text-align:center;color:var(--slate-500);font-size:0.8rem">카테고리가 없습니다</div>`
              : cats
                  .map((cat, idx) => {
                    const itemCount = getItemsForCategory(cat.key || cat.id).length;
                    const isEditing = editingCategoryId === cat.id;

                    if (isEditing) {
                      return `
                        <div class="flex items-center gap-3 flex-wrap" style="padding:0.75rem 1.5rem;border-bottom:1px solid var(--surface-3)">
                          <input type="text" class="input-field" id="edit-cat-key" value="${escapeHtml(cat.key || "")}" placeholder="키" style="width:8rem;padding:0.25rem 0.5rem;font-size:0.875rem">
                          <input type="text" class="input-field" id="edit-cat-label" value="${escapeHtml(cat.label || "")}" placeholder="카테고리명" style="flex:1;min-width:120px;padding:0.25rem 0.5rem;font-size:0.875rem">
                          <button class="btn-primary btn-sm" data-save-category="${cat.id}" style="font-size:0.75rem;padding:0.25rem 0.75rem">저장</button>
                          <button class="btn-ghost btn-sm" data-cancel-category style="font-size:0.75rem;padding:0.25rem 0.5rem">취소</button>
                        </div>
                      `;
                    }

                    return `
                      <div class="flex items-center gap-3" style="padding:0.75rem 1.5rem;border-bottom:1px solid var(--surface-3);transition:background 0.15s" onmouseenter="this.style.background='var(--surface-1)'" onmouseleave="this.style.background=''">
                        <div style="flex:1;min-width:0">
                          <span class="badge" style="font-size:0.7rem;margin-right:0.5rem;background:var(--surface-3);color:var(--slate-300)">${escapeHtml(cat.key || "")}</span>
                          <span class="text-sm" style="color:var(--slate-200)">${escapeHtml(cat.label)}</span>
                        </div>
                        <span class="badge badge-info" style="font-size:0.65rem">${itemCount}개 항목</span>
                        <div class="flex items-center gap-1">
                          <button class="btn-ghost btn-sm" data-move-cat-up="${cat.id}" data-stage-key="${stage.key || stage.id}" title="위로" style="padding:0.25rem;font-size:0.875rem;min-width:auto" ${idx === 0 ? "disabled" : ""}>&#9650;</button>
                          <button class="btn-ghost btn-sm" data-move-cat-down="${cat.id}" data-stage-key="${stage.key || stage.id}" title="아래로" style="padding:0.25rem;font-size:0.875rem;min-width:auto" ${idx === cats.length - 1 ? "disabled" : ""}>&#9660;</button>
                          <button class="btn-ghost btn-sm" data-edit-category="${cat.id}" style="font-size:0.75rem;padding:0.25rem 0.5rem">수정</button>
                          <button class="btn-ghost btn-sm" data-delete-category="${cat.id}" style="font-size:0.75rem;padding:0.25rem 0.5rem;color:var(--danger-400)" ${itemCount > 0 ? "data-has-refs" : ""}>삭제</button>
                        </div>
                        ${itemCount > 0 ? `<div data-ref-warning-cat="${cat.id}" style="display:none;color:var(--danger-400);font-size:0.7rem;width:100%;padding-left:1rem;margin-top:0.25rem">이 카테고리에 ${itemCount}개의 항목이 있어 삭제할 수 없습니다. 항목을 먼저 삭제하세요.</div>` : ""}
                      </div>
                    `;
                  })
                  .join("")}
            <div style="padding:0.75rem 1.5rem">
              <button class="btn-ghost btn-sm" data-add-category="${stage.key || stage.id}" style="font-size:0.8rem;color:var(--primary-400)">+ 카테고리 추가</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

// =============================================================================
// Items Tab
// =============================================================================

function renderItemsTab() {
  const filtered = getFilteredItems();
  const allDepartments = getAllDepartments();

  const filterBar = `
    <div class="card p-4 mb-4">
      <div class="flex flex-wrap gap-3">
        <select class="input-field" id="filter-category" style="width:auto;min-width:140px">
          <option value="">전체 카테고리</option>
          ${categories.map((c) => `<option value="${escapeHtml(c.key || c.id)}" ${filterCategory === (c.key || c.id) ? "selected" : ""}>${escapeHtml(c.label)}</option>`).join("")}
        </select>
        <select class="input-field" id="filter-department" style="width:auto;min-width:130px">
          <option value="">전체 부서</option>
          ${allDepartments.map((d) => `<option value="${escapeHtml(d)}" ${filterDepartment === d ? "selected" : ""}>${escapeHtml(d)}</option>`).join("")}
        </select>
        <div style="flex:1;min-width:200px;position:relative">
          <input type="text" class="input-field" id="item-search" placeholder="코드, 제목, 부서 검색..." value="${escapeHtml(searchQuery)}" style="width:100%;padding-left:2rem">
          <svg style="position:absolute;left:0.5rem;top:50%;transform:translateY(-50%);width:1rem;height:1rem;color:var(--slate-500);pointer-events:none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        <button class="btn-primary" id="add-item-btn" style="font-size:0.875rem;padding:0.5rem 1rem;white-space:nowrap">+ 항목 추가</button>
      </div>
    </div>
  `;

  if (filtered.length === 0 && items.length === 0) {
    return `
      ${filterBar}
      <div class="card">
        <div class="empty-state" style="padding: 4rem 1rem">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:3rem;height:3rem">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
          </svg>
          <span class="empty-state-text">출시 준비 항목이 없습니다</span>
          <span class="empty-state-subtext">템플릿 항목을 추가하여 출시 준비 체크리스트를 구성하세요</span>
          <button class="btn-primary" style="margin-top:1rem" id="empty-add-item">+ 항목 추가</button>
        </div>
      </div>
    `;
  }

  if (filtered.length === 0) {
    return `
      ${filterBar}
      <div class="card">
        <div class="empty-state" style="padding: 3rem 1rem">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:2.5rem;height:2.5rem">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <span class="empty-state-text">검색 결과가 없습니다</span>
        </div>
      </div>
    `;
  }

  // Mobile: card layout; Desktop: table
  if (isMobile()) {
    return `
      ${filterBar}
      <div class="flex" style="flex-direction:column;gap:0.75rem">
        ${filtered
          .map(
            (item) => `
          <div class="card" style="padding:1rem">
            <div class="flex items-center justify-between mb-2">
              <span class="badge" style="font-size:0.7rem;background:var(--surface-3);color:var(--slate-300)">${escapeHtml(item.code || "-")}</span>
              <div class="flex items-center gap-1">
                ${item.isRequired ? '<span class="badge badge-warning" style="font-size:0.6rem">필수</span>' : ""}
                ${item.perCustomer ? '<span class="badge badge-info" style="font-size:0.6rem">거래처별</span>' : ""}
              </div>
            </div>
            <div class="text-sm font-semibold mb-1" style="color:var(--slate-200)">${escapeHtml(item.title || "-")}</div>
            <div class="flex flex-wrap gap-2 mb-2" style="font-size:0.75rem;color:var(--slate-400)">
              <span>${escapeHtml(getCategoryLabel(item.categoryKey))}</span>
              <span>|</span>
              <span>${escapeHtml(item.department || "-")}</span>
              <span>|</span>
              <span>D${item.dDayOffset != null ? (item.dDayOffset >= 0 ? "+" : "") + item.dDayOffset : "-"}일</span>
              ${item.durationDays ? `<span>| ${item.durationDays}일 소요</span>` : ""}
            </div>
            <div class="flex items-center gap-2" style="justify-content:flex-end">
              <button class="btn-ghost btn-sm" data-edit-item="${item.id}" style="font-size:0.75rem">수정</button>
              <button class="btn-ghost btn-sm" data-delete-item="${item.id}" style="font-size:0.75rem;color:var(--danger-400)">삭제</button>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  return `
    ${filterBar}
    <div class="card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:5rem">코드</th>
              <th>제목</th>
              <th>카테고리</th>
              <th>부서</th>
              <th style="width:5rem;text-align:center">D-Day</th>
              <th style="width:4rem;text-align:center">소요</th>
              <th style="width:3.5rem;text-align:center">필수</th>
              <th style="width:4.5rem;text-align:center">거래처별</th>
              <th style="width:5rem">작업</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(
                (item) => `
              <tr>
                <td><span class="badge" style="font-size:0.7rem;background:var(--surface-3);color:var(--slate-300)">${escapeHtml(item.code || "-")}</span></td>
                <td class="text-sm" style="color:var(--slate-200)">${escapeHtml(item.title || "-")}</td>
                <td class="text-xs" style="color:var(--slate-400)">${escapeHtml(getCategoryLabel(item.categoryKey))}</td>
                <td class="text-xs" style="color:var(--slate-400)">${escapeHtml(item.department || "-")}</td>
                <td class="text-xs" style="text-align:center;color:var(--slate-300)">${item.dDayOffset != null ? (item.dDayOffset >= 0 ? "+" : "") + item.dDayOffset : "-"}</td>
                <td class="text-xs" style="text-align:center;color:var(--slate-400)">${item.durationDays || "-"}</td>
                <td style="text-align:center">${item.isRequired ? '<span class="badge badge-warning" style="font-size:0.6rem">필수</span>' : '<span class="text-xs" style="color:var(--slate-500)">-</span>'}</td>
                <td style="text-align:center">${item.perCustomer ? '<span class="badge badge-info" style="font-size:0.6rem">거래처별</span>' : '<span class="text-xs" style="color:var(--slate-500)">-</span>'}</td>
                <td>
                  <div class="flex items-center gap-1">
                    <button class="btn-ghost btn-sm" data-edit-item="${item.id}" style="font-size:0.7rem;padding:0.2rem 0.4rem">수정</button>
                    <button class="btn-ghost btn-sm" data-delete-item="${item.id}" style="font-size:0.7rem;padding:0.2rem 0.4rem;color:var(--danger-400)">삭제</button>
                  </div>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// =============================================================================
// Modal (for items)
// =============================================================================

function renderModal() {
  const isEdit = editingItem != null;
  const title = isEdit ? "출시 준비 항목 수정" : "출시 준비 항목 추가";
  const item = editingItem || {};

  return `
    <div class="modal-backdrop" id="item-modal-backdrop" style="display:flex;align-items:center;justify-content:center">
      <div class="modal" style="max-width:32rem;width:90%;max-height:90vh;overflow-y:auto;${isMobile() ? "width:100%;max-width:100%;height:100%;max-height:100%;border-radius:0;" : ""}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="modal-close-btn" aria-label="닫기">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div style="display:flex;flex-direction:column;gap:1rem">
            <div>
              <label class="text-xs text-soft" style="display:block;margin-bottom:0.25rem">코드</label>
              <input type="text" class="input-field" id="modal-code" value="${escapeHtml(item.code || "")}" placeholder="P-XX" style="width:100%">
            </div>
            <div>
              <label class="text-xs text-soft" style="display:block;margin-bottom:0.25rem">제목</label>
              <input type="text" class="input-field" id="modal-title" value="${escapeHtml(item.title || "")}" placeholder="항목 제목" style="width:100%">
            </div>
            <div>
              <label class="text-xs text-soft" style="display:block;margin-bottom:0.25rem">카테고리</label>
              <select class="input-field" id="modal-category" style="width:100%">
                <option value="">카테고리 선택...</option>
                ${categories
                  .map(
                    (c) =>
                      `<option value="${escapeHtml(c.key || c.id)}" ${(item.categoryKey || "") === (c.key || c.id) ? "selected" : ""}>${escapeHtml(getStageLabel(c.stageKey))} &gt; ${escapeHtml(c.label)}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div>
              <label class="text-xs text-soft" style="display:block;margin-bottom:0.25rem">부서</label>
              <input type="text" class="input-field" id="modal-department" value="${escapeHtml(item.department || "")}" placeholder="마케팅+법무 (여러 부서는 + 구분)" style="width:100%">
            </div>
            <div class="flex gap-3">
              <div style="flex:1">
                <label class="text-xs text-soft" style="display:block;margin-bottom:0.25rem">D-Day 오프셋 (일)</label>
                <input type="number" class="input-field" id="modal-dday" value="${item.dDayOffset != null ? item.dDayOffset : ""}" placeholder="-240" style="width:100%">
              </div>
              <div style="flex:1">
                <label class="text-xs text-soft" style="display:block;margin-bottom:0.25rem">소요 기간 (일)</label>
                <input type="number" class="input-field" id="modal-duration" value="${item.durationDays != null ? item.durationDays : ""}" placeholder="14" style="width:100%">
              </div>
            </div>
            <div class="flex gap-4" style="padding:0.5rem 0">
              <label class="flex items-center gap-2" style="cursor:pointer;user-select:none">
                <input type="checkbox" id="modal-required" ${item.isRequired ? "checked" : ""} style="width:1rem;height:1rem;accent-color:var(--primary-500)">
                <span class="text-sm" style="color:var(--slate-200)">필수 항목</span>
              </label>
              <label class="flex items-center gap-2" style="cursor:pointer;user-select:none">
                <input type="checkbox" id="modal-per-customer" ${item.perCustomer ? "checked" : ""} style="width:1rem;height:1rem;accent-color:var(--primary-500)">
                <span class="text-sm" style="color:var(--slate-200)">거래처별 생성</span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-ghost" id="modal-cancel-btn">취소</button>
          <button class="btn-primary" id="modal-save-btn">저장</button>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// Open / Close modal
// =============================================================================

function openItemModal(item = null) {
  editingItem = item;
  showModal = true;
  render();
  // Focus first input
  setTimeout(() => {
    const el = document.getElementById("modal-code");
    if (el) el.focus();
  }, 50);
}

function closeItemModal() {
  editingItem = null;
  showModal = false;
  render();
}

// =============================================================================
// Event binding
// =============================================================================

function bindEvents() {
  // --- Tab switching ---
  app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  // Stat card tab switching
  app.querySelectorAll("[data-stat-tab]").forEach((card) => {
    card.addEventListener("click", () => {
      activeTab = card.dataset.statTab;
      render();
    });
  });

  // Tab-switch buttons (e.g. from empty state)
  app.querySelectorAll("[data-tab-switch]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tabSwitch;
      render();
    });
  });

  // --- Pipeline Tab Events ---
  bindPipelineEvents();

  // --- Categories Tab Events ---
  bindCategoryEvents();

  // --- Items Tab Events ---
  bindItemEvents();

  // --- Modal Events ---
  bindModalEvents();
}

// =============================================================================
// Pipeline events
// =============================================================================

function bindPipelineEvents() {
  // Add stage
  const addBtn = document.getElementById("add-stage-btn");
  const emptyAddBtn = document.getElementById("empty-add-stage");
  const addHandler = async () => {
    const newOrder = stages.length;
    try {
      await addLaunchPipelineStage({
        key: `stage_${Date.now()}`,
        label: "새 단계",
        icon: "📋",
        order: newOrder,
      });
      showToast("success", "단계가 추가되었습니다.");
    } catch (err) {
      showToast("error", "단계 추가 실패: " + err.message);
    }
  };
  if (addBtn) addBtn.addEventListener("click", addHandler);
  if (emptyAddBtn) emptyAddBtn.addEventListener("click", addHandler);

  // Edit stage (inline)
  app.querySelectorAll("[data-edit-stage]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingStageId = btn.dataset.editStage;
      render();
      setTimeout(() => {
        const el = document.getElementById("edit-stage-label");
        if (el) el.focus();
      }, 50);
    });
  });

  // Save stage
  app.querySelectorAll("[data-save-stage]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.saveStage;
      const icon = document.getElementById("edit-stage-icon")?.value.trim();
      const label = document.getElementById("edit-stage-label")?.value.trim();
      const key = document.getElementById("edit-stage-key")?.value.trim();
      if (!label) { showToast("error", "단계명을 입력하세요."); return; }
      try {
        await updateLaunchPipelineStage(id, { icon, label, key });
        showToast("success", "단계가 수정되었습니다.");
        editingStageId = null;
        render();
      } catch (err) {
        showToast("error", "수정 실패: " + err.message);
      }
    });
  });

  // Cancel stage edit
  app.querySelectorAll("[data-cancel-stage]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingStageId = null;
      render();
    });
  });

  // Delete stage
  app.querySelectorAll("[data-delete-stage]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteStage;
      // If has references, show warning inline
      if (btn.hasAttribute("data-has-refs")) {
        const warning = app.querySelector(`[data-ref-warning-stage="${id}"]`);
        if (warning) {
          warning.style.display = warning.style.display === "none" ? "block" : "none";
        }
        return;
      }
      if (!await confirmModal("이 파이프라인 단계를 삭제하시겠습니까?")) return;
      try {
        await deleteLaunchPipelineStage(id);
        showToast("success", "단계가 삭제되었습니다.");
      } catch (err) {
        showToast("error", "삭제 실패: " + err.message);
      }
    });
  });

  // Move stage up/down
  app.querySelectorAll("[data-move-stage-up]").forEach((btn) => {
    btn.addEventListener("click", () => moveStage(btn.dataset.moveStageUp, -1));
  });
  app.querySelectorAll("[data-move-stage-down]").forEach((btn) => {
    btn.addEventListener("click", () => moveStage(btn.dataset.moveStageDown, 1));
  });
}

async function moveStage(stageId, direction) {
  const idx = stages.findIndex((s) => s.id === stageId);
  if (idx < 0) return;
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= stages.length) return;

  try {
    await Promise.all([
      updateLaunchPipelineStage(stages[idx].id, { order: swapIdx }),
      updateLaunchPipelineStage(stages[swapIdx].id, { order: idx }),
    ]);
  } catch (err) {
    showToast("error", "순서 변경 실패: " + err.message);
  }
}

// =============================================================================
// Category events
// =============================================================================

function bindCategoryEvents() {
  // Toggle accordion sections
  app.querySelectorAll("[data-toggle-stage-section]").forEach((header) => {
    header.addEventListener("click", () => {
      const stageId = header.dataset.toggleStageSection;
      const section = app.querySelector(`[data-stage-section="${stageId}"]`);
      const chevron = app.querySelector(`[data-chevron="${stageId}"]`);
      if (section) {
        const isHidden = section.style.display === "none";
        section.style.display = isHidden ? "" : "none";
        if (chevron) chevron.innerHTML = isHidden ? "&#9660;" : "&#9654;";
      }
    });
  });

  // Add category
  app.querySelectorAll("[data-add-category]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const stageKey = btn.dataset.addCategory;
      const stageCats = getCategoriesForStage(stageKey);
      try {
        await addLaunchCategory({
          key: `cat_${Date.now()}`,
          label: "새 카테고리",
          stageKey: stageKey,
          order: stageCats.length,
        });
        showToast("success", "카테고리가 추가되었습니다.");
      } catch (err) {
        showToast("error", "카테고리 추가 실패: " + err.message);
      }
    });
  });

  // Edit category (inline)
  app.querySelectorAll("[data-edit-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingCategoryId = btn.dataset.editCategory;
      render();
      setTimeout(() => {
        const el = document.getElementById("edit-cat-label");
        if (el) el.focus();
      }, 50);
    });
  });

  // Save category
  app.querySelectorAll("[data-save-category]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.saveCategory;
      const key = document.getElementById("edit-cat-key")?.value.trim();
      const label = document.getElementById("edit-cat-label")?.value.trim();
      if (!label) { showToast("error", "카테고리명을 입력하세요."); return; }
      try {
        await updateLaunchCategory(id, { key, label });
        showToast("success", "카테고리가 수정되었습니다.");
        editingCategoryId = null;
        render();
      } catch (err) {
        showToast("error", "수정 실패: " + err.message);
      }
    });
  });

  // Cancel category edit
  app.querySelectorAll("[data-cancel-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      editingCategoryId = null;
      render();
    });
  });

  // Delete category
  app.querySelectorAll("[data-delete-category]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteCategory;
      if (btn.hasAttribute("data-has-refs")) {
        const warning = app.querySelector(`[data-ref-warning-cat="${id}"]`);
        if (warning) {
          warning.style.display = warning.style.display === "none" ? "block" : "none";
        }
        return;
      }
      if (!await confirmModal("이 카테고리를 삭제하시겠습니까?")) return;
      try {
        await deleteLaunchCategory(id);
        showToast("success", "카테고리가 삭제되었습니다.");
      } catch (err) {
        showToast("error", "삭제 실패: " + err.message);
      }
    });
  });

  // Move category up/down
  app.querySelectorAll("[data-move-cat-up]").forEach((btn) => {
    btn.addEventListener("click", () => moveCategory(btn.dataset.moveCatUp, btn.dataset.stageKey, -1));
  });
  app.querySelectorAll("[data-move-cat-down]").forEach((btn) => {
    btn.addEventListener("click", () => moveCategory(btn.dataset.moveCatDown, btn.dataset.stageKey, 1));
  });
}

async function moveCategory(catId, stageKey, direction) {
  const stageCats = getCategoriesForStage(stageKey);
  const idx = stageCats.findIndex((c) => c.id === catId);
  if (idx < 0) return;
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= stageCats.length) return;

  try {
    await Promise.all([
      updateLaunchCategory(stageCats[idx].id, { order: swapIdx }),
      updateLaunchCategory(stageCats[swapIdx].id, { order: idx }),
    ]);
  } catch (err) {
    showToast("error", "순서 변경 실패: " + err.message);
  }
}

// =============================================================================
// Item events
// =============================================================================

function bindItemEvents() {
  // Search
  const searchInput = document.getElementById("item-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      render();
      const el = document.getElementById("item-search");
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  // Category filter
  const catFilter = document.getElementById("filter-category");
  if (catFilter) {
    catFilter.addEventListener("change", (e) => {
      filterCategory = e.target.value;
      render();
    });
  }

  // Department filter
  const deptFilter = document.getElementById("filter-department");
  if (deptFilter) {
    deptFilter.addEventListener("change", (e) => {
      filterDepartment = e.target.value;
      render();
    });
  }

  // Add item button
  const addItemBtn = document.getElementById("add-item-btn");
  const emptyAddItemBtn = document.getElementById("empty-add-item");
  if (addItemBtn) addItemBtn.addEventListener("click", () => openItemModal(null));
  if (emptyAddItemBtn) emptyAddItemBtn.addEventListener("click", () => openItemModal(null));

  // Edit item
  app.querySelectorAll("[data-edit-item]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = items.find((i) => i.id === btn.dataset.editItem);
      if (item) openItemModal(item);
    });
  });

  // Delete item
  app.querySelectorAll("[data-delete-item]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.deleteItem;
      const item = items.find((i) => i.id === id);
      if (!await confirmModal(`"${item?.title || ""}" 항목을 삭제하시겠습니까?`)) return;
      try {
        await deleteLaunchTemplateItem(id);
        showToast("success", "항목이 삭제되었습니다.");
      } catch (err) {
        showToast("error", "삭제 실패: " + err.message);
      }
    });
  });
}

// =============================================================================
// Modal events
// =============================================================================

function bindModalEvents() {
  if (!showModal) return;

  const backdrop = document.getElementById("item-modal-backdrop");
  const closeBtn = document.getElementById("modal-close-btn");
  const cancelBtn = document.getElementById("modal-cancel-btn");
  const saveBtn = document.getElementById("modal-save-btn");

  // Close modal
  const close = () => closeItemModal();
  if (closeBtn) closeBtn.addEventListener("click", close);
  if (cancelBtn) cancelBtn.addEventListener("click", close);
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
  }

  // Escape key
  const escHandler = (e) => {
    if (e.key === "Escape" && showModal) {
      close();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  // Save
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const code = document.getElementById("modal-code")?.value.trim();
      const title = document.getElementById("modal-title")?.value.trim();
      const categoryKey = document.getElementById("modal-category")?.value;
      const department = document.getElementById("modal-department")?.value.trim();
      const dDayOffset = document.getElementById("modal-dday")?.value;
      const durationDays = document.getElementById("modal-duration")?.value;
      const isRequired = document.getElementById("modal-required")?.checked || false;
      const perCustomer = document.getElementById("modal-per-customer")?.checked || false;

      if (!title) { showToast("error", "제목을 입력하세요."); return; }
      if (!categoryKey) { showToast("error", "카테고리를 선택하세요."); return; }

      const data = {
        code: code || "",
        title,
        categoryKey,
        department: department || "",
        dDayOffset: dDayOffset !== "" ? parseInt(dDayOffset, 10) : null,
        durationDays: durationDays !== "" ? parseInt(durationDays, 10) : null,
        isRequired,
        perCustomer,
      };

      saveBtn.disabled = true;
      saveBtn.textContent = "저장 중...";

      try {
        if (editingItem) {
          await updateLaunchTemplateItem(editingItem.id, data);
          showToast("success", "항목이 수정되었습니다.");
        } else {
          await addLaunchTemplateItem(data);
          showToast("success", "항목이 추가되었습니다.");
        }
        closeItemModal();
      } catch (err) {
        showToast("error", "저장 실패: " + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = "저장";
      }
    });
  }

  // Enter key saves in modal
  const modalInputs = app.querySelectorAll("#item-modal-backdrop input[type='text'], #item-modal-backdrop input[type='number']");
  modalInputs.forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveBtn?.click();
      }
    });
  });
}

// =============================================================================
// Responsive: re-render on resize
// =============================================================================

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (activeTab === "items") render();
  }, 200);
});

// =============================================================================
// Initial render
// =============================================================================

render();
