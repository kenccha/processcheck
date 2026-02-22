// =============================================================================
// Admin Checklists — Template Management Page
// =============================================================================

import { guardPage, getUser } from "../auth.js";
import { renderNav, renderSpinner } from "../components.js";
import {
  getTemplateStages, getTemplateDepartments, subscribeTemplateItems,
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
let items = [];
let activeItemUnsub = null;
let modal = null; // null | {type, data}
let dragState = { draggedId: null, overId: null };

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

// --- Stage/Dept Selection ----------------------------------------------------

function selectStage(stageId) {
  selectedStageId = stageId;
  subscribeToItems();
}

function selectDept(deptId) {
  selectedDeptId = deptId;
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

async function handleAddStage(name, type) {
  if (!name.trim()) return;
  try {
    await addTemplateStage({ name: name.trim(), type, createdBy: user.name });
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

// --- SVG Icons ---------------------------------------------------------------

const ICON_DRAG = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"/></svg>`;

const ICON_EDIT = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>`;

const ICON_DELETE = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;

const ICON_PLUS = `<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`;

const ICON_CLOSE = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;

// --- Render ------------------------------------------------------------------

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
          <p class="text-sm text-soft mt-1">프로젝트에 적용할 체크리스트 템플릿의 단계별, 부서별 항목을 관리합니다.</p>
        </div>
      </div>

      <!-- Main Layout: Sidebar + Content -->
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
              : stages.map(stage => `
                <div class="flex items-center gap-2 cursor-pointer select-none stage-item ${stage.id === selectedStageId ? "active" : ""}"
                     data-stage-id="${stage.id}"
                     style="padding: 0.625rem 1rem; border-bottom: 1px solid var(--surface-3); transition: background 0.15s;
                            ${stage.id === selectedStageId ? "background: rgba(6, 182, 212, 0.08); border-left: 3px solid var(--primary-400);" : "border-left: 3px solid transparent;"}">
                  <div style="flex: 1; min-width: 0;">
                    <div class="text-sm font-medium truncate" style="color: ${stage.id === selectedStageId ? "var(--primary-300)" : "var(--slate-300)"};">
                      ${escapeHtml(stage.name)}
                    </div>
                    <span class="badge ${stage.type === "gate" ? "badge-warning" : "badge-primary"}" style="font-size: 0.625rem; padding: 0.0625rem 0.375rem; margin-top: 0.25rem;">
                      ${stage.type === "gate" ? "Gate" : "Work"}
                    </span>
                  </div>
                  <button class="btn-ghost btn-xs stage-delete-btn" data-stage-delete-id="${stage.id}" title="단계 삭제"
                          style="padding: 0.25rem; color: var(--slate-600); flex-shrink: 0;">
                    ${ICON_DELETE}
                  </button>
                </div>
              `).join("")
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
    </div>

    ${renderModal()}
  `;

  bindEvents();
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
          <span class="modal-title">단계 추가</span>
          <button class="modal-close" id="modal-close-btn">${ICON_CLOSE}</button>
        </div>
        <div class="modal-body">
          <div class="flex flex-col gap-4">
            <div>
              <label class="text-sm font-medium" style="color: var(--slate-300); display: block; margin-bottom: 0.375rem;">단계 이름</label>
              <input type="text" class="input-field" id="modal-stage-name" placeholder="예: 12. 사후관리">
            </div>
            <div>
              <label class="text-sm font-medium" style="color: var(--slate-300); display: block; margin-bottom: 0.375rem;">단계 유형</label>
              <select class="input-field" id="modal-stage-type">
                <option value="work">Work (작업 단계)</option>
                <option value="gate">Gate (승인 단계)</option>
              </select>
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

  // Modal event binding
  bindModalEvents();
}

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
      const typeEl = app.querySelector("#modal-stage-type");
      const name = nameEl ? nameEl.value : "";
      const type = typeEl ? typeEl.value : "work";
      handleAddStage(name, type);
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
  if (stageNameInput) {
    stageNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const btn = app.querySelector("#modal-save-stage-btn");
        if (btn) btn.click();
      }
    });
  }

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
  unsubscribers.forEach(fn => typeof fn === "function" && fn());
});

// --- Start -------------------------------------------------------------------

init();
