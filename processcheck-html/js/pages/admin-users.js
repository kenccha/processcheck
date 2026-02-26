// =============================================================================
// User Administration Page — observer only
// =============================================================================

import { guardPage } from "../auth.js";
import { renderNav, renderSpinner, initTheme } from "../components.js";
initTheme();
import {
  subscribeUsers,
  updateUserRole,
  updateUserDepartment,
  deactivateUser,
  activateUser,
} from "../firestore-service.js";
import { departments, escapeHtml, getRoleName } from "../utils.js";

// --- Auth guard ---
const user = guardPage();
if (!user) throw new Error("Not authenticated");
if (user.role !== "observer") {
  window.location.href = "dashboard.html";
  throw new Error("Not authorized");
}

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
  return filtered;
}

function render() {
  const filtered = getFiltered();
  const totalActive = users.filter((u) => u.active !== false).length;
  const workers = users.filter((u) => u.role === "worker").length;
  const managers = users.filter((u) => u.role === "manager").length;
  const observers = users.filter((u) => u.role === "observer").length;

  app.innerHTML = `
    <div class="container animate-fade-in">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight" style="color: var(--slate-100);">사용자 관리</h1>
          <p class="text-sm text-dim" style="margin-top: 0.25rem;">전체 ${users.length}명 (활성 ${totalActive}명)</p>
        </div>
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
                <tr>
                  <td>
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold" style="color:var(--slate-200)">${escapeHtml(u.name)}</span>
                      ${u.authProvider === "microsoft" ? '<span class="badge badge-info" style="font-size:0.6rem">MS</span>' : ""}
                    </div>
                  </td>
                  <td class="text-xs" style="color:var(--slate-400)">${escapeHtml(u.email || "-")}</td>
                  <td>
                    <select class="input-field" data-role-change="${u.id}" style="padding:0.25rem 0.5rem;font-size:0.75rem;width:auto;min-width:90px">
                      <option value="worker" ${u.role === "worker" ? "selected" : ""}>실무자</option>
                      <option value="manager" ${u.role === "manager" ? "selected" : ""}>매니저</option>
                      <option value="observer" ${u.role === "observer" ? "selected" : ""}>기획조정실</option>
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
        alert("역할 변경 실패: " + err.message);
      }
    });
  });

  // Department change per user
  app.querySelectorAll("[data-dept-change]").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      try {
        await updateUserDepartment(sel.dataset.deptChange, e.target.value);
      } catch (err) {
        alert("부서 변경 실패: " + err.message);
      }
    });
  });

  // Deactivate
  app.querySelectorAll("[data-deactivate]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("이 사용자를 비활성화하시겠습니까?")) return;
      try {
        await deactivateUser(btn.dataset.deactivate);
      } catch (err) {
        alert("비활성화 실패: " + err.message);
      }
    });
  });

  // Activate
  app.querySelectorAll("[data-activate]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await activateUser(btn.dataset.activate);
      } catch (err) {
        alert("활성화 실패: " + err.message);
      }
    });
  });
}
