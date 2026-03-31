// =============================================================================
// User Administration Page — observer only
// =============================================================================

import { guardPage } from "../auth.js";
import { confirmModal } from "../ui/confirm-modal.js";
import { showToast } from "../ui/toast.js";
import { renderNav, initTheme } from "../components.js";
initTheme();
import {
  subscribeUsers,
  updateUserRole,
  updateUserDepartment,
  deactivateUser,
  activateUser,
  previewAssigneeTransfer,
  executeAssigneeTransfer,
} from "../firestore-service.js";
import { departments, escapeHtml } from "../utils.js";

// --- Auth guard ---
const user = guardPage("observer");
if (!user) throw new Error("Not authenticated");

// --- DOM refs ---
const navRoot = document.getElementById("nav-root");
const app = document.getElementById("app");

// --- State ---
let users = [];
let searchQuery = "";
let roleFilter = "";
let deptFilter = "";

// --- Render nav ---
const unsubNav = renderNav(navRoot);

// --- Subscription ---
const unsub = subscribeUsers((list) => {
  users = list;
  render();
});

// --- Cleanup ---
window.addEventListener("beforeunload", () => {
  if (unsub) unsub();
  if (unsubNav) unsubNav();
});

// =============================================================================
// Main render
// =============================================================================

function getFiltered() {
  let filtered = [...users];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
    );
  }
  if (roleFilter) {
    filtered = filtered.filter((u) => u.role === roleFilter);
  }
  if (deptFilter) {
    filtered = filtered.filter((u) => u.department === deptFilter);
  }
  // 미배정 사용자를 상단에 정렬
  filtered.sort((a, b) => {
    const aEmpty = !a.department || a.department === "";
    const bEmpty = !b.department || b.department === "";
    if (aEmpty && !bEmpty) return -1;
    if (!aEmpty && bEmpty) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });
  return filtered;
}

function render() {
  const filtered = getFiltered();
  const totalActive = users.filter((u) => u.active !== false).length;
  const workers = users.filter((u) => u.role === "worker").length;
  const managers = users.filter((u) => u.role === "manager").length;
  const observers = users.filter((u) => u.role === "observer").length;
  const admins = users.filter((u) => u.role === "admin").length;
  const unassigned = users.filter((u) => !u.department || u.department === "").length;

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100);">사용자 관리</h1>
          <p class="text-sm text-dim" style="margin-top: 0.25rem;">전체 ${users.length}명 (활성 ${totalActive}명)</p>
        </div>
        <button id="bulk-transfer-btn" class="btn" style="background:var(--primary-500);color:#fff;padding:0.375rem 0.75rem;border-radius:0.5rem;font-size:0.8rem;border:none;cursor:pointer;min-height:2.25rem;">
          🔄 업무 이관
        </button>
      </div>

      <!-- Bulk Transfer Modal (hidden) -->
      <div id="transfer-panel" style="display:none;" class="card mb-4" style="border:1px solid var(--primary-300);padding:1.25rem;">
        <h3 class="text-sm font-semibold mb-3" style="color:var(--slate-200)">담당자 업무 일괄 이관</h3>
        <div class="flex items-center gap-3 flex-wrap">
          <div>
            <label class="text-xs text-soft">현재 담당자</label>
            <select id="transfer-from" class="input-field" style="padding:0.25rem 0.5rem;font-size:0.8rem;min-width:120px;">
              <option value="">선택...</option>
              ${users.filter(u => u.active !== false).map(u => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join("")}
            </select>
          </div>
          <span style="color:var(--slate-400);font-size:1.2rem;margin-top:1rem;">→</span>
          <div>
            <label class="text-xs text-soft">새 담당자</label>
            <select id="transfer-to" class="input-field" style="padding:0.25rem 0.5rem;font-size:0.8rem;min-width:120px;">
              <option value="">선택...</option>
              ${users.filter(u => u.active !== false).map(u => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join("")}
            </select>
          </div>
          <button id="transfer-preview-btn" class="btn" style="background:var(--surface-3);color:var(--slate-200);padding:0.25rem 0.75rem;border-radius:0.375rem;font-size:0.75rem;border:none;cursor:pointer;margin-top:1rem;">미리보기</button>
          <button id="transfer-exec-btn" class="btn" style="background:var(--primary-500);color:#fff;padding:0.25rem 0.75rem;border-radius:0.375rem;font-size:0.75rem;border:none;cursor:pointer;margin-top:1rem;" disabled>이관 실행</button>
        </div>
        <div id="transfer-preview" class="text-xs text-soft" style="margin-top:0.5rem;"></div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card">
          <div class="stat-card-label">전체</div>
          <div class="stat-card-row"><span class="stat-value">${users.length}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">실무자</div>
          <div class="stat-card-row"><span class="stat-value">${workers}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">매니저</div>
          <div class="stat-card-row"><span class="stat-value">${managers}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">기획조정실</div>
          <div class="stat-card-row"><span class="stat-value">${observers}</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">관리자</div>
          <div class="stat-card-row"><span class="stat-value">${admins}</span></div>
        </div>
        ${unassigned > 0 ? `<div class="stat-card" style="border-left:3px solid var(--warning-400);background:rgba(245,158,11,0.05);">
          <div class="stat-card-label" style="color:var(--warning-400)">미배정</div>
          <div class="stat-card-row"><span class="stat-value" style="color:var(--warning-400)">${unassigned}</span></div>
        </div>` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="card p-4 mb-6">
        <div class="flex flex-wrap gap-3">
          <input type="text" class="input-field" id="user-search" placeholder="이름 또는 이메일 검색..." value="${escapeHtml(searchQuery)}" style="flex:1;min-width:200px">
          <select class="input-field" id="role-filter" style="width:auto;min-width:130px">
            <option value="">전체 역할</option>
            <option value="worker" ${roleFilter === "worker" ? "selected" : ""}>실무자</option>
            <option value="manager" ${roleFilter === "manager" ? "selected" : ""}>매니저</option>
            <option value="observer" ${roleFilter === "observer" ? "selected" : ""}>기획조정실</option>
            <option value="admin" ${roleFilter === "admin" ? "selected" : ""}>관리자</option>
          </select>
          <select class="input-field" id="dept-filter" style="width:auto;min-width:130px">
            <option value="">전체 부서</option>
            ${departments
              .map(
                (d) =>
                  `<option value="${d}" ${deptFilter === d ? "selected" : ""}>${escapeHtml(d)}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>

      <!-- User Table -->
      <div class="card">
        ${
          filtered.length === 0
            ? `<div class="empty-state" style="padding:3rem"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m8-10a4 4 0 100-8 4 4 0 000 8z"/></svg><span class="empty-state-text">사용자가 없습니다</span></div>`
            : `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>역할</th>
                <th>부서</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(
                  (u) => `
                <tr style="${!u.department || u.department === '' ? 'background:rgba(245,158,11,0.05);border-left:3px solid var(--warning-400)' : ''}">
                  <td>
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold" style="color:var(--slate-200)">${escapeHtml(u.name)}</span>
                      ${u.authProvider === "microsoft" ? '<span class="badge badge-info" style="font-size:0.6rem">MS</span>' : ""}
                      ${!u.department || u.department === '' ? '<span class="badge badge-warning" style="font-size:0.55rem">미배정</span>' : ""}
                    </div>
                  </td>
                  <td class="text-xs" style="color:var(--slate-400)">${escapeHtml(u.email || "-")}</td>
                  <td>
                    <select class="input-field" data-role-change="${u.id}" style="padding:0.25rem 0.5rem;font-size:0.75rem;width:auto;min-width:90px">
                      <option value="worker" ${u.role === "worker" ? "selected" : ""}>실무자</option>
                      <option value="manager" ${u.role === "manager" ? "selected" : ""}>매니저</option>
                      <option value="observer" ${u.role === "observer" ? "selected" : ""}>기획조정실</option>
                      <option value="admin" ${u.role === "admin" ? "selected" : ""}>관리자</option>
                    </select>
                  </td>
                  <td>
                    <select class="input-field" data-dept-change="${u.id}" style="padding:0.25rem 0.5rem;font-size:0.75rem;width:auto;min-width:90px">
                      ${departments
                        .map(
                          (d) =>
                            `<option value="${d}" ${u.department === d ? "selected" : ""}>${escapeHtml(d)}</option>`
                        )
                        .join("")}
                    </select>
                  </td>
                  <td>
                    ${
                      u.active !== false
                        ? '<span class="badge badge-success">활성</span>'
                        : '<span class="badge badge-danger">비활성</span>'
                    }
                  </td>
                  <td>
                    ${
                      u.active !== false
                        ? `<button class="btn-ghost btn-sm" data-deactivate="${u.id}" style="color:var(--danger-400);font-size:0.75rem">비활성화</button>`
                        : `<button class="btn-primary btn-sm" data-activate="${u.id}" style="font-size:0.75rem">활성화</button>`
                    }
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        `
        }
      </div>
    </div>
  `;

  bindEvents();
}

// =============================================================================
// Event binding
// =============================================================================

function bindEvents() {
  // Bulk transfer toggle
  const bulkBtn = document.getElementById("bulk-transfer-btn");
  const transferPanel = document.getElementById("transfer-panel");
  if (bulkBtn && transferPanel) {
    bulkBtn.addEventListener("click", () => {
      transferPanel.style.display = transferPanel.style.display === "none" ? "block" : "none";
    });
  }

  // Transfer preview
  const previewBtn = document.getElementById("transfer-preview-btn");
  if (previewBtn) {
    previewBtn.addEventListener("click", async () => {
      const from = document.getElementById("transfer-from")?.value;
      const previewDiv = document.getElementById("transfer-preview");
      const execBtn = document.getElementById("transfer-exec-btn");
      if (!from) { previewDiv.textContent = "현재 담당자를 선택하세요."; return; }
      const result = await previewAssigneeTransfer(from);
      previewDiv.textContent = `${from}님의 미완료 작업 ${result.active}건 (전체 ${result.total}건)이 이관됩니다.`;
      if (execBtn) execBtn.disabled = result.active === 0;
    });
  }

  // Transfer execute
  const execBtn = document.getElementById("transfer-exec-btn");
  if (execBtn) {
    execBtn.addEventListener("click", async () => {
      const from = document.getElementById("transfer-from")?.value;
      const to = document.getElementById("transfer-to")?.value;
      if (!from || !to) { showToast("error", "담당자를 모두 선택하세요."); return; }
      if (from === to) { showToast("error", "같은 사람에게 이관할 수 없습니다."); return; }
      execBtn.disabled = true;
      execBtn.textContent = "이관 중...";
      try {
        const count = await executeAssigneeTransfer(from, to);
        showToast("success", `${count}건의 작업이 ${to}님에게 이관되었습니다.`);
        execBtn.textContent = "이관 실행";
        document.getElementById("transfer-panel").style.display = "none";
      } catch (err) {
        showToast("error", "이관 실패: " + err.message);
        execBtn.disabled = false;
        execBtn.textContent = "이관 실행";
      }
    });
  }

  // Search
  const searchInput = app.querySelector("#user-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      render();
      const el = app.querySelector("#user-search");
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  // Role filter
  const roleSelect = app.querySelector("#role-filter");
  if (roleSelect) {
    roleSelect.addEventListener("change", (e) => {
      roleFilter = e.target.value;
      render();
    });
  }

  // Dept filter
  const deptSelect = app.querySelector("#dept-filter");
  if (deptSelect) {
    deptSelect.addEventListener("change", (e) => {
      deptFilter = e.target.value;
      render();
    });
  }

  // Role change per user
  app.querySelectorAll("[data-role-change]").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      try {
        await updateUserRole(sel.dataset.roleChange, e.target.value);
      } catch (err) {
        showToast('error', "역할 변경 실패: " + err.message);
      }
    });
  });

  // Department change per user
  app.querySelectorAll("[data-dept-change]").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const userId = sel.dataset.deptChange;
      const newDept = e.target.value;
      const userName = users.find(u => u.id === userId)?.name || "";
      try {
        const migrate = await confirmModal(
          `${userName}님의 부서를 '${newDept}'(으)로 변경합니다.\n배정된 미완료 작업의 부서도 함께 변경하시겠습니까?`
        );
        const result = await updateUserDepartment(userId, newDept, migrate);
        if (migrate && result.migrated > 0) {
          showToast('success', `부서 변경 완료 (작업 ${result.migrated}건 이관)`);
        } else {
          showToast('success', '부서 변경 완료');
        }
      } catch (err) {
        showToast('error', "부서 변경 실패: " + err.message);
      }
    });
  });

  // Deactivate
  app.querySelectorAll("[data-deactivate]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!await confirmModal("이 사용자를 비활성화하시겠습니까?")) return;
      try {
        await deactivateUser(btn.dataset.deactivate);
      } catch (err) {
        showToast('error', "비활성화 실패: " + err.message);
      }
    });
  });

  // Activate
  app.querySelectorAll("[data-activate]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await activateUser(btn.dataset.activate);
      } catch (err) {
        showToast('error', "활성화 실패: " + err.message);
      }
    });
  });
}
