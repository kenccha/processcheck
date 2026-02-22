// =============================================================================
// Admin Checklists — Template Management Page (Tree / Matrix / List views)
// =============================================================================

import { guardPage, getUser } from "../auth.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
initTheme();
import {
  getTemplateStages, getTemplateDepartments, subscribeTemplateItems,
  subscribeAllTemplateItems,
  addTemplateItem, updateTemplateItem, deleteTemplateItem, reorderTemplateItems,
  addTemplateStage, deleteTemplateStage, addTemplateDepartment, deleteTemplateDepartment
} from "../firestore-service.js";
import { escapeHtml } from "../utils.js";

// --- Auth Guard --------------------------------------------------------------

const user = guardPage();
if (!user) throw new Error("Not authenticated");

// --- Render Navigation -------------------------------------------------------

const navUnsub = renderNav(document.getElementById("nav-root"));

// --- State -------------------------------------------------------------------

let stages = [];
let departments = [];
let selectedStageId = null;
let selectedDeptId = null;
let items = [];          // items for current tree selection (stage+dept)
let allItems = [];       // ALL template items across every stage/dept
let activeItemUnsub = null;
let allItemsUnsub = null;
let modal = null; // null | {type, data}
let dragState = { draggedId: null, overId: null };

// View mode: "matrix" | "tree" | "list" (기본값 matrix)
let viewMode = "matrix";

// List view filters
let listSearchQuery = "";
let listFilterStage = "all";
let listFilterDept = "all";

const app = document.getElementById("app");
const unsubscribers = [];
if (navUnsub) unsubscribers.push(navUnsub);

// --- Init --------------------------------------------------------------------

async function init() {
  try {
    const [loadedStages, loadedDepts] = await Promise.all([
      getTemplateStages(),
      getTemplateDepartments(),
    ]);

    stages = loadedStages;
    departments = loadedDepts;

    if (stages.length > 0) selectedStageId = stages[0].id;
    if (departments.length > 0) selectedDeptId = departments[0].id;

    subscribeToItems();
    subscribeToAllItems();
    render();
  } catch (err) {
    console.error("Init error:", err);
    app.innerHTML = `
      <div class="container animate-fade-in">
        <div class="empty-state" style="padding: 4rem 1rem">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
          <span class="empty-state-text">데이터를 불러오는 중 오류가 발생했습니다.</span>
        </div>
      </div>
    `;
  }
}

// --- Subscription Management -------------------------------------------------

function subscribeToItems() {
  if (activeItemUnsub) {
    activeItemUnsub();
    activeItemUnsub = null;
  }

  if (!selectedStageId || !selectedDeptId) {
    items = [];
    render();
    return;
  }

  activeItemUnsub = subscribeTemplateItems(selectedStageId, selectedDeptId, (newItems) => {
    items = newItems;
    render();
  });
}

function subscribeToAllItems() {
  if (allItemsUnsub) {
    allItemsUnsub();
    allItemsUnsub = null;
  }

  allItemsUnsub = subscribeAllTemplateItems((newAllItems) => {
    allItems = newAllItems;
    // Re-render if not in tree mode (tree re-renders via its own subscription)
    if (viewMode !== "tree") {
      render();
    }
  });
}

// --- Stage/Dept Selection ----------------------------------------------------

function selectStage(stageId) {
  selectedStageId = stageId;
  subscribeToItems();
}

function selectDept(deptId) {
  selectedDeptId = deptId;
  subscribeToItems();
}

// --- View Mode ---------------------------------------------------------------

function setViewMode(mode) {
  viewMode = mode;
  render();
}

function navigateToTreeCell(stageId, deptId) {
  selectedStageId = stageId;
  selectedDeptId = deptId;
  viewMode = "tree";
  subscribeToItems();
}

// --- Modal Management --------------------------------------------------------

function openModal(type, data = {}) {
  modal = { type, data };
  render();
}

function closeModal() {
  modal = null;
  render();
}

// --- Actions -----------------------------------------------------------------

async function handleAddItem(content, isRequired) {
  if (!content.trim()) return;
  const maxOrder = items.reduce((max, it) => Math.max(max, it.order ?? 0), -1);
  try {
    await addTemplateItem({
      stageId: selectedStageId,
      departmentId: selectedDeptId,
      content: content.trim(),
      order: maxOrder + 1,
      isRequired,
      createdBy: user.name,
      lastModifiedBy: user.name,
    });
    closeModal();
  } catch (err) {
    console.error("Add item error:", err);
    alert("항목 추가 중 오류가 발생했습니다.");
  }
}

async function handleEditItem(itemId, content, isRequired) {
  if (!content.trim()) return;
  try {
    await updateTemplateItem(itemId, {
      content: content.trim(),
      isRequired,
      lastModifiedBy: user.name,
    });
    closeModal();
  } catch (err) {
    console.error("Edit item error:", err);
    alert("항목 수정 중 오류가 발생했습니다.");
  }
}

async function handleDeleteItem(itemId) {
  if (!confirm("이 항목을 삭제하시겠습니까?")) return;
  try {
    await deleteTemplateItem(itemId);
  } catch (err) {
    console.error("Delete item error:", err);
    alert("항목 삭제 중 오류가 발생했습니다.");
  }
}

async function handleAddStage(name, workStageName, gateStageName) {
  if (!name.trim()) return;
  try {
    await addTemplateStage({
      name: name.trim(),
      workStageName: workStageName.trim(),
      gateStageName: gateStageName.trim(),
      createdBy: user.name,
    });
    stages = await getTemplateStages();
    closeModal();
  } catch (err) {
    console.error("Add stage error:", err);
    alert("단계 추가 중 오류가 발생했습니다.");
  }
}

async function handleDeleteStage(stageId) {
  const stage = stages.find(s => s.id === stageId);
  const stageName = stage ? stage.name : stageId;
  if (!confirm(`"${stageName}" 단계를 삭제하시겠습니까?\n\n이 단계에 속한 모든 체크리스트 항목도 함께 삭제됩니다.`)) return;
  try {
    await deleteTemplateStage(stageId);
    stages = await getTemplateStages();
    if (selectedStageId === stageId) {
      selectedStageId = stages.length > 0 ? stages[0].id : null;
      subscribeToItems();
    }
    render();
  } catch (err) {
    console.error("Delete stage error:", err);
    alert("단계 삭제 중 오류가 발생했습니다.");
  }
}

async function handleAddDept(name) {
  if (!name.trim()) return;
  try {
    await addTemplateDepartment({ name: name.trim(), createdBy: user.name });
    departments = await getTemplateDepartments();
    closeModal();
  } catch (err) {
    console.error("Add dept error:", err);
    alert("부서 추가 중 오류가 발생했습니다.");
  }
}

async function handleDeleteDept(deptId) {
  const dept = departments.find(d => d.id === deptId);
  const deptName = dept ? dept.name : deptId;
  if (!confirm(`"${deptName}" 부서를 삭제하시겠습니까?\n\n이 부서에 속한 모든 체크리스트 항목도 함께 삭제됩니다.`)) return;
  try {
    await deleteTemplateDepartment(deptId);
    departments = await getTemplateDepartments();
    if (selectedDeptId === deptId) {
      selectedDeptId = departments.length > 0 ? departments[0].id : null;
      subscribeToItems();
    }
    render();
  } catch (err) {
    console.error("Delete dept error:", err);
    alert("부서 삭제 중 오류가 발생했습니다.");
  }
}

// --- Drag & Drop Reorder -----------------------------------------------------

function handleDragStart(e) {
  const itemEl = e.currentTarget;
  dragState.draggedId = itemEl.dataset.itemId;
  itemEl.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragState.draggedId);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const itemEl = e.currentTarget;
  const targetId = itemEl.dataset.itemId;
  if (targetId === dragState.draggedId) return;

  dragState.overId = targetId;

  // Visual indicator: add a top/bottom border depending on position
  const rect = itemEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const allDragItems = app.querySelectorAll(".drag-item");
  allDragItems.forEach(el => {
    el.style.borderTopColor = "";
    el.style.borderBottomColor = "";
  });

  if (e.clientY < midY) {
    itemEl.style.borderTopColor = "var(--primary-400)";
  } else {
    itemEl.style.borderBottomColor = "var(--primary-400)";
  }
}

function handleDragLeave(e) {
  const itemEl = e.currentTarget;
  itemEl.style.borderTopColor = "";
  itemEl.style.borderBottomColor = "";
}

function handleDrop(e) {
  e.preventDefault();
  const targetEl = e.currentTarget;
  const targetId = targetEl.dataset.itemId;
  const draggedId = dragState.draggedId;

  // Clear visual indicators
  const allDragItems = app.querySelectorAll(".drag-item");
  allDragItems.forEach(el => {
    el.style.borderTopColor = "";
    el.style.borderBottomColor = "";
    el.classList.remove("dragging");
  });

  if (!draggedId || draggedId === targetId) return;

  // Compute new order
  const orderedItems = [...items];
  const draggedIdx = orderedItems.findIndex(it => it.id === draggedId);
  const targetIdx = orderedItems.findIndex(it => it.id === targetId);

  if (draggedIdx === -1 || targetIdx === -1) return;

  // Determine whether to place before or after target
  const rect = targetEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  let insertIdx = targetIdx;
  if (e.clientY >= midY) {
    insertIdx = targetIdx + (draggedIdx < targetIdx ? 0 : 1);
  } else {
    insertIdx = targetIdx - (draggedIdx < targetIdx ? 1 : 0);
  }

  // Remove dragged item and insert at new position
  const [draggedItem] = orderedItems.splice(draggedIdx, 1);
  orderedItems.splice(insertIdx, 0, draggedItem);

  // Build reorder payload
  const reorderPayload = orderedItems.map((it, idx) => ({ id: it.id, order: idx }));

  reorderTemplateItems(reorderPayload).catch(err => {
    console.error("Reorder error:", err);
    alert("순서 변경 중 오류가 발생했습니다.");
  });

  dragState = { draggedId: null, overId: null };
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  const allDragItems = app.querySelectorAll(".drag-item");
  allDragItems.forEach(el => {
    el.style.borderTopColor = "";
    el.style.borderBottomColor = "";
  });
  dragState = { draggedId: null, overId: null };
}

// --- Helpers -----------------------------------------------------------------

function getStageName(stageId) {
  const s = stages.find(s => s.id === stageId);
  return s ? s.name : stageId;
}

function getDeptName(deptId) {
  const d = departments.find(d => d.id === deptId);
  return d ? d.name : deptId;
}

function getFilteredListItems() {
  let filtered = allItems;
  if (listFilterStage !== "all") {
    filtered = filtered.filter(item => item.stageId === listFilterStage);
  }
  if (listFilterDept !== "all") {
    filtered = filtered.filter(item => item.departmentId === listFilterDept);
  }
  if (listSearchQuery.trim()) {
    const q = listSearchQuery.trim().toLowerCase();
    filtered = filtered.filter(item => item.content.toLowerCase().includes(q));
  }
  return filtered;
}

function getMatrixData() {
  return stages.map(stage => {
    const deptCounts = departments.map(dept => {
      const count = allItems.filter(
        item => item.stageId === stage.id && item.departmentId === dept.id
      ).length;
      const requiredCount = allItems.filter(
        item => item.stageId === stage.id && item.departmentId === dept.id && item.isRequired
      ).length;
      return { deptId: dept.id, count, requiredCount };
    });
    return { stage, deptCounts };
  });
}

// --- SVG Icons ---------------------------------------------------------------

const ICON_DRAG = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg>`;

const ICON_EDIT = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`;

const ICON_DELETE = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;

const ICON_PLUS = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`;

const ICON_CLOSE = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;

const ICON_TREE = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/></svg>`;

const ICON_MATRIX = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>`;

const ICON_LIST = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>`;

const ICON_SEARCH = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>`;

// --- Render (main dispatcher) ------------------------------------------------

function render() {
  const selectedStage = stages.find(s => s.id === selectedStageId);
  const selectedDept = departments.find(d => d.id === selectedDeptId);

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Page Header -->
      <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100)">
            체크리스트 템플릿 관리
          </h1>
          <p class="text-sm text-soft mt-1">
            프로젝트에 적용할 체크리스트 템플릿의 단계별, 부서별 항목을 관리합니다.
            <span style="color: var(--slate-500); margin-left: 0.5rem; font-family: monospace; font-size: 0.75rem;">
              총 ${allItems.length}개 항목
            </span>
          </p>
        </div>

        <!-- View Mode Toggle -->
        <div class="flex items-center gap-1" style="background: var(--surface-2); border: 1px solid var(--surface-3); border-radius: 0.75rem; padding: 0.25rem;">
          ${renderViewModeBtn("matrix", "매트릭스", ICON_MATRIX)}
          ${renderViewModeBtn("tree", "트리", ICON_TREE)}
          ${renderViewModeBtn("list", "리스트", ICON_LIST)}
        </div>
      </div>

      <!-- View Content -->
      ${viewMode === "tree" ? renderTreeView(selectedStage, selectedDept)
        : viewMode === "matrix" ? renderMatrixView()
        : renderListView()}
    </div>

    ${renderModal()}
  `;

  bindEvents();
}

function renderViewModeBtn(mode, label, icon) {
  const isActive = viewMode === mode;
  return `
    <button class="view-mode-btn flex items-center gap-1" data-view-mode="${mode}"
            style="padding: 0.375rem 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500;
                   transition: all 0.15s; cursor: pointer; border: 1px solid transparent;
                   ${isActive
                     ? "background: rgba(6,182,212,0.2); color: var(--primary-300); border-color: rgba(6,182,212,0.3);"
                     : "color: var(--slate-400); background: transparent;"
                   }">
      ${icon}
      ${escapeHtml(label)}
    </button>
  `;
}

// =============================================================================
// TREE VIEW
// =============================================================================

function renderTreeView(selectedStage, selectedDept) {
  return `
    <div class="flex gap-6" style="align-items: flex-start;">

      <!-- Stage Sidebar -->
      <div class="card" style="width: 260px; flex-shrink: 0; padding: 0; overflow: hidden;">
        <div class="flex items-center justify-between" style="padding: 0.875rem 1rem; border-bottom: 1px solid var(--surface-3);">
          <span class="font-semibold text-sm" style="color: var(--slate-200);">단계 목록</span>
          <button class="btn-ghost btn-xs" id="btn-add-stage">
            ${ICON_PLUS}
            <span>추가</span>
          </button>
        </div>
        <div style="max-height: 60vh; overflow-y: auto;">
          ${stages.length === 0
            ? `<div class="empty-state" style="padding: 2rem 1rem">
                <span class="empty-state-text">단계가 없습니다</span>
              </div>`
            : stages.map(stage => {
                const cellCount = allItems.filter(it => it.stageId === stage.id).length;
                return `
                  <div class="flex items-center gap-2 cursor-pointer select-none stage-item ${stage.id === selectedStageId ? "active" : ""}"
                       data-stage-id="${stage.id}"
                       style="padding: 0.625rem 1rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;
                              ${stage.id === selectedStageId ? "background: rgba(6, 182, 212, 0.08); border-left: 3px solid var(--primary-400);" : "border-left: 3px solid transparent;"}">
                    <div style="flex: 1; min-width: 0;">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium truncate" style="color: ${stage.id === selectedStageId ? "var(--primary-300)" : "var(--slate-300)"};">
                          ${escapeHtml(stage.name)}
                        </span>
                        ${cellCount > 0 ? `<span style="font-size: 0.625rem; font-family: monospace; color: var(--slate-500); background: var(--surface-3); padding: 0.0625rem 0.375rem; border-radius: 0.25rem;">${cellCount}</span>` : ""}
                      </div>
                      <div class="text-xs text-dim" style="margin-top: 0.125rem;">
                        ${escapeHtml(stage.workStageName || "")} / ${escapeHtml(stage.gateStageName || "")}
                      </div>
                    </div>
                    <button class="btn-ghost btn-xs stage-delete-btn" data-stage-delete-id="${stage.id}" title="단계 삭제"
                            style="padding: 0.25rem; color: var(--slate-600); flex-shrink: 0;">
                      ${ICON_DELETE}
                    </button>
                  </div>
                `;
              }).join("")
          }
        </div>
      </div>

      <!-- Content Area -->
      <div style="flex: 1; min-width: 0;">
        <!-- Department Tabs -->
        <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 1rem;">
          <div class="flex items-center" style="border-bottom: 1px solid var(--surface-3); overflow-x: auto;">
            <div class="tab-bar" style="border-bottom: none; flex: 1;">
              ${departments.map(dept => `
                <button class="tab-btn ${dept.id === selectedDeptId ? "active" : ""}" data-dept-id="${dept.id}">
                  ${escapeHtml(dept.name)}
                </button>
              `).join("")}
            </div>
            <div class="flex items-center gap-1" style="padding: 0 0.5rem; flex-shrink: 0;">
              <button class="btn-ghost btn-xs" id="btn-add-dept">
                ${ICON_PLUS}
                <span>부서 추가</span>
              </button>
              ${selectedDeptId ? `
                <button class="btn-ghost btn-xs" id="btn-delete-dept" data-dept-delete-id="${selectedDeptId}"
                        title="현재 부서 삭제" style="color: var(--danger-400);">
                  ${ICON_DELETE}
                </button>
              ` : ""}
            </div>
          </div>
        </div>

        <!-- Items Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="section-title">
              ${selectedStage ? escapeHtml(selectedStage.name) : "단계 선택"}
            </span>
            ${selectedDept ? `<span class="badge badge-neutral">${escapeHtml(selectedDept.name)}</span>` : ""}
            <span class="text-xs text-soft">${items.length}개 항목</span>
          </div>
          <button class="btn-primary btn-sm" id="btn-add-item" ${!selectedStageId || !selectedDeptId ? "disabled" : ""}>
            ${ICON_PLUS}
            <span>항목 추가</span>
          </button>
        </div>

        <!-- Items List -->
        <div class="flex flex-col gap-2" id="items-list">
          ${(!selectedStageId || !selectedDeptId)
            ? `<div class="card">
                <div class="empty-state" style="padding: 3rem 1rem;">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  </svg>
                  <span class="empty-state-text">단계와 부서를 선택하세요</span>
                </div>
              </div>`
            : items.length === 0
              ? `<div class="card">
                  <div class="empty-state" style="padding: 3rem 1rem;">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                    </svg>
                    <span class="empty-state-text">이 단계/부서에 등록된 항목이 없습니다</span>
                  </div>
                </div>`
              : items.map(item => `
                  <div class="drag-item" draggable="true" data-item-id="${item.id}">
                    <span class="drag-handle" title="드래그하여 순서 변경">
                      ${ICON_DRAG}
                    </span>
                    <div style="flex: 1; min-width: 0;">
                      <div class="flex items-center gap-2">
                        <span class="text-sm" style="color: var(--slate-200);">${escapeHtml(item.content)}</span>
                        ${item.isRequired
                          ? `<span class="badge badge-primary" style="font-size: 0.625rem; padding: 0.0625rem 0.375rem;">필수</span>`
                          : `<span class="badge badge-neutral" style="font-size: 0.625rem; padding: 0.0625rem 0.375rem;">선택</span>`
                        }
                      </div>
                    </div>
                    <div class="flex items-center gap-1" style="flex-shrink: 0;">
                      <button class="btn-ghost btn-xs item-edit-btn" data-edit-item-id="${item.id}" title="항목 수정"
                              style="padding: 0.25rem;">
                        ${ICON_EDIT}
                      </button>
                      <button class="btn-ghost btn-xs item-delete-btn" data-delete-item-id="${item.id}" title="항목 삭제"
                              style="padding: 0.25rem; color: var(--danger-400);">
                        ${ICON_DELETE}
                      </button>
                    </div>
                  </div>
                `).join("")
          }
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// MATRIX VIEW
// =============================================================================

function renderMatrixView() {
  const matrixData = getMatrixData();

  const headerCells = departments.map(dept => `
    <th style="text-align: center; padding: 0.75rem; font-size: 0.75rem; font-weight: 600;
               color: var(--slate-400); text-transform: uppercase; letter-spacing: 0.05em;
               border-bottom: 1px solid var(--surface-3); min-width: 90px;">
      ${escapeHtml(dept.name)}
    </th>
  `).join("");

  const bodyRows = matrixData.map(({ stage, deptCounts }, idx) => {
    const rowTotal = deptCounts.reduce((sum, d) => sum + d.count, 0);
    const bgStyle = idx % 2 === 0 ? "background: var(--surface-2);" : "background: rgba(15,23,42,0.3);";

    const cells = deptCounts.map(dc => {
      if (dc.count > 0) {
        return `
          <td style="text-align: center; padding: 0.75rem; border-bottom: 1px solid var(--surface-3);">
            <button class="matrix-cell-btn" data-matrix-stage="${stage.id}" data-matrix-dept="${dc.deptId}"
                    style="display: inline-flex; flex-direction: column; align-items: center; gap: 0.125rem;
                           padding: 0.375rem 0.625rem; border-radius: 0.5rem;
                           background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2);
                           cursor: pointer; transition: all 0.15s;">
              <span style="font-size: 0.875rem; font-weight: 600; color: var(--primary-300);">${dc.count}</span>
              ${dc.requiredCount > 0
                ? `<span style="font-size: 0.625rem; color: var(--danger-400); font-family: monospace;">필수 ${dc.requiredCount}</span>`
                : ""}
            </button>
          </td>
        `;
      } else {
        return `
          <td style="text-align: center; padding: 0.75rem; border-bottom: 1px solid var(--surface-3);">
            <span style="color: var(--slate-600); font-size: 0.875rem;">&mdash;</span>
          </td>
        `;
      }
    }).join("");

    return `
      <tr style="${bgStyle}" class="matrix-row">
        <td style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--surface-3); position: sticky; left: 0; z-index: 1; ${bgStyle}">
          <div>
            <span style="font-weight: 500; color: var(--slate-200); font-size: 0.875rem;">${escapeHtml(stage.name)}</span>
            <span style="font-size: 0.625rem; color: var(--slate-500); font-family: monospace; margin-left: 0.5rem;">
              ${escapeHtml(stage.workStageName || "")}/${escapeHtml(stage.gateStageName || "")}
            </span>
          </div>
        </td>
        ${cells}
        <td style="text-align: center; padding: 0.75rem; border-bottom: 1px solid var(--surface-3);">
          <span style="font-family: monospace; font-size: 0.875rem; font-weight: 600;
                       color: ${rowTotal > 0 ? "var(--slate-300)" : "var(--slate-600)"};">${rowTotal}</span>
        </td>
      </tr>
    `;
  }).join("");

  // Footer row (column totals)
  const footerCells = departments.map(dept => {
    const colTotal = allItems.filter(item => item.departmentId === dept.id).length;
    return `
      <td style="text-align: center; padding: 0.75rem;">
        <span style="font-family: monospace; font-size: 0.875rem; font-weight: 600;
                     color: ${colTotal > 0 ? "var(--slate-300)" : "var(--slate-600)"};">${colTotal}</span>
      </td>
    `;
  }).join("");

  return `
    <div class="card" style="padding: 0; overflow: hidden;">
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--surface-1);">
              <th style="text-align: left; padding: 0.75rem 1rem; font-size: 0.75rem; font-weight: 600;
                         color: var(--slate-400); text-transform: uppercase; letter-spacing: 0.05em;
                         border-bottom: 1px solid var(--surface-3); position: sticky; left: 0;
                         background: var(--surface-1); z-index: 2; min-width: 140px;">
                페이즈
              </th>
              ${headerCells}
              <th style="text-align: center; padding: 0.75rem; font-size: 0.75rem; font-weight: 600;
                         color: var(--slate-400); text-transform: uppercase; letter-spacing: 0.05em;
                         border-bottom: 1px solid var(--surface-3); min-width: 60px;">
                합계
              </th>
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
            <tr style="background: var(--surface-1); border-top: 2px solid var(--surface-3);">
              <td style="padding: 0.75rem 1rem; position: sticky; left: 0; background: var(--surface-1); z-index: 1;">
                <span style="font-weight: 600; color: var(--slate-300); font-size: 0.875rem;">합계</span>
              </td>
              ${footerCells}
              <td style="text-align: center; padding: 0.75rem;">
                <span style="font-family: monospace; font-size: 0.875rem; font-weight: 700; color: var(--primary-400);">${allItems.length}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="padding: 0.75rem 1.25rem; border-top: 1px solid var(--surface-3); display: flex; align-items: center; gap: 1rem; font-size: 0.75rem; color: var(--slate-500);">
        <span style="display: flex; align-items: center; gap: 0.375rem;">
          <span style="display: inline-block; width: 0.75rem; height: 0.75rem; border-radius: 0.25rem; background: rgba(6,182,212,0.2); border: 1px solid rgba(6,182,212,0.3);"></span>
          클릭하면 트리 뷰에서 편집
        </span>
        <span style="display: flex; align-items: center; gap: 0.375rem;">
          <span style="color: var(--danger-400); font-family: monospace;">필수 N</span>
          필수 항목 수
        </span>
      </div>
    </div>
  `;
}

// =============================================================================
// LIST VIEW
// =============================================================================

function renderListView() {
  const filteredItems = getFilteredListItems();

  const stageOptions = stages.map(s =>
    `<option value="${s.id}" ${listFilterStage === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`
  ).join("");

  const deptOptions = departments.map(d =>
    `<option value="${d.id}" ${listFilterDept === d.id ? "selected" : ""}>${escapeHtml(d.name)}</option>`
  ).join("");

  const listRows = filteredItems.length === 0
    ? `<div style="text-align: center; padding: 4rem 1rem; color: var(--slate-500);">
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 0.75rem; color: var(--slate-600);">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
        </svg>
        <span>검색 결과가 없습니다.</span>
      </div>`
    : filteredItems.map(item => `
        <div class="list-item-row" style="display: flex; align-items: center; gap: 1rem; padding: 0.875rem 1.25rem;
                    border-bottom: 1px solid var(--surface-3); transition: background 0.15s;">
          <div style="flex: 1; min-width: 0;">
            <p style="color: var(--slate-200); font-size: 0.875rem; line-height: 1.6;">${escapeHtml(item.content)}</p>
            <div class="flex items-center gap-2" style="margin-top: 0.375rem;">
              <span style="font-size: 0.6875rem; font-family: monospace; color: var(--slate-500); background: var(--surface-3); padding: 0.125rem 0.5rem; border-radius: 0.25rem;">
                ${escapeHtml(getStageName(item.stageId))}
              </span>
              <span style="font-size: 0.6875rem; font-family: monospace; color: var(--slate-500); background: var(--surface-3); padding: 0.125rem 0.5rem; border-radius: 0.25rem;">
                ${escapeHtml(getDeptName(item.departmentId))}
              </span>
              <span class="${item.isRequired ? "badge-danger" : "badge-neutral"}"
                    style="font-size: 0.625rem; padding: 0.0625rem 0.5rem; border-radius: 9999px; font-weight: 500;">
                ${item.isRequired ? "필수" : "선택"}
              </span>
            </div>
          </div>
          <button class="list-edit-btn btn-ghost btn-xs" data-list-stage="${item.stageId}" data-list-dept="${item.departmentId}"
                  title="트리 뷰에서 편집"
                  style="padding: 0.5rem; color: var(--slate-400); opacity: 0; transition: opacity 0.15s;">
            ${ICON_EDIT}
          </button>
        </div>
      `).join("");

  return `
    <div class="card" style="padding: 0; overflow: hidden;">
      <!-- Search & Filter Bar -->
      <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--surface-3); display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;">
        <div style="flex: 1; min-width: 200px; position: relative;">
          <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--slate-500); display: flex;">
            ${ICON_SEARCH}
          </span>
          <input type="text" id="list-search-input" class="input-field" placeholder="항목 검색..."
                 value="${escapeHtml(listSearchQuery)}"
                 style="width: 100%; padding-left: 2.25rem;">
        </div>
        <select id="list-filter-stage" class="input-field" style="font-size: 0.875rem;">
          <option value="all" ${listFilterStage === "all" ? "selected" : ""}>모든 페이즈</option>
          ${stageOptions}
        </select>
        <select id="list-filter-dept" class="input-field" style="font-size: 0.875rem;">
          <option value="all" ${listFilterDept === "all" ? "selected" : ""}>모든 부서</option>
          ${deptOptions}
        </select>
        <span style="font-size: 0.75rem; font-family: monospace; color: var(--slate-500);">
          ${filteredItems.length}/${allItems.length}
        </span>
      </div>

      <!-- Items -->
      <div style="max-height: calc(100vh - 300px); overflow-y: auto;" id="list-items-container">
        ${listRows}
      </div>
    </div>
  `;
}

// --- Modal Render ------------------------------------------------------------

function renderModal() {
  if (!modal) return "";

  switch (modal.type) {
    case "addItem":
      return renderItemModal("항목 추가", "", false);
    case "editItem":
      return renderItemModal("항목 수정", modal.data.content || "", modal.data.isRequired || false, modal.data.id);
    case "addStage":
      return renderStageModal();
    case "addDept":
      return renderDeptModal();
    default:
      return "";
  }
}

function renderItemModal(title, content, isRequired, itemId = null) {
  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${escapeHtml(title)}</span>
          <button class="modal-close" id="modal-close-btn">${ICON_CLOSE}</button>
        </div>
        <div class="modal-body">
          <div class="flex flex-col gap-4">
            <div>
              <label class="text-sm font-medium" style="color: var(--slate-300); display: block; margin-bottom: 0.375rem;">항목 내용</label>
              <textarea class="input-field" id="modal-item-content" rows="3" placeholder="체크리스트 항목 내용을 입력하세요...">${escapeHtml(content)}</textarea>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" id="modal-item-required" ${isRequired ? "checked" : ""}
                     style="accent-color: var(--primary-500); width: 1rem; height: 1rem; cursor: pointer;">
              <label for="modal-item-required" class="text-sm cursor-pointer" style="color: var(--slate-300);">필수 항목</label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary btn-sm" id="modal-cancel-btn">취소</button>
          <button class="btn-primary btn-sm" id="modal-save-btn" data-item-id="${itemId || ""}">저장</button>
        </div>
      </div>
    </div>
  `;
}

function renderStageModal() {
  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">페이즈 추가</span>
          <button class="modal-close" id="modal-close-btn">${ICON_CLOSE}</button>
        </div>
        <div class="modal-body">
          <div class="flex flex-col gap-4">
            <div>
              <label class="text-sm font-medium" style="color: var(--slate-300); display: block; margin-bottom: 0.375rem;">페이즈 이름</label>
              <input type="text" class="input-field" id="modal-stage-name" placeholder="예: 사후관리">
            </div>
            <div>
              <label class="text-sm font-medium" style="color: var(--slate-300); display: block; margin-bottom: 0.375rem;">작업 단계명</label>
              <input type="text" class="input-field" id="modal-stage-work-name" placeholder="예: 사후관리검토">
            </div>
            <div>
              <label class="text-sm font-medium" style="color: var(--slate-300); display: block; margin-bottom: 0.375rem;">승인 단계명</label>
              <input type="text" class="input-field" id="modal-stage-gate-name" placeholder="예: 사후관리승인">
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary btn-sm" id="modal-cancel-btn">취소</button>
          <button class="btn-primary btn-sm" id="modal-save-stage-btn">저장</button>
        </div>
      </div>
    </div>
  `;
}

function renderDeptModal() {
  return `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">부서 추가</span>
          <button class="modal-close" id="modal-close-btn">${ICON_CLOSE}</button>
        </div>
        <div class="modal-body">
          <div>
            <label class="text-sm font-medium" style="color: var(--slate-300); display: block; margin-bottom: 0.375rem;">부서 이름</label>
            <input type="text" class="input-field" id="modal-dept-name" placeholder="예: 마케팅팀">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary btn-sm" id="modal-cancel-btn">취소</button>
          <button class="btn-primary btn-sm" id="modal-save-dept-btn">저장</button>
        </div>
      </div>
    </div>
  `;
}

// --- Event Binding -----------------------------------------------------------

function bindEvents() {
  // ─── View Mode Toggle ─────────────────────────────────────────────────────
  app.querySelectorAll(".view-mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setViewMode(btn.dataset.viewMode);
    });
  });

  // ─── Tree View Events ─────────────────────────────────────────────────────
  if (viewMode === "tree") {
    bindTreeEvents();
  }

  // ─── Matrix View Events ───────────────────────────────────────────────────
  if (viewMode === "matrix") {
    bindMatrixEvents();
  }

  // ─── List View Events ─────────────────────────────────────────────────────
  if (viewMode === "list") {
    bindListEvents();
  }

  // ─── Modal Events ─────────────────────────────────────────────────────────
  bindModalEvents();
}

function bindTreeEvents() {
  // Stage selection
  app.querySelectorAll(".stage-item").forEach(el => {
    el.addEventListener("click", (e) => {
      // Don't select stage when clicking delete button
      if (e.target.closest(".stage-delete-btn")) return;
      selectStage(el.dataset.stageId);
    });
    el.addEventListener("mouseenter", () => {
      if (el.dataset.stageId !== selectedStageId) {
        el.style.background = "rgba(26, 34, 52, 0.5)";
      }
    });
    el.addEventListener("mouseleave", () => {
      if (el.dataset.stageId !== selectedStageId) {
        el.style.background = "";
      }
    });
  });

  // Stage delete buttons
  app.querySelectorAll(".stage-delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteStage(btn.dataset.stageDeleteId);
    });
  });

  // Department tab selection
  app.querySelectorAll(".tab-btn[data-dept-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      selectDept(btn.dataset.deptId);
    });
  });

  // Add stage button
  const addStageBtn = app.querySelector("#btn-add-stage");
  if (addStageBtn) {
    addStageBtn.addEventListener("click", () => openModal("addStage"));
  }

  // Add dept button
  const addDeptBtn = app.querySelector("#btn-add-dept");
  if (addDeptBtn) {
    addDeptBtn.addEventListener("click", () => openModal("addDept"));
  }

  // Delete dept button
  const deleteDeptBtn = app.querySelector("#btn-delete-dept");
  if (deleteDeptBtn) {
    deleteDeptBtn.addEventListener("click", () => {
      handleDeleteDept(deleteDeptBtn.dataset.deptDeleteId);
    });
  }

  // Add item button
  const addItemBtn = app.querySelector("#btn-add-item");
  if (addItemBtn) {
    addItemBtn.addEventListener("click", () => openModal("addItem"));
  }

  // Item edit buttons
  app.querySelectorAll(".item-edit-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.editItemId;
      const item = items.find(it => it.id === itemId);
      if (item) openModal("editItem", item);
    });
  });

  // Item delete buttons
  app.querySelectorAll(".item-delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteItem(btn.dataset.deleteItemId);
    });
  });

  // Drag & drop on items
  app.querySelectorAll(".drag-item").forEach(itemEl => {
    itemEl.addEventListener("dragstart", handleDragStart);
    itemEl.addEventListener("dragover", handleDragOver);
    itemEl.addEventListener("dragleave", handleDragLeave);
    itemEl.addEventListener("drop", handleDrop);
    itemEl.addEventListener("dragend", handleDragEnd);
  });
}

function bindMatrixEvents() {
  // Matrix cell click -> navigate to tree view
  app.querySelectorAll(".matrix-cell-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navigateToTreeCell(btn.dataset.matrixStage, btn.dataset.matrixDept);
    });
  });

  // Hover effect for matrix rows
  app.querySelectorAll(".matrix-row").forEach(row => {
    row.addEventListener("mouseenter", () => {
      row.style.background = "rgba(30,41,59,0.5)";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "";
    });
  });

  // Hover effect for matrix cell buttons
  app.querySelectorAll(".matrix-cell-btn").forEach(btn => {
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(6,182,212,0.2)";
      btn.style.borderColor = "rgba(6,182,212,0.4)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "rgba(6,182,212,0.1)";
      btn.style.borderColor = "rgba(6,182,212,0.2)";
    });
  });
}

function bindListEvents() {
  // Search input
  const searchInput = app.querySelector("#list-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      listSearchQuery = e.target.value;
      renderListContent();
    });
  }

  // Stage filter
  const stageFilter = app.querySelector("#list-filter-stage");
  if (stageFilter) {
    stageFilter.addEventListener("change", (e) => {
      listFilterStage = e.target.value;
      renderListContent();
    });
  }

  // Dept filter
  const deptFilter = app.querySelector("#list-filter-dept");
  if (deptFilter) {
    deptFilter.addEventListener("change", (e) => {
      listFilterDept = e.target.value;
      renderListContent();
    });
  }

  // List edit buttons (navigate to tree)
  bindListItemEvents();

  // Hover effect on list rows
  bindListRowHovers();
}

/**
 * Re-renders only the list items area + counter (avoids full page re-render on each keystroke)
 */
function renderListContent() {
  const filteredItems = getFilteredListItems();
  const container = app.querySelector("#list-items-container");
  if (!container) return;

  // Update counter
  const counterEl = app.querySelector("#list-filter-stage")?.parentElement;
  // Just re-render the whole list area since the filter bar stays
  if (filteredItems.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--slate-500);">
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto 0.75rem; color: var(--slate-600);">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
        </svg>
        <span>검색 결과가 없습니다.</span>
      </div>
    `;
  } else {
    container.innerHTML = filteredItems.map(item => `
      <div class="list-item-row" style="display: flex; align-items: center; gap: 1rem; padding: 0.875rem 1.25rem;
                  border-bottom: 1px solid var(--surface-3); transition: background 0.15s;">
        <div style="flex: 1; min-width: 0;">
          <p style="color: var(--slate-200); font-size: 0.875rem; line-height: 1.6;">${escapeHtml(item.content)}</p>
          <div class="flex items-center gap-2" style="margin-top: 0.375rem;">
            <span style="font-size: 0.6875rem; font-family: monospace; color: var(--slate-500); background: var(--surface-3); padding: 0.125rem 0.5rem; border-radius: 0.25rem;">
              ${escapeHtml(getStageName(item.stageId))}
            </span>
            <span style="font-size: 0.6875rem; font-family: monospace; color: var(--slate-500); background: var(--surface-3); padding: 0.125rem 0.5rem; border-radius: 0.25rem;">
              ${escapeHtml(getDeptName(item.departmentId))}
            </span>
            <span class="${item.isRequired ? "badge-danger" : "badge-neutral"}"
                  style="font-size: 0.625rem; padding: 0.0625rem 0.5rem; border-radius: 9999px; font-weight: 500;">
              ${item.isRequired ? "필수" : "선택"}
            </span>
          </div>
        </div>
        <button class="list-edit-btn btn-ghost btn-xs" data-list-stage="${item.stageId}" data-list-dept="${item.departmentId}"
                title="트리 뷰에서 편집"
                style="padding: 0.5rem; color: var(--slate-400); opacity: 0; transition: opacity 0.15s;">
          ${ICON_EDIT}
        </button>
      </div>
    `).join("");
  }

  bindListItemEvents();
  bindListRowHovers();
}

function bindListItemEvents() {
  app.querySelectorAll(".list-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navigateToTreeCell(btn.dataset.listStage, btn.dataset.listDept);
    });
  });
}

function bindListRowHovers() {
  app.querySelectorAll(".list-item-row").forEach(row => {
    const editBtn = row.querySelector(".list-edit-btn");
    row.addEventListener("mouseenter", () => {
      row.style.background = "rgba(30,41,59,0.5)";
      if (editBtn) editBtn.style.opacity = "1";
    });
    row.addEventListener("mouseleave", () => {
      row.style.background = "";
      if (editBtn) editBtn.style.opacity = "0";
    });
  });
}

// --- Modal Event Binding -----------------------------------------------------

function bindModalEvents() {
  // Close on backdrop click
  const backdrop = app.querySelector("#modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
  }

  // Close button
  const closeBtn = app.querySelector("#modal-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  // Cancel button
  const cancelBtn = app.querySelector("#modal-cancel-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeModal);
  }

  // Save item button (add or edit)
  const saveItemBtn = app.querySelector("#modal-save-btn");
  if (saveItemBtn) {
    saveItemBtn.addEventListener("click", () => {
      const contentEl = app.querySelector("#modal-item-content");
      const requiredEl = app.querySelector("#modal-item-required");
      const content = contentEl ? contentEl.value : "";
      const isRequired = requiredEl ? requiredEl.checked : false;
      const itemId = saveItemBtn.dataset.itemId;

      if (itemId) {
        handleEditItem(itemId, content, isRequired);
      } else {
        handleAddItem(content, isRequired);
      }
    });
  }

  // Save stage button
  const saveStageBtn = app.querySelector("#modal-save-stage-btn");
  if (saveStageBtn) {
    saveStageBtn.addEventListener("click", () => {
      const nameEl = app.querySelector("#modal-stage-name");
      const workNameEl = app.querySelector("#modal-stage-work-name");
      const gateNameEl = app.querySelector("#modal-stage-gate-name");
      const name = nameEl ? nameEl.value : "";
      const workStageName = workNameEl ? workNameEl.value : "";
      const gateStageName = gateNameEl ? gateNameEl.value : "";
      handleAddStage(name, workStageName, gateStageName);
    });
  }

  // Save dept button
  const saveDeptBtn = app.querySelector("#modal-save-dept-btn");
  if (saveDeptBtn) {
    saveDeptBtn.addEventListener("click", () => {
      const nameEl = app.querySelector("#modal-dept-name");
      const name = nameEl ? nameEl.value : "";
      handleAddDept(name);
    });
  }

  // Enter key handlers for modal inputs
  const stageNameInput = app.querySelector("#modal-stage-name");
  const stageWorkNameInput = app.querySelector("#modal-stage-work-name");
  const stageGateNameInput = app.querySelector("#modal-stage-gate-name");
  [stageNameInput, stageWorkNameInput, stageGateNameInput].forEach(input => {
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const btn = app.querySelector("#modal-save-stage-btn");
          if (btn) btn.click();
        }
      });
    }
  });

  const deptNameInput = app.querySelector("#modal-dept-name");
  if (deptNameInput) {
    deptNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const btn = app.querySelector("#modal-save-dept-btn");
        if (btn) btn.click();
      }
    });
  }

  // Escape key to close modal
  if (modal) {
    const escHandler = (e) => {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);
  }
}

// --- Cleanup -----------------------------------------------------------------

window.addEventListener("beforeunload", () => {
  if (activeItemUnsub) activeItemUnsub();
  if (allItemsUnsub) allItemsUnsub();
  unsubscribers.forEach(fn => typeof fn === "function" && fn());
});

// --- Start -------------------------------------------------------------------

init();
